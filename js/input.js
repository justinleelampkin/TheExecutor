// ---------- Input ----------
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (titleScreenActive) { titleScreenActive = false; modeSelectActive = true; return; }
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
    const ctrl = csPhase === 'p1' ? p1.controls : p2.controls;
    if (e.code === ctrl.left) { csCursor = csNextUnlocked(csCursor, -1); playMenuMoveSound(); }
    else if (e.code === ctrl.right) { csCursor = csNextUnlocked(csCursor, 1); playMenuMoveSound(); }
    else if (e.code === ctrl.light || e.code === ctrl.heavy) {
      playMenuConfirmSound();
      if (csPhase === 'p1') {
        p1Choice = ROSTER[csCursor];
        applyRosterChoice(p1, p1Choice);
        playCharacterSelectVoice(p1);
        if (vsCPU) {
          const other = ROSTER.find(r => r.unlocked && r !== p1Choice) || p1Choice;
          p2Choice = other;
          applyRosterChoice(p2, p2Choice);
          characterSelectActive = false;
          currentStage = pickStageFor(p1Choice.key, p2Choice.key);
          resetRound();
        } else {
          csPhase = 'p2';
          csCursor = 0;
        }
      } else {
        p2Choice = ROSTER[csCursor];
        applyRosterChoice(p2, p2Choice);
        playCharacterSelectVoice(p2);
        characterSelectActive = false;
        currentStage = pickStageFor(p1Choice.key, p2Choice.key);
        resetRound();
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
