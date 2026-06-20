# BidMaster — Plataforma de Subastas Exclusivas (Tercera Entrega)

Trabajo Práctico Obligatorio — **Desarrollo de Aplicaciones 1 (1C 2026)** — Grupo 12.

Aplicación móvil para participar online en subastas dinámicas ascendentes y proponer
artículos propios a remate. Implementa íntegramente la lógica de negocio, la API REST
y la trazabilidad de diseño definidas en la Primera Entrega.

---

## 1. Arquitectura del proyecto

```
                          ┌──────────────────────────────┐
                          │   App móvil  (React Native)   │
                          │        Expo + RN              │
                          │  - Navegación (stack/tabs)    │
                          │  - Context de Auth (JWT)      │
                          │  - Cliente REST (axios)        │
                          │  - Cliente Realtime (socket.io)│
                          └───────────────┬──────────────┘
                                          │
                  HTTPS (REST)            │           WS (Socket.IO)
                  /api/v1/...             │           sala por subasta
                                          ▼
                          ┌──────────────────────────────┐
                          │   Backend  (Node.js + Express) │
                          │  - Rutas → Controladores       │
                          │  - Middleware JWT / errores    │
                          │  - Servicios (lógica negocio)  │
                          │  - Socket.IO (motor de pujas)  │
                          └───────────────┬──────────────┘
                                          │ Sequelize ORM
                                          ▼
                          ┌──────────────────────────────┐
                          │      Base de datos SQLite      │
                          │  (portable; swap a Postgres)   │
                          └──────────────────────────────┘
```

**Backend** — `Node.js + Express` (REST) + `Socket.IO` (tiempo real) + `Sequelize` + `SQLite`.
Arquitectura en capas: `routes → controllers → services → models`.

**Frontend** — `React Native (Expo)` con `React Navigation`, `axios` y `socket.io-client`.
Paleta y componentes respetan el concepto **"Trust & Action"** de la Primera Entrega.

### Capas del backend

| Capa          | Responsabilidad                                                            |
|---------------|----------------------------------------------------------------------------|
| `routes`      | Define endpoints REST y aplica middleware (auth).                          |
| `controllers` | Traduce HTTP ↔ servicios. Valida forma del request, arma respuestas.      |
| `services`    | Lógica de negocio pura (validación de pujas, categorías, liquidación).    |
| `models`      | Entidades Sequelize y relaciones.                                         |
| `sockets`     | Motor de pujas en tiempo real (salas por subasta, broadcast de líder).    |
| `middleware`  | `auth` (JWT), `errorHandler` (respuestas de error homogéneas).            |

---

## 2. Esquema de base de datos

```
Usuario ──< MedioPago
Usuario ──< Puja >── Pieza >── Subasta
Usuario ──< Venta >── Pieza
Usuario ──< Multa
Usuario ──< Articulo            (bienes que el usuario propone a remate)
Pieza   ──> Usuario (dueno)
SolicitudRegistro (etapa 1, previa al Usuario)
```

### Tablas

**Usuario**
| campo | tipo | notas |
|---|---|---|
| id | INT PK | |
| nombre, apellido | STRING | |
| email | STRING UNIQUE | |
| password_hash | STRING | bcrypt (etapa 2) |
| dni_frente, dni_dorso | STRING | URL/Base64 |
| domicilio_legal, pais_origen | STRING | |
| categoria | ENUM | comun, especial, plata, oro, platino |
| estado | ENUM | activo, suspendido |
| cuenta_cobro | STRING | cuenta a la vista para liquidaciones (puede ser del exterior) |

**SolicitudRegistro** (verificación externa en 2 etapas)
| id_solicitud (UUID PK) · nombre · apellido · email · dni_frente · dni_dorso · domicilio_legal · pais_origen · estado (pendiente/aprobada/rechazada) · categoria_asignada |

**MedioPago**
| id PK · usuario_id FK · tipo (CUENTA/TARJETA/CHEQUE) · entidad · numero_identificador · monto_certificado · saldo_disponible · estado_verificacion (Pendiente/Verificado) |

**Subasta**
| id PK · titulo · fecha · hora · moneda (ARS/USD) · categoria_requerida · rematador · ubicacion · url_stream · estado (programada/activa/finalizada) |

**Pieza**
| id PK · subasta_id FK · nro_pieza · titulo · descripcion · precio_base · dueno_id FK · imagenes (JSON, ~6) · artista · fecha_obra · historia · oferta_actual · lider_id FK · estado (en_subasta/vendida/sin_ofertas) |

**Puja**
| id PK · subasta_id FK · pieza_id FK · usuario_id FK · monto · orden (secuencial por pieza) · createdAt |

**Venta**
| id PK · pieza_id FK · usuario_id FK · medio_pago_id FK · monto_pujado · comision (10%) · costo_envio · total · retiro_personal (bool) · createdAt |

**Multa**
| id PK · usuario_id FK · monto (10% ofertado) · fecha_limite (+72hs) · estado (con_deuda/pagada) |

**Articulo** (inclusión de bienes — Módulo 5)
| id_tramite PK · usuario_id FK · titulo · descripcion · historia · fotos (JSON, min 6) · acepta_devolucion · declaracion_jurada_licita · acredita_origen · estado (En revisión/Aceptado/Rechazado/Programado) · valor_base_sugerido · comisiones · fecha_subasta · ubicacion_deposito · seguro_compania · seguro_cobertura · motivo_rechazo |

---

## 3. Especificación de la API REST (trazabilidad con Primera Entrega)

Base URL: `/api/v1`

### Módulo 1 — Autenticación y Usuarios
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/auth/login` | Login directo → token JWT |
| POST | `/auth/registro-etapa1` | Datos + DNI → verificación externa (202) |
| POST | `/auth/registro-etapa2` | Genera clave personal tras aprobación (201) |
| POST | `/auth/recuperar-password` | **(corrección)** "Se me olvidó la contraseña" |
| GET  | `/usuarios/perfil/metricas` | Métricas del perfil 🔒 |
| GET  | `/usuarios/multas` | Multas activas (10% / 72hs) 🔒 |

### Módulo 2 — Billetera y Medios de Pago
| POST | `/pagos/medios` | Registrar medio de pago 🔒 |
| GET  | `/pagos/medios` | Listar mis medios de pago 🔒 |
| GET  | `/pagos/medios/{id}/estado` | Estado de verificación 🔒 |

### Módulo 3 — Catálogo y Subastas
| GET | `/subastas` | Listar subastas activas (query: moneda, categoria) |
| GET | `/subastas/{id}/catalogo` | Detalle de piezas (oculta precio si no logueado) |
| GET | `/subastas/{id}/streaming` | Valida categoría + medio verificado → URL stream 🔒 |

### Módulo 4 — Motor de Pujas y Facturación
| POST | `/pujas` | Realizar puja (validaciones 1%–20%, saldo) 🔒 |
| GET  | `/ventas/{id_pieza}/factura` | Liquidación del ganador 🔒 |
| POST | `/ventas/{id_pieza}/pagar` | Pagar la pieza; si no hay fondos → multa 10% 🔒 |

### Módulo 5 — Inclusión de Bienes (Vendedores)
| GET   | `/vendedores/articulos` | Listar mis artículos 🔒 |
| POST  | `/vendedores/articulos` | Proponer pieza (min 6 fotos + DDJJ) 🔒 |
| PATCH | `/vendedores/articulos/{id}/condiciones` | Aceptar/Rechazar tasación 🔒 |
| GET   | `/vendedores/articulos/{id}/logistica` | Depósito + póliza de seguro 🔒 |

🔒 = requiere header `Authorization: Bearer <token>`.

### WebSocket (Socket.IO) — Motor de pujas en tiempo real
- `join_subasta { id_subasta }` → entra a la sala (1 sala por usuario máx.).
- `nueva_puja { id_subasta, id_pieza, monto }` → valida y persiste; el server confirma
  con `puja_confirmada` SOLO al emisor y recién entonces el cliente habilita otra puja.
- `oferta_actualizada { id_pieza, nueva_oferta_lider, lider_id }` → broadcast a la sala.
- `puja_rechazada { motivo }` → al emisor si viola reglas.

---

## 4. Reglas de negocio implementadas

- **Registro en 2 etapas** con verificación externa y asignación de categoría.
- **Categorías**: `comun < especial < plata < oro < platino`. Sólo se accede a subastas
  cuya categoría requerida sea ≤ a la del usuario.
- **Acceso a pujar**: requiere ≥ 1 medio de pago **verificado**. Sin él, sólo ve la subasta.
- **Validación de puja**:
  - `monto ≥ oferta_actual + 1% · precio_base`
  - `monto ≤ oferta_actual + 20% · precio_base` (excepto **oro/platino**)
  - Si paga con **cheque certificado**: suma de compras ≤ `monto_certificado`.
- **Una sola sala a la vez** por usuario.
- **Confirmación secuencial**: no se admite otra puja hasta confirmar la anterior.
- **Cierre**: cuando nadie supera, el último postor es el nuevo dueño → se registra venta,
  comisión 10%, costo de envío, y se notifica el total a pagar.
- **Sin ofertas**: la empresa compra la pieza al precio base.
- **Multa**: si no puede pagar, 10% del valor ofertado + 72hs para regularizar; cuenta
  suspendida para nuevas pujas hasta abonar.
- **Monedas**: ARS o USD por subasta (no bimonetaria).
- **Inclusión de bienes**: DDJJ de pertenencia, acreditación de origen lícito, min 6 fotos,
  tasación con valor base/comisiones que el vendedor acepta o rechaza, depósito y seguro.

---

## 5. Cómo ejecutar

### Backend
```bash
cd backend
npm install
npm run seed         # crea la BD SQLite y carga datos de prueba
npm run dev          # levanta API + WebSocket en http://localhost:4000

# Verificación (opcional):
npm run test:logica  # 11 asserts de la lógica de negocio (categorías, pujas 1%-20%, factura)
npm run test:e2e     # 34 asserts E2E "como usuario" contra las consignas del TPO
npm run test:ws      # 2 postores en tiempo real: confirmación, broadcast y rechazo
```

> **Estado de validación (probado end-to-end):**
> - Seed OK · **11/11** tests de lógica · **34/34** tests E2E · WebSocket OK.
> - E2E cubre: registro en 2 etapas, login/recuperar clave, catálogo (precio oculto/visible),
>   categoría que habilita acceso, puja 1%–20%, moneda ARS/USD, billetera, streaming,
>   factura (10% + envío), **pago con fondos insuficientes → multa 10% + suspensión**,
>   inclusión de bienes (6 fotos + DDJJ, tasación, logística/seguro) y seguridad (401/403).

### Frontend
```bash
cd frontend
npm install
# Editar src/config.js -> API_URL con la IP de tu PC si usás dispositivo físico
npm start        # Expo: abrí en Expo Go (Android/iOS) o emulador
```

### Usuarios de prueba (tras `npm run seed`)
| email | password | categoría |
|---|---|---|
| facundo@ejemplo.com | 123456 | plata |
| oro@ejemplo.com | 123456 | oro |
| nuevo@ejemplo.com | 123456 | comun |

---

## 6. Despliegue en línea (entrega final)

- **Backend**: listo para Render / Railway / Fly.io. Usa `process.env.PORT` y
  `DATABASE_URL` (si se define, usa Postgres; si no, SQLite local). Ver `backend/.env.example`.
- **Frontend**: `expo build` / EAS Build para generar el APK instalable en dispositivo, o
  Expo Go apuntando al backend desplegado (configurar `API_URL`).

---

## 7. Correcciones de diseño aplicadas (sobre el wireframe original)
1. Campo **"Mail"** agregado en la pantalla *Creá tu cuenta* (registro etapa 1).
2. Botón **"¿Se me olvidó la contraseña?"** agregado en la pantalla *Iniciar Sesión*.

### Correcciones de testing (2ª ronda)
3. **Foto del DNI real**: el registro abre cámara/galería (`expo-image-picker`) y sube
   la imagen (frente y dorso) en base64, con preview. Antes era un botón ficticio.
4. **Validaciones de registro**: se valida formato de email y domicilio legal (calle +
   número), tanto en el frontend como en el backend.
5. **Aprobación real en 2 etapas**: la etapa 2 está **bloqueada hasta que la verificación
   externa apruebe** la solicitud (ya no se aprueba al instante). Nuevo endpoint
   `GET /auth/solicitudes/{id}/estado` que la app consulta hasta la aprobación. La
   verificación se simula de forma diferida (`VERIFICACION_SEGUNDOS`, default 8s) sin
   necesidad de Postman.
6. **Cambio de subasta ("una a la vez")**: el usuario puede salir de una subasta y entrar
   a otra cuando quiera (nunca queda conectado a dos a la vez). Se agregó botón *Salir de
   la subasta* y el backend libera el lock anterior al cambiar (antes quedaba "pegado").
