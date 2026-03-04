import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { authMiddleware } from "../lib/auth.js";
import { splitwiseFetch } from "../lib/splitwiseClient.js";
import { Group } from "../models/Group.js";
import { User } from "../models/User.js";
import { createGroupSchema, createGroupFromSplitwiseSchema } from "../schemas/index.js";

const router = Router();
const COLORS = ["#7C3AED", "#0891B2", "#D97706", "#DC2626", "#059669"];

function splitwiseMembersToPersons(splitwiseMembers) {
  if (!splitwiseMembers?.length) return [];
  return splitwiseMembers.map((m, i) => {
    const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email?.split("@")[0] || "?";
    return {
      id: `sw:${m.id}`,
      name,
      avatar: (name || "?")[0].toUpperCase(),
      color: COLORS[i % COLORS.length],
    };
  });
}

router.use(authMiddleware);

router.post("/", async (req, res) => {
  try {
    await connectDB();
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const { name, memberIds } = parsed.data;
    const group = await Group.create({
      name,
      ownerId: req.userId,
      memberIds: memberIds || [],
    });
    return res.status(201).json({
      id: group._id.toString(),
      name: group.name,
      ownerId: group.ownerId.toString(),
      memberIds: group.memberIds.map((m) => m.toString()),
      createdAt: group.createdAt,
    });
  } catch (err) {
    console.error("Create group error:", err);
    return res.status(500).json({ error: err.message || "Failed to create group" });
  }
});

router.post("/from-splitwise", async (req, res) => {
  try {
    await connectDB();
    const parsed = createGroupFromSplitwiseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }
    const { name, splitwiseGroupId, splitwiseMembers } = parsed.data;
    const group = await Group.create({
      name,
      ownerId: req.userId,
      memberIds: [],
      splitwiseGroupId,
      splitwiseMembers,
    });
    const members = splitwiseMembersToPersons(splitwiseMembers);
    return res.status(201).json({
      id: group._id.toString(),
      name: group.name,
      emoji: "👥",
      ownerId: group.ownerId.toString(),
      memberIds: [],
      members,
      splitwiseGroupId: group.splitwiseGroupId,
      lastUsed: false,
      createdAt: group.createdAt,
    });
  } catch (err) {
    console.error("Create group from Splitwise error:", err);
    return res.status(500).json({ error: err.message || "Failed to create group" });
  }
});

router.get("/", async (req, res) => {
  try {
    await connectDB();
    const groups = await Group.find({
      $or: [{ ownerId: req.userId }, { memberIds: req.userId }],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const withMembers = await Promise.all(
      groups.map(async (g) => {
        let splitwiseMembers = g.splitwiseMembers;
        if (g.splitwiseGroupId && !splitwiseMembers?.length) {
          try {
            const data = await splitwiseFetch(req.userId, "/get_groups");
            const swGroup = (data.groups || []).find((gr) => gr.id === g.splitwiseGroupId);
            if (swGroup?.members?.length) {
              splitwiseMembers = swGroup.members.map((m) => ({
                id: m.id,
                email: m.email,
                first_name: m.first_name,
                last_name: m.last_name,
              }));
              await Group.findByIdAndUpdate(g._id, { splitwiseMembers });
            }
          } catch (err) {
            console.warn("[Groups] Could not fetch Splitwise members for group:", g._id, err.message);
          }
        }
        if (splitwiseMembers?.length) {
          const members = splitwiseMembersToPersons(splitwiseMembers);
          return {
            id: g._id.toString(),
            name: g.name,
            emoji: "👥",
            ownerId: g.ownerId.toString(),
            memberIds: members.map((m) => m.id),
            members,
            splitwiseGroupId: g.splitwiseGroupId,
            lastUsed: false,
            createdAt: g.createdAt,
          };
        }
        const memberIds = [
          g.ownerId.toString(),
          ...(g.memberIds || []).map((m) => m.toString()).filter((id) => id !== g.ownerId.toString()),
        ];
        const users = await User.find({ _id: { $in: memberIds } })
          .select("_id name email")
          .lean();
        const members = users.map((u, i) => ({
          id: u._id.toString(),
          name: u.name || u.email?.split("@")[0] || "?",
          avatar: (u.name || u.email || "?")[0].toUpperCase(),
          color: COLORS[i % COLORS.length],
        }));
        return {
          id: g._id.toString(),
          name: g.name,
          emoji: "👥",
          ownerId: g.ownerId.toString(),
          memberIds: memberIds,
          members,
          splitwiseGroupId: g.splitwiseGroupId,
          lastUsed: false,
          createdAt: g.createdAt,
        };
      })
    );

    return res.status(200).json(withMembers);
  } catch (err) {
    console.error("List groups error:", err);
    return res.status(500).json({ error: err.message || "Failed to list groups" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    await connectDB();
    const group = await Group.findOne({
      _id: req.params.id,
      ownerId: req.userId,
    });
    if (!group) return res.status(404).json({ error: "Group not found" });
    const { addMemberEmail, splitwiseGroupId, splitwiseMembers } = req.body || {};
    if (splitwiseGroupId !== undefined) {
      group.splitwiseGroupId = splitwiseGroupId ? Number(splitwiseGroupId) : null;
      if (splitwiseMembers && Array.isArray(splitwiseMembers)) {
        group.splitwiseMembers = splitwiseMembers;
      } else if (!splitwiseGroupId) {
        group.splitwiseMembers = undefined;
      } else {
        try {
          const data = await splitwiseFetch(req.userId, "/get_groups");
          const swGroup = (data.groups || []).find((g) => g.id === group.splitwiseGroupId);
          if (swGroup?.members?.length) {
            group.splitwiseMembers = swGroup.members.map((m) => ({
              id: m.id,
              email: m.email,
              first_name: m.first_name,
              last_name: m.last_name,
            }));
          }
        } catch (err) {
          console.warn("[Groups] Could not fetch Splitwise members when linking:", err.message);
        }
      }
      await group.save();
    }
    if (addMemberEmail && typeof addMemberEmail === "string") {
      const user = await User.findOne({ email: addMemberEmail.trim().toLowerCase() });
      if (!user) {
        return res.status(400).json({ error: "User not found. They need to sign up first." });
      }
      const idStr = user._id.toString();
      if (!group.memberIds.some((m) => m.toString() === idStr)) {
        group.memberIds.push(user._id);
        await group.save();
      }
    }
    if (group.splitwiseMembers?.length) {
      const members = splitwiseMembersToPersons(group.splitwiseMembers);
      return res.status(200).json({
        id: group._id.toString(),
        name: group.name,
        emoji: "👥",
        ownerId: group.ownerId.toString(),
        memberIds: members.map((m) => m.id),
        members,
        splitwiseGroupId: group.splitwiseGroupId,
        lastUsed: false,
      });
    }
    const memberIds = [
      group.ownerId.toString(),
      ...group.memberIds.map((m) => m.toString()).filter((id) => id !== group.ownerId.toString()),
    ];
    const users = await User.find({ _id: { $in: memberIds } })
      .select("_id name email")
      .lean();
    const members = users.map((u, i) => ({
      id: u._id.toString(),
      name: u.name || u.email?.split("@")[0] || "?",
      avatar: (u.name || u.email || "?")[0].toUpperCase(),
      color: COLORS[i % COLORS.length],
    }));
    return res.status(200).json({
      id: group._id.toString(),
      name: group.name,
      emoji: "👥",
      ownerId: group.ownerId.toString(),
      memberIds,
      members,
      splitwiseGroupId: group.splitwiseGroupId,
      lastUsed: false,
    });
  } catch (err) {
    console.error("Update group error:", err);
    return res.status(500).json({ error: err.message || "Request failed" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    await connectDB();
    const group = await Group.findOne({
      _id: req.params.id,
      $or: [{ ownerId: req.userId }, { memberIds: req.userId }],
    })
      .lean();
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.splitwiseMembers?.length) {
      const members = splitwiseMembersToPersons(group.splitwiseMembers);
      return res.status(200).json({
        id: group._id.toString(),
        name: group.name,
        emoji: "👥",
        ownerId: group.ownerId.toString(),
        memberIds: members.map((m) => m.id),
        members,
        splitwiseGroupId: group.splitwiseGroupId,
        lastUsed: false,
        createdAt: group.createdAt,
      });
    }
    const memberIds = [
      group.ownerId.toString(),
      ...(group.memberIds || []).map((m) => m.toString()).filter((id) => id !== group.ownerId.toString()),
    ];
    const users = await User.find({ _id: { $in: memberIds } })
      .select("_id name email")
      .lean();
    const members = users.map((u) => ({
      id: u._id.toString(),
      name: u.name || u.email?.split("@")[0] || "?",
      avatar: (u.name || u.email || "?")[0].toUpperCase(),
      color: COLORS[memberIds.indexOf(u._id.toString()) % COLORS.length],
    }));
    return res.status(200).json({
      id: group._id.toString(),
      name: group.name,
      emoji: "👥",
      ownerId: group.ownerId.toString(),
      memberIds,
      members,
      splitwiseGroupId: group.splitwiseGroupId,
      lastUsed: false,
      createdAt: group.createdAt,
    });
  } catch (err) {
    console.error("Get group error:", err);
    return res.status(500).json({ error: err.message || "Request failed" });
  }
});

export default router;
