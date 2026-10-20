require("dotenv").config();
const {
  generateGeminiInsights,
  computeTaskHash,
  cache,
} = require("../services/geminiInsights");

describe("AI Insights Service", () => {
  const sampleProject = {
    id: 1,
    name: "ProjectPilot AI",
    description: "AI powered project management platform",
    technology: "React, Node, MySQL",
    progress: 60,
  };

  const sampleTasks = [
    {
      id: 1,
      title: "Create Login Page",
      status: "done",
      priority: "medium",
      due_date: "2026-06-09",
      assignee_name: "Anamika",
    },
    {
      id: 2,
      title: "Build AI Assistant",
      status: "in_progress",
      priority: "high",
      due_date: "2026-06-30",
      assignee_name: "Anamika",
    },
    {
      id: 3,
      title: "Build Kanban Board UI",
      status: "todo",
      priority: "medium",
      due_date: "2026-07-05",
      assignee_name: "Unassigned",
    },
  ];

  beforeEach(() => {
    cache.clear();
  });

  test("computes deterministic hash for identical task data", () => {
    const hash1 = computeTaskHash(sampleTasks);
    const hash2 = computeTaskHash([...sampleTasks]);
    expect(hash1).toBe(hash2);

    const modifiedTasks = sampleTasks.map((t) =>
      t.id === 3 ? { ...t, status: "done" } : t
    );
    const hash3 = computeTaskHash(modifiedTasks);
    expect(hash3).not.toBe(hash1);
  });

  test("calls Gemini and returns valid structure matching required shape", async () => {
    const result = await generateGeminiInsights({
      project: sampleProject,
      tasks: sampleTasks,
    });

    expect(result).toBeDefined();
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(10);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(["good", "caution", "at_risk"]).toContain(result.health);
    expect(["On Track", "Needs Attention", "At Risk"]).toContain(result.healthLabel);
  }, 15000);

  test("uses in-memory cache for consecutive requests with same tasks", async () => {
    const firstCall = await generateGeminiInsights({
      project: sampleProject,
      tasks: sampleTasks,
    });

    // Check cache is populated
    expect(cache.size).toBe(1);

    // Spy or measure fast retrieval from cache
    const start = Date.now();
    const secondCall = await generateGeminiInsights({
      project: sampleProject,
      tasks: sampleTasks,
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50); // should be instant from memory
    expect(secondCall).toEqual(firstCall);
  }, 15000);

  test("throws error if GEMINI_API_KEY is missing", async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      await expect(
        generateGeminiInsights({
          project: sampleProject,
          tasks: sampleTasks,
        })
      ).rejects.toThrow("GEMINI_API_KEY is not configured");
    } finally {
      process.env.GEMINI_API_KEY = origKey;
    }
  });
});
