const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const LINE_HEIGHT = 14;
const FONT = '10px "SF Mono", Menlo, Consolas, monospace';
const MIN_SLOT_WIDTH = 20; 
const MASK_SCALE = 0.25; 

const ASSET_VERSION =
  typeof window !== "undefined" && window.__OPENING_ASSET_VERSION__
    ? `?v=${window.__OPENING_ASSET_VERSION__}`
    : "";

const FRAME_SETS = {
  cyan: `/images/opening/wavespeed/anim/cyan_glide`,
  pink: `/images/opening/wavespeed/anim/pink_pulse`,
  violet: `/images/opening/wavespeed/anim/violet_sway`,
};

// --------------------------------------------------------
// 1. Data & Text Configuration (Continuous Flow Stream)
// --------------------------------------------------------
const TEXT_STREAM = `[ BIO_DATA: SCYPHOZOA ] Organism exhibits pronounced glowing behavior when disturbed. Bell diameter ranges from 40-60cm, characterized by transparent hues. Observation of propulsion mechanisms reveals a highly efficient jet-like cycle. Energy expenditure is minimal. Trailing tentacles span up to 3 meters, lined with microscopic stinging cells.      [ NEURAL MAPPING ] Unlike centralized nervous systems, this organism utilizes a distributed nerve net. Instantaneous reflexive responses to hydrodynamic shifts are achieved via sub-millisecond signal propagation. Sensory organs located at the bell margin detect light, gravity, and chemical signatures.      [ SYSTEM_OVERRIDE_ACTIVE ] INITIATING DATA STREAM ANALYSIS... Subject demonstrates anomalous regenerative capabilities. Cellular structure remains stable under extreme pressure. Recommended for further extraction and synthesis.      `.repeat(10);

// --------------------------------------------------------
// 2. High-Performance Image Filter & Loader
// --------------------------------------------------------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function convertToThermalHologram(img) {
  const canvas = document.createElement("canvas");
  const w = img.width || img.naturalWidth || 960;
  const h = img.height || img.naturalHeight || 960;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  for (let i = 0, y = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const a = data[i+3];
      if (a < 15) { data[i+3] = 0; continue; }
      
      const r = data[i], g = data[i+1], b = data[i+2];
      const luma = (r + g + b) / 3;
      
      if (luma < 15) { data[i+3] = 0; continue; }

      // Pure Blue-Green Tone Palette (No Yellow)
      if (luma > 180) { 
        data[i] = 100; data[i+1] = 255; data[i+2] = 200; // Bright Cyan-Green Core
      } else if (luma > 80) { 
        data[i] = 0; data[i+1] = 200; data[i+2] = 150;   // Deep Emerald Green
      } else { 
        data[i] = 0; data[i+1] = 100; data[i+2] = 200;   // Dark Blue/Cyan edges
      }
      
      // Structural Point Cloud & Transparency logic
      const isGrid = (x % 3 === 0) && (y % 3 === 0);
      let alpha = 0;
      
      if (luma > 180) {
        alpha = 255; // Solid core tissue
      } else if (luma > 80) {
        alpha = isGrid ? 200 : 80; // Mesh body
      } else {
        alpha = isGrid ? 150 : 0; // Highly transparent bell (water), dots only
      }
      
      data[i+3] = Math.min(255, alpha);
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function bakeGlow(canvas, blurRadius) {
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = canvas.width;
  glowCanvas.height = canvas.height;
  const ctx = glowCanvas.getContext("2d");
  ctx.filter = `blur(${blurRadius}px) saturate(120%)`;
  ctx.drawImage(canvas, 0, 0);
  return glowCanvas;
}

async function loadFrameSet(baseUrl) {
  const response = await fetch(`${baseUrl}/manifest.json${ASSET_VERSION}`);
  if (!response.ok) throw new Error(`Failed to load manifest: ${baseUrl}`);
  const manifest = await response.json();
  const processedFrames = [];
  
  const loadPromises = manifest.frames.map(frameName => 
    loadImage(`${baseUrl}/${frameName}${ASSET_VERSION}`).then(img => {
      const baseHolo = convertToThermalHologram(img);
      return { 
        canvas: baseHolo,
        glowCanvas: bakeGlow(baseHolo, 12) 
      };
    })
  );
  
  const loadedFrames = await Promise.all(loadPromises);
  processedFrames.push(...loadedFrames);
  
  return { 
    frames: processedFrames, 
    fps: manifest.fps || 8, 
    naturalWidth: processedFrames[0]?.canvas.width || 960, 
    naturalHeight: processedFrames[0]?.canvas.height || 960 
  };
}

// --------------------------------------------------------
// 3. Collision Logic (Scaled Offscreen Canvas)
// --------------------------------------------------------
function getBlockedRangesForY(maskData, mw, mh, y, logicalWidth, padding) {
    const my = Math.floor(y * MASK_SCALE);
    if (my < 0 || my >= mh) return [];
    
    const ranges = [];
    let inBlock = false;
    let startX = 0;
    
    const offset = my * mw * 4;
    for (let mx = 0; mx < mw; mx++) {
        const alpha = maskData[offset + mx * 4 + 3];
        // Threshold controls how tight the text hugs the jellyfish
        if (alpha > 20) {
            if (!inBlock) {
                inBlock = true;
                startX = mx;
            }
        } else {
            if (inBlock) {
                inBlock = false;
                ranges.push({ start: (startX / MASK_SCALE) - padding, end: (mx / MASK_SCALE) + padding });
            }
        }
    }
    if (inBlock) {
        ranges.push({ start: (startX / MASK_SCALE) - padding, end: logicalWidth + padding });
    }
    return ranges;
}

function subtractRanges(baseStart, baseEnd, blockedRanges) {
  const ordered = blockedRanges
    .filter(range => range && range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const slots = [];
  let cursor = baseStart;

  for (const range of ordered) {
    const start = Math.max(baseStart, range.start);
    const end = Math.min(baseEnd, range.end);
    if (end <= cursor) continue;
    if (start - cursor >= MIN_SLOT_WIDTH) {
      slots.push({ start: cursor, end: start });
    }
    cursor = Math.max(cursor, end);
  }
  if (baseEnd - cursor >= MIN_SLOT_WIDTH) {
    slots.push({ start: cursor, end: baseEnd });
  }
  return slots;
}

// --------------------------------------------------------
// 4. Entities
// --------------------------------------------------------
class AnimatedJelly {
  constructor(animData, config) {
    this.frames = animData.frames;
    this.fps = animData.fps;
    this.width = animData.naturalWidth * config.scale;
    this.height = animData.naturalHeight * config.scale;
    
    this.centerX = config.centerX;
    this.centerY = config.centerY;
    this.radius = config.radius;
    this.speed = config.speed;
    this.phase = config.phase;
    
    this.opacity = config.opacity || 1.0;
    this.blur = config.blur || 0; // For depth of field
    
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.timeOffset = Math.random() * 100;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    // Circular orbit
    this.x = this.centerX + Math.cos(t) * this.radius;
    this.y = this.centerY + Math.sin(t) * this.radius * 0.8; 
    
    this.vx = -Math.sin(t);
    this.vy = Math.cos(t) * 0.8;
  }

  getCurrentFrame(time) {
    if (!this.frames || this.frames.length === 0) return null;
    const t = time + this.timeOffset;
    const frameIdx = Math.floor((t * this.fps)) % this.frames.length;
    return this.frames[frameIdx];
  }

  drawMask(ctx, time) {
    if (this.blur > 0) return; // Blurred background jellies do not collide with text
    const frame = this.getCurrentFrame(time);
    if (!frame) return;
    
    ctx.save();
    ctx.translate(this.x * MASK_SCALE, this.y * MASK_SCALE);
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(frame.canvas, (-this.width/2) * MASK_SCALE, (-this.height/2) * MASK_SCALE, this.width * MASK_SCALE, this.height * MASK_SCALE);
    ctx.restore();
  }

  draw(ctx, time) {
    const frame = this.getCurrentFrame(time);
    if (!frame) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2); 
    
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = "screen";
    if (this.blur > 0) ctx.filter = `blur(${this.blur}px)`;
    
    // Draw pre-baked bloom (very performant)
    ctx.drawImage(frame.glowCanvas, -this.width/2, -this.height/2, this.width, this.height);
    
    // Draw solid core
    ctx.globalAlpha = this.opacity * 0.85;
    ctx.drawImage(frame.canvas, -this.width/2, -this.height/2, this.width, this.height);
    
    ctx.restore();
  }
}

// Deep Sea Stars (Floating, NOT flashing)
class DeepSeaStars {
  constructor() {
    this.stars = Array.from({length: 150}, () => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      size: Math.random() > 0.85 ? Math.random() * 3 + 1 : Math.random() * 1.5 + 0.5,
      speedY: (Math.random() * -10) - 2,
      phase: Math.random() * Math.PI * 2,
    }));
  }
  update(dt, time) {
    for (const star of this.stars) {
      star.y += star.speedY * dt;
      if (star.y < -50) star.y = LOGICAL_HEIGHT + 50;
    }
  }
  draw(ctx, time) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const star of this.stars) {
      // Smooth breathing glow
      const alpha = (Math.sin(time * 0.5 + star.phase) + 1) / 2 * 0.5 + 0.3;
      
      if (star.size > 2.5) {
        ctx.fillStyle = `rgba(57, 255, 20, ${alpha * 0.8})`; 
        ctx.shadowColor = "#39ff14";
        ctx.shadowBlur = 8;
        const fs = star.size * 3;
        ctx.fillRect(star.x - fs, star.y - 0.5, fs * 2, 1);
        ctx.fillRect(star.x - 0.5, star.y - fs, 1, fs * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.2})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star.size*0.5, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }
}

// Edge Flashing Terminals (Fixed pos, flickering visibility)
class StaticFlashUI {
  constructor() {
    this.elements = [
      { x: LOGICAL_WIDTH - 250, y: 80, type: 'hud', w: 180, h: 60, interval: 2.5, duration: 0.3 },
      { x: 50, y: 100, type: 'barcode', w: 100, h: 15, interval: 4.0, duration: 0.15 },
      { x: LOGICAL_WIDTH - 200, y: LOGICAL_HEIGHT - 100, type: 'err', w: 100, h: 20, interval: 3.2, duration: 0.4 },
      { x: 100, y: LOGICAL_HEIGHT - 150, type: 'reticle', w: 50, h: 50, interval: 5.0, duration: 0.8 }
    ].map(e => ({ ...e, lastToggle: Math.random() * 5, visible: false }));
  }
  
  update(time) {
    for (const el of this.elements) {
      if (el.visible && time - el.lastToggle > el.duration) {
        el.visible = false;
        el.lastToggle = time;
      } else if (!el.visible && time - el.lastToggle > el.interval) {
        el.visible = true;
        el.lastToggle = time;
      }
    }
  }
  
  draw(ctx, time) {
    ctx.save();
    ctx.fillStyle = "rgba(57, 255, 20, 0.9)";
    ctx.strokeStyle = "rgba(57, 255, 20, 0.9)";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.5;
    
    for (const el of this.elements) {
      if (!el.visible) continue;
      
      if (el.type === 'hud') {
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.fillRect(el.x, el.y, 20, 5);
        ctx.fillRect(el.x + el.w - 20, el.y + el.h - 5, 20, 5);
        ctx.font = '12px monospace';
        ctx.fillText("TARGET AQ", el.x + 10, el.y + 20);
        ctx.fillText(`LVL: ${(Math.random()*100).toFixed(2)}`, el.x + 10, el.y + 40);
      } else if (el.type === 'barcode') {
        let cx = el.x;
        while (cx < el.x + el.w) {
          const bw = Math.random() * 6 + 1;
          ctx.fillRect(cx, el.y, bw, el.h);
          cx += bw + 3;
        }
      } else if (el.type === 'err') {
        ctx.font = '14px monospace';
        ctx.fillText(`ERR_${Math.random().toString(16).substr(2, 6).toUpperCase()}`, el.x, el.y);
      } else if (el.type === 'reticle') {
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.w/2, 0, Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(el.x - el.w, el.y); ctx.lineTo(el.x + el.w, el.y);
        ctx.moveTo(el.x, el.y - el.w); ctx.lineTo(el.x, el.y + el.w);
        ctx.stroke();
      }
    }
    
    // Static Ruler (Always on)
    ctx.beginPath();
    const rightX = LOGICAL_WIDTH - 30;
    ctx.moveTo(rightX, 200); ctx.lineTo(rightX, 600);
    for(let i = 0; i <= 400; i += 20) {
      ctx.moveTo(rightX, 200 + i); 
      ctx.lineTo(rightX + (i % 100 === 0 ? 15 : 8), 200 + i);
    }
    ctx.stroke();
    
    ctx.restore();
  }
}

// --------------------------------------------------------
// 5. Main Initialization
// --------------------------------------------------------
async function initOpeningCanvas() {
  const canvas = document.querySelector("[data-opening-canvas]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const scaleX = rect.width / LOGICAL_WIDTH;
    const scaleY = rect.height / LOGICAL_HEIGHT;
    const scale = Math.max(scaleX, scaleY);
    const offsetX = (rect.width - LOGICAL_WIDTH * scale) / 2;
    const offsetY = (rect.height - LOGICAL_HEIGHT * scale) / 2;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
  };
  window.addEventListener("resize", resize);
  resize();

  const [cyanAnim, pinkAnim, violetAnim] = await Promise.all([
    loadFrameSet(FRAME_SETS.cyan),
    loadFrameSet(FRAME_SETS.pink),
    loadFrameSet(FRAME_SETS.violet)
  ]);
  
  const MW = LOGICAL_WIDTH * MASK_SCALE;
  const MH = LOGICAL_HEIGHT * MASK_SCALE;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = MW;
  maskCanvas.height = MH;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  
  const CX = LOGICAL_WIDTH / 2;
  const CY = LOGICAL_HEIGHT / 2;
  const jellies = [
    // Scaled down significantly, spaced out in wider orbits
    new AnimatedJelly(cyanAnim, { scale: 0.35, centerX: CX - 150, centerY: CY + 100, radius: 200, speed: 0.25, phase: 0, opacity: 1.0, blur: 0 }),
    new AnimatedJelly(pinkAnim, { scale: 0.25, centerX: CX + 200, centerY: CY - 100, radius: 250, speed: 0.3, phase: Math.PI * 0.8, opacity: 0.95, blur: 0 }),
    new AnimatedJelly(violetAnim, { scale: 0.18, centerX: CX, centerY: CY + 150, radius: 150, speed: 0.4, phase: Math.PI * 1.5, opacity: 0.9, blur: 0 }),
    // Blurred background jellies (Depth)
    new AnimatedJelly(cyanAnim, { scale: 0.25, centerX: CX - 250, centerY: CY - 150, radius: 100, speed: 0.15, phase: Math.PI, opacity: 0.5, blur: 6 })
  ];

  const starfield = new DeepSeaStars();
  const staticUI = new StaticFlashUI();
  
  ctx.font = FONT;
  const charWidth = ctx.measureText("A").width;
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    // Clear & Base dark background
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = "#01080a"; 
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    starfield.update(dt, time);
    starfield.draw(ctx, time);

    for (const j of jellies) j.update(time);
    
    // SCALED OFFSCREEN MASK FOR COLLISION
    maskCtx.clearRect(0, 0, MW, MH);
    for (const j of jellies) j.drawMask(maskCtx, time);
    const maskData = maskCtx.getImageData(0, 0, MW, MH).data;
    
    // =======================================
    // CHARACTER STREAM LAYOUT (PERFECT FLOW, NO JITTER)
    // =======================================
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    ctx.shadowBlur = 0;
    
    const SCROLL_SPEED = 25; 
    let globalIndex = Math.floor(time * SCROLL_SPEED);

    for (let baselineY = 40; baselineY <= LOGICAL_HEIGHT - 40; baselineY += LINE_HEIGHT) {
      const blocked = getBlockedRangesForY(maskData, MW, MH, baselineY - LINE_HEIGHT * 0.4, LOGICAL_WIDTH, 14); 
      const slots = subtractRanges(60, LOGICAL_WIDTH - 60, blocked);
      
      for (const slot of slots) {
        let x = slot.start;
        while (x + charWidth <= slot.end) {
            const char = TEXT_STREAM[globalIndex % TEXT_STREAM.length];
            ctx.fillStyle = (char === "[" || char === "]") ? "#39ff14" : "rgba(0, 243, 255, 0.7)";
            ctx.fillText(char, x, baselineY);
            x += charWidth;
            globalIndex++;
        }
      }
    }
    
    // Foreground Layer - Jellies
    const sortedJellies = [...jellies].sort((a, b) => b.blur - a.blur);
    for (const j of sortedJellies) {
      j.draw(ctx, time);
    }
    
    // Top Layer - Flashing UI
    staticUI.update(time);
    staticUI.draw(ctx, time);
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);