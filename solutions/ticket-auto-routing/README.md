# Ticket Auto Routing

**Routes every new IT ticket to the right resolver group, using the ticket's own text and the history of
how similar tickets were resolved. When it isn't confident, it leaves the ticket with a human and
explains why.**

Platform-agnostic by design: the logic is four ordered rules, three LLM prompts and a handful of small
code steps. The demo ran on **ServiceNow** (ITSM) and **Aisera** (AI orchestration), but the same
solution can run on any ITSM tool with a REST API and any AI bot or automation platform that can
receive a webhook, call HTTP APIs, run code and call an LLM. See the
[porting guide](docs/porting-guide.md).

![Architecture](architecture/architecture.svg)

## The problem

Manual triage is slow, and the first routing decision is often wrong. An existing similarity-only
router showed the classic failure: on an SAP GST report ticket, it pulled four **Oracle** GST tickets
as "similar" because they shared words like *GST*, *invoice* and *report*. It found no consensus and
gave up, even though the ticket named an SAP transaction code.

## The approach

| # | Rule | Decides by | Can assign? |
|---|---|---|---|
| 1 | **Explicit routing**: the caller named a valid group | LLM reads, code validates against an allow-list | Yes |
| 2 | **Scope gate**: exclusionary systems (Salesforce, Workday, …) and platform (SAP / Oracle) | LLM, evidence-only | No (goes to Service Desk) |
| 3 | **Historical match**: search resolved tickets **scoped to that platform's groups**, rerank, score confidence | LLM reranks, code scores | Yes, on HIGH confidence only |
| 4 | **Fallback**: best group by charter | LLM proposes, code validates | No (Service Desk + recommendation) |

Anything that isn't confidently assigned goes to the **Service Desk** group, with the recommended
resolver in the note. Every note also carries **suggested resolution steps**, based on how the closest
past tickets were actually fixed. Everything that changes a ticket is decided in code. Every run writes
one structured work note:

```
[AI Routing] Decision: ASSIGNED to GD-SD-SAP-SD
Method: top1
Confidence: 1 (HIGH)
Platform: SAP | Primary system: SAP
Explicit route: none | Exclusion: none
Evidence: INC0014610 (0.95)
Reason: Similar resolved tickets were handled by GD-SD-SAP-SD.

[AI Suggested Resolution] (based on INC0014610) - verify before applying
Likely the units are missing from the plant-to-GSTIN mapping used by ZSTR_GST.
1. Check the plant-to-GSTIN mapping table used by ZSTR_GST for Units 0137 and 0138
...
```

Details: [solution flow](docs/solution-flow.md) · [architecture](architecture/architecture.md)

## How it runs

1. A ticket is created with no group, or in the triage queue.
2. The ITSM tool pushes an event (ticket number only) to the AI platform.
3. The AI platform runs one linear workflow: fetch the ticket → gate → classify → scoped search →
   rerank → score → decide → update the ticket.
4. The ticket is either **assigned** to the resolver group, or sent to **Service Desk** with a
   recommended resolver and the reason. Both get suggested resolution steps.

No manual step is needed. An optional chat agent ("Route INC0014605") uses the same building blocks
for on-demand routing.

## Demo

- **Stack:** ServiceNow (demo instance) + Aisera workflows, Prompt Studio and Hyperflow, Azure OpenAI GPT-5.5
- **Data:** 10 resolver groups (7 SAP, 3 Oracle) and 40 resolved history tickets, including Oracle GST
  decoys that reproduce the original failure
- **Result:** the original failing case (SAP `ZSTR_GST` report) now routes to SAP-SD with HIGH
  confidence. New tickets saved in the ServiceNow UI are routed within about a minute, and
  out-of-scope tickets stay in triage with a reason.

Test cases, results and the defects fixed along the way are in [docs/test-plan.md](docs/test-plan.md).
Screenshots: [screenshots/](screenshots/).

## Repository layout

```
ticket-auto-routing/
├── README.md
├── architecture/
│   ├── architecture.md            components, design principles, data flow
│   ├── architecture.svg
│   └── decision-flow.svg
├── docs/
│   ├── solution-flow.md           the four rules, scoring maths, AI vs code split
│   ├── porting-guide.md           running it on other ITSM tools and AI platforms
│   ├── test-plan.md               test data, cases, demo results
│   └── production-readiness.md    security, back-testing, shadow mode, config
├── prompts/
│   ├── classify-ticket.md
│   ├── rerank-candidates.md
│   └── suggest-resolution.md
├── reference-implementation/      the ServiceNow + Aisera build, node by node
│   ├── README.md                  wiring of every workflow and node
│   ├── itsm-servicenow/           Business Rule, REST Message, test data scripts
│   └── ai-platform-aisera/        JavaScript for every code node, chat agent instructions
└── screenshots/
```

## Quick start (reference implementation)

1. **ITSM:** run the test-data scripts, create the REST Message and the Business Rule
   ([details](reference-implementation/README.md#itsm-side-servicenow)).
2. **AI platform:** create the three prompts, then the sub flows 01–06 and 09, the main workflow 07 and the event
   handler 08 ([wiring tables](reference-implementation/README.md#ai-platform-side-aisera)).
3. **Test:** create a ticket in `AI Triage` with
   *"Posting period 008 2026 not open in FB60 for company code 1300 (message no. F5 201)"* and refresh
   after a minute. Expected result: assigned to `GD-SD-SAP-FICO`.

## Status

Demo-validated (October 2026). Not yet run on production data. See
[production readiness](docs/production-readiness.md) for the path to go-live.
