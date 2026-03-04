import { connectDB } from "../../lib/mongodb.js";
import { Bill } from "../../models/Bill.js";
import { authMiddleware } from "../../lib/auth.js";

async function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await runMiddleware(req, res, authMiddleware);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { userId } = req;

  try {
    await connectDB();

    if (req.method === "GET") {
      const bills = await Bill.find({ userId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      const history = bills.map((b) => ({
        id: b._id.toString(),
        title: b.title,
        date: b.date,
        total: b.total,
        group: b.group,
        status: b.status,
        emoji: b.emoji || "🧾",
      }));
      return res.status(200).json(history);
    }

    if (req.method === "POST") {
      const { title, date, total, group, status, emoji } = req.body || {};
      if (!title || !date || total == null || !group) {
        return res.status(400).json({ error: "title, date, total, group required" });
      }
      const bill = await Bill.create({
        userId,
        title,
        date,
        total: Number(total),
        group,
        status: status || "sent",
        emoji: emoji || "🧾",
      });
      return res.status(201).json({
        id: bill._id.toString(),
        title: bill.title,
        date: bill.date,
        total: bill.total,
        group: bill.group,
        status: bill.status,
        emoji: bill.emoji,
      });
    }
  } catch (err) {
    console.error("History error:", err);
    return res.status(500).json({ error: "Request failed" });
  }
}
