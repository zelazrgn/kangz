import { Warrior } from "./warrior";
import { Player } from "./player";
import { SpellBuff } from "./spell";

export function generateChooseAction(heroicStrikeRageReq: number, hamstringRageReq: number, bloodthirstExecRageLimit: number) {
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
            if (warrior.deathWish.canCast(time) &&
                (timeRemainingSeconds <= 30
                || (timeRemainingSeconds - warrior.deathWish.spell.cooldown) > 30)) { // could be timed better
                warrior.deathWish.cast(time);
            } else if (executePhase && warrior.bloodthirst.canCast(time) && warrior.rage < bloodthirstExecRageLimit) {
                warrior.bloodthirst.cast(time);
            }
            else if (executePhase && warrior.execute.canCast(time)) {
                warrior.execute.cast(time);
            } else if (warrior.bloodthirst.canCast(time)) {
                warrior.bloodthirst.cast(time);
            } else if (warrior.bloodthirst.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                // not or almost off cooldown, wait for rage or cooldown
                if (warrior.bloodthirst.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.bloodthirst.cooldown);
                }
            } else if (warrior.whirlwind.canCast(time)) {
                warrior.whirlwind.cast(time);
            } else if (warrior.whirlwind.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                // not or almost off cooldown, wait for rage or cooldown
                if (warrior.whirlwind.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.whirlwind.cooldown);
                }
            } else if (warrior.rage >= hamstringRageReq && warrior.hamstring.canCast(time)) {
                warrior.hamstring.cast(time);
            }
        }
    
        if (!executePhase && warrior.rage >= heroicStrikeRageReq && !warrior.queuedSpell) {
            warrior.queuedSpell = warrior.heroicStrike;
            if (warrior.log) warrior.log(time, 'queueing heroic strike');
        }
    
        return waitingForTime;
    };
}
