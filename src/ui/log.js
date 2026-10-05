// Ship's log & codex: mission details, career record and data-bank briefs
// on every system, planet, station and hull in the lanes. Rendered both in
// the star-chart overlay and (reduced) as a dock tab.

import { el } from './dom.js';
import { SYSTEMS } from '../data/systems.js';
import { SHIPS } from '../data/ships.js';
import { FACTIONS, isFaction, factionLabel } from '../data/factions.js';
import { formatDeadline } from '../core/util.js';
import { planetInfo, formatPopulation } from '../game/planetSurvey.js';
import { levelFromXp, karmaLabel, KARMA_ACTS, karmaActCost, karmaActBlock, karmaActFaction } from '../game/skills.js';
import { backgroundOf, driveOf } from '../game/character.js';
import { MISSION_TAGS, tierStars, missionProgress, deskHint } from '../game/missions.js';
import { STORY_LINES } from '../game/story.js';
import { SIDE_BY_ID } from '../game/sidequests.js';

const kv = (k, v, color = null) => el('div', { class: 'kv' }, [
  el('span', { text: k }),
  el('b', { style: color ? `color:${color}` : '', text: String(v) }),
]);

function section(title, note = null) {
  const s = el('div', { class: 'panel' }, [el('h2', { text: title })]);
  if (note) s.append(el('p', { class: 'note', text: note }));
  return s;
}

/**
 * Karma: what you are known as, the ledger behind it, and the acts that move
 * it. A captain can lean on their own name here — money and medicine one way,
 * drink and guns the other — a few times a day, at a rising price.
 */
export function karmaPanel(state, actions) {
  const box = el('div', { class: 'karma-panel' });
  box.append(el('p', {
    class: 'note',
    style: 'margin:8px 0 4px',
    text: `Known as “${karmaLabel(state.karma || 0)}”. Karma drifts with what you do out there, and a captain can also work on it directly — each act below costs credits (or cargo), may be done a few times a day, and gets dearer with every repeat.`,
  }));
  for (const act of KARMA_ACTS) {
    const block = karmaActBlock(state, act.id);
    const cost = karmaActCost(state, act);
    const fid = karmaActFaction(state, act);
    const price = cost > 0 ? `₡${cost.toLocaleString()}` : act.cargo ? `${act.cargo.qty} × ${act.cargo.id}` : 'free';
    const btn = el('button', {
      class: `btn small ${act.delta > 0 ? '' : 'danger'}`,
      type: 'button',
      text: 'Do it',
      title: block || `Pay ${price}`,
    });
    btn.disabled = !!block || !actions?.karmaAct;
    btn.addEventListener('click', () => actions?.karmaAct?.(act.id));
    box.append(el('div', { class: 'karma-act' }, [
      el('div', { class: 'ktext' }, [
        el('div', {
          class: 'kname',
          text: `${act.name} · ${price}${fid ? ` · ${FACTIONS[fid]?.name || fid} +${act.rep}` : ''}`,
        }),
        el('div', { class: 'kblurb', text: block || act.blurb }),
      ]),
      el('span', { class: `kdelta ${act.delta > 0 ? 'up' : 'down'}`, text: `${act.delta > 0 ? '+' : ''}${act.delta} karma` }),
      btn,
    ]));
  }
  const log = state.karmaLog || [];
  if (log.length) {
    const list = el('div', { class: 'karma-log' });
    list.append(el('div', { class: 'kname', text: 'What moved it lately' }));
    for (const e of log.slice(0, 6)) {
      list.append(el('div', { class: 'krow' }, [
        el('span', { text: `day ${e.day}` }),
        el('span', { class: e.delta > 0 ? 'kup' : 'kdown', text: `${e.delta > 0 ? '+' : ''}${e.delta}` }),
        el('span', { text: e.reason }),
      ]));
    }
    box.append(list);
  }
  return box;
}

/* ------------------------------------------------------------------ */
/* Mission log                                                        */
/* ------------------------------------------------------------------ */

export function missionCard(state, m) {
  const line = m.story ? STORY_LINES[m.story.line] : null;
  const sideQ = m.side ? SIDE_BY_ID[m.side.group] : null;
  // a flag's own work wears the flag's colours here too, not just on the board
  const flagLine = !line && !sideQ && m.line ? FACTIONS[m.line.faction] : null;
  const tag = line ? `${line.name} · CH ${m.story.chapter}`
    : sideQ ? `${sideQ.name} · step ${m.side.step + 1}/${sideQ.steps.length}`
      : flagLine ? `${flagLine.short.toUpperCase()} LINE`
        : (MISSION_TAGS[m.type] || 'CONTRACT');
  const attrs = { class: `mission ${m.type}` };
  if (line) attrs.style = `--mcol: ${line.color}`;
  else if (sideQ) attrs.style = `--mcol: ${sideQ.color}`;
  else if (flagLine) attrs.style = `--mcol: ${flagLine.color}`;
  const issuerSys = SYSTEMS[m.issuer?.systemId];
  const card = el('div', attrs, [
    el('div', {
      class: 'mtag',
      html: `${tag} · ${tierStars(m.tier)}${m.urgent ? ' · <span class="urgent">URGENT</span>' : ''} · ${formatDeadline(m.deadlineDay, state.day)}`,
    }),
    el('h4', { text: m.title }),
    el('div', { class: 'mwhere' }, [
      el('span', { class: 'mdest', text: `▸ ${SYSTEMS[m.dest.systemId]?.name || '—'}` }),
      el('span', { class: 'note', text: `issued at ${issuerSys ? issuerSys.name : '—'} · fee ₡${m.reward.toLocaleString()}` }),
    ]),
    el('p', { text: m.desc }),
  ]);
  const prog = missionProgress(m);
  if (prog) card.append(el('p', { class: 'note', style: 'color: var(--mcol, #8fd0ff)', text: prog }));
  if (m.cargoLoaded) card.append(el('p', { class: 'note', text: `In the hold: ${m.cargoLoaded.qty} × ${m.cargoLoaded.id}` }));
  // a flag's work: say where the line's next posting is handed over, so "and
  // then where do I go?" is answered without a trip to a board
  if (flagLine) {
    card.append(el('p', {
      class: 'note',
      html: `<span style="color:${flagLine.color}">${flagLine.name}</span> line — the next posting is handed over at their desks: ${deskHint(m.line.faction, state.systemId)}.`,
    }));
  }
  return card;
}

/* ------------------------------------------------------------------ */
/* Codex                                                              */
/* ------------------------------------------------------------------ */

function systemCard(id, sys) {
  const card = el('div', { class: 'panel', style: 'margin-bottom:10px' }, [
    el('h3', { text: `${sys.name} — ${sys.tagline}` }),
    kv('Government', isFaction(sys.gov) ? FACTIONS[sys.gov].name : sys.freefire ? 'No flag — free-fire' : 'No flag'),
    sys.freefire ? el('p', {
      class: 'note freefire-note',
      text: 'Free-fire ground: no flag, no writ. Any hull may be attacked or taken here and nothing is recorded against you for it.',
    }) : null,
    kv('Tech level', sys.tech),
    kv('Pirate activity', `${Math.round(sys.danger.pirates * 100)}%`),
    kv('Vigil presence', `${Math.round(sys.danger.navy * 100)}%`),
    el('p', { class: 'note', text: sys.desc }),
    el('p', {
      class: 'note',
      text: `Berths: ${sys.stations.map((s) => s.name).join(' · ')}`,
    }),
    el('p', {
      class: 'note',
      text: `Worlds: ${sys.planets.map((p) => p.name).join(' · ')}`,
    }),
  ]);
  return card;
}

function planetCard(state, rec) {
  const info = planetInfo(state, rec.name, rec);
  const surveyed = state.planets?.[rec.name];
  const card = el('div', { class: 'panel', style: 'margin-bottom:10px' }, [
    el('h3', {}, [
      rec.name,
      el('span', { class: 'chip', style: `margin-left:8px${surveyed ? ';color:#63ffc0' : ''}`, text: surveyed ? 'surveyed' : 'unsurveyed' }),
    ]),
    el('p', { class: 'note', text: `${info.typeLabel} · pop ${formatPopulation(info.population)} · ${info.gravity}g · ${info.atmosphere}` }),
    el('p', { class: 'note', text: `Resources: ${info.resources.join(', ')}` }),
    el('p', { style: 'font-size:12px', text: info.flavor }),
  ]);
  return card;
}

function stationCard(sys, stn) {
  return el('div', { class: 'panel', style: 'margin-bottom:10px' }, [
    el('h3', { text: stn.name }),
    el('p', { class: 'note', text: `${stn.type} · ${factionLabel(stn.owner)} · ${sys.name}` }),
    el('p', { style: 'font-size:12px', text: stn.desc || 'No public record — the berth keeps its own books.' }),
    el('p', { class: 'note', text: `Services: ${stn.services.join(', ')}` }),
  ]);
}

function acquisitionText(def, unlocked) {
  if (def.capture) {
    return 'Prize only — force a crew flying this hull to strike its colours, then claim the hulk in flight (C). Never sold anywhere.';
  }
  if (def.unique) {
    const line = STORY_LINES[def.unique];
    if (line) return `Licensed — walk the ${line.name} story path, then order one at a shipyard.`;
    const chain = SIDE_BY_ID[def.unique];
    if (chain) return `Won — finish the “${chain.name}” chain, then order one at a shipyard.`;
    return 'Licensed — earned through a story path, then order one at a shipyard.';
  }
  if (def.yards) {
    const where = def.yards.map((id) => SYSTEMS[id]?.name || id).join(' and ');
    return `Built to order — stocked only at the ${where} yards.`;
  }
  if (def.yard === 'capital') {
    return `A great keel — ordered only at the great ports (tech ${def.minTech || 10}), and never stock in numbers. Most hulls of this class are seen once, at a distance.`;
  }
  return `On sale at shipyards with tech ${def.minTech || 0} or better.`;
}

function shipCard(def, state, unlocked) {
  const known = unlocked.has(def.id) || !!state.sighted?.[def.id] || state.shipId === def.id;
  if (!known) {
    return el('div', { class: 'panel', style: 'margin-bottom:10px;opacity:0.7' }, [
      el('h3', { text: 'Unrecorded hull' }),
      el('p', { class: 'note', text: 'No sighting on record. Something flies this design out in the lanes — see it on patrol, in a shipyard’s slips, or over a prize crew’s shoulder, and the codex fills in.' }),
    ]);
  }
  const price = def.capture ? 'not for sale — prize only'
    : def.price ? `₡${def.price.toLocaleString()}` : 'issued to new pilots';
  const sight = state.sighted?.[def.id];
  const chip = def.unique && unlocked.has(def.id)
    ? el('span', { class: 'chip', style: 'margin-left:8px;color:#ffd166', text: 'licensed' })
    : def.capture ? el('span', { class: 'chip', style: 'margin-left:8px;color:#ff9a70', text: 'prize ship' }) : null;
  const card = el('div', { class: 'panel', style: 'margin-bottom:10px' }, [
    el('h3', {}, [def.name, chip]),
    kv('Class', def.cls),
    kv('Price', price),
    kv('Acquired', acquisitionText(def, unlocked)),
    kv('Hull / Shield', `${def.hull} / ${def.shield}`),
    kv('Mounts (max) / bays (max)', `${def.mounts ?? 2} (${def.maxMounts ?? def.mounts ?? 2}) / ${def.bays ?? 0} (${def.maxBays ?? def.bays ?? 0})`),
    kv('Hold', `${def.cargo}t`),
    sight ? kv('First sighted', `day ${sight.day} · ${SYSTEMS[sight.systemId]?.name || sight.systemId}`) : null,
    el('p', { style: 'font-size:12px', text: def.desc }),
  ]);
  return card;
}

/* ------------------------------------------------------------------ */
/* Builder                                                            */
/* ------------------------------------------------------------------ */

export function buildLog(state, { style = '', missionLog = true, actions = null } = {}) {
  const wrap = el('div', {
    class: 'logwrap',
    style: `display:flex;flex-direction:column;gap:14px;overflow:auto;padding-right:8px;${style}`,
  });

  // ---- active contracts ----
  if (missionLog) {
    const missionsSec = section('Mission log', state.missions.length
      ? 'Everything on your manifest, with full briefs. Jobs can be dropped from the missions menu or the contracts board.'
      : 'Nothing signed right now. Boards at station bars and the missions menu carry work.');
    if (state.missions.length) {
      for (const m of state.missions) missionsSec.append(missionCard(state, m));
    } else {
      missionsSec.append(el('p', { class: 'note', text: '— manifest empty —' }));
    }
    missionsSec.append(el('p', {
      class: 'note',
      text: `Completed ${state.missionsDone || 0} · failed ${state.missionsFailed || 0} · day ${state.day}`,
    }));
    wrap.append(missionsSec);
  }

  // ---- your path ----
  const storySec = section('Your path', state.allegiance
    ? 'Your flag keeps one chain — written chapters, then steady work, then open-ended postings. The other flags\' branches are not your concern.'
    : 'No flag owns you yet. Run any flag\'s chapter-one opening to sign on — its whole chain becomes yours.');
  if (state.allegiance) {
    const flag = FACTIONS[state.allegiance];
    const myLine = Object.values(STORY_LINES).find((l) => l.faction === state.allegiance);
    const stage = state.factionLine?.faction === state.allegiance ? state.factionLine.stage : 0;
    const done = myLine && stage >= myLine.chapters.length;
    const status = myLine
      ? stage < myLine.chapters.length
        ? `${myLine.name} — chapter ${stage + 1} of ${myLine.chapters.length}`
        : `${myLine.name} written line complete — open-ended work continues`
      : `${flag?.name || state.allegiance} — open-ended work`;
    storySec.append(el('div', { style: `border-left:3px solid ${myLine?.color || flag?.color || '#9fb0c6'};padding-left:10px;margin:8px 0` }, [
      el('div', { class: 'kv' }, [
        el('span', { style: `color:${myLine?.color || flag?.color || '#9fb0c6'}`, text: myLine ? myLine.name : (flag?.name || state.allegiance) }),
        el('b', { text: status }),
      ]),
      el('p', { class: 'note', text: `Chain stage ${stage + 1}. Finish each posting to unlock the next at ${flag?.name || ''} desks.${done ? ' The written line is run out — the desk keeps the work coming, priced higher each time.' : ''}` }),
    ]));
  } else {
    for (const line of Object.values(STORY_LINES)) {
      storySec.append(el('div', { style: `border-left:3px solid ${line.color};padding-left:10px;margin:8px 0` }, [
        el('div', { class: 'kv' }, [
          el('span', { style: `color:${line.color}`, text: line.name }),
          el('b', { text: 'chapter 1 — sign on' }),
        ]),
        el('p', { class: 'note', text: line.blurb }),
      ]));
    }
  }
  wrap.append(storySec);

  // ---- captain's record ----
  const rec = section("Captain's record");
  const lvl = levelFromXp(state.xp || 0);
  const bg = backgroundOf(state);
  const drive = driveOf(state);
  rec.append(
    kv('Commander', state.commander),
    kv('Background', bg ? `${bg.name}${bg.role ? ` — ${bg.role}` : ''}` : '—'),
    kv('Signature', bg?.signature?.name || '—'),
    kv('Drive', drive?.name || '—'),
    kv('Level / XP', `${lvl} · ${state.xp || 0} xp`),
    kv('Karma', `${state.karma > 0 ? '+' : ''}${state.karma || 0} — ${karmaLabel(state.karma || 0)}`),
    kv('Skill points unspent', state.skillPoints || 0),
    kv('Ship', state.shipName || '—'),
    kv('Record', `${state.stats.kills} raiders · ${state.stats.navyKills} patrols · ${state.stats.traderKills} traders · ${state.stats.deaths} deaths · ${state.stats.jumps} jumps`),
    kv('Prizes taken', state.stats.prizes || 0),
  );
  const repRow = el('div', { class: 'chips', style: 'margin-top:6px' });
  for (const [fid, f] of Object.entries(FACTIONS)) {
    const rep = state.rep[fid] ?? 0;
    repRow.append(el('span', {
      class: 'chip',
      style: `color:${f.color}`,
      text: `${f.name} ${rep >= 0 ? '+' : ''}${rep}`,
    }));
  }
  rec.append(repRow);
  rec.append(karmaPanel(state, actions));
  wrap.append(rec);

  // ---- codex ----
  const sysSec = section('Codex · Systems', 'Briefs on every charted system in the Ten and beyond.');
  for (const [id, sys] of Object.entries(SYSTEMS)) sysSec.append(systemCard(id, sys));
  wrap.append(sysSec);

  const planetSec = section('Codex · Planets', 'Dossiers compile from survey data — scan a world up close to file your own.');
  for (const sys of Object.values(SYSTEMS)) {
    for (const rec2 of sys.planets) planetSec.append(planetCard(state, rec2));
  }
  wrap.append(planetSec);

  const stnSec = section('Codex · Stations');
  for (const sys of Object.values(SYSTEMS)) {
    for (const stn of sys.stations) stnSec.append(stationCard(sys, stn));
  }
  wrap.append(stnSec);

  const shipSec = section('Codex · Ships', 'Hulls seen in the lanes. Licensed hulls appear in shipyards once their path is walked.');
  const unlocked = new Set(state.story?.unlocked || []);
  const seenCount = SHIPS.filter((d) => unlocked.has(d.id) || state.sighted?.[d.id] || state.shipId === d.id).length;
  shipSec.append(el('p', { class: 'note', text: `Hulls sighted ${seenCount}/${SHIPS.length} — patrol the lanes, visit shipyard slips, and take prizes to fill the ledger.` }));
  for (const def of SHIPS) shipSec.append(shipCard(def, state, unlocked));
  wrap.append(shipSec);

  return wrap;
}
