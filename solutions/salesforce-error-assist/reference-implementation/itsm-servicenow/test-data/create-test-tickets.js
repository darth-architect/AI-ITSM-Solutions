/*
 * Scripts - Background: create ONE synthetic test incident.
 * Set callerEmail to your own user (it must match the email the bot knows you by), set pick to the
 * case number minus 1, run, then wait for the chat notification.
 *
 * Create tickets one at a time and finish (or resolve) each before the next: the conversation picks
 * the caller's LATEST open Salesforce incident. Records inserted here fire the Business Rule like
 * tickets saved in the UI.
 *
 * Third column: true = set the Salesforce CI (run create-salesforce-ci.js first).
 * The matrix and expected results are in docs/test-plan.md, section 4.
 */
var callerEmail = 'you@example.com';
var pick = 0; // 0 = case 1, 1 = case 2, ...
var t = [
  ['Salesforce bulk account update failing', 'AccountTrigger: execution of AfterUpdate caused by: System.LimitException: Too many SOQL queries: 101 Trigger.AccountTrigger: line 3, column 1', false],
  ['Opportunity mass update timing out', 'In Salesforce, mass-updating opportunities fails with System.LimitException: Apex CPU time limit exceeded Trigger.OpportunityTrigger: line 45, column 1', false],
  ['Quote total not calculating', 'System.NullPointerException: Attempt to de-reference a null object Class.QuoteService.calculateTotal: line 58, column 1', true],
  ['Case closure batch failing', 'CaseTrigger: execution of AfterUpdate caused by: System.LimitException: Too many DML statements: 151 Trigger.CaseTrigger: line 12, column 1. Happens when closing 200 cases at once from a list view.', true],
  ['Salesforce lead import rejected', 'Salesforce Data Import Wizard: DUPLICATE_VALUE, duplicate value found: External_Id__c duplicates value on record with id: 00Q5g00000AbCdE', true],
  ['Can\'t save opportunity in Salesforce', 'FIELD_CUSTOM_VALIDATION_EXCEPTION, Close Date cannot be in the past: [CloseDate]', true],
  ['Case assignment to queue fails', 'Salesforce shows INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY when assigning a case to the Tier 2 queue', false],
  ['Opportunity stage update error', 'An unhandled fault has occurred in this flow. Flow: Update_Opportunity_Stage. Error element Update_Records: FIELD_INTEGRITY_EXCEPTION', true],
  ['Order sync from ERP failing', 'System.DmlException: Insert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields are missing: [Pricebook2Id] Class.OrderSyncService.createOrders: line 87, column 1', true],
  ['System not working since morning', 'Keeps throwing errors, can\'t save anything', true],
  ['Need Salesforce license for new joiner', 'Please provide a Sales Cloud license for a new team member joining Monday', false],
  ['Printer not working on floor 3', 'Printer shows offline and jobs are stuck in the queue', true],
  ['Laptop running slow', 'Takes 10 minutes to boot every morning', false]
];

var u = new GlideRecord('sys_user');
u.addQuery('email', callerEmail);
u.query();
if (!u.next()) {
  gs.print('Caller not found: ' + callerEmail);
} else {
  var inc = new GlideRecord('incident');
  inc.initialize();
  inc.caller_id = u.getUniqueValue();
  inc.short_description = t[pick][0];
  inc.description = t[pick][1];
  if (t[pick][2]) {
    var sf = new GlideRecord('cmdb_ci_appl');
    if (sf.get('name', 'Salesforce')) inc.cmdb_ci = sf.getUniqueValue();
  }
  var id = inc.insert();
  gs.print('Created ' + inc.number + (t[pick][2] ? ' (CI: Salesforce)' : ' (no CI)'));
}
