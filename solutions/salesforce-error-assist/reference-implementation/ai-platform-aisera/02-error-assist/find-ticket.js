/*
 * Workflow: SF Error Assist (conversation)  |  Node: JavaScript "Find Ticket"
 * Input  : snow_response  (body of the incident query below)
 * Output : one object -> map it to the variable ticketDetails
 *          ticketDetails.ticket_count ("0" or "1"), sys_id, number, short_description,
 *          description, cmdb_ci
 *
 * Preceding REST GET (latest open Salesforce incident of the user who tapped the button):
 *   https://<your-instance>.service-now.com/api/now/table/incident
 *     ?sysparm_query=caller_id.email=${flowUser.EmailId}^active=true
 *        ^cmdb_ci.nameLIKESalesforce^ORshort_descriptionLIKEsalesforce^ORdescriptionLIKEsalesforce
 *        ^ORDERBYDESCsys_created_on
 *     &sysparm_fields=sys_id,number,short_description,description,cmdb_ci
 *     &sysparm_display_value=true&sysparm_exclude_reference_link=true&sysparm_limit=1
 *
 * Notes
 * - ticket_count is a String so the following Branch can use .equalsIgnoreCase("1").
 * - cmdb_ci is a reference field. Without sysparm_exclude_reference_link it arrives as an
 *   object {display_value, link}, and an object passed into a prompt input (String only) makes the
 *   prompt node fail. The parser accepts both shapes and always returns a String.
 */
var r = (typeof snow_response === 'string') ? JSON.parse(snow_response) : snow_response;
var rows = (r && r.result) ? r.result : [];
var t = rows.length ? rows[0] : null;

function ci(v) {
  if (!v) return 'none';
  if (typeof v === 'object') return String(v.display_value || 'none');
  return String(v);
}

return {
  ticket_count: String(rows.length),
  sys_id: t ? t.sys_id : '',
  number: t ? t.number : '',
  short_description: t ? (t.short_description || '') : '',
  description: t ? (t.description || '') : '',
  cmdb_ci: t ? ci(t.cmdb_ci) : 'none'
};
