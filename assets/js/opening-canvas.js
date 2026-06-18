const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;

// To perfectly match the "mosaic" feel, we use square blocks mapped to monospace characters
const CHAR_WIDTH = 5;
const CHAR_HEIGHT = 6;
const COLS = Math.floor(LOGICAL_WIDTH / CHAR_WIDTH);
const ROWS = Math.floor(LOGICAL_HEIGHT / CHAR_HEIGHT);

const ASSET_VERSION =
  typeof window !== "undefined" && window.__OPENING_ASSET_VERSION__
    ? `?v=${window.__OPENING_ASSET_VERSION__}`
    : "";
const BASE_URL =
  typeof window !== "undefined" && window.__OPENING_BASE_URL__
    ? window.__OPENING_BASE_URL__
    : "/";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Full character set for mapping brightness to static characters
// From darkest to lightest
const DENSE_CHARS = "M$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
const DENSE_LEN = DENSE_CHARS.length - 1;

// Animated characters for the "floating/shimmering" parts like the sky
const SHIMMER_CHARS = ["*", "+", "=", "~", "x", "-", "."];

async function initOpeningCanvas() {
  const canvas = document.querySelector("[data-opening-canvas]");
  if (!canvas) return;
  
  // Use alpha:false for maximum performance
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
  const imgUrl = `${BASE_URL}assets/images/pixel/original_hallway.png${ASSET_VERSION}`;
  let baseImg;
  try {
    baseImg = await loadImage(imgUrl);
  } catch (error) {
    try {
      baseImg = await loadImage(`${BASE_URL}assets/images/pixel/hallway.jpeg${ASSET_VERSION}`);
    } catch (fallbackError) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.fillStyle = "#f5f1e8";
      ctx.font = 'bold 28px "SF Mono", Menlo, Consolas, monospace';
      ctx.fillText("Opening visual is loading.", 48, 64);
      throw fallbackError;
    }
  }
  
  // Downscale the image exactly to the character grid dimensions.
  // Each pixel in this offscreen canvas will correspond to ONE character on the screen.
  const offCanvas = document.createElement("canvas");
  offCanvas.width = COLS;
  offCanvas.height = ROWS;
  const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
  // Turn off image smoothing to retain the raw pixel-art blockiness
  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(baseImg, 0, 0, COLS, ROWS);
  const imgData = offCtx.getImageData(0, 0, COLS, ROWS).data;
  
  // Pre-parse the grid cells for maximum performance
  const cells = [];
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = (y * COLS + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Determine if this pixel belongs to the "sky" (purple/blue and not too dark/bright)
      const isSky = (b > g + 10) && (b > r) && (luma > 50 && luma < 210);
      
      // Calculate the static character for this pixel based on luma
      let dIdx = Math.floor((luma / 255) * DENSE_LEN);
      dIdx = Math.max(0, Math.min(DENSE_LEN, dIdx));
      const staticChar = DENSE_CHARS[dIdx];
      
      cells.push({
        x, y, 
        color: `rgb(${r}, ${g}, ${b})`,
        staticChar,
        isSky,
        luma
      });
    }
  }

  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    lastTime = time;
    
    // Pure black background to make colors pop
    ctx.fillStyle = "#000000"; 
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    ctx.font = 'bold 8px "SF Mono", Menlo, Consolas, monospace';
    ctx.textBaseline = "top";
    
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        
        let char = cell.staticChar;
        
        // If it's a sky pixel, animate the character choice over time
        if (cell.isSky) {
            const wave = Math.floor(time * 8 + cell.x * 0.1 + cell.y * 0.15);
            char = SHIMMER_CHARS[Math.abs(wave) % SHIMMER_CHARS.length];
        }
        
        // Only draw if there's a visible character
        if (char !== " ") {
            ctx.fillStyle = cell.color;
            ctx.fillText(char, cell.x * CHAR_WIDTH, cell.y * CHAR_HEIGHT);
        }
    }
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);
