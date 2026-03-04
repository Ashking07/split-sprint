import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { authMiddleware } from "../lib/auth.js";
import { Bill } from "../models/Bill.js";
import { Group } from "../models/Group.js";
import { User } from "../models/User.js";
import { createBillSchema, updateBillSchema } from "../schemas/index.js";
import { computeSettlementSnapshot } from "../lib/settlement.js";

function computeTotalCents(items, taxCents, tipCents) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);
  return subtotal + (taxCents || 0) + (tipCents || 0);
}

const router = Router();

router.use(authMiddleware);

router.post("/", async (req, res) => {
  try {
    await connectDB();
    const parsed = createBillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const data = parsed.data;
    const totalCents = computeTotalCents(data.items, data.taxCents, data.tipCents);

    const bill = await Bill.create({
      ownerId: req.userId,
      groupId: data.groupId || null,
      merchant: data.merchant || "",
      currency: data.currency || "USD",
      receiptDate: data.receiptDate || null,
      rawReceipt: data.rawReceipt || {},
      items: data.items,
      taxCents: data.taxCents || 0,
      tipCents: data.tipCents || 0,
      totalCents,
      splitMode: data.splitMode || "equal",
      participantsByItem: data.participantsByItem || {},
      status: "draft",
    });

    return res.status(201).json(billToResponse(bill));
  } catch (err) {
    console.error("Create bill error:", err);
    return res.status(500).json({ error: err.message || "Failed to create bill" });
  }
});

router.get("/", async (req, res) => {
  try {
    await connectDB();
    // Use aggregation to avoid sort memory limit on Atlas M0 (allowDiskUse not supported)
    const mongoose = (await import("mongoose")).default;
    const pipeline = [
      { $match: { ownerId: new mongoose.Types.ObjectId(req.userId) } },
      { $sort: { updatedAt: -1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: "groups",
          localField: "groupId",
          foreignField: "_id",
          as: "groupIdDoc",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $addFields: {
          groupName: { $arrayElemAt: ["$groupIdDoc.name", 0] },
        },
      },
    ];
    const bills = await Bill.aggregate(pipeline).hint({ ownerId: 1, updatedAt: -1 });

    const history = bills.map((b) => ({
      id: b._id.toString(),
      title: b.merchant || (b.items?.[0]?.name || "Bill") + (b.items?.length > 1 ? ` +${b.items.length - 1} more` : ""),
      date: b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      total: (b.totalCents || 0) / 100,
      group: b.groupName || "Unknown",
      status: b.status || "draft",
      emoji: "🧾",
    }));

    return res.status(200).json(history);
  } catch (err) {
    console.error("List bills error:", err);
    return res.status(500).json({ error: err.message || "Failed to list bills" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    await connectDB();
    const bill = await Bill.findOne({ _id: req.params.id, ownerId: req.userId })
      .populate("groupId", "name memberIds")
      .lean();
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    return res.status(200).json(billToResponse(bill));
  } catch (err) {
    console.error("Get bill error:", err);
    return res.status(500).json({ error: err.message || "Request failed" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    await connectDB();
    const bill = await Bill.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const parsed = updateBillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    if (data.merchant !== undefined) bill.merchant = data.merchant;
    if (data.groupId !== undefined) bill.groupId = data.groupId || null;
    if (data.currency !== undefined) bill.currency = data.currency;
    if (data.receiptDate !== undefined) bill.receiptDate = data.receiptDate;
    if (data.rawReceipt !== undefined) bill.rawReceipt = data.rawReceipt;
    if (data.items !== undefined) bill.items = data.items;
    if (data.taxCents !== undefined) bill.taxCents = data.taxCents;
    if (data.tipCents !== undefined) bill.tipCents = data.tipCents;
    if (data.splitMode !== undefined) bill.splitMode = data.splitMode;
    if (data.participantsByItem !== undefined) bill.participantsByItem = data.participantsByItem;
    if (data.status !== undefined) bill.status = data.status;

    bill.totalCents = computeTotalCents(bill.items, bill.taxCents, bill.tipCents);
    await bill.save();

    return res.status(200).json(billToResponse(bill));
  } catch (err) {
    console.error("Update bill error:", err);
    return res.status(500).json({ error: err.message || "Failed to update bill" });
  }
});

router.post("/:id/finalize", async (req, res) => {
  try {
    await connectDB();
    const bill = await Bill.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    bill.totalCents = computeTotalCents(bill.items, bill.taxCents, bill.tipCents);

    let participantIds = [];
    if (bill.groupId) {
      const group = await Group.findById(bill.groupId).lean();
      if (group) {
        const ownerStr = group.ownerId?.toString?.();
        if (ownerStr) participantIds.push(ownerStr);
        for (const m of group.memberIds || []) {
          const id = m?.toString?.() || m;
          if (id && id !== ownerStr && !participantIds.includes(id)) {
            participantIds.push(id);
          }
        }
      }
    }
    if (participantIds.length === 0) participantIds = [req.userId];

    const { shares, whoOwesPayer } = computeSettlementSnapshot(
      bill,
      participantIds,
      req.userId
    );
    bill.settlementSnapshot = { shares, whoOwesPayer };
    bill.status = "sent";
    await bill.save();

    return res.status(200).json(billToResponse(bill));
  } catch (err) {
    console.error("Finalize bill error:", err);
    return res.status(500).json({ error: err.message || "Failed to finalize" });
  }
});

function billToResponse(bill) {
  const b = bill && typeof bill.toObject === "function" ? bill.toObject() : bill;
  return {
    id: b._id.toString(),
    ownerId: b.ownerId?.toString?.() || b.ownerId,
    groupId: b.groupId?._id?.toString?.() || b.groupId?.toString?.() || b.groupId,
    groupName: b.groupId?.name,
    merchant: b.merchant || "",
    currency: b.currency || "USD",
    receiptDate: b.receiptDate,
    items: (b.items || []).map((it) => ({
      id: it.id,
      name: it.name,
      qty: it.qty,
      unitPriceCents: it.unitPriceCents,
      confidence: it.confidence,
      source: it.source,
    })),
    taxCents: b.taxCents || 0,
    tipCents: b.tipCents || 0,
    totalCents: b.totalCents || 0,
    splitMode: b.splitMode || "equal",
    participantsByItem: b.participantsByItem || {},
    status: b.status || "draft",
    settlementSnapshot: b.settlementSnapshot,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

export default router;
