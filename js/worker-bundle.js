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
    constructor(name, is_gcd, cost, cooldown, spellF) {
        this.name = name;
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
        super(name, false, cost, 0, () => { });
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
    SpellType[SpellType["PHYSICAL"] = 0] = "PHYSICAL";
    SpellType[SpellType["PHYSICAL_WEAPON"] = 1] = "PHYSICAL_WEAPON";
})(SpellType || (SpellType = {}));
class SpellDamage extends Spell {
    constructor(name, amount, type, is_gcd, cost, cooldown) {
        super(name, is_gcd, cost, cooldown, (player, time) => {
            const dmg = (typeof amount === "number") ? amount : amount(player);
            if (type === SpellType.PHYSICAL || type === SpellType.PHYSICAL_WEAPON) {
                const ignore_weapon_skill = type === SpellType.PHYSICAL;
                player.dealMeleeDamage(time, dmg, player.target, true, this, ignore_weapon_skill);
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
        super(name, false, 0, 0, (player, time) => {
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
        super(`SpellBuff(${buff.name})`, !!is_gcd, cost || 0, cooldown || 0, (player, time) => {
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
    calculateWeaponSkillValue(is_mh, ignore_weapon_skill = false) {
        if (ignore_weapon_skill) {
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
    calculateMissChance(victim, is_mh, is_spell, ignore_weapon_skill = false) {
        let res = 5;
        res -= this.buffManager.stats.hit;
        if (this.oh && !is_spell) {
            res += 19;
        }
        const skillDiff = this.calculateWeaponSkillValue(is_mh, ignore_weapon_skill) - victim.defenseSkill;
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
    calculateMinMaxDamage(is_mh) {
        const weapon = is_mh ? this.mh : this.oh;
        const ap_bonus = this.ap / 14 * weapon.weapon.speed;
        return [
            Math.trunc(weapon.min + ap_bonus),
            Math.trunc(weapon.max + ap_bonus)
        ];
    }
    calculateRawDamage(is_mh) {
        return urand(...this.calculateMinMaxDamage(is_mh));
    }
    rollMeleeHitOutcome(victim, is_mh, is_spell, ignore_weapon_skill = false) {
        const roll = urand(0, 10000);
        let sum = 0;
        let tmp = 0;
        const miss_chance = Math.round(this.calculateMissChance(victim, is_mh, is_spell, ignore_weapon_skill) * 100);
        const dodge_chance = Math.round(victim.dodgeChance * 100);
        const crit_chance = Math.round(this.calculateCritChance() * 100);
        const skillBonus = 4 * (this.calculateWeaponSkillValue(is_mh, ignore_weapon_skill) - victim.maxSkillForLevel);
        tmp = miss_chance;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_MISS;
        }
        tmp = dodge_chance - skillBonus;
        if (tmp > 0 && roll < (sum += tmp)) {
            return MeleeHitOutcome.MELEE_HIT_DODGE;
        }
        if (!is_spell) {
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
    calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill = false) {
        const armorReduced = victim.calculateArmorReducedDamage(rawDamage, this);
        const hitOutcome = this.rollMeleeHitOutcome(victim, is_mh, is_spell, ignore_weapon_skill);
        let damage = armorReduced;
        let cleanDamage = 0;
        switch (hitOutcome) {
            case MeleeHitOutcome.MELEE_HIT_MISS:
                {
                    damage = 0;
                    break;
                }
            case MeleeHitOutcome.MELEE_HIT_DODGE:
                {
                    damage = 0;
                    cleanDamage = rawDamage;
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
        if (!is_mh) {
            damage *= 0.625;
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
    dealMeleeDamage(time, rawDamage, target, is_mh, spell, ignore_weapon_skill = false) {
        let [damageDone, hitOutcome, cleanDamage] = this.calculateMeleeDamage(rawDamage, target, is_mh, spell !== undefined, ignore_weapon_skill);
        damageDone = Math.trunc(damageDone * this.buffManager.stats.damageMult);
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
        const rawDamage = this.calculateRawDamage(is_mh);
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
    calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill = false) {
        let [damageDone, hitOutcome, cleanDamage] = super.calculateMeleeDamage(rawDamage, victim, is_mh, is_spell, ignore_weapon_skill);
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT && is_spell) {
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
    return player.calculateRawDamage(true);
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
const bloodRage = new Spell("Bloodrage", false, 0, 60, (player, time) => {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLWJ1bmRsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3dvcmtlcl9ldmVudF9pbnRlcmZhY2UudHMiLCIuLi9zcmMvc3BlbGwudHMiLCIuLi9zcmMvaXRlbS50cyIsIi4uL3NyYy9tYXRoLnRzIiwiLi4vc3JjL3VuaXQudHMiLCIuLi9zcmMvc3RhdHMudHMiLCIuLi9zcmMvYnVmZi50cyIsIi4uL3NyYy9wbGF5ZXIudHMiLCIuLi9zcmMvd2Fycmlvci50cyIsIi4uL3NyYy9kYXRhL3NwZWxscy50cyIsIi4uL3NyYy9kYXRhL2l0ZW1zLnRzIiwiLi4vc3JjL3NpbXVsYXRpb25fdXRpbHMudHMiLCIuLi9zcmMvc2ltdWxhdGlvbi50cyIsIi4uL3NyYy93YXJyaW9yX2FpLnRzIiwiLi4vc3JjL3J1bl9zaW11bGF0aW9uX3dvcmtlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFdvcmtlckV2ZW50TGlzdGVuZXIgPSAoZGF0YTogYW55KSA9PiB2b2lkO1xuXG5jbGFzcyBXb3JrZXJFdmVudEludGVyZmFjZSB7XG4gICAgZXZlbnRMaXN0ZW5lcnM6IE1hcDxzdHJpbmcsIFdvcmtlckV2ZW50TGlzdGVuZXJbXT4gPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3Rvcih0YXJnZXQ6IGFueSkge1xuICAgICAgICB0YXJnZXQub25tZXNzYWdlID0gKGV2OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldi5kYXRhLmV2ZW50KSB8fCBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGV2ZW50TGlzdGVuZXJzRm9yRXZlbnQpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcihldi5kYXRhLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6IFdvcmtlckV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRMaXN0ZW5lcnMuaGFzKGV2ZW50KSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnQpIS5wdXNoKGxpc3RlbmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMuc2V0KGV2ZW50LCBbbGlzdGVuZXJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNlbmQoZXZlbnQ6IHN0cmluZywgZGF0YTogYW55LCB0YXJnZXQ6IGFueSA9IHNlbGYpIHtcbiAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya2VySW50ZXJmYWNlIGV4dGVuZHMgV29ya2VyRXZlbnRJbnRlcmZhY2Uge1xuICAgIHByaXZhdGUgd29ya2VyOiBXb3JrZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZykge1xuICAgICAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHVybCk7Ly8sIHt0eXBlOiAnbW9kdWxlJ30pOyBjYW4ndCB1c2UgdGhpcyB5ZXQgaHR0cHM6Ly9jcmJ1Zy5jb20vNjgwMDQ2XG4gICAgICAgIHN1cGVyKHdvcmtlcik7XG5cbiAgICAgICAgdGhpcy53b3JrZXIgPSB3b3JrZXI7XG4gICAgfVxuXG4gICAgc2VuZChldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgc3VwZXIuc2VuZChldmVudCwgZGF0YSwgdGhpcy53b3JrZXIpO1xuICAgIH1cblxuICAgIHRlcm1pbmF0ZSgpIHtcbiAgICAgICAgdGhpcy53b3JrZXIudGVybWluYXRlKCk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEludGVyZmFjZSBleHRlbmRzIFdvcmtlckV2ZW50SW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6IE1haW5UaHJlYWRJbnRlcmZhY2U7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihzZWxmKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCkge1xuICAgICAgICBpZiAoIU1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlKSB7XG4gICAgICAgICAgICBNYWluVGhyZWFkSW50ZXJmYWNlLl9pbnN0YW5jZSA9IG5ldyBNYWluVGhyZWFkSW50ZXJmYWNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1haW5UaHJlYWRJbnRlcmZhY2UuX2luc3RhbmNlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFdlYXBvbkRlc2NyaXB0aW9uIH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3BlbGwge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBpc19nY2Q6IGJvb2xlYW47XG4gICAgY29zdDogbnVtYmVyO1xuICAgIGNvb2xkb3duOiBudW1iZXI7XG4gICAgcHJvdGVjdGVkIHNwZWxsRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQ7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyLCBzcGVsbEY6IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB2b2lkKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMuY29zdCA9IGNvc3Q7XG4gICAgICAgIHRoaXMuY29vbGRvd24gPSBjb29sZG93bjtcbiAgICAgICAgdGhpcy5pc19nY2QgPSBpc19nY2Q7XG4gICAgICAgIHRoaXMuc3BlbGxGID0gc3BlbGxGO1xuICAgIH1cblxuICAgIGNhc3QocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gdGhpcy5zcGVsbEYocGxheWVyLCB0aW1lKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3BlbGwge1xuICAgIHNwZWxsOiBTcGVsbDtcbiAgICBjb29sZG93biA9IDA7XG4gICAgY2FzdGVyOiBQbGF5ZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHRoaXMuc3BlbGwgPSBzcGVsbDtcbiAgICAgICAgdGhpcy5jYXN0ZXIgPSBjYXN0ZXI7XG4gICAgfVxuXG4gICAgb25Db29sZG93bih0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29vbGRvd24gPiB0aW1lO1xuICAgIH1cblxuICAgIHRpbWVSZW1haW5pbmcodGltZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCAodGhpcy5jb29sZG93biAtIHRpbWUpIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgY2FuQ2FzdCh0aW1lOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkICYmIHRoaXMuY2FzdGVyLm5leHRHQ0RUaW1lID4gdGltZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuY29zdCA+IHRoaXMuY2FzdGVyLnBvd2VyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vbkNvb2xkb3duKHRpbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjYXN0KHRpbWU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3BlbGwuaXNfZ2NkKSB7XG4gICAgICAgICAgICB0aGlzLmNhc3Rlci5uZXh0R0NEVGltZSA9IHRpbWUgKyAxNTAwICsgdGhpcy5jYXN0ZXIubGF0ZW5jeTsgLy8gVE9ETyAtIG5lZWQgdG8gc3R1ZHkgdGhlIGVmZmVjdHMgb2YgbGF0ZW5jeSBpbiB0aGUgZ2FtZSBhbmQgY29uc2lkZXIgaHVtYW4gcHJlY2lzaW9uXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuY2FzdGVyLnBvd2VyIC09IHRoaXMuc3BlbGwuY29zdDtcblxuICAgICAgICB0aGlzLnNwZWxsLmNhc3QodGhpcy5jYXN0ZXIsIHRpbWUpO1xuXG4gICAgICAgIHRoaXMuY29vbGRvd24gPSB0aW1lICsgdGhpcy5zcGVsbC5jb29sZG93biAqIDEwMDAgKyB0aGlzLmNhc3Rlci5sYXRlbmN5O1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN3aW5nU3BlbGwgZXh0ZW5kcyBTcGVsbCB7XG4gICAgYm9udXNEYW1hZ2U6IG51bWJlcjtcblxuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgYm9udXNEYW1hZ2U6IG51bWJlciwgY29zdDogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGZhbHNlLCBjb3N0LCAwLCAoKSA9PiB7fSk7XG4gICAgICAgIHRoaXMuYm9udXNEYW1hZ2UgPSBib251c0RhbWFnZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZWFybmVkU3dpbmdTcGVsbCBleHRlbmRzIExlYXJuZWRTcGVsbCB7XG4gICAgc3BlbGw6IFN3aW5nU3BlbGw7XG4gICAgXG4gICAgY29uc3RydWN0b3Ioc3BlbGw6IFN3aW5nU3BlbGwsIGNhc3RlcjogUGxheWVyKSB7XG4gICAgICAgIHN1cGVyKHNwZWxsLCBjYXN0ZXIpO1xuICAgICAgICB0aGlzLnNwZWxsID0gc3BlbGw7IC8vIFRPRE8gLSBpcyB0aGVyZSBhIHdheSB0byBhdm9pZCB0aGlzIGxpbmU/XG4gICAgfVxufVxuXG5leHBvcnQgZW51bSBTcGVsbFR5cGUge1xuICAgIFBIWVNJQ0FMLFxuICAgIFBIWVNJQ0FMX1dFQVBPTlxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGxEYW1hZ2UgZXh0ZW5kcyBTcGVsbCB7XG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlcnwoKHBsYXllcjogUGxheWVyKSA9PiBudW1iZXIpLCB0eXBlOiBTcGVsbFR5cGUsIGlzX2djZDogYm9vbGVhbiwgY29zdDogbnVtYmVyLCBjb29sZG93bjogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGlzX2djZCwgY29zdCwgY29vbGRvd24sIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkbWcgPSAodHlwZW9mIGFtb3VudCA9PT0gXCJudW1iZXJcIikgPyBhbW91bnQgOiBhbW91bnQocGxheWVyKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTCB8fCB0eXBlID09PSBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OKSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETyAtIGRvIHByb2NzIGxpa2UgZmF0YWwgd291bmRzICh2aXMna2FnKSBhY2NvdW50IGZvciB3ZWFwb24gc2tpbGw/XG4gICAgICAgICAgICAgICAgY29uc3QgaWdub3JlX3dlYXBvbl9za2lsbCA9IHR5cGUgPT09IFNwZWxsVHlwZS5QSFlTSUNBTDtcbiAgICAgICAgICAgICAgICBwbGF5ZXIuZGVhbE1lbGVlRGFtYWdlKHRpbWUsIGRtZywgcGxheWVyLnRhcmdldCEsIHRydWUsIHRoaXMsIGlnbm9yZV93ZWFwb25fc2tpbGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTcGVsbERhbWFnZTIgZXh0ZW5kcyBTcGVsbERhbWFnZSB7XG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhbW91bnQ6IG51bWJlciwgdHlwZTogU3BlbGxUeXBlKSB7XG4gICAgICAgIHN1cGVyKG5hbWUsIGFtb3VudCwgdHlwZSwgZmFsc2UsIDAsIDApO1xuICAgIH1cbn1cblxuY29uc3QgZmF0YWxXb3VuZHMgPSBuZXcgU3BlbGxEYW1hZ2UyKFwiRmF0YWwgV291bmRzXCIsIDI0MCwgU3BlbGxUeXBlLlBIWVNJQ0FMKTtcblxuZXhwb3J0IGNsYXNzIEV4dHJhQXR0YWNrIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikge1xuICAgICAgICBzdXBlcihuYW1lLCBmYWxzZSwgMCwgMCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGlmIChwbGF5ZXIuZXh0cmFBdHRhY2tDb3VudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBsYXllci5leHRyYUF0dGFja0NvdW50ICs9IGNvdW50OyAvLyBMSCBjb2RlIGRvZXMgbm90IGFsbG93IG11bHRpcGxlIGF1dG8gYXR0YWNrcyB0byBzdGFjayBpZiB0aGV5IHByb2MgdG9nZXRoZXIuIEJsaXp6bGlrZSBtYXkgYWxsb3cgdGhlbSB0byBzdGFjayBcbiAgICAgICAgICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBHYWluZWQgJHtjb3VudH0gZXh0cmEgYXR0YWNrcyBmcm9tICR7bmFtZX1gKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3BlbGxCdWZmIGV4dGVuZHMgU3BlbGwge1xuICAgIGNvbnN0cnVjdG9yKGJ1ZmY6IEJ1ZmYsIGlzX2djZD86IGJvb2xlYW4sIGNvc3Q/OiBudW1iZXIsIGNvb2xkb3duPzogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyKGBTcGVsbEJ1ZmYoJHtidWZmLm5hbWV9KWAsICEhaXNfZ2NkLCBjb3N0IHx8IDAsIGNvb2xkb3duIHx8IDAsIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIuYWRkKGJ1ZmYsIHRpbWUpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5cbnR5cGUgcHBtID0ge3BwbTogbnVtYmVyfTtcbnR5cGUgY2hhbmNlID0ge2NoYW5jZTogbnVtYmVyfTtcbnR5cGUgcmF0ZSA9IHBwbSB8IGNoYW5jZTtcblxuZXhwb3J0IGNsYXNzIFByb2Mge1xuICAgIHByb3RlY3RlZCBzcGVsbHM6IFNwZWxsW107XG4gICAgcHJvdGVjdGVkIHJhdGU6IHJhdGU7XG5cbiAgICBjb25zdHJ1Y3RvcihzcGVsbDogU3BlbGwgfCBTcGVsbFtdLCByYXRlOiByYXRlKSB7XG4gICAgICAgIHRoaXMuc3BlbGxzID0gQXJyYXkuaXNBcnJheShzcGVsbCkgPyBzcGVsbCA6IFtzcGVsbF07XG4gICAgICAgIHRoaXMucmF0ZSA9IHJhdGU7XG4gICAgfVxuXG4gICAgcnVuKHBsYXllcjogUGxheWVyLCB3ZWFwb246IFdlYXBvbkRlc2NyaXB0aW9uLCB0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2hhbmNlID0gKDxjaGFuY2U+dGhpcy5yYXRlKS5jaGFuY2UgfHwgKDxwcG0+dGhpcy5yYXRlKS5wcG0gKiB3ZWFwb24uc3BlZWQgLyA2MDtcblxuICAgICAgICBpZiAoTWF0aC5yYW5kb20oKSA8PSBjaGFuY2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IHNwZWxsIG9mIHRoaXMuc3BlbGxzKSB7XG4gICAgICAgICAgICAgICAgc3BlbGwuY2FzdChwbGF5ZXIsIHRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFByb2MsIFNwZWxsLCBMZWFybmVkU3BlbGwgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgZW51bSBJdGVtU2xvdCB7XG4gICAgTUFJTkhBTkQgPSAxIDw8IDAsXG4gICAgT0ZGSEFORCA9IDEgPDwgMSxcbiAgICBUUklOS0VUMSA9IDEgPDwgMixcbiAgICBUUklOS0VUMiA9IDEgPDwgMyxcbiAgICBIRUFEID0gMSA8PCA0LFxuICAgIE5FQ0sgPSAxIDw8IDUsXG4gICAgU0hPVUxERVIgPSAxIDw8IDYsXG4gICAgQkFDSyA9IDEgPDwgNyxcbiAgICBDSEVTVCA9IDEgPDwgOCxcbiAgICBXUklTVCA9IDEgPDwgOSxcbiAgICBIQU5EUyA9IDEgPDwgMTAsXG4gICAgV0FJU1QgPSAxIDw8IDExLFxuICAgIExFR1MgPSAxIDw8IDEyLFxuICAgIEZFRVQgPSAxIDw8IDEzLFxuICAgIFJJTkcxID0gMSA8PCAxNCxcbiAgICBSSU5HMiA9IDEgPDwgMTUsXG4gICAgUkFOR0VEID0gMSA8PCAxNixcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJdGVtRGVzY3JpcHRpb24ge1xuICAgIG5hbWU6IHN0cmluZyxcbiAgICBzbG90OiBJdGVtU2xvdCxcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXMsXG4gICAgb251c2U/OiBTcGVsbCxcbiAgICBvbmVxdWlwPzogUHJvYyxcbn1cblxuZXhwb3J0IGVudW0gV2VhcG9uVHlwZSB7XG4gICAgTUFDRSxcbiAgICBTV09SRCxcbiAgICBBWEUsXG4gICAgREFHR0VSLFxuICAgIE1BQ0UySCxcbiAgICBTV09SRDJILFxuICAgIEFYRTJILFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFdlYXBvbkRlc2NyaXB0aW9uIGV4dGVuZHMgSXRlbURlc2NyaXB0aW9uIHtcbiAgICB0eXBlOiBXZWFwb25UeXBlLFxuICAgIG1pbjogbnVtYmVyLFxuICAgIG1heDogbnVtYmVyLFxuICAgIHNwZWVkOiBudW1iZXIsXG4gICAgb25oaXQ/OiBQcm9jLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNXZWFwb24oaXRlbTogSXRlbURlc2NyaXB0aW9uKTogaXRlbSBpcyBXZWFwb25EZXNjcmlwdGlvbiB7XG4gICAgcmV0dXJuIFwic3BlZWRcIiBpbiBpdGVtO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFcXVpcGVkV2VhcG9uKGl0ZW06IEl0ZW1FcXVpcGVkKTogaXRlbSBpcyBXZWFwb25FcXVpcGVkIHtcbiAgICByZXR1cm4gXCJ3ZWFwb25cIiBpbiBpdGVtO1xufVxuXG5leHBvcnQgY2xhc3MgSXRlbUVxdWlwZWQge1xuICAgIGl0ZW06IEl0ZW1EZXNjcmlwdGlvbjtcbiAgICBvbnVzZT86IExlYXJuZWRTcGVsbDtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5pdGVtID0gaXRlbTtcblxuICAgICAgICBpZiAoaXRlbS5vbnVzZSkge1xuICAgICAgICAgICAgdGhpcy5vbnVzZSA9IG5ldyBMZWFybmVkU3BlbGwoaXRlbS5vbnVzZSwgcGxheWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLm9uZXF1aXApIHsgLy8gVE9ETywgbW92ZSB0aGlzIHRvIGJ1ZmZwcm9jPyB0aGlzIG1heSBiZSBzaW1wbGVyIHRob3VnaCBzaW5jZSB3ZSBrbm93IHRoZSBidWZmIHdvbid0IGJlIHJlbW92ZWRcbiAgICAgICAgICAgIHBsYXllci5hZGRQcm9jKGl0ZW0ub25lcXVpcCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1c2UodGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aGlzLm9udXNlKSB7XG4gICAgICAgICAgICB0aGlzLm9udXNlLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wb3JhcnlXZWFwb25FbmNoYW50IHtcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXM7XG4gICAgcHJvYz86IFByb2M7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0cz86IFN0YXRWYWx1ZXMsIHByb2M/OiBQcm9jKSB7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5wcm9jID0gcHJvYztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXZWFwb25FcXVpcGVkIGV4dGVuZHMgSXRlbUVxdWlwZWQge1xuICAgIHdlYXBvbjogV2VhcG9uRGVzY3JpcHRpb247XG4gICAgbmV4dFN3aW5nVGltZTogbnVtYmVyO1xuICAgIHByb2NzOiBQcm9jW10gPSBbXTtcbiAgICBwbGF5ZXI6IFBsYXllcjtcbiAgICB0ZW1wb3JhcnlFbmNoYW50PzogVGVtcG9yYXJ5V2VhcG9uRW5jaGFudDtcblxuICAgIGNvbnN0cnVjdG9yKGl0ZW06IFdlYXBvbkRlc2NyaXB0aW9uLCBwbGF5ZXI6IFBsYXllcikge1xuICAgICAgICBzdXBlcihpdGVtLCBwbGF5ZXIpO1xuICAgICAgICB0aGlzLndlYXBvbiA9IGl0ZW07XG4gICAgICAgIFxuICAgICAgICBpZiAoaXRlbS5vbmhpdCkge1xuICAgICAgICAgICAgdGhpcy5hZGRQcm9jKGl0ZW0ub25oaXQpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcblxuICAgICAgICB0aGlzLm5leHRTd2luZ1RpbWUgPSAxMDA7IC8vIFRPRE8gLSBuZWVkIHRvIHJlc2V0IHRoaXMgcHJvcGVybHkgaWYgZXZlciB3YW50IHRvIHNpbXVsYXRlIGZpZ2h0cyB3aGVyZSB5b3UgcnVuIG91dFxuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0IHBsdXNEYW1hZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnRlbXBvcmFyeUVuY2hhbnQgJiYgdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5zdGF0cy5wbHVzRGFtYWdlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50ZW1wb3JhcnlFbmNoYW50LnN0YXRzLnBsdXNEYW1hZ2VcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2VhcG9uLm1pbiArIHRoaXMucGx1c0RhbWFnZTtcbiAgICB9XG5cbiAgICBnZXQgbWF4KCkge1xuICAgICAgICByZXR1cm4gdGhpcy53ZWFwb24ubWF4ICsgdGhpcy5wbHVzRGFtYWdlO1xuICAgIH1cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcHJvYyh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgZm9yIChsZXQgcHJvYyBvZiB0aGlzLnByb2NzKSB7XG4gICAgICAgICAgICBwcm9jLnJ1bih0aGlzLnBsYXllciwgdGhpcy53ZWFwb24sIHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2luZGZ1cnkgcHJvY3MgbGFzdFxuICAgICAgICBpZiAodGhpcy50ZW1wb3JhcnlFbmNoYW50ICYmIHRoaXMudGVtcG9yYXJ5RW5jaGFudC5wcm9jKSB7XG4gICAgICAgICAgICB0aGlzLnRlbXBvcmFyeUVuY2hhbnQucHJvYy5ydW4odGhpcy5wbGF5ZXIsIHRoaXMud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiB1cmFuZChtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgICByZXR1cm4gbWluICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhbXAodmFsOiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICAgIHJldHVybiBNYXRoLm1pbihtYXgsIE1hdGgubWF4KG1pbiwgdmFsKSk7XG59XG4iLCJpbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuL21hdGguanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgVW5pdCB7XG4gICAgbGV2ZWw6IG51bWJlcjtcbiAgICBhcm1vcjogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3IobGV2ZWw6IG51bWJlciwgYXJtb3I6IG51bWJlcikge1xuICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgIHRoaXMuYXJtb3IgPSBhcm1vcjtcbiAgICB9XG5cbiAgICBnZXQgbWF4U2tpbGxGb3JMZXZlbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGV2ZWwgKiA1O1xuICAgIH1cblxuICAgIGdldCBkZWZlbnNlU2tpbGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgfVxuXG4gICAgZ2V0IGRvZGdlQ2hhbmNlKCkge1xuICAgICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBjYWxjdWxhdGVBcm1vclJlZHVjZWREYW1hZ2UoZGFtYWdlOiBudW1iZXIsIGF0dGFja2VyOiBQbGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYXJtb3IgPSBNYXRoLm1heCgwLCB0aGlzLmFybW9yIC0gYXR0YWNrZXIuYnVmZk1hbmFnZXIuc3RhdHMuYXJtb3JQZW5ldHJhdGlvbik7XG4gICAgICAgIFxuICAgICAgICBsZXQgdG1wdmFsdWUgPSAwLjEgKiBhcm1vciAgLyAoKDguNSAqIGF0dGFja2VyLmxldmVsKSArIDQwKTtcbiAgICAgICAgdG1wdmFsdWUgLz0gKDEgKyB0bXB2YWx1ZSk7XG5cbiAgICAgICAgY29uc3QgYXJtb3JNb2RpZmllciA9IGNsYW1wKHRtcHZhbHVlLCAwLCAwLjc1KTtcblxuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMSwgZGFtYWdlIC0gKGRhbWFnZSAqIGFybW9yTW9kaWZpZXIpKTtcbiAgICB9XG59XG4iLCJleHBvcnQgaW50ZXJmYWNlIFN0YXRWYWx1ZXMge1xuICAgIGFwPzogbnVtYmVyO1xuICAgIHN0cj86IG51bWJlcjtcbiAgICBhZ2k/OiBudW1iZXI7XG4gICAgaGl0PzogbnVtYmVyO1xuICAgIGNyaXQ/OiBudW1iZXI7XG4gICAgaGFzdGU/OiBudW1iZXI7XG4gICAgc3RhdE11bHQ/OiBudW1iZXI7XG4gICAgZGFtYWdlTXVsdD86IG51bWJlcjtcbiAgICBhcm1vclBlbmV0cmF0aW9uPzogbnVtYmVyO1xuICAgIHBsdXNEYW1hZ2U/OiBudW1iZXI7XG5cbiAgICBzd29yZFNraWxsPzogbnVtYmVyO1xuICAgIGF4ZVNraWxsPzogbnVtYmVyO1xuICAgIG1hY2VTa2lsbD86IG51bWJlcjtcbiAgICBkYWdnZXJTa2lsbD86IG51bWJlcjtcbiAgICBzd29yZDJIU2tpbGw/OiBudW1iZXI7XG4gICAgYXhlMkhTa2lsbD86IG51bWJlcjtcbiAgICBtYWNlMkhTa2lsbD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFN0YXRzIGltcGxlbWVudHMgU3RhdFZhbHVlcyB7XG4gICAgYXAhOiBudW1iZXI7XG4gICAgc3RyITogbnVtYmVyO1xuICAgIGFnaSE6IG51bWJlcjtcbiAgICBoaXQhOiBudW1iZXI7XG4gICAgY3JpdCE6IG51bWJlcjtcbiAgICBoYXN0ZSE6IG51bWJlcjtcbiAgICBzdGF0TXVsdCE6IG51bWJlcjtcbiAgICBkYW1hZ2VNdWx0ITogbnVtYmVyO1xuICAgIGFybW9yUGVuZXRyYXRpb24hOiBudW1iZXI7XG4gICAgcGx1c0RhbWFnZSE6IG51bWJlcjtcblxuICAgIHN3b3JkU2tpbGwhOiBudW1iZXI7XG4gICAgYXhlU2tpbGwhOiBudW1iZXI7XG4gICAgbWFjZVNraWxsITogbnVtYmVyO1xuICAgIGRhZ2dlclNraWxsITogbnVtYmVyO1xuICAgIHN3b3JkMkhTa2lsbCE6IG51bWJlcjtcbiAgICBheGUySFNraWxsITogbnVtYmVyO1xuICAgIG1hY2UySFNraWxsITogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3Iocz86IFN0YXRWYWx1ZXMpIHtcbiAgICAgICAgdGhpcy5zZXQocyk7XG4gICAgfVxuXG4gICAgc2V0KHM/OiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMuYXAgPSAocyAmJiBzLmFwKSB8fCAwO1xuICAgICAgICB0aGlzLnN0ciA9IChzICYmIHMuc3RyKSB8fCAwO1xuICAgICAgICB0aGlzLmFnaSA9IChzICYmIHMuYWdpKSB8fCAwO1xuICAgICAgICB0aGlzLmhpdCA9IChzICYmIHMuaGl0KSB8fCAwO1xuICAgICAgICB0aGlzLmNyaXQgPSAocyAmJiBzLmNyaXQpIHx8IDA7XG4gICAgICAgIHRoaXMuaGFzdGUgPSAocyAmJiBzLmhhc3RlKSB8fCAxO1xuICAgICAgICB0aGlzLnN0YXRNdWx0ID0gKHMgJiYgcy5zdGF0TXVsdCkgfHwgMTtcbiAgICAgICAgdGhpcy5kYW1hZ2VNdWx0ID0gKHMgJiYgcy5kYW1hZ2VNdWx0KSB8fCAxO1xuICAgICAgICB0aGlzLmFybW9yUGVuZXRyYXRpb24gPSAocyAmJiBzLmFybW9yUGVuZXRyYXRpb24pIHx8IDA7XG4gICAgICAgIHRoaXMucGx1c0RhbWFnZSA9IChzICYmIHMucGx1c0RhbWFnZSkgfHwgMDtcblxuICAgICAgICB0aGlzLnN3b3JkU2tpbGwgPSAocyAmJiBzLnN3b3JkU2tpbGwpIHx8IDA7XG4gICAgICAgIHRoaXMuYXhlU2tpbGwgPSAocyAmJiBzLmF4ZVNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLm1hY2VTa2lsbCA9IChzICYmIHMubWFjZVNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLmRhZ2dlclNraWxsID0gKHMgJiYgcy5kYWdnZXJTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5zd29yZDJIU2tpbGwgPSAocyAmJiBzLnN3b3JkMkhTa2lsbCkgfHwgMDtcbiAgICAgICAgdGhpcy5heGUySFNraWxsID0gKHMgJiYgcy5heGUySFNraWxsKSB8fCAwO1xuICAgICAgICB0aGlzLm1hY2UySFNraWxsID0gKHMgJiYgcy5tYWNlMkhTa2lsbCkgfHwgMDtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBhZGQoczogU3RhdFZhbHVlcykge1xuICAgICAgICB0aGlzLmFwICs9IChzLmFwIHx8IDApO1xuICAgICAgICB0aGlzLnN0ciArPSAocy5zdHIgfHwgMCk7XG4gICAgICAgIHRoaXMuYWdpICs9IChzLmFnaSB8fCAwKTtcbiAgICAgICAgdGhpcy5oaXQgKz0gKHMuaGl0IHx8IDApO1xuICAgICAgICB0aGlzLmNyaXQgKz0gKHMuY3JpdCB8fCAwKTtcbiAgICAgICAgdGhpcy5oYXN0ZSAqPSAocy5oYXN0ZSB8fCAxKTtcbiAgICAgICAgdGhpcy5zdGF0TXVsdCAqPSAocy5zdGF0TXVsdCB8fCAxKTtcbiAgICAgICAgdGhpcy5kYW1hZ2VNdWx0ICo9IChzLmRhbWFnZU11bHQgfHwgMSk7XG4gICAgICAgIHRoaXMuYXJtb3JQZW5ldHJhdGlvbiArPSAocy5hcm1vclBlbmV0cmF0aW9uIHx8IDApO1xuICAgICAgICB0aGlzLnBsdXNEYW1hZ2UgKz0gKHMucGx1c0RhbWFnZSB8fCAwKTtcblxuICAgICAgICB0aGlzLnN3b3JkU2tpbGwgKz0gKHMuc3dvcmRTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5heGVTa2lsbCArPSAocy5heGVTa2lsbCB8fCAwKTtcbiAgICAgICAgdGhpcy5tYWNlU2tpbGwgKz0gKHMubWFjZVNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLmRhZ2dlclNraWxsICs9IChzLmRhZ2dlclNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLnN3b3JkMkhTa2lsbCArPSAocy5zd29yZDJIU2tpbGwgfHwgMCk7XG4gICAgICAgIHRoaXMuYXhlMkhTa2lsbCArPSAocy5heGUySFNraWxsIHx8IDApO1xuICAgICAgICB0aGlzLm1hY2UySFNraWxsICs9IChzLm1hY2UySFNraWxsIHx8IDApO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFN0YXRzLCBTdGF0VmFsdWVzIH0gZnJvbSBcIi4vc3RhdHMuanNcIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgUHJvYyB9IGZyb20gXCIuL3NwZWxsLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBCdWZmTWFuYWdlciB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG5cbiAgICBwcml2YXRlIGJ1ZmZMaXN0OiBCdWZmQXBwbGljYXRpb25bXSA9IFtdO1xuICAgIHByaXZhdGUgYnVmZk92ZXJUaW1lTGlzdDogQnVmZk92ZXJUaW1lQXBwbGljYXRpb25bXSA9IFtdO1xuXG4gICAgYmFzZVN0YXRzOiBTdGF0cztcbiAgICBzdGF0czogU3RhdHM7XG5cbiAgICBjb25zdHJ1Y3RvcihwbGF5ZXI6IFBsYXllciwgYmFzZVN0YXRzOiBTdGF0VmFsdWVzKSB7XG4gICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICB0aGlzLmJhc2VTdGF0cyA9IG5ldyBTdGF0cyhiYXNlU3RhdHMpO1xuICAgICAgICB0aGlzLnN0YXRzID0gbmV3IFN0YXRzKHRoaXMuYmFzZVN0YXRzKTtcbiAgICB9XG5cbiAgICBnZXQgbmV4dE92ZXJUaW1lVXBkYXRlKCkge1xuICAgICAgICBsZXQgcmVzID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cbiAgICAgICAgZm9yIChsZXQgYnVmZk9UQXBwIG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgcmVzID0gTWF0aC5taW4ocmVzLCBidWZmT1RBcHAubmV4dFVwZGF0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIHVwZGF0ZSh0aW1lOiBudW1iZXIpIHtcbiAgICAgICAgLy8gcHJvY2VzcyBsYXN0IHRpY2sgYmVmb3JlIGl0IGlzIHJlbW92ZWRcbiAgICAgICAgZm9yIChsZXQgYnVmZk9UQXBwIG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgYnVmZk9UQXBwLnVwZGF0ZSh0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVtb3ZlRXhwaXJlZEJ1ZmZzKHRpbWUpO1xuXG4gICAgICAgIHRoaXMuc3RhdHMuc2V0KHRoaXMuYmFzZVN0YXRzKTtcblxuICAgICAgICBmb3IgKGxldCB7IGJ1ZmYsIHN0YWNrcyB9IG9mIHRoaXMuYnVmZkxpc3QpIHtcbiAgICAgICAgICAgIHN0YWNrcyA9IGJ1ZmYuc3RhdHNTdGFjayA/IHN0YWNrcyA6IDE7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YWNrczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYnVmZi5hcHBseSh0aGlzLnN0YXRzLCB0aGlzLnBsYXllcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCB7IGJ1ZmYsIHN0YWNrcyB9IG9mIHRoaXMuYnVmZk92ZXJUaW1lTGlzdCkge1xuICAgICAgICAgICAgc3RhY2tzID0gYnVmZi5zdGF0c1N0YWNrID8gc3RhY2tzIDogMTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2tzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBidWZmLmFwcGx5KHRoaXMuc3RhdHMsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZChidWZmOiBCdWZmLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICBmb3IgKGxldCBidWZmQXBwIG9mIHRoaXMuYnVmZkxpc3QpIHtcbiAgICAgICAgICAgIGlmIChidWZmQXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZi5zdGFja3MpIHsgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9nU3RhY2tJbmNyZWFzZSA9IHRoaXMucGxheWVyLmxvZyAmJiAoIWJ1ZmYubWF4U3RhY2tzIHx8IGJ1ZmZBcHAuc3RhY2tzIDwgYnVmZi5tYXhTdGFja3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmLmluaXRpYWxTdGFja3MpIHsgLy8gVE9ETyAtIGNoYW5nZSB0aGlzIHRvIGNoYXJnZXM/XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmQXBwLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAuc3RhY2tzKys7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAobG9nU3RhY2tJbmNyZWFzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5ZXIubG9nIShhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gcmVmcmVzaGVkICgke2J1ZmZBcHAuc3RhY2tzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyhhcHBseVRpbWUsIGAke2J1ZmYubmFtZX0gcmVmcmVzaGVkYCk7XG4gICAgICAgICAgICAgICAgICAgIGJ1ZmZBcHAucmVmcmVzaChhcHBseVRpbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2coYXBwbHlUaW1lLCBgJHtidWZmLm5hbWV9IGdhaW5lZGAgKyAoYnVmZi5zdGFja3MgPyBgICgke2J1ZmYuaW5pdGlhbFN0YWNrcyB8fCAxfSlgIDogJycpKTtcblxuICAgICAgICBpZiAoYnVmZiBpbnN0YW5jZW9mIEJ1ZmZPdmVyVGltZSkge1xuICAgICAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0LnB1c2gobmV3IEJ1ZmZPdmVyVGltZUFwcGxpY2F0aW9uKHRoaXMucGxheWVyLCBidWZmLCBhcHBseVRpbWUpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZkxpc3QucHVzaChuZXcgQnVmZkFwcGxpY2F0aW9uKGJ1ZmYsIGFwcGx5VGltZSkpO1xuICAgICAgICB9XG4gICAgICAgIGJ1ZmYuYWRkKGFwcGx5VGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgIH1cblxuICAgIHJlbW92ZShidWZmOiBCdWZmLCB0aW1lOiBudW1iZXIsIGZ1bGwgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmJ1ZmYgPT09IGJ1ZmYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZ1bGwgJiYgYnVmZi5zdGFja3MpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmZmFwcC5zdGFja3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gKCR7YnVmZmFwcC5zdGFja3N9KWApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVmZmFwcC5zdGFja3MgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGxvc3RgKTtcbiAgICAgICAgICAgICAgICBidWZmYXBwLmJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idWZmT3ZlclRpbWVMaXN0ID0gdGhpcy5idWZmT3ZlclRpbWVMaXN0LmZpbHRlcigoYnVmZmFwcCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZhcHAuYnVmZiA9PT0gYnVmZikge1xuICAgICAgICAgICAgICAgIGlmIChidWZmLnN0YWNrcykge1xuICAgICAgICAgICAgICAgICAgICBidWZmYXBwLnN0YWNrcyAtPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5ZXIubG9nKSB0aGlzLnBsYXllci5sb2codGltZSwgYCR7YnVmZi5uYW1lfSAoJHtidWZmYXBwLnN0YWNrc30pYCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChidWZmYXBwLnN0YWNrcyA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWVyLmxvZykgdGhpcy5wbGF5ZXIubG9nKHRpbWUsIGAke2J1ZmYubmFtZX0gbG9zdGApO1xuICAgICAgICAgICAgICAgIGJ1ZmZhcHAuYnVmZi5yZW1vdmUodGltZSwgdGhpcy5wbGF5ZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZW1vdmVFeHBpcmVkQnVmZnModGltZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHJlbW92ZWRCdWZmczogQnVmZltdID0gW107XG4gICAgICAgIFxuICAgICAgICB0aGlzLmJ1ZmZMaXN0ID0gdGhpcy5idWZmTGlzdC5maWx0ZXIoKGJ1ZmZhcHApID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmYXBwLmV4cGlyYXRpb25UaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVkQnVmZnMucHVzaChidWZmYXBwLmJ1ZmYpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QgPSB0aGlzLmJ1ZmZPdmVyVGltZUxpc3QuZmlsdGVyKChidWZmYXBwKSA9PiB7XG4gICAgICAgICAgICBpZiAoYnVmZmFwcC5leHBpcmF0aW9uVGltZSA8PSB0aW1lKSB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEJ1ZmZzLnB1c2goYnVmZmFwcC5idWZmKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yIChsZXQgYnVmZiBvZiByZW1vdmVkQnVmZnMpIHtcbiAgICAgICAgICAgIGJ1ZmYucmVtb3ZlKHRpbWUsIHRoaXMucGxheWVyKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBsYXllci5sb2cpIHRoaXMucGxheWVyLmxvZyh0aW1lLCBgJHtidWZmLm5hbWV9IGV4cGlyZWRgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1ZmYge1xuICAgIG5hbWU6IFN0cmluZztcbiAgICBzdGF0cz86IFN0YXRWYWx1ZXN8dW5kZWZpbmVkO1xuICAgIHN0YWNrczogYm9vbGVhbjtcbiAgICBkdXJhdGlvbjogbnVtYmVyO1xuICAgIGluaXRpYWxTdGFja3M/OiBudW1iZXI7XG4gICAgbWF4U3RhY2tzPzogbnVtYmVyO1xuICAgIHN0YXRzU3RhY2s6IGJvb2xlYW47IC8vIGRvIHlvdSBhZGQgdGhlIHN0YXQgYm9udXMgZm9yIGVhY2ggc3RhY2s/IG9yIGlzIGl0IGxpa2UgZmx1cnJ5IHdoZXJlIHRoZSBzdGFjayBpcyBvbmx5IHRvIGNvdW50IGNoYXJnZXNcblxuICAgIHByaXZhdGUgY2hpbGQ/OiBCdWZmO1xuXG4gICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdGF0cz86IFN0YXRWYWx1ZXMsIHN0YWNrcz86IGJvb2xlYW4sIGluaXRpYWxTdGFja3M/OiBudW1iZXIsIG1heFN0YWNrcz86IG51bWJlciwgY2hpbGQ/OiBCdWZmLCBzdGF0c1N0YWNrID0gdHJ1ZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5zdGFja3MgPSAhIXN0YWNrcztcbiAgICAgICAgdGhpcy5pbml0aWFsU3RhY2tzID0gaW5pdGlhbFN0YWNrcztcbiAgICAgICAgdGhpcy5tYXhTdGFja3MgPSBtYXhTdGFja3M7XG4gICAgICAgIHRoaXMuY2hpbGQgPSBjaGlsZDtcbiAgICAgICAgdGhpcy5zdGF0c1N0YWNrID0gc3RhdHNTdGFjaztcbiAgICB9XG5cbiAgICBhcHBseShzdGF0czogU3RhdHMsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLnN0YXRzKSB7XG4gICAgICAgICAgICBzdGF0cy5hZGQodGhpcy5zdGF0cyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGQodGltZTogbnVtYmVyLCBwbGF5ZXI6IFBsYXllcikge31cblxuICAgIHJlbW92ZSh0aW1lOiBudW1iZXIsIHBsYXllcjogUGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLmNoaWxkKSB7XG4gICAgICAgICAgICBwbGF5ZXIuYnVmZk1hbmFnZXIucmVtb3ZlKHRoaXMuY2hpbGQsIHRpbWUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmY7XG4gICAgZXhwaXJhdGlvblRpbWUhOiBudW1iZXI7XG5cbiAgICBzdGFja3NWYWwhOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihidWZmOiBCdWZmLCBhcHBseVRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLmJ1ZmYgPSBidWZmO1xuICAgICAgICB0aGlzLnJlZnJlc2goYXBwbHlUaW1lKTtcbiAgICB9XG5cbiAgICByZWZyZXNoKHRpbWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLnN0YWNrcyA9IHRoaXMuYnVmZi5pbml0aWFsU3RhY2tzIHx8IDE7XG5cbiAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IHRpbWUgKyB0aGlzLmJ1ZmYuZHVyYXRpb24gKiAxMDAwO1xuXG4gICAgICAgIGlmICh0aGlzLmJ1ZmYuZHVyYXRpb24gPiA2MCkge1xuICAgICAgICAgICAgdGhpcy5leHBpcmF0aW9uVGltZSA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHN0YWNrcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhY2tzVmFsO1xuICAgIH1cblxuICAgIHNldCBzdGFja3Moc3RhY2tzOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5zdGFja3NWYWwgPSB0aGlzLmJ1ZmYubWF4U3RhY2tzID8gTWF0aC5taW4odGhpcy5idWZmLm1heFN0YWNrcywgc3RhY2tzKSA6IHN0YWNrcztcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmT3ZlclRpbWUgZXh0ZW5kcyBCdWZmIHtcbiAgICB1cGRhdGVGOiAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4gdm9pZDtcbiAgICB1cGRhdGVJbnRlcnZhbDogbnVtYmVyXG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHN0YXRzOiBTdGF0VmFsdWVzfHVuZGVmaW5lZCwgdXBkYXRlSW50ZXJ2YWw6IG51bWJlciwgdXBkYXRlRjogKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHZvaWQpIHtcbiAgICAgICAgc3VwZXIobmFtZSwgZHVyYXRpb24sIHN0YXRzKTtcbiAgICAgICAgdGhpcy51cGRhdGVGID0gdXBkYXRlRjtcbiAgICAgICAgdGhpcy51cGRhdGVJbnRlcnZhbCA9IHVwZGF0ZUludGVydmFsO1xuICAgIH1cbn1cblxuY2xhc3MgQnVmZk92ZXJUaW1lQXBwbGljYXRpb24gZXh0ZW5kcyBCdWZmQXBwbGljYXRpb24ge1xuICAgIGJ1ZmY6IEJ1ZmZPdmVyVGltZTtcbiAgICBuZXh0VXBkYXRlITogbnVtYmVyO1xuICAgIHBsYXllcjogUGxheWVyO1xuXG4gICAgY29uc3RydWN0b3IocGxheWVyOiBQbGF5ZXIsIGJ1ZmY6IEJ1ZmZPdmVyVGltZSwgYXBwbHlUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgc3VwZXIoYnVmZiwgYXBwbHlUaW1lKTtcbiAgICAgICAgdGhpcy5idWZmID0gYnVmZjtcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gICAgICAgIHRoaXMucmVmcmVzaChhcHBseVRpbWUpO1xuICAgIH1cblxuICAgIHJlZnJlc2godGltZTogbnVtYmVyKSB7XG4gICAgICAgIHN1cGVyLnJlZnJlc2godGltZSk7XG4gICAgICAgIHRoaXMubmV4dFVwZGF0ZSA9IHRpbWUgKyB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgfVxuXG4gICAgdXBkYXRlKHRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGltZSA+PSB0aGlzLm5leHRVcGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMubmV4dFVwZGF0ZSArPSB0aGlzLmJ1ZmYudXBkYXRlSW50ZXJ2YWw7XG4gICAgICAgICAgICB0aGlzLmJ1ZmYudXBkYXRlRih0aGlzLnBsYXllciwgdGltZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCdWZmUHJvYyBleHRlbmRzIEJ1ZmYge1xuICAgIHByb2M6IFByb2M7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIsIHByb2M6IFByb2MsIGNoaWxkPzogQnVmZikge1xuICAgICAgICBzdXBlcihuYW1lLCBkdXJhdGlvbiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjaGlsZCk7XG4gICAgICAgIHRoaXMucHJvYyA9IHByb2M7XG4gICAgfVxuXG4gICAgYWRkKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIuYWRkKHRpbWUsIHBsYXllcik7XG4gICAgICAgIHBsYXllci5hZGRQcm9jKHRoaXMucHJvYyk7XG4gICAgfVxuXG4gICAgcmVtb3ZlKHRpbWU6IG51bWJlciwgcGxheWVyOiBQbGF5ZXIpIHtcbiAgICAgICAgc3VwZXIucmVtb3ZlKHRpbWUsIHBsYXllcik7XG4gICAgICAgIHBsYXllci5yZW1vdmVQcm9jKHRoaXMucHJvYyk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgV2VhcG9uRXF1aXBlZCwgV2VhcG9uVHlwZSwgSXRlbURlc2NyaXB0aW9uLCBJdGVtRXF1aXBlZCwgSXRlbVNsb3QsIGlzRXF1aXBlZFdlYXBvbiwgaXNXZWFwb24gfSBmcm9tIFwiLi9pdGVtLmpzXCI7XG5pbXBvcnQgeyBVbml0IH0gZnJvbSBcIi4vdW5pdC5qc1wiO1xuaW1wb3J0IHsgdXJhbmQsIGNsYW1wIH0gZnJvbSBcIi4vbWF0aC5qc1wiO1xuaW1wb3J0IHsgQnVmZk1hbmFnZXIgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBTdGF0VmFsdWVzLCBTdGF0cyB9IGZyb20gXCIuL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBTcGVsbCwgUHJvYywgTGVhcm5lZFN3aW5nU3BlbGwgfSBmcm9tIFwiLi9zcGVsbC5qc1wiO1xuXG5leHBvcnQgZW51bSBSYWNlIHtcbiAgICBIVU1BTixcbiAgICBPUkMsXG59XG5cbmV4cG9ydCBlbnVtIE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgTUVMRUVfSElUX0VWQURFLFxuICAgIE1FTEVFX0hJVF9NSVNTLFxuICAgIE1FTEVFX0hJVF9ET0RHRSxcbiAgICBNRUxFRV9ISVRfQkxPQ0ssXG4gICAgTUVMRUVfSElUX1BBUlJZLFxuICAgIE1FTEVFX0hJVF9HTEFOQ0lORyxcbiAgICBNRUxFRV9ISVRfQ1JJVCxcbiAgICBNRUxFRV9ISVRfQ1JVU0hJTkcsXG4gICAgTUVMRUVfSElUX05PUk1BTCxcbiAgICBNRUxFRV9ISVRfQkxPQ0tfQ1JJVCxcbn1cblxudHlwZSBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1tUS2V5IGluIE1lbGVlSGl0T3V0Y29tZV06IHN0cmluZ307XG5cbmV4cG9ydCBjb25zdCBoaXRPdXRjb21lU3RyaW5nOiBIaXRPdXRDb21lU3RyaW5nTWFwID0ge1xuICAgIFtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0VWQURFXTogJ2V2YWRlJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTXTogJ21pc3NlcycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdOiAnaXMgZG9kZ2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9CTE9DS106ICdpcyBibG9ja2VkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9QQVJSWV06ICdpcyBwYXJyaWVkJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lOR106ICdnbGFuY2VzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUXTogJ2NyaXRzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUlVTSElOR106ICdjcnVzaGVzJyxcbiAgICBbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUxdOiAnaGl0cycsXG4gICAgW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfQkxPQ0tfQ1JJVF06ICdpcyBibG9jayBjcml0Jyxcbn07XG5cbmNvbnN0IHNraWxsRGlmZlRvUmVkdWN0aW9uID0gWzEsIDAuOTkyNiwgMC45ODQwLCAwLjk3NDIsIDAuOTYyOSwgMC45NTAwLCAwLjkzNTEsIDAuOTE4MCwgMC44OTg0LCAwLjg3NTksIDAuODUwMCwgMC44MjAzLCAwLjc4NjAsIDAuNzQ2OSwgMC43MDE4XTtcblxuZXhwb3J0IHR5cGUgTG9nRnVuY3Rpb24gPSAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBQbGF5ZXIgZXh0ZW5kcyBVbml0IHtcbiAgICBpdGVtczogTWFwPEl0ZW1TbG90LCBJdGVtRXF1aXBlZD4gPSBuZXcgTWFwKCk7XG4gICAgcHJvY3M6IFByb2NbXSA9IFtdO1xuXG4gICAgdGFyZ2V0OiBVbml0IHwgdW5kZWZpbmVkO1xuXG4gICAgbmV4dEdDRFRpbWUgPSAwO1xuICAgIGV4dHJhQXR0YWNrQ291bnQgPSAwO1xuICAgIGRvaW5nRXh0cmFBdHRhY2tzID0gZmFsc2U7XG5cbiAgICBidWZmTWFuYWdlcjogQnVmZk1hbmFnZXI7XG5cbiAgICBkYW1hZ2VEb25lID0gMDtcblxuICAgIHF1ZXVlZFNwZWxsOiBMZWFybmVkU3dpbmdTcGVsbHx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgICBsb2c/OiBMb2dGdW5jdGlvbjtcblxuICAgIGxhdGVuY3kgPSA1MDsgLy8gbXNcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRzOiBTdGF0VmFsdWVzLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICBzdXBlcig2MCwgMCk7IC8vIGx2bCwgYXJtb3JcblxuICAgICAgICB0aGlzLmJ1ZmZNYW5hZ2VyID0gbmV3IEJ1ZmZNYW5hZ2VyKHRoaXMsIG5ldyBTdGF0cyhzdGF0cykpO1xuICAgICAgICB0aGlzLmxvZyA9IGxvZztcbiAgICB9XG5cbiAgICBnZXQgbWgoKTogV2VhcG9uRXF1aXBlZHx1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBlcXVpcGVkID0gdGhpcy5pdGVtcy5nZXQoSXRlbVNsb3QuTUFJTkhBTkQpO1xuXG4gICAgICAgIGlmIChlcXVpcGVkICYmIGlzRXF1aXBlZFdlYXBvbihlcXVpcGVkKSkge1xuICAgICAgICAgICAgcmV0dXJuIGVxdWlwZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb2goKTogV2VhcG9uRXF1aXBlZHx1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBlcXVpcGVkID0gdGhpcy5pdGVtcy5nZXQoSXRlbVNsb3QuT0ZGSEFORCk7XG5cbiAgICAgICAgaWYgKGVxdWlwZWQgJiYgaXNFcXVpcGVkV2VhcG9uKGVxdWlwZWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXF1aXBlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVxdWlwKGl0ZW06IEl0ZW1EZXNjcmlwdGlvbiwgc2xvdDogSXRlbVNsb3QpIHtcbiAgICAgICAgaWYgKHRoaXMuaXRlbXMuaGFzKHNsb3QpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBhbHJlYWR5IGhhdmUgaXRlbSBpbiBzbG90ICR7SXRlbVNsb3Rbc2xvdF19YClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKGl0ZW0uc2xvdCAmIHNsb3QpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBjYW5ub3QgZXF1aXAgJHtpdGVtLm5hbWV9IGluIHNsb3QgJHtJdGVtU2xvdFtzbG90XX1gKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0uc3RhdHMpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYmFzZVN0YXRzLmFkZChpdGVtLnN0YXRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE8gLSBoYW5kbGUgZXF1aXBwaW5nIDJIIChhbmQgaG93IHRoYXQgZGlzYWJsZXMgT0gpXG4gICAgICAgIGlmIChpc1dlYXBvbihpdGVtKSkge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IFdlYXBvbkVxdWlwZWQoaXRlbSwgdGhpcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pdGVtcy5zZXQoc2xvdCwgbmV3IEl0ZW1FcXVpcGVkKGl0ZW0sIHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwb3dlcigpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge31cblxuICAgIGFkZFByb2MocDogUHJvYykge1xuICAgICAgICB0aGlzLnByb2NzLnB1c2gocCk7XG4gICAgfVxuXG4gICAgcmVtb3ZlUHJvYyhwOiBQcm9jKSB7XG4gICAgICAgIC8vIFRPRE8gLSBlaXRoZXIgcHJvY3Mgc2hvdWxkIGJlIGEgc2V0IG9yIHdlIG5lZWQgUHJvY0FwcGxpY2F0aW9uXG4gICAgICAgIHRoaXMucHJvY3MgPSB0aGlzLnByb2NzLmZpbHRlcigocHJvYzogUHJvYykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHByb2MgIT09IHA7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oOiBib29sZWFuLCBpZ25vcmVfd2VhcG9uX3NraWxsID0gZmFsc2UpIHtcbiAgICAgICAgaWYgKGlnbm9yZV93ZWFwb25fc2tpbGwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3ZWFwb24gPSBpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCE7XG4gICAgICAgIGNvbnN0IHdlYXBvblR5cGUgPSB3ZWFwb24ud2VhcG9uLnR5cGU7XG5cbiAgICAgICAgLy8gVE9ETywgbWFrZSB0aGlzIGEgbWFwXG4gICAgICAgIHN3aXRjaCAod2VhcG9uVHlwZSkge1xuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLk1BQ0U6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMubWFjZVNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLlNXT1JEOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLnN3b3JkU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuQVhFOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFNraWxsRm9yTGV2ZWwgKyB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmF4ZVNraWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBXZWFwb25UeXBlLkRBR0dFUjpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5kYWdnZXJTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgV2VhcG9uVHlwZS5NQUNFMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMubWFjZTJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuU1dPUkQySDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTa2lsbEZvckxldmVsICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zd29yZDJIU2tpbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIFdlYXBvblR5cGUuQVhFMkg6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYXhlMkhTa2lsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U2tpbGxGb3JMZXZlbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNhbGN1bGF0ZUNyaXRDaGFuY2UoKSB7XG4gICAgICAgIGxldCBjcml0ID0gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5jcml0O1xuICAgICAgICBjcml0ICs9IHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuYWdpICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAvIDIwO1xuXG4gICAgICAgIHJldHVybiBjcml0O1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBjYWxjdWxhdGVNaXNzQ2hhbmNlKHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIGlzX3NwZWxsOiBib29sZWFuLCBpZ25vcmVfd2VhcG9uX3NraWxsID0gZmFsc2UpIHtcbiAgICAgICAgbGV0IHJlcyA9IDU7XG4gICAgICAgIHJlcyAtPSB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmhpdDtcblxuICAgICAgICBpZiAodGhpcy5vaCAmJiAhaXNfc3BlbGwpIHtcbiAgICAgICAgICAgIHJlcyArPSAxOTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2tpbGxEaWZmID0gdGhpcy5jYWxjdWxhdGVXZWFwb25Ta2lsbFZhbHVlKGlzX21oLCBpZ25vcmVfd2VhcG9uX3NraWxsKSAtIHZpY3RpbS5kZWZlbnNlU2tpbGw7XG5cbiAgICAgICAgaWYgKHNraWxsRGlmZiA8IC0xMCkge1xuICAgICAgICAgICAgcmVzIC09IChza2lsbERpZmYgKyAxMCkgKiAwLjQgLSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzIC09IHNraWxsRGlmZiAqIDAuMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbGFtcChyZXMsIDAsIDYwKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgY2FsY3VsYXRlR2xhbmNpbmdSZWR1Y3Rpb24odmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbikge1xuICAgICAgICBjb25zdCBza2lsbERpZmYgPSB2aWN0aW0uZGVmZW5zZVNraWxsICAtIHRoaXMuY2FsY3VsYXRlV2VhcG9uU2tpbGxWYWx1ZShpc19taCk7XG5cbiAgICAgICAgaWYgKHNraWxsRGlmZiA+PSAxNSkge1xuICAgICAgICAgICAgcmV0dXJuIDAuNjU7XG4gICAgICAgIH0gZWxzZSBpZiAoc2tpbGxEaWZmIDwgMCkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc2tpbGxEaWZmVG9SZWR1Y3Rpb25bc2tpbGxEaWZmXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhcCgpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGNhbGN1bGF0ZU1pbk1heERhbWFnZShpc19taDogYm9vbGVhbik6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgICAgICAvLyBUT0RPIC0gVmVyeSBzaW1wbGUgdmVyc2lvbiBhdG1cbiAgICAgICAgY29uc3Qgd2VhcG9uID0gaXNfbWggPyB0aGlzLm1oISA6IHRoaXMub2ghO1xuXG4gICAgICAgIGNvbnN0IGFwX2JvbnVzID0gdGhpcy5hcCAvIDE0ICogd2VhcG9uLndlYXBvbi5zcGVlZDtcblxuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgTWF0aC50cnVuYyh3ZWFwb24ubWluICsgYXBfYm9udXMpLFxuICAgICAgICAgICAgTWF0aC50cnVuYyh3ZWFwb24ubWF4ICsgYXBfYm9udXMpXG4gICAgICAgIF07XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlUmF3RGFtYWdlKGlzX21oOiBib29sZWFuKSB7XG4gICAgICAgIHJldHVybiB1cmFuZCguLi50aGlzLmNhbGN1bGF0ZU1pbk1heERhbWFnZShpc19taCkpO1xuICAgIH1cblxuICAgIHJvbGxNZWxlZUhpdE91dGNvbWUodmljdGltOiBVbml0LCBpc19taDogYm9vbGVhbiwgaXNfc3BlbGw6IGJvb2xlYW4sIGlnbm9yZV93ZWFwb25fc2tpbGwgPSBmYWxzZSk6IE1lbGVlSGl0T3V0Y29tZSB7XG4gICAgICAgIGNvbnN0IHJvbGwgPSB1cmFuZCgwLCAxMDAwMCk7XG4gICAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgICBsZXQgdG1wID0gMDtcblxuICAgICAgICAvLyByb3VuZGluZyBpbnN0ZWFkIG9mIHRydW5jYXRpbmcgYmVjYXVzZSAxOS40ICogMTAwIHdhcyB0cnVuY2F0aW5nIHRvIDE5MzkuXG4gICAgICAgIGNvbnN0IG1pc3NfY2hhbmNlID0gTWF0aC5yb3VuZCh0aGlzLmNhbGN1bGF0ZU1pc3NDaGFuY2UodmljdGltLCBpc19taCwgaXNfc3BlbGwsIGlnbm9yZV93ZWFwb25fc2tpbGwpICogMTAwKTtcbiAgICAgICAgY29uc3QgZG9kZ2VfY2hhbmNlID0gTWF0aC5yb3VuZCh2aWN0aW0uZG9kZ2VDaGFuY2UgKiAxMDApO1xuICAgICAgICBjb25zdCBjcml0X2NoYW5jZSA9IE1hdGgucm91bmQodGhpcy5jYWxjdWxhdGVDcml0Q2hhbmNlKCkgKiAxMDApO1xuXG4gICAgICAgIC8vIHdlYXBvbiBza2lsbCAtIHRhcmdldCBkZWZlbnNlICh1c3VhbGx5IG5lZ2F0aXZlKVxuICAgICAgICBjb25zdCBza2lsbEJvbnVzID0gNCAqICh0aGlzLmNhbGN1bGF0ZVdlYXBvblNraWxsVmFsdWUoaXNfbWgsIGlnbm9yZV93ZWFwb25fc2tpbGwpIC0gdmljdGltLm1heFNraWxsRm9yTGV2ZWwpO1xuXG4gICAgICAgIHRtcCA9IG1pc3NfY2hhbmNlO1xuXG4gICAgICAgIGlmICh0bXAgPiAwICYmIHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1M7XG4gICAgICAgIH1cblxuICAgICAgICB0bXAgPSBkb2RnZV9jaGFuY2UgLSBza2lsbEJvbnVzOyAvLyA1LjYgKDU2MCkgZm9yIGx2bCA2MyB3aXRoIDMwMCB3ZWFwb24gc2tpbGxcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSB0bXApKSB7XG4gICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9ET0RHRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNfc3BlbGwpIHsgLy8gc3BlbGxzIGNhbid0IGdsYW5jZVxuICAgICAgICAgICAgdG1wID0gKDEwICsgKHZpY3RpbS5kZWZlbnNlU2tpbGwgLSAzMDApICogMikgKiAxMDA7XG4gICAgICAgICAgICB0bXAgPSBjbGFtcCh0bXAsIDAsIDQwMDApO1xuICAgIFxuICAgICAgICAgICAgaWYgKHJvbGwgPCAoc3VtICs9IHRtcCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRtcCA9IGNyaXRfY2hhbmNlICsgc2tpbGxCb251cztcblxuICAgICAgICBpZiAodG1wID4gMCAmJiByb2xsIDwgKHN1bSArPSBjcml0X2NoYW5jZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9OT1JNQUw7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlTWVsZWVEYW1hZ2UocmF3RGFtYWdlOiBudW1iZXIsIHZpY3RpbTogVW5pdCwgaXNfbWg6IGJvb2xlYW4sIGlzX3NwZWxsOiBib29sZWFuLCBpZ25vcmVfd2VhcG9uX3NraWxsID0gZmFsc2UpOiBbbnVtYmVyLCBNZWxlZUhpdE91dGNvbWUsIG51bWJlcl0ge1xuICAgICAgICBjb25zdCBhcm1vclJlZHVjZWQgPSB2aWN0aW0uY2FsY3VsYXRlQXJtb3JSZWR1Y2VkRGFtYWdlKHJhd0RhbWFnZSwgdGhpcyk7XG5cbiAgICAgICAgY29uc3QgaGl0T3V0Y29tZSA9IHRoaXMucm9sbE1lbGVlSGl0T3V0Y29tZSh2aWN0aW0sIGlzX21oLCBpc19zcGVsbCwgaWdub3JlX3dlYXBvbl9za2lsbCk7XG5cbiAgICAgICAgbGV0IGRhbWFnZSA9IGFybW9yUmVkdWNlZDtcbiAgICAgICAgbGV0IGNsZWFuRGFtYWdlID0gMDtcblxuICAgICAgICBzd2l0Y2ggKGhpdE91dGNvbWUpIHtcbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSA9IDA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0U6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGFtYWdlID0gMDtcbiAgICAgICAgICAgICAgICBjbGVhbkRhbWFnZSA9IHJhd0RhbWFnZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9HTEFOQ0lORzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWR1Y2VQZXJjZW50ID0gdGhpcy5jYWxjdWxhdGVHbGFuY2luZ1JlZHVjdGlvbih2aWN0aW0sIGlzX21oKTtcbiAgICAgICAgICAgICAgICBkYW1hZ2UgPSByZWR1Y2VQZXJjZW50ICogZGFtYWdlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX05PUk1BTDpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRhbWFnZSAqPSAyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc19taCkge1xuICAgICAgICAgICAgZGFtYWdlICo9IDAuNjI1OyAvLyBUT0RPIC0gY2hlY2sgdGFsZW50cywgc2hvdWxkIGJlIGluIHdhcnJpb3IgY2xhc3NcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBbZGFtYWdlLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV07XG4gICAgfVxuXG4gICAgdXBkYXRlUHJvY3ModGltZTogbnVtYmVyLCBpc19taDogYm9vbGVhbiwgaGl0T3V0Y29tZTogTWVsZWVIaXRPdXRjb21lLCBkYW1hZ2VEb25lOiBudW1iZXIsIGNsZWFuRGFtYWdlOiBudW1iZXIsIHNwZWxsPzogU3BlbGwpIHtcbiAgICAgICAgaWYgKCFbTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9NSVNTLCBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0RPREdFXS5pbmNsdWRlcyhoaXRPdXRjb21lKSkge1xuICAgICAgICAgICAgLy8gd2hhdCBpcyB0aGUgb3JkZXIgb2YgY2hlY2tpbmcgZm9yIHByb2NzIGxpa2UgaG9qLCBpcm9uZm9lIGFuZCB3aW5kZnVyeVxuICAgICAgICAgICAgLy8gb24gTEggY29yZSBpdCBpcyBob2ogPiBpcm9uZm9lID4gd2luZGZ1cnlcblxuICAgICAgICAgICAgLy8gc28gZG8gaXRlbSBwcm9jcyBmaXJzdCwgdGhlbiB3ZWFwb24gcHJvYywgdGhlbiB3aW5kZnVyeVxuICAgICAgICAgICAgZm9yIChsZXQgcHJvYyBvZiB0aGlzLnByb2NzKSB7XG4gICAgICAgICAgICAgICAgcHJvYy5ydW4odGhpcywgKGlzX21oID8gdGhpcy5taCEgOiB0aGlzLm9oISkud2VhcG9uLCB0aW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIChpc19taCA/IHRoaXMubWghIDogdGhpcy5vaCEpLnByb2ModGltZSk7XG4gICAgICAgICAgICAvLyBUT0RPIC0gaW1wbGVtZW50IHdpbmRmdXJ5IGhlcmUsIGl0IHNob3VsZCBzdGlsbCBhZGQgYXR0YWNrIHBvd2VyIGV2ZW4gaWYgdGhlcmUgaXMgYWxyZWFkeSBhbiBleHRyYSBhdHRhY2tcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlYWxNZWxlZURhbWFnZSh0aW1lOiBudW1iZXIsIHJhd0RhbWFnZTogbnVtYmVyLCB0YXJnZXQ6IFVuaXQsIGlzX21oOiBib29sZWFuLCBzcGVsbD86IFNwZWxsLCBpZ25vcmVfd2VhcG9uX3NraWxsID0gZmFsc2UpIHtcbiAgICAgICAgbGV0IFtkYW1hZ2VEb25lLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV0gPSB0aGlzLmNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZSwgdGFyZ2V0LCBpc19taCwgc3BlbGwgIT09IHVuZGVmaW5lZCwgaWdub3JlX3dlYXBvbl9za2lsbCk7XG4gICAgICAgIGRhbWFnZURvbmUgPSBNYXRoLnRydW5jKGRhbWFnZURvbmUgKiB0aGlzLmJ1ZmZNYW5hZ2VyLnN0YXRzLmRhbWFnZU11bHQpOyAvLyB0cnVuY2F0aW5nIGhlcmUgYmVjYXVzZSB3YXJyaW9yIHN1YmNsYXNzIGJ1aWxkcyBvbiB0b3Agb2YgY2FsY3VsYXRlTWVsZWVEYW1hZ2VcbiAgICAgICAgY2xlYW5EYW1hZ2UgPSBNYXRoLnRydW5jKGNsZWFuRGFtYWdlKTsgLy8gVE9ETywgc2hvdWxkIGRhbWFnZU11bHQgYWZmZWN0IGNsZWFuIGRhbWFnZSBhcyB3ZWxsPyBpZiBzbyBtb3ZlIGl0IGludG8gY2FsY3VsYXRlTWVsZWVEYW1hZ2VcblxuICAgICAgICB0aGlzLmRhbWFnZURvbmUgKz0gZGFtYWdlRG9uZTtcbiAgICAgICAgXG4gICAgICAgIGlmICh0aGlzLmxvZykge1xuICAgICAgICAgICAgbGV0IGhpdFN0ciA9IGBZb3VyICR7c3BlbGwgPyBzcGVsbC5uYW1lIDogKGlzX21oID8gJ21haW4taGFuZCcgOiAnb2ZmLWhhbmQnKX0gJHtoaXRPdXRjb21lU3RyaW5nW2hpdE91dGNvbWVdfWA7XG4gICAgICAgICAgICBpZiAoIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICAgICAgaGl0U3RyICs9IGAgZm9yICR7ZGFtYWdlRG9uZX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2codGltZSwgaGl0U3RyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudXBkYXRlUHJvY3ModGltZSwgaXNfbWgsIGhpdE91dGNvbWUsIGRhbWFnZURvbmUsIGNsZWFuRGFtYWdlLCBzcGVsbCk7XG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIudXBkYXRlKHRpbWUpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBzd2luZ1dlYXBvbih0aW1lOiBudW1iZXIsIHRhcmdldDogVW5pdCwgaXNfbWg6IGJvb2xlYW4pIHtcbiAgICAgICAgY29uc3QgcmF3RGFtYWdlID0gdGhpcy5jYWxjdWxhdGVSYXdEYW1hZ2UoaXNfbWgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCF0aGlzLmRvaW5nRXh0cmFBdHRhY2tzICYmIGlzX21oICYmIHRoaXMucXVldWVkU3BlbGwgJiYgdGhpcy5xdWV1ZWRTcGVsbC5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgICAgICB0aGlzLnF1ZXVlZFNwZWxsLmNhc3QodGltZSk7IC8vIGhhbmRsZSBzcGVsbCBjb3N0XG4gICAgICAgICAgICBjb25zdCBzd2luZ1NwZWxsID0gdGhpcy5xdWV1ZWRTcGVsbC5zcGVsbDtcbiAgICAgICAgICAgIHRoaXMucXVldWVkU3BlbGwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBjb25zdCBib251c0RhbWFnZSA9IHN3aW5nU3BlbGwuYm9udXNEYW1hZ2U7XG4gICAgICAgICAgICB0aGlzLmRlYWxNZWxlZURhbWFnZSh0aW1lLCByYXdEYW1hZ2UgKyBib251c0RhbWFnZSwgdGFyZ2V0LCBpc19taCwgc3dpbmdTcGVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlYWxNZWxlZURhbWFnZSh0aW1lLCByYXdEYW1hZ2UsIHRhcmdldCwgaXNfbWgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgW3RoaXNXZWFwb24sIG90aGVyV2VhcG9uXSA9IGlzX21oID8gW3RoaXMubWgsIHRoaXMub2hdIDogW3RoaXMub2gsIHRoaXMubWhdO1xuXG4gICAgICAgIHRoaXNXZWFwb24hLm5leHRTd2luZ1RpbWUgPSB0aW1lICsgdGhpc1dlYXBvbiEud2VhcG9uLnNwZWVkIC8gdGhpcy5idWZmTWFuYWdlci5zdGF0cy5oYXN0ZSAqIDEwMDA7XG5cbiAgICAgICAgaWYgKG90aGVyV2VhcG9uICYmIG90aGVyV2VhcG9uLm5leHRTd2luZ1RpbWUgPCB0aW1lICsgMjAwKSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhgZGVsYXlpbmcgJHtpc19taCA/ICdPSCcgOiAnTUgnfSBzd2luZ2AsIHRpbWUgKyAyMDAgLSBvdGhlcldlYXBvbi5uZXh0U3dpbmdUaW1lKTtcbiAgICAgICAgICAgIG90aGVyV2VhcG9uLm5leHRTd2luZ1RpbWUgPSB0aW1lICsgMjAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlQXR0YWNraW5nU3RhdGUodGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aGlzLnRhcmdldCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0cmFBdHRhY2tDb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRvaW5nRXh0cmFBdHRhY2tzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB3aGlsZSAodGhpcy5leHRyYUF0dGFja0NvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN3aW5nV2VhcG9uKHRpbWUsIHRoaXMudGFyZ2V0LCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leHRyYUF0dGFja0NvdW50LS07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuZG9pbmdFeHRyYUF0dGFja3MgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRpbWUgPj0gdGhpcy5taCEubmV4dFN3aW5nVGltZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3dpbmdXZWFwb24odGltZSwgdGhpcy50YXJnZXQsIHRydWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm9oICYmIHRpbWUgPj0gdGhpcy5vaC5uZXh0U3dpbmdUaW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zd2luZ1dlYXBvbih0aW1lLCB0aGlzLnRhcmdldCwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgUGxheWVyLCBNZWxlZUhpdE91dGNvbWUsIFJhY2UgfSBmcm9tIFwiLi9wbGF5ZXIuanNcIjtcbmltcG9ydCB7IEJ1ZmYsIEJ1ZmZPdmVyVGltZSB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IFVuaXQgfSBmcm9tIFwiLi91bml0LmpzXCI7XG5pbXBvcnQgeyBTcGVsbCwgTGVhcm5lZFNwZWxsLCBTcGVsbERhbWFnZSwgU3BlbGxUeXBlLCBTd2luZ1NwZWxsLCBMZWFybmVkU3dpbmdTcGVsbCwgUHJvYywgU3BlbGxCdWZmIH0gZnJvbSBcIi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IGNsYW1wIH0gZnJvbSBcIi4vbWF0aC5qc1wiO1xuaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuXG5jb25zdCBmbHVycnkgPSBuZXcgQnVmZihcIkZsdXJyeVwiLCAxNSwge2hhc3RlOiAxLjN9LCB0cnVlLCAzLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG5leHBvcnQgY29uc3QgcmFjZVRvU3RhdHMgPSBuZXcgTWFwPFJhY2UsIFN0YXRWYWx1ZXM+KCk7XG5yYWNlVG9TdGF0cy5zZXQoUmFjZS5IVU1BTiwgeyBtYWNlU2tpbGw6IDUsIHN3b3JkU2tpbGw6IDUsIG1hY2UySFNraWxsOiA1LCBzd29yZDJIU2tpbGw6IDUsIHN0cjogMTIwLCBhZ2k6IDgwIH0pO1xucmFjZVRvU3RhdHMuc2V0KFJhY2UuT1JDLCB7IGF4ZVNraWxsOiA1LCBheGUySFNraWxsOiA1LCBzdHI6IDEyMywgYWdpOiA3NyB9KTtcblxuZXhwb3J0IGNsYXNzIFdhcnJpb3IgZXh0ZW5kcyBQbGF5ZXIge1xuICAgIGZsdXJyeUNvdW50ID0gMDtcbiAgICByYWdlID0gODA7IC8vIFRPRE8gLSBhbGxvdyBzaW11bGF0aW9uIHRvIGNob29zZSBzdGFydGluZyByYWdlXG5cbiAgICBleGVjdXRlID0gbmV3IExlYXJuZWRTcGVsbChleGVjdXRlU3BlbGwsIHRoaXMpO1xuICAgIGJsb29kdGhpcnN0ID0gbmV3IExlYXJuZWRTcGVsbChibG9vZHRoaXJzdFNwZWxsLCB0aGlzKTtcbiAgICBoYW1zdHJpbmcgPSBuZXcgTGVhcm5lZFNwZWxsKGhhbXN0cmluZ1NwZWxsLCB0aGlzKTtcbiAgICB3aGlybHdpbmQgPSBuZXcgTGVhcm5lZFNwZWxsKHdoaXJsd2luZFNwZWxsLCB0aGlzKTtcbiAgICBoZXJvaWNTdHJpa2UgPSBuZXcgTGVhcm5lZFN3aW5nU3BlbGwoaGVyb2ljU3RyaWtlU3BlbGwsIHRoaXMpO1xuICAgIGJsb29kUmFnZSA9IG5ldyBMZWFybmVkU3BlbGwoYmxvb2RSYWdlLCB0aGlzKTtcbiAgICBkZWF0aFdpc2ggPSBuZXcgTGVhcm5lZFNwZWxsKGRlYXRoV2lzaCwgdGhpcyk7XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgbG9nQ2FsbGJhY2s/OiAodGltZTogbnVtYmVyLCB0ZXh0OiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICAgICAgc3VwZXIobmV3IFN0YXRzKHJhY2VUb1N0YXRzLmdldChyYWNlKSkuYWRkKHN0YXRzKSwgbG9nQ2FsbGJhY2spO1xuXG4gICAgICAgIHRoaXMuYnVmZk1hbmFnZXIuYWRkKGFuZ2VyTWFuYWdlbWVudE9ULCBNYXRoLnJhbmRvbSgpICogLTMwMDApOyAvLyByYW5kb21pemluZyBhbmdlciBtYW5hZ2VtZW50IHRpbWluZ1xuICAgIH1cblxuICAgIGdldCBwb3dlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmFnZTtcbiAgICB9XG5cbiAgICBzZXQgcG93ZXIocG93ZXI6IG51bWJlcikge1xuICAgICAgICB0aGlzLnJhZ2UgPSBjbGFtcChwb3dlciwgMCwgMTAwKTtcbiAgICB9XG5cbiAgICBnZXQgYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxldmVsICogMyAtIDIwICsgdGhpcy5idWZmTWFuYWdlci5zdGF0cy5hcCArIHRoaXMuYnVmZk1hbmFnZXIuc3RhdHMuc3RyICogdGhpcy5idWZmTWFuYWdlci5zdGF0cy5zdGF0TXVsdCAqIDI7XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlQ3JpdENoYW5jZSgpIHtcbiAgICAgICAgLy8gY3J1ZWx0eSArIGJlcnNlcmtlciBzdGFuY2VcbiAgICAgICAgcmV0dXJuIDUgKyAzICsgc3VwZXIuY2FsY3VsYXRlQ3JpdENoYW5jZSgpO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZU1lbGVlRGFtYWdlKHJhd0RhbWFnZTogbnVtYmVyLCB2aWN0aW06IFVuaXQsIGlzX21oOiBib29sZWFuLCBpc19zcGVsbDogYm9vbGVhbiwgaWdub3JlX3dlYXBvbl9za2lsbCA9IGZhbHNlKTogW251bWJlciwgTWVsZWVIaXRPdXRjb21lLCBudW1iZXJdIHtcbiAgICAgICAgbGV0IFtkYW1hZ2VEb25lLCBoaXRPdXRjb21lLCBjbGVhbkRhbWFnZV0gPSBzdXBlci5jYWxjdWxhdGVNZWxlZURhbWFnZShyYXdEYW1hZ2UsIHZpY3RpbSwgaXNfbWgsIGlzX3NwZWxsLCBpZ25vcmVfd2VhcG9uX3NraWxsKTtcblxuICAgICAgICBpZiAoaGl0T3V0Y29tZSA9PT0gTWVsZWVIaXRPdXRjb21lLk1FTEVFX0hJVF9DUklUICYmIGlzX3NwZWxsKSB7XG4gICAgICAgICAgICBkYW1hZ2VEb25lICo9IDEuMTsgLy8gaW1wYWxlXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBbZGFtYWdlRG9uZSwgaGl0T3V0Y29tZSwgY2xlYW5EYW1hZ2VdO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCByZXdhcmRSYWdlKGRhbWFnZTogbnVtYmVyLCBpc19hdHRhY2tlcjogYm9vbGVhbiwgdGltZTogbnVtYmVyKSB7XG4gICAgICAgIC8vIGh0dHBzOi8vYmx1ZS5tbW8tY2hhbXBpb24uY29tL3RvcGljLzE4MzI1LXRoZS1uZXctcmFnZS1mb3JtdWxhLWJ5LWthbGdhbi9cbiAgICAgICAgLy8gUHJlLUV4cGFuc2lvbiBSYWdlIEdhaW5lZCBmcm9tIGRlYWxpbmcgZGFtYWdlOlxuICAgICAgICAvLyAoRGFtYWdlIERlYWx0KSAvIChSYWdlIENvbnZlcnNpb24gYXQgWW91ciBMZXZlbCkgKiA3LjVcbiAgICAgICAgLy8gRm9yIFRha2luZyBEYW1hZ2UgKGJvdGggcHJlIGFuZCBwb3N0IGV4cGFuc2lvbik6XG4gICAgICAgIC8vIFJhZ2UgR2FpbmVkID0gKERhbWFnZSBUYWtlbikgLyAoUmFnZSBDb252ZXJzaW9uIGF0IFlvdXIgTGV2ZWwpICogMi41XG4gICAgICAgIC8vIFJhZ2UgQ29udmVyc2lvbiBhdCBsZXZlbCA2MDogMjMwLjZcbiAgICAgICAgLy8gVE9ETyAtIGhvdyBkbyBmcmFjdGlvbnMgb2YgcmFnZSB3b3JrPyBpdCBhcHBlYXJzIHlvdSBkbyBnYWluIGZyYWN0aW9ucyBiYXNlZCBvbiBleGVjIGRhbWFnZVxuICAgICAgICAvLyBub3QgdHJ1bmNhdGluZyBmb3Igbm93XG4gICAgICAgIFxuICAgICAgICBjb25zdCBMRVZFTF82MF9SQUdFX0NPTlYgPSAyMzAuNjtcbiAgICAgICAgbGV0IGFkZFJhZ2UgPSBkYW1hZ2UgLyBMRVZFTF82MF9SQUdFX0NPTlY7XG4gICAgICAgIFxuICAgICAgICBpZiAoaXNfYXR0YWNrZXIpIHtcbiAgICAgICAgICAgIGFkZFJhZ2UgKj0gNy41O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVE9ETyAtIGNoZWNrIGZvciBiZXJzZXJrZXIgcmFnZSAxLjN4IG1vZGlmaWVyXG4gICAgICAgICAgICBhZGRSYWdlICo9IDIuNTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxvZykgdGhpcy5sb2codGltZSwgYEdhaW5lZCAke01hdGgubWluKGFkZFJhZ2UsIDEwMCAtIHRoaXMucmFnZSl9IHJhZ2UgKCR7TWF0aC5taW4oMTAwLCB0aGlzLnBvd2VyICsgYWRkUmFnZSl9KWApO1xuXG4gICAgICAgIHRoaXMucG93ZXIgKz0gYWRkUmFnZTtcbiAgICB9XG5cbiAgICB1cGRhdGVQcm9jcyh0aW1lOiBudW1iZXIsIGlzX21oOiBib29sZWFuLCBoaXRPdXRjb21lOiBNZWxlZUhpdE91dGNvbWUsIGRhbWFnZURvbmU6IG51bWJlciwgY2xlYW5EYW1hZ2U6IG51bWJlciwgc3BlbGw/OiBTcGVsbCkge1xuICAgICAgICBzdXBlci51cGRhdGVQcm9jcyh0aW1lLCBpc19taCwgaGl0T3V0Y29tZSwgZGFtYWdlRG9uZSwgY2xlYW5EYW1hZ2UsIHNwZWxsKTtcblxuICAgICAgICBpZiAoW01lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfUEFSUlksIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpKSB7XG4gICAgICAgICAgICBpZiAoc3BlbGwpIHtcbiAgICAgICAgICAgICAgICAvLyBodHRwOi8vYmx1ZS5tbW8tY2hhbXBpb24uY29tL3RvcGljLzY5MzY1LTE4LTAyLTA1LWthbGdhbnMtcmVzcG9uc2UtdG8td2FycmlvcnMvIFwic2luY2UgbWlzc2luZyB3YXN0ZXMgMjAlIG9mIHRoZSByYWdlIGNvc3Qgb2YgdGhlIGFiaWxpdHlcIlxuICAgICAgICAgICAgICAgIC8vIFRPRE8gLSBub3Qgc3VyZSBob3cgYmxpenpsaWtlIHRoaXMgaXNcbiAgICAgICAgICAgICAgICBpZiAoc3BlbGwgIT09IHdoaXJsd2luZFNwZWxsKSB7IC8vIFRPRE8gLSBzaG91bGQgY2hlY2sgdG8gc2VlIGlmIGl0IGlzIGFuIGFvZSBzcGVsbCBvciBhIHNpbmdsZSB0YXJnZXQgc3BlbGxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYWdlICs9IHNwZWxsLmNvc3QgKiAwLjgyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXdhcmRSYWdlKGNsZWFuRGFtYWdlICogMC43NSwgdHJ1ZSwgdGltZSk7IC8vIFRPRE8gLSB3aGVyZSBpcyB0aGlzIGZvcm11bGEgZnJvbT9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChkYW1hZ2VEb25lICYmICFzcGVsbCkge1xuICAgICAgICAgICAgdGhpcy5yZXdhcmRSYWdlKGRhbWFnZURvbmUsIHRydWUsIHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5zdGFudCBhdHRhY2tzIGFuZCBtaXNzZXMvZG9kZ2VzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyAvLyBUT0RPIC0gY29uZmlybVxuICAgICAgICAvLyBleHRyYSBhdHRhY2tzIGRvbid0IHVzZSBmbHVycnkgY2hhcmdlcyBidXQgdGhleSBjYW4gcHJvYyBmbHVycnkgKHRlc3RlZClcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXRoaXMuZG9pbmdFeHRyYUF0dGFja3NcbiAgICAgICAgICAgICYmICEoc3BlbGwgfHwgc3BlbGwgPT09IGhlcm9pY1N0cmlrZVNwZWxsKVxuICAgICAgICAgICAgJiYgIVtNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX01JU1MsIE1lbGVlSGl0T3V0Y29tZS5NRUxFRV9ISVRfRE9ER0VdLmluY2x1ZGVzKGhpdE91dGNvbWUpXG4gICAgICAgICAgICAmJiBoaXRPdXRjb21lICE9PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVRcbiAgICAgICAgKSB7IFxuICAgICAgICAgICAgdGhpcy5mbHVycnlDb3VudCA9IE1hdGgubWF4KDAsIHRoaXMuZmx1cnJ5Q291bnQgLSAxKTtcbiAgICAgICAgICAgIC8vIHRoaXMuYnVmZk1hbmFnZXIucmVtb3ZlKGZsdXJyeSwgdGltZSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChoaXRPdXRjb21lID09PSBNZWxlZUhpdE91dGNvbWUuTUVMRUVfSElUX0NSSVQpIHtcbiAgICAgICAgICAgIC8vIFRPRE8gLSBpZ25vcmluZyBkZWVwIHdvdW5kc1xuICAgICAgICAgICAgdGhpcy5idWZmTWFuYWdlci5hZGQoZmx1cnJ5LCB0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgaGVyb2ljU3RyaWtlU3BlbGwgPSBuZXcgU3dpbmdTcGVsbChcIkhlcm9pYyBTdHJpa2VcIiwgMTU3LCAxMik7XG5cbi8vIFRPRE8gLSBuZWVkcyB0byB3aXBlIG91dCBhbGwgcmFnZSBldmVuIHRob3VnaCBpdCBvbmx5IGNvc3RzIDEwXG5jb25zdCBleGVjdXRlU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJFeGVjdXRlXCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiA2MDAgKyAoKDxXYXJyaW9yPnBsYXllcikucmFnZSAtIDEwKTtcbn0sIFNwZWxsVHlwZS5QSFlTSUNBTF9XRUFQT04sIHRydWUsIDEwLCAwKTtcblxuY29uc3QgYmxvb2R0aGlyc3RTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkJsb29kdGhpcnN0XCIsIChwbGF5ZXI6IFBsYXllcikgPT4ge1xuICAgIHJldHVybiAoPFdhcnJpb3I+cGxheWVyKS5hcCAqIDAuNDU7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUwsIHRydWUsIDMwLCA2KTtcblxuY29uc3Qgd2hpcmx3aW5kU3BlbGwgPSBuZXcgU3BlbGxEYW1hZ2UoXCJXaGlybHdpbmRcIiwgKHBsYXllcjogUGxheWVyKSA9PiB7XG4gICAgcmV0dXJuIHBsYXllci5jYWxjdWxhdGVSYXdEYW1hZ2UodHJ1ZSk7XG59LCBTcGVsbFR5cGUuUEhZU0lDQUxfV0VBUE9OLCB0cnVlLCAyNSwgMTApO1xuXG5jb25zdCBoYW1zdHJpbmdTcGVsbCA9IG5ldyBTcGVsbERhbWFnZShcIkhhbXN0cmluZ1wiLCA0NSwgU3BlbGxUeXBlLlBIWVNJQ0FMX1dFQVBPTiwgdHJ1ZSwgMTAsIDApO1xuXG5leHBvcnQgY29uc3QgYW5nZXJNYW5hZ2VtZW50T1QgPSBuZXcgQnVmZk92ZXJUaW1lKFwiQW5nZXIgTWFuYWdlbWVudFwiLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgdW5kZWZpbmVkLCAzMDAwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxO1xuICAgIGlmIChwbGF5ZXIubG9nKSBwbGF5ZXIubG9nKHRpbWUsIGBZb3UgZ2FpbmVkIDEgcmFnZSBmcm9tIEFuZ2VyIE1hbmFnZW1lbnRgKTtcbn0pO1xuXG5jb25zdCBibG9vZFJhZ2VPVCA9IG5ldyBCdWZmT3ZlclRpbWUoXCJCbG9vZHJhZ2VcIiwgMTAsIHVuZGVmaW5lZCwgMTAwMCwgKHBsYXllcjogUGxheWVyLCB0aW1lOiBudW1iZXIpID0+IHtcbiAgICBwbGF5ZXIucG93ZXIgKz0gMTtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW5lZCAxIHJhZ2UgZnJvbSBCbG9vZHJhZ2VgKTtcbn0pO1xuXG5jb25zdCBibG9vZFJhZ2UgPSBuZXcgU3BlbGwoXCJCbG9vZHJhZ2VcIiwgZmFsc2UsIDAsIDYwLCAocGxheWVyOiBQbGF5ZXIsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgIHBsYXllci5wb3dlciArPSAxMDtcbiAgICBpZiAocGxheWVyLmxvZykgcGxheWVyLmxvZyh0aW1lLCBgWW91IGdhaW4gMTAgcmFnZSBmcm9tIEJsb29kcmFnZWApO1xuICAgIHBsYXllci5idWZmTWFuYWdlci5hZGQoYmxvb2RSYWdlT1QsIHRpbWUpO1xufSk7XG5cbmNvbnN0IGRlYXRoV2lzaCA9IG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJEZWF0aCBXaXNoXCIsIDMwLCB7IGRhbWFnZU11bHQ6IDEuMiB9KSwgdHJ1ZSwgMTAsIDMgKiA2MCk7XG4iLCJpbXBvcnQgeyBCdWZmIH0gZnJvbSBcIi4uL2J1ZmYuanNcIjtcbmltcG9ydCB7IFNwZWxsQnVmZiwgUHJvYywgRXh0cmFBdHRhY2sgfSBmcm9tIFwiLi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IFN0YXRzLCBTdGF0VmFsdWVzIH0gZnJvbSBcIi4uL3N0YXRzLmpzXCI7XG5pbXBvcnQgeyBUZW1wb3JhcnlXZWFwb25FbmNoYW50IH0gZnJvbSBcIi4uL2l0ZW0uanNcIjtcblxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1ZmZEZXNjcmlwdGlvbiB7XG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGR1cmF0aW9uOiBudW1iZXIsXG4gICAgc3RhdHM/OiBTdGF0VmFsdWVzLFxufVxuXG5leHBvcnQgY29uc3QgYnVmZnM6IEJ1ZmZbXSA9IFtcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmF0dGxlIFNob3V0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAyICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjkwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGVzc2luZyBvZiBLaW5nc1wiLFxuICAgICAgICBkdXJhdGlvbjogMTUgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0YXRNdWx0OiAxLjFcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkJsZXNzaW5nIG9mIE1pZ2h0XCIsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDIyMlxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUmFsbHlpbmcgQ3J5IG9mIHRoZSBEcmFnb25zbGF5ZXJcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYXA6IDE0MCxcbiAgICAgICAgICAgIGNyaXQ6IDVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNvbmdmbG93ZXIgU2VyYW5hZGVcIixcbiAgICAgICAgZHVyYXRpb246IDIgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgY3JpdDogNSxcbiAgICAgICAgICAgIHN0cjogMTUsXG4gICAgICAgICAgICBhZ2k6IDE1XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTcGlyaXQgb2YgWmFuZGFsYXJcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RhdE11bHQ6IDEuMTVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIldhcmNoaWVmJ3MgQmxlc3NpbmdcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgaGFzdGU6IDEuMTVcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlNtb2tlZCBEZXNlcnQgRHVtcGxpbmdzXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxNSAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAyMFxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSnVqdSBQb3dlclwiLFxuICAgICAgICBkdXJhdGlvbjogMzAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMzBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkp1anUgTWlnaHRcIixcbiAgICAgICAgZHVyYXRpb246IDEwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogNDBcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVsaXhpciBvZiB0aGUgTW9uZ29vc2VcIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYWdpOiAyNSxcbiAgICAgICAgICAgIGNyaXQ6IDJcbiAgICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIuTy5JLkQuUy5cIixcbiAgICAgICAgZHVyYXRpb246IDEgKiA2MCAqIDYwLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgc3RyOiAyNVxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRmVuZ3VzJyBGZXJvY2l0eVwiLFxuICAgICAgICBkdXJhdGlvbjogMiAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMjAwXG4gICAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHaWZ0IG9mIHRoZSBXaWxkXCIsXG4gICAgICAgIGR1cmF0aW9uOiAxICogNjAgKiA2MCxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIHN0cjogMTYsIC8vIFRPRE8gLSBzaG91bGQgaXQgYmUgMTIgKiAxLjM1PyAodGFsZW50KVxuICAgICAgICAgICAgYWdpOiAxNlxuICAgICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiVHJ1ZXNob3QgQXVyYVwiLFxuICAgICAgICBkdXJhdGlvbjogMSAqIDYwICogNjAsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhcDogMTAwXG4gICAgICAgIH1cbiAgICB9LFxuXS5tYXAoKGJkOiBCdWZmRGVzY3JpcHRpb24pID0+IG5ldyBCdWZmKGJkLm5hbWUsIGJkLmR1cmF0aW9uLCBiZC5zdGF0cykpO1xuXG4vLyBOT1RFOiB0byBzaW1wbGlmeSB0aGUgY29kZSwgdHJlYXRpbmcgdGhlc2UgYXMgdHdvIHNlcGFyYXRlIGJ1ZmZzIHNpbmNlIHRoZXkgc3RhY2tcbi8vIGNydXNhZGVyIGJ1ZmZzIGFwcGFyZW50bHkgY2FuIGJlIGZ1cnRoZXIgc3RhY2tlZCBieSBzd2FwcGluZyB3ZWFwb25zIGJ1dCBub3QgZ29pbmcgdG8gYm90aGVyIHdpdGggdGhhdFxuZXhwb3J0IGNvbnN0IGNydXNhZGVyQnVmZk1IUHJvYyA9IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJDcnVzYWRlciBNSFwiLCAxNSwgbmV3IFN0YXRzKHtzdHI6IDEwMH0pKSksIHtwcG06IDF9KTtcbmV4cG9ydCBjb25zdCBjcnVzYWRlckJ1ZmZPSFByb2MgPSBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKG5ldyBCdWZmKFwiQ3J1c2FkZXIgT0hcIiwgMTUsIG5ldyBTdGF0cyh7c3RyOiAxMDB9KSkpLCB7cHBtOiAxfSk7XG5cbmV4cG9ydCBjb25zdCBkZW5zZURhbWFnZVN0b25lID0gbmV3IFRlbXBvcmFyeVdlYXBvbkVuY2hhbnQoeyBwbHVzRGFtYWdlOiA4IH0pO1xuXG5leHBvcnQgY29uc3Qgd2luZGZ1cnlFbmNoYW50ID0gbmV3IFRlbXBvcmFyeVdlYXBvbkVuY2hhbnQodW5kZWZpbmVkLCBuZXcgUHJvYyhbXG4gICAgbmV3IEV4dHJhQXR0YWNrKFwiV2luZGZ1cnkgVG90ZW1cIiwgMSksXG4gICAgbmV3IFNwZWxsQnVmZihuZXcgQnVmZihcIldpbmRmdXJ5IFRvdGVtXCIsIDEuNSwgeyBhcDogMzE1IH0pKVxuXSwge2NoYW5jZTogMC4yfSkpO1xuIiwiaW1wb3J0IHsgV2VhcG9uVHlwZSwgV2VhcG9uRGVzY3JpcHRpb24sIEl0ZW1TbG90LCBJdGVtRGVzY3JpcHRpb24gfSBmcm9tIFwiLi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgU3BlbGxCdWZmLCBFeHRyYUF0dGFjaywgUHJvYywgU3BlbGwgfSBmcm9tIFwiLi4vc3BlbGwuanNcIjtcbmltcG9ydCB7IEJ1ZmYsIEJ1ZmZQcm9jIH0gZnJvbSBcIi4uL2J1ZmYuanNcIjtcblxuLy8gVE9ETyAtIGhvdyB0byBpbXBsZW1lbnQgc2V0IGJvbnVzZXM/IHByb2JhYmx5IGVhc2llc3QgdG8gYWRkIGJvbnVzIHRoYXQgcmVxdWlyZXMgYSBzdHJpbmcgc2VhcmNoIG9mIG90aGVyIGVxdWlwZWQgaXRlbXNcblxuZXhwb3J0IGNvbnN0IGl0ZW1zOiAoSXRlbURlc2NyaXB0aW9ufFdlYXBvbkRlc2NyaXB0aW9uKVtdID0gW1xuICAgIHtcbiAgICAgICAgbmFtZTogXCJJcm9uZm9lXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIG1pbjogNzMsXG4gICAgICAgIG1heDogMTM2LFxuICAgICAgICBzcGVlZDogMi40LFxuICAgICAgICBvbmhpdDogbmV3IFByb2MobmV3IEV4dHJhQXR0YWNrKCdJcm9uZm9lJywgMikse3BwbTogMX0pXG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRW1weXJlYW4gRGVtb2xpc2hlclwiLFxuICAgICAgICB0eXBlOiBXZWFwb25UeXBlLk1BQ0UsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5ELFxuICAgICAgICBtaW46IDk0LFxuICAgICAgICBtYXg6IDE3NSxcbiAgICAgICAgc3BlZWQ6IDIuOCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJIYXN0ZSAoRW1weXJlYW4gRGVtb2xpc2hlcilcIiwgMTAsIHtoYXN0ZTogMS4yfSkpLHtwcG06IDF9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkFudWJpc2F0aCBXYXJoYW1tZXJcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5NQUNFLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5NQUlOSEFORHxJdGVtU2xvdC5PRkZIQU5ELFxuICAgICAgICBtaW46IDY2LFxuICAgICAgICBtYXg6IDEyMyxcbiAgICAgICAgc3BlZWQ6IDEuOCxcbiAgICAgICAgc3RhdHM6IHsgbWFjZVNraWxsOiA0LCBhcDogMzIgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRoZSBVbnRhbWVkIEJsYWRlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQySCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkQsXG4gICAgICAgIG1pbjogMTkyLFxuICAgICAgICBtYXg6IDI4OSxcbiAgICAgICAgc3BlZWQ6IDMuNCxcbiAgICAgICAgb25oaXQ6IG5ldyBQcm9jKG5ldyBTcGVsbEJ1ZmYobmV3IEJ1ZmYoXCJVbnRhbWVkIEZ1cnlcIiwgOCwge3N0cjogMzAwfSkpLHtwcG06IDJ9KVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkhhbmQgb2YgSnVzdGljZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBzdGF0czoge2FwOiAyMH0sXG4gICAgICAgIG9uZXF1aXA6IG5ldyBQcm9jKG5ldyBFeHRyYUF0dGFjaygnSGFuZCBvZiBKdXN0aWNlJywgMSksIHtjaGFuY2U6IDIvMTAwfSlcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCbGFja2hhbmQncyBCcmVhZHRoXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7Y3JpdDogMn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJEcmFrZSBGYW5nIFRhbGlzbWFuXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LlRSSU5LRVQxIHwgSXRlbVNsb3QuVFJJTktFVDIsXG4gICAgICAgIHN0YXRzOiB7YXA6IDU2LCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTGlvbmhlYXJ0IEhlbG1cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEVBRCxcbiAgICAgICAgc3RhdHM6IHtjcml0OiAyLCBoaXQ6IDIsIHN0cjogMTh9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQmFyYmVkIENob2tlclwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5ORUNLLFxuICAgICAgICBzdGF0czoge2FwOiA0NCwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJPbnl4aWEgVG9vdGggUGVuZGFudFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5ORUNLLFxuICAgICAgICBzdGF0czoge2FnaTogMTIsIGhpdDogMSwgY3JpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBTcGF1bGRlcnNcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuU0hPVUxERVIsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNsb2FrIG9mIERyYWNvbmljIE1pZ2h0XCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkJBQ0ssXG4gICAgICAgIHN0YXRzOiB7c3RyOiAxNiwgYWdpOiAxNn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDb25xdWVyb3IncyBCcmVhc3RwbGF0ZVwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5DSEVTVCxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDIwLCBhZ2k6IDE2LCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiSGl2ZSBEZWZpbGVyIFdyaXN0Z3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge3N0cjogMjMsIGFnaTogMTh9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiUWlyYWppIEV4ZWN1dGlvbiBCcmFjZXJzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LldSSVNULFxuICAgICAgICBzdGF0czoge2FnaTogMTYsIHN0cjogMTUsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJHYXVudGxldHMgb2YgTWlnaHRcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMiwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkdhdW50bGV0cyBvZiBBbm5paGlsYXRpb25cIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuSEFORFMsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzNSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkVkZ2VtYXN0ZXIncyBIYW5kZ3VhcmRzXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkhBTkRTLFxuICAgICAgICBzdGF0czogeyBheGVTa2lsbDogNywgZGFnZ2VyU2tpbGw6IDcsIHN3b3JkU2tpbGw6IDcgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIk9uc2xhdWdodCBHaXJkbGVcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuV0FJU1QsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAzMSwgY3JpdDogMSwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlRpdGFuaWMgTGVnZ2luZ3NcIixcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTEVHUyxcbiAgICAgICAgc3RhdHM6IHtzdHI6IDMwLCBjcml0OiAxLCBoaXQ6IDJ9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiQm9vdHMgb2YgdGhlIEZhbGxlbiBIZXJvXCIsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90LkZFRVQsXG4gICAgICAgIHN0YXRzOiB7c3RyOiAyMCwgYWdpOiAxNCwgaGl0OiAxfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIkNocm9tYXRpYyBCb290c1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5GRUVULFxuICAgICAgICBzdGF0czoge3N0cjogMjAsIGFnaTogMjAsIGhpdDogMX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJTdHJpa2VyJ3MgTWFya1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SQU5HRUQsXG4gICAgICAgIHN0YXRzOiB7YXA6IDIyLCBoaXQ6IDF9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiRG9uIEp1bGlvJ3MgQmFuZFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHtjcml0OiAxLCBoaXQ6IDEsIGFwOiAxNn1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJRdWljayBTdHJpa2UgUmluZ1wiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5SSU5HMXxJdGVtU2xvdC5SSU5HMixcbiAgICAgICAgc3RhdHM6IHthcDogMzAsIGNyaXQ6IDEsIHN0cjogNX1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJDaHJvbWF0aWNhbGx5IFRlbXBlcmVkIFN3b3JkXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTA2LFxuICAgICAgICBtYXg6IDE5OCxcbiAgICAgICAgc3BlZWQ6IDIuNixcbiAgICAgICAgc3RhdHM6IHsgYWdpOiAxNCwgc3RyOiAxNCB9XG4gICAgfSxcbiAgICB7XG4gICAgICAgIG5hbWU6IFwiTWFsYWRhdGgsIFJ1bmVkIEJsYWRlIG9mIHRoZSBCbGFjayBGbGlnaHRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiA4NixcbiAgICAgICAgbWF4OiAxNjIsXG4gICAgICAgIHNwZWVkOiAyLjIsXG4gICAgICAgIHN0YXRzOiB7IHN3b3JkU2tpbGw6IDQgfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBMb25nc3dvcmRcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5TV09SRCxcbiAgICAgICAgc2xvdDogSXRlbVNsb3QuTUFJTkhBTkR8SXRlbVNsb3QuT0ZGSEFORCxcbiAgICAgICAgbWluOiAxMzgsXG4gICAgICAgIG1heDogMjA3LFxuICAgICAgICBzcGVlZDogMi45LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBTd2lmdGJsYWRlXCIsXG4gICAgICAgIHR5cGU6IFdlYXBvblR5cGUuU1dPUkQsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogODUsXG4gICAgICAgIG1heDogMTI5LFxuICAgICAgICBzcGVlZDogMS44LFxuICAgICAgICBzdGF0czogeyBjcml0OiAxLCBhcDogMjggfVxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiBcIlIxNCBBeGVcIixcbiAgICAgICAgdHlwZTogV2VhcG9uVHlwZS5BWEUsXG4gICAgICAgIHNsb3Q6IEl0ZW1TbG90Lk1BSU5IQU5EfEl0ZW1TbG90Lk9GRkhBTkQsXG4gICAgICAgIG1pbjogMTM4LFxuICAgICAgICBtYXg6IDIwNyxcbiAgICAgICAgc3BlZWQ6IDIuOSxcbiAgICAgICAgc3RhdHM6IHsgY3JpdDogMSwgYXA6IDI4IH1cbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiLFxuICAgICAgICBzbG90OiBJdGVtU2xvdC5UUklOS0VUMSB8IEl0ZW1TbG90LlRSSU5LRVQyLFxuICAgICAgICBvbnVzZTogKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGluc2lnaHRPZlRoZVFpcmFqaSA9IG5ldyBCdWZmKFwiSW5zaWdodCBvZiB0aGUgUWlyYWppXCIsIDMwLCB7YXJtb3JQZW5ldHJhdGlvbjogMjAwfSwgdHJ1ZSwgMCwgNik7XG4gICAgICAgICAgICBjb25zdCBiYWRnZUJ1ZmYgPSBuZXcgU3BlbGxCdWZmKFxuICAgICAgICAgICAgICAgIG5ldyBCdWZmUHJvYyhcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIsIDMwLFxuICAgICAgICAgICAgICAgICAgICBuZXcgUHJvYyhuZXcgU3BlbGxCdWZmKGluc2lnaHRPZlRoZVFpcmFqaSksIHtwcG06IDE1fSksXG4gICAgICAgICAgICAgICAgICAgIGluc2lnaHRPZlRoZVFpcmFqaSksXG4gICAgICAgICAgICAgICAgZmFsc2UsIDAsIDMgKiA2MCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBiYWRnZUJ1ZmY7XG4gICAgICAgIH0pKClcbiAgICB9XG5dLnNvcnQoKGEsIGIpID0+IHtcbiAgICByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5kZXhGb3JJdGVtTmFtZShuYW1lOiBzdHJpbmcpOiBudW1iZXJ8dW5kZWZpbmVkIHtcbiAgICBmb3IgKGxldCBbaWR4LCBpdGVtXSBvZiBpdGVtcy5lbnRyaWVzKCkpIHtcbiAgICAgICAgaWYgKGl0ZW0ubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIGlkeDtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFN0YXRWYWx1ZXMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgSXRlbVdpdGhTbG90IH0gZnJvbSBcIi4vc2ltdWxhdGlvbi5qc1wiO1xuaW1wb3J0IHsgQnVmZiB9IGZyb20gXCIuL2J1ZmYuanNcIjtcbmltcG9ydCB7IExvZ0Z1bmN0aW9uLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBXYXJyaW9yIH0gZnJvbSBcIi4vd2Fycmlvci5qc1wiO1xuaW1wb3J0IHsgY3J1c2FkZXJCdWZmTUhQcm9jLCBjcnVzYWRlckJ1ZmZPSFByb2MsIGJ1ZmZzLCB3aW5kZnVyeUVuY2hhbnQsIGRlbnNlRGFtYWdlU3RvbmUgfSBmcm9tIFwiLi9kYXRhL3NwZWxscy5qc1wiO1xuaW1wb3J0IHsgVW5pdCB9IGZyb20gXCIuL3VuaXQuanNcIjtcbmltcG9ydCB7IEl0ZW1TbG90IH0gZnJvbSBcIi4vaXRlbS5qc1wiO1xuaW1wb3J0IHsgaXRlbXMgfSBmcm9tIFwiLi9kYXRhL2l0ZW1zLmpzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2ltdWxhdGlvbkRlc2NyaXB0aW9uIHtcbiAgICByYWNlOiBSYWNlLFxuICAgIHN0YXRzOiBTdGF0VmFsdWVzLFxuICAgIGVxdWlwbWVudDogW251bWJlciwgSXRlbVNsb3RdW10sXG4gICAgYnVmZnM6IG51bWJlcltdLFxuICAgIGZpZ2h0TGVuZ3RoOiBudW1iZXIsXG4gICAgcmVhbHRpbWU6IGJvb2xlYW4sXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cFBsYXllcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBJdGVtV2l0aFNsb3RbXSwgYnVmZnM6IEJ1ZmZbXSwgbG9nPzogTG9nRnVuY3Rpb24pIHtcbiAgICBjb25zdCBwbGF5ZXIgPSBuZXcgV2FycmlvcihyYWNlLCBzdGF0cywgbG9nKTtcblxuICAgIGZvciAobGV0IFtpdGVtLCBzbG90XSBvZiBlcXVpcG1lbnQpIHtcbiAgICAgICAgcGxheWVyLmVxdWlwKGl0ZW0sIHNsb3QpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGJ1ZmYgb2YgYnVmZnMpIHtcbiAgICAgICAgcGxheWVyLmJ1ZmZNYW5hZ2VyLmFkZChidWZmLCAwKTtcbiAgICB9XG5cbiAgICBwbGF5ZXIubWghLmFkZFByb2MoY3J1c2FkZXJCdWZmTUhQcm9jKTtcbiAgICBwbGF5ZXIubWghLnRlbXBvcmFyeUVuY2hhbnQgPSByYWNlID09PSBSYWNlLk9SQyA/IHdpbmRmdXJ5RW5jaGFudCA6IGRlbnNlRGFtYWdlU3RvbmU7XG5cbiAgICBpZiAocGxheWVyLm9oKSB7XG4gICAgICAgIHBsYXllci5vaC5hZGRQcm9jKGNydXNhZGVyQnVmZk9IUHJvYyk7XG4gICAgICAgIHBsYXllci5vaC50ZW1wb3JhcnlFbmNoYW50ID0gZGVuc2VEYW1hZ2VTdG9uZTtcbiAgICB9XG5cbiAgICBjb25zdCBib3NzID0gbmV3IFVuaXQoNjMsIDQ2OTEgLSAyMjUwIC0gNjQwIC0gNTA1IC0gNjAwKTsgLy8gc3VuZGVyLCBjb3IsIGZmLCBhbm5paFxuICAgIHBsYXllci50YXJnZXQgPSBib3NzO1xuXG4gICAgcmV0dXJuIHBsYXllcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVxdWlwbWVudEluZGljZXNUb0l0ZW0oZXF1aXBtZW50OiBbbnVtYmVyLCBJdGVtU2xvdF1bXSk6IEl0ZW1XaXRoU2xvdFtdIHtcbiAgICBjb25zdCByZXM6IEl0ZW1XaXRoU2xvdFtdID0gW107XG4gICAgXG4gICAgZm9yIChsZXQgW2lkeCwgc2xvdF0gb2YgZXF1aXBtZW50KSB7XG4gICAgICAgIGlmIChpdGVtc1tpZHhdKSB7XG4gICAgICAgICAgICByZXMucHVzaChbaXRlbXNbaWR4XSwgc2xvdF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2JhZCBpdGVtIGluZGV4JywgaWR4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWZmSW5kaWNlc1RvQnVmZihidWZmSW5kaWNlczogbnVtYmVyW10pOiBCdWZmW10ge1xuICAgIGNvbnN0IHJlczogQnVmZltdID0gW107XG5cbiAgICBmb3IgKGxldCBpZHggb2YgYnVmZkluZGljZXMpIHtcbiAgICAgICAgaWYgKGJ1ZmZzW2lkeF0pIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGJ1ZmZzW2lkeF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2JhZCBidWZmIGluZGV4JywgaWR4KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzO1xufVxuIiwiaW1wb3J0IHsgU3RhdFZhbHVlcywgU3RhdHMgfSBmcm9tIFwiLi9zdGF0cy5qc1wiO1xuaW1wb3J0IHsgSXRlbURlc2NyaXB0aW9uLCBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW0uanNcIjtcbmltcG9ydCB7IEJ1ZmYgfSBmcm9tIFwiLi9idWZmLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiwgUGxheWVyLCBSYWNlIH0gZnJvbSBcIi4vcGxheWVyLmpzXCI7XG5pbXBvcnQgeyBzZXR1cFBsYXllciB9IGZyb20gXCIuL3NpbXVsYXRpb25fdXRpbHMuanNcIjtcblxuZXhwb3J0IHR5cGUgSXRlbVdpdGhTbG90ID0gW0l0ZW1EZXNjcmlwdGlvbiwgSXRlbVNsb3RdO1xuXG4vLyBUT0RPIC0gY2hhbmdlIHRoaXMgaW50ZXJmYWNlIHNvIHRoYXQgQ2hvb3NlQWN0aW9uIGNhbm5vdCBzY3JldyB1cCB0aGUgc2ltIG9yIGNoZWF0XG4vLyBlLmcuIENob29zZUFjdGlvbiBzaG91bGRuJ3QgY2FzdCBzcGVsbHMgYXQgYSBjdXJyZW50IHRpbWVcbmV4cG9ydCB0eXBlIENob29zZUFjdGlvbiA9IChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyLCBmaWdodExlbmd0aDogbnVtYmVyKSA9PiBudW1iZXJ8dW5kZWZpbmVkO1xuXG5jbGFzcyBGaWdodCB7XG4gICAgcGxheWVyOiBQbGF5ZXI7XG4gICAgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb247XG4gICAgcHJvdGVjdGVkIGZpZ2h0TGVuZ3RoOiBudW1iZXI7XG4gICAgZHVyYXRpb24gPSAwO1xuXG4gICAgY29uc3RydWN0b3IocmFjZTogUmFjZSwgc3RhdHM6IFN0YXRWYWx1ZXMsIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W10sIGJ1ZmZzOiBCdWZmW10sIGNob29zZUFjdGlvbjogQ2hvb3NlQWN0aW9uLCBmaWdodExlbmd0aCA9IDYwLCBsb2c/OiBMb2dGdW5jdGlvbikge1xuICAgICAgICB0aGlzLnBsYXllciA9IHNldHVwUGxheWVyKHJhY2UsIHN0YXRzLCBlcXVpcG1lbnQsIGJ1ZmZzLCBsb2cpO1xuICAgICAgICB0aGlzLmNob29zZUFjdGlvbiA9IGNob29zZUFjdGlvbjtcbiAgICAgICAgdGhpcy5maWdodExlbmd0aCA9IChmaWdodExlbmd0aCArIE1hdGgucmFuZG9tKCkgKiA0IC0gMikgKiAxMDAwO1xuICAgIH1cblxuICAgIHJ1bigpOiBQcm9taXNlPEZpZ2h0UmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZiwgcikgPT4ge1xuICAgICAgICAgICAgd2hpbGUgKHRoaXMuZHVyYXRpb24gPD0gdGhpcy5maWdodExlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGYoe1xuICAgICAgICAgICAgICAgIGRhbWFnZURvbmU6IHRoaXMucGxheWVyLmRhbWFnZURvbmUsXG4gICAgICAgICAgICAgICAgZmlnaHRMZW5ndGg6IHRoaXMuZmlnaHRMZW5ndGhcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHt9XG5cbiAgICBjYW5jZWwoKSB7fVxuXG4gICAgcHJvdGVjdGVkIHVwZGF0ZSgpIHtcbiAgICAgICAgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIudXBkYXRlKHRoaXMuZHVyYXRpb24pOyAvLyBuZWVkIHRvIGNhbGwgdGhpcyBpZiB0aGUgZHVyYXRpb24gY2hhbmdlZCBiZWNhdXNlIG9mIGJ1ZmZzIHRoYXQgY2hhbmdlIG92ZXIgdGltZSBsaWtlIGpvbSBnYWJiZXJcblxuICAgICAgICB0aGlzLmNob29zZUFjdGlvbih0aGlzLnBsYXllciwgdGhpcy5kdXJhdGlvbiwgdGhpcy5maWdodExlbmd0aCk7IC8vIGNob29zZSBhY3Rpb24gYmVmb3JlIGluIGNhc2Ugb2YgYWN0aW9uIGRlcGVuZGluZyBvbiB0aW1lIG9mZiB0aGUgZ2NkIGxpa2UgZWFydGhzdHJpa2UgXG5cbiAgICAgICAgdGhpcy5wbGF5ZXIudXBkYXRlQXR0YWNraW5nU3RhdGUodGhpcy5kdXJhdGlvbik7XG4gICAgICAgIC8vIGNob29zZSBhY3Rpb24gYWZ0ZXIgZXZlcnkgc3dpbmcgd2hpY2ggY291bGQgYmUgYSByYWdlIGdlbmVyYXRpbmcgZXZlbnQsIGJ1dCBUT0RPOiBuZWVkIHRvIGFjY291bnQgZm9yIGxhdGVuY3ksIHJlYWN0aW9uIHRpbWUgKGJ1dHRvbiBtYXNoaW5nKVxuICAgICAgICBjb25zdCB3YWl0aW5nRm9yVGltZSA9IHRoaXMuY2hvb3NlQWN0aW9uKHRoaXMucGxheWVyLCB0aGlzLmR1cmF0aW9uLCB0aGlzLmZpZ2h0TGVuZ3RoKTtcblxuICAgICAgICBsZXQgbmV4dFN3aW5nVGltZSA9IHRoaXMucGxheWVyLm1oIS5uZXh0U3dpbmdUaW1lO1xuXG4gICAgICAgIGlmICh0aGlzLnBsYXllci5vaCkge1xuICAgICAgICAgICAgbmV4dFN3aW5nVGltZSA9IE1hdGgubWluKG5leHRTd2luZ1RpbWUsIHRoaXMucGxheWVyLm9oLm5leHRTd2luZ1RpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IGhhY2tcbiAgICAgICAgaWYgKHRoaXMucGxheWVyLmV4dHJhQXR0YWNrQ291bnQpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IGluY3JlbWVudCBkdXJhdGlvbiAoVE9ETzogYnV0IEkgcmVhbGx5IHNob3VsZCBiZWNhdXNlIHRoZSBzZXJ2ZXIgZG9lc24ndCBsb29wIGluc3RhbnRseSlcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBsYXllci5uZXh0R0NEVGltZSA+IHRoaXMuZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBNYXRoLm1pbih0aGlzLnBsYXllci5uZXh0R0NEVGltZSwgbmV4dFN3aW5nVGltZSwgdGhpcy5wbGF5ZXIuYnVmZk1hbmFnZXIubmV4dE92ZXJUaW1lVXBkYXRlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZHVyYXRpb24gPSBNYXRoLm1pbihuZXh0U3dpbmdUaW1lLCB0aGlzLnBsYXllci5idWZmTWFuYWdlci5uZXh0T3ZlclRpbWVVcGRhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHdhaXRpbmdGb3JUaW1lICYmIHdhaXRpbmdGb3JUaW1lIDwgdGhpcy5kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IHdhaXRpbmdGb3JUaW1lO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBSZWFsdGltZUZpZ2h0IGV4dGVuZHMgRmlnaHQge1xuICAgIHByb3RlY3RlZCBwYXVzZWQgPSBmYWxzZTtcblxuICAgIHJ1bigpOiBQcm9taXNlPEZpZ2h0UmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgoZiwgcikgPT4ge1xuICAgICAgICAgICAgbGV0IG92ZXJyaWRlRHVyYXRpb24gPSAwO1xuXG4gICAgICAgICAgICBjb25zdCBsb29wID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmR1cmF0aW9uIDw9IHRoaXMuZmlnaHRMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhdXNlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJyaWRlRHVyYXRpb24gKz0gMTAwMCAvIDYwO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kdXJhdGlvbiA9IG92ZXJyaWRlRHVyYXRpb247XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGxvb3ApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGYoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZGFtYWdlRG9uZTogdGhpcy5wbGF5ZXIuZGFtYWdlRG9uZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiB0aGlzLmZpZ2h0TGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShsb29wKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIHRoaXMucGF1c2VkID0gIXRoaXMucGF1c2VkO1xuICAgIH1cbn1cblxuZXhwb3J0IHR5cGUgRmlnaHRSZXN1bHQgPSB7IGRhbWFnZURvbmU6IG51bWJlciwgZmlnaHRMZW5ndGg6IG51bWJlcn07XG5cbmV4cG9ydCBjbGFzcyBTaW11bGF0aW9uIHtcbiAgICByYWNlOiBSYWNlO1xuICAgIHN0YXRzOiBTdGF0VmFsdWVzO1xuICAgIGVxdWlwbWVudDogSXRlbVdpdGhTbG90W107XG4gICAgYnVmZnM6IEJ1ZmZbXTtcbiAgICBjaG9vc2VBY3Rpb246IENob29zZUFjdGlvbjtcbiAgICBwcm90ZWN0ZWQgZmlnaHRMZW5ndGg6IG51bWJlcjtcbiAgICBwcm90ZWN0ZWQgcmVhbHRpbWU6IGJvb2xlYW47XG4gICAgbG9nPzogTG9nRnVuY3Rpb25cblxuICAgIHByb3RlY3RlZCByZXF1ZXN0U3RvcCA9IGZhbHNlO1xuICAgIHByb3RlY3RlZCBwYXVzZWQgPSBmYWxzZTtcblxuICAgIGZpZ2h0UmVzdWx0czogRmlnaHRSZXN1bHRbXSA9IFtdO1xuXG4gICAgY3VycmVudEZpZ2h0PzogRmlnaHQ7XG5cbiAgICBjb25zdHJ1Y3RvcihyYWNlOiBSYWNlLCBzdGF0czogU3RhdFZhbHVlcywgZXF1aXBtZW50OiBJdGVtV2l0aFNsb3RbXSwgYnVmZnM6IEJ1ZmZbXSwgY2hvb3NlQWN0aW9uOiBDaG9vc2VBY3Rpb24sIGZpZ2h0TGVuZ3RoID0gNjAsIHJlYWx0aW1lID0gZmFsc2UsIGxvZz86IExvZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHRoaXMucmFjZSA9IHJhY2U7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBzdGF0cztcbiAgICAgICAgdGhpcy5lcXVpcG1lbnQgPSBlcXVpcG1lbnQ7XG4gICAgICAgIHRoaXMuYnVmZnMgPSBidWZmcztcbiAgICAgICAgdGhpcy5jaG9vc2VBY3Rpb24gPSBjaG9vc2VBY3Rpb247XG4gICAgICAgIHRoaXMuZmlnaHRMZW5ndGggPSBmaWdodExlbmd0aDtcbiAgICAgICAgdGhpcy5yZWFsdGltZSA9IHJlYWx0aW1lO1xuICAgICAgICB0aGlzLmxvZyA9IGxvZztcbiAgICB9XG5cbiAgICBnZXQgc3RhdHVzKCkge1xuICAgICAgICBjb25zdCBjb21iaW5lZEZpZ2h0UmVzdWx0cyA9IHRoaXMuZmlnaHRSZXN1bHRzLnJlZHVjZSgoYWNjLCBjdXJyZW50KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGRhbWFnZURvbmU6IGFjYy5kYW1hZ2VEb25lICsgY3VycmVudC5kYW1hZ2VEb25lLFxuICAgICAgICAgICAgICAgIGZpZ2h0TGVuZ3RoOiBhY2MuZmlnaHRMZW5ndGggKyBjdXJyZW50LmZpZ2h0TGVuZ3RoXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHtcbiAgICAgICAgICAgIGRhbWFnZURvbmU6IDAsXG4gICAgICAgICAgICBmaWdodExlbmd0aDogMFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAodGhpcy5yZWFsdGltZSAmJiB0aGlzLmN1cnJlbnRGaWdodCkge1xuICAgICAgICAgICAgY29tYmluZWRGaWdodFJlc3VsdHMuZGFtYWdlRG9uZSArPSB0aGlzLmN1cnJlbnRGaWdodC5wbGF5ZXIuZGFtYWdlRG9uZTtcbiAgICAgICAgICAgIGNvbWJpbmVkRmlnaHRSZXN1bHRzLmZpZ2h0TGVuZ3RoICs9IHRoaXMuY3VycmVudEZpZ2h0LmR1cmF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGRhbWFnZURvbmU6IGNvbWJpbmVkRmlnaHRSZXN1bHRzLmRhbWFnZURvbmUsXG4gICAgICAgICAgICBkdXJhdGlvbjogY29tYmluZWRGaWdodFJlc3VsdHMuZmlnaHRMZW5ndGgsXG4gICAgICAgICAgICBmaWdodHM6IHRoaXMuZmlnaHRSZXN1bHRzLmxlbmd0aFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhcnQoKSB7XG4gICAgICAgIGNvbnN0IGZpZ2h0Q2xhc3MgPSB0aGlzLnJlYWx0aW1lID8gUmVhbHRpbWVGaWdodCA6IEZpZ2h0O1xuXG4gICAgICAgIGNvbnN0IG91dGVybG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQob3V0ZXJsb29wLCAxMDAwKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICAgICAgICAgIGNvbnN0IGlubmVybG9vcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY291bnQgPiAxMDApIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChvdXRlcmxvb3AsIDApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQgPSBuZXcgZmlnaHRDbGFzcyh0aGlzLnJhY2UsIHRoaXMuc3RhdHMsIHRoaXMuZXF1aXBtZW50LCB0aGlzLmJ1ZmZzLCB0aGlzLmNob29zZUFjdGlvbiwgdGhpcy5maWdodExlbmd0aCwgdGhpcy5yZWFsdGltZSA/IHRoaXMubG9nIDogdW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRGaWdodC5ydW4oKS50aGVuKChyZXMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maWdodFJlc3VsdHMucHVzaChyZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICBpbm5lcmxvb3AoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoIXRoaXMucmVxdWVzdFN0b3ApIHtcbiAgICAgICAgICAgICAgICBpbm5lcmxvb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBvdXRlcmxvb3AoKTtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5wYXVzZWQgPSAhdGhpcy5wYXVzZWQ7XG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRGaWdodCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50RmlnaHQucGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMucmVxdWVzdFN0b3AgPSB0cnVlO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFdhcnJpb3IgfSBmcm9tIFwiLi93YXJyaW9yXCI7XG5pbXBvcnQgeyBJdGVtU2xvdCB9IGZyb20gXCIuL2l0ZW1cIjtcbmltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL3BsYXllclwiO1xuXG5leHBvcnQgZnVuY3Rpb24gY2hvb3NlQWN0aW9uIChwbGF5ZXI6IFBsYXllciwgdGltZTogbnVtYmVyLCBmaWdodExlbmd0aDogbnVtYmVyKTogbnVtYmVyfHVuZGVmaW5lZCB7XG4gICAgY29uc3Qgd2FycmlvciA9IDxXYXJyaW9yPnBsYXllcjtcblxuICAgIGNvbnN0IHRpbWVSZW1haW5pbmdTZWNvbmRzID0gKGZpZ2h0TGVuZ3RoIC0gdGltZSkgLyAxMDAwO1xuXG4gICAgY29uc3QgdXNlSXRlbUJ5TmFtZSA9IChzbG90OiBJdGVtU2xvdCwgbmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBwbGF5ZXIuaXRlbXMuZ2V0KHNsb3QpO1xuICAgICAgICBpZiAoaXRlbSAmJiBpdGVtLml0ZW0ubmFtZSA9PT0gbmFtZSAmJiBpdGVtLm9udXNlICYmIGl0ZW0ub251c2UuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuIGl0ZW0ub251c2UuY2FzdCh0aW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICh3YXJyaW9yLnJhZ2UgPCAzMCAmJiB3YXJyaW9yLmJsb29kUmFnZS5jYW5DYXN0KHRpbWUpKSB7XG4gICAgICAgIHdhcnJpb3IuYmxvb2RSYWdlLmNhc3QodGltZSk7XG4gICAgfVxuXG4gICAgbGV0IHdhaXRpbmdGb3JUaW1lOiBudW1iZXJ8dW5kZWZpbmVkO1xuXG4gICAgLy8gZ2NkIHNwZWxsc1xuICAgIGlmICh3YXJyaW9yLm5leHRHQ0RUaW1lIDw9IHRpbWUpIHtcbiAgICAgICAgaWYgKHRpbWVSZW1haW5pbmdTZWNvbmRzIDw9IDMwICYmIHdhcnJpb3IuZGVhdGhXaXNoLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHdhcnJpb3IuZGVhdGhXaXNoLmNhc3QodGltZSk7XG4gICAgICAgICAgICB1c2VJdGVtQnlOYW1lKEl0ZW1TbG90LlRSSU5LRVQxLCBcIkJhZGdlIG9mIHRoZSBTd2FybWd1YXJkXCIpO1xuICAgICAgICAgICAgdXNlSXRlbUJ5TmFtZShJdGVtU2xvdC5UUklOS0VUMiwgXCJCYWRnZSBvZiB0aGUgU3dhcm1ndWFyZFwiKTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHdhcnJpb3IuYmxvb2R0aGlyc3QuY2FzdCh0aW1lKTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLmJsb29kdGhpcnN0LnRpbWVSZW1haW5pbmcodGltZSkgPCAxLjUgKyAod2Fycmlvci5sYXRlbmN5IC8gMTAwMCkpIHtcbiAgICAgICAgICAgIC8vIG5vdCBvciBhbG1vc3Qgb2ZmIGNvb2xkb3duLCB3YWl0IGZvciByYWdlIG9yIGNvb2xkb3duXG4gICAgICAgICAgICBpZiAod2Fycmlvci5ibG9vZHRoaXJzdC5jb29sZG93biA+IHRpbWUpIHtcbiAgICAgICAgICAgICAgICB3YWl0aW5nRm9yVGltZSA9IHdhcnJpb3IuYmxvb2R0aGlyc3QuY29vbGRvd247XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci53aGlybHdpbmQuY2FuQ2FzdCh0aW1lKSkge1xuICAgICAgICAgICAgd2Fycmlvci53aGlybHdpbmQuY2FzdCh0aW1lKTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXJyaW9yLndoaXJsd2luZC50aW1lUmVtYWluaW5nKHRpbWUpIDwgMS41ICsgKHdhcnJpb3IubGF0ZW5jeSAvIDEwMDApKSB7XG4gICAgICAgICAgICAvLyBub3Qgb3IgYWxtb3N0IG9mZiBjb29sZG93biwgd2FpdCBmb3IgcmFnZSBvciBjb29sZG93blxuICAgICAgICAgICAgaWYgKHdhcnJpb3Iud2hpcmx3aW5kLmNvb2xkb3duID4gdGltZSkge1xuICAgICAgICAgICAgICAgIHdhaXRpbmdGb3JUaW1lID0gd2Fycmlvci53aGlybHdpbmQuY29vbGRvd247XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAod2Fycmlvci5yYWdlID49IDUwICYmIHdhcnJpb3IuaGFtc3RyaW5nLmNhbkNhc3QodGltZSkpIHtcbiAgICAgICAgICAgIHdhcnJpb3IuaGFtc3RyaW5nLmNhc3QodGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAod2Fycmlvci5yYWdlID49IDYwICYmICF3YXJyaW9yLnF1ZXVlZFNwZWxsKSB7XG4gICAgICAgIHdhcnJpb3IucXVldWVkU3BlbGwgPSB3YXJyaW9yLmhlcm9pY1N0cmlrZTtcbiAgICAgICAgaWYgKHdhcnJpb3IubG9nKSB3YXJyaW9yLmxvZyh0aW1lLCAncXVldWVpbmcgaGVyb2ljIHN0cmlrZScpO1xuICAgIH1cblxuICAgIHJldHVybiB3YWl0aW5nRm9yVGltZTtcbn1cbiIsImltcG9ydCB7ICBNYWluVGhyZWFkSW50ZXJmYWNlIH0gZnJvbSBcIi4vd29ya2VyX2V2ZW50X2ludGVyZmFjZS5qc1wiO1xuaW1wb3J0IHsgU2ltdWxhdGlvbiB9IGZyb20gXCIuL3NpbXVsYXRpb24uanNcIjtcbmltcG9ydCB7IFNpbXVsYXRpb25EZXNjcmlwdGlvbiwgYnVmZkluZGljZXNUb0J1ZmYsIGVxdWlwbWVudEluZGljZXNUb0l0ZW0gfSBmcm9tIFwiLi9zaW11bGF0aW9uX3V0aWxzLmpzXCI7XG5pbXBvcnQgeyBMb2dGdW5jdGlvbiB9IGZyb20gXCIuL3BsYXllci5qc1wiO1xuaW1wb3J0IHsgY2hvb3NlQWN0aW9uIH0gZnJvbSBcIi4vd2Fycmlvcl9haS5qc1wiO1xuXG5jb25zdCBtYWluVGhyZWFkSW50ZXJmYWNlID0gTWFpblRocmVhZEludGVyZmFjZS5pbnN0YW5jZTtcblxubGV0IGN1cnJlbnRTaW06IFNpbXVsYXRpb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5tYWluVGhyZWFkSW50ZXJmYWNlLmFkZEV2ZW50TGlzdGVuZXIoJ3NpbXVsYXRlJywgKGRhdGE6IGFueSkgPT4ge1xuICAgIGNvbnN0IHNpbWRlc2MgPSA8U2ltdWxhdGlvbkRlc2NyaXB0aW9uPmRhdGE7XG5cbiAgICBsZXQgbG9nRnVuY3Rpb246IExvZ0Z1bmN0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAgIGlmIChzaW1kZXNjLnJlYWx0aW1lKSB7XG4gICAgICAgIGxvZ0Z1bmN0aW9uID0gKHRpbWU6IG51bWJlciwgdGV4dDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBtYWluVGhyZWFkSW50ZXJmYWNlLnNlbmQoJ2xvZycsIHtcbiAgICAgICAgICAgICAgICB0aW1lOiB0aW1lLFxuICAgICAgICAgICAgICAgIHRleHQ6IHRleHRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGN1cnJlbnRTaW0gPSBuZXcgU2ltdWxhdGlvbihzaW1kZXNjLnJhY2UsIHNpbWRlc2Muc3RhdHMsXG4gICAgICAgIGVxdWlwbWVudEluZGljZXNUb0l0ZW0oc2ltZGVzYy5lcXVpcG1lbnQpLFxuICAgICAgICBidWZmSW5kaWNlc1RvQnVmZihzaW1kZXNjLmJ1ZmZzKSxcbiAgICAgICAgY2hvb3NlQWN0aW9uLCBzaW1kZXNjLmZpZ2h0TGVuZ3RoLCBzaW1kZXNjLnJlYWx0aW1lLCBsb2dGdW5jdGlvbik7XG5cbiAgICBjdXJyZW50U2ltLnN0YXJ0KCk7XG5cbiAgICBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIG1haW5UaHJlYWRJbnRlcmZhY2Uuc2VuZCgnc3RhdHVzJywgY3VycmVudFNpbSEuc3RhdHVzKTtcbiAgICB9LCAxMDAwKTtcbn0pO1xuXG5tYWluVGhyZWFkSW50ZXJmYWNlLmFkZEV2ZW50TGlzdGVuZXIoJ3BhdXNlJywgKCkgPT4ge1xuICAgIGlmIChjdXJyZW50U2ltKSB7XG4gICAgICAgIGN1cnJlbnRTaW0ucGF1c2UoKTtcbiAgICB9XG59KTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxNQUFNLG9CQUFvQjtJQUd0QixZQUFZLE1BQVc7UUFGdkIsbUJBQWMsR0FBdUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUczRCxNQUFNLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBTztZQUN2QixNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzVFLEtBQUssSUFBSSxRQUFRLElBQUksc0JBQXNCLEVBQUU7Z0JBQ3pDLFFBQVEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFCO1NBQ0osQ0FBQztLQUNMO0lBRUQsZ0JBQWdCLENBQUMsS0FBYSxFQUFFLFFBQTZCO1FBQ3pELElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDaEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ2xEO2FBQU07WUFDSCxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1NBQzlDO0tBQ0o7SUFFRCxJQUFJLENBQUMsS0FBYSxFQUFFLElBQVMsRUFBRSxTQUFjLElBQUk7UUFDN0MsTUFBTSxDQUFDLFdBQVcsQ0FBQztZQUNmLEtBQUssRUFBRSxLQUFLO1lBQ1osSUFBSSxFQUFFLElBQUk7U0FDYixDQUFDLENBQUM7S0FDTjtDQUNKO0FBRUQsTUFtQmEsbUJBQW9CLFNBQVEsb0JBQW9CO0lBR3pEO1FBQ0ksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ2Y7SUFFRCxXQUFXLFFBQVE7UUFDZixJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFO1lBQ2hDLG1CQUFtQixDQUFDLFNBQVMsR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7U0FDN0Q7UUFDRCxPQUFPLG1CQUFtQixDQUFDLFNBQVMsQ0FBQztLQUN4QztDQUNKOztNQzFEWSxLQUFLO0lBT2QsWUFBWSxJQUFZLEVBQUUsTUFBZSxFQUFFLElBQVksRUFBRSxRQUFnQixFQUFFLE1BQThDO1FBQ3JILElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0tBQ3hCO0lBRUQsSUFBSSxDQUFDLE1BQWMsRUFBRSxJQUFZO1FBQzdCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDcEM7Q0FDSjtBQUVELE1BQWEsWUFBWTtJQUtyQixZQUFZLEtBQVksRUFBRSxNQUFjO1FBSHhDLGFBQVEsR0FBRyxDQUFDLENBQUM7UUFJVCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztLQUN4QjtJQUVELFVBQVUsQ0FBQyxJQUFZO1FBQ25CLE9BQU8sSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7S0FDL0I7SUFFRCxhQUFhLENBQUMsSUFBWTtRQUN0QixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUM7S0FDckQ7SUFFRCxPQUFPLENBQUMsSUFBWTtRQUNoQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxHQUFHLElBQUksRUFBRTtZQUNyRCxPQUFPLEtBQUssQ0FBQztTQUNoQjtRQUVELElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDckMsT0FBTyxLQUFLLENBQUM7U0FDaEI7UUFFRCxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDdkIsT0FBTyxLQUFLLENBQUM7U0FDaEI7UUFFRCxPQUFPLElBQUksQ0FBQztLQUNmO0lBRUQsSUFBSSxDQUFDLElBQVk7UUFDYixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNyQixPQUFPLEtBQUssQ0FBQztTQUNoQjtRQUVELElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUU7WUFDbkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztTQUMvRDtRQUVELElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBRXJDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFbkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1FBRXhFLE9BQU8sSUFBSSxDQUFDO0tBQ2Y7Q0FDSjtBQUVELE1BQWEsVUFBVyxTQUFRLEtBQUs7SUFHakMsWUFBWSxJQUFZLEVBQUUsV0FBbUIsRUFBRSxJQUFZO1FBQ3ZELEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsU0FBUSxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7S0FDbEM7Q0FDSjtBQUVELE1BQWEsaUJBQWtCLFNBQVEsWUFBWTtJQUcvQyxZQUFZLEtBQWlCLEVBQUUsTUFBYztRQUN6QyxLQUFLLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0tBQ3RCO0NBQ0o7QUFFRCxBQUFBLElBQVksU0FHWDtBQUhELFdBQVksU0FBUztJQUNqQixpREFBUSxDQUFBO0lBQ1IsK0RBQWUsQ0FBQTtDQUNsQixFQUhXLFNBQVMsS0FBVCxTQUFTLFFBR3BCO0FBRUQsTUFBYSxXQUFZLFNBQVEsS0FBSztJQUNsQyxZQUFZLElBQVksRUFBRSxNQUEyQyxFQUFFLElBQWUsRUFBRSxNQUFlLEVBQUUsSUFBWSxFQUFFLFFBQWdCO1FBQ25JLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxNQUFjLEVBQUUsSUFBWTtZQUM3RCxNQUFNLEdBQUcsR0FBRyxDQUFDLE9BQU8sTUFBTSxLQUFLLFFBQVEsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRW5FLElBQUksSUFBSSxLQUFLLFNBQVMsQ0FBQyxRQUFRLElBQUksSUFBSSxLQUFLLFNBQVMsQ0FBQyxlQUFlLEVBQUU7Z0JBRW5FLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxLQUFLLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ3hELE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsTUFBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsbUJBQW1CLENBQUMsQ0FBQzthQUN0RjtTQUNKLENBQUMsQ0FBQztLQUNOO0NBQ0o7QUFFRCxNQUFhLFlBQWEsU0FBUSxXQUFXO0lBQ3pDLFlBQVksSUFBWSxFQUFFLE1BQWMsRUFBRSxJQUFlO1FBQ3JELEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQzFDO0NBQ0o7QUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLFlBQVksQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUU5RSxNQUFhLFdBQVksU0FBUSxLQUFLO0lBQ2xDLFlBQVksSUFBWSxFQUFFLEtBQWE7UUFDbkMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQWMsRUFBRSxJQUFZO1lBQ2xELElBQUksTUFBTSxDQUFDLGdCQUFnQixFQUFFO2dCQUN6QixPQUFPO2FBQ1Y7WUFDRCxNQUFNLENBQUMsZ0JBQWdCLElBQUksS0FBSyxDQUFDO1lBQ2pDLElBQUksTUFBTSxDQUFDLEdBQUc7Z0JBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxLQUFLLHVCQUF1QixJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQ2xGLENBQUMsQ0FBQztLQUNOO0NBQ0o7QUFFRCxNQUFhLFNBQVUsU0FBUSxLQUFLO0lBQ2hDLFlBQVksSUFBVSxFQUFFLE1BQWdCLEVBQUUsSUFBYSxFQUFFLFFBQWlCO1FBQ3RFLEtBQUssQ0FBQyxhQUFhLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLEVBQUUsUUFBUSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQWMsRUFBRSxJQUFZO1lBQzlGLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUN0QyxDQUFDLENBQUM7S0FDTjtDQUNKO0FBTUQsTUFBYSxJQUFJO0lBSWIsWUFBWSxLQUFzQixFQUFFLElBQVU7UUFDMUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0tBQ3BCO0lBRUQsR0FBRyxDQUFDLE1BQWMsRUFBRSxNQUF5QixFQUFFLElBQVk7UUFDdkQsTUFBTSxNQUFNLEdBQVksSUFBSSxDQUFDLElBQUssQ0FBQyxNQUFNLElBQVUsSUFBSSxDQUFDLElBQUssQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7UUFFdEYsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksTUFBTSxFQUFFO1lBQ3pCLEtBQUssSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtnQkFDM0IsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDNUI7U0FDSjtLQUNKO0NBQ0o7O0FDaEtELElBQVksUUFrQlg7QUFsQkQsV0FBWSxRQUFRO0lBQ2hCLCtDQUFpQixDQUFBO0lBQ2pCLDZDQUFnQixDQUFBO0lBQ2hCLCtDQUFpQixDQUFBO0lBQ2pCLCtDQUFpQixDQUFBO0lBQ2pCLHdDQUFhLENBQUE7SUFDYix3Q0FBYSxDQUFBO0lBQ2IsZ0RBQWlCLENBQUE7SUFDakIseUNBQWEsQ0FBQTtJQUNiLDJDQUFjLENBQUE7SUFDZCwyQ0FBYyxDQUFBO0lBQ2QsNENBQWUsQ0FBQTtJQUNmLDRDQUFlLENBQUE7SUFDZiwwQ0FBYyxDQUFBO0lBQ2QsMENBQWMsQ0FBQTtJQUNkLDZDQUFlLENBQUE7SUFDZiw2Q0FBZSxDQUFBO0lBQ2YsK0NBQWdCLENBQUE7Q0FDbkIsRUFsQlcsUUFBUSxLQUFSLFFBQVEsUUFrQm5CO0FBVUQsQUFBQSxJQUFZLFVBUVg7QUFSRCxXQUFZLFVBQVU7SUFDbEIsMkNBQUksQ0FBQTtJQUNKLDZDQUFLLENBQUE7SUFDTCx5Q0FBRyxDQUFBO0lBQ0gsK0NBQU0sQ0FBQTtJQUNOLCtDQUFNLENBQUE7SUFDTixpREFBTyxDQUFBO0lBQ1AsNkNBQUssQ0FBQTtDQUNSLEVBUlcsVUFBVSxLQUFWLFVBQVUsUUFRckI7QUFVRCxTQUFnQixRQUFRLENBQUMsSUFBcUI7SUFDMUMsT0FBTyxPQUFPLElBQUksSUFBSSxDQUFDO0NBQzFCO0FBRUQsU0FBZ0IsZUFBZSxDQUFDLElBQWlCO0lBQzdDLE9BQU8sUUFBUSxJQUFJLElBQUksQ0FBQztDQUMzQjtBQUVELE1BQWEsV0FBVztJQUlwQixZQUFZLElBQXFCLEVBQUUsTUFBYztRQUM3QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUVqQixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDWixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDckQ7UUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDZCxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUNoQztLQUNKO0lBRUQsR0FBRyxDQUFDLElBQVk7UUFDWixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDWixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN6QjtLQUNKO0NBQ0o7QUFFRCxNQUFhLHNCQUFzQjtJQUkvQixZQUFZLEtBQWtCLEVBQUUsSUFBVztRQUN2QyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztLQUNwQjtDQUNKO0FBRUQsTUFBYSxhQUFjLFNBQVEsV0FBVztJQU8xQyxZQUFZLElBQXVCLEVBQUUsTUFBYztRQUMvQyxLQUFLLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBTHhCLFVBQUssR0FBVyxFQUFFLENBQUM7UUFNZixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztRQUVuQixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDWixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQTtTQUMzQjtRQUVELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBRXJCLElBQUksQ0FBQyxhQUFhLEdBQUcsR0FBRyxDQUFDO0tBQzVCO0lBRUQsSUFBWSxVQUFVO1FBQ2xCLElBQUksSUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUU7WUFDaEcsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQTtTQUNoRDthQUFNO1lBQ0gsT0FBTyxDQUFDLENBQUM7U0FDWjtLQUNKO0lBRUQsSUFBSSxHQUFHO1FBQ0gsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0tBQzVDO0lBRUQsSUFBSSxHQUFHO1FBQ0gsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0tBQzVDO0lBRUQsT0FBTyxDQUFDLENBQU87UUFDWCxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN0QjtJQUVELElBQUksQ0FBQyxJQUFZO1FBQ2IsS0FBSyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ3pCLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzVDO1FBR0QsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRTtZQUNyRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDbEU7S0FDSjtDQUNKOztTQzdJZSxLQUFLLENBQUMsR0FBVyxFQUFFLEdBQVc7SUFDMUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7Q0FDeEQ7QUFFRCxTQUFnQixLQUFLLENBQUMsR0FBVyxFQUFFLEdBQVcsRUFBRSxHQUFXO0lBQ3ZELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUM1Qzs7TUNIWSxJQUFJO0lBSWIsWUFBWSxLQUFhLEVBQUUsS0FBYTtRQUNwQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztLQUN0QjtJQUVELElBQUksZ0JBQWdCO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7S0FDekI7SUFFRCxJQUFJLFlBQVk7UUFDWixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztLQUNoQztJQUVELElBQUksV0FBVztRQUNYLE9BQU8sQ0FBQyxDQUFDO0tBQ1o7SUFFRCwyQkFBMkIsQ0FBQyxNQUFjLEVBQUUsUUFBZ0I7UUFDeEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRXBGLElBQUksUUFBUSxHQUFHLEdBQUcsR0FBRyxLQUFLLElBQUssQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztRQUM1RCxRQUFRLEtBQUssQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO1FBRTNCLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRS9DLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxJQUFJLE1BQU0sR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDO0tBQ3pEO0NBQ0o7O01DYlksS0FBSztJQW9CZCxZQUFZLENBQWM7UUFDdEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNmO0lBRUQsR0FBRyxDQUFDLENBQWM7UUFDZCxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQztRQUNqQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsS0FBSyxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQztRQUUzQyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsS0FBSyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEtBQUssQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksS0FBSyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEtBQUssQ0FBQyxDQUFDO1FBRTdDLE9BQU8sSUFBSSxDQUFDO0tBQ2Y7SUFFRCxHQUFHLENBQUMsQ0FBYTtRQUNiLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN2QixJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDekIsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN6QixJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDM0IsSUFBSSxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLGdCQUFnQixLQUFLLENBQUMsQ0FBQyxnQkFBZ0IsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFdkMsSUFBSSxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLFdBQVcsS0FBSyxDQUFDLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxZQUFZLEtBQUssQ0FBQyxDQUFDLFlBQVksSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLFdBQVcsS0FBSyxDQUFDLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRXpDLE9BQU8sSUFBSSxDQUFDO0tBQ2Y7Q0FDSjs7TUN0RlksV0FBVztJQVNwQixZQUFZLE1BQWMsRUFBRSxTQUFxQjtRQU56QyxhQUFRLEdBQXNCLEVBQUUsQ0FBQztRQUNqQyxxQkFBZ0IsR0FBOEIsRUFBRSxDQUFDO1FBTXJELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDMUM7SUFFRCxJQUFJLGtCQUFrQjtRQUNsQixJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7UUFFbEMsS0FBSyxJQUFJLFNBQVMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7WUFDekMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUM3QztRQUVELE9BQU8sR0FBRyxDQUFDO0tBQ2Q7SUFFRCxNQUFNLENBQUMsSUFBWTtRQUVmLEtBQUssSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO1lBQ3pDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDMUI7UUFFRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFOUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRS9CLEtBQUssSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ3hDLE1BQU0sR0FBRyxJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDdEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDN0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUN2QztTQUNKO1FBRUQsS0FBSyxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUNoRCxNQUFNLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBQ3RDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQzdCLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDdkM7U0FDSjtLQUNKO0lBRUQsR0FBRyxDQUFDLElBQVUsRUFBRSxTQUFpQjtRQUM3QixLQUFLLElBQUksT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDL0IsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtnQkFDdkIsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO29CQUNiLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUVqRyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUU7d0JBQ3BCLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7cUJBQzlCO3lCQUFNO3dCQUNILE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztxQkFDcEI7b0JBRUQsSUFBSSxnQkFBZ0IsRUFBRTt3QkFDbEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksZUFBZSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztxQkFDN0U7aUJBQ0o7cUJBQU07b0JBQ0gsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUc7d0JBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksWUFBWSxDQUFDLENBQUM7b0JBQzFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7aUJBQzlCO2dCQUNELE9BQU87YUFDVjtTQUNKO1FBRUQsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUc7WUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU5SCxJQUFJLElBQUksWUFBWSxZQUFZLEVBQUU7WUFDOUIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLHVCQUF1QixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7U0FDekY7YUFBTTtZQUNILElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksZUFBZSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1NBQzVEO1FBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ3BDO0lBRUQsTUFBTSxDQUFDLElBQVUsRUFBRSxJQUFZLEVBQUUsSUFBSSxHQUFHLEtBQUs7UUFDekMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU87WUFDekMsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtnQkFDdkIsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO29CQUN0QixPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztvQkFDcEIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUc7d0JBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztvQkFDL0UsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTt3QkFDcEIsT0FBTyxJQUFJLENBQUM7cUJBQ2Y7aUJBQ0o7Z0JBRUQsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUc7b0JBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksT0FBTyxDQUFDLENBQUM7Z0JBQ2hFLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3ZDLE9BQU8sS0FBSyxDQUFDO2FBQ2hCO1lBQ0QsT0FBTyxJQUFJLENBQUM7U0FDZixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU87WUFDekQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLElBQUksRUFBRTtnQkFDdkIsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO29CQUNiLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO29CQUNwQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRzt3QkFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO29CQUMvRSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO3dCQUNwQixPQUFPLElBQUksQ0FBQztxQkFDZjtpQkFDSjtnQkFFRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRztvQkFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQztnQkFDaEUsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDdkMsT0FBTyxLQUFLLENBQUM7YUFDaEI7WUFDRCxPQUFPLElBQUksQ0FBQztTQUNmLENBQUMsQ0FBQztLQUNOO0lBRUQsa0JBQWtCLENBQUMsSUFBWTtRQUMzQixNQUFNLFlBQVksR0FBVyxFQUFFLENBQUM7UUFFaEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU87WUFDekMsSUFBSSxPQUFPLENBQUMsY0FBYyxJQUFJLElBQUksRUFBRTtnQkFDaEMsWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2hDLE9BQU8sS0FBSyxDQUFDO2FBQ2hCO1lBQ0QsT0FBTyxJQUFJLENBQUM7U0FDZixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU87WUFDekQsSUFBSSxPQUFPLENBQUMsY0FBYyxJQUFJLElBQUksRUFBRTtnQkFDaEMsWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2hDLE9BQU8sS0FBSyxDQUFDO2FBQ2hCO1lBQ0QsT0FBTyxJQUFJLENBQUM7U0FDZixDQUFDLENBQUM7UUFFSCxLQUFLLElBQUksSUFBSSxJQUFJLFlBQVksRUFBRTtZQUMzQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDL0IsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUc7Z0JBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLENBQUM7U0FDdEU7S0FDSjtDQUNKO0FBRUQsTUFBYSxJQUFJO0lBV2IsWUFBWSxJQUFZLEVBQUUsUUFBZ0IsRUFBRSxLQUFrQixFQUFFLE1BQWdCLEVBQUUsYUFBc0IsRUFBRSxTQUFrQixFQUFFLEtBQVksRUFBRSxVQUFVLEdBQUcsSUFBSTtRQUN6SixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDdkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7S0FDaEM7SUFFRCxLQUFLLENBQUMsS0FBWSxFQUFFLE1BQWM7UUFDOUIsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1osS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDekI7S0FDSjtJQUVELEdBQUcsQ0FBQyxJQUFZLEVBQUUsTUFBYyxLQUFJO0lBRXBDLE1BQU0sQ0FBQyxJQUFZLEVBQUUsTUFBYztRQUMvQixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDWixNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNyRDtLQUNKO0NBQ0o7QUFFRCxNQUFNLGVBQWU7SUFNakIsWUFBWSxJQUFVLEVBQUUsU0FBaUI7UUFDckMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUMzQjtJQUVELE9BQU8sQ0FBQyxJQUFZO1FBQ2hCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztRQUV2RCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsRUFBRTtZQUN6QixJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztTQUNqRDtLQUNKO0lBRUQsSUFBSSxNQUFNO1FBQ04sT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0tBQ3pCO0lBRUQsSUFBSSxNQUFNLENBQUMsTUFBYztRQUNyQixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDO0tBQ3pGO0NBQ0o7QUFFRCxNQUFhLFlBQWEsU0FBUSxJQUFJO0lBSWxDLFlBQVksSUFBWSxFQUFFLFFBQWdCLEVBQUUsS0FBMkIsRUFBRSxjQUFzQixFQUFFLE9BQStDO1FBQzVJLEtBQUssQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO0tBQ3hDO0NBQ0o7QUFFRCxNQUFNLHVCQUF3QixTQUFRLGVBQWU7SUFLakQsWUFBWSxNQUFjLEVBQUUsSUFBa0IsRUFBRSxTQUFpQjtRQUM3RCxLQUFLLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDM0I7SUFFRCxPQUFPLENBQUMsSUFBWTtRQUNoQixLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO0tBQ3JEO0lBRUQsTUFBTSxDQUFDLElBQVk7UUFDZixJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ3pCLElBQUksQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7WUFDNUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztTQUN4QztLQUNKO0NBQ0o7QUFFRCxNQUFhLFFBQVMsU0FBUSxJQUFJO0lBRzlCLFlBQVksSUFBWSxFQUFFLFFBQWdCLEVBQUUsSUFBVSxFQUFFLEtBQVk7UUFDaEUsS0FBSyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3pFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0tBQ3BCO0lBRUQsR0FBRyxDQUFDLElBQVksRUFBRSxNQUFjO1FBQzVCLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQzdCO0lBRUQsTUFBTSxDQUFDLElBQVksRUFBRSxNQUFjO1FBQy9CLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzNCLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ2hDO0NBQ0o7O0FDdFFELElBQVksSUFHWDtBQUhELFdBQVksSUFBSTtJQUNaLGlDQUFLLENBQUE7SUFDTCw2QkFBRyxDQUFBO0NBQ04sRUFIVyxJQUFJLEtBQUosSUFBSSxRQUdmO0FBRUQsQUFBQSxJQUFZLGVBV1g7QUFYRCxXQUFZLGVBQWU7SUFDdkIsMkVBQWUsQ0FBQTtJQUNmLHlFQUFjLENBQUE7SUFDZCwyRUFBZSxDQUFBO0lBQ2YsMkVBQWUsQ0FBQTtJQUNmLDJFQUFlLENBQUE7SUFDZixpRkFBa0IsQ0FBQTtJQUNsQix5RUFBYyxDQUFBO0lBQ2QsaUZBQWtCLENBQUE7SUFDbEIsNkVBQWdCLENBQUE7SUFDaEIscUZBQW9CLENBQUE7Q0FDdkIsRUFYVyxlQUFlLEtBQWYsZUFBZSxRQVcxQjtBQUlELEFBQU8sTUFBTSxnQkFBZ0IsR0FBd0I7SUFDakQsQ0FBQyxlQUFlLENBQUMsZUFBZSxHQUFHLE9BQU87SUFDMUMsQ0FBQyxlQUFlLENBQUMsY0FBYyxHQUFHLFFBQVE7SUFDMUMsQ0FBQyxlQUFlLENBQUMsZUFBZSxHQUFHLFdBQVc7SUFDOUMsQ0FBQyxlQUFlLENBQUMsZUFBZSxHQUFHLFlBQVk7SUFDL0MsQ0FBQyxlQUFlLENBQUMsZUFBZSxHQUFHLFlBQVk7SUFDL0MsQ0FBQyxlQUFlLENBQUMsa0JBQWtCLEdBQUcsU0FBUztJQUMvQyxDQUFDLGVBQWUsQ0FBQyxjQUFjLEdBQUcsT0FBTztJQUN6QyxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsR0FBRyxTQUFTO0lBQy9DLENBQUMsZUFBZSxDQUFDLGdCQUFnQixHQUFHLE1BQU07SUFDMUMsQ0FBQyxlQUFlLENBQUMsb0JBQW9CLEdBQUcsZUFBZTtDQUMxRCxDQUFDO0FBRUYsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFJakosTUFBYSxNQUFPLFNBQVEsSUFBSTtJQW9CNUIsWUFBWSxLQUFpQixFQUFFLEdBQWlCO1FBQzVDLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFwQmpCLFVBQUssR0FBK0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUM5QyxVQUFLLEdBQVcsRUFBRSxDQUFDO1FBSW5CLGdCQUFXLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLHFCQUFnQixHQUFHLENBQUMsQ0FBQztRQUNyQixzQkFBaUIsR0FBRyxLQUFLLENBQUM7UUFJMUIsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUVmLGdCQUFXLEdBQWdDLFNBQVMsQ0FBQztRQUlyRCxZQUFPLEdBQUcsRUFBRSxDQUFDO1FBS1QsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztLQUNsQjtJQUVELElBQUksRUFBRTtRQUNGLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVsRCxJQUFJLE9BQU8sSUFBSSxlQUFlLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDckMsT0FBTyxPQUFPLENBQUM7U0FDbEI7S0FDSjtJQUVELElBQUksRUFBRTtRQUNGLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVqRCxJQUFJLE9BQU8sSUFBSSxlQUFlLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDckMsT0FBTyxPQUFPLENBQUM7U0FDbEI7S0FDSjtJQUVELEtBQUssQ0FBQyxJQUFxQixFQUFFLElBQWM7UUFDdkMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUN0QixPQUFPLENBQUMsS0FBSyxDQUFDLDZCQUE2QixRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFBO1lBQzVELE9BQU87U0FDVjtRQUVELElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxFQUFFO1lBQ3JCLE9BQU8sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxJQUFJLFlBQVksUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQTtZQUNwRSxPQUFPO1NBQ1Y7UUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDWixJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQzlDO1FBR0QsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ3ZEO2FBQU07WUFDSCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxXQUFXLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDckQ7S0FDSjtJQUVELElBQUksS0FBSztRQUNMLE9BQU8sQ0FBQyxDQUFDO0tBQ1o7SUFFRCxJQUFJLEtBQUssQ0FBQyxLQUFhLEtBQUk7SUFFM0IsT0FBTyxDQUFDLENBQU87UUFDWCxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN0QjtJQUVELFVBQVUsQ0FBQyxDQUFPO1FBRWQsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQVU7WUFDdEMsT0FBTyxJQUFJLEtBQUssQ0FBQyxDQUFDO1NBQ3JCLENBQUMsQ0FBQztLQUNOO0lBRVMseUJBQXlCLENBQUMsS0FBYyxFQUFFLG1CQUFtQixHQUFHLEtBQUs7UUFDM0UsSUFBSSxtQkFBbUIsRUFBRTtZQUNyQixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztTQUNoQztRQUVELE1BQU0sTUFBTSxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsRUFBRyxHQUFHLElBQUksQ0FBQyxFQUFHLENBQUM7UUFDM0MsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFHdEMsUUFBUSxVQUFVO1lBQ2QsS0FBSyxVQUFVLENBQUMsSUFBSTtnQkFDcEI7b0JBQ0ksT0FBTyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO2lCQUNuRTtZQUNELEtBQUssVUFBVSxDQUFDLEtBQUs7Z0JBQ3JCO29CQUNJLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztpQkFDcEU7WUFDRCxLQUFLLFVBQVUsQ0FBQyxHQUFHO2dCQUNuQjtvQkFDSSxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUM7aUJBQ2xFO1lBQ0QsS0FBSyxVQUFVLENBQUMsTUFBTTtnQkFDdEI7b0JBQ0ksT0FBTyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDO2lCQUNyRTtZQUNELEtBQUssVUFBVSxDQUFDLE1BQU07Z0JBQ3RCO29CQUNJLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQztpQkFDckU7WUFDRCxLQUFLLFVBQVUsQ0FBQyxPQUFPO2dCQUN2QjtvQkFDSSxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUM7aUJBQ3RFO1lBQ0QsS0FBSyxVQUFVLENBQUMsS0FBSztnQkFDckI7b0JBQ0ksT0FBTyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDO2lCQUNwRTtZQUNEO2dCQUNBO29CQUNJLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDO2lCQUNoQztTQUNKO0tBQ0o7SUFFRCxtQkFBbUI7UUFDZixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDdkMsSUFBSSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO1FBRTFFLE9BQU8sSUFBSSxDQUFDO0tBQ2Y7SUFFUyxtQkFBbUIsQ0FBQyxNQUFZLEVBQUUsS0FBYyxFQUFFLFFBQWlCLEVBQUUsbUJBQW1CLEdBQUcsS0FBSztRQUN0RyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDWixHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO1FBRWxDLElBQUksSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUN0QixHQUFHLElBQUksRUFBRSxDQUFDO1NBQ2I7UUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxFQUFFLG1CQUFtQixDQUFDLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUVuRyxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUUsRUFBRTtZQUNqQixHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7U0FDckM7YUFBTTtZQUNILEdBQUcsSUFBSSxTQUFTLEdBQUcsR0FBRyxDQUFDO1NBQzFCO1FBRUQsT0FBTyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztLQUM1QjtJQUVTLDBCQUEwQixDQUFDLE1BQVksRUFBRSxLQUFjO1FBQzdELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxZQUFZLEdBQUksSUFBSSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRS9FLElBQUksU0FBUyxJQUFJLEVBQUUsRUFBRTtZQUNqQixPQUFPLElBQUksQ0FBQztTQUNmO2FBQU0sSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFO1lBQ3RCLE9BQU8sQ0FBQyxDQUFDO1NBQ1o7YUFBTTtZQUNILE9BQU8sb0JBQW9CLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDMUM7S0FDSjtJQUVELElBQUksRUFBRTtRQUNGLE9BQU8sQ0FBQyxDQUFDO0tBQ1o7SUFFUyxxQkFBcUIsQ0FBQyxLQUFjO1FBRTFDLE1BQU0sTUFBTSxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsRUFBRyxHQUFHLElBQUksQ0FBQyxFQUFHLENBQUM7UUFFM0MsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFFcEQsT0FBTztZQUNILElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxRQUFRLENBQUM7WUFDakMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLFFBQVEsQ0FBQztTQUNwQyxDQUFDO0tBQ0w7SUFFRCxrQkFBa0IsQ0FBQyxLQUFjO1FBQzdCLE9BQU8sS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDdEQ7SUFFRCxtQkFBbUIsQ0FBQyxNQUFZLEVBQUUsS0FBYyxFQUFFLFFBQWlCLEVBQUUsbUJBQW1CLEdBQUcsS0FBSztRQUM1RixNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzdCLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQztRQUNaLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQztRQUdaLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLG1CQUFtQixDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDN0csTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQzFELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFHakUsTUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxLQUFLLEVBQUUsbUJBQW1CLENBQUMsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUU5RyxHQUFHLEdBQUcsV0FBVyxDQUFDO1FBRWxCLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxFQUFFO1lBQ2hDLE9BQU8sZUFBZSxDQUFDLGNBQWMsQ0FBQztTQUN6QztRQUVELEdBQUcsR0FBRyxZQUFZLEdBQUcsVUFBVSxDQUFDO1FBRWhDLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxFQUFFO1lBQ2hDLE9BQU8sZUFBZSxDQUFDLGVBQWUsQ0FBQztTQUMxQztRQUVELElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDWCxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsWUFBWSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDO1lBQ25ELEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUUxQixJQUFJLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLEVBQUU7Z0JBQ3JCLE9BQU8sZUFBZSxDQUFDLGtCQUFrQixDQUFDO2FBQzdDO1NBQ0o7UUFFRCxHQUFHLEdBQUcsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUUvQixJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksSUFBSSxJQUFJLEdBQUcsSUFBSSxXQUFXLENBQUMsRUFBRTtZQUN4QyxPQUFPLGVBQWUsQ0FBQyxjQUFjLENBQUM7U0FDekM7UUFFRCxPQUFPLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQztLQUMzQztJQUVELG9CQUFvQixDQUFDLFNBQWlCLEVBQUUsTUFBWSxFQUFFLEtBQWMsRUFBRSxRQUFpQixFQUFFLG1CQUFtQixHQUFHLEtBQUs7UUFDaEgsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLDJCQUEyQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUV6RSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUUxRixJQUFJLE1BQU0sR0FBRyxZQUFZLENBQUM7UUFDMUIsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO1FBRXBCLFFBQVEsVUFBVTtZQUNkLEtBQUssZUFBZSxDQUFDLGNBQWM7Z0JBQ25DO29CQUNJLE1BQU0sR0FBRyxDQUFDLENBQUM7b0JBQ1gsTUFBTTtpQkFDVDtZQUNELEtBQUssZUFBZSxDQUFDLGVBQWU7Z0JBQ3BDO29CQUNJLE1BQU0sR0FBRyxDQUFDLENBQUM7b0JBQ1gsV0FBVyxHQUFHLFNBQVMsQ0FBQztvQkFDeEIsTUFBTTtpQkFDVDtZQUNELEtBQUssZUFBZSxDQUFDLGtCQUFrQjtnQkFDdkM7b0JBQ0ksTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztvQkFDckUsTUFBTSxHQUFHLGFBQWEsR0FBRyxNQUFNLENBQUM7b0JBQ2hDLE1BQU07aUJBQ1Q7WUFDRCxLQUFLLGVBQWUsQ0FBQyxnQkFBZ0I7Z0JBQ3JDO29CQUNJLE1BQU07aUJBQ1Q7WUFDRCxLQUFLLGVBQWUsQ0FBQyxjQUFjO2dCQUNuQztvQkFDSSxNQUFNLElBQUksQ0FBQyxDQUFDO29CQUNaLE1BQU07aUJBQ1Q7U0FDSjtRQUVELElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDUixNQUFNLElBQUksS0FBSyxDQUFDO1NBQ25CO1FBRUQsT0FBTyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUM7S0FDNUM7SUFFRCxXQUFXLENBQUMsSUFBWSxFQUFFLEtBQWMsRUFBRSxVQUEyQixFQUFFLFVBQWtCLEVBQUUsV0FBbUIsRUFBRSxLQUFhO1FBQ3pILElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxjQUFjLEVBQUUsZUFBZSxDQUFDLGVBQWUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUt6RixLQUFLLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7Z0JBQ3pCLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxFQUFHLEdBQUcsSUFBSSxDQUFDLEVBQUcsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDOUQ7WUFDRCxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsRUFBRyxHQUFHLElBQUksQ0FBQyxFQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBRTVDO0tBQ0o7SUFFRCxlQUFlLENBQUMsSUFBWSxFQUFFLFNBQWlCLEVBQUUsTUFBWSxFQUFFLEtBQWMsRUFBRSxLQUFhLEVBQUUsbUJBQW1CLEdBQUcsS0FBSztRQUNySCxJQUFJLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxLQUFLLFNBQVMsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQzFJLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN4RSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV0QyxJQUFJLENBQUMsVUFBVSxJQUFJLFVBQVUsQ0FBQztRQUU5QixJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDVixJQUFJLE1BQU0sR0FBRyxRQUFRLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxJQUFJLEtBQUssR0FBRyxXQUFXLEdBQUcsVUFBVSxDQUFDLElBQUksZ0JBQWdCLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUMvRyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsY0FBYyxFQUFFLGVBQWUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQ3pGLE1BQU0sSUFBSSxRQUFRLFVBQVUsRUFBRSxDQUFDO2FBQ2xDO1lBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDMUI7UUFFRCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDakM7SUFFUyxXQUFXLENBQUMsSUFBWSxFQUFFLE1BQVksRUFBRSxLQUFjO1FBQzVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVqRCxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3hGLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzVCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDO1lBQzFDLElBQUksQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO1lBQzdCLE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDM0MsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsU0FBUyxHQUFHLFdBQVcsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQ2xGO2FBQU07WUFDSCxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3hEO1FBRUQsTUFBTSxDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRWxGLFVBQVcsQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLFVBQVcsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7UUFFbEcsSUFBSSxXQUFXLElBQUksV0FBVyxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsR0FBRyxFQUFFO1lBRXZELFdBQVcsQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLEdBQUcsQ0FBQztTQUMxQztLQUNKO0lBRUQsb0JBQW9CLENBQUMsSUFBWTtRQUM3QixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDYixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLEVBQUU7Z0JBQzNCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7Z0JBQzlCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsRUFBRTtvQkFDOUIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDMUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7aUJBQzNCO2dCQUNELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLLENBQUM7YUFDbEM7WUFFRCxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsRUFBRyxDQUFDLGFBQWEsRUFBRTtnQkFDaEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQzthQUM3QztpQkFBTSxJQUFJLElBQUksQ0FBQyxFQUFFLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsYUFBYSxFQUFFO2dCQUNqRCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQzlDO1NBQ0o7S0FDSjtDQUNKOztBQ2hZRCxNQUFNLE1BQU0sR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLEVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUUxRixBQUFPLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxFQUFvQixDQUFDO0FBQ3ZELFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFLFlBQVksRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNqSCxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUU3RSxNQUFhLE9BQVEsU0FBUSxNQUFNO0lBWS9CLFlBQVksSUFBVSxFQUFFLEtBQWlCLEVBQUUsV0FBa0Q7UUFDekYsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFacEUsZ0JBQVcsR0FBRyxDQUFDLENBQUM7UUFDaEIsU0FBSSxHQUFHLEVBQUUsQ0FBQztRQUVWLFlBQU8sR0FBRyxJQUFJLFlBQVksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDL0MsZ0JBQVcsR0FBRyxJQUFJLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN2RCxjQUFTLEdBQUcsSUFBSSxZQUFZLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ25ELGNBQVMsR0FBRyxJQUFJLFlBQVksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbkQsaUJBQVksR0FBRyxJQUFJLGlCQUFpQixDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlELGNBQVMsR0FBRyxJQUFJLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUMsY0FBUyxHQUFHLElBQUksWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUsxQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNsRTtJQUVELElBQUksS0FBSztRQUNMLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztLQUNwQjtJQUVELElBQUksS0FBSyxDQUFDLEtBQWE7UUFDbkIsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztLQUNwQztJQUVELElBQUksRUFBRTtRQUNGLE9BQU8sSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztLQUM3SDtJQUVELG1CQUFtQjtRQUVmLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztLQUM5QztJQUVELG9CQUFvQixDQUFDLFNBQWlCLEVBQUUsTUFBWSxFQUFFLEtBQWMsRUFBRSxRQUFpQixFQUFFLG1CQUFtQixHQUFHLEtBQUs7UUFDaEgsSUFBSSxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBRWhJLElBQUksVUFBVSxLQUFLLGVBQWUsQ0FBQyxjQUFjLElBQUksUUFBUSxFQUFFO1lBQzNELFVBQVUsSUFBSSxHQUFHLENBQUM7U0FDckI7UUFFRCxPQUFPLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztLQUNoRDtJQUVTLFVBQVUsQ0FBQyxNQUFjLEVBQUUsV0FBb0IsRUFBRSxJQUFZO1FBVW5FLE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDO1FBQ2pDLElBQUksT0FBTyxHQUFHLE1BQU0sR0FBRyxrQkFBa0IsQ0FBQztRQUUxQyxJQUFJLFdBQVcsRUFBRTtZQUNiLE9BQU8sSUFBSSxHQUFHLENBQUM7U0FDbEI7YUFBTTtZQUVILE9BQU8sSUFBSSxHQUFHLENBQUM7U0FDbEI7UUFFRCxJQUFJLElBQUksQ0FBQyxHQUFHO1lBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTNILElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDO0tBQ3pCO0lBRUQsV0FBVyxDQUFDLElBQVksRUFBRSxLQUFjLEVBQUUsVUFBMkIsRUFBRSxVQUFrQixFQUFFLFdBQW1CLEVBQUUsS0FBYTtRQUN6SCxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFM0UsSUFBSSxDQUFDLGVBQWUsQ0FBQyxlQUFlLEVBQUUsZUFBZSxDQUFDLGVBQWUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN6RixJQUFJLEtBQUssRUFBRTtnQkFHUCxJQUFJLEtBQUssS0FBSyxjQUFjLEVBQUU7b0JBQzFCLElBQUksQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7aUJBQ2xDO2FBQ0o7aUJBQU07Z0JBQ0gsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLEdBQUcsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQzthQUNuRDtTQUNKO2FBQU0sSUFBSSxVQUFVLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDN0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzNDO1FBSUQsSUFDSSxDQUFDLElBQUksQ0FBQyxpQkFBaUI7ZUFDcEIsRUFBRSxLQUFLLElBQUksS0FBSyxLQUFLLGlCQUFpQixDQUFDO2VBQ3ZDLENBQUMsQ0FBQyxlQUFlLENBQUMsY0FBYyxFQUFFLGVBQWUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO2VBQ3ZGLFVBQVUsS0FBSyxlQUFlLENBQUMsY0FBYyxFQUNsRDtZQUNFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsQ0FBQztTQUV4RDtRQUVELElBQUksVUFBVSxLQUFLLGVBQWUsQ0FBQyxjQUFjLEVBQUU7WUFFL0MsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3RDO0tBQ0o7Q0FDSjtBQUVELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxVQUFVLENBQUMsZUFBZSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUduRSxNQUFNLFlBQVksR0FBRyxJQUFJLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFjO0lBQzNELE9BQU8sR0FBRyxJQUFjLE1BQU8sQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7Q0FDOUMsRUFBRSxTQUFTLENBQUMsZUFBZSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFFM0MsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLFdBQVcsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxNQUFjO0lBQ25FLE9BQWlCLE1BQU8sQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDO0NBQ3RDLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBRXBDLE1BQU0sY0FBYyxHQUFHLElBQUksV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDLE1BQWM7SUFDL0QsT0FBTyxNQUFNLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDMUMsRUFBRSxTQUFTLENBQUMsZUFBZSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFNUMsTUFBTSxjQUFjLEdBQUcsSUFBSSxXQUFXLENBQUMsV0FBVyxFQUFFLEVBQUUsRUFBRSxTQUFTLENBQUMsZUFBZSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFFaEcsQUFBTyxNQUFNLGlCQUFpQixHQUFHLElBQUksWUFBWSxDQUFDLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsTUFBYyxFQUFFLElBQVk7SUFDekksTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7SUFDbEIsSUFBSSxNQUFNLENBQUMsR0FBRztRQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLHlDQUF5QyxDQUFDLENBQUM7Q0FDL0UsQ0FBQyxDQUFDO0FBRUgsTUFBTSxXQUFXLEdBQUcsSUFBSSxZQUFZLENBQUMsV0FBVyxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsTUFBYyxFQUFFLElBQVk7SUFDaEcsTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7SUFDbEIsSUFBSSxNQUFNLENBQUMsR0FBRztRQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGtDQUFrQyxDQUFDLENBQUM7Q0FDeEUsQ0FBQyxDQUFDO0FBRUgsTUFBTSxTQUFTLEdBQUcsSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsTUFBYyxFQUFFLElBQVk7SUFDaEYsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7SUFDbkIsSUFBSSxNQUFNLENBQUMsR0FBRztRQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGlDQUFpQyxDQUFDLENBQUM7SUFDcEUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO0NBQzdDLENBQUMsQ0FBQztBQUVILE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFLEVBQUUsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQzs7QUM1STVGLE1BQU0sS0FBSyxHQUFXO0lBQ3pCO1FBQ0ksSUFBSSxFQUFFLGNBQWM7UUFDcEIsUUFBUSxFQUFFLENBQUMsR0FBRyxFQUFFO1FBQ2hCLEtBQUssRUFBRTtZQUNILEVBQUUsRUFBRSxHQUFHO1NBQ1Y7S0FDSjtJQUNEO1FBQ0ksSUFBSSxFQUFFLG1CQUFtQjtRQUN6QixRQUFRLEVBQUUsRUFBRSxHQUFHLEVBQUU7UUFDakIsS0FBSyxFQUFFO1lBQ0gsUUFBUSxFQUFFLEdBQUc7U0FDaEI7S0FDSjtJQUNEO1FBQ0ksSUFBSSxFQUFFLG1CQUFtQjtRQUN6QixRQUFRLEVBQUUsRUFBRSxHQUFHLEVBQUU7UUFDakIsS0FBSyxFQUFFO1lBQ0gsRUFBRSxFQUFFLEdBQUc7U0FDVjtLQUNKO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsa0NBQWtDO1FBQ3hDLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7UUFDckIsS0FBSyxFQUFFO1lBQ0gsRUFBRSxFQUFFLEdBQUc7WUFDUCxJQUFJLEVBQUUsQ0FBQztTQUNWO0tBQ0o7SUFDRDtRQUNJLElBQUksRUFBRSxxQkFBcUI7UUFDM0IsUUFBUSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTtRQUNyQixLQUFLLEVBQUU7WUFDSCxJQUFJLEVBQUUsQ0FBQztZQUNQLEdBQUcsRUFBRSxFQUFFO1lBQ1AsR0FBRyxFQUFFLEVBQUU7U0FDVjtLQUNKO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsb0JBQW9CO1FBQzFCLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7UUFDckIsS0FBSyxFQUFFO1lBQ0gsUUFBUSxFQUFFLElBQUk7U0FDakI7S0FDSjtJQUNEO1FBQ0ksSUFBSSxFQUFFLHFCQUFxQjtRQUMzQixRQUFRLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFO1FBQ3JCLEtBQUssRUFBRTtZQUNILEtBQUssRUFBRSxJQUFJO1NBQ2Q7S0FDSjtJQUNEO1FBQ0ksSUFBSSxFQUFFLHlCQUF5QjtRQUMvQixRQUFRLEVBQUUsRUFBRSxHQUFHLEVBQUU7UUFDakIsS0FBSyxFQUFFO1lBQ0gsR0FBRyxFQUFFLEVBQUU7U0FDVjtLQUNKO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsWUFBWTtRQUNsQixRQUFRLEVBQUUsRUFBRSxHQUFHLEVBQUU7UUFDakIsS0FBSyxFQUFFO1lBQ0gsR0FBRyxFQUFFLEVBQUU7U0FDVjtLQUNKO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsWUFBWTtRQUNsQixRQUFRLEVBQUUsRUFBRSxHQUFHLEVBQUU7UUFDakIsS0FBSyxFQUFFO1lBQ0gsRUFBRSxFQUFFLEVBQUU7U0FDVDtLQUNKO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsd0JBQXdCO1FBQzlCLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7UUFDckIsS0FBSyxFQUFFO1lBQ0gsR0FBRyxFQUFFLEVBQUU7WUFDUCxJQUFJLEVBQUUsQ0FBQztTQUNWO0tBQ0o7SUFDRDtRQUNJLElBQUksRUFBRSxZQUFZO1FBQ2xCLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7UUFDckIsS0FBSyxFQUFFO1lBQ0gsR0FBRyxFQUFFLEVBQUU7U0FDVjtLQUNKO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7UUFDckIsS0FBSyxFQUFFO1lBQ0gsRUFBRSxFQUFFLEdBQUc7U0FDVjtLQUNKO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7UUFDckIsS0FBSyxFQUFFO1lBQ0gsR0FBRyxFQUFFLEVBQUU7WUFDUCxHQUFHLEVBQUUsRUFBRTtTQUNWO0tBQ0o7SUFDRDtRQUNJLElBQUksRUFBRSxlQUFlO1FBQ3JCLFFBQVEsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7UUFDckIsS0FBSyxFQUFFO1lBQ0gsRUFBRSxFQUFFLEdBQUc7U0FDVjtLQUNKO0NBQ0osQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFtQixLQUFLLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUl6RSxBQUFPLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUUsRUFBRSxJQUFJLEtBQUssQ0FBQyxFQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQ3hILEFBQU8sTUFBTSxrQkFBa0IsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRSxFQUFFLElBQUksS0FBSyxDQUFDLEVBQUMsR0FBRyxFQUFFLEdBQUcsRUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUMsR0FBRyxFQUFFLENBQUMsRUFBQyxDQUFDLENBQUM7QUFFeEgsQUFBTyxNQUFNLGdCQUFnQixHQUFHLElBQUksc0JBQXNCLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUU5RSxBQUFPLE1BQU0sZUFBZSxHQUFHLElBQUksc0JBQXNCLENBQUMsU0FBUyxFQUFFLElBQUksSUFBSSxDQUFDO0lBQzFFLElBQUksV0FBVyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztJQUNwQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztDQUM5RCxFQUFFLEVBQUMsTUFBTSxFQUFFLEdBQUcsRUFBQyxDQUFDLENBQUMsQ0FBQzs7QUNqSVosTUFBTSxLQUFLLEdBQTBDO0lBQ3hEO1FBQ0ksSUFBSSxFQUFFLFNBQVM7UUFDZixJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVE7UUFDdkIsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJO1FBQ3JCLEdBQUcsRUFBRSxFQUFFO1FBQ1AsR0FBRyxFQUFFLEdBQUc7UUFDUixLQUFLLEVBQUUsR0FBRztRQUNWLEtBQUssRUFBRSxJQUFJLElBQUksQ0FBQyxJQUFJLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUMsRUFBQyxHQUFHLEVBQUUsQ0FBQyxFQUFDLENBQUM7S0FDMUQ7SUFDRDtRQUNJLElBQUksRUFBRSxxQkFBcUI7UUFDM0IsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJO1FBQ3JCLElBQUksRUFBRSxRQUFRLENBQUMsUUFBUTtRQUN2QixHQUFHLEVBQUUsRUFBRTtRQUNQLEdBQUcsRUFBRSxHQUFHO1FBQ1IsS0FBSyxFQUFFLEdBQUc7UUFDVixLQUFLLEVBQUUsSUFBSSxJQUFJLENBQUMsSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUMsNkJBQTZCLEVBQUUsRUFBRSxFQUFFLEVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUMsQ0FBQztLQUNyRztJQUNEO1FBQ0ksSUFBSSxFQUFFLHFCQUFxQjtRQUMzQixJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUk7UUFDckIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEdBQUMsUUFBUSxDQUFDLE9BQU87UUFDeEMsR0FBRyxFQUFFLEVBQUU7UUFDUCxHQUFHLEVBQUUsR0FBRztRQUNSLEtBQUssRUFBRSxHQUFHO1FBQ1YsS0FBSyxFQUFFLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0tBQ2xDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsbUJBQW1CO1FBQ3pCLElBQUksRUFBRSxVQUFVLENBQUMsT0FBTztRQUN4QixJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVE7UUFDdkIsR0FBRyxFQUFFLEdBQUc7UUFDUixHQUFHLEVBQUUsR0FBRztRQUNSLEtBQUssRUFBRSxHQUFHO1FBQ1YsS0FBSyxFQUFFLElBQUksSUFBSSxDQUFDLElBQUksU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUUsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUMsR0FBRyxFQUFFLENBQUMsRUFBQyxDQUFDO0tBQ25GO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsaUJBQWlCO1FBQ3ZCLElBQUksRUFBRSxRQUFRLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxRQUFRO1FBQzNDLEtBQUssRUFBRSxFQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUM7UUFDZixPQUFPLEVBQUUsSUFBSSxJQUFJLENBQUMsSUFBSSxXQUFXLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBQyxNQUFNLEVBQUUsQ0FBQyxHQUFDLEdBQUcsRUFBQyxDQUFDO0tBQzVFO0lBQ0Q7UUFDSSxJQUFJLEVBQUUscUJBQXFCO1FBQzNCLElBQUksRUFBRSxRQUFRLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxRQUFRO1FBQzNDLEtBQUssRUFBRSxFQUFDLElBQUksRUFBRSxDQUFDLEVBQUM7S0FDbkI7SUFDRDtRQUNJLElBQUksRUFBRSxxQkFBcUI7UUFDM0IsSUFBSSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLFFBQVE7UUFDM0MsS0FBSyxFQUFFLEVBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQzFCO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsZ0JBQWdCO1FBQ3RCLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSTtRQUNuQixLQUFLLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBQztLQUNwQztJQUNEO1FBQ0ksSUFBSSxFQUFFLGVBQWU7UUFDckIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJO1FBQ25CLEtBQUssRUFBRSxFQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztLQUMzQjtJQUNEO1FBQ0ksSUFBSSxFQUFFLHNCQUFzQjtRQUM1QixJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7UUFDbkIsS0FBSyxFQUFFLEVBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7S0FDcEM7SUFDRDtRQUNJLElBQUksRUFBRSx1QkFBdUI7UUFDN0IsSUFBSSxFQUFFLFFBQVEsQ0FBQyxRQUFRO1FBQ3ZCLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQ3BDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUseUJBQXlCO1FBQy9CLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSTtRQUNuQixLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUM7S0FDNUI7SUFDRDtRQUNJLElBQUksRUFBRSx5QkFBeUI7UUFDL0IsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLO1FBQ3BCLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQ3BDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsMEJBQTBCO1FBQ2hDLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSztRQUNwQixLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUM7S0FDNUI7SUFDRDtRQUNJLElBQUksRUFBRSwwQkFBMEI7UUFDaEMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLO1FBQ3BCLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQ3BDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsb0JBQW9CO1FBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSztRQUNwQixLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUM7S0FDM0I7SUFDRDtRQUNJLElBQUksRUFBRSwyQkFBMkI7UUFDakMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLO1FBQ3BCLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQ3BDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUseUJBQXlCO1FBQy9CLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSztRQUNwQixLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRTtLQUN4RDtJQUNEO1FBQ0ksSUFBSSxFQUFFLGtCQUFrQjtRQUN4QixJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUs7UUFDcEIsS0FBSyxFQUFFLEVBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUM7S0FDcEM7SUFDRDtRQUNJLElBQUksRUFBRSxrQkFBa0I7UUFDeEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJO1FBQ25CLEtBQUssRUFBRSxFQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDO0tBQ3BDO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsMEJBQTBCO1FBQ2hDLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSTtRQUNuQixLQUFLLEVBQUUsRUFBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztLQUNwQztJQUNEO1FBQ0ksSUFBSSxFQUFFLGlCQUFpQjtRQUN2QixJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7UUFDbkIsS0FBSyxFQUFFLEVBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUM7S0FDcEM7SUFDRDtRQUNJLElBQUksRUFBRSxnQkFBZ0I7UUFDdEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxNQUFNO1FBQ3JCLEtBQUssRUFBRSxFQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztLQUMxQjtJQUNEO1FBQ0ksSUFBSSxFQUFFLGtCQUFrQjtRQUN4QixJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssR0FBQyxRQUFRLENBQUMsS0FBSztRQUNuQyxLQUFLLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBQztLQUNuQztJQUNEO1FBQ0ksSUFBSSxFQUFFLG1CQUFtQjtRQUN6QixJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssR0FBQyxRQUFRLENBQUMsS0FBSztRQUNuQyxLQUFLLEVBQUUsRUFBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztLQUNuQztJQUNEO1FBQ0ksSUFBSSxFQUFFLDhCQUE4QjtRQUNwQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEtBQUs7UUFDdEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEdBQUMsUUFBUSxDQUFDLE9BQU87UUFDeEMsR0FBRyxFQUFFLEdBQUc7UUFDUixHQUFHLEVBQUUsR0FBRztRQUNSLEtBQUssRUFBRSxHQUFHO1FBQ1YsS0FBSyxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0tBQzlCO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsMkNBQTJDO1FBQ2pELElBQUksRUFBRSxVQUFVLENBQUMsS0FBSztRQUN0QixJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsR0FBQyxRQUFRLENBQUMsT0FBTztRQUN4QyxHQUFHLEVBQUUsRUFBRTtRQUNQLEdBQUcsRUFBRSxHQUFHO1FBQ1IsS0FBSyxFQUFFLEdBQUc7UUFDVixLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFO0tBQzNCO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsZUFBZTtRQUNyQixJQUFJLEVBQUUsVUFBVSxDQUFDLEtBQUs7UUFDdEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEdBQUMsUUFBUSxDQUFDLE9BQU87UUFDeEMsR0FBRyxFQUFFLEdBQUc7UUFDUixHQUFHLEVBQUUsR0FBRztRQUNSLEtBQUssRUFBRSxHQUFHO1FBQ1YsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0tBQzdCO0lBQ0Q7UUFDSSxJQUFJLEVBQUUsZ0JBQWdCO1FBQ3RCLElBQUksRUFBRSxVQUFVLENBQUMsS0FBSztRQUN0QixJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsR0FBQyxRQUFRLENBQUMsT0FBTztRQUN4QyxHQUFHLEVBQUUsRUFBRTtRQUNQLEdBQUcsRUFBRSxHQUFHO1FBQ1IsS0FBSyxFQUFFLEdBQUc7UUFDVixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7S0FDN0I7SUFDRDtRQUNJLElBQUksRUFBRSxTQUFTO1FBQ2YsSUFBSSxFQUFFLFVBQVUsQ0FBQyxHQUFHO1FBQ3BCLElBQUksRUFBRSxRQUFRLENBQUMsUUFBUSxHQUFDLFFBQVEsQ0FBQyxPQUFPO1FBQ3hDLEdBQUcsRUFBRSxHQUFHO1FBQ1IsR0FBRyxFQUFFLEdBQUc7UUFDUixLQUFLLEVBQUUsR0FBRztRQUNWLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtLQUM3QjtJQUNEO1FBQ0ksSUFBSSxFQUFFLHlCQUF5QjtRQUMvQixJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsUUFBUTtRQUMzQyxLQUFLLEVBQUUsQ0FBQztZQUNKLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxJQUFJLENBQUMsdUJBQXVCLEVBQUUsRUFBRSxFQUFFLEVBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN0RyxNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FDM0IsSUFBSSxRQUFRLENBQUMseUJBQXlCLEVBQUUsRUFBRSxFQUN0QyxJQUFJLElBQUksQ0FBQyxJQUFJLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUMsR0FBRyxFQUFFLEVBQUUsRUFBQyxDQUFDLEVBQ3RELGtCQUFrQixDQUFDLEVBQ3ZCLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBRXRCLE9BQU8sU0FBUyxDQUFDO1NBQ3BCLEdBQUc7S0FDUDtDQUNKLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDUixPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUN2QyxDQUFDLENBQUM7O1NDL0xhLFdBQVcsQ0FBQyxJQUFVLEVBQUUsS0FBaUIsRUFBRSxTQUF5QixFQUFFLEtBQWEsRUFBRSxHQUFpQjtJQUNsSCxNQUFNLE1BQU0sR0FBRyxJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBRTdDLEtBQUssSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxTQUFTLEVBQUU7UUFDaEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDNUI7SUFFRCxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtRQUNwQixNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDbkM7SUFFRCxNQUFNLENBQUMsRUFBRyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3ZDLE1BQU0sQ0FBQyxFQUFHLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLEdBQUcsZUFBZSxHQUFHLGdCQUFnQixDQUFDO0lBRXJGLElBQUksTUFBTSxDQUFDLEVBQUUsRUFBRTtRQUNYLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDdEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQztLQUNqRDtJQUVELE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLEdBQUcsSUFBSSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDekQsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7SUFFckIsT0FBTyxNQUFNLENBQUM7Q0FDakI7QUFFRCxTQUFnQixzQkFBc0IsQ0FBQyxTQUErQjtJQUNsRSxNQUFNLEdBQUcsR0FBbUIsRUFBRSxDQUFDO0lBRS9CLEtBQUssSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSSxTQUFTLEVBQUU7UUFDL0IsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDWixHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDaEM7YUFBTTtZQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDdEM7S0FDSjtJQUVELE9BQU8sR0FBRyxDQUFDO0NBQ2Q7QUFFRCxTQUFnQixpQkFBaUIsQ0FBQyxXQUFxQjtJQUNuRCxNQUFNLEdBQUcsR0FBVyxFQUFFLENBQUM7SUFFdkIsS0FBSyxJQUFJLEdBQUcsSUFBSSxXQUFXLEVBQUU7UUFDekIsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDWixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ3hCO2FBQU07WUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQ3RDO0tBQ0o7SUFFRCxPQUFPLEdBQUcsQ0FBQztDQUNkOztBQzFERCxNQUFNLEtBQUs7SUFNUCxZQUFZLElBQVUsRUFBRSxLQUFpQixFQUFFLFNBQXlCLEVBQUUsS0FBYSxFQUFFLFlBQTBCLEVBQUUsV0FBVyxHQUFHLEVBQUUsRUFBRSxHQUFpQjtRQUZwSixhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBR1QsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzlELElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDO0tBQ25FO0lBRUQsR0FBRztRQUNDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNwQixPQUFPLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDdEMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQ2pCO1lBRUQsQ0FBQyxDQUFDO2dCQUNFLFVBQVUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVU7Z0JBQ2xDLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVzthQUNoQyxDQUFDLENBQUM7U0FDTixDQUFDLENBQUM7S0FDTjtJQUVELEtBQUssTUFBSztJQUVWLE1BQU0sTUFBSztJQUVELE1BQU07UUFDWixJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTlDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUVoRSxJQUFJLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVoRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFdkYsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFHLENBQUMsYUFBYSxDQUFDO1FBRWxELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUU7WUFDaEIsYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1NBQ3pFO1FBR0QsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBRWpDO2FBQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2hELElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsQ0FBQztTQUNoSDthQUFNO1lBQ0gsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1NBQ3ZGO1FBRUQsSUFBSSxjQUFjLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDbEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxjQUFjLENBQUM7U0FDbEM7S0FDSjtDQUNKO0FBRUQsTUFBTSxhQUFjLFNBQVEsS0FBSztJQUFqQzs7UUFDYyxXQUFNLEdBQUcsS0FBSyxDQUFDO0tBNEI1QjtJQTFCRyxHQUFHO1FBQ0MsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3BCLElBQUksZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO1lBRXpCLE1BQU0sSUFBSSxHQUFHO2dCQUNULElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO29CQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTt3QkFDZCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7d0JBQ2QsZ0JBQWdCLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQzt3QkFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQztxQkFDcEM7b0JBQ0QscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQy9CO3FCQUFNO29CQUNILENBQUMsQ0FBQzt3QkFDRSxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVO3dCQUNsQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7cUJBQ2hDLENBQUMsQ0FBQztpQkFDTjthQUNKLENBQUE7WUFDRCxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMvQixDQUFDLENBQUM7S0FDTjtJQUVELEtBQUs7UUFDRCxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztLQUM5QjtDQUNKO0FBSUQsTUFBYSxVQUFVO0lBaUJuQixZQUFZLElBQVUsRUFBRSxLQUFpQixFQUFFLFNBQXlCLEVBQUUsS0FBYSxFQUFFLFlBQTBCLEVBQUUsV0FBVyxHQUFHLEVBQUUsRUFBRSxRQUFRLEdBQUcsS0FBSyxFQUFFLEdBQWlCO1FBUDVKLGdCQUFXLEdBQUcsS0FBSyxDQUFDO1FBQ3BCLFdBQU0sR0FBRyxLQUFLLENBQUM7UUFFekIsaUJBQVksR0FBa0IsRUFBRSxDQUFDO1FBSzdCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO1FBQzNCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0tBQ2xCO0lBRUQsSUFBSSxNQUFNO1FBQ04sTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxPQUFPO1lBQy9ELE9BQU87Z0JBQ0gsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVU7Z0JBQy9DLFdBQVcsRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXO2FBQ3JELENBQUE7U0FDSixFQUFFO1lBQ0MsVUFBVSxFQUFFLENBQUM7WUFDYixXQUFXLEVBQUUsQ0FBQztTQUNqQixDQUFDLENBQUM7UUFFSCxJQUFJLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtZQUNwQyxvQkFBb0IsQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ3ZFLG9CQUFvQixDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztTQUNsRTtRQUVELE9BQU87WUFDSCxVQUFVLEVBQUUsb0JBQW9CLENBQUMsVUFBVTtZQUMzQyxRQUFRLEVBQUUsb0JBQW9CLENBQUMsV0FBVztZQUMxQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNO1NBQ25DLENBQUE7S0FDSjtJQUVELEtBQUs7UUFDRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLGFBQWEsR0FBRyxLQUFLLENBQUM7UUFFekQsTUFBTSxTQUFTLEdBQUc7WUFDZCxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7Z0JBQ2IsVUFBVSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDNUIsT0FBTzthQUNWO1lBRUQsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lBRWQsTUFBTSxTQUFTLEdBQUc7Z0JBQ2QsSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFO29CQUNiLFVBQVUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ3pCLE9BQU87aUJBQ1Y7Z0JBRUQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDLENBQUM7Z0JBQ2pLLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRztvQkFDN0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzVCLEtBQUssRUFBRSxDQUFDO29CQUNSLFNBQVMsRUFBRSxDQUFDO2lCQUNmLENBQUMsQ0FBQzthQUNOLENBQUM7WUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDbkIsU0FBUyxFQUFFLENBQUM7YUFDZjtTQUNKLENBQUM7UUFFRixTQUFTLEVBQUUsQ0FBQztLQUNmO0lBRUQsS0FBSztRQUNELElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzNCLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtZQUNuQixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDO1NBQzdCO0tBQ0o7SUFFRCxJQUFJO1FBQ0EsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7S0FDM0I7Q0FDSjs7U0NqTWUsWUFBWSxDQUFFLE1BQWMsRUFBRSxJQUFZLEVBQUUsV0FBbUI7SUFDM0UsTUFBTSxPQUFPLEdBQVksTUFBTSxDQUFDO0lBRWhDLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxXQUFXLEdBQUcsSUFBSSxJQUFJLElBQUksQ0FBQztJQUV6RCxNQUFNLGFBQWEsR0FBRyxDQUFDLElBQWMsRUFBRSxJQUFZO1FBQy9DLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzNFLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDaEM7S0FDSixDQUFBO0lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUN0RCxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNoQztJQUVELElBQUksY0FBZ0MsQ0FBQztJQUdyQyxJQUFJLE9BQU8sQ0FBQyxXQUFXLElBQUksSUFBSSxFQUFFO1FBQzdCLElBQUksb0JBQW9CLElBQUksRUFBRSxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQy9ELE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzdCLGFBQWEsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLHlCQUF5QixDQUFDLENBQUM7WUFDNUQsYUFBYSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUseUJBQXlCLENBQUMsQ0FBQztTQUMvRDthQUFNLElBQUksT0FBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDMUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDbEM7YUFBTSxJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxFQUFFO1lBRWpGLElBQUksT0FBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxFQUFFO2dCQUNyQyxjQUFjLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7YUFDakQ7U0FDSjthQUFNLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDeEMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDaEM7YUFBTSxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxFQUFFO1lBRS9FLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEdBQUcsSUFBSSxFQUFFO2dCQUNuQyxjQUFjLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7YUFDL0M7U0FDSjthQUFNLElBQUksT0FBTyxDQUFDLElBQUksSUFBSSxFQUFFLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDOUQsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDaEM7S0FDSjtJQUVELElBQUksT0FBTyxDQUFDLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFO1FBQzVDLE9BQU8sQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUMzQyxJQUFJLE9BQU8sQ0FBQyxHQUFHO1lBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztLQUNoRTtJQUVELE9BQU8sY0FBYyxDQUFDO0NBQ3pCOztBQy9DRCxNQUFNLG1CQUFtQixHQUFHLG1CQUFtQixDQUFDLFFBQVEsQ0FBQztBQUV6RCxJQUFJLFVBQVUsR0FBeUIsU0FBUyxDQUFDO0FBRWpELG1CQUFtQixDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxDQUFDLElBQVM7SUFDdkQsTUFBTSxPQUFPLEdBQTBCLElBQUksQ0FBQztJQUU1QyxJQUFJLFdBQVcsR0FBMEIsU0FBUyxDQUFDO0lBRW5ELElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRTtRQUNsQixXQUFXLEdBQUcsQ0FBQyxJQUFZLEVBQUUsSUFBWTtZQUNyQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO2dCQUM1QixJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsSUFBSTthQUNiLENBQUMsQ0FBQztTQUNOLENBQUM7S0FDTDtJQUVELFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQ25ELHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFDekMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUNoQyxZQUFZLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBRXRFLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUVuQixXQUFXLENBQUM7UUFDUixtQkFBbUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFVBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUMxRCxFQUFFLElBQUksQ0FBQyxDQUFDO0NBQ1osQ0FBQyxDQUFDO0FBRUgsbUJBQW1CLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFO0lBQzFDLElBQUksVUFBVSxFQUFFO1FBQ1osVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO0tBQ3RCO0NBQ0osQ0FBQyxDQUFDIn0=
