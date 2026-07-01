export const STATUSES = ["todo", "in_progress", "done"];

export const STATUS = {
  todo: { label: "To Do", cls: "bg-slate-500/15 text-slate-300 border-slate-500/25" },
  in_progress: { label: "In Progress", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" },
  inprog: { label: "In Progress", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" },
  done: { label: "Done", cls: "bg-green-500/15 text-green-400 border-green-500/25" },
  completed: { label: "Done", cls: "bg-green-500/15 text-green-400 border-green-500/25" },
};

export const PRIORITY = {
  high: { label: "High", cls: "bg-red-500/15 text-red-400" },
  medium: { label: "Medium", cls: "bg-yellow-500/15 text-yellow-400" },
  low: { label: "Low", cls: "bg-green-500/15 text-green-400" },
};

export function normalizeStatus(status) {
  if (status === "inprog" || status === "in_progress") return "in_progress";
  if (status === "completed") return "done";
  return status;
}

export function nextStatus(current) {
  const normalized = normalizeStatus(current);
  const idx = STATUSES.indexOf(normalized);
  return STATUSES[(idx + 1) % STATUSES.length];
}

export function groupTasksByStatus(tasks) {
  return {
    todo: tasks.filter((t) => normalizeStatus(t.status) === "todo"),
    in_progress: tasks.filter((t) => normalizeStatus(t.status) === "in_progress"),
    done: tasks.filter((t) => normalizeStatus(t.status) === "done"),
  };
}

export function calcAnalytics(tasks) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => normalizeStatus(t.status) === "done").length;
  const inProgressTasks = tasks.filter((t) => normalizeStatus(t.status) === "in_progress").length;
  const todoTasks = tasks.filter((t) => normalizeStatus(t.status) === "todo").length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return { totalTasks, completedTasks, inProgressTasks, todoTasks, completionRate };
}
