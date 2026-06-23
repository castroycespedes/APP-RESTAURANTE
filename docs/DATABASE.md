# Base de datos

La API usa PostgreSQL con Prisma. El esquema vive en `apps/api/prisma/schema.prisma` y el seed inicial en `apps/api/prisma/seed.ts`.

## Comandos

```bash
npm run prisma:generate -w @restaurante/api
npm run prisma:migrate -w @restaurante/api -- --name init_restaurant_schema
npm run seed -w @restaurante/api
```

Variables requeridas:

- `DATABASE_URL`: conexion PostgreSQL.
- `SEED_ADMIN_EMAIL`: correo del usuario administrador inicial.
- `SEED_ADMIN_PASSWORD`: contrasena inicial del administrador.

El seed crea los roles basicos (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `WAITER`, `KITCHEN`, `CASHIER`, `INVENTORY`), un usuario administrador y el tema inicial `restaurante-claro`.
