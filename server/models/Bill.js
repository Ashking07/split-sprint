import mongoose from "mongoose";

const billItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true },
    confidence: { type: Number, default: 1 },
    source: { type: String, enum: ["vision", "text", "manual"], default: "manual" },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: false },
    rawReceipt: {
      imageBase64: { type: String },
      pastedText: { type: String },
    },
    merchant: { type: String, default: "" },
    receiptDate: { type: String },
    currency: { type: String, default: "USD" },
    items: [billItemSchema],
    taxCents: { type: Number, default: 0 },
    tipCents: { type: Number, default: 0 },
    totalCents: { type: Number, default: 0 },
    splitMode: { type: String, enum: ["equal", "itemized"], default: "equal" },
    participantsByItem: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["draft", "sent"], default: "draft" },
    splitwiseExpenseId: { type: Number },
    settlementSnapshot: {
      shares: [{ participantId: String, amountCents: Number }],
      whoOwesPayer: [{ participantId: String, amountCents: Number }],
    },
  },
  { timestamps: true }
);

billSchema.index({ ownerId: 1, updatedAt: -1 });

export const Bill = mongoose.models.Bill || mongoose.model("Bill", billSchema);
