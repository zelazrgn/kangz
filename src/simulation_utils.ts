import { StatValues } from "./stats.js";
import { ItemWithSlot } from "./simulation.js";
import { Buff } from "./buff.js";
import { LogFunction, Race } from "./player.js";
import { Warrior } from "./warrior.js";
import { crusaderBuffMHProc, crusaderBuffOHProc, buffs, windfuryEnchant, denseDamageStone } from "./data/spells.js";
import { Unit } from "./unit.js";
import { ItemSlot } from "./item.js";
import { items } from "./data/items.js";

export interface SimulationDescription {
    race: Race,
    stats: StatValues,
    equipment: [number, ItemSlot][],
    buffs: number[],
    fightLength: number,
    realtime: boolean,
    heroicStrikeRageReq: number,
    hamstringRageReq: number,
    bloodthirstExecRageLimit: number,
}

export function setupPlayer(race: Race, stats: StatValues, equipment: ItemWithSlot[], buffs: Buff[], log?: LogFunction) {
    const player = new Warrior(race, stats, log);

    for (let [item, slot] of equipment) {
        player.equip(item, slot);
    }

    for (let buff of buffs) {
        player.buffManager.add(buff, 0);
    }

    player.mh!.addProc(crusaderBuffMHProc);
    player.mh!.temporaryEnchant = race === Race.ORC ? windfuryEnchant : denseDamageStone;

    if (player.oh) {
        player.oh.addProc(crusaderBuffOHProc);
        player.oh.temporaryEnchant = denseDamageStone;
    }

    const boss = new Unit(63, 4691 - 2250 - 640 - 505 - 600); // sunder, cor, ff, annih
    player.target = boss;

    return player;
}

export function equipmentIndicesToItem(equipment: [number, ItemSlot][]): ItemWithSlot[] {
    const res: ItemWithSlot[] = [];
    
    for (let [idx, slot] of equipment) {
        if (items[idx]) {
            res.push([items[idx], slot]);
        } else {
            console.log('bad item index', idx);
        }
    }

    return res;
}

export function buffIndicesToBuff(buffIndices: number[]): Buff[] {
    const res: Buff[] = [];

    for (let idx of buffIndices) {
        if (buffs[idx]) {
            res.push(buffs[idx]);
        } else {
            console.log('bad buff index', idx);
        }
    }
    
    return res;
}
