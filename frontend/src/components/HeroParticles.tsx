'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  opacitySpeed: number;
  color: string;
}

const COLORS = [
  'rgba(251, 146, 60,',  // orange-400
  'rgba(253, 186, 116,', // orange-300
  'rgba(255, 255, 255,', // white
  'rgba(252, 211, 77,',  // amber
];

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number = 0;
    let particles: Particle[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function spawn(): Particle {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        x: Math.random() * (canvas?.width ?? window.innerWidth),
        y: Math.random() * (canvas?.height ?? window.innerHeight),
        size: Math.random() * 2.2 + 0.6,
        speedX: (Math.random() - 0.5) * 0.35,
        speedY: Math.random() * -0.5 - 0.15, // mostly drift upward slowly
        opacity: 0,
        opacitySpeed: Math.random() * 0.004 + 0.002,
        color,
      };
    }

    function init() {
      particles = Array.from({ length: 55 }, spawn);
      // give them random initial opacities so they don't all fade in together
      particles.forEach((p) => { p.opacity = Math.random() * 0.7; });
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        // fade in / out cycle
        p.opacity += p.opacitySpeed;
        if (p.opacity >= 0.8) p.opacitySpeed = -Math.abs(p.opacitySpeed);
        if (p.opacity <= 0) {
          // respawn at new random position
          Object.assign(p, spawn());
          p.opacity = 0;
        }

        p.x += p.speedX;
        p.y += p.speedY;

        // wrap around edges
        if (p.x < -10) p.x = (canvas.width ?? 0) + 10;
        if (p.x > (canvas.width ?? 0) + 10) p.x = -10;
        if (p.y < -10) p.y = (canvas.height ?? 0) + 10;

        // draw glowing dot
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
        grd.addColorStop(0, `${p.color}${p.opacity})`);
        grd.addColorStop(1, `${p.color}0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // solid centre dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${Math.min(p.opacity + 0.2, 1)})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // respect prefers-reduced-motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      cancelAnimationFrame(animId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
    />
  );
}