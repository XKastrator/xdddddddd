/**
 * Bet-level handling.
 *
 * The RGS spec is explicit that `betLevels` is OPTIONAL, and that whatever the
 * client sends must satisfy two hard rules instead:
 *
 *   1. minBet <= bet <= maxBet
 *   2. bet is divisible by stepBet
 *
 * Reading `config.betLevels` directly therefore breaks against a perfectly
 * legal RGS that simply omits it, and stepping a bet by array index can walk it
 * off the stepBet grid — either of which makes `/wallet/play` reject the bet, so
 * pressing SPIN does nothing with no visible reason.
 */
import type { AuthConfig } from './RgsClient';

/** Bet ladder to offer, always non-empty and always on the stepBet grid. */
export function betLevelsFrom(cfg: AuthConfig): number[] {
  const min = Math.max(0, cfg.minBet | 0);
  const max = Math.max(min, cfg.maxBet | 0);
  const step = cfg.stepBet > 0 ? cfg.stepBet : Math.max(1, min);

  const supplied = Array.isArray(cfg.betLevels) ? cfg.betLevels : [];
  const usable = supplied
    .filter((v) => Number.isFinite(v) && v >= min && v <= max && v % step === 0)
    .sort((a, b) => a - b);
  if (usable.length) return usable;

  // Derive a ladder the player can actually move through: roughly a 1-2-5
  // progression on the step grid, so a game with a wide min..max range does not
  // end up with thousands of levels or only two.
  const out: number[] = [];
  for (let v = min; v <= max && out.length < 24; ) {
    out.push(v);
    const next = v * 2;
    v = snapBet(next > v ? next : v + step, cfg);
    if (out.length && v === out[out.length - 1]) break;   // no progress, stop
  }
  if (!out.includes(max) && out.length < 24) out.push(max);
  return out.length ? out : [min || step];
}

/** Clamp to [minBet, maxBet] and snap onto the stepBet grid. */
export function snapBet(value: number, cfg: AuthConfig): number {
  const min = Math.max(0, cfg.minBet | 0);
  const max = Math.max(min, cfg.maxBet | 0);
  const step = cfg.stepBet > 0 ? cfg.stepBet : Math.max(1, min);
  const clamped = Math.min(max, Math.max(min, value));
  // round toward the grid, then re-clamp: rounding can push past an endpoint
  // that is not itself a multiple of the step
  const snapped = Math.round(clamped / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** The starting bet: the RGS default when usable, otherwise the smallest level. */
export function defaultBet(cfg: AuthConfig, levels: number[]): number {
  const d = cfg.defaultBetLevel;
  if (Number.isFinite(d) && d >= cfg.minBet && d <= cfg.maxBet) return snapBet(d, cfg);
  return levels[0];
}
