import { Proc, SpellBuff, ExtraAttack } from "../spell.js";
import { StatValues, Stats } from "../stats.js";
import { ItemSlot } from "../item.js";
import { Buff } from "../buff.js";

export interface EnchantDescription {
    name: string,
    slot: ItemSlot,
    stats?: StatValues,
    proc?: Proc
}

export const enchants: EnchantDescription[] = [
    {
        // NOTE: to simplify the code, treating these as two separate buffs since they stack
        // crusader buffs apparently can be further stacked by swapping weapons but not going to bother with that
        name: 'Crusader MH',
        slot: ItemSlot.MAINHAND,
        proc: new Proc(new SpellBuff(new Buff("Crusader MH", 15, new Stats({str: 100}))), {ppm: 1}),
    },
    {
        name: 'Crusader OH',
        slot: ItemSlot.OFFHAND,
        proc: new Proc(new SpellBuff(new Buff("Crusader OH", 15, new Stats({str: 100}))), {ppm: 1}),
    },
    {
        name: '15 Strength',
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        stats: {str: 15},
    },
    {
        name: '8 Strength',
        slot: ItemSlot.HEAD | ItemSlot.LEGS,
        stats: {str: 8},
    },
    {
        name: '15 Agility',
        slot: ItemSlot.HANDS,
        stats: {agi: 15},
    },
    {
        name: '7 Strength',
        slot: ItemSlot.HANDS,
        stats: {str: 7},
    },
    {
        name: '1 Haste',
        slot: ItemSlot.HEAD | ItemSlot.LEGS | ItemSlot.HANDS,
        stats: {haste: 1.01},
    },
    {
        name: '3 Agility',
        slot: ItemSlot.BACK,
        stats: {agi: 3},
    },
    {
        name: 'Might of the Scourge',
        slot: ItemSlot.SHOULDER,
        stats: {ap: 26, crit: 1},
    },
    {
        name: 'ZG Enchant (30 AP)',
        slot: ItemSlot.SHOULDER,
        stats: {ap: 30},
    },
    {
        name: 'Greater Stats (+4)',
        slot: ItemSlot.CHEST,
        stats: {str: 4, agi: 4},
    },
    {
        name: '9 Strength',
        slot: ItemSlot.WRIST,
        stats: {str: 9},
    },
    {
        name: 'Run Speed',
        slot: ItemSlot.FEET,
        stats: {}, // TODO - do movement speed if I ever get around to simulating fights you have to run out
    },
    {
        name: '7 Agility',
        slot: ItemSlot.FEET,
        stats: {agi: 7},
    },
];

export const temporaryEnchants: EnchantDescription[] = [
    {
        name: '+8 Damage',
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        stats: { plusDamage: 8 },
    },
    {
        name: 'Elemental Sharpening Stone',
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        stats: { crit: 2 },
    },
    {
        name: 'Windfury',
        slot: ItemSlot.MAINHAND,
        proc: new Proc([
            new ExtraAttack("Windfury Totem", 1),
            new SpellBuff(new Buff("Windfury Totem", 1.5, { ap: 315 }))
        ], {chance: 0.2}),
    }
];
