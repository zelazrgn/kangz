import { Warrior } from "./warrior";
import { ItemSlot } from "./item";
import { Player } from "./player";

export function chooseAction (player: Player, time: number, fightLength: number) {
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

    // gcd spells
    if (warrior.nextGCDTime <= time) {
        if (timeRemainingSeconds <= 30 && warrior.deathWish.canCast(time)) {
            warrior.deathWish.cast(time);
            useItemByName(ItemSlot.TRINKET1, "Badge of the Swarmguard");
            useItemByName(ItemSlot.TRINKET2, "Badge of the Swarmguard");
        } else if (warrior.bloodthirst.canCast(time)) {
            warrior.bloodthirst.cast(time);
        } else if (warrior.bloodthirst.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
            return; // not or almost off cooldown, wait for rage or gcd
        } else if (warrior.whirlwind.canCast(time)) {
            warrior.whirlwind.cast(time);
        } else if (warrior.whirlwind.timeRemaining(time) < 1.5 + (warrior.latency / 1000)) {
            return; // not or almost off cooldown, wait for rage or gcd
        } else if (warrior.rage >= 50 && warrior.hamstring.canCast(time)) {
            warrior.hamstring.cast(time);
        }
    }

    if (warrior.rage >= 60 && !warrior.queuedSpell) {
        warrior.queuedSpell = warrior.heroicStrike;
        if (warrior.log) warrior.log(time, 'queueing heroic strike');
    }
}
