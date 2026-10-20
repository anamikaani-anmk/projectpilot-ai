import { useState } from "react";
import Modal from "./Modal";
import api from "../api/client";

export default function JoinProjectModal({ open, onClose, onJoined }) {
  const [joinCode, setJoinCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await api.post("/projects/join", {
        join_code: joinCode.trim(),
        password: password.trim() || undefined,
      });

      setJoinCode("");
      setPassword("");
      onClose();
      if (onJoined) {
        onJoined(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to join project");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-[#35365d] text-white p-3 rounded-xl mb-3 outline-none focus:ring-2 focus:ring-purple-500 transition";

  return (
    <Modal open={open} onClose={onClose} title="Join Existing Project" width="max-w-md">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm border border-red-500/30">
            {error}
          </div>
        )}

        <p className="text-gray-400 text-sm mb-4">
          Enter the 8-character project Join Code provided by the project Head.
        </p>

        <label className="block text-gray-300 text-xs font-semibold uppercase mb-1">
          Join Code <span className="text-pink-400">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. 8A3F9C1B"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          className={`${inputCls} font-mono tracking-wider uppercase`}
          required
        />

        <label className="block text-gray-300 text-xs font-semibold uppercase mb-1">
          Project Password (if required)
        </label>
        <input
          type="password"
          placeholder="Enter password (optional)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/10 text-slate-300 hover:bg-white/15 transition text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !joinCode.trim()}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90 transition disabled:opacity-50 text-sm font-medium"
          >
            {loading ? "Joining…" : "Join Project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
