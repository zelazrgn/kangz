import { Player, MeleeHitOutcome, hitOutcomeString } from "./player.js";

export class Spell {
    name: string;
    is_gcd: boolean;
    cost: number;
    cooldown: number;
    spellF: (player: Player, time: number) => void;

    constructor(name: string, is_gcd: boolean, cost: number, cooldown: number, spellF: (player: Player, time: number) => void) {
        this.name = name;
        this.cost = cost;
        this.cooldown = cooldown;
        this.is_gcd = is_gcd;
        this.spellF = spellF;
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

        this.spell.spellF(this.caster, time);

        this.cooldown = time + this.spell.cooldown;

        return true;
    }
}
