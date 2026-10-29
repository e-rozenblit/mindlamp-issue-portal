/* Run the portal page. Owner: B6. Spec: SPEC.md section 7.6. Admins only (adminOnly: true).
   Studies, people and their per-study roles, triage of new problems, workaround confirmations.
   Admins read every study's records, so study names show here. This page never shows to anyone else. */
(function () {
  "use strict";
  const P = window.Portal;
  const { C, S, calc, store, ui } = P;
  /* Labels for the guide's "What changed just before it started?" answer (guide.js CHANGED). */
  const CHANGED_NAME = { update: "The app or phone updated", staff: "Staff changed something in the dashboard",
    move: "New phone, travel, or a new network", none: "Nothing, or not sure" };
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  const el = ui.el;

  const TYPES = [["bug", "Bug"], ["limitation", "Limitation"], ["feature", "Missing feature"], ["docs", "Documentation"]];
  const st = { built: false, hosts: null, people: null, peopleErr: "", peopleSig: "", showUnlinked: false, peopleFilter: "" };

  /* ---------- helpers ---------- */
  function slug(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  }
  function isHttp(u) { return /^https?:\/\/\S+$/i.test(String(u || "").trim()); }
  /* A report's answers to one question as a list (D24: impact answers may be arrays). */
  function answersOf(rep, key) {
    if (typeof calc.answers === "function") return calc.answers(rep, key);
    const v = rep ? rep[key] : null;
    return Array.isArray(v) ? v.filter(Boolean) : (v === null || v === undefined || v === "" ? [] : [v]);
  }
  /* The most severe answer on a points scale, for the new issue's single starter rating. */
  function topAnswer(rep, key, pts) {
    return answersOf(rep, key).filter(a => Object.prototype.hasOwnProperty.call(pts, a)).sort((a, b) => pts[b] - pts[a])[0] || "";
  }
  function nowStamp() { return { at: new Date().toISOString(), by: S.user.uid }; }
  function entryTitle(entryId) {
    const e = (P.guide().entries || []).find(x => x.id === entryId);
    return e ? e.title : (entryId || "");
  }
  /* A team, confirmed or platform workaround's text from its key (the normalized text). */
  function teamText(key) {
    const row = (S.agg.workarounds || []).find(w => w.key === key);
    if (row && row.text) return row.text;
    for (const i of S.issues) {
      const hit = (i.workarounds || []).concat((i.confirmedWorkarounds || []).map(w => w.text)).find(t => calc.norm(t) === key);
      if (hit) return hit;
    }
    return String(key);
  }
  /* Picked suggestions ({kind, id}) in words, then the person's own words. */
  function helpedText(own, picks) {
    const g = P.guide();
    const words = (Array.isArray(picks) ? picks : []).filter(p => p && p.id).map(p =>
      p.kind === "step" ? nodeLabel(p.id) : p.kind === "stopgap" ? (((g.stopgaps || {})[p.id] || {}).text || p.id) : teamText(p.id));
    const t = String(own || "").trim();
    if (t && !words.some(w => calc.norm(w) === calc.norm(t))) words.push(t);
    return Array.from(new Set(words)).join("; ");
  }
  function nodeLabel(id) {
    const n = (P.guide().nodes || {})[id];
    return n ? (n.short || n.text || id) : id;
  }
  function triageState(rec) { return (rec.triage && rec.triage.state) || "new"; }
  /* A session's outcome after any follow-up (core helper; plain outcome until core has it). */
  const outcomeOf = s => (calc.effectiveOutcome ? calc.effectiveOutcome(s) : s.outcome);
  /* An issue's short name (D24), from its id. */
  function issueLabel(id) {
    if (id === "new") return "Something new";
    const i = calc.issue(id);
    return i && ui.issueName ? ui.issueName(i).title : calc.issueTitle(id);
  }
  /* Pilot hygiene (03-migration 6b): why a record is left out of the counts, or "". */
  function notCounted(rec) {
    if (rec.outsideStudy) return "Admin test run, not counted";
    const s = rec.studyId ? calc.study(rec.studyId) : null;
    return s && s.test ? "Test study, not counted" : "";
  }
  function lastMonday() {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function missingFn(e) { return !!e && (e.code === "PGRST202" || /does not exist|could not find the function/i.test(e.message || "")); }
  function studyLabel(id) {
    if (!id) return "No study";
    if (id === "*") return "No single study";
    const s = calc.study(id);
    return s ? (s.name || s.id) : id;
  }
  function studyOptions(includeStar) {
    const list = S.studies.slice().sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
      .map(s => [s.id, s.name || s.id]);
    return includeStar ? [["*", "No single study (for example a developer)"]].concat(list) : list;
  }
  function roleOptions() { return C.ROLES.map(r => [r.id, r.name]); }
  function statusLine() { return el("span", { class: "hint", role: "status" }); }
  /* replaceChildren that skips null and false (they would print as text). */
  function put(node, ...kids) { node.replaceChildren(...kids.flat().filter(k => k !== null && k !== undefined && k !== false)); return node; }

  /* Reuse rendered rows by key so open forms and typed input survive data refreshes.
     A row is rebuilt only when its data signature changed and it has no open form (data-busy). */
  function keyed(host, items, keyFn, sigFn, make, emptyText) {
    host._cache = host._cache || new Map();
    const next = new Map();
    const els = items.map(it => {
      const k = keyFn(it), sig = sigFn(it);
      const old = host._cache.get(k);
      let node;
      if (old && (old.sig === sig || old.node.dataset.busy)) node = old.node;
      else node = make(it);
      next.set(k, { node, sig: old && old.node === node ? old.sig : sig });
      return node;
    });
    host._cache = next;
    if (!els.length) {
      if (!host._empty) { host.replaceChildren(ui.empty(emptyText)); host._empty = true; }
      return;
    }
    host._empty = false;
    const cur = Array.from(host.children);
    if (cur.length !== els.length || cur.some((c, i) => c !== els[i])) host.replaceChildren(...els);
  }

  /* ---------- 1. Studies ---------- */
  function studyCounts(id) {
    return {
      members: (S.allMemberships || []).filter(m => m.studyId === id).length,
      sessions: S.sessions.filter(x => x.studyId === id).length,
      notApp: S.sessions.filter(x => x.studyId === id && outcomeOf(x) === "not_app").length,
      reports: S.reports.filter(x => x.studyId === id).length
    };
  }

  function studyRow(s) {
    const n = studyCounts(s.id);
    const row = el("div", { class: "panel" });
    const status = statusLine();
    function view() {
      delete row.dataset.busy;
      put(row, 
        el("div", { class: "bar" },
          el("h3", { text: s.name || s.id }),
          s.test ? ui.chip("Test study") : null,
          s.showName ? ui.chip("Shows its name") : ui.chip("Shows as \"a team\"", "unconfirmed")),
        el("p", { class: "hint", text: "Id: " + s.id + ". Members: " + n.members + ". Sessions: " + n.sessions +
          (n.notApp ? " (" + n.notApp + " not an app problem)" : "") + ". Reports: " + n.reports + "." }),
        s.test ? el("p", { class: "hint", text: "Test study: its sessions, reports and \"This affects us too\" answers are left out of every count other teams see. Its members still see them." }) : null,
        s.notionLink ? (isHttp(s.notionLink)
          ? el("p", {}, el("a", { href: s.notionLink.trim(), target: "_blank", rel: "noopener noreferrer", text: "Notion project page" }))
          : el("p", { class: "hint", text: "Notion project: " + s.notionLink })) : null,
        el("div", { class: "bar" },
          el("button", { type: "button", class: "btn ghost", text: "Edit name or link", onclick: edit }),
          el("button", { type: "button", class: "btn ghost", text: s.test ? "Count this study again" : "Mark as a test study", onclick: toggleTest }),
          el("button", { type: "button", class: "btn ghost", text: "Open study setup", onclick: () => { P.setStudy(s.id); P.go("study"); } }),
          el("button", { type: "button", class: "btn ghost", text: "Delete study", onclick: askDelete }),
          status));
    }
    function edit() {
      row.dataset.busy = "1";
      const name = el("input", { type: "text", value: s.name || "", maxlength: "80" });
      const link = el("input", { type: "url", value: s.notionLink || "", maxlength: "300", placeholder: "https://" });
      const msg = statusLine();
      put(row, 
        el("h3", { text: "Edit " + (s.name || s.id) }),
        el("div", { class: "grid2" }, ui.field("Study name", name, "Members see this name. Other teams see it only if the study chooses to show it."),
          ui.field("Notion project link (optional)", link, "A link only. Nothing syncs from Notion.")),
        el("div", { class: "bar" },
          el("button", { type: "button", class: "btn", text: "Save changes", onclick: async () => {
            const nm = name.value.trim(), ln = link.value.trim();
            if (!nm) { msg.textContent = "Add a study name."; return; }
            if (ln && !isHttp(ln)) { msg.textContent = "The link must start with https://"; return; }
            msg.textContent = "Saving...";
            try { await store.patch("studies/" + s.id, { name: nm, notionLink: ln }); ui.toast("Study saved"); view(); }
            catch (e) { msg.textContent = P.writeError(e); }
          } }),
          el("button", { type: "button", class: "btn ghost", text: "Cancel", onclick: view }), msg));
      name.focus();
    }
    async function toggleTest() {
      status.textContent = "Saving...";
      try {
        await store.patch("studies/" + s.id, { test: !s.test });
        ui.toast(s.test ? "Study counts again" : "Marked as a test study");
        status.textContent = "";
      } catch (e) { status.textContent = P.writeError(e); }
    }
    function askDelete() {
      const c = studyCounts(s.id);
      if (c.sessions || c.reports) {
        status.textContent = "This study has sessions or reports, so it can't be deleted. To leave it out of every count, mark it as a test study.";
        return;
      }
      row.dataset.busy = "1";
      const msg = statusLine();
      put(row, 
        el("p", { class: "caution", text: "Delete " + (s.name || s.id) + "? Its setup, goals and " + c.members + " memberships are removed. This can't be undone." }),
        el("div", { class: "bar" },
          el("button", { type: "button", class: "btn", text: "Yes, delete this study", onclick: async () => {
            msg.textContent = "Deleting...";
            try {
              const ms = (S.allMemberships || []).filter(m => m.studyId === s.id);
              for (const m of ms) await store.removeMembership(m.userId, s.id);
              await store.remove("studies/" + s.id);
              if (S.studyId === s.id) P.setStudy("");
              ui.toast("Study deleted");
              delete row.dataset.busy;
              st.peopleSig = ""; loadPeople();
            } catch (e) { msg.textContent = P.writeError(e); }
          } }),
          el("button", { type: "button", class: "btn ghost", text: "Keep the study", onclick: view }), msg));
    }
    view();
    return row;
  }

  function createStudyForm() {
    const name = el("input", { type: "text", maxlength: "80", placeholder: "Short name" });
    const link = el("input", { type: "url", maxlength: "300", placeholder: "https://" });
    const idOut = el("span", { class: "hint" });
    const msg = statusLine();
    name.addEventListener("input", () => { const id = slug(name.value); idOut.textContent = id ? "Id: " + id : ""; });
    const form = el("form", { class: "panel", novalidate: true },
      el("h3", { text: "Create a study" }),
      el("div", { class: "grid2" }, ui.field("Study name", name), ui.field("Notion project link (optional)", link, "A link only. Nothing syncs from Notion.")),
      idOut,
      el("div", { class: "bar" }, el("button", { type: "submit", class: "btn", text: "Create study" }), msg));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const nm = name.value.trim(), ln = link.value.trim(), id = slug(nm);
      if (!nm || !id) { msg.textContent = "Add a study name with at least one letter or number."; return; }
      if (id === "*" || S.studies.some(s => s.id === id)) { msg.textContent = "A study with the id " + id + " already exists. Change the name."; return; }
      /* Same name under a different id would make two studies nobody can tell apart. */
      if (S.studies.some(s => String(s.name || "").trim().toLowerCase() === nm.toLowerCase())) { msg.textContent = "A study named " + nm + " already exists."; return; }
      if (ln && !isHttp(ln)) { msg.textContent = "The link must start with https://"; return; }
      msg.textContent = "Creating...";
      try {
        await store.create("studies/" + id, { name: nm, notionLink: ln, showName: false });
        msg.textContent = "Created. Now add people to it under People.";
        ui.toast("Study created");
        form.reset(); idOut.textContent = "";
        st.peopleSig = "";
      } catch (err) { msg.textContent = P.writeError(err); }
    });
    return form;
  }

  /* ---------- 2. People ---------- */
  async function loadPeople() {
    try { st.people = await store.adminPeople(); st.peopleErr = ""; }
    catch (e) { st.people = st.people || []; st.peopleErr = "Couldn't load people. The database update may not have run yet."; }
    st.peopleSig = "";
    drawPeople();
  }

  function personCard(p) {
    const card = el("div", { class: "panel" });
    const markBusy = () => { card.dataset.busy = "1"; };
    const nameIn = el("input", { type: "text", value: p.name || "", maxlength: "80", "aria-label": "Name for " + p.email });
    nameIn.addEventListener("input", markBusy);
    const nameMsg = statusLine();

    const rows = (p.memberships || []).map(m => {
      const role = ui.select(roleOptions(), m.role, { "aria-label": "Role in " + studyLabel(m.studyId) });
      role.addEventListener("change", markBusy);
      const msg = statusLine();
      return el("tr", {},
        el("td", { text: studyLabel(m.studyId) }),
        el("td", {}, role),
        el("td", {}, el("div", { class: "bar" },
          el("button", { type: "button", class: "mini", text: "Save role", onclick: async () => {
            msg.textContent = "Saving...";
            try { await store.setMembership(p.id, m.studyId, role.value); ui.toast("Role saved"); delete card.dataset.busy; loadPeople(); }
            catch (e) { msg.textContent = P.writeError(e); }
          } }),
          el("button", { type: "button", class: "mini", text: "Remove from study", onclick: () => {
            markBusy();
            const who = p.name || p.email || "this person";
            put(msg, "Remove " + who + " from " + studyLabel(m.studyId) + "? ",
              el("button", { type: "button", class: "mini", text: "Yes, remove", onclick: async () => {
                msg.textContent = "Removing...";
                try { await store.removeMembership(p.id, m.studyId); ui.toast("Removed from study"); delete card.dataset.busy; loadPeople(); }
                catch (e) { msg.textContent = P.writeError(e); }
              } }),
              " ",
              el("button", { type: "button", class: "mini", text: "Keep", onclick: () => { msg.textContent = ""; } }));
          } }), msg)));
    });

    const have = new Set((p.memberships || []).map(m => m.studyId));
    const addOpts = studyOptions(true).filter(([id]) => !have.has(id));
    const addStudy = addOpts.length ? ui.select(addOpts, addOpts[0][0], { "aria-label": "Study to add" }) : null;
    const addRole = ui.select(roleOptions(), "rc", { "aria-label": "Role" });
    const addMsg = statusLine();
    if (addStudy) { addStudy.addEventListener("change", markBusy); addRole.addEventListener("change", markBusy); }

    put(card, 
      el("div", { class: "bar" }, el("h3", { text: p.email || p.id }),
        p.memberships && p.memberships.length ? null : ui.chip("No study yet", "unconfirmed")),
      el("p", { class: "hint", text: (p.lastSeen ? "Last visit " + ui.ago(p.lastSeen) + "." : "Hasn't signed in yet.") +
        (p.createdAt ? " Account made " + ui.fmtDate(p.createdAt) + "." : "") }),
      el("div", { class: "bar" }, ui.field("Name", nameIn, "Shown to people in the same study."),
        el("button", { type: "button", class: "btn ghost", text: "Save name", onclick: async () => {
          nameMsg.textContent = "Saving...";
          try { await store.setPersonName(p.id, nameIn.value.trim()); ui.toast("Name saved"); delete card.dataset.busy; loadPeople(); }
          catch (e) { nameMsg.textContent = P.writeError(e); }
        } }), nameMsg),
      rows.length ? el("div", { class: "scroll" }, el("table", {},
        el("thead", {}, el("tr", {}, ["Study", "Role", ""].map(h => el("th", { text: h })))),
        el("tbody", {}, rows))) : el("p", { class: "hint", text: "Not in any study yet. Add one below." }),
      addStudy ? el("div", { class: "bar" },
        ui.field("Add a study", addStudy), ui.field("Role", addRole),
        el("button", { type: "button", class: "btn", text: "Add to study", onclick: async () => {
          addMsg.textContent = "Adding...";
          try { await store.setMembership(p.id, addStudy.value, addRole.value); ui.toast("Added to study"); delete card.dataset.busy; loadPeople(); }
          catch (e) { addMsg.textContent = P.writeError(e); }
        } }), addMsg) : el("p", { class: "hint", text: "This person is in every study." }));
    return card;
  }

  function drawPeople() {
    if (!st.hosts) return;
    const host = st.hosts.people;
    if (st.people === null) { host.replaceChildren(ui.empty("Loading people...")); host._cache = null; host._empty = false; return; }
    if (st.peopleErr) { host.replaceChildren(ui.empty(st.peopleErr)); host._cache = null; host._empty = false; return; }
    const f = st.peopleFilter.trim().toLowerCase();
    const list = st.people.filter(p => !f || (p.email + " " + p.name).toLowerCase().includes(f));
    const studiesSig = S.studies.map(s => s.id + ":" + (s.name || "")).join("|");
    keyed(host, list, p => p.id, p => JSON.stringify([p.name, p.lastSeen, p.memberships, studiesSig]), personCard,
      f ? "No one matches that search." : "No accounts yet. Create them in Supabase first.");
  }

  /* ---------- 3. Triage ---------- */
  function openItems() {
    const sessions = S.sessions.filter(x => {
      const linked = !!x.linkedIssueId;
      const state = triageState(x);
      if (state === "linked" || state === "dismissed") return false;
      /* "Not an app problem" sessions are never sorted: they count only in the Dev meeting tally (D25). */
      if (outcomeOf(x) === "not_app") return false;
      if (outcomeOf(x) === "not_fixed" || x.outcome === "new_problem") return state === "new";
      return st.showUnlinked && !x.issueId && !linked;
    }).map(x => ({ kind: "session", rec: x }));
    const reports = S.reports.filter(r => r.issueId === "new" && !r.linkedIssueId &&
      triageState(r) !== "linked" && triageState(r) !== "dismissed").map(r => ({ kind: "report", rec: r }));
    return sessions.concat(reports).sort((a, b) => String(b.rec.created).localeCompare(String(a.rec.created)));
  }

  function itemTitle(it) {
    const r = it.rec;
    if (it.kind === "report") return "Report: something new";
    if (r.outcome === "new_problem") return "Session: new problem";
    if (outcomeOf(r) === "not_fixed") return "Session: still not fixed";
    return "Session with no issue";
  }

  function itemDetails(it) {
    const r = it.rec;
    const out = [];
    const facts = (label, value) => value ? el("p", {}, el("b", { text: label + ": " }), value) : null;
    out.push(el("p", { class: "hint", text: studyLabel(r.studyId) + ". " + ui.fmtDate(r.created) + " (" + ui.ago(r.created) + ")." +
      (r.phone ? " Phone: " + ((C.PHONES.find(p => p[0] === r.phone) || [0, r.phone])[1]) + "." : "") }));
    /* Who to ask for more detail (the troubleshooting ending says the platform team may ask). */
    if (r.author) {
      const acct = (st.people || []).find(p => p.id === r.author);
      const who = acct ? [acct.name, acct.email].filter(Boolean).join(", ") : calc.personName(r.author);
      out.push(facts(it.kind === "session" ? "Run by" : "Sent by",
        who + (r.role && C.ROLE_NAME && C.ROLE_NAME[r.role] ? " (" + C.ROLE_NAME[r.role] + ")" : "")));
    }
    if (it.kind === "session") {
      out.push(facts("Problem picked", entryTitle(r.entryId)));
      if (r.issueId) out.push(facts("Issue", issueLabel(r.issueId)));
      if (r.newProblem) {
        out.push(facts("What they see", r.newProblem.what));
        out.push(facts("Since", r.newProblem.since));
        out.push(facts("What changed just before", CHANGED_NAME[r.newProblem.changed] || ""));
      }
      const steps = (r.path || []).filter(s => s.node);
      if (steps.length) out.push(el("details", {}, el("summary", { text: "Steps tried (" + steps.length + ")" }),
        el("ol", {}, steps.map(s => el("li", {}, nodeLabel(s.node) + (s.label ? ": " + s.label : "") +
          (s.answer === "fixed" ? " (fixed)" : s.answer === "not_fixed" ? " (not fixed)" : "") +
          (s.note ? ". Note: " + s.note : ""))))));
      const d = r.device || {};
      const dev = [d.model, d.osVersion && "OS " + d.osVersion, d.appVersion && "app " + d.appVersion].filter(Boolean).join(", ");
      out.push(facts("Device", dev));
      out.push(facts("What helped", helpedText(r.helped, r.helpedPicks)));
    } else {
      out.push(facts("Title", r.newTitle));
      out.push(facts("What people see", r.newSymptom));
      out.push(facts("In their words", r.words));
      out.push(facts("Participants affected", r.n ? String(r.n) : ""));
      const lab = (k, names) => answersOf(r, k).map(a => ui.chip(((C.IMPACT_LABEL || {})[k] || {})[a] || names[a] || a));
      out.push(el("div", { class: "bar" }, lab("stops", C.STOPS), lab("data", C.DATA), lab("cost", C.COST),
        r.security ? ui.chip("Possible security problem", "sev hi") : null));
      out.push(facts("What helped", helpedText(r.fix, r.fixPicks)));
    }
    return out.filter(Boolean);
  }

  function linkPatch(it, issueId) {
    const p = { linkedIssueId: issueId, triage: Object.assign({ state: "linked" }, nowStamp()) };
    if (it.kind === "session" && !it.rec.issueId) p.issueId = issueId;
    return p;
  }

  function triageCard(it) {
    const r = it.rec;
    const col = it.kind === "session" ? "sessions" : "reports";
    const card = el("div", { class: "panel" });
    const actHost = el("div", { class: "list" });
    const msg = statusLine();

    async function doPatch(partial, okMsg) {
      msg.textContent = "Saving...";
      try { await store.patch(col + "/" + r.id, partial); ui.toast(okMsg); delete card.dataset.busy; }
      catch (e) { msg.textContent = P.writeError(e); }
    }
    function closeForm() { delete card.dataset.busy; put(actHost, buttons()); }

    function openLink() {
      card.dataset.busy = "1";
      const pickHost = el("div");
      let chosen = "";
      const confirmBtn = el("button", { type: "button", class: "btn", text: "Link to this issue", disabled: true, onclick: () => {
        if (chosen) doPatch(linkPatch(it, chosen), "Linked to " + issueLabel(chosen));
      } });
      const chosenOut = el("p", { class: "hint", text: "Pick the issue this belongs to." });
      put(actHost, el("div", { class: "list" }, pickHost, chosenOut,
        el("div", { class: "bar" }, confirmBtn, el("button", { type: "button", class: "btn ghost", text: "Cancel", onclick: closeForm }))));
      if (typeof P.issuePicker === "function") {
        P.issuePicker(pickHost, { studyId: r.studyId, showFixed: true, label: "Which issue is this?", onPick(id) {
          if (id === "new") { openNew(); return; }
          chosen = id; confirmBtn.disabled = false;
          chosenOut.textContent = "Link to: " + issueLabel(id);
        } });
      } else {
        const sel = ui.select([["", "Choose an issue"]].concat(S.issues.map(i => [i.id, i.id + ": " + issueLabel(i.id)])), "", { "aria-label": "Issue" });
        sel.addEventListener("change", () => { chosen = sel.value; confirmBtn.disabled = !chosen; });
        pickHost.replaceChildren(sel);
      }
    }

    function openNew() {
      card.dataset.busy = "1";
      const np = r.newProblem || {};
      const title = el("input", { type: "text", maxlength: String(C.LIMITS.title), value: r.newTitle || np.what || "" });
      const symptom = el("textarea", { maxlength: String(C.LIMITS.symptom) });
      symptom.value = r.newSymptom || np.what || "";
      const area = ui.select(Object.entries(C.AREAS), "app", { "aria-label": "Area" });
      const type = ui.select(TYPES, "bug", { "aria-label": "Type" });
      const stops = ui.select(Object.entries(C.STOPS), topAnswer(r, "stops", C.STOP_PTS) || "none");
      const data = ui.select(Object.entries(C.DATA), topAnswer(r, "data", C.DATA_PTS) || "unknown");
      const cost = ui.select(Object.entries(C.COST), answersOf(r, "cost").find(a => Object.prototype.hasOwnProperty.call(C.COST, a)) || "staff");
      const sec = el("input", { type: "checkbox", checked: !!r.security });
      const m = statusLine();
      put(actHost, el("div", { class: "list" },
        el("h3", { text: "Make a new issue" }),
        el("p", { class: "hint", text: "Every team can see a new issue unless you mark it as a security problem. Don't name the study or any person." }),
        ui.field("Title", title, "Plain words, as an RA would say it."),
        ui.field("What people see", symptom),
        el("div", { class: "grid2" }, ui.field("Area", area), ui.field("Type", type), ui.field("What it stops", stops),
          ui.field("What it does to the data", data), ui.field("Who has to deal with it", cost)),
        el("label", { class: "opts" }, el("span", { style: "display:flex;gap:6px;align-items:center" }, sec,
          "Security problem. Only admins will see this issue.")),
        el("div", { class: "bar" },
          el("button", { type: "button", class: "btn", text: "Create the issue and link this", onclick: async () => {
            const t = title.value.trim();
            if (!t) { m.textContent = "Add a title."; return; }
            const id = calc.nextIssueId();
            m.textContent = "Creating " + id + "...";
            try {
              await store.create("issues/" + id, {
                id: id, title: t, symptom: symptom.value.trim(), area: area.value, type: type.value, layers: [],
                status: "heard", statusNote: "", stops: stops.value, data: data.value, cost: cost.value,
                evidence: "", teams: 0, provisional: false, workarounds: [], confirmed: false,
                security: sec.checked, phrases: [],
                createdFrom: it.kind === "session" ? { sessions: [r.id], reports: [] } : { sessions: [], reports: [r.id] }
              });
              await store.patch(col + "/" + r.id, linkPatch(it, id));
              ui.toast("Issue " + id + " created and linked");
              delete card.dataset.busy;
            } catch (e) { m.textContent = P.writeError(e); }
          } }),
          el("button", { type: "button", class: "btn ghost", text: "Cancel", onclick: closeForm }), m)));
      title.focus();
    }

    function buttons() {
      const keep = it.kind === "session" && r.issueId
        ? el("button", { type: "button", class: "btn ghost", text: "Confirm link: " + issueLabel(r.issueId),
            onclick: () => doPatch({ triage: Object.assign({ state: "linked" }, nowStamp()) }, "Marked as sorted") })
        : null;
      return el("div", { class: "bar" },
        el("button", { type: "button", class: "btn", text: "Link to an issue", onclick: openLink }),
        el("button", { type: "button", class: "btn ghost", text: "Make a new issue", onclick: openNew }),
        keep,
        el("button", { type: "button", class: "btn ghost", text: "Dismiss", onclick: () =>
          doPatch({ triage: Object.assign({ state: "dismissed" }, nowStamp()) }, "Dismissed") }),
        msg);
    }

    put(actHost, buttons());
    put(card, el("div", { class: "bar" }, el("h3", { text: itemTitle(it) }),
      notCounted(r) ? ui.chip(notCounted(r), "unconfirmed") : null), ...itemDetails(it), actHost);
    return card;
  }

  /* ---------- 4. Workaround confirmations ---------- */
  function pendingWorkarounds() {
    const out = [];
    S.issues.forEach(issue => {
      calc.workarounds(issue).team.forEach(w => out.push({ issue, w }));
    });
    return out.sort((a, b) => (b.w.teams - a.w.teams) || String(b.w.last || "").localeCompare(String(a.w.last || "")));
  }
  function creditFor(w) {
    /* What other teams see now. Nothing is stored: credit is worked out each time it is shown. */
    const opted = (w.credited || []).filter(name => S.studies.some(s => (s.name || s.id) === name && s.showName));
    return opted.length ? opted.join(", ") : "a team";
  }
  function workaroundCard(item) {
    const { issue, w } = item;
    const card = el("div", { class: "panel" });
    const caution = el("input", { type: "text", maxlength: "200", placeholder: "Optional" });
    caution.addEventListener("input", () => { card.dataset.busy = caution.value ? "1" : ""; if (!caution.value) delete card.dataset.busy; });
    const msg = statusLine();
    async function patchIssue(partial, okMsg) {
      msg.textContent = "Saving...";
      try { await store.patch("issues/" + issue.id, partial); ui.toast(okMsg); delete card.dataset.busy; }
      catch (e) { msg.textContent = P.writeError(e); }
    }
    put(card, 
      el("p", { class: "k", text: issueLabel(issue.id) }),
      el("p", { text: w.text }),
      el("p", { class: "hint", text: "Used by " + plural(w.teams, "team") +
        " (" + plural(w.reports || 0, "report") + ", " + plural(w.sessions || 0, "session") + ")." +
        ((w.credited || []).length ? " From: " + w.credited.join(", ") + "." : "") +
        " Other teams see it as from \"" + creditFor(w) + "\"." }),
      ui.field("Caution (when it has a cost)", caution, "For example: \"This deletes data not yet uploaded.\" Every team sees it."),
      el("div", { class: "bar" },
        el("button", { type: "button", class: "btn", text: "Confirm workaround", onclick: () => {
          const list = (issue.confirmedWorkarounds || []).slice();
          list.push(Object.assign({ text: w.text, key: w.key || calc.norm(w.text), caution: caution.value.trim() }, nowStamp()));
          patchIssue({ confirmedWorkarounds: list }, "Workaround confirmed");
        } }),
        el("button", { type: "button", class: "btn ghost", text: "Hide it", onclick: () => {
          const hidden = (issue.hiddenWorkarounds || []).slice();
          const hk = calc.hideKey(w);
          if (!hidden.includes(hk)) hidden.push(hk);
          patchIssue({ hiddenWorkarounds: hidden }, "Workaround hidden");
        } }), msg));
    return card;
  }

  /* ---------- 5. Dev meeting details ---------- */
  function meetingForm() {
    const date = el("input", { type: "date", "aria-label": "Date of the last dev meeting" });
    const url = el("input", { type: "url", maxlength: "500", placeholder: "https://" });
    const msg = statusLine();
    const form = el("form", { class: "panel", novalidate: true },
      el("h3", { text: "5. Dev meeting details" }),
      el("p", { class: "hint", text: "The Dev meeting page shows these to everyone who opens it. Only developers, the platform team and admins see the report link." }),
      el("div", { class: "grid2" },
        ui.field("Date of the last meeting", date, "New items on the Dev meeting page start from this date."),
        ui.field("Link to the latest pre-meeting report", url, "Paste a link to where this week's report is shared (its file is reports/" + lastMonday() + "-monday-report.md).")),
      el("div", { class: "bar" }, el("button", { type: "submit", class: "btn", text: "Save meeting details" }), msg));
    let typed = false;
    form.addEventListener("input", () => { typed = true; });
    form._load = async () => {
      try {
        const m = (await store.rpc("portal_meeting")) || {};
        if (!typed) { date.value = m.lastMeeting || ""; url.value = m.reportUrl || ""; }
        msg.textContent = m.updatedAt ? "Last saved " + ui.fmtDate(m.updatedAt) + "." : "";
      } catch (e) { msg.textContent = missingFn(e) ? "Run the latest 03-migration.sql to save meeting details." : "Couldn't load the meeting details."; }
    };
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const u = url.value.trim();
      if (u && !/^https:\/\/\S+$/i.test(u)) { msg.textContent = "The link must start with https:// and have no spaces."; url.focus(); return; }
      msg.textContent = "Saving...";
      try {
        await store.rpc("portal_set_meeting", { p_last_meeting: date.value || "", p_report_url: u });
        typed = false; ui.toast("Meeting details saved"); form._load();
      } catch (err) { msg.textContent = missingFn(err) ? "Run the latest 03-migration.sql first." : P.writeError(err); }
    });
    return form;
  }

  /* ---------- 6. Records with no study (made in the prototype) ---------- */
  function orphanCard(r) {
    const card = el("div", { class: "panel" });
    const opts = studyOptions(false);
    const sel = ui.select([["", "Choose a study"]].concat(opts), "", { "aria-label": "Study for this report" });
    sel.addEventListener("change", () => { if (sel.value) card.dataset.busy = "1"; else delete card.dataset.busy; });
    const msg = statusLine();
    put(card, 
      el("p", { class: "k", text: issueLabel(r.issueId) }),
      el("p", { class: "hint", text: "Report from " + ui.fmtDate(r.created) + ". Study typed in: " + (r.study || "none") + "." }),
      el("div", { class: "bar" }, sel,
        el("button", { type: "button", class: "btn", text: "Assign to study", onclick: async () => {
          if (!sel.value) { msg.textContent = "Choose a study first."; return; }
          msg.textContent = "Saving...";
          try { await store.patch("reports/" + r.id, { studyId: sel.value }); ui.toast("Report assigned"); delete card.dataset.busy; }
          catch (e) { msg.textContent = P.writeError(e); }
        } }), msg));
    return card;
  }

  /* ---------- 6. feedback: from signed-in pages, and from the demo (supabase/06-demo-feedback.sql) ---------- */
  async function loadDemoFeedback() {
    if (P.demo) { st.demoFb = []; st.demoFbErr = ""; drawFeedback(); return; }
    try { const v = await store.rpc("admin_demo_visits"); st.demoVisits = Array.isArray(v) ? v[0] : v; } catch (e) { st.demoVisits = null; }
    try { st.demoFb = (await store.rpc("admin_demo_feedback")) || []; st.demoFbErr = ""; }
    catch (e) { st.demoFb = []; st.demoFbErr = "Feedback sent from the demo shows here once supabase/06-demo-feedback.sql has been run."; }
    drawFeedback();
  }
  function drawFeedback() {
    const h = st.hosts && st.hosts.feedback;
    if (!h) return;
    const PART = Object.assign({}, P.PAGE_NAME, { overall: "The portal overall", recognition: "Credit questions" });
    const signed = (S.feedback || []).map(f => {
      const acct = (st.people || []).find(p => p.id === f.author);
      return { at: f.created, page: f.part, text: f.text, who: acct ? (acct.name || acct.email) : calc.personName(f.author) };
    });
    const demo = (st.demoFb || []).map(f => ({ at: f.created_at, page: f.page, text: f.body, who: f.role ? "Demo, viewing as " + f.role : "Demo" }));
    const all = signed.concat(demo).sort((x, y) => String(y.at).localeCompare(String(x.at)));
    const v = st.demoVisits;
    const visits = v ? el("p", { text: "Demo opened in " + plural(Number(v.today) || 0, "browser") + " today, " + (Number(v.last_7_days) || 0) +
      " in the last 7 days, " + (Number(v.last_30_days) || 0) + " in the last 30 days" + (v.first_day ? " (counting since " + ui.fmtDate(v.first_day) + ")" : "") +
      ". A browser counts once a day; one person on two devices counts twice." }) : null;
    h.replaceChildren(...(visits ? [visits] : []), ...(st.demoFbErr ? [el("p", { class: "hint", text: st.demoFbErr })] : []),
      ...(all.length ? all.map(f => el("div", { class: "card" },
        el("p", { style: "white-space:pre-wrap;margin:0 0 6px", text: f.text || "" }),
        el("p", { class: "hint", text: [PART[f.page] || f.page || "The portal overall", f.who, f.at ? ui.fmtDate(f.at) : ""].filter(Boolean).join(" · ") })))
        : [ui.empty("No feedback yet.")]));
  }

  /* ---------- page ---------- */
  function build(sec) {
    const studies = el("div", { class: "list" });
    const people = el("div", { class: "list" });
    const triage = el("div", { class: "list" });
    const workarounds = el("div", { class: "list" });
    const orphans = el("div", { class: "list" });
    const feedback = el("div", { class: "list" });
    const triageCount = el("span", { class: "hint" });
    const unlinked = el("input", { type: "checkbox", checked: st.showUnlinked });
    unlinked.addEventListener("change", () => { st.showUnlinked = unlinked.checked; refresh(); });
    const filter = el("input", { type: "search", placeholder: "Search by email or name", "aria-label": "Search people" });
    filter.addEventListener("input", () => { st.peopleFilter = filter.value; drawPeople(); });
    const meeting = meetingForm();
    const orphanPanel = el("div", { class: "panel", hidden: true },
      el("h3", { text: "Reports with no study" }),
      el("p", { class: "hint", text: "Made before studies had accounts. Only admins see them until you assign a study." }), orphans);

    put(sec, 
      ui.pageHead(P.PAGE_COPY.admin),

      el("div", { class: "panel" },
        el("h3", { text: "1. Studies" }),
        el("p", { class: "hint", text: "A study's lead fills in its setup on the Your study page." })),
      createStudyForm(),
      studies,

      el("div", { class: "panel" },
        el("h3", { text: "2. People and roles" }),
        el("p", { class: "notice", text: "Create accounts in Supabase first: Authentication, Users, Add user. They appear here after that." }),
        el("p", { class: "hint", text: "A person can have a different role in each study. People can't change their own role. Admins are listed in the admins table in Supabase." }),
        el("details", {}, el("summary", { text: "What each role means" }),
          el("ul", { class: "clean" }, C.ROLES.map(r => el("li", {}, el("b", { text: r.name + ": " }), r.def)))),
        el("div", { class: "bar" }, filter,
          el("button", { type: "button", class: "btn ghost", text: "Reload people", onclick: () => { st.people = null; drawPeople(); loadPeople(); } }))),
      people,

      el("div", { class: "panel" },
        el("h3", { text: "3. Sort new problems" }),
        el("p", { class: "hint", text: "Sessions that ended \"Still not fixed\" or \"New problem\", and reports of something new. Link each to an issue, make a new issue, or dismiss it. The team sees what you did on its Home page." }),
        el("label", { class: "opts" }, el("span", { style: "display:flex;gap:6px;align-items:center" }, unlinked,
          "Also show finished sessions that have no issue")),
        triageCount),
      triage,

      el("div", { class: "panel" },
        el("h3", { text: "4. Confirm workarounds" }),
        el("p", { class: "hint", text: "What teams wrote under \"What helped\". Other teams already see these, marked \"Not confirmed yet\". Confirm the safe ones, add a caution when one has a cost, and hide anything that isn't a workaround." })),
      workarounds,
      meeting,
      el("div", { class: "panel" },
        el("h3", { text: "6. Feedback" }),
        el("p", { class: "hint", text: "From the Feedback button and How this works, signed in or from the demo. Newest first." }),
        el("div", { class: "bar" }, el("button", { type: "button", class: "btn ghost", text: "Reload feedback", onclick: () => loadDemoFeedback() }))),
      feedback,
      orphanPanel);

    st.hosts = { studies, people, triage, workarounds, orphans, orphanPanel, triageCount, meeting, feedback };
    meeting._load();
    loadDemoFeedback();
    st.built = true;
    drawPeople();
    loadPeople();
  }

  function refresh() {
    const h = st.hosts;
    if (!h) return;
    drawFeedback();
    const studies = S.studies.slice().sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    keyed(h.studies, studies, s => s.id, s => JSON.stringify([s.name, s.notionLink, s.showName, s.test, studyCounts(s.id)]),
      studyRow, "No studies yet. Create one above.");

    const items = openItems();
    h.triageCount.textContent = items.length ? items.length + (items.length === 1 ? " item to sort." : " items to sort.") : "";
    keyed(h.triage, items, it => it.kind + ":" + it.rec.id, it => JSON.stringify([it.rec.updated, it.rec.triage, it.rec.linkedIssueId]),
      triageCard, "Nothing to sort right now.");

    const was = pendingWorkarounds();
    keyed(h.workarounds, was, x => x.issue.id + "|" + x.w.key, x => JSON.stringify([x.w.teams, x.w.reports, x.w.sessions, x.w.credited]),
      workaroundCard, S.agg.ready ? "No team workarounds waiting." : "Team workarounds show here once the database update has run.");

    const orphans = S.reports.filter(r => !r.studyId);
    h.orphanPanel.hidden = !orphans.length;
    keyed(h.orphans, orphans, r => r.id, r => String(r.updated), orphanCard, "None.");

    const sig = S.studies.map(s => s.id + ":" + (s.name || "")).join("|");
    if (sig !== st.peopleSig) { st.peopleSig = sig; drawPeople(); }
  }

  P.register({
    id: "admin",
    order: 70,
    adminOnly: true,
    init() {},
    render(params) {
      if (!S.user.isAdmin) return;
      const sec = P.section("admin");
      if (!st.built) build(sec);
      refresh();
      if (params && st.hosts && (params.focus === "triage" || params.focus === "meeting")) {
        const target = params.focus === "meeting" ? st.hosts.meeting : st.hosts.triage;
        try { target.scrollIntoView({ block: "start" }); } catch (e) { /* ignore */ }
        if (params.focus === "meeting") { st.hosts.meeting._load(); const f = target.querySelector("input"); if (f) f.focus({ preventScroll: true }); }
      }
    }
  });
})();

/* INTEGRATED 2026-10-27: home sends admins to P.go("admin", {focus: "triage"}). Page head from P.PAGE_COPY.admin. */
/* NOTES (admin.js)
   - Uses P.issuePicker(host, {studyId, onPick, showFixed: true}) from issues.js for linking; falls back to a plain
     select if it is missing. Picking "Something new" in the picker opens the "Make a new issue" form.
   - render({focus: "triage"}) scrolls to the triage list. Home can call P.go("admin", {focus: "triage"}).
   - Sessions are linked with linkedIssueId (and issueId when the session had none), matching calc.stats and
     the portal_* SQL, which read linkedIssueId first.
   - confirmedWorkarounds[].by is the admin's user id, like statusHistory[].by. REVIEW FIX 2026-10-27: no credit is
     stored (it went stale when a study turned its name off); pages work it out with P.calc.creditFor.
   - Deleting a study also removes its memberships (no foreign key in 03-migration.sql). Boosts tied to it stay
     and lose the name.
   - Styling uses the shared classes in index.html only; css/admin.css was not in this builder's assignment. */
/* INTEGRATED (pass 2, 2026-10-28)
   - Section "Dev meeting details": portal_meeting / portal_set_meeting (03 section 8; demo mode answers both).
     render({focus: "meeting"}) scrolls to it.
   - "Mark as a test study" / "Count this study again" patches studies/<id> {test}. Test studies and records an
     admin wrote outside their studies (data.outsideStudy, set by the database) are left out of every count.
   - "Remove from study" asks first. Page-head copy is in home.js PAGE_COPY.admin. */
/* ROUND 2026-10-28: "not an app problem" sessions never enter the queue to sort; study rows count them
   apart. Triage details show picked suggestions (helpedPicks, fixPicks) in words. Short issue names. */
