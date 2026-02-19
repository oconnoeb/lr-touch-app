(() => {
  // ---- Config ----
  const IMG_PATH = "images/";
  const FEEDBACK_MS = 700; // how long to show ⭐ / ✖
  const RETURN_AFTER_ERROR_MS = 500; // brief pause before returning to trial

  // ---- State ----
  let order = [];
  let i = 0;
  let correctCount = 0;
  let totalResponses = 0;

  // For correction trials: after an error, we return to same trial index.
  let currentTrial = null;
  let currentLayout = null; // { left, right, correctSide }

  // Session log
  const log = []; // {timestamp, trialIndex, target, left, right, response, correct, rtMs}

  // ---- Elements ----
  const stage = document.getElementById("stage");
  const trialScreen = document.getElementById("trialScreen");
  const correctScreen = document.getElementById("correctScreen");
  const incorrectScreen = document.getElementById("incorrectScreen");

  const sdText = document.getElementById("sdText");

  const leftBtn = document.getElementById("leftChoice");
  const rightBtn = document.getElementById("rightChoice");

  const leftImg = document.getElementById("leftImg");
  const rightImg = document.getElementById("rightImg");

  const leftLabel = document.getElementById("leftLabel");
  const rightLabel = document.getElementById("rightLabel");

  const trialCounter = document.getElementById("trialCounter");
  const accuracy = document.getElementById("accuracy");

  const restartBtn = document.getElementById("restartBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const speakToggle = document.getElementById("speakToggle");

  // ---- Helpers ----
  function nowIso(){ return new Date().toISOString(); }

  function shuffle(arr){
    const a = arr.slice();
    for (let j = a.length - 1; j > 0; j--){
      const k = Math.floor(Math.random() * (j + 1));
      [a[j], a[k]] = [a[k], a[j]];
    }
    return a;
  }

  function speak(text){
    try{
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    }catch(_){}
  }

  function show(el){
    el.classList.remove("hidden");
  }
  function hide(el){
    el.classList.add("hidden");
  }

  function setAccuracy(){
    if (totalResponses === 0){
      accuracy.textContent = "Accuracy: —";
      return;
    }
    const pct = Math.round((correctCount / totalResponses) * 100);
    accuracy.textContent = `Accuracy: ${pct}% (${correctCount}/${totalResponses})`;
  }

  function normalizeLabel(s){
    return (s || "").toUpperCase();
  }

  function computeLayout(trial){
    // Randomize left/right position each presentation.
    const swap = Math.random() < 0.5;
    const left = swap ? trial.target : trial.distractor;
    const right = swap ? trial.distractor : trial.target;
    const correctSide = swap ? "left" : "right";
    return { left, right, correctSide };
  }

  function renderTrial(){
    currentTrial = order[i];
    currentLayout = computeLayout(currentTrial);

    // UI
    trialCounter.textContent = `Trial ${i + 1} of ${order.length}`;
    setAccuracy();

    const targetWord = currentTrial.target.toUpperCase();
    sdText.textContent = `Touch the ${targetWord}`;

    leftImg.src = IMG_PATH + currentLayout.left + ".png";
    rightImg.src = IMG_PATH + currentLayout.right + ".png";

    leftImg.alt = currentLayout.left;
    rightImg.alt = currentLayout.right;

    leftLabel.textContent = normalizeLabel(currentLayout.left);
    rightLabel.textContent = normalizeLabel(currentLayout.right);

    hide(correctScreen);
    hide(incorrectScreen);
    show(trialScreen);

    // Optionally speak SD
    if (speakToggle.checked){
      speak(`Touch the ${currentTrial.target}`);
    }

    // Start RT timer
    trialScreen.dataset.startTs = String(performance.now());
  }

  function record(response, correct){
    const startTs = Number(trialScreen.dataset.startTs || performance.now());
    const rtMs = Math.max(0, Math.round(performance.now() - startTs));
    log.push({
      timestamp: nowIso(),
      trialIndex: i + 1,
      target: currentTrial.target,
      left: currentLayout.left,
      right: currentLayout.right,
      response,
      correct,
      rtMs
    });
  }

  function toCsv(rows){
    const header = ["timestamp","trialIndex","target","left","right","response","correct","rtMs"];
    const lines = [header.join(",")];
    for (const r of rows){
      const line = header.map(k => {
        const v = r[k];
        const s = (v === null || v === undefined) ? "" : String(v);
        const escaped = s.includes(",") || s.includes('"') || s.includes("\n")
          ? '"' + s.replaceAll('"','""') + '"'
          : s;
        return escaped;
      }).join(",");
      lines.push(line);
    }
    return lines.join("\n");
  }

  function downloadCsv(){
    const csv = toCsv(log);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lr_touch_session_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleCorrect(){
    totalResponses += 1;
    correctCount += 1;
    setAccuracy();

    hide(trialScreen);
    hide(incorrectScreen);
    show(correctScreen);

    setTimeout(() => {
      i += 1;
      if (i >= order.length){
        // End screen: reuse correct screen to show session complete
        document.querySelector("#correctScreen .feedbackIcon").textContent = "✅";
        document.querySelector("#correctScreen .feedbackText").textContent = "Session complete!";
        return;
      }
      // restore icon/text in case it changed
      document.querySelector("#correctScreen .feedbackIcon").textContent = "⭐";
      document.querySelector("#correctScreen .feedbackText").textContent = "Great work!";
      renderTrial();
    }, FEEDBACK_MS);
  }

  function handleIncorrect(){
    totalResponses += 1;
    setAccuracy();

    hide(trialScreen);
    hide(correctScreen);
    show(incorrectScreen);

    setTimeout(() => {
      // return to SAME trial so therapist can prompt
      hide(incorrectScreen);
      renderTrial();
    }, FEEDBACK_MS + RETURN_AFTER_ERROR_MS);
  }

  // ---- Event wiring ----
  function onChoice(side){
    const correctSide = currentLayout.correctSide;
    const isCorrect = side === correctSide;
    record(side, isCorrect);
    if (isCorrect) handleCorrect();
    else handleIncorrect();
  }

  leftBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onChoice("left");
  });
  rightBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onChoice("right");
  });

  // Click anywhere else on the stage counts as incorrect (your requirement).
  // But do NOT count clicks when feedback screen is showing.
  stage.addEventListener("click", (e) => {
    const trialVisible = !trialScreen.classList.contains("hidden");
    if (!trialVisible) return;
    // If click wasn't on either button (we stopPropagation there), it's an error.
    record("outside", false);
    handleIncorrect();
  });

  restartBtn.addEventListener("click", () => start(true));
  downloadBtn.addEventListener("click", downloadCsv);

  function start(resetLog){
    order = shuffle(Array.isArray(window.TRIALS) ? window.TRIALS : []);
    i = 0;
    correctCount = 0;
    totalResponses = 0;
    if (resetLog) log.length = 0;
    // Reset end-screen icon/text
    document.querySelector("#correctScreen .feedbackIcon").textContent = "⭐";
    document.querySelector("#correctScreen .feedbackText").textContent = "Great work!";
    renderTrial();
  }

  // Kick off
  start(true);
})();
