// ---------- Drawing helpers ----------
// ---------- Parallax stage (placeholder art -- swap layer images in as they're generated) ----------
let stageTime = 0;
const STAGE_CENTER_X = (STAGE_L + STAGE_R) / 2;

// Which stage a match uses is picked from the two chosen characters (see pickStageFor,
// called from input.js right before resetRound()). Add a character key to a stage's
// list below to make that stage show up whenever that character is picked.
let currentStage = 'memorial';
const STAGE_FOR_CHAR = {
  bayou: ['frontman', 'ladyvoix'],
};
function pickStageFor(key1, key2) {
  for (const [stage, keys] of Object.entries(STAGE_FOR_CHAR)) {
    if (keys.includes(key1) || keys.includes(key2)) return stage;
  }
  return 'memorial';
}

function bboxOfImage(img, alphaThresh = 40) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const cctx = c.getContext('2d');
  cctx.drawImage(img, 0, 0);
  const data = cctx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, maxX = -1, minY = c.height, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] >= alphaThresh) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// --- Memorial stage: distant storm-lit DC skyline (farthest, barely moves), animated ---
const MEMORIAL_BACK_SRC_W = 1659, MEMORIAL_BACK_SRC_H = 948;
const MEMORIAL_BACK_SCALE = (canvas.width + 100) / MEMORIAL_BACK_SRC_W; // full-width cover + panning headroom
const MEMORIAL_BACK_DRAW_W = MEMORIAL_BACK_SRC_W * MEMORIAL_BACK_SCALE;
const MEMORIAL_BACK_DRAW_H = MEMORIAL_BACK_SRC_H * MEMORIAL_BACK_SCALE;
const MEMORIAL_BACK_DRAW_Y = -(MEMORIAL_BACK_DRAW_H - canvas.height) / 2; // center-crop vertically

const MEMORIAL_FRONT_SRC_W = 1672, MEMORIAL_FRONT_SRC_H = 941;
const MEMORIAL_FRONT_SCALE = 620 / MEMORIAL_FRONT_SRC_H;
const MEMORIAL_FRONT_DRAW_W = MEMORIAL_FRONT_SRC_W * MEMORIAL_FRONT_SCALE;
const MEMORIAL_FRONT_DRAW_H = MEMORIAL_FRONT_SRC_H * MEMORIAL_FRONT_SCALE;

const skyFrameSrcs = [
  "assets/stages/dc-skyline-base.webp",
  "assets/stages/dc-skyline-lightning-1.webp",
  "assets/stages/dc-skyline-lightning-2.webp"
];
const skyFrames = skyFrameSrcs.map(src => { const i = new Image(); i.src = src; return i; });
const SKY_BASE_FRAME = 0; // the skyline/buildings are locked to this single frame -- never swapped, so nothing shifts
let skyTimer = 0;
let skyFlashing = false;
let skyFlashStep = 0;

function updateSky() {
  skyTimer++;
  if (skyFlashing) {
    if (skyTimer > 5) { // hold each flash frame briefly
      skyTimer = 0;
      skyFlashStep++;
      if (skyFlashStep > 1) { skyFlashing = false; skyFlashStep = 0; }
    }
    return;
  }
  if (skyTimer > 90) {
    skyTimer = 0;
    if (Math.random() < 0.15) skyFlashing = true; // occasional, irregular lightning strike
  }
}

// Front layer: the colonnade/Lincoln statue, transparent gaps show the skyline behind (nearer, moves more)
const bgFrontImg = new Image();
bgFrontImg.src = "assets/stages/dc-memorial-front.webp";
// alignment: source-image y-coordinate of the plaza spot fighters should stand on --
// adjust if fighters look like they're floating or sunk into the floor
const MEMORIAL_STAND_Y_SOURCE = 830;
const MEMORIAL_DRAW_Y = (GROUND_Y + 20) - (MEMORIAL_STAND_Y_SOURCE * MEMORIAL_FRONT_SCALE);

// --- Bayou stage: a jazz lounge whose windows look out on a moonlit gator bayou ---
// Every scale/position constant here is independent of the memorial's -- despite the
// back and front source photos happening to share the memorial's pixel dimensions, nothing
// about this stage's composition (window size/position, how "close" the band and gators
// were shot) matches the memorial, so reusing its constants was the root cause of the
// band/gators both rendering oversized. See the two lessons on scale drift and matching
// pixel dimensions in README.md's asset-tooling notes before changing any of these.

// Front layer: the lounge interior (piano, curtains, neon). BAYOU_FRONT_SCALE has to
// clear a higher floor than just "covers the canvas width at rest" (1000/1672≈0.598) --
// drawStage()'s camera pan (camOffset*0.15) can shift this layer up to ~69px off-center
// at extreme fighter positions, so the real floor has to add that pan range on both
// sides: FRONT_DRAW_W >= 1000 + 2*69 = 1138, i.e. BAYOU_FRONT_SCALE >= 1138/1672≈0.681.
// The original 0.61 was only checked against the static floor and left a real gap open
// at the screen edge whenever both fighters pushed to one side -- with nothing clearing
// the canvas between frames, that gap showed the *previous* frame's pixels rather than
// black, which read as a smeared/ghosted edge rather than an obvious hole. Going smaller
// than this floor to make the room look smaller relative to the fighters isn't an option;
// that adjustment has to happen via STAGE_HEIGHT_SCALE in fighter.js instead, which
// upscales fighters specifically on this stage (scaled up to match, below, since making
// the room bigger here would otherwise make fighters look relatively smaller again).
const BAYOU_FRONT_SRC_W = 1672, BAYOU_FRONT_SRC_H = 941;
const BAYOU_FRONT_SCALE = 0.685;
const BAYOU_FRONT_DRAW_W = BAYOU_FRONT_SRC_W * BAYOU_FRONT_SCALE;
const BAYOU_FRONT_DRAW_H = BAYOU_FRONT_SRC_H * BAYOU_FRONT_SCALE;
const bayouFrontImg = new Image();
bayouFrontImg.src = "assets/stages/bayou/front.webp";
const BAYOU_STAND_Y_SOURCE = 830; // same convention as MEMORIAL_STAND_Y_SOURCE -- tune if fighters look off the floor
const BAYOU_DRAW_Y = (GROUND_Y + 20) - (BAYOU_STAND_Y_SOURCE * BAYOU_FRONT_SCALE);

// The lounge's windows (transparent cutouts in front.webp revealing the back layer) span
// this source-pixel range -- found by scanning for transparent columns/rows, not by eye.
const BAYOU_WINDOW_SRC = { x0: 497, x1: 1578, y0: 31, y1: 496 };

// Back layer: the bayou itself, seen through the window. BAYOU_BACK_SCALE only needs to
// cover the window's on-screen span (plus a little panning headroom), not the full
// canvas -- the window is much narrower than the canvas, so this can be (and needs to
// be, for the gators to not look huge) considerably smaller than a full-canvas-cover
// scale would be. Shrinking it further than this floor reopens a gap at the window's
// edges, the same way shrinking BAYOU_FRONT_SCALE would gap the canvas edges.
const BAYOU_BACK_SRC_W = 1659, BAYOU_BACK_SRC_H = 948;
const BAYOU_BACK_SCALE = 0.46;
const BAYOU_BACK_DRAW_W = BAYOU_BACK_SRC_W * BAYOU_BACK_SCALE;
const BAYOU_BACK_DRAW_H = BAYOU_BACK_SRC_H * BAYOU_BACK_SCALE;
// Where the back layer sits: horizontally centered on the window (not the canvas -- the
// window isn't centered on the canvas either); vertically positioned so the water/gators
// (around BAYOU_BACK_GATOR_SRC_Y in the source photo) land in the middle of the window's
// visible span, rather than the sky/tree canopy nearer the source image's own center.
const BAYOU_WINDOW_CENTER_SCREEN_X = -(BAYOU_FRONT_DRAW_W - canvas.width) / 2
  + ((BAYOU_WINDOW_SRC.x0 + BAYOU_WINDOW_SRC.x1) / 2) * BAYOU_FRONT_SCALE;
const BAYOU_BACK_BASE_X = BAYOU_WINDOW_CENTER_SCREEN_X - BAYOU_BACK_DRAW_W / 2;
const BAYOU_BACK_GATOR_SRC_Y = 650;
const BAYOU_BACK_TARGET_SCREEN_Y = BAYOU_DRAW_Y
  + ((BAYOU_WINDOW_SRC.y0 + Math.min(BAYOU_WINDOW_SRC.y1, BAYOU_WINDOW_SRC.y0 + (canvas.height - BAYOU_DRAW_Y) / BAYOU_FRONT_SCALE)) / 2) * BAYOU_FRONT_SCALE;
const BAYOU_BACK_DRAW_Y = BAYOU_BACK_TARGET_SCREEN_Y - BAYOU_BACK_GATOR_SRC_Y * BAYOU_BACK_SCALE;

const bayouBackSrcs = [1, 2, 3, 4, 5].map(n => `assets/stages/bayou/back-${n}.webp`);
const bayouBackFrames = bayouBackSrcs.map(src => { const i = new Image(); i.src = src; return i; });
let bayouBackTimer = 0;
let bayouBackFrame = 0;

// Band overlay: the combo performing on the lounge's stage, in front of the piano. This
// is NOT drawn at the front layer's own scale -- the band photo was shot much "closer"
// than the room photo, so at 1:1 scale the musicians rendered roughly twice as tall as
// a fighter. BAYOU_BAND_SCALE_K is an extra shrink on top of BAYOU_FRONT_SCALE, and
// BOTH it and the fighters' own STAGE_HEIGHT_SCALE.bayou (in fighter.js) are calibrated
// off the same reference: the room's grand piano, whose real-world height is well known
// (unlike an arbitrary "looks about right" comparison). With the piano's open-lid tip
// positioned at BAYOU_STAND_Y_SOURCE-relative source y≈175, a standing adult's head
// should land at roughly that same height or a little above it -- BAYOU_BAND_SCALE_K
// and STAGE_HEIGHT_SCALE.bayou were both picked so a person (band member or fighter)
// reaches that line. Matching pixel dimensions between two source images still doesn't
// mean matching apparent scale (see the README note), so this was verified by rendering
// the piano crop, a band frame, and a fighter sprite together at candidate scales and
// checking head heights against the lid-tip line, not by eyeballing panels separately.
// The band's own bounding box is anchored by its feet at BAYOU_BAND_ANCHOR_SRC, positioned
// just right of the piano bench so the group reads as performing in front of the piano
// rather than off to the side of the room. Loops continuously.
const BAYOU_BAND_SCALE_K = 0.45;
// The piano sits on a small raised, curved stage/dais -- not on the main dance floor at
// BAYOU_STAND_Y_SOURCE like the fighters -- so the band's feet are anchored to that
// dais's own (higher, i.e. smaller source-y) surface, found by scanning the front
// layer for the riser's top edge, rather than to the main floor line.
const BAYOU_BAND_ANCHOR_SRC = { x: 300, y: 548 };
const bayouBandSrcs = [1, 2, 3, 4].map(n => `assets/stages/bayou/band-${n}.webp`);
const bayouBandFrames = bayouBandSrcs.map(src => { const i = new Image(); i.src = src; return i; });
let bayouBandTimer = 0;
let bayouBandFrame = 0;
// Band frames' opaque bounding box, computed once per image on load (needed to crop+scale
// them independently of the front layer -- see BAYOU_BAND_SCALE_K above).
const bayouBandBboxes = bayouBandFrames.map(() => null);
bayouBandFrames.forEach((img, i) => {
  img.addEventListener('load', () => { bayouBandBboxes[i] = bboxOfImage(img); });
});

function updateBayouAnim() {
  bayouBackTimer++;
  if (bayouBackTimer > 14) { bayouBackTimer = 0; bayouBackFrame = (bayouBackFrame + 1) % bayouBackFrames.length; }
  bayouBandTimer++;
  if (bayouBandTimer > 10) { bayouBandTimer = 0; bayouBandFrame = (bayouBandFrame + 1) % bayouBandFrames.length; }
}

function drawStage() {
  stageTime++;
  // Defensive base fill -- nothing here clears the canvas between frames otherwise, so
  // if a layer's coverage math is ever off (a panning gap opening at an extreme camera
  // offset, an image still loading, etc.), the gap would show the *previous* frame's
  // pixels instead of a plain background, which reads as a smeared/ghosted edge rather
  // than an obvious hole. See the note on BAYOU_FRONT_SCALE's pan-range floor below for
  // a case that actually happened.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // camera offset: shifts subtly as fighters spread apart or cluster, driving the parallax
  const midX = (p1.x + p2.x) / 2;
  const camOffset = (midX - STAGE_CENTER_X) * -1;

  if (currentStage === 'bayou') {
    updateBayouAnim();

    const backX = camOffset * 0.06 + BAYOU_BACK_BASE_X;
    const frontX = camOffset * 0.15 - (BAYOU_FRONT_DRAW_W - canvas.width) / 2;

    const backImg = bayouBackFrames[bayouBackFrame];
    if (backImg.complete && backImg.naturalWidth > 0) {
      ctx.drawImage(backImg, backX, BAYOU_BACK_DRAW_Y, BAYOU_BACK_DRAW_W, BAYOU_BACK_DRAW_H);
    } else {
      ctx.fillStyle = '#0b0f0c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (bayouFrontImg.complete && bayouFrontImg.naturalWidth > 0) {
      ctx.drawImage(bayouFrontImg, frontX, BAYOU_DRAW_Y, BAYOU_FRONT_DRAW_W, BAYOU_FRONT_DRAW_H);
    }

    const bandImg = bayouBandFrames[bayouBandFrame];
    const bandBbox = bayouBandBboxes[bayouBandFrame];
    if (bandImg.complete && bandImg.naturalWidth > 0 && bandBbox) {
      const s = BAYOU_FRONT_SCALE * BAYOU_BAND_SCALE_K;
      const drawW = bandBbox.w * s, drawH = bandBbox.h * s;
      const anchorX = frontX + BAYOU_BAND_ANCHOR_SRC.x * BAYOU_FRONT_SCALE;
      const anchorY = BAYOU_DRAW_Y + BAYOU_BAND_ANCHOR_SRC.y * BAYOU_FRONT_SCALE;
      ctx.drawImage(bandImg, bandBbox.minX, bandBbox.minY, bandBbox.w, bandBbox.h,
        anchorX - drawW / 2, anchorY - drawH, drawW, drawH);
    }
  } else {
    // --- Memorial stage (default) ---
    const backX = camOffset * 0.06 - (MEMORIAL_BACK_DRAW_W - canvas.width) / 2;
    const frontX = camOffset * 0.15 - (MEMORIAL_FRONT_DRAW_W - canvas.width) / 2;

    updateSky();
    const baseImg = skyFrames[SKY_BASE_FRAME];
    if (baseImg.complete && baseImg.naturalWidth > 0) {
      ctx.drawImage(baseImg, backX, MEMORIAL_BACK_DRAW_Y, MEMORIAL_BACK_DRAW_W, MEMORIAL_BACK_DRAW_H);
      if (skyFlashing) {
        const lightningImg = skyFrames[1 + skyFlashStep];
        ctx.globalCompositeOperation = 'lighten';
        ctx.drawImage(lightningImg, backX, MEMORIAL_BACK_DRAW_Y, MEMORIAL_BACK_DRAW_W, MEMORIAL_BACK_DRAW_H);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      ctx.fillStyle = '#14141c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (bgFrontImg.complete && bgFrontImg.naturalWidth > 0) {
      ctx.drawImage(bgFrontImg, frontX, MEMORIAL_DRAW_Y, MEMORIAL_FRONT_DRAW_W, MEMORIAL_FRONT_DRAW_H);
    }
  }

  // ground line (fixed, matches physics ground -- not parallaxed so it stays under the fighters)
  ctx.strokeStyle = 'rgba(58,58,70,0.4)';
  ctx.beginPath(); ctx.moveTo(STAGE_L, GROUND_Y+20); ctx.lineTo(STAGE_R, GROUND_Y+20); ctx.stroke();
}
