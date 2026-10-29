/*
 * AI routing - regression result check for AIRT-16 .. AIRT-27
 * Run in: System Definition > Scripts - Background, 1-2 minutes after create-regression-tickets.js
 *
 * Compares each ticket's current assignment group and latest [AI Routing] work note with the
 * expected outcome, and prints PASS / FAIL / PENDING per ticket plus a summary.
 *   expectGroup : group the ticket should end up in ("Service Desk" = low confidence / not routable)
 *   expectNote  : text the latest [AI Routing] note must contain
 */
var expected = {
  'AIRT-16': { expectGroup: 'GD-SD-SAP-Basis',            expectNote: 'ASSIGNED',     why: 'transport RC 8 matches Basis history' },
  'AIRT-17': { expectGroup: 'GD-SD-SAP-Security-Request', expectNote: 'ASSIGNED',     why: 'user unlock matches Security history' },
  'AIRT-18': { expectGroup: 'SD-Integration',             expectNote: 'ASSIGNED',     why: 'INVOIC IDoc status 02 matches Integration history' },
  'AIRT-19': { expectGroup: 'GD-SD-SAP-GRC',              expectNote: 'ASSIGNED',     why: 'SoD risk is GRC, not Security-Request' },
  'AIRT-20': { expectGroup: 'GD-SD-SAP-ITGC',             expectNote: 'ASSIGNED',     why: 'audit evidence is ITGC' },
  'AIRT-21': { expectGroup: 'GD-SD-SAP-FICO',             expectNote: 'ASSIGNED',     why: 'account determination is FICO even though it starts in billing' },
  'AIRT-22': { expectGroup: 'SD-ORACLE-TECHNICAL',        expectNote: 'Oracle',       why: 'Oracle platform; assigned or recommended, never an SAP group' },
  'AIRT-23': { expectGroup: 'GD-SD-SAP-Basis',            expectNote: 'explicit',     why: 'explicit valid group in the text' },
  'AIRT-24': { expectGroup: 'Service Desk',               expectNote: 'out_of_scope', why: 'Teams is end-user software (exclusion)' },
  'AIRT-25': { expectGroup: 'Service Desk',               expectNote: 'no_platform',   why: 'no SAP/Oracle evidence' },
  'AIRT-26': { expectGroup: 'GD-SD-SAP-SD',               expectNote: 'SD',           why: 'pricing condition is SD; assigned or recommended' },
  'AIRT-27': { expectGroup: 'SD-ORACLE-FIN',              expectNote: 'explicit',     why: 'KNOWN RISK: explicit route in caller text wins even across platforms' }
};

var pass = 0, fail = 0, pending = 0;
for (var id in expected) {
  var e = expected[id];
  var inc = new GlideRecord('incident');
  if (!inc.get('correlation_id', id)) { gs.info(id + ' | MISSING'); fail++; continue; }

  var note = '';
  var j = new GlideRecord('sys_journal_field');
  j.addQuery('element_id', inc.getUniqueValue());
  j.addQuery('element', 'work_notes');
  j.addQuery('value', 'STARTSWITH', '[AI Routing]');
  j.orderByDesc('sys_created_on');
  j.setLimit(1);
  j.query();
  if (j.next()) note = String(j.value);

  var group = inc.assignment_group.getDisplayValue() || '(empty)';
  var firstLine = note ? note.split('\n')[0] : '';
  var status;
  if (!note) { status = 'PENDING'; pending++; }
  else if (group === e.expectGroup && note.indexOf(e.expectNote) > -1) { status = 'PASS'; pass++; }
  else if ((e.expectNote === 'SD' || e.expectNote === 'Oracle') && group === 'Service Desk' && note.indexOf('Recommended resolver: ' + e.expectGroup) > -1) { status = 'PASS (Service Desk, recommended ' + e.expectGroup + ')'; pass++; }
  else { status = 'FAIL'; fail++; }

  gs.info(status + ' | ' + id + ' | ' + inc.number + ' | group: ' + group + ' | expected: ' + e.expectGroup +
          ' (' + e.why + ') | note: ' + firstLine);
}
gs.info('SUMMARY: ' + pass + ' pass, ' + fail + ' fail, ' + pending + ' pending (no AI note yet - wait and re-run)');
