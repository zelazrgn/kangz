import { StatValues, Stats } from "./stats.js";
import { ItemDescription, ItemSlot } from "./item.js";
import { Buff } from "./buff.js";
import { LogFunction, Player, Race, DamageLog } from "./player.js";
import { setupPlayer } from "./simulation_utils.js";
import { EnchantDescription } from "./data/enchants.js";
import { BuffDescription } from "./data/spells.js";

export type ItemWithSlot = [ItemDescription, ItemSlot];

// TODO - change this interface so that ChooseAction cannot screw up the sim or cheat
// e.g. ChooseAction shouldn't cast spells at a current time
export type ChooseAction = (player: Player, time: number, fightLength: number, canExecute: boolean) => number;

export const EXECUTE_PHASE_RATIO = 0.15; // last 15% of the time is execute phase

class Fight {
    player: Player;
    chooseAction: ChooseAction;
    fightLength: number;
    duration = 0;

    constructor(race: Race, stats: StatValues, equipment: Map<ItemSlot, ItemDescription>, enchants: Map<ItemSlot, EnchantDescription>, temporaryEnchants: Map<ItemSlot, EnchantDescription>, buffs: BuffDescription[], chooseAction: ChooseAction, fightLength = 60, log?: LogFunction) {
        this.player = setupPlayer(race, stats, equipment, enchants, temporaryEnchants, buffs, log);
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

    pause(pause: boolean) {}

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

        if (waitingForTime < this.duration) {
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
        const MS_PER_UPDATE = 1000 / 60;

        return new Promise((f, r) => {
            let overrideDuration = 0;

            const loop = () => {
                if (this.duration <= this.fightLength) {
                    if (!this.paused) {
                        this.update();
                        overrideDuration += MS_PER_UPDATE;
                        this.duration = overrideDuration;
                    }
                    setTimeout(loop, MS_PER_UPDATE);
                } else {
                    f({
                        damageLog: this.player.damageLog,
                        fightLength: this.fightLength,
                        powerLost: this.player.powerLost
                    });
                }
            }
            setTimeout(loop, MS_PER_UPDATE);
        });
    }

    pause(pause: boolean) {
        this.paused = pause;
    }
}

export type FightResult = { damageLog: DamageLog, fightLength: number, powerLost: number};

export type SimulationSummary = {
    normalDamage: number,
    execDamage: number,
    normalDuration: number,
    execDuration: number,
    powerLost: number,
    fights: number,
};

export type StatusHandler = (status: SimulationSummary) => void;

export class Simulation {
    race: Race;
    stats: StatValues;
    equipment: Map<ItemSlot, ItemDescription>;
    enchants: Map<ItemSlot, EnchantDescription>;
    temporaryEnchants: Map<ItemSlot, EnchantDescription>;
    buffs: BuffDescription[];
    chooseAction: ChooseAction;
    protected fightLength: number;
    protected realtime: boolean;
    log?: LogFunction

    protected requestStop = false;
    protected _paused = false;

    fightResults: FightResult[] = [];

    currentFight?: Fight;

    protected cachedSummmary: SimulationSummary = { normalDamage: 0, execDamage: 0, normalDuration: 0, execDuration: 0, powerLost: 0, fights: 0 };

    constructor(race: Race, stats: StatValues, equipment: Map<ItemSlot, ItemDescription>, enchants: Map<ItemSlot, EnchantDescription>, temporaryEnchants: Map<ItemSlot, EnchantDescription>, buffs: BuffDescription[], chooseAction: ChooseAction, fightLength = 60, realtime = false, log?: LogFunction) {
        this.race = race;
        this.stats = stats;
        this.equipment = equipment;
        this.enchants = enchants;
        this.temporaryEnchants = temporaryEnchants;
        this.buffs = buffs;
        this.chooseAction = chooseAction;
        this.fightLength = fightLength;
        this.realtime = realtime;
        this.log = log;
    }

    get paused() {
        return this._paused;
    }

    get status(): SimulationSummary {
        for (let fightResult of this.fightResults) {
            const beginExecuteTime = fightResult.fightLength * (1 - EXECUTE_PHASE_RATIO);

            for (let [time, damage] of fightResult.damageLog) {
                if (time >= beginExecuteTime) {
                    this.cachedSummmary.execDamage += damage;
                } else {
                    this.cachedSummmary.normalDamage += damage;
                }
            }

            this.cachedSummmary.normalDuration += beginExecuteTime;
            this.cachedSummmary.execDuration += fightResult.fightLength - beginExecuteTime;
            this.cachedSummmary.powerLost += fightResult.powerLost;

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
            fights++;
        }

        return {
            normalDamage: normalDamage,
            execDamage: execDamage,
            normalDuration: normalDuration,
            execDuration: execDuration,
            powerLost: powerLost,
            fights: fights,
        }
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

                this.currentFight = new fightClass(this.race, this.stats, this.equipment, this.enchants, this.temporaryEnchants, this.buffs, this.chooseAction, this.fightLength, this.realtime ? this.log : undefined);
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

    pause(pause: boolean|undefined) {
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
