/**
 * Canvas paths hold native geometry outside the JavaScript heap. Keep only
 * numeric line segments in bounded, reusable typed arrays, then draw each
 * colour/opacity bucket through the canvas's current path once per frame.
 * Capacity grows on demand and is retained for later frames.
 */
export type WindStrokeContext = Pick<CanvasRenderingContext2D,
  'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'strokeStyle'>;

export class WindStrokeBuckets {
  private readonly buffers: Float32Array[];
  private readonly lengths: Uint32Array;
  private readonly levels: number;

  constructor(private readonly colors: readonly (readonly string[])[]) {
    this.levels = colors[0]?.length ?? 0;
    if (!this.levels || colors.some(row => row.length !== this.levels)) {
      throw new Error('Wind stroke palette must have equally sized, non-empty rows');
    }
    this.buffers = Array.from({ length: colors.length * this.levels }, () => new Float32Array(256));
    this.lengths = new Uint32Array(this.buffers.length);
  }

  reset(): void {
    this.lengths.fill(0);
  }

  /** continueTail preserves line joins for consecutive segments in one particle. */
  add(band: number, level: number, x: number, y: number, x2: number, y2: number, continueTail = false): void {
    const slot = band * this.levels + level;
    const offset = this.lengths[slot];
    let buffer = this.buffers[slot];
    // One flag plus four coordinates. A joined tail uses lineTo without
    // re-starting the subpath, preserving Canvas lineJoin on turns.
    if (offset + 5 > buffer.length) {
      const grown = new Float32Array(Math.max(offset + 5, buffer.length * 2));
      grown.set(buffer);
      buffer = grown;
      this.buffers[slot] = buffer;
    }
    buffer[offset] = continueTail ? 1 : 0;
    buffer[offset + 1] = x;
    buffer[offset + 2] = y;
    buffer[offset + 3] = x2;
    buffer[offset + 4] = y2;
    this.lengths[slot] = offset + 5;
  }

  paint(ctx: WindStrokeContext): void {
    for (let band = 0; band < this.colors.length; band++) {
      for (let level = 0; level < this.levels; level++) {
        const slot = band * this.levels + level;
        const length = this.lengths[slot];
        if (!length) continue;
        const buffer = this.buffers[slot];
        ctx.beginPath();
        for (let i = 0; i < length; i += 5) {
          if (buffer[i] === 0) ctx.moveTo(buffer[i + 1], buffer[i + 2]);
          ctx.lineTo(buffer[i + 3], buffer[i + 4]);
        }
        ctx.strokeStyle = this.colors[band][level];
        ctx.stroke();
      }
    }
  }
}
