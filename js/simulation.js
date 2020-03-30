import { setupPlayer } from "./simulation_utils.js";
class Fight {
    constructor(race, stats, equipment, enchants, temporaryEnchants, buffs, chooseAction, fightLength = 60, vael = false, log) {
        this.duration = 0;
        this.player = setupPlayer(race, stats, equipment, enchants, temporaryEnchants, buffs, vael, log);
        this.chooseAction = chooseAction;
        this.fightLength = (fightLength + Math.random() * 4 - 2) * 1000;
        const EXECUTE_PHASE_RATIO = 0.15;
        const VAEL_EXECUTE_PHASE_RATIO = 0.5;
        this.beginExecuteTime = this.fightLength * (1 - (vael ? VAEL_EXECUTE_PHASE_RATIO : EXECUTE_PHASE_RATIO));
    }
    run() {
        return new Promise((f, r) => {
            while (this.duration <= this.fightLength) {
                this.update();
            }
            this.player.buffManager.removeAllBuffs(this.fightLength);
            f({
                damageLog: this.player.damageLog,
                fightLength: this.fightLength,
                beginExecuteTime: this.beginExecuteTime,
                powerLost: this.player.powerLost,
                buffUptime: this.player.buffManager.buffUptimeMap,
                hitStats: this.player.hitStats,
            });
        });
    }
    pause(pause) { }
    cancel() { }
    update() {
        const futureEvents = this.player.futureEvents;
        this.player.futureEvents = [];
        for (let futureEvent of futureEvents) {
            if (futureEvent.time === this.duration) {
                futureEvent.callback(this.player);
            }
            else {
                this.player.futureEvents.push(futureEvent);
            }
        }
        const isExecutePhase = this.duration >= this.beginExecuteTime;
        this.player.buffManager.update(this.duration);
        this.chooseAction(this.player, this.duration, this.fightLength, isExecutePhase);
        this.player.updateAttackingState(this.duration);
        const waitingForTime = this.chooseAction(this.player, this.duration, this.fightLength, isExecutePhase);
        let nextSwingTime = this.player.mh.nextSwingTime;
        if (this.player.oh) {
            nextSwingTime = Math.min(nextSwingTime, this.player.oh.nextSwingTime);
        }
        if (this.player.extraAttackCount) {
        }
        else if (this.player.nextGCDTime > this.duration) {
            this.duration = Math.min(this.player.nextGCDTime, nextSwingTime, this.player.buffManager.nextOverTimeUpdate);
        }
        else {
            this.duration = Math.min(nextSwingTime, this.player.buffManager.nextOverTimeUpdate);
        }
        if (waitingForTime < this.duration) {
            this.duration = waitingForTime;
        }
        if (!isExecutePhase && this.beginExecuteTime < this.duration) {
            this.duration = this.beginExecuteTime;
        }
        for (let futureEvent of this.player.futureEvents) {
            this.duration = Math.min(this.duration, futureEvent.time);
        }
    }
}
class RealtimeFight extends Fight {
    constructor() {
        super(...arguments);
        this.paused = false;
    }
    run() {
        const MS_PER_UPDATE = 1000 / 60;
        return new Promise((f, r) => {
            let overrideDuration = 0;
            const loop = () => {
                if (this.duration <= this.fightLength) {
                    if (!this.paused) {
                        this.update();
                    }
                    setTimeout(loop, MS_PER_UPDATE);
                }
                else {
                    f({
                        damageLog: this.player.damageLog,
                        fightLength: this.fightLength,
                        beginExecuteTime: this.beginExecuteTime,
                        powerLost: this.player.powerLost,
                        buffUptime: new Map(),
                        hitStats: this.player.hitStats,
                    });
                }
            };
            setTimeout(loop, MS_PER_UPDATE);
        });
    }
    pause(pause) {
        this.paused = pause;
    }
}
export class Simulation {
    constructor(race, stats, equipment, enchants, temporaryEnchants, buffs, chooseAction, fightLength = 60, realtime = false, vael = false, log) {
        this.requestStop = false;
        this._paused = false;
        this.fightResults = [];
        this.cachedSummmary = { normalDamage: 0, execDamage: 0, normalDuration: 0, execDuration: 0, powerLost: 0, fights: 0, buffUptime: new Map(), hitStats: new Map() };
        this.race = race;
        this.stats = stats;
        this.equipment = equipment;
        this.enchants = enchants;
        this.temporaryEnchants = temporaryEnchants;
        this.buffs = buffs;
        this.chooseAction = chooseAction;
        this.fightLength = fightLength;
        this.realtime = realtime;
        this.vael = vael;
        this.log = log;
    }
    get paused() {
        return this._paused;
    }
    get status() {
        for (let fightResult of this.fightResults) {
            for (let [time, damage] of fightResult.damageLog) {
                if (time >= fightResult.beginExecuteTime) {
                    this.cachedSummmary.execDamage += damage;
                }
                else {
                    this.cachedSummmary.normalDamage += damage;
                }
            }
            this.cachedSummmary.normalDuration += fightResult.beginExecuteTime;
            this.cachedSummmary.execDuration += fightResult.fightLength - fightResult.beginExecuteTime;
            this.cachedSummmary.powerLost += fightResult.powerLost;
            for (let [buff, duration] of fightResult.buffUptime) {
                this.cachedSummmary.buffUptime.set(buff, (this.cachedSummmary.buffUptime.get(buff) || 0) + duration);
            }
            for (let [ability, hitOutComes] of fightResult.hitStats) {
                const currAbilityStats = this.cachedSummmary.hitStats.get(ability);
                if (currAbilityStats) {
                    const NUM_HIT_TYPES = 10;
                    for (let i = 0; i < NUM_HIT_TYPES; i++) {
                        currAbilityStats[i] += hitOutComes[i];
                    }
                }
                else {
                    this.cachedSummmary.hitStats.set(ability, hitOutComes);
                }
            }
            this.cachedSummmary.fights++;
        }
        this.fightResults = [];
        let normalDamage = this.cachedSummmary.normalDamage;
        let execDamage = this.cachedSummmary.execDamage;
        let normalDuration = this.cachedSummmary.normalDuration;
        let execDuration = this.cachedSummmary.execDuration;
        let powerLost = this.cachedSummmary.powerLost;
        let fights = this.cachedSummmary.fights;
        if (this.realtime && this.currentFight) {
            for (let [time, damage] of this.currentFight.player.damageLog) {
                if (time >= this.currentFight.beginExecuteTime) {
                    execDamage += damage;
                }
                else {
                    normalDamage += damage;
                }
            }
            normalDuration += Math.min(this.currentFight.beginExecuteTime, this.currentFight.duration);
            execDuration += Math.max(0, this.currentFight.duration - this.currentFight.beginExecuteTime);
            powerLost += this.currentFight.player.powerLost;
            fights++;
        }
        return {
            normalDamage: normalDamage,
            execDamage: execDamage,
            normalDuration: normalDuration,
            execDuration: execDuration,
            powerLost: powerLost,
            fights: fights,
            buffUptime: this.cachedSummmary.buffUptime,
            hitStats: this.cachedSummmary.hitStats,
        };
    }
    start() {
        const fightClass = this.realtime ? RealtimeFight : Fight;
        const outerloop = () => {
            if (this.paused) {
                setTimeout(outerloop, 100);
                return;
            }
            let count = 0;
            const innerloop = () => {
                if (count > 100) {
                    setTimeout(outerloop, 0);
                    return;
                }
                this.currentFight = new fightClass(this.race, this.stats, this.equipment, this.enchants, this.temporaryEnchants, this.buffs, this.chooseAction, this.fightLength, this.vael, this.realtime ? this.log : undefined);
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
    pause(pause) {
        if (pause === undefined) {
            pause = !this.paused;
        }
        this._paused = pause;
        if (this.currentFight) {
            this.currentFight.pause(pause);
        }
    }
    stop() {
        this.requestStop = true;
    }
}
//# sourceMappingURL=simulation.js.map