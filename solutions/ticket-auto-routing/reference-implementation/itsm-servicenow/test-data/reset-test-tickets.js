/*
 * Puts all AIRT-xx test tickets back into the unrouted state so they can be routed again.
 * Seed (resolved history) tickets are left untouched.
 * Run in: System Definition > Scripts - Background (non-production instance)
 */
var gr = new GlideRecord('incident');
gr.addQuery('correlation_id', 'STARTSWITH', 'AIRT-');
gr.addQuery('correlation_id', 'NOT LIKE', 'SEED');
gr.addNotNullQuery('assignment_group');
gr.query();
while (gr.next()) {
  gr.assignment_group = '';
  gr.assigned_to = '';
  gr.update();
  gs.info('Cleared ' + gr.number + ' (' + gr.correlation_id + ')');
}
