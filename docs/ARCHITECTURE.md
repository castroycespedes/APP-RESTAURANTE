# Arquitectura inicial

## Objetivo de la fase 0

Dejar una base de monorepo lista para crecer sin implementar todavia la logica completa del restaurante. Esta fase define limites, convenciones, dependencias y estrategias tecnicas.

## Estructura de carpetas

```text
apps/
  api/
    src/
      app.module.ts
      main.ts
    package.json
    tsconfig.json
  web/
    src/
      app/
        layout.tsx
        page.tsx
    package.json
    next.config.ts
    tsconfig.json
packages/
  config/
    src/
      env.ts
      index.ts
    package.json
    tsconfig.json
  types/
    src/
      auth.ts
      index.ts
      restaurant.ts
    package.json
    tsconfig.json
  ui/
    src/
      button.tsx
      index.ts
    package.json
    tsconfig.json
docs/
  ARCHITECTURE.md
```

## Convenciones de nombres

- Workspaces: `@restaurante/<nombre>`.
- Carpetas: `kebab-case` para modulos y recursos.
- Archivos React: `kebab-case.tsx` para componentes compartidos, `PascalCase` solo para el nombre exportado.
- Clases Nest: `PascalCase` con sufijos claros (`OrdersService`, `KitchenGateway`).
- DTOs: `*.dto.ts`; entidades/modelos: `*.entity.ts` o `*.model.ts` segun el ORM elegido.
- Tipos compartidos: interfaces y type aliases en ingles, exportados desde `@restaurante/types`.
- Variables de entorno: `UPPER_SNAKE_CASE`.
- Rutas API: plural y versionadas cuando se estabilicen, por ejemplo `/v1/orders`.

## Variables de entorno

El archivo `.env.example` define la superficie inicial:

- `APP_URL`, `API_URL`: URLs publicas de web y API.
- `PORT`: puerto de Nest.js.
- `DATABASE_URL`: conexion PostgreSQL.
- `REDIS_URL`: Redis para cache, colas ligeras y adaptador WebSocket.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: secretos para tokens.
- `COOKIE_DOMAIN`: dominio de cookies HTTP-only.
- `CORS_ORIGINS`: origenes permitidos para navegador.
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`: URLs consumidas por Next.js.
- `NEXT_PUBLIC_DEFAULT_THEME`: tema inicial.

## Scripts principales

- `dev`: desarrollo de todos los workspaces con script disponible.
- `dev:api`: desarrollo de Nest.js.
- `dev:web`: desarrollo de Next.js.
- `build`: compilacion de apps y paquetes.
- `check`: chequeo de tipos.
- `lint`: lint por workspace.
- `test`: pruebas por workspace.
- `format`: Prettier en archivos comunes.

## Dependencias necesarias

### Raiz

- `typescript`: base comun.
- `prettier`: formato transversal.
- `@types/node`: tipos para entorno Node.

### apps/api

- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`: base Nest.js.
- `@nestjs/config`: carga validada de entorno.
- `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`: autenticacion.
- `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`: eventos de cocina.
- `class-validator`, `class-transformer`: validacion de DTOs.
- `reflect-metadata`, `rxjs`: requeridos por Nest.

### apps/web

- `next`, `react`, `react-dom`: aplicacion web.
- Dependencias internas: `@restaurante/types`, `@restaurante/ui`, `@restaurante/config`.

### packages

- `packages/types`: contratos compartidos.
- `packages/ui`: componentes React reutilizables.
- `packages/config`: lectura y tipado de configuracion comun.

## Estrategia de autenticacion

- Usar access token JWT de vida corta y refresh token de vida media.
- Guardar refresh token en cookie HTTP-only, `SameSite=Lax` en desarrollo y `Secure` en produccion.
- Mantener access token en memoria del cliente para reducir exposicion ante XSS.
- API protegida con guards de Nest y decoradores para usuario actual.
- Preparar rotacion de refresh tokens y revocacion por sesion cuando se implemente persistencia.
- Separar endpoints esperados: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.

## Estrategia de roles y permisos

Roles iniciales:

- `owner`: administracion completa del restaurante.
- `admin`: gestion operativa, usuarios, mesas, productos y reportes.
- `cashier`: cobro, cierre de cuentas y consulta de ordenes.
- `waiter`: creacion y seguimiento de ordenes de mesa.
- `kitchen`: vista y actualizacion de preparacion.

Permisos iniciales:

- `orders:create`, `orders:read`, `orders:update-status`, `orders:cancel`.
- `tables:read`, `tables:update-status`.
- `menu:read`, `menu:manage`.
- `payments:create`, `payments:refund`.
- `kitchen:read`, `kitchen:update-status`.
- `users:manage`, `reports:read`, `settings:manage`.

La API debe evaluar permisos, no solo roles. Los roles seran conjuntos de permisos configurables para permitir restaurantes con operaciones distintas.

## Estrategia de WebSockets para cocina

- Crear un gateway Nest futuro, por ejemplo `KitchenGateway`.
- Namespace sugerido: `/kitchen`.
- Salas por restaurante y estacion: `restaurant:{restaurantId}` y `kitchen:{restaurantId}:{stationId}`.
- Eventos iniciales:
  - `order.created`
  - `order.updated`
  - `order.item-status-updated`
  - `kitchen.ticket-claimed`
  - `kitchen.ticket-completed`
- Autenticar el handshake con JWT y validar permisos `kitchen:read` o `kitchen:update-status`.
- Usar Redis adapter en produccion para escalar multiples instancias de API.
- Mantener idempotencia con `eventId` y timestamps para evitar duplicados visibles en pantalla de cocina.

## Estrategia de tema dinamico

- Definir tokens CSS en la web (`--color-primary`, `--color-surface`, `--radius-md`, etc.).
- Guardar tema activo por restaurante en backend cuando exista persistencia.
- Exponer tema en el bootstrap de Next.js o endpoint `GET /theme`.
- Aplicar tema con atributos `data-theme` y variables CSS para evitar recompilar.
- `packages/ui` debe consumir tokens, no colores fijos.
- Permitir un tema por defecto desde `NEXT_PUBLIC_DEFAULT_THEME`.

## Limites de esta fase

- No hay base de datos inicializada.
- No hay autenticacion funcional todavia.
- No hay WebSocket gateway implementado todavia.
- No hay sistema completo de diseno, solo una semilla en `packages/ui`.
- No hay reglas de negocio de pedidos, mesas, cocina o pagos.
