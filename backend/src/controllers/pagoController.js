const { MedioPago, Cliente } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { validarTarjeta, validarCheque, validarCBU } = require('../utils/validaciones');

const SALDO_DEFAULT = 1000000;

// Mapea el MedioPago (esquema nuevo) al shape que espera el front (nombres viejos).
function medioAPI(m) {
  return {
    id: m.identificador,
    tipo: m.tipo,
    entidad: m.entidad,
    numero_identificador: m.numeroIdentificador,
    marca: m.marca,
    titular: m.titular,
    vencimiento: m.vencimiento,
    monto_certificado: Number(m.montoCertificado),
    saldo_disponible: Number(m.saldoDisponible),
    moneda: m.moneda,
    estado_verificacion: m.estadoVerificacion,
  };
}

/* POST /pagos/medios */
const registrarMedio = asyncHandler(async (req, res) => {
  const {
    tipo, entidad, numero_identificador, moneda, saldo_disponible,
    cvv, vencimiento, titular, numero_cheque, banco, cbu, monto_certificado,
  } = req.body;
  if (!['CUENTA', 'TARJETA', 'CHEQUE'].includes(tipo)) throw new AppError('Tipo de medio inválido', 400);
  if (!entidad || String(entidad).trim() === '') throw new AppError('Indicá la entidad emisora', 400);

  const datos = {
    cliente: req.usuario.id, tipo, entidad: String(entidad).trim(), moneda: moneda || 'ARS',
    estadoVerificacion: 'Pendiente', saldoDisponible: 0, montoCertificado: 0,
  };
  if (tipo === 'TARJETA') {
    const r = validarTarjeta({ numero: numero_identificador, cvv, vencimiento });
    if (!r.ok) throw new AppError(r.motivo, 400);
    if (!titular || String(titular).trim().length < 3) throw new AppError('Ingresá el titular de la tarjeta', 400);
    datos.marca = r.marca; datos.titular = String(titular).trim(); datos.vencimiento = String(vencimiento).trim();
    datos.numeroIdentificador = `**** ${r.ultimos4}`;
    datos.saldoDisponible = saldo_disponible != null ? Number(saldo_disponible) : SALDO_DEFAULT;
  } else if (tipo === 'CHEQUE') {
    const r = validarCheque({ numero_cheque, banco, monto_certificado, cbu });
    if (!r.ok) throw new AppError(r.motivo, 400);
    datos.numeroCheque = String(numero_cheque).trim(); datos.banco = String(banco).trim();
    if (cbu) datos.cbu = String(cbu).replace(/\D/g, '');
    datos.montoCertificado = Number(monto_certificado); datos.saldoDisponible = Number(monto_certificado);
    datos.numeroIdentificador = `CH-${String(numero_cheque).trim()}`;
  } else {
    const idc = String(numero_identificador || '').trim();
    if (idc.length < 4) throw new AppError('Ingresá un identificador de cuenta válido (CBU/alias)', 400);
    const soloDig = idc.replace(/\D/g, '');
    if (soloDig.length === 22) { const r = validarCBU(soloDig); if (!r.ok) throw new AppError(r.motivo, 400); }
    datos.numeroIdentificador = idc;
    datos.saldoDisponible = saldo_disponible != null ? Number(saldo_disponible) : SALDO_DEFAULT;
  }
  const medio = await MedioPago.create(datos);
  res.status(201).json({ id_medio: medio.identificador, estado_verificacion: medio.estadoVerificacion, mensaje: 'Medio registrado. Queda en verificación.' });
});

/* GET /pagos/medios */
const listarMedios = asyncHandler(async (req, res) => {
  const medios = await MedioPago.findAll({ where: { cliente: req.usuario.id }, order: [['createdAt', 'DESC']] });
  res.status(200).json(medios.map(medioAPI));
});

/* GET /pagos/medios/:id/estado */
const estadoMedio = asyncHandler(async (req, res) => {
  const medio = await MedioPago.findOne({ where: { identificador: req.params.id, cliente: req.usuario.id } });
  if (!medio) throw new AppError('Medio de pago no encontrado', 404);
  res.status(200).json({ id_medio: medio.identificador, estado: medio.estadoVerificacion });
});

/* DELETE /pagos/medios/:id */
const eliminarMedio = asyncHandler(async (req, res) => {
  const medio = await MedioPago.findOne({ where: { identificador: req.params.id, cliente: req.usuario.id } });
  if (!medio) throw new AppError('Medio de pago no encontrado', 404);
  await medio.destroy();
  res.status(200).json({ mensaje: 'Medio de pago eliminado', id_medio: Number(req.params.id) });
});

/* ADMIN */
const adminListarMedios = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.estado) where.estadoVerificacion = req.query.estado;
  const medios = await MedioPago.findAll({ where, order: [['createdAt', 'DESC']], include: [{ model: Cliente, as: 'clienteRel' }] });
  res.status(200).json(medios.map((m) => ({ ...medioAPI(m), cliente_id: m.cliente })));
});

const adminVerificarMedio = asyncHandler(async (req, res) => {
  const { aprobar, saldo_disponible } = req.body;
  const medio = await MedioPago.findByPk(req.params.id);
  if (!medio) throw new AppError('Medio de pago no encontrado', 404);
  medio.estadoVerificacion = aprobar === false ? 'Rechazado' : 'Verificado';
  if (medio.estadoVerificacion === 'Verificado' && saldo_disponible != null) medio.saldoDisponible = Number(saldo_disponible);
  await medio.save();
  res.status(200).json({ id_medio: medio.identificador, estado_verificacion: medio.estadoVerificacion, saldo_disponible: Number(medio.saldoDisponible) });
});

module.exports = { registrarMedio, listarMedios, eliminarMedio, estadoMedio, adminListarMedios, adminVerificarMedio };
