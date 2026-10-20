const db = require("../config/db");
const { normalizeRow, normalizeStatus } = require("../utils/normalize");
const { getMemberRole } = require("./projectController");

const VALID_STATUSES = ["todo", "in_progress", "done"];

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
  if (task.assigned_to) {
    task.assigned_to = Number(task.assigned_to);
  } else {
    task.assigned_to = null;
  }
  return task;
}

const getTasks = (req, res) => {
  const project_id = req.params.project_id;

  getMemberRole(project_id, req.user.id, (err, role, reason) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (reason === "not_found") {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    if (!role) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const sql = `
      SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = ?
      ORDER BY t.created_at ASC
    `;

    db.query(sql, [project_id], (err2, result) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }
      res.json({ success: true, data: result.map(formatTask) });
    });
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

  getMemberRole(project_id, req.user.id, (err, role, reason) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (reason === "not_found") {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    if (!role) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let finalAssignedTo = null;
    if (role === "member") {
      // Member can only create tasks assigned to themselves
      if (assigned_to && Number(assigned_to) !== Number(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "Members can only create tasks assigned to themselves",
        });
      }
      finalAssignedTo = req.user.id;
    } else {
      // Head can assign to anyone or leave null
      finalAssignedTo = assigned_to ? Number(assigned_to) : null;
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
        finalAssignedTo,
      ],
      (err2, result) => {
        if (err2) {
          return res.status(500).json({ success: false, message: err2.message });
        }

        const sql = `
          SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
          FROM tasks t
          LEFT JOIN users u ON t.assigned_to = u.id
          WHERE t.id = ?
        `;

        db.query(sql, [result.insertId], (err3, rows) => {
          if (err3) {
            return res.status(500).json({ success: false, message: err3.message });
          }
          updateProjectProgress(project_id);
          res.status(201).json({ success: true, data: formatTask(rows[0]) });
        });
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

    getMemberRole(existing.project_id, req.user.id, (err2, role) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }
      if (!role) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      let finalAssignedTo = existing.assigned_to;

      if (role === "member") {
        // Member can only edit tasks assigned to themselves
        if (Number(existing.assigned_to) !== Number(req.user.id)) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: Members can only edit tasks assigned to themselves",
          });
        }
        if (assigned_to !== undefined && Number(assigned_to) !== Number(req.user.id)) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: Members cannot reassign tasks to others",
          });
        }
        finalAssignedTo = req.user.id;
      } else {
        // Head role
        if (assigned_to !== undefined) {
          finalAssignedTo = assigned_to ? Number(assigned_to) : null;
        }
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
          finalAssignedTo,
          nextStatus,
          id,
        ],
        (err3) => {
          if (err3) {
            return res.status(500).json({ success: false, message: err3.message });
          }

          updateProjectProgress(existing.project_id);

          const sql = `
            SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.id = ?
          `;

          db.query(sql, [id], (err4, updated) => {
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

  db.query("SELECT * FROM tasks WHERE id = ?", [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const existing = formatTask(rows[0]);

    getMemberRole(existing.project_id, req.user.id, (err2, role) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }
      if (!role) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      if (role === "member" && Number(existing.assigned_to) !== Number(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Members can only update status of tasks assigned to themselves",
        });
      }

      db.query(
        "UPDATE tasks SET status = ? WHERE id = ?",
        [nextStatus, id],
        (err3) => {
          if (err3) {
            return res.status(500).json({ success: false, message: err3.message });
          }

          updateProjectProgress(existing.project_id);

          db.query(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status IN ('done', 'completed') THEN 1 ELSE 0 END) AS done
             FROM tasks WHERE project_id = ?`,
            [existing.project_id],
            (err4, result) => {
              if (err4) {
                return res.status(500).json({ success: false, message: err4.message });
              }
              const { total, done } = result[0];
              const progress = total > 0 ? Math.round((done / total) * 100) : 0;

              res.json({ success: true, progress, status: nextStatus });
            }
          );
        }
      );
    });
  });
};

const deleteTask = (req, res) => {
  const { id } = req.params;

  db.query("SELECT * FROM tasks WHERE id = ?", [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const existing = formatTask(rows[0]);

    getMemberRole(existing.project_id, req.user.id, (err2, role) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }
      if (!role) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      if (role === "member" && Number(existing.assigned_to) !== Number(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Members can only delete tasks assigned to themselves",
        });
      }

      db.query("DELETE FROM tasks WHERE id = ?", [id], (err3) => {
        if (err3) {
          return res.status(500).json({ success: false, message: err3.message });
        }
        updateProjectProgress(existing.project_id);
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

