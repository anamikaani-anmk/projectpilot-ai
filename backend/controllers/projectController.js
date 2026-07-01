const db = require("../config/db");
const { normalizeRow, normalizeRows } = require("../utils/normalize");

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

const createProject = (req, res) => {
  const { name, description, technology } = req.body;
  const user_id = req.user.id;

  if (!name?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Project name is required",
    });
  }

  db.query(
    "INSERT INTO projects (user_id, name, description, technology) VALUES (?, ?, ?, ?)",
    [user_id, name.trim(), description || "", technology || ""],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      db.query(
        "SELECT * FROM projects WHERE id = ?",
        [result.insertId],
        (err2, rows) => {
          if (err2) {
            return res.status(500).json({
              success: false,
              message: err2.message,
            });
          }

          res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: normalizeRow(rows[0]),
          });
        }
      );
    }
  );
};

const getProjects = (req, res) => {
  const user_id = req.user.id;

  db.query(
    "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC",
    [user_id],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      res.json({ success: true, data: normalizeRows(result) });
    }
  );
};

const getProjectById = (req, res) => {
  const { id } = req.params;

  db.query("SELECT * FROM projects WHERE id = ?", [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (!result.length) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = normalizeRow(result[0]);

    if (project.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({ success: true, data: project });
  });
};

const updateProject = (req, res) => {
  const { id } = req.params;
  const { name, description, technology } = req.body;

  verifyProjectOwnership(id, req.user.id, (err, owned, reason) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (reason === "not_found") {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (!owned) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    db.query(
      `UPDATE projects SET name = ?, description = ?, technology = ? WHERE id = ?`,
      [name, description, technology, id],
      (err2) => {
        if (err2) {
          return res.status(500).json({
            success: false,
            message: err2.message,
          });
        }

        db.query(
          "SELECT * FROM projects WHERE id = ?",
          [id],
          (err3, rows) => {
            if (err3) {
              return res.status(500).json({
                success: false,
                message: err3.message,
              });
            }

            res.json({
              success: true,
              message: "Project updated successfully",
              data: normalizeRow(rows[0]),
            });
          }
        );
      }
    );
  });
};

const deleteProject = (req, res) => {
  const { id } = req.params;

  verifyProjectOwnership(id, req.user.id, (err, owned, reason) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }

    if (reason === "not_found") {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (!owned) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    db.query("DELETE FROM projects WHERE id = ?", [id], (err2) => {
      if (err2) {
        return res.status(500).json({
          success: false,
          message: err2.message,
        });
      }

      res.json({
        success: true,
        message: "Project deleted successfully",
      });
    });
  });
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
};
