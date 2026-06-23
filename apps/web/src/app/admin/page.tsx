'use client';

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@restaurante/ui';
import { AuthGate, useAuth } from '../auth-provider';
import { AppTheme, useAppTheme } from '../theme-provider';
import { isStrongTemporaryPassword, parseApiResponse } from './admin-form-utils';

type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'WAITER' | 'KITCHEN' | 'CASHIER' | 'INVENTORY';
type SectionKey =
  | 'dashboard'
  | 'employees'
  | 'customers'
  | 'areas'
  | 'tables'
  | 'menu'
  | 'categories'
  | 'items'
  | 'modifiers'
  | 'discounts'
  | 'inventory'
  | 'suppliers'
  | 'purchases'
  | 'counts'
  | 'recipes'
  | 'cashier'
  | 'reports'
  | 'theme'
  | 'settings';

interface AdminRow {
  id: string;
  displayId?: string;
  name: string;
  status: string;
  detail: string;
  metric: string;
}

interface AdminSection {
  key: SectionKey;
  label: string;
  description: string;
  rows: AdminRow[];
  filters: string[];
}

interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  role: {
    key: AdminRole;
    name: string;
  };
}

interface ApiEmployee {
  id: string;
  employeeCode: string;
  documentId?: string | null;
  position?: string | null;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: {
      key: AdminRole;
      name: string;
    };
  };
}

type FieldType = 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea';

interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
  optionSource?: SectionKey;
  optionLabel?: (item: Record<string, unknown>) => string;
}

interface ResourceConfig {
  title: string;
  successMessage: string;
  endpoint: string;
  listEndpoint?: string;
  fields: FormField[];
  rowMapper: (item: Record<string, unknown>) => AdminRow;
}

type EditableResourceSection = 'customers' | 'areas' | 'categories' | 'modifiers' | 'discounts' | 'inventory' | 'suppliers';

interface ReportRow {
  id: string;
  date: string;
  type: string;
  employee: string;
  employeeId?: string | null;
  table: string;
  tableId?: string | null;
  paymentMethod?: string | null;
  category: string;
  categoryId?: string | null;
  concept: string;
  quantity: number;
  amount: number;
}

interface ReportsResponse {
  generatedAt: string;
  generatedBy: string;
  filters: Record<string, string | undefined>;
  summary: {
    salesTotal: number;
    discountsTotal: number;
    cancellationsTotal: number;
    cashClosings: number;
    rowCount: number;
  };
  rows: ReportRow[];
  options: {
    waiters: Array<{ id: string; name: string }>;
    tables: Array<{ id: string; name: string }>;
    categories: Array<{ id: string; name: string }>;
    paymentMethods: string[];
    reportTypes: string[];
  };
}

interface SettingDefinition {
  key: string;
  label: string;
  group: string;
  type: 'text' | 'email' | 'number' | 'select' | 'checkbox';
  description: string;
  defaultValue: string;
  options?: Array<{ label: string; value: string }>;
}

const allowedRoles: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const reportTypes = [
  'Todos',
  'Venta',
  'Producto vendido',
  'Categoria vendida',
  'Descuento aplicado',
  'Cancelacion',
  'Inventario bajo',
  'Cierre de caja'
];

const settingDefinitions: SettingDefinition[] = [
  { key: 'restaurant_legal_name', label: 'Nombre comercial', group: 'Datos del restaurante', type: 'text', defaultValue: 'Mi Restaurante', description: 'Nombre visible en recibos, reportes y carta.' },
  { key: 'restaurant_tax_id', label: 'NIT/RUC/Identificacion fiscal', group: 'Datos del restaurante', type: 'text', defaultValue: '', description: 'Identificacion fiscal.' },
  { key: 'restaurant_address', label: 'Direccion', group: 'Datos del restaurante', type: 'text', defaultValue: '', description: 'Direccion comercial.' },
  { key: 'restaurant_phone', label: 'Telefono', group: 'Datos del restaurante', type: 'text', defaultValue: '', description: 'Telefono de contacto.' },
  { key: 'restaurant_email', label: 'Email', group: 'Datos del restaurante', type: 'email', defaultValue: '', description: 'Correo de contacto.' },
  { key: 'restaurant_logo_url', label: 'Logo', group: 'Datos del restaurante', type: 'text', defaultValue: '', description: 'URL del logo.' },
  { key: 'restaurant_city', label: 'Ciudad', group: 'Datos del restaurante', type: 'text', defaultValue: '', description: 'Ciudad.' },
  { key: 'restaurant_country', label: 'Pais', group: 'Datos del restaurante', type: 'text', defaultValue: 'Colombia', description: 'Pais.' },
  { key: 'currency', label: 'Moneda', group: 'Operacion', type: 'select', defaultValue: 'COP', description: 'Moneda para caja y reportes.', options: enumOptions(['COP', 'USD', 'EUR', 'MXN', 'PEN', 'CLP']) },
  { key: 'timezone', label: 'Zona horaria', group: 'Operacion', type: 'select', defaultValue: 'America/Bogota', description: 'Zona horaria operativa.', options: enumOptions(['America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Santiago', 'America/New_York']) },
  { key: 'language', label: 'Idioma', group: 'Operacion', type: 'select', defaultValue: 'es-CO', description: 'Idioma del sistema.', options: enumOptions(['es-CO', 'es-MX', 'es-PE', 'es-CL', 'en-US']) },
  { key: 'default_tax_rate', label: 'Porcentaje de impuesto', group: 'Operacion', type: 'number', defaultValue: '0', description: 'Impuesto aplicado en caja.' },
  { key: 'suggested_tip_rate', label: 'Propina sugerida', group: 'Operacion', type: 'number', defaultValue: '10', description: 'Porcentaje sugerido.' },
  { key: 'allow_custom_tip', label: 'Permitir propina personalizada', group: 'Operacion', type: 'checkbox', defaultValue: 'true', description: 'Permite editar propina.' },
  { key: 'allow_waiter_discounts', label: 'Descuentos por mesero', group: 'Operacion', type: 'checkbox', defaultValue: 'false', description: 'Permite descuentos menores por mesero.' },
  { key: 'table_status_after_payment', label: 'Estado de mesa despues de pago', group: 'Operacion', type: 'select', defaultValue: 'CLEANING', description: 'Estado final de mesa.', options: [{ label: 'Disponible', value: 'AVAILABLE' }, { label: 'En limpieza', value: 'CLEANING' }] },
  { key: 'require_open_cash_register', label: 'Requerir caja abierta', group: 'Caja', type: 'checkbox', defaultValue: 'true', description: 'Impide cobrar sin caja abierta.' },
  { key: 'allow_cashier_request_payment', label: 'Caja puede pasar a cuenta', group: 'Caja', type: 'checkbox', defaultValue: 'true', description: 'Permite que caja ponga una orden en espera de pago.' },
  { key: 'allow_mixed_payments', label: 'Permitir pagos mixtos', group: 'Caja', type: 'checkbox', defaultValue: 'true', description: 'Combinar metodos.' },
  { key: 'allow_split_bill', label: 'Permitir dividir cuenta', group: 'Caja', type: 'checkbox', defaultValue: 'true', description: 'Activa division visual.' },
  { key: 'print_receipt_after_payment', label: 'Imprimir recibo despues de pago', group: 'Caja', type: 'checkbox', defaultValue: 'true', description: 'Prepara recibo al pagar.' },
  { key: 'show_tip_on_receipt', label: 'Mostrar propina en recibo', group: 'Caja', type: 'checkbox', defaultValue: 'true', description: 'Incluye propina.' },
  { key: 'allow_waiter_open_table', label: 'Mesero abre mesa', group: 'Mesas', type: 'checkbox', defaultValue: 'true', description: 'Mesero abre orden.' },
  { key: 'allow_change_table_waiter', label: 'Cambiar mesero de mesa', group: 'Mesas', type: 'checkbox', defaultValue: 'true', description: 'Permite reasignar.' },
  { key: 'allow_move_products_between_tables', label: 'Mover productos entre mesas', group: 'Mesas', type: 'checkbox', defaultValue: 'false', description: 'Preparado para traslado.' },
  { key: 'allow_join_tables', label: 'Unir mesas', group: 'Mesas', type: 'checkbox', defaultValue: 'false', description: 'Preparado para unir mesas.' },
  { key: 'allow_split_table', label: 'Dividir mesa', group: 'Mesas', type: 'checkbox', defaultValue: 'false', description: 'Preparado para dividir mesa.' },
  { key: 'use_kitchen_screen', label: 'Usar pantalla de cocina', group: 'Cocina', type: 'checkbox', defaultValue: 'true', description: 'Activa kanban.' },
  { key: 'auto_print_kitchen_ticket', label: 'Imprimir ticket automaticamente', group: 'Cocina', type: 'checkbox', defaultValue: 'false', description: 'Preparado para impresora.' },
  { key: 'kitchen_group_tickets_by', label: 'Agrupar comandas', group: 'Cocina', type: 'select', defaultValue: 'table', description: 'Agrupacion de cocina.', options: [{ label: 'Por mesa', value: 'table' }, { label: 'Por categoria', value: 'category' }] },
  { key: 'delayed_order_alert_minutes', label: 'Alerta pedido demorado', group: 'Cocina', type: 'number', defaultValue: '20', description: 'Minutos para alerta.' },
  { key: 'hide_sold_out_for_waiters', label: 'Ocultar agotados a meseros', group: 'Menu', type: 'checkbox', defaultValue: 'true', description: 'Oculta agotados.' },
  { key: 'hide_sold_out_public_menu', label: 'Ocultar agotados en carta', group: 'Menu', type: 'checkbox', defaultValue: 'true', description: 'Oculta agotados en PDF.' },
  { key: 'show_product_images', label: 'Mostrar imagenes de productos', group: 'Menu', type: 'checkbox', defaultValue: 'true', description: 'Muestra imagenes.' },
  { key: 'show_product_descriptions', label: 'Mostrar descripciones', group: 'Menu', type: 'checkbox', defaultValue: 'true', description: 'Muestra textos.' },
  { key: 'session_expiration_minutes', label: 'Tiempo de expiracion de sesion', group: 'Seguridad', type: 'number', defaultValue: '480', description: 'Minutos de sesion.' },
  { key: 'require_reason_cancel_product', label: 'Motivo para cancelar producto', group: 'Seguridad', type: 'checkbox', defaultValue: 'true', description: 'Exige motivo.' },
  { key: 'require_permission_discounts', label: 'Permiso para descuentos', group: 'Seguridad', type: 'checkbox', defaultValue: 'true', description: 'Valida permisos.' },
  { key: 'require_permission_cancel_sent_order', label: 'Permiso cancelar enviado', group: 'Seguridad', type: 'checkbox', defaultValue: 'true', description: 'Protege cocina.' },
  { key: 'discount_manager_percent_threshold', label: 'Descuento % requiere permiso', group: 'Seguridad', type: 'number', defaultValue: '10', description: 'Umbral porcentaje.' },
  { key: 'discount_manager_amount_threshold', label: 'Descuento valor requiere permiso', group: 'Seguridad', type: 'number', defaultValue: '50000', description: 'Umbral valor fijo.' }
];

const quickAccess = [
  { label: 'Crear mesa', helper: 'Mapa visual y salon', target: 'tables' as SectionKey },
  { label: 'Crear producto', helper: 'Platos y bebidas', target: 'items' as SectionKey },
  { label: 'Crear receta', helper: 'Ingredientes por plato', target: 'recipes' as SectionKey },
  { label: 'Crear caja', helper: 'Apertura y cobros', target: 'cashier' as SectionKey },
  { label: 'Ver reportes', helper: 'Ventas e inventario', target: 'reports' as SectionKey }
];

const sectionActions: Record<SectionKey, string> = {
  dashboard: 'Selecciona un acceso rapido o una opcion del menu lateral.',
  employees: 'Crear empleado y su usuario de acceso.',
  customers: 'Crear cliente y guardar datos de contacto.',
  areas: 'Crear area del restaurante para organizar mesas.',
  tables: 'Crear mesa, asignar salon y mesero.',
  menu: 'Consultar estructura general del menu.',
  categories: 'Crear categoria o subcategoria.',
  items: 'Crear producto, plato o bebida.',
  modifiers: 'Crear adicional o modificador.',
  discounts: 'Crear descuento para caja.',
  inventory: 'Conteo manual del stock actual.',
  suppliers: 'Crear proveedor para compras de inventario.',
  purchases: 'Registrar compras recibidas y costos reales.',
  counts: 'Hacer conteo fisico y detectar faltantes o sobrantes.',
  recipes: 'Crear receta por plato.',
  cashier: 'Crear caja, cobrar ordenes y registrar pagos.',
  reports: 'Ver reportes y exportar CSV.',
  theme: 'Editar tema visual y guardar cambios.',
  settings: 'Actualizar parametros generales del sistema.'
};

const editableResourceSections: EditableResourceSection[] = ['customers', 'areas', 'categories', 'modifiers', 'discounts', 'inventory', 'suppliers'];

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const accessTokenStorageKey = 'accessToken';
const refreshTokenStorageKey = 'refreshToken';

const sections: AdminSection[] = [
  { key: 'employees', label: 'Empleados', description: 'Usuarios, cargos y estado laboral.', filters: ['Todos', 'Activos', 'Inactivos'], rows: [] },
  { key: 'customers', label: 'Clientes', description: 'Datos de contacto y notas.', filters: ['Todos', 'Activos', 'Inactivos'], rows: [] },
  { key: 'areas', label: 'Areas', description: 'Zonas del restaurante para organizar mesas.', filters: ['Todas', 'Activas', 'Inactivas'], rows: [] },
  { key: 'tables', label: 'Mesas', description: 'Salon, posiciones y meseros asignados.', filters: ['Todas', 'Ocupadas', 'Disponibles'], rows: [] },
  { key: 'menu', label: 'Menu', description: 'Vista general de categorias, platos y adicionales.', filters: ['Todos', 'Disponibles', 'Bloqueados'], rows: [] },
  { key: 'categories', label: 'Categorias', description: 'Categorias y subcategorias del menu.', filters: ['Todas', 'Raiz', 'Subcategorias'], rows: [] },
  { key: 'items', label: 'Platos', description: 'Platos, bebidas, precios y disponibilidad.', filters: ['Todos', 'Disponibles', 'No disponibles'], rows: [] },
  { key: 'modifiers', label: 'Adicionales', description: 'Modificadores por producto.', filters: ['Todos', 'Obligatorios', 'Opcionales'], rows: [] },
  { key: 'discounts', label: 'Descuentos', description: 'Promociones y autorizaciones.', filters: ['Todos', 'Activos', 'Inactivos'], rows: [] },
  { key: 'inventory', label: 'Inventario', description: 'Manual de stock actual y diferencias de conteo.', filters: ['Todos', 'Bajo stock', 'Activos'], rows: [] },
  { key: 'suppliers', label: 'Proveedores', description: 'Contactos de proveedores para compras.', filters: ['Todos', 'Activos', 'Inactivos'], rows: [] },
  { key: 'purchases', label: 'Compras', description: 'Entradas de inventario con proveedor, factura y costo.', filters: ['Todos'], rows: [] },
  { key: 'counts', label: 'Conteos', description: 'Conteos fisicos con faltantes, normales y sobrantes.', filters: ['Todos', 'Faltante', 'Normal', 'Sobrante'], rows: [] },
  { key: 'recipes', label: 'Recetas', description: 'Consumo de ingredientes por plato.', filters: ['Todas', 'Completas', 'Sin costo'], rows: [] },
  { key: 'cashier', label: 'Caja', description: 'Caja, pagos y cierres.', filters: ['Hoy', 'Abiertas', 'Cerradas'], rows: [] },
  { key: 'reports', label: 'Reportes', description: 'Ventas, productos y operaciones.', filters: ['Hoy', 'Semana', 'Mes'], rows: [] },
  { key: 'theme', label: 'Tema visual', description: 'Colores, logo y apariencia.', filters: ['Activo'], rows: [] },
  { key: 'settings', label: 'Configuracion general', description: 'Parametros operativos del sistema.', filters: ['Todos', 'Activos'], rows: [] }
];

const navItems = [{ key: 'dashboard' as SectionKey, label: 'Dashboard' }, ...sections.map((section) => ({ key: section.key, label: section.label }))];
const hexFields: Array<{ key: keyof Pick<AppTheme, 'primaryColor' | 'secondaryColor' | 'backgroundColor' | 'textColor' | 'buttonColor' | 'cardColor'>; label: string }> = [
  { key: 'primaryColor', label: 'Principal' },
  { key: 'secondaryColor', label: 'Secundario' },
  { key: 'backgroundColor', label: 'Fondo' },
  { key: 'textColor', label: 'Texto' },
  { key: 'buttonColor', label: 'Boton' },
  { key: 'cardColor', label: 'Tarjeta' }
];

function initialAdminSection(): SectionKey {
  if (typeof window === 'undefined') {
    return 'dashboard';
  }

  const hashSection = window.location.hash.replace('#', '') as SectionKey;

  return navItems.some((item) => item.key === hashSection) ? hashSection : 'dashboard';
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return value.toLocaleString('es-CO', {
    currency: 'COP',
    maximumFractionDigits: 0,
    style: 'currency'
  });
}

function isErrorMessage(message: string) {
  return message.startsWith('Error') || message.startsWith('No se pudo') || message.startsWith('Debes');
}

function toastDuration(message: string) {
  return isErrorMessage(message) ? 5000 : 3000;
}

export default function AdminPage() {
  const { accessToken, logout, user } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionKey>(() => initialAdminSection());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [message, setMessage] = useState('');
  const [adminUsers, setAdminUsers] = useState<ApiUser[]>([]);
  const [adminEmployees, setAdminEmployees] = useState<ApiEmployee[]>([]);
  const [resourceRows, setResourceRows] = useState<Partial<Record<SectionKey, Array<Record<string, unknown>>>>>({});
  const [editingEmployee, setEditingEmployee] = useState<ApiEmployee | null>(null);
  const [employeeFormVersion, setEmployeeFormVersion] = useState(0);
  const [editingTable, setEditingTable] = useState<Record<string, unknown> | null>(null);
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [editingResource, setEditingResource] = useState<{ section: EditableResourceSection; item: Record<string, unknown> } | null>(null);
  const [selectedRecipeMenuItemId, setSelectedRecipeMenuItemId] = useState('');
  const [showSoldOutInMenuPdf, setShowSoldOutInMenuPdf] = useState(false);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tableAreaFilter, setTableAreaFilter] = useState('');
  const [tableWaiterFilter, setTableWaiterFilter] = useState('');
  const [selectedAssignmentTableIds, setSelectedAssignmentTableIds] = useState<string[]>([]);
  const [bulkAssignmentWaiterId, setBulkAssignmentWaiterId] = useState('');
  const [inventoryMovements, setInventoryMovements] = useState<Array<Record<string, unknown>>>([]);
  const [inventorySuppliers, setInventorySuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [inventoryPurchases, setInventoryPurchases] = useState<Array<Record<string, unknown>>>([]);
  const [inventoryCounts, setInventoryCounts] = useState<Array<Record<string, unknown>>>([]);
  const [reportStartDate, setReportStartDate] = useState(todayInputValue);
  const [reportEndDate, setReportEndDate] = useState(todayInputValue);
  const [reportType, setReportType] = useState('Todos');
  const [reportEmployee, setReportEmployee] = useState('');
  const [reportTable, setReportTable] = useState('');
  const [reportPaymentMethod, setReportPaymentMethod] = useState('');
  const [reportCategory, setReportCategory] = useState('');
  const [reportsData, setReportsData] = useState<ReportsResponse | null>(null);
  const { draftTheme, updateDraft, saveTheme, restoreDefault } = useAppTheme();
  const currentRole = (user?.role ?? 'ADMIN') as AdminRole;

  const currentSection = sections.find((section) => section.key === activeSection);
  const resourceConfigs = useMemo(() => createResourceConfigs(resourceRows), [resourceRows]);
  const employeeRows: AdminRow[] = useMemo(() => {
    const persistedRows = adminEmployees.map((employee) => ({
      id: employee.id,
      displayId: employee.employeeCode,
      name: `${employee.user.firstName} ${employee.user.lastName}`,
      status: employee.isActive ? 'Activo' : 'Inactivo',
      detail: employee.position || employee.user.role.name,
      metric: `${employee.employeeCode} - ${employee.user.email}`
    }));
    return persistedRows;
  }, [adminEmployees]);
  const visibleRows = useMemo(() => {
    if (!currentSection) return [];
    const query = search.trim().toLowerCase();
    const resourceConfig = resourceConfigs[activeSection];
    const apiRows = resourceRows[activeSection];
    const sourceRows =
      activeSection === 'employees' && employeeRows.length > 0
        ? employeeRows
        : resourceConfig && apiRows
          ? apiRows.map(resourceConfig.rowMapper)
          : [];

    return sourceRows.filter((row) => {
      const matchesSearch = [row.id, row.displayId, row.name, row.status, row.detail, row.metric].join(' ').toLowerCase().includes(query);
      const normalizedFilter = normalizeFilterValue(filter);
      const matchesFilter =
        filter === 'Todos' ||
        filter === 'Todas' ||
        filter === 'Hoy' ||
        normalizeFilterValue(row.status).includes(normalizedFilter) ||
        normalizeFilterValue(row.detail).includes(normalizedFilter);

      return matchesSearch && matchesFilter;
    });
  }, [activeSection, currentSection, employeeRows, filter, resourceConfigs, resourceRows, search]);
  const activeEditingResource = editingResource?.section === activeSection ? editingResource.item : null;

  const filteredReports = reportsData?.rows ?? [];
  const reportSummary = reportsData?.summary ?? { salesTotal: 0, discountsTotal: 0, cancellationsTotal: 0, cashClosings: 0, rowCount: 0 };
  const reportOptions = reportsData?.options ?? {
    waiters: [],
    tables: [],
    categories: [],
    paymentMethods: ['CASH', 'CARD', 'TRANSFER', 'QR'],
    reportTypes
  };
  const tableRows = resourceRows.tables ?? [];
  const waiterEmployees = useMemo(
    () => adminEmployees.filter((employee) => employee.isActive && employee.user.role.key === 'WAITER'),
    [adminEmployees]
  );
  const filteredTableRows = useMemo(
    () => tableRows.filter((table) => {
      const areaId = tableAreaId(table);
      const waiterId = String(table.assignedWaiterId ?? '');
      const matchesArea = !tableAreaFilter || areaId === tableAreaFilter;
      const matchesWaiter =
        !tableWaiterFilter ||
        (tableWaiterFilter === '__unassigned' ? !waiterId : waiterId === tableWaiterFilter);

      return matchesArea && matchesWaiter;
    }),
    [tableAreaFilter, tableRows, tableWaiterFilter]
  );
  const waiterAssignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();

    tableRows.forEach((table) => {
      const waiterId = String(table.assignedWaiterId ?? '');

      if (waiterId) {
        counts.set(waiterId, (counts.get(waiterId) ?? 0) + 1);
      }
    });

    return counts;
  }, [tableRows]);
  const inventoryRows = resourceRows.inventory ?? [];
  const openOrders = filteredReports.filter((row) => row.type === 'Venta').length;
  const occupiedTables = tableRows.filter((table) => String(table.status ?? '').toUpperCase() === 'OCCUPIED').length;
  const lowStockRows = inventoryRows.filter((item) => Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0));
  const soldProducts = filteredReports
    .filter((row) => row.type === 'Producto vendido')
    .reduce<Map<string, { name: string; quantity: number }>>((products, row) => {
      const current = products.get(row.concept) ?? { name: row.concept, quantity: 0 };
      current.quantity += row.quantity;
      products.set(row.concept, current);

      return products;
    }, new Map());
  const dashboardMetrics = [
    { label: 'Ventas del dia', value: formatCurrency(reportSummary.salesTotal), helper: `${reportSummary.rowCount} registros reales` },
    { label: 'Ordenes cobradas', value: String(openOrders), helper: 'Pagos registrados hoy' },
    { label: 'Mesas ocupadas', value: `${occupiedTables}/${tableRows.length}`, helper: 'Consultado desde mesas' },
    { label: 'Empleados activos', value: String(adminEmployees.filter((employee) => employee.isActive).length), helper: 'Consultado desde empleados' }
  ];
  const topSoldProducts = Array.from(soldProducts.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const visibleMessage = message === 'Error de conexion con el servidor.' ? '' : message;

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => setMessage(''), toastDuration(message));

    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    function applyHashSection() {
      const hashSection = window.location.hash.replace('#', '') as SectionKey;

      if (navItems.some((item) => item.key === hashSection)) {
        setActiveSection(hashSection);
      }
    }

    applyHashSection();
    window.addEventListener('hashchange', applyHashSection);

    return () => window.removeEventListener('hashchange', applyHashSection);
  }, []);

  useEffect(() => {
    if (activeSection !== 'employees' || !accessToken) {
      return;
    }

    void loadPeople();
  }, [accessToken, activeSection]);

  useEffect(() => {
    if (activeSection !== 'tables' || !accessToken) {
      return;
    }

    void loadPeople();
  }, [accessToken, activeSection]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void loadResource(activeSection);
  }, [accessToken, activeSection]);

  useEffect(() => {
    if (activeSection !== 'reports' || !accessToken) {
      return;
    }

    void loadReports();
  }, [accessToken, activeSection, reportCategory, reportEmployee, reportEndDate, reportPaymentMethod, reportStartDate, reportTable, reportType]);

  useEffect(() => {
    if (activeSection !== 'dashboard' || !accessToken) {
      return;
    }

    void loadDashboardData();
  }, [accessToken, activeSection, reportEndDate, reportStartDate]);

  function selectSection(section: SectionKey) {
    setActiveSection(section);
    window.history.replaceState(null, '', section === 'dashboard' ? '/admin' : `/admin#${section}`);
    setSearch('');
    setFilter('Todos');
    setEditingEmployee(null);
    setEditingTable(null);
    setEditingItem(null);
    setEditingResource(null);
    setSelectedRecipeMenuItemId('');
    setTableAreaFilter('');
    setTableWaiterFilter('');
    setSelectedAssignmentTableIds([]);
    setBulkAssignmentWaiterId('');
    setIsMobileMenuOpen(false);
    setMessage('');
  }

  function goBackToDashboard() {
    selectSection('dashboard');
  }

  async function signOut() {
    await logout();
    window.location.assign('/login');
  }

  async function adminFetch(endpoint: string, init: RequestInit = {}) {
    const currentToken = window.localStorage.getItem(accessTokenStorageKey) ?? accessToken;
    const response = await fetchWithToken(endpoint, init, currentToken);

    if (response.status !== 401) {
      return response;
    }

    const refreshToken = window.localStorage.getItem(refreshTokenStorageKey);

    if (!refreshToken) {
      return response;
    }

    const refreshResponse = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (refreshResponse.status === 401) {
      window.localStorage.removeItem(accessTokenStorageKey);
      window.localStorage.removeItem(refreshTokenStorageKey);
      window.localStorage.removeItem('sessionUser');
      return response;
    }

    if (!refreshResponse.ok) {
      return response;
    }

    const tokens = await refreshResponse.json() as { accessToken: string; refreshToken: string };
    window.localStorage.setItem(accessTokenStorageKey, tokens.accessToken);
    window.localStorage.setItem(refreshTokenStorageKey, tokens.refreshToken);

    return fetchWithToken(endpoint, init, tokens.accessToken);
  }

  function fetchWithToken(endpoint: string, init: RequestInit, token: string | null) {
    const headers = new Headers(init.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(`${apiBaseUrl}/${endpoint}`, {
      ...init,
      headers
    });
  }

  async function submitResourceForm(event: FormEvent<HTMLFormElement>, section: SectionKey) {
    event.preventDefault();
    const config = resourceConfigs[section];

    if (savingSection === section) {
      return;
    }

    if (!config) {
      setMessage('Esta seccion no usa formulario directo.');
      return;
    }

    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const missingField = config.fields.find((field) => field.required && !String(form.get(field.name) ?? '').trim());

    if (missingField) {
      setMessage(`Error: ${missingField.label} es obligatorio.`);
      return;
    }

    setSavingSection(section);

    try {
      const isEditingTable = section === 'tables' && editingTable;
      const isEditingItem = section === 'items' && editingItem;
      const isEditingResource = editingResource?.section === section;
      const body = Object.fromEntries(config.fields.map((field) => [field.name, readFormValue(form, field)]));

      if (section === 'tables' && !isEditingTable) {
        delete body.posX;
        delete body.posY;
      }

      const endpoint = isEditingTable
        ? `tables/${String(editingTable.id)}`
        : isEditingItem
          ? `menu/items/${String(editingItem.id)}`
          : isEditingResource
            ? `${config.endpoint}/${String(editingResource.item.id)}`
            : config.endpoint;
      const response = await adminFetch(endpoint, {
        method: isEditingTable || isEditingItem || isEditingResource ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const saved = await parseApiResponse<Record<string, unknown>>(response);
      const isEditing = Boolean(isEditingTable || isEditingItem || isEditingResource);
      setMessage(
        isEditingTable
          ? 'Mesa actualizada correctamente.'
          : isEditingItem
            ? 'Producto actualizado correctamente.'
            : isEditingResource
              ? `${resourceSingularLabel(section)} actualizado correctamente.`
              : config.successMessage
      );
      setResourceRows((current) => ({
        ...current,
        [section]: isEditing
          ? (current[section] ?? []).map((item) => String(item.id) === String(saved.id) ? saved : item)
          : [saved, ...(current[section] ?? [])]
      }));
      setEditingTable(null);
      setEditingItem(null);
      setEditingResource(null);
      await loadResource(section, { silent: true });
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo guardar. Revisa los datos e intenta nuevamente.');
    } finally {
      setSavingSection(null);
    }
  }

  async function deactivateEditingTable() {
    if (!editingTable || !accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('tables');

    try {
      const response = await adminFetch(`tables/${String(editingTable.id)}`, {
        method: 'DELETE'
      });

      await parseApiResponse<Record<string, unknown>>(response);
      setEditingTable(null);
      await loadResource('tables', { silent: true });
      setMessage('Mesa desactivada correctamente.');
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo desactivar la mesa.');
    } finally {
      setSavingSection(null);
    }
  }

  async function moveAdminTable(tableId: string, posX: number, posY: number) {
    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setResourceRows((current) => ({
      ...current,
      tables: (current.tables ?? []).map((table) => String(table.id) === tableId ? { ...table, posX, posY } : table)
    }));

    try {
      const response = await adminFetch(`tables/${tableId}/position`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ posX: Math.round(posX), posY: Math.round(posY) })
      });

      const updated = await parseApiResponse<Record<string, unknown>>(response);
      setResourceRows((current) => ({
        ...current,
        tables: (current.tables ?? []).map((table) => String(table.id) === tableId ? updated : table)
      }));
      setMessage('Ubicación de mesa actualizada.');
    } catch {
      setMessage('No se pudo actualizar la ubicación.');
      await loadResource('tables', { silent: true });
    }
  }

  async function assignTableWaiter(tableId: string, waiterId: string) {
    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('tables');

    try {
      const response = await adminFetch(`tables/${tableId}/assign-waiter`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ waiterId: waiterId || undefined })
      });
      const updated = await parseApiResponse<Record<string, unknown>>(response);

      setResourceRows((current) => ({
        ...current,
        tables: (current.tables ?? []).map((table) => String(table.id) === tableId ? updated : table)
      }));
      await loadResource('tables', { silent: true });
      setMessage('Mesa asignada correctamente.');
    } catch {
      setMessage('No se pudo asignar la mesa.');
    } finally {
      setSavingSection(null);
    }
  }

  async function assignSelectedTables(waiterId: string) {
    if (selectedAssignmentTableIds.length === 0) {
      setMessage('Selecciona al menos una mesa.');
      return;
    }

    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('tables');

    try {
      const updatedTables = await Promise.all(selectedAssignmentTableIds.map((tableId) =>
        adminFetch(`tables/${tableId}/assign-waiter`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ waiterId: waiterId || undefined })
        }).then((response) => parseApiResponse<Record<string, unknown>>(response))
      ));
      const updatedById = new Map(updatedTables.map((table) => [String(table.id), table]));

      setResourceRows((current) => ({
        ...current,
        tables: (current.tables ?? []).map((table) => updatedById.get(String(table.id)) ?? table)
      }));
      await loadResource('tables', { silent: true });
      setSelectedAssignmentTableIds([]);
      setBulkAssignmentWaiterId('');
      setMessage('Mesa asignada correctamente.');
    } catch {
      setMessage('No se pudieron asignar las mesas.');
    } finally {
      setSavingSection(null);
    }
  }

  async function autoArrangeAdminTables(areaTables: Array<Record<string, unknown>>) {
    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    if (!window.confirm('Esto reorganizará las mesas del área actual. ¿Deseas continuar?')) {
      return;
    }

    const areaId = tableAreaId(areaTables[0] ?? {});

    if (!areaId) {
      setMessage('No se pudo identificar el area para ordenar mesas.');
      return;
    }

    setSavingSection('tables');

    try {
      const response = await adminFetch('tables/auto-arrange', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ areaId })
      });
      const updatedTables = await parseApiResponse<Array<Record<string, unknown>>>(response);
      const updatedById = new Map(updatedTables.map((table) => [String(table.id), table]));

      setResourceRows((current) => ({
        ...current,
        tables: (current.tables ?? []).map((table) => updatedById.get(String(table.id)) ?? table)
      }));
      await loadResource('tables', { silent: true });
      setMessage('Mesas ordenadas correctamente.');
    } catch {
      setMessage('No se pudieron ordenar las mesas.');
      await loadResource('tables', { silent: true });
    } finally {
      setSavingSection(null);
    }
  }

  async function deactivateEditingResource() {
    if (!editingResource || !accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    const config = resourceConfigs[editingResource.section];

    if (!config) {
      setMessage('Esta seccion no permite desactivacion directa.');
      return;
    }

    setSavingSection(editingResource.section);

    try {
      const response = await adminFetch(`${config.endpoint}/${String(editingResource.item.id)}`, {
        method: 'DELETE'
      });

      await parseApiResponse<Record<string, unknown>>(response);
      await loadResource(editingResource.section, { silent: true });
      setMessage(`${resourceSingularLabel(editingResource.section)} desactivado correctamente.`);
      setEditingResource(null);
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo desactivar. Revisa los datos e intenta nuevamente.');
    } finally {
      setSavingSection(null);
    }
  }

  async function deactivateResource(section: EditableResourceSection, item: Record<string, unknown>) {
    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    const config = resourceConfigs[section];

    if (!config) {
      setMessage('Esta seccion no permite desactivacion directa.');
      return;
    }

    const label = resourceSingularLabel(section).toLowerCase();
    const itemName = String(item.name ?? label);

    if (!window.confirm(`¿Deseas eliminar ${itemName}? Se desactivara sin borrar datos historicos.`)) {
      return;
    }

    setSavingSection(section);

    try {
      const response = await adminFetch(`${config.endpoint}/${String(item.id)}`, {
        method: 'DELETE'
      });

      const updated = await parseApiResponse<Record<string, unknown>>(response);
      setResourceRows((current) => ({
        ...current,
        [section]: (current[section] ?? []).map((row) => String(row.id) === String(item.id) ? updated : row)
      }));
      await loadResource(section, { silent: true });
      setMessage(`${resourceSingularLabel(section)} eliminado correctamente.`);

      if (editingResource?.section === section && String(editingResource.item.id) === String(item.id)) {
        setEditingResource(null);
      }
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : `No se pudo eliminar ${label}.`);
    } finally {
      setSavingSection(null);
    }
  }

  async function updateEditingItem(fields: Record<string, unknown>, successMessage: string) {
    if (!editingItem || !accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('items');

    try {
      const response = await adminFetch(`menu/items/${String(editingItem.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fields)
      });

      const updated = await parseApiResponse<Record<string, unknown>>(response);
      setEditingItem(updated);
      await loadResource('items', { silent: true });
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo actualizar el producto.');
    } finally {
      setSavingSection(null);
    }
  }

  async function saveRecipeLine(recipeId: string | null, body: Record<string, unknown>) {
    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('recipes');

    try {
      const response = await adminFetch(`inventory/recipes${recipeId ? `/${recipeId}` : ''}`, {
        method: recipeId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      await parseApiResponse<Record<string, unknown>>(response);
      await loadResource('recipes', { silent: true });
      setMessage(recipeId ? 'Receta actualizada correctamente.' : 'Ingrediente agregado a la receta.');
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo guardar. Revisa si el ingrediente ya existe en la receta.');
    } finally {
      setSavingSection(null);
    }
  }

  async function removeRecipeLine(recipeId: string) {
    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    if (!window.confirm('¿Deseas eliminar este ingrediente de la receta?')) {
      return;
    }

    setSavingSection('recipes');

    try {
      const response = await adminFetch(`inventory/recipes/${recipeId}`, {
        method: 'DELETE'
      });

      await parseApiResponse<Record<string, unknown>>(response);
      await loadResource('recipes', { silent: true });
      setMessage('Ingrediente eliminado de la receta.');
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo eliminar el ingrediente.');
    } finally {
      setSavingSection(null);
    }
  }

  async function deactivateEditingItem() {
    if (!editingItem || !accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('items');

    try {
      const response = await adminFetch(`menu/items/${String(editingItem.id)}`, {
        method: 'DELETE'
      });

      await parseApiResponse<Record<string, unknown>>(response);
      setEditingItem(null);
      await loadResource('items', { silent: true });
      setMessage('Producto desactivado correctamente.');
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo desactivar el producto.');
    } finally {
      setSavingSection(null);
    }
  }

  function downloadMenuPdf() {
    const items = (resourceRows.items ?? []).filter((item) => {
      const active = item.isActive !== false;
      const visible = item.showInPublicMenu !== false;
      const available = item.isAvailable !== false;

      return active && visible && (showSoldOutInMenuPdf || available);
    });

    const categoriesById = new Map((resourceRows.categories ?? []).map((category) => [String(category.id), String(category.name ?? 'Sin categoria')]));
    const grouped = items.reduce<Record<string, Array<Record<string, unknown>>>>((groups, item) => {
      const categoryId = String(item.categoryId ?? (item.category as Record<string, unknown> | undefined)?.id ?? '');
      const categoryName = String((item.category as Record<string, unknown> | undefined)?.name ?? categoriesById.get(categoryId) ?? 'Menu');

      return {
        ...groups,
        [categoryName]: [...(groups[categoryName] ?? []), item]
      };
    }, {});

    const documentHtml = buildMenuDocumentHtml(grouped, showSoldOutInMenuPdf, draftTheme);
    const popup = window.open('', '_blank', 'width=900,height=1200');

    if (!popup) {
      setMessage('No se pudo abrir la carta. Revisa si el navegador bloqueo la ventana.');
      return;
    }

    popup.document.write(documentHtml);
    popup.document.close();
    popup.focus();
    popup.print();
    setMessage('Carta generada. En la ventana de impresion elige Guardar como PDF.');
  }

  async function submitGeneralSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const settings = settingDefinitions.map((definition) => ({
      key: definition.key,
      label: definition.label,
      value: definition.type === 'checkbox' ? String(form.get(definition.key) === 'on') : String(form.get(definition.key) ?? definition.defaultValue),
      description: definition.description,
      group: definition.group.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '_'),
      isActive: true
    }));

    setSavingSection('settings');

    try {
      const response = await adminFetch('admin/settings/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });

      const rows = await parseApiResponse<Array<Record<string, unknown>>>(response);
      setResourceRows((current) => ({ ...current, settings: rows }));
      setMessage('Configuracion general guardada correctamente.');
    } catch {
      setMessage('No se pudo guardar la configuracion general.');
    } finally {
      setSavingSection(null);
    }
  }

  async function submitTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hexFields.every((field) => isHexColor(draftTheme[field.key]))) {
      setMessage('Error: todos los colores deben ser HEX validos, por ejemplo #0f766e.');
      return;
    }

    if (!hasReadableContrast(draftTheme.backgroundColor, draftTheme.textColor) || !hasReadableContrast(draftTheme.cardColor, draftTheme.textColor)) {
      setMessage('Error: el texto no tiene suficiente contraste con fondo o tarjetas.');
      return;
    }

    try {
      await saveTheme();
      setMessage('Exito: tema visual guardado y aplicado.');
    } catch (error) {
      setMessage(error instanceof Error ? `Error: ${error.message}` : 'Error: no se pudo guardar el tema.');
    }
  }

  async function restoreTheme() {
    await restoreDefault();
    setMessage('Tema por defecto restaurado en la vista.');
  }

  async function submitEmployeeAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingSection === 'employees') {
      return;
    }

    const form = new FormData(event.currentTarget);
    const firstName = String(form.get('firstName') ?? '').trim();
    const lastName = String(form.get('lastName') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '').trim();
    const role = String(form.get('role') ?? 'WAITER') as AdminRole;
    const employeeCode = String(form.get('employeeCode') ?? '').trim();
    const documentId = String(form.get('documentId') ?? '').trim();
    const position = String(form.get('position') ?? '').trim();

    if (!firstName || !lastName || !email || !employeeCode || (!editingEmployee && password.length < 8)) {
      setMessage('Error: completa nombre, correo, codigo de empleado y contrasena de minimo 8 caracteres.');
      return;
    }

    if (password && !isStrongTemporaryPassword(password)) {
      setMessage('Error: la contrasena debe tener mayuscula, minuscula, numero y simbolo. Ejemplo: Mesero123!');
      return;
    }

    try {
      if (!accessToken) {
        throw new Error('Estas en modo demo. Inicia sesion con el backend real para guardar en PostgreSQL.');
      }

      setSavingSection('employees');
      if (editingEmployee) {
        const userResponse = await adminFetch(`admin/users/${editingEmployee.user.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password: password || undefined,
            firstName,
            lastName,
            role
          })
        });

        await parseApiResponse<{ id: string }>(userResponse);
        const employeeResponse = await adminFetch(`admin/employees/${editingEmployee.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            employeeCode,
            documentId: documentId || undefined,
            position: position || role
          })
        });

        await parseApiResponse<{ id: string }>(employeeResponse);
        await loadPeople();
        setEditingEmployee(null);
        setMessage('Empleado actualizado correctamente.');
        setEmployeeFormVersion((current) => current + 1);
        return;
      }

      const userResponse = await adminFetch('admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          role
        })
      });

      const createdUser = await parseApiResponse<{ id: string }>(userResponse);
      const employeeResponse = await adminFetch('admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: createdUser.id,
          employeeCode,
          documentId: documentId || undefined,
          position: position || role
        })
      });

      await parseApiResponse<{ id: string }>(employeeResponse);
      await loadPeople();
      setMessage('Empleado creado correctamente.');
      setEmployeeFormVersion((current) => current + 1);
    } catch (error) {
      setMessage(error instanceof Error ? `Error: ${error.message}` : 'No se pudo guardar. Revisa los datos e intenta nuevamente.');
    } finally {
      setSavingSection(null);
    }
  }

  async function deactivateEditingEmployee() {
    if (!editingEmployee || !accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('employees');

    try {
      const response = await adminFetch(`admin/employees/${editingEmployee.id}`, {
        method: 'DELETE'
      });

      await parseApiResponse<ApiEmployee>(response);
      await loadPeople();
      setEditingEmployee(null);
      setMessage('Empleado desactivado correctamente.');
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo desactivar el empleado.');
    } finally {
      setSavingSection(null);
    }
  }

  async function loadPeople() {
    if (!accessToken) {
      return;
    }

    const [usersResponse, employeesResponse] = await Promise.all([
      adminFetch('admin/users'),
      adminFetch('admin/employees')
    ]);

    setAdminUsers(await parseApiResponse<ApiUser[]>(usersResponse));
    setAdminEmployees(await parseApiResponse<ApiEmployee[]>(employeesResponse));
  }

  async function loadDashboardData() {
    try {
      await Promise.all([
        loadPeople(),
        loadResourceDependency('tables', 'tables'),
        loadResourceDependency('items', 'menu/items'),
        loadResourceDependency('inventory', 'inventory/ingredients'),
        loadReports()
      ]);
    } catch {
      setMessage('Error de conexion con el servidor.');
    }
  }

  async function loadResource(section: SectionKey, options?: { silent?: boolean }) {
    const config = resourceConfigs[section];

    if (!config || !accessToken) {
      return;
    }

    try {
      const response = await adminFetch(config.listEndpoint ?? config.endpoint);
      const rows = await parseApiResponse<Array<Record<string, unknown>>>(response);
      setResourceRows((current) => ({ ...current, [section]: rows }));

      if (section === 'items' || section === 'recipes' || section === 'modifiers') {
        await loadResourceDependency('categories', 'menu/categories');
      }

      if (section === 'tables') {
        await loadResourceDependency('areas', 'dining-areas');
      }

      if (section === 'recipes' || section === 'modifiers') {
        await loadResourceDependency('items', 'menu/items');
      }

      if (section === 'recipes') {
        await loadResourceDependency('inventory', 'inventory/ingredients');
      }

      if (section === 'inventory' || section === 'purchases' || section === 'counts') {
        await loadResourceDependency('inventory', 'inventory/ingredients');
        await loadResourceDependency('recipes', 'inventory/recipes');
        await loadInventoryOperations();
      }
    } catch {
      if (!options?.silent) {
        setMessage('Error de conexion con el servidor.');
      }
    }
  }

  async function loadResourceDependency(section: SectionKey, endpoint: string) {
    if (!accessToken) {
      return;
    }

    const response = await adminFetch(endpoint);
    const rows = await parseApiResponse<Array<Record<string, unknown>>>(response);
    setResourceRows((current) => ({ ...current, [section]: rows }));
  }

  async function loadInventoryMovements() {
    if (!accessToken) {
      return;
    }

    const response = await adminFetch('inventory/movements');
    const rows = await parseApiResponse<Array<Record<string, unknown>>>(response);
    setInventoryMovements(rows);
  }

  async function loadInventoryOperations() {
    if (!accessToken) {
      return;
    }

    const [movementsResponse, suppliersResponse, purchasesResponse, countsResponse] = await Promise.all([
      adminFetch('inventory/movements'),
      adminFetch('inventory/suppliers'),
      adminFetch('inventory/purchases'),
      adminFetch('inventory/counts')
    ]);

    setInventoryMovements(await parseApiResponse<Array<Record<string, unknown>>>(movementsResponse));
    setInventorySuppliers(await parseApiResponse<Array<Record<string, unknown>>>(suppliersResponse));
    setInventoryPurchases(await parseApiResponse<Array<Record<string, unknown>>>(purchasesResponse));
    setInventoryCounts(await parseApiResponse<Array<Record<string, unknown>>>(countsResponse));
  }

  async function submitSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();

    if (!name) {
      setMessage('Error: el nombre del proveedor es obligatorio.');
      return;
    }

    setSavingSection('inventory');

    try {
      const response = await adminFetch('inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          taxId: String(form.get('taxId') ?? '').trim() || undefined,
          phone: String(form.get('phone') ?? '').trim() || undefined,
          email: String(form.get('email') ?? '').trim() || undefined,
          address: String(form.get('address') ?? '').trim() || undefined,
          notes: String(form.get('notes') ?? '').trim() || undefined
        })
      });

      await parseApiResponse<Record<string, unknown>>(response);
      await loadInventoryOperations();
      setMessage('Proveedor creado correctamente.');
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo crear el proveedor.');
    } finally {
      setSavingSection(null);
    }
  }

  async function submitInventoryPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const ingredientId = String(form.get('ingredientId') ?? '');
    const quantity = Number(form.get('quantity') ?? 0);
    const unitCost = Number(form.get('unitCost') ?? 0);
    const ingredient = (resourceRows.inventory ?? []).find((item) => String(item.id) === ingredientId);

    if (!ingredientId || quantity <= 0 || unitCost < 0) {
      setMessage('Error: selecciona ingrediente, cantidad y costo.');
      return;
    }

    setSavingSection('inventory');

    try {
      const response = await adminFetch('inventory/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: String(form.get('supplierId') ?? '') || undefined,
          invoiceNumber: String(form.get('invoiceNumber') ?? '').trim() || undefined,
          notes: String(form.get('notes') ?? '').trim() || undefined,
          items: [{
            ingredientId,
            quantity,
            unit: String(ingredient?.unit ?? form.get('unit') ?? 'unidad'),
            unitCost
          }]
        })
      });

      await parseApiResponse<Record<string, unknown>>(response);
      await Promise.all([
        loadResourceDependency('inventory', 'inventory/ingredients'),
        loadResourceDependency('purchases', 'inventory/purchases'),
        loadInventoryOperations()
      ]);
      setMessage('Compra registrada y stock actualizado.');
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo registrar la compra.');
    } finally {
      setSavingSection(null);
    }
  }

  async function saveInventoryMovement(body: Record<string, unknown>, successMessage: string) {
    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('inventory');

    try {
      const response = await adminFetch('inventory/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      await parseApiResponse<Record<string, unknown>>(response);
      await loadResource('inventory', { silent: true });
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo registrar el movimiento de inventario.');
    } finally {
      setSavingSection(null);
    }
  }

  function submitInventoryMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ingredientId = String(form.get('ingredientId') ?? '');
    const type = String(form.get('type') ?? '');
    const quantity = Number(form.get('quantity') ?? 0);
    const unitCost = Number(form.get('unitCost') ?? 0);
    const reason = String(form.get('reason') ?? '').trim();

    if (!ingredientId || !type || quantity <= 0) {
      setMessage('Error: selecciona ingrediente, tipo y cantidad mayor a cero.');
      return;
    }

    void saveInventoryMovement({
      ingredientId,
      type,
      quantity,
      unitCost: unitCost > 0 ? unitCost : undefined,
      reason: reason || undefined,
      reference: `manual-${Date.now()}`
    }, inventoryMovementSuccessMessage(type));

    event.currentTarget.reset();
  }

  function submitPhysicalCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ingredientId = String(form.get('ingredientId') ?? '');
    const countedStock = Number(form.get('countedStock') ?? 0);
    const period = String(form.get('period') ?? 'Diario');
    const ingredient = (resourceRows.inventory ?? []).find((item) => String(item.id) === ingredientId);
    const currentStock = Number(ingredient?.currentStock ?? 0);
    const difference = countedStock - currentStock;

    if (!ingredientId || countedStock < 0) {
      setMessage('Error: selecciona ingrediente y cantidad contada valida.');
      return;
    }

    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    setSavingSection('inventory');

    void adminFetch('inventory/counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period,
        notes: String(form.get('notes') ?? '').trim() || undefined,
        items: [{ ingredientId, countedStock }]
      })
    })
      .then((response) => parseApiResponse<Record<string, unknown>>(response))
      .then(async () => {
        await Promise.all([
          loadResourceDependency('inventory', 'inventory/ingredients'),
          loadResourceDependency('counts', 'inventory/counts'),
          loadInventoryOperations()
        ]);
        setMessage(difference < 0 ? 'Conteo aplicado: hay faltante.' : difference > 0 ? 'Conteo aplicado: hay sobrante.' : 'Conteo aplicado: stock normal.');
        event.currentTarget.reset();
      })
      .catch((error) => {
        setMessage(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'No se pudo aplicar el conteo fisico.');
      })
      .finally(() => setSavingSection(null));
  }

  async function loadReports() {
    if (!accessToken) {
      setMessage('Error de conexion con el servidor.');
      return;
    }

    const params = new URLSearchParams();
    if (reportStartDate) params.set('startDate', reportStartDate);
    if (reportEndDate) params.set('endDate', reportEndDate);
    if (reportType && reportType !== 'Todos') params.set('reportType', reportType);
    if (reportEmployee) params.set('waiterId', reportEmployee);
    if (reportTable) params.set('tableId', reportTable);
    if (reportPaymentMethod) params.set('paymentMethod', reportPaymentMethod);
    if (reportCategory) params.set('categoryId', reportCategory);

    try {
      const response = await adminFetch(`reports?${params.toString()}`);
      setReportsData(await parseApiResponse<ReportsResponse>(response));
      setMessage('Reportes cargados con datos reales.');
    } catch {
      setMessage('Error de conexion con el servidor.');
    }
  }

  function exportReportsCsv() {
    const headers = ['id', 'fecha', 'tipo', 'empleado', 'mesa', 'metodo_pago', 'categoria', 'concepto', 'cantidad', 'valor'];
    const lines = filteredReports.map((row) => [
      row.id,
      row.date,
      row.type,
      row.employee,
      row.table,
      row.paymentMethod ?? '',
      row.category,
      row.concept,
      String(row.quantity),
      String(row.amount)
    ]);
    const csv = [headers, ...lines].map((line) => line.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reportes-${reportStartDate}-${reportEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Exito: reporte CSV exportado.');
  }

  function printReports() {
    const popup = window.open('', '_blank', 'width=1100,height=900');

    if (!popup) {
      setMessage('Error: no se pudo abrir la ventana de impresion.');
      return;
    }

    popup.document.write(buildReportsPrintHtml({
      rows: filteredReports,
      summary: reportSummary,
      theme: draftTheme,
      generatedAt: reportsData?.generatedAt ?? new Date().toISOString(),
      generatedBy: reportsData?.generatedBy ?? user?.email ?? 'Usuario',
      filters: {
        desde: reportStartDate,
        hasta: reportEndDate,
        reporte: reportType,
        mesero: reportOptions.waiters.find((item) => item.id === reportEmployee)?.name ?? 'Todos',
        mesa: reportOptions.tables.find((item) => item.id === reportTable)?.name ?? 'Todas',
        metodo: reportPaymentMethod || 'Todos',
        categoria: reportOptions.categories.find((item) => item.id === reportCategory)?.name ?? 'Todas'
      }
    }));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <AuthGate allowedRoles={allowedRoles}>
      <main className="admin-shell">
      <button
        aria-expanded={isMobileMenuOpen}
        aria-label="Abrir menu administrativo"
        className="admin-menu-toggle"
        type="button"
        onClick={() => setIsMobileMenuOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      {isMobileMenuOpen && <button aria-label="Cerrar menu" className="admin-menu-backdrop" type="button" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={isMobileMenuOpen ? 'admin-sidebar open' : 'admin-sidebar'}>
        <div className="admin-brand">
          <strong>POS Restaurante</strong>
          <span>{currentRole}</span>
        </div>
        <nav>
          <button type="button" onClick={() => window.location.assign('/mesero/pedidos')}>
            <span className="nav-icon plate-icon" aria-hidden="true" />
            <span>Pedidos</span>
          </button>
          {navItems.map((item) => (
            <button className={item.key === activeSection ? 'active' : ''} key={item.key} type="button" onClick={() => selectSection(item.key)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <nav className="breadcrumb" aria-label="Ruta">
              <button type="button" onClick={goBackToDashboard}>Dashboard</button>
              {activeSection !== 'dashboard' && (
                <>
                  <span>/</span>
                  <strong>{currentSection?.label}</strong>
                </>
              )}
            </nav>
            <p className="eyebrow">{activeSection === 'theme' ? 'Fase 11' : 'Fase 10'}</p>
            <h1>{activeSection === 'dashboard' ? 'Panel administrativo' : currentSection?.label}</h1>
            <span className="screen-action">{sectionActions[activeSection]}</span>
          </div>
          <button className="secondary-action" type="button" onClick={() => void signOut()}>
            Salir / cambiar usuario
          </button>
          {activeSection !== 'dashboard' && (
            <button className="back-button" type="button" onClick={goBackToDashboard}>
              ← Volver al dashboard
            </button>
          )}
        </header>
        {visibleMessage && (
          <div className={isErrorMessage(visibleMessage) ? 'app-toast error' : 'app-toast'} role="status">
            <span>{visibleMessage}</span>
            <button aria-label="Cerrar notificacion" type="button" onClick={() => setMessage('')}>X</button>
          </div>
        )}

        {activeSection === 'dashboard' ? (
          <section className="admin-dashboard">
            <div className="admin-metrics">
              {dashboardMetrics.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <em>{metric.helper}</em>
                </article>
              ))}
            </div>

            <section className="admin-grid">
              <article className="admin-panel">
                <div className="section-title">
                  <h2>Platos mas vendidos</h2>
                  <span>Hoy</span>
                </div>
                <div className="admin-list">
                  {topSoldProducts.map((dish) => (
                    <div key={dish.name}>
                      <strong>{dish.name}</strong>
                      <span>{dish.quantity} vendidos</span>
                    </div>
                  ))}
                  {topSoldProducts.length === 0 && <div className="empty-state compact">Sin ventas registradas en el rango actual.</div>}
                </div>
              </article>

              <article className="admin-panel">
                <div className="section-title">
                  <h2>Alertas de inventario bajo</h2>
                  <span>{lowStockRows.length}</span>
                </div>
                <div className="admin-list">
                  {lowStockRows.map((item) => (
                    <div key={String(item.id)}>
                      <strong>{String(item.name ?? 'Ingrediente')}</strong>
                      <span>{String(item.currentStock ?? 0)} {String(item.unit ?? '')} / minimo {String(item.minimumStock ?? 0)}</span>
                    </div>
                  ))}
                  {lowStockRows.length === 0 && <div className="empty-state compact">No hay ingredientes bajo el minimo.</div>}
                </div>
              </article>

              <article className="admin-panel quick-panel">
                <div className="section-title">
                  <h2>Accesos rapidos</h2>
                  <span>Operaciones</span>
                </div>
                <div className="quick-actions">
                  {quickAccess.map((action) => (
                    <button key={action.label} type="button" onClick={() => selectSection(action.target)}>
                      <strong>{action.label}</strong>
                      <span>{action.helper}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="admin-panel">
                <div className="section-title">
                  <h2>Resumen operativo</h2>
                  <span>En vivo</span>
                </div>
                <div className="admin-bars">
                  <div><span>Ocupacion mesas</span><strong>{tableRows.length ? Math.round((occupiedTables / tableRows.length) * 100) : 0}%</strong></div>
                  <div><span>Ordenes pagadas</span><strong>{openOrders}</strong></div>
                  <div><span>Ticket promedio</span><strong>{formatCurrency(openOrders ? reportSummary.salesTotal / openOrders : 0)}</strong></div>
                </div>
              </article>
            </section>
          </section>
        ) : activeSection === 'reports' ? (
          <section className="reports-section">
            <div className="admin-panel reports-toolbar">
              <div className="section-title">
                <div>
                  <h2>Reportes administrativos</h2>
                  <span>Ventas, inventario, descuentos, cancelaciones y caja.</span>
                </div>
                <span>{filteredReports.length} registros</span>
              </div>

              <div className="reports-filters">
                <label>
                  Desde
                  <input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} />
                </label>
                <label>
                  Hasta
                  <input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} />
                </label>
                <label>
                  Reporte
                  <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
                    {reportOptions.reportTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  Mesero
                  <select value={reportEmployee} onChange={(event) => setReportEmployee(event.target.value)}>
                    <option value="">Todos</option>
                    {reportOptions.waiters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  Mesa
                  <select value={reportTable} onChange={(event) => setReportTable(event.target.value)}>
                    <option value="">Todas</option>
                    {reportOptions.tables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  Metodo pago
                  <select value={reportPaymentMethod} onChange={(event) => setReportPaymentMethod(event.target.value)}>
                    <option value="">Todos</option>
                    {reportOptions.paymentMethods.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  Categoria
                  <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}>
                    <option value="">Todas</option>
                    {reportOptions.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="reports-actions">
                <button type="button" onClick={loadReports}>Actualizar</button>
                <button type="button" onClick={exportReportsCsv}>Exportar CSV</button>
                <button type="button" onClick={printReports}>PDF / Imprimir</button>
              </div>
            </div>

            <div className="reports-summary">
              <article>
                <span>Ventas filtradas</span>
                <strong>{formatCurrency(reportSummary.salesTotal)}</strong>
              </article>
              <article>
                <span>Descuentos</span>
                <strong>{formatCurrency(reportSummary.discountsTotal)}</strong>
              </article>
              <article>
                <span>Cancelaciones</span>
                <strong>{formatCurrency(reportSummary.cancellationsTotal)}</strong>
              </article>
              <article>
                <span>Cierres de caja</span>
                <strong>{formatCurrency(reportSummary.cashClosings)}</strong>
              </article>
            </div>

            <div className="admin-panel reports-table">
              <div className="reports-table-head">
                <span>Fecha</span>
                <span>Tipo</span>
                <span>Empleado</span>
                <span>Mesa/Caja</span>
                <span>Metodo</span>
                <span>Categoria</span>
                <span>Concepto</span>
                <span>Cant.</span>
                <span>Valor</span>
              </div>
              {filteredReports.map((row) => (
                <div className="reports-table-row" key={row.id}>
                  <span>{row.date}</span>
                  <strong>{row.type}</strong>
                  <span>{row.employee}</span>
                  <span>{row.table}</span>
                  <span>{row.paymentMethod ?? '-'}</span>
                  <span>{row.category}</span>
                  <span>{row.concept}</span>
                  <span>{row.quantity}</span>
                  <em>{formatCurrency(row.amount)}</em>
                </div>
              ))}
            </div>
          </section>
        ) : activeSection === 'settings' ? (
          <GeneralSettingsPanel
            definitions={settingDefinitions}
            isSaving={savingSection === 'settings'}
            onSubmit={submitGeneralSettings}
            settings={resourceRows.settings ?? []}
          />
        ) : activeSection === 'theme' ? (
          <section className="theme-editor">
            <form className="admin-panel theme-form" onSubmit={submitTheme}>
              <div className="section-title">
                <div>
                  <h2>Editor visual</h2>
                  <span>Colores, logo, bordes y fuente del POS/PWA.</span>
                </div>
                <span>Preview en vivo</span>
              </div>

              <label>
                Restaurante
                <input value={draftTheme.restaurantName} onChange={(event) => updateDraft({ restaurantName: event.target.value })} />
              </label>

              <label>
                Logo URL
                <input value={draftTheme.logoUrl ?? ''} onChange={(event) => updateDraft({ logoUrl: event.target.value || null })} placeholder="https://..." />
              </label>

              <div className="theme-color-grid">
                {hexFields.map((field) => (
                  <label key={field.key}>
                    {field.label}
                    <span>
                      <input type="color" value={draftTheme[field.key]} onChange={(event) => updateDraft({ [field.key]: event.target.value })} />
                      <input value={draftTheme[field.key]} onChange={(event) => updateDraft({ [field.key]: event.target.value })} pattern="^#[0-9A-Fa-f]{6}$" />
                    </span>
                  </label>
                ))}
              </div>

              <label>
                Radio de borde
                <select value={draftTheme.borderRadius} onChange={(event) => updateDraft({ borderRadius: event.target.value })}>
                  <option value="4px">4px</option>
                  <option value="8px">8px</option>
                  <option value="12px">12px</option>
                </select>
              </label>

              <label>
                Fuente
                <select value={draftTheme.fontFamily} onChange={(event) => updateDraft({ fontFamily: event.target.value })}>
                  <option value="Inter, system-ui, sans-serif">Inter</option>
                  <option value="Arial, system-ui, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                </select>
              </label>

              <label className="theme-toggle">
                <input type="checkbox" checked={draftTheme.darkModeEnabled} onChange={(event) => updateDraft({ darkModeEnabled: event.target.checked })} />
                Modo oscuro
              </label>

              <div className="theme-actions">
                <Button>Guardar tema</Button>
                <button type="button" onClick={restoreTheme}>Restaurar defecto</button>
              </div>
            </form>

            <article className="theme-preview" style={{
              background: draftTheme.backgroundColor,
              color: draftTheme.textColor,
              borderRadius: draftTheme.borderRadius,
              fontFamily: draftTheme.fontFamily
            }}>
              <div className="theme-preview-card" style={{ background: draftTheme.cardColor, borderRadius: draftTheme.borderRadius }}>
                <div
                  className="theme-logo"
                  style={{
                    background: draftTheme.logoUrl ? `${draftTheme.primaryColor} url("${draftTheme.logoUrl}") center / cover` : draftTheme.primaryColor
                  }}
                >
                  {draftTheme.logoUrl ? '' : draftTheme.restaurantName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span>Vista POS</span>
                  <h2>{draftTheme.restaurantName}</h2>
                </div>
              </div>

              <div className="theme-preview-grid">
                <div className="theme-preview-card" style={{ background: draftTheme.cardColor, borderRadius: draftTheme.borderRadius }}>
                  <span>Mesa 04</span>
                  <strong>Ocupada</strong>
                  <span className="theme-preview-action" style={{ background: draftTheme.buttonColor, borderRadius: draftTheme.borderRadius }}>
                    Abrir orden
                  </span>
                </div>
                <div className="theme-preview-card" style={{ background: draftTheme.cardColor, borderRadius: draftTheme.borderRadius }}>
                  <span>Cocina</span>
                  <strong style={{ color: draftTheme.secondaryColor }}>Listo</strong>
                  <p>2 hamburguesas, sin cebolla.</p>
                </div>
              </div>

              <div className="theme-contrast">
                <span>Contraste fondo/texto: {contrastRatio(draftTheme.backgroundColor, draftTheme.textColor).toFixed(1)}</span>
                <span>Contraste tarjeta/texto: {contrastRatio(draftTheme.cardColor, draftTheme.textColor).toFixed(1)}</span>
              </div>
            </article>
          </section>
        ) : (
          <section className={activeSection === 'inventory' ? 'admin-section inventory-full-section' : 'admin-section'}>
            <div className="admin-panel">
              <div className="section-title">
                <div>
                  <h2>{currentSection?.label}</h2>
                  <span>{currentSection?.description}</span>
                </div>
                <span>{visibleRows.length} registros</span>
              </div>

              {activeSection !== 'inventory' && (
                <div className="admin-toolbar">
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, estado o detalle" />
                  <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    {(currentSection?.filters ?? ['Todos']).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeSection === 'tables' && (
                <>
                  <TableAssignmentPanel
                    areas={resourceRows.areas ?? []}
                    bulkWaiterId={bulkAssignmentWaiterId}
                    isSaving={savingSection === 'tables'}
                    onAssign={assignTableWaiter}
                    onAreaFilterChange={setTableAreaFilter}
                    onBulkAssign={assignSelectedTables}
                    onBulkWaiterChange={setBulkAssignmentWaiterId}
                    onSelectionChange={setSelectedAssignmentTableIds}
                    onWaiterFilterChange={setTableWaiterFilter}
                    selectedAreaId={tableAreaFilter}
                    selectedTableIds={selectedAssignmentTableIds}
                    selectedWaiterId={tableWaiterFilter}
                    tables={filteredTableRows}
                    waiterCounts={waiterAssignmentCounts}
                    waiters={waiterEmployees}
                  />
                  <AdminTablesMap
                    isSaving={savingSection === 'tables'}
                    onAutoArrange={autoArrangeAdminTables}
                    onMove={moveAdminTable}
                    onSelect={setEditingTable}
                    rows={filteredTableRows}
                    selectedId={String(editingTable?.id ?? '')}
                  />
                </>
              )}

              {activeSection === 'recipes' && (
                <RecipeEditor
                  ingredients={resourceRows.inventory ?? []}
                  menuItems={resourceRows.items ?? []}
                  onCreateIngredient={() => selectSection('inventory')}
                  onFeedback={setMessage}
                  onRemove={removeRecipeLine}
                  onSave={saveRecipeLine}
                  recipes={resourceRows.recipes ?? []}
                  selectedMenuItemId={selectedRecipeMenuItemId}
                  setSelectedMenuItemId={setSelectedRecipeMenuItemId}
                />
              )}

              {activeSection === 'inventory' && (
                <InventoryOperationsPanel
                  ingredients={resourceRows.inventory ?? []}
                  isSaving={savingSection === 'inventory'}
                  onCountSubmit={submitPhysicalCount}
                  onRefresh={loadInventoryOperations}
                  recipes={resourceRows.recipes ?? []}
                />
              )}

              {activeSection === 'purchases' && (
                <InventoryPurchasePanel
                  ingredients={resourceRows.inventory ?? []}
                  isSaving={savingSection === 'inventory' || savingSection === 'purchases'}
                  onSubmit={submitInventoryPurchase}
                  suppliers={inventorySuppliers}
                />
              )}

              {activeSection === 'counts' && (
                <InventoryCountPanel
                  ingredients={resourceRows.inventory ?? []}
                  isSaving={savingSection === 'inventory' || savingSection === 'counts'}
                  onSubmit={submitPhysicalCount}
                />
              )}

              {activeSection !== 'inventory' && (
                <div className="admin-table">
                  <div className="admin-table-head">
                    <span>Codigo</span>
                    <span>Nombre</span>
                    <span>Estado</span>
                    <span>Detalle</span>
                    <span>Metrica</span>
                  </div>
                  {visibleRows.map((row) => (
                    <div className="admin-table-row" key={row.id}>
                      <span>{row.displayId ?? shortRecordCode('REG', row.id)}</span>
                      <strong>{row.name}</strong>
                      <em>{row.status}</em>
                      <span>{row.detail}</span>
                      <span>{row.metric}</span>
                      {activeSection === 'employees' && (
                        <div className="row-actions">
                          <button
                            className="row-action"
                            type="button"
                            onClick={() => {
                              const employee = adminEmployees.find((item) => item.id === row.id);
                              setEditingEmployee(employee ?? null);
                            }}
                          >
                            Editar
                          </button>
                        </div>
                      )}
                      {activeSection === 'items' && (
                        <div className="row-actions">
                          <button
                            className="row-action"
                            type="button"
                            onClick={() => {
                              const item = (resourceRows.items ?? []).find((resourceItem) => String(resourceItem.id) === row.id);
                              setEditingItem(item ?? null);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="row-action"
                            type="button"
                            onClick={() => {
                              selectSection('recipes');
                              setSelectedRecipeMenuItemId(row.id);
                            }}
                          >
                            Editar receta
                          </button>
                        </div>
                      )}
                      {activeSection === 'recipes' && (
                        <div className="row-actions">
                          <button
                            className="row-action"
                            type="button"
                            onClick={() => {
                              const recipe = (resourceRows.recipes ?? []).find((resourceItem) => String(resourceItem.id) === row.id);

                              if (recipe) {
                                setSelectedRecipeMenuItemId(String(recipe.menuItemId ?? ''));
                              }
                            }}
                          >
                            Ver plato
                          </button>
                          <button
                            className="row-action danger-row-action"
                            disabled={savingSection === 'recipes' || row.status === 'Inactiva'}
                            type="button"
                            onClick={() => {
                              void removeRecipeLine(row.id);
                            }}
                          >
                            {row.status === 'Inactiva' ? 'Eliminada' : 'Eliminar'}
                          </button>
                        </div>
                      )}
                      {isEditableResourceSection(activeSection) && (
                        <div className="row-actions">
                          <button
                            className="row-action"
                            type="button"
                            onClick={() => {
                              const item = (resourceRows[activeSection] ?? []).find((resourceItem) => String(resourceItem.id) === row.id);
                              setEditingResource(item ? { section: activeSection, item } : null);
                            }}
                          >
                            Editar
                          </button>
                          {activeSection === 'categories' && (
                            <button
                              className="row-action danger-row-action"
                              disabled={savingSection === 'categories' || row.status === 'Inactiva'}
                              type="button"
                              onClick={() => {
                                const item = (resourceRows.categories ?? []).find((resourceItem) => String(resourceItem.id) === row.id);

                                if (item) {
                                  void deactivateResource('categories', item);
                                }
                              }}
                            >
                              {row.status === 'Inactiva' ? 'Eliminada' : 'Eliminar'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeSection === 'employees' ? (
              <form className="admin-panel admin-form" key={`${editingEmployee?.id ?? 'new-employee'}-${employeeFormVersion}`} onSubmit={submitEmployeeAccess}>
                <div className="section-title">
                  <h2>{editingEmployee ? 'Editar empleado' : 'Crear empleado'}</h2>
                  <span>{editingEmployee ? 'Actualizar usuario, rol y datos laborales' : 'Usuario, contrasena y datos laborales'}</span>
                </div>
                <input name="firstName" placeholder="Nombre" defaultValue={editingEmployee?.user.firstName ?? ''} />
                <input name="lastName" placeholder="Apellido" defaultValue={editingEmployee?.user.lastName ?? ''} />
                <input name="email" type="email" placeholder="correo@restaurante.com" defaultValue={editingEmployee?.user.email ?? ''} />
                <input name="password" type="password" placeholder={editingEmployee ? 'Nueva contrasena opcional' : 'Contrasena temporal'} />
                <input name="employeeCode" placeholder="Codigo empleado, ej: EMP-004" defaultValue={editingEmployee?.employeeCode ?? ''} />
                <input name="documentId" placeholder="Documento opcional" defaultValue={editingEmployee?.documentId ?? ''} />
                <input name="position" placeholder="Cargo, ej: Mesero" defaultValue={editingEmployee?.position ?? ''} />
                <select name="role" defaultValue={editingEmployee?.user.role.key ?? 'WAITER'}>
                  <option value="WAITER">Mesero</option>
                  <option value="KITCHEN">Cocina</option>
                  <option value="CASHIER">Caja</option>
                  <option value="INVENTORY">Inventario</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <Button disabled={savingSection === 'employees'}>
                  {savingSection === 'employees' ? 'Guardando...' : editingEmployee ? 'Guardar cambios' : 'Crear empleado'}
                </Button>
                {editingEmployee && (
                  <>
                    <button className="secondary-action" type="button" onClick={() => setEditingEmployee(null)}>
                      Crear empleado nuevo
                    </button>
                    <button className="danger-action" type="button" onClick={deactivateEditingEmployee}>
                      Desactivar empleado
                    </button>
                  </>
                )}
                <span className="form-helper">
                  Guarda usuario y empleado en PostgreSQL usando el backend real.
                  {adminUsers.length > 0 ? ` Usuarios cargados: ${adminUsers.length}.` : ''}
                </span>
              </form>
            ) : (
              activeSection === 'inventory' ? null : activeSection === 'recipes' ? (
                <div className="admin-panel admin-form">
                  <div className="section-title">
                    <h2>Crear receta</h2>
                    <span>Usa los desplegables de Categoria y Plato del editor para agregar o eliminar ingredientes.</span>
                  </div>
                  <button className="secondary-action" type="button" onClick={() => selectSection('items')}>
                    Crear plato
                  </button>
                  <button className="secondary-action" type="button" onClick={() => selectSection('inventory')}>
                    Crear ingrediente
                  </button>
                </div>
              ) : activeSection === 'purchases' || activeSection === 'counts' ? (
                <div className="admin-panel admin-form">
                  <div className="section-title">
                    <h2>{activeSection === 'purchases' ? 'Compras de inventario' : 'Conteos fisicos'}</h2>
                    <span>
                      {activeSection === 'purchases'
                        ? 'Registra la entrada desde el panel principal y revisa el historial en la lista.'
                        : 'Registra el conteo fisico y revisa faltantes, normales o sobrantes.'}
                    </span>
                  </div>
                  <button className="secondary-action" type="button" onClick={() => selectSection('inventory')}>
                    Ver inventario general
                  </button>
                  <button className="secondary-action" type="button" onClick={() => selectSection('suppliers')}>
                    Gestionar proveedores
                  </button>
                </div>
              ) : resourceConfigs[activeSection] ? (
                <form
                  className="admin-panel admin-form"
                  key={
                    activeSection === 'tables'
                      ? String(editingTable?.id ?? 'new-table')
                      : activeSection === 'items'
                        ? String(editingItem?.id ?? 'new-item')
                        : activeEditingResource
                          ? `${activeSection}-${String(activeEditingResource.id)}`
                          : activeSection
                  }
                  onSubmit={(event) => submitResourceForm(event, activeSection)}
                >
                  <div className="section-title">
                    <h2>
                      {activeSection === 'tables' && editingTable
                        ? 'Editar mesa'
                        : activeSection === 'items' && editingItem
                          ? 'Editar producto'
                          : activeEditingResource
                            ? `Editar ${resourceSingularLabel(activeSection).toLowerCase()}`
                          : resourceConfigs[activeSection]?.title}
                    </h2>
                    <span>
                      {activeSection === 'tables' && editingTable
                        ? 'Actualizar posicion, estado o mesero'
                        : activeSection === 'items' && editingItem
                          ? 'Actualizar precio, disponibilidad y carta'
                          : activeEditingResource
                            ? 'Actualizar datos y guardar cambios en base de datos'
                          : currentSection?.label}
                    </span>
                  </div>
                  {activeSection === 'items' && (
                    <div className="menu-export-panel">
                      <label>
                        <input
                          checked={showSoldOutInMenuPdf}
                          type="checkbox"
                          onChange={(event) => setShowSoldOutInMenuPdf(event.target.checked)}
                        />
                        Mostrar agotados en carta
                      </label>
                      <button type="button" onClick={downloadMenuPdf}>Descargar carta PDF</button>
                    </div>
                  )}
                  {resourceConfigs[activeSection]?.fields.map((field) => (
                    <label className="admin-form-field" key={field.name}>
                      {field.label}
                      {renderField(
                        field,
                        resourceRows,
                        activeSection === 'tables' ? editingTable : activeSection === 'items' ? editingItem : activeEditingResource
                      )}
                    </label>
                  ))}
                  <Button disabled={savingSection === activeSection}>
                    {savingSection === activeSection
                      ? 'Guardando...'
                      : (activeSection === 'tables' && editingTable) || (activeSection === 'items' && editingItem) || activeEditingResource
                        ? 'Guardar cambios'
                        : resourceConfigs[activeSection]?.title}
                  </Button>
                  {activeSection === 'tables' && editingTable && (
                    <>
                      <button className="secondary-action" type="button" onClick={() => setEditingTable(null)}>
                        Crear mesa nueva
                      </button>
                      <button className="danger-action" type="button" onClick={deactivateEditingTable}>
                        Desactivar mesa
                      </button>
                    </>
                  )}
                  {activeSection === 'items' && editingItem && (
                    <>
                      <button className="secondary-action" type="button" onClick={() => setEditingItem(null)}>
                        Crear producto nuevo
                      </button>
                      <button
                        className="secondary-action"
                        type="button"
                        onClick={() => updateEditingItem({ isAvailable: false }, 'Producto marcado como agotado.')}
                      >
                        Marcar agotado
                      </button>
                      <button
                        className="secondary-action"
                        type="button"
                        onClick={() => updateEditingItem({ isAvailable: true }, 'Producto marcado como disponible.')}
                      >
                        Marcar disponible
                      </button>
                      <button className="danger-action" type="button" onClick={deactivateEditingItem}>
                        Desactivar producto
                      </button>
                    </>
                  )}
                  {activeEditingResource && (
                    <>
                      <button className="secondary-action" type="button" onClick={() => setEditingResource(null)}>
                        Crear nuevo
                      </button>
                      <button className="danger-action" type="button" onClick={deactivateEditingResource}>
                        Desactivar
                      </button>
                    </>
                  )}
                </form>
              ) : null
            )}
          </section>
        )}
      </section>
      </main>
    </AuthGate>
  );
}

function AdminTablesMap({
  isSaving,
  onAutoArrange,
  onMove,
  onSelect,
  selectedId,
  rows
}: {
  isSaving: boolean;
  onAutoArrange: (areaTables: Array<Record<string, unknown>>) => void;
  onMove: (tableId: string, posX: number, posY: number) => void;
  onSelect: (table: Record<string, unknown>) => void;
  selectedId: string;
  rows?: Array<Record<string, unknown>>;
}) {
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ posX: number; posY: number } | null>(null);
  const [draftPositions, setDraftPositions] = useState<Record<string, { posX: number; posY: number }>>({});
  const [dragWarning, setDragWarning] = useState('');
  const [skipSelectTableId, setSkipSelectTableId] = useState<string | null>(null);
  const tableRows = rows ?? [];

  const groupedTables = tableRows.reduce<Record<string, Array<Record<string, unknown>>>>((groups, table) => {
    const area = String((table.diningArea as Record<string, unknown> | undefined)?.name ?? 'Salon principal');

    return {
      ...groups,
      [area]: [...(groups[area] ?? []), table]
    };
  }, {});
  const cancelMovement = () => {
    if (!draggingTableId) return;

    setDraftPositions((current) => {
      const next = { ...current };

      if (dragStartPosition) {
        next[draggingTableId] = dragStartPosition;
      } else {
        delete next[draggingTableId];
      }

      return next;
    });
    setDragWarning('Movimiento cancelado.');
    setDraggingTableId(null);
    setDragStartPosition(null);
  };

  useEffect(() => {
    if (!draggingTableId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelMovement();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragStartPosition, draggingTableId]);

  return (
    <div className="admin-table-map-panel">
      <div className="section-title">
        <div>
          <h3>Mapa operativo de mesas</h3>
          <span>Arrastra mesas para moverlas o usa ordenamiento automático por área.</span>
        </div>
      </div>
      {(draggingTableId || dragWarning) && (
        <div className={dragWarning.includes('encima') ? 'drag-feedback warning' : 'drag-feedback'}>
          <span>{dragWarning || 'Moviendo mesa. Suelta para guardar o presiona Escape para cancelar.'}</span>
          {draggingTableId && <button type="button" onClick={cancelMovement}>Cancelar movimiento</button>}
        </div>
      )}
      <div className="area-map-stack">
        {Object.entries(groupedTables).sort(([firstArea], [secondArea]) => firstArea.localeCompare(secondArea, 'es')).map(([area, areaTables]) => (
          <section className="restaurant-area-map" key={area}>
            <header>
              <strong>{area}</strong>
              <span>{areaTables.length} mesas</span>
              <button className="secondary-action" disabled={isSaving} type="button" onClick={() => onAutoArrange(areaTables)}>
                Ordenar automáticamente
              </button>
            </header>
            <div
              className="table-map-canvas compact"
              style={{ minHeight: `${mapCanvasHeight(areaTables)}px` }}
              onPointerMove={(event) => {
                if (!draggingTableId) return;
                const nextPosition = pointerPositionInCanvas(event);
                setDraftPositions((current) => ({
                  ...current,
                  [draggingTableId]: nextPosition
                }));
                setDragWarning(
                  isTablePositionColliding(draggingTableId, nextPosition, areaTables) ? 'Advertencia: la mesa quedaria encima de otra.' : ''
                );
              }}
              onPointerUp={() => {
                if (!draggingTableId) return;
                const draft = draftPositions[draggingTableId];
                const currentDraggingTableId = draggingTableId;
                setDraggingTableId(null);
                setDragStartPosition(null);

                if (draft) {
                  if (isTablePositionColliding(currentDraggingTableId, draft, areaTables)) {
                    setDragWarning('Advertencia: la mesa quedaria encima de otra.');
                    setDraftPositions((current) => {
                      const next = { ...current };
                      delete next[currentDraggingTableId];
                      return next;
                    });
                    return;
                  }

                  setDragWarning('');
                  onMove(currentDraggingTableId, draft.posX, draft.posY);
                }
              }}
            >
              {[...areaTables].sort(compareTablesByNumber).map((table, index) => {
                const status = normalizeTableStatus(String(table.status ?? 'AVAILABLE'));
                const shape = String(table.shape ?? 'SQUARE').toLowerCase();
                const tableId = String(table.id ?? `${area}-${index}`);
                const draft = draftPositions[tableId];
                const fallbackPosition = getAutoTablePosition(index);
                const posX = Number(draft?.posX ?? table.posX ?? fallbackPosition.posX);
                const posY = Number(draft?.posY ?? table.posY ?? fallbackPosition.posY);

                return (
                  <button
                    className={`visual-table ${shape} ${status.toLowerCase()} ${String(table.id) === selectedId ? 'active' : ''} ${draggingTableId === tableId ? 'dragging' : ''}`}
                    key={tableId}
                    style={{
                      left: `${Math.min(Math.max(posX, 10), 90)}%`,
                      top: `${Math.max(posY, 14)}%`,
                      borderColor: String(table.color ?? '')
                    }}
                    type="button"
                    onClick={() => {
                      if (skipSelectTableId === tableId) {
                        setSkipSelectTableId(null);
                        return;
                      }

                      onSelect(table);
                    }}
                    onPointerDown={(event) => {
                      const nextPosition = pointerPositionInCanvas(event);
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraggingTableId(tableId);
                      setDragWarning('');
                      setDragStartPosition({ posX, posY });
                      setDraftPositions((current) => ({
                        ...current,
                        [tableId]: nextPosition
                      }));
                    }}
                    onPointerMove={(event) => {
                      if (draggingTableId !== tableId) return;
                      const nextPosition = pointerPositionInCanvas(event);
                      setDraftPositions((current) => ({
                        ...current,
                        [tableId]: nextPosition
                      }));
                      setDragWarning(
                        isTablePositionColliding(tableId, nextPosition, areaTables) ? 'Advertencia: la mesa quedaria encima de otra.' : ''
                      );
                    }}
                    onPointerUp={() => {
                      if (draggingTableId !== tableId) return;
                      const draft = draftPositions[tableId];
                      setDraggingTableId(null);
                      setDragStartPosition(null);
                      setSkipSelectTableId(tableId);

                      if (draft) {
                        if (isTablePositionColliding(tableId, draft, areaTables)) {
                          setDragWarning('Advertencia: la mesa quedaria encima de otra.');
                          setDraftPositions((current) => {
                            const next = { ...current };
                            delete next[tableId];
                            return next;
                          });
                          return;
                        }

                        setDragWarning('');
                        onMove(tableId, draft.posX, draft.posY);
                      }
                    }}
                    title="Mesa del mapa administrativo"
                  >
                    <strong>{String(table.number ?? index + 1)}</strong>
                    <span>{String(table.capacity ?? 4)} personas</span>
                    <em>{tableStatusLabel(status)}</em>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {Object.keys(groupedTables).length === 0 && (
          <div className="empty-state compact">No hay mesas en esta area. Crea una mesa para verla en el mapa.</div>
        )}
      </div>
    </div>
  );
}

function TableAssignmentPanel({
  areas,
  bulkWaiterId,
  isSaving,
  onAssign,
  onAreaFilterChange,
  onBulkAssign,
  onBulkWaiterChange,
  onSelectionChange,
  onWaiterFilterChange,
  selectedAreaId,
  selectedTableIds,
  selectedWaiterId,
  tables,
  waiterCounts,
  waiters
}: {
  areas: Array<Record<string, unknown>>;
  bulkWaiterId: string;
  isSaving: boolean;
  onAssign: (tableId: string, waiterId: string) => void;
  onAreaFilterChange: (areaId: string) => void;
  onBulkAssign: (waiterId: string) => void;
  onBulkWaiterChange: (waiterId: string) => void;
  onSelectionChange: (tableIds: string[]) => void;
  onWaiterFilterChange: (waiterId: string) => void;
  selectedAreaId: string;
  selectedTableIds: string[];
  selectedWaiterId: string;
  tables: Array<Record<string, unknown>>;
  waiterCounts: Map<string, number>;
  waiters: ApiEmployee[];
}) {
  const waitersById = new Map(waiters.map((employee) => [employee.user.id, employee]));
  const visibleTableIds = tables.map((table) => String(table.id));
  const allVisibleSelected = visibleTableIds.length > 0 && visibleTableIds.every((id) => selectedTableIds.includes(id));

  return (
    <div className="table-assignment-panel">
      <div className="section-title">
        <div>
          <h3>Asignacion de meseros</h3>
          <span>Filtra por area o mesero y asigna mesas con el selector.</span>
        </div>
        <span>{tables.length} mesas visibles</span>
      </div>

      <div className="assignment-filters">
        <label>
          Area
          <select value={selectedAreaId} onChange={(event) => onAreaFilterChange(event.target.value)}>
            <option value="">Todas las areas</option>
            {areas.map((area) => (
              <option key={String(area.id)} value={String(area.id)}>{String(area.name ?? 'Area')}</option>
            ))}
          </select>
        </label>
        <label>
          Mesero
          <select value={selectedWaiterId} onChange={(event) => onWaiterFilterChange(event.target.value)}>
            <option value="">Todos los meseros</option>
            <option value="__unassigned">Sin asignar</option>
            {waiters.map((employee) => (
              <option key={employee.user.id} value={employee.user.id}>{employeeName(employee)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="bulk-assignment-bar">
        <label>
          <input
            checked={allVisibleSelected}
            type="checkbox"
            onChange={(event) => onSelectionChange(event.target.checked ? visibleTableIds : selectedTableIds.filter((id) => !visibleTableIds.includes(id)))}
          />
          Seleccionar mesas visibles
        </label>
        <select value={bulkWaiterId} onChange={(event) => onBulkWaiterChange(event.target.value)}>
          <option value="">Sin asignar</option>
          {waiters.map((employee) => (
            <option key={employee.user.id} value={employee.user.id}>{employeeName(employee)}</option>
          ))}
        </select>
        <button disabled={isSaving || selectedTableIds.length === 0} type="button" onClick={() => onBulkAssign(bulkWaiterId)}>
          Asignar seleccionadas
        </button>
        <span>{selectedTableIds.length} seleccionadas</span>
      </div>

      <div className="waiter-counter-list">
        {waiters.map((employee) => {
          const count = waiterCounts.get(employee.user.id) ?? 0;

          return (
            <article className={count > 3 ? 'waiter-counter warning' : 'waiter-counter'} key={employee.user.id}>
              <strong>{employeeName(employee)}</strong>
              <span>{count} mesas asignadas</span>
              {count > 3 && <em>Este mesero tiene {count} mesas asignadas.</em>}
            </article>
          );
        })}
        {waiters.length === 0 && <div className="empty-state compact">No hay meseros activos disponibles.</div>}
      </div>

      <div className="table-assignment-list">
        {tables.map((table) => {
          const waiterId = String(table.assignedWaiterId ?? '');
          const assignedWaiter = waiterId ? waitersById.get(waiterId) : null;

          return (
            <article className="table-assignment-row" key={String(table.id)}>
              <label className="assignment-checkbox">
                <input
                  checked={selectedTableIds.includes(String(table.id))}
                  type="checkbox"
                  onChange={(event) =>
                    onSelectionChange(
                      event.target.checked
                        ? [...selectedTableIds, String(table.id)]
                        : selectedTableIds.filter((id) => id !== String(table.id))
                    )
                  }
                />
              </label>
              <div>
                <strong>{String(table.name ?? 'Mesa')} {String(table.number ?? '')}</strong>
                <span>{String((table.diningArea as Record<string, unknown> | undefined)?.name ?? 'Sin area')}</span>
                <em>{assignedWaiter ? `Asignada a ${employeeName(assignedWaiter)}` : 'Sin mesero asignado'}</em>
              </div>
              <select
                disabled={isSaving}
                value={waiterId}
                onChange={(event) => onAssign(String(table.id), event.target.value)}
              >
                <option value="">Sin asignar</option>
                {waiters.map((employee) => (
                  <option key={employee.user.id} value={employee.user.id}>{employeeName(employee)}</option>
                ))}
              </select>
            </article>
          );
        })}
        {tables.length === 0 && <div className="empty-state compact">No hay mesas con los filtros seleccionados.</div>}
      </div>
    </div>
  );
}

function employeeName(employee: ApiEmployee) {
  return `${employee.user.firstName} ${employee.user.lastName}`.trim() || employee.user.email;
}

function tableAreaId(table: Record<string, unknown>) {
  return String(table.diningAreaId ?? (table.diningArea as Record<string, unknown> | undefined)?.id ?? '');
}

function compareTablesByNumber(first: Record<string, unknown>, second: Record<string, unknown>) {
  const firstNumber = Number(first.number);
  const secondNumber = Number(second.number);
  const firstIsNumeric = Number.isFinite(firstNumber);
  const secondIsNumeric = Number.isFinite(secondNumber);

  if (firstIsNumeric && secondIsNumeric && firstNumber !== secondNumber) {
    return firstNumber - secondNumber;
  }

  return String(first.number ?? first.name ?? '').localeCompare(String(second.number ?? second.name ?? ''), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

function pointerPositionInCanvas(event: ReactPointerEvent<HTMLElement>) {
  const eventElement = event.currentTarget ?? (event.target instanceof HTMLElement ? event.target : null);
  const canvas = eventElement?.classList.contains('table-map-canvas')
    ? eventElement
    : eventElement?.closest('.table-map-canvas');
  const rect = canvas?.getBoundingClientRect();

  if (!rect) {
    return { posX: 18, posY: 26 };
  }

  return {
    posX: Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 10), 90),
    posY: Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 14), 86)
  };
}

function isTablePositionColliding(tableId: string, position: { posX: number; posY: number }, areaTables: Array<Record<string, unknown>>) {
  return areaTables.some((table, index) => {
    const otherTableId = String(table.id ?? `table-${index}`);

    if (otherTableId === tableId) {
      return false;
    }

    const fallbackPosition = getAutoTablePosition(index);
    const otherPosition = {
      posX: Number(table.posX ?? fallbackPosition.posX),
      posY: Number(table.posY ?? fallbackPosition.posY)
    };

    return Math.abs(otherPosition.posX - position.posX) < 14 && Math.abs(otherPosition.posY - position.posY) < 18;
  });
}

function getAutoTablePosition(index: number) {
  const column = index % 4;
  const row = Math.floor(index / 4);

  return {
    posX: 16 + column * 22,
    posY: 22 + row * 28
  };
}

function mapCanvasHeight(tables: Array<Record<string, unknown>>) {
  const maxSavedY = tables.reduce((maxY, table) => Math.max(maxY, Number(table.posY ?? 0)), 0);
  const rows = Math.max(1, Math.ceil(tables.length / 4));
  const rowHeight = rows * 92;
  const overflowHeight = maxSavedY > 86 ? Math.ceil((maxSavedY / 86) * 210) : 0;

  return Math.max(210, rowHeight, overflowHeight);
}

function GeneralSettingsPanel({
  definitions,
  isSaving,
  onSubmit,
  settings
}: {
  definitions: SettingDefinition[];
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  settings: Array<Record<string, unknown>>;
}) {
  const settingsByKey = new Map(settings.map((setting) => [String(setting.key), setting]));
  const grouped = definitions.reduce<Record<string, SettingDefinition[]>>((groups, definition) => ({
    ...groups,
    [definition.group]: [...(groups[definition.group] ?? []), definition]
  }), {});

  return (
    <form className="settings-section" onSubmit={onSubmit}>
      {Object.entries(grouped).map(([group, groupDefinitions]) => (
        <section className="admin-panel settings-group" key={group}>
          <div className="section-title">
            <div>
              <h2>{group}</h2>
              <span>{groupDefinitions.length} parametros</span>
            </div>
          </div>
          <div className="settings-grid">
            {groupDefinitions.map((definition) => {
              const setting = settingsByKey.get(definition.key);
              const value = String(setting?.value ?? definition.defaultValue);

              return (
                <label className={definition.type === 'checkbox' ? 'settings-toggle' : 'admin-form-field'} key={definition.key}>
                  <span>
                    {definition.label}
                    <em>{definition.description}</em>
                  </span>
                  {renderSettingInput(definition, value)}
                </label>
              );
            })}
          </div>
        </section>
      ))}
      <div className="settings-savebar">
        <Button disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar configuracion general'}</Button>
      </div>
    </form>
  );
}

function InventoryOperationsPanel({
  ingredients,
  isSaving,
  onCountSubmit,
  onRefresh,
  recipes
}: {
  ingredients: Array<Record<string, unknown>>;
  isSaving: boolean;
  onCountSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  recipes: Array<Record<string, unknown>>;
}) {
  const [countDrafts, setCountDrafts] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState('Diario');
  const [notes, setNotes] = useState('');
  const activeIngredients = ingredients.filter((ingredient) => ingredient.isActive !== false);
  const lowStock = activeIngredients.filter((ingredient) => Number(ingredient.currentStock ?? 0) <= Number(ingredient.minimumStock ?? 0));
  const inventoryValue = activeIngredients.reduce((sum, ingredient) => {
    return sum + Number(ingredient.currentStock ?? 0) * Number(ingredient.averageCost ?? 0);
  }, 0);

  return (
    <div className="inventory-operations">
      <div className="inventory-explainer">
        <div>
          <h3>Como funciona el inventario</h3>
          <p>Ingredientes guarda el stock base. Recetas define gramajes por plato. Al vender y enviar a cocina, el sistema descuenta consumo automaticamente. Entradas, mermas y conteos fisicos quedan como movimientos auditables.</p>
        </div>
        <button className="secondary-action" type="button" onClick={onRefresh}>Actualizar movimientos</button>
      </div>

      <div className="inventory-summary">
        <article>
          <span>Ingredientes activos</span>
          <strong>{activeIngredients.length}</strong>
        </article>
        <article>
          <span>Bajo stock</span>
          <strong>{lowStock.length}</strong>
        </article>
        <article>
          <span>Valor estimado</span>
          <strong>{formatCurrency(inventoryValue)}</strong>
        </article>
        <article>
          <span>Control manual</span>
          <strong>Conteo</strong>
        </article>
      </div>

      <div className="manual-stock-panel">
        <div className="section-title">
          <div>
            <h3>Manual de stock actual</h3>
            <span>Cuenta fisicamente y compara contra lo que deberia estar en sistema.</span>
          </div>
          <label>
            Periodo
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option>Diario</option>
              <option>Semanal</option>
              <option>Quincenal</option>
              <option>Mensual</option>
            </select>
          </label>
        </div>

        <textarea
          className="manual-stock-notes"
          value={notes}
          placeholder="Notas generales del conteo: responsable, turno, observaciones..."
          onChange={(event) => setNotes(event.target.value)}
        />

        <div className="manual-stock-table">
          <div className="manual-stock-head">
            <span>Ingrediente</span>
            <span>Precio proveedor</span>
            <span>Precio vendido ref.</span>
            <span>Debe estar</span>
            <span>Cantidad contada</span>
            <span>Diferencia</span>
            <span>Accion</span>
          </div>
          {activeIngredients.map((ingredient) => {
            const ingredientId = String(ingredient.id);
            const expectedStock = Number(ingredient.currentStock ?? 0);
            const countedRaw = countDrafts[ingredientId] ?? '';
            const countedStock = countedRaw === '' ? expectedStock : Number(countedRaw);
            const difference = countedStock - expectedStock;
            const statusClass = difference < 0 ? 'shortage' : difference > 0 ? 'surplus' : 'normal';

            return (
              <form className="manual-stock-row" key={ingredientId} onSubmit={onCountSubmit}>
                <input name="ingredientId" type="hidden" value={ingredientId} />
                <input name="period" type="hidden" value={period} />
                <input name="notes" type="hidden" value={notes} />
                <strong>{String(ingredient.name ?? 'Ingrediente')} <small>{String(ingredient.unit ?? '')}</small></strong>
                <span>{formatCurrency(Number(ingredient.averageCost ?? 0))}</span>
                <span>{ingredientSaleReference(ingredientId, recipes)}</span>
                <span>{expectedStock} {String(ingredient.unit ?? '')}</span>
                <input
                  name="countedStock"
                  type="number"
                  step="0.001"
                  min="0"
                  value={countedRaw}
                  placeholder={String(expectedStock)}
                  onChange={(event) => setCountDrafts((current) => ({ ...current, [ingredientId]: event.target.value }))}
                />
                <em className={`manual-stock-difference ${statusClass}`}>
                  {difference > 0 ? '+' : ''}{difference.toFixed(3)} {String(ingredient.unit ?? '')}
                </em>
                <button disabled={isSaving || countedRaw === ''} type="submit">
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </form>
            );
          })}
          {activeIngredients.length === 0 && <div className="empty-state compact">No hay ingredientes activos para contar.</div>}
        </div>
      </div>
    </div>
  );
}

function InventoryPurchasePanel({
  ingredients,
  isSaving,
  onSubmit,
  suppliers
}: {
  ingredients: Array<Record<string, unknown>>;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  suppliers: Array<Record<string, unknown>>;
}) {
  const activeIngredients = ingredients.filter((ingredient) => ingredient.isActive !== false);

  return (
    <div className="inventory-operations">
      <form className="inventory-card" onSubmit={onSubmit}>
        <div>
          <h3>Registrar compra recibida</h3>
          <span>Esta entrada suma stock, guarda proveedor/factura y actualiza el costo real por unidad, gramo o mililitro.</span>
        </div>
        <select name="supplierId" defaultValue="">
          <option value="">Proveedor opcional</option>
          {suppliers.filter((supplier) => supplier.isActive !== false).map((supplier) => (
            <option key={String(supplier.id)} value={String(supplier.id)}>{String(supplier.name ?? 'Proveedor')}</option>
          ))}
        </select>
        <input name="invoiceNumber" placeholder="Factura o remision" />
        <select name="ingredientId" required defaultValue="">
          <option value="" disabled>Ingrediente comprado</option>
          {activeIngredients.map((ingredient) => (
            <option key={String(ingredient.id)} value={String(ingredient.id)}>
              {String(ingredient.name ?? 'Ingrediente')} - stock {String(ingredient.currentStock ?? 0)} {String(ingredient.unit ?? '')}
            </option>
          ))}
        </select>
        <input name="quantity" type="number" step="0.001" min="0.001" placeholder="Cantidad recibida" required />
        <input name="unitCost" type="number" step="0.01" min="0" placeholder="Costo por unidad/gramo/ml" required />
        <textarea name="notes" placeholder="Notas de compra" />
        <button disabled={isSaving || activeIngredients.length === 0} type="submit">
          {isSaving ? 'Guardando...' : 'Registrar compra'}
        </button>
      </form>
    </div>
  );
}

function InventoryCountPanel({
  ingredients,
  isSaving,
  onSubmit
}: {
  ingredients: Array<Record<string, unknown>>;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeIngredients = ingredients.filter((ingredient) => ingredient.isActive !== false);

  return (
    <div className="inventory-operations">
      <form className="inventory-card" onSubmit={onSubmit}>
        <div>
          <h3>Registrar conteo fisico</h3>
          <span>Compara el stock del sistema contra lo contado. Si falta queda FALTANTE, si sobra queda SOBRANTE y si coincide queda NORMAL.</span>
        </div>
        <select name="period" defaultValue="Semanal">
          <option>Diario</option>
          <option>Semanal</option>
          <option>Quincenal</option>
          <option>Mensual</option>
        </select>
        <select name="ingredientId" required defaultValue="">
          <option value="" disabled>Ingrediente contado</option>
          {activeIngredients.map((ingredient) => (
            <option key={String(ingredient.id)} value={String(ingredient.id)}>
              {String(ingredient.name ?? 'Ingrediente')} - sistema: {String(ingredient.currentStock ?? 0)} {String(ingredient.unit ?? '')}
            </option>
          ))}
        </select>
        <input name="countedStock" type="number" step="0.001" min="0" placeholder="Cantidad fisica contada" required />
        <textarea name="notes" placeholder="Notas del conteo: responsable, turno, observaciones..." />
        <button disabled={isSaving || activeIngredients.length === 0} type="submit">
          {isSaving ? 'Aplicando...' : 'Aplicar conteo fisico'}
        </button>
      </form>
    </div>
  );
}

function renderSettingInput(definition: SettingDefinition, value: string) {
  if (definition.type === 'checkbox') {
    return <input name={definition.key} type="checkbox" defaultChecked={value === 'true'} />;
  }

  if (definition.type === 'select') {
    return (
      <select name={definition.key} defaultValue={value}>
        {(definition.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  return <input name={definition.key} type={definition.type} defaultValue={value} />;
}

function RecipeEditor({
  ingredients,
  menuItems,
  onCreateIngredient,
  onFeedback,
  onRemove,
  onSave,
  recipes,
  selectedMenuItemId,
  setSelectedMenuItemId
}: {
  ingredients: Array<Record<string, unknown>>;
  menuItems: Array<Record<string, unknown>>;
  onCreateIngredient: () => void;
  onFeedback: (message: string) => void;
  onRemove: (recipeId: string) => void;
  onSave: (recipeId: string | null, body: Record<string, unknown>) => void;
  recipes: Array<Record<string, unknown>>;
  selectedMenuItemId: string;
  setSelectedMenuItemId: (id: string) => void;
}) {
  const categoryOptions = Array.from(
    menuItems.reduce<Map<string, string>>((categories, item) => {
      const category = item.category as Record<string, unknown> | undefined;
      const categoryId = String(item.categoryId ?? category?.id ?? '');
      const categoryName = String(category?.name ?? 'Sin categoria');

      if (categoryId) {
        categories.set(categoryId, categoryName);
      }

      return categories;
    }, new Map())
  ).map(([id, name]) => ({ id, name }));
  const activeSelectedItem = menuItems.find((item) => String(item.id) === selectedMenuItemId);
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => String(activeSelectedItem?.categoryId ?? (activeSelectedItem?.category as Record<string, unknown> | undefined)?.id ?? ''));
  const filteredMenuItems = selectedCategoryId
    ? menuItems.filter((item) => String(item.categoryId ?? (item.category as Record<string, unknown> | undefined)?.id ?? '') === selectedCategoryId)
    : menuItems;
  const activeMenuItemId = selectedMenuItemId && filteredMenuItems.some((item) => String(item.id) === selectedMenuItemId)
    ? selectedMenuItemId
    : String(filteredMenuItems[0]?.id ?? menuItems[0]?.id ?? '');
  const selectedItem = menuItems.find((item) => String(item.id) === activeMenuItemId);
  const selectedRecipes = recipes.filter((recipe) => String(recipe.menuItemId) === activeMenuItemId);
  const estimatedCost = selectedRecipes.reduce((sum, recipe) => {
    const ingredient = recipe.ingredient as Record<string, unknown> | undefined;
    const quantity = convertRecipeQuantity(Number(recipe.quantity ?? 0), String(recipe.unit ?? ''), String(ingredient?.unit ?? recipe.unit ?? ''));

    return sum + quantity * Number(ingredient?.averageCost ?? 0);
  }, 0);
  const price = Number(selectedItem?.price ?? 0);
  const margin = price - estimatedCost;

  useEffect(() => {
    if (!activeMenuItemId || activeMenuItemId === selectedMenuItemId) {
      return;
    }

    setSelectedMenuItemId(activeMenuItemId);
  }, [activeMenuItemId, selectedMenuItemId, setSelectedMenuItemId]);

  function submitRecipeLine(event: FormEvent<HTMLFormElement>, recipeId: string | null) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ingredientId = String(form.get('ingredientId') ?? '');

    if (!activeMenuItemId || !ingredientId) {
      return;
    }

    if (!recipeId && selectedRecipes.some((recipe) => String(recipe.ingredientId) === ingredientId)) {
      onFeedback('Este ingrediente ya existe en la receta. Edita la linea existente para cambiar cantidad o unidad.');
      return;
    }

    onSave(recipeId, {
      menuItemId: activeMenuItemId,
      ingredientId,
      quantity: Number(form.get('quantity') ?? 0),
      unit: String(form.get('unit') ?? ''),
      notes: String(form.get('notes') ?? '')
    });

    if (!recipeId) {
      event.currentTarget.reset();
    }
  }

  return (
    <div className="recipe-editor">
      <div className="recipe-editor-header">
        <label>
          Categoria
          <select
            value={selectedCategoryId}
            onChange={(event) => {
              const nextCategoryId = event.target.value;
              const nextItems = nextCategoryId
                ? menuItems.filter((item) => String(item.categoryId ?? (item.category as Record<string, unknown> | undefined)?.id ?? '') === nextCategoryId)
                : menuItems;

              setSelectedCategoryId(nextCategoryId);
              setSelectedMenuItemId(String(nextItems[0]?.id ?? ''));
            }}
          >
            <option value="">Todas las categorias</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          Plato
          <select disabled={filteredMenuItems.length === 0} value={activeMenuItemId} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
            {filteredMenuItems.map((item) => (
              <option key={String(item.id)} value={String(item.id)}>{String(item.name ?? 'Producto')}</option>
            ))}
          </select>
        </label>
        <div>
          <span>Costo estimado</span>
          <strong>{formatCurrency(estimatedCost)}</strong>
        </div>
        <div>
          <span>Margen estimado</span>
          <strong>{formatCurrency(margin)}</strong>
        </div>
      </div>

      {menuItems.length === 0 && (
        <div className="empty-state compact">No hay platos creados. Primero crea un producto en Platos para poder armar su receta.</div>
      )}

      {menuItems.length > 0 && ingredients.length === 0 && (
        <div className="empty-state compact">No hay ingredientes creados. Crea ingredientes antes de agregar lineas a la receta.</div>
      )}

      <div className="recipe-lines">
        {selectedRecipes.map((recipe) => (
          <form className="recipe-line" key={String(recipe.id)} onSubmit={(event) => submitRecipeLine(event, String(recipe.id))}>
            <select name="ingredientId" defaultValue={String(recipe.ingredientId ?? '')}>
              {ingredients.map((ingredient) => (
                <option key={String(ingredient.id)} value={String(ingredient.id)}>{String(ingredient.name ?? 'Ingrediente')}</option>
              ))}
            </select>
            <input name="quantity" type="number" step="0.001" min="0.001" defaultValue={String(recipe.quantity ?? '')} />
            <input name="unit" defaultValue={String(recipe.unit ?? '')} />
            <input name="notes" placeholder="Notas" defaultValue={String(recipe.notes ?? '')} />
            <button type="submit">Guardar</button>
            <button className="danger-action" type="button" onClick={() => onRemove(String(recipe.id))}>Eliminar</button>
          </form>
        ))}
        {activeMenuItemId && selectedRecipes.length === 0 && (
          <div className="empty-state compact">Este plato todavia no tiene ingredientes en su receta.</div>
        )}
      </div>

      <form className="recipe-line new" onSubmit={(event) => submitRecipeLine(event, null)}>
        <select name="ingredientId" required defaultValue="">
          <option value="" disabled>Agregar ingrediente</option>
          {ingredients.map((ingredient) => (
            <option key={String(ingredient.id)} value={String(ingredient.id)}>{String(ingredient.name ?? 'Ingrediente')}</option>
          ))}
        </select>
        <input name="quantity" type="number" step="0.001" min="0.001" placeholder="Cantidad" required />
        <input name="unit" placeholder="gramos, ml, unidad" required />
        <input name="notes" placeholder="Notas" />
        <button disabled={!activeMenuItemId || ingredients.length === 0} type="submit">Agregar</button>
        <button className="secondary-action" type="button" onClick={onCreateIngredient}>Crear ingrediente</button>
      </form>
    </div>
  );
}

function normalizeTableStatus(value: string) {
  const normalized = value.toUpperCase();
  const byLabel: Record<string, string> = {
    DISPONIBLE: 'AVAILABLE',
    OCUPADA: 'OCCUPIED',
    RESERVADA: 'RESERVED',
    LIMPIEZA: 'CLEANING',
    BLOQUEADA: 'BLOCKED',
    'EN COCINA': 'WAITING_KITCHEN',
    'LISTO PARA SERVIR': 'READY_TO_SERVE',
    'CUENTA SOLICITADA': 'WAITING_PAYMENT'
  };

  return byLabel[normalized] ?? normalized;
}

function tableStatusLabel(status: string) {
  const labels: Record<string, string> = {
    AVAILABLE: 'Disponible',
    OCCUPIED: 'Ocupada',
    RESERVED: 'Reservada',
    CLEANING: 'Limpieza',
    BLOCKED: 'Bloqueada',
    WAITING_KITCHEN: 'En cocina',
    READY_TO_SERVE: 'Listo para servir',
    WAITING_PAYMENT: 'Cuenta solicitada'
  };

  return labels[status] ?? status;
}

function menuItemStatus(item: Record<string, unknown>) {
  if (item.isActive === false) return 'Inactivo';
  if (item.isAvailable === false) return 'Agotado';
  if (item.showInPublicMenu === false) return 'Oculto en carta';
  if (item.showForWaiters === false) return 'Oculto para meseros';

  return 'Disponible';
}

function convertRecipeQuantity(quantity: number, fromUnit: string, toUnit: string) {
  const from = normalizeRecipeUnit(fromUnit);
  const to = normalizeRecipeUnit(toUnit);

  if (from === to) return quantity;
  if (from === 'kg' && to === 'g') return quantity * 1000;
  if (from === 'g' && to === 'kg') return quantity / 1000;
  if (from === 'l' && to === 'ml') return quantity * 1000;
  if (from === 'ml' && to === 'l') return quantity / 1000;

  return quantity;
}

function normalizeRecipeUnit(unit: string) {
  const value = unit.trim().toLowerCase();
  const aliases: Record<string, string> = {
    gramos: 'g',
    gramo: 'g',
    g: 'g',
    kilogramos: 'kg',
    kilogramo: 'kg',
    kg: 'kg',
    mililitros: 'ml',
    mililitro: 'ml',
    ml: 'ml',
    litros: 'l',
    litro: 'l',
    l: 'l',
    unidades: 'unit',
    unidad: 'unit',
    unit: 'unit'
  };

  return aliases[value] ?? value;
}

function buildMenuDocumentHtml(groupedItems: Record<string, Array<Record<string, unknown>>>, showSoldOut: boolean, theme: AppTheme) {
  const sections = Object.entries(groupedItems)
    .map(([category, items]) => `
      <section>
        <h2>${escapeHtml(category)}</h2>
        ${items.map((item) => `
          <article>
            <div>
              <strong>${escapeHtml(String(item.name ?? 'Producto'))}</strong>
              <p>${escapeHtml(String(item.description ?? ''))}</p>
              ${showSoldOut && item.isAvailable === false ? '<em>Agotado</em>' : ''}
            </div>
            <span>${formatCurrency(Number(item.price ?? 0))}</span>
          </article>
        `).join('')}
      </section>
    `)
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <title>Carta de ${escapeHtml(theme.restaurantName)}</title>
        <style>
          body { background: ${theme.backgroundColor}; color: ${theme.textColor}; font-family: ${escapeHtml(theme.fontFamily)}; margin: 32px; }
          header { border-bottom: 2px solid ${theme.primaryColor}; margin-bottom: 24px; padding-bottom: 16px; text-align: center; }
          header img { display: block; height: 72px; margin: 0 auto 12px; object-fit: contain; max-width: 180px; }
          header h1 { margin: 0; font-size: 32px; }
          header p { color: ${theme.secondaryColor}; margin: 8px 0 0; }
          section { break-inside: avoid; margin-bottom: 24px; }
          h2 { color: ${theme.primaryColor}; border-bottom: 1px solid ${theme.secondaryColor}; padding-bottom: 8px; }
          article { background: ${theme.cardColor}; border-radius: ${theme.borderRadius}; display: flex; justify-content: space-between; gap: 24px; margin-bottom: 8px; padding: 12px; }
          strong { font-size: 18px; }
          p { color: ${theme.textColor}; margin: 5px 0 0; opacity: .75; }
          em { color: #b42318; display: block; font-style: normal; font-weight: 700; margin-top: 6px; }
          article > span { white-space: nowrap; font-weight: 800; }
          @page { margin: 18mm; }
        </style>
      </head>
      <body>
        <header>
          ${theme.logoUrl ? `<img alt="" src="${escapeHtml(theme.logoUrl)}" />` : ''}
          <h1>${escapeHtml(theme.restaurantName)}</h1>
          <p>Carta actualizada desde el sistema POS/PWA</p>
        </header>
        ${sections || '<p>No hay productos visibles para la carta.</p>'}
      </body>
    </html>
  `;
}

function buildReportsPrintHtml({
  filters,
  generatedAt,
  generatedBy,
  rows,
  summary,
  theme
}: {
  filters: Record<string, string>;
  generatedAt: string;
  generatedBy: string;
  rows: ReportRow[];
  summary: ReportsResponse['summary'];
  theme: AppTheme;
}) {
  return `
    <!doctype html>
    <html>
      <head>
        <title>Reporte administrativo - ${escapeHtml(theme.restaurantName)}</title>
        <style>
          body { background: ${theme.backgroundColor}; color: ${theme.textColor}; font-family: ${escapeHtml(theme.fontFamily)}; margin: 28px; }
          header { border-bottom: 2px solid ${theme.primaryColor}; margin-bottom: 18px; padding-bottom: 14px; }
          header img { height: 54px; object-fit: contain; max-width: 160px; }
          h1 { margin: 0 0 6px; }
          .meta, .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; }
          .meta div, .summary div { background: ${theme.cardColor}; border: 1px solid ${theme.secondaryColor}; border-radius: ${theme.borderRadius}; padding: 8px; }
          span { color: ${theme.secondaryColor}; display: block; font-size: 12px; }
          strong { display: block; margin-top: 3px; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th, td { border-bottom: 1px solid ${theme.secondaryColor}; padding: 7px 6px; text-align: left; }
          th { background: ${theme.cardColor}; color: ${theme.primaryColor}; }
          td:last-child, th:last-child { text-align: right; }
          @page { margin: 14mm; }
        </style>
      </head>
      <body>
        <header>
          ${theme.logoUrl ? `<img alt="" src="${escapeHtml(theme.logoUrl)}" />` : ''}
          <h1>${escapeHtml(theme.restaurantName)}</h1>
          <span>Reporte generado: ${escapeHtml(new Date(generatedAt).toLocaleString('es-CO'))}</span>
          <span>Usuario: ${escapeHtml(generatedBy)}</span>
        </header>
        <section class="meta">
          ${Object.entries(filters).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value || 'Todos')}</strong></div>`).join('')}
        </section>
        <section class="summary">
          <div><span>Ventas</span><strong>${formatCurrency(summary.salesTotal)}</strong></div>
          <div><span>Descuentos</span><strong>${formatCurrency(summary.discountsTotal)}</strong></div>
          <div><span>Cancelaciones</span><strong>${formatCurrency(summary.cancellationsTotal)}</strong></div>
          <div><span>Cierres caja</span><strong>${formatCurrency(summary.cashClosings)}</strong></div>
        </section>
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Tipo</th><th>Empleado</th><th>Mesa</th><th>Metodo</th><th>Categoria</th><th>Concepto</th><th>Cant.</th><th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.type)}</td>
                <td>${escapeHtml(row.employee)}</td>
                <td>${escapeHtml(row.table)}</td>
                <td>${escapeHtml(row.paymentMethod ?? '-')}</td>
                <td>${escapeHtml(row.category)}</td>
                <td>${escapeHtml(row.concept)}</td>
                <td>${row.quantity}</td>
                <td>${formatCurrency(row.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function hasReadableContrast(backgroundColor: string, textColor: string) {
  return contrastRatio(backgroundColor, textColor) >= 4.5;
}

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function createResourceConfigs(resourceRows: Partial<Record<SectionKey, Array<Record<string, unknown>>>>): Partial<Record<SectionKey, ResourceConfig>> {
  const categories = optionList(resourceRows.categories, (item) => String(item.name ?? item.id));
  const areas = optionList(resourceRows.areas, (item) => String(item.name ?? item.id));
  const items = optionList(resourceRows.items, (item) => String(item.name ?? item.id));
  const ingredients = optionList(resourceRows.inventory, (item) => String(item.name ?? item.id));

  return {
    customers: {
      title: 'Crear cliente',
      successMessage: 'Cliente creado correctamente.',
      endpoint: 'admin/customers',
      fields: [
        { name: 'firstName', label: 'Nombre', type: 'text', required: true },
        { name: 'lastName', label: 'Apellido', type: 'text' },
        { name: 'email', label: 'Correo', type: 'email' },
        { name: 'phone', label: 'Telefono', type: 'text' },
        { name: 'notes', label: 'Notas', type: 'textarea' }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('CLI', item.id),
        name: `${String(item.firstName ?? '')} ${String(item.lastName ?? '')}`.trim(),
        status: item.isActive === false ? 'Inactivo' : 'Activo',
        detail: String(item.email ?? item.phone ?? 'Sin contacto'),
        metric: String(item.notes ?? 'Cliente')
      })
    },
    areas: {
      title: 'Crear area',
      successMessage: 'Area creada correctamente.',
      endpoint: 'dining-areas',
      fields: [
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'description', label: 'Descripcion', type: 'textarea' },
        { name: 'sortOrder', label: 'Orden', type: 'number', defaultValue: 0 }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('AREA', item.id),
        name: String(item.name ?? 'Area'),
        status: item.isActive === false ? 'Inactiva' : 'Activa',
        detail: String(item.description ?? 'Sin descripcion'),
        metric: `${activeTablesCount(item)} mesas`
      })
    },
    tables: {
      title: 'Crear mesa',
      successMessage: 'Mesa creada correctamente.',
      endpoint: 'tables',
      fields: [
        { name: 'diningAreaId', label: 'Area', type: 'select', required: true, options: areas },
        { name: 'name', label: 'Nombre de mesa', type: 'text', placeholder: 'Automatico: Mesa 1, Mesa 2...' },
        { name: 'number', label: 'Numero de mesa', type: 'text', placeholder: 'Automatico por area' },
        { name: 'capacity', label: 'Numero de personas atendidas', type: 'number', required: true, defaultValue: 4 },
        { name: 'shape', label: 'Forma', type: 'select', required: true, options: enumOptions(['SQUARE', 'RECTANGLE', 'ROUND']) },
        { name: 'status', label: 'Estado', type: 'select', options: enumOptions(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BLOCKED', 'WAITING_KITCHEN', 'READY_TO_SERVE', 'WAITING_PAYMENT']) },
        { name: 'color', label: 'Color', type: 'text', placeholder: '#0f766e' }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: `MESA-${String(item.number ?? item.id)}`,
        name: String(item.name ?? 'Mesa'),
        status: String(item.status ?? 'AVAILABLE'),
        detail: String((item.diningArea as Record<string, unknown> | undefined)?.name ?? item.diningAreaId ?? 'Area'),
        metric: `${String(item.capacity ?? 0)} personas`
      })
    },
    categories: {
      title: 'Crear categoria',
      successMessage: 'Categoría creada correctamente.',
      endpoint: 'menu/categories',
      fields: [
        { name: 'parentId', label: 'Categoria padre', type: 'select', options: [{ label: 'Sin padre', value: '' }, ...categories] },
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'description', label: 'Descripcion', type: 'textarea' },
        { name: 'sortOrder', label: 'Orden', type: 'number', defaultValue: 0 }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('CAT', item.id),
        name: String(item.name ?? 'Categoria'),
        status: item.isActive === false ? 'Inactiva' : 'Activa',
        detail: String((item.parent as Record<string, unknown> | undefined)?.name ?? 'Raiz'),
        metric: `Orden ${String(item.sortOrder ?? 0)}`
      })
    },
    items: {
      title: 'Crear producto',
      successMessage: 'Producto creado correctamente.',
      endpoint: 'menu/items',
      fields: [
        { name: 'categoryId', label: 'Categoria', type: 'select', required: true, options: categories },
        { name: 'type', label: 'Tipo', type: 'select', required: true, options: enumOptions(['DISH', 'DRINK', 'ADD_ON']) },
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'description', label: 'Descripcion', type: 'textarea' },
        { name: 'price', label: 'Precio', type: 'number', required: true },
        { name: 'preparationTimeMinutes', label: 'Tiempo preparacion', type: 'number', defaultValue: 0 },
        { name: 'imageUrl', label: 'Imagen URL', type: 'text' },
        { name: 'isAvailable', label: 'Disponible', type: 'checkbox', defaultValue: true },
        { name: 'showInPublicMenu', label: 'Aparece en carta publica', type: 'checkbox', defaultValue: true },
        { name: 'showForWaiters', label: 'Aparece para meseros', type: 'checkbox', defaultValue: true }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('PROD', item.id),
        name: String(item.name ?? 'Producto'),
        status: menuItemStatus(item),
        detail: formatCurrency(Number(item.price ?? 0)),
        metric: String((item.category as Record<string, unknown> | undefined)?.name ?? item.type ?? 'Menu')
      })
    },
    modifiers: {
      title: 'Crear adicional',
      successMessage: 'Adicional creado correctamente.',
      endpoint: 'menu/modifiers',
      fields: [
        { name: 'menuItemId', label: 'Producto', type: 'select', required: true, options: items },
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'priceDelta', label: 'Precio adicional', type: 'number', required: true, defaultValue: 0 },
        { name: 'isRequired', label: 'Obligatorio', type: 'checkbox' },
        { name: 'maxQuantity', label: 'Maximo', type: 'number', defaultValue: 1 }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('MOD', item.id),
        name: String(item.name ?? 'Adicional'),
        status: item.isActive === false ? 'Inactivo' : 'Activo',
        detail: formatCurrency(Number(item.priceDelta ?? 0)),
        metric: String((item.menuItem as Record<string, unknown> | undefined)?.name ?? 'Producto')
      })
    },
    inventory: {
      title: 'Crear ingrediente',
      successMessage: 'Ingrediente creado correctamente.',
      endpoint: 'inventory/ingredients',
      fields: [
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'unit', label: 'Unidad', type: 'select', required: true, options: enumOptions(['gramos', 'kilogramos', 'mililitros', 'litros', 'unidad']) },
        { name: 'currentStock', label: 'Stock actual', type: 'number', required: true },
        { name: 'minimumStock', label: 'Stock minimo', type: 'number', required: true },
        { name: 'averageCost', label: 'Costo por unidad', type: 'number', required: true }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('ING', item.id),
        name: String(item.name ?? 'Ingrediente'),
        status: Number(item.currentStock ?? 0) <= Number(item.minimumStock ?? 0) ? 'Bajo stock' : 'Activo',
        detail: `${String(item.currentStock ?? 0)} ${String(item.unit ?? '')}`,
        metric: `Min ${String(item.minimumStock ?? 0)}`
      })
    },
    suppliers: {
      title: 'Crear proveedor',
      successMessage: 'Proveedor creado correctamente.',
      endpoint: 'inventory/suppliers',
      fields: [
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'taxId', label: 'NIT/RUC', type: 'text' },
        { name: 'phone', label: 'Telefono', type: 'text' },
        { name: 'email', label: 'Correo', type: 'email' },
        { name: 'address', label: 'Direccion', type: 'text' },
        { name: 'notes', label: 'Notas', type: 'textarea' }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('PROV', item.id),
        name: String(item.name ?? 'Proveedor'),
        status: item.isActive === false ? 'Inactivo' : 'Activo',
        detail: String(item.phone ?? item.email ?? item.taxId ?? 'Sin contacto'),
        metric: String(item.address ?? 'Compras')
      })
    },
    purchases: {
      title: 'Registrar compra',
      successMessage: 'Compra registrada correctamente.',
      endpoint: 'inventory/purchases',
      fields: [],
      rowMapper: (item) => {
        const supplier = item.supplier as Record<string, unknown> | undefined;
        const purchaseItems = item.items as Array<Record<string, unknown>> | undefined;

        return {
          id: String(item.id),
          displayId: shortRecordCode('COMP', item.id),
          name: String(supplier?.name ?? 'Sin proveedor'),
          status: String(item.invoiceNumber ?? 'Sin factura'),
          detail: purchaseItems?.map((purchaseItem) => String((purchaseItem.ingredient as Record<string, unknown> | undefined)?.name ?? 'Ingrediente')).join(', ') || 'Compra',
          metric: formatCurrency(Number(item.total ?? 0))
        };
      }
    },
    counts: {
      title: 'Registrar conteo',
      successMessage: 'Conteo registrado correctamente.',
      endpoint: 'inventory/counts',
      fields: [],
      rowMapper: (item) => {
        const countItems = item.items as Array<Record<string, unknown>> | undefined;
        const firstItem = countItems?.[0];
        const statuses = new Set((countItems ?? []).map((countItem) => String(countItem.status ?? 'NORMAL')));
        const status = statuses.has('FALTANTE') ? 'Faltante' : statuses.has('SOBRANTE') ? 'Sobrante' : 'Normal';

        return {
          id: String(item.id),
          displayId: shortRecordCode('CONT', item.id),
          name: `Conteo ${String(item.period ?? '')}`,
          status,
          detail: firstItem
            ? `${String((firstItem.ingredient as Record<string, unknown> | undefined)?.name ?? 'Ingrediente')}: sistema ${String(firstItem.systemStock ?? 0)}, contado ${String(firstItem.countedStock ?? 0)}`
            : 'Sin lineas',
          metric: `${String(countItems?.length ?? 0)} lineas`
        };
      }
    },
    recipes: {
      title: 'Crear receta',
      successMessage: 'Receta actualizada correctamente.',
      endpoint: 'inventory/recipes',
      fields: [
        { name: 'menuItemId', label: 'Producto', type: 'select', required: true, options: items },
        { name: 'ingredientId', label: 'Ingrediente', type: 'select', required: true, options: ingredients },
        { name: 'quantity', label: 'Cantidad', type: 'number', required: true },
        { name: 'unit', label: 'Unidad', type: 'text', required: true },
        { name: 'notes', label: 'Notas', type: 'textarea' }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('REC', item.id),
        name: String((item.menuItem as Record<string, unknown> | undefined)?.name ?? 'Receta'),
        status: item.isActive === false ? 'Inactiva' : 'Activa',
        detail: String((item.ingredient as Record<string, unknown> | undefined)?.name ?? item.ingredientId ?? 'Ingrediente'),
        metric: `${String(item.quantity ?? 0)} ${String(item.unit ?? '')}`
      })
    },
    discounts: {
      title: 'Crear descuento',
      successMessage: 'Descuento creado correctamente.',
      endpoint: 'cashier/discounts',
      fields: [
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'type', label: 'Tipo', type: 'select', required: true, options: enumOptions(['PERCENTAGE', 'FIXED_AMOUNT']) },
        { name: 'value', label: 'Valor', type: 'number', required: true },
        { name: 'reason', label: 'Descripcion', type: 'textarea' }
      ],
      rowMapper: (item) => ({
        id: String(item.id),
        displayId: shortRecordCode('DESC', item.id),
        name: String(item.name ?? 'Descuento'),
        status: item.isActive === false ? 'Inactivo' : 'Activo',
        detail: String(item.type ?? 'PERCENTAGE'),
        metric: String(item.value ?? 0)
      })
    },
    cashier: {
      title: 'Crear caja',
      successMessage: 'Caja creada correctamente.',
      endpoint: 'cashier/cash-registers/open',
      listEndpoint: 'cashier/orders/open',
      fields: [
        { name: 'name', label: 'Nombre caja', type: 'text', required: true },
        { name: 'openingAmount', label: 'Monto inicial', type: 'number', required: true, defaultValue: 0 },
        { name: 'notes', label: 'Notas', type: 'textarea' }
      ],
      rowMapper: (item) => ({
        id: String(item.orderNumber ?? item.id),
        displayId: String(item.orderNumber ?? shortRecordCode('ORD', item.id)),
        name: String((item.table as Record<string, unknown> | undefined)?.name ?? item.name ?? 'Orden'),
        status: String(item.status ?? 'OPEN'),
        detail: String((item.waiter as Record<string, unknown> | undefined)?.email ?? 'Caja'),
        metric: formatCurrency(Number(item.total ?? 0))
      })
    },
    settings: {
      title: 'Crear configuracion',
      successMessage: 'Configuración guardada correctamente.',
      endpoint: 'admin/settings',
      fields: [
        { name: 'key', label: 'Clave', type: 'text', required: true, placeholder: 'default_tax_rate' },
        { name: 'label', label: 'Etiqueta', type: 'text', required: true },
        { name: 'value', label: 'Valor', type: 'text', required: true },
        { name: 'group', label: 'Grupo', type: 'text', defaultValue: 'general' },
        { name: 'description', label: 'Descripcion', type: 'textarea' },
        { name: 'isActive', label: 'Activa', type: 'checkbox', defaultValue: true }
      ],
      rowMapper: (item) => ({
        id: String(item.key ?? item.id),
        displayId: String(item.key ?? shortRecordCode('CFG', item.id)),
        name: String(item.label ?? item.key),
        status: item.isActive === false ? 'Inactiva' : 'Activa',
        detail: String(item.value ?? ''),
        metric: String(item.group ?? 'general')
      })
    }
  };
}

function renderField(
  field: FormField,
  resourceRows: Partial<Record<SectionKey, Array<Record<string, unknown>>>>,
  initialValues?: Record<string, unknown> | null
) {
  const options = field.options ?? (
    field.optionSource ? optionList(resourceRows[field.optionSource], field.optionLabel ?? ((item) => String(item.name ?? item.id))) : []
  );
  const defaultValue = initialValues?.[field.name] ?? field.defaultValue;

  if (field.type === 'textarea') {
    return <textarea name={field.name} placeholder={field.placeholder} required={field.required} defaultValue={String(defaultValue ?? '')} />;
  }

  if (field.type === 'select') {
    return (
      <select name={field.name} required={field.required} defaultValue={String(defaultValue ?? options[0]?.value ?? '')}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (field.type === 'checkbox') {
    return <input name={field.name} type="checkbox" defaultChecked={Boolean(defaultValue)} />;
  }

  return (
    <input
      name={field.name}
      type={field.type}
      placeholder={field.placeholder}
      required={field.required}
      defaultValue={defaultValue === undefined || typeof defaultValue === 'boolean' ? undefined : String(defaultValue)}
    />
  );
}

function isEditableResourceSection(section: SectionKey): section is EditableResourceSection {
  return editableResourceSections.includes(section as EditableResourceSection);
}

function shortRecordCode(prefix: string, value: unknown) {
  const raw = String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${raw || 'NUEVO'}`;
}

function normalizeFilterValue(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/s$/, '');
}

function resourceSingularLabel(section: SectionKey) {
  const labels: Partial<Record<SectionKey, string>> = {
    customers: 'Cliente',
    areas: 'Area',
    categories: 'Categoria',
    modifiers: 'Adicional',
    discounts: 'Descuento',
    inventory: 'Ingrediente',
    suppliers: 'Proveedor',
    purchases: 'Compra',
    counts: 'Conteo',
    tables: 'Mesa',
    items: 'Producto'
  };

  return labels[section] ?? 'Registro';
}

function inventoryMovementLabel(type: string) {
  const labels: Record<string, string> = {
    PURCHASE: 'Entrada',
    CONSUMPTION: 'Consumo',
    ADJUSTMENT: 'Ajuste',
    WASTE: 'Merma',
    RETURN: 'Devolucion'
  };

  return labels[type] ?? type;
}

function inventoryMovementSuccessMessage(type: string) {
  const messages: Record<string, string> = {
    PURCHASE: 'Entrada de inventario registrada.',
    CONSUMPTION: 'Consumo manual registrado.',
    ADJUSTMENT: 'Ajuste de inventario registrado.',
    WASTE: 'Merma registrada correctamente.',
    RETURN: 'Devolucion registrada correctamente.'
  };

  return messages[type] ?? 'Movimiento de inventario registrado.';
}

function ingredientSaleReference(ingredientId: string, recipes: Array<Record<string, unknown>>) {
  const prices = recipes
    .filter((recipe) => String(recipe.ingredientId ?? '') === ingredientId)
    .map((recipe) => Number((recipe.menuItem as Record<string, unknown> | undefined)?.price ?? 0))
    .filter((price) => price > 0);

  if (prices.length === 0) {
    return 'Sin plato';
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

function readFormValue(form: FormData, field: FormField) {
  if (field.type === 'checkbox') {
    return form.get(field.name) === 'on';
  }

  const raw = String(form.get(field.name) ?? '').trim();

  if (!raw) {
    return undefined;
  }

  if (field.type === 'number') {
    return Number(raw);
  }

  return raw;
}

function optionList(rows: Array<Record<string, unknown>> | undefined, label: (item: Record<string, unknown>) => string) {
  return (rows ?? []).map((item) => ({
    label: label(item),
    value: String(item.id)
  }));
}

function activeTablesCount(item: Record<string, unknown>) {
  const count = item._count as Record<string, unknown> | undefined;

  if (typeof count?.tables === 'number') {
    return count.tables;
  }

  return Array.isArray(item.tables) ? item.tables.filter((table) => (table as Record<string, unknown>).isActive !== false).length : 0;
}

function enumOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

function contrastRatio(firstHex: string, secondHex: string) {
  const first = relativeLuminance(hexToRgb(firstHex));
  const second = relativeLuminance(hexToRgb(secondHex));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(rgb: [number, number, number]) {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.replace('#', '') : '000000';

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
