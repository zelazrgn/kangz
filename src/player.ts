import { WeaponEquiped, WeaponType, ItemDescription, ItemEquiped, ItemSlot, isEquipedWeapon, isWeapon } from "./item.js";
import { Unit } from "./unit.js";
import { urand, clamp, frand } from "./math.js";
import { BuffManager } from "./buff.js";
import { StatValues, Stats } from "./stats.js";
import { Proc, LearnedSwingSpell, EffectType, SpellDamageEffect, Effect } from "./spell.js";
import { LH_CORE_BUG } from "./sim_settings.js";
import { EnchantDescription } from "./data/enchants.js";

export enum Race {
    HUMAN,
    ORC,
}

export enum Faction {
    ALLIANCE,
    HORDE,
}

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

export type LogFunction = (time: number, text: string) => void;

export type DamageLog = [number, number][];

export class Player extends Unit {
    items: Map<ItemSlot, ItemEquiped> = new Map();
    procs: Proc[] = [];

    target: Unit | undefined;

    nextGCDTime = 0;
    extraAttackCount = 0;
    doingExtraAttacks = false;

    buffManager: BuffManager;

    damageLog: DamageLog = [];

    queuedSpell: LearnedSwingSpell|undefined = undefined;

    log?: LogFunction;

    latency = 50; // ms

    powerLost = 0;

    constructor(stats: StatValues, log?: LogFunction) {
        super(60, 0); // lvl, armor

        this.buffManager = new BuffManager(this, new Stats(stats));
        this.log = log;
    }

    get mh(): WeaponEquiped|undefined {
        const equiped = this.items.get(ItemSlot.MAINHAND);

        if (equiped && isEquipedWeapon(equiped)) {
            return equiped;
        }
    }

    get oh(): WeaponEquiped|undefined {
        const equiped = this.items.get(ItemSlot.OFFHAND);

        if (equiped && isEquipedWeapon(equiped)) {
            return equiped;
        }
    }

    equip(slot: ItemSlot, item: ItemDescription, enchant?: EnchantDescription, temporaryEnchant?: EnchantDescription) {
        if (this.items.has(slot)) {
            console.error(`already have item in slot ${ItemSlot[slot]}`)
            return;
        }

        if (!(item.slot & slot)) {
            console.error(`cannot equip ${item.name} in slot ${ItemSlot[slot]}`)
            return;
        }

        if (item.stats) {
            this.buffManager.baseStats.add(item.stats);
        }

        if (enchant && enchant.stats) {
            this.buffManager.baseStats.add(enchant.stats);
        }

        // TODO - handle equipping 2H (and how that disables OH)
        // TODO - assuming only weapon enchants can have procs
        if (isWeapon(item)) {
            this.items.set(slot, new WeaponEquiped(item, this, enchant, temporaryEnchant));
        } else {
            this.items.set(slot, new ItemEquiped(item, this));
        }
    }

    get power(): number {
        return 0;
    }

    set power(power: number) {}

    addProc(p: Proc) {
        this.procs.push(p);
    }

    removeProc(p: Proc) {
        // TODO - either procs should be a set or we need ProcApplication
        this.procs = this.procs.filter((proc: Proc) => {
            return proc !== p;
        });
    }

    protected calculateWeaponSkillValue(is_mh: boolean, effect?: Effect) {
        if (effect && effect.type !== EffectType.PHYSICAL_WEAPON) {
            return this.maxSkillForLevel;
        }

        const weapon = is_mh ? this.mh! : this.oh!;
        const weaponType = weapon.weapon.type;

        // TODO, make this a map
        switch (weaponType) {
            case WeaponType.MACE:
            {
                return this.maxSkillForLevel + this.buffManager.stats.maceSkill;
            }
            case WeaponType.SWORD:
            {
                return this.maxSkillForLevel + this.buffManager.stats.swordSkill;
            }
            case WeaponType.AXE:
            {
                return this.maxSkillForLevel + this.buffManager.stats.axeSkill;
            }
            case WeaponType.DAGGER:
            {
                return this.maxSkillForLevel + this.buffManager.stats.daggerSkill;
            }
            case WeaponType.MACE2H:
            {
                return this.maxSkillForLevel + this.buffManager.stats.mace2HSkill;
            }
            case WeaponType.SWORD2H:
            {
                return this.maxSkillForLevel + this.buffManager.stats.sword2HSkill;
            }
            case WeaponType.AXE2H:
            {
                return this.maxSkillForLevel + this.buffManager.stats.axe2HSkill;
            }
            default:
            {
                return this.maxSkillForLevel;
            }
        }
    }

    calculateCritChance(victim: Unit, is_mh: boolean, effect?: Effect) {
        if (LH_CORE_BUG && effect && effect.type == EffectType.PHYSICAL) {
            // on LH core, non weapon spells like bloodthirst are benefitting from weapon skill
            // this only affects crit, not hit/dodge/parry
            // set the spell to undefined so it is treated like a normal melee attack (rather than using a dummy spell)
            // when calculating weapon skill
            effect = undefined;
        }

        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;

        if (!effect || effect.type == EffectType.PHYSICAL_WEAPON) {
            const weapon = is_mh ? this.mh! : this.oh!;

            if (weapon.temporaryEnchant && weapon.temporaryEnchant.stats && weapon.temporaryEnchant.stats.crit) {
                crit += weapon.temporaryEnchant.stats.crit;
            }
        }

        const skillBonus = 0.04 * (this.calculateWeaponSkillValue(is_mh, effect) - victim.maxSkillForLevel);
        crit += skillBonus;

        return crit;
    }

    protected calculateMissChance(victim: Unit, is_mh: boolean, effect?: Effect) {
        let res = 5;
        res -= this.buffManager.stats.hit;

        if (this.oh && !effect) {
            res += 19;
        }
        
        const skillDiff = this.calculateWeaponSkillValue(is_mh, effect) - victim.defenseSkill;

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

    get ap() {
        return 0;
    }

    protected calculateSwingMinMaxDamage(is_mh: boolean): [number, number] {
        const weapon = is_mh ? this.mh! : this.oh!;

        const ap_bonus = this.ap / 14 * weapon.weapon.speed;

        const ohPenalty = is_mh ? 1 : 0.625; // TODO - check talents, implemented as an aura SPELL_AURA_MOD_OFFHAND_DAMAGE_PCT

        return [
            (weapon.min + ap_bonus) * ohPenalty,
            (weapon.max + ap_bonus) * ohPenalty
        ];
    }

    calculateSwingRawDamage(is_mh: boolean) {
        return frand(...this.calculateSwingMinMaxDamage(is_mh));
    }

    critCap() {
        const skillBonus = 4 * (this.calculateWeaponSkillValue(true) - this.target!.maxSkillForLevel);
        const miss_chance = Math.round(this.calculateMissChance(this.target!, true) * 100);
        const dodge_chance = Math.round(this.target!.dodgeChance * 100) - skillBonus;
        const glance_chance = clamp((10 + (this.target!.defenseSkill - 300) * 2) * 100, 0, 4000);

        return (10000 - (miss_chance + dodge_chance + glance_chance)) / 100;
    }

    rollMeleeHitOutcome(victim: Unit, is_mh: boolean, effect?: Effect): MeleeHitOutcome {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;

        // rounding instead of truncating because 19.4 * 100 was truncating to 1939.
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, effect) * 100);
        const dodge_chance = Math.round(victim.dodgeChance * 100);
        const crit_chance = Math.round(this.calculateCritChance(victim, is_mh, effect) * 100);

        // weapon skill - target defense (usually negative)
        const skillBonus = 4 * (this.calculateWeaponSkillValue(is_mh, effect) - victim.maxSkillForLevel);

        tmp = miss_chance;

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }

        tmp = dodge_chance - skillBonus; // 5.6 (560) for lvl 63 with 300 weapon skill

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_DODGE;
        }

        if (!effect) { // spells can't glance
            tmp = (10 + (victim.defenseSkill - 300) * 2) * 100;
            tmp = clamp(tmp, 0, 4000);
    
            if (roll < (sum += tmp)) {
                return MeleeHitOutcome.MELEE_HIT_GLANCING;
            }
        }

        tmp = crit_chance;

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_CRIT;
        }

        return MeleeHitOutcome.MELEE_HIT_NORMAL;
    }

    calculateBonusDamage(rawDamage: number, victim: Unit, effect?: Effect) {
        let damageWithBonus = rawDamage;

        damageWithBonus *= this.buffManager.stats.damageMult;

        return damageWithBonus;
    }

    calculateMeleeDamage(rawDamage: number, victim: Unit, is_mh: boolean, effect?: Effect): [number, MeleeHitOutcome, number] {
        const damageWithBonus = this.calculateBonusDamage(rawDamage, victim, effect);
        const armorReduced = victim.calculateArmorReducedDamage(damageWithBonus, this);
        const hitOutcome = this.rollMeleeHitOutcome(victim, is_mh, effect);

        let damage = armorReduced;
        let cleanDamage = 0;

        switch (hitOutcome) {
            case MeleeHitOutcome.MELEE_HIT_MISS:
            {
                damage = 0;
                break;
            }
            case MeleeHitOutcome.MELEE_HIT_DODGE:
            case MeleeHitOutcome.MELEE_HIT_PARRY:
            {
                damage = 0;
                cleanDamage = damageWithBonus;
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

        return [damage, hitOutcome, cleanDamage];
    }

    updateProcs(time: number, is_mh: boolean, hitOutcome: MeleeHitOutcome, damageDone: number, cleanDamage: number, effect?: Effect) {
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_PARRY].includes(hitOutcome)) {
            // what is the order of checking for procs like hoj, ironfoe and windfury
            // on LH core it is hoj > ironfoe > windfury
            // so do item procs first, then weapon proc, then windfury
            for (let proc of this.procs) {
                proc.run(this, (is_mh ? this.mh! : this.oh!).weapon, time);
            }
            (is_mh ? this.mh! : this.oh!).proc(time);
        }
    }

    dealMeleeDamage(time: number, rawDamage: number, target: Unit, is_mh: boolean, effect?: Effect) {
        let [damageDone, hitOutcome, cleanDamage] = this.calculateMeleeDamage(rawDamage, target, is_mh, effect);
        damageDone = Math.trunc(damageDone); // truncating here because warrior subclass builds on top of calculateMeleeDamage
        cleanDamage = Math.trunc(cleanDamage); // TODO, should damageMult affect clean damage as well? if so move it into calculateMeleeDamage

        this.damageLog.push([time, damageDone]);
        
        if (this.log) {
            let hitStr = `Your ${effect ? effect.parent!.name : (is_mh ? 'main-hand' : 'off-hand')} ${hitOutcomeString[hitOutcome]}`;
            if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_PARRY].includes(hitOutcome)) {
                hitStr += ` for ${damageDone}`;
            }
            this.log(time, hitStr);
        }

        if (effect instanceof SpellDamageEffect) {
            if (effect.callback) {
                // calling this before update procs because in the case of execute, unbridled wrath could proc
                // then setting the rage to 0 would cause us to lose the 1 rage from unbridled wrath
                // alternative is to save the amount of rage used for the ability
                effect.callback(this, hitOutcome);
            }
        }

        if (!effect || effect.canProc) {
            this.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, effect);
            this.buffManager.update(time);
        }
    }

    dealSpellDamage(time: number, rawDamage: number, target: Unit, effect: Effect) {
        const damageDone = rawDamage;

        this.damageLog.push([time, damageDone]);

        if (this.log) {
            this.log(time, `${effect.parent!.name} hits for ${damageDone}`);
        }
    }

    protected swingWeapon(time: number, target: Unit, is_mh: boolean) {
        if (!this.doingExtraAttacks && is_mh && this.queuedSpell && this.queuedSpell.canCast(time)) {
            this.queuedSpell.cast(time);
            this.queuedSpell = undefined;
        } else {
            const rawDamage = this.calculateSwingRawDamage(is_mh);
            this.dealMeleeDamage(time, rawDamage, target, is_mh);
        }

        const [thisWeapon, otherWeapon] = is_mh ? [this.mh, this.oh] : [this.oh, this.mh];

        thisWeapon!.nextSwingTime = time + thisWeapon!.weapon.speed / this.buffManager.stats.haste * 1000;

        if (otherWeapon && otherWeapon.nextSwingTime < time + 200) {
            // console.log(`delaying ${is_mh ? 'OH' : 'MH'} swing`, time + 200 - otherWeapon.nextSwingTime);
            otherWeapon.nextSwingTime = time + 200;
        }
    }

    updateAttackingState(time: number) {
        if (this.target) {
            if (this.extraAttackCount > 0) {
                this.doingExtraAttacks = true;
                while (this.extraAttackCount > 0) {
                    this.swingWeapon(time, this.target, true);
                    this.extraAttackCount--;
                }
                this.doingExtraAttacks = false;
            }

            if (time >= this.mh!.nextSwingTime) {
                this.swingWeapon(time, this.target, true);
            } else if (this.oh && time >= this.oh.nextSwingTime) {
                this.swingWeapon(time, this.target, false);
            }
        }
    }
}
