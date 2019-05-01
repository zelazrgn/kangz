import { StatValues } from "./stats.js";
import { Buff } from "./buff.js";
import { LogFunction, Race } from "./player.js";
import { Warrior } from "./warrior.js";
import { Unit } from "./unit.js";
import { ItemSlot, ItemDescription } from "./item.js";
import { EnchantDescription, temporaryEnchants, enchants } from "./data/enchants.js";
import { items } from "./data/items.js";
import { buffs } from "./data/spells.js";

export interface SimulationDescription {
    race: Race,
    stats: StatValues,
    equipment: Map<ItemSlot, number>,
    enchants: Map<ItemSlot, number>,
    temporaryEnchants: Map<ItemSlot, number>,
    buffs: number[],
    fightLength: number,
    realtime: boolean,
    heroicStrikeRageReq: number,
    hamstringRageReq: number,
    bloodthirstExecRageLimit: number,
}

export function setupPlayer(race: Race, stats: StatValues, equipment: Map<ItemSlot, ItemDescription>, enchants: Map<ItemSlot, EnchantDescription>, temporaryEnchant: Map<ItemSlot, EnchantDescription>, buffs: Buff[], log?: LogFunction) {
    const player = new Warrior(race, stats, log);

    for (let [slot, item] of equipment) {
        player.equip(slot, item, enchants.get(slot), temporaryEnchant.get(slot));
    }

    for (let buff of buffs) {
        player.buffManager.add(buff, 0);
    }

    const boss = new Unit(63, 4691 - 2250 - 640 - 505 - 600); // sunder, cor, ff, annih
    player.target = boss;

    return player;
}

export function lookupMap<K,V>(slotToIndex: Map<K, number>, lookup: V[]): Map<K, V> {
    const res = new Map<K,V>();

    for (let [slot, idx] of slotToIndex) {
        if (lookup[idx]) {
            res.set(slot, lookup[idx]);
        } else {
            console.log('bad index', idx, lookup);
        }
    }

    return res;
}

export function lookupArray<V>(indices: number[], lookup: V[]): V[] {
    const res: V[] = [];

    for (let idx of indices) {
        if (lookup[idx]) {
            res.push(lookup[idx]);
        } else {
            console.log('bad index', idx, lookup);
        }
    }
    
    return res;
}

export function lookupItems(map: Map<ItemSlot, number>) {
    return lookupMap(map, items);
}

export function lookupEnchants(map: Map<ItemSlot, number>) {
    return lookupMap(map, enchants);
}

export function lookupTemporaryEnchants(map: Map<ItemSlot, number>) {
    return lookupMap(map, temporaryEnchants);
}

export function lookupBuffs(indices: number[]) {
    return lookupArray(indices, buffs);
}
