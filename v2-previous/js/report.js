/* Report a problem for your study page. Owner: B3. Spec: SPEC.md section 7.3, page-review-proposals.md
   (Report), ux-audit.md item 7.
   A report is issue-level: the team's judgment of how a problem affected the study.
   Order: which problem; how many and how long; impact; cause guess; setup; what fixed it.
   What sessions and the study setup already know is shown as a short summary with a "Change" button.
   The team answers only what only it knows: the impact questions and the cause guess.
   Typed input survives data refreshes: a field the person changed is never overwritten.
   An unsent report is kept in this tab (sessionStorage) so a reload or a dropped tab doesn't lose it. */
(function () {
  "use strict";
  const P = window.Portal;

  const SPAN = [["week", "This week only"], ["weeks", "A few weeks"], ["months", "Months"], ["start", "Since the study started"], ["unsure", "Not sure"]];
  const RECUR = [["new", "First time we've seen it"], ["recurring", "It keeps happening"], ["returned", "It came back after it was fixed"]];
  const OTHER = ["other", "Other / in between"];
  /* Impact questions: visible choices, none picked at the start. "Other / in between" opens a note.
     "other" is left out of severity (core and portal_issue_scores accept only the listed values). */
  const IMPACT = [
    { name: "stops", legend: "What did it stop?", required: true,
      opts: [["none", "Nothing"], ["slowed", "Slowed someone down"], ["prevented", "Prevented a task"], ["dropout", "Led to dropout or a dropout request"]] },
    { name: "data", legend: "What did it do to the data?", required: true,
      opts: [["none", "Nothing"], ["missing", "Data missing"], ["wrong", "Data wrong or misleading"], ["unknown", "Can't tell"]] },
    { name: "cost", legend: "Who absorbed the cost?", required: true,
      opts: [["participant", "Participants"], ["staff", "Study staff"], ["analyst", "Analysts, later"], ["nobody", "Nobody yet"]] },
    { name: "mechanism", legend: "Effect on participants (optional)", required: false,
      opts: [["motivation", "Less willing to open the app or take part"], ["ability", "Couldn't do the task"],
        ["understanding", "Did it, but misunderstood it"], ["trust", "Doubted the app or the study"]] }
  ];
  const PHONE_Q = [["ios", "iPhone"], ["android", "Android"], ["both", "Both"], ["unsure", "Not sure"]];
  const DRAFT_KEY = "ip-report-draft";

  /* Fields that can be filled in from sessions or the study setup. */
  const PREFILL = ["n", "phone", "week", "span", "fix", "recur", "server", "serverOther", "wearable", "osVersion", "appVersion", "device"];
  const SETUP_KEYS = ["server", "serverOther", "wearable"];

  let built = false;
  const f = {};              // form controls and parts by name
  const radios = {};         // radio groups by name: {get(), set(v), focus(), note}
  const dirty = new Set();   // fields the person changed
  let picker = null;
  let issueId = "";
  let studyId = "";
  let ticked = new Set();    // session ids ticked
  let tickTouched = false;   // the person changed ticks, or ticks came from params
  let knownSessions = new Set();
  let stepSkip = new Set();  // guide steps the person unticked under "What fixed it"
  let fromSessions = false;
  let sending = false;
  let scopeOpen = false;     // the person asked to change the "how many and how long" answers
  let draftDone = false;     // the kept draft was restored or set aside
  let draftTimer = 0;

  function el() { return P.ui.el.apply(null, arguments); }
  function label(pairs, v) { const p = pairs.find(x => x[0] === v); return p ? p[1] : ""; }
  function localDate(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (isNaN(d)) return "";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  /* Texts of every guide step and stopgap, normalized. A "what helped" or "what fixed it" answer that
     is just a guide step is a guide step, not a team workaround. */
  function guideKeys() {
    const g = P.guide();
    const keys = new Set();
    Object.values(g.nodes || {}).forEach(n => { if (n && n.text) keys.add(P.calc.norm(n.text)); });
    Object.values(g.stopgaps || {}).forEach(n => { if (n && n.text) keys.add(P.calc.norm(n.text)); });
    return keys;
  }
  function mostCommon(list) {
    const gk = guideKeys();
    const counts = new Map();
    list.forEach(t => {
      const k = P.calc.norm(t);
      if (!k || P.C.NOT_A_FIX.includes(k) || gk.has(k)) return;
      const c = counts.get(k) || { text: String(t).trim(), n: 0 };
      c.n += 1; counts.set(k, c);
    });
    let best = null;
    counts.forEach(c => { if (!best || c.n > best.n) best = c; });
    return best ? best.text : "";
  }
  function entryTitle(id) {
    const e = ((P.guide().entries) || []).find(x => x.id === id);
    return e ? e.title : "";
  }
  function track(name, ctrl) {
    f[name] = ctrl;
    const mark = () => { dirty.add(name); };
    ctrl.addEventListener("input", mark);
    ctrl.addEventListener("change", mark);
    return ctrl;
  }
  function setIf(name, value) {
    if (value === undefined || value === null || dirty.has(name)) return;
    if (radios[name]) { radios[name].set(value); return; }
    if (!f[name]) return;
    if (f[name].type === "checkbox") f[name].checked = !!value; else f[name].value = value;
  }

  /* A group of visible choices (radio buttons styled as chips). With note: true, "Other / in between"
     is added and a note field opens when it is picked or on "Add a note". */
  function choiceGroup(name, legend, pairs, o) {
    o = o || {};
    const all = o.note ? pairs.concat([OTHER]) : pairs;
    const inputs = [];
    const box = el("div", { class: "rp-chips" }, all.map(([v, t]) => {
      const inp = el("input", { type: "radio", name: "rp-" + name, value: v });
      inputs.push(inp);
      return el("label", { class: "rp-chip" }, inp, el("span", { text: t }));
    }));
    const parts = [el("legend", { text: legend }), box];
    let note = null, noteWrap = null, addNote = null;
    if (o.note) {
      note = el("input", { type: "text", maxlength: "200", "aria-label": legend + " Note" });
      noteWrap = P.ui.field("Note (optional)", note, P.C.PRIVACY_HINT);
      noteWrap.hidden = true;
      addNote = el("button", { type: "button", class: "linkbtn rp-addnote", text: "Add a note" });
      addNote.addEventListener("click", () => { noteWrap.hidden = false; addNote.hidden = true; note.focus(); });
      parts.push(addNote, noteWrap);
      note.addEventListener("input", () => dirty.add(name + "Note"));
    }
    const fs = el("fieldset", { class: "rp-q" + (o.required ? " req" : "") }, parts);
    box.addEventListener("change", e => {
      dirty.add(name);
      fs.classList.remove("missing");
      if (o.note && e.target.value === "other" && noteWrap.hidden) { noteWrap.hidden = false; addNote.hidden = true; note.focus(); }
      if (o.onChange) o.onChange(e.target.value);
    });
    radios[name] = {
      el: fs,
      note: note,
      get() { const c = inputs.find(i => i.checked); return c ? c.value : ""; },
      set(v) { inputs.forEach(i => { i.checked = i.value === v; }); },
      focus() { (inputs.find(i => i.checked) || inputs[0]).focus(); },
      openNote(text) { if (!note) return; note.value = text || ""; if (text) { noteWrap.hidden = false; addNote.hidden = true; } },
      reset() { inputs.forEach(i => { i.checked = false; }); if (note) { note.value = ""; noteWrap.hidden = true; addNote.hidden = false; } fs.classList.remove("missing"); }
    };
    return fs;
  }

  /* ---------- sessions ---------- */
  function relatedSessions() {
    if (!studyId || !issueId) return [];
    if (issueId === "new") {
      return P.calc.sessionsFor({ studyId: studyId, sinceDays: 28 })
        .filter(s => s.outcome === "new_problem" && !s.linkedIssueId && !s.issueId);
    }
    return P.calc.sessionsFor({ studyId: studyId, issueId: issueId, sinceDays: 28 });
  }
  function lastReportAt() {
    if (!studyId || !issueId || issueId === "new") return "";
    return (P.S.reports || []).filter(r => r.studyId === studyId && (r.linkedIssueId || r.issueId) === issueId)
      .map(r => String(r.created || "")).sort().pop() || "";
  }
  function defaultTicked(s) {
    if (issueId === "new") return false;
    const last = lastReportAt();
    if (last) return String(s.created || "") > last;
    return Date.parse(s.created) >= Date.now() - 7 * 864e5;
  }
  function tickedSessions() { return relatedSessions().filter(s => ticked.has(s.id)); }

  function drawSessions() {
    const host = f.sessHost;
    const list = relatedSessions();
    list.forEach(s => {
      if (!knownSessions.has(s.id)) {
        knownSessions.add(s.id);
        if (!tickTouched && defaultTicked(s)) ticked.add(s.id);
      }
    });
    f.sessWrap.hidden = !issueId;
    if (!issueId) { host.replaceChildren(); f.sessCount.textContent = ""; return; }
    if (!P.calc.inStudy(studyId)) { host.replaceChildren(P.ui.empty("Sessions show here for studies you belong to.")); f.sessCount.textContent = ""; return; }
    if (!list.length) {
      host.replaceChildren(P.ui.empty(issueId === "new"
        ? "No unsorted \"Something else\" sessions from your team in the last 4 weeks. You can still report it."
        : "Your team has no troubleshooting sessions on this in the last 4 weeks. You can still report it."));
      f.sessCount.textContent = "";
      return;
    }
    const rows = list.map(s => {
      const cb = el("input", { type: "checkbox", checked: ticked.has(s.id), "data-id": s.id });
      cb.addEventListener("change", () => {
        tickTouched = true;
        if (cb.checked) ticked.add(s.id); else ticked.delete(s.id);
        countLine(list); prefill(); saveDraftSoon();
      });
      const detail = s.outcome === "fixed" && s.fixedByText ? "Fixed by: " + s.fixedByText
        : s.outcome === "unconfirmed" && s.untestedFixText ? "Seemed to help, not checked: " + s.untestedFixText
        : s.outcome === "new_problem" && s.newProblem && s.newProblem.what ? "Seen: " + s.newProblem.what
        : entryTitle(s.entryId);
      return el("li", {}, el("label", { class: "rp-sess" }, cb,
        el("span", {},
          el("b", { text: P.ui.fmtDate(s.created) }), " ",
          (P.C.PHONES.find(p => p[0] === s.phone) || [0, "Phone not given"])[1], ". ",
          P.C.OUTCOMES[s.outcome] || s.outcome || "", ".",
          detail ? el("span", { class: "hint", text: " " + detail }) : null)));
    });
    host.replaceChildren(el("ul", { class: "clean rp-sesslist" }, rows));
    countLine(list);
  }
  function countLine(list) {
    const n = list.filter(s => ticked.has(s.id)).length;
    const last = lastReportAt();
    const older = last && issueId !== "new" ? list.filter(s => String(s.created || "") <= last).length : 0;
    f.sessCount.textContent = n + " of " + list.length + " sessions included." +
      (older ? " Sessions before your last report (" + P.ui.fmtDate(last) + ") start unticked. Tick any you want to add." : "");
  }

  /* Guide steps that fixed the ticked sessions. They are tagged (fixSteps) and never written into
     "fix", so they show on the issue only as a guide step, not again as a team workaround. */
  function guideSteps() {
    const seen = new Map();
    tickedSessions().forEach(s => {
      if (s.outcome !== "fixed" || !s.fixedByText) return;
      const key = s.fixedBy || P.calc.norm(s.fixedByText);
      if (!seen.has(key)) seen.set(key, { node: s.fixedBy || "", text: s.fixedByText, n: 0 });
      seen.get(key).n += 1;
    });
    return Array.from(seen.entries()).map(([key, v]) => Object.assign({ key: key }, v));
  }
  function drawSteps() {
    const steps = guideSteps();
    f.stepsWrap.hidden = !steps.length;
    f.stepsList.replaceChildren(...steps.map(st => {
      const cb = el("input", { type: "checkbox", checked: !stepSkip.has(st.key) });
      cb.addEventListener("change", () => { if (cb.checked) stepSkip.delete(st.key); else stepSkip.add(st.key); saveDraftSoon(); });
      return el("li", {}, el("label", { class: "rp-sess" }, cb,
        el("span", {}, P.ui.chip("Guide step"), " ", st.text,
          el("span", { class: "hint", text: " " + (st.n === 1 ? "Fixed 1 session." : "Fixed " + st.n + " sessions.") }))));
    }));
    f.fixLabel.textContent = steps.length ? "Anything else that helped? (optional)" : "What fixed it, if anything?";
  }

  /* ---------- pre-fill ---------- */
  function studyPhones() {
    const st = P.calc.study(studyId);
    const p = st && st.setup ? st.setup.phones : "";
    return PHONE_Q.some(x => x[0] === p) ? p : "";
  }
  function prefill() {
    /* A draft restored before issues loaded showed the raw id. Refresh the title now. */
    if (issueId && issueId !== "__" && f.chosenText) f.chosenText.textContent = P.calc.issueTitle(issueId);
    const st = P.calc.study(studyId);
    const setup = (st && st.setup) || {};
    const ss = tickedSessions();

    /* From the study setup */
    if (setup.server) setIf("server", setup.server);
    if (setup.serverOther) setIf("serverOther", setup.serverOther);
    if (Array.isArray(setup.features)) {
      if (setup.features.includes("wearable") && Array.isArray(setup.wearables) && setup.wearables.length) {
        setIf("wearable", setup.wearables.map(w => (P.C.WEARABLES.find(x => x[0] === w) || [w, w])[1]).join(", "));
      } else if (!setup.features.includes("wearable")) {
        setIf("wearable", "");
      }
    }

    /* Which phones: pre-filled from the study's phone types (decided 10-27). The ticked sessions only add a
       hint when they were all on one type. They fill it in only when the study setup doesn't say. */
    const sp = studyPhones();
    const sessPhones = new Set(ss.map(s => s.phone).filter(p => p === "ios" || p === "android"));
    let phone = sp, phoneFrom = sp ? "study" : "";
    if (!sp && sessPhones.size) {
      phone = sessPhones.size === 2 ? "both" : Array.from(sessPhones)[0];
      phoneFrom = "sessions";
    }
    if (phone) setIf("phone", phone);
    const onePhone = sessPhones.size === 1 && (sp === "both" || sp === "unsure")
      ? " The sessions above were all on " + (sessPhones.has("ios") ? "iPhone" : "Android") + "." : "";
    f.phoneHint.textContent = dirty.has("phone") ? ""
      : phoneFrom === "study" ? "Filled in from your study setup." + onePhone + " Change it if this problem is on one phone type only."
      : phoneFrom === "sessions" ? "Your study setup doesn't say, so this comes from the sessions above."
      : "";

    /* From the ticked sessions */
    if (ss.length) {
      setIf("n", String(ss.length));
      const times = ss.map(s => String(s.created || "")).filter(Boolean).sort();
      setIf("week", localDate(times[times.length - 1]));
      /* After a past report, the ticked sessions are only the newest ones, so their age says nothing
         about how long it has gone on. */
      if (!lastReportAt()) {
        const age = (Date.now() - Date.parse(times[0])) / 864e5;
        setIf("span", age <= 7 ? "week" : age <= 42 ? "weeks" : "months");
      }
      /* "What fixed it" holds only the team's own words ("what helped" in sessions). */
      setIf("fix", mostCommon(ss.map(s => s.helped || "")));
      ["model", "osVersion", "appVersion"].forEach(k => {
        const vals = new Set(ss.map(s => s.device && s.device[k] ? String(s.device[k]).trim() : "").filter(Boolean));
        setIf(k === "model" ? "device" : k, vals.size === 1 ? Array.from(vals)[0] : "");
      });
    }
    if (issueId && issueId !== "new" && lastReportAt()) setIf("recur", "recurring");

    f.serverOtherWrap.hidden = f.server.value !== "other";
    drawSteps();
    drawScope(ss.length);
    drawSetup(st);
  }

  /* "How many and how long": a summary line when sessions filled it in, else the questions. */
  function drawScope(nSessions) {
    const showSummary = nSessions > 0 && !scopeOpen;
    f.scopeGrid.hidden = showSummary;
    f.scopeSummary.hidden = !showSummary;
    if (!showSummary) return;
    const n = Number(f.n.value) || 0;
    const parts = [
      n === 1 ? "1 participant" : n + " participants",
      f.week.value ? "Most recent: " + P.ui.fmtDate(f.week.value) : "",
      label(SPAN, f.span.value) ? "Going on: " + label(SPAN, f.span.value).toLowerCase() : "",
      label(RECUR, f.recur.value)
    ].filter(Boolean);
    f.scopeText.textContent = parts.join(". ") + ".";
  }
  function setupLines() {
    const lines = [];
    if (f.server.value) {
      lines.push("Server: " + (f.server.value === "other" ? (f.serverOther.value.trim() || "Other") : P.C.SERVER_NAME[f.server.value] || f.server.value));
    }
    if (f.wearable.value.trim()) lines.push("Wearable or health app: " + f.wearable.value.trim());
    const phoneBits = [f.device.value.trim(), f.osVersion.value.trim(), f.appVersion.value.trim() ? "app " + f.appVersion.value.trim() : ""].filter(Boolean);
    if (phoneBits.length) lines.push("Phone details: " + phoneBits.join(", "));
    if (f.activity.value.trim()) lines.push("Activity: " + f.activity.value.trim());
    if (f.when.value.trim()) lines.push("When it happens: " + f.when.value.trim());
    return lines;
  }
  function drawSetup(st) {
    const lines = setupLines();
    f.setupLines.replaceChildren(...lines.map(t => el("li", { text: t })));
    f.setupLines.hidden = !lines.length;
    f.setupFrom.textContent = st && st.setup
      ? (lines.length ? "Change anything that was different for this problem." : "Your study setup doesn't say this yet.")
      : "Your study setup isn't filled in yet. Add details below if you know them.";
  }

  /* ---------- study and issue ---------- */
  function fillStudies() {
    const ids = P.calc.myStudies();
    if (!studyId || !ids.includes(studyId)) studyId = ids.includes(P.S.studyId) ? P.S.studyId : (ids[0] || "");
    const cur = Array.from(f.study.options).map(o => o.value).join("|");
    if (cur !== ids.join("|")) f.study.replaceChildren(...ids.map(id => el("option", { value: id, text: P.calc.studyName(id) === "A team" ? id : P.calc.studyName(id) })));
    f.study.value = studyId;
    const st = P.calc.study(studyId);
    f.studyName.textContent = studyId ? (P.calc.studyName(studyId) === "A team" ? studyId : P.calc.studyName(studyId)) : "No study yet";
    f.studyChange.hidden = ids.length < 2;
    f.testNote.hidden = !(st && st.test);
    const member = P.calc.inStudy(studyId);
    f.noStudy.textContent = !ids.length
      ? "You aren't in a study yet, so you can't send reports. Ask the platform team to add you."
      : P.S.user.isAdmin
        ? "You aren't a member of this study, so you can't send its reports. Ask an admin to add you, or pick a study you belong to."
        : "Only members of a study can send its reports. Ask the platform team to add you.";
    f.noStudy.hidden = member;
    f.send.disabled = sending || !member;
  }
  function changeStudy(id) {
    if (id === studyId) return;
    studyId = id || "";
    fromSessions = false;
    resetTicks();
    SETUP_KEYS.concat(["phone"]).forEach(k => dirty.delete(k));
    if (picker && picker.setStudy) picker.setStudy(studyId);
    drawSessions(); prefill();
  }
  function resetTicks() { ticked = new Set(); knownSessions = new Set(); tickTouched = false; stepSkip = new Set(); scopeOpen = false; }
  function showPicker(open) {
    f.pickerHost.hidden = !open;
    f.chosen.hidden = open || !issueId;
  }
  function pickIssue(id, quiet) {
    if (id === issueId) { showPicker(false); return; }
    issueId = id || "";
    fromSessions = false;        /* render(params) sets it again after this when the page opened from sessions */
    resetTicks();
    PREFILL.forEach(k => { if (!SETUP_KEYS.includes(k)) dirty.delete(k); });
    f.newWrap.hidden = issueId !== "new";
    f.chosenText.textContent = issueId ? P.calc.issueTitle(issueId) : "";
    showPicker(!issueId);
    drawSessions(); prefill();
    if (!quiet && issueId) {
      /* Move on: the next thing to do is check the sessions, or name the new problem. */
      if (issueId === "new") f.newTitle.focus();
      else f.h2.focus();
    }
    saveDraftSoon();
  }

  /* ---------- draft kept in this tab ---------- */
  function textFields() {
    return ["newTitle", "newSymptom", "week", "span", "n", "recur", "words", "server", "serverOther", "device",
      "osVersion", "appVersion", "activity", "when", "wearable", "fix"];
  }
  function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
  }
  function saveDraft() {
    if (!built || !issueId || !P.S.user.uid) return;
    const d = { uid: P.S.user.uid, at: new Date().toISOString(), studyId: studyId, issueId: issueId,
      ticked: Array.from(ticked), tickTouched: tickTouched, fromSessions: fromSessions, stepSkip: Array.from(stepSkip),
      dirty: Array.from(dirty), vals: {}, radios: {}, notes: {},
      attr: (f.attr.querySelector("input:checked") || {}).value || "unsure", security: !!f.security.checked };
    textFields().forEach(k => { d.vals[k] = f[k].value; });
    Object.keys(radios).forEach(k => { d.radios[k] = radios[k].get(); if (radios[k].note) d.notes[k] = radios[k].note.value; });
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  }
  function readDraft() {
    let d = null;
    try { d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { d = null; }
    if (!d || d.uid !== P.S.user.uid || !d.issueId) return null;
    return d;
  }
  function clearDraft() {
    clearTimeout(draftTimer);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }
  /* Restore once, when the draft's study is known. Returns true when it restored. */
  function tryRestore() {
    if (draftDone) return false;
    const d = readDraft();
    if (!d) { draftDone = true; return false; }
    const ids = P.calc.myStudies();
    if (!ids.includes(d.studyId)) {
      if (P.S.loaded && P.S.loaded.studies) draftDone = true;
      return false;
    }
    draftDone = true;
    if (d.studyId !== studyId) { if (d.studyId !== P.S.studyId) P.setStudy(d.studyId); changeStudy(d.studyId); fillStudies(); }
    issueId = "__";
    pickIssue(d.issueId, true);
    picker.setSelected(d.issueId);
    ticked = new Set(d.ticked || []);
    tickTouched = !!d.tickTouched;
    relatedSessions().forEach(s => knownSessions.add(s.id));
    stepSkip = new Set(d.stepSkip || []);
    fromSessions = !!d.fromSessions;
    (d.dirty || []).forEach(k => dirty.add(k));
    textFields().forEach(k => { if (d.vals && d.vals[k] !== undefined) f[k].value = d.vals[k]; });
    Object.keys(radios).forEach(k => {
      if (d.radios && d.radios[k]) radios[k].set(d.radios[k]);
      if (d.notes && d.notes[k]) radios[k].openNote(d.notes[k]);
    });
    const a = f.attr.querySelector("input[value='" + String(d.attr || "unsure").replace(/[^a-z]/g, "") + "']"); if (a) a.checked = true;
    f.security.checked = !!d.security;
    if (dirty.has("n") || dirty.has("week") || dirty.has("span") || dirty.has("recur")) scopeOpen = true;
    drawSessions(); prefill();
    f.draftNote.hidden = false;
    f.draftWhen.textContent = "We kept your unsent report from " + P.ui.ago(d.at) + ".";
    return true;
  }

  /* ---------- build ---------- */
  function build(sec) {
    const { field, select, pageHead } = P.ui;
    const C = P.C;
    const L = C.LIMITS;

    /* Study: fixed text, with "Change study" only when the person has more than one. */
    f.study = select([], "", { "aria-label": "Study" });
    f.study.addEventListener("change", () => { P.setStudy(f.study.value); changeStudy(f.study.value); fillStudies(); saveDraftSoon(); });
    f.studyWrap = field("Which study is this for?", f.study);
    f.studyWrap.hidden = true;
    f.studyName = el("b", {});
    f.studyChange = el("button", { type: "button", class: "linkbtn", text: "Change study" });
    f.studyChange.addEventListener("click", () => { f.studyWrap.hidden = !f.studyWrap.hidden; if (!f.studyWrap.hidden) f.study.focus(); });
    f.testNote = el("p", { class: "hint", text: "This is a test study. Use it to try the form. Reports here don't count toward any issue.", hidden: true });
    f.noStudy = el("p", { class: "notice warn", hidden: true });

    /* Problem: the picker until one is chosen, then one line with "Change problem". */
    f.pickerHost = el("div", {});
    f.chosenText = el("b", {});
    const changeIssue = el("button", { type: "button", class: "linkbtn", text: "Change problem" });
    changeIssue.addEventListener("click", () => { showPicker(true); if (picker.focusSearch) picker.focusSearch(); });
    f.chosen = el("p", { class: "rp-line", hidden: true }, "Problem: ", f.chosenText, " ", changeIssue);
    f.newTitle = el("input", { type: "text", maxlength: String(L.title), placeholder: "For example: app closes when opening an activity" });
    f.newSymptom = el("textarea", { maxlength: String(L.symptom), placeholder: "What staff or participants see on the screen" });
    f.newWrap = el("div", { class: "grid2", hidden: true },
      field("Short title", f.newTitle, C.PRIVACY_HINT),
      field("What staff or participants see", f.newSymptom, C.PRIVACY_HINT));

    /* Draft notice */
    f.draftWhen = el("span", {});
    const discard = el("button", { type: "button", class: "linkbtn", text: "Discard it and start again" });
    discard.addEventListener("click", () => { clearDraft(); resetForm(); f.draftNote.hidden = true; showPicker(true); });
    f.draftNote = el("p", { class: "notice", hidden: true, role: "status" }, f.draftWhen, " ", discard);

    /* How many and how long */
    f.sessHost = el("div", {});
    f.sessCount = el("p", { class: "hint", role: "status" });
    f.sessWrap = el("div", { class: "rp-sub", hidden: true },
      el("p", { class: "hint", text: "Your team's troubleshooting sessions on this problem in the last 4 weeks. Untick any that are about something else." }),
      f.sessHost, f.sessCount);
    track("week", el("input", { type: "date" }));
    track("span", select(SPAN, "unsure"));
    track("n", el("input", { type: "number", min: "0", max: "9999", inputmode: "numeric" }));
    track("recur", select(RECUR, "new"));
    f.scopeGrid = el("div", { class: "grid2" },
      field("Participants affected", f.n, "Lower it if one person had more than one session."),
      field("Most recent time it happened", f.week),
      field("How long has it been going on?", f.span),
      field("Is this new?", f.recur));
    f.scopeText = el("span", {});
    const scopeChange = el("button", { type: "button", class: "linkbtn", text: "Change these" });
    scopeChange.addEventListener("click", () => { scopeOpen = true; drawScope(1); f.n.focus(); });
    f.scopeSummary = el("p", { class: "rp-line", hidden: true }, f.scopeText, " ", scopeChange);

    /* Impact */
    const impact = IMPACT.map(q => choiceGroup(q.name, q.legend, q.opts, { note: true, required: q.required }));
    f.words = el("textarea", { maxlength: String(L.words), placeholder: "For example: participants stopped trusting that their activities counted, and two asked if they should keep going." });

    /* Cause guess */
    f.attr = el("div", { class: "rp-chips" }, C.ATTR.map(([v, t]) =>
      el("label", { class: "rp-chip" }, el("input", { type: "radio", name: "rp-attr", value: v, checked: v === "unsure" }), el("span", { text: t }))));

    /* Setup */
    const phoneQ = choiceGroup("phone", "Which participants' phones does this happen on?", PHONE_Q, {});
    f.phoneHint = el("p", { class: "hint", role: "status" });
    phoneQ.append(f.phoneHint);
    track("server", select([["", "Choose one"]].concat(C.SERVERS), ""));
    track("serverOther", el("input", { type: "text", maxlength: "120", placeholder: "Server or dashboard web address" }));
    f.server.addEventListener("change", () => { f.serverOtherWrap.hidden = f.server.value !== "other"; });
    f.serverOtherWrap = field("Server or dashboard web address", f.serverOther);
    f.serverOtherWrap.hidden = true;
    track("osVersion", el("input", { type: "text", maxlength: "40", placeholder: "For example: iOS 18.1" }));
    track("appVersion", el("input", { type: "text", maxlength: "40", placeholder: "For example: 2024.10.1" }));
    track("device", el("input", { type: "text", maxlength: "60", placeholder: "For example: Pixel 7" }));
    track("activity", el("input", { type: "text", maxlength: "80", placeholder: "For example: the daily mood survey" }));
    track("when", el("input", { type: "text", maxlength: "120", placeholder: "For example: right after an app update" }));
    track("wearable", el("input", { type: "text", maxlength: "80", placeholder: "For example: Fitbit" }));
    f.setupFrom = el("p", { class: "hint" });
    f.setupLines = el("ul", { class: "rp-lines" });
    f.setupMore = el("details", { class: "rp-more" },
      el("summary", { text: "Change setup or add phone details" }),
      el("div", { class: "grid2" },
        field("Server", f.server, "As shown on the app's login screen."),
        f.serverOtherWrap,
        field("Wearable or health app linked (optional)", f.wearable),
        field("Phone model (optional)", f.device),
        field("Phone OS version (optional)", f.osVersion, "In the phone's Settings."),
        field("mindLAMP app version (optional)", f.appVersion, "The dashboard Users tab may show the device model and app version when you hover over Last Active. It sometimes says unknown."),
        field("Activity involved (optional)", f.activity),
        field("When it happens (optional)", f.when)));
    f.setupMore.addEventListener("input", () => drawSetup(P.calc.study(studyId)));
    f.setupMore.addEventListener("change", () => drawSetup(P.calc.study(studyId)));

    /* What fixed it */
    f.stepsList = el("ul", { class: "clean rp-sesslist" });
    f.stepsWrap = el("div", { class: "rp-sub", hidden: true },
      el("p", { class: "hint", text: "Guide steps that fixed these sessions. Untick any that didn't help." }),
      f.stepsList);
    track("fix", el("input", { type: "text", maxlength: String(L.fix) }));
    f.fixLabel = el("span", { text: "What fixed it, if anything?" });
    const fixField = el("label", { class: "field" }, f.fixLabel, f.fix, el("span", { class: "hint", text: "Your team's own words. Other teams can see this." }));
    f.security = el("input", { type: "checkbox" });

    f.send = el("button", { class: "btn", type: "submit", text: "Send report to the platform team" });
    f.status = el("p", { class: "hint", role: "status" });

    f.h2 = el("h3", { text: "2. How many, and for how long?", tabindex: "-1" });
    const form = el("form", { class: "rp-form", novalidate: true },
      f.draftNote,
      el("div", { class: "panel" },
        el("h3", { text: "1. Which problem?" }),
        el("p", { class: "rp-line" }, "For: ", f.studyName, " ", f.studyChange),
        f.studyWrap, f.testNote, f.noStudy, f.pickerHost, f.chosen, f.newWrap),
      el("div", { class: "panel" },
        f.h2, f.sessWrap, f.scopeSummary, f.scopeGrid),
      el("div", { class: "panel" },
        el("h3", { text: "3. How did it affect your study?" }),
        el("p", { class: "hint", text: "Only your team knows this. The first three are needed." }),
        impact,
        field("In your words (optional)", f.words, "Only your study and the platform team see this.")),
      el("div", { class: "panel" },
        el("fieldset", { class: "rp-q" }, el("legend", { text: "4. What do you think caused it?" }), f.attr)),
      el("div", { class: "panel" },
        el("h3", { text: "5. Setup" }),
        phoneQ, f.setupFrom, f.setupLines, f.setupMore),
      el("div", { class: "panel" },
        el("h3", { text: "6. What fixed it?" }),
        f.stepsWrap, fixField,
        el("label", { class: "rp-check" }, f.security, " This may be a security problem. Only the platform team will see this report.")),
      el("div", { class: "bar" }, f.send, f.status));
    form.addEventListener("submit", e => { e.preventDefault(); send(); });
    form.addEventListener("input", saveDraftSoon);
    form.addEventListener("change", saveDraftSoon);
    f.form = form;

    /* After sending: what happens next */
    f.sentTitle = el("h3", { text: "Report sent", tabindex: "-1" });
    f.sentList = el("ul", { class: "rp-lines" });
    const again = el("button", { type: "button", class: "btn", text: "Report another problem" });
    again.addEventListener("click", () => { showSent(false); showPicker(true); if (picker.focusSearch) picker.focusSearch(); });
    const home = el("button", { type: "button", class: "btn ghost", text: "Go to Start here" });
    home.addEventListener("click", () => P.go("home"));
    f.sent = el("div", { class: "panel rp-sent", hidden: true },
      f.sentTitle, el("p", { text: "What happens next:" }), f.sentList, el("div", { class: "bar" }, again, home));

    sec.replaceChildren(
      pageHead(P.PAGE_COPY.report),
      el("div", { class: "notice warn", text: C.PRIVACY_NOTICE }),
      f.sent,
      form);

    picker = P.issuePicker(f.pickerHost, { studyId: () => studyId, onPick: id => pickIssue(id), showFixed: false,
      label: "What is the problem?", placeholder: "Type what you see, for example: reminders" });
    f.week.value = localDate();
  }

  function showSent(on, rec) {
    f.sent.hidden = !on;
    f.form.hidden = on;
    if (!on) { f.status.textContent = ""; return; }
    const lines = [
      "The platform team reads new reports before each biweekly dev meeting.",
      rec && rec.issueId === "new"
        ? "They will match it to a known problem or add it as a new one."
        : "Your answers add to how this problem is ranked.",
      "When the problem's status changes, you'll see it on your Start here page, under \"Since your last visit\"."
    ];
    if (rec && rec.security) lines.push("Only the platform team can see this report.");
    f.sentList.replaceChildren(...lines.map(t => el("li", { text: t })));
    f.sentTitle.focus();
  }

  /* ---------- send ---------- */
  async function send() {
    if (sending) return;
    if (!P.calc.inStudy(studyId)) { f.status.textContent = f.noStudy.textContent || "Only members of this study can send its reports."; return; }
    if (!issueId) { f.status.textContent = "Pick the problem first."; showPicker(true); picker.focusSearch && picker.focusSearch(); return; }
    if (issueId === "new" && !f.newTitle.value.trim()) { f.status.textContent = "Give the new problem a short title."; f.newTitle.focus(); return; }
    const missing = IMPACT.filter(q => q.required && !radios[q.name].get());
    IMPACT.forEach(q => radios[q.name].el.classList.toggle("missing", missing.includes(q)));
    if (missing.length) {
      f.status.textContent = "Answer: " + missing.map(q => q.legend).join(" ");
      radios[missing[0].name].focus();
      return;
    }
    const ids = tickedSessions().map(s => s.id);
    /* Guide steps: the ticked ones from sessions, plus "what fixed it" text that is a guide step's text. */
    const steps = guideSteps().filter(st => !stepSkip.has(st.key)).map(st => ({ node: st.node, text: st.text }));
    let fix = f.fix.value.trim();
    if (fix && guideKeys().has(P.calc.norm(fix))) {
      if (!steps.some(st => P.calc.norm(st.text) === P.calc.norm(fix))) steps.push({ node: "", text: fix });
      fix = "";
    }
    const note = k => (radios[k].note ? radios[k].note.value.trim() : "");
    const rec = {
      studyId: studyId,
      issueId: issueId,
      newTitle: issueId === "new" ? f.newTitle.value.trim() : "",
      newSymptom: issueId === "new" ? f.newSymptom.value.trim() : "",
      week: f.week.value,
      span: f.span.value,
      n: Math.max(0, Number(f.n.value) || 0),
      recur: f.recur.value,
      setup: {
        server: f.server.value, serverOther: f.server.value === "other" ? f.serverOther.value.trim() : "",
        phone: radios.phone.get(), osVersion: f.osVersion.value.trim(), appVersion: f.appVersion.value.trim(),
        device: f.device.value.trim(), activity: f.activity.value.trim(), when: f.when.value.trim(), wearable: f.wearable.value.trim()
      },
      attribution: ((f.attr.querySelector("input:checked")) || {}).value || "unsure",
      stops: radios.stops.get(), data: radios.data.get(), cost: radios.cost.get(), mechanism: radios.mechanism.get(),
      impactNotes: { stops: note("stops"), data: note("data"), cost: note("cost"), mechanism: note("mechanism") },
      words: f.words.value.trim(),
      fix: fix,
      fixSteps: steps,
      sessionIds: ids,
      fromSessions: !!fromSessions,
      security: !!f.security.checked
    };
    sending = true; f.send.disabled = true; f.status.textContent = "Sending...";
    try {
      await P.store.add("reports", rec);
      P.ui.toast("Report sent");
      clearDraft();
      resetForm();
      f.draftNote.hidden = true;
      showSent(true, rec);
    } catch (e) {
      f.status.textContent = P.writeError(e);
    }
    sending = false; f.send.disabled = !P.calc.inStudy(studyId);
  }

  function resetForm() {
    issueId = ""; fromSessions = false; resetTicks(); dirty.clear();
    if (picker) { if (picker.clear) picker.clear(); else picker.setSelected(""); }
    f.chosenText.textContent = "";
    showPicker(true);
    f.newWrap.hidden = true;
    [f.newTitle, f.newSymptom, f.n, f.words, f.fix, f.osVersion, f.appVersion, f.device, f.activity, f.when, f.serverOther, f.wearable].forEach(x => { x.value = ""; });
    f.server.value = "";
    Object.keys(radios).forEach(k => radios[k].reset());
    f.span.value = "unsure"; f.recur.value = "new"; f.week.value = localDate();
    const u = f.attr.querySelector("input[value=unsure]"); if (u) u.checked = true;
    f.security.checked = false;
    f.setupMore.open = false;
    f.status.textContent = "";
    drawSessions(); prefill();
  }


  P.register({
    id: "report",
    order: 30,
    init() { if (P.beforeSignOut) P.beforeSignOut(clearDraft); },
    render(params) {
      const sec = P.section("report");
      if (!built) { build(sec); built = true; }
      fillStudies();
      /* Start here's main "Report a problem" passes only {studyId}: follow that study, then take the plain
         entry path, so a kept draft is still offered. */
      if (params && params.studyId && !params.issueId && !params.sessionIds) {
        if (P.calc.myStudies().includes(params.studyId) && params.studyId !== studyId) {
          if (params.studyId !== P.S.studyId) P.setStudy(params.studyId);
          changeStudy(params.studyId);
          fillStudies();
        }
        params = {};
      }
      if (params && (params.issueId || params.sessionIds)) {
        draftDone = true;          /* a report started from Start here or an issue takes the place of a kept draft */
        f.draftNote.hidden = true;
        showSent(false);
        if (params.studyId && P.calc.myStudies().includes(params.studyId) && params.studyId !== studyId) {
          if (params.studyId !== P.S.studyId) P.setStudy(params.studyId);
          changeStudy(params.studyId);
          fillStudies();
        }
        if (params.issueId) {
          issueId = "__";            /* force a fresh pick, even for the same issue */
          pickIssue(params.issueId, true);
          picker.setSelected(params.issueId);
        }
        if (Array.isArray(params.sessionIds)) {
          ticked = new Set(params.sessionIds);
          relatedSessions().forEach(s => knownSessions.add(s.id));
          tickTouched = true;
        }
        fromSessions = !!params.fromSessions;
        drawSessions(); prefill();
        return;
      }
      if (params === null) {
        if (P.S.studyId && P.S.studyId !== studyId && P.calc.myStudies().includes(P.S.studyId)) { changeStudy(P.S.studyId); fillStudies(); }
        if (!issueId && tryRestore()) return;
        if (picker && !picker.el.contains(document.activeElement)) picker.refresh();
        if (!f.sessHost.contains(document.activeElement)) drawSessions();
        prefill();
        return;
      }
      /* Plain page entry: follow the header's study. */
      if (P.S.studyId && P.S.studyId !== studyId && P.calc.myStudies().includes(P.S.studyId)) { changeStudy(P.S.studyId); fillStudies(); }
      if (!issueId && tryRestore()) return;
      picker.refresh(); drawSessions(); prefill();
    }
  });
})();

/* NOTES (report.js; integrated pass 2, 2026-10-28)
   1. Report fields (SPEC 4): fixSteps [{node, text}] holds guide steps that fixed the ticked sessions, never `fix`,
      so portal_workarounds can't show them again as a team workaround. impactNotes {stops, data, cost, mechanism}.
      stops/data/cost/mechanism may be "other" ("Other / in between"): severity skips it (not in STOP_PTS/DATA_PTS).
      setup.phone answers "Which participants' phones does this happen on?" (ios, android, both, unsure).
   2. Test studies: reports there don't count (03 counts_toward_totals), and the form says so.
   3. P.beforeSignOut clears the kept draft (sessionStorage "ip-report-draft").
   4. Uses P.issuePicker extras from issues.js: setStudy(id), clear(), focusSearch(), opts.studyId as a function. */
