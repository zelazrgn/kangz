import { Buff } from "./buff.js";
import { Stats } from "./stats.js";
export var WeaponType;
(function (WeaponType) {
    WeaponType[WeaponType["MACE"] = 0] = "MACE";
    WeaponType[WeaponType["SWORD"] = 1] = "SWORD";
})(WeaponType || (WeaponType = {}));
export class Proc {
    constructor(buff, ppm) {
        this.buff = buff;
        this.ppm = ppm;
    }
    run(weapon) {
        const chance = this.ppm * weapon.speed / 60;
        if (Math.random() <= chance) {
            return this.buff;
        }
    }
}
export class WeaponEquiped {
    constructor(weapon, buffManager) {
        this.weapon = weapon;
        this.procs = [];
        if (this.weapon.proc) {
            this.addProc(this.weapon.proc);
        }
        this.buffManager = buffManager;
        this.nextSwingTime = 100;
    }
    addProc(p) {
        this.procs.push(p);
    }
    proc(time) {
        for (let proc of this.procs) {
            const maybeBuff = proc.run(this.weapon);
            if (maybeBuff) {
                this.buffManager.add(maybeBuff, time);
            }
        }
    }
}
export class Weapon {
    constructor(type, min, max, speed, proc) {
        this.type = type;
        this.min = min;
        this.max = max;
        this.speed = speed;
        this.proc = proc;
    }
    get dps() {
        return (this.min + this.max) / 2 / this.speed;
    }
}
export const crusaderBuffMHProc = new Proc(new Buff("Crusader MH", 15, new Stats({ str: 100 })), 1);
export const crusaderBuffOHProc = new Proc(new Buff("Crusader OH", 15, new Stats({ str: 100 })), 1);
export const emp_demo = new Weapon(WeaponType.MACE, 94, 175, 2.80, new Proc(new Buff("Empyrean Demolisher", 10, { haste: 1.2 }), 1));
export const anubisath = new Weapon(WeaponType.MACE, 66, 123, 1.80);
//# sourceMappingURL=weapon.js.map