import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/register", { name, email, password });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080833] flex items-center justify-center relative overflow-hidden">
      <div className="absolute w-72 h-20 bg-[#1f2156] rounded-full rotate-45 top-20 right-40 opacity-70" />
      <div className="absolute w-56 h-16 bg-[#1f2156] rounded-full rotate-45 bottom-40 left-40 opacity-70" />

      <div className="bg-[#1c1d47] p-10 rounded-2xl shadow-2xl w-[420px] z-10 border border-white/10">
        <div className="text-center mb-8">
          <h1 className="text-white text-4xl font-bold">Create Account</h1>
          <p className="text-gray-400 text-sm mt-2">Join ProjectPilot AI</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#35365d] text-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition"
            required
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#35365d] text-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#35365d] text-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition"
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Register"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Already have an account?{" "}
          <Link to="/" className="text-purple-400 hover:text-purple-300">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
