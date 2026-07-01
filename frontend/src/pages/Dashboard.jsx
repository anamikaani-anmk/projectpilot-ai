import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import EditProjectModal from "../components/EditProjectModal";
import LoadingSpinner from "../components/LoadingSpinner";

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-[#1c1d47] rounded-2xl p-5 border border-white/5 shadow-xl hover:border-white/10 transition">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent || "text-white"}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [technology, setTechnology] = useState("");

  const [editingProject, setEditingProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchAll = async () => {
    try {
      const [projectsRes, statsRes] = await Promise.all([
        api.get("/projects"),
        api.get("/ai/dashboard"),
      ]);
      setProjects(projectsRes.data.data || []);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const createProject = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post("/projects", { name, description, technology });
      setProjects((prev) => [res.data.data, ...prev]);
      setName("");
      setDescription("");
      setTechnology("");
      const statsRes = await api.get("/ai/dashboard");
      setStats(statsRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this project and all its tasks?")) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      const statsRes = await api.get("/ai/dashboard");
      setStats(statsRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSave = async (form) => {
    if (!editingProject) return;
    setSaving(true);
    try {
      const res = await api.put(`/projects/${editingProject.id}`, form);
      setProjects((prev) =>
        prev.map((p) => (p.id === editingProject.id ? res.data.data : p))
      );
      setShowEditModal(false);
      setEditingProject(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-[#35365d] text-white p-3 rounded-xl mb-3 outline-none focus:ring-2 focus:ring-purple-500 transition";

  return (
    <div className="min-h-screen bg-[#080833] flex">
      <Sidebar />

      <div className="flex-1 p-10 overflow-auto">
        {loading ? (
          <LoadingSpinner size="lg" className="min-h-[60vh]" />
        ) : (
          <>
            <h1 className="text-white text-4xl font-bold mb-1">
              Good morning, {user?.name?.split(" ")[0] || "there"} 👋
            </h1>
            <p className="text-gray-400 mb-8">
              Manage your projects smarter with AI.
            </p>

            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <StatCard label="Total Projects" value={stats.totalProjects} />
                <StatCard label="Total Tasks" value={stats.totalTasks} />
                <StatCard
                  label="Completed Tasks"
                  value={stats.completedTasks}
                  accent="text-green-400"
                />
                <StatCard
                  label="Completion Rate"
                  value={`${stats.completionRate}%`}
                  accent="text-fuchsia-400"
                />
              </div>
            )}

            <div className="bg-[#1c1d47] p-6 rounded-2xl mb-10 border border-white/5 shadow-xl">
              <h2 className="text-white text-2xl mb-4 font-semibold">Create Project</h2>
              <input
                type="text"
                placeholder="Project Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputCls} min-h-[80px] resize-none`}
              />
              <input
                type="text"
                placeholder="Technology (e.g. React, Node, MySQL)"
                value={technology}
                onChange={(e) => setTechnology(e.target.value)}
                className={inputCls}
              />
              <button
                onClick={createProject}
                disabled={saving || !name.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-8 py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-purple-500/20"
              >
                {saving ? "Creating…" : "Create Project"}
              </button>
            </div>

            <h2 className="text-white text-2xl mb-6 font-semibold">My Projects</h2>
            {projects.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-[#1c1d47]/50 rounded-2xl border border-white/5">
                <p className="text-4xl mb-3">📁</p>
                <p>No projects yet — create one above</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.map((project) => {
                  const progress = project.progress ?? 0;
                  const health =
                    progress >= 70 ? "On Track" : progress >= 30 ? "In Progress" : "Getting Started";
                  const healthCls =
                    progress >= 70
                      ? "bg-green-500/15 text-green-400"
                      : progress >= 30
                      ? "bg-yellow-500/15 text-yellow-400"
                      : "bg-slate-500/15 text-slate-400";

                  return (
                    <div
                      key={project.id}
                      className="bg-[#1c1d47] rounded-2xl p-6 shadow-xl border border-white/5 hover:border-purple-500/30 hover:shadow-purple-500/10 transition group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-white text-xl font-bold">{project.name}</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${healthCls}`}>
                          {health}
                        </span>
                      </div>
                      <p className="text-gray-400 mb-2 text-sm line-clamp-2">
                        {project.description || "No description"}
                      </p>
                      <p className="text-sky-400 mb-4 text-sm">{project.technology}</p>

                      <div className="mb-5">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Progress</span>
                          <span className="text-fuchsia-400 font-medium">{progress}%</span>
                        </div>
                        <div className="w-full bg-[#35365d] rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/project/${project.id}`)}
                          className="bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 transition text-sm"
                        >
                          Open Project
                        </button>
                        <button
                          onClick={() => {
                            setEditingProject(project);
                            setShowEditModal(true);
                          }}
                          className="bg-yellow-500/90 text-white px-3 py-2 rounded-lg hover:bg-yellow-600 transition text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="bg-red-500/90 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <EditProjectModal
        open={showEditModal}
        project={editingProject}
        onClose={() => {
          setShowEditModal(false);
          setEditingProject(null);
        }}
        onSave={handleEditSave}
        saving={saving}
      />
    </div>
  );
}
