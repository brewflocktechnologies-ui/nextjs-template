// In-memory transport (P1.5-T03): an echo bot that answers every visitor message after a delay.
import type {
  IncomingEvent,
  OutgoingEvent,
  TransportController,
  TransportHandler,
  TransportStatus,
} from '../controllers/transport-controller';

export interface InMemoryTransportOptions {
  /** Reply delay in milliseconds (default 300). */
  delayMs?: number;
  /** Text of the canned reply. */
  reply?: (event: OutgoingEvent) => string;
}

export class InMemoryTransport implements TransportController {
  private handlers = new Set<TransportHandler>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private held: IncomingEvent[] = [];
  private seq = 0;
  private _status: TransportStatus = 'idle';
  private readonly delayMs: number;
  private readonly reply: (event: OutgoingEvent) => string;

  constructor(options: InMemoryTransportOptions = {}) {
    this.delayMs = options.delayMs ?? 300;
    this.reply =
      options.reply ??
      (() => 'Thanks for your message. An agent will reply shortly.');
  }

  get status(): TransportStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    this._status = 'connected';
  }

  disconnect(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.held = [];
    this._status = 'disconnected';
  }

  send(event: OutgoingEvent): void {
    if (this._status !== 'connected' && this._status !== 'paused') return;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.deliver({
        type: 'message',
        id: `bot-${++this.seq}`,
        from: 'agent',
        text: this.reply(event),
        at: Date.now(),
      });
    }, this.delayMs);
    this.timers.add(timer);
  }

  subscribe(handler: TransportHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  pause(): void {
    if (this._status === 'connected') this._status = 'paused';
  }

  resume(): void {
    if (this._status !== 'paused') return;
    this._status = 'connected';
    const held = this.held;
    this.held = [];
    for (const event of held) this.deliver(event);
  }

  private deliver(event: IncomingEvent): void {
    if (this._status === 'paused') {
      this.held.push(event);
      return;
    }
    if (this._status !== 'connected') return;
    for (const handler of this.handlers) handler(event);
  }
}
