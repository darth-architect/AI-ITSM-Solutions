# Prompt: Diagnose Error

Identify, validate and explain a Salesforce error from ITSM ticket text in **one** LLM call. Called when the
user taps *See details*, and again after a clarifying question. Its output is parsed by
[`parse-diagnosis.js`](../reference-implementation/ai-platform-aisera/02-error-assist/parse-diagnosis.js).

## Settings (as used in the demo)

| Setting | Value |
|---|---|
| Name | `SF_Error_Diagnose` |
| Model | Azure OpenAI GPT-5.1 |
| Temperature | 0.1 |
| Max output tokens | 1,500 |
| Variables (all String) | `short_description`, `description`, `cmdb_ci`, `user_clarification` |
| Output | One JSON string (the platform returns it as a single response variable) |

- **Single prompt field.** The demo's prompt tool has no separate system message, so the role and the
  JSON-only rule open the prompt and are repeated at the end.
- **Placeholders are `$name`** (no braces) in the demo's prompt tool. Swap for your platform's syntax.
- **Never send an empty variable.** Pass the literal `none`; the prompt treats it as "not provided".
- The example uses a **different** error (MIXED_DML) from every test case, so the model sees a filled
  answer without anything to copy. Without it, the model echoed the empty template.

## Prompt

```text
You are a senior Salesforce developer who explains production errors to the person who raised the ticket. Be precise and never invent details that are not in the ticket.

OUTPUT RULE: respond with a single valid JSON object and nothing else - no markdown, no code fences, no text before or after the JSON.

Analyse the ticket at the END of this prompt in three stages.

STAGE 1 - identify
Extract the Salesforce error name, the error code or exception type, the component type, the component name, the line number and the Salesforce object.
Use ONLY what appears in the ticket text. Use "" for unknown text and 0 for an unknown line. Never guess names or numbers.

STAGE 2 - validate
- is_salesforce_error: true if the ticket is about a problem in Salesforce - an error message, exception or governor limit, or a described Salesforce failure, even a vague one such as "Salesforce not working". False only if it is about another system.
- enough_detail: true only if there is enough information to explain the likely cause. "Salesforce is slow" or "Salesforce not working" is NOT enough.
- confidence: a number from 0.0 to 1.0.
- clarifying_question: if is_salesforce_error is true and enough_detail is false, write ONE short question asking for what is missing (usually the exact error message and what the user was doing). Otherwise "".

STAGE 3 - enlighten
Fill this stage only if is_salesforce_error and enough_detail are both true. Otherwise return "" for text fields, [] for lists and false for solution_available.
- user_summary: one plain-language sentence for a business user, no error codes.
- what_is_happening: 1-2 sentences, plain language.
- why: 2-3 sentences on the Salesforce rule, limit or behaviour behind this error.
- common_causes: 2-4 general causes of this error, most frequent first.
- most_likely_cause: the most likely cause in THIS ticket, ending with "(inferred from the error message)".
- how_to_confirm: 2-4 concrete checks in Setup, the code or a debug log.
- impact: one sentence on what fails and who is affected.
- solution_type: code, config, data or access.
- solution_available: true if a developer or admin could fix it with a code, configuration, data or access change.

OUTPUT FORMAT - one JSON object with exactly these keys:
- identify: error_name (string), error_code (string), component_type (ApexClass | ApexTrigger | Flow | ValidationRule | Unknown), component_name (string), line (integer), object (string)
- validate: is_salesforce_error (boolean), enough_detail (boolean), confidence (number 0.0-1.0), clarifying_question (string)
- enlighten: user_summary (string), what_is_happening (string), why (string), common_causes (list of strings), most_likely_cause (string), how_to_confirm (list of strings), impact (string), solution_type (code | config | data | access, or "" when stage 3 is skipped), solution_available (boolean)

EXAMPLE for a DIFFERENT ticket - it shows the format only; never copy its values.
Ticket: "New hire user creation fails" / "MIXED_DML_OPERATION, DML operation on setup object is not permitted after you have updated a non-setup object (or vice versa): User"
{"identify":{"error_name":"MIXED_DML_OPERATION","error_code":"System.DmlException","component_type":"Unknown","component_name":"","line":0,"object":"User"},"validate":{"is_salesforce_error":true,"enough_detail":true,"confidence":0.88,"clarifying_question":""},"enlighten":{"user_summary":"Creating the new user fails because an automation saves two kinds of records together in a way Salesforce does not allow.","what_is_happening":"The new user is not created and the whole save is rolled back.","why":"Salesforce does not allow setup records such as Users and regular business records to be changed in the same transaction. When an automation does both, the save fails.","common_causes":["A trigger or flow on a business object also creates or updates a User","User-creation code that also updates Contacts or Accounts in the same transaction","Test classes that insert Users and business records without System.runAs"],"most_likely_cause":"An automation that runs during user creation also updates a non-setup record (inferred from the error message)","how_to_confirm":["Check triggers and flows on User and on any object updated at the same time","Reproduce with a debug log and look for DML on both User and another object"],"impact":"New users cannot be created through this process.","solution_type":"code","solution_available":true}}

TICKET TO ANALYSE
Short description: $short_description
Description: $description
Configuration item: $cmdb_ci
Extra detail from the user ("none" means not provided): $user_clarification

Reminder: output only the JSON object for THIS ticket, with no code fences.
```

## Example output (test D1)

```json
{"identify":{"error_name":"Too many SOQL queries: 101","error_code":"System.LimitException","component_type":"ApexTrigger","component_name":"AccountTrigger","line":3,"object":"Account"},
 "validate":{"is_salesforce_error":true,"enough_detail":true,"confidence":0.96,"clarifying_question":""},
 "enlighten":{"user_summary":"The bulk account update is failing because an automation on Account runs too many database lookups in one go.",
  "what_is_happening":"When many Accounts are updated together, the Account trigger hits a Salesforce limit on how many queries it can run and the whole update is rolled back.",
  "why":"Salesforce enforces a limit of 100 SOQL queries per transaction ...",
  "common_causes":["Non-bulkified trigger logic that runs a query inside a loop over records","..."],
  "most_likely_cause":"The AccountTrigger is executing SOQL queries inside a loop ... (inferred from the error message).",
  "how_to_confirm":["Review the AccountTrigger code around line 3 ...","..."],
  "impact":"Bulk updates to Account records fail ...","solution_type":"code","solution_available":true}}
```

Test cases: [test plan](../docs/test-plan.md#diagnose).
