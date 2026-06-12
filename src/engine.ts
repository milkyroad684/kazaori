import type {
  Dir,
  Fan,
  LeafSnapshot,
  Level,
  PlacementCheck,
  SimResult,
  Vec,
} from './types.js';

const DIR_VEC: Record<Dir, Vec> = {
  U: { x: 0, y: -1 },
  R: { x: 1, y: 0 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
};

const keyOf = (x: number, y: number): string => `${x},${y}`;

const inBounds = (level: Level, x: number, y: number): boolean =>
  x >= 0 && x < level.width && y >= 0 && y < level.height;

const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function computeField(
  level: Level,
  placedFans: readonly Fan[],
): Map<string, Vec> {
  const field = new Map<string, Vec>();
  const wallSet = new Set(level.walls.map(([x, y]) => keyOf(x, y)));
  const allFans: Fan[] = [...level.fixedFans, ...placedFans];
  const fanSet = new Set(allFans.map((f) => keyOf(f.x, f.y)));

  for (const fan of allFans) {
    const dv = DIR_VEC[fan.dir];
    for (let d = 1; d <= 3; d++) {
      const x = fan.x + dv.x * d;
      const y = fan.y + dv.y * d;
      if (!inBounds(level, x, y)) break;
      const k = keyOf(x, y);
      if (wallSet.has(k)) break;
      if (fanSet.has(k)) break;
      const strength = 4 - d;
      const prev = field.get(k) ?? { x: 0, y: 0 };
      field.set(k, {
        x: prev.x + dv.x * strength,
        y: prev.y + dv.y * strength,
      });
    }
  }
  return field;
}

export function validatePlacement(
  level: Level,
  placedFans: readonly Fan[],
): PlacementCheck {
  if (placedFans.length > level.fanBudget) {
    return {
      ok: false,
      reason: `fanBudget exceeded: ${placedFans.length} > ${level.fanBudget}`,
    };
  }
  const occupied = new Set<string>();
  for (const [x, y] of level.walls) occupied.add(keyOf(x, y));
  for (const f of level.fixedFans) occupied.add(keyOf(f.x, f.y));
  for (const [x, y] of level.holes) occupied.add(keyOf(x, y));
  for (const [x, y] of level.thorns) occupied.add(keyOf(x, y));
  for (const [x, y] of level.leaves) occupied.add(keyOf(x, y));

  const seen = new Set<string>();
  for (const f of placedFans) {
    if (!inBounds(level, f.x, f.y)) {
      return { ok: false, reason: `fan out of bounds: (${f.x},${f.y})` };
    }
    const k = keyOf(f.x, f.y);
    if (occupied.has(k)) {
      return { ok: false, reason: `cell occupied: (${f.x},${f.y})` };
    }
    if (seen.has(k)) {
      return { ok: false, reason: `duplicate fan: (${f.x},${f.y})` };
    }
    seen.add(k);
  }
  return { ok: true };
}

function dominantAxisDir(v: Vec): Vec | null {
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  if (ax > ay) return { x: sign(v.x), y: 0 };
  if (ay > ax) return { x: 0, y: sign(v.y) };
  return null;
}

interface LeafState {
  pos: Vec;
  gone: boolean;
}

type StepOutcome = 'continue' | 'win' | 'dead' | 'stall';

function stepInternal(
  level: Level,
  placedFans: readonly Fan[],
  leaves: LeafState[],
): StepOutcome {
  const field = computeField(level, placedFans);
  const wallSet = new Set(level.walls.map(([x, y]) => keyOf(x, y)));
  const allFans = [...level.fixedFans, ...placedFans];
  const fanSet = new Set(allFans.map((f) => keyOf(f.x, f.y)));
  const holeSet = new Set(level.holes.map(([x, y]) => keyOf(x, y)));
  const thornSet = new Set(level.thorns.map(([x, y]) => keyOf(x, y)));

  let moved = false;

  for (const leaf of leaves) {
    if (leaf.gone) continue;
    const v = field.get(keyOf(leaf.pos.x, leaf.pos.y)) ?? { x: 0, y: 0 };
    const d = dominantAxisDir(v);
    if (!d) continue;
    const tx = leaf.pos.x + d.x;
    const ty = leaf.pos.y + d.y;
    if (!inBounds(level, tx, ty)) continue;
    const tk = keyOf(tx, ty);
    if (wallSet.has(tk)) continue;
    if (fanSet.has(tk)) continue;
    let blockedByLeaf = false;
    for (const other of leaves) {
      if (other === leaf) continue;
      if (other.gone) continue;
      if (other.pos.x === tx && other.pos.y === ty) {
        blockedByLeaf = true;
        break;
      }
    }
    if (blockedByLeaf) continue;

    leaf.pos = { x: tx, y: ty };
    moved = true;
    if (thornSet.has(tk)) return 'dead';
    if (holeSet.has(tk)) leaf.gone = true;
  }

  if (leaves.every((l) => l.gone)) return 'win';
  if (!moved) return 'stall';
  return 'continue';
}

export interface StepDiagnostic {
  outcome: StepOutcome;
  positions: LeafSnapshot[];
}

export function step(
  level: Level,
  placedFans: readonly Fan[],
  leaves: readonly { pos: Vec; gone: boolean }[],
): { next: LeafState[]; outcome: StepOutcome } {
  const next: LeafState[] = leaves.map((l) => ({
    pos: { x: l.pos.x, y: l.pos.y },
    gone: l.gone,
  }));
  const outcome = stepInternal(level, placedFans, next);
  return { next, outcome };
}

export function simulate(
  level: Level,
  placedFans: readonly Fan[],
  maxTurns: number = 40,
): SimResult {
  const check = validatePlacement(level, placedFans);
  if (!check.ok) {
    throw new Error(`invalid placement: ${check.reason}`);
  }

  const leaves: LeafState[] = level.leaves.map(([x, y]) => ({
    pos: { x, y },
    gone: false,
  }));
  const trace: LeafSnapshot[][] = [];

  for (let t = 1; t <= maxTurns; t++) {
    const outcome = stepInternal(level, placedFans, leaves);
    const snapshot: LeafSnapshot[] = leaves.map((l) =>
      l.gone ? null : { x: l.pos.x, y: l.pos.y },
    );
    trace.push(snapshot);
    if (outcome === 'win') return { outcome: 'win', turns: t, trace };
    if (outcome === 'dead') return { outcome: 'dead', turns: t, trace };
    if (outcome === 'stall') return { outcome: 'stall', turns: t, trace };
  }
  return { outcome: 'timeout', turns: maxTurns, trace };
}
