export function urand(min: number, max: number) {
    return min + Math.round(Math.random() * (max - min));
}

export function frand(min: number, max: number) {
    return min + Math.random() * (max - min);
}

export function clamp(val: number, min: number, max: number) {
    return Math.min(max, Math.max(min, val));
}

const DEBUGGING = false;

if (DEBUGGING) {
    // https://gist.github.com/mathiasbynens/5670917#file-deterministic-math-random-js
    Math.random = (function() {
        var seed = 0x2F6E2B1;
        return function() {
            // Robert Jenkins’ 32 bit integer hash function
            seed = ((seed + 0x7ED55D16) + (seed << 12))  & 0xFFFFFFFF;
            seed = ((seed ^ 0xC761C23C) ^ (seed >>> 19)) & 0xFFFFFFFF;
            seed = ((seed + 0x165667B1) + (seed << 5))   & 0xFFFFFFFF;
            seed = ((seed + 0xD3A2646C) ^ (seed << 9))   & 0xFFFFFFFF;
            seed = ((seed + 0xFD7046C5) + (seed << 3))   & 0xFFFFFFFF;
            seed = ((seed ^ 0xB55A4F09) ^ (seed >>> 16)) & 0xFFFFFFFF;
            return (seed & 0xFFFFFFF) / 0x10000000;
        };
    }());
}
