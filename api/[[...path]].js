/**
 * Single catch-all handler for all API routes. Uses the Express app from server.js.
 * This keeps the deployment under Vercel's 12 serverless function limit (Hobby plan).
 */
import app from "../server.js";

export default app;
