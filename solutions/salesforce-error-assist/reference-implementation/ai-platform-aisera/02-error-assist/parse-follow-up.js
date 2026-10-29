/*
 * Workflow: SF Error Assist (conversation)  |  Node: JavaScript "Error Follow-up Output"
 * Input  : errorFollow  (String: the whole JSON returned by the SF_Error_FollowUp prompt)
 * Output : one object -> map it to the variable promptRespond
 *          promptRespond.answer (shown to the user), promptRespond.in_scope ("true"/"false")
 *
 * No branch on in_scope is needed: an off-topic question already gets a polite redirect as its answer.
 */
function parse(s) {
  if (s && typeof s === 'object') return s;
  if (!s) return null;
  s = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { return JSON.parse(s.substring(a, b + 1)); } catch (e) { return null; }
}

var resp = parse(errorFollow) || {};

// Tokens back to angle brackets, HTML-escaped so the bot shows them instead of stripping them
var answer = String(resp.answer || '')
  .replace(/_LT_/g, '&lt;')
  .replace(/_GT_/g, '&gt;');

return {
  in_scope: String(resp.in_scope === true || resp.in_scope === 'true'),
  answer: answer || "Sorry, I couldn't answer that just now. You can ask again, or carry on with the solution."
};
