/**
 * Single API handler for all /api/* routes.
 * Vercel rewrite sends /api/:path* to /api with path as query param.
 * We restore req.url so Express routing works.
 */
import app from "../server.js";

export default app;
