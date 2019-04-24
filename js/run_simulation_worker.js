import { MainThreadInterface } from "./worker_event_interface.js";
import { Simulation } from "./simulation.js";
import { buffIndicesToBuff, equipmentIndicesToItem } from "./simulation_utils.js";
import { generateChooseAction } from "./warrior_ai.js";
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
    currentSim = new Simulation(simdesc.race, simdesc.stats, equipmentIndicesToItem(simdesc.equipment), buffIndicesToBuff(simdesc.buffs), generateChooseAction(simdesc.heroicStrikeRageReq, simdesc.hamstringRageReq, simdesc.bloodthirstExecRageLimit), simdesc.fightLength, simdesc.realtime, logFunction);
    currentSim.start();
    setInterval(() => {
        if (currentSim && !currentSim.paused) {
            mainThreadInterface.send('status', currentSim.status);
        }
    }, 500);
});
mainThreadInterface.addEventListener('pause', (pause) => {
    if (currentSim) {
        currentSim.pause(pause);
    }
});
//# sourceMappingURL=run_simulation_worker.js.map