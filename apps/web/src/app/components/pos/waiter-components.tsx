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
  parentId?: string | null;
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
  imageUrl?: string;
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

export function OperationalFocus({
  canGoBack = false,
  children,
  footer,
  subtitle,
  title,
  onBack,
  onClose
}: {
  canGoBack?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  subtitle?: string;
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="operational-focus-backdrop" role="dialog" aria-modal="true" aria-labelledby="operational-focus-title">
      <section className="operational-focus">
        <header className="focus-header">
          {canGoBack && (
            <button className="focus-back" type="button" aria-label="Volver al foco anterior" onClick={onBack}>
              &lt;
            </button>
          )}
          <div>
            <p className="eyebrow">Foco operativo</p>
            <h2 id="operational-focus-title">{title}</h2>
            {subtitle && <span>{subtitle}</span>}
          </div>
          <button className="focus-close" type="button" aria-label="Cerrar foco" onClick={onClose}>
            X
          </button>
        </header>
        <div className="focus-body">{children}</div>
        {footer && <footer className="focus-footer">{footer}</footer>}
      </section>
    </div>
  );
}

export function ActionResultFocus({
  description,
  isError = false,
  title,
  onClose
}: {
  description?: string;
  isError?: boolean;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="action-result-backdrop" role="dialog" aria-modal="true" aria-labelledby="action-result-title">
      <section className={isError ? 'action-result-focus error' : 'action-result-focus'}>
        <span className="action-result-icon" aria-hidden="true">
          {isError ? '!' : 'OK'}
        </span>
        <h2 id="action-result-title">{title}</h2>
        {description && <p>{description}</p>}
        <button className="primary-action" type="button" onClick={onClose}>
          Continuar
        </button>
      </section>
    </div>
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
  const statusClass = visualStatus.toLowerCase().replaceAll('_', '-');
  const waiterLabel = table.assignedWaiterName?.trim() || 'Sin mesero';
  const elapsed = occupiedSince ? elapsedLabel(occupiedSince) : '00:00';

  return (
    <button
      aria-label={`${tableLabel}, ${meta.label}, ${table.capacity} personas`}
      aria-current={isActive ? 'true' : undefined}
      aria-pressed={isActive}
      className={`waiter-table-card ${table.shape.toLowerCase()} ${statusClass} ${isActive ? 'active' : ''}`}
      style={{ borderColor: table.color }}
      type="button"
      onClick={onSelect}
    >
      <span className="waiter-card-head">
        <span className="waiter-table-number">{table.number}</span>
        <span className="waiter-card-chevron" aria-hidden="true">›</span>
      </span>
      <span className="waiter-table-status">
        <i className={`status-dot ${statusClass}`} />
        {meta.label}
      </span>
      <span className="waiter-card-visual" aria-hidden="true">
        <span className="table-chair top" />
        <span className="table-chair right" />
        <span className="table-chair bottom" />
        <span className="table-chair left" />
        <span className="waiter-table-surface" />
      </span>
      <strong title={tableLabel}>{tableLabel}</strong>
      <span className="waiter-table-meta">
        <small>{table.capacity} pax</small>
        <small>{waiterLabel}</small>
        <small>{elapsed}</small>
      </span>
      <span className="waiter-table-total">
        <b>{total !== undefined && total > 0 ? money(total) : '$0'}</b>
        <small>Total consumido</small>
      </span>
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
  isMarkingServed = false,
  isRequestingPayment = false,
  onMarkServed,
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
  isMarkingServed?: boolean;
  isRequestingPayment?: boolean;
  onMarkServed: () => void;
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
  const deliverableItemsCount = activeOrder.items.filter((item) => item.status === 'SENT' || item.status === 'PREPARING' || item.status === 'READY').length;

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
              const hasModifiers = item.modifiers.length > 0;
              const hasNotes = item.notes.trim().length > 0;

              return (
                <article className="order-item" key={item.id}>
                  <div className="order-item-main">
                    <strong>{item.name}</strong>
                    <span>Cantidad: {item.quantity} - Unitario: {money(item.unitPrice)}</span>
                    <div className={hasModifiers || hasNotes ? 'order-item-prep has-detail' : 'order-item-prep'}>
                      <span><b>Preparacion:</b> {hasNotes ? item.notes : 'Sin instrucciones especiales'}</span>
                      <span><b>Adicionales del producto:</b> {hasModifiers ? item.modifiers.map((modifier) => modifier.name).join(', ') : 'Sin adicionales'}</span>
                    </div>
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
        <button
          className="served-action"
          disabled={orderLocked || orderWaitingPayment || isMarkingServed || deliverableItemsCount === 0}
          type="button"
          onClick={onMarkServed}
        >
          {isMarkingServed ? 'Marcando...' : `Pedido entregado${deliverableItemsCount > 0 ? ` (${deliverableItemsCount})` : ''}`}
        </button>
        <RequestPaymentButton
          disabled={activeOrder.status === 'PAID'}
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
  { key: 'ready', label: 'Listos para entregar', statuses: ['READY'] },
  { key: 'served', label: 'Entregados', statuses: ['SERVED'] },
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

export function ProductSubcategoryTabs({
  subcategories,
  selectedSubcategoryId,
  onSelectSubcategory
}: {
  subcategories: MenuCategory[];
  selectedSubcategoryId: string;
  onSelectSubcategory: (subcategoryId: string) => void;
}) {
  if (subcategories.length === 0) {
    return null;
  }

  return (
    <div className="subcategory-tabs">
      {subcategories.map((subcategory) => (
        <button
          className={subcategory.id === selectedSubcategoryId ? 'active' : ''}
          key={subcategory.id}
          type="button"
          onClick={() => onSelectSubcategory(subcategory.id)}
        >
          {subcategory.name}
        </button>
      ))}
    </div>
  );
}

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
  const visual = productVisualFor(item);

  return (
    <article className={isActive ? 'product-card active' : 'product-card'}>
      <button className="product-card-main" type="button" onClick={() => onSelect(item)}>
        <span
          aria-hidden="true"
          className="product-photo"
          style={{ backgroundImage: `url("${visual}")` }}
        />
        <span className="product-code">Inv. {shortProductCode(item.id)}</span>
        <strong title={item.name}>{item.name}</strong>
        <span className="product-description">{item.description || 'Producto disponible para venta.'}</span>
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
  savingAction,
  selectedModifierIds,
  onAdd,
  onNotesChange,
  onQuantityChange,
  onToggleModifier
}: {
  canAdd: boolean;
  modifiers: Modifier[];
  notes: string;
  quantity: number;
  savingAction: string;
  selectedModifierIds: string[];
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  onNotesChange: (notes: string) => void;
  onQuantityChange: (quantity: number) => void;
  onToggleModifier: (modifierId: string) => void;
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
          Preparacion / notas del plato
          <input
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Ej: carne 3/4, termino medio, pasta con extra queso, bebida con hielo"
          />
        </label>
      </div>

      {modifiers.length > 0 && (
        <div className="modifier-list">
          <strong className="modifier-list-title">Adicionales disponibles para este producto</strong>
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
      )}
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

function shortProductCode(value: string) {
  return value.replaceAll('-', '').slice(0, 5).toUpperCase() || 'POS';
}

function productVisualFor(item: MenuItem) {
  if (item.imageUrl) {
    return item.imageUrl;
  }

  const lowerName = `${item.name} ${item.description}`.toLowerCase();
  const palette = productPalette(lowerName);
  const initials = item.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'POS';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 210">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${palette[0]}"/>
          <stop offset="1" stop-color="${palette[1]}"/>
        </linearGradient>
        <radialGradient id="plate" cx="50%" cy="46%" r="48%">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.58" stop-color="#f8fafc"/>
          <stop offset="1" stop-color="#d8e0dd"/>
        </radialGradient>
      </defs>
      <rect width="320" height="210" fill="url(#bg)"/>
      <circle cx="160" cy="106" r="76" fill="url(#plate)" opacity="0.96"/>
      <circle cx="160" cy="106" r="52" fill="${palette[2]}" opacity="0.92"/>
      <ellipse cx="132" cy="92" rx="38" ry="18" fill="${palette[3]}" opacity="0.9"/>
      <ellipse cx="184" cy="124" rx="43" ry="20" fill="${palette[4]}" opacity="0.88"/>
      <circle cx="204" cy="82" r="13" fill="#fef3c7" opacity="0.9"/>
      <text x="160" y="118" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#ffffff">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function productPalette(value: string) {
  if (value.includes('pollo') || value.includes('chicken')) {
    return ['#fef3c7', '#f59e0b', '#d97706', '#fde68a', '#92400e'];
  }

  if (value.includes('carne') || value.includes('res') || value.includes('costilla') || value.includes('bbq')) {
    return ['#fee2e2', '#991b1b', '#7f1d1d', '#f97316', '#451a03'];
  }

  if (value.includes('pasta') || value.includes('arroz') || value.includes('ensalada')) {
    return ['#dcfce7', '#16a34a', '#15803d', '#fde68a', '#65a30d'];
  }

  if (value.includes('bebida') || value.includes('jugo') || value.includes('limonada')) {
    return ['#dbeafe', '#0284c7', '#0e7490', '#67e8f9', '#0369a1'];
  }

  return ['#ccfbf1', '#0f766e', '#115e59', '#f59e0b', '#134e4a'];
}
