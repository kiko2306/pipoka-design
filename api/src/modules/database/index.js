const { registerDatabaseRoutes } = require('./controller');
const { DatabaseService } = require('./service');

module.exports = { DatabaseService, registerDatabaseRoutes };
