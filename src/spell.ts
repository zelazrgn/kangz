import { Player } from "./player.js";
import { Buff } from "./buff.js";
import { WeaponDescription } from "./item.js";

export class Spell {
    name: string;
    is_gcd: boolean;
    cost: number;
    cooldown: number;
    protected spellF: (player: Player, time: number) => void;

    constructor(name: string, is_gcd: boolean, cost: number, cooldown: number, spellF: (player: Player, time: number) => void) {
        this.name = name;
        this.cost = cost;
        this.cooldown = cooldown;
        this.is_gcd = is_gcd;
        this.spellF = spellF;
    }

    cast(player: Player, time: number) {
        return this.spellF(player, time);
    }
}

export class LearnedSpell {
    spell: Spell;
    cooldown = 0;
    caster: Player;

    constructor(spell: Spell, caster: Player) {
        this.spell = spell;
        this.caster = caster;
    }

    onCooldown(time: number): boolean {
        return this.cooldown > time;
    }

    canCast(time: number): boolean {
        if (this.spell.is_gcd && this.caster.nextGCDTime > time) {
            return false;
        }

        if (this.spell.cost > this.caster.power) {
            return false;
        }

        if (this.onCooldown(time)) {
            return false;
        }

        return true;
    }

    cast(time: number): boolean {
        if (!this.canCast(time)) {
            return false;
        }

        if (this.spell.is_gcd) {
            this.caster.nextGCDTime = time + 1500;
        }
        
        this.caster.power -= this.spell.cost;

        this.spell.cast(this.caster, time);

        this.cooldown = time + this.spell.cooldown;

        return true;
    }
}

export class ExtraAttack extends Spell {
    constructor(name: string, count: number) {
        super(name, false, 0, 0, (player: Player, time: number) => {
            if (player.extraAttackCount) {
                return;
            }
            player.extraAttackCount += count; // LH code does not allow multiple auto attacks to stack if they proc together. Blizzlike may allow them to stack 
            if (player.log) player.log(time, `Gained ${count} extra attacks from ${name}`);
        });
    }
}

export class SpellBuff extends Spell {
    constructor(buff: Buff) {
        super(`SpellBuff(${buff.name})`, false, 0, 0, (player: Player, time: number) => {
            player.buffManager.add(buff, time);
        });
    }
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

    run(player: Player, weapon: WeaponDescription, time: number) {
        const chance = (<chance>this.rate).chance || (<ppm>this.rate).ppm * weapon.speed / 60;

        if (Math.random() <= chance) {
            this.spell.cast(player, time)
        }
    }
}
