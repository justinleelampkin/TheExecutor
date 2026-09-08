// ---------- Input ----------
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (titleScreenActive) { titleScreenActive = false; modeSelectActive = true; return; }
  if (modeSelectActive) {
    if (e.code === 'Digit1') { vsCPU = true; modeSelectActive = false; difficultySelectActive = true; }
    else if (e.code === 'Digit2') { vsCPU = false; modeSelectActive = false; characterSelectActive = true; csPhase = 'p1'; csCursor = 0; }
    return;
  }
  if (difficultySelectActive) {
    if (e.code === 'Digit1') { cpuDifficulty = 'easy'; difficultySelectActive = false; characterSelectActive = true; csPhase = 'p1'; csCursor = 0; }
    else if (e.code === 'Digit2') { cpuDifficulty = 'medium'; difficultySelectActive = false; characterSelectActive = true; csPhase = 'p1'; csCursor = 0; }
    else if (e.code === 'Digit3') { cpuDifficulty = 'hard'; difficultySelectActive = false; characterSelectActive = true; csPhase = 'p1'; csCursor = 0; }
    return;
  }
  if (characterSelectActive) {
    const ctrl = csPhase === 'p1' ? p1.controls : p2.controls;
    if (e.code === ctrl.left) { csCursor = csNextUnlocked(csCursor, -1); }
    else if (e.code === ctrl.right) { csCursor = csNextUnlocked(csCursor, 1); }
    else if (e.code === ctrl.light || e.code === ctrl.heavy) {
      if (csPhase === 'p1') {
        p1Choice = ROSTER[csCursor];
        applyRosterChoice(p1, p1Choice);
        if (vsCPU) {
          const other = ROSTER.find(r => r.unlocked && r !== p1Choice) || p1Choice;
          p2Choice = other;
          applyRosterChoice(p2, p2Choice);
          characterSelectActive = false;
          resetRound();
        } else {
          csPhase = 'p2';
          csCursor = 0;
        }
      } else {
        p2Choice = ROSTER[csCursor];
        applyRosterChoice(p2, p2Choice);
        characterSelectActive = false;
        resetRound();
      }
    }
    return;
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
