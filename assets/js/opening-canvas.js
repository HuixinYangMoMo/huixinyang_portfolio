import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";

const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
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
const BIO_DATA_1 = `SPECIMEN A-1: CYAN_GLIDE_01
---------------------------------
CLASS: SCYPHOZOA (DEEP TRENCH)
LUMINESCENCE: 98% EFFICIENCY

Observation indicates a highly specialized chromatophore structure. Energy is converted directly into photonic emission with near zero thermal loss. The organism exhibits synchronized pulsing when exposed to kinetic stimuli.

Recommended for further extraction and synthesis of advanced optical fibers.`;

const BIO_DATA_2 = `NEURAL DISTRIBUTION & SYNAPTIC PATHWAYS
---------------------------------------
Unlike centralized systems, this entity utilizes a fully distributed nerve net. Instantaneous reflexive responses to hydrodynamic shifts are achieved via sub-millisecond signal propagation. 

Sensory organs located at the bell margin detect light, gravity, and chemical signatures. Tentacular extensions demonstrate autonomous hunting behaviors.`;

const BIO_DATA_3 = `FLUID DYNAMICS & PROPULSION
---------------------------
By expanding and contracting its coronal bell, the entity creates localized vortex rings. This method of locomotion minimizes drag and allows for sustained suspension in high-pressure abyssal zones.

Current depth capacity exceeds standard submersible tolerances by a factor of 4.2x.`;

const BIO_DATA_4 = `SYSTEM_OVERRIDE_ACTIVE...
INITIATING DATA STREAM...
> ANOMALOUS REGENERATIVE CAPABILITIES DETECTED
> CELLULAR STRUCTURE: STABLE
> PRESSURE TOLERANCE: MAXIMUM
...
END OF TRANSMISSION.`;

// Prepare typography with Pretext (handles \n via pre-wrap)
const FONT_BODY = '11px "SF Mono", Menlo, monospace';
const PREPARED_1 = prepareWithSegments(BIO_DATA_1, FONT_BODY, { whiteSpace: 'pre-wrap' });
const PREPARED_2 = prepareWithSegments(BIO_DATA_2, FONT_BODY, { whiteSpace: 'pre-wrap' });
const PREPARED_3 = prepareWithSegments(BIO_DATA_3, FONT_BODY, { whiteSpace: 'pre-wrap' });
const PREPARED_4 = prepareWithSegments(BIO_DATA_4, FONT_BODY, { whiteSpace: 'pre-wrap' });

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

// Since the images were processed with Python earlier, they are already transparent PNGs.
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
// 3. UI and Rendering Entities
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
  
  draw(ctx, time) {
    if (!this.frames || this.frames.length === 0) return;
    
    const t = time + this.timeOffset;
    const frameIdx = Math.floor((t * this.fps)) % this.frames.length;
    const frame = this.frames[frameIdx];
    
    ctx.save();
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    
    // Rotate based on velocity vector
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2); // Adjust base orientation
    
    // Extra slight organic sway
    ctx.rotate(Math.sin(time * 1.5 + this.phase) * 0.05);
    
    // Photographic / glowing blend mode
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = "screen";
    
    ctx.drawImage(frame, -this.width/2, -this.height/2, this.width, this.height);
    
    // Add extra center glow
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width/3);
    grad.addColorStop(0, `rgba(200, 230, 255, ${this.opacity * 0.3})`);
    grad.addColorStop(1, "rgba(200, 230, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fill();
    
    ctx.restore();
  }
}

// Background glowing vertical streams (bokeh effect)
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
// 4. Main Rendering Logic
// --------------------------------------------------------
function drawTechGrid(ctx, time) {
  ctx.save();
  ctx.strokeStyle = "rgba(100, 150, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= LOGICAL_WIDTH; x += 60) {
      ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_HEIGHT);
  }
  for (let y = 0; y <= LOGICAL_HEIGHT; y += 60) {
      ctx.moveTo(0, y); ctx.lineTo(LOGICAL_WIDTH, y);
  }
  ctx.stroke();
  
  // Crosshairs at intersections
  ctx.strokeStyle = "rgba(150, 200, 255, 0.2)";
  ctx.beginPath();
  for (let x = 120; x <= LOGICAL_WIDTH-120; x += 240) {
    for (let y = 120; y <= LOGICAL_HEIGHT-120; y += 240) {
      ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y);
      ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawMiniGraph(ctx, x, y, time, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(120, 200, 255, 0.6)";
  ctx.lineWidth = 1;
  
  // Axis
  ctx.beginPath();
  ctx.moveTo(0, 30); ctx.lineTo(100, 30);
  ctx.moveTo(0, 30); ctx.lineTo(0, 0);
  ctx.strokeStyle = "rgba(120, 200, 255, 0.3)";
  ctx.stroke();
  
  // Waveform
  ctx.beginPath();
  ctx.strokeStyle = "rgba(120, 200, 255, 0.8)";
  for(let i=0; i<=100; i+=2) {
      let val = Math.sin(time*3 + i*0.1 + seed) * 10 + Math.sin(time*7 + i*0.3) * 4;
      if(i===0) ctx.moveTo(i, 15 - val);
      else ctx.lineTo(i, 15 - val);
  }
  ctx.stroke();
  
  ctx.restore();
}

function drawTextPanel(ctx, preparedText, x, y, width, height, titleStr) {
  ctx.save();
  
  // Draw Panel Border
  ctx.strokeStyle = "rgba(120, 180, 255, 0.15)";
  ctx.fillStyle = "rgba(10, 20, 35, 0.4)"; // Slight dark backing
  ctx.beginPath();
  ctx.rect(x - 15, y - 15, width + 30, height + 30);
  ctx.fill();
  ctx.stroke();
  
  // Corner accents
  ctx.strokeStyle = "rgba(150, 200, 255, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 15, y); ctx.lineTo(x - 15, y - 15); ctx.lineTo(x, y - 15); // Top Left
  ctx.moveTo(x + width, y - 15); ctx.lineTo(x + width + 15, y - 15); ctx.lineTo(x + width + 15, y); // Top Right
  ctx.moveTo(x - 15, y + height - 15); ctx.lineTo(x - 15, y + height + 15); ctx.lineTo(x, y + height + 15); // Bottom Left
  ctx.stroke();
  
  // Small aesthetic data point
  ctx.fillStyle = "rgba(120, 180, 255, 0.8)";
  ctx.font = '9px "SF Mono", Menlo, monospace';
  ctx.fillText(titleStr, x, y - 22);

  // Pretext Rendering
  const { lines } = layoutWithLines(preparedText, width, 18);
  ctx.font = FONT_BODY;
  ctx.fillStyle = "rgba(200, 225, 255, 0.85)";
  
  for(let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i].text, x, y + i * 18 + 12); // +12 for alphabetic baseline adjustment
  }
  
  ctx.restore();
}

function drawConnectingLine(ctx, x1, y1, x2, y2, time) {
  ctx.save();
  ctx.strokeStyle = "rgba(150, 200, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  
  // Create an angled, tech-like path (horizontal then vertical/diagonal)
  const midX = x1 + (x2 - x1) * 0.5;
  ctx.lineTo(midX, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  // Moving blip on the line
  const progress = (time * 0.5) % 1;
  let blipX, blipY;
  if (progress < 0.5) {
    const t = progress * 2;
    blipX = x1 + (midX - x1) * t;
    blipY = y1;
  } else {
    const t = (progress - 0.5) * 2;
    blipX = midX + (x2 - midX) * t;
    blipY = y1 + (y2 - y1) * t;
  }
  
  ctx.beginPath();
  ctx.arc(blipX, blipY, 2.5, 0, Math.PI*2);
  ctx.fillStyle = "rgba(200, 240, 255, 0.9)";
  ctx.shadowColor = "rgba(200, 240, 255, 1)";
  ctx.shadowBlur = 5;
  ctx.fill();
  
  // End circle
  ctx.beginPath();
  ctx.arc(x1, y1, 4, 0, Math.PI*2);
  ctx.strokeStyle = "rgba(150, 200, 255, 0.8)";
  ctx.stroke();
  
  ctx.restore();
}

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
  
  // 3 Jellyfishes
  const jellies = [
    new Jellyfish('cyan', cyanAnim, {
      scale: 0.5, x: 720, y: 350, 
      speed: 0.4, phase: 0, amplitudeX: 150, amplitudeY: 100, opacity: 0.95
    }),
    new Jellyfish('pink', pinkAnim, {
      scale: 0.4, x: 300, y: 600, 
      speed: 0.6, phase: 2, amplitudeX: 120, amplitudeY: 80, opacity: 0.85
    }),
    new Jellyfish('violet', violetAnim, {
      scale: 0.45, x: 1100, y: 250, 
      speed: 0.5, phase: 4, amplitudeX: 100, amplitudeY: 150, opacity: 0.9
    })
  ];

  // Vertical Bokeh Streams
  const streams = [
    new BokehStream(250), new BokehStream(450), 
    new BokehStream(850), new BokehStream(1250)
  ];
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Background Layer
    drawTechGrid(ctx, time);
    
    for (const s of streams) {
      s.update(dt, time);
      s.draw(ctx, time);
    }
    
    // Jellies update
    for (const j of jellies) {
      j.update(time);
    }
    
    // Midground Layer - Connections & Jellies
    // Draw line from jelly 0 to Panel 1
    drawConnectingLine(ctx, jellies[0].x + jellies[0].width/2, jellies[0].y + jellies[0].height/2, 100, 150, time);
    // Draw line from jelly 1 to Panel 2
    drawConnectingLine(ctx, jellies[1].x + jellies[1].width/2, jellies[1].y + jellies[1].height/2, 100, 600, time + 2);
    // Draw line from jelly 2 to Panel 3
    drawConnectingLine(ctx, jellies[2].x + jellies[2].width/2, jellies[2].y + jellies[2].height/2, 1060, 550, time + 4);
    
    // Draw jellies
    for (const j of jellies) {
      j.draw(ctx, time);
    }
    
    // Foreground Layer - UI & Typography
    drawTextPanel(ctx, PREPARED_1, 100, 150, 320, 160, "SYS.DAT.01 / LOCATION: TRENCH");
    drawMiniGraph(ctx, 100, 340, time, 0);
    
    drawTextPanel(ctx, PREPARED_2, 100, 600, 320, 140, "SYS.DAT.02 / NEURAL MAPPING");
    
    drawTextPanel(ctx, PREPARED_3, 1060, 550, 300, 140, "SYS.DAT.03 / DYNAMICS");
    drawMiniGraph(ctx, 1060, 720, time, 10);
    
    drawTextPanel(ctx, PREPARED_4, 1060, 120, 280, 120, "OVERRIDE / SECURE");
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);