ALTER TABLE users
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

CREATE TABLE bc_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  KEY bc_notifications_user_created_idx (user_id, created_at),
  KEY bc_notifications_user_read_idx (user_id, read_at),
  CONSTRAINT bc_notifications_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT bc_notifications_item_fk
    FOREIGN KEY (item_id) REFERENCES bc_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
