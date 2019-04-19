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
                fightLength: this.fightLength
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
                        fightLength: this.fightLength
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
                fightLength: acc.fightLength + current.fightLength
            };
        }, {
            damageDone: 0,
            fightLength: 0
        });
        if (this.realtime && this.currentFight) {
            combinedFightResults.damageDone += this.currentFight.player.damageDone;
            combinedFightResults.fightLength += this.currentFight.duration;
        }
        return {
            damageDone: combinedFightResults.damageDone,
            duration: combinedFightResults.fightLength,
            fights: this.fightResults.length
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3BlbGwudHMiLCIuLi9zcmMvaXRlbS50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL3NwZWxscy50cyIsIi4uL3NyYy9kYXRhL2l0ZW1zLnRzIiwiLi4vc3JjL3NpbXVsYXRpb25fdXRpbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbi50cyIsIi4uL3NyYy93YXJyaW9yX2FpLnRzIiwiLi4vc3JjL3J1bl9zaW11bGF0aW9uX3dvcmtlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFdvcmtlckV2ZW50TGlzdGVuZXIgPSAoZGF0YTogYW55KSA9PiB2b2lkO1xuXG5jbGFzcyBXb3JrZXJFdmVudEludGVyZmFjZSB7XG4gICAgZXZlbnRMaXN0ZW5lcnM6IE1hcDxzdHJpbmcsIFdvcmtlckV2ZW50TGlzdGVuZXJbXT4gPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3Rvcih0YXJnZXQ6IGFueSkge1xuICAgICAgICB0YXJnZXQub25tZXNzYWdlID0gKGV2OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldi5kYXRhLmV2ZW50KSB8fCBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcihldi5kYXRhLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IFdvcmtlckV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRMaXN0ZW5lcnMuaGFzKGV2ZW50KSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpIS5wdXNoKGxpc3RlbmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMuc2V0KGV2ZW50LCBbbGlzdGVuZXJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFdlYXBvbkRlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3BlbGwge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICB0eXBlOiBTcGVsbFR5cGU7XG4gICAgaXNfZ2NkOiBib29sZWFuO1xuICAgIGNvc3Q6IG51bWJlcjtcbiAgICBjb29sZG93bjogbnVtYmVyO1xuICAgIHByb3RlY3RlZCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB0eXBlOiBTcGVsbFR5cGUsIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyLCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgICAgIHRoaXMuY29zdCA9IGNvc3Q7XG4gICAgICAgIHRoaXMuY29vbGRvd24gPSBjb29sZG93bjtcbiAgICAgICAgdGhpcy5pc19nY2QgPSBpc19nY2Q7XG4gICAgICAgIHRoaXMuc3BlbGxGID0gc3BlbGxGO1xuICAgIH1cblxuICAgIGNhc3QocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gdGhpcy5zcGVsbEYocGxheWVyLCB0aW1lKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3BlbGwge1xuICAgIHNwZWxsOiBTcGVsbDtcbiAgICBjb29sZG93biA9IDA7XG4gICAgY2FzdGVyOiBQbGF5ZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuc3BlbGwgPSBzcGVsbDtcbiAgICAgICAgdGhpcy5jYXN0ZXIgPSBjYXN0ZXI7XG4gICAgfVxuXG4gICAgb25Db29sZG93bih0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29vbGRvd24gPiB0aW1lO1xuICAgIH1cblxuICAgIHRpbWVSZW1haW5pbmcodGltZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCAodGhpcy5jb29sZG93biAtIHRpbWUpIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgY2FuQ2FzdCh0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkICYmIHRoaXMuY2FzdGVyLm5leHRHQ0RUaW1lID4gdGltZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuY29zdCA+IHRoaXMuY2FzdGVyLnBvd2VyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vbkNvb2xkb3duKHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjYXN0KHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkKSB7XG4gICAgICAgICAgICB0aGlzLmNhc3Rlci5uZXh0R0NEVGltZSA9IHRpbWUgKyAxNTAwICsgdGhpcy5jYXN0ZXIubGF0ZW5jeTsgLy8gVE9ETyAtIG5lZWQgdG8gc3R1ZHkgdGhlIGVmZmVjdHMgb2YgbGF0ZW5jeSBpbiB0aGUgZ2FtZSBhbmQgY29uc2lkZXIgaHVtYW4gcHJlY2lzaW9uXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuY2FzdGVyLnBvd2VyIC09IHRoaXMuc3BlbGwuY29zdDtcblxuICAgICAgICB0aGlzLnNwZWxsLmNhc3QodGhpcy5jYXN0ZXIsIHRpbWUpO1xuXG4gICAgICAgIHRoaXMuY29vbGRvd24gPSB0aW1lICsgdGhpcy5zcGVsbC5jb29sZG93biAqIDEwMDAgKyB0aGlzLmNhc3Rlci5sYXRlbmN5O1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aW5nU3BlbGwgZXh0ZW5kcyBTcGVsbCB7XG4gICAgYm9udXNEYW1hZ2U6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgYm9udXNEYW1hZ2U6IG51bWJlciwgY29zdDogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIGZhbHNlLCBjb3N0LCAwLCAoKSA9PiB7fSk7XG4gICAgICAgIHRoaXMuYm9udXNEYW1hZ2UgPSBib251c0RhbWFnZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3dpbmdTcGVsbCBleHRlbmRzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFN3aW5nU3BlbGw7XG4gICAgXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFN3aW5nU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyKHNwZWxsLCBjYXN0ZXIpO1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7IC8vIFRPRE8gLSBpcyB0aGVyZSBhIHdheSB0byBhdm9pZCB0aGlzIGxpbmU/XG4gICAgfVxufVxuXG5leHBvcnQgZW51bSBTcGVsbFR5cGUge1xuICAgIE5PTkUsXG4gICAgQlVGRixcbiAgICBQSFlTSUNBTCxcbiAgICBQSFlTSUNBTF9XRUFQT04sXG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZSBleHRlbmRzIFNwZWxsIHtcbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyfCgocGxheWVyOiBQbGF5ZXIpID0+IG51bWJlciksIHR5cGU6IFNwZWxsVHlwZSwgaXNfZ2NkOiBib29sZWFuLCBjb3N0OiBudW1iZXIsIGNvb2xkb3duOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgdHlwZSwgaXNfZ2NkLCBjb3N0LCBjb29sZG93biwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRtZyA9ICh0eXBlb2YgYW1vdW50ID09PSBcIm51bWJlclwiKSA/IGFtb3VudCA6IGFtb3VudChwbGF5ZXIpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gU3BlbGxUeXBlLlBIWVNJQ0FMIHx8IHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04pIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPIC0gZG8gcHJvY3MgbGlrZSBmYXRhbCB3b3VuZHMgKHZpcydrYWcpIGFjY291bnQgZm9yIHdlYXBvbiBza2lsbD9cbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZTIgZXh0ZW5kcyBTcGVsbERhbWFnZSB7XG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlciwgdHlwZTogU3BlbGxUeXBlKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGFtb3VudCwgdHlwZSwgZmFsc2UsIDAsIDApO1xuICAgIH1cbn1cblxuY29uc3QgZmF0YWxXb3VuZHMgPSBuZXcgU3BlbGxEYW1hZ2UyKFwiRmF0YWwgV291bmRzXCIsIDI0MCwgU3BlbGxUeXBlLlBIWVNJQ0FMKTtcblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikge1xuICAgICAgICAvLyBzcGVsbHR5cGUgZG9lc24ndCBtYXR0ZXJcbiAgICAgICAgc3VwZXIobmFtZSwgU3BlbGxUeXBlLk5PTkUsIGZhbHNlLCAwLCAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGxheWVyLmV4dHJhQXR0YWNrQ291bnQgKz0gY291bnQ7IC8vIExIIGNvZGUgZG9lcyBub3QgYWxsb3cgbXVsdGlwbGUgYXV0byBhdHRhY2tzIHRvIHN0YWNrIGlmIHRoZXkgcHJvYyB0b2dldGhlci4gQmxpenpsaWtlIG1heSBhbGxvdyB0aGVtIHRvIHN0YWNrIFxuICAgICAgICAgICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYEdhaW5lZCAke2NvdW50fSBleHRyYSBhdHRhY2tzIGZyb20gJHtuYW1lfWApO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbEJ1ZmYgZXh0ZW5kcyBTcGVsbCB7XG4gICAgY29uc3RydWN0b3IoYnVmZjogQnVmZiwgaXNfZ2NkPzogYm9vbGVhbiwgY29zdD86IG51bWJlciwgY29vbGRvd24/OiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoYFNwZWxsQnVmZigke2J1ZmYubmFtZX0pYCwgU3BlbGxUeXBlLkJVRkYsICEhaXNfZ2NkLCBjb3N0IHx8IDAsIGNvb2xkb3duIHx8IDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJ1ZmYsIHRpbWUpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbnR5cGUgcHBtID0ge3BwbTogbnVtYmVyfTtcbnR5cGUgY2hhbmNlID0ge2NoYW5jZTogbnVtYmVyfTtcbnR5cGUgcmF0ZSA9IHBwbSB8IGNoYW5jZTtcblxuZXhwb3J0IGNsYXNzIFByb2Mge1xuICAgIHByb3RlY3RlZCBzcGVsbHM6IFNwZWxsW107XG4gICAgcHJvdGVjdGVkIHJhdGU6IHJhdGU7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwgfCBTcGVsbFtdLCByYXRlOiByYXRlKSB7XG4gICAgICAgIHRoaXMuc3BlbGxzID0gQXJyYXkuaXNBcnJheShzcGVsbCkgPyBzcGVsbCA6IFtzcGVsbF07XG4gICAgICAgIHRoaXMucmF0ZSA9IHJhdGU7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2hhbmNlID0gKDxjaGFuY2U+dGhpcy5yYXRlKS5jaGFuY2UgfHwgKDxwcG0+dGhpcy5yYXRlKS5wcG0gKiB3ZWFwb24uc3BlZWQgLyA2MDtcblxuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8PSBjaGFuY2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IHNwZWxsIG9mIHRoaXMuc3BlbGxzKSB7XG4gICAgICAgICAgICAgICAgc3BlbGwuY2FzdChwbGF5ZXIsIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFByb2MsIFNwZWxsLCBMZWFybmVkU3BlbGwgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgZW51bSBJdGVtU2xvdCB7XG4gICAgTUFJTkhBTkQgPSAxIDw8IDAsXG4gICAgT0ZGSEFORCA9IDEgPDwgMSxcbiAgICBUUklOS0VUMSA9IDEgPDwgMixcbiAgICBUUklOS0VUMiA9IDEgPDwgMyxcbiAgICBIRUFEID0gMSA8PCA0LFxuICAgIE5FQ0sgPSAxIDw8IDUsXG4gICAgU0hPVUxERVIgPSAxIDw8IDYsXG4gICAgQkFDSyA9IDEgPDwgNyxcbiAgICBDSEVTVCA9IDEgPDwgOCxcbiAgICBXUklTVCA9IDEgPDwgOSxcbiAgICBIQU5EUyA9IDEgPDwgMTAsXG4gICAgV0FJU1QgPSAxIDw8IDExLFxuICAgIExFR1MgPSAxIDw8IDEyLFxuICAgIEZFRVQgPSAxIDw8IDEzLFxuICAgIFJJTkcxID0gMSA8PCAxNCxcbiAgICBSSU5HMiA9IDEgPDwgMTUsXG4gICAgUkFOR0VEID0gMSA8PCAxNixcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJdGVtRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzbG90OiBJdGVtU2xvdCxcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG4gICAgb251c2U/OiBTcGVsbCxcbiAgICBvbmVxdWlwPzogUHJvYyxcbn1cblxuZXhwb3J0IGVudW0gV2VhcG9uVHlwZSB7XG4gICAgTUFDRSxcbiAgICBTV09SRCxcbiAgICBBWEUsXG4gICAgREFHR0VSLFxuICAgIE1BQ0UySCxcbiAgICBTV09SRDJILFxuICAgIEFYRTJILFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFdlYXBvbkRlc2NyaXB0aW9uIGV4dGVuZHMgSXRlbURlc2NyaXB0aW9uIHtcbiAgICB0eXBlOiBXZWFwb25UeXBlLFxuICAgIG1pbjogbnVtYmVyLFxuICAgIG1heDogbnVtYmVyLFxuICAgIHNwZWVkOiBudW1iZXIsXG4gICAgb25oaXQ/OiBQcm9jLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNXZWFwb24oaXRlbTogSXRlbURlc2NyaXB0aW9uKTogaXRlbSBpcyBXZWFwb25EZXNjcmlwdGlvbiB7XG4gICAgcmV0dXJuIFwic3BlZWRcIiBpbiBpdGVtO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFcXVpcGVkV2VhcG9uKGl0ZW06IEl0ZW1FcXVpcGVkKTogaXRlbSBpcyBXZWFwb25FcXVpcGVkIHtcbiAgICByZXR1cm4gXCJ3ZWFwb25cIiBpbiBpdGVtO1xufVxuXG5leHBvcnQgY2xhc3MgSXRlbUVxdWlwZWQge1xuICAgIGl0ZW06IEl0ZW1EZXNjcmlwdGlvbjtcbiAgICBvbnVzZT86IExlYXJuZWRTcGVsbDtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5pdGVtID0gaXRlbTtcblxuICAgICAgICBpZiAoaXRlbS5vbnVzZSkge1xuICAgICAgICAgICAgdGhpcy5vbnVzZSA9IG5ldyBMZWFybmVkU3BlbGwoaXRlbS5vbnVzZSwgcGxheWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLm9uZXF1aXApIHsgLy8gVE9ETywgbW92ZSB0aGlzIHRvIGJ1ZmZwcm9jPyB0aGlzIG1heSBiZSBzaW1wbGVyIHRob3VnaCBzaW5jZSB3ZSBrbm93IHRoZSBidWZmIHdvbid0IGJlIHJlbW92ZWRcbiAgICAgICAgICAgIHBsYXllci5hZGRQcm9jKGl0ZW0ub25lcXVpcCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1c2UodGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aGlzLm9udXNlKSB7XG4gICAgICAgICAgICB0aGlzLm9udXNlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wb3JhcnlXZWFwb25FbmNoYW50IHtcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXM7XG4gICAgcHJvYz86IFByb2M7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0cz86IFN0YXRWYWx1ZXMsIHByb2M/OiBQcm9jKSB7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5wcm9jID0gcHJvYztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXZWFwb25FcXVpcGVkIGV4dGVuZHMgSXRlbUVxdWlwZWQge1xuICAgIHdlYXBvbjogV2VhcG9uRGVzY3JpcHRpb247XG4gICAgbmV4dFN3aW5nVGltZTogbnVtYmVyO1xuICAgIHByb2NzOiBQcm9jW10gPSBbXTtcbiAgICBwbGF5ZXI6IFBsYXllcjtcbiAgICB0ZW1wb3JhcnlFbmNoYW50PzogVGVtcG9yYXJ5V2VhcG9uRW5jaGFudDtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IFdlYXBvbkRlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlcihpdGVtLCBwbGF5ZXIpO1xuICAgICAgICB0aGlzLndlYXBvbiA9IGl0ZW07XG4gICAgICAgIFxuICAgICAgICBpZiAoaXRlbS5vbmhpdCkge1xuICAgICAgICAgICAgdGhpcy5hZGRQcm9jKGl0ZW0ub25oaXQpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcblxuICAgICAgICB0aGlzLm5leHRTd2luZ1RpbWUgPSAxMDA7IC8vIFRPRE8gLSBuZWVkIHRvIHJlc2V0IHRoaXMgcHJvcGVybHkgaWYgZXZlciB3YW50IHRvIHNpbXVsYXRlIGZpZ2h0cyB3aGVyZSB5b3UgcnVuIG91dFxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0IHBsdXNEYW1hZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnRlbXBvcmFyeUVuY2hhbnQgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5wbHVzRGFtYWdlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLnBsdXNEYW1hZ2VcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2VhcG9uLm1pbiArIHRoaXMucGx1c0RhbWFnZTtcbiAgICB9XG5cbiAgICBnZXQgbWF4KCkge1xuICAgICAgICByZXR1cm4gdGhpcy53ZWFwb24ubWF4ICsgdGhpcy5wbHVzRGFtYWdlO1xuICAgIH1cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcHJvYyh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgcHJvYyBvZiB0aGlzLnByb2NzKSB7XG4gICAgICAgICAgICBwcm9jLnJ1bih0aGlzLnBsYXllciwgdGhpcy53ZWFwb24sIHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2luZGZ1cnkgcHJvY3MgbGFzdFxuICAgICAgICBpZiAodGhpcy50ZW1wb3JhcnlFbmNoYW50ICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5wcm9jKSB7XG4gICAgICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnQucHJvYy5ydW4odGhpcy5wbGF5ZXIsIHRoaXMud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiB1cmFuZChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbWluICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZnJhbmQobWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG1pbiArIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wKHZhbDogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heChtaW4sIHZhbCkpO1xufVxuXG5jb25zdCBERUJVR0dJTkcgPSBmYWxzZTtcblxuaWYgKERFQlVHR0lORykge1xuICAgIC8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL21hdGhpYXNieW5lbnMvNTY3MDkxNyNmaWxlLWRldGVybWluaXN0aWMtbWF0aC1yYW5kb20tanNcbiAgICBNYXRoLnJhbmRvbSA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlZWQgPSAweDJGNkUyQjE7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vIFJvYmVydCBKZW5raW5z4oCZIDMyIGJpdCBpbnRlZ2VyIGhhc2ggZnVuY3Rpb25cbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDdFRDU1RDE2KSArIChzZWVkIDw8IDEyKSkgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEM3NjFDMjNDKSBeIChzZWVkID4+PiAxOSkpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweDE2NTY2N0IxKSArIChzZWVkIDw8IDUpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEQzQTI2NDZDKSBeIChzZWVkIDw8IDkpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgKyAweEZENzA0NkM1KSArIChzZWVkIDw8IDMpKSAgICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHNlZWQgPSAoKHNlZWQgXiAweEI1NUE0RjA5KSBeIChzZWVkID4+PiAxNikpICYgMHhGRkZGRkZGRjtcbiAgICAgICAgICAgIHJldHVybiAoc2VlZCAmIDB4RkZGRkZGRikgLyAweDEwMDAwMDAwO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG59XG4iLCJpbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgVW5pdCB7XG4gICAgbGV2ZWw6IG51bWJlcjtcbiAgICBhcm1vcjogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IobGV2ZWw6IG51bWJlciwgYXJtb3I6IG51bWJlcikge1xuICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgIHRoaXMuYXJtb3IgPSBhcm1vcjtcbiAgICB9XG5cbiAgICBnZXQgbWF4U2tpbGxGb3JMZXZlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiA1O1xuICAgIH1cblxuICAgIGdldCBkZWZlbnNlU2tpbGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgfVxuXG4gICAgZ2V0IGRvZGdlQ2hhbmNlKCkge1xuICAgICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVBcm1vclJlZHVjZWREYW1hZ2UoZGFtYWdlOiBudW1iZXIsIGF0dGFja2VyOiBQbGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYXJtb3IgPSBNYXRoLm1heCgwLCB0aGlzLmFybW9yIC0gYXR0YWNrZXIuYnVmZk1hbmFnZXIuc3RhdHMuYXJtb3JQZW5ldHJhdGlvbik7XG4gICAgICAgIFxuICAgICAgICBsZXQgdG1wdmFsdWUgPSAwLjEgKiBhcm1vciAgLyAoKDguNSAqIGF0dGFja2VyLmxldmVsKSArIDQwKTtcbiAgICAgICAgdG1wdmFsdWUgLz0gKDEgKyB0bXB2YWx1ZSk7XG5cbiAgICAgICAgY29uc3QgYXJtb3JNb2RpZmllciA9IGNsYW1wKHRtcHZhbHVlLCAwLCAwLjc1KTtcblxuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMSwgZGFtYWdlIC0gKGRhbWFnZSAqIGFybW9yTW9kaWZpZXIpKTtcbiAgICB9XG59XG4iLCJleHBvcnQgaW50ZXJmYWNlIFN0YXRWYWx1ZXMge1xuICAgIGFwPzogbnVtYmVyO1xuICAgIHN0cj86IG51bWJlcjtcbiAgICBhZ2k/OiBudW1iZXI7XG4gICAgaGl0PzogbnVtYmVyO1xuICAgIGNyaXQ/OiBudW1iZXI7XG4gICAgaGFzdGU/OiBudW1iZXI7XG4gICAgc3RhdE11bHQ/OiBudW1iZXI7XG4gICAgZGFtYWdlTXVsdD86IG51bWJlcjtcbiAgICBhcm1vclBlbmV0cmF0aW9uPzogbnVtYmVyO1xuICAgIHBsdXNEYW1hZ2U/OiBudW1iZXI7XG5cbiAgICBzd29yZFNraWxsPzogbnVtYmVyO1xuICAgIGF4ZVNraWxsPzogbnVtYmVyO1xuICAgIG1hY2VTa2lsbD86IG51bWJlcjtcbiAgICBkYWdnZXJTa2lsbD86IG51bWJlcjtcbiAgICBzd29yZDJIU2tpbGw/OiBudW1iZXI7XG4gICAgYXhlMkhTa2lsbD86IG51bWJlcjtcbiAgICBtYWNlMkhTa2lsbD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFN0YXRzIGltcGxlbWVudHMgU3RhdFZhbHVlcyB7XG4gICAgYXAhOiBudW1iZXI7XG4gICAgc3RyITogbnVtYmVyO1xuICAgIGFnaSE6IG51bWJlcjtcbiAgICBoaXQhOiBudW1iZXI7XG4gICAgY3JpdCE6IG51bWJlcjtcbiAgICBoYXN0ZSE6IG51bWJlcjtcbiAgICBzdGF0TXVsdCE6IG51bWJlcjtcbiAgICBkYW1hZ2VNdWx0ITogbnVtYmVyO1xuICAgIGFybW9yUGVuZXRyYXRpb24hOiBudW1iZXI7XG4gICAgcGx1c0RhbWFnZSE6IG51bWJlcjtcblxuICAgIHN3b3JkU2tpbGwhOiBudW1iZXI7XG4gICAgYXhlU2tpbGwhOiBudW1iZXI7XG4gICAgbWFjZVNraWxsITogbnVtYmVyO1xuICAgIGRhZ2dlclNraWxsITogbnVtYmVyO1xuICAgIHN3b3JkMkhTa2lsbCE6IG51bWJlcjtcbiAgICBheGUySFNraWxsITogbnVtYmVyO1xuICAgIG1hY2UySFNraWxsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3Iocz86IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5zZXQocyk7XG4gICAgfVxuXG4gICAgc2V0KHM/OiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuYXAgPSAocyAmJiBzLmFwKSB8fCAwO1xuICAgICAgICB0aGlzLnN0ciA9IChzICYmIHMuc3RyKSB8fCAwO1xuICAgICAgICB0aGlzLmFnaSA9IChzICYmIHMuYWdpKSB8fCAwO1xuICAgICAgICB0aGlzLmhpdCA9IChzICYmIHMuaGl0KSB8fCAwO1xuICAgICAgICB0aGlzLmNyaXQgPSAocyAmJiBzLmNyaXQpIHx8IDA7XG4gICAgICAgIHRoaXMuaGFzdGUgPSAocyAmJiBzLmhhc3RlKSB8fCAxO1xuICAgICAgICB0aGlzLnN0YXRNdWx0ID0gKHMgJiYgcy5zdGF0TXVsdCkgfHwgMTtcbiAgICAgICAgdGhpcy5kYW1hZ2VNdWx0ID0gKHMgJiYgcy5kYW1hZ2VNdWx0KSB8fCAxO1xuICAgICAgICB0aGlzLmFybW9yUGVuZXRyYXRpb24gPSAocyAmJiBzLmFybW9yUGVuZXRyYXRpb24pIHx8IDA7XG4gICAgICAgIHRoaXMucGx1c0RhbWFnZSA9IChzICYmIHMucGx1c0RhbWFnZSkgfHwgMDtcblxuICAgICAgICB0aGlzLnN3b3JkU2tpbGwgPSAocyAmJiBzLnN3b3JkU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuYXhlU2tpbGwgPSAocyAmJiBzLmF4ZVNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLm1hY2VTa2lsbCA9IChzICYmIHMubWFjZVNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmRhZ2dlclNraWxsID0gKHMgJiYgcy5kYWdnZXJTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5zd29yZDJIU2tpbGwgPSAocyAmJiBzLnN3b3JkMkhTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5heGUySFNraWxsID0gKHMgJiYgcy5heGUySFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLm1hY2UySFNraWxsID0gKHMgJiYgcy5tYWNlMkhTa2lsbCkgfHwgMDtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBhZGQoczogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLmFwICs9IChzLmFwIHx8IDApO1xuICAgICAgICB0aGlzLnN0ciArPSAocy5zdHIgfHwgMCk7XG4gICAgICAgIHRoaXMuYWdpICs9IChzLmFnaSB8fCAwKTtcbiAgICAgICAgdGhpcy5oaXQgKz0gKHMuaGl0IHx8IDApO1xuICAgICAgICB0aGlzLmNyaXQgKz0gKHMuY3JpdCB8fCAwKTtcbiAgICAgICAgdGhpcy5oYXN0ZSAqPSAocy5oYXN0ZSB8fCAxKTtcbiAgICAgICAgdGhpcy5zdGF0TXVsdCAqPSAocy5zdGF0TXVsdCB8fCAxKTtcbiAgICAgICAgdGhpcy5kYW1hZ2VNdWx0ICo9IChzLmRhbWFnZU11bHQgfHwgMSk7XG4gICAgICAgIHRoaXMuYXJtb3JQZW5ldHJhdGlvbiArPSAocy5hcm1vclBlbmV0cmF0aW9uIHx8IDApO1xuICAgICAgICB0aGlzLnBsdXNEYW1hZ2UgKz0gKHMucGx1c0RhbWFnZSB8fCAwKTtcblxuICAgICAgICB0aGlzLnN3b3JkU2tpbGwgKz0gKHMuc3dvcmRTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5heGVTa2lsbCArPSAocy5heGVTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5tYWNlU2tpbGwgKz0gKHMubWFjZVNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmRhZ2dlclNraWxsICs9IChzLmRhZ2dlclNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLnN3b3JkMkhTa2lsbCArPSAocy5zd29yZDJIU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuYXhlMkhTa2lsbCArPSAocy5heGUySFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLm1hY2UySFNraWxsICs9IChzLm1hY2UySFNraWxsIHx8IDApO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFN0YXRzLCBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgUHJvYyB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBCdWZmTWFuYWdlciB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG5cbiAgICBwcml2YXRlIGJ1ZmZMaXN0OiBCdWZmQXBwbGljYXRpb25bXSA9IFtdO1xuICAgIHByaXZhdGUgYnVmZk92ZXJUaW1lTGlzdDogQnVmZk92ZXJUaW1lQXBwbGljYXRpb25bXSA9IFtdO1xuXG4gICAgYmFzZVN0YXRzOiBTdGF0cztcbiAgICBzdGF0czogU3RhdHM7XG5cbiAgICBjb25zdHJ1Y3RvcihwbGF5ZXI6IFBsYXllciwgYmFzZVN0YXRzOiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLmJhc2VTdGF0cyA9IG5ldyBTdGF0cyhiYXNlU3RhdHMpO1xuICAgICAgICB0aGlzLnN0YXRzID0gbmV3IFN0YXRzKHRoaXMuYmFzZVN0YXRzKTtcbiAgICB9XG5cbiAgICBnZXQgbmV4dE92ZXJUaW1lVXBkYXRlKCkge1xuICAgICAgICBsZXQgcmVzID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cbiAgICAgICAgZm9yIChsZXQgYnVmZk9UQXBwIG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgcmVzID0gTWF0aC5taW4ocmVzLCBidWZmT1RBcHAubmV4dFVwZGF0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgLy8gcHJvY2VzcyBsYXN0IHRpY2sgYmVmb3JlIGl0IGlzIHJlbW92ZWRcbiAgICAgICAgZm9yIChsZXQgYnVmZk9UQXBwIG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgYnVmZk9UQXBwLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWUpO1xuXG4gICAgICAgIHRoaXMuc3RhdHMuc2V0KHRoaXMuYmFzZVN0YXRzKTtcblxuICAgICAgICBmb3IgKGxldCB7IGJ1ZmYsIHN0YWNrcyB9IG9mIHRoaXMuYnVmZkxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCB7IGJ1ZmYsIHN0YWNrcyB9IG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgc3RhY2tzID0gYnVmZi5zdGF0c1N0YWNrID8gc3RhY2tzIDogMTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2tzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBidWZmLmFwcGx5KHRoaXMuc3RhdHMsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZChidWZmOiBCdWZmLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCBidWZmQXBwIG9mIHRoaXMuYnVmZkxpc3QpIHtcbiAgICAgICAgICAgIGlmIChidWZmQXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHsgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9nU3RhY2tJbmNyZWFzZSA9IHRoaXMucGxheWVyLmxvZyAmJiAoIWJ1ZmYubWF4U3RhY2tzIHx8IGJ1ZmZBcHAuc3RhY2tzIDwgYnVmZi5tYXhTdGFja3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmLmluaXRpYWxTdGFja3MpIHsgLy8gVE9ETyAtIGNoYW5nZSB0aGlzIHRvIGNoYXJnZXM/XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAuc3RhY2tzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAobG9nU3RhY2tJbmNyZWFzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5ZXIubG9nIShhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gcmVmcmVzaGVkICgke2J1ZmZBcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyhhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gcmVmcmVzaGVkYCk7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAucmVmcmVzaChhcHBseVRpbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IGdhaW5lZGAgKyAoYnVmZi5zdGFja3MgPyBgICgke2J1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxfSlgIDogJycpKTtcblxuICAgICAgICBpZiAoYnVmZiBpbnN0YW5jZW9mIEJ1ZmZPdmVyVGltZSkge1xuICAgICAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0LnB1c2gobmV3IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uKHRoaXMucGxheWVyLCBidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZkxpc3QucHVzaChuZXcgQnVmZkFwcGxpY2F0aW9uKGJ1ZmYsIGFwcGx5VGltZSkpO1xuICAgICAgICB9XG4gICAgICAgIGJ1ZmYuYWRkKGFwcGx5VGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgIH1cblxuICAgIHJlbW92ZShidWZmOiBCdWZmLCB0aW1lOiBudW1iZXIsIGZ1bGwgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZ1bGwgJiYgYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuYnVmZiA9PT0gYnVmZikge1xuICAgICAgICAgICAgICAgIGlmIChidWZmLnN0YWNrcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmYXBwLnN0YWNrcyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSAoJHtidWZmYXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmYXBwLnN0YWNrcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gbG9zdGApO1xuICAgICAgICAgICAgICAgIGJ1ZmZhcHAuYnVmZi5yZW1vdmUodGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZW1vdmVFeHBpcmVkQnVmZnModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHJlbW92ZWRCdWZmczogQnVmZltdID0gW107XG4gICAgICAgIFxuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmV4cGlyYXRpb25UaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVkQnVmZnMucHVzaChidWZmYXBwLmJ1ZmYpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QgPSB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yIChsZXQgYnVmZiBvZiByZW1vdmVkQnVmZnMpIHtcbiAgICAgICAgICAgIGJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGV4cGlyZWRgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmYge1xuICAgIG5hbWU6IFN0cmluZztcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXN8dW5kZWZpbmVkO1xuICAgIHN0YWNrczogYm9vbGVhbjtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGluaXRpYWxTdGFja3M/OiBudW1iZXI7XG4gICAgbWF4U3RhY2tzPzogbnVtYmVyO1xuICAgIHN0YXRzU3RhY2s6IGJvb2xlYW47IC8vIGRvIHlvdSBhZGQgdGhlIHN0YXQgYm9udXMgZm9yIGVhY2ggc3RhY2s/IG9yIGlzIGl0IGxpa2UgZmx1cnJ5IHdoZXJlIHRoZSBzdGFjayBpcyBvbmx5IHRvIGNvdW50IGNoYXJnZXNcblxuICAgIHByaXZhdGUgY2hpbGQ/OiBCdWZmO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0cz86IFN0YXRWYWx1ZXMsIHN0YWNrcz86IGJvb2xlYW4sIGluaXRpYWxTdGFja3M/OiBudW1iZXIsIG1heFN0YWNrcz86IG51bWJlciwgY2hpbGQ/OiBCdWZmLCBzdGF0c1N0YWNrID0gdHJ1ZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5zdGFja3MgPSAhIXN0YWNrcztcbiAgICAgICAgdGhpcy5pbml0aWFsU3RhY2tzID0gaW5pdGlhbFN0YWNrcztcbiAgICAgICAgdGhpcy5tYXhTdGFja3MgPSBtYXhTdGFja3M7XG4gICAgICAgIHRoaXMuY2hpbGQgPSBjaGlsZDtcbiAgICAgICAgdGhpcy5zdGF0c1N0YWNrID0gc3RhdHNTdGFjaztcbiAgICB9XG5cbiAgICBhcHBseShzdGF0czogU3RhdHMsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLnN0YXRzKSB7XG4gICAgICAgICAgICBzdGF0cy5hZGQodGhpcy5zdGF0cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge31cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLmNoaWxkKSB7XG4gICAgICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIucmVtb3ZlKHRoaXMuY2hpbGQsIHRpbWUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmY7XG4gICAgZXhwaXJhdGlvblRpbWUhOiBudW1iZXI7XG5cbiAgICBzdGFja3NWYWwhOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihidWZmOiBCdWZmLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLmJ1ZmYgPSBidWZmO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLnN0YWNrcyA9IHRoaXMuYnVmZi5pbml0aWFsU3RhY2tzIHx8IDE7XG5cbiAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IHRpbWUgKyB0aGlzLmJ1ZmYuZHVyYXRpb24gKiAxMDAwO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1ZmYuZHVyYXRpb24gPiA2MCkge1xuICAgICAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHN0YWNrcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhY2tzVmFsO1xuICAgIH1cblxuICAgIHNldCBzdGFja3Moc3RhY2tzOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3NWYWwgPSB0aGlzLmJ1ZmYubWF4U3RhY2tzID8gTWF0aC5taW4odGhpcy5idWZmLm1heFN0YWNrcywgc3RhY2tzKSA6IHN0YWNrcztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmT3ZlclRpbWUgZXh0ZW5kcyBCdWZmIHtcbiAgICB1cGRhdGVGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZDtcbiAgICB1cGRhdGVJbnRlcnZhbDogbnVtYmVyXG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHN0YXRzOiBTdGF0VmFsdWVzfHVuZGVmaW5lZCwgdXBkYXRlSW50ZXJ2YWw6IG51bWJlciwgdXBkYXRlRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHN0YXRzKTtcbiAgICAgICAgdGhpcy51cGRhdGVGID0gdXBkYXRlRjtcbiAgICAgICAgdGhpcy51cGRhdGVJbnRlcnZhbCA9IHVwZGF0ZUludGVydmFsO1xuICAgIH1cbn1cblxuY2xhc3MgQnVmZk92ZXJUaW1lQXBwbGljYXRpb24gZXh0ZW5kcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmZPdmVyVGltZTtcbiAgICBuZXh0VXBkYXRlITogbnVtYmVyO1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJ1ZmY6IEJ1ZmZPdmVyVGltZSwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoYnVmZiwgYXBwbHlUaW1lKTtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMucmVmcmVzaChhcHBseVRpbWUpO1xuICAgIH1cblxuICAgIHJlZnJlc2godGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyLnJlZnJlc2godGltZSk7XG4gICAgICAgIHRoaXMubmV4dFVwZGF0ZSA9IHRpbWUgKyB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgfVxuXG4gICAgdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGltZSA+PSB0aGlzLm5leHRVcGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMubmV4dFVwZGF0ZSArPSB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgICAgICAgICB0aGlzLmJ1ZmYudXBkYXRlRih0aGlzLnBsYXllciwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmUHJvYyBleHRlbmRzIEJ1ZmYge1xuICAgIHByb2M6IFByb2M7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHByb2M6IFByb2MsIGNoaWxkPzogQnVmZikge1xuICAgICAgICBzdXBlcihuYW1lLCBkdXJhdGlvbiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjaGlsZCk7XG4gICAgICAgIHRoaXMucHJvYyA9IHByb2M7XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIuYWRkKHRpbWUsIHBsYXllcik7XG4gICAgICAgIHBsYXllci5hZGRQcm9jKHRoaXMucHJvYyk7XG4gICAgfVxuXG4gICAgcmVtb3ZlKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIucmVtb3ZlKHRpbWUsIHBsYXllcik7XG4gICAgICAgIHBsYXllci5yZW1vdmVQcm9jKHRoaXMucHJvYyk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgV2VhcG9uRXF1aXBlZCwgV2VhcG9uVHlwZSwgSXRlbURlc2NyaXB0aW9uLCBJdGVtRXF1aXBlZCwgSXRlbVNsb3QsIGlzRXF1aXBlZFdlYXBvbiwgaXNXZWFwb24gfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgdXJhbmQsIGNsYW1wLCBmcmFuZCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IEJ1ZmZNYW5hZ2VyIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgU3BlbGwsIFByb2MsIExlYXJuZWRTd2luZ1NwZWxsLCBTcGVsbFR5cGUgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgZW51bSBSYWNlIHtcbiAgICBIVU1BTixcbiAgICBPUkMsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBQbGF5ZXIgZXh0ZW5kcyBVbml0IHtcbiAgICBpdGVtczogTWFwPEl0ZW1TbG90LCBJdGVtRXF1aXBlZD4gPSBuZXcgTWFwKCk7XG4gICAgcHJvY3M6IFByb2NbXSA9IFtdO1xuXG4gICAgdGFyZ2V0OiBVbml0IHwgdW5kZWZpbmVkO1xuXG4gICAgbmV4dEdDRFRpbWUgPSAwO1xuICAgIGV4dHJhQXR0YWNrQ291bnQgPSAwO1xuICAgIGRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG5cbiAgICBidWZmTWFuYWdlcjogQnVmZk1hbmFnZXI7XG5cbiAgICBkYW1hZ2VEb25lID0gMDtcblxuICAgIHF1ZXVlZFNwZWxsOiBMZWFybmVkU3dpbmdTcGVsbHx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBsb2c/OiBMb2dGdW5jdGlvbjtcblxuICAgIGxhdGVuY3kgPSA1MDsgLy8gbXNcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRzOiBTdGF0VmFsdWVzLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICBzdXBlcig2MCwgMCk7IC8vIGx2bCwgYXJtb3JcblxuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyID0gbmV3IEJ1ZmZNYW5hZ2VyKHRoaXMsIG5ldyBTdGF0cyhzdGF0cykpO1xuICAgICAgICB0aGlzLmxvZyA9IGxvZztcbiAgICB9XG5cbiAgICBnZXQgbWgoKTogV2VhcG9uRXF1aXBlZHx1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBlcXVpcGVkID0gdGhpcy5pdGVtcy5nZXQoSXRlbVNsb3QuTUFJTkhBTkQpO1xuXG4gICAgICAgIGlmIChlcXVpcGVkICYmIGlzRXF1aXBlZFdlYXBvbihlcXVpcGVkKSkge1xuICAgICAgICAgICAgcmV0dXJuIGVxdWlwZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb2goKTogV2VhcG9uRXF1aXBlZHx1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBlcXVpcGVkID0gdGhpcy5pdGVtcy5nZXQoSXRlbVNsb3QuT0ZGSEFORCk7XG5cbiAgICAgICAgaWYgKGVxdWlwZWQgJiYgaXNFcXVpcGVkV2VhcG9uKGVxdWlwZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXF1aXBlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVxdWlwKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgc2xvdDogSXRlbVNsb3QpIHtcbiAgICAgICAgaWYgKHRoaXMuaXRlbXMuaGFzKHNsb3QpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBhbHJlYWR5IGhhdmUgaXRlbSBpbiBzbG90ICR7SXRlbVNsb3Rbc2xvdF19YClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKGl0ZW0uc2xvdCAmIHNsb3QpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBjYW5ub3QgZXF1aXAgJHtpdGVtLm5hbWV9IGluIHNsb3QgJHtJdGVtU2xvdFtzbG90XX1gKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0uc3RhdHMpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYmFzZVN0YXRzLmFkZChpdGVtLnN0YXRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE8gLSBoYW5kbGUgZXF1aXBwaW5nIDJIIChhbmQgaG93IHRoYXQgZGlzYWJsZXMgT0gpXG4gICAgICAgIGlmIChpc1dlYXBvbihpdGVtKSkge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IFdlYXBvbkVxdWlwZWQoaXRlbSwgdGhpcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IEl0ZW1FcXVpcGVkKGl0ZW0sIHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwb3dlcigpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge31cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcmVtb3ZlUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIC8vIFRPRE8gLSBlaXRoZXIgcHJvY3Mgc2hvdWxkIGJlIGEgc2V0IG9yIHdlIG5lZWQgUHJvY0FwcGxpY2F0aW9uXG4gICAgICAgIHRoaXMucHJvY3MgPSB0aGlzLnByb2NzLmZpbHRlcigocHJvYzogUHJvYykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHByb2MgIT09IHA7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGlmIChzcGVsbCAmJiBzcGVsbC50eXBlID09IFNwZWxsVHlwZS5QSFlTSUNBTCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdlYXBvbiA9IGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oITtcbiAgICAgICAgY29uc3Qgd2VhcG9uVHlwZSA9IHdlYXBvbi53ZWFwb24udHlwZTtcblxuICAgICAgICAvLyBUT0RPLCBtYWtlIHRoaXMgYSBtYXBcbiAgICAgICAgc3dpdGNoICh3ZWFwb25UeXBlKSB7XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuTUFDRTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5tYWNlU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuU1dPUkQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3dvcmRTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5BWEU6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXhlU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuREFHR0VSOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhZ2dlclNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLk1BQ0UySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5tYWNlMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5TV09SRDJIOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN3b3JkMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5BWEUySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5heGUySFNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQ3JpdENoYW5jZSgpIHtcbiAgICAgICAgbGV0IGNyaXQgPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmNyaXQ7XG4gICAgICAgIGNyaXQgKz0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5hZ2kgKiB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0YXRNdWx0IC8gMjA7XG5cbiAgICAgICAgcmV0dXJuIGNyaXQ7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBsZXQgcmVzID0gNTtcbiAgICAgICAgcmVzIC09IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuaGl0O1xuXG4gICAgICAgIGlmICh0aGlzLm9oICYmICFzcGVsbCkge1xuICAgICAgICAgICAgcmVzICs9IDE5O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBza2lsbERpZmYgPSB0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgsIHNwZWxsKSAtIHZpY3RpbS5kZWZlbnNlU2tpbGw7XG5cbiAgICAgICAgaWYgKHNraWxsRGlmZiA8IC0xMCkge1xuICAgICAgICAgICAgcmVzIC09IChza2lsbERpZmYgKyAxMCkgKiAwLjQgLSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzIC09IHNraWxsRGlmZiAqIDAuMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbGFtcChyZXMsIDAsIDYwKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlR2xhbmNpbmdSZWR1Y3Rpb24odmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBjb25zdCBza2lsbERpZmYgPSB2aWN0aW0uZGVmZW5zZVNraWxsICAtIHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCk7XG5cbiAgICAgICAgaWYgKHNraWxsRGlmZiA+PSAxNSkge1xuICAgICAgICAgICAgcmV0dXJuIDAuNjU7XG4gICAgICAgIH0gZWxzZSBpZiAoc2tpbGxEaWZmIDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc2tpbGxEaWZmVG9SZWR1Y3Rpb25bc2tpbGxEaWZmXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhcCgpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZVN3aW5nTWluTWF4RGFtYWdlKGlzX21oOiBib29sZWFuKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgICAgIGNvbnN0IHdlYXBvbiA9IGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oITtcblxuICAgICAgICBjb25zdCBhcF9ib251cyA9IHRoaXMuYXAgLyAxNCAqIHdlYXBvbi53ZWFwb24uc3BlZWQ7XG5cbiAgICAgICAgY29uc3Qgb2hQZW5hbHR5ID0gaXNfbWggPyAxIDogMC42MjU7IC8vIFRPRE8gLSBjaGVjayB0YWxlbnRzLCBpbXBsZW1lbnRlZCBhcyBhbiBhdXJhIFNQRUxMX0FVUkFfTU9EX09GRkhBTkRfREFNQUdFX1BDVFxuXG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAod2VhcG9uLm1pbiArIGFwX2JvbnVzKSAqIG9oUGVuYWx0eSxcbiAgICAgICAgICAgICh3ZWFwb24ubWF4ICsgYXBfYm9udXMpICogb2hQZW5hbHR5XG4gICAgICAgIF07XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlU3dpbmdSYXdEYW1hZ2UoaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgcmV0dXJuIGZyYW5kKC4uLnRoaXMuY2FsY3VsYXRlU3dpbmdNaW5NYXhEYW1hZ2UoaXNfbWgpKTtcbiAgICB9XG5cbiAgICByb2xsTWVsZWVIaXRPdXRjb21lKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIHNwZWxsPzogU3BlbGwpOiBNZWxlZUhpdE91dGNvbWUge1xuICAgICAgICBjb25zdCByb2xsID0gdXJhbmQoMCwgMTAwMDApO1xuICAgICAgICBsZXQgc3VtID0gMDtcbiAgICAgICAgbGV0IHRtcCA9IDA7XG5cbiAgICAgICAgLy8gcm91bmRpbmcgaW5zdGVhZCBvZiB0cnVuY2F0aW5nIGJlY2F1c2UgMTkuNCAqIDEwMCB3YXMgdHJ1bmNhdGluZyB0byAxOTM5LlxuICAgICAgICBjb25zdCBtaXNzX2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVNaXNzQ2hhbmNlKHZpY3RpbSwgaXNfbWgsIHNwZWxsKSAqIDEwMCk7XG4gICAgICAgIGNvbnN0IGRvZGdlX2NoYW5jZSA9IE1hdGgucm91bmQodmljdGltLmRvZGdlQ2hhbmNlICogMTAwKTtcbiAgICAgICAgY29uc3QgY3JpdF9jaGFuY2UgPSBNYXRoLnJvdW5kKHRoaXMuY2FsY3VsYXRlQ3JpdENoYW5jZSgpICogMTAwKTtcblxuICAgICAgICAvLyB3ZWFwb24gc2tpbGwgLSB0YXJnZXQgZGVmZW5zZSAodXN1YWxseSBuZWdhdGl2ZSlcbiAgICAgICAgY29uc3Qgc2tpbGxCb251cyA9IDQgKiAodGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oLCBzcGVsbCkgLSB2aWN0aW0ubWF4U2tpbGxGb3JMZXZlbCk7XG5cbiAgICAgICAgdG1wID0gbWlzc19jaGFuY2U7XG5cbiAgICAgICAgaWYgKHRtcCA+IDAgJiYgcm9sbCA8IChzdW0gKz0gdG1wKSkge1xuICAgICAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUztcbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IGRvZGdlX2NoYW5jZSAtIHNraWxsQm9udXM7IC8vIDUuNiAoNTYwKSBmb3IgbHZsIDYzIHdpdGggMzAwIHdlYXBvbiBza2lsbFxuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzcGVsbCkgeyAvLyBzcGVsbHMgY2FuJ3QgZ2xhbmNlXG4gICAgICAgICAgICB0bXAgPSAoMTAgKyAodmljdGltLmRlZmVuc2VTa2lsbCAtIDMwMCkgKiAyKSAqIDEwMDtcbiAgICAgICAgICAgIHRtcCA9IGNsYW1wKHRtcCwgMCwgNDAwMCk7XG4gICAgXG4gICAgICAgICAgICBpZiAocm9sbCA8IChzdW0gKz0gdG1wKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0dMQU5DSU5HO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdG1wID0gY3JpdF9jaGFuY2UgKyBza2lsbEJvbnVzO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IGNyaXRfY2hhbmNlKSkge1xuICAgICAgICAgICAgcmV0dXJuIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX05PUk1BTDtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVCb251c0RhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCBkYW1hZ2VXaXRoQm9udXMgPSByYXdEYW1hZ2U7XG5cbiAgICAgICAgZGFtYWdlV2l0aEJvbnVzICo9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuZGFtYWdlTXVsdDtcblxuICAgICAgICByZXR1cm4gZGFtYWdlV2l0aEJvbnVzO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZTogbnVtYmVyLCB2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKTogW251bWJlciwgTWVsZWVIaXRPdXRjb21lLCBudW1iZXJdIHtcbiAgICAgICAgY29uc3QgZGFtYWdlV2l0aEJvbnVzID0gdGhpcy5jYWxjdWxhdGVCb251c0RhbWFnZShyYXdEYW1hZ2UsIHZpY3RpbSwgc3BlbGwpO1xuICAgICAgICBjb25zdCBhcm1vclJlZHVjZWQgPSB2aWN0aW0uY2FsY3VsYXRlQXJtb3JSZWR1Y2VkRGFtYWdlKGRhbWFnZVdpdGhCb251cywgdGhpcyk7XG4gICAgICAgIGNvbnN0IGhpdE91dGNvbWUgPSB0aGlzLnJvbGxNZWxlZUhpdE91dGNvbWUodmljdGltLCBpc19taCwgc3BlbGwpO1xuXG4gICAgICAgIGxldCBkYW1hZ2UgPSBhcm1vclJlZHVjZWQ7XG4gICAgICAgIGxldCBjbGVhbkRhbWFnZSA9IDA7XG5cbiAgICAgICAgc3dpdGNoIChoaXRPdXRjb21lKSB7XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSAwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFOlxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IDA7XG4gICAgICAgICAgICAgICAgY2xlYW5EYW1hZ2UgPSBkYW1hZ2VXaXRoQm9udXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfR0xBTkNJTkc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVkdWNlUGVyY2VudCA9IHRoaXMuY2FsY3VsYXRlR2xhbmNpbmdSZWR1Y3Rpb24odmljdGltLCBpc19taCk7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gcmVkdWNlUGVyY2VudCAqIGRhbWFnZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUw6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgKj0gMjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBbZGFtYWdlLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV07XG4gICAgfVxuXG4gICAgdXBkYXRlUHJvY3ModGltZTogbnVtYmVyLCBpc19taDogYm9vbGVhbiwgaGl0T3V0Y29tZTogTWVsZWVIaXRPdXRjb21lLCBkYW1hZ2VEb25lOiBudW1iZXIsIGNsZWFuRGFtYWdlOiBudW1iZXIsIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgaWYgKCFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKSkge1xuICAgICAgICAgICAgLy8gd2hhdCBpcyB0aGUgb3JkZXIgb2YgY2hlY2tpbmcgZm9yIHByb2NzIGxpa2UgaG9qLCBpcm9uZm9lIGFuZCB3aW5kZnVyeVxuICAgICAgICAgICAgLy8gb24gTEggY29yZSBpdCBpcyBob2ogPiBpcm9uZm9lID4gd2luZGZ1cnlcblxuICAgICAgICAgICAgLy8gc28gZG8gaXRlbSBwcm9jcyBmaXJzdCwgdGhlbiB3ZWFwb24gcHJvYywgdGhlbiB3aW5kZnVyeVxuICAgICAgICAgICAgZm9yIChsZXQgcHJvYyBvZiB0aGlzLnByb2NzKSB7XG4gICAgICAgICAgICAgICAgcHJvYy5ydW4odGhpcywgKGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oISkud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIChpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCEpLnByb2ModGltZSk7XG4gICAgICAgICAgICAvLyBUT0RPIC0gaW1wbGVtZW50IHdpbmRmdXJ5IGhlcmUsIGl0IHNob3VsZCBzdGlsbCBhZGQgYXR0YWNrIHBvd2VyIGV2ZW4gaWYgdGhlcmUgaXMgYWxyZWFkeSBhbiBleHRyYSBhdHRhY2tcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlYWxNZWxlZURhbWFnZSh0aW1lOiBudW1iZXIsIHJhd0RhbWFnZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsKSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gdGhpcy5jYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2UsIHRhcmdldCwgaXNfbWgsIHNwZWxsKTtcbiAgICAgICAgZGFtYWdlRG9uZSA9IE1hdGgudHJ1bmMoZGFtYWdlRG9uZSk7IC8vIHRydW5jYXRpbmcgaGVyZSBiZWNhdXNlIHdhcnJpb3Igc3ViY2xhc3MgYnVpbGRzIG9uIHRvcCBvZiBjYWxjdWxhdGVNZWxlZURhbWFnZVxuICAgICAgICBjbGVhbkRhbWFnZSA9IE1hdGgudHJ1bmMoY2xlYW5EYW1hZ2UpOyAvLyBUT0RPLCBzaG91bGQgZGFtYWdlTXVsdCBhZmZlY3QgY2xlYW4gZGFtYWdlIGFzIHdlbGw/IGlmIHNvIG1vdmUgaXQgaW50byBjYWxjdWxhdGVNZWxlZURhbWFnZVxuXG4gICAgICAgIHRoaXMuZGFtYWdlRG9uZSArPSBkYW1hZ2VEb25lO1xuICAgICAgICBcbiAgICAgICAgaWYgKHRoaXMubG9nKSB7XG4gICAgICAgICAgICBsZXQgaGl0U3RyID0gYFlvdXIgJHtzcGVsbCA/IHNwZWxsLm5hbWUgOiAoaXNfbWggPyAnbWFpbi1oYW5kJyA6ICdvZmYtaGFuZCcpfSAke2hpdE91dGNvbWVTdHJpbmdbaGl0T3V0Y29tZV19YDtcbiAgICAgICAgICAgIGlmICghW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfTUlTUywgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRV0uaW5jbHVkZXMoaGl0T3V0Y29tZSkpIHtcbiAgICAgICAgICAgICAgICBoaXRTdHIgKz0gYCBmb3IgJHtkYW1hZ2VEb25lfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmxvZyh0aW1lLCBoaXRTdHIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIHNwZWxsKTtcbiAgICAgICAgdGhpcy5idWZmTWFuYWdlci51cGRhdGUodGltZSk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHN3aW5nV2VhcG9uKHRpbWU6IG51bWJlciwgdGFyZ2V0OiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBjb25zdCByYXdEYW1hZ2UgPSB0aGlzLmNhbGN1bGF0ZVN3aW5nUmF3RGFtYWdlKGlzX21oKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyAmJiBpc19taCAmJiB0aGlzLnF1ZXVlZFNwZWxsICYmIHRoaXMucXVldWVkU3BlbGwuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgdGhpcy5xdWV1ZWRTcGVsbC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgY29uc3Qgc3dpbmdTcGVsbCA9IHRoaXMucXVldWVkU3BlbGwuc3BlbGw7XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFNwZWxsID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgY29uc3QgYm9udXNEYW1hZ2UgPSBzd2luZ1NwZWxsLmJvbnVzRGFtYWdlO1xuICAgICAgICAgICAgdGhpcy5kZWFsTWVsZWVEYW1hZ2UodGltZSwgcmF3RGFtYWdlICsgYm9udXNEYW1hZ2UsIHRhcmdldCwgaXNfbWgsIHN3aW5nU3BlbGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWFsTWVsZWVEYW1hZ2UodGltZSwgcmF3RGFtYWdlLCB0YXJnZXQsIGlzX21oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IFt0aGlzV2VhcG9uLCBvdGhlcldlYXBvbl0gPSBpc19taCA/IFt0aGlzLm1oLCB0aGlzLm9oXSA6IFt0aGlzLm9oLCB0aGlzLm1oXTtcblxuICAgICAgICB0aGlzV2VhcG9uIS5uZXh0U3dpbmdUaW1lID0gdGltZSArIHRoaXNXZWFwb24hLndlYXBvbi5zcGVlZCAvIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuaGFzdGUgKiAxMDAwO1xuXG4gICAgICAgIGlmIChvdGhlcldlYXBvbiAmJiBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lIDwgdGltZSArIDIwMCkge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYGRlbGF5aW5nICR7aXNfbWggPyAnT0gnIDogJ01IJ30gc3dpbmdgLCB0aW1lICsgMjAwIC0gb3RoZXJXZWFwb24ubmV4dFN3aW5nVGltZSk7XG4gICAgICAgICAgICBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lID0gdGltZSArIDIwMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUF0dGFja2luZ1N0YXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy50YXJnZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4dHJhQXR0YWNrQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kb2luZ0V4dHJhQXR0YWNrcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHRoaXMuZXh0cmFBdHRhY2tDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXh0cmFBdHRhY2tDb3VudC0tO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aW1lID49IHRoaXMubWghLm5leHRTd2luZ1RpbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCB0cnVlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5vaCAmJiB0aW1lID49IHRoaXMub2gubmV4dFN3aW5nVGltZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciwgTWVsZWVIaXRPdXRjb21lLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmT3ZlclRpbWUgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgU3BlbGwsIExlYXJuZWRTcGVsbCwgU3BlbGxEYW1hZ2UsIFNwZWxsVHlwZSwgU3dpbmdTcGVsbCwgTGVhcm5lZFN3aW5nU3BlbGwsIFByb2MsIFNwZWxsQnVmZiB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcblxuY29uc3QgZmx1cnJ5ID0gbmV3IEJ1ZmYoXCJGbHVycnlcIiwgMTUsIHtoYXN0ZTogMS4zfSwgdHJ1ZSwgMywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKTtcblxuZXhwb3J0IGNvbnN0IHJhY2VUb1N0YXRzID0gbmV3IE1hcDxSYWNlLCBTdGF0VmFsdWVzPigpO1xucmFjZVRvU3RhdHMuc2V0KFJhY2UuSFVNQU4sIHsgbWFjZVNraWxsOiA1LCBzd29yZFNraWxsOiA1LCBtYWNlMkhTa2lsbDogNSwgc3dvcmQySFNraWxsOiA1LCBzdHI6IDEyMCwgYWdpOiA4MCB9KTtcbnJhY2VUb1N0YXRzLnNldChSYWNlLk9SQywgeyBheGVTa2lsbDogNSwgYXhlMkhTa2lsbDogNSwgc3RyOiAxMjMsIGFnaTogNzcgfSk7XG5cbmV4cG9ydCBjbGFzcyBXYXJyaW9yIGV4dGVuZHMgUGxheWVyIHtcbiAgICBmbHVycnlDb3VudCA9IDA7XG4gICAgcmFnZSA9IDgwOyAvLyBUT0RPIC0gYWxsb3cgc2ltdWxhdGlvbiB0byBjaG9vc2Ugc3RhcnRpbmcgcmFnZVxuXG4gICAgZXhlY3V0ZSA9IG5ldyBMZWFybmVkU3BlbGwoZXhlY3V0ZVNwZWxsLCB0aGlzKTtcbiAgICBibG9vZHRoaXJzdCA9IG5ldyBMZWFybmVkU3BlbGwoYmxvb2R0aGlyc3RTcGVsbCwgdGhpcyk7XG4gICAgaGFtc3RyaW5nID0gbmV3IExlYXJuZWRTcGVsbChoYW1zdHJpbmdTcGVsbCwgdGhpcyk7XG4gICAgd2hpcmx3aW5kID0gbmV3IExlYXJuZWRTcGVsbCh3aGlybHdpbmRTcGVsbCwgdGhpcyk7XG4gICAgaGVyb2ljU3RyaWtlID0gbmV3IExlYXJuZWRTd2luZ1NwZWxsKGhlcm9pY1N0cmlrZVNwZWxsLCB0aGlzKTtcbiAgICBibG9vZFJhZ2UgPSBuZXcgTGVhcm5lZFNwZWxsKGJsb29kUmFnZSwgdGhpcyk7XG4gICAgZGVhdGhXaXNoID0gbmV3IExlYXJuZWRTcGVsbChkZWF0aFdpc2gsIHRoaXMpO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGxvZ0NhbGxiYWNrPzogKHRpbWU6IG51bWJlciwgdGV4dDogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgICAgIHN1cGVyKG5ldyBTdGF0cyhyYWNlVG9TdGF0cy5nZXQocmFjZSkpLmFkZChzdGF0cyksIGxvZ0NhbGxiYWNrKTtcblxuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyLmFkZChhbmdlck1hbmFnZW1lbnRPVCwgTWF0aC5yYW5kb20oKSAqIC0zMDAwKTsgLy8gcmFuZG9taXppbmcgYW5nZXIgbWFuYWdlbWVudCB0aW1pbmdcbiAgICB9XG5cbiAgICBnZXQgcG93ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJhZ2U7XG4gICAgfVxuXG4gICAgc2V0IHBvd2VyKHBvd2VyOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5yYWdlID0gY2xhbXAocG93ZXIsIDAsIDEwMCk7XG4gICAgfVxuXG4gICAgZ2V0IGFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sZXZlbCAqIDMgLSAyMCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXAgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN0ciAqIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RhdE11bHQgKiAyO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UoKSB7XG4gICAgICAgIC8vIGNydWVsdHkgKyBiZXJzZXJrZXIgc3RhbmNlXG4gICAgICAgIHJldHVybiA1ICsgMyArIHN1cGVyLmNhbGN1bGF0ZUNyaXRDaGFuY2UoKTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2U6IG51bWJlciwgdmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgc3BlbGw/OiBTcGVsbCk6IFtudW1iZXIsIE1lbGVlSGl0T3V0Y29tZSwgbnVtYmVyXSB7XG4gICAgICAgIGxldCBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdID0gc3VwZXIuY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlLCB2aWN0aW0sIGlzX21oLCBzcGVsbCk7XG5cbiAgICAgICAgaWYgKGhpdE91dGNvbWUgPT09IE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQ1JJVCAmJiBzcGVsbCkge1xuICAgICAgICAgICAgZGFtYWdlRG9uZSAqPSAxLjE7IC8vIGltcGFsZVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gW2RhbWFnZURvbmUsIGhpdE91dGNvbWUsIGNsZWFuRGFtYWdlXTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgcmV3YXJkUmFnZShkYW1hZ2U6IG51bWJlciwgaXNfYXR0YWNrZXI6IGJvb2xlYW4sIHRpbWU6IG51bWJlcikge1xuICAgICAgICAvLyBodHRwczovL2JsdWUubW1vLWNoYW1waW9uLmNvbS90b3BpYy8xODMyNS10aGUtbmV3LXJhZ2UtZm9ybXVsYS1ieS1rYWxnYW4vXG4gICAgICAgIC8vIFByZS1FeHBhbnNpb24gUmFnZSBHYWluZWQgZnJvbSBkZWFsaW5nIGRhbWFnZTpcbiAgICAgICAgLy8gKERhbWFnZSBEZWFsdCkgLyAoUmFnZSBDb252ZXJzaW9uIGF0IFlvdXIgTGV2ZWwpICogNy41XG4gICAgICAgIC8vIEZvciBUYWtpbmcgRGFtYWdlIChib3RoIHByZSBhbmQgcG9zdCBleHBhbnNpb24pOlxuICAgICAgICAvLyBSYWdlIEdhaW5lZCA9IChEYW1hZ2UgVGFrZW4pIC8gKFJhZ2UgQ29udmVyc2lvbiBhdCBZb3VyIExldmVsKSAqIDIuNVxuICAgICAgICAvLyBSYWdlIENvbnZlcnNpb24gYXQgbGV2ZWwgNjA6IDIzMC42XG4gICAgICAgIC8vIFRPRE8gLSBob3cgZG8gZnJhY3Rpb25zIG9mIHJhZ2Ugd29yaz8gaXQgYXBwZWFycyB5b3UgZG8gZ2FpbiBmcmFjdGlvbnMgYmFzZWQgb24gZXhlYyBkYW1hZ2VcbiAgICAgICAgLy8gbm90IHRydW5jYXRpbmcgZm9yIG5vd1xuICAgICAgICBcbiAgICAgICAgY29uc3QgTEVWRUxfNjBfUkFHRV9DT05WID0gMjMwLjY7XG4gICAgICAgIGxldCBhZGRSYWdlID0gZGFtYWdlIC8gTEVWRUxfNjBfUkFHRV9DT05WO1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzX2F0dGFja2VyKSB7XG4gICAgICAgICAgICBhZGRSYWdlICo9IDcuNTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRPRE8gLSBjaGVjayBmb3IgYmVyc2Vya2VyIHJhZ2UgMS4zeCBtb2RpZmllclxuICAgICAgICAgICAgYWRkUmFnZSAqPSAyLjU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5sb2cpIHRoaXMubG9nKHRpbWUsIGBHYWluZWQgJHtNYXRoLm1pbihhZGRSYWdlLCAxMDAgLSB0aGlzLnJhZ2UpfSByYWdlICgke01hdGgubWluKDEwMCwgdGhpcy5wb3dlciArIGFkZFJhZ2UpfSlgKTtcblxuICAgICAgICB0aGlzLnBvd2VyICs9IGFkZFJhZ2U7XG4gICAgfVxuXG4gICAgdXBkYXRlUHJvY3ModGltZTogbnVtYmVyLCBpc19taDogYm9vbGVhbiwgaGl0T3V0Y29tZTogTWVsZWVIaXRPdXRjb21lLCBkYW1hZ2VEb25lOiBudW1iZXIsIGNsZWFuRGFtYWdlOiBudW1iZXIsIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgc3VwZXIudXBkYXRlUHJvY3ModGltZSwgaXNfbWgsIGhpdE91dGNvbWUsIGRhbWFnZURvbmUsIGNsZWFuRGFtYWdlLCBzcGVsbCk7XG5cbiAgICAgICAgaWYgKFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX1BBUlJZLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKSkge1xuICAgICAgICAgICAgaWYgKHNwZWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gaHR0cDovL2JsdWUubW1vLWNoYW1waW9uLmNvbS90b3BpYy82OTM2NS0xOC0wMi0wNS1rYWxnYW5zLXJlc3BvbnNlLXRvLXdhcnJpb3JzLyBcInNpbmNlIG1pc3Npbmcgd2FzdGVzIDIwJSBvZiB0aGUgcmFnZSBjb3N0IG9mIHRoZSBhYmlsaXR5XCJcbiAgICAgICAgICAgICAgICAvLyBUT0RPIC0gbm90IHN1cmUgaG93IGJsaXp6bGlrZSB0aGlzIGlzXG4gICAgICAgICAgICAgICAgaWYgKHNwZWxsICE9PSB3aGlybHdpbmRTcGVsbCkgeyAvLyBUT0RPIC0gc2hvdWxkIGNoZWNrIHRvIHNlZSBpZiBpdCBpcyBhbiBhb2Ugc3BlbGwgb3IgYSBzaW5nbGUgdGFyZ2V0IHNwZWxsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmFnZSArPSBzcGVsbC5jb3N0ICogMC44MjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmV3YXJkUmFnZShjbGVhbkRhbWFnZSAqIDAuNzUsIHRydWUsIHRpbWUpOyAvLyBUT0RPIC0gd2hlcmUgaXMgdGhpcyBmb3JtdWxhIGZyb20/XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZGFtYWdlRG9uZSAmJiAhc3BlbGwpIHtcbiAgICAgICAgICAgIHRoaXMucmV3YXJkUmFnZShkYW1hZ2VEb25lLCB0cnVlLCB0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluc3RhbnQgYXR0YWNrcyBhbmQgbWlzc2VzL2RvZGdlcyBkb24ndCB1c2UgZmx1cnJ5IGNoYXJnZXMgLy8gVE9ETyAtIGNvbmZpcm1cbiAgICAgICAgLy8gZXh0cmEgYXR0YWNrcyBkb24ndCB1c2UgZmx1cnJ5IGNoYXJnZXMgYnV0IHRoZXkgY2FuIHByb2MgZmx1cnJ5ICh0ZXN0ZWQpXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICF0aGlzLmRvaW5nRXh0cmFBdHRhY2tzXG4gICAgICAgICAgICAmJiAhKHNwZWxsIHx8IHNwZWxsID09PSBoZXJvaWNTdHJpa2VTcGVsbClcbiAgICAgICAgICAgICYmICFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKVxuICAgICAgICAgICAgJiYgaGl0T3V0Y29tZSAhPT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXG4gICAgICAgICkgeyBcbiAgICAgICAgICAgIHRoaXMuZmx1cnJ5Q291bnQgPSBNYXRoLm1heCgwLCB0aGlzLmZsdXJyeUNvdW50IC0gMSk7XG4gICAgICAgICAgICAvLyB0aGlzLmJ1ZmZNYW5hZ2VyLnJlbW92ZShmbHVycnksIHRpbWUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoaGl0T3V0Y29tZSA9PT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUKSB7XG4gICAgICAgICAgICAvLyBUT0RPIC0gaWdub3JpbmcgZGVlcCB3b3VuZHNcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYWRkKGZsdXJyeSwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNvbnN0IGhlcm9pY1N0cmlrZVNwZWxsID0gbmV3IFN3aW5nU3BlbGwoXCJIZXJvaWMgU3RyaWtlXCIsIDE1NywgMTIpO1xuXG4vLyBUT0RPIC0gbmVlZHMgdG8gd2lwZSBvdXQgYWxsIHJhZ2UgZXZlbiB0aG91Z2ggaXQgb25seSBjb3N0cyAxMFxuY29uc3QgZXhlY3V0ZVNwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiRXhlY3V0ZVwiLCAocGxheWVyOiBQbGF5ZXIpID0+IHtcbiAgICByZXR1cm4gNjAwICsgKCg8V2Fycmlvcj5wbGF5ZXIpLnJhZ2UgLSAxMCk7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCB0cnVlLCAxMCwgMCk7XG5cbmNvbnN0IGJsb29kdGhpcnN0U3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJCbG9vZHRoaXJzdFwiLCAocGxheWVyOiBQbGF5ZXIpID0+IHtcbiAgICByZXR1cm4gKDxXYXJyaW9yPnBsYXllcikuYXAgKiAwLjQ1O1xufSwgU3BlbGxUeXBlLlBIWVNJQ0FMLCB0cnVlLCAzMCwgNik7XG5cbmNvbnN0IHdoaXJsd2luZFNwZWxsID0gbmV3IFNwZWxsRGFtYWdlKFwiV2hpcmx3aW5kXCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiBwbGF5ZXIuY2FsY3VsYXRlU3dpbmdSYXdEYW1hZ2UodHJ1ZSk7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCB0cnVlLCAyNSwgMTApO1xuXG5jb25zdCBoYW1zdHJpbmdTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkhhbXN0cmluZ1wiLCA0NSwgU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgdHJ1ZSwgMTAsIDApO1xuXG5leHBvcnQgY29uc3QgYW5nZXJNYW5hZ2VtZW50T1QgPSBuZXcgQnVmZk92ZXJUaW1lKFwiQW5nZXIgTWFuYWdlbWVudFwiLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgdW5kZWZpbmVkLCAzMDAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbmVkIDEgcmFnZSBmcm9tIEFuZ2VyIE1hbmFnZW1lbnRgKTtcbn0pO1xuXG5jb25zdCBibG9vZFJhZ2VPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJCbG9vZHJhZ2VcIiwgMTAsIHVuZGVmaW5lZCwgMTAwMCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW5lZCAxIHJhZ2UgZnJvbSBCbG9vZHJhZ2VgKTtcbn0pO1xuXG5jb25zdCBibG9vZFJhZ2UgPSBuZXcgU3BlbGwoXCJCbG9vZHJhZ2VcIiwgU3BlbGxUeXBlLk5PTkUsIGZhbHNlLCAwLCA2MCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBwbGF5ZXIucG93ZXIgKz0gMTA7XG4gICAgaWYgKHBsYXllci5sb2cpIHBsYXllci5sb2codGltZSwgYFlvdSBnYWluIDEwIHJhZ2UgZnJvbSBCbG9vZHJhZ2VgKTtcbiAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJsb29kUmFnZU9ULCB0aW1lKTtcbn0pO1xuXG5jb25zdCBkZWF0aFdpc2ggPSBuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiRGVhdGggV2lzaFwiLCAzMCwgeyBkYW1hZ2VNdWx0OiAxLjIgfSksIHRydWUsIDEwLCAzICogNjApO1xuIiwiaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBTcGVsbEJ1ZmYsIFByb2MsIEV4dHJhQXR0YWNrIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBTdGF0cywgU3RhdFZhbHVlcyB9IGZyb20gXCIuLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgVGVtcG9yYXJ5V2VhcG9uRW5jaGFudCB9IGZyb20gXCIuLi9pdGVtLmpzXCI7XG5cblxuZXhwb3J0IGludGVyZmFjZSBCdWZmRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBkdXJhdGlvbjogbnVtYmVyLFxuICAgIHN0YXRzPzogU3RhdFZhbHVlcyxcbn1cblxuZXhwb3J0IGNvbnN0IGJ1ZmZzOiBCdWZmW10gPSBbXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhdHRsZSBTaG91dFwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDI5MFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxlc3Npbmcgb2YgS2luZ3NcIixcbiAgICAgICAgZHVyYXRpb246IDE1ICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdGF0TXVsdDogMS4xXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2luZyBvZiBNaWdodFwiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAyMjJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlJhbGx5aW5nIENyeSBvZiB0aGUgRHJhZ29uc2xheWVyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFwOiAxNDAsXG4gICAgICAgICAgICBjcml0OiA1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTb25nZmxvd2VyIFNlcmFuYWRlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGNyaXQ6IDUsXG4gICAgICAgICAgICBzdHI6IDE1LFxuICAgICAgICAgICAgYWdpOiAxNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3Bpcml0IG9mIFphbmRhbGFyXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0YXRNdWx0OiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJXYXJjaGllZidzIEJsZXNzaW5nXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGhhc3RlOiAxLjE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTbW9rZWQgRGVzZXJ0IER1bXBsaW5nc1wiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgUG93ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDMwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDMwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJKdWp1IE1pZ2h0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAxMCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDQwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFbGl4aXIgb2YgdGhlIE1vbmdvb3NlXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFnaTogMjUsXG4gICAgICAgICAgICBjcml0OiAyXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSLk8uSS5ELlMuXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMjVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkZlbmd1cycgRmVyb2NpdHlcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDIwMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2lmdCBvZiB0aGUgV2lsZFwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBzdHI6IDE2LCAvLyBUT0RPIC0gc2hvdWxkIGl0IGJlIDEyICogMS4zNT8gKHRhbGVudClcbiAgICAgICAgICAgIGFnaTogMTZcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRydWVzaG90IEF1cmFcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDEwMFxuICAgICAgICB9XG4gICAgfSxcbl0ubWFwKChiZDogQnVmZkRlc2NyaXB0aW9uKSA9PiBuZXcgQnVmZihiZC5uYW1lLCBiZC5kdXJhdGlvbiwgYmQuc3RhdHMpKTtcblxuLy8gTk9URTogdG8gc2ltcGxpZnkgdGhlIGNvZGUsIHRyZWF0aW5nIHRoZXNlIGFzIHR3byBzZXBhcmF0ZSBidWZmcyBzaW5jZSB0aGV5IHN0YWNrXG4vLyBjcnVzYWRlciBidWZmcyBhcHBhcmVudGx5IGNhbiBiZSBmdXJ0aGVyIHN0YWNrZWQgYnkgc3dhcHBpbmcgd2VhcG9ucyBidXQgbm90IGdvaW5nIHRvIGJvdGhlciB3aXRoIHRoYXRcbmV4cG9ydCBjb25zdCBjcnVzYWRlckJ1ZmZNSFByb2MgPSBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiQ3J1c2FkZXIgTUhcIiwgMTUsIG5ldyBTdGF0cyh7c3RyOiAxMDB9KSkpLCB7cHBtOiAxfSk7XG5leHBvcnQgY29uc3QgY3J1c2FkZXJCdWZmT0hQcm9jID0gbmV3IFByb2MobmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIkNydXNhZGVyIE9IXCIsIDE1LCBuZXcgU3RhdHMoe3N0cjogMTAwfSkpKSwge3BwbTogMX0pO1xuXG5leHBvcnQgY29uc3QgZGVuc2VEYW1hZ2VTdG9uZSA9IG5ldyBUZW1wb3JhcnlXZWFwb25FbmNoYW50KHsgcGx1c0RhbWFnZTogOCB9KTtcblxuZXhwb3J0IGNvbnN0IHdpbmRmdXJ5RW5jaGFudCA9IG5ldyBUZW1wb3JhcnlXZWFwb25FbmNoYW50KHVuZGVmaW5lZCwgbmV3IFByb2MoW1xuICAgIG5ldyBFeHRyYUF0dGFjayhcIldpbmRmdXJ5IFRvdGVtXCIsIDEpLFxuICAgIG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJXaW5kZnVyeSBUb3RlbVwiLCAxLjUsIHsgYXA6IDMxNSB9KSlcbl0sIHtjaGFuY2U6IDAuMn0pKTtcbiIsImltcG9ydCB7IFdlYXBvblR5cGUsIFdlYXBvbkRlc2NyaXB0aW9uLCBJdGVtU2xvdCwgSXRlbURlc2NyaXB0aW9uIH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcbmltcG9ydCB7IFNwZWxsQnVmZiwgRXh0cmFBdHRhY2ssIFByb2MsIFNwZWxsIH0gZnJvbSBcIi4uL3NwZWxsLmpzXCI7XG5pbXBvcnQgeyBCdWZmLCBCdWZmUHJvYyB9IGZyb20gXCIuLi9idWZmLmpzXCI7XG5cbi8vIFRPRE8gLSBob3cgdG8gaW1wbGVtZW50IHNldCBib251c2VzPyBwcm9iYWJseSBlYXNpZXN0IHRvIGFkZCBib251cyB0aGF0IHJlcXVpcmVzIGEgc3RyaW5nIHNlYXJjaCBvZiBvdGhlciBlcXVpcGVkIGl0ZW1zXG5cbmV4cG9ydCBjb25zdCBpdGVtczogKEl0ZW1EZXNjcmlwdGlvbnxXZWFwb25EZXNjcmlwdGlvbilbXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSXJvbmZvZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBtaW46IDczLFxuICAgICAgICBtYXg6IDEzNixcbiAgICAgICAgc3BlZWQ6IDIuNCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBFeHRyYUF0dGFjaygnSXJvbmZvZScsIDIpLHtwcG06IDF9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVtcHlyZWFuIERlbW9saXNoZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORCxcbiAgICAgICAgbWluOiA5NCxcbiAgICAgICAgbWF4OiAxNzUsXG4gICAgICAgIHNwZWVkOiAyLjgsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiSGFzdGUgKEVtcHlyZWFuIERlbW9saXNoZXIpXCIsIDEwLCB7aGFzdGU6IDEuMn0pKSx7cHBtOiAxfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJBbnViaXNhdGggV2FyaGFtbWVyXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuTUFDRSxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA2NixcbiAgICAgICAgbWF4OiAxMjMsXG4gICAgICAgIHNwZWVkOiAxLjgsXG4gICAgICAgIHN0YXRzOiB7IG1hY2VTa2lsbDogNCwgYXA6IDMyIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaGUgVW50YW1lZCBCbGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JEMkgsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDE5MixcbiAgICAgICAgbWF4OiAyODksXG4gICAgICAgIHNwZWVkOiAzLjQsXG4gICAgICAgIG9uaGl0OiBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiVW50YW1lZCBGdXJ5XCIsIDgsIHtzdHI6IDMwMH0pKSx7cHBtOiAyfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJIYW5kIG9mIEp1c3RpY2VcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgc3RhdHM6IHthcDogMjB9LFxuICAgICAgICBvbmVxdWlwOiBuZXcgUHJvYyhuZXcgRXh0cmFBdHRhY2soJ0hhbmQgb2YgSnVzdGljZScsIDEpLCB7Y2hhbmNlOiAyLzEwMH0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmxhY2toYW5kJ3MgQnJlYWR0aFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2NyaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRHJha2UgRmFuZyBUYWxpc21hblwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiA1NiwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkxpb25oZWFydCBIZWxtXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhFQUQsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMiwgaGl0OiAyLCBzdHI6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJhcmJlZCBDaG9rZXJcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthcDogNDQsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiT255eGlhIFRvb3RoIFBlbmRhbnRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTkVDSyxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDEyLCBoaXQ6IDEsIGNyaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgU3BhdWxkZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlNIT1VMREVSLFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTYsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDbG9hayBvZiBEcmFjb25pYyBNaWdodFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5CQUNLLFxuICAgICAgICBzdGF0czoge3N0cjogMTYsIGFnaTogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29ucXVlcm9yJ3MgQnJlYXN0cGxhdGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuQ0hFU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhpdmUgRGVmaWxlciBXcmlzdGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIzLCBhZ2k6IDE4fVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlFpcmFqaSBFeGVjdXRpb24gQnJhY2Vyc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5XUklTVCxcbiAgICAgICAgc3RhdHM6IHthZ2k6IDE2LCBzdHI6IDE1LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiR2F1bnRsZXRzIG9mIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMjIsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgQW5uaWhpbGF0aW9uXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czoge3N0cjogMzUsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJFZGdlbWFzdGVyJ3MgSGFuZGd1YXJkc1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5IQU5EUyxcbiAgICAgICAgc3RhdHM6IHsgYXhlU2tpbGw6IDcsIGRhZ2dlclNraWxsOiA3LCBzd29yZFNraWxsOiA3IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJPbnNsYXVnaHQgR2lyZGxlXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldBSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMzEsIGNyaXQ6IDEsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJUaXRhbmljIExlZ2dpbmdzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkxFR1MsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMCwgY3JpdDogMSwgaGl0OiAyfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJvb3RzIG9mIHRoZSBGYWxsZW4gSGVyb1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMTQsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWMgQm9vdHNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuRkVFVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDIwLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiU3RyaWtlcidzIE1hcmtcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUkFOR0VELFxuICAgICAgICBzdGF0czoge2FwOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkRvbiBKdWxpbydzIEJhbmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMSwgaGl0OiAxLCBhcDogMTZ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUXVpY2sgU3RyaWtlIFJpbmdcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuUklORzF8SXRlbVNsb3QuUklORzIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDMwLCBjcml0OiAxLCBzdHI6IDV9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQ2hyb21hdGljYWxseSBUZW1wZXJlZCBTd29yZFwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEwNixcbiAgICAgICAgbWF4OiAxOTgsXG4gICAgICAgIHNwZWVkOiAyLjYsXG4gICAgICAgIHN0YXRzOiB7IGFnaTogMTQsIHN0cjogMTQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk1hbGFkYXRoLCBSdW5lZCBCbGFkZSBvZiB0aGUgQmxhY2sgRmxpZ2h0XCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODYsXG4gICAgICAgIG1heDogMTYyLFxuICAgICAgICBzcGVlZDogMi4yLFxuICAgICAgICBzdGF0czogeyBzd29yZFNraWxsOiA0IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgTG9uZ3N3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgU3dpZnRibGFkZVwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLlNXT1JELFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDg1LFxuICAgICAgICBtYXg6IDEyOSxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJSMTQgQXhlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuQVhFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDEzOCxcbiAgICAgICAgbWF4OiAyMDcsXG4gICAgICAgIHNwZWVkOiAyLjksXG4gICAgICAgIHN0YXRzOiB7IGNyaXQ6IDEsIGFwOiAyOCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuVFJJTktFVDEgfCBJdGVtU2xvdC5UUklOS0VUMixcbiAgICAgICAgb251c2U6ICgoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnNpZ2h0T2ZUaGVRaXJhamkgPSBuZXcgQnVmZihcIkluc2lnaHQgb2YgdGhlIFFpcmFqaVwiLCAzMCwge2FybW9yUGVuZXRyYXRpb246IDIwMH0sIHRydWUsIDAsIDYpO1xuICAgICAgICAgICAgY29uc3QgYmFkZ2VCdWZmID0gbmV3IFNwZWxsQnVmZihcbiAgICAgICAgICAgICAgICBuZXcgQnVmZlByb2MoXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiLCAzMCxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFByb2MobmV3IFNwZWxsQnVmZihpbnNpZ2h0T2ZUaGVRaXJhamkpLCB7cHBtOiAxNX0pLFxuICAgICAgICAgICAgICAgICAgICBpbnNpZ2h0T2ZUaGVRaXJhamkpLFxuICAgICAgICAgICAgICAgIGZhbHNlLCAwLCAzICogNjApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gYmFkZ2VCdWZmO1xuICAgICAgICB9KSgpXG4gICAgfVxuXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4Rm9ySXRlbU5hbWUobmFtZTogc3RyaW5nKTogbnVtYmVyfHVuZGVmaW5lZCB7XG4gICAgZm9yIChsZXQgW2lkeCwgaXRlbV0gb2YgaXRlbXMuZW50cmllcygpKSB7XG4gICAgICAgIGlmIChpdGVtLm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBpZHg7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1XaXRoU2xvdCB9IGZyb20gXCIuL3NpbXVsYXRpb24uanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgV2FycmlvciB9IGZyb20gXCIuL3dhcnJpb3IuanNcIjtcbmltcG9ydCB7IGNydXNhZGVyQnVmZk1IUHJvYywgY3J1c2FkZXJCdWZmT0hQcm9jLCBidWZmcywgd2luZGZ1cnlFbmNoYW50LCBkZW5zZURhbWFnZVN0b25lIH0gZnJvbSBcIi4vZGF0YS9zcGVsbHMuanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IGl0ZW1zIH0gZnJvbSBcIi4vZGF0YS9pdGVtcy5qc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNpbXVsYXRpb25EZXNjcmlwdGlvbiB7XG4gICAgcmFjZTogUmFjZSxcbiAgICBzdGF0czogU3RhdFZhbHVlcyxcbiAgICBlcXVpcG1lbnQ6IFtudW1iZXIsIEl0ZW1TbG90XVtdLFxuICAgIGJ1ZmZzOiBudW1iZXJbXSxcbiAgICBmaWdodExlbmd0aDogbnVtYmVyLFxuICAgIHJlYWx0aW1lOiBib29sZWFuLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBQbGF5ZXIocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgY29uc3QgcGxheWVyID0gbmV3IFdhcnJpb3IocmFjZSwgc3RhdHMsIGxvZyk7XG5cbiAgICBmb3IgKGxldCBbaXRlbSwgc2xvdF0gb2YgZXF1aXBtZW50KSB7XG4gICAgICAgIHBsYXllci5lcXVpcChpdGVtLCBzbG90KTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBidWZmIG9mIGJ1ZmZzKSB7XG4gICAgICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYnVmZiwgMCk7XG4gICAgfVxuXG4gICAgcGxheWVyLm1oIS5hZGRQcm9jKGNydXNhZGVyQnVmZk1IUHJvYyk7XG4gICAgcGxheWVyLm1oIS50ZW1wb3JhcnlFbmNoYW50ID0gcmFjZSA9PT0gUmFjZS5PUkMgPyB3aW5kZnVyeUVuY2hhbnQgOiBkZW5zZURhbWFnZVN0b25lO1xuXG4gICAgaWYgKHBsYXllci5vaCkge1xuICAgICAgICBwbGF5ZXIub2guYWRkUHJvYyhjcnVzYWRlckJ1ZmZPSFByb2MpO1xuICAgICAgICBwbGF5ZXIub2gudGVtcG9yYXJ5RW5jaGFudCA9IGRlbnNlRGFtYWdlU3RvbmU7XG4gICAgfVxuXG4gICAgY29uc3QgYm9zcyA9IG5ldyBVbml0KDYzLCA0NjkxIC0gMjI1MCAtIDY0MCAtIDUwNSAtIDYwMCk7IC8vIHN1bmRlciwgY29yLCBmZiwgYW5uaWhcbiAgICBwbGF5ZXIudGFyZ2V0ID0gYm9zcztcblxuICAgIHJldHVybiBwbGF5ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlcXVpcG1lbnRJbmRpY2VzVG9JdGVtKGVxdWlwbWVudDogW251bWJlciwgSXRlbVNsb3RdW10pOiBJdGVtV2l0aFNsb3RbXSB7XG4gICAgY29uc3QgcmVzOiBJdGVtV2l0aFNsb3RbXSA9IFtdO1xuICAgIFxuICAgIGZvciAobGV0IFtpZHgsIHNsb3RdIG9mIGVxdWlwbWVudCkge1xuICAgICAgICBpZiAoaXRlbXNbaWR4XSkge1xuICAgICAgICAgICAgcmVzLnB1c2goW2l0ZW1zW2lkeF0sIHNsb3RdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgaXRlbSBpbmRleCcsIGlkeCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVmZkluZGljZXNUb0J1ZmYoYnVmZkluZGljZXM6IG51bWJlcltdKTogQnVmZltdIHtcbiAgICBjb25zdCByZXM6IEJ1ZmZbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaWR4IG9mIGJ1ZmZJbmRpY2VzKSB7XG4gICAgICAgIGlmIChidWZmc1tpZHhdKSB7XG4gICAgICAgICAgICByZXMucHVzaChidWZmc1tpZHhdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiYWQgYnVmZiBpbmRleCcsIGlkeCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlcztcbn1cbiIsImltcG9ydCB7IFN0YXRWYWx1ZXMsIFN0YXRzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IEl0ZW1EZXNjcmlwdGlvbiwgSXRlbVNsb3QgfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4vYnVmZi5qc1wiO1xuaW1wb3J0IHsgTG9nRnVuY3Rpb24sIFBsYXllciwgUmFjZSB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgc2V0dXBQbGF5ZXIgfSBmcm9tIFwiLi9zaW11bGF0aW9uX3V0aWxzLmpzXCI7XG5cbmV4cG9ydCB0eXBlIEl0ZW1XaXRoU2xvdCA9IFtJdGVtRGVzY3JpcHRpb24sIEl0ZW1TbG90XTtcblxuLy8gVE9ETyAtIGNoYW5nZSB0aGlzIGludGVyZmFjZSBzbyB0aGF0IENob29zZUFjdGlvbiBjYW5ub3Qgc2NyZXcgdXAgdGhlIHNpbSBvciBjaGVhdFxuLy8gZS5nLiBDaG9vc2VBY3Rpb24gc2hvdWxkbid0IGNhc3Qgc3BlbGxzIGF0IGEgY3VycmVudCB0aW1lXG5leHBvcnQgdHlwZSBDaG9vc2VBY3Rpb24gPSAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlcikgPT4gbnVtYmVyfHVuZGVmaW5lZDtcblxuY2xhc3MgRmlnaHQge1xuICAgIHBsYXllcjogUGxheWVyO1xuICAgIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uO1xuICAgIHByb3RlY3RlZCBmaWdodExlbmd0aDogbnVtYmVyO1xuICAgIGR1cmF0aW9uID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHJhY2U6IFJhY2UsIHN0YXRzOiBTdGF0VmFsdWVzLCBlcXVpcG1lbnQ6IEl0ZW1XaXRoU2xvdFtdLCBidWZmczogQnVmZltdLCBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbiwgZmlnaHRMZW5ndGggPSA2MCwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBzZXR1cFBsYXllcihyYWNlLCBzdGF0cywgZXF1aXBtZW50LCBidWZmcywgbG9nKTtcbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24gPSBjaG9vc2VBY3Rpb247XG4gICAgICAgIHRoaXMuZmlnaHRMZW5ndGggPSAoZmlnaHRMZW5ndGggKyBNYXRoLnJhbmRvbSgpICogNCAtIDIpICogMTAwMDtcbiAgICB9XG5cbiAgICBydW4oKTogUHJvbWlzZTxGaWdodFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIHdoaWxlICh0aGlzLmR1cmF0aW9uIDw9IHRoaXMuZmlnaHRMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICBkYW1hZ2VEb25lOiB0aGlzLnBsYXllci5kYW1hZ2VEb25lLFxuICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiB0aGlzLmZpZ2h0TGVuZ3RoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7fVxuXG4gICAgY2FuY2VsKCkge31cblxuICAgIHByb3RlY3RlZCB1cGRhdGUoKSB7XG4gICAgICAgIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLnVwZGF0ZSh0aGlzLmR1cmF0aW9uKTsgLy8gbmVlZCB0byBjYWxsIHRoaXMgaWYgdGhlIGR1cmF0aW9uIGNoYW5nZWQgYmVjYXVzZSBvZiBidWZmcyB0aGF0IGNoYW5nZSBvdmVyIHRpbWUgbGlrZSBqb20gZ2FiYmVyXG5cbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24odGhpcy5wbGF5ZXIsIHRoaXMuZHVyYXRpb24sIHRoaXMuZmlnaHRMZW5ndGgpOyAvLyBjaG9vc2UgYWN0aW9uIGJlZm9yZSBpbiBjYXNlIG9mIGFjdGlvbiBkZXBlbmRpbmcgb24gdGltZSBvZmYgdGhlIGdjZCBsaWtlIGVhcnRoc3RyaWtlIFxuXG4gICAgICAgIHRoaXMucGxheWVyLnVwZGF0ZUF0dGFja2luZ1N0YXRlKHRoaXMuZHVyYXRpb24pO1xuICAgICAgICAvLyBjaG9vc2UgYWN0aW9uIGFmdGVyIGV2ZXJ5IHN3aW5nIHdoaWNoIGNvdWxkIGJlIGEgcmFnZSBnZW5lcmF0aW5nIGV2ZW50LCBidXQgVE9ETzogbmVlZCB0byBhY2NvdW50IGZvciBsYXRlbmN5LCByZWFjdGlvbiB0aW1lIChidXR0b24gbWFzaGluZylcbiAgICAgICAgY29uc3Qgd2FpdGluZ0ZvclRpbWUgPSB0aGlzLmNob29zZUFjdGlvbih0aGlzLnBsYXllciwgdGhpcy5kdXJhdGlvbiwgdGhpcy5maWdodExlbmd0aCk7XG5cbiAgICAgICAgbGV0IG5leHRTd2luZ1RpbWUgPSB0aGlzLnBsYXllci5taCEubmV4dFN3aW5nVGltZTtcblxuICAgICAgICBpZiAodGhpcy5wbGF5ZXIub2gpIHtcbiAgICAgICAgICAgIG5leHRTd2luZ1RpbWUgPSBNYXRoLm1pbihuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5vaC5uZXh0U3dpbmdUaW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlbXBvcmFyeSBoYWNrXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5leHRyYUF0dGFja0NvdW50KSB7XG4gICAgICAgICAgICAvLyBkb24ndCBpbmNyZW1lbnQgZHVyYXRpb24gKFRPRE86IGJ1dCBJIHJlYWxseSBzaG91bGQgYmVjYXVzZSB0aGUgc2VydmVyIGRvZXNuJ3QgbG9vcCBpbnN0YW50bHkpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wbGF5ZXIubmV4dEdDRFRpbWUgPiB0aGlzLmR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4odGhpcy5wbGF5ZXIubmV4dEdDRFRpbWUsIG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLmJ1ZmZNYW5hZ2VyLm5leHRPdmVyVGltZVVwZGF0ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmR1cmF0aW9uID0gTWF0aC5taW4obmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIubmV4dE92ZXJUaW1lVXBkYXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3YWl0aW5nRm9yVGltZSAmJiB3YWl0aW5nRm9yVGltZSA8IHRoaXMuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSB3YWl0aW5nRm9yVGltZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgUmVhbHRpbWVGaWdodCBleHRlbmRzIEZpZ2h0IHtcbiAgICBwcm90ZWN0ZWQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICBydW4oKTogUHJvbWlzZTxGaWdodFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGYsIHIpID0+IHtcbiAgICAgICAgICAgIGxldCBvdmVycmlkZUR1cmF0aW9uID0gMDtcblxuICAgICAgICAgICAgY29uc3QgbG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kdXJhdGlvbiA8PSB0aGlzLmZpZ2h0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVycmlkZUR1cmF0aW9uICs9IDEwMDAgLyA2MDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBvdmVycmlkZUR1cmF0aW9uO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShsb29wKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhbWFnZURvbmU6IHRoaXMucGxheWVyLmRhbWFnZURvbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogdGhpcy5maWdodExlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUobG9vcCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLnBhdXNlZCA9ICF0aGlzLnBhdXNlZDtcbiAgICB9XG59XG5cbmV4cG9ydCB0eXBlIEZpZ2h0UmVzdWx0ID0geyBkYW1hZ2VEb25lOiBudW1iZXIsIGZpZ2h0TGVuZ3RoOiBudW1iZXJ9O1xuXG5leHBvcnQgY2xhc3MgU2ltdWxhdGlvbiB7XG4gICAgcmFjZTogUmFjZTtcbiAgICBzdGF0czogU3RhdFZhbHVlcztcbiAgICBlcXVpcG1lbnQ6IEl0ZW1XaXRoU2xvdFtdO1xuICAgIGJ1ZmZzOiBCdWZmW107XG4gICAgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb247XG4gICAgcHJvdGVjdGVkIGZpZ2h0TGVuZ3RoOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHJlYWx0aW1lOiBib29sZWFuO1xuICAgIGxvZz86IExvZ0Z1bmN0aW9uXG5cbiAgICBwcm90ZWN0ZWQgcmVxdWVzdFN0b3AgPSBmYWxzZTtcbiAgICBwcm90ZWN0ZWQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICBmaWdodFJlc3VsdHM6IEZpZ2h0UmVzdWx0W10gPSBbXTtcblxuICAgIGN1cnJlbnRGaWdodD86IEZpZ2h0O1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCByZWFsdGltZSA9IGZhbHNlLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICB0aGlzLnJhY2UgPSByYWNlO1xuICAgICAgICB0aGlzLnN0YXRzID0gc3RhdHM7XG4gICAgICAgIHRoaXMuZXF1aXBtZW50ID0gZXF1aXBtZW50O1xuICAgICAgICB0aGlzLmJ1ZmZzID0gYnVmZnM7XG4gICAgICAgIHRoaXMuY2hvb3NlQWN0aW9uID0gY2hvb3NlQWN0aW9uO1xuICAgICAgICB0aGlzLmZpZ2h0TGVuZ3RoID0gZmlnaHRMZW5ndGg7XG4gICAgICAgIHRoaXMucmVhbHRpbWUgPSByZWFsdGltZTtcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgfVxuXG4gICAgZ2V0IHN0YXR1cygpIHtcbiAgICAgICAgY29uc3QgY29tYmluZWRGaWdodFJlc3VsdHMgPSB0aGlzLmZpZ2h0UmVzdWx0cy5yZWR1Y2UoKGFjYywgY3VycmVudCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkYW1hZ2VEb25lOiBhY2MuZGFtYWdlRG9uZSArIGN1cnJlbnQuZGFtYWdlRG9uZSxcbiAgICAgICAgICAgICAgICBmaWdodExlbmd0aDogYWNjLmZpZ2h0TGVuZ3RoICsgY3VycmVudC5maWdodExlbmd0aFxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB7XG4gICAgICAgICAgICBkYW1hZ2VEb25lOiAwLFxuICAgICAgICAgICAgZmlnaHRMZW5ndGg6IDBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHRoaXMucmVhbHRpbWUgJiYgdGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIGNvbWJpbmVkRmlnaHRSZXN1bHRzLmRhbWFnZURvbmUgKz0gdGhpcy5jdXJyZW50RmlnaHQucGxheWVyLmRhbWFnZURvbmU7XG4gICAgICAgICAgICBjb21iaW5lZEZpZ2h0UmVzdWx0cy5maWdodExlbmd0aCArPSB0aGlzLmN1cnJlbnRGaWdodC5kdXJhdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkYW1hZ2VEb25lOiBjb21iaW5lZEZpZ2h0UmVzdWx0cy5kYW1hZ2VEb25lLFxuICAgICAgICAgICAgZHVyYXRpb246IGNvbWJpbmVkRmlnaHRSZXN1bHRzLmZpZ2h0TGVuZ3RoLFxuICAgICAgICAgICAgZmlnaHRzOiB0aGlzLmZpZ2h0UmVzdWx0cy5sZW5ndGhcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICBjb25zdCBmaWdodENsYXNzID0gdGhpcy5yZWFsdGltZSA/IFJlYWx0aW1lRmlnaHQgOiBGaWdodDtcblxuICAgICAgICBjb25zdCBvdXRlcmxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KG91dGVybG9vcCwgMTAwMCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgY291bnQgPSAwO1xuXG4gICAgICAgICAgICBjb25zdCBpbm5lcmxvb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGNvdW50ID4gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0ID0gbmV3IGZpZ2h0Q2xhc3ModGhpcy5yYWNlLCB0aGlzLnN0YXRzLCB0aGlzLmVxdWlwbWVudCwgdGhpcy5idWZmcywgdGhpcy5jaG9vc2VBY3Rpb24sIHRoaXMuZmlnaHRMZW5ndGgsIHRoaXMucmVhbHRpbWUgPyB0aGlzLmxvZyA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQucnVuKCkudGhlbigocmVzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlnaHRSZXN1bHRzLnB1c2gocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgaW5uZXJsb29wKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCF0aGlzLnJlcXVlc3RTdG9wKSB7XG4gICAgICAgICAgICAgICAgaW5uZXJsb29wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgb3V0ZXJsb29wKCk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gIXRoaXMucGF1c2VkO1xuICAgICAgICBpZiAodGhpcy5jdXJyZW50RmlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEZpZ2h0LnBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLnJlcXVlc3RTdG9wID0gdHJ1ZTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2FycmlvclwiO1xuaW1wb3J0IHsgSXRlbVNsb3QgfSBmcm9tIFwiLi9pdGVtXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9wbGF5ZXJcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNob29zZUFjdGlvbiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlcik6IG51bWJlcnx1bmRlZmluZWQge1xuICAgIGNvbnN0IHdhcnJpb3IgPSA8V2Fycmlvcj5wbGF5ZXI7XG5cbiAgICBjb25zdCB0aW1lUmVtYWluaW5nU2Vjb25kcyA9IChmaWdodExlbmd0aCAtIHRpbWUpIC8gMTAwMDtcblxuICAgIGNvbnN0IHVzZUl0ZW1CeU5hbWUgPSAoc2xvdDogSXRlbVNsb3QsIG5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCBpdGVtID0gcGxheWVyLml0ZW1zLmdldChzbG90KTtcbiAgICAgICAgaWYgKGl0ZW0gJiYgaXRlbS5pdGVtLm5hbWUgPT09IG5hbWUgJiYgaXRlbS5vbnVzZSAmJiBpdGVtLm9udXNlLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBpdGVtLm9udXNlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAod2Fycmlvci5yYWdlIDwgMzAgJiYgd2Fycmlvci5ibG9vZFJhZ2UuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICB3YXJyaW9yLmJsb29kUmFnZS5jYXN0KHRpbWUpO1xuICAgIH1cblxuICAgIGxldCB3YWl0aW5nRm9yVGltZTogbnVtYmVyfHVuZGVmaW5lZDtcblxuICAgIC8vIGdjZCBzcGVsbHNcbiAgICBpZiAod2Fycmlvci5uZXh0R0NEVGltZSA8PSB0aW1lKSB7XG4gICAgICAgIGlmICh0aW1lUmVtYWluaW5nU2Vjb25kcyA8PSAzMCAmJiB3YXJyaW9yLmRlYXRoV2lzaC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICB3YXJyaW9yLmRlYXRoV2lzaC5jYXN0KHRpbWUpO1xuICAgICAgICAgICAgdXNlSXRlbUJ5TmFtZShJdGVtU2xvdC5UUklOS0VUMSwgXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiKTtcbiAgICAgICAgICAgIHVzZUl0ZW1CeU5hbWUoSXRlbVNsb3QuVFJJTktFVDIsIFwiQmFkZ2Ugb2YgdGhlIFN3YXJtZ3VhcmRcIik7XG4gICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICB3YXJyaW9yLmJsb29kdGhpcnN0LmNhc3QodGltZSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC50aW1lUmVtYWluaW5nKHRpbWUpIDwgMS41ICsgKHdhcnJpb3IubGF0ZW5jeSAvIDEwMDApKSB7XG4gICAgICAgICAgICAvLyBub3Qgb3IgYWxtb3N0IG9mZiBjb29sZG93biwgd2FpdCBmb3IgcmFnZSBvciBjb29sZG93blxuICAgICAgICAgICAgaWYgKHdhcnJpb3IuYmxvb2R0aGlyc3QuY29vbGRvd24gPiB0aW1lKSB7XG4gICAgICAgICAgICAgICAgd2FpdGluZ0ZvclRpbWUgPSB3YXJyaW9yLmJsb29kdGhpcnN0LmNvb2xkb3duO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHdhcnJpb3Iud2hpcmx3aW5kLmNhc3QodGltZSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci53aGlybHdpbmQudGltZVJlbWFpbmluZyh0aW1lKSA8IDEuNSArICh3YXJyaW9yLmxhdGVuY3kgLyAxMDAwKSkge1xuICAgICAgICAgICAgLy8gbm90IG9yIGFsbW9zdCBvZmYgY29vbGRvd24sIHdhaXQgZm9yIHJhZ2Ugb3IgY29vbGRvd25cbiAgICAgICAgICAgIGlmICh3YXJyaW9yLndoaXJsd2luZC5jb29sZG93biA+IHRpbWUpIHtcbiAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IHdhcnJpb3Iud2hpcmx3aW5kLmNvb2xkb3duO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHdhcnJpb3IucmFnZSA+PSA1MCAmJiB3YXJyaW9yLmhhbXN0cmluZy5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICB3YXJyaW9yLmhhbXN0cmluZy5jYXN0KHRpbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHdhcnJpb3IucmFnZSA+PSA2MCAmJiAhd2Fycmlvci5xdWV1ZWRTcGVsbCkge1xuICAgICAgICB3YXJyaW9yLnF1ZXVlZFNwZWxsID0gd2Fycmlvci5oZXJvaWNTdHJpa2U7XG4gICAgICAgIGlmICh3YXJyaW9yLmxvZykgd2Fycmlvci5sb2codGltZSwgJ3F1ZXVlaW5nIGhlcm9pYyBzdHJpa2UnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gd2FpdGluZ0ZvclRpbWU7XG59XG4iLCJpbXBvcnQgeyAgTWFpblRocmVhZEludGVyZmFjZSB9IGZyb20gXCIuL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UuanNcIjtcbmltcG9ydCB7IFNpbXVsYXRpb24gfSBmcm9tIFwiLi9zaW11bGF0aW9uLmpzXCI7XG5pbXBvcnQgeyBTaW11bGF0aW9uRGVzY3JpcHRpb24sIGJ1ZmZJbmRpY2VzVG9CdWZmLCBlcXVpcG1lbnRJbmRpY2VzVG9JdGVtIH0gZnJvbSBcIi4vc2ltdWxhdGlvbl91dGlscy5qc1wiO1xuaW1wb3J0IHsgTG9nRnVuY3Rpb24gfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IGNob29zZUFjdGlvbiB9IGZyb20gXCIuL3dhcnJpb3JfYWkuanNcIjtcblxuY29uc3QgbWFpblRocmVhZEludGVyZmFjZSA9IE1haW5UaHJlYWRJbnRlcmZhY2UuaW5zdGFuY2U7XG5cbmxldCBjdXJyZW50U2ltOiBTaW11bGF0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxubWFpblRocmVhZEludGVyZmFjZS5hZGRFdmVudExpc3RlbmVyKCdzaW11bGF0ZScsIChkYXRhOiBhbnkpID0+IHtcbiAgICBjb25zdCBzaW1kZXNjID0gPFNpbXVsYXRpb25EZXNjcmlwdGlvbj5kYXRhO1xuXG4gICAgbGV0IGxvZ0Z1bmN0aW9uOiBMb2dGdW5jdGlvbnx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoc2ltZGVzYy5yZWFsdGltZSkge1xuICAgICAgICBsb2dGdW5jdGlvbiA9ICh0aW1lOiBudW1iZXIsIHRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgbWFpblRocmVhZEludGVyZmFjZS5zZW5kKCdsb2cnLCB7XG4gICAgICAgICAgICAgICAgdGltZTogdGltZSxcbiAgICAgICAgICAgICAgICB0ZXh0OiB0ZXh0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjdXJyZW50U2ltID0gbmV3IFNpbXVsYXRpb24oc2ltZGVzYy5yYWNlLCBzaW1kZXNjLnN0YXRzLFxuICAgICAgICBlcXVpcG1lbnRJbmRpY2VzVG9JdGVtKHNpbWRlc2MuZXF1aXBtZW50KSxcbiAgICAgICAgYnVmZkluZGljZXNUb0J1ZmYoc2ltZGVzYy5idWZmcyksXG4gICAgICAgIGNob29zZUFjdGlvbiwgc2ltZGVzYy5maWdodExlbmd0aCwgc2ltZGVzYy5yZWFsdGltZSwgbG9nRnVuY3Rpb24pO1xuXG4gICAgY3VycmVudFNpbS5zdGFydCgpO1xuXG4gICAgc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBtYWluVGhyZWFkSW50ZXJmYWNlLnNlbmQoJ3N0YXR1cycsIGN1cnJlbnRTaW0hLnN0YXR1cyk7XG4gICAgfSwgMTAwMCk7XG59KTtcblxubWFpblRocmVhZEludGVyZmFjZS5hZGRFdmVudExpc3RlbmVyKCdwYXVzZScsICgpID0+IHtcbiAgICBpZiAoY3VycmVudFNpbSkge1xuICAgICAgICBjdXJyZW50U2ltLnBhdXNlKCk7XG4gICAgfVxufSk7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsTUFBTSxvQkFBb0I7SUFHdEIsWUFBWSxNQUFXO1FBRnZCLG1CQUFjLEdBQXVDLElBQUksR0FBRyxFQUFFLENBQUM7UUFHM0QsTUFBTSxDQUFDLFNBQVMsR0FBRyxDQUFDLEVBQU87WUFDdkIsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUM1RSxLQUFLLElBQUksUUFBUSxJQUFJ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QUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxLQUFLLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLEtBQUssQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUM7UUFFM0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFD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
