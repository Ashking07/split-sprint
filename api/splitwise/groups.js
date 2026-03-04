import { connectDB } from "../lib/mongodb.js";
import { splitwiseFetch } from "../lib/splitwiseClient.js";
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
    const data = await splitwiseFetch(userId, "/get_groups");
    const groups = (data.groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      members: (g.members || []).map((m) => ({
        id: m.id,
        email: m.email,
        first_name: m.first_name,
        last_name: m.last_name,
      })),
    }));
    return res.status(200).json(groups);
  } catch (err) {
    if (err.message?.includes("not connected")) {
      return res.status(401).json({ error: err.message });
    }
    console.error("Splitwise groups error:", err);
    return res.status(500).json({ error: err.message });
  }
}
