import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";
import { SplitwiseConnection } from "../models/SplitwiseConnection.js";
import { verifyToken } from "../lib/auth.js";

function getUserId(req) {
  const auth = req.headers?.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  return verifyToken(token);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await connectDB();
    const userIdObj = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;
    const conn = await SplitwiseConnection.findOne({
      userId: userIdObj,
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
    console.error("Splitwise status error:", err);
    return res.status(500).json({ error: err.message });
  }
}
