/* Start here page. Owner: core-home-about. Spec: SPEC.md section 7.1, ux-audit items 2, 5, 9 and 10.
   Also holds PAGE_COPY: the page-head copy (title, one "when" line, at most 3 steps) for every page.
   Other modules read it as Portal.PAGE_COPY[pageId]. Core folds the steps away (closed by default).
   Plain, short sentences. No em-dashes. Nothing here names a study, team, site or person. */
(function () {
  "use strict";
  const P = window.Portal;
  const C = P.C, S = P.S, calc = P.calc, ui = P.ui;
  const el = ui.el;

  /* ---------- page-head copy for every page ----------
     Rules (ux-audit item 2, decided 10-27): a title, one short "when" line, at most 3 steps (folded by default).
     Steps cover only order that the page doesn't already show. Explain an idea once per page. */
  const PAGE_COPY = {
    home: {
      title: "Start here",
      whenByRole: {
        rc: "Help participants with problems, and tell the platform team what keeps happening.",
        lead: "Keep your study's setup and goals current, and watch the problems that affect it.",
        analyst: "Troubleshoot missing data, and tell the platform team what keeps happening.",
        dev: "See what's new and get ready for the dev meeting.",
        platform: "Sort new problems and get ready for the dev meeting.",
        none: "Ask the platform team to add you to a study. Until then, you can read the guide and the known problems."
      },
      stepsByRole: {
        rc: [
          "During a call, use Troubleshoot. Each finished run saves a session.",
          "When a problem keeps coming up, report it from the list on this page.",
          "Come back here to see what happened to what you sent."
        ],
        lead: [
          "Keep your study setup current. It decides which troubleshooting steps show.",
          "Rank your study's goals. The rankings weight how issues are ranked.",
          "Report the problems that keep coming up for your study."
        ],
        analyst: [
          "When data is missing, troubleshoot it step by step.",
          "When a problem keeps coming up, report it from the list on this page.",
          "Come back here to see what happened to what you sent."
        ],
        dev: [
          "Check how many new items are waiting.",
          "Open the dev meeting view before each meeting."
        ],
        platform: [
          "Sort new problems into issues on the Admin page.",
          "Prepare the dev meeting.",
          "Add studies and set people's roles on the Admin page."
        ],
        none: [
          "Ask the platform team to add you to a study.",
          "Until then, you can read the troubleshooting steps and the known problems."
        ]
      }
    },
    guide: {
      title: "Troubleshoot a participant",
      when: "Use this during a call with a participant, or right after it.",
      steps: [
        "Pick the phone type and what the person sees.",
        "Answer one step at a time. Tap an earlier answer to go back.",
        "The session saves itself at the end. It holds no participant details."
      ]
    },
    report: {
      title: "Report a problem for your study",
      when: "Use this once a week, or when the same problem keeps coming up.",
      steps: [
        "Pick the problem. Your sessions fill in most of the rest.",
        "Check what's filled in. Say how it affected your study.",
        "Send it. You'll see status changes on Start here."
      ]
    },
    issues: {
      title: "Check if a problem is known",
      when: "Use this to see a problem's status and what helps.",
      steps: [
        "Search with the words people use.",
        "Open a problem to see what helps, then its status.",
        "Tap \"This affects us too\" if it matters to your study."
      ]
    },
    study: {
      title: "Set up your study",
      when: "Fill this in once. Update it when your setup changes.",
      steps: [
        "Answer the setup questions. They decide which troubleshooting steps show.",
        "Optional: pick population tags.",
        "Study lead: rank your study's goals. The rankings weight how issues are ranked."
      ]
    },
    dev: {
      title: "Prepare the dev meeting",
      when: "Use this before and during the dev meeting, every two weeks.",
      steps: [
        "Open the pre-meeting report. Check what is new since the last meeting.",
        "Discuss the ranked issues and set each status. \"Not now\" always needs a reason.",
        "Capture each idea in four fields. The person who scopes it fills in the full card afterwards."
      ]
    },
    admin: {
      title: "Run the portal",
      when: "For the platform team: studies, people, and sorting new problems.",
      steps: [
        "Create each study, then add its people with their roles.",
        "Sort new problems: link each to an issue, make a new issue, or dismiss it.",
        "Before each dev meeting, set the meeting date and the report link."
      ]
    },
    about: {
      title: "How this works",
      when: "How a problem moves from your team to a fix, and who sees what.",
      steps: [
        "Read the five steps.",
        "Check who sees what.",
        "Answer the questions at the end, or send feedback."
      ]
    }
  };
  P.PAGE_COPY = PAGE_COPY;

  /* ---------- home copy ---------- */
  const T = {
    noRole: "The platform team sets your role when it creates your account.",
    noStudy: "You are not in a study yet. Ask the platform team to add you.",
    probHead: "Your study's problems this week",
    probHeadLead: "Problems affecting your study",
    probWhat: "A session is one participant. A report sums up a problem for your study, and starts filled in from your sessions. The platform team sorts new items before each dev meeting.",
    probEmpty: "No troubleshooting sessions on a known problem in the last 7 days.",
    probEmptyLead: "No problems linked to your study yet. They show here when your team logs sessions, reports or adds a reason on a known problem.",
    probLoading: "Loading your team's sessions.",
    pickStudy: "Pick a study in the menu at the top to see its sessions.",
    notMember: "You are not a member of this study, so you can't see its sessions.",
    sentHead: "What happened to what you sent",
    sentWhat: "Problems your team sent that weren't in the list yet, from the last 30 days, and what the platform team did with them.",
    sentEmpty: "Nothing new from your team in the last 30 days. When you send a problem that isn't listed, you'll see here what happened to it.",
    todoHead: "To do for your study",
    todoSetup: "Fill in your study setup. Until you do, the guide shows every step, even ones that don't apply.",
    todoGoals: "Rank your study's top goals. The rankings weight how issues are ranked.",
    newHead: "New since the last meeting",
    newNotReady: "The counts aren't available yet. Ask the platform team.",
    sinceHead: "Since your last visit",
    sinceFirst: "Changes to problems you report, troubleshoot or add a reason to will show here.",
    sinceEmpty: "No status changes on problems you follow."
  };

  /* ---------- small helpers ---------- */
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function time(iso) { const t = Date.parse(iso || ""); return isNaN(t) ? 0 : t; }
  function effIssue(rec) { return (rec && (rec.linkedIssueId || rec.issueId)) || ""; }
  function entries() { return (P.guide().entries || []); }
  function entryTitle(entryId) {
    const e = entries().find(x => x.id === entryId);
    return e ? e.title : (entryId === "other" || !entryId ? "Something else" : entryId);
  }
  function btn(text, key, onclick, cls) {
    return el("button", { type: "button", class: cls || "btn", "data-k": key, onclick: onclick, text: text });
  }
  function block(head, what, id) {
    const h = el("h3", { text: head, tabindex: "-1" });
    if (id) h.id = id;
    return el("div", { class: "list" }, h, what ? el("p", { class: "hint", text: what }) : null);
  }
  function lastSeenMs() { return S.user.lastSeen ? time(S.user.lastSeen) : 0; }

  /* ---------- main actions ---------- */
  function action(title, sub, key, onclick) {
    return el("div", { class: "field" },
      btn(title, key, onclick, "btn big"),
      sub ? el("span", { class: "hint", text: sub }) : null);
  }
  function actionsFor(role) {
    const toGuide = (p) => () => P.go("guide", p || {});
    const toReport = () => P.go("report", { studyId: S.studyId });
    let acts;
    if (role === "rc" || !role) acts = [
      action("Troubleshoot a participant", "Step by step, during the call or right after it.", "act:guide", toGuide()),
      action("Report a problem", "Say how a problem affected your study.", "act:report", toReport)
    ];
    else if (role === "lead") acts = [
      action("Set up your study", "Your setup decides which troubleshooting steps show.", "act:study", () => P.go("study", {})),
      action("Check known problems", "Every problem teams have hit, and what helps.", "act:issues", () => P.go("issues", {}))
    ];
    else if (role === "analyst") acts = [
      action("Troubleshoot missing data", "Starts the guide at \"Data is missing on your end\".", "act:data", toGuide({ entryId: "data_missing" })),
      action("Report a data problem", "Say how it affected your study's data.", "act:report", toReport)
    ];
    else {
      acts = [action("Open the dev meeting view", "Ranked issues, new items and ideas.", "act:dev", () => P.go("dev", {}))];
      if (S.user.isAdmin) acts.push(action("Sort new problems", "Link each one to an issue on the Admin page.", "act:triage", () => P.go("admin", { focus: "triage" })));
    }
    return el("div", { class: "grid2" }, acts);
  }

  /* ---------- the study's problems: each listed once, each with its own report button ---------- */
  function groupSessions(list) {
    const groups = new Map();
    list.forEach(s => {
      const iid = effIssue(s);
      const key = iid ? "i:" + iid : "e:" + (s.entryId || "other");
      if (!groups.has(key)) groups.set(key, { key: key, issueId: iid, entryId: s.entryId || "other", sessions: [] });
      groups.get(key).sessions.push(s);
    });
    return Array.from(groups.values()).map(g => {
      const n = o => g.sessions.filter(s => s.outcome === o).length;
      g.counts = { fixed: n("fixed"), unconfirmed: n("unconfirmed"), not_fixed: n("not_fixed"), no_fix_yet: n("no_fix_yet"),
        new_problem: n("new_problem"), ended_early: n("ended_early") };
      g.newest = g.sessions.reduce((m, s) => Math.max(m, time(s.created)), 0);
      g.label = groupLabel(g);
      return g;
    });
  }
  function groupLabel(g) {
    if (g.issueId) {
      const e = entries().find(x => x.issueId === g.issueId);
      return e ? e.title : calc.issueTitle(g.issueId);
    }
    return entryTitle(g.entryId);
  }
  /* The study's newest report on this issue, made at or after `after` (0 = any time). */
  function lastReport(studyId, issueId, after) {
    return S.reports.filter(r => r.studyId === studyId && effIssue(r) === issueId && time(r.created) >= (after || 0))
      .sort((a, b) => time(b.created) - time(a.created))[0] || null;
  }
  function countLine(g) {
    const c = g.counts;
    const parts = [plural(g.sessions.length, "session")];
    if (c.not_fixed) parts.push(c.not_fixed + " not fixed");
    if (c.no_fix_yet) parts.push(c.no_fix_yet + " with no fix yet");
    if (c.fixed) parts.push(c.fixed + " fixed");
    if (c.unconfirmed) parts.push(c.unconfirmed + " fix not confirmed yet");
    if (c.ended_early) parts.push(c.ended_early + " ended early");
    if (c.new_problem) parts.push(c.new_problem + " new " + (c.new_problem === 1 ? "problem" : "problems"));
    return parts.join(", ");
  }
  function openReport(issueId, sessions) {
    P.go("report", sessions && sessions.length
      ? { issueId: issueId, studyId: S.studyId, sessionIds: sessions.map(s => s.id), fromSessions: true }
      : { issueId: issueId, studyId: S.studyId });
  }

  function problemsBlock(role) {
    const isLead = role === "lead";
    const b = block(isLead ? T.probHeadLead : T.probHead, T.probWhat);
    const sid = S.studyId;
    if (!sid) { b.append(ui.empty(T.pickStudy)); return b; }
    if (!calc.isMember(sid)) { b.append(ui.empty(T.notMember)); return b; }
    if (!S.loaded.sessions) { b.append(el("p", { class: "hint", text: T.probLoading })); return b; }

    const groups = groupSessions(calc.sessionsFor({ studyId: sid, sinceDays: 7 }));
    const byIssue = new Map(groups.filter(g => g.issueId).map(g => [g.issueId, g]));
    const ids = new Set(byIssue.keys());
    const mine = {};
    if (isLead) {
      /* Leads also see issues their study reported or boosted, not only this week's sessions. */
      const bump = (iid, k) => { if (!iid || iid === "new") return; ids.add(iid); (mine[iid] = mine[iid] || { r: 0, b: 0 })[k]++; };
      S.reports.filter(x => x.studyId === sid).forEach(x => bump(effIssue(x), "r"));
      S.boosts.filter(x => x.studyId === sid).forEach(x => bump(x.issueId, "b"));
      S.sessions.filter(x => x.studyId === sid).forEach(x => { const i = effIssue(x); if (i) ids.add(i); });
    }
    const rows = Array.from(ids).map(id => {
      const issue = calc.issue(id);
      if (!issue) return null;
      const g = byIssue.get(id) || null;
      const rep = g ? lastReport(sid, id, g.newest) : null;
      return { id: id, issue: issue, g: g, reported: rep, st: calc.stats(issue), mine: mine[id] || { r: 0, b: 0 } };
    }).filter(r => r && !(isLead && !r.g && calc.isFixed(r.issue)));
    /* This week's unreported problems first, then by how urgent the portal ranks them. */
    rows.sort((x, y) => ((y.g && !y.reported) ? 1 : 0) - ((x.g && !x.reported) ? 1 : 0)
      || ((y.g ? y.g.sessions.length : 0) - (x.g ? x.g.sessions.length : 0))
      || (y.st.signal - x.st.signal));
    const shown = isLead ? rows.slice(0, 8) : rows;

    if (!shown.length) b.append(ui.empty(isLead ? T.probEmptyLead : T.probEmpty));
    shown.forEach(r => b.append(problemRow(r, sid)));
    if (rows.length > shown.length) b.append(el("p", { class: "hint", text: "Showing " + shown.length + " of " + rows.length + ". The rest are under Known problems." }));

    const loose = groups.filter(g => !g.issueId);
    const looseN = loose.reduce((n, g) => n + g.sessions.length, 0);
    if (looseN) {
      const open = loose.reduce((n, g) => n + g.counts.not_fixed + g.counts.new_problem, 0);
      b.append(el("p", { class: "hint", text: plural(looseN, "session") + " this week had no known problem." +
        (open ? " The ones that weren't fixed are listed under \"" + T.sentHead + "\"." : " They need no action.") }));
    }
    return b;
  }
  function problemRow(r, sid) {
    const g = r.g;
    const title = g ? g.label : r.issue.title;
    const lastRep = r.reported || lastReport(sid, r.id, 0);
    const lines = [];
    if (g) lines.push(el("p", { text: "This week: " + countLine(g) + "." }));
    if (g && g.counts.not_fixed) {
      const waiting = g.sessions.filter(s => s.outcome === "not_fixed" && (!s.triage || s.triage.state === "new")).length;
      lines.push(el("p", { class: "hint", text: waiting
        ? waiting + " not fixed " + (waiting === 1 ? "is" : "are") + " waiting for the platform team."
        : "The platform team has seen the sessions that weren't fixed." }));
    }
    if (title !== r.issue.title) lines.push(el("p", { class: "hint", text: "Known problem: " + r.issue.title }));
    if (!g && (r.mine.r || r.mine.b)) {
      lines.push(el("p", { class: "hint", text: "Your team: " + [r.mine.r ? plural(r.mine.r, "report") : "",
        r.mine.b ? plural(r.mine.b, "reason added", "reasons added") : ""].filter(Boolean).join(", ") + "." }));
    }
    lines.push(el("p", { class: "hint", text: "Seen by " + plural(r.st.teams, "team") + " in all." }));
    const plan = P.calc.planFor(r.issue);
    if (plan.notNow) lines.push(el("p", { class: "hint", text: plan.notNowLabel + plan.notNow }));
    else if (plan.planned) lines.push(el("p", { class: "hint", text: "Planned: " + plan.planned }));

    const acts = [];
    if (g && !r.reported) acts.push(btn("Report this for your study", "rep:" + r.id, () => openReport(r.id, g.sessions), "btn"));
    else if (!g && !lastRep) acts.push(btn("Report this for your study", "rep:" + r.id, () => openReport(r.id, null), "btn ghost"));
    acts.push(btn("Open the issue", "open:" + r.id, () => P.go("issues", { issueId: r.id }), "btn ghost"));

    return el("div", { class: "panel" },
      el("div", { class: "bar" }, el("h3", { text: title }), ui.statusChip(r.issue.status),
        r.reported ? ui.chip("Reported " + ui.fmtDate(r.reported.created), "stamp")
          : lastRep ? ui.chip("Last report " + ui.fmtDate(lastRep.created)) : null),
      lines,
      el("div", { class: "bar" }, acts));
  }

  /* ---------- close the loop: what happened to the team's escalations (ux-audit item 9) ---------- */
  function sentItems() {
    const sid = S.studyId;
    const since = Date.now() - 30 * 864e5;
    const items = [];
    /* Not-fixed sessions on a known problem are summed up on that problem's row instead (each problem once). */
    S.sessions.filter(s => s.studyId === sid && time(s.created) >= since &&
      (s.outcome === "new_problem" || (s.outcome === "not_fixed" && !s.issueId)))
      .forEach(s => items.push({ kind: "session", rec: s }));
    S.reports.filter(r => r.studyId === sid && r.issueId === "new" && time(r.created) >= since)
      .forEach(r => items.push({ kind: "report", rec: r }));
    return items.sort((a, b) => time(b.rec.created) - time(a.rec.created));
  }
  function sentState(it) {
    const rec = it.rec;
    const tri = rec.triage || {};
    const iid = it.kind === "report" ? (rec.linkedIssueId || "") : effIssue(rec);
    const issue = iid ? calc.issue(iid) : null;
    if (tri.state === "dismissed") return { text: "Closed by the platform team.", issue: null, at: tri.at };
    if (tri.state === "linked" && issue) return { text: "Matched to: " + issue.title, issue: issue, at: tri.at };
    if (issue && issue.status === "needs-detail") return { text: "The platform team needs more detail on: " + issue.title, issue: issue, at: issue.statusChangedAt };
    if (tri.state === "new" || !tri.state) {
      return { text: "Waiting for the platform team. They sort new items before each dev meeting." +
        (issue ? " Known problem: " + issue.title + "." : ""), issue: issue, at: null };
    }
    return { text: issue ? "Known problem: " + issue.title : "No action needed.", issue: issue, at: null };
  }
  function sentBlock() {
    const b = block(T.sentHead, T.sentWhat);
    const sid = S.studyId;
    if (!sid || !calc.isMember(sid) || !S.loaded.sessions) return null;
    const items = sentItems();
    if (!items.length) { b.append(ui.empty(T.sentEmpty)); return b; }
    const last = lastSeenMs();
    const list = el("ul", { class: "clean home-sent" });
    items.slice(0, 8).forEach(it => {
      const rec = it.rec;
      const what = it.kind === "report"
        ? "Report: " + (rec.newTitle || "Something new")
        : (rec.outcome === "new_problem"
          ? "Something else: " + ((rec.newProblem && rec.newProblem.what) || entryTitle(rec.entryId))
          : entryTitle(rec.entryId) + " (not fixed)");
      const stt = sentState(it);
      const changed = last && stt.at && time(stt.at) > last;
      list.append(el("li", {},
        el("div", { class: "bar" },
          el("strong", { text: what }),
          el("span", { class: "hint", text: ui.fmtDate(rec.created) + (rec.author === S.user.uid ? ", sent by you" : "") }),
          changed ? ui.chip("Changed since your last visit", "stamp") : null),
        el("div", { class: "bar" },
          el("span", { text: stt.text }),
          stt.issue ? ui.statusChip(stt.issue.status) : null,
          stt.issue ? btn("Open the issue", "sent:" + rec.id, () => P.go("issues", { issueId: stt.issue.id }), "linkbtn") : null)));
    });
    b.append(list);
    if (items.length > 8) b.append(el("p", { class: "hint", text: "Showing the newest 8 of " + items.length + "." }));
    return b;
  }

  function todoBlock() {
    const sid = S.studyId;
    if (!sid || !calc.canEditStudy(sid)) return null;
    const st = calc.study(sid);
    if (!st) return null;
    const setup = st.setup || {};
    const items = [];
    if (!Object.keys(setup).length) items.push([T.todoSetup, "Set up your study", "todo:setup"]);
    if (!(st.researcherGoals || []).filter(Boolean).length) items.push([T.todoGoals, "Rank your study's goals", "todo:goals"]);
    if (!items.length) return null;
    const b = block(T.todoHead, "");
    items.forEach(([text, label, key]) => b.append(el("div", { class: "panel" },
      el("p", { text: text }), el("div", { class: "bar" }, btn(label, key, () => P.go("study", {}), "btn ghost")))));
    return b;
  }

  /* ---------- developers and platform: one count line, then the meeting view ---------- */
  function newBlock() {
    const b = block(T.newHead, "");
    const c = S.agg.triageCounts;
    if (!c) { b.append(el("p", { class: "hint", text: S.agg.ready ? "Nothing is waiting." : T.newNotReady })); return b; }
    const waiting = (c.notFixed || 0) + (c.newProblems || 0) + (c.newReports || 0);
    b.append(el("p", { text: waiting
      ? "Open now across all teams: " + calc.triageLine(c) + ". " + plural(c.sessions7 || 0, "session") + " in all in the last 7 days."
      : "Nothing is waiting to be sorted. " + plural(c.sessions7 || 0, "session") + " in the last 7 days." }));
    b.append(el("p", { class: "hint", text: "Study names are never shown here." }));
    return b;
  }

  /* ---------- everyone: since your last visit ---------- */
  function sinceBlock() {
    const b = block(T.sinceHead, "");
    const last = S.user.lastSeen;
    if (!last) { b.append(ui.empty(T.sinceFirst)); return b; }
    const since = time(last);
    const rows = [];
    calc.myIssueIds().forEach(id => {
      const i = calc.issue(id);
      if (!i) return;
      const hist = (i.statusHistory || []).filter(h => time(h.at) > since).sort((x, y) => time(x.at) - time(y.at));
      if (hist.length) {
        rows.push({ issue: i, from: hist[0].from, to: hist[hist.length - 1].to || i.status, at: hist[hist.length - 1].at });
      } else if (time(i.statusChangedAt) > since) {
        rows.push({ issue: i, from: "", to: i.status, at: i.statusChangedAt });
      }
    });
    rows.sort((x, y) => time(y.at) - time(x.at));
    b.append(el("p", { class: "hint", text: "Status changes on problems you reported, troubleshot or marked \"This affects us too\", since " + ui.fmtDate(last) + "." }));
    if (!rows.length) {
      /* Point to "What happened to what you sent" only where that section shows: study roles, in their own study. */
      const role = calc.homeRole();
      const sorted = S.studyId && calc.inStudy(S.studyId) && role !== "dev" && role !== "platform" ? sentItems().filter(it => { const s = sentState(it); return s.at && time(s.at) > since; }).length : 0;
      b.append(ui.empty(T.sinceEmpty + (sorted ? " " + plural(sorted, "item") + " your team sent " + (sorted === 1 ? "was" : "were") + " sorted. See \"" + T.sentHead + "\"." : "")));
      return b;
    }
    const list = el("ul", { class: "clean home-sent" });
    rows.forEach(r => {
      const i = r.issue;
      list.append(el("li", {},
        el("strong", { text: i.title }),
        el("div", { class: "bar" },
          el("span", { class: "hint", text: "Now" }), ui.statusChip(r.to),
          r.from ? el("span", { class: "hint", text: "was" }) : null,
          r.from ? ui.statusChip(r.from) : null,
          el("span", { class: "hint", text: ui.ago(r.at) }),
          btn("Open the issue", "since:" + i.id, () => P.go("issues", { issueId: i.id }), "linkbtn")),
        P.calc.planFor(i).notNow ? el("span", { class: "hint", text: P.calc.planFor(i).notNowLabel + P.calc.planFor(i).notNow }) : null,
        !P.calc.planFor(i).notNow && P.calc.planFor(i).planned ? el("span", { class: "hint", text: "Planned: " + P.calc.planFor(i).planned }) : null));
    });
    b.append(list);
    return b;
  }

  /* ---------- render ---------- */
  function build() {
    const role = calc.homeRole();
    const copy = PAGE_COPY.home;
    const key = copy.stepsByRole[role] ? role : "none";
    const parts = [
      ui.pageHead({ title: copy.title, when: copy.whenByRole[key], steps: copy.stepsByRole[key] }),
      role ? null : el("p", { class: "notice", text: S.user.memberships.length ? T.noRole : T.noStudy }),
      actionsFor(role)
    ];
    if (role === "dev" || role === "platform") {
      parts.push(sinceBlock(), newBlock());
    } else {
      if (role === "lead") parts.push(todoBlock());
      parts.push(sinceBlock());
      if (S.studyId) parts.push(problemsBlock(role), sentBlock());
    }
    return parts;
  }

  P.register({
    id: "home",
    order: 10,
    init() {},
    render(params) {
      const sec = P.section("home");
      /* Home has no typed input, so it rebuilds on every render. Keep keyboard focus on the same control. */
      const act = document.activeElement;
      const key = act && sec.contains(act) && act.dataset ? act.dataset.k : "";
      const headFocused = act && sec.contains(act) && act.tagName === "H2";
      sec.replaceChildren(...build().filter(Boolean));
      if (key) {
        const t = Array.from(sec.querySelectorAll("[data-k]")).find(x => x.dataset.k === key);
        if (t) t.focus({ preventScroll: true });
      } else if (headFocused) {
        const h = sec.querySelector("h2");
        if (h) h.focus({ preventScroll: true });
      }
    }
  });
})();

/* NOTES (home.js; integrated pass 2, 2026-10-28)
   1. PAGE_COPY: every page uses P.ui.pageHead(P.PAGE_COPY.<id>). Core folds the steps into a closed
      "How to use this page" toggle and keeps at most 3.
   2. Developers get one count line and a button to the dev meeting view; admins also get "Sort new problems".
   3. "What happened to what you sent" reads session.triage {state, at} and linkedIssueId/issueId as admin.js
      writes them at triage. Plan and "Not now" lines come from P.calc.planFor (issue fields + proposal lines).
   4. Lead home lists each problem once, with its own "Report this for your study" button. */
