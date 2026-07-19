const { createApp } = require('./app');

async function start() {
  const { app, database } = createApp();
  await database.initialize();

  const server = app.listen(Number(process.env.PORT || 3000), () => {
    console.log(`API listening on port ${process.env.PORT || 3000}`);
  });
  const stop = async () => {
    server.close(async () => {
      await database.close();
      process.exit(0);
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

start().catch((error) => {
  console.error('API startup failed:', error);
  process.exit(1);
});
