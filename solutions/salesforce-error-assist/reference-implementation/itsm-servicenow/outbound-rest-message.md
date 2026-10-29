# Outbound REST Message: "Aisera Event Studio"

System Web Services > Outbound > REST Message > New

| Field | Value |
|---|---|
| Name | `Aisera Event Studio` |
| Endpoint | the AI platform's inbound event URL for the notify workflow, e.g. `https://<tenant>.<ai-platform>/event-gateway/events` |
| Authentication | Prefer an auth profile (API key / OAuth). Do not keep tokens in plain header rows in production. |
| HTTP Request headers | `Content-Type: application/json` plus whatever the event gateway needs to route the call to the notify workflow |

HTTP Method record

| Field | Value |
|---|---|
| Name | `post_sf_incident` |
| HTTP method | `POST` |
| Content | `{"event_type":"sf_incident_created","sys_id":"${sys_id}","number":"${number}","short_description":"${short_description}","caller_email":"${caller_email}"}` |

Click **Auto-generate variables**, give them test values (a real caller email, any INC number) and use
the **Test** related link. A 2xx response plus a chat notification for that user means the pipe works.
The Business Rule replaces the body with an escaped one; the template is only for testing.

Where to look when it fails:
- System Logs > Outbound HTTP Requests - did the POST happen, and with what status
- System Logs > All, message contains `[Aisera SF]` - status of every push and script errors
