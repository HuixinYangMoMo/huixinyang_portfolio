import { prepareWithSegments, layoutNextLine } from "{{ '/assets/vendor/pretext/layout.js' | relative_url }}";

const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const LINE_HEIGHT = 16;
const FONT = '11px "SF Mono", Menlo, Consolas, monospace';
const MIN_SLOT_WIDTH = 60; // Allows finer text wrapping around tentacles

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
const TEXT_1 = `[ ENCRYPTED_STREAM_01: BIO_SYSTEMS ]\n\nOrganism exhibits pronounced glowing behavior when disturbed. The bell diameter ranges from 40-60cm, characterized by transparent hues.\n\nObservation of propulsion mechanisms reveals a highly efficient jet-like cycle. Energy expenditure is minimal. Trailing tentacles span up to 3 meters, lined with microscopic stinging cells for capturing zooplankton.\n\n[ FLUID DYNAMICS ]\n\nBy expanding and contracting its coronal bell, the entity creates localized vortex rings. This method of locomotion minimizes drag and allows for sustained suspension in high-pressure abyssal zones.\n\n`.repeat(50);

const TEXT_2 = `[ SYS_OVERRIDE_ACTIVE ]\n\nINITIATING DATA STREAM ANALYSIS...\n\nSubject demonstrates anomalous regenerative capabilities. Cellular structure remains stable under extreme pressure. Recommended for further extraction and synthesis.\n\n[ NEURAL MAPPING ]\n\nUnlike centralized nervous systems, this organism utilizes a distributed nerve net. Instantaneous reflexive responses to hydrodynamic shifts are achieved via sub-millisecond signal propagation. Sensory organs located at the bell margin detect light, gravity, and chemical signatures.\n\n`.repeat(50);

const PREP_1 = prepareWithSegments(TEXT_1, FONT, { whiteSpace: 'pre-wrap' });
const PREP_2 = prepareWithSegments(TEXT_2, FONT, { whiteSpace: 'pre-wrap' });

// --------------------------------------------------------
// 2. Asset Loader & Matrix Filter
// --------------------------------------------------------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function convertToMatrixGreen(img) {
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
      
      // Black-green neon tech filter
      data[i] = luma > 180 ? 200 : 0;       // R (Yellowish highlights)
      data[i+1] = luma > 40 ? 255 : luma;   // G (Dominant green)
      data[i+2] = luma > 200 ? 100 : 0;     // B 
      data[i+3] = Math.min(255, data[i+3] * 1.5); // Boost opacity
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
    loadImage(`${baseUrl}/${frameName}${ASSET_VERSION}`).then(convertToMatrixGreen)
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
    
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    // Circular chase
    this.x = this.centerX + Math.cos(t) * this.radius;
    this.y = this.centerY + Math.sin(t) * this.radius; 
    
    // Velocity vector for rotation calculation
    this.vx = -Math.sin(t);
    this.vy = Math.cos(t);
  }
  
  drawMask(ctx, time) {
    if (!this.frames || this.frames.length === 0) return;
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
    
    ctx.drawImage(frame, -this.width/2, -this.height/2, this.width, this.height);
    ctx.restore();
  }
}

// Background Starfield
class Starfield {
  constructor() {
    this.stars = Array.from({length: 120}, () => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      size: Math.random() * 1.5 + 0.5,
      speedY: (Math.random() * -10) - 5, // drift up
      blinkSpeed: Math.random() * 2 + 1,
      phase: Math.random() * Math.PI * 2,
      cross: Math.random() > 0.8
    }));
  }
  update(dt, time) {
    for (const star of this.stars) {
      star.y += star.speedY * dt;
      if (star.y < -10) star.y = LOGICAL_HEIGHT + 10;
    }
  }
  draw(ctx, time) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const star of this.stars) {
      const alpha = (Math.sin(time * star.blinkSpeed + star.phase) + 1) / 2 * 0.7 + 0.1;
      ctx.fillStyle = `rgba(100, 255, 150, ${alpha})`;
      
      if (star.cross) {
        // Draw crosshair star
        ctx.fillRect(star.x - star.size*2, star.y - 0.5, star.size*4, 1);
        ctx.fillRect(star.x - 0.5, star.y - star.size*2, 1, star.size*4);
      } else {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// Floating Tech Glitches
class TechOverlay {
  constructor() {
    this.elements = Array.from({length: 12}, () => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      w: Math.random() * 80 + 20,
      h: Math.random() * 20 + 5,
      type: Math.random() > 0.5 ? 'barcode' : 'text',
      interval: Math.random() * 3 + 1,
      visibleTime: Math.random() * 0.5 + 0.1,
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
    ctx.fillStyle = "rgba(0, 255, 100, 0.8)";
    for (const el of this.elements) {
      if (!el.visible) continue;
      
      if (el.type === 'barcode') {
        let cx = el.x;
        while (cx < el.x + el.w) {
          const bw = Math.random() * 4 + 1;
          ctx.fillRect(cx, el.y, bw, el.h);
          cx += bw + Math.random() * 3 + 1;
        }
      } else {
        ctx.font = '10px monospace';
        const txt = Math.random().toString(16).substr(2, 8).toUpperCase();
        ctx.fillText(`ERR_${txt}`, el.x, el.y);
      }
    }
    ctx.restore();
  }
}

function drawBackgroundNumbers(ctx, time) {
  ctx.save();
  ctx.font = '24px monospace';
  ctx.globalAlpha = 0.08;
  for(let i=0; i<5; i++) {
    const x = (LOGICAL_WIDTH * 0.2 * i + time * 20) % LOGICAL_WIDTH;
    const y = LOGICAL_HEIGHT * 0.8 + Math.sin(time + i) * 50;
    const val = (Math.sin(time*2 + i) * 1000000).toFixed(0);
    ctx.fillStyle = "#00ff66";
    ctx.fillText(`SYS.OVR.${val}`, x, y);
  }
  
  // Large background coordinate numbers
  ctx.globalAlpha = 0.03;
  ctx.font = '140px monospace';
  ctx.fillText("404", LOGICAL_WIDTH - 300, 200);
  ctx.fillText("SYS", 100, LOGICAL_HEIGHT - 100);
  ctx.restore();
}

// --------------------------------------------------------
// 5. Main Loop
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
  
  // 3 Jellyfishes chasing each other in a circle
  const centerX = LOGICAL_WIDTH / 2;
  const centerY = LOGICAL_HEIGHT / 2;
  const radius = 280;
  const speed = 0.5;
  
  const jellies = [
    new Jellyfish('cyan', cyanAnim, {
      scale: 0.55, x: centerX, y: centerY, radius, speed, phase: 0, opacity: 0.95
    }),
    new Jellyfish('pink', pinkAnim, {
      scale: 0.45, x: centerX, y: centerY, radius, speed, phase: (Math.PI * 2) / 3, opacity: 0.85
    }),
    new Jellyfish('violet', violetAnim, {
      scale: 0.5, x: centerX, y: centerY, radius, speed, phase: (Math.PI * 4) / 3, opacity: 0.9
    })
  ];

  const starfield = new Starfield();
  const techOverlay = new TechOverlay();
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    // Solid Terminal Black/Green Background
    ctx.fillStyle = "#010a05";
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    starfield.update(dt, time);
    starfield.draw(ctx, time);
    
    drawBackgroundNumbers(ctx, time);

    for (const j of jellies) j.update(time);
    
    // Offscreen Pixel-Perfect Mask Rendering
    maskCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    for (const j of jellies) j.drawMask(maskCtx, time);
    const maskData = maskCtx.getImageData(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).data;
    
    // TEXT WRAPPING
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    
    const SCROLL_SPEED = 24; 
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
      // 10px rigorous padding
      const blocked = getBlockedRangesForY(maskData, baselineY, LOGICAL_WIDTH, 14); 
      
      const slots1 = subtractRanges(80, LOGICAL_WIDTH / 2 - 40, blocked);
      for (const slot of slots1) {
        const slotWidth = slot.end - slot.start;
        let line = layoutNextLine(PREP_1, cur1, slotWidth);
        if (!line) { cur1 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_1, cur1, slotWidth); }
        if (line) {
          if (line.start.segmentIndex === line.end.segmentIndex && line.start.graphemeIndex === line.end.graphemeIndex) continue;
          ctx.fillStyle = line.text.includes("[") ? "#00ff66" : "rgba(0, 200, 80, 0.7)";
          ctx.fillText(line.text.trim(), slot.start, baselineY);
          cur1 = line.end;
        }
      }

      const slots2 = subtractRanges(LOGICAL_WIDTH / 2 + 40, LOGICAL_WIDTH - 80, blocked);
      for (const slot of slots2) {
        const slotWidth = slot.end - slot.start;
        let line = layoutNextLine(PREP_2, cur2, slotWidth);
        if (!line) { cur2 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_2, cur2, slotWidth); }
        if (line) {
          if (line.start.segmentIndex === line.end.segmentIndex && line.start.graphemeIndex === line.end.graphemeIndex) continue;
          ctx.fillStyle = line.text.includes("[") ? "#00ff66" : "rgba(0, 200, 80, 0.7)";
          ctx.fillText(line.text.trim(), slot.start, baselineY);
          cur2 = line.end;
        }
      }
    }
    
    for (const j of jellies) {
      j.draw(ctx, time);
    }
    
    techOverlay.update(time);
    techOverlay.draw(ctx, time);
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);