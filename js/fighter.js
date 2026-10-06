
// ============================================================
// WHITE NOISE: THE CABINET — Fighting Game Engine Prototype
// Phase 1: core engine + placeholder art, real Seth walk sprite wired in
// ============================================================

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const GROUND_Y = 420;
const STAGE_L = 40, STAGE_R = 960;
const SPECIAL_METER_COST = 25; // meter needed (out of maxMeter=100) to throw a special

// ---------- Character animation registry ----------
// Folder on disk for each character's assets. Defaults to the spriteKey itself
// (e.g. 'botanist' -> assets/characters/botanist/...) -- only the original two
// characters predate that convention and need an explicit override.
const CHAR_FOLDER = { seth: 'white-noise', liberty: 'liberty-belle', architech: 'archi-tech' };

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
    walk: 7, idle: 5, crouch: 6, jumpNeutral: 7, jumpForward: 7,
    jumpLightAtk: 4, jumpHeavyAtk: 8, lightAtk: 8, heavyAtk: 5,
    crouchLightAtk: 4, crouchHeavyAtk: 8, special: 11, knockdown: 7,
    victory: 10, block: 4, hitstun: 4,
  },
  liberty: {
    walk: 7, idle: 5, crouch: 7, jumpNeutral: 8, jumpForward: 8,
    jumpLightAtk: 4, jumpHeavyAtk: 8, lightAtk: 7, heavyAtk: 7,
    crouchLightAtk: 4, crouchHeavyAtk: 8, special: 12, knockdown: 7,
    victory: 15, block: 4, hitstun: 4,
  },
  // Full moveset from user sheets (2026-10-03). jumpForward reuses the single jump sheet
  // (its 7th pose is a landing crouch the jump arc never reaches). Special is a
  // 2-row tornado/dust-wave sheet; victory is 2 rows with his dog joining in.
  // Full moveset. jumpForward aliases jumpNeutral; special is a 10-frame multi-hit (ghost clones).
  // Victory is a 16-frame dissolve into stars (4 source parts), defeat a collapse + dissolve.
  echo: {
    walk: 7, idle: 5, crouch: 7, jumpNeutral: 5, jumpForward: 5,
    jumpLightAtk: 5, jumpHeavyAtk: 5, lightAtk: 5, heavyAtk: 5,
    crouchLightAtk: 5, crouchHeavyAtk: 5, special: 10, knockdown: 8,
    victory: 16, block: 3, hitstun: 4,
  },
  coyote: {
    walk: 7, idle: 5, crouch: 5, jumpNeutral: 7, jumpForward: 7,
    jumpLightAtk: 5, jumpHeavyAtk: 6, lightAtk: 6, heavyAtk: 6,
    crouchLightAtk: 5, crouchHeavyAtk: 7, special: 10, knockdown: 6,
    victory: 10, block: 5, hitstun: 4,
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
  // His special throws a vinyl disc that visibly detaches from his hand and
  // flies off (see the `frontman` branch in attackHitbox()) -- stationary
  // ranged hit rather than the generic melee hitbox, same idea as Lady Voix's
  // soundwave blast.
  frontman: {
    walk: 8, idle: 5, crouch: 3, lightAtk: 5, heavyAtk: 5,
    jumpNeutral: 6, jumpForward: 6,
    jumpLightAtk: 5, jumpHeavyAtk: 5, crouchLightAtk: 5, crouchHeavyAtk: 5,
    special: 6, knockdown: 5, victory: 10, hitstun: 3, block: 3,
  },
  // Full moveset. Voice/sound-themed attacks (light/heavy punches emit a sonic burst,
  // special is a mic-stand soundwave blast) fitting her "Lady Voix" name. jumpForward
  // reuses the same single jump sheet as jumpNeutral, like Frontman. Her special is a
  // stationary ranged blast (see the `ladyvoix` branch in attackHitbox()), not the
  // generic melee hitbox. Several of her sheets (crouch, victory) needed their own scale
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
  // special was re-extracted from its source sheet (special_sheet.png) -- the old
  // 8-frame set was cropped tight enough to cut the ghostly-figure/tablet-smash
  // impact off mid-body on several frames instead of showing it in full, and one of
  // those 8 turned out not to be a real distinct pose once checked against the
  // source, so the true count is 7. See the matching `phi` branch in attackHitbox().
  phi: {
    idle: 5, walk: 8, crouch: 3, jumpNeutral: 5, jumpForward: 5,
    jumpLightAtk: 5, jumpHeavyAtk: 5, lightAtk: 5, heavyAtk: 5,
    crouchLightAtk: 5, crouchHeavyAtk: 5, special: 7, knockdown: 5,
    victory: 8, victory2: 8, victory3: 8, victory4: 8, block: 4, hitstun: 4,
  },
  // Full moveset. jumpForward reuses the same single jump sheet as jumpNeutral, like
  // Frontman/Lady Voix. Special is a water-elemental summon (bear). Victory is one
  // continuous 16-frame celebration split across two user-supplied source sheets
  // ("part 1"/"part 2") that concatenate directly -- unlike P.H.I.'s 4 victory sheets,
  // these aren't alternate variants of the same choreography, just one animation that
  // didn't fit in a single sheet, so no randomization/resolveAnimName needed here.
  // Defeat dissolves into water rather than just falling, so knockdown's later frames
  // are mostly splash effects with barely any body left -- expected, not a bug.
  // His special summons a water-bear that lunges out well past his own reach (see
  // the `rainwalker` branch in attackHitbox()) -- stationary ranged hit, same idea
  // as Lady Voix's soundwave blast and Frontman's thrown disc.
  rainwalker: {
    idle: 5, walk: 8, crouch: 5, jumpNeutral: 5, jumpForward: 5,
    jumpLightAtk: 5, jumpHeavyAtk: 5, lightAtk: 5, heavyAtk: 5,
    crouchLightAtk: 5, crouchHeavyAtk: 5, special: 6, knockdown: 5,
    victory: 16, block: 4, hitstun: 4,
  },
  // Full moveset except walk -- no walk-cycle sheet has been supplied yet, so walk
  // temporarily reuses his idle frames (functional placeholder, not a real walk
  // animation) until that art arrives. jumpForward reuses jumpNeutral's single jump
  // sheet, same convention as several others. Victory is one continuous 20-frame
  // celebration split across two source sheets, same convention as Rainwalker's.
  architech: {
    idle: 5, walk: 5, crouch: 5, jumpNeutral: 5, jumpForward: 5,
    jumpLightAtk: 5, jumpHeavyAtk: 5, lightAtk: 5, heavyAtk: 6,
    crouchLightAtk: 5, crouchHeavyAtk: 6, special: 6, knockdown: 5,
    // re-extracted from source (see architech_src/victory part 1&2.png) with
    // corrected pose boundaries and a per-sheet scale correction -- the old
    // 20-frame set was cropped from mis-tightened boundaries that bled
    // neighboring poses into each other and rendered noticeably smaller than
    // idle; 8 real poses per sheet, 16 total.
    victory: 16, block: 4, hitstun: 3,
  },
};

// Per-character tuning that isn't a plain frame count.
const SPECIAL_BOUNDARIES = {
  // seth's old boundaries were tuned frame-by-frame for his previous 9-frame combo
  // special -- his new special (11 frames, a charge/release/dissipate energy blast)
  // is a single continuous animation with no per-hit timing to match, so it falls
  // through to plain even spacing via getProgressFrame() like most other characters.
  // liberty's were tuned for her old 13-frame special too -- the new one is 12 frames
  // (three 4-frame sheets, each building to a burst) so she gets even spacing as well:
  // 82 ticks / 12 frames (sped up from 98 after "feels very slow"), with the three burst
  // peaks (frames 3, 7, 8) at ~ticks 21-28, 48-54 and 55-62 -- see the matching hit
  // windows in attackHitbox().
};
// P.H.I.'s special was reported as "passing too quickly" -- literally duplicating his
// 8 special frames wouldn't fix that on its own, since getSpecialFrameIndex() ->
// getProgressFrame() maps the *whole* SPECIAL_DUR evenly across however many frames
// exist (progress = stateTimer/stateDur), so doubling the frame count without also
// raising stateDur just holds each of twice-as-many identical frames for half as long
// -- net zero change in how long anything appears on screen. Raising SPECIAL_DUR is what
// actually slows it down, but doubling it to 144 overcorrected into "impossible to hit."
// Settled on a smaller bump (100) plus hitStopFrames (game.js/combat.js) freezing the
// moment it actually connects -- that gives the impact its weight without also dragging
// out the windup/recovery the opponent gets to react to. See the matching `phi` branch
// in attackHitbox() below, which has to track whatever this value is or the hitbox
// window lands during the wrong pose.
const SPECIAL_DUR = { seth: 72, liberty: 82, phi: 100, echo: 80 };

// Normal-attack timing, in ticks (48/sec). SF2-style: a short startup, a window where
// the hitbox is live and the extended pose is held, then a recovery that carries the
// rest of the move. `dur` is the whole move, `start`/`end` bracket the active hits.
// (This replaces the old "35%-70% of an 18/26-tick move" -- lights were ~2x slower to
// connect than SF2's jab and barely faster overall than heavies.)
const NORMAL_TIMING = {
  lightAtk:       { dur: 14, start: 4, end: 8 },
  heavyAtk:       { dur: 26, start: 8, end: 16 },
  crouchLightAtk: { dur: 13, start: 4, end: 8 },
  crouchHeavyAtk: { dur: 26, start: 8, end: 16 },
};
// Which sprite frames [first, last] show the extended pose (held for the active window).
// Frames before it share the startup ticks, frames after it share the recovery -- see
// getAttackFrame(). Measured from each sheet's farthest-reaching frames; a character or
// move not listed falls back to the old 35%-70% span of its frames, so adding one is
// data-only (the last two characters need entries once their sheets are in).
const STRIKE_FRAMES = {
  seth:    { lightAtk: [4, 5], heavyAtk: [2, 2], crouchLightAtk: [2, 3], crouchHeavyAtk: [4, 6] },
  liberty: { lightAtk: [3, 3], heavyAtk: [3, 5], crouchLightAtk: [2, 3], crouchHeavyAtk: [4, 5] },
  // the six older roster sheets: peak forward reach per frame (rough -- they weren't
  // re-anchored like seth/liberty), so tweak by eye if a pose looks held on the wrong frame
  phi:        { lightAtk: [3, 3], heavyAtk: [3, 3], crouchLightAtk: [2, 2], crouchHeavyAtk: [3, 3] },
  botanist:   { lightAtk: [3, 4], heavyAtk: [2, 8], crouchLightAtk: [2, 2], crouchHeavyAtk: [2, 3] },
  frontman:   { lightAtk: [3, 3], heavyAtk: [3, 3], crouchLightAtk: [3, 3], crouchHeavyAtk: [2, 3] },
  ladyvoix:   { lightAtk: [3, 3], heavyAtk: [3, 3], crouchLightAtk: [2, 2], crouchHeavyAtk: [2, 2] },
  rainwalker: { lightAtk: [2, 3], heavyAtk: [3, 3], crouchLightAtk: [3, 3], crouchHeavyAtk: [3, 3] },
  architech:  { lightAtk: [3, 3], heavyAtk: [3, 4], crouchLightAtk: [2, 2], crouchHeavyAtk: [2, 3] },
  coyote:     { lightAtk: [3, 3], heavyAtk: [3, 4], crouchLightAtk: [3, 3], crouchHeavyAtk: [4, 5] },
  echo:       { lightAtk: [2, 3], heavyAtk: [2, 3], crouchLightAtk: [2, 3], crouchHeavyAtk: [2, 3] },
};
// How far each normal/jump attack's extended pose actually reaches, measured per move from
// the sprite frames shown during its active ticks: forward distance from the character's
// center to the rightmost opaque pixel (fist, boot, blast), in px at displayScale 1 --
// multiply by displayScale() for on-screen px. attackHitbox() ends the hitbox ~14px past
// this so a hit lands when the limb visibly touches. (The old fixed 55/75/60/78 x scale
// reached 40-150px past the visible limb, and by a different amount for every character.)
// Re-measure a character's row with _tools/measure_reach.js when its attack art changes;
// characters/moves not listed fall back to the old fixed ranges.
const ATTACK_REACH = {
  seth:       { lightAtk: 36.5, heavyAtk: 53.6, crouchLightAtk: 63,   crouchHeavyAtk: 65.4, jumpLightAtk: 50.9, jumpHeavyAtk: 53.1 },
  liberty:    { lightAtk: 54,   heavyAtk: 61,   crouchLightAtk: 46.8, crouchHeavyAtk: 71.9, jumpLightAtk: 61.2, jumpHeavyAtk: 70.9 },
  phi:        { lightAtk: 83.2, heavyAtk: 70.7, crouchLightAtk: 49.6, crouchHeavyAtk: 51.8, jumpLightAtk: 62.4, jumpHeavyAtk: 80.5 },
  botanist:   { lightAtk: 47.8, heavyAtk: 62.3, crouchLightAtk: 46,   crouchHeavyAtk: 49.3, jumpLightAtk: 62.3, jumpHeavyAtk: 62.3 },
  frontman:   { lightAtk: 51.7, heavyAtk: 52.5, crouchLightAtk: 62.3, crouchHeavyAtk: 62.3, jumpLightAtk: 52.3, jumpHeavyAtk: 58 },
  ladyvoix:   { lightAtk: 60.4, heavyAtk: 66,   crouchLightAtk: 88.1, crouchHeavyAtk: 69.8, jumpLightAtk: 84.7, jumpHeavyAtk: 104.1 },
  rainwalker: { lightAtk: 63.6, heavyAtk: 69.6, crouchLightAtk: 56.5, crouchHeavyAtk: 54.4, jumpLightAtk: 41.2, jumpHeavyAtk: 42.8 },
  architech:  { lightAtk: 55.1, heavyAtk: 60.2, crouchLightAtk: 60.6, crouchHeavyAtk: 59.6, jumpLightAtk: 51.9, jumpHeavyAtk: 50.5 },
  coyote:     { lightAtk: 61.6, heavyAtk: 93.7, crouchLightAtk: 60.4, crouchHeavyAtk: 69.7, jumpLightAtk: 67.8, jumpHeavyAtk: 77.6 },
  echo:       { lightAtk: 63, heavyAtk: 79.7, crouchLightAtk: 61.6, crouchHeavyAtk: 96.2, jumpLightAtk: 75.9, jumpHeavyAtk: 57.5 },
};
// Ticks each walk-cycle frame is held. Walk speed is a flat 3.2px/tick, but the sprites'
// stride is far longer than 3.2px x a 5-tick frame covers, so the feet skated. This is
// ~0.45 x the widest foot spread (measured per character at in-game scale) / 3.2 for the
// cycle length, clamped to a lively 6.4-8 ticks/frame. Default 5 = the old cadence.
const WALK_TICKS_PER_FRAME = {
  seth: 8, liberty: 8, botanist: 7.6, frontman: 6.5, ladyvoix: 6.4, phi: 7.9, rainwalker: 8, architech: 8, coyote: 8, echo: 8,
};
// Idle breathing: SF2 idles bob at roughly 8-10 ticks/frame; was 15.
const IDLE_TICKS_PER_FRAME = 9;
// How long (ticks) a button press is remembered while the fighter cant act yet -- see update().
const INPUT_BUFFER_TICKS = 5;
// How far a directional jump travels, in body widths (this.w x displayScale): forward is
// long enough to cross over a standing opponent from point-blank, backward a bit shorter.
const JUMP_FORWARD_WIDTHS = 2.0;
const JUMP_BACK_WIDTHS = 1.5;
// Yellow attack-hitbox outlines: on while developing locally, off on the deployed site;
// H toggles it any time (input.js).
let SHOW_HITBOXES = ["localhost", "127.0.0.1", ""].includes(location.hostname);
// Every character is rendered at a fixed 180px sprite height by default, but that
// only lines characters up visually when their art fills a similar fraction of its
// own canvas. Measured directly (idle-frame alpha bbox / canvas height, corrected
// for any scale already applied below) across the whole roster: Liberty Belle
// (~0.75), Frontman (~0.715), Lady Voix (~0.729 post-correction), P.H.I. (~0.765
// post-correction) and Botanist (~0.778) all cluster in a ~0.71-0.78 band -- that's
// the real baseline, five of eight characters, not three. White Noise, Rainwalker
// and Archi-Tech are the actual outliers at ~0.645-0.649, rendering visibly smaller
// than the rest of the cast despite nothing being wrong with their art -- it's just
// framed with more headroom in its own canvas. A previous pass here had removed
// White Noise's boost on the theory that Liberty was the outlier and he matched
// "everyone else" at ~0.65 -- that comparison only checked a couple of characters;
// measuring the full roster shows the opposite. Tune per-character, not by
// touching the art.
const CHAR_HEIGHT_SCALE = { ladyvoix: 0.73, phi: 0.767, seth: 1.163, rainwalker: 1.156, architech: 1.156, coyote: 1.04, echo: 1.04 };
// Bumps every fighter's render size on a specific stage. Needed because a stage's front
// layer has a hard floor on how small it can be drawn (it must still cover the canvas
// width -- see BAYOU_FRONT_SCALE's comment in stages.js), so shrinking the room alone
// can't always make fighters read as human-sized next to its furniture. The bayou's
// 1.6 was derived by comparing a fighter's rendered height against the room's own grand
// piano (an object whose real-world height is well known) rather than guessed by eye --
// see the note on the piano-based calibration in stages.js above BAYOU_BAND_SCALE_K,
// which uses the same reference.
// Both stages render fighters at the same size now -- memorial used to default to the
// bare 1.0 fallback while bayou got this 1.8 bump, so picking frontman/ladyvoix (who
// route to bayou) vs anyone else made characters visibly different sizes match to
// match. See stages.js's MEMORIAL_FRONT_SCALE for the matching background rescale.
const STAGE_HEIGHT_SCALE = { bayou: 1.8, memorial: 1.8 };
// Which crouch frame is the settled "deepest" pose to hold on -- most characters hold
// on their last frame, but seth's and liberty's crouch sheets are ordered differently.
const CROUCH_HOLD_AT = { phi: 1, liberty: 3 };

// Animations that are the very same art as another one, so they share its frames (and its
// download) instead of keeping a duplicate folder: { charKey: { alias: target } }. Today that's
// jump-forward == jump-neutral for everyone but the Botanist.
const ANIM_ALIAS = {};
['seth', 'liberty', 'phi', 'frontman', 'ladyvoix', 'rainwalker', 'architech', 'coyote', 'echo']
  .forEach(k => { ANIM_ALIAS[k] = { jumpForward: 'jumpNeutral' }; });

// SPRITES[charKey][animName] = { frames, imgs, count, loaded, failed, started } for every
// character/animation pair declared in CHAR_ANIMS. Nothing downloads at page load: the
// Image objects are created empty and loadCharacterSprites() starts a character's
// downloads when it's needed (hovered on the select screen, or picked). Adding a new
// character or animation is purely a data change here.
const SPRITES = {};
Object.keys(CHAR_ANIMS).forEach(charKey => {
  const folder = CHAR_FOLDER[charKey] || charKey;
  SPRITES[charKey] = {};
  Object.entries(CHAR_ANIMS[charKey]).forEach(([animName, count]) => {
    const subfolder = ANIM_FOLDER[animName];
    const frames = [];
    for (let i = 0; i < count; i++) frames.push(`assets/characters/${folder}/${subfolder}/${i}.webp`);
    SPRITES[charKey][animName] = { frames, imgs: frames.map(() => new Image()), count, loaded: 0, failed: 0, started: false };
  });
  // aliased animations point at the same entry object as their target
  Object.entries(ANIM_ALIAS[charKey] || {}).forEach(([alias, target]) => {
    if (SPRITES[charKey][target]) SPRITES[charKey][alias] = SPRITES[charKey][target];
  });
});

// Start downloading one animation's frames (no-op if already started).
function loadAnimSprites(charKey, animName) {
  const e = SPRITES[charKey] && SPRITES[charKey][animName];
  if (!e || e.started) return;
  e.started = true;
  e.imgs.forEach((img, i) => {
    img.onload = () => e.loaded++;
    // a missing frame must not stall the pre-match loading screen forever
    img.onerror = () => e.failed++;
    img.src = e.frames[i];
  });
}

// Which characters currently have sprites loaded (most recently used first). Keeping every
// character in memory would put all of them (eventually 20+) back in RAM, so the
// least-recently-used ones beyond SPRITE_CACHE_CHARS are released -- never the two
// fighters in the current match or the two picks.
const SPRITE_CACHE_CHARS = 4;
const spriteLRU = [];
function loadCharacterSprites(charKey, idleOnly) {
  if (!SPRITES[charKey]) return;
  const at = spriteLRU.indexOf(charKey);
  if (at !== -1) spriteLRU.splice(at, 1);
  spriteLRU.unshift(charKey);
  loadAnimSprites(charKey, 'idle');
  if (!idleOnly) Object.keys(SPRITES[charKey]).forEach(a => loadAnimSprites(charKey, a));
  // evict
  const keep = new Set([charKey, typeof p1 !== 'undefined' && p1.spriteKey, typeof p2 !== 'undefined' && p2.spriteKey,
    typeof p1Choice !== 'undefined' && p1Choice && p1Choice.key, typeof p2Choice !== 'undefined' && p2Choice && p2Choice.key]);
  for (let i = spriteLRU.length - 1; i >= 0 && spriteLRU.length > SPRITE_CACHE_CHARS; i--) {
    if (!keep.has(spriteLRU[i])) unloadCharacterSprites(spriteLRU.splice(i, 1)[0]);
  }
}
function unloadCharacterSprites(charKey) {
  Object.values(SPRITES[charKey] || {}).forEach(e => {
    e.imgs = e.frames.map(() => new Image()); // drop the decoded bitmaps
    e.loaded = 0; e.failed = 0; e.started = false;
  });
}
// true once every animation of the character has finished (or failed) loading
function characterSpritesReady(charKey) {
  const anims = SPRITES[charKey];
  if (!anims) return false;
  return Object.values(anims).every(e => e.started && e.loaded + e.failed >= e.count);
}
// 0..1 progress of a character's full download, for the loading screen
function characterSpriteProgress(charKey) {
  const seen = new Set(); let done = 0, total = 0;
  Object.values(SPRITES[charKey] || {}).forEach(e => { if (seen.has(e)) return; seen.add(e); done += e.loaded + e.failed; total += e.count; });
  return total ? done / total : 0;
}

// Maps a fighter state to its animation + frame-index function, for every state
// whose sprite lookup is a plain one-animation-per-state affair (walk/idle/crouch use
// their own persistent frame counters; jump and jump-attacks pick between two
// sub-animations, so those stay hand-written in draw() instead of living here).
const SIMPLE_STATE_ANIM = {
  walk:           { anim: 'walk',           frame: f => f.animFrame },
  idle:           { anim: 'idle',           frame: f => f.idleFrame },
  crouch:         { anim: 'crouch',         frame: f => f.crouchFrame },
  lightAtk:       { anim: 'lightAtk',       frame: f => f.getAttackFrame('lightAtk') },
  heavyAtk:       { anim: 'heavyAtk',       frame: f => f.getAttackFrame('heavyAtk') },
  crouchLightAtk: { anim: 'crouchLightAtk', frame: f => f.getAttackFrame('crouchLightAtk') },
  crouchHeavyAtk: { anim: 'crouchHeavyAtk', frame: f => f.getAttackFrame('crouchHeavyAtk') },
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
    // position at the start of the last logic tick -- the renderer blends between this
    // and (x, y) by `renderAlpha` (game.js) so motion stays smooth when the display
    // refresh rate isn't a multiple of the 48 tick/sec simulation
    this.prevX = this.x; this.prevY = this.y;
    this.hitShake = false; // set by resolveCombat() on a clean hit; shakes the sprite during hit-stop
    this.bufLight = 0; this.bufHeavy = 0; // ticks left on a remembered button press (INPUT_BUFFER_TICKS)
    this._lightPrev = false; this._heavyPrev = false;
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
    this.footstepTimer = 0; // ticks since the last footstep sfx while walking
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
    // Standing lightAtk/heavyAtk hit as low as y=0.65h down to y=0.30h above the feet
    // (see attackHitbox()'s hy=0.65, h=0.35), so crouching needs to duck the hurtbox's
    // top edge below that 0.30 floor or a standing strike still catches a ducking
    // opponent's head/shoulders. 0.55 didn't clear it; 0.28 leaves real margin.
    return { x: this.x - (this.w*s)/2, y: crouch ? this.y - this.h*s*0.28 : this.y - this.h*s, w: this.w*s, h: crouch ? this.h*s*0.28 : this.h*s };
  }

  // Width of a normal/jump attack's hitbox beyond the body edge: reaches the measured tip
  // of the extended pose (ATTACK_REACH) plus a small margin, never shorter than a 24px
  // poke past the body. `fallback` is the old per-scale constant for unmeasured moves.
  attackRange(anim, fallback, s) {
    const reach = ATTACK_REACH[this.spriteKey] && ATTACK_REACH[this.spriteKey][anim];
    if (reach === undefined) return fallback * s;
    const bodyHalf = (this.w * s) / 2;
    return Math.max(bodyHalf + 24, reach * s + 14) - bodyHalf;
  }

  // Body-sized hitbox for melee specials (PHI's tablet smash, the shared default special),
  // reaching 70px past the leading edge: with pushboxes fighters can no longer
  // interpenetrate, so a box exactly as wide as the body would only ever touch the
  // opponent's hurtbox edge-to-edge and whiff.
  meleeSpecialBox(s, dmg, kb) {
    const reach = 70;
    const bodyW = this.w * s;
    const x = this.facing === 1 ? this.x - bodyW / 2 : this.x - bodyW / 2 - reach;
    return { x, y: this.y - this.h*s, w: bodyW + reach, h: this.h*s, dmg, kb };
  }

  attackHitbox() {
    const s = this.displayScale();
    if (this.state === 'jump' && this.airAttack) {
      // jump attacks: kick (heavy) hits harder than punch (light), matching the ground light/heavy split
      // The Coyote's heavy is a lunging wind-punch (see the lunge in update()), so its
      // hit window is later: it lands on the stretched-out frames of the lunge.
      const lunge = this.spriteKey === 'coyote' && this.airAttack === 'heavy';
      // Echo's 5-frame jump attacks only reach their extended pose on frame 3 (ticks 12-15 of
      // the 20-tick animation), so his window is centred there instead of the shared 7-13
      const echoWin = this.spriteKey === 'echo';
      const winStart = lunge ? 9 : echoWin ? 11 : 7, winEnd = lunge ? 15 : echoWin ? 16 : 13;
      if (this.airAttackTimer < winStart || this.airAttackTimer > winEnd) return null;
      const isLight = this.airAttack === 'light'; // punch = weak
      const range = this.attackRange(isLight ? 'jumpLightAtk' : 'jumpHeavyAtk', isLight ? 60 : 78, s);
      const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
      // P.H.I.'s jump punch throws his cannon arm higher than the shared 0.75 line
      const top = (this.spriteKey === 'phi' && isLight) ? 0.87 : 0.75;
      return { x: hx, y: this.y - this.h*s*top, w: range, h: this.h*s*0.4, dmg: isLight ? 7 : 12, kb: isLight ? 8 : 15 };
    }
    if (this.state === 'special') {
      if (this.spriteKey === 'liberty') {
        // three-hit flying-fist combo -- one window per burst frame of her 12-frame
        // special (frames 3, 7, 8 at the even 82/12 spacing)
        const windows = [
          { start: 21, end: 28, id: 'h1', dmg: 7, kb: 6 },
          { start: 48, end: 54, id: 'h2', dmg: 7, kb: 10 },
          { start: 55, end: 62, id: 'h3', dmg: 9, kb: 14 },
        ];
        for (const w of windows) {
          if (this.stateTimer >= w.start && this.stateTimer <= w.end) {
            // her leading fist/burst sits well ahead of her body on these frames
            // (~70px at in-game scale), so the box reaches forward by that much
            // instead of stopping at her torso while the flash is already on them
            const reach = 70;
            const bx = this.facing === 1 ? this.x - (this.w*s)/2 : this.x - (this.w*s)/2 - reach;
            return { x: bx, y: this.y - this.h*s, w: this.w*s + reach, h: this.h*s, dmg: w.dmg, kb: w.kb, hitId: w.id };
          }
        }
        return null;
      }
      if (this.spriteKey === 'echo') {
        // four-hit glitch combo: his ghost iterations rake in one after another (frames 2, 3-4
        // and 6 of his 10 at 8 ticks/frame), then the original lunges through with the vortex
        // strike (frame 7). Each window is its own hit; the last one carries the weight
        // (hitStopFor() freezes longest on `last`). Reaches measured from the frames' tips.
        const windows = [
          { start: 16, end: 23, id: 'e1', dmg: 5, kb: 3, range: 100 },
          { start: 30, end: 37, id: 'e2', dmg: 5, kb: 4, range: 105 },
          { start: 46, end: 53, id: 'e3', dmg: 5, kb: 5, range: 110 },
          { start: 58, end: 66, id: 'e4', dmg: 9, kb: 18, range: 150, last: true },
        ];
        for (const w of windows) {
          if (this.stateTimer >= w.start && this.stateTimer <= w.end) {
            const range = w.range * s / 1.8; // tuned at the 1.8 stage scale
            const bodyW = this.w * s;
            const x = this.facing === 1 ? this.x - bodyW / 2 : this.x - bodyW / 2 - range;
            return { x, y: this.y - this.h*s*0.95, w: bodyW + range, h: this.h*s*0.9, dmg: w.dmg, kb: w.kb, hitId: w.id, last: !!w.last };
          }
        }
        return null;
      }
      if (this.spriteKey === 'phi') {
        // his special plays out over SPECIAL_DUR.phi (100) rather than the shared
        // default (72), so the tablet-smash impact -- frame 5 of his 7 (re-extracted
        // from source, see CHAR_ANIMS.phi) -- lands around the ~71-84% mark, tick
        // 71-84 here.
        if (this.stateTimer < 71 || this.stateTimer > 84) return null;
        return this.meleeSpecialBox(s, 20, 20);
      }
      if (this.spriteKey === 'ladyvoix') {
        // stationary sound-wave blast -- projects outward from her mic stand in her
        // facing direction rather than a body-width hitbox centered on her, and
        // reaches further than a melee special to make up for not closing distance.
        // Range only for now; once the extra sprite frame she's adding is in, this
        // can extend further still to match the animation's actual visual reach.
        if (this.stateTimer < 30 || this.stateTimer > 50) return null;
        const range = 170 * s;
        const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
        return { x: hx, y: this.y - this.h*s*0.9, w: range, h: this.h*s*0.5, dmg: 24, kb: 20 };
      }
      if (this.spriteKey === 'rainwalker') {
        // he summons a water-elemental bear that lunges out well past his own
        // reach (frame 4 of 6 -- stateTimer ~48-59 at the shared 72-tick default
        // duration) -- same "the hit isn't coming from his own fists" logic as Lady
        // Voix's blast, so it gets the same stationary/extended-range treatment
        // instead of the generic body-width melee hitbox the other four still share.
        if (this.stateTimer < 46 || this.stateTimer > 58) return null;
        const range = 190 * s;
        const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
        return { x: hx, y: this.y - this.h*s*0.9, w: range, h: this.h*s*0.55, dmg: 20, kb: 20 };
      }
      if (this.spriteKey === 'frontman') {
        // throws a vinyl disc that visibly detaches and flies well away from his
        // hand (frames 3-4 of 6 -- stateTimer ~36-59) rather than connecting with
        // a punch, so like Lady Voix and Rainwalker's specials it's a stationary
        // ranged hit, not the generic body-width melee hitbox.
        if (this.stateTimer < 36 || this.stateTimer > 58) return null;
        const range = 160 * s;
        const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
        return { x: hx, y: this.y - this.h*s*0.85, w: range, h: this.h*s*0.45, dmg: 20, kb: 20 };
      }
      if (this.spriteKey === 'seth') {
        // charges an energy orb then fires it as a screen-filling blast (frames 4-6
        // of his new 11-frame special -- stateTimer ~26-46 at the shared 72-tick
        // default duration) rather than a punch, so like the other charge/blast
        // specials above it's a stationary ranged hit, not the generic melee hitbox.
        if (this.stateTimer < 27 || this.stateTimer > 45) return null;
        const range = 180 * s;
        const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
        return { x: hx, y: this.y - this.h*s*0.85, w: range, h: this.h*s*0.55, dmg: 20, kb: 20 };
      }
      if (this.spriteKey === 'coyote') {
        // spins up a tornado that whips out in front of him (frames 5-7 of his 10 at
        // the shared 72-tick duration -- stateTimer ~36-58, the tornado reaching ~300px
        // at its widest). Stationary like the other ranged specials; the column is
        // nearly full-height, so unlike the blast specials it can't be ducked.
        if (this.stateTimer < 36 || this.stateTimer > 58) return null;
        const range = 136 * s;
        const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
        return { x: hx, y: this.y - this.h*s*0.95, w: range, h: this.h*s*0.9, dmg: 22, kb: 22 };
      }
      // active from the tail of the windup through the impact frame
      if (this.stateTimer < 30 || this.stateTimer > 50) return null;
      return this.meleeSpecialBox(s, 20, 20);
    }
    if (!['lightAtk','heavyAtk','crouchLightAtk','crouchHeavyAtk'].includes(this.state)) return null;
    // active frames window (see NORMAL_TIMING)
    const timing = NORMAL_TIMING[this.state];
    if (this.stateTimer < timing.start || this.stateTimer > timing.end) return null;
    const isLight = this.state === 'lightAtk' || this.state === 'crouchLightAtk';
    const range = this.attackRange(this.state, isLight ? 55 : 75, s);
    const hx = this.facing === 1 ? this.x + (this.w*s)/2 : this.x - (this.w*s)/2 - range;
    // crouching attacks strike lower, matching the crouched fist height
    const isCrouching = this.state === 'crouchHeavyAtk' || this.state === 'crouchLightAtk';
    let hy;
    if (isCrouching) {
      // Lady Voix's crouch light is a high leg kick, well above everyone else's low poke
      hy = this.y - this.h*s*((this.spriteKey === 'ladyvoix' && isLight) ? 0.62 : 0.46);
    } else if (this.spriteKey === 'ladyvoix') {
      // her "punches" are actually a vocal blast from her mouth, not a fist thrown
      // at chest height like everyone else, so the generic 0.65 ratio landed the
      // hitbox on empty air above her raised arm instead of where the sound comes from
      // (and the old 0.85 still sat ~30px under the blast at mouth height).
      hy = this.y - this.h*s*1.1;
    } else if (this.spriteKey === 'liberty') {
      // her fist is thrown a little above the shared line (it sat just over the box)
      hy = this.y - this.h*s*0.72;
    } else if (this.spriteKey === 'phi') {
      // his short, wide-stanced legs put his gun/fist noticeably higher up his own
      // silhouette than the generic 0.65 ratio assumes (that ratio is also measured
      // against the base this.h=150, not his actual drawn height of 180*scale, which
      // already shifts every character's "0.65" down to more like 54% of what's on
      // screen -- for his proportions specifically that landed the hitbox around his
      // waist/crouch height instead of his fist).
      hy = this.y - this.h*s*0.84;
    } else {
      hy = this.y - this.h*s*0.65;
    }
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
    this.prevX = this.x; this.prevY = this.y;
    this.hitShake = false; // update() only runs when not in hit-stop, so the shake ends with the freeze
    this.stateTimer++;
    const c = this.controls;
    const grounded = this.y >= GROUND_Y;

    // Button presses are edge-detected every tick (not only while free) and remembered for
    // INPUT_BUFFER_TICKS, so a press made during the last ticks of a recovery / landing /
    // block fires the moment the fighter can act instead of being dropped -- SF5 documents
    // the same kind of leniency. (This replaces the old _lightHeld flag, which only
    // updated while free: a button held through an attack went stale and swallowed
    // the first press afterwards.) Hitstun/knockdown don't buffer.
    const lightEdge = !!keys[c.light] && !this._lightPrev;
    const heavyEdge = !!keys[c.heavy] && !this._heavyPrev;
    this._lightPrev = !!keys[c.light]; this._heavyPrev = !!keys[c.heavy];
    if (!['hitstun','knockdown','victory'].includes(this.state)) {
      if (lightEdge) this.bufLight = INPUT_BUFFER_TICKS;
      if (heavyEdge) this.bufHeavy = INPUT_BUFFER_TICKS;
    }

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
          // only replay the settle-down transition on a genuinely fresh crouch --
          // returning here right after a crouch-attack (state was crouchLightAtk/
          // crouchHeavyAtk, not 'crouch') with down still held is a continuation,
          // not a new press, so crouchPhase 'held' skips the reset and she stays
          // at her already-settled depth instead of popping back up to frame 0
          // (near-standing height) and replaying the transition every attack.
          if (this.state !== 'crouch' && this.crouchPhase !== 'held') {
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
          // A fully proportional jump (scaling impulse and gravity by displayScale(),
          // same as CHAR_HEIGHT_SCALE/STAGE_HEIGHT_SCALE scale the sprite itself) can
          // send a large-scale character's head above the top of the canvas at the
          // peak -- normal and expected in 2D fighters generally (plenty of classic
          // games let a high jump's sprite partly exceed the frame), so this only
          // steps in for the genuinely extreme case: capping how far *past* the
          // canvas top the jump is allowed to reach (half the character's own drawn
          // height) rather than demanding the whole arc stay fully on-screen, which
          // at the bayou's 1.8x scale left barely any jump at all -- a visibly worse
          // result than either the uncapped overshoot or the original unscaled jump.
          const drawH = 180 * s;
          const maxRise = Math.max(80, GROUND_Y + drawH * 0.5 - 10 - drawH);
          const maxVy = -Math.sqrt(2 * (0.63 * s) * maxRise);
          this.vy = Math.max(this.vy, maxVy); // vy is negative; smaller magnitude wins
          this.jumpDirectional = moveDir !== 0;
          // Directional jumps travel a set number of body widths (not the 3.2px/tick walk
          // speed they used to inherit, which only covered ~137px -- barely one body width,
          // so with pushboxes a jump-in could never cross over). Distance = widths x
          // body width, spread over this jump's actual hang time (it varies when the
          // rise cap above kicks in), so a forward jump from point-blank clears the
          // opponent and lands behind them, and one from mid-range lands on top of them.
          if (moveDir !== 0) {
            const hangTicks = 2 * Math.abs(this.vy) / (0.63 * s);
            const widths = moveDir === this.facing ? JUMP_FORWARD_WIDTHS : JUMP_BACK_WIDTHS;
            this.vx = moveDir * widths * this.w * s / hangTicks;
          }
          this.airAttack = null;
          this.airAttackUsed = false;
          this.startState('jump');
        }

        if (this.bufLight > 0) {
          const seqDone = bufferHasSequence(this.inputBuf, ['D','B']) || bufferHasSequence(this.inputBuf, ['D','F']);
          if (seqDone && this.meter >= SPECIAL_METER_COST && this.anim('special')) {
            this.meter -= SPECIAL_METER_COST;
            this.specialHitsApplied = new Set();
            this.startState('special', SPECIAL_DUR[this.spriteKey] || 72);
          } else if (keys[c.down]) {
            this.startState('crouchLightAtk', NORMAL_TIMING.crouchLightAtk.dur);
            playWhiffSound();
          } else {
            this.startState('lightAtk', NORMAL_TIMING.lightAtk.dur);
            playWhiffSound();
          }
          this.inputBuf.length = 0;
          this.bufLight = 0; this.bufHeavy = 0; // one action per tick: a light that fires eats a simultaneous heavy
        }
        if (this.bufHeavy > 0) {
          if (keys[c.down]) {
            this.startState('crouchHeavyAtk', NORMAL_TIMING.crouchHeavyAtk.dur);
            playWhiffSound();
          } else {
            this.startState('heavyAtk', NORMAL_TIMING.heavyAtk.dur);
            playWhiffSound();
          }
          this.bufLight = 0; this.bufHeavy = 0;
        }
      } else if (this.state === 'jump' && !this.airAttack && !this.airAttackUsed) {
        // jump attacks: punch (light) or kick (heavy), one per jump, doesn't interrupt the jump arc
        if (this.bufLight > 0) {
          this.bufLight = 0;
          this.airAttack = 'light';
          this.airAttackTimer = 0;
          this.airAttackUsed = true;
          this.airAttackHitLock = false;
          playWhiffSound();
        } else if (this.bufHeavy > 0) {
          this.bufHeavy = 0;
          this.airAttack = 'heavy';
          this.airAttackTimer = 0;
          this.airAttackUsed = true;
          this.airAttackHitLock = false;
          playWhiffSound();
        }
      }
    }

    // age the press buffers (consumed ones were already zeroed above)
    if (this.bufLight > 0) this.bufLight--;
    if (this.bufHeavy > 0) this.bufHeavy--;

    // The Coyote's jumping heavy strike is a forward lunge on a gust of wind: burst
    // forward through the strike, then hand back whatever air speed the jump had.
    if (this.airAttack === 'heavy' && this.spriteKey === 'coyote' && this.state === 'jump') {
      const t = this.airAttackTimer;
      if (t === 0) this.preLungeVx = this.vx;
      if (t >= 3 && t <= 14) this.vx = this.facing * 7;
      else if (t > 14) this.vx = this.preLungeVx || 0;
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
      if (this.y >= GROUND_Y) { this.y = GROUND_Y; this.vy = 0; if (this.state === 'jump') { this.startState('idle'); playLandSound(); } }
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
        // (22-63 at 5.4px/tick -- same ~220px of travel as the old 98-tick version's
        // 26-75 at 4.5, just compressed along with SPECIAL_DUR.liberty)
        const dashing = this.stateTimer >= 22 && this.stateTimer < 63;
        this.vx = dashing ? this.facing * 5.4 : 0;
      } else if (this.spriteKey === 'echo') {
        // the original lunges forward through the final strike (frames 5-7), ~100px
        const dashing = this.stateTimer >= 40 && this.stateTimer < 64;
        this.vx = dashing ? this.facing * 4.2 : 0;
      } else if (this.spriteKey === 'ladyvoix' || this.spriteKey === 'rainwalker' || this.spriteKey === 'frontman' || this.spriteKey === 'seth' || this.spriteKey === 'coyote') {
        // ranged specials (soundwave blast / water-bear summon / thrown vinyl disc /
        // charged energy blast) are stationary -- the hit reaches out on its own
        // rather than the character closing distance like a melee special
        this.vx = 0;
      } else if (this.spriteKey === 'phi') {
        // same dash distance/speed as the shared default (14 ticks at facing*14,
        // 196px total) but shifted to land right before his hit window (71-84,
        // see attackHitbox()) instead of the default's 26-40. With SPECIAL_DUR.phi
        // stretched out, keeping the default's absolute tick numbers meant he'd
        // finish dashing -- and stop dead, fully overshot -- tens of ticks before
        // the tablet-smash was even active, whiffing on anyone who hadn't chased him.
        const dashing = this.stateTimer >= 57 && this.stateTimer < 71;
        this.vx = dashing ? this.facing * 14 : 0;
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

    // footstep sfx: a fixed cadence rather than tied to exact animation frames
    // (no per-frame foot-plant data to hook), reset on every state exit so a
    // fresh walk always starts its first step from silence, not mid-cycle.
    if (this.state === 'walk') {
      this.footstepTimer++;
      if (this.footstepTimer >= 16) { this.footstepTimer = 0; playFootstepSound(); }
    } else {
      this.footstepTimer = 0;
    }

    // animation frame advance (only meaningful for sprite-based walk)
    this.animTimer++;
    const walkLen = this.anim('walk') ? this.anim('walk').count : 8;
    const walkHold = WALK_TICKS_PER_FRAME[this.spriteKey] || 5;
    if (this.animTimer >= walkHold) { this.animTimer -= walkHold; this.animFrame = (this.animFrame + 1) % walkLen; }
    this.idleTimer++;
    const idleLen = this.anim('idle') ? this.anim('idle').count : 4;
    if (this.idleTimer >= IDLE_TICKS_PER_FRAME) { this.idleTimer = 0; this.idleFrame = (this.idleFrame + 1) % idleLen; }
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
    this.bufLight = 0; this.bufHeavy = 0; // a hit interrupts any remembered press
    this.hp = Math.max(0, this.hp - dmg);
    this.vx = dirFrom * kb;
    this.meter = Math.min(this.maxMeter, this.meter + dmg * 0.5);
    if (this.hp === 0) {
      this.startState('knockdown', 60);
      playKnockdownSound();
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
    let drawH = 180 * (CHAR_HEIGHT_SCALE[this.spriteKey] || 1) * (STAGE_HEIGHT_SCALE[currentStage] || 1);
    // Experimental: test whether a flat 20% bump reads as "right-sized" for his
    // victory pose specifically -- victory has no hitbox/physics, so it's safe to
    // scale only the render here without touching displayScale().
    if (this.spriteKey === 'frontman' && this.state === 'victory') drawH *= 1.2;
    const drawW = drawH * (img.width / img.height);
    // blend between last tick's and this tick's position (renderAlpha is 1 whenever the
    // sim didn't just advance: paused, hit-stop, round over)
    let rx = this.prevX + (this.x - this.prevX) * renderAlpha;
    const ry = this.prevY + (this.y - this.prevY) * renderAlpha;
    // hit-stop shake: the struck fighter judders side to side while the game is frozen
    if (this.hitShake && hitStopFrames > 0) rx += (hitStopFrames % 2 ? 3 : -3);
    ctx.save();
    if (this.facing === -1) {
      ctx.translate(rx, 0); ctx.scale(-1,1); ctx.translate(-rx, 0);
    }
    ctx.drawImage(img, rx - drawW/2, ry - drawH + 6, drawW, drawH);
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

  // Sprite frame for a normal attack, weighted by phase instead of spread evenly: the
  // frames before the strike pose share the short startup, the strike frame(s) are held
  // for the whole hit window (so the extended pose is what's on screen while the hitbox
  // is live), and the remaining frames share the long recovery. See NORMAL_TIMING /
  // STRIKE_FRAMES.
  getAttackFrame(animName) {
    const a = this.anim(animName);
    if (!a) return 0;
    const n = a.count, t = NORMAL_TIMING[animName];
    const listed = STRIKE_FRAMES[this.spriteKey] && STRIKE_FRAMES[this.spriteKey][animName];
    let sf = listed ? listed[0] : Math.floor(n * 0.35);
    let sl = listed ? listed[1] : Math.floor(n * 0.7);
    sf = Math.min(sf, n - 1); sl = Math.max(sf, Math.min(sl, n - 1));
    const tick = this.stateTimer;
    if (tick < t.start) {
      return sf === 0 ? 0 : Math.min(sf - 1, Math.floor(tick / t.start * sf));
    }
    if (tick <= t.end) {
      const span = t.end - t.start + 1, k = sl - sf + 1;
      return sf + Math.min(k - 1, Math.floor((tick - t.start) / span * k));
    }
    if (sl >= n - 1) return n - 1;
    const recoveryTicks = Math.max(1, t.dur - (t.end + 1)), k = n - 1 - sl;
    return sl + 1 + Math.min(k - 1, Math.floor((tick - (t.end + 1)) / recoveryTicks * k));
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
    if (hb && SHOW_HITBOXES) {
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

  applyIntent(intent, dirAction, awayAction, opponent) {
    if (intent === 'approach') this.applyAction(dirAction);
    else if (intent === 'retreat') this.applyAction(awayAction);
    else if (intent === 'block') {
      // low attacks only get stopped by a crouching guard (see resolveCombat()'s
      // isLowAttack check) -- holding back alone no longer blocks everything, so
      // the CPU needs to duck specifically when the incoming attack is one of those,
      // checked live each tick rather than decided once at the start of the block
      // window in case the opponent switches attack type mid-exchange.
      const lowIncoming = opponent && ['crouchLightAtk', 'crouchHeavyAtk'].includes(opponent.state);
      this.applyAction(lowIncoming ? Object.assign({ down: true }, awayAction) : awayAction);
    }
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
    // pushboxes keep bodies apart, so every range below is measured from the distance at which
    // the two pushboxes touch (the old fixed numbers assumed fighters could stand on each other)
    const touch = (f.w * f.displayScale() + o.w * o.displayScale()) / 2;
    const dir = this.dirToOpp();
    const dirAction = dir === 1 ? { right: true } : { left: true };
    const awayAction = dir === 1 ? { left: true } : { right: true };

    // defensive reaction: opponent is mid-swing and close enough to matter
    const oppAttacking = ['lightAtk', 'heavyAtk', 'crouchLightAtk', 'crouchHeavyAtk', 'special'].includes(o.state);
    if (oppAttacking && dist < touch + 110 && !this.reacting) {
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
      this.applyIntent(this.intent, dirAction, awayAction, o);
      return;
    }

    // pick a new intent based on spacing
    if (dist > touch + 170) {
      if (dist < touch + 240 && Math.random() < params.jumpAttackChance) { this.startJumpAttackSequence(); return; }
      this.setIntent('approach', 14 + Math.floor(Math.random() * 10));
      return;
    }
    if (dist > touch + 60) {
      const roll = Math.random();
      if (Math.random() < params.jumpAttackChance) this.startJumpAttackSequence();
      else if (f.meter >= SPECIAL_METER_COST && roll < params.specialChance) this.startSpecialSequence();
      else if (roll < params.approachChance) this.setIntent('approach', 10);
      else this.setIntent('neutral', 8);
      return;
    }
    // close range: pick an attack or hold ground
    const roll = Math.random();
    if (f.meter >= SPECIAL_METER_COST && roll < params.specialChance) this.startSpecialSequence();
    else if (roll < 0.30) this.queueSequence([{ action: { light: true }, ticks: 3 }]);
    else if (roll < 0.50) this.queueSequence([{ action: { heavy: true }, ticks: 3 }]);
    else if (roll < 0.60) this.queueSequence([{ action: { down: true, light: true }, ticks: 3 }]);
    else if (roll < 0.68) this.queueSequence([{ action: { down: true, heavy: true }, ticks: 3 }]);
    else if (roll < 0.68 + params.retreatChance) this.setIntent('retreat', 12);
    else this.setIntent('block', 14);
  }
}

