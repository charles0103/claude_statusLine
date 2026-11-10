// Pure layout: slots persist between rows; a finished lane becomes reusable.
// Input must be child-before-parent (git log --date-order guarantees this).
export function layoutLanes(commits) {
  let slots = [], nextColor = 0;
  const rows = [];
  const vacant = () => {
    const hole = slots.findIndex(slot => slot === null);
    return hole < 0 ? slots.length : hole;
  };
  for (const commit of commits) {
    const before = slots.slice();
    let lane = slots.findIndex(slot => slot?.hash === commit.hash);
    if (lane < 0) {
      lane = vacant();
      slots[lane] = { hash: commit.hash, color: nextColor++ };
    }
    const color = slots[lane].color;
    const edges = [];
    before.forEach((slot, index) => {
      if (slot) edges.push({ from: index, to: index, start: 0,
        end: index === lane ? 0.5 : 1, color: slot.color, target: slot.hash });
    });
    slots[lane] = null;
    [...new Set(commit.parents)].forEach((hash, index) => {
      let target = slots.findIndex(slot => slot?.hash === hash);
      if (target < 0) {
        target = index === 0 ? lane : vacant();
        slots[target] = { hash, color: index === 0 ? color : nextColor++ };
      }
      edges.push({ from: lane, to: target, start: 0.5, end: 1,
        color: slots[target].color, target: hash });
    });
    while (slots.length && slots[slots.length - 1] === null) slots.pop();
    rows.push({ commit, lane, color, edges, before, after: slots.slice(),
      width: Math.max(lane + 1, before.length, slots.length) });
  }
  return rows;
}
