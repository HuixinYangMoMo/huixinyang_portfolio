import { prepareWithSegments, layoutNextLine } from "{{ '/assets/vendor/pretext/layout.js' | relative_url }}";

const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const LINE_HEIGHT = 18;
const FONT = '11.5px "SF Mono", Menlo, Consolas, monospace';
const MIN_SLOT_WIDTH = 80;

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
// 1. Data & Text Configuration (Specimen Manual Vibe)
// --------------------------------------------------------
const TEXT_1 = `[ BIO_DATA: SCYPHOZOA ]\n\nOrganism exhibits pronounced glowing behavior when disturbed. The bell diameter ranges from 40-60cm, characterized by transparent blueish hues.\n\nObservation of propulsion mechanisms reveals a highly efficient jet-like cycle. Energy expenditure is minimal. Trailing tentacles span up to 3 meters, lined with microscopic stinging cells for capturing zooplankton.\n\n[ FLUID DYNAMICS ]\n\nBy expanding and contracting its coronal bell, the entity creates localized vortex rings. This method of locomotion minimizes drag and allows for sustained suspension in high-pressure abyssal zones.\n\n`.repeat(50);

const TEXT_2 = `[ SYSTEM_OVERRIDE_ACTIVE ]\n\nINITIATING DATA STREAM ANALYSIS...\n\nSubject demonstrates anomalous regenerative capabilities. Cellular structure remains stable under extreme pressure. Recommended for further extraction and synthesis.\n\n[ NEURAL MAPPING ]\n\nUnlike centralized nervous systems, this organism utilizes a distributed nerve net. Instantaneous reflexive responses to hydrodynamic shifts are achieved via sub-millisecond signal propagation. Sensory organs located at the bell margin detect light, gravity, and chemical signatures.\n\n`.repeat(50);

const PREP_1 = prepareWithSegments(TEXT_1, FONT, { whiteSpace: 'pre-wrap' });
const PREP_2 = prepareWithSegments(TEXT_2, FONT, { whiteSpace: 'pre-wrap' });

// --------------------------------------------------------
// 2. Asset Loader
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

async function loadFrameSet(baseUrl) {
  const response = await fetch(`${baseUrl}/manifest.json${ASSET_VERSION}`);
  if (!response.ok) throw new Error(`Failed to load manifest: ${baseUrl}`);
  const manifest = await response.json();
  const frames = [];
  
  // Wait for all frames to load for perfectly smooth animation
  const loadPromises = manifest.frames.map(frameName => 
    loadImage(`${baseUrl}/${frameName}${ASSET_VERSION}`)
  );
  
  const loadedFrames = await Promise.all(loadPromises);
  frames.push(...loadedFrames);
  
  return { 
    frames, 
    fps: manifest.fps || 8, 
    naturalWidth: frames[0]?.naturalWidth || 960, 
    naturalHeight: frames[0]?.naturalHeight || 960 
  };
}

// --------------------------------------------------------
// 3. Collision Logic
// --------------------------------------------------------
function getBlockedRangesForY(maskData, y, width, padding) {
    const ranges = [];
    let inBlock = false;
    let start = 0;
    
    const y1 = Math.max(0, Math.floor(y - 12));
    const y2 = Math.max(0, Math.floor(y - 6));
    const y3 = Math.max(0, Math.floor(y));
    
    const o1 = y1 * width * 4;
    const o2 = y2 * width * 4;
    const o3 = y3 * width * 4;
    
    for (let x = 0; x < width; x++) {
        const a1 = maskData[o1 + x * 4 + 3];
        const a2 = maskData[o2 + x * 4 + 3];
        const a3 = maskData[o3 + x * 4 + 3];
        
        if (a1 > 10 || a2 > 10 || a3 > 10) {
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

function fillJustifiedText(ctx, lineText, x, y, targetWidth) {
    const isHardBreak = lineText.endsWith('\n');
    const text = lineText.trim();
    if (!text) return;
    
    const words = text.split(' ');
    if (words.length <= 1 || isHardBreak) {
        ctx.fillText(text, x, y);
        return;
    }
    
    const textWidth = ctx.measureText(text).width;
    const totalSpaces = words.length - 1;
    const extraSpace = (targetWidth - textWidth) / totalSpaces;
    
    if (extraSpace > 25) { // Too much gap, looks unnatural
        ctx.fillText(text, x, y);
        return;
    }
    
    let curX = x;
    for (let i = 0; i < words.length; i++) {
        ctx.fillText(words[i], curX, y);
        curX += ctx.measureText(words[i]).width;
        if (i < words.length - 1) {
            curX += ctx.measureText(' ').width + extraSpace;
        }
    }
}

// --------------------------------------------------------
// 4. UI and Rendering Entities
// --------------------------------------------------------
class Jellyfish {
  constructor(key, animData, config) {
    this.key = key;
    this.frames = animData.frames;
    this.fps = animData.fps;
    
    // Scale down from 960x960
    this.width = animData.naturalWidth * config.scale;
    this.height = animData.naturalHeight * config.scale;
    
    this.baseX = config.x;
    this.baseY = config.y;
    
    this.speed = config.speed;
    this.phase = config.phase;
    this.amplitudeX = config.amplitudeX;
    this.amplitudeY = config.amplitudeY;
    
    this.timeOffset = Math.random() * 100;
    this.opacity = config.opacity || 1.0;
    
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    // Lissajous curve for smooth, non-repeating natural movement
    this.x = this.baseX + Math.sin(t) * this.amplitudeX;
    this.y = this.baseY + Math.sin(t * 0.73) * this.amplitudeY; 
    
    this.vx = Math.cos(t) * this.speed * this.amplitudeX;
    this.vy = Math.cos(t * 0.73) * this.speed * 0.73 * this.amplitudeY;
  }
  
  drawMask(ctx, time) {
    if (!this.frames || this.frames.length === 0) return;
    const t = time + this.timeOffset;
    const frameIdx = Math.floor((t * this.fps)) % this.frames.length;
    const frame = this.frames[frameIdx];
    
    ctx.save();
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2);
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05);
    
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
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2); 
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05);
    
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = "screen";
    
    ctx.drawImage(frame, -this.width/2, -this.height/2, this.width, this.height);
    
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width/3);
    grad.addColorStop(0, `rgba(200, 230, 255, ${this.opacity * 0.3})`);
    grad.addColorStop(1, "rgba(200, 230, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fill();
    
    ctx.restore();
  }
}

// Background glowing vertical streams
class BokehStream {
  constructor(x) {
    this.x = x;
    this.speed = Math.random() * 20 + 10;
    this.particles = Array.from({length: 15}, () => ({
      y: Math.random() * LOGICAL_HEIGHT,
      r: Math.random() * 8 + 2,
      opacity: Math.random() * 0.5 + 0.1,
      phase: Math.random() * Math.PI * 2
    }));
  }
  
  update(dt, time) {
    for (const p of this.particles) {
      p.y -= this.speed * dt;
      if (p.y < -50) {
        p.y = LOGICAL_HEIGHT + 50;
      }
    }
  }
  
  draw(ctx, time) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const p of this.particles) {
      const sway = Math.sin(time + p.phase) * 15;
      const glow = (Math.sin(time * 2 + p.phase) + 1) / 2 * p.opacity;
      
      ctx.beginPath();
      ctx.arc(this.x + sway, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(180, 210, 255, ${glow})`;
      ctx.shadowColor = "rgba(180, 210, 255, 0.8)";
      ctx.shadowBlur = p.r * 2;
      ctx.fill();
    }
    ctx.restore();
  }
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
  
  // Create an offscreen canvas specifically for pixel-perfect mask detection
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = LOGICAL_WIDTH;
  maskCanvas.height = LOGICAL_HEIGHT;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  
  const jellies = [
    new Jellyfish('cyan', cyanAnim, {
      scale: 0.6, x: 650, y: 350, 
      speed: 0.35, phase: 0, amplitudeX: 200, amplitudeY: 150, opacity: 0.95
    }),
    new Jellyfish('pink', pinkAnim, {
      scale: 0.45, x: 250, y: 550, 
      speed: 0.5, phase: 2, amplitudeX: 180, amplitudeY: 100, opacity: 0.85
    }),
    new Jellyfish('violet', violetAnim, {
      scale: 0.5, x: 1050, y: 200, 
      speed: 0.4, phase: 4, amplitudeX: 150, amplitudeY: 200, opacity: 0.9
    })
  ];

  const streams = [
    new BokehStream(250), new BokehStream(450), 
    new BokehStream(850), new BokehStream(1250)
  ];
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    // Update logic
    for (const s of streams) s.update(dt, time);
    for (const j of jellies) j.update(time);
    
    // Offscreen Pixel-Perfect Mask Rendering
    maskCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    for (const j of jellies) j.drawMask(maskCtx, time);
    const maskData = maskCtx.getImageData(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).data;

    // Render Base
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Background Layer
    ctx.strokeStyle = "rgba(100, 150, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_HEIGHT); }
    for (let y = 0; y <= LOGICAL_HEIGHT; y += 60) { ctx.moveTo(0, y); ctx.lineTo(LOGICAL_WIDTH, y); }
    ctx.stroke();

    for (const s of streams) s.draw(ctx, time);
    
    // Midground Layer - TEXT WRAPPING
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    
    let cur1 = { segmentIndex: 0, graphemeIndex: 0 };
    let cur2 = { segmentIndex: 0, graphemeIndex: 0 };
    
    for (let baselineY = 60; baselineY <= LOGICAL_HEIGHT - 60; baselineY += LINE_HEIGHT) {
      const blocked = getBlockedRangesForY(maskData, baselineY, LOGICAL_WIDTH, 14); // 14px 严丝合缝 padding
      
      // Column 1
      const slots1 = subtractRanges(120, LOGICAL_WIDTH / 2 - 30, blocked);
      for (const slot of slots1) {
        const slotWidth = slot.end - slot.start;
        let line = layoutNextLine(PREP_1, cur1, slotWidth);
        if (!line) { cur1 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_1, cur1, slotWidth); }
        if (line) {
          if (line.start.segmentIndex === line.end.segmentIndex && line.start.graphemeIndex === line.end.graphemeIndex) continue;
          ctx.fillStyle = line.text.includes("[") ? "rgba(255, 255, 255, 0.95)" : "rgba(140, 180, 255, 0.6)";
          fillJustifiedText(ctx, line.text, slot.start, baselineY, slotWidth);
          cur1 = line.end;
        }
      }

      // Column 2
      const slots2 = subtractRanges(LOGICAL_WIDTH / 2 + 30, LOGICAL_WIDTH - 120, blocked);
      for (const slot of slots2) {
        const slotWidth = slot.end - slot.start;
        let line = layoutNextLine(PREP_2, cur2, slotWidth);
        if (!line) { cur2 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_2, cur2, slotWidth); }
        if (line) {
          if (line.start.segmentIndex === line.end.segmentIndex && line.start.graphemeIndex === line.end.graphemeIndex) continue;
          ctx.fillStyle = line.text.includes("[") ? "rgba(255, 255, 255, 0.95)" : "rgba(140, 180, 255, 0.6)";
          fillJustifiedText(ctx, line.text, slot.start, baselineY, slotWidth);
          cur2 = line.end;
        }
      }
    }
    
    // Foreground Layer - Jellies
    for (const j of jellies) {
      j.draw(ctx, time);
    }
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);