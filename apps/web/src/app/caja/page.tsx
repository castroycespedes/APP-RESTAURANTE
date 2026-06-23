'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@restaurante/ui';
import { AuthGate, routeForRole, useAuth } from '../auth-provider';
import { useAppTheme } from '../theme-provider';

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'QR' | 'MIXED';
type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
type CloseTableStatus = 'AVAILABLE' | 'CLEANING';
type CheckoutStep = 1 | 2 | 3 | 4 | 5;
type MixedPaymentLine = { method: Exclude<PaymentMethod, 'MIXED'>; amount: number; reference: string };

interface CashRegister {
  id: string;
  name: string;
  openingAmount: number | string;
  openedAt: string;
  status: 'OPEN' | 'CLOSED';
  openedBy?: { firstName?: string | null; lastName?: string | null; email: string };
}

interface CashierOrder {
  id: string;
  orderNumber: string;
  status: string;
  openedAt?: string | null;
  createdAt?: string | null;
  subtotal: number | string;
  discountTotal: number | string;
  taxTotal: number | string;
  tipTotal: number | string;
  total: number | string;
  table: { id: string; name: string; number: string; status: string };
  waiter?: { firstName?: string | null; lastName?: string | null; email: string } | null;
  customer?: { firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null } | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number | string;
    total: number | string;
    notes?: string | null;
    status: string;
    menuItem: { name: string };
    modifiers: Array<{ nameSnapshot: string; priceDelta: number | string; quantity: number }>;
  }>;
  payments: Array<{ id: string; method: PaymentMethod; amount: number | string; reference?: string | null }>;
  discounts: Array<{ id: string; name: string; type: DiscountType; value: number | string }>;
}

interface CashRegisterSummary {
  totals: {
    cash: number;
    card: number;
    transfer: number;
    qr: number;
    tips: number;
    discounts: number;
    sales: number;
    payments: number;
    expectedCash: number;
  };
}

interface CashierConfig {
  afterPaymentTableStatus: CloseTableStatus;
  taxRate: number;
  suggestedTipRate: number;
  tipSuggestions: number[];
  requireOpenCashRegister: boolean;
  allowMixedPayments: boolean;
  allowSplitBill: boolean;
  allowCashierRequestPayment: boolean;
  printReceiptAfterPayment: boolean;
  showTipOnReceipt: boolean;
  allowCustomTip: boolean;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function money(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function paidTotal(order: CashierOrder) {
  return order.payments.reduce((total, payment) => total + numberValue(payment.amount), 0);
}

function waiterName(order: CashierOrder) {
  return [order.waiter?.firstName, order.waiter?.lastName].filter(Boolean).join(' ') || order.waiter?.email || 'Sin mesero';
}

function customerName(order: CashierOrder) {
  const fullName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ');
  return fullName || order.customer?.phone || order.customer?.email || 'Cliente no registrado';
}

function paymentMethodLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    CARD: 'Tarjeta',
    CASH: 'Efectivo',
    MIXED: 'Pago mixto',
    QR: 'QR',
    TRANSFER: 'Transferencia'
  };

  return labels[method];
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    CANCELLED: 'Cancelada',
    IN_PROGRESS: 'En preparación',
    OPEN: 'Abierta',
    PAID: 'Pagada',
    PENDING: 'Pendiente',
    READY: 'Lista',
    SENT: 'Enviada',
    SENT_TO_KITCHEN: 'En cocina',
    SERVED: 'Servida',
    WAITING_PAYMENT: 'Cuenta solicitada'
  };

  return labels[status] ?? status;
}

function orderItemStatusLabel(status: string) {
  const labels: Record<string, string> = {
    CANCELLED: 'Cancelado',
    PENDING: 'Pendiente',
    PREPARING: 'Preparando',
    READY: 'Listo',
    SENT: 'Enviado',
    SERVED: 'Servido'
  };

  return labels[status] ?? status;
}

function compareCashierOrdersByTable(first: CashierOrder, second: CashierOrder) {
  const firstNumber = Number(first.table.number);
  const secondNumber = Number(second.table.number);
  const firstIsNumeric = Number.isFinite(firstNumber);
  const secondIsNumeric = Number.isFinite(secondNumber);

  if (firstIsNumeric && secondIsNumeric && firstNumber !== secondNumber) {
    return firstNumber - secondNumber;
  }

  return String(first.table.number || first.table.name).localeCompare(String(second.table.number || second.table.name), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

function isWaitingPaymentOrder(order: CashierOrder) {
  return order.status === 'WAITING_PAYMENT' || order.table.status === 'WAITING_PAYMENT';
}

function canMoveOrderToPayment(order: CashierOrder) {
  return ['OPEN', 'SENT', 'SENT_TO_KITCHEN', 'IN_PROGRESS', 'PREPARING', 'READY', 'SERVED'].includes(order.status);
}

function orderStartDate(order: CashierOrder) {
  return order.openedAt ?? order.createdAt ?? null;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sin hora registrada';
  }

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit'
  }).format(new Date(value));
}

function serviceDuration(value?: string | null) {
  if (!value) {
    return 'Tiempo no disponible';
  }

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes} min`;
}

function CashierDashboard({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function OpenCashRegisterPanel({ onOpen }: { onOpen: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <section className="cashier-open-screen" aria-label="Abrir caja">
      <div className="cashier-open-card">
        <div>
          <p className="eyebrow">Caja cerrada</p>
          <h2>Abrir caja</h2>
          <span>Registra solo el efectivo inicial del turno. Los metodos de pago se usan despues, al cobrar una mesa.</span>
        </div>
        <form className="cashier-open-form" id="open-register-form" onSubmit={onOpen}>
          <label>
            Monto inicial en efectivo
            <input name="openingAmount" min="0" type="number" placeholder="Ej: 100000" required />
          </label>
          <label>
            Observacion opcional
            <textarea name="notes" placeholder="Notas de apertura, si aplica" rows={3} />
          </label>
          <Button>Abrir caja</Button>
        </form>
      </div>
    </section>
  );
}

function CashRegisterStatusCard({
  cashRegister,
  currentUserEmail,
  onClose,
  summary
}: {
  cashRegister: CashRegister | null;
  currentUserEmail?: string;
  onClose: (event: FormEvent<HTMLFormElement>) => void;
  summary: CashRegisterSummary | null;
}) {
  return (
    <section className="cashier-register-workflow" aria-label="Turno de caja">
      <article className="cashier-register-card">
        <div>
          <p className="eyebrow">Turno de caja</p>
          <h2>{cashRegister ? 'Caja abierta' : 'Caja cerrada'}</h2>
          <span>
            {cashRegister
              ? `${cashRegister.name} abierta por ${cashRegister.openedBy?.email ?? currentUserEmail ?? 'usuario actual'}`
              : 'Abre caja una sola vez al iniciar el turno. Este paso esta separado del cobro de mesas.'}
          </span>
        </div>
        <strong>{cashRegister ? money(numberValue(cashRegister.openingAmount)) : money(0)}</strong>
        {cashRegister?.openedAt && <small>Apertura: {formatDateTime(cashRegister.openedAt)}</small>}
      </article>

      <form className="cashier-register-form" id="close-register-form" onSubmit={onClose}>
        <strong>Cerrar caja</strong>
        <div className="cash-close-summary compact">
          <div><span>Efectivo esperado</span><strong>{money(summary?.totals.expectedCash ?? 0)}</strong></div>
          <div><span>Total ventas</span><strong>{money(summary?.totals.sales ?? 0)}</strong></div>
        </div>
        <input name="closingAmount" min="0" type="number" placeholder="Efectivo contado" />
        <input name="notes" placeholder="Notas de cierre" />
        <Button disabled={!cashRegister}>Cerrar turno</Button>
      </form>
    </section>
  );
}

function PendingPaymentTableCard({
  cashRegister,
  cashierConfig,
  isActive,
  isPreparingCheckout,
  onCharge,
  onSelect,
  order
}: {
  cashRegister: CashRegister | null;
  cashierConfig: CashierConfig;
  isActive: boolean;
  isPreparingCheckout: boolean;
  onCharge: (order: CashierOrder) => void | Promise<void>;
  onSelect: (orderId: string) => void;
  order: CashierOrder;
}) {
  const buttonLabel = isPreparingCheckout
    ? 'Preparando cobro...'
    : isWaitingPaymentOrder(order)
      ? 'Cobrar'
      : 'Pasar a cuenta y cobrar';

  return (
    <article className={isActive ? 'cashier-order active' : 'cashier-order'}>
      <button className="cashier-order-main" type="button" onClick={() => onSelect(order.id)}>
        <strong>{order.table.name || `Mesa ${order.table.number}`}</strong>
        <span>Orden {order.orderNumber}</span>
        <span>Mesero: {waiterName(order)}</span>
        <span>Abierta: {formatDateTime(orderStartDate(order))}</span>
        <span>Atencion: {serviceDuration(orderStartDate(order))}</span>
        <em>{money(Math.max(0, numberValue(order.total) - paidTotal(order)))} pendiente</em>
      </button>
      <div className="cashier-order-actions">
        <button type="button" onClick={() => onSelect(order.id)}>Ver cuenta</button>
        <button type="button" onClick={() => void onCharge(order)} disabled={isPreparingCheckout || (cashierConfig.requireOpenCashRegister && !cashRegister)}>
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}

function PendingPaymentTables({
  cashRegister,
  cashierConfig,
  isPreparingCheckoutId,
  onCharge,
  onSelect,
  paymentQueue,
  reviewOrders,
  selectedOrder
}: {
  cashRegister: CashRegister | null;
  cashierConfig: CashierConfig;
  isPreparingCheckoutId: string;
  onCharge: (order: CashierOrder) => void | Promise<void>;
  onSelect: (orderId: string) => void;
  paymentQueue: CashierOrder[];
  reviewOrders: CashierOrder[];
  selectedOrder?: CashierOrder;
}) {
  return (
    <aside className="panel" id="pending-orders">
      <div className="section-title">
        <h2>Mesas pendientes de cobro</h2>
        <span>Ordenes enviadas por el mesero a cuenta</span>
      </div>
      <div className="cashier-order-list">
        {paymentQueue.map((order) => (
          <PendingPaymentTableCard
            cashRegister={cashRegister}
            cashierConfig={cashierConfig}
            isActive={order.id === selectedOrder?.id}
            isPreparingCheckout={order.id === isPreparingCheckoutId}
            key={order.id}
            onCharge={onCharge}
            onSelect={onSelect}
            order={order}
          />
        ))}
        {paymentQueue.length === 0 && <div className="empty-state compact">No hay mesas pendientes de pago.</div>}
      </div>
      {reviewOrders.length > 0 && (
        <details className="cashier-review-orders">
          <summary>Otras mesas en seguimiento</summary>
          <div className="cashier-order-list">
            {reviewOrders.map((order) => (
              <article className={order.id === selectedOrder?.id ? 'cashier-order active muted' : 'cashier-order muted'} key={order.id}>
                <button className="cashier-order-main" type="button" onClick={() => onSelect(order.id)}>
                  <strong>Mesa {order.table.number}</strong>
                  <span>{order.orderNumber} - {order.status}</span>
                  <span>{waiterName(order)}</span>
                  <em>Esta mesa aún no tiene cuenta solicitada</em>
                </button>
                <div className="cashier-order-actions">
                  <button type="button" onClick={() => onSelect(order.id)}>Ver cuenta</button>
                  <button type="button" onClick={() => void onCharge(order)} disabled={order.id === isPreparingCheckoutId || (cashierConfig.requireOpenCashRegister && !cashRegister)}>
                    {order.id === isPreparingCheckoutId ? 'Preparando cobro...' : 'Pasar a cuenta y cobrar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </details>
      )}
      <div className="cashier-register-status">
        <strong>Caja {cashRegister ? 'abierta' : 'cerrada'}</strong>
        <span>{cashRegister ? `Turno: ${cashRegister.name}` : 'Abre caja para poder cobrar.'}</span>
      </div>
    </aside>
  );
}

function PreInvoicePanel({
  cashRegister,
  cashierConfig,
  checkoutButtonLabel = 'Cobrar / Facturar',
  canStartCheckout,
  discountTotal,
  downloadLink,
  onDownload,
  onPrint,
  onSaveTicket,
  onStartCheckout,
  order,
  paid,
  subtotal,
  taxTotal,
  themeName,
  ticketSuggestedTipAmount,
  ticketTotalWithSuggestedTip,
  ticketTotalWithoutTip
}: {
  cashRegister: CashRegister | null;
  cashierConfig: CashierConfig;
  checkoutButtonLabel?: string;
  canStartCheckout: boolean;
  discountTotal: number;
  downloadLink: { fileName: string; html: string; url: string } | null;
  onDownload: (order: CashierOrder) => void;
  onPrint: (order: CashierOrder) => void;
  onSaveTicket: () => void;
  onStartCheckout: () => void | Promise<void>;
  order: CashierOrder;
  paid: number;
  subtotal: number;
  taxTotal: number;
  themeName: string;
  ticketSuggestedTipAmount: number;
  ticketTotalWithSuggestedTip: number;
  ticketTotalWithoutTip: number;
}) {
  return (
    <section className="cashier-step customer-ticket-preview" aria-label="Cuenta previa">
      <header>
        <div>
          <p className="eyebrow">Paso 1</p>
          <h3>Cuenta previa</h3>
          <span>Solo revision antes de pagar. No marca la orden como pagada, no libera la mesa y no registra pago.</span>
        </div>
        <div className="cashier-inline-actions">
          <button className="secondary-action" type="button" onClick={() => document.getElementById('pending-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Volver a mesas pendientes
          </button>
          <button className="primary-action" type="button" onClick={() => onPrint(order)}>Imprimir cuenta previa</button>
          <button className="secondary-action" type="button" onClick={() => onDownload(order)}>Descargar cuenta previa</button>
          <button className="primary-action" type="button" onClick={onStartCheckout} disabled={!canStartCheckout || (cashierConfig.requireOpenCashRegister && !cashRegister)}>
            {checkoutButtonLabel}
          </button>
        </div>
      </header>
      <div className="cashier-help-note">
        <strong>Para verla en el PC:</strong>
        <span>Primero toca Descargar cuenta previa. Luego toca Guardar archivo en Descargas. El archivo queda como cuenta-previa-{order.orderNumber}.html.</span>
        {downloadLink && (
          <button className="download-ticket-link" type="button" onClick={onSaveTicket}>
            Guardar archivo en PC
          </button>
        )}
      </div>
      <div className="customer-account-sheet">
        <div className="account-sheet-head">
          <strong>{themeName || 'Mi Restaurante'}</strong>
          <span>Mesa {order.table.number} - {order.orderNumber}</span>
          <span>Mesero: {waiterName(order)}</span>
          <span>Cliente: {customerName(order)}</span>
        </div>
        <div className="account-sheet-columns">
          <span>Producto</span>
          <span>Cant.</span>
          <span>Unitario</span>
          <span>Total</span>
        </div>
        {order.items.map((item) => (
          <article key={item.id}>
            <div className="account-product-info">
              <strong>{item.menuItem.name}</strong>
              <span>{item.modifiers.map((modifier) => modifier.nameSnapshot).join(', ') || 'Sin adicionales'}</span>
              {item.notes && <span>Nota: {item.notes}</span>}
            </div>
            <span>{item.quantity}</span>
            <span>{money(numberValue(item.unitPrice))}</span>
            <strong>{money(numberValue(item.total))}</strong>
          </article>
        ))}
      </div>
      <div className="ticket-preview-lines">
        <div><span>Subtotal consumo</span><strong>{money(subtotal)}</strong></div>
        <div><span>Descuento aplicado</span><strong>{money(discountTotal)}</strong></div>
        <div><span>Impuesto</span><strong>{money(taxTotal)}</strong></div>
        <div><span>Pagado antes</span><strong>{money(paid)}</strong></div>
        <div><span>Total sin propina</span><strong>{money(ticketTotalWithoutTip)}</strong></div>
        <div><span>Propina voluntaria sugerida 10%</span><strong>{money(ticketSuggestedTipAmount)}</strong></div>
        <div className="ticket-pay-now"><span>Total sugerido con propina</span><strong>{money(ticketTotalWithSuggestedTip)}</strong></div>
      </div>
      <p>Esta cuenta previa no cierra la mesa. Solo sirve para mostrar al cliente cuanto debe pagar antes de registrar el cobro.</p>
    </section>
  );
}

function PaymentMethodSelector({
  allowMixedPayments,
  cashChange,
  mixedPayments,
  mixedPaymentsTotal,
  onAddMixedPayment,
  onMethodChange,
  onPaymentAmountChange,
  onRemoveMixedPayment,
  onUpdateMixedPayment,
  paymentAmount,
  paymentMethod,
  previewBalance
}: {
  allowMixedPayments: boolean;
  cashChange: number;
  mixedPayments: MixedPaymentLine[];
  mixedPaymentsTotal: number;
  onAddMixedPayment: () => void;
  onMethodChange: (method: PaymentMethod) => void;
  onPaymentAmountChange: (amount: number) => void;
  onRemoveMixedPayment: (index: number) => void;
  onUpdateMixedPayment: (index: number, patch: Partial<MixedPaymentLine>) => void;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  previewBalance: number;
}) {
  const mixedPaymentBalance = previewBalance - mixedPaymentsTotal;
  const mixedCashTotal = mixedPayments.filter((payment) => payment.method === 'CASH').reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const mixedOverpaid = Math.max(0, mixedPaymentsTotal - previewBalance);

  return (
    <>
      <div className="payment-method-grid payment-method-cards" role="radiogroup" aria-label="Metodo de pago">
        {(['CASH', 'CARD', 'TRANSFER', 'QR'] as PaymentMethod[]).map((method) => (
          <button className={paymentMethod === method ? 'active' : ''} key={method} type="button" onClick={() => onMethodChange(method)}>
            <span>{paymentMethodLabel(method)}</span>
            <strong>{method === 'CASH' ? 'Recibe efectivo y calcula cambio' : `Cobrar ${money(previewBalance)}`}</strong>
          </button>
        ))}
        {allowMixedPayments && (
          <button className={paymentMethod === 'MIXED' ? 'active' : ''} type="button" onClick={() => onMethodChange('MIXED')}>
            <span>Pago mixto</span>
            <strong>Combina varios metodos</strong>
          </button>
        )}
      </div>

      {paymentMethod === 'CASH' && (
        <div className="cashier-payment-fields">
          <label>
            Monto recibido
            <input min={previewBalance} type="number" value={paymentAmount || ''} onChange={(event) => onPaymentAmountChange(Number(event.target.value))} />
          </label>
          <div className={paymentAmount < previewBalance ? 'cashier-selected-charge danger' : 'cashier-selected-charge confirm'}>
            <span>Estado del efectivo</span>
            <strong>{paymentAmount < previewBalance ? `Faltan ${money(previewBalance - paymentAmount)}` : 'Monto suficiente'}</strong>
          </div>
          <div className="cashier-selected-charge"><span>Cambio</span><strong>{money(cashChange)}</strong></div>
        </div>
      )}

      {(['CARD', 'TRANSFER', 'QR'] as PaymentMethod[]).includes(paymentMethod) && (
        <div className="cashier-payment-fields">
          <label>
            Referencia opcional
            <input placeholder="Voucher, comprobante o codigo" />
          </label>
          <div className="cashier-selected-charge"><span>Valor a cobrar</span><strong>{money(previewBalance)}</strong></div>
        </div>
      )}

      {paymentMethod === 'MIXED' && (
        <div className="mixed-payment-builder">
          {mixedPayments.map((payment, index) => (
            <div className="mixed-payment-row" key={`${payment.method}-${index}`}>
              <select value={payment.method} onChange={(event) => onUpdateMixedPayment(index, { method: event.target.value as Exclude<PaymentMethod, 'MIXED'> })}>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="QR">QR</option>
              </select>
              <input min="0" type="number" placeholder="Valor" value={payment.amount || ''} onChange={(event) => onUpdateMixedPayment(index, { amount: Number(event.target.value) })} />
              <input placeholder="Referencia" value={payment.reference} onChange={(event) => onUpdateMixedPayment(index, { reference: event.target.value })} />
              <button type="button" onClick={() => onRemoveMixedPayment(index)} disabled={mixedPayments.length <= 1}>Quitar</button>
            </div>
          ))}
          <button className="secondary-action" type="button" onClick={onAddMixedPayment}>Agregar metodo</button>
          <div className={Math.abs(mixedPaymentsTotal - previewBalance) <= 0.01 ? 'cashier-selected-charge confirm' : 'cashier-selected-charge'}>
            <span>Suma pago mixto / Total final</span>
            <strong>{money(mixedPaymentsTotal)} / {money(previewBalance)}</strong>
          </div>
          <div className={mixedPaymentBalance > 0.01 ? 'cashier-selected-charge danger' : 'cashier-selected-charge confirm'}>
            <span>Saldo pendiente</span>
            <strong>{money(Math.max(0, mixedPaymentBalance))}</strong>
          </div>
          {mixedOverpaid > 0.01 && (
            <div className={mixedCashTotal > 0 ? 'cashier-selected-charge warning' : 'cashier-selected-charge danger'}>
              <span>{mixedCashTotal > 0 ? 'Cambio por excedente' : 'Pago excedido'}</span>
              <strong>{money(mixedOverpaid)}</strong>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TipSelector({
  allowCustomTip,
  balance,
  onCustomTipChange,
  onTipPercentage,
  previewBalance,
  tipAmount
}: {
  allowCustomTip: boolean;
  balance: number;
  onCustomTipChange: (amount: number) => void;
  onTipPercentage: (percent: number) => void;
  previewBalance: number;
  tipAmount: number;
}) {
  return (
    <>
      <div className="bill-choice-panel">
        <button type="button" onClick={() => onTipPercentage(0)}><span>Sin propina</span><strong>{money(balance)}</strong></button>
        <button type="button" onClick={() => onTipPercentage(5)}><span>Propina 5%</span><strong>{money(balance + Math.round(balance * 0.05))}</strong></button>
        <button type="button" onClick={() => onTipPercentage(10)}><span>Propina 10%</span><strong>{money(balance + Math.round(balance * 0.1))}</strong></button>
      </div>
      <div className="cashier-payment-fields">
        <label>
          Propina personalizada
          <input min="0" type="number" disabled={!allowCustomTip} value={tipAmount || ''} onChange={(event) => onCustomTipChange(Number(event.target.value))} />
        </label>
        <div className="cashier-selected-charge"><span>Total con propina</span><strong>{money(previewBalance)}</strong></div>
      </div>
    </>
  );
}

function DiscountSection({
  canApplyDiscount,
  discountTotal,
  onApplyDiscount,
  order,
  previewBalance
}: {
  canApplyDiscount: boolean;
  discountTotal: number;
  onApplyDiscount: (event: FormEvent<HTMLFormElement>) => void;
  order: CashierOrder;
  previewBalance: number;
}) {
  const [discountType, setDiscountType] = useState<DiscountType>('FIXED_AMOUNT');
  const [discountValue, setDiscountValue] = useState(0);
  const subtotal = numberValue(order.subtotal);
  const draftDiscountAmount = discountType === 'PERCENTAGE' ? Math.round(subtotal * (discountValue / 100)) : discountValue;
  const hasInvalidDiscount = discountValue < 0 || draftDiscountAmount > Math.max(0, previewBalance) || (discountType === 'PERCENTAGE' && discountValue > 100);
  const previewAfterDraftDiscount = Math.max(0, previewBalance - Math.max(0, draftDiscountAmount));

  return (
    <>
      {canApplyDiscount ? (
        <div className="checkout-discount-panel">
          <div className="checkout-choice-row" role="radiogroup" aria-label="Tipo de descuento">
            <button type="button" className={discountValue === 0 ? 'active' : ''} onClick={() => setDiscountValue(0)}>Sin descuento</button>
            <button type="button" className={discountType === 'PERCENTAGE' && discountValue > 0 ? 'active' : ''} onClick={() => setDiscountType('PERCENTAGE')}>Porcentaje</button>
            <button type="button" className={discountType === 'FIXED_AMOUNT' && discountValue > 0 ? 'active' : ''} onClick={() => setDiscountType('FIXED_AMOUNT')}>Valor fijo</button>
          </div>
          <form className="cashier-form inline" onSubmit={(event) => {
            if (hasInvalidDiscount) {
              event.preventDefault();
              return;
            }
            onApplyDiscount(event);
            setDiscountValue(0);
          }}>
            <input name="name" placeholder="Nombre descuento" defaultValue="Descuento caja" />
            <select name="type" value={discountType} onChange={(event) => setDiscountType(event.target.value as DiscountType)}>
              <option value="FIXED_AMOUNT">Valor fijo</option>
              <option value="PERCENTAGE">Porcentaje</option>
            </select>
            <input name="value" min="0" max={discountType === 'PERCENTAGE' ? 100 : undefined} type="number" placeholder={discountType === 'PERCENTAGE' ? 'Ej: 10' : 'Ej: 2000'} value={discountValue || ''} onChange={(event) => setDiscountValue(Number(event.target.value))} />
            <input name="reason" placeholder="Motivo" />
            <Button disabled={!order || discountValue <= 0 || hasInvalidDiscount}>Aplicar descuento</Button>
          </form>
          {hasInvalidDiscount && (
            <p className="checkout-review-block-message">El descuento no puede ser negativo, superar el 100% ni ser mayor al total actual.</p>
          )}
          <div className="ticket-preview-lines">
            <div><span>Descuento nuevo calculado</span><strong>{money(Math.max(0, draftDiscountAmount))}</strong></div>
            <div className="ticket-pay-now"><span>Total si se aplica</span><strong>{money(previewAfterDraftDiscount)}</strong></div>
          </div>
        </div>
      ) : (
        <div className="cashier-help-note warning">
          <strong>Descuento requiere autorización.</strong>
          <span>Tu rol no puede aplicar descuentos desde el cierre de venta.</span>
        </div>
      )}
      {order.discounts.length > 0 && (
        <div className="checkout-existing-discounts">
          <strong>Descuentos ya aplicados</strong>
          {order.discounts.map((discount) => (
            <span key={discount.id}>
              {discount.name}: {discount.type === 'PERCENTAGE' ? `${numberValue(discount.value)}%` : money(numberValue(discount.value))}
            </span>
          ))}
        </div>
      )}
      <div className="ticket-preview-lines">
        <div><span>Descuento actual</span><strong>{money(discountTotal)}</strong></div>
        <div className="ticket-pay-now"><span>Total actual</span><strong>{money(previewBalance)}</strong></div>
      </div>
    </>
  );
}

function PaymentSummary({
  cashChange,
  discountTotal,
  mixedPaymentsTotal,
  paymentAmount,
  paymentMethod,
  previewBalance,
  subtotal,
  taxTotal,
  tipAmount
}: {
  cashChange: number;
  discountTotal: number;
  mixedPaymentsTotal: number;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  previewBalance: number;
  subtotal: number;
  taxTotal: number;
  tipAmount: number;
}) {
  return (
    <div className="ticket-preview-lines">
      <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
      <div><span>Descuento</span><strong>{money(discountTotal)}</strong></div>
      <div><span>Impuesto</span><strong>{money(taxTotal)}</strong></div>
      <div><span>Propina</span><strong>{money(tipAmount)}</strong></div>
      <div><span>Metodo</span><strong>{paymentMethodLabel(paymentMethod)}</strong></div>
      <div><span>Monto recibido</span><strong>{money(paymentMethod === 'MIXED' ? mixedPaymentsTotal : paymentMethod === 'CASH' ? paymentAmount : previewBalance)}</strong></div>
      <div><span>Cambio</span><strong>{money(cashChange)}</strong></div>
      <div className="ticket-pay-now"><span>Total final</span><strong>{money(previewBalance)}</strong></div>
    </div>
  );
}

function ConfirmPaymentButton({ disabled, isRegisteringPayment }: { disabled: boolean; isRegisteringPayment: boolean }) {
  return <Button disabled={disabled}>{isRegisteringPayment ? 'Registrando pago...' : 'Confirmar pago y cerrar mesa'}</Button>;
}

function CheckoutWizard({
  balance,
  canApplyCheckoutDiscount,
  canContinueWithPendingItems,
  cashChange,
  cashRegister,
  cashierConfig,
  checkoutStep,
  discountTotal,
  goToCheckoutStep,
  isRegisteringPayment,
  mixedPayments,
  mixedPaymentsTotal,
  onAddMixedPayment,
  onApplyDiscount,
  onCancel,
  onCustomTipChange,
  onPaymentAmountChange,
  onPaymentMethodChange,
  onRegisterPayment,
  onRemoveMixedPayment,
  onTipPercentage,
  onUpdateMixedPayment,
  order,
  paymentAmount,
  paymentMethod,
  previewBalance,
  subtotal,
  taxTotal,
  tipAmount,
  total
}: {
  balance: number;
  canApplyCheckoutDiscount: boolean;
  canContinueWithPendingItems: boolean;
  cashChange: number;
  cashRegister: CashRegister | null;
  cashierConfig: CashierConfig;
  checkoutStep: CheckoutStep;
  discountTotal: number;
  goToCheckoutStep: (step: CheckoutStep) => void;
  isRegisteringPayment: boolean;
  mixedPayments: MixedPaymentLine[];
  mixedPaymentsTotal: number;
  onAddMixedPayment: () => void;
  onApplyDiscount: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onCustomTipChange: (amount: number) => void;
  onPaymentAmountChange: (amount: number) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onRegisterPayment: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveMixedPayment: (index: number) => void;
  onTipPercentage: (percent: number) => void;
  onUpdateMixedPayment: (index: number, patch: Partial<MixedPaymentLine>) => void;
  order: CashierOrder;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  previewBalance: number;
  subtotal: number;
  taxTotal: number;
  tipAmount: number;
  total: number;
}) {
  const stepLabels = ['Revisar cuenta', 'Propina y descuento', 'Método de pago', 'Confirmar'];
  const pendingItems = order.items.filter((item) => item.status === 'PENDING');
  const hasProducts = order.items.length > 0;
  const hasPendingItems = pendingItems.length > 0;
  const canContinueFromReview = hasProducts && (!hasPendingItems || canContinueWithPendingItems);
  const mixedPaymentDifference = mixedPaymentsTotal - previewBalance;
  const mixedPaymentsHaveCash = mixedPayments.some((payment) => payment.method === 'CASH' && numberValue(payment.amount) > 0);
  const canContinueFromPayment =
    paymentMethod === 'CASH'
      ? paymentAmount >= previewBalance
      : paymentMethod === 'MIXED'
        ? Math.abs(mixedPaymentDifference) <= 0.01 || (mixedPaymentDifference > 0.01 && mixedPaymentsHaveCash)
        : true;
  const paymentBlockMessage =
    paymentMethod === 'CASH' && paymentAmount < previewBalance
      ? 'El monto recibido es menor al total.'
      : paymentMethod === 'MIXED' && mixedPaymentsTotal < previewBalance
        ? 'La suma de pagos no alcanza el total.'
        : paymentMethod === 'MIXED' && mixedPaymentDifference > 0.01 && !mixedPaymentsHaveCash
          ? 'El pago mixto supera el total y no hay efectivo para devolver cambio.'
          : '';
  const reviewBlockMessage = !hasProducts
    ? 'No puedes continuar porque la orden no tiene productos.'
    : hasPendingItems && !canContinueWithPendingItems
      ? 'Hay productos pendientes sin enviar. Necesitas autorización de administrador o manager para continuar.'
      : '';

  return (
    <section className="cashier-step cashier-payment-panel focused-checkout" id="payment-form" aria-label="Flujo de cobro guiado" role="dialog" aria-modal="true">
      <div className="section-title">
        <div>
          <p className="eyebrow">Cobro / facturación final</p>
          <h2>Paso {Math.min(checkoutStep, 4)} de 4: {stepLabels[Math.min(checkoutStep, 4) - 1]}</h2>
        </div>
        <div className="checkout-title-actions">
          <span>{cashRegister ? `Total final actual: ${money(previewBalance)}` : 'Abre caja primero'}</span>
          <button className="secondary-action" type="button" onClick={onCancel}>Cancelar cobro</button>
        </div>
      </div>

      <div className="checkout-step-tabs" aria-label="Pasos de cobro">
        {stepLabels.map((label, index) => (
          <button
            aria-current={checkoutStep === index + 1 ? 'step' : undefined}
            aria-pressed={checkoutStep === index + 1}
            className={checkoutStep === index + 1 ? 'active' : ''}
            key={label}
            type="button"
            onClick={() => goToCheckoutStep((index + 1) as CheckoutStep)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {checkoutStep === 1 && (
        <div className="checkout-step-panel">
          <h3>Revisar cuenta</h3>
          <div className="checkout-confirm-grid">
            <div><span>Mesa</span><strong>{order.table.name || `Mesa ${order.table.number}`}</strong></div>
            <div><span>Mesero</span><strong>{waiterName(order)}</strong></div>
            <div><span>Número de orden</span><strong>{order.orderNumber}</strong></div>
            <div><span>Estado de orden</span><strong>{orderStatusLabel(order.status)}</strong></div>
            <div><span>Productos</span><strong>{order.items.length}</strong></div>
            <div><span>Total actual</span><strong>{money(total)}</strong></div>
          </div>

          {!hasProducts && (
            <div className="checkout-review-alert danger" role="alert">
              <strong>Orden vacía.</strong>
              <span>Agrega productos antes de configurar el pago.</span>
            </div>
          )}

          {hasPendingItems && (
            <div className={`checkout-review-alert ${canContinueWithPendingItems ? 'warning' : 'danger'}`} role="alert">
              <strong>Hay productos pendientes sin enviar.</strong>
              <span>
                {canContinueWithPendingItems
                  ? 'Tienes permiso para continuar, pero revisa que estos productos deban cobrarse.'
                  : 'No puedes continuar hasta que cocina reciba esos productos o un usuario autorizado revise la cuenta.'}
              </span>
            </div>
          )}

          <div className="checkout-review-lines" aria-label="Productos de la cuenta">
            <div className="checkout-review-line header" aria-hidden="true">
              <span>Producto</span>
              <span>Cant.</span>
              <span>Precio unitario</span>
              <span>Total por línea</span>
              <span>Estado</span>
            </div>
            {order.items.map((item) => (
              <article className="checkout-review-line" key={item.id}>
                <div className="checkout-review-product">
                  <strong>{item.menuItem.name}</strong>
                  <span>{item.notes ? `Nota: ${item.notes}` : 'Sin nota'}</span>
                  {item.modifiers.length > 0 ? (
                    <small>
                      Adicionales: {item.modifiers.map((modifier) => `${modifier.quantity}x ${modifier.nameSnapshot} (${money(numberValue(modifier.priceDelta))})`).join(', ')}
                    </small>
                  ) : (
                    <small>Sin adicionales</small>
                  )}
                </div>
                <span>{item.quantity}</span>
                <span>{money(numberValue(item.unitPrice))}</span>
                <strong>{money(numberValue(item.total))}</strong>
                <span className={`item-status ${item.status.toLowerCase().replaceAll('_', '-')}`}>{orderItemStatusLabel(item.status)}</span>
              </article>
            ))}
          </div>

          <div className="checkout-review-totals" aria-label="Totales de la cuenta">
            <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <div><span>Impuestos</span><strong>{money(taxTotal)}</strong></div>
            <div><span>Descuentos existentes</span><strong>{money(discountTotal)}</strong></div>
            <div className="ticket-pay-now"><span>Total actual</span><strong>{money(total)}</strong></div>
          </div>

          {reviewBlockMessage && <p className="checkout-review-block-message">{reviewBlockMessage}</p>}

          <div className="checkout-wizard-actions">
            <button className="secondary-action" type="button" onClick={onCancel}>Cancelar cobro</button>
            <button className="primary-action" type="button" disabled={!canContinueFromReview} onClick={() => goToCheckoutStep(2)}>Continuar</button>
          </div>
        </div>
      )}

      {checkoutStep === 2 && (
        <div className="checkout-step-panel">
          <h3>Propina y descuento</h3>
          <div className="checkout-step-total-bar" aria-label="Total actualizado">
            <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <div><span>Descuento actual</span><strong>{money(discountTotal)}</strong></div>
            <div><span>Propina seleccionada</span><strong>{money(tipAmount)}</strong></div>
            <div className="ticket-pay-now"><span>Total actualizado</span><strong>{money(previewBalance)}</strong></div>
          </div>
          <TipSelector allowCustomTip={cashierConfig.allowCustomTip} balance={balance} onCustomTipChange={onCustomTipChange} onTipPercentage={onTipPercentage} previewBalance={previewBalance} tipAmount={tipAmount} />
          <DiscountSection canApplyDiscount={canApplyCheckoutDiscount} discountTotal={discountTotal} onApplyDiscount={onApplyDiscount} order={order} previewBalance={previewBalance} />
          <div className="checkout-wizard-actions">
            <button className="secondary-action" type="button" onClick={() => goToCheckoutStep(1)}>Atrás</button>
            <button className="secondary-action" type="button" onClick={onCancel}>Cancelar cobro</button>
            <button className="primary-action" type="button" onClick={() => goToCheckoutStep(3)}>Continuar</button>
          </div>
        </div>
      )}

      {checkoutStep === 3 && (
        <div className="checkout-step-panel">
          <h3>Método de pago</h3>
          <PaymentMethodSelector
            allowMixedPayments={cashierConfig.allowMixedPayments}
            cashChange={cashChange}
            mixedPayments={mixedPayments}
            mixedPaymentsTotal={mixedPaymentsTotal}
            onAddMixedPayment={onAddMixedPayment}
            onMethodChange={onPaymentMethodChange}
            onPaymentAmountChange={onPaymentAmountChange}
            onRemoveMixedPayment={onRemoveMixedPayment}
            onUpdateMixedPayment={onUpdateMixedPayment}
            paymentAmount={paymentAmount}
            paymentMethod={paymentMethod}
            previewBalance={previewBalance}
          />
          <div className="checkout-wizard-actions">
            <button className="secondary-action" type="button" onClick={() => goToCheckoutStep(2)}>Atrás</button>
            <button className="secondary-action" type="button" onClick={onCancel}>Cancelar cobro</button>
            <button className="primary-action" type="button" disabled={!canContinueFromPayment} onClick={() => goToCheckoutStep(4)}>Continuar</button>
          </div>
          {paymentBlockMessage && <p className="checkout-review-block-message">{paymentBlockMessage}</p>}
        </div>
      )}

      {checkoutStep === 4 && (
        <form className="checkout-step-panel" onSubmit={onRegisterPayment}>
          <h3>Confirmar y cerrar mesa</h3>
          <div className="checkout-confirm-grid">
            <div><span>Mesa</span><strong>{order.table.name || `Mesa ${order.table.number}`}</strong></div>
            <div><span>Mesero</span><strong>{waiterName(order)}</strong></div>
            <div><span>Orden</span><strong>{order.orderNumber}</strong></div>
          </div>
          <PaymentSummary cashChange={cashChange} discountTotal={discountTotal} mixedPaymentsTotal={mixedPaymentsTotal} paymentAmount={paymentAmount} paymentMethod={paymentMethod} previewBalance={previewBalance} subtotal={subtotal} taxTotal={taxTotal} tipAmount={tipAmount} />
          <div className="checkout-confirm-grid">
            <div><span>Método de pago</span><strong>{paymentMethodLabel(paymentMethod)}</strong></div>
            <div>
              <span>Monto recibido</span>
              <strong>{money(paymentMethod === 'MIXED' ? mixedPaymentsTotal : paymentMethod === 'CASH' ? paymentAmount : previewBalance)}</strong>
            </div>
            <div><span>Cambio</span><strong>{money(cashChange)}</strong></div>
          </div>
          {paymentMethod !== 'MIXED' && <input name="reference" placeholder="Referencia opcional" />}
          <input name="amount" type="hidden" value={paymentMethod === 'CASH' ? paymentAmount : previewBalance} />
          <label>
            Estado de la mesa después del pago
            <select name="closeTableStatus" defaultValue={cashierConfig.afterPaymentTableStatus}>
              <option value="CLEANING">Mesa a limpieza</option>
              <option value="AVAILABLE">Mesa disponible</option>
            </select>
          </label>
          <div className="checkout-wizard-actions">
            <button className="secondary-action" type="button" onClick={() => goToCheckoutStep(3)}>Atrás</button>
            <button className="secondary-action" type="button" onClick={onCancel}>Cancelar cobro</button>
            <ConfirmPaymentButton disabled={(cashierConfig.requireOpenCashRegister && !cashRegister) || isRegisteringPayment || order.status === 'PAID'} isRegisteringPayment={isRegisteringPayment} />
          </div>
        </form>
      )}
    </section>
  );
}

function FinalReceiptPanel({
  onDownload,
  onPrint,
  order
}: {
  onDownload: (order: CashierOrder) => void;
  onPrint: (order: CashierOrder) => void;
  order: CashierOrder;
}) {
  return (
    <section className="panel final-invoice-panel" aria-label="Factura final">
      <header>
        <div>
          <p className="eyebrow">Factura final</p>
          <h2>Mesa {order.table.number} pagada</h2>
          <span>{order.orderNumber} - Total cobrado {money(numberValue(order.total))}</span>
        </div>
        <div className="cashier-inline-actions">
          <button className="secondary-action" type="button" onClick={() => onPrint(order)}>Imprimir factura</button>
          <button className="secondary-action" type="button" onClick={() => onDownload(order)}>Descargar factura</button>
        </div>
      </header>
      <div className="ticket-preview-lines">
        <div><span>Subtotal</span><strong>{money(numberValue(order.subtotal))}</strong></div>
        <div><span>Descuento</span><strong>{money(numberValue(order.discountTotal))}</strong></div>
        <div><span>Impuestos</span><strong>{money(numberValue(order.taxTotal))}</strong></div>
        <div><span>Propina</span><strong>{money(numberValue(order.tipTotal))}</strong></div>
        <div><span>Pagado</span><strong>{money(paidTotal(order))}</strong></div>
        <div className="ticket-pay-now"><span>Total final</span><strong>{money(numberValue(order.total))}</strong></div>
      </div>
      <p>Factura lista para entregar al cliente. La mesa ya puede quedar disponible o en limpieza segun el cierre seleccionado.</p>
    </section>
  );
}

export default function CashierPage() {
  const { accessToken, logout, refreshAccessToken, user } = useAuth();
  const { theme } = useAppTheme();
  const canUseApi = Boolean(accessToken);
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [orders, setOrders] = useState<CashierOrder[]>([]);
  const [cashierConfig, setCashierConfig] = useState<CashierConfig>({
    allowCashierRequestPayment: true,
    allowCustomTip: true,
    allowMixedPayments: true,
    allowSplitBill: true,
    afterPaymentTableStatus: 'CLEANING',
    printReceiptAfterPayment: true,
    requireOpenCashRegister: true,
    showTipOnReceipt: true,
    suggestedTipRate: 10,
    taxRate: 0,
    tipSuggestions: [0, 5, 10]
  });
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [summary, setSummary] = useState<CashRegisterSummary | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [tipAmount, setTipAmount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [splitCount, setSplitCount] = useState(1);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [receiptSnapshot, setReceiptSnapshot] = useState<CashierOrder | null>(null);
  const [finalInvoiceOrder, setFinalInvoiceOrder] = useState<CashierOrder | null>(null);
  const [downloadLink, setDownloadLink] = useState<{ fileName: string; html: string; url: string } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isPreparingCheckoutId, setIsPreparingCheckoutId] = useState('');
  const [isMovingToPayment, setIsMovingToPayment] = useState(false);
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(1);
  const [mixedPayments, setMixedPayments] = useState<Array<{ method: Exclude<PaymentMethod, 'MIXED'>; amount: number; reference: string }>>([
    { amount: 0, method: 'CASH', reference: '' },
    { amount: 0, method: 'CARD', reference: '' }
  ]);

  const sortedOrders = useMemo(() => [...orders].sort(compareCashierOrdersByTable), [orders]);
  const paymentQueue = useMemo(() => sortedOrders.filter(isWaitingPaymentOrder), [sortedOrders]);
  const reviewOrders = useMemo(() => sortedOrders.filter((order) => !isWaitingPaymentOrder(order)), [sortedOrders]);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? paymentQueue[0] ?? sortedOrders[0];
  const subtotal = selectedOrder ? numberValue(selectedOrder.subtotal) : 0;
  const discountTotal = selectedOrder ? numberValue(selectedOrder.discountTotal) : 0;
  const taxTotal = selectedOrder ? numberValue(selectedOrder.taxTotal) : 0;
  const tipTotal = selectedOrder ? numberValue(selectedOrder.tipTotal) : 0;
  const total = selectedOrder ? numberValue(selectedOrder.total) : 0;
  const paid = selectedOrder ? paidTotal(selectedOrder) : 0;
  const balance = Math.max(0, total - paid);
  const suggestedTipAmount = Math.round(balance * 0.1);
  const totalWithoutTip = balance;
  const totalWithSuggestedTip = balance + suggestedTipAmount;
  const previewBalance = balance + tipAmount;
  const isSelectedOrderPaid = selectedOrder?.status === 'PAID';
  const selectedTotalWithoutTip = selectedOrder ? Math.max(0, subtotal - discountTotal + taxTotal) : 0;
  const ticketTotalWithoutTip = isSelectedOrderPaid ? selectedTotalWithoutTip : totalWithoutTip;
  const ticketSuggestedTipAmount = isSelectedOrderPaid ? tipTotal : suggestedTipAmount;
  const ticketTotalWithSuggestedTip = isSelectedOrderPaid ? total : totalWithSuggestedTip;
  const ticketAmountToShow = isSelectedOrderPaid ? total : previewBalance;
  const splitAmount = useMemo(() => previewBalance / Math.max(1, splitCount), [previewBalance, splitCount]);
  const mixedPaymentsTotal = useMemo(() => mixedPayments.reduce((sum, payment) => sum + numberValue(payment.amount), 0), [mixedPayments]);
  const cashChange = paymentMethod === 'CASH' ? Math.max(0, paymentAmount - previewBalance) : 0;
  const receiptOrder = receiptSnapshot ?? orders.find((order) => order.id === printOrderId);
  const displayedFinalInvoiceOrder = finalInvoiceOrder ?? (selectedOrder?.status === 'PAID' ? selectedOrder : null);
  const homeRoute = user ? routeForRole(user.role) : '/login';
  const canApplyCheckoutDiscount = user ? ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role) : false;
  const canContinueCheckoutWithPendingItems = user ? ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role) : false;
  const canRequestPaymentFromCashier = Boolean(
    selectedOrder &&
    user &&
    ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'].includes(user.role) &&
    cashierConfig.allowCashierRequestPayment &&
    canMoveOrderToPayment(selectedOrder)
  );
  const canStartCheckout = Boolean(selectedOrder && (isWaitingPaymentOrder(selectedOrder) || canRequestPaymentFromCashier));

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

  useEffect(() => {
    if (!canUseApi || !accessToken) {
      setFeedback('Inicia sesion con backend real para operar caja.');
      return;
    }

    void loadCashierData();
    const interval = window.setInterval(() => void loadCashierData(true), 5000);

    return () => window.clearInterval(interval);
  }, [accessToken, canUseApi]);

  useEffect(() => {
    setTipAmount(0);
    setPaymentAmount(balance);
    setCheckoutStarted(false);
    setCheckoutStep(1);
    setPaymentMethod('CASH');
    setMixedPayments([
      { amount: 0, method: 'CASH', reference: '' },
      { amount: 0, method: 'CARD', reference: '' }
    ]);
    if (downloadLink?.url) {
      window.URL.revokeObjectURL(downloadLink.url);
    }
    setDownloadLink(null);
  }, [selectedOrderId, balance]);

  useEffect(() => {
    return () => {
      if (downloadLink?.url) {
        window.URL.revokeObjectURL(downloadLink.url);
      }
    };
  }, [downloadLink]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const isSuccessMessage = /correctamente|registrado|liberada|guardado|generada|solicitada/i.test(feedback);

    if (!isSuccessMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setFeedback(''), 3000);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function loadCashierData(silent = false) {
    if (!accessToken) return;

    try {
      const [registerResponse, ordersResponse, configResponse] = await Promise.all([
        fetchWithAuth('/cashier/cash-registers/current'),
        fetchWithAuth('/cashier/orders/open'),
        fetchWithAuth('/cashier/config')
      ]);
      const register = registerResponse.status === 204 ? null : await readApi<CashRegister | null>(registerResponse);
      let nextOrders = await readApi<CashierOrder[]>(ordersResponse);
      const nextConfig = await readApi<CashierConfig>(configResponse);
      const requestedOrderId = new URLSearchParams(window.location.search).get('orderId');

      if (requestedOrderId && !nextOrders.some((order) => order.id === requestedOrderId)) {
        const requestedOrderResponse = await fetchWithAuth(`/cashier/orders/${requestedOrderId}`);
        if (requestedOrderResponse.ok) {
          const requestedOrder = await readApi<CashierOrder>(requestedOrderResponse);
          nextOrders = [requestedOrder, ...nextOrders];
        }
      }

      setCashRegister(register);
      setOrders(nextOrders);
      setCashierConfig(nextConfig);
      setSelectedOrderId((current) => {
        if (requestedOrderId && nextOrders.some((order) => order.id === requestedOrderId)) {
          return requestedOrderId;
        }

        const nextPaymentQueue = [...nextOrders].sort(compareCashierOrdersByTable).filter(isWaitingPaymentOrder);

        return nextOrders.some((order) => order.id === current) ? current : nextPaymentQueue[0]?.id ?? nextOrders[0]?.id ?? '';
      });

      if (register) {
        const summaryResponse = await fetchWithAuth(`/cashier/cash-registers/${register.id}/summary`);
        setSummary(await readApi<CashRegisterSummary>(summaryResponse));
      } else {
        setSummary(null);
      }

      setFeedback(silent ? '' : register ? 'Caja abierta y ordenes sincronizadas.' : 'Debes abrir caja antes de cobrar.');
    } catch (error) {
      setFeedback(error instanceof Error ? normalizeCashierError(error.message) : 'Error de conexión con el servidor.');
    }
  }

  async function openRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetchWithAuth('/cashier/cash-registers/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: String(form.get('name') ?? 'Caja principal'),
          openingAmount: Number(form.get('openingAmount') ?? 0),
          notes: String(form.get('notes') ?? '')
        })
      });

      setCashRegister(await readApi<CashRegister>(response));
      await loadCashierData(true);
      setFeedback('Caja abierta correctamente.');
      formElement.reset();
    } catch {
      setFeedback('No se pudo abrir caja.');
    }
  }

  async function closeRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setFeedback('Debes iniciar sesion para cerrar caja.');
      return;
    }

    if (!cashRegister) {
      setFeedback('No hay una caja abierta para cerrar.');
      return;
    }

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetchWithAuth(`/cashier/cash-registers/${cashRegister.id}/close`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          closingAmount: Number(form.get('closingAmount') ?? 0),
          notes: String(form.get('notes') ?? '')
        })
      });

      await readApi<CashRegister>(response);
      setCashRegister(null);
      await loadCashierData(true);
      setFeedback('Caja cerrada correctamente. El turno quedo finalizado.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setFeedback(error instanceof Error ? `No se pudo cerrar caja: ${error.message}` : 'No se pudo cerrar caja.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function applyDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !selectedOrder) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const type = String(form.get('type')) as DiscountType;
    const value = Number(form.get('value') ?? 0);
    const subtotalForDiscount = numberValue(selectedOrder.subtotal);
    const calculatedDiscount = type === 'PERCENTAGE' ? Math.round(subtotalForDiscount * (value / 100)) : value;

    if (!Number.isFinite(value) || value <= 0) {
      setFeedback('Ingresa un descuento valido.');
      return;
    }

    if ((type === 'PERCENTAGE' && value > 100) || calculatedDiscount > Math.max(0, numberValue(selectedOrder.total))) {
      setFeedback('El descuento no puede ser mayor al total.');
      return;
    }

    try {
      const response = await fetchWithAuth(`/cashier/orders/${selectedOrder.id}/discounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: String(form.get('name') ?? 'Descuento caja'),
          type,
          value,
          reason: String(form.get('reason') ?? '')
        })
      });

      const updatedOrder = await readApi<CashierOrder>(response);
      setOrders((current) => current.map((order) => order.id === updatedOrder.id ? updatedOrder : order));
      setFeedback('Descuento aplicado correctamente.');
      formElement.reset();
    } catch (error) {
      setFeedback(error instanceof Error ? normalizeCashierError(error.message) : 'No tienes permiso para aplicar descuentos.');
    }
  }

  async function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isRegisteringPayment) {
      return;
    }

    if (!accessToken || !selectedOrder || !cashRegister) {
      setFeedback('Debes abrir caja antes de cobrar.');
      return;
    }

    if (selectedOrder.status === 'PAID') {
      setFeedback('Esta cuenta ya fue pagada.');
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const closeTableStatus = String(form.get('closeTableStatus') ?? 'CLEANING') as CloseTableStatus;

    if (paymentMethod === 'MIXED' && Math.abs(mixedPaymentsTotal - previewBalance) > 0.01) {
      setFeedback('La suma de los pagos no coincide con el total.');
      return;
    }

    const body =
      paymentMethod === 'MIXED'
        ? {
            cashRegisterId: cashRegister.id,
            discount: { type: null, value: 0 },
            tipAmount,
            closeTableStatus,
            payments: mixedPayments
              .filter((payment) => payment.amount > 0)
              .map((payment) => ({
                amount: payment.amount,
                method: payment.method,
                reference: payment.reference
              }))
          }
        : {
            cashRegisterId: cashRegister.id,
            discount: { type: null, value: 0 },
            tipAmount,
            closeTableStatus,
            payments: [
              {
                method: paymentMethod,
                amount: paymentMethod === 'CASH' ? Number(form.get('amount') || paymentAmount || previewBalance) : previewBalance,
                reference: String(form.get('reference') ?? '')
              }
            ]
          };

    try {
      setIsRegisteringPayment(true);
      const response = await fetchWithAuth(`/orders/${selectedOrder.id}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const checkoutResponse = await readApi<{ order?: CashierOrder; data?: { order: CashierOrder } }>(response);
      const updatedOrder = checkoutResponse.data?.order ?? checkoutResponse.order;

      if (!updatedOrder) {
        throw new Error('No se recibio la orden pagada desde el servidor.');
      }

      setReceiptSnapshot(updatedOrder);
      setFinalInvoiceOrder(updatedOrder);
      setOrders((current) => current.map((order) => order.id === updatedOrder.id ? updatedOrder : order).filter((order) => order.status !== 'PAID'));
      setCheckoutStarted(false);
      setCheckoutStep(1);
      setSelectedOrderId('');
      if (updatedOrder.status === 'PAID') {
        window.localStorage.setItem(
          'restaurant-order-paid',
          JSON.stringify({
            orderId: updatedOrder.id,
            tableId: updatedOrder.table.id,
            tableStatus: updatedOrder.table.status || closeTableStatus,
            paidAt: new Date().toISOString()
          })
        );
      }
      if (cashierConfig.printReceiptAfterPayment) {
        setPrintOrderId(updatedOrder.id);
      }
      setTipAmount(0);
      setPaymentAmount(0);
      await loadCashierData(true);
      setFeedback(updatedOrder.status === 'PAID' ? 'Pago registrado correctamente. Mesa liberada.' : 'Pago parcial registrado.');
      formElement.reset();
    } catch (error) {
      setFeedback(error instanceof Error ? normalizeCashierError(error.message) : 'No se pudo registrar el pago. Intenta nuevamente.');
    } finally {
      setIsRegisteringPayment(false);
    }
  }

  function printReceipt(order: CashierOrder) {
    setReceiptSnapshot(order);
    setPrintOrderId(order.id);
    setFeedback(order.status === 'PAID' ? 'Factura final lista para imprimir.' : 'Cuenta previa lista para imprimir.');
    window.setTimeout(() => window.print(), 220);
  }

  function downloadTicket(order: CashierOrder) {
    const html = buildTicketHtml({
      ...ticketAmountsForOrder(order, {
        discountTotal,
        paid,
        previewBalance,
        selectedOrderId: selectedOrder?.id,
        subtotal,
        suggestedTipAmount,
        taxTotal,
        tipAmount,
        totalWithSuggestedTip,
        totalWithoutTip
      }),
      order,
      restaurantName: theme.restaurantName
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const fileName = `${order.status === 'PAID' ? 'factura-final' : 'cuenta-previa'}-${order.orderNumber}.html`;

    if (downloadLink?.url) {
      window.URL.revokeObjectURL(downloadLink.url);
    }

    setDownloadLink({ fileName, html, url });
    setFeedback(order.status === 'PAID' ? 'Factura final generada. Toca Guardar archivo en PC.' : 'Cuenta previa generada. Toca Guardar archivo en PC.');
  }

  async function saveTicketFile() {
    if (!downloadLink) {
      setFeedback('Primero toca Descargar cuenta previa para generar el archivo.');
      return;
    }

    const pickerWindow = window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName: string;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
    };
    const fileBlob = new Blob([downloadLink.html], { type: 'text/html;charset=utf-8' });

    try {
      if (pickerWindow.showSaveFilePicker) {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: downloadLink.fileName,
          types: [
            {
              description: 'Cuenta previa HTML',
              accept: { 'text/html': ['.html'] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(fileBlob);
        await writable.close();
        setFeedback(`Archivo guardado correctamente: ${downloadLink.fileName}`);
        return;
      }

      const link = document.createElement('a');
      link.href = downloadLink.url;
      link.download = downloadLink.fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setFeedback(`Descarga solicitada: revisa la carpeta Descargas para ${downloadLink.fileName}.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setFeedback('Guardado cancelado.');
        return;
      }

      setFeedback('No se pudo guardar automaticamente. Usa Imprimir cuenta previa y elige Guardar como PDF.');
    }
  }

  function chooseTipPercentage(percent: number) {
    const nextTip = Math.round(balance * (percent / 100));
    setTipAmount(nextTip);
    setPaymentAmount(balance + nextTip);
  }

  function preparePaymentWithoutTip() {
    setTipAmount(0);
    setPaymentAmount(balance);
    setCheckoutStarted(true);
    window.setTimeout(() => document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  function preparePaymentWithSuggestedTip() {
    setTipAmount(suggestedTipAmount);
    setPaymentAmount(totalWithSuggestedTip);
    setCheckoutStarted(true);
    window.setTimeout(() => document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  async function prepareSelectedTableInvoice() {
    if (!selectedOrder) {
      setFeedback('No se pudo iniciar el cobro.');
      return;
    }

    await startCheckoutForOrder(selectedOrder);
  }

  function openCheckoutWizardForOrder(order: CashierOrder) {
    const orderBalance = Math.max(0, numberValue(order.total) - paidTotal(order));

    setPaymentMethod('CASH');
    setTipAmount(0);
    setPaymentAmount(orderBalance);
    setCheckoutStarted(true);
    setCheckoutStep(1);
    window.setTimeout(() => document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function prepareOrderInvoice(order: CashierOrder) {
    if (cashierConfig.requireOpenCashRegister && !cashRegister) {
      setFeedback('Debes abrir caja antes de cobrar.');
      window.setTimeout(() => document.getElementById('open-register-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      return;
    }

    if (!isWaitingPaymentOrder(order)) {
      const canRequestPaymentForOrder = Boolean(
        user &&
        ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'].includes(user.role) &&
        cashierConfig.allowCashierRequestPayment &&
        canMoveOrderToPayment(order)
      );

      if (!canRequestPaymentForOrder) {
        setFeedback(cashierConfig.allowCashierRequestPayment ? 'La cuenta aún no fue solicitada por el mesero.' : 'La configuración no permite pasar cuentas a cobro desde caja.');
        return;
      }

      try {
        setIsMovingToPayment(true);
        const response = await fetchWithAuth(`/orders/${order.id}/mark-waiting-payment`, { method: 'PATCH' });
        const markPaymentResponse = await readApi<{ order: CashierOrder }>(response);
        const updatedOrder = markPaymentResponse.order;
        setOrders((current) => current.map((currentOrder) => currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder));
        setSelectedOrderId(updatedOrder.id);
        setFeedback('Mesa pasada a cuenta. Puedes cobrar ahora.');
        openCheckoutWizardForOrder(updatedOrder);
        return;
      } catch (error) {
        setFeedback(error instanceof Error ? normalizeCashierError(error.message) : 'No se pudo pasar la mesa a cuenta.');
        return;
      } finally {
        setIsMovingToPayment(false);
      }
    }

    openCheckoutWizardForOrder(order);
  }

  async function startCheckoutForOrder(order?: CashierOrder | null) {
    try {
      if (!order?.id) {
        setFeedback('No se pudo iniciar el cobro.');
        return;
      }

      if (cashierConfig.requireOpenCashRegister && !cashRegister) {
        setSelectedOrderId(order.id);
        setFeedback('Debes abrir caja antes de cobrar.');
        window.setTimeout(() => document.getElementById('open-register-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
        return;
      }

      setSelectedOrderId(order.id);
      setIsPreparingCheckoutId(order.id);

      if (isWaitingPaymentOrder(order)) {
        openCheckoutWizardForOrder(order);
        return;
      }

      const canRequestPaymentForOrder = Boolean(
        user &&
        ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'].includes(user.role) &&
        cashierConfig.allowCashierRequestPayment &&
        canMoveOrderToPayment(order)
      );

      if (!canRequestPaymentForOrder) {
        setFeedback(cashierConfig.allowCashierRequestPayment ? 'La cuenta aún no fue solicitada por el mesero.' : 'La configuración no permite pasar cuentas a cobro desde caja.');
        return;
      }

      setIsMovingToPayment(true);
      const response = await fetchWithAuth(`/orders/${order.id}/mark-waiting-payment`, { method: 'PATCH' });
      const markPaymentResponse = await readApi<{ order: CashierOrder }>(response);
      const updatedOrder = markPaymentResponse.order;

      setOrders((current) => current.map((currentOrder) => currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder));
      setSelectedOrderId(updatedOrder.id);
      setFeedback('Mesa pasada a cuenta. Puedes cobrar ahora.');
      openCheckoutWizardForOrder(updatedOrder);
    } catch (error) {
      const normalized = error instanceof Error ? normalizeCashierError(error.message) : '';
      setFeedback(normalized && normalized !== 'No se pudo registrar el pago. Intenta nuevamente.' ? normalized : 'No se pudo iniciar el cobro.');
    } finally {
      setIsMovingToPayment(false);
      setIsPreparingCheckoutId('');
    }
  }

  function updateMixedPayment(index: number, patch: Partial<{ method: Exclude<PaymentMethod, 'MIXED'>; amount: number; reference: string }>) {
    setMixedPayments((current) => current.map((payment, paymentIndex) => (paymentIndex === index ? { ...payment, ...patch } : payment)));
  }

  function addMixedPaymentLine() {
    setMixedPayments((current) => [...current, { amount: 0, method: 'CASH', reference: '' }]);
  }

  function removeMixedPaymentLine(index: number) {
    setMixedPayments((current) => current.filter((_, paymentIndex) => paymentIndex !== index));
  }

  function goToCheckoutStep(step: CheckoutStep) {
    setCheckoutStep(step);
    window.setTimeout(() => document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function signOut() {
    await logout();
    window.location.assign('/login');
  }

  return (
    <AuthGate allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER']}>
      <main className="cashier-shell">
        <header className="topbar">
          <div>
            <nav className="breadcrumb" aria-label="Ruta">
              <button type="button" onClick={() => window.location.assign(homeRoute)}>Inicio</button>
              <span>/</span>
              <strong>Caja</strong>
            </nav>
            <p className="eyebrow">Fase 9</p>
            <h1>Caja operativa</h1>
            <span className="screen-action">Abrir caja, cobrar mesas reales, registrar pagos y cerrar turno.</span>
          </div>
          <button className="back-button" type="button" onClick={() => document.getElementById('pending-orders')?.scrollIntoView({ behavior: 'smooth' })}>
            &lt;- Volver a ordenes
          </button>
          <button className="secondary-action" type="button" onClick={() => void signOut()}>
            Salir / cambiar usuario
          </button>
          <div className="shift-summary">
            <strong>{cashRegister ? 'Abierta' : 'Cerrada'}</strong>
            <span>{paymentQueue.length} mesas por cobrar</span>
          </div>
        </header>
        {feedback && <div className="pos-feedback">{feedback}</div>}
        <CashierDashboard>

        {!cashRegister && cashierConfig.requireOpenCashRegister && <OpenCashRegisterPanel onOpen={openRegister} />}

        {(cashRegister || !cashierConfig.requireOpenCashRegister) && (
          <>
        <CashRegisterStatusCard cashRegister={cashRegister} currentUserEmail={user?.email} onClose={closeRegister} summary={summary} />

        <section className="cashier-flow-header" aria-label="Flujo de cobro">
          <article aria-current="step" className="active">
            <span>1</span>
            <strong>Elegir mesa</strong>
            <em>{paymentQueue.length} pendientes de pago</em>
          </article>
          <article aria-current={selectedOrder ? 'step' : undefined} className={selectedOrder ? 'active' : ''}>
            <span>2</span>
            <strong>Revisar prefactura</strong>
            <em>Productos, descuentos e impuestos</em>
          </article>
          <article aria-current={checkoutStarted ? 'step' : undefined} className={checkoutStarted ? 'active' : ''}>
            <span>3</span>
            <strong>Cobrar / facturar</strong>
            <em>Pago, propina y cierre de mesa</em>
          </article>
        </section>

        <section className="cashier-main-actions" aria-label="Acciones principales de caja">
          <button type="button" disabled={Boolean(cashRegister)} onClick={() => document.getElementById('open-register-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            Abrir caja
          </button>
          <button type="button" onClick={() => document.getElementById('close-register-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            Cerrar caja
          </button>
          <button type="button" onClick={() => document.getElementById('pending-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Ver mesas pendientes de pago
          </button>
          <button type="button" onClick={() => document.getElementById('cashier-day-movements')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Ver movimientos del dia
          </button>
        </section>

        {!cashRegister && cashierConfig.requireOpenCashRegister && (
          <div className="cashier-blocked-banner">Debes abrir caja antes de cobrar.</div>
        )}

        <section className="cashier-layout">
          <PendingPaymentTables
            cashRegister={cashRegister}
            cashierConfig={cashierConfig}
            isPreparingCheckoutId={isPreparingCheckoutId}
            onCharge={(order) => {
              setSelectedOrderId(order.id);
              void startCheckoutForOrder(order);
            }}
            onSelect={setSelectedOrderId}
            paymentQueue={paymentQueue}
            reviewOrders={reviewOrders}
            selectedOrder={selectedOrder}
          />

          <section className="panel cashier-detail">
            {selectedOrder ? (
              <>
                <div className="section-title">
                  <div>
                    <h2>Mesa {selectedOrder.table.number}</h2>
                    <span>{selectedOrder.orderNumber} - {selectedOrder.status}</span>
                  </div>
                  <div className="cashier-inline-actions">
                    <button className="secondary-action" type="button" onClick={() => window.location.assign(`/mesero/pedidos?tableId=${selectedOrder.table.id}`)}>
                      Editar pedido antes de cobrar
                    </button>
                    <button
                      className="primary-action"
                      type="button"
                      onClick={prepareSelectedTableInvoice}
                      disabled={!canStartCheckout || isMovingToPayment || (cashierConfig.requireOpenCashRegister && !cashRegister)}
                    >
                      {isWaitingPaymentOrder(selectedOrder)
                        ? 'Cobrar / Facturar'
                        : isMovingToPayment
                          ? 'Pasando a cuenta...'
                          : 'Pasar a cuenta y cobrar'}
                    </button>
                  </div>
                </div>
                {!isWaitingPaymentOrder(selectedOrder) && (
                  <div className={canRequestPaymentFromCashier ? 'cashier-help-note' : 'cashier-help-note warning'}>
                    <strong>{canRequestPaymentFromCashier ? 'Esta mesa aún no tiene cuenta solicitada.' : 'La cuenta aún no fue solicitada por el mesero.'}</strong>
                    <span>
                      {canRequestPaymentFromCashier
                        ? 'Puedes pasarla a cuenta desde caja y continuar con el cobro.'
                        : cashierConfig.allowCashierRequestPayment
                          ? 'No tienes permiso para pasar esta orden a cobro desde caja.'
                          : 'La configuración no permite pasar cuentas a cobro desde caja.'}
                    </span>
                    {!canRequestPaymentFromCashier && (
                      <button className="secondary-action" type="button" onClick={() => document.getElementById('pending-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                        Volver
                      </button>
                    )}
                  </div>
                )}
                <PreInvoicePanel
                  cashRegister={cashRegister}
                  cashierConfig={cashierConfig}
                  canStartCheckout={canStartCheckout && !isMovingToPayment}
                  checkoutButtonLabel={isWaitingPaymentOrder(selectedOrder) ? 'Cobrar / Facturar' : isMovingToPayment ? 'Pasando a cuenta...' : 'Pasar a cuenta y cobrar'}
                  discountTotal={discountTotal}
                  downloadLink={downloadLink}
                  onDownload={downloadTicket}
                  onPrint={printReceipt}
                  onSaveTicket={() => void saveTicketFile()}
                  onStartCheckout={prepareSelectedTableInvoice}
                  order={selectedOrder}
                  paid={paid}
                  subtotal={subtotal}
                  taxTotal={taxTotal}
                  themeName={theme.restaurantName}
                  ticketSuggestedTipAmount={ticketSuggestedTipAmount}
                  ticketTotalWithSuggestedTip={ticketTotalWithSuggestedTip}
                  ticketTotalWithoutTip={ticketTotalWithoutTip}
                />

                {checkoutStarted ? (
                  <>
                  <CheckoutWizard
                    balance={balance}
                    canApplyCheckoutDiscount={canApplyCheckoutDiscount}
                    canContinueWithPendingItems={canContinueCheckoutWithPendingItems}
                    cashChange={cashChange}
                    cashRegister={cashRegister}
                    cashierConfig={cashierConfig}
                    checkoutStep={checkoutStep}
                    discountTotal={discountTotal}
                    goToCheckoutStep={goToCheckoutStep}
                    isRegisteringPayment={isRegisteringPayment}
                    mixedPayments={mixedPayments}
                    mixedPaymentsTotal={mixedPaymentsTotal}
                    onAddMixedPayment={addMixedPaymentLine}
                    onApplyDiscount={applyDiscount}
                    onCancel={() => {
                      setCheckoutStarted(false);
                      setCheckoutStep(1);
                    }}
                    onCustomTipChange={(nextTip) => {
                      setTipAmount(nextTip);
                      setPaymentAmount(balance + nextTip);
                    }}
                    onPaymentAmountChange={setPaymentAmount}
                    onPaymentMethodChange={setPaymentMethod}
                    onRegisterPayment={registerPayment}
                    onRemoveMixedPayment={removeMixedPaymentLine}
                    onTipPercentage={chooseTipPercentage}
                    onUpdateMixedPayment={updateMixedPayment}
                    order={selectedOrder}
                    paymentAmount={paymentAmount}
                    paymentMethod={paymentMethod}
                    previewBalance={previewBalance}
                    subtotal={subtotal}
                    taxTotal={taxTotal}
                    tipAmount={tipAmount}
                    total={total}
                  />
                  <section hidden aria-hidden="true" className="cashier-step cashier-payment-panel" id="payment-form-legacy" aria-label="Flujo de cobro guiado anterior">
                    <div className="section-title">
                      <div>
                        <p className="eyebrow">Cobro / facturacion final</p>
                        <h2>Paso {checkoutStep} de 5</h2>
                      </div>
                      <span>{cashRegister ? `Total final actual: ${money(previewBalance)}` : 'Abre caja primero'}</span>
                    </div>

                    <div className="checkout-step-tabs" aria-label="Pasos de cobro">
                      {['Cuenta', 'Pago', 'Propina', 'Descuento', 'Confirmar'].map((label, index) => (
                        <button
                          className={checkoutStep === index + 1 ? 'active' : ''}
                          key={label}
                          type="button"
                          onClick={() => goToCheckoutStep((index + 1) as CheckoutStep)}
                        >
                          {index + 1}. {label}
                        </button>
                      ))}
                    </div>

                    {checkoutStep === 1 && (
                      <div className="checkout-step-panel">
                        <h3>Confirmar cuenta</h3>
                        <div className="checkout-confirm-grid">
                          <div><span>Mesa</span><strong>{selectedOrder.table.name || `Mesa ${selectedOrder.table.number}`}</strong></div>
                          <div><span>Mesero</span><strong>{waiterName(selectedOrder)}</strong></div>
                          <div><span>Total actual</span><strong>{money(total)}</strong></div>
                        </div>
                        <div className="consumption-list">
                          {selectedOrder.items.map((item) => (
                            <article key={item.id}>
                              <div>
                                <strong>{item.quantity}x {item.menuItem.name}</strong>
                                <span>{item.notes ? `Nota: ${item.notes}` : 'Sin nota'}</span>
                              </div>
                              <strong>{money(numberValue(item.total))}</strong>
                            </article>
                          ))}
                        </div>
                        <div className="ticket-preview-lines">
                          <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                          <div><span>Descuento</span><strong>{money(discountTotal)}</strong></div>
                          <div><span>Impuesto</span><strong>{money(taxTotal)}</strong></div>
                          <div><span>Propina</span><strong>{money(tipAmount)}</strong></div>
                          <div className="ticket-pay-now"><span>Total final</span><strong>{money(previewBalance)}</strong></div>
                        </div>
                        <button className="primary-action" type="button" onClick={() => goToCheckoutStep(2)}>
                          Continuar al pago
                        </button>
                      </div>
                    )}

                    {checkoutStep === 2 && (
                      <div className="checkout-step-panel">
                        <h3>Metodo de pago</h3>
                        <div className="payment-method-grid" role="radiogroup" aria-label="Metodo de pago">
                          {(['CASH', 'CARD', 'TRANSFER', 'QR'] as PaymentMethod[]).map((method) => (
                            <button className={paymentMethod === method ? 'active' : ''} key={method} type="button" onClick={() => setPaymentMethod(method)}>
                              {paymentMethodLabel(method)}
                            </button>
                          ))}
                          {cashierConfig.allowMixedPayments && (
                            <button className={paymentMethod === 'MIXED' ? 'active' : ''} type="button" onClick={() => setPaymentMethod('MIXED')}>
                              Pago mixto
                            </button>
                          )}
                        </div>

                        {paymentMethod === 'CASH' && (
                          <div className="cashier-payment-fields">
                            <label>
                              Monto recibido
                              <input min={previewBalance} type="number" value={paymentAmount || ''} onChange={(event) => setPaymentAmount(Number(event.target.value))} />
                            </label>
                            <div className="cashier-selected-charge"><span>Cambio</span><strong>{money(cashChange)}</strong></div>
                          </div>
                        )}

                        {(['CARD', 'TRANSFER', 'QR'] as PaymentMethod[]).includes(paymentMethod) && (
                          <div className="cashier-payment-fields">
                            <label>
                              Referencia opcional
                              <input placeholder="Voucher, comprobante o codigo" />
                            </label>
                            <div className="cashier-selected-charge"><span>Valor a cobrar</span><strong>{money(previewBalance)}</strong></div>
                          </div>
                        )}

                        {paymentMethod === 'MIXED' && (
                          <div className="mixed-payment-builder">
                            {mixedPayments.map((payment, index) => (
                              <div className="mixed-payment-row" key={`${payment.method}-${index}`}>
                                <select value={payment.method} onChange={(event) => updateMixedPayment(index, { method: event.target.value as Exclude<PaymentMethod, 'MIXED'> })}>
                                  <option value="CASH">Efectivo</option>
                                  <option value="CARD">Tarjeta</option>
                                  <option value="TRANSFER">Transferencia</option>
                                  <option value="QR">QR</option>
                                </select>
                                <input min="0" type="number" placeholder="Valor" value={payment.amount || ''} onChange={(event) => updateMixedPayment(index, { amount: Number(event.target.value) })} />
                                <input placeholder="Referencia" value={payment.reference} onChange={(event) => updateMixedPayment(index, { reference: event.target.value })} />
                                <button type="button" onClick={() => removeMixedPaymentLine(index)} disabled={mixedPayments.length <= 1}>Quitar</button>
                              </div>
                            ))}
                            <button className="secondary-action" type="button" onClick={addMixedPaymentLine}>Agregar metodo</button>
                            <div className={Math.abs(mixedPaymentsTotal - previewBalance) <= 0.01 ? 'cashier-selected-charge confirm' : 'cashier-selected-charge'}>
                              <span>Suma pago mixto / Total final</span>
                              <strong>{money(mixedPaymentsTotal)} / {money(previewBalance)}</strong>
                            </div>
                          </div>
                        )}

                        <button className="primary-action" type="button" onClick={() => goToCheckoutStep(3)}>Continuar a propina</button>
                      </div>
                    )}

                    {checkoutStep === 3 && (
                      <div className="checkout-step-panel">
                        <h3>Propina</h3>
                        <div className="bill-choice-panel">
                          <button type="button" onClick={() => chooseTipPercentage(0)}><span>Sin propina</span><strong>{money(balance)}</strong></button>
                          <button type="button" onClick={() => chooseTipPercentage(5)}><span>Propina 5%</span><strong>{money(balance + Math.round(balance * 0.05))}</strong></button>
                          <button type="button" onClick={() => chooseTipPercentage(10)}><span>Propina 10%</span><strong>{money(balance + Math.round(balance * 0.1))}</strong></button>
                        </div>
                        <div className="cashier-payment-fields">
                          <label>
                            Propina personalizada
                            <input
                              min="0"
                              type="number"
                              disabled={!cashierConfig.allowCustomTip}
                              value={tipAmount || ''}
                              onChange={(event) => {
                                const nextTip = Number(event.target.value);
                                setTipAmount(nextTip);
                                setPaymentAmount(balance + nextTip);
                              }}
                            />
                          </label>
                          <div className="cashier-selected-charge"><span>Total con propina</span><strong>{money(previewBalance)}</strong></div>
                        </div>
                        <button className="primary-action" type="button" onClick={() => goToCheckoutStep(4)}>Continuar a descuento</button>
                      </div>
                    )}

                    {checkoutStep === 4 && (
                      <div className="checkout-step-panel">
                        <h3>Descuento</h3>
                        {canApplyCheckoutDiscount ? (
                          <form className="cashier-form inline" onSubmit={applyDiscount}>
                            <input name="name" placeholder="Nombre descuento" defaultValue="Descuento caja" />
                            <select name="type" defaultValue="FIXED_AMOUNT">
                              <option value="FIXED_AMOUNT">Valor fijo</option>
                              <option value="PERCENTAGE">Porcentaje</option>
                            </select>
                            <input name="value" min="0" type="number" placeholder="Ej: 2000" />
                            <input name="reason" placeholder="Motivo" />
                            <Button disabled={!selectedOrder}>Aplicar descuento</Button>
                          </form>
                        ) : (
                          <div className="cashier-help-note warning">
                            <strong>Requiere autorizacion de administrador.</strong>
                            <span>Tu rol no puede aplicar descuentos desde el cierre de venta.</span>
                          </div>
                        )}
                        <div className="ticket-preview-lines">
                          <div><span>Descuento actual</span><strong>{money(discountTotal)}</strong></div>
                          <div className="ticket-pay-now"><span>Total actual</span><strong>{money(previewBalance)}</strong></div>
                        </div>
                        <button className="primary-action" type="button" onClick={() => goToCheckoutStep(5)}>Continuar a confirmar pago</button>
                      </div>
                    )}

                    {checkoutStep === 5 && (
                      <form className="checkout-step-panel" onSubmit={registerPayment}>
                        <h3>Confirmar pago</h3>
                        <div className="ticket-preview-lines">
                          <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                          <div><span>Descuento</span><strong>{money(discountTotal)}</strong></div>
                          <div><span>Impuesto</span><strong>{money(taxTotal)}</strong></div>
                          <div><span>Propina</span><strong>{money(tipAmount)}</strong></div>
                          <div><span>Metodo</span><strong>{paymentMethodLabel(paymentMethod)}</strong></div>
                          <div><span>Monto recibido</span><strong>{money(paymentMethod === 'MIXED' ? mixedPaymentsTotal : paymentMethod === 'CASH' ? paymentAmount : previewBalance)}</strong></div>
                          <div><span>Cambio</span><strong>{money(cashChange)}</strong></div>
                          <div className="ticket-pay-now"><span>Total final</span><strong>{money(previewBalance)}</strong></div>
                        </div>
                        {paymentMethod !== 'MIXED' && <input name="reference" placeholder="Referencia opcional" />}
                        <input name="amount" type="hidden" value={paymentMethod === 'CASH' ? paymentAmount : previewBalance} />
                        <label>
                          Estado de la mesa despues del pago
            <select name="closeTableStatus" defaultValue={cashierConfig.afterPaymentTableStatus}>
                            <option value="CLEANING">Mesa a limpieza</option>
                            <option value="AVAILABLE">Mesa disponible</option>
                          </select>
                        </label>
                        <Button disabled={(cashierConfig.requireOpenCashRegister && !cashRegister) || !selectedOrder || isRegisteringPayment || selectedOrder.status === 'PAID'}>
                          {isRegisteringPayment ? 'Registrando pago...' : 'Confirmar pago y cerrar mesa'}
                        </Button>
                      </form>
                    )}
                  </section>
                  </>
                ) : (
                  <section className="cashier-step cashier-ready-panel">
                    <div>
                      <p className="eyebrow">Cobro / facturacion final</p>
                      <h3>Cuenta previa revisada</h3>
                      <span>Cuando el cliente confirme la cuenta, inicia el cobro guiado.</span>
                    </div>
                    <button className="primary-action" type="button" onClick={prepareSelectedTableInvoice} disabled={!isWaitingPaymentOrder(selectedOrder)}>
                      Cobrar / Facturar
                    </button>
                  </section>
                )}
              </>
            ) : (
              <div className="empty-state">Selecciona una orden pendiente.</div>
            )}
          </section>

          <aside className="panel cashier-ops cashier-register-panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">Antes de cobrar</p>
                <h2>Ajustes de la cuenta</h2>
              </div>
              <span>Descuentos y resumen del turno</span>
            </div>

            <form className="cashier-form" onSubmit={applyDiscount}>
              <div className="section-title">
                <h2>Descuento</h2>
                <span>Requiere permiso si supera topes</span>
              </div>
              <input name="name" placeholder="Nombre descuento" defaultValue="Descuento caja" />
              <select name="type" defaultValue="FIXED_AMOUNT">
                <option value="FIXED_AMOUNT">Valor fijo en pesos</option>
                <option value="PERCENTAGE">Porcentaje</option>
              </select>
              <input name="value" min="0" type="number" placeholder="Ej: 2000" />
              <input name="reason" placeholder="Motivo" />
              <Button disabled={!selectedOrder}>Aplicar descuento</Button>
            </form>

            <section className="cashier-form" id="cashier-day-movements" aria-label="Resumen del turno">
              <div className="section-title">
                <h2>Resumen del turno</h2>
                <span>{cashRegister ? 'Ventas registradas en esta caja' : 'Abre caja para ver ventas del turno'}</span>
              </div>
              <div className="cash-close-summary">
                <div><span>Efectivo esperado</span><strong>{money(summary?.totals.expectedCash ?? 0)}</strong></div>
                <div><span>Tarjeta</span><strong>{money(summary?.totals.card ?? 0)}</strong></div>
                <div><span>Transferencias</span><strong>{money(summary?.totals.transfer ?? 0)}</strong></div>
                <div><span>QR</span><strong>{money(summary?.totals.qr ?? 0)}</strong></div>
                <div><span>Propinas</span><strong>{money(summary?.totals.tips ?? 0)}</strong></div>
                <div><span>Descuentos</span><strong>{money(summary?.totals.discounts ?? 0)}</strong></div>
                <div><span>Total ventas</span><strong>{money(summary?.totals.sales ?? 0)}</strong></div>
              </div>
              {!cashRegister && <div className="empty-state compact">La apertura y cierre de caja estan arriba, separados del cobro de mesa.</div>}
            </section>
          </aside>
        </section>
          </>
        )}

        {displayedFinalInvoiceOrder && <FinalReceiptPanel onDownload={downloadTicket} onPrint={printReceipt} order={displayedFinalInvoiceOrder} />}
        </CashierDashboard>

        {receiptOrder && (
          <section className="receipt-print" aria-label="Recibo basico">
            <header>
              {theme.logoUrl && <img alt="" src={theme.logoUrl} />}
              <strong>{theme.restaurantName}</strong>
              <span>{receiptOrder.orderNumber}</span>
            </header>
            <p>Mesa {receiptOrder.table.number} - {waiterName(receiptOrder)}</p>
            {receiptOrder.items.map((item) => (
              <div key={item.id}>
                <span>{item.quantity}x {item.menuItem.name}</span>
                <strong>{money(numberValue(item.total))}</strong>
              </div>
            ))}
            <div>
              <span>Subtotal</span>
              <strong>{money(numberValue(receiptOrder.subtotal))}</strong>
            </div>
            <div>
              <span>Descuentos</span>
              <strong>{money(numberValue(receiptOrder.discountTotal))}</strong>
            </div>
            <div>
              <span>Impuestos</span>
              <strong>{money(numberValue(receiptOrder.taxTotal))}</strong>
            </div>
            {cashierConfig.showTipOnReceipt && (
              <div>
                <span>Propina</span>
                <strong>{money(receiptOrder.id === selectedOrder?.id ? tipAmount : numberValue(receiptOrder.tipTotal))}</strong>
              </div>
            )}
            <footer>
              <span>Total a pagar</span>
              <strong>{money(receiptOrder.id === selectedOrder?.id ? previewBalance : numberValue(receiptOrder.total))}</strong>
            </footer>
          </section>
        )}
      </main>
    </AuthGate>
  );
}

async function readApi<T>(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    try {
      const payload = JSON.parse(text) as { message?: string | string[] };
      const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
      throw new Error(normalizeCashierError(message || `Error HTTP ${response.status}`, response.status));
    } catch (error) {
      if (error instanceof Error && error.message !== 'Unexpected end of JSON input') {
        throw error;
      }

      throw new Error(normalizeCashierError(`Error HTTP ${response.status}`, response.status));
    }
  }

  return (text ? JSON.parse(text) : null) as T;
}

function normalizeCashierError(message: string, status?: number) {
  const value = message.toLowerCase();

  if (status === 401) {
    return 'Sesión expirada. Inicia sesión nuevamente.';
  }

  if (message === 'Failed to fetch' || value.includes('network') || value.includes('fetch') || value.includes('connection')) {
    return 'Error de conexión con el servidor.';
  }

  if (value.includes('discount') || value.includes('descuento')) {
    return 'No tienes permiso para aplicar descuentos.';
  }

  if (status === 403 || value.includes('permiso')) {
    return 'No tienes permiso para realizar esta acción.';
  }

  if (value.includes('caja') || value.includes('cash register') || value.includes('open register')) {
    return 'Debes abrir caja antes de cobrar.';
  }

  if (value.includes('ya fue pagada') || value.includes('already') || value.includes('paid') || value.includes('cannot be charged') || value.includes('pending balance')) {
    return 'Esta cuenta ya fue pagada.';
  }

  if (value.includes('mixed') || value.includes('payment total') || value.includes('payment amount') || value.includes('cash received') || value.includes('pagos no coincide')) {
    return 'La suma de los pagos no coincide con el total.';
  }

  if (status && status >= 500) {
    return 'No se pudo registrar el pago. Intenta nuevamente.';
  }

  return message || 'No se pudo registrar el pago. Intenta nuevamente.';
}

function buildTicketHtml({
  amountToPay,
  discountTotal,
  order,
  paid,
  restaurantName,
  selectedTip,
  subtotal,
  suggestedTipAmount,
  taxTotal,
  totalWithSuggestedTip,
  totalWithoutTip
}: {
  amountToPay: number;
  discountTotal: number;
  order: CashierOrder;
  paid: number;
  restaurantName: string;
  selectedTip: number;
  subtotal: number;
  suggestedTipAmount: number;
  taxTotal: number;
  totalWithSuggestedTip: number;
  totalWithoutTip: number;
}) {
  const rows = order.items.map((item) => `
    <tr>
      <td>${escapeHtml(`${item.quantity}x ${item.menuItem.name}`)}</td>
      <td>${escapeHtml(item.notes ?? '')}</td>
      <td class="right">${money(numberValue(item.total))}</td>
    </tr>
  `).join('');
  const documentTitle = order.status === 'PAID' ? 'Factura final pagada' : 'Factura previa para revision';
  const footerText = order.status === 'PAID'
    ? 'Pago recibido. Gracias por su visita.'
    : 'La propina es voluntaria. Esta cuenta previa no confirma el pago.';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${escapeHtml(order.orderNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
    .ticket { max-width: 420px; margin: 0 auto; border: 1px solid #d1d5db; padding: 20px; border-radius: 10px; }
    h1, h2, p { margin: 0; }
    header { text-align: center; border-bottom: 1px dashed #9ca3af; padding-bottom: 12px; margin-bottom: 14px; }
    header h1 { font-size: 20px; }
    header p, .muted { color: #6b7280; font-size: 12px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    td { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; vertical-align: top; }
    .right { text-align: right; white-space: nowrap; }
    .line { display: flex; justify-content: space-between; gap: 14px; padding: 5px 0; font-size: 14px; }
    .total { margin-top: 10px; padding-top: 10px; border-top: 2px solid #111827; font-size: 20px; font-weight: 800; }
    .tip-box { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-top: 10px; }
    footer { margin-top: 14px; text-align: center; font-size: 12px; color: #6b7280; }
    @media print { body { padding: 0; } .ticket { border: 0; border-radius: 0; } }
  </style>
</head>
<body>
  <main class="ticket">
    <header>
      <h1>${escapeHtml(restaurantName || 'Mi Restaurante')}</h1>
      <p>${escapeHtml(documentTitle)}</p>
      <p>${escapeHtml(order.orderNumber)} - Mesa ${escapeHtml(order.table.number)}</p>
      <p>Mesero: ${escapeHtml(waiterName(order))}</p>
      <p>${new Date().toLocaleString('es-CO')}</p>
    </header>
    <table>
      <tbody>${rows}</tbody>
    </table>
    <section>
      <div class="line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
      <div class="line"><span>Descuentos</span><strong>${money(discountTotal)}</strong></div>
      <div class="line"><span>Impuestos</span><strong>${money(taxTotal)}</strong></div>
      <div class="line"><span>Pagado</span><strong>${money(paid)}</strong></div>
    </section>
    <section class="tip-box">
      <div class="line"><span>Total sin propina</span><strong>${money(totalWithoutTip)}</strong></div>
      <div class="line"><span>Propina voluntaria 10%</span><strong>${money(suggestedTipAmount)}</strong></div>
      <div class="line"><span>Total con propina 10%</span><strong>${money(Math.round(totalWithSuggestedTip))}</strong></div>
      <div class="line"><span>Propina seleccionada</span><strong>${money(selectedTip)}</strong></div>
    </section>
    <div class="line total"><span>Total a pagar</span><strong>${money(amountToPay)}</strong></div>
    <footer>${escapeHtml(footerText)}</footer>
  </main>
</body>
</html>`;
}

function ticketAmountsForOrder(order: CashierOrder, selected: {
  discountTotal: number;
  paid: number;
  previewBalance: number;
  selectedOrderId?: string;
  subtotal: number;
  suggestedTipAmount: number;
  taxTotal: number;
  tipAmount: number;
  totalWithSuggestedTip: number;
  totalWithoutTip: number;
}) {
  const isSelectedOpenOrder = order.id === selected.selectedOrderId && order.status !== 'PAID';

  if (isSelectedOpenOrder) {
    return {
      amountToPay: selected.previewBalance,
      discountTotal: selected.discountTotal,
      paid: selected.paid,
      selectedTip: selected.tipAmount,
      subtotal: selected.subtotal,
      suggestedTipAmount: selected.suggestedTipAmount,
      taxTotal: selected.taxTotal,
      totalWithSuggestedTip: selected.totalWithSuggestedTip,
      totalWithoutTip: selected.totalWithoutTip
    };
  }

  const orderSubtotal = numberValue(order.subtotal);
  const orderDiscount = numberValue(order.discountTotal);
  const orderTax = numberValue(order.taxTotal);
  const orderTip = numberValue(order.tipTotal);
  const totalWithoutOrderTip = Math.max(0, orderSubtotal - orderDiscount + orderTax);
  const unpaidBalance = Math.max(0, numberValue(order.total) - paidTotal(order));

  return {
    amountToPay: order.status === 'PAID' ? numberValue(order.total) : unpaidBalance,
    discountTotal: orderDiscount,
    paid: paidTotal(order),
    selectedTip: orderTip,
    subtotal: orderSubtotal,
    suggestedTipAmount: order.status === 'PAID' ? orderTip : Math.round(unpaidBalance * 0.1),
    taxTotal: orderTax,
    totalWithSuggestedTip: order.status === 'PAID' ? numberValue(order.total) : unpaidBalance + Math.round(unpaidBalance * 0.1),
    totalWithoutTip: order.status === 'PAID' ? totalWithoutOrderTip : unpaidBalance
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
