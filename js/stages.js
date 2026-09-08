// ---------- Drawing helpers ----------
// ---------- Parallax stage (placeholder art -- swap layer images in as they're generated) ----------
let stageTime = 0;
const STAGE_CENTER_X = (STAGE_L + STAGE_R) / 2;

// --- Back layer: distant storm-lit DC skyline (farthest, barely moves) ---
// --- Back layer: distant storm-lit DC skyline, animated (farthest, barely moves) ---
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
const BACK_SRC_W = 1659, BACK_SRC_H = 948;
const BACK_SCALE = (canvas.width + 100) / BACK_SRC_W; // full-width cover + a little extra for panning headroom
const BACK_DRAW_W = BACK_SRC_W * BACK_SCALE;
const BACK_DRAW_H = BACK_SRC_H * BACK_SCALE;
const BACK_DRAW_Y = -(BACK_DRAW_H - canvas.height) / 2; // center-crop vertically

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

// --- Front layer: the colonnade/Lincoln statue, transparent gaps show the skyline behind (nearer, moves more) ---
const bgFrontImg = new Image();
bgFrontImg.src = "assets/stages/dc-memorial-front.webp";
const FRONT_SRC_W = 1672, FRONT_SRC_H = 941;
// alignment: source-image y-coordinate of the plaza spot fighters should stand on --
// adjust FRONT_STAND_Y_SOURCE if fighters look like they're floating or sunk into the floor
const FRONT_STAND_Y_SOURCE = 830;
const FRONT_SCALE = 620 / FRONT_SRC_H;
const FRONT_DRAW_W = FRONT_SRC_W * FRONT_SCALE;
const FRONT_DRAW_H = FRONT_SRC_H * FRONT_SCALE;
const FRONT_DRAW_Y = (GROUND_Y + 20) - (FRONT_STAND_Y_SOURCE * FRONT_SCALE);

function drawStage() {
  stageTime++;
  // camera offset: shifts subtly as fighters spread apart or cluster, driving the parallax
  const midX = (p1.x + p2.x) / 2;
  const camOffset = (midX - STAGE_CENTER_X) * -1;

  // --- Back layer: distant skyline (barely moves; buildings never change, only lightning flashes) ---
  updateSky();
  const backX = camOffset * 0.06 - (BACK_DRAW_W - canvas.width) / 2;
  const baseImg = skyFrames[SKY_BASE_FRAME];
  if (baseImg.complete && baseImg.naturalWidth > 0) {
    ctx.drawImage(baseImg, backX, BACK_DRAW_Y, BACK_DRAW_W, BACK_DRAW_H);
    if (skyFlashing) {
      const lightningImg = skyFrames[1 + skyFlashStep];
      ctx.globalCompositeOperation = 'lighten';
      ctx.drawImage(lightningImg, backX, BACK_DRAW_Y, BACK_DRAW_W, BACK_DRAW_H);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    ctx.fillStyle = '#14141c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // --- Front layer: the colonnade/Lincoln statue, transparent gaps reveal the skyline behind ---
  const frontX = camOffset * 0.15 - (FRONT_DRAW_W - canvas.width) / 2;
  if (bgFrontImg.complete && bgFrontImg.naturalWidth > 0) {
    ctx.drawImage(bgFrontImg, frontX, FRONT_DRAW_Y, FRONT_DRAW_W, FRONT_DRAW_H);
  }


  // ground line (fixed, matches physics ground -- not parallaxed so it stays under the fighters)
  ctx.strokeStyle = 'rgba(58,58,70,0.4)';
  ctx.beginPath(); ctx.moveTo(STAGE_L, GROUND_Y+20); ctx.lineTo(STAGE_R, GROUND_Y+20); ctx.stroke();
}

