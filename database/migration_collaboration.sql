-- Migration Script for Existing ProjectPilot AI Databases
-- Run this script on your existing MySQL/MariaDB database to enable Collaboration without losing data.

USE user_auth;

-- 1. Create project_members table
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

-- 2. Add join_code and join_password_hash columns to projects (if not existing)
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS join_code VARCHAR(10) UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS join_password_hash VARCHAR(255) DEFAULT NULL;

-- 3. Modify tasks.assigned_to to INT NULL
ALTER TABLE tasks MODIFY COLUMN assigned_to INT NULL;

-- 4. Insert existing project creators into project_members as 'head'
INSERT IGNORE INTO project_members (project_id, user_id, role)
SELECT id, user_id, 'head' FROM projects;

-- 5. Generate random 8-character join_code for existing projects missing a join_code
UPDATE projects 
SET join_code = UPPER(SUBSTRING(MD5(CONCAT(id, RAND(), NOW())), 1, 8))
WHERE join_code IS NULL OR join_code = '';
