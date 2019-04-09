import { Spell } from "../spell.js";
export class ExtraAttack extends Spell {
    constructor(name, count) {
        super(name, false, 0, 0, (player, time) => {
            if (player.extraAttackCount) {
                return;
            }
            player.extraAttackCount = count;
            if (player.log)
                player.log(time, `Gained ${count} extra attacks from ${name}`);
        });
    }
}
export class SpellBuff extends Spell {
    constructor(buff) {
        super(`SpellBuff(${buff.name})`, false, 0, 0, (player, time) => {
            player.buffManager.add(buff, time);
        });
    }
}
//# sourceMappingURL=spells.js.map