import { Warrior, battleShout } from "./warrior.js";
import { crusaderBuffMHProc, crusaderBuffOHProc } from "./data/spells.js";
import { items } from "./data/items.js";
import { Unit } from "./unit.js";
import { dragonslayer, zandalar, songflower, blessingOfKings, blessingOfMight, dumplings, jujuPower, jujuMight, mongoose, roids, fengusFerocity, motw, trueshot } from "./data/spells.js";
import { Stats } from "./stats.js";
import { ItemSlot } from "./item.js";
const logEl = document.getElementById('logContainer');
const dpsEl = document.getElementById('dpsContainer');
const rageEl = document.getElementById('rageContainer');
const fastModeEl = document.getElementById('fastMode');
const disableLogEl = document.getElementById('disableLog');
const statContainerEL = document.getElementById('stats');
statContainerEL.getElementsByTagName("input");
const statEls = {};
const myStatsEl = document.getElementById('myStats');
for (let el of statContainerEL.getElementsByTagName("input")) {
    statEls[el.name] = el;
}
const itemsEl = document.getElementById('items');
const categoryEls = new Map();
for (let itemSlot of [
    ItemSlot.MAINHAND,
    ItemSlot.OFFHAND,
    ItemSlot.RANGED,
    ItemSlot.HEAD,
    ItemSlot.NECK,
    ItemSlot.SHOULDER,
    ItemSlot.BACK,
    ItemSlot.CHEST,
    ItemSlot.WRIST,
    ItemSlot.HANDS,
    ItemSlot.WAIST,
    ItemSlot.LEGS,
    ItemSlot.FEET,
    ItemSlot.RING1,
    ItemSlot.RING2,
    ItemSlot.TRINKET1,
    ItemSlot.TRINKET2,
]) {
    categoryEls.set(itemSlot, document.createElement('select'));
}
function addItemToCategories(item, idx) {
    for (let i = 1; i <= item.slot; i <<= 1) {
        if (item.slot & i) {
            if (categoryEls.has(i)) {
                const categoryEl = categoryEls.get(i);
                const option = document.createElement('option');
                option.value = `${idx}`;
                option.textContent = item.name;
                categoryEl.appendChild(option);
            }
        }
    }
}
const sortedItems = items.sort((a, b) => {
    return a.name.localeCompare(b.name);
});
for (let [idx, item] of sortedItems.entries()) {
    addItemToCategories(item, idx);
}
for (let [slot, categoryEl] of categoryEls) {
    const label = document.createElement('label');
    label.textContent = ItemSlot[slot].toLowerCase();
    itemsEl.appendChild(label);
    itemsEl.appendChild(categoryEl);
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
    const res = new Stats({ maceSkill: 305, swordSkill: 305, str: 120, agi: 80 });
    res.ap += parseInt(statEls.ap.value);
    res.str += parseInt(statEls.str.value);
    res.agi += parseInt(statEls.agi.value);
    res.hit += parseInt(statEls.hit.value);
    res.crit += parseInt(statEls.crit.value);
    return res;
}
class RealTimeSim {
    constructor(fast = false) {
        this.requestStop = false;
        this.startTime = 0;
        this.duration = 0;
        this.paused = false;
        this.fast = fast;
        const me = new Warrior(loadStats(), !disableLogEl.checked ? log : undefined);
        me.buffManager.add(blessingOfKings, 0);
        me.buffManager.add(blessingOfMight, 0);
        me.buffManager.add(motw, 0);
        me.buffManager.add(trueshot, 0);
        me.buffManager.add(battleShout, 0);
        me.buffManager.add(dragonslayer, 0);
        me.buffManager.add(zandalar, 0);
        me.buffManager.add(songflower, 0);
        me.buffManager.add(fengusFerocity, 0);
        me.buffManager.add(dumplings, 0);
        me.buffManager.add(jujuPower, 0);
        me.buffManager.add(jujuMight, 0);
        me.buffManager.add(mongoose, 0);
        me.buffManager.add(roids, 0);
        for (let [slot, categoryEl] of categoryEls) {
            const item = sortedItems[parseInt(categoryEl.value)];
            if (item) {
                me.equip(item, slot);
            }
        }
        me.mh.addProc(crusaderBuffMHProc);
        me.oh.addProc(crusaderBuffOHProc);
        const boss = new Unit(63, 200);
        me.target = boss;
        myStatsEl.textContent = `
            AP: ${me.ap.toFixed(2)}
            Crit: ${me.calculateCritChance().toFixed(2)}
            Hit: ${me.buffManager.stats.hit}
            Str: ${(me.buffManager.stats.str * me.buffManager.stats.statMult).toFixed(2)}
            Agi: ${(me.buffManager.stats.agi * me.buffManager.stats.statMult).toFixed(2)}`;
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