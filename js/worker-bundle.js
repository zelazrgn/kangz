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

function urand(min, max) {
    return min + Math.round(Math.random() * (max - min));
}
function frand(min, max) {
    return min + Math.random() * (max - min);
}
function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

var SpellFamily;
(function (SpellFamily) {
    SpellFamily[SpellFamily["NONE"] = 0] = "NONE";
    SpellFamily[SpellFamily["WARRIOR"] = 1] = "WARRIOR";
})(SpellFamily || (SpellFamily = {}));
class Spell {
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
class SwingSpell extends Spell {
    constructor(name, family, bonusDamage, cost) {
        super(name, SpellType.PHYSICAL_WEAPON, family, false, cost, 0, () => { });
        this.bonusDamage = bonusDamage;
    }
}
class LearnedSwingSpell extends LearnedSpell {
    constructor(spell, caster) {
        super(spell, caster);
        this.spell = spell;
    }
}
var SpellType;
(function (SpellType) {
    SpellType[SpellType["NONE"] = 0] = "NONE";
    SpellType[SpellType["BUFF"] = 1] = "BUFF";
    SpellType[SpellType["PHYSICAL"] = 2] = "PHYSICAL";
    SpellType[SpellType["PHYSICAL_WEAPON"] = 3] = "PHYSICAL_WEAPON";
    SpellType[SpellType["MAGIC"] = 4] = "MAGIC";
})(SpellType || (SpellType = {}));
class SpellDamage extends Spell {
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
class ItemSpellDamage extends SpellDamage {
    constructor(name, amount, type) {
        super(name, amount, type, SpellFamily.NONE);
        this.canProc = false;
    }
}
class ExtraAttack extends Spell {
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
class SpellBuff extends Spell {
    constructor(buff, is_gcd = false, cost = 0, cooldown = 0) {
        super(`SpellBuff(${buff.name})`, SpellType.BUFF, SpellFamily.NONE, is_gcd, cost, cooldown, (player, time) => {
            player.buffManager.add(buff, time);
        });
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
    constructor(name, duration, stats, updateInterval, updateF) {
        super(name, duration, stats);
        this.updateF = updateF;
        this.updateInterval = updateInterval;
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
            this.buff.updateF(this.player, time);
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

var Race;
(function (Race) {
    Race[Race["HUMAN"] = 0] = "HUMAN";
    Race[Race["ORC"] = 1] = "ORC";
})(Race || (Race = {}));
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
    calculateWeaponSkillValue(is_mh, spell) {
        if (spell && spell.type !== SpellType.PHYSICAL_WEAPON) {
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
    calculateCritChance(victim, is_mh, spell) {
        if (spell && spell.type == SpellType.PHYSICAL) {
            spell = undefined;
        }
        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;
        if (!spell || spell.type == SpellType.PHYSICAL_WEAPON) {
            const weapon = is_mh ? this.mh : this.oh;
            if (weapon.temporaryEnchant && weapon.temporaryEnchant.stats && weapon.temporaryEnchant.stats.crit) {
                crit += weapon.temporaryEnchant.stats.crit;
            }
        }
        const skillBonus = 0.04 * (this.calculateWeaponSkillValue(is_mh, spell) - victim.maxSkillForLevel);
        crit += skillBonus;
        return crit;
    }
    calculateMissChance(victim, is_mh, spell) {
        let res = 5;
        res -= this.buffManager.stats.hit;
        if (this.oh && !spell) {
            res += 19;
        }
        const skillDiff = this.calculateWeaponSkillValue(is_mh, spell) - victim.defenseSkill;
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
    calculateSwingMinMaxDamage(is_mh) {
        const weapon = is_mh ? this.mh : this.oh;
        const ap_bonus = this.ap / 14 * weapon.weapon.speed;
        const ohPenalty = is_mh ? 1 : 0.625;
        return [
            (weapon.min + ap_bonus) * ohPenalty,
            (weapon.max + ap_bonus) * ohPenalty
        ];
    }
    calculateSwingRawDamage(is_mh) {
        return frand(...this.calculateSwingMinMaxDamage(is_mh));
    }
    critCap() {
        const skillBonus = 4 * (this.calculateWeaponSkillValue(true) - this.target.maxSkillForLevel);
        const miss_chance = Math.round(this.calculateMissChance(this.target, true) * 100);
        const dodge_chance = Math.round(this.target.dodgeChance * 100) - skillBonus;
        const glance_chance = clamp((10 + (this.target.defenseSkill - 300) * 2) * 100, 0, 4000);
        return (10000 - (miss_chance + dodge_chance + glance_chance)) / 100;
    }
    rollMeleeHitOutcome(victim, is_mh, spell) {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, spell) * 100);
        const dodge_chance = Math.round(victim.dodgeChance * 100);
        const crit_chance = Math.round(this.calculateCritChance(victim, is_mh, spell) * 100);
        const skillBonus = 4 * (this.calculateWeaponSkillValue(is_mh, spell) - victim.maxSkillForLevel);
        tmp = miss_chance;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }
        tmp = dodge_chance - skillBonus;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_DODGE;
        }
        if (!spell) {
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
    calculateBonusDamage(rawDamage, victim, spell) {
        let damageWithBonus = rawDamage;
        damageWithBonus *= this.buffManager.stats.damageMult;
        return damageWithBonus;
    }
    calculateMeleeDamage(rawDamage, victim, is_mh, spell) {
        const damageWithBonus = this.calculateBonusDamage(rawDamage, victim, spell);
        const armorReduced = victim.calculateArmorReducedDamage(damageWithBonus, this);
        const hitOutcome = this.rollMeleeHitOutcome(victim, is_mh, spell);
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
    updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell) {
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_PARRY].includes(hitOutcome)) {
            for (let proc of this.procs) {
                proc.run(this, (is_mh ? this.mh : this.oh).weapon, time);
            }
            (is_mh ? this.mh : this.oh).proc(time);
        }
    }
    dealMeleeDamage(time, rawDamage, target, is_mh, spell) {
        let [damageDone, hitOutcome, cleanDamage] = this.calculateMeleeDamage(rawDamage, target, is_mh, spell);
        damageDone = Math.trunc(damageDone);
        cleanDamage = Math.trunc(cleanDamage);
        this.damageLog.push([time, damageDone]);
        if (this.log) {
            let hitStr = `Your ${spell ? spell.name : (is_mh ? 'main-hand' : 'off-hand')} ${hitOutcomeString[hitOutcome]}`;
            if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_PARRY].includes(hitOutcome)) {
                hitStr += ` for ${damageDone}`;
            }
            this.log(time, hitStr);
        }
        if (spell instanceof SpellDamage) {
            if (spell.callback) {
                spell.callback(this, hitOutcome);
            }
        }
        if (!spell || spell.canProc) {
            this.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);
            this.buffManager.update(time);
        }
    }
    dealSpellDamage(time, rawDamage, target, spell) {
        const damageDone = rawDamage;
        this.damageLog.push([time, damageDone]);
        if (this.log) {
            this.log(time, `${spell.name} hits for ${damageDone}`);
        }
    }
    swingWeapon(time, target, is_mh) {
        const rawDamage = this.calculateSwingRawDamage(is_mh);
        if (!this.doingExtraAttacks && is_mh && this.queuedSpell && this.queuedSpell.canCast(time)) {
            this.queuedSpell.cast(time);
            const swingSpell = this.queuedSpell.spell;
            this.queuedSpell = undefined;
            const bonusDamage = swingSpell.bonusDamage;
            this.dealMeleeDamage(time, rawDamage + bonusDamage, target, is_mh, swingSpell);
        }
        else {
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
    calculateCritChance(victim, is_mh, spell) {
        return 5 + 3 + super.calculateCritChance(victim, is_mh, spell);
    }
    calculateMeleeDamage(rawDamage, victim, is_mh, spell) {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(rawDamage, victim, is_mh, spell);
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && spell && spell.family === SpellFamily.WARRIOR) {
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
    updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);
        if ([MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            if (spell) {
                if (spell !== whirlwindSpell) {
                    this.rage += spell.cost * 0.82;
                }
            }
            else {
                this.rewardRage(cleanDamage * 0.75, true, time);
            }
        }
        else if (damageDone && !spell) {
            this.rewardRage(damageDone, true, time);
        }
        if (!this.doingExtraAttacks
            && (!spell || spell === heroicStrikeSpell)
            && ![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)
            && hitOutcome !== MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.buffManager.remove(flurry, time);
        }
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.buffManager.add(flurry, time);
        }
    }
}
const heroicStrikeSpell = new SwingSpell("Heroic Strike", SpellFamily.WARRIOR, 157, 12);
const executeSpell = new SpellDamage("Execute", (player) => {
    return 600 + (player.power - 10) * 15;
}, SpellType.PHYSICAL_WEAPON, SpellFamily.WARRIOR, true, 10, 0, (player, hitOutcome) => {
    if (![MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_MISS].includes(hitOutcome)) {
        player.power = 0;
    }
});
const bloodthirstSpell = new SpellDamage("Bloodthirst", (player) => {
    return player.ap * 0.45;
}, SpellType.PHYSICAL, SpellFamily.WARRIOR, true, 30, 6);
const whirlwindSpell = new SpellDamage("Whirlwind", (player) => {
    return player.calculateSwingRawDamage(true);
}, SpellType.PHYSICAL_WEAPON, SpellFamily.WARRIOR, true, 25, 10);
const hamstringSpell = new SpellDamage("Hamstring", 45, SpellType.PHYSICAL_WEAPON, SpellFamily.WARRIOR, true, 10, 0);
const angerManagementOT = new BuffOverTime("Anger Management", Number.MAX_SAFE_INTEGER, undefined, 3000, (player, time) => {
    player.power += 1;
    if (player.log)
        player.log(time, `You gained 1 rage from Anger Management`);
});
const bloodRageOT = new BuffOverTime("Bloodrage", 10, undefined, 1000, (player, time) => {
    player.power += 1;
    if (player.log)
        player.log(time, `You gained 1 rage from Bloodrage`);
});
const bloodRage = new Spell("Bloodrage", SpellType.NONE, SpellFamily.WARRIOR, false, 0, 60, (player, time) => {
    player.power += 10;
    if (player.log)
        player.log(time, `You gain 10 rage from Bloodrage`);
    player.buffManager.add(bloodRageOT, time);
});
const deathWish = new SpellBuff(new Buff("Death Wish", 30, { damageMult: 1.2 }), true, 10, 3 * 60);
const unbridledWrath = new BuffProc("Unbridled Wrath", 60 * 60, new Proc(new Spell("Unbridled Wrath", SpellType.NONE, SpellFamily.WARRIOR, false, 0, 0, (player, time) => {
    if (player.log)
        player.log(time, `You gain 1 rage from Unbridled Wrath`);
    player.power += 1;
}), { chance: 40 }));

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
        onequip: new Proc(new SpellDamage("Electric Discharge", [100, 151], SpellType.MAGIC, SpellFamily.NONE), { ppm: 3 })
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
        onhit: new Proc(new ItemSpellDamage("Fatal Wounds", 240, SpellType.PHYSICAL), { ppm: 1.3 })
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
        duration: 15 * 60,
        stats: {
            statMult: 1.1
        }
    },
    {
        name: "Blessing of Might",
        duration: 15 * 60,
        stats: {
            ap: 222
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
].map((bd) => new Buff(bd.name, bd.duration, bd.stats));

function setupPlayer(race, stats, equipment, enchants, temporaryEnchant, buffs, log) {
    const player = new Warrior(race, stats, log);
    for (let [slot, item] of equipment) {
        player.equip(slot, item, enchants.get(slot), temporaryEnchant.get(slot));
    }
    for (let buff of buffs) {
        player.buffManager.add(buff, 0);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvbWF0aC50cyIsIi4uL3NyYy9zcGVsbC50cyIsIi4uL3NyYy9pdGVtLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL2VuY2hhbnRzLnRzIiwiLi4vc3JjL2RhdGEvaXRlbXMudHMiLCIuLi9zcmMvZGF0YS9zcGVsbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbl91dGlscy50cyIsIi4uL3NyYy9zaW11bGF0aW9uLnRzIiwiLi4vc3JjL3dhcnJpb3JfYWkudHMiLCIuLi9zcmMvcnVuX3NpbXVsYXRpb25fd29ya2VyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbInR5cGUgV29ya2VyRXZlbnRMaXN0ZW5lciA9IChkYXRhOiBhbnkpID0+IHZvaWQ7XG5cbmNsYXNzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBldmVudExpc3RlbmVyczogTWFwPHN0cmluZywgV29ya2VyRXZlbnRMaXN0ZW5lcltdPiA9IG5ldyBNYXAoKTtcblxuICAgIGNvbnN0cnVjdG9yKHRhcmdldDogYW55KSB7XG4gICAgICAgIHRhcmdldC5vbm1lc3NhZ2UgPSAoZXY6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMuZ2V0KGV2LmRhdGEuZXZlbnQpIHx8IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgbGlzdGVuZXIgb2YgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyKGV2LmRhdGEuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogV29ya2VyRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBpZiAodGhpcy5ldmVudExpc3RlbmVycy5oYXMoZXZlbnQpKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldmVudCkhLnB1c2gobGlzdGVuZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5zZXQoZXZlbnQsIFtsaXN0ZW5lcl0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lclRvUmVtb3ZlOiBXb3JrZXJFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50TGlzdGVuZXJzLmhhcyhldmVudCkpIHtcbiAgICAgICAgICAgIGxldCBldmVudExpc3RlbmVyc0ZvckV2ZW50ID0gdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpO1xuICAgICAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLnNldChldmVudCwgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudC5maWx0ZXIoKGxpc3RlbmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lciAhPT0gbGlzdGVuZXJUb1JlbW92ZTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVFdmVudExpc3RlbmVyc0ZvckV2ZW50KGV2ZW50OiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5kZWxldGUoZXZlbnQpO1xuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiB1cmFuZChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbWluICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZnJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wKHZhbDogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heChtaW4sIHZhbCkpO1xufVxuXG5jb25zdCBERUJVR0dJTkcgPSBmYWxzZTtcblxuaWYgKERFQlVHR0lORykge1xuICAgIC8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL21hdGhpYXNieW5lbnMvNTY3MDkxNyNmaWxlLWRldGVybWluaXN0aWMtbWF0aC1yYW5kb20tanNcbiAgICBNYXRoLnJhbmRvbSA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlZWQgPSAweDJGNkUyQjE7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vIFJvYmVydCBKZW5raW5z4oCZIDMyIGJpdCBpbnRlZ2VyIGhhc2ggZnVuY3Rpb25cbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDdFRDU1RDE2KSArIChzZWVkIDw8IDEyKSkgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEM3NjFDMjNDKSBeIChzZWVkID4+PiAxOSkpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDE2NTY2N0IxKSArIChzZWVkIDw8IDUpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEQzQTI2NDZDKSBeIChzZWVkIDw8IDkpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEZENzA0NkM1KSArIChzZWVkIDw8IDMpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEI1NUE0RjA5KSBeIChzZWVkID4+PiAxNikpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHJldHVybiAoc2VlZCAmIDB4RkZGRkZGRikgLyAweDEwMDAwMDAwO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG59XG4iLCJpbXBvcnQgeyBQbGF5ZXIsIE1lbGVlSGl0T3V0Y29tZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFdlYXBvbkRlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgdXJhbmQgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5cbmV4cG9ydCBlbnVtIFNwZWxsRmFtaWx5IHtcbiAgICBOT05FLFxuICAgIFdBUlJJT1IsXG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbCB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHR5cGU6IFNwZWxsVHlwZTtcbiAgICBmYW1pbHk6IFNwZWxsRmFtaWx5O1xuICAgIGlzX2djZDogYm9vbGVhbjtcbiAgICBjb3N0OiBudW1iZXI7XG4gICAgY29vbGRvd246IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgc3BlbGxGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZDtcblxuICAgIGNhblByb2MgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB0eXBlOiBTcGVsbFR5cGUsIGZhbWlseTogU3BlbGxGYW1pbHksIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyLCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuZmFtaWx5ID0gZmFtaWx5O1xuICAgICAgICB0aGlzLmNvc3QgPSBjb3N0O1xuICAgICAgICB0aGlzLmNvb2xkb3duID0gY29vbGRvd247XG4gICAgICAgIHRoaXMuaXNfZ2NkID0gaXNfZ2NkO1xuICAgICAgICB0aGlzLnNwZWxsRiA9IHNwZWxsRjtcbiAgICB9XG5cbiAgICBjYXN0KHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3BlbGxGKHBsYXllciwgdGltZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGVhcm5lZFNwZWxsIHtcbiAgICBzcGVsbDogU3BlbGw7XG4gICAgY29vbGRvd24gPSAwO1xuICAgIGNhc3RlcjogUGxheWVyO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsLCBjYXN0ZXI6IFBsYXllcikge1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7XG4gICAgICAgIHRoaXMuY2FzdGVyID0gY2FzdGVyO1xuICAgIH1cblxuICAgIG9uQ29vbGRvd24odGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvb2xkb3duID4gdGltZTtcbiAgICB9XG5cbiAgICB0aW1lUmVtYWluaW5nKHRpbWU6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgKHRoaXMuY29vbGRvd24gLSB0aW1lKSAvIDEwMDApO1xuICAgIH1cblxuICAgIGNhbkNhc3QodGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmlzX2djZCAmJiB0aGlzLmNhc3Rlci5uZXh0R0NEVGltZSA+IHRpbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmNvc3QgPiB0aGlzLmNhc3Rlci5wb3dlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub25Db29sZG93bih0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgY2FzdCh0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCF0aGlzLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmlzX2djZCkge1xuICAgICAgICAgICAgdGhpcy5jYXN0ZXIubmV4dEdDRFRpbWUgPSB0aW1lICsgMTUwMCArIHRoaXMuY2FzdGVyLmxhdGVuY3k7IC8vIFRPRE8gLSBuZWVkIHRvIHN0dWR5IHRoZSBlZmZlY3RzIG9mIGxhdGVuY3kgaW4gdGhlIGdhbWUgYW5kIGNvbnNpZGVyIGh1bWFuIHByZWNpc2lvblxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmNhc3Rlci5wb3dlciAtPSB0aGlzLnNwZWxsLmNvc3Q7XG5cbiAgICAgICAgdGhpcy5zcGVsbC5jYXN0KHRoaXMuY2FzdGVyLCB0aW1lKTtcblxuICAgICAgICB0aGlzLmNvb2xkb3duID0gdGltZSArIHRoaXMuc3BlbGwuY29vbGRvd24gKiAxMDAwICsgdGhpcy5jYXN0ZXIubGF0ZW5jeTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2luZ1NwZWxsIGV4dGVuZHMgU3BlbGwge1xuICAgIGJvbnVzRGFtYWdlOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGZhbWlseTogU3BlbGxGYW1pbHksIGJvbnVzRGFtYWdlOiBudW1iZXIsIGNvc3Q6IG51bWJlcikge1xuICAgICAgICBzdXBlcihuYW1lLCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBmYW1pbHksIGZhbHNlLCBjb3N0LCAwLCAoKSA9PiB7fSk7XG4gICAgICAgIHRoaXMuYm9udXNEYW1hZ2UgPSBib251c0RhbWFnZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3dpbmdTcGVsbCBleHRlbmRzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFN3aW5nU3BlbGw7XG4gICAgXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFN3aW5nU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyKHNwZWxsLCBjYXN0ZXIpO1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7IC8vIFRPRE8gLSBpcyB0aGVyZSBhIHdheSB0byBhdm9pZCB0aGlzIGxpbmU/XG4gICAgfVxufVxuXG5leHBvcnQgZW51bSBTcGVsbFR5cGUge1xuICAgIE5PTkUsXG4gICAgQlVGRixcbiAgICBQSFlTSUNBTCxcbiAgICBQSFlTSUNBTF9XRUFQT04sXG4gICAgTUFHSUMsXG59XG5cbmV4cG9ydCB0eXBlIFNwZWxsSGl0T3V0Y29tZUNhbGxiYWNrID0gKHBsYXllcjogUGxheWVyLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsIHtcbiAgICBjYWxsYmFjaz86IFNwZWxsSGl0T3V0Y29tZUNhbGxiYWNrO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlcnxbbnVtYmVyLCBudW1iZXJdfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSwgZmFtaWx5OiBTcGVsbEZhbWlseSwgaXNfZ2NkID0gZmFsc2UsIGNvc3QgPSAwLCBjb29sZG93biA9IDAsIGNhbGxiYWNrPzogU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2spIHtcbiAgICAgICAgc3VwZXIobmFtZSwgdHlwZSwgZmFtaWx5LCBpc19nY2QsIGNvc3QsIGNvb2xkb3duLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgZG1nID0gKGFtb3VudCBpbnN0YW5jZW9mIEZ1bmN0aW9uKSA/IGFtb3VudChwbGF5ZXIpIDogKEFycmF5LmlzQXJyYXkoYW1vdW50KSA/IHVyYW5kKC4uLmFtb3VudCkgOiBhbW91bnQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gU3BlbGxUeXBlLlBIWVNJQ0FMIHx8IHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBTcGVsbFR5cGUuTUFHSUMpIHtcbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbFNwZWxsRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgSXRlbVNwZWxsRGFtYWdlIGV4dGVuZHMgU3BlbGxEYW1hZ2Uge1xuICAgIGNhblByb2MgPSBmYWxzZTsgLy8gVE9ETyAtIGNvbmZpcm0gdGhpcyBpcyBibGl6emxpa2UsIGFsc28gc29tZSBpdGVtIHByb2NzIG1heSBiZSBhYmxlIHRvIHByb2MgYnV0IG9uIExIIGNvcmUsIGZhdGFsIHdvdW5kIGNhbid0XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSkge1xuICAgICAgICBzdXBlcihuYW1lLCBhbW91bnQsIHR5cGUsIFNwZWxsRmFtaWx5Lk5PTkUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikge1xuICAgICAgICAvLyBzcGVsbHR5cGUgZG9lc24ndCBtYXR0ZXJcbiAgICAgICAgc3VwZXIobmFtZSwgU3BlbGxUeXBlLk5PTkUsIFNwZWxsRmFtaWx5Lk5PTkUsIGZhbHNlLCAwLCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGxheWVyLmV4dHJhQXR0YWNrQ291bnQgKz0gY291bnQ7IC8vIExIIGNvZGUgZG9lcyBub3QgYWxsb3cgbXVsdGlwbGUgYXV0byBhdHRhY2tzIHRvIHN0YWNrIGlmIHRoZXkgcHJvYyB0b2dldGhlci4gQmxpenpsaWtlIG1heSBhbGxvdyB0aGVtIHRvIHN0YWNrIFxuICAgICAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYEdhaW5lZCAke2NvdW50fSBleHRyYSBhdHRhY2tzIGZyb20gJHtuYW1lfWApO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbEJ1ZmYgZXh0ZW5kcyBTcGVsbCB7XG4gICAgYnVmZjogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKGJ1ZmY6IEJ1ZmYsIGlzX2djZCA9IGZhbHNlLCBjb3N0ID0gMCwgY29vbGRvd24gPSAwKSB7XG4gICAgICAgIHN1cGVyKGBTcGVsbEJ1ZmYoJHtidWZmLm5hbWV9KWAsIFNwZWxsVHlwZS5CVUZGLCBTcGVsbEZhbWlseS5OT05FLCBpc19nY2QsIGNvc3QsIGNvb2xkb3duLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChidWZmLCB0aW1lKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgfVxufVxuXG50eXBlIHBwbSA9IHtwcG06IG51bWJlcn07XG50eXBlIGNoYW5jZSA9IHtjaGFuY2U6IG51bWJlcn07XG50eXBlIHJhdGUgPSBwcG0gfCBjaGFuY2U7XG5cbmV4cG9ydCBjbGFzcyBQcm9jIHtcbiAgICBwcm90ZWN0ZWQgc3BlbGxzOiBTcGVsbFtdO1xuICAgIHByb3RlY3RlZCByYXRlOiByYXRlO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsIHwgU3BlbGxbXSwgcmF0ZTogcmF0ZSkge1xuICAgICAgICB0aGlzLnNwZWxscyA9IEFycmF5LmlzQXJyYXkoc3BlbGwpID8gc3BlbGwgOiBbc3BlbGxdO1xuICAgICAgICB0aGlzLnJhdGUgPSByYXRlO1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgd2VhcG9uOiBXZWFwb25EZXNjcmlwdGlvbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNoYW5jZSA9ICg8Y2hhbmNlPnRoaXMucmF0ZSkuY2hhbmNlIHx8ICg8cHBtPnRoaXMucmF0ZSkucHBtICogd2VhcG9uLnNwZWVkIC8gNjA7XG5cbiAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPD0gY2hhbmNlKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzcGVsbCBvZiB0aGlzLnNwZWxscykge1xuICAgICAgICAgICAgICAgIHNwZWxsLmNhc3QocGxheWVyLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgUHJvYywgU3BlbGwsIExlYXJuZWRTcGVsbCB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBFbmNoYW50RGVzY3JpcHRpb24gfSBmcm9tIFwiLi9kYXRhL2VuY2hhbnRzLmpzXCI7XG5cbmV4cG9ydCBlbnVtIEl0ZW1TbG90IHtcbiAgICBNQUlOSEFORCA9IDEgPDwgMCxcbiAgICBPRkZIQU5EID0gMSA8PCAxLFxuICAgIFRSSU5LRVQxID0gMSA8PCAyLFxuICAgIFRSSU5LRVQyID0gMSA8PCAzLFxuICAgIEhFQUQgPSAxIDw8IDQsXG4gICAgTkVDSyA9IDEgPDwgNSxcbiAgICBTSE9VTERFUiA9IDEgPDwgNixcbiAgICBCQUNLID0gMSA8PCA3LFxuICAgIENIRVNUID0gMSA8PCA4LFxuICAgIFdSSVNUID0gMSA8PCA5LFxuICAgIEhBTkRTID0gMSA8PCAxMCxcbiAgICBXQUlTVCA9IDEgPDwgMTEsXG4gICAgTEVHUyA9IDEgPDwgMTIsXG4gICAgRkVFVCA9IDEgPDwgMTMsXG4gICAgUklORzEgPSAxIDw8IDE0LFxuICAgIFJJTkcyID0gMSA8PCAxNSxcbiAgICBSQU5HRUQgPSAxIDw8IDE2LFxufVxuXG5leHBvcnQgY29uc3QgaXRlbVNsb3RIYXNFbmNoYW50OiB7W1RLZXkgaW4gSXRlbVNsb3RdOiBib29sZWFufSA9IHtcbiAgICBbSXRlbVNsb3QuTUFJTkhBTkRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5PRkZIQU5EXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuVFJJTktFVDFdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuVFJJTktFVDJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuSEVBRF06IHRydWUsXG4gICAgW0l0ZW1TbG90Lk5FQ0tdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuU0hPVUxERVJdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5CQUNLXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuQ0hFU1RdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5XUklTVF06IHRydWUsXG4gICAgW0l0ZW1TbG90LkhBTkRTXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuV0FJU1RdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuTEVHU106IHRydWUsXG4gICAgW0l0ZW1TbG90LkZFRVRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5SSU5HMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SSU5HMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SQU5HRURdOiBmYWxzZSxcbn07XG5cbmV4cG9ydCBjb25zdCBpdGVtU2xvdEhhc1RlbXBvcmFyeUVuY2hhbnQ6IHtbVEtleSBpbiBJdGVtU2xvdF06IGJvb2xlYW59ID0ge1xuICAgIFtJdGVtU2xvdC5NQUlOSEFORF06IHRydWUsXG4gICAgW0l0ZW1TbG90Lk9GRkhBTkRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5IRUFEXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90Lk5FQ0tdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuU0hPVUxERVJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuQkFDS106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5DSEVTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5XUklTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5IQU5EU106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5XQUlTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5MRUdTXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkZFRVRdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUklORzFdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUklORzJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUkFOR0VEXTogZmFsc2UsXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIEl0ZW1EZXNjcmlwdGlvbiB7XG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNsb3Q6IEl0ZW1TbG90LFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbiAgICBvbnVzZT86IFNwZWxsLFxuICAgIG9uZXF1aXA/OiBQcm9jLFxufVxuXG5leHBvcnQgZW51bSBXZWFwb25UeXBlIHtcbiAgICBNQUNFLFxuICAgIFNXT1JELFxuICAgIEFYRSxcbiAgICBEQUdHRVIsXG4gICAgTUFDRTJILFxuICAgIFNXT1JEMkgsXG4gICAgQVhFMkgsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2VhcG9uRGVzY3JpcHRpb24gZXh0ZW5kcyBJdGVtRGVzY3JpcHRpb24ge1xuICAgIHR5cGU6IFdlYXBvblR5cGUsXG4gICAgbWluOiBudW1iZXIsXG4gICAgbWF4OiBudW1iZXIsXG4gICAgc3BlZWQ6IG51bWJlcixcbiAgICBvbmhpdD86IFByb2MsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1dlYXBvbihpdGVtOiBJdGVtRGVzY3JpcHRpb24pOiBpdGVtIGlzIFdlYXBvbkRlc2NyaXB0aW9uIHtcbiAgICByZXR1cm4gXCJzcGVlZFwiIGluIGl0ZW07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VxdWlwZWRXZWFwb24oaXRlbTogSXRlbUVxdWlwZWQpOiBpdGVtIGlzIFdlYXBvbkVxdWlwZWQge1xuICAgIHJldHVybiBcIndlYXBvblwiIGluIGl0ZW07XG59XG5cbmV4cG9ydCBjbGFzcyBJdGVtRXF1aXBlZCB7XG4gICAgaXRlbTogSXRlbURlc2NyaXB0aW9uO1xuICAgIG9udXNlPzogTGVhcm5lZFNwZWxsO1xuXG4gICAgY29uc3RydWN0b3IoaXRlbTogSXRlbURlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICB0aGlzLml0ZW0gPSBpdGVtO1xuXG4gICAgICAgIGlmIChpdGVtLm9udXNlKSB7XG4gICAgICAgICAgICB0aGlzLm9udXNlID0gbmV3IExlYXJuZWRTcGVsbChpdGVtLm9udXNlLCBwbGF5ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0ub25lcXVpcCkgeyAvLyBUT0RPLCBtb3ZlIHRoaXMgdG8gYnVmZnByb2M/IHRoaXMgbWF5IGJlIHNpbXBsZXIgdGhvdWdoIHNpbmNlIHdlIGtub3cgdGhlIGJ1ZmYgd29uJ3QgYmUgcmVtb3ZlZFxuICAgICAgICAgICAgcGxheWVyLmFkZFByb2MoaXRlbS5vbmVxdWlwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVzZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMub251c2UpIHtcbiAgICAgICAgICAgIHRoaXMub251c2UuY2FzdCh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdlYXBvbkVxdWlwZWQgZXh0ZW5kcyBJdGVtRXF1aXBlZCB7XG4gICAgd2VhcG9uOiBXZWFwb25EZXNjcmlwdGlvbjtcbiAgICBuZXh0U3dpbmdUaW1lOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHByb2NzOiBQcm9jW10gPSBbXTtcbiAgICBwcm90ZWN0ZWQgcGxheWVyOiBQbGF5ZXI7XG4gICAgcHVibGljIHRlbXBvcmFyeUVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb247XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBXZWFwb25EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIsIGVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb24sIHRlbXBvcmFyeUVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb24pIHtcbiAgICAgICAgc3VwZXIoaXRlbSwgcGxheWVyKTtcbiAgICAgICAgdGhpcy53ZWFwb24gPSBpdGVtO1xuICAgICAgICBcbiAgICAgICAgaWYgKGl0ZW0ub25oaXQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkUHJvYyhpdGVtLm9uaGl0KVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuY2hhbnQgJiYgZW5jaGFudC5wcm9jKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFByb2MoZW5jaGFudC5wcm9jKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnQgPSB0ZW1wb3JhcnlFbmNoYW50O1xuXG4gICAgICAgIHRoaXMubmV4dFN3aW5nVGltZSA9IDEwMDsgLy8gVE9ETyAtIG5lZWQgdG8gcmVzZXQgdGhpcyBwcm9wZXJseSBpZiBldmVyIHdhbnQgdG8gc2ltdWxhdGUgZmlnaHRzIHdoZXJlIHlvdSBydW4gb3V0XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXQgcGx1c0RhbWFnZSgpIHtcbiAgICAgICAgaWYgKHRoaXMudGVtcG9yYXJ5RW5jaGFudCAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLnBsdXNEYW1hZ2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMucGx1c0RhbWFnZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWluKCkge1xuICAgICAgICByZXR1cm4gdGhpcy53ZWFwb24ubWluICsgdGhpcy5wbHVzRGFtYWdlO1xuICAgIH1cblxuICAgIGdldCBtYXgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5tYXggKyB0aGlzLnBsdXNEYW1hZ2U7XG4gICAgfVxuXG4gICAgYWRkUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIHRoaXMucHJvY3MucHVzaChwKTtcbiAgICB9XG5cbiAgICBwcm9jKHRpbWU6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCBwcm9jIG9mIHRoaXMucHJvY3MpIHtcbiAgICAgICAgICAgIHByb2MucnVuKHRoaXMucGxheWVyLCB0aGlzLndlYXBvbiwgdGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3aW5kZnVyeSBwcm9jcyBsYXN0XG4gICAgICAgIGlmICh0aGlzLnRlbXBvcmFyeUVuY2hhbnQgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnByb2MpIHtcbiAgICAgICAgICAgIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5wcm9jLnJ1bih0aGlzLnBsYXllciwgdGhpcy53ZWFwb24sIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcblxuZXhwb3J0IGNsYXNzIFVuaXQge1xuICAgIGxldmVsOiBudW1iZXI7XG4gICAgYXJtb3I6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGxldmVsOiBudW1iZXIsIGFybW9yOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICB0aGlzLmFybW9yID0gYXJtb3I7XG4gICAgfVxuXG4gICAgZ2V0IG1heFNraWxsRm9yTGV2ZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxldmVsICogNTtcbiAgICB9XG5cbiAgICBnZXQgZGVmZW5zZVNraWxsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgIH1cblxuICAgIGdldCBkb2RnZUNoYW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIDU7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQXJtb3JSZWR1Y2VkRGFtYWdlKGRhbWFnZTogbnVtYmVyLCBhdHRhY2tlcjogUGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGFybW9yID0gTWF0aC5tYXgoMCwgdGhpcy5hcm1vciAtIGF0dGFja2VyLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFybW9yUGVuZXRyYXRpb24pO1xuICAgICAgICBcbiAgICAgICAgbGV0IHRtcHZhbHVlID0gMC4xICogYXJtb3IgIC8gKCg4LjUgKiBhdHRhY2tlci5sZXZlbCkgKyA0MCk7XG4gICAgICAgIHRtcHZhbHVlIC89ICgxICsgdG1wdmFsdWUpO1xuXG4gICAgICAgIGNvbnN0IGFybW9yTW9kaWZpZXIgPSBjbGFtcCh0bXB2YWx1ZSwgMCwgMC43NSk7XG5cbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDEsIGRhbWFnZSAtIChkYW1hZ2UgKiBhcm1vck1vZGlmaWVyKSk7XG4gICAgfVxufVxuIiwiZXhwb3J0IGludGVyZmFjZSBTdGF0VmFsdWVzIHtcbiAgICBhcD86IG51bWJlcjtcbiAgICBzdHI/OiBudW1iZXI7XG4gICAgYWdpPzogbnVtYmVyO1xuICAgIGhpdD86IG51bWJlcjtcbiAgICBjcml0PzogbnVtYmVyO1xuICAgIGhhc3RlPzogbnVtYmVyO1xuICAgIHN0YXRNdWx0PzogbnVtYmVyO1xuICAgIGRhbWFnZU11bHQ/OiBudW1iZXI7XG4gICAgYXJtb3JQZW5ldHJhdGlvbj86IG51bWJlcjtcbiAgICBwbHVzRGFtYWdlPzogbnVtYmVyO1xuXG4gICAgc3dvcmRTa2lsbD86IG51bWJlcjtcbiAgICBheGVTa2lsbD86IG51bWJlcjtcbiAgICBtYWNlU2tpbGw/OiBudW1iZXI7XG4gICAgZGFnZ2VyU2tpbGw/OiBudW1iZXI7XG4gICAgc3dvcmQySFNraWxsPzogbnVtYmVyO1xuICAgIGF4ZTJIU2tpbGw/OiBudW1iZXI7XG4gICAgbWFjZTJIU2tpbGw/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBTdGF0cyBpbXBsZW1lbnRzIFN0YXRWYWx1ZXMge1xuICAgIGFwITogbnVtYmVyO1xuICAgIHN0ciE6IG51bWJlcjtcbiAgICBhZ2khOiBudW1iZXI7XG4gICAgaGl0ITogbnVtYmVyO1xuICAgIGNyaXQhOiBudW1iZXI7XG4gICAgaGFzdGUhOiBudW1iZXI7XG4gICAgc3RhdE11bHQhOiBudW1iZXI7XG4gICAgZGFtYWdlTXVsdCE6IG51bWJlcjtcbiAgICBhcm1vclBlbmV0cmF0aW9uITogbnVtYmVyO1xuICAgIHBsdXNEYW1hZ2UhOiBudW1iZXI7XG5cbiAgICBzd29yZFNraWxsITogbnVtYmVyO1xuICAgIGF4ZVNraWxsITogbnVtYmVyO1xuICAgIG1hY2VTa2lsbCE6IG51bWJlcjtcbiAgICBkYWdnZXJTa2lsbCE6IG51bWJlcjtcbiAgICBzd29yZDJIU2tpbGwhOiBudW1iZXI7XG4gICAgYXhlMkhTa2lsbCE6IG51bWJlcjtcbiAgICBtYWNlMkhTa2lsbCE6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKHM/OiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuc2V0KHMpO1xuICAgIH1cblxuICAgIHNldChzPzogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLmFwID0gKHMgJiYgcy5hcCkgfHwgMDtcbiAgICAgICAgdGhpcy5zdHIgPSAocyAmJiBzLnN0cikgfHwgMDtcbiAgICAgICAgdGhpcy5hZ2kgPSAocyAmJiBzLmFnaSkgfHwgMDtcbiAgICAgICAgdGhpcy5oaXQgPSAocyAmJiBzLmhpdCkgfHwgMDtcbiAgICAgICAgdGhpcy5jcml0ID0gKHMgJiYgcy5jcml0KSB8fCAwO1xuICAgICAgICB0aGlzLmhhc3RlID0gKHMgJiYgcy5oYXN0ZSkgfHwgMTtcbiAgICAgICAgdGhpcy5zdGF0TXVsdCA9IChzICYmIHMuc3RhdE11bHQpIHx8IDE7XG4gICAgICAgIHRoaXMuZGFtYWdlTXVsdCA9IChzICYmIHMuZGFtYWdlTXVsdCkgfHwgMTtcbiAgICAgICAgdGhpcy5hcm1vclBlbmV0cmF0aW9uID0gKHMgJiYgcy5hcm1vclBlbmV0cmF0aW9uKSB8fCAwO1xuICAgICAgICB0aGlzLnBsdXNEYW1hZ2UgPSAocyAmJiBzLnBsdXNEYW1hZ2UpIHx8IDA7XG5cbiAgICAgICAgdGhpcy5zd29yZFNraWxsID0gKHMgJiYgcy5zd29yZFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmF4ZVNraWxsID0gKHMgJiYgcy5heGVTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5tYWNlU2tpbGwgPSAocyAmJiBzLm1hY2VTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5kYWdnZXJTa2lsbCA9IChzICYmIHMuZGFnZ2VyU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuc3dvcmQySFNraWxsID0gKHMgJiYgcy5zd29yZDJIU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuYXhlMkhTa2lsbCA9IChzICYmIHMuYXhlMkhTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5tYWNlMkhTa2lsbCA9IChzICYmIHMubWFjZTJIU2tpbGwpIHx8IDA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgYWRkKHM6IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5hcCArPSAocy5hcCB8fCAwKTtcbiAgICAgICAgdGhpcy5zdHIgKz0gKHMuc3RyIHx8IDApO1xuICAgICAgICB0aGlzLmFnaSArPSAocy5hZ2kgfHwgMCk7XG4gICAgICAgIHRoaXMuaGl0ICs9IChzLmhpdCB8fCAwKTtcbiAgICAgICAgdGhpcy5jcml0ICs9IChzLmNyaXQgfHwgMCk7XG4gICAgICAgIHRoaXMuaGFzdGUgKj0gKHMuaGFzdGUgfHwgMSk7XG4gICAgICAgIHRoaXMuc3RhdE11bHQgKj0gKHMuc3RhdE11bHQgfHwgMSk7XG4gICAgICAgIHRoaXMuZGFtYWdlTXVsdCAqPSAocy5kYW1hZ2VNdWx0IHx8IDEpO1xuICAgICAgICB0aGlzLmFybW9yUGVuZXRyYXRpb24gKz0gKHMuYXJtb3JQZW5ldHJhdGlvbiB8fCAwKTtcbiAgICAgICAgdGhpcy5wbHVzRGFtYWdlICs9IChzLnBsdXNEYW1hZ2UgfHwgMCk7XG5cbiAgICAgICAgdGhpcy5zd29yZFNraWxsICs9IChzLnN3b3JkU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuYXhlU2tpbGwgKz0gKHMuYXhlU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMubWFjZVNraWxsICs9IChzLm1hY2VTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5kYWdnZXJTa2lsbCArPSAocy5kYWdnZXJTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5zd29yZDJIU2tpbGwgKz0gKHMuc3dvcmQySFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmF4ZTJIU2tpbGwgKz0gKHMuYXhlMkhTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5tYWNlMkhTa2lsbCArPSAocy5tYWNlMkhTa2lsbCB8fCAwKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdGF0cywgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IFByb2MgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgY2xhc3MgQnVmZk1hbmFnZXIge1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgcHJpdmF0ZSBidWZmTGlzdDogQnVmZkFwcGxpY2F0aW9uW10gPSBbXTtcbiAgICBwcml2YXRlIGJ1ZmZPdmVyVGltZUxpc3Q6IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uW10gPSBbXTtcblxuICAgIGJhc2VTdGF0czogU3RhdHM7XG4gICAgc3RhdHM6IFN0YXRzO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJhc2VTdGF0czogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcbiAgICAgICAgdGhpcy5iYXNlU3RhdHMgPSBuZXcgU3RhdHMoYmFzZVN0YXRzKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IG5ldyBTdGF0cyh0aGlzLmJhc2VTdGF0cyk7XG4gICAgfVxuXG4gICAgZ2V0IG5leHRPdmVyVGltZVVwZGF0ZSgpIHtcbiAgICAgICAgbGV0IHJlcyA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHJlcyA9IE1hdGgubWluKHJlcywgYnVmZk9UQXBwLm5leHRVcGRhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIHByb2Nlc3MgbGFzdCB0aWNrIGJlZm9yZSBpdCBpcyByZW1vdmVkXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIGJ1ZmZPVEFwcC51cGRhdGUodGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbW92ZUV4cGlyZWRCdWZmcyh0aW1lKTtcblxuICAgICAgICB0aGlzLnN0YXRzLnNldCh0aGlzLmJhc2VTdGF0cyk7XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBzdGFja3MgPSBidWZmLnN0YXRzU3RhY2sgPyBzdGFja3MgOiAxO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFja3M7IGkrKykge1xuICAgICAgICAgICAgICAgIGJ1ZmYuYXBwbHkodGhpcy5zdGF0cywgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgYnVmZkFwcCBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBpZiAoYnVmZkFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmYuc3RhY2tzKSB7ICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvZ1N0YWNrSW5jcmVhc2UgPSB0aGlzLnBsYXllci5sb2cgJiYgKCFidWZmLm1heFN0YWNrcyB8fCBidWZmQXBwLnN0YWNrcyA8IGJ1ZmYubWF4U3RhY2tzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZi5pbml0aWFsU3RhY2tzKSB7IC8vIFRPRE8gLSBjaGFuZ2UgdGhpcyB0byBjaGFyZ2VzP1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnN0YWNrcysrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvZ1N0YWNrSW5jcmVhc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxheWVyLmxvZyEoYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZCAoJHtidWZmQXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZGApO1xuICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSBnYWluZWRgICsgKGJ1ZmYuc3RhY2tzID8gYCAoJHtidWZmLmluaXRpYWxTdGFja3MgfHwgMX0pYCA6ICcnKSk7XG5cbiAgICAgICAgaWYgKGJ1ZmYgaW5zdGFuY2VvZiBCdWZmT3ZlclRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5wdXNoKG5ldyBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbih0aGlzLnBsYXllciwgYnVmZiwgYXBwbHlUaW1lKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZMaXN0LnB1c2gobmV3IEJ1ZmZBcHBsaWNhdGlvbihidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBidWZmLmFkZChhcHBseVRpbWUsIHRoaXMucGxheWVyKTtcbiAgICB9XG5cbiAgICByZW1vdmUoYnVmZjogQnVmZiwgdGltZTogbnVtYmVyLCBmdWxsID0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmdWxsICYmIGJ1ZmYuc3RhY2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZhcHAuc3RhY2tzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9ICgke2J1ZmZhcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuc3RhY2tzID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBsb3N0YCk7XG4gICAgICAgICAgICAgICAgYnVmZmFwcC5idWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCA9IHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWU6IG51bWJlcikge1xuICAgICAgICBjb25zdCByZW1vdmVkQnVmZnM6IEJ1ZmZbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuZXhwaXJhdGlvblRpbWUgPD0gdGltZSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRCdWZmcy5wdXNoKGJ1ZmZhcHAuYnVmZik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmYgb2YgcmVtb3ZlZEJ1ZmZzKSB7XG4gICAgICAgICAgICBidWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBleHBpcmVkYCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzfHVuZGVmaW5lZDtcbiAgICBzdGFja3M6IGJvb2xlYW47XG4gICAgZHVyYXRpb246IG51bWJlcjtcbiAgICBpbml0aWFsU3RhY2tzPzogbnVtYmVyO1xuICAgIG1heFN0YWNrcz86IG51bWJlcjtcbiAgICBzdGF0c1N0YWNrOiBib29sZWFuOyAvLyBkbyB5b3UgYWRkIHRoZSBzdGF0IGJvbnVzIGZvciBlYWNoIHN0YWNrPyBvciBpcyBpdCBsaWtlIGZsdXJyeSB3aGVyZSB0aGUgc3RhY2sgaXMgb25seSB0byBjb3VudCBjaGFyZ2VzXG5cbiAgICBwcml2YXRlIGNoaWxkPzogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgc3RhdHM/OiBTdGF0VmFsdWVzLCBzdGFja3M/OiBib29sZWFuLCBpbml0aWFsU3RhY2tzPzogbnVtYmVyLCBtYXhTdGFja3M/OiBudW1iZXIsIGNoaWxkPzogQnVmZiwgc3RhdHNTdGFjayA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuc3RhY2tzID0gISFzdGFja3M7XG4gICAgICAgIHRoaXMuaW5pdGlhbFN0YWNrcyA9IGluaXRpYWxTdGFja3M7XG4gICAgICAgIHRoaXMubWF4U3RhY2tzID0gbWF4U3RhY2tzO1xuICAgICAgICB0aGlzLmNoaWxkID0gY2hpbGQ7XG4gICAgICAgIHRoaXMuc3RhdHNTdGFjayA9IHN0YXRzU3RhY2s7XG4gICAgfVxuXG4gICAgYXBwbHkoc3RhdHM6IFN0YXRzLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5zdGF0cykge1xuICAgICAgICAgICAgc3RhdHMuYWRkKHRoaXMuc3RhdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHt9XG5cbiAgICByZW1vdmUodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5jaGlsZCkge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLnJlbW92ZSh0aGlzLmNoaWxkLCB0aW1lLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmO1xuICAgIGV4cGlyYXRpb25UaW1lITogbnVtYmVyO1xuXG4gICAgc3RhY2tzVmFsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgfVxuXG4gICAgcmVmcmVzaCh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3MgPSB0aGlzLmJ1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxO1xuXG4gICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSB0aW1lICsgdGhpcy5idWZmLmR1cmF0aW9uICogMTAwMDtcblxuICAgICAgICBpZiAodGhpcy5idWZmLmR1cmF0aW9uID4gNjApIHtcbiAgICAgICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzdGFja3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YWNrc1ZhbDtcbiAgICB9XG5cbiAgICBzZXQgc3RhY2tzKHN0YWNrczogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc3RhY2tzVmFsID0gdGhpcy5idWZmLm1heFN0YWNrcyA/IE1hdGgubWluKHRoaXMuYnVmZi5tYXhTdGFja3MsIHN0YWNrcykgOiBzdGFja3M7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZk92ZXJUaW1lIGV4dGVuZHMgQnVmZiB7XG4gICAgdXBkYXRlRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQ7XG4gICAgdXBkYXRlSW50ZXJ2YWw6IG51bWJlclxuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0czogU3RhdFZhbHVlc3x1bmRlZmluZWQsIHVwZGF0ZUludGVydmFsOiBudW1iZXIsIHVwZGF0ZUY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGR1cmF0aW9uLCBzdGF0cyk7XG4gICAgICAgIHRoaXMudXBkYXRlRiA9IHVwZGF0ZUY7XG4gICAgICAgIHRoaXMudXBkYXRlSW50ZXJ2YWwgPSB1cGRhdGVJbnRlcnZhbDtcbiAgICB9XG59XG5cbmNsYXNzIEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uIGV4dGVuZHMgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmT3ZlclRpbWU7XG4gICAgbmV4dFVwZGF0ZSE6IG51bWJlcjtcbiAgICBwbGF5ZXI6IFBsYXllcjtcblxuICAgIGNvbnN0cnVjdG9yKHBsYXllcjogUGxheWVyLCBidWZmOiBCdWZmT3ZlclRpbWUsIGFwcGx5VGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKGJ1ZmYsIGFwcGx5VGltZSk7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICBzdXBlci5yZWZyZXNoKHRpbWUpO1xuICAgICAgICB0aGlzLm5leHRVcGRhdGUgPSB0aW1lICsgdGhpcy5idWZmLnVwZGF0ZUludGVydmFsO1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRpbWUgPj0gdGhpcy5uZXh0VXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLm5leHRVcGRhdGUgKz0gdGhpcy5idWZmLnVwZGF0ZUludGVydmFsO1xuICAgICAgICAgICAgdGhpcy5idWZmLnVwZGF0ZUYodGhpcy5wbGF5ZXIsIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZlByb2MgZXh0ZW5kcyBCdWZmIHtcbiAgICBwcm9jOiBQcm9jO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBwcm9jOiBQcm9jLCBjaGlsZD86IEJ1ZmYpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGQpO1xuICAgICAgICB0aGlzLnByb2MgPSBwcm9jO1xuICAgIH1cblxuICAgIGFkZCh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLmFkZCh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIuYWRkUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLnJlbW92ZSh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIucmVtb3ZlUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFdlYXBvbkVxdWlwZWQsIFdlYXBvblR5cGUsIEl0ZW1EZXNjcmlwdGlvbiwgSXRlbUVxdWlwZWQsIEl0ZW1TbG90LCBpc0VxdWlwZWRXZWFwb24sIGlzV2VhcG9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IHVyYW5kLCBjbGFtcCwgZnJhbmQgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBCdWZmTWFuYWdlciB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBQcm9jLCBMZWFybmVkU3dpbmdTcGVsbCwgU3BlbGxUeXBlLCBTcGVsbERhbWFnZSB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBMSF9DT1JFX0JVRyB9IGZyb20gXCIuL3NpbV9zZXR0aW5ncy5qc1wiO1xuaW1wb3J0IHsgRW5jaGFudERlc2NyaXB0aW9uIH0gZnJvbSBcIi4vZGF0YS9lbmNoYW50cy5qc1wiO1xuXG5leHBvcnQgZW51bSBSYWNlIHtcbiAgICBIVU1BTixcbiAgICBPUkMsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCB0eXBlIERhbWFnZUxvZyA9IFtudW1iZXIsIG51bWJlcl1bXTtcblxuZXhwb3J0IGNsYXNzIFBsYXllciBleHRlbmRzIFVuaXQge1xuICAgIGl0ZW1zOiBNYXA8SXRlbVNsb3QsIEl0ZW1FcXVpcGVkPiA9IG5ldyBNYXAoKTtcbiAgICBwcm9jczogUHJvY1tdID0gW107XG5cbiAgICB0YXJnZXQ6IFVuaXQgfCB1bmRlZmluZWQ7XG5cbiAgICBuZXh0R0NEVGltZSA9IDA7XG4gICAgZXh0cmFBdHRhY2tDb3VudCA9IDA7XG4gICAgZG9pbmdFeHRyYUF0dGFja3MgPSBmYWxzZTtcblxuICAgIGJ1ZmZNYW5hZ2VyOiBCdWZmTWFuYWdlcjtcblxuICAgIGRhbWFnZUxvZzogRGFtYWdlTG9nID0gW107XG5cbiAgICBxdWV1ZWRTcGVsbDogTGVhcm5lZFN3aW5nU3BlbGx8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgbG9nPzogTG9nRnVuY3Rpb247XG5cbiAgICBsYXRlbmN5ID0gNTA7IC8vIG1zXG5cbiAgICBwb3dlckxvc3QgPSAwO1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHN1cGVyKDYwLCAwKTsgLy8gbHZsLCBhcm1vclxuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIgPSBuZXcgQnVmZk1hbmFnZXIodGhpcywgbmV3IFN0YXRzKHN0YXRzKSk7XG4gICAgICAgIHRoaXMubG9nID0gbG9nO1xuICAgIH1cblxuICAgIGdldCBtaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5NQUlOSEFORCk7XG5cbiAgICAgICAgaWYgKGVxdWlwZWQgJiYgaXNFcXVpcGVkV2VhcG9uKGVxdWlwZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXF1aXBlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5PRkZIQU5EKTtcblxuICAgICAgICBpZiAoZXF1aXBlZCAmJiBpc0VxdWlwZWRXZWFwb24oZXF1aXBlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcXVpcGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZXF1aXAoc2xvdDogSXRlbVNsb3QsIGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgZW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbiwgdGVtcG9yYXJ5RW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbikge1xuICAgICAgICBpZiAodGhpcy5pdGVtcy5oYXMoc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFscmVhZHkgaGF2ZSBpdGVtIGluIHNsb3QgJHtJdGVtU2xvdFtzbG90XX1gKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEoaXRlbS5zbG90ICYgc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGNhbm5vdCBlcXVpcCAke2l0ZW0ubmFtZX0gaW4gc2xvdCAke0l0ZW1TbG90W3Nsb3RdfWApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5zdGF0cykge1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5iYXNlU3RhdHMuYWRkKGl0ZW0uc3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuY2hhbnQgJiYgZW5jaGFudC5zdGF0cykge1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5iYXNlU3RhdHMuYWRkKGVuY2hhbnQuc3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETyAtIGhhbmRsZSBlcXVpcHBpbmcgMkggKGFuZCBob3cgdGhhdCBkaXNhYmxlcyBPSClcbiAgICAgICAgLy8gVE9ETyAtIGFzc3VtaW5nIG9ubHkgd2VhcG9uIGVuY2hhbnRzIGNhbiBoYXZlIHByb2NzXG4gICAgICAgIGlmIChpc1dlYXBvbihpdGVtKSkge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IFdlYXBvbkVxdWlwZWQoaXRlbSwgdGhpcywgZW5jaGFudCwgdGVtcG9yYXJ5RW5jaGFudCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IEl0ZW1FcXVpcGVkKGl0ZW0sIHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwb3dlcigpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge31cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcmVtb3ZlUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIC8vIFRPRE8gLSBlaXRoZXIgcHJvY3Mgc2hvdWxkIGJlIGEgc2V0IG9yIHdlIG5lZWQgUHJvY0FwcGxpY2F0aW9uXG4gICAgICAgIHRoaXMucHJvY3MgPSB0aGlzLnByb2NzLmZpbHRlcigocHJvYzogUHJvYykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHByb2MgIT09IHA7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmIChzcGVsbCAmJiBzcGVsbC50eXBlICE9PSBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuICAgICAgICBjb25zdCB3ZWFwb25UeXBlID0gd2VhcG9uLndlYXBvbi50eXBlO1xuXG4gICAgICAgIC8vIFRPRE8sIG1ha2UgdGhpcyBhIG1hcFxuICAgICAgICBzd2l0Y2ggKHdlYXBvblR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5NQUNFOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLm1hY2VTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5TV09SRDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zd29yZFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkFYRTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5heGVTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5EQUdHRVI6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuZGFnZ2VyU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuTUFDRTJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLm1hY2UySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLlNXT1JEMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3dvcmQySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkFYRTJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmF4ZTJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgaWYgKExIX0NPUkVfQlVHICYmIHNwZWxsICYmIHNwZWxsLnR5cGUgPT0gU3BlbGxUeXBlLlBIWVNJQ0FMKSB7XG4gICAgICAgICAgICAvLyBvbiBMSCBjb3JlLCBub24gd2VhcG9uIHNwZWxscyBsaWtlIGJsb29kdGhpcnN0IGFyZSBiZW5lZml0dGluZyBmcm9tIHdlYXBvbiBza2lsbFxuICAgICAgICAgICAgLy8gdGhpcyBvbmx5IGFmZmVjdHMgY3JpdCwgbm90IGhpdC9kb2RnZS9wYXJyeVxuICAgICAgICAgICAgLy8gc2V0IHRoZSBzcGVsbCB0byB1bmRlZmluZWQgc28gaXQgaXMgdHJlYXRlZCBsaWtlIGEgbm9ybWFsIG1lbGVlIGF0dGFjayAocmF0aGVyIHRoYW4gdXNpbmcgYSBkdW1teSBzcGVsbClcbiAgICAgICAgICAgIC8vIHdoZW4gY2FsY3VsYXRpbmcgd2VhcG9uIHNraWxsXG4gICAgICAgICAgICBzcGVsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjcml0ID0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5jcml0O1xuICAgICAgICBjcml0ICs9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYWdpICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAvIDIwO1xuXG4gICAgICAgIGlmICghc3BlbGwgfHwgc3BlbGwudHlwZSA9PSBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OKSB7XG4gICAgICAgICAgICBjb25zdCB3ZWFwb24gPSBpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCE7XG5cbiAgICAgICAgICAgIGlmICh3ZWFwb24udGVtcG9yYXJ5RW5jaGFudCAmJiB3ZWFwb24udGVtcG9yYXJ5RW5jaGFudC5zdGF0cyAmJiB3ZWFwb24udGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5jcml0KSB7XG4gICAgICAgICAgICAgICAgY3JpdCArPSB3ZWFwb24udGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5jcml0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2tpbGxCb251cyA9IDAuMDQgKiAodGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oLCBzcGVsbCkgLSB2aWN0aW0ubWF4U2tpbGxGb3JMZXZlbCk7XG4gICAgICAgIGNyaXQgKz0gc2tpbGxCb251cztcblxuICAgICAgICByZXR1cm4gY3JpdDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlTWlzc0NoYW5jZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCByZXMgPSA1O1xuICAgICAgICByZXMgLT0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5oaXQ7XG5cbiAgICAgICAgaWYgKHRoaXMub2ggJiYgIXNwZWxsKSB7XG4gICAgICAgICAgICByZXMgKz0gMTk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLmRlZmVuc2VTa2lsbDtcblxuICAgICAgICBpZiAoc2tpbGxEaWZmIDwgLTEwKSB7XG4gICAgICAgICAgICByZXMgLT0gKHNraWxsRGlmZiArIDEwKSAqIDAuNCAtIDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMgLT0gc2tpbGxEaWZmICogMC4xO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNsYW1wKHJlcywgMCwgNjApO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVHbGFuY2luZ1JlZHVjdGlvbih2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuKSB7XG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHZpY3RpbS5kZWZlbnNlU2tpbGwgIC0gdGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oKTtcblxuICAgICAgICBpZiAoc2tpbGxEaWZmID49IDE1KSB7XG4gICAgICAgICAgICByZXR1cm4gMC42NTtcbiAgICAgICAgfSBlbHNlIGlmIChza2lsbERpZmYgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBza2lsbERpZmZUb1JlZHVjdGlvbltza2lsbERpZmZdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlU3dpbmdNaW5NYXhEYW1hZ2UoaXNfbWg6IGJvb2xlYW4pOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuXG4gICAgICAgIGNvbnN0IGFwX2JvbnVzID0gdGhpcy5hcCAvIDE0ICogd2VhcG9uLndlYXBvbi5zcGVlZDtcblxuICAgICAgICBjb25zdCBvaFBlbmFsdHkgPSBpc19taCA/IDEgOiAwLjYyNTsgLy8gVE9ETyAtIGNoZWNrIHRhbGVudHMsIGltcGxlbWVudGVkIGFzIGFuIGF1cmEgU1BFTExfQVVSQV9NT0RfT0ZGSEFORF9EQU1BR0VfUENUXG5cbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICh3ZWFwb24ubWluICsgYXBfYm9udXMpICogb2hQZW5hbHR5LFxuICAgICAgICAgICAgKHdlYXBvbi5tYXggKyBhcF9ib251cykgKiBvaFBlbmFsdHlcbiAgICAgICAgXTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZShpc19taDogYm9vbGVhbikge1xuICAgICAgICByZXR1cm4gZnJhbmQoLi4udGhpcy5jYWxjdWxhdGVTd2luZ01pbk1heERhbWFnZShpc19taCkpO1xuICAgIH1cblxuICAgIGNyaXRDYXAoKSB7XG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZSh0cnVlKSAtIHRoaXMudGFyZ2V0IS5tYXhTa2lsbEZvckxldmVsKTtcbiAgICAgICAgY29uc3QgbWlzc19jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlTWlzc0NoYW5jZSh0aGlzLnRhcmdldCEsIHRydWUpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLnRhcmdldCEuZG9kZ2VDaGFuY2UgKiAxMDApIC0gc2tpbGxCb251cztcbiAgICAgICAgY29uc3QgZ2xhbmNlX2NoYW5jZSA9IGNsYW1wKCgxMCArICh0aGlzLnRhcmdldCEuZGVmZW5zZVNraWxsIC0gMzAwKSAqIDIpICogMTAwLCAwLCA0MDAwKTtcblxuICAgICAgICByZXR1cm4gKDEwMDAwIC0gKG1pc3NfY2hhbmNlICsgZG9kZ2VfY2hhbmNlICsgZ2xhbmNlX2NoYW5jZSkpIC8gMTAwO1xuICAgIH1cblxuICAgIHJvbGxNZWxlZUhpdE91dGNvbWUodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgICAgIGNvbnN0IHJvbGwgPSB1cmFuZCgwLCAxMDAwMCk7XG4gICAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgICBsZXQgdG1wID0gMDtcblxuICAgICAgICAvLyByb3VuZGluZyBpbnN0ZWFkIG9mIHRydW5jYXRpbmcgYmVjYXVzZSAxOS40ICogMTAwIHdhcyB0cnVuY2F0aW5nIHRvIDE5MzkuXG4gICAgICAgIGNvbnN0IG1pc3NfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltLCBpc19taCwgc3BlbGwpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh2aWN0aW0uZG9kZ2VDaGFuY2UgKiAxMDApO1xuICAgICAgICBjb25zdCBjcml0X2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbSwgaXNfbWgsIHNwZWxsKSAqIDEwMCk7XG5cbiAgICAgICAgLy8gd2VhcG9uIHNraWxsIC0gdGFyZ2V0IGRlZmVuc2UgKHVzdWFsbHkgbmVnYXRpdmUpXG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuXG4gICAgICAgIHRtcCA9IG1pc3NfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBkb2RnZV9jaGFuY2UgLSBza2lsbEJvbnVzOyAvLyA1LjYgKDU2MCkgZm9yIGx2bCA2MyB3aXRoIDMwMCB3ZWFwb24gc2tpbGxcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3BlbGwpIHsgLy8gc3BlbGxzIGNhbid0IGdsYW5jZVxuICAgICAgICAgICAgdG1wID0gKDEwICsgKHZpY3RpbS5kZWZlbnNlU2tpbGwgLSAzMDApICogMikgKiAxMDA7XG4gICAgICAgICAgICB0bXAgPSBjbGFtcCh0bXAsIDAsIDQwMDApO1xuICAgIFxuICAgICAgICAgICAgaWYgKHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IGNyaXRfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUw7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgZGFtYWdlV2l0aEJvbnVzID0gcmF3RGFtYWdlO1xuXG4gICAgICAgIGRhbWFnZVdpdGhCb251cyAqPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhbWFnZU11bHQ7XG5cbiAgICAgICAgcmV0dXJuIGRhbWFnZVdpdGhCb251cztcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZVdpdGhCb251cyA9IHRoaXMuY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIHNwZWxsKTtcbiAgICAgICAgY29uc3QgYXJtb3JSZWR1Y2VkID0gdmljdGltLmNhbGN1bGF0ZUFybW9yUmVkdWNlZERhbWFnZShkYW1hZ2VXaXRoQm9udXMsIHRoaXMpO1xuICAgICAgICBjb25zdCBoaXRPdXRjb21lID0gdGhpcy5yb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcblxuICAgICAgICBsZXQgZGFtYWdlID0gYXJtb3JSZWR1Y2VkO1xuICAgICAgICBsZXQgY2xlYW5EYW1hZ2UgPSAwO1xuXG4gICAgICAgIHN3aXRjaCAoaGl0T3V0Y29tZSkge1xuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTpcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSAwO1xuICAgICAgICAgICAgICAgIGNsZWFuRGFtYWdlID0gZGFtYWdlV2l0aEJvbnVzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZHVjZVBlcmNlbnQgPSB0aGlzLmNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbSwgaXNfbWgpO1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IHJlZHVjZVBlcmNlbnQgKiBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlICo9IDI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW2RhbWFnZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUywgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIC8vIHdoYXQgaXMgdGhlIG9yZGVyIG9mIGNoZWNraW5nIGZvciBwcm9jcyBsaWtlIGhvaiwgaXJvbmZvZSBhbmQgd2luZGZ1cnlcbiAgICAgICAgICAgIC8vIG9uIExIIGNvcmUgaXQgaXMgaG9qID4gaXJvbmZvZSA+IHdpbmRmdXJ5XG4gICAgICAgICAgICAvLyBzbyBkbyBpdGVtIHByb2NzIGZpcnN0LCB0aGVuIHdlYXBvbiBwcm9jLCB0aGVuIHdpbmRmdXJ5XG4gICAgICAgICAgICBmb3IgKGxldCBwcm9jIG9mIHRoaXMucHJvY3MpIHtcbiAgICAgICAgICAgICAgICBwcm9jLnJ1bih0aGlzLCAoaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghKS53ZWFwb24sIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oISkucHJvYyh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlYWxNZWxlZURhbWFnZSh0aW1lOiBudW1iZXIsIHJhd0RhbWFnZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gdGhpcy5jYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2UsIHRhcmdldCwgaXNfbWgsIHNwZWxsKTtcbiAgICAgICAgZGFtYWdlRG9uZSA9IE1hdGgudHJ1bmMoZGFtYWdlRG9uZSk7IC8vIHRydW5jYXRpbmcgaGVyZSBiZWNhdXNlIHdhcnJpb3Igc3ViY2xhc3MgYnVpbGRzIG9uIHRvcCBvZiBjYWxjdWxhdGVNZWxlZURhbWFnZVxuICAgICAgICBjbGVhbkRhbWFnZSA9IE1hdGgudHJ1bmMoY2xlYW5EYW1hZ2UpOyAvLyBUT0RPLCBzaG91bGQgZGFtYWdlTXVsdCBhZmZlY3QgY2xlYW4gZGFtYWdlIGFzIHdlbGw/IGlmIHNvIG1vdmUgaXQgaW50byBjYWxjdWxhdGVNZWxlZURhbWFnZVxuXG4gICAgICAgIHRoaXMuZGFtYWdlTG9nLnB1c2goW3RpbWUsIGRhbWFnZURvbmVdKTtcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgbGV0IGhpdFN0ciA9IGBZb3VyICR7c3BlbGwgPyBzcGVsbC5uYW1lIDogKGlzX21oID8gJ21haW4taGFuZCcgOiAnb2ZmLWhhbmQnKX0gJHtoaXRPdXRjb21lU3RyaW5nW2hpdE91dGNvbWVdfWA7XG4gICAgICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlldLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAgICAgaGl0U3RyICs9IGAgZm9yICR7ZGFtYWdlRG9uZX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgaGl0U3RyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcGVsbCBpbnN0YW5jZW9mIFNwZWxsRGFtYWdlKSB7XG4gICAgICAgICAgICBpZiAoc3BlbGwuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAvLyBjYWxsaW5nIHRoaXMgYmVmb3JlIHVwZGF0ZSBwcm9jcyBiZWNhdXNlIGluIHRoZSBjYXNlIG9mIGV4ZWN1dGUsIHVuYnJpZGxlZCB3cmF0aCBjb3VsZCBwcm9jXG4gICAgICAgICAgICAgICAgLy8gdGhlbiBzZXR0aW5nIHRoZSByYWdlIHRvIDAgd291bGQgY2F1c2UgdXMgdG8gbG9zZSB0aGUgMSByYWdlIGZyb20gdW5icmlkbGVkIHdyYXRoXG4gICAgICAgICAgICAgICAgLy8gYWx0ZXJuYXRpdmUgaXMgdG8gc2F2ZSB0aGUgYW1vdW50IG9mIHJhZ2UgdXNlZCBmb3IgdGhlIGFiaWxpdHlcbiAgICAgICAgICAgICAgICBzcGVsbC5jYWxsYmFjayh0aGlzLCBoaXRPdXRjb21lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3BlbGwgfHwgc3BlbGwuY2FuUHJvYykge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIHNwZWxsKTtcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIudXBkYXRlKHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVhbFNwZWxsRGFtYWdlKHRpbWU6IG51bWJlciwgcmF3RGFtYWdlOiBudW1iZXIsIHRhcmdldDogVW5pdCwgc3BlbGw6IFNwZWxsKSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZURvbmUgPSByYXdEYW1hZ2U7XG5cbiAgICAgICAgdGhpcy5kYW1hZ2VMb2cucHVzaChbdGltZSwgZGFtYWdlRG9uZV0pO1xuXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgYCR7c3BlbGwubmFtZX0gaGl0cyBmb3IgJHtkYW1hZ2VEb25lfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHN3aW5nV2VhcG9uKHRpbWU6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBjb25zdCByYXdEYW1hZ2UgPSB0aGlzLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyAmJiBpc19taCAmJiB0aGlzLnF1ZXVlZFNwZWxsICYmIHRoaXMucXVldWVkU3BlbGwuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRTcGVsbC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgY29uc3Qgc3dpbmdTcGVsbCA9IHRoaXMucXVldWVkU3BlbGwuc3BlbGw7XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFNwZWxsID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgY29uc3QgYm9udXNEYW1hZ2UgPSBzd2luZ1NwZWxsLmJvbnVzRGFtYWdlO1xuICAgICAgICAgICAgdGhpcy5kZWFsTWVsZWVEYW1hZ2UodGltZSwgcmF3RGFtYWdlICsgYm9udXNEYW1hZ2UsIHRhcmdldCwgaXNfbWgsIHN3aW5nU3BlbGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWFsTWVsZWVEYW1hZ2UodGltZSwgcmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IFt0aGlzV2VhcG9uLCBvdGhlcldlYXBvbl0gPSBpc19taCA/IFt0aGlzLm1oLCB0aGlzLm9oXSA6IFt0aGlzLm9oLCB0aGlzLm1oXTtcblxuICAgICAgICB0aGlzV2VhcG9uIS5uZXh0U3dpbmdUaW1lID0gdGltZSArIHRoaXNXZWFwb24hLndlYXBvbi5zcGVlZCAvIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuaGFzdGUgKiAxMDAwO1xuXG4gICAgICAgIGlmIChvdGhlcldlYXBvbiAmJiBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lIDwgdGltZSArIDIwMCkge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGRlbGF5aW5nICR7aXNfbWggPyAnT0gnIDogJ01IJ30gc3dpbmdgLCB0aW1lICsgMjAwIC0gb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSk7XG4gICAgICAgICAgICBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lID0gdGltZSArIDIwMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUF0dGFja2luZ1N0YXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy50YXJnZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHRoaXMuZXh0cmFBdHRhY2tDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXh0cmFBdHRhY2tDb3VudC0tO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aW1lID49IHRoaXMubWghLm5leHRTd2luZ1RpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCB0cnVlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5vaCAmJiB0aW1lID49IHRoaXMub2gubmV4dFN3aW5nVGltZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciwgTWVsZWVIaXRPdXRjb21lLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmT3ZlclRpbWUsIEJ1ZmZQcm9jIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBMZWFybmVkU3BlbGwsIFNwZWxsRGFtYWdlLCBTcGVsbFR5cGUsIFN3aW5nU3BlbGwsIExlYXJuZWRTd2luZ1NwZWxsLCBQcm9jLCBTcGVsbEJ1ZmYsIFNwZWxsRmFtaWx5IH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IGNsYW1wIH0gZnJvbSBcIi4vbWF0aC5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuXG5jb25zdCBmbHVycnkgPSBuZXcgQnVmZihcIkZsdXJyeVwiLCAxNSwge2hhc3RlOiAxLjN9LCB0cnVlLCAzLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG5leHBvcnQgY29uc3QgcmFjZVRvU3RhdHMgPSBuZXcgTWFwPFJhY2UsIFN0YXRWYWx1ZXM+KCk7XG5yYWNlVG9TdGF0cy5zZXQoUmFjZS5IVU1BTiwgeyBtYWNlU2tpbGw6IDUsIHN3b3JkU2tpbGw6IDUsIG1hY2UySFNraWxsOiA1LCBzd29yZDJIU2tpbGw6IDUsIHN0cjogMTIwLCBhZ2k6IDgwIH0pO1xucmFjZVRvU3RhdHMuc2V0KFJhY2UuT1JDLCB7IGF4ZVNraWxsOiA1LCBheGUySFNraWxsOiA1LCBzdHI6IDEyMywgYWdpOiA3NyB9KTtcblxuZXhwb3J0IGNsYXNzIFdhcnJpb3IgZXh0ZW5kcyBQbGF5ZXIge1xuICAgIHJhZ2UgPSA4MDsgLy8gVE9ETyAtIGFsbG93IHNpbXVsYXRpb24gdG8gY2hvb3NlIHN0YXJ0aW5nIHJhZ2VcblxuICAgIGV4ZWN1dGUgPSBuZXcgTGVhcm5lZFNwZWxsKGV4ZWN1dGVTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2R0aGlyc3QgPSBuZXcgTGVhcm5lZFNwZWxsKGJsb29kdGhpcnN0U3BlbGwsIHRoaXMpO1xuICAgIGhhbXN0cmluZyA9IG5ldyBMZWFybmVkU3BlbGwoaGFtc3RyaW5nU3BlbGwsIHRoaXMpO1xuICAgIHdoaXJsd2luZCA9IG5ldyBMZWFybmVkU3BlbGwod2hpcmx3aW5kU3BlbGwsIHRoaXMpO1xuICAgIGhlcm9pY1N0cmlrZSA9IG5ldyBMZWFybmVkU3dpbmdTcGVsbChoZXJvaWNTdHJpa2VTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2RSYWdlID0gbmV3IExlYXJuZWRTcGVsbChibG9vZFJhZ2UsIHRoaXMpO1xuICAgIGRlYXRoV2lzaCA9IG5ldyBMZWFybmVkU3BlbGwoZGVhdGhXaXNoLCB0aGlzKTtcbiAgICBleGVjdXRlU3BlbGwgPSBuZXcgTGVhcm5lZFNwZWxsKGV4ZWN1dGVTcGVsbCwgdGhpcyk7XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgbG9nQ2FsbGJhY2s/OiAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICAgICAgc3VwZXIobmV3IFN0YXRzKHJhY2VUb1N0YXRzLmdldChyYWNlKSkuYWRkKHN0YXRzKSwgbG9nQ2FsbGJhY2spO1xuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYWRkKGFuZ2VyTWFuYWdlbWVudE9ULCBNYXRoLnJhbmRvbSgpICogLTMwMDApOyAvLyByYW5kb21pemluZyBhbmdlciBtYW5hZ2VtZW50IHRpbWluZ1xuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZCh1bmJyaWRsZWRXcmF0aCwgMCk7XG4gICAgfVxuXG4gICAgZ2V0IHBvd2VyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yYWdlO1xuICAgIH1cblxuICAgIHNldCBwb3dlcihwb3dlcjogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMucG93ZXJMb3N0ICs9IE1hdGgubWF4KDAsIHBvd2VyIC0gMTAwKTtcbiAgICAgICAgdGhpcy5yYWdlID0gY2xhbXAocG93ZXIsIDAsIDEwMCk7XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sZXZlbCAqIDMgLSAyMCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXAgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0ciAqIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RhdE11bHQgKiAyO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICAvLyBjcnVlbHR5ICsgYmVyc2Vya2VyIHN0YW5jZVxuICAgICAgICByZXR1cm4gNSArIDMgKyBzdXBlci5jYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gc3VwZXIuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIGlzX21oLCBzcGVsbCk7XG5cbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCAmJiBzcGVsbCAmJiBzcGVsbC5mYW1pbHkgPT09IFNwZWxsRmFtaWx5LldBUlJJT1IpIHtcbiAgICAgICAgICAgIGRhbWFnZURvbmUgKj0gMS4xOyAvLyBpbXBhbGVcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIFtkYW1hZ2VEb25lLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV07XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHJld2FyZFJhZ2UoZGFtYWdlOiBudW1iZXIsIGlzX2F0dGFja2VyOiBib29sZWFuLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgLy8gaHR0cHM6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvMTgzMjUtdGhlLW5ldy1yYWdlLWZvcm11bGEtYnkta2FsZ2FuL1xuICAgICAgICAvLyBQcmUtRXhwYW5zaW9uIFJhZ2UgR2FpbmVkIGZyb20gZGVhbGluZyBkYW1hZ2U6XG4gICAgICAgIC8vIChEYW1hZ2UgRGVhbHQpIC8gKFJhZ2UgQ29udmVyc2lvbiBhdCBZb3VyIExldmVsKSAqIDcuNVxuICAgICAgICAvLyBGb3IgVGFraW5nIERhbWFnZSAoYm90aCBwcmUgYW5kIHBvc3QgZXhwYW5zaW9uKTpcbiAgICAgICAgLy8gUmFnZSBHYWluZWQgPSAoRGFtYWdlIFRha2VuKSAvIChSYWdlIENvbnZlcnNpb24gYXQgWW91ciBMZXZlbCkgKiAyLjVcbiAgICAgICAgLy8gUmFnZSBDb252ZXJzaW9uIGF0IGxldmVsIDYwOiAyMzAuNlxuICAgICAgICAvLyBUT0RPIC0gaG93IGRvIGZyYWN0aW9ucyBvZiByYWdlIHdvcms/IGl0IGFwcGVhcnMgeW91IGRvIGdhaW4gZnJhY3Rpb25zIGJhc2VkIG9uIGV4ZWMgZGFtYWdlXG4gICAgICAgIC8vIG5vdCB0cnVuY2F0aW5nIGZvciBub3dcbiAgICAgICAgLy8gVE9ETyAtIGl0IGFwcGVhcnMgdGhhdCByYWdlIGlzIGNhbGN1bGF0ZWQgdG8gdGVudGhzIGJhc2VkIG9uIGRhdGFiYXNlIHZhbHVlcyBvZiBzcGVsbHMgKDEwIGVuZXJneSA9IDEgcmFnZSlcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IExFVkVMXzYwX1JBR0VfQ09OViA9IDIzMC42O1xuICAgICAgICBsZXQgYWRkUmFnZSA9IGRhbWFnZSAvIExFVkVMXzYwX1JBR0VfQ09OVjtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc19hdHRhY2tlcikge1xuICAgICAgICAgICAgYWRkUmFnZSAqPSA3LjU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUT0RPIC0gY2hlY2sgZm9yIGJlcnNlcmtlciByYWdlIDEuM3ggbW9kaWZpZXJcbiAgICAgICAgICAgIGFkZFJhZ2UgKj0gMi41O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubG9nKSB0aGlzLmxvZyh0aW1lLCBgR2FpbmVkICR7TWF0aC5taW4oYWRkUmFnZSwgMTAwIC0gdGhpcy5yYWdlKX0gcmFnZSAoJHtNYXRoLm1pbigxMDAsIHRoaXMucG93ZXIgKyBhZGRSYWdlKX0pYCk7XG5cbiAgICAgICAgdGhpcy5wb3dlciArPSBhZGRSYWdlO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZVByb2NzKHRpbWUsIGlzX21oLCBoaXRPdXRjb21lLCBkYW1hZ2VEb25lLCBjbGVhbkRhbWFnZSwgc3BlbGwpO1xuXG4gICAgICAgIGlmIChbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIGlmIChzcGVsbCkge1xuICAgICAgICAgICAgICAgIC8vIGh0dHA6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvNjkzNjUtMTgtMDItMDUta2FsZ2Fucy1yZXNwb25zZS10by13YXJyaW9ycy8gXCJzaW5jZSBtaXNzaW5nIHdhc3RlcyAyMCUgb2YgdGhlIHJhZ2UgY29zdCBvZiB0aGUgYWJpbGl0eVwiXG4gICAgICAgICAgICAgICAgLy8gVE9ETyAtIG5vdCBzdXJlIGhvdyBibGl6emxpa2UgdGhpcyBpc1xuICAgICAgICAgICAgICAgIGlmIChzcGVsbCAhPT0gd2hpcmx3aW5kU3BlbGwpIHsgLy8gVE9ETyAtIHNob3VsZCBjaGVjayB0byBzZWUgaWYgaXQgaXMgYW4gYW9lIHNwZWxsIG9yIGEgc2luZ2xlIHRhcmdldCBzcGVsbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJhZ2UgKz0gc3BlbGwuY29zdCAqIDAuODI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoY2xlYW5EYW1hZ2UgKiAwLjc1LCB0cnVlLCB0aW1lKTsgLy8gVE9ETyAtIHdoZXJlIGlzIHRoaXMgZm9ybXVsYSBmcm9tP1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRhbWFnZURvbmUgJiYgIXNwZWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoZGFtYWdlRG9uZSwgdHJ1ZSwgdGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnN0YW50IGF0dGFja3MgYW5kIG1pc3Nlcy9kb2RnZXMgZG9uJ3QgdXNlIGZsdXJyeSBjaGFyZ2VzIC8vIFRPRE8gLSBjb25maXJtLCB3aGF0IGFib3V0IHBhcnJ5P1xuICAgICAgICAvLyBleHRyYSBhdHRhY2tzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyBidXQgdGhleSBjYW4gcHJvYyBmbHVycnkgKHRlc3RlZClcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXRoaXMuZG9pbmdFeHRyYUF0dGFja3NcbiAgICAgICAgICAgICYmICghc3BlbGwgfHwgc3BlbGwgPT09IGhlcm9pY1N0cmlrZVNwZWxsKVxuICAgICAgICAgICAgJiYgIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpXG4gICAgICAgICAgICAmJiBoaXRPdXRjb21lICE9PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVRcbiAgICAgICAgKSB7IFxuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5yZW1vdmUoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCkge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGlnbm9yaW5nIGRlZXAgd291bmRzXG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChmbHVycnksIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZXJvaWNTdHJpa2VTcGVsbCA9IG5ldyBTd2luZ1NwZWxsKFwiSGVyb2ljIFN0cmlrZVwiLCBTcGVsbEZhbWlseS5XQVJSSU9SLCAxNTcsIDEyKTtcblxuLy8gZXhlY3V0ZSBhY3R1YWxseSB3b3JrcyBieSBjYXN0aW5nIHR3byBzcGVsbHMsIGZpcnN0IHJlcXVpcmVzIHdlYXBvbiBidXQgZG9lcyBubyBkYW1hZ2Vcbi8vIHNlY29uZCBvbmUgZG9lc24ndCByZXF1aXJlIHdlYXBvbiBhbmQgZGVhbHMgdGhlIGRhbWFnZS5cbi8vIExIIGNvcmUgb3ZlcnJvZGUgdGhlIHNlY29uZCBzcGVsbCB0byByZXF1aXJlIHdlYXBvbiAoYmVuZWZpdCBmcm9tIHdlYXBvbiBza2lsbClcbmNvbnN0IGV4ZWN1dGVTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkV4ZWN1dGVcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIDYwMCArIChwbGF5ZXIucG93ZXIgLSAxMCkgKiAxNTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDEwLCAwLCAocGxheWVyOiBQbGF5ZXIsIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSkgPT4ge1xuICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTU10uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgcGxheWVyLnBvd2VyID0gMDtcbiAgICB9XG59KTtcblxuY29uc3QgYmxvb2R0aGlyc3RTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkJsb29kdGhpcnN0XCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiAoPFdhcnJpb3I+cGxheWVyKS5hcCAqIDAuNDU7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUwsIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDMwLCA2KTtcblxuY29uc3Qgd2hpcmx3aW5kU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJXaGlybHdpbmRcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIHBsYXllci5jYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZSh0cnVlKTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDI1LCAxMCk7XG5cbmNvbnN0IGhhbXN0cmluZ1NwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiSGFtc3RyaW5nXCIsIDQ1LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBTcGVsbEZhbWlseS5XQVJSSU9SLCB0cnVlLCAxMCwgMCk7XG5cbmV4cG9ydCBjb25zdCBhbmdlck1hbmFnZW1lbnRPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJBbmdlciBNYW5hZ2VtZW50XCIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCB1bmRlZmluZWQsIDMwMDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgcGxheWVyLnBvd2VyICs9IDE7XG4gICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluZWQgMSByYWdlIGZyb20gQW5nZXIgTWFuYWdlbWVudGApO1xufSk7XG5cbmNvbnN0IGJsb29kUmFnZU9UID0gbmV3IEJ1ZmZPdmVyVGltZShcIkJsb29kcmFnZVwiLCAxMCwgdW5kZWZpbmVkLCAxMDAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbmVkIDEgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xufSk7XG5cbmNvbnN0IGJsb29kUmFnZSA9IG5ldyBTcGVsbChcIkJsb29kcmFnZVwiLCBTcGVsbFR5cGUuTk9ORSwgU3BlbGxGYW1pbHkuV0FSUklPUiwgZmFsc2UsIDAsIDYwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxMDtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMTAgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xuICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYmxvb2RSYWdlT1QsIHRpbWUpO1xufSk7XG5cbmNvbnN0IGRlYXRoV2lzaCA9IG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJEZWF0aCBXaXNoXCIsIDMwLCB7IGRhbWFnZU11bHQ6IDEuMiB9KSwgdHJ1ZSwgMTAsIDMgKiA2MCk7XG5cbmNvbnN0IHVuYnJpZGxlZFdyYXRoID0gbmV3IEJ1ZmZQcm9jKFwiVW5icmlkbGVkIFdyYXRoXCIsIDYwICogNjAsXG4gICAgbmV3IFByb2MoXG4gICAgICAgIG5ldyBTcGVsbChcIlVuYnJpZGxlZCBXcmF0aFwiLCBTcGVsbFR5cGUuTk9ORSwgU3BlbGxGYW1pbHkuV0FSUklPUiwgZmFsc2UsIDAsIDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMSByYWdlIGZyb20gVW5icmlkbGVkIFdyYXRoYCk7XG4gICAgICAgICAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICAgICAgfSksXG4gICAgICAgIHtjaGFuY2U6IDQwfSkpO1xuIiwiaW1wb3J0IHsgUHJvYywgU3BlbGxCdWZmLCBFeHRyYUF0dGFjayB9IGZyb20gXCIuLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1TbG90IH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEVuY2hhbnREZXNjcmlwdGlvbiB7XG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNsb3Q6IEl0ZW1TbG90LFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbiAgICBwcm9jPzogUHJvY1xufVxuXG5leHBvcnQgY29uc3QgZW5jaGFudHM6IEVuY2hhbnREZXNjcmlwdGlvbltdID0gW1xuICAgIHtcbiAgICAgICAgLy8gTk9URTogdG8gc2ltcGxpZnkgdGhlIGNvZGUsIHRyZWF0aW5nIHRoZXNlIGFzIHR3byBzZXBhcmF0ZSBidWZmcyBzaW5jZSB0aGV5IHN0YWNrXG4gICAgICAgIC8vIGNydXNhZGVyIGJ1ZmZzIGFwcGFyZW50bHkgY2FuIGJlIGZ1cnRoZXIgc3RhY2tlZCBieSBzd2FwcGluZyB3ZWFwb25zIGJ1dCBub3QgZ29pbmcgdG8gYm90aGVyIHdpdGggdGhhdFxuICAgICAgICBuYW1lOiAnQ3J1c2FkZXIgTUgnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgcHJvYzogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE1IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pLFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQ3J1c2FkZXIgT0gnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBwcm9jOiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiQ3J1c2FkZXIgT0hcIiwgMTUsIG5ldyBTdGF0cyh7c3RyOiAxMDB9KSkpLCB7cHBtOiAxfSksXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICc4IFN0cmVuZ3RoJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCB8IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA4fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzE1IEFnaWxpdHknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE1fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzEgSGFzdGUnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IRUFEIHwgSXRlbVNsb3QuTEVHUyB8IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge2hhc3RlOiAxLjAxfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzMgQWdpbGl0eScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7YWdpOiAzfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1pHIEVuY2hhbnQgKDMwIEFQKScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge2FwOiAzMH0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdHcmVhdGVyIFN0YXRzICgrNCknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDQsIGFnaTogNH0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICc5IFN0cmVuZ3RoJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV1JJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA5fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1J1biBTcGVlZCcsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7fSwgLy8gVE9ETyAtIGRvIG1vdmVtZW50IHNwZWVkIGlmIEkgZXZlciBnZXQgYXJvdW5kIHRvIHNpbXVsYXRpbmcgZmlnaHRzIHlvdSBoYXZlIHRvIHJ1biBvdXRcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzcgQWdpbGl0eScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7YWdpOiA3fSxcbiAgICB9LFxuXTtcblxuZXhwb3J0IGNvbnN0IHRlbXBvcmFyeUVuY2hhbnRzOiBFbmNoYW50RGVzY3JpcHRpb25bXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6ICcrOCBEYW1hZ2UnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCB8IEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIHN0YXRzOiB7IHBsdXNEYW1hZ2U6IDggfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0VsZW1lbnRhbCBTaGFycGVuaW5nIFN0b25lJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQgfCBJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBzdGF0czogeyBjcml0OiAyIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdXaW5kZnVyeScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBwcm9jOiBuZXcgUHJvYyhbXG4gICAgICAgICAgICBuZXcgRXh0cmFBdHRhY2soXCJXaW5kZnVyeSBUb3RlbVwiLCAxKSxcbiAgICAgICAgICAgIG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJXaW5kZnVyeSBUb3RlbVwiLCAxLjUsIHsgYXA6IDMxNSB9KSlcbiAgICAgICAgXSwge2NoYW5jZTogMC4yfSksXG4gICAgfVxuXTtcbiIsImltcG9ydCB7IFdlYXBvblR5cGUsIFdlYXBvbkRlc2NyaXB0aW9uLCBJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uIH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcbmltcG9ydCB7IFNwZWxsQnVmZiwgRXh0cmFBdHRhY2ssIFByb2MsIFNwZWxsVHlwZSwgSXRlbVNwZWxsRGFtYWdlLCBTcGVsbERhbWFnZSwgU3BlbGxGYW1pbHkgfSBmcm9tIFwiLi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IEJ1ZmYsIEJ1ZmZQcm9jIH0gZnJvbSBcIi4uL2J1ZmYuanNcIjtcblxuLy8gVE9ETyAtIGhvdyB0byBpbXBsZW1lbnQgc2V0IGJvbnVzZXM/IHByb2JhYmx5IGVhc2llc3QgdG8gYWRkIGJvbnVzIHRoYXQgcmVxdWlyZXMgYSBzdHJpbmcgc2VhcmNoIG9mIG90aGVyIGVxdWlwZWQgaXRlbXNcblxuZXhwb3J0IGNvbnN0IGl0ZW1zOiAoSXRlbURlc2NyaXB0aW9ufFdlYXBvbkRlc2NyaXB0aW9uKVtdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogXCJJcm9uZm9lXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIG1pbjogNzMsXG4gICAgICAgIG1heDogMTM2LFxuICAgICAgICBzcGVlZDogMi40LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IEV4dHJhQXR0YWNrKCdJcm9uZm9lJywgMikse3BwbTogMX0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRW1weXJlYW4gRGVtb2xpc2hlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDk0LFxuICAgICAgICBtYXg6IDE3NSxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJIYXN0ZSAoRW1weXJlYW4gRGVtb2xpc2hlcilcIiwgMTAsIHtoYXN0ZTogMS4yfSkpLHtwcG06IDF9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFudWJpc2F0aCBXYXJoYW1tZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDY2LFxuICAgICAgICBtYXg6IDEyMyxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgbWFjZVNraWxsOiA0LCBhcDogMzIgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRoZSBVbnRhbWVkIEJsYWRlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQySCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogMTkyLFxuICAgICAgICBtYXg6IDI4OSxcbiAgICAgICAgc3BlZWQ6IDMuNCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJVbnRhbWVkIEZ1cnlcIiwgOCwge3N0cjogMzAwfSkpLHtwcG06IDJ9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1pc3BsYWNlZCBTZXJ2byBBcm1cIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEyOCxcbiAgICAgICAgbWF4OiAyMzgsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIG9uZXF1aXA6IG5ldyBQcm9jKG5ldyBTcGVsbERhbWFnZShcIkVsZWN0cmljIERpc2NoYXJnZVwiLCBbMTAwLCAxNTFdLCBTcGVsbFR5cGUuTUFHSUMsIFNwZWxsRmFtaWx5Lk5PTkUpLHtwcG06IDN9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhhbmQgb2YgSnVzdGljZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiAyMH0sXG4gICAgICAgIG9uZXF1aXA6IG5ldyBQcm9jKG5ldyBFeHRyYUF0dGFjaygnSGFuZCBvZiBKdXN0aWNlJywgMSksIHtjaGFuY2U6IDIvMTAwfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGFja2hhbmQncyBCcmVhZHRoXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEcmFrZSBGYW5nIFRhbGlzbWFuXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDU2LCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTGlvbmhlYXJ0IEhlbG1cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCxcbiAgICAgICAgc3RhdHM6IHtjcml0OiAyLCBoaXQ6IDIsIHN0cjogMTh9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmFyYmVkIENob2tlclwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5ORUNLLFxuICAgICAgICBzdGF0czoge2FwOiA0NCwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJPbnl4aWEgVG9vdGggUGVuZGFudFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5ORUNLLFxuICAgICAgICBzdGF0czoge2FnaTogMTIsIGhpdDogMSwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBTcGF1bGRlcnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNsb2FrIG9mIERyYWNvbmljIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNiwgYWdpOiAxNn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEcmFwZSBvZiBVbnlpZWxkaW5nIFN0cmVuZ3RoXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNSwgYWdpOiA5LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgQnJlYXN0cGxhdGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNhdmFnZSBHbGFkaWF0b3IgQ2hhaW5cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxNCwgc3RyOiAxMywgY3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHaG91bCBTa2luIFR1bmljXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogNDAsIGNyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQnJlYXN0cGxhdGUgb2YgQW5uaWhpbGF0aW9uXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogMzcsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJIaXZlIERlZmlsZXIgV3Jpc3RndWFyZHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV1JJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMywgYWdpOiAxOH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJRaXJhamkgRXhlY3V0aW9uIEJyYWNlcnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV1JJU1QsXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxNiwgc3RyOiAxNSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdhdW50bGV0cyBvZiBNaWdodFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIyLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2F1bnRsZXRzIG9mIEFubmloaWxhdGlvblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDM1LCBjcml0OiAxLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRWRnZW1hc3RlcidzIEhhbmRndWFyZHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7IGF4ZVNraWxsOiA3LCBkYWdnZXJTa2lsbDogNywgc3dvcmRTa2lsbDogNyB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQWdlZCBDb3JlIExlYXRoZXIgR2xvdmVzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czogeyBzdHI6IDE1LCBjcml0OiAxLCBkYWdnZXJTa2lsbDogNSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiT25zbGF1Z2h0IEdpcmRsZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XQUlTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDMxLCBjcml0OiAxLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVGl0YW5pYyBMZWdnaW5nc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5MRUdTLFxuICAgICAgICBzdGF0czoge3N0cjogMzAsIGNyaXQ6IDEsIGhpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBMZWdndWFyZHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDIxLCBzdHI6IDMzLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQm9vdHMgb2YgdGhlIEZhbGxlbiBIZXJvXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNocm9tYXRpYyBCb290c1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMjAsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTdHJpa2VyJ3MgTWFya1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SQU5HRUQsXG4gICAgICAgIHN0YXRzOiB7YXA6IDIyLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUXVpY2sgU3RyaWtlIFJpbmdcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDMwLCBjcml0OiAxLCBzdHI6IDV9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmluZyBvZiB0aGUgUWlyYWppIEZ1cnlcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDQwLCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1hc3RlciBEcmFnb25zbGF5ZXIncyBSaW5nXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge2FwOiA0OCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRvbiBKdWxpbydzIEJhbmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMSwgaGl0OiAxLCBhcDogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVmlzJ2thZyB0aGUgQmxvb2RsZXR0ZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDAsXG4gICAgICAgIG1heDogMTg3LFxuICAgICAgICBzcGVlZDogMi42LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IEl0ZW1TcGVsbERhbWFnZShcIkZhdGFsIFdvdW5kc1wiLCAyNDAsIFNwZWxsVHlwZS5QSFlTSUNBTCkse3BwbTogMS4zfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWNhbGx5IFRlbXBlcmVkIFN3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTA2LFxuICAgICAgICBtYXg6IDE5OCxcbiAgICAgICAgc3BlZWQ6IDIuNixcbiAgICAgICAgc3RhdHM6IHsgYWdpOiAxNCwgc3RyOiAxNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFsYWRhdGgsIFJ1bmVkIEJsYWRlIG9mIHRoZSBCbGFjayBGbGlnaHRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4NixcbiAgICAgICAgbWF4OiAxNjIsXG4gICAgICAgIHNwZWVkOiAyLjIsXG4gICAgICAgIHN0YXRzOiB7IHN3b3JkU2tpbGw6IDQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFuY2llbnQgUWlyYWppIFJpcHBlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExNCxcbiAgICAgICAgbWF4OiAyMTMsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyMCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSWJsaXMsIEJsYWRlIG9mIHRoZSBGYWxsZW4gU2VyYXBoXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNzAsXG4gICAgICAgIG1heDogMTMxLFxuICAgICAgICBzcGVlZDogMS42LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBoaXQ6IDEsIGFwOiAyNiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR3Jlc3NpbCwgRGF3biBvZiBSdWluXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDI1NyxcbiAgICAgICAgc3BlZWQ6IDIuNyxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDQwIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaGUgSHVuZ2VyaW5nIENvbGRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA3NixcbiAgICAgICAgbWF4OiAxNDMsXG4gICAgICAgIHNwZWVkOiAxLjUsXG4gICAgICAgIHN0YXRzOiB7IHN3b3JkU2tpbGw6IDYgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBNYWNlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBMb25nc3dvcmRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBTd2lmdGJsYWRlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODUsXG4gICAgICAgIG1heDogMTI5LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhhdGNoZXQgb2YgU3VuZGVyZWQgQm9uZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMTksXG4gICAgICAgIG1heDogMjIxLFxuICAgICAgICBzcGVlZDogMi42LFxuICAgICAgICBzdGF0czogeyBhcDogMzYsIGNyaXQ6IDEgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBBeGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2VkIFFpcmFqaSBXYXIgQXhlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExMCxcbiAgICAgICAgbWF4OiAyMDUsXG4gICAgICAgIHNwZWVkOiAyLjYwLFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMTQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNydWwnc2hvcnVraCwgRWRnZSBvZiBDaGFvc1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDEsXG4gICAgICAgIG1heDogMTg4LFxuICAgICAgICBzcGVlZDogMi4zMCxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDM2IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEZWF0aGJyaW5nZXIgKFcvTyBQUk9DKVwiLCAvLyBUT0RPXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExNCxcbiAgICAgICAgbWF4OiAyMTMsXG4gICAgICAgIHNwZWVkOiAyLjkwXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRG9vbSdzIEVkZ2VcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODMsXG4gICAgICAgIG1heDogMTU0LFxuICAgICAgICBzcGVlZDogMi4zMCxcbiAgICAgICAgc3RhdHM6IHsgYWdpOiAxNiwgc3RyOiA5IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNaXJhaCdzIFNvbmdcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA1NyxcbiAgICAgICAgbWF4OiA4NyxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgYWdpOiA5LCBzdHI6IDkgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRlYXRoJ3MgU3RpbmdcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5EQUdHRVIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogOTUsXG4gICAgICAgIG1heDogMTQ0LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBhcDogMzgsIGRhZ2dlclNraWxsOiAzIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2VkIFFpcmFqaSBQdWdpb1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkRBR0dFUixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA3MixcbiAgICAgICAgbWF4OiAxMzQsXG4gICAgICAgIHNwZWVkOiAxLjcsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGhpdDogMSwgYXA6IDE4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJGZWxzdHJpa2VyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuREFHR0VSLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDU0LFxuICAgICAgICBtYXg6IDEwMSxcbiAgICAgICAgc3BlZWQ6IDEuNyxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJGZWxzdHJpa2VyXCIsIDMsIHtjcml0OiAxMDAsIGhpdDogMTAwfSkpLHtwcG06IDEuNH0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgb251c2U6ICgoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnNpZ2h0T2ZUaGVRaXJhamkgPSBuZXcgQnVmZihcIkluc2lnaHQgb2YgdGhlIFFpcmFqaVwiLCAzMCwge2FybW9yUGVuZXRyYXRpb246IDIwMH0sIHRydWUsIDAsIDYpO1xuICAgICAgICAgICAgY29uc3QgYmFkZ2VCdWZmID0gbmV3IFNwZWxsQnVmZihcbiAgICAgICAgICAgICAgICBuZXcgQnVmZlByb2MoXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiLCAzMCxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFByb2MobmV3IFNwZWxsQnVmZihpbnNpZ2h0T2ZUaGVRaXJhamkpLCB7cHBtOiAxNX0pLFxuICAgICAgICAgICAgICAgICAgICBpbnNpZ2h0T2ZUaGVRaXJhamkpLFxuICAgICAgICAgICAgICAgIGZhbHNlLCAwLCAzICogNjApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gYmFkZ2VCdWZmO1xuICAgICAgICB9KSgpXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRGlhbW9uZCBGbGFza1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBvbnVzZTogbmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkRpYW1vbmQgRmxhc2tcIiwgNjAsIHtzdHI6IDc1fSksIHRydWUsIDAsIDYgKiA2MCksXG4gICAgfVxuXTtcbiIsImltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcyB9IGZyb20gXCIuLi9zdGF0cy5qc1wiO1xuXG5cbmludGVyZmFjZSBCdWZmRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBkdXJhdGlvbjogbnVtYmVyLFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbn1cblxuZXhwb3J0IGNvbnN0IGJ1ZmZzOiBCdWZmW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhdHRsZSBTaG91dFwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDI5MFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2lmdCBvZiB0aGUgV2lsZFwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDE2LCAvLyBUT0RPIC0gc2hvdWxkIGl0IGJlIDEyICogMS4zNT8gKHRhbGVudClcbiAgICAgICAgICAgIGFnaTogMTZcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRydWVzaG90IEF1cmFcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDEwMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3Npbmcgb2YgS2luZ3NcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdGF0TXVsdDogMS4xXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2luZyBvZiBNaWdodFwiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyMjJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNtb2tlZCBEZXNlcnQgRHVtcGxpbmdzXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAyMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSnVqdSBQb3dlclwiLFxuICAgICAgICBkdXJhdGlvbjogMzAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMzBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgTWlnaHRcIixcbiAgICAgICAgZHVyYXRpb246IDEwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogNDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVsaXhpciBvZiB0aGUgTW9uZ29vc2VcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYWdpOiAyNSxcbiAgICAgICAgICAgIGNyaXQ6IDJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIuTy5JLkQuUy5cIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAyNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmFsbHlpbmcgQ3J5IG9mIHRoZSBEcmFnb25zbGF5ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDE0MCxcbiAgICAgICAgICAgIGNyaXQ6IDVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNvbmdmbG93ZXIgU2VyYW5hZGVcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgY3JpdDogNSxcbiAgICAgICAgICAgIHN0cjogMTUsXG4gICAgICAgICAgICBhZ2k6IDE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTcGlyaXQgb2YgWmFuZGFsYXJcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RhdE11bHQ6IDEuMTVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkZlbmd1cycgRmVyb2NpdHlcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDIwMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiV2FyY2hpZWYncyBCbGVzc2luZ1wiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBoYXN0ZTogMS4xNVxuICAgICAgICB9XG4gICAgfSxcbl0ubWFwKChiZDogQnVmZkRlc2NyaXB0aW9uKSA9PiBuZXcgQnVmZihiZC5uYW1lLCBiZC5kdXJhdGlvbiwgYmQuc3RhdHMpKTtcbiIsImltcG9ydCB7IFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2Fycmlvci5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24gfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBFbmNoYW50RGVzY3JpcHRpb24sIHRlbXBvcmFyeUVuY2hhbnRzLCBlbmNoYW50cyB9IGZyb20gXCIuL2RhdGEvZW5jaGFudHMuanNcIjtcbmltcG9ydCB7IGl0ZW1zIH0gZnJvbSBcIi4vZGF0YS9pdGVtcy5qc1wiO1xuaW1wb3J0IHsgYnVmZnMgfSBmcm9tIFwiLi9kYXRhL3NwZWxscy5qc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNpbXVsYXRpb25EZXNjcmlwdGlvbiB7XG4gICAgcmFjZTogUmFjZSxcbiAgICBzdGF0czogU3RhdFZhbHVlcyxcbiAgICBlcXVpcG1lbnQ6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPixcbiAgICBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBudW1iZXI+LFxuICAgIHRlbXBvcmFyeUVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4sXG4gICAgYnVmZnM6IG51bWJlcltdLFxuICAgIGZpZ2h0TGVuZ3RoOiBudW1iZXIsXG4gICAgcmVhbHRpbWU6IGJvb2xlYW4sXG4gICAgaGVyb2ljU3RyaWtlUmFnZVJlcTogbnVtYmVyLFxuICAgIGhhbXN0cmluZ1JhZ2VSZXE6IG51bWJlcixcbiAgICBibG9vZHRoaXJzdEV4ZWNSYWdlTGltaXQ6IG51bWJlcixcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwUGxheWVyKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBlcXVpcG1lbnQ6IE1hcDxJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uPiwgZW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPiwgdGVtcG9yYXJ5RW5jaGFudDogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCBidWZmczogQnVmZltdLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgIGNvbnN0IHBsYXllciA9IG5ldyBXYXJyaW9yKHJhY2UsIHN0YXRzLCBsb2cpO1xuXG4gICAgZm9yIChsZXQgW3Nsb3QsIGl0ZW1dIG9mIGVxdWlwbWVudCkge1xuICAgICAgICBwbGF5ZXIuZXF1aXAoc2xvdCwgaXRlbSwgZW5jaGFudHMuZ2V0KHNsb3QpLCB0ZW1wb3JhcnlFbmNoYW50LmdldChzbG90KSk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgYnVmZiBvZiBidWZmcykge1xuICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJ1ZmYsIDApO1xuICAgIH1cblxuICAgIGNvbnN0IGJvc3MgPSBuZXcgVW5pdCg2MywgNDY5MSAtIDIyNTAgLSA2NDAgLSA1MDUgLSA2MDApOyAvLyBzdW5kZXIsIGNvciwgZmYsIGFubmloXG4gICAgcGxheWVyLnRhcmdldCA9IGJvc3M7XG5cbiAgICByZXR1cm4gcGxheWVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwTWFwPEssVj4oc2xvdFRvSW5kZXg6IE1hcDxLLCBudW1iZXI+LCBsb29rdXA6IFZbXSk6IE1hcDxLLCBWPiB7XG4gICAgY29uc3QgcmVzID0gbmV3IE1hcDxLLFY+KCk7XG5cbiAgICBmb3IgKGxldCBbc2xvdCwgaWR4XSBvZiBzbG90VG9JbmRleCkge1xuICAgICAgICBpZiAobG9va3VwW2lkeF0pIHtcbiAgICAgICAgICAgIHJlcy5zZXQoc2xvdCwgbG9va3VwW2lkeF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2JhZCBpbmRleCcsIGlkeCwgbG9va3VwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBBcnJheTxWPihpbmRpY2VzOiBudW1iZXJbXSwgbG9va3VwOiBWW10pOiBWW10ge1xuICAgIGNvbnN0IHJlczogVltdID0gW107XG5cbiAgICBmb3IgKGxldCBpZHggb2YgaW5kaWNlcykge1xuICAgICAgICBpZiAobG9va3VwW2lkeF0pIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGxvb2t1cFtpZHhdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgaW5kZXgnLCBpZHgsIGxvb2t1cCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cEl0ZW1zKG1hcDogTWFwPEl0ZW1TbG90LCBudW1iZXI+KSB7XG4gICAgcmV0dXJuIGxvb2t1cE1hcChtYXAsIGl0ZW1zKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cEVuY2hhbnRzKG1hcDogTWFwPEl0ZW1TbG90LCBudW1iZXI+KSB7XG4gICAgcmV0dXJuIGxvb2t1cE1hcChtYXAsIGVuY2hhbnRzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cFRlbXBvcmFyeUVuY2hhbnRzKG1hcDogTWFwPEl0ZW1TbG90LCBudW1iZXI+KSB7XG4gICAgcmV0dXJuIGxvb2t1cE1hcChtYXAsIHRlbXBvcmFyeUVuY2hhbnRzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cEJ1ZmZzKGluZGljZXM6IG51bWJlcltdKSB7XG4gICAgcmV0dXJuIGxvb2t1cEFycmF5KGluZGljZXMsIGJ1ZmZzKTtcbn1cbiIsImltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1EZXNjcmlwdGlvbiwgSXRlbVNsb3QgfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgTG9nRnVuY3Rpb24sIFBsYXllciwgUmFjZSwgRGFtYWdlTG9nIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBzZXR1cFBsYXllciB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcbmltcG9ydCB7IEVuY2hhbnREZXNjcmlwdGlvbiB9IGZyb20gXCIuL2RhdGEvZW5jaGFudHMuanNcIjtcblxuZXhwb3J0IHR5cGUgSXRlbVdpdGhTbG90ID0gW0l0ZW1EZXNjcmlwdGlvbiwgSXRlbVNsb3RdO1xuXG4vLyBUT0RPIC0gY2hhbmdlIHRoaXMgaW50ZXJmYWNlIHNvIHRoYXQgQ2hvb3NlQWN0aW9uIGNhbm5vdCBzY3JldyB1cCB0aGUgc2ltIG9yIGNoZWF0XG4vLyBlLmcuIENob29zZUFjdGlvbiBzaG91bGRuJ3QgY2FzdCBzcGVsbHMgYXQgYSBjdXJyZW50IHRpbWVcbmV4cG9ydCB0eXBlIENob29zZUFjdGlvbiA9IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyLCBmaWdodExlbmd0aDogbnVtYmVyLCBjYW5FeGVjdXRlOiBib29sZWFuKSA9PiBudW1iZXI7XG5cbmV4cG9ydCBjb25zdCBFWEVDVVRFX1BIQVNFX1JBVElPID0gMC4xNTsgLy8gbGFzdCAxNSUgb2YgdGhlIHRpbWUgaXMgZXhlY3V0ZSBwaGFzZVxuXG5jbGFzcyBGaWdodCB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG4gICAgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb247XG4gICAgZmlnaHRMZW5ndGg6IG51bWJlcjtcbiAgICBkdXJhdGlvbiA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBNYXA8SXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbj4sIGVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIHRlbXBvcmFyeUVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIGJ1ZmZzOiBCdWZmW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICB0aGlzLnBsYXllciA9IHNldHVwUGxheWVyKHJhY2UsIHN0YXRzLCBlcXVpcG1lbnQsIGVuY2hhbnRzLCB0ZW1wb3JhcnlFbmNoYW50cywgYnVmZnMsIGxvZyk7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gKGZpZ2h0TGVuZ3RoICsgTWF0aC5yYW5kb20oKSAqIDQgLSAyKSAqIDEwMDA7XG4gICAgfVxuXG4gICAgcnVuKCk6IFByb21pc2U8RmlnaHRSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmLCByKSA9PiB7XG4gICAgICAgICAgICB3aGlsZSAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZih7XG4gICAgICAgICAgICAgICAgZGFtYWdlTG9nOiB0aGlzLnBsYXllci5kYW1hZ2VMb2csXG4gICAgICAgICAgICAgICAgZmlnaHRMZW5ndGg6IHRoaXMuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICAgICAgcG93ZXJMb3N0OiB0aGlzLnBsYXllci5wb3dlckxvc3RcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwYXVzZShwYXVzZTogYm9vbGVhbikge31cblxuICAgIGNhbmNlbCgpIHt9XG5cbiAgICBwcm90ZWN0ZWQgdXBkYXRlKCkge1xuICAgICAgICBjb25zdCBiZWdpbkV4ZWN1dGVUaW1lID0gdGhpcy5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG4gICAgICAgIGNvbnN0IGlzRXhlY3V0ZVBoYXNlID0gdGhpcy5kdXJhdGlvbiA+PSBiZWdpbkV4ZWN1dGVUaW1lO1xuXG4gICAgICAgIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLnVwZGF0ZSh0aGlzLmR1cmF0aW9uKTsgLy8gbmVlZCB0byBjYWxsIHRoaXMgaWYgdGhlIGR1cmF0aW9uIGNoYW5nZWQgYmVjYXVzZSBvZiBidWZmcyB0aGF0IGNoYW5nZSBvdmVyIHRpbWUgbGlrZSBqb20gZ2FiYmVyXG5cbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24odGhpcy5wbGF5ZXIsIHRoaXMuZHVyYXRpb24sIHRoaXMuZmlnaHRMZW5ndGgsIGlzRXhlY3V0ZVBoYXNlKTsgLy8gY2hvb3NlIGFjdGlvbiBiZWZvcmUgaW4gY2FzZSBvZiBhY3Rpb24gZGVwZW5kaW5nIG9uIHRpbWUgb2ZmIHRoZSBnY2QgbGlrZSBlYXJ0aHN0cmlrZVxuXG4gICAgICAgIHRoaXMucGxheWVyLnVwZGF0ZUF0dGFja2luZ1N0YXRlKHRoaXMuZHVyYXRpb24pO1xuICAgICAgICAvLyBjaG9vc2UgYWN0aW9uIGFmdGVyIGV2ZXJ5IHN3aW5nIHdoaWNoIGNvdWxkIGJlIGEgcmFnZSBnZW5lcmF0aW5nIGV2ZW50LCBidXQgVE9ETzogbmVlZCB0byBhY2NvdW50IGZvciBsYXRlbmN5LCByZWFjdGlvbiB0aW1lIChidXR0b24gbWFzaGluZylcbiAgICAgICAgY29uc3Qgd2FpdGluZ0ZvclRpbWUgPSB0aGlzLmNob29zZUFjdGlvbih0aGlzLnBsYXllciwgdGhpcy5kdXJhdGlvbiwgdGhpcy5maWdodExlbmd0aCwgaXNFeGVjdXRlUGhhc2UpO1xuXG4gICAgICAgIGxldCBuZXh0U3dpbmdUaW1lID0gdGhpcy5wbGF5ZXIubWghLm5leHRTd2luZ1RpbWU7XG5cbiAgICAgICAgaWYgKHRoaXMucGxheWVyLm9oKSB7XG4gICAgICAgICAgICBuZXh0U3dpbmdUaW1lID0gTWF0aC5taW4obmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIub2gubmV4dFN3aW5nVGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0ZW1wb3JhcnkgaGFja1xuICAgICAgICBpZiAodGhpcy5wbGF5ZXIuZXh0cmFBdHRhY2tDb3VudCkge1xuICAgICAgICAgICAgLy8gZG9uJ3QgaW5jcmVtZW50IGR1cmF0aW9uIChUT0RPOiBidXQgSSByZWFsbHkgc2hvdWxkIGJlY2F1c2UgdGhlIHNlcnZlciBkb2Vzbid0IGxvb3AgaW5zdGFudGx5KVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGxheWVyLm5leHRHQ0RUaW1lID4gdGhpcy5kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IE1hdGgubWluKHRoaXMucGxheWVyLm5leHRHQ0RUaW1lLCBuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5idWZmTWFuYWdlci5uZXh0T3ZlclRpbWVVcGRhdGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IE1hdGgubWluKG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLm5leHRPdmVyVGltZVVwZGF0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FpdGluZ0ZvclRpbWUgPCB0aGlzLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gd2FpdGluZ0ZvclRpbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzRXhlY3V0ZVBoYXNlICYmIGJlZ2luRXhlY3V0ZVRpbWUgPCB0aGlzLmR1cmF0aW9uKSB7IC8vIG5vdCBleGVjdXRlIGF0IHN0YXJ0IG9mIHVwZGF0ZVxuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIFJlYWx0aW1lRmlnaHQgZXh0ZW5kcyBGaWdodCB7XG4gICAgcHJvdGVjdGVkIHBhdXNlZCA9IGZhbHNlO1xuXG4gICAgcnVuKCk6IFByb21pc2U8RmlnaHRSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgTVNfUEVSX1VQREFURSA9IDEwMDAgLyA2MDtcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIGxldCBvdmVycmlkZUR1cmF0aW9uID0gMDtcblxuICAgICAgICAgICAgY29uc3QgbG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVycmlkZUR1cmF0aW9uICs9IE1TX1BFUl9VUERBVEU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gb3ZlcnJpZGVEdXJhdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGxvb3AsIE1TX1BFUl9VUERBVEUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGYoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZGFtYWdlTG9nOiB0aGlzLnBsYXllci5kYW1hZ2VMb2csXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogdGhpcy5maWdodExlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogdGhpcy5wbGF5ZXIucG93ZXJMb3N0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldFRpbWVvdXQobG9vcCwgTVNfUEVSX1VQREFURSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHBhdXNlKHBhdXNlOiBib29sZWFuKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gcGF1c2U7XG4gICAgfVxufVxuXG5leHBvcnQgdHlwZSBGaWdodFJlc3VsdCA9IHsgZGFtYWdlTG9nOiBEYW1hZ2VMb2csIGZpZ2h0TGVuZ3RoOiBudW1iZXIsIHBvd2VyTG9zdDogbnVtYmVyfTtcblxuZXhwb3J0IHR5cGUgU2ltdWxhdGlvblN1bW1hcnkgPSB7XG4gICAgbm9ybWFsRGFtYWdlOiBudW1iZXIsXG4gICAgZXhlY0RhbWFnZTogbnVtYmVyLFxuICAgIG5vcm1hbER1cmF0aW9uOiBudW1iZXIsXG4gICAgZXhlY0R1cmF0aW9uOiBudW1iZXIsXG4gICAgcG93ZXJMb3N0OiBudW1iZXIsXG4gICAgZmlnaHRzOiBudW1iZXIsXG59O1xuXG5leHBvcnQgdHlwZSBTdGF0dXNIYW5kbGVyID0gKHN0YXR1czogU2ltdWxhdGlvblN1bW1hcnkpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBTaW11bGF0aW9uIHtcbiAgICByYWNlOiBSYWNlO1xuICAgIHN0YXRzOiBTdGF0VmFsdWVzO1xuICAgIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24+O1xuICAgIGVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj47XG4gICAgdGVtcG9yYXJ5RW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPjtcbiAgICBidWZmczogQnVmZltdO1xuICAgIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uO1xuICAgIHByb3RlY3RlZCBmaWdodExlbmd0aDogbnVtYmVyO1xuICAgIHByb3RlY3RlZCByZWFsdGltZTogYm9vbGVhbjtcbiAgICBsb2c/OiBMb2dGdW5jdGlvblxuXG4gICAgcHJvdGVjdGVkIHJlcXVlc3RTdG9wID0gZmFsc2U7XG4gICAgcHJvdGVjdGVkIF9wYXVzZWQgPSBmYWxzZTtcblxuICAgIGZpZ2h0UmVzdWx0czogRmlnaHRSZXN1bHRbXSA9IFtdO1xuXG4gICAgY3VycmVudEZpZ2h0PzogRmlnaHQ7XG5cbiAgICBwcm90ZWN0ZWQgY2FjaGVkU3VtbW1hcnk6IFNpbXVsYXRpb25TdW1tYXJ5ID0geyBub3JtYWxEYW1hZ2U6IDAsIGV4ZWNEYW1hZ2U6IDAsIG5vcm1hbER1cmF0aW9uOiAwLCBleGVjRHVyYXRpb246IDAsIHBvd2VyTG9zdDogMCwgZmlnaHRzOiAwIH07XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBNYXA8SXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbj4sIGVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIHRlbXBvcmFyeUVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIGJ1ZmZzOiBCdWZmW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCByZWFsdGltZSA9IGZhbHNlLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICB0aGlzLnJhY2UgPSByYWNlO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuZXF1aXBtZW50ID0gZXF1aXBtZW50O1xuICAgICAgICB0aGlzLmVuY2hhbnRzID0gZW5jaGFudHM7XG4gICAgICAgIHRoaXMudGVtcG9yYXJ5RW5jaGFudHMgPSB0ZW1wb3JhcnlFbmNoYW50cztcbiAgICAgICAgdGhpcy5idWZmcyA9IGJ1ZmZzO1xuICAgICAgICB0aGlzLmNob29zZUFjdGlvbiA9IGNob29zZUFjdGlvbjtcbiAgICAgICAgdGhpcy5maWdodExlbmd0aCA9IGZpZ2h0TGVuZ3RoO1xuICAgICAgICB0aGlzLnJlYWx0aW1lID0gcmVhbHRpbWU7XG4gICAgICAgIHRoaXMubG9nID0gbG9nO1xuICAgIH1cblxuICAgIGdldCBwYXVzZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXVzZWQ7XG4gICAgfVxuXG4gICAgZ2V0IHN0YXR1cygpOiBTaW11bGF0aW9uU3VtbWFyeSB7XG4gICAgICAgIGZvciAobGV0IGZpZ2h0UmVzdWx0IG9mIHRoaXMuZmlnaHRSZXN1bHRzKSB7XG4gICAgICAgICAgICBjb25zdCBiZWdpbkV4ZWN1dGVUaW1lID0gZmlnaHRSZXN1bHQuZmlnaHRMZW5ndGggKiAoMSAtIEVYRUNVVEVfUEhBU0VfUkFUSU8pO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBbdGltZSwgZGFtYWdlXSBvZiBmaWdodFJlc3VsdC5kYW1hZ2VMb2cpIHtcbiAgICAgICAgICAgICAgICBpZiAodGltZSA+PSBiZWdpbkV4ZWN1dGVUaW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkuZXhlY0RhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5ub3JtYWxEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5ub3JtYWxEdXJhdGlvbiArPSBiZWdpbkV4ZWN1dGVUaW1lO1xuICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5leGVjRHVyYXRpb24gKz0gZmlnaHRSZXN1bHQuZmlnaHRMZW5ndGggLSBiZWdpbkV4ZWN1dGVUaW1lO1xuICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5wb3dlckxvc3QgKz0gZmlnaHRSZXN1bHQucG93ZXJMb3N0O1xuXG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LmZpZ2h0cysrO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maWdodFJlc3VsdHMgPSBbXTtcblxuICAgICAgICBsZXQgbm9ybWFsRGFtYWdlID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5ub3JtYWxEYW1hZ2U7XG4gICAgICAgIGxldCBleGVjRGFtYWdlID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5leGVjRGFtYWdlO1xuICAgICAgICBsZXQgbm9ybWFsRHVyYXRpb24gPSB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbER1cmF0aW9uO1xuICAgICAgICBsZXQgZXhlY0R1cmF0aW9uID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5leGVjRHVyYXRpb247XG4gICAgICAgIGxldCBwb3dlckxvc3QgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LnBvd2VyTG9zdDtcbiAgICAgICAgbGV0IGZpZ2h0cyA9IHRoaXMuY2FjaGVkU3VtbW1hcnkuZmlnaHRzO1xuXG4gICAgICAgIGlmICh0aGlzLnJlYWx0aW1lICYmIHRoaXMuY3VycmVudEZpZ2h0KSB7XG4gICAgICAgICAgICBjb25zdCBiZWdpbkV4ZWN1dGVUaW1lID0gdGhpcy5jdXJyZW50RmlnaHQuZmlnaHRMZW5ndGggKiAoMSAtIEVYRUNVVEVfUEhBU0VfUkFUSU8pO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBbdGltZSwgZGFtYWdlXSBvZiB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIuZGFtYWdlTG9nKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRpbWUgPj0gYmVnaW5FeGVjdXRlVGltZSkge1xuICAgICAgICAgICAgICAgICAgICBleGVjRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBub3JtYWxEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9ybWFsRHVyYXRpb24gKz0gTWF0aC5taW4oYmVnaW5FeGVjdXRlVGltZSwgdGhpcy5jdXJyZW50RmlnaHQuZHVyYXRpb24pO1xuICAgICAgICAgICAgZXhlY0R1cmF0aW9uICs9IE1hdGgubWF4KDAsIHRoaXMuY3VycmVudEZpZ2h0LmR1cmF0aW9uIC0gYmVnaW5FeGVjdXRlVGltZSk7XG4gICAgICAgICAgICBwb3dlckxvc3QgKz0gdGhpcy5jdXJyZW50RmlnaHQucGxheWVyLnBvd2VyTG9zdDtcbiAgICAgICAgICAgIGZpZ2h0cysrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5vcm1hbERhbWFnZTogbm9ybWFsRGFtYWdlLFxuICAgICAgICAgICAgZXhlY0RhbWFnZTogZXhlY0RhbWFnZSxcbiAgICAgICAgICAgIG5vcm1hbER1cmF0aW9uOiBub3JtYWxEdXJhdGlvbixcbiAgICAgICAgICAgIGV4ZWNEdXJhdGlvbjogZXhlY0R1cmF0aW9uLFxuICAgICAgICAgICAgcG93ZXJMb3N0OiBwb3dlckxvc3QsXG4gICAgICAgICAgICBmaWdodHM6IGZpZ2h0cyxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICBjb25zdCBmaWdodENsYXNzID0gdGhpcy5yZWFsdGltZSA/IFJlYWx0aW1lRmlnaHQgOiBGaWdodDtcblxuICAgICAgICBjb25zdCBvdXRlcmxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KG91dGVybG9vcCwgMTAwKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICAgICAgICAgIGNvbnN0IGlubmVybG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY291bnQgPiAxMDApIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChvdXRlcmxvb3AsIDApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQgPSBuZXcgZmlnaHRDbGFzcyh0aGlzLnJhY2UsIHRoaXMuc3RhdHMsIHRoaXMuZXF1aXBtZW50LCB0aGlzLmVuY2hhbnRzLCB0aGlzLnRlbXBvcmFyeUVuY2hhbnRzLCB0aGlzLmJ1ZmZzLCB0aGlzLmNob29zZUFjdGlvbiwgdGhpcy5maWdodExlbmd0aCwgdGhpcy5yZWFsdGltZSA/IHRoaXMubG9nIDogdW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodC5ydW4oKS50aGVuKChyZXMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maWdodFJlc3VsdHMucHVzaChyZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICBpbm5lcmxvb3AoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoIXRoaXMucmVxdWVzdFN0b3ApIHtcbiAgICAgICAgICAgICAgICBpbm5lcmxvb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBvdXRlcmxvb3AoKTtcbiAgICB9XG5cbiAgICBwYXVzZShwYXVzZTogYm9vbGVhbnx1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHBhdXNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHBhdXNlID0gIXRoaXMucGF1c2VkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcGF1c2VkID0gcGF1c2U7XG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRGaWdodCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQucGF1c2UocGF1c2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RvcCgpIHtcbiAgICAgICAgdGhpcy5yZXF1ZXN0U3RvcCA9IHRydWU7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgV2FycmlvciB9IGZyb20gXCIuL3dhcnJpb3JcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllclwiO1xuaW1wb3J0IHsgU3BlbGxCdWZmIH0gZnJvbSBcIi4vc3BlbGxcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ2hvb3NlQWN0aW9uKGhlcm9pY1N0cmlrZVJhZ2VSZXE6IG51bWJlciwgaGFtc3RyaW5nUmFnZVJlcTogbnVtYmVyLCBibG9vZHRoaXJzdEV4ZWNSYWdlTGltaXQ6IG51bWJlcikge1xuICAgIHJldHVybiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlciwgZXhlY3V0ZVBoYXNlOiBib29sZWFuKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3Qgd2FycmlvciA9IDxXYXJyaW9yPnBsYXllcjtcbiAgICBcbiAgICAgICAgY29uc3QgdGltZVJlbWFpbmluZ1NlY29uZHMgPSAoZmlnaHRMZW5ndGggLSB0aW1lKSAvIDEwMDA7XG5cbiAgICAgICAgbGV0IHdhaXRpbmdGb3JUaW1lID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXG4gICAgICAgIC8vIFRPRE8gLSB3aGF0IGFib3V0IEdDRCBzcGVsbHMgd2hlcmUgeW91IHNob3VsZCBwb3AgdGhlbSBiZWZvcmUgZmlnaHQ/IGxpa2UgZGlhbW9uZCBmbGFzayBvbiB2YWVsXG4gICAgICAgIC8vIG5lZWQgdG8gYWRkIGEgc3RlcCBmb3IgcHJlIGZpZ2h0IGFjdGlvbnMsIG1heWJlIGNob29zZSBhY3Rpb24gc2hvdWxkIGJlIGFibGUgdG8gd29yayBvbiBuZWdhdGl2ZSBmaWdodCB0aW1lXG4gICAgICAgIGZvciAobGV0IFtfLCBpdGVtXSBvZiBwbGF5ZXIuaXRlbXMpIHtcbiAgICAgICAgICAgIGlmIChpdGVtLm9udXNlICYmIGl0ZW0ub251c2UuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIGlmIChpdGVtLm9udXNlLnNwZWxsIGluc3RhbmNlb2YgU3BlbGxCdWZmKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aW1lUmVtYWluaW5nU2Vjb25kcyA8PSBpdGVtLm9udXNlLnNwZWxsLmJ1ZmYuZHVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ub251c2UuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gTWF0aC5taW4od2FpdGluZ0ZvclRpbWUsIGZpZ2h0TGVuZ3RoIC0gaXRlbS5vbnVzZS5zcGVsbC5idWZmLmR1cmF0aW9uICogMTAwMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgaWYgKHdhcnJpb3IucmFnZSA8IDMwICYmIHdhcnJpb3IuYmxvb2RSYWdlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHdhcnJpb3IuYmxvb2RSYWdlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgLy8gZ2NkIHNwZWxsc1xuICAgICAgICBpZiAod2Fycmlvci5uZXh0R0NEVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICBpZiAod2Fycmlvci5kZWF0aFdpc2guY2FuQ2FzdCh0aW1lKSAmJlxuICAgICAgICAgICAgICAgICh0aW1lUmVtYWluaW5nU2Vjb25kcyA8PSAzMFxuICAgICAgICAgICAgICAgIHx8ICh0aW1lUmVtYWluaW5nU2Vjb25kcyAtIHdhcnJpb3IuZGVhdGhXaXNoLnNwZWxsLmNvb2xkb3duKSA+IDMwKSkgeyAvLyBjb3VsZCBiZSB0aW1lZCBiZXR0ZXJcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmRlYXRoV2lzaC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChleGVjdXRlUGhhc2UgJiYgd2Fycmlvci5ibG9vZHRoaXJzdC5jYW5DYXN0KHRpbWUpICYmIHdhcnJpb3IucmFnZSA8IGJsb29kdGhpcnN0RXhlY1JhZ2VMaW1pdCkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGV4ZWN1dGVQaGFzZSAmJiB3YXJyaW9yLmV4ZWN1dGUuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3IuZXhlY3V0ZS5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmJsb29kdGhpcnN0LmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICAgICAgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QuY29vbGRvd24gPiB0aW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gTWF0aC5taW4od2FpdGluZ0ZvclRpbWUsIHdhcnJpb3IuYmxvb2R0aGlyc3QuY29vbGRvd24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci53aGlybHdpbmQuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3Iud2hpcmx3aW5kLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLnRpbWVSZW1haW5pbmcodGltZSkgPCAxLjUgKyAod2Fycmlvci5sYXRlbmN5IC8gMTAwMCkpIHtcbiAgICAgICAgICAgICAgICAvLyBub3Qgb3IgYWxtb3N0IG9mZiBjb29sZG93biwgd2FpdCBmb3IgcmFnZSBvciBjb29sZG93blxuICAgICAgICAgICAgICAgIGlmICh3YXJyaW9yLndoaXJsd2luZC5jb29sZG93biA+IHRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSBNYXRoLm1pbih3YWl0aW5nRm9yVGltZSwgd2Fycmlvci53aGlybHdpbmQuY29vbGRvd24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5yYWdlID49IGhhbXN0cmluZ1JhZ2VSZXEgJiYgd2Fycmlvci5oYW1zdHJpbmcuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3IuaGFtc3RyaW5nLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgaWYgKCFleGVjdXRlUGhhc2UgJiYgd2Fycmlvci5yYWdlID49IGhlcm9pY1N0cmlrZVJhZ2VSZXEgJiYgIXdhcnJpb3IucXVldWVkU3BlbGwpIHtcbiAgICAgICAgICAgIHdhcnJpb3IucXVldWVkU3BlbGwgPSB3YXJyaW9yLmhlcm9pY1N0cmlrZTtcbiAgICAgICAgICAgIGlmICh3YXJyaW9yLmxvZykgd2Fycmlvci5sb2codGltZSwgJ3F1ZXVlaW5nIGhlcm9pYyBzdHJpa2UnKTtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICByZXR1cm4gd2FpdGluZ0ZvclRpbWU7XG4gICAgfTtcbn1cbiIsImltcG9ydCB7ICBNYWluVGhyZWFkSW50ZXJmYWNlIH0gZnJvbSBcIi4vd29ya2VyX2V2ZW50X2ludGVyZmFjZS5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbiB9IGZyb20gXCIuL3NpbXVsYXRpb24uanNcIjtcbmltcG9ydCB7IFNpbXVsYXRpb25EZXNjcmlwdGlvbiwgbG9va3VwSXRlbXMsIGxvb2t1cEJ1ZmZzLCBsb29rdXBFbmNoYW50cywgbG9va3VwVGVtcG9yYXJ5RW5jaGFudHMgfSBmcm9tIFwiLi9zaW11bGF0aW9uX3V0aWxzLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgZ2VuZXJhdGVDaG9vc2VBY3Rpb24gfSBmcm9tIFwiLi93YXJyaW9yX2FpLmpzXCI7XG5cbmNvbnN0IG1haW5UaHJlYWRJbnRlcmZhY2UgPSBNYWluVGhyZWFkSW50ZXJmYWNlLmluc3RhbmNlO1xuXG5sZXQgY3VycmVudFNpbTogU2ltdWxhdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbm1haW5UaHJlYWRJbnRlcmZhY2UuYWRkRXZlbnRMaXN0ZW5lcignc2ltdWxhdGUnLCAoZGF0YTogYW55KSA9PiB7XG4gICAgY29uc3Qgc2ltZGVzYyA9IDxTaW11bGF0aW9uRGVzY3JpcHRpb24+ZGF0YTtcblxuICAgIGxldCBsb2dGdW5jdGlvbjogTG9nRnVuY3Rpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKHNpbWRlc2MucmVhbHRpbWUpIHtcbiAgICAgICAgbG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIG1haW5UaHJlYWRJbnRlcmZhY2Uuc2VuZCgnbG9nJywge1xuICAgICAgICAgICAgICAgIHRpbWU6IHRpbWUsXG4gICAgICAgICAgICAgICAgdGV4dDogdGV4dFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgY3VycmVudFNpbSA9IG5ldyBTaW11bGF0aW9uKHNpbWRlc2MucmFjZSwgc2ltZGVzYy5zdGF0cyxcbiAgICAgICAgbG9va3VwSXRlbXMoc2ltZGVzYy5lcXVpcG1lbnQpLFxuICAgICAgICBsb29rdXBFbmNoYW50cyhzaW1kZXNjLmVuY2hhbnRzKSxcbiAgICAgICAgbG9va3VwVGVtcG9yYXJ5RW5jaGFudHMoc2ltZGVzYy50ZW1wb3JhcnlFbmNoYW50cyksXG4gICAgICAgIGxvb2t1cEJ1ZmZzKHNpbWRlc2MuYnVmZnMpLFxuICAgICAgICBnZW5lcmF0ZUNob29zZUFjdGlvbihzaW1kZXNjLmhlcm9pY1N0cmlrZVJhZ2VSZXEsIHNpbWRlc2MuaGFtc3RyaW5nUmFnZVJlcSwgc2ltZGVzYy5ibG9vZHRoaXJzdEV4ZWNSYWdlTGltaXQpLFxuICAgICAgICBzaW1kZXNjLmZpZ2h0TGVuZ3RoLCBzaW1kZXNjLnJlYWx0aW1lLCBsb2dGdW5jdGlvbik7XG5cbiAgICBjdXJyZW50U2ltLnN0YXJ0KCk7XG5cbiAgICBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGlmIChjdXJyZW50U2ltICYmICFjdXJyZW50U2ltLnBhdXNlZCkge1xuICAgICAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdzdGF0dXMnLCBjdXJyZW50U2ltIS5zdGF0dXMpO1xuICAgICAgICB9XG4gICAgfSwgNTAwKTtcbn0pO1xuXG5tYWluVGhyZWFkSW50ZXJmYWNlLmFkZEV2ZW50TGlzdGVuZXIoJ3BhdXNlJywgKHBhdXNlOiBib29sZWFufHVuZGVmaW5lZCkgPT4ge1xuICAgIGlmIChjdXJyZW50U2ltKSB7XG4gICAgICAgIGN1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
