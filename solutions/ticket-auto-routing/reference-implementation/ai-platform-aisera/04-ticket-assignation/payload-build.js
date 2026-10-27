/*
 * Workflow: Ticket Assignation (sub flow)  |  Node: JavaScript "Payload Build"
 * Inputs : groupResult, group_name, work_note, sys_id, assign, note_only
 * Output : patch -> patch.patch_url, patch.payload (feed REST PATCH incident, output patchResult)
 *
 * The work note is always written. The group is only set when assign=true, note_only is not
 * true, and the group exists and is active. An invalid group never blocks the note.
 */
var ITSM_BASE_URL = 'https://<your-instance>.service-now.com';

function isTrue(v) { return v === true || String(v).toLowerCase() === 'true'; }
function ascii(s) { return (s || '').toString().replace(/[^\x09\x0A\x20-\x7E]/g, ' '); }

var gid = '';
try {
  var d = (typeof groupResult === 'string') ? JSON.parse(groupResult) : groupResult;
  if (d && d.result && d.result.length) gid = d.result[0].sys_id;
} catch (e) {}

var wantAssign = isTrue(assign) && !isTrue(note_only);   // note_only always wins
var doAssign = wantAssign && gid !== '';

var note = ascii(work_note);
if (wantAssign && !gid) {
  note = '[AI Routing] Recommended group "' + group_name + '" was not found or is inactive. Ticket left unassigned.\n\n' + note;
}

var payload = { work_notes: note };
if (doAssign) payload.assignment_group = gid;

return {
  patch_url: ITSM_BASE_URL + '/api/now/table/incident/' + sys_id +
             '?sysparm_fields=number,assignment_group&sysparm_display_value=true',
  payload: JSON.stringify(payload),
  group_valid: gid !== '',
  will_assign: doAssign
};
