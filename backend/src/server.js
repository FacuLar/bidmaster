require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const { sequelize } = require('./models');
const { initSockets } = require('./sockets');

const PORT = process.env.PORT || 4000;

/**
 * Agrega columnas nuevas a tablas ya existentes usando ALTER TABLE ADD COLUMN
 * (operación liviana y no destructiva en SQLite). Es idempotente: si la columna
 * ya existe, no hace nada.
 */
async function migrarColumnasNuevas() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require('sequelize');
  const nuevas = {
    usuarios: {
      codigo_reset: { type: DataTypes.STRING, allowNull: true },
    },
    subastas: {
      pieza_actual_id: { type: DataTypes.INTEGER, allowNull: true },
    },
    piezas: {
      categoria: { type: DataTypes.STRING, allowNull: true },
      tags: { type: DataTypes.JSON, allowNull: true },
      uso: { type: DataTypes.STRING, allowNull: true },
    },
    articulos: {
      pieza_id: { type: DataTypes.INTEGER, allowNull: true },
      medio_pago_id: { type: DataTypes.INTEGER, allowNull: true },
    },
    medios_pago: {
      marca: { type: DataTypes.STRING, allowNull: true },
      titular: { type: DataTypes.STRING, allowNull: true },
      vencimiento: { type: DataTypes.STRING, allowNull: true },
      numero_cheque: { type: DataTypes.STRING, allowNull: true },
      banco: { type: DataTypes.STRING, allowNull: true },
      cbu: { type: DataTypes.STRING, allowNull: true },
    },
  };
  for (const [tabla, columnas] of Object.entries(nuevas)) {
    let existentes = {};
    try { existentes = await qi.describeTable(tabla); } catch (_) { continue; }
    for (const [col, def] of Object.entries(columnas)) {
      if (!existentes[col]) {
        // eslint-disable-next-line no-await-in-loop
        await qi.addColumn(tabla, col, def);
        // eslint-disable-next-line no-console
        console.log(`🛠️  Columna agregada: ${tabla}.${col}`);
      }
    }
  }
}

async function bootstrap() {
  // Sincroniza el esquema (crea tablas si no existen).
  await sequelize.authenticate();
  await sequelize.sync();
  // Migración segura: agrega las columnas nuevas a tablas existentes sin
  // reconstruirlas (ADD COLUMN). Evita la fragilidad de sync({ alter: true }).
  await migrarColumnasNuevas();

  const server = http.createServer(app);

  // WebSocket (Socket.IO) sobre el mismo servidor HTTP.
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);
  initSockets(io, app);

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 BidMaster API + WebSocket escuchando en http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
