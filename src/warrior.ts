import { Player, MeleeHitOutcome } from "./player.js";
import { Buff } from "./buff.js";
import { Unit } from "./unit.js";
import { Spell, LearnedSpell } from "./spell.js";
import { clamp } from "./math.js";

const flurry = new Buff("Flurry", 15, {haste: 1.3});

export class Warrior extends Player {
    flurryCount = 0;
    rage = 0;

    execute = new LearnedSpell(executeSpell, this);
    bloodthirst = new LearnedSpell(bloodthirstSpell, this);
    heroicStrike = new LearnedSpell(heroicStrikeSpell, this);
    hamstring = new LearnedSpell(hamstringSpell, this);
    whirlwind = new LearnedSpell(whirlwindSpell, this);

    queuedSpell: LearnedSpell|undefined = undefined;

    get power() {
        return this.rage;
    }

    set power(power: number) {
        this.rage = clamp(power, 0, 100);
    }

    get ap() {
        return this.level * 3 - 20 + this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }

    calculateRawDamage(is_mh: boolean, is_spell: boolean) { // TODO - currently is_spell is really is_heroicstrike
        const bonus = (is_mh && is_spell) ? 157 : 0; // heroic strike rank 9
        return bonus + super.calculateRawDamage(is_mh, is_spell);
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

        if (this.log) this.log(time, `Gained ${Math.min(addRage, 100 - this.rage)} rage`);

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
        if (!(spell || spell === heroicStrikeSpell) && ![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
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

    swingWeapon(time: number, target: Unit, is_mh: boolean, spell?: Spell) {
        if (!spell && this.queuedSpell && is_mh && !this.extraAttackCount) { // don't cast heroic strike if it is an extra attack
            this.queuedSpell.cast(time);
            this.queuedSpell = undefined;
        } else {
            super.swingWeapon(time, target, is_mh, spell);
        }

        this.chooseAction(time); // TODO - since we probably gained rage, can cast a spell, but need to account for latency, reaction time (button mashing)
    }

    chooseAction(time: number) {
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
            } else if (false && this.hamstring.canCast(time)) {
                this.hamstring.cast(time);
            }
        }

        if (this.rage >= 60 && !this.queuedSpell) {
            this.queuedSpell = this.heroicStrike;
            if (this.log) this.log(time, 'queueing heroic strike');
        }
    }
}

const heroicStrikeSpell = new Spell("Heroic Strike", false, 12, 0, (player: Player, time: number) => {
    const warrior = <Warrior>player;
    warrior.swingWeapon(time, warrior.target!, true, heroicStrikeSpell);
});

const executeSpell = new Spell("Execute", true, 15, 0, (player: Player) => {
    const warrior = <Warrior>player;
});

const bloodthirstSpell = new Spell("Bloodthirst", true, 30, 6000, (player: Player, time: number) => {
    const warrior = <Warrior>player;
    const rawDamage = warrior.ap * 0.45;

    warrior.dealMeleeDamage(time, rawDamage, warrior.target!, true, bloodthirstSpell, true);
});

const whirlwindSpell = new Spell("Whirlwind", true, 25, 10000, (player: Player, time: number) => {
    const warrior = <Warrior>player;
    warrior.dealMeleeDamage(time, warrior.calculateRawDamage(true, false), warrior.target!, true, whirlwindSpell, false);
});

const hamstringSpell = new Spell("Hamstring", true, 10, 0, (player: Player, time: number) => {
    const warrior = <Warrior>player;
    warrior.dealMeleeDamage(time, 45, warrior.target!, true, hamstringSpell, false);
});

export const battleShout = new Buff("Battle Shout", 60 * 60, {ap: 290});
