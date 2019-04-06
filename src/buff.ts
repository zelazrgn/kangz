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
    stats: Stats;
    logCallback: (arg0: number, arg1: string) => void;

    constructor(sv: StatValues, logCallback?: (arg0: number, arg1: string) => void) {
        this.stats = new Stats(sv);
        this.logCallback = logCallback || (() => {});
    }

    add(buff: Buff, applyTime: number) {
        for (let buffApp of this.buffList) {
            if (buffApp.buff === buff) {
                this.logCallback(applyTime, `${buff.name} refreshed`);
                buffApp.refresh(applyTime);
                return;
            }
        }

        this.logCallback(applyTime, `${buff.name} gained`);
        buff.add(this.stats);
        this.buffList.push(new BuffApplication(buff, applyTime));
    }

    remove(buff: Buff, time: number) {
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.buff === buff) {
                this.logCallback(time, `${buff.name} lost`);
                console.log('removed', buff.name);
                buffapp.buff.remove(this.stats);
                return false;
            }
            return true;
        });
    }

    removeExpiredBuffs(time: number) {
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.expirationTime <= time) {
                this.logCallback(time, `${buffapp.buff.name} expired`);
                console.log(buffapp.buff.name, 'expired');
                buffapp.buff.remove(this.stats);
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

    add(stats: Stats) {
        if (this.stats) {
            stats.add(this.stats);
        }

        if (this.addF) {
            this.addF(stats);
        }
    }

    remove(stats: Stats) {
        if (this.stats) {
            stats.remove(this.stats);
        }

        if (this.removeF) {
            this.removeF(stats);
        }
    }
}

export const blessingOfMight = new Buff("Blessing of Might", 15 * 60, {statMult: 1.1});
export const zandalar = new Buff("Spirit of Zandalar", 2 * 60 * 60, {statMult: 1.15});
export const warchiefs = new Buff("Warchief's Blessing", 1 * 60 * 60, {haste: 1.15});
