(() => {
  "use strict";

  const CONFIG = Object.freeze({
    canvas: { width: 720, height: 960 },
    round: { targetScore: 500, outsToEnd: 3, startingBalls: 10 },
    scoring: {
      base: { OUT: 0, SINGLE: 10, DOUBLE: 25, TRIPLE: 50, HR: 100 },
      runScore: 75,
      defaultMultiplier: 1,
      sluggerHrMultiplier: 3,
    },
    input: {
      minSlider: 0,
      maxSlider: 100,
      defaultPower: 70,
      defaultDirection: 50,
      powerMin: 10,
      powerMax: 24,
      directionDegreesMin: -38,
      directionDegreesMax: 38,
    },
    ball: { radius: 9, startX: 360, startY: 845, gravity: 0.21, friction: 0.995, maxSpeed: 28 },
    field: {
      wallLeft: 58,
      wallRight: 662,
      wallTop: 92,
      wallBottom: 855,
      wallBounce: 0.82,
      pegRadius: 13,
      pegBounce: 0.92,
      holeY: 770,
      holeRadius: 38,
    },
    ui: { padding: 24, cardWidth: 132, cardHeight: 176, headerHeight: 172, titleY: 44, scoreY: 82, statusY: 116, messageY: 150, cardY: 184, cardTitleY: 82, cardEffectY: 112, footerY: 910, diamondX: 566, diamondY: 114, diamondStep: 26, baseSize: 20 },
    assets: { cards: "/assets/cards/", monsters: "/assets/monsters/", extension: ".png" },
    colors: {
      grass: "#1f6f3f", dirt: "#b77937", chalk: "#f8fafc", gold: "#fbbf24", red: "#ef4444", blue: "#38bdf8",
      panel: "rgba(15, 23, 42, 0.86)", card: "#312e81", text: "#f8fafc", muted: "#cbd5e1",
    },
  });

  const RESULT_ORDER = Object.freeze(["OUT", "SINGLE", "DOUBLE", "TRIPLE", "HR"]);
  const CARD_DEFINITIONS = Object.freeze({
    slugger: { id: "slugger", name: "Slugger", asset: "cards.slugger_fire_global_passive", modifies: "HR", multiplier: CONFIG.scoring.sluggerHrMultiplier },
  });

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas?.getContext?.("2d");
  const powerInput = document.getElementById("powerInput");
  const directionInput = document.getElementById("directionInput");
  const hitButton = document.getElementById("hitButton");
  const restartButton = document.getElementById("restartButton");
  const imageCache = new Map();

  const gameState = {
    phase: "start",
    score: 0,
    targetScore: CONFIG.round.targetScore,
    outs: 0,
    ballsRemaining: CONFIG.round.startingBalls,
    runners: { first: false, second: false, third: false },
    activeBall: null,
    resultMessage: "Set power and direction, then hit the ball.",
    cards: [{ ...CARD_DEFINITIONS.slugger }],
  };

  const holes = RESULT_ORDER.map((result, index) => {
    const spacing = (CONFIG.field.wallRight - CONFIG.field.wallLeft) / RESULT_ORDER.length;
    return { result, x: CONFIG.field.wallLeft + spacing * (index + 0.5), y: CONFIG.field.holeY, radius: CONFIG.field.holeRadius };
  });

  const pegs = Array.from({ length: 18 }, (_, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    return { x: 130 + col * 92 + (row % 2) * 46, y: 210 + row * 130, radius: CONFIG.field.pegRadius };
  });

  function createImage(key) {
    if (imageCache.has(key)) return imageCache.get(key);
    const [category, ...nameParts] = String(key || "").split(".");
    const base = CONFIG.assets[category];
    if (!base || nameParts.length === 0) return null;
    const image = new Image();
    image.src = `${base}${nameParts.join("_")}${CONFIG.assets.extension}`;
    imageCache.set(key, image);
    return image;
  }

  function safeDrawImage(context, image, x, y, width, height, fallback) {
    if (context && image?.complete && image.naturalWidth > 0) context.drawImage(image, x, y, width, height);
    else if (typeof fallback === "function") fallback();
  }

  function resetGame() {
    gameState.phase = "start";
    gameState.score = 0;
    gameState.targetScore = CONFIG.round.targetScore;
    gameState.outs = 0;
    gameState.ballsRemaining = CONFIG.round.startingBalls;
    gameState.runners = { first: false, second: false, third: false };
    gameState.activeBall = null;
    gameState.resultMessage = "Set power and direction, then hit the ball.";
    gameState.cards = [{ ...CARD_DEFINITIONS.slugger }];
  }

  function sliderNumber(input, fallback) {
    const value = Number(input?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function hitBall() {
    if (gameState.phase === "gameover" || gameState.activeBall || gameState.ballsRemaining <= 0) return;
    gameState.phase = "playing";
    gameState.ballsRemaining -= 1;
    const powerT = sliderNumber(powerInput, CONFIG.input.defaultPower) / CONFIG.input.maxSlider;
    const dirT = sliderNumber(directionInput, CONFIG.input.defaultDirection) / CONFIG.input.maxSlider;
    const speed = CONFIG.input.powerMin + (CONFIG.input.powerMax - CONFIG.input.powerMin) * powerT;
    const degrees = CONFIG.input.directionDegreesMin + (CONFIG.input.directionDegreesMax - CONFIG.input.directionDegreesMin) * dirT;
    const radians = (-90 + degrees) * Math.PI / 180;
    gameState.activeBall = { x: CONFIG.ball.startX, y: CONFIG.ball.startY, vx: Math.cos(radians) * speed, vy: Math.sin(radians) * speed, radius: CONFIG.ball.radius };
    gameState.resultMessage = "Ball in play...";
  }

  function applyCardModifiers(result, hitScore, runScore, multiplier) {
    return (gameState.cards || []).reduce((current, card) => card?.modifies === result ? current * (card.multiplier || CONFIG.scoring.defaultMultiplier) : current, multiplier);
  }

  function applyResult(result) {
    const safeResult = CONFIG.scoring.base[result] === undefined ? "OUT" : result;
    let runs = 0;
    if (safeResult === "OUT") gameState.outs += 1;
    else {
      const bases = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3, HR: 4 }[safeResult] || 0;
      const occupied = [gameState.runners.first, gameState.runners.second, gameState.runners.third];
      const next = [false, false, false];
      occupied.forEach((hasRunner, index) => {
        if (!hasRunner) return;
        const destination = index + bases;
        if (destination >= 3) runs += 1;
        else next[destination] = true;
      });
      if (bases >= 4) runs += 1;
      else next[bases - 1] = true;
      gameState.runners = { first: next[0], second: next[1], third: next[2] };
    }
    const hitScore = CONFIG.scoring.base[safeResult];
    const runScore = runs * CONFIG.scoring.runScore;
    const multiplier = applyCardModifiers(safeResult, hitScore, runScore, CONFIG.scoring.defaultMultiplier);
    const gained = (hitScore + runScore) * multiplier;
    gameState.score += gained;
    gameState.activeBall = null;
    gameState.resultMessage = `${safeResult}: +${gained} (${runs} run${runs === 1 ? "" : "s"}, x${multiplier})`;
    if (gameState.score >= gameState.targetScore) gameState.phase = "gameover";
    else if (gameState.outs >= CONFIG.round.outsToEnd || gameState.ballsRemaining <= 0) gameState.phase = "gameover";
  }

  function update() {
    const ball = gameState.activeBall;
    if (!ball) return;
    ball.vy += CONFIG.ball.gravity;
    ball.vx *= CONFIG.ball.friction;
    ball.vy *= CONFIG.ball.friction;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > CONFIG.ball.maxSpeed) { ball.vx = ball.vx / speed * CONFIG.ball.maxSpeed; ball.vy = ball.vy / speed * CONFIG.ball.maxSpeed; }
    ball.x += ball.vx; ball.y += ball.vy;
    if (ball.x - ball.radius < CONFIG.field.wallLeft || ball.x + ball.radius > CONFIG.field.wallRight) { ball.x = Math.max(CONFIG.field.wallLeft + ball.radius, Math.min(CONFIG.field.wallRight - ball.radius, ball.x)); ball.vx *= -CONFIG.field.wallBounce; }
    if (ball.y - ball.radius < CONFIG.field.wallTop) { ball.y = CONFIG.field.wallTop + ball.radius; ball.vy *= -CONFIG.field.wallBounce; }
    pegs.forEach((peg) => {
      const dx = ball.x - peg.x, dy = ball.y - peg.y, dist = Math.hypot(dx, dy), min = ball.radius + peg.radius;
      if (dist > 0 && dist < min) {
        const nx = dx / dist, ny = dy / dist, dot = ball.vx * nx + ball.vy * ny;
        ball.x = peg.x + nx * min; ball.y = peg.y + ny * min;
        ball.vx = (ball.vx - 2 * dot * nx) * CONFIG.field.pegBounce; ball.vy = (ball.vy - 2 * dot * ny) * CONFIG.field.pegBounce;
      }
    });
    const hole = holes.find((target) => Math.hypot(ball.x - target.x, ball.y - target.y) <= target.radius);
    if (hole || ball.y > CONFIG.field.wallBottom) applyResult(hole?.result || "OUT");
  }

  function drawText(text, x, y, size = 20, color = CONFIG.colors.text, align = "left") { ctx.fillStyle = color; ctx.font = `800 ${size}px system-ui`; ctx.textAlign = align; ctx.fillText(text, x, y); }
  function drawDiamond() {
    const cx = CONFIG.ui.diamondX, cy = CONFIG.ui.diamondY, s = CONFIG.ui.diamondStep;
    [[0, -1, "second"], [1, 0, "first"], [0, 1, "home"], [-1, 0, "third"]].forEach(([dx, dy, base]) => {
      ctx.save(); ctx.translate(cx + dx * s, cy + dy * s); ctx.rotate(Math.PI / 4); ctx.fillStyle = gameState.runners?.[base] ? CONFIG.colors.gold : CONFIG.colors.chalk; ctx.fillRect(-CONFIG.ui.baseSize / 2, -CONFIG.ui.baseSize / 2, CONFIG.ui.baseSize, CONFIG.ui.baseSize); ctx.restore();
    });
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    ctx.fillStyle = CONFIG.colors.grass; ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    ctx.fillStyle = CONFIG.colors.panel; ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.ui.headerHeight);
    drawText("BaseBallatro", CONFIG.ui.padding, CONFIG.ui.titleY, 34, CONFIG.colors.gold);
    drawText(`Score ${gameState.score} / ${gameState.targetScore}`, CONFIG.ui.padding, CONFIG.ui.scoreY, 24);
    drawText(`Outs ${gameState.outs}/${CONFIG.round.outsToEnd}   Balls ${gameState.ballsRemaining}`, CONFIG.ui.padding, CONFIG.ui.statusY, 21, CONFIG.colors.muted);
    drawText(gameState.resultMessage || "", CONFIG.ui.padding, CONFIG.ui.messageY, 18, CONFIG.colors.blue);
    drawDiamond();

    ctx.strokeStyle = CONFIG.colors.chalk; ctx.lineWidth = 5; ctx.strokeRect(CONFIG.field.wallLeft, CONFIG.field.wallTop, CONFIG.field.wallRight - CONFIG.field.wallLeft, CONFIG.field.wallBottom - CONFIG.field.wallTop);
    holes.forEach((hole) => { ctx.beginPath(); ctx.fillStyle = hole.result === "OUT" ? "#111827" : CONFIG.colors.dirt; ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = CONFIG.colors.chalk; ctx.stroke(); drawText(hole.result, hole.x, hole.y + 7, 15, CONFIG.colors.text, "center"); });
    pegs.forEach((peg) => { ctx.beginPath(); ctx.fillStyle = CONFIG.colors.gold; ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2); ctx.fill(); });
    const ball = gameState.activeBall;
    if (ball) { ctx.beginPath(); ctx.fillStyle = "#ffffff"; ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = CONFIG.colors.red; ctx.stroke(); }

    const card = gameState.cards?.[0];
    if (card) {
      const x = CONFIG.ui.padding, y = CONFIG.ui.cardY, image = createImage(card.asset);
      safeDrawImage(ctx, image, x, y, CONFIG.ui.cardWidth, CONFIG.ui.cardHeight, () => { ctx.fillStyle = CONFIG.colors.card; ctx.fillRect(x, y, CONFIG.ui.cardWidth, CONFIG.ui.cardHeight); drawText("SLUGGER", x + CONFIG.ui.cardWidth / 2, y + CONFIG.ui.cardTitleY, 18, CONFIG.colors.gold, "center"); drawText("HR x3", x + CONFIG.ui.cardWidth / 2, y + CONFIG.ui.cardEffectY, 20, CONFIG.colors.text, "center"); });
    }
    if (gameState.phase === "start") drawText("Ready: choose power and direction.", CONFIG.canvas.width / 2, CONFIG.ui.footerY, 24, CONFIG.colors.gold, "center");
    if (gameState.phase === "gameover") drawText(gameState.score >= gameState.targetScore ? "WIN - Target Reached!" : "GAME OVER", CONFIG.canvas.width / 2, CONFIG.ui.footerY, 32, gameState.score >= gameState.targetScore ? CONFIG.colors.gold : CONFIG.colors.red, "center");
  }

  function loop() { update(); render(); requestAnimationFrame(loop); }
  powerInput && (powerInput.value = String(CONFIG.input.defaultPower));
  directionInput && (directionInput.value = String(CONFIG.input.defaultDirection));
  hitButton?.addEventListener("click", hitBall);
  restartButton?.addEventListener("click", resetGame);
  resetGame(); loop();
  window.BaseBallatro = { CONFIG, gameState, applyResult, applyCardModifiers, createImage };
})();
