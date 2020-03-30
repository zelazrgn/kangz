import {  MainThreadInterface } from "./worker_event_interface.js";
import { Simulation } from "./simulation.js";
import { SimulationDescription, lookupItems, lookupBuffs, lookupEnchants, lookupTemporaryEnchants } from "./simulation_utils.js";
import { LogFunction } from "./player.js";
import { generateChooseAction } from "./warrior_ai.js";

const mainThreadInterface = MainThreadInterface.instance;

let currentSim: Simulation|undefined = undefined;

mainThreadInterface.addEventListener('simulate', (data: any) => {
    const simdesc = <SimulationDescription>data;

    let logFunction: LogFunction|undefined = undefined;

    if (simdesc.realtime) {
        logFunction = (time: number, text: string) => {
            mainThreadInterface.send('log', {
                time: time,
                text: text
            });
        };
    }

    currentSim = new Simulation(simdesc.race, simdesc.stats,
        lookupItems(simdesc.equipment),
        lookupEnchants(simdesc.enchants),
        lookupTemporaryEnchants(simdesc.temporaryEnchants),
        lookupBuffs(simdesc.buffs),
        generateChooseAction(simdesc.useRecklessness, simdesc.useHeroicStrikeR9, simdesc.heroicStrikeRageReq, simdesc.hamstringRageReq, simdesc.bloodthirstExecRageMin, simdesc.bloodthirstExecRageMax, simdesc.executeMightyRage, simdesc.mightyRageRageReq, simdesc.heroicStrikeInExecute),
        simdesc.fightLength, simdesc.realtime, simdesc.vael, logFunction);

    currentSim.start();

    setInterval(() => {
        if (currentSim && !currentSim.paused) {
            mainThreadInterface.send('status', currentSim!.status);
        }
    }, 500);
});

mainThreadInterface.addEventListener('pause', (pause: boolean|undefined) => {
    if (currentSim) {
        currentSim.pause(pause);
    }
});
