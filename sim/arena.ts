export type Vec2 = { x: number; y: number };

export type WeaponKind = 'blaster' | 'sniper' | 'shotgun' | 'rocket' | 'flamethrower' | 'laser';

export interface Fighter {
  name: string;
  color: string;
  position: Vec2;
  velocity: Vec2;
  heading: number;
  hp: number;
  maxHp: number;
  speed: number;
  range: number;
  fireCooldown: number;
  fireTimer: number;
  damage: number;
  projectileSpeed: number;
  spread: number;
  kind: WeaponKind;
  alive: boolean;
}

export interface BattleConfig {
  width: number;
  height: number;
  fighters: Fighter[];
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function len(v: Vec2) { return Math.hypot(v.x, v.y); }
function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
function mul(a: Vec2, s: number): Vec2 { return { x: a.x * s, y: a.y * s }; }
function norm(a: Vec2): Vec2 { const L = len(a); return L === 0 ? { x: 1, y: 0 } : { x: a.x / L, y: a.y / L }; }

export type Projectile = { pos: Vec2; vel: Vec2; color: string; damage: number; ttl: number; radius: number };

export class Arena {
  width: number;
  height: number;
  fighters: Fighter[];
  projectiles: Projectile[] = [];
  time: number = 0;

  constructor(public config: BattleConfig) {
    this.width = config.width;
    this.height = config.height;
    this.fighters = config.fighters;
  }

  getAlive(): Fighter[] { return this.fighters.filter(f => f.alive); }

  getWinner(): Fighter | null {
    const alive = this.getAlive();
    if (alive.length === 1) return alive[0];
    if (alive.length === 0 && this.fighters.length > 0) {
      // pick the one with highest hp before death (edge cases)
      return this.fighters.reduce((a,b)=> (a.hp>b.hp?a:b));
    }
    return null;
  }

  getOddsFor(name: string): number {
    const alive = this.getAlive();
    const f = this.fighters.find(x=>x.name===name);
    if (!f) return 1;
    const totalPower = alive.reduce((s, x) => s + x.maxHp * x.damage * x.range * x.speed, 0) || 1;
    const power = f.maxHp * f.damage * f.range * f.speed;
    const base = totalPower / power;
    return clamp(base, 1.2, 6.0);
  }

  update(dt: number) {
    this.time += dt;
    const alive = this.getAlive();

    // movement: orbit center, avoid edges, chase nearest
    for (const f of alive) {
      const others = alive.filter(o => o !== f);
      let target = others[0];
      let targetDist = Infinity;
      for (const o of others) {
        const d = len(sub(o.position, f.position));
        if (d < targetDist) { target = o; targetDist = d; }
      }
      if (!target) continue;

      const dirToTarget = norm(sub(target.position, f.position));
      const center = { x: this.width/2, y: this.height/2 };
      const dirToCenter = norm(sub(center, f.position));
      const edgeAvoid = {
        x: clamp((f.position.x - this.width/2) / (this.width/2), -1, 1),
        y: clamp((f.position.y - this.height/2) / (this.height/2), -1, 1),
      };
      const desire = norm(add(add(dirToTarget, dirToCenter), mul(edgeAvoid, -0.6)));
      f.velocity = mul(desire, f.speed);
      f.position = add(f.position, mul(f.velocity, dt * 60));
      f.position.x = clamp(f.position.x, 16, this.width-16);
      f.position.y = clamp(f.position.y, 16, this.height-16);
      f.heading = Math.atan2(dirToTarget.y, dirToTarget.x);

      // firing
      f.fireTimer -= dt;
      const inRange = targetDist <= f.range;
      if (f.fireTimer <= 0 && inRange) {
        this.shoot(f, target);
      }
    }

    // projectiles update
    const remaining: Projectile[] = [];
    for (const p of this.projectiles) {
      p.ttl -= dt;
      p.pos = add(p.pos, mul(p.vel, dt * 60));
      if (p.ttl <= 0) continue;

      let hit = false;
      for (const f of alive) {
        const d = len(sub(f.position, p.pos));
        const r = 8 + p.radius;
        if (d < r) {
          f.hp -= p.damage;
          if (f.hp <= 0) { f.alive = false; }
          hit = true;
          break;
        }
      }
      if (!hit) remaining.push(p);
    }
    this.projectiles = remaining;
  }

  shoot(f: Fighter, target: Fighter) {
    const dir = norm(sub(target.position, f.position));
    const color = f.color;
    const base: Projectile = { pos: { ...f.position }, vel: mul(dir, f.projectileSpeed), color, damage: f.damage, ttl: 2.5, radius: 2 };

    switch (f.kind) {
      case 'blaster': {
        this.projectiles.push(base);
        f.fireTimer = f.fireCooldown;
        break;
      }
      case 'sniper': {
        const p = { ...base, damage: f.damage*2.2, ttl: 3.5, radius: 2.5 };
        this.projectiles.push(p);
        f.fireTimer = f.fireCooldown*1.8;
        break;
      }
      case 'shotgun': {
        for (let i=0;i<6;i++) {
          const spread = (Math.random()-0.5) * f.spread;
          const rot = Math.atan2(dir.y, dir.x) + spread;
          const v = { x: Math.cos(rot), y: Math.sin(rot) };
          const p = { ...base, vel: mul(v, f.projectileSpeed*0.9), damage: f.damage*0.5, ttl: 0.8, radius: 2.8 };
          this.projectiles.push(p);
        }
        f.fireTimer = f.fireCooldown*1.2;
        break;
      }
      case 'rocket': {
        const p = { ...base, ttl: 2.2, radius: 4 };
        this.projectiles.push(p);
        // simple splash on impact handled by larger radius via multiple hits
        f.fireTimer = f.fireCooldown*1.6;
        break;
      }
      case 'flamethrower': {
        for (let i=0;i<10;i++) {
          const spread = (Math.random()-0.5) * f.spread*2;
          const rot = Math.atan2(dir.y, dir.x) + spread;
          const v = { x: Math.cos(rot), y: Math.sin(rot) };
          const p = { ...base, vel: mul(v, f.projectileSpeed*0.6), damage: f.damage*0.25, ttl: 0.5, radius: 2.2 };
          this.projectiles.push(p);
        }
        f.fireTimer = f.fireCooldown*0.6;
        break;
      }
      case 'laser': {
        const p = { ...base, damage: f.damage*0.7, ttl: 0.4, radius: 1.6, vel: mul(dir, f.projectileSpeed*1.5) };
        this.projectiles.push(p);
        f.fireTimer = f.fireCooldown*0.4;
        break;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0,0,this.width,this.height);

    // arena background grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0,0,this.width, this.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x=0;x<this.width;x+=32) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.height); ctx.stroke();
    }
    for (let y=0;y<this.height;y+=32) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.width,y); ctx.stroke();
    }

    // projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI*2);
      ctx.fill();
    }

    // fighters
    for (const f of this.fighters) {
      if (!f.alive) continue;
      ctx.save();
      ctx.translate(f.position.x, f.position.y);
      ctx.rotate(f.heading);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(10,0);
      ctx.lineTo(-10,6);
      ctx.lineTo(-6,0);
      ctx.lineTo(-10,-6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // hp bar
      const w = 28; const h = 4;
      const x = f.position.x - w/2;
      const y = f.position.y - 16;
      ctx.fillStyle = '#111827'; ctx.fillRect(x,y,w,h);
      const pct = clamp(f.hp / f.maxHp, 0, 1);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(x,y,w*pct,h);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px sans-serif';
      ctx.fillText(f.name, f.position.x - ctx.measureText(f.name).width/2, f.position.y + 16);
    }
  }
}

const palette = ['#f43f5e','#f97316','#f59e0b','#22c55e','#06b6d4','#60a5fa','#a78bfa','#f472b6'];

export function createDefaultBattle(): BattleConfig {
  const width = 960; const height = 600;
  const names = ['Blaze','Viper','Nova','Rook','Echo','Zephyr','Bolt','Titan'];
  const kinds: WeaponKind[] = ['blaster','sniper','shotgun','rocket','flamethrower','laser'];
  const fighters: Fighter[] = names.slice(0,6).map((n, i) => {
    const kind = kinds[i % kinds.length];
    const baseSpeed = 2.2; const baseRange = 160; const baseDmg = 9;
    const spec = specFor(kind);
    return {
      name: n,
      color: palette[i % palette.length],
      position: { x: 120 + i*120, y: 120 + (i%2)*260 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      hp: spec.hp,
      maxHp: spec.hp,
      speed: spec.speed * baseSpeed,
      range: spec.range * baseRange,
      fireCooldown: spec.cooldown,
      fireTimer: Math.random()*spec.cooldown,
      damage: spec.damage * baseDmg,
      projectileSpeed: spec.projectileSpeed,
      spread: spec.spread,
      kind,
      alive: true,
    };
  });

  return { width, height, fighters };
}

function specFor(kind: WeaponKind) {
  switch (kind) {
    case 'blaster': return { hp: 120, speed: 1.0, range: 1.0, cooldown: 0.5, damage: 1.0, projectileSpeed: 7.0, spread: 0.03 };
    case 'sniper': return { hp: 90, speed: 0.9, range: 1.6, cooldown: 1.2, damage: 1.2, projectileSpeed: 9.0, spread: 0.01 };
    case 'shotgun': return { hp: 140, speed: 0.85, range: 0.9, cooldown: 0.9, damage: 0.9, projectileSpeed: 6.5, spread: 0.18 };
    case 'rocket': return { hp: 150, speed: 0.8, range: 1.2, cooldown: 1.4, damage: 1.4, projectileSpeed: 5.4, spread: 0.02 };
    case 'flamethrower': return { hp: 170, speed: 0.75, range: 0.7, cooldown: 0.4, damage: 0.6, projectileSpeed: 4.0, spread: 0.22 };
    case 'laser': return { hp: 100, speed: 1.2, range: 1.1, cooldown: 0.25, damage: 0.7, projectileSpeed: 10.5, spread: 0.0 };
  }
}
