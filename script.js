/* =========================================================================
   Wavenly

   Independent pieces, each guarded so a missing section never takes the rest
   of the page down with it:
     1. Drawer navigation
     2. The inquiry path explorer (tablist)
     3. Budget builder
     4. Review form validation
     5. Closing CTA + signup dialog
     6. Eased wheel scrolling
     7. Scan highlights
   ========================================================================= */

(() => {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ── 1. Drawer ───────────────────────────────────────────────────────── */

  const initDrawer = () => {
    const toggle = $('.nav-toggle');
    const drawer = $('#site-drawer');
    if (!toggle || !drawer) return;

    // Everything the drawer covers, so it can leave the tab order while open.
    const behind = [$('#main'), $('.site-footer')].filter(Boolean);

    // The reveal circle grows out of the button itself, so the origin has to
    // track it across breakpoints.
    const setOrigin = () => {
      const { left, top, width, height } = toggle.getBoundingClientRect();
      drawer.style.setProperty('--origin-x', `${left + width / 2}px`);
      drawer.style.setProperty('--origin-y', `${top + height / 2}px`);
    };

    const isOpen = () => document.body.classList.contains('nav-open');
    let parked = 0;   // scroll position held while the drawer covers the page

    const setMenu = (open) => {
      if (open) setOrigin();
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      behind.forEach((el) => { el.inert = open; });
      // The drawer's own `visibility` only flips after the close transition
      // finishes, which would leave its links tabbable for that window.
      drawer.inert = !open;

      // Hold the page still, padding out the width the scrollbar gives up so
      // nothing shifts sideways as the drawer opens.
      const gap = window.innerWidth - document.documentElement.clientWidth;

      if (open) {
        // Defensive, not a fix for an observed break: desktop Chrome holds the
        // position fine, but overflow:hidden scroll-locking is known to drop it
        // on iOS Safari. Cheap to park it and put it back.
        parked = window.scrollY;
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = gap > 0 ? `${gap}px` : '';
      } else {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        window.scrollTo({ top: parked, behavior: 'instant' });
      }
    };

    drawer.inert = true;   // closed on load
    toggle.addEventListener('click', () => setMenu(!isOpen()));
    $$('a', drawer).forEach((a) => a.addEventListener('click', () => setMenu(false)));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        setMenu(false);
        toggle.focus();
      }
    });

    window.addEventListener('resize', () => { if (isOpen()) setOrigin(); });
  };

  /* ── 2. Inquiry path explorer ────────────────────────────────────────── */

  const initExplorer = () => {
    const track = $('.path-track');
    if (!track) return;

    const tabs = $$('[role="tab"]', track);
    if (!tabs.length) return;

    const panelFor = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

    const select = (tab, { focus = false } = {}) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;               // roving tabindex
        const panel = panelFor(t);
        if (panel) panel.hidden = !on;
      });
      if (focus) {
        tab.focus();
        // Keep the active stop in view when the track scrolls on narrow screens.
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));

      tab.addEventListener('keydown', (e) => {
        const moves = {
          ArrowRight: i + 1,
          ArrowDown:  i + 1,
          ArrowLeft:  i - 1,
          ArrowUp:    i - 1,
          Home: 0,
          End: tabs.length - 1,
        };
        const next = moves[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length], { focus: true });
      });
    });
  };

  /* ── 3. Budget builder ───────────────────────────────────────────────── */

  const initBudget = () => {
    const range = $('#budget-range');
    const input = $('#budget-input');
    const hint  = $('#budget-hint');
    const cta   = $('#budget-cta');
    if (!range || !input || !hint) return;

    const MIN = Number(range.min);
    const MAX = Number(range.max);

    // Upper bound -> what that money realistically buys. Deliberately honest
    // at the low end rather than promising a system we can't build for it.
    const BANDS = [
      [2000,     'Starter or Growth territory: a professional website with a working inquiry path and monthly management.'],
      [5000,     'A Pro build plus one or two connected workflows, like online booking, review requests, or lead follow-up.'],
      [10000,    'A website plus the systems around it: a real lead pipeline, automated follow-up, and tool integrations.'],
      [Infinity, 'A full custom system: client portal, multi-step automation, and reporting built around how you actually work.'],
    ];

    const money = (n) => `$${n.toLocaleString('en-US')}`;
    const typed = () => Number(input.value.replace(/\D/g, ''));

    const apply = (value, { syncInput = true } = {}) => {
      const snapped = Math.round(value / 100) * 100;
      const clamped = Math.min(MAX, Math.max(MIN, snapped));

      range.value = clamped;
      range.style.setProperty('--fill', `${((clamped - MIN) / (MAX - MIN)) * 100}%`);
      range.setAttribute('aria-valuetext', money(clamped));
      if (syncInput) input.value = clamped.toLocaleString('en-US');
      hint.textContent = BANDS.find(([limit]) => clamped < limit)[1];
      return clamped;
    };

    range.addEventListener('input', () => apply(Number(range.value)));

    // Let people type freely; only snap and reformat the field once they leave it.
    input.addEventListener('input', () => {
      if (typed()) apply(typed(), { syncInput: false });
    });
    input.addEventListener('change', () => apply(typed() || MIN));

    if (cta) {
      cta.addEventListener('click', () => {
        const details = $('#field-details');
        if (!details) return;
        const line = `Custom system budget: ${money(apply(typed() || MIN))}`;
        const kept = details.value.replace(/^Custom system budget: .*$/m, '').trim();
        details.value = kept ? `${kept}\n${line}` : `${line}\n`;
      });
    }

    apply(Number(range.value));
  };

  /* ── 4. Review form ──────────────────────────────────────────────────── */

  const initForm = () => {
    const form = $('#review-form');
    if (!form) return;

    const status = $('#form-status', form);

    const RULES = {
      name:    (v) => v.trim().length >= 2 || 'Please tell us your name.',
      email:   (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Please enter a valid email address.',
      details: (v) => v.trim().length >= 3 || 'Please add your business name.',
    };

    const errorFor = (field) => document.getElementById(`err-${field.name}`);

    const showError = (field, message) => {
      const box = errorFor(field);
      field.setAttribute('aria-invalid', 'true');
      if (box) { box.textContent = message; box.hidden = false; }
    };

    const clearError = (field) => {
      const box = errorFor(field);
      field.removeAttribute('aria-invalid');
      if (box) { box.textContent = ''; box.hidden = true; }
    };

    const check = (field) => {
      const rule = RULES[field.name];
      if (!rule) return true;
      const result = rule(field.value);
      if (result === true) { clearError(field); return true; }
      showError(field, result);
      return false;
    };

    const fields = Object.keys(RULES)
      .map((name) => form.elements[name])
      .filter(Boolean);

    // Validate on the way out of a field, but only re-validate on input once
    // the field has already been marked wrong, so typing isn't nagged at.
    fields.forEach((field) => {
      field.addEventListener('blur', () => check(field));
      field.addEventListener('input', () => {
        if (field.getAttribute('aria-invalid') === 'true') check(field);
      });
    });

    // Used as a bot filter: a real person cannot read and fill this in 2s.
    const openedAt = Date.now();
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const bad = fields.filter((field) => !check(field));
      if (bad.length) {
        status.textContent = 'Please fix the highlighted fields.';
        status.removeAttribute('data-state');
        bad[0].focus();
        return;
      }

      submitBtn.disabled = true;
      status.removeAttribute('data-state');
      status.textContent = 'Sending…';

      try {
        const res = await fetch('/api/inquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.elements.name.value,
            email: form.elements.email.value,
            trade: form.elements.trade ? form.elements.trade.value : '',
            details: form.elements.details.value,
            company: form.elements.company ? form.elements.company.value : '',   // honeypot
            elapsed: Date.now() - openedAt,
          }),
        });
        const out = await res.json().catch(() => ({}));

        if (res.ok && out.ok) {
          status.textContent = 'Thanks. We have your details and will come back with your review shortly.';
          status.setAttribute('data-state', 'ok');
          form.reset();
          fields.forEach(clearError);
          submitBtn.textContent = 'Sent';
          return;
        }

        // Field-level errors from the server win over the generic message.
        if (out.errors) {
          Object.entries(out.errors).forEach(([name, message]) => {
            if (form.elements[name]) showError(form.elements[name], message);
          });
          status.textContent = 'Please fix the highlighted fields.';
        } else {
          status.textContent = out.error || 'That did not send. Email hello.wavenly@gmail.com and we will pick it up.';
        }
      } catch {
        // Offline, or the static site is running without the API behind it.
        status.textContent = 'Could not reach the server. Email hello.wavenly@gmail.com and we will pick it up.';
      }

      submitBtn.disabled = false;
    });
  };

  /* ── 5. Closing CTA + signup dialog ──────────────────────────────────── */

  const initCloser = () => {
    const dialog = $('#signup');
    const slot = $('[data-signup-slot]');
    const host = $('[data-signup-host]');
    const form = $('#review-form');

    // Rotating word. Independent of the dialog, so it runs either way.
    const rotate = $('.closer-rotate');
    if (rotate) {
      const words = (rotate.dataset.words || '').split('|').map((w) => w.trim()).filter(Boolean);
      const word = $('.closer-word', rotate);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (words.length > 1 && word && !reduced) {
        let i = 0;
        setInterval(() => {
          rotate.classList.add('is-out');
          // Swap at the top of the mask, once the outgoing word is hidden.
          setTimeout(() => {
            i = (i + 1) % words.length;
            word.textContent = words[i];
            rotate.classList.remove('is-out');
          }, 420);
        }, 2600);
      }
    }

    // Without <dialog> support the form stays inline and everything still works.
    if (!dialog || !slot || !host || !form || typeof dialog.showModal !== 'function') return;

    slot.appendChild(form);
    document.documentElement.classList.add('js-dialog');

    let opener = null;

    const open = (trigger) => {
      opener = trigger || null;
      dialog.showModal();
      const first = form.querySelector('input, select, textarea');
      if (first) first.focus();
    };

    const close = () => {
      dialog.close();
    };

    // Returning focus to whatever opened it is the part browsers do not do.
    dialog.addEventListener('close', () => {
      if (opener && document.contains(opener)) opener.focus();
      opener = null;
    });

    $$('[data-open-signup]').forEach((btn) =>
      btn.addEventListener('click', () => open(btn)));

    $$('[data-close-signup]').forEach((btn) =>
      btn.addEventListener('click', close));

    // Every existing "free review" link now opens the form instead of just
    // scrolling to a section whose form has moved into the dialog.
    $$('a[href="#review"]').forEach((link) =>
      link.addEventListener('click', (e) => {
        e.preventDefault();
        open(link);
      }));

    // Click on the backdrop. The dialog element fills only its own box, so a
    // click whose target is the dialog itself landed outside the panel.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });
  };

  /* ── 6. Eased wheel scrolling ────────────────────────────────────────── */

  /* Smooth-scroll libraries usually hijack every input, which is what breaks
     keyboard paging, find-in-page, scrollbar dragging and touch. This only
     intercepts the mouse wheel and leaves every other path native:

       - touch          untouched; phones already have momentum, and taking it
                        over also costs pull-to-refresh and address-bar hiding
       - keyboard       untouched (Space, PageDown, arrows, Home/End)
       - scrollbar drag untouched
       - find-in-page   untouched
       - anchor links   left to CSS scroll-behavior: smooth

     The rAF loop writes with behavior:'instant' so it is not double-animated
     by that same scroll-behavior rule. */

  const initSmoothScroll = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduced || coarse) return;

    const EASE = 0.12;          // fraction of the remaining distance per frame
    const SETTLE = 0.5;         // px below which we snap and stop

    let target = window.scrollY;
    let current = target;
    let running = false;

    const limit = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    // Any state where the page itself should not be moving.
    const blocked = () =>
      document.body.classList.contains('nav-open') ||
      document.body.style.overflow === 'hidden' ||
      !!document.querySelector('dialog[open]');

    const frame = () => {
      const delta = target - current;
      if (Math.abs(delta) < SETTLE) {
        current = target;
        window.scrollTo({ top: current, behavior: 'instant' });
        running = false;
        return;
      }
      current += delta * EASE;
      window.scrollTo({ top: current, behavior: 'instant' });
      requestAnimationFrame(frame);
    };

    const run = () => {
      if (running) return;
      running = true;
      requestAnimationFrame(frame);
    };

    // Wheel deltas arrive in pixels, lines or pages depending on the device.
    const toPixels = (e) => {
      if (e.deltaMode === 1) return e.deltaY * 16;              // lines
      if (e.deltaMode === 2) return e.deltaY * window.innerHeight; // pages
      return e.deltaY;
    };

    window.addEventListener('wheel', (e) => {
      if (blocked()) return;
      if (e.ctrlKey) return;                                    // pinch zoom
      // Horizontal intent belongs to whatever is under the pointer, such as
      // the path track, so let those gestures through untouched.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      e.preventDefault();
      target = Math.min(limit(), Math.max(0, target + toPixels(e)));
      run();
    }, { passive: false });

    // Any scroll we did not drive (keyboard, anchor, scrollbar, find-in-page)
    // has to re-seat the target, or the next wheel tick would jump back.
    window.addEventListener('scroll', () => {
      if (!running) {
        current = window.scrollY;
        target = current;
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      target = Math.min(target, limit());
    });
  };

  /* ── 7. Scan highlights ──────────────────────────────────────────────── */

  const initReveal = () => {
    const blocks = $$('[data-reveal]');
    if (!blocks.length) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Opting in here, rather than hiding by default in CSS, means a failure
    // anywhere in this function leaves the content plainly visible.
    if (reduced || !('IntersectionObserver' in window)) return;

    document.documentElement.classList.add('reveal-ready');

    // Each highlight in a block sweeps a beat after the one before it.
    blocks.forEach((block) => {
      $$('mark.hl', block).forEach((m, i) => m.style.setProperty('--hl-i', String(i)));
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);          // one-shot
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    blocks.forEach((block) => io.observe(block));
  };

  /* ── Boot ────────────────────────────────────────────────────────────── */

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  initDrawer();
  initExplorer();
  initBudget();
  initCloser();   // relocates the form, so it runs before initForm binds to it
  initForm();
  initReveal();
  initSmoothScroll();
})();
