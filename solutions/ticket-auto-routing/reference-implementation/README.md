# Reference implementation: ServiceNow + Aisera

This is the build used for the demo. Every step is a small, independently testable unit. Only the
identifiers and the workflow wiring are specific to ServiceNow and Aisera. The logic in the JavaScript
nodes and prompts carries over to any ITSM tool and any AI orchestration platform (see
[`../docs/porting-guide.md`](../docs/porting-guide.md)).

Placeholders to replace before use:

| Placeholder | Where | Meaning |
|---|---|---|
| `https://<your-instance>.service-now.com` | `url-builder.js`, `lookup-build.js`, `payload-build.js`, REST GET in Ticket Details | ITSM base URL |
| `AI Triage` | `parse-ticket.js`, Business Rule condition | Landing queue that counts as "unassigned" |
| `GROUPS` allow-list | `plan.js`, `final-decision.js` | Routable groups per platform |
| `SCOPES` | `url-builder.js` | Query that limits history search to a platform's groups |

```
reference-implementation/
├── itsm-servicenow/
│   ├── push-event-business-rule.js     async insert rule -> POST to the AI platform
│   ├── outbound-rest-message.md        REST Message setup + how to test it
│   └── test-data/                      groups, 40 resolved seed tickets, test tickets, reset
└── ai-platform-aisera/
    ├── 01-ticket-details/              Ticket Details (sub flow)
    ├── 02-search-similar-tickets/      Search Similar Tickets (sub flow)
    ├── 03-routing-score/               Routing Score (sub flow)
    ├── 04-ticket-assignation/          Ticket Assignation (sub flow)
    ├── 05-classify-ticket/             Classify Ticket (sub flow) - prompt + plan
    ├── 06-rerank-candidates/           Rerank Candidates (sub flow) - prompt + parser
    ├── 07-main-orchestrator/           Ticket Auto Routing (main)
    ├── 08-event-handler/               Ticket Routing Event Handler (trigger)
    └── chat-agent/                     on-demand agent variant ("Route INC...")
```

## ITSM side (ServiceNow)

1. Run `test-data/seed-groups-and-history.js`. It creates 10 groups (7 SAP, 3 Oracle) and 40 resolved
   history tickets, including Oracle GST decoys that reproduce cross-platform pollution.
2. Run `test-data/create-triage-group.js` if the incident form makes Assignment group mandatory.
3. Create the REST Message from `outbound-rest-message.md`.
4. Create the Business Rule from `push-event-business-rule.js`.
5. The integration user needs read access to `incident` and `sys_user_group`, and write access to
   `incident.assignment_group` and `incident.work_notes`. In practice that means the `itil` role.

Only the standard Table API is used for reads and writes. No scripted REST endpoints are needed.

## AI platform side (Aisera)

All sub flows are linear. The only branches are the two gates (main flow and event handler); every
other "skip" is handled by data. For example, an empty search platform makes the URL builder return a
query that matches nothing.

### 01 - Ticket Details (sub flow)
| Node | Detail |
|---|---|
| Input | `incident_number` |
| REST GET | `/api/now/table/incident?sysparm_query=number=<incident_number>&sysparm_fields=sys_id,number,short_description,description,assignment_group,assignment_group.name,state&sysparm_limit=1`, output `ticketDetails` |
| JS `parse-ticket.js` | input `ticketDetails`, output `ticket` |
| Outputs | `found`, `sys_id`, `number`, `short_description`, `description`, `already_assigned` |

### 02 - Search Similar Tickets (sub flow)
| Node | Detail |
|---|---|
| Inputs | `platform`, `exclude_sys_id`, `anchor_clause`, `keyword_clause` |
| JS `url-builder.js` | output `urls` |
| REST GET | `${urls.anchor_url}`, output `anchorResults` |
| REST GET | `${urls.keyword_url}`, output `keywordResults` |
| JS `merger.js` | inputs `anchorResults`, `keywordResults`, output `candidates` |
| Outputs | `candidate_count`, `candidates_json` |

### 03 - Routing Score (sub flow)
| Node | Detail |
|---|---|
| Inputs | `candidates_json`, `evaluations_json` |
| JS `routing-score.js` | output `score` |
| Outputs | `band`, `method`, `decision_group`, `confidence`, `margin`, `support`, `top_relevance`, `evidence`, `breakdown_json` |

### 04 - Ticket Assignation (sub flow)
| Node | Detail |
|---|---|
| Inputs | `sys_id`, `group_name`, `work_note`, `assign`, `note_only` |
| JS `lookup-build.js` | output `lookup` |
| REST GET | `${lookup.group_url}`, output `groupResult` |
| JS `payload-build.js` | output `patch` |
| REST PATCH | url `${patch.patch_url}`, body `${patch.payload}`, header `Content-Type: application/json`, output `patchResult` |
| JS `result.js` | inputs `patchResult`, `patch`, output `result` |
| Outputs | `status`, `number`, `assigned_group`, `group_valid`, `assigned` |

### 05 - Classify Ticket (sub flow)
| Node | Detail |
|---|---|
| Inputs | `number`, `short_description`, `description` |
| Prompt action | [`prompts/classify-ticket.md`](../prompts/classify-ticket.md), single output `routingClassification` |
| JS `plan.js` | output `plan` |
| Outputs | `path`, `platform`, `search_platform`, `anchor_clause`, `keyword_clause`, `explicit_group`, `conflict_groups`, `excluded_system`, `primary_system`, `charter_group`, `charter_strength`, `intent_summary`, `reason` |

### 06 - Rerank Candidates (sub flow)
| Node | Detail |
|---|---|
| Inputs | `short_description`, `description`, `candidates_json` |
| Prompt action | [`prompts/rerank-candidates.md`](../prompts/rerank-candidates.md), single output `responseRanking` |
| JS `build-evaluations.js` | output `ev` |
| Outputs | `evaluations_json`, `evaluated_count` |

### 07 - Ticket Auto Routing (main)
Sub flow outputs are mapped to **prefixed** flow variables, because several sub flows share output
names (`number`, `platform`, `method`, `status`).

| # | Node | Inputs | Outputs |
|---|---|---|---|
| 1 | Ticket Details | `incident_number` | `t_found`, `t_sys_id`, `t_number`, `t_short_description`, `t_description`, `t_already_assigned` |
| 2 | JS `gate.js` | `t_found`, `t_already_assigned` | `gate` |
| 3 | Branch | `gate.proceed.equalsIgnoreCase("yes")`; else end | - |
| 4 | Classify Ticket | `t_number`, `t_short_description`, `t_description` | `c_path`, `c_platform`, `c_search_platform`, `c_anchor_clause`, `c_keyword_clause`, `c_explicit_group`, `c_conflict_groups`, `c_excluded_system`, `c_primary_system`, `c_charter_group`, `c_charter_strength`, `c_reason` |
| 5 | Search Similar Tickets | platform `c_search_platform`, exclude `t_sys_id`, `c_anchor_clause`, `c_keyword_clause` | `s_candidate_count`, `s_candidates_json` |
| 6 | Rerank Candidates | `t_short_description`, `t_description`, `s_candidates_json` | `r_evaluations_json`, `r_evaluated_count` |
| 7 | Routing Score | `s_candidates_json`, `r_evaluations_json` | `sc_band`, `sc_method`, `sc_decision_group`, `sc_confidence`, `sc_evidence` |
| 8 | JS `final-decision.js` | all `c_*` and `sc_*` | `final` |
| 9 | Ticket Assignation | `t_sys_id`, `${final.group_name}`, `${final.work_note}`, `${final.assign}`, `${final.note_only}` | `a_status`, `a_assigned_group` |

### 08 - Ticket Routing Event Handler
| Node | Detail |
|---|---|
| Trigger | Event from the event gateway (demo: `event-type: RecordCreated`); payload arrives as `response` |
| JS `read-event.js` | input `response`, output `evt` |
| Branch | `evt.valid` is true |
| Sub flow | Ticket Auto Routing (main), `incident_number = ${evt.incident_number}` |

## Platform behaviours found while building (worth knowing on any platform)

- **Prompt actions return one variable.** The whole JSON answer arrives as a single string, not as
  separate typed outputs. Parse it in a code node and never trust its shape.
- **Sub flow outputs map to individual flow variables.** Prefix them per step to avoid silent overwrites.
- **Branch expressions on booleans were unreliable.** Normalise to a `"yes"`/`"no"` string in a code
  node and branch on that.
- **GPT-5.x rejects custom `top_p`.** Leave sampling parameters at their defaults.
- **Reads come back empty instead of erroring** when a record doesn't exist (for example, test data
  that was deleted and re-created under new numbers) or the integration user can't see it (missing
  role, domain separation). Check both before debugging the query.
- **API text can arrive double-encoded** (`â‰¥` instead of `>=`). Ask for `charset=utf-8` and keep
  generated notes ASCII-only.
