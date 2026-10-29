# Test plan

All data is synthetic. Tickets are created with
[`create-test-tickets.js`](../reference-implementation/itsm-servicenow/test-data/create-test-tickets.js),
one at a time, because the conversation picks the caller's **latest** open Salesforce incident.

## 1. Prompt tests (run in the prompt tool before any workflow)

### Diagnose

| # | Short description / description | Expect | Result |
|---|---|---|---|
| D1 | Bulk account update failing / `…System.LimitException: Too many SOQL queries: 101 Trigger.AccountTrigger: line 3` | ApexTrigger `AccountTrigger`, line 3, object Account, code | Pass (0.96) |
| D2 | Can't save opportunity / `FIELD_CUSTOM_VALIDATION_EXCEPTION, Close Date cannot be in the past` | ValidationRule, Opportunity, config, component name left empty | Pass (0.96) |
| D3 | Discount not applying / `System.NullPointerException … Class.OpportunityService.applyDiscount: line 27` | ApexClass, line 27, code | Not run |
| D4 | Case assignment fails / `INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY …` | access | Not run |
| D5 | Salesforce not working / `Salesforce not working since morning` | Salesforce error, not enough detail, one clarifying question | Covered end to end |
| D6 | Password prompts / `Outlook keeps asking for my password`, CI Microsoft 365 | Not a Salesforce error | Not run |
| D7 | D5 + clarification `Mass-updating 150 accounts gives Too many SOQL queries: 101` | Valid; component left empty (not guessed) | Not run |

### Solution (diagnosis = D1 output, API 62.0)

| # | Source | Feedback | Expect | Result |
|---|---|---|---|---|
| S1 | Seed `AccountTrigger` (query in loop) | none | Cause confirmed, full corrected trigger, Contact logic kept, one query, one DML | Pass |
| S2 | none | none | Example pattern: after update only, child-object placeholders, one query, one DML | Pass after 3 prompt fixes |
| S3 | Clean trigger with no query in a loop | none | Cause not confirmed, no code | Not run |
| S4 | none (diagnosis = D2) | none | No code, numbered config steps | Pass |
| S5 | none | `add a recursion guard` | Guard added; helper class after a `// ===== X.cls =====` separator | Pass after 1 prompt fix |

### Follow-up (diagnosis = D1 output)

| # | Question | Expect | Result |
|---|---|---|---|
| F1 | Will this happen if I edit just one account? | In scope, hedged, explains per-transaction limit | Pass |
| F2 | Is there a workaround until it's fixed? | In scope, smaller batches first | Pass |
| F3 | What's the weather in Noida? | Out of scope, one polite redirect | Pass |

## 2. Sub flow tests

| Sub flow | Input | Expect | Result |
|---|---|---|---|
| Generate solution | D1 diagnosis, feedback `none` | `solution_ok` true, code with real `<` `>`, HTML message, work note | Pass |
| Generate solution | D1 diagnosis, recursion-guard feedback | Guard present | Pass |
| Generate solution | D2 diagnosis | No code, steps, `solution_ok` true | Pass |
| Update ticket | test note + small trigger | Work note, customer comment, `.trigger` attachment, `ok` true | Pass |
| Update ticket | test note, no code | Note and comment only, no attachment | Pass |

## 3. End-to-end

| Run | Path | Result |
|---|---|---|
| E1 | Lookup → diagnose → explanation → Ask a question → No, thanks | Pass |
| E2 | Lookup → Yes → solution → Regenerate (recursion guard) → Looks good | Pass: work note, comment and attachment on the incident |
| E3 | Ticket with only the Salesforce CI (no "Salesforce" in text) → business rule → Teams notification → See details | Pass after the CI-object fix |
| E4 | `REQUIRED_FIELD_MISSING [Pricebook2Id]` from an ERP sync (ambiguous code vs config) | Pass: explanation covers both, code pattern returned |

## 4. Trigger and lookup matrix

| # | Short description | Description | CI | Matches on | Expect |
|---|---|---|---|---|---|
| 1 | Salesforce bulk account update failing | `…Too many SOQL queries: 101…` | – | Short description | Code fix |
| 2 | Opportunity mass update timing out | `In Salesforce, … Apex CPU time limit exceeded…` | – | Description | Code fix |
| 3 | Quote total not calculating | `System.NullPointerException…QuoteService…` | ✓ | CI only | Code fix |
| 4 | Case closure batch failing | `…Too many DML statements: 151…` | ✓ | CI only | Code fix |
| 5 | Salesforce lead import rejected | `Salesforce Data Import Wizard: DUPLICATE_VALUE…` | ✓ | All three | Data steps |
| 6 | Can't save opportunity in Salesforce | `FIELD_CUSTOM_VALIDATION_EXCEPTION…` | ✓ | Short description + CI | Config steps |
| 7 | Case assignment to queue fails | `Salesforce shows INSUFFICIENT_ACCESS…` | – | Description | Access steps |
| 8 | Opportunity stage update error | `An unhandled fault has occurred in this flow…` | ✓ | CI only | Config steps (flow) |
| 9 | Order sync from ERP failing | `System.DmlException … REQUIRED_FIELD_MISSING … [Pricebook2Id]` | ✓ | CI only | Code or config |
| 10 | System not working since morning | `Keeps throwing errors, can't save anything` | ✓ | CI only | Clarifying question |
| 11 | Need Salesforce license for new joiner | `Please provide a Sales Cloud license…` | – | Short description | Hand-over (not an error) |
| 12 | Printer not working on floor 3 | `Printer shows offline…` | ✓ (wrong CI) | CI only | Hand-over |
| 13 | Laptop running slow | `Takes 10 minutes to boot…` | – | Nothing | **No notification** |

## 5. Defects found and fixed

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | Diagnose returned the empty JSON template | Prompt variables never substituted: the prompt tool uses `$name`, not `{{name}}` or `${name}` | Probe prompt `A=[{{x}}] B=[${x}] … D=[$x]` found the syntax; all prompts switched to `$name` |
| 2 | Probe showed `[<description>]` came back as `[]` | The prompt tool strips anything in angle brackets | No `<…>` anywhere in prompts; source markers became `--- BEGIN SOURCE ---` |
| 3 | Generated Apex had `List x = new List()` | Angle brackets stripped from model **output** too; `<` escapes were also eaten | Model writes `_LT_` / `_GT_`; code swaps them back (raw for the ticket, `&lt;`/`&gt;` for chat) |
| 4 | Example pattern invented a duplicate-name validation, 7 trigger events, a handler class | "Example" was too open | Prompt pins: one file, only the event in the error, technique as real code, no invented rules |
| 5 | Example updated `Trigger.new` in an after trigger and re-queried Account | Missing Apex trigger rules; "only objects named" left no child object | Explicit trigger rules + `Related_Object__c` / `Parent__c` placeholders |
| 6 | Recursion-guard version declared a class inside the `.trigger` | Apex does not allow it | Rule: helper class goes after a `// ===== X.cls =====` separator |
| 7 | Config steps showed "1. 1. In Salesforce Setup…" | Model returned all steps in one numbered string | List builder splits lines and strips existing numbering |
| 8 | REST PATCH and PUT to the incident failed with `ClassCastException` in ~0.2 s, nothing sent, any headers/payload | The platform's generic REST action could not do PATCH/PUT in this tenant (POST worked) | Write note and comment with the platform's **Update Ticket** action; keep REST POST for the attachment |
| 9 | Update Ticket succeeded but the ticket was unchanged | Custom Fields received the note text, not field JSON | Pass `{"work_notes": …, "comments": …}` as a JSON **string** |
| 10 | Conversation said "Added to ." | Assigning to the flow's input parameter `number` inside the flow did not stick | Separate display variable `ticketNo` |
| 11 | Lookup ignored the caller | `${user_email}` resolved to empty in the URL | User's own email from the platform's flow user; hard-coded email only for tests |
| 12 | Prompt node failed ("Failed to fetch llm chat answer") once the CI was set | ServiceNow returned `cmdb_ci` as an object; prompt inputs must be String | `sysparm_exclude_reference_link=true` and `display_value` in the parser |
| 13 | `**bold**` shown literally | Channel renders HTML, not Markdown | `<b>`, `<br>`, `<pre>` with escaped code |
| 14 | Notification for one ticket, solution added to another | Lookup picks the latest open Salesforce incident for the user; the newer ticket had a different caller | Data fix; long-term, pass the ticket from the notification (see production readiness) |
| 15 | Empty chat bubble before "Added the solution" | Leftover debug Message node in the update sub flow | Removed |
