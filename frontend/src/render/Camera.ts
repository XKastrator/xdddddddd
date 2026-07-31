/**
 * Camera — the scene moves, not just the things in it.
 *
 * Our board animated while the shot never did: same framing on a dead spin as
 * on a max win. Every commercial slot pushes in on the moment that matters,
 * pulls back when the round changes shape, and kicks on impact. That is a
 * property of the SHOT, and it costs no artwork.
 *
 * Applied to a container by writing `scale` and `pivot`, never `position`:
 * layout owns position, so a resize landing mid-move must not fight this. The
 * pivot is kept at the container's own centre so a zoom goes toward the middle
 * of the board rather than its top-left corner.
 *
 * Everything is spring-driven rather than tweened. A tween has to know how long
 * it will run, which means a second event arriving mid-move either cancels the
 * first or queues behind it; a spring just gets a new target and keeps going.
 */
import type { Container } from 'pixi.js';

export class Camera {
  private zoom = 1;
  private zoomV = 0;
  private target = 1;
  private kickX = 0;
  private kickY = 0;
  private kickV = 0;
  /** Layout's own scale and position — the camera multiplies, never replaces. */
  private baseScale = 1;
  private baseX = 0;
  private baseY = 0;
  private cx = 0;
  private cy = 0;

  constructor(private view: Container) {}

  /**
   * Told by the presenter's resize.
   *
   * Layout owns where the board sits and how big it is; the camera only adds
   * to that. Writing `scale` outright would have the two fight, and a resize
   * landing mid-zoom would snap the board to the wrong size.
   */
  setBase(scale: number, x: number, y: number, w: number, h: number): void {
    this.baseScale = scale;
    this.baseX = x; this.baseY = y;
    this.cx = w / 2; this.cy = h / 2;
  }

  /**
   * Push in or pull back. 1 is neutral; 1.06 is a noticeable but not showy
   * push, roughly where a big-win shot sits in a commercial game.
   */
  to(zoom: number): void { this.target = zoom; }

  /** A single impulse — impact, not framing. */
  kick(power: number): void {
    const a = Math.random() * Math.PI * 2;
    this.kickX += Math.cos(a) * power;
    this.kickY += Math.sin(a) * power;
    this.kickV = 1;
  }

  /** Return to neutral framing. */
  reset(): void { this.target = 1; }

  update(dt: number, reduced: boolean): void {
    if (reduced) {
      this.zoom = this.target;
      this.kickX = this.kickY = 0;
    } else {
      const k = 90, c = 15;
      this.zoomV += (-k * (this.zoom - this.target) - c * this.zoomV) * dt;
      this.zoom += this.zoomV * dt;
      // decays fast and flips sign, so it reads as a rattle, not a drift
      this.kickV = Math.max(0, this.kickV - dt * 4.5);
      this.kickX *= -0.82 * this.kickV + 0.001;
      this.kickY *= -0.82 * this.kickV + 0.001;
    }

    this.view.scale.set(this.baseScale * this.zoom);
    // zoom about the board's centre: as scale grows, pull the origin back by
    // half the growth so the middle of the grid stays where it was
    const off = this.baseScale * (this.zoom - 1);
    this.view.position.set(
      this.baseX - this.cx * off + this.kickX,
      this.baseY - this.cy * off + this.kickY,
    );
  }
}
