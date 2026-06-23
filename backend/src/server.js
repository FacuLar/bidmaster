require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const { sequelize } = require('./models');
const { initSockets } = require('./sockets');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  // Sincroniza el esquema (crea las tablas de la cátedra + las nuevas si faltan).
  await sequelize.authenticate();
  await sequelize.sync();

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
