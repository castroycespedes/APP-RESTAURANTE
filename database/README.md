# Base de datos manual PostgreSQL

Estos archivos permiten crear la base de datos del sistema POS/PWA manualmente, sin depender de Prisma.

## Archivos

- `schema.sql`: crea extension, enums, tablas, llaves foraneas, indices y triggers de `updated_at`.
- `seed.sql`: inserta roles, tema visual, areas y categorias iniciales.
- `drop.sql`: elimina tablas y enums para reiniciar la base de datos.

## Crear la base de datos

Primero crea la base de datos si aun no existe:

```sql
CREATE DATABASE restaurant_db;
```

## Ejecutar con psql

Desde la raiz del proyecto:

```bash
psql -U postgres -d restaurant_db -f database/schema.sql
psql -U postgres -d restaurant_db -f database/seed.sql
```

## Ejecutar en pgAdmin, DBeaver o TablePlus

1. Conectate a PostgreSQL.
2. Abre la base de datos `restaurant_db`.
3. Ejecuta primero el contenido de `database/schema.sql`.
4. Ejecuta despues el contenido de `database/seed.sql`.

## Verificar tablas

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Deberian aparecer:

- `app_themes`
- `audit_logs`
- `cash_registers`
- `customers`
- `dining_areas`
- `discounts`
- `employees`
- `ingredients`
- `inventory_movements`
- `kitchen_ticket_items`
- `kitchen_tickets`
- `menu_categories`
- `measurement_units`
- `menu_item_modifiers`
- `menu_items`
- `order_item_modifiers`
- `order_items`
- `orders`
- `payments`
- `print_jobs`
- `printer_configs`
- `recipes`
- `restaurant_tables`
- `roles`
- `users`

## Verificar enums

```sql
SELECT typname
FROM pg_type
WHERE typtype = 'e'
ORDER BY typname;
```

## Borrar todo opcionalmente

Usa esto solo si quieres eliminar las tablas y tipos creados:

```bash
psql -U postgres -d restaurant_db -f database/drop.sql
```

## Usuario admin inicial

El archivo `seed.sql` deja comentado el `INSERT` del usuario administrador porque la contrasena debe guardarse hasheada con bcrypt o argon2 desde el backend.

Usuario deseado:

- email: `admin@restaurant.local`
- password temporal: `Admin123!`
- rol: `SUPER_ADMIN`
