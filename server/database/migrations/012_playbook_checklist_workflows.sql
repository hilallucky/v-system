ALTER TABLE pb_followups
  ADD COLUMN name VARCHAR(120) NOT NULL DEFAULT '' AFTER user_id,
  ADD COLUMN rank_code VARCHAR(10) NULL AFTER member_code,
  ADD COLUMN join_date DATE NULL AFTER rank_code,
  ADD COLUMN status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active' AFTER join_date,
  ADD KEY pb_followups_rank_idx (rank_code),
  ADD CONSTRAINT pb_followups_rank_fk FOREIGN KEY (rank_code) REFERENCES pb_ranks(rank_code);

UPDATE pb_followups
SET name = member_code
WHERE name = '';

ALTER TABLE pb_customers
  ADD COLUMN status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active' AFTER notes;

ALTER TABLE pb_prospects
  MODIFY response ENUM('Baik', 'Kurang', 'Kurang Baik', 'Tidak Baik') NULL;

UPDATE pb_prospects
SET response = 'Kurang Baik'
WHERE response = 'Kurang';

ALTER TABLE pb_prospects
  MODIFY response ENUM('Baik', 'Kurang Baik', 'Tidak Baik') NULL;

ALTER TABLE pb_monthly_target_entries
  MODIFY target_income DECIMAL(15,0) NULL;

ALTER TABLE pb_side_volume_entries
  MODIFY target_value DECIMAL(15,0) NULL,
  MODIFY actual_value DECIMAL(15,0) NULL;
