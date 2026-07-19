const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { resolve } = require('node:path');
const { DatabaseService, registerDatabaseRoutes } = require('./modules/database');
const { AuthService, createAuthRouter } = require('./modules/auth');
const { PublicService, createPublicRouter } = require('./modules/public');
const { AdminService, createAdminRouter } = require('./modules/admin');

dotenv.config();

function createApp({ database = new DatabaseService() } = {}) {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : true;

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(resolve(process.cwd(), process.env.UPLOAD_DIRECTORY || 'uploads')));

  const api = express.Router();
  registerDatabaseRoutes(api);
  api.use('/auth', createAuthRouter(new AuthService(database)));
  api.use(createPublicRouter(new PublicService(database)));
  api.use('/admin', createAdminRouter(new AdminService(database)));
  app.use('/api', api);

  app.use((request, _response, next) => {
    const error = new Error(`Cannot ${request.method} ${request.originalUrl}`);
    error.status = 404;
    next(error);
  });
  app.use((error, _request, response, _next) => {
    const status = error.status || 500;
    if (status >= 500) {
      console.error(error);
    }
    response.status(status).json({
      statusCode: status,
      message: status === 500 ? 'Internal server error.' : error.message,
      error: status === 500 ? 'Internal Server Error' : 'Bad Request',
    });
  });

  return { app, database };
}

module.exports = { createApp };
