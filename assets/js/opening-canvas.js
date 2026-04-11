const LOGICAL_WIDTH = 1440;
const LOGICAL_HEIGHT = 900;
const CHAR_WIDTH = 6.5;
const CHAR_HEIGHT = 10;
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

// 密度映射：从 最暗（高密度） -> 最亮（低密度/空白）
// 原理是深色区域用大面积覆盖的字符，浅色区域用点阵或者留白
const DENSE_CHARS = "█▓▒MW@8#%*o+=~-:.  ";
const DENSE_LEN = DENSE_CHARS.length - 1;

// 会产生流动的字符集合（用于紫色的天空/云彩）
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

  // Load the AI-generated Pixel Art Image
  // Using an absolute path or the known working path
  const imgUrl = `/assets/images/pixel/hallway.jpeg${ASSET_VERSION}`;
  const baseImg = await loadImage(imgUrl);
  
  // 1. 将图像绘制到离屏的微型画布，大小精确等于我们屏幕能装下的字符数
  // 这相当于对原图进行了完美的像素化（Pixelation）与网格化
  const offCanvas = document.createElement("canvas");
  offCanvas.width = COLS;
  offCanvas.height = ROWS;
  const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
  offCtx.drawImage(baseImg, 0, 0, COLS, ROWS);
  const imgData = offCtx.getImageData(0, 0, COLS, ROWS).data;
  
  // 2. 预先解析所有格子数据（极大提升性能，不需要每秒计算60次全图颜色）
  const cells = [];
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = (y * COLS + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // 检测是否为天空/云朵色（偏蓝紫，Luma 中高）
      // 这里根据原图的色调来进行粗略过滤
      const isSky = (b > g * 1.1) && (luma > 80 && luma < 240);
      
      // 检测是否为纯白色的云层
      const isCloudWhite = (r > 240 && g > 240 && b > 240);
      
      // 增强对比度和色彩饱和度，让像素风更加 Vaporwave
      const boost = isSky ? 1.2 : 1.05;
      const finalR = Math.min(255, Math.floor(r * boost));
      const finalG = Math.min(255, Math.floor(g * boost));
      const finalB = Math.min(255, Math.floor(b * (isSky ? 1.4 : boost)));

      cells.push({
        x, y, 
        r: finalR, 
        g: finalG, 
        b: finalB,
        luma,
        isSky,
        isCloudWhite
      });
    }
  }

  let lastTime = performance.now() / 1000;
  
  const renderFrame = (now) => {
    const time = now / 1000;
    lastTime = time;
    
    // Fill pure white background
    ctx.fillStyle = "#ffffff"; 
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    ctx.font = 'bold 10px "SF Mono", Menlo, Consolas, monospace';
    ctx.textBaseline = "top";
    
    // Slow breathing perspective zoom (subtle, doesn't destroy the image)
    ctx.save();
    const scale = 1.0 + Math.sin(time * 0.4) * 0.015; 
    ctx.translate(LOGICAL_WIDTH/2, LOGICAL_HEIGHT/2);
    ctx.scale(scale, scale);
    ctx.translate(-LOGICAL_WIDTH/2, -LOGICAL_HEIGHT/2);
    
    for (const cell of cells) {
        let char = " ";
        
        // 核心逻辑 1：有疏有密的层次感
        // 极其明亮的区域（白云/强光）直接留白
        if (cell.luma > 245) {
            char = " ";
        } 
        // 极暗的区域（门框/深邃阴影）用密集的方块填充，保证物体的结构和轮廓清晰可见
        else if (cell.luma < 40) {
            char = "█";
        } 
        // 核心逻辑 2：截选一部分作为活动的字符（紫色的天空）
        else if (cell.isSky) {
            // 通过时间流逝和正弦波，让天空的波点看起来像云彩一样流动
            const wave = Math.floor(time * 8 + cell.x * 0.1 + cell.y * 0.15);
            char = SHIMMER_CHARS[Math.abs(wave) % SHIMMER_CHARS.length];
        } 
        // 其他普通的中间色调（门、墙壁、窗户等）
        else {
            // 根据亮度映射出固定的疏密字符
            const dIdx = Math.floor((cell.luma / 255) * DENSE_LEN);
            char = DENSE_CHARS[dIdx];
        }
        
        // 只绘制有内容的字符，跳过空白提高性能
        if (char !== " ") {
            ctx.fillStyle = `rgb(${cell.r}, ${cell.g}, ${cell.b})`;
            ctx.fillText(char, cell.x * CHAR_WIDTH, cell.y * CHAR_HEIGHT);
        }
    }
    
    ctx.restore();
    requestAnimationFrame(renderFrame);
  };
  
  requestAnimationFrame(renderFrame);
}

initOpeningCanvas().catch(console.error);