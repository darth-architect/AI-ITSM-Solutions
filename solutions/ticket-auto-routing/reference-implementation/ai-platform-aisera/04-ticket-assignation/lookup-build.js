/*
 * Workflow: Ticket Assignation (sub flow)  |  Node: JavaScript "Lookup Build"
 * Input  : group_name
 * Output : lookup -> lookup.group_url (feeds REST GET group, output groupResult)
 */
var ITSM_BASE_URL = 'https://<your-instance>.service-now.com';
var BASE = ITSM_BASE_URL + '/api/now/table/sys_user_group';
var g = (group_name || '').toString().replace(/[\^=]/g, '').trim();
var q = g ? ('name=' + g + '^active=true') : 'sys_id=0';
return {
  group_url: BASE + '?sysparm_query=' + encodeURIComponent(q) + '&sysparm_fields=sys_id,name&sysparm_limit=1'
};
