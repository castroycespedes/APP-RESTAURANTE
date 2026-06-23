'use client';

import { Button } from '@restaurante/ui';
import type { FormEvent, ReactNode } from 'react';

export type TableStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'CLEANING'
  | 'BLOCKED'
  | 'WAITING_KITCHEN'
  | 'READY_TO_SERVE'
  | 'WAITING_PAYMENT';
export type TableShape = 'ROUND' | 'SQUARE' | 'RECTANGLE';
export type VisualTableStatus = TableStatus;
export type OrderItemStatus = 'PENDING' | 'SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type OrderStatus =
  | 'OPEN'
  | 'SENT'
  | 'SENT_TO_KITCHEN'
  | 'IN_PROGRESS'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'WAITING_PAYMENT'
  | 'PAID'
  | 'CANCELLED';

export interface WaiterTable {
  id: string;
  area: string;
  name: string;
  number: string;
  capacity: number;
  status: TableStatus;
  visualStatus?: VisualTableStatus;
  shape: TableShape;
  posX: number;
  posY: number;
  color?: string;
  openOrderId?: string;
  openOrderNumber?: string;
  openOrderStatus?: string;
  openOrderTotal?: number;
  openOrderCreatedAt?: string;
  assignedWaiterId?: string | null;
  assignedWaiterName?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
}

export interface Modifier {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  isRequired: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  preparationTimeMinutes: number;
  isAvailable: boolean;
}

export interface OrderModifier {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  status: OrderItemStatus;
  modifiers: OrderModifier[];
}

export interface Order {
  id: string;
  tableId: string;
  number: string;
  status: OrderStatus;
  createdAt?: string;
  items: OrderItem[];
}

export interface StatusMeta {
  action: string;
  icon: string;
  label: string;
}

export function ToastProvider({
  isError,
  message,
  onClose
}: {
  isError: boolean;
  message: string;
  onClose: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className={isError ? 'app-toast error' : 'app-toast'} role="status">
      <span>{message}</span>
      <button aria-label="Cerrar notificacion" type="button" onClick={onClose}>X</button>
    </div>
  );
}

export function WaiterAreaTabs({
  areas,
  selectedAreaId,
  onSelectArea
}: {
  areas: string[];
  selectedAreaId: string;
  onSelectArea: (areaId: string) => void;
}) {
  return (
    <div className="area-tabs" aria-label="Areas del restaurante" role="tablist">
      {areas.map((area) => (
        <button
          aria-current={area === selectedAreaId ? 'page' : undefined}
          aria-selected={area === selectedAreaId}
          className={area === selectedAreaId ? 'active' : ''}
          key={area}
          role="tab"
          type="button"
          onClick={() => onSelectArea(area)}
        >
          {area}
        </button>
      ))}
    </div>
  );
}

export function TableStatusBadge({ meta, status }: { meta: StatusMeta; status: VisualTableStatus }) {
  return (
    <em>
      <i className={`status-dot ${status.toLowerCase().replaceAll('_', '-')}`} />
      {meta.icon} {meta.label}
    </em>
  );
}

export function TableCard({
  isActive,
  meta,
  occupiedSince,
  onSelect,
  table,
  total,
  visualStatus
}: {
  isActive: boolean;
  meta: StatusMeta;
  occupiedSince?: string;
  onSelect: () => void;
  shape: TableShape;
  table: WaiterTable;
  total?: number;
  visualStatus: VisualTableStatus;
}) {
  const tableLabel = table.name?.trim() || `Mesa ${table.number}`;

  return (
    <button
      aria-current={isActive ? 'true' : undefined}
      aria-pressed={isActive}
      className={`waiter-table-card square ${visualStatus.toLowerCase().replaceAll('_', '-')} ${isActive ? 'active' : ''}`}
      style={{ borderColor: table.color }}
      type="button"
      onClick={onSelect}
    >
      <strong>{tableLabel}</strong>
      <TableStatusBadge meta={meta} status={visualStatus} />
      <small>{table.area}</small>
      <small>{table.capacity} personas</small>
      {total !== undefined && total > 0 && <small>{money(total)}</small>}
      {table.openOrderStatus && <small>{table.openOrderStatus}</small>}
      {occupiedSince && <small>{elapsedLabel(occupiedSince)}</small>}
    </button>
  );
}

export const WaiterTableCard = TableCard;

export function WaiterTableGrid({
  deriveVisualStatus,
  itemTotal,
  orders,
  selectedTableId,
  statusMeta,
  tables,
  onSelectTable
}: {
  deriveVisualStatus: (table: WaiterTable, orders: Order[]) => VisualTableStatus;
  itemTotal: (item: OrderItem) => number;
  orders: Order[];
  selectedTableId: string;
  statusMeta: Record<VisualTableStatus, StatusMeta>;
  tables: WaiterTable[];
  onSelectTable: (tableId: string) => void;
}) {
  const sortedTables = sortWaiterTablesForDisplay(tables, orders, deriveVisualStatus);

  return (
    <div className="waiter-table-grid">
      {sortedTables.map((table) => {
        const visualStatus = deriveVisualStatus(table, orders);
        const cardOrder = orders.find((order) => order.tableId === table.id);
        const cardTotal = cardOrder
          ? cardOrder.items.filter((item) => item.status !== 'CANCELLED').reduce((total, item) => total + itemTotal(item), 0)
          : table.openOrderTotal;
        const occupiedSince = cardOrder?.createdAt ?? table.openOrderCreatedAt;

        return (
          <WaiterTableCard
            isActive={table.id === selectedTableId}
            key={table.id}
            meta={statusMeta[visualStatus]}
            occupiedSince={occupiedSince}
            shape={table.shape}
            table={table}
            total={cardTotal}
            visualStatus={visualStatus}
            onSelect={() => onSelectTable(table.id)}
          />
        );
      })}
    </div>
  );
}

export function TableAreaSection({
  area,
  orders,
  selectedTableId,
  statusMeta,
  tables,
  onSelectTable,
  deriveVisualStatus,
  itemTotal
}: {
  area: string;
  orders: Order[];
  selectedTableId: string;
  statusMeta: Record<VisualTableStatus, StatusMeta>;
  tables: WaiterTable[];
  onSelectTable: (tableId: string) => void;
  deriveVisualStatus: (table: WaiterTable, orders: Order[]) => VisualTableStatus;
  itemTotal: (item: OrderItem) => number;
}) {
  return (
    <section className="restaurant-area-map">
      <header>
        <strong>{area}</strong>
        <span>{tables.length} mesas</span>
      </header>
      {tables.length > 0 ? (
        <WaiterTableGrid
          deriveVisualStatus={deriveVisualStatus}
          itemTotal={itemTotal}
          orders={orders}
          selectedTableId={selectedTableId}
          statusMeta={statusMeta}
          tables={tables}
          onSelectTable={onSelectTable}
        />
      ) : (
        <div className="empty-state compact">No hay mesas en esta area.</div>
      )}
    </section>
  );
}

export function WaiterTablesView({
  isLoading,
  orders,
  selectedTableId,
  statusMeta,
  tablesByArea,
  onSelectTable,
  deriveVisualStatus,
  itemTotal
}: {
  isLoading: boolean;
  orders: Order[];
  selectedTableId: string;
  statusMeta: Record<VisualTableStatus, StatusMeta>;
  tablesByArea: Record<string, WaiterTable[]>;
  onSelectTable: (tableId: string) => void;
  deriveVisualStatus: (table: WaiterTable, orders: Order[]) => VisualTableStatus;
  itemTotal: (item: OrderItem) => number;
}) {
  const areas = Object.entries(tablesByArea).sort(([firstArea], [secondArea]) => firstArea.localeCompare(secondArea, 'es'));

  return (
    <div className="area-map-stack">
      {isLoading && <div className="empty-state compact">Cargando mesas asignadas...</div>}
      {areas.map(([area, areaTables]) => (
        <TableAreaSection
          area={area}
          deriveVisualStatus={deriveVisualStatus}
          itemTotal={itemTotal}
          key={area}
          orders={orders}
          selectedTableId={selectedTableId}
          statusMeta={statusMeta}
          tables={areaTables}
          onSelectTable={onSelectTable}
        />
      ))}
      {!isLoading && areas.length === 0 && (
        <div className="empty-state compact">No tienes mesas asignadas.</div>
      )}
    </div>
  );
}

export function OpenOrderButton({
  activeOrder,
  disabled,
  isCreating = false,
  onOpen
}: {
  activeOrder?: Order;
  disabled: boolean;
  isCreating?: boolean;
  onOpen: () => void;
}) {
  return (
    <Button onClick={onOpen} disabled={disabled}>
      {isCreating ? 'Creando...' : activeOrder ? 'Continuar pedido' : 'Crear pedido'}
    </Button>
  );
}

export const CreateOrderButton = OpenOrderButton;

export function SendToKitchenButton({
  disabled,
  isSending,
  onSend
}: {
  disabled: boolean;
  isSending: boolean;
  onSend: () => void;
}) {
  return (
    <Button onClick={onSend} disabled={disabled}>
      {isSending ? 'Enviando...' : 'Enviar a cocina'}
    </Button>
  );
}

export function RequestPaymentButton({
  disabled,
  isRequesting,
  onRequest
}: {
  disabled: boolean;
  isRequesting: boolean;
  onRequest: () => void;
}) {
  return (
    <button className="secondary-action" disabled={disabled} type="button" onClick={onRequest}>
      {isRequesting ? 'Solicitando...' : 'Pedir cuenta'}
    </button>
  );
}

export function OrderSummary({
  activeOrder,
  itemStatusLabels,
  orderLocked,
  orderWaitingPayment,
  subtotal,
  table,
  waiterName,
  isSendingKitchen = false,
  isRequestingPayment = false,
  onRequestBill,
  onSendToKitchen,
  onRemoveItem,
  onUpdateQuantity
}: {
  activeOrder: Order;
  itemStatusLabels: Record<OrderItemStatus, string>;
  orderLocked: boolean;
  orderWaitingPayment: boolean;
  subtotal: number;
  table?: WaiterTable | null;
  waiterName: string;
  isSendingKitchen?: boolean;
  isRequestingPayment?: boolean;
  onRequestBill: () => void;
  onSendToKitchen: () => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}) {
  const groupedItems = orderItemGroups
    .map((group) => ({
      ...group,
      items: activeOrder.items.filter((item) => group.statuses.includes(item.status))
    }))
    .filter((group) => group.items.length > 0);
  const discountTotal = 0;
  const total = subtotal - discountTotal;

  return (
    <>
      <section className="order-summary-header" aria-label="Resumen del pedido">
        <div>
          <span>Pedido</span>
          <strong>{activeOrder.number}</strong>
        </div>
        <div>
          <span>Mesa</span>
          <strong>{table ? `Mesa ${table.number}` : activeOrder.tableId}</strong>
        </div>
        <div>
          <span>Mesero</span>
          <strong>{table?.assignedWaiterName || waiterName}</strong>
        </div>
        <div>
          <span>Estado</span>
          <strong>{activeOrder.status}</strong>
        </div>
      </section>

      <div className="order-items">
        {groupedItems.map((group) => (
          <section className="order-item-group" key={group.key}>
            <header>
              <strong>{group.label}</strong>
              <span>{group.items.length} productos</span>
            </header>
            {group.items.map((item) => {
              const canEditPending = item.status === 'PENDING';
              const canCancelSent = item.status !== 'PENDING' && item.status !== 'SERVED' && item.status !== 'CANCELLED';

              return (
                <article className="order-item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>Cantidad: {item.quantity} - Unitario: {money(item.unitPrice)}</span>
                    <span>Adicionales: {item.modifiers.map((modifier) => modifier.name).join(', ') || 'Sin adicionales'}</span>
                    <span>Notas: {item.notes || 'Sin notas'}</span>
                  </div>
                  <div className="quantity-control">
                    <button type="button" disabled={!canEditPending} onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>
                      -
                    </button>
                    <strong>{item.quantity}</strong>
                    <button type="button" disabled={!canEditPending} onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                  <span className={`item-status ${item.status.toLowerCase()}`}>{itemStatusLabels[item.status]}</span>
                  <strong>{money(itemTotal(item))}</strong>
                  <button
                    className="icon-action"
                    type="button"
                    disabled={!canEditPending && !canCancelSent}
                    onClick={() => onRemoveItem(item.id)}
                    title={canEditPending ? 'Quitar producto pendiente' : canCancelSent ? 'Cancelar producto enviado con motivo' : 'Sin acciones disponibles'}
                  >
                    {canEditPending ? 'Quitar' : canCancelSent ? 'Cancelar' : '-'}
                  </button>
                </article>
              );
            })}
          </section>
        ))}
        {groupedItems.length === 0 && <div className="empty-state compact">No hay productos agregados.</div>}
      </div>

      <footer className="order-total">
        <div>
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
          <span>Descuentos: {money(discountTotal)}</span>
          <span>Total: {money(total)}</span>
        </div>
        <SendToKitchenButton
          disabled={orderLocked || isSendingKitchen || !activeOrder.items.some((item) => item.status === 'PENDING')}
          isSending={isSendingKitchen}
          onSend={onSendToKitchen}
        />
        <RequestPaymentButton
          disabled={orderWaitingPayment || activeOrder.status === 'PAID'}
          isRequesting={isRequestingPayment}
          onRequest={onRequestBill}
        />
      </footer>
    </>
  );
}

export const CurrentOrderSummary = OrderSummary;

export interface SelectedTableOrderPanelProps {
  children: ReactNode;
}

export function SelectedTableOrderPanel({ children }: SelectedTableOrderPanelProps) {
  return <section className="waiter-workbench" aria-label="Panel operativo del pedido">{children}</section>;
}

export function WaiterOrdersPage({ children }: { children: ReactNode }) {
  return <main className="waiter-shell">{children}</main>;
}

const orderItemGroups: Array<{ key: string; label: string; statuses: OrderItemStatus[] }> = [
  { key: 'pending', label: 'Pendientes de enviar', statuses: ['PENDING'] },
  { key: 'sent', label: 'Enviados a cocina', statuses: ['SENT'] },
  { key: 'preparing', label: 'En preparacion', statuses: ['PREPARING'] },
  { key: 'ready', label: 'Listos', statuses: ['READY', 'SERVED'] },
  { key: 'cancelled', label: 'Cancelados', statuses: ['CANCELLED'] }
];

export function ProductCategoryTabs({
  categories,
  selectedCategoryId,
  onSelectCategory
}: {
  categories: MenuCategory[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}) {
  return (
    <div className="category-tabs">
      {categories.map((category) => (
        <button
          className={category.id === selectedCategoryId ? 'active' : ''}
          key={category.id}
          type="button"
          onClick={() => onSelectCategory(category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

export const MenuCategoryTabs = ProductCategoryTabs;

export function MenuProductCard({
  isActive,
  canQuickAdd,
  isSaving,
  item,
  onQuickAdd,
  onSelect
}: {
  isActive: boolean;
  canQuickAdd: boolean;
  isSaving: boolean;
  item: MenuItem;
  onQuickAdd: (item: MenuItem) => void;
  onSelect: (item: MenuItem) => void;
}) {
  return (
    <article className={isActive ? 'product-card active' : 'product-card'}>
      <button className="product-card-main" type="button" onClick={() => onSelect(item)}>
        <strong>{item.name}</strong>
        <span>{item.description}</span>
        <em>{money(item.price)}</em>
      </button>
      <button
        className="quick-add-button"
        type="button"
        disabled={!canQuickAdd || isSaving}
        onClick={() => onQuickAdd(item)}
      >
        {isSaving ? 'Agregando...' : 'Agregar'}
      </button>
    </article>
  );
}

export function AddProductToOrderModal({
  canAdd,
  modifiers,
  notes,
  quantity,
  quickNotes,
  savingAction,
  selectedModifierIds,
  onAdd,
  onNotesChange,
  onQuantityChange,
  onToggleModifier,
  onUseQuickNote
}: {
  canAdd: boolean;
  modifiers: Modifier[];
  notes: string;
  quantity: number;
  quickNotes: string[];
  savingAction: string;
  selectedModifierIds: string[];
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  onNotesChange: (notes: string) => void;
  onQuantityChange: (quantity: number) => void;
  onToggleModifier: (modifierId: string) => void;
  onUseQuickNote: (note: string) => void;
}) {
  return (
    <form className="add-form" onSubmit={onAdd}>
      <div className="form-grid">
        <label>
          Cantidad
          <input
            min="1"
            type="number"
            value={quantity}
            onChange={(event) => onQuantityChange(Number(event.target.value))}
          />
        </label>
        <label>
          Notas
          <input
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="sin cebolla, sin hielo"
          />
        </label>
      </div>
      <div className="quick-notes">
        {quickNotes.map((note) => (
          <button key={note} type="button" onClick={() => onUseQuickNote(note)}>
            {note}
          </button>
        ))}
      </div>

      <div className="modifier-list">
        {modifiers.map((modifier) => (
          <label key={modifier.id}>
            <input
              checked={selectedModifierIds.includes(modifier.id)}
              type="checkbox"
              onChange={() => onToggleModifier(modifier.id)}
            />
            <span>{modifier.name}</span>
            <em>{modifier.price > 0 ? money(modifier.price) : 'Sin costo'}</em>
          </label>
        ))}
      </div>
      <Button disabled={!canAdd || savingAction === 'add-product'}>
        {savingAction === 'add-product' ? 'Agregando...' : 'Agregar producto'}
      </Button>
    </form>
  );
}

export const AddProductPanel = AddProductToOrderModal;
export const ProductModifiersModal = AddProductToOrderModal;

function sortWaiterTablesForDisplay(
  tables: WaiterTable[],
  orders: Order[],
  deriveVisualStatus: (table: WaiterTable, orders: Order[]) => VisualTableStatus
) {
  return [...tables].sort((first, second) => {
    const firstStatus = deriveVisualStatus(first, orders);
    const secondStatus = deriveVisualStatus(second, orders);
    const statusSort = waiterStatusPriority(firstStatus) - waiterStatusPriority(secondStatus);

    return statusSort || compareWaiterTables(first, second);
  });
}

function waiterStatusPriority(status: VisualTableStatus) {
  const priorities: Record<VisualTableStatus, number> = {
    WAITING_PAYMENT: 0,
    READY_TO_SERVE: 1,
    WAITING_KITCHEN: 2,
    OCCUPIED: 3,
    RESERVED: 4,
    CLEANING: 5,
    AVAILABLE: 6,
    BLOCKED: 7
  };

  return priorities[status] ?? 8;
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

function elapsedLabel(dateValue: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(dateValue).getTime()) / 60000));

  if (elapsedMinutes < 1) {
    return 'Ahora';
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min`;
  }

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function itemTotal(item: OrderItem) {
  const modifiersTotal = item.modifiers.reduce((total, modifier) => total + modifier.price, 0);
  return (item.unitPrice + modifiersTotal) * item.quantity;
}

function money(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}
