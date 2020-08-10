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
        this.buffUptimeMap = new Map();
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
            this.buffList.push(new BuffApplication(this.player, buff, applyTime));
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
                buffapp.remove(time);
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
                buffapp.remove(time);
                return false;
            }
            return true;
        });
    }
    removeExpiredBuffs(time) {
        const removedBuffs = [];
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.expirationTime <= time) {
                removedBuffs.push(buffapp);
                return false;
            }
            return true;
        });
        this.buffOverTimeList = this.buffOverTimeList.filter((buffapp) => {
            if (buffapp.expirationTime <= time) {
                removedBuffs.push(buffapp);
                return false;
            }
            return true;
        });
        for (let buffapp of removedBuffs) {
            buffapp.remove(time);
            if (this.player.log)
                this.player.log(time, `${buffapp.buff.name} expired`);
        }
    }
    removeAllBuffs(time) {
        const removedBuffs = [];
        this.buffList = this.buffList.filter((buffapp) => {
            removedBuffs.push(buffapp);
            return false;
        });
        this.buffOverTimeList = this.buffOverTimeList.filter((buffapp) => {
            removedBuffs.push(buffapp);
            return false;
        });
        for (let buffapp of removedBuffs) {
            buffapp.remove(time);
        }
    }
}
function updateSwingTimers(time, player, hasteScale) {
    const currentHaste = player.buffManager.stats.haste;
    const newHaste = currentHaste * hasteScale;
    const weapons = [];
    if (player.mh) {
        weapons.push(player.mh);
    }
    if (player.oh) {
        weapons.push(player.oh);
    }
    for (let weapon of weapons) {
        const currentSwingTime = weapon.weapon.speed / currentHaste * 1000;
        const currentSwingTimeRemaining = weapon.nextSwingTime - time;
        const currentSwingProgressRemaining = currentSwingTimeRemaining / currentSwingTime;
        weapon.nextSwingTime = time + currentSwingProgressRemaining * weapon.weapon.speed / newHaste * 1000;
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
    add(time, player) {
        if (this.stats && this.stats.haste) {
            updateSwingTimers(time, player, this.stats.haste);
        }
    }
    remove(time, player) {
        if (this.stats && this.stats.haste) {
            updateSwingTimers(time, player, 1 / this.stats.haste);
        }
        if (this.child) {
            player.buffManager.remove(this.child, time, true);
        }
    }
}
class BuffApplication {
    constructor(player, buff, applyTime) {
        this.player = player;
        this.buff = buff;
        this.applyTime = applyTime;
        this.refresh(applyTime);
    }
    refresh(time) {
        this.stacks = this.buff.initialStacks || 1;
        this.expirationTime = time + this.buff.duration * 1000;
        if (this.buff.duration > 60) {
            this.expirationTime = Number.MAX_SAFE_INTEGER;
        }
    }
    remove(time) {
        this.buff.remove(time, this.player);
        const previousUptime = this.player.buffManager.buffUptimeMap.get(this.buff.name) || 0;
        const currentUptime = time - this.applyTime;
        this.player.buffManager.buffUptimeMap.set(this.buff.name, previousUptime + currentUptime);
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
    constructor(base, randomAmount) {
        super(EffectType.NONE);
        this.base = base;
        this.randomAmount = randomAmount || 0;
    }
    run(player, time) {
        const amount = this.base + Math.round(this.randomAmount * Math.random());
        player.power += amount;
        if (player.log)
            player.log(time, `You gain ${amount} rage from ${this.parent.name}`);
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
        const nextBatch = time;
        player.futureEvents.push({
            time: nextBatch,
            callback: (player) => {
                player.extraAttackCount += this.count;
                if (player.log)
                    player.log(nextBatch, `Gained ${this.count} extra attacks from ${this.parent.name}`);
            }
        });
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
    constructor(spell, rate, requiresSwing = false) {
        this.spells = Array.isArray(spell) ? spell : [spell];
        this.rate = rate;
        this.requiresSwing = requiresSwing;
    }
    run(player, weapon, time, triggeringEffect) {
        if (this.requiresSwing && triggeringEffect && !(triggeringEffect instanceof SwingEffect)) {
            return;
        }
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
        let tmpvalue = armor / ((85 * attacker.level) + 400);
        tmpvalue /= (1 + tmpvalue);
        const armorModifier = clamp(tmpvalue, 0, 0.75);
        return Math.max(1, damage - (damage * armorModifier));
    }
}

var Race;
(function (Race) {
    Race[Race["HUMAN"] = 0] = "HUMAN";
    Race[Race["ORC"] = 1] = "ORC";
    Race[Race["GNOME"] = 2] = "GNOME";
    Race[Race["TROLL"] = 3] = "TROLL";
})(Race || (Race = {}));
var Faction;
(function (Faction) {
    Faction[Faction["ALLIANCE"] = 0] = "ALLIANCE";
    Faction[Faction["HORDE"] = 1] = "HORDE";
})(Faction || (Faction = {}));
const FACTION_OF_RACE = {
    [Race.HUMAN]: Faction.ALLIANCE,
    [Race.GNOME]: Faction.ALLIANCE,
    [Race.ORC]: Faction.HORDE,
    [Race.TROLL]: Faction.HORDE,
};
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
        this.futureEvents = [];
        this.hitStats = new Map();
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
    calculateCritSuppression(victim) {
        return (victim.defenseSkill - this.maxSkillForLevel) * 0.2 + (victim.level === 63 ? 1.8 : 0);
    }
    calculateCritChance(victim, is_mh, effect) {
        if (effect && effect.type == EffectType.PHYSICAL) {
            effect = undefined;
        }
        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;
        const weapons = [];
        if (this.mh) {
            weapons.push(this.mh);
        }
        if (this.oh) {
            weapons.push(this.oh);
        }
        for (let weapon of weapons) {
            if (weapon.temporaryEnchant && weapon.temporaryEnchant.stats && weapon.temporaryEnchant.stats.crit) {
                crit += weapon.temporaryEnchant.stats.crit;
            }
        }
        crit -= this.calculateCritSuppression(victim);
        return crit;
    }
    calculateMissChance(victim, is_mh, effect) {
        let res = 5;
        const skillDiff = victim.defenseSkill - this.calculateWeaponSkillValue(is_mh, effect);
        res += skillDiff * (skillDiff > 10 ? 0.2 : 0.1);
        if (this.oh && !effect && !this.queuedSpell) {
            res = res * 0.8 + 20;
        }
        res -= this.buffManager.stats.hit;
        return clamp(res, 0, 60);
    }
    calculateGlancingReduction(victim, is_mh) {
        const skillDiff = victim.defenseSkill - this.calculateWeaponSkillValue(is_mh);
        const lowEnd = Math.min(1.3 - 0.05 * skillDiff, 0.91);
        const highEnd = clamp(1.2 - 0.03 * skillDiff, 0.2, 0.99);
        return (lowEnd + highEnd) / 2;
    }
    get ap() {
        return 0;
    }
    calculateSwingMinMaxDamage(is_mh, normalized = false) {
        const weapon = is_mh ? this.mh : this.oh;
        const ap_bonus = this.ap / 14 * (normalized ? normalizedWeaponSpeed[weapon.weapon.type] : weapon.weapon.speed);
        const ohPenalty = is_mh ? 1 : 0.625;
        return [
            (weapon.min + ap_bonus + this.buffManager.stats.plusDamage) * ohPenalty,
            (weapon.max + ap_bonus + this.buffManager.stats.plusDamage) * ohPenalty
        ];
    }
    calculateSwingRawDamage(is_mh, normalized = false) {
        return frand(...this.calculateSwingMinMaxDamage(is_mh, normalized));
    }
    critCap() {
        const skillBonus = 10 * (this.calculateWeaponSkillValue(true) - this.target.maxSkillForLevel);
        const miss_chance = Math.round(this.calculateMissChance(this.target, true) * 100);
        const dodge_chance = Math.round(this.target.dodgeChance * 100) - skillBonus;
        const glance_chance = clamp((10 + (this.target.defenseSkill - 300) * 2) * 100, 0, 4000);
        const crit_suppression = Math.round(100 * this.calculateCritSuppression(this.target));
        return (10000 - (miss_chance + dodge_chance + glance_chance - crit_suppression)) / 100;
    }
    rollMeleeHitOutcome(victim, is_mh, effect) {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, effect) * 100);
        tmp = miss_chance;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }
        const dodge_chance = Math.round(victim.dodgeChance * 100) - 10 * (this.calculateWeaponSkillValue(is_mh, effect) - victim.maxSkillForLevel);
        tmp = dodge_chance;
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
        const crit_chance = Math.round(this.calculateCritChance(victim, is_mh, effect) * 100);
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
                proc.run(this, (is_mh ? this.mh : this.oh).weapon, time, effect);
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
        const damageName = effect ? effect.parent.name : (is_mh ? "mh" : "oh");
        if (damageName === "mh" && effect) {
            console.log("fuck");
        }
        let prevStats = this.hitStats.get(damageName);
        if (!prevStats) {
            prevStats = {
                [MeleeHitOutcome.MELEE_HIT_EVADE]: 0,
                [MeleeHitOutcome.MELEE_HIT_MISS]: 0,
                [MeleeHitOutcome.MELEE_HIT_DODGE]: 0,
                [MeleeHitOutcome.MELEE_HIT_BLOCK]: 0,
                [MeleeHitOutcome.MELEE_HIT_PARRY]: 0,
                [MeleeHitOutcome.MELEE_HIT_GLANCING]: 0,
                [MeleeHitOutcome.MELEE_HIT_CRIT]: 0,
                [MeleeHitOutcome.MELEE_HIT_CRUSHING]: 0,
                [MeleeHitOutcome.MELEE_HIT_NORMAL]: 0,
                [MeleeHitOutcome.MELEE_HIT_BLOCK_CRIT]: 0,
            };
            this.hitStats.set(damageName, prevStats);
        }
        prevStats[hitOutcome]++;
        if (effect instanceof SpellDamageEffect) {
            if (effect.callback) {
                effect.callback(this, hitOutcome, time);
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
        if (is_mh && this.queuedSpell && this.queuedSpell.canCast(time)) {
            this.queuedSpell.cast(time);
            this.queuedSpell = undefined;
        }
        else {
            if (is_mh) {
                this.queuedSpell = undefined;
            }
            const rawDamage = this.calculateSwingRawDamage(is_mh);
            this.dealMeleeDamage(time, rawDamage, target, is_mh);
        }
        const [thisWeapon, otherWeapon] = is_mh ? [this.mh, this.oh] : [this.oh, this.mh];
        thisWeapon.nextSwingTime = time + thisWeapon.weapon.speed / this.buffManager.stats.haste * 1000;
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
            if (this.oh && time >= this.oh.nextSwingTime) {
                this.swingWeapon(time, this.target, false);
            }
        }
    }
}

const flurry = new Buff("Flurry", 15, { haste: 1.3 }, true, 3, undefined, undefined, false);
const raceToStats = new Map();
raceToStats.set(Race.HUMAN, { maceSkill: 5, swordSkill: 5, mace2HSkill: 5, sword2HSkill: 5, str: 120, agi: 80 });
raceToStats.set(Race.ORC, { axeSkill: 5, axe2HSkill: 5, str: 123, agi: 77 });
raceToStats.set(Race.GNOME, { str: 115, agi: 83 });
raceToStats.set(Race.TROLL, { str: 121, agi: 82 });
class Warrior extends Player {
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
const angerManagementOT = new BuffOverTime("Anger Management", Number.MAX_SAFE_INTEGER, undefined, 3000, new ModifyPowerEffect(1));
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
        name: '15 Strength',
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        stats: { str: 15 },
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
        name: '7 Strength',
        slot: ItemSlot.HANDS,
        stats: { str: 7 },
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
        name: 'Might of the Scourge',
        slot: ItemSlot.SHOULDER,
        stats: { ap: 26, crit: 1 },
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
        name: "Ironfoe 2/3",
        slot: ItemSlot.MAINHAND,
        type: WeaponType.MACE,
        min: 73,
        max: 136,
        speed: 2.4,
        onhit: new Proc(new ExtraAttack('Ironfoe', 2), { ppm: 2 / 3 })
    },
    {
        name: "Ironfoe No proc",
        slot: ItemSlot.MAINHAND,
        type: WeaponType.MACE,
        min: 73,
        max: 136,
        speed: 2.4
    },
    {
        name: "Flurry Axe",
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        type: WeaponType.AXE,
        min: 37,
        max: 69,
        speed: 1.5,
        onhit: new Proc(new ExtraAttack('Ironfoe', 2), { ppm: 1.865 })
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
        name: "Sand Polished Hammer",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 97,
        max: 181,
        speed: 2.6,
        stats: { ap: 20, crit: 1 }
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
        name: "The Castigator",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 119,
        max: 221,
        speed: 2.6,
        stats: { crit: 1, hit: 1, ap: 16 }
    },
    {
        name: "Hand of Justice",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: { ap: 20 },
        onequip: new Proc(new ExtraAttack('Hand of Justice', 1), { chance: 2 / 100 })
    },
    {
        name: "Darkmoon Card: Maelstrom",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onequip: new Proc(new SpellDamage("Electric Discharge", [200, 301], EffectType.MAGIC), { ppm: 1 })
    },
    {
        name: "Darkmoon Card: Maelstrom 2ppm",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onequip: new Proc(new SpellDamage("Electric Discharge", [200, 301], EffectType.MAGIC), { ppm: 2 })
    },
    {
        name: "Darkmoon Card: Maelstrom 2%",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onequip: new Proc(new SpellDamage("Electric Discharge", [200, 301], EffectType.MAGIC), { chance: 2 / 100 })
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
        name: "Helm of Endless Rage",
        slot: ItemSlot.HEAD,
        stats: { str: 26, agi: 26 }
    },
    {
        name: "Rank 10 helm",
        slot: ItemSlot.HEAD,
        stats: { str: 21, crit: 1, hit: 1 }
    },
    {
        name: "Rank 10 helm (+40 ap)",
        slot: ItemSlot.HEAD,
        stats: { str: 21, crit: 1, hit: 1, ap: 40 }
    },
    {
        name: "Expert Goldminer's Helmet",
        slot: ItemSlot.HEAD,
        stats: { agi: 5, axeSkill: 7 }
    },
    {
        name: "Barbed Choker",
        slot: ItemSlot.NECK,
        stats: { ap: 44, crit: 1 }
    },
    {
        name: "The Eye of Hakkar",
        slot: ItemSlot.NECK,
        stats: { ap: 40, crit: 1 }
    },
    {
        name: "Stormrage's Talisman of Seething",
        slot: ItemSlot.NECK,
        stats: { crit: 2, ap: 26 }
    },
    {
        name: "Onyxia Tooth Pendant",
        slot: ItemSlot.NECK,
        stats: { agi: 12, hit: 1, crit: 1 }
    },
    {
        name: "Amulet of the Darkmoon",
        slot: ItemSlot.NECK,
        stats: { agi: 19, str: 10 }
    },
    {
        name: "Conqueror's Spaulders",
        slot: ItemSlot.SHOULDER,
        stats: { str: 20, agi: 16, hit: 1 }
    },
    {
        name: "Mantle of Wicked Revenge",
        slot: ItemSlot.SHOULDER,
        stats: { str: 16, agi: 30 }
    },
    {
        name: "Rank 10 Shoulders",
        slot: ItemSlot.SHOULDER,
        stats: { str: 17, crit: 1 }
    },
    {
        name: "Rank 10 Shoulders (+40 ap)",
        slot: ItemSlot.SHOULDER,
        stats: { str: 17, crit: 1, ap: 40 }
    },
    {
        name: "Drake Talon Pauldrons",
        slot: ItemSlot.SHOULDER,
        stats: { str: 20, agi: 20 }
    },
    {
        name: "Truestrike Shoulders",
        slot: ItemSlot.SHOULDER,
        stats: { ap: 24, hit: 2 }
    },
    {
        name: "Lieutenant Commander's Plate Shoulders",
        slot: ItemSlot.SHOULDER,
        stats: { str: 17, ap: 40, crit: 1 }
    },
    {
        name: "Cloak of Draconic Might",
        slot: ItemSlot.BACK,
        stats: { str: 16, agi: 16 }
    },
    {
        name: "Cape of the Black Baron",
        slot: ItemSlot.BACK,
        stats: { ap: 20, agi: 15 }
    },
    {
        name: "Zulian Tigerhide ",
        slot: ItemSlot.BACK,
        stats: { hit: 1, agi: 13 }
    },
    {
        name: "Drape of Unyielding Strength",
        slot: ItemSlot.BACK,
        stats: { str: 15, agi: 9, hit: 1 }
    },
    {
        name: "Puissant Cape",
        slot: ItemSlot.BACK,
        stats: { ap: 40, hit: 1 }
    },
    {
        name: "Shroud of Dominion",
        slot: ItemSlot.BACK,
        stats: { crit: 1, ap: 50 }
    },
    {
        name: "Conqueror's Breastplate",
        slot: ItemSlot.CHEST,
        stats: { str: 34, agi: 24 }
    },
    {
        name: "Savage Gladiator Chain",
        slot: ItemSlot.CHEST,
        stats: { agi: 14, str: 13, crit: 2 }
    },
    {
        name: "Rank 10 chest",
        slot: ItemSlot.CHEST,
        stats: { str: 21, crit: 1 }
    },
    {
        name: "Rank 10 chest (+40)",
        slot: ItemSlot.CHEST,
        stats: { str: 21, crit: 1, ap: 40 }
    },
    {
        name: "Cadaverous Armor",
        slot: ItemSlot.CHEST,
        stats: { agi: 8, str: 8, ap: 60 }
    },
    {
        name: "Ghoul Skin Tunic",
        slot: ItemSlot.CHEST,
        stats: { str: 40, crit: 2 }
    },
    {
        name: "Malfurion's Blessed Bulwark",
        slot: ItemSlot.CHEST,
        stats: { str: 40 }
    },
    {
        name: "Breastplate of Annihilation",
        slot: ItemSlot.CHEST,
        stats: { str: 37, crit: 1, hit: 1 }
    },
    {
        name: "Plated Abomination Ribcage",
        slot: ItemSlot.CHEST,
        stats: { str: 45, crit: 1, hit: 1 }
    },
    {
        name: "Runed Bloodstained Hauberk",
        slot: ItemSlot.CHEST,
        stats: { ap: 58, crit: 1 }
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
        name: "Sacrificial Gauntlets",
        slot: ItemSlot.HANDS,
        stats: { str: 19, crit: 1, hit: 1 }
    },
    {
        name: "Flameguard Gauntlets",
        slot: ItemSlot.HANDS,
        stats: { crit: 1, ap: 54 }
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
        name: "Devilsaur Gauntlets (+ 2 hit)",
        slot: ItemSlot.HANDS,
        stats: { ap: 28, crit: 1, hit: 2 }
    },
    {
        name: "Eldritch Reinforced Legplates",
        slot: ItemSlot.LEGS,
        stats: { str: 15, agi: 9, crit: 1 }
    },
    {
        name: "Abyssal Striking",
        slot: ItemSlot.LEGS,
        stats: { str: 15, agi: 15, crit: 1 }
    },
    {
        name: "Cloudkeeper Legplates",
        slot: ItemSlot.LEGS,
        stats: { str: 20, agi: 20 }
    },
    {
        name: "Devilsaur Leggings",
        slot: ItemSlot.LEGS,
        stats: { ap: 46, crit: 1 }
    },
    {
        name: "Scaled Sand Reaver Leggings",
        slot: ItemSlot.LEGS,
        stats: { ap: 62, crit: 2 }
    },
    {
        name: "Bloodmail Boots",
        slot: ItemSlot.FEET,
        stats: { agi: 9, str: 9, hit: 1 }
    },
    {
        name: "Battlechaser's Greaves",
        slot: ItemSlot.FEET,
        stats: { str: 14, agi: 13 }
    },
    {
        name: "Blooddrenched Footpads",
        slot: ItemSlot.FEET,
        stats: { hit: 1, agi: 21 }
    },
    {
        name: "Omokk's Girth Restrainer",
        slot: ItemSlot.WAIST,
        stats: { crit: 1, str: 15 }
    },
    {
        name: "Brigam Girdle",
        slot: ItemSlot.WAIST,
        stats: { hit: 1, str: 15 }
    },
    {
        name: "Onslaught Girdle",
        slot: ItemSlot.WAIST,
        stats: { str: 31, crit: 1, hit: 1 }
    },
    {
        name: "Girdle of the Mentor",
        slot: ItemSlot.WAIST,
        stats: { str: 21, agi: 20, crit: 1, hit: 1 }
    },
    {
        name: "Belt of Preserved Heads",
        slot: ItemSlot.WAIST,
        stats: { str: 14, agi: 15, hit: 1 }
    },
    {
        name: "Titanic Leggings",
        slot: ItemSlot.LEGS,
        stats: { str: 30, crit: 1, hit: 2 }
    },
    {
        name: "Legplates of Carnage",
        slot: ItemSlot.LEGS,
        stats: { str: 42, crit: 2 }
    },
    {
        name: "Conqueror's Legguards",
        slot: ItemSlot.LEGS,
        stats: { agi: 21, str: 33, hit: 1 }
    },
    {
        name: "Legguards of the Fallen Crusader",
        slot: ItemSlot.LEGS,
        stats: { str: 28, agi: 22 }
    },
    {
        name: "Bloodsoaked Legplates",
        slot: ItemSlot.LEGS,
        stats: { str: 36 }
    },
    {
        name: "Rank 10 Leggings",
        slot: ItemSlot.LEGS,
        stats: { str: 12, crit: 2 }
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
        name: "Rank 10 Boots",
        slot: ItemSlot.FEET,
        stats: { str: 10, agi: 9 }
    },
    {
        name: "Boots of the Shadow Flame",
        slot: ItemSlot.FEET,
        stats: { ap: 44, hit: 2 }
    },
    {
        name: "Striker's Mark",
        slot: ItemSlot.RANGED,
        stats: { ap: 22, hit: 1 }
    },
    {
        name: "Satyr's Bow",
        slot: ItemSlot.RANGED,
        stats: { agi: 3, hit: 1 }
    },
    {
        name: "Crossbow of Imminent Doom",
        slot: ItemSlot.RANGED,
        stats: { agi: 7, str: 5, hit: 1 }
    },
    {
        name: "Nerubian Slavemaker",
        slot: ItemSlot.RANGED,
        stats: { ap: 24, crit: 1 }
    },
    {
        name: "Bloodseeker",
        slot: ItemSlot.RANGED,
        stats: { str: 8, agi: 7 }
    },
    {
        name: "Gurubashi Dwarf Destroyer",
        slot: ItemSlot.RANGED,
        stats: { ap: 30 }
    },
    {
        name: "Larvae of the Great Worm",
        slot: ItemSlot.RANGED,
        stats: { ap: 18, crit: 1 }
    },
    {
        name: "Seal of Jin",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { ap: 20, crit: 1 }
    },
    {
        name: "Band of Jin (+30 ap)",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { agi: 14, hit: 1, ap: 30 }
    },
    {
        name: "Tarnished Elven Ring",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { agi: 15, hit: 1 }
    },
    {
        name: "Magni's Will",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { str: 6, crit: 1 }
    },
    {
        name: "Quick Strike Ring",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { ap: 30, crit: 1, str: 5 }
    },
    {
        name: "Circle of Applied Force",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { str: 12, agi: 22 }
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
        name: "Band of Unnatural Forces",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { crit: 1, hit: 1, ap: 52 }
    },
    {
        name: "Black Dragonscale Shoulders (set bonus)",
        slot: ItemSlot.SHOULDER,
        stats: { ap: 45, crit: 2, hit: 1 }
    },
    {
        name: "Bloodsoaked Pauldrons",
        slot: ItemSlot.SHOULDER,
        stats: { agi: 11, str: 16 }
    },
    {
        name: "Abyssal Shoulders Striking",
        slot: ItemSlot.SHOULDER,
        stats: { agi: 13, str: 13, hit: 1 }
    },
    {
        name: "Black Dragonscale Leggings",
        slot: ItemSlot.LEGS,
        stats: { ap: 54 }
    },
    {
        name: "Black Dragonscale Boots",
        slot: ItemSlot.FEET,
        stats: { ap: 28 }
    },
    {
        name: "Gargoyle Slashers",
        slot: ItemSlot.HANDS,
        stats: { agi: 5, str: 10, crit: 1 }
    },
    {
        name: "Painweaver Band",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { crit: 1, ap: 16 }
    },
    {
        name: "Vambraces of the Sadist",
        slot: ItemSlot.WRIST,
        stats: { str: 6, crit: 1 }
    },
    {
        name: "Wristguards of Stability",
        slot: ItemSlot.WRIST,
        stats: { str: 24 }
    },
    {
        name: "Berserker Bracers",
        slot: ItemSlot.WRIST,
        stats: { str: 19, agi: 8 }
    },
    {
        name: "Zandalar Vindicator's Armguards",
        slot: ItemSlot.WRIST,
        stats: { str: 13, agi: 13 }
    },
    {
        name: "Battleborn Armbraces",
        slot: ItemSlot.WRIST,
        stats: { hit: 1, crit: 1 }
    },
    {
        name: "Simple Sword (2.6)",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 140,
        max: 160,
        speed: 2.6,
    },
    {
        name: "Simple Sword (1.8)",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 50,
        max: 60,
        speed: 1.8,
    },
    {
        name: "Vis'kag the Bloodletter",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 100,
        max: 187,
        speed: 2.6,
        onhit: new Proc(new ItemSpellDamage("Fatal Wounds", 240, EffectType.PHYSICAL), { ppm: 0.6 })
    },
    {
        name: "Spineshatter",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND,
        min: 99,
        max: 184,
        speed: 2.6,
        stats: { str: 9 }
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
        name: "Maladath (no skill)",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 86,
        max: 162,
        speed: 2.2
    },
    {
        name: "Ravencrest's Legacy",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 84,
        max: 157,
        speed: 2.1,
        stats: { agi: 9, str: 13 }
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
        name: "Warblade of the Hakkari",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 59,
        max: 110,
        speed: 1.7,
        stats: { swordSkill: 6, ap: 28, crit: 1 }
    },
    {
        name: "Warblade of the Hakkari",
        type: WeaponType.SWORD,
        slot: ItemSlot.OFFHAND,
        min: 57,
        max: 106,
        speed: 1.7,
        stats: { ap: 40 }
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
        name: "Deathbringer",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 114,
        max: 213,
        speed: 2.90,
        onhit: new Proc(new SpellDamage("Shadow Bolt", [110, 141], EffectType.MAGIC), { ppm: 0.820 })
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
        name: "Axe of the Deep Woods",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND,
        min: 78,
        max: 146,
        speed: 2.7,
        onhit: new Proc(new SpellDamage("Wrath", [90, 127], EffectType.MAGIC), { ppm: 0.820 })
    },
    {
        name: "Zulian Hacker (no raw stats)",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 71,
        max: 134,
        speed: 2.40,
        stats: { axeSkill: 2 }
    },
    {
        name: "Rivenspike (no proc)",
        type: WeaponType.AXE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 77,
        max: 144,
        speed: 2.90
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
        name: "Mirah's Song Slow",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 67,
        max: 125,
        speed: 2.4,
        stats: { agi: 9, str: 9 }
    },
    {
        name: "Mirah's Song with skill",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 57,
        max: 87,
        speed: 1.8,
        stats: { agi: 9, str: 9, swordSkill: 4 }
    },
    {
        name: "Mass of McGowan",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND,
        min: 80,
        max: 149,
        speed: 2.8,
        stats: { str: 10 }
    },
    {
        name: "Stormstrike Hammer",
        type: WeaponType.MACE,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 80,
        max: 150,
        speed: 2.7,
        stats: { str: 15 }
    },
    {
        name: "Dal'Rend's Sacred Charge",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 81,
        max: 151,
        speed: 2.8,
        stats: { str: 4, crit: 1 }
    },
    {
        name: "Dal'Rend's Tribal Gaurdian",
        type: WeaponType.SWORD,
        slot: ItemSlot.OFFHAND,
        min: 52,
        max: 97,
        speed: 1.8,
        stats: { ap: 50 }
    },
    {
        name: "Brutality Blade",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 90,
        max: 168,
        speed: 2.5,
        stats: { str: 9, agi: 9, crit: 1 }
    },
    {
        name: "Sword of Zeal",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 81,
        max: 151,
        speed: 2.8,
        onhit: new Proc(new SpellBuff(new Buff("Zeal", 15, { plusDamage: 10 })), { ppm: 1.8 })
    },
    {
        name: "Sword of Zeal No Proc",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 81,
        max: 151,
        speed: 2.8
    },
    {
        name: "Sword of Zeal Insane",
        type: WeaponType.SWORD,
        slot: ItemSlot.MAINHAND,
        min: 81,
        max: 151,
        speed: 2.8,
        onhit: new Proc(new SpellBuff(new Buff("Zeal", 15, { plusDamage: 1000 })), { ppm: 1.8 })
    },
    {
        name: "Kingsfall",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 105,
        max: 158,
        speed: 1.8,
        stats: { agi: 16, crit: 1, hit: 1 }
    },
    {
        name: "Harbinger of Doom",
        type: WeaponType.DAGGER,
        slot: ItemSlot.MAINHAND | ItemSlot.OFFHAND,
        min: 83,
        max: 126,
        speed: 1.6,
        stats: { agi: 8, crit: 1, hit: 1 }
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
        name: "Kiss of the Spider",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: { crit: 1, hit: 1 },
        onuse: new SpellBuff(new Buff("Kiss of the Spider", 15, { haste: 1.2 }), false, 0, 2 * 60),
    },
    {
        name: "Slayer's Crest",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        stats: { ap: 64 },
        onuse: new SpellBuff(new Buff("Slayer's Crest", 20, { ap: 260 }), false, 0, 2 * 60),
    },
    {
        name: "Diamond Flask",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onuse: new SpellBuff(new Buff("Diamond Flask", 60, { str: 75 }), true, 0, 6 * 60),
    },
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
    }
];

function setupPlayer(race, stats, equipment, enchants, temporaryEnchant, buffs, vael = false, log) {
    const player = new Warrior(race, stats, log);
    for (let [slot, item] of equipment) {
        player.equip(slot, item, enchants.get(slot), temporaryEnchant.get(slot));
    }
    for (let buff of buffs) {
        player.buffManager.add(new Buff(buff.name, buff.duration, buff.stats), -10 * 1000);
    }
    if (vael) {
        const essenceOfTheRed = new BuffOverTime("Essence of the Red", Number.MAX_SAFE_INTEGER, undefined, 1000, new ModifyPowerEffect(20));
        player.buffManager.add(essenceOfTheRed, Math.random() * -1000);
    }
    const boss = new Unit(63, 3700 - 2250 - 640 - 505);
    player.target = boss;
    if (player.mh && player.oh && player.mh.weapon.speed === player.oh.weapon.speed) {
        player.oh.nextSwingTime += player.oh.weapon.speed / 2 * 1000;
    }
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

class Fight {
    constructor(race, stats, equipment, enchants, temporaryEnchants, buffs, chooseAction, fightLength = 60, vael = false, log) {
        this.duration = 0;
        this.player = setupPlayer(race, stats, equipment, enchants, temporaryEnchants, buffs, vael, log);
        this.chooseAction = chooseAction;
        this.fightLength = (fightLength + Math.random() * 4 - 2) * 1000;
        const EXECUTE_PHASE_RATIO = 0.15;
        const VAEL_EXECUTE_PHASE_RATIO = 0.5;
        this.beginExecuteTime = this.fightLength * (1 - (vael ? VAEL_EXECUTE_PHASE_RATIO : EXECUTE_PHASE_RATIO));
    }
    run() {
        return new Promise((f, r) => {
            while (this.duration <= this.fightLength) {
                this.update();
            }
            this.player.buffManager.removeAllBuffs(this.fightLength);
            f({
                damageLog: this.player.damageLog,
                fightLength: this.fightLength,
                beginExecuteTime: this.beginExecuteTime,
                powerLost: this.player.powerLost,
                buffUptime: this.player.buffManager.buffUptimeMap,
                hitStats: this.player.hitStats,
            });
        });
    }
    pause(pause) { }
    cancel() { }
    update() {
        const futureEvents = this.player.futureEvents;
        this.player.futureEvents = [];
        for (let futureEvent of futureEvents) {
            if (futureEvent.time === this.duration) {
                futureEvent.callback(this.player);
            }
            else {
                this.player.futureEvents.push(futureEvent);
            }
        }
        const isExecutePhase = this.duration >= this.beginExecuteTime;
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
        if (!isExecutePhase && this.beginExecuteTime < this.duration) {
            this.duration = this.beginExecuteTime;
        }
        for (let futureEvent of this.player.futureEvents) {
            this.duration = Math.min(this.duration, futureEvent.time);
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
            const loop = () => {
                if (this.duration <= this.fightLength) {
                    if (!this.paused) {
                        this.update();
                    }
                    setTimeout(loop, MS_PER_UPDATE);
                }
                else {
                    f({
                        damageLog: this.player.damageLog,
                        fightLength: this.fightLength,
                        beginExecuteTime: this.beginExecuteTime,
                        powerLost: this.player.powerLost,
                        buffUptime: new Map(),
                        hitStats: this.player.hitStats,
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
    constructor(race, stats, equipment, enchants, temporaryEnchants, buffs, chooseAction, fightLength = 60, realtime = false, vael = false, log) {
        this.requestStop = false;
        this._paused = false;
        this.fightResults = [];
        this.cachedSummmary = { normalDamage: 0, execDamage: 0, normalDuration: 0, execDuration: 0, powerLost: 0, fights: 0, buffUptime: new Map(), hitStats: new Map() };
        this.race = race;
        this.stats = stats;
        this.equipment = equipment;
        this.enchants = enchants;
        this.temporaryEnchants = temporaryEnchants;
        this.buffs = buffs;
        this.chooseAction = chooseAction;
        this.fightLength = fightLength;
        this.realtime = realtime;
        this.vael = vael;
        this.log = log;
    }
    get paused() {
        return this._paused;
    }
    get status() {
        for (let fightResult of this.fightResults) {
            for (let [time, damage] of fightResult.damageLog) {
                if (time >= fightResult.beginExecuteTime) {
                    this.cachedSummmary.execDamage += damage;
                }
                else {
                    this.cachedSummmary.normalDamage += damage;
                }
            }
            this.cachedSummmary.normalDuration += fightResult.beginExecuteTime;
            this.cachedSummmary.execDuration += fightResult.fightLength - fightResult.beginExecuteTime;
            this.cachedSummmary.powerLost += fightResult.powerLost;
            for (let [buff, duration] of fightResult.buffUptime) {
                this.cachedSummmary.buffUptime.set(buff, (this.cachedSummmary.buffUptime.get(buff) || 0) + duration);
            }
            for (let [ability, hitOutComes] of fightResult.hitStats) {
                const currAbilityStats = this.cachedSummmary.hitStats.get(ability);
                if (currAbilityStats) {
                    const NUM_HIT_TYPES = 10;
                    for (let i = 0; i < NUM_HIT_TYPES; i++) {
                        currAbilityStats[i] += hitOutComes[i];
                    }
                }
                else {
                    this.cachedSummmary.hitStats.set(ability, hitOutComes);
                }
            }
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
            for (let [time, damage] of this.currentFight.player.damageLog) {
                if (time >= this.currentFight.beginExecuteTime) {
                    execDamage += damage;
                }
                else {
                    normalDamage += damage;
                }
            }
            normalDuration += Math.min(this.currentFight.beginExecuteTime, this.currentFight.duration);
            execDuration += Math.max(0, this.currentFight.duration - this.currentFight.beginExecuteTime);
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
            buffUptime: this.cachedSummmary.buffUptime,
            hitStats: this.cachedSummmary.hitStats,
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
                this.currentFight = new fightClass(this.race, this.stats, this.equipment, this.enchants, this.temporaryEnchants, this.buffs, this.chooseAction, this.fightLength, this.vael, this.realtime ? this.log : undefined);
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

function generateChooseAction(useRecklessness, useHeroicStrikeR9, heroicStrikeRageReq, hamstringRageReq, bloodthirstExecRageMin, bloodthirstExecRageMax, mightyRageExecute, mightyRageRageReq, heroicStrikeInExecute) {
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
            if (useRecklessness && warrior.recklessness.canCast(time) && timeRemainingSeconds <= 15) {
                warrior.recklessness.cast(time);
            }
            else if (warrior.deathWish.canCast(time) &&
                (timeRemainingSeconds <= 30
                    || (timeRemainingSeconds - warrior.deathWish.spell.cooldown) > 30)) {
                warrior.deathWish.cast(time);
            }
            else if (executePhase && warrior.bloodthirst.canCast(time) && warrior.rage >= bloodthirstExecRageMin && warrior.rage <= bloodthirstExecRageMax) {
                warrior.bloodthirst.cast(time);
            }
            else if (executePhase && warrior.execute.canCast(time)) {
                warrior.execute.cast(time);
                if (mightyRageExecute && warrior.mightyRagePotion.canCast(time + 500)) {
                    warrior.futureEvents.push({
                        time: time + 500,
                        callback: () => {
                            warrior.mightyRagePotion.cast(time + 500);
                        }
                    });
                }
            }
            else if (warrior.bloodthirst.canCast(time)) {
                warrior.bloodthirst.cast(time);
            }
            else if (warrior.bloodthirst.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                if (warrior.bloodthirst.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.bloodthirst.cooldown);
                }
            }
            else if (!executePhase && warrior.whirlwind.canCast(time)) {
                warrior.whirlwind.cast(time);
            }
            else if (warrior.whirlwind.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                if (warrior.whirlwind.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.whirlwind.cooldown);
                }
            }
            else if (!executePhase && warrior.rage >= hamstringRageReq && warrior.hamstring.canCast(time)) {
                warrior.hamstring.cast(time);
            }
        }
        if (!mightyRageExecute && warrior.mightyRagePotion.canCast(time) && timeRemainingSeconds <= 20 && warrior.rage <= mightyRageRageReq) {
            warrior.mightyRagePotion.cast(time);
        }
        const heroicStrikeSpell = useHeroicStrikeR9 ? warrior.heroicStrikeR9 : warrior.heroicStrikeR8;
        if ((!executePhase || heroicStrikeInExecute) && warrior.rage >= heroicStrikeSpell.spell.cost && !warrior.queuedSpell && warrior.rage >= heroicStrikeRageReq) {
            warrior.queuedSpell = heroicStrikeSpell;
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
    currentSim = new Simulation(simdesc.race, simdesc.stats, lookupItems(simdesc.equipment), lookupEnchants(simdesc.enchants), lookupTemporaryEnchants(simdesc.temporaryEnchants), lookupBuffs(simdesc.buffs), generateChooseAction(simdesc.useRecklessness, simdesc.useHeroicStrikeR9, simdesc.heroicStrikeRageReq, simdesc.hamstringRageReq, simdesc.bloodthirstExecRageMin, simdesc.bloodthirstExecRageMax, simdesc.executeMightyRage, simdesc.mightyRageRageReq, simdesc.heroicStrikeInExecute), simdesc.fightLength, simdesc.realtime, simdesc.vael, logFunction);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3NwZWxsLnRzIiwiLi4vc3JjL2l0ZW0udHMiLCIuLi9zcmMvdW5pdC50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL2VuY2hhbnRzLnRzIiwiLi4vc3JjL2RhdGEvaXRlbXMudHMiLCIuLi9zcmMvZGF0YS9zcGVsbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbl91dGlscy50cyIsIi4uL3NyYy9zaW11bGF0aW9uLnRzIiwiLi4vc3JjL3dhcnJpb3JfYWkudHMiLCIuLi9zcmMvcnVuX3NpbXVsYXRpb25fd29ya2VyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbInR5cGUgV29ya2VyRXZlbnRMaXN0ZW5lciA9IChkYXRhOiBhbnkpID0+IHZvaWQ7XG5cbmNsYXNzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBldmVudExpc3RlbmVyczogTWFwPHN0cmluZywgV29ya2VyRXZlbnRMaXN0ZW5lcltdPiA9IG5ldyBNYXAoKTtcblxuICAgIGNvbnN0cnVjdG9yKHRhcmdldDogYW55KSB7XG4gICAgICAgIHRhcmdldC5vbm1lc3NhZ2UgPSAoZXY6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMuZ2V0KGV2LmRhdGEuZXZlbnQpIHx8IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgbGlzdGVuZXIgb2YgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyKGV2LmRhdGEuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogV29ya2VyRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBpZiAodGhpcy5ldmVudExpc3RlbmVycy5oYXMoZXZlbnQpKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldmVudCkhLnB1c2gobGlzdGVuZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5zZXQoZXZlbnQsIFtsaXN0ZW5lcl0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lclRvUmVtb3ZlOiBXb3JrZXJFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50TGlzdGVuZXJzLmhhcyhldmVudCkpIHtcbiAgICAgICAgICAgIGxldCBldmVudExpc3RlbmVyc0ZvckV2ZW50ID0gdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpO1xuICAgICAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLnNldChldmVudCwgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudC5maWx0ZXIoKGxpc3RlbmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lciAhPT0gbGlzdGVuZXJUb1JlbW92ZTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVFdmVudExpc3RlbmVyc0ZvckV2ZW50KGV2ZW50OiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5kZWxldGUoZXZlbnQpO1xuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImV4cG9ydCBpbnRlcmZhY2UgU3RhdFZhbHVlcyB7XG4gICAgYXA/OiBudW1iZXI7XG4gICAgc3RyPzogbnVtYmVyO1xuICAgIGFnaT86IG51bWJlcjtcbiAgICBoaXQ/OiBudW1iZXI7XG4gICAgY3JpdD86IG51bWJlcjtcbiAgICBoYXN0ZT86IG51bWJlcjtcbiAgICBzdGF0TXVsdD86IG51bWJlcjtcbiAgICBkYW1hZ2VNdWx0PzogbnVtYmVyO1xuICAgIGFybW9yUGVuZXRyYXRpb24/OiBudW1iZXI7XG4gICAgcGx1c0RhbWFnZT86IG51bWJlcjtcblxuICAgIHN3b3JkU2tpbGw/OiBudW1iZXI7XG4gICAgYXhlU2tpbGw/OiBudW1iZXI7XG4gICAgbWFjZVNraWxsPzogbnVtYmVyO1xuICAgIGRhZ2dlclNraWxsPzogbnVtYmVyO1xuICAgIHN3b3JkMkhTa2lsbD86IG51bWJlcjtcbiAgICBheGUySFNraWxsPzogbnVtYmVyO1xuICAgIG1hY2UySFNraWxsPzogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgU3RhdHMgaW1wbGVtZW50cyBTdGF0VmFsdWVzIHtcbiAgICBhcCE6IG51bWJlcjtcbiAgICBzdHIhOiBudW1iZXI7XG4gICAgYWdpITogbnVtYmVyO1xuICAgIGhpdCE6IG51bWJlcjtcbiAgICBjcml0ITogbnVtYmVyO1xuICAgIGhhc3RlITogbnVtYmVyO1xuICAgIHN0YXRNdWx0ITogbnVtYmVyO1xuICAgIGRhbWFnZU11bHQhOiBudW1iZXI7XG4gICAgYXJtb3JQZW5ldHJhdGlvbiE6IG51bWJlcjtcbiAgICBwbHVzRGFtYWdlITogbnVtYmVyO1xuXG4gICAgc3dvcmRTa2lsbCE6IG51bWJlcjtcbiAgICBheGVTa2lsbCE6IG51bWJlcjtcbiAgICBtYWNlU2tpbGwhOiBudW1iZXI7XG4gICAgZGFnZ2VyU2tpbGwhOiBudW1iZXI7XG4gICAgc3dvcmQySFNraWxsITogbnVtYmVyO1xuICAgIGF4ZTJIU2tpbGwhOiBudW1iZXI7XG4gICAgbWFjZTJIU2tpbGwhOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzPzogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLnNldChzKTtcbiAgICB9XG5cbiAgICBzZXQocz86IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5hcCA9IChzICYmIHMuYXApIHx8IDA7XG4gICAgICAgIHRoaXMuc3RyID0gKHMgJiYgcy5zdHIpIHx8IDA7XG4gICAgICAgIHRoaXMuYWdpID0gKHMgJiYgcy5hZ2kpIHx8IDA7XG4gICAgICAgIHRoaXMuaGl0ID0gKHMgJiYgcy5oaXQpIHx8IDA7XG4gICAgICAgIHRoaXMuY3JpdCA9IChzICYmIHMuY3JpdCkgfHwgMDtcbiAgICAgICAgdGhpcy5oYXN0ZSA9IChzICYmIHMuaGFzdGUpIHx8IDE7XG4gICAgICAgIHRoaXMuc3RhdE11bHQgPSAocyAmJiBzLnN0YXRNdWx0KSB8fCAxO1xuICAgICAgICB0aGlzLmRhbWFnZU11bHQgPSAocyAmJiBzLmRhbWFnZU11bHQpIHx8IDE7XG4gICAgICAgIHRoaXMuYXJtb3JQZW5ldHJhdGlvbiA9IChzICYmIHMuYXJtb3JQZW5ldHJhdGlvbikgfHwgMDtcbiAgICAgICAgdGhpcy5wbHVzRGFtYWdlID0gKHMgJiYgcy5wbHVzRGFtYWdlKSB8fCAwO1xuXG4gICAgICAgIHRoaXMuc3dvcmRTa2lsbCA9IChzICYmIHMuc3dvcmRTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5heGVTa2lsbCA9IChzICYmIHMuYXhlU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMubWFjZVNraWxsID0gKHMgJiYgcy5tYWNlU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuZGFnZ2VyU2tpbGwgPSAocyAmJiBzLmRhZ2dlclNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLnN3b3JkMkhTa2lsbCA9IChzICYmIHMuc3dvcmQySFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmF4ZTJIU2tpbGwgPSAocyAmJiBzLmF4ZTJIU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMubWFjZTJIU2tpbGwgPSAocyAmJiBzLm1hY2UySFNraWxsKSB8fCAwO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGFkZChzOiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuYXAgKz0gKHMuYXAgfHwgMCk7XG4gICAgICAgIHRoaXMuc3RyICs9IChzLnN0ciB8fCAwKTtcbiAgICAgICAgdGhpcy5hZ2kgKz0gKHMuYWdpIHx8IDApO1xuICAgICAgICB0aGlzLmhpdCArPSAocy5oaXQgfHwgMCk7XG4gICAgICAgIHRoaXMuY3JpdCArPSAocy5jcml0IHx8IDApO1xuICAgICAgICB0aGlzLmhhc3RlICo9IChzLmhhc3RlIHx8IDEpO1xuICAgICAgICB0aGlzLnN0YXRNdWx0ICo9IChzLnN0YXRNdWx0IHx8IDEpO1xuICAgICAgICB0aGlzLmRhbWFnZU11bHQgKj0gKHMuZGFtYWdlTXVsdCB8fCAxKTtcbiAgICAgICAgdGhpcy5hcm1vclBlbmV0cmF0aW9uICs9IChzLmFybW9yUGVuZXRyYXRpb24gfHwgMCk7XG4gICAgICAgIHRoaXMucGx1c0RhbWFnZSArPSAocy5wbHVzRGFtYWdlIHx8IDApO1xuXG4gICAgICAgIHRoaXMuc3dvcmRTa2lsbCArPSAocy5zd29yZFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmF4ZVNraWxsICs9IChzLmF4ZVNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLm1hY2VTa2lsbCArPSAocy5tYWNlU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuZGFnZ2VyU2tpbGwgKz0gKHMuZGFnZ2VyU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuc3dvcmQySFNraWxsICs9IChzLnN3b3JkMkhTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5heGUySFNraWxsICs9IChzLmF4ZTJIU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMubWFjZTJIU2tpbGwgKz0gKHMubWFjZTJIU2tpbGwgfHwgMCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RhdHMsIFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBQcm9jLCBFZmZlY3QgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgV2VhcG9uRXF1aXBlZCB9IGZyb20gXCIuL2l0ZW0uanNcIjtcblxuZXhwb3J0IGNsYXNzIEJ1ZmZNYW5hZ2VyIHtcbiAgICBwbGF5ZXI6IFBsYXllcjtcblxuICAgIHByaXZhdGUgYnVmZkxpc3Q6IEJ1ZmZBcHBsaWNhdGlvbltdID0gW107XG4gICAgcHJpdmF0ZSBidWZmT3ZlclRpbWVMaXN0OiBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbltdID0gW107XG5cbiAgICBwdWJsaWMgYnVmZlVwdGltZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cbiAgICBiYXNlU3RhdHM6IFN0YXRzO1xuICAgIHN0YXRzOiBTdGF0cztcblxuICAgIGNvbnN0cnVjdG9yKHBsYXllcjogUGxheWVyLCBiYXNlU3RhdHM6IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMuYmFzZVN0YXRzID0gbmV3IFN0YXRzKGJhc2VTdGF0cyk7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBuZXcgU3RhdHModGhpcy5iYXNlU3RhdHMpO1xuICAgIH1cblxuICAgIGdldCBuZXh0T3ZlclRpbWVVcGRhdGUoKSB7XG4gICAgICAgIGxldCByZXMgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcblxuICAgICAgICBmb3IgKGxldCBidWZmT1RBcHAgb2YgdGhpcy5idWZmT3ZlclRpbWVMaXN0KSB7XG4gICAgICAgICAgICByZXMgPSBNYXRoLm1pbihyZXMsIGJ1ZmZPVEFwcC5uZXh0VXBkYXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICAvLyBwcm9jZXNzIGxhc3QgdGljayBiZWZvcmUgaXQgaXMgcmVtb3ZlZFxuICAgICAgICBmb3IgKGxldCBidWZmT1RBcHAgb2YgdGhpcy5idWZmT3ZlclRpbWVMaXN0KSB7XG4gICAgICAgICAgICBidWZmT1RBcHAudXBkYXRlKHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZW1vdmVFeHBpcmVkQnVmZnModGltZSk7XG5cbiAgICAgICAgdGhpcy5zdGF0cy5zZXQodGhpcy5iYXNlU3RhdHMpO1xuXG4gICAgICAgIGZvciAobGV0IHsgYnVmZiwgc3RhY2tzIH0gb2YgdGhpcy5idWZmTGlzdCkge1xuICAgICAgICAgICAgc3RhY2tzID0gYnVmZi5zdGF0c1N0YWNrID8gc3RhY2tzIDogMTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2tzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBidWZmLmFwcGx5KHRoaXMuc3RhdHMsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IHsgYnVmZiwgc3RhY2tzIH0gb2YgdGhpcy5idWZmT3ZlclRpbWVMaXN0KSB7XG4gICAgICAgICAgICBzdGFja3MgPSBidWZmLnN0YXRzU3RhY2sgPyBzdGFja3MgOiAxO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFja3M7IGkrKykge1xuICAgICAgICAgICAgICAgIGJ1ZmYuYXBwbHkodGhpcy5zdGF0cywgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkKGJ1ZmY6IEJ1ZmYsIGFwcGx5VGltZTogbnVtYmVyKSB7XG4gICAgICAgIGZvciAobGV0IGJ1ZmZBcHAgb2YgdGhpcy5idWZmTGlzdCkge1xuICAgICAgICAgICAgaWYgKGJ1ZmZBcHAuYnVmZiA9PT0gYnVmZikge1xuICAgICAgICAgICAgICAgIGlmIChidWZmLnN0YWNrcykgeyAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2dTdGFja0luY3JlYXNlID0gdGhpcy5wbGF5ZXIubG9nICYmICghYnVmZi5tYXhTdGFja3MgfHwgYnVmZkFwcC5zdGFja3MgPCBidWZmLm1heFN0YWNrcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGJ1ZmYuaW5pdGlhbFN0YWNrcykgeyAvLyBUT0RPIC0gY2hhbmdlIHRoaXMgdG8gY2hhcmdlcz9cbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAucmVmcmVzaChhcHBseVRpbWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5zdGFja3MrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2dTdGFja0luY3JlYXNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsYXllci5sb2chKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSByZWZyZXNoZWQgKCR7YnVmZkFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSByZWZyZXNoZWRgKTtcbiAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyhhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gZ2FpbmVkYCArIChidWZmLnN0YWNrcyA/IGAgKCR7YnVmZi5pbml0aWFsU3RhY2tzIHx8IDF9KWAgOiAnJykpO1xuXG4gICAgICAgIGlmIChidWZmIGluc3RhbmNlb2YgQnVmZk92ZXJUaW1lKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QucHVzaChuZXcgQnVmZk92ZXJUaW1lQXBwbGljYXRpb24odGhpcy5wbGF5ZXIsIGJ1ZmYsIGFwcGx5VGltZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5idWZmTGlzdC5wdXNoKG5ldyBCdWZmQXBwbGljYXRpb24odGhpcy5wbGF5ZXIsIGJ1ZmYsIGFwcGx5VGltZSkpO1xuICAgICAgICB9XG4gICAgICAgIGJ1ZmYuYWRkKGFwcGx5VGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgIH1cblxuICAgIHJlbW92ZShidWZmOiBCdWZmLCB0aW1lOiBudW1iZXIsIGZ1bGwgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZ1bGwgJiYgYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLnJlbW92ZSh0aW1lKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuYnVmZiA9PT0gYnVmZikge1xuICAgICAgICAgICAgICAgIGlmIChidWZmLnN0YWNrcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmYXBwLnN0YWNrcyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSAoJHtidWZmYXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmYXBwLnN0YWNrcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gbG9zdGApO1xuICAgICAgICAgICAgICAgIGJ1ZmZhcHAucmVtb3ZlKHRpbWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZW1vdmVFeHBpcmVkQnVmZnModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHJlbW92ZWRCdWZmczogQnVmZkFwcGxpY2F0aW9uW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuYnVmZkxpc3QgPSB0aGlzLmJ1ZmZMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuZXhwaXJhdGlvblRpbWUgPD0gdGltZSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRCdWZmcy5wdXNoKGJ1ZmZhcHApO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QgPSB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmZhcHAgb2YgcmVtb3ZlZEJ1ZmZzKSB7XG4gICAgICAgICAgICBidWZmYXBwLnJlbW92ZSh0aW1lKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmYXBwLmJ1ZmYubmFtZX0gZXhwaXJlZGApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZm9yIGNhbGN1bGF0aW5nIGJ1ZmYgdXB0aW1lXG4gICAgcmVtb3ZlQWxsQnVmZnModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHJlbW92ZWRCdWZmczogQnVmZkFwcGxpY2F0aW9uW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuYnVmZkxpc3QgPSB0aGlzLmJ1ZmZMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCA9IHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIHJlbW92ZWRCdWZmcy5wdXNoKGJ1ZmZhcHApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKGxldCBidWZmYXBwIG9mIHJlbW92ZWRCdWZmcykge1xuICAgICAgICAgICAgYnVmZmFwcC5yZW1vdmUodGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVN3aW5nVGltZXJzKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIsIGhhc3RlU2NhbGU6IG51bWJlcikge1xuICAgIGNvbnN0IGN1cnJlbnRIYXN0ZSA9IHBsYXllci5idWZmTWFuYWdlci5zdGF0cy5oYXN0ZTtcbiAgICBjb25zdCBuZXdIYXN0ZSA9IGN1cnJlbnRIYXN0ZSAqIGhhc3RlU2NhbGU7XG5cbiAgICBjb25zdCB3ZWFwb25zOiBXZWFwb25FcXVpcGVkW10gPSBbXTtcbiAgICBpZiAocGxheWVyLm1oKSB7XG4gICAgICAgIHdlYXBvbnMucHVzaChwbGF5ZXIubWgpO1xuICAgIH1cbiAgICBpZiAocGxheWVyLm9oKSB7XG4gICAgICAgIHdlYXBvbnMucHVzaChwbGF5ZXIub2gpO1xuICAgIH1cblxuICAgIGZvciAobGV0IHdlYXBvbiBvZiB3ZWFwb25zKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRTd2luZ1RpbWUgPSB3ZWFwb24ud2VhcG9uLnNwZWVkIC8gY3VycmVudEhhc3RlICogMTAwMDtcbiAgICAgICAgY29uc3QgY3VycmVudFN3aW5nVGltZVJlbWFpbmluZyA9IHdlYXBvbi5uZXh0U3dpbmdUaW1lIC0gdGltZTtcbiAgICAgICAgY29uc3QgY3VycmVudFN3aW5nUHJvZ3Jlc3NSZW1haW5pbmcgPSBjdXJyZW50U3dpbmdUaW1lUmVtYWluaW5nIC8gY3VycmVudFN3aW5nVGltZTtcbiAgICAgICAgLy8gMC4ycyBhbmQgMnMgc3dpbmcgdGltZSA9IDAuMSVcbiAgICAgICAgd2VhcG9uLm5leHRTd2luZ1RpbWUgPSB0aW1lICsgY3VycmVudFN3aW5nUHJvZ3Jlc3NSZW1haW5pbmcgKiB3ZWFwb24ud2VhcG9uLnNwZWVkIC8gbmV3SGFzdGUgKiAxMDAwO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmYge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXN8dW5kZWZpbmVkO1xuICAgIHN0YWNrczogYm9vbGVhbjtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGluaXRpYWxTdGFja3M/OiBudW1iZXI7XG4gICAgbWF4U3RhY2tzPzogbnVtYmVyO1xuICAgIHN0YXRzU3RhY2s6IGJvb2xlYW47IC8vIGRvIHlvdSBhZGQgdGhlIHN0YXQgYm9udXMgZm9yIGVhY2ggc3RhY2s/IG9yIGlzIGl0IGxpa2UgZmx1cnJ5IHdoZXJlIHRoZSBzdGFjayBpcyBvbmx5IHRvIGNvdW50IGNoYXJnZXNcblxuICAgIHByaXZhdGUgY2hpbGQ/OiBCdWZmO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0cz86IFN0YXRWYWx1ZXMsIHN0YWNrcz86IGJvb2xlYW4sIGluaXRpYWxTdGFja3M/OiBudW1iZXIsIG1heFN0YWNrcz86IG51bWJlciwgY2hpbGQ/OiBCdWZmLCBzdGF0c1N0YWNrID0gdHJ1ZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5zdGFja3MgPSAhIXN0YWNrcztcbiAgICAgICAgdGhpcy5pbml0aWFsU3RhY2tzID0gaW5pdGlhbFN0YWNrcztcbiAgICAgICAgdGhpcy5tYXhTdGFja3MgPSBtYXhTdGFja3M7XG4gICAgICAgIHRoaXMuY2hpbGQgPSBjaGlsZDtcbiAgICAgICAgdGhpcy5zdGF0c1N0YWNrID0gc3RhdHNTdGFjaztcbiAgICB9XG5cbiAgICBhcHBseShzdGF0czogU3RhdHMsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLnN0YXRzKSB7XG4gICAgICAgICAgICBzdGF0cy5hZGQodGhpcy5zdGF0cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5zdGF0cyAmJiB0aGlzLnN0YXRzLmhhc3RlKSB7XG4gICAgICAgICAgICB1cGRhdGVTd2luZ1RpbWVycyh0aW1lLCBwbGF5ZXIsIHRoaXMuc3RhdHMuaGFzdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHMgJiYgdGhpcy5zdGF0cy5oYXN0ZSkge1xuICAgICAgICAgICAgdXBkYXRlU3dpbmdUaW1lcnModGltZSwgcGxheWVyLCAxL3RoaXMuc3RhdHMuaGFzdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY2hpbGQpIHtcbiAgICAgICAgICAgIHBsYXllci5idWZmTWFuYWdlci5yZW1vdmUodGhpcy5jaGlsZCwgdGltZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIEJ1ZmZBcHBsaWNhdGlvbiB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG4gICAgYnVmZjogQnVmZjtcbiAgICBhcHBseVRpbWU6IG51bWJlcjtcbiAgICBleHBpcmF0aW9uVGltZSE6IG51bWJlcjtcbiAgICBzdGFja3NWYWwhOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihwbGF5ZXI6IFBsYXllciwgYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgICAgIHRoaXMuYXBwbHlUaW1lID0gYXBwbHlUaW1lO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLnN0YWNrcyA9IHRoaXMuYnVmZi5pbml0aWFsU3RhY2tzIHx8IDE7XG5cbiAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IHRpbWUgKyB0aGlzLmJ1ZmYuZHVyYXRpb24gKiAxMDAwO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1ZmYuZHVyYXRpb24gPiA2MCkge1xuICAgICAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlKHRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgY29uc3QgcHJldmlvdXNVcHRpbWUgPSB0aGlzLnBsYXllci5idWZmTWFuYWdlci5idWZmVXB0aW1lTWFwLmdldCh0aGlzLmJ1ZmYubmFtZSkgfHwgMDtcbiAgICAgICAgY29uc3QgY3VycmVudFVwdGltZSA9IHRpbWUgLSB0aGlzLmFwcGx5VGltZTtcbiAgICAgICAgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIuYnVmZlVwdGltZU1hcC5zZXQodGhpcy5idWZmLm5hbWUsIHByZXZpb3VzVXB0aW1lICsgY3VycmVudFVwdGltZSk7XG4gICAgfVxuXG4gICAgZ2V0IHN0YWNrcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhY2tzVmFsO1xuICAgIH1cblxuICAgIHNldCBzdGFja3Moc3RhY2tzOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3NWYWwgPSB0aGlzLmJ1ZmYubWF4U3RhY2tzID8gTWF0aC5taW4odGhpcy5idWZmLm1heFN0YWNrcywgc3RhY2tzKSA6IHN0YWNrcztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmT3ZlclRpbWUgZXh0ZW5kcyBCdWZmIHtcbiAgICB1cGRhdGVJbnRlcnZhbDogbnVtYmVyO1xuICAgIGVmZmVjdDogRWZmZWN0O1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0czogU3RhdFZhbHVlc3x1bmRlZmluZWQsIHVwZGF0ZUludGVydmFsOiBudW1iZXIsIGVmZmVjdDogRWZmZWN0KSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGR1cmF0aW9uLCBzdGF0cyk7XG4gICAgICAgIHRoaXMudXBkYXRlSW50ZXJ2YWwgPSB1cGRhdGVJbnRlcnZhbDtcblxuICAgICAgICBlZmZlY3QucGFyZW50ID0gdGhpcztcbiAgICAgICAgdGhpcy5lZmZlY3QgPSBlZmZlY3Q7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5lZmZlY3QucnVuKHBsYXllciwgdGltZSk7XG4gICAgfVxufVxuXG5jbGFzcyBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbiBleHRlbmRzIEJ1ZmZBcHBsaWNhdGlvbiB7XG4gICAgYnVmZiE6IEJ1ZmZPdmVyVGltZTtcbiAgICBuZXh0VXBkYXRlITogbnVtYmVyO1xuXG4gICAgLy8gY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJ1ZmY6IEJ1ZmZPdmVyVGltZSwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAvLyAgICAgc3VwZXIocGxheWVyLCBidWZmLCBhcHBseVRpbWUpO1xuICAgIC8vICAgICAvLyB0aGlzLmJ1ZmYgPSBidWZmOyAvLyBuZWVkZWQgdG8gZml4IHR5cGUgaW5mb3JtYXRpb25cbiAgICAvLyAgICAgLy8gdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgLy8gICAgIC8vIHRoaXMucmVmcmVzaChhcHBseVRpbWUpOyBjYWxsZWQgaW4gQnVmZkFwcGxpY2F0aW9uXG4gICAgLy8gfVxuXG4gICAgcmVmcmVzaCh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIucmVmcmVzaCh0aW1lKTtcbiAgICAgICAgdGhpcy5uZXh0VXBkYXRlID0gdGltZSArIHRoaXMuYnVmZi51cGRhdGVJbnRlcnZhbDtcbiAgICB9XG5cbiAgICB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aW1lID49IHRoaXMubmV4dFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5uZXh0VXBkYXRlICs9IHRoaXMuYnVmZi51cGRhdGVJbnRlcnZhbDtcbiAgICAgICAgICAgIHRoaXMuYnVmZi5ydW4odGhpcy5wbGF5ZXIsIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZlByb2MgZXh0ZW5kcyBCdWZmIHtcbiAgICBwcm9jOiBQcm9jO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBwcm9jOiBQcm9jLCBjaGlsZD86IEJ1ZmYpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGQpO1xuICAgICAgICB0aGlzLnByb2MgPSBwcm9jO1xuICAgIH1cblxuICAgIGFkZCh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLmFkZCh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIuYWRkUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLnJlbW92ZSh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIucmVtb3ZlUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiB1cmFuZChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbWluICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZnJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wKHZhbDogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heChtaW4sIHZhbCkpO1xufVxuXG5jb25zdCBERUJVR0dJTkcgPSBmYWxzZTtcblxuaWYgKERFQlVHR0lORykge1xuICAgIC8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL21hdGhpYXNieW5lbnMvNTY3MDkxNyNmaWxlLWRldGVybWluaXN0aWMtbWF0aC1yYW5kb20tanNcbiAgICBNYXRoLnJhbmRvbSA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlZWQgPSAweDJGNkUyQjE7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vIFJvYmVydCBKZW5raW5z4oCZIDMyIGJpdCBpbnRlZ2VyIGhhc2ggZnVuY3Rpb25cbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDdFRDU1RDE2KSArIChzZWVkIDw8IDEyKSkgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEM3NjFDMjNDKSBeIChzZWVkID4+PiAxOSkpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDE2NTY2N0IxKSArIChzZWVkIDw8IDUpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEQzQTI2NDZDKSBeIChzZWVkIDw8IDkpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEZENzA0NkM1KSArIChzZWVkIDw8IDMpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEI1NUE0RjA5KSBeIChzZWVkID4+PiAxNikpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHJldHVybiAoc2VlZCAmIDB4RkZGRkZGRikgLyAweDEwMDAwMDAwO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG59XG4iLCJpbXBvcnQgeyBQbGF5ZXIsIE1lbGVlSGl0T3V0Y29tZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFdlYXBvbkRlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgdXJhbmQgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5cbmV4cG9ydCBlbnVtIEVmZmVjdEZhbWlseSB7XG4gICAgTk9ORSxcbiAgICBXQVJSSU9SLFxufVxuXG5leHBvcnQgZW51bSBFZmZlY3RUeXBlIHtcbiAgICBOT05FLFxuICAgIEJVRkYsXG4gICAgUEhZU0lDQUwsXG4gICAgUEhZU0lDQUxfV0VBUE9OLFxuICAgIE1BR0lDLFxufVxuXG5pbnRlcmZhY2UgTmFtZWRPYmplY3Qge1xuICAgIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEVmZmVjdCB7XG4gICAgdHlwZTogRWZmZWN0VHlwZTtcbiAgICBmYW1pbHk6IEVmZmVjdEZhbWlseTtcbiAgICBwYXJlbnQ/OiBOYW1lZE9iamVjdDtcblxuICAgIGNhblByb2MgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IodHlwZTogRWZmZWN0VHlwZSwgZmFtaWx5ID0gRWZmZWN0RmFtaWx5Lk5PTkUpIHtcbiAgICAgICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICAgICAgdGhpcy5mYW1pbHkgPSBmYW1pbHk7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbCB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGlzX2djZDogYm9vbGVhbjtcbiAgICBjb3N0OiBudW1iZXI7XG4gICAgY29vbGRvd246IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgZWZmZWN0czogRWZmZWN0W107XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyLCBlZmZlY3RzOiBFZmZlY3QgfCBFZmZlY3RbXSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLmNvc3QgPSBjb3N0O1xuICAgICAgICB0aGlzLmNvb2xkb3duID0gY29vbGRvd247XG4gICAgICAgIHRoaXMuaXNfZ2NkID0gaXNfZ2NkO1xuICAgICAgICB0aGlzLmVmZmVjdHMgPSBBcnJheS5pc0FycmF5KGVmZmVjdHMpID8gZWZmZWN0cyA6IFtlZmZlY3RzXTtcblxuICAgICAgICBmb3IgKGxldCBlZmZlY3Qgb2YgdGhpcy5lZmZlY3RzKSB7XG4gICAgICAgICAgICBlZmZlY3QucGFyZW50ID0gdGhpczsgLy8gY3VycmVudGx5IG9ubHkgdXNlZCBmb3IgbG9nZ2luZy4gZG9uJ3QgcmVhbGx5IHdhbnQgdG8gZG8gdGhpc1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY2FzdChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGZvciAobGV0IGVmZmVjdCBvZiB0aGlzLmVmZmVjdHMpIHtcbiAgICAgICAgICAgIGVmZmVjdC5ydW4ocGxheWVyLCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFNwZWxsO1xuICAgIGNvb2xkb3duID0gMDtcbiAgICBjYXN0ZXI6IFBsYXllcjtcblxuICAgIGNvbnN0cnVjdG9yKHNwZWxsOiBTcGVsbCwgY2FzdGVyOiBQbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zcGVsbCA9IHNwZWxsO1xuICAgICAgICB0aGlzLmNhc3RlciA9IGNhc3RlcjtcbiAgICB9XG5cbiAgICBvbkNvb2xkb3duKHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5jb29sZG93biA+IHRpbWU7XG4gICAgfVxuXG4gICAgdGltZVJlbWFpbmluZyh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsICh0aGlzLmNvb2xkb3duIC0gdGltZSkgLyAxMDAwKTtcbiAgICB9XG5cbiAgICBjYW5DYXN0KHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAodGhpcy5zcGVsbC5pc19nY2QgJiYgdGhpcy5jYXN0ZXIubmV4dEdDRFRpbWUgPiB0aW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zcGVsbC5jb3N0ID4gdGhpcy5jYXN0ZXIucG93ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9uQ29vbGRvd24odGltZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNhc3QodGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdGhpcy5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zcGVsbC5pc19nY2QpIHtcbiAgICAgICAgICAgIHRoaXMuY2FzdGVyLm5leHRHQ0RUaW1lID0gdGltZSArIDE1MDAgKyB0aGlzLmNhc3Rlci5sYXRlbmN5OyAvLyBUT0RPIC0gbmVlZCB0byBzdHVkeSB0aGUgZWZmZWN0cyBvZiBsYXRlbmN5IGluIHRoZSBnYW1lIGFuZCBjb25zaWRlciBodW1hbiBwcmVjaXNpb25cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5jYXN0ZXIucG93ZXIgLT0gdGhpcy5zcGVsbC5jb3N0O1xuXG4gICAgICAgIHRoaXMuc3BlbGwuY2FzdCh0aGlzLmNhc3RlciwgdGltZSk7XG5cbiAgICAgICAgdGhpcy5jb29sZG93biA9IHRpbWUgKyB0aGlzLnNwZWxsLmNvb2xkb3duICogMTAwMCArIHRoaXMuY2FzdGVyLmxhdGVuY3k7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTW9kaWZ5UG93ZXJFZmZlY3QgZXh0ZW5kcyBFZmZlY3Qge1xuICAgIGJhc2U6IG51bWJlcjtcbiAgICByYW5kb21BbW91bnQ6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGJhc2U6IG51bWJlciwgcmFuZG9tQW1vdW50PzogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKEVmZmVjdFR5cGUuTk9ORSk7XG4gICAgICAgIHRoaXMuYmFzZSA9IGJhc2U7XG4gICAgICAgIHRoaXMucmFuZG9tQW1vdW50ID0gcmFuZG9tQW1vdW50IHx8IDA7XG4gICAgfVxuICAgIFxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGFtb3VudCA9IHRoaXMuYmFzZSArIE1hdGgucm91bmQodGhpcy5yYW5kb21BbW91bnQgKiBNYXRoLnJhbmRvbSgpKTtcbiAgICAgICAgcGxheWVyLnBvd2VyICs9IGFtb3VudDtcbiAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluICR7YW1vdW50fSByYWdlIGZyb20gJHt0aGlzLnBhcmVudCEubmFtZX1gKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2luZ0VmZmVjdCBleHRlbmRzIEVmZmVjdCB7XG4gICAgYm9udXNEYW1hZ2U6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGJvbnVzRGFtYWdlOiBudW1iZXIsIGZhbWlseT86IEVmZmVjdEZhbWlseSkge1xuICAgICAgICBzdXBlcihFZmZlY3RUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgZmFtaWx5KTtcbiAgICAgICAgdGhpcy5ib251c0RhbWFnZSA9IGJvbnVzRGFtYWdlO1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGlzX21oID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgcmF3RGFtYWdlID0gcGxheWVyLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oKTtcbiAgICAgICAgcGxheWVyLmRlYWxNZWxlZURhbWFnZSh0aW1lLCByYXdEYW1hZ2UgKyB0aGlzLmJvbnVzRGFtYWdlLCBwbGF5ZXIudGFyZ2V0ISwgaXNfbWgsIHRoaXMpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aW5nU3BlbGwgZXh0ZW5kcyBTcGVsbCB7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGZhbWlseTogRWZmZWN0RmFtaWx5LCBib251c0RhbWFnZTogbnVtYmVyLCBjb3N0OiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZmFsc2UsIGNvc3QsIDAsIG5ldyBTd2luZ0VmZmVjdChib251c0RhbWFnZSwgZmFtaWx5KSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGVhcm5lZFN3aW5nU3BlbGwgZXh0ZW5kcyBMZWFybmVkU3BlbGwge1xuICAgIHNwZWxsOiBTd2luZ1NwZWxsO1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKHNwZWxsOiBTd2luZ1NwZWxsLCBjYXN0ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlcihzcGVsbCwgY2FzdGVyKTtcbiAgICAgICAgdGhpcy5zcGVsbCA9IHNwZWxsOyAvLyBUT0RPIC0gaXMgdGhlcmUgYSB3YXkgdG8gYXZvaWQgdGhpcyBsaW5lP1xuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2sgPSAocGxheWVyOiBQbGF5ZXIsIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgdGltZTogbnVtYmVyKSA9PiB2b2lkO1xuXG50eXBlIFNwZWxsRGFtYWdlQW1vdW50ID0gbnVtYmVyfFtudW1iZXIsIG51bWJlcl18KChwbGF5ZXI6IFBsYXllcikgPT4gbnVtYmVyKTtcblxuZXhwb3J0IGNsYXNzIFNwZWxsRGFtYWdlRWZmZWN0IGV4dGVuZHMgRWZmZWN0IHtcbiAgICBjYWxsYmFjaz86IFNwZWxsSGl0T3V0Y29tZUNhbGxiYWNrO1xuICAgIGFtb3VudDogU3BlbGxEYW1hZ2VBbW91bnQ7XG5cbiAgICBjb25zdHJ1Y3Rvcih0eXBlOiBFZmZlY3RUeXBlLCBmYW1pbHk6IEVmZmVjdEZhbWlseSwgYW1vdW50OiBTcGVsbERhbWFnZUFtb3VudCwgY2FsbGJhY2s/OiBTcGVsbEhpdE91dGNvbWVDYWxsYmFjaykge1xuICAgICAgICBzdXBlcih0eXBlLCBmYW1pbHkpO1xuICAgICAgICB0aGlzLmFtb3VudCA9IGFtb3VudDtcbiAgICAgICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIH1cblxuICAgIHByaXZhdGUgY2FsY3VsYXRlQW1vdW50KHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5hbW91bnQgaW5zdGFuY2VvZiBGdW5jdGlvbikgPyB0aGlzLmFtb3VudChwbGF5ZXIpIDogKEFycmF5LmlzQXJyYXkodGhpcy5hbW91bnQpID8gdXJhbmQoLi4udGhpcy5hbW91bnQpIDp0aGlzLmFtb3VudClcbiAgICB9XG5cbiAgICBydW4ocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgeyAgICAgICAgICAgIFxuICAgICAgICBpZiAodGhpcy50eXBlID09PSBFZmZlY3RUeXBlLlBIWVNJQ0FMIHx8IHRoaXMudHlwZSA9PT0gRWZmZWN0VHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgIHBsYXllci5kZWFsTWVsZWVEYW1hZ2UodGltZSwgdGhpcy5jYWxjdWxhdGVBbW91bnQocGxheWVyKSwgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMudHlwZSA9PT0gRWZmZWN0VHlwZS5NQUdJQykge1xuICAgICAgICAgICAgcGxheWVyLmRlYWxTcGVsbERhbWFnZSh0aW1lLCB0aGlzLmNhbGN1bGF0ZUFtb3VudChwbGF5ZXIpLCBwbGF5ZXIudGFyZ2V0ISwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsIHtcbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogU3BlbGxEYW1hZ2VBbW91bnQsIHR5cGU6IEVmZmVjdFR5cGUsIGZhbWlseSA9IEVmZmVjdEZhbWlseS5OT05FLCBpc19nY2QgPSBmYWxzZSwgY29zdCA9IDAsIGNvb2xkb3duID0gMCwgY2FsbGJhY2s/OiBTcGVsbEhpdE91dGNvbWVDYWxsYmFjaykge1xuICAgICAgICBzdXBlcihuYW1lLCBpc19nY2QsIGNvc3QsIGNvb2xkb3duLCBuZXcgU3BlbGxEYW1hZ2VFZmZlY3QodHlwZSwgZmFtaWx5LCBhbW91bnQsIGNhbGxiYWNrKSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgSXRlbVNwZWxsRGFtYWdlIGV4dGVuZHMgU3BlbGxEYW1hZ2Uge1xuICAgIGNhblByb2MgPSBmYWxzZTsgLy8gVE9ETyAtIGNvbmZpcm0gdGhpcyBpcyBibGl6emxpa2UsIGFsc28gc29tZSBpdGVtIHByb2NzIG1heSBiZSBhYmxlIHRvIHByb2MgYnV0IG9uIExIIGNvcmUsIGZhdGFsIHdvdW5kIGNhbid0XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogU3BlbGxEYW1hZ2VBbW91bnQsIHR5cGU6IEVmZmVjdFR5cGUpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgYW1vdW50LCB0eXBlLCBFZmZlY3RGYW1pbHkuTk9ORSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXh0cmFBdHRhY2tFZmZlY3QgZXh0ZW5kcyBFZmZlY3Qge1xuICAgIGNvdW50OiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcihjb3VudDogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKEVmZmVjdFR5cGUuTk9ORSk7XG4gICAgICAgIHRoaXMuY291bnQgPSBjb3VudDtcbiAgICB9XG5cbiAgICBydW4ocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAocGxheWVyLmV4dHJhQXR0YWNrQ291bnQpIHtcbiAgICAgICAgICAgIC8vIGNhbid0IHByb2MgZXh0cmEgYXR0YWNrIGR1cmluZyBhbiBleHRyYSBhdHRhY2tcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG5leHRCYXRjaCA9IHRpbWU7Ly8gKyA0MDAgKyBNYXRoLnJhbmRvbSgpICogNDAwO1xuICAgICAgICBwbGF5ZXIuZnV0dXJlRXZlbnRzLnB1c2goe1xuICAgICAgICAgICAgdGltZTogbmV4dEJhdGNoLFxuICAgICAgICAgICAgY2FsbGJhY2s6IChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgICAgICAgICAgICAgIHBsYXllci5leHRyYUF0dGFja0NvdW50ICs9IHRoaXMuY291bnQ7IC8vIExIIGNvZGUgZG9lcyBub3QgYWxsb3cgbXVsdGlwbGUgYXV0byBhdHRhY2tzIHRvIHN0YWNrIGlmIHRoZXkgcHJvYyB0b2dldGhlci4gQmxpenpsaWtlIG1heSBhbGxvdyB0aGVtIHRvIHN0YWNrIFxuICAgICAgICAgICAgICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKG5leHRCYXRjaCwgYEdhaW5lZCAke3RoaXMuY291bnR9IGV4dHJhIGF0dGFja3MgZnJvbSAke3RoaXMucGFyZW50IS5uYW1lfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRyYUF0dGFjayBleHRlbmRzIFNwZWxsIHtcbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGNvdW50OiBudW1iZXIpIHtcbiAgICAgICAgLy8gc3BlbGx0eXBlIGRvZXNuJ3QgbWF0dGVyXG4gICAgICAgIHN1cGVyKG5hbWUsIGZhbHNlLCAwLCAwLCBuZXcgRXh0cmFBdHRhY2tFZmZlY3QoY291bnQpKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbEJ1ZmZFZmZlY3QgZXh0ZW5kcyBFZmZlY3Qge1xuICAgIGJ1ZmY6IEJ1ZmY7XG5cbiAgICBjb25zdHJ1Y3RvcihidWZmOiBCdWZmKSB7XG4gICAgICAgIHN1cGVyKEVmZmVjdFR5cGUuQlVGRik7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZCh0aGlzLmJ1ZmYsIHRpbWUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNwZWxsQnVmZiBleHRlbmRzIFNwZWxsIHtcbiAgICBidWZmOiBCdWZmO1xuXG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgaXNfZ2NkID0gZmFsc2UsIGNvc3QgPSAwLCBjb29sZG93biA9IDApIHtcbiAgICAgICAgc3VwZXIoYFNwZWxsQnVmZigke2J1ZmYubmFtZX0pYCwgaXNfZ2NkLCBjb3N0LCBjb29sZG93biwgbmV3IFNwZWxsQnVmZkVmZmVjdChidWZmKSk7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgfVxufVxuXG50eXBlIHBwbSA9IHtwcG06IG51bWJlcn07XG50eXBlIGNoYW5jZSA9IHtjaGFuY2U6IG51bWJlcn07XG50eXBlIHJhdGUgPSBwcG0gfCBjaGFuY2U7XG5cbmV4cG9ydCBjbGFzcyBQcm9jIHtcbiAgICBwcm90ZWN0ZWQgc3BlbGxzOiBTcGVsbFtdO1xuICAgIHByb3RlY3RlZCByYXRlOiByYXRlO1xuICAgIHByb3RlY3RlZCByZXF1aXJlc1N3aW5nOiBib29sZWFuO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsIHwgU3BlbGxbXSwgcmF0ZTogcmF0ZSwgcmVxdWlyZXNTd2luZyA9IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuc3BlbGxzID0gQXJyYXkuaXNBcnJheShzcGVsbCkgPyBzcGVsbCA6IFtzcGVsbF07XG4gICAgICAgIHRoaXMucmF0ZSA9IHJhdGU7XG4gICAgICAgIHRoaXMucmVxdWlyZXNTd2luZyA9IHJlcXVpcmVzU3dpbmc7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uLCB0aW1lOiBudW1iZXIsIHRyaWdnZXJpbmdFZmZlY3Q/OiBFZmZlY3QpIHtcbiAgICAgICAgaWYgKHRoaXMucmVxdWlyZXNTd2luZyAmJiB0cmlnZ2VyaW5nRWZmZWN0ICYmICEodHJpZ2dlcmluZ0VmZmVjdCBpbnN0YW5jZW9mIFN3aW5nRWZmZWN0KSkge1xuICAgICAgICAgICAgcmV0dXJuOyAvLyBpZiB0aGVyZSBpcyBubyBlZmZlY3QsIGl0IGlzIHRyaWdnZXJlZCBieSBhIG5vcm1hbCBzd2luZ1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2hhbmNlID0gKDxjaGFuY2U+dGhpcy5yYXRlKS5jaGFuY2UgfHwgKDxwcG0+dGhpcy5yYXRlKS5wcG0gKiB3ZWFwb24uc3BlZWQgLyA2MDtcblxuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8PSBjaGFuY2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IHNwZWxsIG9mIHRoaXMuc3BlbGxzKSB7XG4gICAgICAgICAgICAgICAgc3BlbGwuY2FzdChwbGF5ZXIsIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBQcm9jLCBTcGVsbCwgTGVhcm5lZFNwZWxsIH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IEVuY2hhbnREZXNjcmlwdGlvbiB9IGZyb20gXCIuL2RhdGEvZW5jaGFudHMuanNcIjtcblxuZXhwb3J0IGVudW0gSXRlbVNsb3Qge1xuICAgIE1BSU5IQU5EID0gMSA8PCAwLFxuICAgIE9GRkhBTkQgPSAxIDw8IDEsXG4gICAgVFJJTktFVDEgPSAxIDw8IDIsXG4gICAgVFJJTktFVDIgPSAxIDw8IDMsXG4gICAgSEVBRCA9IDEgPDwgNCxcbiAgICBORUNLID0gMSA8PCA1LFxuICAgIFNIT1VMREVSID0gMSA8PCA2LFxuICAgIEJBQ0sgPSAxIDw8IDcsXG4gICAgQ0hFU1QgPSAxIDw8IDgsXG4gICAgV1JJU1QgPSAxIDw8IDksXG4gICAgSEFORFMgPSAxIDw8IDEwLFxuICAgIFdBSVNUID0gMSA8PCAxMSxcbiAgICBMRUdTID0gMSA8PCAxMixcbiAgICBGRUVUID0gMSA8PCAxMyxcbiAgICBSSU5HMSA9IDEgPDwgMTQsXG4gICAgUklORzIgPSAxIDw8IDE1LFxuICAgIFJBTkdFRCA9IDEgPDwgMTYsXG59XG5cbmV4cG9ydCBjb25zdCBpdGVtU2xvdEhhc0VuY2hhbnQ6IHtbVEtleSBpbiBJdGVtU2xvdF06IGJvb2xlYW59ID0ge1xuICAgIFtJdGVtU2xvdC5NQUlOSEFORF06IHRydWUsXG4gICAgW0l0ZW1TbG90Lk9GRkhBTkRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5IRUFEXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuTkVDS106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5TSE9VTERFUl06IHRydWUsXG4gICAgW0l0ZW1TbG90LkJBQ0tdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5DSEVTVF06IHRydWUsXG4gICAgW0l0ZW1TbG90LldSSVNUXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuSEFORFNdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5XQUlTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5MRUdTXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuRkVFVF06IHRydWUsXG4gICAgW0l0ZW1TbG90LlJJTkcxXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LlJJTkcyXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LlJBTkdFRF06IGZhbHNlLFxufTtcblxuZXhwb3J0IGNvbnN0IGl0ZW1TbG90SGFzVGVtcG9yYXJ5RW5jaGFudDoge1tUS2V5IGluIEl0ZW1TbG90XTogYm9vbGVhbn0gPSB7XG4gICAgW0l0ZW1TbG90Lk1BSU5IQU5EXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuT0ZGSEFORF06IHRydWUsXG4gICAgW0l0ZW1TbG90LlRSSU5LRVQxXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LlRSSU5LRVQyXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkhFQURdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuTkVDS106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5TSE9VTERFUl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5CQUNLXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkNIRVNUXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LldSSVNUXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkhBTkRTXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LldBSVNUXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkxFR1NdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuRkVFVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SSU5HMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SSU5HMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SQU5HRURdOiBmYWxzZSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSXRlbURlc2NyaXB0aW9uIHtcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2xvdDogSXRlbVNsb3QsXG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxuICAgIG9udXNlPzogU3BlbGwsXG4gICAgb25lcXVpcD86IFByb2MsXG59XG5cbmV4cG9ydCBlbnVtIFdlYXBvblR5cGUge1xuICAgIE1BQ0UsXG4gICAgU1dPUkQsXG4gICAgQVhFLFxuICAgIERBR0dFUixcbiAgICBNQUNFMkgsXG4gICAgU1dPUkQySCxcbiAgICBBWEUySCxcbn1cblxuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZWRXZWFwb25TcGVlZDoge1tUS2V5IGluIFdlYXBvblR5cGVdOiBudW1iZXJ9ID0ge1xuICAgIFtXZWFwb25UeXBlLk1BQ0VdOiAyLjQsXG4gICAgW1dlYXBvblR5cGUuU1dPUkRdOiAyLjQsXG4gICAgW1dlYXBvblR5cGUuQVhFXTogMi40LFxuICAgIFtXZWFwb25UeXBlLkRBR0dFUl06IDEuNyxcbiAgICBbV2VhcG9uVHlwZS5NQUNFMkhdOiAzLjMsXG4gICAgW1dlYXBvblR5cGUuU1dPUkQySF06IDMuMyxcbiAgICBbV2VhcG9uVHlwZS5BWEUySF06IDMuMyxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXZWFwb25EZXNjcmlwdGlvbiBleHRlbmRzIEl0ZW1EZXNjcmlwdGlvbiB7XG4gICAgdHlwZTogV2VhcG9uVHlwZSxcbiAgICBtaW46IG51bWJlcixcbiAgICBtYXg6IG51bWJlcixcbiAgICBzcGVlZDogbnVtYmVyLFxuICAgIG9uaGl0PzogUHJvYyxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzV2VhcG9uKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbik6IGl0ZW0gaXMgV2VhcG9uRGVzY3JpcHRpb24ge1xuICAgIHJldHVybiBcInNwZWVkXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXF1aXBlZFdlYXBvbihpdGVtOiBJdGVtRXF1aXBlZCk6IGl0ZW0gaXMgV2VhcG9uRXF1aXBlZCB7XG4gICAgcmV0dXJuIFwid2VhcG9uXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGNsYXNzIEl0ZW1FcXVpcGVkIHtcbiAgICBpdGVtOiBJdGVtRGVzY3JpcHRpb247XG4gICAgb251c2U/OiBMZWFybmVkU3BlbGw7XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBJdGVtRGVzY3JpcHRpb24sIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuaXRlbSA9IGl0ZW07XG5cbiAgICAgICAgaWYgKGl0ZW0ub251c2UpIHtcbiAgICAgICAgICAgIHRoaXMub251c2UgPSBuZXcgTGVhcm5lZFNwZWxsKGl0ZW0ub251c2UsIHBsYXllcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5vbmVxdWlwKSB7IC8vIFRPRE8sIG1vdmUgdGhpcyB0byBidWZmcHJvYz8gdGhpcyBtYXkgYmUgc2ltcGxlciB0aG91Z2ggc2luY2Ugd2Uga25vdyB0aGUgYnVmZiB3b24ndCBiZSByZW1vdmVkXG4gICAgICAgICAgICBwbGF5ZXIuYWRkUHJvYyhpdGVtLm9uZXF1aXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXNlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy5vbnVzZSkge1xuICAgICAgICAgICAgdGhpcy5vbnVzZS5jYXN0KHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2VhcG9uRXF1aXBlZCBleHRlbmRzIEl0ZW1FcXVpcGVkIHtcbiAgICB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uO1xuICAgIG5leHRTd2luZ1RpbWU6IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgcHJvY3M6IFByb2NbXSA9IFtdO1xuICAgIHByb3RlY3RlZCBwbGF5ZXI6IFBsYXllcjtcbiAgICBwdWJsaWMgdGVtcG9yYXJ5RW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbjtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IFdlYXBvbkRlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllciwgZW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbiwgdGVtcG9yYXJ5RW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbikge1xuICAgICAgICBzdXBlcihpdGVtLCBwbGF5ZXIpO1xuICAgICAgICB0aGlzLndlYXBvbiA9IGl0ZW07XG4gICAgICAgIFxuICAgICAgICBpZiAoaXRlbS5vbmhpdCkge1xuICAgICAgICAgICAgdGhpcy5hZGRQcm9jKGl0ZW0ub25oaXQpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW5jaGFudCAmJiBlbmNoYW50LnByb2MpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkUHJvYyhlbmNoYW50LnByb2MpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMudGVtcG9yYXJ5RW5jaGFudCA9IHRlbXBvcmFyeUVuY2hhbnQ7XG5cbiAgICAgICAgdGhpcy5uZXh0U3dpbmdUaW1lID0gMTAwOyAvLyBUT0RPIC0gbmVlZCB0byByZXNldCB0aGlzIHByb3Blcmx5IGlmIGV2ZXIgd2FudCB0byBzaW11bGF0ZSBmaWdodHMgd2hlcmUgeW91IHJ1biBvdXRcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldCBwbHVzRGFtYWdlKCkge1xuICAgICAgICBpZiAodGhpcy50ZW1wb3JhcnlFbmNoYW50ICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cyAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMucGx1c0RhbWFnZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5wbHVzRGFtYWdlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaW4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5taW4gKyB0aGlzLnBsdXNEYW1hZ2U7XG4gICAgfVxuXG4gICAgZ2V0IG1heCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2VhcG9uLm1heCArIHRoaXMucGx1c0RhbWFnZTtcbiAgICB9XG5cbiAgICBhZGRQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgdGhpcy5wcm9jcy5wdXNoKHApO1xuICAgIH1cblxuICAgIHByb2ModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGZvciAobGV0IHByb2Mgb2YgdGhpcy5wcm9jcykge1xuICAgICAgICAgICAgcHJvYy5ydW4odGhpcy5wbGF5ZXIsIHRoaXMud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdpbmRmdXJ5IHByb2NzIGxhc3RcbiAgICAgICAgaWYgKHRoaXMudGVtcG9yYXJ5RW5jaGFudCAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQucHJvYykge1xuICAgICAgICAgICAgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnByb2MucnVuKHRoaXMucGxheWVyLCB0aGlzLndlYXBvbiwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgVW5pdCB7XG4gICAgbGV2ZWw6IG51bWJlcjtcbiAgICBhcm1vcjogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IobGV2ZWw6IG51bWJlciwgYXJtb3I6IG51bWJlcikge1xuICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgIHRoaXMuYXJtb3IgPSBhcm1vcjtcbiAgICB9XG5cbiAgICBnZXQgbWF4U2tpbGxGb3JMZXZlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiA1O1xuICAgIH1cblxuICAgIGdldCBkZWZlbnNlU2tpbGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgfVxuXG4gICAgZ2V0IGRvZGdlQ2hhbmNlKCkge1xuICAgICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVBcm1vclJlZHVjZWREYW1hZ2UoZGFtYWdlOiBudW1iZXIsIGF0dGFja2VyOiBQbGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYXJtb3IgPSBNYXRoLm1heCgwLCB0aGlzLmFybW9yIC0gYXR0YWNrZXIuYnVmZk1hbmFnZXIuc3RhdHMuYXJtb3JQZW5ldHJhdGlvbik7XG4gICAgICAgIFxuICAgICAgICBsZXQgdG1wdmFsdWUgPSBhcm1vciAvICgoODUgKiBhdHRhY2tlci5sZXZlbCkgKyA0MDApO1xuICAgICAgICB0bXB2YWx1ZSAvPSAoMSArIHRtcHZhbHVlKTtcblxuICAgICAgICBjb25zdCBhcm1vck1vZGlmaWVyID0gY2xhbXAodG1wdmFsdWUsIDAsIDAuNzUpO1xuXG4gICAgICAgIHJldHVybiBNYXRoLm1heCgxLCBkYW1hZ2UgLSAoZGFtYWdlICogYXJtb3JNb2RpZmllcikpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFdlYXBvbkVxdWlwZWQsIFdlYXBvblR5cGUsIEl0ZW1EZXNjcmlwdGlvbiwgSXRlbUVxdWlwZWQsIEl0ZW1TbG90LCBpc0VxdWlwZWRXZWFwb24sIGlzV2VhcG9uLCBub3JtYWxpemVkV2VhcG9uU3BlZWQgfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgdXJhbmQsIGNsYW1wLCBmcmFuZCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IEJ1ZmZNYW5hZ2VyIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgUHJvYywgTGVhcm5lZFN3aW5nU3BlbGwsIEVmZmVjdFR5cGUsIFNwZWxsRGFtYWdlRWZmZWN0LCBFZmZlY3QgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgTEhfQ09SRV9CVUcgfSBmcm9tIFwiLi9zaW1fc2V0dGluZ3MuanNcIjtcbmltcG9ydCB7IEVuY2hhbnREZXNjcmlwdGlvbiB9IGZyb20gXCIuL2RhdGEvZW5jaGFudHMuanNcIjtcblxuZXhwb3J0IGVudW0gUmFjZSB7XG4gICAgSFVNQU4sXG4gICAgT1JDLFxuICAgIEdOT01FLFxuICAgIFRST0xMLFxufVxuXG5leHBvcnQgZW51bSBGYWN0aW9uIHtcbiAgICBBTExJQU5DRSxcbiAgICBIT1JERSxcbn1cblxudHlwZSBmYWN0aW9uT2ZSYWNlTWFwID0ge1tUS2V5IGluIFJhY2VdOiBGYWN0aW9ufTtcblxuZXhwb3J0IGNvbnN0IEZBQ1RJT05fT0ZfUkFDRTogZmFjdGlvbk9mUmFjZU1hcCA9IHtcbiAgICBbUmFjZS5IVU1BTl06IEZhY3Rpb24uQUxMSUFOQ0UsXG4gICAgW1JhY2UuR05PTUVdOiBGYWN0aW9uLkFMTElBTkNFLFxuICAgIFtSYWNlLk9SQ106IEZhY3Rpb24uSE9SREUsXG4gICAgW1JhY2UuVFJPTExdOiBGYWN0aW9uLkhPUkRFLFxufTtcblxuZXhwb3J0IGVudW0gTWVsZWVIaXRPdXRjb21lIHtcbiAgICBNRUxFRV9ISVRfRVZBREUsXG4gICAgTUVMRUVfSElUX01JU1MsXG4gICAgTUVMRUVfSElUX0RPREdFLFxuICAgIE1FTEVFX0hJVF9CTE9DSyxcbiAgICBNRUxFRV9ISVRfUEFSUlksXG4gICAgTUVMRUVfSElUX0dMQU5DSU5HLFxuICAgIE1FTEVFX0hJVF9DUklULFxuICAgIE1FTEVFX0hJVF9DUlVTSElORyxcbiAgICBNRUxFRV9ISVRfTk9STUFMLFxuICAgIE1FTEVFX0hJVF9CTE9DS19DUklULFxufVxuXG50eXBlIEhpdE91dENvbWVTdHJpbmdNYXAgPSB7W1RLZXkgaW4gTWVsZWVIaXRPdXRjb21lXTogc3RyaW5nfTtcblxuZXhwb3J0IGNvbnN0IGhpdE91dGNvbWVTdHJpbmc6IEhpdE91dENvbWVTdHJpbmdNYXAgPSB7XG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRVZBREVdOiAnZXZhZGUnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1NdOiAnbWlzc2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRV06ICdpcyBkb2RnZWQnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0JMT0NLXTogJ2lzIGJsb2NrZWQnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZXTogJ2lzIHBhcnJpZWQnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HXTogJ2dsYW5jZXMnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVRdOiAnY3JpdHMnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSVVNISU5HXTogJ2NydXNoZXMnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX05PUk1BTF06ICdoaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS19DUklUXTogJ2lzIGJsb2NrIGNyaXQnLFxufTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCB0eXBlIERhbWFnZUxvZyA9IFtudW1iZXIsIG51bWJlcl1bXTtcblxuZXhwb3J0IHR5cGUgSGl0T3V0Y29tZVN0YXRzID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IG51bWJlcn07XG5cbmV4cG9ydCBjbGFzcyBQbGF5ZXIgZXh0ZW5kcyBVbml0IHtcbiAgICBpdGVtczogTWFwPEl0ZW1TbG90LCBJdGVtRXF1aXBlZD4gPSBuZXcgTWFwKCk7XG4gICAgcHJvY3M6IFByb2NbXSA9IFtdO1xuXG4gICAgdGFyZ2V0OiBVbml0IHwgdW5kZWZpbmVkO1xuXG4gICAgbmV4dEdDRFRpbWUgPSAwO1xuICAgIGV4dHJhQXR0YWNrQ291bnQgPSAwO1xuICAgIGRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG5cbiAgICBidWZmTWFuYWdlcjogQnVmZk1hbmFnZXI7XG5cbiAgICBkYW1hZ2VMb2c6IERhbWFnZUxvZyA9IFtdO1xuXG4gICAgcXVldWVkU3BlbGw6IExlYXJuZWRTd2luZ1NwZWxsfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAgIGxvZz86IExvZ0Z1bmN0aW9uO1xuXG4gICAgbGF0ZW5jeSA9IDUwOyAvLyBtc1xuXG4gICAgcG93ZXJMb3N0ID0gMDtcblxuICAgIGZ1dHVyZUV2ZW50czoge3RpbWU6IG51bWJlciwgY2FsbGJhY2s6IChwbGF5ZXI6IFBsYXllcikgPT4gdm9pZH1bXSA9IFtdO1xuXG4gICAgaGl0U3RhdHM6IE1hcDxzdHJpbmcsIEhpdE91dGNvbWVTdGF0cz4gPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0czogU3RhdFZhbHVlcywgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgc3VwZXIoNjAsIDApOyAvLyBsdmwsIGFybW9yXG5cbiAgICAgICAgdGhpcy5idWZmTWFuYWdlciA9IG5ldyBCdWZmTWFuYWdlcih0aGlzLCBuZXcgU3RhdHMoc3RhdHMpKTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IG1oKCk6IFdlYXBvbkVxdWlwZWR8dW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3QgZXF1aXBlZCA9IHRoaXMuaXRlbXMuZ2V0KEl0ZW1TbG90Lk1BSU5IQU5EKTtcblxuICAgICAgICBpZiAoZXF1aXBlZCAmJiBpc0VxdWlwZWRXZWFwb24oZXF1aXBlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcXVpcGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9oKCk6IFdlYXBvbkVxdWlwZWR8dW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3QgZXF1aXBlZCA9IHRoaXMuaXRlbXMuZ2V0KEl0ZW1TbG90Lk9GRkhBTkQpO1xuXG4gICAgICAgIGlmIChlcXVpcGVkICYmIGlzRXF1aXBlZFdlYXBvbihlcXVpcGVkKSkge1xuICAgICAgICAgICAgcmV0dXJuIGVxdWlwZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBlcXVpcChzbG90OiBJdGVtU2xvdCwgaXRlbTogSXRlbURlc2NyaXB0aW9uLCBlbmNoYW50PzogRW5jaGFudERlc2NyaXB0aW9uLCB0ZW1wb3JhcnlFbmNoYW50PzogRW5jaGFudERlc2NyaXB0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLml0ZW1zLmhhcyhzbG90KSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgYWxyZWFkeSBoYXZlIGl0ZW0gaW4gc2xvdCAke0l0ZW1TbG90W3Nsb3RdfWApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIShpdGVtLnNsb3QgJiBzbG90KSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgY2Fubm90IGVxdWlwICR7aXRlbS5uYW1lfSBpbiBzbG90ICR7SXRlbVNsb3Rbc2xvdF19YClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnN0YXRzKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmJhc2VTdGF0cy5hZGQoaXRlbS5zdGF0cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW5jaGFudCAmJiBlbmNoYW50LnN0YXRzKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmJhc2VTdGF0cy5hZGQoZW5jaGFudC5zdGF0cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUT0RPIC0gaGFuZGxlIGVxdWlwcGluZyAySCAoYW5kIGhvdyB0aGF0IGRpc2FibGVzIE9IKVxuICAgICAgICAvLyBUT0RPIC0gYXNzdW1pbmcgb25seSB3ZWFwb24gZW5jaGFudHMgY2FuIGhhdmUgcHJvY3NcbiAgICAgICAgaWYgKGlzV2VhcG9uKGl0ZW0pKSB7XG4gICAgICAgICAgICB0aGlzLml0ZW1zLnNldChzbG90LCBuZXcgV2VhcG9uRXF1aXBlZChpdGVtLCB0aGlzLCBlbmNoYW50LCB0ZW1wb3JhcnlFbmNoYW50KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLml0ZW1zLnNldChzbG90LCBuZXcgSXRlbUVxdWlwZWQoaXRlbSwgdGhpcykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHBvd2VyKCk6IG51bWJlciB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHNldCBwb3dlcihwb3dlcjogbnVtYmVyKSB7fVxuXG4gICAgYWRkUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIHRoaXMucHJvY3MucHVzaChwKTtcbiAgICB9XG5cbiAgICByZW1vdmVQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgLy8gVE9ETyAtIGVpdGhlciBwcm9jcyBzaG91bGQgYmUgYSBzZXQgb3Igd2UgbmVlZCBQcm9jQXBwbGljYXRpb25cbiAgICAgICAgdGhpcy5wcm9jcyA9IHRoaXMucHJvY3MuZmlsdGVyKChwcm9jOiBQcm9jKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gcHJvYyAhPT0gcDtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWg6IGJvb2xlYW4sIGVmZmVjdD86IEVmZmVjdCkge1xuICAgICAgICBpZiAoZWZmZWN0ICYmIGVmZmVjdC50eXBlICE9PSBFZmZlY3RUeXBlLlBIWVNJQ0FMX1dFQVBPTikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdlYXBvbiA9IGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oITtcbiAgICAgICAgY29uc3Qgd2VhcG9uVHlwZSA9IHdlYXBvbi53ZWFwb24udHlwZTtcblxuICAgICAgICAvLyBUT0RPLCBtYWtlIHRoaXMgYSBtYXBcbiAgICAgICAgc3dpdGNoICh3ZWFwb25UeXBlKSB7XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuTUFDRTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5tYWNlU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuU1dPUkQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3dvcmRTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5BWEU6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXhlU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuREFHR0VSOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhZ2dlclNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLk1BQ0UySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5tYWNlMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5TV09SRDJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN3b3JkMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5BWEUySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5heGUySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZUNyaXRTdXBwcmVzc2lvbih2aWN0aW06IFVuaXQpIHtcbiAgICAgICAgcmV0dXJuICh2aWN0aW0uZGVmZW5zZVNraWxsIC0gdGhpcy5tYXhTa2lsbEZvckxldmVsKSAqIDAuMiArICh2aWN0aW0ubGV2ZWwgPT09IDYzID8gMS44IDogMCk7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQ3JpdENoYW5jZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBlZmZlY3Q/OiBFZmZlY3QpIHtcbiAgICAgICAgaWYgKExIX0NPUkVfQlVHICYmIGVmZmVjdCAmJiBlZmZlY3QudHlwZSA9PSBFZmZlY3RUeXBlLlBIWVNJQ0FMKSB7XG4gICAgICAgICAgICAvLyBvbiBMSCBjb3JlLCBub24gd2VhcG9uIHNwZWxscyBsaWtlIGJsb29kdGhpcnN0IGFyZSBiZW5lZml0dGluZyBmcm9tIHdlYXBvbiBza2lsbFxuICAgICAgICAgICAgLy8gdGhpcyBvbmx5IGFmZmVjdHMgY3JpdCwgbm90IGhpdC9kb2RnZS9wYXJyeVxuICAgICAgICAgICAgLy8gc2V0IHRoZSBzcGVsbCB0byB1bmRlZmluZWQgc28gaXQgaXMgdHJlYXRlZCBsaWtlIGEgbm9ybWFsIG1lbGVlIGF0dGFjayAocmF0aGVyIHRoYW4gdXNpbmcgYSBkdW1teSBzcGVsbClcbiAgICAgICAgICAgIC8vIHdoZW4gY2FsY3VsYXRpbmcgd2VhcG9uIHNraWxsXG4gICAgICAgICAgICBlZmZlY3QgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3JpdCA9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuY3JpdDtcbiAgICAgICAgY3JpdCArPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFnaSAqIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RhdE11bHQgLyAyMDtcblxuICAgICAgICAvLyBpZiAoIWVmZmVjdCB8fCBlZmZlY3QudHlwZSA9PSBFZmZlY3RUeXBlLlBIWVNJQ0FMX1dFQVBPTikge1xuICAgICAgICAvLyAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuXG4gICAgICAgICAgICAvLyBpZiAod2VhcG9uLnRlbXBvcmFyeUVuY2hhbnQgJiYgd2VhcG9uLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMgJiYgd2VhcG9uLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMuY3JpdCkge1xuICAgICAgICAgICAgLy8gICAgIGNyaXQgKz0gd2VhcG9uLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMuY3JpdDtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgLy8gfVxuXG4gICAgICAgIGNvbnN0IHdlYXBvbnM6IFdlYXBvbkVxdWlwZWRbXSA9IFtdO1xuICAgICAgICBpZiAodGhpcy5taCkge1xuICAgICAgICAgICAgd2VhcG9ucy5wdXNoKHRoaXMubWgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9oKSB7XG4gICAgICAgICAgICB3ZWFwb25zLnB1c2godGhpcy5vaCk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCB3ZWFwb24gb2Ygd2VhcG9ucykge1xuICAgICAgICAgICAgaWYgKHdlYXBvbi50ZW1wb3JhcnlFbmNoYW50ICYmIHdlYXBvbi50ZW1wb3JhcnlFbmNoYW50LnN0YXRzICYmIHdlYXBvbi50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLmNyaXQpIHtcbiAgICAgICAgICAgICAgICBjcml0ICs9IHdlYXBvbi50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLmNyaXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjcml0IC09IHRoaXMuY2FsY3VsYXRlQ3JpdFN1cHByZXNzaW9uKHZpY3RpbSk7XG5cbiAgICAgICAgcmV0dXJuIGNyaXQ7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgZWZmZWN0PzogRWZmZWN0KSB7XG4gICAgICAgIGxldCByZXMgPSA1O1xuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2tpbGxEaWZmID0gdmljdGltLmRlZmVuc2VTa2lsbCAtIHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgZWZmZWN0KTtcblxuICAgICAgICByZXMgKz0gc2tpbGxEaWZmICogKHNraWxsRGlmZiA+IDEwID8gMC4yIDogMC4xKTtcblxuICAgICAgICBpZiAodGhpcy5vaCAmJiAhZWZmZWN0ICYmICF0aGlzLnF1ZXVlZFNwZWxsKSB7XG4gICAgICAgICAgICByZXMgPSByZXMgKiAwLjggKyAyMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcyAtPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhpdDtcblxuICAgICAgICByZXR1cm4gY2xhbXAocmVzLCAwLCA2MCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgY29uc3Qgc2tpbGxEaWZmID0gdmljdGltLmRlZmVuc2VTa2lsbCAgLSB0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgpO1xuXG4gICAgICAgIGNvbnN0IGxvd0VuZCA9IE1hdGgubWluKDEuMyAtIDAuMDUgKiBza2lsbERpZmYsIDAuOTEpO1xuICAgICAgICBjb25zdCBoaWdoRW5kID0gY2xhbXAoMS4yIC0gMC4wMyAqIHNraWxsRGlmZiwgMC4yLCAwLjk5KTtcblxuICAgICAgICByZXR1cm4gKGxvd0VuZCArIGhpZ2hFbmQpIC8gMjtcbiAgICB9XG5cbiAgICBnZXQgYXAoKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVTd2luZ01pbk1heERhbWFnZShpc19taDogYm9vbGVhbiwgbm9ybWFsaXplZCA9IGZhbHNlKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgICAgIGNvbnN0IHdlYXBvbiA9IGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oITtcblxuICAgICAgICBjb25zdCBhcF9ib251cyA9IHRoaXMuYXAgLyAxNCAqIChub3JtYWxpemVkID8gbm9ybWFsaXplZFdlYXBvblNwZWVkW3dlYXBvbi53ZWFwb24udHlwZV0gOiB3ZWFwb24ud2VhcG9uLnNwZWVkKTtcblxuICAgICAgICBjb25zdCBvaFBlbmFsdHkgPSBpc19taCA/IDEgOiAwLjYyNTsgLy8gVE9ETyAtIGNoZWNrIHRhbGVudHMsIGltcGxlbWVudGVkIGFzIGFuIGF1cmEgU1BFTExfQVVSQV9NT0RfT0ZGSEFORF9EQU1BR0VfUENUXG5cbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICh3ZWFwb24ubWluICsgYXBfYm9udXMgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnBsdXNEYW1hZ2UpICogb2hQZW5hbHR5LFxuICAgICAgICAgICAgKHdlYXBvbi5tYXggKyBhcF9ib251cyArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMucGx1c0RhbWFnZSkgKiBvaFBlbmFsdHlcbiAgICAgICAgXTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZShpc19taDogYm9vbGVhbiwgbm9ybWFsaXplZCA9IGZhbHNlKSB7XG4gICAgICAgIHJldHVybiBmcmFuZCguLi50aGlzLmNhbGN1bGF0ZVN3aW5nTWluTWF4RGFtYWdlKGlzX21oLCBub3JtYWxpemVkKSk7XG4gICAgfVxuXG4gICAgY3JpdENhcCgpIHtcbiAgICAgICAgY29uc3Qgc2tpbGxCb251cyA9IDEwICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZSh0cnVlKSAtIHRoaXMudGFyZ2V0IS5tYXhTa2lsbEZvckxldmVsKTtcbiAgICAgICAgY29uc3QgbWlzc19jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlTWlzc0NoYW5jZSh0aGlzLnRhcmdldCEsIHRydWUpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLnRhcmdldCEuZG9kZ2VDaGFuY2UgKiAxMDApIC0gc2tpbGxCb251cztcbiAgICAgICAgY29uc3QgZ2xhbmNlX2NoYW5jZSA9IGNsYW1wKCgxMCArICh0aGlzLnRhcmdldCEuZGVmZW5zZVNraWxsIC0gMzAwKSAqIDIpICogMTAwLCAwLCA0MDAwKTtcbiAgICAgICAgY29uc3QgY3JpdF9zdXBwcmVzc2lvbiA9IE1hdGgucm91bmQoMTAwICogdGhpcy5jYWxjdWxhdGVDcml0U3VwcHJlc3Npb24odGhpcy50YXJnZXQhKSk7XG5cbiAgICAgICAgcmV0dXJuICgxMDAwMCAtIChtaXNzX2NoYW5jZSArIGRvZGdlX2NoYW5jZSArIGdsYW5jZV9jaGFuY2UgLSBjcml0X3N1cHByZXNzaW9uKSkgLyAxMDA7XG4gICAgfVxuXG4gICAgcm9sbE1lbGVlSGl0T3V0Y29tZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBlZmZlY3Q/OiBFZmZlY3QpOiBNZWxlZUhpdE91dGNvbWUge1xuICAgICAgICBjb25zdCByb2xsID0gdXJhbmQoMCwgMTAwMDApO1xuICAgICAgICBsZXQgc3VtID0gMDtcbiAgICAgICAgbGV0IHRtcCA9IDA7XG5cbiAgICAgICAgLy8gcm91bmRpbmcgaW5zdGVhZCBvZiB0cnVuY2F0aW5nIGJlY2F1c2UgMTkuNCAqIDEwMCB3YXMgdHJ1bmNhdGluZyB0byAxOTM5LlxuICAgICAgICBjb25zdCBtaXNzX2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVNaXNzQ2hhbmNlKHZpY3RpbSwgaXNfbWgsIGVmZmVjdCkgKiAxMDApO1xuXG4gICAgICAgIHRtcCA9IG1pc3NfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkb2RnZV9jaGFuY2UgPSBNYXRoLnJvdW5kKHZpY3RpbS5kb2RnZUNoYW5jZSAqIDEwMCkgLSAxMCAqICh0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgsIGVmZmVjdCkgLSB2aWN0aW0ubWF4U2tpbGxGb3JMZXZlbCk7XG5cbiAgICAgICAgdG1wID0gZG9kZ2VfY2hhbmNlOyAvLyA1LjYgKDU2MCkgZm9yIGx2bCA2MyB3aXRoIDMwMCB3ZWFwb24gc2tpbGxcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZWZmZWN0KSB7IC8vIHNwZWxscyBjYW4ndCBnbGFuY2VcbiAgICAgICAgICAgIHRtcCA9ICgxMCArICh2aWN0aW0uZGVmZW5zZVNraWxsIC0gMzAwKSAqIDIpICogMTAwO1xuICAgICAgICAgICAgdG1wID0gY2xhbXAodG1wLCAwLCA0MDAwKTtcbiAgICBcbiAgICAgICAgICAgIGlmIChyb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfR0xBTkNJTkc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjcml0X2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbSwgaXNfbWgsIGVmZmVjdCkgKiAxMDApO1xuXG4gICAgICAgIHRtcCA9IGNyaXRfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUw7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgZWZmZWN0PzogRWZmZWN0KSB7XG4gICAgICAgIGxldCBkYW1hZ2VXaXRoQm9udXMgPSByYXdEYW1hZ2U7XG5cbiAgICAgICAgZGFtYWdlV2l0aEJvbnVzICo9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuZGFtYWdlTXVsdDtcblxuICAgICAgICByZXR1cm4gZGFtYWdlV2l0aEJvbnVzO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZTogbnVtYmVyLCB2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBlZmZlY3Q/OiBFZmZlY3QpOiBbbnVtYmVyLCBNZWxlZUhpdE91dGNvbWUsIG51bWJlcl0ge1xuICAgICAgICBjb25zdCBkYW1hZ2VXaXRoQm9udXMgPSB0aGlzLmNhbGN1bGF0ZUJvbnVzRGFtYWdlKHJhd0RhbWFnZSwgdmljdGltLCBlZmZlY3QpO1xuICAgICAgICBjb25zdCBhcm1vclJlZHVjZWQgPSB2aWN0aW0uY2FsY3VsYXRlQXJtb3JSZWR1Y2VkRGFtYWdlKGRhbWFnZVdpdGhCb251cywgdGhpcyk7XG4gICAgICAgIGNvbnN0IGhpdE91dGNvbWUgPSB0aGlzLnJvbGxNZWxlZUhpdE91dGNvbWUodmljdGltLCBpc19taCwgZWZmZWN0KTtcblxuICAgICAgICBsZXQgZGFtYWdlID0gYXJtb3JSZWR1Y2VkO1xuICAgICAgICBsZXQgY2xlYW5EYW1hZ2UgPSAwO1xuXG4gICAgICAgIHN3aXRjaCAoaGl0T3V0Y29tZSkge1xuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTpcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSAwO1xuICAgICAgICAgICAgICAgIGNsZWFuRGFtYWdlID0gZGFtYWdlV2l0aEJvbnVzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZHVjZVBlcmNlbnQgPSB0aGlzLmNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbSwgaXNfbWgpO1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IHJlZHVjZVBlcmNlbnQgKiBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlICo9IDI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW2RhbWFnZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCB1cGRhdGVQcm9jcyh0aW1lOiBudW1iZXIsIGlzX21oOiBib29sZWFuLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUsIGRhbWFnZURvbmU6IG51bWJlciwgY2xlYW5EYW1hZ2U6IG51bWJlciwgZWZmZWN0PzogRWZmZWN0KSB7XG4gICAgICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUywgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIC8vIHdoYXQgaXMgdGhlIG9yZGVyIG9mIGNoZWNraW5nIGZvciBwcm9jcyBsaWtlIGhvaiwgaXJvbmZvZSBhbmQgd2luZGZ1cnlcbiAgICAgICAgICAgIC8vIG9uIExIIGNvcmUgaXQgaXMgaG9qID4gaXJvbmZvZSA+IHdpbmRmdXJ5XG4gICAgICAgICAgICAvLyBzbyBkbyBpdGVtIHByb2NzIGZpcnN0LCB0aGVuIHdlYXBvbiBwcm9jLCB0aGVuIHdpbmRmdXJ5XG4gICAgICAgICAgICBmb3IgKGxldCBwcm9jIG9mIHRoaXMucHJvY3MpIHtcbiAgICAgICAgICAgICAgICBwcm9jLnJ1bih0aGlzLCAoaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghKS53ZWFwb24sIHRpbWUsIGVmZmVjdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAoaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghKS5wcm9jKHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVhbE1lbGVlRGFtYWdlKHRpbWU6IG51bWJlciwgcmF3RGFtYWdlOiBudW1iZXIsIHRhcmdldDogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIGVmZmVjdD86IEVmZmVjdCkge1xuICAgICAgICBsZXQgW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXSA9IHRoaXMuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oLCBlZmZlY3QpO1xuICAgICAgICBkYW1hZ2VEb25lID0gTWF0aC50cnVuYyhkYW1hZ2VEb25lKTsgLy8gdHJ1bmNhdGluZyBoZXJlIGJlY2F1c2Ugd2FycmlvciBzdWJjbGFzcyBidWlsZHMgb24gdG9wIG9mIGNhbGN1bGF0ZU1lbGVlRGFtYWdlXG4gICAgICAgIGNsZWFuRGFtYWdlID0gTWF0aC50cnVuYyhjbGVhbkRhbWFnZSk7IC8vIFRPRE8sIHNob3VsZCBkYW1hZ2VNdWx0IGFmZmVjdCBjbGVhbiBkYW1hZ2UgYXMgd2VsbD8gaWYgc28gbW92ZSBpdCBpbnRvIGNhbGN1bGF0ZU1lbGVlRGFtYWdlXG5cbiAgICAgICAgdGhpcy5kYW1hZ2VMb2cucHVzaChbdGltZSwgZGFtYWdlRG9uZV0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKHRoaXMubG9nKSB7XG4gICAgICAgICAgICBsZXQgaGl0U3RyID0gYFlvdXIgJHtlZmZlY3QgPyBlZmZlY3QucGFyZW50IS5uYW1lIDogKGlzX21oID8gJ21haW4taGFuZCcgOiAnb2ZmLWhhbmQnKX0gJHtoaXRPdXRjb21lU3RyaW5nW2hpdE91dGNvbWVdfWA7XG4gICAgICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlldLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAgICAgaGl0U3RyICs9IGAgZm9yICR7ZGFtYWdlRG9uZX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgaGl0U3RyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRhbWFnZU5hbWUgPSBlZmZlY3QgPyBlZmZlY3QucGFyZW50IS5uYW1lIDogKGlzX21oID8gXCJtaFwiIDogXCJvaFwiKTtcblxuICAgICAgICBpZiAoZGFtYWdlTmFtZSA9PT0gXCJtaFwiICYmIGVmZmVjdCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJmdWNrXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHByZXZTdGF0cyA9IHRoaXMuaGl0U3RhdHMuZ2V0KGRhbWFnZU5hbWUpO1xuXG4gICAgICAgIGlmICghcHJldlN0YXRzKSB7XG4gICAgICAgICAgICBwcmV2U3RhdHMgPSB7XG4gICAgICAgICAgICAgICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRVZBREVdOiAwLFxuICAgICAgICAgICAgICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1NdOiAwLFxuICAgICAgICAgICAgICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXTogMCxcbiAgICAgICAgICAgICAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106IDAsXG4gICAgICAgICAgICAgICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlldOiAwLFxuICAgICAgICAgICAgICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HXTogMCxcbiAgICAgICAgICAgICAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogMCxcbiAgICAgICAgICAgICAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106IDAsXG4gICAgICAgICAgICAgICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMXTogMCxcbiAgICAgICAgICAgICAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS19DUklUXTogMCxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmhpdFN0YXRzLnNldChkYW1hZ2VOYW1lLCBwcmV2U3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJldlN0YXRzW2hpdE91dGNvbWVdKys7XG5cblxuICAgICAgICBpZiAoZWZmZWN0IGluc3RhbmNlb2YgU3BlbGxEYW1hZ2VFZmZlY3QpIHtcbiAgICAgICAgICAgIGlmIChlZmZlY3QuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAvLyBjYWxsaW5nIHRoaXMgYmVmb3JlIHVwZGF0ZSBwcm9jcyBiZWNhdXNlIGluIHRoZSBjYXNlIG9mIGV4ZWN1dGUsIHVuYnJpZGxlZCB3cmF0aCBjb3VsZCBwcm9jXG4gICAgICAgICAgICAgICAgLy8gdGhlbiBzZXR0aW5nIHRoZSByYWdlIHRvIDAgd291bGQgY2F1c2UgdXMgdG8gbG9zZSB0aGUgMSByYWdlIGZyb20gdW5icmlkbGVkIHdyYXRoXG4gICAgICAgICAgICAgICAgLy8gYWx0ZXJuYXRpdmUgaXMgdG8gc2F2ZSB0aGUgYW1vdW50IG9mIHJhZ2UgdXNlZCBmb3IgdGhlIGFiaWxpdHlcbiAgICAgICAgICAgICAgICBlZmZlY3QuY2FsbGJhY2sodGhpcywgaGl0T3V0Y29tZSwgdGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVmZmVjdCB8fCBlZmZlY3QuY2FuUHJvYykge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIGVmZmVjdCk7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlYWxTcGVsbERhbWFnZSh0aW1lOiBudW1iZXIsIHJhd0RhbWFnZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGVmZmVjdDogRWZmZWN0KSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZURvbmUgPSByYXdEYW1hZ2U7XG5cbiAgICAgICAgdGhpcy5kYW1hZ2VMb2cucHVzaChbdGltZSwgZGFtYWdlRG9uZV0pO1xuXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgYCR7ZWZmZWN0LnBhcmVudCEubmFtZX0gaGl0cyBmb3IgJHtkYW1hZ2VEb25lfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHN3aW5nV2VhcG9uKHRpbWU6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBpZiAoaXNfbWggJiYgdGhpcy5xdWV1ZWRTcGVsbCAmJiB0aGlzLnF1ZXVlZFNwZWxsLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwgPSB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXNfbWgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnF1ZXVlZFNwZWxsID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByYXdEYW1hZ2UgPSB0aGlzLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oKTtcbiAgICAgICAgICAgIHRoaXMuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHJhd0RhbWFnZSwgdGFyZ2V0LCBpc19taCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBbdGhpc1dlYXBvbiwgb3RoZXJXZWFwb25dID0gaXNfbWggPyBbdGhpcy5taCwgdGhpcy5vaF0gOiBbdGhpcy5vaCwgdGhpcy5taF07XG5cbiAgICAgICAgdGhpc1dlYXBvbiEubmV4dFN3aW5nVGltZSA9IHRpbWUgKyB0aGlzV2VhcG9uIS53ZWFwb24uc3BlZWQgLyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhhc3RlICogMTAwMDtcbiAgICB9XG5cbiAgICB1cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRyYUF0dGFja0NvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9pbmdFeHRyYUF0dGFja3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHdoaWxlICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4dHJhQXR0YWNrQ291bnQtLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGltZSA+PSB0aGlzLm1oIS5uZXh0U3dpbmdUaW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5vaCAmJiB0aW1lID49IHRoaXMub2gubmV4dFN3aW5nVGltZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciwgTWVsZWVIaXRPdXRjb21lLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmT3ZlclRpbWUsIEJ1ZmZQcm9jIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBMZWFybmVkU3BlbGwsIFNwZWxsRGFtYWdlLCBFZmZlY3RUeXBlLCBTd2luZ1NwZWxsLCBMZWFybmVkU3dpbmdTcGVsbCwgUHJvYywgU3BlbGxCdWZmLCBFZmZlY3QsIFNwZWxsQnVmZkVmZmVjdCwgTW9kaWZ5UG93ZXJFZmZlY3QsIEVmZmVjdEZhbWlseSwgU3dpbmdFZmZlY3QgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBnZXRCdWZmIH0gZnJvbSBcIi4vZGF0YS9zcGVsbHMuanNcIjtcblxuY29uc3QgZmx1cnJ5ID0gbmV3IEJ1ZmYoXCJGbHVycnlcIiwgMTUsIHtoYXN0ZTogMS4zfSwgdHJ1ZSwgMywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblxuZXhwb3J0IGNvbnN0IHJhY2VUb1N0YXRzID0gbmV3IE1hcDxSYWNlLCBTdGF0VmFsdWVzPigpO1xucmFjZVRvU3RhdHMuc2V0KFJhY2UuSFVNQU4sIHsgbWFjZVNraWxsOiA1LCBzd29yZFNraWxsOiA1LCBtYWNlMkhTa2lsbDogNSwgc3dvcmQySFNraWxsOiA1LCBzdHI6IDEyMCwgYWdpOiA4MCB9KTtcbnJhY2VUb1N0YXRzLnNldChSYWNlLk9SQywgeyBheGVTa2lsbDogNSwgYXhlMkhTa2lsbDogNSwgc3RyOiAxMjMsIGFnaTogNzcgfSk7XG5yYWNlVG9TdGF0cy5zZXQoUmFjZS5HTk9NRSwgeyBzdHI6IDExNSwgYWdpOiA4MyB9KTtcbnJhY2VUb1N0YXRzLnNldChSYWNlLlRST0xMLCB7IHN0cjogMTIxLCBhZ2k6IDgyIH0pO1xuXG5leHBvcnQgY2xhc3MgV2FycmlvciBleHRlbmRzIFBsYXllciB7XG4gICAgcmFnZSA9IDgwOyAvLyBUT0RPIC0gYWxsb3cgc2ltdWxhdGlvbiB0byBjaG9vc2Ugc3RhcnRpbmcgcmFnZVxuXG4gICAgZXhlY3V0ZSA9IG5ldyBMZWFybmVkU3BlbGwoZXhlY3V0ZVNwZWxsLCB0aGlzKTtcbiAgICBibG9vZHRoaXJzdCA9IG5ldyBMZWFybmVkU3BlbGwoYmxvb2R0aGlyc3RTcGVsbCwgdGhpcyk7XG4gICAgaGFtc3RyaW5nID0gbmV3IExlYXJuZWRTcGVsbChoYW1zdHJpbmdTcGVsbCwgdGhpcyk7XG4gICAgd2hpcmx3aW5kID0gbmV3IExlYXJuZWRTcGVsbCh3aGlybHdpbmRTcGVsbCwgdGhpcyk7XG4gICAgaGVyb2ljU3RyaWtlUjggPSBuZXcgTGVhcm5lZFN3aW5nU3BlbGwoaGVyb2ljU3RyaWtlUjhTcGVsbCwgdGhpcyk7XG4gICAgaGVyb2ljU3RyaWtlUjkgPSBuZXcgTGVhcm5lZFN3aW5nU3BlbGwoaGVyb2ljU3RyaWtlUjlTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2RSYWdlID0gbmV3IExlYXJuZWRTcGVsbChibG9vZFJhZ2UsIHRoaXMpO1xuICAgIGRlYXRoV2lzaCA9IG5ldyBMZWFybmVkU3BlbGwoZGVhdGhXaXNoLCB0aGlzKTtcbiAgICByZWNrbGVzc25lc3MgPSBuZXcgTGVhcm5lZFNwZWxsKHJlY2tsZXNzbmVzcywgdGhpcyk7XG4gICAgZXhlY3V0ZVNwZWxsID0gbmV3IExlYXJuZWRTcGVsbChleGVjdXRlU3BlbGwsIHRoaXMpO1xuICAgIG1pZ2h0eVJhZ2VQb3Rpb24gPSBuZXcgTGVhcm5lZFNwZWxsKG1pZ2h0eVJhZ2VQb3Rpb24sIHRoaXMpO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZ0NhbGxiYWNrPzogKHRpbWU6IG51bWJlciwgdGV4dDogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5ldyBTdGF0cyhyYWNlVG9TdGF0cy5nZXQocmFjZSkpLmFkZChzdGF0cyksIGxvZ0NhbGxiYWNrKTtcblxuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChhbmdlck1hbmFnZW1lbnRPVCwgTWF0aC5yYW5kb20oKSAqIC0zMDAwIC0gMTAwKTsgLy8gcmFuZG9taXppbmcgYW5nZXIgbWFuYWdlbWVudCB0aW1pbmdcbiAgICAgICAgdGhpcy5idWZmTWFuYWdlci5hZGQodW5icmlkbGVkV3JhdGgsIC0xMDApO1xuICAgIH1cblxuICAgIGdldCBwb3dlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmFnZTtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge1xuICAgICAgICB0aGlzLnBvd2VyTG9zdCArPSBNYXRoLm1heCgwLCBwb3dlciAtIDEwMCk7XG4gICAgICAgIHRoaXMucmFnZSA9IGNsYW1wKHBvd2VyLCAwLCAxMDApO1xuICAgIH1cblxuICAgIGdldCBhcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiAzIC0gMjAgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFwICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdHIgKiB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0YXRNdWx0ICogMjtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIGVmZmVjdD86IEVmZmVjdCkge1xuICAgICAgICAvLyBjcnVlbHR5ICsgYmVyc2Vya2VyIHN0YW5jZVxuICAgICAgICByZXR1cm4gNSArIDMgKyBzdXBlci5jYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbSwgaXNfbWgsIGVmZmVjdCk7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIGVmZmVjdD86IEVmZmVjdCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gc3VwZXIuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIGlzX21oLCBlZmZlY3QpO1xuXG4gICAgICAgIGlmIChoaXRPdXRjb21lID09PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQgJiYgZWZmZWN0ICYmIGVmZmVjdC5mYW1pbHkgPT09IEVmZmVjdEZhbWlseS5XQVJSSU9SKSB7XG4gICAgICAgICAgICBkYW1hZ2VEb25lICo9IDEuMTsgLy8gaW1wYWxlXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCByZXdhcmRSYWdlKGRhbWFnZTogbnVtYmVyLCBpc19hdHRhY2tlcjogYm9vbGVhbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIGh0dHBzOi8vYmx1ZS5tbW8tY2hhbXBpb24uY29tL3RvcGljLzE4MzI1LXRoZS1uZXctcmFnZS1mb3JtdWxhLWJ5LWthbGdhbi9cbiAgICAgICAgLy8gUHJlLUV4cGFuc2lvbiBSYWdlIEdhaW5lZCBmcm9tIGRlYWxpbmcgZGFtYWdlOlxuICAgICAgICAvLyAoRGFtYWdlIERlYWx0KSAvIChSYWdlIENvbnZlcnNpb24gYXQgWW91ciBMZXZlbCkgKiA3LjVcbiAgICAgICAgLy8gRm9yIFRha2luZyBEYW1hZ2UgKGJvdGggcHJlIGFuZCBwb3N0IGV4cGFuc2lvbik6XG4gICAgICAgIC8vIFJhZ2UgR2FpbmVkID0gKERhbWFnZSBUYWtlbikgLyAoUmFnZSBDb252ZXJzaW9uIGF0IFlvdXIgTGV2ZWwpICogMi41XG4gICAgICAgIC8vIFJhZ2UgQ29udmVyc2lvbiBhdCBsZXZlbCA2MDogMjMwLjZcbiAgICAgICAgLy8gVE9ETyAtIGhvdyBkbyBmcmFjdGlvbnMgb2YgcmFnZSB3b3JrPyBpdCBhcHBlYXJzIHlvdSBkbyBnYWluIGZyYWN0aW9ucyBiYXNlZCBvbiBleGVjIGRhbWFnZVxuICAgICAgICAvLyBub3QgdHJ1bmNhdGluZyBmb3Igbm93XG4gICAgICAgIC8vIFRPRE8gLSBpdCBhcHBlYXJzIHRoYXQgcmFnZSBpcyBjYWxjdWxhdGVkIHRvIHRlbnRocyBiYXNlZCBvbiBkYXRhYmFzZSB2YWx1ZXMgb2Ygc3BlbGxzICgxMCBlbmVyZ3kgPSAxIHJhZ2UpXG4gICAgICAgIFxuICAgICAgICBjb25zdCBMRVZFTF82MF9SQUdFX0NPTlYgPSAyMzAuNjtcbiAgICAgICAgbGV0IGFkZFJhZ2UgPSBkYW1hZ2UgLyBMRVZFTF82MF9SQUdFX0NPTlY7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNfYXR0YWNrZXIpIHtcbiAgICAgICAgICAgIGFkZFJhZ2UgKj0gNy41O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGNoZWNrIGZvciBiZXJzZXJrZXIgcmFnZSAxLjN4IG1vZGlmaWVyXG4gICAgICAgICAgICBhZGRSYWdlICo9IDIuNTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxvZykgdGhpcy5sb2codGltZSwgYEdhaW5lZCAke01hdGgubWluKGFkZFJhZ2UsIDEwMCAtIHRoaXMucmFnZSl9IHJhZ2UgKCR7TWF0aC5taW4oMTAwLCB0aGlzLnBvd2VyICsgYWRkUmFnZSl9KWApO1xuXG4gICAgICAgIHRoaXMucG93ZXIgKz0gYWRkUmFnZTtcbiAgICB9XG5cbiAgICB1cGRhdGVQcm9jcyh0aW1lOiBudW1iZXIsIGlzX21oOiBib29sZWFuLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUsIGRhbWFnZURvbmU6IG51bWJlciwgY2xlYW5EYW1hZ2U6IG51bWJlciwgZWZmZWN0PzogRWZmZWN0KSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZVByb2NzKHRpbWUsIGlzX21oLCBoaXRPdXRjb21lLCBkYW1hZ2VEb25lLCBjbGVhbkRhbWFnZSwgZWZmZWN0KTtcblxuICAgICAgICBpZiAoW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICBpZiAoZWZmZWN0KSB7XG4gICAgICAgICAgICAgICAgLy8gaHR0cDovL2JsdWUubW1vLWNoYW1waW9uLmNvbS90b3BpYy82OTM2NS0xOC0wMi0wNS1rYWxnYW5zLXJlc3BvbnNlLXRvLXdhcnJpb3JzLyBcInNpbmNlIG1pc3Npbmcgd2FzdGVzIDIwJSBvZiB0aGUgcmFnZSBjb3N0IG9mIHRoZSBhYmlsaXR5XCJcbiAgICAgICAgICAgICAgICAvLyBUT0RPIC0gbm90IHN1cmUgaG93IGJsaXp6bGlrZSB0aGlzIGlzXG4gICAgICAgICAgICAgICAgaWYgKGVmZmVjdC5wYXJlbnQgaW5zdGFuY2VvZiBTcGVsbCAmJiBlZmZlY3QucGFyZW50ICE9PSB3aGlybHdpbmRTcGVsbCkgeyAvLyBUT0RPIC0gc2hvdWxkIGNoZWNrIHRvIHNlZSBpZiBpdCBpcyBhbiBhb2Ugc3BlbGwgb3IgYSBzaW5nbGUgdGFyZ2V0IHNwZWxsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmFnZSArPSBlZmZlY3QucGFyZW50LmNvc3QgKiAwLjc1OyAvLyBUT0RPOiBmcm9tIFN0ZXBwZW53b2xmJ3Mgc3ByZWVkc2hlZXQsIGZpbmQgc291cmNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoY2xlYW5EYW1hZ2UgKiAwLjc1LCB0cnVlLCB0aW1lKTsgLy8gVE9ETyAtIHdoZXJlIGlzIHRoaXMgZm9ybXVsYSBmcm9tP1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRhbWFnZURvbmUgJiYgIWVmZmVjdCkge1xuICAgICAgICAgICAgdGhpcy5yZXdhcmRSYWdlKGRhbWFnZURvbmUsIHRydWUsIHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5zdGFudCBhdHRhY2tzIGFuZCBtaXNzZXMvZG9kZ2VzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyAvLyBUT0RPIC0gY29uZmlybSwgd2hhdCBhYm91dCBwYXJyeT9cbiAgICAgICAgLy8gZXh0cmEgYXR0YWNrcyBkb24ndCB1c2UgZmx1cnJ5IGNoYXJnZXMgYnV0IHRoZXkgY2FuIHByb2MgZmx1cnJ5ICh0ZXN0ZWQpXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICF0aGlzLmRvaW5nRXh0cmFBdHRhY2tzXG4gICAgICAgICAgICAmJiAoIWVmZmVjdCB8fCBlZmZlY3QgaW5zdGFuY2VvZiBTd2luZ0VmZmVjdClcbiAgICAgICAgICAgIC8vICYmICFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKVxuICAgICAgICAgICAgJiYgaGl0T3V0Y29tZSAhPT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXG4gICAgICAgICkgeyBcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIucmVtb3ZlKGZsdXJyeSwgdGltZSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChoaXRPdXRjb21lID09PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQpIHtcbiAgICAgICAgICAgIC8vIFRPRE8gLSBpZ25vcmluZyBkZWVwIHdvdW5kc1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5hZGQoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgaGVyb2ljU3RyaWtlUjhTcGVsbCA9IG5ldyBTd2luZ1NwZWxsKFwiSGVyb2ljIFN0cmlrZVwiLCBFZmZlY3RGYW1pbHkuV0FSUklPUiwgMTM4LCAxMik7XG5jb25zdCBoZXJvaWNTdHJpa2VSOVNwZWxsID0gbmV3IFN3aW5nU3BlbGwoXCJIZXJvaWMgU3RyaWtlXCIsIEVmZmVjdEZhbWlseS5XQVJSSU9SLCAxNTcsIDEyKTtcblxuLy8gZXhlY3V0ZSBhY3R1YWxseSB3b3JrcyBieSBjYXN0aW5nIHR3byBzcGVsbHMsIGZpcnN0IHJlcXVpcmVzIHdlYXBvbiBidXQgZG9lcyBubyBkYW1hZ2Vcbi8vIHNlY29uZCBvbmUgZG9lc24ndCByZXF1aXJlIHdlYXBvbiBhbmQgZGVhbHMgdGhlIGRhbWFnZS5cbi8vIExIIGNvcmUgb3ZlcnJvZGUgdGhlIHNlY29uZCBzcGVsbCB0byByZXF1aXJlIHdlYXBvbiAoYmVuZWZpdCBmcm9tIHdlYXBvbiBza2lsbClcbmNvbnN0IGV4ZWN1dGVTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkV4ZWN1dGVcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIDYwMCArIChwbGF5ZXIucG93ZXIgLSAxMCkgKiAxNTtcbn0sIEVmZmVjdFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBFZmZlY3RGYW1pbHkuV0FSUklPUiwgdHJ1ZSwgMTAsIDAsIChwbGF5ZXI6IFBsYXllciwgaGl0T3V0Y29tZTogTWVsZWVIaXRPdXRjb21lLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1NdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgIC8vIHBsYXllci5wb3dlciA9IDA7XG4gICAgICAgIGNvbnN0IG5leHRCYXRjaCA9IHRpbWUgKyBNYXRoLnJhbmRvbSgpICogNDAwO1xuICAgICAgICBwbGF5ZXIuZnV0dXJlRXZlbnRzLnB1c2goe1xuICAgICAgICAgICAgdGltZTogbmV4dEJhdGNoLFxuICAgICAgICAgICAgY2FsbGJhY2s6IChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgICAgICAgICAgICAgIHBsYXllci5wb3dlciA9IDA7XG5cbiAgICAgICAgICAgICAgICBpZiAocGxheWVyLmxvZykge1xuICAgICAgICAgICAgICAgICAgICBwbGF5ZXIubG9nKG5leHRCYXRjaCwgYFJlc2V0IHJhZ2UgdG8gMCBhZnRlciBleGVjdXRlLCBUT0RPIChub3QgZXhhY3RseSBob3cgaXQgd29ya3MpYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59KTtcblxuY29uc3QgYmxvb2R0aGlyc3RTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkJsb29kdGhpcnN0XCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiAoPFdhcnJpb3I+cGxheWVyKS5hcCAqIDAuNDU7XG59LCBFZmZlY3RUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgRWZmZWN0RmFtaWx5LldBUlJJT1IsIHRydWUsIDMwLCA2KTtcblxuY29uc3Qgd2hpcmx3aW5kU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJXaGlybHdpbmRcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIHBsYXllci5jYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZSh0cnVlLCB0cnVlKTtcbn0sIEVmZmVjdFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBFZmZlY3RGYW1pbHkuV0FSUklPUiwgdHJ1ZSwgMjUsIDEwKTtcblxuY29uc3QgaGFtc3RyaW5nU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJIYW1zdHJpbmdcIiwgNDUsIEVmZmVjdFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBFZmZlY3RGYW1pbHkuV0FSUklPUiwgdHJ1ZSwgMTAsIDApO1xuXG5leHBvcnQgY29uc3QgYW5nZXJNYW5hZ2VtZW50T1QgPSBuZXcgQnVmZk92ZXJUaW1lKFwiQW5nZXIgTWFuYWdlbWVudFwiLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgdW5kZWZpbmVkLCAzMDAwLCBuZXcgTW9kaWZ5UG93ZXJFZmZlY3QoMSkpO1xuXG5jb25zdCBibG9vZFJhZ2UgPSBuZXcgU3BlbGwoXCJCbG9vZHJhZ2VcIiwgZmFsc2UsIDAsIDYwLCBbXG4gICAgbmV3IE1vZGlmeVBvd2VyRWZmZWN0KDEwKSxcbiAgICBuZXcgU3BlbGxCdWZmRWZmZWN0KG5ldyBCdWZmT3ZlclRpbWUoXCJCbG9vZHJhZ2VcIiwgMTAsIHVuZGVmaW5lZCwgMTAwMCwgbmV3IE1vZGlmeVBvd2VyRWZmZWN0KDEpKSldKTtcblxuY29uc3QgZGVhdGhXaXNoID0gbmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkRlYXRoIFdpc2hcIiwgMzAsIHsgZGFtYWdlTXVsdDogMS4yIH0pLCB0cnVlLCAxMCwgMyAqIDYwKTtcbmNvbnN0IHJlY2tsZXNzbmVzcyA9IG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJSZWNrbGVzc25lc3NcIiwgMTUsIHsgY3JpdDogMTAwIH0pLCB0cnVlLCAwLCAxNSAqIDYwKTtcblxuLy8gdW5icmlkbGVkIHdyYXRoIG9ubHkgcHJvY3MgZnJvbSBhdXRvYXR0YWNrL2hlcm9pYyBzdHJpa2UvY2xlYXZlXG5jb25zdCB1bmJyaWRsZWRXcmF0aCA9IG5ldyBCdWZmUHJvYyhcIlVuYnJpZGxlZCBXcmF0aFwiLCA2MCAqIDYwLFxuICAgIG5ldyBQcm9jKG5ldyBTcGVsbChcIlVuYnJpZGxlZCBXcmF0aFwiLCBmYWxzZSwgMCwgMCwgbmV3IE1vZGlmeVBvd2VyRWZmZWN0KDEpKSwge2NoYW5jZTogMC40fSwgdHJ1ZSkpO1xuXG5jb25zdCBtaWdodHlSYWdlUG90aW9uID0gbmV3IFNwZWxsKFwiTWlnaHR5IFJhZ2UgUG90aW9uXCIsIGZhbHNlLCAwLCAyICogNjAsIFtcbiAgICBuZXcgTW9kaWZ5UG93ZXJFZmZlY3QoNDUsIDMwKSxcbiAgICBuZXcgU3BlbGxCdWZmRWZmZWN0KG5ldyBCdWZmKFwiTWlnaHR5IFJhZ2VcIiwgMjAsIHsgc3RyOiA2MCB9KSksXG5dKTtcbiIsImltcG9ydCB7IFByb2MsIFNwZWxsQnVmZiwgRXh0cmFBdHRhY2sgfSBmcm9tIFwiLi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4uL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCB9IGZyb20gXCIuLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4uL2J1ZmYuanNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBFbmNoYW50RGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzbG90OiBJdGVtU2xvdCxcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG4gICAgcHJvYz86IFByb2Ncbn1cblxuZXhwb3J0IGNvbnN0IGVuY2hhbnRzOiBFbmNoYW50RGVzY3JpcHRpb25bXSA9IFtcbiAgICB7XG4gICAgICAgIC8vIE5PVEU6IHRvIHNpbXBsaWZ5IHRoZSBjb2RlLCB0cmVhdGluZyB0aGVzZSBhcyB0d28gc2VwYXJhdGUgYnVmZnMgc2luY2UgdGhleSBzdGFja1xuICAgICAgICAvLyBjcnVzYWRlciBidWZmcyBhcHBhcmVudGx5IGNhbiBiZSBmdXJ0aGVyIHN0YWNrZWQgYnkgc3dhcHBpbmcgd2VhcG9ucyBidXQgbm90IGdvaW5nIHRvIGJvdGhlciB3aXRoIHRoYXRcbiAgICAgICAgbmFtZTogJ0NydXNhZGVyIE1IJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIHByb2M6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJDcnVzYWRlciBNSFwiLCAxNSwgbmV3IFN0YXRzKHtzdHI6IDEwMH0pKSksIHtwcG06IDF9KSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0NydXNhZGVyIE9IJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgcHJvYzogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE9IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pLFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnMTUgU3RyZW5ndGgnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCB8IEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNX0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICc4IFN0cmVuZ3RoJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCB8IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA4fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzE1IEFnaWxpdHknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE1fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzcgU3RyZW5ndGgnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDd9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnMSBIYXN0ZScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQgfCBJdGVtU2xvdC5MRUdTIHwgSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7aGFzdGU6IDEuMDF9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnMyBBZ2lsaXR5JyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQkFDSyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDN9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnTWlnaHQgb2YgdGhlIFNjb3VyZ2UnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5TSE9VTERFUixcbiAgICAgICAgc3RhdHM6IHthcDogMjYsIGNyaXQ6IDF9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnWkcgRW5jaGFudCAoMzAgQVApJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDMwfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0dyZWF0ZXIgU3RhdHMgKCs0KScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogNCwgYWdpOiA0fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzkgU3RyZW5ndGgnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDl9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnUnVuIFNwZWVkJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHt9LCAvLyBUT0RPIC0gZG8gbW92ZW1lbnQgc3BlZWQgaWYgSSBldmVyIGdldCBhcm91bmQgdG8gc2ltdWxhdGluZyBmaWdodHMgeW91IGhhdmUgdG8gcnVuIG91dFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnNyBBZ2lsaXR5JyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDd9LFxuICAgIH0sXG5dO1xuXG5leHBvcnQgY29uc3QgdGVtcG9yYXJ5RW5jaGFudHM6IEVuY2hhbnREZXNjcmlwdGlvbltdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogJys4IERhbWFnZScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EIHwgSXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgc3RhdHM6IHsgcGx1c0RhbWFnZTogOCB9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnRWxlbWVudGFsIFNoYXJwZW5pbmcgU3RvbmUnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCB8IEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDIgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1dpbmRmdXJ5JyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIHByb2M6IG5ldyBQcm9jKFtcbiAgICAgICAgICAgIG5ldyBFeHRyYUF0dGFjayhcIldpbmRmdXJ5IFRvdGVtXCIsIDEpLFxuICAgICAgICAgICAgbmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIldpbmRmdXJ5IFRvdGVtXCIsIDEuNSwgeyBhcDogMzE1IH0pKVxuICAgICAgICBdLCB7Y2hhbmNlOiAwLjJ9KSxcbiAgICB9XG5dO1xuIiwiaW1wb3J0IHsgV2VhcG9uVHlwZSwgV2VhcG9uRGVzY3JpcHRpb24sIEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24gfSBmcm9tIFwiLi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgU3BlbGxCdWZmLCBFeHRyYUF0dGFjaywgUHJvYywgRWZmZWN0VHlwZSwgSXRlbVNwZWxsRGFtYWdlLCBTcGVsbERhbWFnZSB9IGZyb20gXCIuLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgQnVmZiwgQnVmZlByb2MgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgU3RhdHMgfSBmcm9tIFwiLi4vc3RhdHMuanNcIjtcblxuLy8gZXhwb3J0IGludGVyZmFjZSBTZXRCb251c0Rlc2NyaXB0aW9uIHtcbi8vICAgICBzdGF0cz86IFN0YXRzLFxuLy8gICAgIG9uZXF1aXA/OiBQcm9jLFxuLy8gfVxuXG4vLyBleHBvcnQgaW50ZXJmYWNlIFNldERlc2NyaXB0aW9uIHtcbi8vICAgICBuYW1lOiBzdHJpbmcsXG4vLyAgICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxuLy8gICAgIG9udXNlPzogU3BlbGwsXG4vLyAgICAgb25lcXVpcD86IFByb2MsXG4vLyB9XG5cbi8vIGV4cG9ydCBjb25zdCBzZXRCb251c2VzOiAoSXRlbURlc2NyaXB0aW9ufFdlYXBvbkRlc2NyaXB0aW9uKVtdID0gW1xuLy8gXTtcblxuZXhwb3J0IGNvbnN0IGl0ZW1zOiAoSXRlbURlc2NyaXB0aW9ufFdlYXBvbkRlc2NyaXB0aW9uKVtdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogXCJJcm9uZm9lXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIG1pbjogNzMsXG4gICAgICAgIG1heDogMTM2LFxuICAgICAgICBzcGVlZDogMi40LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IEV4dHJhQXR0YWNrKCdJcm9uZm9lJywgMikse3BwbTogMX0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSXJvbmZvZSAyLzNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgbWluOiA3MyxcbiAgICAgICAgbWF4OiAxMzYsXG4gICAgICAgIHNwZWVkOiAyLjQsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0lyb25mb2UnLCAyKSx7cHBtOiAyLzN9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIklyb25mb2UgTm8gcHJvY1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBtaW46IDczLFxuICAgICAgICBtYXg6IDEzNixcbiAgICAgICAgc3BlZWQ6IDIuNFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkZsdXJyeSBBeGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIG1pbjogMzcsXG4gICAgICAgIG1heDogNjksXG4gICAgICAgIHNwZWVkOiAxLjUsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0lyb25mb2UnLCAyKSx7cHBtOiAxLjg2NX0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRW1weXJlYW4gRGVtb2xpc2hlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDk0LFxuICAgICAgICBtYXg6IDE3NSxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJIYXN0ZSAoRW1weXJlYW4gRGVtb2xpc2hlcilcIiwgMTAsIHtoYXN0ZTogMS4yfSkpLHtwcG06IDF9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFudWJpc2F0aCBXYXJoYW1tZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDY2LFxuICAgICAgICBtYXg6IDEyMyxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgbWFjZVNraWxsOiA0LCBhcDogMzIgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNhbmQgUG9saXNoZWQgSGFtbWVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA5NyxcbiAgICAgICAgbWF4OiAxODEsXG4gICAgICAgIHNwZWVkOiAyLjYsXG4gICAgICAgIHN0YXRzOiB7IGFwOiAyMCwgY3JpdDogMSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVGhlIFVudGFtZWQgQmxhZGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRDJILFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiAxOTIsXG4gICAgICAgIG1heDogMjg5LFxuICAgICAgICBzcGVlZDogMy40LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIlVudGFtZWQgRnVyeVwiLCA4LCB7c3RyOiAzMDB9KSkse3BwbTogMn0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWlzcGxhY2VkIFNlcnZvIEFybVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTI4LFxuICAgICAgICBtYXg6IDIzOCxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgb25lcXVpcDogbmV3IFByb2MobmV3IFNwZWxsRGFtYWdlKFwiRWxlY3RyaWMgRGlzY2hhcmdlXCIsIFsxMDAsIDE1MV0sIEVmZmVjdFR5cGUuTUFHSUMpLCB7cHBtOiAzfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaGUgQ2FzdGlnYXRvclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTE5LFxuICAgICAgICBtYXg6IDIyMSxcbiAgICAgICAgc3BlZWQ6IDIuNixcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgaGl0OiAxLCBhcDogMTYgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhhbmQgb2YgSnVzdGljZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiAyMH0sXG4gICAgICAgIG9uZXF1aXA6IG5ldyBQcm9jKG5ldyBFeHRyYUF0dGFjaygnSGFuZCBvZiBKdXN0aWNlJywgMSksIHtjaGFuY2U6IDIvMTAwfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEYXJrbW9vbiBDYXJkOiBNYWVsc3Ryb21cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgb25lcXVpcDogbmV3IFByb2MobmV3IFNwZWxsRGFtYWdlKFwiRWxlY3RyaWMgRGlzY2hhcmdlXCIsIFsyMDAsIDMwMV0sIEVmZmVjdFR5cGUuTUFHSUMpLCB7cHBtOiAxfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEYXJrbW9vbiBDYXJkOiBNYWVsc3Ryb20gMnBwbVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBvbmVxdWlwOiBuZXcgUHJvYyhuZXcgU3BlbGxEYW1hZ2UoXCJFbGVjdHJpYyBEaXNjaGFyZ2VcIiwgWzIwMCwgMzAxXSwgRWZmZWN0VHlwZS5NQUdJQyksIHtwcG06IDJ9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRhcmttb29uIENhcmQ6IE1hZWxzdHJvbSAyJVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBvbmVxdWlwOiBuZXcgUHJvYyhuZXcgU3BlbGxEYW1hZ2UoXCJFbGVjdHJpYyBEaXNjaGFyZ2VcIiwgWzIwMCwgMzAxXSwgRWZmZWN0VHlwZS5NQUdJQyksIHtjaGFuY2U6IDIvMTAwfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGFja2hhbmQncyBCcmVhZHRoXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEcmFrZSBGYW5nIFRhbGlzbWFuXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDU2LCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTGlvbmhlYXJ0IEhlbG1cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCxcbiAgICAgICAgc3RhdHM6IHtjcml0OiAyLCBoaXQ6IDIsIHN0cjogMTh9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSGVsbSBvZiBFbmRsZXNzIFJhZ2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDI2LCBhZ2k6IDI2fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJhbmsgMTAgaGVsbVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IRUFELFxuICAgICAgICBzdGF0czoge3N0cjogMjEsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSYW5rIDEwIGhlbG0gKCs0MCBhcClcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIxLCBjcml0OiAxLCBoaXQ6IDEsIGFwOiA0MH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFeHBlcnQgR29sZG1pbmVyJ3MgSGVsbWV0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQsXG4gICAgICAgIHN0YXRzOiB7YWdpOiA1LCBheGVTa2lsbDogN31cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYXJiZWQgQ2hva2VyXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk5FQ0ssXG4gICAgICAgIHN0YXRzOiB7YXA6IDQ0LCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRoZSBFeWUgb2YgSGFra2FyXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk5FQ0ssXG4gICAgICAgIHN0YXRzOiB7YXA6IDQwLCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlN0b3JtcmFnZSdzIFRhbGlzbWFuIG9mIFNlZXRoaW5nXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk5FQ0ssXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMiwgYXA6IDI2fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9ueXhpYSBUb290aCBQZW5kYW50XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk5FQ0ssXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxMiwgaGl0OiAxLCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFtdWxldCBvZiB0aGUgRGFya21vb25cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE5LCBzdHI6IDEwfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNvbnF1ZXJvcidzIFNwYXVsZGVyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5TSE9VTERFUixcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDE2LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFudGxlIG9mIFdpY2tlZCBSZXZlbmdlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge3N0cjogMTYsIGFnaTogMzB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmFuayAxMCBTaG91bGRlcnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNywgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSYW5rIDEwIFNob3VsZGVycyAoKzQwIGFwKVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5TSE9VTERFUixcbiAgICAgICAgc3RhdHM6IHtzdHI6IDE3LCBjcml0OiAxLCBhcDogNDB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJha2UgVGFsb24gUGF1bGRyb25zXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMjB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVHJ1ZXN0cmlrZSBTaG91bGRlcnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDI0LCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTGlldXRlbmFudCBDb21tYW5kZXIncyBQbGF0ZSBTaG91bGRlcnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNywgYXA6IDQwLCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNsb2FrIG9mIERyYWNvbmljIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNiwgYWdpOiAxNn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDYXBlIG9mIHRoZSBCbGFjayBCYXJvblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge2FwOiAyMCwgYWdpOiAxNX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJadWxpYW4gVGlnZXJoaWRlIFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge2hpdDogMSwgYWdpOiAxM31cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEcmFwZSBvZiBVbnlpZWxkaW5nIFN0cmVuZ3RoXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNSwgYWdpOiA5LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUHVpc3NhbnQgQ2FwZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge2FwOiA0MCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNocm91ZCBvZiBEb21pbmlvblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDEsIGFwOiA1MH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBCcmVhc3RwbGF0ZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDM0LCBhZ2k6IDI0fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNhdmFnZSBHbGFkaWF0b3IgQ2hhaW5cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxNCwgc3RyOiAxMywgY3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSYW5rIDEwIGNoZXN0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjEsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmFuayAxMCBjaGVzdCAoKzQwKVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIxLCBjcml0OiAxLCBhcDogNDB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ2FkYXZlcm91cyBBcm1vclwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDgsIHN0cjogOCwgYXA6IDYwfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdob3VsIFNraW4gVHVuaWNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA0MCwgY3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNYWxmdXJpb24ncyBCbGVzc2VkIEJ1bHdhcmtcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA0MH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCcmVhc3RwbGF0ZSBvZiBBbm5paGlsYXRpb25cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzNywgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlBsYXRlZCBBYm9taW5hdGlvbiBSaWJjYWdlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogNDUsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LCBcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUnVuZWQgQmxvb2RzdGFpbmVkIEhhdWJlcmtcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7YXA6IDU4LCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhpdmUgRGVmaWxlciBXcmlzdGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIzLCBhZ2k6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlFpcmFqaSBFeGVjdXRpb24gQnJhY2Vyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE2LCBzdHI6IDE1LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2F1bnRsZXRzIG9mIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMjIsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgQW5uaWhpbGF0aW9uXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMzUsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTYWNyaWZpY2lhbCBHYXVudGxldHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxOSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkZsYW1lZ3VhcmQgR2F1bnRsZXRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDEsIGFwOiA1NH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFZGdlbWFzdGVyJ3MgSGFuZGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHsgYXhlU2tpbGw6IDcsIGRhZ2dlclNraWxsOiA3LCBzd29yZFNraWxsOiA3IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJBZ2VkIENvcmUgTGVhdGhlciBHbG92ZXNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7IHN0cjogMTUsIGNyaXQ6IDEsIGRhZ2dlclNraWxsOiA1IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEZXZpbHNhdXIgR2F1bnRsZXRzICgrIDIgaGl0KVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDI4LCBjcml0OiAxLCBoaXQ6IDIgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVsZHJpdGNoIFJlaW5mb3JjZWQgTGVncGxhdGVzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7IHN0cjogMTUsIGFnaTogOSwgY3JpdDogMSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQWJ5c3NhbCBTdHJpa2luZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5MRUdTLFxuICAgICAgICBzdGF0czogeyBzdHI6IDE1LCBhZ2k6IDE1LCBjcml0OiAxIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDbG91ZGtlZXBlciBMZWdwbGF0ZXNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHsgc3RyOiAyMCwgYWdpOiAyMCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRGV2aWxzYXVyIExlZ2dpbmdzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7IGFwOiA0NiwgY3JpdDogMSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU2NhbGVkIFNhbmQgUmVhdmVyIExlZ2dpbmdzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7IGFwOiA2MiwgY3JpdDogMiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxvb2RtYWlsIEJvb3RzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogOSwgc3RyOiA5LCBoaXQ6IDEgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhdHRsZWNoYXNlcidzIEdyZWF2ZXNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHsgc3RyOiAxNCwgYWdpOiAxMyB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxvb2RkcmVuY2hlZCBGb290cGFkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czogeyBoaXQ6IDEsIGFnaTogMjEgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9tb2trJ3MgR2lydGggUmVzdHJhaW5lclwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XQUlTVCxcbiAgICAgICAgc3RhdHM6IHtjcml0OiAxLCBzdHI6IDE1fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJyaWdhbSBHaXJkbGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV0FJU1QsXG4gICAgICAgIHN0YXRzOiB7aGl0OiAxLCBzdHI6IDE1fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9uc2xhdWdodCBHaXJkbGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV0FJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdpcmRsZSBvZiB0aGUgTWVudG9yXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldBSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjEsIGFnaTogMjAsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCZWx0IG9mIFByZXNlcnZlZCBIZWFkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XQUlTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDE0LCBhZ2k6IDE1LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVGl0YW5pYyBMZWdnaW5nc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5MRUdTLFxuICAgICAgICBzdGF0czoge3N0cjogMzAsIGNyaXQ6IDEsIGhpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJMZWdwbGF0ZXMgb2YgQ2FybmFnZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5MRUdTLFxuICAgICAgICBzdGF0czoge3N0cjogNDIsIGNyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgTGVnZ3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7YWdpOiAyMSwgc3RyOiAzMywgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkxlZ2d1YXJkcyBvZiB0aGUgRmFsbGVuIENydXNhZGVyXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyOCwgYWdpOiAyMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbG9vZHNvYWtlZCBMZWdwbGF0ZXNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDM2fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJhbmsgMTAgTGVnZ2luZ3NcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDEyLCBjcml0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJvb3RzIG9mIHRoZSBGYWxsZW4gSGVyb1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTQsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWMgQm9vdHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDIwLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmFuayAxMCBCb290c1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMTAsIGFnaTogOX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCb290cyBvZiB0aGUgU2hhZG93IEZsYW1lXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7YXA6IDQ0LCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3RyaWtlcidzIE1hcmtcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUkFOR0VELFxuICAgICAgICBzdGF0czoge2FwOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNhdHlyJ3MgQm93XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJBTkdFRCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDMsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDcm9zc2JvdyBvZiBJbW1pbmVudCBEb29tXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJBTkdFRCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDcsIHN0cjogNSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk5lcnViaWFuIFNsYXZlbWFrZXJcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUkFOR0VELFxuICAgICAgICBzdGF0czoge2FwOiAyNCwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbG9vZHNlZWtlclwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SQU5HRUQsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA4LCBhZ2k6IDd9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR3VydWJhc2hpIER3YXJmIERlc3Ryb3llclwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SQU5HRUQsXG4gICAgICAgIHN0YXRzOiB7YXA6IDMwfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkxhcnZhZSBvZiB0aGUgR3JlYXQgV29ybVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SQU5HRUQsXG4gICAgICAgIHN0YXRzOiB7YXA6IDE4LCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNlYWwgb2YgSmluXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge2FwOiAyMCwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYW5kIG9mIEppbiAoKzMwIGFwKVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE0LCBoaXQ6IDEsIGFwOiAzMH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUYXJuaXNoZWQgRWx2ZW4gUmluZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE1LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFnbmkncyBXaWxsXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge3N0cjogNiwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJRdWljayBTdHJpa2UgUmluZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthcDogMzAsIGNyaXQ6IDEsIHN0cjogNX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaXJjbGUgb2YgQXBwbGllZCBGb3JjZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHtzdHI6IDEyLCBhZ2k6IDIyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJpbmcgb2YgdGhlIFFpcmFqaSBGdXJ5XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge2FwOiA0MCwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNYXN0ZXIgRHJhZ29uc2xheWVyJ3MgUmluZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthcDogNDgsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEb24gSnVsaW8ncyBCYW5kXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDEsIGhpdDogMSwgYXA6IDE2fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhbmQgb2YgVW5uYXR1cmFsIEZvcmNlc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHtjcml0OiAxLCBoaXQ6IDEsIGFwOiA1Mn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGFjayBEcmFnb25zY2FsZSBTaG91bGRlcnMgKHNldCBib251cylcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7IGFwOiA0NSwgY3JpdDogMiwgaGl0OiAxIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbG9vZHNvYWtlZCBQYXVsZHJvbnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogMTEsIHN0cjogMTYgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFieXNzYWwgU2hvdWxkZXJzIFN0cmlraW5nXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czogeyBhZ2k6IDEzLCBzdHI6IDEzLCBoaXQ6IDEgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsYWNrIERyYWdvbnNjYWxlIExlZ2dpbmdzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7IGFwOiA1NCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxhY2sgRHJhZ29uc2NhbGUgQm9vdHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXJnb3lsZSBTbGFzaGVyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHsgYWdpOiA1LCBzdHI6IDEwLCBjcml0OiAxIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJQYWlud2VhdmVyIEJhbmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAxNiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVmFtYnJhY2VzIG9mIHRoZSBTYWRpc3RcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV1JJU1QsXG4gICAgICAgIHN0YXRzOiB7IHN0cjogNiwgY3JpdDogMSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiV3Jpc3RndWFyZHMgb2YgU3RhYmlsaXR5XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czogeyBzdHI6IDI0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCZXJzZXJrZXIgQnJhY2Vyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHsgc3RyOiAxOSwgYWdpOiA4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJaYW5kYWxhciBWaW5kaWNhdG9yJ3MgQXJtZ3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czogeyBzdHI6IDEzLCBhZ2k6IDEzIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYXR0bGVib3JuIEFybWJyYWNlc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHsgaGl0OiAxLCBjcml0OiAxIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTaW1wbGUgU3dvcmQgKDIuNilcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxNDAsXG4gICAgICAgIG1heDogMTYwLFxuICAgICAgICBzcGVlZDogMi42LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNpbXBsZSBTd29yZCAoMS44KVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDUwLFxuICAgICAgICBtYXg6IDYwLFxuICAgICAgICBzcGVlZDogMS44LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlZpcydrYWcgdGhlIEJsb29kbGV0dGVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTAwLFxuICAgICAgICBtYXg6IDE4NyxcbiAgICAgICAgc3BlZWQ6IDIuNixcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBJdGVtU3BlbGxEYW1hZ2UoXCJGYXRhbCBXb3VuZHNcIiwgMjQwLCBFZmZlY3RUeXBlLlBIWVNJQ0FMKSwge3BwbTogMC42fSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTcGluZXNoYXR0ZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiA5OSxcbiAgICAgICAgbWF4OiAxODQsXG4gICAgICAgIHNwZWVkOiAyLjYsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA5fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNocm9tYXRpY2FsbHkgVGVtcGVyZWQgU3dvcmRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDYsXG4gICAgICAgIG1heDogMTk4LFxuICAgICAgICBzcGVlZDogMi42LFxuICAgICAgICBzdGF0czogeyBhZ2k6IDE0LCBzdHI6IDE0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNYWxhZGF0aCwgUnVuZWQgQmxhZGUgb2YgdGhlIEJsYWNrIEZsaWdodFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDg2LFxuICAgICAgICBtYXg6IDE2MixcbiAgICAgICAgc3BlZWQ6IDIuMixcbiAgICAgICAgc3RhdHM6IHsgc3dvcmRTa2lsbDogNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFsYWRhdGggKG5vIHNraWxsKVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDg2LFxuICAgICAgICBtYXg6IDE2MixcbiAgICAgICAgc3BlZWQ6IDIuMlxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJhdmVuY3Jlc3QncyBMZWdhY3lcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4NCxcbiAgICAgICAgbWF4OiAxNTcsXG4gICAgICAgIHNwZWVkOiAyLjEsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogOSwgc3RyOiAxMyB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQW5jaWVudCBRaXJhamkgUmlwcGVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTE0LFxuICAgICAgICBtYXg6IDIxMyxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDIwIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJJYmxpcywgQmxhZGUgb2YgdGhlIEZhbGxlbiBTZXJhcGhcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA3MCxcbiAgICAgICAgbWF4OiAxMzEsXG4gICAgICAgIHNwZWVkOiAxLjYsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGhpdDogMSwgYXA6IDI2IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHcmVzc2lsLCBEYXduIG9mIFJ1aW5cIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjU3LFxuICAgICAgICBzcGVlZDogMi43LFxuICAgICAgICBzdGF0czogeyBhcDogNDAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRoZSBIdW5nZXJpbmcgQ29sZFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDc2LFxuICAgICAgICBtYXg6IDE0MyxcbiAgICAgICAgc3BlZWQ6IDEuNSxcbiAgICAgICAgc3RhdHM6IHsgc3dvcmRTa2lsbDogNiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiV2FyYmxhZGUgb2YgdGhlIEhha2thcmlcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogNTksXG4gICAgICAgIG1heDogMTEwLFxuICAgICAgICBzcGVlZDogMS43LFxuICAgICAgICBzdGF0czogeyBzd29yZFNraWxsOiA2LCBhcDogMjgsIGNyaXQ6IDEgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIldhcmJsYWRlIG9mIHRoZSBIYWtrYXJpXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNTcsXG4gICAgICAgIG1heDogMTA2LFxuICAgICAgICBzcGVlZDogMS43LFxuICAgICAgICBzdGF0czogeyBhcDogNDAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBNYWNlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBMb25nc3dvcmRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBTd2lmdGJsYWRlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODUsXG4gICAgICAgIG1heDogMTI5LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhhdGNoZXQgb2YgU3VuZGVyZWQgQm9uZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMTksXG4gICAgICAgIG1heDogMjIxLFxuICAgICAgICBzcGVlZDogMi42LFxuICAgICAgICBzdGF0czogeyBhcDogMzYsIGNyaXQ6IDEgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBBeGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2VkIFFpcmFqaSBXYXIgQXhlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExMCxcbiAgICAgICAgbWF4OiAyMDUsXG4gICAgICAgIHNwZWVkOiAyLjYwLFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMTQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNydWwnc2hvcnVraCwgRWRnZSBvZiBDaGFvc1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDEsXG4gICAgICAgIG1heDogMTg4LFxuICAgICAgICBzcGVlZDogMi4zMCxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDM2IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEZWF0aGJyaW5nZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTE0LFxuICAgICAgICBtYXg6IDIxMyxcbiAgICAgICAgc3BlZWQ6IDIuOTAsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxEYW1hZ2UoXCJTaGFkb3cgQm9sdFwiLCBbMTEwLCAxNDFdLCBFZmZlY3RUeXBlLk1BR0lDKSwge3BwbTogMC44MjB9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRvb20ncyBFZGdlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDgzLFxuICAgICAgICBtYXg6IDE1NCxcbiAgICAgICAgc3BlZWQ6IDIuMzAsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogMTYsIHN0cjogOSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQXhlIG9mIHRoZSBEZWVwIFdvb2RzXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiA3OCxcbiAgICAgICAgbWF4OiAxNDYsXG4gICAgICAgIHNwZWVkOiAyLjcsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxEYW1hZ2UoXCJXcmF0aFwiLCBbOTAsIDEyN10sIEVmZmVjdFR5cGUuTUFHSUMpLCB7cHBtOiAwLjgyMH0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiWnVsaWFuIEhhY2tlciAobm8gcmF3IHN0YXRzKVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA3MSxcbiAgICAgICAgbWF4OiAxMzQsXG4gICAgICAgIHNwZWVkOiAyLjQwLFxuICAgICAgICBzdGF0czogeyBheGVTa2lsbDogMiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUml2ZW5zcGlrZSAobm8gcHJvYylcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNzcsXG4gICAgICAgIG1heDogMTQ0LFxuICAgICAgICBzcGVlZDogMi45MFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1pcmFoJ3MgU29uZ1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDU3LFxuICAgICAgICBtYXg6IDg3LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBhZ2k6IDksIHN0cjogOSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWlyYWgncyBTb25nIFNsb3dcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA2NyxcbiAgICAgICAgbWF4OiAxMjUsXG4gICAgICAgIHNwZWVkOiAyLjQsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogOSwgc3RyOiA5IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNaXJhaCdzIFNvbmcgd2l0aCBza2lsbFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDU3LFxuICAgICAgICBtYXg6IDg3LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBhZ2k6IDksIHN0cjogOSwgc3dvcmRTa2lsbDogNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFzcyBvZiBNY0dvd2FuXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogODAsXG4gICAgICAgIG1heDogMTQ5LFxuICAgICAgICBzcGVlZDogMi44LFxuICAgICAgICBzdGF0czogeyBzdHI6IDEwIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTdG9ybXN0cmlrZSBIYW1tZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDgwLFxuICAgICAgICBtYXg6IDE1MCxcbiAgICAgICAgc3BlZWQ6IDIuNyxcbiAgICAgICAgc3RhdHM6IHsgc3RyOiAxNSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRGFsJ1JlbmQncyBTYWNyZWQgQ2hhcmdlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDgxLFxuICAgICAgICBtYXg6IDE1MSxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgc3RhdHM6IHsgc3RyOiA0LCBjcml0OiAxIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEYWwnUmVuZCdzIFRyaWJhbCBHYXVyZGlhblwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDUyLFxuICAgICAgICBtYXg6IDk3LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBhcDogNTAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJydXRhbGl0eSBCbGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDkwLFxuICAgICAgICBtYXg6IDE2OCxcbiAgICAgICAgc3BlZWQ6IDIuNSxcbiAgICAgICAgc3RhdHM6IHsgc3RyOiA5LCBhZ2k6IDksIGNyaXQ6IDEgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlN3b3JkIG9mIFplYWxcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogODEsXG4gICAgICAgIG1heDogMTUxLFxuICAgICAgICBzcGVlZDogMi44LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIlplYWxcIiwgMTUsIHtwbHVzRGFtYWdlOiAxMH0pKSx7cHBtOiAxLjh9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlN3b3JkIG9mIFplYWwgTm8gUHJvY1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiA4MSxcbiAgICAgICAgbWF4OiAxNTEsXG4gICAgICAgIHNwZWVkOiAyLjhcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTd29yZCBvZiBaZWFsIEluc2FuZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiA4MSxcbiAgICAgICAgbWF4OiAxNTEsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiWmVhbFwiLCAxNSwge3BsdXNEYW1hZ2U6IDEwMDB9KSkse3BwbTogMS44fSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJLaW5nc2ZhbGxcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5EQUdHRVIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTA1LFxuICAgICAgICBtYXg6IDE1OCxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgYWdpOiAxNiwgY3JpdDogMSwgaGl0OiAxIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJIYXJiaW5nZXIgb2YgRG9vbVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkRBR0dFUixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4MyxcbiAgICAgICAgbWF4OiAxMjYsXG4gICAgICAgIHNwZWVkOiAxLjYsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogOCwgY3JpdDogMSwgaGl0OiAxIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEZWF0aCdzIFN0aW5nXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuREFHR0VSLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDk1LFxuICAgICAgICBtYXg6IDE0NCxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDM4LCBkYWdnZXJTa2lsbDogMyB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3NlZCBRaXJhamkgUHVnaW9cIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5EQUdHRVIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNzIsXG4gICAgICAgIG1heDogMTM0LFxuICAgICAgICBzcGVlZDogMS43LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBoaXQ6IDEsIGFwOiAxOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRmVsc3RyaWtlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkRBR0dFUixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA1NCxcbiAgICAgICAgbWF4OiAxMDEsXG4gICAgICAgIHNwZWVkOiAxLjcsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiRmVsc3RyaWtlclwiLCAzLCB7Y3JpdDogMTAwLCBoaXQ6IDEwMH0pKSx7cHBtOiAxLjR9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIG9udXNlOiAoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW5zaWdodE9mVGhlUWlyYWppID0gbmV3IEJ1ZmYoXCJJbnNpZ2h0IG9mIHRoZSBRaXJhamlcIiwgMzAsIHthcm1vclBlbmV0cmF0aW9uOiAyMDB9LCB0cnVlLCAwLCA2KTtcbiAgICAgICAgICAgIGNvbnN0IGJhZGdlQnVmZiA9IG5ldyBTcGVsbEJ1ZmYoXG4gICAgICAgICAgICAgICAgbmV3IEJ1ZmZQcm9jKFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIiwgMzAsXG4gICAgICAgICAgICAgICAgICAgIG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYoaW5zaWdodE9mVGhlUWlyYWppKSwge3BwbTogMTV9KSxcbiAgICAgICAgICAgICAgICAgICAgaW5zaWdodE9mVGhlUWlyYWppKSxcbiAgICAgICAgICAgICAgICBmYWxzZSwgMCwgMyAqIDYwKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGJhZGdlQnVmZjtcbiAgICAgICAgfSkoKVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIktpc3Mgb2YgdGhlIFNwaWRlclwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDEsIGhpdDogMX0sXG4gICAgICAgIG9udXNlOiBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiS2lzcyBvZiB0aGUgU3BpZGVyXCIsIDE1LCB7aGFzdGU6IDEuMn0pLCBmYWxzZSwgMCwgMiAqIDYwKSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTbGF5ZXIncyBDcmVzdFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiA2NH0sXG4gICAgICAgIG9udXNlOiBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiU2xheWVyJ3MgQ3Jlc3RcIiwgMjAsIHthcDogMjYwfSksIGZhbHNlLCAwLCAyICogNjApLFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRpYW1vbmQgRmxhc2tcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgb251c2U6IG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJEaWFtb25kIEZsYXNrXCIsIDYwLCB7c3RyOiA3NX0pLCB0cnVlLCAwLCA2ICogNjApLFxuICAgIH0sXG5dO1xuIiwiaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4uL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBGYWN0aW9uIH0gZnJvbSBcIi4uL3BsYXllci5qc1wiO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVmZkRlc2NyaXB0aW9uIHtcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgZHVyYXRpb246IG51bWJlcixcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG4gICAgZmFjdGlvbj86IEZhY3Rpb24sXG4gICAgZGlzYWJsZWQ/OiBib29sZWFuLFxufVxuXG5leHBvcnQgY29uc3QgYnVmZnM6IEJ1ZmZEZXNjcmlwdGlvbltdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYXR0bGUgU2hvdXRcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyOTBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdpZnQgb2YgdGhlIFdpbGRcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAxNiwgLy8gVE9ETyAtIHNob3VsZCBpdCBiZSAxMiAqIDEuMzU/ICh0YWxlbnQpXG4gICAgICAgICAgICBhZ2k6IDE2XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUcnVlc2hvdCBBdXJhXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAxMDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzaW5nIG9mIEtpbmdzXCIsXG4gICAgICAgIGZhY3Rpb246IEZhY3Rpb24uQUxMSUFOQ0UsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RhdE11bHQ6IDEuMVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3Npbmcgb2YgTWlnaHRcIixcbiAgICAgICAgZmFjdGlvbjogRmFjdGlvbi5BTExJQU5DRSxcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjIyXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTdHJlbmd0aCBvZiBFYXJ0aFwiLFxuICAgICAgICBmYWN0aW9uOiBGYWN0aW9uLkhPUkRFLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogNzcgKiAxLjE1IC8vIGFzc3VtaW5nIGVuaGFuY2luZyB0b3RlbXNcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdyYWNlIG9mIEFpclwiLFxuICAgICAgICBmYWN0aW9uOiBGYWN0aW9uLkhPUkRFLFxuICAgICAgICBkaXNhYmxlZDogdHJ1ZSxcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhZ2k6IDc3ICogMS4xNSAvLyBhc3N1bWluZyBlbmhhbmNpbmcgdG90ZW1zXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTbW9rZWQgRGVzZXJ0IER1bXBsaW5nc1wiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgUG93ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDMwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDMwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJKdWp1IE1pZ2h0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAxMCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDQwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFbGl4aXIgb2YgdGhlIE1vbmdvb3NlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFnaTogMjUsXG4gICAgICAgICAgICBjcml0OiAyXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSLk8uSS5ELlMuXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJhbGx5aW5nIENyeSBvZiB0aGUgRHJhZ29uc2xheWVyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAxNDAsXG4gICAgICAgICAgICBjcml0OiA1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTb25nZmxvd2VyIFNlcmFuYWRlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGNyaXQ6IDUsXG4gICAgICAgICAgICBzdHI6IDE1LFxuICAgICAgICAgICAgYWdpOiAxNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3Bpcml0IG9mIFphbmRhbGFyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0YXRNdWx0OiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJGZW5ndXMnIEZlcm9jaXR5XCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyMDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIldhcmNoaWVmJ3MgQmxlc3NpbmdcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgaGFzdGU6IDEuMTVcbiAgICAgICAgfVxuICAgIH1cbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCdWZmRnJvbURlc2NyaXB0aW9uKGRlc2M6IEJ1ZmZEZXNjcmlwdGlvbikge1xuICAgIHJldHVybiBuZXcgQnVmZihkZXNjLm5hbWUsIGRlc2MuZHVyYXRpb24sIGRlc2Muc3RhdHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnVmZihuYW1lOiBzdHJpbmcpIHtcbiAgICBmb3IgKGxldCBidWZmIG9mIGJ1ZmZzKSB7XG4gICAgICAgIGlmIChidWZmLm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRCdWZmRnJvbURlc2NyaXB0aW9uKGJ1ZmYpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmT3ZlclRpbWUgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgV2FycmlvciB9IGZyb20gXCIuL3dhcnJpb3IuanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgRW5jaGFudERlc2NyaXB0aW9uLCB0ZW1wb3JhcnlFbmNoYW50cywgZW5jaGFudHMgfSBmcm9tIFwiLi9kYXRhL2VuY2hhbnRzLmpzXCI7XG5pbXBvcnQgeyBpdGVtcyB9IGZyb20gXCIuL2RhdGEvaXRlbXMuanNcIjtcbmltcG9ydCB7IGJ1ZmZzLCBCdWZmRGVzY3JpcHRpb24gfSBmcm9tIFwiLi9kYXRhL3NwZWxscy5qc1wiO1xuaW1wb3J0IHsgTW9kaWZ5UG93ZXJFZmZlY3QgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNpbXVsYXRpb25EZXNjcmlwdGlvbiB7XG4gICAgcmFjZTogUmFjZSxcbiAgICBzdGF0czogU3RhdFZhbHVlcyxcbiAgICBlcXVpcG1lbnQ6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPixcbiAgICBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBudW1iZXI+LFxuICAgIHRlbXBvcmFyeUVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4sXG4gICAgYnVmZnM6IG51bWJlcltdLFxuICAgIGZpZ2h0TGVuZ3RoOiBudW1iZXIsXG4gICAgcmVhbHRpbWU6IGJvb2xlYW4sXG4gICAgdXNlUmVja2xlc3NuZXNzOiBib29sZWFuLFxuICAgIGhlcm9pY1N0cmlrZVJhZ2VSZXE6IG51bWJlcixcbiAgICBoYW1zdHJpbmdSYWdlUmVxOiBudW1iZXIsXG4gICAgZXhlY3V0ZU1pZ2h0eVJhZ2U6IGJvb2xlYW4sXG4gICAgbWlnaHR5UmFnZVJhZ2VSZXE6IG51bWJlcixcbiAgICBibG9vZHRoaXJzdEV4ZWNSYWdlTWluOiBudW1iZXIsXG4gICAgYmxvb2R0aGlyc3RFeGVjUmFnZU1heDogbnVtYmVyLFxuICAgIGhlcm9pY1N0cmlrZUluRXhlY3V0ZTogYm9vbGVhbixcbiAgICB1c2VIZXJvaWNTdHJpa2VSOTogYm9vbGVhbixcbiAgICB2YWVsOiBib29sZWFuLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBQbGF5ZXIocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24+LCBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCB0ZW1wb3JhcnlFbmNoYW50OiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIGJ1ZmZzOiBCdWZmRGVzY3JpcHRpb25bXSwgdmFlbCA9IGZhbHNlLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgIGNvbnN0IHBsYXllciA9IG5ldyBXYXJyaW9yKHJhY2UsIHN0YXRzLCBsb2cpO1xuXG4gICAgZm9yIChsZXQgW3Nsb3QsIGl0ZW1dIG9mIGVxdWlwbWVudCkge1xuICAgICAgICBwbGF5ZXIuZXF1aXAoc2xvdCwgaXRlbSwgZW5jaGFudHMuZ2V0KHNsb3QpLCB0ZW1wb3JhcnlFbmNoYW50LmdldChzbG90KSk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgYnVmZiBvZiBidWZmcykge1xuICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKG5ldyBCdWZmKGJ1ZmYubmFtZSwgYnVmZi5kdXJhdGlvbiwgYnVmZi5zdGF0cyksIC0xMCAqIDEwMDApO1xuICAgIH1cblxuICAgIGlmICh2YWVsKSB7XG4gICAgICAgIGNvbnN0IGVzc2VuY2VPZlRoZVJlZCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJFc3NlbmNlIG9mIHRoZSBSZWRcIiwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIHVuZGVmaW5lZCwgMTAwMCwgbmV3IE1vZGlmeVBvd2VyRWZmZWN0KDIwKSk7XG4gICAgICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoZXNzZW5jZU9mVGhlUmVkLCBNYXRoLnJhbmRvbSgpICogLTEwMDApOyAvLyByYW5kb21pemluZyBhbmdlciBtYW5hZ2VtZW50IHRpbWluZ1xuICAgIH1cblxuICAgIC8vIGNvbnN0IGJvc3MgPSBuZXcgVW5pdCg2MywgNDY5MSAtIDIyNTAgLSA2NDAgLSA1MDUgLSA2MDApOyAvLyBzdW5kZXIsIGNvciwgZmYsIGFubmloXG4gICAgY29uc3QgYm9zcyA9IG5ldyBVbml0KDYzLCAzNzAwIC0gMjI1MCAtIDY0MCAtIDUwNSk7IC8vIHN1bmRlciwgY29yLCBmZiwgYW5uaWhcbiAgICBwbGF5ZXIudGFyZ2V0ID0gYm9zcztcblxuICAgIGlmIChwbGF5ZXIubWggJiYgcGxheWVyLm9oICYmIHBsYXllci5taC53ZWFwb24uc3BlZWQgPT09IHBsYXllci5vaC53ZWFwb24uc3BlZWQpIHtcbiAgICAgICAgcGxheWVyLm9oLm5leHRTd2luZ1RpbWUgKz0gcGxheWVyLm9oLndlYXBvbi5zcGVlZCAvIDIgKiAxMDAwO1xuICAgIH1cblxuICAgIHJldHVybiBwbGF5ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBNYXA8SyxWPihzbG90VG9JbmRleDogTWFwPEssIG51bWJlcj4sIGxvb2t1cDogVltdKTogTWFwPEssIFY+IHtcbiAgICBjb25zdCByZXMgPSBuZXcgTWFwPEssVj4oKTtcblxuICAgIGZvciAobGV0IFtzbG90LCBpZHhdIG9mIHNsb3RUb0luZGV4KSB7XG4gICAgICAgIGlmIChsb29rdXBbaWR4XSkge1xuICAgICAgICAgICAgcmVzLnNldChzbG90LCBsb29rdXBbaWR4XSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnYmFkIGluZGV4JywgaWR4LCBsb29rdXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cEFycmF5PFY+KGluZGljZXM6IG51bWJlcltdLCBsb29rdXA6IFZbXSk6IFZbXSB7XG4gICAgY29uc3QgcmVzOiBWW10gPSBbXTtcblxuICAgIGZvciAobGV0IGlkeCBvZiBpbmRpY2VzKSB7XG4gICAgICAgIGlmIChsb29rdXBbaWR4XSkge1xuICAgICAgICAgICAgcmVzLnB1c2gobG9va3VwW2lkeF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2JhZCBpbmRleCcsIGlkeCwgbG9va3VwKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwSXRlbXMobWFwOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4pIHtcbiAgICByZXR1cm4gbG9va3VwTWFwKG1hcCwgaXRlbXMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwRW5jaGFudHMobWFwOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4pIHtcbiAgICByZXR1cm4gbG9va3VwTWFwKG1hcCwgZW5jaGFudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwVGVtcG9yYXJ5RW5jaGFudHMobWFwOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4pIHtcbiAgICByZXR1cm4gbG9va3VwTWFwKG1hcCwgdGVtcG9yYXJ5RW5jaGFudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwQnVmZnMoaW5kaWNlczogbnVtYmVyW10pIHtcbiAgICByZXR1cm4gbG9va3VwQXJyYXkoaW5kaWNlcywgYnVmZnMpO1xufVxuIiwiaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgSXRlbURlc2NyaXB0aW9uLCBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uLCBQbGF5ZXIsIFJhY2UsIERhbWFnZUxvZywgSGl0T3V0Y29tZVN0YXRzIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBzZXR1cFBsYXllciB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcbmltcG9ydCB7IEVuY2hhbnREZXNjcmlwdGlvbiB9IGZyb20gXCIuL2RhdGEvZW5jaGFudHMuanNcIjtcbmltcG9ydCB7IEJ1ZmZEZXNjcmlwdGlvbiB9IGZyb20gXCIuL2RhdGEvc3BlbGxzLmpzXCI7XG5cbmV4cG9ydCB0eXBlIEl0ZW1XaXRoU2xvdCA9IFtJdGVtRGVzY3JpcHRpb24sIEl0ZW1TbG90XTtcblxuLy8gVE9ETyAtIGNoYW5nZSB0aGlzIGludGVyZmFjZSBzbyB0aGF0IENob29zZUFjdGlvbiBjYW5ub3Qgc2NyZXcgdXAgdGhlIHNpbSBvciBjaGVhdFxuLy8gZS5nLiBDaG9vc2VBY3Rpb24gc2hvdWxkbid0IGNhc3Qgc3BlbGxzIGF0IGEgY3VycmVudCB0aW1lXG5leHBvcnQgdHlwZSBDaG9vc2VBY3Rpb24gPSAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlciwgY2FuRXhlY3V0ZTogYm9vbGVhbikgPT4gbnVtYmVyO1xuXG5jbGFzcyBGaWdodCB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG4gICAgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb247XG4gICAgZmlnaHRMZW5ndGg6IG51bWJlcjtcbiAgICBiZWdpbkV4ZWN1dGVUaW1lOiBudW1iZXI7XG4gICAgZHVyYXRpb24gPSAwO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24+LCBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCB0ZW1wb3JhcnlFbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCBidWZmczogQnVmZkRlc2NyaXB0aW9uW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCB2YWVsID0gZmFsc2UsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHRoaXMucGxheWVyID0gc2V0dXBQbGF5ZXIocmFjZSwgc3RhdHMsIGVxdWlwbWVudCwgZW5jaGFudHMsIHRlbXBvcmFyeUVuY2hhbnRzLCBidWZmcywgdmFlbCwgbG9nKTtcbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24gPSBjaG9vc2VBY3Rpb247XG4gICAgICAgIHRoaXMuZmlnaHRMZW5ndGggPSAoZmlnaHRMZW5ndGggKyBNYXRoLnJhbmRvbSgpICogNCAtIDIpICogMTAwMDtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IEVYRUNVVEVfUEhBU0VfUkFUSU8gPSAwLjE1OyAvLyBsYXN0IDE1JSBvZiB0aGUgdGltZSBpcyBleGVjdXRlIHBoYXNlXG4gICAgICAgIGNvbnN0IFZBRUxfRVhFQ1VURV9QSEFTRV9SQVRJTyA9IDAuNTsgLy8gbGFzdCA1MCUgb2YgdGhlIHRpbWUgaXMgZXhlY3V0ZSBwaGFzZVxuXG4gICAgICAgIHRoaXMuYmVnaW5FeGVjdXRlVGltZSA9IHRoaXMuZmlnaHRMZW5ndGggKiAoMSAtICh2YWVsID8gVkFFTF9FWEVDVVRFX1BIQVNFX1JBVElPIDogRVhFQ1VURV9QSEFTRV9SQVRJTykpO1xuICAgIH1cblxuICAgIHJ1bigpOiBQcm9taXNlPEZpZ2h0UmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZiwgcikgPT4ge1xuICAgICAgICAgICAgd2hpbGUgKHRoaXMuZHVyYXRpb24gPD0gdGhpcy5maWdodExlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLnJlbW92ZUFsbEJ1ZmZzKHRoaXMuZmlnaHRMZW5ndGgpO1xuXG4gICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICBkYW1hZ2VMb2c6IHRoaXMucGxheWVyLmRhbWFnZUxvZyxcbiAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogdGhpcy5maWdodExlbmd0aCxcbiAgICAgICAgICAgICAgICBiZWdpbkV4ZWN1dGVUaW1lOiB0aGlzLmJlZ2luRXhlY3V0ZVRpbWUsXG4gICAgICAgICAgICAgICAgcG93ZXJMb3N0OiB0aGlzLnBsYXllci5wb3dlckxvc3QsXG4gICAgICAgICAgICAgICAgYnVmZlVwdGltZTogdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIuYnVmZlVwdGltZU1hcCxcbiAgICAgICAgICAgICAgICBoaXRTdGF0czogdGhpcy5wbGF5ZXIuaGl0U3RhdHMsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UocGF1c2U6IGJvb2xlYW4pIHt9XG5cbiAgICBjYW5jZWwoKSB7fVxuXG4gICAgcHJvdGVjdGVkIHVwZGF0ZSgpIHtcbiAgICAgICAgY29uc3QgZnV0dXJlRXZlbnRzID0gdGhpcy5wbGF5ZXIuZnV0dXJlRXZlbnRzO1xuICAgICAgICB0aGlzLnBsYXllci5mdXR1cmVFdmVudHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgZnV0dXJlRXZlbnQgb2YgZnV0dXJlRXZlbnRzKSB7XG4gICAgICAgICAgICBpZiAoZnV0dXJlRXZlbnQudGltZSA9PT0gdGhpcy5kdXJhdGlvbikge1xuICAgICAgICAgICAgICAgIGZ1dHVyZUV2ZW50LmNhbGxiYWNrKHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5ZXIuZnV0dXJlRXZlbnRzLnB1c2goZnV0dXJlRXZlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNFeGVjdXRlUGhhc2UgPSB0aGlzLmR1cmF0aW9uID49IHRoaXMuYmVnaW5FeGVjdXRlVGltZTtcblxuICAgICAgICB0aGlzLnBsYXllci5idWZmTWFuYWdlci51cGRhdGUodGhpcy5kdXJhdGlvbik7IC8vIG5lZWQgdG8gY2FsbCB0aGlzIGlmIHRoZSBkdXJhdGlvbiBjaGFuZ2VkIGJlY2F1c2Ugb2YgYnVmZnMgdGhhdCBjaGFuZ2Ugb3ZlciB0aW1lIGxpa2Ugam9tIGdhYmJlclxuXG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uKHRoaXMucGxheWVyLCB0aGlzLmR1cmF0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCBpc0V4ZWN1dGVQaGFzZSk7IC8vIGNob29zZSBhY3Rpb24gYmVmb3JlIGluIGNhc2Ugb2YgYWN0aW9uIGRlcGVuZGluZyBvbiB0aW1lIG9mZiB0aGUgZ2NkIGxpa2UgZWFydGhzdHJpa2VcblxuICAgICAgICB0aGlzLnBsYXllci51cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgLy8gY2hvb3NlIGFjdGlvbiBhZnRlciBldmVyeSBzd2luZyB3aGljaCBjb3VsZCBiZSBhIHJhZ2UgZ2VuZXJhdGluZyBldmVudCwgYnV0IFRPRE86IG5lZWQgdG8gYWNjb3VudCBmb3IgbGF0ZW5jeSwgcmVhY3Rpb24gdGltZSAoYnV0dG9uIG1hc2hpbmcpXG4gICAgICAgIGNvbnN0IHdhaXRpbmdGb3JUaW1lID0gdGhpcy5jaG9vc2VBY3Rpb24odGhpcy5wbGF5ZXIsIHRoaXMuZHVyYXRpb24sIHRoaXMuZmlnaHRMZW5ndGgsIGlzRXhlY3V0ZVBoYXNlKTtcblxuICAgICAgICBsZXQgbmV4dFN3aW5nVGltZSA9IHRoaXMucGxheWVyLm1oIS5uZXh0U3dpbmdUaW1lO1xuXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5vaCkge1xuICAgICAgICAgICAgbmV4dFN3aW5nVGltZSA9IE1hdGgubWluKG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLm9oLm5leHRTd2luZ1RpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IGhhY2tcbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmV4dHJhQXR0YWNrQ291bnQpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IGluY3JlbWVudCBkdXJhdGlvbiAoVE9ETzogYnV0IEkgcmVhbGx5IHNob3VsZCBiZWNhdXNlIHRoZSBzZXJ2ZXIgZG9lc24ndCBsb29wIGluc3RhbnRseSlcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBsYXllci5uZXh0R0NEVGltZSA+IHRoaXMuZHVyYXRpb24pIHsgLy8gaWYgeW91IGhhdmUgbm8gYWN0aW9uIHRoaXMgZ2NkLCBjYW4ndCBrZWVwIGxvb3BpbmcgYXQgdGhlIHNhbWUgdGltZVxuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IE1hdGgubWluKHRoaXMucGxheWVyLm5leHRHQ0RUaW1lLCBuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5idWZmTWFuYWdlci5uZXh0T3ZlclRpbWVVcGRhdGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IE1hdGgubWluKG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLm5leHRPdmVyVGltZVVwZGF0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FpdGluZ0ZvclRpbWUgPCB0aGlzLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gd2FpdGluZ0ZvclRpbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzRXhlY3V0ZVBoYXNlICYmIHRoaXMuYmVnaW5FeGVjdXRlVGltZSA8IHRoaXMuZHVyYXRpb24pIHsgLy8gbm90IGV4ZWN1dGUgYXQgc3RhcnQgb2YgdXBkYXRlXG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gdGhpcy5iZWdpbkV4ZWN1dGVUaW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgZnV0dXJlRXZlbnQgb2YgdGhpcy5wbGF5ZXIuZnV0dXJlRXZlbnRzKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4odGhpcy5kdXJhdGlvbiwgZnV0dXJlRXZlbnQudGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIFJlYWx0aW1lRmlnaHQgZXh0ZW5kcyBGaWdodCB7XG4gICAgcHJvdGVjdGVkIHBhdXNlZCA9IGZhbHNlO1xuXG4gICAgcnVuKCk6IFByb21pc2U8RmlnaHRSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgTVNfUEVSX1VQREFURSA9IDEwMDAgLyA2MDtcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIGxldCBvdmVycmlkZUR1cmF0aW9uID0gMDtcblxuICAgICAgICAgICAgY29uc3QgbG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBvdmVycmlkZUR1cmF0aW9uICs9IE1TX1BFUl9VUERBVEU7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLmR1cmF0aW9uID0gb3ZlcnJpZGVEdXJhdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGxvb3AsIE1TX1BFUl9VUERBVEUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGYoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZGFtYWdlTG9nOiB0aGlzLnBsYXllci5kYW1hZ2VMb2csXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogdGhpcy5maWdodExlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlZ2luRXhlY3V0ZVRpbWU6IHRoaXMuYmVnaW5FeGVjdXRlVGltZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogdGhpcy5wbGF5ZXIucG93ZXJMb3N0LFxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZlVwdGltZTogbmV3IE1hcCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGl0U3RhdHM6IHRoaXMucGxheWVyLmhpdFN0YXRzLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGxvb3AsIE1TX1BFUl9VUERBVEUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwYXVzZShwYXVzZTogYm9vbGVhbikge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IHBhdXNlO1xuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgRmlnaHRSZXN1bHQgPSB7IGRhbWFnZUxvZzogRGFtYWdlTG9nLCBmaWdodExlbmd0aDogbnVtYmVyLCBiZWdpbkV4ZWN1dGVUaW1lOiBudW1iZXIsIHBvd2VyTG9zdDogbnVtYmVyLCBidWZmVXB0aW1lOiBNYXA8c3RyaW5nLCBudW1iZXI+LCBoaXRTdGF0czogTWFwPHN0cmluZywgSGl0T3V0Y29tZVN0YXRzPn07XG5cbmV4cG9ydCB0eXBlIFNpbXVsYXRpb25TdW1tYXJ5ID0ge1xuICAgIG5vcm1hbERhbWFnZTogbnVtYmVyLFxuICAgIGV4ZWNEYW1hZ2U6IG51bWJlcixcbiAgICBub3JtYWxEdXJhdGlvbjogbnVtYmVyLFxuICAgIGV4ZWNEdXJhdGlvbjogbnVtYmVyLFxuICAgIHBvd2VyTG9zdDogbnVtYmVyLFxuICAgIGZpZ2h0czogbnVtYmVyLFxuICAgIGJ1ZmZVcHRpbWU6IE1hcDxzdHJpbmcsIG51bWJlcj4sXG4gICAgaGl0U3RhdHM6IE1hcDxzdHJpbmcsIEhpdE91dGNvbWVTdGF0cz5cbn07XG5cbmV4cG9ydCB0eXBlIFN0YXR1c0hhbmRsZXIgPSAoc3RhdHVzOiBTaW11bGF0aW9uU3VtbWFyeSkgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIFNpbXVsYXRpb24ge1xuICAgIHJhY2U6IFJhY2U7XG4gICAgc3RhdHM6IFN0YXRWYWx1ZXM7XG4gICAgZXF1aXBtZW50OiBNYXA8SXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbj47XG4gICAgZW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPjtcbiAgICB0ZW1wb3JhcnlFbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+O1xuICAgIGJ1ZmZzOiBCdWZmRGVzY3JpcHRpb25bXTtcbiAgICBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbjtcbiAgICBwcm90ZWN0ZWQgZmlnaHRMZW5ndGg6IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgcmVhbHRpbWU6IGJvb2xlYW47XG4gICAgcHJvdGVjdGVkIHZhZWw6IGJvb2xlYW47XG4gICAgbG9nPzogTG9nRnVuY3Rpb25cblxuICAgIHByb3RlY3RlZCByZXF1ZXN0U3RvcCA9IGZhbHNlO1xuICAgIHByb3RlY3RlZCBfcGF1c2VkID0gZmFsc2U7XG5cbiAgICBmaWdodFJlc3VsdHM6IEZpZ2h0UmVzdWx0W10gPSBbXTtcblxuICAgIGN1cnJlbnRGaWdodD86IEZpZ2h0O1xuXG4gICAgcHJvdGVjdGVkIGNhY2hlZFN1bW1tYXJ5OiBTaW11bGF0aW9uU3VtbWFyeSA9IHsgbm9ybWFsRGFtYWdlOiAwLCBleGVjRGFtYWdlOiAwLCBub3JtYWxEdXJhdGlvbjogMCwgZXhlY0R1cmF0aW9uOiAwLCBwb3dlckxvc3Q6IDAsIGZpZ2h0czogMCwgYnVmZlVwdGltZTogbmV3IE1hcCgpLCBoaXRTdGF0czogbmV3IE1hcCgpIH07XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBNYXA8SXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbj4sIGVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIHRlbXBvcmFyeUVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIGJ1ZmZzOiBCdWZmRGVzY3JpcHRpb25bXSwgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb24sIGZpZ2h0TGVuZ3RoID0gNjAsIHJlYWx0aW1lID0gZmFsc2UsIHZhZWwgPSBmYWxzZSwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5yYWNlID0gcmFjZTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IHN0YXRzO1xuICAgICAgICB0aGlzLmVxdWlwbWVudCA9IGVxdWlwbWVudDtcbiAgICAgICAgdGhpcy5lbmNoYW50cyA9IGVuY2hhbnRzO1xuICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnRzID0gdGVtcG9yYXJ5RW5jaGFudHM7XG4gICAgICAgIHRoaXMuYnVmZnMgPSBidWZmcztcbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24gPSBjaG9vc2VBY3Rpb247XG4gICAgICAgIHRoaXMuZmlnaHRMZW5ndGggPSBmaWdodExlbmd0aDtcbiAgICAgICAgdGhpcy5yZWFsdGltZSA9IHJlYWx0aW1lO1xuICAgICAgICB0aGlzLnZhZWwgPSB2YWVsO1xuICAgICAgICB0aGlzLmxvZyA9IGxvZztcbiAgICB9XG5cbiAgICBnZXQgcGF1c2VkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGF1c2VkO1xuICAgIH1cblxuICAgIGdldCBzdGF0dXMoKTogU2ltdWxhdGlvblN1bW1hcnkge1xuICAgICAgICBmb3IgKGxldCBmaWdodFJlc3VsdCBvZiB0aGlzLmZpZ2h0UmVzdWx0cykge1xuICAgICAgICAgICAgZm9yIChsZXQgW3RpbWUsIGRhbWFnZV0gb2YgZmlnaHRSZXN1bHQuZGFtYWdlTG9nKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRpbWUgPj0gZmlnaHRSZXN1bHQuYmVnaW5FeGVjdXRlVGltZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRHVyYXRpb24gKz0gZmlnaHRSZXN1bHQuYmVnaW5FeGVjdXRlVGltZTtcbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkuZXhlY0R1cmF0aW9uICs9IGZpZ2h0UmVzdWx0LmZpZ2h0TGVuZ3RoIC0gZmlnaHRSZXN1bHQuYmVnaW5FeGVjdXRlVGltZTtcbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkucG93ZXJMb3N0ICs9IGZpZ2h0UmVzdWx0LnBvd2VyTG9zdDtcblxuICAgICAgICAgICAgZm9yIChsZXQgW2J1ZmYsIGR1cmF0aW9uXSBvZiBmaWdodFJlc3VsdC5idWZmVXB0aW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5idWZmVXB0aW1lLnNldChidWZmLCAodGhpcy5jYWNoZWRTdW1tbWFyeS5idWZmVXB0aW1lLmdldChidWZmKSB8fCAwKSArIGR1cmF0aW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgW2FiaWxpdHksIGhpdE91dENvbWVzXSBvZiBmaWdodFJlc3VsdC5oaXRTdGF0cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJBYmlsaXR5U3RhdHMgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmhpdFN0YXRzLmdldChhYmlsaXR5KTtcblxuICAgICAgICAgICAgICAgIGlmIChjdXJyQWJpbGl0eVN0YXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IE5VTV9ISVRfVFlQRVMgPSAxMDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBOVU1fSElUX1RZUEVTOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChjdXJyQWJpbGl0eVN0YXRzIGFzIGFueSlbaV0gKz0gKGhpdE91dENvbWVzIGFzIGFueSlbaV07IC8vIHVnbHlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkuaGl0U3RhdHMuc2V0KGFiaWxpdHksIGhpdE91dENvbWVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkuZmlnaHRzKys7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpZ2h0UmVzdWx0cyA9IFtdO1xuXG4gICAgICAgIGxldCBub3JtYWxEYW1hZ2UgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbERhbWFnZTtcbiAgICAgICAgbGV0IGV4ZWNEYW1hZ2UgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEYW1hZ2U7XG4gICAgICAgIGxldCBub3JtYWxEdXJhdGlvbiA9IHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRHVyYXRpb247XG4gICAgICAgIGxldCBleGVjRHVyYXRpb24gPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEdXJhdGlvbjtcbiAgICAgICAgbGV0IHBvd2VyTG9zdCA9IHRoaXMuY2FjaGVkU3VtbW1hcnkucG93ZXJMb3N0O1xuICAgICAgICBsZXQgZmlnaHRzID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5maWdodHM7XG5cbiAgICAgICAgaWYgKHRoaXMucmVhbHRpbWUgJiYgdGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IFt0aW1lLCBkYW1hZ2VdIG9mIHRoaXMuY3VycmVudEZpZ2h0LnBsYXllci5kYW1hZ2VMb2cpIHtcbiAgICAgICAgICAgICAgICBpZiAodGltZSA+PSB0aGlzLmN1cnJlbnRGaWdodC5iZWdpbkV4ZWN1dGVUaW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWNEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5vcm1hbERhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub3JtYWxEdXJhdGlvbiArPSBNYXRoLm1pbih0aGlzLmN1cnJlbnRGaWdodC5iZWdpbkV4ZWN1dGVUaW1lLCB0aGlzLmN1cnJlbnRGaWdodC5kdXJhdGlvbik7XG4gICAgICAgICAgICBleGVjRHVyYXRpb24gKz0gTWF0aC5tYXgoMCwgdGhpcy5jdXJyZW50RmlnaHQuZHVyYXRpb24gLSB0aGlzLmN1cnJlbnRGaWdodC5iZWdpbkV4ZWN1dGVUaW1lKTtcbiAgICAgICAgICAgIHBvd2VyTG9zdCArPSB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIucG93ZXJMb3N0O1xuICAgICAgICAgICAgZmlnaHRzKys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbm9ybWFsRGFtYWdlOiBub3JtYWxEYW1hZ2UsXG4gICAgICAgICAgICBleGVjRGFtYWdlOiBleGVjRGFtYWdlLFxuICAgICAgICAgICAgbm9ybWFsRHVyYXRpb246IG5vcm1hbER1cmF0aW9uLFxuICAgICAgICAgICAgZXhlY0R1cmF0aW9uOiBleGVjRHVyYXRpb24sXG4gICAgICAgICAgICBwb3dlckxvc3Q6IHBvd2VyTG9zdCxcbiAgICAgICAgICAgIGZpZ2h0czogZmlnaHRzLFxuICAgICAgICAgICAgYnVmZlVwdGltZTogdGhpcy5jYWNoZWRTdW1tbWFyeS5idWZmVXB0aW1lLFxuICAgICAgICAgICAgaGl0U3RhdHM6IHRoaXMuY2FjaGVkU3VtbW1hcnkuaGl0U3RhdHMsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGFydCgpIHtcbiAgICAgICAgY29uc3QgZmlnaHRDbGFzcyA9IHRoaXMucmVhbHRpbWUgPyBSZWFsdGltZUZpZ2h0IDogRmlnaHQ7XG5cbiAgICAgICAgY29uc3Qgb3V0ZXJsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChvdXRlcmxvb3AsIDEwMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgY291bnQgPSAwO1xuXG4gICAgICAgICAgICBjb25zdCBpbm5lcmxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGNvdW50ID4gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0ID0gbmV3IGZpZ2h0Q2xhc3ModGhpcy5yYWNlLCB0aGlzLnN0YXRzLCB0aGlzLmVxdWlwbWVudCwgdGhpcy5lbmNoYW50cywgdGhpcy50ZW1wb3JhcnlFbmNoYW50cywgdGhpcy5idWZmcywgdGhpcy5jaG9vc2VBY3Rpb24sIHRoaXMuZmlnaHRMZW5ndGgsIHRoaXMudmFlbCwgdGhpcy5yZWFsdGltZSA/IHRoaXMubG9nIDogdW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodC5ydW4oKS50aGVuKChyZXMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maWdodFJlc3VsdHMucHVzaChyZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICBpbm5lcmxvb3AoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoIXRoaXMucmVxdWVzdFN0b3ApIHtcbiAgICAgICAgICAgICAgICBpbm5lcmxvb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBvdXRlcmxvb3AoKTtcbiAgICB9XG5cbiAgICBwYXVzZShwYXVzZTogYm9vbGVhbnx1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHBhdXNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHBhdXNlID0gIXRoaXMucGF1c2VkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcGF1c2VkID0gcGF1c2U7XG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRGaWdodCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQucGF1c2UocGF1c2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RvcCgpIHtcbiAgICAgICAgdGhpcy5yZXF1ZXN0U3RvcCA9IHRydWU7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgV2FycmlvciB9IGZyb20gXCIuL3dhcnJpb3IuanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgU3BlbGxCdWZmIH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ2hvb3NlQWN0aW9uKHVzZVJlY2tsZXNzbmVzczogYm9vbGVhbiwgdXNlSGVyb2ljU3RyaWtlUjk6IGJvb2xlYW4sIGhlcm9pY1N0cmlrZVJhZ2VSZXE6IG51bWJlciwgaGFtc3RyaW5nUmFnZVJlcTogbnVtYmVyLCBibG9vZHRoaXJzdEV4ZWNSYWdlTWluOiBudW1iZXIsIGJsb29kdGhpcnN0RXhlY1JhZ2VNYXg6IG51bWJlciwgbWlnaHR5UmFnZUV4ZWN1dGU6IGJvb2xlYW4sIG1pZ2h0eVJhZ2VSYWdlUmVxOiBudW1iZXIsIGhlcm9pY1N0cmlrZUluRXhlY3V0ZTogYm9vbGVhbikge1xuICAgIHJldHVybiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlciwgZXhlY3V0ZVBoYXNlOiBib29sZWFuKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3Qgd2FycmlvciA9IDxXYXJyaW9yPnBsYXllcjtcbiAgICBcbiAgICAgICAgY29uc3QgdGltZVJlbWFpbmluZ1NlY29uZHMgPSAoZmlnaHRMZW5ndGggLSB0aW1lKSAvIDEwMDA7XG5cbiAgICAgICAgbGV0IHdhaXRpbmdGb3JUaW1lID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXG4gICAgICAgIC8vIFRPRE8gLSB3aGF0IGFib3V0IEdDRCBzcGVsbHMgd2hlcmUgeW91IHNob3VsZCBwb3AgdGhlbSBiZWZvcmUgZmlnaHQ/IGxpa2UgZGlhbW9uZCBmbGFzayBvbiB2YWVsXG4gICAgICAgIC8vIG5lZWQgdG8gYWRkIGEgc3RlcCBmb3IgcHJlIGZpZ2h0IGFjdGlvbnMsIG1heWJlIGNob29zZSBhY3Rpb24gc2hvdWxkIGJlIGFibGUgdG8gd29yayBvbiBuZWdhdGl2ZSBmaWdodCB0aW1lXG4gICAgICAgIGZvciAobGV0IFtfLCBpdGVtXSBvZiBwbGF5ZXIuaXRlbXMpIHtcbiAgICAgICAgICAgIGlmIChpdGVtLm9udXNlICYmIGl0ZW0ub251c2UuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIGlmIChpdGVtLm9udXNlLnNwZWxsIGluc3RhbmNlb2YgU3BlbGxCdWZmKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aW1lUmVtYWluaW5nU2Vjb25kcyA8PSBpdGVtLm9udXNlLnNwZWxsLmJ1ZmYuZHVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ub251c2UuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gTWF0aC5taW4od2FpdGluZ0ZvclRpbWUsIGZpZ2h0TGVuZ3RoIC0gaXRlbS5vbnVzZS5zcGVsbC5idWZmLmR1cmF0aW9uICogMTAwMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgaWYgKHdhcnJpb3IucmFnZSA8IDMwICYmIHdhcnJpb3IuYmxvb2RSYWdlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHdhcnJpb3IuYmxvb2RSYWdlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgLy8gZ2NkIHNwZWxsc1xuICAgICAgICBpZiAod2Fycmlvci5uZXh0R0NEVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICBpZiAodXNlUmVja2xlc3NuZXNzICYmIHdhcnJpb3IucmVja2xlc3NuZXNzLmNhbkNhc3QodGltZSkgJiYgdGltZVJlbWFpbmluZ1NlY29uZHMgPD0gMTUpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLnJlY2tsZXNzbmVzcy5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLmRlYXRoV2lzaC5jYW5DYXN0KHRpbWUpICYmXG4gICAgICAgICAgICAgICAgKHRpbWVSZW1haW5pbmdTZWNvbmRzIDw9IDMwXG4gICAgICAgICAgICAgICAgfHwgKHRpbWVSZW1haW5pbmdTZWNvbmRzIC0gd2Fycmlvci5kZWF0aFdpc2guc3BlbGwuY29vbGRvd24pID4gMzApKSB7IC8vIGNvdWxkIGJlIHRpbWVkIGJldHRlclxuICAgICAgICAgICAgICAgIHdhcnJpb3IuZGVhdGhXaXNoLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV4ZWN1dGVQaGFzZSAmJiB3YXJyaW9yLmJsb29kdGhpcnN0LmNhbkNhc3QodGltZSkgICYmIHdhcnJpb3IucmFnZSA+PSBibG9vZHRoaXJzdEV4ZWNSYWdlTWluICYmIHdhcnJpb3IucmFnZSA8PSBibG9vZHRoaXJzdEV4ZWNSYWdlTWF4KSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5ibG9vZHRoaXJzdC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZXhlY3V0ZVBoYXNlICYmIHdhcnJpb3IuZXhlY3V0ZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5leGVjdXRlLmNhc3QodGltZSk7XG4gICAgICAgICAgICAgICAgaWYgKG1pZ2h0eVJhZ2VFeGVjdXRlICYmIHdhcnJpb3IubWlnaHR5UmFnZVBvdGlvbi5jYW5DYXN0KHRpbWUgKyA1MDApKSB7XG4gICAgICAgICAgICAgICAgICAgIHdhcnJpb3IuZnV0dXJlRXZlbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZTogdGltZSArIDUwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2Fycmlvci5taWdodHlSYWdlUG90aW9uLmNhc3QodGltZSArIDUwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmJsb29kdGhpcnN0LmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICAgICAgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QuY29vbGRvd24gPiB0aW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gTWF0aC5taW4od2FpdGluZ0ZvclRpbWUsIHdhcnJpb3IuYmxvb2R0aGlyc3QuY29vbGRvd24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIWV4ZWN1dGVQaGFzZSAmJiB3YXJyaW9yLndoaXJsd2luZC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci53aGlybHdpbmQuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci53aGlybHdpbmQudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICAgICAgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLmNvb2xkb3duID4gdGltZSkge1xuICAgICAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IE1hdGgubWluKHdhaXRpbmdGb3JUaW1lLCB3YXJyaW9yLndoaXJsd2luZC5jb29sZG93bik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICghZXhlY3V0ZVBoYXNlICYmIHdhcnJpb3IucmFnZSA+PSBoYW1zdHJpbmdSYWdlUmVxICYmIHdhcnJpb3IuaGFtc3RyaW5nLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmhhbXN0cmluZy5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFtaWdodHlSYWdlRXhlY3V0ZSAmJiB3YXJyaW9yLm1pZ2h0eVJhZ2VQb3Rpb24uY2FuQ2FzdCh0aW1lKSAmJiB0aW1lUmVtYWluaW5nU2Vjb25kcyA8PSAyMCAmJiB3YXJyaW9yLnJhZ2UgPD0gbWlnaHR5UmFnZVJhZ2VSZXEpIHtcbiAgICAgICAgICAgIHdhcnJpb3IubWlnaHR5UmFnZVBvdGlvbi5jYXN0KHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaGVyb2ljU3RyaWtlU3BlbGwgPSB1c2VIZXJvaWNTdHJpa2VSOSA/IHdhcnJpb3IuaGVyb2ljU3RyaWtlUjkgOiB3YXJyaW9yLmhlcm9pY1N0cmlrZVI4O1xuICAgIFxuICAgICAgICBpZiAoKCFleGVjdXRlUGhhc2UgfHwgaGVyb2ljU3RyaWtlSW5FeGVjdXRlKSAmJiAgd2Fycmlvci5yYWdlID49IGhlcm9pY1N0cmlrZVNwZWxsLnNwZWxsLmNvc3QgJiYgIXdhcnJpb3IucXVldWVkU3BlbGwgJiYgd2Fycmlvci5yYWdlID49IGhlcm9pY1N0cmlrZVJhZ2VSZXEpIHtcbiAgICAgICAgICAgIHdhcnJpb3IucXVldWVkU3BlbGwgPSBoZXJvaWNTdHJpa2VTcGVsbDtcbiAgICAgICAgICAgIGlmICh3YXJyaW9yLmxvZykgd2Fycmlvci5sb2codGltZSwgJ3F1ZXVlaW5nIGhlcm9pYyBzdHJpa2UnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIChleGVjdXRlUGhhc2UgJiYgdGltZSA+PSBwbGF5ZXIubWghLm5leHRTd2luZ1RpbWUgJiYgd2Fycmlvci5xdWV1ZWRTcGVsbCkge1xuICAgICAgICAvLyAgICAgd2Fycmlvci5xdWV1ZWRTcGVsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gICAgIGlmICh3YXJyaW9yLmxvZykgd2Fycmlvci5sb2codGltZSwgJ2NhbmNlbGxpbmcgaGVyb2ljIHN0cmlrZSBpbiBleGVjdXRlIHBoYXNlJyk7XG4gICAgICAgIC8vIH1cblxuICAgICAgICAvLyBpZiAodGltZSA+PSBwbGF5ZXIubWghLm5leHRTd2luZ1RpbWUgJiYgd2Fycmlvci5xdWV1ZWRTcGVsbCAmJiB3YXJyaW9yLnJhZ2UgPD0gaGVyb2ljU3RyaWtlUmFnZVJlcSkge1xuICAgICAgICAvLyAgICAgd2Fycmlvci5xdWV1ZWRTcGVsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gICAgIGlmICh3YXJyaW9yLmxvZykgd2Fycmlvci5sb2codGltZSwgJ2NhbmNlbGxpbmcgaGVyb2ljIHN0cmlrZScpO1xuICAgICAgICAvLyB9XG4gICAgXG4gICAgICAgIHJldHVybiB3YWl0aW5nRm9yVGltZTtcbiAgICB9O1xufVxuIiwiaW1wb3J0IHsgIE1haW5UaHJlYWRJbnRlcmZhY2UgfSBmcm9tIFwiLi93b3JrZXJfZXZlbnRfaW50ZXJmYWNlLmpzXCI7XG5pbXBvcnQgeyBTaW11bGF0aW9uIH0gZnJvbSBcIi4vc2ltdWxhdGlvbi5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbkRlc2NyaXB0aW9uLCBsb29rdXBJdGVtcywgbG9va3VwQnVmZnMsIGxvb2t1cEVuY2hhbnRzLCBsb29rdXBUZW1wb3JhcnlFbmNoYW50cyB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZUNob29zZUFjdGlvbiB9IGZyb20gXCIuL3dhcnJpb3JfYWkuanNcIjtcblxuY29uc3QgbWFpblRocmVhZEludGVyZmFjZSA9IE1haW5UaHJlYWRJbnRlcmZhY2UuaW5zdGFuY2U7XG5cbmxldCBjdXJyZW50U2ltOiBTaW11bGF0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxubWFpblRocmVhZEludGVyZmFjZS5hZGRFdmVudExpc3RlbmVyKCdzaW11bGF0ZScsIChkYXRhOiBhbnkpID0+IHtcbiAgICBjb25zdCBzaW1kZXNjID0gPFNpbXVsYXRpb25EZXNjcmlwdGlvbj5kYXRhO1xuXG4gICAgbGV0IGxvZ0Z1bmN0aW9uOiBMb2dGdW5jdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoc2ltZGVzYy5yZWFsdGltZSkge1xuICAgICAgICBsb2dGdW5jdGlvbiA9ICh0aW1lOiBudW1iZXIsIHRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdsb2cnLCB7XG4gICAgICAgICAgICAgICAgdGltZTogdGltZSxcbiAgICAgICAgICAgICAgICB0ZXh0OiB0ZXh0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjdXJyZW50U2ltID0gbmV3IFNpbXVsYXRpb24oc2ltZGVzYy5yYWNlLCBzaW1kZXNjLnN0YXRzLFxuICAgICAgICBsb29rdXBJdGVtcyhzaW1kZXNjLmVxdWlwbWVudCksXG4gICAgICAgIGxvb2t1cEVuY2hhbnRzKHNpbWRlc2MuZW5jaGFudHMpLFxuICAgICAgICBsb29rdXBUZW1wb3JhcnlFbmNoYW50cyhzaW1kZXNjLnRlbXBvcmFyeUVuY2hhbnRzKSxcbiAgICAgICAgbG9va3VwQnVmZnMoc2ltZGVzYy5idWZmcyksXG4gICAgICAgIGdlbmVyYXRlQ2hvb3NlQWN0aW9uKHNpbWRlc2MudXNlUmVja2xlc3NuZXNzLCBzaW1kZXNjLnVzZUhlcm9pY1N0cmlrZVI5LCBzaW1kZXNjLmhlcm9pY1N0cmlrZVJhZ2VSZXEsIHNpbWRlc2MuaGFtc3RyaW5nUmFnZVJlcSwgc2ltZGVzYy5ibG9vZHRoaXJzdEV4ZWNSYWdlTWluLCBzaW1kZXNjLmJsb29kdGhpcnN0RXhlY1JhZ2VNYXgsIHNpbWRlc2MuZXhlY3V0ZU1pZ2h0eVJhZ2UsIHNpbWRlc2MubWlnaHR5UmFnZVJhZ2VSZXEsIHNpbWRlc2MuaGVyb2ljU3RyaWtlSW5FeGVjdXRlKSxcbiAgICAgICAgc2ltZGVzYy5maWdodExlbmd0aCwgc2ltZGVzYy5yZWFsdGltZSwgc2ltZGVzYy52YWVsLCBsb2dGdW5jdGlvbik7XG5cbiAgICBjdXJyZW50U2ltLnN0YXJ0KCk7XG5cbiAgICBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGlmIChjdXJyZW50U2ltICYmICFjdXJyZW50U2ltLnBhdXNlZCkge1xuICAgICAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdzdGF0dXMnLCBjdXJyZW50U2ltIS5zdGF0dXMpO1xuICAgICAgICB9XG4gICAgfSwgNTAwKTtcbn0pO1xuXG5tYWluVGhyZWFkSW50ZXJmYWNlLmFkZEV2ZW50TGlzdGVuZXIoJ3BhdXNlJywgKHBhdXNlOiBib29sZWFufHVuZGVmaW5lZCkgPT4ge1xuICAgIGlmIChjdXJyZW50U2ltKSB7XG4gICAgICAgIGN1cnJlbnRTaW0ucGF1c2UocGF1c2UpO1xuICAgIH1cbn0pO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE1BQU0sb0JBQW9CO0lBR3RCLFlBQVksTUFBVztRQUZ2QixtQkFBYyxHQUF1QyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRzNELE1BQU0sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFPO1lBQ3ZCLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElB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LEdBQUcsSUFBSTtJQUN4QixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSztJQUMxQixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSztJQUMxQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNyQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSztJQUN0QixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsSUFBSTtJQUN6QixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNyQixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUN0QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUN0QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUN0QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2QixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNyQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNyQixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2QixDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUN2QixDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsS0FBSztDQUMzQixDQUFDO0FBRUYsQUFBTyxNQUFNLDJCQUEyQixHQUFrQztJQUN0RSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsSUFBSTtJQUN6QixDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsSUFBSTtJQUN4QixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSztJQUMxQixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSztJQUMxQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSztJQUN0QixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSztJQUN0QixDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSztJQUMxQixDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsS0FBSztJQUN0QixDQUFDLFFBQVEsQ0FBQyxL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QUUsYUFBYTtRQUNuQixJQUFJLEVBQUUsUUFBUSxDQUFDLE1BQU07UUFDckIsS0FBSyxFQUFFLEVBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQzFCO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsMkJBQTJCO1FBQ2pDLElBQUksRUFBRSxRQUFRLENBQUMsTUFBTTtRQUNyQixLQUFLLEVBQUUsRUFBQyxFQUFFLEVBQUUsRUFBRSxFQUFDO0tBQ2xCO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsMEJBQTBCO1FBQ2hDLElBQUksRUFBRSxRQUFRLENBQUMsTUFBTTtRQUNyQixLQUFLLEVBQUUsRUFBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7S0FDM0I7SUFDRDtRQUNJLElBQUksRUFBRSxhQUFhO1FBQ25CLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxHQUFDLFFBQVEsQ0FBQyxLQUFLO1FBQ25DLEtBQUssRUFBRSxFQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztLQUMzQjtJQUNEO1FBQ0ksSUFBSSxFQUFFLHNCQUFzQjtRQUM1QixJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssR0FBQyxRQUFRLENBQUMsS0FBSztRQUNuQyxLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBQztLQUNuQztJQUNEO1FBQ0ksSUFBSSxFQUFFLHNCQUFzQjtRQUM1QixJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssR0FBQyxRQUFRLENBQUMsS0FBSztRQUNuQyxLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUM7S0FDM0I7SUFDRDtRQUNJLElBQUksRUFBRSxjQUFjO1FBQ3BCLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxHQUFDLFFBQVEsQ0FBQyxLQUFLO1FBQ25DLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxDQUFD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
