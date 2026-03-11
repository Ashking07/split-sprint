import { Router } from "express";
import { authMiddleware } from "../lib/auth.js";
import { parseReceiptRequestSchema, parseReceiptResponseSchema } from "../schemas/receipts.js";
import { parseReceiptFromImage, parseReceiptFromText } from "../lib/openaiReceiptParser.js";
import { Usage } from "../models/Usage.js";
import { checkRateLimit, getClientIp } from "../lib/rateLimiter.js";

const router = Router();

router.use(authMiddleware);

// ── Base64 / payload validation helpers ──────────────────────────────────────
const VALID_MIME_PREFIXES = ["data:image/jpeg", "data:image/png", "data:image/webp", "data:image/heic"];
const BASE64_CHARSET = /^[A-Za-z0-9+/=]+$/;
const MAX_DECODED_BYTES = 5 * 1024 * 1024; // 5 MB

function validateBase64Payload(imageBase64) {
  if (!imageBase64) return null; // not an image request

  // Check MIME prefix
  const hasDataUrl = imageBase64.startsWith("data:");
  if (hasDataUrl) {
    const validMime = VALID_MIME_PREFIXES.some((p) => imageBase64.startsWith(p));
    if (!validMime) {
      return "Unsupported image type. Use JPEG, PNG, or WebP.";
    }
  }

  // Extract raw base64 portion
  const raw = hasDataUrl ? imageBase64.split(",")[1] || "" : imageBase64;

  // Validate charset (fast reject garbage)
  if (!BASE64_CHARSET.test(raw.slice(0, 1000))) {
    return "Invalid image data.";
  }

  // Estimate decoded size: base64 encodes 3 bytes in 4 chars
  const estimatedBytes = Math.ceil((raw.length * 3) / 4);
  if (estimatedBytes > MAX_DECODED_BYTES) {
    return `Image too large (~${(estimatedBytes / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.`;
  }

  return null;
}

// Max concurrent parse jobs per user
const MAX_CONCURRENT_PARSES = 2;

router.post("/parse", async (req, res) => {
  // ── Per-IP rate limit: 15 per 10 min ────────────────────────────────────
  const ipKey = `parse:ip:${getClientIp(req)}`;
  const ipCheck = checkRateLimit(ipKey, 15, 10 * 60 * 1000);
  if (!ipCheck.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(ipCheck.retryAfterMs / 1000)));
    return res.status(429).json({ error: "Too many requests from this IP. Please try again later." });
  }

  // ── Per-user rate limit: 10 per 10 min ──────────────────────────────────
  const userKey = `parse:user:${req.userId}`;
  const userCheck = checkRateLimit(userKey, 10, 10 * 60 * 1000);
  if (!userCheck.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(userCheck.retryAfterMs / 1000)));
    return res.status(429).json({ error: "You're parsing too quickly. Please wait a moment." });
  }

  try {
    // ── Schema validation ─────────────────────────────────────────────────
    const parsed = parseReceiptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten()?.fieldErrors || parsed.error.message,
      });
    }

    const { imageBase64, pastedText, currencyHint } = parsed.data;

    // ── Base64 guardrails (fast reject before touching DB or OpenAI) ──────
    const base64Error = validateBase64Payload(imageBase64);
    if (base64Error) {
      return res.status(400).json({ error: base64Error });
    }

    // ── Atomic credit check + concurrency lock ────────────────────────────
    const slot = await Usage.acquireParseSlot(req.userId, MAX_CONCURRENT_PARSES);
    if (!slot) {
      // Distinguish: out of credits vs concurrency cap
      const usage = await Usage.getOrCreate(req.userId);
      const remaining = usage.includedCredits + usage.bonusCredits - usage.usedCredits;
      if (remaining <= 0) {
        return res.status(403).json({
          error: "You've used all your parse credits. Contact the admin for more.",
          code: "CREDITS_EXHAUSTED",
          creditsRemaining: 0,
        });
      }
      return res.status(429).json({
        error: "Another parse is already in progress. Please wait a moment.",
        code: "PARSE_IN_PROGRESS",
      });
    }

    // ── Call OpenAI ───────────────────────────────────────────────────────
    let result;
    try {
      if (imageBase64) {
        result = await parseReceiptFromImage(imageBase64, currencyHint);
      } else {
        result = await parseReceiptFromText(pastedText, currencyHint);
      }
    } catch (parseErr) {
      // Release slot — credit is consumed (attempt was made)
      await Usage.releaseParseSlot(req.userId);
      throw parseErr;
    }

    // Release concurrency slot (credit stays consumed)
    await Usage.releaseParseSlot(req.userId);

    const validated = parseReceiptResponseSchema.safeParse(result);
    if (!validated.success) {
      return res.status(500).json({
        error: "Parse result validation failed",
        details: validated.error.flatten(),
      });
    }

    // Include remaining credits in response for frontend display
    const updatedUsage = await Usage.getOrCreate(req.userId);
    const creditsRemaining = Math.max(
      0,
      updatedUsage.includedCredits + updatedUsage.bonusCredits - updatedUsage.usedCredits
    );

    return res.status(200).json({
      ...validated.data,
      creditsRemaining,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Receipt parse error:", err.message);
    } else {
      console.error("Receipt parse error");
    }

    // Map error kinds to user-friendly messages
    let userMessage = "Failed to parse receipt. Please try again.";
    let statusCode = 500;
    if (err.kind === "timeout") {
      userMessage = "The image took too long to process. Try a clearer, smaller photo.";
      statusCode = 504;
    } else if (err.kind === "rate_limit") {
      userMessage = "AI service is busy. Please wait a moment and try again.";
      statusCode = 429;
    } else if (err.kind === "upstream") {
      userMessage = "AI service is temporarily unavailable. Please try again in a moment.";
      statusCode = 502;
    } else if (err.message?.includes("No response")) {
      userMessage = "Could not read the receipt. Try a clearer photo with better lighting.";
    }

    return res.status(statusCode).json({
      error: userMessage,
    });
  }
});

export default router;
