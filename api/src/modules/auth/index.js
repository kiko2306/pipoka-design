const { createAuthRouter } = require('./controller');
const { requireAdmin } = require('./model');
const { AuthService } = require('./service');

module.exports = { AuthService, createAuthRouter, requireAdmin };
