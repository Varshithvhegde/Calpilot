# Thought process

## The problem

A calendar is a passive grid. Business users spend a lot of their week on three chores: reshuffling to protect focus time, deciding which invites deserve a yes, and finding out too late that a day is overloaded. The brief says AI can make Calendar 10X more valuable. I read that as: move from "a place that stores events" to "a system that defends your time".

## Insight

The hard part of an AI calendar agent is not calling the API. It is **trust**. A calendar is shared, other people see changes, and a wrong move costs real social capital. Most agent demos either do nothing risky (so they are boring) or write straight to the calendar (so nobody would use them).

So the core idea: **the agent never edits. It proposes a diff.** The proposal is drawn on the real calendar as a tracing-paper overlay, the user ticks what they want, and only then does anything get written. The same mechanism gives "what if" simulation for free, because a preview and a proposal are the same thing.

## Design principles

1. **Propose before commit.** No write tool exists for the model. One server route writes, and only on a user click.
2. **Show, do not describe.** Changes are visual (green add, red hatched remove, amber move) so the user checks a picture, not a paragraph.
3. **Goal-aware.** A free-text goals box feeds the agent and triage, so "mornings are for deep work" becomes a standing constraint without a settings UI.
4. **Explain every change.** Each change carries a one-line reason.
5. **Quantify time.** Meeting cost and a week health score turn a vague feeling ("my week is crammed") into numbers the agent can improve.

## Features and why

| Feature | Problem it solves |
| --- | --- |
| Ask + ghost diff | Rescheduling by conversation, safely |
| Week health + meeting cost | Makes low-value meetings visible and gives the agent a target |
| Invite triage | Turns the daily accept/decline chore into one-click decisions with reasons |
| Goals and rules | Persistent intent without forms |
| Demo week | Reviewers can try it in 10 seconds without OAuth |

## Architecture

- **Next.js App Router** UI and API routes. **NextAuth** Google provider with `access_type=offline` and refresh token rotation.
- **Google Calendar REST** called directly with fetch. No heavy SDK, smaller bundle and cold start.
- **OpenAI function calling** with three tools: `list_events`, `find_free_slots`, `propose_changes`. Free slots are computed deterministically in code, not by the model, so the model cannot hallucinate availability.
- **Server-side validation** of every proposal: real event ids only, no moving events the user does not organize, warnings for overlaps and past times. The model gets validation errors back and fixes its own output.
- **Timezone-safe** parsing without date libraries, so "tomorrow 3pm" lands correctly across offsets and DST.
- **Commit is separate** (`/api/commit`) and is the only route that writes event changes.

## Tradeoffs

- Diff-based flow adds one click versus instant execution. I chose trust over speed because a wrong calendar edit is expensive and visible to other people.
- Health score weights are hand-tuned. With real data I would calibrate them against user feedback.
- Prototype scope: one calendar, one user, browser timezone, no undo.

## What I would build next

1. **Undo and audit log** of every applied change.
2. **Multi-attendee negotiation:** the agent checks free/busy for attendees and sends a counter-proposal.
3. **Context from email and docs** to prep briefings and generate agendas for meetings that have none.
4. **Learned preferences:** infer the user's habits (when they like deep work, which meetings they always decline) and pre-fill goals.
5. **Team view:** shared focus blocks, meeting budgets per team, and a weekly "time spent" report for managers.
6. **Background mode:** the agent watches new invites and queues proposals instead of waiting to be asked.
