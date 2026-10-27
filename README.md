# AI ITSM Solutions

Agentic and AI-assisted automations for IT service management: triage, fulfilment and operations.

Each solution is written to be **platform-agnostic**. The design (rules, prompts, decision logic) is
separate from the reference implementation (the specific ITSM tool and AI platform used for the demo).
Most demos run on ServiceNow and Aisera, but the patterns carry over to Jira Service Management,
Freshservice, BMC Helix, Power Automate / Copilot Studio, n8n or a custom LangGraph service.

## Solutions

| Solution | What it does | Status | Demo stack |
|---|---|---|---|
| [Ticket Auto Routing](solutions/ticket-auto-routing/) | Routes new tickets to the right resolver group using explicit requests, scope rules and platform-scoped historical matching. Assigns only with high confidence and leaves a note on every run. | Demo-validated | ServiceNow + Aisera + GPT-5.5 |

More solutions will be added here as they are documented.

## Structure of each solution

```
solutions/<name>/
├── README.md                    problem, approach, how it runs, demo summary
├── architecture/                architecture.md + diagrams
├── docs/                        solution flow, porting guide, test plan, production readiness
├── prompts/                     LLM prompts, platform-neutral
├── reference-implementation/    the concrete build used for the demo
└── screenshots/
```

## Conventions

- **LLMs judge, code decides.** Anything that changes a record is decided in deterministic code.
- **No secrets or customer data.** Instance URLs are placeholders (`<your-instance>`), and test data is
  synthetic.
- **Every solution has a porting guide** that maps its required capabilities to other platforms.

## Related

- [Work Buddy](https://github.com/darth-architect/Work-Buddy) - Slack-based IT and sales assistant
  (LangGraph, MCP tools, Okta, Azure AD, Salesforce, JSM)

## Author

Aishwary Tiwari
