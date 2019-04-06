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
    constructor(sv, logCallback) {
        this.buffList = [];
        this.stats = new Stats(sv);
        this.logCallback = logCallback || (() => { });
    }
    add(buff, applyTime) {
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
    remove(buff, time) {
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
    removeExpiredBuffs(time) {
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
    constructor(name, duration, stats, apply, remove) {
        this.name = name;
        this.duration = duration;
        this.stats = stats;
        this.addF = apply;
        this.removeF = remove;
    }
    add(stats) {
        if (this.stats) {
            stats.add(this.stats);
        }
        if (this.addF) {
            this.addF(stats);
        }
    }
    remove(stats) {
        if (this.stats) {
            stats.remove(this.stats);
        }
        if (this.removeF) {
            this.removeF(stats);
        }
    }
}
export const blessingOfMight = new Buff("Blessing of Might", 15 * 60, { statMult: 1.1 });
export const zandalar = new Buff("Spirit of Zandalar", 2 * 60 * 60, { statMult: 1.15 });
export const warchiefs = new Buff("Warchief's Blessing", 1 * 60 * 60, { haste: 1.15 });
//# sourceMappingURL=buff.js.map