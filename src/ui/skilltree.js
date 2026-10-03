// Skill tree overlay (K): review the six disciplines and spend skill points
// anywhere in flight. The dock's Skills tab shows the same trees at a station.

import { el, clear, btn } from './dom.js';
import { SKILL_TREES } from '../data/skills.js';
import { skillRank, treeRanks, learnBlockReason } from '../game/skills.js';

const TREE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="5" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/>
  <path d="M12 7.4v3.1m0 0-4.6 5.6m4.6-5.6 4.6 5.6"/></svg>`;

const STAT_LABELS = {
  hull: 'Hull', shield: 'Shield', shieldRegen: 'Shield regen', energy: 'Charge',
  energyRegen: 'Charge regen', accel: 'Thrust', maxSpeed: 'Top speed', brake: 'Brake',
  turn: 'Turn rate', cargo: 'Hold', radar: 'Sensor range', lumenMax: 'Lumen tanks',
  armorRegen: 'Hull repair', mounts: 'Hardpoints', bays: 'Docking bays',
  fleetSlots: 'Escort slots',
};

const MOD_LABELS = {
  dmg: 'Weapon damage', dmgTaken: 'Damage taken', buy: 'Buy prices', sell: 'Sell prices',
  illegalSell: 'Contraband prices', repair: 'Repair costs', contract: 'Contract pay',
  survey: 'Survey bounties', podCredits: 'Salvage value', killLoot: 'Kill drops',
  repGain: 'Reputation gains', repLossCut: 'Reputation losses',
  wingDmg: 'Wing damage', wingArmor: 'Wing durability',
};

/** Human effect line for a skill card, e.g. "Hull +48 / rank". */
export function skillEffectText(skill) {
  const parts = [];
  if (skill.stat && skill.add) {
    const label = STAT_LABELS[skill.stat] || skill.stat;
    const v = skill.stat === 'turn' ? `${Math.round(skill.add * 57.3)}°/s` : `${skill.add}`;
    parts.push(`${label} +${v} / rank`);
  }
  if (skill.mod) {
    for (const [key, per] of Object.entries(skill.mod)) {
      const pct = Math.round(per * 100);
      parts.push(`${MOD_LABELS[key] || key} ${pct > 0 ? '+' : ''}${pct}% / rank`);
    }
  }
  return parts.join(' · ');
}

/** One skill card with rank pips and a Learn button. Shared look with the dock. */
export function skillCard(skill, state, onLearn) {
  const rank = skillRank(state, skill.id);
  const reason = learnBlockReason(state, skill.id);
  const cost = skill.cost || 1;
  const maxed = rank >= skill.max;
  const pips = Array.from({ length: skill.max }, (_, i) => (i < rank ? '●' : '○')).join(' ');
  const learn = btn(maxed ? 'Mastered' : `Learn (${cost})`, onLearn, `btn tiny ${reason ? '' : 'primary'}`);
  learn.disabled = maxed || !!reason;
  if (reason) learn.title = reason;
  return el('div', { class: `skill-card ${rank > 0 ? 'owned' : ''} ${reason ? 'blocked' : ''}` }, [
    el('h4', {}, [skill.name, el('span', { class: 'pips', text: pips })]),
    el('div', { class: 'cstats', text: `Tier ${skill.tier}` }),
    el('div', { class: 'sdesc', text: skill.desc }),
    el('div', { class: 'seffect', text: skillEffectText(skill) }),
    el('div', { class: 'sfoot2' }, [
      el('span', { class: 'why', text: reason || '' }),
      learn,
    ]),
  ]);
}

export class SkillTreeUI {
  constructor(root) {
    this.root = root;
    this.wrap = null;
    this.ctx = null;
    this.filter = 'all';
  }

  open(ctx) {
    this.close();
    this.ctx = ctx;
    this.wrap = el('div', { class: 'overlay' });
    this.root.append(this.wrap);
    this.render();
  }

  close() {
    this.wrap?.remove();
    this.wrap = null;
    this.ctx = null;
  }

  refresh() {
    if (this.wrap && this.ctx) this.render();
  }

  render() {
    const { state, actions, onClose } = this.ctx;
    clear(this.wrap);
    const points = state.skillPoints || 0;

    const filterRow = el('div', { class: 'chips', style: 'margin:2px 0 12px' });
    const pick = (id) => {
      this.filter = id;
      this.render();
    };
    filterRow.append(el('span', {
      class: `chip ${this.filter === 'all' ? 'on' : ''}`,
      text: 'All',
      style: 'cursor:pointer',
      onclick: () => pick('all'),
    }));
    for (const t of SKILL_TREES) {
      filterRow.append(el('span', {
        class: `chip ${this.filter === t.id ? 'on' : ''}`,
        text: `${t.name} · ${treeRanks(state, t.id)}`,
        style: `cursor:pointer; color:${t.color}`,
        onclick: () => pick(t.id),
      }));
    }

    const listWrap = el('div', { style: 'overflow:auto;min-height:0;flex:1;padding-right:8px' });
    const treeList = this.filter === 'all' ? SKILL_TREES : SKILL_TREES.filter((t) => t.id === this.filter);
    for (const tree of treeList) {
      const block = el('div', { class: 'tree-block' }, [
        el('div', { class: 'tree-head' }, [
          el('h3', { style: `color:${tree.color}`, text: tree.name }),
          el('span', { class: 'chip', text: `${treeRanks(state, tree.id)} ranks` }),
        ]),
        el('p', { class: 'note', text: tree.desc }),
      ]);
      const grid = el('div', { class: 'skill-grid' });
      for (const skill of tree.skills) {
        grid.append(skillCard(skill, state, () => actions.learn(skill.id)));
      }
      block.append(grid);
      listWrap.append(block);
    }

    const panel = el('div', {
      class: 'panel modal wide',
      style: 'display:flex;flex-direction:column;max-width:min(1080px,94vw);gap:6px',
    }, [
      el('h2', { text: 'Skill tree' }),
      el('div', { class: 'kbanner' }, [
        el('b', { class: 'bignum', text: String(points) }),
        el('span', {
          class: 'note',
          text: `skill point${points === 1 ? '' : 's'} unspent — one per level. Tier-4 elites unlock through story chapters, side jobs, kills and level.`,
        }),
      ]),
      filterRow,
      listWrap,
      el('div', { class: 'modal-actions' }, [btn('Close (Esc)', () => onClose(), 'btn primary')]),
    ]);
    this.wrap.append(panel);
  }
}

/** Corner-tray button that opens the skill tree (K) and badges unspent points. */
export function installSkillsButton(root, game) {
  const badge = el('b', { class: 'sp-badge', text: '0' });
  const button = el('button', {
    class: 'skills-btn',
    type: 'button',
    title: 'Skill tree (K) — spend skill points',
    'aria-label': 'Skill tree',
    html: TREE_ICON,
  });
  button.append(badge);

  const sync = () => {
    const n = game.state?.skillPoints || 0;
    badge.textContent = String(n);
    badge.style.display = n > 0 ? '' : 'none';
    button.classList.toggle('ready', n > 0);
    button.title = n > 0
      ? `Skill tree (K) — ${n} point${n > 1 ? 's' : ''} to spend`
      : 'Skill tree (K) — no unspent points';
  };

  button.addEventListener('click', () => {
    if (game.mode === 'flight') game.openSkills();
  });

  root.append(button);
  sync();
  return { sync, button };
}
