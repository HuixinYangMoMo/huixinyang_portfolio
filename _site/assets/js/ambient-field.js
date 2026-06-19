(() => {
  const canvas = document.querySelector("[data-ambient-field]");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let dpr = 1;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let animationFrame = 0;
  const nodes = [];
  const nodeCount = 54;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const seedNodes = () => {
    nodes.length = 0;
    for (let i = 0; i < nodeCount; i += 1) {
      nodes.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.08 + Math.random() * 0.28,
        phase: Math.random() * Math.PI * 2,
        radius: 1 + Math.random() * 1.7,
      });
    }
  };

  const draw = (now) => {
    const time = now * 0.001;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "screen";

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const driftX = Math.sin(time * node.speed + node.phase) * 0.035;
      const driftY = Math.cos(time * node.speed * 0.9 + node.phase) * 0.035;
      const x = ((node.x + driftX + pointerX * 0.025) % 1) * width;
      const y = ((node.y + driftY + pointerY * 0.018) % 1) * height;

      ctx.beginPath();
      ctx.fillStyle = i % 3 === 0 ? "rgba(206, 255, 92, 0.28)" : i % 3 === 1 ? "rgba(79, 124, 255, 0.2)" : "rgba(255, 106, 72, 0.18)";
      ctx.arc(x, y, node.radius, 0, Math.PI * 2);
      ctx.fill();

      const next = nodes[(i + 9) % nodes.length];
      const nx = ((next.x + Math.sin(time * next.speed + next.phase) * 0.035 + pointerX * 0.025) % 1) * width;
      const ny = ((next.y + Math.cos(time * next.speed * 0.9 + next.phase) * 0.035 + pointerY * 0.018) % 1) * height;
      const dist = Math.hypot(nx - x, ny - y);

      if (dist < Math.min(width, height) * 0.42) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(245, 239, 224, ${Math.max(0, 0.12 - dist / 5200)})`;
        ctx.lineWidth = 1;
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = "source-over";
    if (!prefersReducedMotion.matches) {
      animationFrame = requestAnimationFrame(draw);
    }
  };

  const handlePointer = (event) => {
    pointerX = event.clientX / Math.max(width, 1);
    pointerY = event.clientY / Math.max(height, 1);
    const offsetX = pointerX - 0.5;
    const offsetY = pointerY - 0.5;
    document.documentElement.style.setProperty("--hero-shift-x", `${offsetX * 42}px`);
    document.documentElement.style.setProperty("--hero-shift-y", `${offsetY * 30}px`);
    document.documentElement.style.setProperty("--hero-tilt", `${offsetX * 3.5}deg`);
    document.documentElement.style.setProperty("--hero-depth", `${offsetY * 18}px`);
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", handlePointer, { passive: true });
  resize();
  seedNodes();

  if (prefersReducedMotion.matches) {
    draw(0);
  } else {
    animationFrame = requestAnimationFrame(draw);
  }

  const handleMotionPreference = () => {
    cancelAnimationFrame(animationFrame);
    if (prefersReducedMotion.matches) {
      draw(0);
    } else {
      animationFrame = requestAnimationFrame(draw);
    }
  };

  if (typeof prefersReducedMotion.addEventListener === "function") {
    prefersReducedMotion.addEventListener("change", handleMotionPreference);
  } else if (typeof prefersReducedMotion.addListener === "function") {
    prefersReducedMotion.addListener(handleMotionPreference);
  }
})();
