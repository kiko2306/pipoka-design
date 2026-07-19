CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin') NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collections (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  cover_image_id CHAR(36) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS images (
  id CHAR(36) PRIMARY KEY,
  collection_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  file_path VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  INDEX images_collection_order (collection_id, display_order)
);

SET @collections_cover_image_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'collections'
    AND CONSTRAINT_NAME = 'collections_cover_image'
);
SET @add_collections_cover_image = IF(
  @collections_cover_image_exists = 0,
  'ALTER TABLE collections ADD CONSTRAINT collections_cover_image FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE add_collections_cover_image FROM @add_collections_cover_image;
EXECUTE add_collections_cover_image;
DEALLOCATE PREPARE add_collections_cover_image;

CREATE TABLE IF NOT EXISTS image_ratings (
  id CHAR(36) PRIMARY KEY,
  image_id CHAR(36) NOT NULL,
  visitor_key_hash CHAR(64) NOT NULL,
  value TINYINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT rating_value_range CHECK (value BETWEEN 1 AND 5),
  CONSTRAINT one_rating_per_visitor UNIQUE (image_id, visitor_key_hash),
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id CHAR(36) PRIMARY KEY,
  image_id CHAR(36) NOT NULL,
  visitor_key_hash CHAR(64) NOT NULL DEFAULT '',
  author_name VARCHAR(80) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  moderated_at TIMESTAMP NULL,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  INDEX comments_public (image_id, status, created_at)
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message VARCHAR(2000) NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX contact_inbox (read_at, created_at)
);

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('site_title', 'Pipoka'),
  ('site_subtitle', 'Images that make room to look.'),
  ('work_eyebrow', 'Selected collections'),
  ('work_headline', 'The archive is arranged\nby feeling, not category.'),
  ('about_eyebrow', 'A little about me'),
  ('about_headline', 'I photograph what changes when nobody is looking: the light after a departure, a mark in sand, a room settling into evening.'),
  ('about_detail', 'Pipoka is an independent image practice. The work gathers slowly, across walks, train windows and borrowed time.'),
  ('contact_eyebrow', 'Start a conversation'),
  ('contact_headline', 'Have an idea\nthat needs images?'),
  ('contact_detail', 'For commissions, print enquiries, or simply to say hello.')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
