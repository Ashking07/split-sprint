import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { User } from "../models/User.js";
import { Usage } from "../models/Usage.js";
import { verifyToken } from "../lib/auth.js";
import { getLatencySnapshot } from "../lib/latencyMetrics.js";

const router = Router();

// ── Admin access control ────────────────────────────────────────────────────
// Comma-separated list of admin emails in env. Falls back to empty (no admins).
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

async function adminGuard(req, res, next) {
  await connectDB();
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const userId = await verifyToken(token);
  if (!userId) return res.status(401).json({ error: "Invalid token" });

  const user = await User.findById(userId).select("email").lean();
  if (!user || !ADMIN_EMAILS.has(user.email?.toLowerCase())) {
    return res.status(403).json({ error: "Forbidden" });
  }

  req.userId = userId;
  req.adminEmail = user.email;
  next();
}

// Serve the admin UI shell without auth headers; API actions below remain protected.
router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(ADMIN_HTML);
});

router.use(adminGuard);

// ── Latency metrics (protected) ───────────────────────────────────────────
router.get("/metrics/latency", async (req, res) => {
  try {
    const top = Math.min(50, Math.max(1, Number(req.query.top) || 15));
    const windowMinutes = Math.min(60, Math.max(1, Number(req.query.windowMinutes) || 15));
    const snapshot = getLatencySnapshot({ top, windowMs: windowMinutes * 60 * 1000 });
    return res.json(snapshot);
  } catch (err) {
    console.error("Admin latency metrics error:", err);
    return res.status(500).json({ error: err.message || "Failed to load latency metrics" });
  }
});

// ── Search user by email ────────────────────────────────────────────────────
router.get("/users/search", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email query param required" });

    const user = await User.findOne({ email }).select("_id email name").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const usage = await Usage.getOrCreate(user._id);
    const total = usage.includedCredits + usage.bonusCredits;
    const remaining = Math.max(0, total - usage.usedCredits);

    return res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      credits: {
        included: usage.includedCredits,
        bonus: usage.bonusCredits,
        used: usage.usedCredits,
        remaining,
        total,
      },
      grants: usage.grants || [],
    });
  } catch (err) {
    console.error("Admin search error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Grant credits ───────────────────────────────────────────────────────────
router.post("/users/:userId/grant-credits", async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body || {};
    const credits = Number(amount);
    if (!credits || credits < 1 || credits > 100) {
      return res.status(400).json({ error: "amount must be between 1 and 100" });
    }

    // Verify target user exists
    const user = await User.findById(userId).select("email name").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const usage = await Usage.grantCredits(userId, credits, req.adminEmail, reason || "");
    const total = usage.includedCredits + usage.bonusCredits;
    const remaining = Math.max(0, total - usage.usedCredits);

    return res.json({
      success: true,
      userId,
      email: user.email,
      granted: credits,
      credits: {
        included: usage.includedCredits,
        bonus: usage.bonusCredits,
        used: usage.usedCredits,
        remaining,
        total,
      },
      grants: usage.grants || [],
    });
  } catch (err) {
    console.error("Admin grant error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── List all users with usage (lightweight) ─────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("_id email name createdAt").sort({ createdAt: -1 }).lean();
    const usages = await Usage.find().lean();
    const usageMap = new Map(usages.map((u) => [u.userId.toString(), u]));

    const result = users.map((u) => {
      const usage = usageMap.get(u._id.toString());
      const included = usage?.includedCredits ?? 5;
      const bonus = usage?.bonusCredits ?? 0;
      const used = usage?.usedCredits ?? 0;
      return {
        id: u._id.toString(),
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        credits: { included, bonus, used, remaining: Math.max(0, included + bonus - used) },
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("Admin list users error:", err);
    return res.status(500).json({ error: err.message });
  }
});

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SplitSprint Admin</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #1a1a2e; padding: 24px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 20px; }
  h2 { font-size: 16px; margin: 20px 0 10px; color: #374151; }
  .card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: #6b7280; }
  input, select { width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
  button { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .btn-primary { background: #7c3aed; color: white; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-success { background: #059669; color: white; }
  .stat { display: inline-block; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-right: 8px; margin-bottom: 8px; }
  .stat-purple { background: #ede9fe; color: #7c3aed; }
  .stat-green { background: #d1fae5; color: #059669; }
  .stat-gray { background: #f3f4f6; color: #6b7280; }
  .stat-red { background: #fee2e2; color: #dc2626; }
  .grant-row { display: flex; gap: 8px; align-items: flex-end; }
  .grant-row input { margin-bottom: 0; }
  .grant-row button { white-space: nowrap; }
  .log { font-size: 12px; color: #6b7280; margin-top: 8px; }
  .log div { padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
  .msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
  .msg-error { background: #fee2e2; color: #dc2626; }
  .msg-success { background: #d1fae5; color: #059669; }
  .token-input { margin-bottom: 16px; }
  #userResult { display: none; }
  .metrics-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-bottom: 10px; }
  .metrics-stat { border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 10px; padding: 8px 10px; }
  .metrics-label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
  .metrics-value { font-size: 14px; font-weight: 700; color: #111827; }
  .table-wrap { overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 10px; }
  table { width: 100%; border-collapse: collapse; min-width: 560px; }
  th, td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #f3f4f6; text-align: left; }
  th { background: #f9fafb; color: #6b7280; font-weight: 700; }
  td { color: #374151; }
  .toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
  .toolbar input { margin-bottom: 0; width: 90px; }
</style>
</head>
<body>
<h1>SplitSprint Admin</h1>

<div class="card token-input">
  <label>Your Auth Token (Bearer)</label>
  <input type="password" id="tokenInput" placeholder="Paste your JWT token here">
  <p style="font-size:11px;color:#9ca3af;">Copy from localStorage key "splitsprint-token" in your browser.</p>
</div>

<div class="card">
  <h2>Latency Dashboard</h2>
  <div class="toolbar">
    <label style="margin:0;">Window (min)</label>
    <input type="number" id="metricsWindow" min="1" max="60" value="15">
    <button class="btn-primary" onclick="refreshLatency()">Refresh</button>
  </div>
  <div id="metricsMsg"></div>
  <div class="metrics-grid" id="metricsSummary"></div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Route</th>
          <th>Count</th>
          <th>Err %</th>
          <th>P50</th>
          <th>P95</th>
          <th>P99</th>
          <th>Max</th>
        </tr>
      </thead>
      <tbody id="metricsRows">
        <tr><td colspan="7" style="text-align:center;color:#9ca3af;">Enter token and click Refresh</td></tr>
      </tbody>
    </table>
  </div>
</div>

<div class="card">
  <h2>Search User</h2>
  <label>User Email</label>
  <input type="email" id="emailInput" placeholder="user@example.com">
  <button class="btn-primary" id="searchBtn" onclick="searchUser()">Search</button>
  <div id="searchMsg"></div>
</div>

<div class="card" id="userResult">
  <h2 id="userName"></h2>
  <p style="font-size:13px;color:#6b7280;margin-bottom:12px;" id="userEmail"></p>
  <div id="creditStats"></div>

  <h2>Grant Credits</h2>
  <div class="grant-row">
    <div style="flex:1;">
      <label>Amount</label>
      <input type="number" id="grantAmount" value="15" min="1" max="100">
    </div>
    <div style="flex:2;">
      <label>Reason (optional)</label>
      <input type="text" id="grantReason" placeholder="e.g. Beta tester reward">
    </div>
    <button class="btn-success" onclick="grantCredits()">Grant</button>
  </div>
  <div id="grantMsg"></div>

  <h2>Grant History</h2>
  <div class="log" id="grantLog"></div>
</div>

<script>
const BASE = location.origin;
function token() { return document.getElementById('tokenInput').value.trim(); }
function headers() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }; }
let currentUserId = null;

async function searchUser() {
  const email = document.getElementById('emailInput').value.trim();
  const msgEl = document.getElementById('searchMsg');
  if (!email) { msgEl.innerHTML = '<div class="msg msg-error">Enter an email</div>'; return; }
  if (!token()) { msgEl.innerHTML = '<div class="msg msg-error">Enter your auth token first</div>'; return; }
  msgEl.innerHTML = '';
  try {
    const res = await fetch(BASE + '/api/admin/users/search?email=' + encodeURIComponent(email), { headers: headers() });
    const data = await res.json();
    if (!res.ok) { msgEl.innerHTML = '<div class="msg msg-error">' + (data.error || 'Error') + '</div>'; document.getElementById('userResult').style.display='none'; return; }
    currentUserId = data.id;
    document.getElementById('userResult').style.display = 'block';
    document.getElementById('userName').textContent = data.name || '(no name)';
    document.getElementById('userEmail').textContent = data.email;
    renderCredits(data.credits);
    renderGrants(data.grants);
    msgEl.innerHTML = '';
  } catch (e) { msgEl.innerHTML = '<div class="msg msg-error">' + e.message + '</div>'; }
}

function renderCredits(c) {
  document.getElementById('creditStats').innerHTML =
    '<span class="stat stat-green">Remaining: ' + c.remaining + '</span>' +
    '<span class="stat stat-purple">Total: ' + c.total + '</span>' +
    '<span class="stat stat-gray">Used: ' + c.used + '</span>' +
    '<span class="stat stat-gray">Included: ' + c.included + '</span>' +
    '<span class="stat stat-purple">Bonus: ' + c.bonus + '</span>';
}

function renderGrants(grants) {
  const el = document.getElementById('grantLog');
  if (!grants || !grants.length) { el.innerHTML = '<div>No grants yet</div>'; return; }
  el.innerHTML = grants.slice().reverse().map(g =>
    '<div>+' + g.amount + ' by ' + g.grantedBy + (g.reason ? ' — ' + g.reason : '') + ' <span style="color:#9ca3af">' + new Date(g.grantedAt).toLocaleDateString() + '</span></div>'
  ).join('');
}

async function grantCredits() {
  if (!currentUserId) return;
  const amount = parseInt(document.getElementById('grantAmount').value, 10);
  const reason = document.getElementById('grantReason').value.trim();
  const msgEl = document.getElementById('grantMsg');
  try {
    const res = await fetch(BASE + '/api/admin/users/' + currentUserId + '/grant-credits', {
      method: 'POST', headers: headers(), body: JSON.stringify({ amount, reason })
    });
    const data = await res.json();
    if (!res.ok) { msgEl.innerHTML = '<div class="msg msg-error">' + (data.error || 'Error') + '</div>'; return; }
    msgEl.innerHTML = '<div class="msg msg-success">Granted +' + amount + ' credits!</div>';
    renderCredits(data.credits);
    renderGrants(data.grants);
  } catch (e) { msgEl.innerHTML = '<div class="msg msg-error">' + e.message + '</div>'; }
}

function renderLatencySummary(s) {
  const el = document.getElementById('metricsSummary');
  el.innerHTML =
    '<div class="metrics-stat"><div class="metrics-label">Requests</div><div class="metrics-value">' + s.totalRequests + '</div></div>' +
    '<div class="metrics-stat"><div class="metrics-label">Error Rate</div><div class="metrics-value">' + s.errorRate + '%</div></div>' +
    '<div class="metrics-stat"><div class="metrics-label">P50</div><div class="metrics-value">' + s.p50 + ' ms</div></div>' +
    '<div class="metrics-stat"><div class="metrics-label">P95</div><div class="metrics-value">' + s.p95 + ' ms</div></div>' +
    '<div class="metrics-stat"><div class="metrics-label">P99</div><div class="metrics-value">' + s.p99 + ' ms</div></div>' +
    '<div class="metrics-stat"><div class="metrics-label">Slow >1s</div><div class="metrics-value">' + s.slowOver1s + '</div></div>';
}

function renderLatencyRows(routes) {
  const el = document.getElementById('metricsRows');
  if (!routes || !routes.length) {
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;">No traffic in selected window</td></tr>';
    return;
  }
  el.innerHTML = routes.map(r =>
    '<tr>' +
      '<td>' + r.method + ' ' + r.path + '</td>' +
      '<td>' + r.count + '</td>' +
      '<td>' + r.errorRate + '%</td>' +
      '<td>' + r.p50 + ' ms</td>' +
      '<td>' + r.p95 + ' ms</td>' +
      '<td>' + r.p99 + ' ms</td>' +
      '<td>' + r.max + ' ms</td>' +
    '</tr>'
  ).join('');
}

async function refreshLatency() {
  const msgEl = document.getElementById('metricsMsg');
  const windowMinutes = parseInt(document.getElementById('metricsWindow').value || '15', 10);
  if (!token()) {
    msgEl.innerHTML = '<div class="msg msg-error">Enter your auth token first</div>';
    return;
  }
  msgEl.innerHTML = '';
  try {
    const res = await fetch(BASE + '/api/admin/metrics/latency?top=20&windowMinutes=' + encodeURIComponent(windowMinutes), {
      headers: headers()
    });
    const data = await res.json();
    if (!res.ok) {
      msgEl.innerHTML = '<div class="msg msg-error">' + (data.error || 'Failed to load metrics') + '</div>';
      return;
    }
    renderLatencySummary(data.summary || { totalRequests: 0, errorRate: 0, p50: 0, p95: 0, p99: 0, slowOver1s: 0 });
    renderLatencyRows(data.routes || []);
  } catch (e) {
    msgEl.innerHTML = '<div class="msg msg-error">' + e.message + '</div>';
  }
}
</script>
</body>
</html>`;

export default router;
