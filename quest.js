/* window.Quest — the rules of the study battle, with no drawing and no DOM.
   Run its tests with: node --test tests/

   - Each person ticks each training once. A domain's monster has one hit
     point per (training in that domain, person), so it falls only when both
     have finished all of it. Trainings outside the five domains (overview,
     practice tests, agentic courses) hit no monster but count for pace.
   - Every training has a due date (quest_targets, editable in the app; the
     plan's date until someone changes it). Work expected by a day ramps up
     across each training's window: from the day after the previous due date
     (a week before the first one) to its own due date.
   - A hero's HP is pace, not progress: 80% when exactly on schedule, full a
     training or more ahead, minus 20% for each training behind, so 4 behind
     is a knockout.
   - The dragon (the exam) appears once every domain monster is down and
     falls to one hit: the first person to log a pass.

   Day math runs on UTC day numbers so a clock change never moves a day. */
(function () {
  "use strict";

  var MAX_HP = { fighter: 240, mage: 130 };
  var ON_PACE = 0.8;            // share of max HP when exactly on schedule
  var PER_TRAINING_BEHIND = 0.2;
  var DRAGON_HP = 9999;

  function dayNum(iso) {
    var p = String(iso).slice(0, 10).split('-');
    return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function isoFromNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // { trainingId: 'YYYY-MM-DD' }: quest_targets rows win over the plan's dates.
  function dues(syllabus, targets) {
    var set = {}, out = {};
    (targets || []).forEach(function (r) { set[r.id] = r.due_on; });
    syllabus.TRAININGS.forEach(function (t) { out[t.id] = set[t.id] || t.due; });
    return out;
  }
  function examDate(syllabus, targets) {
    var row = (targets || []).find(function (r) { return r.id === syllabus.EXAM_ID; });
    return row ? row.due_on : syllabus.EXAM_DUE;
  }

  // Trainings a person should have finished by the end of `today`.
  function expected(due, today) {
    var days = Object.keys(due).map(function (k) { return dayNum(due[k]); });
    var distinct = days.slice().sort(function (a, b) { return a - b; })
      .filter(function (d, i, a) { return i === 0 || d !== a[i - 1]; });
    var t = dayNum(today);
    return days.reduce(function (sum, d) {
      var i = distinct.indexOf(d);
      var from = i === 0 ? d - 6 : distinct[i - 1] + 1;
      return sum + clamp((t - from + 1) / (d - from + 1), 0, 1);
    }, 0);
  }

  function round(x) { return Math.round(x * 1e9) / 1e9; }

  function hpShare(done, total, expect) {
    if (done >= total) return 1;
    var b = expect - done;
    if (b <= 0) return round(ON_PACE + (1 - ON_PACE) * Math.min(1, -b));
    return round(Math.max(0, ON_PACE - PER_TRAINING_BEHIND * b));
  }

  function hero(person, done, due, today) {
    var total = Object.keys(due).length;
    var exp = expected(due, today);
    var max = MAX_HP[person.hero] || MAX_HP.fighter;
    var share = hpShare(done, total, exp);
    var hp = Math.round(share * max);
    return {
      email: person.email, name: person.display_name, hero: person.hero,
      done: done, total: total, expected: exp,
      behind: round(exp - done),
      hp: hp, maxHp: max,
      status: hp === 0 ? 'ko' : share < 0.3 ? 'weak' : 'ok'
    };
  }

  // syllabus: window.Syllabus. people: quest_members rows. ticks: quest_ticks
  // rows. exams: quest_exam rows. targets: quest_targets rows. Ticks for anyone
  // not in `people`, or for a training not in the syllabus, are ignored.
  function summarize(syllabus, people, ticks, exams, targets, today) {
    var emails = {};
    people.forEach(function (p) { emails[p.email] = true; });
    var mine = {}, perDomain = {};
    ticks.forEach(function (t) {
      var tr = syllabus.byId(t.training_id);
      if (!emails[t.person] || !tr) return;
      mine[t.person] = (mine[t.person] || 0) + 1;
      if (tr.domain) perDomain[tr.domain] = (perDomain[tr.domain] || 0) + 1;
    });
    var due = dues(syllabus, targets);

    var bosses = syllabus.DOMAINS.map(function (d) {
      var n = syllabus.TRAININGS.filter(function (t) { return t.domain === d.n; }).length;
      var max = n * people.length;
      var hp = Math.max(0, max - (perDomain[d.n] || 0));
      return { key: d.boss.key, name: d.boss.name, domain: d.n, hp: hp, maxHp: max, defeated: max > 0 && hp === 0 };
    });
    var passed = (exams || []).filter(function (x) { return emails[x.person] && x.passed_on; })
      .sort(function (a, b) { return a.passed_on < b.passed_on ? -1 : 1; });
    var dragon = {
      key: syllabus.DRAGON.key, name: syllabus.DRAGON.name, domain: 0,
      hp: passed.length ? 0 : DRAGON_HP, maxHp: DRAGON_HP,
      defeated: passed.length > 0,
      slayer: passed.length ? passed[0].person : null,
      passedOn: passed.length ? passed[0].passed_on : null
    };
    var current = null;
    for (var i = 0; i < bosses.length; i++) if (!bosses[i].defeated) { current = bosses[i]; break; }
    // A pass ends the war whatever is still standing: the exam is the point.
    if (dragon.defeated || !current) current = dragon;

    return {
      total: syllabus.TRAININGS.length,
      due: due,
      exam: examDate(syllabus, targets),
      heroes: people.map(function (p) { return hero(p, mine[p.email] || 0, due, today); }),
      bosses: bosses,
      dragon: dragon,
      current: current,
      won: dragon.defeated
    };
  }

  var Quest = {
    MAX_HP: MAX_HP, DRAGON_HP: DRAGON_HP, PER_TRAINING_BEHIND: PER_TRAINING_BEHIND,
    dayNum: dayNum, isoFromNum: isoFromNum,
    dues: dues, examDate: examDate, expected: expected, hpShare: hpShare,
    hero: hero, summarize: summarize
  };
  if (typeof window !== 'undefined') window.Quest = Quest;
  if (typeof module !== 'undefined' && module.exports) module.exports = Quest;
})();
