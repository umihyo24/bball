(() => {
  "use strict";

  const CONFIG = Object.freeze({
    CANVAS_WIDTH: 720,
    CANVAS_HEIGHT: 960,
    TARGET_SCORE: 500,
    MAX_OUTS: 3,
    BALLS_PER_ROUND: 10,
    PITCH_SPEED: 8,
    PITCH_START: { x: 360, y: 245 },
    HOME_PLATE: { x: 360, y: 835 },
    SWING_WINDOWS: { PERFECT: 18, GOOD: 52, MISS: 185 },
    HIT_SPEEDS: { PERFECT: 21, GOOD: 18, EARLY: 16, LATE: 16 },
    HIT_ANGLE_RANGES: {
      PERFECT: { min: -94, max: -86 },
      GOOD: { min: -108, max: -72 },
      EARLY: { min: -132, max: -103 },
      LATE: { min: -77, max: -48 },
    },
    WALL_BOUNDS: { left: 58, right: 662, top: 92, bottom: 875 },
    RESULT_POCKETS: [
      { id: "out-left", result: "OUT", x: 105, y: 792, radius: 36, label: "OUT", color: "#111827" },
      { id: "single", result: "SINGLE", x: 230, y: 810, radius: 36, label: "1B", color: "#2563eb" },
      { id: "double", result: "DOUBLE", x: 360, y: 825, radius: 36, label: "2B", color: "#7c3aed" },
      { id: "triple", result: "TRIPLE", x: 490, y: 810, radius: 36, label: "3B", color: "#dc2626" },
      { id: "hr", result: "HR", x: 615, y: 792, radius: 36, label: "HR", color: "#f59e0b" },
    ],
    SCORING_VALUES: { OUT: 0, SINGLE: 10, DOUBLE: 25, TRIPLE: 50, HR: 100 },
    RUN_SCORE: 75,
    DEFAULT_MULTIPLIER: 1,
    SLUGGER_HR_MULTIPLIER: 3,
    HIT_TIMEOUT_FRAMES: 540,
    NEXT_PITCH_DELAY_FRAMES: 75,
    MISS_RESOLVE_DELAY_FRAMES: 24,
    BALL_RADIUS: 9,
    HIT_GRAVITY: 0.2,
    HIT_FRICTION: 0.995,
    HIT_MAX_SPEED: 28,
    WALL_BOUNCE: 0.82,
    PEG_RADIUS: 13,
    PEG_BOUNCE: 0.92,
    PEGS: [
      { x: 130, y: 250 }, { x: 222, y: 250 }, { x: 314, y: 250 }, { x: 406, y: 250 }, { x: 498, y: 250 }, { x: 590, y: 250 },
      { x: 176, y: 380 }, { x: 268, y: 380 }, { x: 360, y: 380 }, { x: 452, y: 380 }, { x: 544, y: 380 },
      { x: 130, y: 510 }, { x: 222, y: 510 }, { x: 314, y: 510 }, { x: 406, y: 510 }, { x: 498, y: 510 }, { x: 590, y: 510 },
      { x: 176, y: 640 }, { x: 268, y: 640 }, { x: 360, y: 640 }, { x: 452, y: 640 }, { x: 544, y: 640 },
    ],
    UI: {
      padding: 24, headerHeight: 172, titleY: 42, scoreY: 78, statusY: 110, messageY: 142,
      cardX: 24, cardY: 184, cardWidth: 132, cardHeight: 176, footerY: 918, instructionY: 888,
      diamondX: 566, diamondY: 112, diamondStep: 26, baseSize: 20, orderX: 570, orderY: 210, lineHeight: 25,
      moundRadius: 22, baseMarkerSize: 18, batterRadius: 13, pitcherRadius: 14, plateSize: 14, fenceLineWidth: 5,
    },
    FIELD_VISUALS: {
      outfieldArcRadius: 670, outfieldArcStart: 1.15, outfieldArcEnd: 1.85, fullCircleRadians: 2,
      firstBase: { x: 500, y: 705 }, secondBase: { x: 360, y: 575 }, thirdBase: { x: 220, y: 705 },
      batterBoxLeftXOffset: -42, batterBoxRightXOffset: 14, batterBoxYOffset: -18, batterBoxWidth: 28, batterBoxHeight: 58,
      pitcherMarkerYOffset: -45, batterMarkerXOffset: 62, batterMarkerYOffset: -5, pocketLabelYOffset: 6,
      cardTitleYOffset: 82, cardEffectYOffset: 114,
    },
    COLORS: {
      grass: "#1f6f3f", outfield: "#185f36", dirt: "#b77937", chalk: "#f8fafc", gold: "#fbbf24",
      red: "#ef4444", blue: "#38bdf8", panel: "rgba(15, 23, 42, 0.86)", card: "#312e81",
      text: "#f8fafc", muted: "#cbd5e1", shadow: "rgba(0, 0, 0, 0.28)", bat: "#f97316",
    },
    ASSETS: { cards: "/assets/cards/", monsters: "/assets/monsters/", extension: ".png" },
  });

  const CARD_DEFINITIONS = Object.freeze({
    slugger: {
      id: "slugger",
      name: "Slugger",
      effectText: `HR hit score x${CONFIG.SLUGGER_HR_MULTIPLIER}`,
      asset: "cards.batter_power_global_multiply",
      apply(resultContext) {
        if (resultContext?.finalResult === "HR") resultContext.multiplier *= CONFIG.SLUGGER_HR_MULTIPLIER;
      },
    },
  });

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas?.getContext?.("2d") || null;
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");

  const gameState = {
    phase: "start",
    playState: "ready",
    score: 0,
    targetScore: CONFIG.TARGET_SCORE,
    outs: 0,
    ballsRemaining: CONFIG.BALLS_PER_ROUND,
    runners: { first: false, second: false, third: false },
    pitchBall: null,
    hitBall: null,
    swingState: { hasSwung: false, quality: "", timingDelta: 0 },
    resultMessage: "Press Space to start.",
    cards: [],
    imageCache: new Map(),
    timers: { nextPitch: 0, resolve: 0 },
  };

  if (canvas) { canvas.width = CONFIG.CANVAS_WIDTH; canvas.height = CONFIG.CANVAS_HEIGHT; }

  function createImage(key) {
    if (gameState.imageCache?.has(key)) return gameState.imageCache.get(key);
    const [category, ...nameParts] = String(key || "").split(".");
    const basePath = CONFIG.ASSETS[category];
    if (!basePath || nameParts.length === 0) return null;
    const image = new Image();
    image.src = `${basePath}${nameParts.join("_")}${CONFIG.ASSETS.extension}`;
    gameState.imageCache?.set(key, image);
    return image;
  }

  function safeDrawImage(context, image, x, y, width, height, fallback) {
    if (context && image?.complete && image.naturalWidth > 0) context.drawImage(image, x, y, width, height);
    else if (typeof fallback === "function") fallback();
  }

  function cloneRunners(runners) { return { first: Boolean(runners?.first), second: Boolean(runners?.second), third: Boolean(runners?.third) }; }
  function randomBetween(range) { return (range?.min || 0) + Math.random() * ((range?.max || 0) - (range?.min || 0)); }
  function degreesToRadians(degrees) { return degrees * Math.PI / 180; }

  function resetToStart() {
    gameState.phase = "start";
    gameState.playState = "ready";
    gameState.score = 0;
    gameState.targetScore = CONFIG.TARGET_SCORE;
    gameState.outs = 0;
    gameState.ballsRemaining = CONFIG.BALLS_PER_ROUND;
    gameState.runners = { first: false, second: false, third: false };
    gameState.pitchBall = null;
    gameState.hitBall = null;
    gameState.swingState = { hasSwung: false, quality: "", timingDelta: 0 };
    gameState.resultMessage = "Press Space to start.";
    gameState.cards = [{ ...CARD_DEFINITIONS.slugger }];
    gameState.timers = { nextPitch: 0, resolve: 0 };
  }

  function startGame() {
    gameState.phase = "playing";
    gameState.score = 0;
    gameState.outs = 0;
    gameState.ballsRemaining = CONFIG.BALLS_PER_ROUND;
    gameState.runners = { first: false, second: false, third: false };
    gameState.cards = [{ ...CARD_DEFINITIONS.slugger }];
    gameState.resultMessage = "Pitch incoming. Press Space to swing.";
    beginPitch();
  }

  function beginPitch() {
    if (gameState.phase !== "playing" || gameState.ballsRemaining <= 0 || gameState.outs >= CONFIG.MAX_OUTS) return;
    gameState.playState = "pitching";
    gameState.pitchBall = { x: CONFIG.PITCH_START.x, y: CONFIG.PITCH_START.y, radius: CONFIG.BALL_RADIUS, vy: CONFIG.PITCH_SPEED };
    gameState.hitBall = null;
    gameState.swingState = { hasSwung: false, quality: "", timingDelta: 0 };
    gameState.timers.nextPitch = 0;
    gameState.timers.resolve = 0;
  }

  function getSwingQuality(delta) {
    const distance = Math.abs(delta);
    if (distance <= CONFIG.SWING_WINDOWS.PERFECT) return "PERFECT";
    if (distance <= CONFIG.SWING_WINDOWS.GOOD) return "GOOD";
    if (distance > CONFIG.SWING_WINDOWS.MISS) return "MISS";
    return delta > 0 ? "EARLY" : "LATE";
  }

  function swing() {
    const pitchBall = gameState.pitchBall;
    if (gameState.phase !== "playing" || gameState.playState !== "pitching" || !pitchBall || gameState.swingState?.hasSwung) return;
    const timingDelta = CONFIG.HOME_PLATE.y - pitchBall.y;
    const quality = getSwingQuality(timingDelta);
    gameState.swingState = { hasSwung: true, quality, timingDelta };
    gameState.ballsRemaining = Math.max(0, gameState.ballsRemaining - 1);
    gameState.pitchBall = null;
    if (quality === "MISS") {
      gameState.playState = "resolving";
      gameState.timers.resolve = CONFIG.MISS_RESOLVE_DELAY_FRAMES;
      gameState.resultMessage = "MISS: out.";
      return;
    }
    const speed = CONFIG.HIT_SPEEDS[quality] || CONFIG.HIT_SPEEDS.GOOD;
    const angle = degreesToRadians(randomBetween(CONFIG.HIT_ANGLE_RANGES[quality] || CONFIG.HIT_ANGLE_RANGES.GOOD));
    gameState.hitBall = { x: CONFIG.HOME_PLATE.x, y: CONFIG.HOME_PLATE.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: CONFIG.BALL_RADIUS, framesAlive: 0 };
    gameState.playState = "hit";
    gameState.resultMessage = `${quality}: ball in play.`;
  }

  function calculateResultState(result, runners, outs) {
    const nextRunners = cloneRunners(runners);
    let runs = 0;
    let nextOuts = outs || 0;
    if (result === "OUT") return { runs, runnersAfter: nextRunners, outsAfter: nextOuts + 1 };
    const bases = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3, HR: 4 }[result] || 0;
    const occupied = [nextRunners.first, nextRunners.second, nextRunners.third];
    const next = [false, false, false];
    occupied.forEach((hasRunner, index) => {
      if (!hasRunner) return;
      const destination = index + bases;
      if (destination >= 3) runs += 1;
      else next[destination] = true;
    });
    if (bases >= 4) runs += 1;
    else if (bases > 0) next[bases - 1] = true;
    return { runs, runnersAfter: { first: next[0], second: next[1], third: next[2] }, outsAfter: nextOuts };
  }

  function createResultContext(originalResult) {
    const finalResult = CONFIG.SCORING_VALUES[originalResult] === undefined ? "OUT" : originalResult;
    const runnersBefore = cloneRunners(gameState.runners);
    const outsBefore = gameState.outs || 0;
    const resultState = calculateResultState(finalResult, runnersBefore, outsBefore);
    return { originalResult: finalResult, finalResult, hitScore: CONFIG.SCORING_VALUES[finalResult], runScore: resultState.runs * CONFIG.RUN_SCORE, multiplier: CONFIG.DEFAULT_MULTIPLIER, runsScored: resultState.runs, runnersBefore, runnersAfter: resultState.runnersAfter, outsBefore, outsAfter: resultState.outsAfter, swingQuality: gameState.swingState?.quality || "" };
  }

  function applyCardEffects(resultContext) {
    (gameState.cards || []).forEach((card) => { if (typeof card?.apply === "function") card.apply(resultContext); });
    return resultContext;
  }

  function finalizeResultContext(resultContext) {
    const state = calculateResultState(resultContext.finalResult, resultContext.runnersBefore, resultContext.outsBefore);
    resultContext.runnersAfter = state.runnersAfter;
    resultContext.outsAfter = state.outsAfter;
    resultContext.runsScored = state.runs;
    resultContext.hitScore = CONFIG.SCORING_VALUES[resultContext.finalResult] ?? CONFIG.SCORING_VALUES.OUT;
    resultContext.runScore = state.runs * CONFIG.RUN_SCORE;
    return resultContext;
  }

  function resolveResult(result) {
    if (gameState.phase !== "playing") return;
    const context = finalizeResultContext(applyCardEffects(createResultContext(result)));
    const gained = (context.hitScore + context.runScore) * context.multiplier;
    gameState.score += gained;
    gameState.runners = cloneRunners(context.runnersAfter);
    gameState.outs = context.outsAfter;
    gameState.pitchBall = null;
    gameState.hitBall = null;
    gameState.resultMessage = `${context.swingQuality || "NO SWING"} ${context.finalResult}: +${gained} (${context.runsScored} run${context.runsScored === 1 ? "" : "s"}, x${context.multiplier})`;
    if (gameState.outs >= CONFIG.MAX_OUTS || gameState.ballsRemaining <= 0) {
      gameState.phase = "gameover";
      gameState.playState = "ready";
      return;
    }
    gameState.playState = "resolving";
    gameState.timers.nextPitch = CONFIG.NEXT_PITCH_DELAY_FRAMES;
  }

  function updatePitching() {
    const pitchBall = gameState.pitchBall;
    if (!pitchBall) return;
    pitchBall.y += pitchBall.vy || CONFIG.PITCH_SPEED;
    if (pitchBall.y >= CONFIG.HOME_PLATE.y + CONFIG.SWING_WINDOWS.GOOD) {
      gameState.pitchBall = null;
      gameState.swingState = { hasSwung: true, quality: "LATE", timingDelta: CONFIG.HOME_PLATE.y - pitchBall.y };
      gameState.ballsRemaining = Math.max(0, gameState.ballsRemaining - 1);
      resolveResult("OUT");
    }
  }

  function updateHitBall() {
    const ball = gameState.hitBall;
    if (!ball) return;
    ball.framesAlive = (ball.framesAlive || 0) + 1;
    ball.vy += CONFIG.HIT_GRAVITY;
    ball.vx *= CONFIG.HIT_FRICTION;
    ball.vy *= CONFIG.HIT_FRICTION;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > CONFIG.HIT_MAX_SPEED) { ball.vx = ball.vx / speed * CONFIG.HIT_MAX_SPEED; ball.vy = ball.vy / speed * CONFIG.HIT_MAX_SPEED; }
    ball.x += ball.vx;
    ball.y += ball.vy;
    const walls = CONFIG.WALL_BOUNDS;
    if (ball.x - ball.radius < walls.left || ball.x + ball.radius > walls.right) { ball.x = Math.max(walls.left + ball.radius, Math.min(walls.right - ball.radius, ball.x)); ball.vx *= -CONFIG.WALL_BOUNCE; }
    if (ball.y - ball.radius < walls.top) { ball.y = walls.top + ball.radius; ball.vy *= -CONFIG.WALL_BOUNCE; }
    (CONFIG.PEGS || []).forEach((peg) => {
      const dx = ball.x - peg.x, dy = ball.y - peg.y, distance = Math.hypot(dx, dy), minimum = ball.radius + CONFIG.PEG_RADIUS;
      if (distance > 0 && distance < minimum) {
        const nx = dx / distance, ny = dy / distance, dot = ball.vx * nx + ball.vy * ny;
        ball.x = peg.x + nx * minimum; ball.y = peg.y + ny * minimum;
        ball.vx = (ball.vx - 2 * dot * nx) * CONFIG.PEG_BOUNCE; ball.vy = (ball.vy - 2 * dot * ny) * CONFIG.PEG_BOUNCE;
      }
    });
    const pocket = (CONFIG.RESULT_POCKETS || []).find((target) => Math.hypot(ball.x - target.x, ball.y - target.y) <= target.radius);
    if (pocket) resolveResult(pocket.result);
    else if (ball.y > CONFIG.WALL_BOUNDS.bottom || ball.framesAlive >= CONFIG.HIT_TIMEOUT_FRAMES) resolveResult("OUT");
  }

  function updateResolving() {
    if ((gameState.timers.resolve || 0) > 0) {
      gameState.timers.resolve -= 1;
      if (gameState.timers.resolve <= 0) resolveResult("OUT");
      return;
    }
    if ((gameState.timers.nextPitch || 0) > 0) {
      gameState.timers.nextPitch -= 1;
      if (gameState.timers.nextPitch <= 0) beginPitch();
    }
  }

  function update() {
    if (gameState.phase !== "playing") return;
    if (gameState.playState === "pitching") updatePitching();
    else if (gameState.playState === "hit") updateHitBall();
    else if (gameState.playState === "resolving") updateResolving();
  }

  function drawText(text, x, y, size, color = CONFIG.COLORS.text, align = "left") { if (!ctx) return; ctx.fillStyle = color; ctx.font = `800 ${size}px system-ui`; ctx.textAlign = align; ctx.fillText(String(text || ""), x, y); }
  function drawCircle(x, y, radius, color, stroke = CONFIG.COLORS.chalk) { ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }

  function renderField() {
    ctx.fillStyle = CONFIG.COLORS.grass; ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    ctx.fillStyle = CONFIG.COLORS.outfield; ctx.beginPath(); ctx.arc(CONFIG.HOME_PLATE.x, CONFIG.HOME_PLATE.y, CONFIG.FIELD_VISUALS.outfieldArcRadius, Math.PI * CONFIG.FIELD_VISUALS.outfieldArcStart, Math.PI * CONFIG.FIELD_VISUALS.outfieldArcEnd); ctx.lineTo(CONFIG.HOME_PLATE.x, CONFIG.HOME_PLATE.y); ctx.fill();
    ctx.fillStyle = CONFIG.COLORS.dirt; ctx.beginPath(); ctx.moveTo(CONFIG.HOME_PLATE.x, CONFIG.HOME_PLATE.y); ctx.lineTo(CONFIG.FIELD_VISUALS.firstBase.x, CONFIG.FIELD_VISUALS.firstBase.y); ctx.lineTo(CONFIG.FIELD_VISUALS.secondBase.x, CONFIG.FIELD_VISUALS.secondBase.y); ctx.lineTo(CONFIG.FIELD_VISUALS.thirdBase.x, CONFIG.FIELD_VISUALS.thirdBase.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = CONFIG.COLORS.chalk; ctx.lineWidth = CONFIG.UI.fenceLineWidth; ctx.strokeRect(CONFIG.WALL_BOUNDS.left, CONFIG.WALL_BOUNDS.top, CONFIG.WALL_BOUNDS.right - CONFIG.WALL_BOUNDS.left, CONFIG.WALL_BOUNDS.bottom - CONFIG.WALL_BOUNDS.top);
    ctx.beginPath(); ctx.moveTo(CONFIG.HOME_PLATE.x, CONFIG.HOME_PLATE.y); ctx.lineTo(CONFIG.WALL_BOUNDS.left, CONFIG.WALL_BOUNDS.top); ctx.moveTo(CONFIG.HOME_PLATE.x, CONFIG.HOME_PLATE.y); ctx.lineTo(CONFIG.WALL_BOUNDS.right, CONFIG.WALL_BOUNDS.top); ctx.stroke();
    drawCircle(CONFIG.PITCH_START.x, CONFIG.PITCH_START.y, CONFIG.UI.moundRadius, CONFIG.COLORS.dirt, CONFIG.COLORS.chalk);
    [CONFIG.FIELD_VISUALS.firstBase, CONFIG.FIELD_VISUALS.secondBase, CONFIG.FIELD_VISUALS.thirdBase, CONFIG.HOME_PLATE].forEach((base) => { ctx.save(); ctx.translate(base.x, base.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = CONFIG.COLORS.chalk; ctx.fillRect(-CONFIG.UI.baseMarkerSize / 2, -CONFIG.UI.baseMarkerSize / 2, CONFIG.UI.baseMarkerSize, CONFIG.UI.baseMarkerSize); ctx.restore(); });
    ctx.strokeStyle = CONFIG.COLORS.chalk; ctx.strokeRect(CONFIG.HOME_PLATE.x + CONFIG.FIELD_VISUALS.batterBoxLeftXOffset, CONFIG.HOME_PLATE.y + CONFIG.FIELD_VISUALS.batterBoxYOffset, CONFIG.FIELD_VISUALS.batterBoxWidth, CONFIG.FIELD_VISUALS.batterBoxHeight); ctx.strokeRect(CONFIG.HOME_PLATE.x + CONFIG.FIELD_VISUALS.batterBoxRightXOffset, CONFIG.HOME_PLATE.y + CONFIG.FIELD_VISUALS.batterBoxYOffset, CONFIG.FIELD_VISUALS.batterBoxWidth, CONFIG.FIELD_VISUALS.batterBoxHeight);
    (CONFIG.PEGS || []).forEach((peg) => drawCircle(peg.x, peg.y, CONFIG.PEG_RADIUS, CONFIG.COLORS.gold, CONFIG.COLORS.shadow));
    (CONFIG.RESULT_POCKETS || []).forEach((pocket) => { drawCircle(pocket.x, pocket.y, pocket.radius, pocket.color, CONFIG.COLORS.chalk); drawText(pocket.label, pocket.x, pocket.y + CONFIG.FIELD_VISUALS.pocketLabelYOffset, 16, CONFIG.COLORS.text, "center"); });
    drawCircle(CONFIG.PITCH_START.x, CONFIG.PITCH_START.y + CONFIG.FIELD_VISUALS.pitcherMarkerYOffset, CONFIG.UI.pitcherRadius, CONFIG.COLORS.blue, CONFIG.COLORS.chalk);
    drawCircle(CONFIG.HOME_PLATE.x + CONFIG.FIELD_VISUALS.batterMarkerXOffset, CONFIG.HOME_PLATE.y + CONFIG.FIELD_VISUALS.batterMarkerYOffset, CONFIG.UI.batterRadius, CONFIG.COLORS.bat, CONFIG.COLORS.chalk);
  }

  function renderHud() {
    ctx.fillStyle = CONFIG.COLORS.panel; ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.UI.headerHeight);
    drawText("BaseBallatro", CONFIG.UI.padding, CONFIG.UI.titleY, 34, CONFIG.COLORS.gold);
    drawText(`Score ${gameState.score} / ${gameState.targetScore}`, CONFIG.UI.padding, CONFIG.UI.scoreY, 23);
    drawText(`Outs ${gameState.outs}/${CONFIG.MAX_OUTS}   Balls ${gameState.ballsRemaining}   State ${gameState.playState}`, CONFIG.UI.padding, CONFIG.UI.statusY, 19, CONFIG.COLORS.muted);
    drawText(`Swing ${gameState.swingState?.quality || "-"}   ${gameState.resultMessage || ""}`, CONFIG.UI.padding, CONFIG.UI.messageY, 17, CONFIG.COLORS.blue);
    const cx = CONFIG.UI.diamondX, cy = CONFIG.UI.diamondY, step = CONFIG.UI.diamondStep;
    [[0, -1, "second"], [1, 0, "first"], [-1, 0, "third"]].forEach(([dx, dy, base]) => { ctx.save(); ctx.translate(cx + dx * step, cy + dy * step); ctx.rotate(Math.PI / 4); ctx.fillStyle = gameState.runners?.[base] ? CONFIG.COLORS.gold : CONFIG.COLORS.chalk; ctx.fillRect(-CONFIG.UI.baseSize / 2, -CONFIG.UI.baseSize / 2, CONFIG.UI.baseSize, CONFIG.UI.baseSize); ctx.restore(); });
    const card = gameState.cards?.[0];
    if (card) {
      const image = createImage(card.asset);
      safeDrawImage(ctx, image, CONFIG.UI.cardX, CONFIG.UI.cardY, CONFIG.UI.cardWidth, CONFIG.UI.cardHeight, () => { ctx.fillStyle = CONFIG.COLORS.card; ctx.fillRect(CONFIG.UI.cardX, CONFIG.UI.cardY, CONFIG.UI.cardWidth, CONFIG.UI.cardHeight); drawText(card.name, CONFIG.UI.cardX + CONFIG.UI.cardWidth / 2, CONFIG.UI.cardY + CONFIG.FIELD_VISUALS.cardTitleYOffset, 20, CONFIG.COLORS.gold, "center"); drawText(card.effectText, CONFIG.UI.cardX + CONFIG.UI.cardWidth / 2, CONFIG.UI.cardY + CONFIG.FIELD_VISUALS.cardEffectYOffset, 13, CONFIG.COLORS.text, "center"); });
      drawText(`Card: ${card.name} - ${card.effectText}`, CONFIG.UI.cardX, CONFIG.UI.cardY + CONFIG.UI.cardHeight + CONFIG.UI.lineHeight, 16, CONFIG.COLORS.text);
    }
  }

  function renderBalls() {
    const pitchBall = gameState.pitchBall;
    const hitBall = gameState.hitBall;
    if (pitchBall) drawCircle(pitchBall.x, pitchBall.y, pitchBall.radius, CONFIG.COLORS.chalk, CONFIG.COLORS.red);
    if (hitBall) drawCircle(hitBall.x, hitBall.y, hitBall.radius, CONFIG.COLORS.chalk, CONFIG.COLORS.red);
  }

  function renderInstruction() {
    if (gameState.phase === "start") drawText("Press Space to start", CONFIG.CANVAS_WIDTH / 2, CONFIG.UI.instructionY, 26, CONFIG.COLORS.gold, "center");
    else if (gameState.phase === "playing") drawText(gameState.playState === "pitching" ? "Press Space to swing" : "Ball rolling...", CONFIG.CANVAS_WIDTH / 2, CONFIG.UI.instructionY, 24, CONFIG.COLORS.gold, "center");
    else drawText(`${gameState.score >= gameState.targetScore ? "Clear" : "Failed"} - Final Score ${gameState.score}. Press R or Space to restart`, CONFIG.CANVAS_WIDTH / 2, CONFIG.UI.instructionY, 23, gameState.score >= gameState.targetScore ? CONFIG.COLORS.gold : CONFIG.COLORS.red, "center");
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    renderField();
    renderHud();
    renderBalls();
    renderInstruction();
  }

  function handleSpace() {
    if (gameState.phase === "start") startGame();
    else if (gameState.phase === "gameover") startGame();
    else if (gameState.playState === "ready") beginPitch();
    else if (gameState.playState === "pitching") swing();
  }

  function loop() { update(); render(); requestAnimationFrame(loop); }

  startButton?.addEventListener("click", () => { if (gameState.phase === "start") startGame(); else if (gameState.phase === "playing" && gameState.playState === "ready") beginPitch(); });
  restartButton?.addEventListener("click", startGame);
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") { event.preventDefault(); handleSpace(); }
    if (event.code === "KeyR") { event.preventDefault(); startGame(); }
  });

  resetToStart();
  loop();
  window.BaseBallatro = { CONFIG, CARD_DEFINITIONS, gameState, startGame, beginPitch, swing, resolveResult, createImage, safeDrawImage };
})();
