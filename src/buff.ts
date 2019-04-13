import { Stats, StatValues } from "./stats.js";
import { Player } from "./player.js";
import { Proc } from "./spell.js";

export class BuffManager {
    player: Player;

    private buffList: BuffApplication[] = [];
    private buffOverTimeList: BuffOverTimeApplication[] = [];

    baseStats: Stats;
    stats: Stats;

    constructor(player: Player, baseStats: StatValues) {
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

    update(time: number) {
        // process last tick before it is removed
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

    add(buff: Buff, applyTime: number) {
        for (let buffApp of this.buffList) {
            if (buffApp.buff === buff) {
                if (buff.stacks) {            
                    const logStackIncrease = this.player.log && (!buff.maxStacks || buffApp.stacks < buff.maxStacks);

                    if (buff.initialStacks) { // TODO - change this to charges?
                        buffApp.refresh(applyTime);
                    } else {
                        buffApp.stacks++;
                    }

                    if (logStackIncrease) {
                        this.player.log!(applyTime, `${buff.name} refreshed (${buffApp.stacks})`);
                    }
                } else {
                    if (this.player.log) this.player.log(applyTime, `${buff.name} refreshed`);
                    buffApp.refresh(applyTime);
                }
                return;
            }
        }

        if (this.player.log) this.player.log(applyTime, `${buff.name} gained` + (buff.stacks ? ` (${buff.initialStacks || 1})` : ''));

        if (buff instanceof BuffOverTime) {
            this.buffOverTimeList.push(new BuffOverTimeApplication(this.player, buff, applyTime));
        } else {
            this.buffList.push(new BuffApplication(buff, applyTime));
        }
        buff.add(applyTime, this.player);
    }

    remove(buff: Buff, time: number, full = false) {
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.buff === buff) {
                if (!full && buff.stacks) {
                    buffapp.stacks -= 1;
                    if (this.player.log) this.player.log(time, `${buff.name} (${buffapp.stacks})`);
                    if (buffapp.stacks > 0) {
                        return true;
                    }
                }

                if (this.player.log) this.player.log(time, `${buff.name} lost`);
                buffapp.buff.remove(time, this.player);
                return false;
            }
            return true;
        });

        this.buffOverTimeList = this.buffOverTimeList.filter((buffapp) => {
            if (buffapp.buff === buff) {
                if (buff.stacks) {
                    buffapp.stacks -= 1;
                    if (this.player.log) this.player.log(time, `${buff.name} (${buffapp.stacks})`);
                    if (buffapp.stacks > 0) {
                        return true;
                    }
                }

                if (this.player.log) this.player.log(time, `${buff.name} lost`);
                buffapp.buff.remove(time, this.player);
                return false;
            }
            return true;
        });
    }

    removeExpiredBuffs(time: number) {
        const removedBuffs: Buff[] = [];
        
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
            if (this.player.log) this.player.log(time, `${buff.name} expired`);
        }
    }
}

export class Buff {
    name: String;
    stats?: StatValues|undefined;
    stacks: boolean;
    duration: number;
    initialStacks?: number;
    maxStacks?: number;
    statsStack: boolean; // do you add the stat bonus for each stack? or is it like flurry where the stack is only to count charges

    private child?: Buff;

    constructor(name: string, duration: number, stats?: StatValues, stacks?: boolean, initialStacks?: number, maxStacks?: number, child?: Buff, statsStack = true) {
        this.name = name;
        this.duration = duration;
        this.stats = stats;
        this.stacks = !!stacks;
        this.initialStacks = initialStacks;
        this.maxStacks = maxStacks;
        this.child = child;
        this.statsStack = statsStack;
    }

    apply(stats: Stats, player: Player) {
        if (this.stats) {
            stats.add(this.stats);
        }
    }

    add(time: number, player: Player) {}

    remove(time: number, player: Player) {
        if (this.child) {
            player.buffManager.remove(this.child, time, true);
        }
    }
}

class BuffApplication {
    buff: Buff;
    expirationTime!: number;

    stacksVal!: number;

    constructor(buff: Buff, applyTime: number) {
        this.buff = buff;
        this.refresh(applyTime);
    }

    refresh(time: number) {
        this.stacks = this.buff.initialStacks || 1;

        this.expirationTime = time + this.buff.duration * 1000;

        if (this.buff.duration > 60) {
            this.expirationTime = Number.MAX_SAFE_INTEGER;
        }
    }

    get stacks() {
        return this.stacksVal;
    }

    set stacks(stacks: number) {
        this.stacksVal = this.buff.maxStacks ? Math.min(this.buff.maxStacks, stacks) : stacks;
    }
}

export class BuffOverTime extends Buff {
    updateF: (player: Player, time: number) => void;
    updateInterval: number

    constructor(name: string, duration: number, stats: StatValues|undefined, updateInterval: number, updateF: (player: Player, time: number) => void) {
        super(name, duration, stats);
        this.updateF = updateF;
        this.updateInterval = updateInterval;
    }
}

class BuffOverTimeApplication extends BuffApplication {
    buff: BuffOverTime;
    nextUpdate!: number;
    player: Player;

    constructor(player: Player, buff: BuffOverTime, applyTime: number) {
        super(buff, applyTime);
        this.buff = buff;
        this.player = player;
        this.refresh(applyTime);
    }

    refresh(time: number) {
        super.refresh(time);
        this.nextUpdate = time + this.buff.updateInterval;
    }

    update(time: number) {
        if (time >= this.nextUpdate) {
            this.nextUpdate += this.buff.updateInterval;
            this.buff.updateF(this.player, time);
        }
    }
}

export class BuffProc extends Buff {
    proc: Proc;

    constructor(name: string, duration: number, proc: Proc, child?: Buff) {
        super(name, duration, undefined, undefined, undefined, undefined, child);
        this.proc = proc;
    }

    add(time: number, player: Player) {
        super.add(time, player);
        player.addProc(this.proc);
    }

    remove(time: number, player: Player) {
        super.remove(time, player);
        player.removeProc(this.proc);
    }
}
