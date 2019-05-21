import { urand } from "./math.js";
export var EffectFamily;
(function (EffectFamily) {
    EffectFamily[EffectFamily["NONE"] = 0] = "NONE";
    EffectFamily[EffectFamily["WARRIOR"] = 1] = "WARRIOR";
})(EffectFamily || (EffectFamily = {}));
export var EffectType;
(function (EffectType) {
    EffectType[EffectType["NONE"] = 0] = "NONE";
    EffectType[EffectType["BUFF"] = 1] = "BUFF";
    EffectType[EffectType["PHYSICAL"] = 2] = "PHYSICAL";
    EffectType[EffectType["PHYSICAL_WEAPON"] = 3] = "PHYSICAL_WEAPON";
    EffectType[EffectType["MAGIC"] = 4] = "MAGIC";
})(EffectType || (EffectType = {}));
export class Effect {
    constructor(type, family = EffectFamily.NONE) {
        this.canProc = true;
        this.type = type;
        this.family = family;
    }
    run(player, time) { }
}
export class Spell {
    constructor(name, is_gcd, cost, cooldown, effects) {
        this.name = name;
        this.cost = cost;
        this.cooldown = cooldown;
        this.is_gcd = is_gcd;
        this.effects = Array.isArray(effects) ? effects : [effects];
        for (let effect of this.effects) {
            effect.parent = this;
        }
    }
    cast(player, time) {
        for (let effect of this.effects) {
            effect.run(player, time);
        }
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
export class ModifyPowerEffect extends Effect {
    constructor(amount) {
        super(EffectType.NONE);
        this.amount = amount;
    }
    run(player, time) {
        player.power += this.amount;
        if (player.log)
            player.log(time, `You gain ${this.amount} rage from ${this.parent.name}`);
    }
}
export class SwingEffect extends Effect {
    constructor(bonusDamage, family) {
        super(EffectType.PHYSICAL_WEAPON, family);
        this.bonusDamage = bonusDamage;
    }
    run(player, time) {
        const is_mh = true;
        const rawDamage = player.calculateSwingRawDamage(is_mh);
        player.dealMeleeDamage(time, rawDamage + this.bonusDamage, player.target, is_mh, this);
    }
}
export class SwingSpell extends Spell {
    constructor(name, family, bonusDamage, cost) {
        super(name, false, cost, 0, new SwingEffect(bonusDamage, family));
    }
}
export class LearnedSwingSpell extends LearnedSpell {
    constructor(spell, caster) {
        super(spell, caster);
        this.spell = spell;
    }
}
export class SpellDamageEffect extends Effect {
    constructor(type, family, amount, callback) {
        super(type, family);
        this.amount = amount;
        this.callback = callback;
    }
    calculateAmount(player) {
        return (this.amount instanceof Function) ? this.amount(player) : (Array.isArray(this.amount) ? urand(...this.amount) : this.amount);
    }
    run(player, time) {
        if (this.type === EffectType.PHYSICAL || this.type === EffectType.PHYSICAL_WEAPON) {
            player.dealMeleeDamage(time, this.calculateAmount(player), player.target, true, this);
        }
        else if (this.type === EffectType.MAGIC) {
            player.dealSpellDamage(time, this.calculateAmount(player), player.target, this);
        }
    }
}
export class SpellDamage extends Spell {
    constructor(name, amount, type, family = EffectFamily.NONE, is_gcd = false, cost = 0, cooldown = 0, callback) {
        super(name, is_gcd, cost, cooldown, new SpellDamageEffect(type, family, amount, callback));
    }
}
export class ItemSpellDamage extends SpellDamage {
    constructor(name, amount, type) {
        super(name, amount, type, EffectFamily.NONE);
        this.canProc = false;
    }
}
export class ExtraAttackEffect extends Effect {
    constructor(count) {
        super(EffectType.NONE);
        this.count = count;
    }
    run(player, time) {
        if (player.extraAttackCount) {
            return;
        }
        player.extraAttackCount += this.count;
        if (player.log)
            player.log(time, `Gained ${this.count} extra attacks from ${this.parent.name}`);
    }
}
export class ExtraAttack extends Spell {
    constructor(name, count) {
        super(name, false, 0, 0, new ExtraAttackEffect(count));
    }
}
export class SpellBuffEffect extends Effect {
    constructor(buff) {
        super(EffectType.BUFF);
        this.buff = buff;
    }
    run(player, time) {
        player.buffManager.add(this.buff, time);
    }
}
export class SpellBuff extends Spell {
    constructor(buff, is_gcd = false, cost = 0, cooldown = 0) {
        super(`SpellBuff(${buff.name})`, is_gcd, cost, cooldown, new SpellBuffEffect(buff));
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