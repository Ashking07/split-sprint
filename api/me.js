import { connectDB } from "./lib/mongodb.js";
import { User } from "./models/User.js";
import { authMiddleware } from "./lib/auth.js";

async function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await runMiddleware(req, res, authMiddleware);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await connectDB();
    const user = await User.findById(req.userId).select("-password").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "Request failed" });
  }
}
