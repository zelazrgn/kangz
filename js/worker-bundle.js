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
            && !(spell || spell === heroicStrikeSpell)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvbWF0aC50cyIsIi4uL3NyYy9zcGVsbC50cyIsIi4uL3NyYy9pdGVtLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL2VuY2hhbnRzLnRzIiwiLi4vc3JjL2RhdGEvaXRlbXMudHMiLCIuLi9zcmMvZGF0YS9zcGVsbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbl91dGlscy50cyIsIi4uL3NyYy9zaW11bGF0aW9uLnRzIiwiLi4vc3JjL3dhcnJpb3JfYWkudHMiLCIuLi9zcmMvcnVuX3NpbXVsYXRpb25fd29ya2VyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbInR5cGUgV29ya2VyRXZlbnRMaXN0ZW5lciA9IChkYXRhOiBhbnkpID0+IHZvaWQ7XG5cbmNsYXNzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBldmVudExpc3RlbmVyczogTWFwPHN0cmluZywgV29ya2VyRXZlbnRMaXN0ZW5lcltdPiA9IG5ldyBNYXAoKTtcblxuICAgIGNvbnN0cnVjdG9yKHRhcmdldDogYW55KSB7XG4gICAgICAgIHRhcmdldC5vbm1lc3NhZ2UgPSAoZXY6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMuZ2V0KGV2LmRhdGEuZXZlbnQpIHx8IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgbGlzdGVuZXIgb2YgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyKGV2LmRhdGEuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogV29ya2VyRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBpZiAodGhpcy5ldmVudExpc3RlbmVycy5oYXMoZXZlbnQpKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldmVudCkhLnB1c2gobGlzdGVuZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5zZXQoZXZlbnQsIFtsaXN0ZW5lcl0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lclRvUmVtb3ZlOiBXb3JrZXJFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50TGlzdGVuZXJzLmhhcyhldmVudCkpIHtcbiAgICAgICAgICAgIGxldCBldmVudExpc3RlbmVyc0ZvckV2ZW50ID0gdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpO1xuICAgICAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLnNldChldmVudCwgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudC5maWx0ZXIoKGxpc3RlbmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lciAhPT0gbGlzdGVuZXJUb1JlbW92ZTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVFdmVudExpc3RlbmVyc0ZvckV2ZW50KGV2ZW50OiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5kZWxldGUoZXZlbnQpO1xuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiB1cmFuZChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbWluICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZnJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wKHZhbDogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heChtaW4sIHZhbCkpO1xufVxuXG5jb25zdCBERUJVR0dJTkcgPSBmYWxzZTtcblxuaWYgKERFQlVHR0lORykge1xuICAgIC8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL21hdGhpYXNieW5lbnMvNTY3MDkxNyNmaWxlLWRldGVybWluaXN0aWMtbWF0aC1yYW5kb20tanNcbiAgICBNYXRoLnJhbmRvbSA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlZWQgPSAweDJGNkUyQjE7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vIFJvYmVydCBKZW5raW5z4oCZIDMyIGJpdCBpbnRlZ2VyIGhhc2ggZnVuY3Rpb25cbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDdFRDU1RDE2KSArIChzZWVkIDw8IDEyKSkgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEM3NjFDMjNDKSBeIChzZWVkID4+PiAxOSkpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDE2NTY2N0IxKSArIChzZWVkIDw8IDUpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEQzQTI2NDZDKSBeIChzZWVkIDw8IDkpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEZENzA0NkM1KSArIChzZWVkIDw8IDMpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEI1NUE0RjA5KSBeIChzZWVkID4+PiAxNikpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHJldHVybiAoc2VlZCAmIDB4RkZGRkZGRikgLyAweDEwMDAwMDAwO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG59XG4iLCJpbXBvcnQgeyBQbGF5ZXIsIE1lbGVlSGl0T3V0Y29tZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFdlYXBvbkRlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgdXJhbmQgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5cbmV4cG9ydCBlbnVtIFNwZWxsRmFtaWx5IHtcbiAgICBOT05FLFxuICAgIFdBUlJJT1IsXG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbCB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHR5cGU6IFNwZWxsVHlwZTtcbiAgICBmYW1pbHk6IFNwZWxsRmFtaWx5O1xuICAgIGlzX2djZDogYm9vbGVhbjtcbiAgICBjb3N0OiBudW1iZXI7XG4gICAgY29vbGRvd246IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgc3BlbGxGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZDtcblxuICAgIGNhblByb2MgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB0eXBlOiBTcGVsbFR5cGUsIGZhbWlseTogU3BlbGxGYW1pbHksIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyLCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuZmFtaWx5ID0gZmFtaWx5O1xuICAgICAgICB0aGlzLmNvc3QgPSBjb3N0O1xuICAgICAgICB0aGlzLmNvb2xkb3duID0gY29vbGRvd247XG4gICAgICAgIHRoaXMuaXNfZ2NkID0gaXNfZ2NkO1xuICAgICAgICB0aGlzLnNwZWxsRiA9IHNwZWxsRjtcbiAgICB9XG5cbiAgICBjYXN0KHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3BlbGxGKHBsYXllciwgdGltZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGVhcm5lZFNwZWxsIHtcbiAgICBzcGVsbDogU3BlbGw7XG4gICAgY29vbGRvd24gPSAwO1xuICAgIGNhc3RlcjogUGxheWVyO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsLCBjYXN0ZXI6IFBsYXllcikge1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7XG4gICAgICAgIHRoaXMuY2FzdGVyID0gY2FzdGVyO1xuICAgIH1cblxuICAgIG9uQ29vbGRvd24odGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvb2xkb3duID4gdGltZTtcbiAgICB9XG5cbiAgICB0aW1lUmVtYWluaW5nKHRpbWU6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgKHRoaXMuY29vbGRvd24gLSB0aW1lKSAvIDEwMDApO1xuICAgIH1cblxuICAgIGNhbkNhc3QodGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmlzX2djZCAmJiB0aGlzLmNhc3Rlci5uZXh0R0NEVGltZSA+IHRpbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmNvc3QgPiB0aGlzLmNhc3Rlci5wb3dlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub25Db29sZG93bih0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgY2FzdCh0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCF0aGlzLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmlzX2djZCkge1xuICAgICAgICAgICAgdGhpcy5jYXN0ZXIubmV4dEdDRFRpbWUgPSB0aW1lICsgMTUwMCArIHRoaXMuY2FzdGVyLmxhdGVuY3k7IC8vIFRPRE8gLSBuZWVkIHRvIHN0dWR5IHRoZSBlZmZlY3RzIG9mIGxhdGVuY3kgaW4gdGhlIGdhbWUgYW5kIGNvbnNpZGVyIGh1bWFuIHByZWNpc2lvblxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmNhc3Rlci5wb3dlciAtPSB0aGlzLnNwZWxsLmNvc3Q7XG5cbiAgICAgICAgdGhpcy5zcGVsbC5jYXN0KHRoaXMuY2FzdGVyLCB0aW1lKTtcblxuICAgICAgICB0aGlzLmNvb2xkb3duID0gdGltZSArIHRoaXMuc3BlbGwuY29vbGRvd24gKiAxMDAwICsgdGhpcy5jYXN0ZXIubGF0ZW5jeTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2luZ1NwZWxsIGV4dGVuZHMgU3BlbGwge1xuICAgIGJvbnVzRGFtYWdlOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGZhbWlseTogU3BlbGxGYW1pbHksIGJvbnVzRGFtYWdlOiBudW1iZXIsIGNvc3Q6IG51bWJlcikge1xuICAgICAgICBzdXBlcihuYW1lLCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBmYW1pbHksIGZhbHNlLCBjb3N0LCAwLCAoKSA9PiB7fSk7XG4gICAgICAgIHRoaXMuYm9udXNEYW1hZ2UgPSBib251c0RhbWFnZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3dpbmdTcGVsbCBleHRlbmRzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFN3aW5nU3BlbGw7XG4gICAgXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFN3aW5nU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyKHNwZWxsLCBjYXN0ZXIpO1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7IC8vIFRPRE8gLSBpcyB0aGVyZSBhIHdheSB0byBhdm9pZCB0aGlzIGxpbmU/XG4gICAgfVxufVxuXG5leHBvcnQgZW51bSBTcGVsbFR5cGUge1xuICAgIE5PTkUsXG4gICAgQlVGRixcbiAgICBQSFlTSUNBTCxcbiAgICBQSFlTSUNBTF9XRUFQT04sXG4gICAgTUFHSUMsXG59XG5cbmV4cG9ydCB0eXBlIFNwZWxsSGl0T3V0Y29tZUNhbGxiYWNrID0gKHBsYXllcjogUGxheWVyLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsIHtcbiAgICBjYWxsYmFjaz86IFNwZWxsSGl0T3V0Y29tZUNhbGxiYWNrO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlcnxbbnVtYmVyLCBudW1iZXJdfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSwgZmFtaWx5OiBTcGVsbEZhbWlseSwgaXNfZ2NkID0gZmFsc2UsIGNvc3QgPSAwLCBjb29sZG93biA9IDAsIGNhbGxiYWNrPzogU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2spIHtcbiAgICAgICAgc3VwZXIobmFtZSwgdHlwZSwgZmFtaWx5LCBpc19nY2QsIGNvc3QsIGNvb2xkb3duLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgZG1nID0gKGFtb3VudCBpbnN0YW5jZW9mIEZ1bmN0aW9uKSA/IGFtb3VudChwbGF5ZXIpIDogKEFycmF5LmlzQXJyYXkoYW1vdW50KSA/IHVyYW5kKC4uLmFtb3VudCkgOiBhbW91bnQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gU3BlbGxUeXBlLlBIWVNJQ0FMIHx8IHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBTcGVsbFR5cGUuTUFHSUMpIHtcbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbFNwZWxsRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgSXRlbVNwZWxsRGFtYWdlIGV4dGVuZHMgU3BlbGxEYW1hZ2Uge1xuICAgIGNhblByb2MgPSBmYWxzZTsgLy8gVE9ETyAtIGNvbmZpcm0gdGhpcyBpcyBibGl6emxpa2UsIGFsc28gc29tZSBpdGVtIHByb2NzIG1heSBiZSBhYmxlIHRvIHByb2MgYnV0IG9uIExIIGNvcmUsIGZhdGFsIHdvdW5kIGNhbid0XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSkge1xuICAgICAgICBzdXBlcihuYW1lLCBhbW91bnQsIHR5cGUsIFNwZWxsRmFtaWx5Lk5PTkUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikge1xuICAgICAgICAvLyBzcGVsbHR5cGUgZG9lc24ndCBtYXR0ZXJcbiAgICAgICAgc3VwZXIobmFtZSwgU3BlbGxUeXBlLk5PTkUsIFNwZWxsRmFtaWx5Lk5PTkUsIGZhbHNlLCAwLCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGxheWVyLmV4dHJhQXR0YWNrQ291bnQgKz0gY291bnQ7IC8vIExIIGNvZGUgZG9lcyBub3QgYWxsb3cgbXVsdGlwbGUgYXV0byBhdHRhY2tzIHRvIHN0YWNrIGlmIHRoZXkgcHJvYyB0b2dldGhlci4gQmxpenpsaWtlIG1heSBhbGxvdyB0aGVtIHRvIHN0YWNrIFxuICAgICAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYEdhaW5lZCAke2NvdW50fSBleHRyYSBhdHRhY2tzIGZyb20gJHtuYW1lfWApO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbEJ1ZmYgZXh0ZW5kcyBTcGVsbCB7XG4gICAgYnVmZjogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKGJ1ZmY6IEJ1ZmYsIGlzX2djZCA9IGZhbHNlLCBjb3N0ID0gMCwgY29vbGRvd24gPSAwKSB7XG4gICAgICAgIHN1cGVyKGBTcGVsbEJ1ZmYoJHtidWZmLm5hbWV9KWAsIFNwZWxsVHlwZS5CVUZGLCBTcGVsbEZhbWlseS5OT05FLCBpc19nY2QsIGNvc3QsIGNvb2xkb3duLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChidWZmLCB0aW1lKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgfVxufVxuXG50eXBlIHBwbSA9IHtwcG06IG51bWJlcn07XG50eXBlIGNoYW5jZSA9IHtjaGFuY2U6IG51bWJlcn07XG50eXBlIHJhdGUgPSBwcG0gfCBjaGFuY2U7XG5cbmV4cG9ydCBjbGFzcyBQcm9jIHtcbiAgICBwcm90ZWN0ZWQgc3BlbGxzOiBTcGVsbFtdO1xuICAgIHByb3RlY3RlZCByYXRlOiByYXRlO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsIHwgU3BlbGxbXSwgcmF0ZTogcmF0ZSkge1xuICAgICAgICB0aGlzLnNwZWxscyA9IEFycmF5LmlzQXJyYXkoc3BlbGwpID8gc3BlbGwgOiBbc3BlbGxdO1xuICAgICAgICB0aGlzLnJhdGUgPSByYXRlO1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgd2VhcG9uOiBXZWFwb25EZXNjcmlwdGlvbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNoYW5jZSA9ICg8Y2hhbmNlPnRoaXMucmF0ZSkuY2hhbmNlIHx8ICg8cHBtPnRoaXMucmF0ZSkucHBtICogd2VhcG9uLnNwZWVkIC8gNjA7XG5cbiAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPD0gY2hhbmNlKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzcGVsbCBvZiB0aGlzLnNwZWxscykge1xuICAgICAgICAgICAgICAgIHNwZWxsLmNhc3QocGxheWVyLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgUHJvYywgU3BlbGwsIExlYXJuZWRTcGVsbCB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBFbmNoYW50RGVzY3JpcHRpb24gfSBmcm9tIFwiLi9kYXRhL2VuY2hhbnRzLmpzXCI7XG5cbmV4cG9ydCBlbnVtIEl0ZW1TbG90IHtcbiAgICBNQUlOSEFORCA9IDEgPDwgMCxcbiAgICBPRkZIQU5EID0gMSA8PCAxLFxuICAgIFRSSU5LRVQxID0gMSA8PCAyLFxuICAgIFRSSU5LRVQyID0gMSA8PCAzLFxuICAgIEhFQUQgPSAxIDw8IDQsXG4gICAgTkVDSyA9IDEgPDwgNSxcbiAgICBTSE9VTERFUiA9IDEgPDwgNixcbiAgICBCQUNLID0gMSA8PCA3LFxuICAgIENIRVNUID0gMSA8PCA4LFxuICAgIFdSSVNUID0gMSA8PCA5LFxuICAgIEhBTkRTID0gMSA8PCAxMCxcbiAgICBXQUlTVCA9IDEgPDwgMTEsXG4gICAgTEVHUyA9IDEgPDwgMTIsXG4gICAgRkVFVCA9IDEgPDwgMTMsXG4gICAgUklORzEgPSAxIDw8IDE0LFxuICAgIFJJTkcyID0gMSA8PCAxNSxcbiAgICBSQU5HRUQgPSAxIDw8IDE2LFxufVxuXG5leHBvcnQgY29uc3QgaXRlbVNsb3RIYXNFbmNoYW50OiB7W1RLZXkgaW4gSXRlbVNsb3RdOiBib29sZWFufSA9IHtcbiAgICBbSXRlbVNsb3QuTUFJTkhBTkRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5PRkZIQU5EXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuVFJJTktFVDFdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuVFJJTktFVDJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuSEVBRF06IHRydWUsXG4gICAgW0l0ZW1TbG90Lk5FQ0tdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuU0hPVUxERVJdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5CQUNLXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuQ0hFU1RdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5XUklTVF06IHRydWUsXG4gICAgW0l0ZW1TbG90LkhBTkRTXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuV0FJU1RdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuTEVHU106IHRydWUsXG4gICAgW0l0ZW1TbG90LkZFRVRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5SSU5HMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SSU5HMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SQU5HRURdOiBmYWxzZSxcbn07XG5cbmV4cG9ydCBjb25zdCBpdGVtU2xvdEhhc1RlbXBvcmFyeUVuY2hhbnQ6IHtbVEtleSBpbiBJdGVtU2xvdF06IGJvb2xlYW59ID0ge1xuICAgIFtJdGVtU2xvdC5NQUlOSEFORF06IHRydWUsXG4gICAgW0l0ZW1TbG90Lk9GRkhBTkRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5IRUFEXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90Lk5FQ0tdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuU0hPVUxERVJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuQkFDS106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5DSEVTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5XUklTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5IQU5EU106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5XQUlTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5MRUdTXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkZFRVRdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUklORzFdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUklORzJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUkFOR0VEXTogZmFsc2UsXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIEl0ZW1EZXNjcmlwdGlvbiB7XG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNsb3Q6IEl0ZW1TbG90LFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbiAgICBvbnVzZT86IFNwZWxsLFxuICAgIG9uZXF1aXA/OiBQcm9jLFxufVxuXG5leHBvcnQgZW51bSBXZWFwb25UeXBlIHtcbiAgICBNQUNFLFxuICAgIFNXT1JELFxuICAgIEFYRSxcbiAgICBEQUdHRVIsXG4gICAgTUFDRTJILFxuICAgIFNXT1JEMkgsXG4gICAgQVhFMkgsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2VhcG9uRGVzY3JpcHRpb24gZXh0ZW5kcyBJdGVtRGVzY3JpcHRpb24ge1xuICAgIHR5cGU6IFdlYXBvblR5cGUsXG4gICAgbWluOiBudW1iZXIsXG4gICAgbWF4OiBudW1iZXIsXG4gICAgc3BlZWQ6IG51bWJlcixcbiAgICBvbmhpdD86IFByb2MsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1dlYXBvbihpdGVtOiBJdGVtRGVzY3JpcHRpb24pOiBpdGVtIGlzIFdlYXBvbkRlc2NyaXB0aW9uIHtcbiAgICByZXR1cm4gXCJzcGVlZFwiIGluIGl0ZW07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VxdWlwZWRXZWFwb24oaXRlbTogSXRlbUVxdWlwZWQpOiBpdGVtIGlzIFdlYXBvbkVxdWlwZWQge1xuICAgIHJldHVybiBcIndlYXBvblwiIGluIGl0ZW07XG59XG5cbmV4cG9ydCBjbGFzcyBJdGVtRXF1aXBlZCB7XG4gICAgaXRlbTogSXRlbURlc2NyaXB0aW9uO1xuICAgIG9udXNlPzogTGVhcm5lZFNwZWxsO1xuXG4gICAgY29uc3RydWN0b3IoaXRlbTogSXRlbURlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICB0aGlzLml0ZW0gPSBpdGVtO1xuXG4gICAgICAgIGlmIChpdGVtLm9udXNlKSB7XG4gICAgICAgICAgICB0aGlzLm9udXNlID0gbmV3IExlYXJuZWRTcGVsbChpdGVtLm9udXNlLCBwbGF5ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0ub25lcXVpcCkgeyAvLyBUT0RPLCBtb3ZlIHRoaXMgdG8gYnVmZnByb2M/IHRoaXMgbWF5IGJlIHNpbXBsZXIgdGhvdWdoIHNpbmNlIHdlIGtub3cgdGhlIGJ1ZmYgd29uJ3QgYmUgcmVtb3ZlZFxuICAgICAgICAgICAgcGxheWVyLmFkZFByb2MoaXRlbS5vbmVxdWlwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVzZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMub251c2UpIHtcbiAgICAgICAgICAgIHRoaXMub251c2UuY2FzdCh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdlYXBvbkVxdWlwZWQgZXh0ZW5kcyBJdGVtRXF1aXBlZCB7XG4gICAgd2VhcG9uOiBXZWFwb25EZXNjcmlwdGlvbjtcbiAgICBuZXh0U3dpbmdUaW1lOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHByb2NzOiBQcm9jW10gPSBbXTtcbiAgICBwcm90ZWN0ZWQgcGxheWVyOiBQbGF5ZXI7XG4gICAgcHVibGljIHRlbXBvcmFyeUVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb247XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBXZWFwb25EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIsIGVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb24sIHRlbXBvcmFyeUVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb24pIHtcbiAgICAgICAgc3VwZXIoaXRlbSwgcGxheWVyKTtcbiAgICAgICAgdGhpcy53ZWFwb24gPSBpdGVtO1xuICAgICAgICBcbiAgICAgICAgaWYgKGl0ZW0ub25oaXQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkUHJvYyhpdGVtLm9uaGl0KVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuY2hhbnQgJiYgZW5jaGFudC5wcm9jKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFByb2MoZW5jaGFudC5wcm9jKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnQgPSB0ZW1wb3JhcnlFbmNoYW50O1xuXG4gICAgICAgIHRoaXMubmV4dFN3aW5nVGltZSA9IDEwMDsgLy8gVE9ETyAtIG5lZWQgdG8gcmVzZXQgdGhpcyBwcm9wZXJseSBpZiBldmVyIHdhbnQgdG8gc2ltdWxhdGUgZmlnaHRzIHdoZXJlIHlvdSBydW4gb3V0XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXQgcGx1c0RhbWFnZSgpIHtcbiAgICAgICAgaWYgKHRoaXMudGVtcG9yYXJ5RW5jaGFudCAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLnBsdXNEYW1hZ2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMucGx1c0RhbWFnZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWluKCkge1xuICAgICAgICByZXR1cm4gdGhpcy53ZWFwb24ubWluICsgdGhpcy5wbHVzRGFtYWdlO1xuICAgIH1cblxuICAgIGdldCBtYXgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5tYXggKyB0aGlzLnBsdXNEYW1hZ2U7XG4gICAgfVxuXG4gICAgYWRkUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIHRoaXMucHJvY3MucHVzaChwKTtcbiAgICB9XG5cbiAgICBwcm9jKHRpbWU6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCBwcm9jIG9mIHRoaXMucHJvY3MpIHtcbiAgICAgICAgICAgIHByb2MucnVuKHRoaXMucGxheWVyLCB0aGlzLndlYXBvbiwgdGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3aW5kZnVyeSBwcm9jcyBsYXN0XG4gICAgICAgIGlmICh0aGlzLnRlbXBvcmFyeUVuY2hhbnQgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnByb2MpIHtcbiAgICAgICAgICAgIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5wcm9jLnJ1bih0aGlzLnBsYXllciwgdGhpcy53ZWFwb24sIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcblxuZXhwb3J0IGNsYXNzIFVuaXQge1xuICAgIGxldmVsOiBudW1iZXI7XG4gICAgYXJtb3I6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGxldmVsOiBudW1iZXIsIGFybW9yOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICB0aGlzLmFybW9yID0gYXJtb3I7XG4gICAgfVxuXG4gICAgZ2V0IG1heFNraWxsRm9yTGV2ZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxldmVsICogNTtcbiAgICB9XG5cbiAgICBnZXQgZGVmZW5zZVNraWxsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgIH1cblxuICAgIGdldCBkb2RnZUNoYW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIDU7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQXJtb3JSZWR1Y2VkRGFtYWdlKGRhbWFnZTogbnVtYmVyLCBhdHRhY2tlcjogUGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGFybW9yID0gTWF0aC5tYXgoMCwgdGhpcy5hcm1vciAtIGF0dGFja2VyLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFybW9yUGVuZXRyYXRpb24pO1xuICAgICAgICBcbiAgICAgICAgbGV0IHRtcHZhbHVlID0gMC4xICogYXJtb3IgIC8gKCg4LjUgKiBhdHRhY2tlci5sZXZlbCkgKyA0MCk7XG4gICAgICAgIHRtcHZhbHVlIC89ICgxICsgdG1wdmFsdWUpO1xuXG4gICAgICAgIGNvbnN0IGFybW9yTW9kaWZpZXIgPSBjbGFtcCh0bXB2YWx1ZSwgMCwgMC43NSk7XG5cbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDEsIGRhbWFnZSAtIChkYW1hZ2UgKiBhcm1vck1vZGlmaWVyKSk7XG4gICAgfVxufVxuIiwiZXhwb3J0IGludGVyZmFjZSBTdGF0VmFsdWVzIHtcbiAgICBhcD86IG51bWJlcjtcbiAgICBzdHI/OiBudW1iZXI7XG4gICAgYWdpPzogbnVtYmVyO1xuICAgIGhpdD86IG51bWJlcjtcbiAgICBjcml0PzogbnVtYmVyO1xuICAgIGhhc3RlPzogbnVtYmVyO1xuICAgIHN0YXRNdWx0PzogbnVtYmVyO1xuICAgIGRhbWFnZU11bHQ/OiBudW1iZXI7XG4gICAgYXJtb3JQZW5ldHJhdGlvbj86IG51bWJlcjtcbiAgICBwbHVzRGFtYWdlPzogbnVtYmVyO1xuXG4gICAgc3dvcmRTa2lsbD86IG51bWJlcjtcbiAgICBheGVTa2lsbD86IG51bWJlcjtcbiAgICBtYWNlU2tpbGw/OiBudW1iZXI7XG4gICAgZGFnZ2VyU2tpbGw/OiBudW1iZXI7XG4gICAgc3dvcmQySFNraWxsPzogbnVtYmVyO1xuICAgIGF4ZTJIU2tpbGw/OiBudW1iZXI7XG4gICAgbWFjZTJIU2tpbGw/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBTdGF0cyBpbXBsZW1lbnRzIFN0YXRWYWx1ZXMge1xuICAgIGFwITogbnVtYmVyO1xuICAgIHN0ciE6IG51bWJlcjtcbiAgICBhZ2khOiBudW1iZXI7XG4gICAgaGl0ITogbnVtYmVyO1xuICAgIGNyaXQhOiBudW1iZXI7XG4gICAgaGFzdGUhOiBudW1iZXI7XG4gICAgc3RhdE11bHQhOiBudW1iZXI7XG4gICAgZGFtYWdlTXVsdCE6IG51bWJlcjtcbiAgICBhcm1vclBlbmV0cmF0aW9uITogbnVtYmVyO1xuICAgIHBsdXNEYW1hZ2UhOiBudW1iZXI7XG5cbiAgICBzd29yZFNraWxsITogbnVtYmVyO1xuICAgIGF4ZVNraWxsITogbnVtYmVyO1xuICAgIG1hY2VTa2lsbCE6IG51bWJlcjtcbiAgICBkYWdnZXJTa2lsbCE6IG51bWJlcjtcbiAgICBzd29yZDJIU2tpbGwhOiBudW1iZXI7XG4gICAgYXhlMkhTa2lsbCE6IG51bWJlcjtcbiAgICBtYWNlMkhTa2lsbCE6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKHM/OiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuc2V0KHMpO1xuICAgIH1cblxuICAgIHNldChzPzogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLmFwID0gKHMgJiYgcy5hcCkgfHwgMDtcbiAgICAgICAgdGhpcy5zdHIgPSAocyAmJiBzLnN0cikgfHwgMDtcbiAgICAgICAgdGhpcy5hZ2kgPSAocyAmJiBzLmFnaSkgfHwgMDtcbiAgICAgICAgdGhpcy5oaXQgPSAocyAmJiBzLmhpdCkgfHwgMDtcbiAgICAgICAgdGhpcy5jcml0ID0gKHMgJiYgcy5jcml0KSB8fCAwO1xuICAgICAgICB0aGlzLmhhc3RlID0gKHMgJiYgcy5oYXN0ZSkgfHwgMTtcbiAgICAgICAgdGhpcy5zdGF0TXVsdCA9IChzICYmIHMuc3RhdE11bHQpIHx8IDE7XG4gICAgICAgIHRoaXMuZGFtYWdlTXVsdCA9IChzICYmIHMuZGFtYWdlTXVsdCkgfHwgMTtcbiAgICAgICAgdGhpcy5hcm1vclBlbmV0cmF0aW9uID0gKHMgJiYgcy5hcm1vclBlbmV0cmF0aW9uKSB8fCAwO1xuICAgICAgICB0aGlzLnBsdXNEYW1hZ2UgPSAocyAmJiBzLnBsdXNEYW1hZ2UpIHx8IDA7XG5cbiAgICAgICAgdGhpcy5zd29yZFNraWxsID0gKHMgJiYgcy5zd29yZFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmF4ZVNraWxsID0gKHMgJiYgcy5heGVTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5tYWNlU2tpbGwgPSAocyAmJiBzLm1hY2VTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5kYWdnZXJTa2lsbCA9IChzICYmIHMuZGFnZ2VyU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuc3dvcmQySFNraWxsID0gKHMgJiYgcy5zd29yZDJIU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuYXhlMkhTa2lsbCA9IChzICYmIHMuYXhlMkhTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5tYWNlMkhTa2lsbCA9IChzICYmIHMubWFjZTJIU2tpbGwpIHx8IDA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgYWRkKHM6IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5hcCArPSAocy5hcCB8fCAwKTtcbiAgICAgICAgdGhpcy5zdHIgKz0gKHMuc3RyIHx8IDApO1xuICAgICAgICB0aGlzLmFnaSArPSAocy5hZ2kgfHwgMCk7XG4gICAgICAgIHRoaXMuaGl0ICs9IChzLmhpdCB8fCAwKTtcbiAgICAgICAgdGhpcy5jcml0ICs9IChzLmNyaXQgfHwgMCk7XG4gICAgICAgIHRoaXMuaGFzdGUgKj0gKHMuaGFzdGUgfHwgMSk7XG4gICAgICAgIHRoaXMuc3RhdE11bHQgKj0gKHMuc3RhdE11bHQgfHwgMSk7XG4gICAgICAgIHRoaXMuZGFtYWdlTXVsdCAqPSAocy5kYW1hZ2VNdWx0IHx8IDEpO1xuICAgICAgICB0aGlzLmFybW9yUGVuZXRyYXRpb24gKz0gKHMuYXJtb3JQZW5ldHJhdGlvbiB8fCAwKTtcbiAgICAgICAgdGhpcy5wbHVzRGFtYWdlICs9IChzLnBsdXNEYW1hZ2UgfHwgMCk7XG5cbiAgICAgICAgdGhpcy5zd29yZFNraWxsICs9IChzLnN3b3JkU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuYXhlU2tpbGwgKz0gKHMuYXhlU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMubWFjZVNraWxsICs9IChzLm1hY2VTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5kYWdnZXJTa2lsbCArPSAocy5kYWdnZXJTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5zd29yZDJIU2tpbGwgKz0gKHMuc3dvcmQySFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmF4ZTJIU2tpbGwgKz0gKHMuYXhlMkhTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5tYWNlMkhTa2lsbCArPSAocy5tYWNlMkhTa2lsbCB8fCAwKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdGF0cywgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IFByb2MgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgY2xhc3MgQnVmZk1hbmFnZXIge1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgcHJpdmF0ZSBidWZmTGlzdDogQnVmZkFwcGxpY2F0aW9uW10gPSBbXTtcbiAgICBwcml2YXRlIGJ1ZmZPdmVyVGltZUxpc3Q6IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uW10gPSBbXTtcblxuICAgIGJhc2VTdGF0czogU3RhdHM7XG4gICAgc3RhdHM6IFN0YXRzO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJhc2VTdGF0czogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcbiAgICAgICAgdGhpcy5iYXNlU3RhdHMgPSBuZXcgU3RhdHMoYmFzZVN0YXRzKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IG5ldyBTdGF0cyh0aGlzLmJhc2VTdGF0cyk7XG4gICAgfVxuXG4gICAgZ2V0IG5leHRPdmVyVGltZVVwZGF0ZSgpIHtcbiAgICAgICAgbGV0IHJlcyA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHJlcyA9IE1hdGgubWluKHJlcywgYnVmZk9UQXBwLm5leHRVcGRhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIHByb2Nlc3MgbGFzdCB0aWNrIGJlZm9yZSBpdCBpcyByZW1vdmVkXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIGJ1ZmZPVEFwcC51cGRhdGUodGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbW92ZUV4cGlyZWRCdWZmcyh0aW1lKTtcblxuICAgICAgICB0aGlzLnN0YXRzLnNldCh0aGlzLmJhc2VTdGF0cyk7XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBzdGFja3MgPSBidWZmLnN0YXRzU3RhY2sgPyBzdGFja3MgOiAxO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFja3M7IGkrKykge1xuICAgICAgICAgICAgICAgIGJ1ZmYuYXBwbHkodGhpcy5zdGF0cywgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgYnVmZkFwcCBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBpZiAoYnVmZkFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmYuc3RhY2tzKSB7ICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvZ1N0YWNrSW5jcmVhc2UgPSB0aGlzLnBsYXllci5sb2cgJiYgKCFidWZmLm1heFN0YWNrcyB8fCBidWZmQXBwLnN0YWNrcyA8IGJ1ZmYubWF4U3RhY2tzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZi5pbml0aWFsU3RhY2tzKSB7IC8vIFRPRE8gLSBjaGFuZ2UgdGhpcyB0byBjaGFyZ2VzP1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnN0YWNrcysrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvZ1N0YWNrSW5jcmVhc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxheWVyLmxvZyEoYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZCAoJHtidWZmQXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZGApO1xuICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSBnYWluZWRgICsgKGJ1ZmYuc3RhY2tzID8gYCAoJHtidWZmLmluaXRpYWxTdGFja3MgfHwgMX0pYCA6ICcnKSk7XG5cbiAgICAgICAgaWYgKGJ1ZmYgaW5zdGFuY2VvZiBCdWZmT3ZlclRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5wdXNoKG5ldyBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbih0aGlzLnBsYXllciwgYnVmZiwgYXBwbHlUaW1lKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZMaXN0LnB1c2gobmV3IEJ1ZmZBcHBsaWNhdGlvbihidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBidWZmLmFkZChhcHBseVRpbWUsIHRoaXMucGxheWVyKTtcbiAgICB9XG5cbiAgICByZW1vdmUoYnVmZjogQnVmZiwgdGltZTogbnVtYmVyLCBmdWxsID0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmdWxsICYmIGJ1ZmYuc3RhY2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZhcHAuc3RhY2tzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9ICgke2J1ZmZhcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuc3RhY2tzID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBsb3N0YCk7XG4gICAgICAgICAgICAgICAgYnVmZmFwcC5idWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCA9IHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWU6IG51bWJlcikge1xuICAgICAgICBjb25zdCByZW1vdmVkQnVmZnM6IEJ1ZmZbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuZXhwaXJhdGlvblRpbWUgPD0gdGltZSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRCdWZmcy5wdXNoKGJ1ZmZhcHAuYnVmZik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmYgb2YgcmVtb3ZlZEJ1ZmZzKSB7XG4gICAgICAgICAgICBidWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBleHBpcmVkYCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzfHVuZGVmaW5lZDtcbiAgICBzdGFja3M6IGJvb2xlYW47XG4gICAgZHVyYXRpb246IG51bWJlcjtcbiAgICBpbml0aWFsU3RhY2tzPzogbnVtYmVyO1xuICAgIG1heFN0YWNrcz86IG51bWJlcjtcbiAgICBzdGF0c1N0YWNrOiBib29sZWFuOyAvLyBkbyB5b3UgYWRkIHRoZSBzdGF0IGJvbnVzIGZvciBlYWNoIHN0YWNrPyBvciBpcyBpdCBsaWtlIGZsdXJyeSB3aGVyZSB0aGUgc3RhY2sgaXMgb25seSB0byBjb3VudCBjaGFyZ2VzXG5cbiAgICBwcml2YXRlIGNoaWxkPzogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgc3RhdHM/OiBTdGF0VmFsdWVzLCBzdGFja3M/OiBib29sZWFuLCBpbml0aWFsU3RhY2tzPzogbnVtYmVyLCBtYXhTdGFja3M/OiBudW1iZXIsIGNoaWxkPzogQnVmZiwgc3RhdHNTdGFjayA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuc3RhY2tzID0gISFzdGFja3M7XG4gICAgICAgIHRoaXMuaW5pdGlhbFN0YWNrcyA9IGluaXRpYWxTdGFja3M7XG4gICAgICAgIHRoaXMubWF4U3RhY2tzID0gbWF4U3RhY2tzO1xuICAgICAgICB0aGlzLmNoaWxkID0gY2hpbGQ7XG4gICAgICAgIHRoaXMuc3RhdHNTdGFjayA9IHN0YXRzU3RhY2s7XG4gICAgfVxuXG4gICAgYXBwbHkoc3RhdHM6IFN0YXRzLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5zdGF0cykge1xuICAgICAgICAgICAgc3RhdHMuYWRkKHRoaXMuc3RhdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHt9XG5cbiAgICByZW1vdmUodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5jaGlsZCkge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLnJlbW92ZSh0aGlzLmNoaWxkLCB0aW1lLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmO1xuICAgIGV4cGlyYXRpb25UaW1lITogbnVtYmVyO1xuXG4gICAgc3RhY2tzVmFsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgfVxuXG4gICAgcmVmcmVzaCh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3MgPSB0aGlzLmJ1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxO1xuXG4gICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSB0aW1lICsgdGhpcy5idWZmLmR1cmF0aW9uICogMTAwMDtcblxuICAgICAgICBpZiAodGhpcy5idWZmLmR1cmF0aW9uID4gNjApIHtcbiAgICAgICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzdGFja3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YWNrc1ZhbDtcbiAgICB9XG5cbiAgICBzZXQgc3RhY2tzKHN0YWNrczogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc3RhY2tzVmFsID0gdGhpcy5idWZmLm1heFN0YWNrcyA/IE1hdGgubWluKHRoaXMuYnVmZi5tYXhTdGFja3MsIHN0YWNrcykgOiBzdGFja3M7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZk92ZXJUaW1lIGV4dGVuZHMgQnVmZiB7XG4gICAgdXBkYXRlRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQ7XG4gICAgdXBkYXRlSW50ZXJ2YWw6IG51bWJlclxuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0czogU3RhdFZhbHVlc3x1bmRlZmluZWQsIHVwZGF0ZUludGVydmFsOiBudW1iZXIsIHVwZGF0ZUY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGR1cmF0aW9uLCBzdGF0cyk7XG4gICAgICAgIHRoaXMudXBkYXRlRiA9IHVwZGF0ZUY7XG4gICAgICAgIHRoaXMudXBkYXRlSW50ZXJ2YWwgPSB1cGRhdGVJbnRlcnZhbDtcbiAgICB9XG59XG5cbmNsYXNzIEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uIGV4dGVuZHMgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmT3ZlclRpbWU7XG4gICAgbmV4dFVwZGF0ZSE6IG51bWJlcjtcbiAgICBwbGF5ZXI6IFBsYXllcjtcblxuICAgIGNvbnN0cnVjdG9yKHBsYXllcjogUGxheWVyLCBidWZmOiBCdWZmT3ZlclRpbWUsIGFwcGx5VGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKGJ1ZmYsIGFwcGx5VGltZSk7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICBzdXBlci5yZWZyZXNoKHRpbWUpO1xuICAgICAgICB0aGlzLm5leHRVcGRhdGUgPSB0aW1lICsgdGhpcy5idWZmLnVwZGF0ZUludGVydmFsO1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRpbWUgPj0gdGhpcy5uZXh0VXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLm5leHRVcGRhdGUgKz0gdGhpcy5idWZmLnVwZGF0ZUludGVydmFsO1xuICAgICAgICAgICAgdGhpcy5idWZmLnVwZGF0ZUYodGhpcy5wbGF5ZXIsIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZlByb2MgZXh0ZW5kcyBCdWZmIHtcbiAgICBwcm9jOiBQcm9jO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBwcm9jOiBQcm9jLCBjaGlsZD86IEJ1ZmYpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGQpO1xuICAgICAgICB0aGlzLnByb2MgPSBwcm9jO1xuICAgIH1cblxuICAgIGFkZCh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLmFkZCh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIuYWRkUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLnJlbW92ZSh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIucmVtb3ZlUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFdlYXBvbkVxdWlwZWQsIFdlYXBvblR5cGUsIEl0ZW1EZXNjcmlwdGlvbiwgSXRlbUVxdWlwZWQsIEl0ZW1TbG90LCBpc0VxdWlwZWRXZWFwb24sIGlzV2VhcG9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IHVyYW5kLCBjbGFtcCwgZnJhbmQgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBCdWZmTWFuYWdlciB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBQcm9jLCBMZWFybmVkU3dpbmdTcGVsbCwgU3BlbGxUeXBlLCBTcGVsbERhbWFnZSB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBMSF9DT1JFX0JVRyB9IGZyb20gXCIuL3NpbV9zZXR0aW5ncy5qc1wiO1xuaW1wb3J0IHsgRW5jaGFudERlc2NyaXB0aW9uIH0gZnJvbSBcIi4vZGF0YS9lbmNoYW50cy5qc1wiO1xuXG5leHBvcnQgZW51bSBSYWNlIHtcbiAgICBIVU1BTixcbiAgICBPUkMsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCB0eXBlIERhbWFnZUxvZyA9IFtudW1iZXIsIG51bWJlcl1bXTtcblxuZXhwb3J0IGNsYXNzIFBsYXllciBleHRlbmRzIFVuaXQge1xuICAgIGl0ZW1zOiBNYXA8SXRlbVNsb3QsIEl0ZW1FcXVpcGVkPiA9IG5ldyBNYXAoKTtcbiAgICBwcm9jczogUHJvY1tdID0gW107XG5cbiAgICB0YXJnZXQ6IFVuaXQgfCB1bmRlZmluZWQ7XG5cbiAgICBuZXh0R0NEVGltZSA9IDA7XG4gICAgZXh0cmFBdHRhY2tDb3VudCA9IDA7XG4gICAgZG9pbmdFeHRyYUF0dGFja3MgPSBmYWxzZTtcblxuICAgIGJ1ZmZNYW5hZ2VyOiBCdWZmTWFuYWdlcjtcblxuICAgIGRhbWFnZUxvZzogRGFtYWdlTG9nID0gW107XG5cbiAgICBxdWV1ZWRTcGVsbDogTGVhcm5lZFN3aW5nU3BlbGx8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgbG9nPzogTG9nRnVuY3Rpb247XG5cbiAgICBsYXRlbmN5ID0gNTA7IC8vIG1zXG5cbiAgICBwb3dlckxvc3QgPSAwO1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHN1cGVyKDYwLCAwKTsgLy8gbHZsLCBhcm1vclxuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIgPSBuZXcgQnVmZk1hbmFnZXIodGhpcywgbmV3IFN0YXRzKHN0YXRzKSk7XG4gICAgICAgIHRoaXMubG9nID0gbG9nO1xuICAgIH1cblxuICAgIGdldCBtaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5NQUlOSEFORCk7XG5cbiAgICAgICAgaWYgKGVxdWlwZWQgJiYgaXNFcXVpcGVkV2VhcG9uKGVxdWlwZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXF1aXBlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5PRkZIQU5EKTtcblxuICAgICAgICBpZiAoZXF1aXBlZCAmJiBpc0VxdWlwZWRXZWFwb24oZXF1aXBlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcXVpcGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZXF1aXAoc2xvdDogSXRlbVNsb3QsIGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgZW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbiwgdGVtcG9yYXJ5RW5jaGFudD86IEVuY2hhbnREZXNjcmlwdGlvbikge1xuICAgICAgICBpZiAodGhpcy5pdGVtcy5oYXMoc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFscmVhZHkgaGF2ZSBpdGVtIGluIHNsb3QgJHtJdGVtU2xvdFtzbG90XX1gKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEoaXRlbS5zbG90ICYgc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGNhbm5vdCBlcXVpcCAke2l0ZW0ubmFtZX0gaW4gc2xvdCAke0l0ZW1TbG90W3Nsb3RdfWApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5zdGF0cykge1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5iYXNlU3RhdHMuYWRkKGl0ZW0uc3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuY2hhbnQgJiYgZW5jaGFudC5zdGF0cykge1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5iYXNlU3RhdHMuYWRkKGVuY2hhbnQuc3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETyAtIGhhbmRsZSBlcXVpcHBpbmcgMkggKGFuZCBob3cgdGhhdCBkaXNhYmxlcyBPSClcbiAgICAgICAgLy8gVE9ETyAtIGFzc3VtaW5nIG9ubHkgd2VhcG9uIGVuY2hhbnRzIGNhbiBoYXZlIHByb2NzXG4gICAgICAgIGlmIChpc1dlYXBvbihpdGVtKSkge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IFdlYXBvbkVxdWlwZWQoaXRlbSwgdGhpcywgZW5jaGFudCwgdGVtcG9yYXJ5RW5jaGFudCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IEl0ZW1FcXVpcGVkKGl0ZW0sIHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwb3dlcigpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge31cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcmVtb3ZlUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIC8vIFRPRE8gLSBlaXRoZXIgcHJvY3Mgc2hvdWxkIGJlIGEgc2V0IG9yIHdlIG5lZWQgUHJvY0FwcGxpY2F0aW9uXG4gICAgICAgIHRoaXMucHJvY3MgPSB0aGlzLnByb2NzLmZpbHRlcigocHJvYzogUHJvYykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHByb2MgIT09IHA7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmIChzcGVsbCAmJiBzcGVsbC50eXBlICE9PSBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuICAgICAgICBjb25zdCB3ZWFwb25UeXBlID0gd2VhcG9uLndlYXBvbi50eXBlO1xuXG4gICAgICAgIC8vIFRPRE8sIG1ha2UgdGhpcyBhIG1hcFxuICAgICAgICBzd2l0Y2ggKHdlYXBvblR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5NQUNFOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLm1hY2VTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5TV09SRDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zd29yZFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkFYRTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5heGVTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5EQUdHRVI6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuZGFnZ2VyU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuTUFDRTJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLm1hY2UySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLlNXT1JEMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3dvcmQySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkFYRTJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmF4ZTJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgaWYgKExIX0NPUkVfQlVHICYmIHNwZWxsICYmIHNwZWxsLnR5cGUgPT0gU3BlbGxUeXBlLlBIWVNJQ0FMKSB7XG4gICAgICAgICAgICAvLyBvbiBMSCBjb3JlLCBub24gd2VhcG9uIHNwZWxscyBsaWtlIGJsb29kdGhpcnN0IGFyZSBiZW5lZml0dGluZyBmcm9tIHdlYXBvbiBza2lsbFxuICAgICAgICAgICAgLy8gdGhpcyBvbmx5IGFmZmVjdHMgY3JpdCwgbm90IGhpdC9kb2RnZS9wYXJyeVxuICAgICAgICAgICAgLy8gc2V0IHRoZSBzcGVsbCB0byB1bmRlZmluZWQgc28gaXQgaXMgdHJlYXRlZCBsaWtlIGEgbm9ybWFsIG1lbGVlIGF0dGFjayAocmF0aGVyIHRoYW4gdXNpbmcgYSBkdW1teSBzcGVsbClcbiAgICAgICAgICAgIC8vIHdoZW4gY2FsY3VsYXRpbmcgd2VhcG9uIHNraWxsXG4gICAgICAgICAgICBzcGVsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjcml0ID0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5jcml0O1xuICAgICAgICBjcml0ICs9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYWdpICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAvIDIwO1xuXG4gICAgICAgIGlmICghc3BlbGwgfHwgc3BlbGwudHlwZSA9PSBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OKSB7XG4gICAgICAgICAgICBjb25zdCB3ZWFwb24gPSBpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCE7XG5cbiAgICAgICAgICAgIGlmICh3ZWFwb24udGVtcG9yYXJ5RW5jaGFudCAmJiB3ZWFwb24udGVtcG9yYXJ5RW5jaGFudC5zdGF0cyAmJiB3ZWFwb24udGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5jcml0KSB7XG4gICAgICAgICAgICAgICAgY3JpdCArPSB3ZWFwb24udGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5jcml0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2tpbGxCb251cyA9IDAuMDQgKiAodGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oLCBzcGVsbCkgLSB2aWN0aW0ubWF4U2tpbGxGb3JMZXZlbCk7XG4gICAgICAgIGNyaXQgKz0gc2tpbGxCb251cztcblxuICAgICAgICByZXR1cm4gY3JpdDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlTWlzc0NoYW5jZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCByZXMgPSA1O1xuICAgICAgICByZXMgLT0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5oaXQ7XG5cbiAgICAgICAgaWYgKHRoaXMub2ggJiYgIXNwZWxsKSB7XG4gICAgICAgICAgICByZXMgKz0gMTk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLmRlZmVuc2VTa2lsbDtcblxuICAgICAgICBpZiAoc2tpbGxEaWZmIDwgLTEwKSB7XG4gICAgICAgICAgICByZXMgLT0gKHNraWxsRGlmZiArIDEwKSAqIDAuNCAtIDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMgLT0gc2tpbGxEaWZmICogMC4xO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNsYW1wKHJlcywgMCwgNjApO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVHbGFuY2luZ1JlZHVjdGlvbih2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuKSB7XG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHZpY3RpbS5kZWZlbnNlU2tpbGwgIC0gdGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oKTtcblxuICAgICAgICBpZiAoc2tpbGxEaWZmID49IDE1KSB7XG4gICAgICAgICAgICByZXR1cm4gMC42NTtcbiAgICAgICAgfSBlbHNlIGlmIChza2lsbERpZmYgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBza2lsbERpZmZUb1JlZHVjdGlvbltza2lsbERpZmZdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlU3dpbmdNaW5NYXhEYW1hZ2UoaXNfbWg6IGJvb2xlYW4pOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuXG4gICAgICAgIGNvbnN0IGFwX2JvbnVzID0gdGhpcy5hcCAvIDE0ICogd2VhcG9uLndlYXBvbi5zcGVlZDtcblxuICAgICAgICBjb25zdCBvaFBlbmFsdHkgPSBpc19taCA/IDEgOiAwLjYyNTsgLy8gVE9ETyAtIGNoZWNrIHRhbGVudHMsIGltcGxlbWVudGVkIGFzIGFuIGF1cmEgU1BFTExfQVVSQV9NT0RfT0ZGSEFORF9EQU1BR0VfUENUXG5cbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICh3ZWFwb24ubWluICsgYXBfYm9udXMpICogb2hQZW5hbHR5LFxuICAgICAgICAgICAgKHdlYXBvbi5tYXggKyBhcF9ib251cykgKiBvaFBlbmFsdHlcbiAgICAgICAgXTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZShpc19taDogYm9vbGVhbikge1xuICAgICAgICByZXR1cm4gZnJhbmQoLi4udGhpcy5jYWxjdWxhdGVTd2luZ01pbk1heERhbWFnZShpc19taCkpO1xuICAgIH1cblxuICAgIGNyaXRDYXAoKSB7XG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZSh0cnVlKSAtIHRoaXMudGFyZ2V0IS5tYXhTa2lsbEZvckxldmVsKTtcbiAgICAgICAgY29uc3QgbWlzc19jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlTWlzc0NoYW5jZSh0aGlzLnRhcmdldCEsIHRydWUpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLnRhcmdldCEuZG9kZ2VDaGFuY2UgKiAxMDApIC0gc2tpbGxCb251cztcbiAgICAgICAgY29uc3QgZ2xhbmNlX2NoYW5jZSA9IGNsYW1wKCgxMCArICh0aGlzLnRhcmdldCEuZGVmZW5zZVNraWxsIC0gMzAwKSAqIDIpICogMTAwLCAwLCA0MDAwKTtcblxuICAgICAgICByZXR1cm4gKDEwMDAwIC0gKG1pc3NfY2hhbmNlICsgZG9kZ2VfY2hhbmNlICsgZ2xhbmNlX2NoYW5jZSkpIC8gMTAwO1xuICAgIH1cblxuICAgIHJvbGxNZWxlZUhpdE91dGNvbWUodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgICAgIGNvbnN0IHJvbGwgPSB1cmFuZCgwLCAxMDAwMCk7XG4gICAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgICBsZXQgdG1wID0gMDtcblxuICAgICAgICAvLyByb3VuZGluZyBpbnN0ZWFkIG9mIHRydW5jYXRpbmcgYmVjYXVzZSAxOS40ICogMTAwIHdhcyB0cnVuY2F0aW5nIHRvIDE5MzkuXG4gICAgICAgIGNvbnN0IG1pc3NfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltLCBpc19taCwgc3BlbGwpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh2aWN0aW0uZG9kZ2VDaGFuY2UgKiAxMDApO1xuICAgICAgICBjb25zdCBjcml0X2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbSwgaXNfbWgsIHNwZWxsKSAqIDEwMCk7XG5cbiAgICAgICAgLy8gd2VhcG9uIHNraWxsIC0gdGFyZ2V0IGRlZmVuc2UgKHVzdWFsbHkgbmVnYXRpdmUpXG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuXG4gICAgICAgIHRtcCA9IG1pc3NfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBkb2RnZV9jaGFuY2UgLSBza2lsbEJvbnVzOyAvLyA1LjYgKDU2MCkgZm9yIGx2bCA2MyB3aXRoIDMwMCB3ZWFwb24gc2tpbGxcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3BlbGwpIHsgLy8gc3BlbGxzIGNhbid0IGdsYW5jZVxuICAgICAgICAgICAgdG1wID0gKDEwICsgKHZpY3RpbS5kZWZlbnNlU2tpbGwgLSAzMDApICogMikgKiAxMDA7XG4gICAgICAgICAgICB0bXAgPSBjbGFtcCh0bXAsIDAsIDQwMDApO1xuICAgIFxuICAgICAgICAgICAgaWYgKHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IGNyaXRfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUw7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgZGFtYWdlV2l0aEJvbnVzID0gcmF3RGFtYWdlO1xuXG4gICAgICAgIGRhbWFnZVdpdGhCb251cyAqPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhbWFnZU11bHQ7XG5cbiAgICAgICAgcmV0dXJuIGRhbWFnZVdpdGhCb251cztcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZVdpdGhCb251cyA9IHRoaXMuY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIHNwZWxsKTtcbiAgICAgICAgY29uc3QgYXJtb3JSZWR1Y2VkID0gdmljdGltLmNhbGN1bGF0ZUFybW9yUmVkdWNlZERhbWFnZShkYW1hZ2VXaXRoQm9udXMsIHRoaXMpO1xuICAgICAgICBjb25zdCBoaXRPdXRjb21lID0gdGhpcy5yb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcblxuICAgICAgICBsZXQgZGFtYWdlID0gYXJtb3JSZWR1Y2VkO1xuICAgICAgICBsZXQgY2xlYW5EYW1hZ2UgPSAwO1xuXG4gICAgICAgIHN3aXRjaCAoaGl0T3V0Y29tZSkge1xuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTpcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSAwO1xuICAgICAgICAgICAgICAgIGNsZWFuRGFtYWdlID0gZGFtYWdlV2l0aEJvbnVzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZHVjZVBlcmNlbnQgPSB0aGlzLmNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbSwgaXNfbWgpO1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IHJlZHVjZVBlcmNlbnQgKiBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlICo9IDI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW2RhbWFnZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUywgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIC8vIHdoYXQgaXMgdGhlIG9yZGVyIG9mIGNoZWNraW5nIGZvciBwcm9jcyBsaWtlIGhvaiwgaXJvbmZvZSBhbmQgd2luZGZ1cnlcbiAgICAgICAgICAgIC8vIG9uIExIIGNvcmUgaXQgaXMgaG9qID4gaXJvbmZvZSA+IHdpbmRmdXJ5XG4gICAgICAgICAgICAvLyBzbyBkbyBpdGVtIHByb2NzIGZpcnN0LCB0aGVuIHdlYXBvbiBwcm9jLCB0aGVuIHdpbmRmdXJ5XG4gICAgICAgICAgICBmb3IgKGxldCBwcm9jIG9mIHRoaXMucHJvY3MpIHtcbiAgICAgICAgICAgICAgICBwcm9jLnJ1bih0aGlzLCAoaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghKS53ZWFwb24sIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oISkucHJvYyh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlYWxNZWxlZURhbWFnZSh0aW1lOiBudW1iZXIsIHJhd0RhbWFnZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gdGhpcy5jYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2UsIHRhcmdldCwgaXNfbWgsIHNwZWxsKTtcbiAgICAgICAgZGFtYWdlRG9uZSA9IE1hdGgudHJ1bmMoZGFtYWdlRG9uZSk7IC8vIHRydW5jYXRpbmcgaGVyZSBiZWNhdXNlIHdhcnJpb3Igc3ViY2xhc3MgYnVpbGRzIG9uIHRvcCBvZiBjYWxjdWxhdGVNZWxlZURhbWFnZVxuICAgICAgICBjbGVhbkRhbWFnZSA9IE1hdGgudHJ1bmMoY2xlYW5EYW1hZ2UpOyAvLyBUT0RPLCBzaG91bGQgZGFtYWdlTXVsdCBhZmZlY3QgY2xlYW4gZGFtYWdlIGFzIHdlbGw/IGlmIHNvIG1vdmUgaXQgaW50byBjYWxjdWxhdGVNZWxlZURhbWFnZVxuXG4gICAgICAgIHRoaXMuZGFtYWdlTG9nLnB1c2goW3RpbWUsIGRhbWFnZURvbmVdKTtcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgbGV0IGhpdFN0ciA9IGBZb3VyICR7c3BlbGwgPyBzcGVsbC5uYW1lIDogKGlzX21oID8gJ21haW4taGFuZCcgOiAnb2ZmLWhhbmQnKX0gJHtoaXRPdXRjb21lU3RyaW5nW2hpdE91dGNvbWVdfWA7XG4gICAgICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlldLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAgICAgaGl0U3RyICs9IGAgZm9yICR7ZGFtYWdlRG9uZX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgaGl0U3RyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcGVsbCBpbnN0YW5jZW9mIFNwZWxsRGFtYWdlKSB7XG4gICAgICAgICAgICBpZiAoc3BlbGwuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAvLyBjYWxsaW5nIHRoaXMgYmVmb3JlIHVwZGF0ZSBwcm9jcyBiZWNhdXNlIGluIHRoZSBjYXNlIG9mIGV4ZWN1dGUsIHVuYnJpZGxlZCB3cmF0aCBjb3VsZCBwcm9jXG4gICAgICAgICAgICAgICAgLy8gdGhlbiBzZXR0aW5nIHRoZSByYWdlIHRvIDAgd291bGQgY2F1c2UgdXMgdG8gbG9zZSB0aGUgMSByYWdlIGZyb20gdW5icmlkbGVkIHdyYXRoXG4gICAgICAgICAgICAgICAgLy8gYWx0ZXJuYXRpdmUgaXMgdG8gc2F2ZSB0aGUgYW1vdW50IG9mIHJhZ2UgdXNlZCBmb3IgdGhlIGFiaWxpdHlcbiAgICAgICAgICAgICAgICBzcGVsbC5jYWxsYmFjayh0aGlzLCBoaXRPdXRjb21lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3BlbGwgfHwgc3BlbGwuY2FuUHJvYykge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIHNwZWxsKTtcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIudXBkYXRlKHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVhbFNwZWxsRGFtYWdlKHRpbWU6IG51bWJlciwgcmF3RGFtYWdlOiBudW1iZXIsIHRhcmdldDogVW5pdCwgc3BlbGw6IFNwZWxsKSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZURvbmUgPSByYXdEYW1hZ2U7XG5cbiAgICAgICAgdGhpcy5kYW1hZ2VMb2cucHVzaChbdGltZSwgZGFtYWdlRG9uZV0pO1xuXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgYCR7c3BlbGwubmFtZX0gaGl0cyBmb3IgJHtkYW1hZ2VEb25lfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHN3aW5nV2VhcG9uKHRpbWU6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBjb25zdCByYXdEYW1hZ2UgPSB0aGlzLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyAmJiBpc19taCAmJiB0aGlzLnF1ZXVlZFNwZWxsICYmIHRoaXMucXVldWVkU3BlbGwuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRTcGVsbC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgY29uc3Qgc3dpbmdTcGVsbCA9IHRoaXMucXVldWVkU3BlbGwuc3BlbGw7XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFNwZWxsID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgY29uc3QgYm9udXNEYW1hZ2UgPSBzd2luZ1NwZWxsLmJvbnVzRGFtYWdlO1xuICAgICAgICAgICAgdGhpcy5kZWFsTWVsZWVEYW1hZ2UodGltZSwgcmF3RGFtYWdlICsgYm9udXNEYW1hZ2UsIHRhcmdldCwgaXNfbWgsIHN3aW5nU3BlbGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWFsTWVsZWVEYW1hZ2UodGltZSwgcmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IFt0aGlzV2VhcG9uLCBvdGhlcldlYXBvbl0gPSBpc19taCA/IFt0aGlzLm1oLCB0aGlzLm9oXSA6IFt0aGlzLm9oLCB0aGlzLm1oXTtcblxuICAgICAgICB0aGlzV2VhcG9uIS5uZXh0U3dpbmdUaW1lID0gdGltZSArIHRoaXNXZWFwb24hLndlYXBvbi5zcGVlZCAvIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuaGFzdGUgKiAxMDAwO1xuXG4gICAgICAgIGlmIChvdGhlcldlYXBvbiAmJiBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lIDwgdGltZSArIDIwMCkge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGRlbGF5aW5nICR7aXNfbWggPyAnT0gnIDogJ01IJ30gc3dpbmdgLCB0aW1lICsgMjAwIC0gb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSk7XG4gICAgICAgICAgICBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lID0gdGltZSArIDIwMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUF0dGFja2luZ1N0YXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy50YXJnZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHRoaXMuZXh0cmFBdHRhY2tDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXh0cmFBdHRhY2tDb3VudC0tO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aW1lID49IHRoaXMubWghLm5leHRTd2luZ1RpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCB0cnVlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5vaCAmJiB0aW1lID49IHRoaXMub2gubmV4dFN3aW5nVGltZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciwgTWVsZWVIaXRPdXRjb21lLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmT3ZlclRpbWUsIEJ1ZmZQcm9jIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBMZWFybmVkU3BlbGwsIFNwZWxsRGFtYWdlLCBTcGVsbFR5cGUsIFN3aW5nU3BlbGwsIExlYXJuZWRTd2luZ1NwZWxsLCBQcm9jLCBTcGVsbEJ1ZmYsIFNwZWxsRmFtaWx5IH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IGNsYW1wIH0gZnJvbSBcIi4vbWF0aC5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuXG5jb25zdCBmbHVycnkgPSBuZXcgQnVmZihcIkZsdXJyeVwiLCAxNSwge2hhc3RlOiAxLjN9LCB0cnVlLCAzLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG5leHBvcnQgY29uc3QgcmFjZVRvU3RhdHMgPSBuZXcgTWFwPFJhY2UsIFN0YXRWYWx1ZXM+KCk7XG5yYWNlVG9TdGF0cy5zZXQoUmFjZS5IVU1BTiwgeyBtYWNlU2tpbGw6IDUsIHN3b3JkU2tpbGw6IDUsIG1hY2UySFNraWxsOiA1LCBzd29yZDJIU2tpbGw6IDUsIHN0cjogMTIwLCBhZ2k6IDgwIH0pO1xucmFjZVRvU3RhdHMuc2V0KFJhY2UuT1JDLCB7IGF4ZVNraWxsOiA1LCBheGUySFNraWxsOiA1LCBzdHI6IDEyMywgYWdpOiA3NyB9KTtcblxuZXhwb3J0IGNsYXNzIFdhcnJpb3IgZXh0ZW5kcyBQbGF5ZXIge1xuICAgIHJhZ2UgPSA4MDsgLy8gVE9ETyAtIGFsbG93IHNpbXVsYXRpb24gdG8gY2hvb3NlIHN0YXJ0aW5nIHJhZ2VcblxuICAgIGV4ZWN1dGUgPSBuZXcgTGVhcm5lZFNwZWxsKGV4ZWN1dGVTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2R0aGlyc3QgPSBuZXcgTGVhcm5lZFNwZWxsKGJsb29kdGhpcnN0U3BlbGwsIHRoaXMpO1xuICAgIGhhbXN0cmluZyA9IG5ldyBMZWFybmVkU3BlbGwoaGFtc3RyaW5nU3BlbGwsIHRoaXMpO1xuICAgIHdoaXJsd2luZCA9IG5ldyBMZWFybmVkU3BlbGwod2hpcmx3aW5kU3BlbGwsIHRoaXMpO1xuICAgIGhlcm9pY1N0cmlrZSA9IG5ldyBMZWFybmVkU3dpbmdTcGVsbChoZXJvaWNTdHJpa2VTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2RSYWdlID0gbmV3IExlYXJuZWRTcGVsbChibG9vZFJhZ2UsIHRoaXMpO1xuICAgIGRlYXRoV2lzaCA9IG5ldyBMZWFybmVkU3BlbGwoZGVhdGhXaXNoLCB0aGlzKTtcbiAgICBleGVjdXRlU3BlbGwgPSBuZXcgTGVhcm5lZFNwZWxsKGV4ZWN1dGVTcGVsbCwgdGhpcyk7XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgbG9nQ2FsbGJhY2s/OiAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICAgICAgc3VwZXIobmV3IFN0YXRzKHJhY2VUb1N0YXRzLmdldChyYWNlKSkuYWRkKHN0YXRzKSwgbG9nQ2FsbGJhY2spO1xuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYWRkKGFuZ2VyTWFuYWdlbWVudE9ULCBNYXRoLnJhbmRvbSgpICogLTMwMDApOyAvLyByYW5kb21pemluZyBhbmdlciBtYW5hZ2VtZW50IHRpbWluZ1xuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZCh1bmJyaWRsZWRXcmF0aCwgMCk7XG4gICAgfVxuXG4gICAgZ2V0IHBvd2VyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yYWdlO1xuICAgIH1cblxuICAgIHNldCBwb3dlcihwb3dlcjogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMucG93ZXJMb3N0ICs9IE1hdGgubWF4KDAsIHBvd2VyIC0gMTAwKTtcbiAgICAgICAgdGhpcy5yYWdlID0gY2xhbXAocG93ZXIsIDAsIDEwMCk7XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sZXZlbCAqIDMgLSAyMCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXAgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0ciAqIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RhdE11bHQgKiAyO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICAvLyBjcnVlbHR5ICsgYmVyc2Vya2VyIHN0YW5jZVxuICAgICAgICByZXR1cm4gNSArIDMgKyBzdXBlci5jYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gc3VwZXIuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIGlzX21oLCBzcGVsbCk7XG5cbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCAmJiBzcGVsbCAmJiBzcGVsbC5mYW1pbHkgPT09IFNwZWxsRmFtaWx5LldBUlJJT1IpIHtcbiAgICAgICAgICAgIGRhbWFnZURvbmUgKj0gMS4xOyAvLyBpbXBhbGVcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIFtkYW1hZ2VEb25lLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV07XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHJld2FyZFJhZ2UoZGFtYWdlOiBudW1iZXIsIGlzX2F0dGFja2VyOiBib29sZWFuLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgLy8gaHR0cHM6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvMTgzMjUtdGhlLW5ldy1yYWdlLWZvcm11bGEtYnkta2FsZ2FuL1xuICAgICAgICAvLyBQcmUtRXhwYW5zaW9uIFJhZ2UgR2FpbmVkIGZyb20gZGVhbGluZyBkYW1hZ2U6XG4gICAgICAgIC8vIChEYW1hZ2UgRGVhbHQpIC8gKFJhZ2UgQ29udmVyc2lvbiBhdCBZb3VyIExldmVsKSAqIDcuNVxuICAgICAgICAvLyBGb3IgVGFraW5nIERhbWFnZSAoYm90aCBwcmUgYW5kIHBvc3QgZXhwYW5zaW9uKTpcbiAgICAgICAgLy8gUmFnZSBHYWluZWQgPSAoRGFtYWdlIFRha2VuKSAvIChSYWdlIENvbnZlcnNpb24gYXQgWW91ciBMZXZlbCkgKiAyLjVcbiAgICAgICAgLy8gUmFnZSBDb252ZXJzaW9uIGF0IGxldmVsIDYwOiAyMzAuNlxuICAgICAgICAvLyBUT0RPIC0gaG93IGRvIGZyYWN0aW9ucyBvZiByYWdlIHdvcms/IGl0IGFwcGVhcnMgeW91IGRvIGdhaW4gZnJhY3Rpb25zIGJhc2VkIG9uIGV4ZWMgZGFtYWdlXG4gICAgICAgIC8vIG5vdCB0cnVuY2F0aW5nIGZvciBub3dcbiAgICAgICAgLy8gVE9ETyAtIGl0IGFwcGVhcnMgdGhhdCByYWdlIGlzIGNhbGN1bGF0ZWQgdG8gdGVudGhzIGJhc2VkIG9uIGRhdGFiYXNlIHZhbHVlcyBvZiBzcGVsbHMgKDEwIGVuZXJneSA9IDEgcmFnZSlcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IExFVkVMXzYwX1JBR0VfQ09OViA9IDIzMC42O1xuICAgICAgICBsZXQgYWRkUmFnZSA9IGRhbWFnZSAvIExFVkVMXzYwX1JBR0VfQ09OVjtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc19hdHRhY2tlcikge1xuICAgICAgICAgICAgYWRkUmFnZSAqPSA3LjU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUT0RPIC0gY2hlY2sgZm9yIGJlcnNlcmtlciByYWdlIDEuM3ggbW9kaWZpZXJcbiAgICAgICAgICAgIGFkZFJhZ2UgKj0gMi41O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubG9nKSB0aGlzLmxvZyh0aW1lLCBgR2FpbmVkICR7TWF0aC5taW4oYWRkUmFnZSwgMTAwIC0gdGhpcy5yYWdlKX0gcmFnZSAoJHtNYXRoLm1pbigxMDAsIHRoaXMucG93ZXIgKyBhZGRSYWdlKX0pYCk7XG5cbiAgICAgICAgdGhpcy5wb3dlciArPSBhZGRSYWdlO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZVByb2NzKHRpbWUsIGlzX21oLCBoaXRPdXRjb21lLCBkYW1hZ2VEb25lLCBjbGVhbkRhbWFnZSwgc3BlbGwpO1xuXG4gICAgICAgIGlmIChbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIGlmIChzcGVsbCkge1xuICAgICAgICAgICAgICAgIC8vIGh0dHA6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvNjkzNjUtMTgtMDItMDUta2FsZ2Fucy1yZXNwb25zZS10by13YXJyaW9ycy8gXCJzaW5jZSBtaXNzaW5nIHdhc3RlcyAyMCUgb2YgdGhlIHJhZ2UgY29zdCBvZiB0aGUgYWJpbGl0eVwiXG4gICAgICAgICAgICAgICAgLy8gVE9ETyAtIG5vdCBzdXJlIGhvdyBibGl6emxpa2UgdGhpcyBpc1xuICAgICAgICAgICAgICAgIGlmIChzcGVsbCAhPT0gd2hpcmx3aW5kU3BlbGwpIHsgLy8gVE9ETyAtIHNob3VsZCBjaGVjayB0byBzZWUgaWYgaXQgaXMgYW4gYW9lIHNwZWxsIG9yIGEgc2luZ2xlIHRhcmdldCBzcGVsbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJhZ2UgKz0gc3BlbGwuY29zdCAqIDAuODI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoY2xlYW5EYW1hZ2UgKiAwLjc1LCB0cnVlLCB0aW1lKTsgLy8gVE9ETyAtIHdoZXJlIGlzIHRoaXMgZm9ybXVsYSBmcm9tP1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRhbWFnZURvbmUgJiYgIXNwZWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoZGFtYWdlRG9uZSwgdHJ1ZSwgdGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnN0YW50IGF0dGFja3MgYW5kIG1pc3Nlcy9kb2RnZXMgZG9uJ3QgdXNlIGZsdXJyeSBjaGFyZ2VzIC8vIFRPRE8gLSBjb25maXJtLCB3aGF0IGFib3V0IHBhcnJ5P1xuICAgICAgICAvLyBleHRyYSBhdHRhY2tzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyBidXQgdGhleSBjYW4gcHJvYyBmbHVycnkgKHRlc3RlZClcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXRoaXMuZG9pbmdFeHRyYUF0dGFja3NcbiAgICAgICAgICAgICYmICEoc3BlbGwgfHwgc3BlbGwgPT09IGhlcm9pY1N0cmlrZVNwZWxsKVxuICAgICAgICAgICAgJiYgIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpXG4gICAgICAgICAgICAmJiBoaXRPdXRjb21lICE9PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVRcbiAgICAgICAgKSB7IFxuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5yZW1vdmUoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCkge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGlnbm9yaW5nIGRlZXAgd291bmRzXG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChmbHVycnksIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZXJvaWNTdHJpa2VTcGVsbCA9IG5ldyBTd2luZ1NwZWxsKFwiSGVyb2ljIFN0cmlrZVwiLCBTcGVsbEZhbWlseS5XQVJSSU9SLCAxNTcsIDEyKTtcblxuLy8gZXhlY3V0ZSBhY3R1YWxseSB3b3JrcyBieSBjYXN0aW5nIHR3byBzcGVsbHMsIGZpcnN0IHJlcXVpcmVzIHdlYXBvbiBidXQgZG9lcyBubyBkYW1hZ2Vcbi8vIHNlY29uZCBvbmUgZG9lc24ndCByZXF1aXJlIHdlYXBvbiBhbmQgZGVhbHMgdGhlIGRhbWFnZS5cbi8vIExIIGNvcmUgb3ZlcnJvZGUgdGhlIHNlY29uZCBzcGVsbCB0byByZXF1aXJlIHdlYXBvbiAoYmVuZWZpdCBmcm9tIHdlYXBvbiBza2lsbClcbmNvbnN0IGV4ZWN1dGVTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkV4ZWN1dGVcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIDYwMCArIChwbGF5ZXIucG93ZXIgLSAxMCkgKiAxNTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDEwLCAwLCAocGxheWVyOiBQbGF5ZXIsIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSkgPT4ge1xuICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTU10uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgcGxheWVyLnBvd2VyID0gMDtcbiAgICB9XG59KTtcblxuY29uc3QgYmxvb2R0aGlyc3RTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkJsb29kdGhpcnN0XCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiAoPFdhcnJpb3I+cGxheWVyKS5hcCAqIDAuNDU7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUwsIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDMwLCA2KTtcblxuY29uc3Qgd2hpcmx3aW5kU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJXaGlybHdpbmRcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIHBsYXllci5jYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZSh0cnVlKTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDI1LCAxMCk7XG5cbmNvbnN0IGhhbXN0cmluZ1NwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiSGFtc3RyaW5nXCIsIDQ1LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBTcGVsbEZhbWlseS5XQVJSSU9SLCB0cnVlLCAxMCwgMCk7XG5cbmV4cG9ydCBjb25zdCBhbmdlck1hbmFnZW1lbnRPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJBbmdlciBNYW5hZ2VtZW50XCIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCB1bmRlZmluZWQsIDMwMDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgcGxheWVyLnBvd2VyICs9IDE7XG4gICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluZWQgMSByYWdlIGZyb20gQW5nZXIgTWFuYWdlbWVudGApO1xufSk7XG5cbmNvbnN0IGJsb29kUmFnZU9UID0gbmV3IEJ1ZmZPdmVyVGltZShcIkJsb29kcmFnZVwiLCAxMCwgdW5kZWZpbmVkLCAxMDAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbmVkIDEgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xufSk7XG5cbmNvbnN0IGJsb29kUmFnZSA9IG5ldyBTcGVsbChcIkJsb29kcmFnZVwiLCBTcGVsbFR5cGUuTk9ORSwgU3BlbGxGYW1pbHkuV0FSUklPUiwgZmFsc2UsIDAsIDYwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxMDtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMTAgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xuICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYmxvb2RSYWdlT1QsIHRpbWUpO1xufSk7XG5cbmNvbnN0IGRlYXRoV2lzaCA9IG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJEZWF0aCBXaXNoXCIsIDMwLCB7IGRhbWFnZU11bHQ6IDEuMiB9KSwgdHJ1ZSwgMTAsIDMgKiA2MCk7XG5cbmNvbnN0IHVuYnJpZGxlZFdyYXRoID0gbmV3IEJ1ZmZQcm9jKFwiVW5icmlkbGVkIFdyYXRoXCIsIDYwICogNjAsXG4gICAgbmV3IFByb2MoXG4gICAgICAgIG5ldyBTcGVsbChcIlVuYnJpZGxlZCBXcmF0aFwiLCBTcGVsbFR5cGUuTk9ORSwgU3BlbGxGYW1pbHkuV0FSUklPUiwgZmFsc2UsIDAsIDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMSByYWdlIGZyb20gVW5icmlkbGVkIFdyYXRoYCk7XG4gICAgICAgICAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICAgICAgfSksXG4gICAgICAgIHtjaGFuY2U6IDQwfSkpO1xuIiwiaW1wb3J0IHsgUHJvYywgU3BlbGxCdWZmLCBFeHRyYUF0dGFjayB9IGZyb20gXCIuLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1TbG90IH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEVuY2hhbnREZXNjcmlwdGlvbiB7XG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNsb3Q6IEl0ZW1TbG90LFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbiAgICBwcm9jPzogUHJvY1xufVxuXG5leHBvcnQgY29uc3QgZW5jaGFudHM6IEVuY2hhbnREZXNjcmlwdGlvbltdID0gW1xuICAgIHtcbiAgICAgICAgLy8gTk9URTogdG8gc2ltcGxpZnkgdGhlIGNvZGUsIHRyZWF0aW5nIHRoZXNlIGFzIHR3byBzZXBhcmF0ZSBidWZmcyBzaW5jZSB0aGV5IHN0YWNrXG4gICAgICAgIC8vIGNydXNhZGVyIGJ1ZmZzIGFwcGFyZW50bHkgY2FuIGJlIGZ1cnRoZXIgc3RhY2tlZCBieSBzd2FwcGluZyB3ZWFwb25zIGJ1dCBub3QgZ29pbmcgdG8gYm90aGVyIHdpdGggdGhhdFxuICAgICAgICBuYW1lOiAnQ3J1c2FkZXIgTUgnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgcHJvYzogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE1IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pLFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnQ3J1c2FkZXIgT0gnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBwcm9jOiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiQ3J1c2FkZXIgT0hcIiwgMTUsIG5ldyBTdGF0cyh7c3RyOiAxMDB9KSkpLCB7cHBtOiAxfSksXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICc4IFN0cmVuZ3RoJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCB8IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA4fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzE1IEFnaWxpdHknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE1fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzEgSGFzdGUnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IRUFEIHwgSXRlbVNsb3QuTEVHUyB8IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge2hhc3RlOiAxLjAxfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzMgQWdpbGl0eScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7YWdpOiAzfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1pHIEVuY2hhbnQgKDMwIEFQKScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge2FwOiAzMH0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdHcmVhdGVyIFN0YXRzICgrNCknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDQsIGFnaTogNH0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICc5IFN0cmVuZ3RoJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV1JJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA5fSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ1J1biBTcGVlZCcsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7fSwgLy8gVE9ETyAtIGRvIG1vdmVtZW50IHNwZWVkIGlmIEkgZXZlciBnZXQgYXJvdW5kIHRvIHNpbXVsYXRpbmcgZmlnaHRzIHlvdSBoYXZlIHRvIHJ1biBvdXRcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJzcgQWdpbGl0eScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7YWdpOiA3fSxcbiAgICB9LFxuXTtcblxuZXhwb3J0IGNvbnN0IHRlbXBvcmFyeUVuY2hhbnRzOiBFbmNoYW50RGVzY3JpcHRpb25bXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6ICcrOCBEYW1hZ2UnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCB8IEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIHN0YXRzOiB7IHBsdXNEYW1hZ2U6IDggfSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0VsZW1lbnRhbCBTaGFycGVuaW5nIFN0b25lJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQgfCBJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBzdGF0czogeyBjcml0OiAyIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdXaW5kZnVyeScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBwcm9jOiBuZXcgUHJvYyhbXG4gICAgICAgICAgICBuZXcgRXh0cmFBdHRhY2soXCJXaW5kZnVyeSBUb3RlbVwiLCAxKSxcbiAgICAgICAgICAgIG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJXaW5kZnVyeSBUb3RlbVwiLCAxLjUsIHsgYXA6IDMxNSB9KSlcbiAgICAgICAgXSwge2NoYW5jZTogMC4yfSksXG4gICAgfVxuXTtcbiIsImltcG9ydCB7IFdlYXBvblR5cGUsIFdlYXBvbkRlc2NyaXB0aW9uLCBJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uIH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcbmltcG9ydCB7IFNwZWxsQnVmZiwgRXh0cmFBdHRhY2ssIFByb2MsIFNwZWxsVHlwZSwgSXRlbVNwZWxsRGFtYWdlLCBTcGVsbERhbWFnZSwgU3BlbGxGYW1pbHkgfSBmcm9tIFwiLi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IEJ1ZmYsIEJ1ZmZQcm9jIH0gZnJvbSBcIi4uL2J1ZmYuanNcIjtcblxuLy8gVE9ETyAtIGhvdyB0byBpbXBsZW1lbnQgc2V0IGJvbnVzZXM/IHByb2JhYmx5IGVhc2llc3QgdG8gYWRkIGJvbnVzIHRoYXQgcmVxdWlyZXMgYSBzdHJpbmcgc2VhcmNoIG9mIG90aGVyIGVxdWlwZWQgaXRlbXNcblxuZXhwb3J0IGNvbnN0IGl0ZW1zOiAoSXRlbURlc2NyaXB0aW9ufFdlYXBvbkRlc2NyaXB0aW9uKVtdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogXCJJcm9uZm9lXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIG1pbjogNzMsXG4gICAgICAgIG1heDogMTM2LFxuICAgICAgICBzcGVlZDogMi40LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IEV4dHJhQXR0YWNrKCdJcm9uZm9lJywgMikse3BwbTogMX0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRW1weXJlYW4gRGVtb2xpc2hlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDk0LFxuICAgICAgICBtYXg6IDE3NSxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJIYXN0ZSAoRW1weXJlYW4gRGVtb2xpc2hlcilcIiwgMTAsIHtoYXN0ZTogMS4yfSkpLHtwcG06IDF9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFudWJpc2F0aCBXYXJoYW1tZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDY2LFxuICAgICAgICBtYXg6IDEyMyxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgbWFjZVNraWxsOiA0LCBhcDogMzIgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRoZSBVbnRhbWVkIEJsYWRlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQySCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogMTkyLFxuICAgICAgICBtYXg6IDI4OSxcbiAgICAgICAgc3BlZWQ6IDMuNCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJVbnRhbWVkIEZ1cnlcIiwgOCwge3N0cjogMzAwfSkpLHtwcG06IDJ9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1pc3BsYWNlZCBTZXJ2byBBcm1cIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEyOCxcbiAgICAgICAgbWF4OiAyMzgsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIG9uZXF1aXA6IG5ldyBQcm9jKG5ldyBTcGVsbERhbWFnZShcIkVsZWN0cmljIERpc2NoYXJnZVwiLCBbMTAwLCAxNTFdLCBTcGVsbFR5cGUuTUFHSUMsIFNwZWxsRmFtaWx5Lk5PTkUpLHtwcG06IDN9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhhbmQgb2YgSnVzdGljZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiAyMH0sXG4gICAgICAgIG9uZXF1aXA6IG5ldyBQcm9jKG5ldyBFeHRyYUF0dGFjaygnSGFuZCBvZiBKdXN0aWNlJywgMSksIHtjaGFuY2U6IDIvMTAwfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGFja2hhbmQncyBCcmVhZHRoXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEcmFrZSBGYW5nIFRhbGlzbWFuXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDU2LCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTGlvbmhlYXJ0IEhlbG1cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCxcbiAgICAgICAgc3RhdHM6IHtjcml0OiAyLCBoaXQ6IDIsIHN0cjogMTh9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmFyYmVkIENob2tlclwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5ORUNLLFxuICAgICAgICBzdGF0czoge2FwOiA0NCwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJPbnl4aWEgVG9vdGggUGVuZGFudFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5ORUNLLFxuICAgICAgICBzdGF0czoge2FnaTogMTIsIGhpdDogMSwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBTcGF1bGRlcnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNsb2FrIG9mIERyYWNvbmljIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNiwgYWdpOiAxNn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEcmFwZSBvZiBVbnlpZWxkaW5nIFN0cmVuZ3RoXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNSwgYWdpOiA5LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgQnJlYXN0cGxhdGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNhdmFnZSBHbGFkaWF0b3IgQ2hhaW5cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxNCwgc3RyOiAxMywgY3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHaG91bCBTa2luIFR1bmljXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogNDAsIGNyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQnJlYXN0cGxhdGUgb2YgQW5uaWhpbGF0aW9uXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogMzcsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJIaXZlIERlZmlsZXIgV3Jpc3RndWFyZHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV1JJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMywgYWdpOiAxOH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJRaXJhamkgRXhlY3V0aW9uIEJyYWNlcnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV1JJU1QsXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxNiwgc3RyOiAxNSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdhdW50bGV0cyBvZiBNaWdodFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIyLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2F1bnRsZXRzIG9mIEFubmloaWxhdGlvblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDM1LCBjcml0OiAxLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRWRnZW1hc3RlcidzIEhhbmRndWFyZHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7IGF4ZVNraWxsOiA3LCBkYWdnZXJTa2lsbDogNywgc3dvcmRTa2lsbDogNyB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQWdlZCBDb3JlIExlYXRoZXIgR2xvdmVzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czogeyBzdHI6IDE1LCBjcml0OiAxLCBkYWdnZXJTa2lsbDogNSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiT25zbGF1Z2h0IEdpcmRsZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XQUlTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDMxLCBjcml0OiAxLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVGl0YW5pYyBMZWdnaW5nc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5MRUdTLFxuICAgICAgICBzdGF0czoge3N0cjogMzAsIGNyaXQ6IDEsIGhpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBMZWdndWFyZHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDIxLCBzdHI6IDMzLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQm9vdHMgb2YgdGhlIEZhbGxlbiBIZXJvXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNocm9tYXRpYyBCb290c1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMjAsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTdHJpa2VyJ3MgTWFya1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SQU5HRUQsXG4gICAgICAgIHN0YXRzOiB7YXA6IDIyLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUXVpY2sgU3RyaWtlIFJpbmdcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDMwLCBjcml0OiAxLCBzdHI6IDV9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmluZyBvZiB0aGUgUWlyYWppIEZ1cnlcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDQwLCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1hc3RlciBEcmFnb25zbGF5ZXIncyBSaW5nXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJJTkcxfEl0ZW1TbG90LlJJTkcyLFxuICAgICAgICBzdGF0czoge2FwOiA0OCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRvbiBKdWxpbydzIEJhbmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMSwgaGl0OiAxLCBhcDogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVmlzJ2thZyB0aGUgQmxvb2RsZXR0ZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDAsXG4gICAgICAgIG1heDogMTg3LFxuICAgICAgICBzcGVlZDogMi42LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IEl0ZW1TcGVsbERhbWFnZShcIkZhdGFsIFdvdW5kc1wiLCAyNDAsIFNwZWxsVHlwZS5QSFlTSUNBTCkse3BwbTogMS4zfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWNhbGx5IFRlbXBlcmVkIFN3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTA2LFxuICAgICAgICBtYXg6IDE5OCxcbiAgICAgICAgc3BlZWQ6IDIuNixcbiAgICAgICAgc3RhdHM6IHsgYWdpOiAxNCwgc3RyOiAxNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFsYWRhdGgsIFJ1bmVkIEJsYWRlIG9mIHRoZSBCbGFjayBGbGlnaHRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4NixcbiAgICAgICAgbWF4OiAxNjIsXG4gICAgICAgIHNwZWVkOiAyLjIsXG4gICAgICAgIHN0YXRzOiB7IHN3b3JkU2tpbGw6IDQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFuY2llbnQgUWlyYWppIFJpcHBlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExNCxcbiAgICAgICAgbWF4OiAyMTMsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyMCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUjE0IE1hY2VcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEzOCxcbiAgICAgICAgbWF4OiAyMDcsXG4gICAgICAgIHNwZWVkOiAyLjksXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUjE0IExvbmdzd29yZFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEzOCxcbiAgICAgICAgbWF4OiAyMDcsXG4gICAgICAgIHNwZWVkOiAyLjksXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUjE0IFN3aWZ0YmxhZGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4NSxcbiAgICAgICAgbWF4OiAxMjksXG4gICAgICAgIHNwZWVkOiAxLjgsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUjE0IEF4ZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzZWQgUWlyYWppIFdhciBBeGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTEwLFxuICAgICAgICBtYXg6IDIwNSxcbiAgICAgICAgc3BlZWQ6IDIuNjAsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAxNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ3J1bCdzaG9ydWtoLCBFZGdlIG9mIENoYW9zXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEwMSxcbiAgICAgICAgbWF4OiAxODgsXG4gICAgICAgIHNwZWVkOiAyLjMwLFxuICAgICAgICBzdGF0czogeyBhcDogMzYgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRlYXRoYnJpbmdlciAoVy9PIFBST0MpXCIsIC8vIFRPRE9cbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTE0LFxuICAgICAgICBtYXg6IDIxMyxcbiAgICAgICAgc3BlZWQ6IDIuOTBcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEb29tJ3MgRWRnZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4MyxcbiAgICAgICAgbWF4OiAxNTQsXG4gICAgICAgIHNwZWVkOiAyLjMwLFxuICAgICAgICBzdGF0czogeyBhZ2k6IDE2LCBzdHI6IDkgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1pcmFoJ3MgU29uZ1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDU3LFxuICAgICAgICBtYXg6IDg3LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBhZ2k6IDksIHN0cjogOSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRGVhdGgncyBTdGluZ1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkRBR0dFUixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA5NSxcbiAgICAgICAgbWF4OiAxNDQsXG4gICAgICAgIHNwZWVkOiAxLjgsXG4gICAgICAgIHN0YXRzOiB7IGFwOiAzOCwgZGFnZ2VyU2tpbGw6IDMgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzZWQgUWlyYWppIFB1Z2lvXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuREFHR0VSLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDcyLFxuICAgICAgICBtYXg6IDEzNCxcbiAgICAgICAgc3BlZWQ6IDEuNyxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgaGl0OiAxLCBhcDogMTggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkZlbHN0cmlrZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5EQUdHRVIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNTQsXG4gICAgICAgIG1heDogMTAxLFxuICAgICAgICBzcGVlZDogMS43LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkZlbHN0cmlrZXJcIiwgMywge2NyaXQ6IDEwMCwgaGl0OiAxMDB9KSkse3BwbTogMS40fSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBvbnVzZTogKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGluc2lnaHRPZlRoZVFpcmFqaSA9IG5ldyBCdWZmKFwiSW5zaWdodCBvZiB0aGUgUWlyYWppXCIsIDMwLCB7YXJtb3JQZW5ldHJhdGlvbjogMjAwfSwgdHJ1ZSwgMCwgNik7XG4gICAgICAgICAgICBjb25zdCBiYWRnZUJ1ZmYgPSBuZXcgU3BlbGxCdWZmKFxuICAgICAgICAgICAgICAgIG5ldyBCdWZmUHJvYyhcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIsIDMwLFxuICAgICAgICAgICAgICAgICAgICBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKGluc2lnaHRPZlRoZVFpcmFqaSksIHtwcG06IDE1fSksXG4gICAgICAgICAgICAgICAgICAgIGluc2lnaHRPZlRoZVFpcmFqaSksXG4gICAgICAgICAgICAgICAgZmFsc2UsIDAsIDMgKiA2MCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBiYWRnZUJ1ZmY7XG4gICAgICAgIH0pKClcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEaWFtb25kIEZsYXNrXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIG9udXNlOiBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiRGlhbW9uZCBGbGFza1wiLCA2MCwge3N0cjogNzV9KSwgdHJ1ZSwgMCwgNiAqIDYwKSxcbiAgICB9XG5dO1xuIiwiaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4uL3N0YXRzLmpzXCI7XG5cblxuaW50ZXJmYWNlIEJ1ZmZEZXNjcmlwdGlvbiB7XG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGR1cmF0aW9uOiBudW1iZXIsXG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxufVxuXG5leHBvcnQgY29uc3QgYnVmZnM6IEJ1ZmZbXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmF0dGxlIFNob3V0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjkwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHaWZ0IG9mIHRoZSBXaWxkXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMTYsIC8vIFRPRE8gLSBzaG91bGQgaXQgYmUgMTIgKiAxLjM1PyAodGFsZW50KVxuICAgICAgICAgICAgYWdpOiAxNlxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVHJ1ZXNob3QgQXVyYVwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMTAwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2luZyBvZiBLaW5nc1wiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0YXRNdWx0OiAxLjFcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzaW5nIG9mIE1pZ2h0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDIyMlxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU21va2VkIERlc2VydCBEdW1wbGluZ3NcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDIwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJKdWp1IFBvd2VyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAzMCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAzMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSnVqdSBNaWdodFwiLFxuICAgICAgICBkdXJhdGlvbjogMTAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiA0MFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRWxpeGlyIG9mIHRoZSBNb25nb29zZVwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhZ2k6IDI1LFxuICAgICAgICAgICAgY3JpdDogMlxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUi5PLkkuRC5TLlwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDI1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSYWxseWluZyBDcnkgb2YgdGhlIERyYWdvbnNsYXllclwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMTQwLFxuICAgICAgICAgICAgY3JpdDogNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU29uZ2Zsb3dlciBTZXJhbmFkZVwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBjcml0OiA1LFxuICAgICAgICAgICAgc3RyOiAxNSxcbiAgICAgICAgICAgIGFnaTogMTVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNwaXJpdCBvZiBaYW5kYWxhclwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdGF0TXVsdDogMS4xNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRmVuZ3VzJyBGZXJvY2l0eVwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjAwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJXYXJjaGllZidzIEJsZXNzaW5nXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGhhc3RlOiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuXS5tYXAoKGJkOiBCdWZmRGVzY3JpcHRpb24pID0+IG5ldyBCdWZmKGJkLm5hbWUsIGJkLmR1cmF0aW9uLCBiZC5zdGF0cykpO1xuIiwiaW1wb3J0IHsgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgTG9nRnVuY3Rpb24sIFJhY2UgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IFdhcnJpb3IgfSBmcm9tIFwiLi93YXJyaW9yLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgSXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbiB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IEVuY2hhbnREZXNjcmlwdGlvbiwgdGVtcG9yYXJ5RW5jaGFudHMsIGVuY2hhbnRzIH0gZnJvbSBcIi4vZGF0YS9lbmNoYW50cy5qc1wiO1xuaW1wb3J0IHsgaXRlbXMgfSBmcm9tIFwiLi9kYXRhL2l0ZW1zLmpzXCI7XG5pbXBvcnQgeyBidWZmcyB9IGZyb20gXCIuL2RhdGEvc3BlbGxzLmpzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2ltdWxhdGlvbkRlc2NyaXB0aW9uIHtcbiAgICByYWNlOiBSYWNlLFxuICAgIHN0YXRzOiBTdGF0VmFsdWVzLFxuICAgIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBudW1iZXI+LFxuICAgIGVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4sXG4gICAgdGVtcG9yYXJ5RW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPixcbiAgICBidWZmczogbnVtYmVyW10sXG4gICAgZmlnaHRMZW5ndGg6IG51bWJlcixcbiAgICByZWFsdGltZTogYm9vbGVhbixcbiAgICBoZXJvaWNTdHJpa2VSYWdlUmVxOiBudW1iZXIsXG4gICAgaGFtc3RyaW5nUmFnZVJlcTogbnVtYmVyLFxuICAgIGJsb29kdGhpcnN0RXhlY1JhZ2VMaW1pdDogbnVtYmVyLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBQbGF5ZXIocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24+LCBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCB0ZW1wb3JhcnlFbmNoYW50OiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIGJ1ZmZzOiBCdWZmW10sIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgY29uc3QgcGxheWVyID0gbmV3IFdhcnJpb3IocmFjZSwgc3RhdHMsIGxvZyk7XG5cbiAgICBmb3IgKGxldCBbc2xvdCwgaXRlbV0gb2YgZXF1aXBtZW50KSB7XG4gICAgICAgIHBsYXllci5lcXVpcChzbG90LCBpdGVtLCBlbmNoYW50cy5nZXQoc2xvdCksIHRlbXBvcmFyeUVuY2hhbnQuZ2V0KHNsb3QpKTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBidWZmIG9mIGJ1ZmZzKSB7XG4gICAgICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYnVmZiwgMCk7XG4gICAgfVxuXG4gICAgY29uc3QgYm9zcyA9IG5ldyBVbml0KDYzLCA0NjkxIC0gMjI1MCAtIDY0MCAtIDUwNSAtIDYwMCk7IC8vIHN1bmRlciwgY29yLCBmZiwgYW5uaWhcbiAgICBwbGF5ZXIudGFyZ2V0ID0gYm9zcztcblxuICAgIHJldHVybiBwbGF5ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBNYXA8SyxWPihzbG90VG9JbmRleDogTWFwPEssIG51bWJlcj4sIGxvb2t1cDogVltdKTogTWFwPEssIFY+IHtcbiAgICBjb25zdCByZXMgPSBuZXcgTWFwPEssVj4oKTtcblxuICAgIGZvciAobGV0IFtzbG90LCBpZHhdIG9mIHNsb3RUb0luZGV4KSB7XG4gICAgICAgIGlmIChsb29rdXBbaWR4XSkge1xuICAgICAgICAgICAgcmVzLnNldChzbG90LCBsb29rdXBbaWR4XSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnYmFkIGluZGV4JywgaWR4LCBsb29rdXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cEFycmF5PFY+KGluZGljZXM6IG51bWJlcltdLCBsb29rdXA6IFZbXSk6IFZbXSB7XG4gICAgY29uc3QgcmVzOiBWW10gPSBbXTtcblxuICAgIGZvciAobGV0IGlkeCBvZiBpbmRpY2VzKSB7XG4gICAgICAgIGlmIChsb29rdXBbaWR4XSkge1xuICAgICAgICAgICAgcmVzLnB1c2gobG9va3VwW2lkeF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2JhZCBpbmRleCcsIGlkeCwgbG9va3VwKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwSXRlbXMobWFwOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4pIHtcbiAgICByZXR1cm4gbG9va3VwTWFwKG1hcCwgaXRlbXMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwRW5jaGFudHMobWFwOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4pIHtcbiAgICByZXR1cm4gbG9va3VwTWFwKG1hcCwgZW5jaGFudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwVGVtcG9yYXJ5RW5jaGFudHMobWFwOiBNYXA8SXRlbVNsb3QsIG51bWJlcj4pIHtcbiAgICByZXR1cm4gbG9va3VwTWFwKG1hcCwgdGVtcG9yYXJ5RW5jaGFudHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwQnVmZnMoaW5kaWNlczogbnVtYmVyW10pIHtcbiAgICByZXR1cm4gbG9va3VwQXJyYXkoaW5kaWNlcywgYnVmZnMpO1xufVxuIiwiaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgSXRlbURlc2NyaXB0aW9uLCBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiwgUGxheWVyLCBSYWNlLCBEYW1hZ2VMb2cgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IHNldHVwUGxheWVyIH0gZnJvbSBcIi4vc2ltdWxhdGlvbl91dGlscy5qc1wiO1xuaW1wb3J0IHsgRW5jaGFudERlc2NyaXB0aW9uIH0gZnJvbSBcIi4vZGF0YS9lbmNoYW50cy5qc1wiO1xuXG5leHBvcnQgdHlwZSBJdGVtV2l0aFNsb3QgPSBbSXRlbURlc2NyaXB0aW9uLCBJdGVtU2xvdF07XG5cbi8vIFRPRE8gLSBjaGFuZ2UgdGhpcyBpbnRlcmZhY2Ugc28gdGhhdCBDaG9vc2VBY3Rpb24gY2Fubm90IHNjcmV3IHVwIHRoZSBzaW0gb3IgY2hlYXRcbi8vIGUuZy4gQ2hvb3NlQWN0aW9uIHNob3VsZG4ndCBjYXN0IHNwZWxscyBhdCBhIGN1cnJlbnQgdGltZVxuZXhwb3J0IHR5cGUgQ2hvb3NlQWN0aW9uID0gKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXIsIGNhbkV4ZWN1dGU6IGJvb2xlYW4pID0+IG51bWJlcjtcblxuZXhwb3J0IGNvbnN0IEVYRUNVVEVfUEhBU0VfUkFUSU8gPSAwLjE1OyAvLyBsYXN0IDE1JSBvZiB0aGUgdGltZSBpcyBleGVjdXRlIHBoYXNlXG5cbmNsYXNzIEZpZ2h0IHtcbiAgICBwbGF5ZXI6IFBsYXllcjtcbiAgICBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbjtcbiAgICBmaWdodExlbmd0aDogbnVtYmVyO1xuICAgIGR1cmF0aW9uID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBlcXVpcG1lbnQ6IE1hcDxJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uPiwgZW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPiwgdGVtcG9yYXJ5RW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPiwgYnVmZnM6IEJ1ZmZbXSwgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb24sIGZpZ2h0TGVuZ3RoID0gNjAsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHRoaXMucGxheWVyID0gc2V0dXBQbGF5ZXIocmFjZSwgc3RhdHMsIGVxdWlwbWVudCwgZW5jaGFudHMsIHRlbXBvcmFyeUVuY2hhbnRzLCBidWZmcywgbG9nKTtcbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24gPSBjaG9vc2VBY3Rpb247XG4gICAgICAgIHRoaXMuZmlnaHRMZW5ndGggPSAoZmlnaHRMZW5ndGggKyBNYXRoLnJhbmRvbSgpICogNCAtIDIpICogMTAwMDtcbiAgICB9XG5cbiAgICBydW4oKTogUHJvbWlzZTxGaWdodFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIHdoaWxlICh0aGlzLmR1cmF0aW9uIDw9IHRoaXMuZmlnaHRMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICBkYW1hZ2VMb2c6IHRoaXMucGxheWVyLmRhbWFnZUxvZyxcbiAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogdGhpcy5maWdodExlbmd0aCxcbiAgICAgICAgICAgICAgICBwb3dlckxvc3Q6IHRoaXMucGxheWVyLnBvd2VyTG9zdFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHBhdXNlKHBhdXNlOiBib29sZWFuKSB7fVxuXG4gICAgY2FuY2VsKCkge31cblxuICAgIHByb3RlY3RlZCB1cGRhdGUoKSB7XG4gICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSB0aGlzLmZpZ2h0TGVuZ3RoICogKDEgLSBFWEVDVVRFX1BIQVNFX1JBVElPKTtcbiAgICAgICAgY29uc3QgaXNFeGVjdXRlUGhhc2UgPSB0aGlzLmR1cmF0aW9uID49IGJlZ2luRXhlY3V0ZVRpbWU7XG5cbiAgICAgICAgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIudXBkYXRlKHRoaXMuZHVyYXRpb24pOyAvLyBuZWVkIHRvIGNhbGwgdGhpcyBpZiB0aGUgZHVyYXRpb24gY2hhbmdlZCBiZWNhdXNlIG9mIGJ1ZmZzIHRoYXQgY2hhbmdlIG92ZXIgdGltZSBsaWtlIGpvbSBnYWJiZXJcblxuICAgICAgICB0aGlzLmNob29zZUFjdGlvbih0aGlzLnBsYXllciwgdGhpcy5kdXJhdGlvbiwgdGhpcy5maWdodExlbmd0aCwgaXNFeGVjdXRlUGhhc2UpOyAvLyBjaG9vc2UgYWN0aW9uIGJlZm9yZSBpbiBjYXNlIG9mIGFjdGlvbiBkZXBlbmRpbmcgb24gdGltZSBvZmYgdGhlIGdjZCBsaWtlIGVhcnRoc3RyaWtlXG5cbiAgICAgICAgdGhpcy5wbGF5ZXIudXBkYXRlQXR0YWNraW5nU3RhdGUodGhpcy5kdXJhdGlvbik7XG4gICAgICAgIC8vIGNob29zZSBhY3Rpb24gYWZ0ZXIgZXZlcnkgc3dpbmcgd2hpY2ggY291bGQgYmUgYSByYWdlIGdlbmVyYXRpbmcgZXZlbnQsIGJ1dCBUT0RPOiBuZWVkIHRvIGFjY291bnQgZm9yIGxhdGVuY3ksIHJlYWN0aW9uIHRpbWUgKGJ1dHRvbiBtYXNoaW5nKVxuICAgICAgICBjb25zdCB3YWl0aW5nRm9yVGltZSA9IHRoaXMuY2hvb3NlQWN0aW9uKHRoaXMucGxheWVyLCB0aGlzLmR1cmF0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCBpc0V4ZWN1dGVQaGFzZSk7XG5cbiAgICAgICAgbGV0IG5leHRTd2luZ1RpbWUgPSB0aGlzLnBsYXllci5taCEubmV4dFN3aW5nVGltZTtcblxuICAgICAgICBpZiAodGhpcy5wbGF5ZXIub2gpIHtcbiAgICAgICAgICAgIG5leHRTd2luZ1RpbWUgPSBNYXRoLm1pbihuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5vaC5uZXh0U3dpbmdUaW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlbXBvcmFyeSBoYWNrXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAvLyBkb24ndCBpbmNyZW1lbnQgZHVyYXRpb24gKFRPRE86IGJ1dCBJIHJlYWxseSBzaG91bGQgYmVjYXVzZSB0aGUgc2VydmVyIGRvZXNuJ3QgbG9vcCBpbnN0YW50bHkpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wbGF5ZXIubmV4dEdDRFRpbWUgPiB0aGlzLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4odGhpcy5wbGF5ZXIubmV4dEdDRFRpbWUsIG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLm5leHRPdmVyVGltZVVwZGF0ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4obmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIubmV4dE92ZXJUaW1lVXBkYXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3YWl0aW5nRm9yVGltZSA8IHRoaXMuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSB3YWl0aW5nRm9yVGltZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNFeGVjdXRlUGhhc2UgJiYgYmVnaW5FeGVjdXRlVGltZSA8IHRoaXMuZHVyYXRpb24pIHsgLy8gbm90IGV4ZWN1dGUgYXQgc3RhcnQgb2YgdXBkYXRlXG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gYmVnaW5FeGVjdXRlVGltZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgUmVhbHRpbWVGaWdodCBleHRlbmRzIEZpZ2h0IHtcbiAgICBwcm90ZWN0ZWQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICBydW4oKTogUHJvbWlzZTxGaWdodFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBNU19QRVJfVVBEQVRFID0gMTAwMCAvIDYwO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZiwgcikgPT4ge1xuICAgICAgICAgICAgbGV0IG92ZXJyaWRlRHVyYXRpb24gPSAwO1xuXG4gICAgICAgICAgICBjb25zdCBsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmR1cmF0aW9uIDw9IHRoaXMuZmlnaHRMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhdXNlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJyaWRlRHVyYXRpb24gKz0gTVNfUEVSX1VQREFURTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBvdmVycmlkZUR1cmF0aW9uO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQobG9vcCwgTVNfUEVSX1VQREFURSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZih7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYW1hZ2VMb2c6IHRoaXMucGxheWVyLmRhbWFnZUxvZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiB0aGlzLmZpZ2h0TGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG93ZXJMb3N0OiB0aGlzLnBsYXllci5wb3dlckxvc3RcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2V0VGltZW91dChsb29wLCBNU19QRVJfVVBEQVRFKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UocGF1c2U6IGJvb2xlYW4pIHtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSBwYXVzZTtcbiAgICB9XG59XG5cbmV4cG9ydCB0eXBlIEZpZ2h0UmVzdWx0ID0geyBkYW1hZ2VMb2c6IERhbWFnZUxvZywgZmlnaHRMZW5ndGg6IG51bWJlciwgcG93ZXJMb3N0OiBudW1iZXJ9O1xuXG5leHBvcnQgdHlwZSBTaW11bGF0aW9uU3VtbWFyeSA9IHtcbiAgICBub3JtYWxEYW1hZ2U6IG51bWJlcixcbiAgICBleGVjRGFtYWdlOiBudW1iZXIsXG4gICAgbm9ybWFsRHVyYXRpb246IG51bWJlcixcbiAgICBleGVjRHVyYXRpb246IG51bWJlcixcbiAgICBwb3dlckxvc3Q6IG51bWJlcixcbiAgICBmaWdodHM6IG51bWJlcixcbn07XG5cbmV4cG9ydCB0eXBlIFN0YXR1c0hhbmRsZXIgPSAoc3RhdHVzOiBTaW11bGF0aW9uU3VtbWFyeSkgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIFNpbXVsYXRpb24ge1xuICAgIHJhY2U6IFJhY2U7XG4gICAgc3RhdHM6IFN0YXRWYWx1ZXM7XG4gICAgZXF1aXBtZW50OiBNYXA8SXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbj47XG4gICAgZW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPjtcbiAgICB0ZW1wb3JhcnlFbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+O1xuICAgIGJ1ZmZzOiBCdWZmW107XG4gICAgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb247XG4gICAgcHJvdGVjdGVkIGZpZ2h0TGVuZ3RoOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHJlYWx0aW1lOiBib29sZWFuO1xuICAgIGxvZz86IExvZ0Z1bmN0aW9uXG5cbiAgICBwcm90ZWN0ZWQgcmVxdWVzdFN0b3AgPSBmYWxzZTtcbiAgICBwcm90ZWN0ZWQgX3BhdXNlZCA9IGZhbHNlO1xuXG4gICAgZmlnaHRSZXN1bHRzOiBGaWdodFJlc3VsdFtdID0gW107XG5cbiAgICBjdXJyZW50RmlnaHQ/OiBGaWdodDtcblxuICAgIHByb3RlY3RlZCBjYWNoZWRTdW1tbWFyeTogU2ltdWxhdGlvblN1bW1hcnkgPSB7IG5vcm1hbERhbWFnZTogMCwgZXhlY0RhbWFnZTogMCwgbm9ybWFsRHVyYXRpb246IDAsIGV4ZWNEdXJhdGlvbjogMCwgcG93ZXJMb3N0OiAwLCBmaWdodHM6IDAgfTtcblxuICAgIGNvbnN0cnVjdG9yKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBlcXVpcG1lbnQ6IE1hcDxJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uPiwgZW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPiwgdGVtcG9yYXJ5RW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPiwgYnVmZnM6IEJ1ZmZbXSwgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb24sIGZpZ2h0TGVuZ3RoID0gNjAsIHJlYWx0aW1lID0gZmFsc2UsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHRoaXMucmFjZSA9IHJhY2U7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5lcXVpcG1lbnQgPSBlcXVpcG1lbnQ7XG4gICAgICAgIHRoaXMuZW5jaGFudHMgPSBlbmNoYW50cztcbiAgICAgICAgdGhpcy50ZW1wb3JhcnlFbmNoYW50cyA9IHRlbXBvcmFyeUVuY2hhbnRzO1xuICAgICAgICB0aGlzLmJ1ZmZzID0gYnVmZnM7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gZmlnaHRMZW5ndGg7XG4gICAgICAgIHRoaXMucmVhbHRpbWUgPSByZWFsdGltZTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IHBhdXNlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhdXNlZDtcbiAgICB9XG5cbiAgICBnZXQgc3RhdHVzKCk6IFNpbXVsYXRpb25TdW1tYXJ5IHtcbiAgICAgICAgZm9yIChsZXQgZmlnaHRSZXN1bHQgb2YgdGhpcy5maWdodFJlc3VsdHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSBmaWdodFJlc3VsdC5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IFt0aW1lLCBkYW1hZ2VdIG9mIGZpZ2h0UmVzdWx0LmRhbWFnZUxvZykge1xuICAgICAgICAgICAgICAgIGlmICh0aW1lID49IGJlZ2luRXhlY3V0ZVRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5leGVjRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbERhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbER1cmF0aW9uICs9IGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEdXJhdGlvbiArPSBmaWdodFJlc3VsdC5maWdodExlbmd0aCAtIGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LnBvd2VyTG9zdCArPSBmaWdodFJlc3VsdC5wb3dlckxvc3Q7XG5cbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkuZmlnaHRzKys7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpZ2h0UmVzdWx0cyA9IFtdO1xuXG4gICAgICAgIGxldCBub3JtYWxEYW1hZ2UgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbERhbWFnZTtcbiAgICAgICAgbGV0IGV4ZWNEYW1hZ2UgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEYW1hZ2U7XG4gICAgICAgIGxldCBub3JtYWxEdXJhdGlvbiA9IHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRHVyYXRpb247XG4gICAgICAgIGxldCBleGVjRHVyYXRpb24gPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEdXJhdGlvbjtcbiAgICAgICAgbGV0IHBvd2VyTG9zdCA9IHRoaXMuY2FjaGVkU3VtbW1hcnkucG93ZXJMb3N0O1xuICAgICAgICBsZXQgZmlnaHRzID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5maWdodHM7XG5cbiAgICAgICAgaWYgKHRoaXMucmVhbHRpbWUgJiYgdGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSB0aGlzLmN1cnJlbnRGaWdodC5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IFt0aW1lLCBkYW1hZ2VdIG9mIHRoaXMuY3VycmVudEZpZ2h0LnBsYXllci5kYW1hZ2VMb2cpIHtcbiAgICAgICAgICAgICAgICBpZiAodGltZSA+PSBiZWdpbkV4ZWN1dGVUaW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWNEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5vcm1hbERhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub3JtYWxEdXJhdGlvbiArPSBNYXRoLm1pbihiZWdpbkV4ZWN1dGVUaW1lLCB0aGlzLmN1cnJlbnRGaWdodC5kdXJhdGlvbik7XG4gICAgICAgICAgICBleGVjRHVyYXRpb24gKz0gTWF0aC5tYXgoMCwgdGhpcy5jdXJyZW50RmlnaHQuZHVyYXRpb24gLSBiZWdpbkV4ZWN1dGVUaW1lKTtcbiAgICAgICAgICAgIHBvd2VyTG9zdCArPSB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIucG93ZXJMb3N0O1xuICAgICAgICAgICAgZmlnaHRzKys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbm9ybWFsRGFtYWdlOiBub3JtYWxEYW1hZ2UsXG4gICAgICAgICAgICBleGVjRGFtYWdlOiBleGVjRGFtYWdlLFxuICAgICAgICAgICAgbm9ybWFsRHVyYXRpb246IG5vcm1hbER1cmF0aW9uLFxuICAgICAgICAgICAgZXhlY0R1cmF0aW9uOiBleGVjRHVyYXRpb24sXG4gICAgICAgICAgICBwb3dlckxvc3Q6IHBvd2VyTG9zdCxcbiAgICAgICAgICAgIGZpZ2h0czogZmlnaHRzLFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhcnQoKSB7XG4gICAgICAgIGNvbnN0IGZpZ2h0Q2xhc3MgPSB0aGlzLnJlYWx0aW1lID8gUmVhbHRpbWVGaWdodCA6IEZpZ2h0O1xuXG4gICAgICAgIGNvbnN0IG91dGVybG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAxMDApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICAgICAgY29uc3QgaW5uZXJsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjb3VudCA+IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KG91dGVybG9vcCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodCA9IG5ldyBmaWdodENsYXNzKHRoaXMucmFjZSwgdGhpcy5zdGF0cywgdGhpcy5lcXVpcG1lbnQsIHRoaXMuZW5jaGFudHMsIHRoaXMudGVtcG9yYXJ5RW5jaGFudHMsIHRoaXMuYnVmZnMsIHRoaXMuY2hvb3NlQWN0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCB0aGlzLnJlYWx0aW1lID8gdGhpcy5sb2cgOiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0LnJ1bigpLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpZ2h0UmVzdWx0cy5wdXNoKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgIGlubmVybG9vcCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghdGhpcy5yZXF1ZXN0U3RvcCkge1xuICAgICAgICAgICAgICAgIGlubmVybG9vcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIG91dGVybG9vcCgpO1xuICAgIH1cblxuICAgIHBhdXNlKHBhdXNlOiBib29sZWFufHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAocGF1c2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcGF1c2UgPSAhdGhpcy5wYXVzZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wYXVzZWQgPSBwYXVzZTtcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEZpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodC5wYXVzZShwYXVzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3RTdG9wID0gdHJ1ZTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2FycmlvclwiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyXCI7XG5pbXBvcnQgeyBTcGVsbEJ1ZmYgfSBmcm9tIFwiLi9zcGVsbFwiO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDaG9vc2VBY3Rpb24oaGVyb2ljU3RyaWtlUmFnZVJlcTogbnVtYmVyLCBoYW1zdHJpbmdSYWdlUmVxOiBudW1iZXIsIGJsb29kdGhpcnN0RXhlY1JhZ2VMaW1pdDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyLCBmaWdodExlbmd0aDogbnVtYmVyLCBleGVjdXRlUGhhc2U6IGJvb2xlYW4pOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCB3YXJyaW9yID0gPFdhcnJpb3I+cGxheWVyO1xuICAgIFxuICAgICAgICBjb25zdCB0aW1lUmVtYWluaW5nU2Vjb25kcyA9IChmaWdodExlbmd0aCAtIHRpbWUpIC8gMTAwMDtcblxuICAgICAgICBsZXQgd2FpdGluZ0ZvclRpbWUgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgICAgICAgLy8gVE9ETyAtIHdoYXQgYWJvdXQgR0NEIHNwZWxscyB3aGVyZSB5b3Ugc2hvdWxkIHBvcCB0aGVtIGJlZm9yZSBmaWdodD8gbGlrZSBkaWFtb25kIGZsYXNrIG9uIHZhZWxcbiAgICAgICAgLy8gbmVlZCB0byBhZGQgYSBzdGVwIGZvciBwcmUgZmlnaHQgYWN0aW9ucywgbWF5YmUgY2hvb3NlIGFjdGlvbiBzaG91bGQgYmUgYWJsZSB0byB3b3JrIG9uIG5lZ2F0aXZlIGZpZ2h0IHRpbWVcbiAgICAgICAgZm9yIChsZXQgW18sIGl0ZW1dIG9mIHBsYXllci5pdGVtcykge1xuICAgICAgICAgICAgaWYgKGl0ZW0ub251c2UgJiYgaXRlbS5vbnVzZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW0ub251c2Uuc3BlbGwgaW5zdGFuY2VvZiBTcGVsbEJ1ZmYpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRpbWVSZW1haW5pbmdTZWNvbmRzIDw9IGl0ZW0ub251c2Uuc3BlbGwuYnVmZi5kdXJhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5vbnVzZS5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSBNYXRoLm1pbih3YWl0aW5nRm9yVGltZSwgZmlnaHRMZW5ndGggLSBpdGVtLm9udXNlLnNwZWxsLmJ1ZmYuZHVyYXRpb24gKiAxMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIFxuICAgICAgICBpZiAod2Fycmlvci5yYWdlIDwgMzAgJiYgd2Fycmlvci5ibG9vZFJhZ2UuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgd2Fycmlvci5ibG9vZFJhZ2UuY2FzdCh0aW1lKTtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICAvLyBnY2Qgc3BlbGxzXG4gICAgICAgIGlmICh3YXJyaW9yLm5leHRHQ0RUaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgIGlmICh3YXJyaW9yLmRlYXRoV2lzaC5jYW5DYXN0KHRpbWUpICYmXG4gICAgICAgICAgICAgICAgKHRpbWVSZW1haW5pbmdTZWNvbmRzIDw9IDMwXG4gICAgICAgICAgICAgICAgfHwgKHRpbWVSZW1haW5pbmdTZWNvbmRzIC0gd2Fycmlvci5kZWF0aFdpc2guc3BlbGwuY29vbGRvd24pID4gMzApKSB7IC8vIGNvdWxkIGJlIHRpbWVkIGJldHRlclxuICAgICAgICAgICAgICAgIHdhcnJpb3IuZGVhdGhXaXNoLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV4ZWN1dGVQaGFzZSAmJiB3YXJyaW9yLmJsb29kdGhpcnN0LmNhbkNhc3QodGltZSkgJiYgd2Fycmlvci5yYWdlIDwgYmxvb2R0aGlyc3RFeGVjUmFnZUxpbWl0KSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5ibG9vZHRoaXJzdC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZXhlY3V0ZVBoYXNlICYmIHdhcnJpb3IuZXhlY3V0ZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5leGVjdXRlLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC50aW1lUmVtYWluaW5nKHRpbWUpIDwgMS41ICsgKHdhcnJpb3IubGF0ZW5jeSAvIDEwMDApKSB7XG4gICAgICAgICAgICAgICAgLy8gbm90IG9yIGFsbW9zdCBvZmYgY29vbGRvd24sIHdhaXQgZm9yIHJhZ2Ugb3IgY29vbGRvd25cbiAgICAgICAgICAgICAgICBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC5jb29sZG93biA+IHRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSBNYXRoLm1pbih3YWl0aW5nRm9yVGltZSwgd2Fycmlvci5ibG9vZHRoaXJzdC5jb29sZG93bik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLndoaXJsd2luZC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci53aGlybHdpbmQuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci53aGlybHdpbmQudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICAgICAgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLmNvb2xkb3duID4gdGltZSkge1xuICAgICAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IE1hdGgubWluKHdhaXRpbmdGb3JUaW1lLCB3YXJyaW9yLndoaXJsd2luZC5jb29sZG93bik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLnJhZ2UgPj0gaGFtc3RyaW5nUmFnZVJlcSAmJiB3YXJyaW9yLmhhbXN0cmluZy5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5oYW1zdHJpbmcuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIFxuICAgICAgICBpZiAoIWV4ZWN1dGVQaGFzZSAmJiB3YXJyaW9yLnJhZ2UgPj0gaGVyb2ljU3RyaWtlUmFnZVJlcSAmJiAhd2Fycmlvci5xdWV1ZWRTcGVsbCkge1xuICAgICAgICAgICAgd2Fycmlvci5xdWV1ZWRTcGVsbCA9IHdhcnJpb3IuaGVyb2ljU3RyaWtlO1xuICAgICAgICAgICAgaWYgKHdhcnJpb3IubG9nKSB3YXJyaW9yLmxvZyh0aW1lLCAncXVldWVpbmcgaGVyb2ljIHN0cmlrZScpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHJldHVybiB3YWl0aW5nRm9yVGltZTtcbiAgICB9O1xufVxuIiwiaW1wb3J0IHsgIE1haW5UaHJlYWRJbnRlcmZhY2UgfSBmcm9tIFwiLi93b3JrZXJfZXZlbnRfaW50ZXJmYWNlLmpzXCI7XG5pbXBvcnQgeyBTaW11bGF0aW9uIH0gZnJvbSBcIi4vc2ltdWxhdGlvbi5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbkRlc2NyaXB0aW9uLCBsb29rdXBJdGVtcywgbG9va3VwQnVmZnMsIGxvb2t1cEVuY2hhbnRzLCBsb29rdXBUZW1wb3JhcnlFbmNoYW50cyB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZUNob29zZUFjdGlvbiB9IGZyb20gXCIuL3dhcnJpb3JfYWkuanNcIjtcblxuY29uc3QgbWFpblRocmVhZEludGVyZmFjZSA9IE1haW5UaHJlYWRJbnRlcmZhY2UuaW5zdGFuY2U7XG5cbmxldCBjdXJyZW50U2ltOiBTaW11bGF0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxubWFpblRocmVhZEludGVyZmFjZS5hZGRFdmVudExpc3RlbmVyKCdzaW11bGF0ZScsIChkYXRhOiBhbnkpID0+IHtcbiAgICBjb25zdCBzaW1kZXNjID0gPFNpbXVsYXRpb25EZXNjcmlwdGlvbj5kYXRhO1xuXG4gICAgbGV0IGxvZ0Z1bmN0aW9uOiBMb2dGdW5jdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoc2ltZGVzYy5yZWFsdGltZSkge1xuICAgICAgICBsb2dGdW5jdGlvbiA9ICh0aW1lOiBudW1iZXIsIHRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdsb2cnLCB7XG4gICAgICAgICAgICAgICAgdGltZTogdGltZSxcbiAgICAgICAgICAgICAgICB0ZXh0OiB0ZXh0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjdXJyZW50U2ltID0gbmV3IFNpbXVsYXRpb24oc2ltZGVzYy5yYWNlLCBzaW1kZXNjLnN0YXRzLFxuICAgICAgICBsb29rdXBJdGVtcyhzaW1kZXNjLmVxdWlwbWVudCksXG4gICAgICAgIGxvb2t1cEVuY2hhbnRzKHNpbWRlc2MuZW5jaGFudHMpLFxuICAgICAgICBsb29rdXBUZW1wb3JhcnlFbmNoYW50cyhzaW1kZXNjLnRlbXBvcmFyeUVuY2hhbnRzKSxcbiAgICAgICAgbG9va3VwQnVmZnMoc2ltZGVzYy5idWZmcyksXG4gICAgICAgIGdlbmVyYXRlQ2hvb3NlQWN0aW9uKHNpbWRlc2MuaGVyb2ljU3RyaWtlUmFnZVJlcSwgc2ltZGVzYy5oYW1zdHJpbmdSYWdlUmVxLCBzaW1kZXNjLmJsb29kdGhpcnN0RXhlY1JhZ2VMaW1pdCksXG4gICAgICAgIHNpbWRlc2MuZmlnaHRMZW5ndGgsIHNpbWRlc2MucmVhbHRpbWUsIGxvZ0Z1bmN0aW9uKTtcblxuICAgIGN1cnJlbnRTaW0uc3RhcnQoKTtcblxuICAgIHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgaWYgKGN1cnJlbnRTaW0gJiYgIWN1cnJlbnRTaW0ucGF1c2VkKSB7XG4gICAgICAgICAgICBtYWluVGhyZWFkSW50ZXJmYWNlLnNlbmQoJ3N0YXR1cycsIGN1cnJlbnRTaW0hLnN0YXR1cyk7XG4gICAgICAgIH1cbiAgICB9LCA1MDApO1xufSk7XG5cbm1haW5UaHJlYWRJbnRlcmZhY2UuYWRkRXZlbnRMaXN0ZW5lcigncGF1c2UnLCAocGF1c2U6IGJvb2xlYW58dW5kZWZpbmVkKSA9PiB7XG4gICAgaWYgKGN1cnJlbnRTaW0pIHtcbiAgICAgICAgY3VycmVudFNpbS5wYXVzZShwYXVzZSk7XG4gICAgfVxufSk7XG4iXSwibmFtZXMiOltd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QUMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxLQUFLLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLEtBQUssQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUM7UUFFM0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxLQUFLLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxZQUFZLEtBQUssQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUM7UUFDM0Ms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UUFDOUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLO1FBQ3BCLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0tBQ3JDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSztRQUNwQixLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7S0FDNUI7SUFDRDtRQUNJLElBQUksRUFBRSw2QkFBNkI7UUFDbkMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLO1FBQ3BCLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQ3BDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsMEJBQTBCO1FBQ2hDLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSztRQUNwQixLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUM7S0FDNUI7SUFDRDtRQUNJLElBQUksRUFBRSwwQkFBMEI7UUFDaEMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLO1FBQ3BCLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQ3BDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsb0JBQW9CO1FBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSztRQUNwQixLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUM7S0FDM0I7SUFDRDtRQUNJLElBQUksRUFBRSwyQkFBMkI7UUFDakMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLO1FBQ3BCLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFB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
