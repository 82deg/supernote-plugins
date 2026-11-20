import {
  barCorners,
  decodeBorder,
  encodeBorder,
  frameLayout,
  insetFractions,
  perimeter,
  type Bar,
  type Border,
} from '../src/image/border';

const photo = {width: 600, height: 400};
const line = (style: 'solid' | 'dash' | 'dot', width: 'thin' | 'med' | 'thick' = 'med'): Border => ({
  kind: 'line',
  style,
  width,
  tone: 'dark',
});
const tape = (placement: 'topCorners' | 'corners' | 'top' | 'frame'): Border => ({
  kind: 'tape',
  pattern: 'stars',
  width: 'slim',
  placement,
});
const dist = (a: Bar, b: Bar) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

describe('encode / decode', () => {
  it('round-trips every kind', () => {
    for (const b of [line('dash', 'thick'), tape('frame'), {kind: 'none'} as Border]) {
      expect(decodeBorder(encodeBorder(b))).toEqual(b);
    }
  });

  it('treats garbage as no border', () => {
    expect(decodeBorder('l.wobbly.med.dark')).toEqual({kind: 'none'});
    expect(decodeBorder('t.stars.slim.corners.extra')).toEqual({kind: 'none'});
    expect(decodeBorder(42)).toEqual({kind: 'none'});
  });
});

describe('line borders', () => {
  it('sits outside the photo: same width on every side', () => {
    const f = frameLayout(photo, 0, line('solid'), 2); // medium = 4 dp → 8 units
    expect(f.insets).toEqual({l: 8, t: 8, r: 8, b: 8});
    expect(f.canvas).toEqual({width: 616, height: 416});
    expect(f.photo).toMatchObject({left: 8, top: 8, width: 600, height: 400});
    expect(f.outline).toMatchObject({left: 0, top: 0, width: 616, height: 416, radius: 0, stroke: 8});
  });

  it('rounds the outline with the photo', () => {
    expect(frameLayout(photo, 20, line('solid'), 2).outline!.radius).toBe(28);
  });

  it('never gets thicker than 8% of the short side', () => {
    expect(frameLayout({width: 100, height: 50}, 0, line('solid', 'thick'), 4).insets.l).toBe(4);
  });

  for (const r of [0, 30, 200]) {
    it(`spaces dashes evenly all the way round (radius ${r})`, () => {
      const f = frameLayout(photo, r, line('dash'), 2);
      const n = f.pills.length;
      expect(n).toBeGreaterThan(10);
      // Equal arc-length steps: neighbours (and last → first) are about the same distance apart.
      const gaps = f.pills.map((p, i) => dist(p, f.pills[(i + 1) % n]));
      const step = perimeter(photo, Math.min(r, 200), 8) / n;
      for (const g of gaps) {
        expect(g).toBeLessThanOrEqual(step + 0.5);
        expect(g).toBeGreaterThan(step * 0.7); // chords round a corner are a bit shorter
      }
      // Fully rounded: every pill is at least as long as it is thick.
      for (const p of f.pills) {
        expect(p.length).toBeGreaterThanOrEqual(p.thickness);
      }
    });
  }

  it('dots are round', () => {
    const f = frameLayout(photo, 0, line('dot'), 2);
    for (const p of f.pills) {
      expect(p.length).toBe(p.thickness);
    }
  });

  it('keeps dashes on the centre line of the border', () => {
    const f = frameLayout(photo, 0, line('dash'), 2);
    const top = f.pills.filter(p => Math.abs(p.angle) < 1);
    expect(top.length).toBeGreaterThan(3);
    for (const p of top) {
      expect(p.cy).toBeCloseTo(4); // w/2 above the photo, which sits at y = 8
    }
  });
});

describe('tape', () => {
  it('two top corners: strips at 45° on the top corners, overhang only where they stick out', () => {
    const f = frameLayout(photo, 0, tape('topCorners'), 2);
    expect(f.tapes).toHaveLength(2);
    expect(f.tapes.map(t => t.angle)).toEqual([-45, 45]);
    expect(f.insets.t).toBeGreaterThan(0);
    expect(f.insets.b).toBe(0);
  });

  it('all corners: four strips, overhang on every side', () => {
    const f = frameLayout(photo, 0, tape('corners'), 2);
    expect(f.tapes).toHaveLength(4);
    expect(Math.min(f.insets.l, f.insets.t, f.insets.r, f.insets.b)).toBeGreaterThan(0);
  });

  it('top centre: one strip, centred on the top edge', () => {
    const f = frameLayout(photo, 0, tape('top'), 2);
    expect(f.tapes).toHaveLength(1);
    expect(f.tapes[0].cx).toBeCloseTo(f.photo.left + 300);
    expect(f.tapes[0].cy).toBeCloseTo(f.photo.top);
  });

  it('frame: four strips along the edges, half over the photo', () => {
    const f = frameLayout(photo, 0, tape('frame'), 2);
    expect(f.tapes).toHaveLength(4);
    const t = f.tapes[0].thickness;
    expect(f.insets.t).toBeCloseTo(t / 2);
  });

  it('follows rounded corners: a circle photo gets tape on the circle, not in the air', () => {
    const square = {width: 400, height: 400};
    const f = frameLayout(square, 200, tape('corners'), 2);
    const centre = {x: f.photo.left + 200, y: f.photo.top + 200};
    for (const s of f.tapes) {
      expect(Math.hypot(s.cx - centre.x, s.cy - centre.y)).toBeCloseTo(200);
    }
  });

  it('stays in proportion on small photos', () => {
    const f = frameLayout({width: 100, height: 80}, 0, tape('corners'), 4);
    expect(f.tapes[0].thickness).toBeCloseTo(80 * 0.22);
  });

  it('every strip fits inside the canvas', () => {
    for (const p of ['topCorners', 'corners', 'top', 'frame'] as const) {
      const f = frameLayout(photo, 24, tape(p), 2);
      for (const c of f.tapes.flatMap(barCorners)) {
        expect(c.x).toBeGreaterThanOrEqual(-0.01);
        expect(c.y).toBeGreaterThanOrEqual(-0.01);
        expect(c.x).toBeLessThanOrEqual(f.canvas.width + 0.01);
        expect(c.y).toBeLessThanOrEqual(f.canvas.height + 0.01);
      }
    }
  });
});

describe('scale invariance and fractions', () => {
  it('the same border at twice the size is exactly twice as big', () => {
    const a = frameLayout(photo, 24, tape('corners'), 2);
    const b = frameLayout({width: 1200, height: 800}, 48, tape('corners'), 4);
    expect(b.canvas.width).toBeCloseTo(a.canvas.width * 2);
    expect(insetFractions(b).l).toBeCloseTo(insetFractions(a).l);
  });

  it('no border: no insets', () => {
    const f = frameLayout(photo, 0, {kind: 'none'}, 2);
    expect(f.canvas).toEqual(photo);
    expect(insetFractions(f)).toEqual({l: 0, t: 0, r: 0, b: 0});
  });
});
