import { SpellBuff } from "./spell.js";
export function generateChooseAction(useRecklessness, useHeroicStrikeR9, heroicStrikeRageReq, hamstringRageReq, bloodthirstExecRageMin, bloodthirstExecRageMax, mightyRageExecute, mightyRageRageReq, heroicStrikeInExecute) {
    return (player, time, fightLength, executePhase) => {
        const warrior = player;
        const timeRemainingSeconds = (fightLength - time) / 1000;
        let waitingForTime = Number.POSITIVE_INFINITY;
        for (let [_, item] of player.items) {
            if (item.onuse && item.onuse.canCast(time)) {
                if (item.onuse.spell instanceof SpellBuff) {
                    if (timeRemainingSeconds <= item.onuse.spell.buff.duration) {
                        item.onuse.cast(time);
                    }
                    else {
                        waitingForTime = Math.min(waitingForTime, fightLength - item.onuse.spell.buff.duration * 1000);
                    }
                }
            }
        }
        if (warrior.rage < 30 && warrior.bloodRage.canCast(time)) {
            warrior.bloodRage.cast(time);
        }
        if (warrior.nextGCDTime <= time) {
            if (useRecklessness && warrior.recklessness.canCast(time) && timeRemainingSeconds <= 15) {
                warrior.recklessness.cast(time);
            }
            else if (warrior.deathWish.canCast(time) &&
                (timeRemainingSeconds <= 30
                    || (timeRemainingSeconds - warrior.deathWish.spell.cooldown) > 30)) {
                warrior.deathWish.cast(time);
            }
            else if (executePhase && warrior.bloodthirst.canCast(time) && warrior.rage >= bloodthirstExecRageMin && warrior.rage <= bloodthirstExecRageMax) {
                warrior.bloodthirst.cast(time);
            }
            else if (executePhase && warrior.execute.canCast(time)) {
                warrior.execute.cast(time);
                if (mightyRageExecute && warrior.mightyRagePotion.canCast(time + 500)) {
                    warrior.futureEvents.push({
                        time: time + 500,
                        callback: () => {
                            warrior.mightyRagePotion.cast(time + 500);
                        }
                    });
                }
            }
            else if (warrior.bloodthirst.canCast(time)) {
                warrior.bloodthirst.cast(time);
            }
            else if (warrior.bloodthirst.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                if (warrior.bloodthirst.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.bloodthirst.cooldown);
                }
            }
            else if (!executePhase && warrior.whirlwind.canCast(time)) {
                warrior.whirlwind.cast(time);
            }
            else if (warrior.whirlwind.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                if (warrior.whirlwind.cooldown > time) {
                    waitingForTime = Math.min(waitingForTime, warrior.whirlwind.cooldown);
                }
            }
            else if (!executePhase && warrior.rage >= hamstringRageReq && warrior.hamstring.canCast(time)) {
                warrior.hamstring.cast(time);
            }
        }
        if (!mightyRageExecute && warrior.mightyRagePotion.canCast(time) && timeRemainingSeconds <= 20 && warrior.rage <= mightyRageRageReq) {
            warrior.mightyRagePotion.cast(time);
        }
        const heroicStrikeSpell = useHeroicStrikeR9 ? warrior.heroicStrikeR9 : warrior.heroicStrikeR8;
        if (warrior.rage >= heroicStrikeSpell.spell.cost && !warrior.queuedSpell && ((heroicStrikeInExecute && executePhase) || warrior.rage >= heroicStrikeRageReq)) {
            warrior.queuedSpell = heroicStrikeSpell;
            if (warrior.log)
                warrior.log(time, 'queueing heroic strike');
        }
        return waitingForTime;
    };
}
//# sourceMappingURL=warrior_ai.js.map