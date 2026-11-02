/* AWS GenAI Quest: wires Data (Supabase), Quest (rules), Battle (canvas) and
   the page together. test.html swaps in a stub window.Data and CONFIG.TODAY. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var S = window.Syllabus, Q = window.Quest;
  var people = [], ticks = [], exams = [], targets = [], busy = false, confirmPass = null;
  var openGroups = null;    // remembered across re-renders
  var editDates = false;

  function today() {
    if (window.CONFIG.TODAY) return window.CONFIG.TODAY;
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(id) { ['loading', 'gate', 'app'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); }); }
  function summary() { return Q.summarize(S, people, ticks, exams, targets, today()); }
  function nameOf(email) {
    var p = people.find(function (x) { return x.email === email; });
    return p ? p.display_name : 'Someone';
  }
  function say(line, sub) {
    $('msg').innerHTML = '<p>' + esc(line) + '</p>' + (sub ? '<p>' + esc(sub) + '</p>' : '');
  }
  // "the Data Golem", but "The Exam Dragon" already carries its article.
  function the(name, cap) {
    if (/^the /i.test(name)) return cap ? name : 'the' + name.slice(3);
    return (cap ? 'The ' : 'the ') + name;
  }
  function barClass(share) { return share <= 0.25 ? 'crit' : share <= 0.5 ? 'low' : ''; }
  function fmtDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function pace(h) {
    if (h.done >= h.total) return 'every training finished';
    var b = h.behind;
    if (Math.abs(b) < 0.5) return 'on pace (' + h.done + ' of ' + h.total + ')';
    var n = Math.round(Math.abs(b) * 10) / 10;
    return n + (n === 1 ? ' training ' : ' trainings ') + (b > 0 ? 'behind' : 'ahead') + ' (' + h.done + ' of ' + h.total + ')';
  }
  function hours(min) { return min < 60 ? min + ' min' : (Math.round(min / 6) / 10) + ' h'; }

  // ---- render -----------------------------------------------------------------
  function render(s) {
    s = s || summary();
    var f = s.current;
    $('exam').textContent = S.EXAM;
    $('foename').textContent = f.name.toUpperCase();
    var share = f.maxHp ? f.hp / f.maxHp : 0;
    $('foebar').style.width = (share * 100) + '%';
    $('foebar').className = barClass(share);
    $('foehp').textContent = f.key === 'dragon'
      ? (s.won ? 'Defeated by ' + nameOf(f.slayer) + '’s pass' : 'HP ' + f.hp + '. Only a passed exam can hurt it.')
      : 'HP ' + f.hp + ' / ' + f.maxHp + ' · Domain ' + f.domain;

    $('party').innerHTML = s.heroes.map(function (h) {
      var sh = h.hp / h.maxHp;
      var st = h.status === 'ko' ? ' ko' : h.status === 'weak' ? ' weak' : '';
      return '<div class="member">' +
        '<div class="name tag-' + h.hero + '">' + esc(h.name.toUpperCase()) + ' <span class="cls">' + (h.hero === 'mage' ? 'MAGE' : 'FIGHTER') + '</span></div>' +
        '<div class="hp' + st + '">' + (h.status === 'ko' ? 'KO ' : '') + h.hp + '/' + h.maxHp + '</div>' +
        '<div class="bar"><span class="' + barClass(sh) + '" style="width:' + (sh * 100) + '%"></span></div>' +
        '<div class="pace">' + esc(pace(h)) + '</div></div>';
    }).join('') + (people.length < 2 ? '<div class="member"><div class="pace">A second hero has not joined yet.</div></div>' : '');

    Battle.render({
      foe: { key: f.key, gone: s.won },
      heroes: s.heroes.map(function (h) { return { hero: h.hero, status: h.status }; }),
      won: s.won
    });
    renderBestiary(s);
    renderHow(s);
    renderBook();
    renderFinal(s);
  }

  function renderBestiary(s) {
    var list = s.bosses.concat([s.dragon]);
    var ol = $('bestiary');
    ol.innerHTML = '';
    list.forEach(function (b) {
      var li = document.createElement('li');
      if (b.defeated) li.className = 'down';
      if (b === s.current && !s.won) li.className = 'now';
      var src = Battle.sprite(b.key), c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      li.appendChild(c);
      var lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = b.domain ? 'D' + b.domain + ' ' + b.hp + '/' + b.maxHp : 'EXAM';
      li.appendChild(lbl);
      li.title = b.name;
      ol.appendChild(li);
    });
  }

  function renderHow(s) {
    var last = S.TRAININGS.reduce(function (m, t) { return s.due[t.id] > m ? s.due[t.id] : m; }, '');
    $('how').innerHTML =
      '<p>Each of the five exam domains is a monster. Its Review, Practice and SimuLearn trainings are its HP, once for each hero, so it falls only when both of you have finished them. Finishing a later domain\u2019s training hits that monster ahead of time.</p>' +
      '<p>Your HP is your pace. Every training has a due date (all ' + s.total + ' done by ' + fmtDate(last) + '), and the work expected of you ramps up across the days before each one. Exactly on pace is 80% HP; a training or more ahead is full; each training behind costs 20%, so 4 behind knocks you out until you catch up. The overview, practice tests and agentic courses hit no monster, but they count for pace.</p>' +
      '<p>Either of you can move a due date with EDIT DUE DATES; agree on it together first. When all five monsters are down, the Exam Dragon appears (exam ' + fmtDate(s.exam) + '). Nothing you study hurts it. The first of you to log a passed exam ends it in one hit.</p>';
  }

  function tickedSet() {
    var m = {};
    ticks.forEach(function (t) { m[t.training_id + '|' + t.person] = t; });
    return m;
  }

  // Trainings grouped by due date, earliest first; plan order inside a group.
  function groups(due) {
    var by = {};
    S.TRAININGS.forEach(function (t) { (by[due[t.id]] = by[due[t.id]] || []).push(t); });
    return Object.keys(by).sort().map(function (d) { return { due: d, items: by[d] }; });
  }

  function renderBook() {
    var have = tickedSet(), book = $('book'), s = summary();
    var gs = groups(s.due), now = today();
    if (openGroups === null) {
      // Open the first date with anything left to do, and anything overdue.
      openGroups = {};
      var first = gs.find(function (g) {
        return g.items.some(function (t) { return people.some(function (p) { return !have[t.id + '|' + p.email]; }); });
      });
      if (first) openGroups[first.due] = true;
    }
    $('editdates').textContent = editDates ? 'DONE EDITING DATES' : 'EDIT DUE DATES';
    $('editdates').setAttribute('aria-pressed', String(editDates));
    $('datenote').classList.toggle('hidden', !editDates);
    book.innerHTML = '';
    gs.forEach(function (g) {
      var gn = 0, gmax = g.items.length * people.length;
      var det = document.createElement('details');
      det.className = 'domain win';
      det.open = !!openGroups[g.due] || editDates;
      det.addEventListener('toggle', function () { if (!editDates) openGroups[g.due] = det.open; });
      var rows = g.items.map(function (t) {
        var btns = people.map(function (p) {
          var row = have[t.id + '|' + p.email], on = !!row;
          if (on) gn++;
          var by = on && row.done_by !== p.email ? ' (ticked by ' + nameOf(row.done_by) + ')' : '';
          return '<button type="button" class="tick ' + p.hero + '" aria-pressed="' + on + '" data-training="' + t.id + '" data-person="' + esc(p.email) + '"' +
            ' aria-label="' + esc(p.display_name) + ' finished ' + esc(t.title) + by + '" title="' + esc(p.display_name + by) + '">' +
            esc(p.display_name.slice(0, 1).toUpperCase()) + (on ? '✓' : '') + '</button>';
        }).join('');
        var tag = t.domain ? 'D' + t.domain : 'PREP';
        var date = editDates
          ? '<input type="date" class="due" data-due="' + t.id + '" value="' + s.due[t.id] + '" aria-label="Due date for ' + esc(t.title) + '">'
          : '';
        return '<div class="skill"><span class="id">' + tag + '</span><span>' + esc(t.title) + ' <span class="mins">' + hours(t.min) + '</span>' + date + '</span><span class="ticks">' + btns + '</span></div>';
      }).join('');
      if (gmax && gn === gmax) det.classList.add('cleared');
      var late = g.due < now && gn < gmax ? ' · OVERDUE' : '';
      det.innerHTML = '<summary><span>DUE ' + esc(fmtDate(g.due).toUpperCase()) + late + '</span><span>' + gn + '/' + gmax + '</span></summary>' + rows;
      book.appendChild(det);
    });
  }

  function renderFinal(s) {
    var mine = Data.currentEmail();
    var html = s.won
      ? '<p>The Exam Dragon fell on ' + fmtDate(s.dragon.passedOn) + '. Certified.</p>'
      : '<p>Exam: ' + esc(fmtDate(s.exam)) + '. Passed it? Log it here. It is the one hit that ends the dragon, whatever is still standing.</p>';
    if (editDates) html += '<p><label>Exam date <input type="date" class="due" data-due="' + S.EXAM_ID + '" value="' + s.exam + '"></label></p>';
    html += '<div class="passes">' + people.map(function (p) {
      var row = exams.find(function (x) { return x.person === p.email; });
      if (row) return '<button class="btn" type="button" data-undo-pass="' + esc(p.email) + '">' + esc(p.display_name.toUpperCase()) + ' PASSED ' + esc(fmtDate(row.passed_on)) + ' (UNDO)</button>';
      if (p.email !== mine) return '';
      var armed = confirmPass === p.email;
      return '<button class="btn' + (armed ? ' danger' : '') + '" type="button" data-pass="' + esc(p.email) + '">' +
        (armed ? 'TAP AGAIN TO CONFIRM' : 'I PASSED THE EXAM') + '</button>';
    }).join('') + '</div>';
    $('final').innerHTML = html;
  }

  // ---- actions ----------------------------------------------------------------
  function reload() {
    return Promise.all([Data.fetchTicks(), Data.fetchExams(), Data.fetchTargets()]).then(function (r) { ticks = r[0]; exams = r[1]; targets = r[2]; });
  }

  function heroIndex(email) {
    for (var i = 0; i < people.length; i++) if (people[i].email === email) return i;
    return 0;
  }

  function onTick(btn) {
    if (busy) return;
    var id = btn.dataset.training, person = btn.dataset.person, on = btn.getAttribute('aria-pressed') === 'true';
    var tr = S.byId(id);
    var before = summary();
    busy = true; btn.disabled = true;
    var act = on ? Data.untick(id, person) : Data.tick(id, person);
    act.then(reload).then(function () {
      var after = summary();
      if (on) { render(after); say(nameOf(person) + ' took back ' + tr.title + '.'); return; }
      var grew = after.heroes[heroIndex(person)].done > before.heroes[heroIndex(person)].done;
      if (!grew) { render(after); return; }
      var hb = before.heroes[heroIndex(person)], ha = after.heroes[heroIndex(person)];
      var heal = ha.hp - hb.hp;
      var name = nameOf(person);
      var healed = heal > 0 ? ' · ' + name + ' recovers ' + heal + ' HP.' : '';
      if (!tr.domain) {
        render(after);
        if (heal > 0) Battle.heal(heroIndex(person), heal);
        say(name + ' finishes ' + tr.title + '.', 'Training for the final battle' + healed);
        return;
      }
      var d = tr.domain, foe = before.bosses[d - 1];
      if (foe.key !== before.current.key) {
        render(after);
        say(name + ' strikes ' + the(foe.name) + ' from afar! 1 hit.', tr.title + healed);
        return;
      }
      return Battle.attack(heroIndex(person), 1).then(function () {
        say(name + (ha.hero === 'mage' ? ' casts at ' : ' attacks ') + the(foe.name) + '! 1 hit.', tr.title + healed);
        if (heal > 0) Battle.heal(heroIndex(person), heal);
        var fell = after.bosses[d - 1].defeated && !before.bosses[d - 1].defeated;
        if (!fell) { render(after); return; }
        return Battle.foeFalls().then(function () {
          render(after);
          var next = after.current;
          say(the(foe.name, true) + ' is defeated! Domain ' + d + ' cleared.',
            next.key === 'dragon' ? 'The ground shakes. The Exam Dragon appears!' : 'A ' + next.name + ' appears!');
        });
      });
    }).catch(function (e) {
      say('That did not save. Try again.', e && e.message ? e.message : '');
    }).then(function () { busy = false; btn.disabled = false; });
  }

  function onDue(input) {
    var id = input.dataset.due, val = input.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return;
    var label = id === S.EXAM_ID ? 'the exam' : S.byId(id).title;
    Data.setDue(id, val).then(reload).then(function () {
      openGroups = null;
      render();
      say(nameOf(Data.currentEmail()) + ' moved ' + label + ' to ' + fmtDate(val) + '.', 'Both of you see the new date.');
    }).catch(function (e) { say('That date did not save. Try again.', e && e.message ? e.message : ''); });
  }

  function onPass(email) {
    if (confirmPass !== email) { confirmPass = email; render(); return; }
    confirmPass = null;
    var wasWon = summary().won;
    Data.logPass(email).then(reload).then(function () {
      var after = summary();
      if (wasWon) { render(after); say(nameOf(email) + ' passed too!'); return; }
      say(nameOf(email) + ' unleashes the ultimate: CERTIFIED!');
      return Battle.ultimate().then(function () {
        render(after);
        say('The Exam Dragon is defeated in one hit!', 'VICTORY. ' + nameOf(email) + ' passed AWS Certified Generative AI Developer - Professional.');
      });
    }).catch(function (e) { say('That did not save. Try again.', e && e.message ? e.message : ''); });
  }

  function onUndoPass(email) {
    Data.undoPass(email).then(reload).then(function () { render(); say(nameOf(email) + '’s pass was taken back.'); })
      .catch(function (e) { say('That did not save. Try again.', e && e.message ? e.message : ''); });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'editdates') { editDates = !editDates; if (!editDates) openGroups = null; render(); return; }
    if (t.classList.contains('tick')) onTick(t);
    else if (t.dataset.pass) onPass(t.dataset.pass);
    else if (t.dataset.undoPass) onUndoPass(t.dataset.undoPass);
  });

  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches('input.due')) onDue(e.target);
  });

  // ---- start ------------------------------------------------------------------
  function load() {
    return Data.fetchMembers().then(function (m) {
      if (!m.length) {
        show('gate');
        $('signin').classList.add('hidden');
        $('gatenote').textContent = 'This Google account is not in the party. Ask the quest's owner to add it.';
        return;
      }
      people = m.sort(function (a, b) { return a.hero === b.hero ? 0 : a.hero === 'fighter' ? -1 : 1; });
      var me = people.find(function (p) { return p.email === Data.currentEmail(); });
      $('who').textContent = me ? 'Signed in as ' + me.display_name : '';
      return reload().then(function () {
        show('app');
        render();
        var s = summary();
        say(s.won ? 'VICTORY. The Exam Dragon is defeated.' : the(s.current.name, true) + ' blocks the way!',
          s.won ? '' : s.current.key === 'dragon' ? 'Only a passed exam can hurt it.' : 'Finish a training below to attack.');
      });
    }).catch(function (e) { show('gate'); $('gatenote').textContent = 'Could not load: ' + (e.message || e); });
  }

  function init() {
    Battle.mount($('scene'));
    $('signin').addEventListener('click', function () { Data.signIn(); });
    $('signout').addEventListener('click', function () { Data.signOut().then(function () { location.reload(); }); });
    Data.getSession().then(function (session) {
      if (!session) { show('gate'); return; }
      return load();
    });
  }
  init();
})();
