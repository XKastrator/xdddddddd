/**
 * Player-facing game facts, shared by the help screen and the buy panel.
 *
 * IMPORTANT: these values mirror math/game/game_config.py and the measured
 * results in PAR_REPORT.md. They are DISPLAY ONLY — no payout is ever computed
 * on the client. Keep in sync when the math is retuned.
 */
import type { BetModeName } from '../types/events';

export const RTP = 0.965;          // all modes, measured exactly (PAR_REPORT.md)
export const MAX_WIN = 15000;      // x bet
export const FUSE_THRESHOLD = 4;
export const JUMP_STEP = 3;        // +1 rank per 3 extra cells

/** Rank ladder with the base value of a forged product (before Heat). */
/**
 * What a vein pays, by how many COLUMNS it crosses on its way from the seam to
 * the crucible. × bet, BEFORE Heat.
 *
 * MUST match `column_pay` in math/game/game_config.py. A paytable that disagrees
 * with the engine is worse than no paytable, and Stake Engine requires the
 * player-facing numbers to be the real ones.
 */
export const COLUMN_PAY: { columns: number; value: number }[] = [
  { columns: 1, value: 0.00104 },
  { columns: 2, value: 0.00229 },
  { columns: 3, value: 0.00521 },
  { columns: 4, value: 0.01250 },
  { columns: 5, value: 0.03335 },
  { columns: 6, value: 0.09900 },
];

export interface ModeInfo {
  name: BetModeName;
  cost: number;
  titleKey: string;
  descKey: string;
  isBuy: boolean;
}

export const MODES: ModeInfo[] = [
  { name: 'base', cost: 1, titleKey: 'mode.base', descKey: 'mode.base.desc', isBuy: false },
  { name: 'ante', cost: 1.25, titleKey: 'mode.ante', descKey: 'mode.ante.desc', isBuy: false },
  { name: 'bonus', cost: 100, titleKey: 'mode.bonus', descKey: 'mode.bonus.desc', isBuy: true },
  { name: 'super', cost: 500, titleKey: 'mode.super', descKey: 'mode.super.desc', isBuy: true },
];

export function modeInfo(name: BetModeName): ModeInfo {
  const m = MODES.find((x) => x.name === name);
  if (!m) throw new Error(`unknown mode ${name}`);
  return m;
}
