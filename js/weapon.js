import { Buff } from "./buff.js";
import { Stats } from "./stats.js";
import { SpellBuff } from "./data/spells.js";
export var WeaponType;
(function (WeaponType) {
    WeaponType[WeaponType["MACE"] = 0] = "MACE";
    WeaponType[WeaponType["SWORD"] = 1] = "SWORD";
    WeaponType[WeaponType["AXE"] = 2] = "AXE";
    WeaponType[WeaponType["DAGGER"] = 3] = "DAGGER";
})(WeaponType || (WeaponType = {}));
export class Proc {
    constructor(spell, rate) {
        this.spell = spell;
        this.rate = rate;
    }
    run(player, weapon, time) {
        const chance = this.rate.chance || this.rate.ppm * weapon.speed / 60;
        if (Math.random() <= chance) {
            this.spell.cast(player, time);
        }
    }
}
export class WeaponEquiped {
    constructor(weapon, player) {
        this.weapon = weapon;
        this.procs = [];
        if (this.weapon.proc) {
            this.addProc(this.weapon.proc);
        }
        this.player = player;
        this.nextSwingTime = 100;
    }
    addProc(p) {
        this.procs.push(p);
    }
    proc(time) {
        for (let proc of this.procs) {
            proc.run(this.player, this.weapon, time);
        }
    }
}
export class Weapon {
    constructor(type, min, max, speed, stats, proc) {
        this.type = type;
        this.min = min;
        this.max = max;
        this.speed = speed;
        this.stats = stats;
        this.proc = proc;
    }
    get dps() {
        return (this.min + this.max) / 2 / this.speed;
    }
}
export const crusaderBuffMHProc = new Proc(new SpellBuff(new Buff("Crusader MH", 15, new Stats({ str: 100 }))), { ppm: 1 });
export const crusaderBuffOHProc = new Proc(new SpellBuff(new Buff("Crusader OH", 15, new Stats({ str: 100 }))), { ppm: 1 });
//# sourceMappingURL=weapon.js.map