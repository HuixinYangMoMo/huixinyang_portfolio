const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;

// 超高密度的字符网格，让排列“紧密有致”
const CHAR_WIDTH = 5;
const CHAR_HEIGHT = 7;
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

// 动态字符集：紫色的天空/海洋使用的闪动波点
const SHIMMER_CHARS = ["*", "+", "=", "~", "-", ".", "x"];

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

  // 加载前景实体（门窗、墙壁、白云等保持静止的结构）
  const fgImg = await loadImage(`/assets/images/pixel/hallway_fg.png${ASSET_VERSION}`);
  
  // 加载背景天空（被用来做成 ASCII 波点的颜色数据）
  const bgImg = await loadImage(`/assets/images/pixel/hallway_bg.png${ASSET_VERSION}`);
  
  // 解析背景天空数据，转化为 ASCII 波点网格
  const offCanvas = document.createElement("canvas");
  offCanvas.width = COLS;
  offCanvas.height = ROWS;
  const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
  offCtx.drawImage(bgImg, 0, 0, COLS, ROWS);
  const bgData = offCtx.getImageData(0, 0, COLS, ROWS).data;
  
  const skyCells = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = (y * COLS + x) * 4;
      const a = bgData[idx + 3];
      if (a > 10) { // 如果是背景/天空
        const r = bgData[idx];
        const g = bgData[idx + 1];
        const b = bgData[idx + 2];
        skyCells.push({
          x: x * CHAR_WIDTH, 
          y: y * CHAR_HEIGHT, 
          color: `rgb(${r}, ${g}, ${b})`,
          cx: x,
          cy: y
        });
      }
    }
  }

  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    lastTime = time;
    
    // 纯白底色
    ctx.fillStyle = "#ffffff"; 
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // 1. 绘制背景动态天空（字符流）
    // 颜色完全100%还原原图，排列紧密，具有时间波动的流体效果
    ctx.font = 'bold 8px "SF Mono", Menlo, Consolas, monospace';
    ctx.textBaseline = "top";
    
    for (let i = 0; i < skyCells.length; i++) {
        const cell = skyCells[i];
        // 时间波浪函数，让字符产生像云海一样的交替流动感
        const wave = Math.floor(time * 12 + cell.cx * 0.1 + cell.cy * 0.05);
        const char = SHIMMER_CHARS[Math.abs(wave) % SHIMMER_CHARS.length];
        
        ctx.fillStyle = cell.color;
        ctx.fillText(char, cell.x, cell.y);
    }
    
    // 2. 绘制前景静止实体（直接盖在上面的原图切片）
    // 这保证了门窗、白云的边缘绝对锋利清晰，完全按照原图展示，静止且无任何改变
    ctx.drawImage(fgImg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);