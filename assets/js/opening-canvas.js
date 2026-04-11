const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const CHAR_WIDTH = 4;
const CHAR_HEIGHT = 6;
const COLS = Math.floor(LOGICAL_WIDTH / CHAR_WIDTH);
const ROWS = Math.floor(LOGICAL_HEIGHT / CHAR_HEIGHT);

const ASSET_VERSION =
  typeof window !== "undefined" && window.__OPENING_ASSET_VERSION__
    ? `?v=${window.__OPENING_ASSET_VERSION__}`
    : "";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Map brightness to structure density. Darker = denser characters.
const DENSE_CHARS = "█▓▒M%W8#=o*-:.  ";

// Animated characters for the "floating/shimmering" parts like the sky
const SHIMMER_CHARS = ["*", "+", "=", "~", "x", "-", "."];

async function initOpeningCanvas() {
  const canvas = document.querySelector("[data-opening-canvas]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  
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

  // Load the newly perfectly mapped landscape reference image
  const imgUrl = `/assets/images/pixel/original_hallway.png${ASSET_VERSION}`;
  const baseImg = await loadImage(imgUrl);
  
  // 1. Offscreen processing canvas
  const offCanvas = document.createElement("canvas");
  offCanvas.width = COLS;
  offCanvas.height = ROWS;
  const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
  offCtx.drawImage(baseImg, 0, 0, COLS, ROWS);
  const imgData = offCtx.getImageData(0, 0, COLS, ROWS).data;
  
  // 2. Pre-bake static elements (Walls, Doors, Windows, solid clouds)
  // This gives the immense performance boost while preserving intricate resolution
  const staticCanvas = document.createElement("canvas");
  staticCanvas.width = LOGICAL_WIDTH;
  staticCanvas.height = LOGICAL_HEIGHT;
  const sCtx = staticCanvas.getContext("2d", { alpha: false });
  sCtx.fillStyle = "#ffffff"; 
  sCtx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  sCtx.font = 'bold 6px "SF Mono", Menlo, Consolas, monospace';
  sCtx.textBaseline = "top";
  
  const dynamicCells = [];
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = (y * COLS + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // True Whitespace: The pure bright clouds
      if (luma > 230 && r > 230 && g > 230 && b > 230) {
          continue; // Leave blank (white)
      }
      
      // Is it the purple/blue sky or water? 
      // The original has high blue/purple content in the sky and ceiling ocean
      const isSky = (b > g + 10) && (luma > 50 && luma < 210);
      
      // 3. Selection of dynamic vs static
      // We randomly pick ~85% of the sky cells to shimmer, the rest are static for stability
      if (isSky && Math.random() > 0.15) {
        dynamicCells.push({ x, y, r, g, b });
      } else {
        // Draw static structure (Doors, wall textures, outlines)
        // Map luma strictly to density char
        let dIdx = Math.floor((luma / 255) * DENSE_CHARS.length);
        dIdx = Math.max(0, Math.min(DENSE_CHARS.length - 1, dIdx));
        const char = DENSE_CHARS[dIdx];
        
        if (char !== " ") {
            sCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            sCtx.fillText(char, x * CHAR_WIDTH, y * CHAR_HEIGHT);
        }
      }
    }
  }

  const renderFrame = (now) => {
    const time = now / 1000;
    
    // Clear back to white
    ctx.fillStyle = "#ffffff"; 
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // Infinite Zoom effect (Gentle depth breathing to feel alive)
    ctx.save();
    const scale = 1.0 + Math.sin(time * 0.25) * 0.015; 
    ctx.translate(LOGICAL_WIDTH/2, LOGICAL_HEIGHT/2);
    ctx.scale(scale, scale);
    ctx.translate(-LOGICAL_WIDTH/2, -LOGICAL_HEIGHT/2);
    
    // 4. Paint the highly detailed static layout (the firm structure)
    ctx.drawImage(staticCanvas, 0, 0);
    
    // 5. Paint the animated characters (the shimmering sky/water)
    ctx.font = 'bold 6px "SF Mono", Menlo, Consolas, monospace';
    ctx.textBaseline = "top";
    
    for (const cell of dynamicCells) {
        // Wave shifts characters sequentially across the sky array
        const wave = Math.floor(time * 8 + cell.x * 0.1 + cell.y * 0.05);
        const char = SHIMMER_CHARS[Math.abs(wave) % SHIMMER_CHARS.length];
        
        ctx.fillStyle = `rgb(${cell.r}, ${cell.g}, ${cell.b})`;
        ctx.fillText(char, cell.x * CHAR_WIDTH, cell.y * CHAR_HEIGHT);
    }
    
    ctx.restore();
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);