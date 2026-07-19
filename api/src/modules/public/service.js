const { createHash, randomUUID } = require('node:crypto');
const { HttpError } = require('./model');

class PublicService {
  constructor(database) {
    this.database = database;
  }

  async home() {
    const [collections] = await this.database.query(
      `SELECT c.id, c.slug, c.title, c.description, i.file_path AS coverImage
       FROM collections c LEFT JOIN images i ON i.id = c.cover_image_id AND i.is_published = TRUE
       WHERE c.is_published = TRUE ORDER BY c.display_order, c.created_at DESC`,
    );
    const [topImages] = await this.database.query(
      `SELECT i.id, i.title, i.alt_text AS altText, i.file_path AS filePath,
              c.title AS collectionTitle, COALESCE(AVG(r.value), 0) AS rating
       FROM images i JOIN collections c ON c.id = i.collection_id
       LEFT JOIN image_ratings r ON r.image_id = i.id
       WHERE i.is_published = TRUE AND c.is_published = TRUE
       GROUP BY i.id ORDER BY rating DESC, i.created_at DESC LIMIT 6`,
    );
    const [settings] = await this.database.query('SELECT setting_key, setting_value FROM site_settings');
    const values = Object.fromEntries(settings.map(({ setting_key, setting_value }) => [setting_key, setting_value]));
    return {
      collections,
      topImages,
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

  async collection(slug, sort, visitorKey) {
    const [collections] = await this.database.query(
      'SELECT id, slug, title, description FROM collections WHERE slug = ? AND is_published = TRUE',
      [slug],
    );
    if (!collections.length) {
      throw new HttpError(404, 'This collection is unavailable.');
    }
    const collection = collections[0];
    const visitorHash = visitorKey && visitorKey.length >= 16
      ? createHash('sha256').update(visitorKey).digest('hex')
      : '';
    const orderBy = sort === 'popularity'
      ? 'averageRating DESC, ratingCount DESC, i.created_at DESC'
      : 'i.created_at DESC';
    const [images] = await this.database.query(
      `SELECT i.id, i.title, i.alt_text AS altText, i.file_path AS filePath,
              ROUND(COALESCE(AVG(r.value), 0), 1) AS averageRating, COUNT(r.id) AS ratingCount,
              COALESCE(MAX(CASE WHEN r.visitor_key_hash = ? THEN r.value END), 0) AS visitorRating
       FROM images i LEFT JOIN image_ratings r ON r.image_id = i.id
       WHERE i.collection_id = ? AND i.is_published = TRUE
       GROUP BY i.id ORDER BY ${orderBy}`,
      [visitorHash, collection.id],
    );
    return { ...collection, images };
  }

  async image(id, visitorKey) {
    const visitorHash = visitorKey && visitorKey.length >= 16
      ? createHash('sha256').update(visitorKey).digest('hex')
      : '';
    const [images] = await this.database.query(
      `SELECT i.id, i.title, i.description, i.alt_text AS altText, i.file_path AS filePath,
              c.title AS collectionTitle, c.slug AS collectionSlug, ROUND(COALESCE(AVG(r.value), 0), 1) AS averageRating,
              COUNT(r.id) AS ratingCount, COALESCE(MAX(CASE WHEN r.visitor_key_hash = ? THEN r.value END), 0) AS visitorRating
       FROM images i JOIN collections c ON c.id = i.collection_id
       LEFT JOIN image_ratings r ON r.image_id = i.id
       WHERE i.id = ? AND i.is_published = TRUE AND c.is_published = TRUE GROUP BY i.id`,
      [visitorHash, id],
    );
    if (!images.length) {
      throw new HttpError(404, 'This image is unavailable.');
    }
    const commentValues = [visitorHash, visitorHash, id];
    const [comments] = await this.database.query(
      `SELECT id, author_name AS authorName, body, status, created_at AS createdAt, updated_at AS updatedAt,
              CASE WHEN ? <> '' AND visitor_key_hash = ? THEN TRUE ELSE FALSE END AS isOwned
       FROM comments
       WHERE image_id = ? AND status = 'approved'
       ORDER BY created_at DESC`,
      commentValues,
    );
    return { ...images[0], comments };
  }

  async rate(imageId, visitorKey, value) {
    const visitorHash = createHash('sha256').update(visitorKey).digest('hex');
    const [images] = await this.database.query(
      `SELECT i.id FROM images i JOIN collections c ON c.id = i.collection_id
       WHERE i.id = ? AND i.is_published = TRUE AND c.is_published = TRUE`,
      [imageId],
    );
    if (!images.length) {
      throw new HttpError(404, 'This image is unavailable.');
    }
    await this.database.execute(
      `INSERT INTO image_ratings (id, image_id, visitor_key_hash, value) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [randomUUID(), imageId, visitorHash, value],
    );
    const [ratings] = await this.database.query(
      'SELECT ROUND(AVG(value), 1) AS averageRating, COUNT(*) AS ratingCount FROM image_ratings WHERE image_id = ?',
      [imageId],
    );
    return { value, ...ratings[0] };
  }

  async comment(imageId, visitorKey, authorName, body) {
    const visitorHash = createHash('sha256').update(visitorKey).digest('hex');
    const [images] = await this.database.query(
      `SELECT i.id FROM images i JOIN collections c ON c.id = i.collection_id
       WHERE i.id = ? AND i.is_published = TRUE AND c.is_published = TRUE`,
      [imageId],
    );
    if (!images.length) {
      throw new HttpError(404, 'This image is unavailable.');
    }
    const id = randomUUID();
    await this.database.execute(
      "INSERT INTO comments (id, image_id, visitor_key_hash, author_name, body, status) VALUES (?, ?, ?, ?, ?, 'pending')",
      [id, imageId, visitorHash, authorName, body],
    );
    return { id, authorName, body, isOwned: true, status: 'pending' };
  }

  async updateComment(id, visitorKey, authorName, body) {
    const visitorHash = createHash('sha256').update(visitorKey).digest('hex');
    const [result] = await this.database.execute(
      "UPDATE comments SET author_name = ?, body = ?, status = 'pending', moderated_at = NULL WHERE id = ? AND visitor_key_hash = ?",
      [authorName, body, id, visitorHash],
    );
    if (result.affectedRows === 0) {
      throw new HttpError(404, 'This comment is unavailable.');
    }
    return { id, authorName, body, status: 'pending' };
  }

  async deleteComment(id, visitorKey) {
    const visitorHash = createHash('sha256').update(visitorKey).digest('hex');
    const [result] = await this.database.execute(
      'DELETE FROM comments WHERE id = ? AND visitor_key_hash = ?',
      [id, visitorHash],
    );
    if (result.affectedRows === 0) {
      throw new HttpError(404, 'This comment is unavailable.');
    }
    return { deleted: true };
  }

  async contact(name, email, message) {
    await this.database.execute(
      'INSERT INTO contact_submissions (id, name, email, message) VALUES (?, ?, ?, ?)',
      [randomUUID(), name, email, message],
    );
    return { status: 'received' };
  }
}

module.exports = { PublicService };
