const LOGICAL_WIDTH = 1920;
const LOGICAL_HEIGHT = 1080;
const FONT_SIZE = 13;
const FONT = `500 ${FONT_SIZE}px Menlo, monospace`;

const ASSET_VERSION = typeof window !== "undefined" && window.__OPENING_ASSET_VERSION__ ? `?v=${window.__OPENING_ASSET_VERSION__}` : "";

const FRAME_SETS = {
  pink: `/images/opening/wavespeed/anim/pink_pulse`,
  cyan: `/images/opening/wavespeed/anim/cyan_glide`,
  violet: `/images/opening/wavespeed/anim/violet_sway`,
  bloom: `/images/opening/wavespeed/anim/cyan_bloom`,
};

const TOKENS = [
  "void.tide()", "jelly.sys", "veil.alpha", "drift.mesh",
  "glow__bell", "plankton.x", "current.fold", "buffer.flow"
];

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
  return { frames, fps: manifest.fps || 8 };
}

// Particle System - Text Strands
class TextStrand {
  constructor(text, x, y, depth) {
    this.text = text;
    this.baseX = x;
    this.baseY = y;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.depth = depth; // 0.1 (far) to 1.0 (near)
    
    // Deeper items are darker/more transparent, closer are brighter
    this.alpha = 0.05 + depth * 0.45;
    // Closer items are slightly larger/blurred differently
    this.scale = 0.8 + depth * 0.4;
    
    this.phase = Math.random() * Math.PI * 2;
  }
  
  update(jellies, time) {
    // Return to base slowly
    const dxBase = this.baseX - this.x;
    const dyBase = this.baseY - this.y;
    
    // Organic sway (deeper items sway slower and less)
    const swaySpeed = 0.3 * this.depth;
    const swayX = Math.sin(time * swaySpeed + this.phase) * (20 * this.depth);
    const swayY = Math.cos(time * (swaySpeed * 0.8) + this.phase) * (15 * this.depth);
    
    this.vx += (dxBase + swayX) * 0.005;
    this.vy += (dyBase + swayY) * 0.005;
    
    this.vx *= 0.88;
    this.vy *= 0.88;
    
    // Interact with jellies
    for (const j of jellies) {
      const dx = this.x - j.x;
      const dy = this.y - j.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      const pushRadius = j.size * 0.4;
      if (dist < pushRadius && dist > 0) {
        // Pushing force
        const force = (pushRadius - dist) / pushRadius;
        // Closer items get pushed more
        this.vx += (dx / dist) * force * 2.5 * this.depth;
        this.vy += (dy / dist) * force * 2.5 * this.depth;
      }
      
      // Wake (pull particles along the jelly's movement)
      if (dist < pushRadius * 1.8 && j.vx && j.vy) {
          const wakeForce = (pushRadius * 1.8 - dist) / (pushRadius * 1.8);
          this.vx += j.vx * wakeForce * 0.08 * this.depth;
          this.vy += j.vy * wakeForce * 0.08 * this.depth;
      }
    }
    
    this.x += this.vx;
    this.y += this.vy;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    
    // Slight rotation based on movement
    const rot = this.vx * 0.05;
    ctx.rotate(rot);
    
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(180, 210, 255, ${this.alpha})`;
    
    if (this.depth > 0.7) {
        ctx.shadowColor = "rgba(180, 210, 255, 0.4)";
        ctx.shadowBlur = 4;
    }
    
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

function initParticles() {
  const particles = [];
  const rows = 18;
  const cols = 12;
  
  const stepX = LOGICAL_WIDTH / cols;
  const stepY = LOGICAL_HEIGHT / rows;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Add some randomness to grid
      const px = c * stepX + (Math.random() * stepX);
      const py = r * stepY + (Math.random() * stepY);
      
      const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
      // Depth from 0.1 to 1.0
      const depth = Math.pow(Math.random(), 1.5); // More things in background
      
      particles.push(new TextStrand(token, px, py, depth));
    }
  }
  
  // Sort by depth so background items draw first
  particles.sort((a, b) => a.depth - b.depth);
  return particles;
}

// Jellyfish Entity
class Jellyfish {
  constructor(animData, scale, speed, pathPhase) {
    this.frames = animData.frames;
    this.fps = animData.fps;
    this.scale = scale;
    this.size = 960 * scale; // assuming 960x960 source
    this.speed = speed;
    this.phase = pathPhase;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.timeOffset = Math.random() * 100;
  }
  
  update(time) {
    const t = time * this.speed + this.phase;
    
    // Organic path
    const targetX = LOGICAL_WIDTH * 0.5 + Math.sin(t) * LOGICAL_WIDTH * 0.4 + Math.sin(t * 2.1) * 100;
    const targetY = LOGICAL_HEIGHT * 0.5 + Math.cos(t * 0.8) * LOGICAL_HEIGHT * 0.3 + Math.sin(t * 1.5) * 80;
    
    this.vx = targetX - this.x;
    this.vy = targetY - this.y;
    
    this.x = targetX;
    this.y = targetY;
  }
  
  draw(ctx, time) {
    if (!this.frames || this.frames.length === 0) return;
    
    const t = time + this.timeOffset;
    const frameIdx = Math.floor((t * this.fps)) % this.frames.length;
    const frame = this.frames[frameIdx];
    
    const w = frame.width * this.scale;
    const h = frame.height * this.scale;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Rotate slightly towards movement direction
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle + Math.PI / 2);
    ctx.rotate(Math.sin(time * 2 + this.phase) * 0.1);
    
    // Add photographic blending
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.9;
    
    ctx.drawImage(frame, -w/2, -h/2, w, h);
    ctx.restore();
  }
}

async function initOpeningCanvas() {
  const canvas = document.querySelector("[data-opening-canvas]");
  if (!canvas) return;
  
  // Create loading indicator
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
  const [pinkAnim, cyanAnim, violetAnim, bloomAnim] = await Promise.all([
    loadFrameSet(FRAME_SETS.pink),
    loadFrameSet(FRAME_SETS.cyan),
    loadFrameSet(FRAME_SETS.violet),
    loadFrameSet(FRAME_SETS.bloom)
  ]);
  
  const jellies = [
    new Jellyfish(pinkAnim, 0.45, 0.12, 0),
    new Jellyfish(cyanAnim, 0.6, 0.08, Math.PI),
    new Jellyfish(violetAnim, 0.4, 0.15, Math.PI / 2),
    new Jellyfish(bloomAnim, 0.7, 0.06, -Math.PI / 2)
  ];
  
  const particles = initParticles();
  
  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    const midIndex = Math.floor(particles.length * 0.6);
    const bgParticles = particles.slice(0, midIndex);
    const fgParticles = particles.slice(midIndex);
    
    // Draw background particles / depth
    ctx.fillStyle = "rgba(100, 150, 255, 0.03)";
    for (let i=0; i<30; i++) {
        ctx.beginPath();
        ctx.arc(
            (Math.sin(time * 0.1 + i) * LOGICAL_WIDTH * 0.5) + LOGICAL_WIDTH/2, 
            (Math.cos(time * 0.15 + i*2) * LOGICAL_HEIGHT * 0.5) + LOGICAL_HEIGHT/2, 
            (i % 5) * 10 + 10, 0, Math.PI*2
        );
        ctx.fill();
    }
    
    for (const j of jellies) {
      j.update(time);
    }
    
    // Setup text style
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    
    // BG Particles
    for (const p of bgParticles) {
      p.update(jellies, time);
      p.draw(ctx);
    }
    
    // Jellies in back
    jellies[0].draw(ctx, time);
    jellies[2].draw(ctx, time);
    
    // FG Particles
    for (const p of fgParticles) {
      p.update(jellies, time);
      p.draw(ctx);
    }
    
    // Jellies in front
    jellies[1].draw(ctx, time);
    jellies[3].draw(ctx, time);
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);
