/*
 * Workflow: Search Similar Tickets (sub flow)  |  Node: JavaScript "URL Builds"
 * Inputs : platform, exclude_sys_id, anchor_clause, keyword_clause
 * Output : urls  -> urls.anchor_url, urls.keyword_url feed two REST GET nodes
 *
 * Retrieval is ALWAYS scoped to the platform's resolver groups. This is the core fix
 * for cross-platform pollution (e.g. Oracle GST tickets outscoring an SAP GST ticket).
 * An empty or unknown platform yields a query that matches nothing, so the flow can stay
 * linear (no branches) and simply return 0 candidates.
 */
var ITSM_BASE_URL = 'https://<your-instance>.service-now.com';
var BASE = ITSM_BASE_URL + '/api/now/table/incident';
var FIELDS = 'number,short_description,description,close_notes,assignment_group,reassignment_count';

var SCOPES = {
  'SAP':    'stateIN6,7^assignment_group.nameSTARTSWITHGD-SD-SAP^ORassignment_group.name=SD-Integration',
  'ORACLE': 'stateIN6,7^assignment_group.nameSTARTSWITHSD-ORACLE'
};

function norm(s) { return String(s || '').replace(/^["'\s]+|["'\s]+$/g, '').trim(); }
var p = norm(platform).toUpperCase();
if (p.indexOf('SAP') > -1) p = 'SAP';
else if (p.indexOf('ORACLE') > -1) p = 'ORACLE';
var scope = SCOPES[p];

function strip(c) { return norm(c).replace(/\^NQ/gi, ''); }

function buildQuery(clause) {
  var c = strip(clause);
  if (!scope || c === '') return 'sys_id=0';            // matches nothing -> {"result":[]}
  var q = scope;
  var ex = norm(exclude_sys_id);
  if (ex) q += '^sys_id!=' + ex;
  return q + '^' + c;
}
function buildUrl(q, limit) {
  return BASE + '?sysparm_query=' + encodeURIComponent(q) +
         '&sysparm_fields=' + FIELDS + '&sysparm_display_value=true&sysparm_limit=' + limit;
}

var aq = buildQuery(anchor_clause), kq = buildQuery(keyword_clause);
return {
  valid_platform: !!scope,
  platform_used: p,
  anchor_query: aq,
  keyword_query: kq,
  anchor_url: buildUrl(aq, 10),
  keyword_url: buildUrl(kq, 15)
};
