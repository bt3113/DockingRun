const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const ui = {
  hud: document.getElementById('hud'),
  menu: document.getElementById('menu'),
  brief: document.getElementById('briefing'),
  pause: document.getElementById('paused'),
  end: document.getElementById('ended'),
  dist: document.getElementById('dist'),
  time: document.getElementById('time'),
  align: document.getElementById('align'),
  title: document.getElementById('endTitle'),
  text: document.getElementById('endText'),
  brake: document.getElementById('brake'),
  hint: document.getElementById('hint')
};

const VW = 180;
const VH = 320;
canvas.width = VW;
canvas.height = VH;
ctx.imageSmoothingEnabled = false;

let state = 'menu';
let last = 0;
let dragging = false;
let startX = 0;
let startLane = 0;
let braking = false;

const game = {
  dist: 2200,
  time: 105,
  speed: 0,
  lane: 0,
  targetLane: 0,
  droneLane: 0,
  fieldOffset: 0,
  clock: 0,
  shake: 0,
  best: Number(localStorage.pixelFieldBest || 9999)
};

const trail = [];
const dust = [];
const fieldSeed = Array.from({ length: 900 }, (_, i) => ({
  x: rand(-90, 90),
  z: rand(0, 900),
  h: rand(4, 13),
  c: Math.random()
}));

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function approach(v, t, step) { return Math.abs(v - t) <= step ? t : v + Math.sign(t - v) * step; }
function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
function px(v) { return Math.round(v); }

function show(next) {
  state = next;
  const play = next === 'play';
  const pause = next === 'pause';
  ui.hud.classList.toggle('hidden', !(play || pause));
  ui.brake.classList.toggle('hidden', !play);
  ui.hint.classList.toggle('hidden', !play);
  ui.menu.classList.toggle('hidden', next !== 'menu');
  ui.brief.classList.toggle('hidden', next !== 'brief');
  ui.pause.classList.toggle('hidden', next !== 'pause');
  ui.end.classList.toggle('hidden', next !== 'end');
}

function reset() {
  game.dist = 2200;
  game.time = 105;
  game.speed = 0;
  game.lane = 0;
  game.targetLane = 0;
  game.droneLane = 0;
  game.fieldOffset = 0;
  game.clock = 0;
  game.shake = 0;
  trail.length = 0;
  dust.length = 0;
  braking = false;
  ui.brake.classList.remove('active');
  show('play');
  updateHud();
}

document.getElementById('start').onclick = reset;
document.getElementById('brief').onclick = () => show('brief');
document.getElementById('back').onclick = () => show('menu');
document.getElementById('pause').onclick = () => state === 'play' && show('pause');
document.getElementById('resume').onclick = () => show('play');
document.getElementById('restart').onclick = reset;
document.getElementById('home').onclick = () => show('menu');
document.getElementById('again').onclick = reset;
document.getElementById('endHome').onclick = () => show('menu');

canvas.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  dragging = true;
  startX = e.clientX;
  startLane = game.targetLane;
});
canvas.addEventListener('pointermove', e => {
  if (!dragging || state !== 'play') return;
  game.targetLane = clamp(startLane + (e.clientX - startX) / 115, -1.15, 1.15);
});
addEventListener('pointerup', () => { dragging = false; braking = false; ui.brake.classList.remove('active'); });
addEventListener('pointercancel', () => { dragging = false; braking = false; ui.brake.classList.remove('active'); });
ui.brake.addEventListener('pointerdown', e => {
  e.preventDefault();
  braking = true;
  ui.brake.classList.add('active');
});
addEventListener('keydown', e => {
  if (state !== 'play') return;
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') game.targetLane = clamp(game.targetLane - 0.12, -1.15, 1.15);
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') game.targetLane = clamp(game.targetLane + 0.12, -1.15, 1.15);
  if (e.code === 'Space') { braking = true; ui.brake.classList.add('active'); }
  if (e.key.toLowerCase() === 'p') show('pause');
});
addEventListener('keyup', e => {
  if (e.code === 'Space') { braking = false; ui.brake.classList.remove('active'); }
});

function update(dt) {
  if (state !== 'play') return;

  game.clock += dt;
  game.time = Math.max(0, game.time - dt);
  game.droneLane = Math.sin(game.clock * 0.42) * 0.72 + Math.sin(game.clock * 0.11) * 0.25;

  const align = 1 - clamp(Math.abs(game.lane - game.droneLane) / 1.35, 0, 1);
  const cruise = game.dist < 250 ? 14 : lerp(18, 26, align);
  const desiredSpeed = braking ? 0 : cruise;
  game.speed = approach(game.speed, desiredSpeed, (braking ? 22 : 7) * dt);
  game.lane = approach(game.lane, game.targetLane, 2.6 * dt);

  game.dist -= game.speed * dt;
  game.fieldOffset += game.speed * dt * 22;
  game.shake = Math.max(0, Math.max(game.shake, (1 - align) * 0.55 + game.speed / 110) - dt * 2);

  if (game.speed > 2) {
    trail.unshift({ x: game.lane, age: 0, w: 14 + Math.abs(game.lane - game.targetLane) * 7 });
    if (trail.length > 34) trail.pop();
    if (Math.random() < 0.75) dust.push({ x: game.lane + rand(-0.08, 0.08), y: 0, life: rand(0.35, 0.9), size: rand(3, 8) });
  }
  trail.forEach(t => t.age += game.speed * dt * 0.18);
  dust.forEach(d => { d.y += game.speed * dt * 0.9; d.life -= dt; d.size += dt * 6; });
  for (let i = dust.length - 1; i >= 0; i--) if (dust[i].life <= 0) dust.splice(i, 1);

  if (game.time <= 0) finish(false, 'time');
  if (game.dist <= 36 && game.dist > -6 && game.speed < 4.2) finish(true, 'stop');
  if (game.dist < -8) finish(false, 'cliff');

  updateHud();
}

function finish(win, reason) {
  show('end');
  const stopped = Math.max(0, Math.round(game.dist));
  if (win && stopped < game.best) {
    game.best = stopped;
    localStorage.pixelFieldBest = stopped;
  }
  if (win) {
    ui.title.textContent = 'Stopped at the Edge';
    ui.text.innerHTML = `You followed the drone through the field and stopped <b>${stopped} m</b> before the cliff.<br>Best stop: <b>${game.best} m</b>.`;
  } else if (reason === 'cliff') {
    ui.title.textContent = 'Too Late';
    ui.text.innerHTML = `You reached the cliff but carried too much speed. Brake earlier and stay aligned with the drone.`;
  } else {
    ui.title.textContent = 'Signal Lost';
    ui.text.innerHTML = `The drone outran you. Stay under it to keep speed and reach the cliff before time runs out.`;
  }
}

function updateHud() {
  ui.dist.textContent = game.dist > 0 ? `${Math.ceil(game.dist)} m` : 'EDGE';
  ui.time.textContent = `${Math.floor(game.time / 60)}:${String(Math.floor(game.time % 60)).padStart(2, '0')}`;
  const align = Math.round((1 - clamp(Math.abs(game.lane - game.droneLane) / 1.35, 0, 1)) * 100);
  ui.align.textContent = `${align}%`;
}

function project(x, z) {
  const s = 65 / (z + 52);
  return { x: 90 + x * s * 3.1, y: 98 + (1 - s) * 198, s };
}

function clear() {
  ctx.fillStyle = '#0b0b10';
  ctx.fillRect(0, 0, VW, VH);
}

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(px(x), px(y), px(w), px(h));
}

function drawSky() {
  const bands = ['#5f5374', '#805f86', '#b56f86', '#e48a72', '#f1b06b'];
  for (let i = 0; i < bands.length; i++) rect(0, i * 17, VW, 18, bands[i]);
  rect(0, 84, VW, 18, '#d59a65');
  rect(0, 100, VW, 10, '#3f4d32');
  rect(0, 109, VW, 8, '#28351d');

  rect(27, 61, 18, 2, '#7e6282'); rect(33, 58, 22, 4, '#7e6282'); rect(41, 55, 8, 3, '#7e6282');
  rect(113, 64, 26, 3, '#7e6282'); rect(120, 60, 17, 4, '#7e6282');
  rect(66, 38, 32, 3, '#8d6e8f'); rect(73, 34, 18, 4, '#8d6e8f');

  rect(34, 78, 13, 13, '#ffe38a');
  rect(31, 82, 19, 5, '#ffe38a');
  rect(36, 75, 9, 3, '#fff0b0');
}

function drawFieldBase() {
  rect(0, 114, VW, 206, '#223313');
  rect(0, 114, VW, 18, '#2f411b');
  rect(0, 132, VW, 36, '#263b16');
  rect(0, 168, VW, 152, '#18250f');

  for (let i = -9; i <= 9; i++) {
    const top = project(i * 13 - game.lane * 10, 50);
    const bot = project(i * 31 - game.lane * 52, 650);
    ctx.strokeStyle = i % 2 ? '#33441b' : '#405623';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(top.x), px(top.y));
    ctx.lineTo(px(bot.x), px(bot.y));
    ctx.stroke();
  }
}

function crushedAt(wx, z) {
  for (const t of trail) {
    const tz = 34 + t.age * 12;
    if (Math.abs(tz - z) < 28 && Math.abs(t.x - wx) < 0.22) return true;
  }
  return false;
}

function drawTrail() {
  for (let i = trail.length - 1; i >= 0; i--) {
    const t = trail[i];
    const z = 32 + t.age * 12;
    const p = project((t.x - game.lane) * 54, z);
    const w = lerp(4, t.w, clamp((p.y - 100) / 210, 0, 1));
    rect(p.x - w * 0.55, p.y - 1, w * 1.1, 3, '#5b4a1b');
    rect(p.x - w * 0.48, p.y + 2, w * 0.96, 2, '#23180a');
    rect(p.x - w * 0.3, p.y - 3, w * 0.6, 2, '#8f7932');
  }
}

function drawCorn() {
  const list = fieldSeed.map((o, i) => ({
    ...o,
    i,
    z: ((o.z - game.fieldOffset) % 900 + 900) % 900 + 16,
    x: o.x - game.lane * 38
  })).sort((a, b) => b.z - a.z);

  for (const s of list) {
    const p = project(s.x, s.z);
    if (p.y < 108 || p.y > 322 || p.x < -10 || p.x > 190) continue;
    const hit = crushedAt((s.x + game.lane * 38) / 54, s.z);
    const scale = clamp(p.s * 2.5, 0.2, 1.8);
    const h = s.h * scale * 2.3;
    const c = hit ? '#6b5a25' : s.c > .62 ? '#c5a84a' : s.c > .28 ? '#6f872b' : '#486321';
    const lean = hit ? Math.sign(s.x || 1) * 5 * scale : Math.sin(s.i * 7 + game.clock) * scale * 1.4;
    rect(p.x, p.y - h, Math.max(1, scale), h, c);
    if (!hit && p.s > .22) {
      rect(p.x + lean, p.y - h * .55, 3 * scale, Math.max(1, scale), s.c > .5 ? '#d2b65b' : '#7f9636');
      rect(p.x - lean - 2 * scale, p.y - h * .72, 2 * scale, Math.max(1, scale), '#8a9b3c');
    }
  }
}

function drawDust() {
  for (const d of dust) {
    const p = project((d.x - game.lane) * 54, 38 + d.y * 18);
    const a = d.life;
    const col = a > .6 ? '#d9ad67' : a > .3 ? '#9f7d45' : '#554224';
    rect(p.x - d.size * p.s, p.y - d.size * .45 * p.s, d.size * 2 * p.s, d.size * p.s, col);
  }
}

function drawCliff() {
  if (game.dist > 430) return;
  const k = 1 - clamp(game.dist / 430, 0, 1);
  const y = Math.round(112 + k * 28);
  rect(0, y, VW, 3, '#e5c477');
  rect(0, y + 3, VW, VH - y, '#0c0908');
  rect(20, y - 3, 34, 2, '#b79858');
  rect(89, y - 4, 48, 2, '#b79858');
}

function drawDrone() {
  const x = 90 + (game.droneLane - game.lane) * 42;
  const y = 58 + Math.sin(game.clock * 3) * 2;
  rect(x - 9, y - 4, 18, 8, '#17191d');
  rect(x - 2, y - 1, 4, 4, '#e24a38');
  rect(x - 33, y - 13, 22, 3, '#0d0e11'); rect(x + 11, y - 13, 22, 3, '#0d0e11');
  rect(x - 33, y + 10, 22, 3, '#0d0e11'); rect(x + 11, y + 10, 22, 3, '#0d0e11');
  rect(x - 38, y - 17, 18, 2, '#0d0e11'); rect(x + 20, y - 17, 18, 2, '#0d0e11');
  rect(x - 38, y + 15, 18, 2, '#0d0e11'); rect(x + 20, y + 15, 18, 2, '#0d0e11');
  rect(x - 1, y + 8, 2, 20, '#d8c16b');
  rect(x - 7, y + 26, 14, 2, '#d8c16b');
}

function drawCar() {
  const x = 90 + game.lane * 28;
  const y = 252;
  rect(x - 31, y + 7, 62, 18, '#111014');
  rect(x - 25, y - 11, 50, 22, '#2d2430');
  rect(x - 18, y - 4, 36, 8, '#080b0d');
  rect(x - 37, y + 17, 13, 24, '#070709');
  rect(x + 24, y + 17, 13, 24, '#070709');
  rect(x - 24, y + 29, 12, 5, braking ? '#ff4b39' : '#b7362f');
  rect(x + 12, y + 29, 12, 5, braking ? '#ff4b39' : '#b7362f');
  rect(x - 27, y + 4, 54, 5, '#1b1718');
  if (braking) { rect(x - 33, y + 42, 17, 3, '#f0673b'); rect(x + 16, y + 42, 17, 3, '#f0673b'); }
}

function drawAlignmentGuide() {
  const dx = (game.droneLane - game.lane) * 42;
  const color = Math.abs(dx) < 14 ? '#d9f0a3' : '#d9b45d';
  rect(84, 103, 12, 2, '#2b2f1a');
  rect(90 + clamp(dx, -44, 44) - 3, 100, 6, 6, color);
}

function postGrade() {
  rect(0, 0, VW, 8, '#000000');
  ctx.globalAlpha = .23;
  rect(0, 0, 12, VH, '#000000');
  rect(VW - 12, 0, 12, VH, '#000000');
  rect(0, VH - 26, VW, 26, '#000000');
  ctx.globalAlpha = 1;
}

function render() {
  clear();
  if (game.shake > 0) ctx.translate(Math.round(rand(-1, 1) * game.shake * 2), Math.round(rand(-1, 1) * game.shake * 2));
  drawSky();
  drawFieldBase();
  drawCliff();
  drawTrail();
  drawCorn();
  drawDust();
  drawDrone();
  drawAlignmentGuide();
  drawCar();
  postGrade();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (state === 'menu' || state === 'brief' || state === 'pause' || state === 'end') {
    ctx.globalAlpha = state === 'pause' ? .45 : .28;
    rect(0, 0, VW, VH, '#000000');
    ctx.globalAlpha = 1;
  }
}

function loop(t) {
  const dt = Math.min(0.033, (t - last) / 1000 || 0);
  last = t;
  if (state !== 'play') {
    game.clock += dt;
    game.fieldOffset += dt * 16;
    game.droneLane = Math.sin(game.clock * 0.42) * 0.72;
  }
  update(dt);
  render();
  requestAnimationFrame(loop);
}

show('menu');
requestAnimationFrame(loop);
