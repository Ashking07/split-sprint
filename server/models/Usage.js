import mongoose from "mongoose";

const creditGrantSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    grantedBy: { type: String, required: true }, // admin email
    reason: { type: String, default: "" },
    grantedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const usageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    /** Free credits every user starts with */
    includedCredits: { type: Number, default: 5 },
    /** Credits granted by admin */
    bonusCredits: { type: Number, default: 0 },
    /** Total parse attempts consumed */
    usedCredits: { type: Number, default: 0 },
    /** Number of parse jobs currently in-flight (concurrency cap) */
    activeParses: { type: Number, default: 0 },
    /** When the last parse slot was acquired (for stale-slot detection) */
    lastParseStartedAt: { type: Date, default: null },
    /** Audit trail of admin grants */
    grants: [creditGrantSchema],
  },
  { timestamps: true }
);

usageSchema.index({ userId: 1 }, { unique: true });

/**
 * Get or create usage record for a user.
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @returns {Promise<import("mongoose").Document>}
 */
usageSchema.statics.getOrCreate = async function (userId) {
  let doc = await this.findOne({ userId });
  if (!doc) {
    doc = await this.create({ userId });
  }
  return doc;
};

/**
 * Atomically consume one credit IF available and under concurrency cap.
 * Returns the updated doc or null if denied.
 * @param {string} userId
 * @param {number} maxConcurrent - max simultaneous parses (default 2)
 */
usageSchema.statics.acquireParseSlot = async function (userId, maxConcurrent = 2) {
  // Ensure the record exists first
  await this.getOrCreate(userId);

  // Auto-clear stale parse slots (stuck for >60s = crashed/timed-out request)
  const STALE_THRESHOLD_MS = 60_000;
  await this.updateOne(
    {
      userId,
      activeParses: { $gt: 0 },
      lastParseStartedAt: { $lt: new Date(Date.now() - STALE_THRESHOLD_MS) },
    },
    { $set: { activeParses: 0 } }
  );

  const result = await this.findOneAndUpdate(
    {
      userId,
      activeParses: { $lt: maxConcurrent },
      $expr: { $lt: ["$usedCredits", { $add: ["$includedCredits", "$bonusCredits"] }] },
    },
    {
      $inc: { usedCredits: 1, activeParses: 1 },
      $set: { lastParseStartedAt: new Date() },
    },
    { new: true }
  );
  return result;
};

/**
 * Release a parse slot after completion (success or failure).
 * @param {string} userId
 */
usageSchema.statics.releaseParseSlot = async function (userId) {
  await this.findOneAndUpdate(
    { userId, activeParses: { $gt: 0 } },
    { $inc: { activeParses: -1 } }
  );
};

/**
 * Roll back one credit (e.g. if parse failed before reaching OpenAI).
 * Also releases the parse slot.
 * @param {string} userId
 */
usageSchema.statics.rollbackCredit = async function (userId) {
  await this.findOneAndUpdate(
    { userId, usedCredits: { $gt: 0 }, activeParses: { $gt: 0 } },
    { $inc: { usedCredits: -1, activeParses: -1 } }
  );
};

/**
 * Admin: grant bonus credits to a user.
 * @param {string} userId
 * @param {number} amount
 * @param {string} adminEmail
 * @param {string} [reason]
 */
usageSchema.statics.grantCredits = async function (userId, amount, adminEmail, reason = "") {
  return this.findOneAndUpdate(
    { userId },
    {
      $inc: { bonusCredits: amount },
      $push: {
        grants: {
          amount,
          grantedBy: adminEmail,
          reason,
          grantedAt: new Date(),
        },
      },
    },
    { new: true, upsert: true }
  );
};

export const Usage = mongoose.models.Usage || mongoose.model("Usage", usageSchema);
