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
    constructor(name, amount, type, is_gcd, cost, cooldown) {
        super(name, type, is_gcd, cost, cooldown, (player, time) => {
            const dmg = (typeof amount === "number") ? amount : amount(player);
            if (type === SpellType.PHYSICAL || type === SpellType.PHYSICAL_WEAPON) {
                player.dealMeleeDamage(time, dmg, player.target, true, this);
            }
        });
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
        this.damageDone = 0;
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
        if (tmp > 0 && roll < (sum += crit_chance)) {
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
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
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
        this.damageDone += damageDone;
        if (this.log) {
            let hitStr = `Your ${spell ? spell.name : (is_mh ? 'main-hand' : 'off-hand')} ${hitOutcomeString[hitOutcome]}`;
            if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                hitStr += ` for ${damageDone}`;
            }
            this.log(time, hitStr);
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
        this.buffManager.add(angerManagementOT, Math.random() * -3000);
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
    return 600 + (player.rage - 10);
}, SpellType.PHYSICAL_WEAPON, true, 10, 0);
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
                damageDone: this.player.damageDone,
                fightLength: this.fightLength,
                powerLost: this.player.powerLost
            });
        });
    }
    pause() { }
    cancel() { }
    update() {
        this.player.buffManager.update(this.duration);
        this.chooseAction(this.player, this.duration, this.fightLength);
        this.player.updateAttackingState(this.duration);
        const waitingForTime = this.chooseAction(this.player, this.duration, this.fightLength);
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
                        damageDone: this.player.damageDone,
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
        const combinedFightResults = this.fightResults.reduce((acc, current) => {
            return {
                damageDone: acc.damageDone + current.damageDone,
                fightLength: acc.fightLength + current.fightLength,
                powerLost: acc.powerLost + current.powerLost,
            };
        }, {
            damageDone: 0,
            fightLength: 0,
            powerLost: 0
        });
        if (this.realtime && this.currentFight) {
            combinedFightResults.damageDone += this.currentFight.player.damageDone;
            combinedFightResults.fightLength += this.currentFight.duration;
            combinedFightResults.powerLost += this.currentFight.player.powerLost;
        }
        return {
            damageDone: combinedFightResults.damageDone,
            duration: combinedFightResults.fightLength,
            fights: this.fightResults.length,
            powerLost: combinedFightResults.powerLost,
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
    return (player, time, fightLength) => {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3BlbGwudHMiLCIuLi9zcmMvaXRlbS50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL3NwZWxscy50cyIsIi4uL3NyYy9kYXRhL2l0ZW1zLnRzIiwiLi4vc3JjL3NpbXVsYXRpb25fdXRpbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbi50cyIsIi4uL3NyYy93YXJyaW9yX2FpLnRzIiwiLi4vc3JjL3J1bl9zaW11bGF0aW9uX3dvcmtlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFdvcmtlckV2ZW50TGlzdGVuZXIgPSAoZGF0YTogYW55KSA9PiB2b2lkO1xuXG5jbGFzcyBXb3JrZXJFdmVudEludGVyZmFjZSB7XG4gICAgZXZlbnRMaXN0ZW5lcnM6IE1hcDxzdHJpbmcsIFdvcmtlckV2ZW50TGlzdGVuZXJbXT4gPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3Rvcih0YXJnZXQ6IGFueSkge1xuICAgICAgICB0YXJnZXQub25tZXNzYWdlID0gKGV2OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldi5kYXRhLmV2ZW50KSB8fCBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcihldi5kYXRhLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IFdvcmtlckV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRMaXN0ZW5lcnMuaGFzKGV2ZW50KSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpIS5wdXNoKGxpc3RlbmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMuc2V0KGV2ZW50LCBbbGlzdGVuZXJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFdlYXBvbkRlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3BlbGwge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICB0eXBlOiBTcGVsbFR5cGU7XG4gICAgaXNfZ2NkOiBib29sZWFuO1xuICAgIGNvc3Q6IG51bWJlcjtcbiAgICBjb29sZG93bjogbnVtYmVyO1xuICAgIHByb3RlY3RlZCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB0eXBlOiBTcGVsbFR5cGUsIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyLCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuY29zdCA9IGNvc3Q7XG4gICAgICAgIHRoaXMuY29vbGRvd24gPSBjb29sZG93bjtcbiAgICAgICAgdGhpcy5pc19nY2QgPSBpc19nY2Q7XG4gICAgICAgIHRoaXMuc3BlbGxGID0gc3BlbGxGO1xuICAgIH1cblxuICAgIGNhc3QocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gdGhpcy5zcGVsbEYocGxheWVyLCB0aW1lKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3BlbGwge1xuICAgIHNwZWxsOiBTcGVsbDtcbiAgICBjb29sZG93biA9IDA7XG4gICAgY2FzdGVyOiBQbGF5ZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuc3BlbGwgPSBzcGVsbDtcbiAgICAgICAgdGhpcy5jYXN0ZXIgPSBjYXN0ZXI7XG4gICAgfVxuXG4gICAgb25Db29sZG93bih0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29vbGRvd24gPiB0aW1lO1xuICAgIH1cblxuICAgIHRpbWVSZW1haW5pbmcodGltZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCAodGhpcy5jb29sZG93biAtIHRpbWUpIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgY2FuQ2FzdCh0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkICYmIHRoaXMuY2FzdGVyLm5leHRHQ0RUaW1lID4gdGltZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuY29zdCA+IHRoaXMuY2FzdGVyLnBvd2VyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vbkNvb2xkb3duKHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjYXN0KHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkKSB7XG4gICAgICAgICAgICB0aGlzLmNhc3Rlci5uZXh0R0NEVGltZSA9IHRpbWUgKyAxNTAwICsgdGhpcy5jYXN0ZXIubGF0ZW5jeTsgLy8gVE9ETyAtIG5lZWQgdG8gc3R1ZHkgdGhlIGVmZmVjdHMgb2YgbGF0ZW5jeSBpbiB0aGUgZ2FtZSBhbmQgY29uc2lkZXIgaHVtYW4gcHJlY2lzaW9uXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuY2FzdGVyLnBvd2VyIC09IHRoaXMuc3BlbGwuY29zdDtcblxuICAgICAgICB0aGlzLnNwZWxsLmNhc3QodGhpcy5jYXN0ZXIsIHRpbWUpO1xuXG4gICAgICAgIHRoaXMuY29vbGRvd24gPSB0aW1lICsgdGhpcy5zcGVsbC5jb29sZG93biAqIDEwMDAgKyB0aGlzLmNhc3Rlci5sYXRlbmN5O1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aW5nU3BlbGwgZXh0ZW5kcyBTcGVsbCB7XG4gICAgYm9udXNEYW1hZ2U6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgYm9udXNEYW1hZ2U6IG51bWJlciwgY29zdDogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIGZhbHNlLCBjb3N0LCAwLCAoKSA9PiB7fSk7XG4gICAgICAgIHRoaXMuYm9udXNEYW1hZ2UgPSBib251c0RhbWFnZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3dpbmdTcGVsbCBleHRlbmRzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFN3aW5nU3BlbGw7XG4gICAgXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFN3aW5nU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyKHNwZWxsLCBjYXN0ZXIpO1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7IC8vIFRPRE8gLSBpcyB0aGVyZSBhIHdheSB0byBhdm9pZCB0aGlzIGxpbmU/XG4gICAgfVxufVxuXG5leHBvcnQgZW51bSBTcGVsbFR5cGUge1xuICAgIE5PTkUsXG4gICAgQlVGRixcbiAgICBQSFlTSUNBTCxcbiAgICBQSFlTSUNBTF9XRUFQT04sXG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsIHtcbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSwgaXNfZ2NkOiBib29sZWFuLCBjb3N0OiBudW1iZXIsIGNvb2xkb3duOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgdHlwZSwgaXNfZ2NkLCBjb3N0LCBjb29sZG93biwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRtZyA9ICh0eXBlb2YgYW1vdW50ID09PSBcIm51bWJlclwiKSA/IGFtb3VudCA6IGFtb3VudChwbGF5ZXIpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gU3BlbGxUeXBlLlBIWVNJQ0FMIHx8IHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPIC0gZG8gcHJvY3MgbGlrZSBmYXRhbCB3b3VuZHMgKHZpcydrYWcpIGFjY291bnQgZm9yIHdlYXBvbiBza2lsbD9cbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZTIgZXh0ZW5kcyBTcGVsbERhbWFnZSB7XG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlciwgdHlwZTogU3BlbGxUeXBlKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGFtb3VudCwgdHlwZSwgZmFsc2UsIDAsIDApO1xuICAgIH1cbn1cblxuY29uc3QgZmF0YWxXb3VuZHMgPSBuZXcgU3BlbGxEYW1hZ2UyKFwiRmF0YWwgV291bmRzXCIsIDI0MCwgU3BlbGxUeXBlLlBIWVNJQ0FMKTtcblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikge1xuICAgICAgICAvLyBzcGVsbHR5cGUgZG9lc24ndCBtYXR0ZXJcbiAgICAgICAgc3VwZXIobmFtZSwgU3BlbGxUeXBlLk5PTkUsIGZhbHNlLCAwLCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGxheWVyLmV4dHJhQXR0YWNrQ291bnQgKz0gY291bnQ7IC8vIExIIGNvZGUgZG9lcyBub3QgYWxsb3cgbXVsdGlwbGUgYXV0byBhdHRhY2tzIHRvIHN0YWNrIGlmIHRoZXkgcHJvYyB0b2dldGhlci4gQmxpenpsaWtlIG1heSBhbGxvdyB0aGVtIHRvIHN0YWNrIFxuICAgICAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYEdhaW5lZCAke2NvdW50fSBleHRyYSBhdHRhY2tzIGZyb20gJHtuYW1lfWApO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbEJ1ZmYgZXh0ZW5kcyBTcGVsbCB7XG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgaXNfZ2NkPzogYm9vbGVhbiwgY29zdD86IG51bWJlciwgY29vbGRvd24/OiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoYFNwZWxsQnVmZigke2J1ZmYubmFtZX0pYCwgU3BlbGxUeXBlLkJVRkYsICEhaXNfZ2NkLCBjb3N0IHx8IDAsIGNvb2xkb3duIHx8IDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJ1ZmYsIHRpbWUpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbnR5cGUgcHBtID0ge3BwbTogbnVtYmVyfTtcbnR5cGUgY2hhbmNlID0ge2NoYW5jZTogbnVtYmVyfTtcbnR5cGUgcmF0ZSA9IHBwbSB8IGNoYW5jZTtcblxuZXhwb3J0IGNsYXNzIFByb2Mge1xuICAgIHByb3RlY3RlZCBzcGVsbHM6IFNwZWxsW107XG4gICAgcHJvdGVjdGVkIHJhdGU6IHJhdGU7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwgfCBTcGVsbFtdLCByYXRlOiByYXRlKSB7XG4gICAgICAgIHRoaXMuc3BlbGxzID0gQXJyYXkuaXNBcnJheShzcGVsbCkgPyBzcGVsbCA6IFtzcGVsbF07XG4gICAgICAgIHRoaXMucmF0ZSA9IHJhdGU7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2hhbmNlID0gKDxjaGFuY2U+dGhpcy5yYXRlKS5jaGFuY2UgfHwgKDxwcG0+dGhpcy5yYXRlKS5wcG0gKiB3ZWFwb24uc3BlZWQgLyA2MDtcblxuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8PSBjaGFuY2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IHNwZWxsIG9mIHRoaXMuc3BlbGxzKSB7XG4gICAgICAgICAgICAgICAgc3BlbGwuY2FzdChwbGF5ZXIsIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFByb2MsIFNwZWxsLCBMZWFybmVkU3BlbGwgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgZW51bSBJdGVtU2xvdCB7XG4gICAgTUFJTkhBTkQgPSAxIDw8IDAsXG4gICAgT0ZGSEFORCA9IDEgPDwgMSxcbiAgICBUUklOS0VUMSA9IDEgPDwgMixcbiAgICBUUklOS0VUMiA9IDEgPDwgMyxcbiAgICBIRUFEID0gMSA8PCA0LFxuICAgIE5FQ0sgPSAxIDw8IDUsXG4gICAgU0hPVUxERVIgPSAxIDw8IDYsXG4gICAgQkFDSyA9IDEgPDwgNyxcbiAgICBDSEVTVCA9IDEgPDwgOCxcbiAgICBXUklTVCA9IDEgPDwgOSxcbiAgICBIQU5EUyA9IDEgPDwgMTAsXG4gICAgV0FJU1QgPSAxIDw8IDExLFxuICAgIExFR1MgPSAxIDw8IDEyLFxuICAgIEZFRVQgPSAxIDw8IDEzLFxuICAgIFJJTkcxID0gMSA8PCAxNCxcbiAgICBSSU5HMiA9IDEgPDwgMTUsXG4gICAgUkFOR0VEID0gMSA8PCAxNixcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJdGVtRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzbG90OiBJdGVtU2xvdCxcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG4gICAgb251c2U/OiBTcGVsbCxcbiAgICBvbmVxdWlwPzogUHJvYyxcbn1cblxuZXhwb3J0IGVudW0gV2VhcG9uVHlwZSB7XG4gICAgTUFDRSxcbiAgICBTV09SRCxcbiAgICBBWEUsXG4gICAgREFHR0VSLFxuICAgIE1BQ0UySCxcbiAgICBTV09SRDJILFxuICAgIEFYRTJILFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFdlYXBvbkRlc2NyaXB0aW9uIGV4dGVuZHMgSXRlbURlc2NyaXB0aW9uIHtcbiAgICB0eXBlOiBXZWFwb25UeXBlLFxuICAgIG1pbjogbnVtYmVyLFxuICAgIG1heDogbnVtYmVyLFxuICAgIHNwZWVkOiBudW1iZXIsXG4gICAgb25oaXQ/OiBQcm9jLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNXZWFwb24oaXRlbTogSXRlbURlc2NyaXB0aW9uKTogaXRlbSBpcyBXZWFwb25EZXNjcmlwdGlvbiB7XG4gICAgcmV0dXJuIFwic3BlZWRcIiBpbiBpdGVtO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFcXVpcGVkV2VhcG9uKGl0ZW06IEl0ZW1FcXVpcGVkKTogaXRlbSBpcyBXZWFwb25FcXVpcGVkIHtcbiAgICByZXR1cm4gXCJ3ZWFwb25cIiBpbiBpdGVtO1xufVxuXG5leHBvcnQgY2xhc3MgSXRlbUVxdWlwZWQge1xuICAgIGl0ZW06IEl0ZW1EZXNjcmlwdGlvbjtcbiAgICBvbnVzZT86IExlYXJuZWRTcGVsbDtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5pdGVtID0gaXRlbTtcblxuICAgICAgICBpZiAoaXRlbS5vbnVzZSkge1xuICAgICAgICAgICAgdGhpcy5vbnVzZSA9IG5ldyBMZWFybmVkU3BlbGwoaXRlbS5vbnVzZSwgcGxheWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLm9uZXF1aXApIHsgLy8gVE9ETywgbW92ZSB0aGlzIHRvIGJ1ZmZwcm9jPyB0aGlzIG1heSBiZSBzaW1wbGVyIHRob3VnaCBzaW5jZSB3ZSBrbm93IHRoZSBidWZmIHdvbid0IGJlIHJlbW92ZWRcbiAgICAgICAgICAgIHBsYXllci5hZGRQcm9jKGl0ZW0ub25lcXVpcCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1c2UodGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aGlzLm9udXNlKSB7XG4gICAgICAgICAgICB0aGlzLm9udXNlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wb3JhcnlXZWFwb25FbmNoYW50IHtcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXM7XG4gICAgcHJvYz86IFByb2M7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0cz86IFN0YXRWYWx1ZXMsIHByb2M/OiBQcm9jKSB7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5wcm9jID0gcHJvYztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXZWFwb25FcXVpcGVkIGV4dGVuZHMgSXRlbUVxdWlwZWQge1xuICAgIHdlYXBvbjogV2VhcG9uRGVzY3JpcHRpb247XG4gICAgbmV4dFN3aW5nVGltZTogbnVtYmVyO1xuICAgIHByb2NzOiBQcm9jW10gPSBbXTtcbiAgICBwbGF5ZXI6IFBsYXllcjtcbiAgICB0ZW1wb3JhcnlFbmNoYW50PzogVGVtcG9yYXJ5V2VhcG9uRW5jaGFudDtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IFdlYXBvbkRlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlcihpdGVtLCBwbGF5ZXIpO1xuICAgICAgICB0aGlzLndlYXBvbiA9IGl0ZW07XG4gICAgICAgIFxuICAgICAgICBpZiAoaXRlbS5vbmhpdCkge1xuICAgICAgICAgICAgdGhpcy5hZGRQcm9jKGl0ZW0ub25oaXQpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcblxuICAgICAgICB0aGlzLm5leHRTd2luZ1RpbWUgPSAxMDA7IC8vIFRPRE8gLSBuZWVkIHRvIHJlc2V0IHRoaXMgcHJvcGVybHkgaWYgZXZlciB3YW50IHRvIHNpbXVsYXRlIGZpZ2h0cyB3aGVyZSB5b3UgcnVuIG91dFxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0IHBsdXNEYW1hZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnRlbXBvcmFyeUVuY2hhbnQgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5wbHVzRGFtYWdlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLnBsdXNEYW1hZ2VcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2VhcG9uLm1pbiArIHRoaXMucGx1c0RhbWFnZTtcbiAgICB9XG5cbiAgICBnZXQgbWF4KCkge1xuICAgICAgICByZXR1cm4gdGhpcy53ZWFwb24ubWF4ICsgdGhpcy5wbHVzRGFtYWdlO1xuICAgIH1cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcHJvYyh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgcHJvYyBvZiB0aGlzLnByb2NzKSB7XG4gICAgICAgICAgICBwcm9jLnJ1bih0aGlzLnBsYXllciwgdGhpcy53ZWFwb24sIHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2luZGZ1cnkgcHJvY3MgbGFzdFxuICAgICAgICBpZiAodGhpcy50ZW1wb3JhcnlFbmNoYW50ICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5wcm9jKSB7XG4gICAgICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnQucHJvYy5ydW4odGhpcy5wbGF5ZXIsIHRoaXMud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiB1cmFuZChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbWluICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZnJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wKHZhbDogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heChtaW4sIHZhbCkpO1xufVxuXG5jb25zdCBERUJVR0dJTkcgPSBmYWxzZTtcblxuaWYgKERFQlVHR0lORykge1xuICAgIC8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL21hdGhpYXNieW5lbnMvNTY3MDkxNyNmaWxlLWRldGVybWluaXN0aWMtbWF0aC1yYW5kb20tanNcbiAgICBNYXRoLnJhbmRvbSA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlZWQgPSAweDJGNkUyQjE7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vIFJvYmVydCBKZW5raW5z4oCZIDMyIGJpdCBpbnRlZ2VyIGhhc2ggZnVuY3Rpb25cbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDdFRDU1RDE2KSArIChzZWVkIDw8IDEyKSkgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEM3NjFDMjNDKSBeIChzZWVkID4+PiAxOSkpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDE2NTY2N0IxKSArIChzZWVkIDw8IDUpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEQzQTI2NDZDKSBeIChzZWVkIDw8IDkpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEZENzA0NkM1KSArIChzZWVkIDw8IDMpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEI1NUE0RjA5KSBeIChzZWVkID4+PiAxNikpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHJldHVybiAoc2VlZCAmIDB4RkZGRkZGRikgLyAweDEwMDAwMDAwO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG59XG4iLCJpbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgVW5pdCB7XG4gICAgbGV2ZWw6IG51bWJlcjtcbiAgICBhcm1vcjogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IobGV2ZWw6IG51bWJlciwgYXJtb3I6IG51bWJlcikge1xuICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgIHRoaXMuYXJtb3IgPSBhcm1vcjtcbiAgICB9XG5cbiAgICBnZXQgbWF4U2tpbGxGb3JMZXZlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiA1O1xuICAgIH1cblxuICAgIGdldCBkZWZlbnNlU2tpbGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgfVxuXG4gICAgZ2V0IGRvZGdlQ2hhbmNlKCkge1xuICAgICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVBcm1vclJlZHVjZWREYW1hZ2UoZGFtYWdlOiBudW1iZXIsIGF0dGFja2VyOiBQbGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYXJtb3IgPSBNYXRoLm1heCgwLCB0aGlzLmFybW9yIC0gYXR0YWNrZXIuYnVmZk1hbmFnZXIuc3RhdHMuYXJtb3JQZW5ldHJhdGlvbik7XG4gICAgICAgIFxuICAgICAgICBsZXQgdG1wdmFsdWUgPSAwLjEgKiBhcm1vciAgLyAoKDguNSAqIGF0dGFja2VyLmxldmVsKSArIDQwKTtcbiAgICAgICAgdG1wdmFsdWUgLz0gKDEgKyB0bXB2YWx1ZSk7XG5cbiAgICAgICAgY29uc3QgYXJtb3JNb2RpZmllciA9IGNsYW1wKHRtcHZhbHVlLCAwLCAwLjc1KTtcblxuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMSwgZGFtYWdlIC0gKGRhbWFnZSAqIGFybW9yTW9kaWZpZXIpKTtcbiAgICB9XG59XG4iLCJleHBvcnQgaW50ZXJmYWNlIFN0YXRWYWx1ZXMge1xuICAgIGFwPzogbnVtYmVyO1xuICAgIHN0cj86IG51bWJlcjtcbiAgICBhZ2k/OiBudW1iZXI7XG4gICAgaGl0PzogbnVtYmVyO1xuICAgIGNyaXQ/OiBudW1iZXI7XG4gICAgaGFzdGU/OiBudW1iZXI7XG4gICAgc3RhdE11bHQ/OiBudW1iZXI7XG4gICAgZGFtYWdlTXVsdD86IG51bWJlcjtcbiAgICBhcm1vclBlbmV0cmF0aW9uPzogbnVtYmVyO1xuICAgIHBsdXNEYW1hZ2U/OiBudW1iZXI7XG5cbiAgICBzd29yZFNraWxsPzogbnVtYmVyO1xuICAgIGF4ZVNraWxsPzogbnVtYmVyO1xuICAgIG1hY2VTa2lsbD86IG51bWJlcjtcbiAgICBkYWdnZXJTa2lsbD86IG51bWJlcjtcbiAgICBzd29yZDJIU2tpbGw/OiBudW1iZXI7XG4gICAgYXhlMkhTa2lsbD86IG51bWJlcjtcbiAgICBtYWNlMkhTa2lsbD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFN0YXRzIGltcGxlbWVudHMgU3RhdFZhbHVlcyB7XG4gICAgYXAhOiBudW1iZXI7XG4gICAgc3RyITogbnVtYmVyO1xuICAgIGFnaSE6IG51bWJlcjtcbiAgICBoaXQhOiBudW1iZXI7XG4gICAgY3JpdCE6IG51bWJlcjtcbiAgICBoYXN0ZSE6IG51bWJlcjtcbiAgICBzdGF0TXVsdCE6IG51bWJlcjtcbiAgICBkYW1hZ2VNdWx0ITogbnVtYmVyO1xuICAgIGFybW9yUGVuZXRyYXRpb24hOiBudW1iZXI7XG4gICAgcGx1c0RhbWFnZSE6IG51bWJlcjtcblxuICAgIHN3b3JkU2tpbGwhOiBudW1iZXI7XG4gICAgYXhlU2tpbGwhOiBudW1iZXI7XG4gICAgbWFjZVNraWxsITogbnVtYmVyO1xuICAgIGRhZ2dlclNraWxsITogbnVtYmVyO1xuICAgIHN3b3JkMkhTa2lsbCE6IG51bWJlcjtcbiAgICBheGUySFNraWxsITogbnVtYmVyO1xuICAgIG1hY2UySFNraWxsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3Iocz86IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5zZXQocyk7XG4gICAgfVxuXG4gICAgc2V0KHM/OiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuYXAgPSAocyAmJiBzLmFwKSB8fCAwO1xuICAgICAgICB0aGlzLnN0ciA9IChzICYmIHMuc3RyKSB8fCAwO1xuICAgICAgICB0aGlzLmFnaSA9IChzICYmIHMuYWdpKSB8fCAwO1xuICAgICAgICB0aGlzLmhpdCA9IChzICYmIHMuaGl0KSB8fCAwO1xuICAgICAgICB0aGlzLmNyaXQgPSAocyAmJiBzLmNyaXQpIHx8IDA7XG4gICAgICAgIHRoaXMuaGFzdGUgPSAocyAmJiBzLmhhc3RlKSB8fCAxO1xuICAgICAgICB0aGlzLnN0YXRNdWx0ID0gKHMgJiYgcy5zdGF0TXVsdCkgfHwgMTtcbiAgICAgICAgdGhpcy5kYW1hZ2VNdWx0ID0gKHMgJiYgcy5kYW1hZ2VNdWx0KSB8fCAxO1xuICAgICAgICB0aGlzLmFybW9yUGVuZXRyYXRpb24gPSAocyAmJiBzLmFybW9yUGVuZXRyYXRpb24pIHx8IDA7XG4gICAgICAgIHRoaXMucGx1c0RhbWFnZSA9IChzICYmIHMucGx1c0RhbWFnZSkgfHwgMDtcblxuICAgICAgICB0aGlzLnN3b3JkU2tpbGwgPSAocyAmJiBzLnN3b3JkU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuYXhlU2tpbGwgPSAocyAmJiBzLmF4ZVNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLm1hY2VTa2lsbCA9IChzICYmIHMubWFjZVNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmRhZ2dlclNraWxsID0gKHMgJiYgcy5kYWdnZXJTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5zd29yZDJIU2tpbGwgPSAocyAmJiBzLnN3b3JkMkhTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5heGUySFNraWxsID0gKHMgJiYgcy5heGUySFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLm1hY2UySFNraWxsID0gKHMgJiYgcy5tYWNlMkhTa2lsbCkgfHwgMDtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBhZGQoczogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLmFwICs9IChzLmFwIHx8IDApO1xuICAgICAgICB0aGlzLnN0ciArPSAocy5zdHIgfHwgMCk7XG4gICAgICAgIHRoaXMuYWdpICs9IChzLmFnaSB8fCAwKTtcbiAgICAgICAgdGhpcy5oaXQgKz0gKHMuaGl0IHx8IDApO1xuICAgICAgICB0aGlzLmNyaXQgKz0gKHMuY3JpdCB8fCAwKTtcbiAgICAgICAgdGhpcy5oYXN0ZSAqPSAocy5oYXN0ZSB8fCAxKTtcbiAgICAgICAgdGhpcy5zdGF0TXVsdCAqPSAocy5zdGF0TXVsdCB8fCAxKTtcbiAgICAgICAgdGhpcy5kYW1hZ2VNdWx0ICo9IChzLmRhbWFnZU11bHQgfHwgMSk7XG4gICAgICAgIHRoaXMuYXJtb3JQZW5ldHJhdGlvbiArPSAocy5hcm1vclBlbmV0cmF0aW9uIHx8IDApO1xuICAgICAgICB0aGlzLnBsdXNEYW1hZ2UgKz0gKHMucGx1c0RhbWFnZSB8fCAwKTtcblxuICAgICAgICB0aGlzLnN3b3JkU2tpbGwgKz0gKHMuc3dvcmRTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5heGVTa2lsbCArPSAocy5heGVTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5tYWNlU2tpbGwgKz0gKHMubWFjZVNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmRhZ2dlclNraWxsICs9IChzLmRhZ2dlclNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLnN3b3JkMkhTa2lsbCArPSAocy5zd29yZDJIU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuYXhlMkhTa2lsbCArPSAocy5heGUySFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLm1hY2UySFNraWxsICs9IChzLm1hY2UySFNraWxsIHx8IDApO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFN0YXRzLCBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgUHJvYyB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBCdWZmTWFuYWdlciB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG5cbiAgICBwcml2YXRlIGJ1ZmZMaXN0OiBCdWZmQXBwbGljYXRpb25bXSA9IFtdO1xuICAgIHByaXZhdGUgYnVmZk92ZXJUaW1lTGlzdDogQnVmZk92ZXJUaW1lQXBwbGljYXRpb25bXSA9IFtdO1xuXG4gICAgYmFzZVN0YXRzOiBTdGF0cztcbiAgICBzdGF0czogU3RhdHM7XG5cbiAgICBjb25zdHJ1Y3RvcihwbGF5ZXI6IFBsYXllciwgYmFzZVN0YXRzOiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLmJhc2VTdGF0cyA9IG5ldyBTdGF0cyhiYXNlU3RhdHMpO1xuICAgICAgICB0aGlzLnN0YXRzID0gbmV3IFN0YXRzKHRoaXMuYmFzZVN0YXRzKTtcbiAgICB9XG5cbiAgICBnZXQgbmV4dE92ZXJUaW1lVXBkYXRlKCkge1xuICAgICAgICBsZXQgcmVzID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cbiAgICAgICAgZm9yIChsZXQgYnVmZk9UQXBwIG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgcmVzID0gTWF0aC5taW4ocmVzLCBidWZmT1RBcHAubmV4dFVwZGF0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgLy8gcHJvY2VzcyBsYXN0IHRpY2sgYmVmb3JlIGl0IGlzIHJlbW92ZWRcbiAgICAgICAgZm9yIChsZXQgYnVmZk9UQXBwIG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgYnVmZk9UQXBwLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWUpO1xuXG4gICAgICAgIHRoaXMuc3RhdHMuc2V0KHRoaXMuYmFzZVN0YXRzKTtcblxuICAgICAgICBmb3IgKGxldCB7IGJ1ZmYsIHN0YWNrcyB9IG9mIHRoaXMuYnVmZkxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCB7IGJ1ZmYsIHN0YWNrcyB9IG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgc3RhY2tzID0gYnVmZi5zdGF0c1N0YWNrID8gc3RhY2tzIDogMTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2tzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBidWZmLmFwcGx5KHRoaXMuc3RhdHMsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZChidWZmOiBCdWZmLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCBidWZmQXBwIG9mIHRoaXMuYnVmZkxpc3QpIHtcbiAgICAgICAgICAgIGlmIChidWZmQXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHsgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9nU3RhY2tJbmNyZWFzZSA9IHRoaXMucGxheWVyLmxvZyAmJiAoIWJ1ZmYubWF4U3RhY2tzIHx8IGJ1ZmZBcHAuc3RhY2tzIDwgYnVmZi5tYXhTdGFja3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmLmluaXRpYWxTdGFja3MpIHsgLy8gVE9ETyAtIGNoYW5nZSB0aGlzIHRvIGNoYXJnZXM/XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAuc3RhY2tzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAobG9nU3RhY2tJbmNyZWFzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5ZXIubG9nIShhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gcmVmcmVzaGVkICgke2J1ZmZBcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyhhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gcmVmcmVzaGVkYCk7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAucmVmcmVzaChhcHBseVRpbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IGdhaW5lZGAgKyAoYnVmZi5zdGFja3MgPyBgICgke2J1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxfSlgIDogJycpKTtcblxuICAgICAgICBpZiAoYnVmZiBpbnN0YW5jZW9mIEJ1ZmZPdmVyVGltZSkge1xuICAgICAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0LnB1c2gobmV3IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uKHRoaXMucGxheWVyLCBidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZkxpc3QucHVzaChuZXcgQnVmZkFwcGxpY2F0aW9uKGJ1ZmYsIGFwcGx5VGltZSkpO1xuICAgICAgICB9XG4gICAgICAgIGJ1ZmYuYWRkKGFwcGx5VGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgIH1cblxuICAgIHJlbW92ZShidWZmOiBCdWZmLCB0aW1lOiBudW1iZXIsIGZ1bGwgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZ1bGwgJiYgYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuYnVmZiA9PT0gYnVmZikge1xuICAgICAgICAgICAgICAgIGlmIChidWZmLnN0YWNrcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmYXBwLnN0YWNrcyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSAoJHtidWZmYXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmYXBwLnN0YWNrcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gbG9zdGApO1xuICAgICAgICAgICAgICAgIGJ1ZmZhcHAuYnVmZi5yZW1vdmUodGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZW1vdmVFeHBpcmVkQnVmZnModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHJlbW92ZWRCdWZmczogQnVmZltdID0gW107XG4gICAgICAgIFxuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmV4cGlyYXRpb25UaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVkQnVmZnMucHVzaChidWZmYXBwLmJ1ZmYpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QgPSB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yIChsZXQgYnVmZiBvZiByZW1vdmVkQnVmZnMpIHtcbiAgICAgICAgICAgIGJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGV4cGlyZWRgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmYge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXN8dW5kZWZpbmVkO1xuICAgIHN0YWNrczogYm9vbGVhbjtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGluaXRpYWxTdGFja3M/OiBudW1iZXI7XG4gICAgbWF4U3RhY2tzPzogbnVtYmVyO1xuICAgIHN0YXRzU3RhY2s6IGJvb2xlYW47IC8vIGRvIHlvdSBhZGQgdGhlIHN0YXQgYm9udXMgZm9yIGVhY2ggc3RhY2s/IG9yIGlzIGl0IGxpa2UgZmx1cnJ5IHdoZXJlIHRoZSBzdGFjayBpcyBvbmx5IHRvIGNvdW50IGNoYXJnZXNcblxuICAgIHByaXZhdGUgY2hpbGQ/OiBCdWZmO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0cz86IFN0YXRWYWx1ZXMsIHN0YWNrcz86IGJvb2xlYW4sIGluaXRpYWxTdGFja3M/OiBudW1iZXIsIG1heFN0YWNrcz86IG51bWJlciwgY2hpbGQ/OiBCdWZmLCBzdGF0c1N0YWNrID0gdHJ1ZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5zdGFja3MgPSAhIXN0YWNrcztcbiAgICAgICAgdGhpcy5pbml0aWFsU3RhY2tzID0gaW5pdGlhbFN0YWNrcztcbiAgICAgICAgdGhpcy5tYXhTdGFja3MgPSBtYXhTdGFja3M7XG4gICAgICAgIHRoaXMuY2hpbGQgPSBjaGlsZDtcbiAgICAgICAgdGhpcy5zdGF0c1N0YWNrID0gc3RhdHNTdGFjaztcbiAgICB9XG5cbiAgICBhcHBseShzdGF0czogU3RhdHMsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLnN0YXRzKSB7XG4gICAgICAgICAgICBzdGF0cy5hZGQodGhpcy5zdGF0cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge31cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLmNoaWxkKSB7XG4gICAgICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIucmVtb3ZlKHRoaXMuY2hpbGQsIHRpbWUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmY7XG4gICAgZXhwaXJhdGlvblRpbWUhOiBudW1iZXI7XG5cbiAgICBzdGFja3NWYWwhOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihidWZmOiBCdWZmLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLmJ1ZmYgPSBidWZmO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLnN0YWNrcyA9IHRoaXMuYnVmZi5pbml0aWFsU3RhY2tzIHx8IDE7XG5cbiAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IHRpbWUgKyB0aGlzLmJ1ZmYuZHVyYXRpb24gKiAxMDAwO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1ZmYuZHVyYXRpb24gPiA2MCkge1xuICAgICAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHN0YWNrcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhY2tzVmFsO1xuICAgIH1cblxuICAgIHNldCBzdGFja3Moc3RhY2tzOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3NWYWwgPSB0aGlzLmJ1ZmYubWF4U3RhY2tzID8gTWF0aC5taW4odGhpcy5idWZmLm1heFN0YWNrcywgc3RhY2tzKSA6IHN0YWNrcztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmT3ZlclRpbWUgZXh0ZW5kcyBCdWZmIHtcbiAgICB1cGRhdGVGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZDtcbiAgICB1cGRhdGVJbnRlcnZhbDogbnVtYmVyXG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHN0YXRzOiBTdGF0VmFsdWVzfHVuZGVmaW5lZCwgdXBkYXRlSW50ZXJ2YWw6IG51bWJlciwgdXBkYXRlRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHN0YXRzKTtcbiAgICAgICAgdGhpcy51cGRhdGVGID0gdXBkYXRlRjtcbiAgICAgICAgdGhpcy51cGRhdGVJbnRlcnZhbCA9IHVwZGF0ZUludGVydmFsO1xuICAgIH1cbn1cblxuY2xhc3MgQnVmZk92ZXJUaW1lQXBwbGljYXRpb24gZXh0ZW5kcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmZPdmVyVGltZTtcbiAgICBuZXh0VXBkYXRlITogbnVtYmVyO1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJ1ZmY6IEJ1ZmZPdmVyVGltZSwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoYnVmZiwgYXBwbHlUaW1lKTtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMucmVmcmVzaChhcHBseVRpbWUpO1xuICAgIH1cblxuICAgIHJlZnJlc2godGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyLnJlZnJlc2godGltZSk7XG4gICAgICAgIHRoaXMubmV4dFVwZGF0ZSA9IHRpbWUgKyB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgfVxuXG4gICAgdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGltZSA+PSB0aGlzLm5leHRVcGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMubmV4dFVwZGF0ZSArPSB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgICAgICAgICB0aGlzLmJ1ZmYudXBkYXRlRih0aGlzLnBsYXllciwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmUHJvYyBleHRlbmRzIEJ1ZmYge1xuICAgIHByb2M6IFByb2M7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHByb2M6IFByb2MsIGNoaWxkPzogQnVmZikge1xuICAgICAgICBzdXBlcihuYW1lLCBkdXJhdGlvbiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjaGlsZCk7XG4gICAgICAgIHRoaXMucHJvYyA9IHByb2M7XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIuYWRkKHRpbWUsIHBsYXllcik7XG4gICAgICAgIHBsYXllci5hZGRQcm9jKHRoaXMucHJvYyk7XG4gICAgfVxuXG4gICAgcmVtb3ZlKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIucmVtb3ZlKHRpbWUsIHBsYXllcik7XG4gICAgICAgIHBsYXllci5yZW1vdmVQcm9jKHRoaXMucHJvYyk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgV2VhcG9uRXF1aXBlZCwgV2VhcG9uVHlwZSwgSXRlbURlc2NyaXB0aW9uLCBJdGVtRXF1aXBlZCwgSXRlbVNsb3QsIGlzRXF1aXBlZFdlYXBvbiwgaXNXZWFwb24gfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgdXJhbmQsIGNsYW1wLCBmcmFuZCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IEJ1ZmZNYW5hZ2VyIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgU3BlbGwsIFByb2MsIExlYXJuZWRTd2luZ1NwZWxsLCBTcGVsbFR5cGUgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgZW51bSBSYWNlIHtcbiAgICBIVU1BTixcbiAgICBPUkMsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBQbGF5ZXIgZXh0ZW5kcyBVbml0IHtcbiAgICBpdGVtczogTWFwPEl0ZW1TbG90LCBJdGVtRXF1aXBlZD4gPSBuZXcgTWFwKCk7XG4gICAgcHJvY3M6IFByb2NbXSA9IFtdO1xuXG4gICAgdGFyZ2V0OiBVbml0IHwgdW5kZWZpbmVkO1xuXG4gICAgbmV4dEdDRFRpbWUgPSAwO1xuICAgIGV4dHJhQXR0YWNrQ291bnQgPSAwO1xuICAgIGRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG5cbiAgICBidWZmTWFuYWdlcjogQnVmZk1hbmFnZXI7XG5cbiAgICBkYW1hZ2VEb25lID0gMDtcblxuICAgIHF1ZXVlZFNwZWxsOiBMZWFybmVkU3dpbmdTcGVsbHx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBsb2c/OiBMb2dGdW5jdGlvbjtcblxuICAgIGxhdGVuY3kgPSA1MDsgLy8gbXNcblxuICAgIHBvd2VyTG9zdCA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0czogU3RhdFZhbHVlcywgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgc3VwZXIoNjAsIDApOyAvLyBsdmwsIGFybW9yXG5cbiAgICAgICAgdGhpcy5idWZmTWFuYWdlciA9IG5ldyBCdWZmTWFuYWdlcih0aGlzLCBuZXcgU3RhdHMoc3RhdHMpKTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IG1oKCk6IFdlYXBvbkVxdWlwZWR8dW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3QgZXF1aXBlZCA9IHRoaXMuaXRlbXMuZ2V0KEl0ZW1TbG90Lk1BSU5IQU5EKTtcblxuICAgICAgICBpZiAoZXF1aXBlZCAmJiBpc0VxdWlwZWRXZWFwb24oZXF1aXBlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcXVpcGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9oKCk6IFdlYXBvbkVxdWlwZWR8dW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3QgZXF1aXBlZCA9IHRoaXMuaXRlbXMuZ2V0KEl0ZW1TbG90Lk9GRkhBTkQpO1xuXG4gICAgICAgIGlmIChlcXVpcGVkICYmIGlzRXF1aXBlZFdlYXBvbihlcXVpcGVkKSkge1xuICAgICAgICAgICAgcmV0dXJuIGVxdWlwZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBlcXVpcChpdGVtOiBJdGVtRGVzY3JpcHRpb24sIHNsb3Q6IEl0ZW1TbG90KSB7XG4gICAgICAgIGlmICh0aGlzLml0ZW1zLmhhcyhzbG90KSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgYWxyZWFkeSBoYXZlIGl0ZW0gaW4gc2xvdCAke0l0ZW1TbG90W3Nsb3RdfWApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIShpdGVtLnNsb3QgJiBzbG90KSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgY2Fubm90IGVxdWlwICR7aXRlbS5uYW1lfSBpbiBzbG90ICR7SXRlbVNsb3Rbc2xvdF19YClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnN0YXRzKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmJhc2VTdGF0cy5hZGQoaXRlbS5zdGF0cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUT0RPIC0gaGFuZGxlIGVxdWlwcGluZyAySCAoYW5kIGhvdyB0aGF0IGRpc2FibGVzIE9IKVxuICAgICAgICBpZiAoaXNXZWFwb24oaXRlbSkpIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMuc2V0KHNsb3QsIG5ldyBXZWFwb25FcXVpcGVkKGl0ZW0sIHRoaXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMuc2V0KHNsb3QsIG5ldyBJdGVtRXF1aXBlZChpdGVtLCB0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcG93ZXIoKTogbnVtYmVyIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgc2V0IHBvd2VyKHBvd2VyOiBudW1iZXIpIHt9XG5cbiAgICBhZGRQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgdGhpcy5wcm9jcy5wdXNoKHApO1xuICAgIH1cblxuICAgIHJlbW92ZVByb2MocDogUHJvYykge1xuICAgICAgICAvLyBUT0RPIC0gZWl0aGVyIHByb2NzIHNob3VsZCBiZSBhIHNldCBvciB3ZSBuZWVkIFByb2NBcHBsaWNhdGlvblxuICAgICAgICB0aGlzLnByb2NzID0gdGhpcy5wcm9jcy5maWx0ZXIoKHByb2M6IFByb2MpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwcm9jICE9PSBwO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBpZiAoc3BlbGwgJiYgc3BlbGwudHlwZSA9PSBTcGVsbFR5cGUuUEhZU0lDQUwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3ZWFwb24gPSBpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCE7XG4gICAgICAgIGNvbnN0IHdlYXBvblR5cGUgPSB3ZWFwb24ud2VhcG9uLnR5cGU7XG5cbiAgICAgICAgLy8gVE9ETywgbWFrZSB0aGlzIGEgbWFwXG4gICAgICAgIHN3aXRjaCAod2VhcG9uVHlwZSkge1xuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLk1BQ0U6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMubWFjZVNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLlNXT1JEOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN3b3JkU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuQVhFOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmF4ZVNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkRBR0dFUjpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5kYWdnZXJTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5NQUNFMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMubWFjZTJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuU1dPUkQySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zd29yZDJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuQVhFMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXhlMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UoKSB7XG4gICAgICAgIGxldCBjcml0ID0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5jcml0O1xuICAgICAgICBjcml0ICs9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYWdpICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAvIDIwO1xuXG4gICAgICAgIHJldHVybiBjcml0O1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVNaXNzQ2hhbmNlKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgbGV0IHJlcyA9IDU7XG4gICAgICAgIHJlcyAtPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhpdDtcblxuICAgICAgICBpZiAodGhpcy5vaCAmJiAhc3BlbGwpIHtcbiAgICAgICAgICAgIHJlcyArPSAxOTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2tpbGxEaWZmID0gdGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oLCBzcGVsbCkgLSB2aWN0aW0uZGVmZW5zZVNraWxsO1xuXG4gICAgICAgIGlmIChza2lsbERpZmYgPCAtMTApIHtcbiAgICAgICAgICAgIHJlcyAtPSAoc2tpbGxEaWZmICsgMTApICogMC40IC0gMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcyAtPSBza2lsbERpZmYgKiAwLjE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2xhbXAocmVzLCAwLCA2MCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgY29uc3Qgc2tpbGxEaWZmID0gdmljdGltLmRlZmVuc2VTa2lsbCAgLSB0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgpO1xuXG4gICAgICAgIGlmIChza2lsbERpZmYgPj0gMTUpIHtcbiAgICAgICAgICAgIHJldHVybiAwLjY1O1xuICAgICAgICB9IGVsc2UgaWYgKHNraWxsRGlmZiA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHNraWxsRGlmZlRvUmVkdWN0aW9uW3NraWxsRGlmZl07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXAoKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVTd2luZ01pbk1heERhbWFnZShpc19taDogYm9vbGVhbik6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgICAgICBjb25zdCB3ZWFwb24gPSBpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCE7XG5cbiAgICAgICAgY29uc3QgYXBfYm9udXMgPSB0aGlzLmFwIC8gMTQgKiB3ZWFwb24ud2VhcG9uLnNwZWVkO1xuXG4gICAgICAgIGNvbnN0IG9oUGVuYWx0eSA9IGlzX21oID8gMSA6IDAuNjI1OyAvLyBUT0RPIC0gY2hlY2sgdGFsZW50cywgaW1wbGVtZW50ZWQgYXMgYW4gYXVyYSBTUEVMTF9BVVJBX01PRF9PRkZIQU5EX0RBTUFHRV9QQ1RcblxuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgKHdlYXBvbi5taW4gKyBhcF9ib251cykgKiBvaFBlbmFsdHksXG4gICAgICAgICAgICAod2VhcG9uLm1heCArIGFwX2JvbnVzKSAqIG9oUGVuYWx0eVxuICAgICAgICBdO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oOiBib29sZWFuKSB7XG4gICAgICAgIHJldHVybiBmcmFuZCguLi50aGlzLmNhbGN1bGF0ZVN3aW5nTWluTWF4RGFtYWdlKGlzX21oKSk7XG4gICAgfVxuXG4gICAgcm9sbE1lbGVlSGl0T3V0Y29tZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKTogTWVsZWVIaXRPdXRjb21lIHtcbiAgICAgICAgY29uc3Qgcm9sbCA9IHVyYW5kKDAsIDEwMDAwKTtcbiAgICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICAgIGxldCB0bXAgPSAwO1xuXG4gICAgICAgIC8vIHJvdW5kaW5nIGluc3RlYWQgb2YgdHJ1bmNhdGluZyBiZWNhdXNlIDE5LjQgKiAxMDAgd2FzIHRydW5jYXRpbmcgdG8gMTkzOS5cbiAgICAgICAgY29uc3QgbWlzc19jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlTWlzc0NoYW5jZSh2aWN0aW0sIGlzX21oLCBzcGVsbCkgKiAxMDApO1xuICAgICAgICBjb25zdCBkb2RnZV9jaGFuY2UgPSBNYXRoLnJvdW5kKHZpY3RpbS5kb2RnZUNoYW5jZSAqIDEwMCk7XG4gICAgICAgIGNvbnN0IGNyaXRfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZUNyaXRDaGFuY2UoKSAqIDEwMCk7XG5cbiAgICAgICAgLy8gd2VhcG9uIHNraWxsIC0gdGFyZ2V0IGRlZmVuc2UgKHVzdWFsbHkgbmVnYXRpdmUpXG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuXG4gICAgICAgIHRtcCA9IG1pc3NfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBkb2RnZV9jaGFuY2UgLSBza2lsbEJvbnVzOyAvLyA1LjYgKDU2MCkgZm9yIGx2bCA2MyB3aXRoIDMwMCB3ZWFwb24gc2tpbGxcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3BlbGwpIHsgLy8gc3BlbGxzIGNhbid0IGdsYW5jZVxuICAgICAgICAgICAgdG1wID0gKDEwICsgKHZpY3RpbS5kZWZlbnNlU2tpbGwgLSAzMDApICogMikgKiAxMDA7XG4gICAgICAgICAgICB0bXAgPSBjbGFtcCh0bXAsIDAsIDQwMDApO1xuICAgIFxuICAgICAgICAgICAgaWYgKHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IGNyaXRfY2hhbmNlICsgc2tpbGxCb251cztcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSBjcml0X2NoYW5jZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUw7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgZGFtYWdlV2l0aEJvbnVzID0gcmF3RGFtYWdlO1xuXG4gICAgICAgIGRhbWFnZVdpdGhCb251cyAqPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhbWFnZU11bHQ7XG5cbiAgICAgICAgcmV0dXJuIGRhbWFnZVdpdGhCb251cztcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZVdpdGhCb251cyA9IHRoaXMuY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIHNwZWxsKTtcbiAgICAgICAgY29uc3QgYXJtb3JSZWR1Y2VkID0gdmljdGltLmNhbGN1bGF0ZUFybW9yUmVkdWNlZERhbWFnZShkYW1hZ2VXaXRoQm9udXMsIHRoaXMpO1xuICAgICAgICBjb25zdCBoaXRPdXRjb21lID0gdGhpcy5yb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcblxuICAgICAgICBsZXQgZGFtYWdlID0gYXJtb3JSZWR1Y2VkO1xuICAgICAgICBsZXQgY2xlYW5EYW1hZ2UgPSAwO1xuXG4gICAgICAgIHN3aXRjaCAoaGl0T3V0Y29tZSkge1xuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTpcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSAwO1xuICAgICAgICAgICAgICAgIGNsZWFuRGFtYWdlID0gZGFtYWdlV2l0aEJvbnVzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZHVjZVBlcmNlbnQgPSB0aGlzLmNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbSwgaXNfbWgpO1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IHJlZHVjZVBlcmNlbnQgKiBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlICo9IDI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW2RhbWFnZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUywgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIC8vIHdoYXQgaXMgdGhlIG9yZGVyIG9mIGNoZWNraW5nIGZvciBwcm9jcyBsaWtlIGhvaiwgaXJvbmZvZSBhbmQgd2luZGZ1cnlcbiAgICAgICAgICAgIC8vIG9uIExIIGNvcmUgaXQgaXMgaG9qID4gaXJvbmZvZSA+IHdpbmRmdXJ5XG5cbiAgICAgICAgICAgIC8vIHNvIGRvIGl0ZW0gcHJvY3MgZmlyc3QsIHRoZW4gd2VhcG9uIHByb2MsIHRoZW4gd2luZGZ1cnlcbiAgICAgICAgICAgIGZvciAobGV0IHByb2Mgb2YgdGhpcy5wcm9jcykge1xuICAgICAgICAgICAgICAgIHByb2MucnVuKHRoaXMsIChpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCEpLndlYXBvbiwgdGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAoaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghKS5wcm9jKHRpbWUpO1xuICAgICAgICAgICAgLy8gVE9ETyAtIGltcGxlbWVudCB3aW5kZnVyeSBoZXJlLCBpdCBzaG91bGQgc3RpbGwgYWRkIGF0dGFjayBwb3dlciBldmVuIGlmIHRoZXJlIGlzIGFscmVhZHkgYW4gZXh0cmEgYXR0YWNrXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZWFsTWVsZWVEYW1hZ2UodGltZTogbnVtYmVyLCByYXdEYW1hZ2U6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXSA9IHRoaXMuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oLCBzcGVsbCk7XG4gICAgICAgIGRhbWFnZURvbmUgPSBNYXRoLnRydW5jKGRhbWFnZURvbmUpOyAvLyB0cnVuY2F0aW5nIGhlcmUgYmVjYXVzZSB3YXJyaW9yIHN1YmNsYXNzIGJ1aWxkcyBvbiB0b3Agb2YgY2FsY3VsYXRlTWVsZWVEYW1hZ2VcbiAgICAgICAgY2xlYW5EYW1hZ2UgPSBNYXRoLnRydW5jKGNsZWFuRGFtYWdlKTsgLy8gVE9ETywgc2hvdWxkIGRhbWFnZU11bHQgYWZmZWN0IGNsZWFuIGRhbWFnZSBhcyB3ZWxsPyBpZiBzbyBtb3ZlIGl0IGludG8gY2FsY3VsYXRlTWVsZWVEYW1hZ2VcblxuICAgICAgICB0aGlzLmRhbWFnZURvbmUgKz0gZGFtYWdlRG9uZTtcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgbGV0IGhpdFN0ciA9IGBZb3VyICR7c3BlbGwgPyBzcGVsbC5uYW1lIDogKGlzX21oID8gJ21haW4taGFuZCcgOiAnb2ZmLWhhbmQnKX0gJHtoaXRPdXRjb21lU3RyaW5nW2hpdE91dGNvbWVdfWA7XG4gICAgICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAgICAgaGl0U3RyICs9IGAgZm9yICR7ZGFtYWdlRG9uZX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgaGl0U3RyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudXBkYXRlUHJvY3ModGltZSwgaXNfbWgsIGhpdE91dGNvbWUsIGRhbWFnZURvbmUsIGNsZWFuRGFtYWdlLCBzcGVsbCk7XG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIudXBkYXRlKHRpbWUpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBzd2luZ1dlYXBvbih0aW1lOiBudW1iZXIsIHRhcmdldDogVW5pdCwgaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgY29uc3QgcmF3RGFtYWdlID0gdGhpcy5jYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZShpc19taCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXRoaXMuZG9pbmdFeHRyYUF0dGFja3MgJiYgaXNfbWggJiYgdGhpcy5xdWV1ZWRTcGVsbCAmJiB0aGlzLnF1ZXVlZFNwZWxsLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIGNvbnN0IHN3aW5nU3BlbGwgPSB0aGlzLnF1ZXVlZFNwZWxsLnNwZWxsO1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRTcGVsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGNvbnN0IGJvbnVzRGFtYWdlID0gc3dpbmdTcGVsbC5ib251c0RhbWFnZTtcbiAgICAgICAgICAgIHRoaXMuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHJhd0RhbWFnZSArIGJvbnVzRGFtYWdlLCB0YXJnZXQsIGlzX21oLCBzd2luZ1NwZWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHJhd0RhbWFnZSwgdGFyZ2V0LCBpc19taCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBbdGhpc1dlYXBvbiwgb3RoZXJXZWFwb25dID0gaXNfbWggPyBbdGhpcy5taCwgdGhpcy5vaF0gOiBbdGhpcy5vaCwgdGhpcy5taF07XG5cbiAgICAgICAgdGhpc1dlYXBvbiEubmV4dFN3aW5nVGltZSA9IHRpbWUgKyB0aGlzV2VhcG9uIS53ZWFwb24uc3BlZWQgLyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhhc3RlICogMTAwMDtcblxuICAgICAgICBpZiAob3RoZXJXZWFwb24gJiYgb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSA8IHRpbWUgKyAyMDApIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBkZWxheWluZyAke2lzX21oID8gJ09IJyA6ICdNSCd9IHN3aW5nYCwgdGltZSArIDIwMCAtIG90aGVyV2VhcG9uLm5leHRTd2luZ1RpbWUpO1xuICAgICAgICAgICAgb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSA9IHRpbWUgKyAyMDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRyYUF0dGFja0NvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9pbmdFeHRyYUF0dGFja3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHdoaWxlICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4dHJhQXR0YWNrQ291bnQtLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGltZSA+PSB0aGlzLm1oIS5uZXh0U3dpbmdUaW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMub2ggJiYgdGltZSA+PSB0aGlzLm9oLm5leHRTd2luZ1RpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBQbGF5ZXIsIE1lbGVlSGl0T3V0Y29tZSwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiwgQnVmZk92ZXJUaW1lIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBMZWFybmVkU3BlbGwsIFNwZWxsRGFtYWdlLCBTcGVsbFR5cGUsIFN3aW5nU3BlbGwsIExlYXJuZWRTd2luZ1NwZWxsLCBQcm9jLCBTcGVsbEJ1ZmYgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5cbmNvbnN0IGZsdXJyeSA9IG5ldyBCdWZmKFwiRmx1cnJ5XCIsIDE1LCB7aGFzdGU6IDEuM30sIHRydWUsIDMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbmV4cG9ydCBjb25zdCByYWNlVG9TdGF0cyA9IG5ldyBNYXA8UmFjZSwgU3RhdFZhbHVlcz4oKTtcbnJhY2VUb1N0YXRzLnNldChSYWNlLkhVTUFOLCB7IG1hY2VTa2lsbDogNSwgc3dvcmRTa2lsbDogNSwgbWFjZTJIU2tpbGw6IDUsIHN3b3JkMkhTa2lsbDogNSwgc3RyOiAxMjAsIGFnaTogODAgfSk7XG5yYWNlVG9TdGF0cy5zZXQoUmFjZS5PUkMsIHsgYXhlU2tpbGw6IDUsIGF4ZTJIU2tpbGw6IDUsIHN0cjogMTIzLCBhZ2k6IDc3IH0pO1xuXG5leHBvcnQgY2xhc3MgV2FycmlvciBleHRlbmRzIFBsYXllciB7XG4gICAgcmFnZSA9IDgwOyAvLyBUT0RPIC0gYWxsb3cgc2ltdWxhdGlvbiB0byBjaG9vc2Ugc3RhcnRpbmcgcmFnZVxuXG4gICAgZXhlY3V0ZSA9IG5ldyBMZWFybmVkU3BlbGwoZXhlY3V0ZVNwZWxsLCB0aGlzKTtcbiAgICBibG9vZHRoaXJzdCA9IG5ldyBMZWFybmVkU3BlbGwoYmxvb2R0aGlyc3RTcGVsbCwgdGhpcyk7XG4gICAgaGFtc3RyaW5nID0gbmV3IExlYXJuZWRTcGVsbChoYW1zdHJpbmdTcGVsbCwgdGhpcyk7XG4gICAgd2hpcmx3aW5kID0gbmV3IExlYXJuZWRTcGVsbCh3aGlybHdpbmRTcGVsbCwgdGhpcyk7XG4gICAgaGVyb2ljU3RyaWtlID0gbmV3IExlYXJuZWRTd2luZ1NwZWxsKGhlcm9pY1N0cmlrZVNwZWxsLCB0aGlzKTtcbiAgICBibG9vZFJhZ2UgPSBuZXcgTGVhcm5lZFNwZWxsKGJsb29kUmFnZSwgdGhpcyk7XG4gICAgZGVhdGhXaXNoID0gbmV3IExlYXJuZWRTcGVsbChkZWF0aFdpc2gsIHRoaXMpO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZ0NhbGxiYWNrPzogKHRpbWU6IG51bWJlciwgdGV4dDogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5ldyBTdGF0cyhyYWNlVG9TdGF0cy5nZXQocmFjZSkpLmFkZChzdGF0cyksIGxvZ0NhbGxiYWNrKTtcblxuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChhbmdlck1hbmFnZW1lbnRPVCwgTWF0aC5yYW5kb20oKSAqIC0zMDAwKTsgLy8gcmFuZG9taXppbmcgYW5nZXIgbWFuYWdlbWVudCB0aW1pbmdcbiAgICB9XG5cbiAgICBnZXQgcG93ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJhZ2U7XG4gICAgfVxuXG4gICAgc2V0IHBvd2VyKHBvd2VyOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5wb3dlckxvc3QgKz0gTWF0aC5tYXgoMCwgcG93ZXIgLSAxMDApO1xuICAgICAgICB0aGlzLnJhZ2UgPSBjbGFtcChwb3dlciwgMCwgMTAwKTtcbiAgICB9XG5cbiAgICBnZXQgYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxldmVsICogMyAtIDIwICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5hcCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RyICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAqIDI7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQ3JpdENoYW5jZSgpIHtcbiAgICAgICAgLy8gY3J1ZWx0eSArIGJlcnNlcmtlciBzdGFuY2VcbiAgICAgICAgcmV0dXJuIDUgKyAzICsgc3VwZXIuY2FsY3VsYXRlQ3JpdENoYW5jZSgpO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZTogbnVtYmVyLCB2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKTogW251bWJlciwgTWVsZWVIaXRPdXRjb21lLCBudW1iZXJdIHtcbiAgICAgICAgbGV0IFtkYW1hZ2VEb25lLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV0gPSBzdXBlci5jYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2UsIHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcblxuICAgICAgICBpZiAoaGl0T3V0Y29tZSA9PT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUICYmIHNwZWxsKSB7XG4gICAgICAgICAgICBkYW1hZ2VEb25lICo9IDEuMTsgLy8gaW1wYWxlXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCByZXdhcmRSYWdlKGRhbWFnZTogbnVtYmVyLCBpc19hdHRhY2tlcjogYm9vbGVhbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIGh0dHBzOi8vYmx1ZS5tbW8tY2hhbXBpb24uY29tL3RvcGljLzE4MzI1LXRoZS1uZXctcmFnZS1mb3JtdWxhLWJ5LWthbGdhbi9cbiAgICAgICAgLy8gUHJlLUV4cGFuc2lvbiBSYWdlIEdhaW5lZCBmcm9tIGRlYWxpbmcgZGFtYWdlOlxuICAgICAgICAvLyAoRGFtYWdlIERlYWx0KSAvIChSYWdlIENvbnZlcnNpb24gYXQgWW91ciBMZXZlbCkgKiA3LjVcbiAgICAgICAgLy8gRm9yIFRha2luZyBEYW1hZ2UgKGJvdGggcHJlIGFuZCBwb3N0IGV4cGFuc2lvbik6XG4gICAgICAgIC8vIFJhZ2UgR2FpbmVkID0gKERhbWFnZSBUYWtlbikgLyAoUmFnZSBDb252ZXJzaW9uIGF0IFlvdXIgTGV2ZWwpICogMi41XG4gICAgICAgIC8vIFJhZ2UgQ29udmVyc2lvbiBhdCBsZXZlbCA2MDogMjMwLjZcbiAgICAgICAgLy8gVE9ETyAtIGhvdyBkbyBmcmFjdGlvbnMgb2YgcmFnZSB3b3JrPyBpdCBhcHBlYXJzIHlvdSBkbyBnYWluIGZyYWN0aW9ucyBiYXNlZCBvbiBleGVjIGRhbWFnZVxuICAgICAgICAvLyBub3QgdHJ1bmNhdGluZyBmb3Igbm93XG4gICAgICAgIFxuICAgICAgICBjb25zdCBMRVZFTF82MF9SQUdFX0NPTlYgPSAyMzAuNjtcbiAgICAgICAgbGV0IGFkZFJhZ2UgPSBkYW1hZ2UgLyBMRVZFTF82MF9SQUdFX0NPTlY7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNfYXR0YWNrZXIpIHtcbiAgICAgICAgICAgIGFkZFJhZ2UgKj0gNy41O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGNoZWNrIGZvciBiZXJzZXJrZXIgcmFnZSAxLjN4IG1vZGlmaWVyXG4gICAgICAgICAgICBhZGRSYWdlICo9IDIuNTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxvZykgdGhpcy5sb2codGltZSwgYEdhaW5lZCAke01hdGgubWluKGFkZFJhZ2UsIDEwMCAtIHRoaXMucmFnZSl9IHJhZ2UgKCR7TWF0aC5taW4oMTAwLCB0aGlzLnBvd2VyICsgYWRkUmFnZSl9KWApO1xuXG4gICAgICAgIHRoaXMucG93ZXIgKz0gYWRkUmFnZTtcbiAgICB9XG5cbiAgICB1cGRhdGVQcm9jcyh0aW1lOiBudW1iZXIsIGlzX21oOiBib29sZWFuLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUsIGRhbWFnZURvbmU6IG51bWJlciwgY2xlYW5EYW1hZ2U6IG51bWJlciwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBzdXBlci51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIHNwZWxsKTtcblxuICAgICAgICBpZiAoW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICBpZiAoc3BlbGwpIHtcbiAgICAgICAgICAgICAgICAvLyBodHRwOi8vYmx1ZS5tbW8tY2hhbXBpb24uY29tL3RvcGljLzY5MzY1LTE4LTAyLTA1LWthbGdhbnMtcmVzcG9uc2UtdG8td2FycmlvcnMvIFwic2luY2UgbWlzc2luZyB3YXN0ZXMgMjAlIG9mIHRoZSByYWdlIGNvc3Qgb2YgdGhlIGFiaWxpdHlcIlxuICAgICAgICAgICAgICAgIC8vIFRPRE8gLSBub3Qgc3VyZSBob3cgYmxpenpsaWtlIHRoaXMgaXNcbiAgICAgICAgICAgICAgICBpZiAoc3BlbGwgIT09IHdoaXJsd2luZFNwZWxsKSB7IC8vIFRPRE8gLSBzaG91bGQgY2hlY2sgdG8gc2VlIGlmIGl0IGlzIGFuIGFvZSBzcGVsbCBvciBhIHNpbmdsZSB0YXJnZXQgc3BlbGxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYWdlICs9IHNwZWxsLmNvc3QgKiAwLjgyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXdhcmRSYWdlKGNsZWFuRGFtYWdlICogMC43NSwgdHJ1ZSwgdGltZSk7IC8vIFRPRE8gLSB3aGVyZSBpcyB0aGlzIGZvcm11bGEgZnJvbT9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChkYW1hZ2VEb25lICYmICFzcGVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZXdhcmRSYWdlKGRhbWFnZURvbmUsIHRydWUsIHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5zdGFudCBhdHRhY2tzIGFuZCBtaXNzZXMvZG9kZ2VzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyAvLyBUT0RPIC0gY29uZmlybVxuICAgICAgICAvLyBleHRyYSBhdHRhY2tzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyBidXQgdGhleSBjYW4gcHJvYyBmbHVycnkgKHRlc3RlZClcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXRoaXMuZG9pbmdFeHRyYUF0dGFja3NcbiAgICAgICAgICAgICYmICEoc3BlbGwgfHwgc3BlbGwgPT09IGhlcm9pY1N0cmlrZVNwZWxsKVxuICAgICAgICAgICAgJiYgIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpXG4gICAgICAgICAgICAmJiBoaXRPdXRjb21lICE9PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVRcbiAgICAgICAgKSB7IFxuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5yZW1vdmUoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCkge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGlnbm9yaW5nIGRlZXAgd291bmRzXG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChmbHVycnksIHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZXJvaWNTdHJpa2VTcGVsbCA9IG5ldyBTd2luZ1NwZWxsKFwiSGVyb2ljIFN0cmlrZVwiLCAxNTcsIDEyKTtcblxuLy8gVE9ETyAtIG5lZWRzIHRvIHdpcGUgb3V0IGFsbCByYWdlIGV2ZW4gdGhvdWdoIGl0IG9ubHkgY29zdHMgMTBcbmNvbnN0IGV4ZWN1dGVTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkV4ZWN1dGVcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIDYwMCArICgoPFdhcnJpb3I+cGxheWVyKS5yYWdlIC0gMTApO1xufSwgU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgdHJ1ZSwgMTAsIDApO1xuXG5jb25zdCBibG9vZHRoaXJzdFNwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiQmxvb2R0aGlyc3RcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuICg8V2Fycmlvcj5wbGF5ZXIpLmFwICogMC40NTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTCwgdHJ1ZSwgMzAsIDYpO1xuXG5jb25zdCB3aGlybHdpbmRTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIldoaXJsd2luZFwiLCAocGxheWVyOiBQbGF5ZXIpID0+IHtcbiAgICByZXR1cm4gcGxheWVyLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKHRydWUpO1xufSwgU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgdHJ1ZSwgMjUsIDEwKTtcblxuY29uc3QgaGFtc3RyaW5nU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJIYW1zdHJpbmdcIiwgNDUsIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIHRydWUsIDEwLCAwKTtcblxuZXhwb3J0IGNvbnN0IGFuZ2VyTWFuYWdlbWVudE9UID0gbmV3IEJ1ZmZPdmVyVGltZShcIkFuZ2VyIE1hbmFnZW1lbnRcIiwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIHVuZGVmaW5lZCwgMzAwMCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW5lZCAxIHJhZ2UgZnJvbSBBbmdlciBNYW5hZ2VtZW50YCk7XG59KTtcblxuY29uc3QgYmxvb2RSYWdlT1QgPSBuZXcgQnVmZk92ZXJUaW1lKFwiQmxvb2RyYWdlXCIsIDEwLCB1bmRlZmluZWQsIDEwMDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgcGxheWVyLnBvd2VyICs9IDE7XG4gICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluZWQgMSByYWdlIGZyb20gQmxvb2RyYWdlYCk7XG59KTtcblxuY29uc3QgYmxvb2RSYWdlID0gbmV3IFNwZWxsKFwiQmxvb2RyYWdlXCIsIFNwZWxsVHlwZS5OT05FLCBmYWxzZSwgMCwgNjAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgcGxheWVyLnBvd2VyICs9IDEwO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbiAxMCByYWdlIGZyb20gQmxvb2RyYWdlYCk7XG4gICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChibG9vZFJhZ2VPVCwgdGltZSk7XG59KTtcblxuY29uc3QgZGVhdGhXaXNoID0gbmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkRlYXRoIFdpc2hcIiwgMzAsIHsgZGFtYWdlTXVsdDogMS4yIH0pLCB0cnVlLCAxMCwgMyAqIDYwKTtcbiIsImltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgU3BlbGxCdWZmLCBQcm9jLCBFeHRyYUF0dGFjayB9IGZyb20gXCIuLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgU3RhdHMsIFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFRlbXBvcmFyeVdlYXBvbkVuY2hhbnQgfSBmcm9tIFwiLi4vaXRlbS5qc1wiO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVmZkRlc2NyaXB0aW9uIHtcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgZHVyYXRpb246IG51bWJlcixcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG59XG5cbmV4cG9ydCBjb25zdCBidWZmczogQnVmZltdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYXR0bGUgU2hvdXRcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyOTBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdpZnQgb2YgdGhlIFdpbGRcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAxNiwgLy8gVE9ETyAtIHNob3VsZCBpdCBiZSAxMiAqIDEuMzU/ICh0YWxlbnQpXG4gICAgICAgICAgICBhZ2k6IDE2XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUcnVlc2hvdCBBdXJhXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAxMDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzaW5nIG9mIEtpbmdzXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RhdE11bHQ6IDEuMVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3Npbmcgb2YgTWlnaHRcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjIyXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTbW9rZWQgRGVzZXJ0IER1bXBsaW5nc1wiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgUG93ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDMwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDMwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJKdWp1IE1pZ2h0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAxMCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDQwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFbGl4aXIgb2YgdGhlIE1vbmdvb3NlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFnaTogMjUsXG4gICAgICAgICAgICBjcml0OiAyXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSLk8uSS5ELlMuXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJhbGx5aW5nIENyeSBvZiB0aGUgRHJhZ29uc2xheWVyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAxNDAsXG4gICAgICAgICAgICBjcml0OiA1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTb25nZmxvd2VyIFNlcmFuYWRlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGNyaXQ6IDUsXG4gICAgICAgICAgICBzdHI6IDE1LFxuICAgICAgICAgICAgYWdpOiAxNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3Bpcml0IG9mIFphbmRhbGFyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0YXRNdWx0OiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJGZW5ndXMnIEZlcm9jaXR5XCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyMDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIldhcmNoaWVmJ3MgQmxlc3NpbmdcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgaGFzdGU6IDEuMTVcbiAgICAgICAgfVxuICAgIH0sXG5dLm1hcCgoYmQ6IEJ1ZmZEZXNjcmlwdGlvbikgPT4gbmV3IEJ1ZmYoYmQubmFtZSwgYmQuZHVyYXRpb24sIGJkLnN0YXRzKSk7XG5cbi8vIE5PVEU6IHRvIHNpbXBsaWZ5IHRoZSBjb2RlLCB0cmVhdGluZyB0aGVzZSBhcyB0d28gc2VwYXJhdGUgYnVmZnMgc2luY2UgdGhleSBzdGFja1xuLy8gY3J1c2FkZXIgYnVmZnMgYXBwYXJlbnRseSBjYW4gYmUgZnVydGhlciBzdGFja2VkIGJ5IHN3YXBwaW5nIHdlYXBvbnMgYnV0IG5vdCBnb2luZyB0byBib3RoZXIgd2l0aCB0aGF0XG5leHBvcnQgY29uc3QgY3J1c2FkZXJCdWZmTUhQcm9jID0gbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE1IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pO1xuZXhwb3J0IGNvbnN0IGNydXNhZGVyQnVmZk9IUHJvYyA9IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJDcnVzYWRlciBPSFwiLCAxNSwgbmV3IFN0YXRzKHtzdHI6IDEwMH0pKSksIHtwcG06IDF9KTtcblxuZXhwb3J0IGNvbnN0IGRlbnNlRGFtYWdlU3RvbmUgPSBuZXcgVGVtcG9yYXJ5V2VhcG9uRW5jaGFudCh7IHBsdXNEYW1hZ2U6IDggfSk7XG5cbmV4cG9ydCBjb25zdCB3aW5kZnVyeUVuY2hhbnQgPSBuZXcgVGVtcG9yYXJ5V2VhcG9uRW5jaGFudCh1bmRlZmluZWQsIG5ldyBQcm9jKFtcbiAgICBuZXcgRXh0cmFBdHRhY2soXCJXaW5kZnVyeSBUb3RlbVwiLCAxKSxcbiAgICBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiV2luZGZ1cnkgVG90ZW1cIiwgMS41LCB7IGFwOiAzMTUgfSkpXG5dLCB7Y2hhbmNlOiAwLjJ9KSk7XG4iLCJpbXBvcnQgeyBXZWFwb25UeXBlLCBXZWFwb25EZXNjcmlwdGlvbiwgSXRlbVNsb3QsIEl0ZW1EZXNjcmlwdGlvbiB9IGZyb20gXCIuLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBTcGVsbEJ1ZmYsIEV4dHJhQXR0YWNrLCBQcm9jLCBTcGVsbCB9IGZyb20gXCIuLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgQnVmZiwgQnVmZlByb2MgfSBmcm9tIFwiLi4vYnVmZi5qc1wiO1xuXG4vLyBUT0RPIC0gaG93IHRvIGltcGxlbWVudCBzZXQgYm9udXNlcz8gcHJvYmFibHkgZWFzaWVzdCB0byBhZGQgYm9udXMgdGhhdCByZXF1aXJlcyBhIHN0cmluZyBzZWFyY2ggb2Ygb3RoZXIgZXF1aXBlZCBpdGVtc1xuXG5leHBvcnQgY29uc3QgaXRlbXM6IChJdGVtRGVzY3JpcHRpb258V2VhcG9uRGVzY3JpcHRpb24pW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiBcIklyb25mb2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgbWluOiA3MyxcbiAgICAgICAgbWF4OiAxMzYsXG4gICAgICAgIHNwZWVkOiAyLjQsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0lyb25mb2UnLCAyKSx7cHBtOiAxfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFbXB5cmVhbiBEZW1vbGlzaGVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogOTQsXG4gICAgICAgIG1heDogMTc1LFxuICAgICAgICBzcGVlZDogMi44LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkhhc3RlIChFbXB5cmVhbiBEZW1vbGlzaGVyKVwiLCAxMCwge2hhc3RlOiAxLjJ9KSkse3BwbTogMX0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQW51YmlzYXRoIFdhcmhhbW1lclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogNjYsXG4gICAgICAgIG1heDogMTIzLFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBtYWNlU2tpbGw6IDQsIGFwOiAzMiB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVGhlIFVudGFtZWQgQmxhZGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRDJILFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiAxOTIsXG4gICAgICAgIG1heDogMjg5LFxuICAgICAgICBzcGVlZDogMy40LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIlVudGFtZWQgRnVyeVwiLCA4LCB7c3RyOiAzMDB9KSkse3BwbTogMn0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSGFuZCBvZiBKdXN0aWNlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDIwfSxcbiAgICAgICAgb25lcXVpcDogbmV3IFByb2MobmV3IEV4dHJhQXR0YWNrKCdIYW5kIG9mIEp1c3RpY2UnLCAxKSwge2NoYW5jZTogMi8xMDB9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsYWNraGFuZCdzIEJyZWFkdGhcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHtjcml0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRyYWtlIEZhbmcgVGFsaXNtYW5cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHthcDogNTYsIGhpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJMaW9uaGVhcnQgSGVsbVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IRUFELFxuICAgICAgICBzdGF0czoge2NyaXQ6IDIsIGhpdDogMiwgc3RyOiAxOH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYXJiZWQgQ2hva2VyXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk5FQ0ssXG4gICAgICAgIHN0YXRzOiB7YXA6IDQ0LCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9ueXhpYSBUb290aCBQZW5kYW50XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk5FQ0ssXG4gICAgICAgIHN0YXRzOiB7YWdpOiAxMiwgaGl0OiAxLCBjcml0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNvbnF1ZXJvcidzIFNwYXVsZGVyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5TSE9VTERFUixcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDE2LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ2xvYWsgb2YgRHJhY29uaWMgTWlnaHRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQkFDSyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDE2LCBhZ2k6IDE2fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRyYXBlIG9mIFVueWllbGRpbmcgU3RyZW5ndGhcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQkFDSyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDE1LCBhZ2k6IDksIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBCcmVhc3RwbGF0ZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDE2LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU2F2YWdlIEdsYWRpYXRvciBDaGFpblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE0LCBzdHI6IDEzLCBjcml0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdob3VsIFNraW4gVHVuaWNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiA0MCwgY3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCcmVhc3RwbGF0ZSBvZiBBbm5paGlsYXRpb25cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzNywgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhpdmUgRGVmaWxlciBXcmlzdGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIzLCBhZ2k6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlFpcmFqaSBFeGVjdXRpb24gQnJhY2Vyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE2LCBzdHI6IDE1LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2F1bnRsZXRzIG9mIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMjIsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgQW5uaWhpbGF0aW9uXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMzUsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFZGdlbWFzdGVyJ3MgSGFuZGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHsgYXhlU2tpbGw6IDcsIGRhZ2dlclNraWxsOiA3LCBzd29yZFNraWxsOiA3IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJPbnNsYXVnaHQgR2lyZGxlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldBSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMzEsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaXRhbmljIExlZ2dpbmdzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMCwgY3JpdDogMSwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJvb3RzIG9mIHRoZSBGYWxsZW4gSGVyb1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTQsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWMgQm9vdHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDIwLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3RyaWtlcidzIE1hcmtcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUkFOR0VELFxuICAgICAgICBzdGF0czoge2FwOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRvbiBKdWxpbydzIEJhbmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMSwgaGl0OiAxLCBhcDogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUXVpY2sgU3RyaWtlIFJpbmdcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDMwLCBjcml0OiAxLCBzdHI6IDV9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ2hyb21hdGljYWxseSBUZW1wZXJlZCBTd29yZFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEwNixcbiAgICAgICAgbWF4OiAxOTgsXG4gICAgICAgIHNwZWVkOiAyLjYsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogMTQsIHN0cjogMTQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1hbGFkYXRoLCBSdW5lZCBCbGFkZSBvZiB0aGUgQmxhY2sgRmxpZ2h0XCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODYsXG4gICAgICAgIG1heDogMTYyLFxuICAgICAgICBzcGVlZDogMi4yLFxuICAgICAgICBzdGF0czogeyBzd29yZFNraWxsOiA0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJBbmNpZW50IFFpcmFqaSBSaXBwZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMTQsXG4gICAgICAgIG1heDogMjEzLFxuICAgICAgICBzcGVlZDogMi44LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBMb25nc3dvcmRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBTd2lmdGJsYWRlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODUsXG4gICAgICAgIG1heDogMTI5LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBBeGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2VkIFFpcmFqaSBXYXIgQXhlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDExMCxcbiAgICAgICAgbWF4OiAyMDUsXG4gICAgICAgIHNwZWVkOiAyLjYwLFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMTQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNydWwnc2hvcnVraCwgRWRnZSBvZiBDaGFvc1wiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLkFYRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMDEsXG4gICAgICAgIG1heDogMTg4LFxuICAgICAgICBzcGVlZDogMi4zMCxcbiAgICAgICAgc3RhdHM6IHsgYXA6IDM2IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBvbnVzZTogKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGluc2lnaHRPZlRoZVFpcmFqaSA9IG5ldyBCdWZmKFwiSW5zaWdodCBvZiB0aGUgUWlyYWppXCIsIDMwLCB7YXJtb3JQZW5ldHJhdGlvbjogMjAwfSwgdHJ1ZSwgMCwgNik7XG4gICAgICAgICAgICBjb25zdCBiYWRnZUJ1ZmYgPSBuZXcgU3BlbGxCdWZmKFxuICAgICAgICAgICAgICAgIG5ldyBCdWZmUHJvYyhcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIsIDMwLFxuICAgICAgICAgICAgICAgICAgICBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKGluc2lnaHRPZlRoZVFpcmFqaSksIHtwcG06IDE1fSksXG4gICAgICAgICAgICAgICAgICAgIGluc2lnaHRPZlRoZVFpcmFqaSksXG4gICAgICAgICAgICAgICAgZmFsc2UsIDAsIDMgKiA2MCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBiYWRnZUJ1ZmY7XG4gICAgICAgIH0pKClcbiAgICB9XG5dLnNvcnQoKGEsIGIpID0+IHtcbiAgICByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5kZXhGb3JJdGVtTmFtZShuYW1lOiBzdHJpbmcpOiBudW1iZXJ8dW5kZWZpbmVkIHtcbiAgICBmb3IgKGxldCBbaWR4LCBpdGVtXSBvZiBpdGVtcy5lbnRyaWVzKCkpIHtcbiAgICAgICAgaWYgKGl0ZW0ubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIGlkeDtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgSXRlbVdpdGhTbG90IH0gZnJvbSBcIi4vc2ltdWxhdGlvbi5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2Fycmlvci5qc1wiO1xuaW1wb3J0IHsgY3J1c2FkZXJCdWZmTUhQcm9jLCBjcnVzYWRlckJ1ZmZPSFByb2MsIGJ1ZmZzLCB3aW5kZnVyeUVuY2hhbnQsIGRlbnNlRGFtYWdlU3RvbmUgfSBmcm9tIFwiLi9kYXRhL3NwZWxscy5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IEl0ZW1TbG90IH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgaXRlbXMgfSBmcm9tIFwiLi9kYXRhL2l0ZW1zLmpzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2ltdWxhdGlvbkRlc2NyaXB0aW9uIHtcbiAgICByYWNlOiBSYWNlLFxuICAgIHN0YXRzOiBTdGF0VmFsdWVzLFxuICAgIGVxdWlwbWVudDogW251bWJlciwgSXRlbVNsb3RdW10sXG4gICAgYnVmZnM6IG51bWJlcltdLFxuICAgIGZpZ2h0TGVuZ3RoOiBudW1iZXIsXG4gICAgcmVhbHRpbWU6IGJvb2xlYW4sXG4gICAgaGVyb2ljU3RyaWtlUmFnZVJlcTogbnVtYmVyLFxuICAgIGhhbXN0cmluZ1JhZ2VSZXE6IG51bWJlcixcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwUGxheWVyKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBlcXVpcG1lbnQ6IEl0ZW1XaXRoU2xvdFtdLCBidWZmczogQnVmZltdLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgIGNvbnN0IHBsYXllciA9IG5ldyBXYXJyaW9yKHJhY2UsIHN0YXRzLCBsb2cpO1xuXG4gICAgZm9yIChsZXQgW2l0ZW0sIHNsb3RdIG9mIGVxdWlwbWVudCkge1xuICAgICAgICBwbGF5ZXIuZXF1aXAoaXRlbSwgc2xvdCk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgYnVmZiBvZiBidWZmcykge1xuICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJ1ZmYsIDApO1xuICAgIH1cblxuICAgIHBsYXllci5taCEuYWRkUHJvYyhjcnVzYWRlckJ1ZmZNSFByb2MpO1xuICAgIHBsYXllci5taCEudGVtcG9yYXJ5RW5jaGFudCA9IHJhY2UgPT09IFJhY2UuT1JDID8gd2luZGZ1cnlFbmNoYW50IDogZGVuc2VEYW1hZ2VTdG9uZTtcblxuICAgIGlmIChwbGF5ZXIub2gpIHtcbiAgICAgICAgcGxheWVyLm9oLmFkZFByb2MoY3J1c2FkZXJCdWZmT0hQcm9jKTtcbiAgICAgICAgcGxheWVyLm9oLnRlbXBvcmFyeUVuY2hhbnQgPSBkZW5zZURhbWFnZVN0b25lO1xuICAgIH1cblxuICAgIGNvbnN0IGJvc3MgPSBuZXcgVW5pdCg2MywgNDY5MSAtIDIyNTAgLSA2NDAgLSA1MDUgLSA2MDApOyAvLyBzdW5kZXIsIGNvciwgZmYsIGFubmloXG4gICAgcGxheWVyLnRhcmdldCA9IGJvc3M7XG5cbiAgICByZXR1cm4gcGxheWVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXF1aXBtZW50SW5kaWNlc1RvSXRlbShlcXVpcG1lbnQ6IFtudW1iZXIsIEl0ZW1TbG90XVtdKTogSXRlbVdpdGhTbG90W10ge1xuICAgIGNvbnN0IHJlczogSXRlbVdpdGhTbG90W10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGxldCBbaWR4LCBzbG90XSBvZiBlcXVpcG1lbnQpIHtcbiAgICAgICAgaWYgKGl0ZW1zW2lkeF0pIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKFtpdGVtc1tpZHhdLCBzbG90XSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnYmFkIGl0ZW0gaW5kZXgnLCBpZHgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1ZmZJbmRpY2VzVG9CdWZmKGJ1ZmZJbmRpY2VzOiBudW1iZXJbXSk6IEJ1ZmZbXSB7XG4gICAgY29uc3QgcmVzOiBCdWZmW10gPSBbXTtcblxuICAgIGZvciAobGV0IGlkeCBvZiBidWZmSW5kaWNlcykge1xuICAgICAgICBpZiAoYnVmZnNbaWR4XSkge1xuICAgICAgICAgICAgcmVzLnB1c2goYnVmZnNbaWR4XSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnYmFkIGJ1ZmYgaW5kZXgnLCBpZHgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXM7XG59XG4iLCJpbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBJdGVtRGVzY3JpcHRpb24sIEl0ZW1TbG90IH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uLCBQbGF5ZXIsIFJhY2UgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IHNldHVwUGxheWVyIH0gZnJvbSBcIi4vc2ltdWxhdGlvbl91dGlscy5qc1wiO1xuXG5leHBvcnQgdHlwZSBJdGVtV2l0aFNsb3QgPSBbSXRlbURlc2NyaXB0aW9uLCBJdGVtU2xvdF07XG5cbi8vIFRPRE8gLSBjaGFuZ2UgdGhpcyBpbnRlcmZhY2Ugc28gdGhhdCBDaG9vc2VBY3Rpb24gY2Fubm90IHNjcmV3IHVwIHRoZSBzaW0gb3IgY2hlYXRcbi8vIGUuZy4gQ2hvb3NlQWN0aW9uIHNob3VsZG4ndCBjYXN0IHNwZWxscyBhdCBhIGN1cnJlbnQgdGltZVxuZXhwb3J0IHR5cGUgQ2hvb3NlQWN0aW9uID0gKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXIpID0+IG51bWJlcnx1bmRlZmluZWQ7XG5cbmNsYXNzIEZpZ2h0IHtcbiAgICBwbGF5ZXI6IFBsYXllcjtcbiAgICBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbjtcbiAgICBwcm90ZWN0ZWQgZmlnaHRMZW5ndGg6IG51bWJlcjtcbiAgICBkdXJhdGlvbiA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBJdGVtV2l0aFNsb3RbXSwgYnVmZnM6IEJ1ZmZbXSwgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb24sIGZpZ2h0TGVuZ3RoID0gNjAsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHRoaXMucGxheWVyID0gc2V0dXBQbGF5ZXIocmFjZSwgc3RhdHMsIGVxdWlwbWVudCwgYnVmZnMsIGxvZyk7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gKGZpZ2h0TGVuZ3RoICsgTWF0aC5yYW5kb20oKSAqIDQgLSAyKSAqIDEwMDA7XG4gICAgfVxuXG4gICAgcnVuKCk6IFByb21pc2U8RmlnaHRSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmLCByKSA9PiB7XG4gICAgICAgICAgICB3aGlsZSAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZih7XG4gICAgICAgICAgICAgICAgZGFtYWdlRG9uZTogdGhpcy5wbGF5ZXIuZGFtYWdlRG9uZSxcbiAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogdGhpcy5maWdodExlbmd0aCxcbiAgICAgICAgICAgICAgICBwb3dlckxvc3Q6IHRoaXMucGxheWVyLnBvd2VyTG9zdFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHBhdXNlKCkge31cblxuICAgIGNhbmNlbCgpIHt9XG5cbiAgICBwcm90ZWN0ZWQgdXBkYXRlKCkge1xuICAgICAgICB0aGlzLnBsYXllci5idWZmTWFuYWdlci51cGRhdGUodGhpcy5kdXJhdGlvbik7IC8vIG5lZWQgdG8gY2FsbCB0aGlzIGlmIHRoZSBkdXJhdGlvbiBjaGFuZ2VkIGJlY2F1c2Ugb2YgYnVmZnMgdGhhdCBjaGFuZ2Ugb3ZlciB0aW1lIGxpa2Ugam9tIGdhYmJlclxuXG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uKHRoaXMucGxheWVyLCB0aGlzLmR1cmF0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoKTsgLy8gY2hvb3NlIGFjdGlvbiBiZWZvcmUgaW4gY2FzZSBvZiBhY3Rpb24gZGVwZW5kaW5nIG9uIHRpbWUgb2ZmIHRoZSBnY2QgbGlrZSBlYXJ0aHN0cmlrZSBcblxuICAgICAgICB0aGlzLnBsYXllci51cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgLy8gY2hvb3NlIGFjdGlvbiBhZnRlciBldmVyeSBzd2luZyB3aGljaCBjb3VsZCBiZSBhIHJhZ2UgZ2VuZXJhdGluZyBldmVudCwgYnV0IFRPRE86IG5lZWQgdG8gYWNjb3VudCBmb3IgbGF0ZW5jeSwgcmVhY3Rpb24gdGltZSAoYnV0dG9uIG1hc2hpbmcpXG4gICAgICAgIGNvbnN0IHdhaXRpbmdGb3JUaW1lID0gdGhpcy5jaG9vc2VBY3Rpb24odGhpcy5wbGF5ZXIsIHRoaXMuZHVyYXRpb24sIHRoaXMuZmlnaHRMZW5ndGgpO1xuXG4gICAgICAgIGxldCBuZXh0U3dpbmdUaW1lID0gdGhpcy5wbGF5ZXIubWghLm5leHRTd2luZ1RpbWU7XG5cbiAgICAgICAgaWYgKHRoaXMucGxheWVyLm9oKSB7XG4gICAgICAgICAgICBuZXh0U3dpbmdUaW1lID0gTWF0aC5taW4obmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIub2gubmV4dFN3aW5nVGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0ZW1wb3JhcnkgaGFja1xuICAgICAgICBpZiAodGhpcy5wbGF5ZXIuZXh0cmFBdHRhY2tDb3VudCkge1xuICAgICAgICAgICAgLy8gZG9uJ3QgaW5jcmVtZW50IGR1cmF0aW9uIChUT0RPOiBidXQgSSByZWFsbHkgc2hvdWxkIGJlY2F1c2UgdGhlIHNlcnZlciBkb2Vzbid0IGxvb3AgaW5zdGFudGx5KVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGxheWVyLm5leHRHQ0RUaW1lID4gdGhpcy5kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IE1hdGgubWluKHRoaXMucGxheWVyLm5leHRHQ0RUaW1lLCBuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5idWZmTWFuYWdlci5uZXh0T3ZlclRpbWVVcGRhdGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IE1hdGgubWluKG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLm5leHRPdmVyVGltZVVwZGF0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FpdGluZ0ZvclRpbWUgJiYgd2FpdGluZ0ZvclRpbWUgPCB0aGlzLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gd2FpdGluZ0ZvclRpbWU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIFJlYWx0aW1lRmlnaHQgZXh0ZW5kcyBGaWdodCB7XG4gICAgcHJvdGVjdGVkIHBhdXNlZCA9IGZhbHNlO1xuXG4gICAgcnVuKCk6IFByb21pc2U8RmlnaHRSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmLCByKSA9PiB7XG4gICAgICAgICAgICBsZXQgb3ZlcnJpZGVEdXJhdGlvbiA9IDA7XG5cbiAgICAgICAgICAgIGNvbnN0IGxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZHVyYXRpb24gPD0gdGhpcy5maWdodExlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcnJpZGVEdXJhdGlvbiArPSAxMDAwIC8gNjA7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gb3ZlcnJpZGVEdXJhdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUobG9vcCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZih7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYW1hZ2VEb25lOiB0aGlzLnBsYXllci5kYW1hZ2VEb25lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlnaHRMZW5ndGg6IHRoaXMuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3dlckxvc3Q6IHRoaXMucGxheWVyLnBvd2VyTG9zdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUobG9vcCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLnBhdXNlZCA9ICF0aGlzLnBhdXNlZDtcbiAgICB9XG59XG5cbmV4cG9ydCB0eXBlIEZpZ2h0UmVzdWx0ID0geyBkYW1hZ2VEb25lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXIsIHBvd2VyTG9zdDogbnVtYmVyfTtcblxuZXhwb3J0IGNsYXNzIFNpbXVsYXRpb24ge1xuICAgIHJhY2U6IFJhY2U7XG4gICAgc3RhdHM6IFN0YXRWYWx1ZXM7XG4gICAgZXF1aXBtZW50OiBJdGVtV2l0aFNsb3RbXTtcbiAgICBidWZmczogQnVmZltdO1xuICAgIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uO1xuICAgIHByb3RlY3RlZCBmaWdodExlbmd0aDogbnVtYmVyO1xuICAgIHByb3RlY3RlZCByZWFsdGltZTogYm9vbGVhbjtcbiAgICBsb2c/OiBMb2dGdW5jdGlvblxuXG4gICAgcHJvdGVjdGVkIHJlcXVlc3RTdG9wID0gZmFsc2U7XG4gICAgcHJvdGVjdGVkIHBhdXNlZCA9IGZhbHNlO1xuXG4gICAgZmlnaHRSZXN1bHRzOiBGaWdodFJlc3VsdFtdID0gW107XG5cbiAgICBjdXJyZW50RmlnaHQ/OiBGaWdodDtcblxuICAgIGNvbnN0cnVjdG9yKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBlcXVpcG1lbnQ6IEl0ZW1XaXRoU2xvdFtdLCBidWZmczogQnVmZltdLCBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbiwgZmlnaHRMZW5ndGggPSA2MCwgcmVhbHRpbWUgPSBmYWxzZSwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5yYWNlID0gcmFjZTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IHN0YXRzO1xuICAgICAgICB0aGlzLmVxdWlwbWVudCA9IGVxdWlwbWVudDtcbiAgICAgICAgdGhpcy5idWZmcyA9IGJ1ZmZzO1xuICAgICAgICB0aGlzLmNob29zZUFjdGlvbiA9IGNob29zZUFjdGlvbjtcbiAgICAgICAgdGhpcy5maWdodExlbmd0aCA9IGZpZ2h0TGVuZ3RoO1xuICAgICAgICB0aGlzLnJlYWx0aW1lID0gcmVhbHRpbWU7XG4gICAgICAgIHRoaXMubG9nID0gbG9nO1xuICAgIH1cblxuICAgIGdldCBzdGF0dXMoKSB7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkRmlnaHRSZXN1bHRzID0gdGhpcy5maWdodFJlc3VsdHMucmVkdWNlKChhY2M6IEZpZ2h0UmVzdWx0LCBjdXJyZW50KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGRhbWFnZURvbmU6IGFjYy5kYW1hZ2VEb25lICsgY3VycmVudC5kYW1hZ2VEb25lLFxuICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiBhY2MuZmlnaHRMZW5ndGggKyBjdXJyZW50LmZpZ2h0TGVuZ3RoLFxuICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogYWNjLnBvd2VyTG9zdCArIGN1cnJlbnQucG93ZXJMb3N0LFxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB7XG4gICAgICAgICAgICBkYW1hZ2VEb25lOiAwLFxuICAgICAgICAgICAgZmlnaHRMZW5ndGg6IDAsXG4gICAgICAgICAgICBwb3dlckxvc3Q6IDBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHRoaXMucmVhbHRpbWUgJiYgdGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIGNvbWJpbmVkRmlnaHRSZXN1bHRzLmRhbWFnZURvbmUgKz0gdGhpcy5jdXJyZW50RmlnaHQucGxheWVyLmRhbWFnZURvbmU7XG4gICAgICAgICAgICBjb21iaW5lZEZpZ2h0UmVzdWx0cy5maWdodExlbmd0aCArPSB0aGlzLmN1cnJlbnRGaWdodC5kdXJhdGlvbjtcbiAgICAgICAgICAgIGNvbWJpbmVkRmlnaHRSZXN1bHRzLnBvd2VyTG9zdCArPSB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIucG93ZXJMb3N0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGRhbWFnZURvbmU6IGNvbWJpbmVkRmlnaHRSZXN1bHRzLmRhbWFnZURvbmUsXG4gICAgICAgICAgICBkdXJhdGlvbjogY29tYmluZWRGaWdodFJlc3VsdHMuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICBmaWdodHM6IHRoaXMuZmlnaHRSZXN1bHRzLmxlbmd0aCxcbiAgICAgICAgICAgIHBvd2VyTG9zdDogY29tYmluZWRGaWdodFJlc3VsdHMucG93ZXJMb3N0LFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhcnQoKSB7XG4gICAgICAgIGNvbnN0IGZpZ2h0Q2xhc3MgPSB0aGlzLnJlYWx0aW1lID8gUmVhbHRpbWVGaWdodCA6IEZpZ2h0O1xuXG4gICAgICAgIGNvbnN0IG91dGVybG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAxMDAwKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICAgICAgICAgIGNvbnN0IGlubmVybG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY291bnQgPiAxMDApIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChvdXRlcmxvb3AsIDApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQgPSBuZXcgZmlnaHRDbGFzcyh0aGlzLnJhY2UsIHRoaXMuc3RhdHMsIHRoaXMuZXF1aXBtZW50LCB0aGlzLmJ1ZmZzLCB0aGlzLmNob29zZUFjdGlvbiwgdGhpcy5maWdodExlbmd0aCwgdGhpcy5yZWFsdGltZSA/IHRoaXMubG9nIDogdW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodC5ydW4oKS50aGVuKChyZXMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maWdodFJlc3VsdHMucHVzaChyZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICBpbm5lcmxvb3AoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoIXRoaXMucmVxdWVzdFN0b3ApIHtcbiAgICAgICAgICAgICAgICBpbm5lcmxvb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBvdXRlcmxvb3AoKTtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSAhdGhpcy5wYXVzZWQ7XG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRGaWdodCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQucGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMucmVxdWVzdFN0b3AgPSB0cnVlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFdhcnJpb3IgfSBmcm9tIFwiLi93YXJyaW9yXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW1cIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllclwiO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDaG9vc2VBY3Rpb24oaGVyb2ljU3RyaWtlUmFnZVJlcTogbnVtYmVyLCBoYW1zdHJpbmdSYWdlUmVxOiBudW1iZXIpIHtcbiAgICByZXR1cm4gKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXIpOiBudW1iZXJ8dW5kZWZpbmVkID0+IHtcbiAgICAgICAgY29uc3Qgd2FycmlvciA9IDxXYXJyaW9yPnBsYXllcjtcbiAgICBcbiAgICAgICAgY29uc3QgdGltZVJlbWFpbmluZ1NlY29uZHMgPSAoZmlnaHRMZW5ndGggLSB0aW1lKSAvIDEwMDA7XG4gICAgXG4gICAgICAgIGNvbnN0IHVzZUl0ZW1CeU5hbWUgPSAoc2xvdDogSXRlbVNsb3QsIG5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgY29uc3QgaXRlbSA9IHBsYXllci5pdGVtcy5nZXQoc2xvdCk7XG4gICAgICAgICAgICBpZiAoaXRlbSAmJiBpdGVtLml0ZW0ubmFtZSA9PT0gbmFtZSAmJiBpdGVtLm9udXNlICYmIGl0ZW0ub251c2UuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpdGVtLm9udXNlLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgaWYgKHdhcnJpb3IucmFnZSA8IDMwICYmIHdhcnJpb3IuYmxvb2RSYWdlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHdhcnJpb3IuYmxvb2RSYWdlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgbGV0IHdhaXRpbmdGb3JUaW1lOiBudW1iZXJ8dW5kZWZpbmVkO1xuICAgIFxuICAgICAgICAvLyBnY2Qgc3BlbGxzXG4gICAgICAgIGlmICh3YXJyaW9yLm5leHRHQ0RUaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgIGlmICh0aW1lUmVtYWluaW5nU2Vjb25kcyA8PSAzMCAmJiB3YXJyaW9yLmRlYXRoV2lzaC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICAgICAgd2Fycmlvci5kZWF0aFdpc2guY2FzdCh0aW1lKTtcbiAgICAgICAgICAgICAgICB1c2VJdGVtQnlOYW1lKEl0ZW1TbG90LlRSSU5LRVQxLCBcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIpO1xuICAgICAgICAgICAgICAgIHVzZUl0ZW1CeU5hbWUoSXRlbVNsb3QuVFJJTktFVDIsIFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC50aW1lUmVtYWluaW5nKHRpbWUpIDwgMS41ICsgKHdhcnJpb3IubGF0ZW5jeSAvIDEwMDApKSB7XG4gICAgICAgICAgICAgICAgLy8gbm90IG9yIGFsbW9zdCBvZmYgY29vbGRvd24sIHdhaXQgZm9yIHJhZ2Ugb3IgY29vbGRvd25cbiAgICAgICAgICAgICAgICBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC5jb29sZG93biA+IHRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSB3YXJyaW9yLmJsb29kdGhpcnN0LmNvb2xkb3duO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci53aGlybHdpbmQuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgICAgIHdhcnJpb3Iud2hpcmx3aW5kLmNhc3QodGltZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLnRpbWVSZW1haW5pbmcodGltZSkgPCAxLjUgKyAod2Fycmlvci5sYXRlbmN5IC8gMTAwMCkpIHtcbiAgICAgICAgICAgICAgICAvLyBub3Qgb3IgYWxtb3N0IG9mZiBjb29sZG93biwgd2FpdCBmb3IgcmFnZSBvciBjb29sZG93blxuICAgICAgICAgICAgICAgIGlmICh3YXJyaW9yLndoaXJsd2luZC5jb29sZG93biA+IHRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSB3YXJyaW9yLndoaXJsd2luZC5jb29sZG93bjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IucmFnZSA+PSBoYW1zdHJpbmdSYWdlUmVxICYmIHdhcnJpb3IuaGFtc3RyaW5nLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgICAgICB3YXJyaW9yLmhhbXN0cmluZy5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXG4gICAgICAgIGlmICh3YXJyaW9yLnJhZ2UgPj0gaGVyb2ljU3RyaWtlUmFnZVJlcSAmJiAhd2Fycmlvci5xdWV1ZWRTcGVsbCkge1xuICAgICAgICAgICAgd2Fycmlvci5xdWV1ZWRTcGVsbCA9IHdhcnJpb3IuaGVyb2ljU3RyaWtlO1xuICAgICAgICAgICAgaWYgKHdhcnJpb3IubG9nKSB3YXJyaW9yLmxvZyh0aW1lLCAncXVldWVpbmcgaGVyb2ljIHN0cmlrZScpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHJldHVybiB3YWl0aW5nRm9yVGltZTtcbiAgICB9O1xufVxuIiwiaW1wb3J0IHsgIE1haW5UaHJlYWRJbnRlcmZhY2UgfSBmcm9tIFwiLi93b3JrZXJfZXZlbnRfaW50ZXJmYWNlLmpzXCI7XG5pbXBvcnQgeyBTaW11bGF0aW9uIH0gZnJvbSBcIi4vc2ltdWxhdGlvbi5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbkRlc2NyaXB0aW9uLCBidWZmSW5kaWNlc1RvQnVmZiwgZXF1aXBtZW50SW5kaWNlc1RvSXRlbSB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZUNob29zZUFjdGlvbiB9IGZyb20gXCIuL3dhcnJpb3JfYWkuanNcIjtcblxuY29uc3QgbWFpblRocmVhZEludGVyZmFjZSA9IE1haW5UaHJlYWRJbnRlcmZhY2UuaW5zdGFuY2U7XG5cbmxldCBjdXJyZW50U2ltOiBTaW11bGF0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxubWFpblRocmVhZEludGVyZmFjZS5hZGRFdmVudExpc3RlbmVyKCdzaW11bGF0ZScsIChkYXRhOiBhbnkpID0+IHtcbiAgICBjb25zdCBzaW1kZXNjID0gPFNpbXVsYXRpb25EZXNjcmlwdGlvbj5kYXRhO1xuXG4gICAgbGV0IGxvZ0Z1bmN0aW9uOiBMb2dGdW5jdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoc2ltZGVzYy5yZWFsdGltZSkge1xuICAgICAgICBsb2dGdW5jdGlvbiA9ICh0aW1lOiBudW1iZXIsIHRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdsb2cnLCB7XG4gICAgICAgICAgICAgICAgdGltZTogdGltZSxcbiAgICAgICAgICAgICAgICB0ZXh0OiB0ZXh0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjdXJyZW50U2ltID0gbmV3IFNpbXVsYXRpb24oc2ltZGVzYy5yYWNlLCBzaW1kZXNjLnN0YXRzLFxuICAgICAgICBlcXVpcG1lbnRJbmRpY2VzVG9JdGVtKHNpbWRlc2MuZXF1aXBtZW50KSxcbiAgICAgICAgYnVmZkluZGljZXNUb0J1ZmYoc2ltZGVzYy5idWZmcyksXG4gICAgICAgIGdlbmVyYXRlQ2hvb3NlQWN0aW9uKHNpbWRlc2MuaGVyb2ljU3RyaWtlUmFnZVJlcSwgc2ltZGVzYy5oYW1zdHJpbmdSYWdlUmVxKSxcbiAgICAgICAgc2ltZGVzYy5maWdodExlbmd0aCwgc2ltZGVzYy5yZWFsdGltZSwgbG9nRnVuY3Rpb24pO1xuXG4gICAgY3VycmVudFNpbS5zdGFydCgpO1xuXG4gICAgc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBtYWluVGhyZWFkSW50ZXJmYWNlLnNlbmQoJ3N0YXR1cycsIGN1cnJlbnRTaW0hLnN0YXR1cyk7XG4gICAgfSwgMTAwMCk7XG59KTtcblxubWFpblRocmVhZEludGVyZmFjZS5hZGRFdmVudExpc3RlbmVyKCdwYXVzZScsICgpID0+IHtcbiAgICBpZiAoY3VycmVudFNpbSkge1xuICAgICAgICBjdXJyZW50U2ltLnBhdXNlKCk7XG4gICAgfVxufSk7XG4iXSwibmFtZXMiOltdLCJt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
