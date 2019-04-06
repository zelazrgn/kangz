import { Warrior } from "./warrior.js";
import { emp_demo, anubisath, crusaderBuffMHProc, crusaderBuffOHProc } from "./weapon.js";
import { Unit } from "./unit.js";
import { warchiefs } from "./buff.js";
const logEl = document.getElementById('logContainer');
const dpsEl = document.getElementById('dpsContainer');
const statContainerEL = document.getElementById('stats');
statContainerEL.getElementsByTagName("input");
const statEls = {};
for (let el of statContainerEL.getElementsByTagName("input")) {
    statEls[el.name] = el;
}
function log(time, str) {
    const newEl = document.createElement("div");
    newEl.textContent = `${(time / 1000).toFixed(3)} ${str}.`;
    const atScrollBottom = logEl.scrollHeight - logEl.scrollTop === logEl.clientHeight;
    logEl.appendChild(newEl);
    if (atScrollBottom) {
        logEl.scrollTop = logEl.scrollHeight;
    }
}
function loadStats() {
    const res = {};
    res.ap = parseInt(statEls.ap.value);
    res.str = parseInt(statEls.str.value);
    res.agi = parseInt(statEls.agi.value);
    res.hit = parseInt(statEls.hit.value);
    res.crit = parseInt(statEls.crit.value);
    return res;
}
class RealTimeSim {
    constructor() {
        this.requestStop = false;
        const me = new Warrior(emp_demo, anubisath, loadStats(), log);
        me.buffManager.add(warchiefs, 0);
        me.mh.addProc(crusaderBuffMHProc);
        me.oh.addProc(crusaderBuffOHProc);
        const boss = new Unit(63, 200);
        me.target = boss;
        let start;
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
            requestAnimationFrame(this.update);
        };
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
document.getElementById('restartBtn').addEventListener('click', () => {
    currentSim.stop();
    logEl.innerHTML = "";
    dpsEl.innerHTML = "";
    currentSim = new RealTimeSim();
    currentSim.start();
});
//# sourceMappingURL=main.js.map