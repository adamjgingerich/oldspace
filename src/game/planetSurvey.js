// Deterministic planet survey data: every world has its own dossier, stable
// for the life of the save (seeded by world seed + name).

import { rngOf } from '../core/rng.js';

const TYPES = {
  terran: {
    label: 'Terrestrial', pop: [180000, 4200000], gravity: [0.7, 1.3],
    atmosphere: ['Breathable (filtered)', 'Breathable', 'Thin but sweet'],
    flavor: [
      'Domes and hedgerows, stubbornly green against the dark.',
      'The kind of world people write home about, and then settle.',
      'Clouds in neat bands, cities in neat grids. Orderly, expensive order.',
    ],
  },
  ocean: {
    label: 'Ocean world', pop: [40000, 900000], gravity: [0.8, 1.2],
    atmosphere: ['Humid, breathable', 'Salt-heavy, filtered'],
    flavor: [
      'Cities on stilts, storms the size of nations. Beautiful from orbit.',
      'The whole sky smells of salt, even through the scrubbers.',
      'Freighters land on floating pads that bob like patient animals.',
    ],
  },
  rocky: {
    label: 'Rock world', pop: [120, 45000], gravity: [0.4, 1.6],
    atmosphere: ['Trace / bottled', 'Thin carbon haze'],
    flavor: [
      'Cratered, cracked, and full of things worth digging up.',
      'A hard little world. The miners here measure luck in tonnage.',
      'Bare rock and long shadows. Good ore, better silence.',
    ],
  },
  gas: {
    label: 'Gas giant', pop: [0, 4200], gravity: [1.9, 3.4],
    atmosphere: ['Crushing hydrogen decks', 'Ammonia storms'],
    flavor: [
      'Band upon band of weather with no floor in sight.',
      'A skimmer fleet works the upper deck, catching what falls.',
      'Lightning storms walk around it like slow, electric cities.',
    ],
  },
  molten: {
    label: 'Molten world', pop: [0, 800], gravity: [0.9, 2.1],
    atmosphere: ['Sulphur, superheated', 'Corrosive'],
    flavor: [
      'Rivers of glow visible from orbit. Beautiful; do not land.',
      'The crust breathes heat. Every sensor complains.',
      'A forge the size of a world. Refineries orbit well clear.',
    ],
  },
  ice: {
    label: 'Ice world', pop: [90, 26000], gravity: [0.3, 0.9],
    atmosphere: ['Frozen mist', 'Thin, dry, cold'],
    flavor: [
      'Bright as a blade and just as forgiving.',
      'Cracked ice fields glitter under a distant cold sun.',
      'The whole world creaks. Crews swear it sings.',
    ],
  },
  moon: {
    label: 'Moon', pop: [0, 9000], gravity: [0.08, 0.3],
    atmosphere: ['None — sealed habitats only'],
    flavor: [
      'A grey companion, patient and pocked.',
      'Tidal-locked, quiet, and handy for listening posts.',
      'Dust, craters, and someone else’s flag.',
    ],
  },
  dusty: {
    label: 'Dust world', pop: [300, 60000], gravity: [0.5, 1.2],
    atmosphere: ['Dust-laden, breathable masks'],
    flavor: [
      'Ochre storms that erase the horizon for weeks at a time.',
      'Everything here is coated in something. Miners call it “the coat”.',
      'Storm-carved mesas and a sky the colour of old brass.',
    ],
  },
  desert: {
    label: 'Desert world', pop: [200, 90000], gravity: [0.5, 1.1],
    atmosphere: ['Thin, dry, sun-scorched', 'Dust-free, oven-dry'],
    flavor: [
      'Dune seas that move like slow amber water.',
      'Caravans follow the shadow line where the heat finally breaks.',
      'Nothing wastes water here. Nothing wastes anything.',
    ],
  },
  jungle: {
    label: 'Jungle world', pop: [5000, 600000], gravity: [0.8, 1.2],
    atmosphere: ['Thick, humid, alive', 'Breathable, pollen-heavy'],
    flavor: [
      'Canopy so dense the ground is rumour.',
      'Every expedition comes back with something new, and something missing.',
      'Green light, wet heat, and a thousand kinds of bird-call.',
    ],
  },
  crystal: {
    label: 'Crystal world', pop: [0, 300], gravity: [0.4, 1.0],
    atmosphere: ['None — vacuum', 'Trace gases'],
    flavor: [
      'Facets the size of cities catching the starlight.',
      'The whole world rings faintly, like a struck glass.',
      'Surveyors call it beautiful. Miners call it a payday.',
    ],
  },
  toxic: {
    label: 'Toxic world', pop: [0, 1200], gravity: [0.7, 1.5],
    atmosphere: ['Corrosive, unbreathable', 'Chlorine-green murk'],
    flavor: [
      'The air eats hull plating like salt on old iron.',
      'Green clouds, acid rain, and a kind of terrible beauty.',
      'Only the sealed habitats land here, and they do not linger.',
    ],
  },
};

const RESOURCE_POOL = [
  'Ion ice', 'Rare ores', 'Hydroponics', 'Fusion volatiles', 'Rare earths',
  'Biopharma', 'Heavy metals', 'Solar collectors', 'Salvage fields', 'Crystals',
  'Deep-core gases', 'Ancient ruins',
];

export function planetInfo(state, name, rec) {
  const rng = rngOf(state.worldSeed, 'planet', name);
  const t = TYPES[rec.type] || TYPES.rocky;
  const radiusKm = Math.round(rec.radius * 21);
  const gravity = rng.float(t.gravity[0], t.gravity[1]).toFixed(2);
  const atmosphere = rng.pick(t.atmosphere);
  const population = Math.round(rng.float(t.pop[0], t.pop[1]));
  const resources = rng.shuffle(RESOURCE_POOL).slice(0, rng.int(2, 3));
  const reward = Math.round(60 + rec.radius * 1.1 + (population > 200000 ? 120 : 0));
  const flavor = rng.pick(t.flavor);
  return {
    typeLabel: t.label,
    radiusKm,
    gravity,
    atmosphere,
    population,
    resources,
    reward,
    flavor,
  };
}

export function formatPopulation(n) {
  if (n <= 0) return 'uninhabited';
  if (n < 1000) return `${n} settlers`;
  if (n < 1000000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)} thousand`;
  return `${(n / 1000000).toFixed(2)} million`;
}
