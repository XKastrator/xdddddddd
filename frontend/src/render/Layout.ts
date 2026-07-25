/** Responsive layout math — mobile-first, portrait/landscape/desktop. */
export interface Layout {
  cell: number; gap: number; boardW: number; boardH: number;
  boardX: number; boardY: number; portrait: boolean; scale: number;
}

/**
 * `frameBand` is the housing thickness expressed in GAP units (ReelFrame.BAND).
 * The frame is drawn outside the board rect, so the space it needs has to come
 * out of the available area — otherwise the corner fittings and the cartouche
 * get clipped by the stage edge on small screens.
 */
export function computeLayout(
  w: number, h: number, cols: number, rows: number, frameBand = 0,
): Layout {
  const portrait = h >= w;
  const margin = Math.round(Math.min(w, h) * 0.04);
  // Reserve a band at the top for the in-canvas HUD (mode/total/win/spins/vault)
  // and a little breathing room for the Heat gauge that sits above the board.
  // The control bar reserves its own height before this is called.
  const hudTop = Math.round(Math.min(h * 0.14, 104));
  const heatRoom = Math.round(Math.min(w, h) * 0.06);
  const availW = w - margin * 2;
  const availH = h - hudTop - heatRoom - margin * 2;
  // The frame scales with the gap, which itself scales with the cell, so the
  // reservation is solved directly rather than iterated: every gap unit spent on
  // the housing is a gap unit unavailable to the grid.
  const gapUnitsW = cols + 1 + frameBand * 2;
  const gapUnitsH = rows + 1 + frameBand * 2;
  const gap = Math.max(4, Math.round(Math.min(availW, availH) * 0.012));
  const cellByW = (availW - gapUnitsW * gap) / cols;
  const cellByH = (availH - gapUnitsH * gap) / rows;
  const cell = Math.floor(Math.max(24, Math.min(cellByW, cellByH)));
  const boardW = cols * cell + (cols + 1) * gap;
  const boardH = rows * cell + (rows + 1) * gap;
  return {
    cell, gap, boardW, boardH,
    boardX: Math.round((w - boardW) / 2),
    boardY: Math.round(hudTop + heatRoom + margin + (availH - boardH) / 2),
    portrait, scale: 1,
  };
}
