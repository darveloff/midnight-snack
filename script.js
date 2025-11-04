// Midnight Snack â€" Single-file routing + Story logic (with Re-listen & no-skip)

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

  // --- PHASE 1: Listening Phase ---
  const listeningPhase = document.getElementById('listeningPhase');
  const guessingPhase = document.getElementById('guessingPhase');
  const nextBtn = document.getElementById('nextBtn');
  const listeningStatus = document.getElementById('listeningStatus');
  const listenOptions = Array.from(document.querySelectorAll('.option-listen'));
  
  const heardSounds = new Set();
  
  function stopAllListeningAudio(){
    document.querySelectorAll('.option-listen audio').forEach(a => {
      try { if (!a.paused) a.pause(); a.currentTime = 0; } catch {}
    });
  }
  
  listenOptions.forEach(btn => {
    const clip = btn.querySelector('audio');
    
    clip.addEventListener('ended', () => {
      const answer = btn.getAttribute('data-answer');
      if (!heardSounds.has(answer)) {
        heardSounds.add(answer);
        btn.setAttribute('data-state', 'heard');
        
        const remaining = listenOptions.length - heardSounds.size;
        if (remaining > 0) {
          listeningStatus.textContent = `Great! ${heardSounds.size}/6 heard. Listen to ${remaining} more to continue.`;
        } else {
          listeningStatus.textContent = "Perfect! You've heard all sounds. Click Next to start the game.";
          nextBtn.disabled = false;
        }
      }
    });
    
    btn.addEventListener('click', () => {
      stopAllListeningAudio();
      clip.currentTime = 0;
      clip.play().catch(()=>{});
    });
  });
  
  nextBtn.addEventListener('click', () => {
    listeningPhase.style.display = 'none';
    guessingPhase.style.display = 'block';
  });

  // --- PHASE 2: Story logic ---
  const mainAudio  = document.getElementById('mainAudio');
  const playBtn    = document.getElementById('playBtn');
  const relistenBtn= document.getElementById('relistenBtn');
  const options    = Array.from(document.querySelectorAll('.option'));
  const statusEl   = document.getElementById('status');
  const bar        = document.getElementById('progressBar');

  if (!mainAudio) return; // defensive

  // Checkpoints in seconds
  const stops = [18, 27, 35, 42, 52, 58];
  let stopIdx = 0;
  let activeCheckpoint = -1;
  let reListening = false;

  // Correct answer per checkpoint
  const correctAnswers = ['Ice-Cream','Carrots','Chips','Cookies','Sprite','Chocolate-Bar'];

  let interactionLock = true;

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

  // Initial state
  lockChoices();

  // --- Controls ---
  playBtn.addEventListener('click', () => {
    if (activeCheckpoint !== -1) return;

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
      if (activeCheckpoint === -1) return;
      const segmentStart = (activeCheckpoint === 0) ? 0 : stops[activeCheckpoint - 1];
      reListening = true;
      lockChoices();
      playBtn.disabled = true;
      statusEl.textContent = `Replaying the segment before checkpoint ${activeCheckpoint+1}...`;
      mainAudio.currentTime = segmentStart;
      mainAudio.play();
    });
  }

  mainAudio.addEventListener('play', () => {
    playBtn.disabled = true;
    lockChoices();
    if (!reListening) statusEl.textContent = 'Playing... listen carefully.';
    stopAllOptionAudio();
  });

  mainAudio.addEventListener('pause', () => {
    if (activeCheckpoint === -1) playBtn.disabled = false;
  });

  mainAudio.addEventListener('timeupdate', () => {
    updateProgress();

    if (!reListening && stopIdx < stops.length && mainAudio.currentTime >= stops[stopIdx] - 0.05) {
      mainAudio.pause();
      mainAudio.currentTime = stops[stopIdx];
      activeCheckpoint = stopIdx;
      stopIdx++;

      playBtn.disabled = true;
      if (relistenBtn) relistenBtn.disabled = false;

      unlockChoices();
      statusEl.innerHTML = `Checkpoint ${activeCheckpoint+1}/6. Pick the right sound to continue.`;
      return;
    }

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
    btn.addEventListener('click', () => {
      if (interactionLock) return;

      const userPick = btn.getAttribute('data-answer');
      const neededAnswer = (activeCheckpoint >= 0)
        ? correctAnswers[activeCheckpoint]
        : correctAnswers[Math.max(0, stopIdx-1)];

      if (userPick === neededAnswer) {
        btn.setAttribute('data-state','correct');
        statusEl.textContent = 'Correct! Resuming…';

        activeCheckpoint = -1;
        if (relistenBtn) relistenBtn.disabled = true;
        lockChoices();

        setTimeout(() => {
          playBtn.disabled = false;
          mainAudio.play();
        }, 400);
      } else {
        btn.setAttribute('data-state','wrong');
        statusEl.textContent = 'Not quite. try another.';
      }
    });
  });
})();