import { useEffect, useRef } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function CursorFollower() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion) return;

    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const isSmallScreen = window.matchMedia?.("(max-width: 768px)")?.matches;
    if (isCoarsePointer || isSmallScreen) return;

    const el = elRef.current;
    if (!el) return;

    const target = { x: 0, y: 0, has: false };
    const pos = { x: 0, y: 0 };
    let lastTs = performance.now();
    let pressed = false;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!target.has) {
        target.has = true;
        pos.x = target.x;
        pos.y = target.y;
        el.style.opacity = "1";
      }
    };

    const onLeave = () => {
      el.style.opacity = "0";
      target.has = false;
    };

    const onDown = () => {
      pressed = true;
    };

    const onUp = () => {
      pressed = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("blur", onLeave, { passive: true } as AddEventListenerOptions);
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    const tick = (ts: number) => {
      const dt = clamp((ts - lastTs) / 16.6667, 0.5, 1.8);
      lastTs = ts;

      if (target.has) {
        // Smooth lag; tuned to feel premium while scrolling.
        const follow = 0.06;
        pos.x += (target.x - pos.x) * follow * dt;
        pos.y += (target.y - pos.y) * follow * dt;

        const size = 12;
        const scale = pressed ? 0.9 : 1;
        el.style.transform = `translate3d(${pos.x - size / 2}px, ${pos.y - size / 2}px, 0) scale(${scale})`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave as any);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div
      ref={elRef}
      aria-hidden="true"
      className="cursor-neon"
    />
  );
}
