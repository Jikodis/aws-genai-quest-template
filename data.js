/* window.Data — Supabase client, Google auth, and the study battle's tables.
   Uses the Supabase JS UMD global (window.supabase) loaded from the CDN.
   Nothing personal lives here: this file is served publicly. */
(function () {
  "use strict";
  var C = window.CONFIG;
  var client = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
  var email = null;
  function rows(r) { if (r.error) throw r.error; return r.data || []; }
  function ok(r) { if (r.error) throw r.error; return true; }

  window.Data = {
    currentEmail: function () { return email; },
    getSession: function () {
      return client.auth.getSession().then(function (r) {
        email = r.data.session ? r.data.session.user.email : null;
        return r.data.session;
      });
    },
    signIn: function () {
      return client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname }
      });
    },
    signOut: function () { return client.auth.signOut(); },
    onAuth: function (cb) {
      return client.auth.onAuthStateChange(function (_e, session) {
        email = session ? session.user.email : null;
        cb(session);
      });
    },

    // RLS-gated: an empty list means the signed-in account is not in the party.
    fetchMembers: function () {
      return client.from('quest_members').select('email,display_name,hero,color').then(rows);
    },
    fetchTicks: function () {
      return client.from('quest_ticks').select('training_id,person,done_by,done_at').then(rows);
    },
    fetchExams: function () {
      return client.from('quest_exam').select('person,passed_on,done_by').then(rows);
    },
    // A duplicate tick (the other person ticked it a moment ago) is not an
    // error; app.js only celebrates when the count actually grew.
    tick: function (trainingId, person) {
      return client.from('quest_ticks').insert({ training_id: trainingId, person: person, done_by: email })
        .then(function (r) { if (r.error && r.error.code !== '23505') throw r.error; return true; });
    },
    untick: function (trainingId, person) {
      return client.from('quest_ticks').delete().eq('training_id', trainingId).eq('person', person).then(ok);
    },
    // Due dates, one row per training plus 'exam'. Either member may move one;
    // the update policy forces updated_by to the caller.
    fetchTargets: function () {
      return client.from('quest_targets').select('id,due_on,updated_by').then(rows);
    },
    setDue: function (id, dueOn) {
      return client.from('quest_targets').update({ due_on: dueOn, updated_by: email }).eq('id', id).then(ok);
    },
    logPass: function (person) {
      return client.from('quest_exam').insert({ person: person, done_by: email })
        .then(function (r) { if (r.error && r.error.code !== '23505') throw r.error; return true; });
    },
    undoPass: function (person) {
      return client.from('quest_exam').delete().eq('person', person).then(ok);
    }
  };
})();
