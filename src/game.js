import * as THREE from 'three';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('centerOverlay');
const hud = document.getElementById('hud');
const bestEl = document.getElementById('bestScore');
const feed = document.getElementById('missionLine');
const restartMini = document.getElementById('restartMini');
const copyMini = document.getElementById('copyMini');

const KEY = 'docking-run-webgl-best';
const keys = {};
const touch = { left: false, right: false, burn: false, dock: false };
const fmt = (n) => new Intl.NumberFormat('en-US').format(Math.round(n));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rand = (a, b) => a + Math.random() * (b - a);
const norm = (v) => {
  let n = (v + Math.PI) % (Math.PI * 2);
  if (n < 0) n += Math.PI * 2;
  return n - Math.PI;
};

let renderer, scene, camera, stars, disk, horizon, ship, station, trail;
let packets = [], debris = [];
let last = 0;
let mode = 'menu';
let g;

function best() { return Number(localStorage.getItem(KEY) || 0); }
function setBest(score) { if (score > best()) localStorage.setItem(KEY, String(score)); }
function bestUI() { bestEl.textContent = fmt(best()); }
function say(text) { feed.textContent = text; }

function init3d() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020713, 0.0012);
  camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 2500);
  camera.position.set(0, 18, 96);

  scene.add(new THREE.AmbientLight(0xaec7ff, 0.48));
  const blue = new THREE.PointLight(0x8cc8ff, 2.4, 800); blue.position.set(70, 60, 40); scene.add(blue);
  const warm = new THREE.PointLight(0xffc47d, 3.8, 600); warm.position.set(-30, 18, -10); scene.add(warm);

  makeStars(); makeHole(); makeShip(); makeStation(); makeTrail(); resize();
}

function makeStars() {
  const n = 4200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rand(280, 1700), a = rand(0, Math.PI * 2), y = rand(-420, 420);
    pos[i*3] = Math.cos(a) * r; pos[i*3+1] = y * .55; pos[i*3+2] = Math.sin(a) * r;
    const c = new THREE.Color().setHSL(rand(.56,.68), rand(.25,.7), rand(.65,1));
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.8, vertexColors: true, transparent: true, opacity: .96 }));
  scene.add(stars);
}

function makeHole() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv;uniform float time;float h(float n){return fract(sin(n)*43758.5);}float no(vec2 x){vec2 p=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);float n=p.x+p.y*57.0;return mix(mix(h(n),h(n+1.0),f.x),mix(h(n+57.0),h(n+58.0),f.x),f.y);}void main(){vec2 p=vUv*2.0-1.0;float r=length(p);float a=atan(p.y,p.x);float band=smoothstep(.95,.05,abs(r-.58));float wave=sin(a*10.0-time*2.2+r*15.0)*.5+.5;float d=no(vec2(a*2.0,r*9.0-time*.55));float hot=smoothstep(.25,.9,wave*.65+d*.7);vec3 c=mix(vec3(.08,.22,.62),vec3(1.0,.58,.22),hot);float alpha=band*clamp(1.22-r,0.0,1.0);gl_FragColor=vec4(c*(1.0+d*.8),alpha*.95);}`
  });
  disk = new THREE.Mesh(new THREE.RingGeometry(13, 36, 160, 24), mat);
  disk.rotation.x = Math.PI / 2.65;
  scene.add(disk);
  horizon = new THREE.Mesh(new THREE.SphereGeometry(15, 96, 96), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  scene.add(horizon);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(19, 96, 96), new THREE.MeshBasicMaterial({ color: 0xffcc8b, transparent: true, opacity: .11 }));
  scene.add(halo);
}

function makeShip() {
  ship = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f6ff, metalness: .75, roughness: .2, emissive: 0x0f2742, emissiveIntensity: .35 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 5.4, 8, 18), bodyMat); body.rotation.z = Math.PI / 2; ship.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.4, 24), bodyMat); nose.rotation.z = -Math.PI / 2; nose.position.x = 4; ship.add(nose);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x9fb6d4, metalness: .65, roughness: .28 });
  for (const y of [-1.45, 1.45]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(2.4,.16,1), finMat); fin.position.set(-.3,y,0); ship.add(fin); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.7, 3.4, 24), new THREE.MeshBasicMaterial({ color: 0xffb45c, transparent: true, opacity: .85 }));
  flame.name = 'flame'; flame.rotation.z = Math.PI / 2; flame.position.x = -5.2; ship.add(flame);
  scene.add(ship);
}

function makeStation() {
  station = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xddeaff, metalness: .85, roughness: .26, emissive: 0x10284a, emissiveIntensity: .55 });
  station.add(new THREE.Mesh(new THREE.TorusGeometry(8, .55, 16, 96), metal));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(12,.25,.25), metal); arm.rotation.z = a; station.add(arm);
    const pod = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.05,1.3), metal); pod.position.set(Math.cos(a)*12, Math.sin(a)*12, 0); pod.rotation.z = a; station.add(pod);
  }
  station.position.set(76, 7, -10); station.rotation.x = Math.PI / 2.4; scene.add(station);
}

function makeTrail() {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(240), 3));
  trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: .3 })); scene.add(trail);
}

function reset() {
  g = { time:0, max:82, fuel:100, hull:100, packets:0, bestMult:1, mult:1, orbit:88, theta:Math.PI+.15, speed:.38, y:7, dockReady:false, dockTime:22, dockAngle:0, dockSpin:0, stationAngle:0, grade:'Pending', bonus:0, result:null };
  makePackets(); makeDebris(); updateTrail(true); say('Launch ready. Recover data and approach the docking corridor.');
}

function makePackets() {
  packets.forEach(p => scene.remove(p.mesh)); packets = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + rand(-.22,.22), r = rand(24, 82);
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(rand(.6,1.25),0), new THREE.MeshStandardMaterial({ color:0x8fd4ff, emissive:0x58beff, emissiveIntensity:1.4, metalness:.25, roughness:.08 }));
    scene.add(mesh); packets.push({ mesh, a, r, live:true, bob:rand(0,6) });
  }
}
function makeDebris() {
  debris.forEach(d => scene.remove(d.mesh)); debris = [];
  for (let i = 0; i < 22; i++) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(.55,1.9),0), new THREE.MeshStandardMaterial({ color:0x7f8795, roughness:.9, metalness:.08 }));
    const a = rand(0, Math.PI*2), r = rand(32,105); scene.add(mesh); debris.push({ mesh, a, r, sp:rand(.18,.58), bob:rand(0,9) });
  }
}

function start() { reset(); mode = 'flight'; overlay.innerHTML = ''; }
function menu() { mode='menu'; overlay.innerHTML = `<div class="overlay-card"><h2>Cinematic Singularity Run</h2><p>Skim the gravity well for a higher score multiplier, recover data packets, and finish with a precision docking sequence.</p><div class="overlay-actions"><button class="primary-button" id="launchButton">Launch Mission</button></div></div>`; document.getElementById('launchButton').onclick = start; }

function updateFlight(dt) {
  g.time += dt;
  const turn = (keys.a || keys.arrowleft || touch.left ? 1 : 0) - (keys.d || keys.arrowright || touch.right ? 1 : 0);
  const burn = keys.w || keys.arrowup || keys[' '] || touch.burn;
  if (burn && g.fuel > 0) { g.orbit = clamp(g.orbit - dt*10, 15, 96); g.speed += dt*.18; g.fuel = clamp(g.fuel - dt*12, 0, 100); }
  else g.orbit = clamp(g.orbit + dt*3.0, 15, 96);
  g.speed = clamp((g.speed - turn*dt*.1) * .998, .1, .85); g.theta += g.speed * dt; g.y = Math.sin(g.theta*1.7) * 5;
  g.mult = g.orbit < 22 ? 7 : g.orbit < 30 ? 5 : g.orbit < 40 ? 4 : g.orbit < 54 ? 3 : g.orbit < 70 ? 2 : 1; g.bestMult = Math.max(g.bestMult, g.mult);
  ship.position.set(Math.cos(g.theta)*g.orbit, g.y, Math.sin(g.theta)*g.orbit*.68); ship.rotation.set(.1, -.05, -g.theta + Math.PI/2);
  ship.getObjectByName('flame').visible = !!burn && g.fuel > 0;
  if (g.orbit < 18) damage(dt*16, 'Extreme tidal stress detected.');
  if (g.orbit < 14.8) return finish('Mission lost beyond the event horizon.');
  updatePackets(dt); updateDebris(dt); updateTrail(); updateCamera(dt);
  station.rotation.z += dt*.7; disk.rotation.z += dt*.18; disk.material.uniforms.time.value += dt; stars.rotation.y += dt*.0012;
  if (!g.dockReady && (g.time > 34 || g.packets >= 10)) { g.dockReady = true; say('Docking corridor available. Press Dock when ready.'); }
  if ((keys.e || keys.enter || touch.dock) && g.dockReady) { touch.dock = false; enterDock(); }
  if (g.time >= g.max) enterDock();
}

function updatePackets(dt) {
  for (const p of packets) if (p.live) {
    p.a += dt*.22; p.bob += dt*1.6; p.mesh.position.set(Math.cos(p.a)*p.r, Math.sin(p.bob)*2.2, Math.sin(p.a)*p.r*.56); p.mesh.rotation.x += dt; p.mesh.rotation.y += dt*1.3;
    if (p.mesh.position.distanceTo(ship.position) < 3.4) { p.live = false; p.mesh.visible = false; g.packets++; say(`Data packet recovered: ${g.packets}/16`); }
  }
}
function updateDebris(dt) {
  for (const d of debris) {
    d.a += dt*d.sp; d.mesh.position.set(Math.cos(d.a)*d.r, Math.sin(d.a*1.7+d.bob)*10, Math.sin(d.a)*d.r*.75); d.mesh.rotation.x += dt*.7; d.mesh.rotation.y += dt*1.1;
    if (d.mesh.position.distanceTo(ship.position) < 2.8) { damage(10, 'Debris strike detected.'); d.a += .8; d.r += 10; }
  }
}
function damage(n, text) { g.hull = clamp(g.hull - n, 0, 100); say(text); if (g.hull <= 0) finish('Mission failed. Hull integrity lost.'); }
function updateTrail(resetTrail=false) {
  const arr = trail.geometry.attributes.position.array;
  if (!resetTrail) for (let i = 79; i > 0; i--) { arr[i*3]=arr[(i-1)*3]; arr[i*3+1]=arr[(i-1)*3+1]; arr[i*3+2]=arr[(i-1)*3+2]; }
  for (let i = resetTrail ? 0 : 0; i < (resetTrail ? 80 : 1); i++) { arr[i*3]=ship.position.x; arr[i*3+1]=ship.position.y; arr[i*3+2]=ship.position.z; }
  trail.geometry.attributes.position.needsUpdate = true;
}
function updateCamera(dt) { const target = ship.position.clone().add(new THREE.Vector3(28, 10, 34)); camera.position.lerp(target, 1-Math.exp(-dt*2.2)); camera.lookAt(0,0,0); }

function enterDock() { mode='dock'; g.dockTime=22; g.dockAngle=0; g.dockSpin=0; g.stationAngle=station.rotation.z; say('Docking sequence armed. Match spin and alignment.'); }
function updateDock(dt) {
  g.time += dt; g.dockTime -= dt;
  const turn = (keys.a || keys.arrowleft || touch.left ? 1 : 0) - (keys.d || keys.arrowright || touch.right ? 1 : 0);
  const burn = keys.w || keys.arrowup || keys[' '] || touch.burn;
  g.dockSpin = (g.dockSpin - turn*dt*1.8) * .992; if (burn) g.dockSpin *= .985; g.dockAngle += g.dockSpin*dt; g.stationAngle += dt*1.18;
  station.position.lerp(new THREE.Vector3(14,0,0), 1-Math.exp(-dt*2)); station.rotation.set(Math.PI/2.15,.18,g.stationAngle);
  ship.position.lerp(new THREE.Vector3(-16,0,7), 1-Math.exp(-dt*2.3)); ship.rotation.set(.06,.08,g.dockAngle+.18); ship.getObjectByName('flame').visible = !!burn;
  camera.position.lerp(new THREE.Vector3(2,6,40), 1-Math.exp(-dt*2.1)); camera.lookAt(0,0,0);
  disk.material.uniforms.time.value += dt; disk.rotation.z += dt*.18;
  if ((keys.e || keys.enter || touch.dock)) { touch.dock=false; resolveDock(); }
  if (g.dockTime <= 0) { g.grade='Failed'; g.bonus=0; finish('Docking window expired.'); }
}
function preview() { const a=Math.abs(norm(g.dockAngle-g.stationAngle)), s=Math.abs(g.dockSpin-1.18); return a<.12&&s<.18?'Perfect':a<.22&&s<.3?'Good':a<.38&&s<.5?'Stable':a<.58&&s<.8?'Rough':'Unsafe'; }
function resolveDock() { const p=preview(); g.grade = p==='Perfect'?'S':p==='Good'?'A':p==='Stable'?'B':p==='Rough'?'C':'Failed'; g.bonus = {S:12000,A:8000,B:4800,C:1600,Failed:0}[g.grade]; if (g.grade==='C') damage(8,'Hard contact during docking.'); if (g.grade==='Failed') damage(22,'Docking collision.'); finish(g.grade==='Failed'?'Docking failed.':'Docking confirmed.'); }
function finish(reason) { mode='score'; const score=Math.max(0,Math.round((g.packets*850+Math.min(g.time,g.max)*52+g.fuel*45+g.bonus)*g.bestMult-(100-g.hull)*95)); g.result={reason,score,grade:g.grade,data:g.packets,mult:g.bestMult,years:Math.max(1,Math.round(g.time*g.bestMult*.52)),fuel:Math.round(g.fuel),hull:Math.round(g.hull)}; setBest(score); bestUI(); showScore(); say(reason); }
function showScore() { const r=g.result; overlay.innerHTML = `<div class="overlay-card"><h2>${r.reason}</h2><p>Your mission scorecard is ready.</p><div class="overlay-grid"><div><span>Final Score</span><strong>${fmt(r.score)}</strong></div><div><span>Docking Grade</span><strong>${r.grade}</strong></div><div><span>Data</span><strong>${r.data}/16</strong></div><div><span>Dilation</span><strong>x${r.mult}</strong></div><div><span>Earth Time Lost</span><strong>${r.years} years</strong></div><div><span>Local Best</span><strong>${fmt(best())}</strong></div></div><div class="overlay-actions"><button class="primary-button" id="againButton">Run Again</button><button id="copyButton">Copy Scorecard</button></div><p id="copyStatus"></p></div>`; document.getElementById('againButton').onclick=start; document.getElementById('copyButton').onclick=copyScore; }
function scoreText() { if (!g?.result) return 'No score yet.'; const r=g.result; return [`I completed Docking Run.`,``,`Final Score: ${fmt(r.score)}`,`Docking Grade: ${r.grade}`,`Data Recovered: ${r.data}/16`,`Dilation Peak: x${r.mult}`,`Time Lost on Earth: ${r.years} years`,``,`Can you beat my run?`].join('\n'); }
async function copyScore() { try { await navigator.clipboard.writeText(scoreText()); const s=document.getElementById('copyStatus'); if (s) s.textContent='Scorecard copied.'; say('Scorecard copied.'); } catch { say('Copy failed on this browser.'); } }

function hudUI() { if (mode==='menu'||mode==='score') { hud.innerHTML=''; return; } const vals = mode==='flight' ? [['Time',`${Math.ceil(Math.max(0,g.max-g.time))}s`],['Fuel',`${Math.round(g.fuel)}%`],['Hull',`${Math.round(g.hull)}%`],['Data',`${g.packets}/16`],['Dilation',`x${g.mult}`],['Peak',`x${g.bestMult}`]] : [['Phase','Docking'],['Window',`${Math.ceil(g.dockTime)}s`],['Hull',`${Math.round(g.hull)}%`],['Fuel',`${Math.round(g.fuel)}%`],['Align',preview()],['Peak',`x${g.bestMult}`]]; hud.innerHTML=vals.map(([a,b])=>`<div class="hud-card"><span>${a}</span><strong>${b}</strong></div>`).join(''); }
function resize() { const w=canvas.clientWidth, h=canvas.clientHeight || w*9/16; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
function frame(t) { const dt=Math.min(.033,(t-last)/1000||.016); last=t; if (mode==='flight') updateFlight(dt); if (mode==='dock') updateDock(dt); horizon.scale.setScalar(1+Math.sin(t*.001)*.008); stars.rotation.y += dt*.0005; hudUI(); renderer.render(scene,camera); requestAnimationFrame(frame); }

function bind() {
  for (const [id,k] of [['btnLeft','left'],['btnRight','right'],['btnBurn','burn'],['btnDock','dock']]) { const b=document.getElementById(id); b.onpointerdown=e=>{e.preventDefault();touch[k]=true}; b.onpointerup=b.onpointercancel=b.onpointerleave=()=>touch[k]=false; }
  addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(mode==='menu'&&(e.key===' '||e.key==='Enter'))start();if(mode==='score'&&e.key.toLowerCase()==='r')start();});
  addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false); addEventListener('resize',resize);
  restartMini.onclick=start; copyMini.onclick=copyScore;
}

init3d(); reset(); bestUI(); bind(); menu(); requestAnimationFrame(frame);
