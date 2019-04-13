import { Warrior, battleShout } from "./warrior.js";
import { crusaderBuffMHProc, crusaderBuffOHProc } from "./data/spells.js";
import { items } from "./data/items.js";
import { Unit } from "./unit.js";
import { warchiefs, dragonslayer, zandalar, songflower, blessingOfKings, blessingOfMight, dumplings, jujuPower, jujuMight, mongoose, roids, fengusFerocity, motw, trueshot } from "./data/spells.js";
import { StatValues, Stats } from "./stats.js";
import { ItemSlot, ItemDescription } from "./item.js";

const logEl = document.getElementById('logContainer')!;
const dpsEl = document.getElementById('dpsContainer')!;
const rageEl = document.getElementById('rageContainer')!;
const fastModeEl: HTMLInputElement = <HTMLInputElement>document.getElementById('fastMode')!;
const disableLogEl: HTMLInputElement = <HTMLInputElement>document.getElementById('disableLog')!;

const statContainerEL = document.getElementById('stats')!;
statContainerEL.getElementsByTagName("input");

const statEls: {[index: string]: HTMLInputElement} = {};

const myStatsEl = document.getElementById('myStats')!;


for (let el of statContainerEL.getElementsByTagName("input")) {
    statEls[el.name] = el;
}

const itemsEl = document.getElementById('items')!;

const categoryEls: Map<ItemSlot, HTMLSelectElement> = new Map();

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

function addItemToCategories(item: ItemDescription, idx: number) {
    for (let i = 1; i <= item.slot; i <<= 1) {
        if (item.slot & i) {
            if (categoryEls.has(i)) {
                const categoryEl = categoryEls.get(i)!;
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

// default items
categoryEls.get(ItemSlot.MAINHAND)!.value = "9"; // Empyrean
categoryEls.get(ItemSlot.RING2)!.value = "16"; // QSR
categoryEls.get(ItemSlot.TRINKET2)!.value = "11"; // HOJ

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
    const res = new Stats({ maceSkill: 305, swordSkill: 305, str: 120, agi: 80 }); // human
    res.ap += parseInt(statEls.ap!.value);
    res.str += parseInt(statEls.str!.value);
    res.agi += parseInt(statEls.agi!.value);
    res.hit += parseInt(statEls.hit!.value);
    res.crit += parseInt(statEls.crit!.value);

    return res;
}

class RealTimeSim {
    protected update: () => void;
    protected requestStop = false;

    protected startTime = 0;

    protected duration = 0;

    protected fast: boolean;

    protected paused = false;

    protected printDPSInterval: number;

    constructor(fast = false) {
        this.fast = fast;
        
        const me = new Warrior(loadStats(), !disableLogEl.checked ? log : undefined);
        me.buffManager.add(blessingOfKings, 0);
        me.buffManager.add(blessingOfMight, 0);
        me.buffManager.add(motw, 0);
        me.buffManager.add(trueshot, 0);
        
        // me.buffManager.add(warchiefs, 0);
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

        me.mh!.addProc(crusaderBuffMHProc);
        me.oh!.addProc(crusaderBuffOHProc);

        const boss = new Unit(63, 200);
        me.target = boss;

        me.buffManager.update(0);
        myStatsEl.textContent = `
            AP: ${me.ap.toFixed(2)}
            Crit: ${me.calculateCritChance().toFixed(2)}
            Hit: ${me.buffManager.stats.hit}
            Str: ${(me.buffManager.stats.str * me.buffManager.stats.statMult).toFixed(2)}
            Agi: ${(me.buffManager.stats.agi * me.buffManager.stats.statMult).toFixed(2)}`;

        this.printDPSInterval = setInterval(() => {
            const dps = me.damageDone / this.duration * 1000;
            dpsEl.textContent = `Time: ${(this.duration / 1000).toFixed(3)} DPS: ${dps.toFixed(1)}`;

            if (this.fast) {
                // dpsEl.textContent += ` Speedup ${(this.duration / (performance.now() - this.startTime)).toFixed(2)}`
            }
        }, 1000);

        this.update = () => {
            if (this.requestStop) {
                return;
            }

            if (!this.paused) {
                if (fast) {
                    // temporary hack
                    if (me.extraAttackCount) {
                        // don't increment duration (but I really should because the server doesn't loop instantly)
                    } else if (me.nextGCDTime > this.duration) {
                        this.duration = Math.min(me.nextGCDTime, me.mh!.nextSwingTime, me.oh!.nextSwingTime, me.buffManager.nextOverTimeUpdate);
                    } else {
                        this.duration = Math.min(me.mh!.nextSwingTime, me.oh!.nextSwingTime, me.buffManager.nextOverTimeUpdate);
                    }
                } else {
                    this.duration += 1000 / 60;
                }

                me.update(this.duration);

                rageEl.textContent = `Rage: ${me.rage}`;
            }

            requestAnimationFrame(this.update);
        }
    }

    start() {
        requestAnimationFrame(this.update);
    }

    pause() {
        this.paused = !this.paused;
    }

    stop() {
        clearInterval(this.printDPSInterval);
        this.requestStop = true;
    }
}

let currentSim = new RealTimeSim(fastModeEl.checked);
currentSim.start();

document.getElementById('restartBtn')!.addEventListener('click', () => {
    currentSim.stop();
    logEl.innerHTML = "";
    dpsEl.innerHTML = "";
    currentSim = new RealTimeSim(fastModeEl.checked);
    currentSim.start();
});

document.getElementById('pauseBtn')!.addEventListener('click', () => {
    currentSim.pause();
});
