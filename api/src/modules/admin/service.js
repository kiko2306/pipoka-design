const { randomUUID } = require('node:crypto');
const { basename, resolve } = require('node:path');
const { rm } = require('node:fs/promises');
const { HttpError } = require('../public/model');

class AdminService {
  constructor(database) {
    this.database = database;
  }

  async collections() {
    const [collections] = await this.database.query(
      `SELECT id, slug, title, description, is_published AS isPublished,
              display_order AS displayOrder, created_at AS createdAt
       FROM collections ORDER BY display_order, created_at DESC`,
    );
    return collections;
  }

  async createCollection(input) {
    const id = randomUUID();
    const [orders] = await this.database.query(
      'SELECT COALESCE(MAX(display_order), -1) + 1 AS nextOrder FROM collections',
    );
    await this.database.execute(
      `INSERT INTO collections (id, slug, title, description, display_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.slug, input.title, input.description, orders[0].nextOrder, Boolean(input.isPublished)],
    );
    return { id, slug: input.slug };
  }

  async updateCollection(id, input) {
    await this.database.execute(
      'UPDATE collections SET slug = ?, title = ?, description = ?, is_published = ? WHERE id = ?',
      [input.slug, input.title, input.description, Boolean(input.isPublished), id],
    );
    return { id, slug: input.slug };
  }

  async reorderCollections(collectionIds) {
    for (const [index, id] of collectionIds.entries()) {
      await this.database.execute('UPDATE collections SET display_order = ? WHERE id = ?', [index, id]);
    }
    return { collectionIds };
  }

  async setCollectionCover(id, imageId) {
    const [images] = await this.database.query(
      'SELECT id FROM images WHERE id = ? AND collection_id = ? AND is_published = TRUE',
      [imageId, id],
    );
    if (!images.length) {
      throw new HttpError(400, 'The cover image must be a published image in this collection.');
    }
    await this.database.execute('UPDATE collections SET cover_image_id = ? WHERE id = ?', [imageId, id]);
    return { id, imageId };
  }

  async collectionImages(collectionId) {
    const [images] = await this.database.query(
      `SELECT id, title, description, alt_text AS altText, file_path AS filePath,
              display_order AS displayOrder, is_published AS isPublished
       FROM images WHERE collection_id = ? ORDER BY display_order, created_at`,
      [collectionId],
    );
    return images;
  }

  async comments() {
    const [comments] = await this.database.query(
      `SELECT cm.id, cm.author_name AS authorName, cm.body, cm.status, cm.created_at AS createdAt,
              i.title AS imageTitle FROM comments cm JOIN images i ON i.id = cm.image_id
       WHERE cm.status = 'pending' ORDER BY cm.created_at DESC`,
    );
    return comments;
  }

  async moderateComment(id, status) {
    await this.database.execute(
      'UPDATE comments SET status = ?, moderated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id],
    );
    return { status };
  }

  async inbox() {
    const [submissions] = await this.database.query(
      `SELECT id, name, email, message, read_at AS readAt, created_at AS createdAt
       FROM contact_submissions ORDER BY read_at IS NULL DESC, created_at DESC`,
    );
    return submissions;
  }

  async settings() {
    const [settings] = await this.database.query(
      'SELECT setting_key, setting_value FROM site_settings',
    );
    const values = Object.fromEntries(settings.map(({ setting_key, setting_value }) => [setting_key, setting_value]));
    return {
      siteTitle: values.site_title || 'Pipoka',
      siteSubtitle: values.site_subtitle || 'Images that make room to look.',
      homepage: {
        workEyebrow: values.work_eyebrow || 'Selected collections',
        workHeadline: values.work_headline || 'The archive is arranged\nby feeling, not category.',
        aboutEyebrow: values.about_eyebrow || 'A little about me',
        aboutHeadline: values.about_headline || '',
        aboutDetail: values.about_detail || '',
        contactEyebrow: values.contact_eyebrow || 'Start a conversation',
        contactHeadline: values.contact_headline || '',
        contactDetail: values.contact_detail || '',
      },
    };
  }

  async updateAbout(aboutText) {
    await this.database.execute(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES ('about_detail', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [aboutText],
    );
    return { aboutText };
  }

  async updateHomepage(homepage) {
    const values = {
      work_eyebrow: homepage.workEyebrow,
      work_headline: homepage.workHeadline,
      about_eyebrow: homepage.aboutEyebrow,
      about_headline: homepage.aboutHeadline,
      about_detail: homepage.aboutDetail,
      contact_eyebrow: homepage.contactEyebrow,
      contact_headline: homepage.contactHeadline,
      contact_detail: homepage.contactDetail,
    };
    for (const [key, value] of Object.entries(values)) {
      await this.database.execute(
        'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, value],
      );
    }
    return homepage;
  }

  async updateIdentity(siteTitle, siteSubtitle) {
    await this.database.execute(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES
       ('site_title', ?), ('site_subtitle', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [siteTitle, siteSubtitle],
    );
    return { siteTitle, siteSubtitle };
  }

  async uploadImage(file, fields) {
    const id = randomUUID();
    let imageInserted = false;
    try {
      const [collections] = await this.database.query('SELECT id FROM collections WHERE id = ?', [fields.collectionId]);
      if (!collections.length) {
        throw new HttpError(404, 'The selected collection no longer exists.');
      }
      await this.database.execute(
        `INSERT INTO images (id, collection_id, title, alt_text, description, file_path, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          fields.collectionId,
          fields.title,
          fields.altText,
          fields.description || null,
          `/uploads/${file.filename}`,
          fields.isPublished === 'true',
        ],
      );
      imageInserted = true;
      if (fields.isPublished === 'true') {
        await this.database.execute(
          `UPDATE collections
           SET is_published = TRUE, cover_image_id = COALESCE(cover_image_id, ?)
           WHERE id = ?`,
          [id, fields.collectionId],
        );
      }
    } catch (error) {
      if (imageInserted) {
        await this.database.execute('DELETE FROM images WHERE id = ?', [id]).catch(() => undefined);
      }
      await rm(resolve(process.cwd(), process.env.UPLOAD_DIRECTORY || 'uploads', file.filename), { force: true });
      throw error;
    }
    return { id, filePath: `/uploads/${file.filename}` };
  }

  async reorderImages(imageIds) {
    for (const [index, id] of imageIds.entries()) {
      await this.database.execute('UPDATE images SET display_order = ? WHERE id = ?', [index, id]);
    }
    return { imageIds };
  }

  async updateImage(id, input) {
    await this.database.execute(
      'UPDATE images SET title = ?, alt_text = ?, description = ?, is_published = ? WHERE id = ?',
      [input.title, input.altText, input.description || null, Boolean(input.isPublished), id],
    );
    return { id };
  }

  async deleteImage(id) {
    const [images] = await this.database.query('SELECT file_path AS filePath FROM images WHERE id = ?', [id]);
    if (!images.length) {
      return { deleted: false };
    }
    await this.database.execute('DELETE FROM images WHERE id = ?', [id]);
    const fileName = basename(images[0].filePath || '');
    if (fileName && images[0].filePath === `/uploads/${fileName}`) {
      const uploadDirectory = resolve(process.cwd(), process.env.UPLOAD_DIRECTORY || 'uploads');
      await rm(resolve(uploadDirectory, fileName), { force: true });
    }
    return { deleted: true };
  }

  async deleteCollection(id) {
    const [images] = await this.database.query('SELECT file_path AS filePath FROM images WHERE collection_id = ?', [id]);
    await this.database.execute('DELETE FROM collections WHERE id = ?', [id]);
    await Promise.all(images.map(async ({ filePath }) => {
      const fileName = basename(filePath || '');
      if (fileName && filePath === `/uploads/${fileName}`) {
        const uploadDirectory = resolve(process.cwd(), process.env.UPLOAD_DIRECTORY || 'uploads');
        await rm(resolve(uploadDirectory, fileName), { force: true });
      }
    }));
    return { deleted: true };
  }
}

module.exports = { AdminService };
