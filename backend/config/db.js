const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "user_auth",
  waitForConnections: true,
  connectionLimit: 10,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.log("Database connection failed");
    console.log(err);
  } else {
    console.log("Database connected");
    autoMigrate(connection);
    connection.release();
  }
});

function autoMigrate(connection) {
  // 1. Create project_members table if not exists
  const createMembersTable = `
    CREATE TABLE IF NOT EXISTS project_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      role ENUM('head', 'member') NOT NULL DEFAULT 'member',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_project_user (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  connection.query(createMembersTable, (err) => {
    if (err && err.code !== "ER_TABLE_EXISTS_ERROR") {
      console.log("Auto-migration project_members note:", err.message);
    }

    // 2. Add columns join_code and join_password_hash to projects if missing
    connection.query("SHOW COLUMNS FROM projects LIKE 'join_code'", (err2, rows) => {
      if (!err2 && rows.length === 0) {
        connection.query(
          "ALTER TABLE projects ADD COLUMN join_code VARCHAR(10) UNIQUE DEFAULT NULL, ADD COLUMN join_password_hash VARCHAR(255) DEFAULT NULL",
          (err3) => {
            if (err3) console.log("Auto-migration projects columns note:", err3.message);
          }
        );
      }
    });

    // 3. Modify tasks.assigned_to to INT NULL if needed
    connection.query("SHOW COLUMNS FROM tasks LIKE 'assigned_to'", (err4, rows2) => {
      if (!err4 && rows2.length > 0) {
        const colType = String(rows2[0].Type || rows2[0].type || "").toLowerCase();
        if (colType.includes("varchar")) {
          connection.query("ALTER TABLE tasks MODIFY COLUMN assigned_to INT NULL", (err5) => {
            if (err5) console.log("Auto-migration tasks assigned_to note:", err5.message);
          });
        }
      }
    });

    // 4. Auto-populate project_members with existing project creators as 'head'
    connection.query(
      "INSERT IGNORE INTO project_members (project_id, user_id, role) SELECT id, user_id, 'head' FROM projects",
      (err6) => {
        if (err6 && err6.code !== "ER_BAD_TABLE_ERROR") {
          console.log("Auto-migration project_members populate note:", err6.message);
        }
      }
    );
  });
}

module.exports = pool;
