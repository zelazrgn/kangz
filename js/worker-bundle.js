class WorkerEventInterface {
    constructor(target) {
        this.eventListeners = new Map();
        target.onmessage = (ev) => {
            const eventListenersForEvent = this.eventListeners.get(ev.data.event) || [];
            for (let listener of eventListenersForEvent) {
                listener(ev.data.data);
            }
        };
    }
    addEventListener(event, listener) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).push(listener);
        }
        else {
            this.eventListeners.set(event, [listener]);
        }
    }
    removeEventListener(event, listenerToRemove) {
        if (this.eventListeners.has(event)) {
            let eventListenersForEvent = this.eventListeners.get(event);
            if (eventListenersForEvent) {
                this.eventListeners.set(event, eventListenersForEvent.filter((listener) => {
                    return listener !== listenerToRemove;
                }));
            }
        }
    }
    removeEventListenersForEvent(event) {
        this.eventListeners.delete(event);
    }
    send(event, data, target = self) {
        target.postMessage({
            event: event,
            data: data
        });
    }
}
class MainThreadInterface extends WorkerEventInterface {
    constructor() {
        super(self);
    }
    static get instance() {
        if (!MainThreadInterface._instance) {
            MainThreadInterface._instance = new MainThreadInterface();
        }
        return MainThreadInterface._instance;
    }
}

class Stats {
    constructor(s) {
        this.set(s);
    }
    set(s) {
        this.ap = (s && s.ap) || 0;
        this.str = (s && s.str) || 0;
        this.agi = (s && s.agi) || 0;
        this.hit = (s && s.hit) || 0;
        this.crit = (s && s.crit) || 0;
        this.haste = (s && s.haste) || 1;
        this.statMult = (s && s.statMult) || 1;
        this.damageMult = (s && s.damageMult) || 1;
        this.armorPenetration = (s && s.armorPenetration) || 0;
        this.plusDamage = (s && s.plusDamage) || 0;
        this.swordSkill = (s && s.swordSkill) || 0;
        this.axeSkill = (s && s.axeSkill) || 0;
        this.maceSkill = (s && s.maceSkill) || 0;
        this.daggerSkill = (s && s.daggerSkill) || 0;
        this.sword2HSkill = (s && s.sword2HSkill) || 0;
        this.axe2HSkill = (s && s.axe2HSkill) || 0;
        this.mace2HSkill = (s && s.mace2HSkill) || 0;
        return this;
    }
    add(s) {
        this.ap += (s.ap || 0);
        this.str += (s.str || 0);
        this.agi += (s.agi || 0);
        this.hit += (s.hit || 0);
        this.crit += (s.crit || 0);
        this.haste *= (s.haste || 1);
        this.statMult *= (s.statMult || 1);
        this.damageMult *= (s.damageMult || 1);
        this.armorPenetration += (s.armorPenetration || 0);
        this.plusDamage += (s.plusDamage || 0);
        this.swordSkill += (s.swordSkill || 0);
        this.axeSkill += (s.axeSkill || 0);
        this.maceSkill += (s.maceSkill || 0);
        this.daggerSkill += (s.daggerSkill || 0);
        this.sword2HSkill += (s.sword2HSkill || 0);
        this.axe2HSkill += (s.axe2HSkill || 0);
        this.mace2HSkill += (s.mace2HSkill || 0);
        return this;
    }
}

class BuffManager {
    constructor(player, baseStats) {
        this.buffList = [];
        this.buffOverTimeList = [];
        this.player = player;
        this.baseStats = new Stats(baseStats);
        this.stats = new Stats(this.baseStats);
    }
    get nextOverTimeUpdate() {
        let res = Number.MAX_SAFE_INTEGER;
        for (let buffOTApp of this.buffOverTimeList) {
            res = Math.min(res, buffOTApp.nextUpdate);
        }
        return res;
    }
    update(time) {
        for (let buffOTApp of this.buffOverTimeList) {
            buffOTApp.update(time);
        }
        this.removeExpiredBuffs(time);
        this.stats.set(this.baseStats);
        for (let { buff, stacks } of this.buffList) {
            stacks = buff.statsStack ? stacks : 1;
            for (let i = 0; i < stacks; i++) {
                buff.apply(this.stats, this.player);
            }
        }
        for (let { buff, stacks } of this.buffOverTimeList) {
            stacks = buff.statsStack ? stacks : 1;
            for (let i = 0; i < stacks; i++) {
                buff.apply(this.stats, this.player);
            }
        }
    }
    add(buff, applyTime) {
        for (let buffApp of this.buffList) {
            if (buffApp.buff === buff) {
                if (buff.stacks) {
                    const logStackIncrease = this.player.log && (!buff.maxStacks || buffApp.stacks < buff.maxStacks);
                    if (buff.initialStacks) {
                        buffApp.refresh(applyTime);
                    }
                    else {
                        buffApp.stacks++;
                    }
                    if (logStackIncrease) {
                        this.player.log(applyTime, `${buff.name} refreshed (${buffApp.stacks})`);
                    }
                }
                else {
                    if (this.player.log)
                        this.player.log(applyTime, `${buff.name} refreshed`);
                    buffApp.refresh(applyTime);
                }
                return;
            }
        }
        if (this.player.log)
            this.player.log(applyTime, `${buff.name} gained` + (buff.stacks ? ` (${buff.initialStacks || 1})` : ''));
        if (buff instanceof BuffOverTime) {
            this.buffOverTimeList.push(new BuffOverTimeApplication(this.player, buff, applyTime));
        }
        else {
            this.buffList.push(new BuffApplication(buff, applyTime));
        }
        buff.add(applyTime, this.player);
    }
    remove(buff, time, full = false) {
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.buff === buff) {
                if (!full && buff.stacks) {
                    buffapp.stacks -= 1;
                    if (this.player.log)
                        this.player.log(time, `${buff.name} (${buffapp.stacks})`);
                    if (buffapp.stacks > 0) {
                        return true;
                    }
                }
                if (this.player.log)
                    this.player.log(time, `${buff.name} lost`);
                buffapp.buff.remove(time, this.player);
                return false;
            }
            return true;
        });
        this.buffOverTimeList = this.buffOverTimeList.filter((buffapp) => {
            if (buffapp.buff === buff) {
                if (buff.stacks) {
                    buffapp.stacks -= 1;
                    if (this.player.log)
                        this.player.log(time, `${buff.name} (${buffapp.stacks})`);
                    if (buffapp.stacks > 0) {
                        return true;
                    }
                }
                if (this.player.log)
                    this.player.log(time, `${buff.name} lost`);
                buffapp.buff.remove(time, this.player);
                return false;
            }
            return true;
        });
    }
    removeExpiredBuffs(time) {
        const removedBuffs = [];
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.expirationTime <= time) {
                removedBuffs.push(buffapp.buff);
                return false;
            }
            return true;
        });
        this.buffOverTimeList = this.buffOverTimeList.filter((buffapp) => {
            if (buffapp.expirationTime <= time) {
                removedBuffs.push(buffapp.buff);
                return false;
            }
            return true;
        });
        for (let buff of removedBuffs) {
            buff.remove(time, this.player);
            if (this.player.log)
                this.player.log(time, `${buff.name} expired`);
        }
    }
}
class Buff {
    constructor(name, duration, stats, stacks, initialStacks, maxStacks, child, statsStack = true) {
        this.name = name;
        this.duration = duration;
        this.stats = stats;
        this.stacks = !!stacks;
        this.initialStacks = initialStacks;
        this.maxStacks = maxStacks;
        this.child = child;
        this.statsStack = statsStack;
    }
    apply(stats, player) {
        if (this.stats) {
            stats.add(this.stats);
        }
    }
    add(time, player) { }
    remove(time, player) {
        if (this.child) {
            player.buffManager.remove(this.child, time, true);
        }
    }
}
class BuffApplication {
    constructor(buff, applyTime) {
        this.buff = buff;
        this.refresh(applyTime);
    }
    refresh(time) {
        this.stacks = this.buff.initialStacks || 1;
        this.expirationTime = time + this.buff.duration * 1000;
        if (this.buff.duration > 60) {
            this.expirationTime = Number.MAX_SAFE_INTEGER;
        }
    }
    get stacks() {
        return this.stacksVal;
    }
    set stacks(stacks) {
        this.stacksVal = this.buff.maxStacks ? Math.min(this.buff.maxStacks, stacks) : stacks;
    }
}
class BuffOverTime extends Buff {
    constructor(name, duration, stats, updateInterval, effect) {
        super(name, duration, stats);
        this.updateInterval = updateInterval;
        effect.parent = this;
        this.effect = effect;
    }
    run(player, time) {
        this.effect.run(player, time);
    }
}
class BuffOverTimeApplication extends BuffApplication {
    constructor(player, buff, applyTime) {
        super(buff, applyTime);
        this.buff = buff;
        this.player = player;
        this.refresh(applyTime);
    }
    refresh(time) {
        super.refresh(time);
        this.nextUpdate = time + this.buff.updateInterval;
    }
    update(time) {
        if (time >= this.nextUpdate) {
            this.nextUpdate += this.buff.updateInterval;
            this.buff.run(this.player, time);
        }
    }
}
class BuffProc extends Buff {
    constructor(name, duration, proc, child) {
        super(name, duration, undefined, undefined, undefined, undefined, child);
        this.proc = proc;
    }
    add(time, player) {
        super.add(time, player);
        player.addProc(this.proc);
    }
    remove(time, player) {
        super.remove(time, player);
        player.removeProc(this.proc);
    }
}

function urand(min, max) {
    return min + Math.round(Math.random() * (max - min));
}
function frand(min, max) {
    return min + Math.random() * (max - min);
}
function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

var EffectFamily;
(function (EffectFamily) {
    EffectFamily[EffectFamily["NONE"] = 0] = "NONE";
    EffectFamily[EffectFamily["WARRIOR"] = 1] = "WARRIOR";
})(EffectFamily || (EffectFamily = {}));
var EffectType;
(function (EffectType) {
    EffectType[EffectType["NONE"] = 0] = "NONE";
    EffectType[EffectType["BUFF"] = 1] = "BUFF";
    EffectType[EffectType["PHYSICAL"] = 2] = "PHYSICAL";
    EffectType[EffectType["PHYSICAL_WEAPON"] = 3] = "PHYSICAL_WEAPON";
    EffectType[EffectType["MAGIC"] = 4] = "MAGIC";
})(EffectType || (EffectType = {}));
class Effect {
    constructor(type, family = EffectFamily.NONE) {
        this.canProc = true;
        this.type = type;
        this.family = family;
    }
    run(player, time) { }
}
class Spell {
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
class LearnedSpell {
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
class ModifyPowerEffect extends Effect {
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
class SwingEffect extends Effect {
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
class SwingSpell extends Spell {
    constructor(name, family, bonusDamage, cost) {
        super(name, false, cost, 0, new SwingEffect(bonusDamage, family));
    }
}
class LearnedSwingSpell extends LearnedSpell {
    constructor(spell, caster) {
        super(spell, caster);
        this.spell = spell;
    }
}
class SpellDamageEffect extends Effect {
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
class SpellDamage extends Spell {
    constructor(name, amount, type, family = EffectFamily.NONE, is_gcd = false, cost = 0, cooldown = 0, callback) {
        super(name, is_gcd, cost, cooldown, new SpellDamageEffect(type, family, amount, callback));
    }
}
class ItemSpellDamage extends SpellDamage {
    constructor(name, amount, type) {
        super(name, amount, type, EffectFamily.NONE);
        this.canProc = false;
    }
}
class ExtraAttackEffect extends Effect {
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
class ExtraAttack extends Spell {
    constructor(name, count) {
        super(name, false, 0, 0, new ExtraAttackEffect(count));
    }
}
class SpellBuffEffect extends Effect {
    constructor(buff) {
        super(EffectType.BUFF);
        this.buff = buff;
    }
    run(player, time) {
        player.buffManager.add(this.buff, time);
    }
}
class SpellBuff extends Spell {
    constructor(buff, is_gcd = false, cost = 0, cooldown = 0) {
        super(`SpellBuff(${buff.name})`, is_gcd, cost, cooldown, new SpellBuffEffect(buff));
        this.buff = buff;
    }
}
class Proc {
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

var ItemSlot;
(function (ItemSlot) {
    ItemSlot[ItemSlot["MAINHAND"] = 1] = "MAINHAND";
    ItemSlot[ItemSlot["OFFHAND"] = 2] = "OFFHAND";
    ItemSlot[ItemSlot["TRINKET1"] = 4] = "TRINKET1";
    ItemSlot[ItemSlot["TRINKET2"] = 8] = "TRINKET2";
    ItemSlot[ItemSlot["HEAD"] = 16] = "HEAD";
    ItemSlot[ItemSlot["NECK"] = 32] = "NECK";
    ItemSlot[ItemSlot["SHOULDER"] = 64] = "SHOULDER";
    ItemSlot[ItemSlot["BACK"] = 128] = "BACK";
    ItemSlot[ItemSlot["CHEST"] = 256] = "CHEST";
    ItemSlot[ItemSlot["WRIST"] = 512] = "WRIST";
    ItemSlot[ItemSlot["HANDS"] = 1024] = "HANDS";
    ItemSlot[ItemSlot["WAIST"] = 2048] = "WAIST";
    ItemSlot[ItemSlot["LEGS"] = 4096] = "LEGS";
    ItemSlot[ItemSlot["FEET"] = 8192] = "FEET";
    ItemSlot[ItemSlot["RING1"] = 16384] = "RING1";
    ItemSlot[ItemSlot["RING2"] = 32768] = "RING2";
    ItemSlot[ItemSlot["RANGED"] = 65536] = "RANGED";
})(ItemSlot || (ItemSlot = {}));
const itemSlotHasEnchant = {
    [ItemSlot.MAINHAND]: true,
    [ItemSlot.OFFHAND]: true,
    [ItemSlot.TRINKET1]: false,
    [ItemSlot.TRINKET2]: false,
    [ItemSlot.HEAD]: true,
    [ItemSlot.NECK]: false,
    [ItemSlot.SHOULDER]: true,
    [ItemSlot.BACK]: true,
    [ItemSlot.CHEST]: true,
    [ItemSlot.WRIST]: true,
    [ItemSlot.HANDS]: true,
    [ItemSlot.WAIST]: false,
    [ItemSlot.LEGS]: true,
    [ItemSlot.FEET]: true,
    [ItemSlot.RING1]: false,
    [ItemSlot.RING2]: false,
    [ItemSlot.RANGED]: false,
};
const itemSlotHasTemporaryEnchant = {
    [ItemSlot.MAINHAND]: true,
    [ItemSlot.OFFHAND]: true,
    [ItemSlot.TRINKET1]: false,
    [ItemSlot.TRINKET2]: false,
    [ItemSlot.HEAD]: false,
    [ItemSlot.NECK]: false,
    [ItemSlot.SHOULDER]: false,
    [ItemSlot.BACK]: false,
    [ItemSlot.CHEST]: false,
    [ItemSlot.WRIST]: false,
    [ItemSlot.HANDS]: false,
    [ItemSlot.WAIST]: false,
    [ItemSlot.LEGS]: false,
    [ItemSlot.FEET]: false,
    [ItemSlot.RING1]: false,
    [ItemSlot.RING2]: false,
    [ItemSlot.RANGED]: false,
};
var WeaponType;
(function (WeaponType) {
    WeaponType[WeaponType["MACE"] = 0] = "MACE";
    WeaponType[WeaponType["SWORD"] = 1] = "SWORD";
    WeaponType[WeaponType["AXE"] = 2] = "AXE";
    WeaponType[WeaponType["DAGGER"] = 3] = "DAGGER";
    WeaponType[WeaponType["MACE2H"] = 4] = "MACE2H";
    WeaponType[WeaponType["SWORD2H"] = 5] = "SWORD2H";
    WeaponType[WeaponType["AXE2H"] = 6] = "AXE2H";
})(WeaponType || (WeaponType = {}));
const normalizedWeaponSpeed = {
    [WeaponType.MACE]: 2.4,
    [WeaponType.SWORD]: 2.4,
    [WeaponType.AXE]: 2.4,
    [WeaponType.DAGGER]: 1.7,
    [WeaponType.MACE2H]: 3.3,
    [WeaponType.SWORD2H]: 3.3,
    [WeaponType.AXE2H]: 3.3,
};
function isWeapon(item) {
    return "speed" in item;
}
function isEquipedWeapon(item) {
    return "weapon" in item;
}
class ItemEquiped {
    constructor(item, player) {
        this.item = item;
        if (item.onuse) {
            this.onuse = new LearnedSpell(item.onuse, player);
        }
        if (item.onequip) {
            player.addProc(item.onequip);
        }
    }
    use(time) {
        if (this.onuse) {
            this.onuse.cast(time);
        }
    }
}
class WeaponEquiped extends ItemEquiped {
    constructor(item, player, enchant, temporaryEnchant) {
        super(item, player);
        this.procs = [];
        this.weapon = item;
        if (item.onhit) {
            this.addProc(item.onhit);
        }
        if (enchant && enchant.proc) {
            this.addProc(enchant.proc);
        }
        this.player = player;
        this.temporaryEnchant = temporaryEnchant;
        this.nextSwingTime = 100;
    }
    get plusDamage() {
        if (this.temporaryEnchant && this.temporaryEnchant.stats && this.temporaryEnchant.stats.plusDamage) {
            return this.temporaryEnchant.stats.plusDamage;
        }
        else {
            return 0;
        }
    }
    get min() {
        return this.weapon.min + this.plusDamage;
    }
    get max() {
        return this.weapon.max + this.plusDamage;
    }
    addProc(p) {
        this.procs.push(p);
    }
    proc(time) {
        for (let proc of this.procs) {
            proc.run(this.player, this.weapon, time);
        }
        if (this.temporaryEnchant && this.temporaryEnchant.proc) {
            this.temporaryEnchant.proc.run(this.player, this.weapon, time);
        }
    }
}

class Unit {
    constructor(level, armor) {
        this.level = level;
        this.armor = armor;
    }
    get maxSkillForLevel() {
        return this.level * 5;
    }
    get defenseSkill() {
        return this.maxSkillForLevel;
    }
    get dodgeChance() {
        return 5;
    }
    calculateArmorReducedDamage(damage, attacker) {
        const armor = Math.max(0, this.armor - attacker.buffManager.stats.armorPenetration);
        let tmpvalue = 0.1 * armor / ((8.5 * attacker.level) + 40);
        tmpvalue /= (1 + tmpvalue);
        const armorModifier = clamp(tmpvalue, 0, 0.75);
        return Math.max(1, damage - (damage * armorModifier));
    }
}

var Race;
(function (Race) {
    Race[Race["HUMAN"] = 0] = "HUMAN";
    Race[Race["ORC"] = 1] = "ORC";
})(Race || (Race = {}));
var Faction;
(function (Faction) {
    Faction[Faction["ALLIANCE"] = 0] = "ALLIANCE";
    Faction[Faction["HORDE"] = 1] = "HORDE";
})(Faction || (Faction = {}));
var MeleeHitOutcome;
(function (MeleeHitOutcome) {
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_EVADE"] = 0] = "MELEE_HIT_EVADE";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_MISS"] = 1] = "MELEE_HIT_MISS";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_DODGE"] = 2] = "MELEE_HIT_DODGE";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_BLOCK"] = 3] = "MELEE_HIT_BLOCK";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_PARRY"] = 4] = "MELEE_HIT_PARRY";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_GLANCING"] = 5] = "MELEE_HIT_GLANCING";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_CRIT"] = 6] = "MELEE_HIT_CRIT";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_CRUSHING"] = 7] = "MELEE_HIT_CRUSHING";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_NORMAL"] = 8] = "MELEE_HIT_NORMAL";
    MeleeHitOutcome[MeleeHitOutcome["MELEE_HIT_BLOCK_CRIT"] = 9] = "MELEE_HIT_BLOCK_CRIT";
})(MeleeHitOutcome || (MeleeHitOutcome = {}));
const hitOutcomeString = {
    [MeleeHitOutcome.MELEE_HIT_EVADE]: 'evade',
    [MeleeHitOutcome.MELEE_HIT_MISS]: 'misses',
    [MeleeHitOutcome.MELEE_HIT_DODGE]: 'is dodged',
    [MeleeHitOutcome.MELEE_HIT_BLOCK]: 'is blocked',
    [MeleeHitOutcome.MELEE_HIT_PARRY]: 'is parried',
    [MeleeHitOutcome.MELEE_HIT_GLANCING]: 'glances',
    [MeleeHitOutcome.MELEE_HIT_CRIT]: 'crits',
    [MeleeHitOutcome.MELEE_HIT_CRUSHING]: 'crushes',
    [MeleeHitOutcome.MELEE_HIT_NORMAL]: 'hits',
    [MeleeHitOutcome.MELEE_HIT_BLOCK_CRIT]: 'is block crit',
};
const skillDiffToReduction = [1, 0.9926, 0.9840, 0.9742, 0.9629, 0.9500, 0.9351, 0.9180, 0.8984, 0.8759, 0.8500, 0.8203, 0.7860, 0.7469, 0.7018];
class Player extends Unit {
    constructor(stats, log) {
        super(60, 0);
        this.items = new Map();
        this.procs = [];
        this.nextGCDTime = 0;
        this.extraAttackCount = 0;
        this.doingExtraAttacks = false;
        this.damageLog = [];
        this.queuedSpell = undefined;
        this.latency = 50;
        this.powerLost = 0;
        this.buffManager = new BuffManager(this, new Stats(stats));
        this.log = log;
    }
    get mh() {
        const equiped = this.items.get(ItemSlot.MAINHAND);
        if (equiped && isEquipedWeapon(equiped)) {
            return equiped;
        }
    }
    get oh() {
        const equiped = this.items.get(ItemSlot.OFFHAND);
        if (equiped && isEquipedWeapon(equiped)) {
            return equiped;
        }
    }
    equip(slot, item, enchant, temporaryEnchant) {
        if (this.items.has(slot)) {
            console.error(`already have item in slot ${ItemSlot[slot]}`);
            return;
        }
        if (!(item.slot & slot)) {
            console.error(`cannot equip ${item.name} in slot ${ItemSlot[slot]}`);
            return;
        }
        if (item.stats) {
            this.buffManager.baseStats.add(item.stats);
        }
        if (enchant && enchant.stats) {
            this.buffManager.baseStats.add(enchant.stats);
        }
        if (isWeapon(item)) {
            this.items.set(slot, new WeaponEquiped(item, this, enchant, temporaryEnchant));
        }
        else {
            this.items.set(slot, new ItemEquiped(item, this));
        }
    }
    get power() {
        return 0;
    }
    set power(power) { }
    addProc(p) {
        this.procs.push(p);
    }
    removeProc(p) {
        this.procs = this.procs.filter((proc) => {
            return proc !== p;
        });
    }
    calculateWeaponSkillValue(is_mh, effect) {
        if (effect && effect.type !== EffectType.PHYSICAL_WEAPON) {
            return this.maxSkillForLevel;
        }
        const weapon = is_mh ? this.mh : this.oh;
        const weaponType = weapon.weapon.type;
        switch (weaponType) {
            case WeaponType.MACE:
                {
                    return this.maxSkillForLevel + this.buffManager.stats.maceSkill;
                }
            case WeaponType.SWORD:
                {
                    return this.maxSkillForLevel + this.buffManager.stats.swordSkill;
                }
            case WeaponType.AXE:
                {
                    return this.maxSkillForLevel + this.buffManager.stats.axeSkill;
                }
            case WeaponType.DAGGER:
                {
                    return this.maxSkillForLevel + this.buffManager.stats.daggerSkill;
                }
            case WeaponType.MACE2H:
                {
                    return this.maxSkillForLevel + this.buffManager.stats.mace2HSkill;
                }
            case WeaponType.SWORD2H:
                {
                    return this.maxSkillForLevel + this.buffManager.stats.sword2HSkill;
                }
            case WeaponType.AXE2H:
                {
                    return this.maxSkillForLevel + this.buffManager.stats.axe2HSkill;
                }
            default:
                {
                    return this.maxSkillForLevel;
                }
        }
    }
    calculateCritChance(victim, is_mh, effect) {
        if (effect && effect.type == EffectType.PHYSICAL) {
            effect = undefined;
        }
        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;
        if (!effect || effect.type == EffectType.PHYSICAL_WEAPON) {
            const weapon = is_mh ? this.mh : this.oh;
            if (weapon.temporaryEnchant && weapon.temporaryEnchant.stats && weapon.temporaryEnchant.stats.crit) {
                crit += weapon.temporaryEnchant.stats.crit;
            }
        }
        const skillBonus = 0.04 * (this.calculateWeaponSkillValue(is_mh, effect) - victim.maxSkillForLevel);
        crit += skillBonus;
        return crit;
    }
    calculateMissChance(victim, is_mh, effect) {
        let res = 5;
        res -= this.buffManager.stats.hit;
        if (this.oh && !effect) {
            res += 19;
        }
        const skillDiff = this.calculateWeaponSkillValue(is_mh, effect) - victim.defenseSkill;
        if (skillDiff < -10) {
            res -= (skillDiff + 10) * 0.4 - 2;
        }
        else {
            res -= skillDiff * 0.1;
        }
        return clamp(res, 0, 60);
    }
    calculateGlancingReduction(victim, is_mh) {
        const skillDiff = victim.defenseSkill - this.calculateWeaponSkillValue(is_mh);
        if (skillDiff >= 15) {
            return 0.65;
        }
        else if (skillDiff < 0) {
            return 1;
        }
        else {
            return skillDiffToReduction[skillDiff];
        }
    }
    get ap() {
        return 0;
    }
    calculateSwingMinMaxDamage(is_mh, normalized = false) {
        const weapon = is_mh ? this.mh : this.oh;
        const ap_bonus = this.ap / 14 * (normalized ? normalizedWeaponSpeed[weapon.weapon.type] : weapon.weapon.speed);
        const ohPenalty = is_mh ? 1 : 0.625;
        return [
            (weapon.min + ap_bonus) * ohPenalty,
            (weapon.max + ap_bonus) * ohPenalty
        ];
    }
    calculateSwingRawDamage(is_mh, normalized = false) {
        return frand(...this.calculateSwingMinMaxDamage(is_mh, normalized));
    }
    critCap() {
        const skillBonus = 4 * (this.calculateWeaponSkillValue(true) - this.target.maxSkillForLevel);
        const miss_chance = Math.round(this.calculateMissChance(this.target, true) * 100);
        const dodge_chance = Math.round(this.target.dodgeChance * 100) - skillBonus;
        const glance_chance = clamp((10 + (this.target.defenseSkill - 300) * 2) * 100, 0, 4000);
        return (10000 - (miss_chance + dodge_chance + glance_chance)) / 100;
    }
    rollMeleeHitOutcome(victim, is_mh, effect) {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, effect) * 100);
        const dodge_chance = Math.round(victim.dodgeChance * 100);
        const crit_chance = Math.round(this.calculateCritChance(victim, is_mh, effect) * 100);
        const skillBonus = 4 * (this.calculateWeaponSkillValue(is_mh, effect) - victim.maxSkillForLevel);
        tmp = miss_chance;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }
        tmp = dodge_chance - skillBonus;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_DODGE;
        }
        if (!effect) {
            tmp = (10 + (victim.defenseSkill - 300) * 2) * 100;
            tmp = clamp(tmp, 0, 4000);
            if (roll < (sum += tmp)) {
                return MeleeHitOutcome.MELEE_HIT_GLANCING;
            }
        }
        tmp = crit_chance;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_CRIT;
        }
        return MeleeHitOutcome.MELEE_HIT_NORMAL;
    }
    calculateBonusDamage(rawDamage, victim, effect) {
        let damageWithBonus = rawDamage;
        damageWithBonus *= this.buffManager.stats.damageMult;
        return damageWithBonus;
    }
    calculateMeleeDamage(rawDamage, victim, is_mh, effect) {
        const damageWithBonus = this.calculateBonusDamage(rawDamage, victim, effect);
        const armorReduced = victim.calculateArmorReducedDamage(damageWithBonus, this);
        const hitOutcome = this.rollMeleeHitOutcome(victim, is_mh, effect);
        let damage = armorReduced;
        let cleanDamage = 0;
        switch (hitOutcome) {
            case MeleeHitOutcome.MELEE_HIT_MISS:
                {
                    damage = 0;
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_DODGE:
            case MeleeHitOutcome.MELEE_HIT_PARRY:
                {
                    damage = 0;
                    cleanDamage = damageWithBonus;
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_GLANCING:
                {
                    const reducePercent = this.calculateGlancingReduction(victim, is_mh);
                    damage = reducePercent * damage;
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_NORMAL:
                {
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_CRIT:
                {
                    damage *= 2;
                    break;
                }
        }
        return [damage, hitOutcome, cleanDamage];
    }
    updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, effect) {
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_PARRY].includes(hitOutcome)) {
            for (let proc of this.procs) {
                proc.run(this, (is_mh ? this.mh : this.oh).weapon, time);
            }
            (is_mh ? this.mh : this.oh).proc(time);
        }
    }
    dealMeleeDamage(time, rawDamage, target, is_mh, effect) {
        let [damageDone, hitOutcome, cleanDamage] = this.calculateMeleeDamage(rawDamage, target, is_mh, effect);
        damageDone = Math.trunc(damageDone);
        cleanDamage = Math.trunc(cleanDamage);
        this.damageLog.push([time, damageDone]);
        if (this.log) {
            let hitStr = `Your ${effect ? effect.parent.name : (is_mh ? 'main-hand' : 'off-hand')} ${hitOutcomeString[hitOutcome]}`;
            if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_PARRY].includes(hitOutcome)) {
                hitStr += ` for ${damageDone}`;
            }
            this.log(time, hitStr);
        }
        if (effect instanceof SpellDamageEffect) {
            if (effect.callback) {
                effect.callback(this, hitOutcome);
            }
        }
        if (!effect || effect.canProc) {
            this.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, effect);
            this.buffManager.update(time);
        }
    }
    dealSpellDamage(time, rawDamage, target, effect) {
        const damageDone = rawDamage;
        this.damageLog.push([time, damageDone]);
        if (this.log) {
            this.log(time, `${effect.parent.name} hits for ${damageDone}`);
        }
    }
    swingWeapon(time, target, is_mh) {
        if (!this.doingExtraAttacks && is_mh && this.queuedSpell && this.queuedSpell.canCast(time)) {
            this.queuedSpell.cast(time);
            this.queuedSpell = undefined;
        }
        else {
            const rawDamage = this.calculateSwingRawDamage(is_mh);
            this.dealMeleeDamage(time, rawDamage, target, is_mh);
        }
        const [thisWeapon, otherWeapon] = is_mh ? [this.mh, this.oh] : [this.oh, this.mh];
        thisWeapon.nextSwingTime = time + thisWeapon.weapon.speed / this.buffManager.stats.haste * 1000;
        if (otherWeapon && otherWeapon.nextSwingTime < time + 200) {
            otherWeapon.nextSwingTime = time + 200;
        }
    }
    updateAttackingState(time) {
        if (this.target) {
            if (this.extraAttackCount > 0) {
                this.doingExtraAttacks = true;
                while (this.extraAttackCount > 0) {
                    this.swingWeapon(time, this.target, true);
                    this.extraAttackCount--;
                }
                this.doingExtraAttacks = false;
            }
            if (time >= this.mh.nextSwingTime) {
                this.swingWeapon(time, this.target, true);
            }
            else if (this.oh && time >= this.oh.nextSwingTime) {
                this.swingWeapon(time, this.target, false);
            }
        }
    }
}

const flurry = new Buff("Flurry", 15, { haste: 1.3 }, true, 3, undefined, undefined, false);
const raceToStats = new Map();
raceToStats.set(Race.HUMAN, { maceSkill: 5, swordSkill: 5, mace2HSkill: 5, sword2HSkill: 5, str: 120, agi: 80 });
raceToStats.set(Race.ORC, { axeSkill: 5, axe2HSkill: 5, str: 123, agi: 77 });
class Warrior extends Player {
    constructor(race, stats, logCallback) {
        super(new Stats(raceToStats.get(race)).add(stats), logCallback);
        this.rage = 80;
        this.execute = new LearnedSpell(executeSpell, this);
        this.bloodthirst = new LearnedSpell(bloodthirstSpell, this);
        this.hamstring = new LearnedSpell(hamstringSpell, this);
        this.whirlwind = new LearnedSpell(whirlwindSpell, this);
        this.heroicStrike = new LearnedSwingSpell(heroicStrikeSpell, this);
        this.bloodRage = new LearnedSpell(bloodRage, this);
        this.deathWish = new LearnedSpell(deathWish, this);
        this.executeSpell = new LearnedSpell(executeSpell, this);
        this.buffManager.add(angerManagementOT, Math.random() * -3000);
        this.buffManager.add(unbridledWrath, 0);
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
                    this.rage += effect.parent.cost * 0.82;
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
            && (!effect || effect.parent === heroicStrikeSpell)
            && ![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)
            && hitOutcome !== MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.buffManager.remove(flurry, time);
        }
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.buffManager.add(flurry, time);
        }
    }
}
const heroicStrikeSpell = new SwingSpell("Heroic Strike", EffectFamily.WARRIOR, 157, 12);
const executeSpell = new SpellDamage("Execute", (player) => {
    return 600 + (player.power - 10) * 15;
}, EffectType.PHYSICAL_WEAPON, EffectFamily.WARRIOR, true, 10, 0, (player, hitOutcome) => {
    if (![MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_MISS].includes(hitOutcome)) {
        player.power = 0;
    }
});
const bloodthirstSpell = new SpellDamage("Bloodthirst", (player) => {
    return player.ap * 0.45;
}, EffectType.PHYSICAL, EffectFamily.WARRIOR, true, 30, 6);
const whirlwindSpell = new SpellDamage("Whirlwind", (player) => {
    return player.calculateSwingRawDamage(true, true);
}, EffectType.PHYSICAL_WEAPON, EffectFamily.WARRIOR, true, 25, 10);
const hamstringSpell = new SpellDamage("Hamstring", 45, EffectType.PHYSICAL_WEAPON, EffectFamily.WARRIOR, true, 10, 0);
const angerManagementOT = new BuffOverTime("Anger Management", Number.MAX_SAFE_INTEGER, undefined, 3000, new ModifyPowerEffect(1));
const bloodRage = new Spell("Bloodrage", false, 0, 60, [
    new ModifyPowerEffect(10),
    new SpellBuffEffect(new BuffOverTime("Bloodrage", 10, undefined, 1000, new ModifyPowerEffect(1)))
]);
const deathWish = new SpellBuff(new Buff("Death Wish", 30, { damageMult: 1.2 }), true, 10, 3 * 60);
const unbridledWrath = new BuffProc("Unbridled Wrath", 60 * 60, new Proc(new Spell("Unbridled Wrath", false, 0, 0, new ModifyPowerEffect(1)), { chance: 40 }));

const enchants = [
    {
        name: 'Crusader MH',
        slot: ItemSlot.MAINHAND,
        proc: new Proc(new SpellBuff(new Buff("Crusader MH", 15, new Stats({ str: 100 }))), { ppm: 1 }),
    },
    {
        name: 'Crusader OH',
        slot: ItemSlot.OFFHAND,
        proc: new Proc(new SpellBuff(new Buff("Crusader OH", 15, new Stats({ str: 100 }))), { ppm: 1 }),
    },
    {
        name: '8 Strength',
        slot: ItemSlot.HEAD | ItemSlot.LEGS,
        stats: { str: 8 },
    },
    {
        name: '15 Agility',
        slot: ItemSlot.HANDS,
        stats: { agi: 15 },
    },
    {
        name: '1 Haste',
        slot: ItemSlot.HEAD | ItemSlot.LEGS | ItemSlot.HANDS,
        stats: { haste: 1.01 },
    },
    {
        name: '3 Agility',
        slot: ItemSlot.BACK,
        stats: { agi: 3 },
    },
    {
        name: 'ZG Enchant (30 AP)',
        slot: ItemSlot.SHOULDER,
        stats: { ap: 30 },
    },
    {
        name: 'Greater Stats (+4)',
        slot: ItemSlot.CHEST,
        stats: { str: 4, agi: 4 },
    },
    {
        name: '9 Strength',
        slot: ItemSlot.WRIST,
        stats: { str: 9 },
    },
    {
        name: 'Run Speed',
        slot: ItemSlot.FEET,
        stats: {},
    },
    {
        name: '7 Agility',
        slot: ItemSlot.FEET,
        stats: { agi: 7 },
    },
];
const temporaryEnchants = [
    {
        name: '+8 Damage',
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        stats: { plusDamage: 8 },
    },
    {
        name: 'Elemental Sharpening Stone',
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        stats: { crit: 2 },
    },
    {
        name: 'Windfury',
        slot: ItemSlot.MAINHAND,
        proc: new Proc([
            new ExtraAttack("Windfury Totem", 1),
            new SpellBuff(new Buff("Windfury Totem", 1.5, { ap: 315 }))
        ], { chance: 0.2 }),
    }
];

const items = [
    {
        name: "Ironfoe",
        slot: ItemSlot.MAINHAND,
        type: WeaponType.MACE,
        min: 73,
        max: 136,
        speed: 2.4,
        onhit: new Proc(new ExtraAttack('Ironfoe', 2), { ppm: 1 })
    },
    {
        name: "Empyrean Demolisher",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND,
        min: 94,
        max: 175,
        speed: 2.8,
        onhit: new Proc(new SpellBuff(new Buff("Haste (Empyrean Demolisher)", 10, { haste: 1.2 })), { ppm: 1 })
    },
    {
        name: "Anubisath Warhammer",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 66,
        max: 123,
        speed: 1.8,
        stats: { maceSkill: 4, ap: 32 }
    },
    {
        name: "The Untamed Blade",
        type: WeaponType.SWORD2H,
        slot: ItemSlot.MAINHAND,
        min: 192,
        max: 289,
        speed: 3.4,
        onhit: new Proc(new SpellBuff(new Buff("Untamed Fury", 8, { str: 300 })), { ppm: 2 })
    },
    {
        name: "Misplaced Servo Arm",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 128,
        max: 238,
        speed: 2.8,
        onequip: new Proc(new SpellDamage("Electric Discharge", [100, 151], EffectType.MAGIC), { ppm: 3 })
    },
    {
        name: "Hand of Justice",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: { ap: 20 },
        onequip: new Proc(new ExtraAttack('Hand of Justice', 1), { chance: 2 / 100 })
    },
    {
        name: "Blackhand's Breadth",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: { crit: 2 }
    },
    {
        name: "Drake Fang Talisman",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: { ap: 56, hit: 2 }
    },
    {
        name: "Lionheart Helm",
        slot: ItemSlot.HEAD,
        stats: { crit: 2, hit: 2, str: 18 }
    },
    {
        name: "Barbed Choker",
        slot: ItemSlot.NECK,
        stats: { ap: 44, crit: 1 }
    },
    {
        name: "Onyxia Tooth Pendant",
        slot: ItemSlot.NECK,
        stats: { agi: 12, hit: 1, crit: 1 }
    },
    {
        name: "Conqueror's Spaulders",
        slot: ItemSlot.SHOULDER,
        stats: { str: 20, agi: 16, hit: 1 }
    },
    {
        name: "Cloak of Draconic Might",
        slot: ItemSlot.BACK,
        stats: { str: 16, agi: 16 }
    },
    {
        name: "Drape of Unyielding Strength",
        slot: ItemSlot.BACK,
        stats: { str: 15, agi: 9, hit: 1 }
    },
    {
        name: "Conqueror's Breastplate",
        slot: ItemSlot.CHEST,
        stats: { str: 20, agi: 16, hit: 1 }
    },
    {
        name: "Savage Gladiator Chain",
        slot: ItemSlot.CHEST,
        stats: { agi: 14, str: 13, crit: 2 }
    },
    {
        name: "Ghoul Skin Tunic",
        slot: ItemSlot.CHEST,
        stats: { str: 40, crit: 2 }
    },
    {
        name: "Breastplate of Annihilation",
        slot: ItemSlot.CHEST,
        stats: { str: 37, crit: 1, hit: 1 }
    },
    {
        name: "Hive Defiler Wristguards",
        slot: ItemSlot.WRIST,
        stats: { str: 23, agi: 18 }
    },
    {
        name: "Qiraji Execution Bracers",
        slot: ItemSlot.WRIST,
        stats: { agi: 16, str: 15, hit: 1 }
    },
    {
        name: "Gauntlets of Might",
        slot: ItemSlot.HANDS,
        stats: { str: 22, hit: 1 }
    },
    {
        name: "Gauntlets of Annihilation",
        slot: ItemSlot.HANDS,
        stats: { str: 35, crit: 1, hit: 1 }
    },
    {
        name: "Edgemaster's Handguards",
        slot: ItemSlot.HANDS,
        stats: { axeSkill: 7, daggerSkill: 7, swordSkill: 7 }
    },
    {
        name: "Aged Core Leather Gloves",
        slot: ItemSlot.HANDS,
        stats: { str: 15, crit: 1, daggerSkill: 5 }
    },
    {
        name: "Onslaught Girdle",
        slot: ItemSlot.WAIST,
        stats: { str: 31, crit: 1, hit: 1 }
    },
    {
        name: "Titanic Leggings",
        slot: ItemSlot.LEGS,
        stats: { str: 30, crit: 1, hit: 2 }
    },
    {
        name: "Conqueror's Legguards",
        slot: ItemSlot.LEGS,
        stats: { agi: 21, str: 33, hit: 1 }
    },
    {
        name: "Boots of the Fallen Hero",
        slot: ItemSlot.FEET,
        stats: { str: 20, agi: 14, hit: 1 }
    },
    {
        name: "Chromatic Boots",
        slot: ItemSlot.FEET,
        stats: { str: 20, agi: 20, hit: 1 }
    },
    {
        name: "Striker's Mark",
        slot: ItemSlot.RANGED,
        stats: { ap: 22, hit: 1 }
    },
    {
        name: "Quick Strike Ring",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { ap: 30, crit: 1, str: 5 }
    },
    {
        name: "Ring of the Qiraji Fury",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { ap: 40, crit: 1 }
    },
    {
        name: "Master Dragonslayer's Ring",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { ap: 48, hit: 1 }
    },
    {
        name: "Don Julio's Band",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { crit: 1, hit: 1, ap: 16 }
    },
    {
        name: "Vis'kag the Bloodletter",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 100,
        max: 187,
        speed: 2.6,
        onhit: new Proc(new ItemSpellDamage("Fatal Wounds", 240, EffectType.PHYSICAL), { ppm: 1.3 })
    },
    {
        name: "Chromatically Tempered Sword",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 106,
        max: 198,
        speed: 2.6,
        stats: { agi: 14, str: 14 }
    },
    {
        name: "Maladath, Runed Blade of the Black Flight",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 86,
        max: 162,
        speed: 2.2,
        stats: { swordSkill: 4 }
    },
    {
        name: "Ancient Qiraji Ripper",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 114,
        max: 213,
        speed: 2.8,
        stats: { crit: 1, ap: 20 }
    },
    {
        name: "Iblis, Blade of the Fallen Seraph",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 70,
        max: 131,
        speed: 1.6,
        stats: { crit: 1, hit: 1, ap: 26 }
    },
    {
        name: "Gressil, Dawn of Ruin",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 138,
        max: 257,
        speed: 2.7,
        stats: { ap: 40 }
    },
    {
        name: "The Hungering Cold",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 76,
        max: 143,
        speed: 1.5,
        stats: { swordSkill: 6 }
    },
    {
        name: "R14 Mace",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 138,
        max: 207,
        speed: 2.9,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "R14 Longsword",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 138,
        max: 207,
        speed: 2.9,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "R14 Swiftblade",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 85,
        max: 129,
        speed: 1.8,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "Hatchet of Sundered Bone",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 119,
        max: 221,
        speed: 2.6,
        stats: { ap: 36, crit: 1 }
    },
    {
        name: "R14 Axe",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 138,
        max: 207,
        speed: 2.9,
        stats: { crit: 1, ap: 28 }
    },
    {
        name: "Blessed Qiraji War Axe",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 110,
        max: 205,
        speed: 2.60,
        stats: { crit: 1, ap: 14 }
    },
    {
        name: "Crul'shorukh, Edge of Chaos",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 101,
        max: 188,
        speed: 2.30,
        stats: { ap: 36 }
    },
    {
        name: "Deathbringer (W/O PROC)",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 114,
        max: 213,
        speed: 2.90
    },
    {
        name: "Doom's Edge",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 83,
        max: 154,
        speed: 2.30,
        stats: { agi: 16, str: 9 }
    },
    {
        name: "Mirah's Song",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 57,
        max: 87,
        speed: 1.8,
        stats: { agi: 9, str: 9 }
    },
    {
        name: "Death's Sting",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 95,
        max: 144,
        speed: 1.8,
        stats: { ap: 38, daggerSkill: 3 }
    },
    {
        name: "Blessed Qiraji Pugio",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 72,
        max: 134,
        speed: 1.7,
        stats: { crit: 1, hit: 1, ap: 18 }
    },
    {
        name: "Felstriker",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 54,
        max: 101,
        speed: 1.7,
        onhit: new Proc(new SpellBuff(new Buff("Felstriker", 3, { crit: 100, hit: 100 })), { ppm: 1.4 })
    },
    {
        name: "Badge of the Swarmguard",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onuse: (() => {
            const insightOfTheQiraji = new Buff("Insight of the Qiraji", 30, { armorPenetration: 200 }, true, 0, 6);
            const badgeBuff = new SpellBuff(new BuffProc("Badge of the Swarmguard", 30, new Proc(new SpellBuff(insightOfTheQiraji), { ppm: 15 }), insightOfTheQiraji), false, 0, 3 * 60);
            return badgeBuff;
        })()
    },
    {
        name: "Diamond Flask",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onuse: new SpellBuff(new Buff("Diamond Flask", 60, { str: 75 }), true, 0, 6 * 60),
    }
];

const buffs = [
    {
        name: "Battle Shout",
        duration: 2 * 60,
        stats: {
            ap: 290
        }
    },
    {
        name: "Gift of the Wild",
        duration: 1 * 60 * 60,
        stats: {
            str: 16,
            agi: 16
        }
    },
    {
        name: "Trueshot Aura",
        duration: 1 * 60 * 60,
        stats: {
            ap: 100
        }
    },
    {
        name: "Blessing of Kings",
        faction: Faction.ALLIANCE,
        duration: 15 * 60,
        stats: {
            statMult: 1.1
        }
    },
    {
        name: "Blessing of Might",
        faction: Faction.ALLIANCE,
        duration: 15 * 60,
        stats: {
            ap: 222
        }
    },
    {
        name: "Strength of Earth",
        faction: Faction.HORDE,
        duration: 15 * 60,
        stats: {
            str: 77 * 1.15
        }
    },
    {
        name: "Grace of Air",
        faction: Faction.HORDE,
        disabled: true,
        duration: 15 * 60,
        stats: {
            agi: 77 * 1.15
        }
    },
    {
        name: "Smoked Desert Dumplings",
        duration: 15 * 60,
        stats: {
            str: 20
        }
    },
    {
        name: "Juju Power",
        duration: 30 * 60,
        stats: {
            str: 30
        }
    },
    {
        name: "Juju Might",
        duration: 10 * 60,
        stats: {
            ap: 40
        }
    },
    {
        name: "Elixir of the Mongoose",
        duration: 1 * 60 * 60,
        stats: {
            agi: 25,
            crit: 2
        }
    },
    {
        name: "R.O.I.D.S.",
        duration: 1 * 60 * 60,
        stats: {
            str: 25
        }
    },
    {
        name: "Rallying Cry of the Dragonslayer",
        duration: 2 * 60 * 60,
        stats: {
            ap: 140,
            crit: 5
        }
    },
    {
        name: "Songflower Seranade",
        duration: 2 * 60 * 60,
        stats: {
            crit: 5,
            str: 15,
            agi: 15
        }
    },
    {
        name: "Spirit of Zandalar",
        duration: 1 * 60 * 60,
        stats: {
            statMult: 1.15
        }
    },
    {
        name: "Fengus' Ferocity",
        duration: 2 * 60 * 60,
        stats: {
            ap: 200
        }
    },
    {
        name: "Warchief's Blessing",
        duration: 1 * 60 * 60,
        stats: {
            haste: 1.15
        }
    },
];

function setupPlayer(race, stats, equipment, enchants, temporaryEnchant, buffs, log) {
    const player = new Warrior(race, stats, log);
    for (let [slot, item] of equipment) {
        player.equip(slot, item, enchants.get(slot), temporaryEnchant.get(slot));
    }
    for (let buff of buffs) {
        player.buffManager.add(new Buff(buff.name, buff.duration, buff.stats), 0);
    }
    const boss = new Unit(63, 4691 - 2250 - 640 - 505 - 600);
    player.target = boss;
    return player;
}
function lookupMap(slotToIndex, lookup) {
    const res = new Map();
    for (let [slot, idx] of slotToIndex) {
        if (lookup[idx]) {
            res.set(slot, lookup[idx]);
        }
        else {
            console.log('bad index', idx, lookup);
        }
    }
    return res;
}
function lookupArray(indices, lookup) {
    const res = [];
    for (let idx of indices) {
        if (lookup[idx]) {
            res.push(lookup[idx]);
        }
        else {
            console.log('bad index', idx, lookup);
        }
    }
    return res;
}
function lookupItems(map) {
    return lookupMap(map, items);
}
function lookupEnchants(map) {
    return lookupMap(map, enchants);
}
function lookupTemporaryEnchants(map) {
    return lookupMap(map, temporaryEnchants);
}
function lookupBuffs(indices) {
    return lookupArray(indices, buffs);
}

const EXECUTE_PHASE_RATIO = 0.15;
class Fight {
    constructor(race, stats, equipment, enchants, temporaryEnchants, buffs, chooseAction, fightLength = 60, log) {
        this.duration = 0;
        this.player = setupPlayer(race, stats, equipment, enchants, temporaryEnchants, buffs, log);
        this.chooseAction = chooseAction;
        this.fightLength = (fightLength + Math.random() * 4 - 2) * 1000;
    }
    run() {
        return new Promise((f, r) => {
            while (this.duration <= this.fightLength) {
                this.update();
            }
            f({
                damageLog: this.player.damageLog,
                fightLength: this.fightLength,
                powerLost: this.player.powerLost
            });
        });
    }
    pause(pause) { }
    cancel() { }
    update() {
        const beginExecuteTime = this.fightLength * (1 - EXECUTE_PHASE_RATIO);
        const isExecutePhase = this.duration >= beginExecuteTime;
        this.player.buffManager.update(this.duration);
        this.chooseAction(this.player, this.duration, this.fightLength, isExecutePhase);
        this.player.updateAttackingState(this.duration);
        const waitingForTime = this.chooseAction(this.player, this.duration, this.fightLength, isExecutePhase);
        let nextSwingTime = this.player.mh.nextSwingTime;
        if (this.player.oh) {
            nextSwingTime = Math.min(nextSwingTime, this.player.oh.nextSwingTime);
        }
        if (this.player.extraAttackCount) ;
        else if (this.player.nextGCDTime > this.duration) {
            this.duration = Math.min(this.player.nextGCDTime, nextSwingTime, this.player.buffManager.nextOverTimeUpdate);
        }
        else {
            this.duration = Math.min(nextSwingTime, this.player.buffManager.nextOverTimeUpdate);
        }
        if (waitingForTime < this.duration) {
            this.duration = waitingForTime;
        }
        if (!isExecutePhase && beginExecuteTime < this.duration) {
            this.duration = beginExecuteTime;
        }
    }
}
class RealtimeFight extends Fight {
    constructor() {
        super(...arguments);
        this.paused = false;
    }
    run() {
        const MS_PER_UPDATE = 1000 / 60;
        return new Promise((f, r) => {
            let overrideDuration = 0;
            const loop = () => {
                if (this.duration <= this.fightLength) {
                    if (!this.paused) {
                        this.update();
                        overrideDuration += MS_PER_UPDATE;
                        this.duration = overrideDuration;
                    }
                    setTimeout(loop, MS_PER_UPDATE);
                }
                else {
                    f({
                        damageLog: this.player.damageLog,
                        fightLength: this.fightLength,
                        powerLost: this.player.powerLost
                    });
                }
            };
            setTimeout(loop, MS_PER_UPDATE);
        });
    }
    pause(pause) {
        this.paused = pause;
    }
}
class Simulation {
    constructor(race, stats, equipment, enchants, temporaryEnchants, buffs, chooseAction, fightLength = 60, realtime = false, log) {
        this.requestStop = false;
        this._paused = false;
        this.fightResults = [];
        this.cachedSummmary = { normalDamage: 0, execDamage: 0, normalDuration: 0, execDuration: 0, powerLost: 0, fights: 0 };
        this.race = race;
        this.stats = stats;
        this.equipment = equipment;
        this.enchants = enchants;
        this.temporaryEnchants = temporaryEnchants;
        this.buffs = buffs;
        this.chooseAction = chooseAction;
        this.fightLength = fightLength;
        this.realtime = realtime;
        this.log = log;
    }
    get paused() {
        return this._paused;
    }
    get status() {
        for (let fightResult of this.fightResults) {
            const beginExecuteTime = fightResult.fightLength * (1 - EXECUTE_PHASE_RATIO);
            for (let [time, damage] of fightResult.damageLog) {
                if (time >= beginExecuteTime) {
                    this.cachedSummmary.execDamage += damage;
                }
                else {
                    this.cachedSummmary.normalDamage += damage;
                }
            }
            this.cachedSummmary.normalDuration += beginExecuteTime;
            this.cachedSummmary.execDuration += fightResult.fightLength - beginExecuteTime;
            this.cachedSummmary.powerLost += fightResult.powerLost;
            this.cachedSummmary.fights++;
        }
        this.fightResults = [];
        let normalDamage = this.cachedSummmary.normalDamage;
        let execDamage = this.cachedSummmary.execDamage;
        let normalDuration = this.cachedSummmary.normalDuration;
        let execDuration = this.cachedSummmary.execDuration;
        let powerLost = this.cachedSummmary.powerLost;
        let fights = this.cachedSummmary.fights;
        if (this.realtime && this.currentFight) {
            const beginExecuteTime = this.currentFight.fightLength * (1 - EXECUTE_PHASE_RATIO);
            for (let [time, damage] of this.currentFight.player.damageLog) {
                if (time >= beginExecuteTime) {
                    execDamage += damage;
                }
                else {
                    normalDamage += damage;
                }
            }
            normalDuration += Math.min(beginExecuteTime, this.currentFight.duration);
            execDuration += Math.max(0, this.currentFight.duration - beginExecuteTime);
            powerLost += this.currentFight.player.powerLost;
            fights++;
        }
        return {
            normalDamage: normalDamage,
            execDamage: execDamage,
            normalDuration: normalDuration,
            execDuration: execDuration,
            powerLost: powerLost,
            fights: fights,
        };
    }
    start() {
        const fightClass = this.realtime ? RealtimeFight : Fight;
        const outerloop = () => {
            if (this.paused) {
                setTimeout(outerloop, 100);
                return;
            }
            let count = 0;
            const innerloop = () => {
                if (count > 100) {
                    setTimeout(outerloop, 0);
                    return;
                }
                this.currentFight = new fightClass(this.race, this.stats, this.equipment, this.enchants, this.temporaryEnchants, this.buffs, this.chooseAction, this.fightLength, this.realtime ? this.log : undefined);
                this.currentFight.run().then((res) => {
                    this.fightResults.push(res);
                    count++;
                    innerloop();
                });
            };
            if (!this.requestStop) {
                innerloop();
            }
        };
        outerloop();
    }
    pause(pause) {
        if (pause === undefined) {
            pause = !this.paused;
        }
        this._paused = pause;
        if (this.currentFight) {
            this.currentFight.pause(pause);
        }
    }
    stop() {
        this.requestStop = true;
    }
}

function generateChooseAction(heroicStrikeRageReq, hamstringRageReq, bloodthirstExecRageLimit) {
    return (player, time, fightLength, executePhase) => {
        const warrior = player;
        const timeRemainingSeconds = (fightLength - time) / 1000;
        let waitingForTime = Number.POSITIVE_INFINITY;
        for (let [_, item] of player.items) {
            if (item.onuse && item.onuse.canCast(time)) {
                if (item.onuse.spell instanceof SpellBuff) {
                    if (timeRemainingSeconds <= item.onuse.spell.buff.duration) {
                        item.onuse.cast(time);
                    }
                    else {
                        waitingForTime = Math.min(waitingForTime, fightLength - item.onuse.spell.buff.duration * 1000);
                    }
                }
            }
        }
        if (warrior.rage < 30 && warrior.bloodRage.canCast(time)) {
            warrior.bloodRage.cast(time);
        }
        if (warrior.nextGCDTime <= time) {
            if (warrior.deathWish.canCast(time) &&
                (timeRemainingSeconds <= 30
                    || (timeRemainingSeconds - warrior.deathWish.spell.cooldown) > 30)) {
                warrior.deathWish.cast(time);
            }
            else if (executePhase && warrior.bloodthirst.canCast(time) && warrior.rage < bloodthirstExecRageLimit) {
                warrior.bloodthirst.cast(time);
            }
            else if (executePhase && warrior.execute.canCast(time)) {
                warrior.execute.cast(time);
            }
            else if (warrior.bloodthirst.canCast(time)) {
                warrior.bloodthirst.cast(time);
            }
            else if (warrior.bloodthirst.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                if (warrior.bloodthirst.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.bloodthirst.cooldown);
                }
            }
            else if (warrior.whirlwind.canCast(time)) {
                warrior.whirlwind.cast(time);
            }
            else if (warrior.whirlwind.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                if (warrior.whirlwind.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.whirlwind.cooldown);
                }
            }
            else if (warrior.rage >= hamstringRageReq && warrior.hamstring.canCast(time)) {
                warrior.hamstring.cast(time);
            }
        }
        if (!executePhase && warrior.rage >= heroicStrikeRageReq && !warrior.queuedSpell) {
            warrior.queuedSpell = warrior.heroicStrike;
            if (warrior.log)
                warrior.log(time, 'queueing heroic strike');
        }
        return waitingForTime;
    };
}

const mainThreadInterface = MainThreadInterface.instance;
let currentSim = undefined;
mainThreadInterface.addEventListener('simulate', (data) => {
    const simdesc = data;
    let logFunction = undefined;
    if (simdesc.realtime) {
        logFunction = (time, text) => {
            mainThreadInterface.send('log', {
                time: time,
                text: text
            });
        };
    }
    currentSim = new Simulation(simdesc.race, simdesc.stats, lookupItems(simdesc.equipment), lookupEnchants(simdesc.enchants), lookupTemporaryEnchants(simdesc.temporaryEnchants), lookupBuffs(simdesc.buffs), generateChooseAction(simdesc.heroicStrikeRageReq, simdesc.hamstringRageReq, simdesc.bloodthirstExecRageLimit), simdesc.fightLength, simdesc.realtime, logFunction);
    currentSim.start();
    setInterval(() => {
        if (currentSim && !currentSim.paused) {
            mainThreadInterface.send('status', currentSim.status);
        }
    }, 500);
});
mainThreadInterface.addEventListener('pause', (pause) => {
    if (currentSim) {
        currentSim.pause(pause);
    }
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3NwZWxsLnRzIiwiLi4vc3JjL2l0ZW0udHMiLCIuLi9zcmMvdW5pdC50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL2VuY2hhbnRzLnRzIiwiLi4vc3JjL2RhdGEvaXRlbXMudHMiLCIuLi9zcmMvZGF0YS9zcGVsbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbl91dGlscy50cyIsIi4uL3NyYy9zaW11bGF0aW9uLnRzIiwiLi4vc3JjL3dhcnJpb3JfYWkudHMiLCIuLi9zcmMvcnVuX3NpbXVsYXRpb25fd29ya2VyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbInR5cGUgV29ya2VyRXZlbnRMaXN0ZW5lciA9IChkYXRhOiBhbnkpID0+IHZvaWQ7XG5cbmNsYXNzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBldmVudExpc3RlbmVyczogTWFwPHN0cmluZywgV29ya2VyRXZlbnRMaXN0ZW5lcltdPiA9IG5ldyBNYXAoKTtcblxuICAgIGNvbnN0cnVjdG9yKHRhcmdldDogYW55KSB7XG4gICAgICAgIHRhcmdldC5vbm1lc3NhZ2UgPSAoZXY6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMuZ2V0KGV2LmRhdGEuZXZlbnQpIHx8IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgbGlzdGVuZXIgb2YgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyKGV2LmRhdGEuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogV29ya2VyRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBpZiAodGhpcy5ldmVudExpc3RlbmVycy5oYXMoZXZlbnQpKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldmVudCkhLnB1c2gobGlzdGVuZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5zZXQoZXZlbnQsIFtsaXN0ZW5lcl0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lclRvUmVtb3ZlOiBXb3JrZXJFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50TGlzdGVuZXJzLmhhcyhldmVudCkpIHtcbiAgICAgICAgICAgIGxldCBldmVudExpc3RlbmVyc0ZvckV2ZW50ID0gdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpO1xuICAgICAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLnNldChldmVudCwgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudC5maWx0ZXIoKGxpc3RlbmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lciAhPT0gbGlzdGVuZXJUb1JlbW92ZTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVFdmVudExpc3RlbmVyc0ZvckV2ZW50KGV2ZW50OiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5kZWxldGUoZXZlbnQpO1xuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImV4cG9ydCBpbnRlcmZhY2UgU3RhdFZhbHVlcyB7XG4gICAgYXA/OiBudW1iZXI7XG4gICAgc3RyPzogbnVtYmVyO1xuICAgIGFnaT86IG51bWJlcjtcbiAgICBoaXQ/OiBudW1iZXI7XG4gICAgY3JpdD86IG51bWJlcjtcbiAgICBoYXN0ZT86IG51bWJlcjtcbiAgICBzdGF0TXVsdD86IG51bWJlcjtcbiAgICBkYW1hZ2VNdWx0PzogbnVtYmVyO1xuICAgIGFybW9yUGVuZXRyYXRpb24/OiBudW1iZXI7XG4gICAgcGx1c0RhbWFnZT86IG51bWJlcjtcblxuICAgIHN3b3JkU2tpbGw/OiBudW1iZXI7XG4gICAgYXhlU2tpbGw/OiBudW1iZXI7XG4gICAgbWFjZVNraWxsPzogbnVtYmVyO1xuICAgIGRhZ2dlclNraWxsPzogbnVtYmVyO1xuICAgIHN3b3JkMkhTa2lsbD86IG51bWJlcjtcbiAgICBheGUySFNraWxsPzogbnVtYmVyO1xuICAgIG1hY2UySFNraWxsPzogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgU3RhdHMgaW1wbGVtZW50cyBTdGF0VmFsdWVzIHtcbiAgICBhcCE6IG51bWJlcjtcbiAgICBzdHIhOiBudW1iZXI7XG4gICAgYWdpITogbnVtYmVyO1xuICAgIGhpdCE6IG51bWJlcjtcbiAgICBjcml0ITogbnVtYmVyO1xuICAgIGhhc3RlITogbnVtYmVyO1xuICAgIHN0YXRNdWx0ITogbnVtYmVyO1xuICAgIGRhbWFnZU11bHQhOiBudW1iZXI7XG4gICAgYXJtb3JQZW5ldHJhdGlvbiE6IG51bWJlcjtcbiAgICBwbHVzRGFtYWdlITogbnVtYmVyO1xuXG4gICAgc3dvcmRTa2lsbCE6IG51bWJlcjtcbiAgICBheGVTa2lsbCE6IG51bWJlcjtcbiAgICBtYWNlU2tpbGwhOiBudW1iZXI7XG4gICAgZGFnZ2VyU2tpbGwhOiBudW1iZXI7XG4gICAgc3dvcmQySFNraWxsITogbnVtYmVyO1xuICAgIGF4ZTJIU2tpbGwhOiBudW1iZXI7XG4gICAgbWFjZTJIU2tpbGwhOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzPzogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLnNldChzKTtcbiAgICB9XG5cbiAgICBzZXQocz86IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5hcCA9IChzICYmIHMuYXApIHx8IDA7XG4gICAgICAgIHRoaXMuc3RyID0gKHMgJiYgcy5zdHIpIHx8IDA7XG4gICAgICAgIHRoaXMuYWdpID0gKHMgJiYgcy5hZ2kpIHx8IDA7XG4gICAgICAgIHRoaXMuaGl0ID0gKHMgJiYgcy5oaXQpIHx8IDA7XG4gICAgICAgIHRoaXMuY3JpdCA9IChzICYmIHMuY3JpdCkgfHwgMDtcbiAgICAgICAgdGhpcy5oYXN0ZSA9IChzICYmIHMuaGFzdGUpIHx8IDE7XG4gICAgICAgIHRoaXMuc3RhdE11bHQgPSAocyAmJiBzLnN0YXRNdWx0KSB8fCAxO1xuICAgICAgICB0aGlzLmRhbWFnZU11bHQgPSAocyAmJiBzLmRhbWFnZU11bHQpIHx8IDE7XG4gICAgICAgIHRoaXMuYXJtb3JQZW5ldHJhdGlvbiA9IChzICYmIHMuYXJtb3JQZW5ldHJhdGlvbikgfHwgMDtcbiAgICAgICAgdGhpcy5wbHVzRGFtYWdlID0gKHMgJiYgcy5wbHVzRGFtYWdlKSB8fCAwO1xuXG4gICAgICAgIHRoaXMuc3dvcmRTa2lsbCA9IChzICYmIHMuc3dvcmRTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5heGVTa2lsbCA9IChzICYmIHMuYXhlU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMubWFjZVNraWxsID0gKHMgJiYgcy5tYWNlU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuZGFnZ2VyU2tpbGwgPSAocyAmJiBzLmRhZ2dlclNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLnN3b3JkMkhTa2lsbCA9IChzICYmIHMuc3dvcmQySFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmF4ZTJIU2tpbGwgPSAocyAmJiBzLmF4ZTJIU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMubWFjZTJIU2tpbGwgPSAocyAmJiBzLm1hY2UySFNraWxsKSB8fCAwO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGFkZChzOiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuYXAgKz0gKHMuYXAgfHwgMCk7XG4gICAgICAgIHRoaXMuc3RyICs9IChzLnN0ciB8fCAwKTtcbiAgICAgICAgdGhpcy5hZ2kgKz0gKHMuYWdpIHx8IDApO1xuICAgICAgICB0aGlzLmhpdCArPSAocy5oaXQgfHwgMCk7XG4gICAgICAgIHRoaXMuY3JpdCArPSAocy5jcml0IHx8IDApO1xuICAgICAgICB0aGlzLmhhc3RlICo9IChzLmhhc3RlIHx8IDEpO1xuICAgICAgICB0aGlzLnN0YXRNdWx0ICo9IChzLnN0YXRNdWx0IHx8IDEpO1xuICAgICAgICB0aGlzLmRhbWFnZU11bHQgKj0gKHMuZGFtYWdlTXVsdCB8fCAxKTtcbiAgICAgICAgdGhpcy5hcm1vclBlbmV0cmF0aW9uICs9IChzLmFybW9yUGVuZXRyYXRpb24gfHwgMCk7XG4gICAgICAgIHRoaXMucGx1c0RhbWFnZSArPSAocy5wbHVzRGFtYWdlIHx8IDApO1xuXG4gICAgICAgIHRoaXMuc3dvcmRTa2lsbCArPSAocy5zd29yZFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmF4ZVNraWxsICs9IChzLmF4ZVNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLm1hY2VTa2lsbCArPSAocy5tYWNlU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuZGFnZ2VyU2tpbGwgKz0gKHMuZGFnZ2VyU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuc3dvcmQySFNraWxsICs9IChzLnN3b3JkMkhTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5heGUySFNraWxsICs9IChzLmF4ZTJIU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMubWFjZTJIU2tpbGwgKz0gKHMubWFjZTJIU2tpbGwgfHwgMCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RhdHMsIFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBQcm9jLCBFZmZlY3QgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgY2xhc3MgQnVmZk1hbmFnZXIge1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgcHJpdmF0ZSBidWZmTGlzdDogQnVmZkFwcGxpY2F0aW9uW10gPSBbXTtcbiAgICBwcml2YXRlIGJ1ZmZPdmVyVGltZUxpc3Q6IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uW10gPSBbXTtcblxuICAgIGJhc2VTdGF0czogU3RhdHM7XG4gICAgc3RhdHM6IFN0YXRzO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJhc2VTdGF0czogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcbiAgICAgICAgdGhpcy5iYXNlU3RhdHMgPSBuZXcgU3RhdHMoYmFzZVN0YXRzKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IG5ldyBTdGF0cyh0aGlzLmJhc2VTdGF0cyk7XG4gICAgfVxuXG4gICAgZ2V0IG5leHRPdmVyVGltZVVwZGF0ZSgpIHtcbiAgICAgICAgbGV0IHJlcyA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHJlcyA9IE1hdGgubWluKHJlcywgYnVmZk9UQXBwLm5leHRVcGRhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIHByb2Nlc3MgbGFzdCB0aWNrIGJlZm9yZSBpdCBpcyByZW1vdmVkXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIGJ1ZmZPVEFwcC51cGRhdGUodGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbW92ZUV4cGlyZWRCdWZmcyh0aW1lKTtcblxuICAgICAgICB0aGlzLnN0YXRzLnNldCh0aGlzLmJhc2VTdGF0cyk7XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBzdGFja3MgPSBidWZmLnN0YXRzU3RhY2sgPyBzdGFja3MgOiAxO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFja3M7IGkrKykge1xuICAgICAgICAgICAgICAgIGJ1ZmYuYXBwbHkodGhpcy5zdGF0cywgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgYnVmZkFwcCBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBpZiAoYnVmZkFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmYuc3RhY2tzKSB7ICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvZ1N0YWNrSW5jcmVhc2UgPSB0aGlzLnBsYXllci5sb2cgJiYgKCFidWZmLm1heFN0YWNrcyB8fCBidWZmQXBwLnN0YWNrcyA8IGJ1ZmYubWF4U3RhY2tzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZi5pbml0aWFsU3RhY2tzKSB7IC8vIFRPRE8gLSBjaGFuZ2UgdGhpcyB0byBjaGFyZ2VzP1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnN0YWNrcysrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvZ1N0YWNrSW5jcmVhc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxheWVyLmxvZyEoYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZCAoJHtidWZmQXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZGApO1xuICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSBnYWluZWRgICsgKGJ1ZmYuc3RhY2tzID8gYCAoJHtidWZmLmluaXRpYWxTdGFja3MgfHwgMX0pYCA6ICcnKSk7XG5cbiAgICAgICAgaWYgKGJ1ZmYgaW5zdGFuY2VvZiBCdWZmT3ZlclRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5wdXNoKG5ldyBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbih0aGlzLnBsYXllciwgYnVmZiwgYXBwbHlUaW1lKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZMaXN0LnB1c2gobmV3IEJ1ZmZBcHBsaWNhdGlvbihidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBidWZmLmFkZChhcHBseVRpbWUsIHRoaXMucGxheWVyKTtcbiAgICB9XG5cbiAgICByZW1vdmUoYnVmZjogQnVmZiwgdGltZTogbnVtYmVyLCBmdWxsID0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmdWxsICYmIGJ1ZmYuc3RhY2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZhcHAuc3RhY2tzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9ICgke2J1ZmZhcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuc3RhY2tzID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBsb3N0YCk7XG4gICAgICAgICAgICAgICAgYnVmZmFwcC5idWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCA9IHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWU6IG51bWJlcikge1xuICAgICAgICBjb25zdCByZW1vdmVkQnVmZnM6IEJ1ZmZbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuZXhwaXJhdGlvblRpbWUgPD0gdGltZSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRCdWZmcy5wdXNoKGJ1ZmZhcHAuYnVmZik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmYgb2YgcmVtb3ZlZEJ1ZmZzKSB7XG4gICAgICAgICAgICBidWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBleHBpcmVkYCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzfHVuZGVmaW5lZDtcbiAgICBzdGFja3M6IGJvb2xlYW47XG4gICAgZHVyYXRpb246IG51bWJlcjtcbiAgICBpbml0aWFsU3RhY2tzPzogbnVtYmVyO1xuICAgIG1heFN0YWNrcz86IG51bWJlcjtcbiAgICBzdGF0c1N0YWNrOiBib29sZWFuOyAvLyBkbyB5b3UgYWRkIHRoZSBzdGF0IGJvbnVzIGZvciBlYWNoIHN0YWNrPyBvciBpcyBpdCBsaWtlIGZsdXJyeSB3aGVyZSB0aGUgc3RhY2sgaXMgb25seSB0byBjb3VudCBjaGFyZ2VzXG5cbiAgICBwcml2YXRlIGNoaWxkPzogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgc3RhdHM/OiBTdGF0VmFsdWVzLCBzdGFja3M/OiBib29sZWFuLCBpbml0aWFsU3RhY2tzPzogbnVtYmVyLCBtYXhTdGFja3M/OiBudW1iZXIsIGNoaWxkPzogQnVmZiwgc3RhdHNTdGFjayA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuc3RhY2tzID0gISFzdGFja3M7XG4gICAgICAgIHRoaXMuaW5pdGlhbFN0YWNrcyA9IGluaXRpYWxTdGFja3M7XG4gICAgICAgIHRoaXMubWF4U3RhY2tzID0gbWF4U3RhY2tzO1xuICAgICAgICB0aGlzLmNoaWxkID0gY2hpbGQ7XG4gICAgICAgIHRoaXMuc3RhdHNTdGFjayA9IHN0YXRzU3RhY2s7XG4gICAgfVxuXG4gICAgYXBwbHkoc3RhdHM6IFN0YXRzLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5zdGF0cykge1xuICAgICAgICAgICAgc3RhdHMuYWRkKHRoaXMuc3RhdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHt9XG5cbiAgICByZW1vdmUodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5jaGlsZCkge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLnJlbW92ZSh0aGlzLmNoaWxkLCB0aW1lLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmO1xuICAgIGV4cGlyYXRpb25UaW1lITogbnVtYmVyO1xuXG4gICAgc3RhY2tzVmFsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgfVxuXG4gICAgcmVmcmVzaCh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3MgPSB0aGlzLmJ1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxO1xuXG4gICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSB0aW1lICsgdGhpcy5idWZmLmR1cmF0aW9uICogMTAwMDtcblxuICAgICAgICBpZiAodGhpcy5idWZmLmR1cmF0aW9uID4gNjApIHtcbiAgICAgICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzdGFja3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YWNrc1ZhbDtcbiAgICB9XG5cbiAgICBzZXQgc3RhY2tzKHN0YWNrczogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc3RhY2tzVmFsID0gdGhpcy5idWZmLm1heFN0YWNrcyA/IE1hdGgubWluKHRoaXMuYnVmZi5tYXhTdGFja3MsIHN0YWNrcykgOiBzdGFja3M7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZk92ZXJUaW1lIGV4dGVuZHMgQnVmZiB7XG4gICAgdXBkYXRlSW50ZXJ2YWw6IG51bWJlcjtcbiAgICBlZmZlY3Q6IEVmZmVjdDtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgc3RhdHM6IFN0YXRWYWx1ZXN8dW5kZWZpbmVkLCB1cGRhdGVJbnRlcnZhbDogbnVtYmVyLCBlZmZlY3Q6IEVmZmVjdCkge1xuICAgICAgICBzdXBlcihuYW1lLCBkdXJhdGlvbiwgc3RhdHMpO1xuICAgICAgICB0aGlzLnVwZGF0ZUludGVydmFsID0gdXBkYXRlSW50ZXJ2YWw7XG5cbiAgICAgICAgZWZmZWN0LnBhcmVudCA9IHRoaXM7XG4gICAgICAgIHRoaXMuZWZmZWN0ID0gZWZmZWN0O1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuZWZmZWN0LnJ1bihwbGF5ZXIsIHRpbWUpO1xuICAgIH1cbn1cblxuY2xhc3MgQnVmZk92ZXJUaW1lQXBwbGljYXRpb24gZXh0ZW5kcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmZPdmVyVGltZTtcbiAgICBuZXh0VXBkYXRlITogbnVtYmVyO1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJ1ZmY6IEJ1ZmZPdmVyVGltZSwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoYnVmZiwgYXBwbHlUaW1lKTtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMucmVmcmVzaChhcHBseVRpbWUpO1xuICAgIH1cblxuICAgIHJlZnJlc2godGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyLnJlZnJlc2godGltZSk7XG4gICAgICAgIHRoaXMubmV4dFVwZGF0ZSA9IHRpbWUgKyB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgfVxuXG4gICAgdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGltZSA+PSB0aGlzLm5leHRVcGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMubmV4dFVwZGF0ZSArPSB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgICAgICAgICB0aGlzLmJ1ZmYucnVuKHRoaXMucGxheWVyLCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmZQcm9jIGV4dGVuZHMgQnVmZiB7XG4gICAgcHJvYzogUHJvYztcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgcHJvYzogUHJvYywgY2hpbGQ/OiBCdWZmKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGR1cmF0aW9uLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGNoaWxkKTtcbiAgICAgICAgdGhpcy5wcm9jID0gcHJvYztcbiAgICB9XG5cbiAgICBhZGQodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlci5hZGQodGltZSwgcGxheWVyKTtcbiAgICAgICAgcGxheWVyLmFkZFByb2ModGhpcy5wcm9jKTtcbiAgICB9XG5cbiAgICByZW1vdmUodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlci5yZW1vdmUodGltZSwgcGxheWVyKTtcbiAgICAgICAgcGxheWVyLnJlbW92ZVByb2ModGhpcy5wcm9jKTtcbiAgICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gdXJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZyYW5kKG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICAgIHJldHVybiBtaW4gKyBNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFtcCh2YWw6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIE1hdGgubWluKG1heCwgTWF0aC5tYXgobWluLCB2YWwpKTtcbn1cblxuY29uc3QgREVCVUdHSU5HID0gZmFsc2U7XG5cbmlmIChERUJVR0dJTkcpIHtcbiAgICAvLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9tYXRoaWFzYnluZW5zLzU2NzA5MTcjZmlsZS1kZXRlcm1pbmlzdGljLW1hdGgtcmFuZG9tLWpzXG4gICAgTWF0aC5yYW5kb20gPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWVkID0gMHgyRjZFMkIxO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAvLyBSb2JlcnQgSmVua2luc+KAmSAzMiBiaXQgaW50ZWdlciBoYXNoIGZ1bmN0aW9uXG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHg3RUQ1NUQxNikgKyAoc2VlZCA8PCAxMikpICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkIF4gMHhDNzYxQzIzQykgXiAoc2VlZCA+Pj4gMTkpKSAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHgxNjU2NjdCMSkgKyAoc2VlZCA8PCA1KSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHhEM0EyNjQ2QykgXiAoc2VlZCA8PCA5KSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHhGRDcwNDZDNSkgKyAoc2VlZCA8PCAzKSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkIF4gMHhCNTVBNEYwOSkgXiAoc2VlZCA+Pj4gMTYpKSAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICByZXR1cm4gKHNlZWQgJiAweEZGRkZGRkYpIC8gMHgxMDAwMDAwMDtcbiAgICAgICAgfTtcbiAgICB9KCkpO1xufVxuIiwiaW1wb3J0IHsgUGxheWVyLCBNZWxlZUhpdE91dGNvbWUgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBXZWFwb25EZXNjcmlwdGlvbiB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IHVyYW5kIH0gZnJvbSBcIi4vbWF0aC5qc1wiO1xuXG5leHBvcnQgZW51bSBFZmZlY3RGYW1pbHkge1xuICAgIE5PTkUsXG4gICAgV0FSUklPUixcbn1cblxuZXhwb3J0IGVudW0gRWZmZWN0VHlwZSB7XG4gICAgTk9ORSxcbiAgICBCVUZGLFxuICAgIFBIWVNJQ0FMLFxuICAgIFBIWVNJQ0FMX1dFQVBPTixcbiAgICBNQUdJQyxcbn1cblxuaW50ZXJmYWNlIE5hbWVkT2JqZWN0IHtcbiAgICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBFZmZlY3Qge1xuICAgIHR5cGU6IEVmZmVjdFR5cGU7XG4gICAgZmFtaWx5OiBFZmZlY3RGYW1pbHk7XG4gICAgcGFyZW50PzogTmFtZWRPYmplY3Q7XG5cbiAgICBjYW5Qcm9jID0gdHJ1ZTtcblxuICAgIGNvbnN0cnVjdG9yKHR5cGU6IEVmZmVjdFR5cGUsIGZhbWlseSA9IEVmZmVjdEZhbWlseS5OT05FKSB7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuZmFtaWx5ID0gZmFtaWx5O1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGwge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBpc19nY2Q6IGJvb2xlYW47XG4gICAgY29zdDogbnVtYmVyO1xuICAgIGNvb2xkb3duOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIGVmZmVjdHM6IEVmZmVjdFtdO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBpc19nY2Q6IGJvb2xlYW4sIGNvc3Q6IG51bWJlciwgY29vbGRvd246IG51bWJlciwgZWZmZWN0czogRWZmZWN0IHwgRWZmZWN0W10pIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5jb3N0ID0gY29zdDtcbiAgICAgICAgdGhpcy5jb29sZG93biA9IGNvb2xkb3duO1xuICAgICAgICB0aGlzLmlzX2djZCA9IGlzX2djZDtcbiAgICAgICAgdGhpcy5lZmZlY3RzID0gQXJyYXkuaXNBcnJheShlZmZlY3RzKSA/IGVmZmVjdHMgOiBbZWZmZWN0c107XG5cbiAgICAgICAgZm9yIChsZXQgZWZmZWN0IG9mIHRoaXMuZWZmZWN0cykge1xuICAgICAgICAgICAgZWZmZWN0LnBhcmVudCA9IHRoaXM7IC8vIGN1cnJlbnRseSBvbmx5IHVzZWQgZm9yIGxvZ2dpbmcuIGRvbid0IHJlYWxseSB3YW50IHRvIGRvIHRoaXNcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNhc3QocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCBlZmZlY3Qgb2YgdGhpcy5lZmZlY3RzKSB7XG4gICAgICAgICAgICBlZmZlY3QucnVuKHBsYXllciwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3BlbGwge1xuICAgIHNwZWxsOiBTcGVsbDtcbiAgICBjb29sZG93biA9IDA7XG4gICAgY2FzdGVyOiBQbGF5ZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuc3BlbGwgPSBzcGVsbDtcbiAgICAgICAgdGhpcy5jYXN0ZXIgPSBjYXN0ZXI7XG4gICAgfVxuXG4gICAgb25Db29sZG93bih0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29vbGRvd24gPiB0aW1lO1xuICAgIH1cblxuICAgIHRpbWVSZW1haW5pbmcodGltZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCAodGhpcy5jb29sZG93biAtIHRpbWUpIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgY2FuQ2FzdCh0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkICYmIHRoaXMuY2FzdGVyLm5leHRHQ0RUaW1lID4gdGltZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuY29zdCA+IHRoaXMuY2FzdGVyLnBvd2VyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vbkNvb2xkb3duKHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjYXN0KHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkKSB7XG4gICAgICAgICAgICB0aGlzLmNhc3Rlci5uZXh0R0NEVGltZSA9IHRpbWUgKyAxNTAwICsgdGhpcy5jYXN0ZXIubGF0ZW5jeTsgLy8gVE9ETyAtIG5lZWQgdG8gc3R1ZHkgdGhlIGVmZmVjdHMgb2YgbGF0ZW5jeSBpbiB0aGUgZ2FtZSBhbmQgY29uc2lkZXIgaHVtYW4gcHJlY2lzaW9uXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuY2FzdGVyLnBvd2VyIC09IHRoaXMuc3BlbGwuY29zdDtcblxuICAgICAgICB0aGlzLnNwZWxsLmNhc3QodGhpcy5jYXN0ZXIsIHRpbWUpO1xuXG4gICAgICAgIHRoaXMuY29vbGRvd24gPSB0aW1lICsgdGhpcy5zcGVsbC5jb29sZG93biAqIDEwMDAgKyB0aGlzLmNhc3Rlci5sYXRlbmN5O1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vZGlmeVBvd2VyRWZmZWN0IGV4dGVuZHMgRWZmZWN0IHtcbiAgICBhbW91bnQ6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGFtb3VudDogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKEVmZmVjdFR5cGUuTk9ORSk7XG4gICAgICAgIHRoaXMuYW1vdW50ID0gYW1vdW50O1xuICAgIH1cbiAgICBcbiAgICBydW4ocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikge1xuICAgICAgICBwbGF5ZXIucG93ZXIgKz0gdGhpcy5hbW91bnQ7XG4gICAgICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbiAke3RoaXMuYW1vdW50fSByYWdlIGZyb20gJHt0aGlzLnBhcmVudCEubmFtZX1gKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2luZ0VmZmVjdCBleHRlbmRzIEVmZmVjdCB7XG4gICAgYm9udXNEYW1hZ2U6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGJvbnVzRGFtYWdlOiBudW1iZXIsIGZhbWlseT86IEVmZmVjdEZhbWlseSkge1xuICAgICAgICBzdXBlcihFZmZlY3RUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgZmFtaWx5KTtcbiAgICAgICAgdGhpcy5ib251c0RhbWFnZSA9IGJvbnVzRGFtYWdlO1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGlzX21oID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgcmF3RGFtYWdlID0gcGxheWVyLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oKTtcbiAgICAgICAgcGxheWVyLmRlYWxNZWxlZURhbWFnZSh0aW1lLCByYXdEYW1hZ2UgKyB0aGlzLmJvbnVzRGFtYWdlLCBwbGF5ZXIudGFyZ2V0ISwgaXNfbWgsIHRoaXMpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aW5nU3BlbGwgZXh0ZW5kcyBTcGVsbCB7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGZhbWlseTogRWZmZWN0RmFtaWx5LCBib251c0RhbWFnZTogbnVtYmVyLCBjb3N0OiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZmFsc2UsIGNvc3QsIDAsIG5ldyBTd2luZ0VmZmVjdChib251c0RhbWFnZSwgZmFtaWx5KSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGVhcm5lZFN3aW5nU3BlbGwgZXh0ZW5kcyBMZWFybmVkU3BlbGwge1xuICAgIHNwZWxsOiBTd2luZ1NwZWxsO1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKHNwZWxsOiBTd2luZ1NwZWxsLCBjYXN0ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlcihzcGVsbCwgY2FzdGVyKTtcbiAgICAgICAgdGhpcy5zcGVsbCA9IHNwZWxsOyAvLyBUT0RPIC0gaXMgdGhlcmUgYSB3YXkgdG8gYXZvaWQgdGhpcyBsaW5lP1xuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2sgPSAocGxheWVyOiBQbGF5ZXIsIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSkgPT4gdm9pZDtcblxudHlwZSBTcGVsbERhbWFnZUFtb3VudCA9IG51bWJlcnxbbnVtYmVyLCBudW1iZXJdfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlcik7XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZUVmZmVjdCBleHRlbmRzIEVmZmVjdCB7XG4gICAgY2FsbGJhY2s/OiBTcGVsbEhpdE91dGNvbWVDYWxsYmFjaztcbiAgICBhbW91bnQ6IFNwZWxsRGFtYWdlQW1vdW50O1xuXG4gICAgY29uc3RydWN0b3IodHlwZTogRWZmZWN0VHlwZSwgZmFtaWx5OiBFZmZlY3RGYW1pbHksIGFtb3VudDogU3BlbGxEYW1hZ2VBbW91bnQsIGNhbGxiYWNrPzogU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2spIHtcbiAgICAgICAgc3VwZXIodHlwZSwgZmFtaWx5KTtcbiAgICAgICAgdGhpcy5hbW91bnQgPSBhbW91bnQ7XG4gICAgICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICB9XG5cbiAgICBwcml2YXRlIGNhbGN1bGF0ZUFtb3VudChwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICByZXR1cm4gKHRoaXMuYW1vdW50IGluc3RhbmNlb2YgRnVuY3Rpb24pID8gdGhpcy5hbW91bnQocGxheWVyKSA6IChBcnJheS5pc0FycmF5KHRoaXMuYW1vdW50KSA/IHVyYW5kKC4uLnRoaXMuYW1vdW50KSA6dGhpcy5hbW91bnQpXG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpIHsgICAgICAgICAgICBcbiAgICAgICAgaWYgKHRoaXMudHlwZSA9PT0gRWZmZWN0VHlwZS5QSFlTSUNBTCB8fCB0aGlzLnR5cGUgPT09IEVmZmVjdFR5cGUuUEhZU0lDQUxfV0VBUE9OKSB7XG4gICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHRoaXMuY2FsY3VsYXRlQW1vdW50KHBsYXllciksIHBsYXllci50YXJnZXQhLCB0cnVlLCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnR5cGUgPT09IEVmZmVjdFR5cGUuTUFHSUMpIHtcbiAgICAgICAgICAgIHBsYXllci5kZWFsU3BlbGxEYW1hZ2UodGltZSwgdGhpcy5jYWxjdWxhdGVBbW91bnQocGxheWVyKSwgcGxheWVyLnRhcmdldCEsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGxEYW1hZ2UgZXh0ZW5kcyBTcGVsbCB7XG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IFNwZWxsRGFtYWdlQW1vdW50LCB0eXBlOiBFZmZlY3RUeXBlLCBmYW1pbHkgPSBFZmZlY3RGYW1pbHkuTk9ORSwgaXNfZ2NkID0gZmFsc2UsIGNvc3QgPSAwLCBjb29sZG93biA9IDAsIGNhbGxiYWNrPzogU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2spIHtcbiAgICAgICAgc3VwZXIobmFtZSwgaXNfZ2NkLCBjb3N0LCBjb29sZG93biwgbmV3IFNwZWxsRGFtYWdlRWZmZWN0KHR5cGUsIGZhbWlseSwgYW1vdW50LCBjYWxsYmFjaykpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEl0ZW1TcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsRGFtYWdlIHtcbiAgICBjYW5Qcm9jID0gZmFsc2U7IC8vIFRPRE8gLSBjb25maXJtIHRoaXMgaXMgYmxpenpsaWtlLCBhbHNvIHNvbWUgaXRlbSBwcm9jcyBtYXkgYmUgYWJsZSB0byBwcm9jIGJ1dCBvbiBMSCBjb3JlLCBmYXRhbCB3b3VuZCBjYW4ndFxuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IFNwZWxsRGFtYWdlQW1vdW50LCB0eXBlOiBFZmZlY3RUeXBlKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGFtb3VudCwgdHlwZSwgRWZmZWN0RmFtaWx5Lk5PTkUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrRWZmZWN0IGV4dGVuZHMgRWZmZWN0IHtcbiAgICBjb3VudDogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoY291bnQ6IG51bWJlcikge1xuICAgICAgICBzdXBlcihFZmZlY3RUeXBlLk5PTkUpO1xuICAgICAgICB0aGlzLmNvdW50ID0gY291bnQ7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAvLyBjYW4ndCBwcm9jIGV4dHJhIGF0dGFjayBkdXJpbmcgYW4gZXh0cmEgYXR0YWNrXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBwbGF5ZXIuZXh0cmFBdHRhY2tDb3VudCArPSB0aGlzLmNvdW50OyAvLyBMSCBjb2RlIGRvZXMgbm90IGFsbG93IG11bHRpcGxlIGF1dG8gYXR0YWNrcyB0byBzdGFjayBpZiB0aGV5IHByb2MgdG9nZXRoZXIuIEJsaXp6bGlrZSBtYXkgYWxsb3cgdGhlbSB0byBzdGFjayBcbiAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYEdhaW5lZCAke3RoaXMuY291bnR9IGV4dHJhIGF0dGFja3MgZnJvbSAke3RoaXMucGFyZW50IS5uYW1lfWApO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikge1xuICAgICAgICAvLyBzcGVsbHR5cGUgZG9lc24ndCBtYXR0ZXJcbiAgICAgICAgc3VwZXIobmFtZSwgZmFsc2UsIDAsIDAsIG5ldyBFeHRyYUF0dGFja0VmZmVjdChjb3VudCkpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNwZWxsQnVmZkVmZmVjdCBleHRlbmRzIEVmZmVjdCB7XG4gICAgYnVmZjogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKGJ1ZmY6IEJ1ZmYpIHtcbiAgICAgICAgc3VwZXIoRWZmZWN0VHlwZS5CVUZGKTtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICB9XG5cbiAgICBydW4ocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikge1xuICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKHRoaXMuYnVmZiwgdGltZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGxCdWZmIGV4dGVuZHMgU3BlbGwge1xuICAgIGJ1ZmY6IEJ1ZmY7XG5cbiAgICBjb25zdHJ1Y3RvcihidWZmOiBCdWZmLCBpc19nY2QgPSBmYWxzZSwgY29zdCA9IDAsIGNvb2xkb3duID0gMCkge1xuICAgICAgICBzdXBlcihgU3BlbGxCdWZmKCR7YnVmZi5uYW1lfSlgLCBpc19nY2QsIGNvc3QsIGNvb2xkb3duLCBuZXcgU3BlbGxCdWZmRWZmZWN0KGJ1ZmYpKTtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICB9XG59XG5cbnR5cGUgcHBtID0ge3BwbTogbnVtYmVyfTtcbnR5cGUgY2hhbmNlID0ge2NoYW5jZTogbnVtYmVyfTtcbnR5cGUgcmF0ZSA9IHBwbSB8IGNoYW5jZTtcblxuZXhwb3J0IGNsYXNzIFByb2Mge1xuICAgIHByb3RlY3RlZCBzcGVsbHM6IFNwZWxsW107XG4gICAgcHJvdGVjdGVkIHJhdGU6IHJhdGU7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwgfCBTcGVsbFtdLCByYXRlOiByYXRlKSB7XG4gICAgICAgIHRoaXMuc3BlbGxzID0gQXJyYXkuaXNBcnJheShzcGVsbCkgPyBzcGVsbCA6IFtzcGVsbF07XG4gICAgICAgIHRoaXMucmF0ZSA9IHJhdGU7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2hhbmNlID0gKDxjaGFuY2U+dGhpcy5yYXRlKS5jaGFuY2UgfHwgKDxwcG0+dGhpcy5yYXRlKS5wcG0gKiB3ZWFwb24uc3BlZWQgLyA2MDtcblxuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8PSBjaGFuY2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IHNwZWxsIG9mIHRoaXMuc3BlbGxzKSB7XG4gICAgICAgICAgICAgICAgc3BlbGwuY2FzdChwbGF5ZXIsIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBQcm9jLCBTcGVsbCwgTGVhcm5lZFNwZWxsIH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IEVuY2hhbnREZXNjcmlwdGlvbiB9IGZyb20gXCIuL2RhdGEvZW5jaGFudHMuanNcIjtcblxuZXhwb3J0IGVudW0gSXRlbVNsb3Qge1xuICAgIE1BSU5IQU5EID0gMSA8PCAwLFxuICAgIE9GRkhBTkQgPSAxIDw8IDEsXG4gICAgVFJJTktFVDEgPSAxIDw8IDIsXG4gICAgVFJJTktFVDIgPSAxIDw8IDMsXG4gICAgSEVBRCA9IDEgPDwgNCxcbiAgICBORUNLID0gMSA8PCA1LFxuICAgIFNIT1VMREVSID0gMSA8PCA2LFxuICAgIEJBQ0sgPSAxIDw8IDcsXG4gICAgQ0hFU1QgPSAxIDw8IDgsXG4gICAgV1JJU1QgPSAxIDw8IDksXG4gICAgSEFORFMgPSAxIDw8IDEwLFxuICAgIFdBSVNUID0gMSA8PCAxMSxcbiAgICBMRUdTID0gMSA8PCAxMixcbiAgICBGRUVUID0gMSA8PCAxMyxcbiAgICBSSU5HMSA9IDEgPDwgMTQsXG4gICAgUklORzIgPSAxIDw8IDE1LFxuICAgIFJBTkdFRCA9IDEgPDwgMTYsXG59XG5cbmV4cG9ydCBjb25zdCBpdGVtU2xvdEhhc0VuY2hhbnQ6IHtbVEtleSBpbiBJdGVtU2xvdF06IGJvb2xlYW59ID0ge1xuICAgIFtJdGVtU2xvdC5NQUlOSEFORF06IHRydWUsXG4gICAgW0l0ZW1TbG90Lk9GRkhBTkRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5IRUFEXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuTkVDS106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5TSE9VTERFUl06IHRydWUsXG4gICAgW0l0ZW1TbG90LkJBQ0tdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5DSEVTVF06IHRydWUsXG4gICAgW0l0ZW1TbG90LldSSVNUXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuSEFORFNdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5XQUlTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5MRUdTXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuRkVFVF06IHRydWUsXG4gICAgW0l0ZW1TbG90LlJJTkcxXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LlJJTkcyXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LlJBTkdFRF06IGZhbHNlLFxufTtcblxuZXhwb3J0IGNvbnN0IGl0ZW1TbG90SGFzVGVtcG9yYXJ5RW5jaGFudDoge1tUS2V5IGluIEl0ZW1TbG90XTogYm9vbGVhbn0gPSB7XG4gICAgW0l0ZW1TbG90Lk1BSU5IQU5EXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuT0ZGSEFORF06IHRydWUsXG4gICAgW0l0ZW1TbG90LlRSSU5LRVQxXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LlRSSU5LRVQyXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkhFQURdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuTkVDS106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5TSE9VTERFUl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5CQUNLXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkNIRVNUXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LldSSVNUXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkhBTkRTXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LldBSVNUXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkxFR1NdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuRkVFVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SSU5HMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SSU5HMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SQU5HRURdOiBmYWxzZSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSXRlbURlc2NyaXB0aW9uIHtcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2xvdDogSXRlbVNsb3QsXG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxuICAgIG9udXNlPzogU3BlbGwsXG4gICAgb25lcXVpcD86IFByb2MsXG59XG5cbmV4cG9ydCBlbnVtIFdlYXBvblR5cGUge1xuICAgIE1BQ0UsXG4gICAgU1dPUkQsXG4gICAgQVhFLFxuICAgIERBR0dFUixcbiAgICBNQUNFMkgsXG4gICAgU1dPUkQySCxcbiAgICBBWEUySCxcbn1cblxuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZWRXZWFwb25TcGVlZDoge1tUS2V5IGluIFdlYXBvblR5cGVdOiBudW1iZXJ9ID0ge1xuICAgIFtXZWFwb25UeXBlLk1BQ0VdOiAyLjQsXG4gICAgW1dlYXBvblR5cGUuU1dPUkRdOiAyLjQsXG4gICAgW1dlYXBvblR5cGUuQVhFXTogMi40LFxuICAgIFtXZWFwb25UeXBlLkRBR0dFUl06IDEuNyxcbiAgICBbV2VhcG9uVHlwZS5NQUNFMkhdOiAzLjMsXG4gICAgW1dlYXBvblR5cGUuU1dPUkQySF06IDMuMyxcbiAgICBbV2VhcG9uVHlwZS5BWEUySF06IDMuMyxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXZWFwb25EZXNjcmlwdGlvbiBleHRlbmRzIEl0ZW1EZXNjcmlwdGlvbiB7XG4gICAgdHlwZTogV2VhcG9uVHlwZSxcbiAgICBtaW46IG51bWJlcixcbiAgICBtYXg6IG51bWJlcixcbiAgICBzcGVlZDogbnVtYmVyLFxuICAgIG9uaGl0PzogUHJvYyxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzV2VhcG9uKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbik6IGl0ZW0gaXMgV2VhcG9uRGVzY3JpcHRpb24ge1xuICAgIHJldHVybiBcInNwZWVkXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXF1aXBlZFdlYXBvbihpdGVtOiBJdGVtRXF1aXBlZCk6IGl0ZW0gaXMgV2VhcG9uRXF1aXBlZCB7XG4gICAgcmV0dXJuIFwid2VhcG9uXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGNsYXNzIEl0ZW1FcXVpcGVkIHtcbiAgICBpdGVtOiBJdGVtRGVzY3JpcHRpb247XG4gICAgb251c2U/OiBMZWFybmVkU3BlbGw7XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBJdGVtRGVzY3JpcHRpb24sIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuaXRlbSA9IGl0ZW07XG5cbiAgICAgICAgaWYgKGl0ZW0ub251c2UpIHtcbiAgICAgICAgICAgIHRoaXMub251c2UgPSBuZXcgTGVhcm5lZFNwZWxsKGl0ZW0ub251c2UsIHBsYXllcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5vbmVxdWlwKSB7IC8vIFRPRE8sIG1vdmUgdGhpcyB0byBidWZmcHJvYz8gdGhpcyBtYXkgYmUgc2ltcGxlciB0aG91Z2ggc2luY2Ugd2Uga25vdyB0aGUgYnVmZiB3b24ndCBiZSByZW1vdmVkXG4gICAgICAgICAgICBwbGF5ZXIuYWRkUHJvYyhpdGVtLm9uZXF1aXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXNlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy5vbnVzZSkge1xuICAgICAgICAgICAgdGhpcy5vbnVzZS5jYXN0KHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2VhcG9uRXF1aXBlZCBleHRlbmRzIEl0ZW1FcXVpcGVkIHtcbiAgICB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uO1xuICAgIG5leHRTd2luZ1RpbWU6IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgcHJvY3M6IFByb2NbXSA9IFtdO1xuICAgIHByb3RlY3RlZCBwbGF5ZXI6IFBsYXllcjtcbiAgICBwdWJsaWMgdGVtcG9yYXJ5RW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbjtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IFdlYXBvbkRlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllciwgZW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbiwgdGVtcG9yYXJ5RW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbikge1xuICAgICAgICBzdXBlcihpdGVtLCBwbGF5ZXIpO1xuICAgICAgICB0aGlzLndlYXBvbiA9IGl0ZW07XG4gICAgICAgIFxuICAgICAgICBpZiAoaXRlbS5vbmhpdCkge1xuICAgICAgICAgICAgdGhpcy5hZGRQcm9jKGl0ZW0ub25oaXQpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW5jaGFudCAmJiBlbmNoYW50LnByb2MpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkUHJvYyhlbmNoYW50LnByb2MpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMudGVtcG9yYXJ5RW5jaGFudCA9IHRlbXBvcmFyeUVuY2hhbnQ7XG5cbiAgICAgICAgdGhpcy5uZXh0U3dpbmdUaW1lID0gMTAwOyAvLyBUT0RPIC0gbmVlZCB0byByZXNldCB0aGlzIHByb3Blcmx5IGlmIGV2ZXIgd2FudCB0byBzaW11bGF0ZSBmaWdodHMgd2hlcmUgeW91IHJ1biBvdXRcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldCBwbHVzRGFtYWdlKCkge1xuICAgICAgICBpZiAodGhpcy50ZW1wb3JhcnlFbmNoYW50ICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cyAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMucGx1c0RhbWFnZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5wbHVzRGFtYWdlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaW4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5taW4gKyB0aGlzLnBsdXNEYW1hZ2U7XG4gICAgfVxuXG4gICAgZ2V0IG1heCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2VhcG9uLm1heCArIHRoaXMucGx1c0RhbWFnZTtcbiAgICB9XG5cbiAgICBhZGRQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgdGhpcy5wcm9jcy5wdXNoKHApO1xuICAgIH1cblxuICAgIHByb2ModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGZvciAobGV0IHByb2Mgb2YgdGhpcy5wcm9jcykge1xuICAgICAgICAgICAgcHJvYy5ydW4odGhpcy5wbGF5ZXIsIHRoaXMud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdpbmRmdXJ5IHByb2NzIGxhc3RcbiAgICAgICAgaWYgKHRoaXMudGVtcG9yYXJ5RW5jaGFudCAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQucHJvYykge1xuICAgICAgICAgICAgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnByb2MucnVuKHRoaXMucGxheWVyLCB0aGlzLndlYXBvbiwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgVW5pdCB7XG4gICAgbGV2ZWw6IG51bWJlcjtcbiAgICBhcm1vcjogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IobGV2ZWw6IG51bWJlciwgYXJtb3I6IG51bWJlcikge1xuICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgIHRoaXMuYXJtb3IgPSBhcm1vcjtcbiAgICB9XG5cbiAgICBnZXQgbWF4U2tpbGxGb3JMZXZlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiA1O1xuICAgIH1cblxuICAgIGdldCBkZWZlbnNlU2tpbGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgfVxuXG4gICAgZ2V0IGRvZGdlQ2hhbmNlKCkge1xuICAgICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVBcm1vclJlZHVjZWREYW1hZ2UoZGFtYWdlOiBudW1iZXIsIGF0dGFja2VyOiBQbGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYXJtb3IgPSBNYXRoLm1heCgwLCB0aGlzLmFybW9yIC0gYXR0YWNrZXIuYnVmZk1hbmFnZXIuc3RhdHMuYXJtb3JQZW5ldHJhdGlvbik7XG4gICAgICAgIFxuICAgICAgICBsZXQgdG1wdmFsdWUgPSAwLjEgKiBhcm1vciAgLyAoKDguNSAqIGF0dGFja2VyLmxldmVsKSArIDQwKTtcbiAgICAgICAgdG1wdmFsdWUgLz0gKDEgKyB0bXB2YWx1ZSk7XG5cbiAgICAgICAgY29uc3QgYXJtb3JNb2RpZmllciA9IGNsYW1wKHRtcHZhbHVlLCAwLCAwLjc1KTtcblxuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMSwgZGFtYWdlIC0gKGRhbWFnZSAqIGFybW9yTW9kaWZpZXIpKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBXZWFwb25FcXVpcGVkLCBXZWFwb25UeXBlLCBJdGVtRGVzY3JpcHRpb24sIEl0ZW1FcXVpcGVkLCBJdGVtU2xvdCwgaXNFcXVpcGVkV2VhcG9uLCBpc1dlYXBvbiwgbm9ybWFsaXplZFdlYXBvblNwZWVkIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IHVyYW5kLCBjbGFtcCwgZnJhbmQgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBCdWZmTWFuYWdlciB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFByb2MsIExlYXJuZWRTd2luZ1NwZWxsLCBFZmZlY3RUeXBlLCBTcGVsbERhbWFnZUVmZmVjdCwgRWZmZWN0IH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IExIX0NPUkVfQlVHIH0gZnJvbSBcIi4vc2ltX3NldHRpbmdzLmpzXCI7XG5pbXBvcnQgeyBFbmNoYW50RGVzY3JpcHRpb24gfSBmcm9tIFwiLi9kYXRhL2VuY2hhbnRzLmpzXCI7XG5cbmV4cG9ydCBlbnVtIFJhY2Uge1xuICAgIEhVTUFOLFxuICAgIE9SQyxcbn1cblxuZXhwb3J0IGVudW0gRmFjdGlvbiB7XG4gICAgQUxMSUFOQ0UsXG4gICAgSE9SREUsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCB0eXBlIERhbWFnZUxvZyA9IFtudW1iZXIsIG51bWJlcl1bXTtcblxuZXhwb3J0IGNsYXNzIFBsYXllciBleHRlbmRzIFVuaXQge1xuICAgIGl0ZW1zOiBNYXA8SXRlbVNsb3QsIEl0ZW1FcXVpcGVkPiA9IG5ldyBNYXAoKTtcbiAgICBwcm9jczogUHJvY1tdID0gW107XG5cbiAgICB0YXJnZXQ6IFVuaXQgfCB1bmRlZmluZWQ7XG5cbiAgICBuZXh0R0NEVGltZSA9IDA7XG4gICAgZXh0cmFBdHRhY2tDb3VudCA9IDA7XG4gICAgZG9pbmdFeHRyYUF0dGFja3MgPSBmYWxzZTtcblxuICAgIGJ1ZmZNYW5hZ2VyOiBCdWZmTWFuYWdlcjtcblxuICAgIGRhbWFnZUxvZzogRGFtYWdlTG9nID0gW107XG5cbiAgICBxdWV1ZWRTcGVsbDogTGVhcm5lZFN3aW5nU3BlbGx8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgbG9nPzogTG9nRnVuY3Rpb247XG5cbiAgICBsYXRlbmN5ID0gNTA7IC8vIG1zXG5cbiAgICBwb3dlckxvc3QgPSAwO1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHN1cGVyKDYwLCAwKTsgLy8gbHZsLCBhcm1vclxuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIgPSBuZXcgQnVmZk1hbmFnZXIodGhpcywgbmV3IFN0YXRzKHN0YXRzKSk7XG4gICAgICAgIHRoaXMubG9nID0gbG9nO1xuICAgIH1cblxuICAgIGdldCBtaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5NQUlOSEFORCk7XG5cbiAgICAgICAgaWYgKGVxdWlwZWQgJiYgaXNFcXVpcGVkV2VhcG9uKGVxdWlwZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXF1aXBlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5PRkZIQU5EKTtcblxuICAgICAgICBpZiAoZXF1aXBlZCAmJiBpc0VxdWlwZWRXZWFwb24oZXF1aXBlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcXVpcGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZXF1aXAoc2xvdDogSXRlbVNsb3QsIGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgZW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbiwgdGVtcG9yYXJ5RW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbikge1xuICAgICAgICBpZiAodGhpcy5pdGVtcy5oYXMoc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFscmVhZHkgaGF2ZSBpdGVtIGluIHNsb3QgJHtJdGVtU2xvdFtzbG90XX1gKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEoaXRlbS5zbG90ICYgc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGNhbm5vdCBlcXVpcCAke2l0ZW0ubmFtZX0gaW4gc2xvdCAke0l0ZW1TbG90W3Nsb3RdfWApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5zdGF0cykge1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5iYXNlU3RhdHMuYWRkKGl0ZW0uc3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuY2hhbnQgJiYgZW5jaGFudC5zdGF0cykge1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5iYXNlU3RhdHMuYWRkKGVuY2hhbnQuc3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETyAtIGhhbmRsZSBlcXVpcHBpbmcgMkggKGFuZCBob3cgdGhhdCBkaXNhYmxlcyBPSClcbiAgICAgICAgLy8gVE9ETyAtIGFzc3VtaW5nIG9ubHkgd2VhcG9uIGVuY2hhbnRzIGNhbiBoYXZlIHByb2NzXG4gICAgICAgIGlmIChpc1dlYXBvbihpdGVtKSkge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IFdlYXBvbkVxdWlwZWQoaXRlbSwgdGhpcywgZW5jaGFudCwgdGVtcG9yYXJ5RW5jaGFudCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IEl0ZW1FcXVpcGVkKGl0ZW0sIHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwb3dlcigpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge31cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcmVtb3ZlUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIC8vIFRPRE8gLSBlaXRoZXIgcHJvY3Mgc2hvdWxkIGJlIGEgc2V0IG9yIHdlIG5lZWQgUHJvY0FwcGxpY2F0aW9uXG4gICAgICAgIHRoaXMucHJvY3MgPSB0aGlzLnByb2NzLmZpbHRlcigocHJvYzogUHJvYykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHByb2MgIT09IHA7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oOiBib29sZWFuLCBlZmZlY3Q/OiBFZmZlY3QpIHtcbiAgICAgICAgaWYgKGVmZmVjdCAmJiBlZmZlY3QudHlwZSAhPT0gRWZmZWN0VHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3ZWFwb24gPSBpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCE7XG4gICAgICAgIGNvbnN0IHdlYXBvblR5cGUgPSB3ZWFwb24ud2VhcG9uLnR5cGU7XG5cbiAgICAgICAgLy8gVE9ETywgbWFrZSB0aGlzIGEgbWFwXG4gICAgICAgIHN3aXRjaCAod2VhcG9uVHlwZSkge1xuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLk1BQ0U6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMubWFjZVNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLlNXT1JEOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN3b3JkU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuQVhFOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmF4ZVNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkRBR0dFUjpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5kYWdnZXJTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5NQUNFMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMubWFjZTJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuU1dPUkQySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zd29yZDJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuQVhFMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXhlMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgZWZmZWN0PzogRWZmZWN0KSB7XG4gICAgICAgIGlmIChMSF9DT1JFX0JVRyAmJiBlZmZlY3QgJiYgZWZmZWN0LnR5cGUgPT0gRWZmZWN0VHlwZS5QSFlTSUNBTCkge1xuICAgICAgICAgICAgLy8gb24gTEggY29yZSwgbm9uIHdlYXBvbiBzcGVsbHMgbGlrZSBibG9vZHRoaXJzdCBhcmUgYmVuZWZpdHRpbmcgZnJvbSB3ZWFwb24gc2tpbGxcbiAgICAgICAgICAgIC8vIHRoaXMgb25seSBhZmZlY3RzIGNyaXQsIG5vdCBoaXQvZG9kZ2UvcGFycnlcbiAgICAgICAgICAgIC8vIHNldCB0aGUgc3BlbGwgdG8gdW5kZWZpbmVkIHNvIGl0IGlzIHRyZWF0ZWQgbGlrZSBhIG5vcm1hbCBtZWxlZSBhdHRhY2sgKHJhdGhlciB0aGFuIHVzaW5nIGEgZHVtbXkgc3BlbGwpXG4gICAgICAgICAgICAvLyB3aGVuIGNhbGN1bGF0aW5nIHdlYXBvbiBza2lsbFxuICAgICAgICAgICAgZWZmZWN0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNyaXQgPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmNyaXQ7XG4gICAgICAgIGNyaXQgKz0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5hZ2kgKiB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0YXRNdWx0IC8gMjA7XG5cbiAgICAgICAgaWYgKCFlZmZlY3QgfHwgZWZmZWN0LnR5cGUgPT0gRWZmZWN0VHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgIGNvbnN0IHdlYXBvbiA9IGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oITtcblxuICAgICAgICAgICAgaWYgKHdlYXBvbi50ZW1wb3JhcnlFbmNoYW50ICYmIHdlYXBvbi50ZW1wb3JhcnlFbmNoYW50LnN0YXRzICYmIHdlYXBvbi50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLmNyaXQpIHtcbiAgICAgICAgICAgICAgICBjcml0ICs9IHdlYXBvbi50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLmNyaXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBza2lsbEJvbnVzID0gMC4wNCAqICh0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgsIGVmZmVjdCkgLSB2aWN0aW0ubWF4U2tpbGxGb3JMZXZlbCk7XG4gICAgICAgIGNyaXQgKz0gc2tpbGxCb251cztcblxuICAgICAgICByZXR1cm4gY3JpdDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlTWlzc0NoYW5jZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBlZmZlY3Q/OiBFZmZlY3QpIHtcbiAgICAgICAgbGV0IHJlcyA9IDU7XG4gICAgICAgIHJlcyAtPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhpdDtcblxuICAgICAgICBpZiAodGhpcy5vaCAmJiAhZWZmZWN0KSB7XG4gICAgICAgICAgICByZXMgKz0gMTk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgZWZmZWN0KSAtIHZpY3RpbS5kZWZlbnNlU2tpbGw7XG5cbiAgICAgICAgaWYgKHNraWxsRGlmZiA8IC0xMCkge1xuICAgICAgICAgICAgcmVzIC09IChza2lsbERpZmYgKyAxMCkgKiAwLjQgLSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzIC09IHNraWxsRGlmZiAqIDAuMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbGFtcChyZXMsIDAsIDYwKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlR2xhbmNpbmdSZWR1Y3Rpb24odmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBjb25zdCBza2lsbERpZmYgPSB2aWN0aW0uZGVmZW5zZVNraWxsICAtIHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCk7XG5cbiAgICAgICAgaWYgKHNraWxsRGlmZiA+PSAxNSkge1xuICAgICAgICAgICAgcmV0dXJuIDAuNjU7XG4gICAgICAgIH0gZWxzZSBpZiAoc2tpbGxEaWZmIDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc2tpbGxEaWZmVG9SZWR1Y3Rpb25bc2tpbGxEaWZmXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhcCgpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZVN3aW5nTWluTWF4RGFtYWdlKGlzX21oOiBib29sZWFuLCBub3JtYWxpemVkID0gZmFsc2UpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuXG4gICAgICAgIGNvbnN0IGFwX2JvbnVzID0gdGhpcy5hcCAvIDE0ICogKG5vcm1hbGl6ZWQgPyBub3JtYWxpemVkV2VhcG9uU3BlZWRbd2VhcG9uLndlYXBvbi50eXBlXSA6IHdlYXBvbi53ZWFwb24uc3BlZWQpO1xuXG4gICAgICAgIGNvbnN0IG9oUGVuYWx0eSA9IGlzX21oID8gMSA6IDAuNjI1OyAvLyBUT0RPIC0gY2hlY2sgdGFsZW50cywgaW1wbGVtZW50ZWQgYXMgYW4gYXVyYSBTUEVMTF9BVVJBX01PRF9PRkZIQU5EX0RBTUFHRV9QQ1RcblxuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgKHdlYXBvbi5taW4gKyBhcF9ib251cykgKiBvaFBlbmFsdHksXG4gICAgICAgICAgICAod2VhcG9uLm1heCArIGFwX2JvbnVzKSAqIG9oUGVuYWx0eVxuICAgICAgICBdO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oOiBib29sZWFuLCBub3JtYWxpemVkID0gZmFsc2UpIHtcbiAgICAgICAgcmV0dXJuIGZyYW5kKC4uLnRoaXMuY2FsY3VsYXRlU3dpbmdNaW5NYXhEYW1hZ2UoaXNfbWgsIG5vcm1hbGl6ZWQpKTtcbiAgICB9XG5cbiAgICBjcml0Q2FwKCkge1xuICAgICAgICBjb25zdCBza2lsbEJvbnVzID0gNCAqICh0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUodHJ1ZSkgLSB0aGlzLnRhcmdldCEubWF4U2tpbGxGb3JMZXZlbCk7XG4gICAgICAgIGNvbnN0IG1pc3NfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZU1pc3NDaGFuY2UodGhpcy50YXJnZXQhLCB0cnVlKSAqIDEwMCk7XG4gICAgICAgIGNvbnN0IGRvZGdlX2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy50YXJnZXQhLmRvZGdlQ2hhbmNlICogMTAwKSAtIHNraWxsQm9udXM7XG4gICAgICAgIGNvbnN0IGdsYW5jZV9jaGFuY2UgPSBjbGFtcCgoMTAgKyAodGhpcy50YXJnZXQhLmRlZmVuc2VTa2lsbCAtIDMwMCkgKiAyKSAqIDEwMCwgMCwgNDAwMCk7XG5cbiAgICAgICAgcmV0dXJuICgxMDAwMCAtIChtaXNzX2NoYW5jZSArIGRvZGdlX2NoYW5jZSArIGdsYW5jZV9jaGFuY2UpKSAvIDEwMDtcbiAgICB9XG5cbiAgICByb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIGVmZmVjdD86IEVmZmVjdCk6IE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgICAgIGNvbnN0IHJvbGwgPSB1cmFuZCgwLCAxMDAwMCk7XG4gICAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgICBsZXQgdG1wID0gMDtcblxuICAgICAgICAvLyByb3VuZGluZyBpbnN0ZWFkIG9mIHRydW5jYXRpbmcgYmVjYXVzZSAxOS40ICogMTAwIHdhcyB0cnVuY2F0aW5nIHRvIDE5MzkuXG4gICAgICAgIGNvbnN0IG1pc3NfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltLCBpc19taCwgZWZmZWN0KSAqIDEwMCk7XG4gICAgICAgIGNvbnN0IGRvZGdlX2NoYW5jZSA9IE1hdGgucm91bmQodmljdGltLmRvZGdlQ2hhbmNlICogMTAwKTtcbiAgICAgICAgY29uc3QgY3JpdF9jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlQ3JpdENoYW5jZSh2aWN0aW0sIGlzX21oLCBlZmZlY3QpICogMTAwKTtcblxuICAgICAgICAvLyB3ZWFwb24gc2tpbGwgLSB0YXJnZXQgZGVmZW5zZSAodXN1YWxseSBuZWdhdGl2ZSlcbiAgICAgICAgY29uc3Qgc2tpbGxCb251cyA9IDQgKiAodGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oLCBlZmZlY3QpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuXG4gICAgICAgIHRtcCA9IG1pc3NfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBkb2RnZV9jaGFuY2UgLSBza2lsbEJvbnVzOyAvLyA1LjYgKDU2MCkgZm9yIGx2bCA2MyB3aXRoIDMwMCB3ZWFwb24gc2tpbGxcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZWZmZWN0KSB7IC8vIHNwZWxscyBjYW4ndCBnbGFuY2VcbiAgICAgICAgICAgIHRtcCA9ICgxMCArICh2aWN0aW0uZGVmZW5zZVNraWxsIC0gMzAwKSAqIDIpICogMTAwO1xuICAgICAgICAgICAgdG1wID0gY2xhbXAodG1wLCAwLCA0MDAwKTtcbiAgICBcbiAgICAgICAgICAgIGlmIChyb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfR0xBTkNJTkc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBjcml0X2NoYW5jZTtcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUJvbnVzRGFtYWdlKHJhd0RhbWFnZTogbnVtYmVyLCB2aWN0aW06IFVuaXQsIGVmZmVjdD86IEVmZmVjdCkge1xuICAgICAgICBsZXQgZGFtYWdlV2l0aEJvbnVzID0gcmF3RGFtYWdlO1xuXG4gICAgICAgIGRhbWFnZVdpdGhCb251cyAqPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhbWFnZU11bHQ7XG5cbiAgICAgICAgcmV0dXJuIGRhbWFnZVdpdGhCb251cztcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgZWZmZWN0PzogRWZmZWN0KTogW251bWJlciwgTWVsZWVIaXRPdXRjb21lLCBudW1iZXJdIHtcbiAgICAgICAgY29uc3QgZGFtYWdlV2l0aEJvbnVzID0gdGhpcy5jYWxjdWxhdGVCb251c0RhbWFnZShyYXdEYW1hZ2UsIHZpY3RpbSwgZWZmZWN0KTtcbiAgICAgICAgY29uc3QgYXJtb3JSZWR1Y2VkID0gdmljdGltLmNhbGN1bGF0ZUFybW9yUmVkdWNlZERhbWFnZShkYW1hZ2VXaXRoQm9udXMsIHRoaXMpO1xuICAgICAgICBjb25zdCBoaXRPdXRjb21lID0gdGhpcy5yb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbSwgaXNfbWgsIGVmZmVjdCk7XG5cbiAgICAgICAgbGV0IGRhbWFnZSA9IGFybW9yUmVkdWNlZDtcbiAgICAgICAgbGV0IGNsZWFuRGFtYWdlID0gMDtcblxuICAgICAgICBzd2l0Y2ggKGhpdE91dGNvbWUpIHtcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IDA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0U6XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlk6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBjbGVhbkRhbWFnZSA9IGRhbWFnZVdpdGhCb251cztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWR1Y2VQZXJjZW50ID0gdGhpcy5jYWxjdWxhdGVHbGFuY2luZ1JlZHVjdGlvbih2aWN0aW0sIGlzX21oKTtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSByZWR1Y2VQZXJjZW50ICogZGFtYWdlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX05PUk1BTDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSAqPSAyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtkYW1hZ2UsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXTtcbiAgICB9XG5cbiAgICB1cGRhdGVQcm9jcyh0aW1lOiBudW1iZXIsIGlzX21oOiBib29sZWFuLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUsIGRhbWFnZURvbmU6IG51bWJlciwgY2xlYW5EYW1hZ2U6IG51bWJlciwgZWZmZWN0PzogRWZmZWN0KSB7XG4gICAgICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUywgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIC8vIHdoYXQgaXMgdGhlIG9yZGVyIG9mIGNoZWNraW5nIGZvciBwcm9jcyBsaWtlIGhvaiwgaXJvbmZvZSBhbmQgd2luZGZ1cnlcbiAgICAgICAgICAgIC8vIG9uIExIIGNvcmUgaXQgaXMgaG9qID4gaXJvbmZvZSA+IHdpbmRmdXJ5XG4gICAgICAgICAgICAvLyBzbyBkbyBpdGVtIHByb2NzIGZpcnN0LCB0aGVuIHdlYXBvbiBwcm9jLCB0aGVuIHdpbmRmdXJ5XG4gICAgICAgICAgICBmb3IgKGxldCBwcm9jIG9mIHRoaXMucHJvY3MpIHtcbiAgICAgICAgICAgICAgICBwcm9jLnJ1bih0aGlzLCAoaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghKS53ZWFwb24sIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oISkucHJvYyh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlYWxNZWxlZURhbWFnZSh0aW1lOiBudW1iZXIsIHJhd0RhbWFnZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGlzX21oOiBib29sZWFuLCBlZmZlY3Q/OiBFZmZlY3QpIHtcbiAgICAgICAgbGV0IFtkYW1hZ2VEb25lLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV0gPSB0aGlzLmNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZSwgdGFyZ2V0LCBpc19taCwgZWZmZWN0KTtcbiAgICAgICAgZGFtYWdlRG9uZSA9IE1hdGgudHJ1bmMoZGFtYWdlRG9uZSk7IC8vIHRydW5jYXRpbmcgaGVyZSBiZWNhdXNlIHdhcnJpb3Igc3ViY2xhc3MgYnVpbGRzIG9uIHRvcCBvZiBjYWxjdWxhdGVNZWxlZURhbWFnZVxuICAgICAgICBjbGVhbkRhbWFnZSA9IE1hdGgudHJ1bmMoY2xlYW5EYW1hZ2UpOyAvLyBUT0RPLCBzaG91bGQgZGFtYWdlTXVsdCBhZmZlY3QgY2xlYW4gZGFtYWdlIGFzIHdlbGw/IGlmIHNvIG1vdmUgaXQgaW50byBjYWxjdWxhdGVNZWxlZURhbWFnZVxuXG4gICAgICAgIHRoaXMuZGFtYWdlTG9nLnB1c2goW3RpbWUsIGRhbWFnZURvbmVdKTtcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgbGV0IGhpdFN0ciA9IGBZb3VyICR7ZWZmZWN0ID8gZWZmZWN0LnBhcmVudCEubmFtZSA6IChpc19taCA/ICdtYWluLWhhbmQnIDogJ29mZi1oYW5kJyl9ICR7aGl0T3V0Y29tZVN0cmluZ1toaXRPdXRjb21lXX1gO1xuICAgICAgICAgICAgaWYgKCFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZXS5pbmNsdWRlcyhoaXRPdXRjb21lKSkge1xuICAgICAgICAgICAgICAgIGhpdFN0ciArPSBgIGZvciAke2RhbWFnZURvbmV9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubG9nKHRpbWUsIGhpdFN0cik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWZmZWN0IGluc3RhbmNlb2YgU3BlbGxEYW1hZ2VFZmZlY3QpIHtcbiAgICAgICAgICAgIGlmIChlZmZlY3QuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAvLyBjYWxsaW5nIHRoaXMgYmVmb3JlIHVwZGF0ZSBwcm9jcyBiZWNhdXNlIGluIHRoZSBjYXNlIG9mIGV4ZWN1dGUsIHVuYnJpZGxlZCB3cmF0aCBjb3VsZCBwcm9jXG4gICAgICAgICAgICAgICAgLy8gdGhlbiBzZXR0aW5nIHRoZSByYWdlIHRvIDAgd291bGQgY2F1c2UgdXMgdG8gbG9zZSB0aGUgMSByYWdlIGZyb20gdW5icmlkbGVkIHdyYXRoXG4gICAgICAgICAgICAgICAgLy8gYWx0ZXJuYXRpdmUgaXMgdG8gc2F2ZSB0aGUgYW1vdW50IG9mIHJhZ2UgdXNlZCBmb3IgdGhlIGFiaWxpdHlcbiAgICAgICAgICAgICAgICBlZmZlY3QuY2FsbGJhY2sodGhpcywgaGl0T3V0Y29tZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVmZmVjdCB8fCBlZmZlY3QuY2FuUHJvYykge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIGVmZmVjdCk7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlYWxTcGVsbERhbWFnZSh0aW1lOiBudW1iZXIsIHJhd0RhbWFnZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGVmZmVjdDogRWZmZWN0KSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZURvbmUgPSByYXdEYW1hZ2U7XG5cbiAgICAgICAgdGhpcy5kYW1hZ2VMb2cucHVzaChbdGltZSwgZGFtYWdlRG9uZV0pO1xuXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgYCR7ZWZmZWN0LnBhcmVudCEubmFtZX0gaGl0cyBmb3IgJHtkYW1hZ2VEb25lfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHN3aW5nV2VhcG9uKHRpbWU6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBpZiAoIXRoaXMuZG9pbmdFeHRyYUF0dGFja3MgJiYgaXNfbWggJiYgdGhpcy5xdWV1ZWRTcGVsbCAmJiB0aGlzLnF1ZXVlZFNwZWxsLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwgPSB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByYXdEYW1hZ2UgPSB0aGlzLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oKTtcbiAgICAgICAgICAgIHRoaXMuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHJhd0RhbWFnZSwgdGFyZ2V0LCBpc19taCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBbdGhpc1dlYXBvbiwgb3RoZXJXZWFwb25dID0gaXNfbWggPyBbdGhpcy5taCwgdGhpcy5vaF0gOiBbdGhpcy5vaCwgdGhpcy5taF07XG5cbiAgICAgICAgdGhpc1dlYXBvbiEubmV4dFN3aW5nVGltZSA9IHRpbWUgKyB0aGlzV2VhcG9uIS53ZWFwb24uc3BlZWQgLyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhhc3RlICogMTAwMDtcblxuICAgICAgICBpZiAob3RoZXJXZWFwb24gJiYgb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSA8IHRpbWUgKyAyMDApIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBkZWxheWluZyAke2lzX21oID8gJ09IJyA6ICdNSCd9IHN3aW5nYCwgdGltZSArIDIwMCAtIG90aGVyV2VhcG9uLm5leHRTd2luZ1RpbWUpO1xuICAgICAgICAgICAgb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSA9IHRpbWUgKyAyMDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRyYUF0dGFja0NvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9pbmdFeHRyYUF0dGFja3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHdoaWxlICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4dHJhQXR0YWNrQ291bnQtLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGltZSA+PSB0aGlzLm1oIS5uZXh0U3dpbmdUaW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMub2ggJiYgdGltZSA+PSB0aGlzLm9oLm5leHRTd2luZ1RpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBQbGF5ZXIsIE1lbGVlSGl0T3V0Y29tZSwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiwgQnVmZk92ZXJUaW1lLCBCdWZmUHJvYyB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyBTcGVsbCwgTGVhcm5lZFNwZWxsLCBTcGVsbERhbWFnZSwgRWZmZWN0VHlwZSwgU3dpbmdTcGVsbCwgTGVhcm5lZFN3aW5nU3BlbGwsIFByb2MsIFNwZWxsQnVmZiwgRWZmZWN0LCBTcGVsbEJ1ZmZFZmZlY3QsIE1vZGlmeVBvd2VyRWZmZWN0LCBFZmZlY3RGYW1pbHkgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5cbmNvbnN0IGZsdXJyeSA9IG5ldyBCdWZmKFwiRmx1cnJ5XCIsIDE1LCB7aGFzdGU6IDEuM30sIHRydWUsIDMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbmV4cG9ydCBjb25zdCByYWNlVG9TdGF0cyA9IG5ldyBNYXA8UmFjZSwgU3RhdFZhbHVlcz4oKTtcbnJhY2VUb1N0YXRzLnNldChSYWNlLkhVTUFOLCB7IG1hY2VTa2lsbDogNSwgc3dvcmRTa2lsbDogNSwgbWFjZTJIU2tpbGw6IDUsIHN3b3JkMkhTa2lsbDogNSwgc3RyOiAxMjAsIGFnaTogODAgfSk7XG5yYWNlVG9TdGF0cy5zZXQoUmFjZS5PUkMsIHsgYXhlU2tpbGw6IDUsIGF4ZTJIU2tpbGw6IDUsIHN0cjogMTIzLCBhZ2k6IDc3IH0pO1xuXG5leHBvcnQgY2xhc3MgV2FycmlvciBleHRlbmRzIFBsYXllciB7XG4gICAgcmFnZSA9IDgwOyAvLyBUT0RPIC0gYWxsb3cgc2ltdWxhdGlvbiB0byBjaG9vc2Ugc3RhcnRpbmcgcmFnZVxuXG4gICAgZXhlY3V0ZSA9IG5ldyBMZWFybmVkU3BlbGwoZXhlY3V0ZVNwZWxsLCB0aGlzKTtcbiAgICBibG9vZHRoaXJzdCA9IG5ldyBMZWFybmVkU3BlbGwoYmxvb2R0aGlyc3RTcGVsbCwgdGhpcyk7XG4gICAgaGFtc3RyaW5nID0gbmV3IExlYXJuZWRTcGVsbChoYW1zdHJpbmdTcGVsbCwgdGhpcyk7XG4gICAgd2hpcmx3aW5kID0gbmV3IExlYXJuZWRTcGVsbCh3aGlybHdpbmRTcGVsbCwgdGhpcyk7XG4gICAgaGVyb2ljU3RyaWtlID0gbmV3IExlYXJuZWRTd2luZ1NwZWxsKGhlcm9pY1N0cmlrZVNwZWxsLCB0aGlzKTtcbiAgICBibG9vZFJhZ2UgPSBuZXcgTGVhcm5lZFNwZWxsKGJsb29kUmFnZSwgdGhpcyk7XG4gICAgZGVhdGhXaXNoID0gbmV3IExlYXJuZWRTcGVsbChkZWF0aFdpc2gsIHRoaXMpO1xuICAgIGV4ZWN1dGVTcGVsbCA9IG5ldyBMZWFybmVkU3BlbGwoZXhlY3V0ZVNwZWxsLCB0aGlzKTtcblxuICAgIGNvbnN0cnVjdG9yKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBsb2dDYWxsYmFjaz86ICh0aW1lOiBudW1iZXIsIHRleHQ6IHN0cmluZykgPT4gdm9pZCkge1xuICAgICAgICBzdXBlcihuZXcgU3RhdHMocmFjZVRvU3RhdHMuZ2V0KHJhY2UpKS5hZGQoc3RhdHMpLCBsb2dDYWxsYmFjayk7XG5cbiAgICAgICAgdGhpcy5idWZmTWFuYWdlci5hZGQoYW5nZXJNYW5hZ2VtZW50T1QsIE1hdGgucmFuZG9tKCkgKiAtMzAwMCk7IC8vIHJhbmRvbWl6aW5nIGFuZ2VyIG1hbmFnZW1lbnQgdGltaW5nXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYWRkKHVuYnJpZGxlZFdyYXRoLCAwKTtcbiAgICB9XG5cbiAgICBnZXQgcG93ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJhZ2U7XG4gICAgfVxuXG4gICAgc2V0IHBvd2VyKHBvd2VyOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5wb3dlckxvc3QgKz0gTWF0aC5tYXgoMCwgcG93ZXIgLSAxMDApO1xuICAgICAgICB0aGlzLnJhZ2UgPSBjbGFtcChwb3dlciwgMCwgMTAwKTtcbiAgICB9XG5cbiAgICBnZXQgYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxldmVsICogMyAtIDIwICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5hcCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RyICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAqIDI7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQ3JpdENoYW5jZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBlZmZlY3Q/OiBFZmZlY3QpIHtcbiAgICAgICAgLy8gY3J1ZWx0eSArIGJlcnNlcmtlciBzdGFuY2VcbiAgICAgICAgcmV0dXJuIDUgKyAzICsgc3VwZXIuY2FsY3VsYXRlQ3JpdENoYW5jZSh2aWN0aW0sIGlzX21oLCBlZmZlY3QpO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZTogbnVtYmVyLCB2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBlZmZlY3Q/OiBFZmZlY3QpOiBbbnVtYmVyLCBNZWxlZUhpdE91dGNvbWUsIG51bWJlcl0ge1xuICAgICAgICBsZXQgW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXSA9IHN1cGVyLmNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZSwgdmljdGltLCBpc19taCwgZWZmZWN0KTtcblxuICAgICAgICBpZiAoaGl0T3V0Y29tZSA9PT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUICYmIGVmZmVjdCAmJiBlZmZlY3QuZmFtaWx5ID09PSBFZmZlY3RGYW1pbHkuV0FSUklPUikge1xuICAgICAgICAgICAgZGFtYWdlRG9uZSAqPSAxLjE7IC8vIGltcGFsZVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgcmV3YXJkUmFnZShkYW1hZ2U6IG51bWJlciwgaXNfYXR0YWNrZXI6IGJvb2xlYW4sIHRpbWU6IG51bWJlcikge1xuICAgICAgICAvLyBodHRwczovL2JsdWUubW1vLWNoYW1waW9uLmNvbS90b3BpYy8xODMyNS10aGUtbmV3LXJhZ2UtZm9ybXVsYS1ieS1rYWxnYW4vXG4gICAgICAgIC8vIFByZS1FeHBhbnNpb24gUmFnZSBHYWluZWQgZnJvbSBkZWFsaW5nIGRhbWFnZTpcbiAgICAgICAgLy8gKERhbWFnZSBEZWFsdCkgLyAoUmFnZSBDb252ZXJzaW9uIGF0IFlvdXIgTGV2ZWwpICogNy41XG4gICAgICAgIC8vIEZvciBUYWtpbmcgRGFtYWdlIChib3RoIHByZSBhbmQgcG9zdCBleHBhbnNpb24pOlxuICAgICAgICAvLyBSYWdlIEdhaW5lZCA9IChEYW1hZ2UgVGFrZW4pIC8gKFJhZ2UgQ29udmVyc2lvbiBhdCBZb3VyIExldmVsKSAqIDIuNVxuICAgICAgICAvLyBSYWdlIENvbnZlcnNpb24gYXQgbGV2ZWwgNjA6IDIzMC42XG4gICAgICAgIC8vIFRPRE8gLSBob3cgZG8gZnJhY3Rpb25zIG9mIHJhZ2Ugd29yaz8gaXQgYXBwZWFycyB5b3UgZG8gZ2FpbiBmcmFjdGlvbnMgYmFzZWQgb24gZXhlYyBkYW1hZ2VcbiAgICAgICAgLy8gbm90IHRydW5jYXRpbmcgZm9yIG5vd1xuICAgICAgICAvLyBUT0RPIC0gaXQgYXBwZWFycyB0aGF0IHJhZ2UgaXMgY2FsY3VsYXRlZCB0byB0ZW50aHMgYmFzZWQgb24gZGF0YWJhc2UgdmFsdWVzIG9mIHNwZWxscyAoMTAgZW5lcmd5ID0gMSByYWdlKVxuICAgICAgICBcbiAgICAgICAgY29uc3QgTEVWRUxfNjBfUkFHRV9DT05WID0gMjMwLjY7XG4gICAgICAgIGxldCBhZGRSYWdlID0gZGFtYWdlIC8gTEVWRUxfNjBfUkFHRV9DT05WO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzX2F0dGFja2VyKSB7XG4gICAgICAgICAgICBhZGRSYWdlICo9IDcuNTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRPRE8gLSBjaGVjayBmb3IgYmVyc2Vya2VyIHJhZ2UgMS4zeCBtb2RpZmllclxuICAgICAgICAgICAgYWRkUmFnZSAqPSAyLjU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5sb2cpIHRoaXMubG9nKHRpbWUsIGBHYWluZWQgJHtNYXRoLm1pbihhZGRSYWdlLCAxMDAgLSB0aGlzLnJhZ2UpfSByYWdlICgke01hdGgubWluKDEwMCwgdGhpcy5wb3dlciArIGFkZFJhZ2UpfSlgKTtcblxuICAgICAgICB0aGlzLnBvd2VyICs9IGFkZFJhZ2U7XG4gICAgfVxuXG4gICAgdXBkYXRlUHJvY3ModGltZTogbnVtYmVyLCBpc19taDogYm9vbGVhbiwgaGl0T3V0Y29tZTogTWVsZWVIaXRPdXRjb21lLCBkYW1hZ2VEb25lOiBudW1iZXIsIGNsZWFuRGFtYWdlOiBudW1iZXIsIGVmZmVjdD86IEVmZmVjdCkge1xuICAgICAgICBzdXBlci51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIGVmZmVjdCk7XG5cbiAgICAgICAgaWYgKFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKSkge1xuICAgICAgICAgICAgaWYgKGVmZmVjdCkge1xuICAgICAgICAgICAgICAgIC8vIGh0dHA6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvNjkzNjUtMTgtMDItMDUta2FsZ2Fucy1yZXNwb25zZS10by13YXJyaW9ycy8gXCJzaW5jZSBtaXNzaW5nIHdhc3RlcyAyMCUgb2YgdGhlIHJhZ2UgY29zdCBvZiB0aGUgYWJpbGl0eVwiXG4gICAgICAgICAgICAgICAgLy8gVE9ETyAtIG5vdCBzdXJlIGhvdyBibGl6emxpa2UgdGhpcyBpc1xuICAgICAgICAgICAgICAgIGlmIChlZmZlY3QucGFyZW50IGluc3RhbmNlb2YgU3BlbGwgJiYgZWZmZWN0LnBhcmVudCAhPT0gd2hpcmx3aW5kU3BlbGwpIHsgLy8gVE9ETyAtIHNob3VsZCBjaGVjayB0byBzZWUgaWYgaXQgaXMgYW4gYW9lIHNwZWxsIG9yIGEgc2luZ2xlIHRhcmdldCBzcGVsbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJhZ2UgKz0gZWZmZWN0LnBhcmVudC5jb3N0ICogMC44MjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmV3YXJkUmFnZShjbGVhbkRhbWFnZSAqIDAuNzUsIHRydWUsIHRpbWUpOyAvLyBUT0RPIC0gd2hlcmUgaXMgdGhpcyBmb3JtdWxhIGZyb20/XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGFtYWdlRG9uZSAmJiAhZWZmZWN0KSB7XG4gICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoZGFtYWdlRG9uZSwgdHJ1ZSwgdGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnN0YW50IGF0dGFja3MgYW5kIG1pc3Nlcy9kb2RnZXMgZG9uJ3QgdXNlIGZsdXJyeSBjaGFyZ2VzIC8vIFRPRE8gLSBjb25maXJtLCB3aGF0IGFib3V0IHBhcnJ5P1xuICAgICAgICAvLyBleHRyYSBhdHRhY2tzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyBidXQgdGhleSBjYW4gcHJvYyBmbHVycnkgKHRlc3RlZClcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXRoaXMuZG9pbmdFeHRyYUF0dGFja3NcbiAgICAgICAgICAgICYmICghZWZmZWN0IHx8IGVmZmVjdC5wYXJlbnQgPT09IGhlcm9pY1N0cmlrZVNwZWxsKVxuICAgICAgICAgICAgJiYgIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpXG4gICAgICAgICAgICAmJiBoaXRPdXRjb21lICE9PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVRcbiAgICAgICAgKSB7IFxuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5yZW1vdmUoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCkge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGlnbm9yaW5nIGRlZXAgd291bmRzXG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChmbHVycnksIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZXJvaWNTdHJpa2VTcGVsbCA9IG5ldyBTd2luZ1NwZWxsKFwiSGVyb2ljIFN0cmlrZVwiLCBFZmZlY3RGYW1pbHkuV0FSUklPUiwgMTU3LCAxMik7XG5cbi8vIGV4ZWN1dGUgYWN0dWFsbHkgd29ya3MgYnkgY2FzdGluZyB0d28gc3BlbGxzLCBmaXJzdCByZXF1aXJlcyB3ZWFwb24gYnV0IGRvZXMgbm8gZGFtYWdlXG4vLyBzZWNvbmQgb25lIGRvZXNuJ3QgcmVxdWlyZSB3ZWFwb24gYW5kIGRlYWxzIHRoZSBkYW1hZ2UuXG4vLyBMSCBjb3JlIG92ZXJyb2RlIHRoZSBzZWNvbmQgc3BlbGwgdG8gcmVxdWlyZSB3ZWFwb24gKGJlbmVmaXQgZnJvbSB3ZWFwb24gc2tpbGwpXG5jb25zdCBleGVjdXRlU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJFeGVjdXRlXCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiA2MDAgKyAocGxheWVyLnBvd2VyIC0gMTApICogMTU7XG59LCBFZmZlY3RUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgRWZmZWN0RmFtaWx5LldBUlJJT1IsIHRydWUsIDEwLCAwLCAocGxheWVyOiBQbGF5ZXIsIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSkgPT4ge1xuICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTU10uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgcGxheWVyLnBvd2VyID0gMDtcbiAgICB9XG59KTtcblxuY29uc3QgYmxvb2R0aGlyc3RTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkJsb29kdGhpcnN0XCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiAoPFdhcnJpb3I+cGxheWVyKS5hcCAqIDAuNDU7XG59LCBFZmZlY3RUeXBlLlBIWVNJQ0FMLCBFZmZlY3RGYW1pbHkuV0FSUklPUiwgdHJ1ZSwgMzAsIDYpO1xuXG5jb25zdCB3aGlybHdpbmRTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIldoaXJsd2luZFwiLCAocGxheWVyOiBQbGF5ZXIpID0+IHtcbiAgICByZXR1cm4gcGxheWVyLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKHRydWUsIHRydWUpO1xufSwgRWZmZWN0VHlwZS5QSFlTSUNBTF9XRUFQT04sIEVmZmVjdEZhbWlseS5XQVJSSU9SLCB0cnVlLCAyNSwgMTApO1xuXG5jb25zdCBoYW1zdHJpbmdTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkhhbXN0cmluZ1wiLCA0NSwgRWZmZWN0VHlwZS5QSFlTSUNBTF9XRUFQT04sIEVmZmVjdEZhbWlseS5XQVJSSU9SLCB0cnVlLCAxMCwgMCk7XG5cbmV4cG9ydCBjb25zdCBhbmdlck1hbmFnZW1lbnRPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJBbmdlciBNYW5hZ2VtZW50XCIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCB1bmRlZmluZWQsIDMwMDAsIG5ldyBNb2RpZnlQb3dlckVmZmVjdCgxKSk7XG5cbmNvbnN0IGJsb29kUmFnZSA9IG5ldyBTcGVsbChcIkJsb29kcmFnZVwiLCBmYWxzZSwgMCwgNjAsIFtcbiAgICBuZXcgTW9kaWZ5UG93ZXJFZmZlY3QoMTApLFxuICAgIG5ldyBTcGVsbEJ1ZmZFZmZlY3QobmV3IEJ1ZmZPdmVyVGltZShcIkJsb29kcmFnZVwiLCAxMCwgdW5kZWZpbmVkLCAxMDAwLCBuZXcgTW9kaWZ5UG93ZXJFZmZlY3QoMSkpKV0pO1xuXG5jb25zdCBkZWF0aFdpc2ggPSBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiRGVhdGggV2lzaFwiLCAzMCwgeyBkYW1hZ2VNdWx0OiAxLjIgfSksIHRydWUsIDEwLCAzICogNjApO1xuXG5jb25zdCB1bmJyaWRsZWRXcmF0aCA9IG5ldyBCdWZmUHJvYyhcIlVuYnJpZGxlZCBXcmF0aFwiLCA2MCAqIDYwLFxuICAgIG5ldyBQcm9jKG5ldyBTcGVsbChcIlVuYnJpZGxlZCBXcmF0aFwiLCBmYWxzZSwgMCwgMCwgbmV3IE1vZGlmeVBvd2VyRWZmZWN0KDEpKSwge2NoYW5jZTogNDB9KSk7XG4iLCJpbXBvcnQgeyBQcm9jLCBTcGVsbEJ1ZmYsIEV4dHJhQXR0YWNrIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgSXRlbVNsb3QgfSBmcm9tIFwiLi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW5jaGFudERlc2NyaXB0aW9uIHtcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2xvdDogSXRlbVNsb3QsXG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxuICAgIHByb2M/OiBQcm9jXG59XG5cbmV4cG9ydCBjb25zdCBlbmNoYW50czogRW5jaGFudERlc2NyaXB0aW9uW10gPSBbXG4gICAge1xuICAgICAgICAvLyBOT1RFOiB0byBzaW1wbGlmeSB0aGUgY29kZSwgdHJlYXRpbmcgdGhlc2UgYXMgdHdvIHNlcGFyYXRlIGJ1ZmZzIHNpbmNlIHRoZXkgc3RhY2tcbiAgICAgICAgLy8gY3J1c2FkZXIgYnVmZnMgYXBwYXJlbnRseSBjYW4gYmUgZnVydGhlciBzdGFja2VkIGJ5IHN3YXBwaW5nIHdlYXBvbnMgYnV0IG5vdCBnb2luZyB0byBib3RoZXIgd2l0aCB0aGF0XG4gICAgICAgIG5hbWU6ICdDcnVzYWRlciBNSCcsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBwcm9jOiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiQ3J1c2FkZXIgTUhcIiwgMTUsIG5ldyBTdGF0cyh7c3RyOiAxMDB9KSkpLCB7cHBtOiAxfSksXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdDcnVzYWRlciBPSCcsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIHByb2M6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJDcnVzYWRlciBPSFwiLCAxNSwgbmV3IFN0YXRzKHtzdHI6IDEwMH0pKSksIHtwcG06IDF9KSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzggU3RyZW5ndGgnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IRUFEIHwgSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDh9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnMTUgQWdpbGl0eScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge2FnaTogMTV9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnMSBIYXN0ZScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQgfCBJdGVtU2xvdC5MRUdTIHwgSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7aGFzdGU6IDEuMDF9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnMyBBZ2lsaXR5JyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQkFDSyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDN9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnWkcgRW5jaGFudCAoMzAgQVApJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDMwfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0dyZWF0ZXIgU3RhdHMgKCs0KScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogNCwgYWdpOiA0fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzkgU3RyZW5ndGgnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDl9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnUnVuIFNwZWVkJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHt9LCAvLyBUT0RPIC0gZG8gbW92ZW1lbnQgc3BlZWQgaWYgSSBldmVyIGdldCBhcm91bmQgdG8gc2ltdWxhdGluZyBmaWdodHMgeW91IGhhdmUgdG8gcnVuIG91dFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnNyBBZ2lsaXR5JyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDd9LFxuICAgIH0sXG5dO1xuXG5leHBvcnQgY29uc3QgdGVtcG9yYXJ5RW5jaGFudHM6IEVuY2hhbnREZXNjcmlwdGlvbltdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogJys4IERhbWFnZScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EIHwgSXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgc3RhdHM6IHsgcGx1c0RhbWFnZTogOCB9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnRWxlbWVudGFsIFNoYXJwZW5pbmcgU3RvbmUnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCB8IEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDIgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1dpbmRmdXJ5JyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIHByb2M6IG5ldyBQcm9jKFtcbiAgICAgICAgICAgIG5ldyBFeHRyYUF0dGFjayhcIldpbmRmdXJ5IFRvdGVtXCIsIDEpLFxuICAgICAgICAgICAgbmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIldpbmRmdXJ5IFRvdGVtXCIsIDEuNSwgeyBhcDogMzE1IH0pKVxuICAgICAgICBdLCB7Y2hhbmNlOiAwLjJ9KSxcbiAgICB9XG5dO1xuIiwiaW1wb3J0IHsgV2VhcG9uVHlwZSwgV2VhcG9uRGVzY3JpcHRpb24sIEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24gfSBmcm9tIFwiLi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgU3BlbGxCdWZmLCBFeHRyYUF0dGFjaywgUHJvYywgRWZmZWN0VHlwZSwgSXRlbVNwZWxsRGFtYWdlLCBTcGVsbERhbWFnZSB9IGZyb20gXCIuLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgQnVmZiwgQnVmZlByb2MgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuXG4vLyBUT0RPIC0gaG93IHRvIGltcGxlbWVudCBzZXQgYm9udXNlcz8gcHJvYmFibHkgZWFzaWVzdCB0byBhZGQgYm9udXMgdGhhdCByZXF1aXJlcyBhIHN0cmluZyBzZWFyY2ggb2Ygb3RoZXIgZXF1aXBlZCBpdGVtc1xuXG5leHBvcnQgY29uc3QgaXRlbXM6IChJdGVtRGVzY3JpcHRpb258V2VhcG9uRGVzY3JpcHRpb24pW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiBcIklyb25mb2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgbWluOiA3MyxcbiAgICAgICAgbWF4OiAxMzYsXG4gICAgICAgIHNwZWVkOiAyLjQsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0lyb25mb2UnLCAyKSx7cHBtOiAxfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFbXB5cmVhbiBEZW1vbGlzaGVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogOTQsXG4gICAgICAgIG1heDogMTc1LFxuICAgICAgICBzcGVlZDogMi44LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkhhc3RlIChFbXB5cmVhbiBEZW1vbGlzaGVyKVwiLCAxMCwge2hhc3RlOiAxLjJ9KSkse3BwbTogMX0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQW51YmlzYXRoIFdhcmhhbW1lclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNjYsXG4gICAgICAgIG1heDogMTIzLFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBtYWNlU2tpbGw6IDQsIGFwOiAzMiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVGhlIFVudGFtZWQgQmxhZGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRDJILFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiAxOTIsXG4gICAgICAgIG1heDogMjg5LFxuICAgICAgICBzcGVlZDogMy40LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIlVudGFtZWQgRnVyeVwiLCA4LCB7c3RyOiAzMDB9KSkse3BwbTogMn0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWlzcGxhY2VkIFNlcnZvIEFybVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTI4LFxuICAgICAgICBtYXg6IDIzOCxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgb25lcXVpcDogbmV3IFByb2MobmV3IFNwZWxsRGFtYWdlKFwiRWxlY3RyaWMgRGlzY2hhcmdlXCIsIFsxMDAsIDE1MV0sIEVmZmVjdFR5cGUuTUFHSUMpLCB7cHBtOiAzfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJIYW5kIG9mIEp1c3RpY2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHthcDogMjB9LFxuICAgICAgICBvbmVxdWlwOiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0hhbmQgb2YgSnVzdGljZScsIDEpLCB7Y2hhbmNlOiAyLzEwMH0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxhY2toYW5kJ3MgQnJlYWR0aFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJha2UgRmFuZyBUYWxpc21hblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiA1NiwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkxpb25oZWFydCBIZWxtXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMiwgaGl0OiAyLCBzdHI6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhcmJlZCBDaG9rZXJcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthcDogNDQsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiT255eGlhIFRvb3RoIFBlbmRhbnRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDEyLCBoaXQ6IDEsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgU3BhdWxkZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTYsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDbG9hayBvZiBEcmFjb25pYyBNaWdodFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge3N0cjogMTYsIGFnaTogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJhcGUgb2YgVW55aWVsZGluZyBTdHJlbmd0aFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge3N0cjogMTUsIGFnaTogOSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNvbnF1ZXJvcidzIEJyZWFzdHBsYXRlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTYsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTYXZhZ2UgR2xhZGlhdG9yIENoYWluXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge2FnaTogMTQsIHN0cjogMTMsIGNyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2hvdWwgU2tpbiBUdW5pY1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDQwLCBjcml0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJyZWFzdHBsYXRlIG9mIEFubmloaWxhdGlvblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDM3LCBjcml0OiAxLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSGl2ZSBEZWZpbGVyIFdyaXN0Z3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjMsIGFnaTogMTh9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUWlyYWppIEV4ZWN1dGlvbiBCcmFjZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge2FnaTogMTYsIHN0cjogMTUsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgTWlnaHRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdhdW50bGV0cyBvZiBBbm5paGlsYXRpb25cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzNSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVkZ2VtYXN0ZXIncyBIYW5kZ3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czogeyBheGVTa2lsbDogNywgZGFnZ2VyU2tpbGw6IDcsIHN3b3JkU2tpbGw6IDcgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFnZWQgQ29yZSBMZWF0aGVyIEdsb3Zlc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHsgc3RyOiAxNSwgY3JpdDogMSwgZGFnZ2VyU2tpbGw6IDUgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9uc2xhdWdodCBHaXJkbGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV0FJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRpdGFuaWMgTGVnZ2luZ3NcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDMwLCBjcml0OiAxLCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgTGVnZ3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7YWdpOiAyMSwgc3RyOiAzMywgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJvb3RzIG9mIHRoZSBGYWxsZW4gSGVyb1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTQsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWMgQm9vdHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDIwLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3RyaWtlcidzIE1hcmtcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUkFOR0VELFxuICAgICAgICBzdGF0czoge2FwOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlF1aWNrIFN0cmlrZSBSaW5nXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge2FwOiAzMCwgY3JpdDogMSwgc3RyOiA1fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJpbmcgb2YgdGhlIFFpcmFqaSBGdXJ5XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge2FwOiA0MCwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNYXN0ZXIgRHJhZ29uc2xheWVyJ3MgUmluZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthcDogNDgsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEb24gSnVsaW8ncyBCYW5kXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDEsIGhpdDogMSwgYXA6IDE2fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlZpcydrYWcgdGhlIEJsb29kbGV0dGVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTAwLFxuICAgICAgICBtYXg6IDE4NyxcbiAgICAgICAgc3BlZWQ6IDIuNixcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBJdGVtU3BlbGxEYW1hZ2UoXCJGYXRhbCBXb3VuZHNcIiwgMjQwLCBFZmZlY3RUeXBlLlBIWVNJQ0FMKSwge3BwbTogMS4zfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWNhbGx5IFRlbXBlcmVkIFN3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTA2LFxuICAgICAgICBtYXg6IDE5OCxcbiAgICAgICAgc3BlZWQ6IDIuNixcbiAgICAgICAgc3RhdHM6IHsgYWdpOiAxNCwgc3RyOiAxNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFsYWRhdGgsIFJ1bmVkIEJsYWRlIG9mIHRoZSBCbGFjayBGbGlnaHRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4NixcbiAgICAgICAgbWF4OiAxNjIsXG4gICAgICAgIHNwZWVkOiAyLjIsXG4gICAgICAgIHN0YXRzOiB7IHN3b3JkU2tpbGw6IDQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFuY2llbnQgUWlyYWppIFJpcHBlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExNCxcbiAgICAgICAgbWF4OiAyMTMsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyMCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSWJsaXMsIEJsYWRlIG9mIHRoZSBGYWxsZW4gU2VyYXBoXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNzAsXG4gICAgICAgIG1heDogMTMxLFxuICAgICAgICBzcGVlZDogMS42LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBoaXQ6IDEsIGFwOiAyNiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR3Jlc3NpbCwgRGF3biBvZiBSdWluXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDI1NyxcbiAgICAgICAgc3BlZWQ6IDIuNyxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDQwIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaGUgSHVuZ2VyaW5nIENvbGRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA3NixcbiAgICAgICAgbWF4OiAxNDMsXG4gICAgICAgIHNwZWVkOiAxLjUsXG4gICAgICAgIHN0YXRzOiB7IHN3b3JkU2tpbGw6IDYgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBNYWNlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBMb25nc3dvcmRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBTd2lmdGJsYWRlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODUsXG4gICAgICAgIG1heDogMTI5LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhhdGNoZXQgb2YgU3VuZGVyZWQgQm9uZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMTksXG4gICAgICAgIG1heDogMjIxLFxuICAgICAgICBzcGVlZDogMi42LFxuICAgICAgICBzdGF0czogeyBhcDogMzYsIGNyaXQ6IDEgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBBeGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2VkIFFpcmFqaSBXYXIgQXhlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExMCxcbiAgICAgICAgbWF4OiAyMDUsXG4gICAgICAgIHNwZWVkOiAyLjYwLFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMTQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNydWwnc2hvcnVraCwgRWRnZSBvZiBDaGFvc1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDEsXG4gICAgICAgIG1heDogMTg4LFxuICAgICAgICBzcGVlZDogMi4zMCxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDM2IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEZWF0aGJyaW5nZXIgKFcvTyBQUk9DKVwiLCAvLyBUT0RPXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExNCxcbiAgICAgICAgbWF4OiAyMTMsXG4gICAgICAgIHNwZWVkOiAyLjkwXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRG9vbSdzIEVkZ2VcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODMsXG4gICAgICAgIG1heDogMTU0LFxuICAgICAgICBzcGVlZDogMi4zMCxcbiAgICAgICAgc3RhdHM6IHsgYWdpOiAxNiwgc3RyOiA5IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNaXJhaCdzIFNvbmdcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA1NyxcbiAgICAgICAgbWF4OiA4NyxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgYWdpOiA5LCBzdHI6IDkgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRlYXRoJ3MgU3RpbmdcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5EQUdHRVIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogOTUsXG4gICAgICAgIG1heDogMTQ0LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBhcDogMzgsIGRhZ2dlclNraWxsOiAzIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2VkIFFpcmFqaSBQdWdpb1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkRBR0dFUixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA3MixcbiAgICAgICAgbWF4OiAxMzQsXG4gICAgICAgIHNwZWVkOiAxLjcsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGhpdDogMSwgYXA6IDE4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJGZWxzdHJpa2VyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuREFHR0VSLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDU0LFxuICAgICAgICBtYXg6IDEwMSxcbiAgICAgICAgc3BlZWQ6IDEuNyxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJGZWxzdHJpa2VyXCIsIDMsIHtjcml0OiAxMDAsIGhpdDogMTAwfSkpLHtwcG06IDEuNH0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgb251c2U6ICgoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnNpZ2h0T2ZUaGVRaXJhamkgPSBuZXcgQnVmZihcIkluc2lnaHQgb2YgdGhlIFFpcmFqaVwiLCAzMCwge2FybW9yUGVuZXRyYXRpb246IDIwMH0sIHRydWUsIDAsIDYpO1xuICAgICAgICAgICAgY29uc3QgYmFkZ2VCdWZmID0gbmV3IFNwZWxsQnVmZihcbiAgICAgICAgICAgICAgICBuZXcgQnVmZlByb2MoXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiLCAzMCxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFByb2MobmV3IFNwZWxsQnVmZihpbnNpZ2h0T2ZUaGVRaXJhamkpLCB7cHBtOiAxNX0pLFxuICAgICAgICAgICAgICAgICAgICBpbnNpZ2h0T2ZUaGVRaXJhamkpLFxuICAgICAgICAgICAgICAgIGZhbHNlLCAwLCAzICogNjApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gYmFkZ2VCdWZmO1xuICAgICAgICB9KSgpXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRGlhbW9uZCBGbGFza1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBvbnVzZTogbmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkRpYW1vbmQgRmxhc2tcIiwgNjAsIHtzdHI6IDc1fSksIHRydWUsIDAsIDYgKiA2MCksXG4gICAgfVxuXTtcbiIsImltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcyB9IGZyb20gXCIuLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgRmFjdGlvbiB9IGZyb20gXCIuLi9wbGF5ZXIuanNcIjtcblxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1ZmZEZXNjcmlwdGlvbiB7XG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGR1cmF0aW9uOiBudW1iZXIsXG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxuICAgIGZhY3Rpb24/OiBGYWN0aW9uLFxuICAgIGRpc2FibGVkPzogYm9vbGVhbixcbn1cblxuZXhwb3J0IGNvbnN0IGJ1ZmZzOiBCdWZmRGVzY3JpcHRpb25bXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmF0dGxlIFNob3V0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjkwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHaWZ0IG9mIHRoZSBXaWxkXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMTYsIC8vIFRPRE8gLSBzaG91bGQgaXQgYmUgMTIgKiAxLjM1PyAodGFsZW50KVxuICAgICAgICAgICAgYWdpOiAxNlxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVHJ1ZXNob3QgQXVyYVwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMTAwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2luZyBvZiBLaW5nc1wiLFxuICAgICAgICBmYWN0aW9uOiBGYWN0aW9uLkFMTElBTkNFLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0YXRNdWx0OiAxLjFcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzaW5nIG9mIE1pZ2h0XCIsXG4gICAgICAgIGZhY3Rpb246IEZhY3Rpb24uQUxMSUFOQ0UsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDIyMlxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3RyZW5ndGggb2YgRWFydGhcIixcbiAgICAgICAgZmFjdGlvbjogRmFjdGlvbi5IT1JERSxcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDc3ICogMS4xNSAvLyBhc3N1bWluZyBlbmhhbmNpbmcgdG90ZW1zXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHcmFjZSBvZiBBaXJcIixcbiAgICAgICAgZmFjdGlvbjogRmFjdGlvbi5IT1JERSxcbiAgICAgICAgZGlzYWJsZWQ6IHRydWUsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYWdpOiA3NyAqIDEuMTUgLy8gYXNzdW1pbmcgZW5oYW5jaW5nIHRvdGVtc1xuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU21va2VkIERlc2VydCBEdW1wbGluZ3NcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDIwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJKdWp1IFBvd2VyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAzMCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAzMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSnVqdSBNaWdodFwiLFxuICAgICAgICBkdXJhdGlvbjogMTAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiA0MFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRWxpeGlyIG9mIHRoZSBNb25nb29zZVwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhZ2k6IDI1LFxuICAgICAgICAgICAgY3JpdDogMlxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUi5PLkkuRC5TLlwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDI1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSYWxseWluZyBDcnkgb2YgdGhlIERyYWdvbnNsYXllclwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMTQwLFxuICAgICAgICAgICAgY3JpdDogNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU29uZ2Zsb3dlciBTZXJhbmFkZVwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBjcml0OiA1LFxuICAgICAgICAgICAgc3RyOiAxNSxcbiAgICAgICAgICAgIGFnaTogMTVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNwaXJpdCBvZiBaYW5kYWxhclwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdGF0TXVsdDogMS4xNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRmVuZ3VzJyBGZXJvY2l0eVwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjAwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJXYXJjaGllZidzIEJsZXNzaW5nXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGhhc3RlOiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuXTtcbiIsImltcG9ydCB7IFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2Fycmlvci5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24gfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBFbmNoYW50RGVzY3JpcHRpb24sIHRlbXBvcmFyeUVuY2hhbnRzLCBlbmNoYW50cyB9IGZyb20gXCIuL2RhdGEvZW5jaGFudHMuanNcIjtcbmltcG9ydCB7IGl0ZW1zIH0gZnJvbSBcIi4vZGF0YS9pdGVtcy5qc1wiO1xuaW1wb3J0IHsgYnVmZnMsIEJ1ZmZEZXNjcmlwdGlvbiB9IGZyb20gXCIuL2RhdGEvc3BlbGxzLmpzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2ltdWxhdGlvbkRlc2NyaXB0aW9uIHtcbiAgICByYWNlOiBSYWNlLFxuICAgIHN0YXRzOiBTdGF0VmFsdWVzLFxuICAgIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBudW1iZXI+LFxuICAgIGVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4sXG4gICAgdGVtcG9yYXJ5RW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPixcbiAgICBidWZmczogbnVtYmVyW10sXG4gICAgZmlnaHRMZW5ndGg6IG51bWJlcixcbiAgICByZWFsdGltZTogYm9vbGVhbixcbiAgICBoZXJvaWNTdHJpa2VSYWdlUmVxOiBudW1iZXIsXG4gICAgaGFtc3RyaW5nUmFnZVJlcTogbnVtYmVyLFxuICAgIGJsb29kdGhpcnN0RXhlY1JhZ2VMaW1pdDogbnVtYmVyLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBQbGF5ZXIocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24+LCBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCB0ZW1wb3JhcnlFbmNoYW50OiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIGJ1ZmZzOiBCdWZmRGVzY3JpcHRpb25bXSwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICBjb25zdCBwbGF5ZXIgPSBuZXcgV2FycmlvcihyYWNlLCBzdGF0cywgbG9nKTtcblxuICAgIGZvciAobGV0IFtzbG90LCBpdGVtXSBvZiBlcXVpcG1lbnQpIHtcbiAgICAgICAgcGxheWVyLmVxdWlwKHNsb3QsIGl0ZW0sIGVuY2hhbnRzLmdldChzbG90KSwgdGVtcG9yYXJ5RW5jaGFudC5nZXQoc2xvdCkpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGJ1ZmYgb2YgYnVmZnMpIHtcbiAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChuZXcgQnVmZihidWZmLm5hbWUsIGJ1ZmYuZHVyYXRpb24sIGJ1ZmYuc3RhdHMpLCAwKTtcbiAgICB9XG5cbiAgICBjb25zdCBib3NzID0gbmV3IFVuaXQoNjMsIDQ2OTEgLSAyMjUwIC0gNjQwIC0gNTA1IC0gNjAwKTsgLy8gc3VuZGVyLCBjb3IsIGZmLCBhbm5paFxuICAgIHBsYXllci50YXJnZXQgPSBib3NzO1xuXG4gICAgcmV0dXJuIHBsYXllcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cE1hcDxLLFY+KHNsb3RUb0luZGV4OiBNYXA8SywgbnVtYmVyPiwgbG9va3VwOiBWW10pOiBNYXA8SywgVj4ge1xuICAgIGNvbnN0IHJlcyA9IG5ldyBNYXA8SyxWPigpO1xuXG4gICAgZm9yIChsZXQgW3Nsb3QsIGlkeF0gb2Ygc2xvdFRvSW5kZXgpIHtcbiAgICAgICAgaWYgKGxvb2t1cFtpZHhdKSB7XG4gICAgICAgICAgICByZXMuc2V0KHNsb3QsIGxvb2t1cFtpZHhdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgaW5kZXgnLCBpZHgsIGxvb2t1cCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwQXJyYXk8Vj4oaW5kaWNlczogbnVtYmVyW10sIGxvb2t1cDogVltdKTogVltdIHtcbiAgICBjb25zdCByZXM6IFZbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaWR4IG9mIGluZGljZXMpIHtcbiAgICAgICAgaWYgKGxvb2t1cFtpZHhdKSB7XG4gICAgICAgICAgICByZXMucHVzaChsb29rdXBbaWR4XSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnYmFkIGluZGV4JywgaWR4LCBsb29rdXApO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBJdGVtcyhtYXA6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPikge1xuICAgIHJldHVybiBsb29rdXBNYXAobWFwLCBpdGVtcyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBFbmNoYW50cyhtYXA6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPikge1xuICAgIHJldHVybiBsb29rdXBNYXAobWFwLCBlbmNoYW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBUZW1wb3JhcnlFbmNoYW50cyhtYXA6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPikge1xuICAgIHJldHVybiBsb29rdXBNYXAobWFwLCB0ZW1wb3JhcnlFbmNoYW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBCdWZmcyhpbmRpY2VzOiBudW1iZXJbXSkge1xuICAgIHJldHVybiBsb29rdXBBcnJheShpbmRpY2VzLCBidWZmcyk7XG59XG4iLCJpbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBJdGVtRGVzY3JpcHRpb24sIEl0ZW1TbG90IH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uLCBQbGF5ZXIsIFJhY2UsIERhbWFnZUxvZyB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgc2V0dXBQbGF5ZXIgfSBmcm9tIFwiLi9zaW11bGF0aW9uX3V0aWxzLmpzXCI7XG5pbXBvcnQgeyBFbmNoYW50RGVzY3JpcHRpb24gfSBmcm9tIFwiLi9kYXRhL2VuY2hhbnRzLmpzXCI7XG5pbXBvcnQgeyBCdWZmRGVzY3JpcHRpb24gfSBmcm9tIFwiLi9kYXRhL3NwZWxscy5qc1wiO1xuXG5leHBvcnQgdHlwZSBJdGVtV2l0aFNsb3QgPSBbSXRlbURlc2NyaXB0aW9uLCBJdGVtU2xvdF07XG5cbi8vIFRPRE8gLSBjaGFuZ2UgdGhpcyBpbnRlcmZhY2Ugc28gdGhhdCBDaG9vc2VBY3Rpb24gY2Fubm90IHNjcmV3IHVwIHRoZSBzaW0gb3IgY2hlYXRcbi8vIGUuZy4gQ2hvb3NlQWN0aW9uIHNob3VsZG4ndCBjYXN0IHNwZWxscyBhdCBhIGN1cnJlbnQgdGltZVxuZXhwb3J0IHR5cGUgQ2hvb3NlQWN0aW9uID0gKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXIsIGNhbkV4ZWN1dGU6IGJvb2xlYW4pID0+IG51bWJlcjtcblxuZXhwb3J0IGNvbnN0IEVYRUNVVEVfUEhBU0VfUkFUSU8gPSAwLjE1OyAvLyBsYXN0IDE1JSBvZiB0aGUgdGltZSBpcyBleGVjdXRlIHBoYXNlXG5cbmNsYXNzIEZpZ2h0IHtcbiAgICBwbGF5ZXI6IFBsYXllcjtcbiAgICBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbjtcbiAgICBmaWdodExlbmd0aDogbnVtYmVyO1xuICAgIGR1cmF0aW9uID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBlcXVpcG1lbnQ6IE1hcDxJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uPiwgZW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPiwgdGVtcG9yYXJ5RW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPiwgYnVmZnM6IEJ1ZmZEZXNjcmlwdGlvbltdLCBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbiwgZmlnaHRMZW5ndGggPSA2MCwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBzZXR1cFBsYXllcihyYWNlLCBzdGF0cywgZXF1aXBtZW50LCBlbmNoYW50cywgdGVtcG9yYXJ5RW5jaGFudHMsIGJ1ZmZzLCBsb2cpO1xuICAgICAgICB0aGlzLmNob29zZUFjdGlvbiA9IGNob29zZUFjdGlvbjtcbiAgICAgICAgdGhpcy5maWdodExlbmd0aCA9IChmaWdodExlbmd0aCArIE1hdGgucmFuZG9tKCkgKiA0IC0gMikgKiAxMDAwO1xuICAgIH1cblxuICAgIHJ1bigpOiBQcm9taXNlPEZpZ2h0UmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZiwgcikgPT4ge1xuICAgICAgICAgICAgd2hpbGUgKHRoaXMuZHVyYXRpb24gPD0gdGhpcy5maWdodExlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGYoe1xuICAgICAgICAgICAgICAgIGRhbWFnZUxvZzogdGhpcy5wbGF5ZXIuZGFtYWdlTG9nLFxuICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiB0aGlzLmZpZ2h0TGVuZ3RoLFxuICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogdGhpcy5wbGF5ZXIucG93ZXJMb3N0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UocGF1c2U6IGJvb2xlYW4pIHt9XG5cbiAgICBjYW5jZWwoKSB7fVxuXG4gICAgcHJvdGVjdGVkIHVwZGF0ZSgpIHtcbiAgICAgICAgY29uc3QgYmVnaW5FeGVjdXRlVGltZSA9IHRoaXMuZmlnaHRMZW5ndGggKiAoMSAtIEVYRUNVVEVfUEhBU0VfUkFUSU8pO1xuICAgICAgICBjb25zdCBpc0V4ZWN1dGVQaGFzZSA9IHRoaXMuZHVyYXRpb24gPj0gYmVnaW5FeGVjdXRlVGltZTtcblxuICAgICAgICB0aGlzLnBsYXllci5idWZmTWFuYWdlci51cGRhdGUodGhpcy5kdXJhdGlvbik7IC8vIG5lZWQgdG8gY2FsbCB0aGlzIGlmIHRoZSBkdXJhdGlvbiBjaGFuZ2VkIGJlY2F1c2Ugb2YgYnVmZnMgdGhhdCBjaGFuZ2Ugb3ZlciB0aW1lIGxpa2Ugam9tIGdhYmJlclxuXG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uKHRoaXMucGxheWVyLCB0aGlzLmR1cmF0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCBpc0V4ZWN1dGVQaGFzZSk7IC8vIGNob29zZSBhY3Rpb24gYmVmb3JlIGluIGNhc2Ugb2YgYWN0aW9uIGRlcGVuZGluZyBvbiB0aW1lIG9mZiB0aGUgZ2NkIGxpa2UgZWFydGhzdHJpa2VcblxuICAgICAgICB0aGlzLnBsYXllci51cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgLy8gY2hvb3NlIGFjdGlvbiBhZnRlciBldmVyeSBzd2luZyB3aGljaCBjb3VsZCBiZSBhIHJhZ2UgZ2VuZXJhdGluZyBldmVudCwgYnV0IFRPRE86IG5lZWQgdG8gYWNjb3VudCBmb3IgbGF0ZW5jeSwgcmVhY3Rpb24gdGltZSAoYnV0dG9uIG1hc2hpbmcpXG4gICAgICAgIGNvbnN0IHdhaXRpbmdGb3JUaW1lID0gdGhpcy5jaG9vc2VBY3Rpb24odGhpcy5wbGF5ZXIsIHRoaXMuZHVyYXRpb24sIHRoaXMuZmlnaHRMZW5ndGgsIGlzRXhlY3V0ZVBoYXNlKTtcblxuICAgICAgICBsZXQgbmV4dFN3aW5nVGltZSA9IHRoaXMucGxheWVyLm1oIS5uZXh0U3dpbmdUaW1lO1xuXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5vaCkge1xuICAgICAgICAgICAgbmV4dFN3aW5nVGltZSA9IE1hdGgubWluKG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLm9oLm5leHRTd2luZ1RpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IGhhY2tcbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmV4dHJhQXR0YWNrQ291bnQpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IGluY3JlbWVudCBkdXJhdGlvbiAoVE9ETzogYnV0IEkgcmVhbGx5IHNob3VsZCBiZWNhdXNlIHRoZSBzZXJ2ZXIgZG9lc24ndCBsb29wIGluc3RhbnRseSlcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBsYXllci5uZXh0R0NEVGltZSA+IHRoaXMuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBNYXRoLm1pbih0aGlzLnBsYXllci5uZXh0R0NEVGltZSwgbmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIubmV4dE92ZXJUaW1lVXBkYXRlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBNYXRoLm1pbihuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5idWZmTWFuYWdlci5uZXh0T3ZlclRpbWVVcGRhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHdhaXRpbmdGb3JUaW1lIDwgdGhpcy5kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IHdhaXRpbmdGb3JUaW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc0V4ZWN1dGVQaGFzZSAmJiBiZWdpbkV4ZWN1dGVUaW1lIDwgdGhpcy5kdXJhdGlvbikgeyAvLyBub3QgZXhlY3V0ZSBhdCBzdGFydCBvZiB1cGRhdGVcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBiZWdpbkV4ZWN1dGVUaW1lO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBSZWFsdGltZUZpZ2h0IGV4dGVuZHMgRmlnaHQge1xuICAgIHByb3RlY3RlZCBwYXVzZWQgPSBmYWxzZTtcblxuICAgIHJ1bigpOiBQcm9taXNlPEZpZ2h0UmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IE1TX1BFUl9VUERBVEUgPSAxMDAwIC8gNjA7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmLCByKSA9PiB7XG4gICAgICAgICAgICBsZXQgb3ZlcnJpZGVEdXJhdGlvbiA9IDA7XG5cbiAgICAgICAgICAgIGNvbnN0IGxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZHVyYXRpb24gPD0gdGhpcy5maWdodExlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcnJpZGVEdXJhdGlvbiArPSBNU19QRVJfVVBEQVRFO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IG92ZXJyaWRlRHVyYXRpb247XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChsb29wLCBNU19QRVJfVVBEQVRFKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhbWFnZUxvZzogdGhpcy5wbGF5ZXIuZGFtYWdlTG9nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlnaHRMZW5ndGg6IHRoaXMuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3dlckxvc3Q6IHRoaXMucGxheWVyLnBvd2VyTG9zdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGxvb3AsIE1TX1BFUl9VUERBVEUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwYXVzZShwYXVzZTogYm9vbGVhbikge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IHBhdXNlO1xuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgRmlnaHRSZXN1bHQgPSB7IGRhbWFnZUxvZzogRGFtYWdlTG9nLCBmaWdodExlbmd0aDogbnVtYmVyLCBwb3dlckxvc3Q6IG51bWJlcn07XG5cbmV4cG9ydCB0eXBlIFNpbXVsYXRpb25TdW1tYXJ5ID0ge1xuICAgIG5vcm1hbERhbWFnZTogbnVtYmVyLFxuICAgIGV4ZWNEYW1hZ2U6IG51bWJlcixcbiAgICBub3JtYWxEdXJhdGlvbjogbnVtYmVyLFxuICAgIGV4ZWNEdXJhdGlvbjogbnVtYmVyLFxuICAgIHBvd2VyTG9zdDogbnVtYmVyLFxuICAgIGZpZ2h0czogbnVtYmVyLFxufTtcblxuZXhwb3J0IHR5cGUgU3RhdHVzSGFuZGxlciA9IChzdGF0dXM6IFNpbXVsYXRpb25TdW1tYXJ5KSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgU2ltdWxhdGlvbiB7XG4gICAgcmFjZTogUmFjZTtcbiAgICBzdGF0czogU3RhdFZhbHVlcztcbiAgICBlcXVpcG1lbnQ6IE1hcDxJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uPjtcbiAgICBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+O1xuICAgIHRlbXBvcmFyeUVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj47XG4gICAgYnVmZnM6IEJ1ZmZEZXNjcmlwdGlvbltdO1xuICAgIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uO1xuICAgIHByb3RlY3RlZCBmaWdodExlbmd0aDogbnVtYmVyO1xuICAgIHByb3RlY3RlZCByZWFsdGltZTogYm9vbGVhbjtcbiAgICBsb2c/OiBMb2dGdW5jdGlvblxuXG4gICAgcHJvdGVjdGVkIHJlcXVlc3RTdG9wID0gZmFsc2U7XG4gICAgcHJvdGVjdGVkIF9wYXVzZWQgPSBmYWxzZTtcblxuICAgIGZpZ2h0UmVzdWx0czogRmlnaHRSZXN1bHRbXSA9IFtdO1xuXG4gICAgY3VycmVudEZpZ2h0PzogRmlnaHQ7XG5cbiAgICBwcm90ZWN0ZWQgY2FjaGVkU3VtbW1hcnk6IFNpbXVsYXRpb25TdW1tYXJ5ID0geyBub3JtYWxEYW1hZ2U6IDAsIGV4ZWNEYW1hZ2U6IDAsIG5vcm1hbER1cmF0aW9uOiAwLCBleGVjRHVyYXRpb246IDAsIHBvd2VyTG9zdDogMCwgZmlnaHRzOiAwIH07XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBNYXA8SXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbj4sIGVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIHRlbXBvcmFyeUVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIGJ1ZmZzOiBCdWZmRGVzY3JpcHRpb25bXSwgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb24sIGZpZ2h0TGVuZ3RoID0gNjAsIHJlYWx0aW1lID0gZmFsc2UsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHRoaXMucmFjZSA9IHJhY2U7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5lcXVpcG1lbnQgPSBlcXVpcG1lbnQ7XG4gICAgICAgIHRoaXMuZW5jaGFudHMgPSBlbmNoYW50cztcbiAgICAgICAgdGhpcy50ZW1wb3JhcnlFbmNoYW50cyA9IHRlbXBvcmFyeUVuY2hhbnRzO1xuICAgICAgICB0aGlzLmJ1ZmZzID0gYnVmZnM7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gZmlnaHRMZW5ndGg7XG4gICAgICAgIHRoaXMucmVhbHRpbWUgPSByZWFsdGltZTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IHBhdXNlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhdXNlZDtcbiAgICB9XG5cbiAgICBnZXQgc3RhdHVzKCk6IFNpbXVsYXRpb25TdW1tYXJ5IHtcbiAgICAgICAgZm9yIChsZXQgZmlnaHRSZXN1bHQgb2YgdGhpcy5maWdodFJlc3VsdHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSBmaWdodFJlc3VsdC5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IFt0aW1lLCBkYW1hZ2VdIG9mIGZpZ2h0UmVzdWx0LmRhbWFnZUxvZykge1xuICAgICAgICAgICAgICAgIGlmICh0aW1lID49IGJlZ2luRXhlY3V0ZVRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5leGVjRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbERhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbER1cmF0aW9uICs9IGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEdXJhdGlvbiArPSBmaWdodFJlc3VsdC5maWdodExlbmd0aCAtIGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LnBvd2VyTG9zdCArPSBmaWdodFJlc3VsdC5wb3dlckxvc3Q7XG5cbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkuZmlnaHRzKys7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpZ2h0UmVzdWx0cyA9IFtdO1xuXG4gICAgICAgIGxldCBub3JtYWxEYW1hZ2UgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbERhbWFnZTtcbiAgICAgICAgbGV0IGV4ZWNEYW1hZ2UgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEYW1hZ2U7XG4gICAgICAgIGxldCBub3JtYWxEdXJhdGlvbiA9IHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRHVyYXRpb247XG4gICAgICAgIGxldCBleGVjRHVyYXRpb24gPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEdXJhdGlvbjtcbiAgICAgICAgbGV0IHBvd2VyTG9zdCA9IHRoaXMuY2FjaGVkU3VtbW1hcnkucG93ZXJMb3N0O1xuICAgICAgICBsZXQgZmlnaHRzID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5maWdodHM7XG5cbiAgICAgICAgaWYgKHRoaXMucmVhbHRpbWUgJiYgdGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSB0aGlzLmN1cnJlbnRGaWdodC5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IFt0aW1lLCBkYW1hZ2VdIG9mIHRoaXMuY3VycmVudEZpZ2h0LnBsYXllci5kYW1hZ2VMb2cpIHtcbiAgICAgICAgICAgICAgICBpZiAodGltZSA+PSBiZWdpbkV4ZWN1dGVUaW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWNEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5vcm1hbERhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub3JtYWxEdXJhdGlvbiArPSBNYXRoLm1pbihiZWdpbkV4ZWN1dGVUaW1lLCB0aGlzLmN1cnJlbnRGaWdodC5kdXJhdGlvbik7XG4gICAgICAgICAgICBleGVjRHVyYXRpb24gKz0gTWF0aC5tYXgoMCwgdGhpcy5jdXJyZW50RmlnaHQuZHVyYXRpb24gLSBiZWdpbkV4ZWN1dGVUaW1lKTtcbiAgICAgICAgICAgIHBvd2VyTG9zdCArPSB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIucG93ZXJMb3N0O1xuICAgICAgICAgICAgZmlnaHRzKys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbm9ybWFsRGFtYWdlOiBub3JtYWxEYW1hZ2UsXG4gICAgICAgICAgICBleGVjRGFtYWdlOiBleGVjRGFtYWdlLFxuICAgICAgICAgICAgbm9ybWFsRHVyYXRpb246IG5vcm1hbER1cmF0aW9uLFxuICAgICAgICAgICAgZXhlY0R1cmF0aW9uOiBleGVjRHVyYXRpb24sXG4gICAgICAgICAgICBwb3dlckxvc3Q6IHBvd2VyTG9zdCxcbiAgICAgICAgICAgIGZpZ2h0czogZmlnaHRzLFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhcnQoKSB7XG4gICAgICAgIGNvbnN0IGZpZ2h0Q2xhc3MgPSB0aGlzLnJlYWx0aW1lID8gUmVhbHRpbWVGaWdodCA6IEZpZ2h0O1xuXG4gICAgICAgIGNvbnN0IG91dGVybG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAxMDApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICAgICAgY29uc3QgaW5uZXJsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjb3VudCA+IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KG91dGVybG9vcCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodCA9IG5ldyBmaWdodENsYXNzKHRoaXMucmFjZSwgdGhpcy5zdGF0cywgdGhpcy5lcXVpcG1lbnQsIHRoaXMuZW5jaGFudHMsIHRoaXMudGVtcG9yYXJ5RW5jaGFudHMsIHRoaXMuYnVmZnMsIHRoaXMuY2hvb3NlQWN0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCB0aGlzLnJlYWx0aW1lID8gdGhpcy5sb2cgOiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0LnJ1bigpLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpZ2h0UmVzdWx0cy5wdXNoKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgIGlubmVybG9vcCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghdGhpcy5yZXF1ZXN0U3RvcCkge1xuICAgICAgICAgICAgICAgIGlubmVybG9vcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIG91dGVybG9vcCgpO1xuICAgIH1cblxuICAgIHBhdXNlKHBhdXNlOiBib29sZWFufHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAocGF1c2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcGF1c2UgPSAhdGhpcy5wYXVzZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wYXVzZWQgPSBwYXVzZTtcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEZpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodC5wYXVzZShwYXVzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3RTdG9wID0gdHJ1ZTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2FycmlvclwiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyXCI7XG5pbXBvcnQgeyBTcGVsbEJ1ZmYgfSBmcm9tIFwiLi9zcGVsbFwiO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDaG9vc2VBY3Rpb24oaGVyb2ljU3RyaWtlUmFnZVJlcTogbnVtYmVyLCBoYW1zdHJpbmdSYWdlUmVxOiBudW1iZXIsIGJsb29kdGhpcnN0RXhlY1JhZ2VMaW1pdDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyLCBmaWdodExlbmd0aDogbnVtYmVyLCBleGVjdXRlUGhhc2U6IGJvb2xlYW4pOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCB3YXJyaW9yID0gPFdhcnJpb3I+cGxheWVyO1xuICAgIFxuICAgICAgICBjb25zdCB0aW1lUmVtYWluaW5nU2Vjb25kcyA9IChmaWdodExlbmd0aCAtIHRpbWUpIC8gMTAwMDtcblxuICAgICAgICBsZXQgd2FpdGluZ0ZvclRpbWUgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgICAgICAgLy8gVE9ETyAtIHdoYXQgYWJvdXQgR0NEIHNwZWxscyB3aGVyZSB5b3Ugc2hvdWxkIHBvcCB0aGVtIGJlZm9yZSBmaWdodD8gbGlrZSBkaWFtb25kIGZsYXNrIG9uIHZhZWxcbiAgICAgICAgLy8gbmVlZCB0byBhZGQgYSBzdGVwIGZvciBwcmUgZmlnaHQgYWN0aW9ucywgbWF5YmUgY2hvb3NlIGFjdGlvbiBzaG91bGQgYmUgYWJsZSB0byB3b3JrIG9uIG5lZ2F0aXZlIGZpZ2h0IHRpbWVcbiAgICAgICAgZm9yIChsZXQgW18sIGl0ZW1dIG9mIHBsYXllci5pdGVtcykge1xuICAgICAgICAgICAgaWYgKGl0ZW0ub251c2UgJiYgaXRlbS5vbnVzZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW0ub251c2Uuc3BlbGwgaW5zdGFuY2VvZiBTcGVsbEJ1ZmYpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRpbWVSZW1haW5pbmdTZWNvbmRzIDw9IGl0ZW0ub251c2Uuc3BlbGwuYnVmZi5kdXJhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5vbnVzZS5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSBNYXRoLm1pbih3YWl0aW5nRm9yVGltZSwgZmlnaHRMZW5ndGggLSBpdGVtLm9udXNlLnNwZWxsLmJ1ZmYuZHVyYXRpb24gKiAxMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIFxuICAgICAgICBpZiAod2Fycmlvci5yYWdlIDwgMzAgJiYgd2Fycmlvci5ibG9vZFJhZ2UuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgd2Fycmlvci5ibG9vZFJhZ2UuY2FzdCh0aW1lKTtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICAvLyBnY2Qgc3BlbGxzXG4gICAgICAgIGlmICh3YXJyaW9yLm5leHRHQ0RUaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgIGlmICh3YXJyaW9yLmRlYXRoV2lzaC5jYW5DYXN0KHRpbWUpICYmXG4gICAgICAgICAgICAgICAgKHRpbWVSZW1haW5pbmdTZWNvbmRzIDw9IDMwXG4gICAgICAgICAgICAgICAgfHwgKHRpbWVSZW1haW5pbmdTZWNvbmRzIC0gd2Fycmlvci5kZWF0aFdpc2guc3BlbGwuY29vbGRvd24pID4gMzApKSB7IC8vIGNvdWxkIGJlIHRpbWVkIGJldHRlclxuICAgICAgICAgICAgICAgIHdhcnJpb3IuZGVhdGhXaXNoLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV4ZWN1dGVQaGFzZSAmJiB3YXJyaW9yLmJsb29kdGhpcnN0LmNhbkNhc3QodGltZSkgJiYgd2Fycmlvci5yYWdlIDwgYmxvb2R0aGlyc3RFeGVjUmFnZUxpbWl0KSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5ibG9vZHRoaXJzdC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZXhlY3V0ZVBoYXNlICYmIHdhcnJpb3IuZXhlY3V0ZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5leGVjdXRlLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC50aW1lUmVtYWluaW5nKHRpbWUpIDwgMS41ICsgKHdhcnJpb3IubGF0ZW5jeSAvIDEwMDApKSB7XG4gICAgICAgICAgICAgICAgLy8gbm90IG9yIGFsbW9zdCBvZmYgY29vbGRvd24sIHdhaXQgZm9yIHJhZ2Ugb3IgY29vbGRvd25cbiAgICAgICAgICAgICAgICBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC5jb29sZG93biA+IHRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSBNYXRoLm1pbih3YWl0aW5nRm9yVGltZSwgd2Fycmlvci5ibG9vZHRoaXJzdC5jb29sZG93bik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLndoaXJsd2luZC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci53aGlybHdpbmQuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci53aGlybHdpbmQudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICAgICAgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLmNvb2xkb3duID4gdGltZSkge1xuICAgICAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IE1hdGgubWluKHdhaXRpbmdGb3JUaW1lLCB3YXJyaW9yLndoaXJsd2luZC5jb29sZG93bik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLnJhZ2UgPj0gaGFtc3RyaW5nUmFnZVJlcSAmJiB3YXJyaW9yLmhhbXN0cmluZy5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5oYW1zdHJpbmcuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIFxuICAgICAgICBpZiAoIWV4ZWN1dGVQaGFzZSAmJiB3YXJyaW9yLnJhZ2UgPj0gaGVyb2ljU3RyaWtlUmFnZVJlcSAmJiAhd2Fycmlvci5xdWV1ZWRTcGVsbCkge1xuICAgICAgICAgICAgd2Fycmlvci5xdWV1ZWRTcGVsbCA9IHdhcnJpb3IuaGVyb2ljU3RyaWtlO1xuICAgICAgICAgICAgaWYgKHdhcnJpb3IubG9nKSB3YXJyaW9yLmxvZyh0aW1lLCAncXVldWVpbmcgaGVyb2ljIHN0cmlrZScpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHJldHVybiB3YWl0aW5nRm9yVGltZTtcbiAgICB9O1xufVxuIiwiaW1wb3J0IHsgIE1haW5UaHJlYWRJbnRlcmZhY2UgfSBmcm9tIFwiLi93b3JrZXJfZXZlbnRfaW50ZXJmYWNlLmpzXCI7XG5pbXBvcnQgeyBTaW11bGF0aW9uIH0gZnJvbSBcIi4vc2ltdWxhdGlvbi5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbkRlc2NyaXB0aW9uLCBsb29rdXBJdGVtcywgbG9va3VwQnVmZnMsIGxvb2t1cEVuY2hhbnRzLCBsb29rdXBUZW1wb3JhcnlFbmNoYW50cyB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZUNob29zZUFjdGlvbiB9IGZyb20gXCIuL3dhcnJpb3JfYWkuanNcIjtcblxuY29uc3QgbWFpblRocmVhZEludGVyZmFjZSA9IE1haW5UaHJlYWRJbnRlcmZhY2UuaW5zdGFuY2U7XG5cbmxldCBjdXJyZW50U2ltOiBTaW11bGF0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxubWFpblRocmVhZEludGVyZmFjZS5hZGRFdmVudExpc3RlbmVyKCdzaW11bGF0ZScsIChkYXRhOiBhbnkpID0+IHtcbiAgICBjb25zdCBzaW1kZXNjID0gPFNpbXVsYXRpb25EZXNjcmlwdGlvbj5kYXRhO1xuXG4gICAgbGV0IGxvZ0Z1bmN0aW9uOiBMb2dGdW5jdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoc2ltZGVzYy5yZWFsdGltZSkge1xuICAgICAgICBsb2dGdW5jdGlvbiA9ICh0aW1lOiBudW1iZXIsIHRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdsb2cnLCB7XG4gICAgICAgICAgICAgICAgdGltZTogdGltZSxcbiAgICAgICAgICAgICAgICB0ZXh0OiB0ZXh0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjdXJyZW50U2ltID0gbmV3IFNpbXVsYXRpb24oc2ltZGVzYy5yYWNlLCBzaW1kZXNjLnN0YXRzLFxuICAgICAgICBsb29rdXBJdGVtcyhzaW1kZXNjLmVxdWlwbWVudCksXG4gICAgICAgIGxvb2t1cEVuY2hhbnRzKHNpbWRlc2MuZW5jaGFudHMpLFxuICAgICAgICBsb29rdXBUZW1wb3JhcnlFbmNoYW50cyhzaW1kZXNjLnRlbXBvcmFyeUVuY2hhbnRzKSxcbiAgICAgICAgbG9va3VwQnVmZnMoc2ltZGVzYy5idWZmcyksXG4gICAgICAgIGdlbmVyYXRlQ2hvb3NlQWN0aW9uKHNpbWRlc2MuaGVyb2ljU3RyaWtlUmFnZVJlcSwgc2ltZGVzYy5oYW1zdHJpbmdSYWdlUmVxLCBzaW1kZXNjLmJsb29kdGhpcnN0RXhlY1JhZ2VMaW1pdCksXG4gICAgICAgIHNpbWRlc2MuZmlnaHRMZW5ndGgsIHNpbWRlc2MucmVhbHRpbWUsIGxvZ0Z1bmN0aW9uKTtcblxuICAgIGN1cnJlbnRTaW0uc3RhcnQoKTtcblxuICAgIHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgaWYgKGN1cnJlbnRTaW0gJiYgIWN1cnJlbnRTaW0ucGF1c2VkKSB7XG4gICAgICAgICAgICBtYWluVGhyZWFkSW50ZXJmYWNlLnNlbmQoJ3N0YXR1cycsIGN1cnJlbnRTaW0hLnN0YXR1cyk7XG4gICAgICAgIH1cbiAgICB9LCA1MDApO1xufSk7XG5cbm1haW5UaHJlYWRJbnRlcmZhY2UuYWRkRXZlbnRMaXN0ZW5lcigncGF1c2UnLCAocGF1c2U6IGJvb2xlYW58dW5kZWZpbmVkKSA9PiB7XG4gICAgaWYgKGN1cnJlbnRTaW0pIHtcbiAgICAgICAgY3VycmVudFNpbS5wYXVzZShwYXVzZSk7XG4gICAgfVxufSk7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFB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QUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNyQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSztJQUN0QixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsSUFBSTtJQUN6QixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNyQixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUN0QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUN0QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUN0QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2QixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNyQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNyQixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2QixDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsS0FBSztDQUMzQixDQUFDO0FBRUYsQUFBTyxNQUFNLDJCQUEyQixHQUFrQztJQUN0RSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsSUFBSTtJQUN6QixDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsSUFBSTtJQUN4QixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSztJQUMxQixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSztJQUMxQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSztJQUN0QixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSztJQUN0QixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSztJQUMxQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSztJQUN0QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2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
