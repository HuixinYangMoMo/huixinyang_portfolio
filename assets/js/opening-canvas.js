import { prepareWithSegments, layoutNextLine } from "@chenglou/pretext";

const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const LINE_HEIGHT = 14;
const FONT = '10px "SF Mono", Menlo, Consolas, monospace';
const MIN_SLOT_WIDTH = 40; 
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
// 1. Text Data
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
      if (a < 15) { data[i+3] = 0; continue; }
      
      const r = data[i], g = data[i+1], b = data[i+2];
      const luma = (r + g + b) / 3;
      
      // Deterministic spatial noise for point cloud effect (No Math.random = fast!)
      const noise = ((x * 1973 + y * 9277) % 100);
      
      if (noise > luma * 0.9) {
        data[i+3] = 0; 
        continue; 
      }
      
      // Thermal Palette
      if (luma > 180) { 
        data[i] = 255; data[i+1] = 255; data[i+2] = 50; 
      } else if (luma > 100) { 
        data[i] = 57; data[i+1] = 255; data[i+2] = 20;
      } else { 
        data[i] = 0; data[i+1] = 180; data[i+2] = 255; 
      }
      data[i+3] = Math.min(255, luma * 1.5);
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
        if (alpha > 15) {
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
    
    this.centerX = config.x;
    this.centerY = config.y;
    this.radius = config.radius;
    this.speed = config.speed;
    this.phase = config.phase;
    
    this.opacity = config.opacity || 1.0;
    this.blur = config.blur || 0;
    
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.timeOffset = Math.random() * 100;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    // Elegant sweeping curve
    this.x = this.centerX + Math.sin(t) * this.radius;
    this.y = this.centerY + Math.cos(t * 0.8) * this.radius * 0.8; 
    
    this.vx = Math.cos(t) * this.radius * this.speed;
    this.vy = -Math.sin(t * 0.8) * this.radius * this.speed * 0.8;
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
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05); // Breath/sway
    
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
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05);
    
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = "screen";
    if (this.blur > 0) ctx.filter = `blur(${this.blur}px)`;
    
    ctx.drawImage(frame.canvas, -this.width/2, -this.height/2, this.width, this.height);
    ctx.restore();
  }
}

// Background Starfield & Coordinates
class DeepSeaStars {
  constructor() {
    this.stars = Array.from({length: 150}, () => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      size: Math.random() > 0.85 ? Math.random() * 3 + 2 : Math.random() * 1.5 + 0.5,
      speedY: (Math.random() * -15) - 5,
      blinkSpeed: Math.random() * 2 + 1,
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
      const alpha = (Math.sin(time * star.blinkSpeed + star.phase) + 1) / 2 * 0.7 + 0.1;
      ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * 0.8, 0, Math.PI*2);
      ctx.fill();
      
      if (star.size > 2.5) {
        ctx.fillStyle = `rgba(57, 255, 20, ${alpha * 0.8})`; 
        ctx.shadowColor = "#39ff14";
        ctx.shadowBlur = 4;
        const flareSize = star.size * 5;
        ctx.fillRect(star.x - flareSize, star.y - 0.5, flareSize * 2, 1);
        ctx.fillRect(star.x - 0.5, star.y - flareSize, 1, flareSize * 2);
      }
    }
    ctx.restore();
  }
}

// Static Edge UI Overlays (Flickering, Fixed on Top)
class StaticTerminalUI {
  draw(ctx, time) {
    ctx.save();
    ctx.strokeStyle = "#39ff14";
    ctx.fillStyle = "#39ff14";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 2;
    ctx.lineWidth = 1;
    
    // Top Left: Systems Monitor (Flickers fast)
    if (Math.random() > 0.15) {
      ctx.font = '10px monospace';
      ctx.fillText("[ OVR.SYS.99 ]", 40, 50);
      ctx.fillText(`MEM: ${(Math.random() * 99).toFixed(1)}%`, 40, 65);
      // Small barcode
      let bx = 40;
      for(let i=0; i<15; i++) {
        const w = Math.random() * 4 + 1;
        ctx.fillRect(bx, 75, w, 10);
        bx += w + 2;
      }
    }

    // Top Right: Target Box (Flickers slow)
    if (Math.sin(time * 5) > -0.8) {
      ctx.beginPath();
      ctx.moveTo(LOGICAL_WIDTH - 150, 40); ctx.lineTo(LOGICAL_WIDTH - 170, 40); ctx.lineTo(LOGICAL_WIDTH - 170, 60);
      ctx.moveTo(LOGICAL_WIDTH - 40, 40); ctx.lineTo(LOGICAL_WIDTH - 20, 40); ctx.lineTo(LOGICAL_WIDTH - 20, 60);
      ctx.moveTo(LOGICAL_WIDTH - 170, 100); ctx.lineTo(LOGICAL_WIDTH - 170, 120); ctx.lineTo(LOGICAL_WIDTH - 150, 120);
      ctx.moveTo(LOGICAL_WIDTH - 20, 100); ctx.lineTo(LOGICAL_WIDTH - 20, 120); ctx.lineTo(LOGICAL_WIDTH - 40, 120);
      ctx.stroke();
      ctx.fillText("TARGET.AQ", LOGICAL_WIDTH - 120, 85);
    }
    
    // Right Edge: Vertical Ruler
    ctx.beginPath();
    const rightX = LOGICAL_WIDTH - 30;
    ctx.moveTo(rightX, 200); ctx.lineTo(rightX, 600);
    for(let i = 0; i <= 400; i += 20) {
      ctx.moveTo(rightX, 200 + i); 
      ctx.lineTo(rightX + (i % 100 === 0 ? 15 : 8), 200 + i);
    }
    ctx.stroke();

    // Bottom Left: Data Stream Status
    if (Math.random() > 0.05) {
      ctx.fillText("DATA STREAM INTACT", 40, LOGICAL_HEIGHT - 60);
      ctx.fillRect(40, LOGICAL_HEIGHT - 50, 100 * (0.5 + Math.sin(time*2)*0.5), 4);
      ctx.strokeStyle = "rgba(57, 255, 20, 0.4)";
      ctx.strokeRect(40, LOGICAL_HEIGHT - 50, 100, 4);
    }

    // Bottom Right: Err Codes
    if (Math.random() > 0.3) {
      const errCode = Math.random().toString(16).substr(2, 8).toUpperCase();
      ctx.fillStyle = "rgba(0, 243, 255, 0.9)"; // Cyan error
      ctx.fillText(`ERR_${errCode}`, LOGICAL_WIDTH - 150, LOGICAL_HEIGHT - 50);
    }

    // Top Edge / Bottom Edge Grid Crosshairs
    ctx.strokeStyle = "rgba(0, 255, 150, 0.3)";
    ctx.beginPath();
    for (let x = 100; x < LOGICAL_WIDTH; x += 200) {
      ctx.moveTo(x, 10); ctx.lineTo(x, 25);
      ctx.moveTo(x, LOGICAL_HEIGHT - 25); ctx.lineTo(x, LOGICAL_HEIGHT - 10);
    }
    ctx.stroke();

    ctx.restore();
  }
}

function drawBackgroundNumbers(ctx, time) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.font = '280px monospace';
  ctx.fillStyle = "#39ff14";
  ctx.fillText("302", LOGICAL_WIDTH - 500, 300);
  ctx.fillText("SYS", 100, LOGICAL_HEIGHT - 150);
  
  ctx.globalAlpha = 0.4;
  ctx.font = '14px monospace';
  for(let i=0; i<6; i++) {
    const x = (LOGICAL_WIDTH * 0.2 * i + time * 30) % LOGICAL_WIDTH;
    const y = LOGICAL_HEIGHT * 0.85 + Math.sin(time + i) * 60;
    const val = (Math.sin(time*2 + i) * 1000000).toFixed(0);
    ctx.fillText(`COORD [X:${val}]`, x, y);
  }
  ctx.restore();
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
  
  const jellies = [
    // Sharp Foreground Jellies (Collide with text)
    new AnimatedJelly(cyanAnim, { scale: 0.65, x: LOGICAL_WIDTH * 0.35, y: LOGICAL_HEIGHT * 0.5, radius: 150, speed: 0.4, phase: 0, opacity: 1.0, blur: 0 }),
    new AnimatedJelly(pinkAnim, { scale: 0.55, x: LOGICAL_WIDTH * 0.75, y: LOGICAL_HEIGHT * 0.45, radius: 180, speed: 0.35, phase: Math.PI, opacity: 0.95, blur: 0 }),
    // Blurred Background Jellies (Ignore text collision)
    new AnimatedJelly(violetAnim, { scale: 0.4, x: LOGICAL_WIDTH * 0.8, y: LOGICAL_HEIGHT * 0.25, radius: 90, speed: 0.2, phase: Math.PI/2, opacity: 0.5, blur: 5 }),
    new AnimatedJelly(cyanAnim, { scale: 0.45, x: LOGICAL_WIDTH * 0.2, y: LOGICAL_HEIGHT * 0.2, radius: 100, speed: 0.25, phase: Math.PI*1.5, opacity: 0.4, blur: 8 })
  ];

  const starfield = new DeepSeaStars();
  const staticUI = new StaticTerminalUI();
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    // Clear & Base
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = "#02080a"; // Very dark cyan/navy
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    drawBackgroundNumbers(ctx, time);
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
    // TEXT WRAPPING & LAYOUT
    // =======================================
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    
    const SCROLL_SPEED = 22; 
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

    ctx.shadowColor = "#00f3ff";
    ctx.shadowBlur = 2;
    
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
          ctx.fillStyle = line.text.includes("[") ? "#39ff14" : "rgba(0, 243, 255, 0.7)";
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
          ctx.fillStyle = line.text.includes("[") ? "#39ff14" : "rgba(0, 243, 255, 0.7)";
          ctx.fillText(line.text.trim(), slot.start, baselineY);
          cur2 = line.end;
        }
      }
    }
    ctx.shadowBlur = 0; // Reset
    
    // Foreground Layer - Jellies
    const sortedJellies = [...jellies].sort((a, b) => b.blur - a.blur);
    for (const j of sortedJellies) {
      j.draw(ctx, time);
    }
    
    // Render Static Top-Level UI Elements
    staticUI.draw(ctx, time);
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);
