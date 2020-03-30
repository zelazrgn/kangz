import { WeaponEquiped, WeaponType, ItemDescription, ItemEquiped, ItemSlot, isEquipedWeapon, isWeapon, normalizedWeaponSpeed } from "./item.js";
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
    GNOME,
    TROLL,
}

export enum Faction {
    ALLIANCE,
    HORDE,
}

type factionOfRaceMap = {[TKey in Race]: Faction};

export const FACTION_OF_RACE: factionOfRaceMap = {
    [Race.HUMAN]: Faction.ALLIANCE,
    [Race.GNOME]: Faction.ALLIANCE,
    [Race.ORC]: Faction.HORDE,
    [Race.TROLL]: Faction.HORDE,
};

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

export type LogFunction = (time: number, text: string) => void;

export type DamageLog = [number, number][];

export type HitOutcomeStats = {[TKey in MeleeHitOutcome]: number};

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

    futureEvents: {time: number, callback: (player: Player) => void}[] = [];

    hitStats: Map<string, HitOutcomeStats> = new Map();

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

    protected calculateCritSuppression(victim: Unit) {
        return (victim.defenseSkill - this.maxSkillForLevel) * 0.2 + (victim.level === 63 ? 1.8 : 0);
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

        // if (!effect || effect.type == EffectType.PHYSICAL_WEAPON) {
        //     const weapon = is_mh ? this.mh! : this.oh!;

            // if (weapon.temporaryEnchant && weapon.temporaryEnchant.stats && weapon.temporaryEnchant.stats.crit) {
            //     crit += weapon.temporaryEnchant.stats.crit;
            // }
        // }

        const weapons: WeaponEquiped[] = [];
        if (this.mh) {
            weapons.push(this.mh);
        }
        if (this.oh) {
            weapons.push(this.oh);
        }

        for (let weapon of weapons) {
            if (weapon.temporaryEnchant && weapon.temporaryEnchant.stats && weapon.temporaryEnchant.stats.crit) {
                crit += weapon.temporaryEnchant.stats.crit;
            }
        }

        crit -= this.calculateCritSuppression(victim);

        return crit;
    }

    protected calculateMissChance(victim: Unit, is_mh: boolean, effect?: Effect) {
        let res = 5;
        
        const skillDiff = victim.defenseSkill - this.calculateWeaponSkillValue(is_mh, effect);

        res += skillDiff * (skillDiff > 10 ? 0.2 : 0.1);

        if (this.oh && !effect && !this.queuedSpell) {
            res = res * 0.8 + 20;
        }

        res -= this.buffManager.stats.hit;

        return clamp(res, 0, 60);
    }

    protected calculateGlancingReduction(victim: Unit, is_mh: boolean) {
        const skillDiff = victim.defenseSkill  - this.calculateWeaponSkillValue(is_mh);

        const lowEnd = Math.min(1.3 - 0.05 * skillDiff, 0.91);
        const highEnd = clamp(1.2 - 0.03 * skillDiff, 0.2, 0.99);

        return (lowEnd + highEnd) / 2;
    }

    get ap() {
        return 0;
    }

    protected calculateSwingMinMaxDamage(is_mh: boolean, normalized = false): [number, number] {
        const weapon = is_mh ? this.mh! : this.oh!;

        const ap_bonus = this.ap / 14 * (normalized ? normalizedWeaponSpeed[weapon.weapon.type] : weapon.weapon.speed);

        const ohPenalty = is_mh ? 1 : 0.625; // TODO - check talents, implemented as an aura SPELL_AURA_MOD_OFFHAND_DAMAGE_PCT

        return [
            (weapon.min + ap_bonus + this.buffManager.stats.plusDamage) * ohPenalty,
            (weapon.max + ap_bonus + this.buffManager.stats.plusDamage) * ohPenalty
        ];
    }

    calculateSwingRawDamage(is_mh: boolean, normalized = false) {
        return frand(...this.calculateSwingMinMaxDamage(is_mh, normalized));
    }

    critCap() {
        const skillBonus = 10 * (this.calculateWeaponSkillValue(true) - this.target!.maxSkillForLevel);
        const miss_chance = Math.round(this.calculateMissChance(this.target!, true) * 100);
        const dodge_chance = Math.round(this.target!.dodgeChance * 100) - skillBonus;
        const glance_chance = clamp((10 + (this.target!.defenseSkill - 300) * 2) * 100, 0, 4000);
        const crit_suppression = Math.round(100 * this.calculateCritSuppression(this.target!));

        return (10000 - (miss_chance + dodge_chance + glance_chance - crit_suppression)) / 100;
    }

    rollMeleeHitOutcome(victim: Unit, is_mh: boolean, effect?: Effect): MeleeHitOutcome {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;

        // rounding instead of truncating because 19.4 * 100 was truncating to 1939.
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, effect) * 100);

        tmp = miss_chance;

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }

        const dodge_chance = Math.round(victim.dodgeChance * 100) - 10 * (this.calculateWeaponSkillValue(is_mh, effect) - victim.maxSkillForLevel);

        tmp = dodge_chance; // 5.6 (560) for lvl 63 with 300 weapon skill

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

        const crit_chance = Math.round(this.calculateCritChance(victim, is_mh, effect) * 100);

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

    protected updateProcs(time: number, is_mh: boolean, hitOutcome: MeleeHitOutcome, damageDone: number, cleanDamage: number, effect?: Effect) {
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_PARRY].includes(hitOutcome)) {
            // what is the order of checking for procs like hoj, ironfoe and windfury
            // on LH core it is hoj > ironfoe > windfury
            // so do item procs first, then weapon proc, then windfury
            for (let proc of this.procs) {
                proc.run(this, (is_mh ? this.mh! : this.oh!).weapon, time, effect);
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

        const damageName = effect ? effect.parent!.name : (is_mh ? "mh" : "oh");

        if (damageName === "mh" && effect) {
            console.log("fuck");
        }

        let prevStats = this.hitStats.get(damageName);

        if (!prevStats) {
            prevStats = {
                [MeleeHitOutcome.MELEE_HIT_EVADE]: 0,
                [MeleeHitOutcome.MELEE_HIT_MISS]: 0,
                [MeleeHitOutcome.MELEE_HIT_DODGE]: 0,
                [MeleeHitOutcome.MELEE_HIT_BLOCK]: 0,
                [MeleeHitOutcome.MELEE_HIT_PARRY]: 0,
                [MeleeHitOutcome.MELEE_HIT_GLANCING]: 0,
                [MeleeHitOutcome.MELEE_HIT_CRIT]: 0,
                [MeleeHitOutcome.MELEE_HIT_CRUSHING]: 0,
                [MeleeHitOutcome.MELEE_HIT_NORMAL]: 0,
                [MeleeHitOutcome.MELEE_HIT_BLOCK_CRIT]: 0,
            };
            this.hitStats.set(damageName, prevStats);
        }

        prevStats[hitOutcome]++;


        if (effect instanceof SpellDamageEffect) {
            if (effect.callback) {
                // calling this before update procs because in the case of execute, unbridled wrath could proc
                // then setting the rage to 0 would cause us to lose the 1 rage from unbridled wrath
                // alternative is to save the amount of rage used for the ability
                effect.callback(this, hitOutcome, time);
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
        if (is_mh && this.queuedSpell && this.queuedSpell.canCast(time)) {
            this.queuedSpell.cast(time);
            this.queuedSpell = undefined;
        } else {
            if (is_mh) {
                this.queuedSpell = undefined;
            }

            const rawDamage = this.calculateSwingRawDamage(is_mh);
            this.dealMeleeDamage(time, rawDamage, target, is_mh);
        }

        const [thisWeapon, otherWeapon] = is_mh ? [this.mh, this.oh] : [this.oh, this.mh];

        thisWeapon!.nextSwingTime = time + thisWeapon!.weapon.speed / this.buffManager.stats.haste * 1000;
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
            }
            if (this.oh && time >= this.oh.nextSwingTime) {
                this.swingWeapon(time, this.target, false);
            }
        }
    }
}
