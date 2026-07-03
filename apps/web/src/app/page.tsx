'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@restaurante/ui';
import { AuthGate, routeForRole, useAuth } from './auth-provider';
import {
  ActionResultFocus,
  AddProductPanel,
  CreateOrderButton,
  CurrentOrderSummary,
  MenuCategoryTabs,
  MenuProductCard,
  OperationalFocus,
  ProductSubcategoryTabs,
  SelectedTableOrderPanel,
  ToastProvider,
  WaiterAreaTabs,
  WaiterOrdersPage as WaiterOrdersLayout,
  WaiterTablesView,
  type MenuCategory,
  type MenuItem,
  type Modifier,
  type Order,
  type OrderItem,
  type OrderItemStatus,
  type OrderStatus,
  type TableShape,
  type TableStatus,
  type VisualTableStatus,
  type WaiterTable
} from './components/pos/waiter-components';

interface ApiTable {
  id: string;
  diningArea?: { name: string } | null;
  name: string;
  number: string;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  posX: number;
  posY: number;
  color?: string | null;
  assignedWaiterId?: string | null;
  assignedWaiter?: { firstName?: string | null; lastName?: string | null; email: string } | null;
  orders?: Array<{ id: string; orderNumber: string; status: string; total: number | string; createdAt: string }>;
}

interface ApiMenuCategory {
  id: string;
  parentId?: string | null;
  name: string;
  children?: ApiMenuCategory[];
  items?: Array<{
    id: string;
    categoryId: string;
    name: string;
    description?: string | null;
    price: number | string;
    imageUrl?: string | null;
    preparationTimeMinutes?: number | null;
    isAvailable: boolean;
    modifiers?: Array<{
      id: string;
      menuItemId: string;
      name: string;
      priceDelta: number | string;
      isRequired: boolean;
    }>;
  }>;
}

interface ApiOrder {
  id: string;
  tableId: string;
  orderNumber: string;
  status: string;
  createdAt?: string;
  items: Array<{
    id: string;
    menuItemId: string;
    quantity: number;
    unitPrice: number | string;
    notes?: string | null;
    status: OrderItemStatus;
    menuItem?: { name: string };
    modifiers: Array<{
      menuItemModifierId?: string | null;
      nameSnapshot: string;
      priceDelta: number | string;
    }>;
  }>;
}

interface ApiOpenTableResponse {
  data?: {
    order: ApiOrder;
    table?: Partial<ApiTable>;
  };
  order?: ApiOrder;
  table?: Partial<ApiTable>;
  message?: string;
}

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

interface ApiModifierEnvelope {
  data: Array<{
    id: string;
    menuItemId: string;
    name: string;
    price: number | string;
    isRequired: boolean;
  }>;
  message?: string;
}

type ActiveFocus =
  | 'NONE'
  | 'AVAILABLE_TABLE'
  | 'CURRENT_ORDER'
  | 'MENU'
  | 'PRODUCT_DETAIL'
  | 'ORDER_SUMMARY'
  | 'SEND_TO_KITCHEN_CONFIRM'
  | 'REQUEST_PAYMENT_CONFIRM'
  | 'EXIT_CONFIRM'
  | 'CLEANING_TABLE'
  | 'BLOCKED_TABLE';

const statusLabels: Record<TableStatus, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  CLEANING: 'Limpieza',
  BLOCKED: 'Bloqueada',
  WAITING_KITCHEN: 'En cocina',
  READY_TO_SERVE: 'Listo para servir',
  WAITING_PAYMENT: 'Cuenta solicitada'
};

const tableStatusMeta: Record<VisualTableStatus, { action: string; icon: string; label: string }> = {
  AVAILABLE: { action: 'Abrir pedido', icon: '✓', label: statusLabels.AVAILABLE },
  OCCUPIED: { action: 'Ver pedido', icon: '●', label: statusLabels.OCCUPIED },
  RESERVED: { action: 'Ver reserva', icon: '◷', label: statusLabels.RESERVED },
  CLEANING: { action: 'Esperar limpieza', icon: '⌁', label: statusLabels.CLEANING },
  BLOCKED: { action: 'No operar', icon: '!', label: statusLabels.BLOCKED },
  WAITING_KITCHEN: { action: 'Ver cocina', icon: '◴', label: statusLabels.WAITING_KITCHEN },
  READY_TO_SERVE: { action: 'Entregar', icon: '↗', label: statusLabels.READY_TO_SERVE },
  WAITING_PAYMENT: { action: 'Cuenta enviada', icon: '$', label: statusLabels.WAITING_PAYMENT }
};

tableStatusMeta.RESERVED.action = 'Crear pedido desde reserva';

const itemStatusLabels: Record<OrderItemStatus, string> = {
  PENDING: 'Pendiente',
  SENT: 'Enviada',
  PREPARING: 'Preparando',
  READY: 'Lista',
  SERVED: 'Servida',
  CANCELLED: 'Cancelada'
};

const orderStatusLabels: Record<OrderStatus, string> = {
  OPEN: 'Abierta',
  SENT: 'Enviada',
  SENT_TO_KITCHEN: 'Enviada',
  IN_PROGRESS: 'En preparacion',
  PREPARING: 'En preparacion',
  READY: 'Lista',
  SERVED: 'Servida',
  WAITING_PAYMENT: 'Cuenta solicitada',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada'
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function itemTotal(item: OrderItem) {
  const modifiersTotal = item.modifiers.reduce((total, modifier) => total + modifier.price, 0);
  return (item.unitPrice + modifiersTotal) * item.quantity;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function isOrderLocked(order: Order) {
  return order.status === 'PAID' || order.status === 'CANCELLED';
}

function orderLockedMessage(order: Order) {
  if (order.status === 'WAITING_PAYMENT') {
    return 'El pedido está en cuenta solicitada. No se pueden agregar productos.';
  }

  if (order.status === 'PAID') {
    return 'El pedido ya está pagado y no se puede editar.';
  }

  return 'El pedido no se puede editar.';
}

function isErrorMessage(message: string) {
  return message.startsWith('Error') || message.startsWith('No se pudo') || message.startsWith('Debes') || message.startsWith('Selecciona');
}

function toastDuration(message: string) {
  return isErrorMessage(message) ? 5000 : 3000;
}

export default function WaiterOrdersPage() {
  const { accessToken, logout, refreshAccessToken, user } = useAuth();
  const canUseApi = Boolean(accessToken);
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuSubcategories, setMenuSubcategories] = useState<MenuCategory[]>([]);
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItem[]>([]);
  const [availableModifiers, setAvailableModifiers] = useState<Modifier[]>([]);
  const [feedback, setFeedback] = useState('');
  const [isLoadingOperationalData, setIsLoadingOperationalData] = useState(false);
  const [isLoadingSelectedTable, setIsLoadingSelectedTable] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('Todas');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<VisualTableStatus | 'ALL'>('ALL');
  const [tableSearch, setTableSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [pendingOpenTableId, setPendingOpenTableId] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [joinedTableIds, setJoinedTableIds] = useState<string[]>([]);
  const [cancelItemId, setCancelItemId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isMenuSelectorOpen, setIsMenuSelectorOpen] = useState(false);
  const [isSendKitchenFocusOpen, setIsSendKitchenFocusOpen] = useState(false);
  const [isRequestPaymentFocusOpen, setIsRequestPaymentFocusOpen] = useState(false);
  const [activeFocus, setActiveFocus] = useState<ActiveFocus>('NONE');
  const [previousFocusStack, setPreviousFocusStack] = useState<ActiveFocus[]>([]);
  const [exitTargetFocus, setExitTargetFocus] = useState<ActiveFocus>('NONE');
  const [blockReason, setBlockReason] = useState('');
  const [actionResult, setActionResult] = useState<{ title: string; description?: string; isError?: boolean } | null>(null);

  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null;
  const activeOrder = selectedTable ? orders.find((order) => order.tableId === selectedTable.id && !isOrderLocked(order)) : undefined;
  const selectedMenuItem = availableMenuItems.find((item) => item.id === selectedMenuItemId) ?? null;
  const visibleSubcategories = useMemo(
    () => menuSubcategories.filter((subcategory) => subcategory.parentId === selectedCategoryId),
    [menuSubcategories, selectedCategoryId]
  );
  const selectedItemModifiers = selectedMenuItem ? availableModifiers.filter((modifier) => modifier.menuItemId === selectedMenuItem.id) : [];
  const pendingOpenTable = tables.find((table) => table.id === pendingOpenTableId) ?? null;
  const joinableTables = pendingOpenTable
    ? tables.filter((table) => table.id !== pendingOpenTable.id && table.area === pendingOpenTable.area && table.status === 'AVAILABLE' && !table.assignedWaiterId)
    : [];
  const joinedCapacity = joinableTables
    .filter((table) => joinedTableIds.includes(table.id))
    .reduce((total, table) => total + table.capacity, 0);
  const selectedServiceCapacity = (pendingOpenTable?.capacity ?? 0) + joinedCapacity;
  const cancelItem = activeOrder?.items.find((item) => item.id === cancelItemId) ?? null;
  const areaOptions = useMemo(() => ['Todas', ...Object.keys(groupTablesByArea(tables)).sort((first, second) => first.localeCompare(second, 'es'))], [tables]);
  const tableMetrics = useMemo(() => {
    const counts = tables.reduce<Record<VisualTableStatus, number>>((totals, table) => {
      const status = deriveVisualTableStatus(table, orders);
      return { ...totals, [status]: (totals[status] ?? 0) + 1 };
    }, {
      AVAILABLE: 0,
      BLOCKED: 0,
      CLEANING: 0,
      OCCUPIED: 0,
      READY_TO_SERVE: 0,
      RESERVED: 0,
      WAITING_KITCHEN: 0,
      WAITING_PAYMENT: 0
    });

    return {
      total: tables.length,
      counts
    };
  }, [orders, tables]);
  const visibleTables = useMemo(() => {
    const normalizedSearch = tableSearch.trim().toLowerCase();

    return tables.filter((table) => {
      const matchesArea = selectedAreaId === 'Todas' || table.area === selectedAreaId;
      const visualStatus = deriveVisualTableStatus(table, orders);
      const matchesStatus = selectedStatusFilter === 'ALL' || visualStatus === selectedStatusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        table.name.toLowerCase().includes(normalizedSearch) ||
        table.number.toLowerCase().includes(normalizedSearch) ||
        table.area.toLowerCase().includes(normalizedSearch) ||
        (table.assignedWaiterName ?? '').toLowerCase().includes(normalizedSearch);

      return matchesArea && matchesStatus && matchesSearch;
    });
  }, [orders, selectedAreaId, selectedStatusFilter, tableSearch, tables]);
  const tablesByArea = useMemo(() => groupTablesByArea(visibleTables), [visibleTables]);
  const waiterName = user?.email ?? 'Mesero';
  const dashboardRoute = user ? routeForRole(user.role) : '/login';
  const orderLocked = Boolean(activeOrder && isOrderLocked(activeOrder));
  const orderWaitingPayment = activeOrder?.status === 'WAITING_PAYMENT';
  const selectedVisualStatus = selectedTable ? deriveVisualTableStatus(selectedTable, orders) : null;
  const selectedTableUnavailable = selectedVisualStatus === 'BLOCKED' || selectedVisualStatus === 'CLEANING';
  const selectedTableWaitingPayment = selectedVisualStatus === 'WAITING_PAYMENT' || activeOrder?.status === 'WAITING_PAYMENT';
  const selectedTableInKitchen = selectedVisualStatus === 'WAITING_KITCHEN' || selectedVisualStatus === 'READY_TO_SERVE';
  const pendingKitchenItems = activeOrder?.items.filter((item) => item.status === 'PENDING').length ?? 0;
  const deliverableKitchenItems = activeOrder?.items.filter((item) => item.status === 'SENT' || item.status === 'PREPARING' || item.status === 'READY').length ?? 0;

  const visibleMenu = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const activeCategoryId = selectedSubcategoryId || selectedCategoryId;

    return availableMenuItems.filter((item) => {
      const inCategory = item.categoryId === activeCategoryId;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch);

      return inCategory && matchesSearch && item.isAvailable;
    });
  }, [availableMenuItems, search, selectedCategoryId, selectedSubcategoryId]);
  const canAddSelectedProduct = Boolean(
    activeOrder &&
      !orderLocked &&
      activeOrder.status !== 'WAITING_PAYMENT' &&
      selectedMenuItem &&
      selectedMenuItem.isAvailable &&
      visibleMenu.some((item) => item.id === selectedMenuItem.id)
  );
  const selectedOrder = activeOrder;
  const isLoadingTables = isLoadingOperationalData;
  const isLoadingOrder = isLoadingSelectedTable;
  const isCreatingOrder = savingAction === 'open-order';
  const isAddingProduct = savingAction === 'add-product';
  const isSendingKitchen = savingAction === 'send-kitchen';
  const isMarkingServed = savingAction === 'mark-served';
  const isRequestingPayment = savingAction === 'request-payment';

  async function fetchWithAuth(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
    const storedToken = window.localStorage.getItem('accessToken') ?? accessToken;
    const requestHeaders = init.headers ?? {};
    const firstResponse = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...requestHeaders,
        ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {})
      }
    });

    if (firstResponse.status !== 401) {
      return firstResponse;
    }

    const refreshedToken = await refreshAccessToken();

    if (!refreshedToken) {
      return firstResponse;
    }

    return fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...requestHeaders,
        Authorization: `Bearer ${refreshedToken}`
      }
    });
  }

  function showActionResult(title: string, description?: string, isError = false) {
    setActionResult({ title, description, isError });
  }

  function clearFocusStack() {
    setPreviousFocusStack([]);
  }

  function openFocus(nextFocus: ActiveFocus) {
    setActiveFocus(nextFocus);
    clearFocusStack();
  }

  function goToFocus(nextFocus: ActiveFocus) {
    setPreviousFocusStack((current) => (activeFocus !== 'NONE' ? [...current, activeFocus] : current));
    setActiveFocus(nextFocus);
  }

  function goBackFocus() {
    setPreviousFocusStack((current) => {
      const nextStack = [...current];
      const previousFocus = nextStack.pop() ?? 'NONE';
      setActiveFocus(previousFocus);

      if (previousFocus === 'NONE') {
        setSelectedTableId('');
      }

      return nextStack;
    });
  }

  function closeFocus() {
    setActiveFocus('NONE');
    setSelectedTableId('');
    setSelectedMenuItemId('');
    setSelectedModifierIds([]);
    setNotes('');
    setQuantity(1);
    setIsMenuSelectorOpen(false);
    setIsSendKitchenFocusOpen(false);
    setIsRequestPaymentFocusOpen(false);
    setExitTargetFocus('NONE');
    clearFocusStack();
  }

  function hasPendingFlowChanges() {
    return Boolean(
      activeOrder?.items.some((item) => item.status === 'PENDING') ||
        selectedModifierIds.length > 0 ||
        notes.trim() ||
        quantity > 1
    );
  }

  function closeFocusWithConfirmation(targetFocus: ActiveFocus = 'NONE') {
    if (hasPendingFlowChanges()) {
      setExitTargetFocus(targetFocus);
      goToFocus('EXIT_CONFIRM');
      return;
    }

    if (targetFocus === 'NONE') {
      closeFocus();
    } else {
      goToFocus(targetFocus);
    }
  }

  function keepAssignedAndClose() {
    closeFocus();
    setFeedback('Pedido conservado correctamente.');
  }

  function discardLocalChangesAndClose() {
    setSelectedMenuItemId('');
    setSelectedModifierIds([]);
    setNotes('');
    setQuantity(1);
    if (exitTargetFocus === 'NONE') {
      closeFocus();
      return;
    }
    setActiveFocus(exitTargetFocus);
    setExitTargetFocus('NONE');
  }

  function applyMenuCategories(apiCategories: ApiMenuCategory[]) {
    const topCategories = apiCategories.filter((category) => !category.parentId);
    const nextCategories = topCategories.map((category) => ({ id: category.id, name: category.name, parentId: category.parentId }));
    const nextSubcategories = topCategories.flatMap((category) =>
      (category.children ?? []).map((subcategory) => ({ id: subcategory.id, name: subcategory.name, parentId: category.id }))
    );
    const allMenuBuckets = apiCategories.flatMap((category) => [category, ...(category.children ?? [])]);
    const nextItems = allMenuBuckets.flatMap((category) =>
      (category.items ?? []).map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description ?? '',
        price: Number(item.price),
        imageUrl: item.imageUrl ?? undefined,
        preparationTimeMinutes: item.preparationTimeMinutes ?? 0,
        isAvailable: item.isAvailable
      }))
    );
    const nextModifiers = allMenuBuckets.flatMap((category) =>
      (category.items ?? []).flatMap((item) =>
        (item.modifiers ?? []).map((modifier) => ({
          id: modifier.id,
          menuItemId: modifier.menuItemId,
          name: modifier.name,
          price: Number(modifier.priceDelta),
          isRequired: modifier.isRequired
        }))
      )
    );

    setMenuCategories(nextCategories);
    setMenuSubcategories(nextSubcategories);
    setAvailableMenuItems(nextItems);
    setAvailableModifiers(nextModifiers);
    setSelectedCategoryId((current) => nextCategories.some((category) => category.id === current) ? current : nextCategories[0]?.id ?? '');
    setSelectedSubcategoryId((current) => {
      const categoryId = nextCategories.some((category) => category.id === selectedCategoryId) ? selectedCategoryId : nextCategories[0]?.id;
      const categorySubcategories = nextSubcategories.filter((subcategory) => subcategory.parentId === categoryId);

      return categorySubcategories.some((subcategory) => subcategory.id === current) ? current : categorySubcategories[0]?.id ?? '';
    });
    setSelectedMenuItemId((current) => nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? '');
  }

  async function refreshMenu() {
    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    try {
      const menuResponse = await fetchWithAuth('/menu-items/available');
      const apiCategories = await readMenuApi(menuResponse);
      applyMenuCategories(apiCategories);
      setFeedback(apiCategories.length > 0 ? 'Menu actualizado correctamente.' : 'No hay productos disponibles para vender.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar el menu.');
    }
  }

  function selectCategory(categoryId: string) {
    const nextSubcategories = menuSubcategories.filter((subcategory) => subcategory.parentId === categoryId);

    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId(nextSubcategories[0]?.id ?? '');
    setSelectedMenuItemId('');
  }

  function selectSubcategory(subcategoryId: string) {
    setSelectedSubcategoryId(subcategoryId);
    setSelectedMenuItemId('');
  }

  async function loadApplicableModifiers(menuItemId: string) {
    const response = await readApi<ApiModifierEnvelope>(await fetchWithAuth(`/menu/items/${menuItemId}/applicable-modifiers`));
    const modifiers = response.data.map((modifier) => ({
      id: modifier.id,
      menuItemId: modifier.menuItemId,
      name: modifier.name,
      price: Number(modifier.price),
      isRequired: modifier.isRequired
    }));

    setAvailableModifiers((current) => [
      ...current.filter((modifier) => modifier.menuItemId !== menuItemId),
      ...modifiers
    ]);

    return modifiers;
  }

  async function selectMenuItemForModifiers(menuItem: MenuItem) {
    setSelectedMenuItemId(menuItem.id);
    setSelectedModifierIds([]);
    setIsMenuSelectorOpen(true);

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    try {
      await loadApplicableModifiers(menuItem.id);
      goToFocus('PRODUCT_DETAIL');
    } catch (error) {
      showActionResult(
        error instanceof Error ? error.message : 'No se pudo consultar adicionales.',
        'Intenta seleccionar el producto de nuevo.',
        true
      );
    }
  }

  useEffect(() => {
    if (!canUseApi || !accessToken) {
      return;
    }

    let ignore = false;

    async function loadOperationalData(silent = false) {
      try {
        if (!silent) {
          setIsLoadingOperationalData(true);
        }
        const tablesEndpoint = user?.role === 'WAITER' ? 'tables/my-tables' : 'tables';
        const [tablesResponse, menuResponse] = await Promise.all([
          fetchWithAuth(`/${tablesEndpoint}`),
          fetchWithAuth('/menu-items/available')
        ]);

        const apiTables = await readApi<ApiTable[]>(tablesResponse);
        const apiCategories = await readMenuApi(menuResponse);
        const apiOrders =
          user?.role === 'WAITER'
            ? await readApi<ApiOrder[]>(await fetchWithAuth('/orders/my'))
            : [];

        if (ignore) {
          return;
        }

        const nextTables = apiTables.map(mapApiTable);

        setTables(nextTables);
        setOrders((currentOrders) => {
          if (user?.role === 'WAITER') {
            return apiOrders.map(mapApiOrder);
          }

          const visibleOrderIds = new Set(nextTables.map((table) => table.openOrderId).filter(Boolean));
          return currentOrders.filter((order) => visibleOrderIds.has(order.id));
        });
        applyMenuCategories(apiCategories);
        setSelectedTableId((current) => nextTables.some((table) => table.id === current) ? current : '');
        setSelectedAreaId((current) => {
          const nextAreas = new Set(nextTables.map((table) => table.area));
          return current === 'Todas' || nextAreas.has(current) ? current : 'Todas';
        });
        setFeedback(silent ? '' : 'Mesas y menu cargados desde el servidor.');
      } catch (error) {
        if (!ignore) {
          setFeedback(error instanceof Error ? error.message : 'Error de conexion con el servidor.');
        }
      } finally {
        if (!ignore && !silent) {
          setIsLoadingOperationalData(false);
        }
      }
    }

    void loadOperationalData();
    const interval = window.setInterval(() => void loadOperationalData(true), 5000);

    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [accessToken, canUseApi, user?.role]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback(''), toastDuration(feedback));

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!actionResult) {
      return;
    }

    const timeout = window.setTimeout(() => setActionResult(null), 3000);

    return () => window.clearTimeout(timeout);
  }, [actionResult]);

  useEffect(() => {
    const categorySubcategories = menuSubcategories.filter((subcategory) => subcategory.parentId === selectedCategoryId);

    if (categorySubcategories.length === 0) {
      if (selectedSubcategoryId) {
        setSelectedSubcategoryId('');
      }
      return;
    }

    if (!categorySubcategories.some((subcategory) => subcategory.id === selectedSubcategoryId)) {
      setSelectedSubcategoryId(categorySubcategories[0].id);
    }
  }, [menuSubcategories, selectedCategoryId, selectedSubcategoryId]);

  useEffect(() => {
    function handleOrderPaid(event: StorageEvent) {
      if (event.key !== 'restaurant-order-paid' || !event.newValue) {
        return;
      }

      try {
        const payload = JSON.parse(event.newValue) as { orderId?: string; tableId?: string; tableStatus?: TableStatus };

        if (!payload.orderId && !payload.tableId) {
          return;
        }

        setOrders((current) => current.filter((order) => order.id !== payload.orderId && order.tableId !== payload.tableId));
        setTables((current) =>
          current.map((table) =>
            table.id === payload.tableId
              ? {
                  ...table,
                  status: payload.tableStatus ?? 'AVAILABLE',
                  openOrderId: undefined,
                  openOrderNumber: undefined,
                  openOrderStatus: undefined,
                  openOrderTotal: undefined,
                  openOrderCreatedAt: undefined
                }
              : table
          )
        );
      } catch {
        setFeedback('La mesa fue cobrada en caja. Actualiza si necesitas sincronizar de nuevo.');
      }
    }

    window.addEventListener('storage', handleOrderPaid);

    return () => window.removeEventListener('storage', handleOrderPaid);
  }, []);

  useEffect(() => {
    const requestedTableId = new URLSearchParams(window.location.search).get('tableId');

    if (!requestedTableId || selectedTableId || tables.length === 0) {
      return;
    }

    if (tables.some((table) => table.id === requestedTableId)) {
      void selectTable(requestedTableId);
    }
  }, [selectedTableId, tables]);

  const subtotal = activeOrder?.items
    .filter((item) => item.status !== 'CANCELLED')
    .reduce((total, item) => total + itemTotal(item), 0);

  async function openOrder(tableId: string) {
    const table = tables.find((item) => item.id === tableId);

    if (!table) {
      return;
    }

    if (table.status === 'BLOCKED') {
      setFeedback('No se puede operar una mesa bloqueada.');
      return;
    }

    const existingOrder = orders.find((order) => order.tableId === tableId);

    if (existingOrder) {
      setSelectedTableId(tableId);
      openFocus('ORDER_SUMMARY');
      return;
    }

    if (table.openOrderId || table.status === 'OCCUPIED') {
      await loadOpenOrderForTable(tableId);
      return;
    }

    if (table.status !== 'AVAILABLE' && table.status !== 'RESERVED') {
      setFeedback('Esta mesa no está disponible para abrir pedido.');
      return;
    }

    setGuestCount(Math.max(1, table.capacity));
    setJoinedTableIds([]);
    setPendingOpenTableId(tableId);
    goToFocus('AVAILABLE_TABLE');
  }

  async function selectTable(tableId: string) {
    const table = tables.find((item) => item.id === tableId);

    setSelectedTableId(tableId);
    setCancelItemId(null);
    setCancelReason('');
    setIsMenuSelectorOpen(false);

    if (table?.status === 'CLEANING') {
      openFocus('CLEANING_TABLE');
    } else if (table?.status === 'BLOCKED') {
      openFocus('BLOCKED_TABLE');
    } else if (table?.status === 'WAITING_PAYMENT') {
      openFocus('CURRENT_ORDER');
      showActionResult('Mesa por cobrar.', 'La cuenta ya fue enviada a caja. No se pueden adicionar productos.');
    } else if (table?.status === 'AVAILABLE' || table?.status === 'RESERVED') {
      openFocus('AVAILABLE_TABLE');
    } else {
      openFocus('CURRENT_ORDER');
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    setIsLoadingSelectedTable(true);

    try {
      const order = await readApi<ApiOrder | null>(await fetchWithAuth(`/tables/${tableId}/current-order`));

      if (order) {
        const mappedOrder = mapApiOrder(order);
        setOrders((current) => [...current.filter((item) => item.id !== mappedOrder.id), mappedOrder]);
        if (table?.status !== 'CLEANING' && table?.status !== 'BLOCKED') {
          setActiveFocus('ORDER_SUMMARY');
        }
        if (mappedOrder.status === 'WAITING_PAYMENT') {
          setActiveFocus('CURRENT_ORDER');
          showActionResult('Mesa por cobrar.', 'La cuenta ya fue enviada a caja. No se pueden adicionar productos.');
        }
      } else {
        setOrders((current) => current.filter((item) => item.tableId !== tableId));
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo consultar el pedido abierto de la mesa.');
    } finally {
      setIsLoadingSelectedTable(false);
    }
  }

  async function loadOpenOrderForTable(tableId: string) {
    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    try {
      const order = await readApi<ApiOrder | null>(await fetchWithAuth(`/tables/${tableId}/current-order`));

      if (!order) {
      setSelectedTableId(tableId);
      openFocus('AVAILABLE_TABLE');
      return;
    }

    const mappedOrder = mapApiOrder(order);
    setOrders((current) => [...current.filter((item) => item.id !== mappedOrder.id), mappedOrder]);
    setSelectedTableId(tableId);
    openFocus('ORDER_SUMMARY');
    setFeedback('Pedido abierto cargado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cargar el pedido de la mesa.');
    }
  }

  async function createOrderForTable(tableId: string, options: { guestCount?: number; joinedTableIds?: string[] } = {}) {
    const table = tables.find((item) => item.id === tableId);

    if (!table) {
      return;
    }

    if (savingAction === 'open-order') {
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    if (user?.role === 'WAITER' && table.assignedWaiterId !== user.id) {
      setFeedback('No puedes abrir pedido en una mesa que no tienes asignada.');
      return;
    }

    if (table.status === 'BLOCKED' || table.status === 'CLEANING') {
      setFeedback('Esta mesa no esta disponible.');
      return;
    }

    setSavingAction('open-order');

    try {
      const response = await readApi<ApiOpenTableResponse>(await fetchWithAuth('/orders/open-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tableId,
          guestCount: options.guestCount,
          joinedTableIds: options.joinedTableIds ?? []
        })
      }));
      const orderPayload = response.data?.order ?? response.order;

      if (!orderPayload) {
        throw new Error('No se pudo leer el pedido creado.');
      }

      const mappedOrder = mapApiOrder(orderPayload);

      setOrders((current) => [...current.filter((item) => item.id !== mappedOrder.id), mappedOrder]);
      setTables((current) =>
        current.map((currentTable) => {
          if (currentTable.id === tableId || (options.joinedTableIds ?? []).includes(currentTable.id)) {
            return { ...currentTable, status: 'OCCUPIED', openOrderId: mappedOrder.id, assignedWaiterId: user?.id ?? currentTable.assignedWaiterId };
          }

          return currentTable;
        })
      );
      setSelectedTableId(tableId);
      setPendingOpenTableId(null);
      setJoinedTableIds([]);
      setIsMenuSelectorOpen(true);
      setActiveFocus('MENU');
      clearFocusStack();
      showActionResult('Pedido creado correctamente.', 'Ya puedes agregar productos a la mesa seleccionada.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el pedido. Revisa que la mesa este asignada y disponible.');
    } finally {
      setSavingAction('');
    }
  }

  async function confirmOpenOrder() {
    if (!pendingOpenTableId) return;

    if (savingAction === 'open-order') {
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    if (pendingOpenTable && guestCount > selectedServiceCapacity) {
      setFeedback('Selecciona otra mesa para unir o baja el numero de personas.');
      return;
    }

    await createOrderForTable(pendingOpenTableId, { guestCount, joinedTableIds });
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMenuItem) {
      return;
    }

    await addMenuItem(selectedMenuItem, {
      modifierIds: selectedModifierIds,
      notes,
      quantity
    });
  }

  async function quickAddMenuItem(menuItem: MenuItem) {
    setSelectedMenuItemId(menuItem.id);
    setSelectedModifierIds([]);
    setIsMenuSelectorOpen(true);

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    try {
      const modifiers = await loadApplicableModifiers(menuItem.id);

      if (modifiers.length > 0) {
        setFeedback('Selecciona las opciones disponibles para este producto.');
        goToFocus('PRODUCT_DETAIL');
        return;
      }

      await addMenuItem(menuItem, { modifierIds: [], notes: '', quantity: 1 });
    } catch (error) {
      showActionResult(
        error instanceof Error ? error.message : 'No se pudo consultar adicionales.',
        'Intenta agregar el producto nuevamente.',
        true
      );
    }
  }

  async function addMenuItem(menuItem: MenuItem, options: { modifierIds: string[]; notes: string; quantity: number }) {
    if (savingAction === 'add-product') {
      return;
    }

    if (!activeOrder || !menuItem.isAvailable) {
      setFeedback('Abre un pedido antes de agregar productos.');
      return;
    }

    if (isOrderLocked(activeOrder)) {
      setFeedback(orderLockedMessage(activeOrder));
      return;
    }

    if (activeOrder.status === 'WAITING_PAYMENT') {
      showActionResult('Mesa por cobrar.', 'La cuenta ya fue enviada a caja. No se pueden adicionar productos.', true);
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    setSavingAction('add-product');

    try {
      const order = await readApi<ApiOrder>(await fetchWithAuth(`/orders/${activeOrder.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          menuItemId: menuItem.id,
          quantity: options.quantity,
          notes: options.notes,
          modifiers: options.modifierIds.map((modifierId) => ({ modifierId }))
        })
      }));
      const mappedOrder = mapApiOrder(order);

      setOrders((current) => current.map((item) => item.id === mappedOrder.id ? mappedOrder : item));
      setSelectedModifierIds([]);
      setNotes('');
      setQuantity(1);
      setActiveFocus('MENU');
      showActionResult('Producto agregado al pedido.', 'El total del pedido fue actualizado.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo agregar el producto.');
    } finally {
      setSavingAction('');
    }
  }

  function openMenuSelector() {
    setIsMenuSelectorOpen(true);
    goToFocus('MENU');
  }

  async function updateQuantity(itemId: string, nextQuantity: number) {
    if (!activeOrder || nextQuantity < 1) {
      return;
    }

    if (isOrderLocked(activeOrder)) {
      setFeedback(orderLockedMessage(activeOrder));
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    try {
      const currentItem = activeOrder.items.find((item) => item.id === itemId);
      const order = await readApi<ApiOrder>(await fetchWithAuth(`/orders/${activeOrder.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quantity: nextQuantity,
          notes: currentItem?.notes
        })
      }));
      const mappedOrder = mapApiOrder(order);

      setOrders((current) => current.map((item) => item.id === mappedOrder.id ? mappedOrder : item));
      setFeedback('Cantidad actualizada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cambiar la cantidad.');
    }
  }

  async function removeOrderItem(itemId: string) {
    if (!activeOrder) {
      return;
    }

    if (isOrderLocked(activeOrder)) {
      setFeedback(orderLockedMessage(activeOrder));
      return;
    }

    const targetItem = activeOrder.items.find((item) => item.id === itemId);

    if (!targetItem) {
      return;
    }

    if (targetItem.status !== 'PENDING') {
      setCancelItemId(itemId);
      setCancelReason('');
      return;
    }

    await confirmRemoveOrderItem(itemId);
  }

  async function confirmRemoveOrderItem(itemId = cancelItemId, reason = cancelReason) {
    if (!activeOrder || !itemId) return;

    const targetItem = activeOrder.items.find((item) => item.id === itemId);

    if (targetItem && targetItem.status !== 'PENDING' && !reason.trim()) {
      setFeedback('Debes escribir un motivo para cancelar un producto enviado.');
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    try {
      const order = await readApi<ApiOrder>(await fetchWithAuth(`/orders/${activeOrder.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      }));
      const mappedOrder = mapApiOrder(order);

      setOrders((current) => current.map((item) => item.id === mappedOrder.id ? mappedOrder : item));
      setCancelItemId(null);
      setCancelReason('');
      setFeedback(targetItem?.status === 'PENDING' ? 'Producto eliminado correctamente.' : 'Cancelacion registrada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : targetItem?.status === 'PENDING' ? 'No se pudo eliminar el producto.' : 'No se pudo cancelar. Puede requerir permiso de manager o admin.');
    }
  }

  async function sendToKitchen() {
    if (!activeOrder) {
      return;
    }

    if (!activeOrder.items.some((item) => item.status === 'PENDING')) {
      showActionResult('No hay pedido para enviar a cocina.', 'No existen productos pendientes en esta mesa. Agrega productos antes de enviar comanda.', true);
      return;
    }

    if (isOrderLocked(activeOrder)) {
      setFeedback(orderLockedMessage(activeOrder));
      return;
    }

    if (savingAction === 'send-kitchen') {
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    setSavingAction('send-kitchen');

    try {
      const order = await readApi<ApiOrder>(await fetchWithAuth(`/orders/${activeOrder.id}/send-to-kitchen`, {
        method: 'POST'
      }));
      const mappedOrder = mapApiOrder(order);

      setOrders((current) => current.map((item) => item.id === mappedOrder.id ? mappedOrder : item));
      setTables((current) => current.map((table) => table.id === activeOrder.tableId ? { ...table, status: 'WAITING_KITCHEN', visualStatus: 'WAITING_KITCHEN' } : table));
      setIsSendKitchenFocusOpen(false);
      setActiveFocus('ORDER_SUMMARY');
      showActionResult('Pedido enviado a cocina correctamente.', 'La comanda quedo registrada y cocina puede verla.');
    } catch (error) {
      const message = error instanceof Error && error.message.includes('There are no pending products')
        ? 'No hay productos pendientes para enviar.'
        : 'No se pudo enviar el pedido a cocina.';
      setFeedback(message);
    } finally {
      setSavingAction('');
    }
  }

  async function markReadyItemsServed() {
    if (!activeOrder || !selectedTable) {
      return;
    }

    if (!activeOrder.items.some((item) => item.status === 'SENT' || item.status === 'PREPARING' || item.status === 'READY')) {
      showActionResult('No hay pedido de cocina para entregar.', 'Primero envia productos a cocina. Cuando el mesero los entregue, puede cerrar este tiempo con Pedido entregado.', true);
      return;
    }

    if (isOrderLocked(activeOrder)) {
      setFeedback(orderLockedMessage(activeOrder));
      return;
    }

    if (savingAction === 'mark-served') {
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    setSavingAction('mark-served');

    try {
      const order = await readApi<ApiOrder>(await fetchWithAuth(`/orders/${activeOrder.id}/mark-served`, {
        method: 'POST'
      }));
      const mappedOrder = mapApiOrder(order);
      const nextVisualStatus = deriveVisualTableStatus(
        { ...selectedTable, status: 'OCCUPIED', visualStatus: 'OCCUPIED' },
        [mappedOrder, ...orders.filter((item) => item.id !== mappedOrder.id)]
      );

      setOrders((current) => current.map((item) => item.id === mappedOrder.id ? mappedOrder : item));
      setTables((current) => current.map((table) => table.id === selectedTable.id ? { ...table, status: nextVisualStatus, visualStatus: nextVisualStatus } : table));
      showActionResult('Pedido entregado.', 'Los productos de cocina quedaron marcados como entregados y el tiempo de entrega deja de correr en la vista operativa.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo marcar el pedido como entregado.');
    } finally {
      setSavingAction('');
    }
  }

  function toggleModifier(modifierId: string) {
    setSelectedModifierIds((current) =>
      current.includes(modifierId) ? current.filter((id) => id !== modifierId) : [...current, modifierId]
    );
  }

  async function requestBill() {
    if (!activeOrder) {
      return;
    }

    if (!activeOrder.items.some((item) => item.status !== 'CANCELLED')) {
      showActionResult('No se registraron productos.', 'No hay productos para enviar a caja. Si el cliente se retira sin consumir, deja la mesa disponible desde gestion de mesas.', true);
      setActiveFocus('CURRENT_ORDER');
      return;
    }

    if (activeOrder.status === 'WAITING_PAYMENT' || selectedTable?.status === 'WAITING_PAYMENT') {
      showActionResult('Cuenta ya solicitada en caja.', 'Esta mesa ya esta por cobrar. No se pueden adicionar productos ni volver a solicitar la cuenta.');
      setActiveFocus('CURRENT_ORDER');
      return;
    }

    if (savingAction === 'request-payment') {
      return;
    }

    if (!accessToken || !selectedTable) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    try {
      setSavingAction('request-payment');
      const order = await readApi<ApiOrder>(await fetchWithAuth(`/orders/${activeOrder.id}/request-payment`, {
        method: 'POST'
      }));
      const mappedOrder = mapApiOrder(order);

      setOrders((current) => current.map((item) => item.id === mappedOrder.id ? mappedOrder : item));
      setTables((current) => current.map((table) => table.id === selectedTable.id ? { ...table, status: 'WAITING_PAYMENT', visualStatus: 'WAITING_PAYMENT' } : table));
      setIsRequestPaymentFocusOpen(false);
      setActiveFocus('CURRENT_ORDER');
      showActionResult('Mesa por cobrar.', 'La cuenta fue enviada a caja. Esta mesa ya no permite adicionar productos.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo solicitar la cuenta.');
    } finally {
      setSavingAction('');
    }
  }

  function openRequestPaymentFocus() {
    if (activeOrder && !activeOrder.items.some((item) => item.status !== 'CANCELLED')) {
      showActionResult('No se registraron productos.', 'No hay productos para enviar a caja. Si el cliente se retira sin consumir, no solicites cuenta.', true);
      return;
    }

    if (activeOrder?.status === 'WAITING_PAYMENT' || selectedTable?.status === 'WAITING_PAYMENT') {
      showActionResult('Cuenta ya solicitada en caja.', 'Esta mesa ya esta por cobrar. No se pueden adicionar productos ni volver a solicitar la cuenta.');
      return;
    }

    goToFocus('REQUEST_PAYMENT_CONFIRM');
  }

  async function markSelectedTableAvailable() {
    if (!selectedTable || savingAction === 'mark-table-available') {
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    setSavingAction('mark-table-available');

    try {
      const table = await readApi<ApiTable>(await fetchWithAuth(`/tables/${selectedTable.id}/mark-available`, {
        method: 'PATCH'
      }));
      const mappedTable = mapApiTable(table);

      setTables((current) => current.map((item) => item.id === mappedTable.id ? mappedTable : item));
      setSelectedTableId('');
      showActionResult('Mesa habilitada correctamente.', 'La mesa quedo disponible para un nuevo pedido.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la informacion.');
    } finally {
      setSavingAction('');
    }
  }

  async function blockSelectedTable() {
    if (!selectedTable || savingAction === 'block-table') {
      return;
    }

    if (!accessToken) {
      setFeedback('Error de conexion con el servidor.');
      return;
    }

    setSavingAction('block-table');

    try {
      const table = await readApi<ApiTable>(await fetchWithAuth(`/tables/${selectedTable.id}/block`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: blockReason })
      }));
      const mappedTable = mapApiTable(table);

      setTables((current) => current.map((item) => item.id === mappedTable.id ? mappedTable : item));
      setSelectedTableId('');
      setBlockReason('');
      setFeedback('Mesa bloqueada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la informacion.');
    } finally {
      setSavingAction('');
    }
  }

  async function signOut() {
    await logout();
    window.location.assign('/login');
  }

  return (
    <AuthGate allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'WAITER']}>
      <WaiterOrdersLayout>
      <header className="topbar">
        <div>
          <nav className="breadcrumb" aria-label="Ruta">
            <button type="button" onClick={() => window.location.assign(dashboardRoute)}>Inicio</button>
            <span>/</span>
            <strong>Mesero</strong>
          </nav>
          <p className="eyebrow">Mesero autenticado: {waiterName}</p>
          <h1>Meseros POS</h1>
          <span className="screen-action">Tarjetas de mesas y atencion rapida para tomar pedidos.</span>
        </div>
        <button className="back-button" type="button" onClick={() => window.location.assign(dashboardRoute)}>
          Volver al dashboard
        </button>
        <button className="secondary-action" type="button" onClick={() => void signOut()}>
          Salir / cambiar usuario
        </button>
        <div className="shift-summary">
          <strong>{orders.length}</strong>
          <span>pedidos activos - Turno activo</span>
        </div>
      </header>
      <aside className="waiter-sidebar" aria-label="Menu operativo">
        <div className="admin-brand">
          <strong>POS Restaurante</strong>
          <span>{user?.role === 'WAITER' ? 'Mesero' : 'Operacion'}</span>
        </div>
        <nav>
          <button className="active" type="button" onClick={() => window.location.assign('/mesero/pedidos')}>
            <span className="nav-icon plate-icon" aria-hidden="true" />
            <span>Pedidos</span>
          </button>
          <button type="button" onClick={() => document.querySelector('.tables-panel')?.scrollIntoView({ behavior: 'smooth' })}>
            <span className="nav-icon table-icon" aria-hidden="true" />
            <span>Mesas</span>
          </button>
          {user?.role !== 'WAITER' && (
            <button type="button" onClick={() => window.location.assign('/admin#tables')}>
              <span className="nav-icon operation-icon" aria-hidden="true" />
              <span>Gestion de mesas</span>
            </button>
          )}
        </nav>
      </aside>
      <ToastProvider isError={isErrorMessage(feedback)} message={feedback} onClose={() => setFeedback('')} />
      {actionResult && (
        <ActionResultFocus
          description={actionResult.description}
          isError={actionResult.isError}
          title={actionResult.title}
          onClose={() => setActionResult(null)}
        />
      )}

      <section className="waiter-layout">
        <section className="panel tables-panel restaurant-map-panel waiter-map-wide">
          <div className="floorplan-device">
            <aside className="floorplan-rail" aria-hidden="true">
              <span className="floorplan-mark">DS</span>
            </aside>
            <div className="floorplan-main">
          <div className="floorplan-topbar">
            <div>
              <p className="eyebrow">Mesas del restaurante</p>
              <h2>Atencion rapida</h2>
              <span>{visibleTables.length} de {tables.length} mesas visibles</span>
            </div>
            <div className="floorplan-search">
              <input
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
                placeholder="Buscar mesa o cliente..."
              />
              <select value={selectedStatusFilter} onChange={(event) => setSelectedStatusFilter(event.target.value as VisualTableStatus | 'ALL')}>
                <option value="ALL">Todos los estados</option>
                {Object.entries(tableStatusMeta).map(([status, meta]) => (
                  <option key={status} value={status}>{meta.label}</option>
                ))}
              </select>
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  setTableSearch('');
                  setSelectedStatusFilter('ALL');
                  setSelectedAreaId('Todas');
                }}
              >
                Limpiar
              </button>
            </div>
          </div>
          <div className="table-metrics-bar" aria-label="Metricas de mesas">
            <button type="button" className={selectedStatusFilter === 'ALL' ? 'active' : ''} onClick={() => setSelectedStatusFilter('ALL')}>
              <strong>{tableMetrics.total}</strong>
              <span>Total mesas</span>
            </button>
            {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BLOCKED', 'WAITING_KITCHEN', 'READY_TO_SERVE', 'WAITING_PAYMENT'] as VisualTableStatus[]).map((status) => (
              <button
                className={selectedStatusFilter === status ? 'active' : ''}
                key={status}
                type="button"
                onClick={() => setSelectedStatusFilter(status)}
              >
                <strong>{tableMetrics.counts[status]}</strong>
                <span>{tableStatusMeta[status].label}</span>
              </button>
            ))}
          </div>
          <WaiterAreaTabs
            areas={areaOptions}
            selectedAreaId={selectedAreaId}
            onSelectArea={(area) => {
              setSelectedAreaId(area);
              setSelectedTableId('');
            }}
          />
          <div className="map-legend">
            {Object.entries(tableStatusMeta).map(([status, meta]) => (
              <span key={status}>
                <i className={`status-dot ${status.toLowerCase().replaceAll('_', '-')}`} />
                {meta.label}
              </span>
            ))}
          </div>
          <WaiterTablesView
            deriveVisualStatus={deriveVisualTableStatus}
            itemTotal={itemTotal}
            isLoading={isLoadingTables}
            orders={orders}
            selectedTableId={selectedTableId}
            statusMeta={tableStatusMeta}
            tablesByArea={tablesByArea}
            onSelectTable={selectTable}
          />
            </div>
            <aside className="floorplan-detail-card" aria-label="Resumen de mesa">
              {selectedTable ? (
                <>
                  <div className="floorplan-detail-header">
                    <div>
                      <strong>Mesa {selectedTable.number}</strong>
                      <span>{selectedTable.area}</span>
                    </div>
                    <em className={`detail-status ${deriveVisualTableStatus(selectedTable, orders).toLowerCase().replaceAll('_', '-')}`}>
                      {tableStatusMeta[deriveVisualTableStatus(selectedTable, orders)].label}
                    </em>
                  </div>
                  <div className="detail-info-grid">
                    <span>{selectedTable.capacity} pax</span>
                    <span>{activeOrder ? orderStatusLabels[activeOrder.status] : 'Sin pedido'}</span>
                    <span>{selectedTable.assignedWaiterName || waiterName}</span>
                  </div>
                  <div className="detail-progress">
                    <div>
                      <span>Progreso del pedido</span>
                      <strong>{activeOrder ? `${Math.round((activeOrder.items.filter((item) => item.status !== 'PENDING').length / Math.max(activeOrder.items.length, 1)) * 100)}%` : '0%'}</strong>
                    </div>
                    <i style={{ width: activeOrder ? `${Math.round((activeOrder.items.filter((item) => item.status !== 'PENDING').length / Math.max(activeOrder.items.length, 1)) * 100)}%` : '0%' }} />
                  </div>
                  <div className="detail-order-total">
                    <span>Pedido actual</span>
                    <strong>{subtotal !== undefined && subtotal > 0 ? formatMoney(subtotal) : 'Sin consumo'}</strong>
                  </div>
                  <div className="detail-action-stack">
                    <button className="primary-action waiter-detail-add" type="button" onClick={() => void openOrder(selectedTable.id)}>
                      + Agregar producto
                    </button>
                    <button
                      className="secondary-action waiter-detail-kitchen"
                      type="button"
                      disabled={!activeOrder || !activeOrder.items.some((item) => item.status === 'PENDING')}
                      onClick={() => setIsSendKitchenFocusOpen(true)}
                    >
                      Enviar a cocina
                    </button>
                    <button className="secondary-action waiter-detail-bill" type="button" onClick={() => openRequestPaymentFocus()}>
                      Solicitar cuenta a caja
                    </button>
                  </div>
                  <p className="waiter-cashier-note">La facturacion y el cobro se realizan unicamente en caja.</p>
                </>
              ) : (
                <div className="detail-empty">
                  <strong>Selecciona una mesa</strong>
                  <span>Veras el estado, consumo y acciones principales sin perder el foco del pedido.</span>
                </div>
              )}
            </aside>
          </div>
        </section>

        {selectedTable && (
        <OperationalFocus
          canGoBack={previousFocusStack.length > 0}
          title={`Mesa ${selectedTable.number}`}
          subtitle={`${tableStatusMeta[deriveVisualTableStatus(selectedTable, orders)].label} - ${selectedTable.area} - ${selectedTable.capacity} personas`}
          onBack={goBackFocus}
          onClose={() => closeFocusWithConfirmation()}
        >
        <SelectedTableOrderPanel>
          <section className="panel order-panel">
            <>
                <div className="order-header">
                  <div>
                    <p className="eyebrow">Mesa seleccionada</p>
                    <h2>
                      Mesa seleccionada: Mesa {selectedTable.number}
                    </h2>
                    <span>
                      {tableStatusMeta[deriveVisualTableStatus(selectedTable, orders)].label} - {selectedTable.area} - {selectedTable.capacity} personas
                    </span>
                    <span>Mesero asignado: {selectedTable.assignedWaiterName || waiterName}</span>
                    {subtotal !== undefined && subtotal > 0 && <span>Total parcial: {formatMoney(subtotal)}</span>}
                    {activeOrder && <em className="order-status-pill">{orderStatusLabels[activeOrder.status]}</em>}
                  </div>
                  {selectedOrder && (
                    <CreateOrderButton
                      activeOrder={selectedOrder}
                      isCreating={isCreatingOrder || isLoadingOrder}
                      disabled={orderLocked || isCreatingOrder || isLoadingOrder}
                      onOpen={() => {
                        if (selectedOrder.status === 'WAITING_PAYMENT') {
                          showActionResult('Mesa por cobrar.', 'La cuenta ya fue enviada a caja. No se pueden adicionar productos.');
                          return;
                        }

                        openMenuSelector();
                      }}
                    />
                  )}
                </div>

                {activeFocus !== 'MENU' && activeFocus !== 'PRODUCT_DETAIL' && (isLoadingOrder ? (
                  <div className="empty-state compact">Consultando pedido abierto...</div>
                ) : selectedVisualStatus === 'CLEANING' ? (
                  <div className="table-case-message cleaning">
                    <strong>Esta mesa esta en limpieza.</strong>
                    <span>Habilitala cuando este lista o mantenla fuera de servicio.</span>
                    <label>
                      Motivo para bloquear, opcional
                      <input
                        value={blockReason}
                        onChange={(event) => setBlockReason(event.target.value)}
                        placeholder="Ej: mesa inestable, reserva interna"
                      />
                    </label>
                    <div className="case-actions">
                      <button
                        className="primary-action"
                        disabled={savingAction === 'mark-table-available'}
                        type="button"
                        onClick={() => void markSelectedTableAvailable()}
                      >
                        {savingAction === 'mark-table-available' ? 'Guardando...' : 'Marcar como disponible'}
                      </button>
                      <button className="secondary-action" type="button" onClick={() => setSelectedTableId('')}>
                        Mantener en limpieza
                      </button>
                      <button
                        className="danger-action"
                        disabled={savingAction === 'block-table'}
                        type="button"
                        onClick={() => void blockSelectedTable()}
                      >
                        {savingAction === 'block-table' ? 'Bloqueando...' : 'Bloquear mesa'}
                      </button>
                    </div>
                  </div>
                ) : selectedTableUnavailable ? (
                  <div className="table-case-message blocked">
                    <strong>Esta mesa no está disponible.</strong>
                    <span>No se puede crear pedido mientras esté bloqueada o en limpieza.</span>
                    <button className="secondary-action" type="button" onClick={() => setSelectedTableId('')}>
                      Cancelar selección
                    </button>
                  </div>
                ) : selectedTableWaitingPayment && activeOrder ? (
                  <div className="table-case-message waiting-payment">
                    <strong>Cuenta solicitada.</strong>
                    <span>Total: {formatMoney(subtotal ?? 0)}. Esperando pago en caja. No se pueden agregar productos a esta mesa.</span>
                    <div className="case-actions">
                      <button className="secondary-action" type="button" onClick={() => document.querySelector('.order-panel')?.scrollIntoView({ behavior: 'smooth' })}>
                        Ver pedido
                      </button>
                      <button
                        className="secondary-action"
                        type="button"
                        onClick={() => showActionResult('Mesa por cobrar.', 'La cuenta ya fue enviada a caja. El cobro debe hacerse desde el modulo Caja con un usuario autorizado.')}
                      >
                        Mesa por cobrar
                      </button>
                    </div>
                    <CurrentOrderSummary
                      activeOrder={activeOrder}
                      itemStatusLabels={itemStatusLabels}
                      orderLocked={orderLocked}
                      orderWaitingPayment={orderWaitingPayment}
                      isSendingKitchen={isSendingKitchen}
                      isMarkingServed={isMarkingServed}
                      isRequestingPayment={isRequestingPayment}
                      subtotal={subtotal ?? 0}
                      table={selectedTable}
                      waiterName={waiterName}
                      onMarkServed={markReadyItemsServed}
                      onRemoveItem={removeOrderItem}
                      onRequestBill={openRequestPaymentFocus}
                      onSendToKitchen={() => goToFocus('SEND_TO_KITCHEN_CONFIRM')}
                      onUpdateQuantity={updateQuantity}
                    />
                  </div>
                ) : activeOrder ? (
                  <>
                    {selectedTableInKitchen ? (
                      <div className="table-case-message kitchen">
                        <strong>Pedido en cocina.</strong>
                        <span>Revisa el estado de cocina de los productos enviados y agrega más productos si el cliente lo pide.</span>
                        <div className="kitchen-review-panel" aria-label="Productos enviados a cocina">
                          {activeOrder.items.filter((item) => item.status !== 'CANCELLED').map((item) => (
                            <article key={item.id}>
                              <div>
                                <strong>{item.quantity} x {item.name}</strong>
                                <span>Preparacion: {item.notes || 'Sin instrucciones especiales'}</span>
                                <span>Adicionales: {item.modifiers.map((modifier) => modifier.name).join(', ') || 'Sin adicionales'}</span>
                              </div>
                              <em>{itemStatusLabels[item.status]}</em>
                            </article>
                          ))}
                        </div>
                        <div className="case-actions">
                          <button className="secondary-action" type="button" onClick={openMenuSelector}>
                            Agregar más productos
                          </button>
                          <button className="served-action" disabled={isMarkingServed || deliverableKitchenItems === 0} type="button" onClick={() => void markReadyItemsServed()}>
                            {isMarkingServed ? 'Marcando...' : `Pedido entregado${deliverableKitchenItems > 0 ? ` (${deliverableKitchenItems})` : ''}`}
                          </button>
                          <button className="secondary-action" disabled={isRequestingPayment} type="button" onClick={openRequestPaymentFocus}>
                            {isRequestingPayment ? 'Solicitando...' : 'Pedir cuenta'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="table-case-message">
                        <strong>Pedido abierto.</strong>
                        <span>{pendingKitchenItems > 0 ? `${pendingKitchenItems} productos pendientes por enviar a cocina.` : 'No hay productos pendientes por enviar.'}</span>
                        <div className="case-actions">
                          <button className="secondary-action" type="button" onClick={openMenuSelector}>
                            Agregar productos
                          </button>
                          <button className="secondary-action" type="button" onClick={() => document.querySelector('.order-panel')?.scrollIntoView({ behavior: 'smooth' })}>
                            Ver detalle completo
                          </button>
                        </div>
                      </div>
                    )}
                  <CurrentOrderSummary
                    activeOrder={activeOrder}
                    itemStatusLabels={itemStatusLabels}
                    orderLocked={orderLocked}
                    orderWaitingPayment={orderWaitingPayment}
                    isSendingKitchen={isSendingKitchen}
                    isMarkingServed={isMarkingServed}
                    isRequestingPayment={isRequestingPayment}
                    subtotal={subtotal ?? 0}
                    table={selectedTable}
                    waiterName={waiterName}
                    onMarkServed={markReadyItemsServed}
                    onRemoveItem={removeOrderItem}
                    onRequestBill={openRequestPaymentFocus}
                    onSendToKitchen={() => goToFocus('SEND_TO_KITCHEN_CONFIRM')}
                    onUpdateQuantity={updateQuantity}
                  />
                  </>
                ) : (
                  <div className={`table-case-message ${selectedVisualStatus === 'RESERVED' ? 'reserved' : 'available'}`}>
                    <strong>{selectedVisualStatus === 'RESERVED' ? 'Esta mesa esta reservada.' : 'Esta mesa no tiene pedido activo.'}</strong>
                    <span>
                      {selectedVisualStatus === 'RESERVED'
                        ? 'Puedes iniciar el pedido cuando el cliente llegue. El abono de la reserva quedara disponible para descontarlo en caja.'
                        : 'Crea un pedido real para asociarlo a esta mesa.'}
                    </span>
                    <div className="case-actions">
                      <button
                        className="primary-action"
                        disabled={isCreatingOrder}
                        type="button"
                        onClick={() => createOrderForTable(selectedTable.id)}
                      >
                        {isCreatingOrder ? 'Creando...' : selectedVisualStatus === 'RESERVED' ? 'Crear pedido desde reserva' : 'Crear pedido'}
                      </button>
                      <button className="secondary-action" type="button" onClick={() => setSelectedTableId('')}>
                        Cancelar selección
                      </button>
                    </div>
                  </div>
                ))}

                {activeOrder && !orderLocked && !orderWaitingPayment && activeFocus === 'MENU' && (
                  <section className="waiter-menu-flow" aria-label="Menu del pedido">
                    <div className="waiter-menu-toggle-row">
                      <div>
                        <p className="eyebrow">Menu</p>
                        <strong>Agrega productos sin salir de la mesa</strong>
                      </div>
                      <button className="secondary-action" type="button" onClick={() => goToFocus('ORDER_SUMMARY')}>
                        Ver pedido
                      </button>
                    </div>

                      <div className="menu-panel embedded">
                        <div className="section-title">
                          <div>
                            <p className="eyebrow">Agregar productos</p>
                            <h2>Menu disponible</h2>
                          </div>
                          <span>Productos activos y disponibles</span>
                        </div>
                        <div className="menu-focus-actions">
                          <button className="secondary-action" type="button" onClick={() => goToFocus('ORDER_SUMMARY')}>
                            Ver pedido
                          </button>
                          <button
                            className="secondary-action"
                            disabled={!activeOrder.items.some((item) => item.status === 'PENDING')}
                            type="button"
                            onClick={() => goToFocus('SEND_TO_KITCHEN_CONFIRM')}
                          >
                            Enviar a cocina
                          </button>
                          <button className="secondary-action" disabled={isRequestingPayment} type="button" onClick={openRequestPaymentFocus}>
                            Pedir cuenta
                          </button>
                        </div>
                        {availableMenuItems.length === 0 ? (
                          <div className="empty-menu-alert menu-empty-state">
                            <strong>No hay productos disponibles para vender</strong>
                            <span>
                              El menu aun no tiene platos activos o todos estan agotados. Solicita al administrador crear productos o activar platos disponibles.
                            </span>
                            {user?.role === 'WAITER' ? (
                              <button className="secondary-action" type="button" onClick={() => void refreshMenu()}>
                                Actualizar menu
                              </button>
                            ) : (
                              <button className="secondary-action" type="button" onClick={() => window.location.assign('/admin#items')}>
                                Ir a crear producto
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto" />
                            <MenuCategoryTabs
                              categories={menuCategories}
                              selectedCategoryId={selectedCategoryId}
                              onSelectCategory={selectCategory}
                            />
                            <ProductSubcategoryTabs
                              subcategories={visibleSubcategories}
                              selectedSubcategoryId={selectedSubcategoryId}
                              onSelectSubcategory={selectSubcategory}
                            />

                            <div className="product-list">
                              {visibleMenu.map((item) => (
                                <MenuProductCard
                                  canQuickAdd={Boolean(activeOrder)}
                                  isActive={item.id === selectedMenuItem?.id}
                                  isSaving={isAddingProduct}
                                  item={item}
                                  key={item.id}
                                  onQuickAdd={quickAddMenuItem}
                                  onSelect={(selectedItem) => void selectMenuItemForModifiers(selectedItem)}
                                />
                              ))}
                              {visibleMenu.length === 0 && (
                                <div className="empty-menu-alert">No hay productos disponibles en esta categoria o busqueda.</div>
                              )}
                            </div>

                          </>
                        )}
                      </div>
                  </section>
                )}

                {activeOrder && selectedMenuItem && activeFocus === 'PRODUCT_DETAIL' && (
                  <section className="menu-panel embedded product-detail-focus" aria-label="Detalle del producto">
                    <div className="section-title">
                      <div>
                        <p className="eyebrow">Producto seleccionado</p>
                        <h2>{selectedMenuItem.name}</h2>
                      </div>
                      <strong>{formatMoney(selectedMenuItem.price)}</strong>
                    </div>
                    <div className="product-detail-grid">
                      <span
                        aria-hidden="true"
                        className="product-photo product-photo-large"
                        style={{ backgroundImage: selectedMenuItem.imageUrl ? `url("${selectedMenuItem.imageUrl}")` : undefined }}
                      />
                      <div>
                        <p>{selectedMenuItem.description || 'Producto disponible para venta.'}</p>
                        {selectedItemModifiers.length === 0 ? (
                          <div className="empty-state compact">Este producto no tiene adicionales configurados.</div>
                        ) : (
                          <span className="screen-action">Selecciona solo los adicionales disponibles para este producto.</span>
                        )}
                      </div>
                    </div>
                    <AddProductPanel
                      canAdd={canAddSelectedProduct}
                      modifiers={selectedItemModifiers}
                      notes={notes}
                      quantity={quantity}
                      savingAction={savingAction}
                      selectedModifierIds={selectedModifierIds}
                      onAdd={addProduct}
                      onNotesChange={setNotes}
                      onQuantityChange={setQuantity}
                      onToggleModifier={toggleModifier}
                    />
                  </section>
                )}
              </>
          </section>
        </SelectedTableOrderPanel>
        </OperationalFocus>
        )}
      </section>
      {pendingOpenTable && (
        <div className="pos-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="open-order-title">
          <section className="pos-modal">
            <h2 id="open-order-title">Tomar pedido</h2>
            <p>Mesa {pendingOpenTable.number} - {pendingOpenTable.name}. Capacidad base: {pendingOpenTable.capacity} personas.</p>
            <label>
              Numero de personas a atender
              <input
                min="1"
                type="number"
                value={guestCount}
                onChange={(event) => setGuestCount(Number(event.target.value))}
              />
            </label>
            {guestCount > pendingOpenTable.capacity && (
              <div className="join-tables-panel">
                <strong>Unir mesas del area {pendingOpenTable.area}</strong>
                <span>Capacidad seleccionada: {selectedServiceCapacity} personas</span>
                {joinableTables.map((table) => (
                  <label key={table.id}>
                    <input
                      checked={joinedTableIds.includes(table.id)}
                      type="checkbox"
                      onChange={() =>
                        setJoinedTableIds((current) =>
                          current.includes(table.id) ? current.filter((id) => id !== table.id) : [...current, table.id]
                        )
                      }
                    />
                    Mesa {table.number} - {table.capacity} personas
                  </label>
                ))}
                {joinableTables.length === 0 && <em>No hay mesas disponibles en esta area para unir.</em>}
              </div>
            )}
            <div className="pos-modal-actions">
              <button className="secondary-action" type="button" onClick={() => setPendingOpenTableId(null)}>Volver</button>
              <Button disabled={isCreatingOrder} type="button" onClick={confirmOpenOrder}>
                {isCreatingOrder ? 'Abriendo...' : 'Asignarme mesa y abrir pedido'}
              </Button>
            </div>
          </section>
        </div>
      )}

      {activeOrder && selectedTable && activeFocus === 'SEND_TO_KITCHEN_CONFIRM' && (
        <div className="pos-modal-backdrop nested-focus" role="dialog" aria-modal="true" aria-labelledby="send-kitchen-title">
          <section className="pos-modal">
            <button className="focus-back" type="button" aria-label="Volver" onClick={goBackFocus}>
              &lt;
            </button>
            <h2 id="send-kitchen-title">Revisar pedido antes de enviar</h2>
            <p>Mesa {selectedTable.number} - Pedido {activeOrder.number}</p>
            <strong>Rectifica cantidades, preparacion y adicionales antes de mandar la comanda.</strong>
            <div className="focus-confirm-list">
              {activeOrder.items.filter((item) => item.status === 'PENDING').map((item) => (
                <article className="send-kitchen-review-item" key={item.id}>
                  <div>
                    <strong>{item.quantity} x {item.name}</strong>
                    <span>Preparacion: {item.notes || 'Sin instrucciones especiales'}</span>
                    <span>Adicionales: {item.modifiers.map((modifier) => modifier.name).join(', ') || 'Sin adicionales'}</span>
                  </div>
                  <em>{formatMoney(itemTotal(item))}</em>
                </article>
              ))}
              {!activeOrder.items.some((item) => item.status === 'PENDING') && (
                <div className="empty-state compact">No hay pedido para enviar a cocina. Agrega productos pendientes antes de mandar comanda.</div>
              )}
            </div>
            <div className="pos-modal-actions">
              <button className="secondary-action" type="button" onClick={goBackFocus}>
                Volver a editar pedido
              </button>
              <Button
                disabled={isSendingKitchen || !activeOrder.items.some((item) => item.status === 'PENDING')}
                type="button"
                onClick={() => void sendToKitchen()}
              >
                {isSendingKitchen ? 'Enviando...' : 'Enviar a cocina'}
              </Button>
            </div>
          </section>
        </div>
      )}

      {activeOrder && selectedTable && activeFocus === 'REQUEST_PAYMENT_CONFIRM' && (
        <div className="pos-modal-backdrop nested-focus" role="dialog" aria-modal="true" aria-labelledby="request-payment-title">
          <section className="pos-modal">
            <button className="focus-back" type="button" aria-label="Volver" onClick={goBackFocus}>
              &lt;
            </button>
            <h2 id="request-payment-title">Enviar cuenta a caja</h2>
            <p>Mesa {selectedTable.number} - Pedido {activeOrder.number}</p>
            <strong>Deseas enviar esta cuenta a caja?</strong>
            {activeOrder.items.some((item) => item.status === 'PENDING') && (
              <div className="empty-menu-alert">Hay productos pendientes sin enviar a cocina.</div>
            )}
            <div className="focus-confirm-list">
              {activeOrder.items.filter((item) => item.status !== 'CANCELLED').map((item) => (
                <article key={item.id}>
                  <span>{item.quantity} x {item.name}</span>
                  <em>{formatMoney(itemTotal(item))}</em>
                </article>
              ))}
            </div>
            <div className="order-total compact-total">
              <span>Total estimado</span>
              <strong>{formatMoney(subtotal ?? 0)}</strong>
            </div>
            <div className="pos-modal-actions">
              <button className="secondary-action" type="button" onClick={goBackFocus}>
                Cancelar
              </button>
              <Button disabled={isRequestingPayment} type="button" onClick={() => void requestBill()}>
                {isRequestingPayment ? 'Enviando...' : 'Enviar cuenta a caja'}
              </Button>
            </div>
          </section>
        </div>
      )}

      {activeFocus === 'EXIT_CONFIRM' && (
        <div className="pos-modal-backdrop nested-focus" role="dialog" aria-modal="true" aria-labelledby="exit-confirm-title">
          <section className="pos-modal">
            <button className="focus-back" type="button" aria-label="Volver" onClick={goBackFocus}>
              &lt;
            </button>
            <h2 id="exit-confirm-title">Deseas seguir con lo asignado?</h2>
            <p>Tienes productos o cambios en este pedido. Puedes conservar lo asignado o descartar solo cambios locales que aun no fueron guardados.</p>
            <div className="pos-modal-actions">
              <Button type="button" onClick={keepAssignedAndClose}>
                Si, conservar
              </Button>
              <button className="danger-action" type="button" onClick={discardLocalChangesAndClose}>
                No, descartar
              </button>
              <button className="secondary-action" type="button" onClick={goBackFocus}>
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}

      {cancelItem && (
        <div className="pos-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cancel-item-title">
          <section className="pos-modal">
            <h2 id="cancel-item-title">Cancelar producto</h2>
            <p>{cancelItem.name} ya fue enviado a cocina. La cancelacion necesita motivo y queda auditada.</p>
            <label>
              Motivo
              <textarea
                autoFocus
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ej: cliente cambio el pedido"
              />
            </label>
            <div className="pos-modal-actions">
              <button className="secondary-action" type="button" onClick={() => setCancelItemId(null)}>Volver</button>
              <button className="danger-action" type="button" onClick={() => confirmRemoveOrderItem()}>
                Confirmar cancelacion
              </button>
            </div>
          </section>
        </div>
      )}
      </WaiterOrdersLayout>
    </AuthGate>
  );
}

function groupTablesByArea(tables: WaiterTable[]) {
  const grouped = tables.reduce<Record<string, WaiterTable[]>>((groups, table) => {
    return {
      ...groups,
      [table.area]: [...(groups[table.area] ?? []), table]
    };
  }, {});

  return Object.fromEntries(
    Object.entries(grouped).map(([area, areaTables]) => [area, [...areaTables].sort(compareWaiterTables)])
  );
}

function compareWaiterTables(first: WaiterTable, second: WaiterTable) {
  const firstNumber = Number(first.number);
  const secondNumber = Number(second.number);
  const firstIsNumeric = Number.isFinite(firstNumber);
  const secondIsNumeric = Number.isFinite(secondNumber);

  if (firstIsNumeric && secondIsNumeric && firstNumber !== secondNumber) {
    return firstNumber - secondNumber;
  }

  return String(first.number || first.name).localeCompare(String(second.number || second.name), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

function deriveVisualTableStatus(table: WaiterTable, orders: Order[]): VisualTableStatus {
  const order = orders.find((item) => item.tableId === table.id);

  if (table.visualStatus === 'WAITING_PAYMENT' || order?.status === 'WAITING_PAYMENT') {
    return 'WAITING_PAYMENT';
  }

  if (table.visualStatus === 'READY_TO_SERVE' || order?.items.some((item) => item.status === 'READY')) {
    return 'READY_TO_SERVE';
  }

  if (table.visualStatus === 'WAITING_KITCHEN' || order?.items.some((item) => item.status === 'SENT' || item.status === 'PREPARING')) {
    return 'WAITING_KITCHEN';
  }

  return table.visualStatus ?? table.status;
}

async function readApi<T>(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    const fallbackMessage = httpStatusMessage(response.status);

    try {
      const payload = JSON.parse(text) as { message?: string | string[] };
      const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
      throw new Error(message || fallbackMessage);
    } catch (error) {
      if (error instanceof Error && error.message !== 'Unexpected end of JSON input') {
        throw error;
      }

      throw new Error(fallbackMessage);
    }
  }

  return (text ? JSON.parse(text) : null) as T;
}

function httpStatusMessage(status: number) {
  if (status === 400) {
    return 'Revisa los datos e intenta nuevamente.';
  }

  if (status === 401) {
    return 'Sesion expirada o token invalido. Inicia sesion nuevamente.';
  }

  if (status === 403) {
    return 'No tienes permiso para realizar esta accion.';
  }

  if (status === 404) {
    return 'No se encontro la informacion solicitada.';
  }

  if (status >= 500) {
    return 'Ocurrio un error en el servidor.';
  }

  return `Error HTTP ${status}`;
}

async function readMenuApi(response: Response) {
  if (response.status === 404) {
    return [];
  }

  if (response.status === 401) {
    throw new Error('Sesion expirada o token invalido. Inicia sesion nuevamente.');
  }

  const payload = await readApi<ApiMenuCategory[] | ApiEnvelope<ApiMenuCategory[]>>(response);

  return Array.isArray(payload) ? payload : payload.data;
}

function mapApiTable(table: ApiTable): WaiterTable {
  const openOrder = table.orders?.[0];

  return {
    id: table.id,
    area: table.diningArea?.name ?? 'Salon principal',
    name: table.name,
    number: table.number,
    capacity: table.capacity,
    status: table.status,
    shape: table.shape,
    posX: table.posX,
    posY: table.posY,
    color: table.color ?? undefined,
    openOrderId: openOrder?.id,
    openOrderNumber: openOrder?.orderNumber,
    openOrderStatus: openOrder?.status,
    openOrderTotal: openOrder ? Number(openOrder.total) : undefined,
    openOrderCreatedAt: openOrder?.createdAt,
    assignedWaiterId: table.assignedWaiterId,
    assignedWaiterName: [table.assignedWaiter?.firstName, table.assignedWaiter?.lastName].filter(Boolean).join(' ') || table.assignedWaiter?.email
  };
}

function mapApiOrder(order: ApiOrder): Order {
  return {
    id: order.id,
    tableId: order.tableId,
    number: order.orderNumber,
    status: mapApiOrderStatus(order.status),
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItem?.name ?? 'Producto',
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      notes: item.notes ?? '',
      status: item.status,
      modifiers: item.modifiers.map((modifier) => ({
        id: modifier.menuItemModifierId ?? modifier.nameSnapshot,
        name: modifier.nameSnapshot,
        price: Number(modifier.priceDelta)
      }))
    }))
  };
}

function mapApiOrderStatus(status: string): OrderStatus {
  if (status === 'SENT_TO_KITCHEN') return 'SENT_TO_KITCHEN';
  if (status === 'PREPARING') return 'PREPARING';
  if (status === 'READY') return 'READY';
  if (status === 'SERVED') return 'SERVED';
  if (status === 'WAITING_PAYMENT') return 'WAITING_PAYMENT';
  if (status === 'PAID') return 'PAID';
  if (status === 'CANCELLED') return 'CANCELLED';

  return 'OPEN';
}
