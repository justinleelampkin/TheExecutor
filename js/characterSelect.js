// ---------- Name logo graphics ----------
const sethNameLogo = new Image();
sethNameLogo.src = "assets/logos/white-noise.webp";
const libertyNameLogo = new Image();
libertyNameLogo.src = "assets/logos/liberty-belle.webp";

// ---------- Character select ----------
const csBackdropImg = new Image();
csBackdropImg.src = "assets/ui/character-select-backdrop.webp";

const ROSTER = [
  { key: 'seth',       name: 'WHITE NOISE',   color: '#2b2b33', accent: '#7c4dff', unlocked: true,  tileSrc: "assets/portraits/white-noise.webp",   nameLogoSrc: "assets/logos/white-noise.webp" },
  { key: 'liberty',    name: 'LIBERTY BELLE', color: '#8a1f2b', accent: '#ffd54a', unlocked: true,  tileSrc: "assets/portraits/liberty-belle.webp", nameLogoSrc: "assets/logos/liberty-belle.webp" },
  { key: 'rainwalker', name: 'RAINWALKER',    color: '#333', accent: '#888', unlocked: false, tileSrc: "assets/portraits/rainwalker.webp", nameLogoSrc: "assets/logos/rainwalker.webp" },
  { key: 'phi',        name: 'P.H.I.',        color: '#333', accent: '#888', unlocked: false, tileSrc: "assets/portraits/phi.webp",        nameLogoSrc: "assets/logos/phi.webp" },
  { key: 'coyote',     name: 'THE COYOTE',    color: '#333', accent: '#888', unlocked: false, tileSrc: "assets/portraits/coyote.webp",     nameLogoSrc: "assets/logos/coyote.webp" },
  { key: 'frontman',   name: 'FRONTMAN',      color: '#333', accent: '#888', unlocked: false, tileSrc: "assets/portraits/frontman.webp",   nameLogoSrc: "assets/logos/frontman.webp" },
  { key: 'ladyvoix',   name: 'LADY VOIX',     color: '#333', accent: '#888', unlocked: false, tileSrc: "assets/portraits/lady-voix.webp",  nameLogoSrc: "assets/logos/lady-voix.webp" },
  { key: 'botanist',   name: 'THE BOTANIST',  color: '#2b3a1f', accent: '#8fd14f', unlocked: true,  tileSrc: "assets/portraits/botanist.webp",   nameLogoSrc: "assets/logos/botanist.webp" },
  { key: 'architech',  name: 'ARCHI-TECH',    color: '#333', accent: '#888', unlocked: false, tileSrc: "assets/portraits/archi-tech.webp", nameLogoSrc: "assets/logos/archi-tech.webp" },
  { key: 'echo',       name: 'ECHO',          color: '#333', accent: '#888', unlocked: false, tileSrc: "assets/portraits/echo.webp",       nameLogoSrc: "assets/logos/echo.webp" },
];
ROSTER.forEach(r => { r.tileImg = new Image(); r.tileImg.src = r.tileSrc; r.nameLogoImg = new Image(); r.nameLogoImg.src = r.nameLogoSrc; });

let characterSelectActive = false;
let csPhase = 'p1'; // 'p1' | 'p2'
let csCursor = 0;
let p1Choice = null;
let p2Choice = null;
let csPreviewTimer = 0;
let csPreviewFrame = 0;

function csNextUnlocked(from, dir) {
  let i = from;
  for (let n = 0; n < ROSTER.length; n++) {
    i = (i + dir + ROSTER.length) % ROSTER.length;
    if (ROSTER[i].unlocked) return i;
  }
  return from;
}

function applyRosterChoice(fighter, choice) {
  fighter.spriteKey = choice.key;
  fighter.name = choice.name;
  fighter.color = choice.color;
  fighter.accent = choice.accent;
}

function drawCharacterSelect() {
  csPreviewTimer++;
  if (csPreviewTimer > 14) { csPreviewTimer = 0; csPreviewFrame = (csPreviewFrame + 1) % 4; }

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
  ctx.fillText((csPhase === 'p1' ? 'PLAYER 1' : 'PLAYER 2') + ': CHOOSE YOUR FIGHTER', canvas.width / 2, 40);
  ctx.shadowBlur = 0;

  // grid: 5 cols x 2 rows, centered
  const cols = 5, rows = 2;
  const tileW = 92, tileH = 130, gap = 8;
  const gridW = cols * tileW + (cols - 1) * gap;
  const gridH = rows * tileH + (rows - 1) * gap;
  const gridX = (canvas.width - gridW) / 2;
  const gridY = 70;

  ROSTER.forEach((r, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const tx = gridX + col * (tileW + gap);
    const ty = gridY + row * (tileH + gap);
    if (r.tileImg.complete && r.tileImg.naturalWidth > 0) {
      ctx.drawImage(r.tileImg, tx, ty, tileW, tileH);
    }
    if (!r.unlocked) {
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
  const choice = ROSTER[csCursor];
  const onLeft = csPhase === 'p1';
  const previewX = onLeft ? 90 : canvas.width - 90;
  const previewSpriteH = 210;
  const idleAnim = SPRITES[choice.key] && SPRITES[choice.key].idle;
  const idleReady = !!(idleAnim && idleAnim.loaded >= idleAnim.count);
  if (idleReady) {
    const frame = csPreviewFrame % idleAnim.count;
    const img = idleAnim.imgs[frame];
    const drawW = previewSpriteH * (img.width / img.height);
    ctx.save();
    if (!onLeft) { ctx.translate(previewX, 0); ctx.scale(-1, 1); ctx.translate(-previewX, 0); }
    ctx.drawImage(img, previewX - drawW / 2, canvas.height - previewSpriteH - 20, drawW, previewSpriteH);
    ctx.restore();
  }
  const nameLogo = choice.nameLogoImg;
  if (nameLogo && nameLogo.complete && nameLogo.naturalWidth > 0) {
    const logoH = 60;
    const logoW = logoH * (nameLogo.width / nameLogo.height);
    const logoY = (canvas.height - previewSpriteH - 20) - logoH - 8;
    ctx.drawImage(nameLogo, previewX - logoW / 2, logoY, logoW, logoH);
  }

  ctx.font = '13px monospace';
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'center';
  ctx.fillText('←/→ choose · confirm to lock in', canvas.width / 2, canvas.height - 8);
}

// Slightly slower than a real 60fps rAF cadence -- uniformly slows every tick-based
// system (movement, gravity, attack timers, animation frames) since they all advance
// once per scheduled call here, without needing to touch each speed constant individually.
