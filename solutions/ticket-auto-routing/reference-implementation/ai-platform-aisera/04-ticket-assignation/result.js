/*
 * Workflow: Ticket Assignation (sub flow)  |  Node: JavaScript "Result"
 * Inputs : patchResult, patch
 * Output : result -> status, number, assigned_group, group_valid, assigned
 */
var num = '', grp = '';
try {
  var d = (typeof patchResult === 'string') ? JSON.parse(patchResult) : patchResult;
  num = d.result.number;
  grp = (d.result.assignment_group && d.result.assignment_group.display_value) || '';
} catch (e) {}
return {
  status: num ? 'updated' : 'failed',
  number: num,
  assigned_group: grp,
  group_valid: patch.group_valid,
  assigned: patch.will_assign
};
