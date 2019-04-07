import { Warrior } from "./warrior.js";
import { emp_demo, anubisath, crusaderBuffMHProc, crusaderBuffOHProc } from "./weapon.js";
import { Unit } from "./unit.js";
import { warchiefs } from "./buff.js";
const logEl = document.getElementById('logContainer');
const dpsEl = document.getElementById('dpsContainer');
const rageEl = document.getElementById('rageContainer');
const fastModeEl = document.getElementById('fastMode');
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
    constructor(fast = false) {
        this.requestStop = false;
        this.startTime = 0;
        this.duration = 0;
        this.fast = fast;
        const me = new Warrior(emp_demo, anubisath, loadStats(), log);
        me.buffManager.add(warchiefs, 0);
        me.mh.addProc(crusaderBuffMHProc);
        me.oh.addProc(crusaderBuffOHProc);
        const boss = new Unit(63, 200);
        me.target = boss;
        let totalDamage = 0;
        let duration = 0;
        const printDPS = setInterval(() => {
            const dps = totalDamage / this.duration * 1000;
            dpsEl.textContent = `Time: ${(this.duration / 1000).toFixed(3)} DPS: ${dps.toFixed(1)}`;
            if (this.fast) {
                dpsEl.textContent += ` Speedup ${(this.duration / (performance.now() - this.startTime)).toFixed(2)}`;
            }
        }, 1000);
        this.update = () => {
            if (this.requestStop) {
                clearInterval(printDPS);
                return;
            }
            this.startTime = this.startTime || performance.now();
            if (fast) {
                this.duration = Math.min(me.mh.nextSwingTime, me.oh.nextSwingTime);
            }
            else {
                const now = performance.now();
                this.duration = now - this.startTime;
            }
            const [damageDone, hitOutcome, is_mh] = me.updateMeleeAttackingState(this.duration);
            totalDamage += damageDone;
            rageEl.textContent = `Rage: ${me.rage}`;
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
let currentSim = new RealTimeSim(fastModeEl.checked);
currentSim.start();
document.getElementById('restartBtn').addEventListener('click', () => {
    currentSim.stop();
    logEl.innerHTML = "";
    dpsEl.innerHTML = "";
    currentSim = new RealTimeSim(fastModeEl.checked);
    currentSim.start();
});
//# sourceMappingURL=main.js.map