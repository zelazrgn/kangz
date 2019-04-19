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
        this.flurryCount = 0;
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
            this.flurryCount = Math.max(0, this.flurryCount - 1);
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
        name: "Warchief's Blessing",
        duration: 1 * 60 * 60,
        stats: {
            haste: 1.15
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
        name: "Fengus' Ferocity",
        duration: 2 * 60 * 60,
        stats: {
            ap: 200
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
        name: "Conqueror's Breastplate",
        slot: ItemSlot.CHEST,
        stats: { str: 20, agi: 16, hit: 1 }
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

function chooseAction(player, time, fightLength) {
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
        else if (warrior.rage >= 50 && warrior.hamstring.canCast(time)) {
            warrior.hamstring.cast(time);
        }
    }
    if (warrior.rage >= 60 && !warrior.queuedSpell) {
        warrior.queuedSpell = warrior.heroicStrike;
        if (warrior.log)
            warrior.log(time, 'queueing heroic strike');
    }
    return waitingForTime;
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
    currentSim = new Simulation(simdesc.race, simdesc.stats, equipmentIndicesToItem(simdesc.equipment), buffIndicesToBuff(simdesc.buffs), chooseAction, simdesc.fightLength, simdesc.realtime, logFunction);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3BlbGwudHMiLCIuLi9zcmMvaXRlbS50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL3NwZWxscy50cyIsIi4uL3NyYy9kYXRhL2l0ZW1zLnRzIiwiLi4vc3JjL3NpbXVsYXRpb25fdXRpbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbi50cyIsIi4uL3NyYy93YXJyaW9yX2FpLnRzIiwiLi4vc3JjL3J1bl9zaW11bGF0aW9uX3dvcmtlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFdvcmtlckV2ZW50TGlzdGVuZXIgPSAoZGF0YTogYW55KSA9PiB2b2lkO1xuXG5jbGFzcyBXb3JrZXJFdmVudEludGVyZmFjZSB7XG4gICAgZXZlbnRMaXN0ZW5lcnM6IE1hcDxzdHJpbmcsIFdvcmtlckV2ZW50TGlzdGVuZXJbXT4gPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3Rvcih0YXJnZXQ6IGFueSkge1xuICAgICAgICB0YXJnZXQub25tZXNzYWdlID0gKGV2OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldi5kYXRhLmV2ZW50KSB8fCBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcihldi5kYXRhLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IFdvcmtlckV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRMaXN0ZW5lcnMuaGFzKGV2ZW50KSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpIS5wdXNoKGxpc3RlbmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMuc2V0KGV2ZW50LCBbbGlzdGVuZXJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFdlYXBvbkRlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3BlbGwge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICB0eXBlOiBTcGVsbFR5cGU7XG4gICAgaXNfZ2NkOiBib29sZWFuO1xuICAgIGNvc3Q6IG51bWJlcjtcbiAgICBjb29sZG93bjogbnVtYmVyO1xuICAgIHByb3RlY3RlZCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB0eXBlOiBTcGVsbFR5cGUsIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyLCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuY29zdCA9IGNvc3Q7XG4gICAgICAgIHRoaXMuY29vbGRvd24gPSBjb29sZG93bjtcbiAgICAgICAgdGhpcy5pc19nY2QgPSBpc19nY2Q7XG4gICAgICAgIHRoaXMuc3BlbGxGID0gc3BlbGxGO1xuICAgIH1cblxuICAgIGNhc3QocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gdGhpcy5zcGVsbEYocGxheWVyLCB0aW1lKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3BlbGwge1xuICAgIHNwZWxsOiBTcGVsbDtcbiAgICBjb29sZG93biA9IDA7XG4gICAgY2FzdGVyOiBQbGF5ZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuc3BlbGwgPSBzcGVsbDtcbiAgICAgICAgdGhpcy5jYXN0ZXIgPSBjYXN0ZXI7XG4gICAgfVxuXG4gICAgb25Db29sZG93bih0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29vbGRvd24gPiB0aW1lO1xuICAgIH1cblxuICAgIHRpbWVSZW1haW5pbmcodGltZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCAodGhpcy5jb29sZG93biAtIHRpbWUpIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgY2FuQ2FzdCh0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkICYmIHRoaXMuY2FzdGVyLm5leHRHQ0RUaW1lID4gdGltZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuY29zdCA+IHRoaXMuY2FzdGVyLnBvd2VyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vbkNvb2xkb3duKHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjYXN0KHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkKSB7XG4gICAgICAgICAgICB0aGlzLmNhc3Rlci5uZXh0R0NEVGltZSA9IHRpbWUgKyAxNTAwICsgdGhpcy5jYXN0ZXIubGF0ZW5jeTsgLy8gVE9ETyAtIG5lZWQgdG8gc3R1ZHkgdGhlIGVmZmVjdHMgb2YgbGF0ZW5jeSBpbiB0aGUgZ2FtZSBhbmQgY29uc2lkZXIgaHVtYW4gcHJlY2lzaW9uXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuY2FzdGVyLnBvd2VyIC09IHRoaXMuc3BlbGwuY29zdDtcblxuICAgICAgICB0aGlzLnNwZWxsLmNhc3QodGhpcy5jYXN0ZXIsIHRpbWUpO1xuXG4gICAgICAgIHRoaXMuY29vbGRvd24gPSB0aW1lICsgdGhpcy5zcGVsbC5jb29sZG93biAqIDEwMDAgKyB0aGlzLmNhc3Rlci5sYXRlbmN5O1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aW5nU3BlbGwgZXh0ZW5kcyBTcGVsbCB7XG4gICAgYm9udXNEYW1hZ2U6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgYm9udXNEYW1hZ2U6IG51bWJlciwgY29zdDogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIGZhbHNlLCBjb3N0LCAwLCAoKSA9PiB7fSk7XG4gICAgICAgIHRoaXMuYm9udXNEYW1hZ2UgPSBib251c0RhbWFnZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3dpbmdTcGVsbCBleHRlbmRzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFN3aW5nU3BlbGw7XG4gICAgXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFN3aW5nU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyKHNwZWxsLCBjYXN0ZXIpO1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7IC8vIFRPRE8gLSBpcyB0aGVyZSBhIHdheSB0byBhdm9pZCB0aGlzIGxpbmU/XG4gICAgfVxufVxuXG5leHBvcnQgZW51bSBTcGVsbFR5cGUge1xuICAgIE5PTkUsXG4gICAgQlVGRixcbiAgICBQSFlTSUNBTCxcbiAgICBQSFlTSUNBTF9XRUFQT04sXG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsIHtcbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSwgaXNfZ2NkOiBib29sZWFuLCBjb3N0OiBudW1iZXIsIGNvb2xkb3duOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgdHlwZSwgaXNfZ2NkLCBjb3N0LCBjb29sZG93biwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRtZyA9ICh0eXBlb2YgYW1vdW50ID09PSBcIm51bWJlclwiKSA/IGFtb3VudCA6IGFtb3VudChwbGF5ZXIpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gU3BlbGxUeXBlLlBIWVNJQ0FMIHx8IHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPIC0gZG8gcHJvY3MgbGlrZSBmYXRhbCB3b3VuZHMgKHZpcydrYWcpIGFjY291bnQgZm9yIHdlYXBvbiBza2lsbD9cbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZTIgZXh0ZW5kcyBTcGVsbERhbWFnZSB7XG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlciwgdHlwZTogU3BlbGxUeXBlKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGFtb3VudCwgdHlwZSwgZmFsc2UsIDAsIDApO1xuICAgIH1cbn1cblxuY29uc3QgZmF0YWxXb3VuZHMgPSBuZXcgU3BlbGxEYW1hZ2UyKFwiRmF0YWwgV291bmRzXCIsIDI0MCwgU3BlbGxUeXBlLlBIWVNJQ0FMKTtcblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikge1xuICAgICAgICAvLyBzcGVsbHR5cGUgZG9lc24ndCBtYXR0ZXJcbiAgICAgICAgc3VwZXIobmFtZSwgU3BlbGxUeXBlLk5PTkUsIGZhbHNlLCAwLCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGxheWVyLmV4dHJhQXR0YWNrQ291bnQgKz0gY291bnQ7IC8vIExIIGNvZGUgZG9lcyBub3QgYWxsb3cgbXVsdGlwbGUgYXV0byBhdHRhY2tzIHRvIHN0YWNrIGlmIHRoZXkgcHJvYyB0b2dldGhlci4gQmxpenpsaWtlIG1heSBhbGxvdyB0aGVtIHRvIHN0YWNrIFxuICAgICAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYEdhaW5lZCAke2NvdW50fSBleHRyYSBhdHRhY2tzIGZyb20gJHtuYW1lfWApO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbEJ1ZmYgZXh0ZW5kcyBTcGVsbCB7XG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgaXNfZ2NkPzogYm9vbGVhbiwgY29zdD86IG51bWJlciwgY29vbGRvd24/OiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoYFNwZWxsQnVmZigke2J1ZmYubmFtZX0pYCwgU3BlbGxUeXBlLkJVRkYsICEhaXNfZ2NkLCBjb3N0IHx8IDAsIGNvb2xkb3duIHx8IDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJ1ZmYsIHRpbWUpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbnR5cGUgcHBtID0ge3BwbTogbnVtYmVyfTtcbnR5cGUgY2hhbmNlID0ge2NoYW5jZTogbnVtYmVyfTtcbnR5cGUgcmF0ZSA9IHBwbSB8IGNoYW5jZTtcblxuZXhwb3J0IGNsYXNzIFByb2Mge1xuICAgIHByb3RlY3RlZCBzcGVsbHM6IFNwZWxsW107XG4gICAgcHJvdGVjdGVkIHJhdGU6IHJhdGU7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwgfCBTcGVsbFtdLCByYXRlOiByYXRlKSB7XG4gICAgICAgIHRoaXMuc3BlbGxzID0gQXJyYXkuaXNBcnJheShzcGVsbCkgPyBzcGVsbCA6IFtzcGVsbF07XG4gICAgICAgIHRoaXMucmF0ZSA9IHJhdGU7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2hhbmNlID0gKDxjaGFuY2U+dGhpcy5yYXRlKS5jaGFuY2UgfHwgKDxwcG0+dGhpcy5yYXRlKS5wcG0gKiB3ZWFwb24uc3BlZWQgLyA2MDtcblxuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8PSBjaGFuY2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IHNwZWxsIG9mIHRoaXMuc3BlbGxzKSB7XG4gICAgICAgICAgICAgICAgc3BlbGwuY2FzdChwbGF5ZXIsIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFByb2MsIFNwZWxsLCBMZWFybmVkU3BlbGwgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgZW51bSBJdGVtU2xvdCB7XG4gICAgTUFJTkhBTkQgPSAxIDw8IDAsXG4gICAgT0ZGSEFORCA9IDEgPDwgMSxcbiAgICBUUklOS0VUMSA9IDEgPDwgMixcbiAgICBUUklOS0VUMiA9IDEgPDwgMyxcbiAgICBIRUFEID0gMSA8PCA0LFxuICAgIE5FQ0sgPSAxIDw8IDUsXG4gICAgU0hPVUxERVIgPSAxIDw8IDYsXG4gICAgQkFDSyA9IDEgPDwgNyxcbiAgICBDSEVTVCA9IDEgPDwgOCxcbiAgICBXUklTVCA9IDEgPDwgOSxcbiAgICBIQU5EUyA9IDEgPDwgMTAsXG4gICAgV0FJU1QgPSAxIDw8IDExLFxuICAgIExFR1MgPSAxIDw8IDEyLFxuICAgIEZFRVQgPSAxIDw8IDEzLFxuICAgIFJJTkcxID0gMSA8PCAxNCxcbiAgICBSSU5HMiA9IDEgPDwgMTUsXG4gICAgUkFOR0VEID0gMSA8PCAxNixcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJdGVtRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzbG90OiBJdGVtU2xvdCxcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG4gICAgb251c2U/OiBTcGVsbCxcbiAgICBvbmVxdWlwPzogUHJvYyxcbn1cblxuZXhwb3J0IGVudW0gV2VhcG9uVHlwZSB7XG4gICAgTUFDRSxcbiAgICBTV09SRCxcbiAgICBBWEUsXG4gICAgREFHR0VSLFxuICAgIE1BQ0UySCxcbiAgICBTV09SRDJILFxuICAgIEFYRTJILFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFdlYXBvbkRlc2NyaXB0aW9uIGV4dGVuZHMgSXRlbURlc2NyaXB0aW9uIHtcbiAgICB0eXBlOiBXZWFwb25UeXBlLFxuICAgIG1pbjogbnVtYmVyLFxuICAgIG1heDogbnVtYmVyLFxuICAgIHNwZWVkOiBudW1iZXIsXG4gICAgb25oaXQ/OiBQcm9jLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNXZWFwb24oaXRlbTogSXRlbURlc2NyaXB0aW9uKTogaXRlbSBpcyBXZWFwb25EZXNjcmlwdGlvbiB7XG4gICAgcmV0dXJuIFwic3BlZWRcIiBpbiBpdGVtO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFcXVpcGVkV2VhcG9uKGl0ZW06IEl0ZW1FcXVpcGVkKTogaXRlbSBpcyBXZWFwb25FcXVpcGVkIHtcbiAgICByZXR1cm4gXCJ3ZWFwb25cIiBpbiBpdGVtO1xufVxuXG5leHBvcnQgY2xhc3MgSXRlbUVxdWlwZWQge1xuICAgIGl0ZW06IEl0ZW1EZXNjcmlwdGlvbjtcbiAgICBvbnVzZT86IExlYXJuZWRTcGVsbDtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5pdGVtID0gaXRlbTtcblxuICAgICAgICBpZiAoaXRlbS5vbnVzZSkge1xuICAgICAgICAgICAgdGhpcy5vbnVzZSA9IG5ldyBMZWFybmVkU3BlbGwoaXRlbS5vbnVzZSwgcGxheWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLm9uZXF1aXApIHsgLy8gVE9ETywgbW92ZSB0aGlzIHRvIGJ1ZmZwcm9jPyB0aGlzIG1heSBiZSBzaW1wbGVyIHRob3VnaCBzaW5jZSB3ZSBrbm93IHRoZSBidWZmIHdvbid0IGJlIHJlbW92ZWRcbiAgICAgICAgICAgIHBsYXllci5hZGRQcm9jKGl0ZW0ub25lcXVpcCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1c2UodGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aGlzLm9udXNlKSB7XG4gICAgICAgICAgICB0aGlzLm9udXNlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wb3JhcnlXZWFwb25FbmNoYW50IHtcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXM7XG4gICAgcHJvYz86IFByb2M7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0cz86IFN0YXRWYWx1ZXMsIHByb2M/OiBQcm9jKSB7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5wcm9jID0gcHJvYztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXZWFwb25FcXVpcGVkIGV4dGVuZHMgSXRlbUVxdWlwZWQge1xuICAgIHdlYXBvbjogV2VhcG9uRGVzY3JpcHRpb247XG4gICAgbmV4dFN3aW5nVGltZTogbnVtYmVyO1xuICAgIHByb2NzOiBQcm9jW10gPSBbXTtcbiAgICBwbGF5ZXI6IFBsYXllcjtcbiAgICB0ZW1wb3JhcnlFbmNoYW50PzogVGVtcG9yYXJ5V2VhcG9uRW5jaGFudDtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IFdlYXBvbkRlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlcihpdGVtLCBwbGF5ZXIpO1xuICAgICAgICB0aGlzLndlYXBvbiA9IGl0ZW07XG4gICAgICAgIFxuICAgICAgICBpZiAoaXRlbS5vbmhpdCkge1xuICAgICAgICAgICAgdGhpcy5hZGRQcm9jKGl0ZW0ub25oaXQpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcblxuICAgICAgICB0aGlzLm5leHRTd2luZ1RpbWUgPSAxMDA7IC8vIFRPRE8gLSBuZWVkIHRvIHJlc2V0IHRoaXMgcHJvcGVybHkgaWYgZXZlciB3YW50IHRvIHNpbXVsYXRlIGZpZ2h0cyB3aGVyZSB5b3UgcnVuIG91dFxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0IHBsdXNEYW1hZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnRlbXBvcmFyeUVuY2hhbnQgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5wbHVzRGFtYWdlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLnBsdXNEYW1hZ2VcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2VhcG9uLm1pbiArIHRoaXMucGx1c0RhbWFnZTtcbiAgICB9XG5cbiAgICBnZXQgbWF4KCkge1xuICAgICAgICByZXR1cm4gdGhpcy53ZWFwb24ubWF4ICsgdGhpcy5wbHVzRGFtYWdlO1xuICAgIH1cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcHJvYyh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgcHJvYyBvZiB0aGlzLnByb2NzKSB7XG4gICAgICAgICAgICBwcm9jLnJ1bih0aGlzLnBsYXllciwgdGhpcy53ZWFwb24sIHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2luZGZ1cnkgcHJvY3MgbGFzdFxuICAgICAgICBpZiAodGhpcy50ZW1wb3JhcnlFbmNoYW50ICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5wcm9jKSB7XG4gICAgICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnQucHJvYy5ydW4odGhpcy5wbGF5ZXIsIHRoaXMud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiB1cmFuZChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbWluICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZnJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wKHZhbDogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heChtaW4sIHZhbCkpO1xufVxuXG5jb25zdCBERUJVR0dJTkcgPSBmYWxzZTtcblxuaWYgKERFQlVHR0lORykge1xuICAgIC8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL21hdGhpYXNieW5lbnMvNTY3MDkxNyNmaWxlLWRldGVybWluaXN0aWMtbWF0aC1yYW5kb20tanNcbiAgICBNYXRoLnJhbmRvbSA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlZWQgPSAweDJGNkUyQjE7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vIFJvYmVydCBKZW5raW5z4oCZIDMyIGJpdCBpbnRlZ2VyIGhhc2ggZnVuY3Rpb25cbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDdFRDU1RDE2KSArIChzZWVkIDw8IDEyKSkgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEM3NjFDMjNDKSBeIChzZWVkID4+PiAxOSkpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDE2NTY2N0IxKSArIChzZWVkIDw8IDUpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEQzQTI2NDZDKSBeIChzZWVkIDw8IDkpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEZENzA0NkM1KSArIChzZWVkIDw8IDMpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEI1NUE0RjA5KSBeIChzZWVkID4+PiAxNikpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHJldHVybiAoc2VlZCAmIDB4RkZGRkZGRikgLyAweDEwMDAwMDAwO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG59XG4iLCJpbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgVW5pdCB7XG4gICAgbGV2ZWw6IG51bWJlcjtcbiAgICBhcm1vcjogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IobGV2ZWw6IG51bWJlciwgYXJtb3I6IG51bWJlcikge1xuICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgIHRoaXMuYXJtb3IgPSBhcm1vcjtcbiAgICB9XG5cbiAgICBnZXQgbWF4U2tpbGxGb3JMZXZlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiA1O1xuICAgIH1cblxuICAgIGdldCBkZWZlbnNlU2tpbGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgfVxuXG4gICAgZ2V0IGRvZGdlQ2hhbmNlKCkge1xuICAgICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVBcm1vclJlZHVjZWREYW1hZ2UoZGFtYWdlOiBudW1iZXIsIGF0dGFja2VyOiBQbGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYXJtb3IgPSBNYXRoLm1heCgwLCB0aGlzLmFybW9yIC0gYXR0YWNrZXIuYnVmZk1hbmFnZXIuc3RhdHMuYXJtb3JQZW5ldHJhdGlvbik7XG4gICAgICAgIFxuICAgICAgICBsZXQgdG1wdmFsdWUgPSAwLjEgKiBhcm1vciAgLyAoKDguNSAqIGF0dGFja2VyLmxldmVsKSArIDQwKTtcbiAgICAgICAgdG1wdmFsdWUgLz0gKDEgKyB0bXB2YWx1ZSk7XG5cbiAgICAgICAgY29uc3QgYXJtb3JNb2RpZmllciA9IGNsYW1wKHRtcHZhbHVlLCAwLCAwLjc1KTtcblxuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMSwgZGFtYWdlIC0gKGRhbWFnZSAqIGFybW9yTW9kaWZpZXIpKTtcbiAgICB9XG59XG4iLCJleHBvcnQgaW50ZXJmYWNlIFN0YXRWYWx1ZXMge1xuICAgIGFwPzogbnVtYmVyO1xuICAgIHN0cj86IG51bWJlcjtcbiAgICBhZ2k/OiBudW1iZXI7XG4gICAgaGl0PzogbnVtYmVyO1xuICAgIGNyaXQ/OiBudW1iZXI7XG4gICAgaGFzdGU/OiBudW1iZXI7XG4gICAgc3RhdE11bHQ/OiBudW1iZXI7XG4gICAgZGFtYWdlTXVsdD86IG51bWJlcjtcbiAgICBhcm1vclBlbmV0cmF0aW9uPzogbnVtYmVyO1xuICAgIHBsdXNEYW1hZ2U/OiBudW1iZXI7XG5cbiAgICBzd29yZFNraWxsPzogbnVtYmVyO1xuICAgIGF4ZVNraWxsPzogbnVtYmVyO1xuICAgIG1hY2VTa2lsbD86IG51bWJlcjtcbiAgICBkYWdnZXJTa2lsbD86IG51bWJlcjtcbiAgICBzd29yZDJIU2tpbGw/OiBudW1iZXI7XG4gICAgYXhlMkhTa2lsbD86IG51bWJlcjtcbiAgICBtYWNlMkhTa2lsbD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFN0YXRzIGltcGxlbWVudHMgU3RhdFZhbHVlcyB7XG4gICAgYXAhOiBudW1iZXI7XG4gICAgc3RyITogbnVtYmVyO1xuICAgIGFnaSE6IG51bWJlcjtcbiAgICBoaXQhOiBudW1iZXI7XG4gICAgY3JpdCE6IG51bWJlcjtcbiAgICBoYXN0ZSE6IG51bWJlcjtcbiAgICBzdGF0TXVsdCE6IG51bWJlcjtcbiAgICBkYW1hZ2VNdWx0ITogbnVtYmVyO1xuICAgIGFybW9yUGVuZXRyYXRpb24hOiBudW1iZXI7XG4gICAgcGx1c0RhbWFnZSE6IG51bWJlcjtcblxuICAgIHN3b3JkU2tpbGwhOiBudW1iZXI7XG4gICAgYXhlU2tpbGwhOiBudW1iZXI7XG4gICAgbWFjZVNraWxsITogbnVtYmVyO1xuICAgIGRhZ2dlclNraWxsITogbnVtYmVyO1xuICAgIHN3b3JkMkhTa2lsbCE6IG51bWJlcjtcbiAgICBheGUySFNraWxsITogbnVtYmVyO1xuICAgIG1hY2UySFNraWxsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3Iocz86IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5zZXQocyk7XG4gICAgfVxuXG4gICAgc2V0KHM/OiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuYXAgPSAocyAmJiBzLmFwKSB8fCAwO1xuICAgICAgICB0aGlzLnN0ciA9IChzICYmIHMuc3RyKSB8fCAwO1xuICAgICAgICB0aGlzLmFnaSA9IChzICYmIHMuYWdpKSB8fCAwO1xuICAgICAgICB0aGlzLmhpdCA9IChzICYmIHMuaGl0KSB8fCAwO1xuICAgICAgICB0aGlzLmNyaXQgPSAocyAmJiBzLmNyaXQpIHx8IDA7XG4gICAgICAgIHRoaXMuaGFzdGUgPSAocyAmJiBzLmhhc3RlKSB8fCAxO1xuICAgICAgICB0aGlzLnN0YXRNdWx0ID0gKHMgJiYgcy5zdGF0TXVsdCkgfHwgMTtcbiAgICAgICAgdGhpcy5kYW1hZ2VNdWx0ID0gKHMgJiYgcy5kYW1hZ2VNdWx0KSB8fCAxO1xuICAgICAgICB0aGlzLmFybW9yUGVuZXRyYXRpb24gPSAocyAmJiBzLmFybW9yUGVuZXRyYXRpb24pIHx8IDA7XG4gICAgICAgIHRoaXMucGx1c0RhbWFnZSA9IChzICYmIHMucGx1c0RhbWFnZSkgfHwgMDtcblxuICAgICAgICB0aGlzLnN3b3JkU2tpbGwgPSAocyAmJiBzLnN3b3JkU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuYXhlU2tpbGwgPSAocyAmJiBzLmF4ZVNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLm1hY2VTa2lsbCA9IChzICYmIHMubWFjZVNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmRhZ2dlclNraWxsID0gKHMgJiYgcy5kYWdnZXJTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5zd29yZDJIU2tpbGwgPSAocyAmJiBzLnN3b3JkMkhTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5heGUySFNraWxsID0gKHMgJiYgcy5heGUySFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLm1hY2UySFNraWxsID0gKHMgJiYgcy5tYWNlMkhTa2lsbCkgfHwgMDtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBhZGQoczogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLmFwICs9IChzLmFwIHx8IDApO1xuICAgICAgICB0aGlzLnN0ciArPSAocy5zdHIgfHwgMCk7XG4gICAgICAgIHRoaXMuYWdpICs9IChzLmFnaSB8fCAwKTtcbiAgICAgICAgdGhpcy5oaXQgKz0gKHMuaGl0IHx8IDApO1xuICAgICAgICB0aGlzLmNyaXQgKz0gKHMuY3JpdCB8fCAwKTtcbiAgICAgICAgdGhpcy5oYXN0ZSAqPSAocy5oYXN0ZSB8fCAxKTtcbiAgICAgICAgdGhpcy5zdGF0TXVsdCAqPSAocy5zdGF0TXVsdCB8fCAxKTtcbiAgICAgICAgdGhpcy5kYW1hZ2VNdWx0ICo9IChzLmRhbWFnZU11bHQgfHwgMSk7XG4gICAgICAgIHRoaXMuYXJtb3JQZW5ldHJhdGlvbiArPSAocy5hcm1vclBlbmV0cmF0aW9uIHx8IDApO1xuICAgICAgICB0aGlzLnBsdXNEYW1hZ2UgKz0gKHMucGx1c0RhbWFnZSB8fCAwKTtcblxuICAgICAgICB0aGlzLnN3b3JkU2tpbGwgKz0gKHMuc3dvcmRTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5heGVTa2lsbCArPSAocy5heGVTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5tYWNlU2tpbGwgKz0gKHMubWFjZVNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmRhZ2dlclNraWxsICs9IChzLmRhZ2dlclNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLnN3b3JkMkhTa2lsbCArPSAocy5zd29yZDJIU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuYXhlMkhTa2lsbCArPSAocy5heGUySFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLm1hY2UySFNraWxsICs9IChzLm1hY2UySFNraWxsIHx8IDApO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFN0YXRzLCBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgUHJvYyB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBCdWZmTWFuYWdlciB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG5cbiAgICBwcml2YXRlIGJ1ZmZMaXN0OiBCdWZmQXBwbGljYXRpb25bXSA9IFtdO1xuICAgIHByaXZhdGUgYnVmZk92ZXJUaW1lTGlzdDogQnVmZk92ZXJUaW1lQXBwbGljYXRpb25bXSA9IFtdO1xuXG4gICAgYmFzZVN0YXRzOiBTdGF0cztcbiAgICBzdGF0czogU3RhdHM7XG5cbiAgICBjb25zdHJ1Y3RvcihwbGF5ZXI6IFBsYXllciwgYmFzZVN0YXRzOiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLmJhc2VTdGF0cyA9IG5ldyBTdGF0cyhiYXNlU3RhdHMpO1xuICAgICAgICB0aGlzLnN0YXRzID0gbmV3IFN0YXRzKHRoaXMuYmFzZVN0YXRzKTtcbiAgICB9XG5cbiAgICBnZXQgbmV4dE92ZXJUaW1lVXBkYXRlKCkge1xuICAgICAgICBsZXQgcmVzID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cbiAgICAgICAgZm9yIChsZXQgYnVmZk9UQXBwIG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgcmVzID0gTWF0aC5taW4ocmVzLCBidWZmT1RBcHAubmV4dFVwZGF0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgLy8gcHJvY2VzcyBsYXN0IHRpY2sgYmVmb3JlIGl0IGlzIHJlbW92ZWRcbiAgICAgICAgZm9yIChsZXQgYnVmZk9UQXBwIG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgYnVmZk9UQXBwLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWUpO1xuXG4gICAgICAgIHRoaXMuc3RhdHMuc2V0KHRoaXMuYmFzZVN0YXRzKTtcblxuICAgICAgICBmb3IgKGxldCB7IGJ1ZmYsIHN0YWNrcyB9IG9mIHRoaXMuYnVmZkxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCB7IGJ1ZmYsIHN0YWNrcyB9IG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgc3RhY2tzID0gYnVmZi5zdGF0c1N0YWNrID8gc3RhY2tzIDogMTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2tzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBidWZmLmFwcGx5KHRoaXMuc3RhdHMsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZChidWZmOiBCdWZmLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCBidWZmQXBwIG9mIHRoaXMuYnVmZkxpc3QpIHtcbiAgICAgICAgICAgIGlmIChidWZmQXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHsgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9nU3RhY2tJbmNyZWFzZSA9IHRoaXMucGxheWVyLmxvZyAmJiAoIWJ1ZmYubWF4U3RhY2tzIHx8IGJ1ZmZBcHAuc3RhY2tzIDwgYnVmZi5tYXhTdGFja3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmLmluaXRpYWxTdGFja3MpIHsgLy8gVE9ETyAtIGNoYW5nZSB0aGlzIHRvIGNoYXJnZXM/XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAuc3RhY2tzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAobG9nU3RhY2tJbmNyZWFzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5ZXIubG9nIShhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gcmVmcmVzaGVkICgke2J1ZmZBcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyhhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gcmVmcmVzaGVkYCk7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAucmVmcmVzaChhcHBseVRpbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IGdhaW5lZGAgKyAoYnVmZi5zdGFja3MgPyBgICgke2J1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxfSlgIDogJycpKTtcblxuICAgICAgICBpZiAoYnVmZiBpbnN0YW5jZW9mIEJ1ZmZPdmVyVGltZSkge1xuICAgICAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0LnB1c2gobmV3IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uKHRoaXMucGxheWVyLCBidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZkxpc3QucHVzaChuZXcgQnVmZkFwcGxpY2F0aW9uKGJ1ZmYsIGFwcGx5VGltZSkpO1xuICAgICAgICB9XG4gICAgICAgIGJ1ZmYuYWRkKGFwcGx5VGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgIH1cblxuICAgIHJlbW92ZShidWZmOiBCdWZmLCB0aW1lOiBudW1iZXIsIGZ1bGwgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZ1bGwgJiYgYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuYnVmZiA9PT0gYnVmZikge1xuICAgICAgICAgICAgICAgIGlmIChidWZmLnN0YWNrcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmYXBwLnN0YWNrcyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSAoJHtidWZmYXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmYXBwLnN0YWNrcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gbG9zdGApO1xuICAgICAgICAgICAgICAgIGJ1ZmZhcHAuYnVmZi5yZW1vdmUodGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZW1vdmVFeHBpcmVkQnVmZnModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHJlbW92ZWRCdWZmczogQnVmZltdID0gW107XG4gICAgICAgIFxuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmV4cGlyYXRpb25UaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVkQnVmZnMucHVzaChidWZmYXBwLmJ1ZmYpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QgPSB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yIChsZXQgYnVmZiBvZiByZW1vdmVkQnVmZnMpIHtcbiAgICAgICAgICAgIGJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGV4cGlyZWRgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmYge1xuICAgIG5hbWU6IFN0cmluZztcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXN8dW5kZWZpbmVkO1xuICAgIHN0YWNrczogYm9vbGVhbjtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGluaXRpYWxTdGFja3M/OiBudW1iZXI7XG4gICAgbWF4U3RhY2tzPzogbnVtYmVyO1xuICAgIHN0YXRzU3RhY2s6IGJvb2xlYW47IC8vIGRvIHlvdSBhZGQgdGhlIHN0YXQgYm9udXMgZm9yIGVhY2ggc3RhY2s/IG9yIGlzIGl0IGxpa2UgZmx1cnJ5IHdoZXJlIHRoZSBzdGFjayBpcyBvbmx5IHRvIGNvdW50IGNoYXJnZXNcblxuICAgIHByaXZhdGUgY2hpbGQ/OiBCdWZmO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0cz86IFN0YXRWYWx1ZXMsIHN0YWNrcz86IGJvb2xlYW4sIGluaXRpYWxTdGFja3M/OiBudW1iZXIsIG1heFN0YWNrcz86IG51bWJlciwgY2hpbGQ/OiBCdWZmLCBzdGF0c1N0YWNrID0gdHJ1ZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5zdGFja3MgPSAhIXN0YWNrcztcbiAgICAgICAgdGhpcy5pbml0aWFsU3RhY2tzID0gaW5pdGlhbFN0YWNrcztcbiAgICAgICAgdGhpcy5tYXhTdGFja3MgPSBtYXhTdGFja3M7XG4gICAgICAgIHRoaXMuY2hpbGQgPSBjaGlsZDtcbiAgICAgICAgdGhpcy5zdGF0c1N0YWNrID0gc3RhdHNTdGFjaztcbiAgICB9XG5cbiAgICBhcHBseShzdGF0czogU3RhdHMsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLnN0YXRzKSB7XG4gICAgICAgICAgICBzdGF0cy5hZGQodGhpcy5zdGF0cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge31cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLmNoaWxkKSB7XG4gICAgICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIucmVtb3ZlKHRoaXMuY2hpbGQsIHRpbWUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmY7XG4gICAgZXhwaXJhdGlvblRpbWUhOiBudW1iZXI7XG5cbiAgICBzdGFja3NWYWwhOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihidWZmOiBCdWZmLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLmJ1ZmYgPSBidWZmO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLnN0YWNrcyA9IHRoaXMuYnVmZi5pbml0aWFsU3RhY2tzIHx8IDE7XG5cbiAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IHRpbWUgKyB0aGlzLmJ1ZmYuZHVyYXRpb24gKiAxMDAwO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1ZmYuZHVyYXRpb24gPiA2MCkge1xuICAgICAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHN0YWNrcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhY2tzVmFsO1xuICAgIH1cblxuICAgIHNldCBzdGFja3Moc3RhY2tzOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3NWYWwgPSB0aGlzLmJ1ZmYubWF4U3RhY2tzID8gTWF0aC5taW4odGhpcy5idWZmLm1heFN0YWNrcywgc3RhY2tzKSA6IHN0YWNrcztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmT3ZlclRpbWUgZXh0ZW5kcyBCdWZmIHtcbiAgICB1cGRhdGVGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZDtcbiAgICB1cGRhdGVJbnRlcnZhbDogbnVtYmVyXG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHN0YXRzOiBTdGF0VmFsdWVzfHVuZGVmaW5lZCwgdXBkYXRlSW50ZXJ2YWw6IG51bWJlciwgdXBkYXRlRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHN0YXRzKTtcbiAgICAgICAgdGhpcy51cGRhdGVGID0gdXBkYXRlRjtcbiAgICAgICAgdGhpcy51cGRhdGVJbnRlcnZhbCA9IHVwZGF0ZUludGVydmFsO1xuICAgIH1cbn1cblxuY2xhc3MgQnVmZk92ZXJUaW1lQXBwbGljYXRpb24gZXh0ZW5kcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmZPdmVyVGltZTtcbiAgICBuZXh0VXBkYXRlITogbnVtYmVyO1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJ1ZmY6IEJ1ZmZPdmVyVGltZSwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoYnVmZiwgYXBwbHlUaW1lKTtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMucmVmcmVzaChhcHBseVRpbWUpO1xuICAgIH1cblxuICAgIHJlZnJlc2godGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyLnJlZnJlc2godGltZSk7XG4gICAgICAgIHRoaXMubmV4dFVwZGF0ZSA9IHRpbWUgKyB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgfVxuXG4gICAgdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGltZSA+PSB0aGlzLm5leHRVcGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMubmV4dFVwZGF0ZSArPSB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgICAgICAgICB0aGlzLmJ1ZmYudXBkYXRlRih0aGlzLnBsYXllciwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmUHJvYyBleHRlbmRzIEJ1ZmYge1xuICAgIHByb2M6IFByb2M7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHByb2M6IFByb2MsIGNoaWxkPzogQnVmZikge1xuICAgICAgICBzdXBlcihuYW1lLCBkdXJhdGlvbiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjaGlsZCk7XG4gICAgICAgIHRoaXMucHJvYyA9IHByb2M7XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIuYWRkKHRpbWUsIHBsYXllcik7XG4gICAgICAgIHBsYXllci5hZGRQcm9jKHRoaXMucHJvYyk7XG4gICAgfVxuXG4gICAgcmVtb3ZlKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIucmVtb3ZlKHRpbWUsIHBsYXllcik7XG4gICAgICAgIHBsYXllci5yZW1vdmVQcm9jKHRoaXMucHJvYyk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgV2VhcG9uRXF1aXBlZCwgV2VhcG9uVHlwZSwgSXRlbURlc2NyaXB0aW9uLCBJdGVtRXF1aXBlZCwgSXRlbVNsb3QsIGlzRXF1aXBlZFdlYXBvbiwgaXNXZWFwb24gfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgdXJhbmQsIGNsYW1wLCBmcmFuZCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IEJ1ZmZNYW5hZ2VyIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgU3BlbGwsIFByb2MsIExlYXJuZWRTd2luZ1NwZWxsLCBTcGVsbFR5cGUgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgZW51bSBSYWNlIHtcbiAgICBIVU1BTixcbiAgICBPUkMsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBQbGF5ZXIgZXh0ZW5kcyBVbml0IHtcbiAgICBpdGVtczogTWFwPEl0ZW1TbG90LCBJdGVtRXF1aXBlZD4gPSBuZXcgTWFwKCk7XG4gICAgcHJvY3M6IFByb2NbXSA9IFtdO1xuXG4gICAgdGFyZ2V0OiBVbml0IHwgdW5kZWZpbmVkO1xuXG4gICAgbmV4dEdDRFRpbWUgPSAwO1xuICAgIGV4dHJhQXR0YWNrQ291bnQgPSAwO1xuICAgIGRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG5cbiAgICBidWZmTWFuYWdlcjogQnVmZk1hbmFnZXI7XG5cbiAgICBkYW1hZ2VEb25lID0gMDtcblxuICAgIHF1ZXVlZFNwZWxsOiBMZWFybmVkU3dpbmdTcGVsbHx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBsb2c/OiBMb2dGdW5jdGlvbjtcblxuICAgIGxhdGVuY3kgPSA1MDsgLy8gbXNcblxuICAgIHBvd2VyTG9zdCA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0czogU3RhdFZhbHVlcywgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgc3VwZXIoNjAsIDApOyAvLyBsdmwsIGFybW9yXG5cbiAgICAgICAgdGhpcy5idWZmTWFuYWdlciA9IG5ldyBCdWZmTWFuYWdlcih0aGlzLCBuZXcgU3RhdHMoc3RhdHMpKTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IG1oKCk6IFdlYXBvbkVxdWlwZWR8dW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3QgZXF1aXBlZCA9IHRoaXMuaXRlbXMuZ2V0KEl0ZW1TbG90Lk1BSU5IQU5EKTtcblxuICAgICAgICBpZiAoZXF1aXBlZCAmJiBpc0VxdWlwZWRXZWFwb24oZXF1aXBlZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcXVpcGVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9oKCk6IFdlYXBvbkVxdWlwZWR8dW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3QgZXF1aXBlZCA9IHRoaXMuaXRlbXMuZ2V0KEl0ZW1TbG90Lk9GRkhBTkQpO1xuXG4gICAgICAgIGlmIChlcXVpcGVkICYmIGlzRXF1aXBlZFdlYXBvbihlcXVpcGVkKSkge1xuICAgICAgICAgICAgcmV0dXJuIGVxdWlwZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBlcXVpcChpdGVtOiBJdGVtRGVzY3JpcHRpb24sIHNsb3Q6IEl0ZW1TbG90KSB7XG4gICAgICAgIGlmICh0aGlzLml0ZW1zLmhhcyhzbG90KSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgYWxyZWFkeSBoYXZlIGl0ZW0gaW4gc2xvdCAke0l0ZW1TbG90W3Nsb3RdfWApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIShpdGVtLnNsb3QgJiBzbG90KSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgY2Fubm90IGVxdWlwICR7aXRlbS5uYW1lfSBpbiBzbG90ICR7SXRlbVNsb3Rbc2xvdF19YClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnN0YXRzKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmJhc2VTdGF0cy5hZGQoaXRlbS5zdGF0cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUT0RPIC0gaGFuZGxlIGVxdWlwcGluZyAySCAoYW5kIGhvdyB0aGF0IGRpc2FibGVzIE9IKVxuICAgICAgICBpZiAoaXNXZWFwb24oaXRlbSkpIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMuc2V0KHNsb3QsIG5ldyBXZWFwb25FcXVpcGVkKGl0ZW0sIHRoaXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaXRlbXMuc2V0KHNsb3QsIG5ldyBJdGVtRXF1aXBlZChpdGVtLCB0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcG93ZXIoKTogbnVtYmVyIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgc2V0IHBvd2VyKHBvd2VyOiBudW1iZXIpIHt9XG5cbiAgICBhZGRQcm9jKHA6IFByb2MpIHtcbiAgICAgICAgdGhpcy5wcm9jcy5wdXNoKHApO1xuICAgIH1cblxuICAgIHJlbW92ZVByb2MocDogUHJvYykge1xuICAgICAgICAvLyBUT0RPIC0gZWl0aGVyIHByb2NzIHNob3VsZCBiZSBhIHNldCBvciB3ZSBuZWVkIFByb2NBcHBsaWNhdGlvblxuICAgICAgICB0aGlzLnByb2NzID0gdGhpcy5wcm9jcy5maWx0ZXIoKHByb2M6IFByb2MpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwcm9jICE9PSBwO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBpZiAoc3BlbGwgJiYgc3BlbGwudHlwZSA9PSBTcGVsbFR5cGUuUEhZU0lDQUwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3ZWFwb24gPSBpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCE7XG4gICAgICAgIGNvbnN0IHdlYXBvblR5cGUgPSB3ZWFwb24ud2VhcG9uLnR5cGU7XG5cbiAgICAgICAgLy8gVE9ETywgbWFrZSB0aGlzIGEgbWFwXG4gICAgICAgIHN3aXRjaCAod2VhcG9uVHlwZSkge1xuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLk1BQ0U6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMubWFjZVNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLlNXT1JEOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN3b3JkU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuQVhFOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmF4ZVNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkRBR0dFUjpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5kYWdnZXJTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5NQUNFMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMubWFjZTJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuU1dPUkQySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zd29yZDJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuQVhFMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXhlMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UoKSB7XG4gICAgICAgIGxldCBjcml0ID0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5jcml0O1xuICAgICAgICBjcml0ICs9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYWdpICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAvIDIwO1xuXG4gICAgICAgIHJldHVybiBjcml0O1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVNaXNzQ2hhbmNlKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgbGV0IHJlcyA9IDU7XG4gICAgICAgIHJlcyAtPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhpdDtcblxuICAgICAgICBpZiAodGhpcy5vaCAmJiAhc3BlbGwpIHtcbiAgICAgICAgICAgIHJlcyArPSAxOTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2tpbGxEaWZmID0gdGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oLCBzcGVsbCkgLSB2aWN0aW0uZGVmZW5zZVNraWxsO1xuXG4gICAgICAgIGlmIChza2lsbERpZmYgPCAtMTApIHtcbiAgICAgICAgICAgIHJlcyAtPSAoc2tpbGxEaWZmICsgMTApICogMC40IC0gMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcyAtPSBza2lsbERpZmYgKiAwLjE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2xhbXAocmVzLCAwLCA2MCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgY29uc3Qgc2tpbGxEaWZmID0gdmljdGltLmRlZmVuc2VTa2lsbCAgLSB0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgpO1xuXG4gICAgICAgIGlmIChza2lsbERpZmYgPj0gMTUpIHtcbiAgICAgICAgICAgIHJldHVybiAwLjY1O1xuICAgICAgICB9IGVsc2UgaWYgKHNraWxsRGlmZiA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHNraWxsRGlmZlRvUmVkdWN0aW9uW3NraWxsRGlmZl07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXAoKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVTd2luZ01pbk1heERhbWFnZShpc19taDogYm9vbGVhbik6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgICAgICBjb25zdCB3ZWFwb24gPSBpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCE7XG5cbiAgICAgICAgY29uc3QgYXBfYm9udXMgPSB0aGlzLmFwIC8gMTQgKiB3ZWFwb24ud2VhcG9uLnNwZWVkO1xuXG4gICAgICAgIGNvbnN0IG9oUGVuYWx0eSA9IGlzX21oID8gMSA6IDAuNjI1OyAvLyBUT0RPIC0gY2hlY2sgdGFsZW50cywgaW1wbGVtZW50ZWQgYXMgYW4gYXVyYSBTUEVMTF9BVVJBX01PRF9PRkZIQU5EX0RBTUFHRV9QQ1RcblxuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgKHdlYXBvbi5taW4gKyBhcF9ib251cykgKiBvaFBlbmFsdHksXG4gICAgICAgICAgICAod2VhcG9uLm1heCArIGFwX2JvbnVzKSAqIG9oUGVuYWx0eVxuICAgICAgICBdO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oOiBib29sZWFuKSB7XG4gICAgICAgIHJldHVybiBmcmFuZCguLi50aGlzLmNhbGN1bGF0ZVN3aW5nTWluTWF4RGFtYWdlKGlzX21oKSk7XG4gICAgfVxuXG4gICAgcm9sbE1lbGVlSGl0T3V0Y29tZSh2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKTogTWVsZWVIaXRPdXRjb21lIHtcbiAgICAgICAgY29uc3Qgcm9sbCA9IHVyYW5kKDAsIDEwMDAwKTtcbiAgICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICAgIGxldCB0bXAgPSAwO1xuXG4gICAgICAgIC8vIHJvdW5kaW5nIGluc3RlYWQgb2YgdHJ1bmNhdGluZyBiZWNhdXNlIDE5LjQgKiAxMDAgd2FzIHRydW5jYXRpbmcgdG8gMTkzOS5cbiAgICAgICAgY29uc3QgbWlzc19jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlTWlzc0NoYW5jZSh2aWN0aW0sIGlzX21oLCBzcGVsbCkgKiAxMDApO1xuICAgICAgICBjb25zdCBkb2RnZV9jaGFuY2UgPSBNYXRoLnJvdW5kKHZpY3RpbS5kb2RnZUNoYW5jZSAqIDEwMCk7XG4gICAgICAgIGNvbnN0IGNyaXRfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZUNyaXRDaGFuY2UoKSAqIDEwMCk7XG5cbiAgICAgICAgLy8gd2VhcG9uIHNraWxsIC0gdGFyZ2V0IGRlZmVuc2UgKHVzdWFsbHkgbmVnYXRpdmUpXG4gICAgICAgIGNvbnN0IHNraWxsQm9udXMgPSA0ICogKHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCwgc3BlbGwpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuXG4gICAgICAgIHRtcCA9IG1pc3NfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBkb2RnZV9jaGFuY2UgLSBza2lsbEJvbnVzOyAvLyA1LjYgKDU2MCkgZm9yIGx2bCA2MyB3aXRoIDMwMCB3ZWFwb24gc2tpbGxcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3BlbGwpIHsgLy8gc3BlbGxzIGNhbid0IGdsYW5jZVxuICAgICAgICAgICAgdG1wID0gKDEwICsgKHZpY3RpbS5kZWZlbnNlU2tpbGwgLSAzMDApICogMikgKiAxMDA7XG4gICAgICAgICAgICB0bXAgPSBjbGFtcCh0bXAsIDAsIDQwMDApO1xuICAgIFxuICAgICAgICAgICAgaWYgKHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IGNyaXRfY2hhbmNlICsgc2tpbGxCb251cztcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSBjcml0X2NoYW5jZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUw7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgZGFtYWdlV2l0aEJvbnVzID0gcmF3RGFtYWdlO1xuXG4gICAgICAgIGRhbWFnZVdpdGhCb251cyAqPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhbWFnZU11bHQ7XG5cbiAgICAgICAgcmV0dXJuIGRhbWFnZVdpdGhCb251cztcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGNvbnN0IGRhbWFnZVdpdGhCb251cyA9IHRoaXMuY2FsY3VsYXRlQm9udXNEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIHNwZWxsKTtcbiAgICAgICAgY29uc3QgYXJtb3JSZWR1Y2VkID0gdmljdGltLmNhbGN1bGF0ZUFybW9yUmVkdWNlZERhbWFnZShkYW1hZ2VXaXRoQm9udXMsIHRoaXMpO1xuICAgICAgICBjb25zdCBoaXRPdXRjb21lID0gdGhpcy5yb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbSwgaXNfbWgsIHNwZWxsKTtcblxuICAgICAgICBsZXQgZGFtYWdlID0gYXJtb3JSZWR1Y2VkO1xuICAgICAgICBsZXQgY2xlYW5EYW1hZ2UgPSAwO1xuXG4gICAgICAgIHN3aXRjaCAoaGl0T3V0Y29tZSkge1xuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTpcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSAwO1xuICAgICAgICAgICAgICAgIGNsZWFuRGFtYWdlID0gZGFtYWdlV2l0aEJvbnVzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZHVjZVBlcmNlbnQgPSB0aGlzLmNhbGN1bGF0ZUdsYW5jaW5nUmVkdWN0aW9uKHZpY3RpbSwgaXNfbWgpO1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IHJlZHVjZVBlcmNlbnQgKiBkYW1hZ2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTk9STUFMOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlICo9IDI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW2RhbWFnZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHVwZGF0ZVByb2NzKHRpbWU6IG51bWJlciwgaXNfbWg6IGJvb2xlYW4sIGhpdE91dGNvbWU6IE1lbGVlSGl0T3V0Y29tZSwgZGFtYWdlRG9uZTogbnVtYmVyLCBjbGVhbkRhbWFnZTogbnVtYmVyLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUywgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgIC8vIHdoYXQgaXMgdGhlIG9yZGVyIG9mIGNoZWNraW5nIGZvciBwcm9jcyBsaWtlIGhvaiwgaXJvbmZvZSBhbmQgd2luZGZ1cnlcbiAgICAgICAgICAgIC8vIG9uIExIIGNvcmUgaXQgaXMgaG9qID4gaXJvbmZvZSA+IHdpbmRmdXJ5XG5cbiAgICAgICAgICAgIC8vIHNvIGRvIGl0ZW0gcHJvY3MgZmlyc3QsIHRoZW4gd2VhcG9uIHByb2MsIHRoZW4gd2luZGZ1cnlcbiAgICAgICAgICAgIGZvciAobGV0IHByb2Mgb2YgdGhpcy5wcm9jcykge1xuICAgICAgICAgICAgICAgIHByb2MucnVuKHRoaXMsIChpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCEpLndlYXBvbiwgdGltZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAoaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghKS5wcm9jKHRpbWUpO1xuICAgICAgICAgICAgLy8gVE9ETyAtIGltcGxlbWVudCB3aW5kZnVyeSBoZXJlLCBpdCBzaG91bGQgc3RpbGwgYWRkIGF0dGFjayBwb3dlciBldmVuIGlmIHRoZXJlIGlzIGFscmVhZHkgYW4gZXh0cmEgYXR0YWNrXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZWFsTWVsZWVEYW1hZ2UodGltZTogbnVtYmVyLCByYXdEYW1hZ2U6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXSA9IHRoaXMuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oLCBzcGVsbCk7XG4gICAgICAgIGRhbWFnZURvbmUgPSBNYXRoLnRydW5jKGRhbWFnZURvbmUpOyAvLyB0cnVuY2F0aW5nIGhlcmUgYmVjYXVzZSB3YXJyaW9yIHN1YmNsYXNzIGJ1aWxkcyBvbiB0b3Agb2YgY2FsY3VsYXRlTWVsZWVEYW1hZ2VcbiAgICAgICAgY2xlYW5EYW1hZ2UgPSBNYXRoLnRydW5jKGNsZWFuRGFtYWdlKTsgLy8gVE9ETywgc2hvdWxkIGRhbWFnZU11bHQgYWZmZWN0IGNsZWFuIGRhbWFnZSBhcyB3ZWxsPyBpZiBzbyBtb3ZlIGl0IGludG8gY2FsY3VsYXRlTWVsZWVEYW1hZ2VcblxuICAgICAgICB0aGlzLmRhbWFnZURvbmUgKz0gZGFtYWdlRG9uZTtcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgbGV0IGhpdFN0ciA9IGBZb3VyICR7c3BlbGwgPyBzcGVsbC5uYW1lIDogKGlzX21oID8gJ21haW4taGFuZCcgOiAnb2ZmLWhhbmQnKX0gJHtoaXRPdXRjb21lU3RyaW5nW2hpdE91dGNvbWVdfWA7XG4gICAgICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAgICAgaGl0U3RyICs9IGAgZm9yICR7ZGFtYWdlRG9uZX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgaGl0U3RyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudXBkYXRlUHJvY3ModGltZSwgaXNfbWgsIGhpdE91dGNvbWUsIGRhbWFnZURvbmUsIGNsZWFuRGFtYWdlLCBzcGVsbCk7XG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIudXBkYXRlKHRpbWUpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBzd2luZ1dlYXBvbih0aW1lOiBudW1iZXIsIHRhcmdldDogVW5pdCwgaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgY29uc3QgcmF3RGFtYWdlID0gdGhpcy5jYWxjdWxhdGVTd2luZ1Jhd0RhbWFnZShpc19taCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXRoaXMuZG9pbmdFeHRyYUF0dGFja3MgJiYgaXNfbWggJiYgdGhpcy5xdWV1ZWRTcGVsbCAmJiB0aGlzLnF1ZXVlZFNwZWxsLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwuY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIGNvbnN0IHN3aW5nU3BlbGwgPSB0aGlzLnF1ZXVlZFNwZWxsLnNwZWxsO1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRTcGVsbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGNvbnN0IGJvbnVzRGFtYWdlID0gc3dpbmdTcGVsbC5ib251c0RhbWFnZTtcbiAgICAgICAgICAgIHRoaXMuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHJhd0RhbWFnZSArIGJvbnVzRGFtYWdlLCB0YXJnZXQsIGlzX21oLCBzd2luZ1NwZWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIHJhd0RhbWFnZSwgdGFyZ2V0LCBpc19taCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBbdGhpc1dlYXBvbiwgb3RoZXJXZWFwb25dID0gaXNfbWggPyBbdGhpcy5taCwgdGhpcy5vaF0gOiBbdGhpcy5vaCwgdGhpcy5taF07XG5cbiAgICAgICAgdGhpc1dlYXBvbiEubmV4dFN3aW5nVGltZSA9IHRpbWUgKyB0aGlzV2VhcG9uIS53ZWFwb24uc3BlZWQgLyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhhc3RlICogMTAwMDtcblxuICAgICAgICBpZiAob3RoZXJXZWFwb24gJiYgb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSA8IHRpbWUgKyAyMDApIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGBkZWxheWluZyAke2lzX21oID8gJ09IJyA6ICdNSCd9IHN3aW5nYCwgdGltZSArIDIwMCAtIG90aGVyV2VhcG9uLm5leHRTd2luZ1RpbWUpO1xuICAgICAgICAgICAgb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSA9IHRpbWUgKyAyMDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVBdHRhY2tpbmdTdGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRyYUF0dGFja0NvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZG9pbmdFeHRyYUF0dGFja3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHdoaWxlICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4dHJhQXR0YWNrQ291bnQtLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGltZSA+PSB0aGlzLm1oIS5uZXh0U3dpbmdUaW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMub2ggJiYgdGltZSA+PSB0aGlzLm9oLm5leHRTd2luZ1RpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBQbGF5ZXIsIE1lbGVlSGl0T3V0Y29tZSwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiwgQnVmZk92ZXJUaW1lIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IFNwZWxsLCBMZWFybmVkU3BlbGwsIFNwZWxsRGFtYWdlLCBTcGVsbFR5cGUsIFN3aW5nU3BlbGwsIExlYXJuZWRTd2luZ1NwZWxsLCBQcm9jLCBTcGVsbEJ1ZmYgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi9tYXRoLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5cbmNvbnN0IGZsdXJyeSA9IG5ldyBCdWZmKFwiRmx1cnJ5XCIsIDE1LCB7aGFzdGU6IDEuM30sIHRydWUsIDMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbmV4cG9ydCBjb25zdCByYWNlVG9TdGF0cyA9IG5ldyBNYXA8UmFjZSwgU3RhdFZhbHVlcz4oKTtcbnJhY2VUb1N0YXRzLnNldChSYWNlLkhVTUFOLCB7IG1hY2VTa2lsbDogNSwgc3dvcmRTa2lsbDogNSwgbWFjZTJIU2tpbGw6IDUsIHN3b3JkMkhTa2lsbDogNSwgc3RyOiAxMjAsIGFnaTogODAgfSk7XG5yYWNlVG9TdGF0cy5zZXQoUmFjZS5PUkMsIHsgYXhlU2tpbGw6IDUsIGF4ZTJIU2tpbGw6IDUsIHN0cjogMTIzLCBhZ2k6IDc3IH0pO1xuXG5leHBvcnQgY2xhc3MgV2FycmlvciBleHRlbmRzIFBsYXllciB7XG4gICAgZmx1cnJ5Q291bnQgPSAwO1xuICAgIHJhZ2UgPSA4MDsgLy8gVE9ETyAtIGFsbG93IHNpbXVsYXRpb24gdG8gY2hvb3NlIHN0YXJ0aW5nIHJhZ2VcblxuICAgIGV4ZWN1dGUgPSBuZXcgTGVhcm5lZFNwZWxsKGV4ZWN1dGVTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2R0aGlyc3QgPSBuZXcgTGVhcm5lZFNwZWxsKGJsb29kdGhpcnN0U3BlbGwsIHRoaXMpO1xuICAgIGhhbXN0cmluZyA9IG5ldyBMZWFybmVkU3BlbGwoaGFtc3RyaW5nU3BlbGwsIHRoaXMpO1xuICAgIHdoaXJsd2luZCA9IG5ldyBMZWFybmVkU3BlbGwod2hpcmx3aW5kU3BlbGwsIHRoaXMpO1xuICAgIGhlcm9pY1N0cmlrZSA9IG5ldyBMZWFybmVkU3dpbmdTcGVsbChoZXJvaWNTdHJpa2VTcGVsbCwgdGhpcyk7XG4gICAgYmxvb2RSYWdlID0gbmV3IExlYXJuZWRTcGVsbChibG9vZFJhZ2UsIHRoaXMpO1xuICAgIGRlYXRoV2lzaCA9IG5ldyBMZWFybmVkU3BlbGwoZGVhdGhXaXNoLCB0aGlzKTtcblxuICAgIGNvbnN0cnVjdG9yKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBsb2dDYWxsYmFjaz86ICh0aW1lOiBudW1iZXIsIHRleHQ6IHN0cmluZykgPT4gdm9pZCkge1xuICAgICAgICBzdXBlcihuZXcgU3RhdHMocmFjZVRvU3RhdHMuZ2V0KHJhY2UpKS5hZGQoc3RhdHMpLCBsb2dDYWxsYmFjayk7XG5cbiAgICAgICAgdGhpcy5idWZmTWFuYWdlci5hZGQoYW5nZXJNYW5hZ2VtZW50T1QsIE1hdGgucmFuZG9tKCkgKiAtMzAwMCk7IC8vIHJhbmRvbWl6aW5nIGFuZ2VyIG1hbmFnZW1lbnQgdGltaW5nXG4gICAgfVxuXG4gICAgZ2V0IHBvd2VyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yYWdlO1xuICAgIH1cblxuICAgIHNldCBwb3dlcihwb3dlcjogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMucG93ZXJMb3N0ICs9IE1hdGgubWF4KDAsIHBvd2VyIC0gMTAwKTtcbiAgICAgICAgdGhpcy5yYWdlID0gY2xhbXAocG93ZXIsIDAsIDEwMCk7XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sZXZlbCAqIDMgLSAyMCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXAgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0ciAqIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RhdE11bHQgKiAyO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UoKSB7XG4gICAgICAgIC8vIGNydWVsdHkgKyBiZXJzZXJrZXIgc3RhbmNlXG4gICAgICAgIHJldHVybiA1ICsgMyArIHN1cGVyLmNhbGN1bGF0ZUNyaXRDaGFuY2UoKTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gc3VwZXIuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIGlzX21oLCBzcGVsbCk7XG5cbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCAmJiBzcGVsbCkge1xuICAgICAgICAgICAgZGFtYWdlRG9uZSAqPSAxLjE7IC8vIGltcGFsZVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgcmV3YXJkUmFnZShkYW1hZ2U6IG51bWJlciwgaXNfYXR0YWNrZXI6IGJvb2xlYW4sIHRpbWU6IG51bWJlcikge1xuICAgICAgICAvLyBodHRwczovL2JsdWUubW1vLWNoYW1waW9uLmNvbS90b3BpYy8xODMyNS10aGUtbmV3LXJhZ2UtZm9ybXVsYS1ieS1rYWxnYW4vXG4gICAgICAgIC8vIFByZS1FeHBhbnNpb24gUmFnZSBHYWluZWQgZnJvbSBkZWFsaW5nIGRhbWFnZTpcbiAgICAgICAgLy8gKERhbWFnZSBEZWFsdCkgLyAoUmFnZSBDb252ZXJzaW9uIGF0IFlvdXIgTGV2ZWwpICogNy41XG4gICAgICAgIC8vIEZvciBUYWtpbmcgRGFtYWdlIChib3RoIHByZSBhbmQgcG9zdCBleHBhbnNpb24pOlxuICAgICAgICAvLyBSYWdlIEdhaW5lZCA9IChEYW1hZ2UgVGFrZW4pIC8gKFJhZ2UgQ29udmVyc2lvbiBhdCBZb3VyIExldmVsKSAqIDIuNVxuICAgICAgICAvLyBSYWdlIENvbnZlcnNpb24gYXQgbGV2ZWwgNjA6IDIzMC42XG4gICAgICAgIC8vIFRPRE8gLSBob3cgZG8gZnJhY3Rpb25zIG9mIHJhZ2Ugd29yaz8gaXQgYXBwZWFycyB5b3UgZG8gZ2FpbiBmcmFjdGlvbnMgYmFzZWQgb24gZXhlYyBkYW1hZ2VcbiAgICAgICAgLy8gbm90IHRydW5jYXRpbmcgZm9yIG5vd1xuICAgICAgICBcbiAgICAgICAgY29uc3QgTEVWRUxfNjBfUkFHRV9DT05WID0gMjMwLjY7XG4gICAgICAgIGxldCBhZGRSYWdlID0gZGFtYWdlIC8gTEVWRUxfNjBfUkFHRV9DT05WO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzX2F0dGFja2VyKSB7XG4gICAgICAgICAgICBhZGRSYWdlICo9IDcuNTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRPRE8gLSBjaGVjayBmb3IgYmVyc2Vya2VyIHJhZ2UgMS4zeCBtb2RpZmllclxuICAgICAgICAgICAgYWRkUmFnZSAqPSAyLjU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5sb2cpIHRoaXMubG9nKHRpbWUsIGBHYWluZWQgJHtNYXRoLm1pbihhZGRSYWdlLCAxMDAgLSB0aGlzLnJhZ2UpfSByYWdlICgke01hdGgubWluKDEwMCwgdGhpcy5wb3dlciArIGFkZFJhZ2UpfSlgKTtcblxuICAgICAgICB0aGlzLnBvd2VyICs9IGFkZFJhZ2U7XG4gICAgfVxuXG4gICAgdXBkYXRlUHJvY3ModGltZTogbnVtYmVyLCBpc19taDogYm9vbGVhbiwgaGl0T3V0Y29tZTogTWVsZWVIaXRPdXRjb21lLCBkYW1hZ2VEb25lOiBudW1iZXIsIGNsZWFuRGFtYWdlOiBudW1iZXIsIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlUHJvY3ModGltZSwgaXNfbWgsIGhpdE91dGNvbWUsIGRhbWFnZURvbmUsIGNsZWFuRGFtYWdlLCBzcGVsbCk7XG5cbiAgICAgICAgaWYgKFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKSkge1xuICAgICAgICAgICAgaWYgKHNwZWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gaHR0cDovL2JsdWUubW1vLWNoYW1waW9uLmNvbS90b3BpYy82OTM2NS0xOC0wMi0wNS1rYWxnYW5zLXJlc3BvbnNlLXRvLXdhcnJpb3JzLyBcInNpbmNlIG1pc3Npbmcgd2FzdGVzIDIwJSBvZiB0aGUgcmFnZSBjb3N0IG9mIHRoZSBhYmlsaXR5XCJcbiAgICAgICAgICAgICAgICAvLyBUT0RPIC0gbm90IHN1cmUgaG93IGJsaXp6bGlrZSB0aGlzIGlzXG4gICAgICAgICAgICAgICAgaWYgKHNwZWxsICE9PSB3aGlybHdpbmRTcGVsbCkgeyAvLyBUT0RPIC0gc2hvdWxkIGNoZWNrIHRvIHNlZSBpZiBpdCBpcyBhbiBhb2Ugc3BlbGwgb3IgYSBzaW5nbGUgdGFyZ2V0IHNwZWxsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmFnZSArPSBzcGVsbC5jb3N0ICogMC44MjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmV3YXJkUmFnZShjbGVhbkRhbWFnZSAqIDAuNzUsIHRydWUsIHRpbWUpOyAvLyBUT0RPIC0gd2hlcmUgaXMgdGhpcyBmb3JtdWxhIGZyb20/XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGFtYWdlRG9uZSAmJiAhc3BlbGwpIHtcbiAgICAgICAgICAgIHRoaXMucmV3YXJkUmFnZShkYW1hZ2VEb25lLCB0cnVlLCB0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluc3RhbnQgYXR0YWNrcyBhbmQgbWlzc2VzL2RvZGdlcyBkb24ndCB1c2UgZmx1cnJ5IGNoYXJnZXMgLy8gVE9ETyAtIGNvbmZpcm1cbiAgICAgICAgLy8gZXh0cmEgYXR0YWNrcyBkb24ndCB1c2UgZmx1cnJ5IGNoYXJnZXMgYnV0IHRoZXkgY2FuIHByb2MgZmx1cnJ5ICh0ZXN0ZWQpXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICF0aGlzLmRvaW5nRXh0cmFBdHRhY2tzXG4gICAgICAgICAgICAmJiAhKHNwZWxsIHx8IHNwZWxsID09PSBoZXJvaWNTdHJpa2VTcGVsbClcbiAgICAgICAgICAgICYmICFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKVxuICAgICAgICAgICAgJiYgaGl0T3V0Y29tZSAhPT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXG4gICAgICAgICkgeyBcbiAgICAgICAgICAgIHRoaXMuZmx1cnJ5Q291bnQgPSBNYXRoLm1heCgwLCB0aGlzLmZsdXJyeUNvdW50IC0gMSk7XG4gICAgICAgICAgICAvLyB0aGlzLmJ1ZmZNYW5hZ2VyLnJlbW92ZShmbHVycnksIHRpbWUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoaGl0T3V0Y29tZSA9PT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUKSB7XG4gICAgICAgICAgICAvLyBUT0RPIC0gaWdub3JpbmcgZGVlcCB3b3VuZHNcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYWRkKGZsdXJyeSwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNvbnN0IGhlcm9pY1N0cmlrZVNwZWxsID0gbmV3IFN3aW5nU3BlbGwoXCJIZXJvaWMgU3RyaWtlXCIsIDE1NywgMTIpO1xuXG4vLyBUT0RPIC0gbmVlZHMgdG8gd2lwZSBvdXQgYWxsIHJhZ2UgZXZlbiB0aG91Z2ggaXQgb25seSBjb3N0cyAxMFxuY29uc3QgZXhlY3V0ZVNwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiRXhlY3V0ZVwiLCAocGxheWVyOiBQbGF5ZXIpID0+IHtcbiAgICByZXR1cm4gNjAwICsgKCg8V2Fycmlvcj5wbGF5ZXIpLnJhZ2UgLSAxMCk7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCB0cnVlLCAxMCwgMCk7XG5cbmNvbnN0IGJsb29kdGhpcnN0U3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJCbG9vZHRoaXJzdFwiLCAocGxheWVyOiBQbGF5ZXIpID0+IHtcbiAgICByZXR1cm4gKDxXYXJyaW9yPnBsYXllcikuYXAgKiAwLjQ1O1xufSwgU3BlbGxUeXBlLlBIWVNJQ0FMLCB0cnVlLCAzMCwgNik7XG5cbmNvbnN0IHdoaXJsd2luZFNwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiV2hpcmx3aW5kXCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiBwbGF5ZXIuY2FsY3VsYXRlU3dpbmdSYXdEYW1hZ2UodHJ1ZSk7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCB0cnVlLCAyNSwgMTApO1xuXG5jb25zdCBoYW1zdHJpbmdTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkhhbXN0cmluZ1wiLCA0NSwgU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgdHJ1ZSwgMTAsIDApO1xuXG5leHBvcnQgY29uc3QgYW5nZXJNYW5hZ2VtZW50T1QgPSBuZXcgQnVmZk92ZXJUaW1lKFwiQW5nZXIgTWFuYWdlbWVudFwiLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgdW5kZWZpbmVkLCAzMDAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbmVkIDEgcmFnZSBmcm9tIEFuZ2VyIE1hbmFnZW1lbnRgKTtcbn0pO1xuXG5jb25zdCBibG9vZFJhZ2VPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJCbG9vZHJhZ2VcIiwgMTAsIHVuZGVmaW5lZCwgMTAwMCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW5lZCAxIHJhZ2UgZnJvbSBCbG9vZHJhZ2VgKTtcbn0pO1xuXG5jb25zdCBibG9vZFJhZ2UgPSBuZXcgU3BlbGwoXCJCbG9vZHJhZ2VcIiwgU3BlbGxUeXBlLk5PTkUsIGZhbHNlLCAwLCA2MCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBwbGF5ZXIucG93ZXIgKz0gMTA7XG4gICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluIDEwIHJhZ2UgZnJvbSBCbG9vZHJhZ2VgKTtcbiAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJsb29kUmFnZU9ULCB0aW1lKTtcbn0pO1xuXG5jb25zdCBkZWF0aFdpc2ggPSBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiRGVhdGggV2lzaFwiLCAzMCwgeyBkYW1hZ2VNdWx0OiAxLjIgfSksIHRydWUsIDEwLCAzICogNjApO1xuIiwiaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBTcGVsbEJ1ZmYsIFByb2MsIEV4dHJhQXR0YWNrIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBTdGF0cywgU3RhdFZhbHVlcyB9IGZyb20gXCIuLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgVGVtcG9yYXJ5V2VhcG9uRW5jaGFudCB9IGZyb20gXCIuLi9pdGVtLmpzXCI7XG5cblxuZXhwb3J0IGludGVyZmFjZSBCdWZmRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBkdXJhdGlvbjogbnVtYmVyLFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbn1cblxuZXhwb3J0IGNvbnN0IGJ1ZmZzOiBCdWZmW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhdHRsZSBTaG91dFwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDI5MFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3Npbmcgb2YgS2luZ3NcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdGF0TXVsdDogMS4xXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2luZyBvZiBNaWdodFwiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyMjJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJhbGx5aW5nIENyeSBvZiB0aGUgRHJhZ29uc2xheWVyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAxNDAsXG4gICAgICAgICAgICBjcml0OiA1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTb25nZmxvd2VyIFNlcmFuYWRlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGNyaXQ6IDUsXG4gICAgICAgICAgICBzdHI6IDE1LFxuICAgICAgICAgICAgYWdpOiAxNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3Bpcml0IG9mIFphbmRhbGFyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0YXRNdWx0OiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJXYXJjaGllZidzIEJsZXNzaW5nXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGhhc3RlOiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTbW9rZWQgRGVzZXJ0IER1bXBsaW5nc1wiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgUG93ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDMwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDMwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJKdWp1IE1pZ2h0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAxMCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDQwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFbGl4aXIgb2YgdGhlIE1vbmdvb3NlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFnaTogMjUsXG4gICAgICAgICAgICBjcml0OiAyXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSLk8uSS5ELlMuXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkZlbmd1cycgRmVyb2NpdHlcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDIwMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2lmdCBvZiB0aGUgV2lsZFwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDE2LCAvLyBUT0RPIC0gc2hvdWxkIGl0IGJlIDEyICogMS4zNT8gKHRhbGVudClcbiAgICAgICAgICAgIGFnaTogMTZcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRydWVzaG90IEF1cmFcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDEwMFxuICAgICAgICB9XG4gICAgfSxcbl0ubWFwKChiZDogQnVmZkRlc2NyaXB0aW9uKSA9PiBuZXcgQnVmZihiZC5uYW1lLCBiZC5kdXJhdGlvbiwgYmQuc3RhdHMpKTtcblxuLy8gTk9URTogdG8gc2ltcGxpZnkgdGhlIGNvZGUsIHRyZWF0aW5nIHRoZXNlIGFzIHR3byBzZXBhcmF0ZSBidWZmcyBzaW5jZSB0aGV5IHN0YWNrXG4vLyBjcnVzYWRlciBidWZmcyBhcHBhcmVudGx5IGNhbiBiZSBmdXJ0aGVyIHN0YWNrZWQgYnkgc3dhcHBpbmcgd2VhcG9ucyBidXQgbm90IGdvaW5nIHRvIGJvdGhlciB3aXRoIHRoYXRcbmV4cG9ydCBjb25zdCBjcnVzYWRlckJ1ZmZNSFByb2MgPSBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiQ3J1c2FkZXIgTUhcIiwgMTUsIG5ldyBTdGF0cyh7c3RyOiAxMDB9KSkpLCB7cHBtOiAxfSk7XG5leHBvcnQgY29uc3QgY3J1c2FkZXJCdWZmT0hQcm9jID0gbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE9IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pO1xuXG5leHBvcnQgY29uc3QgZGVuc2VEYW1hZ2VTdG9uZSA9IG5ldyBUZW1wb3JhcnlXZWFwb25FbmNoYW50KHsgcGx1c0RhbWFnZTogOCB9KTtcblxuZXhwb3J0IGNvbnN0IHdpbmRmdXJ5RW5jaGFudCA9IG5ldyBUZW1wb3JhcnlXZWFwb25FbmNoYW50KHVuZGVmaW5lZCwgbmV3IFByb2MoW1xuICAgIG5ldyBFeHRyYUF0dGFjayhcIldpbmRmdXJ5IFRvdGVtXCIsIDEpLFxuICAgIG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJXaW5kZnVyeSBUb3RlbVwiLCAxLjUsIHsgYXA6IDMxNSB9KSlcbl0sIHtjaGFuY2U6IDAuMn0pKTtcbiIsImltcG9ydCB7IFdlYXBvblR5cGUsIFdlYXBvbkRlc2NyaXB0aW9uLCBJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uIH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcbmltcG9ydCB7IFNwZWxsQnVmZiwgRXh0cmFBdHRhY2ssIFByb2MsIFNwZWxsIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmUHJvYyB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5cbi8vIFRPRE8gLSBob3cgdG8gaW1wbGVtZW50IHNldCBib251c2VzPyBwcm9iYWJseSBlYXNpZXN0IHRvIGFkZCBib251cyB0aGF0IHJlcXVpcmVzIGEgc3RyaW5nIHNlYXJjaCBvZiBvdGhlciBlcXVpcGVkIGl0ZW1zXG5cbmV4cG9ydCBjb25zdCBpdGVtczogKEl0ZW1EZXNjcmlwdGlvbnxXZWFwb25EZXNjcmlwdGlvbilbXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSXJvbmZvZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBtaW46IDczLFxuICAgICAgICBtYXg6IDEzNixcbiAgICAgICAgc3BlZWQ6IDIuNCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBFeHRyYUF0dGFjaygnSXJvbmZvZScsIDIpLHtwcG06IDF9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVtcHlyZWFuIERlbW9saXNoZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiA5NCxcbiAgICAgICAgbWF4OiAxNzUsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiSGFzdGUgKEVtcHlyZWFuIERlbW9saXNoZXIpXCIsIDEwLCB7aGFzdGU6IDEuMn0pKSx7cHBtOiAxfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJBbnViaXNhdGggV2FyaGFtbWVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA2NixcbiAgICAgICAgbWF4OiAxMjMsXG4gICAgICAgIHNwZWVkOiAxLjgsXG4gICAgICAgIHN0YXRzOiB7IG1hY2VTa2lsbDogNCwgYXA6IDMyIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaGUgVW50YW1lZCBCbGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JEMkgsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDE5MixcbiAgICAgICAgbWF4OiAyODksXG4gICAgICAgIHNwZWVkOiAzLjQsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiVW50YW1lZCBGdXJ5XCIsIDgsIHtzdHI6IDMwMH0pKSx7cHBtOiAyfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJIYW5kIG9mIEp1c3RpY2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHthcDogMjB9LFxuICAgICAgICBvbmVxdWlwOiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0hhbmQgb2YgSnVzdGljZScsIDEpLCB7Y2hhbmNlOiAyLzEwMH0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxhY2toYW5kJ3MgQnJlYWR0aFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJha2UgRmFuZyBUYWxpc21hblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiA1NiwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkxpb25oZWFydCBIZWxtXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMiwgaGl0OiAyLCBzdHI6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhcmJlZCBDaG9rZXJcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthcDogNDQsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiT255eGlhIFRvb3RoIFBlbmRhbnRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDEyLCBoaXQ6IDEsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgU3BhdWxkZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTYsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDbG9hayBvZiBEcmFjb25pYyBNaWdodFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge3N0cjogMTYsIGFnaTogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgQnJlYXN0cGxhdGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhpdmUgRGVmaWxlciBXcmlzdGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIzLCBhZ2k6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlFpcmFqaSBFeGVjdXRpb24gQnJhY2Vyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE2LCBzdHI6IDE1LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2F1bnRsZXRzIG9mIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMjIsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgQW5uaWhpbGF0aW9uXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMzUsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFZGdlbWFzdGVyJ3MgSGFuZGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHsgYXhlU2tpbGw6IDcsIGRhZ2dlclNraWxsOiA3LCBzd29yZFNraWxsOiA3IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJPbnNsYXVnaHQgR2lyZGxlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldBSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMzEsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaXRhbmljIExlZ2dpbmdzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMCwgY3JpdDogMSwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJvb3RzIG9mIHRoZSBGYWxsZW4gSGVyb1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTQsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWMgQm9vdHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDIwLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3RyaWtlcidzIE1hcmtcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUkFOR0VELFxuICAgICAgICBzdGF0czoge2FwOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRvbiBKdWxpbydzIEJhbmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMSwgaGl0OiAxLCBhcDogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUXVpY2sgU3RyaWtlIFJpbmdcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDMwLCBjcml0OiAxLCBzdHI6IDV9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ2hyb21hdGljYWxseSBUZW1wZXJlZCBTd29yZFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEwNixcbiAgICAgICAgbWF4OiAxOTgsXG4gICAgICAgIHNwZWVkOiAyLjYsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogMTQsIHN0cjogMTQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1hbGFkYXRoLCBSdW5lZCBCbGFkZSBvZiB0aGUgQmxhY2sgRmxpZ2h0XCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODYsXG4gICAgICAgIG1heDogMTYyLFxuICAgICAgICBzcGVlZDogMi4yLFxuICAgICAgICBzdGF0czogeyBzd29yZFNraWxsOiA0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgTG9uZ3N3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgU3dpZnRibGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDg1LFxuICAgICAgICBtYXg6IDEyOSxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgQXhlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEzOCxcbiAgICAgICAgbWF4OiAyMDcsXG4gICAgICAgIHNwZWVkOiAyLjksXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgb251c2U6ICgoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnNpZ2h0T2ZUaGVRaXJhamkgPSBuZXcgQnVmZihcIkluc2lnaHQgb2YgdGhlIFFpcmFqaVwiLCAzMCwge2FybW9yUGVuZXRyYXRpb246IDIwMH0sIHRydWUsIDAsIDYpO1xuICAgICAgICAgICAgY29uc3QgYmFkZ2VCdWZmID0gbmV3IFNwZWxsQnVmZihcbiAgICAgICAgICAgICAgICBuZXcgQnVmZlByb2MoXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiLCAzMCxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFByb2MobmV3IFNwZWxsQnVmZihpbnNpZ2h0T2ZUaGVRaXJhamkpLCB7cHBtOiAxNX0pLFxuICAgICAgICAgICAgICAgICAgICBpbnNpZ2h0T2ZUaGVRaXJhamkpLFxuICAgICAgICAgICAgICAgIGZhbHNlLCAwLCAzICogNjApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gYmFkZ2VCdWZmO1xuICAgICAgICB9KSgpXG4gICAgfVxuXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4Rm9ySXRlbU5hbWUobmFtZTogc3RyaW5nKTogbnVtYmVyfHVuZGVmaW5lZCB7XG4gICAgZm9yIChsZXQgW2lkeCwgaXRlbV0gb2YgaXRlbXMuZW50cmllcygpKSB7XG4gICAgICAgIGlmIChpdGVtLm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBpZHg7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1XaXRoU2xvdCB9IGZyb20gXCIuL3NpbXVsYXRpb24uanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgV2FycmlvciB9IGZyb20gXCIuL3dhcnJpb3IuanNcIjtcbmltcG9ydCB7IGNydXNhZGVyQnVmZk1IUHJvYywgY3J1c2FkZXJCdWZmT0hQcm9jLCBidWZmcywgd2luZGZ1cnlFbmNoYW50LCBkZW5zZURhbWFnZVN0b25lIH0gZnJvbSBcIi4vZGF0YS9zcGVsbHMuanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IGl0ZW1zIH0gZnJvbSBcIi4vZGF0YS9pdGVtcy5qc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNpbXVsYXRpb25EZXNjcmlwdGlvbiB7XG4gICAgcmFjZTogUmFjZSxcbiAgICBzdGF0czogU3RhdFZhbHVlcyxcbiAgICBlcXVpcG1lbnQ6IFtudW1iZXIsIEl0ZW1TbG90XVtdLFxuICAgIGJ1ZmZzOiBudW1iZXJbXSxcbiAgICBmaWdodExlbmd0aDogbnVtYmVyLFxuICAgIHJlYWx0aW1lOiBib29sZWFuLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBQbGF5ZXIocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgY29uc3QgcGxheWVyID0gbmV3IFdhcnJpb3IocmFjZSwgc3RhdHMsIGxvZyk7XG5cbiAgICBmb3IgKGxldCBbaXRlbSwgc2xvdF0gb2YgZXF1aXBtZW50KSB7XG4gICAgICAgIHBsYXllci5lcXVpcChpdGVtLCBzbG90KTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBidWZmIG9mIGJ1ZmZzKSB7XG4gICAgICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYnVmZiwgMCk7XG4gICAgfVxuXG4gICAgcGxheWVyLm1oIS5hZGRQcm9jKGNydXNhZGVyQnVmZk1IUHJvYyk7XG4gICAgcGxheWVyLm1oIS50ZW1wb3JhcnlFbmNoYW50ID0gcmFjZSA9PT0gUmFjZS5PUkMgPyB3aW5kZnVyeUVuY2hhbnQgOiBkZW5zZURhbWFnZVN0b25lO1xuXG4gICAgaWYgKHBsYXllci5vaCkge1xuICAgICAgICBwbGF5ZXIub2guYWRkUHJvYyhjcnVzYWRlckJ1ZmZPSFByb2MpO1xuICAgICAgICBwbGF5ZXIub2gudGVtcG9yYXJ5RW5jaGFudCA9IGRlbnNlRGFtYWdlU3RvbmU7XG4gICAgfVxuXG4gICAgY29uc3QgYm9zcyA9IG5ldyBVbml0KDYzLCA0NjkxIC0gMjI1MCAtIDY0MCAtIDUwNSAtIDYwMCk7IC8vIHN1bmRlciwgY29yLCBmZiwgYW5uaWhcbiAgICBwbGF5ZXIudGFyZ2V0ID0gYm9zcztcblxuICAgIHJldHVybiBwbGF5ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlcXVpcG1lbnRJbmRpY2VzVG9JdGVtKGVxdWlwbWVudDogW251bWJlciwgSXRlbVNsb3RdW10pOiBJdGVtV2l0aFNsb3RbXSB7XG4gICAgY29uc3QgcmVzOiBJdGVtV2l0aFNsb3RbXSA9IFtdO1xuICAgIFxuICAgIGZvciAobGV0IFtpZHgsIHNsb3RdIG9mIGVxdWlwbWVudCkge1xuICAgICAgICBpZiAoaXRlbXNbaWR4XSkge1xuICAgICAgICAgICAgcmVzLnB1c2goW2l0ZW1zW2lkeF0sIHNsb3RdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgaXRlbSBpbmRleCcsIGlkeCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVmZkluZGljZXNUb0J1ZmYoYnVmZkluZGljZXM6IG51bWJlcltdKTogQnVmZltdIHtcbiAgICBjb25zdCByZXM6IEJ1ZmZbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaWR4IG9mIGJ1ZmZJbmRpY2VzKSB7XG4gICAgICAgIGlmIChidWZmc1tpZHhdKSB7XG4gICAgICAgICAgICByZXMucHVzaChidWZmc1tpZHhdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgYnVmZiBpbmRleCcsIGlkeCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlcztcbn1cbiIsImltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1EZXNjcmlwdGlvbiwgSXRlbVNsb3QgfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgTG9nRnVuY3Rpb24sIFBsYXllciwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgc2V0dXBQbGF5ZXIgfSBmcm9tIFwiLi9zaW11bGF0aW9uX3V0aWxzLmpzXCI7XG5cbmV4cG9ydCB0eXBlIEl0ZW1XaXRoU2xvdCA9IFtJdGVtRGVzY3JpcHRpb24sIEl0ZW1TbG90XTtcblxuLy8gVE9ETyAtIGNoYW5nZSB0aGlzIGludGVyZmFjZSBzbyB0aGF0IENob29zZUFjdGlvbiBjYW5ub3Qgc2NyZXcgdXAgdGhlIHNpbSBvciBjaGVhdFxuLy8gZS5nLiBDaG9vc2VBY3Rpb24gc2hvdWxkbid0IGNhc3Qgc3BlbGxzIGF0IGEgY3VycmVudCB0aW1lXG5leHBvcnQgdHlwZSBDaG9vc2VBY3Rpb24gPSAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlcikgPT4gbnVtYmVyfHVuZGVmaW5lZDtcblxuY2xhc3MgRmlnaHQge1xuICAgIHBsYXllcjogUGxheWVyO1xuICAgIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uO1xuICAgIHByb3RlY3RlZCBmaWdodExlbmd0aDogbnVtYmVyO1xuICAgIGR1cmF0aW9uID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBlcXVpcG1lbnQ6IEl0ZW1XaXRoU2xvdFtdLCBidWZmczogQnVmZltdLCBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbiwgZmlnaHRMZW5ndGggPSA2MCwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBzZXR1cFBsYXllcihyYWNlLCBzdGF0cywgZXF1aXBtZW50LCBidWZmcywgbG9nKTtcbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24gPSBjaG9vc2VBY3Rpb247XG4gICAgICAgIHRoaXMuZmlnaHRMZW5ndGggPSAoZmlnaHRMZW5ndGggKyBNYXRoLnJhbmRvbSgpICogNCAtIDIpICogMTAwMDtcbiAgICB9XG5cbiAgICBydW4oKTogUHJvbWlzZTxGaWdodFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIHdoaWxlICh0aGlzLmR1cmF0aW9uIDw9IHRoaXMuZmlnaHRMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICBkYW1hZ2VEb25lOiB0aGlzLnBsYXllci5kYW1hZ2VEb25lLFxuICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiB0aGlzLmZpZ2h0TGVuZ3RoLFxuICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogdGhpcy5wbGF5ZXIucG93ZXJMb3N0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7fVxuXG4gICAgY2FuY2VsKCkge31cblxuICAgIHByb3RlY3RlZCB1cGRhdGUoKSB7XG4gICAgICAgIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLnVwZGF0ZSh0aGlzLmR1cmF0aW9uKTsgLy8gbmVlZCB0byBjYWxsIHRoaXMgaWYgdGhlIGR1cmF0aW9uIGNoYW5nZWQgYmVjYXVzZSBvZiBidWZmcyB0aGF0IGNoYW5nZSBvdmVyIHRpbWUgbGlrZSBqb20gZ2FiYmVyXG5cbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24odGhpcy5wbGF5ZXIsIHRoaXMuZHVyYXRpb24sIHRoaXMuZmlnaHRMZW5ndGgpOyAvLyBjaG9vc2UgYWN0aW9uIGJlZm9yZSBpbiBjYXNlIG9mIGFjdGlvbiBkZXBlbmRpbmcgb24gdGltZSBvZmYgdGhlIGdjZCBsaWtlIGVhcnRoc3RyaWtlIFxuXG4gICAgICAgIHRoaXMucGxheWVyLnVwZGF0ZUF0dGFja2luZ1N0YXRlKHRoaXMuZHVyYXRpb24pO1xuICAgICAgICAvLyBjaG9vc2UgYWN0aW9uIGFmdGVyIGV2ZXJ5IHN3aW5nIHdoaWNoIGNvdWxkIGJlIGEgcmFnZSBnZW5lcmF0aW5nIGV2ZW50LCBidXQgVE9ETzogbmVlZCB0byBhY2NvdW50IGZvciBsYXRlbmN5LCByZWFjdGlvbiB0aW1lIChidXR0b24gbWFzaGluZylcbiAgICAgICAgY29uc3Qgd2FpdGluZ0ZvclRpbWUgPSB0aGlzLmNob29zZUFjdGlvbih0aGlzLnBsYXllciwgdGhpcy5kdXJhdGlvbiwgdGhpcy5maWdodExlbmd0aCk7XG5cbiAgICAgICAgbGV0IG5leHRTd2luZ1RpbWUgPSB0aGlzLnBsYXllci5taCEubmV4dFN3aW5nVGltZTtcblxuICAgICAgICBpZiAodGhpcy5wbGF5ZXIub2gpIHtcbiAgICAgICAgICAgIG5leHRTd2luZ1RpbWUgPSBNYXRoLm1pbihuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5vaC5uZXh0U3dpbmdUaW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlbXBvcmFyeSBoYWNrXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAvLyBkb24ndCBpbmNyZW1lbnQgZHVyYXRpb24gKFRPRE86IGJ1dCBJIHJlYWxseSBzaG91bGQgYmVjYXVzZSB0aGUgc2VydmVyIGRvZXNuJ3QgbG9vcCBpbnN0YW50bHkpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wbGF5ZXIubmV4dEdDRFRpbWUgPiB0aGlzLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4odGhpcy5wbGF5ZXIubmV4dEdDRFRpbWUsIG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLm5leHRPdmVyVGltZVVwZGF0ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4obmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIubmV4dE92ZXJUaW1lVXBkYXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3YWl0aW5nRm9yVGltZSAmJiB3YWl0aW5nRm9yVGltZSA8IHRoaXMuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSB3YWl0aW5nRm9yVGltZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgUmVhbHRpbWVGaWdodCBleHRlbmRzIEZpZ2h0IHtcbiAgICBwcm90ZWN0ZWQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICBydW4oKTogUHJvbWlzZTxGaWdodFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIGxldCBvdmVycmlkZUR1cmF0aW9uID0gMDtcblxuICAgICAgICAgICAgY29uc3QgbG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVycmlkZUR1cmF0aW9uICs9IDEwMDAgLyA2MDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBvdmVycmlkZUR1cmF0aW9uO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShsb29wKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhbWFnZURvbmU6IHRoaXMucGxheWVyLmRhbWFnZURvbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogdGhpcy5maWdodExlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvd2VyTG9zdDogdGhpcy5wbGF5ZXIucG93ZXJMb3N0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShsb29wKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gIXRoaXMucGF1c2VkO1xuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgRmlnaHRSZXN1bHQgPSB7IGRhbWFnZURvbmU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlciwgcG93ZXJMb3N0OiBudW1iZXJ9O1xuXG5leHBvcnQgY2xhc3MgU2ltdWxhdGlvbiB7XG4gICAgcmFjZTogUmFjZTtcbiAgICBzdGF0czogU3RhdFZhbHVlcztcbiAgICBlcXVpcG1lbnQ6IEl0ZW1XaXRoU2xvdFtdO1xuICAgIGJ1ZmZzOiBCdWZmW107XG4gICAgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb247XG4gICAgcHJvdGVjdGVkIGZpZ2h0TGVuZ3RoOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHJlYWx0aW1lOiBib29sZWFuO1xuICAgIGxvZz86IExvZ0Z1bmN0aW9uXG5cbiAgICBwcm90ZWN0ZWQgcmVxdWVzdFN0b3AgPSBmYWxzZTtcbiAgICBwcm90ZWN0ZWQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICBmaWdodFJlc3VsdHM6IEZpZ2h0UmVzdWx0W10gPSBbXTtcblxuICAgIGN1cnJlbnRGaWdodD86IEZpZ2h0O1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCByZWFsdGltZSA9IGZhbHNlLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICB0aGlzLnJhY2UgPSByYWNlO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuZXF1aXBtZW50ID0gZXF1aXBtZW50O1xuICAgICAgICB0aGlzLmJ1ZmZzID0gYnVmZnM7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gZmlnaHRMZW5ndGg7XG4gICAgICAgIHRoaXMucmVhbHRpbWUgPSByZWFsdGltZTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IHN0YXR1cygpIHtcbiAgICAgICAgY29uc3QgY29tYmluZWRGaWdodFJlc3VsdHMgPSB0aGlzLmZpZ2h0UmVzdWx0cy5yZWR1Y2UoKGFjYzogRmlnaHRSZXN1bHQsIGN1cnJlbnQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZGFtYWdlRG9uZTogYWNjLmRhbWFnZURvbmUgKyBjdXJyZW50LmRhbWFnZURvbmUsXG4gICAgICAgICAgICAgICAgZmlnaHRMZW5ndGg6IGFjYy5maWdodExlbmd0aCArIGN1cnJlbnQuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICAgICAgcG93ZXJMb3N0OiBhY2MucG93ZXJMb3N0ICsgY3VycmVudC5wb3dlckxvc3QsXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHtcbiAgICAgICAgICAgIGRhbWFnZURvbmU6IDAsXG4gICAgICAgICAgICBmaWdodExlbmd0aDogMCxcbiAgICAgICAgICAgIHBvd2VyTG9zdDogMFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAodGhpcy5yZWFsdGltZSAmJiB0aGlzLmN1cnJlbnRGaWdodCkge1xuICAgICAgICAgICAgY29tYmluZWRGaWdodFJlc3VsdHMuZGFtYWdlRG9uZSArPSB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIuZGFtYWdlRG9uZTtcbiAgICAgICAgICAgIGNvbWJpbmVkRmlnaHRSZXN1bHRzLmZpZ2h0TGVuZ3RoICs9IHRoaXMuY3VycmVudEZpZ2h0LmR1cmF0aW9uO1xuICAgICAgICAgICAgY29tYmluZWRGaWdodFJlc3VsdHMucG93ZXJMb3N0ICs9IHRoaXMuY3VycmVudEZpZ2h0LnBsYXllci5wb3dlckxvc3Q7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZGFtYWdlRG9uZTogY29tYmluZWRGaWdodFJlc3VsdHMuZGFtYWdlRG9uZSxcbiAgICAgICAgICAgIGR1cmF0aW9uOiBjb21iaW5lZEZpZ2h0UmVzdWx0cy5maWdodExlbmd0aCxcbiAgICAgICAgICAgIGZpZ2h0czogdGhpcy5maWdodFJlc3VsdHMubGVuZ3RoLFxuICAgICAgICAgICAgcG93ZXJMb3N0OiBjb21iaW5lZEZpZ2h0UmVzdWx0cy5wb3dlckxvc3QsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGFydCgpIHtcbiAgICAgICAgY29uc3QgZmlnaHRDbGFzcyA9IHRoaXMucmVhbHRpbWUgPyBSZWFsdGltZUZpZ2h0IDogRmlnaHQ7XG5cbiAgICAgICAgY29uc3Qgb3V0ZXJsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChvdXRlcmxvb3AsIDEwMDApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICAgICAgY29uc3QgaW5uZXJsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjb3VudCA+IDEwMCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KG91dGVybG9vcCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodCA9IG5ldyBmaWdodENsYXNzKHRoaXMucmFjZSwgdGhpcy5zdGF0cywgdGhpcy5lcXVpcG1lbnQsIHRoaXMuYnVmZnMsIHRoaXMuY2hvb3NlQWN0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoLCB0aGlzLnJlYWx0aW1lID8gdGhpcy5sb2cgOiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0LnJ1bigpLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpZ2h0UmVzdWx0cy5wdXNoKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgIGlubmVybG9vcCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghdGhpcy5yZXF1ZXN0U3RvcCkge1xuICAgICAgICAgICAgICAgIGlubmVybG9vcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIG91dGVybG9vcCgpO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLnBhdXNlZCA9ICF0aGlzLnBhdXNlZDtcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEZpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodC5wYXVzZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RvcCgpIHtcbiAgICAgICAgdGhpcy5yZXF1ZXN0U3RvcCA9IHRydWU7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgV2FycmlvciB9IGZyb20gXCIuL3dhcnJpb3JcIjtcbmltcG9ydCB7IEl0ZW1TbG90IH0gZnJvbSBcIi4vaXRlbVwiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjaG9vc2VBY3Rpb24gKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXIpOiBudW1iZXJ8dW5kZWZpbmVkIHtcbiAgICBjb25zdCB3YXJyaW9yID0gPFdhcnJpb3I+cGxheWVyO1xuXG4gICAgY29uc3QgdGltZVJlbWFpbmluZ1NlY29uZHMgPSAoZmlnaHRMZW5ndGggLSB0aW1lKSAvIDEwMDA7XG5cbiAgICBjb25zdCB1c2VJdGVtQnlOYW1lID0gKHNsb3Q6IEl0ZW1TbG90LCBuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgY29uc3QgaXRlbSA9IHBsYXllci5pdGVtcy5nZXQoc2xvdCk7XG4gICAgICAgIGlmIChpdGVtICYmIGl0ZW0uaXRlbS5uYW1lID09PSBuYW1lICYmIGl0ZW0ub251c2UgJiYgaXRlbS5vbnVzZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gaXRlbS5vbnVzZS5jYXN0KHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHdhcnJpb3IucmFnZSA8IDMwICYmIHdhcnJpb3IuYmxvb2RSYWdlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgd2Fycmlvci5ibG9vZFJhZ2UuY2FzdCh0aW1lKTtcbiAgICB9XG5cbiAgICBsZXQgd2FpdGluZ0ZvclRpbWU6IG51bWJlcnx1bmRlZmluZWQ7XG5cbiAgICAvLyBnY2Qgc3BlbGxzXG4gICAgaWYgKHdhcnJpb3IubmV4dEdDRFRpbWUgPD0gdGltZSkge1xuICAgICAgICBpZiAodGltZVJlbWFpbmluZ1NlY29uZHMgPD0gMzAgJiYgd2Fycmlvci5kZWF0aFdpc2guY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgd2Fycmlvci5kZWF0aFdpc2guY2FzdCh0aW1lKTtcbiAgICAgICAgICAgIHVzZUl0ZW1CeU5hbWUoSXRlbVNsb3QuVFJJTktFVDEsIFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIik7XG4gICAgICAgICAgICB1c2VJdGVtQnlOYW1lKEl0ZW1TbG90LlRSSU5LRVQyLCBcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIpO1xuICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgd2Fycmlvci5ibG9vZHRoaXJzdC5jYXN0KHRpbWUpO1xuICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgLy8gbm90IG9yIGFsbW9zdCBvZmYgY29vbGRvd24sIHdhaXQgZm9yIHJhZ2Ugb3IgY29vbGRvd25cbiAgICAgICAgICAgIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LmNvb2xkb3duID4gdGltZSkge1xuICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gd2Fycmlvci5ibG9vZHRoaXJzdC5jb29sZG93bjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLndoaXJsd2luZC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICB3YXJyaW9yLndoaXJsd2luZC5jYXN0KHRpbWUpO1xuICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLnRpbWVSZW1haW5pbmcodGltZSkgPCAxLjUgKyAod2Fycmlvci5sYXRlbmN5IC8gMTAwMCkpIHtcbiAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICBpZiAod2Fycmlvci53aGlybHdpbmQuY29vbGRvd24gPiB0aW1lKSB7XG4gICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSB3YXJyaW9yLndoaXJsd2luZC5jb29sZG93bjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLnJhZ2UgPj0gNTAgJiYgd2Fycmlvci5oYW1zdHJpbmcuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgd2Fycmlvci5oYW1zdHJpbmcuY2FzdCh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICh3YXJyaW9yLnJhZ2UgPj0gNjAgJiYgIXdhcnJpb3IucXVldWVkU3BlbGwpIHtcbiAgICAgICAgd2Fycmlvci5xdWV1ZWRTcGVsbCA9IHdhcnJpb3IuaGVyb2ljU3RyaWtlO1xuICAgICAgICBpZiAod2Fycmlvci5sb2cpIHdhcnJpb3IubG9nKHRpbWUsICdxdWV1ZWluZyBoZXJvaWMgc3RyaWtlJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdhaXRpbmdGb3JUaW1lO1xufVxuIiwiaW1wb3J0IHsgIE1haW5UaHJlYWRJbnRlcmZhY2UgfSBmcm9tIFwiLi93b3JrZXJfZXZlbnRfaW50ZXJmYWNlLmpzXCI7XG5pbXBvcnQgeyBTaW11bGF0aW9uIH0gZnJvbSBcIi4vc2ltdWxhdGlvbi5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbkRlc2NyaXB0aW9uLCBidWZmSW5kaWNlc1RvQnVmZiwgZXF1aXBtZW50SW5kaWNlc1RvSXRlbSB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBjaG9vc2VBY3Rpb24gfSBmcm9tIFwiLi93YXJyaW9yX2FpLmpzXCI7XG5cbmNvbnN0IG1haW5UaHJlYWRJbnRlcmZhY2UgPSBNYWluVGhyZWFkSW50ZXJmYWNlLmluc3RhbmNlO1xuXG5sZXQgY3VycmVudFNpbTogU2ltdWxhdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbm1haW5UaHJlYWRJbnRlcmZhY2UuYWRkRXZlbnRMaXN0ZW5lcignc2ltdWxhdGUnLCAoZGF0YTogYW55KSA9PiB7XG4gICAgY29uc3Qgc2ltZGVzYyA9IDxTaW11bGF0aW9uRGVzY3JpcHRpb24+ZGF0YTtcblxuICAgIGxldCBsb2dGdW5jdGlvbjogTG9nRnVuY3Rpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKHNpbWRlc2MucmVhbHRpbWUpIHtcbiAgICAgICAgbG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIG1haW5UaHJlYWRJbnRlcmZhY2Uuc2VuZCgnbG9nJywge1xuICAgICAgICAgICAgICAgIHRpbWU6IHRpbWUsXG4gICAgICAgICAgICAgICAgdGV4dDogdGV4dFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgY3VycmVudFNpbSA9IG5ldyBTaW11bGF0aW9uKHNpbWRlc2MucmFjZSwgc2ltZGVzYy5zdGF0cyxcbiAgICAgICAgZXF1aXBtZW50SW5kaWNlc1RvSXRlbShzaW1kZXNjLmVxdWlwbWVudCksXG4gICAgICAgIGJ1ZmZJbmRpY2VzVG9CdWZmKHNpbWRlc2MuYnVmZnMpLFxuICAgICAgICBjaG9vc2VBY3Rpb24sIHNpbWRlc2MuZmlnaHRMZW5ndGgsIHNpbWRlc2MucmVhbHRpbWUsIGxvZ0Z1bmN0aW9uKTtcblxuICAgIGN1cnJlbnRTaW0uc3RhcnQoKTtcblxuICAgIHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdzdGF0dXMnLCBjdXJyZW50U2ltIS5zdGF0dXMpO1xuICAgIH0sIDEwMDApO1xufSk7XG5cbm1haW5UaHJlYWRJbnRlcmZhY2UuYWRkRXZlbnRMaXN0ZW5lcigncGF1c2UnLCAoKSA9PiB7XG4gICAgaWYgKGN1cnJlbnRTaW0pIHtcbiAgICAgICAgY3VycmVudFNpbS5wYXVzZSgpO1xuICAgIH1cbn0pO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE1BQU0sb0JBQW9CO0lBR3RCLFlBQVksTUFBVztRQUZ2QixtQkFBYyxHQUF1QyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRzNELE1BQU0sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFPO1lBQ3ZCLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDNUUsS0FBSyxJQUFJLFFBQVEsSUFBSSxzQkFBc0IsRUFBRTtnQkFDekMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUI7U0FDSixDQUFDO0tBQ0w7SUFFRCxnQkFBZ0IsQ0FBQyxLQUFhLEVBQUUsUUFBNkI7UUFDekQsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNoQyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDbEQ7YUFBTTtZQUNILElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7U0FDOUM7S0FDSjtJQUVELElBQUksQ0FBQyxLQUFhLEVBQUUsSUFBUyxFQUFFLFNBQWMsSUFBSTtRQUM3QyxNQUFNLENBQUMsV0FBVyxDQUFDO1lBQ2YsS0FBSyxFQUFFLEtBQUs7WUFDWixJQUFJLEVBQUUsSUFB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
