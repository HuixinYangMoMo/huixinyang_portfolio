import { prepareWithSegments, layoutNextLine } from "{{ '/assets/libs/layout.js' | relative_url }}";

const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const LINE_HEIGHT = 14;
const FONT = '10px "SF Mono", Menlo, Consolas, monospace';
const MIN_SLOT_WIDTH = 40; // Allow text to get closer to tentacles

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
// 1. Data & Text Configuration (Terminal Tech Theme)
// --------------------------------------------------------
const TEXT_1 = `[ ENCRYPTED_STREAM_01: BIO_SYSTEMS ]\nOrganism exhibits pronounced glowing behavior when disturbed. The bell diameter ranges from 40-60cm, characterized by transparent hues. Observation of propulsion mechanisms reveals a highly efficient jet-like cycle. Energy expenditure is minimal. Trailing tentacles span up to 3 meters, lined with microscopic stinging cells for capturing zooplankton.\n[ FLUID DYNAMICS ]\nBy expanding and contracting its coronal bell, the entity creates localized vortex rings. This method of locomotion minimizes drag and allows for sustained suspension in high-pressure abyssal zones.\n\n`.repeat(50);

const TEXT_2 = `[ SYS_OVERRIDE_ACTIVE ]\nINITIATING DATA STREAM ANALYSIS...\nSubject demonstrates anomalous regenerative capabilities. Cellular structure remains stable under extreme pressure. Recommended for further extraction and synthesis.\n[ NEURAL MAPPING ]\nUnlike centralized nervous systems, this organism utilizes a distributed nerve net. Instantaneous reflexive responses to hydrodynamic shifts are achieved via sub-millisecond signal propagation. Sensory organs located at the bell margin detect light, gravity, and chemical signatures.\n\n`.repeat(50);

const PREP_1 = prepareWithSegments(TEXT_1, FONT, { whiteSpace: 'pre-wrap' });
const PREP_2 = prepareWithSegments(TEXT_2, FONT, { whiteSpace: 'pre-wrap' });

// --------------------------------------------------------
// 2. Asset Loader & Matrix/Sonar Filter
// --------------------------------------------------------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function convertToSonarHologram(img) {
  const canvas = document.createElement("canvas");
  const w = img.naturalWidth || 960;
  const h = img.naturalHeight || 960;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] > 0) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const luma = (r + g + b) / 3;
      
      // Black-green neon tech filter with heatmap highlights
      if (luma > 180) { // White/Yellow hotspots
        data[i] = 255; 
        data[i+1] = 255; 
        data[i+2] = 50; 
      } else if (luma > 90) { // Toxic Neon Green
        data[i] = 57; 
        data[i+1] = 255; 
        data[i+2] = 20;
      } else { // Deep Cyan/Blue
        data[i] = 0; 
        data[i+1] = 180; 
        data[i+2] = 255; 
      }
      
      data[i+3] = luma > 10 ? Math.min(255, data[i+3] * 1.5) : 0; // Enhance opacity for scanning effect
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

async function loadFrameSet(baseUrl) {
  const response = await fetch(`${baseUrl}/manifest.json${ASSET_VERSION}`);
  if (!response.ok) throw new Error(`Failed to load manifest: ${baseUrl}`);
  const manifest = await response.json();
  const frames = [];
  
  const loadPromises = manifest.frames.map(frameName => 
    loadImage(`${baseUrl}/${frameName}${ASSET_VERSION}`).then(convertToSonarHologram)
  );
  
  const loadedFrames = await Promise.all(loadPromises);
  frames.push(...loadedFrames);
  
  return { 
    frames, 
    fps: manifest.fps || 8, 
    naturalWidth: frames[0]?.width || 960, 
    naturalHeight: frames[0]?.height || 960 
  };
}

// --------------------------------------------------------
// 3. Collision Logic
// --------------------------------------------------------
function getBlockedRangesForY(maskData, y, width, padding) {
    const ranges = [];
    let inBlock = false;
    let start = 0;
    
    // Look at a few rows to ensure the text line height is fully clear
    const y1 = Math.max(0, Math.floor(y - LINE_HEIGHT * 0.8));
    const y2 = Math.max(0, Math.floor(y - LINE_HEIGHT * 0.4));
    const y3 = Math.max(0, Math.floor(y));
    
    const o1 = y1 * width * 4;
    const o2 = y2 * width * 4;
    const o3 = y3 * width * 4;
    
    for (let x = 0; x < width; x++) {
        const a1 = maskData[o1 + x * 4 + 3];
        const a2 = maskData[o2 + x * 4 + 3];
        const a3 = maskData[o3 + x * 4 + 3];
        
        // Threshold: any opacity > 15 triggers a block
        if (a1 > 15 || a2 > 15 || a3 > 15) {
            if (!inBlock) {
                inBlock = true;
                start = x;
            }
        } else {
            if (inBlock) {
                inBlock = false;
                ranges.push({ start: start - padding, end: x + padding });
            }
        }
    }
    if (inBlock) {
        ranges.push({ start: start - padding, end: width + padding });
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
// 4. UI and Rendering Entities
// --------------------------------------------------------
class Jellyfish {
  constructor(key, animData, config) {
    this.key = key;
    this.frames = animData.frames;
    this.fps = animData.fps;
    
    this.width = animData.naturalWidth * config.scale;
    this.height = animData.naturalHeight * config.scale;
    
    // Orbital movement config
    this.centerX = config.x;
    this.centerY = config.y;
    this.radius = config.radius;
    this.speed = config.speed;
    this.phase = config.phase;
    
    this.timeOffset = Math.random() * 100;
    this.opacity = config.opacity || 1.0;
    this.blur = config.blur || 0; // For depth of field
    
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    // Circular chase
    this.x = this.centerX + Math.cos(t) * this.radius;
    this.y = this.centerY + Math.sin(t * 0.8) * this.radius; // slightly flattened circle
    
    // Velocity vector for rotation calculation
    this.vx = -Math.sin(t);
    this.vy = Math.cos(t * 0.8) * 0.8;
  }
  
  drawMask(ctx, time) {
    // Background out-of-focus jellies don't block text
    if (this.blur > 0 || !this.frames || this.frames.length === 0) return;
    
    const t = time + this.timeOffset;
    const frameIdx = Math.floor((t * this.fps)) % this.frames.length;
    const frame = this.frames[frameIdx];
    
    ctx.save();
    ctx.translate(this.x, this.y);
    
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2);
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05); // slight organic sway
    
    ctx.globalAlpha = 1.0;
    ctx.drawImage(frame, -this.width/2, -this.height/2, this.width, this.height);
    ctx.restore();
  }

  draw(ctx, time) {
    if (!this.frames || this.frames.length === 0) return;
    
    const t = time + this.timeOffset;
    const frameIdx = Math.floor((t * this.fps)) % this.frames.length;
    const frame = this.frames[frameIdx];
    
    ctx.save();
    ctx.translate(this.x, this.y);
    
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2); 
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05);
    
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = "screen";
    if (this.blur > 0) ctx.filter = `blur(${this.blur}px)`;
    
    ctx.drawImage(frame, -this.width/2, -this.height/2, this.width, this.height);
    ctx.restore();
  }
}

// Background Starfield & Flares
class CrosshairStars {
  constructor() {
    this.stars = Array.from({length: 120}, () => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      size: Math.random() > 0.85 ? Math.random() * 3 + 2 : Math.random() * 1.5 + 0.5,
      speedY: (Math.random() * -10) - 2, // drift up
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
      
      // Core dot
      ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * 0.8, 0, Math.PI*2);
      ctx.fill();
      
      // Large stars have the classic four-pointed crosshair flares
      if (star.size > 2.5) {
        ctx.fillStyle = `rgba(57, 255, 20, ${alpha * 0.8})`; // neon green flare
        ctx.shadowColor = "#39ff14";
        ctx.shadowBlur = 4;
        const flareSize = star.size * 4;
        ctx.fillRect(star.x - flareSize, star.y - 0.5, flareSize * 2, 1);
        ctx.fillRect(star.x - 0.5, star.y - flareSize, 1, flareSize * 2);
      }
    }
    ctx.restore();
  }
}

// --------------------------------------------------------
// 5. Tech UI Elements
// --------------------------------------------------------
function drawLeftNeonTab(ctx) {
  ctx.save();
  // Solid green tab
  ctx.fillStyle = "#a8ff00"; 
  ctx.fillRect(0, 250, 40, 160);
  
  // Black squiggly wave logo inside the tab
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(20, 280);
  ctx.lineTo(30, 290); ctx.lineTo(10, 305);
  ctx.lineTo(30, 320); ctx.lineTo(10, 335);
  ctx.lineTo(30, 350); ctx.lineTo(20, 360);
  ctx.stroke();
  
  // Gradient edge for 3D/glitch effect at the bottom of the tab
  const grad = ctx.createLinearGradient(0, 410, 0, 420);
  grad.addColorStop(0, "#ff0000");
  grad.addColorStop(1, "#a8ff00");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 410, 40, 10);
  ctx.restore();
}

function drawRightRuler(ctx) {
  ctx.save();
  ctx.strokeStyle = "#39ff14";
  ctx.lineWidth = 2;
  const startX = LOGICAL_WIDTH - 60;
  const startY = 200;
  
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX, startY + 300);
  
  for(let i = 0; i <= 300; i += 15) {
      const tickLen = i % 60 === 0 ? 20 : 10;
      ctx.moveTo(startX, startY + i);
      ctx.lineTo(startX + tickLen, startY + i);
  }
  ctx.stroke();
  
  // Target brackets [ ]
  ctx.beginPath();
  ctx.moveTo(1000, 350); ctx.lineTo(980, 350); ctx.lineTo(980, 370); // Top left
  ctx.moveTo(1200, 350); ctx.lineTo(1220, 350); ctx.lineTo(1220, 370); // Top right
  ctx.stroke();
  
  ctx.restore();
}

function drawFloatingTechBlocks(ctx, time) {
  ctx.save();
  ctx.fillStyle = "rgba(57, 255, 20, 0.7)";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 5;
  
  // Solid data blocks
  const b1Y = 380 + Math.sin(time*2)*5;
  ctx.fillRect(980, b1Y, 60, 15);
  ctx.fillRect(1050, b1Y, 100, 15);
  ctx.fillRect(1160, b1Y, 40, 15);
  
  // Glitchy block clusters
  const b2X = 850;
  const b2Y = 650 + Math.cos(time*3)*2;
  for(let i=0; i<6; i++) {
    for(let j=0; j<3; j++) {
       if (Math.random() > 0.3) {
           ctx.fillRect(b2X + i*12, b2Y + j*10, 10, 8);
       }
    }
  }
  
  // Target brackets upper
  ctx.strokeStyle = "rgba(57, 255, 20, 0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(980, 180, 200, 40);
  
  ctx.restore();
}

// --------------------------------------------------------
// 6. Main Loop
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
  
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = LOGICAL_WIDTH;
  maskCanvas.height = LOGICAL_HEIGHT;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  
  // Depth of field jellies: 2 sharp foreground, 2 blurred background
  const jellies = [
    // Sharp Foreground
    new Jellyfish('cyan', cyanAnim, {
      scale: 0.6, x: LOGICAL_WIDTH * 0.3, y: LOGICAL_HEIGHT * 0.7, radius: 100, speed: 0.3, phase: 0, opacity: 0.95, blur: 0
    }),
    new Jellyfish('pink', pinkAnim, {
      scale: 0.5, x: LOGICAL_WIDTH * 0.7, y: LOGICAL_HEIGHT * 0.5, radius: 120, speed: 0.25, phase: Math.PI, opacity: 0.9, blur: 0
    }),
    // Blurred Background
    new Jellyfish('violet', violetAnim, {
      scale: 0.45, x: LOGICAL_WIDTH * 0.8, y: LOGICAL_HEIGHT * 0.25, radius: 60, speed: 0.15, phase: Math.PI/2, opacity: 0.6, blur: 6
    }),
    new Jellyfish('cyan_bg', cyanAnim, {
      scale: 0.5, x: LOGICAL_WIDTH * 0.2, y: LOGICAL_HEIGHT * 0.2, radius: 80, speed: 0.2, phase: Math.PI*1.5, opacity: 0.5, blur: 8
    })
  ];

  const starfield = new CrosshairStars();
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    // Clear
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Base layer: Very dark navy/teal as seen in reference
    ctx.fillStyle = "#010a0e";
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Update elements
    starfield.update(dt, time);
    for (const j of jellies) j.update(time);
    
    // Offscreen Pixel-Perfect Mask Rendering for sharp Jellies ONLY
    maskCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    for (const j of jellies) j.drawMask(maskCtx, time);
    const maskData = maskCtx.getImageData(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).data;
    
    // 1. Draw Starfield & UI Elements
    starfield.draw(ctx, time);
    drawLeftNeonTab(ctx);
    drawRightRuler(ctx);
    drawFloatingTechBlocks(ctx, time);
    
    // 2. TEXT WRAPPING
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    
    const SCROLL_SPEED = 18; 
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
    ctx.shadowBlur = 3; // Glowing text like a CRT monitor
    
    for (let baselineY = -40 - yOffset; baselineY <= LOGICAL_HEIGHT + 60; baselineY += LINE_HEIGHT) {
      // 8px extremely tight padding to hug the point-cloud jellies
      const blocked = getBlockedRangesForY(maskData, baselineY, LOGICAL_WIDTH, 8); 
      
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
      const slots2 = subtractRanges(LOGICAL_WIDTH / 2 + 40, LOGICAL_WIDTH - 120, blocked);
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
    
    // 3. Foreground Layer - Jellies
    // Sort jellies by blur to draw sharpest on top
    const sortedJellies = [...jellies].sort((a, b) => b.blur - a.blur);
    for (const j of sortedJellies) {
      j.draw(ctx, time);
    }
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);