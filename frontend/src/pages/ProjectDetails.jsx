import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/client";
import Sidebar from "../components/Sidebar";
import TaskModal from "../components/TaskModal";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  STATUS,
  PRIORITY,
  STATUSES,
  normalizeStatus,
  groupTasksByStatus,
  calcAnalytics,
  nextStatus,
} from "../utils/status";

const TABS = ["overview", "tasks", "kanban", "analytics", "ai"];

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
        active
          ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/20"
          : "bg-[#1c1d47] text-gray-400 hover:text-white border border-white/5"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const analytics = calcAnalytics(tasks);
  const grouped = groupTasksByStatus(tasks);

  const fetchProject = async () => {
    const res = await api.get(`/projects/${id}`);
    setProject(res.data.data);
  };

  const fetchTasks = async () => {
    const res = await api.get(`/tasks/project/${id}`);
    setTasks(res.data.data || []);
  };

  const fetchInsights = async () => {
    try {
      const res = await api.get(`/ai/project/${id}`);
      setInsights(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchProject(), fetchTasks(), fetchInsights()]);
  };

  useEffect(() => {
    setLoading(true);
    refreshAll().finally(() => setLoading(false));
  }, [id]);

  const createTask = async (form) => {
    setSaving(true);
    try {
      const res = await api.post("/tasks", {
        project_id: Number(id),
        ...form,
        due_date: form.due_date || null,
      });
      setTasks((prev) => [...prev, res.data.data]);
      setShowTaskModal(false);
      await fetchProject();
      await fetchInsights();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (form) => {
    if (!editingTask) return;
    setSaving(true);
    try {
      const res = await api.put(`/tasks/${editingTask.id}`, form);
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? res.data.data : t)));
      setEditingTask(null);
      setShowTaskModal(false);
      await fetchProject();
      await fetchInsights();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (taskId, status) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
    try {
      await api.patch(`/tasks/${taskId}/status`, { status });
      await fetchProject();
      await fetchInsights();
    } catch (err) {
      console.error(err);
      await fetchTasks();
    }
  };

  const cycleStatus = async (task) => {
    await changeStatus(task.id, nextStatus(task.status));
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await api.delete(`/tasks/${taskId}`);
      await fetchProject();
      await fetchInsights();
    } catch (err) {
      console.error(err);
      await fetchTasks();
    }
  };

  const healthCls =
    insights?.health === "good"
      ? "bg-green-500/20 text-green-400"
      : insights?.health === "caution"
      ? "bg-yellow-500/20 text-yellow-400"
      : "bg-red-500/20 text-red-400";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080833] flex">
        <Sidebar />
        <LoadingSpinner size="lg" className="flex-1 min-h-screen" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080833] flex">
      <Sidebar />

      <div className="flex-1 p-10 overflow-auto text-white">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-gray-400 hover:text-white text-sm mb-4 transition"
        >
          ← Back to Dashboard
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-4xl font-bold">{project?.name}</h1>
            {insights && (
              <span className={`px-3 py-1 rounded-full text-sm ${healthCls}`}>
                {insights.healthLabel}
              </span>
            )}
          </div>
          <p className="text-gray-400 mt-2">{project?.description}</p>
          <div className="flex gap-8 mt-4 text-sm">
            <div>
              <p className="text-gray-500">Technology</p>
              <p>{project?.technology}</p>
            </div>
            <div>
              <p className="text-gray-500">Progress</p>
              <p className="text-fuchsia-400">{project?.progress ?? 0}%</p>
            </div>
            <div>
              <p className="text-gray-500">Tasks</p>
              <p>{analytics.totalTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1c1d47] p-6 rounded-2xl mb-8 border border-white/5">
          <div className="flex justify-between mb-3 text-sm">
            <span className="text-gray-400">Project Progress</span>
            <span>{project?.progress ?? 0}%</span>
          </div>
          <div className="w-full h-3 bg-[#35365d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${project?.progress ?? 0}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3 mb-8 flex-wrap">
          {TABS.map((tab) => (
            <TabButton
              key={tab}
              active={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "ai" ? "AI Insights" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabButton>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1c1d47] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-xl font-semibold mb-6">Progress Overview</h2>
              <div className="flex items-center gap-8">
                <div className="w-28 h-28 rounded-full border-8 border-green-400/80 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{project?.progress ?? 0}%</p>
                    <p className="text-xs text-gray-400">Complete</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <p>✅ Completed: <span className="text-green-400">{analytics.completedTasks}</span></p>
                  <p>🔄 In Progress: <span className="text-yellow-400">{analytics.inProgressTasks}</span></p>
                  <p>📋 To Do: <span className="text-slate-400">{analytics.todoTasks}</span></p>
                  <p>📊 Total: {analytics.totalTasks}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1c1d47] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-xl font-semibold mb-4">AI Project Insight</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                {insights?.summary || "Loading insights…"}
              </p>
              <button
                onClick={() => setActiveTab("ai")}
                className="mt-4 bg-pink-500 px-5 py-2 rounded-xl hover:bg-pink-600 transition text-sm"
              >
                View AI Insights
              </button>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Tasks</h2>
              <button
                onClick={() => {
                  setEditingTask(null);
                  setShowTaskModal(true);
                }}
                className="bg-pink-500 px-5 py-2.5 rounded-xl hover:bg-pink-600 transition shadow-lg shadow-pink-500/20"
              >
                + New Task
              </button>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 && (
                <p className="text-gray-500 text-center py-12">No tasks yet</p>
              )}
              {tasks.map((task) => {
                const st = normalizeStatus(task.status);
                return (
                  <div
                    key={task.id}
                    className="bg-[#1c1d47] p-5 rounded-xl flex justify-between items-center border border-white/5 hover:border-white/10 transition"
                  >
                    <div>
                      <h3 className={`font-semibold ${st === "done" ? "line-through text-gray-500" : ""}`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-gray-400 text-sm mt-1">{task.description}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY[task.priority]?.cls}`}>
                          {PRIORITY[task.priority]?.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS[st]?.cls}`}>
                          {STATUS[st]?.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => cycleStatus(task)}
                        className="bg-purple-600/80 px-3 py-2 rounded-lg text-xs hover:bg-purple-600 transition"
                      >
                        Cycle Status
                      </button>
                      <button
                        onClick={() => {
                          setEditingTask(task);
                          setShowTaskModal(true);
                        }}
                        className="bg-yellow-500/90 px-3 py-2 rounded-lg text-xs hover:bg-yellow-600 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="bg-red-500/90 px-3 py-2 rounded-lg text-xs hover:bg-red-600 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { key: "todo", label: "To Do" },
              { key: "in_progress", label: "In Progress" },
              { key: "done", label: "Done" },
            ].map((col) => (
              <div key={col.key} className="bg-[#1c1d47] rounded-2xl p-5 border border-white/5">
                <h2 className="font-bold mb-4 flex items-center justify-between">
                  {col.label}
                  <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                    {grouped[col.key]?.length || 0}
                  </span>
                </h2>
                <div className="space-y-3 min-h-[120px]">
                  {(grouped[col.key] || []).map((task) => (
                    <div
                      key={task.id}
                      className="bg-[#25265c] p-4 rounded-xl border border-white/5 hover:border-purple-500/30 transition"
                    >
                      <h3 className={`font-semibold text-sm ${col.key === "done" ? "line-through text-gray-500" : ""}`}>
                        {task.title}
                      </h3>
                      <div className="flex gap-2 mt-3 items-center flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY[task.priority]?.cls}`}>
                          {task.priority}
                        </span>
                        <select
                          value={normalizeStatus(task.status)}
                          onChange={(e) => changeStatus(task.id, e.target.value)}
                          className="text-xs bg-[#35365d] border border-white/10 rounded-lg px-2 py-1 outline-none cursor-pointer"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS[s]?.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Completion Rate", value: `${analytics.completionRate}%`, color: "text-green-400" },
              { label: "Total Tasks", value: analytics.totalTasks, color: "text-white" },
              { label: "Completed", value: analytics.completedTasks, color: "text-green-400" },
              { label: "In Progress", value: analytics.inProgressTasks, color: "text-yellow-400" },
            ].map((card) => (
              <div key={card.label} className="bg-[#1c1d47] p-6 rounded-2xl border border-white/5 shadow-xl">
                <h3 className="text-gray-400 text-sm">{card.label}</h3>
                <p className={`text-4xl mt-3 font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "ai" && insights && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1c1d47] p-6 rounded-2xl border border-white/5 shadow-xl">
              <h2 className="text-2xl font-bold mb-4">AI Project Summary</h2>
              <p className={`text-sm font-medium mb-3 ${healthCls} inline-block px-3 py-1 rounded-full`}>
                {insights.healthLabel}
              </p>
              <p className="text-gray-300 leading-relaxed">{insights.summary}</p>
            </div>

            <div className="bg-[#1c1d47] p-6 rounded-2xl border border-white/5 shadow-xl">
              <h2 className="text-2xl font-bold mb-4">Warnings</h2>
              {insights.warnings?.length === 0 ? (
                <p className="text-green-400 text-sm">No risks detected — project looks healthy.</p>
              ) : (
                <ul className="space-y-3">
                  {insights.warnings.map((w, i) => (
                    <li
                      key={i}
                      className={`text-sm px-4 py-3 rounded-xl border ${
                        w.level === "high"
                          ? "bg-red-500/10 border-red-500/30 text-red-300"
                          : "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
                      }`}
                    >
                      {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-[#1c1d47] p-6 rounded-2xl border border-white/5 shadow-xl lg:col-span-2">
              <h2 className="text-2xl font-bold mb-4">AI Suggestions</h2>
              <ul className="space-y-3">
                {insights.suggestions.map((s, i) => (
                  <li key={i} className="text-gray-300 text-sm flex gap-2">
                    <span className="text-purple-400">→</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <TaskModal
          open={showTaskModal}
          task={editingTask}
          mode={editingTask ? "edit" : "create"}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onSave={editingTask ? updateTask : createTask}
          saving={saving}
        />
      </div>
    </div>
  );
}
