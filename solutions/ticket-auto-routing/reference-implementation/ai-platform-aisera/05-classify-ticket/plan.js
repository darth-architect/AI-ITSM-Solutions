/*
 * Workflow: Classify Ticket (sub flow)  |  Node: JavaScript "Plan"
 * Input  : routingClassification  (single output of the Classify prompt action, JSON text)
 * Output : plan -> path, platform, search_platform, anchor_clause, keyword_clause,
 *                  explicit_group, conflict_groups, excluded_system, primary_system,
 *                  charter_group, charter_strength, intent_summary, reason
 *
 * Turns the LLM's judgement into deterministic routing inputs:
 *  - validates every group name against the allow-list (the LLM can never invent a group)
 *  - picks one path: explicit | conflict | excluded | no_platform | search | error
 *  - builds the search clauses in code (no query syntax is trusted from the model)
 */
function S(x) { return (x === undefined || x === null) ? '' : String(x).trim(); }
function G(name) { try { return eval(name); } catch (e) { return undefined; } }

// ---- Read the prompt result (object or JSON text, with or without code fences) ----
var J = {};
var src = G('routingClassification');
if (src === undefined) src = G('prompt_output');
if (src !== undefined && src !== null) {
  if (typeof src === 'object' && !Array.isArray(src) && src.routing_decision !== undefined) {
    J = src;
  } else {
    try {
      var s = String(src).replace(/```json|```/gi, '');
      var a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a > -1 && b > a) J = JSON.parse(s.substring(a, b + 1));
    } catch (e) { J = {}; }
  }
}
function F(k) { return S(J[k]); }

// ---- Allow-list of routable groups (edit per customer) ----
var GROUPS = {
  SAP: ['GD-SD-SAP-SD', 'GD-SD-SAP-FICO', 'GD-SD-SAP-Basis', 'GD-SD-SAP-Security-Request', 'GD-SD-SAP-GRC', 'GD-SD-SAP-ITGC', 'SD-Integration'],
  ORACLE: ['SD-ORACLE-FIN', 'SD-ORACLE-TECHNICAL', 'SD-ORACLE-OM-SVC']
};
function key(s) { return S(s).toLowerCase().replace(/[\s\-_]/g, ''); }
function canon(s, plat) {
  var k = key(s);
  if (!k) return '';
  var lists = plat ? [GROUPS[plat] || []] : [GROUPS.SAP, GROUPS.ORACLE];
  for (var i = 0; i < lists.length; i++)
    for (var j = 0; j < lists[i].length; j++)
      if (key(lists[i][j]) === k) return lists[i][j];
  return '';
}

// ---- Search terms -> encoded-query clauses ----
var GENERIC = ['issue', 'problem', 'error', 'not working', 'invoice', 'invoices', 'report', 'sap', 'oracle',
               'system', 'user', 'access', 'data', 'missing', 'wrong'];
function terms(str, isAnchor) {
  var out = [], parts = S(str).split(/[|;\n]/);
  for (var i = 0; i < parts.length && out.length < 6; i++) {
    var t = parts[i].replace(/[\^=]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length < 3) continue;
    if (GENERIC.indexOf(t.toLowerCase()) > -1) continue;
    if (isAnchor && /^\d{6,}$/.test(t)) continue;       // document numbers never match history
    if (!isAnchor && t.split(' ').length > 2) continue;  // long phrases never match a substring search
    if (out.indexOf(t) < 0) out.push(t);
  }
  return out;
}
function clause(list) {
  var p = [];
  for (var i = 0; i < list.length; i++)
    p.push('short_descriptionLIKE' + list[i] + '^ORdescriptionLIKE' + list[i] + '^ORclose_notesLIKE' + list[i]);
  return p.join('^OR');
}

// ---- Decide the path ----
var dec = F('routing_decision').toLowerCase();
var plat = F('platform').toUpperCase();
plat = plat.indexOf('SAP') > -1 ? 'SAP' : (plat.indexOf('ORACLE') > -1 ? 'ORACLE' : 'NONE');

var explicitGroup = canon(F('explicit_group'));
var conflict = [];
var all = F('explicit_groups_all').split(/[|;,]/);
for (var c = 0; c < all.length; c++) {
  var g = canon(all[c]);
  if (g && conflict.indexOf(g) < 0) conflict.push(g);
}

var path;
if (!dec) path = 'error';                                         // prompt failed or returned nothing
else if (dec === 'explicit_conflict' || conflict.length > 1) path = 'conflict';
else if (dec === 'explicit' && explicitGroup) path = 'explicit';
else if (dec === 'excluded') path = 'excluded';
else if (plat === 'NONE') path = 'no_platform';
else path = 'search';                                             // includes "explicit" to an unknown group

var anchors = path === 'search' ? terms(F('anchor_terms'), true) : [];
var keywords = path === 'search' ? terms(F('keywords'), false) : [];
var charter = plat === 'NONE' ? '' : canon(F('charter_group'), plat);
var strength = F('charter_strength').toLowerCase() === 'clear' ? 'clear' : 'weak';

return {
  path: path,
  platform: plat === 'SAP' ? 'SAP' : (plat === 'ORACLE' ? 'Oracle' : 'none'),
  search_platform: path === 'search' ? (plat === 'ORACLE' ? 'Oracle' : 'SAP') : '',
  anchor_clause: clause(anchors),
  keyword_clause: clause(keywords),
  anchor_terms: anchors.join(' | '),
  keywords: keywords.join(' | '),
  explicit_group: path === 'explicit' ? explicitGroup : '',
  conflict_groups: conflict.join(', '),
  excluded_system: F('excluded_system'),
  primary_system: F('primary_system'),
  charter_group: charter,
  charter_strength: charter ? strength : '',
  intent_summary: F('intent_summary'),
  reason: F('reason')
};
