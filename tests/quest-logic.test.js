// Rules for the AWS study battle (quest.js).
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Quest = require('../quest.js');
const Syllabus = require('../syllabus.js');

const A = { email: 'a@x', display_name: 'Hero', hero: 'fighter' };
const B = { email: 'b@x', display_name: 'Pal', hero: 'mage' };
const ALL = Syllabus.TRAININGS;
const tick = (who, id) => ({ training_id: id, person: who, done_by: who });
const ticksFor = (who, n) => ALL.slice(0, n).map(t => tick(who, t.id));
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('the plan has 20 trainings with unique ids, in due-date order', () => {
  assert.equal(ALL.length, 20);
  assert.equal(new Set(ALL.map(t => t.id)).size, 20);
  for (let i = 1; i < ALL.length; i++) assert.ok(ALL[i - 1].due <= ALL[i].due, ALL[i].id);
  assert.deepEqual([1, 2, 3, 4, 5].map(d => ALL.filter(t => t.domain === d).length), [3, 3, 2, 2, 2]);
});

test('due dates come from quest_targets when present, else the plan', () => {
  const due = Quest.dues(Syllabus, [{ id: 'd1-review', due_on: '2026-11-05' }, { id: 'exam', due_on: '2026-12-18' }]);
  assert.equal(due['d1-review'], '2026-11-05');
  assert.equal(due['overview'], '2026-10-26');
  assert.equal(Quest.examDate(Syllabus, [{ id: 'exam', due_on: '2026-12-18' }]), '2026-12-18');
  assert.equal(Quest.examDate(Syllabus, []), '2026-12-15');
});

test('expected work ramps across each training\'s week and reaches all 20 on the last due date', () => {
  const due = Quest.dues(Syllabus, []);
  assert.equal(Quest.expected(due, '2026-10-19'), 0);
  // Week 1 (Oct 20 to 26) holds 3 trainings: one day in, 3/7 of one is expected.
  assert.ok(near(Quest.expected(due, '2026-10-20'), 3 / 7));
  assert.equal(Quest.expected(due, '2026-10-26'), 3);
  assert.equal(Quest.expected(due, '2026-11-02'), 5);
  assert.equal(Quest.expected(due, '2026-12-14'), 20);
  assert.equal(Quest.expected(due, '2027-01-01'), 20);
});

test('moving a due date later lowers what is expected today', () => {
  const plan = Quest.dues(Syllabus, []);
  const later = Quest.dues(Syllabus, ALL.map(t => ({ id: t.id, due_on: Quest.isoFromNum(Quest.dayNum(t.due) + 14) })));
  assert.equal(Quest.expected(plan, '2026-11-02'), 5);
  assert.equal(Quest.expected(later, '2026-11-02'), 0);
});

test('a hero on pace has 80% HP, a training ahead is full, each training behind costs 20%', () => {
  assert.ok(near(Quest.hpShare(5, 20, 5), 0.8));
  assert.equal(Quest.hpShare(6, 20, 5), 1);
  assert.ok(near(Quest.hpShare(4, 20, 5), 0.6));
  assert.equal(Quest.hpShare(1, 20, 5), 0);
  assert.equal(Quest.hpShare(20, 20, 20), 1);
});

test('a hero 4 trainings behind is knocked out; one who finished is full', () => {
  const due = Quest.dues(Syllabus, []);
  const h = Quest.hero(A, 1, due, '2026-11-02');
  assert.equal(h.behind, 4);
  assert.equal(h.status, 'ko');
  assert.equal(Quest.hero(B, 20, due, '2027-01-01').hp, Quest.MAX_HP.mage);
});

test('a domain monster has one HP per training per person and falls only when both finish it', () => {
  const d1 = ALL.filter(t => t.domain === 1);
  let s = Quest.summarize(Syllabus, [A, B], d1.map(t => tick(A.email, t.id)), [], [], '2026-11-01');
  assert.equal(s.bosses[0].maxHp, 6);
  assert.equal(s.bosses[0].hp, 3);
  assert.equal(s.current.domain, 1);
  s = Quest.summarize(Syllabus, [A, B], d1.flatMap(t => [tick(A.email, t.id), tick(B.email, t.id)]), [], [], '2026-11-01');
  assert.equal(s.bosses[0].defeated, true);
  assert.equal(s.current.domain, 2);
});

test('a training with no domain counts for pace but hits no monster', () => {
  const s = Quest.summarize(Syllabus, [A], [tick(A.email, 'overview')], [], [], '2026-10-26');
  assert.equal(s.heroes[0].done, 1);
  assert.equal(s.bosses[0].hp, 3);
});

test('ticks from someone outside the party, or for an unknown training, do not count', () => {
  const s = Quest.summarize(Syllabus, [A], [tick('z@x', 'd1-review'), tick(A.email, '1.1.1')], [], [], '2026-11-01');
  assert.equal(s.bosses[0].hp, 3);
  assert.equal(s.heroes[0].done, 0);
});

test('the dragon comes after the five monsters and falls to the first pass', () => {
  const every = ALL.flatMap(t => [tick(A.email, t.id), tick(B.email, t.id)]);
  let s = Quest.summarize(Syllabus, [A, B], every, [], [], '2026-12-14');
  assert.equal(s.current.key, 'dragon');
  assert.equal(s.won, false);
  s = Quest.summarize(Syllabus, [A, B], every, [{ person: B.email, passed_on: '2026-12-16' }, { person: A.email, passed_on: '2026-12-17' }], [], '2026-12-17');
  assert.equal(s.won, true);
  assert.equal(s.dragon.slayer, B.email);
  assert.equal(s.dragon.hp, 0);
});

test('a pass ends the battle even with monsters standing', () => {
  const s = Quest.summarize(Syllabus, [A, B], ticksFor(A.email, 4), [{ person: A.email, passed_on: '2026-12-15' }], [], '2026-12-15');
  assert.equal(s.won, true);
  assert.equal(s.current.key, 'dragon');
});

test('the migration seeds every training id and the exam, with the plan\'s dates', () => {
  const sql = require('node:fs').readFileSync(require.resolve('../supabase/migrations/20261031180000_plan_trainings.sql'), 'utf8');
  const seeded = {};
  for (const m of sql.matchAll(/\('([a-z0-9-]+)',\s*'(\d{4}-\d{2}-\d{2})'\)/g)) seeded[m[1]] = m[2];
  ALL.forEach(t => assert.equal(seeded[t.id], t.due, t.id));
  assert.equal(seeded.exam, Syllabus.EXAM_DUE);
  assert.equal(Object.keys(seeded).length, 21);
});
