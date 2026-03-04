import mongoose from "mongoose";

const splitwiseMemberSchema = new mongoose.Schema(
  { id: Number, email: String, first_name: String, last_name: String },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    splitwiseGroupId: { type: Number },
    /** When set, group uses Splitwise members directly (no Splitsprint users required) */
    splitwiseMembers: [splitwiseMemberSchema],
  },
  { timestamps: true }
);

export const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);
