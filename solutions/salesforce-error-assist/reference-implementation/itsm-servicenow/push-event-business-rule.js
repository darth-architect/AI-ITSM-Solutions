/*
 * ServiceNow Business Rule: "Aisera - Salesforce error push"
 *   Table     : Incident [incident]
 *   When      : async        Insert: true   Update: false
 *   Advanced  : true
 *   Condition : (Advanced tab, one line)
 *     current.short_description.toString().toLowerCase().indexOf('salesforce') > -1 ||
 *     current.description.toString().toLowerCase().indexOf('salesforce') > -1 ||
 *     current.cmdb_ci.getDisplayValue().toLowerCase().indexOf('salesforce') > -1
 *
 * Sends what the notification needs (number, short description, caller email) to the AI platform's
 * event endpoint. The endpoint, auth and headers live in the REST Message, not in this script.
 *
 * Why these settings:
 *   async        - the caller's save never waits for the AI platform
 *   insert only  - the solution write-back (work note, comment) cannot re-trigger it
 *   CI clause    - tickets that never mention Salesforce but carry the Salesforce CI still qualify
 *
 * The body is built with JSON.stringify so quotes or line breaks in the short description cannot
 * break it; this overrides the REST Message's Content template.
 */
(function executeRule(current, previous) {
  try {
    var r = new sn_ws.RESTMessageV2('Aisera Event Studio', 'post_sf_incident');
    r.setRequestBody(JSON.stringify({
      event_type: 'sf_incident_created',
      sys_id: current.getUniqueValue(),
      number: current.getValue('number'),
      short_description: current.getValue('short_description'),
      caller_email: current.caller_id.email.toString()
    }));
    var resp = r.execute();
    gs.info('[Aisera SF] push ' + current.number + ' -> HTTP ' + resp.getStatusCode());
  } catch (e) {
    gs.error('[Aisera SF] push failed for ' + current.number + ': ' + e.message);
  }
})(current, previous);
