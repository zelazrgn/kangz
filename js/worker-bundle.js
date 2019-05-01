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
})(SpellType || (SpellType = {}));
class SpellDamage extends Spell {
    constructor(name, amount, type, family, is_gcd = false, cost = 0, cooldown = 0, callback) {
        super(name, type, family, is_gcd, cost, cooldown, (player, time) => {
            const dmg = (typeof amount === "number") ? amount : amount(player);
            if (type === SpellType.PHYSICAL || type === SpellType.PHYSICAL_WEAPON) {
                player.dealMeleeDamage(time, dmg, player.target, true, this);
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

function urand(min, max) {
    return min + Math.round(Math.random() * (max - min));
}
function frand(min, max) {
    return min + Math.random() * (max - min);
}
function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3BlbGwudHMiLCIuLi9zcmMvaXRlbS50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL2VuY2hhbnRzLnRzIiwiLi4vc3JjL2RhdGEvaXRlbXMudHMiLCIuLi9zcmMvZGF0YS9zcGVsbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbl91dGlscy50cyIsIi4uL3NyYy9zaW11bGF0aW9uLnRzIiwiLi4vc3JjL3dhcnJpb3JfYWkudHMiLCIuLi9zcmMvcnVuX3NpbXVsYXRpb25fd29ya2VyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbInR5cGUgV29ya2VyRXZlbnRMaXN0ZW5lciA9IChkYXRhOiBhbnkpID0+IHZvaWQ7XG5cbmNsYXNzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBldmVudExpc3RlbmVyczogTWFwPHN0cmluZywgV29ya2VyRXZlbnRMaXN0ZW5lcltdPiA9IG5ldyBNYXAoKTtcblxuICAgIGNvbnN0cnVjdG9yKHRhcmdldDogYW55KSB7XG4gICAgICAgIHRhcmdldC5vbm1lc3NhZ2UgPSAoZXY6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMuZ2V0KGV2LmRhdGEuZXZlbnQpIHx8IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgbGlzdGVuZXIgb2YgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyKGV2LmRhdGEuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogV29ya2VyRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBpZiAodGhpcy5ldmVudExpc3RlbmVycy5oYXMoZXZlbnQpKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldmVudCkhLnB1c2gobGlzdGVuZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5zZXQoZXZlbnQsIFtsaXN0ZW5lcl0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudDogc3RyaW5nLCBsaXN0ZW5lclRvUmVtb3ZlOiBXb3JrZXJFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50TGlzdGVuZXJzLmhhcyhldmVudCkpIHtcbiAgICAgICAgICAgIGxldCBldmVudExpc3RlbmVyc0ZvckV2ZW50ID0gdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpO1xuICAgICAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLnNldChldmVudCwgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudC5maWx0ZXIoKGxpc3RlbmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lciAhPT0gbGlzdGVuZXJUb1JlbW92ZTtcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVFdmVudExpc3RlbmVyc0ZvckV2ZW50KGV2ZW50OiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5kZWxldGUoZXZlbnQpO1xuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciwgTWVsZWVIaXRPdXRjb21lIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgV2VhcG9uRGVzY3JpcHRpb24gfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5cbmV4cG9ydCBlbnVtIFNwZWxsRmFtaWx5IHtcbiAgICBOT05FLFxuICAgIFdBUlJJT1IsXG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbCB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHR5cGU6IFNwZWxsVHlwZTtcbiAgICBmYW1pbHk6IFNwZWxsRmFtaWx5O1xuICAgIGlzX2djZDogYm9vbGVhbjtcbiAgICBjb3N0OiBudW1iZXI7XG4gICAgY29vbGRvd246IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgc3BlbGxGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZDtcblxuICAgIGNhblByb2MgPSB0cnVlO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB0eXBlOiBTcGVsbFR5cGUsIGZhbWlseTogU3BlbGxGYW1pbHksIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyLCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuZmFtaWx5ID0gZmFtaWx5O1xuICAgICAgICB0aGlzLmNvc3QgPSBjb3N0O1xuICAgICAgICB0aGlzLmNvb2xkb3duID0gY29vbGRvd247XG4gICAgICAgIHRoaXMuaXNfZ2NkID0gaXNfZ2NkO1xuICAgICAgICB0aGlzLnNwZWxsRiA9IHNwZWxsRjtcbiAgICB9XG5cbiAgICBjYXN0KHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3BlbGxGKHBsYXllciwgdGltZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGVhcm5lZFNwZWxsIHtcbiAgICBzcGVsbDogU3BlbGw7XG4gICAgY29vbGRvd24gPSAwO1xuICAgIGNhc3RlcjogUGxheWVyO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsLCBjYXN0ZXI6IFBsYXllcikge1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7XG4gICAgICAgIHRoaXMuY2FzdGVyID0gY2FzdGVyO1xuICAgIH1cblxuICAgIG9uQ29vbGRvd24odGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvb2xkb3duID4gdGltZTtcbiAgICB9XG5cbiAgICB0aW1lUmVtYWluaW5nKHRpbWU6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgKHRoaXMuY29vbGRvd24gLSB0aW1lKSAvIDEwMDApO1xuICAgIH1cblxuICAgIGNhbkNhc3QodGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmlzX2djZCAmJiB0aGlzLmNhc3Rlci5uZXh0R0NEVGltZSA+IHRpbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmNvc3QgPiB0aGlzLmNhc3Rlci5wb3dlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub25Db29sZG93bih0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgY2FzdCh0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCF0aGlzLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNwZWxsLmlzX2djZCkge1xuICAgICAgICAgICAgdGhpcy5jYXN0ZXIubmV4dEdDRFRpbWUgPSB0aW1lICsgMTUwMCArIHRoaXMuY2FzdGVyLmxhdGVuY3k7IC8vIFRPRE8gLSBuZWVkIHRvIHN0dWR5IHRoZSBlZmZlY3RzIG9mIGxhdGVuY3kgaW4gdGhlIGdhbWUgYW5kIGNvbnNpZGVyIGh1bWFuIHByZWNpc2lvblxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmNhc3Rlci5wb3dlciAtPSB0aGlzLnNwZWxsLmNvc3Q7XG5cbiAgICAgICAgdGhpcy5zcGVsbC5jYXN0KHRoaXMuY2FzdGVyLCB0aW1lKTtcblxuICAgICAgICB0aGlzLmNvb2xkb3duID0gdGltZSArIHRoaXMuc3BlbGwuY29vbGRvd24gKiAxMDAwICsgdGhpcy5jYXN0ZXIubGF0ZW5jeTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2luZ1NwZWxsIGV4dGVuZHMgU3BlbGwge1xuICAgIGJvbnVzRGFtYWdlOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGZhbWlseTogU3BlbGxGYW1pbHksIGJvbnVzRGFtYWdlOiBudW1iZXIsIGNvc3Q6IG51bWJlcikge1xuICAgICAgICBzdXBlcihuYW1lLCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBmYW1pbHksIGZhbHNlLCBjb3N0LCAwLCAoKSA9PiB7fSk7XG4gICAgICAgIHRoaXMuYm9udXNEYW1hZ2UgPSBib251c0RhbWFnZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3dpbmdTcGVsbCBleHRlbmRzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFN3aW5nU3BlbGw7XG4gICAgXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFN3aW5nU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyKHNwZWxsLCBjYXN0ZXIpO1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7IC8vIFRPRE8gLSBpcyB0aGVyZSBhIHdheSB0byBhdm9pZCB0aGlzIGxpbmU/XG4gICAgfVxufVxuXG5leHBvcnQgZW51bSBTcGVsbFR5cGUge1xuICAgIE5PTkUsXG4gICAgQlVGRixcbiAgICBQSFlTSUNBTCxcbiAgICBQSFlTSUNBTF9XRUFQT04sXG59XG5cbmV4cG9ydCB0eXBlIFNwZWxsSGl0T3V0Y29tZUNhbGxiYWNrID0gKHBsYXllcjogUGxheWVyLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsIHtcbiAgICBjYWxsYmFjaz86IFNwZWxsSGl0T3V0Y29tZUNhbGxiYWNrO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlcnwoKHBsYXllcjogUGxheWVyKSA9PiBudW1iZXIpLCB0eXBlOiBTcGVsbFR5cGUsIGZhbWlseTogU3BlbGxGYW1pbHksIGlzX2djZCA9IGZhbHNlLCBjb3N0ID0gMCwgY29vbGRvd24gPSAwLCBjYWxsYmFjaz86IFNwZWxsSGl0T3V0Y29tZUNhbGxiYWNrKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIHR5cGUsIGZhbWlseSwgaXNfZ2NkLCBjb3N0LCBjb29sZG93biwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRtZyA9ICh0eXBlb2YgYW1vdW50ID09PSBcIm51bWJlclwiKSA/IGFtb3VudCA6IGFtb3VudChwbGF5ZXIpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gU3BlbGxUeXBlLlBIWVNJQ0FMIHx8IHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgSXRlbVNwZWxsRGFtYWdlIGV4dGVuZHMgU3BlbGxEYW1hZ2Uge1xuICAgIGNhblByb2MgPSBmYWxzZTsgLy8gVE9ETyAtIGNvbmZpcm0gdGhpcyBpcyBibGl6emxpa2UsIGFsc28gc29tZSBpdGVtIHByb2NzIG1heSBiZSBhYmxlIHRvIHByb2MgYnV0IG9uIExIIGNvcmUsIGZhdGFsIHdvdW5kIGNhbid0XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSkge1xuICAgICAgICBzdXBlcihuYW1lLCBhbW91bnQsIHR5cGUsIFNwZWxsRmFtaWx5Lk5PTkUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikge1xuICAgICAgICAvLyBzcGVsbHR5cGUgZG9lc24ndCBtYXR0ZXJcbiAgICAgICAgc3VwZXIobmFtZSwgU3BlbGxUeXBlLk5PTkUsIFNwZWxsRmFtaWx5Lk5PTkUsIGZhbHNlLCAwLCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGxheWVyLmV4dHJhQXR0YWNrQ291bnQgKz0gY291bnQ7IC8vIExIIGNvZGUgZG9lcyBub3QgYWxsb3cgbXVsdGlwbGUgYXV0byBhdHRhY2tzIHRvIHN0YWNrIGlmIHRoZXkgcHJvYyB0b2dldGhlci4gQmxpenpsaWtlIG1heSBhbGxvdyB0aGVtIHRvIHN0YWNrIFxuICAgICAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYEdhaW5lZCAke2NvdW50fSBleHRyYSBhdHRhY2tzIGZyb20gJHtuYW1lfWApO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbEJ1ZmYgZXh0ZW5kcyBTcGVsbCB7XG4gICAgYnVmZjogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKGJ1ZmY6IEJ1ZmYsIGlzX2djZCA9IGZhbHNlLCBjb3N0ID0gMCwgY29vbGRvd24gPSAwKSB7XG4gICAgICAgIHN1cGVyKGBTcGVsbEJ1ZmYoJHtidWZmLm5hbWV9KWAsIFNwZWxsVHlwZS5CVUZGLCBTcGVsbEZhbWlseS5OT05FLCBpc19nY2QsIGNvc3QsIGNvb2xkb3duLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChidWZmLCB0aW1lKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgfVxufVxuXG50eXBlIHBwbSA9IHtwcG06IG51bWJlcn07XG50eXBlIGNoYW5jZSA9IHtjaGFuY2U6IG51bWJlcn07XG50eXBlIHJhdGUgPSBwcG0gfCBjaGFuY2U7XG5cbmV4cG9ydCBjbGFzcyBQcm9jIHtcbiAgICBwcm90ZWN0ZWQgc3BlbGxzOiBTcGVsbFtdO1xuICAgIHByb3RlY3RlZCByYXRlOiByYXRlO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsIHwgU3BlbGxbXSwgcmF0ZTogcmF0ZSkge1xuICAgICAgICB0aGlzLnNwZWxscyA9IEFycmF5LmlzQXJyYXkoc3BlbGwpID8gc3BlbGwgOiBbc3BlbGxdO1xuICAgICAgICB0aGlzLnJhdGUgPSByYXRlO1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgd2VhcG9uOiBXZWFwb25EZXNjcmlwdGlvbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNoYW5jZSA9ICg8Y2hhbmNlPnRoaXMucmF0ZSkuY2hhbmNlIHx8ICg8cHBtPnRoaXMucmF0ZSkucHBtICogd2VhcG9uLnNwZWVkIC8gNjA7XG5cbiAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPD0gY2hhbmNlKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzcGVsbCBvZiB0aGlzLnNwZWxscykge1xuICAgICAgICAgICAgICAgIHNwZWxsLmNhc3QocGxheWVyLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgUHJvYywgU3BlbGwsIExlYXJuZWRTcGVsbCB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBFbmNoYW50RGVzY3JpcHRpb24gfSBmcm9tIFwiLi9kYXRhL2VuY2hhbnRzLmpzXCI7XG5cbmV4cG9ydCBlbnVtIEl0ZW1TbG90IHtcbiAgICBNQUlOSEFORCA9IDEgPDwgMCxcbiAgICBPRkZIQU5EID0gMSA8PCAxLFxuICAgIFRSSU5LRVQxID0gMSA8PCAyLFxuICAgIFRSSU5LRVQyID0gMSA8PCAzLFxuICAgIEhFQUQgPSAxIDw8IDQsXG4gICAgTkVDSyA9IDEgPDwgNSxcbiAgICBTSE9VTERFUiA9IDEgPDwgNixcbiAgICBCQUNLID0gMSA8PCA3LFxuICAgIENIRVNUID0gMSA8PCA4LFxuICAgIFdSSVNUID0gMSA8PCA5LFxuICAgIEhBTkRTID0gMSA8PCAxMCxcbiAgICBXQUlTVCA9IDEgPDwgMTEsXG4gICAgTEVHUyA9IDEgPDwgMTIsXG4gICAgRkVFVCA9IDEgPDwgMTMsXG4gICAgUklORzEgPSAxIDw8IDE0LFxuICAgIFJJTkcyID0gMSA8PCAxNSxcbiAgICBSQU5HRUQgPSAxIDw8IDE2LFxufVxuXG5leHBvcnQgY29uc3QgaXRlbVNsb3RIYXNFbmNoYW50OiB7W1RLZXkgaW4gSXRlbVNsb3RdOiBib29sZWFufSA9IHtcbiAgICBbSXRlbVNsb3QuTUFJTkhBTkRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5PRkZIQU5EXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuVFJJTktFVDFdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuVFJJTktFVDJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuSEVBRF06IHRydWUsXG4gICAgW0l0ZW1TbG90Lk5FQ0tdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuU0hPVUxERVJdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5CQUNLXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuQ0hFU1RdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5XUklTVF06IHRydWUsXG4gICAgW0l0ZW1TbG90LkhBTkRTXTogdHJ1ZSxcbiAgICBbSXRlbVNsb3QuV0FJU1RdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuTEVHU106IHRydWUsXG4gICAgW0l0ZW1TbG90LkZFRVRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5SSU5HMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SSU5HMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5SQU5HRURdOiBmYWxzZSxcbn07XG5cbmV4cG9ydCBjb25zdCBpdGVtU2xvdEhhc1RlbXBvcmFyeUVuY2hhbnQ6IHtbVEtleSBpbiBJdGVtU2xvdF06IGJvb2xlYW59ID0ge1xuICAgIFtJdGVtU2xvdC5NQUlOSEFORF06IHRydWUsXG4gICAgW0l0ZW1TbG90Lk9GRkhBTkRdOiB0cnVlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMV06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5UUklOS0VUMl06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5IRUFEXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90Lk5FQ0tdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuU0hPVUxERVJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuQkFDS106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5DSEVTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5XUklTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5IQU5EU106IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5XQUlTVF06IGZhbHNlLFxuICAgIFtJdGVtU2xvdC5MRUdTXTogZmFsc2UsXG4gICAgW0l0ZW1TbG90LkZFRVRdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUklORzFdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUklORzJdOiBmYWxzZSxcbiAgICBbSXRlbVNsb3QuUkFOR0VEXTogZmFsc2UsXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIEl0ZW1EZXNjcmlwdGlvbiB7XG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHNsb3Q6IEl0ZW1TbG90LFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbiAgICBvbnVzZT86IFNwZWxsLFxuICAgIG9uZXF1aXA/OiBQcm9jLFxufVxuXG5leHBvcnQgZW51bSBXZWFwb25UeXBlIHtcbiAgICBNQUNFLFxuICAgIFNXT1JELFxuICAgIEFYRSxcbiAgICBEQUdHRVIsXG4gICAgTUFDRTJILFxuICAgIFNXT1JEMkgsXG4gICAgQVhFMkgsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2VhcG9uRGVzY3JpcHRpb24gZXh0ZW5kcyBJdGVtRGVzY3JpcHRpb24ge1xuICAgIHR5cGU6IFdlYXBvblR5cGUsXG4gICAgbWluOiBudW1iZXIsXG4gICAgbWF4OiBudW1iZXIsXG4gICAgc3BlZWQ6IG51bWJlcixcbiAgICBvbmhpdD86IFByb2MsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1dlYXBvbihpdGVtOiBJdGVtRGVzY3JpcHRpb24pOiBpdGVtIGlzIFdlYXBvbkRlc2NyaXB0aW9uIHtcbiAgICByZXR1cm4gXCJzcGVlZFwiIGluIGl0ZW07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VxdWlwZWRXZWFwb24oaXRlbTogSXRlbUVxdWlwZWQpOiBpdGVtIGlzIFdlYXBvbkVxdWlwZWQge1xuICAgIHJldHVybiBcIndlYXBvblwiIGluIGl0ZW07XG59XG5cbmV4cG9ydCBjbGFzcyBJdGVtRXF1aXBlZCB7XG4gICAgaXRlbTogSXRlbURlc2NyaXB0aW9uO1xuICAgIG9udXNlPzogTGVhcm5lZFNwZWxsO1xuXG4gICAgY29uc3RydWN0b3IoaXRlbTogSXRlbURlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICB0aGlzLml0ZW0gPSBpdGVtO1xuXG4gICAgICAgIGlmIChpdGVtLm9udXNlKSB7XG4gICAgICAgICAgICB0aGlzLm9udXNlID0gbmV3IExlYXJuZWRTcGVsbChpdGVtLm9udXNlLCBwbGF5ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0ub25lcXVpcCkgeyAvLyBUT0RPLCBtb3ZlIHRoaXMgdG8gYnVmZnByb2M/IHRoaXMgbWF5IGJlIHNpbXBsZXIgdGhvdWdoIHNpbmNlIHdlIGtub3cgdGhlIGJ1ZmYgd29uJ3QgYmUgcmVtb3ZlZFxuICAgICAgICAgICAgcGxheWVyLmFkZFByb2MoaXRlbS5vbmVxdWlwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVzZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMub251c2UpIHtcbiAgICAgICAgICAgIHRoaXMub251c2UuY2FzdCh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdlYXBvbkVxdWlwZWQgZXh0ZW5kcyBJdGVtRXF1aXBlZCB7XG4gICAgd2VhcG9uOiBXZWFwb25EZXNjcmlwdGlvbjtcbiAgICBuZXh0U3dpbmdUaW1lOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHByb2NzOiBQcm9jW10gPSBbXTtcbiAgICBwcm90ZWN0ZWQgcGxheWVyOiBQbGF5ZXI7XG4gICAgcHVibGljIHRlbXBvcmFyeUVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb247XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBXZWFwb25EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIsIGVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb24sIHRlbXBvcmFyeUVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb24pIHtcbiAgICAgICAgc3VwZXIoaXRlbSwgcGxheWVyKTtcbiAgICAgICAgdGhpcy53ZWFwb24gPSBpdGVtO1xuICAgICAgICBcbiAgICAgICAgaWYgKGl0ZW0ub25oaXQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkUHJvYyhpdGVtLm9uaGl0KVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuY2hhbnQgJiYgZW5jaGFudC5wcm9jKSB7XG4gICAgICAgICAgICB0aGlzLmFkZFByb2MoZW5jaGFudC5wcm9jKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnQgPSB0ZW1wb3JhcnlFbmNoYW50O1xuXG4gICAgICAgIHRoaXMubmV4dFN3aW5nVGltZSA9IDEwMDsgLy8gVE9ETyAtIG5lZWQgdG8gcmVzZXQgdGhpcyBwcm9wZXJseSBpZiBldmVyIHdhbnQgdG8gc2ltdWxhdGUgZmlnaHRzIHdoZXJlIHlvdSBydW4gb3V0XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXQgcGx1c0RhbWFnZSgpIHtcbiAgICAgICAgaWYgKHRoaXMudGVtcG9yYXJ5RW5jaGFudCAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLnBsdXNEYW1hZ2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMucGx1c0RhbWFnZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWluKCkge1xuICAgICAgICByZXR1cm4gdGhpcy53ZWFwb24ubWluICsgdGhpcy5wbHVzRGFtYWdlO1xuICAgIH1cblxuICAgIGdldCBtYXgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5tYXggKyB0aGlzLnBsdXNEYW1hZ2U7XG4gICAgfVxuXG4gICAgYWRkUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIHRoaXMucHJvY3MucHVzaChwKTtcbiAgICB9XG5cbiAgICBwcm9jKHRpbWU6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCBwcm9jIG9mIHRoaXMucHJvY3MpIHtcbiAgICAgICAgICAgIHByb2MucnVuKHRoaXMucGxheWVyLCB0aGlzLndlYXBvbiwgdGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3aW5kZnVyeSBwcm9jcyBsYXN0XG4gICAgICAgIGlmICh0aGlzLnRlbXBvcmFyeUVuY2hhbnQgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnByb2MpIHtcbiAgICAgICAgICAgIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5wcm9jLnJ1bih0aGlzLnBsYXllciwgdGhpcy53ZWFwb24sIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHVyYW5kKG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICAgIHJldHVybiBtaW4gKyBNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmcmFuZChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbWluICsgTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhbXAodmFsOiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICAgIHJldHVybiBNYXRoLm1pbihtYXgsIE1hdGgubWF4KG1pbiwgdmFsKSk7XG59XG5cbmNvbnN0IERFQlVHR0lORyA9IGZhbHNlO1xuXG5pZiAoREVCVUdHSU5HKSB7XG4gICAgLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vbWF0aGlhc2J5bmVucy81NjcwOTE3I2ZpbGUtZGV0ZXJtaW5pc3RpYy1tYXRoLXJhbmRvbS1qc1xuICAgIE1hdGgucmFuZG9tID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc2VlZCA9IDB4MkY2RTJCMTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgLy8gUm9iZXJ0IEplbmtpbnPigJkgMzIgYml0IGludGVnZXIgaGFzaCBmdW5jdGlvblxuICAgICAgICAgICAgc2VlZCA9ICgoc2VlZCArIDB4N0VENTVEMTYpICsgKHNlZWQgPDwgMTIpKSAgJiAweEZGRkZGRkZGO1xuICAgICAgICAgICAgc2VlZCA9ICgoc2VlZCBeIDB4Qzc2MUMyM0MpIF4gKHNlZWQgPj4+IDE5KSkgJiAweEZGRkZGRkZGO1xuICAgICAgICAgICAgc2VlZCA9ICgoc2VlZCArIDB4MTY1NjY3QjEpICsgKHNlZWQgPDwgNSkpICAgJiAweEZGRkZGRkZGO1xuICAgICAgICAgICAgc2VlZCA9ICgoc2VlZCArIDB4RDNBMjY0NkMpIF4gKHNlZWQgPDwgOSkpICAgJiAweEZGRkZGRkZGO1xuICAgICAgICAgICAgc2VlZCA9ICgoc2VlZCArIDB4RkQ3MDQ2QzUpICsgKHNlZWQgPDwgMykpICAgJiAweEZGRkZGRkZGO1xuICAgICAgICAgICAgc2VlZCA9ICgoc2VlZCBeIDB4QjU1QTRGMDkpIF4gKHNlZWQgPj4+IDE2KSkgJiAweEZGRkZGRkZGO1xuICAgICAgICAgICAgcmV0dXJuIChzZWVkICYgMHhGRkZGRkZGKSAvIDB4MTAwMDAwMDA7XG4gICAgICAgIH07XG4gICAgfSgpKTtcbn1cbiIsImltcG9ydCB7IGNsYW1wIH0gZnJvbSBcIi4vbWF0aC5qc1wiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBVbml0IHtcbiAgICBsZXZlbDogbnVtYmVyO1xuICAgIGFybW9yOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihsZXZlbDogbnVtYmVyLCBhcm1vcjogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMubGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgdGhpcy5hcm1vciA9IGFybW9yO1xuICAgIH1cblxuICAgIGdldCBtYXhTa2lsbEZvckxldmVsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sZXZlbCAqIDU7XG4gICAgfVxuXG4gICAgZ2V0IGRlZmVuc2VTa2lsbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbDtcbiAgICB9XG5cbiAgICBnZXQgZG9kZ2VDaGFuY2UoKSB7XG4gICAgICAgIHJldHVybiA1O1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUFybW9yUmVkdWNlZERhbWFnZShkYW1hZ2U6IG51bWJlciwgYXR0YWNrZXI6IFBsYXllcikge1xuICAgICAgICBjb25zdCBhcm1vciA9IE1hdGgubWF4KDAsIHRoaXMuYXJtb3IgLSBhdHRhY2tlci5idWZmTWFuYWdlci5zdGF0cy5hcm1vclBlbmV0cmF0aW9uKTtcbiAgICAgICAgXG4gICAgICAgIGxldCB0bXB2YWx1ZSA9IDAuMSAqIGFybW9yICAvICgoOC41ICogYXR0YWNrZXIubGV2ZWwpICsgNDApO1xuICAgICAgICB0bXB2YWx1ZSAvPSAoMSArIHRtcHZhbHVlKTtcblxuICAgICAgICBjb25zdCBhcm1vck1vZGlmaWVyID0gY2xhbXAodG1wdmFsdWUsIDAsIDAuNzUpO1xuXG4gICAgICAgIHJldHVybiBNYXRoLm1heCgxLCBkYW1hZ2UgLSAoZGFtYWdlICogYXJtb3JNb2RpZmllcikpO1xuICAgIH1cbn1cbiIsImV4cG9ydCBpbnRlcmZhY2UgU3RhdFZhbHVlcyB7XG4gICAgYXA/OiBudW1iZXI7XG4gICAgc3RyPzogbnVtYmVyO1xuICAgIGFnaT86IG51bWJlcjtcbiAgICBoaXQ/OiBudW1iZXI7XG4gICAgY3JpdD86IG51bWJlcjtcbiAgICBoYXN0ZT86IG51bWJlcjtcbiAgICBzdGF0TXVsdD86IG51bWJlcjtcbiAgICBkYW1hZ2VNdWx0PzogbnVtYmVyO1xuICAgIGFybW9yUGVuZXRyYXRpb24/OiBudW1iZXI7XG4gICAgcGx1c0RhbWFnZT86IG51bWJlcjtcblxuICAgIHN3b3JkU2tpbGw/OiBudW1iZXI7XG4gICAgYXhlU2tpbGw/OiBudW1iZXI7XG4gICAgbWFjZVNraWxsPzogbnVtYmVyO1xuICAgIGRhZ2dlclNraWxsPzogbnVtYmVyO1xuICAgIHN3b3JkMkhTa2lsbD86IG51bWJlcjtcbiAgICBheGUySFNraWxsPzogbnVtYmVyO1xuICAgIG1hY2UySFNraWxsPzogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgU3RhdHMgaW1wbGVtZW50cyBTdGF0VmFsdWVzIHtcbiAgICBhcCE6IG51bWJlcjtcbiAgICBzdHIhOiBudW1iZXI7XG4gICAgYWdpITogbnVtYmVyO1xuICAgIGhpdCE6IG51bWJlcjtcbiAgICBjcml0ITogbnVtYmVyO1xuICAgIGhhc3RlITogbnVtYmVyO1xuICAgIHN0YXRNdWx0ITogbnVtYmVyO1xuICAgIGRhbWFnZU11bHQhOiBudW1iZXI7XG4gICAgYXJtb3JQZW5ldHJhdGlvbiE6IG51bWJlcjtcbiAgICBwbHVzRGFtYWdlITogbnVtYmVyO1xuXG4gICAgc3dvcmRTa2lsbCE6IG51bWJlcjtcbiAgICBheGVTa2lsbCE6IG51bWJlcjtcbiAgICBtYWNlU2tpbGwhOiBudW1iZXI7XG4gICAgZGFnZ2VyU2tpbGwhOiBudW1iZXI7XG4gICAgc3dvcmQySFNraWxsITogbnVtYmVyO1xuICAgIGF4ZTJIU2tpbGwhOiBudW1iZXI7XG4gICAgbWFjZTJIU2tpbGwhOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzPzogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLnNldChzKTtcbiAgICB9XG5cbiAgICBzZXQocz86IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5hcCA9IChzICYmIHMuYXApIHx8IDA7XG4gICAgICAgIHRoaXMuc3RyID0gKHMgJiYgcy5zdHIpIHx8IDA7XG4gICAgICAgIHRoaXMuYWdpID0gKHMgJiYgcy5hZ2kpIHx8IDA7XG4gICAgICAgIHRoaXMuaGl0ID0gKHMgJiYgcy5oaXQpIHx8IDA7XG4gICAgICAgIHRoaXMuY3JpdCA9IChzICYmIHMuY3JpdCkgfHwgMDtcbiAgICAgICAgdGhpcy5oYXN0ZSA9IChzICYmIHMuaGFzdGUpIHx8IDE7XG4gICAgICAgIHRoaXMuc3RhdE11bHQgPSAocyAmJiBzLnN0YXRNdWx0KSB8fCAxO1xuICAgICAgICB0aGlzLmRhbWFnZU11bHQgPSAocyAmJiBzLmRhbWFnZU11bHQpIHx8IDE7XG4gICAgICAgIHRoaXMuYXJtb3JQZW5ldHJhdGlvbiA9IChzICYmIHMuYXJtb3JQZW5ldHJhdGlvbikgfHwgMDtcbiAgICAgICAgdGhpcy5wbHVzRGFtYWdlID0gKHMgJiYgcy5wbHVzRGFtYWdlKSB8fCAwO1xuXG4gICAgICAgIHRoaXMuc3dvcmRTa2lsbCA9IChzICYmIHMuc3dvcmRTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5heGVTa2lsbCA9IChzICYmIHMuYXhlU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMubWFjZVNraWxsID0gKHMgJiYgcy5tYWNlU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuZGFnZ2VyU2tpbGwgPSAocyAmJiBzLmRhZ2dlclNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLnN3b3JkMkhTa2lsbCA9IChzICYmIHMuc3dvcmQySFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmF4ZTJIU2tpbGwgPSAocyAmJiBzLmF4ZTJIU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMubWFjZTJIU2tpbGwgPSAocyAmJiBzLm1hY2UySFNraWxsKSB8fCAwO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGFkZChzOiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuYXAgKz0gKHMuYXAgfHwgMCk7XG4gICAgICAgIHRoaXMuc3RyICs9IChzLnN0ciB8fCAwKTtcbiAgICAgICAgdGhpcy5hZ2kgKz0gKHMuYWdpIHx8IDApO1xuICAgICAgICB0aGlzLmhpdCArPSAocy5oaXQgfHwgMCk7XG4gICAgICAgIHRoaXMuY3JpdCArPSAocy5jcml0IHx8IDApO1xuICAgICAgICB0aGlzLmhhc3RlICo9IChzLmhhc3RlIHx8IDEpO1xuICAgICAgICB0aGlzLnN0YXRNdWx0ICo9IChzLnN0YXRNdWx0IHx8IDEpO1xuICAgICAgICB0aGlzLmRhbWFnZU11bHQgKj0gKHMuZGFtYWdlTXVsdCB8fCAxKTtcbiAgICAgICAgdGhpcy5hcm1vclBlbmV0cmF0aW9uICs9IChzLmFybW9yUGVuZXRyYXRpb24gfHwgMCk7XG4gICAgICAgIHRoaXMucGx1c0RhbWFnZSArPSAocy5wbHVzRGFtYWdlIHx8IDApO1xuXG4gICAgICAgIHRoaXMuc3dvcmRTa2lsbCArPSAocy5zd29yZFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmF4ZVNraWxsICs9IChzLmF4ZVNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLm1hY2VTa2lsbCArPSAocy5tYWNlU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuZGFnZ2VyU2tpbGwgKz0gKHMuZGFnZ2VyU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuc3dvcmQySFNraWxsICs9IChzLnN3b3JkMkhTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5heGUySFNraWxsICs9IChzLmF4ZTJIU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMubWFjZTJIU2tpbGwgKz0gKHMubWFjZTJIU2tpbGwgfHwgMCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RhdHMsIFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBQcm9jIH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcblxuZXhwb3J0IGNsYXNzIEJ1ZmZNYW5hZ2VyIHtcbiAgICBwbGF5ZXI6IFBsYXllcjtcblxuICAgIHByaXZhdGUgYnVmZkxpc3Q6IEJ1ZmZBcHBsaWNhdGlvbltdID0gW107XG4gICAgcHJpdmF0ZSBidWZmT3ZlclRpbWVMaXN0OiBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbltdID0gW107XG5cbiAgICBiYXNlU3RhdHM6IFN0YXRzO1xuICAgIHN0YXRzOiBTdGF0cztcblxuICAgIGNvbnN0cnVjdG9yKHBsYXllcjogUGxheWVyLCBiYXNlU3RhdHM6IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMuYmFzZVN0YXRzID0gbmV3IFN0YXRzKGJhc2VTdGF0cyk7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBuZXcgU3RhdHModGhpcy5iYXNlU3RhdHMpO1xuICAgIH1cblxuICAgIGdldCBuZXh0T3ZlclRpbWVVcGRhdGUoKSB7XG4gICAgICAgIGxldCByZXMgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcblxuICAgICAgICBmb3IgKGxldCBidWZmT1RBcHAgb2YgdGhpcy5idWZmT3ZlclRpbWVMaXN0KSB7XG4gICAgICAgICAgICByZXMgPSBNYXRoLm1pbihyZXMsIGJ1ZmZPVEFwcC5uZXh0VXBkYXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICAvLyBwcm9jZXNzIGxhc3QgdGljayBiZWZvcmUgaXQgaXMgcmVtb3ZlZFxuICAgICAgICBmb3IgKGxldCBidWZmT1RBcHAgb2YgdGhpcy5idWZmT3ZlclRpbWVMaXN0KSB7XG4gICAgICAgICAgICBidWZmT1RBcHAudXBkYXRlKHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZW1vdmVFeHBpcmVkQnVmZnModGltZSk7XG5cbiAgICAgICAgdGhpcy5zdGF0cy5zZXQodGhpcy5iYXNlU3RhdHMpO1xuXG4gICAgICAgIGZvciAobGV0IHsgYnVmZiwgc3RhY2tzIH0gb2YgdGhpcy5idWZmTGlzdCkge1xuICAgICAgICAgICAgc3RhY2tzID0gYnVmZi5zdGF0c1N0YWNrID8gc3RhY2tzIDogMTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2tzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBidWZmLmFwcGx5KHRoaXMuc3RhdHMsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IHsgYnVmZiwgc3RhY2tzIH0gb2YgdGhpcy5idWZmT3ZlclRpbWVMaXN0KSB7XG4gICAgICAgICAgICBzdGFja3MgPSBidWZmLnN0YXRzU3RhY2sgPyBzdGFja3MgOiAxO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFja3M7IGkrKykge1xuICAgICAgICAgICAgICAgIGJ1ZmYuYXBwbHkodGhpcy5zdGF0cywgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkKGJ1ZmY6IEJ1ZmYsIGFwcGx5VGltZTogbnVtYmVyKSB7XG4gICAgICAgIGZvciAobGV0IGJ1ZmZBcHAgb2YgdGhpcy5idWZmTGlzdCkge1xuICAgICAgICAgICAgaWYgKGJ1ZmZBcHAuYnVmZiA9PT0gYnVmZikge1xuICAgICAgICAgICAgICAgIGlmIChidWZmLnN0YWNrcykgeyAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2dTdGFja0luY3JlYXNlID0gdGhpcy5wbGF5ZXIubG9nICYmICghYnVmZi5tYXhTdGFja3MgfHwgYnVmZkFwcC5zdGFja3MgPCBidWZmLm1heFN0YWNrcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGJ1ZmYuaW5pdGlhbFN0YWNrcykgeyAvLyBUT0RPIC0gY2hhbmdlIHRoaXMgdG8gY2hhcmdlcz9cbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAucmVmcmVzaChhcHBseVRpbWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5zdGFja3MrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2dTdGFja0luY3JlYXNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsYXllci5sb2chKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSByZWZyZXNoZWQgKCR7YnVmZkFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSByZWZyZXNoZWRgKTtcbiAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyhhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gZ2FpbmVkYCArIChidWZmLnN0YWNrcyA/IGAgKCR7YnVmZi5pbml0aWFsU3RhY2tzIHx8IDF9KWAgOiAnJykpO1xuXG4gICAgICAgIGlmIChidWZmIGluc3RhbmNlb2YgQnVmZk92ZXJUaW1lKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QucHVzaChuZXcgQnVmZk92ZXJUaW1lQXBwbGljYXRpb24odGhpcy5wbGF5ZXIsIGJ1ZmYsIGFwcGx5VGltZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5idWZmTGlzdC5wdXNoKG5ldyBCdWZmQXBwbGljYXRpb24oYnVmZiwgYXBwbHlUaW1lKSk7XG4gICAgICAgIH1cbiAgICAgICAgYnVmZi5hZGQoYXBwbHlUaW1lLCB0aGlzLnBsYXllcik7XG4gICAgfVxuXG4gICAgcmVtb3ZlKGJ1ZmY6IEJ1ZmYsIHRpbWU6IG51bWJlciwgZnVsbCA9IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuYnVmZkxpc3QgPSB0aGlzLmJ1ZmZMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuYnVmZiA9PT0gYnVmZikge1xuICAgICAgICAgICAgICAgIGlmICghZnVsbCAmJiBidWZmLnN0YWNrcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmYXBwLnN0YWNrcyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSAoJHtidWZmYXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmYXBwLnN0YWNrcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gbG9zdGApO1xuICAgICAgICAgICAgICAgIGJ1ZmZhcHAuYnVmZi5yZW1vdmUodGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QgPSB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmYuc3RhY2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZhcHAuc3RhY2tzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9ICgke2J1ZmZhcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuc3RhY2tzID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBsb3N0YCk7XG4gICAgICAgICAgICAgICAgYnVmZmFwcC5idWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJlbW92ZUV4cGlyZWRCdWZmcyh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgcmVtb3ZlZEJ1ZmZzOiBCdWZmW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuYnVmZkxpc3QgPSB0aGlzLmJ1ZmZMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuZXhwaXJhdGlvblRpbWUgPD0gdGltZSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRCdWZmcy5wdXNoKGJ1ZmZhcHAuYnVmZik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCA9IHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmV4cGlyYXRpb25UaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVkQnVmZnMucHVzaChidWZmYXBwLmJ1ZmYpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKGxldCBidWZmIG9mIHJlbW92ZWRCdWZmcykge1xuICAgICAgICAgICAgYnVmZi5yZW1vdmUodGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gZXhwaXJlZGApO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZiB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHN0YXRzPzogU3RhdFZhbHVlc3x1bmRlZmluZWQ7XG4gICAgc3RhY2tzOiBib29sZWFuO1xuICAgIGR1cmF0aW9uOiBudW1iZXI7XG4gICAgaW5pdGlhbFN0YWNrcz86IG51bWJlcjtcbiAgICBtYXhTdGFja3M/OiBudW1iZXI7XG4gICAgc3RhdHNTdGFjazogYm9vbGVhbjsgLy8gZG8geW91IGFkZCB0aGUgc3RhdCBib251cyBmb3IgZWFjaCBzdGFjaz8gb3IgaXMgaXQgbGlrZSBmbHVycnkgd2hlcmUgdGhlIHN0YWNrIGlzIG9ubHkgdG8gY291bnQgY2hhcmdlc1xuXG4gICAgcHJpdmF0ZSBjaGlsZD86IEJ1ZmY7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHN0YXRzPzogU3RhdFZhbHVlcywgc3RhY2tzPzogYm9vbGVhbiwgaW5pdGlhbFN0YWNrcz86IG51bWJlciwgbWF4U3RhY2tzPzogbnVtYmVyLCBjaGlsZD86IEJ1ZmYsIHN0YXRzU3RhY2sgPSB0cnVlKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICAgICAgdGhpcy5zdGF0cyA9IHN0YXRzO1xuICAgICAgICB0aGlzLnN0YWNrcyA9ICEhc3RhY2tzO1xuICAgICAgICB0aGlzLmluaXRpYWxTdGFja3MgPSBpbml0aWFsU3RhY2tzO1xuICAgICAgICB0aGlzLm1heFN0YWNrcyA9IG1heFN0YWNrcztcbiAgICAgICAgdGhpcy5jaGlsZCA9IGNoaWxkO1xuICAgICAgICB0aGlzLnN0YXRzU3RhY2sgPSBzdGF0c1N0YWNrO1xuICAgIH1cblxuICAgIGFwcGx5KHN0YXRzOiBTdGF0cywgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuc3RhdHMpIHtcbiAgICAgICAgICAgIHN0YXRzLmFkZCh0aGlzLnN0YXRzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZCh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7fVxuXG4gICAgcmVtb3ZlKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuY2hpbGQpIHtcbiAgICAgICAgICAgIHBsYXllci5idWZmTWFuYWdlci5yZW1vdmUodGhpcy5jaGlsZCwgdGltZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIEJ1ZmZBcHBsaWNhdGlvbiB7XG4gICAgYnVmZjogQnVmZjtcbiAgICBleHBpcmF0aW9uVGltZSE6IG51bWJlcjtcblxuICAgIHN0YWNrc1ZhbCE6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGJ1ZmY6IEJ1ZmYsIGFwcGx5VGltZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgICAgIHRoaXMucmVmcmVzaChhcHBseVRpbWUpO1xuICAgIH1cblxuICAgIHJlZnJlc2godGltZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc3RhY2tzID0gdGhpcy5idWZmLmluaXRpYWxTdGFja3MgfHwgMTtcblxuICAgICAgICB0aGlzLmV4cGlyYXRpb25UaW1lID0gdGltZSArIHRoaXMuYnVmZi5kdXJhdGlvbiAqIDEwMDA7XG5cbiAgICAgICAgaWYgKHRoaXMuYnVmZi5kdXJhdGlvbiA+IDYwKSB7XG4gICAgICAgICAgICB0aGlzLmV4cGlyYXRpb25UaW1lID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3RhY2tzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdGFja3NWYWw7XG4gICAgfVxuXG4gICAgc2V0IHN0YWNrcyhzdGFja3M6IG51bWJlcikge1xuICAgICAgICB0aGlzLnN0YWNrc1ZhbCA9IHRoaXMuYnVmZi5tYXhTdGFja3MgPyBNYXRoLm1pbih0aGlzLmJ1ZmYubWF4U3RhY2tzLCBzdGFja3MpIDogc3RhY2tzO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmZPdmVyVGltZSBleHRlbmRzIEJ1ZmYge1xuICAgIHVwZGF0ZUY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkO1xuICAgIHVwZGF0ZUludGVydmFsOiBudW1iZXJcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgc3RhdHM6IFN0YXRWYWx1ZXN8dW5kZWZpbmVkLCB1cGRhdGVJbnRlcnZhbDogbnVtYmVyLCB1cGRhdGVGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZCkge1xuICAgICAgICBzdXBlcihuYW1lLCBkdXJhdGlvbiwgc3RhdHMpO1xuICAgICAgICB0aGlzLnVwZGF0ZUYgPSB1cGRhdGVGO1xuICAgICAgICB0aGlzLnVwZGF0ZUludGVydmFsID0gdXBkYXRlSW50ZXJ2YWw7XG4gICAgfVxufVxuXG5jbGFzcyBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbiBleHRlbmRzIEJ1ZmZBcHBsaWNhdGlvbiB7XG4gICAgYnVmZjogQnVmZk92ZXJUaW1lO1xuICAgIG5leHRVcGRhdGUhOiBudW1iZXI7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihwbGF5ZXI6IFBsYXllciwgYnVmZjogQnVmZk92ZXJUaW1lLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICBzdXBlcihidWZmLCBhcHBseVRpbWUpO1xuICAgICAgICB0aGlzLmJ1ZmYgPSBidWZmO1xuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcbiAgICAgICAgdGhpcy5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgfVxuXG4gICAgcmVmcmVzaCh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIucmVmcmVzaCh0aW1lKTtcbiAgICAgICAgdGhpcy5uZXh0VXBkYXRlID0gdGltZSArIHRoaXMuYnVmZi51cGRhdGVJbnRlcnZhbDtcbiAgICB9XG5cbiAgICB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aW1lID49IHRoaXMubmV4dFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5uZXh0VXBkYXRlICs9IHRoaXMuYnVmZi51cGRhdGVJbnRlcnZhbDtcbiAgICAgICAgICAgIHRoaXMuYnVmZi51cGRhdGVGKHRoaXMucGxheWVyLCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmZQcm9jIGV4dGVuZHMgQnVmZiB7XG4gICAgcHJvYzogUHJvYztcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgcHJvYzogUHJvYywgY2hpbGQ/OiBCdWZmKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGR1cmF0aW9uLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGNoaWxkKTtcbiAgICAgICAgdGhpcy5wcm9jID0gcHJvYztcbiAgICB9XG5cbiAgICBhZGQodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlci5hZGQodGltZSwgcGxheWVyKTtcbiAgICAgICAgcGxheWVyLmFkZFByb2ModGhpcy5wcm9jKTtcbiAgICB9XG5cbiAgICByZW1vdmUodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlci5yZW1vdmUodGltZSwgcGxheWVyKTtcbiAgICAgICAgcGxheWVyLnJlbW92ZVByb2ModGhpcy5wcm9jKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBXZWFwb25FcXVpcGVkLCBXZWFwb25UeXBlLCBJdGVtRGVzY3JpcHRpb24sIEl0ZW1FcXVpcGVkLCBJdGVtU2xvdCwgaXNFcXVpcGVkV2VhcG9uLCBpc1dlYXBvbiB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyB1cmFuZCwgY2xhbXAsIGZyYW5kIH0gZnJvbSBcIi4vbWF0aC5qc1wiO1xuaW1wb3J0IHsgQnVmZk1hbmFnZXIgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBTcGVsbCwgUHJvYywgTGVhcm5lZFN3aW5nU3BlbGwsIFNwZWxsVHlwZSwgU3BlbGxEYW1hZ2UgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgTEhfQ09SRV9CVUcgfSBmcm9tIFwiLi9zaW1fc2V0dGluZ3MuanNcIjtcbmltcG9ydCB7IEVuY2hhbnREZXNjcmlwdGlvbiB9IGZyb20gXCIuL2RhdGEvZW5jaGFudHMuanNcIjtcblxuZXhwb3J0IGVudW0gUmFjZSB7XG4gICAgSFVNQU4sXG4gICAgT1JDLFxufVxuXG5leHBvcnQgZW51bSBNZWxlZUhpdE91dGNvbWUge1xuICAgIE1FTEVFX0hJVF9FVkFERSxcbiAgICBNRUxFRV9ISVRfTUlTUyxcbiAgICBNRUxFRV9ISVRfRE9ER0UsXG4gICAgTUVMRUVfSElUX0JMT0NLLFxuICAgIE1FTEVFX0hJVF9QQVJSWSxcbiAgICBNRUxFRV9ISVRfR0xBTkNJTkcsXG4gICAgTUVMRUVfSElUX0NSSVQsXG4gICAgTUVMRUVfSElUX0NSVVNISU5HLFxuICAgIE1FTEVFX0hJVF9OT1JNQUwsXG4gICAgTUVMRUVfSElUX0JMT0NLX0NSSVQsXG59XG5cbnR5cGUgSGl0T3V0Q29tZVN0cmluZ01hcCA9IHtbVEtleSBpbiBNZWxlZUhpdE91dGNvbWVdOiBzdHJpbmd9O1xuXG5leHBvcnQgY29uc3QgaGl0T3V0Y29tZVN0cmluZzogSGl0T3V0Q29tZVN0cmluZ01hcCA9IHtcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9FVkFERV06ICdldmFkZScsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTU106ICdtaXNzZXMnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXTogJ2lzIGRvZGdlZCcsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tdOiAnaXMgYmxvY2tlZCcsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlldOiAnaXMgcGFycmllZCcsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfR0xBTkNJTkddOiAnZ2xhbmNlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVF06ICdjcml0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JVU0hJTkddOiAnY3J1c2hlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMXTogJ2hpdHMnLFxuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0JMT0NLX0NSSVRdOiAnaXMgYmxvY2sgY3JpdCcsXG59O1xuXG5jb25zdCBza2lsbERpZmZUb1JlZHVjdGlvbiA9IFsxLCAwLjk5MjYsIDAuOTg0MCwgMC45NzQyLCAwLjk2MjksIDAuOTUwMCwgMC45MzUxLCAwLjkxODAsIDAuODk4NCwgMC44NzU5LCAwLjg1MDAsIDAuODIwMywgMC43ODYwLCAwLjc0NjksIDAuNzAxOF07XG5cbmV4cG9ydCB0eXBlIExvZ0Z1bmN0aW9uID0gKHRpbWU6IG51bWJlciwgdGV4dDogc3RyaW5nKSA9PiB2b2lkO1xuXG5leHBvcnQgdHlwZSBEYW1hZ2VMb2cgPSBbbnVtYmVyLCBudW1iZXJdW107XG5cbmV4cG9ydCBjbGFzcyBQbGF5ZXIgZXh0ZW5kcyBVbml0IHtcbiAgICBpdGVtczogTWFwPEl0ZW1TbG90LCBJdGVtRXF1aXBlZD4gPSBuZXcgTWFwKCk7XG4gICAgcHJvY3M6IFByb2NbXSA9IFtdO1xuXG4gICAgdGFyZ2V0OiBVbml0IHwgdW5kZWZpbmVkO1xuXG4gICAgbmV4dEdDRFRpbWUgPSAwO1xuICAgIGV4dHJhQXR0YWNrQ291bnQgPSAwO1xuICAgIGRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG5cbiAgICBidWZmTWFuYWdlcjogQnVmZk1hbmFnZXI7XG5cbiAgICBkYW1hZ2VMb2c6IERhbWFnZUxvZyA9IFtdO1xuXG4gICAgcXVldWVkU3BlbGw6IExlYXJuZWRTd2luZ1NwZWxsfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAgIGxvZz86IExvZ0Z1bmN0aW9uO1xuXG4gICAgbGF0ZW5jeSA9IDUwOyAvLyBtc1xuXG4gICAgcG93ZXJMb3N0ID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRzOiBTdGF0VmFsdWVzLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICBzdXBlcig2MCwgMCk7IC8vIGx2bCwgYXJtb3JcblxuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyID0gbmV3IEJ1ZmZNYW5hZ2VyKHRoaXMsIG5ldyBTdGF0cyhzdGF0cykpO1xuICAgICAgICB0aGlzLmxvZyA9IGxvZztcbiAgICB9XG5cbiAgICBnZXQgbWgoKTogV2VhcG9uRXF1aXBlZHx1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBlcXVpcGVkID0gdGhpcy5pdGVtcy5nZXQoSXRlbVNsb3QuTUFJTkhBTkQpO1xuXG4gICAgICAgIGlmIChlcXVpcGVkICYmIGlzRXF1aXBlZFdlYXBvbihlcXVpcGVkKSkge1xuICAgICAgICAgICAgcmV0dXJuIGVxdWlwZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb2goKTogV2VhcG9uRXF1aXBlZHx1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBlcXVpcGVkID0gdGhpcy5pdGVtcy5nZXQoSXRlbVNsb3QuT0ZGSEFORCk7XG5cbiAgICAgICAgaWYgKGVxdWlwZWQgJiYgaXNFcXVpcGVkV2VhcG9uKGVxdWlwZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXF1aXBlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVxdWlwKHNsb3Q6IEl0ZW1TbG90LCBpdGVtOiBJdGVtRGVzY3JpcHRpb24sIGVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb24sIHRlbXBvcmFyeUVuY2hhbnQ/OiBFbmNoYW50RGVzY3JpcHRpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuaXRlbXMuaGFzKHNsb3QpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBhbHJlYWR5IGhhdmUgaXRlbSBpbiBzbG90ICR7SXRlbVNsb3Rbc2xvdF19YClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKGl0ZW0uc2xvdCAmIHNsb3QpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBjYW5ub3QgZXF1aXAgJHtpdGVtLm5hbWV9IGluIHNsb3QgJHtJdGVtU2xvdFtzbG90XX1gKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0uc3RhdHMpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYmFzZVN0YXRzLmFkZChpdGVtLnN0YXRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbmNoYW50ICYmIGVuY2hhbnQuc3RhdHMpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYmFzZVN0YXRzLmFkZChlbmNoYW50LnN0YXRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE8gLSBoYW5kbGUgZXF1aXBwaW5nIDJIIChhbmQgaG93IHRoYXQgZGlzYWJsZXMgT0gpXG4gICAgICAgIC8vIFRPRE8gLSBhc3N1bWluZyBvbmx5IHdlYXBvbiBlbmNoYW50cyBjYW4gaGF2ZSBwcm9jc1xuICAgICAgICBpZiAoaXNXZWFwb24oaXRlbSkpIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMuc2V0KHNsb3QsIG5ldyBXZWFwb25FcXVpcGVkKGl0ZW0sIHRoaXMsIGVuY2hhbnQsIHRlbXBvcmFyeUVuY2hhbnQpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMuc2V0KHNsb3QsIG5ldyBJdGVtRXF1aXBlZChpdGVtLCB0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcG93ZXIoKTogbnVtYmVyIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgc2V0IHBvd2VyKHBvd2VyOiBudW1iZXIpIHt9XG5cbiAgICBhZGRQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgdGhpcy5wcm9jcy5wdXNoKHApO1xuICAgIH1cblxuICAgIHJlbW92ZVByb2MocDogUHJvYykge1xuICAgICAgICAvLyBUT0RPIC0gZWl0aGVyIHByb2NzIHNob3VsZCBiZSBhIHNldCBvciB3ZSBuZWVkIFByb2NBcHBsaWNhdGlvblxuICAgICAgICB0aGlzLnByb2NzID0gdGhpcy5wcm9jcy5maWx0ZXIoKHByb2M6IFByb2MpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwcm9jICE9PSBwO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBpZiAoc3BlbGwgJiYgc3BlbGwudHlwZSAhPT0gU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdlYXBvbiA9IGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oITtcbiAgICAgICAgY29uc3Qgd2VhcG9uVHlwZSA9IHdlYXBvbi53ZWFwb24udHlwZTtcblxuICAgICAgICAvLyBUT0RPLCBtYWtlIHRoaXMgYSBtYXBcbiAgICAgICAgc3dpdGNoICh3ZWFwb25UeXBlKSB7XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuTUFDRTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5tYWNlU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuU1dPUkQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3dvcmRTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5BWEU6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXhlU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuREFHR0VSOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhZ2dlclNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLk1BQ0UySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5tYWNlMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5TV09SRDJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN3b3JkMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5BWEUySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5heGUySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQ3JpdENoYW5jZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmIChMSF9DT1JFX0JVRyAmJiBzcGVsbCAmJiBzcGVsbC50eXBlID09IFNwZWxsVHlwZS5QSFlTSUNBTCkge1xuICAgICAgICAgICAgLy8gb24gTEggY29yZSwgbm9uIHdlYXBvbiBzcGVsbHMgbGlrZSBibG9vZHRoaXJzdCBhcmUgYmVuZWZpdHRpbmcgZnJvbSB3ZWFwb24gc2tpbGxcbiAgICAgICAgICAgIC8vIHRoaXMgb25seSBhZmZlY3RzIGNyaXQsIG5vdCBoaXQvZG9kZ2UvcGFycnlcbiAgICAgICAgICAgIC8vIHNldCB0aGUgc3BlbGwgdG8gdW5kZWZpbmVkIHNvIGl0IGlzIHRyZWF0ZWQgbGlrZSBhIG5vcm1hbCBtZWxlZSBhdHRhY2sgKHJhdGhlciB0aGFuIHVzaW5nIGEgZHVtbXkgc3BlbGwpXG4gICAgICAgICAgICAvLyB3aGVuIGNhbGN1bGF0aW5nIHdlYXBvbiBza2lsbFxuICAgICAgICAgICAgc3BlbGwgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3JpdCA9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuY3JpdDtcbiAgICAgICAgY3JpdCArPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFnaSAqIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RhdE11bHQgLyAyMDtcblxuICAgICAgICBpZiAoIXNwZWxsIHx8IHNwZWxsLnR5cGUgPT0gU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTikge1xuICAgICAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuXG4gICAgICAgICAgICBpZiAod2VhcG9uLnRlbXBvcmFyeUVuY2hhbnQgJiYgd2VhcG9uLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMgJiYgd2VhcG9uLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMuY3JpdCkge1xuICAgICAgICAgICAgICAgIGNyaXQgKz0gd2VhcG9uLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMuY3JpdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSAwLjA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuICAgICAgICBjcml0ICs9IHNraWxsQm9udXM7XG5cbiAgICAgICAgcmV0dXJuIGNyaXQ7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgcmVzID0gNTtcbiAgICAgICAgcmVzIC09IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuaGl0O1xuXG4gICAgICAgIGlmICh0aGlzLm9oICYmICFzcGVsbCkge1xuICAgICAgICAgICAgcmVzICs9IDE5O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBza2lsbERpZmYgPSB0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgsIHNwZWxsKSAtIHZpY3RpbS5kZWZlbnNlU2tpbGw7XG5cbiAgICAgICAgaWYgKHNraWxsRGlmZiA8IC0xMCkge1xuICAgICAgICAgICAgcmVzIC09IChza2lsbERpZmYgKyAxMCkgKiAwLjQgLSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzIC09IHNraWxsRGlmZiAqIDAuMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbGFtcChyZXMsIDAsIDYwKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlR2xhbmNpbmdSZWR1Y3Rpb24odmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBjb25zdCBza2lsbERpZmYgPSB2aWN0aW0uZGVmZW5zZVNraWxsICAtIHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCk7XG5cbiAgICAgICAgaWYgKHNraWxsRGlmZiA+PSAxNSkge1xuICAgICAgICAgICAgcmV0dXJuIDAuNjU7XG4gICAgICAgIH0gZWxzZSBpZiAoc2tpbGxEaWZmIDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc2tpbGxEaWZmVG9SZWR1Y3Rpb25bc2tpbGxEaWZmXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhcCgpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZVN3aW5nTWluTWF4RGFtYWdlKGlzX21oOiBib29sZWFuKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgICAgIGNvbnN0IHdlYXBvbiA9IGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oITtcblxuICAgICAgICBjb25zdCBhcF9ib251cyA9IHRoaXMuYXAgLyAxNCAqIHdlYXBvbi53ZWFwb24uc3BlZWQ7XG5cbiAgICAgICAgY29uc3Qgb2hQZW5hbHR5ID0gaXNfbWggPyAxIDogMC42MjU7IC8vIFRPRE8gLSBjaGVjayB0YWxlbnRzLCBpbXBsZW1lbnRlZCBhcyBhbiBhdXJhIFNQRUxMX0FVUkFfTU9EX09GRkhBTkRfREFNQUdFX1BDVFxuXG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAod2VhcG9uLm1pbiArIGFwX2JvbnVzKSAqIG9oUGVuYWx0eSxcbiAgICAgICAgICAgICh3ZWFwb24ubWF4ICsgYXBfYm9udXMpICogb2hQZW5hbHR5XG4gICAgICAgIF07XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlU3dpbmdSYXdEYW1hZ2UoaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgcmV0dXJuIGZyYW5kKC4uLnRoaXMuY2FsY3VsYXRlU3dpbmdNaW5NYXhEYW1hZ2UoaXNfbWgpKTtcbiAgICB9XG5cbiAgICBjcml0Q2FwKCkge1xuICAgICAgICBjb25zdCBza2lsbEJvbnVzID0gNCAqICh0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUodHJ1ZSkgLSB0aGlzLnRhcmdldCEubWF4U2tpbGxGb3JMZXZlbCk7XG4gICAgICAgIGNvbnN0IG1pc3NfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZU1pc3NDaGFuY2UodGhpcy50YXJnZXQhLCB0cnVlKSAqIDEwMCk7XG4gICAgICAgIGNvbnN0IGRvZGdlX2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy50YXJnZXQhLmRvZGdlQ2hhbmNlICogMTAwKSAtIHNraWxsQm9udXM7XG4gICAgICAgIGNvbnN0IGdsYW5jZV9jaGFuY2UgPSBjbGFtcCgoMTAgKyAodGhpcy50YXJnZXQhLmRlZmVuc2VTa2lsbCAtIDMwMCkgKiAyKSAqIDEwMCwgMCwgNDAwMCk7XG5cbiAgICAgICAgcmV0dXJuICgxMDAwMCAtIChtaXNzX2NoYW5jZSArIGRvZGdlX2NoYW5jZSArIGdsYW5jZV9jaGFuY2UpKSAvIDEwMDtcbiAgICB9XG5cbiAgICByb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpOiBNZWxlZUhpdE91dGNvbWUge1xuICAgICAgICBjb25zdCByb2xsID0gdXJhbmQoMCwgMTAwMDApO1xuICAgICAgICBsZXQgc3VtID0gMDtcbiAgICAgICAgbGV0IHRtcCA9IDA7XG5cbiAgICAgICAgLy8gcm91bmRpbmcgaW5zdGVhZCBvZiB0cnVuY2F0aW5nIGJlY2F1c2UgMTkuNCAqIDEwMCB3YXMgdHJ1bmNhdGluZyB0byAxOTM5LlxuICAgICAgICBjb25zdCBtaXNzX2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVNaXNzQ2hhbmNlKHZpY3RpbSwgaXNfbWgsIHNwZWxsKSAqIDEwMCk7XG4gICAgICAgIGNvbnN0IGRvZGdlX2NoYW5jZSA9IE1hdGgucm91bmQodmljdGltLmRvZGdlQ2hhbmNlICogMTAwKTtcbiAgICAgICAgY29uc3QgY3JpdF9jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlQ3JpdENoYW5jZSh2aWN0aW0sIGlzX21oLCBzcGVsbCkgKiAxMDApO1xuXG4gICAgICAgIC8vIHdlYXBvbiBza2lsbCAtIHRhcmdldCBkZWZlbnNlICh1c3VhbGx5IG5lZ2F0aXZlKVxuICAgICAgICBjb25zdCBza2lsbEJvbnVzID0gNCAqICh0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgsIHNwZWxsKSAtIHZpY3RpbS5tYXhTa2lsbEZvckxldmVsKTtcblxuICAgICAgICB0bXAgPSBtaXNzX2NoYW5jZTtcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTO1xuICAgICAgICB9XG5cbiAgICAgICAgdG1wID0gZG9kZ2VfY2hhbmNlIC0gc2tpbGxCb251czsgLy8gNS42ICg1NjApIGZvciBsdmwgNjMgd2l0aCAzMDAgd2VhcG9uIHNraWxsXG5cbiAgICAgICAgaWYgKHRtcCA+IDAgJiYgcm9sbCA8IChzdW0gKz0gdG1wKSkge1xuICAgICAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNwZWxsKSB7IC8vIHNwZWxscyBjYW4ndCBnbGFuY2VcbiAgICAgICAgICAgIHRtcCA9ICgxMCArICh2aWN0aW0uZGVmZW5zZVNraWxsIC0gMzAwKSAqIDIpICogMTAwO1xuICAgICAgICAgICAgdG1wID0gY2xhbXAodG1wLCAwLCA0MDAwKTtcbiAgICBcbiAgICAgICAgICAgIGlmIChyb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfR0xBTkNJTkc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBjcml0X2NoYW5jZTtcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUJvbnVzRGFtYWdlKHJhd0RhbWFnZTogbnVtYmVyLCB2aWN0aW06IFVuaXQsIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgbGV0IGRhbWFnZVdpdGhCb251cyA9IHJhd0RhbWFnZTtcblxuICAgICAgICBkYW1hZ2VXaXRoQm9udXMgKj0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5kYW1hZ2VNdWx0O1xuXG4gICAgICAgIHJldHVybiBkYW1hZ2VXaXRoQm9udXM7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpOiBbbnVtYmVyLCBNZWxlZUhpdE91dGNvbWUsIG51bWJlcl0ge1xuICAgICAgICBjb25zdCBkYW1hZ2VXaXRoQm9udXMgPSB0aGlzLmNhbGN1bGF0ZUJvbnVzRGFtYWdlKHJhd0RhbWFnZSwgdmljdGltLCBzcGVsbCk7XG4gICAgICAgIGNvbnN0IGFybW9yUmVkdWNlZCA9IHZpY3RpbS5jYWxjdWxhdGVBcm1vclJlZHVjZWREYW1hZ2UoZGFtYWdlV2l0aEJvbnVzLCB0aGlzKTtcbiAgICAgICAgY29uc3QgaGl0T3V0Y29tZSA9IHRoaXMucm9sbE1lbGVlSGl0T3V0Y29tZSh2aWN0aW0sIGlzX21oLCBzcGVsbCk7XG5cbiAgICAgICAgbGV0IGRhbWFnZSA9IGFybW9yUmVkdWNlZDtcbiAgICAgICAgbGV0IGNsZWFuRGFtYWdlID0gMDtcblxuICAgICAgICBzd2l0Y2ggKGhpdE91dGNvbWUpIHtcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IDA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0U6XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlk6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBjbGVhbkRhbWFnZSA9IGRhbWFnZVdpdGhCb251cztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWR1Y2VQZXJjZW50ID0gdGhpcy5jYWxjdWxhdGVHbGFuY2luZ1JlZHVjdGlvbih2aWN0aW0sIGlzX21oKTtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSByZWR1Y2VQZXJjZW50ICogZGFtYWdlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX05PUk1BTDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSAqPSAyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtkYW1hZ2UsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXTtcbiAgICB9XG5cbiAgICB1cGRhdGVQcm9jcyh0aW1lOiBudW1iZXIsIGlzX21oOiBib29sZWFuLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUsIGRhbWFnZURvbmU6IG51bWJlciwgY2xlYW5EYW1hZ2U6IG51bWJlciwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlldLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAvLyB3aGF0IGlzIHRoZSBvcmRlciBvZiBjaGVja2luZyBmb3IgcHJvY3MgbGlrZSBob2osIGlyb25mb2UgYW5kIHdpbmRmdXJ5XG4gICAgICAgICAgICAvLyBvbiBMSCBjb3JlIGl0IGlzIGhvaiA+IGlyb25mb2UgPiB3aW5kZnVyeVxuICAgICAgICAgICAgLy8gc28gZG8gaXRlbSBwcm9jcyBmaXJzdCwgdGhlbiB3ZWFwb24gcHJvYywgdGhlbiB3aW5kZnVyeVxuICAgICAgICAgICAgZm9yIChsZXQgcHJvYyBvZiB0aGlzLnByb2NzKSB7XG4gICAgICAgICAgICAgICAgcHJvYy5ydW4odGhpcywgKGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oISkud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIChpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCEpLnByb2ModGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZWFsTWVsZWVEYW1hZ2UodGltZTogbnVtYmVyLCByYXdEYW1hZ2U6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXSA9IHRoaXMuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oLCBzcGVsbCk7XG4gICAgICAgIGRhbWFnZURvbmUgPSBNYXRoLnRydW5jKGRhbWFnZURvbmUpOyAvLyB0cnVuY2F0aW5nIGhlcmUgYmVjYXVzZSB3YXJyaW9yIHN1YmNsYXNzIGJ1aWxkcyBvbiB0b3Agb2YgY2FsY3VsYXRlTWVsZWVEYW1hZ2VcbiAgICAgICAgY2xlYW5EYW1hZ2UgPSBNYXRoLnRydW5jKGNsZWFuRGFtYWdlKTsgLy8gVE9ETywgc2hvdWxkIGRhbWFnZU11bHQgYWZmZWN0IGNsZWFuIGRhbWFnZSBhcyB3ZWxsPyBpZiBzbyBtb3ZlIGl0IGludG8gY2FsY3VsYXRlTWVsZWVEYW1hZ2VcblxuICAgICAgICB0aGlzLmRhbWFnZUxvZy5wdXNoKFt0aW1lLCBkYW1hZ2VEb25lXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5sb2cpIHtcbiAgICAgICAgICAgIGxldCBoaXRTdHIgPSBgWW91ciAke3NwZWxsID8gc3BlbGwubmFtZSA6IChpc19taCA/ICdtYWluLWhhbmQnIDogJ29mZi1oYW5kJyl9ICR7aGl0T3V0Y29tZVN0cmluZ1toaXRPdXRjb21lXX1gO1xuICAgICAgICAgICAgaWYgKCFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZXS5pbmNsdWRlcyhoaXRPdXRjb21lKSkge1xuICAgICAgICAgICAgICAgIGhpdFN0ciArPSBgIGZvciAke2RhbWFnZURvbmV9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubG9nKHRpbWUsIGhpdFN0cik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3BlbGwgaW5zdGFuY2VvZiBTcGVsbERhbWFnZSkge1xuICAgICAgICAgICAgaWYgKHNwZWxsLmNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgLy8gY2FsbGluZyB0aGlzIGJlZm9yZSB1cGRhdGUgcHJvY3MgYmVjYXVzZSBpbiB0aGUgY2FzZSBvZiBleGVjdXRlLCB1bmJyaWRsZWQgd3JhdGggY291bGQgcHJvY1xuICAgICAgICAgICAgICAgIC8vIHRoZW4gc2V0dGluZyB0aGUgcmFnZSB0byAwIHdvdWxkIGNhdXNlIHVzIHRvIGxvc2UgdGhlIDEgcmFnZSBmcm9tIHVuYnJpZGxlZCB3cmF0aFxuICAgICAgICAgICAgICAgIC8vIGFsdGVybmF0aXZlIGlzIHRvIHNhdmUgdGhlIGFtb3VudCBvZiByYWdlIHVzZWQgZm9yIHRoZSBhYmlsaXR5XG4gICAgICAgICAgICAgICAgc3BlbGwuY2FsbGJhY2sodGhpcywgaGl0T3V0Y29tZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNwZWxsIHx8IHNwZWxsLmNhblByb2MpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUHJvY3ModGltZSwgaXNfbWgsIGhpdE91dGNvbWUsIGRhbWFnZURvbmUsIGNsZWFuRGFtYWdlLCBzcGVsbCk7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByb3RlY3RlZCBzd2luZ1dlYXBvbih0aW1lOiBudW1iZXIsIHRhcmdldDogVW5pdCwgaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgY29uc3QgcmF3RGFtYWdlID0gdGhpcy5jYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZShpc19taCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXRoaXMuZG9pbmdFeHRyYUF0dGFja3MgJiYgaXNfbWggJiYgdGhpcy5xdWV1ZWRTcGVsbCAmJiB0aGlzLnF1ZXVlZFNwZWxsLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIGNvbnN0IHN3aW5nU3BlbGwgPSB0aGlzLnF1ZXVlZFNwZWxsLnNwZWxsO1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRTcGVsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGNvbnN0IGJvbnVzRGFtYWdlID0gc3dpbmdTcGVsbC5ib251c0RhbWFnZTtcbiAgICAgICAgICAgIHRoaXMuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHJhd0RhbWFnZSArIGJvbnVzRGFtYWdlLCB0YXJnZXQsIGlzX21oLCBzd2luZ1NwZWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHJhd0RhbWFnZSwgdGFyZ2V0LCBpc19taCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBbdGhpc1dlYXBvbiwgb3RoZXJXZWFwb25dID0gaXNfbWggPyBbdGhpcy5taCwgdGhpcy5vaF0gOiBbdGhpcy5vaCwgdGhpcy5taF07XG5cbiAgICAgICAgdGhpc1dlYXBvbiEubmV4dFN3aW5nVGltZSA9IHRpbWUgKyB0aGlzV2VhcG9uIS53ZWFwb24uc3BlZWQgLyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhhc3RlICogMTAwMDtcblxuICAgICAgICBpZiAob3RoZXJXZWFwb24gJiYgb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSA8IHRpbWUgKyAyMDApIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBkZWxheWluZyAke2lzX21oID8gJ09IJyA6ICdNSCd9IHN3aW5nYCwgdGltZSArIDIwMCAtIG90aGVyV2VhcG9uLm5leHRTd2luZ1RpbWUpO1xuICAgICAgICAgICAgb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSA9IHRpbWUgKyAyMDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRyYUF0dGFja0NvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9pbmdFeHRyYUF0dGFja3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHdoaWxlICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4dHJhQXR0YWNrQ291bnQtLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGltZSA+PSB0aGlzLm1oIS5uZXh0U3dpbmdUaW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMub2ggJiYgdGltZSA+PSB0aGlzLm9oLm5leHRTd2luZ1RpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBQbGF5ZXIsIE1lbGVlSGl0T3V0Y29tZSwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiwgQnVmZk92ZXJUaW1lLCBCdWZmUHJvYyB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyBTcGVsbCwgTGVhcm5lZFNwZWxsLCBTcGVsbERhbWFnZSwgU3BlbGxUeXBlLCBTd2luZ1NwZWxsLCBMZWFybmVkU3dpbmdTcGVsbCwgUHJvYywgU3BlbGxCdWZmLCBTcGVsbEZhbWlseSB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcblxuY29uc3QgZmx1cnJ5ID0gbmV3IEJ1ZmYoXCJGbHVycnlcIiwgMTUsIHtoYXN0ZTogMS4zfSwgdHJ1ZSwgMywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblxuZXhwb3J0IGNvbnN0IHJhY2VUb1N0YXRzID0gbmV3IE1hcDxSYWNlLCBTdGF0VmFsdWVzPigpO1xucmFjZVRvU3RhdHMuc2V0KFJhY2UuSFVNQU4sIHsgbWFjZVNraWxsOiA1LCBzd29yZFNraWxsOiA1LCBtYWNlMkhTa2lsbDogNSwgc3dvcmQySFNraWxsOiA1LCBzdHI6IDEyMCwgYWdpOiA4MCB9KTtcbnJhY2VUb1N0YXRzLnNldChSYWNlLk9SQywgeyBheGVTa2lsbDogNSwgYXhlMkhTa2lsbDogNSwgc3RyOiAxMjMsIGFnaTogNzcgfSk7XG5cbmV4cG9ydCBjbGFzcyBXYXJyaW9yIGV4dGVuZHMgUGxheWVyIHtcbiAgICByYWdlID0gODA7IC8vIFRPRE8gLSBhbGxvdyBzaW11bGF0aW9uIHRvIGNob29zZSBzdGFydGluZyByYWdlXG5cbiAgICBleGVjdXRlID0gbmV3IExlYXJuZWRTcGVsbChleGVjdXRlU3BlbGwsIHRoaXMpO1xuICAgIGJsb29kdGhpcnN0ID0gbmV3IExlYXJuZWRTcGVsbChibG9vZHRoaXJzdFNwZWxsLCB0aGlzKTtcbiAgICBoYW1zdHJpbmcgPSBuZXcgTGVhcm5lZFNwZWxsKGhhbXN0cmluZ1NwZWxsLCB0aGlzKTtcbiAgICB3aGlybHdpbmQgPSBuZXcgTGVhcm5lZFNwZWxsKHdoaXJsd2luZFNwZWxsLCB0aGlzKTtcbiAgICBoZXJvaWNTdHJpa2UgPSBuZXcgTGVhcm5lZFN3aW5nU3BlbGwoaGVyb2ljU3RyaWtlU3BlbGwsIHRoaXMpO1xuICAgIGJsb29kUmFnZSA9IG5ldyBMZWFybmVkU3BlbGwoYmxvb2RSYWdlLCB0aGlzKTtcbiAgICBkZWF0aFdpc2ggPSBuZXcgTGVhcm5lZFNwZWxsKGRlYXRoV2lzaCwgdGhpcyk7XG4gICAgZXhlY3V0ZVNwZWxsID0gbmV3IExlYXJuZWRTcGVsbChleGVjdXRlU3BlbGwsIHRoaXMpO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZ0NhbGxiYWNrPzogKHRpbWU6IG51bWJlciwgdGV4dDogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5ldyBTdGF0cyhyYWNlVG9TdGF0cy5nZXQocmFjZSkpLmFkZChzdGF0cyksIGxvZ0NhbGxiYWNrKTtcblxuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChhbmdlck1hbmFnZW1lbnRPVCwgTWF0aC5yYW5kb20oKSAqIC0zMDAwKTsgLy8gcmFuZG9taXppbmcgYW5nZXIgbWFuYWdlbWVudCB0aW1pbmdcbiAgICAgICAgdGhpcy5idWZmTWFuYWdlci5hZGQodW5icmlkbGVkV3JhdGgsIDApO1xuICAgIH1cblxuICAgIGdldCBwb3dlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmFnZTtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge1xuICAgICAgICB0aGlzLnBvd2VyTG9zdCArPSBNYXRoLm1heCgwLCBwb3dlciAtIDEwMCk7XG4gICAgICAgIHRoaXMucmFnZSA9IGNsYW1wKHBvd2VyLCAwLCAxMDApO1xuICAgIH1cblxuICAgIGdldCBhcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiAzIC0gMjAgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFwICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdHIgKiB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0YXRNdWx0ICogMjtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgLy8gY3J1ZWx0eSArIGJlcnNlcmtlciBzdGFuY2VcbiAgICAgICAgcmV0dXJuIDUgKyAzICsgc3VwZXIuY2FsY3VsYXRlQ3JpdENoYW5jZSh2aWN0aW0sIGlzX21oLCBzcGVsbCk7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpOiBbbnVtYmVyLCBNZWxlZUhpdE91dGNvbWUsIG51bWJlcl0ge1xuICAgICAgICBsZXQgW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXSA9IHN1cGVyLmNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZSwgdmljdGltLCBpc19taCwgc3BlbGwpO1xuXG4gICAgICAgIGlmIChoaXRPdXRjb21lID09PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQgJiYgc3BlbGwgJiYgc3BlbGwuZmFtaWx5ID09PSBTcGVsbEZhbWlseS5XQVJSSU9SKSB7XG4gICAgICAgICAgICBkYW1hZ2VEb25lICo9IDEuMTsgLy8gaW1wYWxlXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCByZXdhcmRSYWdlKGRhbWFnZTogbnVtYmVyLCBpc19hdHRhY2tlcjogYm9vbGVhbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIGh0dHBzOi8vYmx1ZS5tbW8tY2hhbXBpb24uY29tL3RvcGljLzE4MzI1LXRoZS1uZXctcmFnZS1mb3JtdWxhLWJ5LWthbGdhbi9cbiAgICAgICAgLy8gUHJlLUV4cGFuc2lvbiBSYWdlIEdhaW5lZCBmcm9tIGRlYWxpbmcgZGFtYWdlOlxuICAgICAgICAvLyAoRGFtYWdlIERlYWx0KSAvIChSYWdlIENvbnZlcnNpb24gYXQgWW91ciBMZXZlbCkgKiA3LjVcbiAgICAgICAgLy8gRm9yIFRha2luZyBEYW1hZ2UgKGJvdGggcHJlIGFuZCBwb3N0IGV4cGFuc2lvbik6XG4gICAgICAgIC8vIFJhZ2UgR2FpbmVkID0gKERhbWFnZSBUYWtlbikgLyAoUmFnZSBDb252ZXJzaW9uIGF0IFlvdXIgTGV2ZWwpICogMi41XG4gICAgICAgIC8vIFJhZ2UgQ29udmVyc2lvbiBhdCBsZXZlbCA2MDogMjMwLjZcbiAgICAgICAgLy8gVE9ETyAtIGhvdyBkbyBmcmFjdGlvbnMgb2YgcmFnZSB3b3JrPyBpdCBhcHBlYXJzIHlvdSBkbyBnYWluIGZyYWN0aW9ucyBiYXNlZCBvbiBleGVjIGRhbWFnZVxuICAgICAgICAvLyBub3QgdHJ1bmNhdGluZyBmb3Igbm93XG4gICAgICAgIC8vIFRPRE8gLSBpdCBhcHBlYXJzIHRoYXQgcmFnZSBpcyBjYWxjdWxhdGVkIHRvIHRlbnRocyBiYXNlZCBvbiBkYXRhYmFzZSB2YWx1ZXMgb2Ygc3BlbGxzICgxMCBlbmVyZ3kgPSAxIHJhZ2UpXG4gICAgICAgIFxuICAgICAgICBjb25zdCBMRVZFTF82MF9SQUdFX0NPTlYgPSAyMzAuNjtcbiAgICAgICAgbGV0IGFkZFJhZ2UgPSBkYW1hZ2UgLyBMRVZFTF82MF9SQUdFX0NPTlY7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNfYXR0YWNrZXIpIHtcbiAgICAgICAgICAgIGFkZFJhZ2UgKj0gNy41O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGNoZWNrIGZvciBiZXJzZXJrZXIgcmFnZSAxLjN4IG1vZGlmaWVyXG4gICAgICAgICAgICBhZGRSYWdlICo9IDIuNTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxvZykgdGhpcy5sb2codGltZSwgYEdhaW5lZCAke01hdGgubWluKGFkZFJhZ2UsIDEwMCAtIHRoaXMucmFnZSl9IHJhZ2UgKCR7TWF0aC5taW4oMTAwLCB0aGlzLnBvd2VyICsgYWRkUmFnZSl9KWApO1xuXG4gICAgICAgIHRoaXMucG93ZXIgKz0gYWRkUmFnZTtcbiAgICB9XG5cbiAgICB1cGRhdGVQcm9jcyh0aW1lOiBudW1iZXIsIGlzX21oOiBib29sZWFuLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUsIGRhbWFnZURvbmU6IG51bWJlciwgY2xlYW5EYW1hZ2U6IG51bWJlciwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBzdXBlci51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIHNwZWxsKTtcblxuICAgICAgICBpZiAoW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICBpZiAoc3BlbGwpIHtcbiAgICAgICAgICAgICAgICAvLyBodHRwOi8vYmx1ZS5tbW8tY2hhbXBpb24uY29tL3RvcGljLzY5MzY1LTE4LTAyLTA1LWthbGdhbnMtcmVzcG9uc2UtdG8td2FycmlvcnMvIFwic2luY2UgbWlzc2luZyB3YXN0ZXMgMjAlIG9mIHRoZSByYWdlIGNvc3Qgb2YgdGhlIGFiaWxpdHlcIlxuICAgICAgICAgICAgICAgIC8vIFRPRE8gLSBub3Qgc3VyZSBob3cgYmxpenpsaWtlIHRoaXMgaXNcbiAgICAgICAgICAgICAgICBpZiAoc3BlbGwgIT09IHdoaXJsd2luZFNwZWxsKSB7IC8vIFRPRE8gLSBzaG91bGQgY2hlY2sgdG8gc2VlIGlmIGl0IGlzIGFuIGFvZSBzcGVsbCBvciBhIHNpbmdsZSB0YXJnZXQgc3BlbGxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYWdlICs9IHNwZWxsLmNvc3QgKiAwLjgyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXdhcmRSYWdlKGNsZWFuRGFtYWdlICogMC43NSwgdHJ1ZSwgdGltZSk7IC8vIFRPRE8gLSB3aGVyZSBpcyB0aGlzIGZvcm11bGEgZnJvbT9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChkYW1hZ2VEb25lICYmICFzcGVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZXdhcmRSYWdlKGRhbWFnZURvbmUsIHRydWUsIHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5zdGFudCBhdHRhY2tzIGFuZCBtaXNzZXMvZG9kZ2VzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyAvLyBUT0RPIC0gY29uZmlybSwgd2hhdCBhYm91dCBwYXJyeT9cbiAgICAgICAgLy8gZXh0cmEgYXR0YWNrcyBkb24ndCB1c2UgZmx1cnJ5IGNoYXJnZXMgYnV0IHRoZXkgY2FuIHByb2MgZmx1cnJ5ICh0ZXN0ZWQpXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICF0aGlzLmRvaW5nRXh0cmFBdHRhY2tzXG4gICAgICAgICAgICAmJiAhKHNwZWxsIHx8IHNwZWxsID09PSBoZXJvaWNTdHJpa2VTcGVsbClcbiAgICAgICAgICAgICYmICFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKVxuICAgICAgICAgICAgJiYgaGl0T3V0Y29tZSAhPT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXG4gICAgICAgICkgeyBcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIucmVtb3ZlKGZsdXJyeSwgdGltZSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChoaXRPdXRjb21lID09PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQpIHtcbiAgICAgICAgICAgIC8vIFRPRE8gLSBpZ25vcmluZyBkZWVwIHdvdW5kc1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5hZGQoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgaGVyb2ljU3RyaWtlU3BlbGwgPSBuZXcgU3dpbmdTcGVsbChcIkhlcm9pYyBTdHJpa2VcIiwgU3BlbGxGYW1pbHkuV0FSUklPUiwgMTU3LCAxMik7XG5cbi8vIGV4ZWN1dGUgYWN0dWFsbHkgd29ya3MgYnkgY2FzdGluZyB0d28gc3BlbGxzLCBmaXJzdCByZXF1aXJlcyB3ZWFwb24gYnV0IGRvZXMgbm8gZGFtYWdlXG4vLyBzZWNvbmQgb25lIGRvZXNuJ3QgcmVxdWlyZSB3ZWFwb24gYW5kIGRlYWxzIHRoZSBkYW1hZ2UuXG4vLyBMSCBjb3JlIG92ZXJyb2RlIHRoZSBzZWNvbmQgc3BlbGwgdG8gcmVxdWlyZSB3ZWFwb24gKGJlbmVmaXQgZnJvbSB3ZWFwb24gc2tpbGwpXG5jb25zdCBleGVjdXRlU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJFeGVjdXRlXCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiA2MDAgKyAocGxheWVyLnBvd2VyIC0gMTApICogMTU7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBTcGVsbEZhbWlseS5XQVJSSU9SLCB0cnVlLCAxMCwgMCwgKHBsYXllcjogUGxheWVyLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUpID0+IHtcbiAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1NdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgIHBsYXllci5wb3dlciA9IDA7XG4gICAgfVxufSk7XG5cbmNvbnN0IGJsb29kdGhpcnN0U3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJCbG9vZHRoaXJzdFwiLCAocGxheWVyOiBQbGF5ZXIpID0+IHtcbiAgICByZXR1cm4gKDxXYXJyaW9yPnBsYXllcikuYXAgKiAwLjQ1O1xufSwgU3BlbGxUeXBlLlBIWVNJQ0FMLCBTcGVsbEZhbWlseS5XQVJSSU9SLCB0cnVlLCAzMCwgNik7XG5cbmNvbnN0IHdoaXJsd2luZFNwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiV2hpcmx3aW5kXCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiBwbGF5ZXIuY2FsY3VsYXRlU3dpbmdSYXdEYW1hZ2UodHJ1ZSk7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBTcGVsbEZhbWlseS5XQVJSSU9SLCB0cnVlLCAyNSwgMTApO1xuXG5jb25zdCBoYW1zdHJpbmdTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkhhbXN0cmluZ1wiLCA0NSwgU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgU3BlbGxGYW1pbHkuV0FSUklPUiwgdHJ1ZSwgMTAsIDApO1xuXG5leHBvcnQgY29uc3QgYW5nZXJNYW5hZ2VtZW50T1QgPSBuZXcgQnVmZk92ZXJUaW1lKFwiQW5nZXIgTWFuYWdlbWVudFwiLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgdW5kZWZpbmVkLCAzMDAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbmVkIDEgcmFnZSBmcm9tIEFuZ2VyIE1hbmFnZW1lbnRgKTtcbn0pO1xuXG5jb25zdCBibG9vZFJhZ2VPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJCbG9vZHJhZ2VcIiwgMTAsIHVuZGVmaW5lZCwgMTAwMCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW5lZCAxIHJhZ2UgZnJvbSBCbG9vZHJhZ2VgKTtcbn0pO1xuXG5jb25zdCBibG9vZFJhZ2UgPSBuZXcgU3BlbGwoXCJCbG9vZHJhZ2VcIiwgU3BlbGxUeXBlLk5PTkUsIFNwZWxsRmFtaWx5LldBUlJJT1IsIGZhbHNlLCAwLCA2MCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBwbGF5ZXIucG93ZXIgKz0gMTA7XG4gICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluIDEwIHJhZ2UgZnJvbSBCbG9vZHJhZ2VgKTtcbiAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJsb29kUmFnZU9ULCB0aW1lKTtcbn0pO1xuXG5jb25zdCBkZWF0aFdpc2ggPSBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiRGVhdGggV2lzaFwiLCAzMCwgeyBkYW1hZ2VNdWx0OiAxLjIgfSksIHRydWUsIDEwLCAzICogNjApO1xuXG5jb25zdCB1bmJyaWRsZWRXcmF0aCA9IG5ldyBCdWZmUHJvYyhcIlVuYnJpZGxlZCBXcmF0aFwiLCA2MCAqIDYwLFxuICAgIG5ldyBQcm9jKFxuICAgICAgICBuZXcgU3BlbGwoXCJVbmJyaWRsZWQgV3JhdGhcIiwgU3BlbGxUeXBlLk5PTkUsIFNwZWxsRmFtaWx5LldBUlJJT1IsIGZhbHNlLCAwLCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluIDEgcmFnZSBmcm9tIFVuYnJpZGxlZCBXcmF0aGApO1xuICAgICAgICAgICAgcGxheWVyLnBvd2VyICs9IDE7XG4gICAgICAgIH0pLFxuICAgICAgICB7Y2hhbmNlOiA0MH0pKTtcbiIsImltcG9ydCB7IFByb2MsIFNwZWxsQnVmZiwgRXh0cmFBdHRhY2sgfSBmcm9tIFwiLi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4uL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCB9IGZyb20gXCIuLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4uL2J1ZmYuanNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBFbmNoYW50RGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzbG90OiBJdGVtU2xvdCxcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG4gICAgcHJvYz86IFByb2Ncbn1cblxuZXhwb3J0IGNvbnN0IGVuY2hhbnRzOiBFbmNoYW50RGVzY3JpcHRpb25bXSA9IFtcbiAgICB7XG4gICAgICAgIC8vIE5PVEU6IHRvIHNpbXBsaWZ5IHRoZSBjb2RlLCB0cmVhdGluZyB0aGVzZSBhcyB0d28gc2VwYXJhdGUgYnVmZnMgc2luY2UgdGhleSBzdGFja1xuICAgICAgICAvLyBjcnVzYWRlciBidWZmcyBhcHBhcmVudGx5IGNhbiBiZSBmdXJ0aGVyIHN0YWNrZWQgYnkgc3dhcHBpbmcgd2VhcG9ucyBidXQgbm90IGdvaW5nIHRvIGJvdGhlciB3aXRoIHRoYXRcbiAgICAgICAgbmFtZTogJ0NydXNhZGVyIE1IJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIHByb2M6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJDcnVzYWRlciBNSFwiLCAxNSwgbmV3IFN0YXRzKHtzdHI6IDEwMH0pKSksIHtwcG06IDF9KSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0NydXNhZGVyIE9IJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgcHJvYzogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE9IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pLFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnOCBTdHJlbmd0aCcsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQgfCBJdGVtU2xvdC5MRUdTLFxuICAgICAgICBzdGF0czoge3N0cjogOH0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICcxNSBBZ2lsaXR5JyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxNX0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICcxIEhhc3RlJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCB8IEl0ZW1TbG90LkxFR1MgfCBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHtoYXN0ZTogMS4wMX0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICczIEFnaWxpdHknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge2FnaTogM30sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdaRyBFbmNoYW50ICgzMCBBUCknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5TSE9VTERFUixcbiAgICAgICAgc3RhdHM6IHthcDogMzB9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnR3JlYXRlciBTdGF0cyAoKzQpJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA0LCBhZ2k6IDR9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnOSBTdHJlbmd0aCcsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge3N0cjogOX0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdSdW4gU3BlZWQnLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge30sIC8vIFRPRE8gLSBkbyBtb3ZlbWVudCBzcGVlZCBpZiBJIGV2ZXIgZ2V0IGFyb3VuZCB0byBzaW11bGF0aW5nIGZpZ2h0cyB5b3UgaGF2ZSB0byBydW4gb3V0XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICc3IEFnaWxpdHknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge2FnaTogN30sXG4gICAgfSxcbl07XG5cbmV4cG9ydCBjb25zdCB0ZW1wb3JhcnlFbmNoYW50czogRW5jaGFudERlc2NyaXB0aW9uW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiAnKzggRGFtYWdlJyxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQgfCBJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBzdGF0czogeyBwbHVzRGFtYWdlOiA4IH0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6ICdFbGVtZW50YWwgU2hhcnBlbmluZyBTdG9uZScsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EIHwgSXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMiB9LFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnV2luZGZ1cnknLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgcHJvYzogbmV3IFByb2MoW1xuICAgICAgICAgICAgbmV3IEV4dHJhQXR0YWNrKFwiV2luZGZ1cnkgVG90ZW1cIiwgMSksXG4gICAgICAgICAgICBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiV2luZGZ1cnkgVG90ZW1cIiwgMS41LCB7IGFwOiAzMTUgfSkpXG4gICAgICAgIF0sIHtjaGFuY2U6IDAuMn0pLFxuICAgIH1cbl07XG4iLCJpbXBvcnQgeyBXZWFwb25UeXBlLCBXZWFwb25EZXNjcmlwdGlvbiwgSXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbiB9IGZyb20gXCIuLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBTcGVsbEJ1ZmYsIEV4dHJhQXR0YWNrLCBQcm9jLCBTcGVsbFR5cGUsIEl0ZW1TcGVsbERhbWFnZSB9IGZyb20gXCIuLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgQnVmZiwgQnVmZlByb2MgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuXG4vLyBUT0RPIC0gaG93IHRvIGltcGxlbWVudCBzZXQgYm9udXNlcz8gcHJvYmFibHkgZWFzaWVzdCB0byBhZGQgYm9udXMgdGhhdCByZXF1aXJlcyBhIHN0cmluZyBzZWFyY2ggb2Ygb3RoZXIgZXF1aXBlZCBpdGVtc1xuXG5leHBvcnQgY29uc3QgaXRlbXM6IChJdGVtRGVzY3JpcHRpb258V2VhcG9uRGVzY3JpcHRpb24pW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiBcIklyb25mb2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgbWluOiA3MyxcbiAgICAgICAgbWF4OiAxMzYsXG4gICAgICAgIHNwZWVkOiAyLjQsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0lyb25mb2UnLCAyKSx7cHBtOiAxfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFbXB5cmVhbiBEZW1vbGlzaGVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogOTQsXG4gICAgICAgIG1heDogMTc1LFxuICAgICAgICBzcGVlZDogMi44LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkhhc3RlIChFbXB5cmVhbiBEZW1vbGlzaGVyKVwiLCAxMCwge2hhc3RlOiAxLjJ9KSkse3BwbTogMX0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQW51YmlzYXRoIFdhcmhhbW1lclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNjYsXG4gICAgICAgIG1heDogMTIzLFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBtYWNlU2tpbGw6IDQsIGFwOiAzMiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVGhlIFVudGFtZWQgQmxhZGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRDJILFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiAxOTIsXG4gICAgICAgIG1heDogMjg5LFxuICAgICAgICBzcGVlZDogMy40LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIlVudGFtZWQgRnVyeVwiLCA4LCB7c3RyOiAzMDB9KSkse3BwbTogMn0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSGFuZCBvZiBKdXN0aWNlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDIwfSxcbiAgICAgICAgb25lcXVpcDogbmV3IFByb2MobmV3IEV4dHJhQXR0YWNrKCdIYW5kIG9mIEp1c3RpY2UnLCAxKSwge2NoYW5jZTogMi8xMDB9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsYWNraGFuZCdzIEJyZWFkdGhcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHtjcml0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRyYWtlIEZhbmcgVGFsaXNtYW5cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHthcDogNTYsIGhpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJMaW9uaGVhcnQgSGVsbVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IRUFELFxuICAgICAgICBzdGF0czoge2NyaXQ6IDIsIGhpdDogMiwgc3RyOiAxOH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYXJiZWQgQ2hva2VyXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk5FQ0ssXG4gICAgICAgIHN0YXRzOiB7YXA6IDQ0LCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9ueXhpYSBUb290aCBQZW5kYW50XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk5FQ0ssXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxMiwgaGl0OiAxLCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNvbnF1ZXJvcidzIFNwYXVsZGVyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5TSE9VTERFUixcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDE2LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ2xvYWsgb2YgRHJhY29uaWMgTWlnaHRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQkFDSyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDE2LCBhZ2k6IDE2fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRyYXBlIG9mIFVueWllbGRpbmcgU3RyZW5ndGhcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQkFDSyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDE1LCBhZ2k6IDksIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBCcmVhc3RwbGF0ZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDE2LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU2F2YWdlIEdsYWRpYXRvciBDaGFpblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE0LCBzdHI6IDEzLCBjcml0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdob3VsIFNraW4gVHVuaWNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA0MCwgY3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCcmVhc3RwbGF0ZSBvZiBBbm5paGlsYXRpb25cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzNywgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhpdmUgRGVmaWxlciBXcmlzdGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIzLCBhZ2k6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlFpcmFqaSBFeGVjdXRpb24gQnJhY2Vyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE2LCBzdHI6IDE1LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2F1bnRsZXRzIG9mIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMjIsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgQW5uaWhpbGF0aW9uXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMzUsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFZGdlbWFzdGVyJ3MgSGFuZGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHsgYXhlU2tpbGw6IDcsIGRhZ2dlclNraWxsOiA3LCBzd29yZFNraWxsOiA3IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJBZ2VkIENvcmUgTGVhdGhlciBHbG92ZXNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7IHN0cjogMTUsIGNyaXQ6IDEsIGRhZ2dlclNraWxsOiA1IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJPbnNsYXVnaHQgR2lyZGxlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldBSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMzEsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaXRhbmljIExlZ2dpbmdzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMCwgY3JpdDogMSwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNvbnF1ZXJvcidzIExlZ2d1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5MRUdTLFxuICAgICAgICBzdGF0czoge2FnaTogMjEsIHN0cjogMzMsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCb290cyBvZiB0aGUgRmFsbGVuIEhlcm9cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDE0LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ2hyb21hdGljIEJvb3RzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAyMCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlN0cmlrZXIncyBNYXJrXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlJBTkdFRCxcbiAgICAgICAgc3RhdHM6IHthcDogMjIsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJRdWljayBTdHJpa2UgUmluZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthcDogMzAsIGNyaXQ6IDEsIHN0cjogNX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSaW5nIG9mIHRoZSBRaXJhamkgRnVyeVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthcDogNDAsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFzdGVyIERyYWdvbnNsYXllcidzIFJpbmdcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDQ4LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRG9uIEp1bGlvJ3MgQmFuZFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHtjcml0OiAxLCBoaXQ6IDEsIGFwOiAxNn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJWaXMna2FnIHRoZSBCbG9vZGxldHRlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEwMCxcbiAgICAgICAgbWF4OiAxODcsXG4gICAgICAgIHNwZWVkOiAyLjYsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgSXRlbVNwZWxsRGFtYWdlKFwiRmF0YWwgV291bmRzXCIsIDI0MCwgU3BlbGxUeXBlLlBIWVNJQ0FMKSx7cHBtOiAxLjN9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNocm9tYXRpY2FsbHkgVGVtcGVyZWQgU3dvcmRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDYsXG4gICAgICAgIG1heDogMTk4LFxuICAgICAgICBzcGVlZDogMi42LFxuICAgICAgICBzdGF0czogeyBhZ2k6IDE0LCBzdHI6IDE0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNYWxhZGF0aCwgUnVuZWQgQmxhZGUgb2YgdGhlIEJsYWNrIEZsaWdodFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDg2LFxuICAgICAgICBtYXg6IDE2MixcbiAgICAgICAgc3BlZWQ6IDIuMixcbiAgICAgICAgc3RhdHM6IHsgc3dvcmRTa2lsbDogNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQW5jaWVudCBRaXJhamkgUmlwcGVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTE0LFxuICAgICAgICBtYXg6IDIxMyxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDIwIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgTG9uZ3N3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgU3dpZnRibGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDg1LFxuICAgICAgICBtYXg6IDEyOSxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgQXhlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEzOCxcbiAgICAgICAgbWF4OiAyMDcsXG4gICAgICAgIHNwZWVkOiAyLjksXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3NlZCBRaXJhamkgV2FyIEF4ZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMTAsXG4gICAgICAgIG1heDogMjA1LFxuICAgICAgICBzcGVlZDogMi42MCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDE0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDcnVsJ3Nob3J1a2gsIEVkZ2Ugb2YgQ2hhb3NcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTAxLFxuICAgICAgICBtYXg6IDE4OCxcbiAgICAgICAgc3BlZWQ6IDIuMzAsXG4gICAgICAgIHN0YXRzOiB7IGFwOiAzNiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRGVhdGhicmluZ2VyIChXL08gUFJPQylcIiwgLy8gVE9ET1xuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMTQsXG4gICAgICAgIG1heDogMjEzLFxuICAgICAgICBzcGVlZDogMi45MFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRvb20ncyBFZGdlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDgzLFxuICAgICAgICBtYXg6IDE1NCxcbiAgICAgICAgc3BlZWQ6IDIuMzAsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogMTYsIHN0cjogOSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWlyYWgncyBTb25nXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNTcsXG4gICAgICAgIG1heDogODcsXG4gICAgICAgIHNwZWVkOiAxLjgsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogOSwgc3RyOiA5IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEZWF0aCdzIFN0aW5nXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuREFHR0VSLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDk1LFxuICAgICAgICBtYXg6IDE0NCxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDM4LCBkYWdnZXJTa2lsbDogMyB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3NlZCBRaXJhamkgUHVnaW9cIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5EQUdHRVIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNzIsXG4gICAgICAgIG1heDogMTM0LFxuICAgICAgICBzcGVlZDogMS43LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBoaXQ6IDEsIGFwOiAxOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRmVsc3RyaWtlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkRBR0dFUixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA1NCxcbiAgICAgICAgbWF4OiAxMDEsXG4gICAgICAgIHNwZWVkOiAxLjcsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiRmVsc3RyaWtlclwiLCAzLCB7Y3JpdDogMTAwLCBoaXQ6IDEwMH0pKSx7cHBtOiAxLjR9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIG9udXNlOiAoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW5zaWdodE9mVGhlUWlyYWppID0gbmV3IEJ1ZmYoXCJJbnNpZ2h0IG9mIHRoZSBRaXJhamlcIiwgMzAsIHthcm1vclBlbmV0cmF0aW9uOiAyMDB9LCB0cnVlLCAwLCA2KTtcbiAgICAgICAgICAgIGNvbnN0IGJhZGdlQnVmZiA9IG5ldyBTcGVsbEJ1ZmYoXG4gICAgICAgICAgICAgICAgbmV3IEJ1ZmZQcm9jKFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIiwgMzAsXG4gICAgICAgICAgICAgICAgICAgIG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYoaW5zaWdodE9mVGhlUWlyYWppKSwge3BwbTogMTV9KSxcbiAgICAgICAgICAgICAgICAgICAgaW5zaWdodE9mVGhlUWlyYWppKSxcbiAgICAgICAgICAgICAgICBmYWxzZSwgMCwgMyAqIDYwKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGJhZGdlQnVmZjtcbiAgICAgICAgfSkoKVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRpYW1vbmQgRmxhc2tcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgb251c2U6IG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJEaWFtb25kIEZsYXNrXCIsIDYwLCB7c3RyOiA3NX0pLCB0cnVlLCAwLCA2ICogNjApLFxuICAgIH1cbl07XG4iLCJpbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4uL2J1ZmYuanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi4vc3RhdHMuanNcIjtcblxuXG5pbnRlcmZhY2UgQnVmZkRlc2NyaXB0aW9uIHtcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgZHVyYXRpb246IG51bWJlcixcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG59XG5cbmV4cG9ydCBjb25zdCBidWZmczogQnVmZltdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYXR0bGUgU2hvdXRcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyOTBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdpZnQgb2YgdGhlIFdpbGRcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAxNiwgLy8gVE9ETyAtIHNob3VsZCBpdCBiZSAxMiAqIDEuMzU/ICh0YWxlbnQpXG4gICAgICAgICAgICBhZ2k6IDE2XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUcnVlc2hvdCBBdXJhXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAxMDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzaW5nIG9mIEtpbmdzXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RhdE11bHQ6IDEuMVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3Npbmcgb2YgTWlnaHRcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjIyXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTbW9rZWQgRGVzZXJ0IER1bXBsaW5nc1wiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgUG93ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDMwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDMwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJKdWp1IE1pZ2h0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAxMCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDQwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFbGl4aXIgb2YgdGhlIE1vbmdvb3NlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFnaTogMjUsXG4gICAgICAgICAgICBjcml0OiAyXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSLk8uSS5ELlMuXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJhbGx5aW5nIENyeSBvZiB0aGUgRHJhZ29uc2xheWVyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAxNDAsXG4gICAgICAgICAgICBjcml0OiA1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTb25nZmxvd2VyIFNlcmFuYWRlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGNyaXQ6IDUsXG4gICAgICAgICAgICBzdHI6IDE1LFxuICAgICAgICAgICAgYWdpOiAxNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3Bpcml0IG9mIFphbmRhbGFyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0YXRNdWx0OiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJGZW5ndXMnIEZlcm9jaXR5XCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyMDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIldhcmNoaWVmJ3MgQmxlc3NpbmdcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgaGFzdGU6IDEuMTVcbiAgICAgICAgfVxuICAgIH0sXG5dLm1hcCgoYmQ6IEJ1ZmZEZXNjcmlwdGlvbikgPT4gbmV3IEJ1ZmYoYmQubmFtZSwgYmQuZHVyYXRpb24sIGJkLnN0YXRzKSk7XG4iLCJpbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgV2FycmlvciB9IGZyb20gXCIuL3dhcnJpb3IuanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgRW5jaGFudERlc2NyaXB0aW9uLCB0ZW1wb3JhcnlFbmNoYW50cywgZW5jaGFudHMgfSBmcm9tIFwiLi9kYXRhL2VuY2hhbnRzLmpzXCI7XG5pbXBvcnQgeyBpdGVtcyB9IGZyb20gXCIuL2RhdGEvaXRlbXMuanNcIjtcbmltcG9ydCB7IGJ1ZmZzIH0gZnJvbSBcIi4vZGF0YS9zcGVsbHMuanNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBTaW11bGF0aW9uRGVzY3JpcHRpb24ge1xuICAgIHJhY2U6IFJhY2UsXG4gICAgc3RhdHM6IFN0YXRWYWx1ZXMsXG4gICAgZXF1aXBtZW50OiBNYXA8SXRlbVNsb3QsIG51bWJlcj4sXG4gICAgZW5jaGFudHM6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPixcbiAgICB0ZW1wb3JhcnlFbmNoYW50czogTWFwPEl0ZW1TbG90LCBudW1iZXI+LFxuICAgIGJ1ZmZzOiBudW1iZXJbXSxcbiAgICBmaWdodExlbmd0aDogbnVtYmVyLFxuICAgIHJlYWx0aW1lOiBib29sZWFuLFxuICAgIGhlcm9pY1N0cmlrZVJhZ2VSZXE6IG51bWJlcixcbiAgICBoYW1zdHJpbmdSYWdlUmVxOiBudW1iZXIsXG4gICAgYmxvb2R0aGlyc3RFeGVjUmFnZUxpbWl0OiBudW1iZXIsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cFBsYXllcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBNYXA8SXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbj4sIGVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj4sIHRlbXBvcmFyeUVuY2hhbnQ6IE1hcDxJdGVtU2xvdCwgRW5jaGFudERlc2NyaXB0aW9uPiwgYnVmZnM6IEJ1ZmZbXSwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICBjb25zdCBwbGF5ZXIgPSBuZXcgV2FycmlvcihyYWNlLCBzdGF0cywgbG9nKTtcblxuICAgIGZvciAobGV0IFtzbG90LCBpdGVtXSBvZiBlcXVpcG1lbnQpIHtcbiAgICAgICAgcGxheWVyLmVxdWlwKHNsb3QsIGl0ZW0sIGVuY2hhbnRzLmdldChzbG90KSwgdGVtcG9yYXJ5RW5jaGFudC5nZXQoc2xvdCkpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGJ1ZmYgb2YgYnVmZnMpIHtcbiAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChidWZmLCAwKTtcbiAgICB9XG5cbiAgICBjb25zdCBib3NzID0gbmV3IFVuaXQoNjMsIDQ2OTEgLSAyMjUwIC0gNjQwIC0gNTA1IC0gNjAwKTsgLy8gc3VuZGVyLCBjb3IsIGZmLCBhbm5paFxuICAgIHBsYXllci50YXJnZXQgPSBib3NzO1xuXG4gICAgcmV0dXJuIHBsYXllcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cE1hcDxLLFY+KHNsb3RUb0luZGV4OiBNYXA8SywgbnVtYmVyPiwgbG9va3VwOiBWW10pOiBNYXA8SywgVj4ge1xuICAgIGNvbnN0IHJlcyA9IG5ldyBNYXA8SyxWPigpO1xuXG4gICAgZm9yIChsZXQgW3Nsb3QsIGlkeF0gb2Ygc2xvdFRvSW5kZXgpIHtcbiAgICAgICAgaWYgKGxvb2t1cFtpZHhdKSB7XG4gICAgICAgICAgICByZXMuc2V0KHNsb3QsIGxvb2t1cFtpZHhdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgaW5kZXgnLCBpZHgsIGxvb2t1cCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9va3VwQXJyYXk8Vj4oaW5kaWNlczogbnVtYmVyW10sIGxvb2t1cDogVltdKTogVltdIHtcbiAgICBjb25zdCByZXM6IFZbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaWR4IG9mIGluZGljZXMpIHtcbiAgICAgICAgaWYgKGxvb2t1cFtpZHhdKSB7XG4gICAgICAgICAgICByZXMucHVzaChsb29rdXBbaWR4XSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnYmFkIGluZGV4JywgaWR4LCBsb29rdXApO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBJdGVtcyhtYXA6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPikge1xuICAgIHJldHVybiBsb29rdXBNYXAobWFwLCBpdGVtcyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBFbmNoYW50cyhtYXA6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPikge1xuICAgIHJldHVybiBsb29rdXBNYXAobWFwLCBlbmNoYW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBUZW1wb3JhcnlFbmNoYW50cyhtYXA6IE1hcDxJdGVtU2xvdCwgbnVtYmVyPikge1xuICAgIHJldHVybiBsb29rdXBNYXAobWFwLCB0ZW1wb3JhcnlFbmNoYW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb29rdXBCdWZmcyhpbmRpY2VzOiBudW1iZXJbXSkge1xuICAgIHJldHVybiBsb29rdXBBcnJheShpbmRpY2VzLCBidWZmcyk7XG59XG4iLCJpbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBJdGVtRGVzY3JpcHRpb24sIEl0ZW1TbG90IH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uLCBQbGF5ZXIsIFJhY2UsIERhbWFnZUxvZyB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgc2V0dXBQbGF5ZXIgfSBmcm9tIFwiLi9zaW11bGF0aW9uX3V0aWxzLmpzXCI7XG5pbXBvcnQgeyBFbmNoYW50RGVzY3JpcHRpb24gfSBmcm9tIFwiLi9kYXRhL2VuY2hhbnRzLmpzXCI7XG5cbmV4cG9ydCB0eXBlIEl0ZW1XaXRoU2xvdCA9IFtJdGVtRGVzY3JpcHRpb24sIEl0ZW1TbG90XTtcblxuLy8gVE9ETyAtIGNoYW5nZSB0aGlzIGludGVyZmFjZSBzbyB0aGF0IENob29zZUFjdGlvbiBjYW5ub3Qgc2NyZXcgdXAgdGhlIHNpbSBvciBjaGVhdFxuLy8gZS5nLiBDaG9vc2VBY3Rpb24gc2hvdWxkbid0IGNhc3Qgc3BlbGxzIGF0IGEgY3VycmVudCB0aW1lXG5leHBvcnQgdHlwZSBDaG9vc2VBY3Rpb24gPSAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlciwgY2FuRXhlY3V0ZTogYm9vbGVhbikgPT4gbnVtYmVyO1xuXG5leHBvcnQgY29uc3QgRVhFQ1VURV9QSEFTRV9SQVRJTyA9IDAuMTU7IC8vIGxhc3QgMTUlIG9mIHRoZSB0aW1lIGlzIGV4ZWN1dGUgcGhhc2VcblxuY2xhc3MgRmlnaHQge1xuICAgIHBsYXllcjogUGxheWVyO1xuICAgIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uO1xuICAgIGZpZ2h0TGVuZ3RoOiBudW1iZXI7XG4gICAgZHVyYXRpb24gPSAwO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24+LCBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCB0ZW1wb3JhcnlFbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCBidWZmczogQnVmZltdLCBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbiwgZmlnaHRMZW5ndGggPSA2MCwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBzZXR1cFBsYXllcihyYWNlLCBzdGF0cywgZXF1aXBtZW50LCBlbmNoYW50cywgdGVtcG9yYXJ5RW5jaGFudHMsIGJ1ZmZzLCBsb2cpO1xuICAgICAgICB0aGlzLmNob29zZUFjdGlvbiA9IGNob29zZUFjdGlvbjtcbiAgICAgICAgdGhpcy5maWdodExlbmd0aCA9IChmaWdodExlbmd0aCArIE1hdGgucmFuZG9tKCkgKiA0IC0gMikgKiAxMDAwO1xuICAgIH1cblxuICAgIHJ1bigpOiBQcm9taXNlPEZpZ2h0UmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZiwgcikgPT4ge1xuICAgICAgICAgICAgd2hpbGUgKHRoaXMuZHVyYXRpb24gPD0gdGhpcy5maWdodExlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGYoe1xuICAgICAgICAgICAgICAgIGRhbWFnZUxvZzogdGhpcy5wbGF5ZXIuZGFtYWdlTG9nLFxuICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiB0aGlzLmZpZ2h0TGVuZ3RoLFxuICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogdGhpcy5wbGF5ZXIucG93ZXJMb3N0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UocGF1c2U6IGJvb2xlYW4pIHt9XG5cbiAgICBjYW5jZWwoKSB7fVxuXG4gICAgcHJvdGVjdGVkIHVwZGF0ZSgpIHtcbiAgICAgICAgY29uc3QgYmVnaW5FeGVjdXRlVGltZSA9IHRoaXMuZmlnaHRMZW5ndGggKiAoMSAtIEVYRUNVVEVfUEhBU0VfUkFUSU8pO1xuICAgICAgICBjb25zdCBpc0V4ZWN1dGVQaGFzZSA9IHRoaXMuZHVyYXRpb24gPj0gYmVnaW5FeGVjdXRlVGltZTtcblxuICAgICAgICB0aGlzLnBsYXllci5idWZmTWFuYWdlci51cGRhdGUodGhpcy5kdXJhdGlvbik7IC8vIG5lZWQgdG8gY2FsbCB0aGlzIGlmIHRoZSBkdXJhdGlvbiBjaGFuZ2VkIGJlY2F1c2Ugb2YgYnVmZnMgdGhhdCBjaGFuZ2Ugb3ZlciB0aW1lIGxpa2Ugam9tIGdhYmJlclxuXG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uKHRoaXMucGxheWVyLCB0aGlzLmR1cmF0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCBpc0V4ZWN1dGVQaGFzZSk7IC8vIGNob29zZSBhY3Rpb24gYmVmb3JlIGluIGNhc2Ugb2YgYWN0aW9uIGRlcGVuZGluZyBvbiB0aW1lIG9mZiB0aGUgZ2NkIGxpa2UgZWFydGhzdHJpa2VcblxuICAgICAgICB0aGlzLnBsYXllci51cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgLy8gY2hvb3NlIGFjdGlvbiBhZnRlciBldmVyeSBzd2luZyB3aGljaCBjb3VsZCBiZSBhIHJhZ2UgZ2VuZXJhdGluZyBldmVudCwgYnV0IFRPRE86IG5lZWQgdG8gYWNjb3VudCBmb3IgbGF0ZW5jeSwgcmVhY3Rpb24gdGltZSAoYnV0dG9uIG1hc2hpbmcpXG4gICAgICAgIGNvbnN0IHdhaXRpbmdGb3JUaW1lID0gdGhpcy5jaG9vc2VBY3Rpb24odGhpcy5wbGF5ZXIsIHRoaXMuZHVyYXRpb24sIHRoaXMuZmlnaHRMZW5ndGgsIGlzRXhlY3V0ZVBoYXNlKTtcblxuICAgICAgICBsZXQgbmV4dFN3aW5nVGltZSA9IHRoaXMucGxheWVyLm1oIS5uZXh0U3dpbmdUaW1lO1xuXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5vaCkge1xuICAgICAgICAgICAgbmV4dFN3aW5nVGltZSA9IE1hdGgubWluKG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLm9oLm5leHRTd2luZ1RpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IGhhY2tcbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmV4dHJhQXR0YWNrQ291bnQpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IGluY3JlbWVudCBkdXJhdGlvbiAoVE9ETzogYnV0IEkgcmVhbGx5IHNob3VsZCBiZWNhdXNlIHRoZSBzZXJ2ZXIgZG9lc24ndCBsb29wIGluc3RhbnRseSlcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBsYXllci5uZXh0R0NEVGltZSA+IHRoaXMuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBNYXRoLm1pbih0aGlzLnBsYXllci5uZXh0R0NEVGltZSwgbmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIubmV4dE92ZXJUaW1lVXBkYXRlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBNYXRoLm1pbihuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5idWZmTWFuYWdlci5uZXh0T3ZlclRpbWVVcGRhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHdhaXRpbmdGb3JUaW1lIDwgdGhpcy5kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IHdhaXRpbmdGb3JUaW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc0V4ZWN1dGVQaGFzZSAmJiBiZWdpbkV4ZWN1dGVUaW1lIDwgdGhpcy5kdXJhdGlvbikgeyAvLyBub3QgZXhlY3V0ZSBhdCBzdGFydCBvZiB1cGRhdGVcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBiZWdpbkV4ZWN1dGVUaW1lO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBSZWFsdGltZUZpZ2h0IGV4dGVuZHMgRmlnaHQge1xuICAgIHByb3RlY3RlZCBwYXVzZWQgPSBmYWxzZTtcblxuICAgIHJ1bigpOiBQcm9taXNlPEZpZ2h0UmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IE1TX1BFUl9VUERBVEUgPSAxMDAwIC8gNjA7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmLCByKSA9PiB7XG4gICAgICAgICAgICBsZXQgb3ZlcnJpZGVEdXJhdGlvbiA9IDA7XG5cbiAgICAgICAgICAgIGNvbnN0IGxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZHVyYXRpb24gPD0gdGhpcy5maWdodExlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcnJpZGVEdXJhdGlvbiArPSBNU19QRVJfVVBEQVRFO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IG92ZXJyaWRlRHVyYXRpb247XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChsb29wLCBNU19QRVJfVVBEQVRFKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhbWFnZUxvZzogdGhpcy5wbGF5ZXIuZGFtYWdlTG9nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlnaHRMZW5ndGg6IHRoaXMuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3dlckxvc3Q6IHRoaXMucGxheWVyLnBvd2VyTG9zdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGxvb3AsIE1TX1BFUl9VUERBVEUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwYXVzZShwYXVzZTogYm9vbGVhbikge1xuICAgICAgICB0aGlzLnBhdXNlZCA9IHBhdXNlO1xuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgRmlnaHRSZXN1bHQgPSB7IGRhbWFnZUxvZzogRGFtYWdlTG9nLCBmaWdodExlbmd0aDogbnVtYmVyLCBwb3dlckxvc3Q6IG51bWJlcn07XG5cbmV4cG9ydCB0eXBlIFNpbXVsYXRpb25TdW1tYXJ5ID0ge1xuICAgIG5vcm1hbERhbWFnZTogbnVtYmVyLFxuICAgIGV4ZWNEYW1hZ2U6IG51bWJlcixcbiAgICBub3JtYWxEdXJhdGlvbjogbnVtYmVyLFxuICAgIGV4ZWNEdXJhdGlvbjogbnVtYmVyLFxuICAgIHBvd2VyTG9zdDogbnVtYmVyLFxuICAgIGZpZ2h0czogbnVtYmVyLFxufTtcblxuZXhwb3J0IHR5cGUgU3RhdHVzSGFuZGxlciA9IChzdGF0dXM6IFNpbXVsYXRpb25TdW1tYXJ5KSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgU2ltdWxhdGlvbiB7XG4gICAgcmFjZTogUmFjZTtcbiAgICBzdGF0czogU3RhdFZhbHVlcztcbiAgICBlcXVpcG1lbnQ6IE1hcDxJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uPjtcbiAgICBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+O1xuICAgIHRlbXBvcmFyeUVuY2hhbnRzOiBNYXA8SXRlbVNsb3QsIEVuY2hhbnREZXNjcmlwdGlvbj47XG4gICAgYnVmZnM6IEJ1ZmZbXTtcbiAgICBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbjtcbiAgICBwcm90ZWN0ZWQgZmlnaHRMZW5ndGg6IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgcmVhbHRpbWU6IGJvb2xlYW47XG4gICAgbG9nPzogTG9nRnVuY3Rpb25cblxuICAgIHByb3RlY3RlZCByZXF1ZXN0U3RvcCA9IGZhbHNlO1xuICAgIHByb3RlY3RlZCBfcGF1c2VkID0gZmFsc2U7XG5cbiAgICBmaWdodFJlc3VsdHM6IEZpZ2h0UmVzdWx0W10gPSBbXTtcblxuICAgIGN1cnJlbnRGaWdodD86IEZpZ2h0O1xuXG4gICAgcHJvdGVjdGVkIGNhY2hlZFN1bW1tYXJ5OiBTaW11bGF0aW9uU3VtbWFyeSA9IHsgbm9ybWFsRGFtYWdlOiAwLCBleGVjRGFtYWdlOiAwLCBub3JtYWxEdXJhdGlvbjogMCwgZXhlY0R1cmF0aW9uOiAwLCBwb3dlckxvc3Q6IDAsIGZpZ2h0czogMCB9O1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogTWFwPEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24+LCBlbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCB0ZW1wb3JhcnlFbmNoYW50czogTWFwPEl0ZW1TbG90LCBFbmNoYW50RGVzY3JpcHRpb24+LCBidWZmczogQnVmZltdLCBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbiwgZmlnaHRMZW5ndGggPSA2MCwgcmVhbHRpbWUgPSBmYWxzZSwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5yYWNlID0gcmFjZTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IHN0YXRzO1xuICAgICAgICB0aGlzLmVxdWlwbWVudCA9IGVxdWlwbWVudDtcbiAgICAgICAgdGhpcy5lbmNoYW50cyA9IGVuY2hhbnRzO1xuICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnRzID0gdGVtcG9yYXJ5RW5jaGFudHM7XG4gICAgICAgIHRoaXMuYnVmZnMgPSBidWZmcztcbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24gPSBjaG9vc2VBY3Rpb247XG4gICAgICAgIHRoaXMuZmlnaHRMZW5ndGggPSBmaWdodExlbmd0aDtcbiAgICAgICAgdGhpcy5yZWFsdGltZSA9IHJlYWx0aW1lO1xuICAgICAgICB0aGlzLmxvZyA9IGxvZztcbiAgICB9XG5cbiAgICBnZXQgcGF1c2VkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGF1c2VkO1xuICAgIH1cblxuICAgIGdldCBzdGF0dXMoKTogU2ltdWxhdGlvblN1bW1hcnkge1xuICAgICAgICBmb3IgKGxldCBmaWdodFJlc3VsdCBvZiB0aGlzLmZpZ2h0UmVzdWx0cykge1xuICAgICAgICAgICAgY29uc3QgYmVnaW5FeGVjdXRlVGltZSA9IGZpZ2h0UmVzdWx0LmZpZ2h0TGVuZ3RoICogKDEgLSBFWEVDVVRFX1BIQVNFX1JBVElPKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgW3RpbWUsIGRhbWFnZV0gb2YgZmlnaHRSZXN1bHQuZGFtYWdlTG9nKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRpbWUgPj0gYmVnaW5FeGVjdXRlVGltZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRHVyYXRpb24gKz0gYmVnaW5FeGVjdXRlVGltZTtcbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkuZXhlY0R1cmF0aW9uICs9IGZpZ2h0UmVzdWx0LmZpZ2h0TGVuZ3RoIC0gYmVnaW5FeGVjdXRlVGltZTtcbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkucG93ZXJMb3N0ICs9IGZpZ2h0UmVzdWx0LnBvd2VyTG9zdDtcblxuICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5maWdodHMrKztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlnaHRSZXN1bHRzID0gW107XG5cbiAgICAgICAgbGV0IG5vcm1hbERhbWFnZSA9IHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRGFtYWdlO1xuICAgICAgICBsZXQgZXhlY0RhbWFnZSA9IHRoaXMuY2FjaGVkU3VtbW1hcnkuZXhlY0RhbWFnZTtcbiAgICAgICAgbGV0IG5vcm1hbER1cmF0aW9uID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5ub3JtYWxEdXJhdGlvbjtcbiAgICAgICAgbGV0IGV4ZWNEdXJhdGlvbiA9IHRoaXMuY2FjaGVkU3VtbW1hcnkuZXhlY0R1cmF0aW9uO1xuICAgICAgICBsZXQgcG93ZXJMb3N0ID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5wb3dlckxvc3Q7XG4gICAgICAgIGxldCBmaWdodHMgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmZpZ2h0cztcblxuICAgICAgICBpZiAodGhpcy5yZWFsdGltZSAmJiB0aGlzLmN1cnJlbnRGaWdodCkge1xuICAgICAgICAgICAgY29uc3QgYmVnaW5FeGVjdXRlVGltZSA9IHRoaXMuY3VycmVudEZpZ2h0LmZpZ2h0TGVuZ3RoICogKDEgLSBFWEVDVVRFX1BIQVNFX1JBVElPKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgW3RpbWUsIGRhbWFnZV0gb2YgdGhpcy5jdXJyZW50RmlnaHQucGxheWVyLmRhbWFnZUxvZykge1xuICAgICAgICAgICAgICAgIGlmICh0aW1lID49IGJlZ2luRXhlY3V0ZVRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhlY0RhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbm9ybWFsRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vcm1hbER1cmF0aW9uICs9IE1hdGgubWluKGJlZ2luRXhlY3V0ZVRpbWUsIHRoaXMuY3VycmVudEZpZ2h0LmR1cmF0aW9uKTtcbiAgICAgICAgICAgIGV4ZWNEdXJhdGlvbiArPSBNYXRoLm1heCgwLCB0aGlzLmN1cnJlbnRGaWdodC5kdXJhdGlvbiAtIGJlZ2luRXhlY3V0ZVRpbWUpO1xuICAgICAgICAgICAgcG93ZXJMb3N0ICs9IHRoaXMuY3VycmVudEZpZ2h0LnBsYXllci5wb3dlckxvc3Q7XG4gICAgICAgICAgICBmaWdodHMrKztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBub3JtYWxEYW1hZ2U6IG5vcm1hbERhbWFnZSxcbiAgICAgICAgICAgIGV4ZWNEYW1hZ2U6IGV4ZWNEYW1hZ2UsXG4gICAgICAgICAgICBub3JtYWxEdXJhdGlvbjogbm9ybWFsRHVyYXRpb24sXG4gICAgICAgICAgICBleGVjRHVyYXRpb246IGV4ZWNEdXJhdGlvbixcbiAgICAgICAgICAgIHBvd2VyTG9zdDogcG93ZXJMb3N0LFxuICAgICAgICAgICAgZmlnaHRzOiBmaWdodHMsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGFydCgpIHtcbiAgICAgICAgY29uc3QgZmlnaHRDbGFzcyA9IHRoaXMucmVhbHRpbWUgPyBSZWFsdGltZUZpZ2h0IDogRmlnaHQ7XG5cbiAgICAgICAgY29uc3Qgb3V0ZXJsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChvdXRlcmxvb3AsIDEwMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgY291bnQgPSAwO1xuXG4gICAgICAgICAgICBjb25zdCBpbm5lcmxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGNvdW50ID4gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0ID0gbmV3IGZpZ2h0Q2xhc3ModGhpcy5yYWNlLCB0aGlzLnN0YXRzLCB0aGlzLmVxdWlwbWVudCwgdGhpcy5lbmNoYW50cywgdGhpcy50ZW1wb3JhcnlFbmNoYW50cywgdGhpcy5idWZmcywgdGhpcy5jaG9vc2VBY3Rpb24sIHRoaXMuZmlnaHRMZW5ndGgsIHRoaXMucmVhbHRpbWUgPyB0aGlzLmxvZyA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQucnVuKCkudGhlbigocmVzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlnaHRSZXN1bHRzLnB1c2gocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgaW5uZXJsb29wKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCF0aGlzLnJlcXVlc3RTdG9wKSB7XG4gICAgICAgICAgICAgICAgaW5uZXJsb29wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgb3V0ZXJsb29wKCk7XG4gICAgfVxuXG4gICAgcGF1c2UocGF1c2U6IGJvb2xlYW58dW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChwYXVzZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBwYXVzZSA9ICF0aGlzLnBhdXNlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3BhdXNlZCA9IHBhdXNlO1xuICAgICAgICBpZiAodGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0LnBhdXNlKHBhdXNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMucmVxdWVzdFN0b3AgPSB0cnVlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFdhcnJpb3IgfSBmcm9tIFwiLi93YXJyaW9yXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXJcIjtcbmltcG9ydCB7IFNwZWxsQnVmZiB9IGZyb20gXCIuL3NwZWxsXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUNob29zZUFjdGlvbihoZXJvaWNTdHJpa2VSYWdlUmVxOiBudW1iZXIsIGhhbXN0cmluZ1JhZ2VSZXE6IG51bWJlciwgYmxvb2R0aGlyc3RFeGVjUmFnZUxpbWl0OiBudW1iZXIpIHtcbiAgICByZXR1cm4gKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXIsIGV4ZWN1dGVQaGFzZTogYm9vbGVhbik6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IHdhcnJpb3IgPSA8V2Fycmlvcj5wbGF5ZXI7XG4gICAgXG4gICAgICAgIGNvbnN0IHRpbWVSZW1haW5pbmdTZWNvbmRzID0gKGZpZ2h0TGVuZ3RoIC0gdGltZSkgLyAxMDAwO1xuXG4gICAgICAgIGxldCB3YWl0aW5nRm9yVGltZSA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblxuICAgICAgICAvLyBUT0RPIC0gd2hhdCBhYm91dCBHQ0Qgc3BlbGxzIHdoZXJlIHlvdSBzaG91bGQgcG9wIHRoZW0gYmVmb3JlIGZpZ2h0PyBsaWtlIGRpYW1vbmQgZmxhc2sgb24gdmFlbFxuICAgICAgICAvLyBuZWVkIHRvIGFkZCBhIHN0ZXAgZm9yIHByZSBmaWdodCBhY3Rpb25zLCBtYXliZSBjaG9vc2UgYWN0aW9uIHNob3VsZCBiZSBhYmxlIHRvIHdvcmsgb24gbmVnYXRpdmUgZmlnaHQgdGltZVxuICAgICAgICBmb3IgKGxldCBbXywgaXRlbV0gb2YgcGxheWVyLml0ZW1zKSB7XG4gICAgICAgICAgICBpZiAoaXRlbS5vbnVzZSAmJiBpdGVtLm9udXNlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXRlbS5vbnVzZS5zcGVsbCBpbnN0YW5jZW9mIFNwZWxsQnVmZikge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGltZVJlbWFpbmluZ1NlY29uZHMgPD0gaXRlbS5vbnVzZS5zcGVsbC5idWZmLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLm9udXNlLmNhc3QodGltZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IE1hdGgubWluKHdhaXRpbmdGb3JUaW1lLCBmaWdodExlbmd0aCAtIGl0ZW0ub251c2Uuc3BlbGwuYnVmZi5kdXJhdGlvbiAqIDEwMDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXG4gICAgICAgIGlmICh3YXJyaW9yLnJhZ2UgPCAzMCAmJiB3YXJyaW9yLmJsb29kUmFnZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICB3YXJyaW9yLmJsb29kUmFnZS5jYXN0KHRpbWUpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIC8vIGdjZCBzcGVsbHNcbiAgICAgICAgaWYgKHdhcnJpb3IubmV4dEdDRFRpbWUgPD0gdGltZSkge1xuICAgICAgICAgICAgaWYgKHdhcnJpb3IuZGVhdGhXaXNoLmNhbkNhc3QodGltZSkgJiZcbiAgICAgICAgICAgICAgICAodGltZVJlbWFpbmluZ1NlY29uZHMgPD0gMzBcbiAgICAgICAgICAgICAgICB8fCAodGltZVJlbWFpbmluZ1NlY29uZHMgLSB3YXJyaW9yLmRlYXRoV2lzaC5zcGVsbC5jb29sZG93bikgPiAzMCkpIHsgLy8gY291bGQgYmUgdGltZWQgYmV0dGVyXG4gICAgICAgICAgICAgICAgd2Fycmlvci5kZWF0aFdpc2guY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXhlY3V0ZVBoYXNlICYmIHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FuQ2FzdCh0aW1lKSAmJiB3YXJyaW9yLnJhZ2UgPCBibG9vZHRoaXJzdEV4ZWNSYWdlTGltaXQpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmJsb29kdGhpcnN0LmNhc3QodGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChleGVjdXRlUGhhc2UgJiYgd2Fycmlvci5leGVjdXRlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmV4ZWN1dGUuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5ibG9vZHRoaXJzdC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LnRpbWVSZW1haW5pbmcodGltZSkgPCAxLjUgKyAod2Fycmlvci5sYXRlbmN5IC8gMTAwMCkpIHtcbiAgICAgICAgICAgICAgICAvLyBub3Qgb3IgYWxtb3N0IG9mZiBjb29sZG93biwgd2FpdCBmb3IgcmFnZSBvciBjb29sZG93blxuICAgICAgICAgICAgICAgIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LmNvb2xkb3duID4gdGltZSkge1xuICAgICAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IE1hdGgubWluKHdhaXRpbmdGb3JUaW1lLCB3YXJyaW9yLmJsb29kdGhpcnN0LmNvb2xkb3duKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLndoaXJsd2luZC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLndoaXJsd2luZC50aW1lUmVtYWluaW5nKHRpbWUpIDwgMS41ICsgKHdhcnJpb3IubGF0ZW5jeSAvIDEwMDApKSB7XG4gICAgICAgICAgICAgICAgLy8gbm90IG9yIGFsbW9zdCBvZmYgY29vbGRvd24sIHdhaXQgZm9yIHJhZ2Ugb3IgY29vbGRvd25cbiAgICAgICAgICAgICAgICBpZiAod2Fycmlvci53aGlybHdpbmQuY29vbGRvd24gPiB0aW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gTWF0aC5taW4od2FpdGluZ0ZvclRpbWUsIHdhcnJpb3Iud2hpcmx3aW5kLmNvb2xkb3duKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IucmFnZSA+PSBoYW1zdHJpbmdSYWdlUmVxICYmIHdhcnJpb3IuaGFtc3RyaW5nLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmhhbXN0cmluZy5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXG4gICAgICAgIGlmICghZXhlY3V0ZVBoYXNlICYmIHdhcnJpb3IucmFnZSA+PSBoZXJvaWNTdHJpa2VSYWdlUmVxICYmICF3YXJyaW9yLnF1ZXVlZFNwZWxsKSB7XG4gICAgICAgICAgICB3YXJyaW9yLnF1ZXVlZFNwZWxsID0gd2Fycmlvci5oZXJvaWNTdHJpa2U7XG4gICAgICAgICAgICBpZiAod2Fycmlvci5sb2cpIHdhcnJpb3IubG9nKHRpbWUsICdxdWV1ZWluZyBoZXJvaWMgc3RyaWtlJyk7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgcmV0dXJuIHdhaXRpbmdGb3JUaW1lO1xuICAgIH07XG59XG4iLCJpbXBvcnQgeyAgTWFpblRocmVhZEludGVyZmFjZSB9IGZyb20gXCIuL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UuanNcIjtcbmltcG9ydCB7IFNpbXVsYXRpb24gfSBmcm9tIFwiLi9zaW11bGF0aW9uLmpzXCI7XG5pbXBvcnQgeyBTaW11bGF0aW9uRGVzY3JpcHRpb24sIGxvb2t1cEl0ZW1zLCBsb29rdXBCdWZmcywgbG9va3VwRW5jaGFudHMsIGxvb2t1cFRlbXBvcmFyeUVuY2hhbnRzIH0gZnJvbSBcIi4vc2ltdWxhdGlvbl91dGlscy5qc1wiO1xuaW1wb3J0IHsgTG9nRnVuY3Rpb24gfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IGdlbmVyYXRlQ2hvb3NlQWN0aW9uIH0gZnJvbSBcIi4vd2Fycmlvcl9haS5qc1wiO1xuXG5jb25zdCBtYWluVGhyZWFkSW50ZXJmYWNlID0gTWFpblRocmVhZEludGVyZmFjZS5pbnN0YW5jZTtcblxubGV0IGN1cnJlbnRTaW06IFNpbXVsYXRpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5tYWluVGhyZWFkSW50ZXJmYWNlLmFkZEV2ZW50TGlzdGVuZXIoJ3NpbXVsYXRlJywgKGRhdGE6IGFueSkgPT4ge1xuICAgIGNvbnN0IHNpbWRlc2MgPSA8U2ltdWxhdGlvbkRlc2NyaXB0aW9uPmRhdGE7XG5cbiAgICBsZXQgbG9nRnVuY3Rpb246IExvZ0Z1bmN0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAgIGlmIChzaW1kZXNjLnJlYWx0aW1lKSB7XG4gICAgICAgIGxvZ0Z1bmN0aW9uID0gKHRpbWU6IG51bWJlciwgdGV4dDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBtYWluVGhyZWFkSW50ZXJmYWNlLnNlbmQoJ2xvZycsIHtcbiAgICAgICAgICAgICAgICB0aW1lOiB0aW1lLFxuICAgICAgICAgICAgICAgIHRleHQ6IHRleHRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGN1cnJlbnRTaW0gPSBuZXcgU2ltdWxhdGlvbihzaW1kZXNjLnJhY2UsIHNpbWRlc2Muc3RhdHMsXG4gICAgICAgIGxvb2t1cEl0ZW1zKHNpbWRlc2MuZXF1aXBtZW50KSxcbiAgICAgICAgbG9va3VwRW5jaGFudHMoc2ltZGVzYy5lbmNoYW50cyksXG4gICAgICAgIGxvb2t1cFRlbXBvcmFyeUVuY2hhbnRzKHNpbWRlc2MudGVtcG9yYXJ5RW5jaGFudHMpLFxuICAgICAgICBsb29rdXBCdWZmcyhzaW1kZXNjLmJ1ZmZzKSxcbiAgICAgICAgZ2VuZXJhdGVDaG9vc2VBY3Rpb24oc2ltZGVzYy5oZXJvaWNTdHJpa2VSYWdlUmVxLCBzaW1kZXNjLmhhbXN0cmluZ1JhZ2VSZXEsIHNpbWRlc2MuYmxvb2R0aGlyc3RFeGVjUmFnZUxpbWl0KSxcbiAgICAgICAgc2ltZGVzYy5maWdodExlbmd0aCwgc2ltZGVzYy5yZWFsdGltZSwgbG9nRnVuY3Rpb24pO1xuXG4gICAgY3VycmVudFNpbS5zdGFydCgpO1xuXG4gICAgc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBpZiAoY3VycmVudFNpbSAmJiAhY3VycmVudFNpbS5wYXVzZWQpIHtcbiAgICAgICAgICAgIG1haW5UaHJlYWRJbnRlcmZhY2Uuc2VuZCgnc3RhdHVzJywgY3VycmVudFNpbSEuc3RhdHVzKTtcbiAgICAgICAgfVxuICAgIH0sIDUwMCk7XG59KTtcblxubWFpblRocmVhZEludGVyZmFjZS5hZGRFdmVudExpc3RlbmVyKCdwYXVzZScsIChwYXVzZTogYm9vbGVhbnx1bmRlZmluZWQpID0+IHtcbiAgICBpZiAoY3VycmVudFNpbSkge1xuICAgICAgICBjdXJyZW50U2ltLnBhdXNlKHBhdXNlKTtcbiAgICB9XG59KTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxNQUFNLG9CQUFvQjtJQUd0QixZQUFZLE1BQVc7UUFGdkIsbUJBQWMsR0FBdUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUczRCxNQUFNLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBTztZQUN2QixNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FB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
