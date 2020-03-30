import { Player, MeleeHitOutcome, Race } from "./player.js";
import { Buff, BuffOverTime, BuffProc } from "./buff.js";
import { Spell, LearnedSpell, SpellDamage, EffectType, SwingSpell, LearnedSwingSpell, Proc, SpellBuff, SpellBuffEffect, ModifyPowerEffect, EffectFamily, SwingEffect } from "./spell.js";
import { clamp } from "./math.js";
import { Stats } from "./stats.js";
const flurry = new Buff("Flurry", 15, { haste: 1.3 }, true, 3, undefined, undefined, false);
export const raceToStats = new Map();
raceToStats.set(Race.HUMAN, { maceSkill: 5, swordSkill: 5, mace2HSkill: 5, sword2HSkill: 5, str: 120, agi: 80 });
raceToStats.set(Race.ORC, { axeSkill: 5, axe2HSkill: 5, str: 123, agi: 77 });
raceToStats.set(Race.GNOME, { str: 115, agi: 83 });
raceToStats.set(Race.TROLL, { str: 121, agi: 82 });
export class Warrior extends Player {
    constructor(race, stats, logCallback) {
        super(new Stats(raceToStats.get(race)).add(stats), logCallback);
        this.rage = 80;
        this.execute = new LearnedSpell(executeSpell, this);
        this.bloodthirst = new LearnedSpell(bloodthirstSpell, this);
        this.hamstring = new LearnedSpell(hamstringSpell, this);
        this.whirlwind = new LearnedSpell(whirlwindSpell, this);
        this.heroicStrikeR8 = new LearnedSwingSpell(heroicStrikeR8Spell, this);
        this.heroicStrikeR9 = new LearnedSwingSpell(heroicStrikeR9Spell, this);
        this.bloodRage = new LearnedSpell(bloodRage, this);
        this.deathWish = new LearnedSpell(deathWish, this);
        this.recklessness = new LearnedSpell(recklessness, this);
        this.executeSpell = new LearnedSpell(executeSpell, this);
        this.mightyRagePotion = new LearnedSpell(mightyRagePotion, this);
        this.buffManager.add(angerManagementOT, Math.random() * -3000 - 100);
        this.buffManager.add(unbridledWrath, -100);
    }
    get power() {
        return this.rage;
    }
    set power(power) {
        this.powerLost += Math.max(0, power - 100);
        this.rage = clamp(power, 0, 100);
    }
    get ap() {
        return this.level * 3 - 20 + this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }
    calculateCritChance(victim, is_mh, effect) {
        return 5 + 3 + super.calculateCritChance(victim, is_mh, effect);
    }
    calculateMeleeDamage(rawDamage, victim, is_mh, effect) {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(rawDamage, victim, is_mh, effect);
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && effect && effect.family === EffectFamily.WARRIOR) {
            damageDone *= 1.1;
        }
        return [damageDone, hitOutcome, cleanDamage];
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
        if (this.log)
            this.log(time, `Gained ${Math.min(addRage, 100 - this.rage)} rage (${Math.min(100, this.power + addRage)})`);
        this.power += addRage;
    }
    updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, effect) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, effect);
        if ([MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            if (effect) {
                if (effect.parent instanceof Spell && effect.parent !== whirlwindSpell) {
                    this.rage += effect.parent.cost * 0.75;
                }
            }
            else {
                this.rewardRage(cleanDamage * 0.75, true, time);
            }
        }
        else if (damageDone && !effect) {
            this.rewardRage(damageDone, true, time);
        }
        if (!this.doingExtraAttacks
            && (!effect || effect instanceof SwingEffect)
            && hitOutcome !== MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.buffManager.remove(flurry, time);
        }
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.buffManager.add(flurry, time);
        }
    }
}
const heroicStrikeR8Spell = new SwingSpell("Heroic Strike", EffectFamily.WARRIOR, 138, 12);
const heroicStrikeR9Spell = new SwingSpell("Heroic Strike", EffectFamily.WARRIOR, 157, 12);
const executeSpell = new SpellDamage("Execute", (player) => {
    return 600 + (player.power - 10) * 15;
}, EffectType.PHYSICAL_WEAPON, EffectFamily.WARRIOR, true, 10, 0, (player, hitOutcome, time) => {
    if (![MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_MISS].includes(hitOutcome)) {
        const nextBatch = time + Math.random() * 400;
        player.futureEvents.push({
            time: nextBatch,
            callback: (player) => {
                player.power = 0;
                if (player.log) {
                    player.log(nextBatch, `Reset rage to 0 after execute, TODO (not exactly how it works)`);
                }
            }
        });
    }
});
const bloodthirstSpell = new SpellDamage("Bloodthirst", (player) => {
    return player.ap * 0.45;
}, EffectType.PHYSICAL_WEAPON, EffectFamily.WARRIOR, true, 30, 6);
const whirlwindSpell = new SpellDamage("Whirlwind", (player) => {
    return player.calculateSwingRawDamage(true, true);
}, EffectType.PHYSICAL_WEAPON, EffectFamily.WARRIOR, true, 25, 10);
const hamstringSpell = new SpellDamage("Hamstring", 45, EffectType.PHYSICAL_WEAPON, EffectFamily.WARRIOR, true, 10, 0);
export const angerManagementOT = new BuffOverTime("Anger Management", Number.MAX_SAFE_INTEGER, undefined, 3000, new ModifyPowerEffect(1));
const bloodRage = new Spell("Bloodrage", false, 0, 60, [
    new ModifyPowerEffect(10),
    new SpellBuffEffect(new BuffOverTime("Bloodrage", 10, undefined, 1000, new ModifyPowerEffect(1)))
]);
const deathWish = new SpellBuff(new Buff("Death Wish", 30, { damageMult: 1.2 }), true, 10, 3 * 60);
const recklessness = new SpellBuff(new Buff("Recklessness", 15, { crit: 100 }), true, 0, 15 * 60);
const unbridledWrath = new BuffProc("Unbridled Wrath", 60 * 60, new Proc(new Spell("Unbridled Wrath", false, 0, 0, new ModifyPowerEffect(1)), { chance: 0.4 }, true));
const mightyRagePotion = new Spell("Mighty Rage Potion", false, 0, 2 * 60, [
    new ModifyPowerEffect(45, 30),
    new SpellBuffEffect(new Buff("Mighty Rage", 20, { str: 60 })),
]);
//# sourceMappingURL=warrior.js.map