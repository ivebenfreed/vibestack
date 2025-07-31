// Type guards
export function isTableChange(payload) {
    const p = payload;
    return p
        && typeof p.table === 'string'
        && ['insert', 'update', 'delete'].includes(p.operation)
        && typeof p.data === 'object'
        && p.data !== null
        && (!p.lsn || typeof p.lsn === 'string') // LSN is optional
        && typeof p.updatedAt === 'string';
}
export function isClientMessageType(type) {
    return type.startsWith('clt_');
}
//# sourceMappingURL=index.js.map