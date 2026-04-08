import { prepareWithSegments, layoutNextLine } from "https://esm.sh/@chenglou/pretext@0.0.4";

const LOGICAL_WIDTH = 1000;
const LOGICAL_HEIGHT = 780;
const TOP_MARGIN = 74;
const BOTTOM_MARGIN = 72;
const LEFT_MARGIN = 58;
const RIGHT_MARGIN = 58;
const LINE_HEIGHT = 15.1;
const FONT_SIZE = 12.8;
const FONT_FAMILY = "Menlo, SFMono-Regular, SF Mono, Roboto Mono, monospace";
const FONT = `500 ${FONT_SIZE}px Menlo`;
const MIN_SLOT_WIDTH = 92;
const START_CURSOR = { segmentIndex: 0, graphemeIndex: 0 };
const ASSET_VERSION =
  typeof window !== "undefined" && window.__OPENING_ASSET_VERSION__
    ? `?v=${window.__OPENING_ASSET_VERSION__}`
    : "";

const ASSETS = {
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

let measureContext = null;

function getMeasureContext() {
  if (!measureContext) {
    const canvas = document.createElement("canvas");
    measureContext = canvas.getContext("2d");
    measureContext.font = FONT;
  }
  return measureContext;
}

function getGlyphAdvance(char) {
  return getMeasureContext().measureText(char === " " ? "\u00A0" : char).width;
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

function createJelly(config) {
  return {
    ...config,
    assetHref: ASSETS[config.assetKey],
    alphaMap: null,
    fit: null,
  };
}

function createScene() {
  return {
    pink: createJelly({
      key: "pink",
      assetKey: "pink",
      x: 54,
      y: 86,
      width: 182,
      height: 344,
      bellClipHeight: 116,
      tailClipY: 164,
      speed: 0.16,
      phase: 0.07,
      amplitudeX: 4.2,
      amplitudeY: 7.5,
      buoyancy: 5.5,
      rotation: 1.8,
      swayFactor: 2.6,
      flowSpeed: 0.95,
    }),
    cyan: createJelly({
      key: "cyan",
      assetKey: "cyan",
      x: 348,
      y: 270,
      width: 364,
      height: 384,
      bellClipHeight: 156,
      tailClipY: 406,
      speed: 0.12,
      phase: 0.22,
      amplitudeX: 6.4,
      amplitudeY: 12.4,
      buoyancy: 9.5,
      rotation: 1.4,
      swayFactor: 4.2,
      flowSpeed: 1.16,
    }),
    violet: createJelly({
      key: "violet",
      assetKey: "violet",
      x: 734,
      y: 232,
      width: 202,
      height: 284,
      bellClipHeight: 108,
      tailClipY: 330,
      speed: 0.14,
      phase: 0.46,
      amplitudeX: 5.2,
      amplitudeY: 10.2,
      buoyancy: 6.4,
      rotation: 1.1,
      swayFactor: 2.8,
      flowSpeed: 1.04,
    }),
    foreground: createJelly({
      key: "foreground",
      assetKey: "cyan",
      x: 236,
      y: 598,
      width: 362,
      height: 352,
      bellClipHeight: 146,
      tailClipY: 730,
      speed: 0.1,
      phase: 0.74,
      amplitudeX: 3.2,
      amplitudeY: 6.2,
      buoyancy: 5.4,
      rotation: 0.9,
      swayFactor: 2.2,
      flowSpeed: 0.84,
      opacity: 0.3,
    }),
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

function getJellyMotion(jelly, timeSeconds) {
  const state = swimState(timeSeconds, jelly.speed, jelly.phase);
  const tx = Math.sin(timeSeconds * (jelly.speed * 2.75) + jelly.phase * 2.3) * jelly.amplitudeX + state.sway * jelly.swayFactor;
  const ty = Math.cos(timeSeconds * (jelly.speed * 2.0) + jelly.phase) * jelly.amplitudeY + state.pulse * jelly.buoyancy;
  const rot = state.sway * jelly.rotation;

  const centerX = jelly.x + jelly.width / 2;
  const centerY = jelly.y + jelly.height / 2;
  const bellCenterY = jelly.y + 18;

  return {
    tx,
    ty,
    rot,
    pulse: state.pulse,
    sway: state.sway,
    drift: state.drift,
    centerX,
    centerY,
    bellCenterY,
  };
}

function maskRangeForJelly(jelly, motion, y) {
  if (!jelly.alphaMap || !jelly.fit) {
    return null;
  }

  const localY = y - (jelly.y + motion.ty + jelly.fit.offsetY);
  if (localY < 0 || localY >= jelly.fit.displayHeight) {
    return null;
  }

  const imageY = Math.max(
    0,
    Math.min(jelly.alphaMap.height - 1, Math.floor((localY / jelly.fit.displayHeight) * jelly.alphaMap.height))
  );
  const row = jelly.alphaMap.rows[imageY];
  if (!row) {
    return null;
  }

  return {
    start: jelly.x + motion.tx + jelly.fit.offsetX + (row.left / jelly.alphaMap.width) * jelly.fit.displayWidth - 18,
    end: jelly.x + motion.tx + jelly.fit.offsetX + (row.right / jelly.alphaMap.width) * jelly.fit.displayWidth + 18,
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

function lineTone(y, slotIndex, slotCount) {
  if (y < 170) {
    return slotIndex === 0 ? "soft" : "dim";
  }
  if (y > 620) {
    return slotCount > 1 ? "soft" : "dim";
  }
  return slotIndex % 2 === 0 ? "bright" : "soft";
}

function clusterKeyForPoint(jellies, x, y) {
  let bestKey = "cyan";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const jelly of jellies) {
    const cx = jelly.x + jelly.width / 2;
    const cy = jelly.y + jelly.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const score = dx * dx + dy * dy * 1.12;
    if (score < bestScore) {
      bestScore = score;
      bestKey = jelly.key;
    }
  }

  return bestKey;
}

function layoutRows(prepared, jellies, motions) {
  const rows = [];
  let cursor = { ...START_CURSOR };

  for (let baselineY = TOP_MARGIN; baselineY <= LOGICAL_HEIGHT - BOTTOM_MARGIN; baselineY += LINE_HEIGHT) {
    const leftWave = Math.sin(baselineY * 0.024) * 18 + Math.sin(baselineY * 0.008) * 8;
    const rightWave = Math.cos(baselineY * 0.02) * 14 + Math.cos(baselineY * 0.009) * 6;
    const baseStart = Math.max(18, LEFT_MARGIN + leftWave);
    const baseEnd = Math.min(LOGICAL_WIDTH - 18, LOGICAL_WIDTH - RIGHT_MARGIN + rightWave);

    const blockedRanges = jellies
      .map((jelly) => maskRangeForJelly(jelly, motions[jelly.key], baselineY - LINE_HEIGHT * 0.35))
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

function computeGlyphs(rows, jellies) {
  const glyphs = [];
  let globalGlyphIndex = 0;

  for (const row of rows) {
    let cursorX = row.x;
    const cluster = clusterKeyForPoint(jellies, row.x + row.width * 0.5, row.y);
    for (const char of Array.from(row.text)) {
      glyphs.push({
        char,
        x: cursorX,
        y: row.y,
        tone: row.tone,
        cluster,
        index: globalGlyphIndex,
      });
      cursorX += getGlyphAdvance(char);
      globalGlyphIndex += 1;
    }
  }

  return glyphs;
}

function createDotPattern(ctx, cellSize, circles) {
  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = cellSize;
  patternCanvas.height = cellSize;
  const pctx = patternCanvas.getContext("2d");
  pctx.clearRect(0, 0, cellSize, cellSize);

  for (const circle of circles) {
    pctx.fillStyle = circle.fill;
    pctx.beginPath();
    pctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
    pctx.fill();
  }

  return ctx.createPattern(patternCanvas, "repeat");
}

function drawBackground(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#02060d");
  gradient.addColorStop(0.28, "#08111d");
  gradient.addColorStop(0.54, "#0a1b2a");
  gradient.addColorStop(0.74, "#06111c");
  gradient.addColorStop(1, "#03070d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glowA = ctx.createRadialGradient(width * 0.18, height * 0.18, 0, width * 0.18, height * 0.18, width * 0.22);
  glowA.addColorStop(0, "rgba(255, 132, 214, 0.08)");
  glowA.addColorStop(1, "rgba(255, 132, 214, 0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, width, height);

  const glowB = ctx.createRadialGradient(width * 0.64, height * 0.3, 0, width * 0.64, height * 0.3, width * 0.26);
  glowB.addColorStop(0, "rgba(106, 237, 255, 0.1)");
  glowB.addColorStop(1, "rgba(106, 237, 255, 0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, width, height);

  const glowC = ctx.createRadialGradient(width * 0.82, height * 0.76, 0, width * 0.82, height * 0.76, width * 0.24);
  glowC.addColorStop(0, "rgba(153, 137, 255, 0.08)");
  glowC.addColorStop(1, "rgba(153, 137, 255, 0)");
  ctx.fillStyle = glowC;
  ctx.fillRect(0, 0, width, height);
}

function drawPaperDots(ctx, width, height) {
  const dotPattern = createDotPattern(ctx, 9, [
    { x: 2.1, y: 2.1, r: 0.7, fill: "rgba(159, 150, 196, 0.16)" },
    { x: 6.2, y: 5.8, r: 0.6, fill: "rgba(135, 198, 255, 0.14)" },
  ]);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = dotPattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawParticles(ctx, width, height, timeSeconds) {
  ctx.save();
  for (let index = 0; index < 24; index += 1) {
    const x = 74 + (index * 41) % 850 + Math.sin(timeSeconds * 0.2 + index * 0.6) * 8;
    const y = 66 + (index * 69) % 620 + Math.cos(timeSeconds * 0.18 + index * 0.7) * 10;
    const r = 1.2 + (index % 4) * 0.7;
    ctx.fillStyle = `rgba(137, 168, 255, ${0.08 + (index % 5) * 0.03})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCutout(ctx, jelly, motion) {
  const image = jelly.image;
  if (!image) {
    return;
  }

  const centerX = jelly.x + jelly.width / 2;
  const centerY = jelly.y + jelly.height / 2;
  const pulse = motion.pulse;
  const overallX = motion.tx;
  const overallY = motion.ty;
  const rotation = (motion.rot * Math.PI) / 180;

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.filter = "blur(18px)";
  ctx.drawImage(image, jelly.x + overallX - 12, jelly.y + overallY + 10, jelly.width, jelly.height);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = Math.max(0.18, (jelly.opacity ?? 0.94) * 0.78);
  ctx.drawImage(image, jelly.x + overallX, jelly.y + overallY, jelly.width, jelly.height);
  ctx.restore();

  const bellScaleX = 1 - pulse * 0.085 + Math.sin(motion.drift) * 0.008;
  const bellScaleY = 1 + pulse * 0.14;
  const bellLift = -pulse * 8.5;
  const tailScaleX = 1 - pulse * 0.025;
  const tailScaleY = 1 + pulse * 0.14;
  const tailShiftX = motion.sway * 4.8;
  const tailShiftY = pulse * 16.5 + Math.abs(motion.drift) * 2.2;
  const tailRotation = (motion.sway * 2.8 * Math.PI) / 180;

  ctx.save();
  ctx.beginPath();
  ctx.rect(jelly.x + overallX, jelly.y + overallY, jelly.width, jelly.bellClipHeight + 30);
  ctx.clip();
  ctx.translate(centerX + overallX, jelly.y + 18 + overallY + bellLift);
  ctx.rotate(rotation);
  ctx.scale(bellScaleX, bellScaleY);
  ctx.translate(-(centerX + overallX), -(jelly.y + 18 + overallY));
  ctx.globalAlpha = Math.min(1, (jelly.opacity ?? 0.94) * 0.92);
  ctx.drawImage(image, jelly.x + overallX, jelly.y + overallY, jelly.width, jelly.height);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(jelly.x + overallX, jelly.tailClipY - 30 + overallY, jelly.width, Math.max(1, jelly.y + jelly.height - jelly.tailClipY + 30));
  ctx.clip();
  ctx.translate(centerX + overallX + tailShiftX, jelly.tailClipY + 104 + overallY + tailShiftY);
  ctx.rotate(rotation + tailRotation);
  ctx.scale(tailScaleX, tailScaleY);
  ctx.translate(-(centerX + overallX), -(jelly.tailClipY + 104 + overallY));
  ctx.globalAlpha = Math.min(1, (jelly.opacity ?? 0.94) * 0.9);
  ctx.drawImage(image, jelly.x + overallX, jelly.y + overallY, jelly.width, jelly.height);
  ctx.restore();
}

function drawSceneImages(ctx, jellies, motions) {
  drawCutout(ctx, jellies.pink, motions.pink);
  drawCutout(ctx, jellies.cyan, motions.cyan);
  drawCutout(ctx, jellies.violet, motions.violet);
  drawCutout(ctx, jellies.foreground, motions.foreground);
}

function computeCharMotion(glyph, jelly, motion, timeSeconds) {
  const bellCenterX = jelly.x + jelly.width / 2 + motion.tx;
  const bellCenterY = jelly.y + 18 + motion.ty - motion.pulse * 8.5;
  const bodyCenterX = jelly.x + jelly.width / 2 + motion.tx + motion.sway * 4.8;
  const bodyCenterY = jelly.tailClipY + 104 + motion.ty + motion.pulse * 16.5;

  const bellDx = glyph.x - bellCenterX;
  const bellDy = glyph.y - bellCenterY;
  const bellDist = Math.hypot(bellDx, bellDy);
  const bellRadius = Math.max(1, bellDist);
  const bellNx = bellDx / bellRadius;
  const bellNy = bellDy / bellRadius;
  const bellTangentX = -bellNy;
  const bellTangentY = bellNx;
  const bellFalloff = Math.max(0, 1 - bellDist / 320);

  const bodyDx = glyph.x - bodyCenterX;
  const bodyDy = glyph.y - bodyCenterY;
  const bodyDist = Math.hypot(bodyDx, bodyDy);
  const bodyRadius = Math.max(1, bodyDist);
  const bodyNx = bodyDx / bodyRadius;
  const bodyNy = bodyDy / bodyRadius;
  const bodyTangentX = -bodyNy;
  const bodyTangentY = bodyNx;
  const bodyFalloff = Math.max(0, 1 - bodyDist / 260);

  const bellSwirl = Math.sin(timeSeconds * 0.86 + glyph.index * 0.08 + bellDist * 0.014) * 4.8 * bellFalloff;
  const bellCompress = motion.pulse * 10.8 * bellFalloff;
  const bodyTrail = (motion.pulse * 14.2 + Math.abs(motion.drift) * 3.4) * bodyFalloff;
  const bodyRipple = Math.sin(timeSeconds * 1.14 + glyph.index * 0.05 + bodyDy * 0.03) * 3.6 * bodyFalloff;
  const ambient = Math.cos(timeSeconds * 0.92 + glyph.index * 0.07) * 0.7;

  const offsetX =
    bellTangentX * bellSwirl -
    bellNx * bellCompress +
    bodyTangentX * bodyRipple +
    motion.sway * (2.2 * bellFalloff + 1.1 * bodyFalloff) +
    ambient +
    motion.tx * (0.34 + bellFalloff * 0.22 + bodyFalloff * 0.18);
  const offsetY =
    bellTangentY * bellSwirl -
    bellNy * bellCompress +
    bodyTrail +
    bodyNy * bodyRipple +
    Math.sin(timeSeconds * 1.06 + glyph.index * 0.09) * 1.2 +
    motion.ty * (0.34 + bellFalloff * 0.22 + bodyFalloff * 0.18);
  const rotation =
    motion.rot * 0.22 +
    bellTangentX * motion.sway * 0.9 +
    bodyTangentX * motion.drift * 0.42 +
    Math.sin(timeSeconds * 0.58 + glyph.index * 0.07) * 0.6 * (bellFalloff + bodyFalloff);

  return { offsetX, offsetY, rotation };
}

function drawGlyphs(ctx, glyphs, jelliesByKey, motions, timeSeconds) {
  ctx.save();
  ctx.font = FONT;
  ctx.textBaseline = "alphabetic";

  for (const glyph of glyphs) {
    const jelly = jelliesByKey[glyph.cluster];
    const motion = motions[glyph.cluster];
    const { offsetX, offsetY, rotation } = computeCharMotion(glyph, jelly, motion, timeSeconds);

    let alpha = 0.74;
    if (glyph.tone === "soft") alpha = 0.42;
    if (glyph.tone === "dim") alpha = 0.2;
    if (glyph.tone === "bright") alpha = 0.92;

    ctx.save();
    ctx.translate(glyph.x + offsetX, glyph.y + offsetY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.fillStyle = `rgba(224, 232, 255, ${alpha})`;
    ctx.fillText(glyph.char === " " ? "\u00A0" : glyph.char, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function resizeCanvas(canvas, logicalWidth, logicalHeight) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform((width / logicalWidth) * dpr, 0, 0, (height / logicalHeight) * dpr, 0, 0);
  return ctx;
}

async function initOpeningCanvas() {
  const sceneRoot = document.querySelector("[data-opening-scene]");
  const canvas = document.querySelector("[data-opening-canvas]");
  if (!(sceneRoot instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness errors and continue.
    }
  }

  const scene = createScene();
  const images = await Promise.all([
    loadImage(scene.pink.assetHref),
    loadImage(scene.cyan.assetHref),
    loadImage(scene.violet.assetHref),
  ]);

  scene.pink.image = images[0];
  scene.cyan.image = images[1];
  scene.violet.image = images[2];
  scene.foreground.image = images[1];

  scene.pink.alphaMap = computeAlphaRows(images[0]);
  scene.cyan.alphaMap = computeAlphaRows(images[1]);
  scene.violet.alphaMap = computeAlphaRows(images[2]);
  scene.foreground.alphaMap = scene.cyan.alphaMap;

  scene.pink.fit = computeImageFit(scene.pink, scene.pink.alphaMap);
  scene.cyan.fit = computeImageFit(scene.cyan, scene.cyan.alphaMap);
  scene.violet.fit = computeImageFit(scene.violet, scene.violet.alphaMap);
  scene.foreground.fit = computeImageFit(scene.foreground, scene.foreground.alphaMap);

  const prepared = prepareWithSegments(TEXT_STREAM, FONT);

  let ctx = resizeCanvas(canvas, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const renderFrame = (timeMs) => {
    const timeSeconds = reduceMotion.matches ? 0 : timeMs / 1000;
    const motions = {
      pink: getJellyMotion(scene.pink, timeSeconds),
      cyan: getJellyMotion(scene.cyan, timeSeconds),
      violet: getJellyMotion(scene.violet, timeSeconds),
      foreground: getJellyMotion(scene.foreground, timeSeconds),
    };

    const rows = layoutRows(prepared, [scene.pink, scene.cyan, scene.violet, scene.foreground], motions);
    const glyphs = computeGlyphs(rows, [scene.pink, scene.cyan, scene.violet, scene.foreground]);

    drawBackground(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawPaperDots(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawParticles(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, timeSeconds);
    drawGlyphs(ctx, glyphs, scene, motions, timeSeconds);
    drawSceneImages(ctx, scene, motions);

    if (!reduceMotion.matches) {
      requestAnimationFrame(renderFrame);
    }
  };

  requestAnimationFrame(renderFrame);

  window.addEventListener("resize", () => {
    ctx = resizeCanvas(canvas, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  });
}

initOpeningCanvas().catch((error) => {
  console.error("Failed to initialize opening canvas:", error);
});
