const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

/**
 * Conexión a la base de datos.
 * - Producción (online): si existe DATABASE_URL se usa Postgres.
 * - Desarrollo: SQLite local (archivo portable, sin servidor aparte).
 */
let sequelize;

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  });
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', '..', 'bidmaster.sqlite'),
    logging: false,
  });
}

module.exports = sequelize;
