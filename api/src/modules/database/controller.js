function registerDatabaseRoutes(router) {
  router.get('/health', (_request, response) => response.json({ status: 'ok' }));
}

module.exports = { registerDatabaseRoutes };
