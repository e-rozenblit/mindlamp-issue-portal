# mindLAMP Issue Portal (pilot)

A place for mindLAMP study teams to report recurring platform issues, say how they affect their study, boost the ones that matter most, find workarounds and troubleshooting steps, and see status. Reports feed the mindLAMP developer meetings.

- Static page (`index.html`), hosted on GitHub Pages.
- Sign-in and shared data: Supabase. Access is by invitation; nothing is readable without signing in.
- The key in `index.html` is Supabase's publishable key, which is meant to be public. Access is enforced by the database's row-level security rules.
- No participant-level data is collected.
