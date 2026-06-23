# Sistema POS/PWA Restaurante

Monorepo para un sistema POS/PWA de restaurante con API Nest.js, frontend Next.js, Prisma, PostgreSQL y paquetes compartidos.

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- PostgreSQL 16 para desarrollo local.
- Docker y Docker Compose para despliegue local contenerizado.

## Estructura

```text
apps/
  api/    Backend Nest.js + Prisma
  web/    Frontend Next.js + PWA
packages/
  config/ Configuracion compartida
  types/  Tipos compartidos
  ui/     Componentes compartidos
database/ SQL manual para PostgreSQL
docs/     Documentacion tecnica
```

## Instalacion Local

```bash
npm install
copy .env.example .env
```

En Windows PowerShell tambien puedes usar:

```powershell
Copy-Item .env.example .env
```

Edita `.env` y confirma que `DATABASE_URL` tenga la contrasena real de tu usuario PostgreSQL.

Ejemplo:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/restaurant_db?schema=public"
```

## Variables De Entorno

Variables principales:

```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/restaurant_db?schema=public"
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3005,http://127.0.0.1:3005
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
SEED_ADMIN_EMAIL=admin@restaurant.local
SEED_ADMIN_PASSWORD=Admin123!
```

Para Docker, `docker-compose.yml` usa:

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/restaurant_db?schema=public
```

## Base De Datos

Crear base en PostgreSQL:

```sql
CREATE DATABASE restaurant_db;
```

Generar cliente Prisma:

```bash
npm run prisma:generate
```

Ejecutar migraciones:

```bash
npm run prisma:migrate -- --name init_restaurant_schema
```

Ejecutar seed inicial:

```bash
npm run prisma:seed
```

Abrir Prisma Studio:

```bash
npm run prisma:studio
```

## Usuario Admin Inicial

El seed crea:

```text
Email: admin@restaurant.local
Password: Admin123!
Rol: SUPER_ADMIN
```

La contrasena se guarda hasheada con bcrypt.

## Correr Backend

```bash
npm run dev:api
```

API:

```text
http://localhost:4000
```

Login:

```text
POST http://localhost:4000/auth/login
```

## Correr Frontend

```bash
npm run dev:web -- --port 3005
```

Frontend:

```text
http://127.0.0.1:3005
```

Panel admin:

```text
http://127.0.0.1:3005/admin
```

## Pruebas Y Calidad

Ejecutar todo:

```bash
npm run check
npm run lint
npm run test
```

Solo API:

```bash
npm run check -w @restaurante/api
npm run lint -w @restaurante/api
npm run test -w @restaurante/api
```

Solo web:

```bash
npm run check -w @restaurante/web
npm run lint -w @restaurante/web
npm run test -w @restaurante/web
```

## Docker

Levantar PostgreSQL, API y frontend:

```bash
docker compose up --build
```

Servicios:

```text
PostgreSQL: localhost:5432
API:        http://localhost:4000
Web:        http://localhost:3000
```

El contenedor de API ejecuta automaticamente:

```bash
npm run prisma:deploy -w @restaurante/api
npm run prisma:seed -w @restaurante/api
```

Detener:

```bash
docker compose down
```

Eliminar tambien datos de PostgreSQL:

```bash
docker compose down -v
```

## SQL Manual

Si quieres crear tablas manualmente sin Prisma:

```bash
psql -U postgres -d restaurant_db -f database/schema.sql
psql -U postgres -d restaurant_db -f database/seed.sql
```

Verificacion:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Comandos Principales

```bash
npm run dev
npm run dev:api
npm run dev:web
npm run build
npm run check
npm run lint
npm run test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy -w @restaurante/api
npm run prisma:seed
npm run prisma:studio
```

## Notas De Uso

- El frontend no debe decidir permisos criticos; los roles se validan en backend.
- Para crear usuarios y empleados desde admin, el backend debe estar corriendo y conectado a PostgreSQL.
- Si aparece `Failed to fetch`, revisa que `NEXT_PUBLIC_API_URL` apunte al API correcto y que el API este levantado.
- Si Prisma muestra `Authentication failed`, corrige la contrasena real en `DATABASE_URL`.

## Fase Inicial

La base inicial del proyecto esta resumida en [docs/INITIAL_PHASE.md](docs/INITIAL_PHASE.md). Ese documento explica la estructura monorepo, Nest.js, Next.js, Prisma, Tailwind, variables de entorno y la siguiente fase recomendada.
