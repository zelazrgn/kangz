import { Player, MeleeHitOutcome } from "./player.js";
import { Buff } from "./buff.js";

const flurry = new Buff("Flurry", 15, {haste: 1.3});

export class Warrior extends Player {
    flurryCount = 0;
    rage = 0;

    calculateAttackPower() {
        return this.buffManager.stats.ap + this.buffManager.stats.str * this.buffManager.stats.statMult * 2;
    }

    updateProcs(time: number, is_mh: boolean, hitOutcome: MeleeHitOutcome, damageDone: number) {
        super.updateProcs(time, is_mh, hitOutcome, damageDone);

        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            this.flurryCount = Math.max(0, this.flurryCount - 1);
        }
        
        if (hitOutcome === MeleeHitOutcome.MELEE_HIT_CRIT) {
            this.flurryCount = 3;
            this.buffManager.add(flurry, time);
        } else if (this.flurryCount === 0) {
            this.buffManager.remove(flurry, time);
        }
    }
}
