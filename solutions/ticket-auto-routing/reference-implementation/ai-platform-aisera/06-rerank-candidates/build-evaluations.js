/*
 * Workflow: Rerank Candidates (sub flow)  |  Node: JavaScript "Build Evaluations"
 * Inputs : responseRanking (single output of the Rerank prompt action), candidates_json
 * Output : ev -> evaluations_json, evaluated_count, raw_preview
 *
 * The prompt returns a compact "NUMBER|RELEVANCE|Y/N; ..." string (no nested JSON for the
 * model to get wrong). This node converts it to JSON and drops any ticket number that was
 * not actually retrieved.
 */
function S(x) { return (x === undefined || x === null) ? '' : String(x).trim(); }
function G(name) { try { return eval(name); } catch (e) { return undefined; } }
function parseJson(t) {
  t = S(t).replace(/```json|```/gi, '').trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) {}
  try { return JSON.parse('[' + t); } catch (e2) {}
  try { return JSON.parse('[' + t + ']'); } catch (e3) {}
  return null;
}

// Prompt result
var src = G('responseRanking');
var raw = '';
if (src !== undefined && src !== null) {
  if (typeof src === 'object' && src.evaluations !== undefined) {
    raw = S(src.evaluations);
  } else {
    raw = S(src);
    var a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a > -1 && b > a) {
      var o = parseJson(raw.substring(a, b + 1));
      if (o && o.evaluations !== undefined) raw = S(o.evaluations);
    }
  }
}

// Only accept numbers that were actually retrieved
var known = {};
var cands = parseJson(G('candidates_json')) || [];
if (!Array.isArray(cands)) cands = [cands];
for (var i = 0; i < cands.length; i++) {
  if (cands[i] && cands[i].number) known[String(cands[i].number).toUpperCase()] = true;
}

var out = [];
var entries = raw.split(/[;\n]/);
for (var j = 0; j < entries.length; j++) {
  var p = entries[j].split('|');
  if (p.length < 3) continue;
  var num = S(p[0]).toUpperCase();
  var rel = parseFloat(S(p[1]));
  var im = S(p[2]).toUpperCase();
  if (!/^INC\d+$/.test(num) || !known[num] || isNaN(rel)) continue;
  rel = Math.max(0, Math.min(1, rel));
  out.push({ number: num, relevance: rel, intent_match: (im === 'Y' || im === 'YES' || im === 'TRUE') });
}

return {
  evaluations_json: JSON.stringify({ evaluations: out }),
  evaluated_count: out.length,
  raw_preview: raw.substring(0, 300)
};
