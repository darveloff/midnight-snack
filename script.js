// Midnight Snack — Single-file routing + Story logic (with Re-listen & no-skip)

(function(){
  // --- Simple hash router ---
  const routes = Array.from(document.querySelectorAll('.route'));
  const navLinks = Array.from(document.querySelectorAll('[data-route]'));
  function show(hash){
    const id = (hash || '#home').replace('#','');
    routes.forEach(s => s.classList.toggle('active', s.id === id));
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#'+id));
  }
  window.addEventListener('hashchange', () => show(location.hash));
  show(location.hash);

  // --- Story logic ---
  const mainAudio  = document.getElementById('mainAudio');
  const playBtn    = document.getElementById('playBtn');
  const relistenBtn= document.getElementById('relistenBtn'); // NEW
  const options    = Array.from(document.querySelectorAll('.option'));
  const statusEl   = document.getElementById('status');
  const bar        = document.getElementById('progressBar');

  if (!mainAudio) return; // defensive

  // Checkpoints in seconds
  const stops = [18, 27, 35, 42, 52, 58];
  let stopIdx = 0;                 // next checkpoint index to watch for
  let activeCheckpoint = -1;       // the checkpoint we’re currently answering (−1 = none)
  let reListening = false;         // when true, we’re replaying up to active checkpoint

  // Correct answer per checkpoint
  const correctAnswers = ['Ice-Cream','Carrots','Chips','Cookies','Sprite','Chocolate-Bar'];

  let interactionLock = true;      // choices disabled while narration plays

  // --- Pre-listen gate ---
  let preListenRequired = true;
  const heard = new Set(); // which sounds have finished once

  function setOptionsState(state){
    options.forEach(btn => state ? btn.setAttribute('data-state', state) : btn.removeAttribute('data-state'));
  }
  function lockChoices(){ interactionLock = true; setOptionsState('locked'); }
  function unlockChoices(){ interactionLock = false; setOptionsState(''); }

  function stopAllOptionAudio(){
    document.querySelectorAll('.option audio').forEach(a => {
      try { if (!a.paused) a.pause(); a.currentTime = 0; } catch {}
    });
  }

  function updateProgress(){
    const pct = Math.min(100, (mainAudio.currentTime / (mainAudio.duration || 80)) * 100);
    bar.style.width = (isFinite(pct) ? pct : 0) + '%';
  }

  // Utility: mark as heard on sample end
  function markHeard(btn){
    if (btn.getAttribute('data-state') !== 'heard') {
      btn.setAttribute('data-state','heard');
    }
    heard.add(btn.getAttribute('data-answer'));
    const remaining = options.length - heard.size;
    if (remaining > 0) {
      statusEl.textContent = `Great — ${heard.size}/6 heard. Listen to ${remaining} more to unlock the story.`;
    } else if (preListenRequired) {
      preListenRequired = false;
      statusEl.textContent = 'All set! Press Play to start the story.';
      playBtn.disabled = false;     // unlock Play
      relistenBtn.disabled = true;  // nothing to relisten yet
      lockChoices();                // choices locked while narration plays
      interactionLock = true;
      stopAllOptionAudio();
    }
  }

  // Start state: pre-listen active
  playBtn.disabled = true;
  relistenBtn && (relistenBtn.disabled = true);
  interactionLock = false; // allow auditioning
  setOptionsState('');

  // --- Controls ---
  playBtn.addEventListener('click', () => {
    // Prevent skipping at a checkpoint: Play is disabled there anyway,
    // but guard just in case.
    if (activeCheckpoint !== -1) return;

    // If finished earlier, reset to replay
    if (mainAudio.ended || stopIdx >= stops.length) {
      stopIdx = 0;
      activeCheckpoint = -1;
      reListening = false;
      mainAudio.currentTime = 0;
      statusEl.textContent = 'Replaying from start.';
    }
    mainAudio.play();
  });

  if (relistenBtn) {
    relistenBtn.addEventListener('click', () => {
      if (activeCheckpoint === -1 || preListenRequired) return; // only during a question
      // compute segment start = start of current segment
      const segmentStart = (activeCheckpoint === 0) ? 0 : stops[activeCheckpoint - 1];
      reListening = true;
      lockChoices();             // no picking while we re-listen the segment
      playBtn.disabled = true;   // keep play disabled during re-listen
      statusEl.textContent = `Replaying the segment before checkpoint ${activeCheckpoint+1}…`;
      mainAudio.currentTime = segmentStart;
      mainAudio.play();
    });
  }

  mainAudio.addEventListener('play', () => {
    playBtn.disabled = true;
    lockChoices();
    // If we’re in re-listen, status text already set; otherwise:
    if (!reListening) statusEl.textContent = 'Playing… listen carefully.';
    stopAllOptionAudio();
  });

  mainAudio.addEventListener('pause', () => {
    // Re-enable Play only if we’re not at a question and not in pre-listen
    if (!preListenRequired && activeCheckpoint === -1) playBtn.disabled = false;
  });

  mainAudio.addEventListener('timeupdate', () => {
    updateProgress();

    // Normal progression to next checkpoint
    if (!reListening && stopIdx < stops.length && mainAudio.currentTime >= stops[stopIdx] - 0.05) {
      mainAudio.pause();
      mainAudio.currentTime = stops[stopIdx]; // snap to checkpoint time
      // Set the active question to this checkpoint; move to watch the next one
      activeCheckpoint = stopIdx;
      stopIdx++;

      // At a checkpoint: user MUST answer → disable Play, enable Re-listen
      playBtn.disabled = true;         // cannot skip the question
      if (relistenBtn) relistenBtn.disabled = false;

      unlockChoices();
      statusEl.innerHTML = `Checkpoint ${activeCheckpoint+1}/6 — Pick the right sound to continue.`;
      return;
    }

    // Re-listening flow: pause exactly at the SAME checkpoint again,
    // unlock choices, keep stopIdx as-is (already pointing to the next one).
    if (reListening && activeCheckpoint !== -1) {
      const target = stops[activeCheckpoint];
      if (mainAudio.currentTime >= target - 0.05) {
        mainAudio.pause();
        mainAudio.currentTime = target; // snap back to the question point
        reListening = false;

        // stay at the same question
        playBtn.disabled = true;         // still must answer first
        if (relistenBtn) relistenBtn.disabled = false;
        unlockChoices();
        statusEl.innerHTML = `Checkpoint ${activeCheckpoint+1}/6 — Pick the right sound to continue.`;
      }
    }
  });

  mainAudio.addEventListener('ended', () => {
    activeCheckpoint = -1;
    reListening = false;
    if (relistenBtn) relistenBtn.disabled = true;
    statusEl.innerHTML = 'Narration finished. Great job! You nailed the choices.';
    setOptionsState('locked');
    playBtn.textContent = 'Replay';
    playBtn.disabled = false;
  });

  // Option buttons
  options.forEach(btn => {
    const clip = btn.querySelector('audio');

    // When a sample fully ends, count it toward pre-listen completion
    clip.addEventListener('ended', () => {
      if (preListenRequired) markHeard(btn);
    });

    btn.addEventListener('click', () => {
      // --- PRE-LISTEN: allow auditioning, then return ---
      if (preListenRequired) {
        // audition: stop other clips, play this one from start
        stopAllOptionAudio();
        clip.play().catch(()=>{});
        return;
      }

      // --- GAME PHASE: NEVER play option audio ---
      // If narration is playing (not at question), ignore clicks
      if (interactionLock) return;

      const userPick = btn.getAttribute('data-answer');
      // Needed answer corresponds to the *active* checkpoint
      const neededAnswer = (activeCheckpoint >= 0)
        ? correctAnswers[activeCheckpoint]
        : correctAnswers[Math.max(0, stopIdx-1)];

      if (userPick === neededAnswer) {
        btn.setAttribute('data-state','correct');
        statusEl.textContent = 'Correct! Resuming…';

        // Clear active question and continue
        activeCheckpoint = -1;
        if (relistenBtn) relistenBtn.disabled = true;
        lockChoices();

        setTimeout(() => {
          playBtn.disabled = false; // let play resume
          mainAudio.play();
        }, 400);
      } else {
        btn.setAttribute('data-state','wrong');
        statusEl.textContent = 'Not quite — try another.';
      }
    });
  });

  // Initial state: allow pre-listen
})();
