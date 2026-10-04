// The line under the title: two hundred voices, one at random each time the
// screen is drawn.
//
// Balance here is deliberate — one hundred lines from women, one hundred from
// men — so the game's own voice is nobody's voice in particular. Entries are
// `“quote” — source`; where a line is famous but the attribution is doubtful
// the source reads “attributed to”.
//
// The roster is curated rather than collected. Voices with a recorded body of
// slavery, racism or sexism behind them are not quoted here, however good the
// line was; those slots went to Disney heroes and heroines instead (the two
// Disney sections below), because the title screen is the first thing a player
// reads and it should not be a memorial to the worst of them.
//
// And because a losing fight is funnier than a won one, both lists close with
// comedians on the subject — the last section of each.
//
// WOMEN_QUOTES and MEN_QUOTES are separate lists on purpose: the balance is
// then visible at a glance, and a maintainer adding a line can see which side
// is owed one. Keep them equal.

export const WOMEN_QUOTES = [
  /* ---- Disney heroines (20) ---- */
  "“I am Moana of Motunui. You will board my boat, sail across the sea, and restore the heart of Te Fiti.” — Moana",
  "“The ocean chose me for a reason.” — Moana",
  "“There is nowhere you could go that I won't be with you.” — Tala",
  "“Our fate lives within us. You only have to be brave enough to see it.” — Merida",
  "“Maybe what I really wanted was to prove I could do things right.” — Mulan",
  "“I want adventure in the great wide somewhere.” — Belle",
  "“I am not a prize to be won!” — Jasmine",
  "“You think the only people who are people are the people who look and think like you.” — Pocahontas",
  "“The cold never bothered me anyway.” — Elsa",
  "“Venture outside your comfort zone. The rewards are worth it.” — Rapunzel",
  "“Have courage and be kind.” — Cinderella",
  "“Ohana means family. Family means nobody gets left behind or forgotten.” — Lilo",
  "“In Zootopia, anyone can be anything.” — Judy Hopps",
  "“Leave the saving of the world to the men? I don't think so.” — Helen Parr",
  "“In every job that must be done, there is an element of fun.” — Mary Poppins",
  "“I give myself very good advice, but I very seldom follow it.” — Alice",
  "“You can't focus on what's going wrong. There's always a way to turn things around.” — Joy",
  "“I'm going to find the last dragon.” — Raya",
  "“The miracle is you. Not some gift, just you.” — Mirabel",
  "“The only thing you can't do is give up.” — Tiana",

  /* ---- A galaxy far, far away (13) ---- */
  "“Help me, Obi-Wan Kenobi. You're my only hope.” — Leia Organa",
  "“The more you tighten your grip, Tarkin, the more star systems will slip through your fingers.” — Leia Organa",
  "“Someone has to save our skins. Into the garbage chute, fly boy.” — Leia Organa",
  "“Rebellions are built on hope.” — Jyn Erso",
  "“Hope is like the sun. If you only believe in it when you can see it, you'll never make it through the night.” — Amilyn Holdo",
  "“We're going to win this war not by fighting what we hate, but by saving what we love.” — Rose Tico",
  "“So this is how liberty dies — with thunderous applause.” — Padmé Amidala",
  "“I was not elected to watch my people suffer and die while you discuss this invasion in a committee.” — Padmé Amidala",
  "“I am no Jedi.” — Ahsoka Tano",
  "“There's always a bit of truth in legends.” — Ahsoka Tano",
  "“I've seen evil take many forms.” — Maz Kanata",
  "“Many Bothans died to bring us this information.” — Mon Mothma",
  "“Something inside me has always been there. But now it's awake, and I'm not afraid.” — Rey",

  /* ---- Women of the Marvel films (8) ---- */
  "“I know my value. Anyone else's opinion doesn't really matter.” — Peggy Carter",
  "“The world has changed, and none of us can go back. All we can do is our best.” — Peggy Carter",
  "“I'm always picking up after you boys.” — Natasha Romanoff",
  "“I've got red in my ledger. I'd like to wipe it out.” — Natasha Romanoff",
  "“Just because something works doesn't mean it can't be improved.” — Shuri",
  "“Higher, further, faster, baby.” — Carol Danvers",
  "“I'm not going to fight your war. I'm going to end it.” — Carol Danvers",
  "“I've spent most of my life surrounded by my enemies. I would be grateful to die among my friends.” — Gamora",

  /* ---- Women of Starfleet (5) ---- */
  "“There's coffee in that nebula.” — Kathryn Janeway",
  "“Do it.” — Kathryn Janeway",
  "“We're Starfleet officers. Weird is part of the job.” — Kathryn Janeway",
  "“Hailing frequencies open.” — Nyota Uhura",
  "“Time is a companion who goes with us on the journey, and reminds us to cherish every moment.” — Guinan",

  /* ---- Captains, explorers, scientists, writers (46) ---- */
  "“I know I have the body of a weak and feeble woman, but I have the heart and stomach of a king.” — Elizabeth I",
  "“I am not afraid. I was born to do this.” — attributed to Joan of Arc",
  "“If women want any rights more than they's got, why don't they just take them, and not be talking about it?” — Sojourner Truth",
  "“I never ran my train off the track, and I never lost a passenger.” — Harriet Tubman",
  "“Failure is impossible.” — Susan B. Anthony",
  "“The way to right wrongs is to turn the light of truth upon them.” — Ida B. Wells",
  "“I would like to be remembered as a person who wanted to be free.” — Rosa Parks",
  "“Nobody's free until everybody's free.” — Fannie Lou Hamer",
  "“You must do the thing you think you cannot do.” — Eleanor Roosevelt",
  "“One child, one teacher, one book, one pen can change the world.” — Malala Yousafzai",
  "“When the whole world is silent, even one voice becomes powerful.” — Malala Yousafzai",
  "“Fight for the things that you care about, but do it in a way that will lead others to join you.” — Ruth Bader Ginsburg",
  "“You can't be what you can't see.” — Marian Wright Edelman",
  "“The most common way people give up their power is by thinking they don't have any.” — Alice Walker",
  "“It is not our differences that divide us. It is our inability to recognize, accept and celebrate those differences.” — Audre Lorde",
  "“Someone, I tell you, in another time, will remember us.” — Sappho",
  "“I'm not afraid of storms, for I'm learning how to sail my ship.” — Louisa May Alcott",
  "“I am no bird, and no net ensnares me.” — Charlotte Brontë",
  "“I do not wish women to have power over men; but over themselves.” — Mary Wollstonecraft",
  "“The beginning is always today.” — Mary Shelley",
  "“Hope is the thing with feathers that perches in the soul.” — Emily Dickinson",
  "“You cannot buy the revolution. You cannot make the revolution. You can only be the revolution.” — Ursula K. Le Guin",
  "“You may not control all the events that happen to you, but you can decide not to be reduced by them.” — Maya Angelou",
  "“If you want to fly, you have to give up the things that weigh you down.” — attributed to Toni Morrison",
  "“What you do makes a difference, and you have to decide what kind of difference you want to make.” — Jane Goodall",
  "“Nothing in life is to be feared; it is only to be understood.” — Marie Curie",
  "“Science and everyday life cannot and should not be separated.” — Rosalind Franklin",
  "“The Analytical Engine weaves algebraic patterns, just as the Jacquard loom weaves flowers and leaves.” — Ada Lovelace",
  "“It's easier to ask forgiveness than it is to get permission.” — Grace Hopper",
  "“Girls are capable of doing everything men are capable of doing.” — Katherine Johnson",
  "“Any girl can be glamorous. All you have to do is stand still and look stupid.” — Hedy Lamarr",
  "“Never be limited by other people's limited imaginations.” — Mae Jemison",
  "“The stars don't look bigger, but they do look brighter.” — Sally Ride",
  "“I touch the future. I teach.” — Christa McAuliffe",
  "“Life is either a daring adventure or nothing at all.” — attributed to Helen Keller",
  "“The most effective way to do it is to do it.” — Amelia Earhart",
  "“I refused to take no for an answer.” — Bessie Coleman",
  "“I've been absolutely terrified every moment of my life, and I've never let it keep me from doing a single thing I wanted to do.” — Georgia O'Keeffe",
  "“Feet, what do I need you for when I have wings to fly?” — Frida Kahlo",
  "“In spite of everything, I still believe that people are really good at heart.” — Anne Frank",
  "“The more clearly we can focus our attention on the wonders and realities of the universe about us, the less taste we shall have for destruction.” — Rachel Carson",
  "“If you obey all the rules, you miss all the fun.” — attributed to Katharine Hepburn",
  "“Above all, be the heroine of your life, not the victim.” — Nora Ephron",
  "“Never doubt that a small group of thoughtful, committed citizens can change the world; indeed, it's the only thing that ever has.” — attributed to Margaret Mead",
  "“The sea does not reward those who are too anxious.” — Anne Morrow Lindbergh",
  "“You cannot shake hands with a clenched fist.” — Indira Gandhi",
  /* ---- Comedians on fighting, losing and carrying on (8) ---- */
  "“Never go to bed mad. Stay up and fight.” — Phyllis Diller",
  "“This is not a novel to be tossed aside lightly. It should be thrown with great force.” — Dorothy Parker",
  "“The trouble with the rat race is that even if you win, you're still a rat.” — Lily Tomlin",
  "“When I'm good, I'm very good, but when I'm bad, I'm better.” — Mae West",
  "“I'm not funny. What I am is brave.” — Lucille Ball",
  "“I love being married. It's so great to find that one special person you want to annoy for the rest of your life.” — Rita Rudner",
  "“If you can't make it better, you can laugh at it.” — Erma Bombeck",
  "“My grandmother started walking five miles a day when she was sixty. She's ninety-seven now, and we don't know where the hell she is.” — Ellen DeGeneres",
];

export const MEN_QUOTES = [
  /* ---- Disney heroes and a galaxy far, far away (22) ---- */
  "“Second star to the right and straight on 'til morning.” — Peter Pan",
  "“All our dreams can come true, if we have the courage to pursue them.” — Walt Disney",
  "“It's kind of fun to do the impossible.” — Walt Disney",
  "“The way to get started is to quit talking and begin doing.” — Walt Disney",
  "“Look at the stars. The great kings of the past look down on us from those stars.” — Mufasa",
  "“Remember who you are.” — Mufasa",
  "“You must take your place in the circle of life.” — Simba",
  "“What can I say except you're welcome?” — Maui",
  "“Reach for the sky!” — Woody",
  "“To infinity and beyond!” — Buzz Lightyear",
  "“I am speed.” — Lightning McQueen",
  "“When you wish upon a star, your dreams come true.” — Jiminy Cricket",
  "“Dishonour on you! Dishonour on your family! Dishonour on your cow!” — Mushu",
  "“The flower that blooms in adversity is the rarest and most beautiful of all.” — the Emperor of China",
  "“The greatest gift and honour is having you for a daughter.” — Fa Zhou",
  "“You fight good.” — Li Shang",
  "“Never had a friend like me.” — the Genie",
  "“We are going to find Atlantis.” — Milo Thatch",
  "“The Force will be with you. Always.” — Obi-Wan Kenobi",
  "“I am a Jedi, like my father before me.” — Luke Skywalker",
  "“I am one with the Force and the Force is with me.” — Chirrut Îmwe",
  "“This is the way.” — Din Djarin",

  /* ---- Starfleet and the final frontier (18) ---- */
  "“Space: the final frontier.” — Jean-Luc Picard",
  "“These are the voyages of the starship Enterprise.” — Jean-Luc Picard",
  "“To boldly go where no one has gone before.” — Jean-Luc Picard",
  "“Make it so.” — Jean-Luc Picard",
  "“Engage.” — Jean-Luc Picard",
  "“The line must be drawn here! This far, no further!” — Jean-Luc Picard",
  "“It is possible to commit no mistakes and still lose. That is not a weakness; that is life.” — Jean-Luc Picard",
  "“The first duty of every Starfleet officer is to the truth.” — Jean-Luc Picard",
  "“Live long and prosper.” — Spock",
  "“The needs of the many outweigh the needs of the few.” — Spock",
  "“I have been, and always shall be, your friend.” — Spock",
  "“Risk is our business. That's what this starship is all about.” — James T. Kirk",
  "“I don't believe in the no-win scenario.” — James T. Kirk",
  "“He's dead, Jim.” — Leonard McCoy",
  "“Space is disease and danger wrapped in darkness and silence.” — Leonard McCoy",
  "“Today is a good day to die.” — Worf",
  "“From hell's heart, I stab at thee.” — Khan Noonien Singh",
  "“Time is the fire in which we burn.” — Tolian Soran",

  /* ---- Commanders and strategists (25) ---- */
  "“All warfare is based on deception.” — Sun Tzu",
  "“Supreme excellence consists of breaking the enemy's resistance without fighting.” — Sun Tzu",
  "“Know yourself and know your enemy, and you need not fear the result of a hundred battles.” — Sun Tzu",
  "“In the midst of chaos, there is also opportunity.” — Sun Tzu",
  "“Speed is the essence of war.” — Sun Tzu",
  "“War is the continuation of politics by other means.” — Carl von Clausewitz",
  "“The enemy of a good plan is the dream of a perfect plan.” — Carl von Clausewitz",
  "“Courage, above all things, is the first quality of a warrior.” — Carl von Clausewitz",
  "“Everything in war is very simple, but the simplest thing is difficult.” — Carl von Clausewitz",
  "“The way of the warrior is resolute acceptance of death.” — Miyamoto Musashi",
  "“Perceive that which cannot be seen with the eye.” — Miyamoto Musashi",
  "“You have power over your mind — not outside events. Realize this, and you will find strength.” — Marcus Aurelius",
  "“Waste no more time arguing about what a good man should be. Be one.” — Marcus Aurelius",
  "“Difficulties strengthen the mind, as labour does the body.” — Seneca",
  "“I came, I saw, I conquered.” — Julius Caesar",
  "“The die is cast.” — Julius Caesar",
  "“There is nothing impossible to him who will try.” — Alexander the Great",
  "“Nothing except a battle lost can be half so melancholy as a battle won.” — Duke of Wellington",
  "“I am tired and sick of war. Its glory is all moonshine.” — William Tecumseh Sherman",
  "“In every battle there comes a time when both sides consider themselves beaten; then he who continues the attack wins.” — Ulysses S. Grant",
  "“A good plan violently executed now is better than a perfect plan executed next week.” — George S. Patton",
  "“Courage is fear holding on a minute longer.” — George S. Patton",
  "“In war, there is no substitute for victory.” — Douglas MacArthur",
  "“We shall fight on the beaches.” — Winston Churchill",
  "“Success is not final, failure is not fatal: it is the courage to continue that counts.” — attributed to Winston Churchill",

  /* ---- The sea (15) ---- */
  "“England expects that every man will do his duty.” — Horatio Nelson",
  "“Never mind manoeuvres; always go at them.” — Horatio Nelson",
  "“First gain the victory and then make the best use of it you can.” — Horatio Nelson",
  "“I have not yet begun to fight!” — John Paul Jones",
  "“I wish to have no connection with any ship that does not sail fast; for I intend to go in harm's way.” — John Paul Jones",
  "“Uncommon valor was a common virtue.” — Chester W. Nimitz",
  "“God grant me the courage not to give up what I think is right even though I think it is hopeless.” — Chester W. Nimitz",
  "“Hit hard, hit fast, hit often.” — William F. Halsey",
  "“The more you sweat in peace, the less you bleed in war.” — Hyman G. Rickover",
  "“Damn the torpedoes, full speed ahead!” — David Glasgow Farragut",
  "“Don't give up the ship.” — James Lawrence",
  "“A ship in harbour is safe, but that is not what ships are built for.” — attributed to John A. Shedd",
  "“The sea, once it casts its spell, holds one in its net of wonder forever.” — Jacques Cousteau",
  "“It is not the ship so much as the skilful sailing that assures the prosperous voyage.” — George William Curtis",
  "“It is not down on any map; true places never are.” — Herman Melville",

  /* ---- Warriors of the screen and the page (12) ---- */
  "“Cry havoc and let slip the dogs of war.” — William Shakespeare",
  "“We few, we happy few, we band of brothers.” — William Shakespeare",
  "“Once more unto the breach, dear friends, once more.” — William Shakespeare",
  "“Cowards die many times before their deaths; the valiant never taste of death but once.” — William Shakespeare",
  "“Do. Or do not. There is no try.” — Yoda",
  "“Fear is the path to the dark side.” — Yoda",
  "“Never tell me the odds.” — Han Solo",
  "“Great kid. Don't get cocky.” — Han Solo",
  "“I find your lack of faith disturbing.” — Darth Vader",
  "“It's a trap!” — Admiral Ackbar",
  "“You shall not pass!” — Gandalf",
  "“Fear is the mind-killer.” — Frank Herbert, Dune",

  /* ---- Comedians on fighting, losing and carrying on (8) ---- */
  "“Never argue with an idiot. They will bring you down to their level and beat you with experience.” — attributed to George Carlin",
  "“Fighting for peace is like screwing for virginity.” — attributed to George Carlin",
  "“I'd horsewhip you if I had a horse.” — Groucho Marx",
  "“I never forget a face, but in your case I'll be glad to make an exception.” — Groucho Marx",
  "“It's just a flesh wound.” — Monty Python",
  "“I have the right to remain silent, but I lack the ability.” — Ron White",
  "“If at first you don't succeed, then skydiving definitely isn't for you.” — Steven Wright",
  "“People's number one fear is public speaking; number two is death. Which means that to the average person, if you go to a funeral, you're better off in the casket than doing the eulogy.” — Jerry Seinfeld",
];

export const QUOTES = [...WOMEN_QUOTES, ...MEN_QUOTES];

// The title screen promises two hundred voices; the split is meant to be even.
if (WOMEN_QUOTES.length !== MEN_QUOTES.length) {
  console.warn(`quotes: voices are unbalanced — ${WOMEN_QUOTES.length} women, ${MEN_QUOTES.length} men`);
}

/** One quote, at random. Pass a different `rng` for a deterministic draw. */
export function randomQuote(rng = Math.random) {
  return QUOTES[Math.floor(rng() * QUOTES.length) % QUOTES.length];
}
