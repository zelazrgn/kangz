import { WeaponType, WeaponDescription, ItemSlot, ItemDescription } from "../item.js";
import { SpellBuff, ExtraAttack, Proc, Spell } from "../spell.js";
import { Buff, BuffProc } from "../buff.js";

export const items: (ItemDescription|WeaponDescription)[] = [
    {
        name: "Ironfoe",
        slot: ItemSlot.MAINHAND,
        type: WeaponType.MACE,
        min: 73,
        max: 136,
        speed: 2.4,
        onhit: new Proc(new ExtraAttack('Ironfoe', 2),{ppm: 1})
    },
    {
        name: "Empyrean Demolisher",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND,
        min: 94,
        max: 175,
        speed: 2.8,
        onhit: new Proc(new SpellBuff(new Buff("Haste (Empyrean Demolisher)", 10, {haste: 1.2})),{ppm: 1})
    },
    {
        name: "Anubisath Warhammer",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 66,
        max: 123,
        speed: 1.8,
        stats: { maceSkill: 4, ap: 32 }
    },
    {
        name: "Hand of Justice",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: {ap: 20},
        onequip: new Proc(new ExtraAttack('Hand of Justice', 1), {chance: 2/100})
    },
    {
        name: "Blackhand's Breadth",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: {crit: 2}
    },
    {
        name: "Lionheart Helm",
        slot: ItemSlot.HEAD,
        stats: {crit: 2, hit: 2, str: 18}
    },
    {
        name: "Barbed Choker",
        slot: ItemSlot.NECK,
        stats: {ap: 44, crit: 1}
    },
    {
        name: "Conqueror's Spaulders",
        slot: ItemSlot.SHOULDER,
        stats: {str: 20, agi: 16, hit: 1}
    },
    {
        name: "Cloak of Draconic Might",
        slot: ItemSlot.BACK,
        stats: {str: 16, agi: 16}
    },
    {
        name: "Conqueror's Breastplate",
        slot: ItemSlot.CHEST,
        stats: {str: 20, agi: 16, hit: 1}
    },
    {
        name: "Hive Defiler Wristguards",
        slot: ItemSlot.WRIST,
        stats: {str: 23, agi: 18}
    },
    {
        name: "Gauntlets of Might",
        slot: ItemSlot.HANDS,
        stats: {str: 22, hit: 1}
    },
    {
        name: "Onslaught Girdle",
        slot: ItemSlot.WAIST,
        stats: {str: 31, crit: 1, hit: 1}
    },
    {
        name: "Titanic Leggings",
        slot: ItemSlot.LEGS,
        stats: {str: 30, crit: 1, hit: 2}
    },
    {
        name: "Boots of the Fallen Hero",
        slot: ItemSlot.FEET,
        stats: {str: 20, agi: 14, hit: 1}
    },
    {
        name: "Striker's Mark",
        slot: ItemSlot.RANGED,
        stats: {ap: 22, hit: 1}
    },
    {
        name: "Don Julio's Band",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {crit: 1, hit: 1, ap: 16}
    },
    {
        name: "Quick Strike Ring",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {ap: 30, crit: 1, str: 5}
    },
    {
        name: "Rank 14 Sword",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 138,
        max: 207,
        speed: 2.9,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "Badge of the Swarmguard",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onuse: (() => {
            const insightOfTheQiraji = new Buff("Insight of the Qiraji", 30, {armorPenetration: 200}, true, 0, 6);
            const badgeBuff = new SpellBuff(
                new BuffProc("Badge of the Swarmguard", 30,
                    new Proc(new SpellBuff(insightOfTheQiraji), {ppm: 15}),
                    insightOfTheQiraji),
                3 * 60 * 1000);
            
            return badgeBuff;
        })()
    }
];
