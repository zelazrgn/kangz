import { Spell } from "../spell.js";
import { Player } from "../player.js";
import { Buff } from "../buff.js";

export class ExtraAttack extends Spell {
    constructor(name: string, count: number) {
        super(name, false, 0, 0, (player: Player, time: number) => {
            if (player.extraAttackCount) {
                return;
            }
            player.extraAttackCount = count;
            if (player.log) player.log(time, `Gained ${count} extra attacks from ${name}`);
        });
    }
}

export class SpellBuff extends Spell {
    constructor(buff: Buff) {
        super(`SpellBuff(${buff.name})`, false, 0, 0, (player: Player, time: number) => {
            player.buffManager.add(buff, time);
        });
    }
}
