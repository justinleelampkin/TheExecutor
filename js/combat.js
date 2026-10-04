function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Hit-stop length in ticks for a connecting attack. Lights are a short tick, heavies
// land harder, a full special connecting is the biggest freeze, and a blocked hit gets
// a smaller one. The hits of a multi-hit special (hitId set) only get a short freeze on
// all but the last, or three stacked 14-tick freezes eat half the move's runtime.
function hitStopFor(atk, hb, blocked) {
  if (hb.hitId) return hb.hitId === 'h3' ? 12 : 5;
  if (atk.state === 'special') return blocked ? 4 : 14;
  const heavy = hb.dmg >= 10;
  if (blocked) return heavy ? 4 : 2;
  return heavy ? 6 : 3;
}

function resolveCombat() {
  [ [p1,p2], [p2,p1] ].forEach(([atk, def]) => {
    const hb = atk.attackHitbox();
    const alreadyHit = hb && (hb.hitId ? atk.specialHitsApplied.has(hb.hitId) : atk.hitLock);
    if (hb && !alreadyHit) {
      if (aabbOverlap(hb, def.hurtbox)) {
        if (hb.hitId) atk.specialHitsApplied.add(hb.hitId);
        else atk.hitLock = true;
        const dirFrom = atk.x < def.x ? 1 : -1;
        const holdingBack = (def.facing === 1 && keys[def.controls.left]) || (def.facing === -1 && keys[def.controls.right]);
        // low attacks (crouching pokes) only get blocked by a crouching guard -- standing
        // back just isn't low enough to catch them, same high/low mixup as SF2/MK2, so
        // there's finally a reason to ever guess wrong on block instead of holding back
        // and being safe against everything.
        const isLowAttack = atk.state === 'crouchLightAtk' || atk.state === 'crouchHeavyAtk';
        const canBlock = ['idle','walk','crouch'].includes(def.state) && holdingBack && (!isLowAttack || def.state === 'crouch');
        if (canBlock) {
          def.blockHit(hb.dmg, hb.kb, dirFrom);
          def.startState('block', 14);
          playBlockSound();
          hitStopFrames = Math.max(hitStopFrames, hitStopFor(atk, hb, true));
        } else {
          def.takeHit(hb.dmg, hb.kb, dirFrom);
          playHitSound();
          atk.comboCount++; atk.comboTimer = 60;
          // every hit freezes both fighters for a few ticks (SF2-style hit-stop) so
          // contact has weight; the struck fighter also shakes during the freeze
          hitStopFrames = Math.max(hitStopFrames, hitStopFor(atk, hb, false));
          def.hitShake = true;
        }
      }
    }
    // projectile collision
    atk.projectiles.forEach(p => {
      const pBox = { x: p.x - p.w/2, y: p.y - p.h/2, w: p.w, h: p.h };
      if (aabbOverlap(pBox, def.hurtbox) && !p.spent) {
        p.spent = true;
        const dirFrom = atk.x < def.x ? 1 : -1;
        const holdingBack = (def.facing === 1 && keys[def.controls.left]) || (def.facing === -1 && keys[def.controls.right]);
        if (['idle','walk','crouch'].includes(def.state) && holdingBack) {
          def.blockHit(p.dmg, 4, dirFrom);
          playBlockSound();
        } else {
          def.takeHit(p.dmg, 4, dirFrom);
          playHitSound();
        }
      }
    });
    atk.projectiles = atk.projectiles.filter(p => !p.spent);
  });
}

function checkRoundEnd() {
  if (roundOver) return;
  if (p1.hp <= 0 || p2.hp <= 0 || roundTimer <= 0) {
    // wait for BOTH fighters to land before freezing into the win screen -- once
    // roundOver flips true, game.js's loop stops calling update() (and with it the
    // gravity that would bring anyone down), so either side being airborne right now
    // would otherwise freeze there for the whole victory/knockdown animation: the
    // winner if the finishing blow was a jump-attack, or the loser if they were
    // knocked out while jumping (an anti-air, or a projectile caught mid-jump).
    if (p1.y < GROUND_Y || p2.y < GROUND_Y) return;
    const winner = p1.hp > p2.hp ? p1 : (p2.hp > p1.hp ? p2 : null);
    roundOver = true;
    // brief grace period before the rematch/character-select prompt accepts input,
    // so the winner announcement has a moment to register before anything's pressable
    roundOverTimer = 45;
    if (winner === p1) { p1.wins++; p1.startState('victory', 999); playVictorySound(); }
    else if (winner === p2) { p2.wins++; p2.startState('victory', 999); playLossSound(); }
  }
}

function resetRound() {
  p1.hp = 100; p2.hp = 100;
  p1.x = 260; p2.x = 740;
  p1.prevX = p1.x; p2.prevX = p2.x; p1.prevY = p1.y; p2.prevY = p2.y; // no interpolation sweep from the old spot
  p1.meter = 0; p2.meter = 0;
  p1.state = 'idle'; p2.state = 'idle';
  roundTimer = 99 * TICKS_PER_SEC;
  roundOver = false;
  // P1's theme plays for the match, same convention as picking the stage off P1's
  // character. playTrack() no-ops if it's already the track playing, so a rematch
  // with the same P1 doesn't restart their song from 0:00 every round.
  playMatchMusicFor(p1);
  playReadyFightSound();
}

