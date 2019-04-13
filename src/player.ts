import { WeaponEquiped, WeaponType, ItemDescription, ItemEquiped, ItemSlot, isEquipedWeapon, isWeapon } from "./item.js";
import { Unit } from "./unit.js";
import { urand, clamp } from "./math.js";
import { BuffManager } from "./buff.js";
import { StatValues, Stats } from "./stats.js";
import { Spell, Proc, LearnedSwingSpell } from "./spell.js";

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
    items: Map<ItemSlot, ItemEquiped> = new Map();
    procs: Proc[] = [];

    target: Unit | undefined;

    nextGCDTime = 0;
    extraAttackCount = 0;
    doingExtraAttacks = false;

    buffManager: BuffManager;

    damageDone = 0;

    queuedSpell: LearnedSwingSpell|undefined = undefined;

    log?: (time: number, text: string) => void;

    constructor(stats: StatValues, logCallback?: (time: number, text: string) => void) {
        super(60, 0); // lvl, armor

        this.buffManager = new BuffManager(this, new Stats(stats));
        this.log = logCallback;
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

    equip(item: ItemDescription, slot: ItemSlot) {
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

        // TODO - handle equipping 2H (and how that disables OH)
        if (isWeapon(item)) {
            this.items.set(slot, new WeaponEquiped(item, this));
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

    protected calculateWeaponSkillValue(is_mh: boolean, ignore_weapon_skill = false) {
        if (ignore_weapon_skill) {
            return this.maxSkillForLevel;
        }

        const weapon = is_mh ? this.mh! : this.oh!;
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

    protected calculateCritChance() {
        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;

        return crit;
    }

    protected calculateMissChance(victim: Unit, is_mh: boolean, is_spell: boolean, ignore_weapon_skill = false) {
        let res = 5;
        res -= this.buffManager.stats.hit;

        if (this.oh && !is_spell) {
            res += 19;
        }
        
        const skillDiff = this.calculateWeaponSkillValue(is_mh, ignore_weapon_skill) - victim.defenseSkill;

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

    protected get ap() {
        return 0;
    }

    protected calculateMinMaxDamage(is_mh: boolean): [number, number] {
        // TODO - Very simple version atm
        const weapon = is_mh ? this.mh! : this.oh!;

        const ap_bonus = this.ap / 14 * weapon.weapon.speed;

        return [
            Math.trunc(weapon.weapon.min + ap_bonus),
            Math.trunc(weapon.weapon.max + ap_bonus)
        ];
    }

    calculateRawDamage(is_mh: boolean) {
        return urand(...this.calculateMinMaxDamage(is_mh));
    }

    rollMeleeHitOutcome(victim: Unit, is_mh: boolean, is_spell: boolean, ignore_weapon_skill = false): MeleeHitOutcome {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;

        // rounding instead of truncating because 19.4 * 100 was truncating to 1939.
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, is_spell, ignore_weapon_skill) * 100);
        const dodge_chance = Math.round(victim.dodgeChance * 100);
        const crit_chance = Math.round(this.calculateCritChance() * 100);

        // weapon skill - target defense (usually negative)
        const skillBonus = 4 * (this.calculateWeaponSkillValue(is_mh, ignore_weapon_skill) - victim.maxSkillForLevel);

        tmp = miss_chance;

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }

        tmp = dodge_chance - skillBonus; // 5.6 (560) for lvl 63 with 300 weapon skill

        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_DODGE;
        }

        if (!is_spell) { // spells can't glance
            tmp = (10 + (victim.defenseSkill - 300) * 2) * 100;
            tmp = clamp(tmp, 0, 4000);
    
            if (roll < (sum += tmp)) {
                return MeleeHitOutcome.MELEE_HIT_GLANCING;
            }
        }

        tmp = crit_chance + skillBonus;

        if (tmp > 0 && roll < (sum += crit_chance)) {
            return MeleeHitOutcome.MELEE_HIT_CRIT;
        }

        return MeleeHitOutcome.MELEE_HIT_NORMAL;
    }

    calculateMeleeDamage(rawDamage: number, victim: Unit, is_mh: boolean, is_spell: boolean, ignore_weapon_skill = false): [number, MeleeHitOutcome, number] {
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
            damage *= 0.625; // TODO - check talents, should be in warrior class
        }

        return [damage, hitOutcome, cleanDamage];
    }

    updateProcs(time: number, is_mh: boolean, hitOutcome: MeleeHitOutcome, damageDone: number, cleanDamage: number, spell?: Spell) {
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            // what is the order of checking for procs like hoj, ironfoe and windfury
            // on LH core it is hoj > ironfoe > windfury

            // so do item procs first, then weapon proc, then windfury
            for (let proc of this.procs) {
                proc.run(this, (is_mh ? this.mh! : this.oh!).weapon, time);
            }
            (is_mh ? this.mh! : this.oh!).proc(time);
            // TODO - implement windfury here, it should still add attack power even if there is already an extra attack
        }
    }

    dealMeleeDamage(time: number, rawDamage: number, target: Unit, is_mh: boolean, spell?: Spell, ignore_weapon_skill = false) {
        let [damageDone, hitOutcome, cleanDamage] = this.calculateMeleeDamage(rawDamage, target, is_mh, spell !== undefined, ignore_weapon_skill);
        damageDone = Math.trunc(damageDone * this.buffManager.stats.damageMult); // truncating here because warrior subclass builds on top of calculateMeleeDamage
        cleanDamage = Math.trunc(cleanDamage); // TODO, should damageMult affect clean damage as well? if so move it into calculateMeleeDamage

        this.damageDone += damageDone;
        
        if (this.log) {
            let hitStr = `Your ${spell ? spell.name : (is_mh ? 'main-hand' : 'off-hand')} ${hitOutcomeString[hitOutcome]}`;
            if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                hitStr += ` for ${damageDone}`;
            }
            this.log(time, hitStr);
        }

        this.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);
        this.buffManager.update(time);
    }

    protected swingWeapon(time: number, target: Unit, is_mh: boolean) {
        const rawDamage = this.calculateRawDamage(is_mh);
        
        if (!this.doingExtraAttacks && is_mh && this.queuedSpell && this.queuedSpell.canCast(time)) {
            const swingSpell = this.queuedSpell.spell;
            this.queuedSpell = undefined;
            const bonusDamage = swingSpell.bonusDamage;
            this.dealMeleeDamage(time, rawDamage + bonusDamage, target, is_mh, swingSpell);
        } else {
            this.dealMeleeDamage(time, rawDamage, target, is_mh);
        }

        const [thisWeapon, otherWeapon] = is_mh ? [this.mh, this.oh] : [this.oh, this.mh];

        thisWeapon!.nextSwingTime = time + thisWeapon!.weapon.speed / this.buffManager.stats.haste * 1000;

        if (otherWeapon && otherWeapon.nextSwingTime < time + 200) {
            // console.log(`delaying ${is_mh ? 'OH' : 'MH'} swing`, time + 200 - otherWeapon.nextSwingTime);
            otherWeapon.nextSwingTime = time + 200;
        }
    }

    update(time: number) {
        this.buffManager.update(time);

        if (this.target) {
            if (this.extraAttackCount > 0) {
                this.doingExtraAttacks = true;
                while (this.extraAttackCount > 0) {
                    this.swingWeapon(time, this.target, true);
                    this.extraAttackCount--;
                }
                this.doingExtraAttacks = false;
            }

            this.chooseAction(time);

            if (time >= this.mh!.nextSwingTime) {
                this.swingWeapon(time, this.target, true);
            } else if (this.oh && time >= this.oh.nextSwingTime) {
                this.swingWeapon(time, this.target, false);
            }
        }
    }

    chooseAction(time: number) {}
}
