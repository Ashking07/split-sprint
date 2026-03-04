# SplitSprint

Split bills in under 2 minutes. Mobile-first PWA for splitting bills and syncing with Splitwise.

## Tech Stack

- **Frontend**: Vite + React, Tailwind CSS, PWA
- **Backend**: Express.js, MongoDB
- **Deploy**: Vercel (frontend + API serverless)

## Local Development

```bash
# Install dependencies
npm install

# Run API (port 3002)
npm run dev:api

# Run frontend (port 5173) - in another terminal
npm run dev

# Or run both
npm run dev:all
```

For full-stack with Vercel CLI:

```bash
vercel dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. See `.env.example` for required vars.

## Deploy to Vercel

1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/Ashking07/split-sprint.git
   git push -u origin main
   ```

2. [Import the project](https://vercel.com/new) in Vercel → connect your GitHub repo.

3. Add environment variables in Vercel project settings (Dashboard → Settings → Environment Variables):
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `OPENAI_API_KEY`
   - `OPENAI_RECEIPT_MODEL` (optional, default: gpt-4o-mini)
   - `SPLITWISE_CLIENT_ID`
   - `SPLITWISE_CLIENT_SECRET`
   - `SPLITWISE_REDIRECT_URI` = `https://your-app.vercel.app/api/splitwise/callback`
   - `APP_ORIGIN` = `https://your-app.vercel.app`
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app`

4. In [Splitwise Developer Console](https://www.splitwise.com/developer/apps), add the redirect URI:
   `https://your-app.vercel.app/api/splitwise/callback`

5. Deploy. Vercel will build the frontend and deploy the Express API as a serverless function.
