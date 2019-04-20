import { StatValues, Stats } from "./stats.js";
import { ItemDescription, ItemSlot } from "./item.js";
import { Buff } from "./buff.js";
import { LogFunction, Player, Race, DamageLog } from "./player.js";
import { setupPlayer } from "./simulation_utils.js";

export type ItemWithSlot = [ItemDescription, ItemSlot];

// TODO - change this interface so that ChooseAction cannot screw up the sim or cheat
// e.g. ChooseAction shouldn't cast spells at a current time
export type ChooseAction = (player: Player, time: number, fightLength: number, canExecute: boolean) => number|undefined;

export const EXECUTE_PHASE_RATIO = 0.15; // last 15% of the time is execute phase

class Fight {
    player: Player;
    chooseAction: ChooseAction;
    fightLength: number;
    duration = 0;

    constructor(race: Race, stats: StatValues, equipment: ItemWithSlot[], buffs: Buff[], chooseAction: ChooseAction, fightLength = 60, log?: LogFunction) {
        this.player = setupPlayer(race, stats, equipment, buffs, log);
        this.chooseAction = chooseAction;
        this.fightLength = (fightLength + Math.random() * 4 - 2) * 1000;
    }

    run(): Promise<FightResult> {
        return new Promise((f, r) => {
            while (this.duration <= this.fightLength) {
                this.update();
            }

            f({
                damageLog: this.player.damageLog,
                fightLength: this.fightLength,
                powerLost: this.player.powerLost
            });
        });
    }

    pause() {}

    cancel() {}

    protected update() {
        const beginExecuteTime = this.fightLength * (1 - EXECUTE_PHASE_RATIO);
        const isExecutePhase = this.duration >= beginExecuteTime;

        this.player.buffManager.update(this.duration); // need to call this if the duration changed because of buffs that change over time like jom gabber

        this.chooseAction(this.player, this.duration, this.fightLength, isExecutePhase); // choose action before in case of action depending on time off the gcd like earthstrike

        this.player.updateAttackingState(this.duration);
        // choose action after every swing which could be a rage generating event, but TODO: need to account for latency, reaction time (button mashing)
        const waitingForTime = this.chooseAction(this.player, this.duration, this.fightLength, isExecutePhase);

        let nextSwingTime = this.player.mh!.nextSwingTime;

        if (this.player.oh) {
            nextSwingTime = Math.min(nextSwingTime, this.player.oh.nextSwingTime);
        }

        // temporary hack
        if (this.player.extraAttackCount) {
            // don't increment duration (TODO: but I really should because the server doesn't loop instantly)
        } else if (this.player.nextGCDTime > this.duration) {
            this.duration = Math.min(this.player.nextGCDTime, nextSwingTime, this.player.buffManager.nextOverTimeUpdate);
        } else {
            this.duration = Math.min(nextSwingTime, this.player.buffManager.nextOverTimeUpdate);
        }

        if (waitingForTime && waitingForTime < this.duration) {
            this.duration = waitingForTime;
        }

        if (!isExecutePhase && beginExecuteTime < this.duration) { // not execute at start of update
            this.duration = beginExecuteTime;
        }
    }
}

class RealtimeFight extends Fight {
    protected paused = false;

    run(): Promise<FightResult> {
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
                } else {
                    f({
                        damageLog: this.player.damageLog,
                        fightLength: this.fightLength,
                        powerLost: this.player.powerLost
                    });
                }
            }
            requestAnimationFrame(loop);
        });
    }

    pause() {
        this.paused = !this.paused;
    }
}

export type FightResult = { damageLog: DamageLog, fightLength: number, powerLost: number};

export class Simulation {
    race: Race;
    stats: StatValues;
    equipment: ItemWithSlot[];
    buffs: Buff[];
    chooseAction: ChooseAction;
    protected fightLength: number;
    protected realtime: boolean;
    log?: LogFunction

    protected requestStop = false;
    protected paused = false;

    fightResults: FightResult[] = [];

    currentFight?: Fight;

    constructor(race: Race, stats: StatValues, equipment: ItemWithSlot[], buffs: Buff[], chooseAction: ChooseAction, fightLength = 60, realtime = false, log?: LogFunction) {
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
        let normalDamage = 0;
        let execDamage = 0;
        let normalDuration = 0;
        let execDuration = 0;

        let powerLost = 0;

        for (let fightResult of this.fightResults) {
            const beginExecuteTime = fightResult.fightLength * (1 - EXECUTE_PHASE_RATIO);

            for (let [time, damage] of fightResult.damageLog) {
                if (time >= beginExecuteTime) {
                    execDamage += damage;
                } else {
                    normalDamage += damage;
                }
            }

            normalDuration += beginExecuteTime;
            execDuration += fightResult.fightLength - beginExecuteTime;
            powerLost += fightResult.powerLost;
        }

        if (this.realtime && this.currentFight) {
            const beginExecuteTime = this.currentFight.fightLength * (1 - EXECUTE_PHASE_RATIO);

            for (let [time, damage] of this.currentFight.player.damageLog) {
                if (time >= beginExecuteTime) {
                    execDamage += damage;
                } else {
                    normalDamage += damage;
                }
            }

            normalDuration += Math.min(beginExecuteTime, this.currentFight.duration);
            execDuration += Math.max(0, this.currentFight.duration - beginExecuteTime);
            powerLost += this.currentFight.player.powerLost;
        }

        return {
            totalDamage: normalDamage + execDamage,
            normalDamage: normalDamage,
            execDamage: execDamage,
            duration: normalDuration + execDuration,
            normalDuration: normalDuration,
            execDuration: execDuration,
            powerLost: powerLost,
            fights: this.fightResults.length,
        }
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
