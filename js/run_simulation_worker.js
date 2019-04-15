import { MainThreadInterface } from "./worker_event_interface.js";
import { Simulation } from "./simulation.js";
import { buffIndicesToBuff, equipmentIndicesToItem } from "./simulation_utils.js";
import { ItemSlot } from "./item.js";
const mainThreadInterface = MainThreadInterface.instance;
let currentSim = undefined;
mainThreadInterface.addEventListener('simulate', (data) => {
    const simdesc = data;
    let logFunction = undefined;
    if (simdesc.realtime) {
        logFunction = (time, text) => {
            mainThreadInterface.send('log', {
                time: time,
                text: text
            });
        };
    }
    currentSim = new Simulation(simdesc.stats, equipmentIndicesToItem(simdesc.equipment), buffIndicesToBuff(simdesc.buffs), chooseAction, simdesc.fightLength, simdesc.realtime, logFunction);
    currentSim.start();
    setInterval(() => {
        mainThreadInterface.send('status', currentSim.status);
    }, 1000);
});
mainThreadInterface.addEventListener('pause', () => {
    if (currentSim) {
        currentSim.pause();
    }
});
function chooseAction(player, time, fightLength) {
    const warrior = player;
    const useItemIfCan = (slot) => {
        const item = player.items.get(slot);
        if (item && item.onuse && item.onuse.canCast(time)) {
            item.onuse.cast(time);
        }
    };
    useItemIfCan(ItemSlot.TRINKET1);
    useItemIfCan(ItemSlot.TRINKET2);
    if (warrior.rage < 30 && warrior.bloodRage.canCast(time)) {
        warrior.bloodRage.cast(time);
    }
    if (warrior.nextGCDTime <= time) {
        if (warrior.bloodthirst.canCast(time)) {
            warrior.bloodthirst.cast(time);
        }
        else if (!warrior.bloodthirst.onCooldown(time)) {
            return;
        }
        else if (warrior.whirlwind.canCast(time)) {
            warrior.whirlwind.cast(time);
        }
        else if (!warrior.whirlwind.onCooldown(time)) {
            return;
        }
        else if (warrior.hamstring.canCast(time)) {
            warrior.hamstring.cast(time);
        }
    }
    if (warrior.rage >= 60 && !warrior.queuedSpell) {
        warrior.queuedSpell = warrior.heroicStrike;
        if (warrior.log)
            warrior.log(time, 'queueing heroic strike');
    }
}
//# sourceMappingURL=run_simulation_worker.js.map