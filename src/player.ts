import { Weapon, WeaponEquiped, WeaponType } from "./weapon.js";
import { Unit } from "./unit.js";
import { urand, clamp } from "./math.js";
import { BuffManager } from "./buff.js";
import { StatValues } from "./stats.js";

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

const skillDiffToReduction = [1, 0.9926, 0.9840, 0.9742, 0.9629, 0.9500, 0.9351, 0.9180, 0.8984, 0.8759, 0.8500, 0.8203, 0.7860, 0.7469, 0.7018];

export class Player extends Unit {
    mh: WeaponEquiped;
    oh: WeaponEquiped | undefined;

    target: Unit | undefined;

    nextGCDTime: number;
    extraAttackCount: number;

    buffManager: BuffManager;

    constructor(mh: Weapon, oh: Weapon, stats: StatValues, logCallback?: (arg0: number, arg1: string) => void) {
        super(60, 0);

        this.buffManager = new BuffManager(stats, logCallback);

        this.mh = new WeaponEquiped(mh, this.buffManager);
        this.oh = new WeaponEquiped(oh, this.buffManager);

        this.nextGCDTime = 0;
        this.extraAttackCount = 0;
    }

    protected calculateWeaponSkillValue(is_mh: boolean) {
        const weapon = is_mh ? this.mh : this.oh!;
        const weaponType = weapon.weapon.type;

        if ([WeaponType.MACE, WeaponType.SWORD].includes(weaponType)) {
            return 305;
        } else {
            return 300;
        }
    }

    protected calculateCritChance(victim: Unit) {
        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;

        crit -= (victim.defenseSkill - 300) * 0.04; // TODO - look at this

        return crit;
    }

    protected calculateMissChance(victim: Unit, is_mh: boolean) {
        let res = 5;
        res -= this.buffManager.stats.hit;

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

    protected calculateGlancingReduction(victim: Unit, is_mh: boolean) {
        const skillDiff = victim.defenseSkill  - this.calculateWeaponSkillValue(is_mh);

        if (skillDiff >= 15) {
            return 0.65;
        } else if (skillDiff < 0) {
            return 1;
        } else {
            return skillDiffToReduction[skillDiff];
        }
    }

    protected calculateAttackPower() {
        return 0;
    }

    protected calculateMinMaxDamage(is_mh: boolean): [number, number] {
        // TODO - Very simple version atm
        const weapon = is_mh ? this.mh : this.oh!;

        const ap_bonus = this.calculateAttackPower() / 14 * weapon.weapon.speed;

        return [
            Math.trunc(weapon.weapon.min + ap_bonus),
            Math.trunc(weapon.weapon.max + ap_bonus)
        ];
    }

    protected calculateRawDamage(is_mh: boolean) {
        return urand(...this.calculateMinMaxDamage(is_mh));
    }

    protected rollMeleeHitOutcome(victim: Unit, is_mh: boolean): MeleeHitOutcome {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;

        // rounding instead of truncating because 19.4 * 100 was truncating to 1939.
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh) * 100);
        const dodge_chance = Math.round(victim.dodgeChance * 100);
        const crit_chance = Math.round(this.calculateCritChance(victim) * 100);

        const skillBonus = 4 * (this.calculateWeaponSkillValue(is_mh) - victim.maxSkillForLevel);

        tmp = miss_chance;

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }

        tmp = dodge_chance - skillBonus; // 5.6 (560) for lvl 63 with 300 weapon skill

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

    protected calculateMeleeDamage(victim: Unit, is_mh: boolean): [number, MeleeHitOutcome] {
        const rawDamage = this.calculateRawDamage(is_mh);

        const armorReduced = victim.calculateArmorReducedDamage(rawDamage, this);

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

    protected updateProcs(time: number, is_mh: boolean, hitOutcome: MeleeHitOutcome, damageDone: number) {
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            // TODO - what is the order of checking for procs like hoj and ironfoe and windfury
            const weapon = is_mh ? this.mh : this.oh!;
            weapon.proc(time);

            if (this.extraAttackCount === 0) {
                console.log("check for extra attack procs");
            }
        }
    }

    protected swingWeapon(time: number, target: Unit, is_mh: boolean) {
        const [thisWeapon, otherWeapon] = is_mh ? [this.mh, this.oh] : [this.oh, this.mh]; 

        const [damageDone, hitOutcome] = this.calculateMeleeDamage(target, is_mh);
        // called before updating swing time because a proc such as flurry could change swing time
        this.updateProcs(time, is_mh, hitOutcome, damageDone);

        console.log('weapon speed', is_mh, thisWeapon!.weapon.speed / this.buffManager.stats.haste);
        thisWeapon!.nextSwingTime = time + thisWeapon!.weapon.speed / this.buffManager.stats.haste * 1000;

        if (otherWeapon && otherWeapon.nextSwingTime < time + 200) {
            console.log(`delaying ${is_mh ? 'OH' : 'MH'} swing`, time + 200 - otherWeapon.nextSwingTime);
            otherWeapon.nextSwingTime = time + 200;
        }

        return [damageDone, hitOutcome];
    }

    updateMeleeAttackingState(time: number): [number, MeleeHitOutcome|undefined, boolean] {
        this.buffManager.removeExpiredBuffs(time);

        while (this.extraAttackCount > 0) {
            this.mh.nextSwingTime = time;
            this.updateMeleeAttackingState(time);
            this.extraAttackCount--;
        }

        let damageDone = 0;
        let hitOutcome: MeleeHitOutcome | undefined;

        let is_mh = false;
        if (this.target) {
            if (time >= this.mh.nextSwingTime) {
                is_mh = true;
                [damageDone, hitOutcome] = this.swingWeapon(time, this.target, is_mh);
            } else if (this.oh && time >= this.oh.nextSwingTime) {
                [damageDone, hitOutcome] = this.swingWeapon(time, this.target, is_mh);
            }
        }

        return [damageDone, hitOutcome, is_mh];
    }
}
