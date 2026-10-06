function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Hit-stop length in ticks for a connecting attack. Lights are a short tick, heavies
// land harder, a full special connecting is the biggest freeze, and a blocked hit gets
// a smaller one. The hits of a multi-hit special (hitId set) only get a short freeze on
// all but the last, or three stacked 14-tick freezes eat half the move's runtime.
function hitStopFor(atk, hb, blocked) {
  if (hb.hitId) return (hb.last || hb.hitId === 'h3') ? 12 : 5;
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
  startRoundIntro();
}


// ---------- Pushboxes ----------
// Each fighter's pushbox is as wide as their hurtbox, and two grounded pushboxes can't
// overlap: fighters now stop at each other instead of walking straight through. Fighters
// that are airborne have no pushbox (a jump goes over/through; the overlap is sorted out
// after landing), and a separation moves each fighter at most PUSH_SPEED px per tick so a
// landing never teleports anyone. Called once per tick after combat (game.js).
const PUSH_SPEED = 8;
function fighterXBounds(f) { return [STAGE_L + f.w / 2, STAGE_R - f.w / 2]; } // same clamp update() uses

function resolvePushboxes() {
  // 1) corner pushback: a fighter being hit/blocked into a wall can't slide, so the
  // attacker is shoved back instead (otherwise they'd just overlap the pinned defender)
  [ [p1, p2], [p2, p1] ].forEach(([def, atk]) => {
    if ((def.state !== 'hitstun' && def.state !== 'block') || !def.vx) return;
    if (atk.state === 'hitstun' || atk.state === 'knockdown' || atk.y < GROUND_Y) return;
    const wallDir = def.vx > 0 ? 1 : -1;
    const [lo, hi] = fighterXBounds(def);
    const pinned = wallDir > 0 ? def.x >= hi - 0.5 : def.x <= lo + 0.5;
    if (!pinned) return;
    const [alo, ahi] = fighterXBounds(atk);
    atk.x = Math.max(alo, Math.min(ahi, atk.x - wallDir * Math.abs(def.vx) * 0.5));
  });

  // 2) separate overlapping grounded pushboxes
  if (p1.y < GROUND_Y - 4 || p2.y < GROUND_Y - 4) return;
  const half1 = (p1.w * p1.displayScale()) / 2, half2 = (p2.w * p2.displayScale()) / 2;
  const dx = p2.x - p1.x;
  const overlap = half1 + half2 - Math.abs(dx);
  if (overlap <= 0) return;
  // exactly stacked: resolve by facing so it's never arbitrary
  const dir = dx !== 0 ? Math.sign(dx) : (p1.facing === 1 ? 1 : -1);
  const step = Math.min(overlap / 2, PUSH_SPEED);
  p1.x -= dir * step; p2.x += dir * step;
  // a wall can swallow part of the push -- hand the leftover to the other fighter
  const [l1, h1] = fighterXBounds(p1), [l2, h2] = fighterXBounds(p2);
  const c1 = Math.max(l1, Math.min(h1, p1.x)), c2 = Math.max(l2, Math.min(h2, p2.x));
  const left1 = p1.x - c1, left2 = p2.x - c2; // overshoot past a wall (0 if fine)
  p1.x = c1; p2.x = c2;
  if (left1) p2.x = Math.max(l2, Math.min(h2, p2.x - left1));
  if (left2) p1.x = Math.max(l1, Math.min(h1, p1.x - left2));
}

// ---------- Round intro ----------
// Both fighters stand frozen -- no input, no CPU, no round timer -- while the "Ready... Fight!"
// call plays, and the round begins the moment it finishes (game.js tick() holds the
// simulation while roundIntroActive). A cap keeps a stuck/never-ending sound from
// freezing the round forever.
let roundIntroActive = false;
let roundIntroTicks = 0;
const ROUND_INTRO_MAX_TICKS = 6 * 48;
function startRoundIntro() {
  roundIntroActive = true;
  roundIntroTicks = 0;
  const myId = ++roundIntroId;
  playReadyFightSound(() => { if (roundIntroId === myId) roundIntroActive = false; });
}
let roundIntroId = 0; // a rematch/new round starting mid-intro must not be ended by the OLD call finishing
