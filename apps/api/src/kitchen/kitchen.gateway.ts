import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000', 'http://localhost:3003', 'http://localhost:3005'],
    credentials: true
  }
})
export class KitchenGateway {
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(KitchenGateway.name);

  @SubscribeMessage('kitchen.join')
  joinKitchen(@ConnectedSocket() client: Socket) {
    void client.join('kitchen');
    return { ok: true, room: 'kitchen' };
  }

  @SubscribeMessage('waiter.join')
  joinWaiter(@ConnectedSocket() client: Socket, @MessageBody() body: { waiterId?: string }) {
    if (!body?.waiterId) {
      return { ok: false };
    }

    void client.join(this.waiterRoom(body.waiterId));
    return { ok: true, room: this.waiterRoom(body.waiterId) };
  }

  emitTicketCreated(ticket: unknown) {
    this.emitToKitchen('kitchen.ticket.created', ticket);
  }

  emitTicketUpdated(ticket: unknown) {
    this.emitToKitchen('kitchen.ticket.updated', ticket);
  }

  emitTicketItemUpdated(ticket: unknown) {
    this.emitToKitchen('kitchen.item.updated', ticket);
  }

  emitWaiterTicketReady(waiterId: string | null | undefined, payload: unknown) {
    if (!waiterId) {
      return;
    }

    this.server?.to(this.waiterRoom(waiterId)).emit('waiter.ticket.ready', payload);
  }

  private emitToKitchen(event: string, payload: unknown) {
    if (!this.server) {
      this.logger.warn(`Socket server not ready for ${event}`);
      return;
    }

    this.server.to('kitchen').emit(event, payload);
  }

  private waiterRoom(waiterId: string) {
    return `waiter:${waiterId}`;
  }
}
