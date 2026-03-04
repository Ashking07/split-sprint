import mongoose from "mongoose";

const splitwiseOAuthStateSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    origin: { type: String, required: true },
    returnTo: { type: String, default: "integrations" },
    oauthRedirectUri: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// TTL index: expire docs after 10 minutes
splitwiseOAuthStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

export const SplitwiseOAuthState =
  mongoose.models.SplitwiseOAuthState ||
  mongoose.model("SplitwiseOAuthState", splitwiseOAuthStateSchema);
