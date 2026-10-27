/*
 * Workflow: Search Similar Tickets (sub flow)  |  Node: JavaScript "Merger"
 * Inputs : anchorResults, keywordResults  (raw responses of the two REST GET nodes)
 * Output : candidates -> candidates.candidate_count, candidates.candidates_json
 *
 * Merges and de-duplicates both result sets, compacts long text, and ranks tickets
 * matched by both anchor and keyword queries first.
 */
function parse(r) {
  if (!r) return [];
  try {
    var d = (typeof r === 'string') ? JSON.parse(r) : r;
    return (d && d.result) ? d.result : [];
  } catch (e) { return []; }
}
function disp(f) { return (f && typeof f === 'object') ? (f.display_value || f.value || '') : (f || ''); }
function cut(s, n) {
  s = (s || '').toString().replace(/[^\x09\x0A\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.substring(0, n) + '...' : s;
}

var map = {};
function add(rows, tag) {
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], num = disp(r.number);
    if (!map[num]) {
      map[num] = {
        number: num,
        group: disp(r.assignment_group),
        short_description: cut(disp(r.short_description), 200),
        description: cut(disp(r.description), 500),
        close_notes: cut(disp(r.close_notes), 300),
        reassignment_count: parseInt(disp(r.reassignment_count) || '0', 10),
        matched_by: []
      };
    }
    if (map[num].matched_by.indexOf(tag) < 0) map[num].matched_by.push(tag);
  }
}
add(parse(anchorResults), 'anchor');
add(parse(keywordResults), 'keyword');

var list = [];
for (var k in map) list.push(map[k]);
list.sort(function (a, b) {
  return (b.matched_by.length - a.matched_by.length) ||
         ((b.matched_by.indexOf('anchor') > -1) - (a.matched_by.indexOf('anchor') > -1));
});
list = list.slice(0, 15);

return {
  candidate_count: list.length,
  candidates_json: JSON.stringify(list)
};
