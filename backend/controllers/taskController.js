const db = require("../config/db");
const { normalizeRow, normalizeRows, normalizeStatus } = require("../utils/normalize");

const VALID_STATUSES = ["todo", "in_progress", "done"];

function verifyProjectOwnership(projectId, userId, callback) {
  db.query(
    "SELECT user_id FROM projects WHERE id = ?",
    [projectId],
    (err, rows) => {
      if (err) return callback(err);
      if (!rows.length) return callback(null, false, "not_found");
      const project = normalizeRow(rows[0]);
      if (project.user_id !== userId) return callback(null, false, "forbidden");
      callback(null, true);
    }
  );
}

function updateProjectProgress(project_id) {
  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status IN ('done', 'completed') THEN 1 ELSE 0 END) AS done
    FROM tasks
    WHERE project_id = ?
  `;

  db.query(sql, [project_id], (err, result) => {
    if (err) return console.error("Progress update error:", err);
    const { total, done } = result[0];
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    db.query("UPDATE projects SET progress = ? WHERE id = ?", [
      progress,
      project_id,
    ]);
  });
}

function formatTask(row) {
  const task = normalizeRow(row);
  task.status = normalizeStatus(task.status);
  return task;
}

const getTasks = (req, res) => {
  const project_id = req.params.project_id;

  verifyProjectOwnership(project_id, req.user.id, (err, owned, reason) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (reason === "not_found") {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    if (!owned) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    db.query(
      "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC",
      [project_id],
      (err2, result) => {
        if (err2) {
          return res.status(500).json({ success: false, message: err2.message });
        }
        res.json({ success: true, data: result.map(formatTask) });
      }
    );
  });
};

const createTask = (req, res) => {
  const {
    project_id,
    title,
    description,
    priority = "medium",
    due_date,
    assigned_to,
  } = req.body;

  if (!project_id) {
    return res.status(400).json({
      success: false,
      message: "project_id is required",
    });
  }

  if (!title?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Title is required",
    });
  }

  verifyProjectOwnership(project_id, req.user.id, (err, owned, reason) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (reason === "not_found") {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    if (!owned) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    db.query(
      `INSERT INTO tasks (project_id, title, description, status, priority, due_date, assigned_to)
       VALUES (?, ?, ?, 'todo', ?, ?, ?)`,
      [
        project_id,
        title.trim(),
        description || "",
        priority,
        due_date || null,
        assigned_to || null,
      ],
      (err2, result) => {
        if (err2) {
          return res.status(500).json({ success: false, message: err2.message });
        }

        db.query(
          "SELECT * FROM tasks WHERE id = ?",
          [result.insertId],
          (err3, rows) => {
            if (err3) {
              return res.status(500).json({ success: false, message: err3.message });
            }
            updateProjectProgress(project_id);
            res.status(201).json({ success: true, data: formatTask(rows[0]) });
          }
        );
      }
    );
  });
};

const updateTask = (req, res) => {
  const { id } = req.params;
  const { title, description, priority, due_date, assigned_to, status } = req.body;

  db.query("SELECT * FROM tasks WHERE id = ?", [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const existing = formatTask(rows[0]);

    verifyProjectOwnership(existing.project_id, req.user.id, (err2, owned, reason) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }
      if (!owned) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      const nextStatus = status ? normalizeStatus(status) : existing.status;
      if (status && !VALID_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }

      db.query(
        `UPDATE tasks
         SET title = ?, description = ?, priority = ?, due_date = ?, assigned_to = ?, status = ?
         WHERE id = ?`,
        [
          title?.trim() || existing.title,
          description ?? existing.description,
          priority || existing.priority,
          due_date ?? existing.due_date,
          assigned_to ?? existing.assigned_to,
          nextStatus,
          id,
        ],
        (err3) => {
          if (err3) {
            return res.status(500).json({ success: false, message: err3.message });
          }

          updateProjectProgress(existing.project_id);

          db.query("SELECT * FROM tasks WHERE id = ?", [id], (err4, updated) => {
            if (err4) {
              return res.status(500).json({ success: false, message: err4.message });
            }
            res.json({ success: true, data: formatTask(updated[0]) });
          });
        }
      );
    });
  });
};

const updateTaskStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const nextStatus = normalizeStatus(status);

  if (!VALID_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  db.query("SELECT project_id FROM tasks WHERE id = ?", [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const project_id = normalizeRow(rows[0]).project_id;

    verifyProjectOwnership(project_id, req.user.id, (err2, owned) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }
      if (!owned) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      db.query(
        "UPDATE tasks SET status = ? WHERE id = ?",
        [nextStatus, id],
        (err3) => {
          if (err3) {
            return res.status(500).json({ success: false, message: err3.message });
          }

          db.query(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status IN ('done', 'completed') THEN 1 ELSE 0 END) AS done
             FROM tasks WHERE project_id = ?`,
            [project_id],
            (err4, result) => {
              if (err4) {
                return res.status(500).json({ success: false, message: err4.message });
              }
              const { total, done } = result[0];
              const progress = total > 0 ? Math.round((done / total) * 100) : 0;

              db.query(
                "UPDATE projects SET progress = ? WHERE id = ?",
                [progress, project_id],
                () => {
                  res.json({ success: true, progress, status: nextStatus });
                }
              );
            }
          );
        }
      );
    });
  });
};

const deleteTask = (req, res) => {
  const { id } = req.params;

  db.query("SELECT project_id FROM tasks WHERE id = ?", [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const project_id = normalizeRow(rows[0]).project_id;

    verifyProjectOwnership(project_id, req.user.id, (err2, owned) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }
      if (!owned) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      db.query("DELETE FROM tasks WHERE id = ?", [id], (err3) => {
        if (err3) {
          return res.status(500).json({ success: false, message: err3.message });
        }
        updateProjectProgress(project_id);
        res.json({ success: true, message: "Task deleted" });
      });
    });
  });
};

module.exports = {
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
};
