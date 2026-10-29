# Solution flow

![Decision flow](../architecture/decision-flow.svg)

Routing runs the same four rules, in this order, on every ticket. Each rule either decides or hands
over to the next one. Three LLM calls are used per ticket: **Classify** (Rules 1, 2 and the fallback
pick), **Rerank** (Rule 3) and **Suggest Resolution** (resolution steps for the note). Everything else,
including the confidence maths and whether to assign, is deterministic code.

Only two outcomes assign a **resolver** group: an explicit valid request (Rule 1) and a HIGH band
(Rule 3). Every other outcome sends the ticket to the **Service Desk** group, with the AI's
recommended resolver in the note.

## 0. Intake and gate

- The ITSM tool pushes an event when a ticket is created **unrouted**: either with no group, or in the
  landing queue (`AI Triage` in the demo).
- The workflow re-reads the ticket through the ITSM API. Event payloads are never trusted for content.
- Gate: stop if the ticket doesn't exist or is already in a real group. Re-running the workflow on a
  routed ticket is therefore always safe.

## Rule 1 - Explicit routing

The caller asked for a specific group ("assign to GD-SD-SAP-FICO", "please route to …").

- It only counts if the name matches the **allow-list** of routable groups, after normalising case,
  spaces and hyphens. "Assign to the SAP MM team" is not a valid group, so it falls through to Rule 2.
- People mentioned as context ("Suresh already looked at it", "manager approved") are not routing
  instructions.
- Two or more valid groups requested → `explicit_conflict`: nothing is assigned and both groups are
  listed in the note.

**Outcome:** assign (`explicit`).

## Rule 2 - Scope gate

**2A. Exclusionary systems.** The LLM identifies the *primary* system: where the failure happens or
where the change must be made. A system that is only mentioned for comparison or as a data source is
secondary.

| Ticket | Primary | Result |
|---|---|---|
| "Salesforce CPQ quote locked; SAP customer number field greyed out" | Salesforce | excluded |
| "Invoice wrong in SAP; Salesforce shows the correct price" | SAP | continue |
| "Delivery notes from SAP stuck in SP01" (spool) | SAP | continue (not printer hardware) |

**Outcome when excluded:** sent to Service Desk (`out_of_scope`), with a note.

**2B–2E. Platform.** The platform (SAP / Oracle / QAD / none) is decided from verbatim evidence only:
transaction codes, SAP objects, runtime errors and message numbers, Oracle concurrent programs and so
on. Generic words like *invoice*, *GST*, *report* or *payment* are not evidence on their own.

**Outcome when no platform:** sent to Service Desk (`no_platform`).

## Rule 3 - Historical match

This is where the earlier similarity-only router went wrong. On an SAP GST report ticket it pulled four
Oracle GST tickets as "similar", because they shared the words *GST*, *invoice* and *report*. Consensus
failed and the ticket fell through to fallback rules. The fix has three parts.

**3a. Search terms (LLM → code).** The classifier proposes:
- *anchors*: exact identifiers where the problem happens (`ZSTR_GST`, `F5 201`,
  `TSV_TNEW_PAGE_ALLOC_FAILED`). A transaction the user only used to look something up (for example
  "visible in VF03") is not an anchor.
- *keywords*: 1–2 word symptom phrases plus resolver synonyms (`GSTR-1`, `posting period`, `GSTIN`).

Code then drops generic words, document numbers and long phrases, and builds the query clauses. The
model never writes query syntax.

**3b. Scoped retrieval (code).** Two searches run against **resolved** tickets, **restricted to the
groups of the platform from Rule 2**: one on anchors, one on keywords. The results are merged and
de-duplicated, with up to 15 candidates. Once Rule 2 says SAP, an Oracle ticket can never be a
candidate.

**3c. Rerank (LLM).** For every candidate, the model judges:
- *relevance* 0–1, where 0.9 or more means same object and same symptom, so the same fix would apply;
- *intent_match*: would the same team, doing the same kind of work, resolve it? This uses the
  candidate's close notes, which describe what was actually done.

**3d. Confidence (code).** Per candidate group:

```
weight(ticket)   = relevance
                   x 0.6  if the ticket was reassigned before (it bounced, so it's weaker evidence)
                   x 1.2  if it matched on an exact anchor
group score      = sum of weights of tickets with intent_match = true and relevance >= 0.5
confidence       = top group score / sum of all group scores
margin           = (top - second) / sum of all group scores
```

| Band | Condition | Action |
|---|---|---|
| HIGH (`consensus`) | >= 2 supporting tickets, confidence >= 0.6, margin >= 0.2 | assign |
| HIGH (`top1`) | best relevance >= 0.85 and confidence >= 0.6 | assign |
| MEDIUM (`weak_match`) | confidence >= 0.4 and best relevance >= 0.6 | Service Desk, recommended resolver in the note |
| LOW | anything else | Rule 4 |

`top1` exists because some problems have exactly one strong historical twin. For example, the
`ZSTR_GST` ticket's only match is a previous `ZSTR_GST` ticket, and that is enough.

Safety check: an assigned group must belong to the platform decided in Rule 2.

## Rule 4 - Fallback by charter

The classifier has already picked the best group from the **group charters** (one-line descriptions
of what each team owns) for the identified platform. Exclusion checks run first: login, password or
T-code access → Security; firefighter or SoD → GRC; audit evidence → ITGC; dumps, jobs, transports,
spool → Basis; IDoc or EDI → Integration.

**Outcome:** sent to Service Desk with the charter group as the recommended resolver (`fallback_clear`
or `fallback_weak`). Fallback never assigns a resolver group in this design.

## Suggested resolution

After scoring, the **Suggest Resolution** step writes 3-6 first steps for whoever picks the ticket up.
- **Grounded in history:** it uses only the past tickets the reranker judged as the same problem
  (intent match, relevance >= 0.7), up to three, and their close notes, adapted to the new ticket.
- **General when there's no history:** if nothing qualifies, it gives general diagnostic steps and the
  note says so.
- **Guardrails:** it never invents config values or document numbers, never suggests bypassing
  approvals or security controls, and goes in the internal work note only, never in customer-visible
  comments.

## Output: one work note per decision

```
[AI Routing] Decision: ASSIGNED to GD-SD-SAP-FICO
Recommended resolver: GD-SD-SAP-FICO
Method: top1
Confidence: 1 (HIGH)
Platform: SAP | Primary system: SAP
Explicit route: none | Exclusion: none
Evidence: INC0014617 (0.95)
Reason: Similar resolved tickets were handled by GD-SD-SAP-FICO.

[AI Suggested Resolution] (based on INC0014617) - verify before applying
Likely posting period 009 is closed for account type K in the company code's variant.
1. Open OB52 and check the posting period variant used by company code 1400
2. Confirm whether period 009 is open for account type K (vendors)
3. If it should be open per the close calendar, get finance controller approval and open it
4. Ask the user to re-post one invoice in FB60 to confirm
```

Low-confidence tickets get the same note with `Decision: SENT TO Service Desk (low confidence)` and
the recommended resolver, so the Service Desk agent can forward the ticket in one click.

## What is AI and what is code

| Step | LLM | Code |
|---|---|---|
| Explicit route, primary system, platform | judges | validates groups against the allow-list |
| Search terms | proposes | filters, builds the query, scopes it to the platform |
| Similar ticket relevance | judges | discards numbers that weren't retrieved |
| Confidence, band, assign or not | - | all |
| Fallback group | proposes | validates against the platform's groups |
| Resolution steps | writes, from similar tickets' close notes | picks the reference tickets, formats, ASCII only |
| Work note | - | template, ASCII only |
