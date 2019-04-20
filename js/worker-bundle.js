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

class Spell {
    constructor(name, type, is_gcd, cost, cooldown, spellF) {
        this.name = name;
        this.type = type;
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
    constructor(name, bonusDamage, cost) {
        super(name, SpellType.PHYSICAL_WEAPON, false, cost, 0, () => { });
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
    constructor(name, amount, type, is_gcd = false, cost = 0, cooldown = 0, callback) {
        super(name, type, is_gcd, cost, cooldown, (player, time) => {
            const dmg = (typeof amount === "number") ? amount : amount(player);
            if (type === SpellType.PHYSICAL || type === SpellType.PHYSICAL_WEAPON) {
                player.dealMeleeDamage(time, dmg, player.target, true, this);
            }
        });
        this.callback = callback;
    }
}
class SpellDamage2 extends SpellDamage {
    constructor(name, amount, type) {
        super(name, amount, type, false, 0, 0);
    }
}
const fatalWounds = new SpellDamage2("Fatal Wounds", 240, SpellType.PHYSICAL);
class ExtraAttack extends Spell {
    constructor(name, count) {
        super(name, SpellType.NONE, false, 0, 0, (player, time) => {
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
        super(`SpellBuff(${buff.name})`, SpellType.BUFF, !!is_gcd, cost || 0, cooldown || 0, (player, time) => {
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
    calculateCritChance() {
        let crit = this.buffManager.stats.crit;
        crit += this.buffManager.stats.agi * this.buffManager.stats.statMult / 20;
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
    rollMeleeHitOutcome(victim, is_mh, spell) {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, spell) * 100);
        const dodge_chance = Math.round(victim.dodgeChance * 100);
        const crit_chance = Math.round(this.calculateCritChance() * 100);
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
        tmp = crit_chance + skillBonus;
        if (spell && spell.type == SpellType.PHYSICAL) {
            const overrideSkillBonusForCrit = 4 * (this.calculateWeaponSkillValue(is_mh, undefined) - victim.maxSkillForLevel);
            tmp = crit_chance + overrideSkillBonusForCrit;
        }
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
        this.updateProcs(time, is_mh, hitOutcome, damageDone, cleanDamage, spell);
        this.buffManager.update(time);
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
    calculateCritChance() {
        return 5 + 3 + super.calculateCritChance();
    }
    calculateMeleeDamage(rawDamage, victim, is_mh, spell) {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(rawDamage, victim, is_mh, spell);
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && spell) {
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
const heroicStrikeSpell = new SwingSpell("Heroic Strike", 157, 12);
const executeSpell = new SpellDamage("Execute", (player) => {
    return 600 + (player.power - 10) * 15;
}, SpellType.PHYSICAL_WEAPON, true, 10, 0, (player, hitOutcome) => {
    if (![MeleeHitOutcome.MELEE_HIT_PARRY, MeleeHitOutcome.MELEE_HIT_DODGE, MeleeHitOutcome.MELEE_HIT_MISS].includes(hitOutcome)) {
        player.power = 0;
    }
});
const bloodthirstSpell = new SpellDamage("Bloodthirst", (player) => {
    return player.ap * 0.45;
}, SpellType.PHYSICAL, true, 30, 6);
const whirlwindSpell = new SpellDamage("Whirlwind", (player) => {
    return player.calculateSwingRawDamage(true);
}, SpellType.PHYSICAL_WEAPON, true, 25, 10);
const hamstringSpell = new SpellDamage("Hamstring", 45, SpellType.PHYSICAL_WEAPON, true, 10, 0);
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
const bloodRage = new Spell("Bloodrage", SpellType.NONE, false, 0, 60, (player, time) => {
    player.power += 10;
    if (player.log)
        player.log(time, `You gain 10 rage from Bloodrage`);
    player.buffManager.add(bloodRageOT, time);
});
const deathWish = new SpellBuff(new Buff("Death Wish", 30, { damageMult: 1.2 }), true, 10, 3 * 60);
const unbridledWrath = new BuffProc("Unbridled Wrath", 60 * 60, new Proc(new Spell("Unbridled Wrath", SpellType.NONE, false, 0, 0, (player, time) => {
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
    pause() { }
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
        return new Promise((f, r) => {
            let overrideDuration = 0;
            const loop = () => {
                if (this.duration <= this.fightLength) {
                    if (!this.paused) {
                        this.update();
                        overrideDuration += 1000 / 60;
                        this.duration = overrideDuration;
                    }
                    requestAnimationFrame(loop);
                }
                else {
                    f({
                        damageLog: this.player.damageLog,
                        fightLength: this.fightLength,
                        powerLost: this.player.powerLost
                    });
                }
            };
            requestAnimationFrame(loop);
        });
    }
    pause() {
        this.paused = !this.paused;
    }
}
class Simulation {
    constructor(race, stats, equipment, buffs, chooseAction, fightLength = 60, realtime = false, log) {
        this.requestStop = false;
        this.paused = false;
        this.fightResults = [];
        this.race = race;
        this.stats = stats;
        this.equipment = equipment;
        this.buffs = buffs;
        this.chooseAction = chooseAction;
        this.fightLength = fightLength;
        this.realtime = realtime;
        this.log = log;
    }
    get status() {
        let normalDamage = 0;
        let execDamage = 0;
        let normalDuration = 0;
        let execDuration = 0;
        let powerLost = 0;
        for (let fightResult of this.fightResults) {
            const beginExecuteTime = fightResult.fightLength * (1 - EXECUTE_PHASE_RATIO);
            for (let [time, damage] of fightResult.damageLog) {
                if (time >= beginExecuteTime) {
                    execDamage += damage;
                }
                else {
                    normalDamage += damage;
                }
            }
            normalDuration += beginExecuteTime;
            execDuration += fightResult.fightLength - beginExecuteTime;
            powerLost += fightResult.powerLost;
        }
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
        }
        return {
            totalDamage: normalDamage + execDamage,
            normalDamage: normalDamage,
            execDamage: execDamage,
            duration: normalDuration + execDuration,
            normalDuration: normalDuration,
            execDuration: execDuration,
            powerLost: powerLost,
            fights: this.fightResults.length,
        };
    }
    start() {
        const fightClass = this.realtime ? RealtimeFight : Fight;
        const outerloop = () => {
            if (this.paused) {
                setTimeout(outerloop, 1000);
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
    pause() {
        this.paused = !this.paused;
        if (this.currentFight) {
            this.currentFight.pause();
        }
    }
    stop() {
        this.requestStop = true;
    }
}

function generateChooseAction(heroicStrikeRageReq, hamstringRageReq) {
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
            if (timeRemainingSeconds <= 30 && warrior.deathWish.canCast(time)) {
                warrior.deathWish.cast(time);
                useItemByName(ItemSlot.TRINKET1, "Badge of the Swarmguard");
                useItemByName(ItemSlot.TRINKET2, "Badge of the Swarmguard");
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
        if (warrior.rage >= heroicStrikeRageReq && !warrior.queuedSpell) {
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
    currentSim = new Simulation(simdesc.race, simdesc.stats, equipmentIndicesToItem(simdesc.equipment), buffIndicesToBuff(simdesc.buffs), generateChooseAction(simdesc.heroicStrikeRageReq, simdesc.hamstringRageReq), simdesc.fightLength, simdesc.realtime, logFunction);
    currentSim.start();
    setInterval(() => {
        mainThreadInterface.send('status', currentSim.status);
    }, 1000);
});
mainThreadInterface.addEventListener('pause', () => {
    if (currentSim) {
        currentSim.pause();
    }
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3BlbGwudHMiLCIuLi9zcmMvaXRlbS50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL3NwZWxscy50cyIsIi4uL3NyYy9kYXRhL2l0ZW1zLnRzIiwiLi4vc3JjL3NpbXVsYXRpb25fdXRpbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbi50cyIsIi4uL3NyYy93YXJyaW9yX2FpLnRzIiwiLi4vc3JjL3J1bl9zaW11bGF0aW9uX3dvcmtlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFdvcmtlckV2ZW50TGlzdGVuZXIgPSAoZGF0YTogYW55KSA9PiB2b2lkO1xuXG5jbGFzcyBXb3JrZXJFdmVudEludGVyZmFjZSB7XG4gICAgZXZlbnRMaXN0ZW5lcnM6IE1hcDxzdHJpbmcsIFdvcmtlckV2ZW50TGlzdGVuZXJbXT4gPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3Rvcih0YXJnZXQ6IGFueSkge1xuICAgICAgICB0YXJnZXQub25tZXNzYWdlID0gKGV2OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldi5kYXRhLmV2ZW50KSB8fCBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcihldi5kYXRhLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IFdvcmtlckV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRMaXN0ZW5lcnMuaGFzKGV2ZW50KSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpIS5wdXNoKGxpc3RlbmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMuc2V0KGV2ZW50LCBbbGlzdGVuZXJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciwgTWVsZWVIaXRPdXRjb21lIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgV2VhcG9uRGVzY3JpcHRpb24gfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBTcGVsbCB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHR5cGU6IFNwZWxsVHlwZTtcbiAgICBpc19nY2Q6IGJvb2xlYW47XG4gICAgY29zdDogbnVtYmVyO1xuICAgIGNvb2xkb3duOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHNwZWxsRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQ7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHR5cGU6IFNwZWxsVHlwZSwgaXNfZ2NkOiBib29sZWFuLCBjb3N0OiBudW1iZXIsIGNvb2xkb3duOiBudW1iZXIsIHNwZWxsRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICAgICAgdGhpcy5jb3N0ID0gY29zdDtcbiAgICAgICAgdGhpcy5jb29sZG93biA9IGNvb2xkb3duO1xuICAgICAgICB0aGlzLmlzX2djZCA9IGlzX2djZDtcbiAgICAgICAgdGhpcy5zcGVsbEYgPSBzcGVsbEY7XG4gICAgfVxuXG4gICAgY2FzdChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNwZWxsRihwbGF5ZXIsIHRpbWUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFNwZWxsO1xuICAgIGNvb2xkb3duID0gMDtcbiAgICBjYXN0ZXI6IFBsYXllcjtcblxuICAgIGNvbnN0cnVjdG9yKHNwZWxsOiBTcGVsbCwgY2FzdGVyOiBQbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zcGVsbCA9IHNwZWxsO1xuICAgICAgICB0aGlzLmNhc3RlciA9IGNhc3RlcjtcbiAgICB9XG5cbiAgICBvbkNvb2xkb3duKHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5jb29sZG93biA+IHRpbWU7XG4gICAgfVxuXG4gICAgdGltZVJlbWFpbmluZyh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsICh0aGlzLmNvb2xkb3duIC0gdGltZSkgLyAxMDAwKTtcbiAgICB9XG5cbiAgICBjYW5DYXN0KHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAodGhpcy5zcGVsbC5pc19nY2QgJiYgdGhpcy5jYXN0ZXIubmV4dEdDRFRpbWUgPiB0aW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zcGVsbC5jb3N0ID4gdGhpcy5jYXN0ZXIucG93ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9uQ29vbGRvd24odGltZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNhc3QodGltZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdGhpcy5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zcGVsbC5pc19nY2QpIHtcbiAgICAgICAgICAgIHRoaXMuY2FzdGVyLm5leHRHQ0RUaW1lID0gdGltZSArIDE1MDAgKyB0aGlzLmNhc3Rlci5sYXRlbmN5OyAvLyBUT0RPIC0gbmVlZCB0byBzdHVkeSB0aGUgZWZmZWN0cyBvZiBsYXRlbmN5IGluIHRoZSBnYW1lIGFuZCBjb25zaWRlciBodW1hbiBwcmVjaXNpb25cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5jYXN0ZXIucG93ZXIgLT0gdGhpcy5zcGVsbC5jb3N0O1xuXG4gICAgICAgIHRoaXMuc3BlbGwuY2FzdCh0aGlzLmNhc3RlciwgdGltZSk7XG5cbiAgICAgICAgdGhpcy5jb29sZG93biA9IHRpbWUgKyB0aGlzLnNwZWxsLmNvb2xkb3duICogMTAwMCArIHRoaXMuY2FzdGVyLmxhdGVuY3k7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3dpbmdTcGVsbCBleHRlbmRzIFNwZWxsIHtcbiAgICBib251c0RhbWFnZTogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBib251c0RhbWFnZTogbnVtYmVyLCBjb3N0OiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgZmFsc2UsIGNvc3QsIDAsICgpID0+IHt9KTtcbiAgICAgICAgdGhpcy5ib251c0RhbWFnZSA9IGJvbnVzRGFtYWdlO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIExlYXJuZWRTd2luZ1NwZWxsIGV4dGVuZHMgTGVhcm5lZFNwZWxsIHtcbiAgICBzcGVsbDogU3dpbmdTcGVsbDtcbiAgICBcbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3dpbmdTcGVsbCwgY2FzdGVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIoc3BlbGwsIGNhc3Rlcik7XG4gICAgICAgIHRoaXMuc3BlbGwgPSBzcGVsbDsgLy8gVE9ETyAtIGlzIHRoZXJlIGEgd2F5IHRvIGF2b2lkIHRoaXMgbGluZT9cbiAgICB9XG59XG5cbmV4cG9ydCBlbnVtIFNwZWxsVHlwZSB7XG4gICAgTk9ORSxcbiAgICBCVUZGLFxuICAgIFBIWVNJQ0FMLFxuICAgIFBIWVNJQ0FMX1dFQVBPTixcbn1cblxuZXhwb3J0IHR5cGUgU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2sgPSAocGxheWVyOiBQbGF5ZXIsIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSkgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIFNwZWxsRGFtYWdlIGV4dGVuZHMgU3BlbGwge1xuICAgIGNhbGxiYWNrPzogU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2s7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSwgaXNfZ2NkID0gZmFsc2UsIGNvc3QgPSAwLCBjb29sZG93biA9IDAsIGNhbGxiYWNrPzogU3BlbGxIaXRPdXRjb21lQ2FsbGJhY2spIHtcbiAgICAgICAgc3VwZXIobmFtZSwgdHlwZSwgaXNfZ2NkLCBjb3N0LCBjb29sZG93biwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRtZyA9ICh0eXBlb2YgYW1vdW50ID09PSBcIm51bWJlclwiKSA/IGFtb3VudCA6IGFtb3VudChwbGF5ZXIpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gU3BlbGxUeXBlLlBIWVNJQ0FMIHx8IHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPIC0gZG8gcHJvY3MgbGlrZSBmYXRhbCB3b3VuZHMgKHZpcydrYWcpIGFjY291bnQgZm9yIHdlYXBvbiBza2lsbD9cbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGxEYW1hZ2UyIGV4dGVuZHMgU3BlbGxEYW1hZ2Uge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgYW1vdW50OiBudW1iZXIsIHR5cGU6IFNwZWxsVHlwZSkge1xuICAgICAgICBzdXBlcihuYW1lLCBhbW91bnQsIHR5cGUsIGZhbHNlLCAwLCAwKTtcbiAgICB9XG59XG5cbmNvbnN0IGZhdGFsV291bmRzID0gbmV3IFNwZWxsRGFtYWdlMihcIkZhdGFsIFdvdW5kc1wiLCAyNDAsIFNwZWxsVHlwZS5QSFlTSUNBTCk7XG5cbmV4cG9ydCBjbGFzcyBFeHRyYUF0dGFjayBleHRlbmRzIFNwZWxsIHtcbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGNvdW50OiBudW1iZXIpIHtcbiAgICAgICAgLy8gc3BlbGx0eXBlIGRvZXNuJ3QgbWF0dGVyXG4gICAgICAgIHN1cGVyKG5hbWUsIFNwZWxsVHlwZS5OT05FLCBmYWxzZSwgMCwgMCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGlmIChwbGF5ZXIuZXh0cmFBdHRhY2tDb3VudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBsYXllci5leHRyYUF0dGFja0NvdW50ICs9IGNvdW50OyAvLyBMSCBjb2RlIGRvZXMgbm90IGFsbG93IG11bHRpcGxlIGF1dG8gYXR0YWNrcyB0byBzdGFjayBpZiB0aGV5IHByb2MgdG9nZXRoZXIuIEJsaXp6bGlrZSBtYXkgYWxsb3cgdGhlbSB0byBzdGFjayBcbiAgICAgICAgICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBHYWluZWQgJHtjb3VudH0gZXh0cmEgYXR0YWNrcyBmcm9tICR7bmFtZX1gKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGxCdWZmIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKGJ1ZmY6IEJ1ZmYsIGlzX2djZD86IGJvb2xlYW4sIGNvc3Q/OiBudW1iZXIsIGNvb2xkb3duPzogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKGBTcGVsbEJ1ZmYoJHtidWZmLm5hbWV9KWAsIFNwZWxsVHlwZS5CVUZGLCAhIWlzX2djZCwgY29zdCB8fCAwLCBjb29sZG93biB8fCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChidWZmLCB0aW1lKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG50eXBlIHBwbSA9IHtwcG06IG51bWJlcn07XG50eXBlIGNoYW5jZSA9IHtjaGFuY2U6IG51bWJlcn07XG50eXBlIHJhdGUgPSBwcG0gfCBjaGFuY2U7XG5cbmV4cG9ydCBjbGFzcyBQcm9jIHtcbiAgICBwcm90ZWN0ZWQgc3BlbGxzOiBTcGVsbFtdO1xuICAgIHByb3RlY3RlZCByYXRlOiByYXRlO1xuXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFNwZWxsIHwgU3BlbGxbXSwgcmF0ZTogcmF0ZSkge1xuICAgICAgICB0aGlzLnNwZWxscyA9IEFycmF5LmlzQXJyYXkoc3BlbGwpID8gc3BlbGwgOiBbc3BlbGxdO1xuICAgICAgICB0aGlzLnJhdGUgPSByYXRlO1xuICAgIH1cblxuICAgIHJ1bihwbGF5ZXI6IFBsYXllciwgd2VhcG9uOiBXZWFwb25EZXNjcmlwdGlvbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNoYW5jZSA9ICg8Y2hhbmNlPnRoaXMucmF0ZSkuY2hhbmNlIHx8ICg8cHBtPnRoaXMucmF0ZSkucHBtICogd2VhcG9uLnNwZWVkIC8gNjA7XG5cbiAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPD0gY2hhbmNlKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzcGVsbCBvZiB0aGlzLnNwZWxscykge1xuICAgICAgICAgICAgICAgIHNwZWxsLmNhc3QocGxheWVyLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBQcm9jLCBTcGVsbCwgTGVhcm5lZFNwZWxsIH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcblxuZXhwb3J0IGVudW0gSXRlbVNsb3Qge1xuICAgIE1BSU5IQU5EID0gMSA8PCAwLFxuICAgIE9GRkhBTkQgPSAxIDw8IDEsXG4gICAgVFJJTktFVDEgPSAxIDw8IDIsXG4gICAgVFJJTktFVDIgPSAxIDw8IDMsXG4gICAgSEVBRCA9IDEgPDwgNCxcbiAgICBORUNLID0gMSA8PCA1LFxuICAgIFNIT1VMREVSID0gMSA8PCA2LFxuICAgIEJBQ0sgPSAxIDw8IDcsXG4gICAgQ0hFU1QgPSAxIDw8IDgsXG4gICAgV1JJU1QgPSAxIDw8IDksXG4gICAgSEFORFMgPSAxIDw8IDEwLFxuICAgIFdBSVNUID0gMSA8PCAxMSxcbiAgICBMRUdTID0gMSA8PCAxMixcbiAgICBGRUVUID0gMSA8PCAxMyxcbiAgICBSSU5HMSA9IDEgPDwgMTQsXG4gICAgUklORzIgPSAxIDw8IDE1LFxuICAgIFJBTkdFRCA9IDEgPDwgMTYsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSXRlbURlc2NyaXB0aW9uIHtcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgc2xvdDogSXRlbVNsb3QsXG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxuICAgIG9udXNlPzogU3BlbGwsXG4gICAgb25lcXVpcD86IFByb2MsXG59XG5cbmV4cG9ydCBlbnVtIFdlYXBvblR5cGUge1xuICAgIE1BQ0UsXG4gICAgU1dPUkQsXG4gICAgQVhFLFxuICAgIERBR0dFUixcbiAgICBNQUNFMkgsXG4gICAgU1dPUkQySCxcbiAgICBBWEUySCxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXZWFwb25EZXNjcmlwdGlvbiBleHRlbmRzIEl0ZW1EZXNjcmlwdGlvbiB7XG4gICAgdHlwZTogV2VhcG9uVHlwZSxcbiAgICBtaW46IG51bWJlcixcbiAgICBtYXg6IG51bWJlcixcbiAgICBzcGVlZDogbnVtYmVyLFxuICAgIG9uaGl0PzogUHJvYyxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzV2VhcG9uKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbik6IGl0ZW0gaXMgV2VhcG9uRGVzY3JpcHRpb24ge1xuICAgIHJldHVybiBcInNwZWVkXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXF1aXBlZFdlYXBvbihpdGVtOiBJdGVtRXF1aXBlZCk6IGl0ZW0gaXMgV2VhcG9uRXF1aXBlZCB7XG4gICAgcmV0dXJuIFwid2VhcG9uXCIgaW4gaXRlbTtcbn1cblxuZXhwb3J0IGNsYXNzIEl0ZW1FcXVpcGVkIHtcbiAgICBpdGVtOiBJdGVtRGVzY3JpcHRpb247XG4gICAgb251c2U/OiBMZWFybmVkU3BlbGw7XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBJdGVtRGVzY3JpcHRpb24sIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuaXRlbSA9IGl0ZW07XG5cbiAgICAgICAgaWYgKGl0ZW0ub251c2UpIHtcbiAgICAgICAgICAgIHRoaXMub251c2UgPSBuZXcgTGVhcm5lZFNwZWxsKGl0ZW0ub251c2UsIHBsYXllcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5vbmVxdWlwKSB7IC8vIFRPRE8sIG1vdmUgdGhpcyB0byBidWZmcHJvYz8gdGhpcyBtYXkgYmUgc2ltcGxlciB0aG91Z2ggc2luY2Ugd2Uga25vdyB0aGUgYnVmZiB3b24ndCBiZSByZW1vdmVkXG4gICAgICAgICAgICBwbGF5ZXIuYWRkUHJvYyhpdGVtLm9uZXF1aXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXNlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy5vbnVzZSkge1xuICAgICAgICAgICAgdGhpcy5vbnVzZS5jYXN0KHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVtcG9yYXJ5V2VhcG9uRW5jaGFudCB7XG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzO1xuICAgIHByb2M/OiBQcm9jO1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdHM/OiBTdGF0VmFsdWVzLCBwcm9jPzogUHJvYykge1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMucHJvYyA9IHByb2M7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV2VhcG9uRXF1aXBlZCBleHRlbmRzIEl0ZW1FcXVpcGVkIHtcbiAgICB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uO1xuICAgIG5leHRTd2luZ1RpbWU6IG51bWJlcjtcbiAgICBwcm9jczogUHJvY1tdID0gW107XG4gICAgcGxheWVyOiBQbGF5ZXI7XG4gICAgdGVtcG9yYXJ5RW5jaGFudD86IFRlbXBvcmFyeVdlYXBvbkVuY2hhbnQ7XG5cbiAgICBjb25zdHJ1Y3RvcihpdGVtOiBXZWFwb25EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIoaXRlbSwgcGxheWVyKTtcbiAgICAgICAgdGhpcy53ZWFwb24gPSBpdGVtO1xuICAgICAgICBcbiAgICAgICAgaWYgKGl0ZW0ub25oaXQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkUHJvYyhpdGVtLm9uaGl0KVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG5cbiAgICAgICAgdGhpcy5uZXh0U3dpbmdUaW1lID0gMTAwOyAvLyBUT0RPIC0gbmVlZCB0byByZXNldCB0aGlzIHByb3Blcmx5IGlmIGV2ZXIgd2FudCB0byBzaW11bGF0ZSBmaWdodHMgd2hlcmUgeW91IHJ1biBvdXRcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldCBwbHVzRGFtYWdlKCkge1xuICAgICAgICBpZiAodGhpcy50ZW1wb3JhcnlFbmNoYW50ICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cyAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQuc3RhdHMucGx1c0RhbWFnZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5wbHVzRGFtYWdlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaW4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndlYXBvbi5taW4gKyB0aGlzLnBsdXNEYW1hZ2U7XG4gICAgfVxuXG4gICAgZ2V0IG1heCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2VhcG9uLm1heCArIHRoaXMucGx1c0RhbWFnZTtcbiAgICB9XG5cbiAgICBhZGRQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgdGhpcy5wcm9jcy5wdXNoKHApO1xuICAgIH1cblxuICAgIHByb2ModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGZvciAobGV0IHByb2Mgb2YgdGhpcy5wcm9jcykge1xuICAgICAgICAgICAgcHJvYy5ydW4odGhpcy5wbGF5ZXIsIHRoaXMud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdpbmRmdXJ5IHByb2NzIGxhc3RcbiAgICAgICAgaWYgKHRoaXMudGVtcG9yYXJ5RW5jaGFudCAmJiB0aGlzLnRlbXBvcmFyeUVuY2hhbnQucHJvYykge1xuICAgICAgICAgICAgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnByb2MucnVuKHRoaXMucGxheWVyLCB0aGlzLndlYXBvbiwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gdXJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZyYW5kKG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICAgIHJldHVybiBtaW4gKyBNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFtcCh2YWw6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIE1hdGgubWluKG1heCwgTWF0aC5tYXgobWluLCB2YWwpKTtcbn1cblxuY29uc3QgREVCVUdHSU5HID0gZmFsc2U7XG5cbmlmIChERUJVR0dJTkcpIHtcbiAgICAvLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9tYXRoaWFzYnluZW5zLzU2NzA5MTcjZmlsZS1kZXRlcm1pbmlzdGljLW1hdGgtcmFuZG9tLWpzXG4gICAgTWF0aC5yYW5kb20gPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWVkID0gMHgyRjZFMkIxO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAvLyBSb2JlcnQgSmVua2luc+KAmSAzMiBiaXQgaW50ZWdlciBoYXNoIGZ1bmN0aW9uXG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHg3RUQ1NUQxNikgKyAoc2VlZCA8PCAxMikpICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkIF4gMHhDNzYxQzIzQykgXiAoc2VlZCA+Pj4gMTkpKSAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHgxNjU2NjdCMSkgKyAoc2VlZCA8PCA1KSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHhEM0EyNjQ2QykgXiAoc2VlZCA8PCA5KSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkICsgMHhGRDcwNDZDNSkgKyAoc2VlZCA8PCAzKSkgICAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICBzZWVkID0gKChzZWVkIF4gMHhCNTVBNEYwOSkgXiAoc2VlZCA+Pj4gMTYpKSAmIDB4RkZGRkZGRkY7XG4gICAgICAgICAgICByZXR1cm4gKHNlZWQgJiAweEZGRkZGRkYpIC8gMHgxMDAwMDAwMDtcbiAgICAgICAgfTtcbiAgICB9KCkpO1xufVxuIiwiaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcblxuZXhwb3J0IGNsYXNzIFVuaXQge1xuICAgIGxldmVsOiBudW1iZXI7XG4gICAgYXJtb3I6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKGxldmVsOiBudW1iZXIsIGFybW9yOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICB0aGlzLmFybW9yID0gYXJtb3I7XG4gICAgfVxuXG4gICAgZ2V0IG1heFNraWxsRm9yTGV2ZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxldmVsICogNTtcbiAgICB9XG5cbiAgICBnZXQgZGVmZW5zZVNraWxsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgIH1cblxuICAgIGdldCBkb2RnZUNoYW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIDU7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQXJtb3JSZWR1Y2VkRGFtYWdlKGRhbWFnZTogbnVtYmVyLCBhdHRhY2tlcjogUGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGFybW9yID0gTWF0aC5tYXgoMCwgdGhpcy5hcm1vciAtIGF0dGFja2VyLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFybW9yUGVuZXRyYXRpb24pO1xuICAgICAgICBcbiAgICAgICAgbGV0IHRtcHZhbHVlID0gMC4xICogYXJtb3IgIC8gKCg4LjUgKiBhdHRhY2tlci5sZXZlbCkgKyA0MCk7XG4gICAgICAgIHRtcHZhbHVlIC89ICgxICsgdG1wdmFsdWUpO1xuXG4gICAgICAgIGNvbnN0IGFybW9yTW9kaWZpZXIgPSBjbGFtcCh0bXB2YWx1ZSwgMCwgMC43NSk7XG5cbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDEsIGRhbWFnZSAtIChkYW1hZ2UgKiBhcm1vck1vZGlmaWVyKSk7XG4gICAgfVxufVxuIiwiZXhwb3J0IGludGVyZmFjZSBTdGF0VmFsdWVzIHtcbiAgICBhcD86IG51bWJlcjtcbiAgICBzdHI/OiBudW1iZXI7XG4gICAgYWdpPzogbnVtYmVyO1xuICAgIGhpdD86IG51bWJlcjtcbiAgICBjcml0PzogbnVtYmVyO1xuICAgIGhhc3RlPzogbnVtYmVyO1xuICAgIHN0YXRNdWx0PzogbnVtYmVyO1xuICAgIGRhbWFnZU11bHQ/OiBudW1iZXI7XG4gICAgYXJtb3JQZW5ldHJhdGlvbj86IG51bWJlcjtcbiAgICBwbHVzRGFtYWdlPzogbnVtYmVyO1xuXG4gICAgc3dvcmRTa2lsbD86IG51bWJlcjtcbiAgICBheGVTa2lsbD86IG51bWJlcjtcbiAgICBtYWNlU2tpbGw/OiBudW1iZXI7XG4gICAgZGFnZ2VyU2tpbGw/OiBudW1iZXI7XG4gICAgc3dvcmQySFNraWxsPzogbnVtYmVyO1xuICAgIGF4ZTJIU2tpbGw/OiBudW1iZXI7XG4gICAgbWFjZTJIU2tpbGw/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBTdGF0cyBpbXBsZW1lbnRzIFN0YXRWYWx1ZXMge1xuICAgIGFwITogbnVtYmVyO1xuICAgIHN0ciE6IG51bWJlcjtcbiAgICBhZ2khOiBudW1iZXI7XG4gICAgaGl0ITogbnVtYmVyO1xuICAgIGNyaXQhOiBudW1iZXI7XG4gICAgaGFzdGUhOiBudW1iZXI7XG4gICAgc3RhdE11bHQhOiBudW1iZXI7XG4gICAgZGFtYWdlTXVsdCE6IG51bWJlcjtcbiAgICBhcm1vclBlbmV0cmF0aW9uITogbnVtYmVyO1xuICAgIHBsdXNEYW1hZ2UhOiBudW1iZXI7XG5cbiAgICBzd29yZFNraWxsITogbnVtYmVyO1xuICAgIGF4ZVNraWxsITogbnVtYmVyO1xuICAgIG1hY2VTa2lsbCE6IG51bWJlcjtcbiAgICBkYWdnZXJTa2lsbCE6IG51bWJlcjtcbiAgICBzd29yZDJIU2tpbGwhOiBudW1iZXI7XG4gICAgYXhlMkhTa2lsbCE6IG51bWJlcjtcbiAgICBtYWNlMkhTa2lsbCE6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKHM/OiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuc2V0KHMpO1xuICAgIH1cblxuICAgIHNldChzPzogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLmFwID0gKHMgJiYgcy5hcCkgfHwgMDtcbiAgICAgICAgdGhpcy5zdHIgPSAocyAmJiBzLnN0cikgfHwgMDtcbiAgICAgICAgdGhpcy5hZ2kgPSAocyAmJiBzLmFnaSkgfHwgMDtcbiAgICAgICAgdGhpcy5oaXQgPSAocyAmJiBzLmhpdCkgfHwgMDtcbiAgICAgICAgdGhpcy5jcml0ID0gKHMgJiYgcy5jcml0KSB8fCAwO1xuICAgICAgICB0aGlzLmhhc3RlID0gKHMgJiYgcy5oYXN0ZSkgfHwgMTtcbiAgICAgICAgdGhpcy5zdGF0TXVsdCA9IChzICYmIHMuc3RhdE11bHQpIHx8IDE7XG4gICAgICAgIHRoaXMuZGFtYWdlTXVsdCA9IChzICYmIHMuZGFtYWdlTXVsdCkgfHwgMTtcbiAgICAgICAgdGhpcy5hcm1vclBlbmV0cmF0aW9uID0gKHMgJiYgcy5hcm1vclBlbmV0cmF0aW9uKSB8fCAwO1xuICAgICAgICB0aGlzLnBsdXNEYW1hZ2UgPSAocyAmJiBzLnBsdXNEYW1hZ2UpIHx8IDA7XG5cbiAgICAgICAgdGhpcy5zd29yZFNraWxsID0gKHMgJiYgcy5zd29yZFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmF4ZVNraWxsID0gKHMgJiYgcy5heGVTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5tYWNlU2tpbGwgPSAocyAmJiBzLm1hY2VTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5kYWdnZXJTa2lsbCA9IChzICYmIHMuZGFnZ2VyU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuc3dvcmQySFNraWxsID0gKHMgJiYgcy5zd29yZDJIU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuYXhlMkhTa2lsbCA9IChzICYmIHMuYXhlMkhTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5tYWNlMkhTa2lsbCA9IChzICYmIHMubWFjZTJIU2tpbGwpIHx8IDA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgYWRkKHM6IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5hcCArPSAocy5hcCB8fCAwKTtcbiAgICAgICAgdGhpcy5zdHIgKz0gKHMuc3RyIHx8IDApO1xuICAgICAgICB0aGlzLmFnaSArPSAocy5hZ2kgfHwgMCk7XG4gICAgICAgIHRoaXMuaGl0ICs9IChzLmhpdCB8fCAwKTtcbiAgICAgICAgdGhpcy5jcml0ICs9IChzLmNyaXQgfHwgMCk7XG4gICAgICAgIHRoaXMuaGFzdGUgKj0gKHMuaGFzdGUgfHwgMSk7XG4gICAgICAgIHRoaXMuc3RhdE11bHQgKj0gKHMuc3RhdE11bHQgfHwgMSk7XG4gICAgICAgIHRoaXMuZGFtYWdlTXVsdCAqPSAocy5kYW1hZ2VNdWx0IHx8IDEpO1xuICAgICAgICB0aGlzLmFybW9yUGVuZXRyYXRpb24gKz0gKHMuYXJtb3JQZW5ldHJhdGlvbiB8fCAwKTtcbiAgICAgICAgdGhpcy5wbHVzRGFtYWdlICs9IChzLnBsdXNEYW1hZ2UgfHwgMCk7XG5cbiAgICAgICAgdGhpcy5zd29yZFNraWxsICs9IChzLnN3b3JkU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuYXhlU2tpbGwgKz0gKHMuYXhlU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMubWFjZVNraWxsICs9IChzLm1hY2VTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5kYWdnZXJTa2lsbCArPSAocy5kYWdnZXJTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5zd29yZDJIU2tpbGwgKz0gKHMuc3dvcmQySFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmF4ZTJIU2tpbGwgKz0gKHMuYXhlMkhTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5tYWNlMkhTa2lsbCArPSAocy5tYWNlMkhTa2lsbCB8fCAwKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdGF0cywgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IFByb2MgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgY2xhc3MgQnVmZk1hbmFnZXIge1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgcHJpdmF0ZSBidWZmTGlzdDogQnVmZkFwcGxpY2F0aW9uW10gPSBbXTtcbiAgICBwcml2YXRlIGJ1ZmZPdmVyVGltZUxpc3Q6IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uW10gPSBbXTtcblxuICAgIGJhc2VTdGF0czogU3RhdHM7XG4gICAgc3RhdHM6IFN0YXRzO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJhc2VTdGF0czogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcbiAgICAgICAgdGhpcy5iYXNlU3RhdHMgPSBuZXcgU3RhdHMoYmFzZVN0YXRzKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IG5ldyBTdGF0cyh0aGlzLmJhc2VTdGF0cyk7XG4gICAgfVxuXG4gICAgZ2V0IG5leHRPdmVyVGltZVVwZGF0ZSgpIHtcbiAgICAgICAgbGV0IHJlcyA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHJlcyA9IE1hdGgubWluKHJlcywgYnVmZk9UQXBwLm5leHRVcGRhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICB1cGRhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIHByb2Nlc3MgbGFzdCB0aWNrIGJlZm9yZSBpdCBpcyByZW1vdmVkXG4gICAgICAgIGZvciAobGV0IGJ1ZmZPVEFwcCBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIGJ1ZmZPVEFwcC51cGRhdGUodGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbW92ZUV4cGlyZWRCdWZmcyh0aW1lKTtcblxuICAgICAgICB0aGlzLnN0YXRzLnNldCh0aGlzLmJhc2VTdGF0cyk7XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBzdGFja3MgPSBidWZmLnN0YXRzU3RhY2sgPyBzdGFja3MgOiAxO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFja3M7IGkrKykge1xuICAgICAgICAgICAgICAgIGJ1ZmYuYXBwbHkodGhpcy5zdGF0cywgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgeyBidWZmLCBzdGFja3MgfSBvZiB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgYnVmZkFwcCBvZiB0aGlzLmJ1ZmZMaXN0KSB7XG4gICAgICAgICAgICBpZiAoYnVmZkFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmYuc3RhY2tzKSB7ICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvZ1N0YWNrSW5jcmVhc2UgPSB0aGlzLnBsYXllci5sb2cgJiYgKCFidWZmLm1heFN0YWNrcyB8fCBidWZmQXBwLnN0YWNrcyA8IGJ1ZmYubWF4U3RhY2tzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZi5pbml0aWFsU3RhY2tzKSB7IC8vIFRPRE8gLSBjaGFuZ2UgdGhpcyB0byBjaGFyZ2VzP1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZkFwcC5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnN0YWNrcysrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvZ1N0YWNrSW5jcmVhc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxheWVyLmxvZyEoYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZCAoJHtidWZmQXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IHJlZnJlc2hlZGApO1xuICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKGFwcGx5VGltZSwgYCR7YnVmZi5uYW1lfSBnYWluZWRgICsgKGJ1ZmYuc3RhY2tzID8gYCAoJHtidWZmLmluaXRpYWxTdGFja3MgfHwgMX0pYCA6ICcnKSk7XG5cbiAgICAgICAgaWYgKGJ1ZmYgaW5zdGFuY2VvZiBCdWZmT3ZlclRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5wdXNoKG5ldyBCdWZmT3ZlclRpbWVBcHBsaWNhdGlvbih0aGlzLnBsYXllciwgYnVmZiwgYXBwbHlUaW1lKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZMaXN0LnB1c2gobmV3IEJ1ZmZBcHBsaWNhdGlvbihidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBidWZmLmFkZChhcHBseVRpbWUsIHRoaXMucGxheWVyKTtcbiAgICB9XG5cbiAgICByZW1vdmUoYnVmZjogQnVmZiwgdGltZTogbnVtYmVyLCBmdWxsID0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5idWZmID09PSBidWZmKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmdWxsICYmIGJ1ZmYuc3RhY2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZhcHAuc3RhY2tzIC09IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9ICgke2J1ZmZhcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuc3RhY2tzID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBsb3N0YCk7XG4gICAgICAgICAgICAgICAgYnVmZmFwcC5idWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCA9IHRoaXMuYnVmZk92ZXJUaW1lTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWU6IG51bWJlcikge1xuICAgICAgICBjb25zdCByZW1vdmVkQnVmZnM6IEJ1ZmZbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5idWZmTGlzdCA9IHRoaXMuYnVmZkxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuZXhwaXJhdGlvblRpbWUgPD0gdGltZSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWRCdWZmcy5wdXNoKGJ1ZmZhcHAuYnVmZik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAobGV0IGJ1ZmYgb2YgcmVtb3ZlZEJ1ZmZzKSB7XG4gICAgICAgICAgICBidWZmLnJlbW92ZSh0aW1lLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSBleHBpcmVkYCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzfHVuZGVmaW5lZDtcbiAgICBzdGFja3M6IGJvb2xlYW47XG4gICAgZHVyYXRpb246IG51bWJlcjtcbiAgICBpbml0aWFsU3RhY2tzPzogbnVtYmVyO1xuICAgIG1heFN0YWNrcz86IG51bWJlcjtcbiAgICBzdGF0c1N0YWNrOiBib29sZWFuOyAvLyBkbyB5b3UgYWRkIHRoZSBzdGF0IGJvbnVzIGZvciBlYWNoIHN0YWNrPyBvciBpcyBpdCBsaWtlIGZsdXJyeSB3aGVyZSB0aGUgc3RhY2sgaXMgb25seSB0byBjb3VudCBjaGFyZ2VzXG5cbiAgICBwcml2YXRlIGNoaWxkPzogQnVmZjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgc3RhdHM/OiBTdGF0VmFsdWVzLCBzdGFja3M/OiBib29sZWFuLCBpbml0aWFsU3RhY2tzPzogbnVtYmVyLCBtYXhTdGFja3M/OiBudW1iZXIsIGNoaWxkPzogQnVmZiwgc3RhdHNTdGFjayA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuc3RhY2tzID0gISFzdGFja3M7XG4gICAgICAgIHRoaXMuaW5pdGlhbFN0YWNrcyA9IGluaXRpYWxTdGFja3M7XG4gICAgICAgIHRoaXMubWF4U3RhY2tzID0gbWF4U3RhY2tzO1xuICAgICAgICB0aGlzLmNoaWxkID0gY2hpbGQ7XG4gICAgICAgIHRoaXMuc3RhdHNTdGFjayA9IHN0YXRzU3RhY2s7XG4gICAgfVxuXG4gICAgYXBwbHkoc3RhdHM6IFN0YXRzLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5zdGF0cykge1xuICAgICAgICAgICAgc3RhdHMuYWRkKHRoaXMuc3RhdHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHt9XG5cbiAgICByZW1vdmUodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBpZiAodGhpcy5jaGlsZCkge1xuICAgICAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLnJlbW92ZSh0aGlzLmNoaWxkLCB0aW1lLCB0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmO1xuICAgIGV4cGlyYXRpb25UaW1lITogbnVtYmVyO1xuXG4gICAgc3RhY2tzVmFsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5yZWZyZXNoKGFwcGx5VGltZSk7XG4gICAgfVxuXG4gICAgcmVmcmVzaCh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3MgPSB0aGlzLmJ1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxO1xuXG4gICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSB0aW1lICsgdGhpcy5idWZmLmR1cmF0aW9uICogMTAwMDtcblxuICAgICAgICBpZiAodGhpcy5idWZmLmR1cmF0aW9uID4gNjApIHtcbiAgICAgICAgICAgIHRoaXMuZXhwaXJhdGlvblRpbWUgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzdGFja3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YWNrc1ZhbDtcbiAgICB9XG5cbiAgICBzZXQgc3RhY2tzKHN0YWNrczogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc3RhY2tzVmFsID0gdGhpcy5idWZmLm1heFN0YWNrcyA/IE1hdGgubWluKHRoaXMuYnVmZi5tYXhTdGFja3MsIHN0YWNrcykgOiBzdGFja3M7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZk92ZXJUaW1lIGV4dGVuZHMgQnVmZiB7XG4gICAgdXBkYXRlRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQ7XG4gICAgdXBkYXRlSW50ZXJ2YWw6IG51bWJlclxuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0czogU3RhdFZhbHVlc3x1bmRlZmluZWQsIHVwZGF0ZUludGVydmFsOiBudW1iZXIsIHVwZGF0ZUY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGR1cmF0aW9uLCBzdGF0cyk7XG4gICAgICAgIHRoaXMudXBkYXRlRiA9IHVwZGF0ZUY7XG4gICAgICAgIHRoaXMudXBkYXRlSW50ZXJ2YWwgPSB1cGRhdGVJbnRlcnZhbDtcbiAgICB9XG59XG5cbmNsYXNzIEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uIGV4dGVuZHMgQnVmZkFwcGxpY2F0aW9uIHtcbiAgICBidWZmOiBCdWZmT3ZlclRpbWU7XG4gICAgbmV4dFVwZGF0ZSE6IG51bWJlcjtcbiAgICBwbGF5ZXI6IFBsYXllcjtcblxuICAgIGNvbnN0cnVjdG9yKHBsYXllcjogUGxheWVyLCBidWZmOiBCdWZmT3ZlclRpbWUsIGFwcGx5VGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKGJ1ZmYsIGFwcGx5VGltZSk7XG4gICAgICAgIHRoaXMuYnVmZiA9IGJ1ZmY7XG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICBzdXBlci5yZWZyZXNoKHRpbWUpO1xuICAgICAgICB0aGlzLm5leHRVcGRhdGUgPSB0aW1lICsgdGhpcy5idWZmLnVwZGF0ZUludGVydmFsO1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRpbWUgPj0gdGhpcy5uZXh0VXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLm5leHRVcGRhdGUgKz0gdGhpcy5idWZmLnVwZGF0ZUludGVydmFsO1xuICAgICAgICAgICAgdGhpcy5idWZmLnVwZGF0ZUYodGhpcy5wbGF5ZXIsIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQnVmZlByb2MgZXh0ZW5kcyBCdWZmIHtcbiAgICBwcm9jOiBQcm9jO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBwcm9jOiBQcm9jLCBjaGlsZD86IEJ1ZmYpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGQpO1xuICAgICAgICB0aGlzLnByb2MgPSBwcm9jO1xuICAgIH1cblxuICAgIGFkZCh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLmFkZCh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIuYWRkUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyLnJlbW92ZSh0aW1lLCBwbGF5ZXIpO1xuICAgICAgICBwbGF5ZXIucmVtb3ZlUHJvYyh0aGlzLnByb2MpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFdlYXBvbkVxdWlwZWQsIFdlYXBvblR5cGUsIEl0ZW1EZXNjcmlwdGlvbiwgSXRlbUVxdWlwZWQsIEl0ZW1TbG90LCBpc0VxdWlwZWRXZWFwb24sIGlzV2VhcG9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IHVyYW5kLCBjbGFtcCwgZnJhbmQgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBCdWZmTWFuYWdlciB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBQcm9jLCBMZWFybmVkU3dpbmdTcGVsbCwgU3BlbGxUeXBlLCBTcGVsbERhbWFnZSB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBMSF9DT1JFX0JVRyB9IGZyb20gXCIuL3NpbV9zZXR0aW5ncy5qc1wiO1xuXG5leHBvcnQgZW51bSBSYWNlIHtcbiAgICBIVU1BTixcbiAgICBPUkMsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCB0eXBlIERhbWFnZUxvZyA9IFtudW1iZXIsIG51bWJlcl1bXTtcblxuZXhwb3J0IGNsYXNzIFBsYXllciBleHRlbmRzIFVuaXQge1xuICAgIGl0ZW1zOiBNYXA8SXRlbVNsb3QsIEl0ZW1FcXVpcGVkPiA9IG5ldyBNYXAoKTtcbiAgICBwcm9jczogUHJvY1tdID0gW107XG5cbiAgICB0YXJnZXQ6IFVuaXQgfCB1bmRlZmluZWQ7XG5cbiAgICBuZXh0R0NEVGltZSA9IDA7XG4gICAgZXh0cmFBdHRhY2tDb3VudCA9IDA7XG4gICAgZG9pbmdFeHRyYUF0dGFja3MgPSBmYWxzZTtcblxuICAgIGJ1ZmZNYW5hZ2VyOiBCdWZmTWFuYWdlcjtcblxuICAgIGRhbWFnZUxvZzogRGFtYWdlTG9nID0gW107XG5cbiAgICBxdWV1ZWRTcGVsbDogTGVhcm5lZFN3aW5nU3BlbGx8dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgbG9nPzogTG9nRnVuY3Rpb247XG5cbiAgICBsYXRlbmN5ID0gNTA7IC8vIG1zXG5cbiAgICBwb3dlckxvc3QgPSAwO1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHN1cGVyKDYwLCAwKTsgLy8gbHZsLCBhcm1vclxuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIgPSBuZXcgQnVmZk1hbmFnZXIodGhpcywgbmV3IFN0YXRzKHN0YXRzKSk7XG4gICAgICAgIHRoaXMubG9nID0gbG9nO1xuICAgIH1cblxuICAgIGdldCBtaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5NQUlOSEFORCk7XG5cbiAgICAgICAgaWYgKGVxdWlwZWQgJiYgaXNFcXVpcGVkV2VhcG9uKGVxdWlwZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXF1aXBlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvaCgpOiBXZWFwb25FcXVpcGVkfHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGVxdWlwZWQgPSB0aGlzLml0ZW1zLmdldChJdGVtU2xvdC5PRkZIQU5EKTtcblxuICAgICAgICBpZiAoZXF1aXBlZCAmJiBpc0VxdWlwZWRXZWFwb24oZXF1aXBlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcXVpcGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZXF1aXAoaXRlbTogSXRlbURlc2NyaXB0aW9uLCBzbG90OiBJdGVtU2xvdCkge1xuICAgICAgICBpZiAodGhpcy5pdGVtcy5oYXMoc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFscmVhZHkgaGF2ZSBpdGVtIGluIHNsb3QgJHtJdGVtU2xvdFtzbG90XX1gKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEoaXRlbS5zbG90ICYgc2xvdCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGNhbm5vdCBlcXVpcCAke2l0ZW0ubmFtZX0gaW4gc2xvdCAke0l0ZW1TbG90W3Nsb3RdfWApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS5zdGF0cykge1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5iYXNlU3RhdHMuYWRkKGl0ZW0uc3RhdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETyAtIGhhbmRsZSBlcXVpcHBpbmcgMkggKGFuZCBob3cgdGhhdCBkaXNhYmxlcyBPSClcbiAgICAgICAgaWYgKGlzV2VhcG9uKGl0ZW0pKSB7XG4gICAgICAgICAgICB0aGlzLml0ZW1zLnNldChzbG90LCBuZXcgV2VhcG9uRXF1aXBlZChpdGVtLCB0aGlzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLml0ZW1zLnNldChzbG90LCBuZXcgSXRlbUVxdWlwZWQoaXRlbSwgdGhpcykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHBvd2VyKCk6IG51bWJlciB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHNldCBwb3dlcihwb3dlcjogbnVtYmVyKSB7fVxuXG4gICAgYWRkUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIHRoaXMucHJvY3MucHVzaChwKTtcbiAgICB9XG5cbiAgICByZW1vdmVQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgLy8gVE9ETyAtIGVpdGhlciBwcm9jcyBzaG91bGQgYmUgYSBzZXQgb3Igd2UgbmVlZCBQcm9jQXBwbGljYXRpb25cbiAgICAgICAgdGhpcy5wcm9jcyA9IHRoaXMucHJvY3MuZmlsdGVyKChwcm9jOiBQcm9jKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gcHJvYyAhPT0gcDtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgaWYgKHNwZWxsICYmIHNwZWxsLnR5cGUgPT0gU3BlbGxUeXBlLlBIWVNJQ0FMKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuICAgICAgICBjb25zdCB3ZWFwb25UeXBlID0gd2VhcG9uLndlYXBvbi50eXBlO1xuXG4gICAgICAgIC8vIFRPRE8sIG1ha2UgdGhpcyBhIG1hcFxuICAgICAgICBzd2l0Y2ggKHdlYXBvblR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5NQUNFOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLm1hY2VTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5TV09SRDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zd29yZFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkFYRTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5heGVTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5EQUdHRVI6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuZGFnZ2VyU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuTUFDRTJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLm1hY2UySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLlNXT1JEMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3dvcmQySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkFYRTJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmF4ZTJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjYWxjdWxhdGVDcml0Q2hhbmNlKCkge1xuICAgICAgICBsZXQgY3JpdCA9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuY3JpdDtcbiAgICAgICAgY3JpdCArPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFnaSAqIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RhdE11bHQgLyAyMDtcblxuICAgICAgICByZXR1cm4gY3JpdDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlTWlzc0NoYW5jZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCByZXMgPSA1O1xuICAgICAgICByZXMgLT0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5oaXQ7XG5cbiAgICAgICAgaWYgKHRoaXMub2ggJiYgIXNwZWxsKSB7XG4gICAgICAgICAgICByZXMgKz0gMTk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLmRlZmVuc2VTa2lsbDtcblxuICAgICAgICBpZiAoc2tpbGxEaWZmIDwgLTEwKSB7XG4gICAgICAgICAgICByZXMgLT0gKHNraWxsRGlmZiArIDEwKSAqIDAuNCAtIDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMgLT0gc2tpbGxEaWZmICogMC4xO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNsYW1wKHJlcywgMCwgNjApO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVHbGFuY2luZ1JlZHVjdGlvbih2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuKSB7XG4gICAgICAgIGNvbnN0IHNraWxsRGlmZiA9IHZpY3RpbS5kZWZlbnNlU2tpbGwgIC0gdGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oKTtcblxuICAgICAgICBpZiAoc2tpbGxEaWZmID49IDE1KSB7XG4gICAgICAgICAgICByZXR1cm4gMC42NTtcbiAgICAgICAgfSBlbHNlIGlmIChza2lsbERpZmYgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBza2lsbERpZmZUb1JlZHVjdGlvbltza2lsbERpZmZdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlU3dpbmdNaW5NYXhEYW1hZ2UoaXNfbWg6IGJvb2xlYW4pOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuXG4gICAgICAgIGNvbnN0IGFwX2JvbnVzID0gdGhpcy5hcCAvIDE0ICogd2VhcG9uLndlYXBvbi5zcGVlZDtcblxuICAgICAgICBjb25zdCBvaFBlbmFsdHkgPSBpc19taCA/IDEgOiAwLjYyNTsgLy8gVE9ETyAtIGNoZWNrIHRhbGVudHMsIGltcGxlbWVudGVkIGFzIGFuIGF1cmEgU1BFTExfQVVSQV9NT0RfT0ZGSEFORF9EQU1BR0VfUENUXG5cbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICh3ZWFwb24ubWluICsgYXBfYm9udXMpICogb2hQZW5hbHR5LFxuICAgICAgICAgICAgKHdlYXBvbi5tYXggKyBhcF9ib251cykgKiBvaFBlbmFsdHlcbiAgICAgICAgXTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZShpc19taDogYm9vbGVhbikge1xuICAgICAgICByZXR1cm4gZnJhbmQoLi4udGhpcy5jYWxjdWxhdGVTd2luZ01pbk1heERhbWFnZShpc19taCkpO1xuICAgIH1cblxuICAgIHJvbGxNZWxlZUhpdE91dGNvbWUodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgICAgIGNvbnN0IHJvbGwgPSB1cmFuZCgwLCAxMDAwMCk7XG4gICAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgICBsZXQgdG1wID0gMDtcblxuICAgICAgICAvLyByb3VuZGluZyBpbnN0ZWFkIG9mIHRydW5jYXRpbmcgYmVjYXVzZSAxOS40ICogMTAwIHdhcyB0cnVuY2F0aW5nIHRvIDE5MzkuXG4gICAgICAgIGNvbnN0IG1pc3NfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltLCBpc19taCwgc3BlbGwpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh2aWN0aW0uZG9kZ2VDaGFuY2UgKiAxMDApO1xuICAgICAgICBjb25zdCBjcml0X2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVDcml0Q2hhbmNlKCkgKiAxMDApO1xuXG4gICAgICAgIC8vIHdlYXBvbiBza2lsbCAtIHRhcmdldCBkZWZlbnNlICh1c3VhbGx5IG5lZ2F0aXZlKVxuICAgICAgICBjb25zdCBza2lsbEJvbnVzID0gNCAqICh0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgsIHNwZWxsKSAtIHZpY3RpbS5tYXhTa2lsbEZvckxldmVsKTtcblxuICAgICAgICB0bXAgPSBtaXNzX2NoYW5jZTtcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTO1xuICAgICAgICB9XG5cbiAgICAgICAgdG1wID0gZG9kZ2VfY2hhbmNlIC0gc2tpbGxCb251czsgLy8gNS42ICg1NjApIGZvciBsdmwgNjMgd2l0aCAzMDAgd2VhcG9uIHNraWxsXG5cbiAgICAgICAgaWYgKHRtcCA+IDAgJiYgcm9sbCA8IChzdW0gKz0gdG1wKSkge1xuICAgICAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNwZWxsKSB7IC8vIHNwZWxscyBjYW4ndCBnbGFuY2VcbiAgICAgICAgICAgIHRtcCA9ICgxMCArICh2aWN0aW0uZGVmZW5zZVNraWxsIC0gMzAwKSAqIDIpICogMTAwO1xuICAgICAgICAgICAgdG1wID0gY2xhbXAodG1wLCAwLCA0MDAwKTtcbiAgICBcbiAgICAgICAgICAgIGlmIChyb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfR0xBTkNJTkc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBjcml0X2NoYW5jZSArIHNraWxsQm9udXM7XG5cbiAgICAgICAgaWYgKExIX0NPUkVfQlVHICYmIHNwZWxsICYmIHNwZWxsLnR5cGUgPT0gU3BlbGxUeXBlLlBIWVNJQ0FMKSB7XG4gICAgICAgICAgICBjb25zdCBvdmVycmlkZVNraWxsQm9udXNGb3JDcml0ID0gNCAqICh0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgsIHVuZGVmaW5lZCkgLSB2aWN0aW0ubWF4U2tpbGxGb3JMZXZlbCk7XG4gICAgICAgICAgICB0bXAgPSBjcml0X2NoYW5jZSArIG92ZXJyaWRlU2tpbGxCb251c0ZvckNyaXQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUJvbnVzRGFtYWdlKHJhd0RhbWFnZTogbnVtYmVyLCB2aWN0aW06IFVuaXQsIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgbGV0IGRhbWFnZVdpdGhCb251cyA9IHJhd0RhbWFnZTtcblxuICAgICAgICBkYW1hZ2VXaXRoQm9udXMgKj0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5kYW1hZ2VNdWx0O1xuXG4gICAgICAgIHJldHVybiBkYW1hZ2VXaXRoQm9udXM7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpOiBbbnVtYmVyLCBNZWxlZUhpdE91dGNvbWUsIG51bWJlcl0ge1xuICAgICAgICBjb25zdCBkYW1hZ2VXaXRoQm9udXMgPSB0aGlzLmNhbGN1bGF0ZUJvbnVzRGFtYWdlKHJhd0RhbWFnZSwgdmljdGltLCBzcGVsbCk7XG4gICAgICAgIGNvbnN0IGFybW9yUmVkdWNlZCA9IHZpY3RpbS5jYWxjdWxhdGVBcm1vclJlZHVjZWREYW1hZ2UoZGFtYWdlV2l0aEJvbnVzLCB0aGlzKTtcbiAgICAgICAgY29uc3QgaGl0T3V0Y29tZSA9IHRoaXMucm9sbE1lbGVlSGl0T3V0Y29tZSh2aWN0aW0sIGlzX21oLCBzcGVsbCk7XG5cbiAgICAgICAgbGV0IGRhbWFnZSA9IGFybW9yUmVkdWNlZDtcbiAgICAgICAgbGV0IGNsZWFuRGFtYWdlID0gMDtcblxuICAgICAgICBzd2l0Y2ggKGhpdE91dGNvbWUpIHtcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IDA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0U6XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlk6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBjbGVhbkRhbWFnZSA9IGRhbWFnZVdpdGhCb251cztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWR1Y2VQZXJjZW50ID0gdGhpcy5jYWxjdWxhdGVHbGFuY2luZ1JlZHVjdGlvbih2aWN0aW0sIGlzX21oKTtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSByZWR1Y2VQZXJjZW50ICogZGFtYWdlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX05PUk1BTDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSAqPSAyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtkYW1hZ2UsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXTtcbiAgICB9XG5cbiAgICB1cGRhdGVQcm9jcyh0aW1lOiBudW1iZXIsIGlzX21oOiBib29sZWFuLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUsIGRhbWFnZURvbmU6IG51bWJlciwgY2xlYW5EYW1hZ2U6IG51bWJlciwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlldLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAvLyB3aGF0IGlzIHRoZSBvcmRlciBvZiBjaGVja2luZyBmb3IgcHJvY3MgbGlrZSBob2osIGlyb25mb2UgYW5kIHdpbmRmdXJ5XG4gICAgICAgICAgICAvLyBvbiBMSCBjb3JlIGl0IGlzIGhvaiA+IGlyb25mb2UgPiB3aW5kZnVyeVxuICAgICAgICAgICAgLy8gc28gZG8gaXRlbSBwcm9jcyBmaXJzdCwgdGhlbiB3ZWFwb24gcHJvYywgdGhlbiB3aW5kZnVyeVxuICAgICAgICAgICAgZm9yIChsZXQgcHJvYyBvZiB0aGlzLnByb2NzKSB7XG4gICAgICAgICAgICAgICAgcHJvYy5ydW4odGhpcywgKGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oISkud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIChpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCEpLnByb2ModGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZWFsTWVsZWVEYW1hZ2UodGltZTogbnVtYmVyLCByYXdEYW1hZ2U6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXSA9IHRoaXMuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oLCBzcGVsbCk7XG4gICAgICAgIGRhbWFnZURvbmUgPSBNYXRoLnRydW5jKGRhbWFnZURvbmUpOyAvLyB0cnVuY2F0aW5nIGhlcmUgYmVjYXVzZSB3YXJyaW9yIHN1YmNsYXNzIGJ1aWxkcyBvbiB0b3Agb2YgY2FsY3VsYXRlTWVsZWVEYW1hZ2VcbiAgICAgICAgY2xlYW5EYW1hZ2UgPSBNYXRoLnRydW5jKGNsZWFuRGFtYWdlKTsgLy8gVE9ETywgc2hvdWxkIGRhbWFnZU11bHQgYWZmZWN0IGNsZWFuIGRhbWFnZSBhcyB3ZWxsPyBpZiBzbyBtb3ZlIGl0IGludG8gY2FsY3VsYXRlTWVsZWVEYW1hZ2VcblxuICAgICAgICB0aGlzLmRhbWFnZUxvZy5wdXNoKFt0aW1lLCBkYW1hZ2VEb25lXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAodGhpcy5sb2cpIHtcbiAgICAgICAgICAgIGxldCBoaXRTdHIgPSBgWW91ciAke3NwZWxsID8gc3BlbGwubmFtZSA6IChpc19taCA/ICdtYWluLWhhbmQnIDogJ29mZi1oYW5kJyl9ICR7aGl0T3V0Y29tZVN0cmluZ1toaXRPdXRjb21lXX1gO1xuICAgICAgICAgICAgaWYgKCFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZXS5pbmNsdWRlcyhoaXRPdXRjb21lKSkge1xuICAgICAgICAgICAgICAgIGhpdFN0ciArPSBgIGZvciAke2RhbWFnZURvbmV9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubG9nKHRpbWUsIGhpdFN0cik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3BlbGwgaW5zdGFuY2VvZiBTcGVsbERhbWFnZSkge1xuICAgICAgICAgICAgaWYgKHNwZWxsLmNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgLy8gY2FsbGluZyB0aGlzIGJlZm9yZSB1cGRhdGUgcHJvY3MgYmVjYXVzZSBpbiB0aGUgY2FzZSBvZiBleGVjdXRlLCB1bmJyaWRsZWQgd3JhdGggY291bGQgcHJvY1xuICAgICAgICAgICAgICAgIC8vIHRoZW4gc2V0dGluZyB0aGUgcmFnZSB0byAwIHdvdWxkIGNhdXNlIHVzIHRvIGxvc2UgdGhlIDEgcmFnZSBmcm9tIHVuYnJpZGxlZCB3cmF0aFxuICAgICAgICAgICAgICAgIC8vIGFsdGVybmF0aXZlIGlzIHRvIHNhdmUgdGhlIGFtb3VudCBvZiByYWdlIHVzZWQgZm9yIHRoZSBhYmlsaXR5XG4gICAgICAgICAgICAgICAgc3BlbGwuY2FsbGJhY2sodGhpcywgaGl0T3V0Y29tZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnVwZGF0ZVByb2NzKHRpbWUsIGlzX21oLCBoaXRPdXRjb21lLCBkYW1hZ2VEb25lLCBjbGVhbkRhbWFnZSwgc3BlbGwpO1xuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLnVwZGF0ZSh0aW1lKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgc3dpbmdXZWFwb24odGltZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGlzX21oOiBib29sZWFuKSB7XG4gICAgICAgIGNvbnN0IHJhd0RhbWFnZSA9IHRoaXMuY2FsY3VsYXRlU3dpbmdSYXdEYW1hZ2UoaXNfbWgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCF0aGlzLmRvaW5nRXh0cmFBdHRhY2tzICYmIGlzX21oICYmIHRoaXMucXVldWVkU3BlbGwgJiYgdGhpcy5xdWV1ZWRTcGVsbC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFNwZWxsLmNhc3QodGltZSk7XG4gICAgICAgICAgICBjb25zdCBzd2luZ1NwZWxsID0gdGhpcy5xdWV1ZWRTcGVsbC5zcGVsbDtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBjb25zdCBib251c0RhbWFnZSA9IHN3aW5nU3BlbGwuYm9udXNEYW1hZ2U7XG4gICAgICAgICAgICB0aGlzLmRlYWxNZWxlZURhbWFnZSh0aW1lLCByYXdEYW1hZ2UgKyBib251c0RhbWFnZSwgdGFyZ2V0LCBpc19taCwgc3dpbmdTcGVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlYWxNZWxlZURhbWFnZSh0aW1lLCByYXdEYW1hZ2UsIHRhcmdldCwgaXNfbWgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgW3RoaXNXZWFwb24sIG90aGVyV2VhcG9uXSA9IGlzX21oID8gW3RoaXMubWgsIHRoaXMub2hdIDogW3RoaXMub2gsIHRoaXMubWhdO1xuXG4gICAgICAgIHRoaXNXZWFwb24hLm5leHRTd2luZ1RpbWUgPSB0aW1lICsgdGhpc1dlYXBvbiEud2VhcG9uLnNwZWVkIC8gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5oYXN0ZSAqIDEwMDA7XG5cbiAgICAgICAgaWYgKG90aGVyV2VhcG9uICYmIG90aGVyV2VhcG9uLm5leHRTd2luZ1RpbWUgPCB0aW1lICsgMjAwKSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgZGVsYXlpbmcgJHtpc19taCA/ICdPSCcgOiAnTUgnfSBzd2luZ2AsIHRpbWUgKyAyMDAgLSBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lKTtcbiAgICAgICAgICAgIG90aGVyV2VhcG9uLm5leHRTd2luZ1RpbWUgPSB0aW1lICsgMjAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlQXR0YWNraW5nU3RhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aGlzLnRhcmdldCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0cmFBdHRhY2tDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRvaW5nRXh0cmFBdHRhY2tzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB3aGlsZSAodGhpcy5leHRyYUF0dGFja0NvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leHRyYUF0dGFja0NvdW50LS07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuZG9pbmdFeHRyYUF0dGFja3MgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRpbWUgPj0gdGhpcy5taCEubmV4dFN3aW5nVGltZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIHRydWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm9oICYmIHRpbWUgPj0gdGhpcy5vaC5uZXh0U3dpbmdUaW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgUGxheWVyLCBNZWxlZUhpdE91dGNvbWUsIFJhY2UgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IEJ1ZmYsIEJ1ZmZPdmVyVGltZSwgQnVmZlByb2MgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgU3BlbGwsIExlYXJuZWRTcGVsbCwgU3BlbGxEYW1hZ2UsIFNwZWxsVHlwZSwgU3dpbmdTcGVsbCwgTGVhcm5lZFN3aW5nU3BlbGwsIFByb2MsIFNwZWxsQnVmZiB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcblxuY29uc3QgZmx1cnJ5ID0gbmV3IEJ1ZmYoXCJGbHVycnlcIiwgMTUsIHtoYXN0ZTogMS4zfSwgdHJ1ZSwgMywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblxuZXhwb3J0IGNvbnN0IHJhY2VUb1N0YXRzID0gbmV3IE1hcDxSYWNlLCBTdGF0VmFsdWVzPigpO1xucmFjZVRvU3RhdHMuc2V0KFJhY2UuSFVNQU4sIHsgbWFjZVNraWxsOiA1LCBzd29yZFNraWxsOiA1LCBtYWNlMkhTa2lsbDogNSwgc3dvcmQySFNraWxsOiA1LCBzdHI6IDEyMCwgYWdpOiA4MCB9KTtcbnJhY2VUb1N0YXRzLnNldChSYWNlLk9SQywgeyBheGVTa2lsbDogNSwgYXhlMkhTa2lsbDogNSwgc3RyOiAxMjMsIGFnaTogNzcgfSk7XG5cbmV4cG9ydCBjbGFzcyBXYXJyaW9yIGV4dGVuZHMgUGxheWVyIHtcbiAgICByYWdlID0gODA7IC8vIFRPRE8gLSBhbGxvdyBzaW11bGF0aW9uIHRvIGNob29zZSBzdGFydGluZyByYWdlXG5cbiAgICBleGVjdXRlID0gbmV3IExlYXJuZWRTcGVsbChleGVjdXRlU3BlbGwsIHRoaXMpO1xuICAgIGJsb29kdGhpcnN0ID0gbmV3IExlYXJuZWRTcGVsbChibG9vZHRoaXJzdFNwZWxsLCB0aGlzKTtcbiAgICBoYW1zdHJpbmcgPSBuZXcgTGVhcm5lZFNwZWxsKGhhbXN0cmluZ1NwZWxsLCB0aGlzKTtcbiAgICB3aGlybHdpbmQgPSBuZXcgTGVhcm5lZFNwZWxsKHdoaXJsd2luZFNwZWxsLCB0aGlzKTtcbiAgICBoZXJvaWNTdHJpa2UgPSBuZXcgTGVhcm5lZFN3aW5nU3BlbGwoaGVyb2ljU3RyaWtlU3BlbGwsIHRoaXMpO1xuICAgIGJsb29kUmFnZSA9IG5ldyBMZWFybmVkU3BlbGwoYmxvb2RSYWdlLCB0aGlzKTtcbiAgICBkZWF0aFdpc2ggPSBuZXcgTGVhcm5lZFNwZWxsKGRlYXRoV2lzaCwgdGhpcyk7XG4gICAgZXhlY3V0ZVNwZWxsID0gbmV3IExlYXJuZWRTcGVsbChleGVjdXRlU3BlbGwsIHRoaXMpO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZ0NhbGxiYWNrPzogKHRpbWU6IG51bWJlciwgdGV4dDogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5ldyBTdGF0cyhyYWNlVG9TdGF0cy5nZXQocmFjZSkpLmFkZChzdGF0cyksIGxvZ0NhbGxiYWNrKTtcblxuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChhbmdlck1hbmFnZW1lbnRPVCwgTWF0aC5yYW5kb20oKSAqIC0zMDAwKTsgLy8gcmFuZG9taXppbmcgYW5nZXIgbWFuYWdlbWVudCB0aW1pbmdcbiAgICAgICAgdGhpcy5idWZmTWFuYWdlci5hZGQodW5icmlkbGVkV3JhdGgsIDApO1xuICAgIH1cblxuICAgIGdldCBwb3dlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmFnZTtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge1xuICAgICAgICB0aGlzLnBvd2VyTG9zdCArPSBNYXRoLm1heCgwLCBwb3dlciAtIDEwMCk7XG4gICAgICAgIHRoaXMucmFnZSA9IGNsYW1wKHBvd2VyLCAwLCAxMDApO1xuICAgIH1cblxuICAgIGdldCBhcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiAzIC0gMjAgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmFwICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdHIgKiB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0YXRNdWx0ICogMjtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVDcml0Q2hhbmNlKCkge1xuICAgICAgICAvLyBjcnVlbHR5ICsgYmVyc2Vya2VyIHN0YW5jZVxuICAgICAgICByZXR1cm4gNSArIDMgKyBzdXBlci5jYWxjdWxhdGVDcml0Q2hhbmNlKCk7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpOiBbbnVtYmVyLCBNZWxlZUhpdE91dGNvbWUsIG51bWJlcl0ge1xuICAgICAgICBsZXQgW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXSA9IHN1cGVyLmNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZSwgdmljdGltLCBpc19taCwgc3BlbGwpO1xuXG4gICAgICAgIGlmIChoaXRPdXRjb21lID09PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQgJiYgc3BlbGwpIHtcbiAgICAgICAgICAgIGRhbWFnZURvbmUgKj0gMS4xOyAvLyBpbXBhbGVcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIFtkYW1hZ2VEb25lLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV07XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHJld2FyZFJhZ2UoZGFtYWdlOiBudW1iZXIsIGlzX2F0dGFja2VyOiBib29sZWFuLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgLy8gaHR0cHM6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvMTgzMjUtdGhlLW5ldy1yYWdlLWZvcm11bGEtYnkta2FsZ2FuL1xuICAgICAgICAvLyBQcmUtRXhwYW5zaW9uIFJhZ2UgR2FpbmVkIGZyb20gZGVhbGluZyBkYW1hZ2U6XG4gICAgICAgIC8vIChEYW1hZ2UgRGVhbHQpIC8gKFJhZ2UgQ29udmVyc2lvbiBhdCBZb3VyIExldmVsKSAqIDcuNVxuICAgICAgICAvLyBGb3IgVGFraW5nIERhbWFnZSAoYm90aCBwcmUgYW5kIHBvc3QgZXhwYW5zaW9uKTpcbiAgICAgICAgLy8gUmFnZSBHYWluZWQgPSAoRGFtYWdlIFRha2VuKSAvIChSYWdlIENvbnZlcnNpb24gYXQgWW91ciBMZXZlbCkgKiAyLjVcbiAgICAgICAgLy8gUmFnZSBDb252ZXJzaW9uIGF0IGxldmVsIDYwOiAyMzAuNlxuICAgICAgICAvLyBUT0RPIC0gaG93IGRvIGZyYWN0aW9ucyBvZiByYWdlIHdvcms/IGl0IGFwcGVhcnMgeW91IGRvIGdhaW4gZnJhY3Rpb25zIGJhc2VkIG9uIGV4ZWMgZGFtYWdlXG4gICAgICAgIC8vIG5vdCB0cnVuY2F0aW5nIGZvciBub3dcbiAgICAgICAgLy8gVE9ETyAtIGl0IGFwcGVhcnMgdGhhdCByYWdlIGlzIGNhbGN1bGF0ZWQgdG8gdGVudGhzIGJhc2VkIG9uIGRhdGFiYXNlIHZhbHVlcyBvZiBzcGVsbHMgKDEwIGVuZXJneSA9IDEgcmFnZSlcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IExFVkVMXzYwX1JBR0VfQ09OViA9IDIzMC42O1xuICAgICAgICBsZXQgYWRkUmFnZSA9IGRhbWFnZSAvIExFVkVMXzYwX1JBR0VfQ09OVjtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc19hdHRhY2tlcikge1xuICAgICAgICAgICAgYWRkUmFnZSAqPSA3LjU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUT0RPIC0gY2hlY2sgZm9yIGJlcnNlcmtlciByYWdlIDEuM3ggbW9kaWZpZXJcbiAgICAgICAgICAgIGFkZFJhZ2UgKj0gMi41O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubG9nKSB0aGlzLmxvZyh0aW1lLCBgR2FpbmVkICR7TWF0aC5taW4oYWRkUmFnZSwgMTAwIC0gdGhpcy5yYWdlKX0gcmFnZSAoJHtNYXRoLm1pbigxMDAsIHRoaXMucG93ZXIgKyBhZGRSYWdlKX0pYCk7XG5cbiAgICAgICAgdGhpcy5wb3dlciArPSBhZGRSYWdlO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIHN1cGVyLnVwZGF0ZVByb2NzKHRpbWUsIGlzX21oLCBoaXRPdXRjb21lLCBkYW1hZ2VEb25lLCBjbGVhbkRhbWFnZSwgc3BlbGwpO1xuXG4gICAgICAgIGlmIChbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWSwgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIGlmIChzcGVsbCkge1xuICAgICAgICAgICAgICAgIC8vIGh0dHA6Ly9ibHVlLm1tby1jaGFtcGlvbi5jb20vdG9waWMvNjkzNjUtMTgtMDItMDUta2FsZ2Fucy1yZXNwb25zZS10by13YXJyaW9ycy8gXCJzaW5jZSBtaXNzaW5nIHdhc3RlcyAyMCUgb2YgdGhlIHJhZ2UgY29zdCBvZiB0aGUgYWJpbGl0eVwiXG4gICAgICAgICAgICAgICAgLy8gVE9ETyAtIG5vdCBzdXJlIGhvdyBibGl6emxpa2UgdGhpcyBpc1xuICAgICAgICAgICAgICAgIGlmIChzcGVsbCAhPT0gd2hpcmx3aW5kU3BlbGwpIHsgLy8gVE9ETyAtIHNob3VsZCBjaGVjayB0byBzZWUgaWYgaXQgaXMgYW4gYW9lIHNwZWxsIG9yIGEgc2luZ2xlIHRhcmdldCBzcGVsbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJhZ2UgKz0gc3BlbGwuY29zdCAqIDAuODI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoY2xlYW5EYW1hZ2UgKiAwLjc1LCB0cnVlLCB0aW1lKTsgLy8gVE9ETyAtIHdoZXJlIGlzIHRoaXMgZm9ybXVsYSBmcm9tP1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGRhbWFnZURvbmUgJiYgIXNwZWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJld2FyZFJhZ2UoZGFtYWdlRG9uZSwgdHJ1ZSwgdGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnN0YW50IGF0dGFja3MgYW5kIG1pc3Nlcy9kb2RnZXMgZG9uJ3QgdXNlIGZsdXJyeSBjaGFyZ2VzIC8vIFRPRE8gLSBjb25maXJtLCB3aGF0IGFib3V0IHBhcnJ5P1xuICAgICAgICAvLyBleHRyYSBhdHRhY2tzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyBidXQgdGhleSBjYW4gcHJvYyBmbHVycnkgKHRlc3RlZClcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXRoaXMuZG9pbmdFeHRyYUF0dGFja3NcbiAgICAgICAgICAgICYmICEoc3BlbGwgfHwgc3BlbGwgPT09IGhlcm9pY1N0cmlrZVNwZWxsKVxuICAgICAgICAgICAgJiYgIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpXG4gICAgICAgICAgICAmJiBoaXRPdXRjb21lICE9PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVRcbiAgICAgICAgKSB7IFxuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5yZW1vdmUoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCkge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGlnbm9yaW5nIGRlZXAgd291bmRzXG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChmbHVycnksIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZXJvaWNTdHJpa2VTcGVsbCA9IG5ldyBTd2luZ1NwZWxsKFwiSGVyb2ljIFN0cmlrZVwiLCAxNTcsIDEyKTtcblxuLy8gZXhlY3V0ZSBhY3R1YWxseSB3b3JrcyBieSBjYXN0aW5nIHR3byBzcGVsbHMsIGZpcnN0IHJlcXVpcmVzIHdlYXBvbiBidXQgZG9lcyBubyBkYW1hZ2Vcbi8vIHNlY29uZCBvbmUgZG9lc24ndCByZXF1aXJlIHdlYXBvbiBhbmQgZGVhbHMgdGhlIGRhbWFnZS5cbi8vIExIIGNvcmUgb3ZlcnJvZGUgdGhlIHNlY29uZCBzcGVsbCB0byByZXF1aXJlIHdlYXBvbiAoYmVuZWZpdCBmcm9tIHdlYXBvbiBza2lsbClcbmNvbnN0IGV4ZWN1dGVTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkV4ZWN1dGVcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIDYwMCArIChwbGF5ZXIucG93ZXIgLSAxMCkgKiAxNTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIHRydWUsIDEwLCAwLCAocGxheWVyOiBQbGF5ZXIsIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSkgPT4ge1xuICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0UsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTU10uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgcGxheWVyLnBvd2VyID0gMDtcbiAgICB9XG59KTtcblxuY29uc3QgYmxvb2R0aGlyc3RTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkJsb29kdGhpcnN0XCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiAoPFdhcnJpb3I+cGxheWVyKS5hcCAqIDAuNDU7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUwsIHRydWUsIDMwLCA2KTtcblxuY29uc3Qgd2hpcmx3aW5kU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJXaGlybHdpbmRcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIHBsYXllci5jYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZSh0cnVlKTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIHRydWUsIDI1LCAxMCk7XG5cbmNvbnN0IGhhbXN0cmluZ1NwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiSGFtc3RyaW5nXCIsIDQ1LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCB0cnVlLCAxMCwgMCk7XG5cbmV4cG9ydCBjb25zdCBhbmdlck1hbmFnZW1lbnRPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJBbmdlciBNYW5hZ2VtZW50XCIsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCB1bmRlZmluZWQsIDMwMDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgcGxheWVyLnBvd2VyICs9IDE7XG4gICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluZWQgMSByYWdlIGZyb20gQW5nZXIgTWFuYWdlbWVudGApO1xufSk7XG5cbmNvbnN0IGJsb29kUmFnZU9UID0gbmV3IEJ1ZmZPdmVyVGltZShcIkJsb29kcmFnZVwiLCAxMCwgdW5kZWZpbmVkLCAxMDAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbmVkIDEgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xufSk7XG5cbmNvbnN0IGJsb29kUmFnZSA9IG5ldyBTcGVsbChcIkJsb29kcmFnZVwiLCBTcGVsbFR5cGUuTk9ORSwgZmFsc2UsIDAsIDYwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxMDtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMTAgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xuICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYmxvb2RSYWdlT1QsIHRpbWUpO1xufSk7XG5cbmNvbnN0IGRlYXRoV2lzaCA9IG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJEZWF0aCBXaXNoXCIsIDMwLCB7IGRhbWFnZU11bHQ6IDEuMiB9KSwgdHJ1ZSwgMTAsIDMgKiA2MCk7XG5cbmNvbnN0IHVuYnJpZGxlZFdyYXRoID0gbmV3IEJ1ZmZQcm9jKFwiVW5icmlkbGVkIFdyYXRoXCIsIDYwICogNjAsXG4gICAgbmV3IFByb2MoXG4gICAgICAgIG5ldyBTcGVsbChcIlVuYnJpZGxlZCBXcmF0aFwiLCBTcGVsbFR5cGUuTk9ORSwgZmFsc2UsIDAsIDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMSByYWdlIGZyb20gVW5icmlkbGVkIFdyYXRoYCk7XG4gICAgICAgICAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICAgICAgfSksXG4gICAgICAgIHtjaGFuY2U6IDQwfSkpO1xuIiwiaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBTcGVsbEJ1ZmYsIFByb2MsIEV4dHJhQXR0YWNrIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBTdGF0cywgU3RhdFZhbHVlcyB9IGZyb20gXCIuLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgVGVtcG9yYXJ5V2VhcG9uRW5jaGFudCB9IGZyb20gXCIuLi9pdGVtLmpzXCI7XG5cblxuZXhwb3J0IGludGVyZmFjZSBCdWZmRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBkdXJhdGlvbjogbnVtYmVyLFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbn1cblxuZXhwb3J0IGNvbnN0IGJ1ZmZzOiBCdWZmW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhdHRsZSBTaG91dFwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDI5MFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2lmdCBvZiB0aGUgV2lsZFwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDE2LCAvLyBUT0RPIC0gc2hvdWxkIGl0IGJlIDEyICogMS4zNT8gKHRhbGVudClcbiAgICAgICAgICAgIGFnaTogMTZcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRydWVzaG90IEF1cmFcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDEwMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3Npbmcgb2YgS2luZ3NcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdGF0TXVsdDogMS4xXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2luZyBvZiBNaWdodFwiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyMjJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNtb2tlZCBEZXNlcnQgRHVtcGxpbmdzXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAyMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSnVqdSBQb3dlclwiLFxuICAgICAgICBkdXJhdGlvbjogMzAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMzBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgTWlnaHRcIixcbiAgICAgICAgZHVyYXRpb246IDEwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogNDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVsaXhpciBvZiB0aGUgTW9uZ29vc2VcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYWdpOiAyNSxcbiAgICAgICAgICAgIGNyaXQ6IDJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIuTy5JLkQuUy5cIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAyNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmFsbHlpbmcgQ3J5IG9mIHRoZSBEcmFnb25zbGF5ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDE0MCxcbiAgICAgICAgICAgIGNyaXQ6IDVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNvbmdmbG93ZXIgU2VyYW5hZGVcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgY3JpdDogNSxcbiAgICAgICAgICAgIHN0cjogMTUsXG4gICAgICAgICAgICBhZ2k6IDE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTcGlyaXQgb2YgWmFuZGFsYXJcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RhdE11bHQ6IDEuMTVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkZlbmd1cycgRmVyb2NpdHlcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDIwMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiV2FyY2hpZWYncyBCbGVzc2luZ1wiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBoYXN0ZTogMS4xNVxuICAgICAgICB9XG4gICAgfSxcbl0ubWFwKChiZDogQnVmZkRlc2NyaXB0aW9uKSA9PiBuZXcgQnVmZihiZC5uYW1lLCBiZC5kdXJhdGlvbiwgYmQuc3RhdHMpKTtcblxuLy8gTk9URTogdG8gc2ltcGxpZnkgdGhlIGNvZGUsIHRyZWF0aW5nIHRoZXNlIGFzIHR3byBzZXBhcmF0ZSBidWZmcyBzaW5jZSB0aGV5IHN0YWNrXG4vLyBjcnVzYWRlciBidWZmcyBhcHBhcmVudGx5IGNhbiBiZSBmdXJ0aGVyIHN0YWNrZWQgYnkgc3dhcHBpbmcgd2VhcG9ucyBidXQgbm90IGdvaW5nIHRvIGJvdGhlciB3aXRoIHRoYXRcbmV4cG9ydCBjb25zdCBjcnVzYWRlckJ1ZmZNSFByb2MgPSBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiQ3J1c2FkZXIgTUhcIiwgMTUsIG5ldyBTdGF0cyh7c3RyOiAxMDB9KSkpLCB7cHBtOiAxfSk7XG5leHBvcnQgY29uc3QgY3J1c2FkZXJCdWZmT0hQcm9jID0gbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE9IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pO1xuXG5leHBvcnQgY29uc3QgZGVuc2VEYW1hZ2VTdG9uZSA9IG5ldyBUZW1wb3JhcnlXZWFwb25FbmNoYW50KHsgcGx1c0RhbWFnZTogOCB9KTtcblxuZXhwb3J0IGNvbnN0IHdpbmRmdXJ5RW5jaGFudCA9IG5ldyBUZW1wb3JhcnlXZWFwb25FbmNoYW50KHVuZGVmaW5lZCwgbmV3IFByb2MoW1xuICAgIG5ldyBFeHRyYUF0dGFjayhcIldpbmRmdXJ5IFRvdGVtXCIsIDEpLFxuICAgIG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJXaW5kZnVyeSBUb3RlbVwiLCAxLjUsIHsgYXA6IDMxNSB9KSlcbl0sIHtjaGFuY2U6IDAuMn0pKTtcbiIsImltcG9ydCB7IFdlYXBvblR5cGUsIFdlYXBvbkRlc2NyaXB0aW9uLCBJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uIH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcbmltcG9ydCB7IFNwZWxsQnVmZiwgRXh0cmFBdHRhY2ssIFByb2MsIFNwZWxsIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmUHJvYyB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5cbi8vIFRPRE8gLSBob3cgdG8gaW1wbGVtZW50IHNldCBib251c2VzPyBwcm9iYWJseSBlYXNpZXN0IHRvIGFkZCBib251cyB0aGF0IHJlcXVpcmVzIGEgc3RyaW5nIHNlYXJjaCBvZiBvdGhlciBlcXVpcGVkIGl0ZW1zXG5cbmV4cG9ydCBjb25zdCBpdGVtczogKEl0ZW1EZXNjcmlwdGlvbnxXZWFwb25EZXNjcmlwdGlvbilbXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSXJvbmZvZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBtaW46IDczLFxuICAgICAgICBtYXg6IDEzNixcbiAgICAgICAgc3BlZWQ6IDIuNCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBFeHRyYUF0dGFjaygnSXJvbmZvZScsIDIpLHtwcG06IDF9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVtcHlyZWFuIERlbW9saXNoZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiA5NCxcbiAgICAgICAgbWF4OiAxNzUsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiSGFzdGUgKEVtcHlyZWFuIERlbW9saXNoZXIpXCIsIDEwLCB7aGFzdGU6IDEuMn0pKSx7cHBtOiAxfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJBbnViaXNhdGggV2FyaGFtbWVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA2NixcbiAgICAgICAgbWF4OiAxMjMsXG4gICAgICAgIHNwZWVkOiAxLjgsXG4gICAgICAgIHN0YXRzOiB7IG1hY2VTa2lsbDogNCwgYXA6IDMyIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaGUgVW50YW1lZCBCbGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JEMkgsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDE5MixcbiAgICAgICAgbWF4OiAyODksXG4gICAgICAgIHNwZWVkOiAzLjQsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiVW50YW1lZCBGdXJ5XCIsIDgsIHtzdHI6IDMwMH0pKSx7cHBtOiAyfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJIYW5kIG9mIEp1c3RpY2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHthcDogMjB9LFxuICAgICAgICBvbmVxdWlwOiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0hhbmQgb2YgSnVzdGljZScsIDEpLCB7Y2hhbmNlOiAyLzEwMH0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxhY2toYW5kJ3MgQnJlYWR0aFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJha2UgRmFuZyBUYWxpc21hblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiA1NiwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkxpb25oZWFydCBIZWxtXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMiwgaGl0OiAyLCBzdHI6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhcmJlZCBDaG9rZXJcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthcDogNDQsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiT255eGlhIFRvb3RoIFBlbmRhbnRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDEyLCBoaXQ6IDEsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgU3BhdWxkZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTYsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDbG9hayBvZiBEcmFjb25pYyBNaWdodFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge3N0cjogMTYsIGFnaTogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJhcGUgb2YgVW55aWVsZGluZyBTdHJlbmd0aFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge3N0cjogMTUsIGFnaTogOSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNvbnF1ZXJvcidzIEJyZWFzdHBsYXRlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTYsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTYXZhZ2UgR2xhZGlhdG9yIENoYWluXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkNIRVNULFxuICAgICAgICBzdGF0czoge2FnaTogMTQsIHN0cjogMTMsIGNyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2hvdWwgU2tpbiBUdW5pY1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDQwLCBjcml0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJyZWFzdHBsYXRlIG9mIEFubmloaWxhdGlvblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDM3LCBjcml0OiAxLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSGl2ZSBEZWZpbGVyIFdyaXN0Z3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjMsIGFnaTogMTh9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUWlyYWppIEV4ZWN1dGlvbiBCcmFjZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge2FnaTogMTYsIHN0cjogMTUsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgTWlnaHRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdhdW50bGV0cyBvZiBBbm5paGlsYXRpb25cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzNSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVkZ2VtYXN0ZXIncyBIYW5kZ3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czogeyBheGVTa2lsbDogNywgZGFnZ2VyU2tpbGw6IDcsIHN3b3JkU2tpbGw6IDcgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9uc2xhdWdodCBHaXJkbGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV0FJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRpdGFuaWMgTGVnZ2luZ3NcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDMwLCBjcml0OiAxLCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQm9vdHMgb2YgdGhlIEZhbGxlbiBIZXJvXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNocm9tYXRpYyBCb290c1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMjAsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTdHJpa2VyJ3MgTWFya1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SQU5HRUQsXG4gICAgICAgIHN0YXRzOiB7YXA6IDIyLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRG9uIEp1bGlvJ3MgQmFuZFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHtjcml0OiAxLCBoaXQ6IDEsIGFwOiAxNn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJRdWljayBTdHJpa2UgUmluZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthcDogMzAsIGNyaXQ6IDEsIHN0cjogNX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWNhbGx5IFRlbXBlcmVkIFN3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTA2LFxuICAgICAgICBtYXg6IDE5OCxcbiAgICAgICAgc3BlZWQ6IDIuNixcbiAgICAgICAgc3RhdHM6IHsgYWdpOiAxNCwgc3RyOiAxNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFsYWRhdGgsIFJ1bmVkIEJsYWRlIG9mIHRoZSBCbGFjayBGbGlnaHRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4NixcbiAgICAgICAgbWF4OiAxNjIsXG4gICAgICAgIHNwZWVkOiAyLjIsXG4gICAgICAgIHN0YXRzOiB7IHN3b3JkU2tpbGw6IDQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFuY2llbnQgUWlyYWppIFJpcHBlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExNCxcbiAgICAgICAgbWF4OiAyMTMsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyMCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUjE0IExvbmdzd29yZFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEzOCxcbiAgICAgICAgbWF4OiAyMDcsXG4gICAgICAgIHNwZWVkOiAyLjksXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUjE0IFN3aWZ0YmxhZGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4NSxcbiAgICAgICAgbWF4OiAxMjksXG4gICAgICAgIHNwZWVkOiAxLjgsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUjE0IEF4ZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzZWQgUWlyYWppIFdhciBBeGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTEwLFxuICAgICAgICBtYXg6IDIwNSxcbiAgICAgICAgc3BlZWQ6IDIuNjAsXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAxNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ3J1bCdzaG9ydWtoLCBFZGdlIG9mIENoYW9zXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEwMSxcbiAgICAgICAgbWF4OiAxODgsXG4gICAgICAgIHNwZWVkOiAyLjMwLFxuICAgICAgICBzdGF0czogeyBhcDogMzYgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIG9udXNlOiAoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW5zaWdodE9mVGhlUWlyYWppID0gbmV3IEJ1ZmYoXCJJbnNpZ2h0IG9mIHRoZSBRaXJhamlcIiwgMzAsIHthcm1vclBlbmV0cmF0aW9uOiAyMDB9LCB0cnVlLCAwLCA2KTtcbiAgICAgICAgICAgIGNvbnN0IGJhZGdlQnVmZiA9IG5ldyBTcGVsbEJ1ZmYoXG4gICAgICAgICAgICAgICAgbmV3IEJ1ZmZQcm9jKFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIiwgMzAsXG4gICAgICAgICAgICAgICAgICAgIG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYoaW5zaWdodE9mVGhlUWlyYWppKSwge3BwbTogMTV9KSxcbiAgICAgICAgICAgICAgICAgICAgaW5zaWdodE9mVGhlUWlyYWppKSxcbiAgICAgICAgICAgICAgICBmYWxzZSwgMCwgMyAqIDYwKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGJhZGdlQnVmZjtcbiAgICAgICAgfSkoKVxuICAgIH1cbl0uc29ydCgoYSwgYikgPT4ge1xuICAgIHJldHVybiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpO1xufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmRleEZvckl0ZW1OYW1lKG5hbWU6IHN0cmluZyk6IG51bWJlcnx1bmRlZmluZWQge1xuICAgIGZvciAobGV0IFtpZHgsIGl0ZW1dIG9mIGl0ZW1zLmVudHJpZXMoKSkge1xuICAgICAgICBpZiAoaXRlbS5uYW1lID09PSBuYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gaWR4O1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3RhdFZhbHVlcyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBJdGVtV2l0aFNsb3QgfSBmcm9tIFwiLi9zaW11bGF0aW9uLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgTG9nRnVuY3Rpb24sIFJhY2UgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IFdhcnJpb3IgfSBmcm9tIFwiLi93YXJyaW9yLmpzXCI7XG5pbXBvcnQgeyBjcnVzYWRlckJ1ZmZNSFByb2MsIGNydXNhZGVyQnVmZk9IUHJvYywgYnVmZnMsIHdpbmRmdXJ5RW5jaGFudCwgZGVuc2VEYW1hZ2VTdG9uZSB9IGZyb20gXCIuL2RhdGEvc3BlbGxzLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgSXRlbVNsb3QgfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBpdGVtcyB9IGZyb20gXCIuL2RhdGEvaXRlbXMuanNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBTaW11bGF0aW9uRGVzY3JpcHRpb24ge1xuICAgIHJhY2U6IFJhY2UsXG4gICAgc3RhdHM6IFN0YXRWYWx1ZXMsXG4gICAgZXF1aXBtZW50OiBbbnVtYmVyLCBJdGVtU2xvdF1bXSxcbiAgICBidWZmczogbnVtYmVyW10sXG4gICAgZmlnaHRMZW5ndGg6IG51bWJlcixcbiAgICByZWFsdGltZTogYm9vbGVhbixcbiAgICBoZXJvaWNTdHJpa2VSYWdlUmVxOiBudW1iZXIsXG4gICAgaGFtc3RyaW5nUmFnZVJlcTogbnVtYmVyLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBQbGF5ZXIocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgY29uc3QgcGxheWVyID0gbmV3IFdhcnJpb3IocmFjZSwgc3RhdHMsIGxvZyk7XG5cbiAgICBmb3IgKGxldCBbaXRlbSwgc2xvdF0gb2YgZXF1aXBtZW50KSB7XG4gICAgICAgIHBsYXllci5lcXVpcChpdGVtLCBzbG90KTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBidWZmIG9mIGJ1ZmZzKSB7XG4gICAgICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYnVmZiwgMCk7XG4gICAgfVxuXG4gICAgcGxheWVyLm1oIS5hZGRQcm9jKGNydXNhZGVyQnVmZk1IUHJvYyk7XG4gICAgcGxheWVyLm1oIS50ZW1wb3JhcnlFbmNoYW50ID0gcmFjZSA9PT0gUmFjZS5PUkMgPyB3aW5kZnVyeUVuY2hhbnQgOiBkZW5zZURhbWFnZVN0b25lO1xuXG4gICAgaWYgKHBsYXllci5vaCkge1xuICAgICAgICBwbGF5ZXIub2guYWRkUHJvYyhjcnVzYWRlckJ1ZmZPSFByb2MpO1xuICAgICAgICBwbGF5ZXIub2gudGVtcG9yYXJ5RW5jaGFudCA9IGRlbnNlRGFtYWdlU3RvbmU7XG4gICAgfVxuXG4gICAgY29uc3QgYm9zcyA9IG5ldyBVbml0KDYzLCA0NjkxIC0gMjI1MCAtIDY0MCAtIDUwNSAtIDYwMCk7IC8vIHN1bmRlciwgY29yLCBmZiwgYW5uaWhcbiAgICBwbGF5ZXIudGFyZ2V0ID0gYm9zcztcblxuICAgIHJldHVybiBwbGF5ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlcXVpcG1lbnRJbmRpY2VzVG9JdGVtKGVxdWlwbWVudDogW251bWJlciwgSXRlbVNsb3RdW10pOiBJdGVtV2l0aFNsb3RbXSB7XG4gICAgY29uc3QgcmVzOiBJdGVtV2l0aFNsb3RbXSA9IFtdO1xuICAgIFxuICAgIGZvciAobGV0IFtpZHgsIHNsb3RdIG9mIGVxdWlwbWVudCkge1xuICAgICAgICBpZiAoaXRlbXNbaWR4XSkge1xuICAgICAgICAgICAgcmVzLnB1c2goW2l0ZW1zW2lkeF0sIHNsb3RdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgaXRlbSBpbmRleCcsIGlkeCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVmZkluZGljZXNUb0J1ZmYoYnVmZkluZGljZXM6IG51bWJlcltdKTogQnVmZltdIHtcbiAgICBjb25zdCByZXM6IEJ1ZmZbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaWR4IG9mIGJ1ZmZJbmRpY2VzKSB7XG4gICAgICAgIGlmIChidWZmc1tpZHhdKSB7XG4gICAgICAgICAgICByZXMucHVzaChidWZmc1tpZHhdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgYnVmZiBpbmRleCcsIGlkeCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlcztcbn1cbiIsImltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1EZXNjcmlwdGlvbiwgSXRlbVNsb3QgfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgTG9nRnVuY3Rpb24sIFBsYXllciwgUmFjZSwgRGFtYWdlTG9nIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBzZXR1cFBsYXllciB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcblxuZXhwb3J0IHR5cGUgSXRlbVdpdGhTbG90ID0gW0l0ZW1EZXNjcmlwdGlvbiwgSXRlbVNsb3RdO1xuXG4vLyBUT0RPIC0gY2hhbmdlIHRoaXMgaW50ZXJmYWNlIHNvIHRoYXQgQ2hvb3NlQWN0aW9uIGNhbm5vdCBzY3JldyB1cCB0aGUgc2ltIG9yIGNoZWF0XG4vLyBlLmcuIENob29zZUFjdGlvbiBzaG91bGRuJ3QgY2FzdCBzcGVsbHMgYXQgYSBjdXJyZW50IHRpbWVcbmV4cG9ydCB0eXBlIENob29zZUFjdGlvbiA9IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyLCBmaWdodExlbmd0aDogbnVtYmVyLCBjYW5FeGVjdXRlOiBib29sZWFuKSA9PiBudW1iZXJ8dW5kZWZpbmVkO1xuXG5leHBvcnQgY29uc3QgRVhFQ1VURV9QSEFTRV9SQVRJTyA9IDAuMTU7IC8vIGxhc3QgMTUlIG9mIHRoZSB0aW1lIGlzIGV4ZWN1dGUgcGhhc2VcblxuY2xhc3MgRmlnaHQge1xuICAgIHBsYXllcjogUGxheWVyO1xuICAgIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uO1xuICAgIGZpZ2h0TGVuZ3RoOiBudW1iZXI7XG4gICAgZHVyYXRpb24gPSAwO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICB0aGlzLnBsYXllciA9IHNldHVwUGxheWVyKHJhY2UsIHN0YXRzLCBlcXVpcG1lbnQsIGJ1ZmZzLCBsb2cpO1xuICAgICAgICB0aGlzLmNob29zZUFjdGlvbiA9IGNob29zZUFjdGlvbjtcbiAgICAgICAgdGhpcy5maWdodExlbmd0aCA9IChmaWdodExlbmd0aCArIE1hdGgucmFuZG9tKCkgKiA0IC0gMikgKiAxMDAwO1xuICAgIH1cblxuICAgIHJ1bigpOiBQcm9taXNlPEZpZ2h0UmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZiwgcikgPT4ge1xuICAgICAgICAgICAgd2hpbGUgKHRoaXMuZHVyYXRpb24gPD0gdGhpcy5maWdodExlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGYoe1xuICAgICAgICAgICAgICAgIGRhbWFnZUxvZzogdGhpcy5wbGF5ZXIuZGFtYWdlTG9nLFxuICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiB0aGlzLmZpZ2h0TGVuZ3RoLFxuICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogdGhpcy5wbGF5ZXIucG93ZXJMb3N0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7fVxuXG4gICAgY2FuY2VsKCkge31cblxuICAgIHByb3RlY3RlZCB1cGRhdGUoKSB7XG4gICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSB0aGlzLmZpZ2h0TGVuZ3RoICogKDEgLSBFWEVDVVRFX1BIQVNFX1JBVElPKTtcbiAgICAgICAgY29uc3QgaXNFeGVjdXRlUGhhc2UgPSB0aGlzLmR1cmF0aW9uID49IGJlZ2luRXhlY3V0ZVRpbWU7XG5cbiAgICAgICAgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIudXBkYXRlKHRoaXMuZHVyYXRpb24pOyAvLyBuZWVkIHRvIGNhbGwgdGhpcyBpZiB0aGUgZHVyYXRpb24gY2hhbmdlZCBiZWNhdXNlIG9mIGJ1ZmZzIHRoYXQgY2hhbmdlIG92ZXIgdGltZSBsaWtlIGpvbSBnYWJiZXJcblxuICAgICAgICB0aGlzLmNob29zZUFjdGlvbih0aGlzLnBsYXllciwgdGhpcy5kdXJhdGlvbiwgdGhpcy5maWdodExlbmd0aCwgaXNFeGVjdXRlUGhhc2UpOyAvLyBjaG9vc2UgYWN0aW9uIGJlZm9yZSBpbiBjYXNlIG9mIGFjdGlvbiBkZXBlbmRpbmcgb24gdGltZSBvZmYgdGhlIGdjZCBsaWtlIGVhcnRoc3RyaWtlXG5cbiAgICAgICAgdGhpcy5wbGF5ZXIudXBkYXRlQXR0YWNraW5nU3RhdGUodGhpcy5kdXJhdGlvbik7XG4gICAgICAgIC8vIGNob29zZSBhY3Rpb24gYWZ0ZXIgZXZlcnkgc3dpbmcgd2hpY2ggY291bGQgYmUgYSByYWdlIGdlbmVyYXRpbmcgZXZlbnQsIGJ1dCBUT0RPOiBuZWVkIHRvIGFjY291bnQgZm9yIGxhdGVuY3ksIHJlYWN0aW9uIHRpbWUgKGJ1dHRvbiBtYXNoaW5nKVxuICAgICAgICBjb25zdCB3YWl0aW5nRm9yVGltZSA9IHRoaXMuY2hvb3NlQWN0aW9uKHRoaXMucGxheWVyLCB0aGlzLmR1cmF0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCBpc0V4ZWN1dGVQaGFzZSk7XG5cbiAgICAgICAgbGV0IG5leHRTd2luZ1RpbWUgPSB0aGlzLnBsYXllci5taCEubmV4dFN3aW5nVGltZTtcblxuICAgICAgICBpZiAodGhpcy5wbGF5ZXIub2gpIHtcbiAgICAgICAgICAgIG5leHRTd2luZ1RpbWUgPSBNYXRoLm1pbihuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5vaC5uZXh0U3dpbmdUaW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlbXBvcmFyeSBoYWNrXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAvLyBkb24ndCBpbmNyZW1lbnQgZHVyYXRpb24gKFRPRE86IGJ1dCBJIHJlYWxseSBzaG91bGQgYmVjYXVzZSB0aGUgc2VydmVyIGRvZXNuJ3QgbG9vcCBpbnN0YW50bHkpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wbGF5ZXIubmV4dEdDRFRpbWUgPiB0aGlzLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4odGhpcy5wbGF5ZXIubmV4dEdDRFRpbWUsIG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLm5leHRPdmVyVGltZVVwZGF0ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4obmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIubmV4dE92ZXJUaW1lVXBkYXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3YWl0aW5nRm9yVGltZSAmJiB3YWl0aW5nRm9yVGltZSA8IHRoaXMuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSB3YWl0aW5nRm9yVGltZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNFeGVjdXRlUGhhc2UgJiYgYmVnaW5FeGVjdXRlVGltZSA8IHRoaXMuZHVyYXRpb24pIHsgLy8gbm90IGV4ZWN1dGUgYXQgc3RhcnQgb2YgdXBkYXRlXG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gYmVnaW5FeGVjdXRlVGltZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgUmVhbHRpbWVGaWdodCBleHRlbmRzIEZpZ2h0IHtcbiAgICBwcm90ZWN0ZWQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICBydW4oKTogUHJvbWlzZTxGaWdodFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIGxldCBvdmVycmlkZUR1cmF0aW9uID0gMDtcblxuICAgICAgICAgICAgY29uc3QgbG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVycmlkZUR1cmF0aW9uICs9IDEwMDAgLyA2MDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBvdmVycmlkZUR1cmF0aW9uO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShsb29wKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhbWFnZUxvZzogdGhpcy5wbGF5ZXIuZGFtYWdlTG9nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlnaHRMZW5ndGg6IHRoaXMuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3dlckxvc3Q6IHRoaXMucGxheWVyLnBvd2VyTG9zdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUobG9vcCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLnBhdXNlZCA9ICF0aGlzLnBhdXNlZDtcbiAgICB9XG59XG5cbmV4cG9ydCB0eXBlIEZpZ2h0UmVzdWx0ID0geyBkYW1hZ2VMb2c6IERhbWFnZUxvZywgZmlnaHRMZW5ndGg6IG51bWJlciwgcG93ZXJMb3N0OiBudW1iZXJ9O1xuXG5leHBvcnQgY2xhc3MgU2ltdWxhdGlvbiB7XG4gICAgcmFjZTogUmFjZTtcbiAgICBzdGF0czogU3RhdFZhbHVlcztcbiAgICBlcXVpcG1lbnQ6IEl0ZW1XaXRoU2xvdFtdO1xuICAgIGJ1ZmZzOiBCdWZmW107XG4gICAgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb247XG4gICAgcHJvdGVjdGVkIGZpZ2h0TGVuZ3RoOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHJlYWx0aW1lOiBib29sZWFuO1xuICAgIGxvZz86IExvZ0Z1bmN0aW9uXG5cbiAgICBwcm90ZWN0ZWQgcmVxdWVzdFN0b3AgPSBmYWxzZTtcbiAgICBwcm90ZWN0ZWQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICBmaWdodFJlc3VsdHM6IEZpZ2h0UmVzdWx0W10gPSBbXTtcblxuICAgIGN1cnJlbnRGaWdodD86IEZpZ2h0O1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCByZWFsdGltZSA9IGZhbHNlLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICB0aGlzLnJhY2UgPSByYWNlO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuZXF1aXBtZW50ID0gZXF1aXBtZW50O1xuICAgICAgICB0aGlzLmJ1ZmZzID0gYnVmZnM7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gZmlnaHRMZW5ndGg7XG4gICAgICAgIHRoaXMucmVhbHRpbWUgPSByZWFsdGltZTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IHN0YXR1cygpIHtcbiAgICAgICAgbGV0IG5vcm1hbERhbWFnZSA9IDA7XG4gICAgICAgIGxldCBleGVjRGFtYWdlID0gMDtcbiAgICAgICAgbGV0IG5vcm1hbER1cmF0aW9uID0gMDtcbiAgICAgICAgbGV0IGV4ZWNEdXJhdGlvbiA9IDA7XG5cbiAgICAgICAgbGV0IHBvd2VyTG9zdCA9IDA7XG5cbiAgICAgICAgZm9yIChsZXQgZmlnaHRSZXN1bHQgb2YgdGhpcy5maWdodFJlc3VsdHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJlZ2luRXhlY3V0ZVRpbWUgPSBmaWdodFJlc3VsdC5maWdodExlbmd0aCAqICgxIC0gRVhFQ1VURV9QSEFTRV9SQVRJTyk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IFt0aW1lLCBkYW1hZ2VdIG9mIGZpZ2h0UmVzdWx0LmRhbWFnZUxvZykge1xuICAgICAgICAgICAgICAgIGlmICh0aW1lID49IGJlZ2luRXhlY3V0ZVRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhlY0RhbWFnZSArPSBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbm9ybWFsRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vcm1hbER1cmF0aW9uICs9IGJlZ2luRXhlY3V0ZVRpbWU7XG4gICAgICAgICAgICBleGVjRHVyYXRpb24gKz0gZmlnaHRSZXN1bHQuZmlnaHRMZW5ndGggLSBiZWdpbkV4ZWN1dGVUaW1lO1xuICAgICAgICAgICAgcG93ZXJMb3N0ICs9IGZpZ2h0UmVzdWx0LnBvd2VyTG9zdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlYWx0aW1lICYmIHRoaXMuY3VycmVudEZpZ2h0KSB7XG4gICAgICAgICAgICBjb25zdCBiZWdpbkV4ZWN1dGVUaW1lID0gdGhpcy5jdXJyZW50RmlnaHQuZmlnaHRMZW5ndGggKiAoMSAtIEVYRUNVVEVfUEhBU0VfUkFUSU8pO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBbdGltZSwgZGFtYWdlXSBvZiB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIuZGFtYWdlTG9nKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRpbWUgPj0gYmVnaW5FeGVjdXRlVGltZSkge1xuICAgICAgICAgICAgICAgICAgICBleGVjRGFtYWdlICs9IGRhbWFnZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBub3JtYWxEYW1hZ2UgKz0gZGFtYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9ybWFsRHVyYXRpb24gKz0gTWF0aC5taW4oYmVnaW5FeGVjdXRlVGltZSwgdGhpcy5jdXJyZW50RmlnaHQuZHVyYXRpb24pO1xuICAgICAgICAgICAgZXhlY0R1cmF0aW9uICs9IE1hdGgubWF4KDAsIHRoaXMuY3VycmVudEZpZ2h0LmR1cmF0aW9uIC0gYmVnaW5FeGVjdXRlVGltZSk7XG4gICAgICAgICAgICBwb3dlckxvc3QgKz0gdGhpcy5jdXJyZW50RmlnaHQucGxheWVyLnBvd2VyTG9zdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0b3RhbERhbWFnZTogbm9ybWFsRGFtYWdlICsgZXhlY0RhbWFnZSxcbiAgICAgICAgICAgIG5vcm1hbERhbWFnZTogbm9ybWFsRGFtYWdlLFxuICAgICAgICAgICAgZXhlY0RhbWFnZTogZXhlY0RhbWFnZSxcbiAgICAgICAgICAgIGR1cmF0aW9uOiBub3JtYWxEdXJhdGlvbiArIGV4ZWNEdXJhdGlvbixcbiAgICAgICAgICAgIG5vcm1hbER1cmF0aW9uOiBub3JtYWxEdXJhdGlvbixcbiAgICAgICAgICAgIGV4ZWNEdXJhdGlvbjogZXhlY0R1cmF0aW9uLFxuICAgICAgICAgICAgcG93ZXJMb3N0OiBwb3dlckxvc3QsXG4gICAgICAgICAgICBmaWdodHM6IHRoaXMuZmlnaHRSZXN1bHRzLmxlbmd0aCxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICBjb25zdCBmaWdodENsYXNzID0gdGhpcy5yZWFsdGltZSA/IFJlYWx0aW1lRmlnaHQgOiBGaWdodDtcblxuICAgICAgICBjb25zdCBvdXRlcmxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KG91dGVybG9vcCwgMTAwMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgY291bnQgPSAwO1xuXG4gICAgICAgICAgICBjb25zdCBpbm5lcmxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGNvdW50ID4gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0ID0gbmV3IGZpZ2h0Q2xhc3ModGhpcy5yYWNlLCB0aGlzLnN0YXRzLCB0aGlzLmVxdWlwbWVudCwgdGhpcy5idWZmcywgdGhpcy5jaG9vc2VBY3Rpb24sIHRoaXMuZmlnaHRMZW5ndGgsIHRoaXMucmVhbHRpbWUgPyB0aGlzLmxvZyA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQucnVuKCkudGhlbigocmVzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlnaHRSZXN1bHRzLnB1c2gocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgaW5uZXJsb29wKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCF0aGlzLnJlcXVlc3RTdG9wKSB7XG4gICAgICAgICAgICAgICAgaW5uZXJsb29wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgb3V0ZXJsb29wKCk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gIXRoaXMucGF1c2VkO1xuICAgICAgICBpZiAodGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0LnBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3RTdG9wID0gdHJ1ZTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2FycmlvclwiO1xuaW1wb3J0IHsgSXRlbVNsb3QgfSBmcm9tIFwiLi9pdGVtXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXJcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ2hvb3NlQWN0aW9uKGhlcm9pY1N0cmlrZVJhZ2VSZXE6IG51bWJlciwgaGFtc3RyaW5nUmFnZVJlcTogbnVtYmVyKSB7XG4gICAgcmV0dXJuIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyLCBmaWdodExlbmd0aDogbnVtYmVyLCBleGVjdXRlUGhhc2U6IGJvb2xlYW4pOiBudW1iZXJ8dW5kZWZpbmVkID0+IHtcbiAgICAgICAgY29uc3Qgd2FycmlvciA9IDxXYXJyaW9yPnBsYXllcjtcbiAgICBcbiAgICAgICAgY29uc3QgdGltZVJlbWFpbmluZ1NlY29uZHMgPSAoZmlnaHRMZW5ndGggLSB0aW1lKSAvIDEwMDA7XG4gICAgXG4gICAgICAgIGNvbnN0IHVzZUl0ZW1CeU5hbWUgPSAoc2xvdDogSXRlbVNsb3QsIG5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgY29uc3QgaXRlbSA9IHBsYXllci5pdGVtcy5nZXQoc2xvdCk7XG4gICAgICAgICAgICBpZiAoaXRlbSAmJiBpdGVtLml0ZW0ubmFtZSA9PT0gbmFtZSAmJiBpdGVtLm9udXNlICYmIGl0ZW0ub251c2UuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpdGVtLm9udXNlLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgaWYgKHdhcnJpb3IucmFnZSA8IDMwICYmIHdhcnJpb3IuYmxvb2RSYWdlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHdhcnJpb3IuYmxvb2RSYWdlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgbGV0IHdhaXRpbmdGb3JUaW1lOiBudW1iZXJ8dW5kZWZpbmVkO1xuICAgIFxuICAgICAgICAvLyBnY2Qgc3BlbGxzXG4gICAgICAgIGlmICh3YXJyaW9yLm5leHRHQ0RUaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgIGlmICh0aW1lUmVtYWluaW5nU2Vjb25kcyA8PSAzMCAmJiB3YXJyaW9yLmRlYXRoV2lzaC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5kZWF0aFdpc2guY2FzdCh0aW1lKTtcbiAgICAgICAgICAgICAgICB1c2VJdGVtQnlOYW1lKEl0ZW1TbG90LlRSSU5LRVQxLCBcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIpO1xuICAgICAgICAgICAgICAgIHVzZUl0ZW1CeU5hbWUoSXRlbVNsb3QuVFJJTktFVDIsIFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV4ZWN1dGVQaGFzZSAmJiB3YXJyaW9yLmV4ZWN1dGUuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3IuZXhlY3V0ZS5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmJsb29kdGhpcnN0LmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICAgICAgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QuY29vbGRvd24gPiB0aW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gd2Fycmlvci5ibG9vZHRoaXJzdC5jb29sZG93bjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLndoaXJsd2luZC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLndoaXJsd2luZC50aW1lUmVtYWluaW5nKHRpbWUpIDwgMS41ICsgKHdhcnJpb3IubGF0ZW5jeSAvIDEwMDApKSB7XG4gICAgICAgICAgICAgICAgLy8gbm90IG9yIGFsbW9zdCBvZmYgY29vbGRvd24sIHdhaXQgZm9yIHJhZ2Ugb3IgY29vbGRvd25cbiAgICAgICAgICAgICAgICBpZiAod2Fycmlvci53aGlybHdpbmQuY29vbGRvd24gPiB0aW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gd2Fycmlvci53aGlybHdpbmQuY29vbGRvd247XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLnJhZ2UgPj0gaGFtc3RyaW5nUmFnZVJlcSAmJiB3YXJyaW9yLmhhbXN0cmluZy5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5oYW1zdHJpbmcuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIFxuICAgICAgICBpZiAod2Fycmlvci5yYWdlID49IGhlcm9pY1N0cmlrZVJhZ2VSZXEgJiYgIXdhcnJpb3IucXVldWVkU3BlbGwpIHtcbiAgICAgICAgICAgIHdhcnJpb3IucXVldWVkU3BlbGwgPSB3YXJyaW9yLmhlcm9pY1N0cmlrZTtcbiAgICAgICAgICAgIGlmICh3YXJyaW9yLmxvZykgd2Fycmlvci5sb2codGltZSwgJ3F1ZXVlaW5nIGhlcm9pYyBzdHJpa2UnKTtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICByZXR1cm4gd2FpdGluZ0ZvclRpbWU7XG4gICAgfTtcbn1cbiIsImltcG9ydCB7ICBNYWluVGhyZWFkSW50ZXJmYWNlIH0gZnJvbSBcIi4vd29ya2VyX2V2ZW50X2ludGVyZmFjZS5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbiB9IGZyb20gXCIuL3NpbXVsYXRpb24uanNcIjtcbmltcG9ydCB7IFNpbXVsYXRpb25EZXNjcmlwdGlvbiwgYnVmZkluZGljZXNUb0J1ZmYsIGVxdWlwbWVudEluZGljZXNUb0l0ZW0gfSBmcm9tIFwiLi9zaW11bGF0aW9uX3V0aWxzLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgZ2VuZXJhdGVDaG9vc2VBY3Rpb24gfSBmcm9tIFwiLi93YXJyaW9yX2FpLmpzXCI7XG5cbmNvbnN0IG1haW5UaHJlYWRJbnRlcmZhY2UgPSBNYWluVGhyZWFkSW50ZXJmYWNlLmluc3RhbmNlO1xuXG5sZXQgY3VycmVudFNpbTogU2ltdWxhdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbm1haW5UaHJlYWRJbnRlcmZhY2UuYWRkRXZlbnRMaXN0ZW5lcignc2ltdWxhdGUnLCAoZGF0YTogYW55KSA9PiB7XG4gICAgY29uc3Qgc2ltZGVzYyA9IDxTaW11bGF0aW9uRGVzY3JpcHRpb24+ZGF0YTtcblxuICAgIGxldCBsb2dGdW5jdGlvbjogTG9nRnVuY3Rpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKHNpbWRlc2MucmVhbHRpbWUpIHtcbiAgICAgICAgbG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIG1haW5UaHJlYWRJbnRlcmZhY2Uuc2VuZCgnbG9nJywge1xuICAgICAgICAgICAgICAgIHRpbWU6IHRpbWUsXG4gICAgICAgICAgICAgICAgdGV4dDogdGV4dFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgY3VycmVudFNpbSA9IG5ldyBTaW11bGF0aW9uKHNpbWRlc2MucmFjZSwgc2ltZGVzYy5zdGF0cyxcbiAgICAgICAgZXF1aXBtZW50SW5kaWNlc1RvSXRlbShzaW1kZXNjLmVxdWlwbWVudCksXG4gICAgICAgIGJ1ZmZJbmRpY2VzVG9CdWZmKHNpbWRlc2MuYnVmZnMpLFxuICAgICAgICBnZW5lcmF0ZUNob29zZUFjdGlvbihzaW1kZXNjLmhlcm9pY1N0cmlrZVJhZ2VSZXEsIHNpbWRlc2MuaGFtc3RyaW5nUmFnZVJlcSksXG4gICAgICAgIHNpbWRlc2MuZmlnaHRMZW5ndGgsIHNpbWRlc2MucmVhbHRpbWUsIGxvZ0Z1bmN0aW9uKTtcblxuICAgIGN1cnJlbnRTaW0uc3RhcnQoKTtcblxuICAgIHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdzdGF0dXMnLCBjdXJyZW50U2ltIS5zdGF0dXMpO1xuICAgIH0sIDEwMDApO1xufSk7XG5cbm1haW5UaHJlYWRJbnRlcmZhY2UuYWRkRXZlbnRMaXN0ZW5lcigncGF1c2UnLCAoKSA9PiB7XG4gICAgaWYgKGN1cnJlbnRTaW0pIHtcbiAgICAgICAgY3VycmVudFNpbS5wYXVzZSgpO1xuICAgIH1cbn0pO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE1BQU0sb0JBQW9CO0lBR3RCLFlBQVksTUFBVztRQUZ2QixtQkFBYyxHQUF1QyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRzNELE1BQU0sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFPO1lBQ3ZCLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFL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QW9CZCxZQUFZLENBQWM7UUFDdEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNmO0lBRUQsR0FBRyxDQUFDLENBQWM7UUFDZCxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQztRQUNqQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsS0FBSyxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQztRQUUzQyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFD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
