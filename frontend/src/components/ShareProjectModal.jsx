import { useState } from "react";
import Modal from "./Modal";
import api from "../api/client";

export default function ShareProjectModal({ open, onClose, project, onPasswordUpdated }) {
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!project) return null;

  const handleCopyCode = () => {
    const codeText = project.join_code || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(codeText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(codeText);
      });
    } else {
      fallbackCopy(codeText);
    }
  };

  const fallbackCopy = (text) => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await api.patch(`/projects/${project.id}/join-password`, { password });
      setMessage(res.data.message);
      setPassword("");
      if (onPasswordUpdated) onPasswordUpdated();
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-[#35365d] text-white p-3 rounded-xl mb-3 outline-none focus:ring-2 focus:ring-purple-500 transition text-sm";

  return (
    <Modal open={open} onClose={onClose} title="Share Project" width="max-w-lg">
      <div className="space-y-6">
        <div>
          <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
            Project Join Code
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#121338] border border-purple-500/30 p-3.5 rounded-xl text-center font-mono text-2xl tracking-widest text-fuchsia-400 font-bold select-all">
              {project.join_code || "N/A"}
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3.5 rounded-xl transition text-sm font-medium"
            >
              {copied ? "Copied! ✓" : "Copy Code"}
            </button>
          </div>
          <p className="text-gray-400 text-xs mt-2">
            Share this code with teammates so they can join your project as Members.
          </p>
        </div>

        <hr className="border-white/10" />

        <div>
          <h4 className="text-white text-base font-semibold mb-1">Join Password Management</h4>
          <p className="text-gray-400 text-xs mb-3">
            Status:{" "}
            {project.has_join_password ? (
              <span className="text-green-400 font-medium">Protected with Password 🔒</span>
            ) : (
              <span className="text-yellow-400 font-medium">No Password Set (Open via Code) 🔓</span>
            )}
          </p>

          {message && (
            <div className="bg-purple-500/20 text-purple-300 p-3 rounded-xl mb-3 text-xs border border-purple-500/30">
              {message}
            </div>
          )}

          <form onSubmit={handleUpdatePassword}>
            <input
              type="password"
              placeholder="Enter new password (leave blank to remove)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-xs transition disabled:opacity-50"
              >
                {loading ? "Updating…" : password ? "Set Password" : "Remove Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
