// ---------- Input ----------
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (titleScreenActive) { titleScreenActive = false; modeSelectActive = true; return; }
  // pause toggle -- lives outside every screen's own key handling below so it always
  // works once past the title, including mid-match; freezes gameplay updates while
  // still redrawing (see the `paused` branch in game.js's renderFight()) so a pose stays on
  // screen for screenshotting sprite issues instead of the canvas going blank.
  if (e.code === 'Space') { paused = !paused; return; }
  // H toggles the yellow attack-hitbox outlines (on by default only when run locally)
  if (e.code === 'KeyH') { SHOW_HITBOXES = !SHOW_HITBOXES; return; }
  if (modeSelectActive) {
    if (e.code === 'Digit1') { playMenuConfirmSound(); vsCPU = true; modeSelectActive = false; difficultySelectActive = true; }
    else if (e.code === 'Digit2') { playMenuConfirmSound(); vsCPU = false; modeSelectActive = false; characterSelectActive = true; csPhase = 'p1'; csCursor = 0; playCharacterSelectMusic(); }
    return;
  }
  if (difficultySelectActive) {
    if (e.code === 'Digit1') { playMenuConfirmSound(); cpuDifficulty = 'easy'; difficultySelectActive = false; characterSelectActive = true; csPhase = 'p1'; csCursor = 0; playCharacterSelectMusic(); }
    else if (e.code === 'Digit2') { playMenuConfirmSound(); cpuDifficulty = 'medium'; difficultySelectActive = false; characterSelectActive = true; csPhase = 'p1'; csCursor = 0; playCharacterSelectMusic(); }
    else if (e.code === 'Digit3') { playMenuConfirmSound(); cpuDifficulty = 'hard'; difficultySelectActive = false; characterSelectActive = true; csPhase = 'p1'; csCursor = 0; playCharacterSelectMusic(); }
    return;
  }
  if (characterSelectActive) {
    if (csAwaitingVoice) return; // stalled on the just-confirmed pick's voice line -- see below
    const ctrl = csPhase === 'p1' ? p1.controls : p2.controls;
    if (e.code === ctrl.left) { csCursor = csNextUnlocked(csCursor, -1); playMenuMoveSound(); }
    else if (e.code === ctrl.right) { csCursor = csNextUnlocked(csCursor, 1); playMenuMoveSound(); }
    else if (e.code === ctrl.light || e.code === ctrl.heavy) {
      playMenuConfirmSound();
      if (csPhase === 'p1') {
        p1Choice = ROSTER[csCursor];
        applyRosterChoice(p1, p1Choice);
        loadCharacterSprites(p1Choice.key); // start downloading now, under the voice line
        if (vsCPU) loadCharacterSprites((ROSTER.find(r => r.unlocked && r !== p1Choice) || p1Choice).key);
        const voice = playCharacterSelectVoice(p1);
        const proceed = () => {
          csAwaitingVoice = false;
          if (vsCPU) {
            p2Choice = ROSTER.find(r => r.unlocked && r !== p1Choice) || p1Choice;
            applyRosterChoice(p2, p2Choice);
            startMatchWhenReady();
          } else {
            csPhase = 'p2';
            csCursor = 0;
          }
        };
        if (voice) { csAwaitingVoice = true; voice.addEventListener('ended', proceed, { once: true }); }
        else proceed();
      } else {
        p2Choice = ROSTER[csCursor];
        applyRosterChoice(p2, p2Choice);
        loadCharacterSprites(p2Choice.key); // start downloading now, under the voice line
        const voice = playCharacterSelectVoice(p2);
        const proceed = () => {
          csAwaitingVoice = false;
          startMatchWhenReady();
        };
        if (voice) { csAwaitingVoice = true; voice.addEventListener('ended', proceed, { once: true }); }
        else proceed();
      }
    }
    return;
  }
  // rematch / character-select prompt, shown once the post-round grace period ends
  // (see checkRoundEnd() and the roundOver block in drawHUD())
  if (roundOver && roundOverTimer <= 0) {
    if (e.code === 'Digit1') {
      playMenuConfirmSound();
      resetRound();
    } else if (e.code === 'Digit2') {
      playMenuConfirmSound();
      roundOver = false;
      p1.wins = 0; p2.wins = 0;
      characterSelectActive = true; csPhase = 'p1'; csCursor = 0;
      playCharacterSelectMusic();
    }
    return;
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
