import { connectDB } from "../lib/mongodb.js";
import { User } from "../models/User.js";
import { signToken } from "../lib/auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDB();
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }
    const { email, password, name } = body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const user = await User.create({ email, password, name: name || "" });
    const token = signToken(user._id.toString());
    return res.status(201).json({
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      error: err.message || "Signup failed",
    });
  }
}
