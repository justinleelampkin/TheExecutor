// ---------- Name logo graphics ----------
// (the old eager sethNameLogo/libertyNameLogo are gone: every roster entry now loads its own
// logo on first use -- see the nameLogoImg getter below)

// ---------- Character select ----------
const csBackdropImg = new Image();
csBackdropImg.src = "assets/ui/character-select-backdrop.webp";

const ROSTER = [
  { key: 'seth',       name: 'WHITE NOISE',   color: '#2b2b33', accent: '#7c4dff', unlocked: true,  tileSrc: "assets/portraits/white-noise.webp",   nameLogoSrc: "assets/logos/white-noise.webp" },
  { key: 'liberty',    name: 'LIBERTY BELLE', color: '#8a1f2b', accent: '#ffd54a', unlocked: true,  tileSrc: "assets/portraits/liberty-belle.webp", nameLogoSrc: "assets/logos/liberty-belle.webp" },
  { key: 'rainwalker', name: 'RAINWALKER',    color: '#2b3a3a', accent: '#3ad6d6', unlocked: true,  tileSrc: "assets/portraits/rainwalker.webp", nameLogoSrc: "assets/logos/rainwalker.webp" },
  { key: 'phi',        name: 'P.H.I.',        color: '#3a2e14', accent: '#d4a63a', unlocked: true,  tileSrc: "assets/portraits/phi.webp",        nameLogoSrc: "assets/logos/phi.webp" },
  { key: 'coyote',     name: 'THE COYOTE',    color: '#333', accent: '#888', unlocked: true,  tileSrc: "assets/portraits/coyote.webp",     nameLogoSrc: "assets/logos/coyote.webp" },
  { key: 'frontman',   name: 'FRONTMAN',      color: '#2b1a33', accent: '#a259e6', unlocked: true,  tileSrc: "assets/portraits/frontman.webp",   nameLogoSrc: "assets/logos/frontman.webp" },
  { key: 'ladyvoix',   name: 'LADY VOIX',     color: '#3a1a33', accent: '#c04fd1', unlocked: true,  tileSrc: "assets/portraits/lady-voix.webp",  nameLogoSrc: "assets/logos/lady-voix.webp" },
  { key: 'botanist',   name: 'THE BOTANIST',  color: '#2b3a1f', accent: '#8fd14f', unlocked: true,  tileSrc: "assets/portraits/botanist.webp",   nameLogoSrc: "assets/logos/botanist.webp" },
  { key: 'architech',  name: 'ARCHI-TECH',    color: '#5a1a1a', accent: '#f2b013', unlocked: true,  tileSrc: "assets/portraits/archi-tech.webp", nameLogoSrc: "assets/logos/archi-tech.webp" },
  { key: 'echo',       name: 'ECHO',          color: '#1a2233', accent: '#8fb4ff', unlocked: true,  tileSrc: "assets/portraits/echo.webp",       nameLogoSrc: "assets/logos/echo.webp" },
];
// Portrait tiles load up front (small, and the select grid needs all of them); the name logo
// is created the first time something asks for it (hovered on select, or shown in the HUD).
ROSTER.forEach(r => {
  r.tileImg = new Image(); r.tileImg.src = r.tileSrc;
  Object.defineProperty(r, "nameLogoImg", { get() { if (!this._logo) { this._logo = new Image(); this._logo.src = this.nameLogoSrc; } return this._logo; } });
});

let characterSelectActive = false;
let csPhase = 'p1'; // 'p1' | 'p2' (2-player) | 'cpu' (1-player: the player picks the CPU's opponent)
let csCursor = 0;
let p1Choice = null;
let p2Choice = null;
let csPreviewTimer = 0;
// true while a just-confirmed pick's select-voice line is still playing -- input.js
// blocks cursor/confirm input and holds off the phase transition (p1->p2, or into
// the match) until it clears, so the screen "stalls" on the pick instead of cutting
// away over the voice line. A character with no voice line never sets this (see
// playCharacterSelectVoice's return value in audio.js).
let csAwaitingVoice = false;
let csPreviewFrame = 0;

// What the cursor can move over on the current screen. Picking your own fighter (and 2-player)
// shows only the playable roster; picking the CPU's opponent in 1-player mode also lists the
// opponent-only characters (BOSS_ROSTER, defined at the bottom of this file).
function csList() {
  return csPhase === 'cpu' ? ROSTER.concat(BOSS_ROSTER) : ROSTER;
}
function csSelectable(r) { return r.unlocked || (csPhase === 'cpu' && r.opponentOk); }
function csNextUnlocked(from, dir) {
  const list = csList();
  let i = from;
  for (let n = 0; n < list.length; n++) {
    i = (i + dir + list.length) % list.length;
    if (csSelectable(list[i])) return i;
  }
  return from;
}

function applyRosterChoice(fighter, choice) {
  fighter.spriteKey = choice.key;
  fighter.name = choice.name;
  fighter.color = choice.color;
  fighter.accent = choice.accent;
  // Every one of these is an index into the *previous* character's animation frame
  // arrays -- left stale, a value that was in-bounds there (e.g. idleFrame=5 for
  // Liberty's 6-frame idle) can be out-of-bounds for the new character's own frame
  // count (Seth's idle is only 4 frames) for up to ~14 ticks, until that counter's own
  // timer happens to roll over and re-clamp it via modulo. Reachable in practice once
  // players can return to character select mid-session and pick someone with fewer
  // frames in some animation than whoever they just played.
  fighter.animFrame = 0; fighter.animTimer = 0;
  fighter.idleFrame = 0; fighter.idleTimer = 0;
  fighter.crouchFrame = 0; fighter.crouchTimer = 0; fighter.crouchAnimTimer = 0; fighter.crouchPhase = 'idle';
  fighter.airAttack = null; fighter.airAttackTimer = 0; fighter.airAttackUsed = false;
  fighter.victoryVariant = 'victory';
}

function drawCharacterSelect() {
  csPreviewTimer++;
  // same cadence as the in-match idle (IDLE_TICKS_PER_FRAME); the counter just keeps
  // climbing and is wrapped per-character below, so 5- and 6-frame idles loop fully
  // (a fixed %4 here used to skip their last frame)
  if (csPreviewTimer >= IDLE_TICKS_PER_FRAME) { csPreviewTimer = 0; csPreviewFrame++; }

  if (csBackdropImg.complete && csBackdropImg.naturalWidth > 0) {
    const scale = canvas.width / csBackdropImg.width;
    const drawH = csBackdropImg.height * scale;
    ctx.drawImage(csBackdropImg, 0, -(drawH - canvas.height) / 2, canvas.width, drawH);
  } else {
    ctx.fillStyle = '#0b0b0e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // header
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
  const header = csPhase === 'cpu' ? 'CHOOSE YOUR OPPONENT' : (vsCPU ? 'CHOOSE YOUR FIGHTER' : (csPhase === 'p1' ? 'PLAYER 1' : 'PLAYER 2') + ': CHOOSE YOUR FIGHTER');
  ctx.fillText(header, canvas.width / 2, 40);
  ctx.shadowBlur = 0;

  // grid: 5 columns, as many rows as the list needs (1-player opponent pick adds the bosses),
  // each row centred so a short last row doesn't hug the left edge
  const list = csList();
  const cols = 5;
  const rows = Math.ceil(list.length / cols);
  const tileW = 92, tileH = rows > 2 ? 124 : 130, gap = 8;
  const gridY = 66;

  list.forEach((r, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const inRow = Math.min(cols, list.length - row * cols);
    const rowW = inRow * tileW + (inRow - 1) * gap;
    const tx = (canvas.width - rowW) / 2 + col * (tileW + gap);
    const ty = gridY + row * (tileH + gap);
    if (r.tileImg && r.tileImg.complete && r.tileImg.naturalWidth > 0) {
      ctx.drawImage(r.tileImg, tx, ty, tileW, tileH);
    } else if (!r.tileImg) {
      // no portrait yet (opponent-only characters): a plain name card in their colours
      ctx.fillStyle = '#16161c'; ctx.fillRect(tx, ty, tileW, tileH);
      ctx.strokeStyle = r.accent || '#888'; ctx.lineWidth = 2; ctx.strokeRect(tx + 1, ty + 1, tileW - 2, tileH - 2); ctx.lineWidth = 1;
      ctx.fillStyle = r.accent || '#ccc'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      const words = r.name.split(' '); words.forEach((w, k) => ctx.fillText(w, tx + tileW / 2, ty + tileH / 2 + (k - (words.length - 1) / 2) * 16));
      ctx.font = '9px monospace'; ctx.fillStyle = '#888'; ctx.fillText('BOSS', tx + tileW / 2, ty + tileH - 8);
    }
    if (!csSelectable(r)) {
      ctx.fillStyle = 'rgba(10,10,14,0.72)';
      ctx.fillRect(tx, ty, tileW, tileH);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(tx, ty, tileW, tileH);
    }
    if (i === csCursor) {
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 3;
      ctx.strokeRect(tx - 2, ty - 2, tileW + 4, tileH + 4);
      ctx.lineWidth = 1;
    }
  });

  // side preview: hovered character's idle animation + stylized name logo (above it, large)
  const choice = list[csCursor];
  // preview art for whoever the cursor is on (idle only -- the full set loads on pick)
  loadCharacterSprites(choice.key, true);
  const onLeft = csPhase !== 'p2' && csPhase !== 'cpu'; // the CPU's opponent previews on the right, like player 2
  const previewX = onLeft ? 90 : canvas.width - 90;
  // Base preview height for every character; CHAR_HEIGHT_SCALE corrects it per-character
  // the same way drawSpriteFrame() does in-game, anchored to a fixed floor line so
  // characters don't all render at a visually mismatched height here just because the
  // in-game correction never got applied to this preview.
  const baseSpriteH = 210 * 1.75;
  const floorY = canvas.height - 20;
  const idleAnim = SPRITES[choice.key] && SPRITES[choice.key].idle;
  const idleReady = !!(idleAnim && idleAnim.loaded >= idleAnim.count);
  if (idleReady) {
    const frame = csPreviewFrame % idleAnim.count;
    const img = idleAnim.imgs[frame];
    const previewSpriteH = baseSpriteH * (CHAR_HEIGHT_SCALE[choice.key] || 1);
    const drawW = previewSpriteH * (img.width / img.height);
    ctx.save();
    if (!onLeft) { ctx.translate(previewX, 0); ctx.scale(-1, 1); ctx.translate(-previewX, 0); }
    ctx.drawImage(img, previewX - drawW / 2, floorY - previewSpriteH, drawW, previewSpriteH);
    ctx.restore();
  }
  const nameLogo = choice.nameLogoSrc ? choice.nameLogoImg : null; // opponent-only characters have no logo yet
  if (nameLogo && nameLogo.complete && nameLogo.naturalWidth > 0) {
    const logoH = 60;
    const logoW = logoH * (nameLogo.width / nameLogo.height);
    const logoY = (canvas.height - baseSpriteH - 20) - logoH - 8;
    // keep wide logos fully on screen (the preview sits 90px from the edge, a 190px logo overhung it)
    const logoX = Math.max(8, Math.min(canvas.width - 8 - logoW, previewX - logoW / 2));
    ctx.drawImage(nameLogo, logoX, logoY, logoW, logoH);
  }

  ctx.font = '13px monospace';
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'center';
  ctx.fillText('←/→ choose · confirm to lock in', canvas.width / 2, canvas.height - 6);
}

// Slightly slower than a real 60fps rAF cadence -- uniformly slows every tick-based
// system (movement, gravity, attack timers, animation frames) since they all advance
// once per scheduled call here, without needing to touch each speed constant individually.

// ---------- Pre-match loading ----------
// Character sprites download on demand (see loadCharacterSprites() in fighter.js), so once
// both fighters are chosen the match waits here until their art is in. Downloads start at the
// moment each character is picked, so by the time the select voice line finishes this is
// usually already done and the screen never shows.
let matchLoadingActive = false;
let matchLoadingTimer = 0;
function startMatchWhenReady() {
  currentStage = pickStageFor(p1Choice.key, p2Choice.key);
  loadCharacterSprites(p1Choice.key);
  loadStageAssets(currentStage);
  loadCharacterSprites(p2Choice.key);
  characterSelectActive = false;
  matchLoadingActive = true;
  matchLoadingTimer = 0;
}

function drawMatchLoading() {
  matchLoadingTimer++;
  const ready = characterSpritesReady(p1Choice.key) && characterSpritesReady(p2Choice.key) && stageAssetsReady(currentStage);
  if (ready) {
    matchLoadingActive = false;
    resetRound();
    return;
  }
  ctx.fillStyle = '#0b0b0e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('LOADING FIGHTERS' + '.'.repeat(1 + Math.floor(matchLoadingTimer / 16) % 3), canvas.width / 2, canvas.height / 2 - 30);
  [[p1Choice, 0], [p2Choice, 1]].forEach(([choice, i]) => {
    const pct = characterSpriteProgress(choice.key);
    const w = 320, x = canvas.width / 2 - w / 2, y = canvas.height / 2 + 6 + i * 44;
    ctx.fillStyle = '#aaa'; ctx.font = '13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(choice.name, x, y - 2);
    ctx.fillStyle = '#222'; ctx.fillRect(x, y + 4, w, 10);
    ctx.fillStyle = choice.accent || '#ffd54a'; ctx.fillRect(x, y + 4, w * pct, 10);
    ctx.strokeStyle = '#555'; ctx.strokeRect(x, y + 4, w, 10);
  });
  ctx.textAlign = 'left';
}

// ---------- Opponent-only characters ----------
// Bosses / secret opponents: fully fightable (same Fighter + SPRITES machinery) but NOT on the
// select grid, so they live outside ROSTER (adding one there would also reshape the grid).
// Story mode picks from here; `bossRoster(key)` finds an entry in either list.
const BOSS_ROSTER = [
  { key: 'yeats', name: 'WILLOW YEATS', color: '#e8e8e8', accent: '#2ecc71', unlocked: false, playable: false, opponentOk: true, nameLogoSrc: "assets/logos/yeats.webp" },
  { key: 'skoll', name: 'SKOLL', color: '#e8e8e8', accent: '#d8232a', unlocked: false, playable: false, opponentOk: true, nameLogoSrc: "assets/logos/skoll.webp" },
];
// opponent-only entries get the same lazy name-logo getter the playable roster has
BOSS_ROSTER.forEach(r => {
  if (r.nameLogoSrc) Object.defineProperty(r, "nameLogoImg", { get() { if (!this._logo) { this._logo = new Image(); this._logo.src = this.nameLogoSrc; } return this._logo; } });
});
function bossRoster(key) { return BOSS_ROSTER.find(b => b.key === key) || ROSTER.find(r => r.key === key); }
