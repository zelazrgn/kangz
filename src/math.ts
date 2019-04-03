export function urand(min: number, max: number) {
    return min + Math.round(Math.random() * (max - min));
}

export function clamp(val: number, min: number, max: number) {
    return Math.min(max, Math.max(min, val));
}
