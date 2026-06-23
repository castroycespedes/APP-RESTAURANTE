'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@restaurante/ui';
import { AuthGate, routeForRole, useAuth } from './auth-provider';
import {
  AddProductPanel,
  CreateOrderButton,
  CurrentOrderSummary,
  MenuCategoryTabs,
  MenuProductCard,
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
  name: string;
  items?: Array<{
    id: string;
    categoryId: string;
    name: string;
    description?: string | null;
    price: number | string;
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
  WAITING_PAYMENT: { action: 'Ir a caja', icon: '$', label: statusLabels.WAITING_PAYMENT }
};

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

const quickNotes = ['Sin cebolla', 'Sin hielo', 'Termino medio', 'Sin salsa'];

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
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItem[]>([]);
  const [availableModifiers, setAvailableModifiers] = useState<Modifier[]>([]);
  const [feedback, setFeedback] = useState('');
  const [isLoadingOperationalData, setIsLoadingOperationalData] = useState(false);
  const [isLoadingSelectedTable, setIsLoadingSelectedTable] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('Todas');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
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

  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null;
  const activeOrder = selectedTable ? orders.find((order) => order.tableId === selectedTable.id && !isOrderLocked(order)) : undefined;
  const selectedMenuItem = availableMenuItems.find((item) => item.id === selectedMenuItemId) ?? null;
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
  const visibleTables = useMemo(
    () => selectedAreaId === 'Todas' ? tables : tables.filter((table) => table.area === selectedAreaId),
    [selectedAreaId, tables]
  );
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

  const visibleMenu = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return availableMenuItems.filter((item) => {
      const inCategory = item.categoryId === selectedCategoryId;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch);

      return inCategory && matchesSearch && item.isAvailable;
    });
  }, [availableMenuItems, search, selectedCategoryId]);
  const canAddSelectedProduct = Boolean(
    activeOrder &&
      !orderLocked &&
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

  function applyMenuCategories(apiCategories: ApiMenuCategory[]) {
    const nextCategories = apiCategories.map((category) => ({ id: category.id, name: category.name }));
    const nextItems = apiCategories.flatMap((category) =>
      (category.items ?? []).map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description ?? '',
        price: Number(item.price),
        preparationTimeMinutes: item.preparationTimeMinutes ?? 0,
        isAvailable: item.isAvailable
      }))
    );
    const nextModifiers = apiCategories.flatMap((category) =>
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
    setAvailableMenuItems(nextItems);
    setAvailableModifiers(nextModifiers);
    setSelectedCategoryId((current) => nextCategories.some((category) => category.id === current) ? current : nextCategories[0]?.id ?? '');
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
                  status: payload.tableStatus ?? 'CLEANING',
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
      return;
    }

    if (table.openOrderId || table.status === 'OCCUPIED') {
      await loadOpenOrderForTable(tableId);
      return;
    }

    if (table.status !== 'AVAILABLE') {
      setFeedback('Esta mesa no está disponible para abrir pedido.');
      return;
    }

    setGuestCount(Math.max(1, table.capacity));
    setJoinedTableIds([]);
    setPendingOpenTableId(tableId);
  }

  async function selectTable(tableId: string) {
    setSelectedTableId(tableId);
    setCancelItemId(null);
    setCancelReason('');
    setIsMenuSelectorOpen(false);
    window.setTimeout(() => document.querySelector('.waiter-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

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
        return;
      }

      const mappedOrder = mapApiOrder(order);
      setOrders((current) => [...current.filter((item) => item.id !== mappedOrder.id), mappedOrder]);
      setSelectedTableId(tableId);
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
      setFeedback(response.message ?? 'Pedido creado correctamente.');
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

    if (availableModifiers.some((modifier) => modifier.menuItemId === menuItem.id)) {
      setFeedback('Selecciona los adicionales del producto antes de agregarlo.');
      return;
    }

    await addMenuItem(menuItem, { modifierIds: [], notes, quantity: 1 });
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
      setFeedback('Producto agregado al pedido.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo agregar el producto.');
    } finally {
      setSavingAction('');
    }
  }

  function openMenuSelector() {
    setIsMenuSelectorOpen(true);
    window.setTimeout(() => document.querySelector('.menu-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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
      setFeedback('No hay productos pendientes para enviar.');
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
      setFeedback('Pedido enviado a cocina.');
    } catch (error) {
      const message = error instanceof Error && error.message.includes('There are no pending products')
        ? 'No hay productos pendientes para enviar.'
        : 'No se pudo enviar el pedido a cocina.';
      setFeedback(message);
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
      setFeedback('Cuenta solicitada correctamente. Abriendo caja...');
      window.setTimeout(() => window.location.assign(`/caja?orderId=${mappedOrder.id}`), 650);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo solicitar la cuenta.');
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
          <h1>Pedidos</h1>
          <span className="screen-action">Selecciona una mesa para tomar o continuar un pedido.</span>
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

      <section className="waiter-layout">
        <section className="panel tables-panel restaurant-map-panel waiter-map-wide">
          <div className="section-title">
            <h2>Filtrar por area</h2>
            <span>{visibleTables.length} de {tables.length} mesas asignadas</span>
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
        </section>

        {selectedTable && (
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
                      isCreating={isCreatingOrder}
                      disabled={selectedOrder.status === 'PAID' || isCreatingOrder}
                      onOpen={() => void openOrder(selectedTable.id)}
                    />
                  )}
                </div>

                {isLoadingOrder ? (
                  <div className="empty-state compact">Consultando pedido abierto...</div>
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
                      <button className="secondary-action" type="button" onClick={() => window.location.assign(`/caja?orderId=${activeOrder.id}`)}>
                        Esperando pago en caja
                      </button>
                    </div>
                    <CurrentOrderSummary
                      activeOrder={activeOrder}
                      itemStatusLabels={itemStatusLabels}
                      orderLocked={orderLocked}
                      orderWaitingPayment={orderWaitingPayment}
                      isSendingKitchen={isSendingKitchen}
                      isRequestingPayment={isRequestingPayment}
                      subtotal={subtotal ?? 0}
                      table={selectedTable}
                      waiterName={waiterName}
                      onRemoveItem={removeOrderItem}
                      onRequestBill={requestBill}
                      onSendToKitchen={sendToKitchen}
                      onUpdateQuantity={updateQuantity}
                    />
                  </div>
                ) : activeOrder ? (
                  <>
                    {selectedTableInKitchen ? (
                      <div className="table-case-message kitchen">
                        <strong>Pedido en cocina.</strong>
                        <span>Revisa el estado de cocina de los productos enviados y agrega más productos si el cliente lo pide.</span>
                        <div className="case-actions">
                          <button className="secondary-action" type="button" onClick={openMenuSelector}>
                            Agregar más productos
                          </button>
                          <button className="secondary-action" disabled={isRequestingPayment} type="button" onClick={requestBill}>
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
                    isRequestingPayment={isRequestingPayment}
                    subtotal={subtotal ?? 0}
                    table={selectedTable}
                    waiterName={waiterName}
                    onRemoveItem={removeOrderItem}
                    onRequestBill={requestBill}
                    onSendToKitchen={sendToKitchen}
                    onUpdateQuantity={updateQuantity}
                  />
                  </>
                ) : (
                  <div className="table-case-message available">
                    <strong>Esta mesa no tiene pedido activo.</strong>
                    <span>Crea un pedido real para asociarlo a esta mesa.</span>
                    <div className="case-actions">
                      <button
                        className="primary-action"
                        disabled={isCreatingOrder}
                        type="button"
                        onClick={() => createOrderForTable(selectedTable.id)}
                      >
                        {isCreatingOrder ? 'Creando...' : 'Crear pedido'}
                      </button>
                      <button className="secondary-action" type="button" onClick={() => setSelectedTableId('')}>
                        Cancelar selección
                      </button>
                    </div>
                  </div>
                )}

                {activeOrder && !orderLocked && !orderWaitingPayment && (
                  <section className="waiter-menu-flow" aria-label="Menu del pedido">
                    <div className="waiter-menu-toggle-row">
                      <div>
                        <p className="eyebrow">Menu</p>
                        <strong>Agrega productos sin salir de la mesa</strong>
                      </div>
                      <button className="primary-action" type="button" onClick={() => setIsMenuSelectorOpen((current) => !current)}>
                        {isMenuSelectorOpen ? 'Ocultar menu' : 'Abrir menu'}
                      </button>
                    </div>

                    {isMenuSelectorOpen && (
                      <div className="menu-panel embedded">
                        <div className="section-title">
                          <div>
                            <p className="eyebrow">Agregar productos</p>
                            <h2>Menu disponible</h2>
                          </div>
                          <span>Productos activos y disponibles</span>
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
                              onSelectCategory={setSelectedCategoryId}
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
                                  onSelect={(selectedItem) => {
                                    setSelectedMenuItemId(selectedItem.id);
                                    setSelectedModifierIds([]);
                                    setIsMenuSelectorOpen(true);
                                  }}
                                />
                              ))}
                              {visibleMenu.length === 0 && (
                                <div className="empty-menu-alert">No hay productos disponibles en esta categoria o busqueda.</div>
                              )}
                            </div>

                            <AddProductPanel
                              canAdd={canAddSelectedProduct}
                              modifiers={selectedItemModifiers}
                              notes={notes}
                              quantity={quantity}
                              quickNotes={quickNotes}
                              savingAction={savingAction}
                              selectedModifierIds={selectedModifierIds}
                              onAdd={addProduct}
                              onNotesChange={setNotes}
                              onQuantityChange={setQuantity}
                              onToggleModifier={toggleModifier}
                              onUseQuickNote={(note) => setNotes((current) => current ? `${current}, ${note}` : note)}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </>
          </section>
        </SelectedTableOrderPanel>
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
