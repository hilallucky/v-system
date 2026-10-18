ALTER TABLE bc_users
  ADD COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user' AFTER email;
