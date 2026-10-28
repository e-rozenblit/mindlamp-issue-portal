/* Prepare the dev meeting page. Spec: SPEC.md section 7.7, D19, D23, page-review-proposals.md (Dev meeting).
   Ordered as the meeting runs: 1 new since the last meeting, 2 ranked issues, 3 ideas and proposals.
   Every score can be traced ("How this score was computed"). During the meeting only a quick capture
   (idea, issues, explore or not now with a reason, who scopes it); the full card comes afterwards.
   Never names a study: other teams' activity shows as counts only. */
(function () {
  "use strict";
  const P = window.Portal;
  const { C, S, calc, store, ui } = P;
  const el = ui.el;
  /* Info button from core (hover, tap, keyboard); a plain fold until core has it. */
  const info = (content, label) => (P.ui.info ? P.ui.info(content, label) : P.ui.el("details", { class: "more" }, P.ui.el("summary", { text: label || "More" }), content));

  const DEC = { explore: "Explore: someone scopes it", go: "Go", conditions: "Go with conditions", scope: "Needs scoping first", "not-now": "Not now" };
  const TOP_N = 10;
  const st = {
    built: false, h: null, showFixed: false, showAll: false,
    since: "", sinceManual: false,
    meeting: null, meetingTried: false,
    scores: null, scoresAt: 0, scoresBusy: false,
    openTrace: new Set()
  };

  /* ---------- helpers ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function isHttp(u) { return /^https?:\/\/\S+$/i.test(String(u || "").trim()); }
  function statusLine() { return el("span", { class: "hint", role: "status" }); }
  /* replaceChildren that skips null and false (they would print as text). */
  function put(node, ...kids) { node.replaceChildren(...kids.flat().filter(k => k !== null && k !== undefined && k !== false)); return node; }
  /* The local calendar day, as YYYY-MM-DD (toISOString would give the UTC day). */
  function isoDay(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function sinceMs() { const t = Date.parse(st.since + "T00:00:00"); return isNaN(t) ? 0 : t; }
  function lastMonday() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDay(d); }
  function fmt(n) { return String(Math.round((Number(n) || 0) * 10) / 10); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function entryTitle(id) {
    const e = (P.guide().entries || []).find(x => x.id === id);
    return e ? e.title : (id || "");
  }
  function phoneName(p) { const f = C.PHONES.find(x => x[0] === p); return f ? f[1] : (p || ""); }
  function triageState(rec) { return (rec.triage && rec.triage.state) || "new"; }
  function specLink(url, text) {
    return isHttp(url) ? el("a", { href: url.trim(), target: "_blank", rel: "noopener noreferrer", text: text || "Working spec" }) : null;
  }
  function canDev() { return calc.canSeeProposals(); }
  /* A session's outcome after any follow-up (core helper; plain outcome until core has it). */
  const outcomeOf = x => (calc.effectiveOutcome ? calc.effectiveOutcome(x) : x.outcome);
  /* Issue names (D24): the short name as the title, the full sentence as a subtitle. */
  function nameOf(i) { return ui.issueName ? ui.issueName(i) : { title: (i && i.title) || "", subtitle: "" }; }
  function issueLabel(id) {
    if (id === "new") return "Something new";
    const i = calc.issue(id);
    return i ? nameOf(i).title : calc.issueTitle(id);
  }
  /* Pilot hygiene: test studies and admins' runs outside their studies don't count (03-migration 6b). */
  function counted(rec) {
    if (rec.outsideStudy) return false;
    const s = rec.studyId ? calc.study(rec.studyId) : null;
    return !(s && s.test);
  }

  /* Same keyed reuse as admin.js: rows with open edits (data-busy) survive refreshes. */
  function keyed(host, items, keyFn, sigFn, make) {
    host._cache = host._cache || new Map();
    const next = new Map();
    const els = items.map(it => {
      const k = keyFn(it), sig = sigFn(it);
      const old = host._cache.get(k);
      const node = (old && (old.sig === sig || old.node.dataset.busy)) ? old.node : make(it);
      next.set(k, { node, sig: old && old.node === node ? old.sig : sig });
      return node;
    });
    host._cache = next;
    const cur = Array.from(host.children);
    if (cur.length !== els.length || cur.some((c, i) => c !== els[i])) host.replaceChildren(...els);
  }

  /* ---------- data this page loads itself ---------- */
  /* Meeting details (03-migration: portal_meeting). Missing function or demo mode: nothing shared. */
  async function loadMeeting() {
    st.meetingTried = true;
    try { st.meeting = (await store.rpc("portal_meeting")) || {}; } catch (e) { st.meeting = {}; }
    if (!st.sinceManual && st.meeting.lastMeeting && st.h) { st.since = st.meeting.lastMeeting; st.h.sinceIn.value = st.since; }
    refresh();
  }
  /* The parts behind each score (answer tallies, sessions without a fix, goal points), from
     portal_issue_scores as core maps it into S.agg.scores. Refreshed on every "agg" event. */
  function loadScores() {
    const src = S.agg.scores || {};
    st.scores = Object.fromEntries(Object.entries(src).map(([id, r]) => [id, {
      sevStudies: r.sevStudies || 0, stops: r.stopsTally || null, data: r.dataTally || null,
      unfixed: r.sessionsUnfixed || 0, goalPoints: r.goalPoints || null, hasParts: !!(r.stopsTally || r.dataTally) }]));
    refresh();
  }

  /* ---------- 0. Before the meeting: report link and date ---------- */
  function meetingBlock() {
    const m = st.meeting || {};
    const out = [];
    const expected = "reports/" + lastMonday() + "-monday-report.md";
    if (!canDev()) {
      out.push(el("p", { class: "hint", text: "The pre-meeting report is for developers and the platform team. It lists new developer issues next to portal reports." }));
    } else if (isHttp(m.reportUrl)) {
      out.push(el("p", {}, el("a", { href: m.reportUrl.trim(), target: "_blank", rel: "noopener noreferrer", class: "dev-report", text: "Open the latest pre-meeting report" }),
        m.updatedAt ? el("span", { class: "hint", text: " Link added " + ui.fmtDate(m.updatedAt) + "." }) : null));
    } else {
      out.push(el("p", { class: "hint", text: !st.meetingTried ? "Loading the meeting details." :
        "No pre-meeting report linked yet." + (S.user.isAdmin ? " This week's file is " + expected + "." : " The platform team adds it before each meeting.") }));
      if (S.user.isAdmin) out.push(el("div", { class: "bar" }, el("button", { type: "button", class: "btn ghost", text: "Add the report link on the Admin page", onclick: () => P.go("admin", { focus: "meeting" }) })));
    }
    if (m.lastMeeting) out.push(el("p", { class: "hint", text: "Last meeting: " + ui.fmtDate(m.lastMeeting) + "." }));
    return out;
  }

  /* ---------- 1. New since the last meeting ---------- */
  /* Sessions that ended "not an app problem" (D25): counts by reason and by problem picked, kept apart from
     every issue's score. From core's notAppTally; admins (who read every session) get the same counts here
     until core has it. Others see nothing until then. */
  const NOT_APP_REASON = { forgot: "Forgot", away: "Away or busy", burden: "Felt like too much" };
  function reasonName(id) {
    if (NOT_APP_REASON[id]) return NOT_APP_REASON[id];
    const n = Object.values(P.guide().nodes || {}).find(x => x && x.ending === "not_app" && x.notAppReason === id);
    return (n && (n.reasonLabel || n.short)) || (id === "other" ? "Other" : String(id || "Other"));
  }
  function notAppTally(since) {
    if (calc.notAppTally) { try { return calc.notAppTally(new Date(since).toISOString()); } catch (e) { return null; } }
    if (!S.user.isAdmin) return null;
    const t = { total: 0, byReason: {}, byEntry: {} };
    S.sessions.filter(x => Date.parse(x.created) >= since && counted(x) && outcomeOf(x) === "not_app").forEach(x => {
      t.total++;
      const r = x.notAppReason || "other", e = x.entryId || "other";
      t.byReason[r] = (t.byReason[r] || 0) + 1;
      t.byEntry[e] = (t.byEntry[e] || 0) + 1;
    });
    return t;
  }
  function notAppBlock(since) {
    const t = notAppTally(since);
    if (!t || !t.total) return null;
    const line = (map, name) => Object.entries(map || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => name(k) + " (" + n + ")").join(", ");
    return el("div", { class: "dev-notapp", "data-notapp": String(t.total) },
      el("h4", { text: "Not an app problem: " + plural(t.total, "session") }),
      el("p", { class: "hint", text: "Not counted toward any issue. Input for feature ideas, such as engagement features." }),
      el("p", {}, el("b", { text: "Why: " }), line(t.byReason, reasonName) + "."),
      el("p", {}, el("b", { text: "Problem picked: " }), line(t.byEntry, id => entryTitle(id) || "Other") + "."));
  }
  function sinceBlock() {
    const out = sinceItems();
    const na = canDev() ? notAppBlock(sinceMs()) : null;
    if (na) out.push(na);
    return out;
  }
  function sinceItems() {
    const since = sinceMs();
    const out = [];
    const tc = S.agg.triageCounts;
    if (tc) out.push(el("p", { class: "hint", text: "Not sorted yet, all teams: " + calc.triageLine(tc) + "." }));

    if (S.user.isAdmin) {
      const all = S.sessions.filter(x => Date.parse(x.created) >= since);
      const allReps = S.reports.filter(r => Date.parse(r.created) >= since && !r.security);
      /* "Not an app problem" sessions are tallied below, never with the issues (D25). */
      const real = all.filter(counted), reps = allReps.filter(counted);
      const sess = real.filter(x => outcomeOf(x) !== "not_app");
      const left = (all.length - real.length) + (allReps.length - reps.length);
      if (!sess.length && !reps.length) {
        out.push(ui.empty((real.length ? "No sessions or reports on app problems since " : "No new sessions or reports since ") + ui.fmtDate(st.since) + "."));
        if (left) out.push(el("p", { class: "hint", text: plural(left, "test record") + " left out (test studies or admin test runs)." }));
        return out;
      }
      const teams = new Set(sess.concat(reps).map(calc.teamKey).filter(Boolean));
      out.push(el("p", { text: plural(sess.length, "session") + " and " + plural(reps.length, "report") + " from " +
        plural(teams.size, "team") + " since " + ui.fmtDate(st.since) + "." +
        (left ? " " + plural(left, "test record") + " left out." : "") }));
      const groups = new Map();
      const add = (key, label, kind, rec) => {
        const g = groups.get(key) || { label, sessions: 0, notFixed: 0, noFix: 0, reports: 0, teams: new Set() };
        if (kind === "s") { const o = outcomeOf(rec); g.sessions++; if (o === "not_fixed" || o === "new_problem") g.notFixed++; if (o === "no_fix_yet") g.noFix++; }
        else g.reports++;
        const t = calc.teamKey(rec); if (t) g.teams.add(t);
        groups.set(key, g);
      };
      sess.forEach(x => {
        const iid = x.linkedIssueId || x.issueId;
        if (iid) add(iid, issueLabel(iid), "s", x);
        else add("entry:" + (x.entryId || "other"), "No issue yet: " + entryTitle(x.entryId || "other"), "s", x);
      });
      reps.forEach(r => {
        const iid = r.linkedIssueId || r.issueId;
        if (iid && iid !== "new") add(iid, issueLabel(iid), "r", r);
        else add("new:" + r.id, "Something new: " + (r.newTitle || "no title"), "r", r);
      });
      const rows = Array.from(groups.values()).sort((a, b) => (b.notFixed - a.notFixed) || ((b.sessions + b.reports) - (a.sessions + a.reports)));
      out.push(el("div", { class: "scroll" }, el("table", { class: "dev-since" },
        el("thead", {}, el("tr", {}, ["Problem", "Sessions", "Not fixed", "No fix yet", "Reports", "Teams"].map(h => el("th", { scope: "col", text: h })))),
        el("tbody", {}, rows.map(g => el("tr", {}, el("td", { class: "dev-issue", text: g.label }),
          el("td", { class: "num", "data-label": "Sessions", text: String(g.sessions) }), el("td", { class: "num", "data-label": "Not fixed", text: String(g.notFixed) }),
          el("td", { class: "num", "data-label": "No fix yet", text: String(g.noFix) }), el("td", { class: "num", "data-label": "Reports", text: String(g.reports) }),
          el("td", { class: "num", "data-label": "Teams", text: String(g.teams.size) })))))));
      const open = (tc ? tc.notFixed + tc.newProblems + tc.newReports : 0);
      out.push(el("div", { class: "bar" }, el("button", { type: "button", class: "btn ghost",
        text: open ? "Sort the " + open + " unsorted items on the Admin page" : "Open the Admin page", onclick: () => P.go("admin", { focus: "triage" }) })));
      return out;
    }

    if (!canDev()) { out.push(el("p", { class: "hint", text: "Developers and the platform team see the open items here." })); return out; }
    const items = (S.agg.triageItems || []).filter(t => Date.parse(t.at) >= since);
    if (!items.length) { out.push(ui.empty("Nothing new to sort since " + ui.fmtDate(st.since) + ".")); return out; }
    out.push(el("p", { class: "hint", text: "The platform team links each one to an issue before the meeting." }));
    out.push(el("ul", { class: "clean" }, items.map(t => el("li", {},
      (t.kind === "report" ? "Report, something new: " + (t.title || "no title") + (t.symptom ? ". " + t.symptom : "")
        : (t.outcome === "new_problem" ? "Session, something else: " + (t.what || "no description")
          : "Session, still not fixed: " + (t.issueId ? issueLabel(t.issueId) : entryTitle(t.entryId)))) +
      (t.phone ? " (" + phoneName(t.phone) + ")" : "") + ", " + ui.ago(t.at) + "."))));
    return out;
  }

  /* ---------- 2. Ranked issues ---------- */
  /* Workarounds linked to an issue, in every tier (D24: "Workaround known" needs one to show). */
  function workaroundCount(issue) {
    if (typeof calc.workarounds !== "function") return (issue.workarounds || []).length;
    const w = calc.workarounds(issue);
    return ["platform", "confirmed", "team", "guide"].reduce((a, k) => a + ((w[k] || []).length), 0);
  }

  /* D24: "Workaround known" always comes with the workaround: a link to it on Known problems. */
  function workaroundLink(issue) {
    if (issue.status !== "workaround") return null;
    const n = workaroundCount(issue);
    return n ? el("div", {}, el("button", { type: "button", class: "linkbtn", text: "What helps (" + n + ")", onclick: () => P.go("issues", { issueId: issue.id }) }))
      : el("div", { class: "hint", text: "No workaround linked yet." });
  }

  function statusCell(issue, row) {
    if (!S.user.isAdmin) return el("div", {}, ui.statusChip(issue.status), workaroundLink(issue));
    const wrap = el("div", { class: "list dev-status" });
    const sel = ui.select(Object.entries(C.STATUS), issue.status, { "aria-label": "Status for " + nameOf(issue).title });
    const msg = statusLine();
    let undoTimer = null;
    function release() { clearTimeout(undoTimer); delete row.dataset.busy; refresh(); }
    function reset() { delete row.dataset.busy; put(wrap, sel, workaroundLink(issue), msg, publicSummary(issue, row)); sel.value = issue.status; }
    async function save(partial, prev) {
      msg.textContent = "Saving...";
      try {
        await store.patch("issues/" + issue.id, partial);
        ui.toast("Status changed");
        /* Keep the row for a few seconds so the change can be undone. */
        row.dataset.busy = "1";
        put(msg, "Changed to " + (C.STATUS[partial.status] || partial.status) + ". People who reported it or said \"This affects us too\" see this on their Home page. ",
          prev ? el("button", { type: "button", class: "linkbtn", text: "Undo", onclick: async () => {
            clearTimeout(undoTimer);
            msg.textContent = "Undoing...";
            try { await store.patch("issues/" + issue.id, { status: prev }); sel.value = prev; ui.toast("Status changed back"); }
            catch (e) { msg.textContent = P.writeError(e); }
            release();
          } }) : null);
        clearTimeout(undoTimer);
        undoTimer = setTimeout(release, 8000);
      } catch (e) { msg.textContent = P.writeError(e); sel.value = issue.status; delete row.dataset.busy; }
    }
    /* D24: "Workaround known" can't be set on an issue with no workaround. Ask for one, which is saved
       with the status as a platform team workaround that every team sees. */
    function askWorkaround(prev) {
      row.dataset.busy = "1";
      const text = el("input", { type: "text", maxlength: "300", "aria-label": "Workaround for " + nameOf(issue).title, placeholder: "What to do for now" });
      const m = statusLine();
      put(wrap, sel, ui.field("The workaround (every team sees it)", text, "This issue has no workaround yet. Add one to set this status."),
        el("div", { class: "bar" },
          el("button", { type: "button", class: "mini", text: "Save workaround and status", onclick: () => {
            const t = text.value.trim();
            if (!t) { m.textContent = "Add the workaround first."; text.focus(); return; }
            save({ status: "workaround", workarounds: (issue.workarounds || []).concat([t]) }, prev);
          } }),
          el("button", { type: "button", class: "mini", text: "Cancel", onclick: reset }), m), msg);
      text.focus();
    }
    sel.addEventListener("change", () => {
      const prev = issue.status;
      if (sel.value === "workaround" && !workaroundCount(issue)) { askWorkaround(prev); return; }
      if (sel.value !== "not-now") { save({ status: sel.value }, prev); return; }
      row.dataset.busy = "1";
      const reason = el("input", { type: "text", maxlength: "300", "aria-label": "Reason for Not now", placeholder: "One-line reason" });
      const m = statusLine();
      put(wrap, sel, ui.field("Why not now (every team sees this)", reason), el("div", { class: "bar" },
        el("button", { type: "button", class: "mini", text: "Save Not now", onclick: () => {
          const r = reason.value.trim();
          if (!r) { m.textContent = "\"Not now\" needs a reason. Study teams see it on the issue."; reason.focus(); return; }
          save({ status: "not-now", notNowReason: r }, prev);
        } }),
        el("button", { type: "button", class: "mini", text: "Cancel", onclick: reset }), m), msg);
      reason.value = issue.notNowReason || "";
      reason.focus();
    });
    const wl = workaroundLink(issue);
    wrap.append(sel, msg, publicSummary(issue, row));
    if (wl) wrap.insertBefore(wl, msg);
    return wrap;
  }

  /* What every team sees on the issue: a status note and one plain line on what's planned (D23). */
  function publicSummary(issue, row) {
    const note = el("input", { type: "text", maxlength: "300", value: issue.statusNote || "", "aria-label": "Status note for " + nameOf(issue).title });
    const planned = el("input", { type: "text", maxlength: "200", value: issue.planned || "", "aria-label": "What's planned for " + nameOf(issue).title });
    const m = statusLine();
    const d = el("details", {},
      el("summary", { class: "hint", text: "Edit what teams see" }),
      ui.field("Status note", note, "Every team sees this under the status."),
      ui.field("What's planned, in one plain line", planned, "Every team sees this on the issue. No study names."),
      el("div", { class: "bar" }, el("button", { type: "button", class: "mini", text: "Save what teams see", onclick: async () => {
        m.textContent = "Saving...";
        try { await store.patch("issues/" + issue.id, { statusNote: note.value.trim(), planned: planned.value.trim() }); ui.toast("Saved"); delete row.dataset.busy; d.open = false; }
        catch (e) { m.textContent = P.writeError(e); }
      } }), m));
    d.addEventListener("toggle", () => { if (d.open) row.dataset.busy = "1"; else delete row.dataset.busy; });
    return d;
  }

  /* A report's answers to one question as a list (D24: impact answers may be arrays). Core's reader when
     it exists; else a single value is a one-item list. */
  function answersOf(rep, key) {
    if (typeof calc.answers === "function") return calc.answers(rep, key);
    const v = rep ? rep[key] : null;
    return Array.isArray(v) ? v.filter(Boolean) : (v === null || v === undefined || v === "" ? [] : [v]);
  }
  /* Most severe answer's points in one question (ticking more boxes doesn't raise severity), or null. */
  function topPts(rep, key, pts) {
    const p = answersOf(rep, key).filter(a => Object.prototype.hasOwnProperty.call(pts, a)).map(a => pts[a]);
    return p.length ? Math.max.apply(null, p) : null;
  }
  function tallySum(t) { return Object.values(t || {}).reduce((a, n) => a + (Number(n) || 0), 0); }

  /* "Prevented a task: 1 answer x 2 points = 2". The tallies count every answer chosen (D24). */
  function tallyText(t, names, pts) {
    if (!t) return "";
    return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, n]) => (names[k] || k) + ": " + plural(n, "report") + " x " +
      plural(pts[k] || 0, "point") + " = " + (n * (pts[k] || 0))).join("; ");
  }

  /* "How this score was computed": one line per part of the signal, with where each number comes from. */
  function traceParts(i, s) {
    const sc = (st.scores && st.scores[i.id]) || {};
    const parts = [];
    /* Severity */
    let sev;
    if (s.sevFrom === "reports") {
      /* Every number shown with its points, so the sum can be checked by hand. */
      const pts = (t, P2) => Object.entries(t || {}).reduce((a, [k, n]) => a + (P2[k] || 0) * n, 0);
      const sp = pts(sc.stops, C.STOP_PTS), dp = pts(sc.data, C.DATA_PTS);
      sev = "Based on " + plural(s.sevN, "team report") + (sc.sevStudies ? " from " + plural(sc.sevStudies, "team") : "") + ".";
      if (sc.stops) sev += " What it stopped: " + tallyText(sc.stops, C.IMPACT_LABEL.stops, C.STOP_PTS) + ". Total " + sp + ".";
      if (sc.data) sev += " What it did to the data: " + tallyText(sc.data, C.IMPACT_LABEL.data, C.DATA_PTS) + ". Total " + dp + ".";
      /* The sum of the tallies equals the per-report severities only while each report has one answer per
         question. With several answers, each report counts its most severe answer in each question. */
      const oneEach = tallySum(sc.stops) === s.sevN && tallySum(sc.data) === s.sevN;
      if ((sc.stops || sc.data) && oneEach) sev += " (" + sp + " + " + dp + ") / " + plural(s.sevN, "report") + " = " + fmt(s.sev) + ".";
      else if (sc.stops || sc.data) {
        const reps = S.reports.filter(r => (r.linkedIssueId || r.issueId) === i.id && !r.security && counted(r));
        const per = reps.map(r => [topPts(r, "stops", C.STOP_PTS), topPts(r, "data", C.DATA_PTS)]).filter(([a, b]) => a !== null && b !== null);
        sev += " Some reports chose more than one answer; each report counts only its most severe answer in each question.";
        if (per.length === s.sevN) sev += " Per report: " + per.map(([a, b]) => a + " + " + b).join(", ") + ". Average: " + fmt(s.sev) + ".";
        else sev += " Average over " + plural(s.sevN, "report") + ": " + fmt(s.sev) + ".";
      }
    } else {
      sev = "First estimate: no team reports yet. " + (C.STOPS[i.stops] || "Not rated") + " (" + plural(C.STOP_PTS[i.stops] || 0, "point") + ") + " +
        (C.DATA[i.data] || "not rated") + " (" + plural(C.DATA_PTS[i.data] || 0, "point") + ") = " + fmt(s.sev) + ". The platform team set it from earlier records. Team reports replace it.";
    }
    if (s.sessions) {
      sev += " Troubleshooting sessions: " + s.sessions + (sc.unfixed ? ", " + sc.unfixed + " ended without a fix" : "") +
        ". Sessions don't record impact, so they count toward breadth, not severity.";
    }
    parts.push(["Severity", s.sev, sev]);
    /* Breadth */
    const before = Number(i.teams) || 0;
    parts.push(["Breadth", calc.breadth(s.teams), plural(s.teams, "team") + ": " + before + " from records before the portal, " +
      s.portalTeams + " through the portal (reports or sessions). " + (s.teams ? "" : "No team yet still counts as 1. ") +
      "1 team = 1, 2 to 3 = 2, 4 to 6 = 3, 7 or more = 4."]);
    /* Boosts */
    parts.push(["This affects us too", Math.min(s.boosts, 3), plural(s.boosts, "person", "people") + " said \"This affects us too\". Counts up to 3."]);
    /* Recent reports */
    parts.push(["Recent reports", Math.min(s.recent, 3), plural(s.recent, "report") + " in the last 30 days. Counts up to 3."]);
    /* Goal weight */
    let goal;
    if (s.goalN) {
      goal = "Average over " + plural(s.goalN, "study", "studies") + " that reported it and ranked their goals: 3 if its first goal is threatened, 2 its second, 1 its third, else 0.";
      if (sc.goalPoints) {
        const lab = { 3: "first goal threatened", 2: "second goal threatened", 1: "third goal threatened", 0: "none of its top 3" };
        goal += " " + Object.entries(sc.goalPoints).sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(([p, n]) => plural(n, "study", "studies") + ": " + (lab[p] || p + " points")).join(". ") + ".";
      }
    } else if (s.goalHidden) {
      goal = "Hidden until 3 or more studies report it, so no study's goals can be worked out. Your score leaves it out, so it can be lower than the developers' score.";
    } else {
      goal = "No study that reported it has ranked its goals yet.";
    }
    parts.push(["Goal weight", s.goal, goal]);
    return parts;
  }

  function traceBlock(i, s) {
    const parts = traceParts(i, s);
    const d = el("details", { class: "dev-trace" },
      el("summary", { text: "How this score was computed" }),
      el("ul", { class: "clean" }, parts.map(([name, val, why]) => el("li", {}, el("b", { text: name + ": " + fmt(val) + ". " }), why))),
      el("p", { class: "dev-sum", text: "Score = " + parts.map(p => fmt(p[1])).join(" + ") + " = " + fmt(s.signal) }));
    if (st.openTrace.has(i.id)) d.open = true;
    d.addEventListener("toggle", () => { if (d.open) st.openTrace.add(i.id); else st.openTrace.delete(i.id); });
    return d;
  }

  function issueRow(x) {
    const { i, s } = x;
    const nm = nameOf(i);
    const row = el("tr");
    put(row,
      el("td", { class: "dev-issue" }, el("span", { class: "dev-title", text: nm.title }),
        nm.subtitle ? el("div", { class: "hint dev-sub", text: nm.subtitle }) : null,
        i.security ? el("span", {}, " ", ui.chip("Security", "sev hi")) : null,
        canDev() && i.specUrl && isHttp(i.specUrl) ? el("div", {}, specLink(i.specUrl)) : null,
        i.status === "not-now" && (i.notNowReason || i.statusNote) ? el("div", { class: "hint", text: "Why not now: " + (i.notNowReason || i.statusNote) }) : null,
        i.planned ? el("div", { class: "hint", text: "Planned: " + i.planned }) : null,
        traceBlock(i, s)),
      el("td", { "data-label": "Status" }, statusCell(i, row)),
      el("td", { class: "num", "data-label": "Score" }, el("b", { text: fmt(s.signal) })),
      /* The number in the cell, the words behind an info button, so the table fits (fresh-eyes review). */
      el("td", { class: "num", "data-label": "Severity" }, fmt(s.sev), s.sevFrom !== "reports" ? el("span", { class: "hint", text: " est." }) : null, " ",
        (() => { const w = calc.sevWords(i, s); return info(el("span", { text: (w.words ? w.words + " " : "") + w.source }), "Severity for " + nm.title); })()),
      el("td", { class: "num", "data-label": "Teams" }, String(s.teams), (Number(i.teams) || 0) ? el("div", { class: "hint", text: (Number(i.teams) || 0) + " before the portal" }) : null),
      el("td", { class: "num", "data-label": "Sessions", text: String(s.sessions) }),
      el("td", { class: "num", "data-label": "Affects us too", text: String(s.boosts) }),
      el("td", { class: "num", "data-label": "Reports, 30 days", text: String(s.recent) }),
      el("td", { class: "num", "data-label": "Goal weight" }, s.goalHidden ? "Hidden" : fmt(s.goal), s.goalN ? el("div", { class: "hint", text: s.goalHidden ? "Under 3 studies" : plural(s.goalN, "study", "studies") }) : null));
    return row;
  }

  function newRows() {
    if (S.user.isAdmin) {
      return S.reports.filter(r => r.issueId === "new" && !r.linkedIssueId && triageState(r) !== "dismissed" && triageState(r) !== "linked" && counted(r))
        .map(r => ({ id: r.id, title: r.newTitle || "no title", sev: (topPts(r, "stops", C.STOP_PTS) || 0) + (topPts(r, "data", C.DATA_PTS) || 0), security: !!r.security }));
    }
    return (S.agg.triageItems || []).filter(t => t.kind === "report").map(t => ({ id: t.id, title: t.title || "no title", sev: null }));
  }

  function newRow(n) {
    return el("tr", { class: "dev-new" },
      el("td", {}, "New, not sorted yet: " + n.title, n.security ? el("span", {}, " ", ui.chip("Security", "sev hi")) : null),
      el("td", { "data-label": "Status" }, ui.chip("Not sorted", "status-none")),
      el("td", { class: "num", "data-label": "Score", text: "-" }),
      el("td", { class: "num", "data-label": "Severity" }, n.sev === null ? "Not sorted yet" : String(n.sev), n.sev === null ? null : el("div", { class: "hint", text: "This report only" })),
      el("td", { class: "num", "data-label": "Teams", text: "1" }), el("td", { class: "num", "data-label": "Sessions", text: "0" }),
      el("td", { class: "num", "data-label": "Affects us too", text: "0" }), el("td", { class: "num", "data-label": "Reports, 30 days", text: "1" }),
      el("td", { class: "num", "data-label": "Goal weight", text: "-" }));
  }

  function goalMapText() {
    const M = C.IMPACT_GOALS;
    const part = (map, names) => Object.entries(map).map(([k, gs]) => names[k] + ": " + gs.join(", ")).join(". ");
    return part(M.stops, C.STOPS) + ". " + part(M.data, C.DATA) + ". " + part(M.cost, C.COST) + ".";
  }

  /* ---------- issue chips: type to find, tap to add (no Ctrl-click) ---------- */
  function issueChips(initial, label) {
    const chosen = new Set(initial || []);
    const search = el("input", { type: "search", placeholder: "Type a few words of the issue", "aria-label": label, autocomplete: "off" });
    const chips = el("div", { class: "dev-chips", "aria-live": "polite" });
    const results = el("div", { class: "dev-results" });
    function words(t) { return String(t || "").toLowerCase().split(/\s+/).filter(Boolean); }
    function drawChips() {
      if (!chosen.size) { put(chips, el("span", { class: "hint", text: "None added. Fine for an idea no study has reported." })); return; }
      put(chips, Array.from(chosen).map(id => el("span", { class: "chip dev-chip" }, issueLabel(id) || id,
        el("button", { type: "button", class: "dev-x", "aria-label": "Remove " + (issueLabel(id) || id), text: "Remove", onclick: () => {
          chosen.delete(id); drawChips(); drawResults(); search.focus();
        } }))));
    }
    function drawResults() {
      const q = words(search.value);
      const list = S.issues.filter(i => !chosen.has(i.id) && (q.length || !calc.isFixed(i)))
        .filter(i => {
          if (!q.length) return true;
          const hay = (i.id + " " + (i.short || "") + " " + i.title + " " + (i.symptom || "") + " " + (i.phrases || []).join(" ")).toLowerCase();
          return q.every(w => hay.includes(w));
        })
        .map(i => ({ i, sig: calc.stats(i).signal })).sort((a, b) => b.sig - a.sig).slice(0, q.length ? 8 : 5);
      put(results,
        el("span", { class: "hint", text: q.length ? (list.length ? "Tap to add:" : "No issue matches. Try other words.") : "Top issues, or type to search:" }),
        list.map(x => el("button", { type: "button", class: "mini dev-add", text: "Add: " + nameOf(x.i).title + " (score " + fmt(x.sig) + ")", onclick: () => {
          chosen.add(x.i.id); search.value = ""; drawChips(); drawResults(); search.focus();
        } })));
    }
    search.addEventListener("input", drawResults);
    search.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const first = results.querySelector("button");
      if (first && search.value.trim()) first.click();
    });
    drawChips(); drawResults();
    return {
      el: el("div", { class: "dev-pick" }, chips, search, results),
      values: () => Array.from(chosen),
      reset() { chosen.clear(); search.value = ""; drawChips(); drawResults(); },
      refresh() { if (document.activeElement !== search) { drawChips(); drawResults(); } }
    };
  }

  function nameList(id) {
    const names = new Set();
    Object.values(S.people || {}).forEach(p => { if (p.name) names.add(p.name); });
    (S.proposals || []).forEach(p => { [p.scoper, p.by].forEach(n => { if (n) names.add(n); }); });
    if (S.user.name) names.add(S.user.name);
    return el("datalist", { id: id }, Array.from(names).sort().map(n => el("option", { value: n })));
  }

  /* ---------- 3a. Quick capture (during the meeting) ---------- */
  function quickForm() {
    const what = el("input", { type: "text", maxlength: "200", placeholder: "In one line" });
    const issues = issueChips([], "Find an issue this idea helps");
    const decName = "dev-dec-" + Math.random().toString(36).slice(2, 8);
    const radios = [["explore", "Explore"], ["not-now", "Not now"]].map(([v, t]) =>
      el("label", { class: "dev-choice" }, el("input", { type: "radio", name: decName, value: v, checked: v === "explore" }), t));
    const reason = el("input", { type: "text", maxlength: "300", placeholder: "One line" });
    const reasonField = ui.field("Why not now", reason, "Teams see this on the issue. Write it to make sense on its own: why it waits, and what would change that. No study names.");
    const scoper = el("input", { type: "text", maxlength: "80", list: "dev-names", value: S.user.name || "" });
    const scoperField = ui.field("Who scopes it", scoper, "They fill in the full card after the meeting.");
    const names = nameList("dev-names");
    const msg = statusLine();
    function dec() { const r = radios.map(l => l.querySelector("input")).find(x => x.checked); return r ? r.value : "explore"; }
    function sync() { const nn = dec() === "not-now"; reasonField.hidden = !nn; scoperField.hidden = nn; }
    const form = el("form", { class: "panel", novalidate: true },
      el("h3", { text: "Capture an idea" }),
      el("p", { class: "hint", text: "During the meeting, write down only these four things." }),
      ui.field("The idea", what),
      el("div", { class: "field" }, el("span", { text: "Issues it helps" }), issues.el),
      el("fieldset", { class: "dev-decision" }, el("legend", { text: "Decision" }), el("div", { class: "opts" }, radios)),
      reasonField, scoperField, names,
      el("div", { class: "bar" }, el("button", { type: "submit", class: "btn", text: "Save the idea" }), msg));
    form.addEventListener("change", e => { if (e.target && e.target.name === decName) sync(); });
    sync();
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const d = dec();
      const rec = { what: what.value.trim(), issues: issues.values(), decision: d,
        notNowReason: d === "not-now" ? reason.value.trim() : "", scoper: d === "explore" ? scoper.value.trim() : "",
        by: S.user.name || "", stage: "captured" };
      if (!rec.what) { msg.textContent = "Write the idea first."; what.focus(); return; }
      if (d === "not-now" && !rec.notNowReason) { msg.textContent = "\"Not now\" needs a reason."; reason.focus(); return; }
      if (d === "explore" && !rec.scoper) { msg.textContent = "Name who scopes it."; scoper.focus(); return; }
      msg.textContent = "Saving...";
      try {
        await store.add("proposals", rec);
        ui.toast("Idea saved");
        form.reset(); issues.reset(); scoper.value = S.user.name || ""; sync();
        msg.textContent = d === "explore" ? "Saved. " + rec.scoper + " fills in the full card after the meeting." : "Saved as Not now.";
        what.focus();
      } catch (err) { msg.textContent = P.writeError(err); }
    });
    form._issues = issues;
    form._names = names;
    return form;
  }

  /* Public lines on a proposal (D23): only these leave the dev and platform roles (portal_proposal_lines). */
  function publicFields(p) {
    const planned = el("input", { type: "text", maxlength: "200", value: p.planned || "" });
    const notNow = el("input", { type: "text", maxlength: "300", value: p.notNowReason || (p.decision === "not-now" ? p.reason || "" : "") });
    const box = el("fieldset", { class: "dev-public" },
      el("legend", { text: "What study teams see on the issue" }),
      el("p", { class: "hint", text: "Every team sees these lines on the issue. Plain words, no study names, no internal notes." }),
      ui.field("What's planned, in one line (optional)", planned),
      ui.field("Why not now (needed for \"Not now\")", notNow));
    return { box, planned, notNow };
  }

  /* Red zone (dev-meeting-process): no Go until there is a written test plan and a named owner and reviewer.
     Returns what is missing, or "". */
  function redZoneGap(rec) {
    if (rec.zone !== "red" || (rec.decision !== "go" && rec.decision !== "conditions")) return "";
    const miss = [!String(rec.test || "").trim() ? "a test plan" : "", !String(rec.owner || "").trim() ? "an owner and reviewer" : ""].filter(Boolean);
    return miss.length ? "A red-zone change needs " + miss.join(" and ") + " before Go." : "";
  }

  /* ---------- 3b. Full proposal card (afterwards, by the person who scopes it) ---------- */
  function proposalForm(p, onDone) {
    p = p || {};
    const what = el("input", { type: "text", maxlength: "200", value: p.what || "" });
    const by = el("input", { type: "text", maxlength: "80", value: p.by || S.user.name || "" });
    const issues = issueChips(p.issues || [], "Find an issue this proposal helps");
    const zones = el("div", { class: "opts" }, C.ZONES.map(([v, t, z]) => el("label", {},
      el("input", { type: "checkbox", value: v, "data-zone": z, checked: (p.touches || []).includes(v) }), t)));
    const zoneOut = el("p", { class: "hint" });
    const reach = el("input", { type: "text", maxlength: "200", value: p.reach || "" });
    const effects = el("input", { type: "text", maxlength: "300", value: p.effects || "" });
    const rev = ui.select([["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]], p.reversible || "unsure");
    const test = el("input", { type: "text", maxlength: "300", placeholder: "What we'll check, on which devices", value: p.test || "" });
    const size = ui.select([["S", "S"], ["M", "M"], ["L", "L"]], p.size || "S");
    const owner = el("input", { type: "text", maxlength: "120", value: p.owner || p.scoper || "" });
    const dec = ui.select(Object.entries(DEC), p.decision || "explore");
    const pub = publicFields(p);
    const conditions = el("input", { type: "text", maxlength: "300", value: p.conditions || (p.decision !== "not-now" ? p.reason || "" : "") });
    const spec = el("input", { type: "url", maxlength: "300", placeholder: "https://", value: p.specUrl || "" });
    const msg = statusLine();

    function zoneOf() {
      const z = ui.$$("input:checked", zones).map(c => c.dataset.zone);
      return z.includes("red") ? "red" : z.includes("yellow") ? "yellow" : z.length ? "green" : "";
    }
    zones.addEventListener("change", () => { const z = zoneOf(); zoneOut.textContent = z ? C.ZONE_TEXT[z] : ""; });
    if (zoneOf()) zoneOut.textContent = C.ZONE_TEXT[zoneOf()];
    const cancel = onDone ? el("button", { type: "button", class: "btn ghost", text: "Cancel", onclick: () => onDone(false) }) : null;

    const form = el("form", { class: p.id ? "list" : "panel", novalidate: true },
      el("h3", { text: p.id ? "Full proposal card" : "Write a full proposal card" }),
      el("p", { class: "hint", text: p.id ? "Fill in after the meeting. Only developers and the platform team see it." : "For an idea that didn't come through the meeting, for example from a contributor." }),
      el("div", { class: "grid2" }, ui.field("The idea", what), ui.field("Proposed by", by)),
      el("div", { class: "field" }, el("span", { text: "Issues it helps" }), issues.el),
      el("fieldset", {}, el("legend", { text: "What it touches" }), zones, zoneOut),
      el("div", { class: "grid2" },
        ui.field("Reach: which servers get it, and how", reach, "Include teams on their own servers."),
        ui.field("Effects on other work or live studies", effects),
        ui.field("Can it be rolled back without data loss?", rev),
        ui.field("Test plan", test),
        ui.field("Size", size),
        ui.field("Owner and reviewer", owner),
        ui.field("Decision", dec),
        ui.field("Conditions or notes (internal)", conditions, "Developers and the platform team only."),
        ui.field("Working spec link (optional)", spec, "Where progress and design decisions live. Developers and the platform team see it.")),
      pub.box,
      el("div", { class: "bar" }, el("button", { type: "submit", class: "btn", text: p.id ? "Save the full card" : "Save the proposal" }), cancel, msg));

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const rec = {
        what: what.value.trim(), by: by.value.trim(), issues: issues.values(),
        touches: ui.$$("input:checked", zones).map(c => c.value), zone: zoneOf(),
        reach: reach.value.trim(), effects: effects.value.trim(), reversible: rev.value, test: test.value.trim(),
        size: size.value, owner: owner.value.trim(), decision: dec.value,
        conditions: conditions.value.trim(), planned: pub.planned.value.trim(),
        notNowReason: dec.value === "not-now" ? pub.notNow.value.trim() : "",
        specUrl: spec.value.trim(), stage: "full"
      };
      if (!rec.what) { msg.textContent = "Describe the idea first."; what.focus(); return; }
      if (rec.decision === "not-now" && !rec.notNowReason) { msg.textContent = "\"Not now\" needs a reason for study teams."; pub.notNow.focus(); return; }
      if (rec.specUrl && !isHttp(rec.specUrl)) { msg.textContent = "The spec link must start with https://"; spec.focus(); return; }
      const redGap = redZoneGap(rec);
      if (redGap) { msg.textContent = redGap; (rec.test ? owner : test).focus(); return; }
      msg.textContent = "Saving...";
      try {
        if (p.id) await store.patch("proposals/" + p.id, rec); else await store.add("proposals", rec);
        /* The spec link stays on the card (developers and the platform team). It is no longer copied onto
           issues, which every team can read (D23). Whether teams should see it is open (SPEC 10, item 24). */
        ui.toast("Proposal saved");
        if (onDone) { onDone(true); return; }
        msg.textContent = "Proposal saved.";
        form.reset(); issues.reset(); by.value = S.user.name || ""; zoneOut.textContent = "";
      } catch (err) { msg.textContent = P.writeError(err); }
    });
    form._issues = issues;
    return form;
  }

  function proposalItem(p) {
    const box = el("div", { class: "panel dev-prop" });
    const canEdit = canDev();
    const nnr = p.notNowReason || (p.decision === "not-now" ? p.reason : "");
    const cond = p.conditions || (p.decision !== "not-now" ? p.reason : "");
    function view() {
      delete box.dataset.busy;
      /* Each linked issue with its score and team count, so the idea can be weighed here (dev-meeting-process). */
      const helps = (p.issues || []).map(id => {
        const iss = calc.issue(id);
        if (!iss) return calc.issueTitle(id);
        const s2 = calc.stats(iss);
        return issueLabel(id) + " (score " + fmt(s2.signal) + ", " + plural(s2.teams, "team") + ")";
      }).join("; ") || "Contributor need, no study report yet";
      const strip = t => String(t || "").trim().replace(/[.!]+$/, "");
      /* Preview with the label teams actually read (calc.planFor): on an issue that isn't itself Not now,
         a card's reason shows under a different label than "Why not now". */
      const firstIssue = (p.issues || []).map(id => calc.issue(id)).filter(Boolean)[0];
      const nnLabel = (firstIssue && firstIssue.status !== "not-now" && calc.planFor(firstIssue).notNowLabel) || "Why not now: ";
      const seen = [p.planned ? "Planned: " + strip(p.planned) : "", p.decision === "not-now" && nnr ? nnLabel + strip(nnr) : ""].filter(Boolean);
      /* What Start here and the guide actually show (calc.planFor): the issue's own line, or a newer card's,
         can come first. Say so, so nobody thinks teams see a line they don't. */
      const differs = (p.issues || []).map(id => calc.issue(id)).filter(Boolean).map(i => ({ i, f: calc.planFor(i) }))
        .filter(x => p.planned && x.f.planned && calc.norm(x.f.planned) !== calc.norm(p.planned));
      put(box,
        el("div", { class: "bar" }, el("h3", { text: p.what || "No title" }),
          p.stage === "captured" && p.decision !== "not-now" ? ui.chip("Needs a full card", "unconfirmed") : null,
          p.decision ? ui.chip(DEC[p.decision] || p.decision, p.decision === "not-now" ? "status-not-now" : p.decision === "scope" ? "status-scoping" : "status-in-progress") : null,
          p.zone ? ui.chip(p.zone === "red" ? "Red zone" : p.zone === "yellow" ? "Yellow zone" : "Green zone", p.zone === "red" ? "sev hi" : "sev") : null),
        el("p", { class: "hint", text: [p.by ? "Proposed by " + p.by : "", p.scoper ? "Scoped by " + p.scoper : "", p.size ? "Size " + p.size : "",
          p.owner ? "Owner and reviewer: " + p.owner : "", ui.fmtDate(p.created)].filter(Boolean).join(". ") + "." }),
        el("p", {}, el("b", { text: "Helps: " }), helps),
        el("p", { class: "dev-seen" }, el("b", { text: "Teams see on the issue: " }), seen.length ? seen.join(". ") + "." : "nothing from this card yet."),
        differs.map(x => el("p", { class: "hint", text: "Teams see a different \"Planned\" line on \"" + nameOf(x.i).title + "\": \"" + strip(x.f.planned) + "\". Change it under Ranked issues, Edit what teams see." })),
        cond ? el("p", {}, el("b", { text: "Conditions or notes: " }), cond) : null,
        p.test ? el("p", {}, el("b", { text: "Test plan: " }), p.test) : null,
        p.specUrl && isHttp(p.specUrl) ? el("p", {}, specLink(p.specUrl, "Open the working spec")) : null,
        canEdit ? el("div", { class: "bar" },
          el("button", { type: "button", class: p.stage === "captured" ? "btn" : "btn ghost", text: p.stage === "captured" ? "Fill in the full card" : "Edit the full card", onclick: full }),
          el("button", { type: "button", class: "btn ghost", text: "Record a decision", onclick: edit })) : null);
    }
    function full() {
      box.dataset.busy = "1";
      put(box, proposalForm(p, () => view()));
    }
    function edit() {
      box.dataset.busy = "1";
      const dec = ui.select(Object.entries(DEC), p.decision || "go");
      const pub = publicFields(p);
      const spec = el("input", { type: "url", maxlength: "300", value: p.specUrl || "", placeholder: "https://" });
      const owner = el("input", { type: "text", maxlength: "120", value: p.owner || "" });
      const msg = statusLine();
      put(box,
        el("h3", { text: p.what || "No title" }),
        el("div", { class: "grid2" }, ui.field("Decision", dec), ui.field("Owner and reviewer", owner), ui.field("Working spec link", spec)),
        pub.box,
        el("div", { class: "bar" },
          el("button", { type: "button", class: "btn", text: "Save the decision", onclick: async () => {
            const r = pub.notNow.value.trim(), u = spec.value.trim();
            if (dec.value === "not-now" && !r) { msg.textContent = "\"Not now\" needs a reason for study teams."; pub.notNow.focus(); return; }
            if (u && !isHttp(u)) { msg.textContent = "The spec link must start with https://"; spec.focus(); return; }
            const redGap = redZoneGap(Object.assign({}, p, { decision: dec.value, owner: owner.value.trim() }));
            if (redGap) { msg.textContent = redGap + (p.test ? "" : " Add it on the full card."); return; }
            msg.textContent = "Saving...";
            try {
              await store.patch("proposals/" + p.id, { decision: dec.value, notNowReason: dec.value === "not-now" ? r : "",
                planned: pub.planned.value.trim(), owner: owner.value.trim(), specUrl: u });
              ui.toast("Decision saved"); view();
            } catch (e) { msg.textContent = P.writeError(e); }
          } }),
          el("button", { type: "button", class: "btn ghost", text: "Cancel", onclick: view }), msg));
      dec.focus();
    }
    view();
    return box;
  }

  /* ---------- page ---------- */
  function build(sec) {
    const shared = st.meeting && st.meeting.lastMeeting;
    st.since = shared || lsGet("ip-last-meeting") || isoDay(new Date(Date.now() - 14 * 864e5));
    const sinceIn = el("input", { type: "date", value: st.since, "aria-label": "Show what is new since" });
    sinceIn.addEventListener("change", () => { if (sinceIn.value) { st.since = sinceIn.value; st.sinceManual = true; lsSet("ip-last-meeting", st.since); refresh(); } });
    const meetHost = el("div", { class: "list" });
    const sinceHost = el("div", { class: "list" });

    const fixedBox = el("input", { type: "checkbox", checked: st.showFixed });
    fixedBox.addEventListener("change", () => { st.showFixed = fixedBox.checked; refresh(); });
    const tbody = el("tbody");
    const newBody = el("tbody");
    const table = el("table", { class: "dev-table" },
      el("thead", {}, el("tr", {}, ["Issue", "Status", "Score", "Severity", "Teams", "Sessions", "Affects us too", "Reports, 30 days", "Goal weight"]
        .map(h => el("th", { scope: "col", text: h })))),
      tbody, newBody);
    const starter = el("p", { class: "notice", hidden: true });
    const moreBtn = el("button", { type: "button", class: "btn ghost", onclick: () => { st.showAll = !st.showAll; refresh(); } });

    const dev = canDev();
    const quick = dev ? quickForm() : null;
    const form = dev ? proposalForm() : null;
    const fullWrap = dev ? el("details", { class: "panel" }, el("summary", { text: "Write a full proposal card without a meeting" }), form) : null;
    const propCount = el("p", { class: "hint" });
    const propHost = el("div", { class: "list" });

    put(sec,
      /* Study roles come here to see how problems are ranked, not to run the meeting: the meeting how-to
         is for developers and the platform team. */
      dev ? ui.pageHead(P.PAGE_COPY.dev) : ui.pageHead({ title: (P.PAGE_COPY.dev || {}).title || "Dev meeting",
        subtitle: "How the dev meeting ranks problems.", when: P.ui.info ? undefined : "How the dev meeting ranks problems." }),
      /* Study roles see only the ranking: the report link and the unsorted items are for developers. */
      dev ? el("div", { class: "panel" }, el("h3", { text: "Before the meeting" }), meetHost) : null,
      dev ? el("div", { class: "panel" },
        el("h3", { text: "1. New since the last meeting" }),
        el("div", { class: "bar" }, ui.field("Show what is new since", sinceIn)),
        sinceHost) : null,
      el("div", { class: "panel" },
        el("h3", { text: dev ? "2. Ranked issues" : "Ranked issues" }),
        el("p", { class: "hint", text: "The score starts the discussion. It doesn't decide it." }),
        dev ? null : el("p", { class: "hint", text: "What's planned for each problem, and any \"Not now\" reason, shows on Known problems." }),
        starter,
        el("label", { class: "opts" }, el("span", { class: "dev-check" }, fixedBox, "Show fixed issues")),
        el("div", { class: "scroll" }, table),
        el("div", { class: "bar" }, moreBtn),
        el("details", { class: "hint dev-formula", id: "dev-formula" },
          el("summary", { text: "The formula" }),
          el("p", { text: "Score = severity + breadth + \"This affects us too\" (up to 3) + reports in the last 30 days (up to 3) + goal weight." }),
          el("ul", {},
            el("li", { text: "Severity: what it stopped plus what it did to the data, averaged over teams' reports. What it stopped: Nothing 0, Slowed someone down 1, Prevented a task 2, Led to dropout 3. What it did to the data: Nothing 0, Data missing 2, Can't tell 2, Data wrong or misleading 3. Until an issue has a report, the platform team's first estimate is used. Sessions don't record impact, so they count toward breadth only." }),
            el("li", { text: "Breadth: teams with reports or troubleshooting sessions, plus teams in records from before the portal. 1 team = 1, 2 to 3 = 2, 4 to 6 = 3, 7 or more = 4." }),
            el("li", { text: "Goal weight (0 to 3): each report's answers point to study goals. " + goalMapText() + " For each reporting study that ranked its goals: 3 if its first goal is threatened, 2 its second, 1 its third, else 0. Averaged over those studies." }),
            el("li", { text: "Test studies and admin test runs are left out of every number." })))),
      dev ? el("div", { class: "panel" },
        el("h3", { text: "3. Ideas and proposals" }),
        el("p", { class: "hint", text: "Proposal cards are for developers and the platform team. Other teams see only each issue's status, the \"What's planned\" line and any \"Not now\" reason." }),
        quick, propCount, propHost) : null,
      fullWrap);

    st.h = { meetHost, sinceIn, sinceHost, tbody, newBody, starter, moreBtn, form, quick, propHost, propCount, dev };
    st.built = true;
  }

  function refresh() {
    const h = st.h;
    if (!h) return;
    put(h.meetHost, ...meetingBlock());
    put(h.sinceHost, ...sinceBlock());

    const all = S.issues.filter(i => st.showFixed || !calc.isFixed(i)).map(i => ({ i, s: calc.stats(i) }))
      .sort((a, b) => (b.s.signal - a.s.signal) || (b.s.teams - a.s.teams));
    const rows = st.showAll ? all : all.slice(0, TOP_N);
    keyed(h.tbody, rows, x => x.i.id,
      x => JSON.stringify([x.i.title, x.i.short, x.i.status, x.i.statusNote, x.i.notNowReason, x.i.planned, x.i.security, x.i.specUrl, x.i.teams,
        x.s.teams, x.s.portalTeams, x.s.sessions, x.s.sev, x.s.sevN, x.s.goal, x.s.goalN, x.s.boosts, x.s.recent, x.s.signal,
        (st.scores && st.scores[x.i.id]) || null]),
      issueRow);
    h.moreBtn.hidden = all.length <= TOP_N;
    h.moreBtn.textContent = st.showAll ? "Show the top " + TOP_N + " only" : "Show all " + all.length + " issues";
    put(h.newBody, ...newRows().map(newRow));
    const onStarter = all.filter(x => x.s.sevFrom !== "reports").length;
    h.starter.hidden = !onStarter;
    h.starter.textContent = onStarter + " of " + all.length + " issues have no team reports yet. Their severity, marked \"est.\", is the platform team's first estimate.";

    if (!h.dev) return;
    h.quick._issues.refresh();
    h.form._issues.refresh();
    const names = nameList("dev-names");
    const namesSig = Array.from(names.children).map(o => o.value).join("|");
    if (namesSig !== h.quick._namesSig) { h.quick._names.replaceWith(names); h.quick._names = names; h.quick._namesSig = namesSig; }
    const props = S.proposals.slice().sort((a, b) =>
      ((a.stage === "captured" ? 0 : 1) - (b.stage === "captured" ? 0 : 1)) || String(b.created).localeCompare(String(a.created)));
    /* A captured Not now idea is complete: only Explore ideas wait for a full card (D23). */
    const waiting = props.filter(p => p.stage === "captured" && p.decision !== "not-now").length;
    h.propCount.textContent = props.length ? plural(props.length, "proposal") + (waiting ? ", " + waiting + (waiting === 1 ? " still needs" : " still need") + " a full card." : ".") : "";
    if (!props.length) { h.propHost._cache = null; h.propHost.replaceChildren(ui.empty("No proposals yet.")); return; }
    if (h.propHost.firstElementChild && h.propHost.firstElementChild.classList.contains("empty")) h.propHost.replaceChildren();
    keyed(h.propHost, props, p => p.id, p => String(p.updated) + (issueLabel((p.issues || [])[0]) || ""), proposalItem);
  }

  P.register({
    id: "dev",
    order: 60,
    init() {
      P.on("agg", () => { if (P.current() === "dev") loadScores(); });
    },
    render(params) {
      const sec = P.section("dev");
      if (!st.built) { build(sec); loadMeeting(); loadScores(); }
      else if (params) { loadMeeting(); loadScores(); }
      refresh();
      /* The Your study page links here to show how goals weight the ranking. */
      if (params && params.focus === "signal") {
        const f = document.getElementById("dev-formula");
        if (f) {
          f.open = true;
          const sum = f.querySelector("summary");
          try { f.scrollIntoView({ block: "start" }); } catch (e) { /* ignore */ }
          if (sum) try { sum.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
      }
    }
  });
})();

/* INTEGRATED 2026-10-27: only this dev.js exists (no B5 version was written). Page head from P.PAGE_COPY.dev. */
/* INTEGRATED (pass 2, 2026-10-28)
   - Meeting order: Before the meeting (report link), 1 New since the last meeting, 2 Ranked issues (top 10,
     "Show all"), 3 Ideas and proposals (quick capture, then the list). Full card without a meeting at the end.
   - Meeting details: store.rpc("portal_meeting") / ("portal_set_meeting") on the Admin page (03 section 8).
   - Score tracing reads S.agg.scores[issueId] {sevStudies, stopsTally, dataTally, sessionsUnfixed, goalPoints},
     mapped by core from portal_issue_scores.
   - Public proposal lines (planned, notNowReason) reach other teams through portal_proposal_lines ->
     S.agg.plans -> calc.planFor(issue). `conditions` stays internal. Old `reason` is read as before.
   - render({focus: "signal"}) opens and scrolls to the formula. */
/* ROUND 2026-10-28 (CONTRACT-2026-10-28.md): issue names through P.ui.issueName (short name, sentence as
   subtitle). "Not an app problem" sessions are left out of "New since" and tallied apart (.dev-notapp) from
   calc.notAppTally(sinceIso). Session outcomes read through calc.effectiveOutcome. */
