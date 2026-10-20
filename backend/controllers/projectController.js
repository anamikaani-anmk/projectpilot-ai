const db = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { normalizeRow, normalizeRows } = require("../utils/normalize");

function generateJoinCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

/** Check if a user is a member of a project and get their role ('head' | 'member' | null) */
function getMemberRole(projectId, userId, callback) {
  const numericUserId = Number(userId);

  db.query(
    `SELECT p.user_id AS creator_id, pm.role 
     FROM projects p 
     LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ? 
     WHERE p.id = ?`,
    [numericUserId, projectId],
    (err, rows) => {
      if (err) {
        // Fallback query if project_members table does not exist yet
        db.query(
          "SELECT user_id AS creator_id FROM projects WHERE id = ?",
          [projectId],
          (err2, pRows) => {
            if (err2) return callback(err2);
            if (!pRows.length) return callback(null, null, "not_found");
            const creatorId = Number(normalizeRow(pRows[0]).creator_id);
            if (creatorId === numericUserId) {
              return callback(null, "head");
            }
            return callback(null, null, "forbidden");
          }
        );
        return;
      }

      if (!rows.length) return callback(null, null, "not_found");

      const row = normalizeRow(rows[0]);
      const creatorId = Number(row.creator_id);

      if (creatorId === numericUserId) {
        // Creator is ALWAYS head of their project
        if (row.role !== "head") {
          db.query(
            "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'head') ON DUPLICATE KEY UPDATE role = 'head'",
            [projectId, numericUserId],
            () => {}
          );
        }
        return callback(null, "head");
      }

      if (row.role) {
        return callback(null, row.role);
      }

      callback(null, null, "forbidden");
    }
  );
}

const createProject = async (req, res) => {
  const { name, description, technology, join_password } = req.body;
  const user_id = req.user.id;

  if (!name?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Project name is required",
    });
  }

  const joinCode = generateJoinCode();
  let joinPasswordHash = null;

  if (join_password && join_password.trim()) {
    try {
      joinPasswordHash = await bcrypt.hash(join_password.trim(), 10);
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  db.query(
    "INSERT INTO projects (user_id, name, description, technology, join_code, join_password_hash) VALUES (?, ?, ?, ?, ?, ?)",
    [user_id, name.trim(), description || "", technology || "", joinCode, joinPasswordHash],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      const projectId = result.insertId;

      // Insert creator as 'head' in project_members
      db.query(
        "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'head')",
        [projectId, user_id],
        (err2) => {
          if (err2) {
            return res.status(500).json({
              success: false,
              message: err2.message,
            });
          }

          db.query(
            "SELECT * FROM projects WHERE id = ?",
            [projectId],
            (err3, rows) => {
              if (err3) {
                return res.status(500).json({
                  success: false,
                  message: err3.message,
                });
              }

              const project = normalizeRow(rows[0]);
              project.user_role = "head";
              res.status(201).json({
                success: true,
                message: "Project created successfully",
                data: project,
              });
            }
          );
        }
      );
    }
  );
};

const getProjects = (req, res) => {
  const user_id = Number(req.user.id);

  const sql = `
    SELECT 
      p.*, 
      CASE 
        WHEN p.user_id = ? THEN 'head' 
        ELSE COALESCE(pm.role, 'member') 
      END AS user_role
    FROM projects p
    LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
    WHERE p.user_id = ? OR pm.user_id = ?
    ORDER BY p.created_at DESC
  `;

  db.query(sql, [user_id, user_id, user_id, user_id], (err, result) => {
    if (err) {
      db.query(
        "SELECT *, 'head' AS user_role FROM projects WHERE user_id = ? ORDER BY created_at DESC",
        [user_id],
        (err2, fallbackResult) => {
          if (err2) {
            return res.status(500).json({ success: false, message: err2.message });
          }
          return res.json({ success: true, data: normalizeRows(fallbackResult) });
        }
      );
      return;
    }

    res.json({ success: true, data: normalizeRows(result) });
  });
};

const getProjectById = (req, res) => {
  const { id } = req.params;

  getMemberRole(id, req.user.id, (err, role, reason) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    if (reason === "not_found") {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (!role) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    db.query("SELECT * FROM projects WHERE id = ?", [id], (err2, result) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }

      if (!result.length) {
        return res.status(404).json({ success: false, message: "Project not found" });
      }

      const project = normalizeRow(result[0]);
      project.user_role = role;
      project.has_join_password = Boolean(project.join_password_hash);

      if (!project.join_code) {
        const newCode = generateJoinCode();
        project.join_code = newCode;
        db.query("UPDATE projects SET join_code = ? WHERE id = ?", [newCode, id]);
      }

      // Hide hash from output
      delete project.join_password_hash;

      res.json({ success: true, data: project });
    });
  });
};

const updateProject = (req, res) => {
  const { id } = req.params;
  const { name, description, technology } = req.body;

  getMemberRole(id, req.user.id, (err, role, reason) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (reason === "not_found") return res.status(404).json({ success: false, message: "Project not found" });
    if (role !== "head") return res.status(403).json({ success: false, message: "Access denied: Only project Head can update project" });

    db.query(
      `UPDATE projects SET name = ?, description = ?, technology = ? WHERE id = ?`,
      [name, description, technology, id],
      (err2) => {
        if (err2) return res.status(500).json({ success: false, message: err2.message });

        db.query("SELECT * FROM projects WHERE id = ?", [id], (err3, rows) => {
          if (err3) return res.status(500).json({ success: false, message: err3.message });
          const project = normalizeRow(rows[0]);
          project.user_role = "head";
          res.json({
            success: true,
            message: "Project updated successfully",
            data: project,
          });
        });
      }
    );
  });
};

const deleteProject = (req, res) => {
  const { id } = req.params;

  getMemberRole(id, req.user.id, (err, role, reason) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (reason === "not_found") return res.status(404).json({ success: false, message: "Project not found" });
    if (role !== "head") return res.status(403).json({ success: false, message: "Access denied: Only project Head can delete project" });

    db.query("DELETE FROM projects WHERE id = ?", [id], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: err2.message });
      res.json({ success: true, message: "Project deleted successfully" });
    });
  });
};

const joinProject = (req, res) => {
  const { join_code, password } = req.body;
  const user_id = req.user.id;

  if (!join_code?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Join code is required",
    });
  }

  const cleanCode = join_code.trim().toUpperCase();

  db.query(
    "SELECT * FROM projects WHERE join_code = ?",
    [cleanCode],
    async (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      if (!rows.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid join code",
        });
      }

      const project = normalizeRow(rows[0]);

      // Check password if set
      if (project.join_password_hash) {
        if (!password) {
          return res.status(400).json({
            success: false,
            message: "Password is required for this project",
          });
        }

        const isMatch = await bcrypt.compare(password, project.join_password_hash);
        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: "Incorrect project password",
          });
        }
      }

      // Check if already a member
      db.query(
        "SELECT * FROM project_members WHERE project_id = ? AND user_id = ?",
        [project.id, user_id],
        (err2, mRows) => {
          if (err2) {
            return res.status(500).json({ success: false, message: err2.message });
          }

          if (mRows.length > 0) {
            return res.status(400).json({
              success: false,
              message: "You are already a member of this project",
            });
          }

          // Insert into project_members
          db.query(
            "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
            [project.id, user_id],
            (err3) => {
              if (err3) {
                return res.status(500).json({ success: false, message: err3.message });
              }

              project.user_role = "member";
              delete project.join_password_hash;

              res.status(200).json({
                success: true,
                message: "Successfully joined project!",
                data: project,
              });
            }
          );
        }
      );
    }
  );
};

const getProjectMembers = (req, res) => {
  const { id } = req.params;

  getMemberRole(id, req.user.id, (err, role) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!role) return res.status(403).json({ success: false, message: "Access denied" });

    const sql = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        pm.role, 
        pm.joined_at,
        COUNT(t.id) AS total_assigned_tasks,
        SUM(CASE WHEN t.status IN ('done', 'completed') THEN 1 ELSE 0 END) AS completed_assigned_tasks
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN tasks t ON t.project_id = pm.project_id AND t.assigned_to = u.id
      WHERE pm.project_id = ?
      GROUP BY u.id, u.name, u.email, pm.role, pm.joined_at
      ORDER BY FIELD(pm.role, 'head', 'member'), u.name ASC
    `;

    db.query(sql, [id], (err2, rows) => {
      if (err2) {
        return res.status(500).json({ success: false, message: err2.message });
      }

      res.json({ success: true, data: normalizeRows(rows) });
    });
  });
};

const removeProjectMember = (req, res) => {
  const { id, userId } = req.params;

  getMemberRole(id, req.user.id, (err, role) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (role !== "head") {
      return res.status(403).json({
        success: false,
        message: "Only project Head can remove members",
      });
    }

    if (Number(userId) === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "Head cannot remove themselves from the project",
      });
    }

    // Remove from project_members
    db.query(
      "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
      [id, userId],
      (err2) => {
        if (err2) {
          return res.status(500).json({ success: false, message: err2.message });
        }

        // Unassign member from tasks in this project
        db.query(
          "UPDATE tasks SET assigned_to = NULL WHERE project_id = ? AND assigned_to = ?",
          [id, userId],
          (err3) => {
            if (err3) {
              return res.status(500).json({ success: false, message: err3.message });
            }

            res.json({
              success: true,
              message: "Member removed from project",
            });
          }
        );
      }
    );
  });
};

const updateJoinPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  getMemberRole(id, req.user.id, (err, role) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (role !== "head") {
      return res.status(403).json({
        success: false,
        message: "Only project Head can update join password",
      });
    }

    let hash = null;
    if (password && password.trim()) {
      hash = bcrypt.hashSync(password.trim(), 10);
    }

    db.query(
      "UPDATE projects SET join_password_hash = ? WHERE id = ?",
      [hash, id],
      (err2) => {
        if (err2) return res.status(500).json({ success: false, message: err2.message });

        res.json({
          success: true,
          message: password ? "Join password set successfully" : "Join password removed",
          has_join_password: Boolean(hash),
        });
      }
    );
  });
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  joinProject,
  getProjectMembers,
  removeProjectMember,
  updateJoinPassword,
  getMemberRole,
};

