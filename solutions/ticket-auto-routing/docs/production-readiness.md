# Production readiness

The demo proves the flow end to end on seeded data. Before routing real tickets:

## Security and identity
- **Dedicated integration user** ("AI Routing Bot") with only the roles it needs, so work notes are
  clearly authored by the bot and not a person.
- **Credentials in an auth profile** on the outbound REST Message, never in plain header rows.
- **Explicit routing from caller text.** Any caller can currently write "assign to X". Decide whether
  that is acceptable, or only honour explicit routing from agent-written fields.
- Ticket text is treated as data in both prompts, and every group is validated against an allow-list.
  The model cannot assign to a group that isn't on the list.

## Data and accuracy
- **Use real history.** Point the search at the customer's resolved tickets, at least 30 per group.
- **Back-test.** Replay 2–3 months of closed tickets in note-only mode and compare the AI's group with
  the group that actually resolved the ticket. Tune the HIGH and MEDIUM thresholds from that data.
- **Shadow mode.** Run 1–2 weeks with every decision note-only, then enable auto-assign for HIGH only.
- **Keep the charters current.** Charters drive the fallback. Review them whenever teams change scope.

## Operations
- **Measure:** auto-assign rate, reassignment rate of AI-assigned tickets (the main quality signal),
  and the share of tickets sent to Service Desk.
- **Feedback loop:** when an agent reassigns an AI-routed ticket, that ticket becomes new history.
  Search improves automatically as resolved tickets accumulate.
- **Failure handling:** a classification error sends the ticket to Service Desk. If the workflow itself
  fails, the ticket stays in the triage queue. A failed run never leaves a ticket in a wrong resolver group.
- **Suggested resolutions are advisory.** They go in internal work notes only. Track how often agents
  find them useful before you consider showing anything to end users.
- **Cost:** three LLM calls per ticket (Classify, Rerank, Suggest Resolution).

## Customer-specific configuration
| Item | Where |
|---|---|
| Triage queue name | `parse-ticket.js`, Business Rule condition |
| Routable groups per platform | `GROUPS` in `plan.js`, `final-decision.js`; `SCOPES` in `url-builder.js` |
| Group charters and exclusionary systems | Classify prompt |
| Thresholds | `routing-score.js` |
| Low-confidence group | `FALLBACK_GROUP` in `final-decision.js` |
