/**
 * Player-facing game facts, shared by the help screen and the buy panel.
 *
 * IMPORTANT: these values mirror math/game/game_config.py and the measured
 * results in PAR_REPORT.md. They are DISPLAY ONLY — no payout is ever computed
 * on the client. Keep in sync when the math is retuned.
 */
import { Sym } from '../types/events';
import type { BetModeName } from '../types/events';

export const RTP = 0.965;          // all modes, measured exactly (PAR_REPORT.md)
export const MAX_WIN = 15000;      // x bet
export const FUSE_THRESHOLD = 4;
export const JUMP_STEP = 3;        // +1 rank per 3 extra cells

/** Rank ladder with the base value of a forged product (before Heat). */
export const LADDER: { rank: number; sym: Sym; key: string; value: number }[] = [
  { rank: 0, sym: Sym.O1, key: 'sym.ore', value: 0 },
  { rank: 1, sym: Sym.BRONZE, key: 'sym.bronze', value: 0.03 },
  { rank: 2, sym: Sym.IRON, key: 'sym.iron', value: 0.45 },
  { rank: 3, sym: Sym.SILVER, key: 'sym.silver', value: 3.0 },
  { rank: 4, sym: Sym.GOLD, key: 'sym.gold', value: 18.0 },
  { rank: 5, sym: Sym.MYTHRIL, key: 'sym.mythril', value: 95.0 },
  { rank: 6, sym: Sym.CROWN, key: 'sym.crown', value: 700.0 },
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
