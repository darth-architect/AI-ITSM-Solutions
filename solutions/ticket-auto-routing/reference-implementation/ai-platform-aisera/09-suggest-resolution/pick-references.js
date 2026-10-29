/*
 * Workflow: Suggest Resolution (sub flow)  |  Node: JavaScript "Pick References"
 * Inputs : candidates_json (Search Similar Tickets), evaluations_json (Rerank Candidates)
 * Output : refs -> references_text, reference_numbers, reference_count
 *
 * Only past tickets the reranker judged as the same problem (intent match, relevance >= 0.7)
 * are given to the resolution prompt, so suggestions are grounded in how those were fixed.
 * When nothing qualifies, references_text is "NONE" and the prompt falls back to general steps.
 */
function S(x) { return (x === undefined || x === null) ? '' : String(x).trim(); }
function G(name) { try { return eval(name); } catch (e) { return undefined; } }
function parseJson(t) {
  if (t && typeof t === 'object') return t;
  t = S(t);
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) {}
  try { return JSON.parse('[' + t); } catch (e2) {}
  try { return JSON.parse('[' + t + ']'); } catch (e3) {}
  return null;
}
function ascii(s) { return S(s).replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim(); }
function isTrue(v) { return v === true || String(v).toLowerCase() === 'true'; }

var cands = parseJson(G('candidates_json')) || [];
if (!Array.isArray(cands)) cands = [cands];
var ev = parseJson(G('evaluations_json'));
var evals = Array.isArray(ev) ? ev : ((ev && ev.evaluations) || []);

var byNum = {};
for (var i = 0; i < cands.length; i++) if (cands[i] && cands[i].number) byNum[String(cands[i].number).toUpperCase()] = cands[i];

var picked = [];
for (var j = 0; j < evals.length; j++) {
  var e = evals[j], c = byNum[String(e.number).toUpperCase()];
  var rel = Number(e.relevance) || 0;
  if (c && isTrue(e.intent_match) && rel >= 0.7 && S(c.close_notes)) picked.push({ c: c, rel: rel });
}
picked.sort(function (a, b) { return b.rel - a.rel; });
picked = picked.slice(0, 3);

var lines = [], nums = [];
for (var k = 0; k < picked.length; k++) {
  var p = picked[k];
  nums.push(p.c.number);
  lines.push(p.c.number + ' (relevance ' + p.rel + ', resolved by ' + ascii(p.c.group) + ')' +
             ' | Problem: ' + ascii(p.c.short_description) +
             ' | Resolution: ' + ascii(p.c.close_notes));
}

return {
  references_text: lines.length ? lines.join('\n') : 'NONE',
  reference_numbers: nums.join(', '),
  reference_count: nums.length
};
