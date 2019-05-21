import { Buff } from "./buff.js";
import { Warrior } from "./warrior.js";
import { Unit } from "./unit.js";
import { temporaryEnchants, enchants } from "./data/enchants.js";
import { items } from "./data/items.js";
import { buffs } from "./data/spells.js";
export function setupPlayer(race, stats, equipment, enchants, temporaryEnchant, buffs, log) {
    const player = new Warrior(race, stats, log);
    for (let [slot, item] of equipment) {
        player.equip(slot, item, enchants.get(slot), temporaryEnchant.get(slot));
    }
    for (let buff of buffs) {
        player.buffManager.add(new Buff(buff.name, buff.duration, buff.stats), 0);
    }
    const boss = new Unit(63, 4691 - 2250 - 640 - 505 - 600);
    player.target = boss;
    return player;
}
export function lookupMap(slotToIndex, lookup) {
    const res = new Map();
    for (let [slot, idx] of slotToIndex) {
        if (lookup[idx]) {
            res.set(slot, lookup[idx]);
        }
        else {
            console.log('bad index', idx, lookup);
        }
    }
    return res;
}
export function lookupArray(indices, lookup) {
    const res = [];
    for (let idx of indices) {
        if (lookup[idx]) {
            res.push(lookup[idx]);
        }
        else {
            console.log('bad index', idx, lookup);
        }
    }
    return res;
}
export function lookupItems(map) {
    return lookupMap(map, items);
}
export function lookupEnchants(map) {
    return lookupMap(map, enchants);
}
export function lookupTemporaryEnchants(map) {
    return lookupMap(map, temporaryEnchants);
}
export function lookupBuffs(indices) {
    return lookupArray(indices, buffs);
}
//# sourceMappingURL=simulation_utils.js.map