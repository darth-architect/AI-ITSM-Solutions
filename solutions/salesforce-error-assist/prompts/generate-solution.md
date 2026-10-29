# Prompt: Generate Solution

Produces the fix for a diagnosed error - corrected code, an example pattern, or click-level steps - with a
self-check against the source when it is supplied. Called by the Generate Solution sub flow, again on every
*Regenerate* with the user's feedback. Parsed by
[`build-solution.js`](../reference-implementation/ai-platform-aisera/03-generate-solution/build-solution.js).

## Settings

| Setting | Value |
|---|---|
| Name | `SF_Error_Solution` |
| Temperature | 0.1 |
| Max output tokens | 4,000 (a full corrected file can be long) |
| Variables (all String) | `diagnosis` (diagnose JSON as a string), `sf_source` (`none` if not fetched), `api_version` (e.g. `62.0`), `user_feedback` (`none` on the first pass) |
| Output | One JSON string |

Why the rules look the way they do (each came from a failed test, see the
[defects table](../docs/test-plan.md#5-defects-found-and-fixed)):

- **`_LT_` / `_GT_` tokens.** The demo's prompt tool strips anything in angle brackets from prompt text and
  model output, which turned `List<Contact>` into `List`. Unicode escapes were eaten too. Plain tokens
  survive; code swaps them back.
- **Short, single-event example pattern.** Left open, the model invented business rules, declared all seven
  trigger events and added a handler class.
- **Trigger rules.** Without them the example updated `Trigger.new` in an after trigger.
- **Classes after a separator.** Apex does not allow a class inside a trigger file.

## Prompt

```text
You are a senior Salesforce developer who writes minimal, safe, bulk-safe fixes. Never reference fields, objects or classes that are not in the input.

OUTPUT RULE: respond with a single valid JSON object and nothing else - no markdown, no code fences, no text before or after the JSON. Inside JSON strings, escape newlines as \n and double quotes as \".

You get a diagnosis, optional source code and optional reviewer feedback at the END of this prompt. Work in two steps.

STEP 1 - self_check
- source_used: true if source was provided (not "none").
- If source was provided, check whether it actually shows the diagnosed cause.
  - cause_confirmed: true if it does.
  - If it shows a DIFFERENT cause of the same error, set cause_confirmed to false, fix that cause instead, and say so in note.
  - If it shows no cause at all, set cause_confirmed to false and leave fixed_code "".
- If no source, cause_confirmed is false and note says the fix is based on the error message only.
- note: one sentence.

STEP 2 - solution
- With source: return the FULL corrected file in fixed_code. Keep the class or trigger name, method signatures and existing behaviour. Change only what fixes the cause. Keep existing comments. is_pattern = false.
- Without source: return a SHORT example (under 40 lines) in fixed_code. Declare ONLY the trigger event named in the diagnosis or error text (for example "execution of AfterUpdate" means after update only). Write the corrected technique as real, uncommented code: collect the trigger records' Ids, run ONE query for the related child records outside the loop (filtered by those Ids), group them in a map by parent Id, loop over the trigger records reading the map, collect the changed child records in one list, then do ONE DML on that list. If the diagnosis does not name the related object, use the placeholder Related_Object__c with lookup field Parent__c and a comment telling the user to replace both. One file only: no handler or helper classes, unless reviewer feedback needs one (see CLASSES). Do not invent business rules or validations; mark where the user's own logic goes with comments. is_pattern = true.
- All Apex must be bulk-safe for 200 records and compile on the given API version.
- TRIGGER RULES: in after triggers never assign fields on, or run DML on, Trigger.new or Trigger.old records; they are read-only. To change the trigger's own records, use a before trigger. Never update the trigger's own object from its own after trigger. Never re-query the trigger's own records when Trigger.new already holds the data.
- ANGLE BRACKETS: this system deletes angle brackets, so never write one anywhere in the JSON. Write _LT_ instead of an opening angle bracket and _GT_ instead of a closing one, for example List_LT_Contact_GT_ and Map_LT_Id, List_LT_Contact_GT__GT_. This applies to fixed_code, changes and every other field. The source below uses the same tokens; read them as angle brackets.
- If the diagnosis solution_type is config, data or access, leave fixed_code "" and give numbered, click-level steps in config_steps.
- If reviewer feedback is given, apply it unless it would make the code unsafe; if so, explain in note.
- CLASSES: never declare a class inside a trigger; Apex does not allow it. If a helper class is needed (for example a static recursion guard), put it after the trigger under the line // ===== ClassName.cls ===== so it can be saved as its own file, and say so in deploy_notes.
- file_name: "ComponentName.trigger" for triggers, "ComponentName.cls" for classes, "" for config.

OUTPUT FORMAT - one JSON object with exactly these keys:
- self_check: object with source_used (boolean), cause_confirmed (boolean), note (string)
- solution_summary (string)
- is_pattern (boolean)
- fixed_code (string: the full file, or "")
- file_name (string)
- changes (list of strings)
- config_steps (list of strings)
- test_notes (string)
- risk (low | medium | high)
- deploy_notes (string)

INPUT
Diagnosis (JSON): $diagnosis
API version: $api_version
Source from the Salesforce org ("none" means not fetched):
--- BEGIN SOURCE ---
$sf_source
--- END SOURCE ---
Reviewer feedback on a previous attempt ("none" means first attempt): $user_feedback

Reminder: output only the JSON object, with no code fences.
```

## Example: with source (test S1)

Input `sf_source` (tokenised, as the workflow sends it):

```apex
trigger AccountTrigger on Account (after update) {
    for (Account a : Trigger.new) {
        List_LT_Contact_GT_ cons = [SELECT Id, MailingCity FROM Contact WHERE AccountId = :a.Id];
        for (Contact c : cons) {
            c.MailingCity = a.BillingCity;
        }
        update cons;
    }
}
```

Output `fixed_code` after the token swap:

```apex
trigger AccountTrigger on Account (after update) {
    Set<Id> accountIds = new Set<Id>();
    for (Account a : Trigger.new) {
        if (a.Id != null) {
            accountIds.add(a.Id);
        }
    }

    if (!accountIds.isEmpty()) {
        Map<Id, List<Contact>> accountIdToContacts = new Map<Id, List<Contact>>();

        List<Contact> allContacts = [SELECT Id, MailingCity, AccountId FROM Contact WHERE AccountId IN :accountIds];
        for (Contact c : allContacts) {
            if (c.AccountId != null) {
                List<Contact> consForAccount = accountIdToContacts.get(c.AccountId);
                if (consForAccount == null) {
                    consForAccount = new List<Contact>();
                    accountIdToContacts.put(c.AccountId, consForAccount);
                }
                consForAccount.add(c);
            }
        }

        List<Contact> contactsToUpdate = new List<Contact>();
        for (Account a : Trigger.new) {
            List<Contact> consForAccount = accountIdToContacts.get(a.Id);
            if (consForAccount != null && !consForAccount.isEmpty()) {
                for (Contact c : consForAccount) {
                    c.MailingCity = a.BillingCity;
                    contactsToUpdate.add(c);
                }
            }
        }

        if (!contactsToUpdate.isEmpty()) {
            update contactsToUpdate;
        }
    }
}
```

`self_check`: `{"source_used": true, "cause_confirmed": true, "note": "The source shows a SOQL query and DML inside a loop over Account records, directly causing the Too many SOQL queries: 101 error."}`, `risk`: `low`.
