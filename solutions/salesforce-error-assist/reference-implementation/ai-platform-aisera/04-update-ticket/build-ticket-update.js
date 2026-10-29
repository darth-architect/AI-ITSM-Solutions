/*
 * Sub flow: sf_update_ticket  |  Node: JavaScript "Ticket Update"
 * Input  : work_note_text
 * Output : one object -> map it to the variable req
 *          req.body_text  JSON string for the Update Ticket action's Custom Fields
 *          req.body       the same as an object (kept for platforms that want a map)
 *
 * The Update Ticket action needs Custom Fields as a JSON *string* of field names and values.
 * Passing the note text alone returned success but left the ticket unchanged.
 */
var body = {
  work_notes: work_note_text,
  comments: 'A solution for this Salesforce error has been prepared and added to your ticket ' +
            'for the support team to review and deploy.'
};

return {
  body: body,
  body_text: JSON.stringify(body)
};
