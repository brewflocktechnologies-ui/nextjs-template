// Origin and source rules for messages arriving in the frame (BRIDGE-04). Pure, so every rule
// is unit-tested; frame/main.ts feeds it real MessageEvents.
import type { DropReason } from '../bridge/protocol';

export interface GateState {
  /** Origin the frame expects its parent to have, or null when it must not talk to anyone. */
  expected: string | null;
  /** Set by the first accepted message; afterwards only this origin is accepted. */
  pinned: string | null;
}

export type GateResult =
  | { ok: true; state: GateState }
  | { ok: false; reason: DropReason };

/**
 * Accept a message only if it comes from the parent window and from the expected origin.
 * The first accepted message pins the origin for the frame's lifetime.
 */
export function gate(
  state: GateState,
  origin: string,
  fromParent: boolean,
): GateResult {
  if (!state.expected) return { ok: false, reason: 'origin' };
  const want = state.pinned ?? state.expected;
  if (origin !== want) return { ok: false, reason: 'origin' };
  if (!fromParent) return { ok: false, reason: 'source' };
  return {
    ok: true,
    state: state.pinned ? state : { ...state, pinned: origin },
  };
}

/** Normalises a URL or origin string to an origin, or null when it is not an http(s) origin. */
export function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export type ParentResolution =
  | { ok: true; origin: string; source: 'ancestorOrigins' | 'parent-param' }
  | { ok: false; reason: 'ORIGIN_MISMATCH' | 'NO_PARENT' };

/**
 * BRIDGE-04 rule 2: take the parent origin from location.ancestorOrigins[0] when the browser
 * provides it, otherwise from the `parent` URL parameter. Both present and different → mismatch.
 */
export function resolveParentOrigin(
  ancestor: string | undefined,
  parentParam: string | null,
): ParentResolution {
  const fromAncestor = toOrigin(ancestor);
  const fromParam = toOrigin(parentParam);
  if (fromAncestor && fromParam && fromAncestor !== fromParam)
    return { ok: false, reason: 'ORIGIN_MISMATCH' };
  if (fromAncestor)
    return { ok: true, origin: fromAncestor, source: 'ancestorOrigins' };
  if (fromParam) return { ok: true, origin: fromParam, source: 'parent-param' };
  return { ok: false, reason: 'NO_PARENT' };
}
