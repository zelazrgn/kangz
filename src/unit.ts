import { clamp } from "./math.js";

export class Unit {
    level: number;
    armor: number;

    constructor(level: number, armor: number) {
        this.level = level;
        this.armor = armor;
    }

    get maxSkillForLevel() {
        return this.level * 5;
    }

    get defenseSkill() {
        return this.maxSkillForLevel;
    }

    get dodgeChance() {
        // TODO - should bosses have 5.6% dodge? source code looks like it is always 5
        return 5;
    }

    calculateArmorReducedDamage(damage: number, attacker: Unit) {
        const armor = Math.max(0, this.armor);
        
        let tmpvalue = 0.1 * armor  / ((8.5 * attacker.level) + 40);
        tmpvalue /= (1 + tmpvalue);

        const armorModifier = clamp(tmpvalue, 0, 0.75);

        return Math.max(1, damage - (damage * armorModifier));
    }
}
