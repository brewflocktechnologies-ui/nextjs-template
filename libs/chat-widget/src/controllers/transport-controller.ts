// Transport contract (P1.5-T03). The real implementation (Centrifugo over the frame's own origin)
// arrives with the realtime phase; until then InMemoryTransport stands in for stories, tests and the
// frame. Only the frame uses a transport; the launcher never touches the network.

export type TransportStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'paused'
  | 'disconnected';

/** What the visitor sends. */
export interface OutgoingEvent {
  type: 'message';
  text: string;
}

/** What the transport delivers. */
export interface IncomingEvent {
  type: 'message';
  id: string;
  from: 'agent';
  text: string;
  at: number;
}

export type TransportHandler = (event: IncomingEvent) => void;

export interface TransportController {
  /** Opens the connection; resolves once connected. */
  connect(): Promise<void>;
  /** Closes the connection and drops pending deliveries. */
  disconnect(): void;
  send(event: OutgoingEvent): void;
  /** Registers a handler; returns the unsubscribe function. */
  subscribe(handler: TransportHandler): () => void;
  /** Holds deliveries while the panel is hidden (the `visibility` bridge message). */
  pause(): void;
  resume(): void;
  readonly status: TransportStatus;
}
