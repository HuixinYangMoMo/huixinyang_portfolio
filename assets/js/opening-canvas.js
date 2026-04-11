import { prepareWithSegments, layoutNextLine } from "{{ '/assets/libs/layout.js' | relative_url }}";

const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const LINE_HEIGHT = 14;
const FONT = '10px "SF Mono", Menlo, Consolas, monospace';
const MIN_SLOT_WIDTH = 40; 

// --------------------------------------------------------
// 1. Data & Text Configuration
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
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const luma = (r + g + b) / 3;
    
    // Map to intense radar green / cyan based on luma
    if (luma > 20) {
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
      data[i+3] = Math.min(255, luma * 1.8); 
    } else {
      data[i+3] = 0; // Transparent background
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// --------------------------------------------------------
// 3. Collision Logic
// --------------------------------------------------------
function getBlockedRangesForY(maskData, y, width, padding) {
    const ranges = [];
    let inBlock = false;
    let start = 0;
    
    const y1 = Math.max(0, Math.floor(y - LINE_HEIGHT * 0.8));
    const y2 = Math.max(0, Math.floor(y - LINE_HEIGHT * 0.4));
    const y3 = Math.max(0, Math.floor(y));
    
    const o1 = y1 * width * 4;
    const o2 = y2 * width * 4;
    const o3 = y3 * width * 4;
    
    for (let x = 0; x < width; x++) {
        // Alpha channel
        const a1 = maskData[o1 + x * 4 + 3];
        const a2 = maskData[o2 + x * 4 + 3];
        const a3 = maskData[o3 + x * 4 + 3];
        
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
// 4. Entities
// --------------------------------------------------------
class ProceduralJelly {
  constructor(imgCanvas, config) {
    this.canvas = imgCanvas;
    this.width = imgCanvas.width * config.scale;
    this.height = imgCanvas.height * config.scale;
    
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
    
    this.swaySpeed = config.speed * 2.5;
    this.swayAmp = config.scale * 15;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    this.x = this.centerX + Math.cos(t) * this.radius;
    this.y = this.centerY + Math.sin(t * 0.8) * this.radius; 
    
    this.vx = -Math.sin(t);
    this.vy = Math.cos(t * 0.8) * 0.8;
  }
  
  drawMask(ctx, time) {
    if (this.blur > 0 || !this.canvas) return; // Blurred jellies are in BG
    
    ctx.save();
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2);
    
    // Wave distortion for tentacles
    const strips = 20;
    const stripH = this.height / strips;
    for (let i = 0; i < strips; i++) {
        const wave = Math.sin(time * this.swaySpeed + i * 0.5) * this.swayAmp * (i / strips);
        ctx.drawImage(
            this.canvas, 
            0, (this.canvas.height / strips) * i, this.canvas.width, this.canvas.height / strips,
            -this.width/2 + wave, -this.height/2 + i * stripH, this.width, stripH
        );
    }
    ctx.restore();
  }

  draw(ctx, time) {
    if (!this.canvas) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2); 
    
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = "screen";
    if (this.blur > 0) ctx.filter = `blur(${this.blur}px)`;
    
    const strips = 30;
    const stripH = this.height / strips;
    for (let i = 0; i < strips; i++) {
        // Amplitude increases down the body (tentacles)
        const wave = Math.sin(time * this.swaySpeed + i * 0.4) * this.swayAmp * Math.pow(i / strips, 1.5);
        ctx.drawImage(
            this.canvas, 
            0, (this.canvas.height / strips) * i, this.canvas.width, this.canvas.height / strips,
            -this.width/2 + wave, -this.height/2 + i * stripH, this.width, stripH
        );
    }
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

// Floating Tech Glitches & Overlays
class TechOverlay {
  constructor() {
    this.elements = Array.from({length: 15}, () => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      w: Math.random() * 80 + 20,
      h: Math.random() * 20 + 5,
      type: Math.random() > 0.6 ? 'barcode' : 'text',
      interval: Math.random() * 4 + 1,
      visibleTime: Math.random() * 0.8 + 0.1,
      lastToggle: 0,
      visible: false
    }));
  }
  update(time) {
    for (const el of this.elements) {
      if (el.visible && time - el.lastToggle > el.visibleTime) {
        el.visible = false;
        el.lastToggle = time;
        el.x = Math.random() * LOGICAL_WIDTH;
        el.y = Math.random() * LOGICAL_HEIGHT;
      } else if (!el.visible && time - el.lastToggle > el.interval) {
        el.visible = true;
        el.lastToggle = time;
      }
    }
  }
  draw(ctx, time) {
    ctx.save();
    ctx.fillStyle = "rgba(57, 255, 20, 0.9)";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 5;
    for (const el of this.elements) {
      if (!el.visible) continue;
      
      if (el.type === 'barcode') {
        let cx = el.x;
        while (cx < el.x + el.w) {
          const bw = Math.random() * 5 + 1;
          ctx.fillRect(cx, el.y, bw, el.h);
          cx += bw + Math.random() * 3 + 1;
        }
      } else {
        ctx.font = '10px monospace';
        const txt = Math.random().toString(16).substr(2, 10).toUpperCase();
        ctx.fillText(`ERR_${txt}`, el.x, el.y);
        ctx.fillText(`L:${el.x.toFixed(0)} T:${el.y.toFixed(0)}`, el.x, el.y + 12);
      }
    }
    ctx.restore();
  }
}

function drawBackgroundNumbers(ctx, time) {
  ctx.save();
  // Huge Background Numbers
  ctx.globalAlpha = 0.04;
  ctx.font = '280px monospace';
  ctx.fillStyle = "#39ff14";
  ctx.fillText("302", LOGICAL_WIDTH - 500, 300);
  ctx.fillText("SYS", 100, LOGICAL_HEIGHT - 150);
  
  // Dynamic coordinate grid values
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

  // Load static jellyfish images generated via WaveSpeed
  const [jImg1, jImg2, jImg3] = await Promise.all([
    loadImage("{{ '/assets/images/jelly/j1.jpeg' | relative_url }}").then(convertToSonarHologram),
    loadImage("{{ '/assets/images/jelly/j2.jpeg' | relative_url }}").then(convertToSonarHologram),
    loadImage("{{ '/assets/images/jelly/j3.jpeg' | relative_url }}").then(convertToSonarHologram)
  ]);
  
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = LOGICAL_WIDTH;
  maskCanvas.height = LOGICAL_HEIGHT;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  
  const jellies = [
    // Sharp Foreground
    new ProceduralJelly(jImg1, { scale: 0.6, x: LOGICAL_WIDTH * 0.35, y: LOGICAL_HEIGHT * 0.6, radius: 120, speed: 0.3, phase: 0, opacity: 1.0, blur: 0 }),
    new ProceduralJelly(jImg2, { scale: 0.55, x: LOGICAL_WIDTH * 0.65, y: LOGICAL_HEIGHT * 0.45, radius: 150, speed: 0.25, phase: Math.PI, opacity: 0.95, blur: 0 }),
    // Blurred Background
    new ProceduralJelly(jImg3, { scale: 0.4, x: LOGICAL_WIDTH * 0.8, y: LOGICAL_HEIGHT * 0.25, radius: 80, speed: 0.15, phase: Math.PI/2, opacity: 0.6, blur: 6 })
  ];

  const starfield = new DeepSeaStars();
  const techOverlay = new TechOverlay();
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    // Clear & Base dark navy/black background
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = "#01080a";
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    drawBackgroundNumbers(ctx, time);
    starfield.update(dt, time);
    starfield.draw(ctx, time);

    for (const j of jellies) j.update(time);
    
    // Offscreen Pixel-Perfect Mask Rendering for sharp Jellies ONLY
    maskCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    for (const j of jellies) j.drawMask(maskCtx, time);
    const maskData = maskCtx.getImageData(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).data;
    
    // TEXT WRAPPING
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    
    const SCROLL_SPEED = 20; 
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

    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 4;
    
    for (let baselineY = -40 - yOffset; baselineY <= LOGICAL_HEIGHT + 60; baselineY += LINE_HEIGHT) {
      // 12px extremely tight padding to hug the point-cloud jellies
      const blocked = getBlockedRangesForY(maskData, baselineY, LOGICAL_WIDTH, 12); 
      
      // Column 1 (Left Area)
      const slots1 = subtractRanges(80, LOGICAL_WIDTH / 2 - 40, blocked);
      for (const slot of slots1) {
        const slotWidth = slot.end - slot.start;
        let line = layoutNextLine(PREP_1, cur1, slotWidth);
        if (!line) { cur1 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_1, cur1, slotWidth); }
        if (line) {
          if (line.start.segmentIndex === line.end.segmentIndex && line.start.graphemeIndex === line.end.graphemeIndex) continue;
          ctx.fillStyle = line.text.includes("[") ? "#39ff14" : "rgba(0, 243, 255, 0.8)";
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
          ctx.fillStyle = line.text.includes("[") ? "#39ff14" : "rgba(0, 243, 255, 0.8)";
          ctx.fillText(line.text.trim(), slot.start, baselineY);
          cur2 = line.end;
        }
      }
    }
    ctx.shadowBlur = 0; // Reset
    
    // Foreground Layer - Jellies
    // Sort jellies by blur to draw sharpest on top
    const sortedJellies = [...jellies].sort((a, b) => b.blur - a.blur);
    for (const j of sortedJellies) {
      j.draw(ctx, time);
    }
    
    techOverlay.update(time);
    techOverlay.draw(ctx, time);
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);