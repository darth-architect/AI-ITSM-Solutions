/*
 * ServiceNow Business Rule: "AI Routing - Push New Incident"
 *   Table     : Incident [incident]
 *   When      : async        Insert: true   Update: false
 *   Condition : Assignment group is empty  OR  Assignment group is "AI Triage"
 *   Advanced  : true
 *
 * Sends only identifiers to the AI platform's event endpoint. The routing workflow re-reads
 * the ticket through the REST API, so descriptions are never pushed in the event body.
 *
 * Why these settings:
 *   async        - the caller's save never waits for the AI platform
 *   insert only  - the routing workflow's own update cannot re-trigger this rule (no loop)
 *   condition    - tickets already routed by native assignment rules are never sent
 */
(function executeRule(current, previous) {
  try {
    var r = new sn_ws.RESTMessageV2('AI Routing Event', 'trigger');
    r.setRequestBody(JSON.stringify({
      event_type: 'incident_created',
      incident_number: current.getValue('number'),
      sys_id: current.getUniqueValue(),
      short_description: current.getValue('short_description'),
      created_on: current.getValue('sys_created_on')
    }));
    var resp = r.execute();
    if (resp.getStatusCode() >= 300) {
      gs.warn('[AI Routing] event failed (' + resp.getStatusCode() + ') for ' + current.number + ': ' + resp.getBody());
    }
  } catch (e) {
    gs.error('[AI Routing] event error for ' + current.number + ': ' + e);
  }
})(current, previous);
