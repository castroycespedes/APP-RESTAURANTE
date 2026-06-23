export type OrderStatus = 'draft' | 'sent' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';

export type KitchenEventName =
  | 'order.created'
  | 'order.updated'
  | 'order.item-status-updated'
  | 'kitchen.ticket-claimed'
  | 'kitchen.ticket-completed';

export interface RestaurantTheme {
  id: string;
  primaryColor: string;
  surfaceColor: string;
  textColor: string;
  radius: string;
}

export interface KitchenEvent<TPayload = unknown> {
  eventId: string;
  name: KitchenEventName;
  restaurantId: string;
  stationId?: string;
  payload: TPayload;
  occurredAt: string;
}
