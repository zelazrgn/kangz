import { Stats, StatValues } from "./stats.js";

class BuffApplication {
    buff: Buff;
    expirationTime!: number;
    stacks?: number; // TODO - how do we want to handle stacks. Badge of the Swarmguard

    constructor(buff: Buff, applyTime: number) {
        this.buff = buff;
        this.refresh(applyTime);
    }

    refresh(time: number) {
        this.expirationTime = time + this.buff.duration * 1000;
    }
}

export class BuffManager {
    buffList: BuffApplication[] = [];
    protected baseStats: Stats;
    stats: Stats;
    log?: (arg0: number, arg1: string) => void;

    constructor(baseStats: StatValues, log?: (arg0: number, arg1: string) => void) {
        this.baseStats = new Stats(baseStats);
        this.stats = new Stats(this.baseStats);

        this.log = log;
    }

    recalculateStats() {
        this.stats.set(this.baseStats);

        for (let { buff } of this.buffList) {
            buff.apply(this.stats);
        }
    }

    add(buff: Buff, applyTime: number) {
        for (let buffApp of this.buffList) {
            if (buffApp.buff === buff) {
                if (this.log) this.log(applyTime, `${buff.name} refreshed`);
                buffApp.refresh(applyTime);
                return;
            }
        }

        if (this.log) this.log(applyTime, `${buff.name} gained`);
        this.buffList.push(new BuffApplication(buff, applyTime));
    }

    remove(buff: Buff, time: number) {
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.buff === buff) {
                if (this.log) this.log(time, `${buff.name} lost`);
                return false;
            }
            return true;
        });
    }

    removeExpiredBuffs(time: number) {
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.expirationTime <= time) {
                if (this.log) this.log(time, `${buffapp.buff.name} expired`);
                return false;
            }
            return true;
        });
    }
}

export class Buff {
    name: String;
    stats: StatValues|undefined;
    addF: ((target: Stats) => void)|undefined;
    removeF: ((target: Stats) => void)|undefined;
    duration: number;

    constructor(name: string, duration: number, stats: StatValues|undefined, apply?: (target: Stats) => void, remove?: (target: Stats) => void) {
        this.name = name;
        this.duration = duration;
        this.stats = stats;
        this.addF = apply;
        this.removeF = remove;
    }

    apply(stats: Stats) {
        if (this.stats) {
            stats.add(this.stats);
        }

        if (this.addF) {
            this.addF(stats);
        }
    }
}

export const blessingOfMight = new Buff("Blessing of Might", 15 * 60, {statMult: 1.1});
export const zandalar = new Buff("Spirit of Zandalar", 2 * 60 * 60, {statMult: 1.15});
export const warchiefs = new Buff("Warchief's Blessing", 1 * 60 * 60, {haste: 1.15});
