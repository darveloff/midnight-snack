// Midnight Snack — Interactive Story Logic
// Handles routing between sections, listening phase, and guessing game.

// Wrap in IIFE to avoid polluting global scope
(function(){

  /* =========================
     SIMPLE HASH ROUTER
     (controls Home / Story / Behind pages)
  ========================== */
  const routes = Array.from(document.querySelectorAll('.route'));
  const navLinks = Array.from(document.querySelectorAll('[data-route]'));

  function show(hash){
    const id = (hash || '#home').replace('#','');
    // Show only the route that matches the hash (e.g., #story)
    routes.forEach(s => s.classList.toggle('active', s.id === id));
    // Update nav link highlight
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#'+id));
  }

  // When URL hash changes, update visible section
  window.addEventListener('hashchange', () => show(location.hash));
  show(location.hash); // initial load

  /* =========================
     PHASE 1 — LISTENING PHASE
     User listens to 6 sound samples before proceeding.
  ========================== */
  const listeningPhase = document.getElementById('listeningPhase');
  const guessingPhase = document.getElementById('guessingPhase');
  const nextBtn = document.getElementById('nextBtn');
  const listeningStatus = document.getElementById('listeningStatus');
  const listenOptions = Array.from(document.querySelectorAll('.option-listen'));

  const heardSounds = new Set(); // keeps track of which sounds were played

  // Helper: stop all currently playing "listen" audios
  function stopAllListeningAudio(){
    document.querySelectorAll('.option-listen audio').forEach(a => {
      try {
        if (!a.paused) a.pause();
        a.currentTime = 0;
      } catch {}
    });
  }

  // Attach events for each listening button
  listenOptions.forEach(btn => {
    const clip = btn.querySelector('audio');

    // When clip ends, mark as "heard"
    clip.addEventListener('ended', () => {
      const answer = btn.getAttribute('data-answer');
      if (!heardSounds.has(answer)) {
        heardSounds.add(answer);
        btn.setAttribute('data-state', 'heard'); // visually mark as done

        const remaining = listenOptions.length - heardSounds.size;
        if (remaining > 0) {
          listeningStatus.textContent = `Great! ${heardSounds.size}/6 heard. Listen to ${remaining} more to continue.`;
        } else {
          listeningStatus.textContent = "Perfect! You've heard all sounds. Click Next to start the game.";
          nextBtn.disabled = false;
        }
      }
    });

    // On click, stop others and play this sound
    btn.addEventListener('click', () => {
      stopAllListeningAudio();
      clip.currentTime = 0;
      clip.play().catch(()=>{});
    });
  });

  // Proceed to guessing phase
  nextBtn.addEventListener('click', () => {
    listeningPhase.style.display = 'none';
    guessingPhase.style.display = 'block';
  });


  /* =========================
     PHASE 2 — GUESSING GAME
     Main audio plays and stops at checkpoints.
     Player picks which sound matches each part.
  ========================== */
  const mainAudio  = document.getElementById('mainAudio');
  const playBtn    = document.getElementById('playBtn');
  const relistenBtn= document.getElementById('relistenBtn');
  const options    = Array.from(document.querySelectorAll('.option'));
  const statusEl   = document.getElementById('status');
  const bar        = document.getElementById('progressBar');

  if (!mainAudio) return; // defensive guard

  // Predefined pause points in main narration (in seconds)
  const stops = [18, 27, 35, 42, 52, 58];
  let stopIdx = 0;              // index of next checkpoint
  let activeCheckpoint = -1;    // current question index
  let reListening = false;      // replaying last segment flag

  // Correct answers for each checkpoint
  const correctAnswers = ['Ice-Cream','Carrots','Chips','Cookies','Sprite','Chocolate-Bar'];

  let interactionLock = true; // disables guessing until checkpoint

  // --- Helper functions ---
  function setOptionsState(state){
    options.forEach(btn =>
      state ? btn.setAttribute('data-state', state) : btn.removeAttribute('data-state')
    );
  }

  function lockChoices(){ 
    interactionLock = true;
    setOptionsState('locked');
  }

  function unlockChoices(){
    interactionLock = false;
    setOptionsState('');
  }

  // Stop any playing sound options
  function stopAllOptionAudio(){
    document.querySelectorAll('.option audio').forEach(a => {
      try { if (!a.paused) a.pause(); a.currentTime = 0; } catch {}
    });
  }

  // Update progress bar width
  function updateProgress(){
    const pct = Math.min(100, (mainAudio.currentTime / (mainAudio.duration || 80)) * 100);
    bar.style.width = (isFinite(pct) ? pct : 0) + '%';
  }

  // Lock all guessing buttons initially
  lockChoices();

  /* =========================
     BUTTON CONTROLS
  ========================== */

  // ▶ Play button
  playBtn.addEventListener('click', () => {
    // Prevent starting if already in checkpoint mode
    if (activeCheckpoint !== -1) return;

    // If finished, reset before replay
    if (mainAudio.ended || stopIdx >= stops.length) {
      stopIdx = 0;
      activeCheckpoint = -1;
      reListening = false;
      mainAudio.currentTime = 0;
      statusEl.textContent = 'Replaying from start.';
    }
    mainAudio.play();
  });

  // 🔁 Re-listen button (replays previous segment)
  if (relistenBtn) {
    relistenBtn.addEventListener('click', () => {
      if (activeCheckpoint === -1) return; // only allowed during checkpoints

      const segmentStart = (activeCheckpoint === 0) ? 0 : stops[activeCheckpoint - 1];
      reListening = true;
      lockChoices();
      playBtn.disabled = true;
      statusEl.textContent = `Replaying the segment before checkpoint ${activeCheckpoint+1}...`;
      mainAudio.currentTime = segmentStart;
      mainAudio.play();
    });
  }

  // --- Audio playback events ---

  // When narration starts
  mainAudio.addEventListener('play', () => {
    playBtn.disabled = true;
    lockChoices();
    if (!reListening) statusEl.textContent = 'Playing... listen carefully.';
    stopAllOptionAudio(); // stop small sounds
  });

  // When paused before first checkpoint — re-enable Play
  mainAudio.addEventListener('pause', () => {
    if (activeCheckpoint === -1) playBtn.disabled = false;
  });

  // Continuous updates while playing
  mainAudio.addEventListener('timeupdate', () => {
    updateProgress();

    // Stop at next checkpoint if reached
    if (!reListening && stopIdx < stops.length && mainAudio.currentTime >= stops[stopIdx] - 0.05) {
      mainAudio.pause();
      mainAudio.currentTime = stops[stopIdx];
      activeCheckpoint = stopIdx;
      stopIdx++;

      playBtn.disabled = true;
      if (relistenBtn) relistenBtn.disabled = false;

      unlockChoices(); // user can now pick
      statusEl.innerHTML = `Checkpoint ${activeCheckpoint+1}/6. Pick the right sound to continue.`;
      return;
    }

    // If replaying segment, stop again at checkpoint end
    if (reListening && activeCheckpoint !== -1) {
      const target = stops[activeCheckpoint];
      if (mainAudio.currentTime >= target - 0.05) {
        mainAudio.pause();
        mainAudio.currentTime = target;
        reListening = false;

        playBtn.disabled = true;
        if (relistenBtn) relistenBtn.disabled = false;
        unlockChoices();
        statusEl.innerHTML = `Checkpoint ${activeCheckpoint+1}/6. Pick the right sound to continue.`;
      }
    }
  });

  // When narration ends completely
  mainAudio.addEventListener('ended', () => {
    activeCheckpoint = -1;
    reListening = false;
    if (relistenBtn) relistenBtn.disabled = true;
    statusEl.innerHTML = 'Narration finished. Great job! You nailed the choices.';
    setOptionsState('locked');
    playBtn.textContent = 'Replay';
    playBtn.disabled = false;
  });

  /* =========================
     GUESSING OPTION LOGIC
  ========================== */
  options.forEach(btn => {
    btn.addEventListener('click', () => {
      if (interactionLock) return; // ignore clicks when locked

      const userPick = btn.getAttribute('data-answer');
      const neededAnswer = (activeCheckpoint >= 0)
        ? correctAnswers[activeCheckpoint]
        : correctAnswers[Math.max(0, stopIdx - 1)];

      // ✅ Correct choice
      if (userPick === neededAnswer) {
        btn.setAttribute('data-state','correct');
        statusEl.textContent = 'Correct! Resuming…';

        activeCheckpoint = -1;
        if (relistenBtn) relistenBtn.disabled = true;
        lockChoices();

        // Resume story after short pause
        setTimeout(() => {
          playBtn.disabled = false;
          mainAudio.play();
        }, 400);

      // ❌ Wrong choice
      } else {
        btn.setAttribute('data-state','wrong');
        statusEl.textContent = 'Not quite. try another.';
      }
    });
  });

})(); // End of main IIFE
