/* "How this works" page (was "About"). Owner: core-home-about. Spec: SPEC.md 7.8, page-review-proposals.md
   (About), decisions D14, D19, D22, D23. Plain, short sentences. No em-dashes.
   Nothing here names a study, team, site or person. */
(function () {
  "use strict";
  const P = window.Portal;

  const PARTS = [
    ["overall", "The portal overall"], ["home", "Start here"], ["guide", "Troubleshoot"], ["report", "Weekly report"],
    ["issues", "Known problems"], ["study", "Your study"], ["dev", "Dev meeting"], ["admin", "Admin"], ["about", "How this works"]
  ];
  /* The five steps agreed at the 10-26 dev meeting (D19). */
  const FLOW = [
    ["Report", "Study teams troubleshoot here and send reports on problems that keep coming up. Developers file GitHub issues. Security problems, and anything about a specific participant or study, go privately to the platform team."],
    ["Triage", "Every two weeks the dev meeting reviews new reports and sessions. Quick, low-risk fixes are just fixed. A problem that matches a known issue gets a work ticket. A new idea gets a short note in the meeting; the person who scopes it writes it up afterwards."],
    ["Build and test", "Developers build and test the change. Study teams try it at milestones."],
    ["Review and ship", "The platform team reviews the change and releases it, with release notes. The guide and docs are updated."],
    ["Status update", "The issue's status changes here. If you reported it, troubleshot it or marked \"This affects us too\", you see the change on Start here."]
  ];
  const STATUS_HELP = P.C.STATUS_HELP || {};
  const RECOG = [
    { id: "credit", q: "When your team's report or workaround helps, how should it be credited?",
      opts: ["Not at all", "As \"a team\"", "With our study's name", "With our own names", "Not sure"] },
    { id: "verify", q: "Should the platform team confirm workarounds before other teams see them?",
      opts: ["Yes, always", "No. Show them, marked \"not confirmed yet\"", "Not sure"] },
    { id: "word", q: "Is \"contributor\" the right word for people who report and troubleshoot here?",
      opts: ["Yes", "No", "Not sure"] }
  ];

  let built = false;

  function build(sec) {
    const { el, pageHead, statusChip, field, select } = P.ui;
    const C = P.C;
    const copy = (P.PAGE_COPY && P.PAGE_COPY.about) || { title: "How this works" };

    const what = el("div", { class: "panel" },
      el("h3", { text: "What this is" }),
      el("p", { text: "One place where study teams and the mindLAMP platform team track the problems teams hit, and what helps." }),
      el("p", { text: "It is useful even before anything is fixed: the troubleshooting guide and known workarounds help on the next call." }));

    const flow = el("div", { class: "panel" },
      el("h3", { text: "How a problem moves, in five steps" }),
      el("ol", { class: "ab-flow" }, FLOW.map(([t, d]) => el("li", {}, el("strong", { text: t }), el("span", { text: d })))));

    const rank = el("div", { class: "panel" },
      el("h3", { text: "How problems are ranked" }),
      el("ul", { class: "clean" },
        el("li", { text: "Severity comes from what teams report: what a problem stopped, and what it did to data. Until a team reports a problem, it uses a starter rating." }),
        el("li", { text: "A problem ranks higher when more teams see it, and when it threatens goals that the reporting studies ranked highly." }),
        el("li", { text: "The dev meeting view shows how each number is worked out, so anyone can question it." })));

    const others = el("div", { class: "panel" },
      el("h3", { text: "Who sees what" }),
      el("div", { class: "grid2" },
        el("div", {},
          el("div", { class: "k", text: "Everyone signed in" }),
          el("ul", { class: "clean" },
            el("li", { text: "Known problems: what people see, status, what's planned, and any \"Not now\" reason." }),
            el("li", { text: "Workarounds, and text written under \"What fixed it\" or \"What helped\"." }),
            el("li", { text: "Counts, like \"seen by 4 teams\". Never which team." }),
            el("li", { text: "Reasons added to a problem: the goal, the reason and the person's role." }),
            el("li", { text: "Goal ranking totals, once at least 3 studies have ranked." }))),
        el("div", {},
          el("div", { class: "k", text: "Your study and the platform team" }),
          el("ul", { class: "clean" },
            el("li", { text: "Your study's sessions and full reports." }),
            el("li", { text: "Your study's setup, population tags and goal ranking." }),
            el("li", { text: "Which study reported what." }))),
        el("div", {},
          el("div", { class: "k", text: "Developers and the platform team" }),
          el("ul", { class: "clean" },
            el("li", { text: "Proposal details: risks, effects, test plans and owners. The database enforces this." }),
            el("li", { text: "What was seen in sessions that weren't fixed, without the study or the person." })))),
      el("p", { text: "Other teams see your work as \"a team\". Your study lead can choose to show your study's name instead." }),
      el("p", { class: "hint", text: "Never stored here: participant names, IDs, contact details, dates of birth, locations, or anything else that identifies a person. Those stay in your own study records, under your own IRB. Security problems are never shown to other teams." }));

    const roles = el("div", { class: "panel" },
      el("h3", { text: "Roles" }),
      el("p", { text: "The platform team sets your role in each study. You can have a different role in each one." }),
      el("ul", { class: "clean" }, C.ROLES.map(r => el("li", {}, el("strong", { text: r.name + ": " }), r.def))));

    const ladder = el("div", { class: "panel" },
      el("h3", { text: "What the statuses mean" }),
      el("ul", { class: "clean ab-ladder" }, Object.keys(C.STATUS).map(k => el("li", {}, statusChip(k), el("span", { text: STATUS_HELP[k] || "" })))));

    /* Recognition questions (D14). Saved as feedback, part "recognition". */
    const rStatus = el("span", { class: "hint", role: "status" });
    const rNote = el("textarea", { maxlength: "800", rows: "3" });
    const rForm = el("form", { class: "panel", novalidate: true },
      el("h3", { text: "Three questions for you" }),
      el("p", { class: "hint", text: "We are deciding how to credit and check what teams share. Answer any you like." }),
      RECOG.map(q => el("fieldset", {},
        el("legend", { text: q.q }),
        el("div", { class: "opts ab-opts" }, q.opts.map((o, i) => el("label", {},
          el("input", { type: "radio", name: "ab-" + q.id, value: o, id: "ab-" + q.id + "-" + i }), o))))),
      field("Anything else? For example, a better word than \"contributor\".", rNote, P.C.PRIVACY_HINT),
      el("div", { class: "bar" }, el("button", { class: "btn", type: "submit", text: "Send my answers" }), rStatus));
    rForm.addEventListener("submit", async e => {
      e.preventDefault();
      const answers = {};
      RECOG.forEach(q => { const c = rForm.querySelector("input[name=\"ab-" + q.id + "\"]:checked"); if (c) answers[q.id] = c.value; });
      const note = rNote.value.trim();
      if (!Object.keys(answers).length && !note) { rStatus.textContent = "Pick an answer or write a note first."; return; }
      const text = RECOG.filter(q => answers[q.id]).map(q => q.q + " " + answers[q.id]).concat(note ? ["Note: " + note] : []).join("\n");
      rStatus.textContent = "Sending...";
      try {
        await P.store.add("feedback", { part: "recognition", text: text, answers: answers });
        rStatus.textContent = P.demo ? "Demo: answers noted, not sent." : "Thank you. Your answers were sent.";
        rForm.reset();
      } catch (err) { rStatus.textContent = P.writeError(err); }
    });

    /* General feedback. The header's "Feedback on this page" button works from every page. */
    const part = select(PARTS, "overall", { "aria-label": "Which part" });
    const text = el("textarea", { maxlength: "1500" });
    const status = el("span", { class: "hint", role: "status" });
    const send = el("button", { class: "btn", type: "submit", text: "Send feedback" });
    const form = el("form", { class: "panel", novalidate: true, id: "about-feedback" },
      el("h3", { text: "Send feedback" }),
      el("p", { class: "hint", text: "Tell us what is missing, confusing or not worth the time. Only the platform team reads it. You can also use \"Feedback on this page\" at the top of any page." }),
      field("Which part?", part),
      field("Your comment", text, C.PRIVACY_HINT),
      el("div", { class: "bar" }, send, status));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const t = text.value.trim();
      if (!t) { status.textContent = "Write a comment first."; text.focus(); return; }
      send.disabled = true; status.textContent = "Sending...";
      try {
        await P.store.add("feedback", { part: part.value, text: t });
        status.textContent = P.demo ? "Demo: feedback noted, not sent." : "Thank you. Your feedback was sent.";
        text.value = "";
      } catch (err) { status.textContent = P.writeError(err); }
      send.disabled = false;
    });

    sec.replaceChildren(pageHead(copy), what, flow, others, roles, ladder, rank, rForm, form);
  }

  P.register({
    id: "about",
    order: 80,
    init() {},
    render() {
      if (built) return;
      build(P.section("about"));
      built = true;
    }
  });
})();
