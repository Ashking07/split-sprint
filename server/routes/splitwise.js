import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";
import { authMiddleware } from "../lib/auth.js";
import { SplitwiseConnection } from "../models/SplitwiseConnection.js";
import { SplitwiseOAuthState } from "../models/SplitwiseOAuthState.js";
import { Group } from "../models/Group.js";
import { Bill } from "../models/Bill.js";
import { User } from "../models/User.js";
import { splitwiseFetch, getSplitwiseToken } from "../lib/splitwiseClient.js";
import { computeSettlementSnapshot } from "../lib/settlement.js";

const router = Router();

const SPLITWISE_AUTH_URL = "https://secure.splitwise.com/oauth/authorize";
const SPLITWISE_TOKEN_URL = "https://secure.splitwise.com/oauth/token";
const SCOPES = process.env.SPLITWISE_SCOPES || "";

const ALLOWED_ORIGINS_RAW = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set(ALLOWED_ORIGINS_RAW);

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (ALLOWED_ORIGINS.has("http://*:5173") && /^https?:\/\/[^/]+:5173\/?$/.test(origin)) return true;
  if (ALLOWED_ORIGINS.has("http://*:5174") && /^https?:\/\/[^/]+:5174\/?$/.test(origin)) return true;
  return false;
}

function getRequestOrigin(req) {
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  const proto = req.get("x-forwarded-proto") || "http";
  if (!host) return getAppOrigin();
  const origin = `${proto}://${host}`.replace(/\/$/, "");
  return origin;
}

async function getUserIdForConnect(req) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const { verifyToken } = await import("../lib/auth.js");
    return verifyToken(token);
  }
  const urlToken = req.query.token;
  if (urlToken) {
    const { verifyToken } = await import("../lib/auth.js");
    return verifyToken(urlToken);
  }
  return null;
}

router.get("/connect", async (req, res) => {
  const userId = await getUserIdForConnect(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized. Log in and try again." });
  }
  const clientId = process.env.SPLITWISE_CLIENT_ID;
  const redirectUri = process.env.SPLITWISE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Splitwise integration not configured" });
  }
  const returnTo = req.query?.returnTo || "integrations";
  let origin = (req.query?.origin || process.env.APP_ORIGIN || "http://localhost:5173").replace(/\/$/, "");

  // Use APP_ORIGIN when client origin isn't in allowlist (preview URLs, PWA, etc.)
  const appOrigin = process.env.APP_ORIGIN?.replace(/\/$/, "");
  if (!isOriginAllowed(origin) && appOrigin) {
    origin = appOrigin;
  }
  if (!isOriginAllowed(origin) && origin !== appOrigin) {
    return res.status(400).json({
      error: "Bad origin. Set ALLOWED_ORIGINS and APP_ORIGIN in Vercel to your app URL (e.g. https://split-sprint.vercel.app)",
    });
  }

  const state = crypto.randomBytes(32).toString("hex");
  // Use SPLITWISE_REDIRECT_URI in production (https) so we match the exact URL in Splitwise
  const oauthRedirectUri =
    redirectUri && redirectUri.startsWith("https://")
      ? redirectUri.replace(/\/$/, "")
      : `${origin.replace(/\/$/, "")}/api/splitwise/callback`;

  await connectDB();
  await SplitwiseOAuthState.create({ state, userId: String(userId), origin, returnTo, oauthRedirectUri });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthRedirectUri,
    response_type: "code",
    state,
    ...(SCOPES && { scope: SCOPES }),
  });
  res.redirect(`${SPLITWISE_AUTH_URL}?${params.toString()}`);
});

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const clientId = process.env.SPLITWISE_CLIENT_ID;
  const clientSecret = process.env.SPLITWISE_CLIENT_SECRET;
  const requestOrigin = getRequestOrigin(req);

  if (!code || !state) {
    return res.redirect(`${requestOrigin}/?splitwise=error&message=missing_params`);
  }

  await connectDB();
  const stateDoc = await SplitwiseOAuthState.findOneAndDelete({ state });
  if (!stateDoc) {
    return res.redirect(`${requestOrigin}/?splitwise=error&message=invalid_state`);
  }

  const { userId: storedUserId, origin, returnTo, oauthRedirectUri } = stateDoc;
  const redirectUri = oauthRedirectUri || process.env.SPLITWISE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(`${requestOrigin}/?splitwise=error&message=not_configured`);
  }

  try {
    const tokenRes = await fetch(SPLITWISE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      const err = tokenData?.error_description || tokenData?.error || "Token exchange failed";
      return res.redirect(`${requestOrigin}/?splitwise=error&message=${encodeURIComponent(err)}`);
    }

    const accessToken = tokenData.access_token;
    const tokenType = (tokenData.token_type || "Bearer").trim();
    if (!accessToken) {
      console.error("[Splitwise] Token response missing access_token:", Object.keys(tokenData));
      return res.redirect(`${requestOrigin}/?splitwise=error&message=invalid_token_response`);
    }
    console.log("[Splitwise] Token received, type:", tokenType, "len:", String(accessToken).length);
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    const apiBase = process.env.SPLITWISE_BASE_URL || "https://secure.splitwise.com/api/v3.0";
    const userRes = await fetch(`${apiBase}/get_current_user`, {
      headers: { Authorization: `${tokenType} ${accessToken}` },
    });
    const userData = await userRes.json();
    const swUser = userData?.user;

    const finalReturnTo = returnTo || "integrations";
    const finalOrigin = origin || requestOrigin;
    const redirectUrl = isOriginAllowed(finalOrigin)
      ? `${finalOrigin}/oauth/splitwise?returnTo=${encodeURIComponent(finalReturnTo)}`
      : `${requestOrigin}/oauth/splitwise?returnTo=${encodeURIComponent(finalReturnTo)}`;

    const userIdObj = new mongoose.Types.ObjectId(storedUserId);
    await SplitwiseConnection.findOneAndUpdate(
      { userId: userIdObj },
      {
        userId: userIdObj,
        splitwiseAccessToken: accessToken,
        splitwiseTokenType: tokenType,
        splitwiseRefreshToken: refreshToken || undefined,
        splitwiseExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
        splitwiseAccountId: swUser?.id,
        splitwiseEmail: swUser?.email,
        splitwiseFirstName: swUser?.first_name,
        splitwiseLastName: swUser?.last_name,
        splitwiseConnectedAt: new Date(),
        revokedAt: null,
      },
      { upsert: true, new: true }
    );
    console.log("[Splitwise] Saved connection for userId:", storedUserId);

    const groupsTest = await fetch(`${apiBase}/get_groups`, {
      headers: { Authorization: `${tokenType} ${accessToken}` },
    });
    console.log("[Splitwise] get_groups test right after save:", groupsTest.status, groupsTest.statusText);

    // Use meta refresh only (no inline script - avoids CSP blocking)
    const safeUrl = redirectUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${safeUrl}"></head><body><p>Redirecting to Splitsprint... <a href="${safeUrl}">Click here if not redirected</a></p></body></html>`
    );
  } catch (err) {
    console.error("Splitwise callback error:", err);
    return res.redirect(`${getRequestOrigin(req)}/?splitwise=error&message=${encodeURIComponent(err.message)}`);
  }
});

router.post("/disconnect", authMiddleware, async (req, res) => {
  try {
    await connectDB();
    await SplitwiseConnection.findOneAndUpdate(
      { userId: req.userId },
      { revokedAt: new Date() }
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Splitwise disconnect error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/debug", authMiddleware, async (req, res) => {
  try {
    await connectDB();
    const userId = mongoose.Types.ObjectId.isValid(req.userId)
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;
    const conn = await SplitwiseConnection.findOne({ userId }).lean();
    return res.json({
      userId: req.userId,
      hasConnection: !!conn,
      connection: conn
        ? {
            splitwiseEmail: conn.splitwiseEmail,
            splitwiseConnectedAt: conn.splitwiseConnectedAt,
            revokedAt: conn.revokedAt,
          }
        : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/status", authMiddleware, async (req, res) => {
  try {
    await connectDB();
    const userId = mongoose.Types.ObjectId.isValid(req.userId)
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;
    const conn = await SplitwiseConnection.findOne({
      userId,
      $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }],
    }).lean();
    if (!conn) {
      return res.status(200).json({ connected: false });
    }
    return res.status(200).json({
      connected: true,
      email: conn.splitwiseEmail,
      firstName: conn.splitwiseFirstName,
      lastName: conn.splitwiseLastName,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/groups/create", authMiddleware, async (req, res) => {
  const { groupId, additionalMembers } = req.body || {};
  if (!groupId) {
    return res.status(400).json({ error: "groupId required" });
  }

  try {
    await connectDB();
    const conn = await getSplitwiseToken(req.userId);
    if (!conn) {
      return res.status(401).json({ error: "Splitwise not connected. Connect your account first." });
    }

    const group = await Group.findOne({ _id: groupId, ownerId: req.userId }).lean();
    if (!group) return res.status(404).json({ error: "Group not found" });

    const seenEmails = new Set();
    const usersFlat = {};
    let idx = 0;

    const memberIds = [
      group.ownerId?.toString?.(),
      ...(group.memberIds || []).map((m) => m?.toString?.()),
    ].filter(Boolean);
    const users = await User.find({ _id: { $in: memberIds } })
      .select("_id email name")
      .lean();

    for (const u of users) {
      const email = u.email?.toLowerCase?.();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      const parts = (u.name || "").trim().split(/\s+/);
      const firstName = parts[0] || email.split("@")[0] || "?";
      const lastName = parts.slice(1).join(" ") || "";
      usersFlat[`users__${idx}__email`] = email;
      usersFlat[`users__${idx}__first_name`] = firstName;
      usersFlat[`users__${idx}__last_name`] = lastName;
      idx++;
    }

    for (const m of additionalMembers || []) {
      const email = m.email?.toLowerCase?.();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      if (m.id && typeof m.id === "number") {
        usersFlat[`users__${idx}__user_id`] = m.id;
      } else {
        usersFlat[`users__${idx}__email`] = email;
        usersFlat[`users__${idx}__first_name`] = m.first_name || email.split("@")[0] || "?";
        usersFlat[`users__${idx}__last_name`] = m.last_name || "";
      }
      idx++;
    }

    if (idx === 0) {
      return res.status(400).json({ error: "Group has no members with email. Add members first." });
    }

    const body = {
      name: group.name,
      group_type: "other",
      simplify_by_default: true,
      ...usersFlat,
    };

    const createRes = await splitwiseFetch(req.userId, "/create_group", {
      method: "POST",
      body,
    });

    const errors = createRes.errors || {};
    if (Object.keys(errors).length > 0) {
      const errMsg = errors.base?.[0] || errors.name?.[0] || JSON.stringify(errors);
      return res.status(400).json({ error: errMsg || "Splitwise create group failed" });
    }

    const swGroup = createRes.group;
    if (!swGroup?.id) {
      return res.status(500).json({ error: "Splitwise did not return group ID" });
    }

    const splitwiseMembers = (swGroup.members || []).map((m) => ({
      id: m.id,
      email: m.email,
      first_name: m.first_name,
      last_name: m.last_name,
    }));

    await Group.findByIdAndUpdate(groupId, {
      splitwiseGroupId: swGroup.id,
      splitwiseMembers,
    });

    return res.status(200).json({
      success: true,
      splitwiseGroupId: swGroup.id,
      splitwiseMembers,
    });
  } catch (err) {
    console.error("[Splitwise] create group error:", err.message);
    if (err.message?.includes("not connected") || err.message?.includes("connection expired")) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.get("/groups", authMiddleware, async (req, res) => {
  try {
    const data = await splitwiseFetch(req.userId, "/get_groups");
    const groups = (data.groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      members: (g.members || []).map((m) => ({
        id: m.id,
        email: m.email,
        first_name: m.first_name,
        last_name: m.last_name,
      })),
    }));
    return res.status(200).json(groups);
  } catch (err) {
    console.error("[Splitwise] groups error:", err.message);
    if (err.message?.includes("not connected") || err.message?.includes("connection expired")) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.post("/expenses/create", authMiddleware, async (req, res) => {
  const { billId, groupId: groupIdOverride } = req.body || {};
  if (!billId) {
    return res.status(400).json({ error: "billId required" });
  }

  try {
    await connectDB();
    const bill = await Bill.findOne({ _id: billId, ownerId: req.userId }).lean();
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const conn = await getSplitwiseToken(req.userId);
    if (!conn) {
      return res.status(401).json({ error: "Splitwise not connected. Connect your account first." });
    }

    const groupIdToUse = groupIdOverride || bill.groupId;
    if (!groupIdToUse) {
      return res.status(400).json({
        error: "No group selected for this bill. Go back and choose a group.",
      });
    }

    const group = await Group.findOne({
      _id: groupIdToUse,
      $or: [{ ownerId: req.userId }, { memberIds: req.userId }],
    }).lean();

    if (!group) {
      return res.status(400).json({
        error: "Group not found. It may have been deleted.",
      });
    }

    if (!group.splitwiseGroupId) {
      return res.status(400).json({
        error: "Group not linked to Splitwise. Select your group, then use the \"Link to Splitwise\" dropdown to link it before continuing.",
      });
    }

    const totalCents = (bill.items || []).reduce((s, it) => s + it.qty * it.unitPriceCents, 0) +
      (bill.taxCents || 0) + (bill.tipCents || 0);
    const cost = (totalCents / 100).toFixed(2);
    const currencyCode = bill.currency || "USD";
    const description = bill.merchant || "Receipt";

    let participantIds = [];
    let swUserIds = [];
    let swMembers = group.splitwiseMembers?.length ? group.splitwiseMembers : null;

    if (!swMembers?.length && group.splitwiseGroupId) {
      try {
        const swGroups = await splitwiseFetch(req.userId, "/get_groups");
        const swGroup = (swGroups.groups || []).find((g) => g.id === group.splitwiseGroupId);
        if (swGroup?.members?.length) {
          swMembers = swGroup.members.map((m) => ({
            id: m.id,
            email: m.email,
            first_name: m.first_name,
            last_name: m.last_name,
          }));
          await Group.findByIdAndUpdate(groupIdToUse, { splitwiseMembers: swMembers });
        }
      } catch (err) {
        console.warn("[Splitwise] Could not fetch group members:", err.message);
      }
    }

    if (swMembers?.length) {
      participantIds = swMembers.map((m) => `sw:${m.id}`);
      swUserIds = swMembers.map((m) => m.id);
    } else {
      participantIds = [group.ownerId?.toString?.(), ...(group.memberIds || []).map((m) => m?.toString?.())].filter(
        Boolean
      );
      if (participantIds.length === 0) participantIds = [req.userId];

      const swGroups = await splitwiseFetch(req.userId, "/get_groups");
      const swGroup = (swGroups.groups || []).find((g) => g.id === group.splitwiseGroupId);
      if (!swGroup) {
        return res.status(400).json({ error: "Splitwise group not found. Re-link the group." });
      }

      const swMembersFromApi = swGroup.members || [];
      const ourUsers = await User.find({ _id: { $in: participantIds } }).select("email").lean();
      const missingEmails = [];
      for (const ourId of participantIds) {
        const user = ourUsers.find((u) => u._id.toString() === ourId);
        const email = user?.email?.toLowerCase();
        const swMember = swMembersFromApi.find((m) => m.email?.toLowerCase() === email);
        if (!swMember) {
          if (email) missingEmails.push(email);
          else missingEmails.push(ourId);
        } else {
          swUserIds.push(swMember.id);
        }
      }

      if (missingEmails.length > 0) {
        return res.status(400).json({
          error: `These members are not in the Splitwise group: ${missingEmails.join(", ")}. Add them in Splitwise or remove from this bill.`,
          missingEmails,
        });
      }
    }

    const splitMode = bill.splitMode || "equal";
    const payerId = req.userId;
    let payerSwId = conn?.splitwiseAccountId;
    const useSplitwiseMembers = !!swMembers?.length;

    if (useSplitwiseMembers && !payerSwId && conn?.splitwiseEmail) {
      const payerMember = swMembers.find((m) => m.email?.toLowerCase() === conn.splitwiseEmail?.toLowerCase());
      if (payerMember) payerSwId = payerMember.id;
    }

    let body;
    {
      const { shares } = computeSettlementSnapshot(bill, participantIds, payerId);
      const usersFlat = {};
      let idx = 0;
      let paidShareAssigned = false;
      for (const pid of participantIds) {
        const share = shares.find((s) => s.participantId === pid);
        const amountCents = share?.amountCents ?? 0;
        const owedShare = (amountCents / 100).toFixed(2);
        const isPayer = useSplitwiseMembers
          ? payerSwId && pid === `sw:${payerSwId}`
          : pid === payerId;
        let paidShare = isPayer ? cost : "0.00";
        if (isPayer) paidShareAssigned = true;

        let swUserId;
        if (useSplitwiseMembers && pid.startsWith("sw:")) {
          swUserId = parseInt(pid.slice(3), 10);
        } else if (!useSplitwiseMembers) {
          const ourUsers = await User.find({ _id: { $in: participantIds } }).select("email").lean();
          const swGroupsRes = await splitwiseFetch(req.userId, "/get_groups");
          const swGroup = (swGroupsRes.groups || []).find((g) => g.id === group.splitwiseGroupId);
          const swMembersFromApi = swGroup?.members || [];
          const user = ourUsers.find((u) => u._id.toString() === pid);
          const swMember = user
            ? swMembersFromApi.find((m) => m.email?.toLowerCase() === user.email?.toLowerCase())
            : null;
          swUserId = swMember?.id;
        }

        if (swUserId) {
          usersFlat[`users__${idx}__user_id`] = swUserId;
          usersFlat[`users__${idx}__paid_share`] = paidShare;
          usersFlat[`users__${idx}__owed_share`] = owedShare;
          idx++;
        }
      }
      if (!paidShareAssigned && idx > 0) {
        usersFlat["users__0__paid_share"] = cost;
      }
      body = {
        cost,
        description,
        currency_code: currencyCode,
        group_id: group.splitwiseGroupId,
        split_equally: false,
        ...usersFlat,
      };
    }

    const createRes = await splitwiseFetch(req.userId, "/create_expense", {
      method: "POST",
      body,
    });

    const errors = createRes.errors || {};
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      const errMsg = errors.base?.[0] || errors.cost?.[0] || JSON.stringify(errors);
      return res.status(400).json({ error: errMsg || "Splitwise create expense failed" });
    }

    const expense = createRes.expenses?.[0];
    const expenseId = expense?.id;
    if (expenseId) {
      await Bill.findByIdAndUpdate(billId, {
        splitwiseExpenseId: expenseId,
        status: "sent",
      });
    }

    const expenseUrl = expenseId ? `https://www.splitwise.com/expenses/${expenseId}` : null;
    return res.status(200).json({
      success: true,
      expenseId,
      expenseUrl,
    });
  } catch (err) {
    console.error("Splitwise create expense error:", err);
    return res.status(500).json({ error: err.message });
  }
});

function getAppOrigin() {
  return process.env.APP_ORIGIN || "http://localhost:5173";
}

export default router;
