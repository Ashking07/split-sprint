import React, { useState } from "react";
import { motion } from "motion/react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { hapticLight } from "../../lib/haptic";

interface LoginProps {
  onSignup: () => void;
}

export function Login({ onSignup }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="flex flex-col h-full px-5 pt-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 style={{ fontSize: "26px", fontWeight: 900, color: "#1A1A2E" }}>
          SplitSprint ⚡
        </h1>
        <p style={{ fontSize: "14px", color: "#6B7280", marginTop: "4px" }}>
          Sign in to sync your bills
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        {error && (
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
          >
            <span style={{ fontSize: "13px", color: "#B91C1C" }}>{error}</span>
          </div>
        )}

        <div>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "6px" }}>
            Email
          </label>
          <div className="relative">
            <Mail size={18} color="#9CA3AF" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-xl pl-11 pr-4 py-3 outline-none"
              style={{
                background: "white",
                border: "1.5px solid #E5E7EB",
                fontSize: "15px",
                color: "#1A1A2E",
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "6px" }}>
            Password
          </label>
          <div className="relative">
            <Lock size={18} color="#9CA3AF" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-xl pl-11 pr-4 py-3 outline-none"
              style={{
                background: "white",
                border: "1.5px solid #E5E7EB",
                fontSize: "15px",
                color: "#1A1A2E",
              }}
            />
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={isLoading}
          whileTap={{ scale: 0.98 }}
          onClick={() => hapticLight()}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 mt-2"
          style={{
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            color: "white",
            fontSize: "16px",
            fontWeight: 800,
          }}
        >
          {isLoading ? "Signing in..." : "Sign in"}
          <ArrowRight size={18} color="white" />
        </motion.button>
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center mt-6"
        style={{ fontSize: "14px", color: "#6B7280" }}
      >
        Don&apos;t have an account?{" "}
        <button
          onClick={() => {
            hapticLight();
            onSignup();
          }}
          style={{ color: "#22C55E", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
        >
          Sign up
        </button>
      </motion.p>
    </div>
  );
}
