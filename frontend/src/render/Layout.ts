/** Responsive layout math — mobile-first, portrait/landscape/desktop. */
export interface Layout {
  cell: number; gap: number; band: number; boardW: number; boardH: number;
  boardX: number; boardY: number; portrait: boolean; scale: number;
}

/**
 * `bandFrac` is the housing thickness as a fraction of ONE CELL.
 *
 * It used to be expressed in gap units, which tied the mass of the cabinet to
 * the width of the gutters between symbols — so tightening the grid (a fix)
 * silently dissolved the frame (a regression). Those two numbers describe
 * unrelated things and are now independent: gaps come from the cell, the
 * housing comes from the cell, neither comes from the other.
 *
 * The frame is drawn OUTSIDE the board rect, so its space has to be bought out
 * of the available area or the corner fittings and the cartouche get clipped by
 * the stage edge. Solved directly rather than iterated:
 *
 *     avail = cols * cell + (cols + 1) * gap + 2 * bandFrac * cell
 */
export function computeLayout(
  w: number, h: number, cols: number, rows: number, bandFrac = 0,
): Layout {
  const portrait = h >= w;
  const margin = Math.round(Math.min(w, h) * 0.035);
  // Room for the wordmark only. This used to reserve 14% of the stage for a
  // corner HUD that duplicated the control bar; deleting that HUD gives the
  // band back to the grid, and the grid is what a slot is.
  const hudTop = Math.round(Math.min(h * 0.095, 74));
  // NOTE: no separate reservation under the board. The Heat gauge used to hang
  // below the housing in its own 6% strip, where it read as a stray progress
  // bar; it now lives INSIDE the bottom rail of the frame, which is where a
  // cabinet puts a meter and costs the grid nothing.
  const availW = w - margin * 2;
  const availH = h - hudTop - margin * 2;
  // Tight gutters: wide ones made the board read as a spreadsheet. Reference
  // grids sit close, with the symbols nearly touching.
  const gap = Math.max(3, Math.round(Math.min(availW, availH) * 0.009));
  const cellByW = (availW - (cols + 1) * gap) / (cols + 2 * bandFrac);
  const cellByH = (availH - (rows + 1) * gap) / (rows + 2 * bandFrac);
  const cell = Math.floor(Math.max(24, Math.min(cellByW, cellByH)));
  const band = Math.max(9, Math.round(cell * bandFrac));
  const boardW = cols * cell + (cols + 1) * gap;
  const boardH = rows * cell + (rows + 1) * gap;
  return {
    cell, gap, band, boardW, boardH,
    boardX: Math.round((w - boardW) / 2),
    boardY: Math.round(hudTop + margin + (availH - boardH - band * 2) / 2 + band),
    portrait, scale: 1,
  };
}
