import { Buff } from "./buff.js";
import { Player } from "./player.js";
import { Stats, StatValues } from "./stats.js";
import { Spell } from "./spell.js";
import { SpellBuff, ExtraAttack } from "./data/spells.js";

export enum WeaponType {
    MACE,
    SWORD,
    AXE,
    DAGGER,
}

type ppm = {ppm: number};
type chance = {chance: number};
type rate = ppm | chance;

export class Proc {
    protected spell: Spell;
    protected rate: rate;

    constructor(spell: Spell, rate: rate) {
        this.spell = spell;
        this.rate = rate;
    }

    run(player: Player, weapon: Weapon, time: number) {
        const chance = (<chance>this.rate).chance || (<ppm>this.rate).ppm * weapon.speed / 60;

        if (Math.random() <= chance) {
            this.spell.cast(player, time)
        }
    }
}

export class WeaponEquiped {
    weapon: Weapon;
    nextSwingTime: number;
    procs: Proc[];
    player: Player;
    
    constructor(weapon: Weapon, player: Player) {
        this.weapon = weapon;
        this.procs = [];
        if (this.weapon.proc) {
            this.addProc(this.weapon.proc)
        }

        this.player = player;

        this.nextSwingTime = 100; // TODO - need to reset this properly if ever want to simulate fights where you run out
    }

    addProc(p: Proc) {
        this.procs.push(p);
    }

    proc(time: number) {
        for (let proc of this.procs) {
            proc.run(this.player, this.weapon, time);
        }
    }
}

export class Weapon {
    min: number;
    max: number;
    speed: number;
    type: WeaponType;
    stats?: StatValues;
    proc?: Proc;

    constructor(type: WeaponType, min: number, max: number, speed: number, stats?: StatValues, proc?: Proc) {
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

// NOTE: to simplify the code, treating these as two separate buffs since they stack
// crusader buffs apparently can be further stacked by swapping weapons but not going to bother with that
export const crusaderBuffMHProc = new Proc(new SpellBuff(new Buff("Crusader MH", 15, new Stats({str: 100}))), {ppm: 1});
export const crusaderBuffOHProc = new Proc(new SpellBuff(new Buff("Crusader OH", 15, new Stats({str: 100}))), {ppm: 1});
