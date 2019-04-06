export class Stats {
    constructor(s) {
        this.ap = s.ap || 0;
        this.str = s.str || 0;
        this.agi = s.agi || 0;
        this.hit = s.hit || 0;
        this.crit = s.crit || 0;
        this.haste = s.haste || 1;
        this.statMult = s.statMult || 1;
    }
    add(s) {
        this.str += (s.str || 0);
        this.agi += (s.agi || 0);
        this.hit += (s.hit || 0);
        this.crit += (s.crit || 0);
        this.haste *= (s.haste || 1);
        this.statMult *= (s.statMult || 1);
    }
    remove(s) {
        this.str -= (s.str || 0);
        this.agi -= (s.agi || 0);
        this.hit -= (s.hit || 0);
        this.crit -= (s.crit || 0);
        this.haste /= (s.haste || 1);
        this.statMult /= (s.statMult || 1);
    }
}
//# sourceMappingURL=stats.js.map