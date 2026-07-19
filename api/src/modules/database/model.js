const mysql = require('mysql2/promise');

function createDatabasePool(environment = process.env) {
  for (const name of ['DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD']) {
    if (!environment[name]) {
      throw new Error(`${name} is required.`);
    }
  }

  return mysql.createPool({
    host: environment.DATABASE_HOST,
    port: Number(environment.DATABASE_PORT || 3306),
    database: environment.DATABASE_NAME,
    user: environment.DATABASE_USER,
    password: environment.DATABASE_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
  });
}

module.exports = { createDatabasePool };
