# BidMaster — Plataforma de Subastas Exclusivas (Tercera Entrega)

Trabajo Práctico Obligatorio — **Desarrollo de Aplicaciones 1 (1C 2026)** — Grupo 12.

Aplicación móvil para participar online en **subastas dinámicas ascendentes** (un ítem por
vez, en tiempo real) y proponer artículos propios a remate. Implementa la lógica de negocio,
la API REST + WebSockets y la trazabilidad de diseño definidas en la Primera Entrega.

---

## 1. Arquitectura

```
   App móvil (React Native / Expo)        Backend (Node.js + Express)        SQLite
   - Navegación stack + tabs               - routes → controllers → services   (Sequelize ORM,
   - Context de Auth (JWT)        REST     - middleware JWT / x-admin-key       swap a Postgres
   - axios (REST)             ──────────►  - Socket.IO: motor SECUENCIAL        con DATABASE_URL)
   - socket.io-client (vivo)  ◄─ WS ─────    de subastas (1 ítem por vez)
```

Capas del backend: `routes → controllers → services → models`, más `sockets` (motor de
subastas en vivo) y `middleware` (`auth` JWT, `requireAdmin` por `x-admin-key`, `errorHandler`).

---

## 2. Modelo de subasta (SECUENCIAL)

Cada subasta tiene un **catálogo ordenado** y remata **un ítem por vez**:

1. Las subastas arrancan **`programada`** (no corriendo).
2. Un administrador la **inicia** (`POST /admin/subastas/:id/comenzar`, por Postman).
3. Se remata el ítem 1 durante `DURACION_ITEM_MS` (default 30s). **Anti-sniping**: si alguien
   puja faltando < 15s, el reloj se estira.
4. Al cerrar, **gana el último postor** (o la empresa compra al precio base si no hubo ofertas)
   y **avanza solo al siguiente ítem**.
5. La subasta termina (`finalizada`) cuando no quedan ítems abiertos.

El usuario entra a la sala, ve el ítem que se remata **ahora** y puede entrar/salir cuando
quiera (esperar el ítem que le interesa). Las ofertas se reciben en tiempo real.

---

## 3. Esquema de base de datos (campos clave)

```
Usuario ──< MedioPago        Usuario ──< Puja >── Pieza >── Subasta
Usuario ──< Venta >── Pieza   Usuario ──< Multa   Usuario ──< Articulo ──> Pieza (al aceptar)
SolicitudRegistro (registro etapa 1, previa al Usuario)
```

- **Usuario**: `categoria` (comun/especial/plata/oro/platino), `estado` (activo/suspendido),
  `codigo_reset` (recuperar clave), `cuenta_cobro`.
- **SolicitudRegistro**: datos + DNI + `estado` (pendiente/aprobada/rechazada),
  `categoria_asignada`, `codigo_validacion`.
- **MedioPago**: `tipo` (CUENTA/TARJETA/CHEQUE), `marca`/`titular`/`vencimiento` (tarjeta),
  `numero_cheque`/`banco`/`cbu` (cheque), `saldo_disponible`, `estado_verificacion`
  (Pendiente/Verificado/Rechazado). *El número de tarjeta se guarda enmascarado y el CVV no se persiste.*
- **Subasta**: `moneda` (ARS/USD), `categoria_requerida`, `estado` (programada/activa/finalizada),
  `pieza_actual_id` (ítem en remate).
- **Pieza**: `precio_base`, `imagenes` (~6), `oferta_actual`, `lider_id`, `dueno_id`,
  `estado` (en_subasta/vendida/sin_ofertas), **`categoria` / `tags` / `uso`** (búsqueda y filtros).
- **Venta**: `monto_pujado`, `comision` (10%), `costo_envio`, `total`, `estado_pago` (pendiente/pagada).
- **Multa**: `monto` (10% ofertado), `fecha_limite` (+72hs), `estado` (con_deuda/pagada).
- **Articulo** (bienes propuestos): estado del trámite, tasación, logística/seguro, y
  **`pieza_id`** (la pieza generada al aceptar, que se incluye en una subasta).

El esquema se sincroniza con `sequelize.sync()` + una migración aditiva (ADD COLUMN) en el arranque.

---

## 4. API REST — `/api/v1`

**Acceso:** 🔓 público · 🔑 token de usuario (`Authorization: Bearer <token>`) · 🛡️ admin (`x-admin-key`).

### Módulo 1 — Autenticación / Cuenta
| 🔐 | Método | Endpoint | Descripción |
|---|---|---|---|
| 🔓 | POST | `/auth/login` | Login → token JWT |
| 🔓 | POST | `/auth/registro-etapa1` | Datos + DNI → solicitud pendiente (202) |
| 🔓 | GET | `/auth/solicitudes/{id}/estado` | Estado de la solicitud (y código si aprobada) |
| 🔓 | POST | `/auth/registro-etapa2` | Activa la cuenta con el código (genera clave) |
| 🔓 | POST | `/auth/reanudar-registro` | Retoma la validación por email |
| 🔓 | POST | `/auth/recuperar-password` | Pide código de recuperación |
| 🔓 | POST | `/auth/resetear-password` | Setea nueva clave con el código |
| 🔑 | GET | `/usuarios/perfil/metricas` | Métricas del perfil |
| 🔑 | GET | `/usuarios/multas` | Multa activa |
| 🔑 | POST | `/usuarios/multas/pagar` | Paga la multa y reactiva la cuenta |

### Módulo 2 — Billetera
| 🔑 | POST | `/pagos/medios` | Registrar medio (queda Pendiente) |
| 🔑 | GET | `/pagos/medios` | Listar mis medios |
| 🔑 | GET | `/pagos/medios/{id}/estado` | Estado de un medio |
| 🔑 | DELETE | `/pagos/medios/{id}` | Eliminar un medio |

### Módulo 3 — Catálogo y Subastas
| 🔓 | GET | `/subastas?moneda=ARS` | Subastas programadas + en curso |
| 🔓 | GET | `/subastas/{id}/catalogo` | Piezas (con categoría/tags/uso) |
| 🔑 | GET | `/subastas/{id}/streaming?id_medio=&id_pieza=` | Valida ingreso + medio + fondos |

### Módulo 4 — Pujas y Pago
| 🔑 | POST | `/pujas` | Pujar (en vivo va por WebSocket) |
| 🔑 | GET | `/ventas/{id_pieza}/factura` | Liquidación del ganador |
| 🔑 | POST | `/ventas/{id_pieza}/pagar` | Pagar la pieza; sin fondos → multa 10% |

### Módulo 5 — Vendedor (inclusión de bienes)
| 🔑 | GET | `/vendedores/articulos` | Mis artículos |
| 🔑 | POST | `/vendedores/articulos` | Proponer bien (min 6 fotos + DDJJ) |
| 🔑 | PATCH | `/vendedores/articulos/{id}/inspeccion` | ENVIAR / CANCELAR |
| 🔑 | PATCH | `/vendedores/articulos/{id}/condiciones` | ACEPTAR (crea la pieza) / RECHAZAR |
| 🔑 | PATCH | `/vendedores/articulos/{id}/devolucion` | RETIRO / ENVIO (descuenta el flete) |
| 🔑 | GET | `/vendedores/articulos/{id}/factura-flete` | Factura del flete |
| 🔑 | GET | `/vendedores/articulos/{id}/logistica` | Depósito + póliza |

### Administración — **sólo por Postman** (`x-admin-key`)
| 🛡️ | GET | `/admin/solicitudes?estado=pendiente` | Ver registros pendientes |
| 🛡️ | PATCH | `/admin/solicitudes/{id}/resolver` | **Aprobar cuenta + dar categoría** (devuelve el código) |
| 🛡️ | GET | `/admin/pagos/medios?estado=Pendiente` | Ver medios pendientes |
| 🛡️ | PATCH | `/admin/pagos/medios/{id}/verificar` | **Verificar un medio de pago** |
| 🛡️ | POST | `/admin/subastas/{id}/comenzar` | **Comenzar el remate secuencial** |

### WebSocket (Socket.IO) — motor en vivo
- Cliente → `join_subasta {id_subasta}`, `nueva_puja {id_subasta, id_pieza, monto, id_medio_pago}`.
- Servidor → `item_actual` (ítem que se remata), `item_timer` (reloj), `oferta_actualizada`,
  `puja_confirmada` (sólo al emisor), `puja_rechazada`, `item_cerrado`, `subasta_finalizada`.

> 📮 **Colección de Postman lista para importar**: `backend/BidMaster.postman_collection.json`
> (todos los endpoints, variables y un script que guarda el token al hacer login).
> Detalle del flujo de aprobación en `backend/POSTMAN-ADMIN.md`.

---

## 5. Reglas de negocio y validaciones

**Registro y aprobación (manual):**
- Registro en 2 etapas. La cuenta **no se aprueba sola**: un administrador la aprueba y le
  asigna categoría por Postman; recién entonces el usuario genera su clave.
- Validaciones "reales" en el alta: **email existente** (registros MX del dominio + typos +
  bloqueo de descartables), **domicilio geocodificado** (OpenStreetMap), **país** válido,
  **fotos de DNI** verificadas (magic bytes) y nombre sin números.

**Medios de pago:** tarjeta (marca + Luhn + **CVV** + vencimiento), cheque (nro/banco/monto/CBU)
y **CBU con dígito verificador real (BCRA)**. Quedan **Pendiente** hasta que un admin los verifique.

**Subastas y pujas:**
- Categorías `comun < especial < plata < oro < platino`; sólo se accede a subastas de categoría ≤ a la propia.
- Para pujar hace falta ≥ 1 medio **verificado** en la moneda de la subasta; y no entrar con un
  medio que no cubra el precio base.
- `oferta + 1%·base ≤ puja ≤ oferta + 20%·base` (sin tope superior en oro/platino).
- **Una subasta a la vez** + confirmación secuencial (no se admite otra puja sin confirmar la anterior).
- No se puede **pujar por el propio bien**.
- Cierre por ítem → gana el último; sin ofertas → la empresa compra al base. Comisión 10% + envío.
- **Multa**: sin fondos al pagar → 10% del valor ofertado + 72hs; cuenta **suspendida**
  (no puja, no entra, no paga) **hasta pagar la multa**.
- Monedas ARS/USD por subasta (no bimonetaria).

**Búsqueda y filtros del catálogo:** por texto (nombre/artista/etiqueta), **categoría**
(arte/tecnología/moda/joyas/vehículos/hobbies), **etiquetas** (Lujo, Vintage, Colección, …) y
**estado de uso** (nuevo/poco_uso/usado/sellado/restaurado).

**Vendedor:** DDJJ de pertenencia + origen lícito + min 6 fotos → inspección → tasación. Al
**aceptar**, el bien se vuelve una pieza real en la *"Subasta de la Comunidad"* y se puede
rematar. Rechazo/devolución con **flete descontado** de la cuenta corriente.

---

## 6. Cómo ejecutar

### Backend
```bash
cd backend
npm install
cp .env.example .env     # opcional; trae defaults (ADMIN_KEY, toggles de verificación)
npm run seed             # crea la BD SQLite y carga datos de prueba
npm run dev              # API + WebSocket en http://localhost:4000  (nodemon)
```
Variables útiles en `.env`: `ADMIN_KEY`, `DURACION_ITEM_MS`, `VERIFICAR_EMAIL`,
`VERIFICAR_DOMICILIO` (poné estas dos en `false` para testear sin internet).

### Frontend
```bash
cd frontend
npm install
# Si usás dispositivo físico: editar src/config.js → API_URL con la IP LAN de tu PC.
npm start                # Expo: escaneá el QR con Expo Go (misma red Wi-Fi)
```

### Usuarios de prueba (tras `npm run seed`)
| email | password | categoría | medios |
|---|---|---|---|
| facundo@ejemplo.com | 123456 | plata | Visa ARS, Cuenta USD, Cheque ARS (verificados) |
| oro@ejemplo.com | 123456 | oro | Cuenta USD |
| nuevo@ejemplo.com | 123456 | comun | — |

### Flujo de prueba (con Postman para lo de admin)
1. Registrate en la app → entrás como **invitado**.
2. Postman `GET /admin/solicitudes?estado=pendiente` → copiá el `id_solicitud`.
3. Postman `PATCH /admin/solicitudes/{id}/resolver` con `{ "aprobar": true, "categoria": "oro" }`
   → devuelve el **código**. Ponelo en la app para generar tu clave y activar la cuenta.
4. Cargá un medio de pago → Postman `PATCH /admin/pagos/medios/{id}/verificar` → ya podés pujar.
5. Postman `POST /admin/subastas/{id}/comenzar` → entrás a la sala y se remata ítem por ítem.

Clave de admin por defecto: `x-admin-key: bidmaster_admin_2026`.

---

## 7. Despliegue en línea

- **Backend**: usa `process.env.PORT` y `DATABASE_URL` (si existe → Postgres; si no → SQLite).
  Listo para Render / Railway / Fly.io (ver `backend/.env.example`, `render.yaml`, `Procfile`).
- **Frontend**: EAS Build para el APK instalable, o Expo Go apuntando al backend desplegado
  (configurar `API_URL`).

---

## 8. Trazabilidad y correcciones de diseño

- Correcciones del wireframe: campo **"Mail"** en *Creá tu cuenta* y **"¿Olvidaste tu contraseña?"**
  funcional (recuperación en 2 pasos con código).
- Salida de la fase de prueba: **aprobaciones manuales por Postman** (registros y medios),
  **validaciones reales** (email/domicilio/CBU/DNI), **modelo de subasta secuencial** acorde a la
  consigna ("ver *qué artículo* se subasta"), búsqueda/filtros del catálogo, y cierre del circuito
  **vendedor → pieza subastable**.
- Una divergencia consciente respecto del enunciado: no aplica. El modelo es secuencial como pide
  la consigna.
