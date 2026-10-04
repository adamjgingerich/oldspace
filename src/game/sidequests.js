// ---------------------------------------------------------------------------
// Side quests: many small chains, not the main story. Each group is 2-3 steps
// long and opens up from who the pilot is (background, drive), what they have
// learned (skills — your "interests"), where they stand (faction rep), or
// simply because a stranger left a note at the right bar on the right day.
// Finishing a whole chain grants a small permanent perk and a purse.
// ---------------------------------------------------------------------------

import { levelFromXp, treeRanks, skillRank, addKarma } from './skills.js';
import { ensureStory } from './story.js';
import { rngOf } from '../core/rng.js';

/** Shared filler destinations so chains can reuse lanes. */
const LANES = ['haven', 'coriolis', 'meridian', 'brasstide', 'sunward', 'doldrums', 'rusthaven', 'ashfall', 'vesper', 'vekta'];

export const SIDE_QUESTS = [
  /* ---------------- interests: what the pilot has learned --------------- */
  {
    id: 'broker', name: "The Broker's Test", color: '#ffc857', requires: { skills: { haggler: 2 } },
    steps: [
      { title: 'A Sample Run', desc: 'A broker has heard you can make a deadline. Carry a sample case to Meridian and do not open it.', objective: { type: 'courier', dest: 'meridian', cargo: { id: 'electronics', qty: 1 } }, reward: 900 },
      { title: 'The Regular Line', desc: 'The sample impressed. Now run eight crates of machinery to Brasstide and keep the invoice clean.', objective: { type: 'delivery', dest: 'brasstide', cargo: { id: 'machinery', qty: 8 } }, reward: 2400 },
      { title: 'Audit by Salvage', desc: 'A rival skimmed the take and vanished into Rusthaven. Recover the recorder pods and the broker considers you made.', objective: { type: 'recovery', dest: 'rusthaven', pods: 2 }, reward: 4200 },
    ],
    finale: { mods: { sell: 0.03 }, unlock: ['magnate'], rewards: ['Sale prices +3% — the broker’s rates', 'the Magnate yacht licensed at shipyards'] },
  },
  {
    id: 'salvage', name: 'Wreck Diver', color: '#63ffc0', requires: { skills: { salvager: 1 } },
    steps: [
      { title: 'First Dive', desc: 'A wrecker out of Coriolis pays by the pod. Pull two black boxes from the Ashfall graves and bring them home.', objective: { type: 'recovery', dest: 'ashfall', pods: 2 }, reward: 1100 },
      { title: 'Deep Field', desc: 'The good wrecks drifted further in. Three more pods, this time off Vek’Tal.', objective: { type: 'recovery', dest: 'vekta', pods: 3 }, reward: 2800 },
      { title: 'The Buyout', desc: 'Someone wants you off the wrecks — carry the sealed buyout to Doldrums and let the Wreckers read it themselves.', objective: { type: 'courier', dest: 'doldrums', cargo: { id: 'electronics', qty: 1 } }, reward: 3600 },
    ],
    finale: { mods: { podCredits: 0.15 }, rewards: ['Salvage value +15% — a wrecker’s eye'] },
  },
  {
    id: 'gunhand', name: "The Gunhand's Round", color: '#ff5f7a', requires: { skills: { trigger: 2 } },
    steps: [
      { title: 'Prove the Trigger', desc: 'A fixer keeps a list of names with prices beside them. Take the first one — a raider working the Haven lanes.', objective: { type: 'bounty', dest: 'haven', target: { name: 'Pell the Quiet', shipId: 'corsair', kind: 'pirate', escorts: 0, hullMult: 1.25, shieldMult: 1.2 } }, reward: 1600 },
      { title: 'Clear the Bench', desc: 'The fixer’s rivals are laughing. Put down two raiders over Coldvane so the laugh stops.', objective: { type: 'sweep', dest: 'coldvane', foe: 'pirate', kills: 2 }, reward: 2600 },
      { title: 'The Name Job', desc: 'One last name, larger than the rest. A war-cutter captain, alone but never lonely. End it.', objective: { type: 'bounty', dest: 'meridian', target: { name: 'Hesta Vane', shipId: 'voskar', kind: 'pirate', escorts: 1, hullMult: 1.35, shieldMult: 1.3 } }, reward: 5200 },
    ],
    finale: { mods: { killLoot: 0.08 }, unlock: ['thorn'], rewards: ['Kill drops +8% — the fixer’s cut, redirected', 'the Thorn duellist licensed at shipyards'] },
  },
  {
    id: 'helm', name: 'Ghost of the Lanes', color: '#56e6ff', requires: { skills: { piloting: 3 } },
    steps: [
      { title: 'The Fast Lane', desc: 'A courier outfit is testing a new kind of pilot. Beat the clock to Vesper Gate and don’t scratch the case.', objective: { type: 'courier', dest: 'vesper', cargo: { id: 'medicine', qty: 1 } }, reward: 1200 },
      { title: 'Return Leg', desc: 'Back across the same lanes, no autopilot stories, no excuses. Coriolis this time.', objective: { type: 'courier', dest: 'coriolis', cargo: { id: 'electronics', qty: 1 } }, reward: 2000 },
      { title: 'Prove It in Anger', desc: 'Speed means nothing if you cannot stay alive. Break two raiders out of the lane to K’ratha.', objective: { type: 'sweep', dest: 'kratha', foe: 'pirate', kills: 2 }, reward: 4200 },
    ],
    finale: { mods: { dmgTaken: 0.05 }, unlock: ['silverwing'], rewards: ['Damage taken −5% — you fly like weather', 'the Silverwing racing hull licensed at shipyards'] },
  },
  {
    id: 'quiet', name: 'The Quiet Stars', color: '#a58cff', requires: { skills: { lanesense: 2 } },
    steps: [
      { title: 'First Readings', desc: 'A survey office likes your lane sense. Take fresh readings at Brasstide and file them.', objective: { type: 'survey', dest: 'brasstide' }, reward: 1000 },
      { title: 'The Second Hour', desc: 'The same office wants the same skies, one hour later. Space is not empty; somebody wants to prove it.', objective: { type: 'survey', dest: 'vesper' }, reward: 1800 },
      { title: 'The Silent Wreck', desc: 'The readings point at debris nobody logged. Recover two recorder pods from Doldrums and hear what they say.', objective: { type: 'recovery', dest: 'doldrums', pods: 2 }, reward: 4000 },
    ],
    finale: { mods: { survey: 0.1, podCredits: 0.05 }, rewards: ['Survey bounties +10%', 'Salvage value +5%'] },
  },
  {
    id: 'windfall', name: 'Windfall Season', color: '#8fd0ff', requires: { skills: { windfall: 2 } },
    steps: [
      { title: 'The Overflow Crate', desc: 'A good month left crates homeless. Take six to Sunward before the shippers notice.', objective: { type: 'delivery', dest: 'sunward', cargo: { id: 'grain', qty: 6 } }, reward: 1000 },
      { title: 'The Salvage Window', desc: 'A freighter shed cargo in a bad burn over Ashfall. Two pods are still talking — recover them before the drift does.', objective: { type: 'recovery', dest: 'ashfall', pods: 2 }, reward: 2400 },
      { title: 'The Last Favour', desc: 'The shippers call you their lucky charm now. Ten crates to Vesper Gate and the books balance.', objective: { type: 'delivery', dest: 'vesper', cargo: { id: 'textiles', qty: 10 } }, reward: 4200 },
    ],
    finale: { mods: { contract: 0.04 }, rewards: ['Contract pay +4% — lucky is a reputation'] },
  },
  {
    id: 'frontier', name: 'Frontier Medicine', color: '#63ffc0', requires: { skills: { grit: 2 } },
    steps: [
      { title: 'The Cold Run', desc: 'A frontier clinic is short on serum. Carry medicine to Rusthaven — the Wreckers will not steal what keeps them alive.', objective: { type: 'delivery', dest: 'rusthaven', cargo: { id: 'medicine', qty: 6 } }, reward: 1400 },
      { title: 'Second Clinic', desc: 'Word travels faster than ships. The Hollow wants the same, and pays in the only coin it has.', objective: { type: 'delivery', dest: 'doldrums', cargo: { id: 'medicine', qty: 8 } }, reward: 2600 },
      { title: 'The Return Case', desc: 'A doctor left notes in a crashed clinic runner. Recover the pods and the frontier keeps its doctor.', objective: { type: 'recovery', dest: 'kratha', pods: 2 }, reward: 4400 },
    ],
    finale: { mods: { repair: -0.05 }, rewards: ['Repair costs −5% — you know a doctor'] },
  },
  {
    id: 'hullbone', name: 'Hull and Bone', color: '#ff9a3c', requires: { skills: { patch: 2 } },
    steps: [
      { title: 'The Patch Job', desc: 'A berth mechanic bets your patchwork holds cargo. Haul six crates of ore off Coldvane to prove it.', objective: { type: 'delivery', dest: 'brasstide', cargo: { id: 'ore', qty: 6 } }, reward: 1200 },
      { title: 'Field Repairs', desc: 'A depot wrecked its own rescue cutter. Recover two pods from the ash around it.', objective: { type: 'recovery', dest: 'ashfall', pods: 2 }, reward: 2600 },
      { title: 'The Hard Contract', desc: 'The depot trusts your hands now. Two raiders are picking over their wrecks — run them off.', objective: { type: 'sweep', dest: 'ashfall', foe: 'pirate', kills: 2 }, reward: 4300 },
    ],
    finale: { mods: { dmgTaken: 0.05 }, unlock: ['theseus'], rewards: ['Damage taken −5% — careful hands, harder ship', 'the Theseus Amalgam licensed at shipyards'] },
  },

  /* ---------------- affiliation: where the pilot stands ----------------- */
  {
    id: 'vigil-aux', name: 'Auxiliary Duties', color: '#56e6ff', faction: 'vigil', requires: { rep: { vigil: 15 } },
    steps: [
      { title: 'Deputised', desc: 'The Watch is short of hulls and long on paperwork. Clear two raiders from the Hollow under their warrant.', objective: { type: 'sweep', dest: 'doldrums', foe: 'pirate', kills: 2 }, reward: 2200 },
      { title: 'The Writ Run', desc: 'Carry sealed writs to Meridian and do not read the names inside.', objective: { type: 'courier', dest: 'meridian', cargo: { id: 'electronics', qty: 2 } }, reward: 2400 },
      { title: 'The Long Patrol', desc: 'A name on the writ has a ship and a head start. Finish the Watch’s business over Sunward.', objective: { type: 'bounty', dest: 'sunward', target: { name: 'Rovan Sash', shipId: 'corsair', kind: 'pirate', escorts: 1, hullMult: 1.3, shieldMult: 1.25 } }, reward: 5000 },
    ],
    finale: { mods: { contract: 0.04 }, rep: 8, rewards: ['Contract pay +4%', 'Vigil standing +8'] },
  },
  {
    id: 'clan-debt', name: 'A Debt in the Black', color: '#ff5f7a', faction: 'reaver', requires: { rep: { reaver: 15 } },
    steps: [
      { title: 'The Introduction', desc: 'You owe someone a favour and the Clans collect in person. Run a case to Culragh, no manifest, no pause.', objective: { type: 'courier', dest: 'doldrums', cargo: { id: 'medicine', qty: 2 } }, reward: 2400 },
      { title: 'Interest, Compounded', desc: 'The favour grew. Break two Vigil patrols over Rusthaven and the ledger turns a page.', objective: { type: 'sweep', dest: 'rusthaven', foe: 'navy', kills: 2 }, reward: 4600 },
      { title: 'The Last Name', desc: 'One name remains on the page — a patrol commander working the Coriolis approach. Close the book.', objective: { type: 'bounty', dest: 'coriolis', target: { name: 'Commander Vale Ost', shipId: 'halcyon', kind: 'vigil', escorts: 1, hullMult: 1.3, shieldMult: 1.25 } }, reward: 6400, karma: -4 },
    ],
    finale: { mods: { illegalSell: 0.08 }, rep: 8, rewards: ['Contraband prices +8%', 'Clan standing +8'] },
  },
  {
    id: 'margin', name: 'The Margin Run', color: '#ffc857', faction: 'combine', requires: { rep: { combine: 15 } },
    steps: [
      { title: 'The Starter Order', desc: 'A Combine factors’ office wants a fixture on the Sunward line. Ten crates of grain, unhurried, undamaged.', objective: { type: 'delivery', dest: 'sunward', cargo: { id: 'grain', qty: 10 } }, reward: 2200 },
      { title: 'The Second Leg', desc: 'The office likes fixtures. Twelve crates of ore to Coriolis and the margin doubles.', objective: { type: 'delivery', dest: 'coriolis', cargo: { id: 'ore', qty: 12 } }, reward: 3800 },
      { title: 'The Commission', desc: 'The senior factor needs a signature by tomorrow. Carry the dispatch to Meridian yourself — never the mail.', objective: { type: 'courier', dest: 'meridian', cargo: { id: 'electronics', qty: 1 } }, reward: 4600 },
    ],
    finale: { mods: { buy: -0.03 }, rep: 8, rewards: ['Buy prices −3%', 'Combine standing +8'] },
  },
  {
    id: 'kreth-bonds', name: 'Bonds of the Halls', color: '#e8a05a', faction: 'kreth', requires: { rep: { kreth: 15 } },
    steps: [
      { title: 'Wine for the Hall', desc: 'A House steward asks, politely, that the cellar not run dry. Four crates of Ancestral Wine to Vek’Tal.', objective: { type: 'delivery', dest: 'vekta', cargo: { id: 'wine', qty: 4 } }, reward: 2600 },
      { title: 'The Long Listening', desc: 'The Listening Stone records the Hollow’s quiet. Bring the readings back to K’ratha unopened.', objective: { type: 'survey', dest: 'doldrums' }, reward: 3200 },
      { title: 'A Matter of Cadence', desc: 'A raider broke a House courtesy on the Kratha road. The Houses require the matter settled — two hulls will do.', objective: { type: 'sweep', dest: 'kratha', foe: 'pirate', kills: 2 }, reward: 5200 },
    ],
    finale: { mods: { contract: 0.05 }, rep: 8, rewards: ['Contract pay +5% — the Houses speak well of you', 'Kreth standing +8'] },
  },

  /* ---------------- beginnings: who the pilot was ----------------------- */
  {
    id: 'family-route', name: 'The Family Route', color: '#ffc857', requires: { background: 'hauler' },
    steps: [
      { title: 'The First Haul', desc: 'Your family ran this lane before you could reach the pedals. Ten crates to Ashfall, same as they did.', objective: { type: 'delivery', dest: 'ashfall', cargo: { id: 'machinery', qty: 10 } }, reward: 1300 },
      { title: 'The Old Customer', desc: 'A customer from the old days still remembers the name. Six crates to Rusthaven, no shortcuts.', objective: { type: 'delivery', dest: 'rusthaven', cargo: { id: 'textiles', qty: 6 } }, reward: 2200 },
      { title: 'The Ledger Debt', desc: 'A debt from the family books went bad in the Hollow. Collect what is owed — the pods mark the spot.', objective: { type: 'recovery', dest: 'doldrums', pods: 2 }, reward: 3800 },
    ],
    finale: { mods: { contract: 0.03 }, rewards: ['Contract pay +3% — the name still carries'] },
  },
  {
    id: 'commission', name: 'The Commission', color: '#56e6ff', requires: { background: 'cadet' },
    steps: [
      { title: 'Holding Pattern', desc: 'Your old training cadre flies the Vesper run. Keep their anchorages quiet — two raiders, no ceremony.', objective: { type: 'sweep', dest: 'vesper', foe: 'pirate', kills: 2 }, reward: 1900 },
      { title: 'The Old Instructor', desc: 'An instructor from the academy went pirate and knows your every habit. Fly better than you were taught.', objective: { type: 'bounty', dest: 'coldvane', target: { name: 'Instructor Marr', shipId: 'sparrowhawk', kind: 'pirate', escorts: 0, hullMult: 1.3, shieldMult: 1.25 } }, reward: 3400 },
      { title: 'The Graduation', desc: 'The cadre names one last demonstration: clear the lane over Haven and your commission is spoken of in the present tense.', objective: { type: 'sweep', dest: 'haven', foe: 'pirate', kills: 2 }, reward: 4800 },
    ],
    finale: { mods: { dmgTaken: 0.05 }, rewards: ['Damage taken −5% — old drills, new habits'] },
  },
  {
    id: 'old-crew', name: 'Salt of the Old Crew', color: '#ff5f7a', requires: { background: 'reaver' },
    steps: [
      { title: 'The Wake', desc: 'The old crew is drinking in the Hollow and waiting on you. Bring the case they left for you at Haven.', objective: { type: 'courier', dest: 'doldrums', cargo: { id: 'medicine', qty: 2 } }, reward: 2200 },
      { title: 'The Grudge', desc: 'A patrol captain from the old days still flies the corridor. The crew asks you to remind him of the name.', objective: { type: 'sweep', dest: 'haven', foe: 'navy', kills: 2 }, reward: 4200 },
      { title: 'The Last Round', desc: 'The crew scatters after this one. Recover two pods from the wreck they left off Kratha and bury the log with them.', objective: { type: 'recovery', dest: 'kratha', pods: 2 }, reward: 4400 },
    ],
    finale: { mods: { killLoot: 0.05 }, rewards: ['Kill drops +5% — old crew, old habits'] },
  },
  {
    id: 'long-chart', name: 'The Long Chart', color: '#a58cff', requires: { background: 'surveyor' },
    steps: [
      { title: 'The First Sheet', desc: 'Your old survey office has a backlog of unverified sheets. Check the Brasstide readings yourself.', objective: { type: 'survey', dest: 'brasstide' }, reward: 1100 },
      { title: 'The Margin Notes', desc: 'Somebody else’s handwriting keeps appearing in the margins. Verify the Sunward sheet.', objective: { type: 'survey', dest: 'sunward' }, reward: 2100 },
      { title: 'The Author', desc: 'The handwriting belongs to a surveyor who went quiet. Their last pod is still transmitting off Rusthaven.', objective: { type: 'recovery', dest: 'rusthaven', pods: 2 }, reward: 4200 },
    ],
    finale: { mods: { survey: 0.12 }, rewards: ['Survey bounties +12% — the chart is yours now'] },
  },
  {
    id: 'field-trials', name: 'Field Trials', color: '#8fd0ff', requires: { background: 'engineer' },
    steps: [
      { title: 'The Test Article', desc: 'A yard wants data on a new coupling. Ten crates of machinery to Vek’Tal, gently, as usual.', objective: { type: 'delivery', dest: 'vekta', cargo: { id: 'machinery', qty: 10 } }, reward: 1500 },
      { title: 'The Failure Mode', desc: 'The coupling failed on the return trip of another crew. Recover two pods and bring the truth home.', objective: { type: 'recovery', dest: 'doldrums', pods: 2 }, reward: 3000 },
      { title: 'The Redesign', desc: 'The yard rebuilt it and wants it delivered by someone who understands it. One case, Vesper Gate, and the drawings go with it.', objective: { type: 'courier', dest: 'vesper', cargo: { id: 'electronics', qty: 2 } }, reward: 4200 },
    ],
    finale: { mods: { repair: -0.05 }, rewards: ['Repair costs −5% — yard rates for yard hands'] },
  },
  {
    id: 'formation', name: 'The Old Formation', color: '#ff9a3c', requires: { background: 'marine' },
    steps: [
      { title: 'Kit Inspection', desc: 'Your old boarding crew is mustering for one last sweep. Put down two raiders over Ashfall with them.', objective: { type: 'sweep', dest: 'ashfall', foe: 'pirate', kills: 2 }, reward: 1900 },
      { title: 'The Breach', desc: 'A raider captain keeps a trophy from an old boarding action. The crew wants it back — take it off his hull.', objective: { type: 'bounty', dest: 'rusthaven', target: { name: 'Sarn Bloodwake', shipId: 'corsair', kind: 'pirate', escorts: 1, hullMult: 1.3, shieldMult: 1.25 } }, reward: 3800 },
      { title: 'Last Sweep', desc: 'The crew disbands after this one. Clear the Hollow lane one last time and the muster closes with honors.', objective: { type: 'sweep', dest: 'doldrums', foe: 'pirate', kills: 3 }, reward: 5200 },
    ],
    finale: { mods: { dmg: 0.03 }, rewards: ['Weapon damage +3% — the old formation never really left'] },
  },

  /* ---------------- random starts: strangers with a request ------------- */
  {
    id: 'heirloom', name: 'The Heirloom', color: '#ffc857', requires: { chance: 0.22 },
    steps: [
      { title: 'A Stranger’s Case', desc: 'Someone at the bar slides a case across and leaves before you can refuse. The address is in Meridian.', objective: { type: 'courier', dest: 'meridian', cargo: { id: 'electronics', qty: 1 } }, reward: 1200 },
      { title: 'The Collector', desc: 'The case was one of three, and the others went to ground with a collector who collects too well. Find them over Coldvane.', objective: { type: 'bounty', dest: 'coldvane', target: { name: 'The Collector', shipId: 'vagrant', kind: 'pirate', escorts: 1, hullMult: 1.4, shieldMult: 1.2 } }, reward: 3600 },
      { title: 'The Third Case', desc: 'The last case sits in a wreck off Vek’Tal, still sealed. Bring it to Kratha without opening it — the address insists.', objective: { type: 'courier', dest: 'kratha', cargo: { id: 'medicine', qty: 1 } }, reward: 4400 },
    ],
    finale: { mods: { contract: 0.03 }, rewards: ['Contract pay +3% — you kept a promise to no one in particular'] },
  },
  {
    id: 'letters', name: 'Letters from Nowhere', color: '#a58cff', requires: { chance: 0.2 },
    steps: [
      { title: 'The First Letter', desc: 'A courier pouch has been chasing you across three systems. Deliver it where it asks — no questions, the postage is paid.', objective: { type: 'courier', dest: 'brasstide', cargo: { id: 'electronics', qty: 1 } }, reward: 1300 },
      { title: 'The Reply', desc: 'A reply pouch is waiting, addressed to nobody. Someone wants readings taken at a dead star’s edge in the Hollow.', objective: { type: 'survey', dest: 'doldrums' }, reward: 2600 },
      { title: 'The Last Page', desc: 'The letters point at a courier wreck off Sunward. Recover its recorder pods and read the ending yourself.', objective: { type: 'recovery', dest: 'sunward', pods: 2 }, reward: 4600 },
    ],
    finale: { mods: { podCredits: 0.08 }, rewards: ['Salvage value +8% — you kept every page'] },
  },
  {
    id: 'wager', name: 'The Bar Wager', color: '#ff5f7a', requires: { chance: 0.18, level: 3 },
    steps: [
      { title: 'The Stakes', desc: 'A wager, loudly made: one name off the wanted lists over Haven before the bar closes the book.', objective: { type: 'bounty', dest: 'haven', target: { name: 'Lucky Ives', shipId: 'sparrowhawk', kind: 'pirate', escorts: 0, hullMult: 1.25, shieldMult: 1.2 } }, reward: 1800 },
      { title: 'Double or Nothing', desc: 'The book doubled itself and so did the debt. Clear three raiders from the Sunward run and the bar drinks free.', objective: { type: 'sweep', dest: 'sunward', foe: 'pirate', kills: 3 }, reward: 5200 },
    ],
    finale: { mods: { killLoot: 0.06 }, rewards: ['Kill drops +6% — the bar tells the story for you'] },
  },
  {
    id: 'relic', name: 'A Relic’s Worth', color: '#8fd0ff', requires: { chance: 0.16 },
    steps: [
      { title: 'The Appraisal', desc: 'A junk dealer swears a wreck is an antique. Pull two pods from the Ashfall graves and settle the argument.', objective: { type: 'recovery', dest: 'ashfall', pods: 2 }, reward: 1400 },
      { title: 'The Buyer', desc: 'The pods say the wreck was no antique — it was a courier with secrets. Carry the sealed findings to Rusthaven.', objective: { type: 'courier', dest: 'rusthaven', cargo: { id: 'electronics', qty: 1 } }, reward: 2600 },
      { title: 'The Provenance', desc: 'The buyer wants provenance. Take readings at the wreck’s last position off Vek’Tal and the price triples.', objective: { type: 'survey', dest: 'vekta' }, reward: 4000 },
    ],
    finale: { mods: { sell: 0.02 }, rewards: ['Sale prices +2% — you know what junk is worth now'] },
  },

  /* ---------------- the newer beginnings -------------------------------- */
  {
    id: 'ward-bond', name: 'The House Remembers', color: '#e8a05a', requires: { background: 'ward' },
    steps: [
      { title: 'A Token to the Stone', desc: 'A House steward asks the oath-child to carry a token to The Listening Stone. Wrapped, weighted, and not for your eyes.', objective: { type: 'courier', dest: 'doldrums', cargo: { id: 'medicine', qty: 1 } }, reward: 2100 },
      { title: 'The Quiet Readings', desc: 'The Listening Stone wants the Hollow read by an oath-child, not a hired clerk. Take the survey yourself.', objective: { type: 'survey', dest: 'doldrums' }, reward: 3000 },
      { title: 'A Matter of Cadence', desc: 'A House blade was insulted on the Kratha road. The cadence you learned as a child still remembers what to do.', objective: { type: 'sweep', dest: 'kratha', foe: 'pirate', kills: 2 }, reward: 5000 },
    ],
    finale: { mods: { dmgTaken: 0.04 }, rewards: ['Damage taken −4% — the duelling cadence stays with you'] },
  },
  {
    id: 'runner-lanes', name: 'Old Habits', color: '#8fd0ff', requires: { background: 'smuggler' },
    steps: [
      { title: 'The Off-Book Case', desc: 'A fence from the old days wants a case moved off the books — Culragh, as always, and nobody stamps it.', objective: { type: 'courier', dest: 'doldrums', cargo: { id: 'medicine', qty: 2 } }, reward: 2000 },
      { title: 'The Rival Runner', desc: 'A rival has been reading your old routes like a road map. Close the file over Coldvane.', objective: { type: 'bounty', dest: 'coldvane', target: { name: 'Sable the Quick', shipId: 'corsair', kind: 'pirate', escorts: 0, hullMult: 1.3, shieldMult: 1.25 } }, reward: 3600 },
      { title: 'The Dropped Load', desc: 'The last drop went into the rocks off Ashfall. Your old contacts want the pods recovered before the Wreckers read them.', objective: { type: 'recovery', dest: 'ashfall', pods: 2 }, reward: 4400 },
    ],
    finale: { mods: { illegalSell: 0.06 }, rewards: ['Contraband prices +6% — the old routes still pay'] },
  },
  {
    id: 'drift-salvage', name: 'The Drift Claims', color: '#63ffc0', requires: { background: 'drifter' },
    steps: [
      { title: 'Rock Sense', desc: 'A claim-jumper left working gear on a rock off Vek’Tal. Your old camp wants it back — pods first.', objective: { type: 'recovery', dest: 'vekta', pods: 2 }, reward: 1200 },
      { title: 'Deep Claim', desc: 'The good drift is further in and thinner on air. Three pods from the Ashfall field and the camp believes you.', objective: { type: 'recovery', dest: 'ashfall', pods: 3 }, reward: 2800 },
      { title: 'The Buyer’s Run', desc: 'The haul of a stubborn life needs an honest buyer. Take the ore to Coriolis, checked and weighed.', objective: { type: 'delivery', dest: 'coriolis', cargo: { id: 'ore', qty: 10 } }, reward: 3600 },
    ],
    finale: { mods: { podCredits: 0.1 }, rewards: ['Salvage value +10% — rock sense never leaves you'] },
  },

  /* ------------- longer tales: plots, punchlines and unique gear ------- */
  {
    id: 'hungryvoid', name: 'The Hungry Void', color: '#ffc857', requires: { level: 4 },
    steps: [
      { title: 'Table for One', desc: 'Haute Vessane, the Ten’s most feared restaurant critic, will judge the grill at Sunward in person. Deliver the tasting crate intact — and do not, under any circumstances, read the labels aloud.', objective: { type: 'delivery', dest: 'sunward', cargo: { id: 'luxuries', qty: 4 } }, reward: 1500 },
      { title: 'The Secret Ingredient', desc: 'The grill’s “aged void-sauce” has come up a cup short. Courier the sealed replacement from Coriolis, and politely decline the chef’s offer to explain what is in it.', objective: { type: 'courier', dest: 'coriolis', cargo: { id: 'medicine', qty: 1 } }, reward: 2600 },
      { title: 'Course Correction', desc: 'A rival kitchen has stolen the critic’s review copy to learn the sauce recipe. Recover the recorder pods from the wreck over Ashfall before the recipe goes public — the chef will pay extra for discretion, and extra again for the pods.', objective: { type: 'recovery', dest: 'ashfall', pods: 2 }, reward: 5200 },
    ],
    finale: {
      unlock: ['carver'], mods: { sell: 0.02 },
      rewards: ['Chef’s Carver now sold by mechanics — rated for both jobs', 'Sale prices +2% — you know a table that owes you'],
    },
  },
  {
    id: 'deadair', name: 'Dead Air Society', color: '#c0a0ff', requires: { chance: 0.22 },
    steps: [
      { title: 'The Late Show', desc: 'Somewhere off Vek’Tal a radio show has been broadcasting re-runs for nine years since its host died mid-sentence. The station manager wants the tape collection back before the anniversary special writes itself.', objective: { type: 'survey', dest: 'vekta' }, reward: 1800 },
      { title: 'Guest of Honour', desc: 'The signal is triangulating to a derelict relay in the Doldrums. Recover its recorder pods — all three, and yes, the one that is still talking counts.', objective: { type: 'recovery', dest: 'doldrums', pods: 3 }, reward: 4200 },
      { title: 'One More Number', desc: 'The master tape rode a courier that never made Brasstide. Bring it home and let the show finish its sentence.', objective: { type: 'courier', dest: 'brasstide', cargo: { id: 'electronics', qty: 1 } }, karma: 4, reward: 6800 },
    ],
    finale: {
      unlock: ['encore'],
      rewards: ['Encore now sold by mechanics — twin emitters, remastered', 'Karma +4 — you let the dead finish their sentence'],
    },
  },
  {
    id: 'flock', name: 'The Vesper Flock', color: '#d0ffe0', requires: { chance: 0.18, level: 3 },
    steps: [
      { title: 'Free-Range Orbit', desc: 'A gene-wool cooperative on Vesper lost a hundred head when the fence failed. They are in orbit now, in a state of cheerful disbelief. Clear the raiders circling the flock — the sheep will watch, and judge.', objective: { type: 'sweep', dest: 'vesper', foe: 'pirate', kills: 2 }, reward: 1700 },
      { title: 'The Wool Run', desc: 'The flock is home and opinionated, and the season’s first pressing cannot wait. Haul the wool to Meridian before the market does the softest thing it knows: nothing.', objective: { type: 'delivery', dest: 'meridian', cargo: { id: 'textiles', qty: 10 } }, reward: 3400 },
      { title: 'Bigger Predators', desc: 'A raider captain called Wex has discovered that sheep are easier to find than traders. Herd him the hard way. The cooperative will understand.', objective: { type: 'bounty', dest: 'kratha', target: { name: 'Wex the Wool-Grabber', shipId: 'corsair', kind: 'pirate', escorts: 1, hullMult: 1.25, shieldMult: 1.15 } }, reward: 7200 },
    ],
    finale: {
      unlock: ['shepherd'], mods: { killLoot: 0.05 },
      rewards: ['Shepherd Rack now sold by mechanics — for herding strays', 'Kill drops +5% — the cooperative tips well'],
    },
  },
  {
    id: 'cartographers', name: 'The Cartographers’ Revolt', color: '#a58cff', requires: { rep: { free: 12 } },
    steps: [
      { title: 'Survey the Strike', desc: 'The survey union at Haven is on strike because somebody reclassified their favourite moon as a “D-class debris aggregate”. File fresh readings as a neutral party — the moon is counting on you.', objective: { type: 'survey', dest: 'sunward' }, reward: 2000 },
      { title: 'The Petition', desc: 'Ninety-two pages, four appendices, one deeply aggrieved moon. Carry the petition to Coriolis and hand it to anyone who looks important enough to regret it.', objective: { type: 'delivery', dest: 'coriolis', cargo: { id: 'electronics', qty: 2 } }, reward: 3800 },
      { title: 'The Evidence', desc: 'The reclassification was argued from a survey that was, to put it gently, wrong. The original plates sit in a wreck field over Coldvane — a very cold, very factual wreck field.', objective: { type: 'recovery', dest: 'coldvane', pods: 3 }, reward: 6600 },
    ],
    finale: {
      unlock: ['archivist'], mods: { survey: 0.15 },
      rewards: ['Archivist Core now sold by mechanics — the union’s master ledger', 'Survey bounties +15% — the union files your paperwork first now'],
    },
  },
  {
    id: 'deeprock', name: 'The Deep Rock Grudge', color: '#ffb26e', requires: { level: 4, skills: { grit: 1 } },
    steps: [
      { title: 'Cave-In Report', desc: 'A shaft foreman on Vek’Tal lost her crew to a raider “accident” the company logs recorded as weather. Help her take her own readings of the shaft mouth — slowly, and correctly.', objective: { type: 'survey', dest: 'vekta' }, reward: 2100 },
      { title: 'The Paper Trail', desc: 'The company courier is carrying the altered logs. Break the raiders covering its route over Rusthaven and bring the black boxes straight to the foreman — no questions asked, several sarcastic ones permitted.', objective: { type: 'sweep', dest: 'rusthaven', foe: 'pirate', kills: 2 }, reward: 4300 },
      { title: 'Named in the Ledger', desc: 'The shift boss who signed the falsified report works the Ashfall lanes now, in a corsair the company swears it never sold him. The foreman would like the signature verified in person.', objective: { type: 'bounty', dest: 'ashfall', target: { name: 'Shift Boss Halloran', shipId: 'corsair', kind: 'pirate', escorts: 1, hullMult: 1.3, shieldMult: 1.2 } }, karma: 3, reward: 7800 },
    ],
    finale: {
      unlock: ['foreman'],
      rewards: ['Foreman’s Rig now sold by mechanics — deep-rock braced', 'Karma +3 — the shaft remembers who closed it'],
    },
  },
  {
    id: 'tailor', name: 'The Tailor of Brasstide', color: '#8fd0ff', requires: { chance: 0.16, level: 5 },
    steps: [
      { title: 'Fitting at Speed', desc: 'The legendary weaver Lho Vane has agreed to cut a shield-silk pattern for your hull — if you carry her to Brasstide personally. She has opinions about your interior decor and a portable loom she calls “the argument”.', objective: { type: 'courier', dest: 'brasstide', cargo: { id: 'textiles', qty: 3 } }, reward: 2400 },
      { title: 'The Silk Must Flow', desc: 'The last press of shield-silk is stranded on a freeport shuttle on the Kratha road. Clear the raiders ahead of it — the loom can hear a bad vibration from two lanes away.', objective: { type: 'sweep', dest: 'kratha', foe: 'pirate', kills: 3 }, reward: 5400 },
      { title: 'Fit and Finish', desc: 'The weave is cut and the argument is settled. Carry the finished bolt back to Haven — Lho says it will fit better after a long quiet run. She is right about fabric and wrong about your decor.', objective: { type: 'delivery', dest: 'haven', cargo: { id: 'textiles', qty: 6 } }, reward: 7000 },
    ],
    finale: {
      unlock: ['ghostweave'],
      rewards: ['Ghostweave now sold by mechanics — cut to a moving pattern', 'The argument is settled, and you were not consulted'],
    },
  },
];

export const SIDE_BY_ID = Object.fromEntries(SIDE_QUESTS.map((q) => [q.id, q]));

/** Make sure a save has a side-quest block. */
export function ensureSide(state) {
  if (!state.side || typeof state.side !== 'object') {
    state.side = { active: {}, mods: {}, done: [] };
  }
  if (!state.side.active) state.side.active = {};
  if (!state.side.mods) state.side.mods = {};
  if (!Array.isArray(state.side.done)) state.side.done = [];
  return state.side;
}

/** Short tag for a side contract, shared by dock and chart. */
function eligible(state, q) {
  const r = q.requires || {};
  if (r.background && state.background !== r.background) return false;
  if (r.drive && state.drive !== r.drive) return false;
  if (r.level && levelFromXp(state.xp || 0) < r.level) return false;
  if (r.tree) {
    for (const [tree, n] of Object.entries(r.tree)) if (treeRanks(state, tree) < n) return false;
  }
  if (r.skills) {
    for (const [skill, n] of Object.entries(r.skills)) if (skillRank(state, skill) < n) return false;
  }
  if (r.rep) {
    for (const [faction, n] of Object.entries(r.rep)) if ((state.rep[faction] ?? 0) < n) return false;
  }
  return true;
}

function buildOffer(q, step, index, state, station) {
  const o = step.objective;
  const offer = {
    id: `side-${q.id}-${index}`,
    type: o.type,
    tier: Math.min(5, 2 + index),
    side: { group: q.id, step: index },
    title: step.title,
    desc: step.desc,
    issuer: { stationId: station.id, systemId: state.systemId, faction: station.owner },
    dest: { systemId: o.dest || LANES[index % LANES.length] },
    reward: step.reward,
    rep: { faction: q.faction || station.owner, amount: 2 },
    repPenalty: null,
    deadlineDay: state.day + 10,
  };
  if (o.cargo) offer.cargo = { ...o.cargo };
  if (o.target) offer.target = { ...o.target };
  if (o.type === 'sweep') {
    offer.foe = o.foe || 'pirate';
    offer.kills = { need: o.kills, got: 0 };
  }
  if (o.type === 'recovery') offer.pods = { need: o.pods };
  return offer;
}

/** Side jobs currently on offer — at most a few notices at a time. */
export function sideOffers(state, station) {
  const s = ensureSide(state);
  const out = [];
  for (const q of SIDE_QUESTS) {
    if (s.done.includes(q.id)) continue;
    const step = s.active[q.id] || 0;
    if (step >= q.steps.length) continue;
    if (state.missions.some((m) => m.side && m.side.group === q.id)) continue;
    if (!eligible(state, q)) continue;
    const r = q.requires || {};
    if (r.chance && !rngOf(state.worldSeed, 'side', q.id, station.id, state.day).chance(r.chance)) continue;
    out.push(buildOffer(q, q.steps[step], step, state, station));
  }
  return out.slice(0, 3);
}

/** Settle a completed side step: advance the chain or close it out. */
export function advanceSide(state, meta) {
  const q = SIDE_BY_ID[meta.group];
  if (!q) return null;
  const s = ensureSide(state);
  if (s.done.includes(q.id)) return null;
  if (meta.step !== (s.active[q.id] || 0)) return null; // already settled or out of order
  const next = meta.step + 1;
  s.active[q.id] = next;
  const step = q.steps[meta.step];
  if (step?.karma) addKarma(state, step.karma);
  if (next >= q.steps.length) {
    s.done.push(q.id);
    for (const [key, val] of Object.entries(q.finale?.mods || {})) {
      s.mods[key] = (s.mods[key] || 0) + val;
    }
    // unique gear earned on a chain becomes available at mechanics and shipyards
    if (q.finale?.unlock?.length) {
      const st = ensureStory(state);
      for (const id of q.finale.unlock) if (!st.unlocked.includes(id)) st.unlocked.push(id);
    }
    if (q.finale?.rep && q.faction) state.addRep(q.faction, q.finale.rep);
    return { group: q.id, name: q.name, done: true, rewards: q.finale?.rewards || [] };
  }
  return { group: q.id, name: q.name, done: false, nextTitle: q.steps[next].title };
}
