# Reference implementation: ServiceNow + Aisera

This is the build used for the demo. The prompts and JavaScript carry over to any platform; only the
node types, variable syntax and the ServiceNow calls are specific (see
[`../docs/porting-guide.md`](../docs/porting-guide.md)).

Placeholders to replace before use:

| Placeholder | Where | Meaning |
|---|---|---|
| `https://<your-instance>.service-now.com` | REST GET in the conversation workflow, REST POST in Update Ticket | ITSM base URL |
| `<BOT_ID>`, `<CONVERSATION_FLOW_ID>`, `<NOT_NOW_FLOW_ID>` | `build-notification.js` | Bot and flow IDs the notification buttons start |
| Event Studio URL and auth | REST Message `Aisera Event Studio` | Where ServiceNow pushes the event |
| `you@example.com` | `create-test-tickets.js` | Caller for test tickets |

```
reference-implementation/
├── itsm-servicenow/
│   ├── push-event-business-rule.js     async insert rule -> POST via the REST Message
│   ├── outbound-rest-message.md        REST Message setup + how to test it
│   └── test-data/
│       ├── create-salesforce-ci.js     the "Salesforce" application CI
│       └── create-test-tickets.js      13 synthetic cases, one per run
└── ai-platform-aisera/
    ├── 01-notify-caller/               SF Error Notify (event-triggered)
    ├── 02-error-assist/                SF Error Assist (conversation workflow)
    ├── 03-generate-solution/           sf_solution (sub flow)
    └── 04-update-ticket/               sf_update_ticket (sub flow)
```

## ITSM side (ServiceNow)

1. Run `test-data/create-salesforce-ci.js`.
2. Create the REST Message from `outbound-rest-message.md` and test it.
3. Create the Business Rule from `push-event-business-rule.js` (async, insert, Salesforce condition).
4. The integration user needs read on `incident` and `sys_user`, write on `incident.work_notes` and
   `incident.comments`, and create on `sys_attachment` (in practice the `itil` role).

## AI platform side (Aisera)

Build and test in this order: the three prompts ([`../prompts/`](../prompts/)), the two sub flows, the
conversation workflow, then the notify workflow. Workflow variables are written `${name}`; prompt
variables are `$name`. JavaScript nodes return **one object**, mapped to one output variable, and later
nodes read its fields (`${diag.is_sf}`).

### 01 - SF Error Notify (workflow, triggered by the event)

| # | Node | Detail |
|---|---|---|
| 1 | Start (event) | Payload arrives as `response`: `sys_id`, `number`, `short_description`, `caller_email` |
| 2 | JS `build-notification.js` | input `response` → notification payload |
| 3 | Proactive notification | The same notification action the tenant's other proactive flows use, with that payload |

A second one-node flow (Message: *"No problem. If you change your mind, ask me to explain the
Salesforce error on your ticket."*) is the **Not now** button.

### 02 - SF Error Assist (conversation workflow, started by "See details")

The workflow must be **published** and available to the bot. It takes no required inputs: a button
starts it with none. `number` is an optional input, used only when someone starts it from chat with an
INC number.

| # | Node | Detail |
|---|---|---|
| 1 | Set Variable (defaults) | `user_clarification` = `"none"`, `user_feedback` = `"none"`, `clarify_count` = `"0"` (strings) |
| 2 | Branch | `${number == null \|\| number == ''}` → lookup (3) · else → Ticket Details sub flow by number |
| 3 | REST GET | Latest open Salesforce incident of `${flowUser.EmailId}` (URL in `find-ticket.js`) → `snow_response` |
| 4 | JS `find-ticket.js` | → `ticketDetails` |
| 5 | Set Variables | `sys_id`, `short_description`, `description`, `cmdb_ci` from `ticketDetails.*`; display variable `ticketNo` = `${ticketDetails.number}` |
| 6 | Branch | `${ticketDetails.ticket_count.equalsIgnoreCase("1")}` → 7 · else → ask for the INC number → Ticket Details sub flow → 7 |
| 7 | Message | "Looking into this error…" |
| 8 | Prompt `SF_Error_Diagnose` | `short_description`, `description`, `cmdb_ci`, `user_clarification` → response `ticketResponse` |
| 9 | JS `parse-diagnosis.js` | → `diag` |
| 10 | Branch | `${diag.parse_ok.equalsIgnoreCase("false")}` → hand-over message, end |
| 11 | Branch | `${diag.is_sf.equalsIgnoreCase("false")}` → hand-over message, end |
| 12 | Branch | `${diag.enough.equalsIgnoreCase("false")}` → if `clarify_count` is `"1"`: hand-over, end · else User Input `${diag.clarifying_question}` → `user_clarification`, set `clarify_count` = `"1"`, go to 7 |
| 13 | Message | `${diag.explanation_text}` |
| 14 | Branch | `${diag.solution_available.equalsIgnoreCase("false")}` → "This one needs your support team…", end |
| 15 | User Input (options) | "Would you like me to show the solution?" **Yes, show the solution** · **Ask a question** · **No, thanks** → `choice` |
| 16 | Ask a question | User Input (text) → `question` → Prompt `SF_Error_FollowUp` (`diagnosis` = `${diag.diagnosis_json}`) → response `errorFollow` → JS `parse-follow-up.js` → `promptRespond` → Message `${promptRespond.answer}` → go to 15 |
| 17 | No, thanks | Message "No problem. Your ticket ${ticketNo} stays with the support team.", end |
| 18 | Sub flow `sf_solution` | `diagnosis_json` = `${diag.diagnosis_json}`, `user_feedback` = `${user_feedback}` → `sol` |
| 19 | Branch | `${sol.solution_ok.equalsIgnoreCase("false")}` → "…your support team will take it from here.", end |
| 20 | Message | `${sol.solution_text}` |
| 21 | User Input (options) | "Does this look good? I can add it to ${ticketNo}." **Looks good, add to ticket** · **Regenerate** · **Cancel** → `choice2` |
| 22 | Regenerate | User Input "What should change?" → `user_feedback` → go to 18 |
| 23 | Cancel | Message "Okay, nothing was added to your ticket.", end |
| 24 | Sub flow `sf_update_ticket` | `sys_id`, `${sol.fixed_code_clean}`, `${sol.file_name_clean}`, `${sol.work_note_text}` → `ok` |
| 25 | Branch + Message | `${ok == true}` → "Added the solution to ${ticketNo}. A developer will review and deploy it." · else "I couldn't update the ticket. Please try again in a moment." |

### 03 - sf_solution (sub flow)

| # | Node | Detail |
|---|---|---|
| 1 | Start | Inputs `diagnosis_json`, `user_feedback` · output `sol` |
| 2 | Set Variable | `api_version` = `62.0` |
| 3 | Prompt `SF_Error_Solution` | `diagnosis` = `${diagnosis_json}`, `sf_source` = `none`, `api_version`, `user_feedback` → response `solutionResponse` |
| 4 | JS `build-solution.js` | inputs `solutionResponse`, `diagnosis_json` → `sol` |

To ground it in the org, add a Tooling API GET for the component before node 3 and pass its body as
`sf_source`, with `<` / `>` replaced by `_LT_` / `_GT_` (see production readiness).

### 04 - sf_update_ticket (sub flow)

| # | Node | Detail |
|---|---|---|
| 1 | Start | Inputs `sys_id`, `fixed_code_clean`, `file_name_clean`, `work_note_text` · output `ok` |
| 2 | JS `build-ticket-update.js` | input `work_note_text` → `req` |
| 3 | Action: Update Ticket | Ticket Id `${sys_id}`, Data Source ServiceNow Ticket, Ticket Type Incident, Use Custom Fields `${req.body_text}` → `upd_success` |
| 4 | Branch | `${fixed_code_clean != null && fixed_code_clean != ''}` → 5 · else → 6 |
| 5 | Execute Rest Call (POST) | `https://<your-instance>.service-now.com/api/now/attachment/file?table_name=incident&table_sys_id=${sys_id}&file_name=${file_name_clean}`, payload `${fixed_code_clean}`, header `Content-Type: text/plain` |
| 6 | Set Variable | `ok` = `${upd_success}` |

## Platform behaviours found while building (worth knowing on any platform)

- **Prompt placeholders were `$name`.** `{{name}}` and `${name}` were sent to the model literally. A
  one-line probe prompt (`A=[{{x}}] B=[${x}] C=[{x}] D=[$x]`) settles this in one run.
- **Anything in `<…>` disappeared** from prompt text and from model output. Apex generics travel as
  `_LT_` / `_GT_` tokens and are swapped back in code.
- **A prompt node returns one response string**, even when output variables are declared; parse it in
  code.
- **Prompt inputs must be String or Integer.** A reference field returned as an object made the prompt
  node fail with "Failed to fetch llm chat answer".
- **JavaScript nodes need `return`.** The output variable is whatever the script returns; assigning to
  a variable named like the output leaves it empty.
- **Branch on strings.** Code nodes return `"true"` / `"false"`; compare with `.equalsIgnoreCase(...)`.
  Counters are kept as string values (`"0"`, `"1"`), not incremented.
- **Assigning to a flow's own input parameter inside the flow did not stick.** Use a separate variable
  for display (`ticketNo`).
- **The generic REST action failed on PATCH and PUT** with `ClassCastException` before sending, whatever
  the headers or payload; POST worked. The Update Ticket action wrote work notes and comments, with
  Custom Fields given as a JSON string.
- **The chat channel rendered HTML** (`<b>`, `<br>`, `<pre>`), not Markdown.
- **A flow that errors shows the bot's generic fallback** ("I am having trouble finding what you
  need…"). When a button seems not to launch a flow, check that flow's run log first.
- **Leftover debug Message nodes** render as empty chat bubbles.
