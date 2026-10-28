/* Troubleshooting guide content. Data only, no functions. Owner: B2. Schema: SPEC.md section 5.
   Public repo: never name a study, team, site, person or participant. No em-dashes or en-dashes.
   Check with: node site/tools/check-content.js

   SOURCES (troubleshooting-research-v2.md, 2026-10-27):
   - Entry cards, titles, search phrases: section 2 (E1 to E13) and the grouped picker list at the top of section 2.
   - Card order (most common first) by evidence breadth in section 2: teams named, record counts, GitHub volume.
       wont_load E5 (7 teams, ~20 GitHub issues, "most common participant-facing failure mode")
       login E1 (6 teams, 10+ GitHub issues), reminders E2 (5 teams, most log entries), not_done E4 (7 teams),
       find_activity E3 (3+ direct; 12 of 19 teams in the reachability trend), activity_wrong E6,
       question E9 (6+ teams), battery E8 (6 teams), wearable E7 (3 to 5 teams); then data_missing E10,
       setup_new E11, stop_collection E12, staff_side E13, other.
   - Paths: section 4. login = P1, reminders = P2, find_activity = P3, not_done = P4, wont_load = P5,
     activity_wrong = P6, wearable = P7, battery = P8, question = P9, data_missing = P10, setup_new = P11,
     stop_collection = P12, staff_side = P13. "Something else" = section 5.
   - Shared rules (least-disruptive order, confirm on your end, escalation packet, stopgaps): section 4 "Rules for every path".
   - Setup filters (when): section 3.
   - Issue ids: supabase/02-seed-issues.sql titles, and the SPEC section 5 entry table.

   BASIS MAPPING (research tag or source code -> basis tag):
   [docs] and docs sources -> documented. [code] -> code. Platform team records -> platform ("Platform team practice").
   [staff] and study teams' own logs and notes -> staff. [common] -> common.
   [dev], GH alone, N-TEAM and [inference] -> no tag. Those steps are in heldBack unless another basis supports them (D21).
   Basis choices made here for the platform team to check: the "open on Wi-Fi, charged, wait" step is tagged documented + code
   (docs: unsent answers are kept and sent once connected; code: sign-out and reinstall delete them). The research
   tags the step itself [inference]; how many minutes is enough is untested. */
window.GUIDE_CONTENT = {
  version: "2026-10-27",
  sample: false,

  stopgaps: {
    alarm: {
      short: "Set a phone alarm", who: "participant-now",
      text: "Set a phone alarm or calendar reminder at the activity time.",
      why: "It keeps them on schedule until activity reminders work again.",
      basis: ["staff", "platform"],
      workaroundFor: ["i03"]
    },
    web: {
      short: "Use the web version", who: "participant-later",
      text: "Do the activity on the web at dashboard.lamp.digital (or your own server's dashboard address), on a phone browser or a computer. They sign in with their study login.",
      why: "Activities done on the web are saved. Phone data and activity reminders don't work there.",
      basis: ["documented", "platform"],
      workaroundFor: ["i01", "i05", "i21"]
    },
    unhide: {
      short: "Unhide the activity", who: "staff-now",
      text: "Ask your study lead whether to show the activity in a tab (Assess, Learn or Manage).",
      why: "This gives access again. People can then do it outside its time window, which matters if timing is part of your study.",
      basis: ["platform"],
      workaroundFor: ["i13"]
    },
    one_counts: {
      short: "Once is enough", who: "staff-now",
      text: "Tell the person that doing the activity once counts.",
      why: "Extra activity reminders can make people think they must do it again.",
      basis: ["staff"],
      workaroundFor: ["i04"]
    },
    charger: {
      short: "Charging routine or charger", who: "participant-later",
      text: "Suggest a charging routine, or offer a portable charger.",
      why: "A phone that runs low may switch to low power mode, which can reduce data collection. Keeping it above about 20% helps.",
      basis: ["staff", "documented"],
      workaroundFor: ["i10"]
    },
    low_power: {
      short: "Allow low power mode", who: "participant-now",
      text: "If battery drain might make them leave the study, low power mode (iPhone) or Battery Saver (Android) is fine. Note it in your study records so the gaps in their phone data are explained.",
      why: "Low power mode saves battery but may reduce or stop background data, such as location and motion. Keeping them in the study matters more than complete data.",
      basis: ["documented"],
      workaroundFor: ["i10"]
    }
  },

  entries: [
    {
      id: "wont_load", order: 1, group: "participant",
      title: "The app won't load",
      description: "Blank or white screen, spinning, freezing, crashing, or an error.",
      phrases: ["white screen", "blank", "black screen", "spinning wheel", "keeps loading", "buffering", "frozen",
        "stuck", "app closes by itself", "crashes", "error message", "something went wrong", "no internet error",
        "unexpected error", "not responding"],
      issueId: "i21",
      start: "load.what"
    },
    {
      id: "login", order: 2, group: "participant",
      title: "Can't log in, or got logged out",
      description: "Login fails, or the login screen keeps coming back.",
      phrases: ["can't sign in", "login not working", "incorrect username or password", "invalid id", "wrong server",
        "kicked out", "logged out", "signed out", "has to log in every time", "login screen keeps coming back",
        "password doesn't work", "qr code didn't work", "stuck after login", "self help", "try it"],
      issueId: "i01",
      start: "login.what"
    },
    {
      id: "reminders", order: 3, group: "participant",
      title: "Not getting activity reminders",
      description: "Or they come silently, at the wrong time, or too often.",
      phrases: ["no notifications", "no reminders", "not getting alerts", "notification didn't come", "silent",
        "came late", "wrong time", "an hour off", "twice", "every hour", "keeps repeating after i finished",
        "reminders for something deleted", "a pile of reminders at once", "red number on the app icon",
        "notification won't go away", "tapping it opens a blank page"],
      issueId: "i03", alsoIssues: ["i04", "i06"],
      start: "rem.what"
    },
    {
      id: "not_done", order: 4, group: "participant",
      title: "Activity done but not showing",
      description: "No checkmark, streak reset, lost answers, or it won't submit.",
      phrases: ["did the survey but it's not there", "submitted but nothing on dashboard", "streak reset", "no checkmark",
        "says i didn't do it", "lost my answers", "had to start over", "game results missing", "won't submit",
        "error while saving results"],
      issueId: "i05",
      start: "done.where"
    },
    {
      id: "find_activity", order: 5, group: "participant",
      title: "Can't find or open an activity",
      description: "It's gone, greyed out, won't open, or a new one isn't there.",
      phrases: ["survey disappeared", "can't find the survey", "missed the notification and now can't do it",
        "nothing in the feed", "activity greyed out", "won't open", "tab is empty", "new activity not showing",
        "shows on dashboard but not in app"],
      issueId: null, alsoIssues: ["i13", "i14"],
      start: "find.what"
    },
    {
      id: "activity_wrong", order: 6, group: "participant",
      title: "An activity looks wrong or doesn't work",
      description: "Cut off, numbers instead of words, slider, audio, or text too small.",
      phrases: ["cut off", "can't see the jewels", "off the screen", "can't scroll", "answer choices are numbers",
        "words missing", "shows ...", "text too small", "button covers the question", "tap doesn't register",
        "game too fast", "stuck after recording", "instructions missing", "audio won't play",
        "slider won't go to the top", "pop-up won't go away", "wrong language"],
      issueId: null, alsoIssues: ["i20", "i18", "i07", "i22", "i17"],
      start: "act.what"
    },
    {
      id: "question", order: 7, group: "participant",
      title: "Question or worry",
      description: "Is it working, can I close it, why this permission, who sees my data.",
      phrases: ["is it working", "does it need to stay open", "can i close it", "what is this notification",
        "why is it asking for that", "is it tracking me", "who sees my data", "does it use my data plan",
        "why is there a number on the icon"],
      issueId: null,
      start: "q.what"
    },
    {
      id: "battery", order: 8, group: "participant",
      title: "Battery, mobile data or storage",
      description: "Faster battery drain, mobile data use, or full storage.",
      phrases: ["battery drains", "phone dies", "charging more", "phone hot", "uses my data plan", "phone storage full"],
      issueId: "i10",
      start: "batt.what"
    },
    {
      id: "wearable", order: 9, group: "participant",
      title: "Watch or health-app data is missing",
      description: "No steps, sleep or heart rate from a watch or health app.",
      phrases: ["no steps", "no sleep", "no heart rate", "fitbit not syncing", "apple watch data missing",
        "health connect", "samsung health", "google fit", "apple health"],
      issueId: "i12",
      when: { wearable: true },
      start: "wear.which"
    },
    {
      id: "data_missing", order: 10, group: "noticed",
      title: "Data is missing on your end",
      description: "Activities, phone data, or both stopped arriving.",
      phrases: ["no data since", "red or yellow on the users tab", "last passive is old", "data quality dropped",
        "gps 0%", "gaps in the chart", "no surveys for days", "qc report says missing"],
      issueId: "i08", alsoIssues: ["i09", "i24"],
      start: "data.view"
    },
    {
      id: "setup_new", order: 11, group: "study",
      title: "New participant setup",
      description: "Download, first login, permission pop-ups, or the first activity.",
      phrases: ["can't download", "can't find the app", "icon not on home screen", "permission pop-up keeps coming back",
        "never asked for permissions", "no always option", "qr opened a website", "it says self help",
        "needs apple id password"],
      issueId: null,
      start: "setup.step"
    },
    {
      id: "stop_collection", order: 12, group: "study",
      title: "Ending or pausing collection",
      description: "The study is over, a pause between bursts, or they asked to stop.",
      phrases: ["study is over but data still coming", "how do we stop collection", "stop tracking",
        "pause between bursts", "remove the app"],
      issueId: null,
      start: "stop.what"
    },
    {
      id: "staff_side", order: 13, group: "study",
      title: "Problem on your side",
      description: "Dashboard errors, logins you create, or saving.",
      phrases: ["can't create a login", "could not perform operation for unknown reason", "save button",
        "dashboard won't save", "dashboard slow", "can't see the participant's portal", "report didn't arrive",
        "activities vanished from the list", "edits disappeared"],
      issueId: null, alsoIssues: ["i23"],
      start: "staff.what"
    },
    {
      id: "other", order: 99, group: "other",
      title: "Something else",
      description: "Not listed, or you're not sure which one fits.",
      phrases: [],
      issueId: null,
      start: "other.part"
    }
  ],

  nodes: {

    /* ===== wont_load: P5 ===== */
    "load.what": {
      kind: "question", stage: 1, short: "What is on screen?",
      text: "What is on the screen? Ask for a screenshot if they can.",
      why: "The exact screen and any error text are the main clues. The app shows no error details, so a screenshot matters.",
      basis: ["platform"],
      options: [
        { label: "White, black or blank screen", next: "load.where" },
        { label: "Spinning or loading that never ends", next: "load.where" },
        { label: "The app closes by itself", next: "load.where" },
        { label: "An error about the internet or connection", next: "load.network" },
        { label: "Another error message", next: "load.where" }
      ],
      otherNext: "load.where"
    },
    "load.where": {
      kind: "question", stage: 1, short: "One activity or the whole app?",
      text: "Is it one activity or game, or the whole app?",
      why: "If only one activity fails, that activity or its setup is the likely cause. A wrong activity file shows a white page.",
      basis: ["platform"],
      options: [
        { label: "One activity or game", next: "load.one" },
        { label: "The whole app", next: "load.wait" },
        { label: "Not sure", next: "load.wait" }
      ],
      otherNext: "load.wait"
    },
    "load.one": {
      kind: "question", stage: 2, short: "Others on this activity too?",
      text: "Do other people see this on the same activity?",
      why: "If everyone on one activity sees it, the activity's setup is the likely cause, not the phone.",
      basis: ["platform"],
      options: [
        { label: "Yes, several people", next: "load.notfixed" },
        { label: "No, just this person", next: "load.wait" },
        { label: "Don't know", next: "load.wait" }
      ],
      otherNext: "load.wait"
    },
    "load.wait": {
      kind: "action", stage: 3, short: "Reopen after a minute", who: "participant-now",
      text: "Have them leave the app (go to the home screen), wait a minute, and open it again.",
      why: "Slow loading can look like a frozen screen. It can clear after a short wait.",
      basis: ["platform"],
      notFixedNext: "load.network", fixedNext: "load.confirm"
    },
    "load.network": {
      kind: "action", stage: 3, short: "Switch networks", who: "participant-now",
      text: "Have them switch networks: from Wi-Fi to mobile data, or the other way.",
      why: "Some workplace or hospital Wi-Fi blocks the app, and a slow network can cause endless loading.",
      basis: ["documented", "staff"],
      notFixedNext: "load.forcequit", fixedNext: "load.confirm"
    },
    "load.forcequit": {
      kind: "action", stage: 3, short: "Swipe away and reopen", who: "participant-now",
      text: "Have them close mindLAMP fully (swipe it away), then open it again.",
      why: "Swiping the app away resets it and deletes no data. Phone data collection stops until they open it again.",
      basis: ["platform", "code"],
      notFixedNext: "load.restart", fixedNext: "load.confirm"
    },
    "load.restart": {
      kind: "action", stage: 3, short: "Restart the phone", who: "participant-now",
      text: "Have them restart the phone, then open mindLAMP.",
      why: "A restart clears many stuck-app problems. Open mindLAMP afterward: phone data collection may not start again until the app is opened.",
      basis: ["common", "staff"],
      notFixedNext: "load.upload", fixedNext: "load.confirm"
    },
    "load.cache": {
      kind: "action", stage: 3, short: "Clear the app cache", who: "participant-later",
      text: "Android: in Settings, open Apps, then mindLAMP, then Storage. Tap Clear cache only.",
      why: "Clearing the cache can fix a stuck app on Android. Data already uploaded is safe.",
      basis: ["documented", "platform"],
      caution: "Tap Clear cache only. Clear storage (or Clear data) resets the app like a reinstall. The effect of Clear cache on data not yet uploaded is unknown.",
      when: { os: "android" }, skip: "load.reinstall",
      notFixedNext: "load.reinstall", fixedNext: "load.confirm"
    },
    "load.upload": {
      kind: "action", stage: 3, short: "Let data upload first", who: "participant-later",
      text: "Have them open mindLAMP on Wi-Fi, with the phone charged, and leave it open for a few minutes.",
      why: "Data the phone hasn't sent yet uploads once the app is open, connected and charged. On Android, uploads stop at 15% battery or lower. Do this before clearing the cache or reinstalling, which can delete it.",
      basis: ["documented", "code"],
      workaroundFor: ["i02"],
      notFixedNext: "load.cache", fixedNext: "load.confirm"
    },
    "load.reinstall": {
      kind: "action", stage: 3, short: "Reinstall the app", who: "participant-later",
      text: "Have them delete mindLAMP, install it again, sign in, and turn each permission back on in Settings.",
      why: "Reinstalling sometimes clears a problem nothing else fixes, but not always. It takes time, their login and sometimes their app store password. If that is too much right now, the web version keeps activities going.",
      basis: ["documented", "staff", "platform"],
      caution: "Try the other fixes first, and let their data upload before this. Reinstalling also turns every permission off. The platform team hasn't yet confirmed it as a recommended fix.",
      dataRisk: true, lastResort: true,
      notFixedNext: "load.notfixed", fixedNext: "load.confirm"
    },
    "load.confirm": {
      kind: "question", stage: 4, short: "Activity shows on dashboard?",
      text: "Have them open the app and do the activity that failed, or any short activity. Does it show on your dashboard?",
      why: "The problem is fixed only when the thing that failed works again.",
      basis: ["platform"],
      checkLater: "Have them open the app and do the activity that failed, or any short activity. Check that it shows on your dashboard.",
      options: [
        { label: "Yes, it shows", next: "load.fixed" },
        { label: "No, same problem", next: "load.notfixed" },
        { label: "Can't check right now", next: "common.unconfirmed" }
      ],
      otherNext: "load.notfixed"
    },
    "load.fixed": {
      kind: "end", ending: "fixed",
      text: "Good. If it comes back, start a new session. Repeats help the platform team find the cause."
    },
    "load.notfixed": {
      kind: "end", ending: "not_fixed",
      text: "Start a new session each time this happens. The app keeps no error details, so these sessions are the only record the platform team has.",
      stopgaps: ["web"],
      collect: ["A screenshot or screen recording", "Where it happened: opening the app, a tab, a game, or after sending",
        "Every time, or once", "The network: home, work, hospital, or abroad", "Whether it is a new install",
        "How many participants see it"]
    },

    /* ===== login: P1 ===== */
    "login.what": {
      kind: "question", stage: 1, short: "What is on screen?",
      text: "What is on the screen when they try to get in?",
      why: "What they see points to the cause. A screenshot helps.",
      basis: ["platform", "documented"],
      options: [
        { label: "The login screen, with their details gone", next: "login.how" },
        { label: "An error after typing their details", next: "login.typo", issueId: null },
        { label: "Spinning or blank after tapping Log in", next: "@wont_load" },
        { label: "A web page in the browser", next: "login.browser", issueId: null },
        { label: "A screen that says Self Help or Try It", next: "login.selfhelp", issueId: null },
        { label: "A list of servers to pick from", next: "login.server", issueId: null }
      ],
      otherNext: "login.typo"
    },
    "login.how": {
      kind: "question", stage: 1, short: "Once or every time?",
      text: "Did this happen once, or does it happen every time they open the app?",
      why: "Being logged out again and again is a known problem. A single logout often has a simple cause, like a password change.",
      basis: ["documented", "staff"],
      options: [
        { label: "Once", next: "login.before" },
        { label: "Every time, or again and again", next: "login.signin2" }
      ],
      otherNext: "login.before"
    },
    "login.before": {
      kind: "question", stage: 2, short: "What happened just before?",
      text: "What happened just before?",
      why: "Updates, password changes, new phones and deleted apps are common causes of a logout.",
      basis: ["platform", "staff", "documented"],
      options: [
        { label: "The app or phone updated", next: "login.update" },
        { label: "Staff reset or changed their password", next: "login.cred" },
        { label: "They got a new phone, or used another device", next: "login.device" },
        { label: "They deleted the app", next: "login.reinst" },
        { label: "They tapped Delete Account in the app", next: "login.delacct" },
        { label: "Nothing they know of", next: "login.signin" }
      ],
      otherNext: "login.signin"
    },
    "login.signin": {
      kind: "action", stage: 3, short: "Sign in again", who: "participant-now",
      text: "Help them sign in again with their study username and password.",
      why: "While logged out, activity reminders and data collection stop. They start again after sign-in.",
      basis: ["documented"],
      notFixedNext: "login.typo", fixedNext: "login.perms"
    },
    "login.signin2": {
      kind: "action", stage: 3, short: "Sign in again", who: "participant-now",
      text: "Help them sign in again with their study username and password.",
      why: "While logged out, activity reminders and data collection stop. They start again after sign-in.",
      basis: ["documented"],
      notFixedNext: "login.typo", fixedNext: "login.recur"
    },
    "login.typo": {
      kind: "action", stage: 3, short: "Retype slowly", who: "participant-now",
      text: "Have them type the username and password again, slowly. Check capital letters, the full username, and that the phone didn't capitalize the first letter.",
      why: "Typing errors are a common cause. Logins are case-sensitive, and phones often capitalize the first letter.",
      basis: ["documented", "staff", "platform"],
      notFixedNext: "login.server", fixedNext: "login.perms"
    },
    "login.server": {
      kind: "action", stage: 3, short: "Check the server", who: "participant-now",
      text: "Check they picked your study's server on the login screen.",
      why: "If your study runs its own server, the app must point to it. The wrong server rejects correct login details.",
      basis: ["documented", "staff"],
      notFixedNext: "login.cred", fixedNext: "login.perms"
    },
    "login.cred": {
      kind: "action", stage: 3, short: "Check or reset login", who: "staff-now",
      text: "In the dashboard, open the participant's login (the key icon) and check it exists. If needed, reset the password and send the new one.",
      why: "A login that staff changed or deleted stops working. Resetting the password gives them one you know works. It signs them out on any other device.",
      basis: ["documented", "platform"],
      notFixedNext: "login.update", fixedNext: "login.perms"
    },
    "login.device": {
      kind: "action", stage: 3, short: "Use the study phone", who: "participant-now",
      text: "Have them sign in on the phone they use for the study. If they changed phones, set up the new one like a new participant.",
      why: "Data and activity reminders come only from the device they're signed in on. People sometimes end up signed in on an iPad or a family member's phone.",
      basis: ["staff", "platform"],
      notFixedNext: "login.typo", fixedNext: "login.perms"
    },
    "login.reinst": {
      kind: "action", stage: 3, short: "Install and sign in", who: "participant-now",
      text: "Have them install mindLAMP from the app store and sign in.",
      why: "Deleting the app signs them out. Collection starts again only after they sign in.",
      basis: ["documented", "common"],
      notFixedNext: "login.typo", fixedNext: "login.perms"
    },
    "login.update": {
      kind: "action", stage: 3, short: "Update the app", who: "participant-now",
      text: "Check the app store. If mindLAMP shows an update, install it.",
      why: "An out-of-date app can fail to sign in.",
      basis: ["common", "platform"],
      notFixedNext: "login.upload", fixedNext: "login.perms"
    },
    "login.upload": {
      kind: "action", stage: 3, short: "Let data upload first", who: "participant-later",
      text: "If they can still open the app, have them open it on Wi-Fi, with the phone charged, and leave it open for a few minutes.",
      why: "Data the phone hasn't sent yet uploads once the app is open and connected. Do this before reinstalling, which deletes it.",
      basis: ["documented", "code"],
      notFixedNext: "login.reinstall", fixedNext: "login.perms"
    },
    "login.reinstall": {
      kind: "action", stage: 3, short: "Reinstall the app", who: "participant-later",
      text: "Only if the app is an old version that won't update or won't open: have them delete mindLAMP, install it again, and sign in.",
      why: "Reinstalling replaces an old or broken copy of the app with the current one.",
      basis: ["staff", "documented"],
      caution: "Try Update the app first. Reinstalling also turns every permission off. The platform team hasn't yet confirmed it as a recommended fix.",
      dataRisk: true, lastResort: true,
      notFixedNext: "login.notfixed", fixedNext: "login.perms"
    },
    "login.perms": {
      kind: "info", stage: 4, short: "Recheck permissions",
      text: "After they sign in, check each permission in the phone's Settings: notifications, location (set to Always), and health access if your study uses them. If they turned one off on purpose, talk it through before switching it back.",
      why: "A permission that is off stops activity reminders or that kind of data.",
      basis: ["staff", "documented"],
      next: "login.confirm"
    },
    "login.confirm": {
      kind: "question", stage: 4, short: "Activity reaches dashboard?",
      text: "Have them finish a short activity. Does it show on your dashboard within a few minutes?",
      why: "Activities appear on the dashboard right after they are sent. This shows the login works.",
      basis: ["platform", "documented"],
      checkLater: "Have them finish a short activity. Check that it shows on your dashboard within a few minutes.",
      options: [
        { label: "Yes, it shows", next: "login.fixed" },
        { label: "No", next: "@not_done" },
        { label: "Can't check right now", next: "common.unconfirmed" }
      ],
      otherNext: "common.unconfirmed"
    },
    "login.fixed": {
      kind: "end", ending: "fixed",
      text: "Good. Check that Last Active updates on the Users tab. No phone data was collected while they were logged out."
    },
    "login.recur": {
      kind: "end", ending: "no_fix_yet", issueId: "i01",
      text: "Repeated logouts are a known problem that staff can't fix yet. Help them sign in each time. Activity reminders and phone data stop from each logout until they sign in again. If signing in again and again is wearing them down, tell your study lead.",
      stopgaps: ["web"]
    },
    "login.delacct": {
      kind: "end", ending: "not_fixed",
      text: "Delete Account in the app can't be undone. The platform team needs to know when it happened.",
      collect: ["When they tapped it", "Your server"]
    },
    "login.notfixed": {
      kind: "end", ending: "not_fixed",
      text: "Note in your study records that phone data stopped at the logout.",
      stopgaps: ["web"],
      collect: ["What is on the screen, and any error text", "When it started", "Whether the app or phone updated just before",
        "The username format (not the username itself)", "Whether staff changed the login", "Your server"]
    },
    "login.browser": {
      kind: "action", stage: 3, short: "Open the app itself", who: "participant-now",
      text: "Have them open the mindLAMP app itself, not the link or QR code, and sign in there.",
      why: "A QR code or link can open the web version instead of the app. The web version collects no phone data.",
      basis: ["platform", "documented"],
      notFixedNext: "login.typo", fixedNext: "login.perms"
    },
    "login.selfhelp": {
      kind: "action", stage: 3, short: "Leave Self Help", who: "participant-now",
      text: "Have them leave Self Help or Try It, go back, and sign in with their study username and password.",
      why: "Self Help and Try It are not linked to your study. Nothing done there reaches your dashboard.",
      basis: ["platform", "documented"],
      notFixedNext: "login.typo", fixedNext: "login.perms"
    },

    /* ===== reminders: P2 ===== */
    "rem.what": {
      kind: "question", stage: 1, short: "What happens?",
      text: "What happens with the activity reminders?",
      why: "Each pattern has different causes. Missing or silent reminders are often a phone setting.",
      basis: ["staff"],
      options: [
        { label: "None arrive", next: "rem.scope" },
        { label: "They arrive, but make no sound", next: "rem.sound" },
        { label: "They come at the wrong time", next: "rem.wrongtime", issueId: "i04" },
        { label: "They come twice, or keep repeating", next: "rem.timing", issueId: "i04" },
        { label: "A number on the app icon won't go away", next: "rem.badge", issueId: "i06" },
        { label: "Tapping the reminder opens a blank or wrong page", next: "rem.tap" },
        { label: "They want a different time", next: "rem.reschedule", issueId: null }
      ],
      otherNext: "rem.scope"
    },
    "rem.scope": {
      kind: "question", stage: 1, short: "One person or everyone?",
      text: "Is it just this person, or everyone in the study?",
      why: "If no one gets activity reminders, the cause is likely the study's setup or the server, not the phone. A single broken activity can stop activity reminders for a whole study.",
      basis: ["platform", "documented"],
      options: [
        { label: "Just this person, or a few", next: "rem.loggedin" },
        { label: "Everyone, or most people", next: "rem.gateway" },
        { label: "Not sure", next: "rem.loggedin" }
      ],
      otherNext: "rem.loggedin"
    },
    "rem.gateway": {
      kind: "action", stage: 3, short: "Check server reminder setup", who: "platform",
      text: "Ask whoever runs your server to check that activity reminders are set up to reach phones.",
      why: "On your own server, activity reminders need extra server setup to reach phones.",
      basis: ["documented"],
      when: { ownServer: true }, skip: "rem.all",
      notFixedNext: "rem.all", fixedNext: "rem.confirm"
    },
    "rem.all": {
      kind: "end", ending: "not_fixed",
      text: "When no one gets activity reminders, the cause is likely the study's setup or the server, not the phones. Give participants a backup reminder meanwhile.",
      stopgaps: ["alarm"],
      collect: ["When activity reminders stopped", "Which activities", "Any recent change to activities or schedules", "Your server"]
    },
    "rem.loggedin": {
      kind: "question", stage: 2, short: "Still signed in?",
      text: "Are they still signed in to mindLAMP?",
      why: "When someone is logged out, activity reminders stop.",
      basis: ["documented"],
      options: [
        { label: "Yes", next: "rem.update" },
        { label: "No, they see the login screen", next: "@login" },
        { label: "Not sure", next: "rem.update" }
      ],
      otherNext: "rem.update"
    },
    "rem.update": {
      kind: "info", stage: 2, short: "Android: phone updated?",
      text: "Android: ask whether the phone updated recently, and add it as a note.",
      why: "Activity reminders can stop after an Android update. Note whether it updated: it helps find the cause.",
      basis: ["platform"],
      when: { os: "android" }, skip: "rem.notif",
      next: "rem.notif"
    },
    "rem.notif": {
      kind: "action", stage: 3, short: "Turn on notifications", who: "participant-now",
      text: "In the phone's Settings, open Notifications, find mindLAMP, and turn notifications on, with sound.",
      why: "Notifications for mindLAMP are sometimes switched off in the phone's Settings, which stops activity reminders.",
      basis: ["staff"],
      notFixedNext: "rem.focus", fixedNext: "rem.confirm"
    },
    "rem.sound": {
      kind: "action", stage: 3, short: "Check alert sound", who: "participant-now",
      text: "Check the ringer and notification volume, and mindLAMP's alert sound. Check whether sound goes to hearing aids or headphones.",
      why: "Activity reminders can arrive silently when sound is off or goes to Bluetooth hearing aids or headphones.",
      basis: ["staff"],
      notFixedNext: "rem.focus", fixedNext: "rem.confirm"
    },
    "rem.focus": {
      kind: "action", stage: 3, short: "Check Do Not Disturb", who: "participant-now",
      text: "Check Do Not Disturb, Focus and sleep schedules. Let mindLAMP through, or change the hours so they don't cover activity times.",
      why: "Do Not Disturb, Focus and sleep schedules often silence activity reminders.",
      basis: ["staff"],
      notFixedNext: "rem.battery", fixedNext: "rem.confirm"
    },
    "rem.battery": {
      kind: "action", stage: 3, short: "Turn off battery limits", who: "participant-now",
      text: "Android: turn off Battery Saver. Set mindLAMP's battery use to Unrestricted or Don't optimize. This uses more battery: if battery life already worries them, leave Battery Saver on and set a phone alarm for activity times instead.",
      why: "Android can hold back apps to save battery. That delays or drops activity reminders.",
      basis: ["documented", "staff"],
      when: { os: "android" }, skip: "rem.connect",
      notFixedNext: "rem.connect", fixedNext: "rem.confirm"
    },
    "rem.connect": {
      kind: "action", stage: 3, short: "Check connection", who: "participant-now",
      text: "Check the phone has a connection: Wi-Fi, or mobile data turned on.",
      why: "A phone with no connection can miss activity reminders.",
      basis: ["staff"],
      notFixedNext: "rem.restart", fixedNext: "rem.confirm"
    },
    "rem.restart": {
      kind: "action", stage: 3, short: "Restart the phone", who: "participant-now",
      text: "Have them restart the phone.",
      why: "A restart can help when every setting looks right but activity reminders still don't come.",
      basis: ["staff", "common"],
      notFixedNext: "rem.notfixed", fixedNext: "rem.confirm"
    },
    "rem.reschedule": {
      kind: "action", stage: 3, short: "Change the schedule", who: "staff-now",
      text: "With your study lead's OK, change the activity's schedule in the dashboard.",
      why: "Schedules are set per group, not per person, so a new time applies to everyone in the group.",
      basis: ["platform", "documented"],
      notFixedNext: "rem.notfixed"
    },
    "rem.confirm": {
      kind: "question", stage: 4, short: "Next reminder arrived?",
      text: "Did the next activity reminder arrive, with sound, and open the right activity?",
      why: "A changed setting only shows it worked at the next activity reminder, so this is often answered after the call.",
      basis: ["staff"],
      checkLater: "At the next activity reminder, check with them that it arrived, with sound, and opened the right activity.",
      options: [
        { label: "Yes, it arrived and worked", next: "rem.fixed" },
        { label: "No", next: "rem.notfixed" },
        { label: "Done for now, check at the next reminder", next: "common.unconfirmed" }
      ],
      otherNext: "rem.notfixed"
    },
    "rem.fixed": {
      kind: "end", ending: "fixed",
      text: "Good. If activity reminders stop again, start a new session."
    },
    "rem.notfixed": {
      kind: "end", ending: "not_fixed",
      text: "Give the person a backup in the meantime.",
      stopgaps: ["alarm", "unhide"],
      collect: ["Which pattern: none, silent, wrong time, or repeating",
        "Times expected and times received (a screenshot of a notification helps)", "Phone maker and OS version",
        "Whether Focus or Do Not Disturb was on", "Whether the phone or app updated just before",
        "Everyone in the study, or one person", "Your server"]
    },
    "rem.wrongtime": {
      kind: "end", ending: "not_fixed", issueId: "i04",
      text: "Wrong times can follow travel, a clock change, a phone update, or a change to the activity's schedule. Note the times expected and received, and what changed.",
      collect: ["Times expected and times received (a screenshot of a notification helps)",
        "Whether the phone updated just before", "Whether they traveled, or the clocks changed (time zone or daylight saving)",
        "Everyone in the study, or one person", "Phone maker and OS version", "Your server"],
      stopgaps: ["alarm"]
    },
    "rem.timing": {
      kind: "end", ending: "no_fix_yet", issueId: "i04",
      text: "Repeated or double activity reminders are a known problem that staff can't fix yet.",
      stopgaps: ["one_counts"]
    },
    "rem.badge": {
      kind: "end", ending: "no_fix_yet", issueId: "i06",
      text: "This is a known problem. Check the dashboard. If the activity shows there, it is done, and they can ignore the number."
    },
    "rem.tap": {
      kind: "end", ending: "new_problem", issueId: null,
      text: "Tapping an activity reminder can open a blank or wrong page. The platform team knows about it. Note what opens below.",
      stopgaps: ["unhide"]
    },

    /* ===== not_done: P4 ===== */
    "done.where": {
      kind: "question", stage: 1, short: "Why do they think so?",
      text: "What makes them, or you, think it isn't done?",
      why: "Check the dashboard to answer their question. If the activity is there, only the checkmark or streak is wrong.",
      basis: ["staff"],
      options: [
        { label: "No checkmark, or the streak reset", next: "done.check" },
        { label: "They saw an error or a white screen after answering", next: "done.error" },
        { label: "They closed it or got interrupted before the end", next: "done.partial" },
        { label: "You see it missing on the dashboard", next: "done.lastscreen" },
        { label: "It's missing from your study's own report or records", next: "done.idmap", issueId: null }
      ],
      otherNext: "done.check"
    },
    "done.check": {
      kind: "question", stage: 1, short: "On the dashboard?",
      text: "Does the activity show on your dashboard?",
      why: "Activities appear on the dashboard right after they are sent. The dashboard is the record that counts.",
      basis: ["platform"],
      options: [
        { label: "Yes, it's there", next: "done.reassure", issueId: null },
        { label: "No", next: "done.lastscreen" }
      ],
      otherNext: "done.lastscreen"
    },
    "done.reassure": {
      kind: "action", stage: 3, short: "Tell them it counted", who: "staff-now",
      text: "Tell them it was saved, even if the phone doesn't show it.",
      why: "The checkmark or streak on the phone can be wrong even when the activity was saved.",
      basis: ["staff"],
      notFixedNext: "done.notfixed"
    },
    "done.lastscreen": {
      kind: "question", stage: 1, short: "Last screen after answering?",
      text: "What was the last screen they saw after answering?",
      why: "An error means it may not have saved. Closing before the end means the answers were never sent.",
      basis: ["documented", "platform"],
      options: [
        { label: "A confirmation", next: "done.when" },
        { label: "An error, or a white screen", next: "done.error" },
        { label: "They closed it before the end", next: "done.partial" },
        { label: "They don't remember", next: "done.when" }
      ],
      otherNext: "done.when"
    },
    "done.when": {
      kind: "question", stage: 2, short: "When and where?",
      text: "When and where did they do it?",
      why: "After midnight, it counts toward the next day. Offline, answers wait on the phone. On another device, they don't reach this person's record.",
      basis: ["documented", "staff"],
      options: [
        { label: "After midnight", next: "done.midnight", issueId: null },
        { label: "Offline, with no connection", next: "done.offline" },
        { label: "On another device, the web, or in Self Help", next: "done.device" },
        { label: "On their phone, at the usual time", next: "done.submit" }
      ],
      otherNext: "done.submit"
    },
    "done.midnight": {
      kind: "action", stage: 3, short: "Explain the midnight cutoff", who: "staff-now",
      text: "Explain that activities done after midnight count toward the next day.",
      why: "An activity done after midnight shows on the next day, so the day before looks missed.",
      basis: ["documented", "staff"],
      notFixedNext: "done.submit"
    },
    "done.offline": {
      kind: "action", stage: 3, short: "Open on Wi-Fi", who: "participant-later",
      text: "Have them open mindLAMP on Wi-Fi and leave it open for a few minutes.",
      why: "Answers given offline are kept on the phone and sent once there is a connection.",
      basis: ["documented"],
      notFixedNext: "done.submit", fixedNext: "done.confirm"
    },
    "done.device": {
      kind: "action", stage: 3, short: "Use the study phone", who: "participant-now",
      text: "Have them use the app on their study phone, signed in with their study login.",
      why: "Answers given on another device or in Self Help don't reach this person's record.",
      basis: ["platform", "staff"],
      notFixedNext: "done.submit", fixedNext: "done.confirm"
    },
    "done.partial": {
      kind: "action", stage: 3, short: "Finish and submit", who: "participant-now",
      text: "Have them open the activity again and finish it. Tap Submit and wait for the confirmation.",
      why: "Progress is kept on the phone, so they can resume or start over. Partial answers are never sent.",
      basis: ["documented"],
      notFixedNext: "done.wifi", fixedNext: "done.confirm"
    },
    "done.submit": {
      kind: "action", stage: 3, short: "Show how to submit", who: "participant-now",
      text: "Show them how to tap Submit and wait for the confirmation screen.",
      why: "Answers are sent only after Submit. Leaving before the confirmation screen can lose them.",
      basis: ["staff"],
      notFixedNext: "done.wifi", fixedNext: "done.confirm"
    },
    "done.wifi": {
      kind: "action", stage: 3, short: "Try again on Wi-Fi", who: "participant-now",
      text: "Have them try the activity again on Wi-Fi.",
      why: "A weak connection can make sending fail.",
      basis: ["staff"],
      notFixedNext: "done.notfixed", fixedNext: "done.confirm"
    },
    "done.error": {
      kind: "info", stage: 3, short: "Stop repeating it",
      text: "Ask them not to keep repeating the activity. Write down the exact error text and the time.",
      why: "The exact error text and the time are the main clues to the cause.",
      basis: ["platform"],
      next: "done.notfixed"
    },
    "done.idmap": {
      kind: "action", stage: 2, short: "Check study ID records", who: "staff-now",
      text: "Check that the mindLAMP ID in your study records matches the account in the dashboard. Check your report ran.",
      why: "Data missing from a study report may be in mindLAMP all along, under an ID your records have wrong, or the report may not have run.",
      basis: ["staff"],
      notFixedNext: "done.lastscreen"
    },
    "done.confirm": {
      kind: "question", stage: 4, short: "On the dashboard now?",
      text: "Does the activity now show on your dashboard?",
      why: "Activities appear on the dashboard within minutes of being sent. Check there, not only on the phone.",
      basis: ["platform"],
      checkLater: "Check that the entry shows on your dashboard.",
      options: [
        { label: "Yes", next: "done.fixed" },
        { label: "No", next: "done.notfixed" },
        { label: "Can't check right now", next: "common.unconfirmed" }
      ],
      otherNext: "done.notfixed"
    },
    "done.fixed": {
      kind: "end", ending: "fixed",
      text: "Good. The activity is recorded."
    },
    "done.notfixed": {
      kind: "end", ending: "not_fixed",
      stopgaps: ["web"],
      collect: ["Which activity", "The time they did it", "The last screen they saw", "Any error text, word for word",
        "Whether it happens once or every time", "Your server"]
    },

    /* ===== find_activity: P3 ===== */
    "find.what": {
      kind: "question", stage: 1, short: "What do they see?",
      text: "What do they see where the activity should be?",
      why: "This tells you whether the activity is hidden, closed for now, or not on the phone yet.",
      basis: ["documented", "platform"],
      options: [
        { label: "Nothing. They missed or dismissed the reminder", next: "find.reminderonly" },
        { label: "The card is there but won't open", next: "find.window" },
        { label: "The Feed or a tab is empty", next: "find.schedule" },
        { label: "A new or changed activity isn't there", next: "find.refresh" }
      ],
      otherNext: "find.window"
    },
    "find.reminderonly": {
      kind: "question", stage: 2, short: "Reminder-only activity?",
      text: "Does your study show this activity only through its reminder?",
      why: "If an activity is hidden from the tabs, a missed or dismissed reminder leaves no way to open it.",
      basis: ["platform"],
      when: { reminderOnly: true }, skip: "find.tab",
      options: [
        { label: "Yes, only through the reminder", next: "find.hidden", issueId: "i13" },
        { label: "No, it is also in a tab", next: "find.tab" },
        { label: "Not sure", next: "find.tab" }
      ],
      otherNext: "find.tab"
    },
    "find.hidden": {
      kind: "end", ending: "no_fix_yet", issueId: "i13",
      text: "A dismissed activity reminder can't be brought back, and the activity has no other way in.",
      stopgaps: ["unhide"]
    },
    "find.tab": {
      kind: "action", stage: 3, short: "Show the activity's tab", who: "participant-now",
      text: "Show them which tab the activity is in: Assess, Learn or Manage.",
      why: "Activities that aren't hidden can also be opened from their tab, not only from the reminder.",
      basis: ["staff"],
      notFixedNext: "find.window", fixedNext: "find.confirm"
    },
    "find.window": {
      kind: "question", stage: 2, short: "Outside its time?",
      text: "Is it before the activity's start time, or after midnight?",
      why: "Feed cards open at their scheduled time and close at midnight. Some close sooner, at their next time slot.",
      basis: ["documented", "staff"],
      options: [
        { label: "Yes, outside its time", next: "find.explain", issueId: "i14" },
        { label: "No, it should be open now", next: "find.refresh" },
        { label: "Not sure", next: "find.refresh" }
      ],
      otherNext: "find.refresh"
    },
    "find.explain": {
      kind: "action", stage: 3, short: "Explain when it opens", who: "staff-now",
      text: "Explain when the activity opens and closes. Have them try again inside that time.",
      why: "Activities open only inside their time window, and people often try too early or too late.",
      basis: ["documented", "staff"],
      notFixedNext: "find.refresh", fixedNext: "find.confirm"
    },
    "find.schedule": {
      kind: "action", stage: 3, short: "Check schedule and group", who: "staff-now",
      text: "In the dashboard, check the activity has a schedule and is in this person's group. Clear any filters.",
      why: "An empty Feed often means no schedule, the wrong group, or a staff filter hiding activities.",
      basis: ["documented", "platform"],
      notFixedNext: "find.refresh", fixedNext: "find.confirm"
    },
    "find.refresh": {
      kind: "action", stage: 3, short: "Swipe away and reopen", who: "participant-now",
      text: "Have them close mindLAMP fully (swipe it away), then open it again.",
      why: "Swiping the app away and reopening it deletes no data. Phone data collection stops until they open it again.",
      basis: ["code"],
      notFixedNext: "find.upload", fixedNext: "find.confirm"
    },
    "find.upload": {
      kind: "action", stage: 3, short: "Let data upload first", who: "participant-later",
      text: "Have them open mindLAMP on Wi-Fi, with the phone charged, and leave it open for a few minutes.",
      why: "Data the phone hasn't sent yet uploads once the app is open, connected and charged. On Android, uploads stop at 15% battery or lower. Do this before signing out, which deletes it.",
      basis: ["documented", "code"],
      notFixedNext: "find.signout", fixedNext: "find.confirm"
    },
    "find.signout": {
      kind: "action", stage: 3, short: "Sign out and in", who: "participant-later",
      text: "Have them sign out of mindLAMP, then sign back in. If they only need this one activity, doing it on the web avoids signing out.",
      why: "New or changed activities sometimes appear only after signing out and back in.",
      basis: ["platform", "documented"],
      caution: "Try the other fixes first, and let their data upload before this. The platform team hasn't yet confirmed signing out as a recommended fix.",
      dataRisk: true, lastResort: true,
      notFixedNext: "find.notfixed", fixedNext: "find.confirm"
    },
    "find.confirm": {
      kind: "question", stage: 4, short: "Sent and on the dashboard?",
      text: "Have them open the activity and send it. Does it show on your dashboard?",
      why: "Activities appear on the dashboard right after they are sent.",
      basis: ["platform"],
      checkLater: "Have them open the activity and send it. Check that it shows on your dashboard.",
      options: [
        { label: "Yes", next: "find.fixed" },
        { label: "No, it isn't there", next: "@not_done" },
        { label: "Can't check right now", next: "common.unconfirmed" }
      ],
      otherNext: "find.notfixed"
    },
    "find.fixed": {
      kind: "end", ending: "fixed",
      text: "Good. They can do the activity now."
    },
    "find.notfixed": {
      kind: "end", ending: "not_fixed",
      text: "If the activity is assigned and inside its time but still won't open, the platform team needs to look.",
      stopgaps: ["web"],
      collect: ["The activity name", "Where they looked", "What time they tried", "A screenshot",
        "Whether the activity is hidden from tabs"]
    },

    /* ===== activity_wrong: P6 ===== */
    "act.what": {
      kind: "question", stage: 1, short: "What looks wrong?",
      text: "What looks wrong? Ask for a screenshot if they can.",
      why: "Each problem has a different cause. A screenshot and the phone model help most.",
      basis: ["platform"],
      options: [
        { label: "Part of a game or question is cut off the screen", next: "act.cut", issueId: "i20" },
        { label: "Answer choices show numbers instead of words", next: "act.numbers", issueId: "i18" },
        { label: "The slider won't go to the top", next: "act.slider", issueId: "i07" },
        { label: "Text is too small", next: "act.small", issueId: "i17" },
        { label: "Stuck after a voice recording", next: "act.upload", issueId: "i22" },
        { label: "Audio won't record, play or upload", next: "act.audio", issueId: "i22" },
        { label: "Can't see all the answer choices", next: "act.scroll", issueId: null },
        { label: "Taps don't register, the game is too fast, or a pop-up won't close", next: "act.scope", issueId: null }
      ],
      otherNext: "act.scope"
    },
    "act.cut": {
      kind: "action", stage: 3, short: "Scroll or zoom out", who: "participant-now",
      text: "Have them scroll, or zoom out, to see the missing part.",
      why: "Some activities don't fit some screen sizes. Scrolling or zooming out can bring the missing part into view.",
      basis: ["platform"],
      notFixedNext: "act.cutend", fixedNext: "act.confirm"
    },
    "act.cutend": {
      kind: "end", ending: "no_fix_yet", issueId: "i20",
      text: "Activities cut off on some screen sizes are a known problem that staff can't fix yet. Note the phone model. If it frustrates them enough to think about leaving, tell your study lead."
    },
    "act.numbers": {
      kind: "question", stage: 1, short: "Signed out, or only closed?",
      text: "Did they sign out and back in recently, or only close the app?",
      why: "Signing out and back in loads a fresh copy of the activity. If numbers still show after that, the wording is missing from the activity itself.",
      basis: ["platform"],
      options: [
        { label: "Only closed the app, or neither", next: "act.forcequit" },
        { label: "They signed out and back in, and still see numbers", next: "act.wording" },
        { label: "Not sure", next: "act.forcequit" }
      ],
      otherNext: "act.forcequit"
    },
    "act.forcequit": {
      kind: "action", stage: 3, short: "Swipe away and reopen", who: "participant-now",
      text: "Have them close mindLAMP fully (swipe it away), then open it again.",
      why: "Swiping the app away and reopening it deletes no data. Phone data collection stops until they open it again.",
      basis: ["code"],
      notFixedNext: "act.wording", fixedNext: "act.confirm"
    },
    "act.wording": {
      kind: "action", stage: 3, short: "Restore answer wording", who: "staff-now",
      text: "In the dashboard, open the activity and check every answer choice has its wording. Re-enter any that are missing.",
      why: "Answer wording was overwritten in some activities during a server outage, and some may still be missing it. Missing wording shows as numbers on the phone.",
      basis: ["platform"],
      workaroundFor: ["i18"],
      notFixedNext: "act.numend", fixedNext: "act.confirm"
    },
    "act.numend": {
      kind: "end", ending: "not_fixed", issueId: "i18",
      text: "Your team decides what to do with answers given while the wording was missing.",
      collect: ["Which activity", "When the activity was added or changed", "A screenshot", "Every participant, or one"]
    },
    "act.slider": {
      kind: "action", stage: 3, short: "Tap first, then drag", who: "participant-later",
      text: "Have them tap a different value first, then drag the slider all the way to the end.",
      why: "Tapping another value first, then dragging all the way to the end, can make the top value register.",
      basis: ["staff"],
      workaroundFor: ["i07"],
      notFixedNext: "act.sliderend", fixedNext: "act.confirm"
    },
    "act.sliderend": {
      kind: "end", ending: "no_fix_yet", issueId: "i07",
      text: "This is a known problem that staff can't fix yet. Note in your study records which answer they meant to give."
    },
    "act.small": {
      kind: "action", stage: 3, short: "Make the text larger", who: "staff-now",
      text: "Ask your study lead about making the question text larger with formatting (Markdown) in the activity's wording. It changes the text for everyone.",
      why: "The app ignores the phone's text size setting, but formatting in the question text can make it larger.",
      basis: ["staff", "platform"],
      workaroundFor: ["i17"],
      notFixedNext: "act.smallend"
    },
    "act.smallend": {
      kind: "end", ending: "no_fix_yet", issueId: "i17",
      text: "This is a known problem. There is no text size setting in the app yet."
    },
    "act.upload": {
      kind: "action", stage: 3, short: "Tap Upload to continue", who: "participant-now",
      text: "Show them the Upload button. Tapping it finishes the recording and moves on.",
      why: "It's easy to miss that Upload is how to move on after recording.",
      basis: ["platform"],
      workaroundFor: ["i22"],
      notFixedNext: "act.audio", fixedNext: "act.confirm"
    },
    "act.audio": {
      kind: "end", ending: "not_fixed", issueId: "i22",
      collect: ["How long the recording was", "Which step failed: opening, recording, playing, or uploading", "Phone model"]
    },
    "act.scroll": {
      kind: "action", stage: 3, short: "Scroll down", who: "participant-now",
      text: "Have them scroll down. More choices may be below.",
      why: "Nothing on screen shows that a list continues below, so choices can be hidden.",
      basis: ["platform"],
      notFixedNext: "act.scope", fixedNext: "act.confirm"
    },
    "act.scope": {
      kind: "question", stage: 1, short: "Everyone or one phone?",
      text: "Is it every participant on this activity, or just this person?",
      why: "If everyone sees it, the activity or its setup is the likely cause.",
      basis: ["platform"],
      options: [
        { label: "Everyone, or several people", next: "act.notfixed" },
        { label: "Just this person", next: "act.fq2" },
        { label: "Not sure", next: "act.fq2" }
      ],
      otherNext: "act.fq2"
    },
    "act.fq2": {
      kind: "action", stage: 3, short: "Swipe away and reopen", who: "participant-now",
      text: "Have them close mindLAMP fully (swipe it away), then open it again.",
      why: "Swiping the app away resets it and deletes no data. Phone data collection stops until they open it again.",
      basis: ["platform", "code"],
      notFixedNext: "act.notfixed", fixedNext: "act.confirm"
    },
    "act.confirm": {
      kind: "question", stage: 4, short: "Looks right now?",
      text: "Does it look right now? Do the answers on your dashboard look right?",
      why: "Check both the screen and the recorded answers.",
      basis: ["platform"],
      checkLater: "Check that it looks right on the phone, and that the answers on your dashboard look right.",
      options: [
        { label: "Yes", next: "act.fixed" },
        { label: "No", next: "act.notfixed" },
        { label: "Can't check right now", next: "common.unconfirmed" }
      ],
      otherNext: "act.notfixed"
    },
    "act.fixed": {
      kind: "end", ending: "fixed",
      text: "Good. If it comes back, start a new session."
    },
    "act.notfixed": {
      kind: "end", ending: "not_fixed",
      text: "If it happens again, start a new session each time, with a screenshot.",
      collect: ["A screenshot", "Which activity", "Phone or tablet model and screen size", "Every participant on this activity, or one"]
    },

    /* ===== question: P9 ===== */
    "q.what": {
      kind: "question", stage: 1, short: "What are they unsure about?",
      text: "What are they unsure about?",
      why: "Most questions have a short answer, and explaining resolves many calls.",
      basis: ["staff"],
      options: [
        { label: "Whether the app must stay open, or if they can close it", next: "q.open" },
        { label: "A notification, activity reminder, or number on the icon", next: "q.notif" },
        { label: "Why a permission is asked", next: "q.perm" },
        { label: "How much mobile data it uses", next: "q.data" },
        { label: "Who sees their data", next: "q.privacy" },
        { label: "Whether it is working", next: "q.working" }
      ],
      otherNext: "@other"
    },
    "q.open": {
      kind: "action", stage: 3, short: "Explain closing the app", who: "staff-now",
      text: "Explain: leaving the app (going to the home screen) is fine. Swiping it away stops phone data collection until they open it again.",
      why: "Many people think going to the home screen and swiping the app away are the same.",
      basis: ["documented", "staff"],
      notFixedNext: "q.demo"
    },
    "q.notif": {
      kind: "action", stage: 3, short: "Explain notifications", who: "staff-now",
      text: "Ask which notification. Activity reminders mean an activity is ready. If a number on the app icon stays after they finish, check the dashboard: if the activity is there, it's done.",
      why: "Activity reminders, pop-ups and the number on the app icon are common sources of questions.",
      basis: ["staff"],
      notFixedNext: "q.demo"
    },
    "q.perm": {
      kind: "action", stage: 3, short: "Explain permissions", who: "staff-now",
      text: "Explain what each permission is for: location for GPS, notifications for activity reminders, health for steps, sleep and heart rate. If they don't want to give one, ask your study lead whether the study can do without it, rather than risk them leaving.",
      why: "Your study collects only the phone data it has set up.",
      basis: ["documented", "platform"],
      notFixedNext: "q.demo"
    },
    "q.data": {
      kind: "action", stage: 3, short: "Explain mobile data use", who: "staff-now",
      text: "Explain that any Wi-Fi works, and mobile data use is small. If the cost really worries them, Wi-Fi only is better than them leaving the study. Expect some gaps, especially on Android.",
      why: "If they turn off mobile data for mindLAMP, data uploads only on Wi-Fi.",
      basis: ["documented", "platform"],
      notFixedNext: "q.demo"
    },
    "q.privacy": {
      kind: "action", stage: 3, short: "Explain who sees data", who: "staff-now",
      text: "Explain who sees their data, using your study's consent form.",
      why: "The answer depends on your study, so use its consent form.",
      basis: ["documented", "platform"],
      notFixedNext: "q.demo"
    },
    "q.working": {
      kind: "action", stage: 3, short: "Check the Users tab", who: "staff-now",
      text: "Check the Users tab. If Last Active and Last Passive are green, tell them it's working.",
      why: "Green means data arrived in the last 2 days, yellow within a week. A stop in the last day or two may not show yet.",
      basis: ["documented"],
      notFixedNext: "@data_missing"
    },
    "q.demo": {
      kind: "action", stage: 3, short: "Offer demo or handout", who: "staff-now",
      text: "Offer a short demo video or a printed sheet, if your team has one.",
      why: "Some people need to see it, not just hear it.",
      basis: ["platform"],
      notFixedNext: "q.notfixed"
    },
    "q.notfixed": {
      kind: "end", ending: "not_fixed",
      text: "If the question points to a problem, start a new session on that problem.",
      collect: ["The question, in a few words"]
    },

    /* ===== battery: P8 ===== */
    "batt.what": {
      kind: "question", stage: 1, short: "Battery, data or storage?",
      text: "What is the worry: battery, mobile data, or phone storage?",
      why: "Each has different causes and fixes.",
      basis: ["staff"],
      options: [
        { label: "The battery drains faster", next: "batt.charge" },
        { label: "It uses mobile data", next: "batt.data", issueId: null },
        { label: "Phone storage is full", next: "batt.storage", issueId: null }
      ],
      otherNext: "batt.charge"
    },
    "batt.charge": {
      kind: "info", stage: 1, short: "How much does mindLAMP use?",
      text: "Ask how often they charge now compared with before, and how old the phone is. In Settings, Battery, note how much mindLAMP uses. Add these as a note.",
      why: "This shows how much of the drain is mindLAMP. Older batteries drain faster with any app.",
      basis: ["staff", "documented", "common"],
      next: "batt.rate"
    },
    "batt.rate": {
      kind: "info", stage: 3, short: "Lower sensor rates",
      text: "Your study lead can decide to lower sensor rates. This changes data for everyone in their group. A lower GPS rate may save little battery.",
      why: "Higher sensor rates use more battery, but lowering the GPS rate has saved less than expected.",
      basis: ["documented", "platform"],
      when: { passive: true }, skip: "batt.end",
      next: "batt.end"
    },
    "batt.end": {
      kind: "end", ending: "no_fix_yet", issueId: "i10",
      text: "",
      stopgaps: ["charger", "low_power"]
    },
    "batt.data": {
      kind: "action", stage: 3, short: "Explain data use", who: "staff-now",
      text: "Explain that any Wi-Fi works, and mindLAMP uses little mobile data. If they still worry, they can turn off mobile data for mindLAMP in Settings. Data then waits for Wi-Fi, so they should connect to Wi-Fi often.",
      why: "Data is kept on the phone and uploads when connected.",
      basis: ["documented", "platform"],
      notFixedNext: "batt.notfixed"
    },
    "batt.storage": {
      kind: "action", stage: 3, short: "Free up storage", who: "participant-later",
      text: "Have them free up space on the phone: delete unused apps, photos or videos.",
      why: "When storage is full, data may not upload. Freeing space can let it upload again.",
      basis: ["staff"],
      notFixedNext: "batt.notfixed", fixedNext: "batt.storeconfirm"
    },
    "batt.storeconfirm": {
      kind: "question", stage: 4, short: "Data arriving again?",
      text: "The next day, on the Users tab, hover over Last Passive. Has new data arrived since they cleared space?",
      why: "Data waiting on the phone can upload once there is space.",
      basis: ["staff"],
      checkLater: "Tomorrow, hover over Last Passive on the Users tab. New data should have arrived since they cleared space.",
      options: [
        { label: "Yes, it's arriving", next: "batt.fixed" },
        { label: "No", next: "batt.notfixed" },
        { label: "Done for now, check tomorrow", next: "common.unconfirmed" }
      ],
      otherNext: "batt.notfixed"
    },
    "batt.fixed": {
      kind: "end", ending: "fixed",
      text: "Their data is arriving again."
    },
    "batt.notfixed": {
      kind: "end", ending: "not_fixed",
      collect: ["Since when", "Which phone data your study collects"]
    },

    /* ===== wearable: P7 ===== */
    "wear.which": {
      kind: "question", stage: 1, short: "Which phone and wearable?",
      text: "Which phone, and which watch or health app?",
      why: "Setup differs by phone and watch. There's no supported way to get Fitbit data into mindLAMP on an iPhone.",
      basis: ["documented", "platform"],
      options: [
        { label: "Fitbit with an iPhone", next: "wear.fitbitios" },
        { label: "Apple Watch or Apple Health with an iPhone", next: "wear.own" },
        { label: "Android with Health Connect, Samsung Health or a Fitbit", next: "wear.own" }
      ],
      otherNext: "wear.own"
    },
    "wear.fitbitios": {
      kind: "end", ending: "no_fix_yet", issueId: "i12",
      text: "There's no supported way to get Fitbit data into mindLAMP on an iPhone. Talk with your study lead. Options include an Apple Watch with the iPhone, or the Fitbit with an Android phone. If a device change is too much to ask, staying in the study without watch data may be the better choice."
    },
    "wear.own": {
      kind: "question", stage: 1, short: "Health app shows the data?",
      text: "Does the data show in the phone's health app? iPhone: the Health app. Android: Health Connect.",
      why: "mindLAMP gets steps, sleep and heart rate only through the phone's health app. If the data isn't there, the watch isn't syncing to the phone.",
      basis: ["documented"],
      options: [
        { label: "Yes, the data is there", next: "wear.phonedata" },
        { label: "No", next: "wear.watchapp" },
        { label: "Not sure", next: "wear.phonedata" }
      ],
      otherNext: "wear.phonedata"
    },
    "wear.watchapp": {
      kind: "action", stage: 3, short: "Sync the watch", who: "participant-now",
      text: "Check the watch is paired with the phone and has synced. If it uses its own app (for example Fitbit or Samsung Health), check that app is signed in and shares data with the phone's health app (Apple Health or Health Connect).",
      why: "If the watch hasn't synced to the phone's health app, mindLAMP has nothing to read.",
      basis: ["documented"],
      notFixedNext: "wear.notfixed", fixedNext: "wear.confirm"
    },
    "wear.phonedata": {
      kind: "question", stage: 2, short: "Other phone data arriving?",
      text: "Is the phone's other data, like GPS, still arriving? Hover over Last Passive on the Users tab.",
      why: "If all phone data stopped too, mindLAMP itself isn't running. Fix that first.",
      basis: ["documented"],
      when: { passive: true }, skip: "wear.iosperm",
      options: [
        { label: "Yes", next: "wear.iosperm" },
        { label: "No", next: "@data_missing" },
        { label: "Not sure", next: "wear.iosperm" }
      ],
      otherNext: "wear.iosperm"
    },
    "wear.iosperm": {
      kind: "action", stage: 3, short: "Turn on Health access", who: "participant-now",
      text: "iPhone: in Settings, open Health, then Data Access & Devices, then mindLAMP. Turn on all categories.",
      why: "mindLAMP reads only the health data it is allowed to.",
      basis: ["documented", "platform"],
      when: { os: "ios" }, skip: "wear.hc",
      notFixedNext: "wear.hc", fixedNext: "wear.confirm"
    },
    "wear.hc": {
      kind: "action", stage: 3, short: "Allow Health Connect access", who: "participant-now",
      text: "Android: open Health Connect, then App permissions, then mindLAMP. Allow all. On Android 13 or older, Health Connect is a separate Play Store app, and it needs to be installed before mindLAMP.",
      why: "mindLAMP reads only the health data it is allowed to. Health Connect is built in from Android 14.",
      basis: ["documented", "staff"],
      when: { os: "android" }, skip: "wear.notfixed",
      notFixedNext: "wear.order", fixedNext: "wear.confirm"
    },
    "wear.order": {
      kind: "question", stage: 2, short: "Health apps installed after?",
      text: "Were the health apps (Health Connect, Samsung Health) installed after mindLAMP?",
      why: "If the health apps were installed after mindLAMP, mindLAMP may not connect to them.",
      basis: ["platform", "documented"],
      options: [
        { label: "Yes, after mindLAMP", next: "wear.upload" },
        { label: "No, before", next: "wear.notfixed" },
        { label: "Not sure", next: "wear.upload" }
      ],
      otherNext: "wear.notfixed"
    },
    "wear.upload": {
      kind: "action", stage: 3, short: "Let data upload first", who: "participant-later",
      text: "Have them open mindLAMP on Wi-Fi, with the phone charged, and leave it open for a few minutes.",
      why: "Data the phone hasn't sent yet uploads once the app is open and connected. Do this before reinstalling, which deletes it.",
      basis: ["documented", "code"],
      notFixedNext: "wear.reinstall", fixedNext: "wear.confirm"
    },
    "wear.reinstall": {
      kind: "action", stage: 3, short: "Reinstall the app", who: "participant-later",
      text: "Have them delete mindLAMP, then install it again after the health apps. Sign in and allow health access.",
      why: "This is the only known fix when the health apps were installed after mindLAMP.",
      basis: ["platform"],
      caution: "Reinstalling turns every permission off, so turn them back on after signing in. It isn't yet confirmed as a recommended fix. If watch data is optional for your study, ask your study lead whether it's worth it.",
      dataRisk: true, lastResort: true,
      notFixedNext: "wear.notfixed", fixedNext: "wear.confirm"
    },
    "wear.confirm": {
      kind: "question", stage: 4, short: "Health data there tomorrow?",
      text: "The next day, check for steps or heart rate from this device. The dashboard doesn't show these, so ask your data analyst or the platform team. Is the data there?",
      why: "Health data arrives on the phone's schedule.",
      basis: ["platform"],
      checkLater: "Tomorrow, ask your data analyst or the platform team whether steps or heart rate arrived from this device.",
      options: [
        { label: "Yes", next: "wear.fixed" },
        { label: "No", next: "wear.notfixed" },
        { label: "Done for now, check tomorrow", next: "common.unconfirmed" }
      ],
      otherNext: "wear.notfixed"
    },
    "wear.fixed": {
      kind: "end", ending: "fixed",
      text: "Health data is arriving."
    },
    "wear.notfixed": {
      kind: "end", ending: "not_fixed",
      collect: ["Watch model", "Which health app", "Screenshots of the health permission screens", "The order the apps were installed"]
    },

    /* ===== data_missing: P10 ===== */
    "data.view": {
      kind: "question", stage: 1, short: "Where did you see it?",
      text: "Where did you see it missing?",
      why: "First check that the data is really missing, not just hidden by a view or a report.",
      basis: ["platform", "staff"],
      options: [
        { label: "The Users tab: an old date, or yellow or red", next: "data.kind" },
        { label: "A chart your data analyst made, with gaps in recent days", next: "data.chart", issueId: null },
        { label: "Your study's own report or records", next: "data.report", issueId: null },
        { label: "A data download", next: "data.limit", issueId: "i24" }
      ],
      otherNext: "data.kind"
    },
    "data.chart": {
      kind: "action", stage: 2, short: "Redraw the chart", who: "staff-now",
      text: "Ask your data analyst to redraw the chart without its saved summaries, for a shorter date range.",
      why: "Saved summaries can show gaps that aren't in the raw data.",
      basis: ["platform"],
      notFixedNext: "data.kind"
    },
    "data.report": {
      kind: "action", stage: 2, short: "Check your own records", who: "staff-now",
      text: "Check that the mindLAMP ID in your records matches the dashboard account, and that your report ran.",
      why: "A wrong ID in your records, or a report that didn't run, can make data look missing when it is in the account.",
      basis: ["staff"],
      notFixedNext: "data.kind"
    },
    "data.limit": {
      kind: "action", stage: 2, short: "Check the download limit", who: "staff-now",
      text: "Ask whoever downloads your data to check the record limit. By default only the newest 1,000 records come back, even for a set date range.",
      why: "The oldest records in the range are left out, so older data looks missing when it isn't.",
      basis: ["platform", "code"],
      notFixedNext: "data.kind"
    },
    "data.kind": {
      kind: "question", stage: 1, short: "Activities, phone data, or both?",
      text: "What is missing: activities, phone data, or both?",
      why: "Both missing usually means the app isn't running. Only phone data points to a phone setting. Only activities points to reminders, finding the activity, or saving it.",
      basis: ["documented", "staff"],
      when: { passiveOnly: false }, skip: "data.which",
      options: [
        { label: "Both", next: "data.running" },
        { label: "Only phone data (GPS, motion and so on)", next: "data.which" },
        { label: "Only activities", next: "data.act" }
      ],
      otherNext: "data.running"
    },
    "data.act": {
      kind: "question", stage: 1, short: "What do they say happened?",
      text: "Ask the participant what happened.",
      why: "Missing activities usually trace back to one of these.",
      basis: ["staff"],
      options: [
        { label: "They didn't get activity reminders", next: "@reminders" },
        { label: "They couldn't find or open it", next: "@find_activity" },
        { label: "They did it, but it isn't showing", next: "@not_done" }
      ],
      otherNext: "@other"
    },
    "data.which": {
      kind: "question", stage: 1, short: "One sensor or all?",
      text: "Is one kind of data missing, or all of it?",
      why: "One kind missing points to that permission. All missing usually means the app isn't running.",
      basis: ["documented"],
      options: [
        { label: "Only location (GPS)", next: "data.loc" },
        { label: "Only location, and the setting now says While Using", next: "data.loc", issueId: "i09" },
        { label: "Only motion, or another single kind", next: "data.perm1" },
        { label: "All phone data", next: "data.running" },
        { label: "Only watch or health-app data", next: "@wearable" }
      ],
      otherNext: "data.running"
    },
    "data.running": {
      kind: "question", stage: 1, short: "Phone on, carried, signed in?",
      text: "Ask the participant: is the phone on, with them, and signed in to mindLAMP?",
      why: "These are common reasons the app stops sending.",
      basis: ["staff"],
      options: [
        { label: "Everything seems fine", next: "data.open" },
        { label: "They are logged out", next: "@login" },
        { label: "The phone was off, lost or left at home", next: "data.carry" },
        { label: "They have a new phone", next: "@setup_new" }
      ],
      otherNext: "data.open"
    },
    "data.carry": {
      kind: "action", stage: 3, short: "Keep phone charged, carried", who: "participant-later",
      text: "Ask them to keep the phone charged, on, connected and with them, and to open mindLAMP at least once a day. Doing an activity counts.",
      why: "Phones limit background work for apps that aren't opened. After about 3 days, collection drops sharply.",
      basis: ["staff", "documented"],
      notFixedNext: "data.open", fixedNext: "data.confirm"
    },
    "data.open": {
      kind: "action", stage: 3, short: "Leave the app running", who: "participant-now",
      text: "Have them open mindLAMP and leave it in the background. They shouldn't swipe it away.",
      why: "Swiping the app away stops collection until it's opened again. Not opening it for days also slows collection.",
      basis: ["documented", "platform"],
      notFixedNext: "data.loc", fixedNext: "data.confirm"
    },
    "data.loc": {
      kind: "action", stage: 3, short: "Location: Always, Precise", who: "participant-now",
      text: "In Settings, set mindLAMP's location to Always (Android: Allow all the time), with Precise location on. If they'd rather not share location all the time, note that instead of pressing them.",
      why: "Location in the background needs Always. It can end up back on While Using later, so check it at each contact.",
      basis: ["documented", "platform", "staff"],
      when: { gps: true }, skip: "data.lpm",
      workaroundFor: ["i09"],
      notFixedNext: "data.lpm", fixedNext: "data.confirm"
    },
    "data.perm1": {
      kind: "action", stage: 3, short: "Check that permission", who: "participant-now",
      text: "In Settings, check the permission for that kind of data, for example Motion & Fitness (iPhone) or Physical activity (Android).",
      why: "Each kind of phone data needs its own permission.",
      basis: ["documented"],
      notFixedNext: "data.lpm", fixedNext: "data.confirm"
    },
    "data.lpm": {
      kind: "action", stage: 3, short: "Low power mode off", who: "participant-now",
      text: "Turn off Low Power Mode (iPhone) or Battery Saver (Android). If battery drain is why it's on, and turning it off might make them leave the study, leave it on and note it.",
      why: "Low power mode is the most common fixable cause of missing phone data. It limits background collection, such as location and motion.",
      basis: ["documented", "staff"],
      notFixedNext: "data.bg", fixedNext: "data.confirm"
    },
    "data.bg": {
      kind: "action", stage: 3, short: "Allow Background App Refresh", who: "participant-now",
      text: "iPhone: in Settings, General, Background App Refresh, turn it on for mindLAMP.",
      why: "Background App Refresh lets mindLAMP keep collecting when it isn't on screen.",
      basis: ["documented", "staff"],
      when: { os: "ios" }, skip: "data.abatt",
      notFixedNext: "data.abatt", fixedNext: "data.confirm"
    },
    "data.abatt": {
      kind: "action", stage: 3, short: "Turn off battery limits", who: "participant-now",
      text: "Android: set mindLAMP's battery use to Unrestricted or Don't optimize. Some makers, like Samsung, have extra settings that close apps. This may use more battery.",
      why: "Android and some phone makers close background apps to save battery. dontkillmyapp.com shows each maker's extra settings.",
      basis: ["documented"],
      when: { os: "android" }, skip: "data.net",
      notFixedNext: "data.net", fixedNext: "data.confirm"
    },
    "data.net": {
      kind: "action", stage: 3, short: "Connection and storage", who: "participant-now",
      text: "Check the phone has a connection and free storage. If they are rarely on Wi-Fi, check mobile data is on for mindLAMP.",
      why: "Data waits on the phone until it can upload. It can get stuck there with no Wi-Fi and mobile data off for the app, or with full storage.",
      basis: ["staff"],
      notFixedNext: "data.fq", fixedNext: "data.confirm"
    },
    "data.fq": {
      kind: "action", stage: 3, short: "Swipe away and reopen", who: "participant-now",
      text: "Have them close mindLAMP fully (swipe it away), then open it again right away.",
      why: "This restarts the app and deletes no data. Collection stops until they open it again.",
      basis: ["staff", "code"],
      notFixedNext: "data.restart", fixedNext: "data.confirm"
    },
    "data.restart": {
      kind: "action", stage: 3, short: "Restart the phone", who: "participant-now",
      text: "Have them restart the phone, then open mindLAMP.",
      why: "A restart can clear a stuck phone or app.",
      basis: ["staff", "common"],
      notFixedNext: "data.notfixed", fixedNext: "data.confirm"
    },
    "data.confirm": {
      kind: "question", stage: 4, short: "Data there tomorrow?",
      text: "Tomorrow, on the Users tab, hover over Last Passive. Each kind of data it lists should have reported since the fix. If unsure, or for data not listed, ask your data analyst. Is it all arriving?",
      why: "The color turns green if any data arrived in the last 2 days, so it can hide a missing kind.",
      basis: ["platform", "documented"],
      checkLater: "Tomorrow, hover over Last Passive on the Users tab. Each kind of data should have reported since the fix.",
      options: [
        { label: "Yes", next: "data.fixed" },
        { label: "No", next: "data.notfixed" },
        { label: "Done for now, check tomorrow", next: "common.unconfirmed" }
      ],
      otherNext: "data.notfixed"
    },
    "data.fixed": {
      kind: "end", ending: "fixed",
      text: "Phone data is arriving again."
    },
    "data.notfixed": {
      kind: "end", ending: "not_fixed",
      text: "Until it's solved, ask them to keep the phone charged and open mindLAMP once a day.",
      collect: ["Which kinds of data", "Since when", "Where you saw it missing", "Screenshots of the phone's settings", "How many participants have gaps at the same time", "Whether the phone runs a beta OS, or an old OS that can't update"]
    },

    /* ===== setup_new: P11 ===== */
    "setup.step": {
      kind: "question", stage: 1, short: "Which step went wrong?",
      text: "Which setup step went wrong?",
      why: "Each step has its own common problems.",
      basis: ["documented"],
      options: [
        { label: "Downloading, or finding the app", next: "setup.download" },
        { label: "Logging in", next: "@login" },
        { label: "A web page opened instead of the app", next: "login.browser" },
        { label: "A screen says Self Help or Try It", next: "login.selfhelp" },
        { label: "Permission pop-ups", next: "setup.ios" },
        { label: "Health app or watch", next: "@wearable" },
        { label: "The app store asks for an Apple ID password", next: "setup.appleid" },
        { label: "The login we created doesn't work", next: "setup.creds" },
        { label: "The first activity", next: "@find_activity" }
      ],
      otherNext: "setup.notfixed"
    },
    "setup.download": {
      kind: "action", stage: 3, short: "Download mindLAMP 2", who: "participant-now",
      text: "In the app store, search for mindLAMP 2. Then follow the setup checklist for their phone: docs.lamp.digital/app/getting-started/download. If the store says the app isn't compatible, the phone may need an update or be too old.",
      why: "The app is listed as mindLAMP 2. Older phones may not be supported.",
      basis: ["documented"],
      notFixedNext: "setup.notfixed", fixedNext: "setup.confirm"
    },
    "setup.ios": {
      kind: "action", stage: 3, short: "Check iPhone permissions", who: "participant-now",
      text: "iPhone: in Settings, open mindLAMP 2. Check Location (Always, Precise on), Motion & Fitness, Notifications and Background App Refresh. In Settings, Privacy, Research Sensor & Usage Data, turn on Sensor & Usage Data Collection. Low Power Mode should be off.",
      why: "Each permission turns on one kind of phone data or the activity reminders. Pop-ups are easy to skip or deny during setup.",
      basis: ["documented"],
      when: { os: "ios" }, skip: "setup.android",
      notFixedNext: "setup.android", fixedNext: "setup.confirm"
    },
    "setup.android": {
      kind: "action", stage: 3, short: "Check Android permissions", who: "participant-now",
      text: "Android: in Settings, Apps, mindLAMP 2: set Location to Allow all the time, allow Physical activity and Notifications, and set Battery to Don't optimize. Turn Battery Saver off.",
      why: "Each permission turns on one kind of phone data or the activity reminders. Pop-ups are easy to skip or deny during setup.",
      basis: ["documented"],
      when: { os: "android" }, skip: "setup.notfixed",
      notFixedNext: "setup.notfixed", fixedNext: "setup.confirm"
    },
    "setup.appleid": {
      kind: "action", stage: 3, short: "Apple ID password", who: "participant-later",
      text: "The app store may ask for the phone's Apple ID password. Help them find it, or ask them to bring it to the visit.",
      why: "Installing an app can ask for the phone's Apple ID password. On a loaned or family phone, it may belong to someone else.",
      basis: ["staff"],
      notFixedNext: "setup.notfixed", fixedNext: "setup.confirm"
    },
    "setup.creds": {
      kind: "action", stage: 3, short: "Check the login", who: "staff-now",
      text: "In the dashboard, open their login (key icon). Check it exists and the username matches what they type. Reset the password if needed. If you tested it on a staff phone, sign that phone out.",
      why: "Logins made before a visit can have typos or be changed later. A phone left signed in keeps collecting data for that account.",
      basis: ["staff"],
      notFixedNext: "@login", fixedNext: "setup.confirm"
    },
    "setup.confirm": {
      kind: "question", stage: 4, short: "Test activity on dashboard?",
      when: { passiveOnly: false }, skip: "setup.pconfirm",
      text: "Have them do a test activity. Does it show on your dashboard?",
      why: "A test activity shows setup worked. Phone data follows in 1 to 2 days.",
      basis: ["platform"],
      checkLater: "Have them do a test activity. Check that it shows on your dashboard.",
      options: [
        { label: "Yes", next: "setup.fixed" },
        { label: "No", next: "@not_done" },
        { label: "Can't check right now", next: "common.unconfirmed" }
      ],
      otherNext: "setup.notfixed"
    },
    "setup.fixed": {
      kind: "end", ending: "fixed",
      text: "If your study collects phone data, check for it in 1 to 2 days: hover over Last Passive on the Users tab."
    },
    "setup.pconfirm": {
      kind: "question", stage: 4, short: "Phone data arriving?",
      text: "In a day or two, hover over Last Passive on the Users tab. Is phone data arriving?",
      why: "A study with no activities has no test activity to check. Phone data follows in 1 to 2 days.",
      basis: ["documented", "platform"],
      checkLater: "In a day or two, hover over Last Passive on the Users tab. Check that phone data is arriving.",
      options: [
        { label: "Yes", next: "setup.pfixed" },
        { label: "No", next: "@data_missing" },
        { label: "Done for now, check in a day or two", next: "common.unconfirmed" }
      ],
      otherNext: "setup.notfixed"
    },
    "setup.pfixed": {
      kind: "end", ending: "fixed"
    },
    "setup.notfixed": {
      kind: "end", ending: "not_fixed",
      collect: ["Which setup step", "What is on the screen"]
    },

    /* ===== stop_collection: P12 ===== */
    "stop.what": {
      kind: "question", stage: 1, short: "End, pause, or they asked?",
      text: "What do you need to do?",
      why: "There is no stop switch for one person. The steps depend on whether they will come back.",
      basis: ["platform"],
      options: [
        { label: "End the study for this person", next: "stop.facts" },
        { label: "They asked to stop", next: "stop.facts" },
        { label: "Pause between bursts", next: "stop.pause" }
      ],
      otherNext: "stop.facts"
    },
    "stop.facts": {
      kind: "info", stage: 2, short: "What not to change",
      text: "Don't change sensors in their profile. Don't use Delete participant unless your study lead says their data must be removed.",
      why: "Sensor settings in a profile change everyone in their group.",
      basis: ["platform", "documented"],
      caution: "Delete participant permanently erases all their data. It can't be undone.",
      next: "stop.upload"
    },
    "stop.upload": {
      kind: "info", stage: 3, short: "Let data upload first",
      text: "Have them open mindLAMP on Wi-Fi, with the phone charged, and leave it open for a few minutes. If they asked to stop and would rather not, skip this.",
      why: "The app keeps unsent data on the phone and sends it when connected. Signing out deletes anything not yet sent.",
      basis: ["documented", "code"],
      next: "stop.offboard"
    },
    "stop.offboard": {
      kind: "info", stage: 3, short: "Remove login and app",
      text: "You: delete their login (key icon on their card). This is not Delete participant. Add an alias such as \"inactive\" (pencil icon). Them: sign out of mindLAMP, then delete the app.",
      why: "These steps stop the app sending data and keep what was already collected.",
      basis: ["platform"],
      caution: "Signing out deletes data not yet sent. Do the upload step first, unless they chose to skip it.",
      next: "stop.confirm"
    },
    "stop.pause": {
      kind: "info", stage: 3, short: "Upload, then sign out",
      text: "Have them open mindLAMP on Wi-Fi, charged, for a few minutes. Then have them sign out. They sign in again for the next burst; then recheck their permissions.",
      why: "Signing out stops collection and activity reminders.",
      basis: ["platform", "code"],
      caution: "Signing out deletes data not yet sent. Let it upload first.",
      next: "stop.confirm"
    },
    "stop.confirm": {
      kind: "question", stage: 4, short: "Still sending later?",
      text: "A day or two later, on the Users tab, hover over Last Active and Last Passive. Is anything dated after they stopped?",
      why: "New data after offboarding means a phone or watch may still be signed in.",
      basis: ["platform"],
      checkLater: "In a day or two, hover over Last Active and Last Passive on the Users tab. Nothing should be dated after they stopped.",
      options: [
        { label: "No, nothing new", next: "stop.done" },
        { label: "Yes, data is still arriving", next: "stop.notfixed" },
        { label: "Done for now, check in a day or two", next: "common.unconfirmed" }
      ],
      otherNext: "stop.notfixed"
    },
    "stop.done": {
      kind: "end", ending: "fixed",
      text: "Collection has stopped. For a pause, they sign in again at the next burst."
    },
    "stop.notfixed": {
      kind: "end", ending: "not_fixed",
      collect: ["When the login was deleted, or when they signed out", "What data is still arriving"]
    },

    /* ===== staff_side: P13 ===== */
    "staff.what": {
      kind: "question", stage: 1, short: "What were you doing?",
      text: "What were you doing when it went wrong?",
      why: "Each dashboard task has its own common problems. Note any error text.",
      basis: ["platform"],
      options: [
        { label: "Creating a participant login", next: "staff.cred", issueId: "i23" },
        { label: "Saving activities or settings", next: "staff.save" },
        { label: "Activities are missing from the list", next: "staff.filter" },
        { label: "Viewing a participant's data", next: "staff.notfixed" },
        { label: "Signing in to the dashboard", next: "staff.auth" }
      ],
      otherNext: "staff.notfixed"
    },
    "staff.cred": {
      kind: "action", stage: 3, short: "Fill every field", who: "staff-now",
      text: "Fill in every field, including Name and Role. Then click the checkmark next to the confirm-password box to save.",
      why: "\"Could not perform operation\" appears when a field is blank. The checkmark is easy to miss.",
      basis: ["platform"],
      workaroundFor: ["i23"],
      notFixedNext: "staff.notfixed"
    },
    "staff.save": {
      kind: "action", stage: 3, short: "Take turns editing", who: "staff-now",
      text: "Make sure only one person edits at a time. Don't save during a known outage.",
      why: "Edits made at the same time, or during an outage, have damaged what participants see.",
      basis: ["platform"],
      notFixedNext: "staff.notfixed", fixedNext: "staff.confirm"
    },
    "staff.filter": {
      kind: "action", stage: 3, short: "Clear filters", who: "staff-now",
      text: "Clear any filters on the list.",
      why: "Filters have hidden activities from staff.",
      basis: ["platform"],
      notFixedNext: "staff.notfixed"
    },
    "staff.auth": {
      kind: "action", stage: 3, short: "New sign-in steps", who: "staff-now",
      text: "At sign-in, pick your server's card. Own server with no card: choose Connect to a different server and type the address. If asked, set up two-step sign-in. Details: docs.lamp.digital/blog/authentication-upgrade.",
      why: "Dashboard sign-in now starts by choosing your server from a set of cards.",
      basis: ["documented"],
      notFixedNext: "staff.notfixed"
    },
    "staff.confirm": {
      kind: "question", stage: 4, short: "Shows for a test account?",
      text: "Does the change show for a test account?",
      why: "A test account shows what participants will see.",
      basis: ["platform"],
      options: [
        { label: "Yes", next: "staff.fixed" },
        { label: "No", next: "staff.notfixed" }
      ],
      otherNext: "staff.notfixed"
    },
    "staff.fixed": {
      kind: "end", ending: "fixed",
      text: ""
    },
    "staff.notfixed": {
      kind: "end", ending: "not_fixed",
      collect: ["What you were doing", "The error text", "Your browser", "Your server", "The time"]
    },

    /* ===== other: section 5 ===== */
    "other.part": {
      kind: "question", stage: 1, short: "Which part of the app?",
      text: "In their words, what do they see? Which part of the app is it about?",
      why: "If one of these fits, that path has more specific steps.",
      basis: ["platform"],
      options: [
        { label: "Getting in", next: "@login" },
        { label: "Activity reminders", next: "@reminders" },
        { label: "Finding or opening an activity", next: "@find_activity" },
        { label: "Doing an activity", next: "@activity_wrong" },
        { label: "Data reaching you", next: "@data_missing" },
        { label: "Battery, mobile data or storage", next: "@battery" },
        { label: "Study setup", next: "@setup_new" },
        { label: "None of these", next: "other.scope" }
      ],
      otherNext: "other.scope"
    },
    "other.scope": {
      kind: "question", stage: 1, short: "How widespread?",
      text: "Is it one participant or several?",
      why: "If several people have it at once, the cause is likely the platform or your study's setup, not one phone.",
      basis: ["platform"],
      options: [
        { label: "One participant", next: "other.reopen" },
        { label: "Several participants", next: "other.end" },
        { label: "Not sure", next: "other.reopen" }
      ],
      otherNext: "other.reopen"
    },
    "other.reopen": {
      kind: "action", stage: 3, short: "Reopen the app", who: "participant-now",
      text: "Have them go to the home screen, wait a minute, and open mindLAMP again.",
      why: "Reopening often clears a stuck screen. It deletes no data.",
      basis: ["platform", "code"],
      notFixedNext: "other.restart"
    },
    "other.restart": {
      kind: "action", stage: 3, short: "Restart the phone", who: "participant-now",
      text: "Have them restart the phone, then open mindLAMP.",
      why: "A restart can clear a stuck phone or app.",
      basis: ["common", "staff"],
      notFixedNext: "other.end"
    },
    "other.end": {
      kind: "end", ending: "new_problem", issueId: null
    },

    /* ===== shared ===== */
    "common.unconfirmed": {
      kind: "end", ending: "unconfirmed",
      text: "If it didn't work, start a new session on the same problem."
    }
  },

  /* Steps from research v2 with no allowed basis (D21), or held for another stated reason. Never shown. */
  heldBack: [
    { text: "Open the app once so the phone's activity reminder schedule refreshes.",
      source: "Research v2 P2 step 3", reason: "Tagged [inference]. No allowed basis." },
    { text: "Activity reminders may stop if the app isn't opened for days, because they are also scheduled on the phone.",
      source: "Research v2 P2 step 2 (GitHub #871, #392)", reason: "Tagged [inference] from a developer finding." },
    { text: "The permanent Android \"collecting data\" notification is expected and means collection is running.",
      source: "Research v2 P2 step 1, P9 (GitHub #172)", reason: "Developer finding only. A common question; candidate for a \"developer finding\" tag (SPEC open item 4)." },
    { text: "The red number on the iPhone app icon is set by Apple's side, not mindLAMP.",
      source: "Research v2 P2 step 1 (GitHub #611)", reason: "Developer finding only. The guide routes this to issue i06 instead." },
    { text: "After a force-quit, stale activity wording usually clears in 2 to 3 days; sign-out isn't needed.",
      source: "Research v2 P6 step 3 (developer advice in a past chat)", reason: "Developer finding only. Force-quit itself stays, on platform team practice and code." },
    { text: "For games cut off the screen, consider another device.",
      source: "Research v2 P6 step 3", reason: "Tagged [inference]." },
    { text: "Record what they answered, if the protocol allows, while sending fails.",
      source: "Research v2 P4 step 5", reason: "Tagged [inference]." },
    { text: "When an activity errors: try the same activity on the web, then another short assigned activity, then check server logs (own server).",
      source: "Research v2 P4 step 3 and escalation packet", reason: "D21 names this sequence as unsupported until its basis is known. The web stays as a stopgap." },
    { text: "Open dashboard.lamp.digital in the phone browser. If it loads, it is an app problem; if not, the network or server.",
      source: "Research v2 P5 step 3 (GitHub #638; legacy docs)", reason: "A browser diagnostic like the D21 sequence. Legacy docs support it; held for the platform team to confirm." },
    { text: "iOS may not ask for permissions again if the app is reinstalled within a day; set them in Settings.",
      source: "Research v2 P11, rules step 8 (GitHub #775)", reason: "Developer finding only. The guide still says to turn permissions back on in Settings after reinstalling (documented)." },
    { text: "On iPhone, location access also keeps the app running for other sensors.",
      source: "Research v2 section 3 and P10 (GitHub #668)", reason: "Developer finding only." },
    { text: "Sensor sampling rates or notifications cause battery drain.",
      source: "Research v2 P8 step 2 (team dev notes)", reason: "Developer notes and [inference]." },
    { text: "Reinstall the app after Low Power Mode, or when phone data is missing.",
      source: "Research v2 P10 step 3 (a study's note template; staff practice)", reason: "Has a staff basis, but conflicts with data safety and research v2 flags it (question 3). Left out of the phone-data path pending a platform team decision." },
    { text: "Data that looks wrong rather than missing (call durations, day boundaries in UTC, home time, nearby devices).",
      source: "Research v2 section 2, after E13", reason: "Out of scope for an RA guide per research v2. Goes to Something else." },
    { text: "Server-side notification events (lamp.analytics) to confirm an activity reminder was delivered.",
      source: "Research v2 P2 step 4", reason: "Unverified whether it shows delivery." }
  ]
};

/* REVIEW FIXES 2026-10-27: "Can't check" on every confirm step goes to common.unconfirmed (ending "unconfirmed",
   no fix credit); the four next-day confirms are questions. Options that lead to a different cause carry
   issueId: null so the session doesn't count toward the entry's issue (find_activity, activity_wrong and
   staff_side have no entry-level issue; their issues are on options and in alsoIssues). wont_load runs
   "let data upload" before Android "clear cache". act.signout and act.upload1 removed (no basis for sign-out
   on stale wording; research v2 P6). rem.update and batt.charge are info steps; other.since moved to the
   "Something else" ending as a field. Wrong-time reminders escalate (rem.wrongtime). */
/* CHANGES 2026-10-28 (guide pass after the UX audit):
   - Basis tag "platform" ("Platform team practice") replaces the tag that named a person. Same meaning.
   - "activity reminders" in every shown sentence; search phrases keep people's own words.
   - Endings no longer say "Send this to the platform team": the session is sent the moment the ending shows,
     and the page says so. End texts now say only what to do or tell the person.
   - Next-day confirm steps offer "Done for now, check tomorrow" (or "in a day or two", "at the next
     reminder"). Every confirm step that can end "not confirmed yet" has checkLater: the plain check the RA
     still owes, shown on that ending. */
/* D24 CONTENT PASS 2026-10-28 (guide content reviews, scratch: guide-review-first.json, guide-review-second-verified.json):
   - "Why" lines state the fact; the basis tag names the source. Claims kept at the evidence's strength (can, may).
   - Trade-offs where keeping the participant outranks complete data: low power mode is a stopgap on the battery
     ending (stopgaps.low_power; node batt.lpm removed), and short trade-off lines on rem.battery, data.lpm, data.loc,
     data.abatt, q.perm, q.data, login.perms, find.signout, act.cutend, login.recur, load.reinstall.
   - Fix cards (D24 suggested fixes on one screen): every stage-3 action has short (2 to 4 words) and who
     (staff-now, participant-now, participant-later, platform); stopgaps carry them too. "Last resort" is a chip,
     so step text no longer starts with it.
   - New: act.wording (restore answer wording, starter #18), data.which watch option, setup.step Self Help option,
     setup.pconfirm and setup.pfixed (studies with no activities), stop.facts caution.
   - Kept as before, pending Eden: login.upload stays on the login path; common.unconfirmed keeps "start a new
     session" until the page can reopen a session; no option yet for "they forgot or it felt like too much". */
