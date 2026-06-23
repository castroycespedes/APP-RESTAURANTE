# Fase Inicial Del POS/PWA Restaurante

Esta fase deja la base del proyecto lista para crecer por modulos sin mezclar responsabilidades.

## Stack Base

- Monorepo con npm workspaces.
- Backend Nest.js + TypeScript en `apps/api`.
- Frontend Next.js + TypeScript en `apps/web`.
- PostgreSQL como base de datos.
- Prisma ORM en `apps/api/prisma`.
- Tailwind CSS en `apps/web`.
- JWT auth preparado en `apps/api/src/auth`.
- RBAC preparado con guards y decoradores.
- WebSockets preparados en `apps/api/src/kitchen`.

## Estructura Principal

```text
apps/
  api/
    prisma/
      schema.prisma
      seed.ts
    src/
      auth/
      users/
      employees/
      tables/
      menu/
      orders/
      kitchen/
      inventory/
      cashier/
      theme/
      common/
      prisma/
  web/
    src/app/
      admin/
      caja/
      cocina/
      inventario/
      login/
    public/
packages/
  config/
  types/
  ui/
```

## Modulos Preparados

- `auth`: login, JWT, refresh token, guards y decoradores.
- `users`: administracion de usuarios.
- `employees`: empleados vinculados a usuarios.
- `tables`: areas, mesas y asignacion de meseros.
- `menu`: categorias, platos y modificadores.
- `orders`: flujo de ordenes de mesero.
- `kitchen`: comandas y WebSockets.
- `inventory`: ingredientes, recetas y movimientos.
- `cashier`: caja, pagos y descuentos.
- `theme`: personalizacion visual.

## Variables De Entorno

La plantilla esta en `.env.example`.

Para desarrollo local:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/restaurant_db?schema=public"
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
```

## Tailwind CSS

Configurado en:

```text
apps/web/postcss.config.mjs
apps/web/tailwind.config.ts
apps/web/src/app/styles.css
```

Los colores principales usan variables CSS para que el modulo de tema visual pueda modificarlos dinamicamente.

## Comandos Iniciales

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init_restaurant_schema
npm run prisma:seed
npm run dev:api
npm run dev:web -- --port 3005
```

## Siguiente Fase Recomendada

La siguiente fase deberia ser estabilizar la base de datos real:

1. Confirmar credenciales reales de PostgreSQL en `DATABASE_URL`.
2. Ejecutar migraciones Prisma.
3. Ejecutar seed inicial.
4. Verificar tablas con Prisma Studio.
5. Probar login real con `admin@restaurant.local` y `Admin123!`.

Despues de eso, conviene avanzar modulo por modulo: autenticacion, usuarios/empleados, mesas, menu, ordenes, cocina, caja e inventario.
