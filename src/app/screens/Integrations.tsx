import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link2, Unlink } from "lucide-react";
import { NavBar } from "../components/NavBar";
import { Screen } from "../types";
import { apiSplitwiseStatus, apiSplitwiseDisconnect, apiSplitwiseGroups } from "../../lib/api";
import { openSplitwiseConnect } from "../../lib/splitwiseConnect";

interface IntegrationsProps {
  navigate: (screen: Screen) => void;
}

export function Integrations({ navigate }: IntegrationsProps) {
  const [status, setStatus] = useState<{
    connected: boolean;
    email?: string;
    firstName?: string;
    lastName?: string;
  } | null>(null);
  const [splitwiseGroups, setSplitwiseGroups] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    apiSplitwiseStatus()
      .then((s) => {
        setStatus(s);
        if (s.connected) {
          return apiSplitwiseGroups().catch(() => []);
        }
        return [];
      })
      .then((g) => setSplitwiseGroups(Array.isArray(g) ? g : (g?.groups ? g.groups : [])))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = () => {
    setConnecting(true);
    openSplitwiseConnect("integrations");
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Splitwise? You can reconnect anytime.")) return;
    setDisconnecting(true);
    try {
      await apiSplitwiseDisconnect();
      setStatus({ connected: false });
    } catch {
      alert("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <NavBar
        title="Integrations"
        subtitle="Connect your apps"
        onBack={() => navigate("home")}
      />

      <div className="flex-1 overflow-y-auto px-5">
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ background: "white", border: "1.5px solid #F3F4F6" }}
        >
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
            >
              <Link2 size={24} color="white" />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#1A1A2E" }}>Splitwise</div>
              <div style={{ fontSize: "12px", color: "#6B7280" }}>
                Create expenses in Splitwise automatically
              </div>
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <div style={{ fontSize: "14px", color: "#9CA3AF" }}>Checking connection...</div>
            ) : status?.connected ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#22C55E" }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A2E" }}>
                    Connected as {status.email || `${status.firstName || ""} ${status.lastName || ""}`.trim() || "Splitwise user"}
                  </span>
                </div>
                {splitwiseGroups.length > 0 && (
                  <div className="mt-3 mb-2">
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", marginBottom: "6px" }}>
                      Your Splitwise groups
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {splitwiseGroups.map((g) => (
                        <span
                          key={g.id}
                          className="rounded-lg px-2.5 py-1.5"
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            background: "#F0FDF4",
                            border: "1px solid #86EFAC",
                            color: "#166534",
                          }}
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl"
                  style={{ background: "#FEF2F2", color: "#B91C1C", fontSize: "13px", fontWeight: 600 }}
                >
                  <Unlink size={14} />
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2"
                  style={{
                    background: connecting
                      ? "#9CA3AF"
                      : "linear-gradient(135deg, #10B981, #059669)",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  {connecting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 size={18} />
                      Connect Splitwise
                    </>
                  )}
                </motion.button>
                {connecting && (
                  <p style={{ fontSize: "12px", color: "#6B7280", textAlign: "center", marginTop: "8px" }}>
                    If this takes too long, the server may be starting up. Try again in a few seconds.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
