const express = require('express');
const { asyncHandler, HttpError, object, string, email, uuid } = require('./model');

function createPublicRouter(service) {
  const router = express.Router();
  router.get('/home', asyncHandler(async (_request, response) => response.json(await service.home())));
  router.get('/collections/:slug', asyncHandler(async (request, response) => {
    const sort = request.query.sort === 'popularity' ? 'popularity' : 'date';
    response.json(await service.collection(request.params.slug, sort, request.get('x-visitor-key')));
  }));
  router.get('/images/:id', asyncHandler(async (request, response) => {
    response.json(await service.image(request.params.id, request.get('x-visitor-key')));
  }));
  router.post('/images/:id/ratings', asyncHandler(async (request, response) => {
    const input = object(request.body);
    const visitorKey = request.get('x-visitor-key');
    if (!visitorKey || visitorKey.length < 16) {
      throw new HttpError(400, 'A visitor identifier is required to rate an image.');
    }
    if (!Number.isInteger(input.value) || input.value < 1 || input.value > 5) {
      throw new HttpError(400, 'Value must be an integer between 1 and 5.');
    }
    response.json(await service.rate(uuid(request.params.id, 'Image ID'), visitorKey, input.value));
  }));
  router.post('/images/:id/comments', asyncHandler(async (request, response) => {
    const input = object(request.body);
    const visitorKey = request.get('x-visitor-key');
    if (!visitorKey || visitorKey.length < 16) {
      throw new HttpError(400, 'A visitor identifier is required to comment on an image.');
    }
    response.json(await service.comment(
      uuid(request.params.id, 'Image ID'),
      visitorKey,
      string(input.authorName, 'Author name', 2, 80),
      string(input.body, 'Body', 2, 1000),
    ));
  }));
  router.patch('/comments/:id', asyncHandler(async (request, response) => {
    const input = object(request.body);
    const visitorKey = request.get('x-visitor-key');
    if (!visitorKey || visitorKey.length < 16) {
      throw new HttpError(400, 'A visitor identifier is required to edit a comment.');
    }
    response.json(await service.updateComment(
      uuid(request.params.id, 'Comment ID'),
      visitorKey,
      string(input.authorName, 'Author name', 2, 80),
      string(input.body, 'Body', 2, 1000),
    ));
  }));
  router.delete('/comments/:id', asyncHandler(async (request, response) => {
    const visitorKey = request.get('x-visitor-key');
    if (!visitorKey || visitorKey.length < 16) {
      throw new HttpError(400, 'A visitor identifier is required to delete a comment.');
    }
    response.json(await service.deleteComment(uuid(request.params.id, 'Comment ID'), visitorKey));
  }));
  router.post('/contact', asyncHandler(async (request, response) => {
    const input = object(request.body);
    response.json(await service.contact(
      string(input.name, 'Name', 2, 100),
      email(input.email),
      string(input.message, 'Message', 10, 2000),
    ));
  }));
  return router;
}

module.exports = { createPublicRouter };
