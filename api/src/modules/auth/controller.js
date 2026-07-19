const express = require('express');
const { asyncHandler, object, email, string } = require('../public/model');

function createAuthRouter(service) {
  const router = express.Router();
  router.post('/login', asyncHandler(async (request, response) => {
    const input = object(request.body);
    response.json(await service.login(email(input.email), string(input.password, 'Password', 12, 128)));
  }));
  return router;
}

module.exports = { createAuthRouter };
