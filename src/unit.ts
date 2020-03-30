import { clamp } from "./math.js";
import { Player } from "./player.js";

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
        return 5;
    }

    calculateArmorReducedDamage(damage: number, attacker: Player) {
        const armor = Math.max(0, this.armor - attacker.buffManager.stats.armorPenetration);
        
        let tmpvalue = armor / ((85 * attacker.level) + 400);
        tmpvalue /= (1 + tmpvalue);

        const armorModifier = clamp(tmpvalue, 0, 0.75);

        return Math.max(1, damage - (damage * armorModifier));
    }
}
