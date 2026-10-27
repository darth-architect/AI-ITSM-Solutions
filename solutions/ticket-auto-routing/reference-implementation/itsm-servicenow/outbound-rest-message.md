# Outbound REST Message: "AI Routing Event"

System Web Services > Outbound > REST Message > New

| Field | Value |
|---|---|
| Name | `AI Routing Event` |
| Endpoint | the AI platform's inbound event URL, e.g. `https://<tenant>.<ai-platform>/event-gateway/events` |
| Authentication | Prefer an auth profile (API key / OAuth). Do not keep tokens in plain header rows in production. |

HTTP Method record

| Field | Value |
|---|---|
| Name | `trigger` |
| HTTP method | `POST` |
| Headers | `Content-Type: application/json` plus whatever the event gateway needs to route the call (in the demo: `event-type: RecordCreated`, `tenant: <tenant>`) |

Testing without creating a ticket: put a sample body in the method's **Content** field and use the **Test** related link.

```json
{"event_type":"incident_created","incident_number":"INC0000000","sys_id":"<sys_id>","short_description":"test"}
```

Where to look when it fails:
- System Logs > Outbound HTTP Requests - did the POST happen, and with what status
- System Logs > All, message contains `[AI Routing]` - non-2xx responses and script errors
