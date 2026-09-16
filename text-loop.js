/* =========================================================================
   TextLoop — text flowing along an SVG path.

   Ported from the React Bits <TextLoop /> component (React + GSAP) to plain
   JS for this project, which has no bundler and no dependencies. The geometry,
   prop names and defaults match the original; only the host framework differs.

     React                      here
     ─────────────────────────  ──────────────────────────────────────────
     props                      data-* attributes on the mount element
     useLayoutEffect measure    measure() after mount and after fonts load
     gsap.to(state, …)          requestAnimationFrame delta loop
     useId                      module-level counter

   GSAP was only tweening one number, so rAF replaces it exactly and keeps the
   page dependency-free.

   Usage:
     <div data-text-loop data-text="Built around the inquiry" data-speed="28"></div>

   Or: TextLoop.create(element, { text: '…', speed: 28 })
   ========================================================================= */

(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const VIEW_W = 1200;
  const VIEW_H = 520;
  const CX = VIEW_W / 2;
  const CY = VIEW_H / 2;
  const EDGE_PAD = 6;

  let uid = 0;

  /* ── Geometry (unchanged from the original) ──────────────────────────── */

  const buildPath = (shape, curviness, ribbonWidth) => {
    const c = Math.max(0, curviness);
    const room = Math.max(20, CY - Math.max(0, ribbonWidth) / 2 - EDGE_PAD);

    switch (shape) {
      case 'circle': {
        const r = Math.min(90 + c * 0.95, room);
        return `M ${CX - r} ${CY} A ${r} ${r} 0 1 1 ${CX + r} ${CY} A ${r} ${r} 0 1 1 ${CX - r} ${CY} Z`;
      }
      case 'infinity': {
        const r = 150 + c * 1.4;
        const h = Math.min(60 + c * 0.95, room);
        return [
          `M ${CX} ${CY}`,
          `C ${CX + r * 0.55} ${CY - h} ${CX + r} ${CY - h} ${CX + r} ${CY}`,
          `C ${CX + r} ${CY + h} ${CX + r * 0.55} ${CY + h} ${CX} ${CY}`,
          `C ${CX - r * 0.55} ${CY - h} ${CX - r} ${CY - h} ${CX - r} ${CY}`,
          `C ${CX - r} ${CY + h} ${CX - r * 0.55} ${CY + h} ${CX} ${CY}`,
          'Z'
        ].join(' ');
      }
      case 'arch': {
        const rise = Math.min(120 + c * 1.1, room * 2);
        return `M 120 ${CY + rise / 2} Q ${CX} ${CY - rise * 1.5} ${VIEW_W - 120} ${CY + rise / 2}`;
      }
      case 'line':
        return `M -320 ${CY} L ${VIEW_W + 320} ${CY}`;
      case 'wave':
      default: {
        const a = Math.min(c * 2.2, room * 2);
        return `M -320 ${CY} Q -160 ${CY - a} 0 ${CY} T 320 ${CY} T 640 ${CY} T 960 ${CY} T 1280 ${CY} T ${VIEW_W + 320} ${CY}`;
      }
    }
  };

  const DEFAULTS = {
    text: 'React ✦ Bits',
    shape: 'wave',
    path: undefined,
    speed: 90,
    direction: 'forward',
    separator: '✦',
    curviness: 90,
    fontSize: 46,
    fontWeight: 800,
    letterSpacing: 2,
    uppercase: true,
    color: '#ffffff',
    ribbon: true,
    ribbonColor: '#5227FF',
    ribbonWidth: 86,
    pauseOnHover: true
  };

  /* data-* values arrive as strings; coerce to each prop's declared type. */
  const readOptions = (el) => {
    const out = {};
    Object.keys(DEFAULTS).forEach((key) => {
      const attr = 'data-' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
      if (!el.hasAttribute(attr)) return;
      const raw = el.getAttribute(attr);
      const fallback = DEFAULTS[key];
      if (typeof fallback === 'number') {
        const n = Number(raw);
        if (Number.isFinite(n)) out[key] = n;
      } else if (typeof fallback === 'boolean') {
        out[key] = raw !== 'false';           // bare attribute means true
      } else {
        out[key] = raw;
      }
    });
    return out;
  };

  /* ── Instance ────────────────────────────────────────────────────────── */

  const create = (root, options = {}) => {
    if (!root || root.__textLoop) return root && root.__textLoop;

    const o = Object.assign({}, DEFAULTS, readOptions(root), options);
    const pathId = `text-loop-${++uid}`;
    const d = o.path || buildPath(o.shape, o.curviness, o.ribbonWidth);

    const base = o.uppercase ? String(o.text).toUpperCase() : String(o.text);
    const gap = o.separator ? ` ${o.separator} ` : '   ';
    const unit = `${base}${gap}`;

    root.classList.add('text-loop');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'text-loop-svg');
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', o.text);

    const pathEl = document.createElementNS(SVG_NS, 'path');
    pathEl.setAttribute('id', pathId);
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', o.ribbon ? o.ribbonColor : 'none');
    pathEl.setAttribute('stroke-width', o.ribbon ? o.ribbonWidth : 0);
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(pathEl);

    const applyTextStyle = (el) => {
      el.style.fontSize = `${o.fontSize}px`;
      el.style.fontWeight = String(o.fontWeight);
      el.style.letterSpacing = `${o.letterSpacing}px`;
    };

    // Hidden but laid out, so getComputedTextLength() can measure one unit.
    const measureEl = document.createElementNS(SVG_NS, 'text');
    measureEl.setAttribute('class', 'text-loop-measure');
    measureEl.setAttribute('aria-hidden', 'true');
    measureEl.textContent = unit;
    applyTextStyle(measureEl);
    svg.appendChild(measureEl);

    // Two copies half a lap apart, so one is always covering the seam.
    const makeRun = () => {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'text-loop-text');
      text.setAttribute('fill', o.color);
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('aria-hidden', 'true');
      text.setAttribute('lengthAdjust', 'spacing');
      applyTextStyle(text);

      const tp = document.createElementNS(SVG_NS, 'textPath');
      tp.setAttribute('href', `#${pathId}`);
      tp.setAttribute('startOffset', '0');
      text.appendChild(tp);
      svg.appendChild(text);
      return { text, tp };
    };

    const head = makeRun();
    const tail = makeRun();
    root.appendChild(svg);

    let length = 0;
    let offset = 0;
    let raf = null;
    let paused = false;
    let last = 0;

    const apply = (value) => {
      const partner = value >= 0 ? value - length : value + length;
      head.tp.setAttribute('startOffset', String(value));
      tail.tp.setAttribute('startOffset', String(partner));
    };

    const measure = () => {
      let total = 0;
      let unitWidth = 0;
      try {
        total = pathEl.getTotalLength();
        unitWidth = measureEl.getComputedTextLength();
      } catch {
        return;                                  // not laid out yet
      }
      if (!total) return;

      const reps = unitWidth > 0 ? Math.max(1, Math.round(total / unitWidth)) : 1;
      const loopText = unit.repeat(reps);

      length = total;
      [head, tail].forEach(({ text, tp }) => {
        tp.textContent = loopText;
        // Stretch the repeated run to exactly one lap so the tiling is seamless.
        text.setAttribute('textLength', String(total));
      });
      apply(offset);
    };

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);   // clamp after a tab switch
      last = now;
      if (!paused && length) {
        offset += (o.direction === 'reverse' ? -1 : 1) * o.speed * dt;
        if (offset > length) offset -= length;
        else if (offset < -length) offset += length;
        apply(offset);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf !== null) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (raf === null) return;
      cancelAnimationFrame(raf);
      raf = null;
    };

    const pause = () => { paused = true; };
    const resume = () => { paused = false; };

    if (o.pauseOnHover) {
      root.addEventListener('pointerenter', pause);
      root.addEventListener('pointerleave', resume);
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (reduced.matches || o.speed <= 0) {
        stop();
        offset = 0;
        apply(0);
      } else {
        start();
      }
    };

    measure();
    // Web fonts change the measured unit width, so measure again once they land.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    sync();

    if (reduced.addEventListener) reduced.addEventListener('change', sync);

    const instance = {
      el: root,
      measure,
      pause,
      resume,
      destroy() {
        stop();
        if (o.pauseOnHover) {
          root.removeEventListener('pointerenter', pause);
          root.removeEventListener('pointerleave', resume);
        }
        if (reduced.removeEventListener) reduced.removeEventListener('change', sync);
        svg.remove();
        delete root.__textLoop;
      }
    };

    root.__textLoop = instance;
    return instance;
  };

  const init = (ctx = document) =>
    [...ctx.querySelectorAll('[data-text-loop]')].map((el) => create(el));

  window.TextLoop = { create, init, buildPath, DEFAULTS };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
