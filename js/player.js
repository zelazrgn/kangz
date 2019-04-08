import { WeaponEquiped, WeaponType } from "./weapon.js";
import { Unit } from "./unit.js";
import { urand, clamp } from "./math.js";
import { BuffManager } from "./buff.js";
import { Stats } from "./stats.js";
export var MeleeHitOutcome;
(function (MeleeHitOutcome) {
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_EVADE"] = 0] = "MELEE_HIT_EVADE";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_MISS"] = 1] = "MELEE_HIT_MISS";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_DODGE"] = 2] = "MELEE_HIT_DODGE";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_BLOCK"] = 3] = "MELEE_HIT_BLOCK";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_PARRY"] = 4] = "MELEE_HIT_PARRY";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_GLANCING"] = 5] = "MELEE_HIT_GLANCING";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_CRIT"] = 6] = "MELEE_HIT_CRIT";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_CRUSHING"] = 7] = "MELEE_HIT_CRUSHING";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_NORMAL"] = 8] = "MELEE_HIT_NORMAL";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_BLOCK_CRIT"] = 9] = "MELEE_HIT_BLOCK_CRIT";
})(MeleeHitOutcome || (MeleeHitOutcome = {}));
export const hitOutcomeString = {
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
    constructor(mh, oh, stats, logCallback) {
        super(60, 0);
        this.nextGCDTime = 0;
        this.extraAttackCount = 0;
        this.damageDone = 0;
        const combinedStats = new Stats(stats);
        if (mh.stats) {
            combinedStats.add(mh.stats);
        }
        if (oh && oh.stats) {
            combinedStats.add(oh.stats);
        }
        this.buffManager = new BuffManager(combinedStats, logCallback);
        this.mh = new WeaponEquiped(mh, this);
        if (oh) {
            this.oh = new WeaponEquiped(oh, this);
        }
        this.log = logCallback;
    }
    get power() {
        return 0;
    }
    set power(power) { }
    calculateWeaponSkillValue(is_mh, ignore_weapon_skill = false) {
        if (ignore_weapon_skill) {
            return this.maxSkillForLevel;
        }
        const weapon = is_mh ? this.mh : this.oh;
        const weaponType = weapon.weapon.type;
        switch (weaponType) {
            case WeaponType.MACE:
                {
                    return this.buffManager.stats.maceSkill;
                }
            case WeaponType.SWORD:
                {
                    return this.buffManager.stats.swordSkill;
                }
            case WeaponType.AXE:
                {
                    return this.buffManager.stats.axeSkill;
                }
            case WeaponType.DAGGER:
                {
                    return this.buffManager.stats.daggerSkill;
                }
            default:
                {
                    return this.maxSkillForLevel;
                }
        }
    }
    calculateCritChance(victim) {
        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;
        crit -= (victim.defenseSkill - 300) * 0.04;
        return crit;
    }
    calculateMissChance(victim, is_mh, is_spell, ignore_weapon_skill = false) {
        let res = 5;
        res -= this.buffManager.stats.hit;
        if (this.oh && !is_spell) {
            res += 19;
        }
        const skillDiff = this.calculateWeaponSkillValue(is_mh, ignore_weapon_skill) - victim.defenseSkill;
        if (skillDiff < -10) {
            res -= (skillDiff + 10) * 0.4 - 2;
        }
        else {
            res -= skillDiff * 0.1;
        }
        return clamp(res, 0, 60);
    }
    calculateGlancingReduction(victim, is_mh) {
        const skillDiff = victim.defenseSkill - this.calculateWeaponSkillValue(is_mh);
        if (skillDiff >= 15) {
            return 0.65;
        }
        else if (skillDiff < 0) {
            return 1;
        }
        else {
            return skillDiffToReduction[skillDiff];
        }
    }
    get ap() {
        return 0;
    }
    calculateMinMaxDamage(is_mh) {
        const weapon = is_mh ? this.mh : this.oh;
        const ap_bonus = this.ap / 14 * weapon.weapon.speed;
        return [
            Math.trunc(weapon.weapon.min + ap_bonus),
            Math.trunc(weapon.weapon.max + ap_bonus)
        ];
    }
    calculateRawDamage(is_mh, is_spell) {
        return urand(...this.calculateMinMaxDamage(is_mh));
    }
    rollMeleeHitOutcome(victim, is_mh, is_spell, ignore_weapon_skill = false) {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, is_spell, ignore_weapon_skill) * 100);
        const dodge_chance = Math.round(victim.dodgeChance * 100);
        const crit_chance = Math.round(this.calculateCritChance(victim) * 100);
        const skillBonus = 4 * (this.calculateWeaponSkillValue(is_mh, ignore_weapon_skill) - victim.maxSkillForLevel);
        tmp = miss_chance;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }
        tmp = dodge_chance - skillBonus;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_DODGE;
        }
        if (!is_spell) {
            tmp = (10 + (victim.defenseSkill - 300) * 2) * 100;
            tmp = clamp(tmp, 0, 4000);
            if (roll < (sum += tmp)) {
                return MeleeHitOutcome.MELEE_HIT_GLANCING;
            }
        }
        tmp = crit_chance;
        if (tmp > 0 && roll < (sum += crit_chance)) {
            return MeleeHitOutcome.MELEE_HIT_CRIT;
        }
        return MeleeHitOutcome.MELEE_HIT_NORMAL;
    }
    calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill = false) {
        const armorReduced = victim.calculateArmorReducedDamage(rawDamage, this);
        const hitOutcome = this.rollMeleeHitOutcome(victim, is_mh, is_spell, ignore_weapon_skill);
        let damage = armorReduced;
        let cleanDamage = 0;
        switch (hitOutcome) {
            case MeleeHitOutcome.MELEE_HIT_MISS:
                {
                    damage = 0;
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_DODGE:
                {
                    damage = 0;
                    cleanDamage = rawDamage;
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_GLANCING:
                {
                    const reducePercent = this.calculateGlancingReduction(victim, is_mh);
                    damage = reducePercent * damage;
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_NORMAL:
                {
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_CRIT:
                {
                    damage *= 2;
                    break;
                }
        }
        if (!is_mh) {
            damage *= 0.625;
        }
        return [damage, hitOutcome, cleanDamage];
    }
    updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell) {
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            const weapon = is_mh ? this.mh : this.oh;
            weapon.proc(time);
            if (this.extraAttackCount === 0) {
                console.log("check for extra attack procs");
            }
        }
    }
    dealMeleeDamage(time, rawDamage, target, is_mh, spell, ignore_weapon_skill = false) {
        let [damageDone, hitOutcome, cleanDamage] = this.calculateMeleeDamage(rawDamage, target, is_mh, spell !== undefined, ignore_weapon_skill);
        damageDone = Math.trunc(damageDone);
        cleanDamage = Math.trunc(cleanDamage);
        this.damageDone += damageDone;
        if (this.log) {
            let hitStr = `Your ${spell ? spell.name : (is_mh ? 'main-hand' : 'off-hand')} ${hitOutcomeString[hitOutcome]}`;
            if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                hitStr += ` for ${damageDone}`;
            }
            this.log(time, hitStr);
        }
        this.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);
        this.buffManager.recalculateStats();
    }
    swingWeapon(time, target, is_mh, spell) {
        const rawDamage = this.calculateRawDamage(is_mh, spell !== undefined);
        this.dealMeleeDamage(time, rawDamage, target, is_mh, spell);
        const [thisWeapon, otherWeapon] = is_mh ? [this.mh, this.oh] : [this.oh, this.mh];
        thisWeapon.nextSwingTime = time + thisWeapon.weapon.speed / this.buffManager.stats.haste * 1000;
        if (otherWeapon && otherWeapon.nextSwingTime < time + 200) {
            otherWeapon.nextSwingTime = time + 200;
        }
    }
    update(time) {
        this.buffManager.removeExpiredBuffs(time);
        this.buffManager.recalculateStats();
        if (this.target) {
            while (this.extraAttackCount > 0) {
                this.swingWeapon(time, this.target, true);
                this.extraAttackCount--;
            }
            this.chooseAction(time);
            if (time >= this.mh.nextSwingTime) {
                this.swingWeapon(time, this.target, true);
            }
            else if (this.oh && time >= this.oh.nextSwingTime) {
                this.swingWeapon(time, this.target, false);
            }
        }
    }
    chooseAction(time) { }
}
//# sourceMappingURL=player.js.map