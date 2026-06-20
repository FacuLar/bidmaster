const { MedioPago, Usuario } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { validarTarjeta, validarCheque, validarCBU } = require('../utils/validaciones');

// Saldo simulado por defecto para tarjetas/cuentas (fondos disponibles del demo).
const SALDO_DEFAULT = 1000000;

/* 2.1 Registrar Nuevo Medio de Pago — POST /pagos/medios
   El medio se valida en formato y SE GUARDA COMO 'Pendiente'. La verificación
   (alta real) la hace un administrador manualmente desde Postman. Hasta que no
   esté 'Verificado', el medio NO se puede usar para pagar. */
const registrarMedio = asyncHandler(async (req, res) => {
  const {
    tipo, entidad, numero_identificador, moneda, saldo_disponible,
    // Tarjeta:
    cvv, vencimiento, titular,
    // Cheque:
    numero_cheque, banco, cbu, monto_certificado,
  } = req.body;

  if (!['CUENTA', 'TARJETA', 'CHEQUE'].includes(tipo)) {
    throw new AppError('Tipo de medio inválido (CUENTA, TARJETA o CHEQUE)', 400);
  }
  if (!entidad || String(entidad).trim() === '') {
    throw new AppError('Indicá la entidad emisora', 400);
  }

  // Campos que se persisten según el tipo.
  const datos = {
    tipo,
    entidad: String(entidad).trim(),
    moneda: moneda || 'ARS',
    estado_verificacion: 'Pendiente', // SIEMPRE arranca pendiente
    saldo_disponible: 0,
    monto_certificado: 0,
    usuario_id: req.usuario.id,
  };

  if (tipo === 'TARJETA') {
    // Formato real: marca + Luhn + CVV + vencimiento. Si algo falla, se rechaza
    // con un mensaje claro (tarjeta inválida, CVV incorrecto, vencida, etc.).
    const r = validarTarjeta({ numero: numero_identificador, cvv, vencimiento });
    if (!r.ok) throw new AppError(r.motivo, 400);
    if (!titular || String(titular).trim().length < 3) {
      throw new AppError('Ingresá el nombre del titular de la tarjeta', 400);
    }
    datos.marca = r.marca;
    datos.titular = String(titular).trim();
    datos.vencimiento = String(vencimiento).trim();
    // Se guarda enmascarado: NO se persiste el número completo ni el CVV.
    datos.numero_identificador = `**** ${r.ultimos4}`;
    // El saldo real lo confirma el administrador al verificar; default opcional.
    datos.saldo_disponible = saldo_disponible != null ? Number(saldo_disponible) : SALDO_DEFAULT;
  } else if (tipo === 'CHEQUE') {
    const r = validarCheque({ numero_cheque, banco, monto_certificado, cbu });
    if (!r.ok) throw new AppError(r.motivo, 400);
    datos.numero_cheque = String(numero_cheque).trim();
    datos.banco = String(banco).trim();
    if (cbu) datos.cbu = String(cbu).replace(/\D/g, '');
    datos.monto_certificado = Number(monto_certificado);
    datos.saldo_disponible = Number(monto_certificado);
    datos.numero_identificador = `CH-${String(numero_cheque).trim()}`;
  } else { // CUENTA
    const idCuenta = String(numero_identificador || '').trim();
    if (idCuenta.length < 4) {
      throw new AppError('Ingresá un identificador de cuenta válido (CBU/alias)', 400);
    }
    // Si parece un CBU (22 dígitos), se valida con su dígito verificador real.
    const soloDigitos = idCuenta.replace(/\D/g, '');
    if (soloDigitos.length === 22) {
      const r = validarCBU(soloDigitos);
      if (!r.ok) throw new AppError(r.motivo, 400);
    }
    datos.numero_identificador = idCuenta;
    datos.saldo_disponible = saldo_disponible != null ? Number(saldo_disponible) : SALDO_DEFAULT;
  }

  const medio = await MedioPago.create(datos);

  res.status(201).json({
    id_medio: medio.id,
    estado_verificacion: medio.estado_verificacion, // 'Pendiente'
    mensaje: 'Medio registrado. Queda en verificación hasta que sea aprobado.',
  });
});

/* Listar mis medios de pago — GET /pagos/medios (pantalla Billetera) */
const listarMedios = asyncHandler(async (req, res) => {
  const medios = await MedioPago.findAll({
    where: { usuario_id: req.usuario.id },
    order: [['createdAt', 'DESC']],
  });
  res.status(200).json(medios);
});

/* 2.2 Verificar Estado de Medio de Pago — GET /pagos/medios/:id/estado */
const estadoMedio = asyncHandler(async (req, res) => {
  const medio = await MedioPago.findOne({
    where: { id: req.params.id, usuario_id: req.usuario.id },
  });
  if (!medio) throw new AppError('Medio de pago no encontrado', 404);
  res.status(200).json({ id_medio: medio.id, estado: medio.estado_verificacion });
});

/* ===================== ADMIN (sólo por Postman, x-admin-key) ============== */

/* Listar medios pendientes de verificación — GET /admin/pagos/medios?estado=Pendiente */
const adminListarMedios = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.estado) where.estado_verificacion = req.query.estado;
  const medios = await MedioPago.findAll({
    where,
    order: [['createdAt', 'DESC']],
    include: [{ model: Usuario, attributes: ['id', 'nombre', 'apellido', 'email'] }],
  });
  res.status(200).json(medios);
});

/* Verificar / rechazar un medio de pago — PATCH /admin/pagos/medios/:id/verificar
   body: { aprobar: true|false, saldo_disponible?: number } */
const adminVerificarMedio = asyncHandler(async (req, res) => {
  const { aprobar, saldo_disponible } = req.body;
  const medio = await MedioPago.findByPk(req.params.id);
  if (!medio) throw new AppError('Medio de pago no encontrado', 404);

  medio.estado_verificacion = aprobar === false ? 'Rechazado' : 'Verificado';
  // El admin puede ajustar el saldo/fondos confirmados al aprobar.
  if (medio.estado_verificacion === 'Verificado' && saldo_disponible != null) {
    medio.saldo_disponible = Number(saldo_disponible);
  }
  await medio.save();

  res.status(200).json({
    id_medio: medio.id,
    estado_verificacion: medio.estado_verificacion,
    saldo_disponible: medio.saldo_disponible,
  });
});

module.exports = {
  registrarMedio,
  listarMedios,
  estadoMedio,
  adminListarMedios,
  adminVerificarMedio,
};
