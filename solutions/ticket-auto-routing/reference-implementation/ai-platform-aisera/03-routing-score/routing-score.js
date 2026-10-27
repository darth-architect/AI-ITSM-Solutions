/*
 * Workflow: Routing Score (sub flow)  |  Node: JavaScript "Score Routing"
 * Inputs : candidates_json  (from Search Similar Tickets)
 *          evaluations_json (from Rerank Candidates)
 * Output : score -> band, method, decision_group, confidence, margin, support,
 *                   top_relevance, evidence, breakdown_json (+ debug_* counters)
 *
 * Deterministic confidence math. The LLM only judges relevance per ticket; the resolving
 * group, reassignment count and match type always come from the ITSM data, so the model
 * cannot invent a group or a ticket.
 *
 * Bands:
 *   HIGH   consensus : >= 2 supporting tickets, confidence >= 0.6, margin >= 0.2
 *   HIGH   top1      : best ticket relevance >= 0.85 and confidence >= 0.6
 *   MEDIUM weak_match: confidence >= 0.4 and best relevance >= 0.6
 *   LOW    otherwise  -> fallback rules
 */
var candIn = (typeof candidates_json !== 'undefined') ? candidates_json :
             (typeof candidatesJson !== 'undefined') ? candidatesJson : '';
var evalIn = (typeof evaluations_json !== 'undefined') ? evaluations_json : '';

function parse(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === 'object' && v.evaluations) return v;
  var s = String(v).trim();                     // coerces host-language strings too
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) {}
  try { return JSON.parse('[' + s); } catch (e2) {}
  try { return JSON.parse('[' + s + ']'); } catch (e3) {}
  return null;
}
function isTrue(v) { return v === true || String(v).toLowerCase() === 'true'; }
function r2(n) { return Math.round(n * 100) / 100; }

var cands = parse(candIn) || [];
if (!Array.isArray(cands)) cands = [cands];
var ev = parse(evalIn);
var evals = Array.isArray(ev) ? ev : ((ev && ev.evaluations) || []);

var byNum = {};
for (var i = 0; i < cands.length; i++) if (cands[i] && cands[i].number) byNum[String(cands[i].number)] = cands[i];

var scores = {}, support = {}, best = {}, evidence = {}, total = 0, matchedEvals = 0;
for (var j = 0; j < evals.length; j++) {
  var e = evals[j], c = byNum[String(e.number)];
  if (!c) continue;                                  // ignore anything not actually retrieved
  matchedEvals++;
  var rel = Number(e.relevance) || 0;
  if (!isTrue(e.intent_match) || rel < 0.5) continue;
  var w = rel
        * (Number(c.reassignment_count) > 0 ? 0.6 : 1.0)               // bounced tickets count less
        * ((c.matched_by || []).indexOf('anchor') > -1 ? 1.2 : 1.0);   // exact identifier match counts more
  var g = c.group;
  scores[g] = (scores[g] || 0) + w;
  support[g] = (support[g] || 0) + 1;
  best[g] = Math.max(best[g] || 0, rel);
  (evidence[g] = evidence[g] || []).push(c.number + ' (' + rel + ')');
  total += w;
}

var ranked = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
var top = ranked[0] || '', second = ranked[1] || '';
var conf = total ? scores[top] / total : 0;
var margin = total ? (scores[top] - (second ? scores[second] : 0)) / total : 0;

var band = 'LOW', method = 'none';
if (top) {
  if (support[top] >= 2 && conf >= 0.6 && margin >= 0.2) { band = 'HIGH'; method = 'consensus'; }
  else if (best[top] >= 0.85 && conf >= 0.6)             { band = 'HIGH'; method = 'top1'; }
  else if (conf >= 0.4 && best[top] >= 0.6)              { band = 'MEDIUM'; method = 'weak_match'; }
}

var breakdown = {};
for (var k = 0; k < ranked.length; k++) breakdown[ranked[k]] = { score: r2(scores[ranked[k]]), support: support[ranked[k]] };

return {
  band: band,
  method: method,
  decision_group: band === 'LOW' ? '' : top,
  confidence: r2(conf),
  margin: r2(margin),
  support: top ? support[top] : 0,
  top_relevance: top ? best[top] : 0,
  evidence: top ? evidence[top].slice(0, 3).join(', ') : '',
  breakdown_json: JSON.stringify(breakdown),
  debug_candidates_parsed: cands.length,
  debug_evaluations_parsed: evals.length,
  debug_evaluations_matched: matchedEvals
};
