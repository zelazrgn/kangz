import { Player, MeleeHitOutcome } from "./player.js";
import { Buff, BuffOverTime } from "./buff.js";
import { Spell, LearnedSpell, SpellDamage, SpellType, SwingSpell, LearnedSwingSpell } from "./spell.js";
import { clamp } from "./math.js";
import { ItemSlot } from "./item.js";
const flurry = new Buff("Flurry", 15, { haste: 1.3 }, true, 3, undefined, undefined, false);
export class Warrior extends Player {
    constructor(stats, logCallback) {
        super(stats, logCallback);
        this.flurryCount = 0;
        this.rage = 0;
        this.execute = new LearnedSpell(executeSpell, this);
        this.bloodthirst = new LearnedSpell(bloodthirstSpell, this);
        this.hamstring = new LearnedSpell(hamstringSpell, this);
        this.whirlwind = new LearnedSpell(whirlwindSpell, this);
        this.heroicStrike = new LearnedSwingSpell(heroicStrikeSpell, this);
        this.bloodRage = new LearnedSpell(bloodRage, this);
        this.buffManager.add(angerManagementOT, Math.random() * -3000);
    }
    get power() {
        return this.rage;
    }
    set power(power) {
        this.rage = clamp(power, 0, 100);
    }
    get ap() {
        return this.level * 3 - 20 + this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }
    calculateCritChance() {
        return 5 + 3 + super.calculateCritChance();
    }
    calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill = false) {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill);
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && is_spell) {
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
        addRage = Math.trunc(addRage);
        if (this.log)
            this.log(time, `Gained ${Math.min(addRage, 100 - this.rage)} rage (${Math.min(100, this.power + addRage)})`);
        this.power += addRage;
    }
    updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);
        if (spell) {
        }
        else {
            if ([MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                this.rewardRage(cleanDamage * 0.75, true, time);
            }
            else if (damageDone) {
                this.rewardRage(damageDone, true, time);
            }
        }
        if (!this.doingExtraAttacks
            && !(spell || spell === heroicStrikeSpell)
            && ![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)
            && hitOutcome !== MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.flurryCount = Math.max(0, this.flurryCount - 1);
        }
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.buffManager.add(flurry, time);
        }
    }
    swingWeapon(time, target, is_mh) {
        super.swingWeapon(time, target, is_mh);
        if (!this.extraAttackCount) {
            this.chooseAction(time);
        }
    }
    chooseAction(time) {
        const useItemIfCan = (slot) => {
            const item = this.items.get(slot);
            if (item && item.onuse && item.onuse.canCast(time)) {
                item.onuse.cast(time);
            }
        };
        useItemIfCan(ItemSlot.TRINKET1);
        useItemIfCan(ItemSlot.TRINKET2);
        if (this.rage < 30 && this.bloodRage.canCast(time)) {
            this.bloodRage.cast(time);
        }
        if (this.nextGCDTime <= time) {
            if (this.bloodthirst.canCast(time)) {
                this.bloodthirst.cast(time);
            }
            else if (!this.bloodthirst.onCooldown(time)) {
                return;
            }
            else if (this.whirlwind.canCast(time)) {
                this.whirlwind.cast(time);
            }
            else if (!this.whirlwind.onCooldown(time)) {
                return;
            }
            else if (this.hamstring.canCast(time)) {
                this.hamstring.cast(time);
            }
        }
        if (this.rage >= 60 && !this.queuedSpell) {
            this.queuedSpell = this.heroicStrike;
            if (this.log)
                this.log(time, 'queueing heroic strike');
        }
    }
}
const heroicStrikeSpell = new SwingSpell("Heroic Strike", 157, 12);
const executeSpell = new SpellDamage("Execute", (player) => {
    return 450 + (player.rage - 10);
}, SpellType.PHYSICAL_WEAPON, true, 10, 0);
const bloodthirstSpell = new SpellDamage("Bloodthirst", (player) => {
    return player.ap * 0.45;
}, SpellType.PHYSICAL, true, 30, 6000);
const whirlwindSpell = new SpellDamage("Whirlwind", (player) => {
    return player.calculateRawDamage(true);
}, SpellType.PHYSICAL_WEAPON, true, 25, 10000);
const hamstringSpell = new SpellDamage("Hamstring", 45, SpellType.PHYSICAL_WEAPON, true, 10, 0);
export const battleShout = new Buff("Battle Shout", 2 * 60, { ap: 290 });
export const angerManagementOT = new BuffOverTime("Anger Management", Number.MAX_SAFE_INTEGER, undefined, 3000, (player, time) => {
    player.power += 1;
    if (player.log)
        player.log(time, `You gained 1 rage from Anger Management`);
});
const bloodRageOT = new BuffOverTime("Bloodrage", 10, undefined, 1000, (player, time) => {
    player.power += 1;
    if (player.log)
        player.log(time, `You gained 1 rage from Bloodrage`);
});
const bloodRage = new Spell("Bloodrage", false, 0, 60 * 1000, (player, time) => {
    player.power += 10;
    if (player.log)
        player.log(time, `You gain 10 rage from Bloodrage`);
    player.buffManager.add(bloodRageOT, time);
});
//# sourceMappingURL=warrior.js.map