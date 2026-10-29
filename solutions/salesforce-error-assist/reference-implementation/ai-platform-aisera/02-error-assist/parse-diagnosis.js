/*
 * Workflow: SF Error Assist (conversation)  |  Node: JavaScript "Parse Diagnosis"
 * Input  : ticketResponse  (String: the whole JSON returned by the SF_Error_Diagnose prompt)
 * Output : one object -> map it to the variable diag
 *          diag.parse_ok, diag.is_sf, diag.enough, diag.solution_available   ("true"/"false" strings)
 *          diag.clarifying_question, diag.component_type, diag.component_name
 *          diag.diagnosis_json      (clean JSON string for the solution and follow-up prompts)
 *          diag.explanation_text    (HTML for the chat message)
 *
 * Branches downstream compare strings, e.g. ${diag.is_sf.equalsIgnoreCase("false")}.
 * The demo channel (Teams via Aisera) renders HTML, not Markdown, so the message uses <b> and <br>.
 */
function parse(s) {
  if (s && typeof s === 'object') return s;
  if (!s) return null;
  s = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  // keep only the outermost { ... } in case the model adds stray text
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { return JSON.parse(s.substring(a, b + 1)); } catch (e) { return null; }
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function hlist(arr, numbered) {
  return (arr || []).map(function (x, i) {
    return (numbered ? (i + 1) + '. ' : '• ') + esc(x);
  }).join('<br>');
}

var resp = parse(ticketResponse) || {};
var idf = resp.identify, val = resp.validate, enl = resp.enlighten;
var parse_ok = !!(idf && val && enl);
idf = idf || {}; val = val || {}; enl = enl || {};

var out = {
  parse_ok: String(parse_ok),
  is_sf: String(val.is_salesforce_error === true),
  enough: String(val.enough_detail === true),
  clarifying_question: val.clarifying_question ||
    'Could you share the exact Salesforce error message and what you were doing when it appeared?',
  solution_available: String(enl.solution_available === true),
  component_type: idf.component_type || 'Unknown',
  component_name: idf.component_name || '',
  diagnosis_json: JSON.stringify({ identify: idf, validate: val, enlighten: enl }),
  explanation_text: [
    '<b>What is happening:</b> ' + esc(enl.what_is_happening),
    '<b>Why this error occurs:</b> ' + esc(enl.why),
    '<b>Common causes:</b><br>' + hlist(enl.common_causes),
    '<b>Most likely here:</b> ' + esc(enl.most_likely_cause),
    '<b>How to confirm:</b><br>' + hlist(enl.how_to_confirm, true),
    '<b>Impact:</b> ' + esc(enl.impact)
  ].join('<br><br>')
};

return out;
