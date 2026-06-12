import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine.js';
import levelsJson from '../levels/levels.json' with { type: 'json' };
import type { Dir, Fan, Level, LeafSnapshot } from '../src/types.js';

const LEVELS = levelsJson as Level[];

const getLevel = (id: number): Level => {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) throw new Error(`level ${id} not found`);
  return lv;
};

const fans = (arr: [number, number, Dir][]): Fan[] =>
  arr.map(([x, y, dir]) => ({ x, y, dir }));

const p = (x: number, y: number): LeafSnapshot => ({ x, y });
const gone: LeafSnapshot = null;

describe('AT-1 (Level 1) 追い風', () => {
  it('配置 (2,4,R) で 3 ターン勝利', () => {
    const r = simulate(getLevel(1), fans([[2, 4, 'R']]));
    expect(r.outcome).toBe('win');
    expect(r.turns).toBe(3);
    expect(r.trace).toEqual([[p(4, 4)], [p(5, 4)], [gone]]);
  });
});

describe('AT-2 (Level 2) 曲がり角', () => {
  it('配置 (1,5,R) (5,6,U) で 6 ターン勝利', () => {
    const r = simulate(getLevel(2), fans([
      [1, 5, 'R'],
      [5, 6, 'U'],
    ]));
    expect(r.outcome).toBe('win');
    expect(r.turns).toBe(6);
    expect(r.trace).toEqual([
      [p(3, 5)],
      [p(4, 5)],
      [p(5, 5)],
      [p(5, 4)],
      [p(5, 3)],
      [gone],
    ]);
  });
});

describe('AT-3 (Level 3) 向かい風', () => {
  it('配置 (3,4,R) で 2 ターン勝利。(5,4) は +2-1=+1 (W4)', () => {
    const r = simulate(getLevel(3), fans([[3, 4, 'R']]));
    expect(r.outcome).toBe('win');
    expect(r.turns).toBe(2);
    expect(r.trace).toEqual([[p(5, 4)], [gone]]);
  });
});

describe('AT-4 (Level 4) 風の継ぎ手', () => {
  it('配置 (1,4,R)(5,6,U)(4,2,R) で 8 ターン勝利。(5,3) に固定風は届かない (W1)', () => {
    const r = simulate(getLevel(4), fans([
      [1, 4, 'R'],
      [5, 6, 'U'],
      [4, 2, 'R'],
    ]));
    expect(r.outcome).toBe('win');
    expect(r.turns).toBe(8);
    expect(r.trace).toEqual([
      [p(3, 4)],
      [p(4, 4)],
      [p(5, 4)],
      [p(5, 3)],
      [p(5, 2)],
      [p(6, 2)],
      [p(7, 2)],
      [gone],
    ]);
  });
});

describe('AT-5 (Level 5) 雁行', () => {
  it('配置 (2,1,D)(2,7,U)(1,4,R) で 6 ターン勝利。M3 逐次処理と M4-2 穴の連続吸引', () => {
    const r = simulate(getLevel(5), fans([
      [2, 1, 'D'],
      [2, 7, 'U'],
      [1, 4, 'R'],
    ]));
    expect(r.outcome).toBe('win');
    expect(r.turns).toBe(6);
    expect(r.trace).toEqual([
      [p(2, 3), p(2, 5)],
      [p(2, 4), p(2, 5)],
      [p(3, 4), p(2, 4)],
      [p(4, 4), p(3, 4)],
      [gone, p(4, 4)],
      [gone, gone],
    ]);
  });
});

describe('AT-6 (Level 6) 逆風の門', () => {
  it('配置 (1,4,R)(5,6,U)(3,3,R)(7,0,D)(6,4,R) で 8 ターン勝利。(7,4)=+1 で W2 遮断', () => {
    const r = simulate(getLevel(6), fans([
      [1, 4, 'R'],
      [5, 6, 'U'],
      [3, 3, 'R'],
      [7, 0, 'D'],
      [6, 4, 'R'],
    ]));
    expect(r.outcome).toBe('win');
    expect(r.turns).toBe(8);
    expect(r.trace).toEqual([
      [p(3, 4)],
      [p(4, 4)],
      [p(5, 4)],
      [p(5, 3)],
      [p(6, 3)],
      [p(7, 3)],
      [p(7, 4)],
      [gone],
    ]);
  });
});

describe('AT-7 (Level 3) stall', () => {
  it('配置 (2,4,R) で 2 ターン目に (5,4) で v=0 → stall', () => {
    const r = simulate(getLevel(3), fans([[2, 4, 'R']]));
    expect(r.outcome).toBe('stall');
    expect(r.turns).toBe(2);
    expect(r.trace).toEqual([[p(5, 4)], [p(5, 4)]]);
  });
});

describe('AT-8 (Level 3) timeout', () => {
  it('配置 (1,4,R) で (4,4)↔(5,4) 永久振動 → 40 ターン timeout', () => {
    const r = simulate(getLevel(3), fans([[1, 4, 'R']]));
    expect(r.outcome).toBe('timeout');
    expect(r.turns).toBe(40);
    expect(r.trace).toHaveLength(40);
    // 奇数ターン末は (5,4)、偶数ターン末は (4,4)
    expect(r.trace[0]).toEqual([p(5, 4)]);
    expect(r.trace[1]).toEqual([p(4, 4)]);
    expect(r.trace[38]).toEqual([p(5, 4)]); // turn 39
    expect(r.trace[39]).toEqual([p(4, 4)]); // turn 40
  });
});

describe('AT-9 (Level 5) dead', () => {
  it('配置 (1,2,R) のみで A は (5,2) の茨に進入 → 3 ターン目に dead。B はずっと不動', () => {
    const r = simulate(getLevel(5), fans([[1, 2, 'R']]));
    expect(r.outcome).toBe('dead');
    expect(r.turns).toBe(3);
    expect(r.trace).toEqual([
      [p(3, 2), p(2, 6)],
      [p(4, 2), p(2, 6)],
      [p(5, 2), p(2, 6)],
    ]);
  });
});

describe('AT-10 (Level 6) stall', () => {
  it('配置 (1,4,R)(5,6,U)(3,3,R)(7,1,D)(6,4,R) で (7,4) で v=(+1,+1) → 8 ターン目 stall', () => {
    const r = simulate(getLevel(6), fans([
      [1, 4, 'R'],
      [5, 6, 'U'],
      [3, 3, 'R'],
      [7, 1, 'D'],
      [6, 4, 'R'],
    ]));
    expect(r.outcome).toBe('stall');
    expect(r.turns).toBe(8);
    expect(r.trace).toEqual([
      [p(3, 4)],
      [p(4, 4)],
      [p(5, 4)],
      [p(5, 3)],
      [p(6, 3)],
      [p(7, 3)],
      [p(7, 4)],
      [p(7, 4)],
    ]);
  });
});
