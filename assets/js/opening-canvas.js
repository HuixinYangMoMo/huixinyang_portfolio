import { prepareWithSegments, layoutNextLine } from "@chenglou/pretext";

const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const LINE_HEIGHT = 16;
const FONT = '10.5px "SF Mono", Menlo, Consolas, monospace';
const MIN_SLOT_WIDTH = 50; 
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
// 1. Data & Text Configuration
// --------------------------------------------------------
const TEXT_1 = `[ ENCRYPTED_STREAM_01: BIO_SYSTEMS ]\nOrganism exhibits pronounced glowing behavior when disturbed. The bell diameter ranges from 40-60cm, characterized by transparent hues. Observation of propulsion mechanisms reveals a highly efficient jet-like cycle. Energy expenditure is minimal. Trailing tentacles span up to 3 meters, lined with microscopic stinging cells for capturing zooplankton.\n[ FLUID DYNAMICS ]\nBy expanding and contracting its coronal bell, the entity creates localized vortex rings. This method of locomotion minimizes drag and allows for sustained suspension in high-pressure abyssal zones.\n\n`.repeat(50);

const TEXT_2 = `[ SYS_OVERRIDE_ACTIVE ]\nINITIATING DATA STREAM ANALYSIS...\nSubject demonstrates anomalous regenerative capabilities. Cellular structure remains stable under extreme pressure. Recommended for further extraction and synthesis.\n[ NEURAL MAPPING ]\nUnlike centralized nervous systems, this organism utilizes a distributed nerve net. Instantaneous reflexive responses to hydrodynamic shifts are achieved via sub-millisecond signal propagation. Sensory organs located at the bell margin detect light, gravity, and chemical signatures.\n\n`.repeat(50);

const PREP_1 = prepareWithSegments(TEXT_1, FONT, { whiteSpace: 'pre-wrap' });
const PREP_2 = prepareWithSegments(TEXT_2, FONT, { whiteSpace: 'pre-wrap' });

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
      if (a < 10) { data[i+3] = 0; continue; }
      
      const r = data[i], g = data[i+1], b = data[i+2];
      const luma = (r + g + b) / 3;
      
      // Thermal Palette (Smooth mapping, NO random noise/stop-motion artifact)
      if (luma > 180) { 
        data[i] = 255; data[i+1] = 255; data[i+2] = 100; // Bright yellow/white core
      } else if (luma > 90) { 
        data[i] = 57; data[i+1] = 255; data[i+2] = 20;   // Neon green
      } else { 
        data[i] = 0; data[i+1] = 180; data[i+2] = 255;   // Deep cyan fringes
      }
      // Make it slightly more transparent at dark parts for that dreamy look
      data[i+3] = Math.min(255, luma * 1.8);
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

async function loadFrameSet(baseUrl) {
  const response = await fetch(`${baseUrl}/manifest.json${ASSET_VERSION}`);
  if (!response.ok) throw new Error(`Failed to load manifest: ${baseUrl}`);
  const manifest = await response.json();
  const processedFrames = [];
  
  // Background load
  const loadPromises = manifest.frames.map(frameName => 
    loadImage(`${baseUrl}/${frameName}${ASSET_VERSION}`).then(img => {
      return { canvas: convertToThermalHologram(img) };
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
    // Pure circular orbit
    const t = time * this.speed + this.phase;
    this.x = this.centerX + Math.cos(t) * this.radius;
    this.y = this.centerY + Math.sin(t) * this.radius;
    
    // Velocity vectors for rotation (tangent to circle)
    this.vx = -Math.sin(t);
    this.vy = Math.cos(t);
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
    
    // Minimal sway for smooth mask
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05); 
    
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
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05); // Smooth breathing
    
    // 1. Draw base jelly
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = "screen";
    if (this.blur > 0) ctx.filter = `blur(${this.blur}px)`;
    ctx.drawImage(frame.canvas, -this.width/2, -this.height/2, this.width, this.height);
    
    // 2. Draw Bloom (柔光滤镜 / Soft Glow) on top for the dreamy effect
    ctx.globalAlpha = this.opacity * 0.7; // Brighten the glow
    ctx.filter = `blur(${this.blur + 15}px) saturate(150%)`; // Heavy blur for the halo
    ctx.drawImage(frame.canvas, -this.width/2, -this.height/2, this.width, this.height);
    
    ctx.restore();
  }
}

// Smooth background stars/particles (No flickering, just smooth floating)
class DeepSeaStars {
  constructor() {
    this.stars = Array.from({length: 120}, () => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      size: Math.random() > 0.85 ? Math.random() * 3 + 1.5 : Math.random() * 1.5 + 0.5,
      speedY: (Math.random() * -12) - 2,
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
      // Smooth breathing glow instead of sharp flickering
      const alpha = (Math.sin(time + star.phase) + 1) / 2 * 0.5 + 0.3;
      
      if (star.size > 2.5) {
        // Crosshair stars
        ctx.fillStyle = `rgba(57, 255, 20, ${alpha})`; 
        ctx.shadowColor = "#39ff14";
        ctx.shadowBlur = 8;
        const fs = star.size * 3;
        ctx.fillRect(star.x - fs, star.y - 0.5, fs * 2, 1);
        ctx.fillRect(star.x - 0.5, star.y - fs, 1, fs * 2);
        // Center core
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.2})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star.size*0.5, 0, Math.PI*2); ctx.fill();
      } else {
        // Round dust
        ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
        ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }
}

// Flashing Overlays (Only UI elements flash at fixed locations)
class FlashUI {
  constructor() {
    this.elements = [
      { x: LOGICAL_WIDTH - 250, y: 150, type: 'hud', w: 180, h: 60, interval: 2.5, duration: 0.3 },
      { x: 150, y: 100, type: 'barcode', w: 100, h: 15, interval: 4.0, duration: 0.15 },
      { x: LOGICAL_WIDTH - 200, y: LOGICAL_HEIGHT - 150, type: 'err', w: 100, h: 20, interval: 3.2, duration: 0.4 },
      { x: 300, y: LOGICAL_HEIGHT - 200, type: 'reticle', w: 50, h: 50, interval: 5.0, duration: 0.8 }
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
    ctx.fillStyle = "rgba(57, 255, 20, 0.85)";
    ctx.strokeStyle = "rgba(57, 255, 20, 0.85)";
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
  
  // Offscreen Canvas for pixel-perfect rotation-aware collision!
  const MW = LOGICAL_WIDTH * MASK_SCALE;
  const MH = LOGICAL_HEIGHT * MASK_SCALE;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = MW;
  maskCanvas.height = MH;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  
  // Jellies Setup: Different sizes, orbiting a central point
  const CX = LOGICAL_WIDTH / 2;
  const CY = LOGICAL_HEIGHT / 2;
  const jellies = [
    // Huge foreground jelly
    new AnimatedJelly(cyanAnim, { scale: 0.8, centerX: CX, centerY: CY, radius: 240, speed: 0.25, phase: 0, opacity: 1.0, blur: 0 }),
    // Medium midground jelly
    new AnimatedJelly(pinkAnim, { scale: 0.55, centerX: CX, centerY: CY, radius: 360, speed: 0.35, phase: Math.PI * 0.8, opacity: 0.9, blur: 0 }),
    // Small foreground jelly
    new AnimatedJelly(violetAnim, { scale: 0.35, centerX: CX, centerY: CY, radius: 150, speed: 0.45, phase: Math.PI * 1.5, opacity: 0.95, blur: 0 }),
    // Blurred background giant
    new AnimatedJelly(cyanAnim, { scale: 0.9, centerX: CX, centerY: CY, radius: 100, speed: 0.15, phase: Math.PI, opacity: 0.5, blur: 12 })
  ];

  const starfield = new DeepSeaStars();
  const flashUI = new FlashUI();
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    // Clear & Base dark background
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = "#01080a"; 
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Draw Background Grid slightly
    ctx.strokeStyle = "rgba(0, 255, 100, 0.03)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < LOGICAL_WIDTH; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_HEIGHT); }
    for (let y = 0; y < LOGICAL_HEIGHT; y += 50) { ctx.moveTo(0, y); ctx.lineTo(LOGICAL_WIDTH, y); }
    ctx.stroke();
    
    starfield.update(dt, time);
    starfield.draw(ctx, time);

    for (const j of jellies) j.update(time);
    
    // =======================================
    // SCALED OFFSCREEN MASK FOR COLLISION
    // =======================================
    maskCtx.clearRect(0, 0, MW, MH);
    for (const j of jellies) j.drawMask(maskCtx, time);
    const maskData = maskCtx.getImageData(0, 0, MW, MH).data;
    
    // =======================================
    // TEXT WRAPPING & LAYOUT (SMOOTH FLOW)
    // =======================================
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    ctx.shadowBlur = 0; // No shadow for sharp text
    
    const SCROLL_SPEED = 25; 
    const totalScroll = time * SCROLL_SPEED;
    const scrolledLines = Math.floor(totalScroll / LINE_HEIGHT);
    const yOffset = totalScroll % LINE_HEIGHT;

    let cur1 = { segmentIndex: 0, graphemeIndex: 0 };
    for(let i=0; i < scrolledLines; i++) {
        let l = layoutNextLine(PREP_1, cur1, 400);
        if(l) cur1 = l.end; else { cur1 = { segmentIndex: 0, graphemeIndex: 0 }; layoutNextLine(PREP_1, cur1, 400); }
    }
    
    let cur2 = { segmentIndex: 0, graphemeIndex: 0 };
    for(let i=0; i < scrolledLines; i++) {
        let l = layoutNextLine(PREP_2, cur2, 400);
        if(l) cur2 = l.end; else { cur2 = { segmentIndex: 0, graphemeIndex: 0 }; layoutNextLine(PREP_2, cur2, 400); }
    }
    
    for (let baselineY = -40 - yOffset; baselineY <= LOGICAL_HEIGHT + 60; baselineY += LINE_HEIGHT) {
      // Calculate blocked regions for this row using the scaled mask
      const blocked = getBlockedRangesForY(maskData, MW, MH, baselineY - LINE_HEIGHT * 0.5, LOGICAL_WIDTH, 14); 
      
      // Column 1 (Left Area)
      const slots1 = subtractRanges(80, LOGICAL_WIDTH / 2 - 40, blocked);
      for (const slot of slots1) {
        const slotWidth = slot.end - slot.start;
        let line = layoutNextLine(PREP_1, cur1, slotWidth);
        if (!line) { cur1 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_1, cur1, slotWidth); }
        if (line) {
          if (line.start.segmentIndex === line.end.segmentIndex && line.start.graphemeIndex === line.end.graphemeIndex) continue;
          ctx.fillStyle = line.text.includes("[") ? "#39ff14" : "rgba(0, 243, 255, 0.65)";
          ctx.fillText(line.text.trim(), slot.start, baselineY);
          cur1 = line.end;
        }
      }

      // Column 2 (Right Area)
      const slots2 = subtractRanges(LOGICAL_WIDTH / 2 + 40, LOGICAL_WIDTH - 80, blocked);
      for (const slot of slots2) {
        const slotWidth = slot.end - slot.start;
        let line = layoutNextLine(PREP_2, cur2, slotWidth);
        if (!line) { cur2 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_2, cur2, slotWidth); }
        if (line) {
          if (line.start.segmentIndex === line.end.segmentIndex && line.start.graphemeIndex === line.end.graphemeIndex) continue;
          ctx.fillStyle = line.text.includes("[") ? "#39ff14" : "rgba(0, 243, 255, 0.65)";
          ctx.fillText(line.text.trim(), slot.start, baselineY);
          cur2 = line.end;
        }
      }
    }
    
    // Foreground Layer - Jellies (Soft Glow / Bloom pass applied inside draw)
    const sortedJellies = [...jellies].sort((a, b) => b.blur - a.blur);
    for (const j of sortedJellies) {
      j.draw(ctx, time);
    }
    
    // Top Layer - Flashing UI
    flashUI.update(time);
    flashUI.draw(ctx, time);
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);