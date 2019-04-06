import { Buff, BuffManager } from "./buff.js";
import { Stats } from "./stats.js";

export enum WeaponType {
    MACE,
    SWORD,
}

export class Proc {
    protected buff: Buff;
    protected ppm: number;

    constructor(buff: Buff, ppm: number) {
        this.buff = buff;
        this.ppm = ppm;
    }

    run(weapon: Weapon) {
        const chance = this.ppm * weapon.speed / 60;

        if (Math.random() <= chance) {
            return this.buff;
        }
    }
}

export class WeaponEquiped {
    weapon: Weapon;
    nextSwingTime: number;
    procs: Proc[];
    buffManager: BuffManager;
    
    constructor(weapon: Weapon, buffManager: BuffManager) {
        this.weapon = weapon;
        this.procs = [];
        if (this.weapon.proc) {
            this.addProc(this.weapon.proc)
        }

        this.buffManager = buffManager;

        this.nextSwingTime = 100; // TODO - need to reset this properly if ever want to simulate fights where you run out
    }

    addProc(p: Proc) {
        this.procs.push(p);
    }

    proc(time: number) {
        for (let proc of this.procs) {
            const maybeBuff = proc.run(this.weapon);
            if (maybeBuff) {
                this.buffManager.add(maybeBuff, time);
            }
        }
    }
}

export class Weapon {
    min: number;
    max: number;
    speed: number;
    type: WeaponType;
    proc?: Proc;

    constructor(type: WeaponType, min: number, max: number, speed: number, proc?: Proc) {
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

// NOTE: to simplify the code, treating these as two separate buffs since they stack
// crusader buffs apparently can be further stacked by swapping weapons but not going to bother with that
export const crusaderBuffMHProc = new Proc(new Buff("Crusader MH", 15, new Stats({str: 100})), 1);
export const crusaderBuffOHProc = new Proc(new Buff("Crusader OH", 15, new Stats({str: 100})), 1);

export const emp_demo = new Weapon(WeaponType.MACE, 94, 175, 2.80, new Proc(new Buff("Empyrean Demolisher", 10, {haste: 1.2}), 1));
export const anubisath = new Weapon(WeaponType.MACE, 66, 123, 1.80);
