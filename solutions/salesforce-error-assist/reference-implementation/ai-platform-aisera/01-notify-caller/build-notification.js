/*
 * Workflow: SF Error Notify (event-triggered)  |  Node: JavaScript "Build Notification"
 * Input  : response  (event payload pushed by the ITSM Business Rule)
 * Output : the notification payload as a JSON string -> passed to the proactive notification action
 *
 * The payload follows the platform's custom-notification format: a title (HTML), comma-separated
 * button labels, and the flow IDs each button starts. "See details" starts the conversation
 * workflow; "Not now" starts a one-node flow that just acknowledges.
 *
 * The notification cannot carry the ticket into the conversation in this format, so the conversation
 * looks the ticket up again (see 02-error-assist/find-ticket.js).
 */
var evt = (typeof response === "string") ? JSON.parse(response) : response;

var ticketNumber = evt.number            || "";
var shortDesc    = evt.short_description || "";
var callerEmail  = evt.caller_email      || "";

// The title is HTML: escape the user's own text and keep it short
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
if (shortDesc.length > 120) {
  shortDesc = shortDesc.substring(0, 117) + "...";
}

var payload = {};
payload.userEmail = callerEmail;
payload.emailNotification = "false";
payload.destinationBotId = "<BOT_ID>";
payload.botId = "<BOT_ID>";
payload.followUpActionTitle = "Your ticket <b>" + esc(ticketNumber) + "</b> (<b>" + esc(shortDesc) +
  "</b>) looks like a Salesforce error. I can explain what's causing it and show you how to fix it. " +
  "Would you like to see the details?";
payload.followUpActionLabels = "See details,Not now";
payload.followUpActionType = "flow";
payload.followUpActionIds = "<CONVERSATION_FLOW_ID>,<NOT_NOW_FLOW_ID>";
return JSON.stringify(payload);
