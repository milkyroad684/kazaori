import type { Dir, Fan, LeafSnapshot, Level, SimResult } from '../src/types.js';
import { simulate, validatePlacement } from '../src/engine.js';
import levelsJson from '../levels/levels.json' with { type: 'json' };

const LEVELS = levelsJson as Level[];
const CELL = 48;
const ANIM_MS = 380;
const INITIAL_HOLD_MS = 450;

const DIR_ARROW: Record<Dir, string> = { U: '↑', R: '→', D: '↓', L: '←' };
const OUTCOME_LABEL = {
  win: '勝利！',
  dead: '失敗（茨に進入）',
  stall: '手詰まり',
  timeout: '時間切れ（40 ターン）',
} as const;

interface Cell {
  x: number;
  y: number;
}

class Game {
  level!: Level;
  placedFans: Fan[] = [];
  selectedDir: Dir = 'R';
  isSimulating = false;
  result: SimResult | null = null;
  animFrame = -1;
  animTimer: number | null = null;

  canvas = document.getElementById('board') as HTMLCanvasElement;
  ctx = this.canvas.getContext('2d')!;
  levelSel = document.getElementById('level-select') as HTMLSelectElement;
  fanCountEl = document.getElementById('fan-count') as HTMLElement;
  fanBudgetEl = document.getElementById('fan-budget') as HTMLElement;
  runBtn = document.getElementById('run-btn') as HTMLButtonElement;
  resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
  resultEl = document.getElementById('result') as HTMLElement;
  dirBtns = document.querySelectorAll<HTMLButtonElement>('.dir-btn');

  constructor() {
    for (const lv of LEVELS) {
      const opt = document.createElement('option');
      opt.value = String(lv.id);
      opt.textContent = `Lv${lv.id}: ${lv.name}`;
      this.levelSel.appendChild(opt);
    }
    this.levelSel.addEventListener('change', () => this.loadLevel(Number(this.levelSel.value)));

    this.dirBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedDir = btn.dataset.dir as Dir;
        this.updateDirUI();
      });
    });
    this.updateDirUI();

    this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    this.runBtn.addEventListener('click', () => this.run());
    this.resetBtn.addEventListener('click', () => this.reset());

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLSelectElement) return;
      const map: Record<string, Dir> = {
        ArrowUp: 'U', ArrowRight: 'R', ArrowDown: 'D', ArrowLeft: 'L',
        w: 'U', d: 'R', s: 'D', a: 'L',
      };
      const dir = map[e.key];
      if (dir) {
        this.selectedDir = dir;
        this.updateDirUI();
        e.preventDefault();
      } else if (e.key === 'Enter' && !this.runBtn.disabled) {
        this.run();
      } else if (e.key === 'r' || e.key === 'R') {
        this.reset();
      }
    });

    this.loadLevel(1);
  }

  updateDirUI() {
    this.dirBtns.forEach((b) => b.classList.toggle('active', b.dataset.dir === this.selectedDir));
  }

  loadLevel(id: number) {
    const lv = LEVELS.find((l) => l.id === id);
    if (!lv) return;
    this.level = lv;
    this.levelSel.value = String(id);
    this.placedFans = [];
    this.result = null;
    this.animFrame = -1;
    this.isSimulating = false;
    if (this.animTimer !== null) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
    }
    this.canvas.width = lv.width * CELL;
    this.canvas.height = lv.height * CELL;
    this.fanBudgetEl.textContent = String(lv.fanBudget);
    this.updateUI();
    this.render();
  }

  updateUI() {
    this.fanCountEl.textContent = String(this.placedFans.length);
    this.runBtn.disabled = this.isSimulating || this.placedFans.length === 0;

    if (this.isSimulating && this.result) {
      const cur = Math.max(this.animFrame + 1, 0);
      this.resultEl.textContent = `▶ シミュレーション中  ターン ${cur} / ${this.result.trace.length}`;
      this.resultEl.className = 'result playing';
    } else if (this.result && !this.isSimulating) {
      this.resultEl.textContent = `${OUTCOME_LABEL[this.result.outcome]}  (${this.result.turns} ターン)`;
      this.resultEl.className = `result ${this.result.outcome}`;
    } else if (this.placedFans.length === 0) {
      this.resultEl.textContent = '空セルをクリックしてファンを配置';
      this.resultEl.className = 'result';
    } else {
      this.resultEl.textContent = '実行ボタンでシミュレーション開始';
      this.resultEl.className = 'result';
    }
  }

  cellAt(e: MouseEvent): Cell | null {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const x = Math.floor(px / CELL);
    const y = Math.floor(py / CELL);
    if (x < 0 || x >= this.level.width || y < 0 || y >= this.level.height) return null;
    return { x, y };
  }

  onCanvasClick(e: MouseEvent) {
    if (this.isSimulating) return;
    const cell = this.cellAt(e);
    if (!cell) return;

    const placedIdx = this.placedFans.findIndex((f) => f.x === cell.x && f.y === cell.y);
    if (placedIdx !== -1) {
      this.placedFans.splice(placedIdx, 1);
      this.result = null;
      this.animFrame = -1;
      this.updateUI();
      this.render();
      return;
    }

    const candidate: Fan = { x: cell.x, y: cell.y, dir: this.selectedDir };
    const test = [...this.placedFans, candidate];
    const check = validatePlacement(this.level, test);
    if (!check.ok) return;

    this.placedFans = test;
    this.result = null;
    this.animFrame = -1;
    this.updateUI();
    this.render();
  }

  run() {
    if (this.placedFans.length === 0 || this.isSimulating) return;
    try {
      this.result = simulate(this.level, this.placedFans);
    } catch (err) {
      console.error(err);
      return;
    }
    this.isSimulating = true;
    this.animFrame = -1;
    this.updateUI();
    this.render();
    this.animTimer = window.setTimeout(() => this.advanceAnim(), INITIAL_HOLD_MS);
  }

  advanceAnim() {
    if (!this.result) return;
    this.animFrame++;
    this.render();
    if (this.animFrame < this.result.trace.length - 1) {
      this.updateUI();
      this.animTimer = window.setTimeout(() => this.advanceAnim(), ANIM_MS);
    } else {
      this.isSimulating = false;
      this.animTimer = null;
      this.updateUI();
    }
  }

  reset() {
    if (this.animTimer !== null) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
    }
    this.placedFans = [];
    this.result = null;
    this.animFrame = -1;
    this.isSimulating = false;
    this.updateUI();
    this.render();
  }

  currentLeafPositions(): LeafSnapshot[] {
    if (this.result && this.animFrame >= 0) {
      return this.result.trace[this.animFrame];
    }
    return this.level.leaves.map(([x, y]) => ({ x, y }));
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#faf5ed';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#e2d4bd';
    ctx.lineWidth = 1;
    for (let i = 0; i <= this.level.width; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, h);
      ctx.stroke();
    }
    for (let j = 0; j <= this.level.height; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * CELL + 0.5);
      ctx.lineTo(w, j * CELL + 0.5);
      ctx.stroke();
    }

    for (const [x, y] of this.level.walls) this.drawWall(x, y);
    for (const [x, y] of this.level.holes) this.drawHole(x, y);
    for (const [x, y] of this.level.thorns) this.drawThorn(x, y);
    for (const f of this.level.fixedFans) this.drawFan(f, true);
    for (const f of this.placedFans) this.drawFan(f, false);

    const leaves = this.currentLeafPositions();
    leaves.forEach((pos, idx) => {
      if (!pos) return;
      const isDead = this.result?.outcome === 'dead' &&
        this.animFrame === this.result.trace.length - 1 &&
        idx === this.indexOfDeadLeaf();
      this.drawLeaf(pos.x, pos.y, isDead);
    });
  }

  indexOfDeadLeaf(): number {
    if (!this.result || this.result.outcome !== 'dead') return -1;
    const lastFrame = this.result.trace[this.result.trace.length - 1];
    const prevFrame = this.result.trace[this.result.trace.length - 2] ?? null;
    const thornSet = new Set(this.level.thorns.map(([x, y]) => `${x},${y}`));
    for (let i = 0; i < lastFrame.length; i++) {
      const p = lastFrame[i];
      if (!p) continue;
      if (thornSet.has(`${p.x},${p.y}`)) {
        if (!prevFrame) return i;
        const pp = prevFrame[i];
        if (!pp || pp.x !== p.x || pp.y !== p.y) return i;
      }
    }
    return -1;
  }

  drawWall(x: number, y: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
  }

  drawHole(x: number, y: number) {
    const ctx = this.ctx;
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, CELL * 0.4);
    g.addColorStop(0, '#000');
    g.addColorStop(1, '#3a3a5a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a0a0c0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.02) {
      const angle = t * Math.PI * 3;
      const r = CELL * 0.3 * (1 - t);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  drawThorn(x: number, y: number) {
    const ctx = this.ctx;
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;
    const r = CELL * 0.32;
    ctx.fillStyle = '#a83333';
    ctx.strokeStyle = '#6e1f1f';
    ctx.lineWidth = 1.2;
    const spikes = 8;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(ang) * rr;
      const py = cy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawFan(f: Fan, fixed: boolean) {
    const ctx = this.ctx;
    const px = f.x * CELL;
    const py = f.y * CELL;
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    ctx.fillStyle = fixed ? '#7a5a3a' : '#4a6fa5';
    ctx.strokeStyle = fixed ? '#4a3a2a' : '#2c4670';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px + 4, py + 4, CELL - 8, CELL - 8, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.floor(CELL * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(DIR_ARROW[f.dir], cx, cy + 2);
  }

  drawLeaf(x: number, y: number, dead: boolean) {
    const ctx = this.ctx;
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 5);
    ctx.fillStyle = dead ? '#7a3a3a' : '#4a8a4a';
    ctx.strokeStyle = dead ? '#3a1a1a' : '#2c5a2c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.3, CELL * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-CELL * 0.3, 0);
    ctx.lineTo(CELL * 0.3, 0);
    ctx.stroke();
    ctx.restore();
    if (dead) {
      ctx.strokeStyle = '#a83333';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - CELL * 0.2, cy - CELL * 0.2);
      ctx.lineTo(cx + CELL * 0.2, cy + CELL * 0.2);
      ctx.moveTo(cx + CELL * 0.2, cy - CELL * 0.2);
      ctx.lineTo(cx - CELL * 0.2, cy + CELL * 0.2);
      ctx.stroke();
    }
  }
}

new Game();
