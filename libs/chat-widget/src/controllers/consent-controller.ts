// ConsentController (P1.5-T04, Q-006). The only module in the frame allowed to touch browser storage;
// lint forbids storage APIs everywhere else in libs/chat-widget and apps/widget/src/frame.
// Phase 1 persists exactly one value: the visitor id, and only after consent.

export type ConsentState = 'unknown' | 'granted' | 'denied' | 'notRequired';
export type ConsentRequirement = 'required' | 'notRequired';

export const VISITOR_ID_KEY = 'byteflock.visitorId';

export class ConsentRequiredError extends Error {
  constructor(operation: string) {
    super(`Storage ${operation} refused: consent is required`);
    this.name = 'ConsentRequiredError';
  }
}

/** Minimal storage backend; defaults to the frame origin's localStorage. */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ConsentStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class ConsentController {
  private _state: ConsentState;
  private readonly listeners = new Set<(state: ConsentState) => void>();

  /** Storage that throws ConsentRequiredError unless consent is granted or not required. */
  readonly storage: ConsentStorage;

  constructor(
    requirement: ConsentRequirement,
    private readonly backend: StorageBackend | null = defaultBackend(),
  ) {
    this._state = requirement === 'notRequired' ? 'notRequired' : 'unknown';
    this.storage = {
      get: (key) => this.guard('read')?.getItem(key) ?? null,
      set: (key, value) => this.guard('write')?.setItem(key, value),
      remove: (key) => this.guard('remove')?.removeItem(key),
    };
  }

  get state(): ConsentState {
    return this._state;
  }

  get allowed(): boolean {
    return this._state === 'granted' || this._state === 'notRequired';
  }

  /** Records the visitor's decision (from the `consent` bridge message or the notice). */
  decide(granted: boolean): void {
    if (this._state === 'notRequired') return;
    this._state = granted ? 'granted' : 'denied';
    // Withdrawing consent removes what was stored under it.
    if (!granted) this.backend?.removeItem(VISITOR_ID_KEY);
    for (const listener of this.listeners) listener(this._state);
  }

  onChange(listener: (state: ConsentState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The visitor id, created on first use; null while storage is not allowed. */
  visitorId(): string | null {
    if (!this.allowed) return null;
    let id = this.storage.get(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      this.storage.set(VISITOR_ID_KEY, id);
    }
    return id;
  }

  private guard(operation: string): StorageBackend | null {
    if (!this.allowed) throw new ConsentRequiredError(operation);
    return this.backend;
  }
}

function defaultBackend(): StorageBackend | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Storage can be blocked (third-party storage partitioning, privacy modes).
    return null;
  }
}
