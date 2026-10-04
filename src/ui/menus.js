// Title screen, the 15-slot adventure browser, pause menu, help, dialogs.

import { el, clear, btn } from './dom.js';
import { listSlots, latestSlot, deleteSlot } from '../game/saves.js';
import { SYSTEMS } from '../data/systems.js';
import { fmtCredits, fmtPlaytime, fmtDate, escapeHtml } from '../core/util.js';
import { GAME_TITLE_HTML, GAME_SUBTITLE } from '../data/branding.js';
import { randomQuote } from '../data/quotes.js';
import { BACKGROUNDS, DRIVES, describePerks } from '../game/character.js';
import { FACTIONS, FACTION_IDS, STARTING_SWEAR_REP } from '../data/factions.js';
import { binds, codeLabel } from '../core/keybinds.js';

export class Menus {
  constructor(root) {
    this.root = root;
    this._title = null;
    this._save = null;
    this._pause = null;
    this._help = null;
    this._modal = null;
    this._confirmEl = null;
  }

  /* ------------------------------------------------------------------ */
  /* Confirmation dialog                                                */
  /* ------------------------------------------------------------------ */

  confirm(title, text, onYes) {
    this.closeConfirm();
    const wrap = el('div', { class: 'overlay' }, [
      el('div', { class: 'panel modal' }, [
        el('h2', { text: title }),
        el('p', { class: 'note', text }),
        el('div', { class: 'modal-actions' }, [
          btn('Cancel', () => this.closeConfirm(), 'btn ghost'),
          btn('Confirm', () => {
            this.closeConfirm();
            onYes?.();
          }, 'btn primary'),
        ]),
      ]),
    ]);
    this._confirmEl = wrap;
    this.root.append(wrap);
  }

  closeConfirm() {
    this._confirmEl?.remove();
    this._confirmEl = null;
  }

  /* ------------------------------------------------------------------ */
  /* Title screen                                                       */
  /* ------------------------------------------------------------------ */

  showTitle({ hasSave, onNew, onContinue, onLoad, onHelp }) {
    if (this._title) return;
    const menu = el('div', { class: 'menu' }, [
      btn('New Adventure', () => onNew(), 'btn primary'),
      btn('Continue', () => onContinue(), 'btn'),
      btn('Load Adventure', () => onLoad(), 'btn'),
      btn('How to Play', () => onHelp(), 'btn ghost'),
    ]);
    if (!hasSave) {
      menu.children[1].disabled = true;
      menu.children[2].disabled = true;
    }
    const screen = el('div', { class: 'screen center title-scene', id: 'title-screen' }, [
      el('div', { class: 'title-holder' }, [
        el('div', { class: 'logo', html: GAME_TITLE_HTML }),
        el('div', { class: 'sub', text: GAME_SUBTITLE }),
        el('div', { class: 'tagline', text: randomQuote(), title: 'A new line every time the title screen is drawn.' }),
        menu,
        el('div', { class: 'menu-note', html: `15 adventure slots · saved in your browser · <span class="key">${codeLabel(binds.get('thrust'))}</span> to burn · corner keyboard button rebinds` }),
      ]),
    ]);
    this._title = screen;
    this.root.append(screen);
  }

  hideTitle() {
    this._title?.remove();
    this._title = null;
  }

  /* ------------------------------------------------------------------ */
  /* New game: commander name                                           */
  /* ------------------------------------------------------------------ */

  openNewGame({ onStart, onClose }) {
    let name = 'Commander';
    let backgroundId = BACKGROUNDS[0].id;
    let driveId = DRIVES[0].id;
    let factionId = null;
    let step = 0;

    const body = el('div');
    const modal = el('div', { class: 'overlay' }, [
      el('div', { class: 'panel modal wide newlog' }, [el('h2', { text: 'Open a new log' }), body]),
    ]);
    this._modal = modal;
    this.root.append(modal);

    const close = () => {
      this.closeModal();
      onClose?.();
    };

    const pickGrid = (list, selectedId, onPick) => {
      const grid = el('div', { class: 'pick-grid' });
      for (const entry of list) {
        const perksText = describePerks(entry.perks).join(' · ') || 'no material perks';
        const tip = [
          entry.name,
          entry.role ? `(${entry.role})` : null,
          '',
          entry.blurb,
          '',
          `Starting perks: ${perksText}`,
          entry.strengths?.length ? `\nStrengths:\n· ${entry.strengths.join('\n· ')}` : null,
          entry.tradeoffs?.length ? `\nTrade-offs:\n· ${entry.tradeoffs.join('\n· ')}` : null,
          entry.signature ? `\nSignature — ${entry.signature.name}: ${entry.signature.desc}` : null,
          entry.boon ? `\nBoon: ${entry.boon}` : null,
          entry.cost ? `Cost: ${entry.cost}` : null,
          entry.leans ? `\nLeans toward: ${entry.leans} — the disciplines this past pairs with (a nudge, never a lock).` : null,
        ].filter((x) => x !== null).join('\n');
        const card = el('div', {
          class: `card pick ${entry.id === selectedId ? 'sel' : ''}`,
          title: tip,
        }, [
          el('h4', {}, [
            entry.name,
            entry.role ? el('span', { class: 'h4tag', text: entry.role }) : null,
          ]),
          entry.tags ? el('div', {
            class: 'ctags',
            title: 'Reputation tags — the circles where people start out knowing your name.',
            text: entry.tags.join(' · '),
          }) : null,
          el('div', { class: 'cdesc', text: entry.blurb }),
          entry.signature ? el('div', {
            class: 'csig',
            title: 'Signature — what makes this past unlike any other start.',
          }, [
            el('b', { text: entry.signature.name }),
            el('span', { text: ` — ${entry.signature.desc}` }),
          ]) : null,
          entry.strengths?.length ? el('div', { class: 'cpick-block up' }, [
            el('h5', { text: 'Strengths' }),
            el('ul', {}, entry.strengths.map((s) => el('li', { text: s }))),
          ]) : null,
          entry.tradeoffs?.length ? el('div', { class: 'cpick-block down' }, [
            el('h5', { text: 'Trade-offs' }),
            el('ul', {}, entry.tradeoffs.map((s) => el('li', { text: s }))),
          ]) : null,
          (entry.boon || entry.cost) ? el('div', { class: 'cpick-block' }, [
            entry.boon ? el('div', { class: 'cline up', text: `Boon: ${entry.boon}` }) : null,
            entry.cost ? el('div', { class: 'cline down', text: `Cost: ${entry.cost}` }) : null,
          ]) : null,
          el('div', {
            class: 'cstats',
            title: 'Starting perks — granted the moment your log begins.',
            text: perksText,
          }),
          entry.leans ? el('div', {
            class: 'cstats leans',
            title: 'Leans toward — the skill disciplines this past pairs best with, listed by skill name. Find them in the skill tree: press K in flight, or open the Skills tab at any station. Nothing is locked: train any discipline you like.',
            text: `Leans toward: ${entry.leans}`,
          }) : null,
        ]);
        card.addEventListener('click', () => {
          onPick(entry.id);
          render();
        });
        grid.append(card);
      }
      return grid;
    };

    /**
     * The colours step: one card per flag, plus the option to sail unsworn.
     * Everything a card promises — standing, rivals, an open tree — is granted
     * by startingOath() in game/character.js.
     */
    const factionGrid = () => {
      const grid = el('div', { class: 'pick-grid' });
      const cards = [];
      const option = (id) => {
        const f = id ? FACTIONS[id] : null;
        const rivals = f?.opposes ? FACTIONS[f.opposes] : null;
        const homes = f ? f.home.slice(0, 3).map((h) => SYSTEMS[h]?.name).filter(Boolean).join(' · ') : '';
        const tip = f
          ? [`Fly the colours of ${f.name}`, '', f.creed, '', `Home ground: ${f.home.map((h) => SYSTEMS[h]?.name).join(', ')}`,
            `Starts you at +${STARTING_SWEAR_REP} standing with them`, rivals ? `and −15 with ${rivals.name}` : 'and on good terms with every flag',
            '', 'Their skill tree opens from the first bell, and their stations post their own work to you.'].join('\n')
          : ['Fly no colours', '', 'An unsworn transponder: every desk will deal with you, and no flag keeps your secrets.',
            'You see whatever any station is willing to publish, and no tree of any flag opens until you swear.',
            'You can swear later at any flag\'s station — 40 standing is the asking price — or buy introductions from a broker.'].join('\n');
        const card = el('div', {
          class: `card pick faction ${(id || null) === factionId ? 'sel' : ''}`,
          style: f ? `--fcol: ${f.color}` : '--fcol: #9fb0c6',
          title: tip,
        }, [
          el('h4', {}, [
            f ? f.name : 'No colours',
            el('span', { class: 'h4tag', text: f ? `+${STARTING_SWEAR_REP} standing` : 'unsworn' }),
          ]),
          el('div', { class: 'cdesc', text: f ? f.creed : 'You keep your own counsel and your own registry. Every flag deals with you; none of them claims you.' }),
          f ? el('div', { class: 'cstats', text: `Home: ${homes}` }) : el('div', { class: 'cstats', text: 'Opens: every desk in the Reach — briefly' }),
          el('div', { class: 'cstats', text: rivals ? `Rivals: ${rivals.name}` : (f ? 'Rivals: none — the ports trade with everyone' : 'Later: swear at 40 standing, or buy introductions') }),
          el('div', {
            class: 'cstats leans',
            text: f ? 'Their own desks and skill tree open at once.' : 'Renounce or defect later if you change your mind.',
          }),
        ]);
        card.addEventListener('click', () => {
          factionId = id;
          for (const c of cards) c.classList.toggle('sel', c === card);
        });
        cards.push(card);
        return card;
      };
      grid.append(option(null));
      for (const id of FACTION_IDS) grid.append(option(id));
      return grid;
    };

    const render = () => {
      clear(body);
      if (step === 0) {        const input = el('input', { type: 'text', maxlength: '24', value: name, spellcheck: 'false' });
        const next = () => {
          name = (input.value || 'Commander').trim().slice(0, 24) || 'Commander';
          step = 1;
          render();
        };
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') next();
        });
        body.append(
          el('p', { class: 'note', text: 'The lanes do not care what you were called before. Pick a name, then the past that shaped your hands.' }),
          el('div', { class: 'field' }, [el('label', { text: 'Commander' }), input]),
          el('div', { class: 'modal-actions' }, [
            btn('Cancel', close, 'btn ghost'),
            btn('Continue', next, 'btn primary'),
          ]),
        );
        window.setTimeout(() => {
          input.focus();
          input.select();
        }, 30);
        return;
      }
      if (step === 1) {
        body.append(
          el('p', { class: 'note', text: 'Where do you come from? This colours your start and gives your opening perks — hover any card for the full story. “Leans toward” lists the skill disciplines this past pairs with: a nudge, never a lock.' }),
          pickGrid(BACKGROUNDS, backgroundId, (id) => { backgroundId = id; }),
          el('div', { class: 'modal-actions' }, [
            btn('Back', () => { step = 0; render(); }, 'btn ghost'),
            btn('Continue', () => { step = 2; render(); }, 'btn primary'),
          ]),
        );
        return;
      }
      if (step === 2) {
        body.append(
          el('p', { class: 'note', text: 'Whose colours do you fly? Swearing sets your standing with that flag and its rivals, opens their skill tree from the first bell, and decides whose desks post work to you. You are never stuck with it: renounce at any station, defect at a rival\'s desk, or buy clean papers from a broker later.' }),
          factionGrid(),
          el('div', { class: 'modal-actions' }, [
            btn('Back', () => { step = 1; render(); }, 'btn ghost'),
            btn('Continue', () => { step = 3; render(); }, 'btn primary'),
          ]),
        );
        return;
      }
      body.append(
        el('p', { class: 'note', text: 'Why do you still fly? One private reason, filed under your own name. Hover a card for the full story.' }),
        pickGrid(DRIVES, driveId, (id) => { driveId = id; }),
        el('div', { class: 'modal-actions' }, [
          btn('Back', () => { step = 2; render(); }, 'btn ghost'),
          btn('Begin the log', () => {
            this.closeModal();
            onStart(name, backgroundId, driveId, factionId);
          }, 'btn primary'),
        ]),
      );
    };
    render();
  }

  closeModal() {
    this._modal?.remove();
    this._modal = null;
  }

  /* ------------------------------------------------------------------ */
  /* The 15-slot adventure browser                                      */
  /* ------------------------------------------------------------------ */

  openSave({ mode = 'load', onPick, onClose }) {
    this.closeSave();
    const titles = {
      load: 'Load Adventure',
      save: 'Save Adventure',
      new: 'Choose a berth for your new log',
    };
    const hints = {
      load: 'Click a log to fly again.',
      save: 'Click a berth to overwrite it with your current log.',
      new: 'Pick an empty berth — or overwrite one.',
    };
    this._saveMode = mode;
    this._saveOnPick = onPick;
    this._saveOnClose = onClose;

    this._saveGrid = el('div', { class: 'slots' });
    const wrap = el('div', { class: 'overlay' }, [
      el('div', { class: 'panel modal wide' }, [
        el('h2', { text: titles[mode] }),
        el('p', { class: 'note', text: hints[mode] }),
        this._saveGrid,
        el('div', { class: 'modal-actions' }, [btn('Close', () => {
          this.closeSave();
          onClose?.();
        }, 'btn ghost')]),
      ]),
    ]);
    this._save = wrap;
    this.root.append(wrap);
    this.refreshSave();
  }

  refreshSave() {
    if (!this._saveGrid) return;
    clear(this._saveGrid);
    const slots = listSlots();
    for (const info of slots) {
      const node = this._slotNode(info);
      this._saveGrid.append(node);
    }
  }

  _slotNode(info) {
    const mode = this._saveMode;
    if (info.empty) {
      const node = el('div', { class: 'slot empty' }, [
        el('div', { class: 'snum', text: `#${info.slot}` }),
        el('div', { class: 'snum', text: '+', style: 'font-size:26px;top:auto;right:auto;' }),
      ]);
      node.addEventListener('click', () => {
        if (mode === 'save' || mode === 'new' || mode === 'load') {
          this._saveOnPick?.(info.slot);
        }
      });
      return node;
    }
    const sysName = SYSTEMS[info.systemId]?.name || info.systemId;
    const node = el('div', { class: 'slot' }, [
      el('div', { class: 'snum', text: `#${info.slot}` }),
      el('div', { class: 'sname', text: info.commander }),
      el('div', { class: 'sship', text: info.shipName }),
      el('div', { class: 'smeta', html: `${escapeHtml(sysName)} · day ${info.day}<br>${fmtCredits(info.credits)} · ${fmtPlaytime(info.playtime)}` }),
      el('div', { class: 'sfoot' }, [
        el('span', { text: fmtDate(info.savedAt) }),
        el('button', {
          class: 'del',
          text: '✕',
          title: 'Delete this log',
          onclick: (e) => {
            e.stopPropagation();
            this.confirm('Delete log?', `Slot ${info.slot} — ${info.commander} — will be lost for good.`, () => {
              deleteSlot(info.slot);
              this.refreshSave();
            });
          },
        }),
      ]),
    ]);
    node.addEventListener('click', () => {
      if (mode === 'load' || mode === 'save') {
        if (mode === 'save') {
          this.confirm('Overwrite berth?', `Slot ${info.slot} (${info.commander}) will be replaced by your current log.`, () => {
            this._saveOnPick?.(info.slot);
          });
        } else {
          this._saveOnPick?.(info.slot);
        }
      } else if (mode === 'new') {
        this.confirm('Overwrite berth?', `Slot ${info.slot} (${info.commander}) will be replaced by your new commander.`, () => {
          this._saveOnPick?.(info.slot);
        });
      }
    });
    return node;
  }

  closeSave() {
    this._save?.remove();
    this._save = null;
    this._saveGrid = null;
  }

  /* ------------------------------------------------------------------ */
  /* Pause menu                                                         */
  /* ------------------------------------------------------------------ */

  openPause({ onResume, onSave, onLoad, onHelp, onKeys, onQuit }) {
    this.closePause();
    const wrap = el('div', { class: 'screen plain center' }, [
      el('div', { class: 'panel', style: 'width:420px' }, [
        el('h2', { text: 'Held in irons' }),
        el('p', { class: 'note', text: 'Drifting, safed, drives cold. The lanes wait.' }),
        el('div', { class: 'menu', style: 'width:100%' }, [
          btn('Resume Flight', () => onResume(), 'btn primary'),
          btn('Save Adventure', () => onSave(), 'btn'),
          btn('Load Adventure', () => onLoad(), 'btn'),
          btn('How to Play', () => onHelp(), 'btn ghost'),
          btn('Key Bindings', () => onKeys?.(), 'btn ghost'),
          btn('Abandon to Title', () => onQuit(), 'btn danger'),
        ]),
      ]),
    ]);
    this._pause = wrap;
    this.root.append(wrap);
  }

  closePause() {
    this._pause?.remove();
    this._pause = null;
  }

  /* ------------------------------------------------------------------ */
  /* Help                                                               */
  /* ------------------------------------------------------------------ */

  openHelp() {
    if (this._help) return;
    const key = (k) => `<span class="key">${k}</span>`;
    const kb = (id) => key(codeLabel(binds.get(id)));
    const rows = [
      ['Come about', `${kb('turnLeft')} ${kb('turnRight')} or arrow keys`],
      ['Main drive', `${kb('thrust')} to burn`],
      ['Retro / reverse', `${kb('brake')} — kills your drift, then pushes astern`],
      ['Engine burst', `hold ${kb('burst')} — harder thrust than the drive; the tank recharges over time`],
      ['Primary weapon', `${kb('fire')} — every gun that is not a missile or a snare`],
      ['Secondary / missiles', `${kb('fireAlt')}`],
      ['Disruptor snare', `${kb('disable')} — snare coils only bite a hull whose shields are down; three hits stop her dead`],
      ['Claim a prize', `${kb('claim')} — take a snared or beaten ship whole; far cheaper in karma and reputation than a kill`],
      ['Hail / communications', `${kb('comms')} — talk to stations, worlds, and ships you have snared or beaten`],
      ['Select a ship', `${kb('target')} cycles contacts · or click a hull directly — the plate models it overhead, as the window shows it`],
      ['Fleet: focus target', `${kb('focusFire')}`],
      ['Fleet: regroup', `${kb('regroup')}`],
      ['Scramble docked craft', `${kb('scramble')}`],
      ['Recall small craft', `${kb('recall')}`],
      ['Zoom view', `scroll wheel, trackpad pinch, or ${kb('zoomOut')} ${kb('zoomIn')}`],
      ['Fullscreen', `${kb('fullscreen')} or the corner button`],
      ['Volume / mute', `corner speaker button, or ${kb('mute')} to mute`],
      ['Simulation speed', `corner control · ${kb('speedDown')} slower · ${kb('speedUp')} faster · ${kb('speedReset')} back to ×0.5`],
      ['Dock', `${kb('dock')} when slowed at a station`],
      ['Scan a world or star', `${kb('dock')} when close and slow`],
      ['Ship’s computer', `${kb('chart')} or ${kb('jump')} — star map, missions, inventory, logs`],
      ['Skill tree', `${kb('skills')}`],
      ['Pause', `${kb('pause')}`],
    ];
    const table = el('table', { class: 'keys-table' }, rows.map(([a, b]) => el('tr', {}, [
      el('td', { text: a }),
      el('td', { html: b }),
    ])));
    const flightBlock = el('div', {}, [
      el('h3', { text: 'Flight is inertia' }),
      el('p', { class: 'note', html: 'Your hull keeps its momentum. Turning the bow does <b>not</b> turn your drift. Watch the flight-vector dial: when the arrow trails off your bow you are sliding sideways, and the amber <b>DRIFT</b> readout tells you how far. Kill it with a retro burn, or turn into the slide and make it work for you.' }),
      el('h3', { text: 'Reading the dial' }),
      el('p', { class: 'note', html: 'The dial shows your true course relative to the bow, plus <b>BURN</b> and <b>RETRO</b> authority. Green means you are tracking straight; amber means you are drifting. In a knife fight, whoever manages drift best gets the first clean shot.' }),
      el('h3', { text: 'Lumen & lanes' }),
      el('p', { class: 'note', html: 'Warping a lane costs <b>1 lumen</b>; a wormhole transit costs <b>2</b>. Refuel at any station berth — running dry in a quiet system is a slow way to think about your life.' }),
    ]);
    const survivalBlock = el('div', {}, [
      el('h3', { text: 'Making a living' }),
      el('p', { class: 'note', html: 'Buy where a good is produced (cheap), sell where it is demanded (dear). Check the chart and the market columns. Contracts at station bars pay steady money — courier runs, freight hauls, bounties, raider sweeps, black-box recoveries and signal surveys — and the board raises its stake as your renown grows: more stars, tougher marks, fatter pay. <b>New pilots:</b> courier runs and short hauls build a purse without a fight. Active jobs can be dropped from the ship’s computer (<b>M</b>) if a lane goes sour. <b>Planetary surveys</b> pay too — fly close to a world, slow down and press <b>E</b>; first scans of each world earn a bounty, and a scan can flush out salvage in orbit.' }),
      el('h3', { text: 'Staying alive' }),
      el('p', { class: 'note', html: 'Shields recover; armour does not — repair at any mechanic. Losing your ship is not the end: an escape pod drags you to your last dock, lighter in purse but with your hold and contracts intact.' }),
      el('h3', { text: 'Hulls, prizes, and the codex' }),
      el('p', { class: 'note', html: 'Shipyards sell what the local tech can fit out; a few hulls are <b>built to order</b> and stocked only at their home yards, and some are <b>licensed</b> — earned by walking a story path or finishing a side chain. Crippled crews sometimes <b>strike their colours</b>: a beaten ship that heaves to can be claimed mid-flight with <b>C</b> — it joins your fleet if a slot or bay is free, or is stripped for salvage. Every hull you sight is filed in the codex aboard the ship’s log.' }),
      el('h3', { text: 'The law and the lawless' }),
      el('p', { class: 'note', html: 'Piracy pleases the Reavers and enrages everyone else. Anger a faction past −60 and their ports refuse you — though contract business still earns a grudging berth. Reputation is the slowest cargo you will ever carry.' }),
      el('h3', { text: 'Saving' }),
      el('p', { class: 'note', html: 'Your adventure auto-saves to your chosen slot each time you dock, undock or jump a lane. Manual saves live in the pause menu.' }),
    ]);
    const wrap = el('div', { class: 'overlay' }, [
      el('div', { class: 'panel modal wide', style: 'max-height:86vh;overflow-y:auto' }, [
        el('h2', { text: 'How to Play' }),
        el('div', { class: 'help-cols', style: 'margin-top:14px' }, [table, flightBlock]),
        el('div', { style: 'margin-top:18px' }, [survivalBlock]),
        el('div', { class: 'modal-actions' }, [btn('Close', () => this.closeHelp(), 'btn primary')]),
      ]),
    ]);
    this._help = wrap;
    this.root.append(wrap);
  }

  closeHelp() {
    this._help?.remove();
    this._help = null;
  }

  closeAll() {
    this.closeSave();
    this.closePause();
    this.closeHelp();
    this.closeModal();
    this.closeConfirm();
  }
}
