const { Sequelize } = require('sequelize');
const path = require('path');

let sequelize;
if (process.env.DATABASE_URL) {
  // Postgres (dev/prod) when DATABASE_URL is provided, e.g. postgres://user:pass@host:5432/db
  const ssl = process.env.PGSSL === '1' ? { require: true, rejectUnauthorized: false } : undefined;
  console.log('Using Postgres via DATABASE_URL');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: ssl ? { ssl } : {},
  });
} else if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME) {
  // Compose Postgres URL from discrete env vars
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER;
  const pass = encodeURIComponent(process.env.DB_PASS || '');
  const name = process.env.DB_NAME;
  const url = `postgres://${user}:${pass}@${host}:${port}/${name}`;
  const ssl = process.env.PGSSL === '1' ? { require: true, rejectUnauthorized: false } : undefined;
  console.log('Using Postgres via composed env vars');
  sequelize = new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: ssl ? { ssl } : {},
  });
} else {
  // Local SQLite (default)
  const storage = path.join(__dirname, '..', 'database.sqlite');
  console.log('Using SQLite for development at', storage);
  sequelize = new Sequelize({ dialect: 'sqlite', storage, logging: false });
}

module.exports = sequelize;