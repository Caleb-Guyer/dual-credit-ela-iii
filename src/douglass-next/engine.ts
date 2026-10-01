import { missions, type Chapter, type Mission, type Point } from './data';

export interface Obstacle {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}
export const obstacles = (chapter: Chapter, scene?: string): Obstacle[] => {
  if (chapter === 4)
    return [
      { x: -5, z: 7, w: 2, d: 7, h: 1 },
      { x: 7, z: -3, w: 3, d: 3, h: 1.3 },
      { x: -8, z: -15, w: 4, d: 2, h: 0.6 },
    ];
  if (chapter === 5)
    return [
      { x: 0, z: 2, w: 0.8, d: 0.8, h: 8 },
      { x: -2.5, z: 5, w: 1.5, d: 2, h: 0.65 },
      { x: 2.5, z: -3, w: 1.3, d: 1.8, h: 0.6 },
    ];
  if (chapter === 6)
    return [
      { x: -9, z: 4, w: 0.5, d: 22, h: 4 },
      { x: 9, z: 4, w: 0.5, d: 22, h: 4 },
      { x: 0, z: 15, w: 18, d: 0.5, h: 4 },
      { x: -5, z: -8, w: 7, d: 0.5, h: 4 },
      { x: 5, z: -8, w: 7, d: 0.5, h: 4 },
      { x: 4, z: -1.1, w: 3, d: 1, h: 0.85 },
    ];
  if (chapter === 7)
    return [
      { x: -12, z: 11, w: 6, d: 12, h: 6 },
      { x: 11, z: 4, w: 7, d: 16, h: 7 },
      { x: -12, z: -20, w: 6, d: 12, h: 6 },
      { x: -3, z: -10, w: 2, d: 2, h: 0.55 },
      { x: 4, z: -18, w: 2, d: 2, h: 0.55 },
    ];
  if (chapter >= 9)
    return [
      { x: -13, z: -5, w: 6, d: 8, h: 6 },
      { x: 13, z: -20, w: 6, d: 8, h: 6 },
      ...(scene === 'kitchen'
        ? [
            { x: -8, z: 8, w: 0.4, d: 16, h: 3.5 },
            { x: 8, z: 8, w: 0.4, d: 16, h: 3.5 },
            { x: 0, z: 16, w: 16, d: 0.4, h: 3.5 },
            { x: -5.3, z: 0, w: 5.4, d: 0.4, h: 3.5 },
            { x: 5.3, z: 0, w: 5.4, d: 0.4, h: 3.5 },
          ]
        : []),
    ];
  return [
    { x: 9, z: 8, w: 8, d: 8, h: 5 },
    { x: -12, z: -14, w: 4, d: 4, h: 1.2 },
    { x: 7, z: -16, w: 6, d: 4, h: 3.4 },
  ];
};
export const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
export interface Input {
  forward: number;
  strafe: number;
  turn: number;
  sprint: boolean;
}
export class AdventureEngine {
  readonly mission: Mission;
  position: Point;
  yaw = 0;
  pitch = 0;
  y = 0;
  velocityY = 0;
  stage = 0;
  elapsed = 0;
  steps = 0;
  moving = false;
  paused = true;
  sheep: { at: Point; home: boolean }[] = [
    { at: [-2, -13], home: false },
    { at: [1, -14], home: false },
    { at: [4, -13], home: false },
  ];
  whistle = 0;
  collected: number[] = [];
  constructor(chapter: Chapter, stage = 0, mission?: Mission) {
    this.mission = mission ?? missions.find((m) => m.id === chapter)!;
    if (!this.mission) throw new Error(`Unknown chapter ${chapter}`);
    this.stage = Math.min(this.mission.stages.length, Math.max(0, stage));
    this.position = [
      ...(stage > 0
        ? this.mission.stages[Math.min(stage - 1, this.mission.stages.length - 1)].at
        : this.mission.spawn),
    ];
    this.yaw = this.mission.yaw;
    if (stage > 0 && stage < this.mission.stages.length) this.face(this.mission.stages[stage].at);
  }
  face(target: Point) {
    this.yaw = Math.atan2(target[0] - this.position[0], -(target[1] - this.position[1]));
  }
  look(dx: number, dy: number) {
    this.yaw += dx;
    this.pitch = Math.max(-0.75, Math.min(0.8, this.pitch + dy));
  }
  canWalk(x: number, z: number) {
    if (x < -17 || x > 17 || z < -29 || z > 19) return false;
    if (this.mission.id === 5) {
      const ship = Math.abs(x) < 3.65 && z > -10 && z < 18;
      const dock = this.stage >= 2 && z <= -9 && z >= -28 && x > -4 && x < 17;
      if (!ship && !dock) return false;
    }
    return !obstacles(this.mission.id, this.target?.scene).some(
      (o) =>
        Math.abs(x - o.x) < o.w / 2 + 0.28 && Math.abs(z - o.z) < o.d / 2 + 0.28 && this.y < o.h,
    );
  }
  jump() {
    if (!this.paused && this.y <= 0.01) this.velocityY = 5;
  }
  update(dt: number, input: Input) {
    if (this.paused || this.stage >= this.mission.stages.length) {
      this.moving = false;
      return;
    }
    dt = Math.min(0.04, Math.max(0, dt));
    this.elapsed += dt;
    this.yaw += input.turn * dt * 1.7;
    const length = Math.max(1, Math.hypot(input.forward, input.strafe));
    const speed = (input.sprint ? 6.6 : 4) * dt;
    const dx =
      ((Math.sin(this.yaw) * input.forward + Math.cos(this.yaw) * input.strafe) / length) * speed;
    const dz =
      ((-Math.cos(this.yaw) * input.forward + Math.sin(this.yaw) * input.strafe) / length) * speed;
    const old: Point = [...this.position];
    if (this.canWalk(this.position[0] + dx, this.position[1])) this.position[0] += dx;
    if (this.canWalk(this.position[0], this.position[1] + dz)) this.position[1] += dz;
    this.moving = distance(old, this.position) > 0.001;
    if (this.moving) this.steps += dt * (input.sprint ? 13 : 9);
    this.velocityY -= 14 * dt;
    this.y = Math.max(0, this.y + this.velocityY * dt);
    if (this.y === 0) this.velocityY = Math.max(0, this.velocityY);
    this.whistle = Math.max(0, this.whistle - dt);
    this.target?.collect?.points.forEach((point, i) => {
      if (!this.collected.includes(i) && distance(point, this.position) < 1.5)
        this.collected.push(i);
    });
    if (this.mission.id === 5 && this.stage === 2) {
      for (const sheep of this.sheep) {
        if (sheep.home) continue;
        if (distance(sheep.at, [12, -15]) < 2.7) {
          sheep.home = true;
          continue;
        }
        const gap = distance(sheep.at, this.position);
        if (gap > 1.2 && gap < (this.whistle > 0 ? 14 : 6.5)) {
          const speed = Math.min(gap - 1.1, dt * 3.5);
          sheep.at[0] += ((this.position[0] - sheep.at[0]) / gap) * speed;
          sheep.at[1] += ((this.position[1] - sheep.at[1]) / gap) * speed;
        }
      }
    }
  }
  get target() {
    return this.mission.stages[this.stage];
  }
  get destination(): Point | undefined {
    const remaining = this.target?.collect?.points.filter((_, i) => !this.collected.includes(i));
    return remaining?.length
      ? [...remaining].sort((a, b) => distance(a, this.position) - distance(b, this.position))[0]
      : this.target?.at;
  }
  get range() {
    return this.destination ? distance(this.position, this.destination) : 0;
  }
  get bearing() {
    return this.destination
      ? normalizeAngle(
          Math.atan2(
            this.destination![0] - this.position[0],
            -(this.destination![1] - this.position[1]),
          ) - this.yaw,
        )
      : 0;
  }
  get herded() {
    return this.sheep.filter((s) => s.home).length;
  }
  get ready() {
    return (
      this.stage < this.mission.stages.length &&
      distance(this.position, this.target.at) < 3.1 &&
      (!this.target?.collect || this.collected.length === this.target.collect.points.length) &&
      (!this.target?.herd || this.herded === 3)
    );
  }
  interact() {
    if (this.paused) return false;
    if (this.target?.herd && this.herded < 3) {
      this.whistle = 4;
      return false;
    }
    return this.ready;
  }
  completeStage() {
    this.stage = Math.min(this.mission.stages.length, this.stage + 1);
    this.collected = [];
  }
  snapshot() {
    return {
      chapter: this.mission.id,
      stage: this.stage,
      position: [...this.position],
      yaw: this.yaw,
      ready: this.ready,
      herded: this.herded,
      elapsed: this.elapsed,
      collected: [...this.collected],
    };
  }
}
