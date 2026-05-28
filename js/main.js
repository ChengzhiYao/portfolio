/* =====================================================
   JESTAZ. — v4 interaction engine
   - Custom cursor with hover/drag states
   - Magnetic hover for [data-magnet] elements
   - Horizontal scroll: wheel + drag + keyboard
   - Live HUD clock + tick
   ===================================================== */
(function () {
  'use strict';

  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
  const isFinePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----------------- LOADER
  const loader = document.querySelector('.loader');
  const hideLoader = () => loader && setTimeout(() => loader.classList.add('is-hidden'), 280);

  // ----------------- MOBILE MENU
  const navBtn = document.querySelector('.hud__menu-btn');
  const navLinks = document.querySelector('.hud-tr .hud__nav');
  if (navBtn && navLinks) {
    navBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('is-open');
      navBtn.textContent = open ? 'Close' : 'Menu';
      document.body.classList.toggle('no-scroll', open);
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navBtn.textContent = 'Menu';
      document.body.classList.remove('no-scroll');
    }));
  }

  // ----------------- LIVE HUD CLOCK (NYC time)
  const clockEl = document.querySelector('[data-clock]');
  if (clockEl) {
    const tick = () => {
      const now = new Date();
      // Format: NYC time HH:MM:SS
      const t = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      clockEl.textContent = t;
    };
    tick();
    setInterval(tick, 1000);
  }

  // ----------------- CUSTOM CURSOR (desktop only, ALL pages)
  let cursor = null;
  if (isFinePointer() && !isMobile()) {
    cursor = document.createElement('div');
    cursor.className = 'cursor';
    document.body.appendChild(cursor);
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let tx = cx, ty = cy;
    // Show on first mouse move (avoids the "stuck in corner" look on page load)
    let visible = false;
    const cursorTick = () => {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(cursorTick);
    };
    cursorTick();
    window.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!visible) {
        cursor.style.opacity = '1';
        visible = true;
      }
    }, { passive: true });
    cursor.style.opacity = '0';
    cursor.style.transition = 'opacity .2s, width .25s var(--ease-out), height .25s var(--ease-out), border-color .25s, background-color .25s';

    // Hide cursor when leaving viewport (so it doesn't get stuck at edge)
    document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; visible = false; });
    document.addEventListener('mouseenter', () => { cursor.style.opacity = '1'; visible = true; });

    const hoverables = 'a, button, [role="button"], [data-magnet], .selected-card, .featured__media-main, .featured-intro__row, .selected-card__cta, .featured__cta, .featured__link, .contact__cta, .hud__chip, .proj-nav__links a';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest && e.target.closest(hoverables)) cursor.classList.add('is-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest && e.target.closest(hoverables)) cursor.classList.remove('is-hover');
    });
  }

  // ----------------- MAGNETIC HOVER (ALL pages)
  if (isFinePointer() && !isMobile()) {
    document.querySelectorAll('[data-magnet]').forEach(el => {
      const strength = parseFloat(el.dataset.magnet) || 0.25;
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
        const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  // ----------------- HORIZONTAL SCROLL
  const track = document.querySelector('.h-scroll__track');
  const wrap = document.querySelector('.h-scroll');
  // Filter out panels that are hidden (display:none / aria-hidden) — keeps scroll
  // math correct when a panel is retired but its DOM is still present.
  const panels = track
    ? Array.from(track.children).filter(el => {
        if (el.getAttribute('aria-hidden') === 'true') return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      })
    : [];
  const progressFill = document.querySelector('.scroll-readout .rail');
  const progressCount = document.querySelector('.scroll-readout .count');

  if (!track || !wrap || panels.length === 0) { hideLoader(); return; }

  let targetX = 0, currentX = 0, maxScroll = 0, panelWidth = 0, rafId = null, mobileMode = false;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const setLayout = () => {
    mobileMode = isMobile();
    if (mobileMode) {
      track.style.transform = '';
      track.style.width = '';
      document.body.classList.add('scroll-vertical');
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      return;
    }
    document.body.classList.remove('scroll-vertical');
    panelWidth = window.innerWidth;
    const totalWidth = panelWidth * panels.length;
    track.style.width = totalWidth + 'px';
    maxScroll = totalWidth - panelWidth;
    targetX = clamp(targetX, 0, maxScroll);
    currentX = targetX;
    track.style.transform = `translate3d(${-currentX}px, 0, 0)`;
    updateProgress();
    if (!rafId) tick();
  };

  const updateProgress = () => {
    const p = maxScroll > 0 ? (currentX / maxScroll) : 0;
    if (progressFill) progressFill.parentElement.style.setProperty('--p', (p * 100).toFixed(2) + '%');
    if (progressCount) {
      const idx = Math.round((currentX / panelWidth)) + 1;
      const c = clamp(idx, 1, panels.length);
      progressCount.innerHTML = `<strong>${String(c).padStart(3,'0')}</strong> <span class="max">/ ${String(panels.length).padStart(3,'0')}</span>`;
    }
  };

  const tick = () => {
    const damp = prefersReducedMotion() ? 1 : 0.22;
    currentX += (targetX - currentX) * damp;
    if (Math.abs(targetX - currentX) < 0.4) currentX = targetX;
    track.style.transform = `translate3d(${-currentX}px, 0, 0)`;
    updateProgress();
    rafId = requestAnimationFrame(tick);
  };

  // WHEEL
  window.addEventListener('wheel', (e) => {
    if (mobileMode) return;
    const dy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    targetX = clamp(targetX + dy * 1.4, 0, maxScroll);
    e.preventDefault();
  }, { passive: false });

  // TOUCH (tablet/landscape)
  let touchY = 0, touchX = 0;
  window.addEventListener('touchstart', (e) => {
    if (mobileMode) return;
    touchY = e.touches[0].clientY; touchX = e.touches[0].clientX;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (mobileMode) return;
    const dy = touchY - e.touches[0].clientY;
    const dx = touchX - e.touches[0].clientX;
    const d = Math.abs(dy) > Math.abs(dx) ? dy : dx;
    targetX = clamp(targetX + d * 1.6, 0, maxScroll);
    touchY = e.touches[0].clientY; touchX = e.touches[0].clientX;
    e.preventDefault();
  }, { passive: false });

  // KEYBOARD
  window.addEventListener('keydown', (e) => {
    if (mobileMode) return;
    const inField = ['INPUT','TEXTAREA'].includes((e.target.tagName||'').toUpperCase());
    if (inField) return;
    const big = panelWidth, small = panelWidth * 0.4;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { targetX = clamp(targetX + big, 0, maxScroll); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { targetX = clamp(targetX - big, 0, maxScroll); e.preventDefault(); }
    else if (e.key === 'Home') { targetX = 0; e.preventDefault(); }
    else if (e.key === 'End') { targetX = maxScroll; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { targetX = clamp(targetX + small, 0, maxScroll); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { targetX = clamp(targetX - small, 0, maxScroll); e.preventDefault(); }
    else if (e.key === ' ') { targetX = clamp(targetX + big * 0.85, 0, maxScroll); e.preventDefault(); }
  });

  // MOUSE DRAG
  let isDown = false, downX = 0, dragStartTarget = 0, lastMoveX = 0, lastMoveT = 0, velocity = 0, didDrag = false;

  wrap.addEventListener('mousedown', (e) => {
    if (mobileMode) return;
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest('a, button, [role="button"], input, textarea, select, video')) return;
    isDown = true; didDrag = false;
    downX = e.clientX; dragStartTarget = targetX;
    lastMoveX = e.clientX; lastMoveT = performance.now();
    velocity = 0;
    document.body.classList.add('is-dragging');
    if (cursor) cursor.classList.add('is-drag');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const dx = e.clientX - downX;
    if (Math.abs(dx) > 4) didDrag = true;
    targetX = clamp(dragStartTarget - dx, 0, maxScroll);
    const now = performance.now();
    const dt = now - lastMoveT || 1;
    velocity = (e.clientX - lastMoveX) / dt;
    lastMoveX = e.clientX; lastMoveT = now;
  });

  const finishDrag = () => {
    if (!isDown) return;
    isDown = false;
    document.body.classList.remove('is-dragging');
    if (cursor) cursor.classList.remove('is-drag');
    if (Math.abs(velocity) > 0.15) {
      const flung = -velocity * 220;
      targetX = clamp(targetX + flung, 0, maxScroll);
    }
  };
  window.addEventListener('mouseup', finishDrag);
  window.addEventListener('mouseleave', finishDrag);

  wrap.addEventListener('click', (e) => {
    if (didDrag) { e.preventDefault(); e.stopPropagation(); didDrag = false; }
  }, true);

  // ANCHOR JUMPS
  document.querySelectorAll('a[data-jump]').forEach(a => {
    a.addEventListener('click', (e) => {
      const sel = a.getAttribute('data-jump');
      const target = document.querySelector(sel);
      if (!target) return;
      e.preventDefault();
      if (mobileMode) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else {
        const idx = panels.indexOf(target);
        if (idx >= 0) targetX = clamp(idx * panelWidth, 0, maxScroll);
      }
    });
  });

  window.addEventListener('resize', setLayout);
  if (document.readyState === 'complete') { setLayout(); hideLoader(); }
  else window.addEventListener('load', () => { setLayout(); hideLoader(); });
})();
