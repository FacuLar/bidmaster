/**
 * Jerarquía de categorías. Un usuario puede acceder a una subasta si su
 * categoría es >= a la requerida por la subasta.
 */
const ORDEN = ['comun', 'especial', 'plata', 'oro', 'platino'];

function nivel(categoria) {
  const i = ORDEN.indexOf(categoria);
  return i === -1 ? 0 : i;
}

/** ¿La categoría del usuario alcanza para la categoría requerida? */
function puedeAcceder(categoriaUsuario, categoriaRequerida) {
  return nivel(categoriaUsuario) >= nivel(categoriaRequerida);
}

/** Las subastas oro/platino no aplican el límite del 20%. */
function exentoLimiteSuperior(categoriaSubasta) {
  return categoriaSubasta === 'oro' || categoriaSubasta === 'platino';
}

/**
 * Regla del enunciado: "La diversidad de los medios de pago del usuario y su
 * actividad en las subastas permiten mejorar su categoría."
 * Evalúa y eventualmente sube UN nivel la categoría (nunca la baja).
 * Criterio: a más tipos distintos de medios verificados + más subastas ganadas,
 * mayor categoría alcanzable.
 */
function categoriaSugerida({ tiposMediosVerificados = 0, subastasGanadas = 0 }) {
  // puntaje simple: cada tipo de medio distinto y cada win suman.
  const puntaje = tiposMediosVerificados + subastasGanadas;
  if (puntaje >= 6) return 'platino';
  if (puntaje >= 4) return 'oro';
  if (puntaje >= 3) return 'plata';
  if (puntaje >= 2) return 'especial';
  return 'comun';
}

/** Devuelve la mayor entre la categoría actual y la sugerida (nunca degrada). */
function mejorCategoria(actual, sugerida) {
  return nivel(sugerida) > nivel(actual) ? sugerida : actual;
}

module.exports = {
  ORDEN, nivel, puedeAcceder, exentoLimiteSuperior, categoriaSugerida, mejorCategoria,
};
