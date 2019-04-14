import { Warrior } from "./warrior.js";
import { crusaderBuffMHProc, crusaderBuffOHProc, buffs } from "./data/spells.js";
import { Unit } from "./unit.js";
import { items } from "./data/items.js";
export function setupPlayer(stats, equipment, buffs, log) {
    const player = new Warrior(stats, log);
    for (let [item, slot] of equipment) {
        player.equip(item, slot);
    }
    for (let buff of buffs) {
        player.buffManager.add(buff, 0);
    }
    player.mh.addProc(crusaderBuffMHProc);
    player.oh.addProc(crusaderBuffOHProc);
    const boss = new Unit(63, 200);
    player.target = boss;
    return player;
}
export function equipmentIndicesToItem(equipment) {
    const res = [];
    for (let [idx, slot] of equipment) {
        if (items[idx]) {
            res.push([items[idx], slot]);
        }
        else {
            console.log('bad item index', idx);
        }
    }
    return res;
}
export function buffIndicesToBuff(buffIndices) {
    const res = [];
    for (let idx of buffIndices) {
        if (buffs[idx]) {
            res.push(buffs[idx]);
        }
        else {
            console.log('bad buff index', idx);
        }
    }
    return res;
}
//# sourceMappingURL=simulation_utils.js.map