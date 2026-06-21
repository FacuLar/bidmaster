require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  sequelize, Usuario, MedioPago, Subasta, Pieza, Articulo,
} = require('../models');

/**
 * Carga datos de prueba alineados con los wireframes de la Primera Entrega
 * (Juego de Té, Reloj Rolex, Cuadro Vanguardista, etc.).
 */
async function seed() {
  await sequelize.sync({ force: true }); // recrea las tablas
  const hash = await bcrypt.hash('123456', 10);

  /* ----------------------------- Usuarios ----------------------------- */
  const facundo = await Usuario.create({
    nombre: 'Facundo', apellido: 'Pérez', email: 'facundo@ejemplo.com',
    password_hash: hash, categoria: 'plata', domicilio_legal: 'Av. Siempreviva 742',
    pais_origen: 'Argentina', cuenta_cobro: 'AR-1234567890',
  });
  const oro = await Usuario.create({
    nombre: 'Lucía', apellido: 'Gómez', email: 'oro@ejemplo.com',
    password_hash: hash, categoria: 'oro', domicilio_legal: 'Calle Falsa 123',
    pais_origen: 'Argentina',
  });
  const comun = await Usuario.create({
    nombre: 'Nuevo', apellido: 'Usuario', email: 'nuevo@ejemplo.com',
    password_hash: hash, categoria: 'comun', domicilio_legal: 'Sin domicilio',
    pais_origen: 'Argentina',
  });

  /* --------------------------- Medios de pago ------------------------- */
  await MedioPago.create({
    tipo: 'TARJETA', entidad: 'Visa', numero_identificador: '**** 6467',
    marca: 'VISA', titular: 'Facundo Pérez', vencimiento: '08/30',
    moneda: 'ARS', saldo_disponible: 500000, estado_verificacion: 'Verificado', usuario_id: facundo.id,
  });
  // Cuenta en USD verificada: habilita pujar en subastas en dólares.
  await MedioPago.create({
    tipo: 'CUENTA', entidad: 'Citibank', numero_identificador: 'USD-7777',
    moneda: 'USD', saldo_disponible: 80000, estado_verificacion: 'Verificado', usuario_id: facundo.id,
  });
  // Cheque certificado con saldo bajo: sirve para probar el flujo de multa
  // (si el total a pagar supera el saldo garantizado -> multa del 10%).
  await MedioPago.create({
    tipo: 'CHEQUE', entidad: 'Banco Nación', numero_identificador: 'CH-0001',
    monto_certificado: 20000, saldo_disponible: 20000, moneda: 'ARS',
    estado_verificacion: 'Verificado', usuario_id: facundo.id,
  });
  await MedioPago.create({
    tipo: 'CUENTA', entidad: 'Citibank', numero_identificador: 'USD-9001',
    moneda: 'USD', saldo_disponible: 80000, estado_verificacion: 'Verificado', usuario_id: oro.id,
  });

  /* ------------------------- Subasta en pesos ------------------------- */
  const subastaArs = await Subasta.create({
    titulo: 'Subasta de Colección — Plata', fecha: '2026-05-15', hora: '18:00',
    moneda: 'ARS', categoria_requerida: 'plata', rematador: 'J. Pérez',
    ubicacion: 'Salón Central', url_stream: 'wss://stream.bidmaster.com/104',
    estado: 'activa',
  });
  await Pieza.bulkCreate([
    {
      nro_pieza: 101, titulo: 'Juego de Té (18 piezas)',
      descripcion: 'Juego de porcelana de 18 piezas.', precio_base: 45000,
      imagenes: ['https://picsum.photos/seed/te1/400', 'https://picsum.photos/seed/te2/400'],
      subasta_id: subastaArs.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 102, titulo: 'Cuadro Vanguardista',
      descripcion: 'Óleo sobre tela, corriente vanguardista.', precio_base: 180000,
      artista: 'A. Spilimbergo', fecha_obra: '1945',
      historia: 'Perteneció a una colección privada europea.',
      imagenes: ['https://picsum.photos/seed/cuadro/400'],
      subasta_id: subastaArs.id, dueno_id: oro.id,
    },
  ]);

  /* ------------------------ Subasta en dólares ------------------------ */
  const subastaUsd = await Subasta.create({
    titulo: 'Relojería de Lujo — Plata', fecha: '2026-05-15', hora: '17:00',
    moneda: 'USD', categoria_requerida: 'plata', rematador: 'M. López',
    ubicacion: 'Salón VIP', url_stream: 'wss://stream.bidmaster.com/105',
    estado: 'activa',
  });
  await Pieza.create({
    nro_pieza: 402, titulo: 'Reloj Rolex Vintage (1960)',
    descripcion: 'Reloj Rolex Ref #402, edición de colección.', precio_base: 10000,
    artista: 'Rolex Geneva', fecha_obra: '1960',
    historia: 'Este reloj perteneció a la colección privada de un diplomático europeo. '
      + 'Se conserva en su estuche original de cuero y madera.',
    imagenes: ['https://picsum.photos/seed/rolex1/400', 'https://picsum.photos/seed/rolex2/400'],
    oferta_actual: 15000,
    subasta_id: subastaUsd.id, dueno_id: oro.id,
  });

  /* ---------------- Artículos propuestos (Módulo 5) --------------------- */
  // Tasado: espera que el vendedor acepte el valor base + comisión + fecha.
  await Articulo.create({
    titulo: 'Consola retro', descripcion: 'Consola de los años 90 funcionando.',
    tipo_bien: 'otro', acepta_terminos: true,
    fotos: Array.from({ length: 6 }, (_, i) => `https://picsum.photos/seed/consola${i}/300`),
    acepta_devolucion: true, declaracion_jurada_licita: true, acredita_origen: true,
    estado: 'Tasado', valor_base_sugerido: 12000, comisiones: 10,
    fecha_subasta: '2026-07-15', ubicacion_deposito: 'Centro Logístico Sur - Pasillo 4B',
    seguro_compania: 'Seguros Patria S.A.', seguro_cobertura: 12000,
    usuario_id: facundo.id,
  });
  // Vendido: el vendedor solo ve cuánto se vendió y la comisión (#19).
  await Articulo.create({
    titulo: 'Reloj de bolsillo antiguo', descripcion: 'Pieza de colección, 1920.',
    tipo_bien: 'otro', acepta_terminos: true,
    fotos: Array.from({ length: 6 }, (_, i) => `https://picsum.photos/seed/reloj${i}/300`),
    acepta_devolucion: true, declaracion_jurada_licita: true, acredita_origen: true,
    estado: 'Vendido', valor_base_sugerido: 30000, comisiones: 10, monto_venta: 48000,
    fecha_subasta: '2026-05-20', usuario_id: facundo.id,
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed completo.');
  console.log('   Usuarios: facundo@ejemplo.com / oro@ejemplo.com / nuevo@ejemplo.com (pass: 123456)');
  await sequelize.close();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error en el seed:', err);
  process.exit(1);
});
