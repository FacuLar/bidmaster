const { MedioPago } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// Saldo simulado por defecto para tarjetas/cuentas (fondos disponibles del demo).
const SALDO_DEFAULT = 1000000;

/**
 * Validación de tarjeta con el algoritmo de Luhn — la misma técnica que usa la
 * herramienta gratuita de Mercado Libre para chequear que el número de tarjeta
 * sea real (no valida fondos, solo que el número sea matemáticamente válido).
 */
function tarjetaEsValida(numero) {
  const digitos = String(numero).replace(/\D/g, '');
  if (digitos.length < 13 || digitos.length > 19) return false;
  let suma = 0;
  let alternar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = parseInt(digitos[i], 10);
    if (alternar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    alternar = !alternar;
  }
  return suma % 10 === 0;
}

/* 2.1 Registrar Nuevo Medio de Pago — POST /pagos/medios */
const registrarMedio = asyncHandler(async (req, res) => {
  const { tipo, entidad, numero_identificador, monto_certificado, moneda, saldo_disponible } = req.body;
  if (!['CUENTA', 'TARJETA', 'CHEQUE'].includes(tipo)) {
    throw new AppError('Tipo de medio inválido (CUENTA, TARJETA o CHEQUE)', 400);
  }
  if (tipo === 'CHEQUE' && (!monto_certificado || monto_certificado <= 0)) {
    throw new AppError('El cheque requiere un monto certificado', 400);
  }
  if (!entidad || !numero_identificador) {
    throw new AppError('Datos bancarios inválidos', 400);
  }

  // Tarjeta: se verifica el número con la herramienta (Luhn). Si es real, queda
  // verificada al instante; si no, se rechaza.
  let estado_verificacion = 'Pendiente';
  let saldo = 0;
  if (tipo === 'TARJETA') {
    if (!tarjetaEsValida(numero_identificador)) {
      throw new AppError('Número de tarjeta inválido (no pasó la verificación)', 400);
    }
    estado_verificacion = 'Verificado';
    saldo = saldo_disponible != null ? Number(saldo_disponible) : SALDO_DEFAULT;
  } else if (tipo === 'CHEQUE') {
    saldo = monto_certificado;
  } else if (tipo === 'CUENTA') {
    saldo = saldo_disponible != null ? Number(saldo_disponible) : SALDO_DEFAULT;
  }

  const medio = await MedioPago.create({
    tipo,
    entidad,
    numero_identificador,
    monto_certificado: tipo === 'CHEQUE' ? monto_certificado : 0,
    saldo_disponible: saldo,
    estado_verificacion,
    moneda: moneda || 'ARS',
    usuario_id: req.usuario.id,
  });

  res.status(201).json({ id_medio: medio.id, estado_verificacion: medio.estado_verificacion });
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

module.exports = { registrarMedio, listarMedios, estadoMedio };
