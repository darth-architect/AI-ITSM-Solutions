# Porting guide

The demo used ServiceNow as the ITSM tool and Aisera as the AI platform. Neither is required. The
solution needs five capabilities from the ITSM side and four from the AI side.

## What the ITSM tool must provide

| Capability | ServiceNow (demo) | Jira Service Management | Freshservice | BMC Helix ITSM |
|---|---|---|---|---|
| Read one ticket | Table API `GET /incident` | `GET /rest/api/3/issue/{key}` | `GET /api/v2/tickets/{id}` | `GET .../HPD:Help Desk` |
| Search resolved tickets by text, filtered by group | encoded query `LIKE` + `assignment_group` | JQL `text ~ "..." AND status = Resolved AND "Team" in (...)` | filter query on status and group, then text | qualification on status and support group |
| Validate a group exists | `GET /sys_user_group` | teams or org field values | `GET /api/v2/groups` | support group lookup |
| Set group and add an internal note | `PATCH` `assignment_group` + `work_notes` | `PUT` team field + internal comment | `PUT` `group_id` + private note | `PUT` support group + work info |
| Notify on create | Business Rule → REST Message | Automation rule → webhook | Workflow Automator → webhook | Filter + REST notification |

**No push available?** Poll instead. Every N minutes, query unrouted tickets created in a fixed time
window (for example, from 10 to 5 minutes ago), so each ticket is picked up exactly once without
storing state.

## What the AI platform must provide

| Capability | Aisera (demo) | Alternatives |
|---|---|---|
| Inbound trigger (webhook or event) | Event gateway → workflow | Power Automate HTTP trigger, n8n Webhook node, Azure Function, API route in a LangGraph service |
| HTTP calls | REST action | HTTP connector, n8n HTTP Request, `requests` / `fetch` |
| Code step | JavaScript node | Power Automate inline code or Azure Function, n8n Code node, Python |
| LLM call with a fixed prompt | Prompt Studio action | Copilot Studio / Azure OpenAI action, n8n AI node, any SDK |

## Porting steps

1. **Group model.** List the routable groups per platform and write a one-line charter for each. Put
   the list in `GROUPS` in `plan.js` and `final-decision.js`, and the charters in the Classify prompt.
2. **Scopes.** Rewrite `SCOPES` in `url-builder.js` as your tool's query for "resolved tickets owned by
   this platform's groups".
3. **Query clause format.** `plan.js` builds ServiceNow `LIKE` clauses. Change `clause()` to your
   tool's text-search syntax (JQL `text ~`, for example).
4. **Field names.** Map `short_description`, `description`, `close_notes` (resolution notes),
   `assignment_group` and `reassignment_count` to your tool's fields. If there's no reassignment count,
   set it to 0; the scoring simply loses that weighting.
5. **Triage queue.** Set `TRIAGE_GROUP` in `parse-ticket.js` to the queue new tickets land in.
6. **Exclusions.** Edit the exclusionary systems list in the Classify prompt.
7. **Test.** Seed or select 30+ resolved tickets per group, then run the test pack in
   [`test-plan.md`](test-plan.md).

## Things that stay exactly the same

- The four-rule order and the decision table in [`solution-flow.md`](solution-flow.md)
- Both prompts, apart from group names, charters and exclusions
- `routing-score.js`, `build-evaluations.js`, `merger.js` and the gate logic, which have no platform
  references
