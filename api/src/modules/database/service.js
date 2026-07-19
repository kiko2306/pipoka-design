const bcrypt = require('bcrypt');
const { randomUUID } = require('node:crypto');
const { createDatabasePool } = require('./model');

class DatabaseService {
  constructor(pool = createDatabasePool()) {
    this.pool = pool;
  }

  async initialize() {
    await this.pool.query('SELECT 1');
    const [columns] = await this.pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND COLUMN_NAME = 'display_order'`,
    );
    if (columns.length === 0) {
      await this.pool.query(
        'ALTER TABLE collections ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER cover_image_id',
      );
    }
    await this.ensureCommentColumns();
    await this.seedSiteSettings();

    const email = requiredEnvironment('ADMIN_EMAIL').toLowerCase();
    const [users] = await this.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      const passwordHash = await bcrypt.hash(requiredEnvironment('ADMIN_PASSWORD'), 12);
      await this.execute('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [
        randomUUID(),
        email,
        passwordHash,
      ]);
    }
  }

  async ensureCommentColumns() {
      const [columns] = await this.pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments'
           AND COLUMN_NAME IN ('visitor_key_hash', 'updated_at')`,
      );
      const existing = new Set(columns.map(({ COLUMN_NAME: name }) => name));
      if (!existing.has('visitor_key_hash')) {
        await this.pool.query("ALTER TABLE comments ADD COLUMN visitor_key_hash CHAR(64) NOT NULL DEFAULT '' AFTER image_id");
      }
      if (!existing.has('updated_at')) {
        await this.pool.query(
          'ALTER TABLE comments ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
        );
      }
    }

  async seedSiteSettings() {
      const defaults = {
        site_title: 'Pipoka',
        site_subtitle: 'Images that make room to look.',
        work_eyebrow: 'Selected collections',
        work_headline: 'The archive is arranged\nby feeling, not category.',
        about_eyebrow: 'A little about me',
        about_headline: 'I photograph what changes when nobody is looking: the light after a departure, a mark in sand, a room settling into evening.',
        about_detail: 'Pipoka is an independent image practice. The work gathers slowly, across walks, train windows and borrowed time.',
        contact_eyebrow: 'Start a conversation',
        contact_headline: 'Have an idea\nthat needs images?',
        contact_detail: 'For commissions, print enquiries, or simply to say hello.',
      };
      for (const [key, value] of Object.entries(defaults)) {
        await this.execute(
          'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = setting_value',
          [key, value],
        );
    }
  }

  query(sql, values = []) {
    return this.pool.query(sql, values);
  }

  execute(sql, values = []) {
    return this.pool.query(sql, values);
  }

  close() {
    return this.pool.end();
  }
}

function requiredEnvironment(name) {
  if (!process.env[name]) {
    throw new Error(`${name} is required.`);
  }
  return process.env[name];
}

module.exports = { DatabaseService };
