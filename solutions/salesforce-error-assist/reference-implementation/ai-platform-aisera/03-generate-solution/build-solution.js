/*
 * Sub flow: sf_solution (Generate Solution)  |  Node: JavaScript "Build Solution"
 * Inputs : solutionResponse  (String: the whole JSON returned by the SF_Error_Solution prompt)
 *          diagnosis_json    (String: the diagnose JSON, for the work note)
 * Output : one object -> map it to the variable sol (returned by the sub flow)
 *          sol.solution_ok       "true" if there is code or steps to show
 *          sol.solution_text     HTML for the chat message
 *          sol.fixed_code_clean  the code with real < >, for the ticket attachment
 *          sol.file_name_clean   e.g. AccountTrigger.trigger
 *          sol.work_note_text    plain-text work note for the ticket
 *
 * Angle brackets travel as _LT_ / _GT_ because the prompt tool strips <...>. raw() restores them for
 * the ticket; show() and code() escape them for the HTML chat; inside <pre> the code is escaped too.
 */
var SHOW_ESCAPED = true; // true: chat shows < > via &lt; &gt; (HTML bot). false: raw < >

function parse(s) {
  if (s && typeof s === 'object') return s;
  if (!s) return {};
  s = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return {};
  try { return JSON.parse(s.substring(a, b + 1)); } catch (e) { return {}; }
}
function raw(s) {   // tokens -> real angle brackets (ticket + attachment)
  return String(s || '').replace(/_LT_/g, '<').replace(/_GT_/g, '>');
}
function show(s) {  // tokens -> angle brackets the chat can display
  return SHOW_ESCAPED
    ? String(s || '').replace(/_LT_/g, '&lt;').replace(/_GT_/g, '&gt;')
    : raw(s);
}
// Splits multi-line items and strips numbering the model already added ("1. 1. ..." bug)
function list(arr, fmt, numbered) {
  var items = [];
  (arr || []).forEach(function (x) {
    String(x).split('\n').forEach(function (line) {
      line = line.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim();
      if (line) items.push(line);
    });
  });
  return items.map(function (x, i) {
    return (numbered ? (i + 1) + '. ' : '- ') + fmt(x);
  }).join('\n');
}

var res = parse(solutionResponse);
var diag = parse(diagnosis_json);
var idf = diag.identify || {}, enl = diag.enlighten || {};
var check = res.self_check || {};
var chg = res.changes || [];
var steps = res.config_steps || [];
var pattern = res.is_pattern === true || res.is_pattern === 'true';

var fixed_code_clean = raw(res.fixed_code);
var file_name_clean = res.file_name || '';
var has_code = fixed_code_clean.replace(/\s/g, '').length > 0;
var has_steps = steps.length > 0;

// ---- chat message (HTML) ----
function hl(arr, numbered) { return list(arr, show, numbered).replace(/\n/g, '<br>'); }
function code(s) {
  return raw(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var parts = [];
parts.push('<b>Solution:</b> ' + show(res.solution_summary));
if (chg.length) parts.push('<b>What changes:</b><br>' + hl(chg));
if (has_code) {
  parts.push('<b>' + (pattern ? 'Example fix pattern (adapt it to your code)'
                              : 'Corrected ' + file_name_clean) + ':</b>' +
             '<pre>' + code(res.fixed_code) + '</pre>');
}
if (has_steps) parts.push('<b>Steps:</b><br>' + hl(steps, true));
if (res.test_notes) parts.push('<b>How to test:</b> ' + show(res.test_notes));
var solution_text = parts.join('<br><br>');

// ---- ticket work note (plain text) ----
var work_note_text = [
  '[AISERA-SF-SOLUTION] AI-generated and confirmed by the caller in Aisera. Review before deploying.',
  'Error: ' + (idf.error_name || '') + (idf.component_name ? ' (' + idf.component_name + ')' : ''),
  'Why: ' + (enl.why || ''),
  'Most likely cause: ' + (enl.most_likely_cause || ''),
  'Source check: ' + (check.note || ''),
  'Solution: ' + raw(res.solution_summary),
  chg.length ? 'Changes:\n' + list(chg, raw) : '',
  has_steps ? 'Steps:\n' + list(steps, raw, true) : '',
  'Test: ' + raw(res.test_notes),
  'Deploy: ' + raw(res.deploy_notes),
  has_code ? 'Code: attached as ' + file_name_clean + (pattern ? ' (example pattern)' : '') : ''
].filter(function (x) { return x; }).join('\n');

return {
  solution_ok: String(has_code || has_steps),
  solution_text: solution_text,
  fixed_code_clean: fixed_code_clean,
  file_name_clean: file_name_clean,
  work_note_text: work_note_text
};
