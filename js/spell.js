import { urand } from "./math.js";
export var SpellFamily;
(function (SpellFamily) {
    SpellFamily[SpellFamily["NONE"] = 0] = "NONE";
    SpellFamily[SpellFamily["WARRIOR"] = 1] = "WARRIOR";
})(SpellFamily || (SpellFamily = {}));
export class Spell {
    constructor(name, type, family, is_gcd, cost, cooldown, spellF) {
        this.canProc = true;
        this.name = name;
        this.type = type;
        this.family = family;
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
    timeRemaining(time) {
        return Math.max(0, (this.cooldown - time) / 1000);
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
            this.caster.nextGCDTime = time + 1500 + this.caster.latency;
        }
        this.caster.power -= this.spell.cost;
        this.spell.cast(this.caster, time);
        this.cooldown = time + this.spell.cooldown * 1000 + this.caster.latency;
        return true;
    }
}
export class SwingSpell extends Spell {
    constructor(name, family, bonusDamage, cost) {
        super(name, SpellType.PHYSICAL_WEAPON, family, false, cost, 0, () => { });
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
    SpellType[SpellType["NONE"] = 0] = "NONE";
    SpellType[SpellType["BUFF"] = 1] = "BUFF";
    SpellType[SpellType["PHYSICAL"] = 2] = "PHYSICAL";
    SpellType[SpellType["PHYSICAL_WEAPON"] = 3] = "PHYSICAL_WEAPON";
    SpellType[SpellType["MAGIC"] = 4] = "MAGIC";
})(SpellType || (SpellType = {}));
export class SpellDamage extends Spell {
    constructor(name, amount, type, family, is_gcd = false, cost = 0, cooldown = 0, callback) {
        super(name, type, family, is_gcd, cost, cooldown, (player, time) => {
            const dmg = (amount instanceof Function) ? amount(player) : (Array.isArray(amount) ? urand(...amount) : amount);
            if (type === SpellType.PHYSICAL || type === SpellType.PHYSICAL_WEAPON) {
                player.dealMeleeDamage(time, dmg, player.target, true, this);
            }
            else if (type === SpellType.MAGIC) {
                player.dealSpellDamage(time, dmg, player.target, this);
            }
        });
        this.callback = callback;
    }
}
export class ItemSpellDamage extends SpellDamage {
    constructor(name, amount, type) {
        super(name, amount, type, SpellFamily.NONE);
        this.canProc = false;
    }
}
export class ExtraAttack extends Spell {
    constructor(name, count) {
        super(name, SpellType.NONE, SpellFamily.NONE, false, 0, 0, (player, time) => {
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
    constructor(buff, is_gcd = false, cost = 0, cooldown = 0) {
        super(`SpellBuff(${buff.name})`, SpellType.BUFF, SpellFamily.NONE, is_gcd, cost, cooldown, (player, time) => {
            player.buffManager.add(buff, time);
        });
        this.buff = buff;
    }
}
export class Proc {
    constructor(spell, rate) {
        this.spells = Array.isArray(spell) ? spell : [spell];
        this.rate = rate;
    }
    run(player, weapon, time) {
        const chance = this.rate.chance || this.rate.ppm * weapon.speed / 60;
        if (Math.random() <= chance) {
            for (let spell of this.spells) {
                spell.cast(player, time);
            }
        }
    }
}
//# sourceMappingURL=spell.js.map