const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // permite DNI/fotos en Base64

// Healthcheck para plataformas de despliegue.
app.get('/', (req, res) => res.json({ servicio: 'BidMaster API', estado: 'ok', version: 'v1' }));
app.get('/api/v1/health', (req, res) => res.json({ estado: 'ok' }));

// API REST.
app.use('/api/v1', routes);

// 404 + manejador de errores centralizado.
app.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));
app.use(errorHandler);

module.exports = app;
