(() => {
  const canvas = document.querySelector("[data-ambient-field]");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const palette = [
    "rgba(255, 88, 72, ALPHA)",
    "rgba(255, 216, 77, ALPHA)",
    "rgba(169, 217, 255, ALPHA)",
    "rgba(240, 155, 255, ALPHA)",
    "rgba(143, 214, 164, ALPHA)",
    "rgba(248, 241, 223, ALPHA)",
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let animationFrame = 0;
  const forms = [];
  const specks = [];

  const color = (index, alpha) => palette[index % palette.length].replace("ALPHA", alpha);
  const wrap = (value) => ((value % 1) + 1) % 1;

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

  const seed = () => {
    forms.length = 0;
    specks.length = 0;

    for (let i = 0; i < 18; i += 1) {
      forms.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.055 + Math.random() * 0.16,
        speed: 0.035 + Math.random() * 0.11,
        phase: Math.random() * Math.PI * 2,
        colorIndex: i,
        type: i % 4,
        depth: 0.4 + Math.random() * 1.2,
      });
    }

    for (let i = 0; i < 220; i += 1) {
      specks.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.55 + Math.random() * 1.65,
        colorIndex: Math.floor(Math.random() * palette.length),
        alpha: 0.05 + Math.random() * 0.16,
      });
    }
  };

  const drawPetal = (x, y, radius, rotation, colorIndex, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    const gradient = ctx.createRadialGradient(0, -radius * 0.16, 0, 0, 0, radius);
    gradient.addColorStop(0, color(5, alpha * 1.25));
    gradient.addColorStop(0.36, color(colorIndex, alpha));
    gradient.addColorStop(1, color(2, alpha * 0.08));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.18, radius * 0.42, radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawOrb = (x, y, radius, colorIndex, time) => {
    const gradient = ctx.createRadialGradient(
      x - radius * 0.34,
      y - radius * 0.28,
      radius * 0.08,
      x,
      y,
      radius
    );
    gradient.addColorStop(0, color(5, 0.34));
    gradient.addColorStop(0.38, color(colorIndex, 0.22));
    gradient.addColorStop(0.7, color(colorIndex + 2, 0.14));
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.04)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.96, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = color(colorIndex + 1, 0.13);
    const gap = Math.max(12, radius * 0.22);
    for (let dotX = x - radius; dotX < x + radius; dotX += gap) {
      for (let dotY = y - radius; dotY < y + radius; dotY += gap) {
        const wave = Math.sin(dotX * 0.02 + dotY * 0.014 + time) * 0.22 + 0.86;
        ctx.beginPath();
        ctx.arc(dotX, dotY, Math.max(1.4, radius * 0.035 * wave), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  const drawVessel = (x, y, radius, colorIndex, time) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.24 + radius) * 0.08);
    const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
    gradient.addColorStop(0, color(3, 0.15));
    gradient.addColorStop(0.42, color(colorIndex, 0.2));
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.04)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.32, -radius * 0.72);
    ctx.bezierCurveTo(-radius * 0.88, -radius * 0.36, -radius * 0.56, radius * 0.82, -radius * 0.12, radius);
    ctx.bezierCurveTo(radius * 0.48, radius * 0.92, radius * 0.82, -radius * 0.28, radius * 0.34, -radius * 0.72);
    ctx.bezierCurveTo(radius * 0.14, -radius * 0.86, -radius * 0.14, -radius * 0.86, -radius * 0.32, -radius * 0.72);
    ctx.fill();
    ctx.strokeStyle = color(5, 0.17);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  const draw = (now) => {
    const time = now * 0.001;
    const unit = Math.min(width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "screen";

    specks.forEach((speck) => {
      const x = wrap(speck.x + pointerX * 0.006) * width;
      const y = wrap(speck.y + pointerY * 0.005) * height;
      ctx.fillStyle = color(speck.colorIndex, speck.alpha);
      ctx.fillRect(x, y, speck.size, speck.size);
    });

    forms.forEach((form) => {
      const driftX = Math.sin(time * form.speed + form.phase) * 0.045;
      const driftY = Math.cos(time * form.speed * 0.82 + form.phase) * 0.05;
      const x = wrap(form.x + driftX + (pointerX - 0.5) * 0.025 * form.depth) * width;
      const y = wrap(form.y + driftY + (pointerY - 0.5) * 0.02 * form.depth) * height;
      const radius = form.size * unit;

      if (form.type === 0) {
        drawOrb(x, y, radius, form.colorIndex, time);
        return;
      }

      if (form.type === 1) {
        for (let i = 0; i < 6; i += 1) {
          drawPetal(x, y, radius, (Math.PI * 2 * i) / 6 + time * 0.05, form.colorIndex + i, 0.08);
        }
        ctx.fillStyle = color(form.colorIndex, 0.18);
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.14, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (form.type === 2) {
        drawVessel(x, y, radius, form.colorIndex, time);
        return;
      }

      ctx.fillStyle = color(form.colorIndex, 0.2);
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 0.74, radius * 0.22, time * 0.18 + form.phase, 0, Math.PI * 2);
      ctx.fill();
    });

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
    document.documentElement.style.setProperty("--hero-shift-x", `${offsetX * 46}px`);
    document.documentElement.style.setProperty("--hero-shift-y", `${offsetY * 34}px`);
    document.documentElement.style.setProperty("--hero-tilt", `${offsetX * 4}deg`);
    document.documentElement.style.setProperty("--hero-depth", `${offsetY * 22}px`);
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", handlePointer, { passive: true });
  resize();
  seed();

  if (prefersReducedMotion.matches) {
    draw(1200);
  } else {
    animationFrame = requestAnimationFrame(draw);
  }

  const handleMotionPreference = () => {
    cancelAnimationFrame(animationFrame);
    if (prefersReducedMotion.matches) {
      draw(1200);
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
