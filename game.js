const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  hud: document.getElementById('hud'),
  progress: document.getElementById('progressWrap'),
  progressFill: document.getElementById('progressFill'),
  controls: document.getElementById('controls'),
  distanceText: document.getElementById('distanceText'),
  timeText: document.getElementById('timeText'),
  pingsText: document.getElementById('pingsText'),
  menu: document.getElementById('menu'),
  howPanel: document.getElementById('howPanel'),
  pausePanel: document.getElementById('pausePanel'),
  endPanel: document.getElementById('endPanel'),
  endKicker: document.getElementById('endKicker'),
  endTitle: document.getElementById('endTitle'),
  endStats: document.getElementById('endStats'),
  boostBtn: document.getElementById('boostBtn')
};

const buttons = {
  start: document.getElementById('startBtn'),
  how: document.getElementById('howBtn'),
  back: document.getElementById('backBtn'),
  pause: document.getElementById('pauseBtn'),
  resume: document.getElementById('resumeBtn'),
  restart: document.getElementById('restartBtn'),
  home: document.getElementById('homeBtn'),
  again: document.getElementById('againBtn'),
  endHome: document.getElementById('endHomeBtn')
};

let W = 0;
let H = 0;
let DPR = 1;
let last = 0;
let state = 'menu';
let objects = [];
let particles = [];
let spawnTimer = 0;
let pingTimer = 0;
let shake = 0;
let pointerDown = false;
let pointerStartX = 0;
let playerStartX = 0;
let boostHeld = false;
let best = Number(localStorage.getItem('cornfield-drone-best') || 0);

const game = {
  playerX: 0,
  targetX: 0,
  distance: 1500,
  startDistance: 1500,
  time: 90,
  pings: 0,
  speed: 1,
  boost: 45,
  hitCooldown: 0,
  roadOffset: 0,
  droneBob: 0
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.floor(rect.width);
  H = Math.floor(rect.height);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

window.addEventListener('resize', resize);
resize();

function showScreen(next) {
  state = next;
  const playing = next === 'playing';
  ui.hud.classList.toggle('hidden', !playing && next !== 'paused');
  ui.progress.classList.toggle('hidden', !playing && next !== 'paused');
  ui.controls.classList.toggle('hidden', !playing);
  ui.menu.classList.toggle('hidden', next !== 'menu');
  ui.howPanel.classList.toggle('hidden', next !== 'how');
  ui.pausePanel.classList.toggle('hidden', next !== 'paused');
  ui.endPanel.classList.toggle('hidden', next !== 'end');
}

function resetGame() {
  objects = [];
  particles = [];
  spawnTimer = 0;
  pingTimer = .8;
  shake = 0;
  boostHeld = false;
  Object.assign(game, {
    playerX: 0,
    targetX: 0,
    distance: 1500,
    startDistance: 1500,
    time: 90,
    pings: 0,
    speed: 1,
    boost: 45,
    hitCooldown: 0,
    roadOffset: 0,
    droneBob: 0
  });
  showScreen('playing');
}

buttons.start.addEventListener('click', resetGame);
buttons.how.addEventListener('click', () => showScreen('how'));
buttons.back.addEventListener('click', () => showScreen('menu'));
buttons.pause.addEventListener('click', () => { if (state === 'playing') showScreen('paused'); });
buttons.resume.addEventListener('click', () => showScreen('playing'));
buttons.restart.addEventListener('click', resetGame);
buttons.home.addEventListener('click', () => showScreen('menu'));
buttons.again.addEventListener('click', resetGame);
buttons.endHome.addEventListener('click', () => showScreen('menu'));

ui.boostBtn.addEventListener('pointerdown', e => { e.preventDefault(); boostHeld = true; });
window.addEventListener('pointerup', () => { boostHeld = false; pointerDown = false; });
window.addEventListener('pointercancel', () => { boostHeld = false; pointerDown = false; });

canvas.addEventListener('pointerdown', e => {
  if (state !== 'playing') return;
  pointerDown = true;
  pointerStartX = e.clientX;
  playerStartX = game.targetX;
});

canvas.addEventListener('pointermove', e => {
  if (!pointerDown || state !== 'playing') return;
  const dx = (e.clientX - pointerStartX) / Math.max(120, W * .35);
  game.targetX = clamp(playerStartX + dx, -1, 1);
});

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') game.targetX = clamp(game.targetX - .12, -1, 1);
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') game.targetX = clamp(game.targetX + .12, -1, 1);
  if (e.code === 'Space') boostHeld = true;
  if (e.key.toLowerCase() === 'p' && state === 'playing') showScreen('paused');
});

window.addEventListener('keyup', e => {
  if (e.code === 'Space') boostHeld = false;
});

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return min + Math.random() * (max - min); }

function laneX(norm, y) {
  const perspective = y / H;
  const roadWidth = lerp(W * .17, W * .78, perspective);
  return W / 2 + norm * roadWidth * .48;
}

function spawnObject(kind) {
  const lane = rand(-.85, .85);
  objects.push({
    kind,
    x: lane,
    y: -40,
    wobble: rand(0, Math.PI * 2),
    size: kind === 'ping' ? rand(.75, 1.05) : rand(.85, 1.25),
    passed: false
  });
}

function update(dt) {
  if (state !== 'playing') return;

  const usingBoost = boostHeld && game.boost > 0;
  game.speed = lerp(game.speed, usingBoost ? 1.85 : 1, dt * 5);
  if (usingBoost) game.boost = Math.max(0, game.boost - dt * 28);
  else game.boost = Math.min(100, game.boost + dt * 7);

  game.playerX = lerp(game.playerX, game.targetX, dt * 9);
  game.distance = Math.max(0, game.distance - dt * (18 + game.speed * 28 + game.pings * .08));
  game.time = Math.max(0, game.time - dt);
  game.roadOffset += dt * game.speed * 180;
  game.droneBob += dt * 5;
  game.hitCooldown = Math.max(0, game.hitCooldown - dt);
  shake = Math.max(0, shake - dt * 8);

  spawnTimer -= dt * game.speed;
  pingTimer -= dt * game.speed;
  if (spawnTimer <= 0) {
    spawnTimer = rand(.65, 1.1);
    spawnObject(Math.random() > .55 ? 'bale' : Math.random() > .5 ? 'rock' : 'post');
  }
  if (pingTimer <= 0) {
    pingTimer = rand(.8, 1.4);
    spawnObject('ping');
  }

  for (const o of objects) {
    o.y += dt * (210 + game.speed * 170);
    o.wobble += dt * 4;
  }

  objects = objects.filter(o => o.y < H + 100 && !o.remove);

  for (const o of objects) {
    const p = o.y / H;
    if (p < .58 || o.passed) continue;
    const objectScreenX = laneX(o.x, o.y);
    const playerScreenX = laneX(game.playerX, H * .82);
    const collisionRadius = lerp(28, 62, p) * o.size;
    const closeX = Math.abs(objectScreenX - playerScreenX) < collisionRadius;
    const closeY = Math.abs(o.y - H * .82) < collisionRadius;
    if (!closeX || !closeY) continue;

    o.passed = true;
    if (o.kind === 'ping') {
      o.remove = true;
      game.pings += 1;
      game.time = Math.min(99, game.time + 2.5);
      game.boost = Math.min(100, game.boost + 15);
      addParticles(objectScreenX, o.y, '#8bd8ff', 16);
    } else if (game.hitCooldown <= 0) {
      game.hitCooldown = 1.1;
      game.time = Math.max(0, game.time - 5);
      game.distance = Math.min(game.startDistance, game.distance + 55);
      shake = 1;
      addParticles(objectScreenX, o.y, '#e5b15a', 18);
    }
  }

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vy += dt * 100;
  }
  particles = particles.filter(p => p.life > 0);

  if (game.distance <= 0) finish(true);
  if (game.time <= 0) finish(false);

  updateHud();
}

function addParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, vx: rand(-110, 110), vy: rand(-180, -30), life: rand(.35, .85), color });
  }
}

function updateHud() {
  ui.distanceText.textContent = `${Math.ceil(game.distance)} m`;
  const m = Math.floor(game.time / 60);
  const s = Math.floor(game.time % 60).toString().padStart(2, '0');
  ui.timeText.textContent = `${m}:${s}`;
  ui.pingsText.textContent = String(game.pings);
  const progress = 100 * (1 - game.distance / game.startDistance);
  ui.progressFill.style.width = `${clamp(progress, 0, 100)}%`;
  ui.boostBtn.classList.toggle('ready', game.boost > 18);
  ui.boostBtn.style.opacity = String(.55 + game.boost / 220);
}

function finish(won) {
  state = 'end';
  const covered = Math.round(game.startDistance - game.distance);
  best = Math.max(best, covered);
  localStorage.setItem('cornfield-drone-best', String(best));
  ui.endKicker.textContent = won ? 'Signal locked' : 'Time ran out';
  ui.endTitle.textContent = won ? 'Caught the Drone' : 'Drone Escaped';
  ui.endStats.innerHTML = `Distance covered: <strong>${covered} m</strong><br>Pings collected: <strong>${game.pings}</strong><br>Best run: <strong>${best} m</strong>`;
  ui.hud.classList.add('hidden');
  ui.progress.classList.add('hidden');
  ui.controls.classList.add('hidden');
  ui.endPanel.classList.remove('hidden');
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#849091');
  g.addColorStop(.32, '#d6b982');
  g.addColorStop(.62, '#5d5028');
  g.addColorStop(1, '#15140a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255, 225, 165, .4)';
  ctx.beginPath();
  ctx.arc(W * .82, H * .16, W * .1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(62, 52, 35, .7)';
  ctx.fillRect(W * .53, H * .34, W * .11, H * .055);
  ctx.fillRect(W * .58, H * .29, W * .035, H * .1);
  ctx.beginPath();
  ctx.moveTo(W * .50, H * .34);
  ctx.lineTo(W * .59, H * .27);
  ctx.lineTo(W * .68, H * .34);
  ctx.fill();
}

function drawCornRows() {
  const horizon = H * .36;
  const bottom = H + 40;
  ctx.fillStyle = '#262010';
  ctx.beginPath();
  ctx.moveTo(W * .45, horizon);
  ctx.lineTo(W * .12, bottom);
  ctx.lineTo(W * .88, bottom);
  ctx.lineTo(W * .55, horizon);
  ctx.closePath();
  ctx.fill();

  for (let side of [-1, 1]) {
    const grad = ctx.createLinearGradient(W / 2, horizon, side < 0 ? 0 : W, H);
    grad.addColorStop(0, '#4b5422');
    grad.addColorStop(.55, '#677126');
    grad.addColorStop(1, '#1e240d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(W / 2 + side * W * .06, horizon);
    ctx.lineTo(side < 0 ? 0 : W, horizon - 20);
    ctx.lineTo(side < 0 ? 0 : W, H);
    ctx.lineTo(W / 2 + side * W * .38, H);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(245, 214, 122, .28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 34; i++) {
    const t = ((i * 34 + game.roadOffset) % 900) / 900;
    const y = lerp(horizon, H + 80, t);
    const spread = (y - horizon) / (H - horizon);
    const xLeft = W / 2 - spread * W * .34;
    const xRight = W / 2 + spread * W * .34;
    ctx.globalAlpha = spread;
    ctx.beginPath();
    ctx.moveTo(xLeft, y);
    ctx.lineTo(xRight, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 130; i++) {
    const side = i % 2 ? -1 : 1;
    const y = (i * 43 + game.roadOffset * (side > 0 ? 1.2 : .95)) % (H + 120) - 40;
    const p = Math.max(0, y / H);
    const x = side < 0 ? randFor(i, 0, W * .28) : randFor(i, W * .72, W);
    const h = lerp(22, 120, p);
    const sway = Math.sin(game.roadOffset * .01 + i) * 7;
    ctx.strokeStyle = i % 3 ? '#8a7d36' : '#b09b42';
    ctx.lineWidth = lerp(1, 4, p);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.quadraticCurveTo(x + sway, y + h * .45, x + sway * .35, y);
    ctx.stroke();
  }
}

function randFor(seed, min, max) {
  const n = Math.sin(seed * 999.917) * 43758.5453123;
  return min + (n - Math.floor(n)) * (max - min);
}

function drawDrone() {
  const y = H * .22 + Math.sin(game.droneBob) * 8;
  const x = W / 2 + Math.sin(game.droneBob * .37) * W * .04;
  const scale = lerp(.65, 1.25, 1 - game.distance / game.startDistance);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#1b1e1e';
  ctx.fillRect(-20, -9, 40, 18);
  ctx.fillStyle = '#d64331';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-20, 0); ctx.lineTo(-54, -18); ctx.moveTo(20, 0); ctx.lineTo(54, -18);
  ctx.moveTo(-20, 0); ctx.lineTo(-54, 18); ctx.moveTo(20, 0); ctx.lineTo(54, 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(25,25,25,.75)';
  ctx.lineWidth = 2;
  for (const [rx, ry] of [[-58,-20],[58,-20],[-58,20],[58,20]]) {
    ctx.beginPath();
    ctx.ellipse(rx, ry, 22, 4, game.droneBob, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObjects() {
  const sorted = [...objects].sort((a, b) => a.y - b.y);
  for (const o of sorted) {
    const p = clamp(o.y / H, 0, 1.2);
    const x = laneX(o.x, o.y);
    const size = lerp(12, 62, p) * o.size;
    if (o.kind === 'ping') drawPing(x, o.y, size);
    else if (o.kind === 'bale') drawBale(x, o.y, size);
    else if (o.kind === 'rock') drawRock(x, o.y, size);
    else drawPost(x, o.y, size);
  }
}

function drawPing(x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(139,216,255,.9)';
  ctx.lineWidth = Math.max(2, size * .08);
  ctx.shadowColor = '#8bd8ff';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, size * .32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, size * .55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#d7f5ff';
  ctx.beginPath();
  ctx.arc(0, 0, size * .12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBale(x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#9c6d24';
  roundRect(-size * .5, -size * .28, size, size * .56, size * .12);
  ctx.fill();
  ctx.strokeStyle = '#e0b05e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size*.35, -size*.18); ctx.lineTo(size*.32, -size*.12);
  ctx.moveTo(-size*.4, size*.05); ctx.lineTo(size*.38, size*.14);
  ctx.stroke();
  ctx.restore();
}

function drawRock(x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#514b41';
  ctx.beginPath();
  ctx.moveTo(-size*.42, size*.18);
  ctx.lineTo(-size*.20, -size*.28);
  ctx.lineTo(size*.22, -size*.34);
  ctx.lineTo(size*.48, size*.10);
  ctx.lineTo(size*.16, size*.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPost(x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(.25);
  ctx.fillStyle = '#5a371b';
  roundRect(-size*.12, -size*.55, size*.24, size*1.1, size*.04);
  ctx.fill();
  ctx.strokeStyle = '#9d7448';
  ctx.lineWidth = Math.max(2, size*.05);
  ctx.beginPath();
  ctx.moveTo(-size*.35, -size*.2);
  ctx.lineTo(size*.38, size*.1);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  const x = laneX(game.playerX, H * .82);
  const y = H * .82;
  const w = W * .22;
  const h = W * .24;
  ctx.save();
  ctx.translate(x, y);
  if (game.hitCooldown > 0) ctx.globalAlpha = .65 + Math.sin(Date.now() / 40) * .25;
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#171410';
  roundRect(-w*.52, -h*.33, w*1.04, h*.62, 10);
  ctx.fill();
  ctx.fillStyle = '#2d251d';
  roundRect(-w*.42, -h*.55, w*.84, h*.34, 8);
  ctx.fill();
  ctx.fillStyle = '#0a0a08';
  ctx.fillRect(-w*.38, -h*.45, w*.76, h*.20);
  ctx.fillStyle = '#d9402e';
  ctx.fillRect(-w*.48, h*.12, w*.10, h*.10);
  ctx.fillRect(w*.38, h*.12, w*.10, h*.10);
  if (boostHeld && game.boost > 0) {
    ctx.fillStyle = 'rgba(255, 195, 64, .45)';
    ctx.beginPath();
    ctx.moveTo(-w*.25, h*.28);
    ctx.lineTo(0, h*.80 + Math.random()*18);
    ctx.lineTo(w*.25, h*.28);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + p.life * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawVignette() {
  const g = ctx.createRadialGradient(W/2, H*.45, W*.1, W/2, H*.5, W*.82);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(.72, 'rgba(0,0,0,.28)');
  g.addColorStop(1, 'rgba(0,0,0,.68)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawMenuScene() {
  drawSky();
  drawCornRows();
  drawDrone();
  drawPlayer();
  drawVignette();
}

function render() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-7, 7) * shake, rand(-7, 7) * shake);
  drawSky();
  drawCornRows();
  drawDrone();
  drawObjects();
  drawPlayer();
  drawParticles();
  drawVignette();
  ctx.restore();

  if (state === 'menu' || state === 'how' || state === 'end') {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, 0, W, H);
  }
}

function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0);
  last = t;
  if (state === 'menu' || state === 'how' || state === 'end') {
    game.roadOffset += dt * 35;
    game.droneBob += dt * 2;
  }
  update(dt);
  render();
  requestAnimationFrame(loop);
}

showScreen('menu');
requestAnimationFrame(loop);
