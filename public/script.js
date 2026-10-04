(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, RM ? Math.min(ms, 30) : ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };

  // Текст «печатается» потоком, как у нейросети: слова проявляются быстрыми порциями.
  const words = text => {
    const f = document.createDocumentFragment();
    text.split(/(\s+)/).forEach(s => { if (s) f.appendChild(/^\s+$/.test(s) ? document.createTextNode(s) : el('span', 't', s)); });
    return f;
  };
  const stream = (node, alive = () => true) => new Promise(done => {
    const ws = node.querySelectorAll('.t');
    if (RM || !ws.length) { ws.forEach(w => w.classList.add('on')); return done(); }
    const burst = Math.ceil(ws.length / 120);   // длинные тексты идут крупнее порциями (до ~3 с)
    let i = 0, last = null;
    (function tick() {
      if (!alive()) return done();
      for (let n = (1 + (Math.random() * 3 | 0)) * burst; n > 0 && i < ws.length; n--) ws[i++].classList.add('on');
      if (last) last.classList.remove('last');
      (last = ws[i - 1]).classList.add('last');
      if (i < ws.length) setTimeout(tick, 24 + Math.random() * 42); else { node.classList.add('done'); done(); }
    })();
  });

  // Водяной знак «раскалывается»: копии разлетаются из центра и дрейфуют вдоль диагонали.
  function swarm(box, mother, text) {
    const alt = document.documentElement.dataset.mode === 'alt';
    const n = innerWidth < 600 ? 10 : 18;
    let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const items = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1), line = !alt && i % 4 === 1, s = 0.12 + 0.4 * t * t, dur = 36 - 16 * t + rnd() * 8;
      const c = el('div', line ? 'c o' : 'c'), p = el('pre', '', text), v = (k, x) => c.style.setProperty(k, x);
      v('--px', ((0.5 + i * 0.7548776662) % 1) * 116 - 8);
      v('--py', ((0.5 + i * 0.5698402910) % 1) * 116 - 8);
      v('--j', (rnd() - 0.5) * 8);
      v('--o', alt ? 0.45 + 0.4 * t : line ? 0.14 + 0.1 * t : 0.03 + 0.06 * t);
      v('--b', (1 - t) * 2.2 + 'px');
      v('--i', i);
      p.style.setProperty('--d', 2 + 5 * t + 'vmin');
      p.style.animationDuration = dur + 's';
      p.style.animationDelay = -rnd() * dur + 's';
      c.appendChild(p); box.appendChild(c);
      return { c, p, s };
    });
    return mfs => items.forEach(({ c, p, s }) => {
      const fs = Math.max(12, mfs * s);
      p.style.fontSize = fs + 'px'; c.style.setProperty('--k', mfs / fs);
    });
  }

  // Состояние общее для всех: если оно изменилось, пока страница открыта, — плавно уходим в чёрный и перезагружаемся.
  function watch(isOn, busy = () => false) {
    let leaving = false;
    const check = async () => {
      if (leaving || document.hidden || busy()) return;
      try {
        const r = await fetch('/api/state', { cache: 'no-store' });
        if ((await r.json()).active === isOn) return;
        leaving = true;
        document.body.classList.add('leave');
        await wait(1000);
        location.reload();
      } catch (_) {}
    };
    setInterval(check, 6000);
    document.addEventListener('visibilitychange', check);
  }

  addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
  // мягкий свет за курсором (только мышь)
  function spotlight() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    addEventListener('pointermove', e => {
      document.body.style.setProperty('--mx', e.clientX + 'px');
      document.body.style.setProperty('--my', e.clientY + 'px');
    }, { passive: true });
  }
  if (document.body.dataset.page === 'home') home(); else gate();

  // Диагональный водяной знак: вписывается в диагональ экрана, может выходить за края.
  function watermark(text) {
    const box = document.getElementById('wm'), pre = box.firstElementChild;
    if (!text.trim()) { box.hidden = true; return null; }
    pre.textContent = text;
    const layout = swarm(box, pre, text);
    const fit = () => {
      const w = innerWidth, h = innerHeight, d = Math.hypot(w, h);
      pre.style.fontSize = '100px';
      const k = Math.min(d * 0.95 / pre.offsetWidth, d * 0.5 / pre.offsetHeight);
      const mfs = Math.max(12, Math.min(100 * k, Math.max(w, h) * 0.2));
      pre.style.fontSize = mfs + 'px'; layout(mfs);
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
    watch(boot.mode === 'alt');
    const app = document.getElementById('app');
    const wm = watermark(boot.water || '');

    if (boot.mode === 'alt') {
      app.classList.add('alt');
      const at = el('p', 'alt-text'); at.appendChild(words(boot.main)); app.appendChild(at);
      (async () => {
        await wait(700); document.body.classList.add('ready'); stream(at);   // чёрный экран → 4.txt
        await wait(1600); if (wm) wm.classList.add('on'); setTimeout(() => wm && wm.classList.add('split'), RM ? 30 : 2600);          // → water2.txt
      })();
      return;
    }

    const S = [['bob', '.боб'], ['channel', 'канал'], ['chat', 'чат'], ['iscream', 'айскремль'], ['velsio', 'велсио']];
    const order = S.map(s => s[0]).concat('creator');   // номер файла = позиция + 1
    const banner = el('div', 'banner'), bimg = new Image();
    const bready = new Promise(r => {   // пропорции баннера берутся из файла (не уже 2:1)
      bimg.onload = () => { banner.style.aspectRatio = Math.max(2, bimg.naturalWidth / bimg.naturalHeight); r(); };
      bimg.onerror = () => { bimg.remove(); r(); };
    });
    bimg.alt = ''; bimg.src = '/banner.png';
    banner.appendChild(bimg);
    const foot = el('footer', 'foot'), cb = el('button', 'creator', 'создатель');
    cb.type = 'button'; cb.dataset.k = 'creator'; cb.onclick = () => open('creator');
    foot.appendChild(cb);
    const nav = el('nav', 'tabs'), pill = el('span', 'pill'), view = el('section', 'view');
    nav.setAttribute('aria-label', 'Разделы');
    view.setAttribute('aria-live', 'polite');
    nav.appendChild(pill);
    const btns = S.map(([k, label]) => {
      const b = el('button', 'tab', label);
      b.type = 'button'; b.dataset.k = k; b.onclick = () => open(k);
      nav.appendChild(b); return b;
    });
    btns.push(cb);
    app.append(banner, nav, view, foot);

    const place = b => Object.entries({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight }).forEach(([n, v]) => nav.style.setProperty('--' + n, v + 'px'));
    let cur = null, ticket = 0;
    const fromHash = () => { const h = location.hash.slice(1); if (order.includes(h)) open(h); };
    addEventListener('hashchange', fromHash);
    const step = d => {                            // соседний раздел: свайп / стрелки
      if (cur === 'creator') return;
      const j = cur === null ? (d > 0 ? 0 : -1) : S.findIndex(s => s[0] === cur) + d;
      if (j >= 0 && j < S.length) open(S[j][0]);
    };
    let sw = null;                                 // свайп: влево — дальше, вправо — назад
    addEventListener('touchstart', e => {
      const t = e.touches[0];
      sw = e.touches.length === 1 && t.clientX > 24 && t.clientX < innerWidth - 24 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
    }, { passive: true });
    addEventListener('touchend', e => {
      if (!sw) return;
      const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, quick = Date.now() - sw.at < 700;
      sw = null;
      if (quick && Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? 1 : -1);
    }, { passive: true });
    addEventListener('keydown', e => { if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); });
    addEventListener('resize', () => { const b = btns.find(x => x.dataset.k === cur); if (b && b !== cb) place(b); });

    async function open(k) {
      if (k === cur) return;
      const id = ++ticket, dir = cur === null ? 0 : Math.sign(order.indexOf(k) - order.indexOf(cur));   // направление смены
      cur = k; view.style.setProperty('--dx', dir); history.replaceState(null, '', '#' + k);
      btns.forEach(b => { const on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); if (on && b !== cb) place(b); });
      pill.classList.toggle('show', k !== 'creator');

      if (view.firstChild) {                       // fade-out → очистка
        view.classList.remove('in', 'fin'); view.classList.add('out');
        await wait(450); if (id !== ticket) return;
        view.replaceChildren();
      }
      view.classList.remove('out');

      const fig = el('div', 'avatar'), img = new Image();   // аватарка → текст
      img.alt = ''; img.decoding = 'async';
      img.onerror = () => img.remove();
      img.src = '/' + (order.indexOf(k) + 1) + '.png';
      fig.appendChild(img);
      const kids = [fig], t = boot.sections[k] || '', url = (boot.links || {})[k];
      if (t.trim()) { const p = el('p', 'text'); p.appendChild(words(t)); kids.push(p); }
      if (url) {
        const a = el('a', 'tg', 'Telegram');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        kids.push(a);
      }
      view.replaceChildren(...kids);
      await frame(); if (id === ticket) view.classList.add('in');
      if (k === 'creator') scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
      await wait(650); if (id !== ticket) return;              // аватарка → текст → ссылка
      const tx = view.querySelector('.text');
      if (tx) await stream(tx, () => id === ticket);
      if (id === ticket) view.classList.add('fin');
    }

    (async () => {
      spotlight(); await Promise.race([bready, new Promise(r => setTimeout(r, 2000))]); await wait(150); document.body.classList.add('ready'); fromHash();
      await wait(1300); if (wm) wm.classList.add('on'); setTimeout(() => wm && wm.classList.add('split'), RM ? 30 : 2600);
    })();
  }

  function gate() {
    const $ = id => document.getElementById(id);
    const lever = $('lever'), track = $('track'), knob = $('knob'), modal = $('modal'), yes = $('yes'), no = $('no');
    const on = document.body.dataset.on === '1', rest = on ? 1 : 0, goal = 1 - rest;   // on — режим активен, рычаг внизу
    let p = rest, travel = 1, drag = null, locked = false, raf = 0, lastTick = 10 * rest;

    const set = v => {
      p = Math.min(1, Math.max(0, v));
      lever.style.setProperty('--y', p * travel + 'px');
      lever.style.setProperty('--p', p);
      knob.setAttribute('aria-valuenow', Math.round(p * 100));
      const tk = Math.floor(p * 10);                 // «щелчки» каждые 10%
      if (tk !== lastTick) { lastTick = tk; if (drag && navigator.vibrate) navigator.vibrate(6); }
    };
    const measure = () => { travel = track.clientHeight - knob.offsetHeight - 22; set(p); };

    const back = () => {                           // плавный возврат в 0%
      cancelAnimationFrame(raf);
      const from = p, t0 = performance.now(), dur = RM ? 1 : 260 + 640 * Math.abs(from - rest);
      const step = now => {
        const t = Math.min(1, (now - t0) / dur);
        set(rest + (from - rest) * Math.pow(1 - t, 3));
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
      cancelAnimationFrame(raf); set(goal);
      if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
      openModal();
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
      if (Math.abs(p - goal) <= 0.015) reach();
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
      if (Math.abs(p - goal) <= 0.015) reach();
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
        const r = await fetch(on ? '/api/deactivate' : '/api/activate', { method: 'POST', credentials: 'same-origin' });
        if (!r.ok) throw new Error();
      } catch (_) {
        yes.disabled = no.disabled = false; return no.click();
      }
      document.body.classList.add('leave');
      await wait(1100);
      location.href = '/';
    };

    addEventListener('resize', measure);
    measure();
    watch(on, () => !!drag || locked);
    requestAnimationFrame(() => document.body.classList.add('ready'));
  }
})();
