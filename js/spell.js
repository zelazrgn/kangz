export class Spell {
    constructor(name, is_gcd, cost, cooldown, spellF) {
        this.name = name;
        this.cost = cost;
        this.cooldown = cooldown;
        this.is_gcd = is_gcd;
        this.spellF = spellF;
    }
    cast(player, time) {
        return this.spellF(player, time);
    }
}
export class LearnedSpell {
    constructor(spell, caster) {
        this.cooldown = 0;
        this.spell = spell;
        this.caster = caster;
    }
    onCooldown(time) {
        return this.cooldown > time;
    }
    canCast(time) {
        if (this.spell.is_gcd && this.caster.nextGCDTime > time) {
            return false;
        }
        if (this.spell.cost > this.caster.power) {
            return false;
        }
        if (this.onCooldown(time)) {
            return false;
        }
        return true;
    }
    cast(time) {
        if (!this.canCast(time)) {
            return false;
        }
        if (this.spell.is_gcd) {
            this.caster.nextGCDTime = time + 1500;
        }
        this.caster.power -= this.spell.cost;
        this.spell.cast(this.caster, time);
        this.cooldown = time + this.spell.cooldown;
        return true;
    }
}
export class SwingSpell extends Spell {
    constructor(name, bonusDamage, cost) {
        super(name, false, cost, 0, () => { });
        this.bonusDamage = bonusDamage;
    }
}
export class LearnedSwingSpell extends LearnedSpell {
    constructor(spell, caster) {
        super(spell, caster);
        this.spell = spell;
    }
}
export var SpellType;
(function (SpellType) {
    SpellType[SpellType["PHYSICAL"] = 0] = "PHYSICAL";
    SpellType[SpellType["PHYSICAL_WEAPON"] = 1] = "PHYSICAL_WEAPON";
})(SpellType || (SpellType = {}));
export class SpellDamage extends Spell {
    constructor(name, amount, type, is_gcd, cost, cooldown) {
        super(name, is_gcd, cost, cooldown, (player, time) => {
            const dmg = (typeof amount === "number") ? amount : amount(player);
            if (type === SpellType.PHYSICAL || type === SpellType.PHYSICAL_WEAPON) {
                const ignore_weapon_skill = type === SpellType.PHYSICAL;
                player.dealMeleeDamage(time, dmg, player.target, true, this, ignore_weapon_skill);
            }
        });
    }
}
export class SpellDamage2 extends SpellDamage {
    constructor(name, amount, type) {
        super(name, amount, type, false, 0, 0);
    }
}
const fatalWounds = new SpellDamage2("Fatal Wounds", 240, SpellType.PHYSICAL);
export class ExtraAttack extends Spell {
    constructor(name, count) {
        super(name, false, 0, 0, (player, time) => {
            if (player.extraAttackCount) {
                return;
            }
            player.extraAttackCount += count;
            if (player.log)
                player.log(time, `Gained ${count} extra attacks from ${name}`);
        });
    }
}
export class SpellBuff extends Spell {
    constructor(buff, cooldown) {
        super(`SpellBuff(${buff.name})`, false, 0, cooldown || 0, (player, time) => {
            player.buffManager.add(buff, time);
        });
    }
}
export class Proc {
    constructor(spell, rate) {
        this.spell = spell;
        this.rate = rate;
    }
    run(player, weapon, time) {
        const chance = this.rate.chance || this.rate.ppm * weapon.speed / 60;
        if (Math.random() <= chance) {
            this.spell.cast(player, time);
        }
    }
}
//# sourceMappingURL=spell.js.map