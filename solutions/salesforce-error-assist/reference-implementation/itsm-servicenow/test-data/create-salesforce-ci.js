/*
 * Scripts - Background: create the "Salesforce" application CI (idempotent).
 * Lets tickets that never say "Salesforce" in their text still trigger the solution: the Business
 * Rule checks the CI display value and the conversation's lookup checks cmdb_ci.name.
 */
var ci = new GlideRecord('cmdb_ci_appl');
ci.addQuery('name', 'Salesforce');
ci.query();
if (ci.next()) {
  gs.print('Already exists: ' + ci.getUniqueValue());
} else {
  ci.initialize();
  ci.name = 'Salesforce';
  ci.short_description = 'Salesforce CRM (Sales Cloud / Service Cloud)';
  ci.operational_status = 1;   // Operational
  ci.install_status = 1;       // Installed
  gs.print('Created: ' + ci.insert());
}
