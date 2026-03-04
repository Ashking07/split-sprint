# Splitwise OAuth Production Debug Prompt

Copy and paste this to ChatGPT if the fixes don't resolve the issue:

---

**Context:** I have a React + Vite + Express app deployed on Vercel (https://split-sprint.vercel.app). Splitwise OAuth connection works locally but fails in production.

**Tech stack:**
- Frontend: Vite + React, Zustand (persist middleware)
- Backend: Express on Vercel serverless (api/index.js)
- Vercel rewrites: `/api/(.*)` → `/api?path=$1` (path restored in Express middleware)
- Splitwise OAuth: same-tab redirect flow

**Flow:**
1. User clicks "Connect Splitwise" → navigates to `/api/splitwise/connect?token=...&returnTo=...&origin=...`
2. Server redirects to Splitwise authorize URL
3. Splitwise redirects back to `/api/splitwise/callback?code=...&state=...`
4. Server exchanges code for token, saves to MongoDB, redirects to `/oauth/splitwise?returnTo=...`
5. App loads OAuthSplitwiseLanding, verifies status, redirects to integrations/home

**Vercel env vars (must be set):**
- SPLITWISE_CLIENT_ID, SPLITWISE_CLIENT_SECRET
- SPLITWISE_REDIRECT_URI = `https://split-sprint.vercel.app/api/splitwise/callback`
- APP_ORIGIN = `https://split-sprint.vercel.app`
- ALLOWED_ORIGINS = `https://split-sprint.vercel.app`
- MONGODB_URI, JWT_SECRET

**Splitwise app:** Must have `https://split-sprint.vercel.app/api/splitwise/callback` in redirect URIs.

**Diagnostic endpoint:** GET `https://split-sprint.vercel.app/api/splitwise/config` returns config status (no secrets). Check if `configured: true`.

**What I need help with:**
1. Identify why Splitwise connection fails on production (works locally)
2. Common causes: wrong redirect_uri, env vars not set, MongoDB cold start timeout, CORS, rewrite not preserving path/query
3. How to debug: check browser Network tab for the /api/splitwise/connect and /api/splitwise/callback requests; check Vercel function logs for errors
