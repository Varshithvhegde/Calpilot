# Calpilot

<img width="1531" height="871" alt="image" src="https://github.com/user-attachments/assets/11142046-383d-4786-886f-29852973de88" />


An AI chief of staff for Google Calendar. You tell it what your week should look like, it draws the changes as an animated overlay on your real calendar (added, removed, moved), and nothing is written to Google until you approve.

Built with Next.js 14 (App Router), NextAuth (Google), the Google Calendar REST API, OpenAI function calling, and optional Fish Audio S2.1 Pro TTS.

## What it does
<img width="1532" height="866" alt="image" src="https://github.com/user-attachments/assets/73ccff0f-ed96-4970-82c1-133bb62a556b" />


- **Ask tab & interactive event cards.** Plain-language instructions (`"protect 2 hours of deep work every weekday"`, `"clear my Friday afternoon"`, `"what if I take Thursday off?"`). The agent reads your calendar with tools, finds real free slots, and returns a proposal. Schedule lookups (e.g. `"tomorrow"`, `"pipeline review"`) also render clickable event cards right inside the chat reply.
- **Animated ghost diff.** Proposed changes stagger onto the grid before they exist: green dashed with glow pulse for added events, red hatched with a sweeping strikethrough for removals, and amber with a dashed SVG trail for moves. Untick any item or click **Edit** on a proposed change to tweak its title, date, or time before applying.
- **Before / after Week Health score.** Score out of 100 from meeting load, focus time, back-to-backs, and meetings with no agenda, plus estimated meeting cost (`people × hourly rate × duration`). While a proposal is active, Calpilot previews `Week health X → Y` with a smooth count-up, delta badge, and before/after meeting and focus hours.
- **Day load heat strip.** A 4px bar under each day header shows how packed 9 AM–6 PM is (green `<30%`, amber `30–60%`, red `>60%`) with exact meeting hours on hover.
- **Undo after Apply.** Every applied batch shows a toast with an **Undo** button—restoring the previous week snapshot in demo mode or executing reverse create/move/delete calls in Google Calendar.
- **Meeting Prep & Paste Notes (`/api/prep`).** Click any event to open its details (with sanitized, clickable links from HTML descriptions), run **Prep me** for a 3–5 bullet briefing using attendees and related meetings, or **Paste notes** to extract action items and propose follow-up meetings through the ghost diff.
- **Manual calendar editing.** Click **`+ Event`** in the header or click any empty hour slot on the grid to create an event, or click **Edit** on any event popover to update its title, date, time, agenda, or delete it.
- **Invite triage.** Reviews pending invites against your accepted meetings, day load, and goals, showing the full date and time range with one-click Accept / Decline / Maybe.
- **Voice Mode & live dictation (`/api/tts`).** Toggle **Voice** in the header or click the mic button for live Web Speech dictation. In Voice Mode, say `"approve"` / `"apply"` or `"discard"` / `"cancel"` to act on proposals hands-free. Spoken replies (**TTS**) are off by default and can be toggled on in the header (uses Fish Audio `s2.1-pro-free` when `FISH_API_KEY` is set, with browser `SpeechSynthesis` fallback).
- **Command palette (`Cmd/Ctrl+K`), Dark mode, & Mobile sheet.** Centered `Cmd/Ctrl+K` palette for quick actions and prompts, light/dark theme toggle persisted in `localStorage`, and a collapsible bottom sheet on screens under `1024px`.
- **Demo week & OAuth legal pages.** Includes a sample messy week requiring no Google account, plus public `/privacy` and `/terms` pages linked from the landing page footer for Google OAuth verification.

## Setup (about 10 minutes)

1. `npm install`
2. Create a Google Cloud project and enable the **Google Calendar API**.
3. OAuth consent screen: User type **External**, keep it in **Testing** (or submit for verification using `/privacy` and `/terms`), and add your email and any reviewer emails under **Test users**.
4. Credentials: create an **OAuth client ID** (Web application). Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-APP.vercel.app/api/auth/callback/google` (once deployed)
5. Copy `.env.example` to `.env.local` (or `.env`) and fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`), and `OPENAI_API_KEY`.
   - Optional: set `FISH_API_KEY` to use Fish Audio S2.1 Pro (`s2.1-pro-free`) when **TTS** is enabled; otherwise Calpilot falls back to browser speech synthesis.
6. `npm run dev` and open http://localhost:3000.

### Deploy to Vercel

Import the repo, add the same environment variables, set `NEXTAUTH_URL` to your production URL, and add the production redirect URI in Google Cloud.

## Safety choices

- The agent has **no write tool**. `propose_changes` only returns a diff. The single write path is `POST /api/commit`, called by the UI only after the user clicks **Apply** (or saves a manual edit).
- The server validates every proposal: `expected_title` is checked against `event_id`, events you do not organize cannot be moved, and past start times or overlaps produce warnings.
- `SEND_INVITES=false` by default, so approving changes never emails attendees during a demo. Set it to `true` to notify invitees.
- Demo mode never touches Google.

## Project layout

```text
src/lib/agent.ts        OpenAI tool loop: list_events, find_free_slots, propose_changes
src/lib/gcal.ts         Google Calendar REST client (list, create, patch, delete, rsvp)
src/lib/auth.ts         NextAuth config, offline access, refresh token rotation
src/lib/health.ts       Week health score and meeting cost
src/lib/apply.ts        Local in-memory event diff applier (demo mode & projected score)
src/lib/time.ts         Timezone-safe parsing and formatting without extra deps
src/app/api/*           agent, commit, events, prep, rsvp, triage, tts routes
src/app/privacy         Public Privacy Policy page for Google OAuth verification
src/app/terms           Public Terms & Conditions page for Google OAuth verification
src/components/*        CalendarApp, WeekGrid, Landing, Logo, Root
```

## Known limits

- Single primary calendar, one user. No multi-attendee negotiation yet.
- The in-memory rate limiter is per server instance. Use Redis or Upstash in production.
- Live speech dictation relies on browser `SpeechRecognition` / `webkitSpeechRecognition` support (Chrome, Edge, Safari).
- Times use the browser timezone.
