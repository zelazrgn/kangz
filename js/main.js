import { Warrior } from "./warrior.js";
import { Weapon, WeaponType } from "./weapon.js";
import { Unit } from "./unit.js";
import { MeleeHitOutcome, hitOutcomeString } from "./player.js";
const logEl = document.getElementById('logContainer');
const dpsEl = document.getElementById('dpsContainer');
const emp_demo = new Weapon(WeaponType.MACE, 94, 175, 2.80);
const anubisath = new Weapon(WeaponType.MACE, 66, 123, 1.80);
const me = new Warrior(5000, 2000, emp_demo, anubisath);
const boss = new Unit(0);
me.target = boss;
let start = null;
const simulationSpeed = 1;
let totalDamage = 0;
function update() {
    const time = performance.now();
    start = start || time;
    const duration = (time - start) * simulationSpeed;
    const [damageDone, hitOutcome, is_mh] = me.updateMeleeAttackingState(duration);
    totalDamage += damageDone;
    if (hitOutcome) {
        const newEl = document.createElement("div");
        newEl.textContent = `Your ${is_mh ? 'main-hand' : 'off-hand'} ${hitOutcomeString[hitOutcome]}`;
        if (![MeleeHitOutcome.MELEE_HIT_MISS, MeleeHitOutcome.MELEE_HIT_DODGE].includes(hitOutcome)) {
            newEl.textContent += ` for ${damageDone}`;
        }
        newEl.textContent += '.';
        const atScrollBottom = logEl.scrollHeight - logEl.scrollTop === logEl.clientHeight;
        logEl.appendChild(newEl);
        if (atScrollBottom) {
            logEl.scrollTop = logEl.scrollHeight;
        }
    }
    requestAnimationFrame(update);
}
requestAnimationFrame(update);
setInterval(() => {
    const duration = (performance.now() - start) * simulationSpeed;
    const dps = totalDamage / duration * 1000;
    dpsEl.textContent = `DPS: ${dps.toFixed(1)}`;
}, 1000);
//# sourceMappingURL=main.js.map