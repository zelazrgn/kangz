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
    constructor(buff, is_gcd, cost, cooldown) {
        super(`SpellBuff(${buff.name})`, SpellType.BUFF, SpellFamily.NONE, !!is_gcd, cost || 0, cooldown || 0, (player, time) => {
            player.buffManager.add(buff, time);
        });
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
class TemporaryWeaponEnchant {
    constructor(stats, proc) {
        this.stats = stats;
        this.proc = proc;
    }
}
class WeaponEquiped extends ItemEquiped {
    constructor(item, player) {
        super(item, player);
        this.procs = [];
        this.weapon = item;
        if (item.onhit) {
            this.addProc(item.onhit);
        }
        this.player = player;
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
    equip(item, slot) {
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
        if (isWeapon(item)) {
            this.items.set(slot, new WeaponEquiped(item, this));
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
        if (spell && spell.type == SpellType.PHYSICAL) {
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
        const skillBonus = 0.04 * (this.calculateWeaponSkillValue(is_mh, spell) - victim.maxSkillForLevel);
        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;
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
const crusaderBuffMHProc = new Proc(new SpellBuff(new Buff("Crusader MH", 15, new Stats({ str: 100 }))), { ppm: 1 });
const crusaderBuffOHProc = new Proc(new SpellBuff(new Buff("Crusader OH", 15, new Stats({ str: 100 }))), { ppm: 1 });
const denseDamageStone = new TemporaryWeaponEnchant({ plusDamage: 8 });
const windfuryEnchant = new TemporaryWeaponEnchant(undefined, new Proc([
    new ExtraAttack("Windfury Totem", 1),
    new SpellBuff(new Buff("Windfury Totem", 1.5, { ap: 315 }))
], { chance: 0.2 }));

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
        name: "Don Julio's Band",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { crit: 1, hit: 1, ap: 16 }
    },
    {
        name: "Quick Strike Ring",
        slot: ItemSlot.RING1 | ItemSlot.RING2,
        stats: { ap: 30, crit: 1, str: 5 }
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
        name: "Badge of the Swarmguard",
        slot: ItemSlot.TRINKET1 | ItemSlot.TRINKET2,
        onuse: (() => {
            const insightOfTheQiraji = new Buff("Insight of the Qiraji", 30, { armorPenetration: 200 }, true, 0, 6);
            const badgeBuff = new SpellBuff(new BuffProc("Badge of the Swarmguard", 30, new Proc(new SpellBuff(insightOfTheQiraji), { ppm: 15 }), insightOfTheQiraji), false, 0, 3 * 60);
            return badgeBuff;
        })()
    }
].sort((a, b) => {
    return a.name.localeCompare(b.name);
});

function setupPlayer(race, stats, equipment, buffs, log) {
    const player = new Warrior(race, stats, log);
    for (let [item, slot] of equipment) {
        player.equip(item, slot);
    }
    for (let buff of buffs) {
        player.buffManager.add(buff, 0);
    }
    player.mh.addProc(crusaderBuffMHProc);
    player.mh.temporaryEnchant = race === Race.ORC ? windfuryEnchant : denseDamageStone;
    if (player.oh) {
        player.oh.addProc(crusaderBuffOHProc);
        player.oh.temporaryEnchant = denseDamageStone;
    }
    const boss = new Unit(63, 4691 - 2250 - 640 - 505 - 600);
    player.target = boss;
    return player;
}
function equipmentIndicesToItem(equipment) {
    const res = [];
    for (let [idx, slot] of equipment) {
        if (items[idx]) {
            res.push([items[idx], slot]);
        }
        else {
            console.log('bad item index', idx);
        }
    }
    return res;
}
function buffIndicesToBuff(buffIndices) {
    const res = [];
    for (let idx of buffIndices) {
        if (buffs[idx]) {
            res.push(buffs[idx]);
        }
        else {
            console.log('bad buff index', idx);
        }
    }
    return res;
}

const EXECUTE_PHASE_RATIO = 0.15;
class Fight {
    constructor(race, stats, equipment, buffs, chooseAction, fightLength = 60, log) {
        this.duration = 0;
        this.player = setupPlayer(race, stats, equipment, buffs, log);
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
        if (waitingForTime && waitingForTime < this.duration) {
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
    constructor(race, stats, equipment, buffs, chooseAction, fightLength = 60, realtime = false, log) {
        this.requestStop = false;
        this._paused = false;
        this.fightResults = [];
        this.cachedSummmary = { normalDamage: 0, execDamage: 0, normalDuration: 0, execDuration: 0, powerLost: 0, fights: 0 };
        this.race = race;
        this.stats = stats;
        this.equipment = equipment;
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
                this.currentFight = new fightClass(this.race, this.stats, this.equipment, this.buffs, this.chooseAction, this.fightLength, this.realtime ? this.log : undefined);
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
        const useItemByName = (slot, name) => {
            const item = player.items.get(slot);
            if (item && item.item.name === name && item.onuse && item.onuse.canCast(time)) {
                return item.onuse.cast(time);
            }
        };
        if (warrior.rage < 30 && warrior.bloodRage.canCast(time)) {
            warrior.bloodRage.cast(time);
        }
        let waitingForTime;
        if (warrior.nextGCDTime <= time) {
            if (warrior.deathWish.canCast(time) &&
                (timeRemainingSeconds <= 30
                    || (timeRemainingSeconds - warrior.deathWish.spell.cooldown) > 30)) {
                warrior.deathWish.cast(time);
                useItemByName(ItemSlot.TRINKET1, "Badge of the Swarmguard");
                useItemByName(ItemSlot.TRINKET2, "Badge of the Swarmguard");
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
                    waitingForTime = warrior.bloodthirst.cooldown;
                }
            }
            else if (warrior.whirlwind.canCast(time)) {
                warrior.whirlwind.cast(time);
            }
            else if (warrior.whirlwind.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                if (warrior.whirlwind.cooldown > time) {
                    waitingForTime = warrior.whirlwind.cooldown;
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
    currentSim = new Simulation(simdesc.race, simdesc.stats, equipmentIndicesToItem(simdesc.equipment), buffIndicesToBuff(simdesc.buffs), generateChooseAction(simdesc.heroicStrikeRageReq, simdesc.hamstringRageReq, simdesc.bloodthirstExecRageLimit), simdesc.fightLength, simdesc.realtime, logFunction);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3BlbGwudHMiLCIuLi9zcmMvaXRlbS50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL3NwZWxscy50cyIsIi4uL3NyYy9kYXRhL2l0ZW1zLnRzIiwiLi4vc3JjL3NpbXVsYXRpb25fdXRpbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbi50cyIsIi4uL3NyYy93YXJyaW9yX2FpLnRzIiwiLi4vc3JjL3J1bl9zaW11bGF0aW9uX3dvcmtlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFdvcmtlckV2ZW50TGlzdGVuZXIgPSAoZGF0YTogYW55KSA9PiB2b2lkO1xuXG5jbGFzcyBXb3JrZXJFdmVudEludGVyZmFjZSB7XG4gICAgZXZlbnRMaXN0ZW5lcnM6IE1hcDxzdHJpbmcsIFdvcmtlckV2ZW50TGlzdGVuZXJbXT4gPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3Rvcih0YXJnZXQ6IGFueSkge1xuICAgICAgICB0YXJnZXQub25tZXNzYWdlID0gKGV2OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldi5kYXRhLmV2ZW50KSB8fCBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcihldi5kYXRhLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IFdvcmtlckV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRMaXN0ZW5lcnMuaGFzKGV2ZW50KSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpIS5wdXNoKGxpc3RlbmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMuc2V0KGV2ZW50LCBbbGlzdGVuZXJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXJUb1JlbW92ZTogV29ya2VyRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBpZiAodGhpcy5ldmVudExpc3RlbmVycy5oYXMoZXZlbnQpKSB7XG4gICAgICAgICAgICBsZXQgZXZlbnRMaXN0ZW5lcnNGb3JFdmVudCA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMuZ2V0KGV2ZW50KTtcbiAgICAgICAgICAgIGlmIChldmVudExpc3RlbmVyc0ZvckV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5zZXQoZXZlbnQsIGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQuZmlsdGVyKChsaXN0ZW5lcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGlzdGVuZXIgIT09IGxpc3RlbmVyVG9SZW1vdmU7XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnNGb3JFdmVudChldmVudDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMuZGVsZXRlKGV2ZW50KTtcbiAgICB9XG5cbiAgICBzZW5kKGV2ZW50OiBzdHJpbmcsIGRhdGE6IGFueSwgdGFyZ2V0OiBhbnkgPSBzZWxmKSB7XG4gICAgICAgIHRhcmdldC5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtlckludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHdvcmtlcjogV29ya2VyO1xuXG4gICAgY29uc3RydWN0b3IodXJsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3Qgd29ya2VyID0gbmV3IFdvcmtlcih1cmwpOy8vLCB7dHlwZTogJ21vZHVsZSd9KTsgY2FuJ3QgdXNlIHRoaXMgeWV0IGh0dHBzOi8vY3JidWcuY29tLzY4MDA0NlxuICAgICAgICBzdXBlcih3b3JrZXIpO1xuXG4gICAgICAgIHRoaXMud29ya2VyID0gd29ya2VyO1xuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55KSB7XG4gICAgICAgIHN1cGVyLnNlbmQoZXZlbnQsIGRhdGEsIHRoaXMud29ya2VyKTtcbiAgICB9XG5cbiAgICB0ZXJtaW5hdGUoKSB7XG4gICAgICAgIHRoaXMud29ya2VyLnRlcm1pbmF0ZSgpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRJbnRlcmZhY2UgZXh0ZW5kcyBXb3JrZXJFdmVudEludGVyZmFjZSB7XG4gICAgcHJpdmF0ZSBzdGF0aWMgX2luc3RhbmNlOiBNYWluVGhyZWFkSW50ZXJmYWNlO1xuXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoc2VsZik7XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBpbnN0YW5jZSgpIHtcbiAgICAgICAgaWYgKCFNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSkge1xuICAgICAgICAgICAgTWFpblRocmVhZEludGVyZmFjZS5faW5zdGFuY2UgPSBuZXcgTWFpblRocmVhZEludGVyZmFjZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBQbGF5ZXIsIE1lbGVlSGl0T3V0Y29tZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFdlYXBvbkRlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuXG5leHBvcnQgZW51bSBTcGVsbEZhbWlseSB7XG4gICAgTk9ORSxcbiAgICBXQVJSSU9SLFxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGwge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICB0eXBlOiBTcGVsbFR5cGU7XG4gICAgZmFtaWx5OiBTcGVsbEZhbWlseTtcbiAgICBpc19nY2Q6IGJvb2xlYW47XG4gICAgY29zdDogbnVtYmVyO1xuICAgIGNvb2xkb3duOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHNwZWxsRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQ7XG5cbiAgICBjYW5Qcm9jID0gdHJ1ZTtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgdHlwZTogU3BlbGxUeXBlLCBmYW1pbHk6IFNwZWxsRmFtaWx5LCBpc19nY2Q6IGJvb2xlYW4sIGNvc3Q6IG51bWJlciwgY29vbGRvd246IG51bWJlciwgc3BlbGxGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZCkge1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgICAgICB0aGlzLmZhbWlseSA9IGZhbWlseTtcbiAgICAgICAgdGhpcy5jb3N0ID0gY29zdDtcbiAgICAgICAgdGhpcy5jb29sZG93biA9IGNvb2xkb3duO1xuICAgICAgICB0aGlzLmlzX2djZCA9IGlzX2djZDtcbiAgICAgICAgdGhpcy5zcGVsbEYgPSBzcGVsbEY7XG4gICAgfVxuXG4gICAgY2FzdChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNwZWxsRihwbGF5ZXIsIHRpbWUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFNwZWxsO1xuICAgIGNvb2xkb3duID0gMDtcbiAgICBjYXN0ZXI6IFBsYXllcjtcblxuICAgIGNvbnN0cnVjdG9yKHNwZWxsOiBTcGVsbCwgY2FzdGVyOiBQbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zcGVsbCA9IHNwZWxsO1xuICAgICAgICB0aGlzLmNhc3RlciA9IGNhc3RlcjtcbiAgICB9XG5cbiAgICBvbkNvb2xkb3duKHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5jb29sZG93biA+IHRpbWU7XG4gICAgfVxuXG4gICAgdGltZVJlbWFpbmluZyh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsICh0aGlzLmNvb2xkb3duIC0gdGltZSkgLyAxMDAwKTtcbiAgICB9XG5cbiAgICBjYW5DYXN0KHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAodGhpcy5zcGVsbC5pc19nY2QgJiYgdGhpcy5jYXN0ZXIubmV4dEdDRFRpbWUgPiB0aW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zcGVsbC5jb3N0ID4gdGhpcy5jYXN0ZXIucG93ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9uQ29vbGRvd24odGltZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNhc3QodGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdGhpcy5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zcGVsbC5pc19nY2QpIHtcbiAgICAgICAgICAgIHRoaXMuY2FzdGVyLm5leHRHQ0RUaW1lID0gdGltZSArIDE1MDAgKyB0aGlzLmNhc3Rlci5sYXRlbmN5OyAvLyBUT0RPIC0gbmVlZCB0byBzdHVkeSB0aGUgZWZmZWN0cyBvZiBsYXRlbmN5IGluIHRoZSBnYW1lIGFuZCBjb25zaWRlciBodW1hbiBwcmVjaXNpb25cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5jYXN0ZXIucG93ZXIgLT0gdGhpcy5zcGVsbC5jb3N0O1xuXG4gICAgICAgIHRoaXMuc3BlbGwuY2FzdCh0aGlzLmNhc3RlciwgdGltZSk7XG5cbiAgICAgICAgdGhpcy5jb29sZG93biA9IHRpbWUgKyB0aGlzLnNwZWxsLmNvb2xkb3duICogMTAwMCArIHRoaXMuY2FzdGVyLmxhdGVuY3k7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3dpbmdTcGVsbCBleHRlbmRzIFNwZWxsIHtcbiAgICBib251c0RhbWFnZTogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBmYW1pbHk6IFNwZWxsRmFtaWx5LCBib251c0RhbWFnZTogbnVtYmVyLCBjb3N0OiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgZmFtaWx5LCBmYWxzZSwgY29zdCwgMCwgKCkgPT4ge30pO1xuICAgICAgICB0aGlzLmJvbnVzRGFtYWdlID0gYm9udXNEYW1hZ2U7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTGVhcm5lZFN3aW5nU3BlbGwgZXh0ZW5kcyBMZWFybmVkU3BlbGwge1xuICAgIHNwZWxsOiBTd2luZ1NwZWxsO1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKHNwZWxsOiBTd2luZ1NwZWxsLCBjYXN0ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlcihzcGVsbCwgY2FzdGVyKTtcbiAgICAgICAgdGhpcy5zcGVsbCA9IHNwZWxsOyAvLyBUT0RPIC0gaXMgdGhlcmUgYSB3YXkgdG8gYXZvaWQgdGhpcyBsaW5lP1xuICAgIH1cbn1cblxuZXhwb3J0IGVudW0gU3BlbGxUeXBlIHtcbiAgICBOT05FLFxuICAgIEJVRkYsXG4gICAgUEhZU0lDQUwsXG4gICAgUEhZU0lDQUxfV0VBUE9OLFxufVxuXG5leHBvcnQgdHlwZSBTcGVsbEhpdE91dGNvbWVDYWxsYmFjayA9IChwbGF5ZXI6IFBsYXllciwgaGl0T3V0Y29tZTogTWVsZWVIaXRPdXRjb21lKSA9PiB2b2lkO1xuXG5leHBvcnQgY2xhc3MgU3BlbGxEYW1hZ2UgZXh0ZW5kcyBTcGVsbCB7XG4gICAgY2FsbGJhY2s/OiBTcGVsbEhpdE91dGNvbWVDYWxsYmFjaztcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgYW1vdW50OiBudW1iZXJ8KChwbGF5ZXI6IFBsYXllcikgPT4gbnVtYmVyKSwgdHlwZTogU3BlbGxUeXBlLCBmYW1pbHk6IFNwZWxsRmFtaWx5LCBpc19nY2QgPSBmYWxzZSwgY29zdCA9IDAsIGNvb2xkb3duID0gMCwgY2FsbGJhY2s/OiBTcGVsbEhpdE91dGNvbWVDYWxsYmFjaykge1xuICAgICAgICBzdXBlcihuYW1lLCB0eXBlLCBmYW1pbHksIGlzX2djZCwgY29zdCwgY29vbGRvd24sIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkbWcgPSAodHlwZW9mIGFtb3VudCA9PT0gXCJudW1iZXJcIikgPyBhbW91bnQgOiBhbW91bnQocGxheWVyKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTCB8fCB0eXBlID09PSBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OKSB7XG4gICAgICAgICAgICAgICAgcGxheWVyLmRlYWxNZWxlZURhbWFnZSh0aW1lLCBkbWcsIHBsYXllci50YXJnZXQhLCB0cnVlLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEl0ZW1TcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsRGFtYWdlIHtcbiAgICBjYW5Qcm9jID0gZmFsc2U7IC8vIFRPRE8gLSBjb25maXJtIHRoaXMgaXMgYmxpenpsaWtlLCBhbHNvIHNvbWUgaXRlbSBwcm9jcyBtYXkgYmUgYWJsZSB0byBwcm9jIGJ1dCBvbiBMSCBjb3JlLCBmYXRhbCB3b3VuZCBjYW4ndFxuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlcnwoKHBsYXllcjogUGxheWVyKSA9PiBudW1iZXIpLCB0eXBlOiBTcGVsbFR5cGUpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgYW1vdW50LCB0eXBlLCBTcGVsbEZhbWlseS5OT05FKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRyYUF0dGFjayBleHRlbmRzIFNwZWxsIHtcbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGNvdW50OiBudW1iZXIpIHtcbiAgICAgICAgLy8gc3BlbGx0eXBlIGRvZXNuJ3QgbWF0dGVyXG4gICAgICAgIHN1cGVyKG5hbWUsIFNwZWxsVHlwZS5OT05FLCBTcGVsbEZhbWlseS5OT05FLCBmYWxzZSwgMCwgMCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGlmIChwbGF5ZXIuZXh0cmFBdHRhY2tDb3VudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBsYXllci5leHRyYUF0dGFja0NvdW50ICs9IGNvdW50OyAvLyBMSCBjb2RlIGRvZXMgbm90IGFsbG93IG11bHRpcGxlIGF1dG8gYXR0YWNrcyB0byBzdGFjayBpZiB0aGV5IHByb2MgdG9nZXRoZXIuIEJsaXp6bGlrZSBtYXkgYWxsb3cgdGhlbSB0byBzdGFjayBcbiAgICAgICAgICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBHYWluZWQgJHtjb3VudH0gZXh0cmEgYXR0YWNrcyBmcm9tICR7bmFtZX1gKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGxCdWZmIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKGJ1ZmY6IEJ1ZmYsIGlzX2djZD86IGJvb2xlYW4sIGNvc3Q/OiBudW1iZXIsIGNvb2xkb3duPzogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKGBTcGVsbEJ1ZmYoJHtidWZmLm5hbWV9KWAsIFNwZWxsVHlwZS5CVUZGLCBTcGVsbEZhbWlseS5OT05FLCAhIWlzX2djZCwgY29zdCB8fCAwLCBjb29sZG93biB8fCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChidWZmLCB0aW1lKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG50eXBlIHBwbSA9IHtwcG06IG51bWJlcn07XG50eXBlIGNoYW5jZSA9IHtjaGFuY2U6IG51bWJlcn07XG50eXBlIHJhdGUgPSBwcG0gfCBjaGFuY2U7XG5cbmV4cG9ydCBjbGFzcyBQcm9jIHtcbiAgICBwcm90ZWN0ZWQgc3BlbGxzOiBTcGVsbFtdO1xuICAgIHByb3RlY3RlZCByYXRlOiByYXRlO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsIHwgU3BlbGxbXSwgcmF0ZTogcmF0ZSkge1xuICAgICAgICB0aGlzLnNwZWxscyA9IEFycmF5LmlzQXJyYXkoc3BlbGwpID8gc3BlbGwgOiBbc3BlbGxdO1xuICAgICAgICB0aGlzLnJhdGUgPSByYXRlO1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgd2VhcG9uOiBXZWFwb25EZXNjcmlwdGlvbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNoYW5jZSA9ICg8Y2hhbmNlPnRoaXMucmF0ZSkuY2hhbmNlIHx8ICg8cHBtPnRoaXMucmF0ZSkucHBtICogd2VhcG9uLnNwZWVkIC8gNjA7XG5cbiAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPD0gY2hhbmNlKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzcGVsbCBvZiB0aGlzLnNwZWxscykge1xuICAgICAgICAgICAgICAgIHNwZWxsLmNhc3QocGxheWVyLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBQcm9jLCBTcGVsbCwgTGVhcm5lZFNwZWxsIH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcblxuZXhwb3J0IGVudW0gSXRlbVNsb3Qge1xuICAgIE1BSU5IQU5EID0gMSA8PCAwLFxuICAgIE9GRkhBTkQgPSAxIDw8IDEsXG4gICAgVFJJTktFVDEgPSAxIDw8IDIsXG4gICAgVFJJTktFVDIgPSAxIDw8IDMsXG4gICAgSEVBRCA9IDEgPDwgNCxcbiAgICBORUNLID0gMSA8PCA1LFxuICAgIFNIT1VMREVSID0gMSA8PCA2LFxuICAgIEJBQ0sgPSAxIDw8IDcsXG4gICAgQ0hFU1QgPSAxIDw8IDgsXG4gICAgV1JJU1QgPSAxIDw8IDksXG4gICAgSEFORFMgPSAxIDw8IDEwLFxuICAgIFdBSVNUID0gMSA8PCAxMSxcbiAgICBMRUdTID0gMSA8PCAxMixcbiAgICBGRUVUID0gMSA8PCAxMyxcbiAgICBSSU5HMSA9IDEgPDwgMTQsXG4gICAgUklORzIgPSAxIDw8IDE1LFxuICAgIFJBTkdFRCA9IDEgPDwgMTYsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSXRlbURlc2NyaXB0aW9uIHtcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2xvdDogSXRlbVNsb3QsXG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxuICAgIG9udXNlPzogU3BlbGwsXG4gICAgb25lcXVpcD86IFByb2MsXG59XG5cbmV4cG9ydCBlbnVtIFdlYXBvblR5cGUge1xuICAgIE1BQ0UsXG4gICAgU1dPUkQsXG4gICAgQVhFLFxuICAgIERBR0dFUixcbiAgICBNQUNFMkgsXG4gICAgU1dPUkQySCxcbiAgICBBWEUySCxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXZWFwb25EZXNjcmlwdGlvbiBleHRlbmRzIEl0ZW1EZXNjcmlwdGlvbiB7XG4gICAgdHlwZTogV2VhcG9uVHlwZSxcbiAgICBtaW46IG51bWJlcixcbiAgICBtYXg6IG51bWJlcixcbiAgICBzcGVlZDogbnVtYmVyLFxuICAgIG9uaGl0PzogUHJvYyxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzV2VhcG9uKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbik6IGl0ZW0gaXMgV2VhcG9uRGVzY3JpcHRpb24ge1xuICAgIHJldHVybiBcInNwZWVkXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXF1aXBlZFdlYXBvbihpdGVtOiBJdGVtRXF1aXBlZCk6IGl0ZW0gaXMgV2VhcG9uRXF1aXBlZCB7XG4gICAgcmV0dXJuIFwid2VhcG9uXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGNsYXNzIEl0ZW1FcXVpcGVkIHtcbiAgICBpdGVtOiBJdGVtRGVzY3JpcHRpb247XG4gICAgb251c2U/OiBMZWFybmVkU3BlbGw7XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBJdGVtRGVzY3JpcHRpb24sIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuaXRlbSA9IGl0ZW07XG5cbiAgICAgICAgaWYgKGl0ZW0ub251c2UpIHtcbiAgICAgICAgICAgIHRoaXMub251c2UgPSBuZXcgTGVhcm5lZFNwZWxsKGl0ZW0ub251c2UsIHBsYXllcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5vbmVxdWlwKSB7IC8vIFRPRE8sIG1vdmUgdGhpcyB0byBidWZmcHJvYz8gdGhpcyBtYXkgYmUgc2ltcGxlciB0aG91Z2ggc2luY2Ugd2Uga25vdyB0aGUgYnVmZiB3b24ndCBiZSByZW1vdmVkXG4gICAgICAgICAgICBwbGF5ZXIuYWRkUHJvYyhpdGVtLm9uZXF1aXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXNlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy5vbnVzZSkge1xuICAgICAgICAgICAgdGhpcy5vbnVzZS5jYXN0KHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcG9yYXJ5V2VhcG9uRW5jaGFudCB7XG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzO1xuICAgIHByb2M/OiBQcm9jO1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdHM/OiBTdGF0VmFsdWVzLCBwcm9jPzogUHJvYykge1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMucHJvYyA9IHByb2M7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2VhcG9uRXF1aXBlZCBleHRlbmRzIEl0ZW1FcXVpcGVkIHtcbiAgICB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uO1xuICAgIG5leHRTd2luZ1RpbWU6IG51bWJlcjtcbiAgICBwcm9jczogUHJvY1tdID0gW107XG4gICAgcGxheWVyOiBQbGF5ZXI7XG4gICAgdGVtcG9yYXJ5RW5jaGFudD86IFRlbXBvcmFyeVdlYXBvbkVuY2hhbnQ7XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBXZWFwb25EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIoaXRlbSwgcGxheWVyKTtcbiAgICAgICAgdGhpcy53ZWFwb24gPSBpdGVtO1xuICAgICAgICBcbiAgICAgICAgaWYgKGl0ZW0ub25oaXQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkUHJvYyhpdGVtLm9uaGl0KVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG5cbiAgICAgICAgdGhpcy5uZXh0U3dpbmdUaW1lID0gMTAwOyAvLyBUT0RPIC0gbmVlZCB0byByZXNldCB0aGlzIHByb3Blcmx5IGlmIGV2ZXIgd2FudCB0byBzaW11bGF0ZSBmaWdodHMgd2hlcmUgeW91IHJ1biBvdXRcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldCBwbHVzRGFtYWdlKCkge1xuICAgICAgICBpZiAodGhpcy50ZW1wb3JhcnlFbmNoYW50ICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cyAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMucGx1c0RhbWFnZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5wbHVzRGFtYWdlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaW4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5taW4gKyB0aGlzLnBsdXNEYW1hZ2U7XG4gICAgfVxuXG4gICAgZ2V0IG1heCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2VhcG9uLm1heCArIHRoaXMucGx1c0RhbWFnZTtcbiAgICB9XG5cbiAgICBhZGRQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgdGhpcy5wcm9jcy5wdXNoKHApO1xuICAgIH1cblxuICAgIHByb2ModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGZvciAobGV0IHByb2Mgb2YgdGhpcy5wcm9jcykge1xuICAgICAgICAgICAgcHJvYy5ydW4odGhpcy5wbGF5ZXIsIHRoaXMud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdpbmRmdXJ5IHByb2NzIGxhc3RcbiAgICAgICAgaWYgKHRoaXMudGVtcG9yYXJ5RW5jaGFudCAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQucHJvYykge1xuICAgICAgICAgICAgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnByb2MucnVuKHRoaXMucGxheWVyLCB0aGlzLndlYXBvbiwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gdXJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZyYW5kKG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICAgIHJldHVybiBtaW4gKyBNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFtcCh2YWw6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIE1hdGgubWluKG1heCwgTWF0aC5tYXgobWluLCB2YWwpKTtcbn1cblxuY29uc3QgREVCVUdHSU5HID0gZmFsc2U7XG5cbmlmIChERUJVR0dJTkcpIHtcbiAgICAvLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9tYXRoaWFzYnluZW5zLzU2NzA5MTcjZmlsZS1kZXRlcm1pbmlzdGljLW1hdGgtcmFuZG9tLWpzXG4gICAgTWF0aC5yYW5kb20gPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWVkID0gMHgyRjZFMkIxO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAvLyBSb2JlcnQgSmVua2luc+KAmSAzMiBiaXQgaW50ZWdlciBoYXNoIGZ1bmN0aW9uXG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHg3RUQ1NUQxNikgKyAoc2VlZCA8PCAxMikpICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkIF4gMHhDNzYxQzIzQykgXiAoc2VlZCA+Pj4gMTkpKSAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHgxNjU2NjdCMSkgKyAoc2VlZCA8PCA1KSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHhEM0EyNjQ2QykgXiAoc2VlZCA8PCA5KSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHhGRDcwNDZDNSkgKyAoc2VlZCA8PCAzKSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkIF4gMHhCNTVBNEYwOSkgXiAoc2VlZCA+Pj4gMTYpKSAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICByZXR1cm4gKHNlZWQgJiAweEZGRkZGRkYpIC8gMHgxMDAwMDAwMDtcbiAgICAgICAgfTtcbiAgICB9KCkpO1xufVxuIiwiaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcblxuZXhwb3J0IGNsYXNzIFVuaXQge1xuICAgIGxldmVsOiBudW1iZXI7XG4gICAgYXJtb3I6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGxldmVsOiBudW1iZXIsIGFybW9yOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICB0aGlzLmFybW9yID0gYXJtb3I7XG4gICAgfVxuXG4gICAgZ2V0IG1heFNraWxsRm9yTGV2ZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxldmVsICogNTtcbiAgICB9XG5cbiAgICBnZXQgZGVmZW5zZVNraWxsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgIH1cblxuICAgIGdldCBkb2RnZUNoYW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIDU7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQXJtb3JSZWR1Y2VkRGFtYWdlKGRhbWFnZTogbnVtYmVyLCBhdHRhY2tlcjogUGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGFybW9yID0gTWF0aC5tYXgoMCwgdGhpcy5hcm1vciAtIGF0dGFja2VyLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFybW9yUGVuZXRyYXRpb24pO1xuICAgICAgICBcbiAgICAgICAgbGV0IHRtcHZhbHVlID0gMC4xICogYXJtb3IgIC8gKCg4LjUgKiBhdHRhY2tlci5sZXZlbCkgKyA0MCk7XG4gICAgICAgIHRtcHZhbHVlIC89ICgxICsgdG1wdmFsdWUpO1xuXG4gICAgICAgIGNvbnN0IGFybW9yTW9kaWZpZXIgPSBjbGFtcCh0bXB2YWx1ZSwgMCwgMC43NSk7XG5cbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDEsIGRhbWFnZSAtIChkYW1hZ2UgKiBhcm1vck1vZGlmaWVyKSk7XG4gICAgfVxufVxuIiwiZXhwb3J0IGludGVyZmFjZSBTdGF0VmFsdWVzIHtcbiAgICBhcD86IG51bWJlcjtcbiAgICBzdHI/OiBudW1iZXI7XG4gICAgYWdpPzogbnVtYmVyO1xuICAgIGhpdD86IG51bWJlcjtcbiAgICBjcml0PzogbnVtYmVyO1xuICAgIGhhc3RlPzogbnVtYmVyO1xuICAgIHN0YXRNdWx0PzogbnVtYmVyO1xuICAgIGRhbWFnZU11bHQ/OiBudW1iZXI7XG4gICAgYXJtb3JQZW5ldHJhdGlvbj86IG51bWJlcjtcbiAgICBwbHVzRGFtYWdlPzogbnVtYmVyO1xuXG4gICAgc3dvcmRTa2lsbD86IG51bWJlcjtcbiAgICBheGVTa2lsbD86IG51bWJlcjtcbiAgICBtYWNlU2tpbGw/OiBudW1iZXI7XG4gICAgZGFnZ2VyU2tpbGw/OiBudW1iZXI7XG4gICAgc3dvcmQySFNraWxsPzogbnVtYmVyO1xuICAgIGF4ZTJIU2tpbGw/OiBudW1iZXI7XG4gICAgbWFjZTJIU2tpbGw/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBTdGF0cyBpbXBsZW1lbnRzIFN0YXRWYWx1ZXMge1xuICAgIGFwITogbnVtYmVyO1xuICAgIHN0ciE6IG51bWJlcjtcbiAgICBhZ2khOiBudW1iZXI7XG4gICAgaGl0ITogbnVtYmVyO1xuICAgIGNyaXQhOiBudW1iZXI7XG4gICAgaGFzdGUhOiBudW1iZXI7XG4gICAgc3RhdE11bHQhOiBudW1iZXI7XG4gICAgZGFtYWdlTXVsdCE6IG51bWJlcjtcbiAgICBhcm1vclBlbmV0cmF0aW9uITogbnVtYmVyO1xuICAgIHBsdXNEYW1hZ2UhOiBudW1iZXI7XG5cbiAgICBzd29yZFNraWxsITogbnVtYmVyO1xuICAgIGF4ZVNraWxsITogbnVtYmVyO1xuICAgIG1hY2VTa2lsbCE6IG51bWJlcjtcbiAgICBkYWdnZXJTa2lsbCE6IG51bWJlcjtcbiAgICBzd29yZDJIU2tpbGwhOiBudW1iZXI7XG4gICAgYXhlMkhTa2lsbCE6IG51bWJlcjtcbiAgICBtYWNlMkhTa2lsbCE6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKHM/OiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuc2V0KHMpO1xuICAgIH1cblxuICAgIHNldChzPzogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLmFwID0gKHMgJiYgcy5hcCkgfHwgMDtcbiAgICAgICAgdGhpcy5zdHIgPSAocyAmJiBzLnN0cikgfHwgMDtcbiAgICAgICAgdGhpcy5hZ2kgPSAocyAmJiBzLmFnaSkgfHwgMDtcbiAgICAgICAgdGhpcy5oaXQgPSAocyAmJiBzLmhpdCkgfHwgMDtcbiAgICAgICAgdGhpcy5jcml0ID0gKHMgJiYgcy5jcml0KSB8fCAwO1xuICAgICAgICB0aGlzLmhhc3RlID0gKHMgJiYgcy5oYXN0ZSkgfHwgMTtcbiAgICAgICAgdGhpcy5zdGF0TXVsdCA9IChzICYmIHMuc3RhdE11bHQpIHx8IDE7XG4gICAgICAgIHRoaXMuZGFtYWdlTXVsdCA9IChzICYmIHMuZGFtYWdlTXVsdCkgfHwgMTtcbiAgICAgICAgdGhpcy5hcm1vclBlbmV0cmF0aW9uID0gKHMgJiYgcy5hcm1vclBlbmV0cmF0aW9uKSB8fCAwO1xuICAgICAgICB0aGlzLnBsdXNEYW1hZ2UgPSAocyAmJiBzLnBsdXNEYW1hZ2UpIHx8IDA7XG5cbiAgICAgICAgdGhpcy5zd29yZFNraWxsID0gKHMgJiYgcy5zd29yZFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmF4ZVNraWxsID0gKHMgJiYgcy5heGVTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5tYWNlU2tpbGwgPSAocyAmJiBzLm1hY2VTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5kYWdnZXJTa2lsbCA9IChzICYmIHMuZGFnZ2VyU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuc3dvcmQySFNraWxsID0gKHMgJiYgcy5zd29yZDJIU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuYXhlMkhTa2lsbCA9IChzICYmIHMuYXhlMkhTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5tYWNlMkhTa2lsbCA9IChzICYmIHMubWFjZTJIU2tpbGwpIHx8IDA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgYWRkKHM6IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5hcCArPSAocy5hcCB8fCAwKTtcbiAgICAgICAgdGhpcy5zdHIgKz0gKHMuc3RyIHx8IDApO1xuICAgICAgICB0aGlzLmFnaSArPSAocy5hZ2kgfHwgMCk7XG4gICAgICAgIHRoaXMuaGl0ICs9IChzLmhpdCB8fCAwKTtcbiAgICAgICAgdGhpcy5jcml0ICs9IChzLmNyaXQgfHwgMCk7XG4gICAgICAgIHRoaXMuaGFzdGUgKj0gKHMuaGFzdGUgfHwgMSk7XG4gICAgICAgIHRoaXMuc3RhdE11bHQgKj0gKHMuc3RhdE11bHQgfHwgMSk7XG4gICAgICAgIHRoaXMuZGFtYWdlTXVsdCAqPSAocy5kYW1hZ2VNdWx0IHx8IDEpO1xuICAgICAgICB0aGlzLmFybW9yUGVuZXRyYXRpb24gKz0gKHMuYXJtb3JQZW5ldHJhdGlvbiB8fCAwKTtcbiAgICAgICAgdGhpcy5wbHVzRGFtYWdlICs9IChzLnBsdXNEYW1hZ2UgfHwgMCk7XG5cbiAgICAgICAgdGhpcy5zd29yZFNraWxsICs9IChzLnN3b3JkU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuYXhlU2tpbGwgKz0gKHMuYXhlU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMubWFjZVNraWxsICs9IChzLm1hY2VTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5kYWdnZXJTa2lsbCArPSAocy5kYWdnZXJTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5zd29yZDJIU2tpbGwgKz0gKHMuc3dvcmQySFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmF4ZTJIU2tpbGwgKz0gKHMuYXhlMkhTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5tYWNlMkhTa2lsbCArPSAocy5tYWNlMkhTa2lsbCB8fCAwKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdGF0cywgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IFByb2MgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgY2xhc3MgQnVmZk1hbmFnZXIge1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgcHJpdmF0ZSBidWZmTGlzdDogQnVmZkFwcGxpY2F0aW9uW10gPSBbXTtcbiAgICBwcml2YXRlIGJ1ZmZPdmVyVGltZUxpc3Q6IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uW10gPSBbXTtcblxuICAgIGJhc2VTdGF0czogU3RhdHM7XG4gICAgc3RhdHM6IFN0YXRzO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJhc2VTdGF0czogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcbiAgICAgICAgdGhpcy5iYXNlU3RhdHMgPSBuZXcgU3RhdHMoYmFzZVN0YXRzKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IG5ldyBTdGF0cyh0aGlzLmJhc2VTdGF0cyk7XG4gICAgfVxuXG4gICAgZ2V0IG5leHRPdmVyVGltZVVwZGF0ZSgpIHtcbiAgICAgICAgbGV0IHJlcyA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHJlcyA9IE1hdGgubWluKHJlcywgYnVmZk9UQXBwLm5leHRVcGRhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIHByb2Nlc3MgbGFzdCB0aWNrIGJlZm9yZSBpdCBpcyByZW1vdmVkXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIGJ1ZmZPVEFwcC51cGRhdGUodGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbW92ZUV4cGlyZWRCdWZmcyh0aW1lKTtcblxuICAgICAgICB0aGlzLnN0YXRzLnNldCh0aGlzLmJhc2VTdGF0cyk7XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBzdGFja3MgPSBidWZmLnN0YXRzU3RhY2sgPyBzdGFja3MgOiAxO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFja3M7IGkrKykge1xuICAgICAgICAgICAgICAgIGJ1ZmYuYXBwbHkodGhpcy5zdGF0cywgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgYnVmZkFwcCBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBpZiAoYnVmZkFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmYuc3RhY2tzKSB7ICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvZ1N0YWNrSW5jcmVhc2UgPSB0aGlzLnBsYXllci5sb2cgJiYgKCFidWZmLm1heFN0YWNrcyB8fCBidWZmQXBwLnN0YWNrcyA8IGJ1ZmYubWF4U3RhY2tzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZi5pbml0aWFsU3RhY2tzKSB7IC8vIFRPRE8gLSBjaGFuZ2UgdGhpcyB0byBjaGFyZ2VzP1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnN0YWNrcysrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvZ1N0YWNrSW5jcmVhc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxheWVyLmxvZyEoYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZCAoJHtidWZmQXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZGApO1xuICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSBnYWluZWRgICsgKGJ1ZmYuc3RhY2tzID8gYCAoJHtidWZmLmluaXRpYWxTdGFja3MgfHwgMX0pYCA6ICcnKSk7XG5cbiAgICAgICAgaWYgKGJ1ZmYgaW5zdGFuY2VvZiBCdWZmT3ZlclRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5wdXNoKG5ldyBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbih0aGlzLnBsYXllciwgYnVmZiwgYXBwbHlUaW1lKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZMaXN0LnB1c2gobmV3IEJ1ZmZBcHBsaWNhdGlvbihidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBidWZmLmFkZChhcHBseVRpbWUsIHRoaXMucGxheWVyKTtcbiAgICB9XG5cbiAgICByZW1vdmUoYnVmZjogQnVmZiwgdGltZTogbnVtYmVyLCBmdWxsID0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmdWxsICYmIGJ1ZmYuc3RhY2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZhcHAuc3RhY2tzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9ICgke2J1ZmZhcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuc3RhY2tzID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBsb3N0YCk7XG4gICAgICAgICAgICAgICAgYnVmZmFwcC5idWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCA9IHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWU6IG51bWJlcikge1xuICAgICAgICBjb25zdCByZW1vdmVkQnVmZnM6IEJ1ZmZbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuZXhwaXJhdGlvblRpbWUgPD0gdGltZSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRCdWZmcy5wdXNoKGJ1ZmZhcHAuYnVmZik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmYgb2YgcmVtb3ZlZEJ1ZmZzKSB7XG4gICAgICAgICAgICBidWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBleHBpcmVkYCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzfHVuZGVmaW5lZDtcbiAgICBzdGFja3M6IGJvb2xlYW47XG4gICAgZHVyYXRpb246IG51bWJlcjtcbiAgICBpbml0aWFsU3RhY2tzPzogbnVtYmVyO1xuICAgIG1heFN0YWNrcz86IG51bWJlcjtcbiAgICBzdGF0c1N0YWNrOiBib29sZWFuOyAvLyBkbyB5b3UgYWRkIHRoZSBzdGF0IGJvbnVzIGZvciBlYWNoIHN0YWNrPyBvciBpcyBpdCBsaWtlIGZsdXJyeSB3aGVyZSB0aGUgc3RhY2sgaXMgb25seSB0byBjb3VudCBjaGFyZ2VzXG5cbiAgICBwcml2YXRlIGNoaWxkPzogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgc3RhdHM/OiBTdGF0VmFsdWVzLCBzdGFja3M/OiBib29sZWFuLCBpbml0aWFsU3RhY2tzPzogbnVtYmVyLCBtYXhTdGFja3M/OiBudW1iZXIsIGNoaWxkPzogQnVmZiwgc3RhdHNTdGFjayA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuc3RhY2tzID0gISFzdGFja3M7XG4gICAgICAgIHRoaXMuaW5pdGlhbFN0YWNrcyA9IGluaXRpYWxTdGFja3M7XG4gICAgICAgIHRoaXMubWF4U3RhY2tzID0gbWF4U3RhY2tzO1xuICAgICAgICB0aGlzLmNoaWxkID0gY2hpbGQ7XG4gICAgICAgIHRoaXMuc3RhdHNTdGFjayA9IHN0YXRzU3RhY2s7XG4gICAgfVxuXG4gICAgYXBwbHkoc3RhdHM6IFN0YXRzLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5zdGF0cykge1xuICAgICAgICAgICAgc3RhdHMuYWRkKHRoaXMuc3RhdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHt9XG5cbiAgICByZW1vdmUodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5jaGlsZCkge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLnJlbW92ZSh0aGlzLmNoaWxkLCB0aW1lLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmO1xuICAgIGV4cGlyYXRpb25UaW1lITogbnVtYmVyO1xuXG4gICAgc3RhY2tzVmFsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgfVxuXG4gICAgcmVmcmVzaCh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3MgPSB0aGlzLmJ1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxO1xuXG4gICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSB0aW1lICsgdGhpcy5idWZmLmR1cmF0aW9uICogMTAwMDtcblxuICAgICAgICBpZiAodGhpcy5idWZmLmR1cmF0aW9uID4gNjApIHtcbiAgICAgICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzdGFja3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YWNrc1ZhbDtcbiAgICB9XG5cbiAgICBzZXQgc3RhY2tzKHN0YWNrczogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc3RhY2tzVmFsID0gdGhpcy5idWZmLm1heFN0YWNrcyA/IE1hdGgubWluKHRoaXMuYnVmZi5tYXhTdGFja3MsIHN0YWNrcykgOiBzdGFja3M7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZk92ZXJUaW1lIGV4dGVuZHMgQnVmZiB7XG4gICAgdXBkYXRlRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQ7XG4gICAgdXBkYXRlSW50ZXJ2YWw6IG51bWJlclxuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0czogU3RhdFZhbHVlc3x1bmRlZmluZWQsIHVwZGF0ZUludGVydmFsOiBudW1iZXIsIHVwZGF0ZUY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGR1cmF0aW9uLCBzdGF0cyk7XG4gICAgICAgIHRoaXMudXBkYXRlRiA9IHVwZGF0ZUY7XG4gICAgICAgIHRoaXMudXBkYXRlSW50ZXJ2YWwgPSB1cGRhdGVJbnRlcnZhbDtcbiAgICB9XG59XG5cbmNsYXNzIEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uIGV4dGVuZHMgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmT3ZlclRpbWU7XG4gICAgbmV4dFVwZGF0ZSE6IG51bWJlcjtcbiAgICBwbGF5ZXI6IFBsYXllcjtcblxuICAgIGNvbnN0cnVjdG9yKHBsYXllcjogUGxheWVyLCBidWZmOiBCdWZmT3ZlclRpbWUsIGFwcGx5VGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKGJ1ZmYsIGFwcGx5VGltZSk7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICBzdXBlci5yZWZyZXNoKHRpbWUpO1xuICAgICAgICB0aGlzLm5leHRVcGRhdGUgPSB0aW1lICsgdGhpcy5idWZmLnVwZGF0ZUludGVydmFsO1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRpbWUgPj0gdGhpcy5uZXh0VXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLm5leHRVcGRhdGUgKz0gdGhpcy5idWZmLnVwZGF0ZUludGVydmFsO1xuICAgICAgICAgICAgdGhpcy5idWZmLnVwZGF0ZUYodGhpcy5wbGF5ZXIsIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZlByb2MgZXh0ZW5kcyBCdWZmIHtcbiAgICBwcm9jOiBQcm9jO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBwcm9jOiBQcm9jLCBjaGlsZD86IEJ1ZmYpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGQpO1xuICAgICAgICB0aGlzLnByb2MgPSBwcm9jO1xuICAgIH1cblxuICAgIGFkZCh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLmFkZCh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIuYWRkUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLnJlbW92ZSh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIucmVtb3ZlUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFdlYXBvbkVxdWlwZWQsIFdlYXBvblR5cGUsIEl0ZW1EZXNjcmlwdGlvbiwgSXRlbUVxdWlwZWQsIEl0ZW1TbG90LCBpc0VxdWlwZWRXZWFwb24sIGlzV2VhcG9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IHVyYW5kLCBjbGFtcCwgZnJhbmQgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBCdWZmTWFuYWdlciB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBQcm9jLCBMZWFybmVkU3dpbmdTcGVsbCwgU3BlbGxUeXBlLCBTcGVsbERhbWFnZSB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBMSF9DT1JFX0JVRyB9IGZyb20gXCIuL3NpbV9zZXR0aW5ncy5qc1wiO1xuXG5leHBvcnQgZW51bSBSYWNlIHtcbiAgICBIVU1BTixcbiAgICBPUkMsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCB0eXBlIERhbWFnZUxvZyA9IFtudW1iZXIsIG51bWJlcl1bXTtcblxuZXhwb3J0IGNsYXNzIFBsYXllciBleHRlbmRzIFVuaXQge1xuICAgIGl0ZW1zOiBNYXA8SXRlbVNsb3QsIEl0ZW1FcXVpcGVkPiA9IG5ldyBNYXAoKTtcbiAgICBwcm9jczogUHJvY1tdID0gW107XG5cbiAgICB0YXJnZXQ6IFVuaXQgfCB1bmRlZmluZWQ7XG5cbiAgICBuZXh0R0NEVGltZSA9IDA7XG4gICAgZXh0cmFBdHRhY2tDb3VudCA9IDA7XG4gICAgZG9pbmdFeHRyYUF0dGFja3MgPSBmYWxzZTtcblxuICAgIGJ1ZmZNYW5hZ2VyOiBCdWZmTWFuYWdlcjtcblxuICAgIGRhbWFnZUxvZzogRGFtYWdlTG9nID0gW107XG5cbiAgICBxdWV1ZWRTcGVsbDogTGVhcm5lZFN3aW5nU3BlbGx8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgbG9nPzogTG9nRnVuY3Rpb247XG5cbiAgICBsYXRlbmN5ID0gNTA7IC8vIG1zXG5cbiAgICBwb3dlckxvc3QgPSAwO1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHN1cGVyKDYwLCAwKTsgLy8gbHZsLCBhcm1vclxuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIgPSBuZXcgQnVmZk1hbmFnZXIodGhpcywgbmV3IFN0YXRzKHN0YXRzKSk7XG4gICAgICAgIHRoaXMubG9nID0gbG9nO1xuICAgIH1cblxuICAgIGdldCBtaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5NQUlOSEFORCk7XG5cbiAgICAgICAgaWYgKGVxdWlwZWQgJiYgaXNFcXVpcGVkV2VhcG9uKGVxdWlwZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXF1aXBlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5PRkZIQU5EKTtcblxuICAgICAgICBpZiAoZXF1aXBlZCAmJiBpc0VxdWlwZWRXZWFwb24oZXF1aXBlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcXVpcGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZXF1aXAoaXRlbTogSXRlbURlc2NyaXB0aW9uLCBzbG90OiBJdGVtU2xvdCkge1xuICAgICAgICBpZiAodGhpcy5pdGVtcy5oYXMoc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFscmVhZHkgaGF2ZSBpdGVtIGluIHNsb3QgJHtJdGVtU2xvdFtzbG90XX1gKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEoaXRlbS5zbG90ICYgc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGNhbm5vdCBlcXVpcCAke2l0ZW0ubmFtZX0gaW4gc2xvdCAke0l0ZW1TbG90W3Nsb3RdfWApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5zdGF0cykge1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5iYXNlU3RhdHMuYWRkKGl0ZW0uc3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETyAtIGhhbmRsZSBlcXVpcHBpbmcgMkggKGFuZCBob3cgdGhhdCBkaXNhYmxlcyBPSClcbiAgICAgICAgaWYgKGlzV2VhcG9uKGl0ZW0pKSB7XG4gICAgICAgICAgICB0aGlzLml0ZW1zLnNldChzbG90LCBuZXcgV2VhcG9uRXF1aXBlZChpdGVtLCB0aGlzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLml0ZW1zLnNldChzbG90LCBuZXcgSXRlbUVxdWlwZWQoaXRlbSwgdGhpcykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHBvd2VyKCk6IG51bWJlciB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHNldCBwb3dlcihwb3dlcjogbnVtYmVyKSB7fVxuXG4gICAgYWRkUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIHRoaXMucHJvY3MucHVzaChwKTtcbiAgICB9XG5cbiAgICByZW1vdmVQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgLy8gVE9ETyAtIGVpdGhlciBwcm9jcyBzaG91bGQgYmUgYSBzZXQgb3Igd2UgbmVlZCBQcm9jQXBwbGljYXRpb25cbiAgICAgICAgdGhpcy5wcm9jcyA9IHRoaXMucHJvY3MuZmlsdGVyKChwcm9jOiBQcm9jKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gcHJvYyAhPT0gcDtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgaWYgKHNwZWxsICYmIHNwZWxsLnR5cGUgPT0gU3BlbGxUeXBlLlBIWVNJQ0FMKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuICAgICAgICBjb25zdCB3ZWFwb25UeXBlID0gd2VhcG9uLndlYXBvbi50eXBlO1xuXG4gICAgICAgIC8vIFRPRE8sIG1ha2UgdGhpcyBhIG1hcFxuICAgICAgICBzd2l0Y2ggKHdlYXBvblR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5NQUNFOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLm1hY2VTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5TV09SRDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zd29yZFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkFYRTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5heGVTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5EQUdHRVI6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuZGFnZ2VyU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuTUFDRTJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLm1hY2UySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLlNXT1JEMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3dvcmQySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkFYRTJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmF4ZTJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgaWYgKExIX0NPUkVfQlVHICYmIHNwZWxsICYmIHNwZWxsLnR5cGUgPT0gU3BlbGxUeXBlLlBIWVNJQ0FMKSB7XG4gICAgICAgICAgICAvLyBvbiBMSCBjb3JlLCBub24gd2VhcG9uIHNwZWxscyBsaWtlIGJsb29kdGhpcnN0IGFyZSBiZW5lZml0dGluZyBmcm9tIHdlYXBvbiBza2lsbFxuICAgICAgICAgICAgLy8gdGhpcyBvbmx5IGFmZmVjdHMgY3JpdCwgbm90IGhpdC9kb2RnZS9wYXJyeVxuICAgICAgICAgICAgLy8gc2V0IHRoZSBzcGVsbCB0byB1bmRlZmluZWQgc28gaXQgaXMgdHJlYXRlZCBsaWtlIGEgbm9ybWFsIG1lbGVlIGF0dGFjayAocmF0aGVyIHRoYW4gdXNpbmcgYSBkdW1teSBzcGVsbClcbiAgICAgICAgICAgIC8vIHdoZW4gY2FsY3VsYXRpbmcgd2VhcG9uIHNraWxsXG4gICAgICAgICAgICBzcGVsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSAwLjA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuXG4gICAgICAgIGxldCBjcml0ID0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5jcml0O1xuICAgICAgICBjcml0ICs9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYWdpICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAvIDIwO1xuXG4gICAgICAgIGNyaXQgKz0gc2tpbGxCb251cztcblxuICAgICAgICByZXR1cm4gY3JpdDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlTWlzc0NoYW5jZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCByZXMgPSA1O1xuICAgICAgICByZXMgLT0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5oaXQ7XG5cbiAgICAgICAgaWYgKHRoaXMub2ggJiYgIXNwZWxsKSB7XG4gICAgICAgICAgICByZXMgKz0gMTk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLmRlZmVuc2VTa2lsbDtcblxuICAgICAgICBpZiAoc2tpbGxEaWZmIDwgLTEwKSB7XG4gICAgICAgICAgICByZXMgLT0gKHNraWxsRGlmZiArIDEwKSAqIDAuNCAtIDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMgLT0gc2tpbGxEaWZmICogMC4xO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNsYW1wKHJlcywgMCwgNjApO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVHbGFuY2luZ1JlZHVjdGlvbih2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuKSB7XG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHZpY3RpbS5kZWZlbnNlU2tpbGwgIC0gdGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oKTtcblxuICAgICAgICBpZiAoc2tpbGxEaWZmID49IDE1KSB7XG4gICAgICAgICAgICByZXR1cm4gMC42NTtcbiAgICAgICAgfSBlbHNlIGlmIChza2lsbERpZmYgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBza2lsbERpZmZUb1JlZHVjdGlvbltza2lsbERpZmZdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlU3dpbmdNaW5NYXhEYW1hZ2UoaXNfbWg6IGJvb2xlYW4pOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuXG4gICAgICAgIGNvbnN0IGFwX2JvbnVzID0gdGhpcy5hcCAvIDE0ICogd2VhcG9uLndlYXBvbi5zcGVlZDtcblxuICAgICAgICBjb25zdCBvaFBlbmFsdHkgPSBpc19taCA/IDEgOiAwLjYyNTsgLy8gVE9ETyAtIGNoZWNrIHRhbGVudHMsIGltcGxlbWVudGVkIGFzIGFuIGF1cmEgU1BFTExfQVVSQV9NT0RfT0ZGSEFORF9EQU1BR0VfUENUXG5cbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICh3ZWFwb24ubWluICsgYXBfYm9udXMpICogb2hQZW5hbHR5LFxuICAgICAgICAgICAgKHdlYXBvbi5tYXggKyBhcF9ib251cykgKiBvaFBlbmFsdHlcbiAgICAgICAgXTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZShpc19taDogYm9vbGVhbikge1xuICAgICAgICByZXR1cm4gZnJhbmQoLi4udGhpcy5jYWxjdWxhdGVTd2luZ01pbk1heERhbWFnZShpc19taCkpO1xuICAgIH1cblxuICAgIGNyaXRDYXAoKSB7XG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZSh0cnVlKSAtIHRoaXMudGFyZ2V0IS5tYXhTa2lsbEZvckxldmVsKTtcbiAgICAgICAgY29uc3QgbWlzc19jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlTWlzc0NoYW5jZSh0aGlzLnRhcmdldCEsIHRydWUpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLnRhcmdldCEuZG9kZ2VDaGFuY2UgKiAxMDApIC0gc2tpbGxCb251cztcbiAgICAgICAgY29uc3QgZ2xhbmNlX2NoYW5jZSA9IGNsYW1wKCgxMCArICh0aGlzLnRhcmdldCEuZGVmZW5zZVNraWxsIC0gMzAwKSAqIDIpICogMTAwLCAwLCA0MDAwKTtcblxuICAgICAgICByZXR1cm4gKDEwMDAwIC0gKG1pc3NfY2hhbmNlICsgZG9kZ2VfY2hhbmNlICsgZ2xhbmNlX2NoYW5jZSkpIC8gMTAwO1xuICAgIH1cblxuICAgIHJvbGxNZWxlZUhpdE91dGNvbWUodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgICAgIGNvbnN0IHJvbGwgPSB1cmFuZCgwLCAxMDAwMCk7XG4gICAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgICBsZXQgdG1wID0gMDtcblxuICAgICAgICAvLyByb3VuZGluZyBpbnN0ZWFkIG9mIHRydW5jYXRpbmcgYmVjYXVzZSAxOS40ICogMTAwIHdhcyB0cnVuY2F0aW5nIHRvIDE5MzkuXG4gICAgICAgIGNvbnN0IG1pc3NfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltLCBpc19taCwgc3BlbGwpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh2aWN0aW0uZG9kZ2VDaGFuY2UgKiAxMDApO1xuICAgICAgICBjb25zdCBjcml0X2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbSwgaXNfbWgsIHNwZWxsKSAqIDEwMCk7XG5cbiAgICAgICAgLy8gd2VhcG9uIHNraWxsIC0gdGFyZ2V0IGRlZmVuc2UgKHVzdWFsbHkgbmVnYXRpdmUpXG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuXG4gICAgICAgIHRtcCA9IG1pc3NfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBkb2RnZV9jaGFuY2UgLSBza2lsbEJvbnVzOyAvLyA1LjYgKDU2MCkgZm9yIGx2bCA2MyB3aXRoIDMwMCB3ZWFwb24gc2tpbGxcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3BlbGwpIHsgLy8gc3BlbGxzIGNhbid0IGdsYW5jZVxuICAgICAgICAgICAgdG1wID0gKDEwICsgKHZpY3RpbS5kZWZlbnNlU2tpbGwgLSAzMDApICogMikgKiAxMDA7XG4gICAgICAgICAgICB0bXAgPSBjbGFtcCh0bXAsIDAsIDQwMDApO1xuICAgIFxuICAgICAgICAgICAgaWYgKHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IGNyaXRfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUw7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgZGFtYWdlV2l0aEJvbnVzID0gcmF3RGFtYWdlO1xuXG4gICAgICAgIGRhbWFnZVdpdGhCb251cyAqPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhbWFnZU11bHQ7XG5cbiAgICAgICAgcmV0dXJuIGRhbWFnZVdpdGhCb251cztcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZVdpdGhCb251cyA9IHRoaXMuY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIHNwZWxsKTtcbiAgICAgICAgY29uc3QgYXJtb3JSZWR1Y2VkID0gdmljdGltLmNhbGN1bGF0ZUFybW9yUmVkdWNlZERhbWFnZShkYW1hZ2VXaXRoQm9udXMsIHRoaXMpO1xuICAgICAgICBjb25zdCBoaXRPdXRjb21lID0gdGhpcy5yb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcblxuICAgICAgICBsZXQgZGFtYWdlID0gYXJtb3JSZWR1Y2VkO1xuICAgICAgICBsZXQgY2xlYW5EYW1hZ2UgPSAwO1xuXG4gICAgICAgIHN3aXRjaCAoaGl0T3V0Y29tZSkge1xuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTpcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSAwO1xuICAgICAgICAgICAgICAgIGNsZWFuRGFtYWdlID0gZGFtYWdlV2l0aEJvbnVzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZHVjZVBlcmNlbnQgPSB0aGlzLmNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbSwgaXNfbWgpO1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IHJlZHVjZVBlcmNlbnQgKiBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlICo9IDI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW2RhbWFnZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUywgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIC8vIHdoYXQgaXMgdGhlIG9yZGVyIG9mIGNoZWNraW5nIGZvciBwcm9jcyBsaWtlIGhvaiwgaXJvbmZvZSBhbmQgd2luZGZ1cnlcbiAgICAgICAgICAgIC8vIG9uIExIIGNvcmUgaXQgaXMgaG9qID4gaXJvbmZvZSA+IHdpbmRmdXJ5XG4gICAgICAgICAgICAvLyBzbyBkbyBpdGVtIHByb2NzIGZpcnN0LCB0aGVuIHdlYXBvbiBwcm9jLCB0aGVuIHdpbmRmdXJ5XG4gICAgICAgICAgICBmb3IgKGxldCBwcm9jIG9mIHRoaXMucHJvY3MpIHtcbiAgICAgICAgICAgICAgICBwcm9jLnJ1bih0aGlzLCAoaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghKS53ZWFwb24sIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oISkucHJvYyh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlYWxNZWxlZURhbWFnZSh0aW1lOiBudW1iZXIsIHJhd0RhbWFnZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gdGhpcy5jYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2UsIHRhcmdldCwgaXNfbWgsIHNwZWxsKTtcbiAgICAgICAgZGFtYWdlRG9uZSA9IE1hdGgudHJ1bmMoZGFtYWdlRG9uZSk7IC8vIHRydW5jYXRpbmcgaGVyZSBiZWNhdXNlIHdhcnJpb3Igc3ViY2xhc3MgYnVpbGRzIG9uIHRvcCBvZiBjYWxjdWxhdGVNZWxlZURhbWFnZVxuICAgICAgICBjbGVhbkRhbWFnZSA9IE1hdGgudHJ1bmMoY2xlYW5EYW1hZ2UpOyAvLyBUT0RPLCBzaG91bGQgZGFtYWdlTXVsdCBhZmZlY3QgY2xlYW4gZGFtYWdlIGFzIHdlbGw/IGlmIHNvIG1vdmUgaXQgaW50byBjYWxjdWxhdGVNZWxlZURhbWFnZVxuXG4gICAgICAgIHRoaXMuZGFtYWdlTG9nLnB1c2goW3RpbWUsIGRhbWFnZURvbmVdKTtcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgbGV0IGhpdFN0ciA9IGBZb3VyICR7c3BlbGwgPyBzcGVsbC5uYW1lIDogKGlzX21oID8gJ21haW4taGFuZCcgOiAnb2ZmLWhhbmQnKX0gJHtoaXRPdXRjb21lU3RyaW5nW2hpdE91dGNvbWVdfWA7XG4gICAgICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlldLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAgICAgaGl0U3RyICs9IGAgZm9yICR7ZGFtYWdlRG9uZX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgaGl0U3RyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcGVsbCBpbnN0YW5jZW9mIFNwZWxsRGFtYWdlKSB7XG4gICAgICAgICAgICBpZiAoc3BlbGwuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAvLyBjYWxsaW5nIHRoaXMgYmVmb3JlIHVwZGF0ZSBwcm9jcyBiZWNhdXNlIGluIHRoZSBjYXNlIG9mIGV4ZWN1dGUsIHVuYnJpZGxlZCB3cmF0aCBjb3VsZCBwcm9jXG4gICAgICAgICAgICAgICAgLy8gdGhlbiBzZXR0aW5nIHRoZSByYWdlIHRvIDAgd291bGQgY2F1c2UgdXMgdG8gbG9zZSB0aGUgMSByYWdlIGZyb20gdW5icmlkbGVkIHdyYXRoXG4gICAgICAgICAgICAgICAgLy8gYWx0ZXJuYXRpdmUgaXMgdG8gc2F2ZSB0aGUgYW1vdW50IG9mIHJhZ2UgdXNlZCBmb3IgdGhlIGFiaWxpdHlcbiAgICAgICAgICAgICAgICBzcGVsbC5jYWxsYmFjayh0aGlzLCBoaXRPdXRjb21lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3BlbGwgfHwgc3BlbGwuY2FuUHJvYykge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIHNwZWxsKTtcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIudXBkYXRlKHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHN3aW5nV2VhcG9uKHRpbWU6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBjb25zdCByYXdEYW1hZ2UgPSB0aGlzLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyAmJiBpc19taCAmJiB0aGlzLnF1ZXVlZFNwZWxsICYmIHRoaXMucXVldWVkU3BlbGwuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRTcGVsbC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgY29uc3Qgc3dpbmdTcGVsbCA9IHRoaXMucXVldWVkU3BlbGwuc3BlbGw7XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFNwZWxsID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgY29uc3QgYm9udXNEYW1hZ2UgPSBzd2luZ1NwZWxsLmJvbnVzRGFtYWdlO1xuICAgICAgICAgICAgdGhpcy5kZWFsTWVsZWVEYW1hZ2UodGltZSwgcmF3RGFtYWdlICsgYm9udXNEYW1hZ2UsIHRhcmdldCwgaXNfbWgsIHN3aW5nU3BlbGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWFsTWVsZWVEYW1hZ2UodGltZSwgcmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IFt0aGlzV2VhcG9uLCBvdGhlcldlYXBvbl0gPSBpc19taCA/IFt0aGlzLm1oLCB0aGlzLm9oXSA6IFt0aGlzLm9oLCB0aGlzLm1oXTtcblxuICAgICAgICB0aGlzV2VhcG9uIS5uZXh0U3dpbmdUaW1lID0gdGltZSArIHRoaXNXZWFwb24hLndlYXBvbi5zcGVlZCAvIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuaGFzdGUgKiAxMDAwO1xuXG4gICAgICAgIGlmIChvdGhlcldlYXBvbiAmJiBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lIDwgdGltZSArIDIwMCkge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGRlbGF5aW5nICR7aXNfbWggPyAnT0gnIDogJ01IJ30gc3dpbmdgLCB0aW1lICsgMjAwIC0gb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSk7XG4gICAgICAgICAgICBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lID0gdGltZSArIDIwMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUF0dGFja2luZ1N0YXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy50YXJnZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHRoaXMuZXh0cmFBdHRhY2tDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXh0cmFBdHRhY2tDb3VudC0tO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aW1lID49IHRoaXMubWghLm5leHRTd2luZ1RpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCB0cnVlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5vaCAmJiB0aW1lID49IHRoaXMub2gubmV4dFN3aW5nVGltZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciwgTWVsZWVIaXRPdXRjb21lLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmT3ZlclRpbWUsIEJ1ZmZQcm9jIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBMZWFybmVkU3BlbGwsIFNwZWxsRGFtYWdlLCBTcGVsbFR5cGUsIFN3aW5nU3BlbGwsIExlYXJuZWRTd2luZ1NwZWxsLCBQcm9jLCBTcGVsbEJ1ZmYsIFNwZWxsRmFtaWx5IH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IGNsYW1wIH0gZnJvbSBcIi4vbWF0aC5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuXG5jb25zdCBmbHVycnkgPSBuZXcgQnVmZihcIkZsdXJyeVwiLCAxNSwge2hhc3RlOiAxLjN9LCB0cnVlLCAzLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG5leHBvcnQgY29uc3QgcmFjZVRvU3RhdHMgPSBuZXcgTWFwPFJhY2UsIFN0YXRWYWx1ZXM+KCk7XG5yYWNlVG9TdGF0cy5zZXQoUmFjZS5IVU1BTiwgeyBtYWNlU2tpbGw6IDUsIHN3b3JkU2tpbGw6IDUsIG1hY2UySFNraWxsOiA1LCBzd29yZDJIU2tpbGw6IDUsIHN0cjogMTIwLCBhZ2k6IDgwIH0pO1xucmFjZVRvU3RhdHMuc2V0KFJhY2UuT1JDLCB7IGF4ZVNraWxsOiA1LCBheGUySFNraWxsOiA1LCBzdHI6IDEyMywgYWdpOiA3NyB9KTtcblxuZXhwb3J0IGNsYXNzIFdhcnJpb3IgZXh0ZW5kcyBQbGF5ZXIge1xuICAgIHJhZ2UgPSA4MDsgLy8gVE9ETyAtIGFsbG93IHNpbXVsYXRpb24gdG8gY2hvb3NlIHN0YXJ0aW5nIHJhZ2VcblxuICAgIGV4ZWN1dGUgPSBuZXcgTGVhcm5lZFNwZWxsKGV4ZWN1dGVTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2R0aGlyc3QgPSBuZXcgTGVhcm5lZFNwZWxsKGJsb29kdGhpcnN0U3BlbGwsIHRoaXMpO1xuICAgIGhhbXN0cmluZyA9IG5ldyBMZWFybmVkU3BlbGwoaGFtc3RyaW5nU3BlbGwsIHRoaXMpO1xuICAgIHdoaXJsd2luZCA9IG5ldyBMZWFybmVkU3BlbGwod2hpcmx3aW5kU3BlbGwsIHRoaXMpO1xuICAgIGhlcm9pY1N0cmlrZSA9IG5ldyBMZWFybmVkU3dpbmdTcGVsbChoZXJvaWNTdHJpa2VTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2RSYWdlID0gbmV3IExlYXJuZWRTcGVsbChibG9vZFJhZ2UsIHRoaXMpO1xuICAgIGRlYXRoV2lzaCA9IG5ldyBMZWFybmVkU3BlbGwoZGVhdGhXaXNoLCB0aGlzKTtcbiAgICBleGVjdXRlU3BlbGwgPSBuZXcgTGVhcm5lZFNwZWxsKGV4ZWN1dGVTcGVsbCwgdGhpcyk7XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgbG9nQ2FsbGJhY2s/OiAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICAgICAgc3VwZXIobmV3IFN0YXRzKHJhY2VUb1N0YXRzLmdldChyYWNlKSkuYWRkKHN0YXRzKSwgbG9nQ2FsbGJhY2spO1xuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYWRkKGFuZ2VyTWFuYWdlbWVudE9ULCBNYXRoLnJhbmRvbSgpICogLTMwMDApOyAvLyByYW5kb21pemluZyBhbmdlciBtYW5hZ2VtZW50IHRpbWluZ1xuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZCh1bmJyaWRsZWRXcmF0aCwgMCk7XG4gICAgfVxuXG4gICAgZ2V0IHBvd2VyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yYWdlO1xuICAgIH1cblxuICAgIHNldCBwb3dlcihwb3dlcjogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMucG93ZXJMb3N0ICs9IE1hdGgubWF4KDAsIHBvd2VyIC0gMTAwKTtcbiAgICAgICAgdGhpcy5yYWdlID0gY2xhbXAocG93ZXIsIDAsIDEwMCk7XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sZXZlbCAqIDMgLSAyMCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXAgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0ciAqIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RhdE11bHQgKiAyO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICAvLyBjcnVlbHR5ICsgYmVyc2Vya2VyIHN0YW5jZVxuICAgICAgICByZXR1cm4gNSArIDMgKyBzdXBlci5jYWxjdWxhdGVDcml0Q2hhbmNlKHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gc3VwZXIuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIGlzX21oLCBzcGVsbCk7XG5cbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCAmJiBzcGVsbCAmJiBzcGVsbC5mYW1pbHkgPT09IFNwZWxsRmFtaWx5LldBUlJJT1IpIHtcbiAgICAgICAgICAgIGRhbWFnZURvbmUgKj0gMS4xOyAvLyBpbXBhbGVcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIFtkYW1hZ2VEb25lLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV07XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHJld2FyZFJhZ2UoZGFtYWdlOiBudW1iZXIsIGlzX2F0dGFja2VyOiBib29sZWFuLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgLy8gaHR0cHM6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvMTgzMjUtdGhlLW5ldy1yYWdlLWZvcm11bGEtYnkta2FsZ2FuL1xuICAgICAgICAvLyBQcmUtRXhwYW5zaW9uIFJhZ2UgR2FpbmVkIGZyb20gZGVhbGluZyBkYW1hZ2U6XG4gICAgICAgIC8vIChEYW1hZ2UgRGVhbHQpIC8gKFJhZ2UgQ29udmVyc2lvbiBhdCBZb3VyIExldmVsKSAqIDcuNVxuICAgICAgICAvLyBGb3IgVGFraW5nIERhbWFnZSAoYm90aCBwcmUgYW5kIHBvc3QgZXhwYW5zaW9uKTpcbiAgICAgICAgLy8gUmFnZSBHYWluZWQgPSAoRGFtYWdlIFRha2VuKSAvIChSYWdlIENvbnZlcnNpb24gYXQgWW91ciBMZXZlbCkgKiAyLjVcbiAgICAgICAgLy8gUmFnZSBDb252ZXJzaW9uIGF0IGxldmVsIDYwOiAyMzAuNlxuICAgICAgICAvLyBUT0RPIC0gaG93IGRvIGZyYWN0aW9ucyBvZiByYWdlIHdvcms/IGl0IGFwcGVhcnMgeW91IGRvIGdhaW4gZnJhY3Rpb25zIGJhc2VkIG9uIGV4ZWMgZGFtYWdlXG4gICAgICAgIC8vIG5vdCB0cnVuY2F0aW5nIGZvciBub3dcbiAgICAgICAgLy8gVE9ETyAtIGl0IGFwcGVhcnMgdGhhdCByYWdlIGlzIGNhbGN1bGF0ZWQgdG8gdGVudGhzIGJhc2VkIG9uIGRhdGFiYXNlIHZhbHVlcyBvZiBzcGVsbHMgKDEwIGVuZXJneSA9IDEgcmFnZSlcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IExFVkVMXzYwX1JBR0VfQ09OViA9IDIzMC42O1xuICAgICAgICBsZXQgYWRkUmFnZSA9IGRhbWFnZSAvIExFVkVMXzYwX1JBR0VfQ09OVjtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc19hdHRhY2tlcikge1xuICAgICAgICAgICAgYWRkUmFnZSAqPSA3LjU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUT0RPIC0gY2hlY2sgZm9yIGJlcnNlcmtlciByYWdlIDEuM3ggbW9kaWZpZXJcbiAgICAgICAgICAgIGFkZFJhZ2UgKj0gMi41O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubG9nKSB0aGlzLmxvZyh0aW1lLCBgR2FpbmVkICR7TWF0aC5taW4oYWRkUmFnZSwgMTAwIC0gdGhpcy5yYWdlKX0gcmFnZSAoJHtNYXRoLm1pbigxMDAsIHRoaXMucG93ZXIgKyBhZGRSYWdlKX0pYCk7XG5cbiAgICAgICAgdGhpcy5wb3dlciArPSBhZGRSYWdlO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZVByb2NzKHRpbWUsIGlzX21oLCBoaXRPdXRjb21lLCBkYW1hZ2VEb25lLCBjbGVhbkRhbWFnZSwgc3BlbGwpO1xuXG4gICAgICAgIGlmIChbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIGlmIChzcGVsbCkge1xuICAgICAgICAgICAgICAgIC8vIGh0dHA6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvNjkzNjUtMTgtMDItMDUta2FsZ2Fucy1yZXNwb25zZS10by13YXJyaW9ycy8gXCJzaW5jZSBtaXNzaW5nIHdhc3RlcyAyMCUgb2YgdGhlIHJhZ2UgY29zdCBvZiB0aGUgYWJpbGl0eVwiXG4gICAgICAgICAgICAgICAgLy8gVE9ETyAtIG5vdCBzdXJlIGhvdyBibGl6emxpa2UgdGhpcyBpc1xuICAgICAgICAgICAgICAgIGlmIChzcGVsbCAhPT0gd2hpcmx3aW5kU3BlbGwpIHsgLy8gVE9ETyAtIHNob3VsZCBjaGVjayB0byBzZWUgaWYgaXQgaXMgYW4gYW9lIHNwZWxsIG9yIGEgc2luZ2xlIHRhcmdldCBzcGVsbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJhZ2UgKz0gc3BlbGwuY29zdCAqIDAuODI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoY2xlYW5EYW1hZ2UgKiAwLjc1LCB0cnVlLCB0aW1lKTsgLy8gVE9ETyAtIHdoZXJlIGlzIHRoaXMgZm9ybXVsYSBmcm9tP1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRhbWFnZURvbmUgJiYgIXNwZWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoZGFtYWdlRG9uZSwgdHJ1ZSwgdGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnN0YW50IGF0dGFja3MgYW5kIG1pc3Nlcy9kb2RnZXMgZG9uJ3QgdXNlIGZsdXJyeSBjaGFyZ2VzIC8vIFRPRE8gLSBjb25maXJtLCB3aGF0IGFib3V0IHBhcnJ5P1xuICAgICAgICAvLyBleHRyYSBhdHRhY2tzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyBidXQgdGhleSBjYW4gcHJvYyBmbHVycnkgKHRlc3RlZClcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXRoaXMuZG9pbmdFeHRyYUF0dGFja3NcbiAgICAgICAgICAgICYmICEoc3BlbGwgfHwgc3BlbGwgPT09IGhlcm9pY1N0cmlrZVNwZWxsKVxuICAgICAgICAgICAgJiYgIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpXG4gICAgICAgICAgICAmJiBoaXRPdXRjb21lICE9PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVRcbiAgICAgICAgKSB7IFxuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5yZW1vdmUoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCkge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGlnbm9yaW5nIGRlZXAgd291bmRzXG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChmbHVycnksIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZXJvaWNTdHJpa2VTcGVsbCA9IG5ldyBTd2luZ1NwZWxsKFwiSGVyb2ljIFN0cmlrZVwiLCBTcGVsbEZhbWlseS5XQVJSSU9SLCAxNTcsIDEyKTtcblxuLy8gZXhlY3V0ZSBhY3R1YWxseSB3b3JrcyBieSBjYXN0aW5nIHR3byBzcGVsbHMsIGZpcnN0IHJlcXVpcmVzIHdlYXBvbiBidXQgZG9lcyBubyBkYW1hZ2Vcbi8vIHNlY29uZCBvbmUgZG9lc24ndCByZXF1aXJlIHdlYXBvbiBhbmQgZGVhbHMgdGhlIGRhbWFnZS5cbi8vIExIIGNvcmUgb3ZlcnJvZGUgdGhlIHNlY29uZCBzcGVsbCB0byByZXF1aXJlIHdlYXBvbiAoYmVuZWZpdCBmcm9tIHdlYXBvbiBza2lsbClcbmNvbnN0IGV4ZWN1dGVTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkV4ZWN1dGVcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIDYwMCArIChwbGF5ZXIucG93ZXIgLSAxMCkgKiAxNTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDEwLCAwLCAocGxheWVyOiBQbGF5ZXIsIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSkgPT4ge1xuICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTU10uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgcGxheWVyLnBvd2VyID0gMDtcbiAgICB9XG59KTtcblxuY29uc3QgYmxvb2R0aGlyc3RTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkJsb29kdGhpcnN0XCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiAoPFdhcnJpb3I+cGxheWVyKS5hcCAqIDAuNDU7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUwsIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDMwLCA2KTtcblxuY29uc3Qgd2hpcmx3aW5kU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJXaGlybHdpbmRcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIHBsYXllci5jYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZSh0cnVlKTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIFNwZWxsRmFtaWx5LldBUlJJT1IsIHRydWUsIDI1LCAxMCk7XG5cbmNvbnN0IGhhbXN0cmluZ1NwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiSGFtc3RyaW5nXCIsIDQ1LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCBTcGVsbEZhbWlseS5XQVJSSU9SLCB0cnVlLCAxMCwgMCk7XG5cbmV4cG9ydCBjb25zdCBhbmdlck1hbmFnZW1lbnRPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJBbmdlciBNYW5hZ2VtZW50XCIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCB1bmRlZmluZWQsIDMwMDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgcGxheWVyLnBvd2VyICs9IDE7XG4gICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluZWQgMSByYWdlIGZyb20gQW5nZXIgTWFuYWdlbWVudGApO1xufSk7XG5cbmNvbnN0IGJsb29kUmFnZU9UID0gbmV3IEJ1ZmZPdmVyVGltZShcIkJsb29kcmFnZVwiLCAxMCwgdW5kZWZpbmVkLCAxMDAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbmVkIDEgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xufSk7XG5cbmNvbnN0IGJsb29kUmFnZSA9IG5ldyBTcGVsbChcIkJsb29kcmFnZVwiLCBTcGVsbFR5cGUuTk9ORSwgU3BlbGxGYW1pbHkuV0FSUklPUiwgZmFsc2UsIDAsIDYwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxMDtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMTAgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xuICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYmxvb2RSYWdlT1QsIHRpbWUpO1xufSk7XG5cbmNvbnN0IGRlYXRoV2lzaCA9IG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJEZWF0aCBXaXNoXCIsIDMwLCB7IGRhbWFnZU11bHQ6IDEuMiB9KSwgdHJ1ZSwgMTAsIDMgKiA2MCk7XG5cbmNvbnN0IHVuYnJpZGxlZFdyYXRoID0gbmV3IEJ1ZmZQcm9jKFwiVW5icmlkbGVkIFdyYXRoXCIsIDYwICogNjAsXG4gICAgbmV3IFByb2MoXG4gICAgICAgIG5ldyBTcGVsbChcIlVuYnJpZGxlZCBXcmF0aFwiLCBTcGVsbFR5cGUuTk9ORSwgU3BlbGxGYW1pbHkuV0FSUklPUiwgZmFsc2UsIDAsIDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMSByYWdlIGZyb20gVW5icmlkbGVkIFdyYXRoYCk7XG4gICAgICAgICAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICAgICAgfSksXG4gICAgICAgIHtjaGFuY2U6IDQwfSkpO1xuIiwiaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBTcGVsbEJ1ZmYsIFByb2MsIEV4dHJhQXR0YWNrIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBTdGF0cywgU3RhdFZhbHVlcyB9IGZyb20gXCIuLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgVGVtcG9yYXJ5V2VhcG9uRW5jaGFudCB9IGZyb20gXCIuLi9pdGVtLmpzXCI7XG5cblxuZXhwb3J0IGludGVyZmFjZSBCdWZmRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBkdXJhdGlvbjogbnVtYmVyLFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbn1cblxuZXhwb3J0IGNvbnN0IGJ1ZmZzOiBCdWZmW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhdHRsZSBTaG91dFwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDI5MFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2lmdCBvZiB0aGUgV2lsZFwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDE2LCAvLyBUT0RPIC0gc2hvdWxkIGl0IGJlIDEyICogMS4zNT8gKHRhbGVudClcbiAgICAgICAgICAgIGFnaTogMTZcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRydWVzaG90IEF1cmFcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDEwMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3Npbmcgb2YgS2luZ3NcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdGF0TXVsdDogMS4xXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2luZyBvZiBNaWdodFwiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyMjJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNtb2tlZCBEZXNlcnQgRHVtcGxpbmdzXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAyMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSnVqdSBQb3dlclwiLFxuICAgICAgICBkdXJhdGlvbjogMzAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMzBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgTWlnaHRcIixcbiAgICAgICAgZHVyYXRpb246IDEwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogNDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVsaXhpciBvZiB0aGUgTW9uZ29vc2VcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYWdpOiAyNSxcbiAgICAgICAgICAgIGNyaXQ6IDJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIuTy5JLkQuUy5cIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAyNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmFsbHlpbmcgQ3J5IG9mIHRoZSBEcmFnb25zbGF5ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDE0MCxcbiAgICAgICAgICAgIGNyaXQ6IDVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNvbmdmbG93ZXIgU2VyYW5hZGVcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgY3JpdDogNSxcbiAgICAgICAgICAgIHN0cjogMTUsXG4gICAgICAgICAgICBhZ2k6IDE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTcGlyaXQgb2YgWmFuZGFsYXJcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RhdE11bHQ6IDEuMTVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkZlbmd1cycgRmVyb2NpdHlcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDIwMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiV2FyY2hpZWYncyBCbGVzc2luZ1wiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBoYXN0ZTogMS4xNVxuICAgICAgICB9XG4gICAgfSxcbl0ubWFwKChiZDogQnVmZkRlc2NyaXB0aW9uKSA9PiBuZXcgQnVmZihiZC5uYW1lLCBiZC5kdXJhdGlvbiwgYmQuc3RhdHMpKTtcblxuLy8gTk9URTogdG8gc2ltcGxpZnkgdGhlIGNvZGUsIHRyZWF0aW5nIHRoZXNlIGFzIHR3byBzZXBhcmF0ZSBidWZmcyBzaW5jZSB0aGV5IHN0YWNrXG4vLyBjcnVzYWRlciBidWZmcyBhcHBhcmVudGx5IGNhbiBiZSBmdXJ0aGVyIHN0YWNrZWQgYnkgc3dhcHBpbmcgd2VhcG9ucyBidXQgbm90IGdvaW5nIHRvIGJvdGhlciB3aXRoIHRoYXRcbmV4cG9ydCBjb25zdCBjcnVzYWRlckJ1ZmZNSFByb2MgPSBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiQ3J1c2FkZXIgTUhcIiwgMTUsIG5ldyBTdGF0cyh7c3RyOiAxMDB9KSkpLCB7cHBtOiAxfSk7XG5leHBvcnQgY29uc3QgY3J1c2FkZXJCdWZmT0hQcm9jID0gbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE9IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pO1xuXG5leHBvcnQgY29uc3QgZGVuc2VEYW1hZ2VTdG9uZSA9IG5ldyBUZW1wb3JhcnlXZWFwb25FbmNoYW50KHsgcGx1c0RhbWFnZTogOCB9KTtcblxuZXhwb3J0IGNvbnN0IHdpbmRmdXJ5RW5jaGFudCA9IG5ldyBUZW1wb3JhcnlXZWFwb25FbmNoYW50KHVuZGVmaW5lZCwgbmV3IFByb2MoW1xuICAgIG5ldyBFeHRyYUF0dGFjayhcIldpbmRmdXJ5IFRvdGVtXCIsIDEpLFxuICAgIG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJXaW5kZnVyeSBUb3RlbVwiLCAxLjUsIHsgYXA6IDMxNSB9KSlcbl0sIHtjaGFuY2U6IDAuMn0pKTtcbiIsImltcG9ydCB7IFdlYXBvblR5cGUsIFdlYXBvbkRlc2NyaXB0aW9uLCBJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uIH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcbmltcG9ydCB7IFNwZWxsQnVmZiwgRXh0cmFBdHRhY2ssIFByb2MsIFNwZWxsVHlwZSwgSXRlbVNwZWxsRGFtYWdlIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmUHJvYyB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5cbi8vIFRPRE8gLSBob3cgdG8gaW1wbGVtZW50IHNldCBib251c2VzPyBwcm9iYWJseSBlYXNpZXN0IHRvIGFkZCBib251cyB0aGF0IHJlcXVpcmVzIGEgc3RyaW5nIHNlYXJjaCBvZiBvdGhlciBlcXVpcGVkIGl0ZW1zXG5cbmV4cG9ydCBjb25zdCBpdGVtczogKEl0ZW1EZXNjcmlwdGlvbnxXZWFwb25EZXNjcmlwdGlvbilbXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSXJvbmZvZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBtaW46IDczLFxuICAgICAgICBtYXg6IDEzNixcbiAgICAgICAgc3BlZWQ6IDIuNCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBFeHRyYUF0dGFjaygnSXJvbmZvZScsIDIpLHtwcG06IDF9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVtcHlyZWFuIERlbW9saXNoZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiA5NCxcbiAgICAgICAgbWF4OiAxNzUsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiSGFzdGUgKEVtcHlyZWFuIERlbW9saXNoZXIpXCIsIDEwLCB7aGFzdGU6IDEuMn0pKSx7cHBtOiAxfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJBbnViaXNhdGggV2FyaGFtbWVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA2NixcbiAgICAgICAgbWF4OiAxMjMsXG4gICAgICAgIHNwZWVkOiAxLjgsXG4gICAgICAgIHN0YXRzOiB7IG1hY2VTa2lsbDogNCwgYXA6IDMyIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaGUgVW50YW1lZCBCbGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JEMkgsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDE5MixcbiAgICAgICAgbWF4OiAyODksXG4gICAgICAgIHNwZWVkOiAzLjQsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiVW50YW1lZCBGdXJ5XCIsIDgsIHtzdHI6IDMwMH0pKSx7cHBtOiAyfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJIYW5kIG9mIEp1c3RpY2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHthcDogMjB9LFxuICAgICAgICBvbmVxdWlwOiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0hhbmQgb2YgSnVzdGljZScsIDEpLCB7Y2hhbmNlOiAyLzEwMH0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxhY2toYW5kJ3MgQnJlYWR0aFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJha2UgRmFuZyBUYWxpc21hblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiA1NiwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkxpb25oZWFydCBIZWxtXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMiwgaGl0OiAyLCBzdHI6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhcmJlZCBDaG9rZXJcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthcDogNDQsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiT255eGlhIFRvb3RoIFBlbmRhbnRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDEyLCBoaXQ6IDEsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgU3BhdWxkZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTYsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDbG9hayBvZiBEcmFjb25pYyBNaWdodFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge3N0cjogMTYsIGFnaTogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJhcGUgb2YgVW55aWVsZGluZyBTdHJlbmd0aFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge3N0cjogMTUsIGFnaTogOSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNvbnF1ZXJvcidzIEJyZWFzdHBsYXRlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTYsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTYXZhZ2UgR2xhZGlhdG9yIENoYWluXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge2FnaTogMTQsIHN0cjogMTMsIGNyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2hvdWwgU2tpbiBUdW5pY1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDQwLCBjcml0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJyZWFzdHBsYXRlIG9mIEFubmloaWxhdGlvblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDM3LCBjcml0OiAxLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSGl2ZSBEZWZpbGVyIFdyaXN0Z3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjMsIGFnaTogMTh9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUWlyYWppIEV4ZWN1dGlvbiBCcmFjZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge2FnaTogMTYsIHN0cjogMTUsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgTWlnaHRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdhdW50bGV0cyBvZiBBbm5paGlsYXRpb25cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzNSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVkZ2VtYXN0ZXIncyBIYW5kZ3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czogeyBheGVTa2lsbDogNywgZGFnZ2VyU2tpbGw6IDcsIHN3b3JkU2tpbGw6IDcgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9uc2xhdWdodCBHaXJkbGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV0FJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRpdGFuaWMgTGVnZ2luZ3NcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDMwLCBjcml0OiAxLCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQm9vdHMgb2YgdGhlIEZhbGxlbiBIZXJvXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNocm9tYXRpYyBCb290c1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMjAsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTdHJpa2VyJ3MgTWFya1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SQU5HRUQsXG4gICAgICAgIHN0YXRzOiB7YXA6IDIyLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRG9uIEp1bGlvJ3MgQmFuZFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHtjcml0OiAxLCBoaXQ6IDEsIGFwOiAxNn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJRdWljayBTdHJpa2UgUmluZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthcDogMzAsIGNyaXQ6IDEsIHN0cjogNX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJWaXMna2FnIHRoZSBCbG9vZGxldHRlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEwMCxcbiAgICAgICAgbWF4OiAxODcsXG4gICAgICAgIHNwZWVkOiAyLjYsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgSXRlbVNwZWxsRGFtYWdlKFwiRmF0YWwgV291bmRzXCIsIDI0MCwgU3BlbGxUeXBlLlBIWVNJQ0FMKSx7cHBtOiAxLjN9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNocm9tYXRpY2FsbHkgVGVtcGVyZWQgU3dvcmRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDYsXG4gICAgICAgIG1heDogMTk4LFxuICAgICAgICBzcGVlZDogMi42LFxuICAgICAgICBzdGF0czogeyBhZ2k6IDE0LCBzdHI6IDE0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJNYWxhZGF0aCwgUnVuZWQgQmxhZGUgb2YgdGhlIEJsYWNrIEZsaWdodFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDg2LFxuICAgICAgICBtYXg6IDE2MixcbiAgICAgICAgc3BlZWQ6IDIuMixcbiAgICAgICAgc3RhdHM6IHsgc3dvcmRTa2lsbDogNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQW5jaWVudCBRaXJhamkgUmlwcGVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTE0LFxuICAgICAgICBtYXg6IDIxMyxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDIwIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgTG9uZ3N3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgU3dpZnRibGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDg1LFxuICAgICAgICBtYXg6IDEyOSxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgQXhlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEzOCxcbiAgICAgICAgbWF4OiAyMDcsXG4gICAgICAgIHNwZWVkOiAyLjksXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3NlZCBRaXJhamkgV2FyIEF4ZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMTAsXG4gICAgICAgIG1heDogMjA1LFxuICAgICAgICBzcGVlZDogMi42MCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDE0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDcnVsJ3Nob3J1a2gsIEVkZ2Ugb2YgQ2hhb3NcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTAxLFxuICAgICAgICBtYXg6IDE4OCxcbiAgICAgICAgc3BlZWQ6IDIuMzAsXG4gICAgICAgIHN0YXRzOiB7IGFwOiAzNiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRGVhdGhicmluZ2VyIChXL08gUFJPQylcIiwgLy8gVE9ET1xuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMTQsXG4gICAgICAgIG1heDogMjEzLFxuICAgICAgICBzcGVlZDogMi45MFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRvb20ncyBFZGdlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDgzLFxuICAgICAgICBtYXg6IDE1NCxcbiAgICAgICAgc3BlZWQ6IDIuMzAsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogMTYsIHN0cjogOSB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgb251c2U6ICgoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnNpZ2h0T2ZUaGVRaXJhamkgPSBuZXcgQnVmZihcIkluc2lnaHQgb2YgdGhlIFFpcmFqaVwiLCAzMCwge2FybW9yUGVuZXRyYXRpb246IDIwMH0sIHRydWUsIDAsIDYpO1xuICAgICAgICAgICAgY29uc3QgYmFkZ2VCdWZmID0gbmV3IFNwZWxsQnVmZihcbiAgICAgICAgICAgICAgICBuZXcgQnVmZlByb2MoXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiLCAzMCxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFByb2MobmV3IFNwZWxsQnVmZihpbnNpZ2h0T2ZUaGVRaXJhamkpLCB7cHBtOiAxNX0pLFxuICAgICAgICAgICAgICAgICAgICBpbnNpZ2h0T2ZUaGVRaXJhamkpLFxuICAgICAgICAgICAgICAgIGZhbHNlLCAwLCAzICogNjApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gYmFkZ2VCdWZmO1xuICAgICAgICB9KSgpXG4gICAgfVxuXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4Rm9ySXRlbU5hbWUobmFtZTogc3RyaW5nKTogbnVtYmVyfHVuZGVmaW5lZCB7XG4gICAgZm9yIChsZXQgW2lkeCwgaXRlbV0gb2YgaXRlbXMuZW50cmllcygpKSB7XG4gICAgICAgIGlmIChpdGVtLm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBpZHg7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1XaXRoU2xvdCB9IGZyb20gXCIuL3NpbXVsYXRpb24uanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgV2FycmlvciB9IGZyb20gXCIuL3dhcnJpb3IuanNcIjtcbmltcG9ydCB7IGNydXNhZGVyQnVmZk1IUHJvYywgY3J1c2FkZXJCdWZmT0hQcm9jLCBidWZmcywgd2luZGZ1cnlFbmNoYW50LCBkZW5zZURhbWFnZVN0b25lIH0gZnJvbSBcIi4vZGF0YS9zcGVsbHMuanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IGl0ZW1zIH0gZnJvbSBcIi4vZGF0YS9pdGVtcy5qc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNpbXVsYXRpb25EZXNjcmlwdGlvbiB7XG4gICAgcmFjZTogUmFjZSxcbiAgICBzdGF0czogU3RhdFZhbHVlcyxcbiAgICBlcXVpcG1lbnQ6IFtudW1iZXIsIEl0ZW1TbG90XVtdLFxuICAgIGJ1ZmZzOiBudW1iZXJbXSxcbiAgICBmaWdodExlbmd0aDogbnVtYmVyLFxuICAgIHJlYWx0aW1lOiBib29sZWFuLFxuICAgIGhlcm9pY1N0cmlrZVJhZ2VSZXE6IG51bWJlcixcbiAgICBoYW1zdHJpbmdSYWdlUmVxOiBudW1iZXIsXG4gICAgYmxvb2R0aGlyc3RFeGVjUmFnZUxpbWl0OiBudW1iZXIsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cFBsYXllcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBJdGVtV2l0aFNsb3RbXSwgYnVmZnM6IEJ1ZmZbXSwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICBjb25zdCBwbGF5ZXIgPSBuZXcgV2FycmlvcihyYWNlLCBzdGF0cywgbG9nKTtcblxuICAgIGZvciAobGV0IFtpdGVtLCBzbG90XSBvZiBlcXVpcG1lbnQpIHtcbiAgICAgICAgcGxheWVyLmVxdWlwKGl0ZW0sIHNsb3QpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGJ1ZmYgb2YgYnVmZnMpIHtcbiAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChidWZmLCAwKTtcbiAgICB9XG5cbiAgICBwbGF5ZXIubWghLmFkZFByb2MoY3J1c2FkZXJCdWZmTUhQcm9jKTtcbiAgICBwbGF5ZXIubWghLnRlbXBvcmFyeUVuY2hhbnQgPSByYWNlID09PSBSYWNlLk9SQyA/IHdpbmRmdXJ5RW5jaGFudCA6IGRlbnNlRGFtYWdlU3RvbmU7XG5cbiAgICBpZiAocGxheWVyLm9oKSB7XG4gICAgICAgIHBsYXllci5vaC5hZGRQcm9jKGNydXNhZGVyQnVmZk9IUHJvYyk7XG4gICAgICAgIHBsYXllci5vaC50ZW1wb3JhcnlFbmNoYW50ID0gZGVuc2VEYW1hZ2VTdG9uZTtcbiAgICB9XG5cbiAgICBjb25zdCBib3NzID0gbmV3IFVuaXQoNjMsIDQ2OTEgLSAyMjUwIC0gNjQwIC0gNTA1IC0gNjAwKTsgLy8gc3VuZGVyLCBjb3IsIGZmLCBhbm5paFxuICAgIHBsYXllci50YXJnZXQgPSBib3NzO1xuXG4gICAgcmV0dXJuIHBsYXllcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVxdWlwbWVudEluZGljZXNUb0l0ZW0oZXF1aXBtZW50OiBbbnVtYmVyLCBJdGVtU2xvdF1bXSk6IEl0ZW1XaXRoU2xvdFtdIHtcbiAgICBjb25zdCByZXM6IEl0ZW1XaXRoU2xvdFtdID0gW107XG4gICAgXG4gICAgZm9yIChsZXQgW2lkeCwgc2xvdF0gb2YgZXF1aXBtZW50KSB7XG4gICAgICAgIGlmIChpdGVtc1tpZHhdKSB7XG4gICAgICAgICAgICByZXMucHVzaChbaXRlbXNbaWR4XSwgc2xvdF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2JhZCBpdGVtIGluZGV4JywgaWR4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWZmSW5kaWNlc1RvQnVmZihidWZmSW5kaWNlczogbnVtYmVyW10pOiBCdWZmW10ge1xuICAgIGNvbnN0IHJlczogQnVmZltdID0gW107XG5cbiAgICBmb3IgKGxldCBpZHggb2YgYnVmZkluZGljZXMpIHtcbiAgICAgICAgaWYgKGJ1ZmZzW2lkeF0pIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGJ1ZmZzW2lkeF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2JhZCBidWZmIGluZGV4JywgaWR4KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzO1xufVxuIiwiaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgSXRlbURlc2NyaXB0aW9uLCBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiwgUGxheWVyLCBSYWNlLCBEYW1hZ2VMb2cgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IHNldHVwUGxheWVyIH0gZnJvbSBcIi4vc2ltdWxhdGlvbl91dGlscy5qc1wiO1xuXG5leHBvcnQgdHlwZSBJdGVtV2l0aFNsb3QgPSBbSXRlbURlc2NyaXB0aW9uLCBJdGVtU2xvdF07XG5cbi8vIFRPRE8gLSBjaGFuZ2UgdGhpcyBpbnRlcmZhY2Ugc28gdGhhdCBDaG9vc2VBY3Rpb24gY2Fubm90IHNjcmV3IHVwIHRoZSBzaW0gb3IgY2hlYXRcbi8vIGUuZy4gQ2hvb3NlQWN0aW9uIHNob3VsZG4ndCBjYXN0IHNwZWxscyBhdCBhIGN1cnJlbnQgdGltZVxuZXhwb3J0IHR5cGUgQ2hvb3NlQWN0aW9uID0gKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXIsIGNhbkV4ZWN1dGU6IGJvb2xlYW4pID0+IG51bWJlcnx1bmRlZmluZWQ7XG5cbmV4cG9ydCBjb25zdCBFWEVDVVRFX1BIQVNFX1JBVElPID0gMC4xNTsgLy8gbGFzdCAxNSUgb2YgdGhlIHRpbWUgaXMgZXhlY3V0ZSBwaGFzZVxuXG5jbGFzcyBGaWdodCB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG4gICAgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb247XG4gICAgZmlnaHRMZW5ndGg6IG51bWJlcjtcbiAgICBkdXJhdGlvbiA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBJdGVtV2l0aFNsb3RbXSwgYnVmZnM6IEJ1ZmZbXSwgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb24sIGZpZ2h0TGVuZ3RoID0gNjAsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHRoaXMucGxheWVyID0gc2V0dXBQbGF5ZXIocmFjZSwgc3RhdHMsIGVxdWlwbWVudCwgYnVmZnMsIGxvZyk7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gKGZpZ2h0TGVuZ3RoICsgTWF0aC5yYW5kb20oKSAqIDQgLSAyKSAqIDEwMDA7XG4gICAgfVxuXG4gICAgcnVuKCk6IFByb21pc2U8RmlnaHRSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmLCByKSA9PiB7XG4gICAgICAgICAgICB3aGlsZSAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZih7XG4gICAgICAgICAgICAgICAgZGFtYWdlTG9nOiB0aGlzLnBsYXllci5kYW1hZ2VMb2csXG4gICAgICAgICAgICAgICAgZmlnaHRMZW5ndGg6IHRoaXMuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICAgICAgcG93ZXJMb3N0OiB0aGlzLnBsYXllci5wb3dlckxvc3RcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwYXVzZShwYXVzZTogYm9vbGVhbikge31cblxuICAgIGNhbmNlbCgpIHt9XG5cbiAgICBwcm90ZWN0ZWQgdXBkYXRlKCkge1xuICAgICAgICBjb25zdCBiZWdpbkV4ZWN1dGVUaW1lID0gdGhpcy5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG4gICAgICAgIGNvbnN0IGlzRXhlY3V0ZVBoYXNlID0gdGhpcy5kdXJhdGlvbiA+PSBiZWdpbkV4ZWN1dGVUaW1lO1xuXG4gICAgICAgIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLnVwZGF0ZSh0aGlzLmR1cmF0aW9uKTsgLy8gbmVlZCB0byBjYWxsIHRoaXMgaWYgdGhlIGR1cmF0aW9uIGNoYW5nZWQgYmVjYXVzZSBvZiBidWZmcyB0aGF0IGNoYW5nZSBvdmVyIHRpbWUgbGlrZSBqb20gZ2FiYmVyXG5cbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24odGhpcy5wbGF5ZXIsIHRoaXMuZHVyYXRpb24sIHRoaXMuZmlnaHRMZW5ndGgsIGlzRXhlY3V0ZVBoYXNlKTsgLy8gY2hvb3NlIGFjdGlvbiBiZWZvcmUgaW4gY2FzZSBvZiBhY3Rpb24gZGVwZW5kaW5nIG9uIHRpbWUgb2ZmIHRoZSBnY2QgbGlrZSBlYXJ0aHN0cmlrZVxuXG4gICAgICAgIHRoaXMucGxheWVyLnVwZGF0ZUF0dGFja2luZ1N0YXRlKHRoaXMuZHVyYXRpb24pO1xuICAgICAgICAvLyBjaG9vc2UgYWN0aW9uIGFmdGVyIGV2ZXJ5IHN3aW5nIHdoaWNoIGNvdWxkIGJlIGEgcmFnZSBnZW5lcmF0aW5nIGV2ZW50LCBidXQgVE9ETzogbmVlZCB0byBhY2NvdW50IGZvciBsYXRlbmN5LCByZWFjdGlvbiB0aW1lIChidXR0b24gbWFzaGluZylcbiAgICAgICAgY29uc3Qgd2FpdGluZ0ZvclRpbWUgPSB0aGlzLmNob29zZUFjdGlvbih0aGlzLnBsYXllciwgdGhpcy5kdXJhdGlvbiwgdGhpcy5maWdodExlbmd0aCwgaXNFeGVjdXRlUGhhc2UpO1xuXG4gICAgICAgIGxldCBuZXh0U3dpbmdUaW1lID0gdGhpcy5wbGF5ZXIubWghLm5leHRTd2luZ1RpbWU7XG5cbiAgICAgICAgaWYgKHRoaXMucGxheWVyLm9oKSB7XG4gICAgICAgICAgICBuZXh0U3dpbmdUaW1lID0gTWF0aC5taW4obmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIub2gubmV4dFN3aW5nVGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0ZW1wb3JhcnkgaGFja1xuICAgICAgICBpZiAodGhpcy5wbGF5ZXIuZXh0cmFBdHRhY2tDb3VudCkge1xuICAgICAgICAgICAgLy8gZG9uJ3QgaW5jcmVtZW50IGR1cmF0aW9uIChUT0RPOiBidXQgSSByZWFsbHkgc2hvdWxkIGJlY2F1c2UgdGhlIHNlcnZlciBkb2Vzbid0IGxvb3AgaW5zdGFudGx5KVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGxheWVyLm5leHRHQ0RUaW1lID4gdGhpcy5kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IE1hdGgubWluKHRoaXMucGxheWVyLm5leHRHQ0RUaW1lLCBuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5idWZmTWFuYWdlci5uZXh0T3ZlclRpbWVVcGRhdGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IE1hdGgubWluKG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLm5leHRPdmVyVGltZVVwZGF0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FpdGluZ0ZvclRpbWUgJiYgd2FpdGluZ0ZvclRpbWUgPCB0aGlzLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gd2FpdGluZ0ZvclRpbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzRXhlY3V0ZVBoYXNlICYmIGJlZ2luRXhlY3V0ZVRpbWUgPCB0aGlzLmR1cmF0aW9uKSB7IC8vIG5vdCBleGVjdXRlIGF0IHN0YXJ0IG9mIHVwZGF0ZVxuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIFJlYWx0aW1lRmlnaHQgZXh0ZW5kcyBGaWdodCB7XG4gICAgcHJvdGVjdGVkIHBhdXNlZCA9IGZhbHNlO1xuXG4gICAgcnVuKCk6IFByb21pc2U8RmlnaHRSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgTVNfUEVSX1VQREFURSA9IDEwMDAgLyA2MDtcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIGxldCBvdmVycmlkZUR1cmF0aW9uID0gMDtcblxuICAgICAgICAgICAgY29uc3QgbG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVycmlkZUR1cmF0aW9uICs9IE1TX1BFUl9VUERBVEU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gb3ZlcnJpZGVEdXJhdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGxvb3AsIE1TX1BFUl9VUERBVEUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGYoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZGFtYWdlTG9nOiB0aGlzLnBsYXllci5kYW1hZ2VMb2csXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogdGhpcy5maWdodExlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogdGhpcy5wbGF5ZXIucG93ZXJMb3N0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldFRpbWVvdXQobG9vcCwgTVNfUEVSX1VQREFURSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHBhdXNlKHBhdXNlOiBib29sZWFuKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gcGF1c2U7XG4gICAgfVxufVxuXG5leHBvcnQgdHlwZSBGaWdodFJlc3VsdCA9IHsgZGFtYWdlTG9nOiBEYW1hZ2VMb2csIGZpZ2h0TGVuZ3RoOiBudW1iZXIsIHBvd2VyTG9zdDogbnVtYmVyfTtcblxuZXhwb3J0IHR5cGUgU2ltdWxhdGlvblN1bW1hcnkgPSB7XG4gICAgbm9ybWFsRGFtYWdlOiBudW1iZXIsXG4gICAgZXhlY0RhbWFnZTogbnVtYmVyLFxuICAgIG5vcm1hbER1cmF0aW9uOiBudW1iZXIsXG4gICAgZXhlY0R1cmF0aW9uOiBudW1iZXIsXG4gICAgcG93ZXJMb3N0OiBudW1iZXIsXG4gICAgZmlnaHRzOiBudW1iZXIsXG59O1xuXG5leHBvcnQgdHlwZSBTdGF0dXNIYW5kbGVyID0gKHN0YXR1czogU2ltdWxhdGlvblN1bW1hcnkpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBTaW11bGF0aW9uIHtcbiAgICByYWNlOiBSYWNlO1xuICAgIHN0YXRzOiBTdGF0VmFsdWVzO1xuICAgIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W107XG4gICAgYnVmZnM6IEJ1ZmZbXTtcbiAgICBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbjtcbiAgICBwcm90ZWN0ZWQgZmlnaHRMZW5ndGg6IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgcmVhbHRpbWU6IGJvb2xlYW47XG4gICAgbG9nPzogTG9nRnVuY3Rpb25cblxuICAgIHByb3RlY3RlZCByZXF1ZXN0U3RvcCA9IGZhbHNlO1xuICAgIHByb3RlY3RlZCBfcGF1c2VkID0gZmFsc2U7XG5cbiAgICBmaWdodFJlc3VsdHM6IEZpZ2h0UmVzdWx0W10gPSBbXTtcblxuICAgIGN1cnJlbnRGaWdodD86IEZpZ2h0O1xuXG4gICAgcHJvdGVjdGVkIGNhY2hlZFN1bW1tYXJ5OiBTaW11bGF0aW9uU3VtbWFyeSA9IHsgbm9ybWFsRGFtYWdlOiAwLCBleGVjRGFtYWdlOiAwLCBub3JtYWxEdXJhdGlvbjogMCwgZXhlY0R1cmF0aW9uOiAwLCBwb3dlckxvc3Q6IDAsIGZpZ2h0czogMCB9O1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCByZWFsdGltZSA9IGZhbHNlLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICB0aGlzLnJhY2UgPSByYWNlO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuZXF1aXBtZW50ID0gZXF1aXBtZW50O1xuICAgICAgICB0aGlzLmJ1ZmZzID0gYnVmZnM7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gZmlnaHRMZW5ndGg7XG4gICAgICAgIHRoaXMucmVhbHRpbWUgPSByZWFsdGltZTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IHBhdXNlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhdXNlZDtcbiAgICB9XG5cbiAgICBnZXQgc3RhdHVzKCk6IFNpbXVsYXRpb25TdW1tYXJ5IHtcbiAgICAgICAgZm9yIChsZXQgZmlnaHRSZXN1bHQgb2YgdGhpcy5maWdodFJlc3VsdHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSBmaWdodFJlc3VsdC5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IFt0aW1lLCBkYW1hZ2VdIG9mIGZpZ2h0UmVzdWx0LmRhbWFnZUxvZykge1xuICAgICAgICAgICAgICAgIGlmICh0aW1lID49IGJlZ2luRXhlY3V0ZVRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWNoZWRTdW1tbWFyeS5leGVjRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbERhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbER1cmF0aW9uICs9IGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEdXJhdGlvbiArPSBmaWdodFJlc3VsdC5maWdodExlbmd0aCAtIGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgICAgICB0aGlzLmNhY2hlZFN1bW1tYXJ5LnBvd2VyTG9zdCArPSBmaWdodFJlc3VsdC5wb3dlckxvc3Q7XG5cbiAgICAgICAgICAgIHRoaXMuY2FjaGVkU3VtbW1hcnkuZmlnaHRzKys7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpZ2h0UmVzdWx0cyA9IFtdO1xuXG4gICAgICAgIGxldCBub3JtYWxEYW1hZ2UgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5Lm5vcm1hbERhbWFnZTtcbiAgICAgICAgbGV0IGV4ZWNEYW1hZ2UgPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEYW1hZ2U7XG4gICAgICAgIGxldCBub3JtYWxEdXJhdGlvbiA9IHRoaXMuY2FjaGVkU3VtbW1hcnkubm9ybWFsRHVyYXRpb247XG4gICAgICAgIGxldCBleGVjRHVyYXRpb24gPSB0aGlzLmNhY2hlZFN1bW1tYXJ5LmV4ZWNEdXJhdGlvbjtcbiAgICAgICAgbGV0IHBvd2VyTG9zdCA9IHRoaXMuY2FjaGVkU3VtbW1hcnkucG93ZXJMb3N0O1xuICAgICAgICBsZXQgZmlnaHRzID0gdGhpcy5jYWNoZWRTdW1tbWFyeS5maWdodHM7XG5cbiAgICAgICAgaWYgKHRoaXMucmVhbHRpbWUgJiYgdGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSB0aGlzLmN1cnJlbnRGaWdodC5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IFt0aW1lLCBkYW1hZ2VdIG9mIHRoaXMuY3VycmVudEZpZ2h0LnBsYXllci5kYW1hZ2VMb2cpIHtcbiAgICAgICAgICAgICAgICBpZiAodGltZSA+PSBiZWdpbkV4ZWN1dGVUaW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWNEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5vcm1hbERhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub3JtYWxEdXJhdGlvbiArPSBNYXRoLm1pbihiZWdpbkV4ZWN1dGVUaW1lLCB0aGlzLmN1cnJlbnRGaWdodC5kdXJhdGlvbik7XG4gICAgICAgICAgICBleGVjRHVyYXRpb24gKz0gTWF0aC5tYXgoMCwgdGhpcy5jdXJyZW50RmlnaHQuZHVyYXRpb24gLSBiZWdpbkV4ZWN1dGVUaW1lKTtcbiAgICAgICAgICAgIHBvd2VyTG9zdCArPSB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIucG93ZXJMb3N0O1xuICAgICAgICAgICAgZmlnaHRzKys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbm9ybWFsRGFtYWdlOiBub3JtYWxEYW1hZ2UsXG4gICAgICAgICAgICBleGVjRGFtYWdlOiBleGVjRGFtYWdlLFxuICAgICAgICAgICAgbm9ybWFsRHVyYXRpb246IG5vcm1hbER1cmF0aW9uLFxuICAgICAgICAgICAgZXhlY0R1cmF0aW9uOiBleGVjRHVyYXRpb24sXG4gICAgICAgICAgICBwb3dlckxvc3Q6IHBvd2VyTG9zdCxcbiAgICAgICAgICAgIGZpZ2h0czogZmlnaHRzLFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhcnQoKSB7XG4gICAgICAgIGNvbnN0IGZpZ2h0Q2xhc3MgPSB0aGlzLnJlYWx0aW1lID8gUmVhbHRpbWVGaWdodCA6IEZpZ2h0O1xuXG4gICAgICAgIGNvbnN0IG91dGVybG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAxMDApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICAgICAgY29uc3QgaW5uZXJsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjb3VudCA+IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KG91dGVybG9vcCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodCA9IG5ldyBmaWdodENsYXNzKHRoaXMucmFjZSwgdGhpcy5zdGF0cywgdGhpcy5lcXVpcG1lbnQsIHRoaXMuYnVmZnMsIHRoaXMuY2hvb3NlQWN0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCB0aGlzLnJlYWx0aW1lID8gdGhpcy5sb2cgOiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0LnJ1bigpLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpZ2h0UmVzdWx0cy5wdXNoKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgIGlubmVybG9vcCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghdGhpcy5yZXF1ZXN0U3RvcCkge1xuICAgICAgICAgICAgICAgIGlubmVybG9vcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIG91dGVybG9vcCgpO1xuICAgIH1cblxuICAgIHBhdXNlKHBhdXNlOiBib29sZWFufHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAocGF1c2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcGF1c2UgPSAhdGhpcy5wYXVzZWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wYXVzZWQgPSBwYXVzZTtcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEZpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodC5wYXVzZShwYXVzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3RTdG9wID0gdHJ1ZTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2FycmlvclwiO1xuaW1wb3J0IHsgSXRlbVNsb3QgfSBmcm9tIFwiLi9pdGVtXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXJcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ2hvb3NlQWN0aW9uKGhlcm9pY1N0cmlrZVJhZ2VSZXE6IG51bWJlciwgaGFtc3RyaW5nUmFnZVJlcTogbnVtYmVyLCBibG9vZHRoaXJzdEV4ZWNSYWdlTGltaXQ6IG51bWJlcikge1xuICAgIHJldHVybiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlciwgZXhlY3V0ZVBoYXNlOiBib29sZWFuKTogbnVtYmVyfHVuZGVmaW5lZCA9PiB7XG4gICAgICAgIGNvbnN0IHdhcnJpb3IgPSA8V2Fycmlvcj5wbGF5ZXI7XG4gICAgXG4gICAgICAgIGNvbnN0IHRpbWVSZW1haW5pbmdTZWNvbmRzID0gKGZpZ2h0TGVuZ3RoIC0gdGltZSkgLyAxMDAwO1xuICAgIFxuICAgICAgICBjb25zdCB1c2VJdGVtQnlOYW1lID0gKHNsb3Q6IEl0ZW1TbG90LCBuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW0gPSBwbGF5ZXIuaXRlbXMuZ2V0KHNsb3QpO1xuICAgICAgICAgICAgaWYgKGl0ZW0gJiYgaXRlbS5pdGVtLm5hbWUgPT09IG5hbWUgJiYgaXRlbS5vbnVzZSAmJiBpdGVtLm9udXNlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5vbnVzZS5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXG4gICAgICAgIGlmICh3YXJyaW9yLnJhZ2UgPCAzMCAmJiB3YXJyaW9yLmJsb29kUmFnZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICB3YXJyaW9yLmJsb29kUmFnZS5jYXN0KHRpbWUpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIGxldCB3YWl0aW5nRm9yVGltZTogbnVtYmVyfHVuZGVmaW5lZDtcbiAgICBcbiAgICAgICAgLy8gZ2NkIHNwZWxsc1xuICAgICAgICBpZiAod2Fycmlvci5uZXh0R0NEVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICBpZiAod2Fycmlvci5kZWF0aFdpc2guY2FuQ2FzdCh0aW1lKSAmJlxuICAgICAgICAgICAgICAgICh0aW1lUmVtYWluaW5nU2Vjb25kcyA8PSAzMFxuICAgICAgICAgICAgICAgIHx8ICh0aW1lUmVtYWluaW5nU2Vjb25kcyAtIHdhcnJpb3IuZGVhdGhXaXNoLnNwZWxsLmNvb2xkb3duKSA+IDMwKSkgeyAvLyBjb3VsZCBiZSB0aW1lZCBiZXR0ZXJcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmRlYXRoV2lzaC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgICAgIHVzZUl0ZW1CeU5hbWUoSXRlbVNsb3QuVFJJTktFVDEsIFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIik7XG4gICAgICAgICAgICAgICAgdXNlSXRlbUJ5TmFtZShJdGVtU2xvdC5UUklOS0VUMiwgXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXhlY3V0ZVBoYXNlICYmIHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FuQ2FzdCh0aW1lKSAmJiB3YXJyaW9yLnJhZ2UgPCBibG9vZHRoaXJzdEV4ZWNSYWdlTGltaXQpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmJsb29kdGhpcnN0LmNhc3QodGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChleGVjdXRlUGhhc2UgJiYgd2Fycmlvci5leGVjdXRlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmV4ZWN1dGUuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5ibG9vZHRoaXJzdC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LnRpbWVSZW1haW5pbmcodGltZSkgPCAxLjUgKyAod2Fycmlvci5sYXRlbmN5IC8gMTAwMCkpIHtcbiAgICAgICAgICAgICAgICAvLyBub3Qgb3IgYWxtb3N0IG9mZiBjb29sZG93biwgd2FpdCBmb3IgcmFnZSBvciBjb29sZG93blxuICAgICAgICAgICAgICAgIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LmNvb2xkb3duID4gdGltZSkge1xuICAgICAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IHdhcnJpb3IuYmxvb2R0aGlyc3QuY29vbGRvd247XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLndoaXJsd2luZC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci53aGlybHdpbmQuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci53aGlybHdpbmQudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICAgICAgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLmNvb2xkb3duID4gdGltZSkge1xuICAgICAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IHdhcnJpb3Iud2hpcmx3aW5kLmNvb2xkb3duO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5yYWdlID49IGhhbXN0cmluZ1JhZ2VSZXEgJiYgd2Fycmlvci5oYW1zdHJpbmcuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3IuaGFtc3RyaW5nLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgaWYgKCFleGVjdXRlUGhhc2UgJiYgd2Fycmlvci5yYWdlID49IGhlcm9pY1N0cmlrZVJhZ2VSZXEgJiYgIXdhcnJpb3IucXVldWVkU3BlbGwpIHtcbiAgICAgICAgICAgIHdhcnJpb3IucXVldWVkU3BlbGwgPSB3YXJyaW9yLmhlcm9pY1N0cmlrZTtcbiAgICAgICAgICAgIGlmICh3YXJyaW9yLmxvZykgd2Fycmlvci5sb2codGltZSwgJ3F1ZXVlaW5nIGhlcm9pYyBzdHJpa2UnKTtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICByZXR1cm4gd2FpdGluZ0ZvclRpbWU7XG4gICAgfTtcbn1cbiIsImltcG9ydCB7ICBNYWluVGhyZWFkSW50ZXJmYWNlIH0gZnJvbSBcIi4vd29ya2VyX2V2ZW50X2ludGVyZmFjZS5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbiB9IGZyb20gXCIuL3NpbXVsYXRpb24uanNcIjtcbmltcG9ydCB7IFNpbXVsYXRpb25EZXNjcmlwdGlvbiwgYnVmZkluZGljZXNUb0J1ZmYsIGVxdWlwbWVudEluZGljZXNUb0l0ZW0gfSBmcm9tIFwiLi9zaW11bGF0aW9uX3V0aWxzLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgZ2VuZXJhdGVDaG9vc2VBY3Rpb24gfSBmcm9tIFwiLi93YXJyaW9yX2FpLmpzXCI7XG5cbmNvbnN0IG1haW5UaHJlYWRJbnRlcmZhY2UgPSBNYWluVGhyZWFkSW50ZXJmYWNlLmluc3RhbmNlO1xuXG5sZXQgY3VycmVudFNpbTogU2ltdWxhdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbm1haW5UaHJlYWRJbnRlcmZhY2UuYWRkRXZlbnRMaXN0ZW5lcignc2ltdWxhdGUnLCAoZGF0YTogYW55KSA9PiB7XG4gICAgY29uc3Qgc2ltZGVzYyA9IDxTaW11bGF0aW9uRGVzY3JpcHRpb24+ZGF0YTtcblxuICAgIGxldCBsb2dGdW5jdGlvbjogTG9nRnVuY3Rpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKHNpbWRlc2MucmVhbHRpbWUpIHtcbiAgICAgICAgbG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIG1haW5UaHJlYWRJbnRlcmZhY2Uuc2VuZCgnbG9nJywge1xuICAgICAgICAgICAgICAgIHRpbWU6IHRpbWUsXG4gICAgICAgICAgICAgICAgdGV4dDogdGV4dFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgY3VycmVudFNpbSA9IG5ldyBTaW11bGF0aW9uKHNpbWRlc2MucmFjZSwgc2ltZGVzYy5zdGF0cyxcbiAgICAgICAgZXF1aXBtZW50SW5kaWNlc1RvSXRlbShzaW1kZXNjLmVxdWlwbWVudCksXG4gICAgICAgIGJ1ZmZJbmRpY2VzVG9CdWZmKHNpbWRlc2MuYnVmZnMpLFxuICAgICAgICBnZW5lcmF0ZUNob29zZUFjdGlvbihzaW1kZXNjLmhlcm9pY1N0cmlrZVJhZ2VSZXEsIHNpbWRlc2MuaGFtc3RyaW5nUmFnZVJlcSwgc2ltZGVzYy5ibG9vZHRoaXJzdEV4ZWNSYWdlTGltaXQpLFxuICAgICAgICBzaW1kZXNjLmZpZ2h0TGVuZ3RoLCBzaW1kZXNjLnJlYWx0aW1lLCBsb2dGdW5jdGlvbik7XG5cbiAgICBjdXJyZW50U2ltLnN0YXJ0KCk7XG5cbiAgICBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGlmIChjdXJyZW50U2ltICYmICFjdXJyZW50U2ltLnBhdXNlZCkge1xuICAgICAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdzdGF0dXMnLCBjdXJyZW50U2ltIS5zdGF0dXMpO1xuICAgICAgICB9XG4gICAgfSwgNTAwKTtcbn0pO1xuXG5tYWluVGhyZWFkSW50ZXJmYWNlLmFkZEV2ZW50TGlzdGVuZXIoJ3BhdXNlJywgKHBhdXNlOiBib29sZWFufHVuZGVmaW5lZCkgPT4ge1xuICAgIGlmIChjdXJyZW50U2ltKSB7XG4gICAgICAgIGN1cnJlbnRTaW0ucGF1c2UocGF1c2UpO1xuICAgIH1cbn0pO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE1BQU0sb0JBQW9CO0lBR3RCLFlBQVksTUFBVztRQUZ2QixtQkFBYyxHQUF1QyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRzNELE1BQU0sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFPO1lBQ3ZCLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDNUUsS0FBSyxJQUFJLFFBQVEsSUFBSSxzQkFBc0IsRUFBRTtnQkFDekMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUI7U0FDSixDQUFDO0tBQ0w7SUFFRCxnQkFBZ0IsQ0FBQyxLQUFhLEVBQUUsUUFBNkI7UUFDekQsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNoQyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxD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
