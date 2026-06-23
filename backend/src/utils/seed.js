require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  sequelize, Pais, Empleado, Sector, Persona, Cuenta, Cliente, Duenio, Subastador,
  Seguro, Subasta, Producto, Foto, Catalogo, ItemCatalogo, ClasificacionProducto,
} = require('../models');

/**
 * Seed sobre el esquema OBLIGATORIO de la cátedra (personas/clientes/duenios/
 * empleados/subastadores, productos+fotos+seguros, catalogos+itemsCatalogo, etc.)
 * + tablas nuevas (cuentas, clasificacionProducto).
 */
const fotos = (kw, n = 6) => Array.from({ length: n }, (_, i) =>
  `https://loremflickr.com/500/500/${encodeURIComponent(kw)}?lock=${i + 1}`);

async function seed() {
  await sequelize.sync({ force: true });
  const hash = await bcrypt.hash('123456', 10);
  const fechaSubasta = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  /* ----------------------------- Países ------------------------------- */
  await Pais.bulkCreate([
    { numero: 32, nombre: 'Argentina', nombreCorto: 'ARG', capital: 'Buenos Aires', nacionalidad: 'argentina', idiomas: 'español' },
    { numero: 76, nombre: 'Brasil', nombreCorto: 'BRA', capital: 'Brasilia', nacionalidad: 'brasileña', idiomas: 'portugués' },
    { numero: 840, nombre: 'Estados Unidos', nombreCorto: 'USA', capital: 'Washington', nacionalidad: 'estadounidense', idiomas: 'inglés' },
  ]);

  /* ----------------------- Empleado + Sector -------------------------- */
  const emp = await Empleado.create({ cargo: 'Verificador / Revisor' });
  const sector = await Sector.create({ nombreSector: 'Operaciones', codigoSector: 'OPS', responsableSector: emp.identificador });
  await emp.update({ sector: sector.identificador });

  /* --------------------------- Subastador ----------------------------- */
  const pSub = await Persona.create({ documento: '20111222', nombre: 'Julio Pérez', direccion: 'Av. Central 100', estado: 'activo' });
  const subastador = await Subastador.create({ identificador: pSub.identificador, matricula: 'MART-001', region: 'CABA' });

  /* ------------------------------ Dueño ------------------------------- */
  const pDue = await Persona.create({ documento: '20333444', nombre: 'Galería del Plata', direccion: 'Calle Arte 500', estado: 'activo' });
  const duenio = await Duenio.create({
    identificador: pDue.identificador, numeroPais: 32, verificacionFinanciera: 'si',
    verificacionJudicial: 'si', calificacionRiesgo: 2, verificador: emp.identificador,
  });

  /* --------- Clientes (persona + cliente + cuenta de acceso) ---------- */
  async function crearCliente(nombre, documento, email, categoria) {
    const p = await Persona.create({ documento, nombre, direccion: 'Domicilio de prueba 123', estado: 'activo' });
    await Cliente.create({ identificador: p.identificador, numeroPais: 32, admitido: 'si', categoria, verificador: emp.identificador });
    await Cuenta.create({ persona: p.identificador, email, passwordHash: hash });
    return p.identificador;
  }
  const facundo = await crearCliente('Facundo Pérez', '30111111', 'facundo@ejemplo.com', 'plata');
  await crearCliente('Lucía Gómez', '30222222', 'oro@ejemplo.com', 'oro');
  await crearCliente('Nuevo Usuario', '30333333', 'nuevo@ejemplo.com', 'comun');

  /* ----------------------------- Seguros ------------------------------ */
  await Seguro.create({ nroPoliza: 'POL-0001', compania: 'Seguros Patria S.A.', polizaCombinada: 'no', importe: 50000 });

  /* ----------------------------- Subastas ----------------------------- */
  const subPlata = await Subasta.create({
    fecha: fechaSubasta, hora: '18:00', estado: 'abierta', subastador: subastador.identificador,
    ubicacion: 'Salón Central', capacidadAsistentes: 120, tieneDeposito: 'si', seguridadPropia: 'si', categoria: 'plata',
  });
  const subComun = await Subasta.create({
    fecha: fechaSubasta, hora: '19:30', estado: 'abierta', subastador: subastador.identificador,
    ubicacion: 'Salón Norte', capacidadAsistentes: 200, tieneDeposito: 'si', seguridadPropia: 'no', categoria: 'comun',
  });

  const catPlata = await Catalogo.create({ descripcion: 'Colección — Plata', subasta: subPlata.identificador, responsable: emp.identificador });
  const catComun = await Catalogo.create({ descripcion: 'Tecnología y Coleccionables — Abierta', subasta: subComun.identificador, responsable: emp.identificador });

  /* ----------------- Productos (+fotos +clasificación +item) ---------- */
  async function crearProducto(catalogo, p) {
    const prod = await Producto.create({
      fecha: fechaSubasta, disponible: 'si',
      descripcionCatalogo: p.descCatalogo,
      descripcionCompleta: p.descCompleta || 'https://bidmaster.com/docs/descripcion.pdf',
      revisor: emp.identificador, duenio: duenio.identificador, seguro: 'POL-0001',
    });
    await Foto.bulkCreate(fotos(p.kw).map((f) => ({ producto: prod.identificador, foto: f })));
    await ClasificacionProducto.create({ producto: prod.identificador, categoria: p.categoria, tags: p.tags, uso: p.uso });
    await ItemCatalogo.create({
      catalogo, producto: prod.identificador, precioBase: p.precioBase,
      comision: Math.round(p.precioBase * 0.1), subastado: 'no',
    });
  }

  const plata = [
    { descCatalogo: 'Juego de Té (PAQUETE · 18 piezas)', kw: 'tea,set,porcelain', categoria: 'arte', tags: ['Vintage', 'Colección'], uso: 'usado', precioBase: 45000 },
    { descCatalogo: 'Cuadro Vanguardista', kw: 'painting,art', categoria: 'arte', tags: ['Arte', 'Exclusivo'], uso: 'usado', precioBase: 180000 },
    { descCatalogo: 'Reloj de Pie Inglés', kw: 'grandfather,clock', categoria: 'arte', tags: ['Vintage', 'Impecable'], uso: 'restaurado', precioBase: 95000 },
    { descCatalogo: 'Lámpara Art Déco', kw: 'lamp,art,deco', categoria: 'arte', tags: ['Vintage', 'Exclusivo'], uso: 'usado', precioBase: 38000 },
    { descCatalogo: 'Colección de Monedas (PAQUETE · 24)', kw: 'silver,coins', categoria: 'joyas', tags: ['Colección', 'Lujo'], uso: 'usado', precioBase: 60000 },
    { descCatalogo: 'Máquina de Escribir Olivetti', kw: 'typewriter', categoria: 'tecnologia', tags: ['Vintage', 'Colección'], uso: 'restaurado', precioBase: 22000 },
    { descCatalogo: 'Escultura en Bronce', kw: 'bronze,sculpture', categoria: 'arte', tags: ['Arte', 'Raro'], uso: 'usado', precioBase: 130000 },
    { descCatalogo: 'Guitarra Criolla de Autor', kw: 'classical,guitar', categoria: 'hobbies', tags: ['Exclusivo'], uso: 'poco_uso', precioBase: 70000 },
  ];
  const comun = [
    { descCatalogo: 'Consola PlayStation 5 (sellada)', kw: 'playstation,console', categoria: 'tecnologia', tags: ['Consolas', 'Edición Especial'], uso: 'sellado', precioBase: 90000 },
    { descCatalogo: 'Lote de Juegos Retro (PAQUETE · 15)', kw: 'videogame,cartridge', categoria: 'tecnologia', tags: ['Consolas', 'Colección'], uso: 'usado', precioBase: 40000 },
    { descCatalogo: 'Nintendo Switch', kw: 'nintendo,switch', categoria: 'tecnologia', tags: ['Consolas'], uso: 'poco_uso', precioBase: 55000 },
    { descCatalogo: 'Lente Leica', kw: 'leica,lens', categoria: 'tecnologia', tags: ['Fotografía', 'Lujo'], uso: 'usado', precioBase: 120000 },
    { descCatalogo: 'Camiseta de Fútbol Firmada', kw: 'soccer,jersey', categoria: 'moda', tags: ['Deportes', 'Raro'], uso: 'usado', precioBase: 65000 },
    { descCatalogo: 'Bicicleta de Alta Gama', kw: 'road,bicycle', categoria: 'vehiculos', tags: ['Exclusivo'], uso: 'poco_uso', precioBase: 150000 },
  ];
  for (const p of plata) await crearProducto(catPlata.identificador, p);
  for (const p of comun) await crearProducto(catComun.identificador, p);

  // eslint-disable-next-line no-console
  console.log('✅ Seed (esquema cátedra) completo.');
  console.log(`   ${plata.length + comun.length} productos · 2 subastas · clientes: facundo/oro/nuevo@ejemplo.com (pass: 123456)`);
  await sequelize.close();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error en el seed:', err);
  process.exit(1);
});
