export type Dir = 'U' | 'R' | 'D' | 'L';

export interface Vec {
  x: number;
  y: number;
}

export interface Fan {
  x: number;
  y: number;
  dir: Dir;
}

export interface Level {
  id: number;
  name: string;
  width: number;
  height: number;
  fanBudget: number;
  leaves: [number, number][];
  holes: [number, number][];
  walls: [number, number][];
  thorns: [number, number][];
  fixedFans: Fan[];
}

export type Outcome = 'win' | 'dead' | 'stall' | 'timeout';

export type LeafSnapshot = Vec | null;

export interface SimResult {
  outcome: Outcome;
  turns: number;
  trace: LeafSnapshot[][];
}

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
}
