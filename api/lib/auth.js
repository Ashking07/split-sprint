import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { connectDB } from "./mongodb.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export async function verifyToken(token) {
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    return userId;
  } catch {
    return null;
  }
}

export async function authMiddleware(req, res, next) {
  await connectDB();
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = await verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Invalid token" });
  }
  req.userId = userId;
  next();
}
