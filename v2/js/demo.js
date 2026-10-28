/* mindLAMP Issue Portal: demo mode. Owner: core.
   Active only when the page URL has ?demo=1. Then it replaces window.supabase with an in-browser stand-in,
   so the portal runs with sample data, no sign-in and no server. Nothing is sent anywhere.
   The sample data is fictional and generic. It names no real study, team, site or person, and has no real counts.
   Adapted from the end-to-end test mock: same read rules, guarded writes, patch_doc and portal_* summaries
   as supabase/03-migration.sql, simplified. State lives in this tab's sessionStorage, so switching the role
   (a reload) keeps what the reviewer did; closing the tab or "Reset the demo" clears it. */
(function () {
  "use strict";
  var on = false;
  try { on = /(?:^|[?&])demo=1(?:&|$)/.test(location.search.slice(1)); } catch (e) { on = false; }
  if (!on) return;

  var DB_KEY = "ip-demo-db-v2";
  var UID_KEY = "ip-demo-uid";
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* in-memory only */ } }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }

  var now = Date.now();
  function ago(days, hours) { return new Date(now - (days * 24 + (hours || 0)) * 36e5).toISOString(); }

  /* ---------- sample people (fictional) ---------- */
  var USERS = [
    { id: "demo-rc", email: "coordinator@demo.example", name: "Sample Coordinator", lastSeen: ago(3) },
    { id: "demo-lead", email: "lead@demo.example", name: "Sample Lead", lastSeen: ago(4) },
    { id: "demo-analyst", email: "analyst@demo.example", name: "Sample Analyst", lastSeen: ago(5) },
    { id: "demo-dev", email: "developer@demo.example", name: "Sample Developer", lastSeen: ago(6) },
    { id: "demo-admin", email: "admin@demo.example", name: "Sample Admin", admin: true, lastSeen: ago(2) },
    { id: "demo-rc-b", email: "coordinator-b@demo.example", name: "Second Coordinator", lastSeen: ago(1) }
  ];
  var ROLE_VIEWS = [
    { uid: "demo-rc", label: "Coordinator" },
    { uid: "demo-lead", label: "Study lead" },
    { uid: "demo-analyst", label: "Data analyst" },
    { uid: "demo-dev", label: "Developer" },
    { uid: "demo-admin", label: "Admin (platform team)" }
  ];
  var MEMBERSHIPS = [
    { user_id: "demo-rc", study_id: "sample-a", role: "rc" },
    { user_id: "demo-lead", study_id: "sample-a", role: "lead" },
    { user_id: "demo-analyst", study_id: "sample-a", role: "analyst" },
    { user_id: "demo-dev", study_id: "*", role: "dev" },
    { user_id: "demo-admin", study_id: "*", role: "platform" },
    { user_id: "demo-rc-b", study_id: "sample-b", role: "rc" }
  ];

  /* ---------- sample studies ---------- */
  var STUDIES = [
    { id: "sample-a", data: { name: "Sample Study A", showName: false, notionLink: "",
      population: ["young-adult"],
      setup: { phones: "both", devices: "own", server: "other", serverOther: "https://demo.example.org", ownServer: "no",
        features: ["activities", "passive", "gps"], reminderOnly: "no", windows: "yes" },
      setupUpdatedAt: ago(20),
      researcherGoals: ["Data completeness", "Retention", "Engagement"], participantGoals: ["Low participant burden"] } },
    { id: "sample-b", data: { name: "Sample Study B", showName: true, notionLink: "",
      population: ["older-adult"],
      setup: { phones: "ios", devices: "loaned", server: "other", serverOther: "https://demo.example.org", ownServer: "no",
        features: ["activities", "wearable"], wearables: ["apple"], reminderOnly: "yes", windows: "no" },
      setupUpdatedAt: ago(30),
      researcherGoals: ["Engagement", "Low participant burden", "Data validity"], participantGoals: [] } }
  ];

  /* ---------- sample issues (fictional, plain words) ---------- */
  function issue(id, o) {
    return { id: id, data: Object.assign({ type: "bug", layers: [], evidence: "Sample issue for the demo.", teams: 0,
      provisional: true, workarounds: [], statusNote: "", planned: "" }, o) };
  }
  var ISSUES = [
    issue("i01", { short: "Signed out after update", title: "Participants are signed out after an app update and must sign in again", area: "app",
      symptom: "After the app updates, the person sees the sign-in screen and has to sign in again.",
      status: "in-progress", stops: "prevented", data: "missing", cost: "staff",
      planned: "A change that keeps people signed in after an update is being built.",
      statusHistory: [{ from: "heard", to: "scoping", at: ago(9), by: "demo-admin" }, { from: "scoping", to: "in-progress", at: ago(1), by: "demo-admin" }],
      statusChangedAt: ago(1), workarounds: ["Help them sign in again with their study username and password."] }),
    issue("i03", { short: "Missed reminders", title: "Activity reminders don't arrive, or arrive with no sound", area: "surveys",
      symptom: "The person gets no reminder, or it comes with no sound.",
      status: "workaround", stops: "prevented", data: "missing", cost: "participant",
      statusNote: "Phone settings cause most cases. Check them first.",
      statusHistory: [{ from: "heard", to: "workaround", at: ago(2), by: "demo-admin" }], statusChangedAt: ago(2),
      workarounds: ["Check that notifications are on for the app, with sound."],
      confirmedWorkarounds: [{ text: "Set a phone alarm as a backup", key: "set a phone alarm as a backup", at: ago(6), by: "demo-admin" }] }),
    issue("i05", { short: "Activity not marked done", title: "A finished activity still shows as to do", area: "surveys",
      symptom: "The person finished an activity, but the app still lists it as not done.",
      status: "needs-detail", stops: "slowed", data: "unknown", cost: "staff",
      statusNote: "We need the phone type and app version from a few more cases." }),
    issue("i07", { short: "Slider misses top value", title: "On some phones the slider stops short of the top value", area: "activities",
      symptom: "On some phones the slider can't be dragged all the way to the highest answer.",
      status: "scoping", stops: "slowed", data: "wrong", cost: "participant",
      planned: "Let the slider reach every value on every screen size." }),
    issue("i08", { short: "Background data stops", title: "Background phone data stops arriving after a few days", area: "passive",
      symptom: "Phone data collected in the background stops arriving, and nobody is told.",
      status: "understood", stops: "none", data: "missing", cost: "analyst",
      statusNote: "The phone closes the app in the background to save battery." }),
    issue("i10", { short: "Faster battery drain", title: "The phone's battery runs down faster with the app installed", area: "passive",
      symptom: "The person says their battery drains faster since they installed the app.",
      status: "heard", stops: "slowed", data: "none", cost: "participant" }),
    issue("i21", { short: "Blank screen on open", title: "The app opens to a blank screen and doesn't load", area: "app",
      symptom: "The app shows a white screen after the logo and does not load.",
      status: "not-now", stops: "prevented", data: "none", cost: "staff",
      notNowReason: "Not enough reports yet to see a pattern. Logging your sessions helps.",
      statusHistory: [{ from: "heard", to: "not-now", at: ago(1, 4), by: "demo-admin" }], statusChangedAt: ago(1, 4),
      workarounds: ["Close the app fully and open it again."] })
  ];

  /* ---------- sample records ---------- */
  var n = 0;
  function sess(studyId, author, days, o) {
    var at = ago(days, 2);
    return { collection: "sessions", id: "demo-s" + (++n), author: author, created_at: at,
      data: Object.assign({ studyId: studyId, phone: "ios", path: [], fixedBy: null, fixedByText: "", helped: "",
        stopgapsShown: [], contentVersion: "demo", startedAt: at, finishedAt: at, created: at, role: "rc",
        triage: { state: "none" } }, o) };
  }
  function rep(id, studyId, author, days, o) {
    var at = ago(days, 3);
    return { collection: "reports", id: id, author: author, created_at: at,
      data: Object.assign({ studyId: studyId, created: at, role: "rc", sessionIds: [], week: at.slice(0, 10), span: "weeks",
        n: 1, recur: "ongoing", attribution: "platform", words: "", fix: "", setup: {} }, o) };
  }
  var DOCS = [
    /* Sample Study A, last 7 days */
    sess("sample-a", "demo-rc", 1, { entryId: "reminders", issueId: "i03", outcome: "not_fixed", phone: "android",
      triage: { state: "new" }, helped: "Set a phone alarm as a backup" }),
    sess("sample-a", "demo-rc", 2, { entryId: "reminders", issueId: "i03", outcome: "fixed", fixedBy: "rem.notif",
      fixedByText: "In the phone's Settings, open Notifications, find mindLAMP, and turn notifications on, with sound." }),
    sess("sample-a", "demo-rc", 4, { entryId: "reminders", issueId: "i03", outcome: "not_fixed", phone: "android", triage: { state: "new" } }),
    sess("sample-a", "demo-rc", 3, { entryId: "login", issueId: "i01", outcome: "fixed", fixedBy: "login.signin",
      fixedByText: "Help them sign in again with their study username and password." }),
    sess("sample-a", "demo-rc", 5, { entryId: "other", issueId: "i21", linkedIssueId: "i21", outcome: "new_problem",
      newProblem: { what: "The screen stays white after the logo", since: "Last week" },
      triage: { state: "linked", at: ago(1, 5), by: "demo-admin" } }),
    sess("sample-a", "demo-rc", 2, { entryId: "other", issueId: null, outcome: "new_problem",
      newProblem: { what: "A setting screen asks for a code nobody has", since: "Yesterday" }, triage: { state: "new" } }),
    sess("sample-a", "demo-analyst", 2, { entryId: "data_missing", issueId: "i08", outcome: "not_fixed", role: "analyst", triage: { state: "new" } }),
    sess("sample-a", "demo-rc", 6, { entryId: "battery", issueId: "i10", outcome: "unconfirmed", untestedFix: "batt.data",
      untestedFixText: "Explain that any Wi-Fi works, and mobile data use is small." }),
    /* Two fixes left to try later, no follow-up yet (an open session). */
    sess("sample-a", "demo-rc", 1, { entryId: "reminders", issueId: "i03", outcome: "unconfirmed", phone: "android",
      fixes: [{ node: "rem.notif", mark: "didnt" }, { node: "rem.focus", mark: "later" }, { node: "rem.battery", mark: "later" }] }),
    /* "Not an app problem" (D25): never counted toward an issue, tallied for the dev meeting. */
    sess("sample-a", "demo-rc", 2, { entryId: "not_done", issueId: null, outcome: "not_app", notAppReason: "forgot" }),
    sess("sample-a", "demo-rc", 4, { entryId: "not_done", issueId: null, outcome: "not_app", notAppReason: "burden" }),
    /* What helped: picks of existing suggestions. */
    sess("sample-a", "demo-rc", 3, { entryId: "reminders", issueId: "i03", outcome: "no_fix_yet",
      helpedPicks: [{ kind: "stopgap", id: "alarm" }, { kind: "step", id: "rem.focus" }] }),
    /* Sample Study A, older */
    sess("sample-a", "demo-rc", 15, { entryId: "reminders", issueId: "i03", outcome: "fixed", fixedBy: "rem.notif",
      fixedByText: "In the phone's Settings, open Notifications, find mindLAMP, and turn notifications on, with sound." }),
    sess("sample-a", "demo-analyst", 12, { entryId: "data_missing", issueId: "i08", outcome: "fixed", role: "analyst",
      fixedBy: "data.open", fixedByText: "Have them open mindLAMP and leave it in the background. They shouldn't swipe it away." }),
    /* Sample Study B */
    sess("sample-b", "demo-rc-b", 2, { entryId: "reminders", issueId: "i03", outcome: "not_fixed", triage: { state: "new" } }),
    sess("sample-b", "demo-rc-b", 3, { entryId: "login", issueId: "i01", outcome: "not_fixed", triage: { state: "new" } }),
    sess("sample-b", "demo-rc-b", 4, { entryId: "activity_wrong", issueId: "i07", outcome: "no_fix_yet" }),
    sess("sample-b", "demo-rc-b", 6, { entryId: "reminders", issueId: "i03", outcome: "no_fix_yet",
      helpedPicks: [{ kind: "team", id: "set a phone alarm as a backup" }] }),
    sess("sample-b", "demo-rc-b", 1, { entryId: "other", issueId: null, outcome: "new_problem",
      newProblem: { what: "Text runs off the edge of the screen", since: "Two days" }, triage: { state: "new" } }),

    rep("demo-r1", "sample-a", "demo-rc", 12, { issueId: "i03", n: 2, stops: "prevented", data: "missing", cost: "staff",
      fix: "Set a phone alarm as a backup", fixPicks: [{ kind: "stopgap", id: "alarm" }], setup: { phone: "both" } }),
    rep("demo-r2", "sample-a", "demo-analyst", 9, { issueId: "i08", n: 3, stops: "none", data: "missing", cost: "analyst", role: "analyst",
      setup: { phone: "android" } }),
    rep("demo-r3", "sample-b", "demo-rc-b", 5, { issueId: "i03", n: 2, stops: "slowed", data: "missing", cost: "participant",
      fixPicks: [{ kind: "step", id: "rem.focus" }], setup: { phone: "ios" } }),
    rep("demo-r4", "sample-b", "demo-rc-b", 8, { issueId: "i01", n: 1, stops: "prevented", data: "none", cost: "staff",
      fix: "Send the login details again", setup: { phone: "ios" } }),
    rep("demo-r5", "sample-b", "demo-rc-b", 2, { issueId: "new", newTitle: "Dashboard chart shows no bars",
      newSymptom: "The weekly chart is empty for one participant, though data arrived.", n: 1, stops: "none", data: "unknown",
      cost: "staff", triage: { state: "new" }, setup: { phone: "ios" } }),

    { collection: "boosts", id: "i03__demo-rc-b__sample-b", author: "demo-rc-b", created_at: ago(3),
      data: { issueId: "i03", goal: "Engagement", why: "Missed reminders mean missed activities.", studyId: "sample-b", role: "rc", created: ago(3) } },
    { collection: "boosts", id: "i08__demo-lead__sample-a", author: "demo-lead", created_at: ago(7),
      data: { issueId: "i08", goal: "Data completeness", why: "Gaps make our weekly data checks slow.", studyId: "sample-a", role: "lead", created: ago(7) } },
    { collection: "boosts", id: "i10__demo-rc-b__sample-b", author: "demo-rc-b", created_at: ago(4),
      data: { issueId: "i10", goal: "Low participant burden", why: "People ask if they can delete the app.", studyId: "sample-b", role: "rc", created: ago(4) } },

    { collection: "proposals", id: "demo-p1", author: "demo-admin", created_at: ago(4),
      data: { what: "Show a clear message when reminders are turned off", issues: ["i03"], decision: "explore",
        scoper: "Sample Developer", by: "Sample Admin", stage: "captured", created: ago(4) } },
    { collection: "proposals", id: "demo-p2", author: "demo-dev", created_at: ago(8),
      data: { what: "Keep people signed in across app updates", by: "Sample Developer", issues: ["i01"], touches: ["auth"], zone: "red",
        reach: "Every server, with the next app release.", effects: "Touches the login work.", reversible: "yes",
        test: "Update from the last release on one iPhone and one Android phone.", size: "M",
        owner: "Sample Developer, reviewed by Sample Admin", decision: "go", conditions: "Only after the login work is reviewed.",
        planned: "Keep people signed in when the app updates.", notNowReason: "", specUrl: "https://example.org/sample-spec",
        stage: "full", created: ago(8) } },
    { collection: "proposals", id: "demo-p3", author: "demo-admin", created_at: ago(4),
      data: { what: "Redesign the battery settings screen", issues: ["i10"], decision: "not-now",
        notNowReason: "We need to see which phones drain fastest first. Logging your sessions helps.", scoper: "", by: "Sample Admin",
        stage: "captured", created: ago(4) } },

    { collection: "feedback", id: "demo-f1", author: "demo-lead", created_at: ago(2),
      data: { part: "report", text: "Sample feedback: the report asked for our setup again.", created: ago(2) } }
  ];

  /* ---------- the in-browser database ---------- */
  function fresh() {
    var db = { docs: [], memberships: MEMBERSHIPS.slice(),
      profiles: USERS.map(function (u) { return { id: u.id, name: u.name, last_seen: u.lastSeen || null }; }) };
    ISSUES.forEach(function (i) { db.docs.push({ collection: "issues", id: i.id, data: JSON.parse(JSON.stringify(i.data)), author: null, study_id: null, created_at: ago(40), updated_at: ago(40) }); });
    STUDIES.forEach(function (s) { db.docs.push({ collection: "studies", id: s.id, data: JSON.parse(JSON.stringify(s.data)), author: null, study_id: s.id, created_at: ago(60), updated_at: ago(20) }); });
    DOCS.forEach(function (d) {
      var sid = (d.data.studyId && d.collection !== "proposals" && d.collection !== "feedback") ? d.data.studyId : null;
      db.docs.push(Object.assign({ study_id: sid, updated_at: d.created_at }, JSON.parse(JSON.stringify(d))));
    });
    return db;
  }
  var db;
  try { var saved = ssGet(DB_KEY); db = saved ? JSON.parse(saved) : fresh(); } catch (e) { db = fresh(); }
  function save() { ssSet(DB_KEY, JSON.stringify(db)); }
  save();

  function uid() {
    var u = ssGet(UID_KEY) || window.__demoUid || "demo-rc";
    return USERS.some(function (x) { return x.id === u; }) ? u : "demo-rc";
  }
  function user() { var u = uid(); return USERS.find(function (x) { return x.id === u; }) || null; }
  function isAdmin() { var u = user(); return !!(u && u.admin); }
  function isMember(sid) { return !!sid && sid !== "*" && db.memberships.some(function (m) { return m.user_id === uid() && m.study_id === sid; }); }
  function roleIn(sid) {
    var m = db.memberships.find(function (x) { return x.user_id === uid() && x.study_id === sid && sid && sid !== "*"; });
    if (m) return m.role;
    var s = db.memberships.find(function (x) { return x.user_id === uid() && x.study_id === "*"; });
    if (s) return s.role;
    return isAdmin() ? "platform" : null;
  }
  function hasAnyRole(r) { return db.memberships.some(function (m) { return m.user_id === uid() && m.role === r; }); }
  function sec(d) { return String(d.data && d.data.security) === "true"; }
  function isTestStudy(sid) {
    var s = db.docs.find(function (x) { return x.collection === "studies" && x.id === sid; });
    return !!(s && String(s.data.test) === "true");
  }
  function canRead(d) {
    if (isAdmin()) return true;
    if (d.collection === "issues") return !sec(d);
    if (d.collection === "proposals") return hasAnyRole("dev") || hasAnyRole("platform");
    if (d.collection === "feedback") return d.author === uid();
    if (d.collection === "studies") return isMember(d.id);
    if (["sessions", "reports", "boosts"].indexOf(d.collection) >= 0) return d.author === uid() || (isMember(d.study_id) && !sec(d));
    return false;
  }
  function norm(t) { return String(t || "").trim().replace(/\s+/g, " ").replace(/[.!]+$/, "").trim().toLowerCase(); }
  var NOT_A_FIX = ["not resolved", "nothing", "none", "no", "n/a", "na", "not sure", "unknown", "nothing yet", "nothing helped", "not fixed", "nothing worked", "-"];
  var listeners = [];
  function notify(col) { setTimeout(function () { listeners.forEach(function (fn) { try { fn({ new: { collection: col } }); } catch (e) { /* ignore */ } }); }, 10); }
  function err(code, message) { return { code: code, message: message || code }; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function insertDoc(row) {
    var adm = isAdmin();
    var d = { collection: row.collection, id: row.id, data: clone(row.data || {}), author: row.author, created_at: new Date().toISOString() };
    d.updated_at = d.created_at;
    if (d.collection === "studies") d.study_id = d.id;
    else if (["sessions", "reports", "boosts"].indexOf(d.collection) >= 0) d.study_id = (d.data.studyId && d.data.studyId !== "*") ? d.data.studyId : null;
    else d.study_id = null;
    if (!adm) {
      if (d.author !== uid()) return err("42501", "row-level security");
      if (d.collection === "issues" || d.collection === "studies") return err("42501", "row-level security");
      if ((d.collection === "sessions" || d.collection === "reports") && !isMember(d.study_id)) return err("42501", "row-level security");
      if (d.collection === "boosts" && d.study_id && !isMember(d.study_id)) return err("42501", "row-level security");
      if (d.collection === "proposals" && !(hasAnyRole("dev") || hasAnyRole("platform"))) return err("42501", "row-level security");
      delete d.data.triage; delete d.data.linkedIssueId; delete d.data.statusHistory;
      if (d.collection === "boosts" && d.id !== (d.data.issueId + "__" + uid() + "__" + (d.study_id || "none"))) return err("42501", "boost id");
      if (d.collection === "sessions" && ["fixed", "unconfirmed", "not_fixed", "no_fix_yet", "new_problem", "ended_early", "not_app"].indexOf(d.data.outcome) < 0) return err("22023", "outcome");
    }
    /* Like the database: a record an admin writes in a study they don't belong to is marked, and never counts. */
    delete d.data.outsideStudy;
    if (adm && d.study_id && ["sessions", "reports", "boosts"].indexOf(d.collection) >= 0 && !isMember(d.study_id)) d.data.outsideStudy = true;
    if (adm && !d.study_id && d.collection === "boosts") d.data.outsideStudy = true;
    if (d.collection === "sessions" && !d.data.triage) d.data.triage = { state: ["not_fixed", "new_problem"].indexOf(d.data.outcome) >= 0 ? "new" : "none" };
    if (d.collection === "reports" && d.data.issueId === "new" && !d.data.triage) d.data.triage = { state: "new" };
    if (["issues", "studies"].indexOf(d.collection) < 0) { var r = roleIn(d.study_id); if (r) d.data.role = r; else delete d.data.role; }
    if (db.docs.some(function (x) { return x.collection === d.collection && x.id === d.id; })) return err("23505", "duplicate");
    db.docs.push(d); save(); notify(d.collection);
    return null;
  }
  function canUpdate(d) {
    if (isAdmin()) return true;
    if (d.collection === "studies") return db.memberships.some(function (m) { return m.user_id === uid() && m.study_id === d.id && m.role === "lead"; });
    if (d.collection === "proposals") return hasAnyRole("dev") || hasAnyRole("platform");
    return d.author === uid() && ["boosts", "feedback", "reports", "sessions"].indexOf(d.collection) >= 0;
  }
  function updateDoc(d, newData) {
    if (!canUpdate(d)) return false;
    var adm = isAdmin();
    var old = d.data;
    var nd = clone(newData);
    if (old.created) nd.created = old.created;
    if (d.collection === "issues") {
      if (nd.status !== old.status) {
        var at = new Date().toISOString();
        nd.statusHistory = (old.statusHistory || []).concat([{ from: old.status, to: nd.status, at: at, by: uid() }]);
        nd.statusChangedAt = at;
      } else { nd.statusHistory = old.statusHistory; nd.statusChangedAt = old.statusChangedAt; }
    }
    if (!adm) {
      if (d.collection === "studies") { nd.name = old.name; nd.notionLink = old.notionLink; nd.test = old.test; }
      if (d.collection === "sessions" || d.collection === "reports") { nd.triage = old.triage; nd.linkedIssueId = old.linkedIssueId; }
      if (d.collection === "sessions") {
        var keep = Object.assign({}, old);
        ["helped", "device", "newProblem", "stopgapsShown", "helpedPicks", "followUp"].forEach(function (k) { if (k in nd) keep[k] = nd[k]; });
        nd = keep;
      }
      if (d.collection === "boosts") nd.issueId = old.issueId;
    }
    if (d.study_id && ["sessions", "reports", "boosts"].indexOf(d.collection) >= 0) nd.studyId = d.study_id;
    /* Like the database: a follow-up that ends "not fixed" puts a never-triaged session in the triage queue. */
    if (d.collection === "sessions" && nd.followUp && nd.followUp.final === "not_fixed" && (!nd.triage || nd.triage.state === "none")) nd.triage = { state: "new" };
    Object.keys(nd).forEach(function (k) { if (nd[k] === undefined) delete nd[k]; });
    d.data = nd; d.updated_at = new Date().toISOString();
    save(); notify(d.collection);
    return true;
  }

  /* ---------- query builder (the subset core.js uses) ---------- */
  function q(table) {
    var st = { op: "select", filters: [], payload: null, single: false };
    var b = {
      select: function () { return b; },
      eq: function (k, v) { st.filters.push([k, v]); return b; },
      in: function () { return b; },
      maybeSingle: function () { st.single = true; return b; },
      insert: function (p) { st.op = "insert"; st.payload = p; return b; },
      upsert: function (p) { st.op = "upsert"; st.payload = p; return b; },
      update: function (p) { st.op = "update"; st.payload = p; return b; },
      delete: function () { st.op = "delete"; return b; },
      then: function (res, rej) { return Promise.resolve().then(function () { return run(table, st); }).then(res, rej); }
    };
    return b;
  }
  function match(row, filters) { return filters.every(function (f) { return row[f[0]] === f[1]; }); }
  function run(table, st) {
    if (table === "docs") {
      if (st.op === "select") {
        var rows = db.docs.filter(function (d) { return match(d, st.filters) && canRead(d); });
        return { data: rows.map(function (d) { return { id: d.id, data: clone(d.data), author: d.author, created_at: d.created_at, updated_at: d.updated_at, study_id: d.study_id }; }), error: null };
      }
      if (st.op === "insert") return { data: null, error: insertDoc(st.payload) };
      if (st.op === "upsert") {
        var p = st.payload;
        var cur = db.docs.find(function (d) { return d.collection === p.collection && d.id === p.id; });
        if (!cur) return { data: null, error: insertDoc(p) };
        if (cur.author !== uid() && !isAdmin()) return { data: null, error: err("42501", "row-level security") };
        updateDoc(cur, p.data);
        if (cur.collection === "boosts") { var r = roleIn(cur.study_id); if (r) cur.data.role = r; save(); }
        return { data: null, error: null };
      }
      if (st.op === "update") {
        var ups = db.docs.filter(function (d) { return match(d, st.filters) && canRead(d); });
        var done = ups.filter(function (d) { return updateDoc(d, (st.payload && st.payload.data) || d.data); });
        return { data: done.map(function (d) { return { id: d.id }; }), error: null };
      }
      if (st.op === "delete") {
        var dels = db.docs.filter(function (d) {
          return match(d, st.filters) && canRead(d) && (isAdmin() || (d.author === uid() &&
            ["boosts", "proposals", "feedback", "reports"].indexOf(d.collection) >= 0 &&
            (d.collection !== "proposals" || hasAnyRole("dev") || hasAnyRole("platform"))));
        });
        db.docs = db.docs.filter(function (d) { return dels.indexOf(d) < 0; });
        dels.forEach(function (d) { if (d.collection === "studies") db.memberships = db.memberships.filter(function (m) { return m.study_id !== d.id; }); });
        save(); dels.forEach(function (d) { notify(d.collection); });
        return { data: null, error: null };
      }
    }
    if (table === "memberships") {
      if (st.op === "select") {
        var ms = db.memberships.filter(function (m) { return m.user_id === uid() || isAdmin() || (m.study_id !== "*" && isMember(m.study_id)); });
        return { data: ms.map(function (m) { return { user_id: m.user_id, study_id: m.study_id, role: m.role }; }), error: null };
      }
      if (!isAdmin()) return { data: null, error: err("42501", "row-level security") };
      if (st.op === "upsert") {
        var mp = st.payload;
        if (mp.study_id !== "*" && !db.docs.some(function (d) { return d.collection === "studies" && d.id === mp.study_id; })) return { data: null, error: err("23503", "no study") };
        var mc = db.memberships.find(function (m) { return m.user_id === mp.user_id && m.study_id === mp.study_id; });
        if (mc) mc.role = mp.role; else db.memberships.push({ user_id: mp.user_id, study_id: mp.study_id, role: mp.role });
        save(); return { data: null, error: null };
      }
      if (st.op === "delete") { db.memberships = db.memberships.filter(function (m) { return !match(m, st.filters); }); save(); return { data: null, error: null }; }
    }
    if (table === "profiles") {
      function shares(id) {
        return db.memberships.some(function (a) { return a.user_id === uid() && a.study_id !== "*" &&
          db.memberships.some(function (b) { return b.user_id === id && b.study_id === a.study_id; }); });
      }
      if (st.op === "select") {
        var ps = db.profiles.filter(function (p) { return p.id === uid() || isAdmin() || shares(p.id); }).filter(function (r) { return match(r, st.filters); });
        return { data: st.single ? (ps[0] ? clone(ps[0]) : null) : clone(ps), error: null };
      }
      var pp = st.payload || {};
      if (st.op === "upsert") {
        if (pp.id !== uid() && !isAdmin()) return { data: null, error: err("42501", "rls") };
        var pc = db.profiles.find(function (x) { return x.id === pp.id; });
        if (pc) pc.name = pp.name; else db.profiles.push({ id: pp.id, name: pp.name, last_seen: null });
        save(); return { data: null, error: null };
      }
      if (st.op === "update") {
        /* Demo keeps each sample person's last visit fixed, so "Since your last visit" always has something to show. */
        return { data: null, error: null };
      }
    }
    return { data: null, error: err("PGRST", "unknown table " + table) };
  }

  /* ---------- count-only summaries (test studies left out, as pilot hygiene asks) ---------- */
  function effIssue(d) { return d.data.linkedIssueId || d.data.issueId || null; }
  /* A session's outcome for counting: the follow-up's final result, else the saved outcome. */
  function eff(d) { return (d.data.followUp && d.data.followUp.final) || d.data.outcome; }
  function notApp(d) { return d.collection === "sessions" && eff(d) === "not_app"; }
  function picks(d) { var l = d.data.helpedPicks || d.data.fixPicks; return Array.isArray(l) ? l.filter(function (p) { return p && p.kind && p.id; }) : []; }
  function secIssues() { return db.docs.filter(function (d) { return d.collection === "issues" && sec(d); }).map(function (d) { return d.id; }); }
  /* Stand-in for the database's md5(): any fixed hash works, because the page never computes it. */
  function fakeHash(t) { var h = 2166136261; t = String(t || ""); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ("00000000" + h.toString(16)).slice(-8); }
  function counted(d) { return String(d.data && d.data.outsideStudy) !== "true" && (!d.study_id || !isTestStudy(d.study_id)); }
  var RPC = {
    is_admin: function () { return isAdmin(); },
    patch_doc: function (a) {
      var d = db.docs.find(function (x) { return x.collection === a.p_collection && x.id === a.p_id; });
      if (!d || !canRead(d)) return null;
      return updateDoc(d, Object.assign({}, d.data, a.p_patch || {})) ? clone(d.data) : null;
    },
    admin_people: function () {
      if (!isAdmin()) return [];
      return USERS.map(function (u) {
        var p = db.profiles.find(function (x) { return x.id === u.id; }) || {};
        return { id: u.id, email: u.email, name: p.name || "", last_seen: p.last_seen, created_at: ago(60),
          memberships: db.memberships.filter(function (m) { return m.user_id === u.id; }).map(function (m) { return { studyId: m.study_id, role: m.role }; }) };
      });
    },
    portal_issue_stats: function () {
      var S = secIssues(), out = {}, d30 = Date.now() - 30 * 864e5;
      db.docs.forEach(function (d) {
        var kind = null;
        if (d.collection === "reports" && !sec(d)) kind = "report";
        else if (d.collection === "sessions" && !notApp(d)) kind = "session";
        else if (d.collection === "boosts" && !d.data.removed) kind = "boost";
        if (!kind || !counted(d)) return;
        var iid = kind === "boost" ? d.data.issueId : effIssue(d);
        if (!iid || iid === "new" || (!isAdmin() && S.indexOf(iid) >= 0)) return;
        var o = out[iid] = out[iid] || { issue_id: iid, teamSet: {}, reports: 0, reports_30d: 0, sessions: 0, sessions_30d: 0, boosts: 0, last_at: null };
        var t = Date.parse(d.created_at);
        if (kind !== "boost") { if (d.study_id) o.teamSet[d.study_id] = 1; if (!o.last_at || d.created_at > o.last_at) o.last_at = d.created_at; }
        if (kind === "report") { o.reports++; if (t > d30) o.reports_30d++; }
        if (kind === "session") { o.sessions++; if (t > d30) o.sessions_30d++; }
        if (kind === "boost") o.boosts++;
      });
      return Object.keys(out).map(function (k) { var o = out[k]; o.teams = Object.keys(o.teamSet).length; delete o.teamSet; return o; });
    },
    portal_boosts: function () {
      var S = secIssues();
      return db.docs.filter(function (d) { return d.collection === "boosts" && !d.data.removed && counted(d) && (isAdmin() || S.indexOf(d.data.issueId) < 0); }).map(function (b) {
        var st = db.docs.find(function (x) { return x.collection === "studies" && x.id === b.study_id; });
        var name = st && (st.data.showName || isAdmin() || isMember(st.id)) ? st.data.name : null;
        return { issue_id: b.data.issueId, goal: b.data.goal, why: b.data.why, role: b.data.role, study_name: name, boosted_at: b.created_at, mine: b.author === uid() };
      });
    },
    portal_workarounds: function () {
      var S = secIssues(), g = {};
      db.docs.forEach(function (d) {
        var t = null, kind = null;
        if (d.collection === "reports" && !sec(d)) { t = d.data.fix; kind = "report"; }
        else if (d.collection === "sessions" && !notApp(d)) { t = d.data.helped; kind = "session"; }
        if (!kind || !counted(d)) return;
        var iid = effIssue(d);
        if (!iid || iid === "new" || (!isAdmin() && S.indexOf(iid) >= 0)) return;
        var st = db.docs.find(function (x) { return x.collection === "studies" && x.id === d.study_id; });
        function use(wk, key, text) {
          var o = g[iid + "|" + wk + "|" + key] = g[iid + "|" + wk + "|" + key] || { issue_id: iid, wa_text: null, wa_key: key, wa_kind: wk, teamSet: {}, reports: 0, sessions: 0, credited: {}, last_at: d.created_at, recs: {} };
          if (o.recs[d.id]) return;
          o.recs[d.id] = 1;
          if (d.study_id) o.teamSet[d.study_id] = 1;
          o[kind + "s"]++;
          if (st && (st.data.showName || isAdmin() || isMember(st.id))) o.credited[st.data.name] = 1;
          if (d.created_at >= o.last_at) o.last_at = d.created_at;
          if (text && (o.wa_text === null || d.created_at >= o.text_at || !o.text_at)) { o.wa_text = String(text).trim(); o.text_at = d.created_at; }
        }
        var k = norm(t);
        if (k && NOT_A_FIX.indexOf(k) < 0) use("text", k, t);
        /* Picks (helpedPicks, fixPicks): a team workaround pick adds to the row with the same words (its id is
           the normalized text, or 'md5:' + its hash); a guide step or stopgap gets its own row. */
        picks(d).forEach(function (p) {
          if (p.kind === "step" || p.kind === "stopgap") { use(p.kind, String(p.id), null); return; }
          if (p.kind !== "team") return;
          var id = String(p.id), key = id;
          db.docs.forEach(function (x) { var tx = norm(x.collection === "reports" ? x.data.fix : x.data.helped);
            if (tx && (id === "md5:" + fakeHash(tx) || id === fakeHash(tx))) key = tx; });
          use("text", key, null);
        });
      });
      /* Like the database: hidden ones are left out for everyone. wa_hide stands in for md5(key). */
      function hiddenFor(iid) { var i = db.docs.find(function (x) { return x.collection === "issues" && x.id === iid; });
        return (i && Array.isArray(i.data.hiddenWorkarounds)) ? i.data.hiddenWorkarounds : []; }
      return Object.keys(g).map(function (k) { var o = g[k];
        return { issue_id: o.issue_id, wa_text: o.wa_text, wa_key: o.wa_key, wa_kind: o.wa_kind, teams: Object.keys(o.teamSet).length, reports: o.reports, sessions: o.sessions, credited: Object.keys(o.credited), last_at: o.last_at, wa_hide: fakeHash(o.wa_key) }; })
        .filter(function (r) { var h = hiddenFor(r.issue_id); return r.wa_kind !== "text" || (h.indexOf("md5:" + r.wa_hide) < 0 && h.indexOf(r.wa_key) < 0); });
    },
    portal_issue_scores: function () {
      var S = secIssues();
      var devish = isAdmin() || hasAnyRole("dev") || hasAnyRole("platform");
      var SP = { slowed: 1, prevented: 2, dropout: 3, none: 0 }, DP = { none: 0, missing: 2, wrong: 3, unknown: 2 };
      var M = (window.Portal && window.Portal.C && window.Portal.C.IMPACT_GOALS) || { stops: {}, data: {}, cost: {} };
      var out = {};
      db.docs.filter(function (d) { return d.collection === "reports" && !sec(d) && counted(d); }).forEach(function (d) {
        var iid = effIssue(d); if (!iid || iid === "new" || (!isAdmin() && S.indexOf(iid) >= 0)) return;
        var o = out[iid] = out[iid] || { issue_id: iid, sum: 0, n: 0, studies: {}, teams: {}, stops: {}, data: {} };
        /* An answer is one value (older reports) or an array (D24): severity takes the most severe answer
           in each question; tallies and goal threats count every answer (as portal_issue_scores). */
        var C = window.Portal && window.Portal.calc;
        var ans = function (k) { return C && C.answers ? C.answers(d.data, k) : (d.data[k] ? [].concat(d.data[k]) : []); };
        var sp = null, dp = null;
        ans("stops").forEach(function (a) { if (Object.prototype.hasOwnProperty.call(SP, a)) sp = Math.max(sp === null ? 0 : sp, SP[a]); });
        ans("data").forEach(function (a) { if (Object.prototype.hasOwnProperty.call(DP, a)) dp = Math.max(dp === null ? 0 : dp, DP[a]); });
        if (sp !== null && dp !== null) {
          o.sum += sp + dp; o.n++;
          if (d.study_id) o.teams[d.study_id] = 1;
          ans("stops").forEach(function (a) { if (Object.prototype.hasOwnProperty.call(SP, a)) o.stops[a] = (o.stops[a] || 0) + 1; });
          ans("data").forEach(function (a) { if (Object.prototype.hasOwnProperty.call(DP, a)) o.data[a] = (o.data[a] || 0) + 1; });
        }
        var st = d.study_id && db.docs.find(function (x) { return x.collection === "studies" && x.id === d.study_id; });
        var rg = st && Array.isArray(st.data.researcherGoals) ? st.data.researcherGoals.slice(0, 3) : [];
        if (!rg.length) return;
        var goals = [];
        ["stops", "data", "cost"].forEach(function (k) { ans(k).forEach(function (a) { if (M[k] && Object.prototype.hasOwnProperty.call(M[k], a)) goals = goals.concat(M[k][a]); }); });
        var p = 0; goals.forEach(function (gl) { var ix = rg.indexOf(gl); if (ix >= 0) p = Math.max(p, 3 - ix); });
        o.studies[d.study_id] = Math.max(o.studies[d.study_id] || 0, p);
      });
      /* Sessions that ended without a fix, per issue (they count toward breadth, not severity). */
      var unfixed = {};
      db.docs.filter(function (d) { return d.collection === "sessions" && counted(d) && (eff(d) === "not_fixed" || eff(d) === "no_fix_yet"); })
        .forEach(function (d) { var iid = effIssue(d); if (!iid || (!isAdmin() && S.indexOf(iid) >= 0)) return; unfixed[iid] = (unfixed[iid] || 0) + 1;
          if (!out[iid]) out[iid] = { issue_id: iid, sum: 0, n: 0, studies: {}, teams: {}, stops: {}, data: {} }; });
      function r1(x) { return Math.round(x * 10) / 10; }
      return Object.keys(out).map(function (k) { var o = out[k]; var ks = Object.keys(o.studies).map(function (s) { return o.studies[s]; });
        var gp = {}; ks.forEach(function (p) { gp[String(p)] = (gp[String(p)] || 0) + 1; });
        return { issue_id: o.issue_id, sev_reports: o.n ? r1(o.sum / o.n) : null, sev_n: o.n,
          goal_weight: ks.length && (devish || ks.length >= 3) ? r1(ks.reduce(function (a, b) { return a + b; }, 0) / ks.length) : null, goal_studies: ks.length,
          sev_studies: Object.keys(o.teams).length, stops_tally: o.n ? o.stops : null, data_tally: o.n ? o.data : null,
          sessions_unfixed: unfixed[k] || 0, goal_points: devish && ks.length ? gp : null }; });
    },
    /* Public lines from proposals: what's planned, and the reason when the decision is Not now. Nothing else. */
    portal_proposal_lines: function () {
      var S = secIssues(), out = [];
      db.docs.filter(function (d) { return d.collection === "proposals"; })
        .sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); })
        .forEach(function (p) {
          var planned = String(p.data.planned || "").trim();
          var nn = p.data.decision === "not-now" ? String(p.data.notNowReason || "").trim() : "";
          if (!planned && !nn) return;
          (Array.isArray(p.data.issues) ? p.data.issues : []).forEach(function (iid) {
            if (!isAdmin() && S.indexOf(iid) >= 0) return;
            out.push({ issue_id: iid, planned: planned || null, not_now_reason: nn || null, updated_at: p.updated_at });
          });
        });
      return out;
    },
    /* Dev meeting details. The report link only for developers, the platform team and admins. */
    portal_meeting: function () {
      var m = db.meeting || { lastMeeting: ago(14).slice(0, 10), reportUrl: "", updatedAt: null };
      var devish = isAdmin() || hasAnyRole("dev") || hasAnyRole("platform");
      return { lastMeeting: m.lastMeeting || "", reportUrl: devish ? (m.reportUrl || "") : null, updatedAt: m.updatedAt || null };
    },
    portal_set_meeting: function (a) {
      if (!isAdmin()) throw err("42501", "Only admins change the meeting details.");
      var d = String(a.p_last_meeting || "").trim(), u = String(a.p_report_url || "").trim();
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw err("22023", "The meeting date must look like 2026-10-26.");
      if (u && !/^https:\/\/\S+$/i.test(u)) throw err("22023", "The report link must start with https:// and have no spaces.");
      db.meeting = { lastMeeting: d, reportUrl: u, updatedAt: new Date().toISOString() }; save();
      return RPC.portal_meeting();
    },
    portal_goal_tallies: function () {
      /* Same 3-study minimum as the database. The demo has 2 studies, so this returns nothing. */
      var rows = {}, totals = { researcher: 0, participant: 0 };
      db.docs.filter(function (d) { return d.collection === "studies" && String(d.data.test) !== "true"; }).forEach(function (s) {
        [["researcher", s.data.researcherGoals], ["participant", s.data.participantGoals]].forEach(function (pair) {
          (pair[1] || []).forEach(function (goal, i) {
            if (!goal) return;
            var r = rows[pair[0] + "|" + goal] = rows[pair[0] + "|" + goal] || { kind: pair[0], goal: goal, ranked_first: 0, in_top3: 0 };
            if (i === 0) { r.ranked_first++; totals[pair[0]]++; }
            if (i < 3) r.in_top3++;
          });
        });
      });
      return Object.keys(rows).map(function (k) { return rows[k]; }).filter(function (r) { return totals[r.kind] >= 3; })
        .map(function (r) { r.studies_ranked = totals[r.kind]; return r; });
    },
    /* "Not an app problem" sessions per reason, entry and day. Counts only: no study, no author. */
    portal_not_app: function () {
      var g = {};
      db.docs.filter(function (d) { return notApp(d) && counted(d); }).forEach(function (d) {
        var r = d.data.notAppReason || "", e = d.data.entryId || "", day = String(d.created_at).slice(0, 10);
        var o = g[r + "|" + e + "|" + day] = g[r + "|" + e + "|" + day] || { not_app_reason: r, entry_id: e, day: day, n: 0 };
        o.n++;
      });
      return Object.keys(g).map(function (k) { return g[k]; });
    },
    portal_triage_counts: function () {
      function open(d) { return ((d.data.triage && d.data.triage.state) || "new") === "new"; }
      var s = db.docs.filter(function (d) { return d.collection === "sessions" && counted(d); });
      var r = db.docs.filter(function (d) { return d.collection === "reports" && counted(d); });
      return [{ sessions_7d: s.filter(function (d) { return Date.parse(d.created_at) > Date.now() - 7 * 864e5; }).length,
        not_fixed_open: s.filter(function (d) { return eff(d) === "not_fixed" && open(d); }).length,
        new_problems_open: s.filter(function (d) { return eff(d) === "new_problem" && open(d); }).length,
        new_reports_open: r.filter(function (d) { return d.data.issueId === "new" && !d.data.linkedIssueId && open(d) && !sec(d); }).length }];
    },
    portal_triage_items: function () {
      if (!(isAdmin() || hasAnyRole("dev") || hasAnyRole("platform"))) return [];
      function open(d) { return ((d.data.triage && d.data.triage.state) || "new") === "new"; }
      var out = [];
      db.docs.forEach(function (d) {
        if (!counted(d)) return;
        if (d.collection === "sessions" && ["not_fixed", "new_problem"].indexOf(eff(d)) >= 0 && open(d))
          out.push({ kind: "session", item_id: d.id, at: d.created_at, entry_id: d.data.entryId, outcome: eff(d), phone: d.data.phone,
            issue_id: d.data.issueId || null, what: d.data.newProblem && d.data.newProblem.what, title: null, symptom: null });
        if (d.collection === "reports" && d.data.issueId === "new" && !d.data.linkedIssueId && open(d) && !sec(d))
          out.push({ kind: "report", item_id: d.id, at: d.created_at, entry_id: null, outcome: null, phone: d.data.setup && d.data.setup.phone,
            issue_id: null, what: null, title: d.data.newTitle, symptom: d.data.newSymptom });
      });
      return out.sort(function (a, b) { return b.at.localeCompare(a.at); });
    }
  };

  window.PortalDemo = {
    roles: ROLE_VIEWS.slice(),
    uid: uid,
    setUid: function (u) { ssSet(UID_KEY, u); window.__demoUid = u; },
    reset: function () { ssDel(DB_KEY); }
  };

  window.supabase = {
    createClient: function () {
      return {
        auth: {
          getSession: async function () { var u = user(); return { data: { session: { user: { id: u.id, email: u.email } } } }; },
          signInWithPassword: async function () { return { error: null }; },
          signOut: async function () { /* nothing to sign out of */ }
        },
        from: q,
        rpc: async function (name, args) {
          if (!RPC[name]) return { data: null, error: { message: "function " + name + " does not exist" } };
          try { return { data: RPC[name](args || {}), error: null }; } catch (e) { return { data: null, error: e }; }
        },
        channel: function () { var c = { on: function (_a, _b, fn) { listeners.push(fn); return c; }, subscribe: function () { return c; } }; return c; }
      };
    }
  };
})();
