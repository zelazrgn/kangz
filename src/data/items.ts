import { WeaponType, WeaponDescription, ItemSlot, ItemDescription } from "../item.js";
import { SpellBuff, ExtraAttack, Proc, SpellType, ItemSpellDamage, SpellDamage, SpellFamily } from "../spell.js";
import { Buff, BuffProc } from "../buff.js";

// TODO - how to implement set bonuses? probably easiest to add bonus that requires a string search of other equiped items

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
        name: "The Untamed Blade",
        type: WeaponType.SWORD2H,
        slot: ItemSlot.MAINHAND,
        min: 192,
        max: 289,
        speed: 3.4,
        onhit: new Proc(new SpellBuff(new Buff("Untamed Fury", 8, {str: 300})),{ppm: 2})
    },
    {
        name: "Misplaced Servo Arm",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 128,
        max: 238,
        speed: 2.8,
        onequip: new Proc(new SpellDamage("Electric Discharge", [100, 151], SpellType.MAGIC, SpellFamily.NONE),{ppm: 3})
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
        name: "Drake Fang Talisman",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: {ap: 56, hit: 2}
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
        name: "Onyxia Tooth Pendant",
        slot: ItemSlot.NECK,
        stats: {agi: 12, hit: 1, crit: 1}
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
        name: "Drape of Unyielding Strength",
        slot: ItemSlot.BACK,
        stats: {str: 15, agi: 9, hit: 1}
    },
    {
        name: "Conqueror's Breastplate",
        slot: ItemSlot.CHEST,
        stats: {str: 20, agi: 16, hit: 1}
    },
    {
        name: "Savage Gladiator Chain",
        slot: ItemSlot.CHEST,
        stats: {agi: 14, str: 13, crit: 2}
    },
    {
        name: "Ghoul Skin Tunic",
        slot: ItemSlot.CHEST,
        stats: {str: 40, crit: 2}
    },
    {
        name: "Breastplate of Annihilation",
        slot: ItemSlot.CHEST,
        stats: {str: 37, crit: 1, hit: 1}
    },
    {
        name: "Hive Defiler Wristguards",
        slot: ItemSlot.WRIST,
        stats: {str: 23, agi: 18}
    },
    {
        name: "Qiraji Execution Bracers",
        slot: ItemSlot.WRIST,
        stats: {agi: 16, str: 15, hit: 1}
    },
    {
        name: "Gauntlets of Might",
        slot: ItemSlot.HANDS,
        stats: {str: 22, hit: 1}
    },
    {
        name: "Gauntlets of Annihilation",
        slot: ItemSlot.HANDS,
        stats: {str: 35, crit: 1, hit: 1}
    },
    {
        name: "Edgemaster's Handguards",
        slot: ItemSlot.HANDS,
        stats: { axeSkill: 7, daggerSkill: 7, swordSkill: 7 }
    },
    {
        name: "Aged Core Leather Gloves",
        slot: ItemSlot.HANDS,
        stats: { str: 15, crit: 1, daggerSkill: 5 }
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
        name: "Conqueror's Legguards",
        slot: ItemSlot.LEGS,
        stats: {agi: 21, str: 33, hit: 1}
    },
    {
        name: "Boots of the Fallen Hero",
        slot: ItemSlot.FEET,
        stats: {str: 20, agi: 14, hit: 1}
    },
    {
        name: "Chromatic Boots",
        slot: ItemSlot.FEET,
        stats: {str: 20, agi: 20, hit: 1}
    },
    {
        name: "Striker's Mark",
        slot: ItemSlot.RANGED,
        stats: {ap: 22, hit: 1}
    },
    {
        name: "Quick Strike Ring",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {ap: 30, crit: 1, str: 5}
    },
    {
        name: "Ring of the Qiraji Fury",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {ap: 40, crit: 1}
    },
    {
        name: "Master Dragonslayer's Ring",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {ap: 48, hit: 1}
    },
    {
        name: "Don Julio's Band",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {crit: 1, hit: 1, ap: 16}
    },
    {
        name: "Vis'kag the Bloodletter",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 100,
        max: 187,
        speed: 2.6,
        onhit: new Proc(new ItemSpellDamage("Fatal Wounds", 240, SpellType.PHYSICAL),{ppm: 1.3})
    },
    {
        name: "Chromatically Tempered Sword",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 106,
        max: 198,
        speed: 2.6,
        stats: { agi: 14, str: 14 }
    },
    {
        name: "Maladath, Runed Blade of the Black Flight",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 86,
        max: 162,
        speed: 2.2,
        stats: { swordSkill: 4 }
    },
    {
        name: "Ancient Qiraji Ripper",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 114,
        max: 213,
        speed: 2.8,
        stats: { crit: 1, ap: 20 }
    },
    {
        name: "Iblis, Blade of the Fallen Seraph",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 70,
        max: 131,
        speed: 1.6,
        stats: { crit: 1, hit: 1, ap: 26 }
    },
    {
        name: "Gressil, Dawn of Ruin",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 138,
        max: 257,
        speed: 2.7,
        stats: { ap: 40 }
    },
    {
        name: "The Hungering Cold",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 76,
        max: 143,
        speed: 1.5,
        stats: { swordSkill: 6 }
    },
    {
        name: "R14 Mace",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 138,
        max: 207,
        speed: 2.9,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "R14 Longsword",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 138,
        max: 207,
        speed: 2.9,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "R14 Swiftblade",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 85,
        max: 129,
        speed: 1.8,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "Hatchet of Sundered Bone",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 119,
        max: 221,
        speed: 2.6,
        stats: { ap: 36, crit: 1 }
    },
    {
        name: "R14 Axe",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 138,
        max: 207,
        speed: 2.9,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "Blessed Qiraji War Axe",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 110,
        max: 205,
        speed: 2.60,
        stats: { crit: 1, ap: 14 }
    },
    {
        name: "Crul'shorukh, Edge of Chaos",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 101,
        max: 188,
        speed: 2.30,
        stats: { ap: 36 }
    },
    {
        name: "Deathbringer (W/O PROC)", // TODO
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 114,
        max: 213,
        speed: 2.90
    },
    {
        name: "Doom's Edge",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 83,
        max: 154,
        speed: 2.30,
        stats: { agi: 16, str: 9 }
    },
    {
        name: "Mirah's Song",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 57,
        max: 87,
        speed: 1.8,
        stats: { agi: 9, str: 9 }
    },
    {
        name: "Death's Sting",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 95,
        max: 144,
        speed: 1.8,
        stats: { ap: 38, daggerSkill: 3 }
    },
    {
        name: "Blessed Qiraji Pugio",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 72,
        max: 134,
        speed: 1.7,
        stats: { crit: 1, hit: 1, ap: 18 }
    },
    {
        name: "Felstriker",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 54,
        max: 101,
        speed: 1.7,
        onhit: new Proc(new SpellBuff(new Buff("Felstriker", 3, {crit: 100, hit: 100})),{ppm: 1.4})
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
                false, 0, 3 * 60);
            
            return badgeBuff;
        })()
    },
    {
        name: "Diamond Flask",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onuse: new SpellBuff(new Buff("Diamond Flask", 60, {str: 75}), true, 0, 6 * 60),
    }
];
