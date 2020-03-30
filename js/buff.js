import { Stats } from "./stats.js";
export class BuffManager {
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
export class Buff {
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
export class BuffOverTime extends Buff {
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
export class BuffProc extends Buff {
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
//# sourceMappingURL=buff.js.map