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

  // Helper: genera 6 fotos TEMÁTICAS según el objeto (consigna: ~6 imágenes).
  // LoremFlickr devuelve fotos reales que coinciden con las palabras clave; el
  // parámetro lock da una imagen distinta (pero estable) por cada una.
  const fotos = (kw) => Array.from({ length: 6 }, (_, i) =>
    `https://loremflickr.com/500/500/${encodeURIComponent(kw)}?lock=${i + 1}`);

  /* ------------------------- Subasta en pesos (plata) ----------------- */
  const subastaArs = await Subasta.create({
    titulo: 'Subasta de Colección — Plata', fecha: '2026-05-15', hora: '18:00',
    moneda: 'ARS', categoria_requerida: 'plata', rematador: 'J. Pérez',
    ubicacion: 'Salón Central', url_stream: 'wss://stream.bidmaster.com/104',
    estado: 'programada',
  });
  await Pieza.bulkCreate([
    {
      nro_pieza: 101, categoria: 'arte', tags: ['Vintage','Colección','Impecable'], uso: 'usado', titulo: 'Juego de Té (18 piezas)',
      descripcion: 'Juego de porcelana inglesa de 18 piezas, pintado a mano.', precio_base: 45000,
      historia: 'Vajilla de una estancia bonaerense de principios del siglo XX.',
      imagenes: fotos('tea,set,porcelain'), subasta_id: subastaArs.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 102, categoria: 'arte', tags: ['Arte','Exclusivo','Raro'], uso: 'usado', titulo: 'Cuadro Vanguardista',
      descripcion: 'Óleo sobre tela, corriente vanguardista.', precio_base: 180000,
      artista: 'A. Spilimbergo', fecha_obra: '1945',
      historia: 'Perteneció a una colección privada europea.',
      imagenes: fotos('painting,art'), subasta_id: subastaArs.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 103, categoria: 'arte', tags: ['Vintage','Colección','Impecable'], uso: 'restaurado', titulo: 'Reloj de Pie Inglés',
      descripcion: 'Reloj de pie de roble, mecanismo a péndulo funcionando.', precio_base: 95000,
      fecha_obra: '1890', historia: 'Restaurado por relojeros de la casa Mappin.',
      imagenes: fotos('grandfather,clock'), subasta_id: subastaArs.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 104, categoria: 'arte', tags: ['Vintage','Exclusivo'], uso: 'usado', titulo: 'Lámpara Art Déco',
      descripcion: 'Lámpara de bronce y vidrio opalino, estilo Art Déco.', precio_base: 38000,
      artista: 'Taller Lalique (atrib.)', fecha_obra: '1925',
      imagenes: fotos('lamp,art,deco'), subasta_id: subastaArs.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 105, categoria: 'joyas', tags: ['Colección','Raro','Lujo'], uso: 'usado', titulo: 'Colección de Monedas de Plata',
      descripcion: 'Set de 24 monedas de plata 900, distintas épocas.', precio_base: 60000,
      historia: 'Incluye piezas patrias de la primera moneda nacional.',
      imagenes: fotos('silver,coins'), subasta_id: subastaArs.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 106, categoria: 'tecnologia', tags: ['Vintage','Colección','Impecable'], uso: 'restaurado', titulo: 'Máquina de Escribir Olivetti',
      descripcion: 'Olivetti Lettera 32 restaurada, con estuche original.', precio_base: 22000,
      fecha_obra: '1963', historia: 'Modelo usado por cronistas de la época.',
      imagenes: fotos('typewriter'), subasta_id: subastaArs.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 107, categoria: 'arte', tags: ['Arte','Exclusivo','Raro'], uso: 'usado', titulo: 'Escultura en Bronce',
      descripcion: 'Figura femenina en bronce patinado, base de mármol.', precio_base: 130000,
      artista: 'L. Falcini', fecha_obra: '1938',
      imagenes: fotos('bronze,sculpture'), subasta_id: subastaArs.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 108, categoria: 'hobbies', tags: ['Exclusivo','Impecable'], uso: 'poco_uso', titulo: 'Guitarra Criolla de Autor',
      descripcion: 'Guitarra de luthier, tapa de cedro y aros de palo santo.', precio_base: 70000,
      historia: 'Construida por un luthier reconocido de la escena folclórica.',
      imagenes: fotos('classical,guitar'), subasta_id: subastaArs.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 109, categoria: 'arte', tags: ['Vintage','Colección','Impecable'], uso: 'usado', titulo: 'Vajilla de Porcelana (PAQUETE · 32 piezas)',
      descripcion: 'Lote de 32 piezas de porcelana: platos, tazas, fuentes y bandejas.', precio_base: 52000,
      historia: 'Servicio completo de una casa señorial, sin faltantes.',
      imagenes: fotos('porcelain,tableware'), subasta_id: subastaArs.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 110, categoria: 'hobbies', tags: ['Vintage','Colección'], uso: 'usado', titulo: 'Lote de Vinilos de Jazz (PAQUETE · 40 discos)',
      descripcion: 'Colección de 40 discos de vinilo de jazz, décadas del 50 al 70.', precio_base: 34000,
      historia: 'Incluye ediciones originales de sellos reconocidos.',
      imagenes: fotos('vinyl,records'), subasta_id: subastaArs.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 111, categoria: 'tecnologia', tags: ['Fotografía','Vintage','Impecable'], uso: 'usado', titulo: 'Cámara Réflex Nikon',
      descripcion: 'Cámara réflex Nikon a película, con lente 50mm.', precio_base: 28000,
      fecha_obra: '1985', historia: 'Mantenida por un fotógrafo profesional.',
      imagenes: fotos('nikon,camera'), subasta_id: subastaArs.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 112, categoria: 'arte', tags: ['Vintage','Exclusivo'], uso: 'usado', titulo: 'Espejo Veneciano',
      descripcion: 'Espejo de cristal de Murano con marco tallado a mano.', precio_base: 48000,
      imagenes: fotos('venetian,mirror'), subasta_id: subastaArs.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 113, categoria: 'hobbies', tags: ['Vintage','Colección','Impecable'], uso: 'restaurado', titulo: 'Reloj Cucú Suizo',
      descripcion: 'Reloj cucú de madera tallada, mecanismo restaurado y funcionando.', precio_base: 26000,
      fecha_obra: '1950', imagenes: fotos('cuckoo,clock'), subasta_id: subastaArs.id, dueno_id: facundo.id,
    },
  ]);

  /* ------------------------ Subasta en dólares (plata) ---------------- */
  const subastaUsd = await Subasta.create({
    titulo: 'Relojería de Lujo — Plata', fecha: '2026-05-15', hora: '17:00',
    moneda: 'USD', categoria_requerida: 'plata', rematador: 'M. López',
    ubicacion: 'Salón VIP', url_stream: 'wss://stream.bidmaster.com/105',
    estado: 'programada',
  });
  await Pieza.bulkCreate([
    {
      nro_pieza: 402, categoria: 'joyas', tags: ['Lujo','Vintage','Exclusivo'], uso: 'usado', titulo: 'Reloj Rolex Vintage (1960)',
      descripcion: 'Reloj Rolex Ref #402, edición de colección.', precio_base: 10000,
      artista: 'Rolex Geneva', fecha_obra: '1960',
      historia: 'Perteneció a la colección de un diplomático europeo. Estuche original.',
      imagenes: fotos('rolex,watch'),
      subasta_id: subastaUsd.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 403, categoria: 'joyas', tags: ['Lujo','Garantía Oficial'], uso: 'poco_uso', titulo: 'Omega Speedmaster',
      descripcion: 'Cronógrafo Omega Speedmaster, acero, caja de 42mm.', precio_base: 6500,
      artista: 'Omega', fecha_obra: '1998',
      imagenes: fotos('chronograph,watch'), subasta_id: subastaUsd.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 404, categoria: 'joyas', tags: ['Lujo','Vintage','Exclusivo'], uso: 'usado', titulo: 'Cartier Tank',
      descripcion: 'Reloj Cartier Tank, oro amarillo 18k, correa de cuero.', precio_base: 12000,
      artista: 'Cartier', fecha_obra: '1975',
      imagenes: fotos('gold,watch'), subasta_id: subastaUsd.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 405, categoria: 'moda', tags: ['Lujo','Edición Especial'], uso: 'nuevo', titulo: 'Pluma Montblanc Meisterstück',
      descripcion: 'Pluma estilográfica Montblanc, plumín de oro 14k.', precio_base: 1800,
      artista: 'Montblanc', imagenes: fotos('fountain,pen'),
      subasta_id: subastaUsd.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 406, categoria: 'joyas', tags: ['Lujo','Vintage','Colección'], uso: 'usado', titulo: 'Set de Relojes de Bolsillo (PAQUETE · 3 piezas)',
      descripcion: 'Tres relojes de bolsillo de plata y oro, con sus cadenas.', precio_base: 4500,
      historia: 'Procedentes de una relojería suiza centenaria.',
      imagenes: fotos('pocket,watch'), subasta_id: subastaUsd.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 407, categoria: 'joyas', tags: ['Lujo','Exclusivo','Raro'], uso: 'nuevo', titulo: 'Anillo de Diamantes',
      descripcion: 'Anillo de oro blanco 18k con diamante central de 1.2 ct.', precio_base: 9000,
      historia: 'Certificado gemológico GIA incluido.',
      imagenes: fotos('diamond,ring'), subasta_id: subastaUsd.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 408, categoria: 'moda', tags: ['Lujo','Edición Especial'], uso: 'nuevo', titulo: 'Gemelos de Oro (PAQUETE · par + estuche)',
      descripcion: 'Par de gemelos de oro 18k con su estuche de cuero original.', precio_base: 2200,
      imagenes: fotos('cufflinks,gold'), subasta_id: subastaUsd.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 409, categoria: 'joyas', tags: ['Lujo','Garantía Oficial','Impecable'], uso: 'poco_uso', titulo: 'Reloj TAG Heuer',
      descripcion: 'Cronógrafo TAG Heuer de acero, movimiento automático.', precio_base: 3200,
      artista: 'TAG Heuer', imagenes: fotos('tagheuer,watch'), subasta_id: subastaUsd.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 410, categoria: 'moda', tags: ['Lujo','Exclusivo'], uso: 'nuevo', titulo: 'Anteojos de Diseñador',
      descripcion: 'Anteojos de sol de diseñador, edición limitada con estuche.', precio_base: 800,
      imagenes: fotos('luxury,sunglasses'), subasta_id: subastaUsd.id, dueno_id: facundo.id,
    },
  ]);

  /* ------------------- Subasta premium (oro) -------------------------- */
  // Categoría oro: facundo (plata) NO puede entrar; Lucía (oro) sí. Sin tope de puja.
  const subastaOro = await Subasta.create({
    titulo: 'Maestros del Arte — Oro', fecha: '2026-05-16', hora: '20:00',
    moneda: 'ARS', categoria_requerida: 'oro', rematador: 'C. Iturrioz',
    ubicacion: 'Salón Imperial', url_stream: 'wss://stream.bidmaster.com/106',
    estado: 'programada',
  });
  await Pieza.bulkCreate([
    {
      nro_pieza: 201, categoria: 'arte', tags: ['Arte','Exclusivo','Raro','Limitado'], uso: 'usado', titulo: 'Óleo de Gran Maestro',
      descripcion: 'Óleo sobre tela de gran formato, marco de época.', precio_base: 1500000,
      artista: 'B. Quinquela Martín', fecha_obra: '1932',
      historia: 'Vista del puerto de La Boca. Procedencia documentada.',
      imagenes: fotos('harbor,painting'), subasta_id: subastaOro.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 202, categoria: 'joyas', tags: ['Lujo','Exclusivo','Raro'], uso: 'nuevo', titulo: 'Collar de Esmeraldas',
      descripcion: 'Collar de oro 18k con esmeraldas colombianas y diamantes.', precio_base: 2200000,
      historia: 'Joya de alta relojería, certificado gemológico incluido.',
      imagenes: fotos('emerald,necklace'), subasta_id: subastaOro.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 203, categoria: 'hobbies', tags: ['Colección','Raro','Limitado'], uso: 'usado', titulo: 'Primera Edición Firmada',
      descripcion: 'Primera edición de una obra cumbre, firmada por el autor.', precio_base: 850000,
      fecha_obra: '1944', historia: 'Ejemplar numerado de una tirada limitada.',
      imagenes: fotos('antique,book'), subasta_id: subastaOro.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 204, categoria: 'arte', tags: ['Arte','Colección','Limitado'], uso: 'usado', titulo: 'Colección de Grabados (PAQUETE · 6 obras)',
      descripcion: 'Seis grabados originales numerados y firmados, enmarcados.', precio_base: 700000,
      artista: 'A. Berni', fecha_obra: '1960',
      historia: 'Serie completa proveniente de una colección privada.',
      imagenes: fotos('engraving,art'), subasta_id: subastaOro.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 205, categoria: 'joyas', tags: ['Lujo','Exclusivo','Garantía Oficial'], uso: 'poco_uso', titulo: 'Reloj de Lujo Suizo',
      descripcion: 'Reloj suizo de alta gama, caja de oro y movimiento automático.', precio_base: 1800000,
      artista: 'Patek Philippe', fecha_obra: '2005',
      historia: 'Con caja, papeles y certificado de autenticidad.',
      imagenes: fotos('luxury,watch'), subasta_id: subastaOro.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 206, categoria: 'arte', tags: ['Arte','Exclusivo','Raro'], uso: 'usado', titulo: 'Escultura de Mármol',
      descripcion: 'Escultura de mármol de Carrara, figura clásica de gran porte.', precio_base: 1200000,
      artista: 'Escuela italiana', fecha_obra: '1890',
      historia: 'Pieza de jardín de una residencia histórica.',
      imagenes: fotos('marble,sculpture'), subasta_id: subastaOro.id, dueno_id: facundo.id,
    },
  ]);

  /* ------------- Subasta abierta (común) — accesible para todos -------- */
  const subastaComun = await Subasta.create({
    titulo: 'Tecnología y Coleccionables — Abierta', fecha: '2026-05-18', hora: '19:30',
    moneda: 'ARS', categoria_requerida: 'comun', rematador: 'S. Ramírez',
    ubicacion: 'Salón Norte', url_stream: 'wss://stream.bidmaster.com/107',
    estado: 'programada',
  });
  await Pieza.bulkCreate([
    {
      nro_pieza: 301, categoria: 'tecnologia', tags: ['Consolas','Edición Especial'], uso: 'sellado', titulo: 'Consola PlayStation 5 (sellada)',
      descripcion: 'PlayStation 5 nueva, en su caja sellada de fábrica.', precio_base: 90000,
      imagenes: fotos('playstation,console'), subasta_id: subastaComun.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 302, categoria: 'tecnologia', tags: ['Consolas','Vintage','Colección'], uso: 'usado', titulo: 'Lote de Juegos Retro (PAQUETE · 15 cartuchos)',
      descripcion: 'Quince cartuchos de consolas clásicas, todos funcionando.', precio_base: 40000,
      historia: 'Colección armada durante dos décadas.',
      imagenes: fotos('videogame,cartridge'), subasta_id: subastaComun.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 303, categoria: 'tecnologia', tags: ['Consolas','Garantía Oficial'], uso: 'poco_uso', titulo: 'Nintendo Switch',
      descripcion: 'Nintendo Switch con dos joy-cons y dock original.', precio_base: 55000,
      imagenes: fotos('nintendo,switch'), subasta_id: subastaComun.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 304, categoria: 'tecnologia', tags: ['Fotografía','Lujo','Impecable'], uso: 'usado', titulo: 'Lente Leica',
      descripcion: 'Objetivo Leica de 35mm, óptica impecable.', precio_base: 120000,
      imagenes: fotos('leica,lens'), subasta_id: subastaComun.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 305, categoria: 'moda', tags: ['Deportes','Exclusivo','Raro'], uso: 'usado', titulo: 'Camiseta de Fútbol Firmada',
      descripcion: 'Camiseta oficial firmada por el plantel campeón.', precio_base: 65000,
      historia: 'Con certificado de autenticidad de la firma.',
      imagenes: fotos('soccer,jersey'), subasta_id: subastaComun.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 306, categoria: 'hobbies', tags: ['Colección','Edición Especial'], uso: 'nuevo', titulo: 'Set de Figuras Coleccionables (PAQUETE · 10 figuras)',
      descripcion: 'Diez figuras a escala de edición limitada, en caja.', precio_base: 30000,
      imagenes: fotos('action,figures'), subasta_id: subastaComun.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 307, categoria: 'vehiculos', tags: ['Exclusivo','Impecable'], uso: 'poco_uso', titulo: 'Bicicleta de Alta Gama',
      descripcion: 'Bicicleta de ruta de fibra de carbono, grupo profesional.', precio_base: 150000,
      imagenes: fotos('road,bicycle'), subasta_id: subastaComun.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 308, categoria: 'tecnologia', tags: ['Tecnología','Garantía Oficial','Impecable'], uso: 'poco_uso', titulo: 'Notebook Gamer',
      descripcion: 'Notebook gamer, 16GB RAM y placa de video dedicada.', precio_base: 110000,
      imagenes: fotos('gaming,laptop'), subasta_id: subastaComun.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 309, categoria: 'tecnologia', tags: ['Tecnología','Lujo'], uso: 'nuevo', titulo: 'Auriculares Premium',
      descripcion: 'Auriculares inalámbricos con cancelación de ruido.', precio_base: 35000,
      imagenes: fotos('headphones'), subasta_id: subastaComun.id, dueno_id: oro.id,
    },
    {
      nro_pieza: 310, categoria: 'tecnologia', tags: ['Fotografía','Tecnología'], uso: 'usado', titulo: 'Cámara GoPro',
      descripcion: 'Cámara de acción GoPro con kit de accesorios.', precio_base: 28000,
      imagenes: fotos('gopro,action,camera'), subasta_id: subastaComun.id, dueno_id: facundo.id,
    },
    {
      nro_pieza: 311, categoria: 'hobbies', tags: ['Deportes','Impecable'], uso: 'poco_uso', titulo: 'Skate Profesional',
      descripcion: 'Skate profesional de arce canadiense, ruedas de competición.', precio_base: 18000,
      imagenes: fotos('skateboard'), subasta_id: subastaComun.id, dueno_id: oro.id,
    },
  ]);

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
