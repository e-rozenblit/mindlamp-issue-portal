/* Troubleshoot a participant page: the guide engine and flow map. Owner: B1. Spec: SPEC.md 3, 4 (sessions), 5, 7.2.
   All content comes from window.GUIDE_CONTENT (data/guide-content.js, via P.guide()). Nothing here names
   a study, team, site or person. One finished path writes exactly one session (store.add); follow-up
   answers are added with store.patch. An unfinished path lives in sessionStorage, tied to the person
   signed in. Starting over or signing out partway saves the steps so far as an "ended early" session. */
(function () {
  "use strict";
  const P = window.Portal;

  const KEY = "ip-guide-run";
  const MAX_HOPS = 60;
  const OTHER = "Other / something in between";
  /* The "other" answer in words that fit the step (UX quick win): questions and actions get their own. */
  const OTHER_Q = "None of these, or not sure";
  const OTHER_A = "Partly, or not sure";
  function otherLabel(kind) { return kind === "question" ? OTHER_Q : kind === "action" ? OTHER_A : OTHER; }
  const ENGINE_FIXED = "__fixed";      // the "fixed" ending the engine makes when an action has no fixedNext
  const MISSING = "__missing";         // a broken link in the content
  const ANSWER_LABEL = { fixed: "Fixed", not_fixed: "Not fixed", other: OTHER, next: "Done" };
  const OS_LABEL = { ios: "iPhone", android: "Android" };
  const DEVICE_HINT = "On the dashboard's Users tab, hover over Last Active to see the phone model and app version. It sometimes says unknown.";
  /* Info button (D24: secondary text opens on hover, tap and keyboard). Falls back to a fold before core has it. */
  const info = (content, label) => (P.ui.info ? P.ui.info(content, label)
    : P.ui.el("details", { class: "more" }, P.ui.el("summary", { text: label || "More" }), content));
  const DATA_RISK = "This deletes data the phone has not uploaded yet.";
  const CHANGED = [["", "Choose one (optional)"], ["update", "The app or phone updated"], ["staff", "Staff changed something in the dashboard"],
    ["move", "New phone, travel, or a new network"], ["none", "Nothing, or not sure"]];
  /* Ending headings when core has no label. Core's C.OUTCOMES wins, so Home, Report and the dev table match. */
  const OUTCOME_FALLBACK = { fixed: "Fixed", unconfirmed: "Fix not confirmed yet", not_fixed: "Still not fixed", no_fix_yet: "No fix yet",
    new_problem: "New problem", ended_early: "Ended early", not_app: "Not an app problem" };
  /* Contract 2026-10-28: helpers from core, with fallbacks until core has them. */
  const CONTACT = () => (P.C && P.C.CONTACT) || "mindlamp@bidmc.harvard.edu";
  const effOutcome = s => (P.calc.effectiveOutcome ? P.calc.effectiveOutcome(s) : ((s.followUp && s.followUp.final) || s.outcome));
  /* Fixes left for later: the contract's `fixes`, else the suggested-fixes marks kept in `path`. */
  const laterFixesOf = s => (Array.isArray(s.fixes) ? s.fixes.filter(f => f.mark === "later").map(f => f.node)
    : (s.path || []).filter(p => p.group && p.kind === "action" && p.answer === "later").map(p => p.node));
  function openSessions() {
    if (P.calc.openSessions) { try { return P.calc.openSessions() || []; } catch (e) { return []; } }
    const uid = P.S.user && P.S.user.uid;
    return (P.S.sessions || []).filter(s => s.author === uid && !s.followUp && (effOutcome(s) === "unconfirmed" || laterFixesOf(s).length))
      .map(s => ({ id: s.id, created: s.created || s.finishedAt || s.startedAt || "", entryId: s.entryId, issueId: s.issueId, studyId: s.studyId, laterFixes: laterFixesOf(s) }))
      .sort((a, b) => String(b.created).localeCompare(String(a.created)));
  }
  /* "Ask the platform team" always names the address (D25). */
  function contactLine(before, after) {
    const a = P.ui.el("a", { href: "mailto:" + CONTACT(), text: CONTACT() });
    return P.ui.el("span", {}, before || "", a, after || "");
  }
  /* Basis labels the guide guarantees, whatever core says. */
  const BASIS_FALLBACK = { platform: ["Platform team practice", "What the mindLAMP platform team does when troubleshooting."] };
  const MAP_PREF = "ip-guide-map-full";
  /* Safe fixes (stage 3) are shown together (D24). Each fix gets one mark; an unmarked fix counts as "Not now". */
  const FIX_MARKS = [["fixed", "Tried, it worked"], ["not_fixed", "Tried, didn't work"], ["later", "Not tried yet"]];
  const FIX_LABEL = { fixed: "Tried, it worked", not_fixed: "Tried, didn't work", later: "Not tried yet" };
  const WHO_LABEL = { "participant-now": "Participant, now", "participant-later": "Participant, later", "staff-now": "Staff", platform: "Platform team" };
  const UNCONFIRMED_END = "common.unconfirmed";

  /* ---------- content access ---------- */
  function G() { return P.guide() || { entries: [], nodes: {}, stopgaps: {} }; }
  function entries() { return (G().entries || []).slice().sort((a, b) => (num(a.order) - num(b.order))); }
  function num(v) { const n = Number(v); return isNaN(n) ? 50 : n; }
  function entryById(id) { return (G().entries || []).find(e => e.id === id) || null; }
  function otherEntry() { return (G().entries || []).find(e => e.id === "other") || (G().entries || []).find(e => e.group === "other") || null; }
  function nodeOf(id) {
    if (id === ENGINE_FIXED) return { kind: "end", ending: "fixed", text: "" };
    if (id === MISSING) return { kind: "end", ending: "", text: "" };
    const n = (G().nodes || {})[id];
    return n || null;
  }
  function stopgapsOf(ids) {
    const all = G().stopgaps || {};
    return (ids || []).filter(id => all[id]).map(id => Object.assign({ id: id }, all[id]));
  }
  function targetLabel(t) {
    if (typeof t !== "string" || !t) return "";
    if (t[0] === "@") { const e = entryById(t.slice(1)); return e ? "Go to: " + e.title : ""; }
    const n = nodeOf(t);
    if (!n) return "";
    if (n.kind === "end") return n.short || P.C.OUTCOMES[n.ending] || "";
    return n.short || "";
  }

  /* ---------- run state (sessionStorage; per-browser only) ---------- */
  function blankRun(keep) {
    return { v: 1, uid: (P.S.user && P.S.user.uid) || "", studyId: "", phone: (keep && keep.phone) || "", entryId: "", startedAt: "", path: [], skips: [],
      cur: "", ended: null, sessionId: "", saveState: "", saveError: "", noteDraft: {}, fixMarks: {}, follow: { draft: {}, sent: {} } };
  }
  let run = blankRun();
  function loadRun() {
    let raw = null;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) return;
    try {
      const r = JSON.parse(raw);
      if (!r || r.v !== 1) return;
      /* Never resume someone else's path (a shared lab computer). */
      if (!r.uid || r.uid !== P.S.user.uid) { clearRun(); return; }
      run = Object.assign(blankRun(), r);
      /* Older runs kept one "sent" flag for all follow-up answers. */
      if (!run.follow || typeof run.follow !== "object") run.follow = { draft: {}, sent: {} };
      if (!run.follow.sent || typeof run.follow.sent !== "object") run.follow.sent = run.follow.sent ? { device: true, helped: true, details: true } : {};
      if (run.entryId && !entryById(run.entryId)) run = blankRun();
    } catch (e) { run = blankRun(); }
  }
  function saveRun() { try { sessionStorage.setItem(KEY, JSON.stringify(run)); } catch (e) { /* ignore */ } }
  function clearRun() { run = blankRun(); undo = null; try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  function ctxFor(studyId, phone) { return Object.assign({}, P.calc.studyFacts(studyId), { os: phone || "" }); }
  function stepCount(path) { return path.filter(p => p.kind !== "jump").length; }
  function outcomeLabel(o) { return (P.C.OUTCOMES && P.C.OUTCOMES[o]) || OUTCOME_FALLBACK[o] || "Done"; }
  function basisInfo(tag) {
    const t = tag;
    const fb = BASIS_FALLBACK[t] || null;
    const label = (P.C.BASIS && P.C.BASIS[t]) || (fb && fb[0]) || t;
    const help = (P.C.BASIS_HELP && P.C.BASIS_HELP[t]) || (fb && fb[1]) || "";
    return { label: label, help: help };
  }
  /* Demo mode (?demo=1): everything stays in this browser. Never claim anything was sent. */
  function isDemo() {
    if (P.demo || P.DEMO || (P.S && P.S.demo)) return true;
    try { return /[?&]demo=1(&|$)/.test(window.location.search); } catch (e) { return false; }
  }
  /* A test or demo study (data.test): its sessions don't count toward any issue. */
  function isTestStudy(id) { const st = id ? P.calc.study(id) : null; return !!(st && st.test); }

  /* The session's issue: the entry's, refined by options, jumps and the end node along the path. */
  function issueIdOf(r) {
    const e = entryById(r.entryId);
    let id = (e && e.issueId) || null;
    r.path.forEach(p => {
      if (p.kind === "question" && typeof p.answer === "number") {
        const n = nodeOf(p.node);
        const o = n && (n.options || [])[p.answer];
        /* An option with an issueId key decides; null means "a different cause, no issue". */
        if (o && Object.prototype.hasOwnProperty.call(o, "issueId")) id = o.issueId || null;
      } else if (p.kind === "jump") {
        const je = entryById(String(p.node).slice(1));
        if (je) id = je.issueId || null;
      }
    });
    /* The end node decides last: an explicit issueId (null clears it), else a new_problem ending clears it. */
    const endId = (r.ended && r.ended.node) || r.cur;
    const end = endId ? nodeOf(endId) : null;
    if (end && end.kind === "end") {
      if (Object.prototype.hasOwnProperty.call(end, "issueId")) id = end.issueId || null;
      else if (end.ending === "new_problem") id = null;
    }
    return id;
  }
  function fixedByOf(path) {
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].kind !== "action" || path[i].answer !== "fixed") continue;
      /* On the suggested-fixes screen several can work; the one the path followed is marked chosen. */
      if (path[i].group) { const c = path.find(q => q.group === path[i].group && q.chosen); if (c) return c.node; }
      return path[i].node;
    }
    return null;
  }
  function isFixStep(n) { return !!(n && n.kind === "action" && Number(n.stage) === 3); }
  function isNoteStep(n) { return !!(n && n.kind === "info" && Number(n.stage) === 3); }
  /* The suggested-fixes screen opens on a fix, or on a stage-3 info step that leads into fixes (shown there as "Good to know"). */
  function isFixScreen(id) { const n = nodeOf(id); return isFixStep(n) || (isNoteStep(n) && fixChain(id).ids.length > 0); }
  /* Follow when/skip rules without moving (the chain of fixes is read ahead of the path). */
  function resolveSkip(t, skipped) {
    for (let hops = 0; hops < MAX_HOPS; hops++) {
      if (typeof t !== "string" || !t || t[0] === "@") return t;
      const n = nodeOf(t);
      if (!n) return t;
      if (n.when && n.skip && !P.calc.matchWhen(n.when, ctxFor(run.studyId, run.phone))) { if (skipped) skipped.push(t); t = n.skip; continue; }
      return t;
    }
    return t;
  }
  /* The stage-3 fixes for this path: notFixedNext from the first fix while the next step is also a fix.
     safe: in chain order; risky (last resort or can lose data): kept apart, also in chain order. */
  function fixChain(startId) {
    const ids = [], notes = [], skipped = [], seen = new Set();
    let t = startId;
    while (typeof t === "string" && t && t[0] !== "@" && !seen.has(t) && (isFixStep(nodeOf(t)) || isNoteStep(nodeOf(t)))) {
      seen.add(t);
      const n = nodeOf(t);
      if (isFixStep(n)) { ids.push(t); t = resolveSkip(n.notFixedNext, skipped); }
      else { notes.push(t); t = resolveSkip(n.next, skipped); }
    }
    const risky = id => { const n = nodeOf(id); return !!(n.lastResort || n.dataRisk); };
    return { ids: ids, notes: notes, safe: ids.filter(id => !risky(id)), risky: ids.filter(risky), skipped: skipped, after: t };
  }
  function submitFixes() {
    const id = run.cur;
    if (run.ended || !isFixScreen(id)) return;
    const chain = fixChain(id);
    const order = chain.safe.concat(chain.risky);
    const marks = run.fixMarks || {};
    const chosen = order.find(x => marks[x] === "fixed") || "";
    /* Review round 10-28 (D20, D24 retention over complete data): when every safe fix failed, the session can
       go to the platform team without the data-losing last resort being tried. */
    const tried = x => marks[x] === "fixed" || marks[x] === "not_fixed";
    const allTried = order.length && (order.every(tried) || (chain.safe.length > 0 && chain.safe.every(x => marks[x] === "not_fixed")));
    const note = String(run.noteDraft[id] || "").trim().slice(0, P.C.LIMITS.note);
    /* A step skipped once is listed once, even after Back and a second Continue. */
    chain.skipped.forEach(x => { if (!run.skips.some(s => s.node === x)) run.skips.push({ at: run.path.length, node: x }); });
    chain.notes.forEach(x => run.path.push({ node: x, kind: "info", answer: "next", label: "Good to know", note: "", group: id }));
    order.forEach((x, i) => {
      const m = marks[x] || "later";
      const e = { node: x, kind: "action", answer: m, label: FIX_LABEL[m], note: i === 0 ? note : "", group: id };
      if (x === chosen) e.chosen = true;
      run.path.push(e);
    });
    delete run.noteDraft[id];
    run.fixMarks = {};
    undo = null;
    run.was = null;
    advance(chosen ? (nodeOf(chosen).fixedNext || ENGINE_FIXED) : allTried ? chain.after : UNCONFIRMED_END);
    afterMove();
  }

  /* ---------- engine ---------- */
  /* Move to target: follow "@entry" jumps and when/skip rules until a node to show. */
  function advance(target) {
    let t = target;
    for (let hops = 0; hops < MAX_HOPS; hops++) {
      if (typeof t !== "string" || !t) { run.cur = MISSING; return; }
      if (t[0] === "@") {
        const e = entryById(t.slice(1));
        if (!e || !e.start) { run.cur = MISSING; return; }
        run.path.push({ node: t, kind: "jump", answer: "next", label: "Continued with: " + e.title, note: "" });
        t = e.start;
        continue;
      }
      const n = nodeOf(t);
      if (!n) { run.cur = MISSING; return; }
      if (n.when && n.skip && !P.calc.matchWhen(n.when, ctxFor(run.studyId, run.phone))) {
        run.skips.push({ at: run.path.length, node: t });
        t = n.skip;
        continue;
      }
      run.cur = t;
      return;
    }
    run.cur = MISSING;
  }

  function startEntry(entryId) {
    const e = entryById(entryId);
    if (!e) return;
    const keepPhone = run.phone;
    run = blankRun();
    undo = null;
    run.phone = keepPhone;
    run.studyId = P.calc.inStudy(P.S.studyId) ? P.S.studyId : "";
    run.entryId = e.id;
    run.startedAt = new Date().toISOString();
    pendingEntry = "";
    advance(e.start);
    afterMove();
  }

  function answer(ans) {
    const id = run.cur;
    const n = nodeOf(id);
    if (!n || n.kind === "end" || run.ended) return;
    const note = String(run.noteDraft[id] || "").trim().slice(0, P.C.LIMITS.note);
    let label = ans === "other" ? otherLabel(n.kind) : (ANSWER_LABEL[ans] || "");
    let next = null;
    if (n.kind === "question") {
      if (typeof ans === "number") {
        const o = (n.options || [])[ans];
        if (!o) return;
        label = o.label; next = o.next;
      } else { next = n.otherNext; }
    } else if (n.kind === "action") {
      next = ans === "fixed" ? (n.fixedNext || ENGINE_FIXED) : n.notFixedNext;
    } else {
      next = ans === "other" ? (n.otherNext || n.next) : n.next;
    }
    run.path.push({ node: id, kind: n.kind, answer: ans, label: label, note: note });
    delete run.noteDraft[id];
    undo = null;
    run.was = null;
    advance(next);
    afterMove();
  }

  /* Tap an earlier answer: go back to that step and drop everything after it. One Undo is offered. */
  let undo = null;
  function goBack(index) {
    if (run.ended) return;
    let p = run.path[index];
    if (!p || p.kind === "jump") return;
    /* A fix from the suggested-fixes screen reopens the whole screen, with its marks. */
    const grp = p.group ? run.path.filter(q => q.group === p.group) : null;
    if (grp) { index = run.path.findIndex(q => q.group === p.group); p = run.path[index]; }
    undo = { path: run.path.slice(), skips: run.skips.slice(), cur: run.cur, noteDraft: Object.assign({}, run.noteDraft),
      fixMarks: Object.assign({}, run.fixMarks || {}), from: stepCount(run.path.slice(0, index)) + 1, to: stepCount(run.path) + 1 };
    run.path = run.path.slice(0, index);
    run.skips = run.skips.filter(s => s.at <= index);
    const back = grp ? p.group : p.node;
    const pn = grp ? (grp.find(q => q.note) || {}).note : p.note;
    if (pn) run.noteDraft[back] = pn;
    run.fixMarks = {};
    if (grp) grp.forEach(q => { run.fixMarks[q.node] = q.answer; });
    run.cur = back;
    run.was = grp ? null : { node: p.node, answer: p.answer };  /* marks the earlier answer on the reopened step */
    saveRun();
    drawRun(true);
  }
  /* The Back button on a step reopens the last answered step (jumps between problems are skipped). */
  function lastAnswerIndex() {
    for (let i = run.path.length - 1; i >= 0; i--) if (run.path[i].kind !== "jump") return i;
    return -1;
  }
  function undoBack() {
    if (!undo || run.ended) return;
    run.path = undo.path; run.skips = undo.skips; run.cur = undo.cur; run.noteDraft = undo.noteDraft; run.fixMarks = undo.fixMarks || {};
    undo = null;
    run.was = null;
    saveRun();
    drawRun(true);
  }

  function afterMove() {
    const n = nodeOf(run.cur);
    if (n && n.kind === "end" && run.cur !== MISSING) finish();
    saveRun();
    drawAll(true);
  }

  /* ---------- the session record ---------- */
  function finish() {
    const end = nodeOf(run.cur);
    run.ended = { node: run.cur, outcome: end.ending, finishedAt: new Date().toISOString() };
    saveSession();
  }
  function sessionRecord() {
    const end = nodeOf(run.ended.node) || {};
    const outcome = run.ended.outcome;
    /* "unconfirmed": a step seemed to fix it but nobody could check. It gets no fix credit. */
    const tried = (outcome === "fixed" || outcome === "unconfirmed") ? fixedByOf(run.path) : null;
    const fixedBy = outcome === "fixed" ? tried : null;
    const fn = fixedBy ? nodeOf(fixedBy) : null;
    const tn = outcome === "unconfirmed" && tried ? nodeOf(tried) : null;
    const rec = {
      studyId: run.studyId,
      entryId: run.entryId,
      issueId: issueIdOf(run),
      phone: run.phone || "unsure",
      /* group/chosen: fixes marked together on the suggested-fixes screen, so per-fix results can be counted. */
      path: run.path.map(p => Object.assign({ node: p.node, kind: p.kind, answer: p.answer, label: p.label, note: p.note || "" },
        p.group ? { group: p.group } : {}, p.chosen ? { chosen: true } : {})),
      outcome: outcome,
      fixedBy: fixedBy,
      fixedByText: fn ? (fn.text || "") : "",
      helped: "",
      stopgapsShown: (outcome === "fixed" || outcome === "ended_early") ? [] : stopgapsOf(end.stopgaps).map(s => s.id),
      contentVersion: G().version || "",
      startedAt: run.startedAt,
      finishedAt: run.ended.finishedAt
    };
    if (outcome === "unconfirmed") { rec.untestedFix = tried; rec.untestedFixText = tn ? (tn.text || "") : ""; }
    /* Contract 2026-10-28: each fix marked on the suggested-fixes screen. */
    const FIX_MARK = { fixed: "worked", not_fixed: "didnt", later: "later" };
    const fixes = run.path.filter(p => p.group && p.kind === "action").map(p => ({ node: p.node, mark: FIX_MARK[p.answer] || "later" }));
    if (fixes.length) rec.fixes = fixes;
    if (outcome === "not_app") rec.notAppReason = String(end.notAppReason || "");
    if (outcome === "not_fixed") rec.device = { model: "", osVersion: "", appVersion: "" };
    if (outcome === "new_problem") rec.newProblem = { what: "", since: "", changed: "" };
    return rec;
  }
  /* Starting over or signing out partway: save the steps so far. No choice to skip logging. */
  async function saveEarly() {
    if (!run.entryId || run.ended || !run.path.length) return;
    run.ended = { node: run.cur, outcome: "ended_early", finishedAt: new Date().toISOString() };
    saveRun();
    await saveSession();
  }
  let saving = false;
  async function saveSession() {
    if (!run.ended || run.sessionId || saving) return;
    if (!run.studyId || !P.calc.inStudy(run.studyId)) { run.saveState = "local"; saveRun(); drawSaveStatus(); return; }
    saving = true;
    run.saveState = "saving"; run.saveError = "";
    saveRun(); drawSaveStatus();
    try {
      run.sessionId = await P.store.add("sessions", sessionRecord());
      run.saveState = "saved";
    } catch (e) {
      run.saveState = "failed";
      run.saveError = P.writeError(e);
    }
    saving = false;
    saveRun(); drawSaveStatus();
  }
  /* After a reload in the middle of saving: adopt the saved row if it exists, else save again. */
  function resumeSave() {
    if (!run.ended || run.sessionId || saving || run.saveState !== "saving") return;
    if (!P.S.loaded.sessions) return;
    const found = (P.S.sessions || []).find(s => s.author === P.S.user.uid && s.startedAt === run.startedAt && s.entryId === run.entryId);
    if (found) { run.sessionId = found.id; run.saveState = "saved"; saveRun(); drawSaveStatus(); return; }
    run.saveState = "";
    saveSession();
  }
  async function patchFollow(partial) { return patchSession(run.sessionId, partial); }
  async function patchSession(sid, partial) {
    const path = "sessions/" + sid;
    try { await P.store.patch(path, partial); }
    catch (e) {
      /* Before the migration, patch needs the row loaded. Load it once and try again. */
      if (e && e.code === "42501" && !(P.S.sessions || []).some(s => s.id === sid)) {
        await P.store.reload("sessions");
        await P.store.patch(path, partial);
      } else { throw e; }
    }
  }

  /* ---------- view ---------- */
  const V = {};
  let built = false;
  let pendingEntry = "";
  let follow = null;   /* the saved session open for follow-up, or null */
  let mq = null;

  function build() {
    const { el, pageHead } = P.ui;
    const C = P.C;
    const sec = P.section("guide");

    V.sample = el("p", { class: "notice warn", hidden: true, text: "This guide has sample steps only. The full guide is on its way." });
    V.testNote = el("p", { class: "notice", hidden: true, text: "Test study. Nothing saved here counts toward any issue." });

    /* 1. Study and phone */
    V.studySel = el("select", { "aria-label": "Study" });
    V.studySel.addEventListener("change", () => { V.studyOpen = false; V.studyChange.setAttribute("aria-expanded", "false"); P.setStudy(V.studySel.value); });
    V.studyField = P.ui.field("Study", V.studySel);
    /* The study shows as text (audit item 10); the select opens only on "Change study". */
    V.studyName = el("b", {});
    V.studyChange = el("button", { type: "button", class: "mini", "aria-expanded": "false", text: "Change study" });
    V.studyChange.addEventListener("click", () => {
      V.studyOpen = !V.studyOpen;
      V.studyChange.setAttribute("aria-expanded", String(V.studyOpen));
      refreshStart();
      if (V.studyOpen) { try { V.studySel.focus(); } catch (e) { /* ignore */ } }
    });
    V.studyLine = el("p", { class: "g-studyline" }, el("span", { text: "Study: " }), V.studyName, " ", V.studyChange);
    V.noStudy = el("p", { class: "notice", hidden: true });
    V.notMember = el("p", { class: "notice", hidden: true, text: "Practice run: you aren't in this study, so nothing is saved." });
    V.phoneBtns = C.PHONES.map(([id, label]) => {
      const b = el("button", { type: "button", class: "g-phone", "aria-pressed": "false", "data-phone": id, text: label });
      b.addEventListener("click", () => pickPhone(id));
      return b;
    });
    V.phoneMsg = el("p", { class: "hint", role: "status" });
    V.start = el("div", { class: "panel g-start" },
      el("h3", { text: "1. Study and phone" }),
      V.studyLine, V.studyField, V.noStudy, V.notMember,
      el("div", { class: "g-phones-wrap" },
        el("span", { class: "g-label", id: "g-phone-label", text: "Phone type" }),
        el("div", { class: "g-phones", role: "group", "aria-labelledby": "g-phone-label" }, V.phoneBtns)),
      V.phoneMsg);

    /* 2. Problem picker */
    const oth = otherEntry();
    V.picker = P.ui.cardPicker({
      label: "Search",
      placeholder: "For example: no reminders",
      groups: C.ENTRY_GROUPS,
      last: oth ? { id: oth.id, title: oth.title || "Something else", description: oth.description || "" } : null,
      emptyText: "No match. Try other words, or pick \"" + ((oth && oth.title) || "Something else") + "\".",
      onPick: id => pickEntry(id)
    });
    V.pick = el("div", { class: "panel g-pick" }, el("h3", { text: "2. The problem" }), V.picker);

    /* 3. The run. Run mode (audit item 3): only the status line sits above the step, so the question and its
       answers fit on screen during a call. Earlier answers go below the step. */
    V.map = el("div", { class: "g-map" });
    V.flowSum = el("summary", { text: "Show the path" });
    V.flow = el("details", { class: "g-flow panel" }, V.flowSum, V.map);
    V.summary = el("div", { class: "g-summary" });
    V.trail = el("ol", { class: "g-trail", "aria-labelledby": "g-trail-label" });
    V.trailHint = el("span", { class: "hint", hidden: true });
    V.trailLabel = el("span", { class: "k", id: "g-trail-label", text: "Your answers so far" });
    V.trailWrap = el("div", { class: "g-trailwrap" },
      el("div", { class: "g-trailhead" }, V.trailLabel, V.trailHint),
      V.trail);
    V.step = el("div", { class: "g-stepwrap" });
    V.steps = el("div", { class: "g-steps" }, V.summary, V.step, V.trailWrap);
    V.run = el("div", { class: "g-run" }, V.flow, V.steps);

    V.head = pageHead(P.PAGE_COPY.guide);
    foldHead(V.head);
    /* Follow-up later (D24): the person's open sessions, and one session opened to record what happened. */
    V.openList = el("div", { class: "panel g-open", hidden: true });
    V.follow = el("div", { class: "g-follow", hidden: true });
    sec.replaceChildren(V.head, V.sample, V.testNote, V.follow, V.openList, V.start, V.pick, V.run);

    try {
      mq = window.matchMedia("(min-width: 900px)");
      const apply = () => { V.flow.open = mq.matches; };
      apply();
      if (mq.addEventListener) mq.addEventListener("change", apply); else if (mq.addListener) mq.addListener(apply);
    } catch (e) { /* ignore */ }
    built = true;
  }

  /* Page head: title and one line; the numbered steps fold behind "How this works" (decided 10-27).
     If core already folds them, leave its version alone. */
  function foldHead(head) {
    const ol = head && head.querySelector("ol.howto");
    if (!ol || ol.closest("details")) return;
    const d = P.ui.el("details", { class: "g-howto" }, P.ui.el("summary", { text: "How this works" }));
    ol.replaceWith(d);
    d.append(ol);
  }

  /* Put the status line and the step at the top of the screen, just below the sticky tabs. */
  function scrollToStep() {
    try {
      const nav = document.querySelector("nav.tabs");
      const off = (nav && !nav.hidden ? nav.getBoundingClientRect().height : 0) + 8;
      const y = V.summary.getBoundingClientRect().top + window.pageYOffset - off;
      if (Math.abs(V.summary.getBoundingClientRect().top - off) > 4) window.scrollTo(0, Math.max(0, y));
    } catch (e) { /* ignore */ }
  }

  function pickPhone(id) {
    run.phone = id;
    saveRun();
    V.phoneMsg.textContent = "";
    refreshStart();
    if (pendingEntry) startEntry(pendingEntry);
  }
  function pickEntry(id) {
    if (!run.phone) {
      pendingEntry = id;
      V.phoneMsg.textContent = "Pick the phone type to start.";
      try { V.start.scrollIntoView({ block: "start" }); V.phoneBtns[0].focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      return;
    }
    startEntry(id);
  }
  async function startOver(ask) {
    const partway = run.entryId && !run.ended && run.path.length;
    if (ask && partway) {
      const saves = run.studyId && P.calc.inStudy(run.studyId);
      if (!window.confirm(saves ? "Start over? The steps so far are saved as a session that ended early."
        : "Start over? This run isn't saved to a study.")) return;
    }
    if (partway) await saveEarly();
    clearRun();
    pendingEntry = "";
    V.issueBox = null; V.saveLine = null; V.sendBtns = [];
    V.step.replaceChildren(); V.trail.replaceChildren(); V.map.replaceChildren();
    V.picker.clear();
    drawAll(false);
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    try { V.phoneBtns[0].focus(); } catch (e) { /* ignore */ }
  }

  function drawAll(focusStep) {
    const inRun = !!run.entryId;
    const inFollow = !!follow;
    V.sample.hidden = !G().sample;
    V.follow.hidden = !inFollow;
    V.start.hidden = inRun || inFollow;
    V.pick.hidden = inRun || inFollow;
    V.run.hidden = !inRun || inFollow;
    if (V.head) V.head.classList.toggle("g-running", inRun || inFollow);
    drawTestNote();
    if (inFollow) { V.openList.hidden = true; drawFollow(focusStep); return; }
    if (inRun) { V.openList.hidden = true; drawRun(focusStep); } else refreshStart();
  }
  function drawTestNote() {
    const id = run.entryId ? run.studyId : (V.studySel && V.studySel.value) || P.S.studyId;
    V.testNote.hidden = !isTestStudy(id);
  }

  /* Start screen lists: safe to call on every data refresh. */
  function refreshStart() {
    const { el } = P.ui;
    const ids = P.calc.myStudies();
    const cur = V.studySel.value;
    V.studySel.replaceChildren(...ids.map(id => el("option", { value: id, text: P.calc.studyName(id) === "A team" ? id : P.calc.studyName(id) })));
    V.studySel.value = ids.includes(P.S.studyId) ? P.S.studyId : (ids.includes(cur) ? cur : (ids[0] || ""));
    const curName = P.calc.studyName(V.studySel.value);
    V.studyName.textContent = curName === "A team" ? V.studySel.value : curName;
    V.studyLine.hidden = !ids.length;
    V.studyChange.hidden = ids.length < 2;
    V.studyField.hidden = !ids.length || (ids.length > 1 ? !V.studyOpen : true);
    V.noStudy.hidden = !!ids.length;
    /* Developers and the platform team aren't meant to join a study: for them a run is practice. */
    V.noStudy.replaceChildren(P.calc.canSeeProposals && P.calc.canSeeProposals() ? "Practice run: nothing here is saved."
      : contactLine("You aren't in a study yet, so nothing here is saved. To be added, email ", "."));
    V.notMember.hidden = !ids.length || !V.studySel.value || P.calc.inStudy(V.studySel.value);
    V.phoneBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.phone === run.phone)));
    const ctx = ctxFor(P.S.studyId, run.phone);
    const oth = otherEntry();
    const items = entries()
      .filter(e => !oth || e.id !== oth.id)
      .filter(e => P.calc.matchWhen(e.when, ctx))
      .map(e => ({ id: e.id, title: e.title || e.id, description: e.description || "", phrases: e.phrases || [], group: e.group || "" }));
    V.picker.setItems(items);
    if (pendingEntry) V.picker.setSelected(pendingEntry);
    drawTestNote();
    drawOpenList();
  }

  function drawRun(focusStep) {
    drawSummary();
    drawTrail();
    drawStep();
    renderFlowMap(V.map, { entry: entryById(run.entryId), nodes: G().nodes || {}, path: run.path, currentId: run.cur,
      skips: run.skips, ended: run.ended, entries: G().entries || [], full: mapFull() });
    if (focusStep) {
      const h = V.step.querySelector("[data-focus]");
      if (h) { try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      scrollToStep();
    }
  }
  /* Flow map view: the path taken (default) or every branch (remembered per browser). */
  function mapFull() { try { return localStorage.getItem(MAP_PREF) === "1"; } catch (e) { return false; } }
  function setMapFull(on) { try { localStorage.setItem(MAP_PREF, on ? "1" : "0"); } catch (e) { /* ignore */ } }

  /* The problem picked, and the one the path moved on to ("Continued with"), so the line stays true. */
  function problemText(e) {
    const jumps = run.path.filter(p => p.kind === "jump" && typeof p.node === "string" && p.node[0] === "@");
    const last = jumps.length ? entryById(jumps[jumps.length - 1].node.slice(1)) : null;
    const first = e ? e.title : "";
    return last && last !== e ? first + ", now: " + last.title : first;
  }
  function drawSummary() {
    const { el } = P.ui;
    const e = entryById(run.entryId);
    const studyText = run.studyId ? P.calc.studyName(run.studyId) : "Not saved to a study";
    const again = el("button", { type: "button", class: "btn ghost", text: run.ended ? "Start a new session" : "Start over" });
    again.addEventListener("click", () => startOver(!run.ended));
    V.summary.replaceChildren(
      el("dl", { class: "g-facts" },
        el("div", {}, el("dt", { text: "Study" }), el("dd", { text: studyText })),
        el("div", {}, el("dt", { text: "Phone" }), el("dd", { text: phoneName(run.phone) })),
        el("div", {}, el("dt", { text: "Problem" }), el("dd", { text: problemText(e) }))),
      again);
  }
  /* A step's short label for "label: answer" lines, without a trailing "?" or ":". */
  function stepName(n, fallback) { return String((n && (n.short || n.text)) || fallback || "").replace(/[?:.\s]+$/, "").replace(/:\s+/g, ", "); }
  function phoneName(id) { const p = P.C.PHONES.find(x => x[0] === id); return p ? p[1] : "Not sure"; }

  function drawTrail() {
    const { el } = P.ui;
    const items = run.path.map((p, i) => {
      const n = nodeOf(p.node);
      const name = p.kind === "jump" ? "" : stepName(n, p.node) + ": ";
      const text = name + (p.label || "") + (p.note ? " (note added)" : "");
      if (p.kind === "jump" || run.ended) return el("li", { class: "g-done" + (p.kind === "jump" ? " jump" : "") }, el("span", { text: text }));
      const b = el("button", { type: "button", class: "g-back", "aria-label": "Go back to this step: " + text, text: text });
      b.addEventListener("click", () => goBack(i));
      return el("li", { class: "g-done" }, b);
    });
    V.trail.replaceChildren(...items);
    V.trailWrap.hidden = !items.length;
    if (V.trailLabel) V.trailLabel.textContent = run.ended ? "Your answers" : "Your answers so far";
  }

  /* "Why" with its basis. Each basis chip explains itself on a tap (not only in a tooltip). The step's
     basis stays visible without a tap (D21). */
  function whyBlock(why, basis) {
    const { el } = P.ui;
    if (!why && !(basis && basis.length)) return null;
    const help = el("p", { class: "hint g-basis-help", hidden: true });
    const chips = (basis || []).map(t => {
      const b = basisInfo(t);
      const c = el("button", { type: "button", class: "chip basis g-basis-btn", "aria-expanded": "false", title: b.help, text: b.label });
      c.addEventListener("click", () => {
        const open = c.getAttribute("aria-expanded") !== "true";
        chips.forEach(x => x.setAttribute("aria-expanded", "false"));
        c.setAttribute("aria-expanded", String(open));
        help.hidden = !open || !b.help;
        help.textContent = open && b.help ? b.label + ": " + b.help : "";
      });
      return c;
    });
    /* Review round 10-28: the why is the fact people need, so it shows in plain view; the basis chips stay
       visible beside it (D21, D24: the source is named by the tag). */
    return el("div", { class: "g-why" },
      why ? el("p", { class: "hint g-why-text", text: why }) : null,
      chips.length ? el("div", { class: "g-basis" }, el("span", { class: "hint", text: "How we know:" }), chips) : null,
      help);
  }

  function drawStep() {
    const { el, chip } = P.ui;
    const C = P.C;
    const n = nodeOf(run.cur);
    if (run.ended) { drawEnding(); return; }
    if (!n || run.cur === MISSING) {
      V.step.replaceChildren(el("div", { class: "panel g-step" },
        el("h3", { tabindex: "-1", "data-focus": "", text: "This step is missing from the guide." }),
        el("p", {}, contactLine("Email ", " with the problem you picked, then press Start over."))));
      return;
    }
    if (isFixScreen(run.cur)) { drawFixes(); return; }
    const osOnly = n.when && n.when.os ? (Array.isArray(n.when.os) ? n.when.os : [n.when.os]) : null;
    const stageName = String(C.STAGES[n.stage] || "").toLowerCase();
    const backIdx = lastAnswerIndex();
    const meta = el("div", { class: "g-meta" },
      backIdx >= 0 ? btn("Back", "btn ghost g-backstep", () => goBack(backIdx)) : null,
      n.stage ? chip("Stage " + n.stage + " of 5" + (stageName ? ": " + stageName : ""), "g-stage") : null,
      osOnly ? chip(osOnly.map(o => OS_LABEL[o] || o).join(" or ") + " only") : null,
      n.lastResort ? chip("Last resort", "sev hi") : null);

    const note = el("textarea", { maxlength: String(C.LIMITS.note), rows: "2", "aria-label": "Note for this step (optional)" });
    note.value = run.noteDraft[run.cur] || "";
    note.addEventListener("input", () => { run.noteDraft[run.cur] = note.value; saveRun(); });
    const noteBox = el("details", { class: "g-note" },
      el("summary", { text: note.value ? "Note added" : "Add a note" }),
      P.ui.field("Note (optional)", note, C.PRIVACY_HINT));
    if (note.value) noteBox.open = true;

    /* After Back, the answer given before is marked in words, not only by color. */
    const was = run.was && run.was.node === run.cur ? run.was.answer : undefined;
    const opt = (text, cls, ans) => {
      const b = btn(text, cls, () => answer(ans));
      if (ans === was) { b.classList.add("was"); b.append(el("span", { class: "g-was", text: "Your earlier answer" })); }
      return b;
    };
    let answers;
    if (n.kind === "question") {
      answers = el("div", { class: "g-answers", role: "group", "aria-label": "Answers" },
        (n.options || []).map((o, i) => opt(o.label, "btn big g-opt", i)),
        hasOwnOther(n) ? null : opt(OTHER_Q, "btn ghost g-opt", "other"));
    } else if (n.kind === "action") {
      answers = el("fieldset", { class: "g-answers" },
        el("legend", { text: "Did that fix it?" }),
        el("div", { class: "g-row" },
          opt("Fixed", "btn", "fixed"),
          opt("Not fixed", "btn", "not_fixed"),
          opt(OTHER_A, "btn ghost", "other")));
    } else {
      answers = el("div", { class: "g-answers" }, el("div", { class: "g-row" },
        opt("Next", "btn", "next"),
        opt(OTHER, "btn ghost", "other")));
    }

    /* Order for a live call: the question, any caution, the answers; then why, basis and the note. */
    let undoRow = null;
    if (undo) {
      const u = btn("Undo", "btn ghost", () => undoBack());
      const what = undo.to - undo.from > 1 ? "Went back. Your later answers will be replaced." : "Went back one step.";
      undoRow = el("div", { class: "g-undo g-row", role: "status" }, el("span", { text: what }), u);
    }
    /* The path just moved to another problem: say so, so the change of questions makes sense. */
    const lastP = run.path[run.path.length - 1];
    const switched = lastP && lastP.kind === "jump" && entryById(String(lastP.node).slice(1));
    V.step.replaceChildren(el("div", { class: "panel g-step" + (n.dataRisk ? " risk" : "") },
      undoRow,
      switched ? el("p", { class: "notice g-switch", role: "status", text: "Switched to: " + switched.title }) : null,
      meta,
      el("h3", { tabindex: "-1", "data-focus": "", text: n.text || n.short || "" }),
      (n.caution || n.dataRisk) ? el("div", { class: "caution", role: "note" },
        n.caution ? el("p", { text: n.caution }) : null,
        n.dataRisk ? el("p", {}, el("b", { text: DATA_RISK })) : null) : null,
      answers,
      whyBlock(n.why, n.basis),
      noteBox));
  }
  /* Suggested fixes (D24): every stage-3 fix for this path on one screen, so staff can compare and choose.
     Data-safe fixes first in chain order; last-resort fixes that can lose data sit apart with their caution. */
  function drawFixes() {
    const { el, chip } = P.ui;
    const C = P.C;
    const id = run.cur;
    const chain = fixChain(id);
    run.fixMarks = run.fixMarks || {};
    const backIdx = lastAnswerIndex();
    const meta = el("div", { class: "g-meta" },
      backIdx >= 0 ? btn("Back", "btn ghost g-backstep", () => goBack(backIdx)) : null,
      chip("Stage 3 of 5", "g-stage"));
    const status = el("p", { class: "hint g-fixnext", role: "status" });
    const update = () => {
      const order = chain.safe.concat(chain.risky);
      const m = run.fixMarks;
      const worked = order.some(x => m[x] === "fixed");
      const all = order.every(x => m[x] === "fixed" || m[x] === "not_fixed");
      status.textContent = worked || all ? "" : "Anything you don't try now is saved for later. Record how it went from the Home page.";
    };
    const card = x => {
      const n = nodeOf(x);
      const osOnly = n.when && n.when.os ? (Array.isArray(n.when.os) ? n.when.os : [n.when.os]) : null;
      const name = "g-fix-" + String(x).replace(/\W/g, "_");
      const marks = FIX_MARKS.map(([k, label]) => {
        const r = el("input", { type: "radio", name: name, value: k });
        r.checked = run.fixMarks[x] === k;
        r.addEventListener("change", () => { if (r.checked) { run.fixMarks[x] = k; saveRun(); update(); } });
        return el("label", { class: "g-mark g-mark-" + k }, r, el("span", { text: label }));
      });
      const title = n.short || n.text || "";
      return el("li", { class: "g-fix" + (n.lastResort || n.dataRisk ? " risk" : ""), "data-node": x },
        el("div", { class: "g-meta" },
          n.lastResort ? chip("Last resort", "sev hi") : null,
          n.who && WHO_LABEL[n.who] ? chip(WHO_LABEL[n.who]) : null,
          osOnly ? chip(osOnly.map(o => OS_LABEL[o] || o).join(" or ") + " only") : null),
        el("h4", { text: title }),
        n.short && n.text && n.text !== n.short ? el("p", { text: n.text }) : null,
        (n.caution || n.dataRisk) ? el("div", { class: "caution", role: "note" },
          n.caution ? el("p", { text: n.caution }) : null,
          n.dataRisk ? el("p", {}, el("b", { text: DATA_RISK })) : null) : null,
        el("fieldset", { class: "g-marks" }, el("legend", { class: "fm-sr", text: "What happened: " + title }), marks),
        whyBlock(n.why, n.basis));
    };
    const note = el("textarea", { maxlength: String(C.LIMITS.note), rows: "2", "aria-label": "Note on these fixes (optional)" });
    note.value = run.noteDraft[id] || "";
    note.addEventListener("input", () => { run.noteDraft[id] = note.value; saveRun(); });
    const noteBox = el("details", { class: "g-note" }, el("summary", { text: note.value ? "Note added" : "Add a note" }),
      P.ui.field("Note (optional)", note, C.PRIVACY_HINT));
    if (note.value) noteBox.open = true;
    let undoRow = null;
    if (undo) undoRow = el("div", { class: "g-undo g-row", role: "status" },
      el("span", { text: undo.to - undo.from > 1 ? "Went back. Your later answers will be replaced." : "Went back one step." }), btn("Undo", "btn ghost", () => undoBack()));
    const anyRisk = chain.risky.some(x => nodeOf(x).dataRisk);
    V.step.replaceChildren(el("div", { class: "panel g-step g-fixes" },
      undoRow,
      meta,
      el("h3", { tabindex: "-1", "data-focus": "", text: "Suggested fixes" }),
      el("p", { class: "g-fixsub", text: "Least disruptive first. Mark each one you try." }),
      chain.notes.length ? el("div", { class: "g-block g-goodtoknow" }, el("div", { class: "k", text: "Good to know" }),
        el("ul", { class: "clean" }, chain.notes.map(x => { const n = nodeOf(x); return el("li", { "data-node": x },
          el("p", {}, n.short && n.text !== n.short ? el("b", { text: n.short + ": " }) : null, n.text || n.short || ""),
          n.caution ? el("div", { class: "caution", role: "note" }, el("p", { text: n.caution })) : null,
          whyBlock(n.why, n.basis)); }))) : null,
      chain.safe.length ? el("ol", { class: "g-fixlist" }, chain.safe.map(card)) : null,
      chain.risky.length ? el("div", { class: "g-lastresort" },
        el("h4", { class: "g-lr-head", text: anyRisk ? "Last resort: can lose data" : "Last resort" }),
        el("ol", { class: "g-fixlist" }, chain.risky.map(card))) : null,
      el("div", { class: "g-row" }, btn("Continue", "btn g-fixgo", () => {
        /* A stray tap shouldn't end the session with nothing recorded. */
        if (!chain.ids.some(x => run.fixMarks[x])) { status.textContent = "Mark at least one fix first."; return; }
        submitFixes();
      })),
      status,
      noteBox));
    update();
  }
  /* A question whose own options already say "not sure" or "none of these" doesn't get a second one (D20 still holds:
     that option is the step's "other" answer). */
  function hasOwnOther(n) {
    return (n.options || []).some(o => /not sure|don.t know|none of these|can.t check|unsure/i.test(String(o.label || "")));
  }
  function btn(text, cls, fn) {
    const b = P.ui.el("button", { type: "button", class: cls, text: text });
    b.addEventListener("click", fn);
    return b;
  }

  /* ---------- endings ---------- */
  /* Honest endings (audit item 4). The session is saved, and sent for triage, the moment the ending shows.
     So every ending opens with one status line that says what happened to it. On "not fixed", the phone
     questions come first, while the participant is still on the call. */
  function triedSteps() { return run.path.filter(p => p.kind === "action" && p.answer !== "later"); }
  /* The confirm step that ended in "not confirmed yet": the last answered question that went there. */
  function checkLaterText(path) {
    path = path || run.path;
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i];
      if (p.kind !== "question" || typeof p.answer !== "number") continue;
      const n = nodeOf(p.node);
      const o = n && (n.options || [])[p.answer];
      if (o && o.next === UNCONFIRMED_END) return n.checkLater || n.text || "";
    }
    return "";
  }
  function drawEnding() {
    const { el } = P.ui;
    const C = P.C;
    const end = nodeOf(run.ended.node) || {};
    const outcome = run.ended.outcome;
    const parts = [];
    V.sendBtns = [];
    const tried = triedSteps();
    const title = outcome === "not_fixed" && !tried.length ? "Needs the platform team" : outcomeLabel(outcome);
    parts.push(el("h3", { tabindex: "-1", "data-focus": "", text: title }));
    V.saveLine = el("div", { class: "g-save", role: "status" });
    parts.push(V.saveLine);
    const sg = stopgapsOf(end.stopgaps);
    const fu = run.follow.draft;
    V.issueBox = null;

    if (outcome === "fixed") {
      const fb = fixedByOf(run.path);
      const fn = fb ? nodeOf(fb) : null;
      if (fn) parts.push(el("p", {}, el("b", { text: "Fixed by: " }), (fn.short || fn.text) + "."));
      if (end.text) parts.push(el("p", { text: end.text }));
    }

    if (outcome === "unconfirmed") {
      const fb = fixedByOf(run.path);
      const fn = fb ? nodeOf(fb) : null;
      if (fn) parts.push(el("p", {}, el("b", { text: "Seemed to help: " }), (fn.short || fn.text) + "."));
      const later = checkLaterText();
      if (later) parts.push(el("div", { class: "g-block g-later" }, el("div", { class: "k", text: "Still to check" }), el("p", { text: later })));
      /* Fixes left for later on the suggested-fixes screen. */
      const notYet = run.path.filter(p => p.group && p.answer === "later");
      if (notYet.length) parts.push(el("div", { class: "g-block g-later" }, el("div", { class: "k", text: "Not tried yet" }),
        el("ul", { class: "clean" }, notYet.map(p => el("li", { text: stepName(nodeOf(p.node), p.node) })))));
      /* Results are added to this session later (D24), so a content line about starting a new session doesn't apply. */
      if (end.text && !/new session/i.test(end.text)) parts.push(el("p", { text: end.text }));
      if (run.saveState !== "local") parts.push(el("p", { class: "g-comeback", text: "To record how it went, open this session again from Home or Troubleshoot." }));
    }

    if (outcome === "not_fixed") {
      if (end.text) parts.push(el("p", { text: end.text }));
      const model = followInput("model", "Phone model (optional)", 80);
      const os = followInput("osVersion", "Phone OS version (optional)", 40, "In the phone's Settings, under About.");
      const app = followInput("appVersion", "mindLAMP app version (optional)", 40);
      parts.push(el("div", { class: "g-block g-ask" }, el("div", { class: "k g-askhead" }, "Before you hang up, ask: ", info(el("p", { text: DEVICE_HINT }), "Where else to find these")),
        el("div", { class: "grid2" }, model.field, os.field, app.field),
        sendRow("device", "Save phone details", "Update phone details", () => ({
          device: { model: model.input.value.trim(), osVersion: os.input.value.trim(), appVersion: app.input.value.trim() },
          stopgapsShown: sg.map(s => s.id)
        }), "Phone details saved to the session.")));
      /* The steps tried are already in "Your answers" and the path map, so they aren't listed a third time. */
      if (sg.length) parts.push(stopgapBlock(sg));
      /* Review round 10-28: shown in plain view, since this is the moment before the call ends. */
      if ((end.collect || []).length) parts.push(el("div", { class: "g-block g-collect" },
        el("div", { class: "k" }, "The platform team may ask for"),
        el("ul", { class: "clean" }, end.collect.map(t => el("li", { text: t })))));
      parts.push(helpedBlock(sg));
    }

    if (outcome === "no_fix_yet") {
      if (end.text) parts.push(el("p", { text: end.text }));
      V.issueBox = el("div", { class: "g-block g-issue" });
      fillIssueBox();
      parts.push(V.issueBox);
      /* The content's end text usually says this already; say it only when it doesn't. */
      if (!end.text && run.saveState !== "local") parts.push(el("p", { text: "This session counts toward how common this problem is." }));
      if (sg.length) parts.push(stopgapBlock(sg));
      parts.push(helpedBlock(sg));
    }

    if (outcome === "new_problem") {
      if (end.text) parts.push(el("p", { text: end.text }));
      const what = el("input", { type: "text", maxlength: String(C.LIMITS.what), value: fu.what || "" });
      what.addEventListener("input", () => { fu.what = what.value; saveRun(); });
      const since = el("input", { type: "text", maxlength: "80", value: fu.since || "", placeholder: "For example: since last week, or since the app updated" });
      since.addEventListener("input", () => { fu.since = since.value; saveRun(); });
      const changed = P.ui.select(CHANGED, fu.changed || "");
      changed.addEventListener("change", () => { fu.changed = changed.value; saveRun(); });
      parts.push(el("div", { class: "g-block g-ask" }, el("div", { class: "k", text: "Before you hang up, ask:" }),
        P.ui.field("In a few words, what is on the screen?", what, C.PRIVACY_HINT),
        P.ui.field("Since when?", since),
        P.ui.field("What changed just before it started?", changed, "Many problems start right after an app or phone update or a dashboard change."),
        sendRow("details", "Save these details", "Update these details",
          () => ({ newProblem: { what: what.value.trim(), since: since.value.trim(), changed: changed.value } }), "Details saved to the session.")));
      if (sg.length) parts.push(stopgapBlock(sg));
    }

    if (outcome === "not_app") {
      if (end.text) parts.push(el("p", { text: end.text }));
      parts.push(el("p", { class: "g-notapp", text: "This isn't counted as an app problem. The platform team looks at these when thinking about new features." }));
      if (sg.length) parts.push(stopgapBlock(sg, "What may help"));
    }

    /* "Start a new session" sits in the summary above, once. */
    V.step.replaceChildren(el("div", { class: "panel g-step g-end g-end-" + outcome }, parts));
    drawSaveStatus();
  }

  /* "What helped" (D24, contract 2026-10-28): tick any of this problem's existing suggestions and/or write your own.
     Ticks are saved as helpedPicks ({ kind, id }), which P.calc.suggestionUse and portal_workarounds count per team;
     the typed text stays in `helped`. */
  function helpSuggestions(sg, issueId, tried) {
    const out = [];
    const seen = new Set();
    const add = (key, text, label, meta) => {
      const k = P.calc.norm(text || "");
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push({ key: key, text: String(text).trim(), label: String(label || text).trim(), meta: meta || "" });
    };
    /* Stopgaps and other teams' workarounds first: on these endings the steps tried didn't fix it. */
    sg.forEach(s => add("sg:" + s.id, s.text, s.text, ""));
    const iss = issueId ? P.calc.issue(issueId) : null;
    let w = null;
    if (iss && P.calc.workarounds) { try { w = P.calc.workarounds(iss); } catch (e) { w = null; } }
    if (w) {
      (w.confirmed || []).forEach(x => add("wa:" + P.calc.norm(x.text || ""), x.text, x.text, "Confirmed by the platform team"));
      (w.guide || []).forEach(x => add(x.nodeId ? "node:" + x.nodeId : "sg:" + x.stopgapId, x.text, x.text, ""));
      (w.platform || []).forEach(x => add("wa:" + P.calc.norm(x.text || ""), x.text, x.text, ""));
      (w.team || []).forEach(x => add("wa:" + (x.key || P.calc.norm(x.text || "")), x.text, x.text,
        "Used by " + (x.teams || 1) + ((x.teams || 1) > 1 ? " teams" : " team")));
    }
    (tried || []).forEach(p => { const n = nodeOf(p.node); if (n && n.text) add("node:" + p.node, n.text, n.short || n.text, "Tried"); });
    return out;
  }
  const PICK_KIND = { sg: "stopgap", node: "step", wa: "team" };
  function pickOf(key) { const i = key.indexOf(":"); return { kind: PICK_KIND[key.slice(0, i)] || "team", id: key.slice(i + 1) }; }
  /* The picker alone (endings and follow-up share it). draft: { picks: {key: true}, helpedOwn }; onChange saves the draft. */
  function helpedPicker(list, draft, onChange) {
    const { el } = P.ui;
    if (!draft.picks || typeof draft.picks !== "object") draft.picks = {};
    /* Older drafts kept one pick, or only the typed text. */
    if (draft.helpedPick && draft.helpedPick !== "own" && draft.helpedPick !== "none") { draft.picks[draft.helpedPick] = true; delete draft.helpedPick; }
    if (!draft.helpedOwn && draft.helped) draft.helpedOwn = draft.helped;
    const own = el("textarea", { maxlength: String(P.C.LIMITS.helped), rows: "2", "aria-label": list.length ? "Something else that helped" : "What helped" });
    own.value = draft.helpedOwn || "";
    own.addEventListener("input", () => { draft.helpedOwn = own.value; onChange(); });
    const ownHint = "Other teams see this. No names, IDs or other details that identify a person.";
    const box = list.length
      ? el("fieldset", { class: "g-helped" },
        el("legend", { text: "What helped, if anything?" }),
        el("div", { class: "g-picklist" },
          list.map(x => {
            const c = el("input", { type: "checkbox", value: x.key });
            c.checked = !!draft.picks[x.key];
            c.addEventListener("change", () => { if (c.checked) draft.picks[x.key] = true; else delete draft.picks[x.key]; onChange(); });
            return el("label", { class: "g-pickrow" }, c, el("span", {}, x.label, x.meta ? el("span", { class: "hint g-pickmeta", text: " " + x.meta }) : null));
          }),
          el("div", { class: "g-own" }, P.ui.field("Something else", own, ownHint))))
      : el("div", { class: "g-helped" }, P.ui.field("What helped, if anything? (optional)", own, ownHint));
    const collect = () => ({
      helped: own.value.trim(),
      helpedPicks: list.filter(x => draft.picks[x.key]).map(x => pickOf(x.key))
    });
    return { box: box, collect: collect, keys: list.map(x => x.key) };
  }
  function helpedBlock(sg) {
    const { el } = P.ui;
    if (run.saveState === "local") return null;  /* a practice run has nothing to add to */
    const picker = helpedPicker(helpSuggestions(sg, issueIdOf(run), triedSteps()), run.follow.draft, saveRun);
    const collect = () => Object.assign(picker.collect(), { stopgapsShown: sg.map(s => s.id) });
    return el("div", { class: "g-block" }, picker.box,
      sendRow("helped", "Save what helped", "Update what helped", collect, "Saved to the session."));
  }

  function followInput(key, label, max, hint) {
    const fu = run.follow.draft;
    const input = P.ui.el("input", { type: "text", maxlength: String(max), value: fu[key] || "" });
    input.addEventListener("input", () => { fu[key] = input.value; saveRun(); });
    return { input: input, field: hint ? P.ui.field(label, input, hint) : P.ui.field(label, input) };
  }
  /* One save button per follow-up block. Each adds its answers to the saved session (store.patch). */
  function sendRow(key, label, again, collect, doneText) {
    const { el } = P.ui;
    const sent = !!(run.follow.sent && run.follow.sent[key]);
    const b = el("button", { type: "button", class: "btn g-send", text: sent ? again : label });
    const msg = el("span", { class: "hint", role: "status", text: sent ? doneText : "" });
    b.addEventListener("click", async () => {
      if (!run.sessionId) { msg.textContent = run.saveState === "local" ? "This session isn't saved, so there is nothing to add to." : "Wait until the session is saved."; return; }
      b.disabled = true; msg.textContent = "Saving...";
      try {
        await patchFollow(collect());
        run.follow.sent[key] = true; saveRun();
        msg.textContent = doneText; b.textContent = again;
      } catch (e) { msg.textContent = P.writeError(e); }
      b.disabled = false;
    });
    V.sendBtns = (V.sendBtns || []).concat([b]);
    return el("div", { class: "g-row" }, b, msg);
  }
  function stopgapBlock(list, head) {
    const { el } = P.ui;
    return el("div", { class: "g-block" },
      el("div", { class: "k", text: head || "In the meantime" }),
      el("ul", { class: "g-stopgaps" }, list.map(s => el("li", {},
        el("p", { class: "g-sg-text", text: s.text }),
        whyBlock(s.why, s.basis)))));
  }
  function fillIssueBox() {
    if (!V.issueBox) return;
    const { el, statusChip } = P.ui;
    const id = issueIdOf(run);
    const iss = id ? P.calc.issue(id) : null;
    /* Once the issue list has loaded, an issue this person can't see (or that isn't listed) shows nothing. */
    if (!iss) { V.issueBox.replaceChildren(P.S.loaded && P.S.loaded.issues ? "" : el("p", { class: "hint", text: "Loading this problem's status..." })); V.issueBox.hidden = !!(P.S.loaded && P.S.loaded.issues); return; }
    V.issueBox.hidden = false;
    const plan = P.calc.planFor ? P.calc.planFor(iss) : { planned: iss.planned || "", notNow: iss.status === "not-now" ? (iss.notNowReason || iss.statusNote || "") : "" };
    V.issueBox.replaceChildren(...[
      el("div", { class: "k", text: "Known problem" }),
      el("p", {}, el("b", { text: iss.title || iss.id }), " ", statusChip(iss.status),
        P.C.STATUS_HELP && P.C.STATUS_HELP[iss.status] ? el("span", { class: "hint", text: " " + P.C.STATUS_HELP[iss.status] }) : null),
      /* Only the issue's own "not now" reason. A set-aside idea's reason was written for its proposal and
         means nothing mid-call (D24's example). */
      plan.notNow && iss.status === "not-now" ? el("p", { text: "Why not now: " + plan.notNow }) : null,
      iss.status !== "not-now" && iss.statusNote ? el("p", { text: iss.statusNote }) : null,
      plan.planned ? el("p", { text: "What's planned: " + plan.planned }) : null].filter(Boolean));
  }
  /* The status line at the top of every ending. It only claims what happened. */
  function savedText(outcome) {
    const hasIssue = !!issueIdOf(run);
    if (isDemo()) return "Demo: nothing was sent." + (realSavedText(outcome, hasIssue) ? " On the real site: " + realSavedText(outcome, hasIssue) : "");
    if (isTestStudy(run.studyId)) return "Saved to the test study. Test sessions are left out of every count.";
    return realSavedText(outcome, hasIssue);
  }
  function realSavedText(outcome, hasIssue) {
    switch (outcome) {
      case "fixed": return "Saved to " + P.calc.studyName(run.studyId) + ".";
      case "unconfirmed": return "Saved. It counts as fixed once you record that it worked.";
      case "not_fixed": return "Sent to the platform team. They review new sessions before each dev meeting." +
        (hasIssue ? " Changes to this problem show on the Home page." : "");
      case "no_fix_yet": return "Saved to " + P.calc.studyName(run.studyId) + ".";
      case "new_problem": return "Sent to the platform team. They will sort it into a known problem or a new one.";
      case "not_app": return "Saved to " + P.calc.studyName(run.studyId) + ".";
      default: return "Saved to " + P.calc.studyName(run.studyId) + ".";
    }
  }
  function drawSaveStatus() {
    if (!V.saveLine || !run.ended) return;
    const { el } = P.ui;
    const st = run.saveState;
    const kids = [];
    if (st === "saved") kids.push(el("p", { class: "g-ok", text: savedText(run.ended.outcome) }));
    else if (st === "saving" || st === "") kids.push(el("p", { class: "hint", text: "Saving the session..." }));
    else if (st === "local") kids.push(el("p", { class: "notice" }, run.studyId || P.calc.myStudies().length
      ? "Practice run: nothing was saved. You aren't a member of this study."
      : (P.calc.canSeeProposals && P.calc.canSeeProposals() ? "Practice run: nothing was saved."
        : contactLine("Not saved: you aren't in a study yet. To be added, email ", "."))));
    else if (st === "failed") {
      kids.push(el("p", { class: "notice warn", text: "Couldn't save the session. " + (run.saveError || "") }));
      kids.push(btn("Try saving again", "btn", () => saveSession()));
    }
    V.saveLine.replaceChildren(...kids);
    (V.sendBtns || []).forEach(b => { if (b.isConnected) b.hidden = st === "local"; });
  }

  /* ---------- follow-up later (D24; contract 2026-10-28) ---------- */
  /* P.go("guide", { followUp: sessionId }) opens one of the signed-in person's saved sessions: the fixes left for
     later (and the one that seemed to help), a mark for each, a final result, and what helped. Saved with
     store.patch as followUp (+ helpedPicks / helped). Nothing here changes the run in progress. */
  const FOLLOW_MARKS = [["worked", "Worked"], ["didnt", "Didn't work"], ["not_tried", "Not tried yet"]];
  const FINALS = ["fixed", "not_fixed", "unconfirmed"];
  function followSession(id) {
    const uid = P.S.user && P.S.user.uid;
    const s = (P.S.sessions || []).find(x => x.id === id);
    return s && (!s.author || s.author === uid) ? s : null;
  }
  function followItems(s) {
    const ids = [];
    if (s.untestedFix) ids.push(s.untestedFix);
    /* A second follow-up keeps every fix from the first, so saving again doesn't drop a result. */
    ((s.followUp && s.followUp.results) || []).map(r => r.node).concat(laterFixesOf(s)).forEach(x => { if (!ids.includes(x)) ids.push(x); });
    return ids.filter(x => nodeOf(x));
  }
  function openFollow(id) {
    follow = { id: id, draft: { marks: {}, final: "", picks: {}, helpedOwn: "" }, ready: false, msg: "" };
  }
  function closeFollow() {
    follow = null;
    V.follow.replaceChildren();
    drawAll(false);
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }
  function drawFollow(focus) {
    const { el } = P.ui;
    const s = followSession(follow.id);
    const back = btn("Back", "btn ghost g-backstep", () => closeFollow());
    if (!s) {
      const loading = !(P.S.loaded && P.S.loaded.sessions);
      V.follow.replaceChildren(el("div", { class: "panel g-followup" }, el("div", { class: "g-meta" }, back),
        el("h3", { tabindex: "-1", "data-focus": "", text: "Record the result" }),
        el("p", { class: loading ? "hint" : "notice", text: loading ? "Loading the session..." : "This session isn't available. Only the person who ran it can follow up." })));
      return;
    }
    const d = follow.draft;
    if (!follow.ready) {
      /* Start from what is already saved, so a second follow-up updates the first. */
      const fu = s.followUp || {};
      (fu.results || []).forEach(r => { d.marks[r.node] = r.mark; });
      d.final = fu.final || "";
      d.helpedOwn = s.helped || "";
      (s.helpedPicks || []).forEach(x => { const pre = x.kind === "stopgap" ? "sg:" : x.kind === "step" ? "node:" : "wa:"; d.picks[pre + x.id] = true; });
      follow.ready = true;
    }
    const e = entryById(s.entryId);
    const items = followItems(s);
    const when = s.created || s.finishedAt || s.startedAt || "";
    const facts = el("dl", { class: "g-facts" },
      el("div", {}, el("dt", { text: "Problem" }), el("dd", { text: (e && e.title) || "Problem" })),
      el("div", {}, el("dt", { text: "Date" }), el("dd", { text: when ? P.ui.fmtDate(when) : "" })),
      el("div", {}, el("dt", { text: "Study" }), el("dd", { text: s.studyId ? P.calc.studyName(s.studyId) : "" })),
      el("div", {}, el("dt", { text: "Phone" }), el("dd", { text: phoneName(s.phone) })));
    const later = checkLaterText(s.path || []);
    const card = x => {
      const n = nodeOf(x);
      const name = "g-fu-" + String(x).replace(/\W/g, "_");
      const title = n.short || n.text || x;
      return el("li", { class: "g-fix" + (n.lastResort || n.dataRisk ? " risk" : ""), "data-node": x },
        x === s.untestedFix ? el("div", { class: "g-meta" }, P.ui.chip("Seemed to help")) : null,
        el("h4", { text: title }),
        n.short && n.text && n.text !== n.short ? el("p", { text: n.text }) : null,
        n.dataRisk ? el("div", { class: "caution", role: "note" }, el("p", {}, el("b", { text: DATA_RISK }))) : null,
        el("fieldset", { class: "g-marks" }, el("legend", { class: "fm-sr", text: "What happened: " + title }),
          FOLLOW_MARKS.map(([k, label]) => {
            const r = el("input", { type: "radio", name: name, value: k });
            r.checked = d.marks[x] === k;
            r.addEventListener("change", () => { if (r.checked) d.marks[x] = k; });
            return el("label", { class: "g-mark g-mark-" + k }, r, el("span", { text: label }));
          })));
    };
    const finalSet = el("fieldset", { class: "g-final" }, el("legend", { text: "Result" }),
      el("div", { class: "g-marks" }, FINALS.map(k => {
        const r = el("input", { type: "radio", name: "g-fu-final", value: k });
        r.checked = d.final === k;
        r.addEventListener("change", () => { if (r.checked) d.final = k; });
        return el("label", { class: "g-mark g-mark-" + k }, r, el("span", { text: outcomeLabel(k) }));
      })));
    /* The fixes above get their own mark, so they aren't offered again here. */
    const tried = (s.path || []).filter(p => p.kind === "action" && p.answer !== "later" && !items.includes(p.node));
    const picker = helpedPicker(helpSuggestions(stopgapsOf(s.stopgapsShown || []), s.issueId, tried), d, () => {});
    const msg = el("p", { class: "hint", role: "status", text: follow.msg || "" });
    const again = el("div", { class: "g-row" });
    const showAgain = () => {
      again.replaceChildren();
      if (follow && follow.savedFinal === "not_fixed" && e) again.append(btn("Troubleshoot again", "btn ghost", () => {
        follow = null;
        V.follow.replaceChildren();
        P.go("guide", { entryId: s.entryId });
      }));
    };
    const save = btn(s.followUp ? "Update result" : "Save result", "btn g-fusave", async () => {
      /* Review round 10-28: a fix marked Worked already says the result. */
      if (!d.final && items.some(x => d.marks[x] === "worked")) d.final = "fixed";
      if (!d.final) { msg.textContent = "Choose a result first."; return; }
      const partial = Object.assign({
        followUp: { at: new Date().toISOString(), results: items.map(x => ({ node: x, mark: d.marks[x] || "not_tried" })), final: d.final }
      }, picker.collect());
      /* An earlier pick that isn't offered here (for example a fix now listed above) stays saved. */
      const offered = new Set(picker.keys || []);
      const keyOf = x => (x.kind === "stopgap" ? "sg:" : x.kind === "step" ? "node:" : "wa:") + x.id;
      (s.helpedPicks || []).filter(x => x && x.kind && x.id && !offered.has(keyOf(x)))
        .forEach(x => { if (!partial.helpedPicks.some(y => y.kind === x.kind && y.id === x.id)) partial.helpedPicks.push(x); });
      save.disabled = true; msg.textContent = "Saving...";
      try {
        await patchSession(s.id, partial);
        follow.msg = isDemo() ? "Demo: saved in this browser only." : "Saved.";
        follow.savedFinal = d.final;
        msg.textContent = follow.msg; save.textContent = "Update follow-up";
        showAgain();
      } catch (err) { msg.textContent = P.writeError(err); }
      save.disabled = false;
    });
    V.follow.replaceChildren(el("div", { class: "panel g-followup" },
      el("div", { class: "g-meta" }, back),
      el("h3", { tabindex: "-1", "data-focus": "", text: "Record the result" }),
      facts,
      later ? el("div", { class: "g-block g-later" }, el("div", { class: "k", text: "Still to check" }), el("p", { text: later })) : null,
      items.length ? el("div", { class: "g-block" }, el("div", { class: "k", text: "Fixes" }), el("ol", { class: "g-fixlist" }, items.map(card))) : null,
      finalSet,
      el("div", { class: "g-block" }, picker.box),
      el("div", { class: "g-row" }, save, msg),
      again));
    showAgain();
    if (focus) { const h = V.follow.querySelector("[data-focus]"); if (h) { try { h.focus({ preventScroll: true }); } catch (err) { /* ignore */ } } }
  }
  /* Troubleshoot's start screen: this person's sessions still waiting for a result (same words as Start here). */
  function drawOpenList() {
    const { el } = P.ui;
    if (!V.openList) return;
    const list = run.entryId || follow ? [] : openSessions();
    V.openList.hidden = !list.length;
    if (!list.length) { V.openList.replaceChildren(); return; }
    const row = o => {
        const e = entryById(o.entryId);
        const n = (o.laterFixes || []).length;
        const b = btn("Record the result", "btn ghost g-fuopen", () => P.go("guide", { followUp: o.id }));
        b.setAttribute("data-follow", o.id);
        return el("li", { class: "g-openrow" },
          el("span", {}, el("b", { text: (e && e.title) || "Problem" }),
            el("span", { class: "hint", text: " " + [o.created ? P.ui.fmtDate(o.created) : "", n ? n + (n > 1 ? " fixes" : " fix") + " to check" : "", o.studyId && P.calc.myStudies().length > 1 ? P.calc.studyName(o.studyId) : ""].filter(Boolean).join(" · ") })),
          b);
    };
    /* A long list would push the problem picker down during a call: the newest three show, the rest fold. */
    const top = list.slice(0, 3), rest = list.slice(3);
    V.openList.replaceChildren(...[
      el("h3", { text: "Waiting for a result" }),
      el("ul", { class: "g-openlist" }, top.map(row)),
      rest.length ? el("details", { class: "g-openmore" }, el("summary", { text: rest.length + " more" }),
        el("ul", { class: "g-openlist" }, rest.map(row))) : null].filter(Boolean));
  }

  /* ---------- flow map (pure: draws only from its arguments) ---------- */
  /* o: {entry, nodes, path, currentId, skips?, ended?, entries?, full?}. Plain nested lists, no canvas.
     Default view: the path taken, one line per step with the answer given. "Show all branches" adds every
     option at each step taken and a list of every step for this problem (the full map, D20). */
  function renderFlowMap(host, o) {
    const el = P.ui.el;
    const C = P.C;
    o = o || {};
    const full = !!o.full;
    const nodes = o.nodes || {};
    const ents = o.entries || [];
    const node = id => id === ENGINE_FIXED ? { kind: "end", ending: "fixed" } : (nodes[id] || null);
    const endName = n => n.short || (C.OUTCOMES && C.OUTCOMES[n.ending]) || OUTCOME_FALLBACK[n.ending] || "";
    const tLabel = t => {
      if (typeof t !== "string" || !t) return "";
      if (t[0] === "@") { const e = ents.find(x => x.id === t.slice(1)); return e ? "Go to: " + e.title : ""; }
      const n = node(t);
      if (!n) return "";
      return n.kind === "end" ? "End: " + endName(n) : (n.short || "");
    };
    const stage = n => n && n.stage ? el("span", { class: "fm-stage", title: "Stage " + n.stage + ": " + (C.STAGES[n.stage] || ""), text: String(n.stage) }) : null;
    const items = [];
    if (o.entry) items.push(el("li", { class: "fm-item fm-start" }, el("span", { class: "fm-label", text: o.entry.title })));

    const path = o.path || [];
    const skips = o.skips || [];
    const skipItem = s => {
      const n = node(s.node);
      return el("li", { class: "fm-item fm-skip" }, stage(n), el("span", { class: "fm-label", text: "Skipped: " + ((n && n.short) || s.node) }),
        el("span", { class: "fm-why", text: "Doesn't apply to this phone or study" }));
    };
    const optionList = (n, chosen) => {
      const opts = (n.options || []).map((op, i) => ({ label: op.label, to: tLabel(op.next), on: chosen === i }));
      opts.push({ label: OTHER_Q, to: tLabel(n.otherNext), on: chosen === "other" });
      return el("ul", { class: "fm-opts" }, opts.map(x => el("li", { class: "fm-opt" + (x.on ? " on" : "") + (chosen !== undefined && !x.on ? " off" : "") },
        x.on ? el("span", { class: "fm-sr", text: "Chosen: " }) : null,
        el("span", { text: x.label }),
        x.to ? el("span", { class: "fm-to", text: "Next: " + x.to }) : null)));
    };
    const actionList = (n, result) => {
      const rows = [
        { k: "fixed", label: "Fixed", to: n.fixedNext ? tLabel(n.fixedNext) : "End: " + endName({ ending: "fixed" }) },
        { k: "not_fixed", label: "Not fixed", to: tLabel(n.notFixedNext) }
      ];
      return el("ul", { class: "fm-opts" }, rows.map(x => {
        const on = result === x.k || (x.k === "not_fixed" && result === "other");
        return el("li", { class: "fm-opt" + (on ? " on" : "") + (result !== undefined && !on ? " off" : "") },
          on ? el("span", { class: "fm-sr", text: "Result: " }) : null,
          el("span", { text: on && result === "other" ? OTHER_A : x.label }),
          x.to ? el("span", { class: "fm-to", text: "Next: " + x.to }) : null);
      }));
    };
    const infoList = (n, chosen) => {
      const rows = [{ k: "next", label: "Next", to: tLabel(n.next) }, { k: "other", label: OTHER, to: tLabel(n.otherNext || n.next) }];
      return el("ul", { class: "fm-opts" }, rows.map(x => {
        const on = chosen === x.k;
        return el("li", { class: "fm-opt" + (on ? " on" : "") + (chosen !== undefined && !on ? " off" : "") },
          on ? el("span", { class: "fm-sr", text: "Chosen: " }) : null,
          el("span", { text: x.label }), x.to ? el("span", { class: "fm-to", text: "Next: " + x.to }) : null);
      }));
    };
    /* Compact: the answer given, on one line. */
    const answerLine = p => {
      const text = p.answer === "other" ? otherLabel(p.kind) : (p.label || ANSWER_LABEL[p.answer] || "");
      return text ? el("span", { class: "fm-ans" }, el("span", { class: "fm-sr", text: "Answer: " }), text) : null;
    };

    for (let i = 0; i <= path.length; i++) {
      skips.filter(s => s.at === i).forEach(s => items.push(skipItem(s)));
      const p = path[i];
      if (!p) continue;
      if (p.kind === "jump") {
        items.push(el("li", { class: "fm-item fm-jump" }, el("span", { class: "fm-label", text: p.label })));
        continue;
      }
      const n = node(p.node);
      const label = (n && (n.short || n.text)) || p.node;
      const li = el("li", { class: "fm-item fm-" + p.kind }, stage(n), el("span", { class: "fm-label", text: label }));
      if (!full) { const a = p.kind === "info" && p.answer === "next" ? null : answerLine(p); if (a) li.append(a); }
      else if (p.kind === "question" && n) li.append(optionList(n, p.answer));
      else if (p.kind === "action" && n) li.append(actionList(n, p.answer));
      else if (p.kind === "info" && n) li.append(infoList(n, p.answer));
      if (p.note) li.append(el("span", { class: "fm-why", text: "Note added" }));
      items.push(li);
    }

    const cur = o.currentId;
    if (o.ended) {
      const outcome = o.ended.outcome;
      items.push(el("li", { class: "fm-item fm-end fm-current", "aria-current": "step" },
        el("span", { class: "fm-label", text: "End: " + (outcome === "not_fixed" && !path.some(p => p.kind === "action" && p.answer !== "later") ? "Needs the platform team"
          : ((C.OUTCOMES && C.OUTCOMES[outcome]) || OUTCOME_FALLBACK[outcome] || outcome)) })));
    } else if (cur) {
      const n = node(cur);
      const li = el("li", { class: "fm-item fm-current fm-" + ((n && n.kind) || "missing"), "aria-current": "step" },
        stage(n), el("span", { class: "fm-label" }, el("span", { class: "fm-sr", text: "Now: " }), (n && (n.short || n.text)) || "Missing step"));
      if (full && n && n.kind === "question") li.append(optionList(n));
      else if (full && n && n.kind === "action") li.append(actionList(n));
      else if (full && n && n.kind === "info" && n.next) li.append(infoList(n));
      else if (!full) li.append(el("span", { class: "fm-ans fm-now", text: "You are here" }));
      items.push(li);
    }

    /* The full map: every step this problem can reach, in the order a path meets them. */
    let all = null;
    if (full && o.entry && o.entry.start) {
      const onPath = new Set(path.map(p => p.node));
      const order = [];
      const seen = new Set();
      const queue = [o.entry.start];
      while (queue.length && order.length < 200) {
        const id = queue.shift();
        if (seen.has(id) || typeof id !== "string" || id[0] === "@") continue;
        const n = node(id);
        if (!n) continue;
        seen.add(id);
        order.push(id);
        const outs = [];
        if (n.kind === "question") { (n.options || []).forEach(x => outs.push(x.next)); outs.push(n.otherNext); }
        if (n.kind === "action") { outs.push(n.notFixedNext); if (n.fixedNext) outs.push(n.fixedNext); }
        if (n.kind === "info") { outs.push(n.next); if (n.otherNext) outs.push(n.otherNext); }
        if (n.skip) outs.push(n.skip);
        outs.forEach(t => { if (t && !seen.has(t)) queue.push(t); });
      }
      all = el("ol", { class: "fm fm-all", "aria-label": "Every step for this problem" }, order.map(id => {
        const n = node(id);
        const cls = "fm-item fm-" + n.kind + (onPath.has(id) ? " fm-visited" : "") + (id === cur && !o.ended ? " fm-here" : "");
        const label = n.kind === "end" ? "End: " + endName(n) : (n.short || n.text || id);
        const li = el("li", { class: cls }, stage(n), el("span", { class: "fm-label", text: label }));
        if (n.kind === "question") li.append(optionList(n));
        else if (n.kind === "action") li.append(actionList(n));
        else if (n.kind === "info") li.append(infoList(n));
        if (n.skip) li.append(el("span", { class: "fm-why", text: "If it doesn't apply, next: " + tLabel(n.skip) }));
        if (onPath.has(id)) li.append(el("span", { class: "fm-why", text: "On your path" }));
        return li;
      }));
    }

    const toggle = el("button", { type: "button", class: "mini fm-toggle", "aria-pressed": String(full),
      text: full ? "Show only the path taken" : "Show all branches" });
    toggle.addEventListener("click", () => {
      setMapFull(!full);
      renderFlowMap(host, Object.assign({}, o, { full: !full }));
      const t = host.querySelector(".fm-toggle");
      if (t) { try { t.focus(); } catch (e) { /* ignore */ } }
    });
    host.replaceChildren(...[
      el("div", { class: "fm-head" },
        el("div", { class: "fm-headrow" }, el("span", { class: "k" }, full ? "The full map" : "The path taken", " ",
          info(el("p", { text: "Numbers are the stages: " + [1, 2, 3, 4, 5].map(i => i + " " + String((C.STAGES && C.STAGES[i]) || "").toLowerCase()).join(", ") + "." }),
            "What the numbers mean")), toggle)),
      el("ol", { class: "fm" }, items),
      all ? el("div", { class: "fm-allhead" }, el("span", { class: "k", text: "Every step for this problem" })) : null,
      all].filter(Boolean));
  }


  /* ---------- page ---------- */
  P.register({
    id: "guide",
    order: 20,
    init() {
      loadRun(); P.beforeSignOut(() => saveEarly());
      /* Header feedback records the step in view, so the platform team knows which step it is about. */
      if (P.setFeedbackContext) P.setFeedbackContext("guide", () => run.entryId ? (run.cur || run.entryId) : "");
    },
    render(params) {
      if (!built) { build(); drawAll(false); }
      if (params === null) {
        /* Data, summary or study refresh: update lists and statuses only. Never wipe input. */
        if (follow) { if (!follow.ready) drawFollow(false); if (run.ended) resumeSave(); return; }
        if (!run.entryId) refreshStart();
        else { fillIssueBox(); resumeSave(); }
        return;
      }
      if (params && params.followUp) { openFollow(params.followUp); drawAll(true); return; }
      if (follow) { follow = null; V.follow.replaceChildren(); drawAll(false); }
      if (params && params.entryId && entryById(params.entryId)) {
        const busy = run.entryId && !run.ended && run.path.length;
        if (busy) { P.ui.toast("Finish this session first, or press Start over."); }
        else {
          if (run.entryId) clearRun();
          pendingEntry = params.entryId;
          drawAll(false);
          if (run.phone) startEntry(pendingEntry);
          else { V.phoneMsg.textContent = "Pick the phone type to start."; try { V.phoneBtns[0].focus(); } catch (e) { /* ignore */ } }
        }
        return;
      }
      if (!run.entryId) refreshStart();
      else resumeSave();
    }
  });

  /* Exposed for tests and for other pages that want to show a path (read-only). */
  P.guideMap = renderFlowMap;
})();

/* Notes on how this engine reads the content (for the integrator and content authors)
   1. Session path entries include kind "jump" (node "@entryId", answer "next") when content sends the path to
      another entry (SPEC 5). Skipped steps (when/skip) show on the map but are not saved.
   2. issueId: entry.issueId, then an option's issueId (null clears it), then the issue of an entry reached by
      an "@" jump, then the end node's issueId (null clears it; a new_problem ending with no key clears it).
   3. A node with "when" but no "skip" is shown even when it doesn't match (nowhere to go).
   4. Resume after reload mid-save: the engine looks for the author's session with the same startedAt and
      entryId before saving again, so a reload does not write a second row.
   5. Info nodes also offer "Other / something in between" (every step allows it, D20). It goes to otherNext,
      else next, and is saved as answer "other".
   6. Confirm questions may carry "checkLater" (plain text). On the "not confirmed yet" ending the engine shows
      it under "Still to check", taken from the question whose answer led to common.unconfirmed.
   7. P.guideMap(host, {entry, nodes, path, currentId, skips, ended, entries, full}) is exposed, read-only.
      full: false shows the path taken; true adds every branch and every step for the problem.
   8. Basis tag "platform" shows as "Platform team practice", from core if core has it, else from this file.
   9. Contract 2026-10-28: the session record adds `fixes` ([{node, mark: worked|didnt|later}]) when the path went
      through the suggested-fixes screen, and `notAppReason` on a not_app ending. "What helped" saves ticks as
      helpedPicks ({kind: step|stopgap|team, id}) and typed text as `helped`. P.go("guide", { followUp: id }) opens
      the person's own saved session; it patches followUp (+ helpedPicks / helped) only.
   10. A stage-3 info step that sits in a chain of stage-3 fixes (or leads into one) shows on the suggested-fixes
      screen under "Good to know", and is saved in the path as kind "info" with the screen's group. */

/* INTEGRATED (pass 2, 2026-10-28): core's C.BASIS has the "platform" key ("Platform team practice"); the
   page-head copy is in home.js; P.demo flags demo mode; test studies are left out of every count in 03;
   header feedback records the step in view (P.setFeedbackContext). Outcome names stay as in C.OUTCOMES
   until the platform team decides on new wording. */
