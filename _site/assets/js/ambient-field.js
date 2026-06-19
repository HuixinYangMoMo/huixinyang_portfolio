(() => {
  const root = document.documentElement;
  const ambientCanvas = document.querySelector("[data-ambient-field]");
  const flowCanvas = document.querySelector("[data-drink-flow]");
  const hero = document.querySelector(".story-hero");
  const stage = document.querySelector("[data-drink-stage]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;

  const pointer = {
    x: 0.5,
    y: 0.42,
    targetX: 0.5,
    targetY: 0.42,
    strength: 0.14,
    targetStrength: 0.14,
    lastX: window.innerWidth * 0.5,
    lastY: window.innerHeight * 0.42,
  };

  const setCssMotion = (clientX, clientY, velocity = 0) => {
    const winX = clientX / Math.max(window.innerWidth, 1);
    const winY = clientY / Math.max(window.innerHeight, 1);
    const offsetX = winX - 0.5;
    const offsetY = winY - 0.5;
    const stageRect = stage?.getBoundingClientRect();
    const flowRect = flowCanvas?.getBoundingClientRect();
    const stageX = stageRect ? (clientX - stageRect.left) / Math.max(stageRect.width, 1) : winX;
    const stageY = stageRect ? (clientY - stageRect.top) / Math.max(stageRect.height, 1) : winY;
    const strawX = clamp((stageX - 0.47) * 118, -40, 44);
    const strawY = clamp((stageY - 0.28) * 34, -13, 22);
    const rotate = clamp((stageX - 0.5) * 36 + velocity * 0.16, -22, 22);

    root.style.setProperty("--hero-shift-x", `${offsetX * 32}px`);
    root.style.setProperty("--hero-shift-y", `${offsetY * 24}px`);
    root.style.setProperty("--hero-tilt", `${offsetX * 3}deg`);
    root.style.setProperty("--hero-depth", `${offsetY * 18}px`);
    root.style.setProperty("--drink-shift-x", `${offsetX * 24}px`);
    root.style.setProperty("--drink-shift-y", `${offsetY * 16}px`);
    root.style.setProperty("--drink-tilt", `${offsetX * 2.5}deg`);
    root.style.setProperty("--straw-x", `${strawX}px`);
    root.style.setProperty("--straw-y", `${strawY}px`);
    root.style.setProperty("--straw-rotate", `${rotate}deg`);
    root.style.setProperty("--liquid-tilt", `${clamp((stageX - 0.5) * 7, -4.2, 4.2)}deg`);
    root.style.setProperty("--liquid-x", `${clamp((stageX - 0.5) * 18, -8, 8)}%`);
    root.style.setProperty("--liquid-y", `${clamp((stageY - 0.42) * 14, -6, 8)}%`);

    if (flowRect) {
      pointer.targetX = clamp((clientX - flowRect.left) / Math.max(flowRect.width, 1), 0.13, 0.87);
      pointer.targetY = clamp((clientY - flowRect.top) / Math.max(flowRect.height, 1), 0.12, 0.74);
    }
  };

  const handlePointerMove = (event) => {
    const velocity = Math.hypot(event.clientX - pointer.lastX, event.clientY - pointer.lastY);
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.targetStrength = clamp(0.18 + velocity / 42, 0.22, 1);
    setCssMotion(event.clientX, event.clientY, velocity);
  };

  const softenPointer = () => {
    pointer.targetStrength = 0.16;
    setCssMotion(window.innerWidth * 0.56, window.innerHeight * 0.42, 0);
  };

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  hero?.addEventListener("pointerleave", softenPointer, { passive: true });

  const setupAmbient = () => {
    if (!ambientCanvas) return null;

    const ctx = ambientCanvas.getContext("2d", { alpha: true });
    const specks = [];
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      ambientCanvas.width = Math.floor(width * dpr);
      ambientCanvas.height = Math.floor(height * dpr);
      ambientCanvas.style.width = `${width}px`;
      ambientCanvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      specks.length = 0;
      for (let i = 0; i < 180; i += 1) {
        specks.push({
          x: Math.random(),
          y: Math.random(),
          size: 0.45 + Math.random() * 1.5,
          alpha: 0.035 + Math.random() * 0.12,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "screen";

      const glow = ctx.createRadialGradient(
        width * (0.68 + (pointer.x - 0.5) * 0.05),
        height * (0.47 + (pointer.y - 0.42) * 0.05),
        0,
        width * 0.68,
        height * 0.48,
        Math.min(width, height) * 0.48
      );
      glow.addColorStop(0, `rgba(255, 216, 77, ${0.03 + pointer.strength * 0.035})`);
      glow.addColorStop(0.45, "rgba(169, 217, 255, 0.025)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      specks.forEach((speck) => {
        const wave = Math.sin(time * 0.0004 + speck.phase) * 0.18;
        const x = (speck.x + (pointer.x - 0.5) * 0.015) * width;
        const y = (speck.y + (pointer.y - 0.5) * 0.012) * height;
        ctx.fillStyle = `rgba(248, 241, 223, ${speck.alpha + wave * 0.018})`;
        ctx.fillRect(x, y, speck.size, speck.size);
      });

      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    seed();
    return { draw, resize };
  };

  const setupDrinkFlow = () => {
    if (!flowCanvas) return null;

    const ctx = flowCanvas.getContext("2d", { alpha: true });
    const particles = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let spin = 0;

    const palette = [
      { fill: "rgba(22, 23, 27, 0.92)", rim: "rgba(248, 241, 223, 0.36)", glow: "rgba(169, 217, 255, 0.2)" },
      { fill: "rgba(255, 88, 72, 0.94)", rim: "rgba(255, 230, 194, 0.68)", glow: "rgba(255, 88, 72, 0.34)" },
      { fill: "rgba(255, 216, 77, 0.94)", rim: "rgba(248, 241, 223, 0.7)", glow: "rgba(255, 216, 77, 0.32)" },
      { fill: "rgba(169, 217, 255, 0.9)", rim: "rgba(248, 241, 223, 0.62)", glow: "rgba(169, 217, 255, 0.34)" },
      { fill: "rgba(240, 155, 255, 0.86)", rim: "rgba(248, 241, 223, 0.52)", glow: "rgba(240, 155, 255, 0.32)" },
    ];

    const cupBounds = (y) => {
      const left = 0.11 + y * 0.17;
      const right = 0.9 - y * 0.15;
      return { left, right };
    };

    const resize = () => {
      const rect = flowCanvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      flowCanvas.width = Math.floor(width * dpr);
      flowCanvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      particles.length = 0;
      for (let i = 0; i < 48; i += 1) {
        const y = 0.2 + Math.random() * 0.72;
        const bounds = cupBounds(y);
        particles.push({
          x: bounds.left + Math.random() * (bounds.right - bounds.left),
          y,
          vx: (Math.random() - 0.5) * 0.001,
          vy: (Math.random() - 0.5) * 0.001,
          size: 0.024 + Math.random() * 0.036,
          color: i % palette.length,
          type: i % 4,
          phase: Math.random() * Math.PI * 2,
          depth: 0.65 + Math.random() * 0.75,
        });
      }
    };

    const roundedRect = (x, y, w, h, radius) => {
      const r = Math.min(radius, w * 0.5, h * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    };

    const drawIngredient = (particle, time) => {
      const c = palette[particle.color];
      const x = particle.x * width;
      const y = particle.y * height;
      const size = particle.size * Math.min(width, height);
      const wobble = Math.sin(time * 0.002 + particle.phase) * 0.12;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin * 0.45 + particle.phase + wobble);
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 8 + pointer.strength * 9;
      ctx.fillStyle = c.fill;
      ctx.strokeStyle = c.rim;
      ctx.lineWidth = 1;

      if (particle.type === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(248, 241, 223, 0.36)";
        ctx.beginPath();
        ctx.arc(-size * 0.26, -size * 0.28, size * 0.24, 0, Math.PI * 2);
        ctx.fill();
      } else if (particle.type === 1) {
        roundedRect(-size * 1.25, -size * 0.58, size * 2.5, size * 1.16, size * 0.55);
        ctx.fill();
        ctx.stroke();
      } else if (particle.type === 2) {
        roundedRect(-size * 0.82, -size * 0.82, size * 1.64, size * 1.64, size * 0.28);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 5; i += 1) {
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          const px = Math.cos(angle) * size;
          const py = Math.sin(angle) * size;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawVortex = (time) => {
      const cx = pointer.x * width;
      const cy = pointer.y * height;
      const rings = 4;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.translate(cx, cy);
      ctx.rotate(spin * 1.6);
      for (let i = 0; i < rings; i += 1) {
        const radiusX = (0.11 + i * 0.065 + pointer.strength * 0.04) * width;
        const radiusY = radiusX * (0.27 + i * 0.02);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(248, 241, 223, ${0.16 - i * 0.022 + pointer.strength * 0.065})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([10 + i * 4, 16 + i * 3]);
        ctx.lineDashOffset = -time * (0.02 + i * 0.006);
        ctx.ellipse(0, 0, radiusX, radiusY, i * 0.42, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.setLineDash([]);
    };

    const step = (time) => {
      pointer.x = lerp(pointer.x, pointer.targetX, 0.08);
      pointer.y = lerp(pointer.y, pointer.targetY, 0.08);
      pointer.strength = lerp(pointer.strength, pointer.targetStrength, 0.06);
      spin += 0.006 + pointer.strength * 0.03;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      const cx = pointer.x;
      const cy = pointer.y;
      const aspect = width / Math.max(height, 1);
      particles.forEach((particle) => {
        const dx = particle.x - cx;
        const dy = (particle.y - cy) / aspect;
        const dist = Math.max(0.055, Math.hypot(dx, dy));
        const swirl = (0.00018 + pointer.strength * 0.0038) * particle.depth;
        const pull = pointer.strength * 0.0005 * particle.depth;

        particle.vx += (-dy / dist) * swirl + (cx - particle.x) * pull;
        particle.vy += (dx / dist) * swirl * aspect + (cy - particle.y) * pull * 0.66;
        particle.vy += Math.sin(time * 0.0012 + particle.phase) * 0.00006;
        particle.vx *= 0.934;
        particle.vy *= 0.934;
        particle.x += particle.vx;
        particle.y += particle.vy;

        const bounds = cupBounds(particle.y);
        if (particle.x < bounds.left) {
          particle.x = bounds.left;
          particle.vx *= -0.45;
        }
        if (particle.x > bounds.right) {
          particle.x = bounds.right;
          particle.vx *= -0.45;
        }
        if (particle.y < 0.15) {
          particle.y = 0.15;
          particle.vy *= -0.42;
        }
        if (particle.y > 0.92) {
          particle.y = 0.92;
          particle.vy *= -0.42;
        }

        drawIngredient(particle, time);
      });

      drawVortex(time);
      ctx.globalCompositeOperation = "source-over";

      root.style.setProperty("--stir-glow", pointer.strength.toFixed(3));
      root.style.setProperty("--surface-wave", `${Math.sin(time * 0.003 + spin) * (1.5 + pointer.strength * 4.8)}px`);
      root.style.setProperty("--orbit-spin", `${spin * 18}deg`);
    };

    resize();
    seed();
    return { draw: step, resize };
  };

  const ambient = setupAmbient();
  const drinkFlow = setupDrinkFlow();

  const resizeAll = () => {
    ambient?.resize();
    drinkFlow?.resize();
  };

  let animationFrame = 0;
  const drawAll = (time) => {
    ambient?.draw(time);
    drinkFlow?.draw(time);
    if (!prefersReducedMotion.matches) {
      animationFrame = requestAnimationFrame(drawAll);
    }
  };

  window.addEventListener("resize", resizeAll);
  setCssMotion(window.innerWidth * 0.56, window.innerHeight * 0.42, 0);

  if (prefersReducedMotion.matches) {
    drawAll(1200);
  } else {
    animationFrame = requestAnimationFrame(drawAll);
  }

  const handleMotionPreference = () => {
    cancelAnimationFrame(animationFrame);
    if (prefersReducedMotion.matches) {
      drawAll(1200);
    } else {
      animationFrame = requestAnimationFrame(drawAll);
    }
  };

  if (typeof prefersReducedMotion.addEventListener === "function") {
    prefersReducedMotion.addEventListener("change", handleMotionPreference);
  } else if (typeof prefersReducedMotion.addListener === "function") {
    prefersReducedMotion.addListener(handleMotionPreference);
  }
})();
