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
import type { Book } from '../types/events';

const MAX_DEPTH = 6;

function looksLikeBook(v: unknown): v is Book {
  return !!v && typeof v === 'object'
    && Array.isArray((v as { events?: unknown }).events);
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
        for (const value of Object.values(node as Record<string, unknown>)) {
          if (value && typeof value === 'object') next.push(value);
        }
      }
    }
    level = next;
  }
  return null;
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
