import { Stats } from "./stats.js";
class BuffApplication {
    constructor(buff, applyTime) {
        this.buff = buff;
        this.refresh(applyTime);
    }
    refresh(time) {
        this.expirationTime = time + this.buff.duration * 1000;
    }
}
export class BuffManager {
    constructor(baseStats, log) {
        this.buffList = [];
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
    add(buff, applyTime) {
        for (let buffApp of this.buffList) {
            if (buffApp.buff === buff) {
                if (this.log)
                    this.log(applyTime, `${buff.name} refreshed`);
                buffApp.refresh(applyTime);
                return;
            }
        }
        if (this.log)
            this.log(applyTime, `${buff.name} gained`);
        this.buffList.push(new BuffApplication(buff, applyTime));
    }
    remove(buff, time) {
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.buff === buff) {
                if (this.log)
                    this.log(time, `${buff.name} lost`);
                return false;
            }
            return true;
        });
    }
    removeExpiredBuffs(time) {
        this.buffList = this.buffList.filter((buffapp) => {
            if (buffapp.expirationTime <= time) {
                if (this.log)
                    this.log(time, `${buffapp.buff.name} expired`);
                return false;
            }
            return true;
        });
    }
}
export class Buff {
    constructor(name, duration, stats, apply, remove) {
        this.name = name;
        this.duration = duration;
        this.stats = stats;
        this.addF = apply;
        this.removeF = remove;
    }
    apply(stats) {
        if (this.stats) {
            stats.add(this.stats);
        }
        if (this.addF) {
            this.addF(stats);
        }
    }
}
export const blessingOfMight = new Buff("Blessing of Might", 15 * 60, { statMult: 1.1 });
export const zandalar = new Buff("Spirit of Zandalar", 2 * 60 * 60, { statMult: 1.15 });
export const warchiefs = new Buff("Warchief's Blessing", 1 * 60 * 60, { haste: 1.15 });
//# sourceMappingURL=buff.js.map