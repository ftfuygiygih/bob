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
const json = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const page = (res, file, fn) => res.set('Cache-Control', 'no-store').type('html').send(fn(fs.readFileSync(dir('views', file), 'utf8')));

// Одно состояние на весь сайт: рычаг дёргает любой, меняется у всех.
// Хранится в памяти процесса, поэтому после каждого перезапуска Render сайт возвращается в обычный вид.
let active = false;

app.get('/', (req, res) => {
  const boot = active
    ? { mode: 'alt', main: text('alt.txt'), water: text('water2.txt') }
    : {
        mode: 'normal',
        water: text('water.txt'),
        sections: { bob: text('1.txt'), channel: text('2.txt'), chat: text('3.txt'), iscream: text('4.txt'), velsio: text('5.txt'), creator: text('6.txt') },
        links: { channel: CONFIG.telegramChannel, chat: CONFIG.telegramChat }
      };
  page(res, 'index.html', h => h.replace('{{MODE}}', active ? 'alt' : 'normal').replace('{{BOOT}}', () => json(boot)));
});

app.get('/sagaklores', (req, res) => page(res, 'sagaklores.html', h => h.replace('{{ON}}', active ? '1' : '0')));

app.get('/api/state', (req, res) => res.set('Cache-Control', 'no-store').json({ active }));
app.post('/api/activate', (req, res) => { active = true; res.sendStatus(204); });
app.post('/api/deactivate', (req, res) => { active = false; res.sendStatus(204); });

app.use(express.static(dir('public'), { index: false, maxAge: '1h' }));
app.use((req, res) => res.status(404).type('text').send('Not found'));

app.listen(process.env.PORT || 3000, () => console.log('Server started'));
