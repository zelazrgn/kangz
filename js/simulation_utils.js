import { Buff, BuffOverTime } from "./buff.js";
import { Warrior } from "./warrior.js";
import { Unit } from "./unit.js";
import { temporaryEnchants, enchants } from "./data/enchants.js";
import { items } from "./data/items.js";
import { buffs } from "./data/spells.js";
import { ModifyPowerEffect } from "./spell.js";
export function setupPlayer(race, stats, equipment, enchants, temporaryEnchant, buffs, vael = false, log) {
    const player = new Warrior(race, stats, log);
    for (let [slot, item] of equipment) {
        player.equip(slot, item, enchants.get(slot), temporaryEnchant.get(slot));
    }
    for (let buff of buffs) {
        player.buffManager.add(new Buff(buff.name, buff.duration, buff.stats), -10 * 1000);
    }
    if (vael) {
        const essenceOfTheRed = new BuffOverTime("Essence of the Red", Number.MAX_SAFE_INTEGER, undefined, 1000, new ModifyPowerEffect(20));
        player.buffManager.add(essenceOfTheRed, Math.random() * -1000);
    }
    const boss = new Unit(63, 3700 - 2250 - 640 - 505);
    player.target = boss;
    if (player.mh && player.oh && player.mh.weapon.speed === player.oh.weapon.speed) {
        player.oh.nextSwingTime += player.oh.weapon.speed / 2 * 1000;
    }
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