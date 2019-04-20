import { Warrior } from "./warrior";
import { ItemSlot } from "./item";
import { Player } from "./player";

export function generateChooseAction(heroicStrikeRageReq: number, hamstringRageReq: number) {
    return (player: Player, time: number, fightLength: number, executePhase: boolean): number|undefined => {
        const warrior = <Warrior>player;
    
        const timeRemainingSeconds = (fightLength - time) / 1000;
    
        const useItemByName = (slot: ItemSlot, name: string) => {
            const item = player.items.get(slot);
            if (item && item.item.name === name && item.onuse && item.onuse.canCast(time)) {
                return item.onuse.cast(time);
            }
        }
    
        if (warrior.rage < 30 && warrior.bloodRage.canCast(time)) {
            warrior.bloodRage.cast(time);
        }
    
        let waitingForTime: number|undefined;
    
        // gcd spells
        if (warrior.nextGCDTime <= time) {
            if (timeRemainingSeconds <= 30 && warrior.deathWish.canCast(time)) {
                warrior.deathWish.cast(time);
                useItemByName(ItemSlot.TRINKET1, "Badge of the Swarmguard");
                useItemByName(ItemSlot.TRINKET2, "Badge of the Swarmguard");
            } else if (executePhase && warrior.execute.canCast(time)) {
                warrior.execute.cast(time);
            } else if (warrior.bloodthirst.canCast(time)) {
                warrior.bloodthirst.cast(time);
            } else if (warrior.bloodthirst.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                // not or almost off cooldown, wait for rage or cooldown
                if (warrior.bloodthirst.cooldown > time) {
                    waitingForTime = warrior.bloodthirst.cooldown;
                }
            } else if (warrior.whirlwind.canCast(time)) {
                warrior.whirlwind.cast(time);
            } else if (warrior.whirlwind.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
                // not or almost off cooldown, wait for rage or cooldown
                if (warrior.whirlwind.cooldown > time) {
                    waitingForTime = warrior.whirlwind.cooldown;
                }
            } else if (warrior.rage >= hamstringRageReq && warrior.hamstring.canCast(time)) {
                warrior.hamstring.cast(time);
            }
        }
    
        if (warrior.rage >= heroicStrikeRageReq && !warrior.queuedSpell) {
            warrior.queuedSpell = warrior.heroicStrike;
            if (warrior.log) warrior.log(time, 'queueing heroic strike');
        }
    
        return waitingForTime;
    };
}
