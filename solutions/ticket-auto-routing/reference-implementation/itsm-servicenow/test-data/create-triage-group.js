/*
 * Creates the landing queue the routing flow treats as "unassigned".
 * Use when the incident form makes Assignment group mandatory.
 * Run in: System Definition > Scripts - Background (non-production instance)
 */
var g = new GlideRecord('sys_user_group');
if (!g.get('name', 'AI Triage')) {
  g.initialize();
  g.name = 'AI Triage';
  g.description = 'Landing queue for AI auto-routing';
  g.active = true;
  g.insert();
}
gs.info('AI Triage sys_id: ' + g.getUniqueValue());
