RENAME TABLE bc_users TO others_users, bc_sessions TO others_sessions;

CREATE TABLE bc_user_roles (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  CONSTRAINT bc_user_roles_user_fk
    FOREIGN KEY (user_id) REFERENCES others_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO bc_user_roles (user_id, role)
SELECT id, role FROM others_users;

ALTER TABLE others_users DROP COLUMN role;
