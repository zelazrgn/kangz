import { Weapon } from "./weapon.js";
import { Unit } from "./unit.js";
import { urand, clamp } from "./math.js";

export enum MeleeHitOutcome {
    MELEE_HIT_EVADE,
    MELEE_HIT_MISS,
    MELEE_HIT_DODGE,
    MELEE_HIT_BLOCK,
    MELEE_HIT_PARRY,
    MELEE_HIT_GLANCING,
    MELEE_HIT_CRIT,
    MELEE_HIT_CRUSHING,
    MELEE_HIT_NORMAL,
    MELEE_HIT_BLOCK_CRIT,
}

type HitOutComeStringMap = {[TKey in MeleeHitOutcome]: string};

export const hitOutcomeString: HitOutComeStringMap = {
    [MeleeHitOutcome.MELEE_HIT_EVADE]: 'evade',
    [MeleeHitOutcome.MELEE_HIT_MISS]: 'misses',
    [MeleeHitOutcome.MELEE_HIT_DODGE]: 'is dodged',
    [MeleeHitOutcome.MELEE_HIT_BLOCK]: 'is blocked',
    [MeleeHitOutcome.MELEE_HIT_PARRY]: 'is parried',
    [MeleeHitOutcome.MELEE_HIT_GLANCING]: 'glances',
    [MeleeHitOutcome.MELEE_HIT_CRIT]: 'crits',
    [MeleeHitOutcome.MELEE_HIT_CRUSHING]: 'crushes',
    [MeleeHitOutcome.MELEE_HIT_NORMAL]: 'hits',
    [MeleeHitOutcome.MELEE_HIT_BLOCK_CRIT]: 'is block crit',
};

const skillDiffToReduction = [1, 0.9926, 0.9840, 0.9742, 0.9629, 0.9500, 0.9351, 0.9180, 0.8984, 0.8759, 0.8500, 0.8203, 0.7860, 0.7469, 0.7018];

export class Player extends Unit {
    mh: Weapon;
    oh: Weapon | undefined;

    baseAttackPower: number;

    target: Unit | undefined;

    constructor(armor: number, baseAttackPower: number, mh: Weapon, oh: Weapon) {
        super(armor);

        this.baseAttackPower = baseAttackPower;

        this.mh = mh;
        this.oh = oh;
    }

    calculateWeaponSkillValue(is_mh: boolean) {
        const weapon = is_mh ? this.mh : this.oh;
        const weaponType = weapon.type;
        // TODO - handle weapon types and item buffs
        return 305;
    }

    calculateCritChance(victim: Unit) {
        let crit = 5;
        const items = 10;
        const buffs = 5;
        crit += items;
        crit += buffs;

        crit -= (victim.defenseSkill - 300) * 0.04;

        return crit;
    }

    calculateMissChance(victim: Unit, is_mh: boolean) {
        let res = 5;
        if (this.oh) {
            res += 19;
        }
        
        const skillDiff = this.calculateWeaponSkillValue(is_mh) - victim.defenseSkill;

        if (skillDiff < -10) {
            res -= (skillDiff + 10) * 0.4 - 2;
        } else {
            res -= skillDiff * 0.1;
        }

        return clamp(res, 0, 60);
    }

    calculateGlancingReduction(victim: Unit, is_mh: boolean) {
        const skillDiff = victim.defenseSkill  - this.calculateWeaponSkillValue(is_mh);

        if (skillDiff >= 15) {
            return 0.65;
        } else if (skillDiff < 0) {
            return 1;
        } else {
            return skillDiffToReduction[skillDiff];
        }
    }

    calculateAttackPower() {
        return this.baseAttackPower;
    }

    calculateMinMaxDamage(is_mh: boolean): [number, number] {
        // TODO - Very simple version atm
        const weapon = is_mh ? this.mh : this.oh;

        const ap_bonus = this.calculateAttackPower() / 14 * weapon.speed;

        return [
            Math.trunc(weapon.min + ap_bonus),
            Math.trunc(weapon.max + ap_bonus)
        ];
    }

    calculateRawDamage(is_mh: boolean) {
        return urand(...this.calculateMinMaxDamage(is_mh));
    }

    rollMeleeHitOutcome(victim: Unit, is_mh: boolean): MeleeHitOutcome {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;


        const miss_chance = Math.trunc(this.calculateMissChance(victim, is_mh) * 100);
        const dodge_chance = Math.trunc(victim.dodgeChance * 100);
        const crit_chance = Math.trunc(this.calculateCritChance(victim) * 100);

        const skilBonus = 4 * (this.calculateWeaponSkillValue(is_mh) - 300);

        tmp = miss_chance;

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }

        tmp = dodge_chance - skilBonus;

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_DODGE;
        }

        tmp = (10 + (victim.defenseSkill - 300) * 2) * 100;
        tmp = clamp(tmp, 0, 4000);

        if (roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_GLANCING;
        }

        tmp = crit_chance;

        if (tmp > 0 && roll < (sum += crit_chance)) {
            return MeleeHitOutcome.MELEE_HIT_CRIT;
        }

        return MeleeHitOutcome.MELEE_HIT_NORMAL;
    }

    calculateMeleeDamage(victim: Unit, is_mh: boolean): [number, MeleeHitOutcome] {
        const rawDamage = this.calculateRawDamage(is_mh);

        const armorReduced = victim.calculateArmorReducedDamage(rawDamage);

        const hitOutcome = this.rollMeleeHitOutcome(victim, is_mh);

        let damage = armorReduced;

        let proc = false;

        switch (hitOutcome) {
            case MeleeHitOutcome.MELEE_HIT_MISS:
            case MeleeHitOutcome.MELEE_HIT_DODGE:
            {
                damage = 0;
                break;
            }
            case MeleeHitOutcome.MELEE_HIT_GLANCING:
            {
                const reducePercent = this.calculateGlancingReduction(victim, is_mh);
                damage = Math.trunc(reducePercent * damage);
                break;
            }
            case MeleeHitOutcome.MELEE_HIT_NORMAL:
            {
                proc = true;
                break;
            }
            case MeleeHitOutcome.MELEE_HIT_CRIT:
            {
                // TODO - ignoring deep wounds, need to proc flurry
                proc = true;

                damage *= 2;
                break;
            }
        }

        if (!is_mh) {
            damage *= 0.625;
        }

        return [Math.trunc(damage), hitOutcome];
    }

    updateProcs(is_mh: boolean, hitOutcome: MeleeHitOutcome) {

    }

    updateMeleeAttackingState(time: number): [number, MeleeHitOutcome|undefined, boolean] {
        let damageDone = 0;
        let hitOutcome: MeleeHitOutcome | undefined;

        let is_mh = false;
        if (this.target) {
            if (time >= this.mh.nextSwingTime) {
                is_mh = true;
                [damageDone, hitOutcome] = this.calculateMeleeDamage(this.target, is_mh);
                this.mh.nextSwingTime = time + this.mh.speed * 1000;

                if (this.oh.nextSwingTime < time + 200) {
                    console.log('delaying OH swing', time + 200 - this.oh.nextSwingTime);
                    this.oh.nextSwingTime = time + 200;
                }

            } else if (time >= this.oh.nextSwingTime) {
                [damageDone, hitOutcome] = this.calculateMeleeDamage(this.target, is_mh);
                this.oh.nextSwingTime = time + this.oh.speed * 1000;

                if (this.mh.nextSwingTime < time + 200) {
                    console.log('delaying MH swing', time + 200 - this.mh.nextSwingTime);
                    this.mh.nextSwingTime = time + 200;
                }
            }
        }

        return [damageDone, hitOutcome, is_mh];
    }
}
