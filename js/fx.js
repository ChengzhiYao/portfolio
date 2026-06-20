/* =====================================================
   JESTAZ. — fx layer v2 (visual spectacle, desktop only)
   1. WebGL flowing nebula background (fbm noise + gold veins + mouse glow)
   2. Interactive constellation dot-field (canvas 2D)
   3. Cinematic panel depth parallax on horizontal scroll
   4. 3D pointer-tilt + gold glare on cards
   5. Morphing cursor label
   Self-contained; degrades gracefully (mobile / reduced-motion / no-WebGL).
   ===================================================== */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine   = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const mobile = matchMedia('(max-width:900px)').matches;
  if (reduce || !fine || mobile) return;
  document.body.classList.add('fx-on');

  const mouse = { x: -9999, y: -9999, nx: 0.5, ny: 0.5 };
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = e.clientX / window.innerWidth; mouse.ny = e.clientY / window.innerHeight;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });

  /* ---------- 1. WEBGL NEBULA ---------- */
  (function nebula() {
    const c = document.createElement('canvas');
    c.id = 'fx-shader';
    document.body.appendChild(c);
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) { c.remove(); return; }
    const vs = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }';
    const fs = [
      'precision highp float;',
      'uniform float u_time; uniform vec2 u_res; uniform vec2 u_mouse;',
      'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
      'float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }',
      'float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=.5; } return v; }',
      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/u_res.xy;',
      '  vec2 p=uv*vec2(u_res.x/u_res.y,1.0);',
      '  float t=u_time*0.035;',
      '  vec2 q=vec2(fbm(p*1.4+t), fbm(p*1.4-t+5.2));',
      '  float f=fbm(p*2.0+q*1.6+t*0.5);',
      '  vec3 base=vec3(0.030,0.030,0.043);',
      '  vec3 gold=vec3(0.831,0.722,0.416);',
      '  float veins=smoothstep(0.52,0.95,f);',
      '  vec2 mo=u_mouse; mo.y=1.0-mo.y;',
      '  float md=distance(uv,mo);',
      '  float mglow=smoothstep(0.42,0.0,md)*0.10;',
      '  vec3 col=base + gold*veins*0.15 + gold*mglow;',
      '  col += (hash(uv*u_time)*0.012);',
      '  col *= smoothstep(1.25,0.25,length(uv-0.5));',
      '  gl_FragColor=vec4(col,1.0);',
      '}'
    ].join('\n');
    function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { c.remove(); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uT = gl.getUniformLocation(prog, 'u_time');
    const uR = gl.getUniformLocation(prog, 'u_res');
    const uM = gl.getUniformLocation(prog, 'u_mouse');
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      c.width = window.innerWidth * dpr; c.height = window.innerHeight * dpr;
      c.style.width = window.innerWidth + 'px'; c.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, c.width, c.height);
    }
    window.addEventListener('resize', size); size();
    const t0 = performance.now();
    let mx = 0.5, my = 0.5;
    (function draw() {
      mx += (mouse.nx - mx) * 0.05; my += (mouse.ny - my) * 0.05;
      gl.uniform1f(uT, (performance.now() - t0) / 1000);
      gl.uniform2f(uR, c.width, c.height);
      gl.uniform2f(uM, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(draw);
    })();
  })();

  /* ---------- 2. CONSTELLATION FIELD ---------- */
  const cv = document.createElement('canvas');
  cv.id = 'fx-field';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W, H, DPR, cols, rows, gap, dots = [];
  const ripples = [];
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    gap = Math.max(34, Math.round(Math.min(W, H) / 22));
    cols = Math.ceil(W / gap) + 1; rows = Math.ceil(H / gap) + 1;
    dots = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) dots.push({ x: i * gap, y: j * gap, ph: i * 0.6 + j * 0.9 });
  }
  window.addEventListener('resize', resize); resize();
  window.addEventListener('click', e => { ripples.push({ x: e.clientX, y: e.clientY, r: 0 }); });
  const R = 205; let t = 0;
  (function frame() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    const ox = mouse.x > -9000 ? (mouse.x - W / 2) * 0.012 : 0;
    const oy = mouse.y > -9000 ? (mouse.y - H / 2) * 0.012 : 0;
    for (let k = ripples.length - 1; k >= 0; k--) { ripples[k].r += 9; if (ripples[k].r > Math.max(W, H) * 1.1) ripples.splice(k, 1); }
    const active = [];
    for (const d of dots) {
      const sx = Math.sin(t * 0.7 + d.ph) * 1.6, sy = Math.cos(t * 0.6 + d.ph * 1.1) * 1.6;
      let px = d.x + sx + ox, py = d.y + sy + oy, infl = 0;
      const ddx = px - mouse.x, ddy = py - mouse.y, dist = Math.hypot(ddx, ddy);
      if (dist < R) { infl = 1 - dist / R; const f = infl * infl * 26; px += (ddx / dist) * f; py += (ddy / dist) * f; }
      for (const rp of ripples) { const rd = Math.abs(Math.hypot(px - rp.x, py - rp.y) - rp.r); if (rd < 28) infl = Math.max(infl, (1 - rd / 28) * 0.85); }
      const base = 0.17 + 0.10 * Math.sin(t * 0.9 + d.ph), a = Math.min(base + infl * 0.95, 1), size = 1.05 + infl * 2.6;
      ctx.fillStyle = infl > 0.04 ? 'rgba(212,184,106,' + a + ')' : 'rgba(154,154,168,' + (a * 0.62) + ')';
      ctx.beginPath(); ctx.arc(px, py, size, 0, 6.2832); ctx.fill();
      if (infl > 0.17) active.push({ x: px, y: py, infl });
    }
    const linkMax = (gap * 1.7) * (gap * 1.7);
    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      ctx.strokeStyle = 'rgba(212,184,106,' + (a.infl * 0.6) + ')'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j], dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < linkMax) { ctx.strokeStyle = 'rgba(212,184,106,' + (Math.min(a.infl, b.infl) * 0.32) + ')'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
    }
    requestAnimationFrame(frame);
  })();

  /* ---------- 3. PANEL DEPTH PARALLAX ---------- */
  (function parallax() {
    const track = document.querySelector('.h-scroll__track');
    const panels = track ? Array.from(track.querySelectorAll('.panel')) : [];
    if (!track || !panels.length) return;
    panels.forEach(p => { p.style.transformOrigin = 'center center'; p.style.willChange = 'transform, opacity'; });
    (function tick() {
      let tx = 0;
      const m = getComputedStyle(track).transform;
      if (m && m !== 'none') { const mm = m.match(/matrix.*\((.+)\)/); if (mm) { const v = mm[1].split(', '); tx = parseFloat(v.length > 6 ? v[12] : v[4]) || 0; } }
      const vw = window.innerWidth;
      for (let i = 0; i < panels.length; i++) {
        const center = i * vw + vw / 2 + tx;
        const dist = Math.min(Math.abs(center - vw / 2) / vw, 1);
        const sc = 1 - dist * 0.035;
        const op = 1 - Math.max(dist - 0.45, 0) * 0.36;
        panels[i].style.transform = 'scale(' + sc.toFixed(4) + ')';
        panels[i].style.opacity = op.toFixed(3);
      }
      requestAnimationFrame(tick);
    })();
  })();

  /* ---------- 4. 3D TILT + GLARE ---------- */
  document.querySelectorAll('.selected-card, .featured__media-main').forEach(card => {
    const glare = document.createElement('span');
    glare.className = 'fx-glare';
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
    card.appendChild(glare);
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.transform = 'perspective(950px) rotateX(' + ((0.5 - py) * 7.5) + 'deg) rotateY(' + ((px - 0.5) * 9.5) + 'deg) translateY(-5px)';
      glare.style.setProperty('--gx', (px * 100) + '%'); glare.style.setProperty('--gy', (py * 100) + '%');
      card.classList.add('is-tilt');
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.classList.remove('is-tilt'); });
  });

  /* ---------- 5. MORPHING CURSOR LABEL ---------- */
  const label = document.createElement('div');
  label.className = 'fx-cursor-label';
  document.body.appendChild(label);
  window.addEventListener('mousemove', e => { label.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(16px,16px)'; }, { passive: true });
  const map = [['.selected-card', 'VIEW'], ['.featured__media-main', 'VIEW'], ['.contact__cta', 'SAY HI'], ['.featured__cta', 'OPEN'], ['.featured__link', 'OPEN']];
  document.addEventListener('mouseover', e => {
    if (!e.target.closest) return;
    for (const [sel, txt] of map) { if (e.target.closest(sel)) { label.textContent = txt; label.classList.add('show'); return; } }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest && e.target.closest('.selected-card, .featured__media-main, .contact__cta, .featured__cta, .featured__link')) label.classList.remove('show');
  });
})();

/* =====================================================
   HERO ENTRANCE CHOREOGRAPHY (independent, guarded)
   ===================================================== */
(function intro() {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(max-width:900px)').matches) return;
  const hero = document.querySelector('.panel--hero');
  if (!hero) return;
  document.body.classList.add('fx-intro');
  const groups = [
    document.querySelector('.hud-tl'),
    document.querySelector('.hud-tr'),
    document.querySelector('.panel--hero .panel__index'),
    document.querySelector('.panel--hero .panel__edge'),
    document.querySelector('.panel--hero .panel__ruler'),
    document.querySelector('.hero__status')
  ];
  document.querySelectorAll('.hero__meta-cell').forEach(c => groups.push(c));
  groups.push(document.querySelector('.hero__sub'));
  groups.push(document.querySelector('.hud-bl'));
  groups.push(document.querySelector('.hud-br'));
  const els = groups.filter(Boolean);
  const sweep = document.createElement('div');
  sweep.className = 'fx-sweep';
  hero.appendChild(sweep);
  let done = false;
  function reveal() {
    if (done) return; done = true;
    document.body.classList.add('fx-revealed');
    els.forEach((el, i) => {
      el.style.transition = 'opacity .85s var(--ease-out), transform .85s var(--ease-out)';
      el.style.transitionDelay = (0.12 + i * 0.06) + 's';
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    sweep.classList.add('run');
    setTimeout(() => sweep.remove(), 1700);
  }
  const loader = document.querySelector('.loader');
  if (loader && !loader.classList.contains('is-hidden')) {
    const mo = new MutationObserver(() => { if (loader.classList.contains('is-hidden')) { mo.disconnect(); setTimeout(reveal, 160); } });
    mo.observe(loader, { attributes: true, attributeFilter: ['class'] });
    setTimeout(reveal, 1900); // safety fallback
  } else {
    setTimeout(reveal, 220);
  }
})();

/* =====================================================
   HERO TITLE — character decode (independent, guarded)
   ===================================================== */
(function titleDecode() {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(max-width:900px)').matches) return;
  const title = document.querySelector('.hero__title');
  if (!title) return;
  const inners = Array.prototype.slice.call(title.querySelectorAll('.reveal-inner'));
  if (!inners.length) return;
  inners.forEach(el => { el.style.animation = 'none'; el.style.transform = 'none'; el.style.opacity = '1'; });
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/[]{}=';
  const units = [];
  inners.forEach(inner => {
    inner.childNodes.forEach(n => {
      if (n.nodeType === 3) units.push({ node: n, final: n.nodeValue });
      else if (n.nodeType === 1) n.childNodes.forEach(t => { if (t.nodeType === 3) units.push({ node: t, final: t.nodeValue }); });
    });
  });
  const rnd = () => glyphs[Math.floor(Math.random() * glyphs.length)];
  units.forEach(u => { u.node.nodeValue = u.final.replace(/[^ ]/g, rnd); });
  function run() {
    const start = performance.now(), dur = 950;
    (function step(now) {
      const p = Math.min((now - start) / dur, 1);
      units.forEach(u => {
        const lock = Math.floor(p * u.final.length * 1.25);
        let s = '';
        for (let i = 0; i < u.final.length; i++) {
          const ch = u.final[i];
          s += (ch === ' ') ? ' ' : (i < lock ? ch : rnd());
        }
        u.node.nodeValue = s;
      });
      if (p < 1) requestAnimationFrame(step);
      else units.forEach(u => u.node.nodeValue = u.final);
    })(start);
  }
  const loader = document.querySelector('.loader');
  if (loader && !loader.classList.contains('is-hidden')) {
    const mo = new MutationObserver(() => { if (loader.classList.contains('is-hidden')) { mo.disconnect(); setTimeout(run, 200); } });
    mo.observe(loader, { attributes: true, attributeFilter: ['class'] });
    setTimeout(run, 1950);
  } else setTimeout(run, 240);
})();

/* =====================================================
   PER-PANEL CONTENT REVEAL ON CENTERING (guarded)
   ===================================================== */
(function panelReveal() {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(max-width:900px)').matches) return;
  const track = document.querySelector('.h-scroll__track');
  const panels = track ? Array.prototype.slice.call(track.querySelectorAll('.panel')) : [];
  if (!panels.length) return;
  panels.forEach(p => { if (!p.classList.contains('panel--hero')) p.classList.add('fx-panel'); });
  const seen = new WeakSet();
  (function tick() {
    let tx = 0;
    const m = getComputedStyle(track).transform;
    if (m && m !== 'none') { const mm = m.match(/matrix.*\((.+)\)/); if (mm) { const v = mm[1].split(', '); tx = parseFloat(v.length > 6 ? v[12] : v[4]) || 0; } }
    const vw = window.innerWidth;
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      if (!p.classList.contains('fx-panel') || seen.has(p)) continue;
      const center = i * vw + vw / 2 + tx;
      if (Math.abs(center - vw / 2) < vw * 0.55) { seen.add(p); p.classList.add('fx-panel-in'); }
    }
    requestAnimationFrame(tick);
  })();
})();
