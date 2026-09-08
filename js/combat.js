function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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
        const canBlock = ['idle','walk','crouch'].includes(def.state) && holdingBack;
        if (canBlock) {
          def.blockHit(hb.dmg, hb.kb, dirFrom);
          def.startState('block', 14);
        } else {
          def.takeHit(hb.dmg, hb.kb, dirFrom);
          atk.comboCount++; atk.comboTimer = 60;
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
        } else {
          def.takeHit(p.dmg, 4, dirFrom);
        }
      }
    });
    atk.projectiles = atk.projectiles.filter(p => !p.spent);
  });
}

function checkRoundEnd() {
  if (roundOver) return;
  if (p1.hp <= 0 || p2.hp <= 0 || roundTimer <= 0) {
    roundOver = true;
    roundOverTimer = 180;
    if (p1.hp > p2.hp) { p1.wins++; p1.startState('victory', 999); }
    else if (p2.hp > p1.hp) { p2.wins++; p2.startState('victory', 999); }
  }
}

function resetRound() {
  p1.hp = 100; p2.hp = 100;
  p1.x = 260; p2.x = 740;
  p1.meter = 0; p2.meter = 0;
  p1.state = 'idle'; p2.state = 'idle';
  roundTimer = 99 * 60;
  roundOver = false;
}

