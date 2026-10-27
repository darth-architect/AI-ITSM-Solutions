/*
 * AI routing - regression test tickets (AIRT-16 .. AIRT-27)
 * Run in: System Definition > Scripts - Background (non-production instance)
 *
 * Creates tickets in the "AI Triage" queue, so the push Business Rule fires exactly as it
 * does for a ticket saved from the form. Wait 1-2 minutes, then run check-regression-results.js.
 */
var TRIAGE = 'AI Triage';

var tickets = [
  { id: 'AIRT-16', sd: 'Transport DEVK913020 failed in PRD import with return code 8',
    desc: 'Transport DEVK913020 shows return code 8 in STMS for the PRD import queue. Change is needed for tomorrow\'s go-live.' },
  { id: 'AIRT-17', sd: 'SAP user locked - too many wrong password attempts',
    desc: 'My SAP user got locked this morning after entering the old password several times. Please unlock it.' },
  { id: 'AIRT-18', sd: 'INVOIC IDocs to distributor stuck in status 02',
    desc: 'Outbound INVOIC IDocs to our main distributor are in status 02 since yesterday, so they are not receiving electronic invoices.' },
  { id: 'AIRT-19', sd: 'GRC access request blocked by SoD risk - vendor create and payment',
    desc: 'My GRC access request for vendor master maintenance shows an SoD risk with the payment run role and cannot be submitted.' },
  { id: 'AIRT-20', sd: 'Audit request - users with SAP_ALL in production',
    desc: 'Statutory auditors need the list of users holding SAP_ALL in PRD with assignment dates, as evidence for the SOX review.' },
  { id: 'AIRT-21', sd: 'Billing documents not posted to accounting - VFX3 account determination error',
    desc: 'Several billing documents from today are blocked for accounting. VFX3 shows "Error in account determination" for tax code O2.' },
  { id: 'AIRT-22', sd: 'Oracle concurrent request for AR aging report completes with warning, output blank',
    desc: 'The Oracle concurrent program for the AR aging report finishes with warning and the output file is empty. It worked last week before the patch.' },
  { id: 'AIRT-23', sd: 'RFC connection to BW failing in SM59',
    desc: 'BW data loads are failing. SM59 connection test to the BW destination returns a logon error. Please route to GD-SD-SAP-Basis.' },
  { id: 'AIRT-24', sd: 'Teams meetings not loading on laptop',
    desc: 'Microsoft Teams shows a blank screen when I join any meeting. Restarted twice, still the same.' },
  { id: 'AIRT-25', sd: 'Laptop very slow since morning',
    desc: 'My laptop has been extremely slow since this morning and applications take minutes to open.' },
  { id: 'AIRT-26', sd: 'Pricing condition missing on sales order - order value zero',
    desc: 'Sales order 1200899 created in VA01 shows net value 0. The PR00 price condition is not determined for material 300112.' },
  { id: 'AIRT-27', sd: 'Background job Z_DAILY_STOCK_UPLOAD cancelled again',
    desc: 'Job Z_DAILY_STOCK_UPLOAD was cancelled in SM37 again last night, ST22 shows TSV_TNEW_PAGE_ALLOC_FAILED. Please assign to SD-ORACLE-FIN.' }
];

var tg = new GlideRecord('sys_user_group');
if (!tg.get('name', TRIAGE)) { gs.error('Group "' + TRIAGE + '" not found - run create-triage-group.js first'); }

var caller = gs.getUserID();
for (var i = 0; i < tickets.length; i++) {
  var t = tickets[i];
  var ex = new GlideRecord('incident');
  if (ex.get('correlation_id', t.id)) { gs.info(t.id + ' already exists: ' + ex.number + ' (skipped)'); continue; }
  var gr = new GlideRecord('incident');
  gr.initialize();
  gr.caller_id = caller;
  gr.short_description = t.sd;
  gr.description = t.desc;
  gr.impact = 3;
  gr.urgency = 3;
  gr.category = 'software';
  gr.contact_type = 'email';
  gr.assignment_group = tg.getUniqueValue();
  gr.correlation_id = t.id;
  gr.insert();
  gs.info(t.id + ' | ' + gr.number);
}
