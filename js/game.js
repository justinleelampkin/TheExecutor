// ---------- Setup fighters ----------
const p1 = new Fighter({
  name: 'SETH WARD', x: 260, facing: 1, color: '#2b2b33', accent: '#7c4dff', hasSprite: true, spriteKey: 'seth',
  controls: { left:'KeyA', right:'KeyD', up:'KeyW', down:'KeyS', jump:'KeyW', light:'KeyJ', heavy:'KeyK' }
});
const p2 = new Fighter({
  name: 'LIBERTY BELLE', x: 740, facing: -1, color: '#8a1f2b', accent: '#ffd54a', hasSprite: true, spriteKey: 'liberty',
  controls: { left:'ArrowLeft', right:'ArrowRight', up:'ArrowUp', down:'ArrowDown', jump:'ArrowUp', light:'Comma', heavy:'Period' }
});
let vsCPU = false;
let cpuDifficulty = 'medium';
const p2CPU = new CPUController(p2, p1);

let roundTimer = 99 * 60; // frames (60fps)
let roundOver = false;
let roundOverTimer = 0;

function drawHUD() {
  // health bars
  function healthBar(x, hp, maxHp, flip) {
    const w = 380, h = 22;
    ctx.fillStyle = '#111';
    ctx.fillRect(x, 20, w, h);
    const pct = hp / maxHp;
    ctx.fillStyle = pct > 0.35 ? '#4caf50' : '#c0392b';
    if (flip) ctx.fillRect(x + w * (1-pct), 20, w*pct, h);
    else ctx.fillRect(x, 20, w*pct, h);
    ctx.strokeStyle = '#666'; ctx.strokeRect(x,20,w,h);
  }
  healthBar(20, p1.hp, p1.maxHp, false);
  healthBar(canvas.width - 400, p2.hp, p2.maxHp, true);

  function meterBar(x, meter, maxMeter, flip) {
    const w = 380, h = 8;
    ctx.fillStyle = '#111'; ctx.fillRect(x, 46, w, h);
    const pct = meter / maxMeter;
    ctx.fillStyle = '#3fa7ff';
    if (flip) ctx.fillRect(x + w*(1-pct), 46, w*pct, h);
    else ctx.fillRect(x, 46, w*pct, h);
    ctx.strokeStyle = '#555'; ctx.strokeRect(x,46,w,h);
  }
  meterBar(20, p1.meter, p1.maxMeter, false);
  meterBar(canvas.width - 400, p2.meter, p2.maxMeter, true);

  // name logos, under each player's meter bar -- driven by actual character, not fixed side
  const logoH = 34;
  const logoFor = spriteKey => (ROSTER.find(r => r.key === spriteKey) || {}).nameLogoImg || sethNameLogo;
  const p1Logo = logoFor(p1.spriteKey);
  const p2Logo = logoFor(p2.spriteKey);
  if (p1Logo.complete && p1Logo.naturalWidth > 0) {
    const w = logoH * (p1Logo.width / p1Logo.height);
    ctx.drawImage(p1Logo, 20, 58, w, logoH);
  }
  if (p2Logo.complete && p2Logo.naturalWidth > 0) {
    const w = logoH * (p2Logo.width / p2Logo.height);
    ctx.drawImage(p2Logo, canvas.width - 20 - w, 58, w, logoH);
  }
  if (vsCPU) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffd54a';
    ctx.fillText(`CPU · ${cpuDifficulty.toUpperCase()}`, canvas.width - 20, 104);
  }

  // timer
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(roundTimer/60), canvas.width/2, 42);

  // wins
  ctx.font = '14px monospace';
  ctx.fillText(`${p1.wins} - ${p2.wins}`, canvas.width/2, 65);

  if (p1.comboCount > 1) {
    ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${p1.comboCount} HIT COMBO`, 20, 90);
  }
  if (p2.comboCount > 1) {
    ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${p2.comboCount} HIT COMBO`, canvas.width-20, 90);
  }

  if (roundOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    const winner = p1.hp > p2.hp ? p1.name : p2.hp > p1.hp ? p2.name : 'DRAW';
    ctx.fillText(winner === 'DRAW' ? 'DRAW!' : winner + ' WINS!', canvas.width/2, canvas.height/2);
    if (roundOverTimer <= 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText('1  —  REMATCH', canvas.width/2, canvas.height/2 + 44);
      ctx.fillStyle = '#7c4dff';
      ctx.fillText('2  —  CHARACTER SELECT', canvas.width/2, canvas.height/2 + 76);
    } else {
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText('get ready...', canvas.width/2, canvas.height/2 + 40);
    }
  }
}

// ---------- Main loop ----------
// ---------- Title screen ----------
const titleScreenImg = new Image();
titleScreenImg.src = "assets/ui/title-screen.webp";
let titleScreenActive = true;
let titleTimer = 0;

function drawTitleScreen() {
  titleTimer++;
  if (titleScreenImg.complete && titleScreenImg.naturalWidth > 0) {
    // scale-to-cover the canvas, cropping evenly top/bottom
    const scale = canvas.width / titleScreenImg.width;
    const drawH = titleScreenImg.height * scale;
    const drawY = -(drawH - canvas.height) / 2;
    ctx.drawImage(titleScreenImg, 0, drawY, canvas.width, drawH);
  } else {
    ctx.fillStyle = '#0b0b0e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // pulsing "press any button" prompt
  const pulse = 0.55 + 0.45 * Math.sin(titleTimer * 0.06);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.fillText('PRESS ANY BUTTON TO START', canvas.width / 2, canvas.height - 34);
  ctx.restore();
}

// ---------- Mode / difficulty select (placeholder menus -- swap for the real character-select flow later) ----------
let modeSelectActive = false;
let difficultySelectActive = false;

function drawModeSelect() {
  ctx.fillStyle = '#0b0b0e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('SELECT MODE', canvas.width / 2, 190);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#ffd54a';
  ctx.fillText('1  —  ONE PLAYER (VS CPU)', canvas.width / 2, 270);
  ctx.fillStyle = '#7c4dff';
  ctx.fillText('2  —  TWO PLAYERS', canvas.width / 2, 310);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('press 1 or 2', canvas.width / 2, 370);
}

function drawDifficultySelect() {
  ctx.fillStyle = '#0b0b0e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('SELECT DIFFICULTY', canvas.width / 2, 190);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#4caf50';
  ctx.fillText('1  —  EASY', canvas.width / 2, 260);
  ctx.fillStyle = '#ffd54a';
  ctx.fillText('2  —  MEDIUM', canvas.width / 2, 300);
  ctx.fillStyle = '#c0392b';
  ctx.fillText('3  —  HARD', canvas.width / 2, 340);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('press 1, 2, or 3', canvas.width / 2, 400);
}

const FRAME_MS = 1000 / 55;
function scheduleNext() { setTimeout(loop, FRAME_MS); }

function loop() {
  if (titleScreenActive) {
    drawTitleScreen();
    scheduleNext();
    return;
  }
  if (modeSelectActive) {
    drawModeSelect();
    scheduleNext();
    return;
  }
  if (difficultySelectActive) {
    drawDifficultySelect();
    scheduleNext();
    return;
  }
  if (characterSelectActive) {
    drawCharacterSelect();
    scheduleNext();
    return;
  }

  if (!roundOver) {
    if (vsCPU) p2CPU.think();
    p1.update(1, p2);
    p2.update(1, p1);
    resolveCombat();
    roundTimer--;
    checkRoundEnd();
  } else {
    p1.stateTimer++;
    p2.stateTimer++;
    if (roundOverTimer > 0) roundOverTimer--;
    // once the grace period ends, the rematch/character-select prompt (drawn in
    // drawHUD) waits for the player to pick -- see the Digit1/Digit2 handling in
    // input.js -- instead of auto-continuing like it used to.
  }

  drawStage();
  p1.draw(ctx);
  p2.draw(ctx);
  drawHUD();

  scheduleNext();
}
loop();
