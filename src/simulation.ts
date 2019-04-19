import { StatValues, Stats } from "./stats.js";
import { ItemDescription, ItemSlot } from "./item.js";
import { Buff } from "./buff.js";
import { LogFunction, Player, Race } from "./player.js";
import { setupPlayer } from "./simulation_utils.js";

export type ItemWithSlot = [ItemDescription, ItemSlot];

// TODO - change this interface so that ChooseAction cannot screw up the sim or cheat
// e.g. ChooseAction shouldn't cast spells at a current time
export type ChooseAction = (player: Player, time: number, fightLength: number) => number|undefined;

class Fight {
    player: Player;
    chooseAction: ChooseAction;
    protected fightLength: number;
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
                damageDone: this.player.damageDone,
                fightLength: this.fightLength,
                powerLost: this.player.powerLost
            });
        });
    }

    pause() {}

    cancel() {}

    protected update() {
        this.player.buffManager.update(this.duration); // need to call this if the duration changed because of buffs that change over time like jom gabber

        this.chooseAction(this.player, this.duration, this.fightLength); // choose action before in case of action depending on time off the gcd like earthstrike 

        this.player.updateAttackingState(this.duration);
        // choose action after every swing which could be a rage generating event, but TODO: need to account for latency, reaction time (button mashing)
        const waitingForTime = this.chooseAction(this.player, this.duration, this.fightLength);

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
                        damageDone: this.player.damageDone,
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

export type FightResult = { damageDone: number, fightLength: number, powerLost: number};

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
        const combinedFightResults = this.fightResults.reduce((acc: FightResult, current) => {
            return {
                damageDone: acc.damageDone + current.damageDone,
                fightLength: acc.fightLength + current.fightLength,
                powerLost: acc.powerLost + current.powerLost,
            }
        }, {
            damageDone: 0,
            fightLength: 0,
            powerLost: 0
        });

        if (this.realtime && this.currentFight) {
            combinedFightResults.damageDone += this.currentFight.player.damageDone;
            combinedFightResults.fightLength += this.currentFight.duration;
            combinedFightResults.powerLost += this.currentFight.player.powerLost;
        }

        return {
            damageDone: combinedFightResults.damageDone,
            duration: combinedFightResults.fightLength,
            fights: this.fightResults.length,
            powerLost: combinedFightResults.powerLost,
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
