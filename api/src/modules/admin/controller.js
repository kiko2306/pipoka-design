const express = require('express');
const multer = require('multer');
const { extname, resolve } = require('node:path');
const { mkdir, rename, rm } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { requireAdmin } = require('../auth');
const { asyncHandler, HttpError, object, string, uuid } = require('../public/model');
const { collectionInput, imageInput, orderedIds } = require('./model');

function filenameLabel(originalName) {
  const name = originalName
    .replace(extname(originalName), '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name.length >= 2 ? name : 'Imagem sem título';
}

function createAdminRouter(service) {
  const router = express.Router();
  const uploadDirectory = resolve(process.cwd(), process.env.UPLOAD_DIRECTORY || 'uploads');
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        mkdir(uploadDirectory, { recursive: true }).then(() => callback(null, uploadDirectory), callback);
      },
      filename: (_request, _file, callback) => callback(null, randomUUID()),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  router.use(requireAdmin);
  router.get('/collections', asyncHandler(async (_request, response) => response.json(await service.collections())));
  router.post('/collections', asyncHandler(async (request, response) => {
    response.json(await service.createCollection(collectionInput(request.body)));
  }));
  router.patch('/collections/order', asyncHandler(async (request, response) => {
    response.json(await service.reorderCollections(orderedIds(request.body, 'collectionIds')));
  }));
  router.patch('/collections/:id', asyncHandler(async (request, response) => {
    response.json(await service.updateCollection(uuid(request.params.id, 'Collection ID'), collectionInput(request.body)));
  }));
  router.patch('/collections/:id/cover', asyncHandler(async (request, response) => {
    const input = object(request.body);
    response.json(await service.setCollectionCover(
      uuid(request.params.id, 'Collection ID'),
      uuid(input.imageId, 'Image ID'),
    ));
  }));
  router.get('/collections/:id/images', asyncHandler(async (request, response) => {
    response.json(await service.collectionImages(uuid(request.params.id, 'Collection ID')));
  }));
  router.get('/comments', asyncHandler(async (_request, response) => response.json(await service.comments())));
  router.patch('/comments/:id', asyncHandler(async (request, response) => {
    const status = object(request.body).status;
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, 'Status must be approved or rejected.');
    }
    response.json(await service.moderateComment(uuid(request.params.id, 'Comment ID'), status));
  }));
  router.get('/contact-submissions', asyncHandler(async (_request, response) => response.json(await service.inbox())));
  router.get('/settings', asyncHandler(async (_request, response) => response.json(await service.settings())));
  router.patch('/settings/about', asyncHandler(async (request, response) => {
    response.json(await service.updateAbout(string(object(request.body).aboutText, 'About text', 2, 5000)));
  }));
  router.patch('/settings/identity', asyncHandler(async (request, response) => {
    const input = object(request.body);
    response.json(await service.updateIdentity(
      string(input.siteTitle, 'Site title', 2, 120),
      string(input.siteSubtitle, 'Site subtitle', 2, 240),
    ));
  }));
  router.patch('/settings/homepage', asyncHandler(async (request, response) => {
    const input = object(request.body);
    response.json(await service.updateHomepage({
      workEyebrow: string(input.workEyebrow, 'Work eyebrow', 2, 120),
      workHeadline: string(input.workHeadline, 'Work headline', 2, 500),
      aboutEyebrow: string(input.aboutEyebrow, 'About eyebrow', 2, 120),
      aboutHeadline: string(input.aboutHeadline, 'About headline', 2, 1000),
      aboutDetail: string(input.aboutDetail, 'About detail', 2, 5000),
      contactEyebrow: string(input.contactEyebrow, 'Contact eyebrow', 2, 120),
      contactHeadline: string(input.contactHeadline, 'Contact headline', 2, 500),
      contactDetail: string(input.contactDetail, 'Contact detail', 2, 5000),
    }));
  }));
  router.post('/images/upload', (request, response, next) => {
    upload.single('file')(request, response, (error) => {
      if (error instanceof multer.MulterError) {
        return next(new HttpError(400, error.code === 'LIMIT_FILE_SIZE'
          ? 'Cada imagem deve ter no máximo 10 MB.'
          : 'Não foi possível processar o carregamento da imagem.'));
      }
      return next(error);
    });
  }, asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'Selecione uma coleção, uma imagem, um título e um texto alternativo.');
    }
    try {
      const imageType = await detectSupportedImageType(request.file.path);
      if (!imageType) {
        throw new HttpError(400, 'O ficheiro selecionado não é uma imagem válida.');
      }
      const filename = `${request.file.filename}.${imageType.ext}`;
      const filePath = resolve(uploadDirectory, filename);
      await rename(request.file.path, filePath);
      request.file.filename = filename;
      request.file.path = filePath;

      const fields = request.body || {};
      if (!fields.collectionId) {
        throw new HttpError(400, 'Selecione uma coleção antes de carregar a imagem.');
      }
      const defaultLabel = filenameLabel(request.file.originalname);
      response.json(await service.uploadImage(request.file, {
        collectionId: uuid(fields.collectionId, 'ID da coleção'),
        title: string(fields.title || defaultLabel, 'Título', 2, 160),
        altText: string(fields.altText || defaultLabel, 'Texto alternativo', 2, 255),
        description: string(fields.description, 'Descrição', 2, 5000, true),
        isPublished: fields.isPublished,
      }));
    } catch (error) {
      await rm(request.file.path, { force: true });
      throw error;
    }
  }));
  router.patch('/images/order', asyncHandler(async (request, response) => {
    response.json(await service.reorderImages(orderedIds(request.body, 'imageIds')));
  }));
  router.patch('/images/:id', asyncHandler(async (request, response) => {
    response.json(await service.updateImage(uuid(request.params.id, 'Image ID'), imageInput(request.body)));
  }));
  router.delete('/images/:id', asyncHandler(async (request, response) => {
    response.json(await service.deleteImage(uuid(request.params.id, 'Image ID')));
  }));
  router.delete('/collections/:id', asyncHandler(async (request, response) => {
    response.json(await service.deleteCollection(uuid(request.params.id, 'Collection ID')));
  }));
  return router;
}

async function detectSupportedImageType(filePath) {
  const { fileTypeFromFile } = await import('file-type');
  const type = await fileTypeFromFile(filePath);
  return type && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type.mime)
    ? type
    : undefined;
}

module.exports = { createAdminRouter };
