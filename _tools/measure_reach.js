// Regenerates the ATTACK_REACH table in js/fighter.js. Run in the game page's console
// (open index.html, let sprites load, then paste or inject this file). It prints a JS
// object literal: for each character and normal/jump attack, the forward reach (px from
// the character's center to the rightmost opaque pixel, at displayScale 1) of the frames
// shown while the hitbox is active.
(() => {
  const keys = Object.keys(CHAR_ANIMS);
  const opp = ROSTER.findIndex(r => r.key === 'seth');
  const out = {};
  const tipOf = img => {
    const W = img.width, H = img.height, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    let mx = -1;
    for (let y = 0; y < H; y++) for (let x = W - 1; x > mx; x--) if (d[(y * W + x) * 4 + 3] > 60) { mx = x; break; }
    return (mx - W / 2) / H * 180;
  };
  for (const k of keys) {
    const pi = ROSTER.findIndex(r => r.key === k);
    applyRosterChoice(p1, ROSTER[pi]); applyRosterChoice(p2, ROSTER[opp]);
    currentStage = pickStageFor(k, 'seth'); resetRound();
    p1.x = 500; p1.facing = 1; const gy = GROUND_Y; out[k] = {};
    for (const an of ['lightAtk', 'heavyAtk', 'crouchLightAtk', 'crouchHeavyAtk', 'jumpLightAtk', 'jumpHeavyAtk']) {
      const air = an.startsWith('jump'); const frames = new Set();
      for (let tk = 0; tk < (air ? 22 : NORMAL_TIMING[an].dur); tk++) {
        if (air) { p1.state = 'jump'; p1.y = gy - 110; p1.airAttack = an === 'jumpLightAtk' ? 'light' : 'heavy'; p1.airAttackTimer = tk; }
        else { p1.state = an; p1.stateDur = NORMAL_TIMING[an].dur; p1.stateTimer = tk; p1.y = gy; p1.airAttack = null; }
        // measured against the *fallback* hitbox window only (timing, not size), so this
        // works even before the character has an ATTACK_REACH row
        if (p1.attackHitbox()) frames.add(air ? p1.getAirAttackFrameIndex(an) : p1.getAttackFrame(an));
      }
      let best = 0; frames.forEach(fi => { best = Math.max(best, tipOf(p1.anim(an).imgs[fi])); });
      out[k][an] = Math.round(best * 10) / 10;
    }
    p1.state = 'idle'; p1.airAttack = null; p1.y = gy;
  }
  const text = Object.entries(out).map(([k, v]) => `  ${k}: { ` + Object.entries(v).map(([a, n]) => `${a}: ${n}`).join(', ') + ' },').join('\n');
  console.log('const ATTACK_REACH = {\n' + text + '\n};');
  return text;
})();
