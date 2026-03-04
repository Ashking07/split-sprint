/**
 * Dedicated Vercel function for Splitwise OAuth callback.
 * Routes through Express so req.get(), req.query, etc. work correctly.
 * Code and state arrive intact since this bypasses the /api/(.*) rewrite.
 */
import app from "../../server.js";

export default app;
