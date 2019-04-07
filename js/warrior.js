import { Player, MeleeHitOutcome } from "./player.js";
import { Buff } from "./buff.js";
const flurry = new Buff("Flurry", 15, { haste: 1.3 });
export class Warrior extends Player {
    constructor() {
        super(...arguments);
        this.flurryCount = 0;
        this.rage = 0;
        this.hasQueuedSpell = false;
    }
    calculateAttackPower() {
        return this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }
    calculateRawDamage(is_mh, spell) {
        const bonus = (is_mh && spell) ? 157 : 0;
        return bonus + super.calculateRawDamage(is_mh, spell);
    }
    calculateMeleeDamage(victim, is_mh, spell) {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(victim, is_mh, spell);
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && is_mh && spell) {
            damageDone *= 1.1;
        }
        return [damageDone, hitOutcome, cleanDamage, spell];
    }
    swingWeapon(time, target, is_mh, spell) {
        return super.swingWeapon(time, target, is_mh, is_mh && this.hasQueuedSpell);
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
        this.rage = Math.min(100, this.rage + addRage);
    }
    updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);
        if (is_mh && spell) {
            this.hasQueuedSpell = false;
            this.rage = Math.max(0, this.rage - 12);
        }
        else {
            if ([MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                this.rewardRage(cleanDamage * 0.75, true, time);
            }
            else if (damageDone) {
                this.rewardRage(damageDone, true, time);
            }
        }
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
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
    chooseAction(time) {
        if (this.rage >= 12 && !this.hasQueuedSpell) {
            this.hasQueuedSpell = true;
            if (this.log)
                this.log(time, 'queueing heroic strike');
        }
    }
}
//# sourceMappingURL=warrior.js.map