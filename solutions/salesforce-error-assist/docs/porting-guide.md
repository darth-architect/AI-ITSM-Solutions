# Porting guide

The solution needs six capabilities. Anything that provides them can run it.

| # | Capability | Used for | Demo (Aisera + ServiceNow) |
|---|---|---|---|
| 1 | **Event on ticket create** with a condition | Start only for Salesforce-related tickets | ServiceNow async Business Rule + outbound REST Message to Aisera Event Studio |
| 2 | **Proactive chat message with buttons** to a named user | The notification | Aisera proactive notification (custom payload, follow-up actions of type `flow`), delivered in Teams |
| 3 | **Conversation with choices and free text** | Explain, ask, confirm, regenerate | Aisera workflow: User Input (options / text), Message, Branch nodes |
| 4 | **LLM call with a prompt template** | Diagnose, solution, follow-up | Prompt Studio prompts called from Prompt nodes |
| 5 | **Code step** | Parse JSON, build messages and notes | JavaScript nodes |
| 6 | **Ticket API**: query, update journal fields, attach a file | Find the ticket, write the result | ServiceNow Table API (GET), Aisera *Update Ticket* action, Attachment API (POST) |

## ITSM tools

| Tool | Trigger | Find ticket | Note + comment | Attachment |
|---|---|---|---|---|
| ServiceNow | Business Rule + REST Message | Table API query on `incident` | `work_notes`, `comments` | `/api/now/attachment/file` |
| Jira Service Management | Automation rule "Issue created" → send web request | JQL `reporter = … AND (component = Salesforce OR text ~ salesforce) ORDER BY created DESC` | Internal comment + public comment | `/rest/api/3/issue/{key}/attachments` |
| Freshservice | Workflow Automator → webhook | `GET /api/v2/tickets/filter?query=…` | Private note + reply | Attachment on note |
| BMC Helix | Process / Rule → REST | REST query on `HPD:Help Desk` | Work info entries | Work info attachment |

The Salesforce match (short description, description, or the Salesforce CI / component) moves to whatever
field the tool uses for the affected application.

## Bot and AI platforms

| Platform | Proactive message | Conversation | LLM | Code |
|---|---|---|---|---|
| Aisera | Proactive notification + follow-up actions | Workflow with User Input nodes | Prompt Studio | JavaScript node |
| Copilot Studio | Power Automate "Post adaptive card" to Teams | Topic with question nodes | Generative answers / prompt action | Power Fx or a flow |
| ServiceNow Virtual Agent | Notification + VA topic link | VA topic | Now Assist skill | Script action |
| Moveworks / Kore.ai | Proactive notification APIs | Dialog / conversational process | Plugin or LLM node | Script node |
| Custom (LangGraph + Teams bot) | Bot Framework proactive message | Graph with human-in-the-loop nodes | Any chat model | Python |

## Things to re-check after porting

- **Placeholder syntax** in prompts. The demo's Prompt Studio uses `$name` (no braces); other tools use
  `{{name}}` or `{name}`. Test with a one-line *"repeat back: [$x]"* prompt first.
- **Angle brackets.** The demo stripped `<…>` from prompt text and output, so Apex generics travel as
  `_LT_` / `_GT_` tokens. If your platform keeps them, drop the token rule from the solution prompt and the
  swap from the code nodes.
- **How the conversation knows which ticket.** The demo looks up the user's latest open Salesforce
  incident. If your notification can carry the ticket number into the conversation, use that instead.
- **Rendering.** The demo channel renders HTML (`<b>`, `<br>`, `<pre>`); Markdown was shown literally.
  Adjust the two text builders to what your channel renders.
