/**
 * Smoke test de la lógica de negocio SIN levantar el servidor HTTP.
 * Valida directamente los servicios/modelos contra la BD sembrada.
 * Uso: node src/utils/smoke-test.js   (correr `npm run seed` antes)
 */
require('dotenv').config();
const { sequelize, Usuario, Pieza, Subasta } = require('../models');
const { validarPuja, registrarPuja, calcularLimites } = require('../services/pujaService');
const { puedeAcceder } = require('../services/categoriaService');
const { calcularFactura } = require('../services/ventaService');

let ok = 0; let fail = 0;
const check = (nombre, cond) => {
  // eslint-disable-next-line no-console
  console.log(`${cond ? '✅' : '❌'} ${nombre}`);
  cond ? ok++ : fail++;
};

async function run() {
  await sequelize.authenticate();

  // Jerarquía de categorías.
  check('plata accede a subasta plata', puedeAcceder('plata', 'plata'));
  check('comun NO accede a subasta plata', !puedeAcceder('comun', 'plata'));
  check('platino accede a todo', puedeAcceder('platino', 'oro'));

  // Límites de puja sobre el Rolex (base 10000, oferta 15000).
  const rolex = await Pieza.findOne({ where: { nro_pieza: 402 } });
  if (rolex) {
    const { minimo, maximo } = calcularLimites(rolex, 'plata');
    check('mínimo puja = 15100 (+1% base)', Math.round(minimo) === 15100);
    check('máximo puja = 17000 (+20% base)', Math.round(maximo) === 17000);
  }

  // Validación de puja real.
  const facundo = await Usuario.findOne({ where: { email: 'facundo@ejemplo.com' } });
  const subastaUsd = await Subasta.findByPk(rolex.subasta_id);
  const vBaja = await validarPuja({ usuario: facundo, pieza: rolex, subasta: subastaUsd, monto: 15050 });
  check('rechaza puja por debajo del mínimo', !vBaja.ok);
  const vAlta = await validarPuja({ usuario: facundo, pieza: rolex, subasta: subastaUsd, monto: 20000 });
  check('rechaza puja por encima del máximo (plata)', !vAlta.ok);
  const vOk = await validarPuja({ usuario: facundo, pieza: rolex, subasta: subastaUsd, monto: 15200 });
  check('acepta puja válida (15200)', vOk.ok);

  // Registrar puja → la oferta líder se actualiza.
  const res = await registrarPuja({
    usuario: facundo, idSubasta: subastaUsd.id, idPieza: rolex.id, monto: 15200,
  });
  check('registrarPuja devuelve nueva_oferta_lider = 15200', res.ok && res.nueva_oferta_lider === 15200);

  // Factura: comisión 10% + envío.
  await rolex.reload();
  const f = calcularFactura(rolex);
  check('factura: comisión = 10% del monto', f.comision === +(rolex.oferta_actual * 0.1).toFixed(2));
  check('factura: total = monto + comisión + envío', f.total === +(f.monto_pujado + f.comision + f.costo_envio).toFixed(2));

  // eslint-disable-next-line no-console
  console.log(`\nResultado: ${ok} OK / ${fail} fallidas`);
  await sequelize.close();
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
