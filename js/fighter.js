
// ============================================================
// WHITE NOISE: THE CABINET — Fighting Game Engine Prototype
// Phase 1: core engine + placeholder art, real Seth walk sprite wired in
// ============================================================

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const GROUND_Y = 420;
const STAGE_L = 40, STAGE_R = 960;

// ---------- Character animation registry ----------
// Folder on disk for each character's assets. Defaults to the spriteKey itself
// (e.g. 'botanist' -> assets/characters/botanist/...) -- only the original two
// characters predate that convention and need an explicit override.
const CHAR_FOLDER = { seth: 'white-noise', liberty: 'liberty-belle' };

// Animation name -> asset subfolder name. Shared across every character.
const ANIM_FOLDER = {
  walk: 'walk', idle: 'idle', crouch: 'crouch',
  jumpNeutral: 'jump-neutral', jumpForward: 'jump-forward',
  jumpLightAtk: 'jump-light-attack', jumpHeavyAtk: 'jump-heavy-attack',
  lightAtk: 'light-punch', heavyAtk: 'heavy-punch',
  crouchLightAtk: 'crouch-light', crouchHeavyAtk: 'crouch-heavy',
  special: 'special', knockdown: 'defeat', victory: 'victory',
  // victory2/3/4: alternate victory-pose variants, randomly picked between at round
  // win (see startState()) -- only characters with more than one variant declare
  // these in CHAR_ANIMS; everyone else just has 'victory'.
  victory2: 'victory2', victory3: 'victory3', victory4: 'victory4',
  block: 'block', hitstun: 'hitstun',
};

// How many frames each character has for each animation. Omit an animation the
// character doesn't have art for yet -- draw() falls back to the placeholder box
// for that state until it's added here, so a character can be built up incrementally.
const CHAR_ANIMS = {
  seth: {
    walk: 8, idle: 4, crouch: 4, jumpNeutral: 6, jumpForward: 6,
    jumpLightAtk: 5, jumpHeavyAtk: 5, lightAtk: 6, heavyAtk: 6,
    crouchLightAtk: 6, crouchHeavyAtk: 6, special: 9, knockdown: 5,
    victory: 10, block: 3, hitstun: 3,
  },
  liberty: {
    walk: 8, idle: 6, crouch: 6, jumpNeutral: 6, jumpForward: 6,
    jumpLightAtk: 5, jumpHeavyAtk: 5, lightAtk: 6, heavyAtk: 6,
    crouchLightAtk: 6, crouchHeavyAtk: 6, special: 13, knockdown: 5,
    victory: 10, block: 3, hitstun: 3,
  },
  // Full moveset. His special still has no hand-tuned hitbox/dash choreography
  // of its own (see attackHitbox() and the 'special' dash-speed branch in
  // update()) -- he'll fall through to White Noise's until he gets his own
  // branch there.
  botanist: {
    walk: 8, idle: 5, crouch: 5, jumpNeutral: 6, jumpForward: 5, lightAtk: 5,
    heavyAtk: 14, jumpLightAtk: 7, jumpHeavyAtk: 7, special: 14,
    victory: 10, knockdown: 5, block: 3, crouchLightAtk: 5, crouchHeavyAtk: 5,
    hitstun: 3,
  },
  // Full moveset. jumpForward reuses the same art as jumpNeutral -- there's no
  // separate directional jump sheet for him, so both point at the same frames.
  // His special also borrows White Noise's hitbox/dash choreography, same as
  // Botanist's.
  frontman: {
    walk: 8, idle: 5, crouch: 3, lightAtk: 5, heavyAtk: 5,
    jumpNeutral: 6, jumpForward: 6,
    jumpLightAtk: 5, jumpHeavyAtk: 5, crouchLightAtk: 5, crouchHeavyAtk: 5,
    special: 6, knockdown: 5, victory: 10, hitstun: 3, block: 3,
  },
  // Full moveset. Voice/sound-themed attacks (light/heavy punches emit a sonic burst,
  // special is a mic-stand soundwave blast) fitting her "Lady Voix" name. jumpForward
  // reuses the same single jump sheet as jumpNeutral, like Frontman. Her special has no
  // hand-tuned hitbox/dash choreography yet -- borrows White Noise's, same as Botanist
  // and Frontman. Several of her sheets (crouch, victory) needed their own scale
  // correction relative to her idle sheet -- see the README note on scale drift, and the
  // note above the crouch export in _tools/export_ladyvoix2.html for how the factor
  // was derived (comparing each sheet's own standing-pose frame height against idle's).
  ladyvoix: {
    idle: 5, walk: 8, crouch: 4, jumpNeutral: 6, jumpForward: 6,
    jumpLightAtk: 5, jumpHeavyAtk: 5, lightAtk: 5, heavyAtk: 5,
    crouchLightAtk: 5, crouchHeavyAtk: 5, special: 7, knockdown: 5,
    victory: 10, block: 3, hitstun: 4,
  },
  // Full moveset. A steampunk gladiator-android -- light/heavy attacks are an
  // arm-mounted cannon rather than a punch, and the special summons a ghostly
  // historical/philosophical figure who hands him a stone tablet to smash. His
  // victory has 4 variants (`victory`/`victory2`/`victory3`/`victory4`) from 4
  // user-supplied sheets that are the same choreography with a different figure
  // appearing in the smoke each time -- one is picked at random on each round win
  // (see startState()) rather than always playing the same one or concatenating all
  // 4 into one animation (an earlier approach here that made him visibly change
  // scale mid-celebration whenever playback crossed from one source sheet's frames
  // into the next, since each sheet's own internal scale wasn't independently
  // verified against the others closely enough -- see the README note on this).
  // His special has no hand-tuned hitbox/dash choreography yet -- borrows White
  // Noise's, like the others.
  phi: {
    idle: 5, walk: 8, crouch: 3, jumpNeutral: 5, jumpForward: 5,
    jumpLightAtk: 5, jumpHeavyAtk: 5, lightAtk: 5, heavyAtk: 5,
    crouchLightAtk: 5, crouchHeavyAtk: 5, special: 8, knockdown: 5,
    victory: 8, victory2: 8, victory3: 8, victory4: 8, block: 4, hitstun: 4,
  },
};

// Per-character tuning that isn't a plain frame count.
const SPECIAL_BOUNDARIES = {
  seth: [8,16,26,32,40,50,58,66,72],
  liberty: [8,16,26,33,40,46,53,61,68,75,84,92,98],
};
// P.H.I.'s special was reported as "passing too quickly" -- literally duplicating his
// 8 special frames wouldn't fix that on its own, since getSpecialFrameIndex() ->
// getProgressFrame() maps the *whole* SPECIAL_DUR evenly across however many frames
// exist (progress = stateTimer/stateDur), so doubling the frame count without also
// raising stateDur just holds each of twice-as-many identical frames for half as long
// -- net zero change in how long anything appears on screen. Raising his own SPECIAL_DUR
// is what actually slows it down; see the matching `phi` branch in attackHitbox() below,
// which had to move its hit window out to match or the impact would land during an
// earlier, now-mistimed pose once the whole animation takes longer to play out.
const SPECIAL_DUR = { seth: 72, liberty: 98, phi: 144 };
// Every character is rendered at a fixed 180px sprite height by default, but that
// only lines characters up visually when their art fills a similar fraction of its
// own 500x720 canvas. White Noise's compact hoodie-and-hood silhouette leaves more
// empty headroom above him than Liberty Belle's flowing hair or Botanist's leaf
// cloak do, so he renders noticeably shorter than the other two at the same 180px
// unless corrected here. Tune per-character, not by touching the art.
const CHAR_HEIGHT_SCALE = { seth: 1.165, ladyvoix: 0.73, phi: 0.767 };
// Bumps every fighter's render size on a specific stage. Needed because a stage's front
// layer has a hard floor on how small it can be drawn (it must still cover the canvas
// width -- see BAYOU_FRONT_SCALE's comment in stages.js), so shrinking the room alone
// can't always make fighters read as human-sized next to its furniture. The bayou's
// 1.6 was derived by comparing a fighter's rendered height against the room's own grand
// piano (an object whose real-world height is well known) rather than guessed by eye --
// see the note on the piano-based calibration in stages.js above BAYOU_BAND_SCALE_K,
// which uses the same reference.
const STAGE_HEIGHT_SCALE = { bayou: 1.8 };
// Which crouch frame is the settled "deepest" pose to hold on -- most characters hold
// on their last frame, but seth's and liberty's crouch sheets are ordered differently.
const CROUCH_HOLD_AT = { seth: 1, liberty: 2, phi: 1 };

// Build SPRITES[charKey][animName] = { frames, imgs, count, loaded } for every
// character/animation pair declared in CHAR_ANIMS. Adding a new character or a new
// animation for an existing one is purely a data change here -- no new loading or
// rendering code needed.
const SPRITES = {};
Object.keys(CHAR_ANIMS).forEach(charKey => {
  const folder = CHAR_FOLDER[charKey] || charKey;
  SPRITES[charKey] = {};
  Object.entries(CHAR_ANIMS[charKey]).forEach(([animName, count]) => {
    const subfolder = ANIM_FOLDER[animName];
    const frames = [];
    for (let i = 0; i < count; i++) frames.push(`assets/characters/${folder}/${subfolder}/${i}.webp`);
    const imgs = frames.map(src => { const img = new Image(); img.src = src; return img; });
    const entry = { frames, imgs, count, loaded: 0 };
    imgs.forEach(img => img.onload = () => entry.loaded++);
    SPRITES[charKey][animName] = entry;
  });
});

// Maps a fighter state to its animation + frame-index function, for every state
// whose sprite lookup is a plain one-animation-per-state affair (walk/idle/crouch use
// their own persistent frame counters; jump and jump-attacks pick between two
// sub-animations, so those stay hand-written in draw() instead of living here).
const SIMPLE_STATE_ANIM = {
  walk:           { anim: 'walk',           frame: f => f.animFrame },
  idle:           { anim: 'idle',           frame: f => f.idleFrame },
  crouch:         { anim: 'crouch',         frame: f => f.crouchFrame },
  lightAtk:       { anim: 'lightAtk',       frame: f => f.getProgressFrame('lightAtk') },
  heavyAtk:       { anim: 'heavyAtk',       frame: f => f.getProgressFrame('heavyAtk') },
  crouchLightAtk: { anim: 'crouchLightAtk', frame: f => f.getProgressFrame('crouchLightAtk') },
  crouchHeavyAtk: { anim: 'crouchHeavyAtk', frame: f => f.getProgressFrame('crouchHeavyAtk') },
  special:        { anim: 'special',        frame: f => f.getSpecialFrameIndex() },
  knockdown:      { anim: 'knockdown',      frame: f => f.getKnockdownFrameIndex() },
  victory:        { anim: f => f.victoryVariant, frame: f => f.getVictoryFrameIndex() },
  hitstun:        { anim: 'hitstun',        frame: f => f.getProgressFrame('hitstun') },
  block:          { anim: 'block',          frame: f => f.getBlockFrameIndex() },
};

// Input history buffers for special-move detection (simplified motion inputs)
function makeInputBuffer() { return []; }
function pushInput(buf, token) {
  buf.push({t: performance.now(), k: token});
  while (buf.length && performance.now() - buf[0].t > 600) buf.shift();
}
function bufferHasSequence(buf, seq) {
  // checks seq appears in order (not necessarily contiguous) within the time window
  let idx = 0;
  for (const entry of buf) {
    if (entry.k === seq[idx]) { idx++; if (idx === seq.length) return true; }
  }
  return false;
}

// ---------- Fighter class ----------
class Fighter {
  constructor(opts) {
    this.name = opts.name;
    this.x = opts.x;
    this.y = GROUND_Y;
    this.vx = 0; this.vy = 0;
    this.facing = opts.facing; // 1 = right, -1 = left
    this.w = 70; this.h = 150;
    this.color = opts.color;
    this.accent = opts.accent;
    this.hp = 100; this.maxHp = 100;
    this.meter = 0; this.maxMeter = 100;
    this.state = 'idle'; // idle, walk, crouch, jump, lightAtk, heavyAtk, special, block, hitstun, knockdown
    this.stateTimer = 0;
    this.animFrame = 0; this.animTimer = 0;
    this.idleFrame = 0; this.idleTimer = 0;
    this.crouchFrame = 0; this.crouchTimer = 0; this.crouchAnimTimer = 0; this.crouchPhase = 'idle';
    this.hasSprite = opts.hasSprite || false;
    this.spriteKey = opts.spriteKey || null;
    this.inputBuf = makeInputBuffer();
    this.controls = opts.controls;
    this.hitLock = false; // prevents multi-hit per swing
    this.airAttack = null;        // null | 'light' | 'heavy' -- jump-attack sub-state layered on top of 'jump'
    this.airAttackTimer = 0;
    this.airAttackUsed = false;   // one air attack per jump
    this.specialHitsApplied = new Set(); // tracks which hit-windows of a multi-hit special have already landed
    this.projectiles = [];
    this.comboCount = 0;
    this.comboTimer = 0;
    this.wins = 0;
    this.victoryVariant = 'victory'; // which victory sub-animation is playing -- see startState()
  }

  // Multiplier for anything that must visually track the drawn sprite (hitboxes,
  // hurtbox, projectile spawn point) -- the same one drawSpriteFrame() uses, so a
  // character rendered bigger on a given stage (STAGE_HEIGHT_SCALE) or bigger by their
  // own CHAR_HEIGHT_SCALE correction also fights at that size, not at the fixed
  // 70x150 base this.w/this.h describe.
  displayScale() {
    return (CHAR_HEIGHT_SCALE[this.spriteKey] || 1) * (STAGE_HEIGHT_SCALE[currentStage] || 1);
  }

  get hurtbox() {
    const s = this.displayScale();
    const crouch = this.state === 'crouch';
    return { x: this.x - (this.w*s)/2, y: crouch ? this.y - this.h*s*0.55 : this.y - this.h*s, w: this.w*s, h: crouch ? this.h*s*0.55 : this.h*s };
  }

  attackHitbox() {
    const s = this.displayScale();
    if (this.state === 'jump' && this.airAttack) {
      // jump attacks: kick (heavy) hits harder than punch (light), matching the ground light/heavy split
      if (this.airAttackTimer < 7 || this.airAttackTimer > 13) return null;
      const isLight = this.airAttack === 'light'; // punch = weak
      const range = (isLight ? 60 : 78) * s;
      const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
      return { x: hx, y: this.y - this.h*s*0.75, w: range, h: this.h*s*0.4, dmg: isLight ? 7 : 12, kb: isLight ? 8 : 15 };
    }
    if (this.state === 'special') {
      if (this.spriteKey === 'liberty') {
        // three-hit combo: rising uppercut, spin-kick impact, slam landing
        const windows = [
          { start: 33, end: 40, id: 'h1', dmg: 7, kb: 6 },
          { start: 61, end: 68, id: 'h2', dmg: 7, kb: 10 },
          { start: 84, end: 92, id: 'h3', dmg: 9, kb: 14 },
        ];
        for (const w of windows) {
          if (this.stateTimer >= w.start && this.stateTimer <= w.end) {
            return { x: this.x - (this.w*s)/2, y: this.y - this.h*s, w: this.w*s, h: this.h*s, dmg: w.dmg, kb: w.kb, hitId: w.id };
          }
        }
        return null;
      }
      if (this.spriteKey === 'phi') {
        // his special takes twice as long to play out as the shared default (see
        // SPECIAL_DUR.phi) so the tablet-smash impact -- frame 5 of his 8 -- now
        // lands around tick 90-108 instead of the default window's 30-50
        if (this.stateTimer < 90 || this.stateTimer > 108) return null;
        return { x: this.x - (this.w*s)/2, y: this.y - this.h*s, w: this.w*s, h: this.h*s, dmg: 20, kb: 20 };
      }
      // active from the tail of the windup through the impact frame
      if (this.stateTimer < 30 || this.stateTimer > 50) return null;
      return { x: this.x - (this.w*s)/2, y: this.y - this.h*s, w: this.w*s, h: this.h*s, dmg: 20, kb: 20 };
    }
    if (!['lightAtk','heavyAtk','crouchLightAtk','crouchHeavyAtk'].includes(this.state)) return null;
    // active frames window
    const dur = (this.state === 'lightAtk') ? 18 : (this.state === 'crouchLightAtk') ? 16 : 26;
    const activeStart = dur * 0.35, activeEnd = dur * 0.7;
    if (this.stateTimer < activeStart || this.stateTimer > activeEnd) return null;
    const isLight = this.state === 'lightAtk' || this.state === 'crouchLightAtk';
    const range = (isLight ? 55 : 75) * s;
    const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
    // crouching attacks strike lower, matching the crouched fist height
    const isCrouching = this.state === 'crouchHeavyAtk' || this.state === 'crouchLightAtk';
    const hy = isCrouching ? this.y - this.h*s*0.4 : this.y - this.h*s*0.65;
    return { x: hx, y: hy, w: range, h: this.h*s*0.35, dmg: isLight ? 6 : 12, kb: isLight ? 6 : 14 };
  }

  startState(s, dur) {
    this.state = s; this.stateTimer = 0; this.stateDur = dur; this.hitLock = false;
    if (s === 'victory') {
      // pick one victory variant at random each win, for characters that have more
      // than one (see the note on P.H.I.'s victory in CHAR_ANIMS) -- characters with
      // only a plain 'victory' just always get that one back.
      const variants = ['victory', 'victory2', 'victory3', 'victory4'].filter(v => this.anim(v));
      this.victoryVariant = variants[Math.floor(Math.random() * variants.length)];
    }
  }

  update(dt, opponent) {
    this.stateTimer++;
    const c = this.controls;
    const grounded = this.y >= GROUND_Y;

    // record directional inputs for special-move buffer (only when grounded & free)
    const free = ['idle','walk','crouch'].includes(this.state);

    if (free || this.state === 'jump') {
      let moveDir = 0;
      if (keys[c.left]) moveDir = -1;
      if (keys[c.right]) moveDir = 1;

      // buffer motion tokens
      if (keys[c.down]) pushInput(this.inputBuf, 'D');
      if (moveDir === -this.facing && moveDir !== 0) pushInput(this.inputBuf, 'B'); // back
      if (moveDir === this.facing && moveDir !== 0) pushInput(this.inputBuf, 'F'); // forward

      if (free) {
        if (keys[c.down]) {
          if (this.state !== 'crouch') {
            // fresh press: start the settle-down transition from frame 0
            this.crouchPhase = 'entering';
            this.crouchAnimTimer = 0;
            this.crouchFrame = 0;
          }
          this.startState('crouch');
          this.vx = 0;
        } else {
          this.crouchPhase = 'idle';
          if (moveDir !== 0) {
            this.vx = moveDir * 3.2;
            this.state = 'walk';
          } else {
            this.vx = 0;
            this.state = 'idle';
          }
        }

        if (keys[c.jump] && grounded) {
          const s = this.displayScale();
          this.vy = -13.5 * s;
          // A character rendered near canvas-height-tall (the bayou's 1.8x display
          // scale leaves a standing fighter with well under 100px of headroom above
          // their own head) can't fit a fully proportional jump arc on screen at
          // all -- even the *original*, completely unscaled jump height would push
          // their head off the top of the canvas. Clamp the impulse (and therefore
          // the scaled gravity below it) to whatever arc still leaves a small margin
          // above the canvas top, so the jump scales up as much as geometrically
          // possible instead of scaling exactly with displayScale() and clipping.
          const drawH = 180 * s;
          const maxRise = Math.max(60, GROUND_Y - 10 - drawH);
          const maxVy = -Math.sqrt(2 * (0.63 * s) * maxRise);
          this.vy = Math.max(this.vy, maxVy); // vy is negative; smaller magnitude wins
          this.jumpDirectional = moveDir !== 0;
          this.airAttack = null;
          this.airAttackUsed = false;
          this.startState('jump');
        }

        if (keys[c.light] && !this._lightHeld) {
          const seqDone = bufferHasSequence(this.inputBuf, ['D','B']) || bufferHasSequence(this.inputBuf, ['D','F']);
          if (seqDone && this.meter >= 25 && this.anim('special')) {
            this.meter -= 25;
            this.specialHitsApplied = new Set();
            this.startState('special', SPECIAL_DUR[this.spriteKey] || 72);
          } else if (keys[c.down]) {
            this.startState('crouchLightAtk', 16);
          } else {
            this.startState('lightAtk', 18);
          }
          this.inputBuf.length = 0;
        }
        if (keys[c.heavy] && !this._heavyHeld) {
          if (keys[c.down]) {
            this.startState('crouchHeavyAtk', 26);
          } else {
            this.startState('heavyAtk', 26);
          }
        }
      } else if (this.state === 'jump' && !this.airAttack && !this.airAttackUsed) {
        // jump attacks: punch (light) or kick (heavy), one per jump, doesn't interrupt the jump arc
        if (keys[c.light] && !this._lightHeld) {
          this.airAttack = 'light';
          this.airAttackTimer = 0;
          this.airAttackUsed = true;
          this.airAttackHitLock = false;
        } else if (keys[c.heavy] && !this._heavyHeld) {
          this.airAttack = 'heavy';
          this.airAttackTimer = 0;
          this.airAttackUsed = true;
          this.airAttackHitLock = false;
        }
      }
      this._lightHeld = keys[c.light];
      this._heavyHeld = keys[c.heavy];
    }

    if (this.airAttack) {
      this.airAttackTimer++;
      if (this.airAttackTimer > 20) this.airAttack = null; // animation finished; normal jump pose resumes for the rest of the arc
    }

    // airborne physics -- gravity scales with displayScale() too, alongside the jump
    // impulse above, so a bigger-rendered fighter (CHAR_HEIGHT_SCALE or a stage's
    // STAGE_HEIGHT_SCALE) jumps proportionately higher instead of the same absolute
    // pixel height looking short relative to their now-bigger sprite. Scaling both by
    // the same factor keeps hang time unchanged (only the height of the arc grows).
    if (this.state === 'jump' || this.y < GROUND_Y) {
      this.vy += 0.63 * this.displayScale();
      this.y += this.vy;
      if (this.y >= GROUND_Y) { this.y = GROUND_Y; this.vy = 0; if (this.state === 'jump') this.startState('idle'); }
    }

    // attack/special/hitstun/knockdown timers
    if (['lightAtk','heavyAtk','crouchLightAtk','crouchHeavyAtk','special','hitstun','knockdown','block'].includes(this.state)) {
      if (this.state === 'block') {
        // stay in block only while holding back + not hitstunned
        const holdingBack = (this.facing === 1 && keys[c.left]) || (this.facing === -1 && keys[c.right]);
        if (!holdingBack) this.startState('idle');
      } else if (this.stateTimer >= this.stateDur) {
        this.startState(this.state === 'knockdown' ? 'idle' : 'idle');
      }
    }

    // special move: forward dash, timing/speed differ per character's move
    if (this.state === 'special') {
      if (this.spriteKey === 'liberty') {
        // sustained dash across the launch -> spin-kicks -> recover phases
        const dashing = this.stateTimer >= 26 && this.stateTimer < 75;
        this.vx = dashing ? this.facing * 4.5 : 0;
      } else if (this.spriteKey === 'ladyvoix') {
        // her mic-stand soundwave blast is stationary -- it radiates outward from
        // where she's standing rather than closing distance like a melee special
        this.vx = 0;
      } else {
        const dashing = this.stateTimer >= 26 && this.stateTimer < 40;
        this.vx = dashing ? this.facing * 14 : 0;
      }
    }

    // apply horizontal movement + stage clamp
    this.x += this.vx;
    this.x = Math.max(STAGE_L + this.w/2, Math.min(STAGE_R - this.w/2, this.x));

    // facing follows opponent when free
    if (free) this.facing = opponent.x >= this.x ? 1 : -1;

    // blocking: if holding back while opponent attacks and grounded+free-ish
    if ((free) ) {
      const holdingBack = (this.facing === 1 && keys[c.left]) || (this.facing === -1 && keys[c.right]);
      if (holdingBack && grounded) {
        // soft block stance only shown reactively on incoming hit in resolveHit
      }
    }

    // meter regen (slow passive)
    this.meter = Math.min(this.maxMeter, this.meter + 0.03);

    // combo timer decay
    if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer === 0) this.comboCount = 0; }

    // animation frame advance (only meaningful for sprite-based walk)
    this.animTimer++;
    const walkLen = this.anim('walk') ? this.anim('walk').count : 8;
    if (this.animTimer > 4) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % walkLen; }
    this.idleTimer++;
    const idleLen = this.anim('idle') ? this.anim('idle').count : 4;
    if (this.idleTimer > 14) { this.idleTimer = 0; this.idleFrame = (this.idleFrame + 1) % idleLen; }
    // crouch: play the settle-down transition once, then hold on the final (deepest) frame
    if (this.crouchPhase === 'entering') {
      this.crouchAnimTimer++;
      if (this.crouchAnimTimer > 6) {
        this.crouchAnimTimer = 0;
        const crouchLen = this.anim('crouch') ? this.anim('crouch').count : 4;
        const holdAt = CROUCH_HOLD_AT[this.spriteKey] !== undefined ? CROUCH_HOLD_AT[this.spriteKey] : crouchLen - 1;
        if (this.crouchFrame < holdAt) this.crouchFrame++;
        else this.crouchPhase = 'held';
      }
    }

    // projectiles
    this.projectiles.forEach(p => p.x += p.vx);
    this.projectiles = this.projectiles.filter(p => p.x > STAGE_L - 50 && p.x < STAGE_R + 50);
  }

  fireProjectile() {
    const s = this.displayScale();
    this.projectiles.push({
      x: this.x + this.facing * this.w * s, y: this.y - this.h*s*0.6, vx: this.facing * 9, w: 40, h: 20, dmg: 10
    });
  }

  takeHit(dmg, kb, dirFrom) {
    this.hp = Math.max(0, this.hp - dmg);
    this.vx = dirFrom * kb;
    this.meter = Math.min(this.maxMeter, this.meter + dmg * 0.5);
    if (this.hp === 0) {
      this.startState('knockdown', 60);
    } else {
      this.startState('hitstun', dmg > 8 ? 20 : 12);
    }
  }

  blockHit(dmg, kb, dirFrom) {
    this.hp = Math.max(0, this.hp - dmg * 0.15); // chip damage
    this.vx = dirFrom * kb * 0.3;
    this.meter = Math.min(this.maxMeter, this.meter + 3);
  }

  // Looks up this fighter's sprite data for one animation, e.g. this.anim('walk').
  // Returns undefined if the character has no art for that animation yet.
  anim(name) {
    const chars = SPRITES[this.spriteKey];
    return chars ? chars[name] : undefined;
  }

  // True once every frame of the named animation has finished loading.
  animReady(name) {
    const a = this.anim(name);
    return !!(a && a.loaded >= a.count);
  }

  // SIMPLE_STATE_ANIM entries can give `anim` as a plain string, or (for a state with
  // multiple randomly-picked variants, like a multi-take victory pose) a function of
  // the fighter that returns the variant name chosen in startState().
  resolveAnimName(anim) {
    return typeof anim === 'function' ? anim(this) : anim;
  }

  drawSpriteFrame(ctx, img) {
    const drawH = 180 * (CHAR_HEIGHT_SCALE[this.spriteKey] || 1) * (STAGE_HEIGHT_SCALE[currentStage] || 1), drawW = drawH * (img.width / img.height);
    ctx.save();
    if (this.facing === -1) {
      ctx.translate(this.x, 0); ctx.scale(-1,1); ctx.translate(-this.x, 0);
    }
    ctx.drawImage(img, this.x - drawW/2, this.y - drawH + 6, drawW, drawH);
    ctx.restore();
  }

  getJumpFrameIndex() {
    // Maps actual vertical velocity/phase onto the 6-pose jump arc,
    // instead of a fixed timer, so the animation matches real jump physics.
    if (this.stateTimer < 4) return 0;       // anticipation / just left ground
    if (this.vy < -8) return 1;               // rising fast
    if (this.vy < -3) return 2;               // rising, slowing
    if (this.vy < 3) return 3;                // near peak
    if (this.vy < 8) return 4;                // falling
    return 5;                                 // falling fast / about to land
  }

  getAirAttackFrameIndex(animName) {
    // poses spread across the ~20-tick air-attack animation
    const count = this.anim(animName).count;
    return Math.min(count - 1, Math.floor((this.airAttackTimer / 20) * count));
  }

  getKnockdownFrameIndex() {
    // fall spread over ~8 ticks/frame, holds on the final prone frame after
    const count = this.anim('knockdown').count;
    return Math.min(count - 1, Math.floor(this.stateTimer / 8));
  }

  getVictoryFrameIndex() {
    // charge-up spread over ~7 ticks/frame, holds on the final peak-charge frame after
    const count = this.anim(this.victoryVariant).count;
    return Math.min(count - 1, Math.floor(this.stateTimer / 7));
  }

  getBlockFrameIndex() {
    // guard-raising spread over ~5 ticks/frame across the block window
    const count = this.anim('block').count;
    return Math.min(count - 1, Math.floor(this.stateTimer / 5));
  }

  // Generic "spread N poses evenly across this state's duration" index, used by
  // every attack/reaction animation whose timing is just a fraction of stateDur
  // (for lightAtk this also lines up the strike frames with the active-hitbox
  // window at 35%-70% of stateDur, without changing hit detection at all).
  getProgressFrame(animName) {
    const a = this.anim(animName);
    if (!a) return 0;
    const progress = this.stateTimer / this.stateDur;
    return Math.min(a.count - 1, Math.floor(progress * a.count));
  }

  getSpecialFrameIndex() {
    const boundaries = SPECIAL_BOUNDARIES[this.spriteKey];
    if (!boundaries) return this.getProgressFrame('special');
    for (let i = 0; i < boundaries.length; i++) {
      if (this.stateTimer < boundaries[i]) return i;
    }
    return boundaries.length - 1;
  }

  draw(ctx) {
    const crouch = this.state === 'crouch';
    const bodyH = crouch ? this.h * 0.6 : this.h;
    const topY = this.y - bodyH;

    let drawn = false;
    if (this.hasSprite && this.state === 'jump' && this.airAttack) {
      const animName = this.airAttack === 'light' ? 'jumpLightAtk' : 'jumpHeavyAtk';
      if (this.animReady(animName)) {
        this.drawSpriteFrame(ctx, this.anim(animName).imgs[this.getAirAttackFrameIndex(animName)]);
        drawn = true;
      }
    } else if (this.hasSprite && this.state === 'jump') {
      const animName = this.jumpDirectional ? 'jumpForward' : 'jumpNeutral';
      if (this.animReady(animName)) {
        // getJumpFrameIndex() assumes a 6-pose jump arc, but a character's jump
        // animation can have fewer frames (e.g. Botanist's jumpForward has 5) --
        // clamp to what actually exists so it holds on the last frame instead of
        // indexing past the array and crashing the render loop.
        const frameIdx = Math.min(this.anim(animName).count - 1, this.getJumpFrameIndex());
        this.drawSpriteFrame(ctx, this.anim(animName).imgs[frameIdx]);
        drawn = true;
      }
    } else if (this.hasSprite && SIMPLE_STATE_ANIM[this.state] && this.animReady(this.resolveAnimName(SIMPLE_STATE_ANIM[this.state].anim))) {
      const cfg = SIMPLE_STATE_ANIM[this.state];
      const animName = this.resolveAnimName(cfg.anim);
      this.drawSpriteFrame(ctx, this.anim(animName).imgs[cfg.frame(this)]);
      drawn = true;
    }

    if (!drawn) {
      // placeholder silhouette block, color + state-based tint
      let fillColor = this.color;
      if (['lightAtk','heavyAtk','crouchLightAtk','crouchHeavyAtk','special'].includes(this.state)) fillColor = this.accent;
      if (this.state === 'block') fillColor = '#3a6b8a';
      if (this.state === 'hitstun') fillColor = '#a83232';
      if (this.state === 'knockdown') fillColor = '#555';
      ctx.fillStyle = fillColor;
      ctx.fillRect(this.x - this.w/2, topY, this.w, bodyH);
      // face direction indicator
      ctx.fillStyle = '#fff';
      const eyeX = this.facing === 1 ? this.x + this.w/2 - 14 : this.x - this.w/2 + 4;
      ctx.fillRect(eyeX, topY + 12, 10, 8);
      // label
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.state, this.x, topY - 6);
    }

    // attack hitbox debug (visualize active frames as thin outline)
    const hb = this.attackHitbox();
    if (hb) {
      ctx.strokeStyle = 'rgba(255,255,0,0.8)';
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    }

    // projectiles
    this.projectiles.forEach(p => {
      ctx.fillStyle = this.accent;
      ctx.fillRect(p.x - p.w/2, p.y - p.h/2, p.w, p.h);
    });
  }
}

// ---------- CPU AI controller ----------
// Drives a Fighter the same way a human would: by setting/clearing entries in the
// shared `keys` object using that fighter's own control codes. Fighter.update() never
// needs to know whether its input is coming from a keyboard or this controller.
const CPU_DIFFICULTY = {
  easy:   { reactionTicks: 28, blockChance: 0.28, specialChance: 0.10, approachChance: 0.55, retreatChance: 0.15, jumpAttackChance: 0.03 },
  medium: { reactionTicks: 16, blockChance: 0.50, specialChance: 0.18, approachChance: 0.60, retreatChance: 0.12, jumpAttackChance: 0.08 },
  hard:   { reactionTicks: 7,  blockChance: 0.75, specialChance: 0.28, approachChance: 0.65, retreatChance: 0.08, jumpAttackChance: 0.14 },
};

class CPUController {
  constructor(fighter, opponent) {
    this.fighter = fighter;
    this.opponent = opponent;
    this.c = fighter.controls;
    this.queue = [];       // scripted multi-tick sequences (attacks, special-move motions)
    this.intent = null;    // sustained stance: 'approach' | 'retreat' | 'block' | 'jumpAway' | 'neutral'
    this.intentTicks = 0;
    this.reacting = false;
    this.reactDelay = 0;
  }

  params() { return CPU_DIFFICULTY[cpuDifficulty] || CPU_DIFFICULTY.medium; }

  releaseAll() {
    const c = this.c;
    keys[c.left] = false; keys[c.right] = false; keys[c.up] = false;
    keys[c.down] = false; keys[c.jump] = false; keys[c.light] = false; keys[c.heavy] = false;
  }

  applyAction(a) {
    const c = this.c;
    if (a.left) keys[c.left] = true;
    if (a.right) keys[c.right] = true;
    if (a.down) keys[c.down] = true;
    if (a.up) keys[c.up] = true;
    if (a.jump) keys[c.jump] = true;
    if (a.light) keys[c.light] = true;
    if (a.heavy) keys[c.heavy] = true;
  }

  dirToOpp() { return this.opponent.x >= this.fighter.x ? 1 : -1; }
  setIntent(intent, ticks) { this.intent = intent; this.intentTicks = ticks; }
  queueSequence(steps) { this.queue = steps.slice(); }

  startSpecialSequence() {
    // simulate the human quarter-circle motion: hold down+toward, then hit light
    const dirAction = this.dirToOpp() === 1 ? { right: true } : { left: true };
    this.queueSequence([
      { action: Object.assign({ down: true }, dirAction), ticks: 8 },
      { action: { light: true }, ticks: 4 },
    ]);
  }

  startJumpAttackSequence() {
    // jump toward the opponent (horizontal momentum carries from the takeoff tick),
    // drift through the rise, then throw a punch or kick once airborne
    const dirAction = this.dirToOpp() === 1 ? { right: true } : { left: true };
    const atkAction = Math.random() < 0.5 ? { light: true } : { heavy: true };
    this.queueSequence([
      { action: Object.assign({ jump: true }, dirAction), ticks: 2 },
      { action: dirAction, ticks: 14 },
      { action: atkAction, ticks: 4 },
    ]);
  }

  applyIntent(intent, dirAction, awayAction) {
    if (intent === 'approach') this.applyAction(dirAction);
    else if (intent === 'retreat') this.applyAction(awayAction);
    else if (intent === 'block') this.applyAction(awayAction);
    else if (intent === 'jumpAway') this.applyAction(Object.assign({ jump: true }, awayAction));
    // 'neutral' -> hold nothing
  }

  think() {
    const f = this.fighter, o = this.opponent;
    this.releaseAll();

    // finish any scripted sequence in progress (e.g. a special-move motion) before anything else
    if (this.queue.length > 0) {
      const step = this.queue[0];
      this.applyAction(step.action);
      step.ticks--;
      if (step.ticks <= 0) this.queue.shift();
      return;
    }

    // no new decisions while mid-attack/hitstun/knockdown/jumping -- let the animation play out
    const free = ['idle', 'walk', 'crouch'].includes(f.state);
    if (!free) return;

    const params = this.params();
    const dist = Math.abs(o.x - f.x);
    const dir = this.dirToOpp();
    const dirAction = dir === 1 ? { right: true } : { left: true };
    const awayAction = dir === 1 ? { left: true } : { right: true };

    // defensive reaction: opponent is mid-swing and close enough to matter
    const oppAttacking = ['lightAtk', 'heavyAtk', 'crouchLightAtk', 'crouchHeavyAtk', 'special'].includes(o.state);
    if (oppAttacking && dist < 170 && !this.reacting) {
      this.reacting = true;
      this.reactDelay = params.reactionTicks;
    }
    if (this.reacting) {
      this.reactDelay--;
      if (this.reactDelay > 0) return; // simulated reaction time -- holds neutral briefly
      this.reacting = false;
      const roll = Math.random();
      if (roll < params.blockChance) this.setIntent('block', 22);
      else if (roll < params.blockChance + 0.25) this.setIntent('jumpAway', 4);
      else this.setIntent('retreat', 14);
    }

    if (this.intentTicks > 0) {
      this.intentTicks--;
      this.applyIntent(this.intent, dirAction, awayAction);
      return;
    }

    // pick a new intent based on spacing
    if (dist > 230) {
      if (dist < 300 && Math.random() < params.jumpAttackChance) { this.startJumpAttackSequence(); return; }
      this.setIntent('approach', 14 + Math.floor(Math.random() * 10));
      return;
    }
    if (dist > 100) {
      const roll = Math.random();
      if (Math.random() < params.jumpAttackChance) this.startJumpAttackSequence();
      else if (f.meter >= 25 && roll < params.specialChance) this.startSpecialSequence();
      else if (roll < params.approachChance) this.setIntent('approach', 10);
      else this.setIntent('neutral', 8);
      return;
    }
    // close range: pick an attack or hold ground
    const roll = Math.random();
    if (f.meter >= 25 && roll < params.specialChance) this.startSpecialSequence();
    else if (roll < 0.30) this.queueSequence([{ action: { light: true }, ticks: 3 }]);
    else if (roll < 0.50) this.queueSequence([{ action: { heavy: true }, ticks: 3 }]);
    else if (roll < 0.60) this.queueSequence([{ action: { down: true, light: true }, ticks: 3 }]);
    else if (roll < 0.68) this.queueSequence([{ action: { down: true, heavy: true }, ticks: 3 }]);
    else if (roll < 0.68 + params.retreatChance) this.setIntent('retreat', 12);
    else this.setIntent('block', 14);
  }
}

