import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const links = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Projects", path: "/dashboard" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="w-64 bg-[#11113d] p-6 flex flex-col shadow-2xl min-h-screen border-r border-white/5">
      <div className="mb-10">
        <h1 className="text-white text-2xl font-bold">ProjectPilot</h1>
        <p className="text-purple-400 text-xs mt-1">AI</p>
      </div>

      <nav className="space-y-2">
        {links.map((link) => {
          const active = location.pathname === link.path;
          return (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              className={`w-full text-left px-4 py-2.5 rounded-xl transition ${
                active
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-grow" />

      {user && (
        <div className="mb-4 px-2">
          <p className="text-white text-sm font-medium truncate">{user.name}</p>
          <p className="text-gray-500 text-xs truncate">{user.email}</p>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="bg-red-500/90 text-white py-3 rounded-xl hover:bg-red-600 transition shadow-lg shadow-red-500/20"
      >
        Logout
      </button>
    </div>
  );
}
