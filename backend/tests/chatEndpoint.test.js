require("dotenv").config();

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../controllers/projectController", () => ({
  getMemberRole: jest.fn(),
}));

jest.mock("../services/geminiInsights", () => ({
  ...jest.requireActual("../services/geminiInsights"),
  askProjectPilotChat: jest.fn(),
}));

const db = require("../config/db");
const { getMemberRole } = require("../controllers/projectController");
const { askProjectPilotChat } = require("../services/geminiInsights");
const { chatWithProjectAI } = require("../controllers/aiController");

function callChatController(req, res) {
  return new Promise((resolve) => {
    let statusCode = 200;
    res.status.mockImplementation((code) => {
      statusCode = code;
      return res;
    });
    res.json.mockImplementation((payload) => {
      resolve({ statusCode, payload });
      return res;
    });
    chatWithProjectAI(req, res);
  });
}

describe("POST /api/ai/project/:projectId/chat Controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { projectId: "42" },
      user: { id: 7 },
      body: {
        message: "What tasks are overdue?",
        history: [],
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  test("rejects request if message is missing or empty", async () => {
    req.body.message = "   ";
    const { statusCode, payload } = await callChatController(req, res);

    expect(statusCode).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.message).toMatch(/message is required/i);
  });

  test("rejects request if message exceeds 1000 characters", async () => {
    req.body.message = "a".repeat(1001);
    const { statusCode, payload } = await callChatController(req, res);

    expect(statusCode).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.message).toMatch(/exceeds maximum length/i);
  });

  test("returns 404 if project is not found", async () => {
    getMemberRole.mockImplementation((projectId, userId, cb) => {
      cb(null, null, "not_found");
    });

    const { statusCode, payload } = await callChatController(req, res);

    expect(statusCode).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.message).toBe("Project not found");
  });

  test("returns 403 if user is not a member or head of project", async () => {
    getMemberRole.mockImplementation((projectId, userId, cb) => {
      cb(null, null, "forbidden");
    });

    const { statusCode, payload } = await callChatController(req, res);

    expect(statusCode).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.message).toBe("Access denied");
  });

  test("successfully answers grounded chat query when authorized", async () => {
    getMemberRole.mockImplementation((projectId, userId, cb) => {
      cb(null, "member");
    });

    // Mock project query
    db.query
      .mockImplementationOnce((sql, params, cb) => {
        cb(null, [{ id: 42, name: "Alpha", progress: 60, technology: "Node/React" }]);
      })
      // Mock tasks query
      .mockImplementationOnce((sql, params, cb) => {
        cb(null, [
          {
            id: 1,
            title: "Setup Auth",
            status: "done",
            priority: "high",
            due_date: "2026-10-01",
            assignee_name: "Alice",
          },
        ]);
      })
      // Mock members query
      .mockImplementationOnce((sql, params, cb) => {
        cb(null, [{ name: "Alice", role: "member" }]);
      });

    askProjectPilotChat.mockResolvedValueOnce({
      answer: "Task 'Setup Auth' is already completed by Alice. No tasks are currently overdue.",
    });

    const { statusCode, payload } = await callChatController(req, res);

    expect(statusCode).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.answer).toContain("Setup Auth");
    expect(payload.data.timestamp).toBeDefined();
    expect(askProjectPilotChat).toHaveBeenCalledTimes(1);
    expect(askProjectPilotChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "What tasks are overdue?",
        history: [],
      })
    );
  });

  test("returns 503 fallback when Gemini times out or throws error", async () => {
    getMemberRole.mockImplementation((projectId, userId, cb) => {
      cb(null, "head");
    });

    db.query
      .mockImplementationOnce((sql, params, cb) => {
        cb(null, [{ id: 42, name: "Beta", progress: 10 }]);
      })
      .mockImplementationOnce((sql, params, cb) => {
        cb(null, []);
      })
      .mockImplementationOnce((sql, params, cb) => {
        cb(null, []);
      });

    askProjectPilotChat.mockRejectedValueOnce(new Error("Gemini AI request timed out after 10 seconds"));

    const { statusCode, payload } = await callChatController(req, res);

    expect(statusCode).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.message).toContain("AI chat is temporarily unavailable");
  });
});
