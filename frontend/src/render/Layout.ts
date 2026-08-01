/** Responsive layout math — mobile-first, portrait/landscape/desktop. */
export interface Layout {
  cell: number; gap: number; gapX: number; band: number;
  boardW: number; boardH: number;
  boardX: number; boardY: number; portrait: boolean; scale: number;
}

/**
 * The board's proportions, all expressed as fractions of ONE CELL.
 *
 * They used to be a mixture: gutters from a percentage of the stage, the
 * housing from a multiple of the gutter. That coupling is what let a change to
 * the gutters silently dissolve the cabinet. Everything is now anchored to the
 * cell, which is the only dimension that matters, and the layout solves for the
 * cell directly instead of iterating.
 *
 * The COLUMN gutter is deliberately ~2.7x the row gutter: a physical post runs
 * down each column boundary (see BoardView.buildPosts), and a post needs room
 * to be a post. Rows have no divider, so they sit tight.
 */
export const GAP_Y_FRAC = 0.084;
export const GAP_X_FRAC = 0.23;

export function computeLayout(
  w: number, h: number, cols: number, rows: number, bandFrac = 0,
): Layout {
  const portrait = h >= w;
  // Portrait is WIDTH-bound — six columns across a phone — so every pixel of
  // side margin comes straight off the cell. Landscape has width to spare and
  // uses the margin to keep the cabinet off the stage edge.
  const margin = Math.round(Math.min(w, h) * (portrait ? 0.016 : 0.035));
  // Room for the wordmark only. This used to reserve 14% of the stage for a
  // corner HUD that duplicated the control bar; deleting that HUD gave the band
  // back to the grid, and the grid is what a slot is.
  const hudTop = Math.round(Math.min(h * 0.095, 74));
  // NOTE: nothing is reserved UNDER the board. The Heat gauge used to hang
  // below the housing in its own 6% strip, where it read as a stray progress
  // bar; it now lives INSIDE the bottom rail of the frame, which is where a
  // cabinet puts a meter and costs the grid nothing.
  const availW = w - margin * 2;
  const availH = h - hudTop - margin * 2;
  // avail = cols * cell + (cols + 1) * gapX + 2 * band, with every term a
  // multiple of the cell — so this is one division, not a search
  const cellByW = availW / (cols + (cols + 1) * GAP_X_FRAC + 2 * bandFrac);
  const cellByH = availH / (rows + (rows + 1) * GAP_Y_FRAC + 2 * bandFrac);
  const cell = Math.floor(Math.max(24, Math.min(cellByW, cellByH)));
  // NOTE: `bandFrac` must NOT be adjusted per orientation here. The housing is
  // drawn in board-local units and scaled with the world, so what lands on
  // screen is always BAND_FRAC * cell; reserving less than that would push the
  // cabinet off the stage rather than making it thinner.
  const gap = Math.max(2, Math.round(cell * GAP_Y_FRAC));
  const gapX = Math.max(4, Math.round(cell * GAP_X_FRAC));
  const band = Math.max(9, Math.round(cell * bandFrac));
  const boardW = cols * cell + (cols + 1) * gapX;
  const boardH = rows * cell + (rows + 1) * gap;
  return {
    cell, gap, gapX, band, boardW, boardH,
    boardX: Math.round((w - boardW) / 2),
    // Vertically, the leftover is split 38/62 rather than evenly in portrait:
    // a 6x5 grid on a phone leaves a lot of height over, and centring it put an
    // equal band of empty room above and below so the board floated. Sitting it
    // high leaves the forge floor visible underneath, which is a composition.
    boardY: Math.round(hudTop + margin
      + (availH - boardH - band * 2) * (portrait ? 0.38 : 0.5) + band),
    portrait, scale: 1,
  };
}
