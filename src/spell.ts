import { Player, MeleeHitOutcome } from "./player.js";
import { Buff } from "./buff.js";
import { WeaponDescription } from "./item.js";
import { urand } from "./math.js";

export enum EffectFamily {
    NONE,
    WARRIOR,
}

export enum EffectType {
    NONE,
    BUFF,
    PHYSICAL,
    PHYSICAL_WEAPON,
    MAGIC,
}

interface NamedObject {
    name: string;
}

export class Effect {
    type: EffectType;
    family: EffectFamily;
    parent?: NamedObject;

    canProc = true;

    constructor(type: EffectType, family = EffectFamily.NONE) {
        this.type = type;
        this.family = family;
    }

    run(player: Player, time: number) {}
}

export class Spell {
    name: string;
    is_gcd: boolean;
    cost: number;
    cooldown: number;
    protected effects: Effect[];

    constructor(name: string, is_gcd: boolean, cost: number, cooldown: number, effects: Effect | Effect[]) {
        this.name = name;
        this.cost = cost;
        this.cooldown = cooldown;
        this.is_gcd = is_gcd;
        this.effects = Array.isArray(effects) ? effects : [effects];

        for (let effect of this.effects) {
            effect.parent = this; // currently only used for logging. don't really want to do this
        }
    }

    cast(player: Player, time: number) {
        for (let effect of this.effects) {
            effect.run(player, time);
        }
    }
}

export class LearnedSpell {
    spell: Spell;
    cooldown = 0;
    caster: Player;

    constructor(spell: Spell, caster: Player) {
        this.spell = spell;
        this.caster = caster;
    }

    onCooldown(time: number): boolean {
        return this.cooldown > time;
    }

    timeRemaining(time: number) {
        return Math.max(0, (this.cooldown - time) / 1000);
    }

    canCast(time: number): boolean {
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

    cast(time: number): boolean {
        if (!this.canCast(time)) {
            return false;
        }

        if (this.spell.is_gcd) {
            this.caster.nextGCDTime = time + 1500 + this.caster.latency; // TODO - need to study the effects of latency in the game and consider human precision
        }
        
        this.caster.power -= this.spell.cost;

        this.spell.cast(this.caster, time);

        this.cooldown = time + this.spell.cooldown * 1000 + this.caster.latency;

        return true;
    }
}

export class ModifyPowerEffect extends Effect {
    amount: number;

    constructor(amount: number) {
        super(EffectType.NONE);
        this.amount = amount;
    }
    
    run(player: Player, time: number) {
        player.power += this.amount;
        if (player.log) player.log(time, `You gain ${this.amount} rage from ${this.parent!.name}`);
    }
}

export class SwingEffect extends Effect {
    bonusDamage: number;

    constructor(bonusDamage: number, family?: EffectFamily) {
        super(EffectType.PHYSICAL_WEAPON, family);
        this.bonusDamage = bonusDamage;
    }

    run(player: Player, time: number) {
        const is_mh = true;
        const rawDamage = player.calculateSwingRawDamage(is_mh);
        player.dealMeleeDamage(time, rawDamage + this.bonusDamage, player.target!, is_mh, this);
    }
}

export class SwingSpell extends Spell {

    constructor(name: string, family: EffectFamily, bonusDamage: number, cost: number) {
        super(name, false, cost, 0, new SwingEffect(bonusDamage, family));
    }
}

export class LearnedSwingSpell extends LearnedSpell {
    spell: SwingSpell;
    
    constructor(spell: SwingSpell, caster: Player) {
        super(spell, caster);
        this.spell = spell; // TODO - is there a way to avoid this line?
    }
}

export type SpellHitOutcomeCallback = (player: Player, hitOutcome: MeleeHitOutcome) => void;

type SpellDamageAmount = number|[number, number]|((player: Player) => number);

export class SpellDamageEffect extends Effect {
    callback?: SpellHitOutcomeCallback;
    amount: SpellDamageAmount;

    constructor(type: EffectType, family: EffectFamily, amount: SpellDamageAmount, callback?: SpellHitOutcomeCallback) {
        super(type, family);
        this.amount = amount;
        this.callback = callback;
    }

    private calculateAmount(player: Player) {
        return (this.amount instanceof Function) ? this.amount(player) : (Array.isArray(this.amount) ? urand(...this.amount) :this.amount)
    }

    run(player: Player, time: number) {            
        if (this.type === EffectType.PHYSICAL || this.type === EffectType.PHYSICAL_WEAPON) {
            player.dealMeleeDamage(time, this.calculateAmount(player), player.target!, true, this);
        } else if (this.type === EffectType.MAGIC) {
            player.dealSpellDamage(time, this.calculateAmount(player), player.target!, this);
        }
    }
}

export class SpellDamage extends Spell {
    constructor(name: string, amount: SpellDamageAmount, type: EffectType, family = EffectFamily.NONE, is_gcd = false, cost = 0, cooldown = 0, callback?: SpellHitOutcomeCallback) {
        super(name, is_gcd, cost, cooldown, new SpellDamageEffect(type, family, amount, callback));
    }
}

export class ItemSpellDamage extends SpellDamage {
    canProc = false; // TODO - confirm this is blizzlike, also some item procs may be able to proc but on LH core, fatal wound can't

    constructor(name: string, amount: SpellDamageAmount, type: EffectType) {
        super(name, amount, type, EffectFamily.NONE);
    }
}

export class ExtraAttackEffect extends Effect {
    count: number;

    constructor(count: number) {
        super(EffectType.NONE);
        this.count = count;
    }

    run(player: Player, time: number) {
        if (player.extraAttackCount) {
            // can't proc extra attack during an extra attack
            return;
        }

        player.extraAttackCount += this.count; // LH code does not allow multiple auto attacks to stack if they proc together. Blizzlike may allow them to stack 
        if (player.log) player.log(time, `Gained ${this.count} extra attacks from ${this.parent!.name}`);
    }
}

export class ExtraAttack extends Spell {
    constructor(name: string, count: number) {
        // spelltype doesn't matter
        super(name, false, 0, 0, new ExtraAttackEffect(count));
    }
}

export class SpellBuffEffect extends Effect {
    buff: Buff;

    constructor(buff: Buff) {
        super(EffectType.BUFF);
        this.buff = buff;
    }

    run(player: Player, time: number) {
        player.buffManager.add(this.buff, time);
    }
}

export class SpellBuff extends Spell {
    buff: Buff;

    constructor(buff: Buff, is_gcd = false, cost = 0, cooldown = 0) {
        super(`SpellBuff(${buff.name})`, is_gcd, cost, cooldown, new SpellBuffEffect(buff));
        this.buff = buff;
    }
}

type ppm = {ppm: number};
type chance = {chance: number};
type rate = ppm | chance;

export class Proc {
    protected spells: Spell[];
    protected rate: rate;

    constructor(spell: Spell | Spell[], rate: rate) {
        this.spells = Array.isArray(spell) ? spell : [spell];
        this.rate = rate;
    }

    run(player: Player, weapon: WeaponDescription, time: number) {
        const chance = (<chance>this.rate).chance || (<ppm>this.rate).ppm * weapon.speed / 60;

        if (Math.random() <= chance) {
            for (let spell of this.spells) {
                spell.cast(player, time);
            }
        }
    }
}
