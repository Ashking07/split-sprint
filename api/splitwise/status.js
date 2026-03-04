/**
 * Dedicated Vercel function for Splitwise status.
 * Routes through Express so req.get(), req.query, etc. work correctly.
 * Bypasses the /api/(.*) rewrite to avoid query param issues.
 */
import app from "../../server.js";

export default app;
