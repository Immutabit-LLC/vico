export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value) {
    return UUID_RE.test(value);
}
export function assertUuid(value, label = "thread id") {
    if (!UUID_RE.test(value)) {
        throw new Error(`invalid ${label}: ${JSON.stringify(value)}`);
    }
    return value;
}
//# sourceMappingURL=uuid.js.map