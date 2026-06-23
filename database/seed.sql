INSERT INTO roles (name, description, permissions)
VALUES
  ('SUPER_ADMIN', 'Acceso total al sistema POS/PWA.', '{"all": true}'::JSONB),
  ('ADMIN', 'Administracion general del restaurante.', '{"admin": true}'::JSONB),
  ('MANAGER', 'Gestion operativa de salon, menu y reportes.', '{"management": true}'::JSONB),
  ('WAITER', 'Atencion de mesas y toma de ordenes.', '{"orders": ["read", "create"], "tables": ["read_assigned"]}'::JSONB),
  ('KITCHEN', 'Acceso a comandas y kanban de cocina.', '{"kitchen": true}'::JSONB),
  ('CASHIER', 'Cobro de ordenes, pagos y caja.', '{"payments": true, "cash_register": true}'::JSONB),
  ('INVENTORY', 'Gestion de inventario e insumos.', '{"inventory": true}'::JSONB)
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO app_themes (
  restaurant_name,
  primary_color,
  secondary_color,
  background_color,
  text_color,
  button_color,
  card_color,
  border_radius,
  font_family,
  dark_mode_enabled
)
SELECT
  'Mi Restaurante',
  '#0f766e',
  '#f97316',
  '#f8fafc',
  '#111827',
  '#0f766e',
  '#ffffff',
  '8px',
  'Inter, sans-serif',
  FALSE
WHERE NOT EXISTS (
  SELECT 1
  FROM app_themes
  WHERE restaurant_name = 'Mi Restaurante'
);

INSERT INTO dining_areas (name, description)
VALUES
  ('Salon Principal', 'Area principal del restaurante.'),
  ('Terraza', 'Area exterior o semi exterior.')
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO measurement_units (code, name, base_code, to_base_factor)
VALUES
  ('g', 'Gramos', 'g', 1),
  ('kg', 'Kilogramos', 'g', 1000),
  ('ml', 'Mililitros', 'ml', 1),
  ('l', 'Litros', 'ml', 1000),
  ('unit', 'Unidades', 'unit', 1)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  base_code = EXCLUDED.base_code,
  to_base_factor = EXCLUDED.to_base_factor,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO menu_categories (parent_id, name, description, sort_order)
SELECT root.parent_id, root.name, root.description, root.sort_order
FROM (
  VALUES
    (NULL::UUID, 'Entradas', 'Entradas y aperitivos.', 10),
    (NULL::UUID, 'Platos Fuertes', 'Platos principales del menu.', 20),
    (NULL::UUID, 'Bebidas', 'Bebidas frias y calientes.', 30),
    (NULL::UUID, 'Postres', 'Postres y dulces.', 40)
) AS root(parent_id, name, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_categories existing
  WHERE existing.parent_id IS NULL
    AND existing.name = root.name
);

INSERT INTO menu_categories (parent_id, name, description, sort_order)
SELECT parent.id, child.name, child.description, child.sort_order
FROM menu_categories parent
CROSS JOIN (
  VALUES
    ('Gaseosas', 'Bebidas gaseosas.', 10),
    ('Licores', 'Bebidas alcoholicas.', 20),
    ('Jugos', 'Jugos naturales y preparados.', 30),
    ('Cafes', 'Cafe y bebidas calientes.', 40)
) AS child(name, description, sort_order)
WHERE parent.name = 'Bebidas' AND parent.parent_id IS NULL
ON CONFLICT (parent_id, name) DO UPDATE
SET
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO app_settings (key, label, value, description, "group")
VALUES
  ('table_status_after_payment', 'Mesa al pagar', 'CLEANING', 'Estado que recibe una mesa cuando la orden queda pagada.', 'cashier'),
  ('default_tax_rate', 'Impuesto default', '0', 'Porcentaje de impuesto aplicado por defecto a las ordenes.', 'orders'),
  ('allow_waiter_cancel_pending_items', 'Mesero cancela pendientes', 'true', 'Permite retirar productos pendientes antes de enviarlos a cocina.', 'orders')
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  "group" = EXCLUDED."group",
  is_active = TRUE,
  updated_at = NOW();

-- Usuario admin inicial deseado:
-- email: admin@restaurant.local
-- password temporal: Admin123!
--
-- IMPORTANTE:
-- No se inserta por defecto porque password_hash debe ser generado de forma segura
-- por el backend usando bcrypt o argon2. Nunca guardes Admin123! en texto plano.
--
-- Ejemplo cuando tengas un hash real:
--
-- INSERT INTO users (role_id, name, email, password_hash, is_active)
-- SELECT id, 'Administrador', 'admin@restaurant.local', '<PEGAR_HASH_BCRYPT_O_ARGON2_AQUI>', TRUE
-- FROM roles
-- WHERE name = 'SUPER_ADMIN'
-- ON CONFLICT (email) DO UPDATE
-- SET
--   role_id = EXCLUDED.role_id,
--   name = EXCLUDED.name,
--   password_hash = EXCLUDED.password_hash,
--   is_active = TRUE,
--   updated_at = NOW();
