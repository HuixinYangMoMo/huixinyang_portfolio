import { prepareWithSegments, layoutNextLine } from "@chenglou/pretext";

const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const LINE_HEIGHT = 24;
const FONT = '12.5px "SF Mono", Menlo, Consolas, monospace';
const MIN_SLOT_WIDTH = 120;

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
// 1. Data & Text Configuration (Flowing Stream Data)
// --------------------------------------------------------
const TEXT_1 = `[ BIO_DATA: SCYPHOZOA ]\n\nOrganism exhibits pronounced glowing behavior when disturbed. The bell diameter ranges from 40-60cm, characterized by transparent blueish hues.\n\nObservation of propulsion mechanisms reveals a highly efficient jet-like cycle. Energy expenditure is minimal. Trailing tentacles span up to 3 meters, lined with microscopic stinging cells for capturing zooplankton.\n\n[ FLUID DYNAMICS ]\n\nBy expanding and contracting its coronal bell, the entity creates localized vortex rings. This method of locomotion minimizes drag and allows for sustained suspension in high-pressure abyssal zones.\n\n`.repeat(50);

const TEXT_2 = `[ SYSTEM_OVERRIDE_ACTIVE ]\n\nINITIATING DATA STREAM ANALYSIS...\n\nSubject demonstrates anomalous regenerative capabilities. Cellular structure remains stable under extreme pressure. Recommended for further extraction and synthesis.\n\n[ NEURAL MAPPING ]\n\nUnlike centralized nervous systems, this organism utilizes a distributed nerve net. Instantaneous reflexive responses to hydrodynamic shifts are achieved via sub-millisecond signal propagation. Sensory organs located at the bell margin detect light, gravity, and chemical signatures.\n\n`.repeat(50);

const PREP_1 = prepareWithSegments(TEXT_1, FONT, { whiteSpace: 'pre-wrap' });
const PREP_2 = prepareWithSegments(TEXT_2, FONT, { whiteSpace: 'pre-wrap' });

// --------------------------------------------------------
// 2. Asset Loader & Collision Map
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

function computeAlphaRows(image) {
  if (!image) return { width: 960, height: 960, rows: new Array(960).fill({left: -1, right: -1}) };
  const canvas = document.createElement("canvas");
  const w = image.naturalWidth || 960;
  const h = image.naturalHeight || 960;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const rows = new Array(h).fill(null);

  for (let y = 0; y < h; y += 1) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 10) { left = x; break; }
    }
    if (left !== -1) {
      for (let x = w - 1; x >= 0; x -= 1) {
        if (data[(y * w + x) * 4 + 3] > 10) { right = x; break; }
      }
    }
    rows[y] = { left, right };
  }
  return { width: w, height: h, rows };
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
// 3. Jellyfish Entity
// --------------------------------------------------------
class Jellyfish {
  constructor(key, animData, config) {
    this.key = key;
    this.frames = animData.frames;
    this.fps = animData.fps;
    
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
    this.alphaMap = computeAlphaRows(this.frames[0]);
    
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    this.x = this.baseX + Math.sin(t) * this.amplitudeX;
    this.y = this.baseY + Math.sin(t * 0.73) * this.amplitudeY; 
    
    this.vx = Math.cos(t) * this.speed * this.amplitudeX;
    this.vy = Math.cos(t * 0.73) * this.speed * 0.73 * this.amplitudeY;
  }
  
  getMaskRange(yPos) {
    const localY = yPos - this.y;
    if (localY < 0 || localY >= this.height) return null;
    
    const imageY = Math.max(0, Math.min(this.alphaMap.height - 1, Math.floor((localY / this.height) * this.alphaMap.height)));
    const row = this.alphaMap.rows[imageY];
    
    if (!row || row.left === -1) return null;
    
    const padding = 35; // Push text comfortably away
    return {
      start: this.x + (row.left / this.alphaMap.width) * this.width - padding,
      end: this.x + (row.right / this.alphaMap.width) * this.width + padding
    };
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
    ctx.restore();
  }
}

// --------------------------------------------------------
// 4. Main Rendering Logic
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

  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    lastTime = time;
    
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Background Tech Grid
    ctx.strokeStyle = "rgba(100, 150, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_HEIGHT); }
    for (let y = 0; y <= LOGICAL_HEIGHT; y += 60) { ctx.moveTo(0, y); ctx.lineTo(LOGICAL_WIDTH, y); }
    ctx.stroke();

    for (const j of jellies) {
      j.update(time);
    }
    
    // ==========================================
    // FLOWING TEXT STREAMS (Paragraph Layout)
    // ==========================================
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    
    const SCROLL_SPEED = 18; // Pixels per second upwards
    const totalScroll = time * SCROLL_SPEED;
    const scrolledLines = Math.floor(totalScroll / LINE_HEIGHT);
    const yOffset = totalScroll % LINE_HEIGHT;

    // Fast-forward cursor to simulate continuous scrolling text
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

    // Render the visible text columns
    // We start slightly above the screen to hide the line popping in
    for (let baselineY = -20 - yOffset; baselineY <= LOGICAL_HEIGHT + 60; baselineY += LINE_HEIGHT) {
      
      // Column 1: Organic Wavy Borders
      let s1_start = 120 + Math.sin(baselineY * 0.008 - time * 0.5) * 30;
      let s1_end = LOGICAL_WIDTH / 2 - 60 + Math.cos(baselineY * 0.005 + time * 0.6) * 30;
      
      // Column 2: Organic Wavy Borders
      let s2_start = LOGICAL_WIDTH / 2 + 60 + Math.sin(baselineY * 0.007 + time * 0.4) * 30;
      let s2_end = LOGICAL_WIDTH - 120 + Math.cos(baselineY * 0.006 - time * 0.5) * 30;

      // Collision masks from jellies
      const blocked = jellies.map(j => j.getMaskRange(baselineY - LINE_HEIGHT * 0.4)).filter(Boolean);

      // Render Column 1
      const slots1 = subtractRanges(s1_start, s1_end, blocked);
      for (const slot of slots1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(slot.start, baselineY - LINE_HEIGHT, slot.end - slot.start, LINE_HEIGHT + 10);
        ctx.clip(); // Prevent word overflow
        
        let line = layoutNextLine(PREP_1, cur1, slot.end - slot.start);
        if (!line) { cur1 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_1, cur1, slot.end - slot.start); }
        if (line) {
          ctx.fillStyle = line.text.includes("[") ? "rgba(255, 255, 255, 0.95)" : "rgba(160, 200, 255, 0.65)";
          if(line.text.trim() !== "") ctx.fillText(line.text, slot.start, baselineY);
          cur1 = line.end;
        }
        ctx.restore();
      }

      // Render Column 2
      const slots2 = subtractRanges(s2_start, s2_end, blocked);
      for (const slot of slots2) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(slot.start, baselineY - LINE_HEIGHT, slot.end - slot.start, LINE_HEIGHT + 10);
        ctx.clip(); // Prevent word overflow
        
        let line = layoutNextLine(PREP_2, cur2, slot.end - slot.start);
        if (!line) { cur2 = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(PREP_2, cur2, slot.end - slot.start); }
        if (line) {
          ctx.fillStyle = line.text.includes("[") ? "rgba(255, 255, 255, 0.95)" : "rgba(160, 200, 255, 0.65)";
          if(line.text.trim() !== "") ctx.fillText(line.text, slot.start, baselineY);
          cur2 = line.end;
        }
        ctx.restore();
      }
    }
    
    // Draw Jellies on top
    for (const j of jellies) {
      j.draw(ctx, time);
    }
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);