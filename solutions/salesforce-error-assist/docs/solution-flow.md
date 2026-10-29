# Solution flow

## The four stages

| Stage | Question it answers | Output | Who acts on it |
|---|---|---|---|
| **Identify** | Which error, in which component, line and object? | `identify` block | Code (labels, file name) |
| **Validate** | Is this a Salesforce problem? Is there enough detail to explain it? | `validate` block | Code branches: hand-over, one clarifying question, or continue |
| **Enlighten** | What is happening, why, common causes, most likely cause, how to confirm, impact | `enlighten` block | Shown to the user |
| **Solution** | What is the fix, and does it hold up against the source? | Solution JSON | Shown to the user, written to the ticket only after confirmation |

Identify, Validate and Enlighten are **one** LLM call (the [diagnose prompt](../prompts/diagnose-error.md)),
so the user waits once after tapping *See details*. Each stage still has its own block in the JSON, so the
workflow can branch on any of them without another call. Splitting them into three prompts is a tuning
option, not a requirement.

Validation happens twice on purpose: the diagnose prompt checks the error against the ticket, and the
[solution prompt](../prompts/generate-solution.md) checks the cause against the real source code when it is
supplied. If the code shows a different cause, the solution prompt says so instead of forcing a fix.

## The conversation

```
Notification: "Your ticket INC… (…) looks like a Salesforce error."   [See details] [Not now]
  │ See details
  ▼
Find the caller's latest open Salesforce incident ── none ──▶ ask for the INC number
  ▼
"Looking into this error…"  →  Diagnose
  ├─ JSON unreadable or not a Salesforce problem ──▶ "This doesn't look like a Salesforce error I can explain…"  END
  ├─ not enough detail (first time) ──▶ ask the clarifying question ──▶ Diagnose again with the answer
  ├─ not enough detail (second time) ──▶ hand-over message  END
  └─ OK ──▶ show the explanation
              ├─ no fix is possible ──▶ "This one needs your support team…"  END
              ▼
        [Yes, show the solution] [Ask a question] [No, thanks]
              │                   │                └─▶ "No problem. Your ticket … stays with the support team."  END
              │                   └─▶ question ─▶ follow-up prompt ─▶ answer ─▶ back to the three buttons
              ▼
        Generate solution  ◀────────────────────────────────┐
              ▼                                              │
        show the solution                                    │
        [Looks good, add to ticket] [Regenerate] [Cancel]    │
              │                       └─▶ "What should change?" ┘ (feedback passed to the prompt)
              │                                        Cancel ─▶ "Okay, nothing was added."  END
              ▼
        Update ticket: work note + customer comment + code attachment
              ▼
        "Added the solution to INC… A developer will review and deploy it."  END
```

## JSON contracts

All three prompts return a single JSON object. On the demo platform the whole object arrives as **one
string**, so every prompt is followed by a code node that parses it defensively (strip code fences, keep
the outermost `{…}`, never trust the shape).

### Diagnose

```json
{
  "identify":  {"error_name": "", "error_code": "", "component_type": "ApexClass|ApexTrigger|Flow|ValidationRule|Unknown",
                "component_name": "", "line": 0, "object": ""},
  "validate":  {"is_salesforce_error": true, "enough_detail": true, "confidence": 0.0, "clarifying_question": ""},
  "enlighten": {"user_summary": "", "what_is_happening": "", "why": "", "common_causes": [],
                "most_likely_cause": "", "how_to_confirm": [], "impact": "",
                "solution_type": "code|config|data|access", "solution_available": true}
}
```

### Solution

```json
{
  "self_check": {"source_used": false, "cause_confirmed": false, "note": ""},
  "solution_summary": "", "is_pattern": true,
  "fixed_code": "", "file_name": "AccountTrigger.trigger",
  "changes": [], "config_steps": [],
  "test_notes": "", "risk": "low|medium|high", "deploy_notes": ""
}
```

### Follow-up

```json
{"in_scope": true, "answer": ""}
```

## What the AI decides and what code decides

| Decision | Made by |
|---|---|
| Which error it is, whether it is a Salesforce problem, whether detail is sufficient | LLM (diagnose) |
| Whether to hand over, ask a question or explain | Code, from the `validate` booleans |
| The explanation and the fix | LLM (diagnose, solution) |
| Whether the solution is usable (code or steps present) | Code |
| Whether anything is written to the ticket | **The user** (two confirmations) |
| What is written and where (note, comment, attachment) | Code |
| Converting placeholder tokens back to `<` and `>`, escaping for chat | Code |

## Where the model's knowledge comes from

Only its training. In the demo there is no knowledge base, no web search and no connection to the
Salesforce org. That is why:

- `most_likely_cause` always ends with *(inferred from the error message)*;
- without source code the solution is an **example pattern** with labelled placeholders
  (`Related_Object__c`, `Parent__c`) and a `TODO` where the user's logic goes;
- the work note records the source check (`No source code was provided…`) and the ticket is never
  resolved.

The solution prompt already accepts the real source (`sf_source`); with it, the model corrects the
actual file and confirms or rejects the diagnosed cause. See
[production readiness](production-readiness.md).
