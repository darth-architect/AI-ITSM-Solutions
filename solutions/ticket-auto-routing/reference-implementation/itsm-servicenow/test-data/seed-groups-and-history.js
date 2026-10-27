/*
 * AI routing POC - seed groups + resolved ticket history
 * Run in: System Definition > Scripts - Background (non-production instance)
 *
 * PART 1 creates 10 assignment groups (7 SAP + 3 Oracle) if they don't exist.
 * PART 2 creates 40 RESOLVED incidents tagged correlation_id AIRT-SEED-01..40.
 *   - Spread across SAP groups so Step 3 retrieval has something to find
 *   - Includes Oracle GST/invoice decoys to reproduce the "Oracle pollution" failure
 *   - A few tickets have reassignment_count = 1 to exercise the confidence weighting
 *
 * Safe to re-run: groups are reused; seed tickets are skipped if their correlation_id already exists.
 * Find seeds:  incident.list?sysparm_query=correlation_idSTARTSWITHAIRT-SEED
 */

// ---------- PART 1: groups ----------
var groups = [
  ['GD-SD-SAP-SD', 'SAP Sales & Distribution: sales orders, deliveries, pricing, billing, invoices, credit/debit memos, SD and GST output reports'],
  ['GD-SD-SAP-FICO', 'SAP Finance & Controlling: GL/AP/AR postings, posting periods, account determination, assets, closing'],
  ['GD-SD-SAP-Basis', 'SAP Basis: performance, dumps, background jobs, transports, RFC, spool/output devices'],
  ['GD-SD-SAP-Security-Request', 'SAP Security: user creation, lock/unlock, password reset, role and T-code access, authorization errors'],
  ['GD-SD-SAP-GRC', 'SAP GRC: firefighter/emergency access, SoD conflicts, risk analysis, GRC access request workflow'],
  ['GD-SD-SAP-ITGC', 'SAP ITGC: SOX controls, audit evidence, user access reviews, change management evidence'],
  ['SD-Integration', 'Integration: IDocs, EDI, interfaces, middleware (PI/PO, CPI), B2B and portal connectivity'],
  ['SD-ORACLE-FIN', 'Oracle EBS Finance: AR, AP, GL, tax setup and finance reports'],
  ['SD-ORACLE-TECHNICAL', 'Oracle EBS Technical: concurrent programs, reports, templates, custom code'],
  ['SD-ORACLE-OM-SVC', 'Oracle EBS Order Management: sales orders, shipping, invoice documents']
];

var gid = {};
for (var i = 0; i < groups.length; i++) {
  var g = new GlideRecord('sys_user_group');
  if (!g.get('name', groups[i][0])) {
    g.initialize();
    g.name = groups[i][0];
    g.description = groups[i][1];
    g.active = true;
    g.insert();
    gs.info('GROUP CREATED: ' + groups[i][0]);
  } else {
    gs.info('GROUP EXISTS:  ' + groups[i][0]);
  }
  gid[groups[i][0]] = g.getUniqueValue();
}

// ---------- PART 2: resolved history ----------
// [group, short_description, description, close_notes, reassignment_count]
var seeds = [
  // ----- GD-SD-SAP-SD (7)
  ['GD-SD-SAP-SD', 'ZSTR_GST report not showing invoices for Unit 0142',
   'Running T-code ZSTR_GST for September, invoices of Unit 0142 are not in the output although they are posted and visible in VF03. Needed for GSTR-1 filing.',
   'Unit 0142 was missing from the plant-to-GSTIN mapping table used by ZSTR_GST. Added the entry and re-ran the report; all invoices now appear.', 0],
  ['GD-SD-SAP-SD', 'E-invoice IRN not generated for billing document 903401122',
   'Billing document 903401122 saved but IRN and QR code were not generated. E-invoice status shows error 2150 duplicate IRN.',
   'Duplicate IRN request from an earlier attempt. Fetched existing IRN from the portal, updated the billing document and reprocessed output.', 0],
  ['GD-SD-SAP-SD', 'Corrected invoice needed after credit memo - customer billed wrong price',
   'Customer billed at old price on invoice 903377410. Credit memo 903380015 already issued for full value. Need a new invoice with the contract price.',
   'Updated PR00 condition record for customer/material, reset billing status on the delivery and created new invoice 903380122 via VF01.', 0],
  ['GD-SD-SAP-SD', 'Invoice total incorrect - freight condition added twice',
   'Invoice 903390871 shows freight condition ZFRT twice so the total is higher than the sales order value.',
   'Pricing procedure had ZFRT in two steps after a recent transport. Corrected the procedure, cancelled the invoice in VF11 and re-billed.', 0],
  ['GD-SD-SAP-SD', 'Billing block Z1 cannot be removed from sales order 1200567',
   'Sales order 1200567 has billing block Z1. VA02 gives an error when trying to remove it, so invoice cannot be created.',
   'Block Z1 is released via the SD release step after credit approval. Released per approval and billing document created.', 0],
  ['GD-SD-SAP-SD', 'Export invoices not printing - output type ZEXP in error',
   'Export invoices for sales org 1300 are not printing. Output type ZEXP shows red status in VF03.',
   'Output condition record for ZEXP was missing for the new sales org. Maintained in VV31 and reprocessed outputs.', 0],
  ['GD-SD-SAP-SD', 'Delivery not created for stock transport order - VL10B shows no items',
   'STO 4500012233 to plant 1450 does not appear in VL10B, so the outbound delivery cannot be created.',
   'Shipping point determination was missing for the new receiving plant. Maintained and delivery created.', 1],

  // ----- GD-SD-SAP-FICO (6)
  ['GD-SD-SAP-FICO', 'Posting period not open for company code 1100 - message F5 201',
   'FB60 vendor invoice posting fails: posting period 006 2026 is not open for company code 1100.',
   'Period 6 had been closed early for account type K. Opened in OB52 with finance controller approval.', 0],
  ['GD-SD-SAP-FICO', 'Account determination error when releasing billing documents to accounting',
   'VFX3 shows error in account determination for tax code O2. Several billing documents are not posted to FI.',
   'G/L account for tax key MWS/O2 missing in OB40 for the chart of accounts. Maintained and released the documents.', 1],
  ['GD-SD-SAP-FICO', 'Depreciation run AFAB terminated with errors for company code 1200',
   'Monthly depreciation run AFAB ended with errors. Log points to asset 400012.',
   'Asset 400012 had an inactive cost center. Corrected in AS02 and repeated the run.', 0],
  ['GD-SD-SAP-FICO', 'GL balance in FAGLB03 does not match trial balance report',
   'Balance for GL 410100 differs between FAGLB03 and the custom trial balance report for period 8.',
   'Custom report was reading a non-leading ledger. Corrected the selection; balances match.', 0],
  ['GD-SD-SAP-FICO', 'Incoming payment cannot clear customer invoice - difference too large',
   'In F-28 the payment cannot clear invoice 903355001, error says difference too large for clearing.',
   'User tolerance group was below the difference amount. Assigned the correct tolerance group after approval.', 0],
  ['GD-SD-SAP-FICO', 'GR/IR clearing F.13 not clearing items for vendor 200045',
   'Automatic clearing F.13 leaves open GR/IR items for vendor 200045 although quantities match.',
   'Items differed by assignment field. Adjusted clearing criteria for the account and re-ran F.13.', 0],

  // ----- GD-SD-SAP-Basis (5)
  ['GD-SD-SAP-Basis', 'Job Z_MONTHLY_SALES_EXTRACT cancelled - ST22 dump TSV_TNEW_PAGE_ALLOC_FAILED',
   'Background job Z_MONTHLY_SALES_EXTRACT is cancelled in SM37. ST22 shows TSV_TNEW_PAGE_ALLOC_FAILED.',
   'Job selection too large for the memory quota. Split the variant by sales org and rescheduled; job completes.', 0],
  ['GD-SD-SAP-Basis', 'Transport stuck in PRD import queue with return code 8',
   'Transport DEVK912455 is stuck in the PRD import queue in STMS with return code 8.',
   'Missing predecessor object. Imported dependent transport first, then re-imported successfully.', 0],
  ['GD-SD-SAP-Basis', 'SAP PRD very slow for all users since morning',
   'All users report PRD is extremely slow; transactions time out.',
   'Dialog work processes were blocked by hung update tasks. Cleared via SM50/SM13 and updated DB statistics.', 0],
  ['GD-SD-SAP-Basis', 'RFC connection to BW system failing in SM59',
   'Data loads to BW failing. SM59 connection test for the BW destination returns a logon error.',
   'Technical RFC user password had expired. Reset and set to system user type.', 0],
  ['GD-SD-SAP-Basis', 'SAP spool requests not reaching printer for plant 1400',
   'Delivery notes printed from SAP for plant 1400 stay in SP01 and never reach the printer.',
   'Output device LP14 pointed to the old print server. Updated host in SPAD.', 1],

  // ----- GD-SD-SAP-Security-Request (5)
  ['GD-SD-SAP-Security-Request', 'Not authorized to use transaction VA02 - need access',
   'Getting "You are not authorized to use transaction VA02". Manager has approved access for sales order changes.',
   'Assigned sales order change role to the user after approval.', 0],
  ['GD-SD-SAP-Security-Request', 'SAP user locked after incorrect password attempts',
   'My SAP user is locked after too many wrong passwords. Please unlock.',
   'Unlocked user in SU01 and issued initial password.', 0],
  ['GD-SD-SAP-Security-Request', 'New joiner needs SAP user ID with billing display access',
   'New joiner in billing team from Monday. Needs SAP user with display access for VF03 and VA03.',
   'Created user and assigned billing display role.', 0],
  ['GD-SD-SAP-Security-Request', 'Missing authorization for FB03 document display in company code 1200',
   'FB03 shows no authorization for company code 1200. SU53 shows missing object F_BKPF_BUK.',
   'Added FI display role with company code 1200 after approval.', 0],
  ['GD-SD-SAP-Security-Request', 'Need access to ME23N for purchase order display',
   'Need display access to ME23N for vendor follow-up. Approved by department head.',
   'Assigned PO display role.', 0],

  // ----- GD-SD-SAP-GRC (3)
  ['GD-SD-SAP-GRC', 'Firefighter ID needed for emergency fix in PRD',
   'Need firefighter access in PRD tonight to correct a stuck pricing record. Approved by IT manager.',
   'Assigned FF ID for 4 hours via GRC EAM; log review sent to controller.', 0],
  ['GD-SD-SAP-GRC', 'SoD conflict blocking role assignment in GRC access request',
   'Access request for vendor maintain + payment run shows SoD risk and cannot be submitted.',
   'Risk mitigated with control assignment approved by risk owner; request completed.', 0],
  ['GD-SD-SAP-GRC', 'GRC access request workflow stuck at approver stage',
   'Access request 70012 has been pending at approver stage for 5 days; approver has left the company.',
   'Updated approver determination in GRC and re-routed the request.', 0],

  // ----- GD-SD-SAP-ITGC (3)
  ['GD-SD-SAP-ITGC', 'Audit evidence - list of users with SAP_ALL in PRD',
   'Internal audit needs a list of users holding SAP_ALL or SAP_NEW in PRD with assignment dates.',
   'Extracted from SUIM with screenshots and shared with audit.', 0],
  ['GD-SD-SAP-ITGC', 'Quarterly user access review extraction for SOX control',
   'Need Q3 user-to-role extraction for the quarterly access review SOX control.',
   'Generated extract and review workbook; sent to control owners.', 0],
  ['GD-SD-SAP-ITGC', 'Change management evidence for transports moved in Q3',
   'Auditors need evidence of approvals for all transports imported to PRD in Q3.',
   'Compiled transport list with linked change approvals.', 0],

  // ----- SD-Integration (4)
  ['SD-Integration', 'INVOIC IDocs to customer EDI failing with status 02',
   'Outbound INVOIC IDocs to key customer are in status 02, invoices not reaching their EDI system.',
   'Port definition pointed to the old EDI endpoint. Corrected and reprocessed IDocs.', 0],
  ['SD-Integration', 'Inbound ORDERS IDocs stuck in status 51 - sales orders not created',
   'Customer purchase orders via EDI are failing with status 51; no sales orders created.',
   'Customer material mapping missing for new SKUs. Maintained and reprocessed with BD87.', 0],
  ['SD-Integration', 'E-invoice portal interface timing out for all invoices',
   'All e-invoice submissions to the GSP portal are timing out from the middleware since 10 AM.',
   'Expired certificate on the middleware channel. Renewed certificate and resent queued messages.', 1],
  ['SD-Integration', 'Bank payment file not transferred to bank SFTP',
   'Payment run file generated but not received by the bank SFTP.',
   'SFTP key rotated by bank. Updated key in middleware and retransmitted.', 0],

  // ----- Oracle decoys (7) - GST/invoice wording overlaps SAP tickets on purpose
  ['SD-ORACLE-FIN', 'Oracle AR invoice report missing GST details',
   'Oracle AR invoice report does not show GST tax lines for invoices of operating unit IN-North.',
   'Tax regime not attached to the operating unit in Oracle. Updated setup and re-ran report.', 0],
  ['SD-ORACLE-FIN', 'GST not calculated on Oracle AR transaction',
   'Oracle Receivables transaction 551023 created without GST lines.',
   'Missing tax rate for the HSN code in Oracle tax setup. Added and recalculated.', 0],
  ['SD-ORACLE-FIN', 'Oracle AP invoice validation error - tax line missing',
   'Oracle Payables invoice fails validation with missing tax line for GST.',
   'Supplier site tax profile incomplete. Updated and revalidated.', 0],
  ['SD-ORACLE-TECHNICAL', 'Oracle tax invoice report output blank - concurrent request completed with warning',
   'Concurrent request for the tax invoice report completes with warning and the output file is blank.',
   'Template file corrupted after patch. Re-uploaded XML Publisher template.', 0],
  ['SD-ORACLE-TECHNICAL', 'GST invoice register report in Oracle missing invoices for operating unit',
   'GST invoice register concurrent program is not listing several invoices for the Pune operating unit for October.',
   'Custom view filtered on an end-dated organization. Fixed the view definition.', 0],
  ['SD-ORACLE-OM-SVC', 'GST number not printing on Oracle sales invoice',
   'Customer GST number is not printed on the Oracle OM invoice document.',
   'Customer site GSTIN missing in Oracle. Updated site and reprinted.', 0],
  ['SD-ORACLE-OM-SVC', 'Oracle sales order stuck in Awaiting Shipping',
   'Oracle OM order 77120 stuck in Awaiting Shipping status for 3 days.',
   'Reservation missing at subinventory. Re-reserved and ship confirmed.', 0]
];

var caller = gs.getUserID();
var created = 0, skipped = 0;
for (var j = 0; j < seeds.length; j++) {
  var s = seeds[j];
  var tag = 'AIRT-SEED-' + (j < 9 ? '0' : '') + (j + 1);

  var exists = new GlideRecord('incident');
  if (exists.get('correlation_id', tag)) { skipped++; continue; }

  var inc = new GlideRecord('incident');
  inc.initialize();
  inc.caller_id = caller;
  inc.short_description = s[1];
  inc.description = s[2];
  inc.category = 'software';
  inc.contact_type = 'email';
  inc.impact = 3;
  inc.urgency = 3;
  inc.assignment_group = gid[s[0]];
  inc.state = 6;            // Resolved
  inc.incident_state = 6;
  inc.close_code = 'Solution provided';
  inc.close_notes = s[3];
  inc.resolved_by = caller;
  inc.resolved_at = new GlideDateTime();
  inc.reassignment_count = s[4];
  inc.correlation_id = tag;
  inc.insert();
  created++;
  gs.info(tag + ' | ' + inc.number + ' | ' + s[0]);
}
gs.info('SEED DONE: created ' + created + ', skipped ' + skipped);
