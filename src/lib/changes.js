export const EDITABLE_COLLECTIONS = ['users', 'branches', 'attendance', 'adjustments', 'leaveRequests', 'auditLog', 'notifications', 'evaluations', 'transfers', 'payrollHistory'];

export function stateChanges(before, after) {
  return EDITABLE_COLLECTIONS.flatMap(collection => {
    if (before[collection] === after[collection]) return [];
    const previous = new Map((before[collection] || []).map(row => [row.id, row]));
    const next = new Map((after[collection] || []).map(row => [row.id, row]));
    return [...new Set([...previous.keys(), ...next.keys()])].flatMap(id => {
      const oldRow = previous.get(id) || null;
      const newRow = next.get(id) || null;
      return JSON.stringify(oldRow) === JSON.stringify(newRow) ? [] : [{ collection, id, before: oldRow, after: newRow }];
    });
  });
}
