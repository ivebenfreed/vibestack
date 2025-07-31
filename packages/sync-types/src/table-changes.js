// Type guards for message handling
export function isTableChange(payload) {
    const p = payload;
    return p
        && typeof p.table === 'string'
        && ['insert', 'update', 'delete'].includes(p.operation)
        && typeof p.data === 'object'
        && p.data !== null
        && typeof p.updatedAt === 'string';
}
export function isRelationshipUpdate(payload) {
    const p = payload;
    return p
        && typeof p.relationName === 'string'
        && ['set', 'add', 'remove'].includes(p.operation)
        && Array.isArray(p.targetIds)
        && p.targetIds.every(id => typeof id === 'string');
}
//# sourceMappingURL=table-changes.js.map