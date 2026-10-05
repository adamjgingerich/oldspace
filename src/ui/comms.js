// Ship's radio: a short conversation with whatever is alongside.
//
// The radio is deliberately small talk with teeth. Hailing a station asks about
// work and the weather; hailing a world asks what it grows and what it wants;
// hailing a ship you have snared or beaten is how a fight ends without a
// funeral — demand the colours, or send the crew home and take the goodwill.

import { el, clear } from './dom.js';
import { FACTIONS, isFaction, factionLabel } from '../data/factions.js';
import { HAILS } from '../data/voices.js';
import { planetInfo } from '../game/planetSurvey.js';
import { HOSTILE_REP } from '../game/state.js';

const SHIP_RANGE = 2600;
const WORLD_RANGE = 1500;

const ROLE_LABEL = {
  pirate: 'raider', bounty: 'bounty mark', navy: 'patrol', trader: 'hauler',
  house: 'House ship', transit: 'capital', courier: 'courier', escort: 'your wing',
  broker: 'crate trader',
};

export class CommsUI {
  constructor(root) {
    this.ctx = null;
    this.sel = null;
    this.transcript = new Map(); // contact object -> [{ who, text }]

    this.title = el('h2', { text: 'Ship’s radio' });
    this.subtitle = el('span', { class: 'csub', text: '' });
    this.closeBtn = el('button', { class: 'btn small', type: 'button', text: 'Sign off (T)' });
    this.closeBtn.addEventListener('click', () => this.ctx?.onClose?.());

    this.list = el('div', { class: 'clist' });
    this.remote = el('div', { class: 'cremote' });
    this.log = el('div', { class: 'clog' });
    this.opts = el('div', { class: 'copts' });

    this.panel = el('div', { class: 'comms hidden' }, [
      el('div', { class: 'cbox' }, [
        el('header', {}, [this.title, this.subtitle, this.closeBtn]),
        el('div', { class: 'cbody' }, [
          el('div', { class: 'cside' }, [el('h3', { text: 'Contacts' }), this.list]),
          el('div', { class: 'cmain' }, [this.remote, this.log, this.opts]),
        ]),
      ]),
    ]);
    root.append(this.panel);
  }

  open(ctx) {
    this.ctx = ctx;
    // open on whoever is locked up, else the nearest voice
    const contacts = this._contacts(ctx);
    if (!contacts.some((c) => c.obj === this.sel)) this.sel = null;
    if (ctx.target) {
      const hit = contacts.find((c) => c.obj.ship === ctx.target || c.obj === ctx.target);
      if (hit) this.sel = hit.obj;
    }
    if (!this.sel && contacts.length) this.sel = contacts[0].obj;
    this.panel.classList.remove('hidden');
    this.render();
  }

  close() {
    this.panel.classList.add('hidden');
    this.ctx = null;
    this.sel = null;
  }

  /* ---------------------------------------------------------------- */
  /* Contacts                                                          */
  /* ---------------------------------------------------------------- */

  _contacts(ctx) {
    const u = ctx.universe;
    const p = u.player;
    const out = [];
    const dist = (x, z) => Math.hypot(x - p.x, z - p.z);

    for (const s of u.ships) {
      if (s.isPlayer || !s.alive || s.despawn) continue;
      const d = dist(s.x, s.z);
      if (d > SHIP_RANGE) continue;
      const role = ROLE_LABEL[s.role] || s.role;
      out.push({
        obj: s, kind: 'ship', d,
        name: s.name,
        sub: `${s.def.name} · ${role}${s.disabled ? ' · snared' : s.surrendered ? ' · struck colours' : ''}`,
        state: s.disabled ? 'snared' : s.surrendered ? 'yielded' : s.aggroed || s.hunting ? 'hostile' : 'unknown',
      });
    }
    for (const st of u.stations) {
      const d = dist(st.x, st.z);
      if (d > WORLD_RANGE) continue;
      out.push({
        obj: st, kind: 'station', d,
        name: st.record.name,
        sub: `${st.record.type} · ${factionLabel(st.record.owner)}`,
        state: 'berth',
      });
    }
    for (const pl of u.planets) {
      const d = dist(pl.x, pl.z);
      if (d > WORLD_RANGE) continue;
      out.push({ obj: pl, kind: 'planet', d, name: pl.record.name, sub: 'world', state: 'world' });
    }

    out.sort((a, b) => {
      const at = ctx.target && (a.obj.ship === ctx.target || a.obj === ctx.target) ? -1 : 0;
      const bt = ctx.target && (b.obj.ship === ctx.target || b.obj === ctx.target) ? -1 : 0;
      return at - bt || a.d - b.d;
    });
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const contacts = this._contacts(ctx);
    if (!contacts.some((c) => c.obj === this.sel)) this.sel = contacts[0]?.obj || null;

    clear(this.list);
    if (!contacts.length) {
      this.list.append(el('p', { class: 'note', text: 'Nothing on the band. Close on a station, a world, or another ship.' }));
    }
    for (const c of contacts) {
      const row = el('button', {
        class: `ccontact ${c.obj === this.sel ? 'sel' : ''} ${c.state}`,
        type: 'button',
      }, [
        el('b', { text: c.name }),
        el('span', { class: 'cmeta', text: `${Math.round(c.d)} m · ${c.sub}` }),
      ]);
      row.addEventListener('click', () => {
        this.sel = c.obj;
        if (c.kind === 'ship') ctx.actions.setTarget(c.obj);
        this.render();
      });
      this.list.append(row);
    }

    const contact = contacts.find((c) => c.obj === this.sel) || null;
    if (!contact) {
      this.subtitle.textContent = '';
      clear(this.remote);
      clear(this.log);
      clear(this.opts);
      return;
    }

    this.subtitle.textContent = `${contact.name} · ${contact.sub}`;
    clear(this.remote);
    this.remote.append(
      el('b', { text: contact.name }),
      el('span', { class: 'cmeta', text: `  ${contact.sub} · ${Math.round(contact.d)} m on the scope` }),
    );

    // transcript
    const lines = this.transcript.get(contact.obj) || [];
    clear(this.log);
    if (!lines.length) {
      this.log.append(el('p', { class: 'note', text: 'Channel open. Nothing said yet.' }));
    }
    for (const line of lines) {
      this.log.append(el('p', { class: `cline ${line.who}` }, [
        el('b', { text: line.who === 'you' ? 'YOU · ' : line.who === 'them' ? `${contact.name.toUpperCase()} · ` : '· ' }),
        el('span', { text: line.text }),
      ]));
    }
    this.log.scrollTop = this.log.scrollHeight;

    // options
    clear(this.opts);
    for (const o of this._options(contact, ctx)) {
      const b = el('button', { class: `btn small ${o.cls || ''}`, type: 'button', text: o.label, title: o.title || '' });
      b.addEventListener('click', () => {
        if (o.say) this._say(contact.obj, 'you', o.say);
        const reply = o.act ? o.act() : null;
        if (reply) this._say(contact.obj, 'them', reply);
        this.render();
      });
      this.opts.append(b);
    }
  }

  _say(contact, who, text) {
    const lines = this.transcript.get(contact) || [];
    lines.push({ who, text });
    // a long friendship is a long scroll; keep the last few exchanges
    if (lines.length > 40) lines.splice(0, lines.length - 40);
    this.transcript.set(contact, lines);
  }

  /* ---------------------------------------------------------------- */
  /* Conversations                                                     */
  /* ---------------------------------------------------------------- */

  _options(contact, ctx) {
    const { state, universe, actions } = ctx;
    const opts = [];
    if (contact.kind === 'ship') {
      const s = contact.obj;
      const rep = state.rep[s.faction] ?? 0;
      const flag = FACTIONS[s.faction]?.name || s.faction;
      const canOrder = s.disabled || s.surrendered || (s.shield <= 0 && s.hull < s.stats.hull * 0.35);

      opts.push({
        label: 'Hail',
        say: `${s.name}, this is the ${state.shipName}. Come back.`,
        act: () => this._hailReply(s, rep, flag),
      });
      opts.push({
        label: 'Ask for news',
        say: 'Anything moving on these lanes worth knowing?',
        act: () => actions.rumour(),
      });
      if (s.brokerId && actions.openBroker) {
        const crate = actions.brokerCrate ? actions.brokerCrate(s) : [];
        const best = crate[0];
        opts.push({
          label: 'Ask about the crate',
          cls: 'primary',
          title: best ? `Top of the manifest: ${best.name}, asking ${Math.round(best.asking).toLocaleString()}.` : '',
          say: 'I hear you are carrying more than freight. What is on the deck?',
          act: () => {
            actions.openBroker(s);
            return best
              ? `A deck light comes on: ${crate.length} pieces laid out, ${best.name} at the head of them. “Come alongside and read the manifest yourself.”`
              : '“Deck is bare this run. Try me another system.”';
          },
        });
      }
      if (!s.surrendered) {
        opts.push({
          label: s.disabled ? 'Demand her colours' : 'Offer terms',
          cls: canOrder ? 'primary' : '',
          title: canOrder ? '' : 'They will not listen until they are snared, or beaten down with shields gone.',
          say: 'Your drives are dead and your guns are cold. Strike your colours and no one else has to die today.',
          act: () => this._demandSurrender(s, canOrder, flag),
        });
      }
      if (s.disabled || s.surrendered) {
        opts.push({
          label: 'Release the crew',
          cls: 'good',
          say: 'Get your people into the boats. I will log this as a rescue, not a prize.',
          act: () => {
            const name = s.def.name;
            actions.release(s);
            return `The ${name} comes alongside under escort. Her crew is alive, and every berth in ${flag} space will hear how.`;
          },
        });
      }
      opts.push({ label: 'Cut the channel', say: `That will be all, ${s.name}.`, act: () => `${s.name} acknowledges with a click.` });
      return opts;
    }

    if (contact.kind === 'station') {
      const st = contact.obj;
      const owner = st.record.owner;
      const rep = state.rep[owner] ?? 0;
      const flag = FACTIONS[owner]?.name || owner;
      const writ = this._hasWrit(ctx, st);
      opts.push({
        label: 'Request a berth',
        say: `${st.record.name}, this is the ${state.shipName}, requesting approach and a berth.`,
        act: () => {
          if (isFaction(owner) && owner !== 'free' && rep <= HOSTILE_REP && !writ) {
            return `${flag} control, curtly: “You are flagged as hunted. Come alongside and we will open fire.” Berth refused.`;
          }
          if (rep <= HOSTILE_REP) return 'Control, flatly: “Contract writ on file. One berth, under guard. Touch nothing.”';
          if (rep < -20) return 'Control: “You will be watched, captain. Berth seven.”';
          if (rep > 40) return `Control, warm: “${state.shipName}, always. Berth’s open and the coffee is honest.”`;
          return `Control: “Cleared for approach, ${state.shipName}. Mind the traffic on the way in.”`;
        },
      });
      opts.push({
        label: 'Ask for work',
        say: 'Anything on the board today?',
        act: () => {
          const n = actions.postings(st);
          if (!n) return 'The clerk: “Nothing posted for a hull like yours today. Try again tomorrow.”';
          return `The clerk: “${n} posting${n === 1 ? '' : 's'} on the board, paying by renown. Dock and read them yourself.”`;
        },
      });
      opts.push({ label: 'Ask for news', say: 'What is the word out there?', act: () => actions.rumour() });
      opts.push({ label: 'Sign off', say: `${st.record.name}, out.`, act: () => null });
      return opts;
    }

    // planet
    const pl = contact.obj;
    const info = planetInfo(state, pl.record.name, pl.record);
    const surveyed = state.planets?.[pl.record.name];
    opts.push({
      label: 'Ask for a readout',
      say: 'What is your situation down there?',
      act: () => (surveyed
        ? `${pl.record.name} traffic desk: “${info.typeLabel}, pop ${info.population}, ${info.gravity}g, ${info.atmosphere}. No surprises worth filing.”`
        : `${pl.record.name} traffic desk: “We publish nothing to strangers. Fly close and read us yourself.”`),
    });
    opts.push({
      label: 'Ask about trade',
      say: 'What do you sell, and what are you short of?',
      act: () => {
        const prod = (info.resources.length ? info.resources.join(', ') : 'nothing in particular');
        return `Trade desk: “We move ${prod}. We are always short of medicine, electronics and anything flown in by somebody else.”`;
      },
    });
    opts.push({
      label: 'Request landing',
      say: 'Requesting a landing vector.',
      act: () => 'Odds are you want the orbital berth rather than the weather — press E at a station to dock.',
    });
    opts.push({ label: 'Sign off', say: `Thank you, ${pl.record.name}.`, act: () => null });
    return opts;
  }

  _hailReply(s, rep, flag) {
    const rng = Math.random();
    if (s.disabled) return 'A crackle, then a thin voice: “Our drives are dead. Whatever you are going to do, do it.”';
    if (s.surrendered) return 'A tired voice: “We have struck. We are not moving. Please.”';
    if (s.role === 'pirate' || s.role === 'bounty') {
      const pool = HAILS.pirate || [];
      return pool.length ? pool[Math.floor(rng * pool.length)] : '“You are in the wrong lane to be talking.”';
    }
    if (s.role === 'navy') {
      return rep <= HOSTILE_REP
        ? `${flag} patrol: “We have your transponder flagged, captain. This conversation is now a warning.”`
        : `${flag} patrol: “Lanes are clear this watch. Keep your speed down and your manifest honest.”`;
    }
    if (s.role === 'trader') return 'A hauler, distracted: “If you are selling, talk fast. If you are buying, talk faster.”';
    if (s.role === 'house') return 'A House captain, formally: “Your name is noted, captain. State your business or end the transmission.”';
    return 'Static, then a bored voice: “Acknowledged. Nothing to report.”';
  }

  _demandSurrender(s, canOrder, flag) {
    if (s.surrendered) return 'They have already struck their colours.';
    if (!canOrder) {
      return `${s.name} answers with a laugh and a ranging shot: “Come and take it.”`;
    }
    if (s.bountyMissionId) {
      return `${s.name}, flatly: “There is a warrant in my name either way. I will take my chances.” They do not stand down.`;
    }
    const cowed = s.role === 'trader' || s.role === 'courier' || s.role === 'pirate';
    if (!cowed && Math.random() < 0.45) {
      return `${s.name}, coldly: “A snare is not a victory, captain.” They will not stand down — finish it or leave.`;
    }
    this.ctx.actions.surrender(s);
    return `${s.name}: “…understood. We are striking our colours. Do not fire.”`;
  }

  _hasWrit(ctx, station) {
    const state = ctx.state;
    const done = (state.missionsDone || 0) > 0;
    return done && !!state.missions?.length;
  }
}
