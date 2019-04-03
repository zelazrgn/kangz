export function urand(min, max) {
    return min + Math.round(Math.random() * (max - min));
}
export function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}
//# sourceMappingURL=math.js.map