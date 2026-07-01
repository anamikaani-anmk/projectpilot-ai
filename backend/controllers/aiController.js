const db = require("../config/db");
const { normalizeRow, normalizeRows, normalizeStatus } = require("../utils/normalize");

function verifyProjectOwnership(projectId, userId) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT user_id FROM projects WHERE id = ?",
      [projectId],
      (err, rows) => {
        if (err) return reject(err);
        if (!rows.length) return resolve({ ok: false, reason: "not_found" });
        const project = normalizeRow(rows[0]);
        if (project.user_id !== userId) return resolve({ ok: false, reason: "forbidden" });
        resolve({ ok: true });
      }
    );
  });
}

function generateProjectSummary(project, tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => normalizeStatus(t.status) === "done").length;
  const inProgress = tasks.filter(
    (t) => normalizeStatus(t.status) === "in_progress"
  ).length;
  const todo = tasks.filter((t) => normalizeStatus(t.status) === "todo").length;
  const progress = project.progress ?? 0;

  let summary = `${project.name} is ${progress}% complete with ${done} of ${total} tasks done.`;

  if (total === 0) {
    summary = `${project.name} has no tasks yet. Add tasks to start tracking progress.`;
  } else if (progress >= 80) {
    summary += " The project is nearing completion — great momentum!";
  } else if (progress >= 40) {
    summary += " Steady progress — keep the team focused on in-progress items.";
  } else {
    summary += " Early stage — prioritize high-impact tasks to build momentum.";
  }

  return {
    summary,
    stats: { total, done, inProgress, todo, progress },
  };
}

function detectProjectRisk(tasks) {
  const warnings = [];
  const total = tasks.length;

  if (total === 0) {
    return warnings;
  }

  const todo = tasks.filter((t) => normalizeStatus(t.status) === "todo").length;
  const inProgress = tasks.filter(
    (t) => normalizeStatus(t.status) === "in_progress"
  ).length;
  const done = tasks.filter((t) => normalizeStatus(t.status) === "done").length;
  const completionRate = Math.round((done / total) * 100);

  if (todo / total > 0.6) {
    warnings.push({
      level: "high",
      message: `${todo} tasks still in To Do — backlog may cause delays.`,
    });
  }

  if (inProgress > 0 && done === 0 && total > 3) {
    warnings.push({
      level: "medium",
      message: "Tasks stuck in progress with nothing completed yet.",
    });
  }

  if (completionRate < 25 && total >= 4) {
    warnings.push({
      level: "high",
      message: `Low completion rate (${completionRate}%) — project may be at risk.`,
    });
  }

  const highPriorityOpen = tasks.filter(
    (t) =>
      t.priority === "high" &&
      normalizeStatus(t.status) !== "done"
  ).length;

  if (highPriorityOpen >= 2) {
    warnings.push({
      level: "medium",
      message: `${highPriorityOpen} high-priority tasks still open.`,
    });
  }

  return warnings;
}

function generateTaskSuggestions(project, tasks) {
  const suggestions = [];
  const openTasks = tasks.filter((t) => normalizeStatus(t.status) !== "done");

  if (tasks.length === 0) {
    suggestions.push("Break the project into milestones and add initial tasks.");
    suggestions.push(`Define core deliverables for ${project.technology || "this stack"}.`);
    suggestions.push("Start with setup tasks: repo, environment, and database schema.");
    return suggestions;
  }

  const highOpen = openTasks.filter((t) => t.priority === "high");
  if (highOpen.length) {
    suggestions.push(`Prioritize "${highOpen[0].title}" — highest impact open task.`);
  }

  const inProgress = openTasks.filter(
    (t) => normalizeStatus(t.status) === "in_progress"
  );
  if (inProgress.length > 2) {
    suggestions.push("Too many tasks in progress — finish 1–2 before starting new ones.");
  }

  if (openTasks.length > 5) {
    suggestions.push("Break large tasks into smaller subtasks for faster wins.");
  }

  if (project.technology?.toLowerCase().includes("react")) {
    suggestions.push("Consider splitting UI work into component-level tasks.");
  }

  if (project.technology?.toLowerCase().includes("node")) {
    suggestions.push("Prioritize backend API endpoints before frontend integration.");
  }

  suggestions.push("Review tasks daily and update statuses to keep analytics accurate.");

  return suggestions.slice(0, 5);
}

const getProjectInsights = async (req, res) => {
  const { projectId } = req.params;

  try {
    const access = await verifyProjectOwnership(projectId, req.user.id);
    if (!access.ok) {
      const status = access.reason === "not_found" ? 404 : 403;
      return res.status(status).json({
        success: false,
        message: access.reason === "not_found" ? "Project not found" : "Access denied",
      });
    }

    db.query("SELECT * FROM projects WHERE id = ?", [projectId], (err, projectRows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      const project = normalizeRow(projectRows[0]);

      db.query(
        "SELECT * FROM tasks WHERE project_id = ?",
        [projectId],
        (err2, taskRows) => {
          if (err2) {
            return res.status(500).json({ success: false, message: err2.message });
          }

          const tasks = normalizeRows(taskRows).map((t) => ({
            ...t,
            status: normalizeStatus(t.status),
          }));

          const { summary, stats } = generateProjectSummary(project, tasks);
          const warnings = detectProjectRisk(tasks);
          const suggestions = generateTaskSuggestions(project, tasks);

          const health =
            warnings.some((w) => w.level === "high")
              ? "at_risk"
              : warnings.length
              ? "caution"
              : "good";

          res.json({
            success: true,
            data: {
              summary,
              stats,
              warnings,
              suggestions,
              health,
              healthLabel:
                health === "good"
                  ? "On Track"
                  : health === "caution"
                  ? "Needs Attention"
                  : "At Risk",
            },
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardStats = (req, res) => {
  const userId = req.user.id;

  db.query(
    "SELECT id, progress FROM projects WHERE user_id = ?",
    [userId],
    (err, projects) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      const projectIds = projects.map((p) => p.id);

      if (!projectIds.length) {
        return res.json({
          success: true,
          data: {
            totalProjects: 0,
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            completionRate: 0,
            projectHealth: 100,
          },
        });
      }

      const placeholders = projectIds.map(() => "?").join(",");

      db.query(
        `SELECT
           COUNT(*) AS totalTasks,
           SUM(CASE WHEN status IN ('done', 'completed') THEN 1 ELSE 0 END) AS completedTasks,
           SUM(CASE WHEN status IN ('in_progress', 'inprog') THEN 1 ELSE 0 END) AS inProgressTasks
         FROM tasks WHERE project_id IN (${placeholders})`,
        projectIds,
        (err2, stats) => {
          if (err2) {
            return res.status(500).json({ success: false, message: err2.message });
          }

          const { totalTasks, completedTasks, inProgressTasks } = stats[0];
          const total = Number(totalTasks) || 0;
          const done = Number(completedTasks) || 0;
          const inProg = Number(inProgressTasks) || 0;
          const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

          const avgProgress =
            projects.length > 0
              ? Math.round(
                  projects.reduce((sum, p) => sum + (normalizeRow(p).progress || 0), 0) /
                    projects.length
                )
              : 0;

          res.json({
            success: true,
            data: {
              totalProjects: projects.length,
              totalTasks: total,
              completedTasks: done,
              inProgressTasks: inProg,
              todoTasks: total - done - inProg,
              completionRate,
              projectHealth: avgProgress,
            },
          });
        }
      );
    }
  );
};

module.exports = { getProjectInsights, getDashboardStats };
