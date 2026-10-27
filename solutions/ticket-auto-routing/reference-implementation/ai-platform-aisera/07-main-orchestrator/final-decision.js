/*
 * Workflow: Ticket Auto Routing (main)  |  Node: JavaScript "Final Decision"
 * Inputs : c_*  (outputs of Classify Ticket)  and  sc_* (outputs of Routing Score)
 * Output : final -> outcome, group_name, assign, note_only, method_used, work_note
 *
 * Only two things ever auto-assign a ticket:
 *   1. an explicit request for exactly one valid group in the ticket text
 *   2. a HIGH confidence band from historical matching, for a group on the same platform
 * Everything else is written as a recommendation or "not routed" note, and the ticket
 * stays in the triage queue.
 */
function S(x) { return (x === undefined || x === null) ? '' : String(x).trim(); }
function V(name) { try { return S(eval(name)); } catch (e) { return ''; } }
function ascii(s) { return S(s).replace(/[^\x09\x0A\x20-\x7E]/g, ' '); }

var GROUPS = {
  SAP: ['GD-SD-SAP-SD', 'GD-SD-SAP-FICO', 'GD-SD-SAP-Basis', 'GD-SD-SAP-Security-Request', 'GD-SD-SAP-GRC', 'GD-SD-SAP-ITGC', 'SD-Integration'],
  ORACLE: ['SD-ORACLE-FIN', 'SD-ORACLE-TECHNICAL', 'SD-ORACLE-OM-SVC']
};

var path = V('c_path');
var plat = V('c_platform') || 'none';
var platKey = plat.toUpperCase() === 'ORACLE' ? 'ORACLE' : 'SAP';
var band = V('sc_band').toUpperCase();
var dg = V('sc_decision_group'), conf = V('sc_confidence'), ev = V('sc_evidence');
var cg = V('c_charter_group'), cs = V('c_charter_strength') || 'weak';

var outcome = 'NOT ROUTED', group = '', assign = false, m = '', confTxt = 'n/a', why = V('c_reason'), showEv = false;

if (path === 'explicit') {
  group = V('c_explicit_group'); outcome = 'ASSIGNED'; assign = true; m = 'explicit';
  why = 'The ticket explicitly requests routing to ' + group + '.';
} else if (path === 'conflict') {
  m = 'explicit_conflict';
  why = 'The ticket requests more than one group (' + V('c_conflict_groups') + '). Manual decision required.';
} else if (path === 'excluded') {
  m = 'out_of_scope';
  why = 'Primary system is ' + (V('c_excluded_system') || V('c_primary_system')) + ', which is outside SAP/Oracle routing scope.';
} else if (path === 'no_platform') {
  m = 'no_platform';
  why = 'No SAP or Oracle indicators were found in the ticket.';
} else if (path === 'search') {
  var dgOk = dg !== '' && GROUPS[platKey].indexOf(dg) > -1;     // never cross platforms
  if (band === 'HIGH' && dgOk) {
    outcome = 'ASSIGNED'; group = dg; assign = true; m = V('sc_method') || 'consensus';
    confTxt = conf + ' (HIGH)'; showEv = true;
    why = 'Similar resolved tickets were handled by ' + dg + '.';
  } else if (band === 'MEDIUM' && dgOk) {
    outcome = 'RECOMMENDED'; group = dg; m = 'weak_match';
    confTxt = conf + ' (MEDIUM)'; showEv = true;
    why = 'Partial match with resolved tickets handled by ' + dg + '; confidence too low to assign.';
  } else if (cg) {
    outcome = 'RECOMMENDED'; group = cg; m = 'fallback_' + cs;
    confTxt = band ? (conf + ' (' + band + ')') : 'n/a';
    why = 'No strong historical match; group chosen by charter. ' + V('c_reason');
  } else {
    m = 'no_match';
    why = 'No similar resolved tickets and no clear group by charter.';
  }
} else {
  m = 'error';
  why = 'Classification did not complete. Manual triage required.';
}

var decisionLine = outcome === 'ASSIGNED' ? ('ASSIGNED to ' + group)
                 : outcome === 'RECOMMENDED' ? ('RECOMMENDED ' + group + ' (not assigned)')
                 : 'NOT ROUTED';

var note = [
  '[AI Routing] Decision: ' + decisionLine,
  'Method: ' + m,
  'Confidence: ' + confTxt,
  'Platform: ' + plat + ' | Primary system: ' + (V('c_primary_system') || 'unknown'),
  'Explicit route: ' + (V('c_explicit_group') || 'none') + ' | Exclusion: ' + (V('c_excluded_system') || 'none'),
  'Evidence: ' + (showEv && ev ? ev : 'none'),
  'Reason: ' + why
].join('\n');

return {
  outcome: outcome,
  group_name: group,
  assign: assign ? 'true' : 'false',
  note_only: assign ? 'false' : 'true',
  method_used: m,
  work_note: ascii(note)
};
