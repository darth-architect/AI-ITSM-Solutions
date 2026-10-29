# Production readiness

The demo proves the conversation and the write-back. These are the steps between the demo and a live
service.

## 1. Ground the answers in the org

Today the model sees only the ticket text. The solution prompt already accepts `sf_source`, so the first
upgrade is to fetch it:

- Query the Tooling API for the component the diagnosis identified
  (`SELECT Name, Body FROM ApexTrigger|ApexClass WHERE Name = '…'`) with a read-only integration user
  (API Enabled, View Setup and Configuration).
- Convert `<` / `>` to `_LT_` / `_GT_` before passing it in (the demo platform strips angle brackets).
- The model then corrects the real file and reports whether the code confirms the diagnosed cause
  (`self_check.cause_confirmed`). Test S1 in the [test plan](test-plan.md) shows this working.

Optional next steps: validation-rule metadata for config errors, a compile check in a sandbox
(`ContainerAsyncRequest` with `IsCheckOnly=true`) feeding errors back as feedback, and a knowledge base of
the org's own known errors.

## 2. Pass the ticket from the notification

The conversation currently finds the user's **latest open Salesforce incident**. That is right in almost
every case, but two open Salesforce tickets for the same user can be confused. Pass the ticket number
through the notification button (session variable, conversation context or a button parameter, whatever
the bot platform supports) and keep the lookup only as a fallback.

## 3. Who sees code

The demo shows code to the caller. In production, callers are often business users:

- show the explanation to everyone, and the solution only to members of a Salesforce developer or admin
  group; or
- send the solution step to the Salesforce support queue instead of the caller.

## 4. Security and data

- The event carries no ticket content beyond the short description; the conversation re-reads the ticket.
- The REST Message holds the endpoint and credentials; the Business Rule script holds none.
- Ticket text is untrusted input. The prompts treat it as data and only extract identifiers from it.
- Generated code is never deployed automatically and the ticket is never resolved.
- Review what ticket text (possibly containing record IDs or customer data) may be sent to the LLM
  provider under your data-processing terms.

## 5. Rollout

1. **Shadow mode.** Run diagnose on new Salesforce incidents and write the explanation as an internal
   work note only, no user message. Have developers rate it.
2. **Agent assist.** Show the explanation and solution to the assigned developer in the agent workspace.
3. **Caller-facing.** Enable the notification for one team, then widen.

Track: share of tickets the diagnosis classified correctly, share of solutions developers used,
regeneration rate, time from ticket creation to fix.

## 6. Configuration to externalise

| Item | Demo value |
|---|---|
| Trigger condition | short description, description or CI contains "salesforce" |
| Bot IDs, flow IDs | hard-coded in the notify code |
| Salesforce API version | `62.0` |
| Model | Azure OpenAI GPT-5.1, temperature 0.1-0.2 |
| ServiceNow base URL | in the REST actions |
