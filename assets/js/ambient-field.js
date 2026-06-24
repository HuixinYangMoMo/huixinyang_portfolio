(() => {
  const root = document.documentElement;
  const ambientCanvas = document.querySelector("[data-ambient-field]");
  const symbolCanvas = document.querySelector("[data-symbol-canvas]");
  const hero = document.querySelector("[data-symbol-hero]");
  const stage = document.querySelector("[data-symbol-stage]");
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
    clientX: window.innerWidth * 0.52,
    clientY: window.innerHeight * 0.42,
    active: false,
  };

  const setCssMotion = (clientX, clientY, velocity = 0) => {
    const winX = clientX / Math.max(window.innerWidth, 1);
    const winY = clientY / Math.max(window.innerHeight, 1);
    const offsetX = winX - 0.5;
    const offsetY = winY - 0.5;
    const stageRect = stage?.getBoundingClientRect();
    const viewRect = symbolCanvas?.getBoundingClientRect();
    const stageX = stageRect ? (clientX - stageRect.left) / Math.max(stageRect.width, 1) : winX;
    const stageY = stageRect ? (clientY - stageRect.top) / Math.max(stageRect.height, 1) : winY;
    const symbolX = clamp((stageX - 0.52) * 78 + velocity * 0.01, -40, 42);
    const symbolY = clamp((stageY - 0.47) * 60, -34, 36);
    const tiltX = clamp((stageX - 0.5) * 14 + velocity * 0.018, -10, 12);
    const tiltY = clamp((0.5 - stageY) * 10, -8, 8);

    root.style.setProperty("--hero-shift-x", `${offsetX * 32}px`);
    root.style.setProperty("--hero-shift-y", `${offsetY * 24}px`);
    root.style.setProperty("--hero-tilt", `${offsetX * 3}deg`);
    root.style.setProperty("--hero-depth", `${offsetY * 18}px`);
    root.style.setProperty("--symbol-bg-x", `${56 + offsetX * 5}%`);
    root.style.setProperty("--symbol-bg-y", `${44 + offsetY * 5}%`);
    root.style.setProperty("--orbit-x", `${offsetX * -20}px`);
    root.style.setProperty("--orbit-y", `${offsetY * -12}px`);
    root.style.setProperty("--orbit-inner-x", `${offsetX * 14}px`);
    root.style.setProperty("--orbit-inner-y", `${offsetY * 10}px`);
    root.style.setProperty("--orbit-rotate", `${-8 + offsetX * 5}deg`);
    root.style.setProperty("--orbit-inner-rotate", `${18 + offsetX * -6}deg`);
    root.style.setProperty("--grid-x", `${offsetX * -12}px`);
    root.style.setProperty("--grid-y", `${offsetY * -8}px`);
    root.style.setProperty("--grid-tilt", `${offsetX * -0.8}deg`);
    root.style.setProperty("--rail-one-x", `${offsetX * -16}px`);
    root.style.setProperty("--rail-one-y", `${offsetY * -4}px`);
    root.style.setProperty("--rail-two-x", `${offsetX * 10}px`);
    root.style.setProperty("--rail-two-y", `${offsetY * 5}px`);
    root.style.setProperty("--beacon-rose-x", `${offsetX * 18}px`);
    root.style.setProperty("--beacon-rose-y", `${offsetY * 10}px`);
    root.style.setProperty("--beacon-blue-x", `${offsetX * -18}px`);
    root.style.setProperty("--beacon-blue-y", `${offsetY * -8}px`);
    root.style.setProperty("--glass-x", `${42 + offsetX * 4}%`);
    root.style.setProperty("--glass-y", `${34 + offsetY * 4}%`);
    root.style.setProperty("--symbol-x", `${symbolX}px`);
    root.style.setProperty("--symbol-y", `${symbolY}px`);
    root.style.setProperty("--symbol-tilt-x", `${tiltX}deg`);
    root.style.setProperty("--symbol-tilt-y", `${tiltY}deg`);
    root.style.setProperty("--symbol-rotate", `${-7 + offsetX * 2.6}deg`);
    root.style.setProperty("--glyph-rotate", `${-8 + offsetX * 8}deg`);
    root.style.setProperty("--symbol-glow", `${pointer.targetStrength.toFixed(3)}`);
    root.style.setProperty("--symbol-glow-alpha", `${(0.06 + pointer.targetStrength * 0.16).toFixed(3)}`);
    root.style.setProperty("--route-x", `${offsetX * 12}px`);
    root.style.setProperty("--route-y", `${offsetY * 8}px`);
    root.style.setProperty("--glint-x", `${-24 + offsetX * 34}px`);

    pointer.clientX = clientX;
    pointer.clientY = clientY;

    if (viewRect) {
      pointer.targetX = clamp((clientX - viewRect.left) / Math.max(viewRect.width, 1), 0.02, 0.98);
      pointer.targetY = clamp((clientY - viewRect.top) / Math.max(viewRect.height, 1), 0.02, 0.98);
    }
  };

  const handlePointerMove = (event) => {
    const velocity = Math.hypot(event.clientX - pointer.lastX, event.clientY - pointer.lastY);
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.active = true;
    pointer.targetStrength = clamp(0.18 + velocity / 42, 0.22, 1);
    setCssMotion(event.clientX, event.clientY, velocity);
  };

  const softenPointer = () => {
    pointer.active = false;
    pointer.targetStrength = 0.16;
    setCssMotion(window.innerWidth * 0.52, window.innerHeight * 0.47, 0);
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

  const setupSymbolField = () => {
    if (!symbolCanvas) return null;

    const ctx = symbolCanvas.getContext("2d", { alpha: true });
    const motes = [];
    const signals = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let spin = 0;

    const resize = () => {
      const rect = symbolCanvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      symbolCanvas.width = Math.floor(width * dpr);
      symbolCanvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      motes.length = 0;
      signals.length = 0;
      for (let i = 0; i < 110; i += 1) {
        motes.push({
          x: Math.random(),
          y: Math.random(),
          size: 0.6 + Math.random() * 1.6,
          alpha: 0.045 + Math.random() * 0.12,
          phase: Math.random() * Math.PI * 2,
        });
      }
      for (let i = 0; i < 16; i += 1) {
        signals.push({
          x: 0.18 + Math.random() * 0.74,
          y: 0.12 + Math.random() * 0.72,
          vx: 0,
          vy: 0,
          size: 5 + Math.random() * 12,
          phase: Math.random() * Math.PI * 2,
          color: i % 4,
        });
      }
    };

    const drawRoundedRect = (x, y, w, h, radius) => {
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

    const signalPalette = [
      "rgba(255, 129, 103, 0.88)",
      "rgba(255, 188, 109, 0.88)",
      "rgba(145, 205, 255, 0.82)",
      "rgba(255, 125, 178, 0.78)",
    ];

    const drawFocusRail = (time) => {
      const cx = pointer.x * width;
      const cy = pointer.y * height;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineWidth = 1;
      ctx.setLineDash([14, 18]);
      ctx.lineDashOffset = -time * 0.025;

      for (let i = 0; i < 3; i += 1) {
        const y = height * (0.22 + i * 0.24) + (pointer.y - 0.5) * (24 - i * 5);
        ctx.beginPath();
        ctx.moveTo(width * -0.08, y);
        ctx.bezierCurveTo(width * 0.22, y - 80, cx - 80, cy + (i - 1) * 34, width * 1.08, y + 50);
        ctx.strokeStyle = `rgba(248, 241, 223, ${0.075 + pointer.strength * 0.035 - i * 0.01})`;
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 112 + pointer.strength * 34, 38 + pointer.strength * 18, spin * 0.22, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 188, 109, ${0.12 + pointer.strength * 0.08})`;
      ctx.stroke();
      ctx.restore();
    };

    const drawFocusGate = () => {
      const cx = pointer.x * width;
      const cy = pointer.y * height;
      const w = 110 + pointer.strength * 58;
      const h = 68 + pointer.strength * 34;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((pointer.x - 0.5) * 0.12);
      ctx.strokeStyle = `rgba(248, 241, 223, ${0.18 + pointer.strength * 0.16})`;
      ctx.lineWidth = 1;
      const corner = 18;
      const left = -w * 0.5;
      const top = -h * 0.5;

      ctx.beginPath();
      ctx.moveTo(left, top + corner);
      ctx.lineTo(left, top);
      ctx.lineTo(left + corner, top);
      ctx.moveTo(w * 0.5 - corner, top);
      ctx.lineTo(w * 0.5, top);
      ctx.lineTo(w * 0.5, top + corner);
      ctx.moveTo(w * 0.5, h * 0.5 - corner);
      ctx.lineTo(w * 0.5, h * 0.5);
      ctx.lineTo(w * 0.5 - corner, h * 0.5);
      ctx.moveTo(left + corner, h * 0.5);
      ctx.lineTo(left, h * 0.5);
      ctx.lineTo(left, h * 0.5 - corner);
      ctx.stroke();
      ctx.restore();
    };

    const draw = (time) => {
      pointer.x = lerp(pointer.x, pointer.targetX, 0.08);
      pointer.y = lerp(pointer.y, pointer.targetY, 0.08);
      pointer.strength = lerp(pointer.strength, pointer.targetStrength, 0.06);
      spin += 0.004 + pointer.strength * 0.018;

      root.style.setProperty("--symbol-glow", pointer.strength.toFixed(3));
      root.style.setProperty("--symbol-glow-alpha", (0.06 + pointer.strength * 0.16).toFixed(3));

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "screen";

      const cx = pointer.x * width;
      const cy = pointer.y * height;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.34);
      glow.addColorStop(0, `rgba(255, 188, 109, ${0.08 + pointer.strength * 0.08})`);
      glow.addColorStop(0.42, "rgba(145, 205, 255, 0.035)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      drawFocusRail(time);

      motes.forEach((mote) => {
        const wave = Math.sin(time * 0.0005 + mote.phase) * 0.2;
        const x = (mote.x + (pointer.x - 0.5) * 0.024) * width;
        const y = (mote.y + (pointer.y - 0.5) * 0.016) * height;
        ctx.fillStyle = `rgba(248, 241, 223, ${mote.alpha + wave * 0.018})`;
        ctx.fillRect(x, y, mote.size, mote.size);
      });

      signals.forEach((signal) => {
        const dx = pointer.x - signal.x;
        const dy = pointer.y - signal.y;
        const dist = Math.max(0.04, Math.hypot(dx, dy));
        const pull = pointer.strength * 0.0009;
        const orbit = 0.00032 + pointer.strength * 0.0006;
        signal.vx += dx * pull + (-dy / dist) * orbit;
        signal.vy += dy * pull + (dx / dist) * orbit;
        signal.vx *= 0.94;
        signal.vy *= 0.94;
        signal.x = clamp(signal.x + signal.vx, 0.04, 0.96);
        signal.y = clamp(signal.y + signal.vy, 0.04, 0.92);

        const x = signal.x * width;
        const y = signal.y * height;
        const pulse = Math.sin(time * 0.0018 + signal.phase) * 0.5 + 0.5;
        const size = signal.size + pulse * 4 + pointer.strength * 4;
        ctx.shadowColor = signalPalette[signal.color];
        ctx.shadowBlur = 16 + pointer.strength * 16;
        ctx.fillStyle = signalPalette[signal.color];
        if (signal.color === 1) {
          drawRoundedRect(x - size * 1.35, y - size * 0.55, size * 2.7, size * 1.1, size * 0.55);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.shadowBlur = 0;
      drawFocusGate();
      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    seed();
    return { draw, resize };
  };

  const setupWorkWall = () => {
    const wall = document.querySelector("[data-work-wall]");
    const canvas = document.querySelector("[data-work-physics]");
    const cards = Array.from(document.querySelectorAll("[data-work-card]"));
    if (!wall || !canvas || cards.length === 0) return null;

    const ctx = canvas.getContext("2d", { alpha: true });
    const states = cards.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, glow: 0, targetGlow: 0 }));
    const cursor = { x: 0, y: 0, active: false };
    let rect = wall.getBoundingClientRect();
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      rect = wall.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const updateCardLight = (card, cardRect) => {
      const localX = clamp(((cursor.x - cardRect.left) / Math.max(cardRect.width, 1)) * 100, 0, 100);
      const localY = clamp(((cursor.y - cardRect.top) / Math.max(cardRect.height, 1)) * 100, 0, 100);
      card.style.setProperty("--card-light-x", `${localX}%`);
      card.style.setProperty("--card-light-y", `${localY}%`);
    };

    const handleMove = (event) => {
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      cursor.active = true;
    };

    const handleLeave = () => {
      cursor.active = false;
    };

    const reveal = () => {
      wall.classList.add("is-visible");
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal();
            observer.disconnect();
          }
        });
      }, { threshold: 0.18 });
      observer.observe(wall);
    } else {
      reveal();
    }

    wall.addEventListener("pointermove", handleMove, { passive: true });
    wall.addEventListener("pointerleave", handleLeave, { passive: true });

    const draw = (time) => {
      rect = wall.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "screen";

      const points = [];
      cards.forEach((card, index) => {
        const state = states[index];
        const cardRect = card.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width * 0.5;
        const centerY = cardRect.top + cardRect.height * 0.5;
        const dx = cursor.x - centerX;
        const dy = cursor.y - centerY;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const radius = Math.max(cardRect.width, cardRect.height) * 0.92;
        const force = cursor.active ? clamp(1 - dist / radius, 0, 1) : 0;
        const direction = dist ? force / dist : 0;

        state.vx += -dx * direction * 0.72;
        state.vy += -dy * direction * 0.72;
        state.vx += -state.x * 0.11;
        state.vy += -state.y * 0.11;
        state.vx *= 0.74;
        state.vy *= 0.74;
        state.x += state.vx;
        state.y += state.vy;
        state.x = clamp(state.x, -22, 22);
        state.y = clamp(state.y, -18, 18);
        state.targetGlow = force;
        state.glow = lerp(state.glow, state.targetGlow, 0.12);

        const tilt = clamp((state.x / 22) * 2.8, -3.2, 3.2);
        card.style.setProperty("--push-x", `${state.x.toFixed(2)}px`);
        card.style.setProperty("--push-y", `${state.y.toFixed(2)}px`);
        card.style.setProperty("--tilt", `${tilt.toFixed(2)}deg`);
        card.style.setProperty("--card-glow", state.glow.toFixed(3));
        card.style.setProperty("--card-light-alpha", (0.08 + state.glow * 0.16).toFixed(3));
        card.style.setProperty("--card-grain-opacity", (0.12 + state.glow * 0.16).toFixed(3));
        card.style.setProperty("--card-scale", (1.04 + state.glow * 0.025).toFixed(3));
        if (cursor.active && force > 0) updateCardLight(card, cardRect);

        points.push({
          x: centerX - rect.left + state.x,
          y: centerY - rect.top + state.y,
          glow: state.glow,
        });
      });

      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        const pulse = Math.sin(time * 0.0012 + i) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 216, 77, ${0.08 + point.glow * 0.16})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.8 + pulse * 1.8 + point.glow * 5, 0, Math.PI * 2);
        ctx.fill();

        const next = points[(i + 2) % points.length];
        const dist = Math.hypot(next.x - point.x, next.y - point.y);
        if (dist < Math.min(width, height) * 0.62) {
          ctx.strokeStyle = `rgba(248, 241, 223, ${0.035 + (point.glow + next.glow) * 0.08})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }
      }

      if (cursor.active) {
        const localX = cursor.x - rect.left;
        const localY = cursor.y - rect.top;
        const gradient = ctx.createRadialGradient(localX, localY, 0, localX, localY, Math.min(width, height) * 0.3);
        gradient.addColorStop(0, "rgba(255, 88, 72, 0.13)");
        gradient.addColorStop(0.42, "rgba(169, 217, 255, 0.06)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.globalCompositeOperation = "source-over";
    };

    resize();
    return { draw, resize };
  };

  const setupDeckFrame = () => {
    const frame = document.querySelector("[data-deck-frame]");
    if (!frame) return;

    const url = frame.getAttribute("data-pdf-url");
    if (!url) return;

    fetch(url, { method: "HEAD" })
      .then((response) => {
        if (response.ok) return;
        throw new Error("PDF missing");
      })
      .catch(() => {
        frame.classList.add("is-missing");
        frame.insertAdjacentHTML(
          "beforeend",
          '<div class="deck-placeholder"><strong>Process Deck</strong><span>assets/decks/process-deck.pdf</span></div>'
        );
        const download = document.querySelector("[data-deck-download]");
        if (download) {
          download.setAttribute("aria-disabled", "true");
          download.addEventListener("click", (event) => event.preventDefault());
        }
      });
  };

  const ambient = setupAmbient();
  const symbolField = setupSymbolField();
  const workWall = setupWorkWall();
  setupDeckFrame();

  const resizeAll = () => {
    ambient?.resize();
    symbolField?.resize();
    workWall?.resize();
  };

  let animationFrame = 0;
  const drawAll = (time) => {
    ambient?.draw(time);
    symbolField?.draw(time);
    workWall?.draw(time);
    if (!prefersReducedMotion.matches) {
      animationFrame = requestAnimationFrame(drawAll);
    }
  };

  window.addEventListener("resize", resizeAll);
  setCssMotion(window.innerWidth * 0.61, window.innerHeight * 0.45, 0);

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
