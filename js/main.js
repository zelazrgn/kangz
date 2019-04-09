import { Warrior, battleShout } from "./warrior.js";
import { crusaderBuffMHProc, crusaderBuffOHProc } from "./weapon.js";
import { emp_demo, anubisath, ironfoe } from "./data/items.js";
import { Unit } from "./unit.js";
import { warchiefs } from "./buff.js";
const logEl = document.getElementById('logContainer');
const dpsEl = document.getElementById('dpsContainer');
const rageEl = document.getElementById('rageContainer');
const fastModeEl = document.getElementById('fastMode');
const disableLogEl = document.getElementById('disableLog');
const mhSelectEl = document.getElementById('mhSelect');
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
    const res = { maceSkill: 305, swordSkill: 305 };
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
        this.paused = false;
        this.fast = fast;
        const me = new Warrior(mhSelectEl.value === 'empyrean' ? emp_demo : ironfoe, anubisath, loadStats(), !disableLogEl.checked ? log : undefined);
        me.buffManager.add(warchiefs, 0);
        me.buffManager.add(battleShout, 0);
        me.mh.addProc(crusaderBuffMHProc);
        me.oh.addProc(crusaderBuffOHProc);
        const boss = new Unit(63, 200);
        me.target = boss;
        let duration = 0;
        const printDPS = setInterval(() => {
            const dps = me.damageDone / this.duration * 1000;
            dpsEl.textContent = `Time: ${(this.duration / 1000).toFixed(3)} DPS: ${dps.toFixed(1)}`;
            if (this.fast) {
            }
        }, 1000);
        this.update = () => {
            if (this.requestStop) {
                clearInterval(printDPS);
                return;
            }
            if (!this.paused) {
                if (fast) {
                    if (me.extraAttackCount) {
                    }
                    else if (me.nextGCDTime > this.duration) {
                        this.duration = Math.min(me.nextGCDTime, me.mh.nextSwingTime, me.oh.nextSwingTime);
                    }
                    else {
                        this.duration = Math.min(me.mh.nextSwingTime, me.oh.nextSwingTime);
                    }
                }
                else {
                    this.duration += 1000 / 60;
                }
                me.update(this.duration);
                rageEl.textContent = `Rage: ${me.rage}`;
            }
            requestAnimationFrame(this.update);
        };
    }
    start() {
        requestAnimationFrame(this.update);
    }
    pause() {
        this.paused = !this.paused;
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
document.getElementById('pauseBtn').addEventListener('click', () => {
    currentSim.pause();
});
//# sourceMappingURL=main.js.map