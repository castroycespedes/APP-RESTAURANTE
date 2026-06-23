CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'WAITER',
    'KITCHEN',
    'CASHIER',
    'INVENTORY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE table_status AS ENUM (
    'AVAILABLE',
    'OCCUPIED',
    'RESERVED',
    'CLEANING',
    'BLOCKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE table_shape AS ENUM (
    'ROUND',
    'SQUARE',
    'RECTANGLE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE order_status AS ENUM (
    'OPEN',
    'SENT',
    'IN_PROGRESS',
    'READY',
    'SERVED',
    'PAID',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE order_item_status AS ENUM (
    'PENDING',
    'SENT',
    'PREPARING',
    'READY',
    'SERVED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE payment_method AS ENUM (
    'CASH',
    'CARD',
    'TRANSFER',
    'QR',
    'MIXED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE inventory_movement_type AS ENUM (
    'IN',
    'OUT',
    'ADJUSTMENT',
    'WASTE',
    'RETURN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE kitchen_ticket_status AS ENUM (
    'RECEIVED',
    'PREPARING',
    'READY',
    'DELIVERED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE discount_type AS ENUM (
    'PERCENTAGE',
    'FIXED_AMOUNT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE cash_register_status AS ENUM (
    'OPEN',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE print_job_status AS ENUM (
    'QUEUED',
    'PRINTING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE printer_target_type AS ENUM (
    'DINING_AREA',
    'MENU_CATEGORY',
    'KITCHEN_STATION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name user_role NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone VARCHAR(40),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id)
    REFERENCES roles(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  document_number VARCHAR(80) UNIQUE,
  position VARCHAR(120) NOT NULL,
  hire_date DATE,
  salary NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_employees_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(40),
  email VARCHAR(180),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dining_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dining_area_id UUID NOT NULL,
  assigned_waiter_id UUID,
  name VARCHAR(120) NOT NULL,
  number INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  status table_status NOT NULL DEFAULT 'AVAILABLE',
  shape table_shape NOT NULL DEFAULT 'SQUARE',
  location_x NUMERIC(10, 2) NOT NULL DEFAULT 0,
  location_y NUMERIC(10, 2) NOT NULL DEFAULT 0,
  color VARCHAR(32),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_restaurant_tables_dining_area
    FOREIGN KEY (dining_area_id)
    REFERENCES dining_areas(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_restaurant_tables_assigned_waiter
    FOREIGN KEY (assigned_waiter_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT uq_restaurant_tables_area_number UNIQUE (dining_area_id, number),
  CONSTRAINT chk_restaurant_tables_capacity CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID,
  name VARCHAR(140) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_menu_categories_parent
    FOREIGN KEY (parent_id)
    REFERENCES menu_categories(id)
    ON DELETE SET NULL,
  CONSTRAINT uq_menu_categories_parent_name UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  preparation_time_minutes INTEGER,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_menu_items_category
    FOREIGN KEY (category_id)
    REFERENCES menu_categories(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_menu_items_price CHECK (price >= 0),
  CONSTRAINT chk_menu_items_preparation_time CHECK (preparation_time_minutes IS NULL OR preparation_time_minutes >= 0)
);

CREATE TABLE IF NOT EXISTS menu_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL,
  name VARCHAR(160) NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  max_selections INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_menu_item_modifiers_menu_item
    FOREIGN KEY (menu_item_id)
    REFERENCES menu_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_menu_item_modifiers_price CHECK (price >= 0),
  CONSTRAINT chk_menu_item_modifiers_max CHECK (max_selections IS NULL OR max_selections > 0)
);

CREATE TABLE IF NOT EXISTS measurement_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  base_code VARCHAR(40) NOT NULL,
  to_base_factor NUMERIC(14, 6) NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_measurement_units_factor CHECK (to_base_factor > 0)
);

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID,
  name VARCHAR(160) NOT NULL UNIQUE,
  unit VARCHAR(40) NOT NULL,
  current_stock NUMERIC(14, 3) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(14, 3) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ingredients_unit
    FOREIGN KEY (unit_id)
    REFERENCES measurement_units(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_ingredients_current_stock CHECK (current_stock >= 0),
  CONSTRAINT chk_ingredients_minimum_stock CHECK (minimum_stock >= 0),
  CONSTRAINT chk_ingredients_cost CHECK (cost_per_unit >= 0)
);

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  unit_id UUID,
  quantity NUMERIC(14, 3) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_recipes_menu_item
    FOREIGN KEY (menu_item_id)
    REFERENCES menu_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_recipes_ingredient
    FOREIGN KEY (ingredient_id)
    REFERENCES ingredients(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_recipes_unit
    FOREIGN KEY (unit_id)
    REFERENCES measurement_units(id)
    ON DELETE SET NULL,
  CONSTRAINT uq_recipes_menu_item_ingredient UNIQUE (menu_item_id, ingredient_id),
  CONSTRAINT chk_recipes_quantity CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL,
  created_by_id UUID,
  type inventory_movement_type NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  reason TEXT,
  reference_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_inventory_movements_ingredient
    FOREIGN KEY (ingredient_id)
    REFERENCES ingredients(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movements_created_by
    FOREIGN KEY (created_by_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_inventory_movements_quantity CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL,
  waiter_id UUID NOT NULL,
  customer_id UUID,
  status order_status NOT NULL DEFAULT 'OPEN',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_orders_table
    FOREIGN KEY (table_id)
    REFERENCES restaurant_tables(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_waiter
    FOREIGN KEY (waiter_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_orders_totals CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND total >= 0)
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  menu_item_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status order_item_status NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  sent_to_kitchen_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_menu_item
    FOREIGN KEY (menu_item_id)
    REFERENCES menu_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_items_prices CHECK (unit_price >= 0 AND total_price >= 0)
);

CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL,
  modifier_id UUID,
  name VARCHAR(160) NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_order_item_modifiers_order_item
    FOREIGN KEY (order_item_id)
    REFERENCES order_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_order_item_modifiers_modifier
    FOREIGN KEY (modifier_id)
    REFERENCES menu_item_modifiers(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_order_item_modifiers_price CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS kitchen_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  table_id UUID NOT NULL,
  waiter_id UUID NOT NULL,
  status kitchen_ticket_status NOT NULL DEFAULT 'RECEIVED',
  printed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_kitchen_tickets_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_kitchen_tickets_table
    FOREIGN KEY (table_id)
    REFERENCES restaurant_tables(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_kitchen_tickets_waiter
    FOREIGN KEY (waiter_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  target_type printer_target_type NOT NULL,
  dining_area_id UUID,
  menu_category_id UUID,
  station_name VARCHAR(120),
  printer_name VARCHAR(180),
  network_address VARCHAR(180),
  paper_width_mm INTEGER NOT NULL DEFAULT 80,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_printer_configs_dining_area
    FOREIGN KEY (dining_area_id)
    REFERENCES dining_areas(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_printer_configs_menu_category
    FOREIGN KEY (menu_category_id)
    REFERENCES menu_categories(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_printer_configs_paper_width CHECK (paper_width_mm >= 58)
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_ticket_id UUID,
  printer_config_id UUID,
  created_by_id UUID,
  status print_job_status NOT NULL DEFAULT 'QUEUED',
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  queued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_print_jobs_kitchen_ticket
    FOREIGN KEY (kitchen_ticket_id)
    REFERENCES kitchen_tickets(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_print_jobs_printer_config
    FOREIGN KEY (printer_config_id)
    REFERENCES printer_configs(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_print_jobs_created_by
    FOREIGN KEY (created_by_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_print_jobs_attempts CHECK (attempts >= 0)
);

CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_ticket_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_kitchen_ticket_items_ticket
    FOREIGN KEY (kitchen_ticket_id)
    REFERENCES kitchen_tickets(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_kitchen_ticket_items_order_item
    FOREIGN KEY (order_item_id)
    REFERENCES order_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_kitchen_ticket_items_quantity CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL UNIQUE,
  type discount_type NOT NULL,
  value NUMERIC(12, 2) NOT NULL,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_discounts_value CHECK (value >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  method payment_method NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  reference VARCHAR(180),
  paid_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_payments_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_payments_amount CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by_id UUID NOT NULL,
  closed_by_id UUID,
  opening_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(12, 2),
  status cash_register_status NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_cash_registers_opened_by
    FOREIGN KEY (opened_by_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_cash_registers_closed_by
    FOREIGN KEY (closed_by_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_cash_registers_amounts CHECK (
    opening_amount >= 0
    AND (closing_amount IS NULL OR closing_amount >= 0)
  )
);

CREATE TABLE IF NOT EXISTS app_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name VARCHAR(180) NOT NULL DEFAULT 'Mi Restaurante',
  logo_url TEXT,
  primary_color VARCHAR(32) NOT NULL DEFAULT '#0f766e',
  secondary_color VARCHAR(32) NOT NULL DEFAULT '#f97316',
  background_color VARCHAR(32) NOT NULL DEFAULT '#f8fafc',
  text_color VARCHAR(32) NOT NULL DEFAULT '#111827',
  button_color VARCHAR(32) NOT NULL DEFAULT '#0f766e',
  card_color VARCHAR(32) NOT NULL DEFAULT '#ffffff',
  border_radius VARCHAR(24) NOT NULL DEFAULT '8px',
  font_family VARCHAR(120) NOT NULL DEFAULT 'Inter, sans-serif',
  dark_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(120) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  "group" VARCHAR(80) NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(120) NOT NULL,
  entity VARCHAR(120) NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_assigned_waiter_id ON restaurant_tables(assigned_waiter_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_dining_area_id ON restaurant_tables(dining_area_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_parent_id ON menu_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_active ON menu_items(is_active);
CREATE INDEX IF NOT EXISTS idx_app_settings_group ON app_settings("group");
CREATE INDEX IF NOT EXISTS idx_app_settings_is_active ON app_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_app_settings_created_at ON app_settings(created_at);
CREATE INDEX IF NOT EXISTS idx_measurement_units_base_code ON measurement_units(base_code);
CREATE INDEX IF NOT EXISTS idx_measurement_units_is_active ON measurement_units(is_active);
CREATE INDEX IF NOT EXISTS idx_ingredients_unit_id ON ingredients(unit_id);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient_id ON recipes(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipes_unit_id ON recipes(unit_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient_id ON inventory_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_waiter_id ON orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order_id ON kitchen_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_status ON kitchen_tickets(status);
CREATE INDEX IF NOT EXISTS idx_printer_configs_target_type ON printer_configs(target_type);
CREATE INDEX IF NOT EXISTS idx_printer_configs_dining_area_id ON printer_configs(dining_area_id);
CREATE INDEX IF NOT EXISTS idx_printer_configs_menu_category_id ON printer_configs(menu_category_id);
CREATE INDEX IF NOT EXISTS idx_printer_configs_station_name ON printer_configs(station_name);
CREATE INDEX IF NOT EXISTS idx_printer_configs_is_active ON printer_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_print_jobs_kitchen_ticket_id ON print_jobs(kitchen_ticket_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_config_id ON print_jobs(printer_config_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_by_id ON print_jobs(created_by_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_queued_at ON print_jobs(queued_at);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_dining_areas_updated_at ON dining_areas;
CREATE TRIGGER trg_dining_areas_updated_at
BEFORE UPDATE ON dining_areas
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_tables_updated_at ON restaurant_tables;
CREATE TRIGGER trg_restaurant_tables_updated_at
BEFORE UPDATE ON restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_categories_updated_at ON menu_categories;
CREATE TRIGGER trg_menu_categories_updated_at
BEFORE UPDATE ON menu_categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON menu_items;
CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON menu_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_item_modifiers_updated_at ON menu_item_modifiers;
CREATE TRIGGER trg_menu_item_modifiers_updated_at
BEFORE UPDATE ON menu_item_modifiers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ingredients_updated_at ON ingredients;
CREATE TRIGGER trg_ingredients_updated_at
BEFORE UPDATE ON ingredients
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_measurement_units_updated_at ON measurement_units;
CREATE TRIGGER trg_measurement_units_updated_at
BEFORE UPDATE ON measurement_units
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_recipes_updated_at ON recipes;
CREATE TRIGGER trg_recipes_updated_at
BEFORE UPDATE ON recipes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_order_items_updated_at ON order_items;
CREATE TRIGGER trg_order_items_updated_at
BEFORE UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_kitchen_tickets_updated_at ON kitchen_tickets;
CREATE TRIGGER trg_kitchen_tickets_updated_at
BEFORE UPDATE ON kitchen_tickets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_printer_configs_updated_at ON printer_configs;
CREATE TRIGGER trg_printer_configs_updated_at
BEFORE UPDATE ON printer_configs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_print_jobs_updated_at ON print_jobs;
CREATE TRIGGER trg_print_jobs_updated_at
BEFORE UPDATE ON print_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_discounts_updated_at ON discounts;
CREATE TRIGGER trg_discounts_updated_at
BEFORE UPDATE ON discounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cash_registers_updated_at ON cash_registers;
CREATE TRIGGER trg_cash_registers_updated_at
BEFORE UPDATE ON cash_registers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_app_themes_updated_at ON app_themes;
CREATE TRIGGER trg_app_themes_updated_at
BEFORE UPDATE ON app_themes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
