import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./server/lib/mongodb.js";
import { User } from "./server/models/User.js";
import { Usage } from "./server/models/Usage.js";
import { signToken, verifyToken } from "./server/lib/auth.js";
import { rateLimitMiddleware, getClientIp } from "./server/lib/rateLimiter.js";
import { recordRequestTiming } from "./server/lib/latencyMetrics.js";
import groupsRouter from "./server/routes/groups.js";
import billsRouter from "./server/routes/bills.js";
import receiptsRouter from "./server/routes/receipts.js";
import splitwiseRouter from "./server/routes/splitwise.js";
import adminRouter from "./server/routes/admin.js";

const app = express();

app.set("trust proxy", 1);

// Vercel rewrite: /api/splitwise/callback?code=...&state=... → /api?path=splitwise/callback&code=...&state=...
// Restore req.url from req.query, preserving code/state and all other params (critical for OAuth callback)
app.use((req, _res, next) => {
  const p = req.query?.path;
  if (!p) return next();

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "path") continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, String(x)));
    else if (v != null) params.append(k, String(v));
  }
  const qs = params.toString();
  req.url = `/api/${p.replace(/^\//, "")}${qs ? `?${qs}` : ""}`;
  next();
});

app.use(cors());
app.get("/api/health", (_req, res) => {
  connectDB().catch(() => {});
  res.status(200).json({ ok: true });
});
app.get("/api/debug/db", async (_req, res) => {
  try {
    const start = Date.now();
    await connectDB();
    const ms = Date.now() - start;
    res.json({ ok: true, ms, readyState: (await import("mongoose")).default.connection.readyState });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, stack: err.stack?.split("\n").slice(0, 5) });
  }
});
// Receipt images as base64 can be ~5MB; default 100kb is too small
app.use(express.json({ limit: "6mb" }));

// ── Request timing logs + in-memory latency metrics ─────────────────────
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    if (!req.path?.startsWith("/api")) return;

    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const requestPath = (req.originalUrl || req.url || req.path || "").split("?")[0];
    recordRequestTiming({
      method: req.method,
      path: requestPath,
      status: res.statusCode,
      ms: elapsedMs,
    });

    if (requestPath === "/api/health") return;
    const line = `[REQ] ${req.method} ${requestPath} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`;
    if (res.statusCode >= 500 || elapsedMs >= 1000) console.warn(line);
    else console.info(line);
  });

  next();
});

// ── Auth rate limits: 5 requests per 10 min per IP ──────────────────────
const authRateLimit = rateLimitMiddleware({
  keyFn: (req) => `auth:ip:${getClientIp(req)}`,
  max: 5,
  windowMs: 10 * 60 * 1000,
  message: "Too many login/signup attempts. Please try again in a few minutes.",
});

app.post("/api/auth/signup", authRateLimit, async (req, res) => {
  try {
    await connectDB();
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }
    const user = await User.create({ email: emailNorm, password, name: name || "" });
    // Initialize usage credits for new user
    await Usage.getOrCreate(user._id);
    const token = signToken(user._id.toString());
    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        xp: user.xp ?? 0,
        streak: user.streak ?? 0,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: err.message || "Signup failed" });
  }
});

app.post("/api/auth/login", authRateLimit, async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailNorm }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = signToken(user._id.toString());
    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        xp: user.xp ?? 0,
        streak: user.streak ?? 0,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: err.message || "Login failed" });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    await connectDB();
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const userId = await verifyToken(token);
    if (!userId) return res.status(401).json({ error: "Invalid token" });
    const user = await User.findById(userId).select("-password").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      xp: user.xp ?? 0,
      streak: user.streak ?? 0,
    });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "Request failed" });
  }
});

// ── Credits endpoint: returns user's remaining parse credits ────────────
app.get("/api/credits", async (req, res) => {
  try {
    await connectDB();
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const userId = await verifyToken(token);
    if (!userId) return res.status(401).json({ error: "Invalid token" });
    const usage = await Usage.getOrCreate(userId);
    const total = usage.includedCredits + usage.bonusCredits;
    const remaining = Math.max(0, total - usage.usedCredits);
    return res.status(200).json({
      total,
      used: usage.usedCredits,
      remaining,
      includedCredits: usage.includedCredits,
      bonusCredits: usage.bonusCredits,
    });
  } catch (err) {
    console.error("Credits error:", err);
    return res.status(500).json({ error: "Request failed" });
  }
});

// Legacy history endpoint - redirects to bills router
app.get("/api/history", (req, res) => res.redirect(307, "/api/bills"));

app.use("/api/groups", groupsRouter);
app.use("/api/bills", billsRouter);
app.use("/api/receipts", receiptsRouter);
app.use("/api/splitwise", splitwiseRouter);
app.use("/api/admin", adminRouter);

// Export for Vercel serverless; listen when run directly (npm run dev:api)
export default app;

if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
  });
}
