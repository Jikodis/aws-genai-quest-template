/* window.Battle — draws the battle scene on a 256x144 canvas that CSS scales
   up with nearest-neighbour, so every fillRect is a fat pixel. Only drawing
   and animation live here; quest.js decides who has what HP.

   Heroes are hand-made pixel grids. Monsters are built from flat shapes on an
   offscreen canvas and then given a 1px black outline, which is what makes
   them read as 8-bit sprites. All art here is original. */
(function () {
  "use strict";
  var W = 256, H = 144, BAND = 40;   // BAND = height of the scenery strip
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PAL = {
    k: '#000000', w: '#fcfcfc', s: '#fcbc8c', e: '#24188c', h: '#a85000',
    r: '#d82800', R: '#881400', G: '#bcbcbc', g: '#7c7c7c', y: '#f8b800',
    b: '#3c7cfc', B: '#0058f8', p: '#9878f8', P: '#6844fc', n: '#7c4800', c: '#3cbcfc'
  };

  // Facing left, toward the monsters.
  var FIGHTER = [
    '......kkkk......',
    '.....kGGGGk.....',
    '....kGGGGGGk....',
    '....kGkkkkGk....',
    '....kkesssGk....',
    '.....ksssssk....',
    '......kssk......',
    '...kkkrrrrkkk...',
    '..kGGkrrrrkrrk..',
    '.kGyGGkrrrkrrk..',
    '.kGyyGkrRrkrsk..',
    '.kGyGGkrrrkssk..',
    '..kGGkyyyyykk...',
    '...kkrrrRrrk....',
    '....kRRkkRRk....',
    '....kGGk.kGGk...',
    '....kGGk.kGGk...',
    '...kkGGk.kGGk...',
    '..knnnnk.knnnk..',
    '..kkkkkk.kkkkk..'
  ];
  var MAGE = [
    '..........kk....',
    '.........kbBk...',
    '........kbbBk...',
    '.......kbbbBk...',
    '......kbbybBk...',
    '....kkbbbbbbkk..',
    '...kbbbbbbbbbbk.',
    '....kkkkkkkkkk..',
    '.....khesshhk...',
    '.....ksssssk....',
    '......kssskk....',
    '....kkpppppkk...',
    '...kppPpppppPk..',
    '..kssPpppppPpk..',
    '..kskPpyyyPpPk..',
    '...k.kpppppPk...',
    '.....kpppppPPk..',
    '....kppppppPPk..',
    '...kpppppppPPk..',
    '...kkkkkkkkkkk..'
  ];

  function gridCanvas(rows, swap) {
    var c = document.createElement('canvas');
    c.width = 16; c.height = rows.length;
    var g = c.getContext('2d');
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch === '.') continue;
        g.fillStyle = (swap && swap[ch]) || PAL[ch];
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  }

  // ---- shape helpers for monsters (integer pixels only) --------------------
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function ellipse(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (var y = -ry; y <= ry; y++) {
      var half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5))));
      g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
  }
  function tri(g, x1, y1, x2, y2, x3, y3, c) {   // filled triangle, scanline
    g.fillStyle = c;
    var minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
    var e = [[x1, y1, x2, y2], [x2, y2, x3, y3], [x3, y3, x1, y1]];
    for (var y = minY; y <= maxY; y++) {
      var xs = [];
      e.forEach(function (s) {
        if ((y >= s[1] && y <= s[3]) || (y >= s[3] && y <= s[1])) {
          if (s[1] === s[3]) { xs.push(s[0], s[2]); return; }
          xs.push(Math.round(s[0] + (y - s[1]) * (s[2] - s[0]) / (s[3] - s[1])));
        }
      });
      if (!xs.length) continue;
      var a = Math.min.apply(null, xs), b = Math.max.apply(null, xs);
      g.fillRect(a, y, b - a + 1, 1);
    }
  }
  var rect0 = rect, ellipse0 = ellipse, tri0 = tri;
  function outline(c) {
    var g = c.getContext('2d'), w = c.width, h = c.height;
    var d = g.getImageData(0, 0, w, h), src = new Uint8ClampedArray(d.data);
    var on = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0; };
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (on(x, y)) continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
        var i = (y * w + x) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = 255;
      }
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  function sheet(w, h, paint) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'));
    return outline(c);
  }

  // Monsters face right, toward the party.
  var MONSTERS = {
    golem: function () { return sheet(50, 50, function (g) {
      var st = '#9c9c9c', dk = '#5c5c5c', lt = '#d0d0d0';
      rect(g, 12, 38, 9, 10, dk); rect(g, 29, 38, 9, 10, dk);          // legs
      rect(g, 8, 14, 34, 25, st); rect(g, 8, 14, 34, 3, lt);           // body
      rect(g, 1, 16, 8, 18, st); rect(g, 0, 32, 10, 8, dk);            // arms + fists
      rect(g, 41, 16, 8, 18, st); rect(g, 40, 32, 10, 8, dk);
      [18, 24, 30].forEach(function (y) {                                 // database disks
        rect(g, 17, y, 16, 5, '#00a8a8'); rect(g, 18, y - 1, 14, 2, '#3cbcfc');
        rect(g, 17, y + 5, 16, 1, dk);
      });
      rect(g, 17, 2, 16, 13, st); rect(g, 17, 2, 16, 2, lt);           // head
      rect(g, 20, 7, 3, 2, '#3cfcfc'); rect(g, 27, 7, 3, 2, '#3cfcfc'); // eyes
      rect(g, 13, 22, 1, 6, dk); rect(g, 36, 18, 1, 8, dk);            // cracks
    }); },
    chimera: function () { return sheet(60, 46, function (g) {
      var fur = '#d8a038', dk = '#9c5c18';
      tri(g, 22, 6, 40, 6, 30, 18, '#7c2c7c');                          // bat wing
      ellipse(g, 28, 24, 18, 10, fur);                                  // body
      rect(g, 13, 30, 5, 13, dk); rect(g, 22, 30, 5, 13, fur);          // legs
      rect(g, 32, 30, 5, 13, dk); rect(g, 40, 30, 5, 13, fur);
      rect(g, 4, 23, 8, 3, '#38a838'); rect(g, 4, 17, 3, 8, '#38a838'); // snake tail
      rect(g, 2, 14, 5, 4, '#38a838');
      rect(g, 1, 15, 2, 1, '#fc3c3c');
      ellipse(g, 26, 10, 5, 5, '#bcbcbc');                              // goat head
      tri(g, 22, 6, 18, 0, 24, 5, '#f0d090'); tri(g, 29, 5, 32, 0, 31, 6, '#f0d090');
      rect(g, 27, 9, 2, 2, '#000');
      ellipse(g, 48, 20, 10, 10, '#e05c00');                            // lion mane
      ellipse(g, 50, 21, 6, 6, fur);                                    // face
      rect(g, 51, 18, 2, 2, '#000'); rect(g, 54, 24, 4, 2, '#881400');
    }); },
    warden: function () { return sheet(46, 56, function (g) {
      var st = '#a8a8c8', dk = '#58587c';
      tri(g, 20, 0, 30, 0, 22, 8, '#d82800');                            // plume
      rect(g, 16, 6, 14, 12, st); rect(g, 18, 11, 12, 2, '#000');       // helm + visor
      rect(g, 26, 11, 2, 2, '#fc3c3c');
      rect(g, 12, 18, 22, 20, st); rect(g, 12, 18, 22, 3, '#d8d8f8');   // body
      rect(g, 14, 38, 7, 16, dk); rect(g, 25, 38, 7, 16, dk);           // legs
      rect(g, 40, 2, 2, 52, '#7c4800'); tri(g, 38, 6, 44, 6, 41, 0, '#d8d8f8'); // spear
      rect(g, 34, 22, 6, 4, st);                                         // arm
      ellipse(g, 26, 30, 10, 13, '#3c3cbc');                            // shield
      ellipse(g, 26, 30, 7, 10, '#5c5cfc');
      ellipse(g, 26, 27, 2, 2, '#f8b800'); rect(g, 25, 29, 3, 6, '#f8b800'); // keyhole
    }); },
    beetle: function () { return sheet(58, 40, function (g) {
      var br = '#c86c18', dk = '#7c3c00';
      for (var i = 0; i < 3; i++) {                                      // legs
        rect(g, 12 + i * 12, 26, 2, 12, dk); rect(g, 9 + i * 12, 36, 5, 2, dk);
      }
      ellipse(g, 26, 22, 22, 13, br); ellipse(g, 26, 18, 18, 7, '#e8a048');
      rect(g, 26, 9, 1, 26, dk);                                         // shell seam
      ellipse(g, 48, 24, 7, 6, dk);                                      // head
      tri(g, 50, 20, 57, 8, 54, 21, '#bcbcbc');                          // horn
      rect(g, 50, 23, 2, 2, '#fc3c3c');
      ellipse(g, 17, 10, 7, 7, '#f8b800'); ellipse(g, 17, 10, 3, 3, br);// gear
      [[17, 1], [17, 18], [8, 10], [25, 10], [11, 4], [23, 4], [11, 16], [23, 16]].forEach(function (p) {
        rect(g, p[0] - 1, p[1] - 1, 3, 3, '#f8b800');
      });
    }); },
    specter: function () { return sheet(48, 54, function (g) {
      var v = '#8c5cdc', dk = '#5c2c9c';
      ellipse(g, 24, 18, 16, 16, v);
      tri(g, 8, 18, 40, 18, 24, 52, v);
      tri(g, 8, 18, 14, 46, 20, 30, v); tri(g, 40, 18, 34, 48, 28, 30, v);
      rect(g, 2, 24, 8, 4, dk); rect(g, 38, 24, 8, 4, dk);              // arms
      ellipse(g, 26, 16, 8, 10, '#bcbcbc');                              // mirror frame
      ellipse(g, 26, 16, 6, 8, '#a8e4fc');
      rect(g, 23, 10, 2, 5, '#fcfcfc'); rect(g, 22, 13, 1, 2, '#fcfcfc');
      rect(g, 27, 15, 2, 2, '#24188c'); rect(g, 31, 15, 2, 2, '#24188c');
    }); },
    dragon: function () { return sheet(136, 108, function (g0) {
      var k = 1.4, R = function (v) { return Math.round(v * k); };
      var g = g0;   // the helpers below shadow the outer ones and scale every coordinate
      var rect = function (_, x, y, w, h, c) { rect0(g0, R(x), R(y), R(w), R(h), c); };
      var ellipse = function (_, cx, cy, rx, ry, c) { ellipse0(g0, R(cx), R(cy), R(rx), R(ry), c); };
      var tri = function (_, a, b, c2, d, e, f, c) { tri0(g0, R(a), R(b), R(c2), R(d), R(e), R(f), c); };
      var red = '#d82800', dk = '#881400', belly = '#f8b800';
      tri(g, 24, 30, 46, 0, 60, 30, dk);                                 // back wing
      tri(g, 30, 30, 46, 6, 54, 30, '#a81000');
      rect(g, 0, 50, 14, 5, red); tri(g, 0, 46, 6, 50, 0, 56, dk);       // tail
      ellipse(g, 34, 48, 22, 15, red);                                   // body
      ellipse(g, 38, 53, 14, 8, belly);
      rect(g, 22, 58, 8, 16, dk); rect(g, 42, 58, 8, 16, dk);            // legs
      rect(g, 18, 72, 14, 4, dk); rect(g, 40, 72, 14, 4, dk);
      tri(g, 46, 44, 58, 14, 66, 22, red);                               // neck
      ellipse(g, 72, 18, 12, 8, red);                                    // head
      rect(g, 74, 22, 20, 7, red); rect(g, 80, 28, 12, 3, dk);           // snout + jaw
      rect(g, 84, 24, 2, 2, '#fcfcfc'); rect(g, 88, 24, 2, 2, '#fcfcfc');// fangs
      tri(g, 64, 12, 58, 0, 68, 10, '#f0d090'); tri(g, 72, 10, 72, 0, 76, 10, '#f0d090');
      rect(g, 74, 15, 3, 3, '#f8f800'); rect(g, 75, 16, 1, 1, '#000');
      tri(g, 26, 36, 52, 2, 62, 36, red);                                 // front wing
      tri(g, 32, 34, 52, 8, 56, 34, '#fc7460');
      rect(g, 51, 4, 2, 30, dk);
    }); }
  };

  // Scenery strip per foe: sky bands, a silhouette, ground.
  var LANDS = {
    golem:   { sky: ['#000000', '#1c1c1c'], hills: '#3c3c3c', ground: '#5c3c1c', kind: 'cave' },
    chimera: { sky: ['#3cbcfc', '#a8e4fc'], hills: '#00a800', ground: '#58d854', kind: 'hills' },
    warden:  { sky: ['#0058f8', '#3cbcfc'], hills: '#7c7c7c', ground: '#58d854', kind: 'castle' },
    beetle:  { sky: ['#f87858', '#fca044'], hills: '#ac7c00', ground: '#f0d090', kind: 'dunes' },
    specter: { sky: ['#000000', '#24188c'], hills: '#005800', ground: '#004058', kind: 'trees' },
    dragon:  { sky: ['#881400', '#d82800'], hills: '#000000', ground: '#503000', kind: 'peaks' }
  };

  function drawLand(g, key) {
    var L = LANDS[key] || LANDS.chimera, x;
    rect(g, 0, 0, W, 16, L.sky[0]); rect(g, 0, 16, W, 14, L.sky[1]);
    g.fillStyle = L.hills;
    for (x = 0; x < W; x++) {
      var h;
      if (L.kind === 'castle') h = (x % 48 < 24) ? ((x % 8 < 4) ? 22 : 20) : 14;
      else if (L.kind === 'trees') h = 10 + ((x * 7) % 13 < 7 ? (x % 12) : 12 - (x % 12));
      else if (L.kind === 'peaks') h = 6 + Math.abs(((x * 3) % 60) - 30) * 0.7;
      else if (L.kind === 'cave') h = 30 - Math.abs(((x * 5) % 40) - 20) * 0.6;
      else h = 10 + Math.round(6 * Math.sin(x / 18) + 3 * Math.sin(x / 7));
      g.fillRect(x, L.kind === 'cave' ? 0 : 30 - Math.round(h), 1, Math.round(h));
    }
    rect(g, 0, 30, W, BAND - 30, L.ground);
    rect(g, 0, BAND, W, 1, '#fcfcfc');
  }

  // ---- scene ----------------------------------------------------------------
  var canvas, ctx, sprites = {}, scene = null, fx = [], raf = 0;

  function sprite(key) {
    if (!sprites[key]) {
      if (key === 'fighter') sprites[key] = gridCanvas(FIGHTER);
      else if (key === 'mage') sprites[key] = gridCanvas(MAGE);
      else sprites[key] = MONSTERS[key]();
    }
    return sprites[key];
  }

  var HS = 2;   // hero scale
  function heroSpot(i) { return { x: 188 + i * 12, y: 54 + i * 44 }; }
  function foeBox(img) {
    var scale = img.width > 80 ? 1 : 2;   // the dragon is already huge
    var w = img.width * scale, h = img.height * scale;
    var y = Math.round(BAND + (H - BAND) / 2 - h / 2);
    if (y + h > H - 2) y = H - 2 - h;     // a foe too tall for the field rears up over the scenery
    return { x: Math.round(78 - w / 2), y: y, w: w, h: h, scale: scale };
  }

  function now() { return performance.now(); }
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  function draw() {
    if (!scene) return;
    var t = now();
    fx = fx.filter(function (f) { return t - f.t0 <= f.ms; });
    ctx.imageSmoothingEnabled = false;
    rect(ctx, 0, 0, W, H, '#000');
    drawLand(ctx, scene.foe.key);

    // effects active now
    var flash = 0, foeOff = { x: 0 }, heroOff = {}, foeAlpha = 1, dissolve = -1, shake = 0;
    fx.forEach(function (f) {
      var p = (t - f.t0) / f.ms;
      if (p < 0 || p > 1) return;
      if (f.type === 'step') heroOff[f.who] = -Math.round(10 * Math.sin(Math.PI * p));
      if (f.type === 'hurt') { foeAlpha = (Math.floor(p * 8) % 2) ? 0.25 : 1; shake = (Math.floor(p * 10) % 2) ? 2 : -2; }
      if (f.type === 'flash') flash = Math.max(flash, (Math.floor(p * 6) % 2) ? 0.85 : 0);
      if (f.type === 'dissolve') dissolve = p;
    });

    // foe
    if (!scene.foe.gone) {
      var img = sprite(scene.foe.key), b = foeBox(img);
      ctx.save();
      ctx.globalAlpha = foeAlpha;
      ctx.drawImage(img, b.x + shake, b.y, b.w, b.h);
      ctx.restore();
      if (dissolve >= 0) {
        // the old 8-bit wipe: black rows eat the sprite from the top down
        var rows = Math.ceil(b.h * dissolve);
        ctx.fillStyle = '#000';
        for (var yy = 0; yy < rows; yy++) {
          if (yy % 2 === 0 || yy < rows - 6) ctx.fillRect(b.x - 2, b.y + yy, b.w + 4, 1);
        }
      }
    }

    // heroes
    // Heroes are drawn at 2x like the monsters, in sprite coordinates.
    scene.heroes.forEach(function (h, i) {
      var img = sprite(h.hero), s = heroSpot(i), dx = heroOff[i] || 0;
      ctx.save();
      if (h.status === 'ko') {
        ctx.globalAlpha = 0.55;
        ctx.translate(s.x - 4, s.y + 38);
        ctx.scale(HS, HS);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(img, 0, 0);
      } else {
        ctx.translate(s.x + dx, s.y + (h.status === 'weak' ? 6 : 0));
        ctx.scale(HS, HS);
        if (h.hero === 'fighter') {           // sword behind, raised while stepping
          var up = dx ? 3 : 0;
          rect(ctx, 13, -4 - up, 1, 14, '#fcfcfc');
          rect(ctx, 14, -4 - up, 1, 14, '#bcbcbc');
          rect(ctx, 12, 10 - up, 4, 1, '#f8b800');
        }
        ctx.drawImage(img, 0, 0);
        if (h.hero === 'mage') {              // staff and orb in front
          rect(ctx, 2, 4, 1, 17, '#7c4800');
          rect(ctx, 1, 1, 3, 3, '#3cbcfc');
          rect(ctx, 1, 1, 1, 1, '#fcfcfc');
        }
        if (h.status === 'weak') rect(ctx, 4, -3, 1, 2, '#3cbcfc');   // sweat drop
      }
      ctx.restore();
    });

    // slashes, sparkles, numbers
    fx.forEach(function (f) {
      var p = (t - f.t0) / f.ms;
      if (p < 0 || p > 1) return;
      var b = foeBox(sprite(scene.foe.key));
      if (f.type === 'slash') {
        var n = Math.floor(p * 6);
        ctx.fillStyle = '#fcfcfc';
        for (var i = 0; i < n; i++) {
          var cx = b.x + b.w * 0.25 + i * 5, cy = b.y + b.h * 0.2 + i * 6;
          ctx.fillRect(cx, cy, 6, 2);
        }
      }
      if (f.type === 'spell') {
        for (var j = 0; j < 14; j++) {
          var a = j * 0.9 + p * 6, r = 6 + (1 - p) * 26;
          var sx = Math.round(b.x + b.w / 2 + Math.cos(a) * r), sy = Math.round(b.y + b.h / 2 + Math.sin(a) * r * 0.7);
          rect(ctx, sx, sy, 2, 2, j % 2 ? '#3cfcfc' : '#fcfcfc');
        }
      }
      if (f.type === 'number') {
        var ny = Math.round(b.y + b.h * 0.3 - 10 * Math.sin(Math.PI * ease(p * 1.6)));
        text(ctx, String(f.text), Math.round(b.x + b.w / 2), ny, f.color || '#fcfcfc');
      }
      if (f.type === 'ultimate') {
        for (var k = 0; k < 5; k++) {
          var off = Math.round((p * 1.8 - k * 0.12) * 220);
          rect(ctx, W - off, BAND + 8 + k * 18, 60, 3, k % 2 ? '#f8b800' : '#fcfcfc');
        }
      }
    });

    if (flash) { ctx.save(); ctx.globalAlpha = flash; rect(ctx, 0, 0, W, H, '#fcfcfc'); ctx.restore(); }
    if (scene.won && !fx.length) text(ctx, 'VICTORY', 78, 86, '#f8b800');

    if (fx.length) raf = requestAnimationFrame(draw); else raf = 0;
  }

  // Tiny 3x5 pixel font for damage numbers and the victory word.
  var GLYPH = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111', 'V': '101101101101010', 'I': '111010010010111',
    'C': '111100100100111', 'T': '111010010010010', 'O': '111101101101111', 'R': '110101110101101',
    'Y': '101101010010010', '!': '010010010000010'
  };
  function text(g, str, cx, y, color) {
    var scale = 2, w = str.length * 4 * scale - scale, x0 = Math.round(cx - w / 2);
    for (var i = 0; i < str.length; i++) {
      var gl = GLYPH[str[i]]; if (!gl) continue;
      for (var p = 0; p < 15; p++) if (gl[p] === '1') {
        var px = x0 + i * 4 * scale + (p % 3) * scale, py = y + Math.floor(p / 3) * scale;
        rect(g, px - 1, py - 1, scale + 2, scale + 2, '#000');
      }
    }
    for (var j = 0; j < str.length; j++) {
      var gj = GLYPH[str[j]]; if (!gj) continue;
      for (var q = 0; q < 15; q++) if (gj[q] === '1') {
        rect(g, x0 + j * 4 * scale + (q % 3) * scale, y + Math.floor(q / 3) * scale, scale, scale, color);
      }
    }
  }

  function play(list) {
    var t0 = now(), end = 0;
    list.forEach(function (f) { f.t0 = t0 + (f.at || 0); fx.push(f); end = Math.max(end, (f.at || 0) + f.ms); });
    if (!raf) raf = requestAnimationFrame(draw);
    return new Promise(function (res) { setTimeout(res, reduce ? 0 : end); });
  }

  window.Battle = {
    mount: function (el) { canvas = el; canvas.width = W; canvas.height = H; ctx = canvas.getContext('2d'); },
    // state: { foe: {key, gone}, heroes: [{hero, status}], won }
    render: function (state) { scene = state; if (!raf) draw(); },
    attack: function (who, dmg) {
      if (reduce || !scene) return Promise.resolve();
      var h = scene.heroes[who] || scene.heroes[0];
      var hit = h && h.hero === 'mage' ? { type: 'spell', at: 200, ms: 500 } : { type: 'slash', at: 200, ms: 300 };
      return play([
        { type: 'step', who: who, ms: 700 }, hit,
        { type: 'hurt', at: 450, ms: 350 },
        { type: 'number', text: dmg, at: 450, ms: 800 }
      ]);
    },
    heal: function (who, amount) {
      if (reduce || !scene) return Promise.resolve();
      return play([{ type: 'number', text: amount, color: '#58f898', ms: 700 }]);
    },
    foeFalls: function () {
      if (reduce || !scene) return Promise.resolve();
      return play([{ type: 'flash', ms: 300 }, { type: 'dissolve', at: 300, ms: 900 }]);
    },
    ultimate: function () {
      if (reduce || !scene) return Promise.resolve();
      return play([
        { type: 'flash', ms: 900 },
        { type: 'step', who: 0, at: 300, ms: 700 }, { type: 'step', who: 1, at: 350, ms: 700 },
        { type: 'ultimate', at: 500, ms: 900 },
        { type: 'hurt', at: 900, ms: 500 },
        { type: 'number', text: '9999', at: 1000, ms: 1000 },
        { type: 'dissolve', at: 1600, ms: 1100 }
      ]);
    },
    sprite: sprite   // for the bestiary icons
  };
})();
