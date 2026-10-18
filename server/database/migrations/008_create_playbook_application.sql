CREATE TABLE IF NOT EXISTS pb_ranks (
  rank_code VARCHAR(10) NOT NULL PRIMARY KEY,
  rank_name VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_products (
  product_code VARCHAR(20) NOT NULL PRIMARY KEY,
  product_name VARCHAR(100) NOT NULL,
  product_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_statuses (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  status_name VARCHAR(50) NOT NULL UNIQUE,
  sort_order SMALLINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_followups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  member_code VARCHAR(20) NOT NULL,
  consume_product TINYINT(1) NOT NULL DEFAULT 0,
  product_name VARCHAR(100) NULL,
  consume_date DATE NULL,
  prospect_list TINYINT(1) NOT NULL DEFAULT 0,
  welcome_to_eskayvie TINYINT(1) NOT NULL DEFAULT 0,
  product TINYINT(1) NOT NULL DEFAULT 0,
  marketing_plan TINYINT(1) NOT NULL DEFAULT 0,
  hbo TINYINT(1) NOT NULL DEFAULT 0,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY pb_followups_user_idx (user_id),
  CONSTRAINT pb_followups_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_monthly_targets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_month TINYINT UNSIGNED NOT NULL,
  target_year SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY pb_monthly_target_user_month_uq (user_id, target_year, target_month),
  CONSTRAINT pb_monthly_targets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_monthly_target_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  monthly_target_id BIGINT UNSIGNED NOT NULL,
  day_of_month TINYINT UNSIGNED NOT NULL,
  target_income DECIMAL(15,2) NULL,
  target_recruit INT UNSIGNED NULL,
  target_ro INT UNSIGNED NULL,
  rank_code VARCHAR(10) NULL,
  effort TEXT NULL,
  status_id SMALLINT UNSIGNED NULL,
  UNIQUE KEY pb_monthly_target_day_uq (monthly_target_id, day_of_month),
  CONSTRAINT pb_monthly_target_entries_parent_fk FOREIGN KEY (monthly_target_id)
    REFERENCES pb_monthly_targets(id) ON DELETE CASCADE,
  CONSTRAINT pb_monthly_target_entries_rank_fk FOREIGN KEY (rank_code)
    REFERENCES pb_ranks(rank_code),
  CONSTRAINT pb_monthly_target_entries_status_fk FOREIGN KEY (status_id)
    REFERENCES pb_statuses(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_activity_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  plan_month TINYINT UNSIGNED NOT NULL,
  plan_year SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY pb_activity_plan_user_month_uq (user_id, plan_year, plan_month),
  CONSTRAINT pb_activity_plans_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_activity_plan_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  activity_plan_id BIGINT UNSIGNED NOT NULL,
  day_of_month TINYINT UNSIGNED NOT NULL,
  activity TEXT NULL,
  status_id SMALLINT UNSIGNED NULL,
  UNIQUE KEY pb_activity_plan_day_uq (activity_plan_id, day_of_month),
  CONSTRAINT pb_activity_entries_parent_fk FOREIGN KEY (activity_plan_id)
    REFERENCES pb_activity_plans(id) ON DELETE CASCADE,
  CONSTRAINT pb_activity_entries_status_fk FOREIGN KEY (status_id)
    REFERENCES pb_statuses(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(40) NULL,
  birth_date DATE NULL,
  order_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY pb_customers_user_name_idx (user_id, name),
  CONSTRAINT pb_customers_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_customer_products (
  customer_id BIGINT UNSIGNED NOT NULL,
  product_code VARCHAR(20) NOT NULL,
  PRIMARY KEY (customer_id, product_code),
  CONSTRAINT pb_customer_products_customer_fk FOREIGN KEY (customer_id)
    REFERENCES pb_customers(id) ON DELETE CASCADE,
  CONSTRAINT pb_customer_products_product_fk FOREIGN KEY (product_code)
    REFERENCES pb_products(product_code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_prospects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(40) NULL,
  domicile VARCHAR(120) NULL,
  occupation VARCHAR(120) NULL,
  prospect_date DATE NULL,
  response ENUM('Baik', 'Kurang', 'Tidak Baik') NULL,
  reason TEXT NULL,
  follow_up TINYINT(1) NOT NULL DEFAULT 0,
  follow_up_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY pb_prospects_user_idx (user_id, id),
  CONSTRAINT pb_prospects_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_daily_task_months (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  task_month TINYINT UNSIGNED NOT NULL,
  task_year SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY pb_daily_task_user_month_uq (user_id, task_year, task_month),
  CONSTRAINT pb_daily_task_months_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_daily_task_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  month_record_id BIGINT UNSIGNED NOT NULL,
  day_of_month TINYINT UNSIGNED NOT NULL,
  learn TINYINT(1) NOT NULL DEFAULT 0,
  video_onboarding TINYINT(1) NOT NULL DEFAULT 0,
  consume_product TINYINT(1) NOT NULL DEFAULT 0,
  repeat_order TINYINT(1) NOT NULL DEFAULT 0,
  attend_zoom TINYINT(1) NOT NULL DEFAULT 0,
  contact_upline TINYINT(1) NOT NULL DEFAULT 0,
  sponsoring TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY pb_daily_task_day_uq (month_record_id, day_of_month),
  CONSTRAINT pb_daily_task_entries_parent_fk FOREIGN KEY (month_record_id)
    REFERENCES pb_daily_task_months(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_side_volume_months (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_year SMALLINT UNSIGNED NOT NULL,
  target_month TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY pb_side_volume_user_month_uq (user_id, target_year, target_month),
  CONSTRAINT pb_side_volume_months_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pb_side_volume_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  side_volume_month_id BIGINT UNSIGNED NOT NULL,
  product_code VARCHAR(20) NOT NULL,
  target_value DECIMAL(15,2) NULL,
  actual_value DECIMAL(15,2) NULL,
  UNIQUE KEY pb_side_volume_product_uq (side_volume_month_id, product_code),
  CONSTRAINT pb_side_volume_entries_parent_fk FOREIGN KEY (side_volume_month_id)
    REFERENCES pb_side_volume_months(id) ON DELETE CASCADE,
  CONSTRAINT pb_side_volume_entries_product_fk FOREIGN KEY (product_code)
    REFERENCES pb_products(product_code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO pb_ranks (rank_code, rank_name, sort_order) VALUES
  ('MBR', 'Member', 1),
  ('SMB', 'Senior Member', 2),
  ('SPV', 'Supervisor', 3),
  ('MGR', 'Manager', 4),
  ('SMGR', 'Sapphire Manager', 5),
  ('DMGR', 'Diamond Manager', 6),
  ('EMGR', 'Emerald Manager', 7),
  ('RMGR', 'Ruby Manager', 8),
  ('SMGR2', 'Sapphire Manager 2', 9),
  ('DMGR2', 'Diamond Manager 2', 10),
  ('EMGR2', 'Emerald Manager 2', 11),
  ('RMGR2', 'Ruby Manager 2', 12),
  ('SMGR3', 'Sapphire Manager 3', 13),
  ('DMGR3', 'Diamond Manager 3', 14),
  ('EMGR3', 'Emerald Manager 3', 15),
  ('RMGR3', 'Ruby Manager 3', 16);

INSERT IGNORE INTO pb_products (product_code, product_name, product_price) VALUES
  ('P001', 'Phytax', 100.00),
  ('P002', 'Nutrelle', 200.00),
  ('P003', 'Savva', 300.00),
  ('P004', 'Afeeya', 400.00),
  ('P005', 'Xeero', 500.00);

INSERT IGNORE INTO pb_statuses (id, status_name, sort_order) VALUES
  (1, 'Not Started', 1),
  (2, 'In Progress', 2),
  (3, 'Achieved', 3),
  (4, 'Not Achieved', 4),
  (5, 'Canceled', 5);
