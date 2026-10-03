(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, RM ? Math.min(ms, 30) : ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };

  addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
  if (document.body.dataset.page === 'home') home(); else gate();

  // Диагональный водяной знак: вписывается в диагональ экрана, может выходить за края.
  function watermark(text) {
    const box = document.getElementById('wm'), pre = box.firstElementChild;
    if (!text.trim()) { box.hidden = true; return null; }
    pre.textContent = text;
    const fit = () => {
      const w = innerWidth, h = innerHeight, d = Math.hypot(w, h);
      pre.style.fontSize = '100px';
      const k = Math.min(d * 0.95 / pre.offsetWidth, d * 0.5 / pre.offsetHeight);
      pre.style.fontSize = Math.max(12, Math.min(100 * k, Math.max(w, h) * 0.2)) + 'px';
      box.style.setProperty('--a', Math.min(50, Math.max(20, Math.atan2(h, w) * 180 / Math.PI)) + 'deg');
    };
    let q = 0;
    addEventListener('resize', () => { cancelAnimationFrame(q); q = requestAnimationFrame(fit); });
    fit();
    if (document.fonts) document.fonts.ready.then(fit);
    return box;
  }

  function home() {
    const boot = JSON.parse(document.getElementById('boot').textContent);
    const app = document.getElementById('app');
    const wm = watermark(boot.water || '');

    if (boot.mode === 'alt') {
      app.classList.add('alt');
      app.appendChild(el('p', 'alt-text', boot.main));
      (async () => {
        await wait(700); document.body.classList.add('ready');   // чёрный экран → 4.txt
        await wait(1600); if (wm) wm.classList.add('on');          // → water2.txt
      })();
      return;
    }

    const S = [['bob', '.боб'], ['channel', 'канал'], ['chat', 'чат']];
    const nav = el('nav', 'tabs'), pill = el('span', 'pill'), view = el('section', 'view');
    nav.setAttribute('aria-label', 'Разделы');
    view.setAttribute('aria-live', 'polite');
    nav.appendChild(pill);
    const btns = S.map(([k, label]) => {
      const b = el('button', 'tab', label);
      b.type = 'button'; b.dataset.k = k; b.onclick = () => open(k);
      nav.appendChild(b); return b;
    });
    app.append(nav, view);

    const place = b => { nav.style.setProperty('--x', b.offsetLeft + 'px'); nav.style.setProperty('--w', b.offsetWidth + 'px'); };
    let cur = null, ticket = 0;
    addEventListener('resize', () => { const b = btns.find(x => x.dataset.k === cur); if (b) place(b); });

    async function open(k) {
      if (k === cur) return;
      const id = ++ticket; cur = k;
      btns.forEach(b => { const on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); if (on) place(b); });
      pill.classList.add('show');

      if (view.firstChild) {                       // fade-out → очистка
        view.classList.remove('in'); view.classList.add('out');
        await wait(450); if (id !== ticket) return;
        view.replaceChildren();
      }
      view.classList.remove('out');

      const fig = el('div', 'avatar'), img = new Image();   // аватарка → текст
      img.alt = ''; img.decoding = 'async';
      img.onerror = () => img.remove();
      img.src = '/' + (S.findIndex(s => s[0] === k) + 1) + '.png';
      fig.appendChild(img);
      const kids = [fig], t = boot.sections[k] || '', url = (boot.links || {})[k];
      if (t.trim()) kids.push(el('p', 'text', t));
      if (url) {
        const a = el('a', 'tg', 'Telegram');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        kids.push(a);
      }
      view.replaceChildren(...kids);
      await frame(); if (id === ticket) view.classList.add('in');
    }

    (async () => {
      await wait(150); document.body.classList.add('ready');
      await wait(700); if (wm) wm.classList.add('on');
    })();
  }

  function gate() {
    const $ = id => document.getElementById(id);
    const lever = $('lever'), track = $('track'), knob = $('knob'), modal = $('modal'), yes = $('yes'), no = $('no');
    let p = 0, travel = 1, drag = null, locked = false, raf = 0;

    const set = v => {
      p = Math.min(1, Math.max(0, v));
      lever.style.setProperty('--y', p * travel + 'px');
      lever.style.setProperty('--p', p);
      knob.setAttribute('aria-valuenow', Math.round(p * 100));
    };
    const measure = () => { travel = track.clientHeight - knob.offsetHeight - 22; set(p); };

    const back = () => {                           // плавный возврат в 0%
      cancelAnimationFrame(raf);
      const from = p, t0 = performance.now(), dur = RM ? 1 : 260 + 640 * from;
      const step = now => {
        const t = Math.min(1, (now - t0) / dur);
        set(from * Math.pow(1 - t, 3));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const openModal = () => {
      modal.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => { modal.classList.add('open'); no.focus({ preventScroll: true }); }));
    };
    const reach = () => {                          // 100% → сначала предупреждение
      locked = true; drag = null; lever.classList.remove('drag');
      cancelAnimationFrame(raf); set(1); openModal();
    };

    knob.addEventListener('pointerdown', e => {
      if (locked) return;
      cancelAnimationFrame(raf);
      drag = { y: e.clientY, p };
      knob.setPointerCapture(e.pointerId);
      lever.classList.add('drag');
      e.preventDefault();
    });
    knob.addEventListener('pointermove', e => {
      if (!drag) return;
      set(drag.p + (e.clientY - drag.y) / travel);
      if (p >= 0.985) reach();
    });
    const end = () => { if (!drag) return; drag = null; lever.classList.remove('drag'); back(); };
    knob.addEventListener('pointerup', end);
    knob.addEventListener('pointercancel', end);

    knob.addEventListener('keydown', e => {        // клавиатура
      if (locked) return;
      const m = { ArrowDown: .12, ArrowRight: .12, ArrowUp: -.12, ArrowLeft: -.12 }[e.key];
      if (e.key === 'End') { e.preventDefault(); return reach(); }
      if (!m) return;
      e.preventDefault(); cancelAnimationFrame(raf); set(p + m);
      if (p >= 0.985) reach();
    });
    knob.addEventListener('keyup', () => { if (!locked && !drag) back(); });

    no.onclick = async () => {                     // ОТМЕНА: закрыть, вернуть рычаг, остаться
      modal.classList.remove('open'); locked = false; back();
      await wait(450); modal.hidden = true;
      knob.focus({ preventScroll: true });
    };
    addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) no.click(); });

    yes.onclick = async () => {                    // ПРОДОЛЖИТЬ: сохранить → fade-out → /
      yes.disabled = no.disabled = true;
      try {
        const r = await fetch('/api/activate', { method: 'POST', credentials: 'same-origin' });
        if (!r.ok) throw new Error();
      } catch (_) {
        document.cookie = 'mode=alt; max-age=31536000; path=/; samesite=lax';
      }
      document.body.classList.add('leave');
      await wait(1100);
      location.href = '/';
    };

    addEventListener('resize', measure);
    measure();
    requestAnimationFrame(() => document.body.classList.add('ready'));
  }
})();
