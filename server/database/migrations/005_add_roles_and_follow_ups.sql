CREATE TABLE IF NOT EXISTS bc_follow_ups (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_by CHAR(36) NOT NULL,
  assigned_to CHAR(36) NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
  due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY bc_follow_ups_creator_idx (created_by),
  KEY bc_follow_ups_assignee_idx (assigned_to),
  KEY bc_follow_ups_status_idx (status),
  CONSTRAINT bc_follow_ups_creator_fk FOREIGN KEY (created_by) REFERENCES bc_users(id) ON DELETE CASCADE,
  CONSTRAINT bc_follow_ups_assignee_fk FOREIGN KEY (assigned_to) REFERENCES bc_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE bc_users
  ADD COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user' AFTER email;
