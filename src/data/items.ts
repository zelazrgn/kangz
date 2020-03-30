import { WeaponType, WeaponDescription, ItemSlot, ItemDescription } from "../item.js";
import { SpellBuff, ExtraAttack, Proc, EffectType, ItemSpellDamage, SpellDamage } from "../spell.js";
import { Buff, BuffProc } from "../buff.js";
import { Stats } from "../stats.js";

// export interface SetBonusDescription {
//     stats?: Stats,
//     onequip?: Proc,
// }

// export interface SetDescription {
//     name: string,
//     stats?: StatValues,
//     onuse?: Spell,
//     onequip?: Proc,
// }

// export const setBonuses: (ItemDescription|WeaponDescription)[] = [
// ];

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
        name: "Ironfoe 2/3",
        slot: ItemSlot.MAINHAND,
        type: WeaponType.MACE,
        min: 73,
        max: 136,
        speed: 2.4,
        onhit: new Proc(new ExtraAttack('Ironfoe', 2),{ppm: 2/3})
    },
    {
        name: "Ironfoe No proc",
        slot: ItemSlot.MAINHAND,
        type: WeaponType.MACE,
        min: 73,
        max: 136,
        speed: 2.4
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
        name: "Sand Polished Hammer",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 97,
        max: 181,
        speed: 2.6,
        stats: { ap: 20, crit: 1 }
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
        onequip: new Proc(new SpellDamage("Electric Discharge", [100, 151], EffectType.MAGIC), {ppm: 3})
    },
    {
        name: "The Castigator",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 119,
        max: 221,
        speed: 2.6,
        stats: { crit: 1, hit: 1, ap: 16 }
    },
    {
        name: "Hand of Justice",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: {ap: 20},
        onequip: new Proc(new ExtraAttack('Hand of Justice', 1), {chance: 2/100})
    },
    {
        name: "Darkmoon Card: Maelstrom",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onequip: new Proc(new SpellDamage("Electric Discharge", [200, 301], EffectType.MAGIC), {ppm: 1})
    },
    {
        name: "Darkmoon Card: Maelstrom 2ppm",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onequip: new Proc(new SpellDamage("Electric Discharge", [200, 301], EffectType.MAGIC), {ppm: 2})
    },
    {
        name: "Darkmoon Card: Maelstrom 2%",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onequip: new Proc(new SpellDamage("Electric Discharge", [200, 301], EffectType.MAGIC), {chance: 2/100})
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
        name: "Helm of Endless Rage",
        slot: ItemSlot.HEAD,
        stats: {str: 26, agi: 26}
    },
    {
        name: "Rank 10 helm",
        slot: ItemSlot.HEAD,
        stats: {str: 21, crit: 1, hit: 1}
    },
    {
        name: "Rank 10 helm (+40 ap)",
        slot: ItemSlot.HEAD,
        stats: {str: 21, crit: 1, hit: 1, ap: 40}
    },
    {
        name: "Barbed Choker",
        slot: ItemSlot.NECK,
        stats: {ap: 44, crit: 1}
    },
    {
        name: "Stormrage's Talisman of Seething",
        slot: ItemSlot.NECK,
        stats: {crit: 2, ap: 26}
    },
    {
        name: "Onyxia Tooth Pendant",
        slot: ItemSlot.NECK,
        stats: {agi: 12, hit: 1, crit: 1}
    },
    {
        name: "Amulet of the Darkmoon",
        slot: ItemSlot.NECK,
        stats: {agi: 19, str: 10}
    },
    {
        name: "Conqueror's Spaulders",
        slot: ItemSlot.SHOULDER,
        stats: {str: 20, agi: 16, hit: 1}
    },
    {
        name: "Rank 10 Shoulders",
        slot: ItemSlot.SHOULDER,
        stats: {str: 17, crit: 1}
    },
    {
        name: "Rank 10 Shoulders (+40 ap)",
        slot: ItemSlot.SHOULDER,
        stats: {str: 17, crit: 1, ap: 40}
    },
    {
        name: "Drake Talon Pauldrons",
        slot: ItemSlot.SHOULDER,
        stats: {str: 20, agi: 20}
    },
    {
        name: "Truestrike Shoulders",
        slot: ItemSlot.SHOULDER,
        stats: {ap: 24, hit: 2}
    },
    {
        name: "Lieutenant Commander's Plate Shoulders",
        slot: ItemSlot.SHOULDER,
        stats: {str: 17, ap: 40, crit: 1}
    },
    {
        name: "Cloak of Draconic Might",
        slot: ItemSlot.BACK,
        stats: {str: 16, agi: 16}
    },
    {
        name: "Cape of the Black Baron",
        slot: ItemSlot.BACK,
        stats: {ap: 20, agi: 15}
    },
    {
        name: "Drape of Unyielding Strength",
        slot: ItemSlot.BACK,
        stats: {str: 15, agi: 9, hit: 1}
    },
    {
        name: "Puissant Cape",
        slot: ItemSlot.BACK,
        stats: {ap: 40, hit: 1}
    },
    {
        name: "Shroud of Dominion",
        slot: ItemSlot.BACK,
        stats: {crit: 1, ap: 50}
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
        name: "Rank 10 chest",
        slot: ItemSlot.CHEST,
        stats: {str: 21, crit: 1}
    },
    {
        name: "Rank 10 chest (+40)",
        slot: ItemSlot.CHEST,
        stats: {str: 21, crit: 1, ap: 40}
    },
    {
        name: "Cadaverous Armor",
        slot: ItemSlot.CHEST,
        stats: {agi: 8, str: 8, ap: 60}
    },
    {
        name: "Ghoul Skin Tunic",
        slot: ItemSlot.CHEST,
        stats: {str: 40, crit: 2}
    },
    {
        name: "Malfurion's Blessed Bulwark",
        slot: ItemSlot.CHEST,
        stats: {str: 40}
    },
    {
        name: "Breastplate of Annihilation",
        slot: ItemSlot.CHEST,
        stats: {str: 37, crit: 1, hit: 1}
    },
    {
        name: "Plated Abomination Ribcage",
        slot: ItemSlot.CHEST,
        stats: {str: 45, crit: 1, hit: 1}
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
        name: "Sacrificial Gauntlets",
        slot: ItemSlot.HANDS,
        stats: {str: 19, crit: 1, hit: 1}
    },
    {
        name: "Flameguard Gauntlets",
        slot: ItemSlot.HANDS,
        stats: {crit: 1, ap: 54}
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
        name: "Devilsaur Gauntlets",
        slot: ItemSlot.HANDS,
        stats: { ap: 28, crit: 1, hit: 2 }
    },
    {
        name: "Eldritch Reinforced Legplates",
        slot: ItemSlot.LEGS,
        stats: { str: 15, agi: 9, crit: 1 }
    },
    {
        name: "Cloudkeeper Legplates",
        slot: ItemSlot.LEGS,
        stats: { str: 20, agi: 20 }
    },
    {
        name: "Devilsaur Leggings",
        slot: ItemSlot.LEGS,
        stats: { ap: 46, crit: 1 }
    },
    {
        name: "Scaled Sand Reaver Leggings",
        slot: ItemSlot.LEGS,
        stats: { ap: 62, crit: 2 }
    },
    {
        name: "Bloodmail Boots",
        slot: ItemSlot.FEET,
        stats: { agi: 9, str: 9, hit: 1 }
    },
    {
        name: "Battlechaser's Greaves",
        slot: ItemSlot.FEET,
        stats: { str: 14, agi: 13 }
    },
    {
        name: "Omokk's Girth Restrainer",
        slot: ItemSlot.WAIST,
        stats: {crit: 1, str: 15}
    },
    {
        name: "Brigam Girdle",
        slot: ItemSlot.WAIST,
        stats: {hit: 1, str: 15}
    },
    {
        name: "Onslaught Girdle",
        slot: ItemSlot.WAIST,
        stats: {str: 31, crit: 1, hit: 1}
    },
    {
        name: "Girdle of the Mentor",
        slot: ItemSlot.WAIST,
        stats: {str: 21, agi: 20, crit: 1, hit: 1}
    },
    {
        name: "Belt of Preserved Heads",
        slot: ItemSlot.WAIST,
        stats: {str: 14, agi: 15, hit: 1}
    },
    {
        name: "Titanic Leggings",
        slot: ItemSlot.LEGS,
        stats: {str: 30, crit: 1, hit: 2}
    },
    {
        name: "Legplates of Carnage",
        slot: ItemSlot.LEGS,
        stats: {str: 42, crit: 2}
    },
    {
        name: "Conqueror's Legguards",
        slot: ItemSlot.LEGS,
        stats: {agi: 21, str: 33, hit: 1}
    },
    {
        name: "Legguards of the Fallen Crusader",
        slot: ItemSlot.LEGS,
        stats: {str: 28, agi: 22}
    },
    {
        name: "Bloodsoaked Legplates",
        slot: ItemSlot.LEGS,
        stats: {str: 36}
    },
    {
        name: "Rank 10 Leggings",
        slot: ItemSlot.LEGS,
        stats: {str: 12, crit: 2}
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
        name: "Rank 10 Boots",
        slot: ItemSlot.FEET,
        stats: {str: 10, agi: 9}
    },
    {
        name: "Boots of the Shadow Flame",
        slot: ItemSlot.FEET,
        stats: {ap: 44, hit: 2}
    },
    {
        name: "Striker's Mark",
        slot: ItemSlot.RANGED,
        stats: {ap: 22, hit: 1}
    },
    {
        name: "Crossbow of Imminent Doom",
        slot: ItemSlot.RANGED,
        stats: {agi: 7, str: 5, hit: 1}
    },
    {
        name: "Nerubian Slavemaker",
        slot: ItemSlot.RANGED,
        stats: {ap: 24, crit: 1}
    },
    {
        name: "Bloodseeker",
        slot: ItemSlot.RANGED,
        stats: {str: 8, agi: 7}
    },
    {
        name: "Gurubashi Dwarf Destroyer",
        slot: ItemSlot.RANGED,
        stats: {ap: 30}
    },
    {
        name: "Tarnished Elven Ring",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {agi: 15, hit: 1}
    },
    {
        name: "Magni's Will",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {str: 6, crit: 1}
    },
    {
        name: "Quick Strike Ring",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {ap: 30, crit: 1, str: 5}
    },
    {
        name: "Circle of Applied Force",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {str: 12, agi: 22}
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
        name: "Band of Unnatural Forces",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: {crit: 1, hit: 1, ap: 52}
    },
    {
        name: "Black Dragonscale Shoulders (set bonus)",
        slot: ItemSlot.SHOULDER,
        stats: { ap: 45, crit: 2, hit: 1 }
    },
    {
        name: "Black Dragonscale Leggings",
        slot: ItemSlot.LEGS,
        stats: { ap: 54 }
    },
    {
        name: "Black Dragonscale Boots",
        slot: ItemSlot.FEET,
        stats: { ap: 28 }
    },
    {
        name: "Gargoyle Slashers",
        slot: ItemSlot.HANDS,
        stats: { agi: 5, str: 10, crit: 1 }
    },
    {
        name: "Painweaver Band",
        slot: ItemSlot.RING1|ItemSlot.RING2,
        stats: { crit: 1, ap: 16 }
    },
    {
        name: "Vambraces of the Sadist",
        slot: ItemSlot.WRIST,
        stats: { str: 6, crit: 1 }
    },
    {
        name: "Wristguards of Stability",
        slot: ItemSlot.WRIST,
        stats: { str: 24 }
    },
    {
        name: "Berserker Bracers",
        slot: ItemSlot.WRIST,
        stats: { str: 19, agi: 8 }
    },
    {
        name: "Zandalar Vindicator's Armguards",
        slot: ItemSlot.WRIST,
        stats: { str: 13, agi: 13 }
    },
    {
        name: "Simple Sword (2.6)",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 140,
        max: 160,
        speed: 2.6,
    },
    {
        name: "Simple Sword (1.8)",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 50,
        max: 60,
        speed: 1.8,
    },
    {
        name: "Vis'kag the Bloodletter",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 100,
        max: 187,
        speed: 2.6,
        onhit: new Proc(new ItemSpellDamage("Fatal Wounds", 240, EffectType.PHYSICAL), {ppm: 0.6})
    },
    {
        name: "Spineshatter",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND,
        min: 99,
        max: 184,
        speed: 2.6,
        stats: {str: 9}
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
        name: "Maladath (no skill)",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 86,
        max: 162,
        speed: 2.2
    },
    {
        name: "Ravencrest's Legacy",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 84,
        max: 157,
        speed: 2.1,
        stats: { agi: 9, str: 13 }
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
        name: "Warblade of the Hakkari",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 59,
        max: 110,
        speed: 1.7,
        stats: { swordSkill: 6, ap: 28, crit: 1 }
    },
    {
        name: "Warblade of the Hakkari",
        type: WeaponType.SWORD,
        slot: ItemSlot.OFFHAND,
        min: 57,
        max: 106,
        speed: 1.7,
        stats: { ap: 40 }
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
        name: "Mirah's Song Slow",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 67,
        max: 125,
        speed: 2.4,
        stats: { agi: 9, str: 9 }
    },
    {
        name: "Mirah's Song with skill",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 57,
        max: 87,
        speed: 1.8,
        stats: { agi: 9, str: 9, swordSkill: 4 }
    },
    {
        name: "Mass of McGowan",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND,
        min: 80,
        max: 149,
        speed: 2.8,
        stats: { str: 10 }
    },
    {
        name: "Stormstrike Hammer",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 80,
        max: 150,
        speed: 2.7,
        stats: { str: 15 }
    },
    {
        name: "Dal'Rend's Sacred Charge",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 81,
        max: 151,
        speed: 2.8,
        stats: { str: 4, crit: 1 }
    },
    {
        name: "Dal'Rend's Tribal Gaurdian",
        type: WeaponType.SWORD,
        slot: ItemSlot.OFFHAND,
        min: 52,
        max: 97,
        speed: 1.8,
        stats: { ap: 50 }
    },
    {
        name: "Brutality Blade",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 90,
        max: 168,
        speed: 2.5,
        stats: { str: 9, agi: 9, crit: 1 }
    },
    {
        name: "Sword of Zeal",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 81,
        max: 151,
        speed: 2.8,
        onhit: new Proc(new SpellBuff(new Buff("Zeal", 15, {plusDamage: 10})),{ppm: 1.8})
    },
    {
        name: "Sword of Zeal No Proc",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 81,
        max: 151,
        speed: 2.8
    },
    {
        name: "Sword of Zeal Insane",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 81,
        max: 151,
        speed: 2.8,
        onhit: new Proc(new SpellBuff(new Buff("Zeal", 15, {plusDamage: 1000})),{ppm: 1.8})
    },
    {
        name: "Kingsfall",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 105,
        max: 158,
        speed: 1.8,
        stats: { agi: 16, crit: 1, hit: 1 }
    },
    {
        name: "Harbinger of Doom",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND|ItemSlot.OFFHAND,
        min: 83,
        max: 126,
        speed: 1.6,
        stats: { agi: 8, crit: 1, hit: 1 }
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
        name: "Kiss of the Spider",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: {crit: 1, hit: 1},
        onuse: new SpellBuff(new Buff("Kiss of the Spider", 15, {haste: 1.2}), false, 0, 2 * 60),
    },
    {
        name: "Slayer's Crest",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: {ap: 64},
        onuse: new SpellBuff(new Buff("Slayer's Crest", 20, {ap: 260}), false, 0, 2 * 60),
    },
    {
        name: "Diamond Flask",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onuse: new SpellBuff(new Buff("Diamond Flask", 60, {str: 75}), true, 0, 6 * 60),
    },
];
