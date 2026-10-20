import { useState, useEffect, useRef } from "react";
import api from "../api/client";

const SUGGESTED_QUESTIONS = [
  "What should the team focus on next?",
  "Which tasks are at risk of missing their deadlines?",
  "Summarize team workload and who is handling what.",
  "Are there any high-priority tasks that are unassigned or blocked?",
  "What are the biggest bottlenecks in this project right now?",
  "Give me a quick progress briefing I can share with stakeholders.",
  "Which tasks have been completed so far?",
  "What should we do before the next milestone?",
];

function FormattedMessage({ text }) {
  if (!text) return null;
  const lines = text.split("\n");

  const elements = [];
  let currentList = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === "ul") {
        elements.push(
          <ul
            key={`list-${elements.length}`}
            className="list-disc list-inside space-y-1.5 my-2 text-gray-200"
          >
            {currentList.items.map((it, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInline(it)}
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol
            key={`list-${elements.length}`}
            className="list-decimal list-inside space-y-1.5 my-2 text-gray-200"
          >
            {currentList.items.map((it, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInline(it)}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  lines.forEach((rawLine, lineIdx) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      elements.push(<div key={`empty-${lineIdx}`} className="h-2" />);
      return;
    }

    // Bullet list
    const ulMatch = line.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (currentList && currentList.type !== "ul") flushList();
      if (!currentList) currentList = { type: "ul", items: [] };
      currentList.items.push(ulMatch[1]);
      return;
    }

    // Numbered list
    const olMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (olMatch) {
      if (currentList && currentList.type !== "ol") flushList();
      if (!currentList) currentList = { type: "ol", items: [] };
      currentList.items.push(olMatch[2]);
      return;
    }

    flushList();

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingClass =
        level === 1
          ? "text-lg font-bold text-white mt-3 mb-1"
          : level === 2
          ? "text-base font-semibold text-purple-300 mt-2 mb-1"
          : "text-sm font-semibold text-pink-300 mt-1 mb-1";
      elements.push(
        <div key={`h-${lineIdx}`} className={headingClass}>
          {renderInline(headingMatch[2])}
        </div>
      );
      return;
    }

    elements.push(
      <p key={`p-${lineIdx}`} className="my-1 leading-relaxed text-gray-200">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="text-sm space-y-1">{elements}</div>;
}

function renderInline(text) {
  if (!text) return "";
  const parts = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="bg-black/40 text-pink-300 px-1.5 py-0.5 rounded text-xs font-mono border border-pink-500/20"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} className="italic text-purple-200">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}

export default function ProjectChat({ projectId }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(`projectpilot_chat_${projectId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(`projectpilot_chat_${projectId}`, JSON.stringify(messages));
    } catch {}
  }, [projectId, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (messageText) => {
    const text = (messageText || input).trim();
    if (!text || loading) return;

    setError(null);
    setLastFailedMessage(null);

    const userTimestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMessage = {
      role: "user",
      content: text,
      timestamp: userTimestamp,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    const historyPayload = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    setLoading(true);

    try {
      const res = await api.post(`/ai/project/${projectId}/chat`, {
        message: text,
        history: historyPayload,
      });

      const assistantTimestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const assistantMessage = {
        role: "assistant",
        content: res.data.data.answer,
        timestamp: assistantTimestamp,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("AI Chat failed:", err);
      const errMsg =
        err.response?.data?.message ||
        "AI chat is temporarily unavailable. Your conversation is preserved. Please try again shortly.";
      setError(errMsg);
      setLastFailedMessage(text);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    if (window.confirm("Are you sure you want to clear this conversation history?")) {
      setMessages([]);
      setError(null);
      setLastFailedMessage(null);
      try {
        localStorage.removeItem(`projectpilot_chat_${projectId}`);
      } catch {}
    }
  };

  return (
    <div className="bg-[#1c1d47] rounded-2xl border border-white/5 shadow-xl flex flex-col h-[650px] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between flex-wrap gap-3 bg-[#17183e]/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-xl shadow-lg shadow-purple-500/20">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Ask ProjectPilot AI</h2>
              <span className="bg-purple-500/20 text-purple-300 text-[11px] px-2 py-0.5 rounded-full font-medium border border-purple-500/30">
                Grounded Assistant
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Live Q&A grounded in tasks, deadlines, team workload, and project metrics
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition"
            title="Clear conversation"
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Suggested Questions Carousel / Chips */}
      <div className="px-5 py-3 border-b border-white/5 bg-[#131435]/60 overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-300 font-semibold uppercase tracking-wider shrink-0 mr-1">
            Suggestions:
          </span>
          <div className="flex gap-2 shrink-0">
            {SUGGESTED_QUESTIONS.map((question, i) => (
              <button
                key={i}
                onClick={() => handleSend(question)}
                disabled={loading}
                className="text-xs bg-[#242657] hover:bg-gradient-to-r hover:from-purple-600/60 hover:to-pink-600/60 text-gray-300 hover:text-white px-3 py-1.5 rounded-full border border-white/10 hover:border-purple-400/30 transition disabled:opacity-50 whitespace-nowrap"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl mb-3">
              💬
            </div>
            <h3 className="text-white font-semibold text-base mb-1">
              Ask anything about this project
            </h3>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              I can analyze completed tasks, identify upcoming deadlines, summarize individual team workloads, highlight bottlenecks, or prepare stakeholder briefings.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full text-left">
              {SUGGESTED_QUESTIONS.slice(0, 3).map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="text-xs p-2.5 rounded-xl bg-[#242657]/80 hover:bg-[#2b2d66] text-purple-200 border border-purple-500/20 transition flex items-center justify-between"
                >
                  <span>{q}</span>
                  <span className="text-pink-400">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, index) => {
          const isUser = m.role === "user";
          return (
            <div
              key={index}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-gray-400">
                <span>{isUser ? "You" : "ProjectPilot AI"}</span>
                {m.timestamp && <span>• {m.timestamp}</span>}
              </div>
              <div
                className={`p-4 rounded-2xl max-w-[85%] md:max-w-[78%] shadow-lg ${
                  isUser
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-tr-sm"
                    : "bg-[#121333] border border-white/10 text-gray-200 rounded-tl-sm"
                }`}
              >
                {isUser ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                ) : (
                  <FormattedMessage text={m.content} />
                )}
              </div>
            </div>
          );
        })}

        {/* Loading state indicator */}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-gray-400">
              <span>ProjectPilot AI</span>
              <span>• Analyzing project data...</span>
            </div>
            <div className="bg-[#121333] border border-white/10 p-4 rounded-2xl rounded-tl-sm text-gray-400 flex items-center gap-2">
              <div className="flex space-x-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-gray-400 pl-1">Consulting project database...</span>
            </div>
          </div>
        )}

        {/* Error notification banner with retry */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-sm text-red-300">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            {lastFailedMessage && (
              <button
                onClick={() => handleSend(lastFailedMessage)}
                disabled={loading}
                className="bg-red-500/20 hover:bg-red-500/40 text-red-200 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 font-medium transition disabled:opacity-50"
              >
                🔄 Retry
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-white/10 bg-[#17183e]/90">
        <div className="relative flex items-end gap-2 bg-[#121333] rounded-xl border border-white/10 focus-within:border-purple-500/50 p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about tasks, deadlines, team workload, or next steps... (Enter to send, Shift+Enter for new line)"
            rows={1}
            maxLength={1000}
            disabled={loading}
            className="flex-1 bg-transparent text-white text-sm outline-none resize-none px-2 py-1 max-h-32 min-h-[36px] placeholder-gray-500 disabled:opacity-50"
          />

          <div className="flex items-center gap-2 shrink-0">
            {input.length > 700 && (
              <span className="text-[10px] text-gray-500">
                {input.length}/1000
              </span>
            )}
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-purple-500/20 flex items-center gap-1.5"
            >
              <span>Send</span>
              <span>✈</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
