import { useState, useEffect } from "react";
import Modal from "./Modal";

export default function EditProjectModal({ open, project, onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: "", description: "", technology: "" });

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || "",
        description: project.description || "",
        technology: project.technology || "",
      });
    }
  }, [project]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  const inputCls =
    "w-full bg-[#35365d] text-white p-3 rounded-xl mb-3 outline-none focus:ring-2 focus:ring-purple-500 transition";

  return (
    <Modal open={open} onClose={onClose} title="Edit Project">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Project Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputCls}
          required
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={`${inputCls} min-h-[100px] resize-none`}
        />
        <input
          type="text"
          placeholder="Technology"
          value={form.technology}
          onChange={(e) => setForm({ ...form, technology: e.target.value })}
          className={inputCls}
        />
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/10 text-slate-300 hover:bg-white/15 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
