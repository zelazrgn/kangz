import { Buff } from "../buff.js";
import { SpellBuff, Proc } from "../spell.js";
import { Stats } from "../stats.js";
const buffData = [
    {
        name: "Blessing of Kings",
        duration: 15 * 60,
        stats: {
            statMult: 1.1
        }
    },
    {
        name: "Blessing of Might",
        duration: 15 * 60,
        stats: {
            ap: 222
        }
    },
    {
        name: "Rallying Cry of the Dragonslayer",
        duration: 2 * 60 * 60,
        stats: {
            ap: 140,
            crit: 5
        }
    },
    {
        name: "Songflower Seranade",
        duration: 2 * 60 * 60,
        stats: {
            crit: 5,
            str: 15,
            agi: 15
        }
    },
    {
        name: "Spirit of Zandalar",
        duration: 1 * 60 * 60,
        stats: {
            statMult: 1.15
        }
    },
];
export const blessingOfKings = new Buff("Blessing of Kings", 15 * 60, { statMult: 1.1 });
export const blessingOfMight = new Buff("Blessing of Might", 15 * 60, { ap: 222 });
export const dragonslayer = new Buff("Rallying Cry of the Dragonslayer", 2 * 60 * 60, { ap: 140, crit: 5 });
export const songflower = new Buff("Songflower Seranade", 1 * 60 * 60, { crit: 5, str: 15, agi: 15 });
export const zandalar = new Buff("Spirit of Zandalar", 2 * 60 * 60, { statMult: 1.15 });
export const warchiefs = new Buff("Warchief's Blessing", 1 * 60 * 60, { haste: 1.15 });
export const dumplings = new Buff("Smoked Desert Dumplings", 15 * 60, { str: 20 });
export const jujuPower = new Buff("Juju Power", 30 * 60, { str: 30 });
export const jujuMight = new Buff("Juju Might", 30 * 60, { ap: 40 });
export const mongoose = new Buff("Elixir of the Mongoose", 1 * 60 * 60, { agi: 25, crit: 2 });
export const roids = new Buff("R.O.I.D.S.", 1 * 60 * 60, { str: 25 });
export const fengusFerocity = new Buff("Fengus' Ferocity", 2 * 60 * 60, { ap: 200 });
export const motw = new Buff("Gift of the Wild", 1 * 60 * 60, { str: 16, agi: 16 });
export const trueshot = new Buff("Trueshot Aura", 1 * 60 * 60, { ap: 100 });
export const crusaderBuffMHProc = new Proc(new SpellBuff(new Buff("Crusader MH", 15, new Stats({ str: 100 }))), { ppm: 1 });
export const crusaderBuffOHProc = new Proc(new SpellBuff(new Buff("Crusader OH", 15, new Stats({ str: 100 }))), { ppm: 1 });
//# sourceMappingURL=spells.js.map