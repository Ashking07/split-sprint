import { Router } from "express";
import { authMiddleware } from "../lib/auth.js";
import { parseReceiptRequestSchema, parseReceiptResponseSchema } from "../schemas/receipts.js";
import { parseReceiptFromImage, parseReceiptFromText } from "../lib/openaiReceiptParser.js";

const router = Router();

router.use(authMiddleware);

router.post("/parse", async (req, res) => {
  try {
    const parsed = parseReceiptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten()?.fieldErrors || parsed.error.message,
      });
    }

    const { imageBase64, pastedText, currencyHint } = parsed.data;

    let result;
    if (imageBase64) {
      result = await parseReceiptFromImage(imageBase64, currencyHint);
    } else {
      result = await parseReceiptFromText(pastedText, currencyHint);
    }

    const validated = parseReceiptResponseSchema.safeParse(result);
    if (!validated.success) {
      return res.status(500).json({
        error: "Parse result validation failed",
        details: validated.error.flatten(),
      });
    }

    return res.status(200).json(validated.data);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Receipt parse error:", err.message);
    } else {
      console.error("Receipt parse error");
    }
    return res.status(500).json({
      error: err.message || "Failed to parse receipt",
    });
  }
});

export default router;
