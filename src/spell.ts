import { Player, MeleeHitOutcome } from "./player.js";
import { Buff } from "./buff.js";
import { WeaponDescription } from "./item.js";
import { urand } from "./math.js";

export enum SpellFamily {
    NONE,
    WARRIOR,
}

export class Spell {
    name: string;
    type: SpellType;
    family: SpellFamily;
    is_gcd: boolean;
    cost: number;
    cooldown: number;
    protected spellF: (player: Player, time: number) => void;

    canProc = true;

    constructor(name: string, type: SpellType, family: SpellFamily, is_gcd: boolean, cost: number, cooldown: number, spellF: (player: Player, time: number) => void) {
        this.name = name;
        this.type = type;
        this.family = family;
        this.cost = cost;
        this.cooldown = cooldown;
        this.is_gcd = is_gcd;
        this.spellF = spellF;
    }

    cast(player: Player, time: number) {
        return this.spellF(player, time);
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

export class SwingSpell extends Spell {
    bonusDamage: number;

    constructor(name: string, family: SpellFamily, bonusDamage: number, cost: number) {
        super(name, SpellType.PHYSICAL_WEAPON, family, false, cost, 0, () => {});
        this.bonusDamage = bonusDamage;
    }
}

export class LearnedSwingSpell extends LearnedSpell {
    spell: SwingSpell;
    
    constructor(spell: SwingSpell, caster: Player) {
        super(spell, caster);
        this.spell = spell; // TODO - is there a way to avoid this line?
    }
}

export enum SpellType {
    NONE,
    BUFF,
    PHYSICAL,
    PHYSICAL_WEAPON,
    MAGIC,
}

export type SpellHitOutcomeCallback = (player: Player, hitOutcome: MeleeHitOutcome) => void;

export class SpellDamage extends Spell {
    callback?: SpellHitOutcomeCallback;

    constructor(name: string, amount: number|[number, number]|((player: Player) => number), type: SpellType, family: SpellFamily, is_gcd = false, cost = 0, cooldown = 0, callback?: SpellHitOutcomeCallback) {
        super(name, type, family, is_gcd, cost, cooldown, (player: Player, time: number) => {
            const dmg = (amount instanceof Function) ? amount(player) : (Array.isArray(amount) ? urand(...amount) : amount);
            
            if (type === SpellType.PHYSICAL || type === SpellType.PHYSICAL_WEAPON) {
                player.dealMeleeDamage(time, dmg, player.target!, true, this);
            } else if (type === SpellType.MAGIC) {
                player.dealSpellDamage(time, dmg, player.target!, this);
            }
        });

        this.callback = callback;
    }
}

export class ItemSpellDamage extends SpellDamage {
    canProc = false; // TODO - confirm this is blizzlike, also some item procs may be able to proc but on LH core, fatal wound can't

    constructor(name: string, amount: number|((player: Player) => number), type: SpellType) {
        super(name, amount, type, SpellFamily.NONE);
    }
}

export class ExtraAttack extends Spell {
    constructor(name: string, count: number) {
        // spelltype doesn't matter
        super(name, SpellType.NONE, SpellFamily.NONE, false, 0, 0, (player: Player, time: number) => {
            if (player.extraAttackCount) {
                return;
            }
            player.extraAttackCount += count; // LH code does not allow multiple auto attacks to stack if they proc together. Blizzlike may allow them to stack 
            if (player.log) player.log(time, `Gained ${count} extra attacks from ${name}`);
        });
    }
}

export class SpellBuff extends Spell {
    buff: Buff;

    constructor(buff: Buff, is_gcd = false, cost = 0, cooldown = 0) {
        super(`SpellBuff(${buff.name})`, SpellType.BUFF, SpellFamily.NONE, is_gcd, cost, cooldown, (player: Player, time: number) => {
            player.buffManager.add(buff, time);
        });
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
