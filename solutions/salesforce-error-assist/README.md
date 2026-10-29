# Salesforce Error Assist

**When someone raises an incident about a Salesforce error, the AI assistant messages them, explains in
plain language what is failing and why, offers a fix, and - only after they confirm - adds the fix to the
ticket for the support team.**

Platform-agnostic by design: three LLM prompts, a few small code steps and two user confirmations. The
demo ran on **ServiceNow** (ITSM), **Aisera** (AI orchestration and chat, delivered in Microsoft Teams)
and **Azure OpenAI GPT-5.1**, but the same solution runs on any ITSM tool with a REST API and any bot
platform that can send a proactive message, hold a short conversation, run code and call an LLM. See the
[porting guide](docs/porting-guide.md).

![Architecture](architecture/architecture.svg)

## The problem

Salesforce errors reach the service desk as raw exception text - `System.LimitException: Too many SOQL
queries: 101`, `FIELD_CUSTOM_VALIDATION_EXCEPTION`, `REQUIRED_FIELD_MISSING`. The person who hit the error
can't read it, L1 can't act on it, and the ticket waits in a developer queue until someone works out what
it means. Yet most of these errors are well documented: the platform rule behind them, the common causes
and the standard fix pattern are known before anyone opens the org.

## The approach

| # | Stage | Decides by | Writes to the ticket? |
|---|---|---|---|
| 1 | **Identify** - error name and code, component, line, object, taken only from the ticket text | LLM | No |
| 2 | **Validate** - is this a genuine Salesforce problem, and is there enough detail to explain it? | LLM judges, code branches | No (hand-over, or one clarifying question) |
| 3 | **Enlighten** - what is happening, why, common causes, most likely cause here, how to confirm, impact | LLM | No |
| 4 | **Solution** - a fix pattern or click-level steps, with a self-check, regenerated on feedback | LLM drafts, **user confirms**, code writes | Yes, after the second confirmation only |

Stages 1-3 are one LLM call. The user confirms twice: once to see the solution, once to add it to the
ticket. The write-back is a work note, a customer-visible comment and the code as an attachment. The
ticket is never resolved, because the fix still needs a developer's review and deployment.

```
[AISERA-SF-SOLUTION] AI-generated and confirmed by the caller in Aisera. Review before deploying.
Error: Too many SOQL queries: 101 (AccountTrigger)
Why: Salesforce enforces a limit of 100 SOQL queries per transaction. ...
Most likely cause: ... SOQL inside a loop during AfterUpdate (inferred from the error message).
Source check: No source code was provided; the fix is based on the error message only.
Solution: Bulk-safe after update trigger pattern ...
Changes:
- ...
Test: ...
Deploy: ...
Code: attached as AccountTrigger.trigger (example pattern)
```

Details: [solution flow](docs/solution-flow.md) · [architecture](architecture/architecture.md)

## How it runs

1. An incident is created that mentions Salesforce in its short description or description, or has the
   Salesforce configuration item.
2. The ITSM tool pushes an event (number, short description, caller email) to the AI platform.
3. A notify workflow sends the caller a proactive chat message: **See details** / **Not now**.
4. **See details** starts the conversation: find the caller's latest open Salesforce incident, diagnose
   it, explain it, answer follow-up questions, show the solution, regenerate on feedback.
5. **Looks good, add to ticket** writes the work note, the comment and the attachment.

## Where the answers come from

Only the model's own Salesforce knowledge. The demo has no knowledge base, no web search and no access to
the Salesforce org, so every explanation is marked *inferred from the error message* and every solution
without source code is an **example pattern** with labelled placeholders. That is enough for
well-documented platform errors and is stated plainly in the work note. Grounding it in the org (fetching
the real Apex source, which the solution prompt already supports) is the first step in
[production readiness](docs/production-readiness.md).

## Demo

- **Stack:** ServiceNow demo instance + Aisera (Event Studio, workflows, Prompt Studio, proactive
  notifications in Teams) + Azure OpenAI GPT-5.1
- **Data:** synthetic incidents covering governor limits (SOQL, CPU, DML), null pointer, mixed DML,
  validation rule, access, row lock, duplicate value, flow fault, required field, a vague ticket, a
  non-error request and negative cases ([test plan](docs/test-plan.md))
- **Result:** a ticket saved in ServiceNow - including one that only carries the Salesforce CI and never
  says "Salesforce" - produces a Teams notification; the conversation explains the error, answers
  follow-up questions, regenerates on feedback ("add a recursion guard") and writes the work note,
  comment and `.trigger` attachment back to the incident.

## Repository layout

```
salesforce-error-assist/
├── README.md
├── architecture/
│   ├── architecture.md            components, design principles, data flow
│   └── architecture.svg
├── docs/
│   ├── solution-flow.md           the four stages, conversation flow, JSON contracts, AI vs code
│   ├── porting-guide.md           running it on other ITSM tools and bot platforms
│   ├── test-plan.md               prompt tests, end-to-end runs, trigger matrix, defects fixed
│   └── production-readiness.md    grounding, ticket hand-off, security, rollout
├── prompts/
│   ├── diagnose-error.md          identify + validate + enlighten
│   ├── generate-solution.md       fix pattern or steps, self-check
│   └── follow-up-answer.md        scoped Q&A on the diagnosed error
├── reference-implementation/      the ServiceNow + Aisera build, node by node
│   ├── README.md                  wiring of every workflow and node + platform behaviours
│   ├── itsm-servicenow/           Business Rule, REST Message, CI and test-ticket scripts
│   └── ai-platform-aisera/        JavaScript for every code node
└── screenshots/
```

## Quick start (reference implementation)

1. **ITSM:** create the Salesforce CI, the REST Message and the Business Rule
   ([details](reference-implementation/README.md#itsm-side-servicenow)).
2. **AI platform:** create the three prompts, the two sub flows, the conversation workflow and the notify
   workflow ([wiring tables](reference-implementation/README.md#ai-platform-side-aisera)).
3. **Test:** create an incident for yourself with the description
   *"AccountTrigger: execution of AfterUpdate caused by: System.LimitException: Too many SOQL queries: 101
   Trigger.AccountTrigger: line 3, column 1"* and the Salesforce CI. Expected: a chat notification, an
   explanation of the SOQL limit, a bulk-safe trigger pattern, and a work note plus attachment on the
   incident after you confirm.

## Status

Demo-validated (October 2026). Knowledge-only (no org access) and not yet run on production data. See
[production readiness](docs/production-readiness.md) for the path to go-live.
