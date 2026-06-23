'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthGate, routeForRole, useAuth } from '../../auth-provider';

type TicketStatus = 'RECEIVED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
type ItemStatus = 'SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

interface KitchenItem {
  id: string;
  name: string;
  quantity: number;
  notes: string;
  modifiers: string[];
  status: ItemStatus;
}

interface KitchenTicket {
  id: string;
  orderNumber: string;
  tableNumber: string;
  tableName: string;
  waiterName: string;
  sentAt: string;
  status: TicketStatus;
  items: KitchenItem[];
}

interface ApiKitchenTicket {
  id: string;
  status: TicketStatus;
  createdAt: string;
  order: {
    orderNumber: string;
    waiter?: {
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    } | null;
    table?: {
      name: string;
      number: string;
    } | null;
  };
  items: Array<{
    id: string;
    status: ItemStatus;
    notes?: string | null;
    orderItem: {
      quantity: number;
      notes?: string | null;
      menuItem?: {
        name: string;
      } | null;
      modifiers: Array<{
        nameSnapshot: string;
        quantity?: number | null;
      }>;
    };
  }>;
}

const columns: Array<{ status: TicketStatus; title: string }> = [
  { status: 'RECEIVED', title: 'Recibido' },
  { status: 'PREPARING', title: 'En preparacion' },
  { status: 'READY', title: 'Listo' },
  { status: 'DELIVERED', title: 'Entregado' }
];

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function elapsed(sentAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(sentAt).getTime()) / 60000));

  if (minutes < 1) {
    return 'Ahora';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h ${rest} min`;
}

export default function KitchenKanbanPage() {
  const { accessToken, logout, user } = useAuth();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [printTicketId, setPrintTicketId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('Cargando comandas reales...');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const visibleTickets = useMemo(() => {
    return tickets.filter((ticket) => ticket.status !== 'CANCELLED');
  }, [tickets]);
  const printTicket = tickets.find((ticket) => ticket.id === printTicketId);
  const homeRoute = user ? routeForRole(user.role) : '/login';

  async function signOut() {
    await logout();
    window.location.assign('/login');
  }

  useEffect(() => {
    if (!accessToken) {
      setTickets([]);
      setFeedback('Inicia sesion con backend real para ver comandas.');
      return;
    }

    let ignore = false;

    async function loadTickets(silent = false) {
      try {
        const response = await fetch(`${apiBaseUrl}/kitchen/tickets`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await readApi<ApiKitchenTicket[]>(response);

        if (ignore) return;

        setTickets(data.map(mapApiTicket));
        setLastSyncAt(new Date().toISOString());
        setFeedback(silent ? '' : 'Comandas cargadas desde cocina.');
      } catch {
        if (!ignore) {
          setFeedback('Error de conexion con el servidor de cocina.');
        }
      }
    }

    void loadTickets();
    const interval = window.setInterval(() => void loadTickets(true), 5000);

    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [accessToken]);

  useEffect(() => {
    if (!printTicketId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      window.print();
    }, 80);

    const resetPrintTarget = () => setPrintTicketId(null);
    window.addEventListener('afterprint', resetPrintTarget);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('afterprint', resetPrintTarget);
    };
  }, [printTicketId]);

  async function updateTicketStatus(ticketId: string, status: TicketStatus) {
    if (!accessToken) {
      setFeedback('No hay conexion real con backend.');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/kitchen/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      const ticket = mapApiTicket(await readApi<ApiKitchenTicket>(response));

      setTickets((current) => current.map((currentTicket) => currentTicket.id === ticket.id ? ticket : currentTicket));
      setFeedback(status === 'READY' ? 'Comanda lista. El mesero vera el cambio al sincronizar.' : 'Comanda actualizada.');
    } catch {
      setFeedback('No se pudo actualizar la comanda.');
    }
  }

  async function updateItemStatus(ticketId: string, itemId: string, status: ItemStatus) {
    if (!accessToken) {
      setFeedback('No hay conexion real con backend.');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/kitchen/tickets/${ticketId}/items/${itemId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      const ticket = mapApiTicket(await readApi<ApiKitchenTicket>(response));

      setTickets((current) => current.map((currentTicket) => currentTicket.id === ticket.id ? ticket : currentTicket));
      setFeedback(status === 'READY' ? 'Producto listo. El mesero vera el cambio al sincronizar.' : 'Producto actualizado.');
    } catch {
      setFeedback('No se pudo actualizar el producto.');
    }
  }

  function printKitchenTicket(ticketId: string) {
    setPrintTicketId(ticketId);
  }

  return (
    <AuthGate allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'KITCHEN']}>
      <main className="kitchen-shell">
      <header className="topbar kitchen-topbar">
        <div>
          <nav className="breadcrumb" aria-label="Ruta">
            <button type="button" onClick={() => window.location.assign(homeRoute)}>Inicio</button>
            <span>/</span>
            <strong>Cocina</strong>
          </nav>
          <p className="eyebrow">Fase 6</p>
          <h1>Kanban de cocina</h1>
          <span className="screen-action">Ver comandas, cambiar estados e imprimir ticket.</span>
        </div>
        <button className="secondary-action" type="button" onClick={() => void signOut()}>
          Salir / cambiar usuario
        </button>
        <button className="back-button" type="button" onClick={() => document.querySelector('.kitchen-board')?.scrollIntoView({ behavior: 'smooth' })}>
          ← Volver al dashboard
        </button>
        <div className="live-pill">
          <span />
          {lastSyncAt ? `Sync ${new Date(lastSyncAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : 'Sincronizando'}
        </div>
      </header>
      {feedback && <div className="pos-feedback">{feedback}</div>}

      <section className="kitchen-board">
        {columns.map((column) => {
          const columnTickets = visibleTickets.filter((ticket) => ticket.status === column.status);

          return (
            <section className="kitchen-column" key={column.status}>
              <div className="column-header">
                <h2>{column.title}</h2>
                <span>{columnTickets.length}</span>
              </div>

              <div className="ticket-stack">
                {columnTickets.map((ticket) => (
                  <article className={`ticket-card ${ticket.status.toLowerCase()}`} key={ticket.id}>
                    <header>
                      <div>
                        <strong>
                          Mesa {ticket.tableNumber} - {ticket.tableName}
                        </strong>
                        <span>{ticket.orderNumber}</span>
                      </div>
                      <em>{elapsed(ticket.sentAt)}</em>
                    </header>

                    <div className="ticket-meta">
                      <span>Mesero: {ticket.waiterName}</span>
                      <span>Enviado: {new Date(ticket.sentAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className="ticket-products">
                      {ticket.items.map((item) => (
                        <div className="ticket-product" key={item.id}>
                          <div>
                            <strong>
                              {item.quantity}x {item.name}
                            </strong>
                            {item.modifiers.length > 0 && <span>{item.modifiers.join(', ')}</span>}
                            {item.notes && <em>{item.notes}</em>}
                          </div>
                          <select
                            aria-label={`Estado de ${item.name}`}
                            value={item.status}
                            onChange={(event) => updateItemStatus(ticket.id, item.id, event.target.value as ItemStatus)}
                          >
                            <option value="SENT">Enviada</option>
                            <option value="PREPARING">Preparando</option>
                            <option value="READY">Lista</option>
                            <option value="SERVED">Servida</option>
                            <option value="CANCELLED">Cancelada</option>
                          </select>
                        </div>
                      ))}
                    </div>

                    <footer>
                      <button className="print-action" type="button" onClick={() => printKitchenTicket(ticket.id)}>
                        Imprimir ticket
                      </button>
                      {ticket.status !== 'PREPARING' && ticket.status !== 'READY' && (
                        <button type="button" onClick={() => updateTicketStatus(ticket.id, 'PREPARING')}>
                          Preparar
                        </button>
                      )}
                      {ticket.status !== 'READY' && (
                        <button type="button" onClick={() => updateTicketStatus(ticket.id, 'READY')}>
                          Listo
                        </button>
                      )}
                      {ticket.status === 'READY' && (
                        <button type="button" onClick={() => updateTicketStatus(ticket.id, 'DELIVERED')}>
                          Entregar
                        </button>
                      )}
                    </footer>
                  </article>
                ))}
                {columnTickets.length === 0 && <div className="empty-state compact">Sin comandas.</div>}
              </div>
            </section>
          );
        })}
      </section>

      {printTicket && (
        <section className="print-ticket" aria-label="Ticket imprimible de cocina">
          <header>
            <strong>Ticket de cocina</strong>
            <span>{printTicket.orderNumber}</span>
          </header>
          <div className="print-ticket-meta">
            <span>Mesa</span>
            <strong>
              {printTicket.tableNumber} - {printTicket.tableName}
            </strong>
            <span>Mesero</span>
            <strong>{printTicket.waiterName}</strong>
            <span>Fecha y hora</span>
            <strong>
              {new Date(printTicket.sentAt).toLocaleString('es-CO', {
                dateStyle: 'short',
                timeStyle: 'short'
              })}
            </strong>
          </div>
          <div className="print-ticket-items">
            {printTicket.items.map((item) => (
              <article key={item.id}>
                <strong>
                  {item.quantity}x {item.name}
                </strong>
                {item.modifiers.length > 0 && <span>Adicionales: {item.modifiers.join(', ')}</span>}
                {item.notes && <em>Notas: {item.notes}</em>}
              </article>
            ))}
          </div>
        </section>
      )}
      </main>
    </AuthGate>
  );
}

async function readApi<T>(response: Response) {
  if (!response.ok) {
    throw new Error('API request failed');
  }

  return response.json() as Promise<T>;
}

function mapApiTicket(ticket: ApiKitchenTicket): KitchenTicket {
  const waiter = ticket.order.waiter;

  return {
    id: ticket.id,
    orderNumber: ticket.order.orderNumber,
    tableNumber: ticket.order.table?.number ?? '-',
    tableName: ticket.order.table?.name ?? 'Mesa',
    waiterName: [waiter?.firstName, waiter?.lastName].filter(Boolean).join(' ') || waiter?.email || 'Mesero',
    sentAt: ticket.createdAt,
    status: ticket.status,
    items: ticket.items.map((item) => ({
      id: item.id,
      name: item.orderItem.menuItem?.name ?? 'Producto',
      quantity: item.orderItem.quantity,
      notes: item.notes ?? item.orderItem.notes ?? '',
      modifiers: item.orderItem.modifiers.map((modifier) =>
        modifier.quantity && modifier.quantity > 1 ? `${modifier.quantity}x ${modifier.nameSnapshot}` : modifier.nameSnapshot
      ),
      status: item.status
    }))
  };
}
