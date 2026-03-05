# SplitSprint – Interview Prep Guide

## Summary

**SplitSprint** is a mobile-first PWA that splits bills and syncs with Splitwise. Built with Vite + React, Express + MongoDB, deployed on Vercel. Key features: AI receipt parsing (OpenAI), equal/itemized splits, Splitwise OAuth integration, PWA install. Major challenges solved: 504 cold starts, Splitwise OAuth in production, wrong payer in Splitwise, Zustand hydration, iPhone touch reliability, and safe-area layout on Dynamic Island.

---

## Founder's Journey

One of my personal breakthroughs with this project was recognizing a real pain point in my own life—splitting bills with friends was tedious and error-prone—and deciding to build a product to solve it. I didn't wait for permission or a perfect plan; I identified the problem, validated it mattered, and shipped. During development, when things slowed down or broke in production, I leaned on the browser's DevTools and Network tab to pinpoint latency bottlenecks: which endpoints were timing out, which requests were competing, and where cold starts were killing the experience. That data-driven debugging—seeing the 504s, the 14-second `/api/bills` calls, the cascade of retries—led directly to targeted fixes: warming the API before critical flows, scoping `fetchHistory` to only when needed, and optimizing the bills query. Building SplitSprint taught me that the best products come from solving your own problems first, and the best fixes come from measuring before you optimize.

---

## 1. What is SplitSprint?

**SplitSprint** is a mobile-first PWA that splits bills and syncs with Splitwise. The goal is to split a bill in under 2 minutes.

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vite 6, React 18, TypeScript, Tailwind CSS 4, Zustand, Motion, Radix UI |
| **Backend** | Express.js, MongoDB (Mongoose 8), JWT auth |
| **AI** | OpenAI (gpt-4o-mini) for receipt parsing |
| **Deployment** | Vercel (frontend + serverless API) |
| **PWA** | vite-plugin-pwa (Workbox) |

---

## 2. Architecture

### 2.1 Frontend

- **Entry:** `src/main.tsx` – mounts App, InstallPrompt, Vercel Analytics; fires `/api/health` on load to warm the API.
- **Routing:** Screen-based state in Zustand (`billStore.screen`), no React Router.
- **State:** `billStore` (bill flow, items, groups, history) and `authStore` (token, user) with Zustand persist.
- **Hydration:** `useStoresHydrated` waits for Zustand rehydration before rendering to avoid "payload" errors.

### 2.2 Backend / API

- **Entry:** `server.js` – Express app used by local dev and Vercel.
- **Vercel:** `/api/(.*)` rewrites to `/api?path=$1`; middleware restores `req.url` from `req.query.path`.
- **Splitwise OAuth:** Dedicated functions (`api/splitwise/connect.js`, `callback.js`, `status.js`) so query params are preserved.
- **SPA fallback:** Non-API routes serve `/index.html`.

### 2.3 Data Flow

```
Camera/Paste → Parse (OpenAI) → Review → Choose Group → Split Setup → Confirmation → Splitwise
```

---

## 3. Important Features & Implementation

### 3.1 Receipt Parsing (AI)

- **Flow:** Image (base64) or pasted text → `POST /api/receipts/parse` → OpenAI.
- **Implementation:** `server/lib/openaiReceiptParser.js` – vision for images, text for pasted content; structured JSON output.
- **Details:** `gpt-4o-mini`, ~5MB image limit, 50k chars for text.

### 3.2 Bill Splitting

- **Modes:** Equal and itemized (assign items to people).
- **Logic:** Integer cents, deterministic rounding (`Math.floor(total/n)` + remainder).
- **Files:** `src/lib/settlement/index.ts`, `server/lib/settlement.js`.

### 3.3 Splitwise Integration

- **OAuth:** Same-tab redirect; state stored in MongoDB with TTL.
- **Create expense:** Maps participants to Splitwise users, sends `paid_share`/`owed_share` via form-urlencoded.
- **Payer:** Uses `/get_current_user` to ensure the logged-in user is the payer.

### 3.4 Groups

- Splitsprint-only or Splitwise-backed groups.
- Can create groups from Splitwise or link existing groups.

### 3.5 PWA

- Add to Home Screen, offline caching.
- `navigateFallbackDenylist: [/^\/api\//]` so API calls are not cached by the service worker.

---

## 4. Major Issues & Solutions

### 4.1 504 Gateway Timeout / Cold Start

**Problem:** Serverless cold start + MongoDB latency (e.g. MongoDB in sa-east-1, Vercel in sfo1) caused 30+ second delays and 504s.

**Short-term fixes:**
- `fetchWithRetry` – retry once after 2.5s on 504.
- `fetchHistory` only on home/history screens.
- Warm-up: `/api/health` on app load, Confirmation mount, SplitSetup mount.
- Hard refresh on Receipt Review page to warm the API before the rest of the flow.

**Long-term fixes:**
- MongoDB connection options: `serverSelectionTimeoutMS: 8000`, `connectTimeoutMS: 8000`.
- Eager connection on module load.
- Cron hitting `/api/health` daily.
- Optimize `GET /api/bills` (projection, limit 50, remove heavy aggregation).
- Align Vercel region with MongoDB (e.g. `gru1` for sa-east-1).

### 4.2 Splitwise Connection Failing in Production

**Problem:** Connect button refreshed the page instead of starting OAuth.

**Root causes:**
1. **Trailing slash in `ALLOWED_ORIGINS`** – `https://.../` vs `https://...` → strip trailing slashes.
2. **Service worker** – PWA was intercepting `/api/*` and serving `index.html` → `navigateFallbackDenylist: [/^\/api\//]`.
3. **`checkAuth` clearing token on 504** – User logged out on timeout → only clear token on 401, not on 5xx.

### 4.3 "Create in Splitwise" Not Working

**Problem:** Loading spinner, no expense created.

**Root causes:**
1. **Content-Type** – Splitwise expects `application/x-www-form-urlencoded` for `create_expense`; we were sending JSON.
2. **`saveBillAndFinalize` blocking** – It awaited `fetchHistory()` (which 504'd) → run `fetchHistory` in the background (fire-and-forget).
3. **Performance** – `User.find()` and `splitwiseFetch("/get_groups")` inside a loop → hoist out and run once in parallel.

### 4.4 Zustand Hydration / "payload" Error

**Problem:** `Cannot read properties of undefined (reading 'payload')` on first load.

**Solution:** `useStoresHydrated` with `skipHydration: true`, manual `rehydrate()`, wait for `onFinishHydration`, 3s timeout fallback.

### 4.5 React Hooks Error (#310)

**Problem:** "Rendered more hooks than during the previous render."

**Solution:** All hooks at the top of `App.tsx`, before any conditional returns.

### 4.6 Wrong Payer in Splitwise

**Problem:** Gaurav shown as payer instead of Ashwin.

**Solution:** Call Splitwise `/get_current_user` when creating the expense to get the payer ID from the token owner; put payer first in the users list; robust numeric ID matching in fallback.

### 4.7 iPhone Touch Issues (By Item Selection)

**Problem:** User selection in the drawer was unreliable on iPhone.

**Solution:** Larger touch targets (min 44px), `touch-action: manipulation`, `onPointerDown` instead of `onClick`, `WebkitTapHighlightColor: transparent`.

### 4.8 Success Page Behind Dynamic Island

**Problem:** Green checkmark hidden behind the notch.

**Solution:** `paddingTop: max(1.5rem, calc(env(safe-area-inset-top) + 1rem))` and similar for bottom.

---

## 5. API Architecture

### Auth

- JWT (7 days) in `localStorage`.
- `Authorization: Bearer <token>` on protected routes.
- `authMiddleware` verifies JWT and sets `req.userId`.

### Main Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/signup`, `/login` | Auth |
| GET | `/api/me` | Current user |
| GET | `/api/bills` | List bills |
| POST | `/api/bills` | Create bill |
| POST | `/api/bills/:id/finalize` | Finalize bill |
| POST | `/api/receipts/parse` | Parse receipt (OpenAI) |
| GET/POST | `/api/groups` | Groups CRUD |
| GET | `/api/splitwise/connect` | Start OAuth |
| GET | `/api/splitwise/callback` | OAuth callback |
| POST | `/api/splitwise/expenses/create` | Create Splitwise expense |

### Models

- **User:** email, password (bcrypt), name.
- **Bill:** ownerId, groupId, items, tax/tip, splitMode, participantsByItem, status, splitwiseExpenseId.
- **Group:** name, ownerId, memberIds, splitwiseGroupId, splitwiseMembers.
- **SplitwiseConnection:** tokens, splitwiseAccountId, splitwiseEmail.

---

## 6. How SplitSprint Helps Users

1. **Speed** – Split a bill in under 2 minutes instead of manual entry.
2. **AI parsing** – Photo or paste → automatic items, prices, tax.
3. **Flexible splits** – Equal or itemized (assign items to people).
4. **Splitwise sync** – One tap to create expense in Splitwise; everyone gets notified.
5. **Mobile-first PWA** – Add to Home Screen, works like a native app.
6. **Groups** – Reuse groups and link them to Splitwise.
7. **Gamification** – XP and streaks to encourage regular use.

---

## 7. Interview Talking Points

- **Full-stack ownership** – React + Express + MongoDB on Vercel.
- **Production debugging** – Cold starts, OAuth, service worker, hydration.
- **Data-driven fixes** – DevTools/Network tab to identify latency bottlenecks.
- **Diagnostic endpoints** – `/api/splitwise/config`, `/api/debug/db`.
- **Performance** – Warm-up, retries, scoped fetchHistory, optimized bills query.
- **Mobile UX** – Safe areas, touch targets, `onPointerDown` for reliability.
- **AI integration** – Structured output from OpenAI for receipt parsing.
- **OAuth** – State, redirect URI, CORS, query param handling.
