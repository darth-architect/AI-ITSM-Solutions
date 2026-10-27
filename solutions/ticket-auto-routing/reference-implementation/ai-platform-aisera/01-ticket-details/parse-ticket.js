/*
 * Workflow: Ticket Details (sub flow)  |  Node: JavaScript "Parse Ticket"
 * Input variable : ticketDetails  (raw response of the GET incident call)
 * Output variable: ticket
 *
 * Preceding REST GET:
 *   {ITSM_BASE_URL}/api/now/table/incident?sysparm_query=number=<incident_number>
 *     &sysparm_fields=sys_id,number,short_description,description,assignment_group,assignment_group.name,state
 *     &sysparm_limit=1
 *   Header: Accept: application/json; charset=utf-8
 */
var raw = ticketDetails;
var data;

try {
  data = (typeof raw === 'string') ? JSON.parse(raw) : raw;
} catch (e) {
  data = null;
}

var rec = (data && data.result && data.result.length) ? data.result[0] : null;

// Reference fields can come back as "", "sys_id", or {value, link, display_value}
function refValue(f) {
  if (!f) return '';
  if (typeof f === 'object') return f.value || f.display_value || '';
  return String(f);
}

function clean(s) {
  return (s || '').toString()
    .replace(/\r\n/g, '\n')
    .replace(/[^\x09\x0A\x20-\x7E]/g, ' ')   // ASCII only - avoids mojibake in later work notes
    .replace(/[ \t]+/g, ' ')
    .trim();
}

var TRIAGE_GROUP = 'AI Triage';   // tickets sitting in the landing queue count as unassigned

var desc = rec ? clean(rec.description) : '';
if (desc.length > 4000) desc = desc.substring(0, 4000) + ' ...[truncated]';

var groupId = rec ? refValue(rec.assignment_group) : '';
var groupName = rec ? String(rec['assignment_group.name'] || '') : '';

return {
  found:                 rec ? true : false,
  sys_id:                rec ? rec.sys_id : '',
  number:                rec ? rec.number : '',
  short_description:     rec ? clean(rec.short_description) : '',
  description:           desc,
  assignment_group:      groupId,
  assignment_group_name: groupName,
  state:                 rec ? String(rec.state || '') : '',
  already_assigned:      rec ? (groupId !== '' && groupName !== TRIAGE_GROUP) : false
};
