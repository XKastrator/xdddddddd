/**
 * Locate the round's book inside an RGS response.
 *
 * The RGS docs specify the wallet endpoints precisely but elide the round
 * payload as `"round": { ... }`, so the exact nesting is undocumented. Assuming
 * `round.book` produced "cannot read properties of undefined (reading
 * 'events')" against the live RGS — after the bet had already been debited,
 * which is the worst possible moment to guess wrong.
 *
 * So rather than hardcode one more guess, the book is found by SHAPE. A book is
 * unmistakable in a wallet response: an object carrying an `events` array. No
 * other field in a balance/round reply looks like that, so a bounded search
 * cannot pick up the wrong thing, and it keeps working whether the server sends
 * `round.book`, `round.state`, `round` itself, or something else entirely.
 */
import type { Book, GameEvent } from '../types/events';

const MAX_DEPTH = 6;

function looksLikeBook(v: unknown): v is Book {
  return !!v && typeof v === 'object'
    && Array.isArray((v as { events?: unknown }).events);
}

/**
 * An events array with no wrapper around it.
 *
 * The live RGS does not send a book object at all: it sends
 * `round.state` — the ordered events, bare — alongside `betID`, `amount`,
 * `payout`, `payoutMultiplier`, `active` and `mode`. Looking only for a
 * `.events` key found nothing there, and the round died AFTER the debit.
 *
 * Every event in the contract carries a string `type` and a numeric `index`,
 * and nothing else in a wallet reply is an array of objects shaped like that,
 * so this cannot pick up the wrong field.
 */
function looksLikeEventArray(v: unknown): v is GameEvent[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  return v.every((e) => !!e && typeof e === 'object'
    && typeof (e as { type?: unknown }).type === 'string'
    && typeof (e as { index?: unknown }).index === 'number');
}

/** Build a Book from the round that carried a bare events array. */
function bookFrom(events: GameEvent[], round: Record<string, unknown>): Book {
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    id: num(round.betID ?? round.id ?? round.roundId, 0),
    events,
    payoutMultiplier: num(round.payoutMultiplier, 0),
  };
}

/**
 * Breadth-first so the shallowest match wins — if a response ever carried both
 * a current and a historical round, the outer one is the live one.
 */
export function findBook(root: unknown): Book | null {
  let level: unknown[] = [root];
  for (let depth = 0; depth < MAX_DEPTH && level.length; depth++) {
    const next: unknown[] = [];
    for (const node of level) {
      if (looksLikeBook(node)) return node;
      if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        // a bare events array is the shape the live RGS actually sends
        for (const value of Object.values(obj)) {
          if (looksLikeEventArray(value)) return bookFrom(value, obj);
        }
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') next.push(value);
        }
      }
    }
    level = next;
  }
  return null;
}

/**
 * Is the server still holding a round that was never closed?
 *
 * While one is open the RGS refuses EVERY bet, so getting this wrong does not
 * degrade the game — it ends it. The boot path used to test `round.active`,
 * one spelling out of many, and against the live RGS that test was false while
 * `/wallet/play` answered `{"error":"ERR_VAL","message":"player has active
 * round"}` to every single attempt, for that player, across reloads, with no
 * way out from inside the game.
 *
 * So this asks the question several ways instead of once. A false positive
 * costs one `/wallet/end-round` the server rejects and the caller ignores; a
 * false negative costs the player the whole game. The bias is deliberate.
 */
export function roundLooksActive(root: unknown): boolean {
  const OPEN = /^(active|open|in[ _-]?progress|pending|started|unfinished|incomplete)$/i;
  const STATE_KEYS = ['state', 'status', 'roundState', 'roundStatus'];
  const seen = new Set<object>();
  const walk = (v: unknown, depth: number): boolean => {
    if (depth > MAX_DEPTH || !v || typeof v !== 'object') return false;
    if (seen.has(v as object)) return false;
    seen.add(v as object);
    const o = v as Record<string, unknown>;
    if (o.active === true) return true;
    // an explicit "not finished" is the same statement worded the other way
    if (o.completed === false || o.finished === false || o.ended === false) return true;
    for (const k of STATE_KEYS) {
      if (typeof o[k] === 'string' && OPEN.test(o[k] as string)) return true;
    }
    return Object.values(o).some((x) => walk(x, depth + 1));
  };
  // Prefer the round subtree when the server labels one, so unrelated flags
  // elsewhere in the payload cannot be mistaken for round state.
  const round = (root as { round?: unknown } | null)?.round;
  return walk(round !== undefined ? round : root, 0);
}

/**
 * Does this refusal mean an unfinished round is blocking the bet?
 *
 * Matched on the server's own words because there is no distinct error code
 * for it — the live RGS returns plain `ERR_VAL`, the same code it uses for a
 * malformed amount, so the code alone cannot tell "your request is wrong" from
 * "your previous round is still open".
 */
export function isActiveRoundRefusal(body: string): boolean {
  return /round[^"]{0,40}(active|open|in progress|not (finished|complete))/i.test(body)
    || /(active|open|unfinished|incomplete)[^"]{0,40}round/i.test(body);
}

/** Top-level shape of a response, for an error message that is actionable. */
export function describeShape(root: unknown, depth = 2): string {
  const walk = (v: unknown, d: number): unknown => {
    if (Array.isArray(v)) return d <= 0 ? `[${v.length}]` : [`${v.length} items`];
    if (v && typeof v === 'object') {
      if (d <= 0) return `{${Object.keys(v as object).join(',')}}`;
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, d - 1)]));
    }
    return typeof v;
  };
  try { return JSON.stringify(walk(root, depth)); } catch { return String(root); }
}
