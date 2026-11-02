/* window.Syllabus — what the two heroes study for AWS Certified Generative AI
   Developer - Professional (AIP-C01): the trainings in the study plan
   ("AI Engineer Study Plan (AWS)", Oct 20 2026), which follows the Skill
   Builder "Exam Prep Plan: AIP-C01" (17 trainings) and adds three agentic
   pieces. A person ticks a training once they have finished it.

   `due` is the plan's default: the last day of the plan week the training
   sits in. The real due dates live in the quest_targets table, where either
   hero can change them in the app; this list only seeds what to show while
   that table loads, and its ids must match the table's.

   Each exam domain is one monster, hit by that domain's Review, Practice and
   SimuLearn trainings. Trainings with domain 0 (overview, practice tests,
   agentic courses) hit no monster but still count toward a hero's pace. The
   exam itself is the dragon: passing it is the one hit that ends it. */
(function () {
  "use strict";
  var DOMAINS = [
    { n: 1, weight: 31, title: 'Foundation Model Integration, Data Management, and Compliance', boss: { key: 'golem', name: 'Data Golem' } },
    { n: 2, weight: 26, title: 'Implementation and Integration', boss: { key: 'chimera', name: 'Chimera of Integration' } },
    { n: 3, weight: 20, title: 'AI Safety, Security, and Governance', boss: { key: 'warden', name: 'Iron Warden' } },
    { n: 4, weight: 12, title: 'Operational Efficiency and Optimization for GenAI Applications', boss: { key: 'beetle', name: 'Clockwork Beetle' } },
    { n: 5, weight: 11, title: 'Testing, Validation, and Troubleshooting', boss: { key: 'specter', name: 'Mirror Specter' } }
  ];

  // In plan order. min = course length in minutes, from Skill Builder.
  var TRAININGS = [
    { id: 'overview',      domain: 0, min: 5,   due: '2026-10-26', title: 'Exam Prep Overview' },
    { id: 'question-set',  domain: 0, min: 48,  due: '2026-10-26', title: 'Official Practice Question Set (baseline score)' },
    { id: 'd1-review',     domain: 1, min: 60,  due: '2026-10-26', title: 'Domain 1 Review' },
    { id: 'd1-practice',   domain: 1, min: 60,  due: '2026-11-02', title: 'Domain 1 Practice' },
    { id: 'd1-simulearn',  domain: 1, min: 60,  due: '2026-11-02', title: 'Domain 1 SimuLearn' },
    { id: 'd2-review',     domain: 2, min: 60,  due: '2026-11-09', title: 'Domain 2 Review' },
    { id: 'd2-practice',   domain: 2, min: 60,  due: '2026-11-09', title: 'Domain 2 Practice' },
    { id: 'd2-simulearn',  domain: 2, min: 60,  due: '2026-11-09', title: 'Domain 2 SimuLearn' },
    { id: 'agentic-dive',  domain: 0, min: 360, due: '2026-11-16', title: 'Agentic AI Frameworks Deep Dive' },
    { id: 'd3-review',     domain: 3, min: 60,  due: '2026-11-23', title: 'Domain 3 Review' },
    { id: 'd3-practice',   domain: 3, min: 60,  due: '2026-11-23', title: 'Domain 3 Practice' },
    { id: 'd4-review',     domain: 4, min: 60,  due: '2026-11-23', title: 'Domain 4 Review' },
    { id: 'd4-practice',   domain: 4, min: 60,  due: '2026-11-30', title: 'Domain 4 Practice' },
    { id: 'd5-review',     domain: 5, min: 60,  due: '2026-11-30', title: 'Domain 5 Review' },
    { id: 'd5-practice',   domain: 5, min: 60,  due: '2026-11-30', title: 'Domain 5 Practice' },
    { id: 'pretest',       domain: 0, min: 180, due: '2026-11-30', title: 'Official Pretest (75 questions)' },
    { id: 'agentic-lab',   domain: 0, min: 120, due: '2026-12-07', title: 'Agentic AI Demonstrated lab badge' },
    { id: 'advanced-plan', domain: 0, min: 480, due: '2026-12-07', title: 'GenAI Developer Advanced Plan: weakest pretest domains' },
    { id: 'practice-exam', domain: 0, min: 180, due: '2026-12-14', title: 'Official Practice Exam, then review every miss' },
    { id: 'summary',       domain: 0, min: 5,   due: '2026-12-14', title: 'Exam Prep Summary' }
  ];

  var Syllabus = {
    EXAM: 'AWS Certified Generative AI Developer - Professional (AIP-C01)',
    EXAM_ID: 'exam',          // the quest_targets row holding the exam date
    EXAM_DUE: '2026-12-15',   // the plan's exam window is Dec 15 to 19
    DOMAINS: DOMAINS,
    TRAININGS: TRAININGS,
    DRAGON: { key: 'dragon', name: 'The Exam Dragon' },
    byId: function (id) {
      for (var i = 0; i < TRAININGS.length; i++) if (TRAININGS[i].id === id) return TRAININGS[i];
      return null;
    }
  };

  if (typeof window !== 'undefined') window.Syllabus = Syllabus;
  if (typeof module !== 'undefined' && module.exports) module.exports = Syllabus;
})();
