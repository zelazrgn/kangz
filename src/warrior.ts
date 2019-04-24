import { Player, MeleeHitOutcome, Race } from "./player.js";
import { Buff, BuffOverTime, BuffProc } from "./buff.js";
import { Unit } from "./unit.js";
import { Spell, LearnedSpell, SpellDamage, SpellType, SwingSpell, LearnedSwingSpell, Proc, SpellBuff, SpellFamily } from "./spell.js";
import { clamp } from "./math.js";
import { StatValues, Stats } from "./stats.js";

const flurry = new Buff("Flurry", 15, {haste: 1.3}, true, 3, undefined, undefined, false);

export const raceToStats = new Map<Race, StatValues>();
raceToStats.set(Race.HUMAN, { maceSkill: 5, swordSkill: 5, mace2HSkill: 5, sword2HSkill: 5, str: 120, agi: 80 });
raceToStats.set(Race.ORC, { axeSkill: 5, axe2HSkill: 5, str: 123, agi: 77 });

export class Warrior extends Player {
    rage = 80; // TODO - allow simulation to choose starting rage

    execute = new LearnedSpell(executeSpell, this);
    bloodthirst = new LearnedSpell(bloodthirstSpell, this);
    hamstring = new LearnedSpell(hamstringSpell, this);
    whirlwind = new LearnedSpell(whirlwindSpell, this);
    heroicStrike = new LearnedSwingSpell(heroicStrikeSpell, this);
    bloodRage = new LearnedSpell(bloodRage, this);
    deathWish = new LearnedSpell(deathWish, this);
    executeSpell = new LearnedSpell(executeSpell, this);

    constructor(race: Race, stats: StatValues, logCallback?: (time: number, text: string) => void) {
        super(new Stats(raceToStats.get(race)).add(stats), logCallback);

        this.buffManager.add(angerManagementOT, Math.random() * -3000); // randomizing anger management timing
        this.buffManager.add(unbridledWrath, 0);
    }

    get power() {
        return this.rage;
    }

    set power(power: number) {
        this.powerLost += Math.max(0, power - 100);
        this.rage = clamp(power, 0, 100);
    }

    get ap() {
        return this.level * 3 - 20 + this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }

    calculateCritChance(victim: Unit, is_mh: boolean, spell?: Spell) {
        // cruelty + berserker stance
        return 5 + 3 + super.calculateCritChance(victim, is_mh, spell);
    }

    calculateMeleeDamage(rawDamage: number, victim: Unit, is_mh: boolean, spell?: Spell): [number, MeleeHitOutcome, number] {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(rawDamage, victim, is_mh, spell);

        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && spell && spell.family === SpellFamily.WARRIOR) {
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
        // TODO - how do fractions of rage work? it appears you do gain fractions based on exec damage
        // not truncating for now
        // TODO - it appears that rage is calculated to tenths based on database values of spells (10 energy = 1 rage)
        
        const LEVEL_60_RAGE_CONV = 230.6;
        let addRage = damage / LEVEL_60_RAGE_CONV;
        
        if (is_attacker) {
            addRage *= 7.5;
        } else {
            // TODO - check for berserker rage 1.3x modifier
            addRage *= 2.5;
        }

        if (this.log) this.log(time, `Gained ${Math.min(addRage, 100 - this.rage)} rage (${Math.min(100, this.power + addRage)})`);

        this.power += addRage;
    }

    updateProcs(time: number, is_mh: boolean, hitOutcome: MeleeHitOutcome, damageDone: number, cleanDamage: number, spell?: Spell) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);

        if ([MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            if (spell) {
                // http://blue.mmo-champion.com/topic/69365-18-02-05-kalgans-response-to-warriors/ "since missing wastes 20% of the rage cost of the ability"
                // TODO - not sure how blizzlike this is
                if (spell !== whirlwindSpell) { // TODO - should check to see if it is an aoe spell or a single target spell
                    this.rage += spell.cost * 0.82;
                }
            } else {
                this.rewardRage(cleanDamage * 0.75, true, time); // TODO - where is this formula from?
            }
        } else if (damageDone && !spell) {
            this.rewardRage(damageDone, true, time);
        }

        // instant attacks and misses/dodges don't use flurry charges // TODO - confirm, what about parry?
        // extra attacks don't use flurry charges but they can proc flurry (tested)
        if (
            !this.doingExtraAttacks
            && !(spell || spell === heroicStrikeSpell)
            && ![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)
            && hitOutcome !== MeleeHitOutcome.MELEE_HIT_CRIT
        ) { 
            this.buffManager.remove(flurry, time);
        }
        
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            // TODO - ignoring deep wounds
            this.buffManager.add(flurry, time);
        }
    }
}

const heroicStrikeSpell = new SwingSpell("Heroic Strike", SpellFamily.WARRIOR, 157, 12);

// execute actually works by casting two spells, first requires weapon but does no damage
// second one doesn't require weapon and deals the damage.
// LH core overrode the second spell to require weapon (benefit from weapon skill)
const executeSpell = new SpellDamage("Execute", (player: Player) => {
    return 600 + (player.power - 10) * 15;
}, SpellType.PHYSICAL_WEAPON, SpellFamily.WARRIOR, true, 10, 0, (player: Player, hitOutcome: MeleeHitOutcome) => {
    if (![MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_MISS].includes(hitOutcome)) {
        player.power = 0;
    }
});

const bloodthirstSpell = new SpellDamage("Bloodthirst", (player: Player) => {
    return (<Warrior>player).ap * 0.45;
}, SpellType.PHYSICAL, SpellFamily.WARRIOR, true, 30, 6);

const whirlwindSpell = new SpellDamage("Whirlwind", (player: Player) => {
    return player.calculateSwingRawDamage(true);
}, SpellType.PHYSICAL_WEAPON, SpellFamily.WARRIOR, true, 25, 10);

const hamstringSpell = new SpellDamage("Hamstring", 45, SpellType.PHYSICAL_WEAPON, SpellFamily.WARRIOR, true, 10, 0);

export const angerManagementOT = new BuffOverTime("Anger Management", Number.MAX_SAFE_INTEGER, undefined, 3000, (player: Player, time: number) => {
    player.power += 1;
    if (player.log) player.log(time, `You gained 1 rage from Anger Management`);
});

const bloodRageOT = new BuffOverTime("Bloodrage", 10, undefined, 1000, (player: Player, time: number) => {
    player.power += 1;
    if (player.log) player.log(time, `You gained 1 rage from Bloodrage`);
});

const bloodRage = new Spell("Bloodrage", SpellType.NONE, SpellFamily.WARRIOR, false, 0, 60, (player: Player, time: number) => {
    player.power += 10;
    if (player.log) player.log(time, `You gain 10 rage from Bloodrage`);
    player.buffManager.add(bloodRageOT, time);
});

const deathWish = new SpellBuff(new Buff("Death Wish", 30, { damageMult: 1.2 }), true, 10, 3 * 60);

const unbridledWrath = new BuffProc("Unbridled Wrath", 60 * 60,
    new Proc(
        new Spell("Unbridled Wrath", SpellType.NONE, SpellFamily.WARRIOR, false, 0, 0, (player: Player, time: number) => {
            if (player.log) player.log(time, `You gain 1 rage from Unbridled Wrath`);
            player.power += 1;
        }),
        {chance: 40}));
