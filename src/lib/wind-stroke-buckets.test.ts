import { describe, expect, it } from 'vitest';
import { WindStrokeBuckets, type WindStrokeContext } from './wind-stroke-buckets';

function sink() {
  const calls: string[] = [];
  const ctx = {
    strokeStyle: '',
    beginPath: () => calls.push('begin'),
    moveTo: (x: number, y: number) => calls.push(`M ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`L ${x},${y}`),
    stroke: () => calls.push(`stroke ${ctx.strokeStyle}`),
  } satisfies WindStrokeContext;
  return { ctx, calls };
}

describe('WindStrokeBuckets', () => {
  it('retains band/opacity painting order and the original segment endpoints', () => {
    const strokes = new WindStrokeBuckets([['a0', 'a1'], ['b0', 'b1']]);
    const { ctx, calls } = sink();
    strokes.add(1, 0, 10, 20, 30, 40);
    strokes.add(0, 1, 1, 2, 3, 4);
    strokes.add(1, 0, 30, 40, 50, 60);
    strokes.paint(ctx);
    expect(calls).toEqual([
      'begin', 'M 1,2', 'L 3,4', 'stroke a1',
      'begin', 'M 10,20', 'L 30,40', 'M 30,40', 'L 50,60', 'stroke b0',
    ]);
  });

  it('resets content while reusing capacity after its initial growth', () => {
    const strokes = new WindStrokeBuckets([['a']]);
    const access = strokes as unknown as { buffers: Float32Array[] };
    for (let i = 0; i < 100; i++) strokes.add(0, 0, i, 1, i + 1, 2);
    const allocated = access.buffers[0];
    strokes.reset();
    for (let i = 0; i < 100; i++) strokes.add(0, 0, i, 1, i + 1, 2);
    expect(access.buffers[0]).toBe(allocated);
    const { ctx, calls } = sink();
    strokes.paint(ctx);
    expect(calls.filter(c => c === 'begin')).toHaveLength(1);
    strokes.reset();
    const empty = sink();
    strokes.paint(empty.ctx);
    expect(empty.calls).toEqual([]);
  });
});
