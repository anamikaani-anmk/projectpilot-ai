import { useState, useEffect } from "react";
import Modal from "./Modal";
import { STATUSES, STATUS } from "../utils/status";

const emptyForm = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
  status: "todo",
  assigned_to: "",
};

export default function TaskModal({
  open,
  task,
  onClose,
  onSave,
  saving,
  mode = "create",
  members = [],
  userRole = "head",
  currentUserId = null,
}) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (task && mode === "edit") {
      setForm({
        title: task.title || "",
        description: task.description || "",
        priority: task.priority || "medium",
        due_date: task.due_date ? task.due_date.split("T")[0] : "",
        status: task.status === "inprog" ? "in_progress" : task.status || "todo",
        assigned_to: task.assigned_to ? String(task.assigned_to) : "",
      });
    } else {
      setForm({
        ...emptyForm,
        assigned_to: userRole === "member" && currentUserId ? String(currentUserId) : "",
      });
    }
  }, [task, mode, open, userRole, currentUserId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      ...form,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
    };

    if (userRole === "member" && currentUserId) {
      payload.assigned_to = currentUserId;
    }

    onSave(payload);
  };

  const inputCls =
    "w-full bg-[#35365d] text-white p-3 rounded-xl mb-3 outline-none focus:ring-2 focus:ring-purple-500 transition";

  const isMemberRole = userRole === "member";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit Task" : "Create New Task"}
      width="max-w-xl"
    >
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Task Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={inputCls}
          required
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={`${inputCls} min-h-[90px] resize-none`}
        />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className={inputCls.replace("mb-3", "")}
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1">Assigned To</label>
            <select
              value={isMemberRole && currentUserId ? String(currentUserId) : form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              disabled={isMemberRole}
              className={`${inputCls.replace("mb-3", "")} ${
                isMemberRole ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role === "head" ? "Head" : "Member"})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className={inputCls.replace("mb-3", "")}
            />
          </div>

          {mode === "edit" && (
            <div>
              <label className="block text-gray-400 text-xs mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputCls.replace("mb-3", "")}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS[s]?.label || s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
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
            className="px-5 py-2.5 rounded-xl bg-pink-500 text-white hover:bg-pink-600 transition disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "edit" ? "Save Task" : "Create Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

