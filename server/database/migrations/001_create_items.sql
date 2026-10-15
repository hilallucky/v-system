CREATE TABLE IF NOT EXISTS bc_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  parent_id CHAR(36) NULL,
  name VARCHAR(180) NOT NULL,
  kind ENUM('folder', 'file') NOT NULL,
  mime_type VARCHAR(255) NULL,
  size BIGINT UNSIGNED NULL,
  modified_at VARCHAR(30) NOT NULL,
  owner VARCHAR(120) NOT NULL,
  status ENUM('Approved', 'In review', 'Ready') NOT NULL DEFAULT 'Approved',
  starred TINYINT(1) NOT NULL DEFAULT 0,
  shared TINYINT(1) NOT NULL DEFAULT 0,
  stored_name VARCHAR(255) NULL,
  UNIQUE KEY bc_items_parent_name_idx (parent_id, name),
  KEY bc_items_modified_idx (modified_at),
  KEY bc_items_starred_idx (starred),
  KEY bc_items_shared_idx (shared),
  CONSTRAINT bc_items_parent_fk FOREIGN KEY (parent_id) REFERENCES bc_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
