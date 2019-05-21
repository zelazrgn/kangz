import { items } from "./data/items.js";
import { enchants, temporaryEnchants } from "./data/enchants.js";
import { buffs } from "./data/spells.js";
import { Stats } from "./stats.js";
import { ItemSlot, itemSlotHasEnchant, itemSlotHasTemporaryEnchant } from "./item.js";
import { setupPlayer, lookupItems, lookupEnchants, lookupTemporaryEnchants, lookupBuffs } from "./simulation_utils.js";
import { WorkerInterface } from "./worker_event_interface.js";
import { Race, Faction } from "./player.js";
const realtimeEl = document.getElementById('realtime');
const statContainerEL = document.getElementById('stats');
const statEls = {};
const myStatsEl = document.getElementById('myStats');
const simsContainerEl = document.getElementById('simsContainer');
const raceEl = document.getElementById('race');
const buffsEl = document.getElementById('buffs');
const heroicStrikeRageReqEl = document.getElementById('heroicstrikerr');
const hamstringRageReqEl = document.getElementById('hamstringrr');
const bloodthirstExecRageLimitEl = document.getElementById('bloodthirstexecrl');
const fightLengthEl = document.getElementById('fightlength');
function getRace() {
    return parseInt(raceEl.value);
}
for (let race of [
    Race.HUMAN,
    Race.ORC,
]) {
    const option = document.createElement('option');
    option.value = `${race}`;
    option.textContent = Race[race].toLowerCase();
    raceEl.appendChild(option);
}
raceEl.addEventListener('change', () => {
    const race = getRace();
    const faction = race === Race.HUMAN ? Faction.ALLIANCE : Faction.HORDE;
    for (let [idx, buff] of buffs.entries()) {
        if (buff.faction !== undefined) {
            buffInputEls[idx].checked = !buff.disabled && buff.faction === faction;
        }
    }
    if (faction === Faction.HORDE) {
        setSelect(temporaryEnchantEls, ItemSlot.MAINHAND, lookupByName(temporaryEnchants, "Windfury"));
    }
    else {
        setSelect(temporaryEnchantEls, ItemSlot.MAINHAND, lookupByName(temporaryEnchants, "Elemental Sharpening Stone"));
    }
    updateStats();
});
for (let el of statContainerEL.getElementsByTagName("input")) {
    statEls[el.name] = el;
    el.addEventListener("input", updateStats);
}
const itemsEl = document.getElementById('items');
const equipmentEls = new Map();
const enchantEls = new Map();
const temporaryEnchantEls = new Map();
const ITEM_SLOTS = [
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
];
function addNoneOption(selectEl) {
    const option = document.createElement('option');
    option.textContent = 'None';
    selectEl.appendChild(option);
}
for (let itemSlot of ITEM_SLOTS) {
    const selectEl = document.createElement('select');
    equipmentEls.set(itemSlot, selectEl);
    if (itemSlot !== ItemSlot.MAINHAND) {
        addNoneOption(selectEl);
    }
    if (itemSlotHasEnchant[itemSlot]) {
        const selectEl = document.createElement('select');
        selectEl.classList.add('enchant');
        enchantEls.set(itemSlot, selectEl);
        addNoneOption(selectEl);
    }
    if (itemSlotHasTemporaryEnchant[itemSlot]) {
        const selectEl = document.createElement('select');
        selectEl.classList.add('temporaryEnchant');
        temporaryEnchantEls.set(itemSlot, selectEl);
        addNoneOption(selectEl);
    }
}
function addItemToCategories(item, idx) {
    for (let i = 1; i <= item.slot; i <<= 1) {
        if (item.slot & i) {
            if (equipmentEls.has(i)) {
                const categoryEl = equipmentEls.get(i);
                const option = document.createElement('option');
                option.value = `${idx}`;
                option.textContent = item.name;
                categoryEl.appendChild(option);
            }
        }
    }
}
function addEnchantToCategories(enchant, idx) {
    for (let i = 1; i <= enchant.slot; i <<= 1) {
        if (enchant.slot & i) {
            if (enchantEls.has(i)) {
                const categoryEl = enchantEls.get(i);
                const option = document.createElement('option');
                option.value = `${idx}`;
                option.textContent = enchant.name;
                categoryEl.appendChild(option);
            }
        }
    }
}
function addTemporaryEnchantToCategories(enchant, idx) {
    for (let i = 1; i <= enchant.slot; i <<= 1) {
        if (enchant.slot & i) {
            if (temporaryEnchantEls.has(i)) {
                const categoryEl = temporaryEnchantEls.get(i);
                const option = document.createElement('option');
                option.value = `${idx}`;
                option.textContent = enchant.name;
                categoryEl.appendChild(option);
            }
        }
    }
}
for (let [idx, item] of items.entries()) {
    addItemToCategories(item, idx);
}
for (let [idx, enchant] of enchants.entries()) {
    addEnchantToCategories(enchant, idx);
}
for (let [idx, temporaryEnchant] of temporaryEnchants.entries()) {
    addTemporaryEnchantToCategories(temporaryEnchant, idx);
}
for (let [slot, equipmentEl] of equipmentEls) {
    const label = document.createElement('label');
    label.textContent = ItemSlot[slot].toLowerCase();
    itemsEl.appendChild(label);
    itemsEl.appendChild(equipmentEl);
    const enchantCategoryEl = enchantEls.get(slot);
    if (enchantCategoryEl) {
        itemsEl.appendChild(enchantCategoryEl);
        enchantCategoryEl.addEventListener('change', updateStats);
    }
    const temporaryEnchantCategoryEl = temporaryEnchantEls.get(slot);
    if (temporaryEnchantCategoryEl) {
        itemsEl.appendChild(temporaryEnchantCategoryEl);
        temporaryEnchantCategoryEl.addEventListener('change', updateStats);
    }
    equipmentEl.addEventListener('change', updateStats);
}
export function lookupByName(data, name) {
    for (let [idx, item] of data.entries()) {
        if (item.name === name) {
            return idx;
        }
    }
}
function setSelect(selectEls, key, value) {
    selectEls.get(key).value = '' + value;
}
const DEFAULT = new Map();
DEFAULT.set(ItemSlot.MAINHAND, ["Empyrean Demolisher", "Crusader MH", "Elemental Sharpening Stone"]);
DEFAULT.set(ItemSlot.OFFHAND, ["Anubisath Warhammer", "Crusader OH", "+8 Damage"]);
DEFAULT.set(ItemSlot.RANGED, ["Striker's Mark"]);
DEFAULT.set(ItemSlot.HEAD, ["Lionheart Helm", "1 Haste"]);
DEFAULT.set(ItemSlot.NECK, ["Barbed Choker"]);
DEFAULT.set(ItemSlot.SHOULDER, ["Conqueror's Spaulders", "ZG Enchant (30 AP)"]);
DEFAULT.set(ItemSlot.BACK, ["Drape of Unyielding Strength", "3 Agility"]);
DEFAULT.set(ItemSlot.CHEST, ["Breastplate of Annihilation", "Greater Stats (+4)"]);
DEFAULT.set(ItemSlot.WRIST, ["Hive Defiler Wristguards", "9 Strength"]);
DEFAULT.set(ItemSlot.HANDS, ["Gauntlets of Annihilation", "15 Agility"]);
DEFAULT.set(ItemSlot.WAIST, ["Onslaught Girdle"]);
DEFAULT.set(ItemSlot.LEGS, ["Titanic Leggings", "1 Haste"]);
DEFAULT.set(ItemSlot.FEET, ["Chromatic Boots", "Run Speed"]);
DEFAULT.set(ItemSlot.RING1, ["Quick Strike Ring"]);
DEFAULT.set(ItemSlot.RING2, ["Master Dragonslayer's Ring"]);
DEFAULT.set(ItemSlot.TRINKET1, ["Badge of the Swarmguard"]);
DEFAULT.set(ItemSlot.TRINKET2, ["Diamond Flask"]);
for (let [slot, [itemName, enchantName, temporaryEnchantName]] of DEFAULT) {
    if (itemName) {
        setSelect(equipmentEls, slot, lookupByName(items, itemName));
    }
    if (enchantName) {
        setSelect(enchantEls, slot, lookupByName(enchants, enchantName));
    }
    if (temporaryEnchantName) {
        setSelect(temporaryEnchantEls, slot, lookupByName(temporaryEnchants, temporaryEnchantName));
    }
}
const buffInputEls = [];
for (let [idx, buff] of buffs.entries()) {
    const labelEl = document.createElement('label');
    labelEl.textContent = buff.name;
    const inputEl = document.createElement('input');
    inputEl.type = 'checkbox';
    inputEl.value = `${idx}`;
    inputEl.checked = !buff.disabled;
    inputEl.addEventListener('change', updateStats);
    buffInputEls.push(inputEl);
    buffsEl.append(labelEl, inputEl);
}
function getBuffs() {
    const res = [];
    for (let inputEl of buffInputEls) {
        if (inputEl.checked) {
            res.push(parseInt(inputEl.value));
        }
    }
    return res;
}
function setBuffs(buffs) {
    for (let inputEl of buffInputEls) {
        inputEl.checked = false;
        for (let buffIdx of buffs) {
            if (parseInt(inputEl.value) === buffIdx) {
                inputEl.checked = true;
            }
        }
    }
}
function getSelectIndices(els) {
    const res = new Map();
    for (let [key, selectEl] of els) {
        const item = items[parseInt(selectEl.value)];
        if (item) {
            res.set(key, parseInt(selectEl.value));
        }
    }
    return res;
}
function setSelectIndices(els, indices) {
    for (let [key, index] of indices) {
        els.get(key).value = '' + index;
    }
}
function getEquipmentIndices() {
    return getSelectIndices(equipmentEls);
}
function setEquipment(equipment) {
    setSelectIndices(equipmentEls, equipment);
}
function getEnchantIndices() {
    return getSelectIndices(enchantEls);
}
function setEnchants(enchants) {
    setSelectIndices(enchantEls, enchants);
}
function getTemporaryEnchantIndices() {
    return getSelectIndices(temporaryEnchantEls);
}
function setTemporaryEnchants(temporaryEnchants) {
    setSelectIndices(temporaryEnchantEls, temporaryEnchants);
}
function getStats() {
    return {
        ap: parseInt(statEls.ap.value),
        str: parseInt(statEls.str.value),
        agi: parseInt(statEls.agi.value),
        hit: parseInt(statEls.hit.value),
        crit: parseInt(statEls.crit.value),
        haste: parseFloat(statEls.haste.value),
    };
}
function setStats(stats) {
    statEls.ap.value = '' + stats.ap;
    statEls.str.value = '' + stats.str;
    statEls.agi.value = '' + stats.agi;
    statEls.hit.value = '' + stats.hit;
    statEls.crit.value = '' + stats.crit;
    statEls.haste.value = '' + stats.haste;
}
function formatStats(stats) {
    const statsFull = new Stats(stats);
    return `AP: ${statsFull.ap}
        Crit: ${statsFull.crit}
        Hit: ${statsFull.hit}
        Str: ${(statsFull.str)}
        Agi: ${(statsFull.agi)}
        Haste: ${(statsFull.haste)}`;
}
function updateStats() {
    const player = (() => {
        const player = setupPlayer(getRace(), getStats(), lookupItems(getEquipmentIndices()), lookupEnchants(getEnchantIndices()), lookupTemporaryEnchants(getTemporaryEnchantIndices()), lookupBuffs(getBuffs()), undefined);
        player.buffManager.update(0);
        return player;
    })();
    const stats = player.buffManager.stats;
    myStatsEl.innerHTML = '';
    function prepend(str, length) {
        return ' '.repeat(Math.max(0, length - str.length)) + str;
    }
    const myStats = [
        ['AP', player.ap.toFixed(2)],
        ['Crit', prepend(player.calculateCritChance(player.target, true).toFixed(2), 5)],
        ['Hit', stats.hit],
        ['Crit Cap', prepend(player.critCap().toFixed(2), 5)],
        ['Haste', stats.haste],
        ['Crit - Cap', prepend((player.calculateCritChance(player.target, true) - player.critCap()).toFixed(2), 5)],
        ['Str', (stats.str * stats.statMult).toFixed(2)],
        ['Agi', (stats.agi * stats.statMult).toFixed(2)],
    ];
    for (let [label, value] of myStats) {
        const divLabel = document.createElement('div');
        divLabel.textContent = `${label}`;
        const divValue = document.createElement('div');
        divValue.textContent = `${value}`;
        myStatsEl.append(divLabel, divValue);
    }
    startInstantSim();
}
let previousSim = undefined;
function saveInstantSim() {
    if (!previousSim) {
        return;
    }
    if (previousSim.saved) {
        throw new Error("don't save a sim that is already saved");
    }
    previousSim.saved = true;
    const worker = previousSim.worker;
    const simEl = document.createElement('div');
    simEl.classList.add('sim');
    const simControlContainerEl = document.createElement('div');
    simControlContainerEl.classList.add('simControlContainer');
    simEl.append(simControlContainerEl);
    const pauseBtn = document.createElement('button');
    pauseBtn.classList.add('pauseBtn');
    pauseBtn.textContent = 'Pause';
    simControlContainerEl.append(pauseBtn);
    pauseBtn.addEventListener('click', () => {
        worker.send('pause', undefined);
        const paused = pauseBtn.textContent === 'Pause';
        pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        simEl.classList.toggle('paused', paused);
    });
    const loadBtn = document.createElement('button');
    loadBtn.classList.add('loadBtn');
    loadBtn.textContent = 'Load Settings';
    simControlContainerEl.append(loadBtn);
    const simdisc = previousSim.description;
    loadBtn.addEventListener('click', () => {
        raceEl.value = '' + simdisc.race;
        setStats(simdisc.stats);
        setEquipment(simdisc.equipment);
        setEnchants(simdisc.enchants);
        setTemporaryEnchants(simdisc.temporaryEnchants);
        setBuffs(simdisc.buffs);
        fightLengthEl.value = '' + simdisc.fightLength;
        realtimeEl.checked = simdisc.realtime;
        heroicStrikeRageReqEl.value = '' + simdisc.heroicStrikeRageReq;
        hamstringRageReqEl.value = '' + simdisc.hamstringRageReq;
        bloodthirstExecRageLimitEl.value = '' + simdisc.bloodthirstExecRageLimit;
    });
    const closeBtn = document.createElement('button');
    closeBtn.classList.add('closeBtn');
    simControlContainerEl.append(closeBtn);
    closeBtn.addEventListener('click', () => {
        worker.terminate();
        simEl.remove();
    });
    const simStatsEl = document.createElement('div');
    simStatsEl.classList.add('simStats');
    simEl.append(simStatsEl);
    const dpsEl = document.createElement('div');
    dpsEl.classList.add('dps');
    simStatsEl.append(dpsEl);
    const timeEl = document.createElement('div');
    timeEl.classList.add('time');
    simStatsEl.append(timeEl);
    const normalDPSEl = document.createElement('div');
    normalDPSEl.classList.add('normalDPS');
    simStatsEl.append(normalDPSEl);
    worker.addEventListener('status', (status) => {
        const totalDamage = status.normalDamage + status.execDamage;
        const totalDuration = status.normalDuration + status.execDuration;
        const dps = totalDamage / totalDuration * 1000;
        const normalDPS = status.normalDamage / status.normalDuration * 1000;
        const execDPS = (status.execDamage / status.execDuration * 1000) || 0;
        dpsEl.textContent = `${dps.toFixed(1)}`;
        normalDPSEl.textContent = `${normalDPS.toFixed(1)}`;
        execDPSEl.textContent = `${execDPS.toFixed(1)}`;
        const seconds = totalDuration / 1000;
        const days = seconds / 60 / 60 / 24;
        if (days >= 0.1) {
            timeEl.textContent = `${(days).toFixed(3)} days`;
        }
        else {
            timeEl.textContent = `${(seconds).toFixed(3)} seconds`;
        }
        const rlpm = status.powerLost / totalDuration * 1000 * 60;
        rlpmEl.textContent = `${rlpm.toFixed(1)}`;
    });
    const rlpmEl = document.createElement('div');
    rlpmEl.classList.add('rlpm');
    simStatsEl.append(rlpmEl);
    const execDPSEl = document.createElement('div');
    execDPSEl.classList.add('execDPS');
    simStatsEl.append(execDPSEl);
    const chosenRaceEL = document.createElement('div');
    chosenRaceEL.classList.add('simDetail', 'chosenRace');
    chosenRaceEL.textContent = 'Race: ' + Race[getRace()].toLowerCase();
    simEl.append(chosenRaceEL);
    const chosenStatsEL = document.createElement('div');
    chosenStatsEL.classList.add('simDetail', 'chosenStats');
    chosenStatsEL.textContent = 'Stats: ' + formatStats(getStats());
    simEl.append(chosenStatsEL);
    const fightSettings = document.createElement('div');
    fightSettings.classList.add('simDetail', 'fightSettings');
    fightSettings.textContent = `fight length: ${parseInt(fightLengthEl.value)}, her rr: ${parseInt(heroicStrikeRageReqEl.value)}, ham rr: ${parseInt(hamstringRageReqEl.value)}, bt rl:${parseInt(bloodthirstExecRageLimitEl.value)}`;
    simEl.append(fightSettings);
    const itemsEl = document.createElement('div');
    itemsEl.classList.add('simDetail', 'equipment');
    const equipment = lookupItems(simdisc.equipment);
    const enchants = lookupEnchants(simdisc.enchants);
    const temporaryEnchants = lookupTemporaryEnchants(simdisc.temporaryEnchants);
    for (let slot of ITEM_SLOTS) {
        const slotNameEl = document.createElement('div');
        slotNameEl.innerHTML = `${ItemSlot[slot].toLowerCase()}`;
        itemsEl.append(slotNameEl);
        const itemEl = document.createElement('div');
        const item = equipment.get(slot);
        if (item) {
            itemEl.innerHTML += ` ${item.name}`;
            const enchant = enchants.get(slot);
            if (enchant) {
                itemEl.innerHTML += ` ${enchant.name}`;
            }
            const temporaryEnchant = temporaryEnchants.get(slot);
            if (temporaryEnchant) {
                itemEl.innerHTML += ` ${temporaryEnchant.name}`;
            }
        }
        itemsEl.append(itemEl);
    }
    simEl.append(itemsEl);
    const buffsEl = document.createElement('div');
    buffsEl.classList.add('simDetail', 'chosenBuffs');
    buffsEl.textContent = 'Buffs: ' + lookupBuffs(getBuffs()).map((buff) => buff.name).join(', ');
    simEl.append(buffsEl);
    if (simdisc.realtime) {
        const logEl = document.createElement('div');
        logEl.classList.add('log');
        simEl.append(logEl);
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
    simsContainerEl.append(simEl);
    worker.send('pause', false);
}
function startInstantSim(forceSave = false) {
    if (previousSim && !previousSim.saved) {
        previousSim.worker.terminate();
    }
    if (previousSim && previousSim.instantStatusHandler) {
        previousSim.worker.removeEventListener('status', previousSim.instantStatusHandler);
    }
    const worker = new WorkerInterface('./js/worker-bundle.js');
    const dpsEl = document.querySelector('#instantSimStats .dps');
    const normalDPSEl = document.querySelector('#instantSimStats .normalDPS');
    const execDPSEl = document.querySelector('#instantSimStats .execDPS');
    const dpsDeltaEl = dpsEl.nextElementSibling;
    const normalDPSDeltaEl = normalDPSEl.nextElementSibling;
    const execDPSDeltaEl = execDPSEl.nextElementSibling;
    const instantStatsEl = document.querySelector('#instantSimStats');
    instantStatsEl.classList.toggle('old', true);
    const previousDPS = dpsEl.textContent ? parseFloat(dpsEl.textContent) : undefined;
    const previousNormalDPS = normalDPSEl.textContent ? parseFloat(normalDPSEl.textContent) : undefined;
    const previousExecDPS = execDPSEl.textContent ? parseFloat(execDPSEl.textContent) : undefined;
    function dpsDiffStr(dps1, dps2) {
        dps1 = parseFloat(dps1.toFixed(1));
        dps2 = parseFloat(dps2.toFixed(1));
        return (dps1 >= dps2 ? '+' : '') + (dps1 - dps2).toFixed(1);
    }
    const statusHandler = (status) => {
        instantStatsEl.classList.toggle('old', false);
        const totalDamage = status.normalDamage + status.execDamage;
        const totalDuration = status.normalDuration + status.execDuration;
        const dps = totalDamage / totalDuration * 1000;
        const normalDPS = status.normalDamage / status.normalDuration * 1000;
        const execDPS = (status.execDamage / status.execDuration * 1000) || 0;
        dpsEl.textContent = `${dps.toFixed(1)}`;
        normalDPSEl.textContent = `${normalDPS.toFixed(1)}`;
        execDPSEl.textContent = `${execDPS.toFixed(1)}`;
        if (previousDPS && previousNormalDPS && previousExecDPS) {
            dpsDeltaEl.textContent = `${dpsDiffStr(dps, previousDPS)}`;
            normalDPSDeltaEl.textContent = `${dpsDiffStr(normalDPS, previousNormalDPS)}`;
            execDPSDeltaEl.textContent = `${dpsDiffStr(execDPS, previousExecDPS)}`;
        }
        if (status.fights > 10000 && !previousSim.saved) {
            worker.send('pause', true);
        }
    };
    const realtime = forceSave && realtimeEl.checked;
    const simdisc = {
        race: getRace(),
        stats: getStats(),
        equipment: getEquipmentIndices(),
        enchants: getEnchantIndices(),
        temporaryEnchants: getTemporaryEnchantIndices(),
        buffs: getBuffs(),
        fightLength: parseInt(fightLengthEl.value),
        realtime: realtime,
        heroicStrikeRageReq: parseInt(heroicStrikeRageReqEl.value),
        hamstringRageReq: parseInt(hamstringRageReqEl.value),
        bloodthirstExecRageLimit: parseInt(bloodthirstExecRageLimitEl.value),
    };
    previousSim = {
        worker: worker,
        description: simdisc,
        instantStatusHandler: realtime ? undefined : statusHandler,
        saved: false,
    };
    if (!realtime) {
        worker.addEventListener('status', statusHandler);
    }
    worker.send('simulate', simdisc);
    if (forceSave) {
        saveInstantSim();
    }
}
document.getElementById('startBtn').addEventListener('click', () => {
    if (previousSim && !previousSim.saved && !realtimeEl.checked) {
        saveInstantSim();
    }
    else {
        startInstantSim(true);
    }
});
raceEl.dispatchEvent(new Event('change'));
//# sourceMappingURL=main.js.map