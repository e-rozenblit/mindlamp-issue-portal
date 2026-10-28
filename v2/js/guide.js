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
  const ANSWER_LABEL = { fixed: "Fixed", not_fixed: "Not fixed", other: OTHER, next: "Next" };
  const OS_LABEL = { ios: "iPhone", android: "Android" };
  const DEVICE_HINT = "The dashboard Users tab may show the device model and app version when you hover over Last Active. It sometimes says unknown.";
  const DATA_RISK = "This deletes data the phone has not uploaded yet.";
  const CHANGED = [["", "Choose one (optional)"], ["update", "The app or phone updated"], ["staff", "Staff changed something in the dashboard"],
    ["move", "New phone, travel, or a new network"], ["none", "Nothing, or not sure"]];
  /* Ending headings when core has no label. Core's C.OUTCOMES wins, so Home, Report and the dev table match. */
  const OUTCOME_FALLBACK = { fixed: "Fixed", unconfirmed: "Fix not confirmed yet", not_fixed: "Still not fixed", no_fix_yet: "No fix yet",
    new_problem: "New problem", ended_early: "Ended early" };
  /* Basis labels the guide guarantees, whatever core says. */
  const BASIS_FALLBACK = { platform: ["Platform team practice", "What the mindLAMP platform team does when troubleshooting."] };
  const MAP_PREF = "ip-guide-map-full";
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
      cur: "", ended: null, sessionId: "", saveState: "", saveError: "", noteDraft: {}, follow: { draft: {}, sent: {} } };
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
    for (let i = path.length - 1; i >= 0; i--) if (path[i].kind === "action" && path[i].answer === "fixed") return path[i].node;
    return null;
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
    const p = run.path[index];
    if (!p || p.kind === "jump") return;
    undo = { path: run.path.slice(), skips: run.skips.slice(), cur: run.cur, noteDraft: Object.assign({}, run.noteDraft),
      from: stepCount(run.path.slice(0, index)) + 1, to: stepCount(run.path) + 1 };
    run.path = run.path.slice(0, index);
    run.skips = run.skips.filter(s => s.at <= index);
    if (p.note) run.noteDraft[p.node] = p.note;
    run.cur = p.node;
    run.was = { node: p.node, answer: p.answer };  /* marks the earlier answer on the reopened step */
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
    run.path = undo.path; run.skips = undo.skips; run.cur = undo.cur; run.noteDraft = undo.noteDraft;
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
      path: run.path.map(p => ({ node: p.node, kind: p.kind, answer: p.answer, label: p.label, note: p.note || "" })),
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
  async function patchFollow(partial) {
    const path = "sessions/" + run.sessionId;
    try { await P.store.patch(path, partial); }
    catch (e) {
      /* Before the migration, patch needs the row loaded. Load it once and try again. */
      if (e && e.code === "42501" && !(P.S.sessions || []).some(s => s.id === run.sessionId)) {
        await P.store.reload("sessions");
        await P.store.patch(path, partial);
      } else { throw e; }
    }
  }

  /* ---------- view ---------- */
  const V = {};
  let built = false;
  let pendingEntry = "";
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
    V.studyField = P.ui.field("Study", V.studySel, "The session is saved to this study.");
    /* The study shows as text (audit item 10); the select opens only on "Change study". */
    V.studyName = el("b", {});
    V.studyChange = el("button", { type: "button", class: "mini", "aria-expanded": "false", text: "Change study" });
    V.studyChange.addEventListener("click", () => {
      V.studyOpen = !V.studyOpen;
      V.studyChange.setAttribute("aria-expanded", String(V.studyOpen));
      refreshStart();
      if (V.studyOpen) { try { V.studySel.focus(); } catch (e) { /* ignore */ } }
    });
    V.studyLine = el("p", { class: "g-studyline" }, el("span", { text: "Saving to: " }), V.studyName, " ", V.studyChange);
    V.noStudy = el("p", { class: "notice", hidden: true, text: "Ask the platform team to add you to a study. You can still read the steps, but sessions won't be saved." });
    V.notMember = el("p", { class: "notice", hidden: true, text: "You aren't a member of this study, so this run is a test and won't be saved." });
    V.phoneBtns = C.PHONES.map(([id, label]) => {
      const b = el("button", { type: "button", class: "g-phone", "aria-pressed": "false", "data-phone": id, text: label });
      b.addEventListener("click", () => pickPhone(id));
      return b;
    });
    V.phoneMsg = el("p", { class: "hint", role: "status" });
    V.start = el("div", { class: "panel g-start" },
      el("h3", { text: "1. Pick the study and the phone type" }),
      V.studyLine, V.studyField, V.noStudy, V.notMember,
      el("div", { class: "g-phones-wrap" },
        el("span", { class: "g-label", id: "g-phone-label", text: "Phone type" }),
        el("div", { class: "g-phones", role: "group", "aria-labelledby": "g-phone-label" }, V.phoneBtns)),
      V.phoneMsg);

    /* 2. Problem picker */
    const oth = otherEntry();
    V.picker = P.ui.cardPicker({
      label: "What does the person see? Search with their words.",
      placeholder: "For example: no reminders",
      groups: C.ENTRY_GROUPS,
      last: oth ? { id: oth.id, title: oth.title || "Something else", description: oth.description || "" } : null,
      emptyText: "No match. Try other words, or pick \"" + ((oth && oth.title) || "Something else") + "\".",
      onPick: id => pickEntry(id)
    });
    V.pick = el("div", { class: "panel g-pick" }, el("h3", { text: "2. Pick what the person sees" }), V.picker);

    /* 3. The run. Run mode (audit item 3): only the status line sits above the step, so the question and its
       answers fit on screen during a call. Earlier answers go below the step. */
    V.map = el("div", { class: "g-map" });
    V.flowSum = el("summary", { text: "Show the path" });
    V.flow = el("details", { class: "g-flow panel" }, V.flowSum, V.map);
    V.summary = el("div", { class: "g-summary" });
    V.trail = el("ol", { class: "g-trail", "aria-labelledby": "g-trail-label" });
    V.trailHint = el("span", { class: "hint", text: "Tap an answer to go back to that step." });
    V.trailWrap = el("div", { class: "g-trailwrap" },
      el("div", { class: "g-trailhead" }, el("span", { class: "k", id: "g-trail-label", text: "Your answers so far" }), V.trailHint),
      V.trail);
    V.step = el("div", { class: "g-stepwrap" });
    V.steps = el("div", { class: "g-steps" }, V.summary, V.step, V.trailWrap);
    V.run = el("div", { class: "g-run" }, V.flow, V.steps);

    V.head = pageHead(P.PAGE_COPY.guide);
    foldHead(V.head);
    sec.replaceChildren(V.head, V.sample, V.testNote, V.start, V.pick, V.run);

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
      try { V.phoneBtns[0].focus(); } catch (e) { /* ignore */ }
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
    V.sample.hidden = !G().sample;
    V.start.hidden = inRun;
    V.pick.hidden = inRun;
    V.run.hidden = !inRun;
    if (V.head) V.head.classList.toggle("g-running", inRun);
    drawTestNote();
    if (inRun) drawRun(focusStep); else refreshStart();
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
    V.trailHint.hidden = !!run.ended;
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
    return el("div", { class: "g-why" },
      why ? el("p", {}, el("b", { text: "Why: " }), why) : null,
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
        el("p", { text: "Tell the platform team which problem you picked. Then press Start over." })));
      return;
    }
    const osOnly = n.when && n.when.os ? (Array.isArray(n.when.os) ? n.when.os : [n.when.os]) : null;
    const stageName = String(C.STAGES[n.stage] || "").toLowerCase();
    const backIdx = lastAnswerIndex();
    const meta = el("div", { class: "g-meta" },
      backIdx >= 0 ? btn("Back", "btn ghost g-backstep", () => goBack(backIdx)) : null,
      el("span", { class: "k", text: "Step " + (stepCount(run.path) + 1) }),
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
        opt(OTHER_Q, "btn ghost g-opt", "other"));
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
      const what = undo.to - undo.from > 1 ? "Your answers to steps " + undo.from + " to " + (undo.to - 1) + " were cleared."
        : "Your answer to step " + undo.from + " was cleared.";
      undoRow = el("div", { class: "g-undo g-row", role: "status" }, el("span", { text: what }), u);
    }
    V.step.replaceChildren(el("div", { class: "panel g-step" + (n.dataRisk ? " risk" : "") },
      undoRow,
      meta,
      el("h3", { tabindex: "-1", "data-focus": "", text: n.text || n.short || "" }),
      (n.caution || n.dataRisk) ? el("div", { class: "caution", role: "note" },
        n.caution ? el("p", { text: n.caution }) : null,
        n.dataRisk ? el("p", {}, el("b", { text: DATA_RISK })) : null) : null,
      answers,
      whyBlock(n.why, n.basis),
      noteBox));
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
  function triedSteps() { return run.path.filter(p => p.kind === "action"); }
  /* The confirm step that ended in "not confirmed yet": the last answered question that went there. */
  function checkLaterText() {
    for (let i = run.path.length - 1; i >= 0; i--) {
      const p = run.path[i];
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
      if (end.text) parts.push(el("p", { text: end.text }));
    }

    if (outcome === "not_fixed") {
      if (end.text) parts.push(el("p", { text: end.text }));
      const model = followInput("model", "Phone model (optional)", 80);
      const os = followInput("osVersion", "Phone OS version (optional)", 40);
      const app = followInput("appVersion", "mindLAMP app version (optional)", 40);
      parts.push(el("div", { class: "g-block g-ask" }, el("div", { class: "k", text: "Before you hang up, ask:" }),
        el("div", { class: "grid2" }, model.field, os.field, app.field),
        el("p", { class: "hint", text: DEVICE_HINT }),
        sendRow("device", "Save phone details", "Update phone details", () => ({
          device: { model: model.input.value.trim(), osVersion: os.input.value.trim(), appVersion: app.input.value.trim() },
          stopgapsShown: sg.map(s => s.id)
        }), "Phone details saved to the session.")));
      parts.push(el("div", { class: "g-block" }, el("div", { class: "k", text: "Steps you tried" }),
        tried.length ? el("ul", { class: "clean" }, tried.map(p => el("li", { text: stepName(nodeOf(p.node), p.node) + ": " + p.label })))
          : el("p", { class: "hint", text: "No fix steps were tried on this path." })));
      if (sg.length) parts.push(stopgapBlock(sg));
      if ((end.collect || []).length) parts.push(el("div", { class: "g-block" }, el("div", { class: "k", text: "The platform team may ask for" }),
        el("ul", { class: "clean" }, end.collect.map(t => el("li", { text: t })))));
      parts.push(helpedBlock(sg));
    }

    if (outcome === "no_fix_yet") {
      if (end.text) parts.push(el("p", { text: end.text }));
      V.issueBox = el("div", { class: "g-block g-issue" });
      fillIssueBox();
      parts.push(V.issueBox);
      parts.push(el("p", { text: "This session counts toward how common this problem is." }));
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
        P.ui.field("What changed just before it started?", changed, "App and phone updates and staff edits have come before many problems."),
        sendRow("details", "Save these details", "Update these details",
          () => ({ newProblem: { what: what.value.trim(), since: since.value.trim(), changed: changed.value } }), "Details saved to the session.")));
      if (sg.length) parts.push(stopgapBlock(sg));
    }

    parts.push(el("div", { class: "g-row" }, btn("Start a new session", "btn", () => startOver(false))));
    V.step.replaceChildren(el("div", { class: "panel g-step g-end g-end-" + outcome }, parts));
    drawSaveStatus();
  }

  function helpedBlock(sg) {
    const helped = followHelped();
    return P.ui.el("div", { class: "g-block" }, helped.field,
      sendRow("helped", "Save what helped", "Update what helped", () => ({ helped: helped.input.value.trim(), stopgapsShown: sg.map(s => s.id) }),
        "Saved to the session."));
  }

  function followInput(key, label, max) {
    const fu = run.follow.draft;
    const input = P.ui.el("input", { type: "text", maxlength: String(max), value: fu[key] || "" });
    input.addEventListener("input", () => { fu[key] = input.value; saveRun(); });
    return { input: input, field: P.ui.field(label, input) };
  }
  function followHelped() {
    const fu = run.follow.draft;
    const input = P.ui.el("textarea", { maxlength: String(P.C.LIMITS.helped), rows: "2" });
    input.value = fu.helped || "";
    input.addEventListener("input", () => { fu.helped = input.value; saveRun(); });
    return { input: input, field: P.ui.field("What helped, if anything? (optional)", input, P.C.PRIVACY_HINT + " " + P.C.PUBLIC_HINT) };
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
  function stopgapBlock(list) {
    const { el } = P.ui;
    return el("div", { class: "g-block" },
      el("div", { class: "k", text: "In the meantime" }),
      el("ul", { class: "g-stopgaps" }, list.map(s => el("li", {},
        el("p", { class: "g-sg-text", text: s.text }),
        whyBlock(s.why, s.basis)))));
  }
  function fillIssueBox() {
    if (!V.issueBox) return;
    const { el, statusChip } = P.ui;
    const id = issueIdOf(run);
    const iss = id ? P.calc.issue(id) : null;
    if (!iss) { V.issueBox.replaceChildren(el("p", { class: "hint", text: "This is a known problem. Its status will show here once the issue list loads." })); return; }
    const plan = P.calc.planFor ? P.calc.planFor(iss) : { planned: iss.planned || "", notNow: iss.status === "not-now" ? (iss.notNowReason || iss.statusNote || "") : "" };
    V.issueBox.replaceChildren(...[
      el("div", { class: "k", text: "Known problem" }),
      el("p", {}, el("b", { text: iss.title || iss.id }), " ", statusChip(iss.status)),
      plan.notNow ? el("p", { text: (plan.notNowLabel || "Why not now: ") + plan.notNow }) : null,
      iss.status !== "not-now" && iss.statusNote ? el("p", { text: iss.statusNote }) : null,
      plan.planned ? el("p", { text: "What's planned: " + plan.planned }) : null].filter(Boolean));
  }
  /* The status line at the top of every ending. It only claims what happened. */
  function savedText(outcome) {
    const hasIssue = !!issueIdOf(run);
    if (isDemo()) return "Demo: nothing was sent.";
    if (isTestStudy(run.studyId)) return "Saved to the test study. It doesn't count toward any issue.";
    switch (outcome) {
      case "fixed": return "Saved to " + P.calc.studyName(run.studyId) + ".";
      case "unconfirmed": return "Saved as not confirmed yet. It doesn't count as fixed.";
      case "not_fixed": return "Sent to the platform team. They review new sessions before each dev meeting." +
        (hasIssue ? " Changes to this problem show on Start here." : "");
      case "no_fix_yet": return "Saved to " + P.calc.studyName(run.studyId) + ".";
      case "new_problem": return "Sent to the platform team. They will sort it into a known problem or a new one.";
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
    else if (st === "local") kids.push(el("p", { class: "notice", text: run.studyId || P.calc.myStudies().length
      ? "Not saved: you aren't a member of this study, so this run was a test. Nothing was sent."
      : "Not saved: you aren't in a study yet. Nothing was sent. Ask the platform team to add you to a study." }));
    else if (st === "failed") {
      kids.push(el("p", { class: "notice warn", text: "Not sent yet. Couldn't save the session. " + (run.saveError || "") }));
      kids.push(btn("Try saving again", "btn", () => saveSession()));
    }
    V.saveLine.replaceChildren(...kids);
    (V.sendBtns || []).forEach(b => { if (b.isConnected) b.hidden = st === "local"; });
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
        el("span", { class: "fm-label", text: "End: " + (outcome === "not_fixed" && !path.some(p => p.kind === "action") ? "Needs the platform team"
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
        el("div", { class: "fm-headrow" }, el("span", { class: "k", text: full ? "The full map" : "The path taken" }), toggle),
        el("span", { class: "hint", text: "Numbers are the stages: 1 pin down, 2 common causes, 3 safe fixes, 4 confirm, 5 escalate." })),
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
        if (!run.entryId) refreshStart();
        else { fillIssueBox(); resumeSave(); }
        return;
      }
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
   8. Basis tag "platform" shows as "Platform team practice", from core if core has it, else from this file. */

/* INTEGRATED (pass 2, 2026-10-28): core's C.BASIS has the "platform" key ("Platform team practice"); the
   page-head copy is in home.js; P.demo flags demo mode; test studies are left out of every count in 03;
   header feedback records the step in view (P.setFeedbackContext). Outcome names stay as in C.OUTCOMES
   until the platform team decides on new wording. */
