import { Warrior } from "./warrior.js";
import { emp_demo, anubisath, crusaderBuffMHProc, crusaderBuffOHProc } from "./weapon.js";
import { Unit } from "./unit.js";
import { MeleeHitOutcome } from "./player.js"
import { warchiefs } from "./buff.js";
import { StatValues } from "./stats.js";

type HitOutComeStringMap = {[TKey in MeleeHitOutcome]: string};

const hitOutcomeString: HitOutComeStringMap = {
    [MeleeHitOutcome.MELEE_HIT_EVADE]: 'evade',
    [MeleeHitOutcome.MELEE_HIT_MISS]: 'misses',
    [MeleeHitOutcome.MELEE_HIT_DODGE]: 'is dodged',
    [MeleeHitOutcome.MELEE_HIT_BLOCK]: 'is blocked',
    [MeleeHitOutcome.MELEE_HIT_PARRY]: 'is parried',
    [MeleeHitOutcome.MELEE_HIT_GLANCING]: 'glances',
    [MeleeHitOutcome.MELEE_HIT_CRIT]: 'crits',
    [MeleeHitOutcome.MELEE_HIT_CRUSHING]: 'crushes',
    [MeleeHitOutcome.MELEE_HIT_NORMAL]: 'hits',
    [MeleeHitOutcome.MELEE_HIT_BLOCK_CRIT]: 'is block crit',
};

const logEl = document.getElementById('logContainer')!;
const dpsEl = document.getElementById('dpsContainer')!;

const statContainerEL = document.getElementById('stats')!;
statContainerEL.getElementsByTagName("input");

const statEls: {[index: string]: HTMLInputElement} = {};

for (let el of statContainerEL.getElementsByTagName("input")) {
    statEls[el.name] = el;
}

function log(time: number, str: string) {
    const newEl = document.createElement("div");

    newEl.textContent = `${(time / 1000).toFixed(3)} ${str}.`;

    const atScrollBottom = logEl.scrollHeight - logEl.scrollTop === logEl.clientHeight;
    logEl.appendChild(newEl);

    if (atScrollBottom) {
        logEl.scrollTop = logEl.scrollHeight;
    }
}

function loadStats() {
    const res: StatValues = {};
    res.ap = parseInt(statEls.ap!.value);
    res.str = parseInt(statEls.str!.value);
    res.agi = parseInt(statEls.agi!.value);
    res.hit = parseInt(statEls.hit!.value);
    res.crit = parseInt(statEls.crit!.value);

    return res;
}

class RealTimeSim {
    protected update: () => void;
    protected requestStop = false;

    constructor() {
        const me = new Warrior(emp_demo, anubisath, loadStats(), log);
        me.buffManager.add(warchiefs, 0);
        me.mh.addProc(crusaderBuffMHProc);
        me.oh!.addProc(crusaderBuffOHProc);

        const boss = new Unit(63, 200);
        me.target = boss;

        let start: number;
        const simulationSpeed = 1;
        let totalDamage = 0;

        const printDPS = setInterval(() => {
            const duration = (performance.now() - start) * simulationSpeed;

            const dps = totalDamage / duration * 1000;

            dpsEl.textContent = `DPS: ${dps.toFixed(1)}`;
        }, 1000);

        this.update = () => {
            if (this.requestStop) {
                clearInterval(printDPS);
                return;
            }

            const time = performance.now();
            start = start || time;

            const duration = (time - start) * simulationSpeed;
            const [damageDone, hitOutcome, is_mh] = me.updateMeleeAttackingState(duration);

            totalDamage += damageDone;

            if (hitOutcome) {
                let hitStr = `Your ${is_mh ? 'main-hand' : 'off-hand'} ${hitOutcomeString[hitOutcome]}`;
                if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
                    hitStr += ` for ${damageDone}`;
                }
                log(duration, hitStr);
            }

            requestAnimationFrame(this.update);
        }
    }

    start() {
        requestAnimationFrame(this.update);
    }

    stop() {
        this.requestStop = true;
    }
}

let currentSim = new RealTimeSim();
currentSim.start();

document.getElementById('restartBtn')!.addEventListener('click', () => {
    currentSim.stop();
    logEl.innerHTML = "";
    dpsEl.innerHTML = "";
    currentSim = new RealTimeSim();
    currentSim.start();
});
