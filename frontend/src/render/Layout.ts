/** Responsive layout math — mobile-first, portrait/landscape/desktop. */
export interface Layout {
  cell: number; gap: number; boardW: number; boardH: number;
  boardX: number; boardY: number; portrait: boolean; scale: number;
}

export function computeLayout(
  w: number, h: number, cols: number, rows: number,
): Layout {
  const portrait = h >= w;
  const margin = Math.round(Math.min(w, h) * 0.04);
  // Reserve a band at the top for the in-canvas HUD (mode/total/win/spins/vault)
  // and a little breathing room for the Heat gauge that sits above the board.
  // Spin controls live in the DOM below the canvas, so no bottom reserve here.
  const hudTop = Math.round(Math.min(h * 0.14, 104));
  const heatRoom = Math.round(Math.min(w, h) * 0.06);
  const availW = w - margin * 2;
  const availH = h - hudTop - heatRoom - margin * 2;
  const gap = Math.max(4, Math.round(Math.min(availW, availH) * 0.012));
  const cellByW = (availW - (cols + 1) * gap) / cols;
  const cellByH = (availH - (rows + 1) * gap) / rows;
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
