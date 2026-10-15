ALTER TABLE items
  MODIFY kind ENUM('folder', 'file', 'link') NOT NULL,
  ADD COLUMN url VARCHAR(2048) NULL,
  ADD COLUMN thumbnail_url VARCHAR(2048) NULL,
  ADD COLUMN description VARCHAR(500) NULL;
