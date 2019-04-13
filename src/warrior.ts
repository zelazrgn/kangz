import { Player, MeleeHitOutcome } from "./player.js";
import { Buff, BuffOverTime } from "./buff.js";
import { Unit } from "./unit.js";
import { Spell, LearnedSpell, SpellDamage, SpellType, SwingSpell, LearnedSwingSpell, Proc, SpellBuff } from "./spell.js";
import { clamp } from "./math.js";
import { StatValues } from "./stats.js";
import { ItemSlot } from "./item.js";

const flurry = new Buff("Flurry", 15, {haste: 1.3}, true, 3, undefined, undefined, false);

export class Warrior extends Player {
    flurryCount = 0;
    rage = 0;

    execute = new LearnedSpell(executeSpell, this);
    bloodthirst = new LearnedSpell(bloodthirstSpell, this);
    hamstring = new LearnedSpell(hamstringSpell, this);
    whirlwind = new LearnedSpell(whirlwindSpell, this);
    heroicStrike = new LearnedSwingSpell(heroicStrikeSpell, this);
    bloodRage = new LearnedSpell(bloodRage, this);

    constructor(stats: StatValues, logCallback?: (time: number, text: string) => void) {
        super(stats, logCallback);

        this.buffManager.add(angerManagementOT, Math.random() * -3000); // randomizing anger management timing
    }

    get power() {
        return this.rage;
    }

    set power(power: number) {
        this.rage = clamp(power, 0, 100);
    }

    get ap() {
        return this.level * 3 - 20 + this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }

    calculateCritChance() {
        // cruelty + berserker stance
        return 5 + 3 + super.calculateCritChance();
    }

    calculateMeleeDamage(rawDamage: number, victim: Unit, is_mh: boolean, is_spell: boolean, ignore_weapon_skill = false): [number, MeleeHitOutcome, number] {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill);

        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && is_spell) {
            damageDone *= 1.1; // impale
        }
        
        return [damageDone, hitOutcome, cleanDamage];
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

        if (this.log) this.log(time, `Gained ${Math.min(addRage, 100 - this.rage)} rage (${Math.min(100, this.power + addRage)})`);

        this.power += addRage;
    }

    updateProcs(time: number, is_mh: boolean, hitOutcome: MeleeHitOutcome, damageDone: number, cleanDamage: number, spell?: Spell) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);

        // calculate rage
        if (spell) { 
            // TODO - do you gain rage from heroic strike if it is dodged/parried?
        } else {
            if ([MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                this.rewardRage(cleanDamage * 0.75, true, time); // TODO - where is this formula from?
            } else if (damageDone) {
                this.rewardRage(damageDone, true, time);
            }
        }

        // instant attacks and misses/dodges don't use flurry charges // TODO - confirm
        // extra attacks don't use flurry charges but they can proc flurry (tested)
        if (
            !this.doingExtraAttacks
            && !(spell || spell === heroicStrikeSpell)
            && ![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)
            && hitOutcome !== MeleeHitOutcome.MELEE_HIT_CRIT
        ) { 
            this.flurryCount = Math.max(0, this.flurryCount - 1);
            // this.buffManager.remove(flurry, time);
        }
        
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            // TODO - ignoring deep wounds
            this.buffManager.add(flurry, time);
        }
    }

    swingWeapon(time: number, target: Unit, is_mh: boolean) {
        super.swingWeapon(time, target, is_mh);

        if (!this.extraAttackCount) {
            this.chooseAction(time); // TODO - since we probably gained rage, can cast a spell, but need to account for latency, reaction time (button mashing)
        }
    }

    chooseAction(time: number) {
        const useItemIfCan = (slot: ItemSlot) => {
            const item = this.items.get(slot);
            if (item && item.onuse && item.onuse.canCast(time)) {
                item.onuse.cast(time);
            }
        }

        useItemIfCan(ItemSlot.TRINKET1);
        useItemIfCan(ItemSlot.TRINKET2);

        if (this.rage < 30 && this.bloodRage.canCast(time)) {
            this.bloodRage.cast(time);
        }

        // gcd spells
        if (this.nextGCDTime <= time) {
            if (this.bloodthirst.canCast(time)) {
                this.bloodthirst.cast(time);
            } else if (!this.bloodthirst.onCooldown(time)) {
                return; // not on cooldown, wait for rage or gcd
            } else if (this.whirlwind.canCast(time)) {
                this.whirlwind.cast(time);
            } else if (!this.whirlwind.onCooldown(time)) {
                return; // not on cooldown, wait for rage or gcd
            } else if (this.hamstring.canCast(time)) {
                this.hamstring.cast(time);
            }
        }

        if (this.rage >= 60 && !this.queuedSpell) {
            this.queuedSpell = this.heroicStrike;
            if (this.log) this.log(time, 'queueing heroic strike');
        }
    }
}

const heroicStrikeSpell = new SwingSpell("Heroic Strike", 157, 12);

const executeSpell = new SpellDamage("Execute", (player: Player) => {
    return 450 + ((<Warrior>player).rage - 10);
}, SpellType.PHYSICAL_WEAPON, true, 10, 0);

const bloodthirstSpell = new SpellDamage("Bloodthirst", (player: Player) => {
    return (<Warrior>player).ap * 0.45;
}, SpellType.PHYSICAL, true, 30, 6000);

const whirlwindSpell = new SpellDamage("Whirlwind", (player: Player) => {
    return player.calculateRawDamage(true);
}, SpellType.PHYSICAL_WEAPON, true, 25, 10000);

const hamstringSpell = new SpellDamage("Hamstring", 45, SpellType.PHYSICAL_WEAPON, true, 10, 0);

export const battleShout = new Buff("Battle Shout", 2 * 60, {ap: 290});



export const angerManagementOT = new BuffOverTime("Anger Management", Number.MAX_SAFE_INTEGER, undefined, 3000, (player: Player, time: number) => {
    player.power += 1;
    if (player.log) player.log(time, `You gained 1 rage from Anger Management`);
});

const bloodRageOT = new BuffOverTime("Bloodrage", 10, undefined, 1000, (player: Player, time: number) => {
    player.power += 1;
    if (player.log) player.log(time, `You gained 1 rage from Bloodrage`);
});

const bloodRage = new Spell("Bloodrage", false, 0, 60 * 1000, (player: Player, time: number) => {
    player.power += 10;
    if (player.log) player.log(time, `You gain 10 rage from Bloodrage`);
    player.buffManager.add(bloodRageOT, time);
});
