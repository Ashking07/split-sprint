import React, { useState } from "react";
import { motion } from "motion/react";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

interface SignupProps {
  onLogin: () => void;
}

export function Signup({ onLogin }: SignupProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const signup = useAuthStore((s) => s.signup);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    try {
      await signup(email, password, name || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  };

  return (
    <div className="flex flex-col h-full px-5 pt-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 style={{ fontSize: "26px", fontWeight: 900, color: "#1A1A2E" }}>
          Create account
        </h1>
        <p style={{ fontSize: "14px", color: "#6B7280", marginTop: "4px" }}>
          Sign up to save your bills
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
            Name (optional)
          </label>
          <div className="relative">
            <User size={18} color="#9CA3AF" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
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
            Password (min 6 characters)
          </label>
          <div className="relative">
            <Lock size={18} color="#9CA3AF" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
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
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 mt-2"
          style={{
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            color: "white",
            fontSize: "16px",
            fontWeight: 800,
          }}
        >
          {isLoading ? "Creating account..." : "Sign up"}
          <ArrowRight size={18} color="white" />
        </motion.button>
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center mt-6 pb-8"
        style={{ fontSize: "14px", color: "#6B7280" }}
      >
        Already have an account?{" "}
        <button
          onClick={onLogin}
          style={{ color: "#22C55E", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
        >
          Sign in
        </button>
      </motion.p>
    </div>
  );
}
