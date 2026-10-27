/*
 * Workflow: Ticket Auto Routing (main)  |  Node: JavaScript "Gate"
 * Inputs : t_found, t_already_assigned  (outputs of Ticket Details)
 * Output : gate -> gate.proceed ("yes" | "no")
 *
 * Followed by a Branch node:  gate.proceed.equalsIgnoreCase("yes")
 * Booleans from sub flows are normalised here because branch expressions were unreliable
 * when comparing them directly.
 */
function T(v) { return String(v).toLowerCase() === 'true'; }
return {
  proceed: (T(t_found) && !T(t_already_assigned)) ? 'yes' : 'no'
};
