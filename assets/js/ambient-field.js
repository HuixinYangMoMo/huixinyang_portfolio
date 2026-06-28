(() => {
  const root = document.documentElement;
  const ambientCanvas = document.querySelector("[data-ambient-field]");
  const fireworksCanvas = document.querySelector("[data-fireworks-canvas]");
  const hero = document.querySelector("[data-fireworks-hero]");
  const stage = document.querySelector("[data-fireworks-stage]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;

  const pointer = {
    x: 0.5,
    y: 0.46,
    targetX: 0.5,
    targetY: 0.46,
    strength: 0.14,
    targetStrength: 0.14,
    lastX: window.innerWidth * 0.5,
    lastY: window.innerHeight * 0.46,
    clientX: window.innerWidth * 0.52,
    clientY: window.innerHeight * 0.46,
    active: false,
  };

  const setCssMotion = (clientX, clientY, velocity = 0) => {
    const winX = clientX / Math.max(window.innerWidth, 1);
    const winY = clientY / Math.max(window.innerHeight, 1);
    const offsetX = winX - 0.5;
    const offsetY = winY - 0.5;
    const stageRect = stage?.getBoundingClientRect();
    const viewRect = fireworksCanvas?.getBoundingClientRect();
    const stageX = stageRect ? (clientX - stageRect.left) / Math.max(stageRect.width, 1) : winX;
    const stageY = stageRect ? (clientY - stageRect.top) / Math.max(stageRect.height, 1) : winY;

    root.style.setProperty("--hero-shift-x", `${offsetX * 32}px`);
    root.style.setProperty("--hero-shift-y", `${offsetY * 24}px`);
    root.style.setProperty("--hero-tilt", `${offsetX * 3}deg`);
    root.style.setProperty("--hero-depth", `${offsetY * 18}px`);
    root.style.setProperty("--photo-x", `${offsetX * -12}px`);
    root.style.setProperty("--photo-y", `${offsetY * -8}px`);
    root.style.setProperty("--firework-x", `${offsetX * 18}px`);
    root.style.setProperty("--firework-y", `${offsetY * 12}px`);
    root.style.setProperty("--burst-x", `${offsetX * -18}px`);
    root.style.setProperty("--burst-y", `${offsetY * -12}px`);
    root.style.setProperty("--ascii-x", `${offsetX * 12}px`);
    root.style.setProperty("--ascii-y", `${offsetY * 8}px`);
    root.style.setProperty("--route-x", `${offsetX * 14}px`);
    root.style.setProperty("--route-y", `${offsetY * 9}px`);
    root.style.setProperty("--traveler-x", `${(stageX - 0.5) * 18 + velocity * 0.005}px`);
    root.style.setProperty("--traveler-y", `${(stageY - 0.5) * 10}px`);

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
    setCssMotion(window.innerWidth * 0.52, window.innerHeight * 0.46, 0);
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

  const setupFireworksField = () => {
    if (!fireworksCanvas) return null;

    const ctx = fireworksCanvas.getContext("2d", { alpha: true });
    const glyphs = [];
    const fireflies = [];
    const glyphSet = ["1", "0", "3", "7", "*", ".", "/", "e", "v", "o"];
    const palette = [
      "rgba(196, 255, 97, 0.86)",
      "rgba(255, 122, 170, 0.74)",
      "rgba(255, 137, 86, 0.78)",
      "rgba(112, 215, 255, 0.78)",
      "rgba(188, 146, 255, 0.68)",
    ];
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = fireworksCanvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      fireworksCanvas.width = Math.floor(width * dpr);
      fireworksCanvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      glyphs.length = 0;
      fireflies.length = 0;
      for (let i = 0; i < 18; i += 1) {
        glyphs.push({
          x: 0.08 + Math.random() * 0.84,
          y: 0.12 + Math.random() * 0.5,
          char: glyphSet[Math.floor(Math.random() * glyphSet.length)],
          color: palette[i % palette.length],
          size: 13 + Math.random() * 12,
          drift: 5 + Math.random() * 12,
          phase: Math.random() * Math.PI * 2,
          rotate: -14 + Math.random() * 28,
        });
      }
      for (let i = 0; i < 42; i += 1) {
        fireflies.push({
          x: 0.04 + Math.random() * 0.92,
          y: 0.1 + Math.random() * 0.66,
          size: 0.9 + Math.random() * 2.4,
          color: palette[i % palette.length],
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const drawRoute = (time) => {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.setLineDash([5, 16]);
      ctx.lineDashOffset = -time * 0.006;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(248, 241, 223, ${0.08 + pointer.strength * 0.03})`;
      ctx.beginPath();
      ctx.moveTo(width * 0.28, height * 0.76);
      ctx.bezierCurveTo(width * 0.42, height * 0.69, width * 0.58, height * 0.67, width * 0.75, height * 0.62);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    const draw = (time) => {
      pointer.x = lerp(pointer.x, pointer.targetX, 0.07);
      pointer.y = lerp(pointer.y, pointer.targetY, 0.07);
      pointer.strength = lerp(pointer.strength, pointer.targetStrength, 0.055);

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "screen";

      const glowX = width * (0.54 + (pointer.x - 0.5) * 0.05);
      const glowY = height * (0.34 + (pointer.y - 0.5) * 0.04);
      const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.min(width, height) * 0.48);
      glow.addColorStop(0, `rgba(196, 255, 97, ${0.028 + pointer.strength * 0.024})`);
      glow.addColorStop(0.34, "rgba(112, 215, 255, 0.018)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      drawRoute(time);

      fireflies.forEach((dot) => {
        const twinkle = Math.sin(time * 0.0014 + dot.phase) * 0.5 + 0.5;
        const x = (dot.x + (pointer.x - 0.5) * 0.012) * width;
        const y = (dot.y + (pointer.y - 0.5) * 0.01) * height + Math.sin(time * 0.00025 + dot.phase) * 5;
        ctx.fillStyle = dot.color.replace(/0\.\d+\)/, `${0.16 + twinkle * 0.24})`);
        ctx.fillRect(x, y, dot.size, dot.size);
      });

      glyphs.forEach((glyph) => {
        const bob = Math.sin(time * 0.00045 + glyph.phase) * glyph.drift;
        const x = (glyph.x + (pointer.x - 0.5) * 0.018) * width;
        const y = (glyph.y + (pointer.y - 0.5) * 0.014) * height + bob;
        const pulse = Math.sin(time * 0.001 + glyph.phase) * 0.5 + 0.5;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((glyph.rotate + (pointer.x - 0.5) * 8) * Math.PI / 180);
        ctx.font = `700 ${glyph.size}px "SFMono-Regular", "SF Mono", Menlo, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = glyph.color;
        ctx.shadowBlur = 8 + pointer.strength * 8;
        ctx.fillStyle = glyph.color.replace(/0\.\d+\)/, `${0.36 + pulse * 0.24})`);
        ctx.fillText(glyph.char, 0, 0);
        ctx.globalAlpha = 0.18 + pulse * 0.12;
        ctx.fillText(glyph.char, 1.4, -1.1);
        ctx.restore();
      });

      ctx.shadowBlur = 0;
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
  const fireworkField = setupFireworksField();
  const workWall = setupWorkWall();
  setupDeckFrame();

  const resizeAll = () => {
    ambient?.resize();
    fireworkField?.resize();
    workWall?.resize();
  };

  let animationFrame = 0;
  const drawAll = (time) => {
    ambient?.draw(time);
    fireworkField?.draw(time);
    workWall?.draw(time);
    if (!prefersReducedMotion.matches) {
      animationFrame = requestAnimationFrame(drawAll);
    }
  };

  window.addEventListener("resize", resizeAll);
  setCssMotion(window.innerWidth * 0.52, window.innerHeight * 0.46, 0);

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
