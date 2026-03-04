/**
 * Dedicated Vercel function for Splitwise OAuth connect.
 * Routes through Express so req.get(), req.query, etc. work correctly.
 * Bypasses the /api/(.*) rewrite since this file matches the path directly.
 */
import app from "../../server.js";

export default app;
