import { Player, MeleeHitOutcome } from "./player.js";
import { Buff } from "./buff.js";
import { Spell, LearnedSpell } from "./spell.js";
import { clamp } from "./math.js";
const flurry = new Buff("Flurry", 15, { haste: 1.3 });
export class Warrior extends Player {
    constructor() {
        super(...arguments);
        this.flurryCount = 0;
        this.rage = 0;
        this.execute = new LearnedSpell(executeSpell, this);
        this.bloodthirst = new LearnedSpell(bloodthirstSpell, this);
        this.heroicStrike = new LearnedSpell(heroicStrikeSpell, this);
        this.hamstring = new LearnedSpell(hamstringSpell, this);
        this.whirlwind = new LearnedSpell(whirlwindSpell, this);
        this.queuedSpell = undefined;
    }
    get power() {
        return this.rage;
    }
    set power(power) {
        this.rage = clamp(power, 0, 100);
    }
    get ap() {
        return this.level * 3 - 20 + this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }
    calculateRawDamage(is_mh, is_spell) {
        const bonus = (is_mh && is_spell) ? 157 : 0;
        return bonus + super.calculateRawDamage(is_mh, is_spell);
    }
    calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill = false) {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill);
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && is_spell) {
            damageDone *= 1.1;
        }
        return [damageDone, hitOutcome, cleanDamage];
    }
    rewardRage(damage, is_attacker, time) {
        const LEVEL_60_RAGE_CONV = 230.6;
        let addRage = damage / LEVEL_60_RAGE_CONV;
        if (is_attacker) {
            addRage *= 7.5;
        }
        else {
            addRage *= 2.5;
        }
        addRage = Math.trunc(addRage);
        if (this.log)
            this.log(time, `Gained ${Math.min(addRage, 100 - this.rage)} rage`);
        this.power += addRage;
    }
    updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);
        if (spell) {
        }
        else {
            if ([MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                this.rewardRage(cleanDamage * 0.75, true, time);
            }
            else if (damageDone) {
                this.rewardRage(damageDone, true, time);
            }
        }
        if (!(spell || spell === heroicStrikeSpell) && ![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            this.flurryCount = Math.max(0, this.flurryCount - 1);
        }
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.flurryCount = 3;
            this.buffManager.add(flurry, time);
        }
        else if (this.flurryCount === 0) {
            this.buffManager.remove(flurry, time);
        }
    }
    swingWeapon(time, target, is_mh, spell) {
        if (!spell && this.queuedSpell && is_mh && !this.extraAttackCount) {
            this.queuedSpell.cast(time);
            this.queuedSpell = undefined;
        }
        else {
            super.swingWeapon(time, target, is_mh, spell);
        }
        this.chooseAction(time);
    }
    chooseAction(time) {
        if (this.nextGCDTime <= time) {
            if (this.bloodthirst.canCast(time)) {
                this.bloodthirst.cast(time);
            }
            else if (!this.bloodthirst.onCooldown(time)) {
                return;
            }
            else if (this.whirlwind.canCast(time)) {
                this.whirlwind.cast(time);
            }
            else if (!this.whirlwind.onCooldown(time)) {
                return;
            }
            else if (false && this.hamstring.canCast(time)) {
                this.hamstring.cast(time);
            }
        }
        if (this.rage >= 60 && !this.queuedSpell) {
            this.queuedSpell = this.heroicStrike;
            if (this.log)
                this.log(time, 'queueing heroic strike');
        }
    }
}
const heroicStrikeSpell = new Spell("Heroic Strike", false, 12, 0, (player, time) => {
    const warrior = player;
    warrior.swingWeapon(time, warrior.target, true, heroicStrikeSpell);
});
const executeSpell = new Spell("Execute", true, 15, 0, (player) => {
    const warrior = player;
});
const bloodthirstSpell = new Spell("Bloodthirst", true, 30, 6000, (player, time) => {
    const warrior = player;
    const rawDamage = warrior.ap * 0.45;
    warrior.dealMeleeDamage(time, rawDamage, warrior.target, true, bloodthirstSpell, true);
});
const whirlwindSpell = new Spell("Whirlwind", true, 25, 10000, (player, time) => {
    const warrior = player;
    warrior.dealMeleeDamage(time, warrior.calculateRawDamage(true, false), warrior.target, true, whirlwindSpell, false);
});
const hamstringSpell = new Spell("Hamstring", true, 10, 0, (player, time) => {
    const warrior = player;
    warrior.dealMeleeDamage(time, 45, warrior.target, true, hamstringSpell, false);
});
export const battleShout = new Buff("Battle Shout", 60 * 60, { ap: 290 });
//# sourceMappingURL=warrior.js.map