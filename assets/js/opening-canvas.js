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
  
  // To avoid stuttering in animation, wait for all frames to load
  const loadPromises = manifest.frames.map(frameName => 
    loadImage(`${baseUrl}/${frameName}${ASSET_VERSION}`)
  );
  
  const loadedFrames = await Promise.all(loadPromises);
  frames.push(...loadedFrames);
  
  const animData = { 
    frames, 
    fps: manifest.fps || 8, 
    naturalWidth: frames[0]?.naturalWidth || 960, 
    naturalHeight: frames[0]?.naturalHeight || 960 
  };
  
  return animData;
}

// Compute alpha map for collision detection
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
  const width = imgData.width;
  const height = imgData.height;
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
    this.alphaMap = computeAlphaRows(this.frames && this.frames.length > 0 ? this.frames[0] : null);
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
    if (!this.frames || this.frames.length === 0) return;
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

// Remove pretext dependency to guarantee maximum stability and cross-browser compatibility.
// We implement a robust custom line wrapper below.
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
  
  // Paragraph Layout logic without pretext
  // 按照生物科普说明书的科技感进行重新设计排版
  
  // Biological text paragraphs
  const paragraphs = [
    "CYAN_GLIDE_01: SPECIMEN ANALYSIS",
    "Bioluminescent species found in deep trench zones. Exhibits pronounced glowing behavior when disturbed.",
    "The bell diameter ranges from 40-60cm, characterized by transparent blueish hues.",
    "",
    "PINK_PULSE_02: FLUID DYNAMICS",
    "Observation of propulsion mechanisms reveals a highly efficient jet-like cycle. Energy expenditure is minimal.",
    "Trailing tentacles span up to 3 meters, lined with microscopic stinging cells for capturing zooplankton.",
    "",
    "VIOLET_SWAY_03: NEURAL NETWORKS",
    "Unlike centralized nervous systems, this organism utilizes a distributed nerve net.",
    "Sensory organs located at the bell margin detect light, gravity, and chemical signatures.",
    "",
    "SYSTEM_OVERRIDE_ACTIVE...",
    "INITIATING DATA STREAM ANALYSIS...",
    "Subject demonstrates anomalous regenerative capabilities. Cellular structure remains stable under extreme pressure.",
    "Recommended for further extraction and synthesis.",
    "...",
    "END OF TRANSMISSION."
  ];

  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    lastTime = time;
    
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Draw grid background (tech manual vibe)
    ctx.strokeStyle = "rgba(100, 150, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_WIDTH; x += 100) {
        ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_HEIGHT);
    }
    for (let y = 0; y <= LOGICAL_HEIGHT; y += 100) {
        ctx.moveTo(0, y); ctx.lineTo(LOGICAL_WIDTH, y);
    }
    ctx.stroke();

    // Corner tech UI elements
    ctx.strokeStyle = "rgba(180, 210, 255, 0.4)";
    ctx.beginPath();
    ctx.moveTo(30, 50); ctx.lineTo(30, 30); ctx.lineTo(50, 30);
    ctx.moveTo(LOGICAL_WIDTH-50, 30); ctx.lineTo(LOGICAL_WIDTH-30, 30); ctx.lineTo(LOGICAL_WIDTH-30, 50);
    ctx.moveTo(30, LOGICAL_HEIGHT-50); ctx.lineTo(30, LOGICAL_HEIGHT-30); ctx.lineTo(50, LOGICAL_HEIGHT-30);
    ctx.stroke();

    // Update jellies
    for (const j of jellies) {
      j.update(time);
    }
    
    // Typography layout avoiding jellies
    ctx.font = FONT;
    ctx.textBaseline = "alphabetic";
    
    let currentPara = 0;
    let wordIndex = 0;
    let words = paragraphs[currentPara].split(' ');
    
    for (let baselineY = TOP_MARGIN; baselineY <= LOGICAL_HEIGHT - BOTTOM_MARGIN; baselineY += LINE_HEIGHT) {
      const baseStart = LEFT_MARGIN + 20; // Indent slightly
      const baseEnd = LOGICAL_WIDTH - RIGHT_MARGIN - 20;

      // Get collision masks from jellies
      const blockedRanges = jellies.map(j => j.getMaskRange(baselineY - LINE_HEIGHT * 0.4)).filter(Boolean);
      
      const slots = subtractRanges(baseStart, baseEnd, blockedRanges);
      if (slots.length === 0) continue;

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const slot = slots[slotIndex];
        let cursorX = slot.start;
        
        // Tone styling
        let alpha = 0.8;
        if (paragraphs[currentPara] === "") alpha = 0; // Empty line
        else if (paragraphs[currentPara].includes(":")) {
             alpha = 0.95; // Heading
             ctx.font = `700 ${FONT_SIZE+1}px ${FONT_FAMILY}`;
        } else {
             alpha = 0.6; // Body
             ctx.font = FONT;
        }

        ctx.fillStyle = `rgba(180, 210, 255, ${alpha})`;
        
        // Fill words in this slot
        while (currentPara < paragraphs.length) {
            if (paragraphs[currentPara] === "") {
                currentPara++;
                if(currentPara < paragraphs.length) words = paragraphs[currentPara].split(' ');
                break; // move to next line
            }

            if (wordIndex >= words.length) {
                currentPara++;
                if(currentPara >= paragraphs.length) {
                    currentPara = 0; // Loop text
                }
                words = paragraphs[currentPara].split(' ');
                break; // New line per paragraph
            }

            const word = words[wordIndex];
            const wordWidth = ctx.measureText(word + " ").width;

            if (cursorX + wordWidth <= slot.end) {
                // Gentle floating wave on text
                const waveY = Math.sin(cursorX * 0.01 + time * 2) * 1.5;
                ctx.fillText(word, cursorX, baselineY + waveY);
                cursorX += wordWidth;
                wordIndex++;
            } else {
                // Word doesn't fit in this slot
                break;
            }
        }
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