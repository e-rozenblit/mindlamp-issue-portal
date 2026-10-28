/* Set up your study page. Owner: B6. Spec: SPEC.md section 7.5.
   Shows only studies the person belongs to (the database returns no other study's record).
   Study lead and admins edit; other members read. Name and Notion link are set on the Admin page. */
(function () {
  "use strict";
  const P = window.Portal;
  const { C, S, calc, store, ui } = P;
  const el = ui.el;
  /* Info button from core (hover, tap, keyboard); a plain fold until core has it. */
  const info = (content, label) => (P.ui.info ? P.ui.info(content, label) : P.ui.el("details", { class: "more" }, P.ui.el("summary", { text: label || "More" }), content));
  /* Page head: new core takes { title, subtitle }; older core shows "when" as the line under the title. */
  const headOf = (title, subtitle) => ui.pageHead(P.ui.info ? { title, subtitle } : { title, when: subtitle });

  /* Module state. "dirty" holds the panels with unsaved edits (setup, population, name, goals).
     A data refresh rebuilds the page only when no panel has unsaved edits, so saving one panel
     never throws away edits in another. */
  const st = { builtFor: null, builtStamp: "", dirty: new Set(), refs: null };

  function isHttp(u) { return /^https?:\/\/\S+$/i.test(String(u || "").trim()); }

  function membersOf(studyId) {
    return (S.allMemberships || []).filter(m => m.studyId === studyId);
  }

  /* ---------- setup form ---------- */
  function shown(q, values) {
    if (!q.showIf) return true;
    return Object.entries(q.showIf).every(([k, want]) => {
      const v = values[k];
      return Array.isArray(v) ? v.includes(want) : v === want;
    });
  }

  function buildSetup(study, canEdit) {
    const setup = Object.assign({}, study.setup || {});
    const blocks = {};
    const form = el("div", { class: "list" });

    function readValues() {
      const out = {};
      C.SETUP.forEach(q => {
        const b = blocks[q.id];
        if (!b) return;
        if (q.type === "choice") {
          const c = ui.$$("input[type=radio]", b.wrap).find(i => i.checked);
          if (c) out[q.id] = c.value;
        } else if (q.type === "multi") {
          const vals = ui.$$("input[type=checkbox]", b.wrap).filter(i => i.checked).map(i => i.value);
          if (vals.length || Array.isArray(setup[q.id])) out[q.id] = vals;
        } else {
          const t = ui.$("input", b.wrap).value.trim();
          if (t || setup[q.id]) out[q.id] = t;
        }
      });
      return out;
    }
    function applyShowIf() {
      const v = readValues();
      C.SETUP.forEach(q => { if (blocks[q.id]) blocks[q.id].wrap.hidden = !shown(q, v); });
    }

    C.SETUP.forEach(q => {
      const name = "st-" + q.id;
      let wrap;
      if (q.type === "text") {
        const inp = el("input", { type: "text", value: setup[q.id] || "", maxlength: "200", disabled: !canEdit, "aria-describedby": name + "-why" });
        wrap = el("div", { class: "field" }, el("span", {}, el("label", { for: name, text: q.label }), " ",
          q.why ? info(el("span", { id: name + "-why", text: q.why }), "Why we ask") : null), inp);
        inp.id = name;
      } else {
        const multi = q.type === "multi";
        const cur = setup[q.id];
        wrap = el("fieldset", { "aria-describedby": name + "-why" },
          el("legend", {}, q.label, " ", q.why ? info(el("span", { id: name + "-why", text: q.why }), "Why we ask") : null),
          el("div", { class: "opts" }, q.options.map(([v, t]) => el("label", {},
            el("input", { type: multi ? "checkbox" : "radio", name: name, value: v, disabled: !canEdit,
              checked: multi ? (Array.isArray(cur) && cur.includes(v)) : cur === v }), t))));
      }
      blocks[q.id] = { wrap };
      form.append(wrap);
    });
    form.addEventListener("change", () => { st.dirty.add("setup"); applyShowIf(); });
    form.addEventListener("input", () => { st.dirty.add("setup"); });
    applyShowIf();

    /* Keep hidden answers out of the saved setup (for example a wearable list when wearables are unticked). */
    function collect() {
      const v = readValues();
      const out = {};
      C.SETUP.forEach(q => { if (v[q.id] !== undefined && shown(q, v)) out[q.id] = v[q.id]; });
      return out;
    }
    return { el: form, collect };
  }

  /* What the guide hides or skips with the saved setup. Read from the guide content, not guessed. */
  function skipLine(studyId) {
    const g = P.guide();
    const facts = calc.studyFacts(studyId);
    const ctx = Object.assign({ os: "" }, facts);
    const hiddenCards = (g.entries || []).filter(e => e.when && !calc.matchWhen(e.when, ctx)).map(e => e.title);
    const skipped = Object.values(g.nodes || {}).filter(n => n.when && !calc.matchWhen(n.when, ctx)).length;
    const parts = [];
    if (facts.gps === false) parts.push("Your study doesn't collect GPS, so location steps won't show.");
    if (facts.wearable === false) parts.push("Your study doesn't use a wearable or health app, so those steps won't show.");
    if (facts.passiveOnly === true) parts.push("Your study has no activities, so activity steps won't show.");
    if (hiddenCards.length) parts.push("Troubleshoot won't show: " + hiddenCards.join(", ") + ".");
    if (!parts.length && !skipped) parts.push("With your saved answers, every troubleshooting step can show.");
    return parts.join(" ");
  }

  /* ---------- goals ---------- */
  /* One line per goal (page review, approved 10-27), from C.GOAL_DEF in core. */
  function goalDef(g) { return (C.GOAL_DEF || {})[g] || ""; }

  /* Goals that some report answer points to (C.IMPACT_GOALS). Others can't change a ranking yet. */
  function weightedGoals() {
    const s = new Set();
    Object.values(C.IMPACT_GOALS || {}).forEach(m => Object.values(m || {}).forEach(list => (list || []).forEach(g => s.add(g))));
    return s;
  }

  function goalDefs() {
    const wg = weightedGoals();
    return el("details", { class: "sd-defs" },
      el("summary", { text: "What each goal means" }),
      el("ul", { class: "clean" }, C.GOALS.map(g => el("li", {},
        el("b", { text: g + ": " }), goalDef(g),
        wg.has(g) ? null : el("span", { class: "hint", text: " (Doesn't affect rankings yet.)" })))));
  }

  function rankBlock(legend, prefix, current, canEdit) {
    /* Read-only: the chosen goals as lines, not three disabled lists of every goal. */
    if (!canEdit) {
      const chosen = (current || []).filter(Boolean);
      return { el: el("div", {}, el("p", {}, el("b", { text: legend.replace(/, in order.*$/, "") + ": " }),
        chosen.length ? chosen.map((g, i) => (i + 1) + " " + g).join(", ") : "Not ranked yet.")), values: () => chosen };
    }
    const sels = [0, 1, 2].map(i => ui.select([["", "Choose a goal"]].concat(C.GOALS.map(g => [g, g])),
      (current || [])[i] || "", { "aria-label": legend + ", " + ["first", "second", "third"][i], disabled: !canEdit, style: "width:100%;min-width:0" }));
    /* A goal picked in one place can't be picked again in the same ranking. */
    function lockPicked() {
      sels.forEach(s => {
        const others = new Set(sels.filter(o => o !== s).map(o => o.value).filter(Boolean));
        Array.from(s.options).forEach(o => { o.disabled = !!o.value && others.has(o.value); });
      });
    }
    const box = el("fieldset", { style: "min-width:0;max-width:100%" }, el("legend", { text: legend }),
      el("div", { class: "list" }, sels.map((s, i) => el("label", { class: "field" },
        el("span", { class: "hint", text: ["Most important", "Second", "Third"][i] }), s))));
    box.addEventListener("change", () => { st.dirty.add("goals"); lockPicked(); });
    lockPicked();
    return { el: box, values: () => sels.map(s => s.value).filter(Boolean) };
  }

  function hasTallies() { return !!(S.agg && S.agg.ready && (S.agg.goals || []).some(g => (g.top3 || 0) > 0)); }

  function talliesTable() {
    const rows = (S.agg.goals || []).filter(g => (g.top3 || 0) > 0);
    if (!S.agg.ready) return ui.empty("Goal rankings from all studies will show here once the database update has run.");
    if (!rows.length) return ui.empty("Totals show once at least 3 studies have ranked their goals. With fewer, one study's ranking could be worked out.");
    const kinds = [["researcher", "Researchers"], ["participant", "Participants"]];
    return el("div", { class: "list" }, kinds.map(([k, label]) => {
      const list = rows.filter(r => r.kind === k).sort((a, b) => (b.first - a.first) || (b.top3 - a.top3));
      if (!list.length) return null;
      const total = list[0].studies || 0;
      return el("div", { class: "scroll" },
        el("h3", { text: label + (total ? " (" + total + (total === 1 ? " study" : " studies") + " ranked)" : "") }),
        el("table", {}, el("thead", {}, el("tr", {}, ["Goal", "Ranked first", "In top 3"].map(h => el("th", { text: h })))),
          el("tbody", {}, list.map(r => el("tr", {}, el("td", { text: r.goal }),
            el("td", { class: "num", text: String(r.first || 0) }), el("td", { class: "num", text: String(r.top3 || 0) }))))));
    }));
  }

  /* The study's own reports, read-only (members and the platform team can read them; How this works says so). */
  function reportsList(studyId) {
    const reps = (S.reports || []).filter(r => r.studyId === studyId).sort((a, b) => String(b.created).localeCompare(String(a.created)));
    if (!reps.length) return ui.empty("No reports from this study yet.");
    const ans = (r, k) => (typeof calc.answers === "function" ? calc.answers(r, k)
      : (Array.isArray(r[k]) ? r[k] : (r[k] ? [r[k]] : [])));
    const words = (r, k, names) => ans(r, k).map(a => (((C.IMPACT_LABEL || {})[k] || {})[a]) || (names || {})[a] || a).join(", ");
    const row = (label, val) => val ? el("li", {}, el("b", { text: label + ": " }), String(val)) : null;
    return el("div", { class: "list" }, reps.slice(0, 20).map(r => {
      const iid = r.linkedIssueId || r.issueId;
      const title = iid && iid !== "new" ? calc.issueTitle(iid) : "Something new: " + (r.newTitle || "no title");
      return el("details", { class: "sd-report" },
        el("summary", { text: title + ", " + ui.fmtDate(r.created) + (r.author ? " (" + calc.personName(r.author) + ")" : "") }),
        el("ul", { class: "clean" },
          row("What it stopped", words(r, "stops", C.STOPS)),
          row("What it did to the data", words(r, "data", C.DATA)),
          row("Who had to deal with it", words(r, "cost", C.COST)),
          row("Participants affected", r.n),
          row("What helped", r.fix)));
    }), reps.length > 20 ? el("p", { class: "hint", text: "Showing the 20 most recent of " + reps.length + "." }) : null);
  }

  function membersList(studyId) {
    const ms = membersOf(studyId);
    if (!ms.length) return ui.empty("No members listed yet.");
    return el("ul", { class: "clean" }, ms.map(m => el("li", {},
      calc.personName(m.userId) + ": " + (C.ROLE_NAME[m.role] || m.role))));
  }

  /* ---------- page ---------- */
  /* Read-only roles (coordinators, analysts) get a head that doesn't ask them to fill anything in. */
  function head(readOnly) {
    if (readOnly) return headOf("Your study", "Your study lead keeps this current. If something is out of date, tell them.");
    return ui.pageHead(P.PAGE_COPY.study);
  }

  function studyPicker() {
    const ids = calc.myStudies();
    if (ids.length < 2) return null;
    const sel = ui.select(ids.map(id => [id, calc.studyName(id)]), S.studyId, { "aria-label": "Study" });
    sel.addEventListener("change", () => P.setStudy(sel.value));
    return ui.field("Which study", sel);
  }

  async function save(studyId, panel, partial, statusEl, okMsg) {
    statusEl.textContent = "Saving...";
    try {
      await store.patch("studies/" + studyId, partial);
      st.dirty.delete(panel);
      statusEl.textContent = okMsg;
      ui.toast(okMsg);
    } catch (e) { statusEl.textContent = P.writeError(e); }
  }

  function build(sec) {
    const studyId = S.studyId;
    const study = calc.study(studyId);
    st.builtFor = studyId;
    st.builtStamp = study ? String(study.updated || "") : "";
    st.dirty = new Set();

    if (!calc.myStudies().length) {
      const noStudyRole = (S.user.memberships || []).some(m => m.role === "dev" || m.role === "platform");
      sec.replaceChildren(noStudyRole ? headOf("Your study", "") : head(), ui.empty(noStudyRole
        ? "Developers and the platform team aren't part of a study, so there is no setup here."
        : "You aren't in a study yet. Ask the platform team to add you to one."));
      st.refs = null; return;
    }
    if (!study) {
      sec.replaceChildren(...[head(), studyPicker(), ui.empty(S.loaded.studies ? "You can't see this study. Pick one of your studies." : "Loading your study...")].filter(Boolean));
      st.refs = null; return;
    }

    const canEdit = calc.canEditStudy(studyId);
    const canRank = calc.canRankGoals(studyId);

    /* Overview */
    const overview = el("div", { class: "panel" },
      el("h3", { text: study.name || study.id }),
      study.test ? el("p", { class: "notice warn", text: "This is a test study, for trying the portal. Log real participants in your real study." }) : null,
      study.notionLink ? (isHttp(study.notionLink)
        ? el("p", {}, "Notion project: ", el("a", { href: study.notionLink.trim(), target: "_blank", rel: "noopener noreferrer", text: "open the project page" }))
        : el("p", { class: "hint", text: "Notion project: " + study.notionLink })) : null,
      study.setupUpdatedAt ? el("p", { class: "hint", text: "Setup last saved " + ui.ago(study.setupUpdatedAt) + "." }) : null,
      S.user.isAdmin ? el("p", { class: "hint" }, "Change the name or Notion link on the ",
        el("button", { type: "button", class: "linkbtn", text: "Admin page", onclick: () => P.go("admin") }), ".") : null);

    /* Setup */
    const setup = buildSetup(study, canEdit);
    const setupStatus = el("span", { class: "hint", role: "status" });
    const skip = el("p", { class: "hint", text: skipLine(studyId) });
    const setupPanel = el("div", { class: "panel" },
      el("h3", { text: "Study setup" }),
      el("p", { class: "hint", text: canEdit ? "Decides which troubleshooting steps show. All optional; skip anything you don't know." : "Decides which troubleshooting steps show." }),
      canEdit ? el("p", { class: "hint", text: "Not sure? Your coordinator usually knows." }) : null,
      setup.el, skip,
      canEdit ? el("div", { class: "bar" },
        el("button", { type: "button", class: "btn", text: "Save study setup",
          onclick: () => save(studyId, "setup", { setup: setup.collect(), setupUpdatedAt: new Date().toISOString() }, setupStatus, "Study setup saved") }),
        setupStatus) : null);

    /* Population */
    const pop = new Set(study.population || []);
    const popBox = el("fieldset", {}, el("legend", { class: "sr-only", text: "Who takes part" }),
      el("div", { class: "opts" }, C.POPULATION.map(([v, t]) => el("label", {},
        el("input", { type: "checkbox", value: v, checked: pop.has(v), disabled: !canEdit }), t))));
    popBox.addEventListener("change", () => { st.dirty.add("population"); });
    const popStatus = el("span", { class: "hint", role: "status" });
    const popPanel = el("div", { class: "panel" },
      el("h3", { text: "Who takes part (optional)" }),
      el("p", { class: "hint", text: "Doesn't change Troubleshoot. Kept for later research on which problems affect which groups." }),
      popBox,
      canEdit ? el("div", { class: "bar" },
        el("button", { type: "button", class: "btn", text: "Save who takes part",
          onclick: () => save(studyId, "population", { population: ui.$$("input:checked", popBox).map(i => i.value) }, popStatus, "Population tags saved") }),
        popStatus) : null);

    /* Show name to other teams */
    const showBox = el("input", { type: "checkbox", checked: !!study.showName, disabled: !canEdit });
    showBox.addEventListener("change", () => { st.dirty.add("name"); });
    const showStatus = el("span", { class: "hint", role: "status" });
    const showPanel = el("div", { class: "panel" },
      el("h3", { text: "What other teams see" }),
      el("label", { class: "opts" }, el("span", { style: "display:flex;gap:6px;align-items:center" }, showBox, "Show our study's name to other teams")),
      el("p", { class: "hint", text: "Off: other teams see \"a team\". On: they see your study's name next to your workarounds and \"This affects us too\" answers." }),
      el("p", { class: "hint", text: "They never see your sessions, report details, this setup or your goal ranking." }),
      canEdit ? el("div", { class: "bar" },
        el("button", { type: "button", class: "btn", text: "Save name setting",
          onclick: () => save(studyId, "name", { showName: showBox.checked }, showStatus, showBox.checked ? "Other teams will see your study's name" : "Other teams will see \"a team\"") }),
        showStatus) : null);

    /* Goals */
    const rr = rankBlock("Researchers: top 3 goals, in order", "r", study.researcherGoals, canRank);
    const pr = rankBlock("Participants: top 3 goals, in order (optional)", "p", study.participantGoals, canRank);
    const goalStatus = el("span", { class: "hint", role: "status" });
    const goalsPanel = el("div", { class: "panel" },
      el("h3", { text: "Your study's goals" }),
      el("p", {}, "Problems your team reports rank higher at the dev meeting when they threaten your top 3 researcher goals. ",
        info(el("span", {}, "3 points for your first goal, 2 for your second, 1 for your third. ",
          el("button", { type: "button", class: "linkbtn", text: "See how problems are ranked", onclick: () => P.go("dev", { focus: "signal" }) })), "How much")),
      el("p", { class: "hint", text: "Other teams never see your ranking. Participants' goals are optional and don't affect rankings yet." }),
      goalDefs(),
      el("div", { class: "grid2" }, rr.el, pr.el),
      canRank ? el("div", { class: "bar" },
        el("button", { type: "button", class: "btn", text: "Save goal ranking", onclick: () => {
          const r = rr.values(), p = pr.values();
          if (new Set(r).size !== r.length || new Set(p).size !== p.length) { goalStatus.textContent = "Pick each goal only once in a ranking."; return; }
          save(studyId, "goals", { researcherGoals: r, participantGoals: p }, goalStatus, "Goal ranking saved");
        } }), goalStatus)
        : el("p", { class: "hint", text: "Only the study lead ranks the goals." }));

    /* Four panels save separately: say which ones have changes not saved yet (fresh-eyes review). */
    [[setupPanel, setupStatus], [popPanel, popStatus], [showPanel, showStatus], [goalsPanel, goalStatus]].forEach(([panel, status]) => {
      const mark = e => { if (e.target && e.target.matches && e.target.matches("input, select, textarea")) status.textContent = "Not saved yet."; };
      panel.addEventListener("change", mark);
      panel.addEventListener("input", mark);
    });

    /* Members, tallies */
    const membersHost = el("div", {}, membersList(studyId));
    const membersPanel = el("div", { class: "panel" }, el("h3", { text: "People in this study" }),
      el("p", { class: "hint", text: "To add someone or change a role, ask the platform team." }), membersHost);
    const reportsHost = el("div", {}, reportsList(studyId));
    const reportsPanel = el("div", { class: "panel" }, el("h3", { text: "Your study's reports" }),
      el("p", { class: "hint", text: "Only your study and the platform team see these." }), reportsHost);
    const talliesHost = el("div", {}, talliesTable());
    /* Shown only once there are totals: an empty box explaining a privacy threshold helps no one. */
    const talliesPanel = el("div", { class: "panel", hidden: !hasTallies() }, el("h3", { text: "How studies rank goals" }),
      el("p", { class: "hint", text: "Totals across all studies. No study is named." }), talliesHost);

    sec.replaceChildren(...[head(!canEdit), studyPicker(), overview, setupPanel, popPanel, showPanel, goalsPanel, reportsPanel, membersPanel, talliesPanel].filter(Boolean));
    st.refs = { skip, membersHost, talliesHost, talliesPanel, reportsHost };
    st.repSig = (S.reports || []).filter(r => r.studyId === studyId).map(r => r.id + ":" + (r.updated || "")).join("|");
  }

  P.register({
    id: "study",
    order: 50,
    init() {},
    render(params) {
      const sec = P.section("study");
      const study = calc.study(S.studyId);
      const stamp = study ? String(study.updated || "") : "";
      const rebuild = params !== null || !st.refs || st.builtFor !== S.studyId ||
        (!st.dirty.size && stamp !== st.builtStamp);
      if (rebuild) {
        /* On page entry keep typed input if nothing changed underneath it. */
        if (params !== null && st.refs && st.dirty.size && st.builtFor === S.studyId) { refresh(); return; }
        build(sec);
        return;
      }
      refresh();
    }
  });

  function refresh() {
    if (!st.refs) return;
    st.refs.skip.textContent = skipLine(st.builtFor);
    st.refs.membersHost.replaceChildren(membersList(st.builtFor));
    /* Rebuild the reports list only when it changed, so an open report stays open. */
    const repSig = (S.reports || []).filter(r => r.studyId === st.builtFor).map(r => r.id + ":" + (r.updated || "")).join("|");
    if (st.refs.reportsHost && repSig !== st.repSig) { st.repSig = repSig; st.refs.reportsHost.replaceChildren(reportsList(st.builtFor)); }
    st.refs.talliesHost.replaceChildren(talliesTable());
    if (st.refs.talliesPanel) st.refs.talliesPanel.hidden = !hasTallies();
  }
})();

/* PAGE REVIEW PASS 2026-10-27 (issues-study builder): no list of other studies (the picker shows only
   the person's own studies; admins see all); members listed read-only; one-line definition per goal,
   marking goals no report answer points to; the goals panel says the ranking weights issues (D23,
   option A) with a link to the Dev meeting page's formula; a goal can't be picked twice in one ranking;
   a test study says so.

   INTEGRATED (pass 2, 2026-10-28): goal definitions come from C.GOAL_DEF (core). P.go("dev", {focus: "signal"})
   opens and scrolls to the formula. Page-head copy has 3 steps. */
