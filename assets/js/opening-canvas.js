const LOGICAL_WIDTH = 1000;
const LOGICAL_HEIGHT = 780;
const TOP_MARGIN = 74;
const BOTTOM_MARGIN = 72;
const LEFT_MARGIN = 58;
const RIGHT_MARGIN = 58;
const LINE_HEIGHT = 15.1;
const FONT_SIZE = 12.8;
const FONT_FAMILY = "Menlo, SFMono-Regular, SF Mono, Roboto Mono, monospace";
const FONT = `500 ${FONT_SIZE}px ${FONT_FAMILY}`;
const MIN_SLOT_WIDTH = 92;
const START_CURSOR = { segmentIndex: 0, graphemeIndex: 0 };
const ASSET_VERSION =
  typeof window !== "undefined" && window.__OPENING_ASSET_VERSION__
    ? `?v=${window.__OPENING_ASSET_VERSION__}`
    : "";

const FRAME_SETS = {
  cyan: `/images/opening/wavespeed/anim/cyan_glide`,
  pink: `/images/opening/wavespeed/anim/pink_pulse`,
  violet: `/images/opening/wavespeed/anim/violet_sway`,
};

const TOKENS = [
  "tide.loop", "jelly.core", "veil.null", "glow__bell",
  "drift.mesh", "plankton.13", "veil.alpha", "current.fold",
  "cyan.trace", "pulse.field", "buffer.open", "quiet.soft",
  "node.slow", "salt.memory", "mesh.break", "render.soft",
];

const TEXT_STREAM = Array.from({ length: 420 }, (_, index) => {
  const token = TOKENS[index % TOKENS.length];
  const suffix = String((index * 17) % 89).padStart(2, "0");
  return `${token}.${suffix}`;
}).join(" / ");

// Helper to load image
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Load a frame set
async function loadFrameSet(baseUrl) {
  const response = await fetch(`${baseUrl}/manifest.json${ASSET_VERSION}`);
  if (!response.ok) throw new Error(`Failed to load manifest: ${baseUrl}`);
  const manifest = await response.json();
  const frames = [];
  for (const frameName of manifest.frames) {
    const img = await loadImage(`${baseUrl}/${frameName}${ASSET_VERSION}`);
    frames.push(img);
  }
  return { frames, fps: manifest.fps || 8, naturalWidth: frames[0].naturalWidth, naturalHeight: frames[0].naturalHeight };
}

// Compute alpha map for collision detection
function computeAlphaRows(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, width, height);
  const rows = new Array(height).fill(null);

  for (let y = 0; y < height; y += 1) {
    let left = -1;
    let right = -1;

    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        left = x;
        break;
      }
    }

    if (left !== -1) {
      for (let x = width - 1; x >= 0; x -= 1) {
        if (data[(y * width + x) * 4 + 3] > 20) {
          right = x;
          break;
        }
      }
    }
    rows[y] = { left, right };
  }
  return { width, height, rows };
}

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
    
    // Pre-calculate collision map using the first frame
    this.alphaMap = computeAlphaRows(this.frames[0]);
    this.opacity = config.opacity || 1.0;
    
    // Current state for collision
    this.x = 0;
    this.y = 0;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    
    // Smooth organic path
    this.x = this.baseX + Math.sin(t) * this.amplitudeX + Math.sin(t * 2.1) * (this.amplitudeX * 0.3);
    this.y = this.baseY + Math.cos(t * 0.8) * this.amplitudeY + Math.sin(t * 1.5) * (this.amplitudeY * 0.2);
  }
  
  getMaskRange(yPos) {
    const localY = yPos - this.y;
    if (localY < 0 || localY >= this.height) return null;
    
    // Map localY to original image height
    const imageY = Math.max(0, Math.min(this.alphaMap.height - 1, Math.floor((localY / this.height) * this.alphaMap.height)));
    const row = this.alphaMap.rows[imageY];
    
    if (!row || row.left === -1) return null;
    
    // Add padding to mask
    const padding = 20;
    return {
      start: this.x + (row.left / this.alphaMap.width) * this.width - padding,
      end: this.x + (row.right / this.alphaMap.width) * this.width + padding
    };
  }
  
  draw(ctx, time) {
    const t = time + this.timeOffset;
    const frameIdx = Math.floor((t * this.fps)) % this.frames.length;
    const frame = this.frames[frameIdx];
    
    ctx.save();
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    
    // Slight sway
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05);
    
    ctx.globalAlpha = this.opacity;
    // Photographic blending
    ctx.globalCompositeOperation = "screen";
    
    ctx.drawImage(frame, -this.width/2, -this.height/2, this.width, this.height);
    ctx.restore();
  }
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

const prepareWithSegments = window.prepareWithSegments;
const layoutNextLine = window.layoutNextLine;

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

  // Load assets
  const [cyanAnim, pinkAnim, violetAnim] = await Promise.all([
    loadFrameSet(FRAME_SETS.cyan),
    loadFrameSet(FRAME_SETS.pink),
    loadFrameSet(FRAME_SETS.violet)
  ]);
  
  // 3 Jellyfishes instead of 4
  const jellies = [
    new Jellyfish('cyan', cyanAnim, {
      scale: 0.5, x: 280, y: 150, 
      speed: 0.8, phase: 0, amplitudeX: 80, amplitudeY: 60, opacity: 0.95
    }),
    new Jellyfish('pink', pinkAnim, {
      scale: 0.35, x: 120, y: 400, 
      speed: 1.1, phase: 2, amplitudeX: 50, amplitudeY: 40, opacity: 0.85
    }),
    new Jellyfish('violet', violetAnim, {
      scale: 0.4, x: 650, y: 350, 
      speed: 0.9, phase: 4, amplitudeX: 60, amplitudeY: 50, opacity: 0.9
    })
  ];
  
  // Use pretext to layout typography
  const prepared = prepareWithSegments(TEXT_STREAM, FONT);
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    lastTime = time;
    
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    for (const j of jellies) {
      j.update(time);
    }
    
    // Compute Text Layout avoiding jellies
    let cursor = { ...START_CURSOR };
    
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    
    for (let baselineY = TOP_MARGIN; baselineY <= LOGICAL_HEIGHT - BOTTOM_MARGIN; baselineY += LINE_HEIGHT) {
      // Create organic fluid container borders
      const leftWave = Math.sin(baselineY * 0.024 - time) * 18;
      const rightWave = Math.cos(baselineY * 0.02 + time) * 14;
      const baseStart = LEFT_MARGIN + leftWave;
      const baseEnd = LOGICAL_WIDTH - RIGHT_MARGIN + rightWave;

      // Get collision masks from jellies
      const blockedRanges = jellies.map(j => j.getMaskRange(baselineY - LINE_HEIGHT * 0.4)).filter(Boolean);
      
      const slots = subtractRanges(baseStart, baseEnd, blockedRanges);
      if (slots.length === 0) continue;

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const slot = slots[slotIndex];
        let line = layoutNextLine(prepared, cursor, slot.end - slot.start);

        if (line === null) {
          cursor = { ...START_CURSOR }; // Loop text
          line = layoutNextLine(prepared, cursor, slot.end - slot.start);
        }

        if (line === null) continue;

        // Draw line
        const x = slot.start + Math.sin(baselineY * 0.043 + time * 2 + slotIndex) * 2;
        
        // Tone
        let alpha = 0.74;
        if (baselineY < 150 || baselineY > 650) alpha = slotIndex % 2 === 0 ? 0.42 : 0.2;
        else alpha = slotIndex % 2 === 0 ? 0.92 : 0.42;

        ctx.fillStyle = `rgba(180, 210, 255, ${alpha})`;
        
        // Draw characters with subtle individual wave
        let charX = x;
        for (let i=0; i<line.text.length; i++) {
           const char = line.text[i];
           const waveY = Math.sin(charX * 0.02 + time * 3) * 1.5;
           ctx.fillText(char === " " ? "\u00A0" : char, charX, baselineY + waveY);
           charX += ctx.measureText(char).width;
        }

        cursor = line.end;
      }
    }
    
    // Draw Jellies on top (with screen blend mode)
    for (const j of jellies) {
      j.draw(ctx, time);
    }
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);