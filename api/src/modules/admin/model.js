const { HttpError, boolean, object, string, uuid } = require('../public/model');

function collectionInput(input) {
  object(input);
  const title = string(input.title, 'Title', 2, 160);
  const slugSource = input.slug === undefined ? title : string(input.slug, 'Slug', 2, 120);
  const slug = slugSource
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (!slug) {
    throw new HttpError(400, 'A collection title must contain letters or numbers.');
  }
  return {
    title,
    slug,
    description: string(input.description, 'Description', 2, 5000),
    isPublished: boolean(input.isPublished, 'isPublished'),
  };
}

function imageInput(input) {
  object(input);
  return {
    title: string(input.title, 'Title', 2, 160),
    altText: string(input.altText, 'Alt text', 2, 255),
    description: string(input.description, 'Description', 2, 5000, true),
    isPublished: boolean(input.isPublished, 'isPublished'),
  };
}

function orderedIds(input, field) {
  object(input);
  if (!Array.isArray(input[field])) {
    throw new HttpError(400, `${field} must be an array.`);
  }
  return input[field].map((id) => uuid(id, field));
}

module.exports = { collectionInput, imageInput, orderedIds };
