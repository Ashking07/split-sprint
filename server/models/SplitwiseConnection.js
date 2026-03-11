import mongoose from "mongoose";

const splitwiseConnectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    splitwiseAccessToken: { type: String, required: true },
    splitwiseTokenType: { type: String, default: "Bearer" },
    splitwiseRefreshToken: { type: String },
    splitwiseExpiresAt: { type: Date },
    splitwiseAccountId: { type: Number },
    splitwiseEmail: { type: String },
    splitwiseFirstName: { type: String },
    splitwiseLastName: { type: String },
    splitwiseConnectedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

// Token lookups filter by userId + revokedAt (the unique:true on userId alone
// already gives a single-field index, but this compound index covers the
// common { userId, revokedAt: null } query without a collection scan).
splitwiseConnectionSchema.index({ userId: 1, revokedAt: 1 });

export const SplitwiseConnection =
  mongoose.models.SplitwiseConnection ||
  mongoose.model("SplitwiseConnection", splitwiseConnectionSchema);
