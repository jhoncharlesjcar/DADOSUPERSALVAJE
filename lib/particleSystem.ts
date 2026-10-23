/**
 * DADO SALVAJE — Particle System
 * DOM-based particle effects (CSS animated divs, OBS-compatible)
 */

type ShapeFn = (size: number, color: string) => Partial<CSSStyleDeclaration>;

// ===== PARTICLE SHAPES =====
const SHAPES: Record<string, ShapeFn> = {
  circle: (size, color) => ({
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: color,
  }),
  square: (size, color) => ({
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "2px",
    background: color,
  }),
  star: (size, color) => ({
    width: `${size}px`,
    height: `${size}px`,
    background: color,
    clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  }),
  coin: (size) => ({
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #FFD700 0%, #E8C84A 50%, #B8860B 100%)",
    border: `2px dashed rgba(184, 134, 11, 0.6)`,
    boxShadow: "0 4px 8px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.6)",
  }),
  diamond: (size, color) => ({
    width: `${size}px`,
    height: `${size}px`,
    background: color,
    clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  }),
  strip: (size, color) => ({
    width: `${size * 0.3}px`,
    height: `${size * 1.5}px`,
    borderRadius: "2px",
    background: color,
  }),
};

const CONFETTI_COLORS = [
  "#FFD700", "#FF6B00", "#FF3D00", "#00E676", "#00BFFF",
  "#9B59B6", "#FF1493", "#FFFFFF", "#FFAA00", "#E8C84A",
  "#FF4081", "#7C4DFF", "#00BCD4", "#FF9100",
];

const GOLD_COLORS = [
  "#D4AF37", "#E8C84A", "#F5E6A3", "#8B7500", "#FFD700",
  "#DAA520", "#B8860B",
];

export interface ParticleConfig {
  count?: number;
  colors?: string[];
  shapes?: string[];
  origin?: { x: number; y: number };
  spread?: number;
  speed?: { min: number; max: number };
  size?: { min: number; max: number };
  lifetime?: number;
  gravity?: boolean;
  fadeOut?: boolean;
  rotation?: boolean;
}

// ===== MAIN FUNCTION: Create particles in a container =====

export function createParticles(container: HTMLElement, config: ParticleConfig) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const {
    count: requestedCount = 30,
    colors = CONFETTI_COLORS,
    shapes = ["circle", "square", "star", "diamond", "strip"],
    origin = { x: 50, y: 50 },
    spread = 360,
    speed = { min: 200, max: 600 },
    size = { min: 6, max: 14 },
    lifetime = 3000,
    gravity = true,
    fadeOut = true,
    rotation = true,
  } = config;
  const count = Math.min(requestedCount, window.innerWidth < 700 ? 24 : 72);

  const particles: Array<{
    el: HTMLDivElement;
    vx: number;
    vy: number;
    rot: number;
    rotSpeed: number;
    x: number;
    y: number;
    opacity: number;
  }> = [];
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const shapeKey = shapes[Math.floor(Math.random() * shapes.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const pSize = size.min + Math.random() * (size.max - size.min);
    const shapeFn = SHAPES[shapeKey] || SHAPES.circle;
    const shapeStyles = shapeFn(pSize, color);

    const angleOffset = (Math.random() - 0.5) * spread;
    const angle = (-90 + angleOffset) * (Math.PI / 180);
    const velocity = speed.min + Math.random() * (speed.max - speed.min);
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    const rotSpeed = (Math.random() - 0.5) * 720;

    Object.assign(el.style, {
      ...shapeStyles,
      position: "absolute",
      left: `${origin.x}%`,
      top: `${origin.y}%`,
      pointerEvents: "none",
      zIndex: "9999",
      willChange: "transform, opacity",
    });

    fragment.appendChild(el);
    particles.push({ el, vx, vy, rot: 0, rotSpeed, x: 0, y: 0, opacity: 1 });
  }

  container.appendChild(fragment);

  const startTime = performance.now();
  const gravityAccel = gravity ? 800 : 0;

  function animate(now: number) {
    const elapsed = (now - startTime) / 1000;
    const progress = (now - startTime) / lifetime;

    if (progress >= 1) {
      particles.forEach(p => p.el.remove());
      return;
    }

    particles.forEach(p => {
      p.x = p.vx * elapsed;
      p.y = p.vy * elapsed + 0.5 * gravityAccel * elapsed * elapsed;
      p.rot = rotation ? p.rotSpeed * elapsed : 0;
      p.opacity = fadeOut ? Math.max(0, 1 - progress * progress) : 1;

      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
      p.el.style.opacity = String(p.opacity);
    });

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

// ===== PRESETS =====

export function victoryExplosion(container: HTMLElement, originX = 50, originY = 50) {
  createParticles(container, {
    count: 80,
    colors: CONFETTI_COLORS,
    shapes: ["star", "diamond", "strip", "circle"],
    origin: { x: originX, y: originY },
    spread: 360,
    speed: { min: 300, max: 800 },
    size: { min: 6, max: 18 },
    lifetime: 3500,
    gravity: true,
    rotation: true,
  });

  setTimeout(() => {
    createParticles(container, {
      count: 40,
      colors: GOLD_COLORS,
      shapes: ["star", "circle"],
      origin: { x: originX, y: originY },
      spread: 360,
      speed: { min: 150, max: 400 },
      size: { min: 4, max: 10 },
      lifetime: 2500,
      gravity: false,
      rotation: true,
    });
  }, 200);
}

export function coinShower(container: HTMLElement) {
  createParticles(container, {
    count: 60,
    colors: GOLD_COLORS,
    shapes: ["coin"],
    origin: { x: 50, y: -10 },
    spread: 120,
    speed: { min: 200, max: 700 },
    size: { min: 25, max: 40 },
    lifetime: 4000,
    gravity: true,
    rotation: true,
    fadeOut: false,
  });

  setTimeout(() => {
    createParticles(container, {
      count: 40,
      colors: GOLD_COLORS,
      shapes: ["coin"],
      origin: { x: 50, y: 110 },
      spread: 180,
      speed: { min: 500, max: 1000 },
      size: { min: 20, max: 35 },
      lifetime: 3000,
      gravity: true,
      rotation: true,
      fadeOut: false,
    });
  }, 500);
}

export function diceImpactBurst(container: HTMLElement, originX: number, originY: number, diceColor?: string) {
  const colors = diceColor
    ? [diceColor, "#FFFFFF", diceColor, "#FFD700"]
    : GOLD_COLORS;

  createParticles(container, {
    count: 15,
    colors,
    shapes: ["circle", "square"],
    origin: { x: originX, y: originY },
    spread: 360,
    speed: { min: 80, max: 250 },
    size: { min: 3, max: 8 },
    lifetime: 800,
    gravity: true,
    rotation: true,
    fadeOut: true,
  });
}

let ambientInterval: any = null;

class DOMParticlePool {
  private pool: HTMLDivElement[] = [];
  private active: Set<HTMLDivElement> = new Set();
  private maxPoolSize: number;

  constructor(maxPoolSize = 40) {
    this.maxPoolSize = maxPoolSize;
  }

  acquire(): HTMLDivElement {
    let el = this.pool.pop();
    if (!el) {
      el = document.createElement("div");
    }
    this.active.add(el);
    return el;
  }

  release(el: HTMLDivElement): void {
    if (!this.active.has(el)) return;
    this.active.delete(el);
    el.style.animation = "none";
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(el);
    }
  }

  releaseAll(): void {
    this.active.forEach(el => {
      el.style.animation = "none";
      if (el.parentNode) el.parentNode.removeChild(el);
      if (this.pool.length < this.maxPoolSize) this.pool.push(el);
    });
    this.active.clear();
  }
}

const ambientPool = new DOMParticlePool(35);

export function startAmbientParticles(container: HTMLElement) {
  stopAmbientParticles();
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  ambientInterval = setInterval(() => {
    if (!container || !container.isConnected) return;
    const el = ambientPool.acquire();
    const size = 2 + Math.random() * 4;
    const startX = Math.random() * 100;
    const color = GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)];
    const duration = 4 + Math.random() * 6;

    Object.assign(el.style, {
      position: "absolute",
      left: `${startX}%`,
      bottom: "-10px",
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      background: color,
      opacity: "0",
      pointerEvents: "none",
      zIndex: "1",
      animation: `ambientFloat ${duration}s ease-in-out forwards`,
    });

    container.appendChild(el);
    setTimeout(() => {
      ambientPool.release(el);
    }, duration * 1000);
  }, 350);
}

export function stopAmbientParticles() {
  if (ambientInterval) {
    clearInterval(ambientInterval);
    ambientInterval = null;
  }
  ambientPool.releaseAll();
}

export function streakFire(container: HTMLElement, originX = 50, originY = 80) {
  const FIRE_COLORS = ["#FF6B00", "#FF3D00", "#FFD700", "#FF9100", "#FF4444"];

  createParticles(container, {
    count: 25,
    colors: FIRE_COLORS,
    shapes: ["circle"],
    origin: { x: originX, y: originY },
    spread: 60,
    speed: { min: 100, max: 300 },
    size: { min: 4, max: 12 },
    lifetime: 1200,
    gravity: false,
    rotation: false,
    fadeOut: true,
  });
}

export function screenFlash(container: HTMLElement, color = "rgba(212, 175, 55, 0.3)", duration = 400) {
  const flash = document.createElement("div");
  Object.assign(flash.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    background: color,
    pointerEvents: "none",
    zIndex: "10000",
    opacity: "1",
    transition: `opacity ${duration}ms ease-out`,
  });
  container.appendChild(flash);
  requestAnimationFrame(() => {
    flash.style.opacity = "0";
  });
  setTimeout(() => flash.remove(), duration + 50);
}

export function energyRing(container: HTMLElement, originX = 50, originY = 50, color = "#D4AF37") {
  const ring = document.createElement("div");
  const size = 20;
  Object.assign(ring.style, {
    position: "absolute",
    left: `${originX}%`,
    top: `${originY}%`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    border: `3px solid ${color}`,
    transform: "translate(-50%, -50%) scale(0)",
    opacity: "1",
    pointerEvents: "none",
    zIndex: "9998",
    boxShadow: `0 0 20px ${color}, inset 0 0 20px ${color}`,
    animation: "energyRingExpand 1s ease-out forwards",
  });
  container.appendChild(ring);
  setTimeout(() => ring.remove(), 1100);
}
