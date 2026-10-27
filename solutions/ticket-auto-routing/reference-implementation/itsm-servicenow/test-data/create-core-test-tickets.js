/*
 * AI routing test tickets - SAP
 * Run in: System Definition > Scripts - Background (DEV/TEST instance only)
 * Creates 8 unassigned incidents tagged with correlation_id AIRT-01..AIRT-08.
 * Expected outcomes are printed to the log only; they are NOT written to the ticket.
 *
 * Find them later:   incident.list?sysparm_query=correlation_idSTARTSWITHAIRT-
 */

var tickets = [
  {
    id: 'AIRT-01',
    expect: 'Step 1 explicit -> GD-SD-SAP-FICO (ticket is SD/FICO ambiguous; explicit instruction must win)',
    impact: 2, urgency: 2,
    sd: 'Billing document not released to accounting - account determination error',
    desc: 'Hi team,\n\n' +
      'Billing document 903512877 (sales org 1100, created today) is stuck with status "Posting document not created". ' +
      'When I try to release it through VFX3 it shows "Error in account determination: table T030K key 1100 MWS".\n\n' +
      'This is blocking 14 invoices for month-end dispatch. Please assign to GD-SD-SAP-FICO, as Suresh from finance has already started looking at the tax keys.\n\n' +
      'Regards,\nNeha Kapoor\nBilling Desk, Pune'
  },
  {
    id: 'AIRT-02',
    expect: 'Step 2A exclusion (Salesforce primary) -> early exit, no SAP group',
    impact: 3, urgency: 2,
    sd: 'Salesforce CPQ quote cannot be edited - SAP customer number field locked',
    desc: 'When I open quote Q-0048213 in Salesforce CPQ, all line items are read-only and the "SAP Customer No." field is greyed out. ' +
      'Other reps on the West team can edit their quotes normally. I have the Sales Rep profile and nothing has changed on my side.\n\n' +
      'The customer already exists in SAP (1004587), so the master data is fine - it is the Salesforce quote screen that is locked. ' +
      'I need to send this quote to the customer by end of day.\n\nThanks,\nRohit Sharma'
  },
  {
    id: 'AIRT-03',
    expect: 'Step 3 consensus -> GD-SD-SAP-SD (Salesforce mentioned only as secondary/comparison)',
    impact: 2, urgency: 2,
    sd: 'Customer overbilled on invoice 903468120 - credit issued, corrected invoice needed',
    desc: 'Customer Shree Ganesh Polymers (SAP customer 1003321) was billed on invoice 903468120 at INR 1,450 per unit instead of the agreed INR 1,320 per unit under agreement Agr-00081245.\n\n' +
      'We have already issued credit memo 903471002 for the full invoice value, but the corrected invoice has not been created in SAP yet. ' +
      'Salesforce shows the correct contract price, so the agreement data is right.\n\n' +
      'Please create the corrected invoice against delivery 8004412290 so the customer can release payment.\n\nRegards,\nKavita Rao\nAR Team'
  },
  {
    id: 'AIRT-04',
    expect: 'Step 3 -> GD-SD-SAP-SD. Replica of the failing case: retrieval MUST be scoped to SAP groups or Oracle GST tickets will pollute it',
    impact: 2, urgency: 1,
    sd: 'ZSTR_GST report missing invoices for Unit 0137 and 0138 - GSTR-1 filing due',
    desc: 'When running T-Code ZSTR_GST for October 2026, invoices for Unit 0137 and Unit 0138 are missing from the output. ' +
      'For example, invoices 903498771, 903498790 and 903499015 are posted and visible in VF03 but do not appear in the report. ' +
      'All other units are showing correctly.\n\n' +
      'GSTR-1 filing is due on 11 November, so we need the report corrected before then.\n\nThanks,\nManoj Iyer\nIndirect Tax'
  },
  {
    id: 'AIRT-05',
    expect: 'Step 3 -> GD-SD-SAP-FICO',
    impact: 2, urgency: 2,
    sd: 'Posting period 007 2026 not open error in FB60 for company code 1200',
    desc: 'While posting vendor invoices in FB60 for company code 1200 we get the error "Posting period 007 2026 is not open" (message no. F5 201). ' +
      'Period 7 should be open as per the close calendar.\n\n' +
      'Around 40 vendor invoices for the Hyderabad unit are pending because of this. Please check the period settings in OB52.\n\nRegards,\nSrinivas Reddy\nAP Team'
  },
  {
    id: 'AIRT-06',
    expect: 'Step 3 -> GD-SD-SAP-Security-Request. Traps: not GRC (no SoD/firefighter), not SD despite VF02',
    impact: 3, urgency: 3,
    sd: 'Not authorized for transaction VF02 - need access for billing corrections',
    desc: 'I moved from the dispatch team to the billing desk last week. When I open VF02 I get "You are not authorized to use transaction VF02".\n\n' +
      'My manager Anil Mehta has approved this (approval email attached). Please add the billing change role to my user AKUMAR07 in PRD.\n\nThanks,\nArjun Kumar'
  },
  {
    id: 'AIRT-07',
    expect: 'Step 3 -> GD-SD-SAP-Basis',
    impact: 2, urgency: 1,
    sd: 'Background job Z_DAILY_STOCK_UPLOAD failing since last night - cancelled in SM37',
    desc: 'Job Z_DAILY_STOCK_UPLOAD (scheduled under user BATCH_ADM) has been cancelled in SM37 for the last two runs, at 00:30 and 06:30. ' +
      'The job log shows "Internal session terminated with a runtime error TSV_TNEW_PAGE_ALLOC_FAILED (see ST22)".\n\n' +
      'Since then PRD has been noticeably slow for the warehouse team. This job feeds the morning stock report to all plants.\n\nRegards,\nDeepak Joshi\nSupply Chain IT'
  },
  {
    id: 'AIRT-08',
    expect: 'Vague: platform SAP but no anchors -> low confidence -> Step 4 fallback; correct outcome is stay in triage / AI-suggested only',
    impact: 3, urgency: 2,
    sd: 'Numbers wrong in SAP for Nashik plant',
    desc: 'Hi, since Monday the figures in SAP for our Nashik plant do not look right and the team is confused. ' +
      'Can someone please check urgently, management review is on Thursday.\n\nThanks,\nPooja'
  }
];

var caller = gs.getUserID();
for (var i = 0; i < tickets.length; i++) {
  var t = tickets[i];
  var gr = new GlideRecord('incident');
  gr.initialize();
  gr.caller_id = caller;
  gr.short_description = t.sd;
  gr.description = t.desc;
  gr.impact = t.impact;
  gr.urgency = t.urgency;
  gr.category = 'software';
  gr.contact_type = 'email';
  gr.correlation_id = t.id;
  var sysId = gr.insert();

  // Assignment rules / data lookups may auto-fill a group on insert - clear it so the ticket is unrouted.
  var inc = new GlideRecord('incident');
  if (inc.get(sysId)) {
    if (!inc.assignment_group.nil() || !inc.assigned_to.nil()) {
      inc.assignment_group = '';
      inc.assigned_to = '';
      inc.update();
    }
    gs.info(t.id + ' | ' + inc.number + ' | ' + sysId + ' | EXPECT: ' + t.expect);
  }
}
