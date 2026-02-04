import { useEffect, useRef } from "react";

type RGB = { r: number; g: number; b: number };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  // h: 0..360, s/l: 0..1
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp >= 1 && hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp >= 2 && hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp >= 3 && hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp >= 4 && hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = l - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function getForegroundRgb(): RGB {
  // Tailwind theme uses CSS variables like `--foreground: 220 20% 18%`.
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--foreground")
    .trim();

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    const h = Number(parts[0]);
    const s = Number(parts[1].replace("%", "")) / 100;
    const l = Number(parts[2].replace("%", "")) / 100;

    if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) {
      return hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1));
    }
  }

  // Safe neutral fallback
  return { r: 160, g: 160, b: 160 };
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion) return;

    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const isSmallScreen = window.matchMedia?.("(max-width: 768px)")?.matches;
    const reduceEffects = Boolean(isCoarsePointer || isSmallScreen);

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const seed = Date.now() ^ (Math.random() * 1e9);
    const rand = mulberry32(seed);

    let particles: Particle[] = [];

    let lastScrollY = window.scrollY || 0;

    const pointer = {
      x: 0,
      y: 0,
      active: false,
      down: false,
    };

    const updateSize = () => {
      const nextDpr = clamp(window.devicePixelRatio || 1, 1, 2);
      dpr = nextDpr;
      width = Math.max(1, Math.floor(window.innerWidth));
      height = Math.max(1, Math.floor(window.innerHeight));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = width * height;
      const baseCount = clamp(Math.round(area / 22000), 40, 90);
      const count = reduceEffects ? clamp(Math.round(baseCount * 0.55), 20, 45) : baseCount;

      // Minimal ambient motion; primary motion comes from scroll.
      const speedBase = reduceEffects ? 0.01 : 0.015;

      particles = Array.from({ length: count }, () => {
        const angle = rand() * Math.PI * 2;
        const speed = speedBase * (0.6 + rand() * 0.8);
        return {
          x: rand() * width,
          y: rand() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1.1 + rand() * 1.9,
        };
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      pointer.active = true;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };

    const onPointerLeave = () => {
      pointer.active = false;
      pointer.down = false;
    };

    const onPointerDown = () => {
      pointer.down = true;
    };

    const onPointerUp = () => {
      pointer.down = false;
    };

    window.addEventListener("resize", updateSize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    const onScroll = () => {
      // just track; work is applied in RAF for smoothness
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let baseRgb = getForegroundRgb();
    const updateColor = () => {
      baseRgb = getForegroundRgb();
    };

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", updateColor);

    const themeObserver = new MutationObserver(updateColor);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    updateSize();
    updateColor();

    let lastTs = performance.now();

    const tick = (ts: number) => {
      const dt = clamp((ts - lastTs) / 16.6667, 0.5, 1.8);
      lastTs = ts;

      ctx.clearRect(0, 0, width, height);

      const particleAlpha = reduceEffects ? 0.18 : 0.22;

      // Connection lines (kept very subtle)
      const lineAlphaMax = reduceEffects ? 0.05 : 0.10;
      const maxDist = reduceEffects ? 90 : 130;
      const maxDist2 = maxDist * maxDist;

      const interactionRadius = reduceEffects ? 0 : 130;
      const interactionRadius2 = interactionRadius * interactionRadius;

      // Subtle scroll-driven parallax (minimal movement)
      const scrollY = window.scrollY || 0;
      const scrollDelta = clamp(scrollY - lastScrollY, -90, 90);
      lastScrollY = scrollY;
      const parallax = (reduceEffects ? 0.05 : 0.08) * -scrollDelta;

      // Update particles
      for (const p of particles) {
        // Apply scroll movement smoothly (no aggressive motion)
        if (scrollDelta !== 0) {
          p.y += parallax;
        }

        // Subtle pointer interaction (disabled on coarse/small)
        if (!reduceEffects && pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;

          if (d2 > 0.0001 && d2 < interactionRadius2) {
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;

            // Hover: gentle repel. Mouse down: gentle attract ("grab").
            const strength = pointer.down ? -0.020 : 0.018;
            const falloff = (1 - d / interactionRadius) ** 2;

            p.vx += nx * strength * falloff;
            p.vy += ny * strength * falloff;
          }
        }

        // Drift
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Soft bounds wrap
        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;

        if (p.y < -10) p.y = height + 10;
        else if (p.y > height + 10) p.y = -10;

        // Gentle damping
        p.vx *= 0.995;
        p.vy *= 0.995;
      }

      // Connections
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxDist2) continue;

          const t = 1 - d2 / maxDist2;
          const alpha = clamp(t * lineAlphaMax, 0, lineAlphaMax);
          if (alpha <= 0.001) continue;

          ctx.strokeStyle = `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Particles
      for (const p of particles) {
        ctx.fillStyle = `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${particleAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("scroll", onScroll);
      media?.removeEventListener?.("change", updateColor);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
