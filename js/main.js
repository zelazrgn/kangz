import { items } from "./data/items.js";
import { ItemSlot } from "./item.js";
import { setupPlayer, equipmentIndicesToItem, buffIndicesToBuff } from "./simulation_utils.js";
import { WorkerInterface } from "./worker_event_interface.js";
import { buffs } from "./data/spells.js";
const realtimeEl = document.getElementById('realtime');
const statContainerEL = document.getElementById('stats');
statContainerEL.getElementsByTagName("input");
const statEls = {};
const myStatsEl = document.getElementById('myStats');
const simsContainerEl = document.getElementById('simsContainer');
for (let el of statContainerEL.getElementsByTagName("input")) {
    statEls[el.name] = el;
    el.addEventListener("input", updateStats);
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
for (let [idx, item] of items.entries()) {
    addItemToCategories(item, idx);
}
for (let [slot, categoryEl] of categoryEls) {
    const label = document.createElement('label');
    label.textContent = ItemSlot[slot].toLowerCase();
    itemsEl.appendChild(label);
    itemsEl.appendChild(categoryEl);
    categoryEl.addEventListener('change', updateStats);
}
categoryEls.get(ItemSlot.MAINHAND).value = "9";
categoryEls.get(ItemSlot.RING2).value = "16";
categoryEls.get(ItemSlot.TRINKET2).value = "11";
function loadStats() {
    const res = { maceSkill: 305, swordSkill: 305, str: 120, agi: 80, ap: 0, hit: 0, crit: 0 };
    res.ap += parseInt(statEls.ap.value);
    res.str += parseInt(statEls.str.value);
    res.agi += parseInt(statEls.agi.value);
    res.hit += parseInt(statEls.hit.value);
    res.crit += parseInt(statEls.crit.value);
    return res;
}
function getEquipmentIndices() {
    const res = [];
    for (let [slot, categoryEl] of categoryEls) {
        const item = items[parseInt(categoryEl.value)];
        if (item) {
            res.push([parseInt(categoryEl.value), slot]);
        }
    }
    return res;
}
function getBuffs() {
    const res = [];
    for (let [idx, buff] of buffs.entries()) {
        if (buff.name !== "Warchief's Blessing") {
            res.push(idx);
        }
    }
    return res;
}
document.getElementById('startBtn').addEventListener('click', () => {
    startSim();
});
function updateStats() {
    const player = (() => {
        const player = setupPlayer(loadStats(), equipmentIndicesToItem(getEquipmentIndices()), buffIndicesToBuff(getBuffs()), undefined);
        player.buffManager.update(0);
        return player;
    })();
    const stats = player.buffManager.stats;
    myStatsEl.textContent = `
        AP: ${player.ap.toFixed(2)}
        Crit: ${player.calculateCritChance().toFixed(2)}
        Hit: ${stats.hit}
        Str: ${(stats.str * stats.statMult).toFixed(2)}
        Agi: ${(stats.agi * stats.statMult).toFixed(2)}`;
}
updateStats();
function startSim() {
    const realtime = realtimeEl.checked;
    const simEl = document.createElement('div');
    simEl.classList.add('sim');
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Pause';
    simEl.append(pauseBtn);
    pauseBtn.addEventListener('click', () => {
        worker.send('pause', undefined);
        const paused = pauseBtn.textContent === 'Pause';
        pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        simEl.classList.toggle('paused', paused);
    });
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    simEl.append(closeBtn);
    closeBtn.addEventListener('click', () => {
        worker.terminate();
        simEl.remove();
    });
    const dpsEl = document.createElement('div');
    dpsEl.classList.add('dps');
    simEl.append(dpsEl);
    const itemsEl = document.createElement('div');
    itemsEl.classList.add('equipedItems');
    itemsEl.textContent = 'Items: ' + equipmentIndicesToItem(getEquipmentIndices()).map(([item, slot]) => item.name).join(', ');
    simEl.append(itemsEl);
    const buffsEl = document.createElement('div');
    buffsEl.classList.add('chosenBuffs');
    buffsEl.textContent = 'Buffs: ' + buffIndicesToBuff(getBuffs()).map((buff) => buff.name).join(', ');
    simEl.append(buffsEl);
    const logEl = document.createElement('div');
    logEl.classList.add('log');
    if (realtime) {
        simEl.append(logEl);
    }
    simsContainerEl.append(simEl);
    const worker = new WorkerInterface('./js/run_simulation_worker.js');
    worker.addEventListener('status', (status) => {
        const dps = status.damageDone / status.duration * 1000;
        const seconds = status.duration / 1000;
        const days = seconds / 60 / 60 / 24;
        if (days >= 1) {
            dpsEl.textContent = `Days: ${(days).toFixed(3)} DPS: ${dps.toFixed(1)}`;
        }
        else {
            dpsEl.textContent = `Seconds: ${(seconds).toFixed(3)} DPS: ${dps.toFixed(1)}`;
        }
    });
    if (realtime) {
        worker.addEventListener('log', (data) => {
            const { time, text } = data;
            const newEl = document.createElement("div");
            newEl.textContent = `${(time / 1000).toFixed(3)} ${text}.`;
            const atScrollBottom = logEl.scrollHeight - logEl.scrollTop === logEl.clientHeight;
            logEl.appendChild(newEl);
            if (atScrollBottom) {
                logEl.scrollTop = logEl.scrollHeight;
            }
        });
    }
    const simdisc = {
        stats: loadStats(),
        equipment: getEquipmentIndices(),
        buffs: getBuffs(),
        fightLength: 60,
        realtime: realtime
    };
    worker.send('simulate', simdisc);
}
startSim();
//# sourceMappingURL=main.js.map