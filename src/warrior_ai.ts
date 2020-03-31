import { Warrior } from "./warrior.js";
import { Player } from "./player.js";
import { SpellBuff } from "./spell.js";

export function generateChooseAction(useRecklessness: boolean, useHeroicStrikeR9: boolean, heroicStrikeRageReq: number, hamstringRageReq: number, bloodthirstExecRageMin: number, bloodthirstExecRageMax: number, mightyRageExecute: boolean, mightyRageRageReq: number, heroicStrikeInExecute: boolean) {
    return (player: Player, time: number, fightLength: number, executePhase: boolean): number => {
        const warrior = <Warrior>player;
    
        const timeRemainingSeconds = (fightLength - time) / 1000;

        let waitingForTime = Number.POSITIVE_INFINITY;

        // TODO - what about GCD spells where you should pop them before fight? like diamond flask on vael
        // need to add a step for pre fight actions, maybe choose action should be able to work on negative fight time
        for (let [_, item] of player.items) {
            if (item.onuse && item.onuse.canCast(time)) {
                if (item.onuse.spell instanceof SpellBuff) {
                    if (timeRemainingSeconds <= item.onuse.spell.buff.duration) {
                        item.onuse.cast(time);
                    } else {
                        waitingForTime = Math.min(waitingForTime, fightLength - item.onuse.spell.buff.duration * 1000);
                    }
                }
            }
        }
    
        if (warrior.rage < 30 && warrior.bloodRage.canCast(time)) {
            warrior.bloodRage.cast(time);
        }
    
        // gcd spells
        if (warrior.nextGCDTime <= time) {
            if (useRecklessness && warrior.recklessness.canCast(time) && timeRemainingSeconds <= 15) {
                warrior.recklessness.cast(time);
            } else if (warrior.deathWish.canCast(time) &&
                (timeRemainingSeconds <= 30
                || (timeRemainingSeconds - warrior.deathWish.spell.cooldown) > 30)) { // could be timed better
                warrior.deathWish.cast(time);
            } else if (executePhase && warrior.bloodthirst.canCast(time)  && warrior.rage >= bloodthirstExecRageMin && warrior.rage <= bloodthirstExecRageMax) {
                warrior.bloodthirst.cast(time);
            }
            else if (executePhase && warrior.execute.canCast(time)) {
                warrior.execute.cast(time);
                if (mightyRageExecute && warrior.mightyRagePotion.canCast(time + 500)) {
                    warrior.futureEvents.push({
                        time: time + 500,
                        callback: () => {
                            warrior.mightyRagePotion.cast(time + 500);
                        }});
                }
            } else if (warrior.bloodthirst.canCast(time)) {
                warrior.bloodthirst.cast(time);
            } else if (warrior.bloodthirst.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                // not or almost off cooldown, wait for rage or cooldown
                if (warrior.bloodthirst.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.bloodthirst.cooldown);
                }
            } else if (!executePhase && warrior.whirlwind.canCast(time)) {
                warrior.whirlwind.cast(time);
            } else if (warrior.whirlwind.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                // not or almost off cooldown, wait for rage or cooldown
                if (warrior.whirlwind.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.whirlwind.cooldown);
                }
            } else if (!executePhase && warrior.rage >= hamstringRageReq && warrior.hamstring.canCast(time)) {
                warrior.hamstring.cast(time);
            }
        }

        if (!mightyRageExecute && warrior.mightyRagePotion.canCast(time) && timeRemainingSeconds <= 20 && warrior.rage <= mightyRageRageReq) {
            warrior.mightyRagePotion.cast(time);
        }

        const heroicStrikeSpell = useHeroicStrikeR9 ? warrior.heroicStrikeR9 : warrior.heroicStrikeR8;
    
        if ((!executePhase || heroicStrikeInExecute) &&  warrior.rage >= heroicStrikeSpell.spell.cost && !warrior.queuedSpell && warrior.rage >= heroicStrikeRageReq) {
            warrior.queuedSpell = heroicStrikeSpell;
            if (warrior.log) warrior.log(time, 'queueing heroic strike');
        }

        // if (executePhase && time >= player.mh!.nextSwingTime && warrior.queuedSpell) {
        //     warrior.queuedSpell = undefined;
        //     if (warrior.log) warrior.log(time, 'cancelling heroic strike in execute phase');
        // }

        // if (time >= player.mh!.nextSwingTime && warrior.queuedSpell && warrior.rage <= heroicStrikeRageReq) {
        //     warrior.queuedSpell = undefined;
        //     if (warrior.log) warrior.log(time, 'cancelling heroic strike');
        // }
    
        return waitingForTime;
    };
}
