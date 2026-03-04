import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Search, Check, Users, Plus, Link2, Loader2 } from "lucide-react";
import { NavBar } from "../components/NavBar";
import { ProgressStepper } from "../components/ProgressStepper";
import { AppState, Group, Person, Screen } from "../types";
import {
  apiGetGroups,
  apiCreateGroup,
  apiCreateGroupFromSplitwise,
  apiAddGroupMember,
  apiSplitwiseGroups,
  apiSplitwiseStatus,
  apiSplitwiseCreateGroup,
  apiUpdateGroupSplitwise,
} from "../../lib/api";
import { useBillStore } from "../../store/billStore";
import { hapticLight } from "../../lib/haptic";
import { getCachedGroups, setCachedGroups } from "../../lib/groupsCache";

interface ChooseGroupProps {
  state: AppState;
  setState: (s: Partial<AppState>) => void;
  navigate: (screen: Screen) => void;
}

export function ChooseGroup({ state, setState, navigate }: ChooseGroupProps) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [splitwiseConnected, setSplitwiseConnected] = useState(false);
  const [splitwiseGroups, setSplitwiseGroups] = useState<
    { id: number; name: string; members?: { id: number; email?: string; first_name?: string; last_name?: string }[] }[]
  >([]);
  const [splitwiseGroupsLoading, setSplitwiseGroupsLoading] = useState(false);
  const [splitwiseGroupsError, setSplitwiseGroupsError] = useState<string | null>(null);
  const [linkingSplitwise, setLinkingSplitwise] = useState(false);
  const [creatingInSplitwise, setCreatingInSplitwise] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<{ email: string; first_name?: string; last_name?: string; id?: number }[]>([]);
  const [showAddFromSplitwise, setShowAddFromSplitwise] = useState(false);

  useEffect(() => {
    const cached = getCachedGroups();
    if (cached?.length) {
      setGroups(cached);
      setLoading(false);
    }
    apiGetGroups()
      .then((fresh) => {
        setCachedGroups(fresh);
        setGroups(fresh);
      })
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  const loadSplitwiseGroups = () => {
    setSplitwiseGroupsError(null);
    apiSplitwiseStatus()
      .then((s) => {
        setSplitwiseConnected(s.connected);
        if (s.connected) {
          setSplitwiseGroupsLoading(true);
          apiSplitwiseGroups()
            .then((g) => {
              const arr = Array.isArray(g) ? g : (g?.groups ? g.groups : []);
              setSplitwiseGroups(
                arr.map((x: { id: number; name: string; members?: { id: number; email?: string; first_name?: string; last_name?: string }[] }) => ({
                  id: x.id,
                  name: x.name,
                  members: x.members || [],
                }))
              );
              setSplitwiseGroupsError(null);
            })
            .catch((err) => {
              setSplitwiseGroups([]);
              setSplitwiseGroupsError(err?.message || "Failed to load groups");
            })
            .finally(() => setSplitwiseGroupsLoading(false));
        } else {
          setSplitwiseGroups([]);
        }
      })
      .catch(() => {
        setSplitwiseConnected(false);
        setSplitwiseGroups([]);
      });
  };

  useEffect(() => {
    loadSplitwiseGroups();
  }, []);

  useEffect(() => {
    if (groups.length && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
      setSelectedPeople(new Set((groups[0].members || []).map((p) => p.id)));
    }
  }, [groups.length]);

  const allGroups = groups;
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    state.selectedGroup?.id || groups[0]?.id || ""
  );
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(
    new Set(
      state.selectedPeople?.map((p) => p.id) ||
        (groups[0]?.members?.map((p) => p.id) ?? [])
    )
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(query.toLowerCase())
  );
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0];

  const selectGroup = (group: Group) => {
    setSelectedGroupId(group.id);
    setSelectedPeople(new Set((group.members || []).map((p) => p.id)));
    setPendingMembers([]);
    setShowAddFromSplitwise(false);
  };

  const togglePerson = (personId: string) => {
    setSelectedPeople(prev => {
      const next = new Set(prev);
      if (next.has(personId)) {
        if (next.size > 2) next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  const setBillGroup = useBillStore((s) => s.setBillGroup);
  const [continuing, setContinuing] = useState(false);

  const handleContinue = async () => {
    if (continuing || !selectedGroup) return;
    hapticLight();
    setContinuing(true);
    const people = (selectedGroup?.members || []).filter((p) => selectedPeople.has(p.id));
    setState({ selectedGroup: selectedGroup || null, selectedPeople: people });
    navigate("split");
    if (selectedGroup) setBillGroup(selectedGroup.id);
  };

  const handleAddMember = async () => {
    if (!addMemberEmail.trim() || !selectedGroup) return;
    setAddingMember(true);
    try {
      const updated = await apiAddGroupMember(selectedGroup.id, addMemberEmail.trim());
      setGroups((prev) =>
        prev.map((g) => (g.id === selectedGroup.id ? { ...g, ...updated } : g))
      );
      setSelectedPeople(new Set(updated.members?.map((m: Person) => m.id) ?? []));
      setAddMemberEmail("");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("User not found") || msg.includes("sign up first")) {
        setPendingMembers((prev) => {
          const email = addMemberEmail.trim().toLowerCase();
          if (prev.some((p) => p.email?.toLowerCase() === email)) return prev;
          return [...prev, { email }];
        });
        setAddMemberEmail("");
      } else {
        alert(msg);
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const created = await apiCreateGroup({ name: newGroupName.trim(), memberIds: [] });
      const newGroup: Group = {
        id: created.id,
        name: created.name,
        emoji: "👥",
        members: [],
        lastUsed: false,
      };
      setGroups((prev) => [newGroup, ...prev]);
      setSelectedGroupId(created.id);
      setSelectedPeople(new Set());
      setNewGroupName("");
      setCreating(false);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Choose Group"
        subtitle="Who's splitting this bill?"
        onBack={() => navigate("review")}
      />
      <ProgressStepper currentStep={2} />

      <div className="flex-1 overflow-y-auto px-5 pb-2">
        {/* Create group */}
        <div className="flex gap-2 mb-4">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New group name..."
            className="flex-1 rounded-xl pl-4 pr-4 py-3 outline-none"
            style={{
              background: "white",
              border: "1.5px solid #E5E7EB",
              fontSize: "14px",
              color: "#1A1A2E",
            }}
          />
          <button
            onClick={handleCreateGroup}
            disabled={!newGroupName.trim() || creating}
            className="rounded-xl px-4 py-3 flex items-center gap-2"
            style={{
              background: newGroupName.trim() ? "#22C55E" : "#E5E7EB",
              color: newGroupName.trim() ? "white" : "#9CA3AF",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            <Plus size={18} />
            Create
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} color="#9CA3AF" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search groups..."
            className="w-full rounded-xl pl-10 pr-4 py-3 outline-none"
            style={{
              background: "white",
              border: "1.5px solid #E5E7EB",
              fontSize: "14px",
              color: "#1A1A2E",
            }}
          />
        </div>

        {/* Splitwise connect prompt when not connected */}
        {!splitwiseConnected && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={18} color="#B45309" />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#92400E" }}>Connect Splitwise</span>
            </div>
            <p style={{ fontSize: "12px", color: "#92400E", marginBottom: "10px", lineHeight: 1.5 }}>
              Connect to sync expenses and see your Splitwise groups.
            </p>
            <button
              onClick={() => {
                const token = localStorage.getItem("splitsprint-token");
                const base = import.meta.env.VITE_API_URL || "";
                if (token) {
                  const params = new URLSearchParams({ token, returnTo: "group", origin: window.location.origin });
                  window.location.href = `${base}/api/splitwise/connect?${params.toString()}`;
                } else {
                  alert("Please log in first.");
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
                color: "white",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              <Link2 size={16} />
              Connect Splitwise
            </button>
          </div>
        )}

        {/* Splitwise groups - show when connected so user sees their groups */}
        {splitwiseConnected && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#166534", marginBottom: "10px" }}>
              Your Splitwise groups
            </h4>
            {splitwiseGroupsLoading ? (
              <div style={{ fontSize: "13px", color: "#15803D" }}>Loading...</div>
            ) : splitwiseGroupsError ? (
              <div>
                <div style={{ fontSize: "13px", color: "#B91C1C", marginBottom: "8px" }}>{splitwiseGroupsError}</div>
                <button
                  onClick={loadSplitwiseGroups}
                  className="rounded-lg px-3 py-2"
                  style={{ fontSize: "12px", fontWeight: 600, background: "white", border: "1px solid #86EFAC", color: "#166534" }}
                >
                  Retry
                </button>
              </div>
            ) : splitwiseGroups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {splitwiseGroups.map((g) => {
                  const linkedGroup = groups.find((sg) => sg.splitwiseGroupId === g.id);
                  const isSelected = linkedGroup?.id === selectedGroupId;
                  return (
                    <motion.button
                      key={g.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={async () => {
                        if (linkedGroup) {
                          selectGroup(linkedGroup);
                        } else {
                          setCreating(true);
                          try {
                            const members = g.members?.length ? g.members : [];
                            const created = members.length
                              ? await apiCreateGroupFromSplitwise({
                                  name: g.name,
                                  splitwiseGroupId: g.id,
                                  splitwiseMembers: members,
                                })
                              : await apiCreateGroup({ name: g.name, memberIds: [] }).then(async (c) => {
                                  const updated = await apiUpdateGroupSplitwise(c.id, g.id);
                                  return { ...c, ...updated };
                                });
                            const newGroup: Group = {
                              id: created.id,
                              name: created.name || g.name,
                              emoji: "👥",
                              members: created.members || [],
                              splitwiseGroupId: g.id,
                              lastUsed: false,
                            };
                            setGroups((prev) => [newGroup, ...prev]);
                            setSelectedGroupId(newGroup.id);
                            setSelectedPeople(new Set((newGroup.members || []).map((p) => p.id)));
                          } catch (e) {
                            alert((e as Error).message);
                          } finally {
                            setCreating(false);
                          }
                        }
                      }}
                      disabled={creating}
                      className="rounded-lg px-3 py-2 text-left"
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        background: isSelected ? "#D1FAE5" : "white",
                        border: `1.5px solid ${isSelected ? "#22C55E" : "#86EFAC"}`,
                        color: "#166534",
                      }}
                    >
                      {g.name}
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "#15803D" }}>No groups in Splitwise yet</div>
            )}
          </div>
        )}

        {/* Last used badge */}
        {!query && (
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1" style={{ background: "#E5E7EB" }} />
            <span style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: 600 }}>GROUPS</span>
            <div className="h-px flex-1" style={{ background: "#E5E7EB" }} />
          </div>
        )}

        {/* Groups list */}
        <div className="flex flex-col gap-2 mb-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl p-3.5 animate-pulse"
                  style={{ background: "#F9FAFB", border: "2px solid #F3F4F6" }}
                >
                  <div className="w-12 h-12 rounded-2xl flex-shrink-0" style={{ background: "#E5E7EB" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded-lg w-3/4" style={{ background: "#E5E7EB" }} />
                    <div className="h-3 rounded w-1/2" style={{ background: "#E5E7EB" }} />
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="w-6 h-6 rounded-full" style={{ background: "#E5E7EB" }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          filteredGroups.map((group, i) => {
            const isSelected = group.id === selectedGroupId;
            return (
              <motion.button
                key={group.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => selectGroup(group)}
                className="flex items-center gap-3 rounded-2xl p-3.5 text-left"
                style={{
                  background: isSelected ? "#ECFDF5" : "white",
                  border: isSelected ? "2px solid #22C55E" : "2px solid #F3F4F6",
                  boxShadow: isSelected ? "0 4px 16px rgba(34,197,94,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: isSelected ? "#D1FAE5" : "#F9FAFB" }}
                >
                  {group.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#1A1A2E" }}>
                      {group.name}
                    </span>
                    {group.lastUsed && (
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{ fontSize: "10px", fontWeight: 700, background: "#FEF9C3", color: "#CA8A04" }}
                      >
                        Last used
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Users size={11} color="#9CA3AF" />
                    <span style={{ fontSize: "12px", color: "#9CA3AF" }}>
                      {(group.members?.length ?? 0)} members
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {(group.members || []).slice(0, 4).map((member) => (
                      <div
                        key={member.id}
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: member.color, fontSize: "10px", fontWeight: 700, color: "white" }}
                      >
                        {member.avatar}
                      </div>
                    ))}
                    {(group.members?.length ?? 0) > 4 && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "#E5E7EB", fontSize: "9px", color: "#6B7280" }}
                      >
                        +{(group.members?.length ?? 0) - 4}
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "#22C55E" }}>
                    <Check size={14} color="white" />
                  </div>
                )}
              </motion.button>
            );
          }))}
        </div>

        {/* Add member (when group not linked to Splitwise) */}
        {selectedGroup && !selectedGroup.splitwiseGroupId && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: "white", border: "1.5px solid #E5E7EB" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1A2E", marginBottom: "8px" }}>
              Add members
            </h4>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={addMemberEmail}
                onChange={(e) => setAddMemberEmail(e.target.value)}
                placeholder="Add by email (Splitsprint or new)"
                className="flex-1 rounded-xl pl-4 pr-4 py-3 outline-none"
                style={{
                  background: "#F9FAFB",
                  border: "1.5px solid #E5E7EB",
                  fontSize: "14px",
                  color: "#1A1A2E",
                }}
              />
              <button
                onClick={handleAddMember}
                disabled={!addMemberEmail.trim() || addingMember}
                className="rounded-xl px-4 py-3"
                style={{
                  background: addMemberEmail.trim() ? "#7C3AED" : "#E5E7EB",
                  color: addMemberEmail.trim() ? "white" : "#9CA3AF",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {addingMember ? "..." : "Add"}
              </button>
            </div>
            {splitwiseConnected && splitwiseGroups.length > 0 && (
              <button
                onClick={() => setShowAddFromSplitwise((v) => !v)}
                className="w-full rounded-xl px-4 py-2.5 flex items-center justify-center gap-2"
                style={{
                  background: showAddFromSplitwise ? "#D1FAE5" : "#F0FDF4",
                  border: "1.5px solid #86EFAC",
                  color: "#166534",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                <Link2 size={14} />
                {showAddFromSplitwise ? "Hide" : "Add from Splitwise groups"}
              </button>
            )}
            {showAddFromSplitwise && splitwiseConnected && (
              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                {splitwiseGroups
                  .filter((g) => g.id !== selectedGroup?.splitwiseGroupId)
                  .flatMap((g) =>
                    (g.members || []).map((m) => ({
                      ...m,
                      groupName: g.name,
                    }))
                  )
                  .filter((m, i, arr) => arr.findIndex((x) => x.email?.toLowerCase() === m.email?.toLowerCase()) === i)
                  .map((m) => (
                    <button
                      key={`${m.id}-${m.email}`}
                      type="button"
                      onClick={() => {
                        const email = m.email?.toLowerCase();
                        if (!email) return;
                        setPendingMembers((prev) => {
                          if (prev.some((p) => p.email?.toLowerCase() === email)) return prev;
                          return [...prev, { id: m.id, email, first_name: m.first_name, last_name: m.last_name }];
                        });
                      }}
                      className="w-full text-left rounded-lg px-3 py-2"
                      style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", fontSize: "13px" }}
                    >
                      {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.email} ({m.groupName})
                    </button>
                  ))}
              </div>
            )}
            {pendingMembers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingMembers.map((p) => (
                  <span
                    key={p.email}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1"
                    style={{ background: "#E0E7FF", color: "#3730A3", fontSize: "12px", fontWeight: 600 }}
                  >
                    {p.first_name || p.last_name ? [p.first_name, p.last_name].filter(Boolean).join(" ") : p.email}
                    <button
                      type="button"
                      onClick={() =>
                        setPendingMembers((prev) => prev.filter((x) => x.email?.toLowerCase() !== p.email?.toLowerCase()))
                      }
                      style={{ marginLeft: 4 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Link to Splitwise group */}
        {selectedGroup && splitwiseConnected && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#166534", marginBottom: "8px" }}>
              Link to Splitwise
            </h4>
            {selectedGroup.splitwiseGroupId ? (
              <select
                value={selectedGroup.splitwiseGroupId}
                onChange={async (e) => {
                  const val = e.target.value;
                  setLinkingSplitwise(true);
                  try {
                    const updated = await apiUpdateGroupSplitwise(
                      selectedGroup.id,
                      val ? Number(val) : null
                    );
                    setGroups((prev) =>
                      prev.map((g) => (g.id === selectedGroup.id ? { ...g, ...updated } : g))
                    );
                  } catch (err) {
                    alert((err as Error).message);
                  } finally {
                    setLinkingSplitwise(false);
                  }
                }}
                disabled={linkingSplitwise}
                className="w-full rounded-xl px-4 py-3 outline-none mb-2"
                style={{ background: "white", border: "1.5px solid #86EFAC", fontSize: "14px" }}
              >
                <option value="">No Splitwise group</option>
                {splitwiseGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select
                  value=""
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    setLinkingSplitwise(true);
                    try {
                      const updated = await apiUpdateGroupSplitwise(
                        selectedGroup.id,
                        Number(val)
                      );
                      setGroups((prev) =>
                        prev.map((g) => (g.id === selectedGroup.id ? { ...g, ...updated } : g))
                      );
                    } catch (err) {
                      alert((err as Error).message);
                    } finally {
                      setLinkingSplitwise(false);
                    }
                  }}
                  disabled={linkingSplitwise}
                  className="w-full rounded-xl px-4 py-3 outline-none mb-2"
                  style={{ background: "white", border: "1.5px solid #86EFAC", fontSize: "14px" }}
                >
                  <option value="">Link to existing group...</option>
                  {splitwiseGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {((selectedGroup.members?.length ?? 0) + pendingMembers.length) >= 2 && (
                      <button
                        onClick={async () => {
                          setCreatingInSplitwise(true);
                          try {
                            const result = await apiSplitwiseCreateGroup(
                              selectedGroup.id,
                              pendingMembers.length ? pendingMembers : undefined
                            );
                            const COLORS = ["#7C3AED", "#0891B2", "#D97706", "#DC2626", "#059669"];
                            const members = (result.splitwiseMembers || []).map((m: { id: number; email?: string; first_name?: string; last_name?: string }, i: number) => {
                              const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email?.split("@")[0] || "?";
                              return {
                                id: `sw:${m.id}`,
                                name,
                                avatar: (name || "?")[0].toUpperCase(),
                                color: COLORS[i % COLORS.length],
                              };
                            });
                            setGroups((prev) =>
                              prev.map((g) =>
                                g.id === selectedGroup.id
                                  ? { ...g, splitwiseGroupId: result.splitwiseGroupId, members }
                                  : g
                              )
                            );
                            setPendingMembers([]);
                            setSelectedPeople(new Set(members.map((m) => m.id)));
                          } catch (err) {
                            alert((err as Error).message);
                          } finally {
                            setCreatingInSplitwise(false);
                          }
                        }}
                        disabled={creatingInSplitwise}
                        className="w-full rounded-xl px-4 py-3 flex items-center justify-center gap-2"
                        style={{
                          background: "linear-gradient(135deg, #10B981, #059669)",
                          color: "white",
                          fontSize: "14px",
                          fontWeight: 700,
                          border: "none",
                        }}
                      >
                        <Link2 size={16} />
                        {creatingInSplitwise ? "Creating..." : "Create in Splitwise"}
                      </button>
                    )}
              </>
            )}
          </div>
        )}

        {/* Participants for selected group */}
        <div className="rounded-2xl p-4"
          style={{ background: "white", border: "1.5px solid #F3F4F6" }}>
          <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#1A1A2E", marginBottom: "12px" }}>
            Participants ({selectedPeople.size})
          </h4>
          <div className="flex flex-wrap gap-2">
            {(selectedGroup?.members || []).map((person) => {
              const isIn = selectedPeople.has(person.id);
              return (
                <motion.button
                  key={person.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => togglePerson(person.id)}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all"
                  style={{
                    background: isIn ? person.color : "#F3F4F6",
                    border: `1.5px solid ${isIn ? person.color : "#E5E7EB"}`,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: isIn ? "rgba(255,255,255,0.3)" : "#E5E7EB",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: isIn ? "white" : "#6B7280",
                    }}
                  >
                    {person.avatar}
                  </div>
                  <span style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: isIn ? "white" : "#4B5563",
                  }}>
                    {person.name}
                  </span>
                  {isIn && <Check size={12} color="rgba(255,255,255,0.8)" />}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="h-2" />
      </div>

      {/* Bottom CTA */}
      <div className="px-5 pt-3 pb-4 flex-shrink-0"
        style={{ background: "white", borderTop: "1px solid #F3F4F6", boxShadow: "0 -4px 20px rgba(0,0,0,0.06)" }}>
        <motion.button
          whileTap={{ scale: continuing ? 1 : 0.97 }}
          onClick={handleContinue}
          disabled={selectedPeople.size < 2 || !selectedGroup || continuing}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background:
              selectedPeople.size >= 2 && !continuing
                ? "linear-gradient(135deg, #22C55E, #16A34A)"
                : "#E5E7EB",
            color: selectedPeople.size >= 2 && !continuing ? "white" : "#9CA3AF",
            fontSize: "16px",
            fontWeight: 800,
          }}
        >
          {continuing ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Saving...
            </>
          ) : (
            `Continue with ${selectedPeople.size} people →`
          )}
        </motion.button>
      </div>
    </div>
  );
}
