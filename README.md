# Calendar Copilot

An AI chief of staff for Google Calendar. You tell it what your week should look like, it draws the changes as an overlay on your real calendar (added, removed, moved), and nothing is written to Google until you approve.

Built with Next.js 14 (App Router), NextAuth (Google), the Google Calendar REST API and OpenAI function calling.

## What it does

- **Ask tab.** Plain-language instructions ("protect 2 hours of deep work every weekday", "clear my Friday afternoon", "what if I take Thursday off?"). The agent reads your calendar with tools, finds real free slots, and returns a proposal.
- **Ghost diff.** Proposed changes render on the grid before they exist: green dashed is added, red hatched is removed, amber is moved (dashed outline at the old slot, solid at the new one). Untick any change you do not want, then apply.
- **Week health.** Score out of 100 from meeting load, focus time, back-to-backs and meetings with no agenda, plus the estimated cost of each meeting (people x hourly rate x duration). One click asks the agent to fix the week.
- **Invite triage.** Reviews pending invites against your accepted meetings, how loaded that day is and your goals. Gives accept / decline / maybe with a reason, applied in one click.
- **Goals and rules.** Free text ("mornings are for deep work, no meetings after 5pm") that the agent and triage both follow.
- **Demo week.** A deliberately messy sample week, no Google account needed. Great for reviewers.
- **Ctrl/Cmd+K** jumps to the command box.

## Setup (about 10 minutes)

1. `npm install`
2. Create a Google Cloud project, enable the **Google Calendar API**.
3. OAuth consent screen: User type External, keep it in **Testing**, and add your email and any reviewer's email under **Test users**. (The calendar scope is sensitive, so unverified apps show a warning. Test users can click through it.)
4. Credentials: create an **OAuth client ID** (Web application). Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-APP.vercel.app/api/auth/callback/google` (once deployed)
5. `cp .env.example .env.local` and fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`) and `OPENAI_API_KEY`.
6. `npm run dev` and open http://localhost:3000.

### Deploy to Vercel

Import the repo, add the same env vars, set `NEXTAUTH_URL` to your production URL, and add the production redirect URI in Google Cloud. Share the link plus the test-user note with the reviewer.

## Safety choices

- The agent has **no write tool**. `propose_changes` only returns a diff. The single write path is `POST /api/commit`, called by the UI after the user clicks Apply.
- The server validates every proposal: unknown event ids are rejected, events you do not organize cannot be moved, past start times and overlaps produce warnings the user sees.
- `SEND_INVITES=false` by default, so approving changes never emails attendees during a demo. Set it to `true` to notify people.
- Demo mode never touches Google.

## Project layout

```
src/lib/agent.ts       OpenAI tool loop: list_events, find_free_slots, propose_changes
src/lib/gcal.ts        Google Calendar REST client (list, create, patch, delete, rsvp)
src/lib/auth.ts        NextAuth config, offline access, refresh token rotation
src/lib/health.ts      Week health score and meeting cost
src/lib/time.ts        Timezone-safe parsing and formatting without extra deps
src/app/api/*          agent, commit, events, rsvp, triage routes
src/components/*       Week grid with ghost events, sidebar, landing page
```

## Known limits

- Single primary calendar, one user. No multi-attendee negotiation yet.
- No undo after Apply. Moves can be reversed by asking the agent.
- The in-memory rate limiter is per server instance. Use Redis or Upstash in production.
- Times use the browser timezone.
