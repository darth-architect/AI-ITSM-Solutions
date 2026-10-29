/*
 * Workflow: Suggest Resolution (sub flow)  |  Node: JavaScript "Parse Resolution"
 * Inputs : resolutionSuggestion (single output of the Suggest Resolution prompt action), refs
 * Output : sr -> basis, summary, steps, references, has_suggestion
 *
 * Turns the prompt's JSON into a short, numbered, ASCII-only block for the work note.
 */
function S(x) { return (x === undefined || x === null) ? '' : String(x).trim(); }
function G(name) { try { return eval(name); } catch (e) { return undefined; } }
function ascii(s) { return S(s).replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim(); }

var J = {};
var src = G('resolutionSuggestion');
if (src !== undefined && src !== null) {
  if (typeof src === 'object' && src.steps !== undefined) {
    J = src;
  } else {
    try {
      var s = String(src).replace(/```json|```/gi, '');
      var a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a > -1 && b > a) J = JSON.parse(s.substring(a, b + 1));
    } catch (e) { J = {}; }
  }
}

var R = G('refs') || {};
var refNums = S(R.reference_numbers);

var raw = S(J.steps);
var parts = raw.split(/\s*\|\s*|\n+|;\s*(?=\d+[.)])/);
var steps = [];
for (var i = 0; i < parts.length && steps.length < 6; i++) {
  var t = ascii(parts[i]).replace(/^\d+[.)]\s*/, '');
  if (t.length < 4) continue;
  if (t.length > 220) t = t.substring(0, 217) + '...';
  steps.push((steps.length + 1) + '. ' + t);
}

var basis = S(J.basis).toLowerCase() === 'history' && refNums ? 'history' : 'general';

return {
  basis: basis,
  summary: ascii(J.summary).substring(0, 250),
  steps: steps.join('\n'),
  references: basis === 'history' ? refNums : '',
  has_suggestion: steps.length > 0
};
