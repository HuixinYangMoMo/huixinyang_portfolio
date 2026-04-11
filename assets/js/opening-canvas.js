const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const CHAR_WIDTH = 8;
const CHAR_HEIGHT = 10;
const COLS = Math.floor(LOGICAL_WIDTH / CHAR_WIDTH);
const ROWS = Math.floor(LOGICAL_HEIGHT / CHAR_HEIGHT);

const ASSET_VERSION =
  typeof window !== "undefined" && window.__OPENING_ASSET_VERSION__
    ? `?v=${window.__OPENING_ASSET_VERSION__}`
    : "";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*()_+~-=/[]{}|:;<>,.? ";
const DENSITY_CHARS = " .:-=+*#%@";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function processImageToASCII(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  // We scale the image down to exactly the number of columns and rows
  // This means 1 pixel in this mini-canvas represents 1 character slot
  canvas.width = COLS;
  canvas.height = ROWS;
  
  // Draw scaled image
  ctx.drawImage(img, 0, 0, COLS, ROWS);
  const imgData = ctx.getImageData(0, 0, COLS, ROWS).data;
  
  const asciiData = [];
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = (y * COLS + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx+1];
      const b = imgData[idx+2];
      
      const luma = (r + g + b) / 3;
      
      // Determine brightness character
      const charIdx = Math.floor((luma / 255) * (DENSITY_CHARS.length - 1));
      let char = DENSITY_CHARS[charIdx];
      
      // Add a bit of Matrix-style random data for mid-tones to make it feel "active"
      if (luma > 80 && luma < 180 && Math.random() > 0.8) {
         char = CHARS[Math.floor(Math.random() * CHARS.length)];
      }

      asciiData.push({
        char: char,
        color: `rgb(${r}, ${g}, ${b})`,
        luma: luma,
        r, g, b
      });
    }
  }
  
  return asciiData;
}

// --------------------------------------------------------
// Background Stars & Moving Clouds
// --------------------------------------------------------
class RetroScenery {
  constructor() {
    this.timeOffset = 0;
    this.clouds = Array.from({length: 8}, () => ({
      x: Math.random() * COLS,
      y: Math.random() * ROWS,
      speed: Math.random() * 2 + 0.5,
      scale: Math.random() * 2 + 1
    }));
  }
  
  update(dt) {
    this.timeOffset += dt;
    for (const c of this.clouds) {
      c.x -= c.speed * dt * 5;
      if (c.x < -20) c.x = COLS + 20;
    }
  }
}

// --------------------------------------------------------
// Tunnel / Infinite Corridor Generator
// --------------------------------------------------------
function drawInfiniteCorridor(ctx, time, scenery) {
    ctx.font = 'bold 10px monospace';
    ctx.textBaseline = "top";
    
    // Calculate perspective center with a slight sway
    const cx = COLS / 2 + Math.sin(time) * 10;
    const cy = ROWS / 2 + Math.cos(time * 0.8) * 5;

    // Draw frame by frame character grid
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            
            // Vector from center
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Distance determines "depth" in the tunnel
            // We use modulo to create repeating wall segments (the "infinite" effect)
            let depth = (100 / (dist + 0.1)); 
            let wallSegment = (depth * 10 + time * 15) % 20;
            
            let char = " ";
            let color = "#000";
            
            // Sky & Clouds in the center (where distance is very small)
            if (dist < 15) {
                char = ".";
                color = "#d6b4fc"; // Purple sky
                
                // Add clouds
                for (const c of scenery.clouds) {
                    const cdist = Math.abs(x - (c.x/COLS)*30 - cx) + Math.abs(y - (c.y/ROWS)*30 - cy);
                    if (cdist < c.scale * 3) {
                        char = "#";
                        color = "#fff";
                    }
                }
            } 
            // The Walls / Ceiling / Floor
            else {
                // Determine which wall we're on based on angle
                const angle = Math.atan2(dy, dx);
                const pi = Math.PI;
                
                let isWall = false;
                let isWindow = false;
                
                // Segment borders (frames of the doors/windows)
                if (wallSegment < 2 || wallSegment > 18) {
                    char = "+";
                    color = "#8b5a2b"; // Wood brown
                    isWall = true;
                } else {
                    // Windows on the side walls
                    if ((angle > -pi/4 && angle < pi/4) || (angle > 3*pi/4 || angle < -3*pi/4)) {
                        // Side walls
                        if (wallSegment > 6 && wallSegment < 14 && Math.abs(dy) < dist * 0.5) {
                            // Window glass
                            char = "~";
                            color = "#a4b5f0"; // Glass blue/purple
                            isWindow = true;
                        } else {
                            char = "|";
                            color = "#c7b1e8"; // Pale purple wall
                            isWall = true;
                        }
                    } 
                    // Floor and Ceiling
                    else {
                        if (dy > 0) { // Floor
                            char = (x % 4 === 0 && y % 4 === 0) ? "." : "_";
                            color = "#e8e4f8"; // Light floor
                        } else { // Ceiling
                            char = "=";
                            color = "#b29dd6"; // Darker ceiling
                        }
                    }
                }
                
                // Add shading based on depth (further is darker)
                if (isWall || isWindow) {
                    const shade = Math.max(0, 1 - (dist / (COLS/2)));
                    // We modify the lightness of the color manually for a retro feel
                    // For simplicity in this demo, we just rely on character density
                    if (shade < 0.3) char = ".";
                    else if (shade < 0.6) char = ":";
                }
            }
            
            // Random glitching on walls
            if (dist > 15 && Math.random() > 0.995) {
                char = CHARS[Math.floor(Math.random() * CHARS.length)];
                color = "#39ff14"; // Matrix green glitch
            }
            
            if (char !== " ") {
                ctx.fillStyle = color;
                ctx.fillText(char, x * CHAR_WIDTH, y * CHAR_HEIGHT);
            }
        }
    }
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

  // We load the base AI generated image to use as our "map" for the ASCII art
  const baseImg = await loadImage("{{ '/assets/images/pixel/hallway.jpeg' | relative_url }}");
  
  const scenery = new RetroScenery();
  let lastTime = performance.now() / 1000;
  
  // We process the image once to get its color map, but we'll distort it live
  const originalAscii = processImageToASCII(baseImg);
  
  const renderFrame = (now) => {
    const time = now / 1000;
    const dt = time - lastTime;
    lastTime = time;
    
    // Fill background
    ctx.fillStyle = "#ffffff"; 
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    ctx.font = 'bold 10px "SF Mono", monospace';
    ctx.textBaseline = "top";
    
    // Instead of drawing the math corridor, we use the AI image as the layout, 
    // and apply a wave distortion and character cycling to make it "alive".
    
    let i = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const data = originalAscii[i];
        i++;
        
        // Depth distortion (simulating moving forward through the hallway)
        // We calculate distance from center
        const dx = (x - COLS/2) / COLS;
        const dy = (y - ROWS/2) / ROWS;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Skip purely white/empty areas
        if (data.luma > 240) continue;
        
        let char = data.char;
        let color = data.color;
        
        // Animate the characters (The "Pixel 波点" effect)
        // Lighter areas shift characters faster to look like clouds/sky
        if (data.luma > 150) {
            if (Math.sin(time * 5 + x * 0.1 + y * 0.1) > 0.5) {
                char = DENSITY_CHARS[Math.floor((data.luma/255) * DENSITY_CHARS.length * Math.random())] || ".";
            }
        }
        
        // The structural walls shift characters based on perspective movement
        if (dist > 0.2) { // Walls/Doors
            const speed = 20 * dist; // Closer to edges moves faster
            const shift = Math.floor(time * speed + dist * 10) % 2;
            if (shift === 0 && data.luma < 100) {
                char = ["#", "M", "W", "8", "@"][Math.floor(Math.random() * 5)];
            }
        }
        
        // Zoom/Wave effect
        const zoom = 1 + (time % 1) * 0.1 * dist; // Continuous slight zoom
        const renderX = COLS/2 + dx * COLS * zoom;
        const renderY = ROWS/2 + dy * ROWS * zoom;
        
        if (renderX >= 0 && renderX < COLS && renderY >= 0 && renderY < ROWS) {
            ctx.fillStyle = color;
            ctx.fillText(char, renderX * CHAR_WIDTH, renderY * CHAR_HEIGHT);
        }
      }
    }
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);
