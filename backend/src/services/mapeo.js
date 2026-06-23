const { Pujo, Asistente, Producto, Foto, ClasificacionProducto, Catalogo } = require('../models');

/** Oferta líder de un item (mayor importe de pujos) y el cliente que la hizo. */
async function ofertaLider(itemId) {
  const top = await Pujo.findOne({
    where: { item: itemId },
    order: [['importe', 'DESC']],
    include: [{ model: Asistente, as: 'asistenteRel' }],
  });
  if (!top) return { oferta_actual: 0, lider_id: null };
  return { oferta_actual: Number(top.importe), lider_id: top.asistenteRel ? top.asistenteRel.cliente : null };
}

/** Mapea un ItemCatalogo (+ producto + fotos + clasificación) al shape "pieza"
 *  que ya consume el frontend (id_pieza, titulo, precio_base, imagenes, etc.). */
async function mapItem(item, { logueado = true } = {}) {
  const prod = item.productoRel || await Producto.findByPk(item.producto, {
    include: [{ model: Foto, as: 'fotos' }, { model: ClasificacionProducto, as: 'clasificacion' }],
  });
  const fotos = (prod && prod.fotos ? prod.fotos : []).map((f) => f.foto);
  const clas = (prod && prod.clasificacion) || {};
  const { oferta_actual, lider_id } = await ofertaLider(item.identificador);
  const cat = item.catalogoRel || await Catalogo.findByPk(item.catalogo);
  return {
    id_pieza: item.identificador,
    nro_pieza: item.identificador,
    titulo: prod ? prod.descripcionCatalogo : 'Ítem',
    descripcion: prod ? prod.descripcionCompleta : '',
    artista: null,
    fecha_obra: null,
    historia: null,
    imagenes: fotos,
    categoria: clas.categoria || null,
    tags: clas.tags || [],
    uso: clas.uso || null,
    precio_base: logueado ? Number(item.precioBase) : null,
    oferta_actual,
    lider_id,
    estado: item.subastado === 'si' ? 'vendida' : 'en_subasta',
    subasta_id: cat ? cat.subasta : null,
    dueno_id: prod ? prod.duenio : null,
  };
}

module.exports = { ofertaLider, mapItem };
