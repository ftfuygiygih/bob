'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const dir = (...p) => path.join(__dirname, ...p);
// Тексты читаются как есть (убирается только BOM файла).
const text = f => { try { return fs.readFileSync(dir('texts', f), 'utf8').replace(/^\uFEFF/, ''); } catch { return ''; } };
const isAlt = req => /(?:^|;\s*)mode=alt(?:;|$)/.test(req.headers.cookie || '');
const json = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

app.get('/', (req, res) => {
  const alt = isAlt(req);
  // В альтернативном состоянии обычные тексты на клиент вообще не отправляются.
  const boot = alt
    ? { mode: 'alt', main: text('4.txt'), water: text('water2.txt') }
    : {
        mode: 'normal',
        water: text('water.txt'),
        sections: { bob: text('1.txt'), channel: text('2.txt'), chat: text('3.txt') },
        links: { channel: CONFIG.telegramChannel, chat: CONFIG.telegramChat }
      };
  const html = fs.readFileSync(dir('views', 'index.html'), 'utf8')
    .replace('{{MODE}}', alt ? 'alt' : 'normal')
    .replace('{{BOOT}}', () => json(boot));
  res.set({ 'Cache-Control': 'no-store', Vary: 'Cookie' }).type('html').send(html);
});

app.get('/sagaklores', (req, res) => {
  res.set('Cache-Control', 'no-store').sendFile(dir('views', 'sagaklores.html'));
});

// Активация — индивидуальная: cookie на год у конкретного посетителя.
app.post('/api/activate', (req, res) => {
  res.cookie('mode', 'alt', { maxAge: 31536000000, httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' });
  res.sendStatus(204);
});

app.use(express.static(dir('public'), { index: false, maxAge: '1h' }));
app.use((req, res) => res.status(404).type('text').send('Not found'));

app.listen(process.env.PORT || 3000, () => console.log('Server started'));
