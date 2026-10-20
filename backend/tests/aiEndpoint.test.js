require("dotenv").config();
const { cache } = require("../services/geminiInsights");

// Mock db for testing aiController getProjectInsights
jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../controllers/projectController", () => ({
  getMemberRole: jest.fn((projectId, userId, cb) => cb(null, "member")),
}));

const db = require("../config/db");
const { getProjectInsights } = require("../controllers/aiController");

function runController(req, res) {
  return new Promise((resolve) => {
    res.json.mockImplementation((payload) => {
      resolve(payload);
      return res;
    });
    res.status.mockImplementation((code) => {
      return res;
    });
    getProjectInsights(req, res);
  });
}

describe("aiController getProjectInsights", () => {
  let req, res;

  beforeEach(() => {
    cache.clear();
    req = {
      params: { projectId: "1" },
      user: { id: 1 },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  test("returns Gemini insights with source='gemini' on success", async () => {
    // Mock project row
    db.query
      .mockImplementationOnce((sql, params, cb) => {
        cb(null, [{ id: 1, name: "Test Project", progress: 50, technology: "React" }]);
      })
      // Mock tasks row
      .mockImplementationOnce((sql, params, cb) => {
        cb(null, [
          {
            id: 10,
            title: "Task 1",
            status: "in_progress",
            priority: "high",
            due_date: "2026-11-01",
            assignee_name: "Alice",
          },
          {
            id: 11,
            title: "Task 2",
            status: "done",
            priority: "medium",
            due_date: "2026-10-30",
            assignee_name: "Bob",
          },
        ]);
      });

    const payload = await runController(req, res);

    expect(payload).toBeDefined();
    expect(payload.success).toBe(true);
    expect(payload.data.source).toBe("gemini");
    expect(payload.data.stats).toEqual({
      total: 2,
      done: 1,
      inProgress: 1,
      todo: 0,
      progress: 50,
    });
    expect(payload.data.summary).toBeDefined();
    expect(Array.isArray(payload.data.warnings)).toBe(true);
    expect(Array.isArray(payload.data.suggestions)).toBe(true);
    expect(payload.data.health).toBeDefined();
    expect(payload.data.healthLabel).toBeDefined();
  }, 15000);

  test("gracefully falls back to rule-based insights on AI failure without throwing 500", async () => {
    const origKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "invalid_key_to_force_failure";

    try {
      db.query
        .mockImplementationOnce((sql, params, cb) => {
          cb(null, [{ id: 1, name: "Fallback Project", progress: 20 }]);
        })
        .mockImplementationOnce((sql, params, cb) => {
          cb(null, [
            { id: 20, title: "Do work", status: "todo", priority: "high", assignee_name: "Charlie" },
          ]);
        });

      const payload = await runController(req, res);

      expect(payload).toBeDefined();
      expect(payload.success).toBe(true);
      expect(payload.data.source).toBe("rule-based");
      expect(payload.data.summary).toContain("Fallback Project");
      expect(payload.data.stats.total).toBe(1);
      expect(payload.data.stats.todo).toBe(1);
      expect(payload.data.health).toBeDefined();
      expect(payload.data.healthLabel).toBeDefined();
    } finally {
      process.env.GEMINI_API_KEY = origKey;
    }
  });
});
