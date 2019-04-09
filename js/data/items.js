import { Weapon, Proc, WeaponType } from "../weapon.js";
import { SpellBuff, ExtraAttack } from "./spells.js";
import { Buff } from "../buff.js";
export const emp_demo = new Weapon(WeaponType.MACE, 94, 175, 2.80, {}, new Proc(new SpellBuff(new Buff("Empyrean Demolisher", 10, { haste: 1.2 })), { ppm: 1 }));
export const anubisath = new Weapon(WeaponType.MACE, 66, 123, 1.80, { maceSkill: 4, ap: 32 });
export const ironfoe = new Weapon(WeaponType.MACE, 73, 136, 2.40, {}, new Proc(new ExtraAttack('Ironfoe', 2), { ppm: 1 }));
//# sourceMappingURL=items.js.map