import { prepareWithSegments, layoutNextLine } from "https://esm.sh/@chenglou/pretext@0.0.4";

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 780;
const LEFT_MARGIN = 58;
const RIGHT_MARGIN = 58;
const TOP_MARGIN = 74;
const BOTTOM_MARGIN = 72;
const LINE_HEIGHT = 15.1;
const FONT_SIZE = 12.8;
const FONT = `500 ${FONT_SIZE}px Menlo`;
const MIN_SLOT_WIDTH = 92;
const START_CURSOR = { segmentIndex: 0, graphemeIndex: 0 };
let glyphMeasureContext = null;
const ASSET_VERSION =
  typeof window !== "undefined" && window.__OPENING_ASSET_VERSION__
    ? `?v=${window.__OPENING_ASSET_VERSION__}`
    : "";

const CUTOUTS = {
  pink: `/images/opening/wavespeed/jellyfish_pink_chroma.png${ASSET_VERSION}`,
  cyan: `/images/opening/wavespeed/jellyfish_cyan_chroma.png${ASSET_VERSION}`,
  violet: `/images/opening/wavespeed/jellyfish_violet_chroma.png${ASSET_VERSION}`,
};

const TOKENS = [
  "tide.loop",
  "jelly.core",
  "veil.null",
  "glow__bell",
  "drift.mesh",
  "plankton.13",
  "veil.alpha",
  "current.fold",
  "cyan.trace",
  "pulse.field",
  "buffer.open",
  "quiet.soft",
  "node.slow",
  "salt.memory",
  "mesh.break",
  "render.soft",
];

const TEXT_STREAM = Array.from({ length: 320 }, (_, index) => {
  const token = TOKENS[index % TOKENS.length];
  const suffix = String((index * 17) % 89).padStart(2, "0");
  return `${token}.${suffix}`;
}).join(" / ");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function escapeXml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getGlyphAdvance(char) {
  if (!glyphMeasureContext) {
    const canvas = document.createElement("canvas");
    glyphMeasureContext = canvas.getContext("2d");
    glyphMeasureContext.font = FONT;
  }
  return glyphMeasureContext.measureText(char === " " ? "\u00A0" : char).width;
}

function ellipseRange(obstacle, y) {
  const dy = y - obstacle.cy;
  if (Math.abs(dy) >= obstacle.ry) {
    return null;
  }

  const dx = obstacle.rx * Math.sqrt(1 - (dy * dy) / (obstacle.ry * obstacle.ry));
  return {
    start: obstacle.cx - dx - obstacle.padding,
    end: obstacle.cx + dx + obstacle.padding,
  };
}

function subtractRanges(baseStart, baseEnd, blockedRanges) {
  const ordered = blockedRanges
    .filter((range) => range && range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const slots = [];
  let cursor = baseStart;

  for (const range of ordered) {
    const start = Math.max(baseStart, range.start);
    const end = Math.min(baseEnd, range.end);

    if (end <= cursor) {
      continue;
    }

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

function buildScene() {
  const pink = {
    key: "pink",
    assetKey: "pink",
    x: 54,
    y: 86,
    width: 182,
    height: 344,
    obstacle: { cx: 148, cy: 252, rx: 74, ry: 114, padding: 24 },
    bell: { cx: 145, cy: 154, rx: 58, ry: 54 },
    body: { cx: 142, cy: 268, rx: 46, ry: 124 },
    bellClipHeight: 116,
    tailClipY: 164,
  };

  const cyan = {
    key: "cyan",
    assetKey: "cyan",
    x: 348,
    y: 270,
    width: 364,
    height: 384,
    obstacle: { cx: 528, cy: 420, rx: 152, ry: 122, padding: 28 },
    bell: { cx: 530, cy: 360, rx: 118, ry: 96 },
    body: { cx: 528, cy: 492, rx: 94, ry: 144 },
    bellClipHeight: 156,
    tailClipY: 406,
  };

  const violet = {
    key: "violet",
    assetKey: "violet",
    x: 734,
    y: 232,
    width: 202,
    height: 284,
    obstacle: { cx: 832, cy: 360, rx: 90, ry: 98, padding: 24 },
    bell: { cx: 835, cy: 316, rx: 68, ry: 56 },
    body: { cx: 834, cy: 398, rx: 52, ry: 96 },
    bellClipHeight: 108,
    tailClipY: 330,
  };

  const foreground = {
    key: "foreground",
    assetKey: "cyan",
    x: 236,
    y: 598,
    width: 362,
    height: 352,
    obstacle: { cx: 414, cy: 742, rx: 152, ry: 118, padding: 28 },
    bell: { cx: 416, cy: 680, rx: 116, ry: 88 },
    body: { cx: 414, cy: 784, rx: 96, ry: 136 },
    bellClipHeight: 146,
    tailClipY: 730,
  };

  return {
    pink,
    cyan,
    violet,
    foreground,
    obstacles: [
      pink.bell,
      pink.body,
      cyan.bell,
      cyan.body,
      violet.bell,
      violet.body,
      foreground.bell,
      foreground.body,
    ].map((part) => ({ ...part, padding: 20 })),
  };
}

function swimState(timeSeconds, speed, phase) {
  const cycle = (timeSeconds * speed + phase) % 1;
  const pulse =
    cycle < 0.24
      ? Math.sin((cycle / 0.24) * (Math.PI / 2))
      : Math.pow(1 - (cycle - 0.24) / 0.76, 1.65);

  return {
    cycle,
    pulse,
    sway: Math.sin(timeSeconds * (speed * 1.2) + phase * Math.PI * 2),
    drift: Math.cos(timeSeconds * (speed * 0.74) + phase * 5.3),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function computeAlphaRows(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
  const rows = new Array(height).fill(null);

  for (let y = 0; y < height; y += 1) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 20) {
        left = x;
        break;
      }
    }
    if (left === -1) {
      continue;
    }
    for (let x = width - 1; x >= 0; x -= 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 20) {
        right = x;
        break;
      }
    }
    rows[y] = { left, right };
  }

  return { width, height, rows };
}

function computeImageFit(jelly, alphaMap) {
  const imageAspect = alphaMap.width / alphaMap.height;
  const boxAspect = jelly.width / jelly.height;

  if (imageAspect > boxAspect) {
    const displayWidth = jelly.width;
    const displayHeight = displayWidth / imageAspect;
    return {
      displayWidth,
      displayHeight,
      offsetX: 0,
      offsetY: (jelly.height - displayHeight) / 2,
    };
  }

  const displayHeight = jelly.height;
  const displayWidth = displayHeight * imageAspect;
  return {
    displayWidth,
    displayHeight,
    offsetX: (jelly.width - displayWidth) / 2,
    offsetY: 0,
  };
}

async function prepareJellyMasks(scene) {
  const unique = [...new Set(Object.values(scene).filter(Boolean).map((item) => item.assetKey).filter(Boolean))];
  const alphaMaps = {};

  for (const key of unique) {
    const image = await loadImage(CUTOUTS[key]);
    alphaMaps[key] = computeAlphaRows(image);
  }

  for (const jelly of [scene.pink, scene.cyan, scene.violet, scene.foreground]) {
    const alphaMap = alphaMaps[jelly.assetKey];
    jelly.alphaMap = alphaMap;
    jelly.fit = computeImageFit(jelly, alphaMap);
  }
}

function maskRange(jelly, y) {
  const fit = jelly.fit;
  if (!fit || !jelly.alphaMap) {
    return null;
  }

  const localY = y - (jelly.y + fit.offsetY);
  if (localY < 0 || localY >= fit.displayHeight) {
    return null;
  }

  const imageY = Math.max(0, Math.min(jelly.alphaMap.height - 1, Math.floor((localY / fit.displayHeight) * jelly.alphaMap.height)));
  const row = jelly.alphaMap.rows[imageY];
  if (!row) {
    return null;
  }

  return {
    start: jelly.x + fit.offsetX + (row.left / jelly.alphaMap.width) * fit.displayWidth - 18,
    end: jelly.x + fit.offsetX + (row.right / jelly.alphaMap.width) * fit.displayWidth + 18,
  };
}

function lineTone(y, slotIndex, slotCount) {
  if (y < 170) {
    return slotIndex === 0 ? "soft" : "dim";
  }
  if (y > 620) {
    return slotCount > 1 ? "soft" : "dim";
  }
  return slotIndex % 2 === 0 ? "bright" : "soft";
}

function clusterKeyForPoint(scene, x, y) {
  const candidates = [
    { key: "pink", cx: scene.pink.obstacle.cx, cy: scene.pink.obstacle.cy },
    { key: "cyan", cx: scene.cyan.obstacle.cx, cy: scene.cyan.obstacle.cy },
    { key: "violet", cx: scene.violet.obstacle.cx, cy: scene.violet.obstacle.cy },
    { key: "foreground", cx: scene.foreground.obstacle.cx, cy: scene.foreground.obstacle.cy },
  ];

  let bestKey = "cyan";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const dx = x - candidate.cx;
    const dy = y - candidate.cy;
    const score = dx * dx + dy * dy * 1.12;
    if (score < bestScore) {
      bestScore = score;
      bestKey = candidate.key;
    }
  }

  return bestKey;
}

function layoutLines(prepared, scene) {
  const rows = [];
  let cursor = { ...START_CURSOR };

  for (let baselineY = TOP_MARGIN; baselineY <= VIEWBOX_HEIGHT - BOTTOM_MARGIN; baselineY += LINE_HEIGHT) {
    const leftWave = Math.sin(baselineY * 0.024) * 18 + Math.sin(baselineY * 0.008) * 8;
    const rightWave = Math.cos(baselineY * 0.02) * 14 + Math.cos(baselineY * 0.009) * 6;
    const baseStart = Math.max(18, LEFT_MARGIN + leftWave);
    const baseEnd = Math.min(VIEWBOX_WIDTH - 18, VIEWBOX_WIDTH - RIGHT_MARGIN + rightWave);

    const blockedRanges = [scene.pink, scene.cyan, scene.violet, scene.foreground]
      .map((jelly) => maskRange(jelly, baselineY - LINE_HEIGHT * 0.35))
      .filter(Boolean);

    const slots = subtractRanges(baseStart, baseEnd, blockedRanges);
    if (slots.length === 0) {
      continue;
    }

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = slots[slotIndex];
      let line = layoutNextLine(prepared, cursor, slot.end - slot.start);

      if (line === null) {
        cursor = { ...START_CURSOR };
        line = layoutNextLine(prepared, cursor, slot.end - slot.start);
      }

      if (line === null) {
        continue;
      }

      rows.push({
        x: Math.max(12, slot.start + Math.sin(baselineY * 0.043 + slotIndex) * 4),
        y: baselineY,
        width: line.width,
        text: line.text,
        tone: lineTone(baselineY, slotIndex, slots.length),
      });

      cursor = line.end;
    }
  }

  return rows;
}

function renderParticles() {
  return Array.from({ length: 24 }, (_, index) => {
    const x = 74 + (index * 41) % 850;
    const y = 66 + (index * 69) % 620;
    const r = 1.2 + (index % 4) * 0.7;
    const opacity = 0.16 + (index % 5) * 0.04;
    return `<circle class="opening-art__bubble" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" opacity="${opacity.toFixed(2)}" />`;
  }).join("");
}

function renderGhosts() {
  const ghosts = [
    { cx: 138, cy: 100, rx: 72, ry: 48, fill: "rgba(116, 122, 255, 0.12)" },
    { cx: 742, cy: 98, rx: 56, ry: 40, fill: "rgba(210, 164, 255, 0.11)" },
    { cx: 908, cy: 544, rx: 76, ry: 46, fill: "rgba(118, 193, 255, 0.12)" },
    { cx: 868, cy: 676, rx: 66, ry: 44, fill: "rgba(175, 161, 255, 0.10)" },
  ];

  return ghosts
    .map((ghost) => `<ellipse class="opening-art__ghost" cx="${ghost.cx}" cy="${ghost.cy}" rx="${ghost.rx}" ry="${ghost.ry}" fill="${ghost.fill}" filter="url(#opening-blur-soft)" />`)
    .join("");
}

function svgDefs() {
  return `
    <defs>
      <linearGradient id="opening-paper-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fffdfa" />
        <stop offset="100%" stop-color="#f8f4f1" />
      </linearGradient>
      <filter id="opening-blur-soft" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="24" />
      </filter>
      <pattern id="opening-paper-dot" width="9" height="9" patternUnits="userSpaceOnUse">
        <circle cx="2.1" cy="2.1" r="0.7" fill="rgba(159, 150, 196, 0.16)" />
        <circle cx="6.2" cy="5.8" r="0.6" fill="rgba(135, 198, 255, 0.14)" />
      </pattern>
      <pattern id="opening-paper-dot-large" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="4.2" cy="4.2" r="1.7" fill="rgba(156, 142, 218, 0.12)" />
        <circle cx="12" cy="10.6" r="1.4" fill="rgba(118, 206, 255, 0.1)" />
      </pattern>
    </defs>
  `;
}

function renderCutoutGroup(jelly, options = {}) {
  const ghostDx = options.ghostDx ?? -10;
  const ghostDy = options.ghostDy ?? 8;
  const ghostOpacity = options.ghostOpacity ?? 0.16;
  const opacity = options.opacity ?? 0.94;
  const extra = options.extra ?? "";
  const assetHref = CUTOUTS[jelly.key === "foreground" ? "cyan" : jelly.key];
  const baseOpacity = Math.max(0.18, opacity * 0.78);
  const bellOpacity = Math.min(1, opacity * 0.92);
  const tailOpacity = Math.min(1, opacity * 0.9);

  return `
    <g class="opening-art__float opening-art__float--${jelly.key}" data-jelly-key="${jelly.key}">
      <defs>
        <linearGradient id="opening-bell-mask-gradient-${jelly.key}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="white" />
          <stop offset="82%" stop-color="white" />
          <stop offset="100%" stop-color="black" />
        </linearGradient>
        <linearGradient id="opening-tail-mask-gradient-${jelly.key}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="black" />
          <stop offset="22%" stop-color="white" />
          <stop offset="100%" stop-color="white" />
        </linearGradient>
        <mask id="opening-bell-mask-${jelly.key}" maskUnits="userSpaceOnUse">
          <rect x="${jelly.x.toFixed(2)}" y="${jelly.y.toFixed(2)}" width="${jelly.width}" height="${jelly.bellClipHeight + 30}" fill="url(#opening-bell-mask-gradient-${jelly.key})" />
        </mask>
        <mask id="opening-tail-mask-${jelly.key}" maskUnits="userSpaceOnUse">
          <rect x="${jelly.x.toFixed(2)}" y="${(jelly.tailClipY - 30).toFixed(2)}" width="${jelly.width}" height="${Math.max(1, jelly.y + jelly.height - jelly.tailClipY + 30)}" fill="url(#opening-tail-mask-gradient-${jelly.key})" />
        </mask>
      </defs>
      ${extra}
      <image class="opening-art__cutout opening-art__cutout--ghost opening-art__cutout--${jelly.key}" href="${assetHref}" x="${(jelly.x + ghostDx).toFixed(2)}" y="${(jelly.y + ghostDy).toFixed(2)}" width="${jelly.width}" height="${jelly.height}" opacity="${ghostOpacity}" filter="url(#opening-blur-soft)" preserveAspectRatio="xMidYMid meet" />
      <image class="opening-art__cutout opening-art__cutout--base opening-art__cutout--${jelly.key}" href="${assetHref}" x="${jelly.x.toFixed(2)}" y="${jelly.y.toFixed(2)}" width="${jelly.width}" height="${jelly.height}" opacity="${baseOpacity}" preserveAspectRatio="xMidYMid meet" />
      <g class="opening-art__jelly-bell" data-jelly-bell="${jelly.key}">
        <image class="opening-art__cutout opening-art__cutout--main opening-art__cutout--${jelly.key}" href="${assetHref}" x="${jelly.x.toFixed(2)}" y="${jelly.y.toFixed(2)}" width="${jelly.width}" height="${jelly.height}" opacity="${bellOpacity}" preserveAspectRatio="xMidYMid meet" mask="url(#opening-bell-mask-${jelly.key})" />
      </g>
      <g class="opening-art__jelly-tail" data-jelly-tail="${jelly.key}">
        <image class="opening-art__cutout opening-art__cutout--main opening-art__cutout--${jelly.key}" href="${assetHref}" x="${jelly.x.toFixed(2)}" y="${jelly.y.toFixed(2)}" width="${jelly.width}" height="${jelly.height}" opacity="${tailOpacity}" preserveAspectRatio="xMidYMid meet" mask="url(#opening-tail-mask-${jelly.key})" />
      </g>
    </g>
  `;
}

function renderArt(backSvg, frontSvg, scene) {
  backSvg.innerHTML = `
    ${svgDefs()}
    <rect class="opening-art__paper" x="0" y="0" width="${VIEWBOX_WIDTH}" height="${VIEWBOX_HEIGHT}" fill="url(#opening-paper-gradient)" />
    <rect class="opening-art__print-field" x="0" y="0" width="${VIEWBOX_WIDTH}" height="${VIEWBOX_HEIGHT}" fill="url(#opening-paper-dot)" />
    <rect class="opening-art__print-field opening-art__print-field--large" x="0" y="0" width="${VIEWBOX_WIDTH}" height="${VIEWBOX_HEIGHT}" fill="url(#opening-paper-dot-large)" />
    ${renderGhosts()}
    ${renderParticles()}
    ${renderCutoutGroup(scene.pink, { ghostOpacity: 0.14, ghostDx: -14, ghostDy: 10 })}
    ${renderCutoutGroup(scene.cyan, { ghostOpacity: 0.12, ghostDx: 12, ghostDy: -8 })}
    ${renderCutoutGroup(scene.violet, { ghostOpacity: 0.12, ghostDx: -8, ghostDy: 8, opacity: 0.9 })}
  `;

  frontSvg.innerHTML = `
    ${svgDefs()}
    ${renderCutoutGroup(scene.foreground, { ghostOpacity: 0.06, ghostDx: 16, ghostDy: 12, opacity: 0.32 })}
  `;
}

function renderTypeset(svg, rows, scene) {
  const clusters = {
    pink: [],
    cyan: [],
    violet: [],
    foreground: [],
  };

  for (const row of rows) {
    const key = clusterKeyForPoint(scene, row.x + row.width * 0.5, row.y);
    clusters[key].push(row);
  }

  let globalGlyphIndex = 0;

  const staticText = Object.entries(clusters)
    .map(([key, clusterRows]) => {
      const lineGroups = clusterRows
        .map((row) => {
          let cursorX = row.x;
          const glyphs = Array.from(row.text).map((char, glyphOffset) => {
            const safeChar = char === " " ? "&#160;" : escapeXml(char);
            const glyph = `<text class="opening-typeset__glyph opening-typeset__line--${row.tone}" data-char-cluster="${key}" data-char-index="${globalGlyphIndex + glyphOffset}" data-base-x="${cursorX.toFixed(2)}" data-base-y="${row.y.toFixed(2)}" x="${cursorX.toFixed(2)}" y="${row.y.toFixed(2)}">${safeChar}</text>`;
            cursorX += getGlyphAdvance(char);
            return glyph;
          }).join("");
          globalGlyphIndex += row.text.length;
          return `<g class="opening-typeset__line-group">${glyphs}</g>`;
        })
        .join("");
      return `<g class="opening-typeset__cluster opening-typeset__cluster--${key}" data-text-cluster="${key}">${lineGroups}</g>`;
    })
    .join("");

  svg.innerHTML = `<g class="opening-typeset__static">${staticText}</g>`;
}

function animateJellies(sceneRoot, scene) {
  if (sceneRoot.classList.contains("is-reduced-motion")) {
    return;
  }

  const nodes = {
    pink: sceneRoot.querySelector('[data-jelly-key="pink"]'),
    cyan: sceneRoot.querySelector('[data-jelly-key="cyan"]'),
    violet: sceneRoot.querySelector('[data-jelly-key="violet"]'),
    foreground: sceneRoot.querySelector('[data-jelly-key="foreground"]'),
  };

  const bells = {
    pink: sceneRoot.querySelector('[data-jelly-bell="pink"]'),
    cyan: sceneRoot.querySelector('[data-jelly-bell="cyan"]'),
    violet: sceneRoot.querySelector('[data-jelly-bell="violet"]'),
    foreground: sceneRoot.querySelector('[data-jelly-bell="foreground"]'),
  };

  const tails = {
    pink: sceneRoot.querySelector('[data-jelly-tail="pink"]'),
    cyan: sceneRoot.querySelector('[data-jelly-tail="cyan"]'),
    violet: sceneRoot.querySelector('[data-jelly-tail="violet"]'),
    foreground: sceneRoot.querySelector('[data-jelly-tail="foreground"]'),
  };

  const textClusters = {
    pink: Array.from(sceneRoot.querySelectorAll('[data-char-cluster="pink"]')).map((node) => ({
      node,
      x: parseFloat(node.getAttribute("data-base-x") || "0"),
      y: parseFloat(node.getAttribute("data-base-y") || "0"),
      index: parseInt(node.getAttribute("data-char-index") || "0", 10),
    })),
    cyan: Array.from(sceneRoot.querySelectorAll('[data-char-cluster="cyan"]')).map((node) => ({
      node,
      x: parseFloat(node.getAttribute("data-base-x") || "0"),
      y: parseFloat(node.getAttribute("data-base-y") || "0"),
      index: parseInt(node.getAttribute("data-char-index") || "0", 10),
    })),
    violet: Array.from(sceneRoot.querySelectorAll('[data-char-cluster="violet"]')).map((node) => ({
      node,
      x: parseFloat(node.getAttribute("data-base-x") || "0"),
      y: parseFloat(node.getAttribute("data-base-y") || "0"),
      index: parseInt(node.getAttribute("data-char-index") || "0", 10),
    })),
    foreground: Array.from(sceneRoot.querySelectorAll('[data-char-cluster="foreground"]')).map((node) => ({
      node,
      x: parseFloat(node.getAttribute("data-base-x") || "0"),
      y: parseFloat(node.getAttribute("data-base-y") || "0"),
      index: parseInt(node.getAttribute("data-char-index") || "0", 10),
    })),
  };

  const center = {
    pink: {
      x: scene.pink.x + scene.pink.width / 2,
      y: scene.pink.y + 18,
    },
    cyan: {
      x: scene.cyan.x + scene.cyan.width / 2,
      y: scene.cyan.y + scene.cyan.height / 2,
    },
    violet: {
      x: scene.violet.x + scene.violet.width / 2,
      y: scene.violet.y + scene.violet.height / 2,
    },
    foreground: {
      x: scene.foreground.x + scene.foreground.width / 2,
      y: scene.foreground.y + scene.foreground.height / 2,
    },
  };

  const bodyCenter = {
    pink: { x: scene.pink.x + scene.pink.width / 2, y: scene.pink.tailClipY + 96 },
    cyan: { x: scene.cyan.x + scene.cyan.width / 2, y: scene.cyan.tailClipY + 122 },
    violet: { x: scene.violet.x + scene.violet.width / 2, y: scene.violet.tailClipY + 84 },
    foreground: { x: scene.foreground.x + scene.foreground.width / 2, y: scene.foreground.tailClipY + 114 },
  };

  const scaleAround = (cx, cy, sx, sy) => {
    return `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`;
  };

  const start = performance.now();

  const applyBellTail = (key, pulse, sway, drift) => {
    const bell = bells[key];
    const tail = tails[key];
    if (bell) {
      const c = center[key];
      const sx = 1 - pulse * 0.085 + Math.sin(drift) * 0.008;
      const sy = 1 + pulse * 0.14;
      const lift = -pulse * 8.5;
      bell.setAttribute(
        "transform",
        `translate(0 ${lift.toFixed(2)}) ${scaleAround(c.x, c.y, sx, sy)}`
      );
    }
    if (tail) {
      const c = bodyCenter[key];
      const tx = sway * 4.8;
      const ty = pulse * 16.5 + Math.abs(drift) * 2.2;
      const sx = 1 - pulse * 0.025;
      const sy = 1 + pulse * 0.14;
      const rot = sway * 2.8;
      tail.setAttribute(
        "transform",
        `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${rot.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}) ${scaleAround(c.x, c.y, sx, sy)}`
      );
    }
  };

  const motionByKey = {
    pink: { tx: 0, ty: 0, rot: 0, pulse: 0, sway: 0, drift: 0 },
    cyan: { tx: 0, ty: 0, rot: 0, pulse: 0, sway: 0, drift: 0 },
    violet: { tx: 0, ty: 0, rot: 0, pulse: 0, sway: 0, drift: 0 },
    foreground: { tx: 0, ty: 0, rot: 0, pulse: 0, sway: 0, drift: 0 },
  };

  const applyTextCluster = (key, tx, ty, rot, pulse, sway, drift, timeValue) => {
    const chars = textClusters[key];
    if (!chars?.length) {
      return;
    }

    const jelly = key === "foreground" ? scene.foreground : scene[key];
    const bell = jelly.bell;
    const body = jelly.body;

    for (const glyph of chars) {
      const bellDx = glyph.x - bell.cx;
      const bellDy = glyph.y - bell.cy;
      const bellDist = Math.hypot(bellDx, bellDy);
      const bellRadius = Math.max(1, bellDist);
      const bellNx = bellDx / bellRadius;
      const bellNy = bellDy / bellRadius;
      const bellTangentX = -bellNy;
      const bellTangentY = bellNx;
      const bellFalloff = Math.max(0, 1 - bellDist / (bell.ry * 3.1));

      const bodyDx = glyph.x - body.cx;
      const bodyDy = glyph.y - body.cy;
      const bodyDist = Math.hypot(bodyDx, bodyDy);
      const bodyRadius = Math.max(1, bodyDist);
      const bodyNx = bodyDx / bodyRadius;
      const bodyNy = bodyDy / bodyRadius;
      const bodyTangentX = -bodyNy;
      const bodyTangentY = bodyNx;
      const bodyFalloff = Math.max(0, 1 - bodyDist / (body.ry * 2.7));

      const bellSwirl = Math.sin(timeValue * 0.86 + glyph.index * 0.08 + bellDist * 0.014) * 4.8 * bellFalloff;
      const bellCompress = pulse * 10.8 * bellFalloff;
      const bodyTrail = (pulse * 14.2 + Math.abs(drift) * 3.4) * bodyFalloff;
      const bodyRipple = Math.sin(timeValue * 1.14 + glyph.index * 0.05 + bodyDy * 0.03) * 3.6 * bodyFalloff;
      const ambient = Math.cos(timeValue * 0.92 + glyph.index * 0.07) * 0.7;

      const localX =
        bellTangentX * bellSwirl -
        bellNx * bellCompress +
        bodyTangentX * bodyRipple +
        sway * (2.2 * bellFalloff + 1.1 * bodyFalloff) +
        ambient;
      const localY =
        bellTangentY * bellSwirl -
        bellNy * bellCompress +
        bodyTrail +
        bodyNy * bodyRipple +
        Math.sin(timeValue * 1.06 + glyph.index * 0.09) * 1.2;
      const driftWeight = 0.34 + bellFalloff * 0.22 + bodyFalloff * 0.18;
      const driftX = tx * driftWeight;
      const driftY = ty * driftWeight;
      const charRot =
        rot * 0.22 +
        bellTangentX * sway * 0.9 +
        bodyTangentX * drift * 0.42 +
        Math.sin(timeValue * 0.58 + glyph.index * 0.07) * 0.6 * (bellFalloff + bodyFalloff);
      glyph.node.setAttribute(
        "transform",
        `translate(${(driftX + localX).toFixed(2)} ${(driftY + localY).toFixed(2)}) rotate(${charRot.toFixed(2)} ${glyph.x.toFixed(2)} ${glyph.y.toFixed(2)})`
      );
    }
  };

  const frame = (now) => {
    const t = (now - start) / 1000;

    if (nodes.pink) {
      const state = swimState(t, 0.16, 0.07);
      const tx = Math.sin(t * 0.44) * 4.2 + state.sway * 2.6;
      const ty = 8 + state.drift * 7.5 + state.pulse * 5.5;
      const rot = state.sway * 1.8;
      const pulse = state.pulse;
      const sway = state.sway;
      const drift = state.drift;
      const transform = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${rot.toFixed(2)} ${center.pink.x.toFixed(2)} ${center.pink.y.toFixed(2)})`;
      nodes.pink.setAttribute("transform", transform);
      motionByKey.pink = { tx, ty, rot, pulse, sway, drift };
      applyBellTail("pink", pulse, sway, drift);
    }

    if (nodes.cyan) {
      const state = swimState(t, 0.12, 0.22);
      const tx = Math.sin(t * 0.31 + 1.1) * 6.4 + state.sway * 4.2;
      const ty = Math.cos(t * 0.24 + 0.6) * 12.4 + state.pulse * 9.5;
      const rot = state.sway * 1.4;
      const pulse = state.pulse;
      const sway = state.sway;
      const drift = state.drift;
      const transform = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${rot.toFixed(2)} ${center.cyan.x.toFixed(2)} ${center.cyan.y.toFixed(2)})`;
      nodes.cyan.setAttribute("transform", transform);
      motionByKey.cyan = { tx, ty, rot, pulse, sway, drift };
      applyBellTail("cyan", pulse, sway, drift);
    }

    if (nodes.violet) {
      const state = swimState(t, 0.14, 0.46);
      const tx = Math.cos(t * 0.36 + 0.8) * 5.2 + state.sway * 2.8;
      const ty = Math.sin(t * 0.28 + 1.1) * 10.2 + state.pulse * 6.4;
      const rot = state.sway * 1.1;
      const pulse = state.pulse;
      const sway = state.sway;
      const drift = state.drift;
      const transform = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${rot.toFixed(2)} ${center.violet.x.toFixed(2)} ${center.violet.y.toFixed(2)})`;
      nodes.violet.setAttribute("transform", transform);
      motionByKey.violet = { tx, ty, rot, pulse, sway, drift };
      applyBellTail("violet", pulse, sway, drift);
    }

    if (nodes.foreground) {
      const state = swimState(t, 0.1, 0.74);
      const tx = Math.sin(t * 0.24 + 1.1) * 3.2 + state.sway * 2.2;
      const ty = -6 + Math.cos(t * 0.2 + 0.6) * 6.2 + state.pulse * 5.4;
      const rot = state.sway * 0.9;
      const pulse = state.pulse;
      const sway = state.sway;
      const drift = state.drift;
      const transform = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${rot.toFixed(2)} ${center.foreground.x.toFixed(2)} ${center.foreground.y.toFixed(2)})`;
      nodes.foreground.setAttribute("transform", transform);
      motionByKey.foreground = { tx, ty, rot, pulse, sway, drift };
      applyBellTail("foreground", pulse, sway, drift);
    }

    applyTextCluster("pink", motionByKey.pink.tx, motionByKey.pink.ty, motionByKey.pink.rot, motionByKey.pink.pulse, motionByKey.pink.sway, motionByKey.pink.drift, t);
    applyTextCluster("cyan", motionByKey.cyan.tx, motionByKey.cyan.ty, motionByKey.cyan.rot, motionByKey.cyan.pulse, motionByKey.cyan.sway, motionByKey.cyan.drift, t);
    applyTextCluster("violet", motionByKey.violet.tx, motionByKey.violet.ty, motionByKey.violet.rot, motionByKey.violet.pulse, motionByKey.violet.sway, motionByKey.violet.drift, t);
    applyTextCluster("foreground", motionByKey.foreground.tx, motionByKey.foreground.ty, motionByKey.foreground.rot, motionByKey.foreground.pulse, motionByKey.foreground.sway, motionByKey.foreground.drift, t);

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

async function initOpeningTypeset() {
  const sceneRoot = document.querySelector("[data-opening-scene]");
  const backSvg = document.querySelector("[data-opening-art-back]");
  const frontSvg = document.querySelector("[data-opening-art-front]");
  const typesetSvg = document.querySelector("[data-opening-typeset]");

  if (
    !(sceneRoot instanceof HTMLElement) ||
    !(backSvg instanceof SVGElement) ||
    !(frontSvg instanceof SVGElement) ||
    !(typesetSvg instanceof SVGElement)
  ) {
    return;
  }

  if (reduceMotion.matches) {
    sceneRoot.classList.add("is-reduced-motion");
  }

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness errors and continue with fallback metrics.
    }
  }

  const prepared = prepareWithSegments(TEXT_STREAM, FONT);
  const scene = buildScene();
  await prepareJellyMasks(scene);

  const renderAll = () => {
    renderArt(backSvg, frontSvg, scene);
    renderTypeset(typesetSvg, layoutLines(prepared, scene), scene);
  };

  renderAll();
  animateJellies(sceneRoot, scene);
  window.addEventListener("resize", renderAll);
}

initOpeningTypeset().catch((error) => {
  console.error("Failed to initialize opening typeset:", error);
});
