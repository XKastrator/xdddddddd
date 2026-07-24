/**
 * MOLTEN CROWN — event contract (frontend side).
 *
 * These types mirror, one-to-one, the events emitted by the Python math engine
 * (math/engine/events.py). A `Book` returned by the RGS `/play` endpoint is an
 * ordered list of these events plus an integer `payoutMultiplier`. The frontend
 * reconstructs the entire round FROM THESE EVENTS ALONE — it never computes a
 * payout. See TECH_ARCHITECTURE.md for the full contract.
 */

/** Symbol ids — must match math/engine/symbols.py exactly. */
export enum Sym {
  EMPTY = 0,
  O1 = 1, O2 = 2, O3 = 3, O4 = 4, O5 = 5, // rank-0 ore variants
  BRONZE = 6, IRON = 7, SILVER = 8, GOLD = 9, MYTHRIL = 10, CROWN = 11,
  FLUX = 12,    // wild
  CINDER = 13,  // scatter
}

export type Board = Sym[][]; // board[row][col], row 0 = top
export type SpinKind = 'base' | 'free' | 'super';

export interface BaseEvent { index: number; type: string; }

export interface RevealBoard extends BaseEvent {
  type: 'revealBoard'; board: Board; heat: number; spinKind: SpinKind; scatters: number;
}
export interface Anticipation extends BaseEvent {
  type: 'anticipation'; scatters: number; needed: number;
}
export interface Fusion {
  from: Sym; to: Sym; cells: [number, number][]; wildCells: [number, number][];
  anchor: [number, number]; value: number;
}
export interface Forge extends BaseEvent { type: 'forge'; fusions: Fusion[]; heat: number; }
export interface Spawned { r: number; c: number; sym: Sym; }
export interface Gravity extends BaseEvent { type: 'gravity'; spawned: Spawned[]; board: Board; }
export interface HeatUpdate extends BaseEvent { type: 'heatUpdate'; heat: number; }
export interface Relic { r: number; c: number; sym: Sym; value: number; }
export interface SettleWin extends BaseEvent {
  type: 'settleWin'; relics: Relic[]; baseValue: number; heat: number; win: number;
}
export interface BonusStart extends BaseEvent {
  type: 'bonusStart'; mode: 'forge_fury' | 'molten_core'; spins: number; kind: SpinKind;
}
export interface SpinCounter extends BaseEvent { type: 'spinCounter'; remaining: number; total: number; }
export interface Retrigger extends BaseEvent { type: 'retrigger'; added: number; spins: number; }
export interface SuperSeed extends BaseEvent { type: 'superSeed'; board: Board; minRank: number; }
export interface LockUpdate extends BaseEvent { type: 'lockUpdate'; locked: Relic[]; vault: number; }
export interface Pour extends BaseEvent { type: 'pour'; vault: number; heat: number; win: number; }
export interface TotalWinUpdate extends BaseEvent { type: 'totalWinUpdate'; totalWin: number; }
export interface MaxWin extends BaseEvent { type: 'maxWin'; }
export interface FinalWin extends BaseEvent { type: 'finalWin'; amount: number; }
export interface RoundEnd extends BaseEvent { type: 'roundEnd'; }

export type GameEvent =
  | RevealBoard | Anticipation | Forge | Gravity | HeatUpdate | SettleWin
  | BonusStart | SpinCounter | Retrigger | SuperSeed | LockUpdate | Pour
  | TotalWinUpdate | MaxWin | FinalWin | RoundEnd;

export interface Book {
  id: number;
  events: GameEvent[];
  payoutMultiplier: number; // integer, x100 (1150 == 11.5x)
}

export type BetModeName = 'base' | 'ante' | 'bonus' | 'super';
