/*
 * Workflow: Ticket Routing Event Handler  |  Node: JavaScript "Read Event"
 * Input  : response  (event payload delivered by the AI platform's event gateway)
 * Output : evt -> incident_number, sys_id, short_description, valid
 *
 * Followed by a Branch on evt.valid, then the Ticket Auto Routing (main) sub flow with
 * incident_number = ${evt.incident_number}. Only the identifiers are trusted from the event;
 * the main flow re-reads the ticket from the ITSM tool.
 */
function S(x) { return (x === undefined || x === null) ? '' : String(x).trim(); }
function toObj(v) {
  if (v === undefined || v === null) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch (e) { return {}; }
}

var r = toObj(response);

// Use the payload directly, or unwrap it if the gateway nests it
var d = r;
if (!(d.incident_number || d.number || d.sys_id)) {
  var wrappers = ['data', 'payload', 'body', 'event', 'record'];
  for (var i = 0; i < wrappers.length; i++) {
    var w = toObj(r[wrappers[i]]);
    if (w.incident_number || w.number || w.sys_id) { d = w; break; }
  }
}

var num = S(d.incident_number || d.number).toUpperCase();
return {
  incident_number: num,
  sys_id: S(d.sys_id),
  short_description: S(d.short_description),
  valid: /^INC\d+$/.test(num)
};
