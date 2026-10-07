// ---------- Music ----------
// One theme track per character, keyed by spriteKey (ROSTER's `key`). A character
// with no entry here just plays silence -- same "partial roster is fine" pattern
// used everywhere else (see the note on character sprites in the README).
const CHAR_MUSIC = {
  architech: 'assets/audio/architech.mp3',
  botanist: 'assets/audio/botanist.mp3',
  frontman: 'assets/audio/frontman.mp3',
  ladyvoix: 'assets/audio/ladyvoix.mp3',
};
// No track supplied yet -- drop one at assets/audio/character-select.mp3 and set
// this to that path to turn character-select music on.
const CHARACTER_SELECT_MUSIC = null;

// One-shot voice line per character, played the moment they're locked in on the
// select screen (in addition to, not instead of, the generic MENU_CONFIRM_SOUND
// blip below). Same partial-roster-is-fine pattern as CHAR_MUSIC -- a character
// with no line here just gets the generic confirm blip.
const CHAR_SELECT_VOICE = {
  // A character with several lines gets one picked at random each time they're selected --
  // add another file to its list (or a new character) to widen the pool.
  seth: ['assets/audio/select-seth.mp3'],
  liberty: ['assets/audio/select-liberty.mp3', 'assets/audio/voices/liberty-1.mp3', 'assets/audio/voices/liberty-2.mp3'],
  coyote: ['assets/audio/voices/coyote-1.mp3', 'assets/audio/voices/coyote-2.mp3'],
  ladyvoix: [1, 2, 3, 4, 5, 6, 7].map(n => `assets/audio/voices/ladyvoix-${n}.mp3`),
  botanist: [1, 2, 3, 4, 5, 6].map(n => `assets/audio/voices/botanist-${n}.mp3`),
  phi: [1, 2, 3, 4, 5].map(n => `assets/audio/voices/phi-${n}.mp3`),
  rainwalker: [1, 2, 3, 4, 5].map(n => `assets/audio/voices/rainwalker-${n}.mp3`),
  echo: ['assets/audio/voices/echo-1.m4a'],
};

const bgMusic = new Audio();
bgMusic.loop = true;
bgMusic.volume = 0.5;
let currentTrackKey = null;

// `key` is just an identity for "is this already playing" -- switching to a
// different key always re-triggers, switching to the same key never restarts
// a track that's already going (so a rematch with the same P1 doesn't reset
// their song back to 0:00 every round).
function playTrack(key, src) {
  if (!src) { stopMusic(); return; }
  if (currentTrackKey === key) return;
  currentTrackKey = key;
  bgMusic.src = src;
  bgMusic.currentTime = 0;
  // Autoplay is blocked without a user gesture -- every call site here fires
  // from inside a keydown handler, which counts, but swallow the rejection
  // anyway in case a call ever comes from somewhere that isn't.
  bgMusic.play().catch(() => {});
}

function stopMusic() {
  currentTrackKey = null;
  bgMusic.pause();
}

function playCharacterSelectMusic() {
  playTrack('__select__', CHARACTER_SELECT_MUSIC);
}

function playMatchMusicFor(fighter) {
  playTrack(fighter.spriteKey, CHAR_MUSIC[fighter.spriteKey]);
}

// ---------- Sound effects ----------
// A few takes per sound so repeated hits don't all sound identical. SFX_VOLUME is
// separate from bgMusic.volume so hits stay clearly audible under the music.
const SFX_VOLUME = 0.7;
const HIT_SOUNDS = ['assets/audio/hit1.mp3', 'assets/audio/hit2.mp3', 'assets/audio/hit3.mp3'];
const BLOCK_SOUND = 'assets/audio/block.mp3';
const WHIFF_SOUND = 'assets/audio/whiff.mp3';
const LAND_SOUND = 'assets/audio/land.mp3';
const KNOCKDOWN_SOUND = 'assets/audio/knockdown.mp3';
const FOOTSTEP_SOUND = 'assets/audio/footstep.mp3';
const READY_FIGHT_SOUND = 'assets/audio/ready-fight.mp3';
const VICTORY_SOUND = 'assets/audio/victory.mp3';
const LOSS_SOUND = 'assets/audio/loss.mp3';
const MENU_MOVE_SOUND = 'assets/audio/menu-move.mp3';
const MENU_CONFIRM_SOUND = 'assets/audio/menu-confirm.mp3';

// A fresh Audio() per play (rather than reusing one element) so overlapping hits
// -- a combo, or both fighters connecting the same tick -- don't cut each other off.
function playSfx(src) {
  if (!src) return;
  const sfx = new Audio(src);
  sfx.volume = SFX_VOLUME;
  sfx.play().catch(() => {});
}

function playHitSound() {
  playSfx(HIT_SOUNDS[Math.floor(Math.random() * HIT_SOUNDS.length)]);
}

function playBlockSound() {
  playSfx(BLOCK_SOUND);
}

function playWhiffSound() {
  playSfx(WHIFF_SOUND);
}

function playLandSound() {
  playSfx(LAND_SOUND);
}

function playKnockdownSound() {
  playSfx(KNOCKDOWN_SOUND);
}

function playFootstepSound() {
  playSfx(FOOTSTEP_SOUND);
}

// The "Ready... Fight!" call at the start of every round. Calls onDone once it has finished
// playing -- or immediately if it can't play at all (blocked autoplay, missing file) -- so
// the round never stays frozen waiting on audio that isn't coming (see roundIntroActive in
// game.js, which holds the fighters still until this fires).
function playReadyFightSound(onDone) {
  const sfx = new Audio(READY_FIGHT_SOUND);
  sfx.volume = SFX_VOLUME;
  let done = false;
  const finish = () => { if (done) return; done = true; if (onDone) onDone(); };
  sfx.addEventListener('ended', finish, { once: true });
  sfx.addEventListener('error', finish, { once: true });
  sfx.play().catch(finish);
  return sfx;
}

function playVictorySound() {
  playSfx(VICTORY_SOUND);
}

function playLossSound() {
  playSfx(LOSS_SOUND);
}

function playMenuMoveSound() {
  playSfx(MENU_MOVE_SOUND);
}

function playMenuConfirmSound() {
  playSfx(MENU_CONFIRM_SOUND);
}

// Returns the Audio element so the caller can wait for it to finish (character
// select stalls on a pick until its voice line ends -- see input.js), or null when
// this character has no line, so the caller knows there's nothing to wait for.
function playCharacterSelectVoice(fighter) {
  const lines = CHAR_SELECT_VOICE[fighter.spriteKey];
  if (!lines || !lines.length) return null;
  const src = lines[Math.floor(Math.random() * lines.length)];
  const sfx = new Audio(src);
  sfx.volume = SFX_VOLUME;
  // if the file can't play (blocked autoplay, missing file, unsupported format) the select screen
  // is waiting on this clip's 'ended' event -- fire it ourselves so the pick still goes through
  const giveUp = () => sfx.dispatchEvent(new Event('ended'));
  sfx.addEventListener('error', giveUp, { once: true });
  sfx.play().catch(giveUp);
  return sfx;
}
