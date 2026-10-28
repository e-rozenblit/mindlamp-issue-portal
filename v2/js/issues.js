/* Known problems page (Issues), and the shared issue picker. Owner: B4. Spec: SPEC.md 3.7 and 7.4.
   Never name another study here unless the name came back from a portal_* function (S.agg),
   or the study is one the person belongs to. Workaround tiers: team-reported (S.agg.workarounds),
   confirmed by the platform team (issue.confirmedWorkarounds), and steps in the guide (GUIDE_CONTENT). */
(function () {
  "use strict";
  const P = window.Portal;

  /* ---------- small helpers ---------- */
  function ui() { return P.ui; }
  function words(q) { return String(q || "").trim().toLowerCase().split(/\s+/).filter(Boolean); }
  function clip(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n - 1).trimEnd() + "..." : t; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : ""; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }

  /* Issues this person may see. The database already hides security issues from non-admins. */
  function visibleIssues() {
    return (P.S.issues || []).filter(i => i && i.id && (!i.security || P.S.user.isAdmin));
  }

  /* Words to search an issue by: its own words plus the guide entries that lead to it. */
  function searchText(issue) {
    const parts = [issue.title, issue.symptom, (issue.phrases || []).join(" ")];
    P.calc.entryFor(issue.id).forEach(e => parts.push(e.title || "", e.description || "", (e.phrases || []).join(" ")));
    return parts.join(" ").toLowerCase();
  }
  function searchPhrases(issue) {
    const out = (issue.phrases || []).slice();
    P.calc.entryFor(issue.id).forEach(e => { out.push(e.title || ""); (e.phrases || []).forEach(p => out.push(p)); });
    return out.filter(Boolean);
  }

  /* This study's sessions on an issue (readable rows only: own study). */
  function studySessions(studyId, issueId, sinceDays) {
    if (!studyId) return [];
    return P.calc.sessionsFor({ studyId: studyId, issueId: issueId, sinceDays: sinceDays });
  }

  const ROLE_WHO = { lead: "A study lead", rc: "A coordinator", analyst: "A data analyst", dev: "A developer", platform: "Someone on the platform team" };

  /* Team-reported workarounds (tier 1). Uses S.agg when ready; before the migration it falls back to
     rows this person can read (their own studies), credited only to studies they belong to or that opted in. */
  function teamWorkarounds(issue) {
    const w = P.calc.workarounds(issue);
    if (P.S.agg.ready) return w;
    const ck = new Set((w.confirmed || []).map(x => P.calc.norm(x.text)));
    const hidden = new Set((issue.hiddenWorkarounds || []).map(P.calc.norm));
    const notFix = new Set(P.C.NOT_A_FIX);
    const groups = {};
    const add = (rec, text, kind) => {
      const k = P.calc.norm(text);
      if (!k || notFix.has(k) || ck.has(k) || hidden.has(k)) return;
      /* Pilot hygiene: test studies don't count toward what other teams see. */
      const tst = rec.studyId ? P.calc.study(rec.studyId) : null;
      if (tst && tst.test) return;
      const g = groups[k] || (groups[k] = { issueId: issue.id, text: String(text).trim(), key: k, teamSet: new Set(), credited: new Set(), reports: 0, sessions: 0, last: "" });
      const team = P.calc.teamKey(rec);
      if (team) g.teamSet.add(team);
      const st = tst;
      if (st && (st.showName || P.calc.isMember(st.id))) g.credited.add(st.name || st.id);
      g[kind] += 1;
      if (String(rec.created || "") > g.last) g.last = String(rec.created || "");
    };
    (P.S.reports || []).forEach(r => { if (!r.security && (r.linkedIssueId || r.issueId) === issue.id && r.fix) add(r, r.fix, "reports"); });
    (P.S.sessions || []).forEach(s => { if ((s.linkedIssueId || s.issueId) === issue.id && s.helped) add(s, s.helped, "sessions"); });
    w.team = Object.values(groups).map(g => ({ issueId: g.issueId, text: g.text, key: g.key, teams: g.teamSet.size || 1,
      reports: g.reports, sessions: g.sessions, credited: Array.from(g.credited), last: g.last }))
      .sort((a, b) => (b.teams - a.teams) || String(b.last).localeCompare(String(a.last)));
    return w;
  }

  /* Confirmed workarounds store no credit. Who to credit is worked out each time from
     portal_workarounds, which applies each study's current "show our name" setting (P.calc.creditFor).
     Any stored "credit" (prototype era) is ignored. */

  /* ---------- shared issue picker (SPEC 3.7) ---------- */
  P.issuePicker = function (host, opts) {
    opts = opts || {};
    let studyId = typeof opts.studyId === "function" ? opts.studyId() : (opts.studyId || "");
    const getStudy = () => (typeof opts.studyId === "function" ? opts.studyId() : studyId) || "";
    let selected = "";
    const toggle = P.ui.el("input", { type: "checkbox", checked: !!opts.showFixed });
    const picker = P.ui.cardPicker({
      label: opts.label || "What are you seeing?",
      placeholder: opts.placeholder || "Type what you see, for example: logged out",
      last: { id: "new", title: "Something new", description: "It isn't listed here. You'll describe it in a few words." },
      emptyText: "No known issue matches. Try other words, or pick \"Something new\".",
      groups: { mine: "Your study has sessions on these", rest: "Other issues" },
      collapse: { keep: "mine", max: 5, label: "Browse all known problems" },
      onPick: id => { selected = id; if (opts.onPick) opts.onPick(id); }
    });
    const wrap = P.ui.el("div", { class: "issue-picker" },
      picker,
      P.ui.el("label", { class: "hint ip-fixed" }, toggle, " Show fixed issues"));
    function items() {
      const sid = getStudy();
      const rows = visibleIssues()
        .filter(i => toggle.checked || !P.calc.isFixed(i) || i.id === selected)
        .map(i => {
          const mine = sid ? studySessions(sid, i.id, 30).length : 0;
          return { i: i, mine: mine, signal: P.calc.stats(i).signal };
        });
      rows.sort((a, b) => (b.mine - a.mine) || (b.signal - a.signal) || String(a.i.title).localeCompare(String(b.i.title)));
      const anyMine = rows.some(r => r.mine > 0);
      return {
        anyMine: anyMine,
        list: rows.map(r => ({
          id: r.i.id,
          title: r.i.title || r.i.id,
          description: clip(r.i.symptom, 160),
          phrases: searchPhrases(r.i),
          badge: r.mine ? plural(r.mine, "session") + " this month" : (P.calc.isFixed(r.i) ? "Fixed" : ""),
          group: anyMine ? (r.mine ? "mine" : "rest") : ""
        }))
      };
    }
    function refresh() {
      const it = items();
      /* cardPicker takes groups only at creation; group headings are shown with the badge instead. */
      picker.setItems(it.list);
      if (selected) picker.setSelected(selected);
    }
    toggle.addEventListener("change", refresh);
    refresh();
    host.replaceChildren(wrap);
    return {
      el: wrap,
      setSelected(id) {
        selected = id || "";
        const iss = selected && selected !== "new" ? P.calc.issue(selected) : null;
        if (iss && P.calc.isFixed(iss) && !toggle.checked) toggle.checked = true;
        refresh();
        picker.setSelected(selected);
      },
      refresh: refresh,
      setStudy(id) { studyId = id || ""; refresh(); },
      clear() { selected = ""; picker.clear(); refresh(); },
      focusSearch() { picker.focusSearch(); }
    };
  };


  /* ---------- board ---------- */
  const cards = new Map();     // issueId -> {d, sum, info, form, goal, why}
  let built = false;
  let ctl = {};

  /* What each status means, shown next to the status (approved 10-27). One copy in core: C.STATUS_HELP. */
  function statusHelp(status) { return (P.C.STATUS_HELP || {})[status] || ""; }
  function statusChipWithHelp(status) {
    const ch = P.ui.statusChip(status);
    const h = statusHelp(status);
    if (h) ch.title = h;
    return ch;
  }

  /* Starter impact chips. "None" values are left out: "Stops nothing" tells nobody anything. */
  function starterChips(i) {
    const C = P.C;
    return [
      i.stops && i.stops !== "none" ? P.ui.chip(C.STOPS[i.stops] || i.stops, "sev" + (i.stops === "prevented" || i.stops === "dropout" ? " hi" : "")) : null,
      i.data && i.data !== "none" ? P.ui.chip(C.DATA[i.data] || i.data, "sev" + (i.data === "wrong" || i.data === "unknown" ? " hi" : "")) : null,
      i.cost && i.cost !== "nobody" ? P.ui.chip(C.COST[i.cost] || i.cost, "sev") : null
    ].filter(Boolean);
  }

  /* Guide steps and stopgaps by normalized text, so a team workaround that repeats a guide step
     shows once, as the guide step, with how many teams said it helped. */
  let gIndex = null, gFor = null;
  function guideIndex() {
    const g = P.guide();
    if (gIndex && gFor === g) return gIndex;
    const m = new Map();
    const put = (k, v) => { k = P.calc.norm(k); if (k && !m.has(k)) m.set(k, v); };
    Object.entries(g.nodes || {}).forEach(([id, n]) => {
      if (!n || n.kind !== "action") return;
      put(n.text, { nodeId: id, text: n.text });
      if (n.short) put(n.short, { nodeId: id, text: n.text });
    });
    Object.entries(g.stopgaps || {}).forEach(([id, n]) => { if (n && n.text) put(n.text, { stopgapId: id, text: n.text }); });
    gIndex = m; gFor = g;
    return m;
  }

  /* All four workaround tiers for an issue, with guide-step duplicates taken out of the team tier. */
  function workaroundsData(i) {
    const w = teamWorkarounds(i);
    const idx = guideIndex();
    const guide = (w.guide || []).map(x => Object.assign({ teams: 0 }, x));
    const byText = new Map(guide.map(x => [P.calc.norm(x.text), x]));
    const team = [];
    (w.team || []).forEach(x => {
      const hit = idx.get(x.key || P.calc.norm(x.text));
      if (!hit) { team.push(x); return; }
      const k = P.calc.norm(hit.text);
      let gi = byText.get(k);
      if (!gi) { gi = Object.assign({ teams: 0 }, hit); guide.push(gi); byText.set(k, gi); }
      gi.teams = Math.max(gi.teams, x.teams || 1);
    });
    return { confirmed: w.confirmed || [], guide: guide, platform: w.platform || [], team: team };
  }
  function hasWorkaround(wd) { return !!(wd.confirmed.length || wd.guide.length || wd.platform.length || wd.team.length); }

  /* Public plan lines for an issue. The issue's own fields first (set on the Dev meeting
     page), then S.agg.plans: public lines from proposals (portal_proposal_lines), which other
     teams can't read directly (D23). */
  function planLines(i) {
    const out = { planned: [], notNow: [], ideaNotNow: [] };
    const addU = (arr, t) => { t = String(t || "").trim(); if (t && !arr.some(x => P.calc.norm(x) === P.calc.norm(t))) arr.push(t); };
    if (i.planned) addU(out.planned, i.planned);
    if (i.status === "not-now") addU(out.notNow, i.notNowReason || i.statusNote);
    const settled = i.status === "fixed" || i.status === "in-progress";
    (P.S.agg.plans || []).filter(p => p && p.issueId === i.id).forEach(p => {
      addU(out.planned, p.planned);
      /* A set-aside idea stops showing once the issue is being fixed or is fixed (same rule as calc.planFor). */
      if (settled) return;
      /* A proposal's Not now reason on an issue that is itself Not now explains the status; otherwise one idea was set aside. */
      if (!out.notNow.some(x => P.calc.norm(x) === P.calc.norm(p.notNowReason))) addU(i.status === "not-now" ? out.notNow : out.ideaNotNow, p.notNowReason);
    });
    return out;
  }

  function buildPage(sec) {
    const { el, select, pageHead } = P.ui;
    const C = P.C;
    ctl.area = select([["", "All areas"]].concat(Object.entries(C.AREAS)), "", { "aria-label": "Area" });
    ctl.sort = select([["teams", "Most teams"], ["sessions", "Most sessions"],
      ["boosts", "Most \"affects us too\""], ["recent", "Recently active"]], "teams", { "aria-label": "Sort" });
    ctl.q = el("input", { type: "search", placeholder: "Search, for example: logged out", "aria-label": "Search issues", autocomplete: "off" });
    ctl.fixed = el("input", { type: "checkbox" });
    ctl.count = el("p", { class: "hint", role: "status" });
    ctl.list = el("div", { class: "list", id: "issue-list" });
    [ctl.area, ctl.sort, ctl.fixed].forEach(c => c.addEventListener("change", refreshList));
    ctl.q.addEventListener("input", refreshList);
    sec.replaceChildren(
      pageHead(P.PAGE_COPY.issues),
      el("div", { class: "notice ib-ways" },
        el("p", { text: "Two ways to tell the platform team a problem matters to your study:" }),
        el("ul", { class: "clean" },
          el("li", {}, el("b", { text: "This affects us too: " }), "one tap, with a reason if you like."),
          el("li", {}, el("b", { text: "A report: " }), "a detailed account. How many participants, what it stopped, what fixed it."))),
      el("div", { class: "bar ib-filters" },
        el("label", { class: "ib-q" }, ctl.q),
        el("label", {}, "Area", ctl.area),
        el("label", {}, "Sort", ctl.sort),
        el("label", {}, ctl.fixed, "Show fixed issues")),
      ctl.count,
      ctl.list);
  }

  function matchesFilters(i) {
    const area = ctl.area.value, ws = words(ctl.q.value);
    if (area && i.area !== area) return false;
    if (!ctl.fixed.checked && P.calc.isFixed(i)) return false;
    if (ws.length) { const hay = searchText(i); if (!ws.every(w => hay.includes(w))) return false; }
    return true;
  }

  function refreshList() {
    if (!built) return;
    const { empty } = P.ui;
    if (!P.S.loaded.issues) { ctl.list.replaceChildren(empty("Loading issues...")); ctl.count.textContent = ""; return; }
    const all = visibleIssues();
    if (!all.length) { ctl.list.replaceChildren(empty("No issues yet. Use Report to add the first one.")); ctl.count.textContent = ""; return; }
    const sort = ctl.sort.value;
    const byTitle = (a, b) => String(a.i.title || "").localeCompare(String(b.i.title || ""));
    const rows = all.filter(matchesFilters).map(i => ({ i: i, s: P.calc.stats(i) }));
    /* No priority-signal sort here: that ranking belongs to the Dev meeting view. */
    rows.sort((a, b) => {
      if (sort === "sessions") return (b.s.sessions - a.s.sessions) || (b.s.teams - a.s.teams) || byTitle(a, b);
      if (sort === "boosts") return (b.s.boosts - a.s.boosts) || (b.s.teams - a.s.teams) || byTitle(a, b);
      if (sort === "recent") return String(b.s.last || "").localeCompare(String(a.s.last || "")) || byTitle(a, b);
      return (b.s.teams - a.s.teams) || (b.s.sessions - a.s.sessions) || byTitle(a, b);
    });
    const hiddenFixed = ctl.fixed.checked ? 0 : all.filter(i => P.calc.isFixed(i)).length;
    ctl.count.textContent = plural(rows.length, "issue") + " shown." + (hiddenFixed ? " " + plural(hiddenFixed, "fixed issue") + " hidden." : "");
    if (!rows.length) {
      if (ctl.list.querySelector(".empty") === null || ctl.list.children.length !== 1) {
        ctl.list.replaceChildren(empty("No issues match. Try other words, or turn on Show fixed issues."));
      }
      return;
    }
    /* Drop the empty message and cards no longer shown, then place cards in order without
       moving ones already in place (keeps focus and typed text). */
    const want = rows.map(r => cardFor(r.i, r.s));
    const keep = new Set(want);
    Array.from(ctl.list.children).forEach(c => { if (!keep.has(c)) c.remove(); });
    want.forEach((c, ix) => { if (ctl.list.children[ix] !== c) ctl.list.insertBefore(c, ctl.list.children[ix] || null); });
    for (const [id] of cards) { if (!all.some(i => i.id === id)) cards.delete(id); }
  }

  function cardFor(i, s) {
    const { el } = P.ui;
    let c = cards.get(i.id);
    if (!c) {
      c = { sum: el("summary", {}), info: el("div", { class: "ib-info" }), form: el("div", { class: "ib-form" }) };
      c.d = el("details", { class: "issue", "data-id": i.id }, c.sum, el("div", { class: "body" }, c.info, c.form));
      c.d.addEventListener("toggle", () => { if (c.d.open) { fillInfo(c, P.calc.issue(i.id) || i); fillForm(c, P.calc.issue(i.id) || i); } });
      cards.set(i.id, c);
    }
    fillSummary(c, i, s);
    if (c.d.open) {
      if (!c.info.contains(document.activeElement)) fillInfo(c, i);   /* keeps a half-typed caution */
      fillForm(c, i);
    }
    return c.d;
  }

  function mySessions30(issueId) {
    const sid = P.S.studyId;
    return sid && P.calc.isMember(sid) ? studySessions(sid, issueId, 30).length : 0;
  }

  /* Collapsed row: title, status, whether something helps, how many teams, your study's sessions. */
  function fillSummary(c, i, s) {
    const { el, chip } = P.ui;
    const wa = hasWorkaround(workaroundsData(i));
    const mine = mySessions30(i.id);
    const st = P.C.STATUS[i.status] || i.status || "";
    c.sum.setAttribute("aria-label", [i.title || i.id, st ? "Status: " + st : "", wa ? "Workaround available" : "No workaround yet",
      s.teams ? "Reported by " + plural(s.teams, "team") : "No team reports yet", mine ? "Your study: " + plural(mine, "session") + " this month" : ""].filter(Boolean).join(". ") + ".");
    c.sum.replaceChildren(
      el("h3", { text: i.title || i.id }),
      s.teams ? el("div", { class: "side", title: "Teams that reported it, including platform team records" }, el("b", { text: String(s.teams) }), s.teams === 1 ? "team" : "teams")
        : el("div", { class: "side", text: "No team reports yet" }),
      el("div", { class: "meta" },
        statusChipWithHelp(i.status),
        i.status === "workaround" ? null : wa ? chip("Workaround available", "stamp") : chip("No workaround yet", "unconfirmed"),
        i.confirmed ? chip("Confirmed by the platform team", "stamp") : null,
        i.security ? chip("Security: admins only", "sev hi") : null,
        mine ? chip("Your study: " + plural(mine, "session") + " this month") : null));
  }

  function section(title, ...kids) {
    return P.ui.el("div", { class: "ib-sec" }, P.ui.el("div", { class: "k", text: title }), kids);
  }

  /* Severity comes from teams' reports (D23). The starter rating shows only until a report exists. */
  function impactSection(i, s) {
    const { el } = P.ui;
    if (s.sevN) {
      const w = P.calc.sevWords(i, s);
      return section("How much it gets in the way",
        el("p", { text: w.words || "Teams rated its impact." }),
        el("p", { class: "hint", text: w.source + " The Dev meeting page shows the score and how it is worked out." }));
    }
    const chips = starterChips(i);
    return section("How much it gets in the way",
      chips.length ? el("div", { class: "meta" }, chips) : el("p", { text: "No effect rated yet." }),
      el("p", { class: "hint", text: "Starter estimate from the platform team. No team reports yet. Teams' reports replace it." }));
  }

  function fillInfo(c, i) {
    const { el, chip, toast, fmtDate } = P.ui;
    const s = P.calc.stats(i);
    const isAdmin = P.S.user.isAdmin;
    const out = [];
    if (i.security && isAdmin) out.push(el("div", { class: "caution", text: "Security issue. Only admins see it. Keep it out of public places." }));

    /* 1. What helps: first, because it pays off even when nothing gets fixed (D1, D2). */
    out.push(workaroundsBlock(i));

    /* 2. Status, its meaning, and the public plan lines */
    const help = statusHelp(i.status);
    const plans = planLines(i);
    /* Working spec links are for developers and the platform team until the platform team decides (SPEC 10, item 24). */
    const spec = P.calc.canSeeProposals() ? safeUrl(i.specUrl) : "";
    out.push(section("Status",
      el("div", { class: "ladder" }, statusChipWithHelp(i.status), help ? " " + help : "",
        i.confirmed ? [" ", chip("Confirmed by the platform team", "stamp")] : null),
      plans.notNow.map(t => el("p", {}, el("b", { text: "Why not now: " }), t)),
      plans.ideaNotNow.map(t => el("p", {}, el("b", { text: "One idea for this was set aside: " }), t)),
      i.status !== "not-now" && i.statusNote ? el("p", { text: i.statusNote }) : null,
      plans.planned.map(t => el("p", {}, el("b", { text: "What's planned: " }), t)),
      i.provisional ? el("p", { class: "hint", text: "Details may change as the platform team checks them." }) : null,
      spec ? el("p", {}, el("a", { href: spec, target: "_blank", rel: "noopener", text: "Open the working spec" })) : null));

    /* 3. What people see, how much it gets in the way, how common, how we know */
    if (i.symptom) out.push(section("What people see", el("p", { text: i.symptom })));
    out.push(impactSection(i, s));
    const mine30 = mySessions30(i.id);
    const lines = [
      s.teams ? "Reported by " + plural(s.teams, "team") + "." : "No team reports yet.",
      s.sessions ? plural(s.sessions30 || 0, "troubleshooting session") + " in the last 30 days, " + s.sessions + " in all." : "No troubleshooting sessions logged yet.",
      s.reports ? plural(s.recent || 0, "report") + " in the last 30 days, " + s.reports + " in all." : null,
      s.boosts ? plural(s.boosts, "person", "people") + " said it affects them too." : null,
      mine30 ? "Your study: " + plural(mine30, "session") + " in the last 30 days." : null,
      s.last ? "Last activity: " + fmtDate(s.last) + "." : null
    ].filter(Boolean);
    out.push(section("How common it is", el("ul", { class: "clean" }, lines.map(t => el("li", { text: t })))));
    /* Evidence text can quote one study's counts. Until the source-neutral rewording is approved
       (UX item 1, change 5), only developers, the platform team and admins see it. */
    if (i.evidence && P.calc.canSeeProposals()) out.push(section("How we know", el("p", { class: "hint", text: "Shown to developers and the platform team only." }), el("p", { text: i.evidence })));

    /* 4. Why others said it affects them too */
    const bs = P.calc.boostsFor(i.id);
    if (bs.length) {
      out.push(section("Why others said it affects them too", el("div", { class: "boosts" }, bs.map(b => el("div", { class: "boost" },
        el("b", { text: (ROLE_WHO[b.role] || "Someone") + (b.studyName ? " at " + b.studyName : "") + (b.mine ? " (you)" : "") }),
        b.goal ? ": threatens " + b.goal + "." : ".",
        b.why ? " " + b.why : "")))));
    }

    /* Admin stamp */
    if (isAdmin) {
      const cb = el("button", { class: "btn ghost", type: "button", text: i.confirmed ? "Remove confirmed stamp" : "Mark confirmed" });
      cb.addEventListener("click", async () => {
        cb.disabled = true;
        try { await P.store.patch("issues/" + i.id, { confirmed: !i.confirmed }); toast(i.confirmed ? "Stamp removed" : "Marked confirmed"); }
        catch (e) { toast(P.writeError(e)); }
        cb.disabled = false;
      });
      out.push(el("div", { class: "bar" }, el("span", { class: "hint", text: "Admin:" }), cb,
        el("span", { class: "hint", text: "Change the status on the Dev meeting page." })));
    }
    c.info.replaceChildren(...out);
  }

  function workaroundsBlock(i) {
    const { el, chip, toast } = P.ui;
    const isAdmin = P.S.user.isAdmin;
    const w = workaroundsData(i);
    const items = [];

    w.confirmed.forEach(x => {
      const li = el("li", { class: "wa" },
        el("div", {}, x.text, " ", chip("Confirmed by the platform team", "stamp")),
        el("div", { class: "credit", text: "From " + P.calc.creditFor(i.id, x.text) + "." }),
        x.caution ? el("div", { class: "caution", text: x.caution }) : null);
      if (isAdmin) {
        const rm = el("button", { class: "mini", type: "button", text: "Remove confirmation" });
        rm.addEventListener("click", async () => {
          rm.disabled = true;
          const k = P.calc.norm(x.text);
          try {
            await P.store.patch("issues/" + i.id, { confirmedWorkarounds: (i.confirmedWorkarounds || []).filter(y => P.calc.norm(y.text) !== k) });
            toast("Confirmation removed");
          } catch (e) { toast(P.writeError(e)); rm.disabled = false; }
        });
        li.append(el("div", { class: "bar" }, rm));
      }
      items.push(li);
    });

    const entry = P.calc.entryFor(i.id)[0];
    w.guide.forEach(x => {
      const open = entry ? el("button", { class: "mini", type: "button", text: "Open the guide" }) : null;
      if (open) open.addEventListener("click", () => P.go("guide", { entryId: entry.id }));
      items.push(el("li", { class: "wa" },
        el("div", {}, x.text, " ", chip("Step in the guide", "stamp")),
        el("div", { class: "credit", text: "This is a step in the troubleshooting guide." + (x.teams ? " " + plural(x.teams, "team") + " said it helped." : "") }),
        open ? el("div", { class: "bar" }, open) : null));
    });

    w.platform.forEach(x => {
      items.push(el("li", { class: "wa" }, el("div", { text: x.text }), el("div", { class: "credit", text: "From platform team records." })));
    });

    w.team.forEach(x => {
      const from = (x.credited && x.credited.length) ? x.credited.join(", ") + ((x.teams || 0) > x.credited.length ? " and other teams" : "") : "a team";
      const li = el("li", { class: "wa" },
        el("div", {}, x.text, " ", chip("Not confirmed yet", "unconfirmed")),
        el("div", { class: "credit", text: "From " + from + ". Used by " + plural(x.teams || 1, "team") + "." }));
      if (isAdmin) li.append(adminConfirm(i, x));
      items.push(li);
    });

    const kids = [el("p", { class: "hint", text: "What teams found. Use it if it fits your study." })];
    if (i.harmful) kids.push(el("div", { class: "caution", text: "Some of these have a cost. Read them before you use them." }));
    kids.push(items.length ? el("ul", { class: "clean walist" }, items)
      : el("p", { class: "hint", text: "None known yet. If something helped, add it when you report this issue." }));
    return section("What helps", ...kids);
  }

  function adminConfirm(i, x) {
    const { el, toast } = P.ui;
    const caution = el("input", { type: "text", maxlength: "200", placeholder: "Caution, if it has a cost (optional)", "aria-label": "Caution (optional)" });
    const ok = el("button", { class: "mini", type: "button", text: "Confirm" });
    const hide = el("button", { class: "mini", type: "button", text: "Hide" });
    ok.addEventListener("click", async () => {
      ok.disabled = true;
      const entry = { text: x.text, key: x.key || P.calc.norm(x.text), at: new Date().toISOString(), by: P.S.user.uid };
      const cv = caution.value.trim();
      if (cv) entry.caution = cv;
      try {
        await P.store.patch("issues/" + i.id, { confirmedWorkarounds: (i.confirmedWorkarounds || []).concat([entry]) });
        toast("Workaround confirmed");
      } catch (e) { toast(P.writeError(e)); ok.disabled = false; }
    });
    hide.addEventListener("click", async () => {
      if (!window.confirm("Hide this workaround from everyone? You can't undo this here.")) return;
      hide.disabled = true;
      try {
        await P.store.patch("issues/" + i.id, { hiddenWorkarounds: (i.hiddenWorkarounds || []).concat([P.calc.hideKey(x)]) });
        toast("Workaround hidden");
      } catch (e) { toast(P.writeError(e)); hide.disabled = false; }
    });
    return el("div", { class: "bar ib-admin" }, el("span", { class: "hint", text: "Admin:" }), caution, ok, hide);
  }

  /* The study's top goal, to pre-fill "This affects us too" (one tap). Empty if not ranked or not readable. */
  function topGoal(studyId) {
    const st = studyId ? P.calc.study(studyId) : null;
    const g = st && Array.isArray(st.researcherGoals) ? st.researcherGoals.filter(Boolean)[0] : "";
    return g && P.C.GOALS.includes(g) ? g : "";
  }

  /* "This affects us too" (stored as a boost) and the report link. Built once per card; values refresh
     only when the person isn't typing. One tap saves it; the goal (pre-filled) and reason are optional. */
  function fillForm(c, i) {
    const { el, select, toast } = P.ui;
    const sid = P.calc.inStudy(P.S.studyId) ? P.S.studyId : "";
    const mine = P.calc.myBoost(i.id, sid);
    if (!c.goal) {
      c.goal = select([["", "Study goal it threatens (optional)"]].concat(P.C.GOALS.map(g => [g, g])), "", { "aria-label": "Study goal it threatens (optional)" });
      c.why = el("input", { type: "text", maxlength: "300", placeholder: "Why it matters to your study (optional)", "aria-label": "Why it matters to your study (optional)" });
      c.who = el("p", { class: "hint" });
      c.state = el("p", {});
      c.save = el("button", { class: "btn", type: "button" });
      c.del = el("button", { class: "btn ghost", type: "button", text: "Take back \"This affects us too\"" });
      c.rep = el("button", { class: "btn ghost", type: "button", text: "Write a detailed report" });
      c.status = el("span", { class: "hint", role: "status" });
      c.dirty = false;
      [c.goal, c.why].forEach(x => x.addEventListener("input", () => { c.dirty = true; }));
      c.goal.addEventListener("change", () => { c.dirty = true; });
      c.save.addEventListener("click", async () => {
        const id = P.calc.inStudy(P.S.studyId) ? P.S.studyId : "";
        c.save.disabled = true; c.status.textContent = "";
        try {
          await P.store.put("boosts/" + P.calc.boostId(i.id, id), { issueId: i.id, goal: c.goal.value, why: c.why.value.trim(), studyId: id });
          c.dirty = false; toast("Saved: this affects your study too");
        } catch (e) { c.status.textContent = P.writeError(e); }
        c.save.disabled = false;
      });
      c.del.addEventListener("click", async () => {
        const id = P.calc.inStudy(P.S.studyId) ? P.S.studyId : "";
        c.del.disabled = true;
        try { await P.store.remove("boosts/" + P.calc.boostId(i.id, id)); c.dirty = false; c.goal.value = topGoal(id); c.why.value = ""; toast("Taken back"); }
        catch (e) { c.status.textContent = P.writeError(e); }
        c.del.disabled = false;
      });
      c.rep.addEventListener("click", () => P.go("report", { issueId: i.id }));
      c.form.replaceChildren(
        section("Does this affect your study?",
          c.state,
          el("div", { class: "bar ib-boost" }, c.why, c.goal),
          el("p", { class: "hint", text: P.C.PRIVACY_HINT + " " + P.C.PUBLIC_HINT }),
          el("div", { class: "bar" }, c.save, c.del, c.rep, c.status),
          c.who));
    }
    c.state.textContent = mine ? "Your study said this affects you too." : "";
    c.state.hidden = !mine;
    /* Pilot hygiene: an admin outside the picked study is trying things out. Like a test troubleshooting
       run, it isn't saved, so it can't change any count. */
    const adminTest = P.S.user.isAdmin && !sid;
    c.who.textContent = adminTest
      ? "You aren't a member of the study picked at the top, so this would be a test. It isn't saved and doesn't count."
      : sid
        ? "This counts for " + P.calc.studyName(sid) + ". Other teams see your role, the goal and your reason, never your name."
        : "You aren't in a study, so this counts as your own, not a study's. Other teams see it in the count, with your role, the goal and your reason, never your name.";
    c.save.textContent = mine ? "Save changes" : "This affects us too";
    c.save.hidden = adminTest && !mine;
    c.del.hidden = !mine;
    const typing = c.form.contains(document.activeElement);
    if (!c.dirty && !typing) {
      c.goal.value = mine ? (mine.goal || "") : topGoal(sid);
      c.why.value = mine ? (mine.why || "") : "";
    }
  }


  P.register({
    id: "issues",
    order: 40,
    init() {},
    render(params) {
      const sec = P.section("issues");
      if (!built) { buildPage(sec); built = true; }
      if (params && params.issueId) {
        /* Clear leftover filters so the issue is in the list (search or area could hide it). */
        ctl.q.value = ""; ctl.area.value = "";
      }
      refreshList();
      if (params && params.issueId) {
        const iss = P.calc.issue(params.issueId);
        if (iss && P.calc.isFixed(iss) && !ctl.fixed.checked) { ctl.fixed.checked = true; refreshList(); }
        const card = cards.get(params.issueId);
        if (card && iss) {
          card.d.open = true;
          fillInfo(card, iss); fillForm(card, iss);
          try { card.d.scrollIntoView({ block: "start" }); } catch (e) { /* ignore */ }
        }
      }
    }
  });
})();

/* INTEGRATED 2026-10-27: styles in css/issues.css. The picker passes group headings ("Your study has
   sessions on these", "Other issues") to cardPicker at creation. Removing a boost is a soft delete in
   core (store.remove marks it removed). Page head from P.PAGE_COPY.issues.
   P.issuePicker returns the 3.7 signature {el, setSelected, refresh} plus setStudy(id), clear() and
   focusSearch(). opts.studyId may be a string or a function. Confirmed workarounds store no credit;
   P.calc.creditFor works it out on display.

   PAGE REVIEW PASS 2026-10-27 (approved page-review items + UX audit):
   - Each card opens with "What helps", then status with its meaning, what's planned and any Not now reason.
   - Collapsed row: status, "Workaround available" / "No workaround yet", teams, your study's sessions.
     Impact chips moved inside the card; "none" values dropped.
   - Severity inside the card: from teams' reports ("based on N reports"), else the starter estimate.
     Goal weight is never shown here (it would reveal study goals, D22); it is on the Dev meeting page.
   - "Boost" is now "This affects us too": one tap, goal pre-filled from the study's top goal, reason optional.
     Stored as a boost, as before. The page explains it next to "a report" once, under the head.
   - Priority-signal sort and the Role filter removed. Sorts: most teams (default), sessions,
     "affects us too", recently active.
   - Team workarounds that repeat a guide step (same words as an action step or stopgap) show once, as the
     guide step, with "N teams said it helped".
   - Fallback before the migration leaves test studies out of team workaround counts.

   INTEGRATED (pass 2, 2026-10-28): status meanings come from C.STATUS_HELP (core). Public plan lines from
   proposals arrive as S.agg.plans (core loads portal_proposal_lines). */
