# BidMaster — Aprobaciones manuales por Postman

Todas las aprobaciones (registros de usuario y medios de pago) son **manuales**.
La app ya **no** aprueba sola: cada solicitud y cada tarjeta/cheque/cuenta queda
en estado **pendiente** hasta que vos la apruebes desde Postman.

## Configuración previa

En `backend/.env` (copialo de `.env.example`):

```
ADMIN_KEY=bidmaster_admin_2026      # tu clave de admin para Postman
VERIFICAR_EMAIL=true                # valida que el dominio del email exista (MX)
```

Todas las llamadas de administración requieren el header:

```
x-admin-key: bidmaster_admin_2026
```

Base URL local: `http://localhost:4000/api/v1`

---

## 1) Aprobar / rechazar un registro de usuario

### Ver solicitudes pendientes
```
GET /admin/solicitudes?estado=pendiente
Header: x-admin-key: bidmaster_admin_2026
```
Devuelve la lista con `id_solicitud`, nombre, email, etc. (sin las fotos del DNI).

### Aprobar una solicitud
```
PATCH /admin/solicitudes/:id/resolver
Header: x-admin-key: bidmaster_admin_2026
Body (JSON):
{ "aprobar": true, "categoria": "oro" }
```
`categoria` es opcional: `comun | especial | plata | oro | platino` (default `comun`).

La respuesta incluye el `codigo_validacion` (también se "envía por mail" y se
imprime en la consola del backend). Ese código es el que el usuario escribe en la
pantalla **Completar registro** para generar su clave personal.

### Rechazar una solicitud
```
PATCH /admin/solicitudes/:id/resolver
Body: { "aprobar": false }
```

---

## 2) Verificar / rechazar un medio de pago

Cuando un usuario carga una tarjeta, cheque o cuenta, queda en **Pendiente**.
La app valida el **formato** (marca + Luhn + CVV + vencimiento para tarjetas;
número/banco/monto/CBU para cheques), pero el **alta real la confirmás vos**.
Hasta que un medio no esté **Verificado**, no se puede usar para pagar/pujar.

### Ver medios pendientes
```
GET /admin/pagos/medios?estado=Pendiente
Header: x-admin-key: bidmaster_admin_2026
```

### Verificar (aprobar) un medio
```
PATCH /admin/pagos/medios/:id/verificar
Header: x-admin-key: bidmaster_admin_2026
Body (JSON):
{ "aprobar": true, "saldo_disponible": 750000 }
```
`saldo_disponible` es opcional (ajusta los fondos confirmados; para cheques se usa
el monto certificado).

### Rechazar un medio
```
PATCH /admin/pagos/medios/:id/verificar
Body: { "aprobar": false }
```

---

## Validaciones automáticas (antes de llegar a vos)

### Registro de usuario
- **Nombre/apellido con números** → `El nombre sólo puede contener letras`
- **País inexistente** → `Ingresá un país de origen válido`
- **Foto de DNI que no es imagen** → `Las fotos del DNI deben ser imágenes válidas (frente y dorso)`
- **Email con typo** → `¿Quisiste decir @gmail.com? Revisá el dominio del email`
- **Email temporal/descartable** → `No se permiten emails temporales o descartables`
- **Email inexistente** → `El dominio del email no existe o no recibe correos`
- **Domicilio inexistente** → `No encontramos ese domicilio. Revisá la calle, el número y la ciudad`
  (verificación real contra OpenStreetMap; se puede apagar con `VERIFICAR_DOMICILIO=false`)

### Medios de pago
- **Tarjeta inválida** → `Número de tarjeta inválido (no pasó la verificación)`
- **CVV incorrecto** → `El código de seguridad (CVV) de VISA debe tener 3 dígitos`
- **Tarjeta vencida** → `La tarjeta está vencida`
- **Marca no soportada** → `No reconocemos la tarjeta (sólo Visa, Mastercard o Amex)`
- **CBU inválido** → `CBU inválido (dígito verificador de la cuenta no coincide)` (algoritmo real del BCRA)
- **Cheque sin monto / banco / número** → mensaje específico del campo faltante

### Tarjetas de prueba válidas (pasan Luhn)
- Visa: `4539 1488 0343 6467` — CVV 3 díg. — venc. futuro (MM/AA)
- Mastercard: `5555 5555 5555 4444` — CVV 3 díg.
- Amex: `3782 822463 10005` — CVV **4** díg.

> Nota de seguridad: el número de tarjeta se guarda **enmascarado** (`**** 6467`)
> y el **CVV nunca se almacena** (sólo se valida su formato).
