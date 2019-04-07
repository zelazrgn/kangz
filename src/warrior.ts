import { Player, MeleeHitOutcome } from "./player.js";
import { Buff } from "./buff.js";
import { Unit } from "./unit.js";

const flurry = new Buff("Flurry", 15, {haste: 1.3});

export class Warrior extends Player {
    flurryCount = 0;
    rage = 0;
    hasQueuedSpell = false;

    calculateAttackPower() {
        return this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }

    protected calculateRawDamage(is_mh: boolean, spell: boolean) {
        const bonus = (is_mh && spell) ? 157 : 0; // heroic strike rank 9
        return bonus + super.calculateRawDamage(is_mh, spell);
    }

    protected calculateMeleeDamage(victim: Unit, is_mh: boolean, spell: boolean): [number, MeleeHitOutcome, number, boolean] {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(victim, is_mh, spell);

        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && is_mh && spell) {
            damageDone *= 1.1; // impale
        }
        
        return [damageDone, hitOutcome, cleanDamage, spell];
    }

    protected swingWeapon(time: number, target: Unit, is_mh: boolean, spell?: boolean) {
        return super.swingWeapon(time, target, is_mh, is_mh && this.hasQueuedSpell);
    }

    protected rewardRage(damage: number, is_attacker: boolean, time: number) {
        // https://blue.mmo-champion.com/topic/18325-the-new-rage-formula-by-kalgan/
        // Pre-Expansion Rage Gained from dealing damage:
        // (Damage Dealt) / (Rage Conversion at Your Level) * 7.5
        // For Taking Damage (both pre and post expansion):
        // Rage Gained = (Damage Taken) / (Rage Conversion at Your Level) * 2.5
        // Rage Conversion at level 60: 230.6
        // TODO - can you gain fractions of a rage?        
        
        const LEVEL_60_RAGE_CONV = 230.6;
        let addRage = damage / LEVEL_60_RAGE_CONV;
        
        if (is_attacker) {
            addRage *= 7.5;
        } else {
            // TODO - check for berserker rage 1.3x modifier
            addRage *= 2.5;
        }

        addRage = Math.trunc(addRage);

        if (this.log) this.log(time, `Gained ${Math.min(addRage, 100 - this.rage)} rage`);
        this.rage = Math.min(100, this.rage + addRage);
    }

    updateProcs(time: number, is_mh: boolean, hitOutcome: MeleeHitOutcome, damageDone: number, cleanDamage: number, spell: boolean) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);

        // calculate rage
        if (is_mh && spell) { // TODO - do you gain rage from heroic strike if it is dodged/parried?
            this.hasQueuedSpell = false;
            this.rage = Math.max(0, this.rage - 12); // heroic strike
        } else {
            if ([MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                this.rewardRage(cleanDamage * 0.75, true, time); // TODO - where is this formula from?
            } else if (damageDone) {
                this.rewardRage(damageDone, true, time);
            }
        }

        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            this.flurryCount = Math.max(0, this.flurryCount - 1);
        }
        
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            // TODO - ignoring deep wounds
            this.flurryCount = 3;
            this.buffManager.add(flurry, time);
        } else if (this.flurryCount === 0) {
            this.buffManager.remove(flurry, time);
        }
    }

    chooseAction(time: number) {
        if (this.rage >= 12 && !this.hasQueuedSpell) {
            this.hasQueuedSpell = true;
            if (this.log) this.log(time, 'queueing heroic strike');
        }
    }
}
