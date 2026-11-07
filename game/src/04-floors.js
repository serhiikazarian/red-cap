// The three floors. Map legend (one character per CELL-metre cell, rows run along z):
//   # wall   . floor   o block or prop   T pillar, pyramid (floor 2) or totem (floor 3)   P start   X exit door   h heart
//   g fog gate   _ an empty spot that still draws a block's random numbers (so the layout after it stays the same)
//   talkers: B Usher  q Shade  Y Geezer  G Grin  R Priest  Z Bruno  U Grump  S Smoker  W Brainless the Second  M Jester
// Other fields: the look (fog, bg, amb, hemi, lamp, floor and wall paintings, wallH), raised ground (raise, ramps), the drone,
// deco (which decor set builds the floor), opening (a yellow-box hint as the floor begins, once a game), and tuning: drop odds per talker, hidden hearts and pebble piles, placedHearts (the
// chance each heart lying in the level, an 'h' or a hidden one, is there: fresh each time the floor starts), cages, sizes.
const FLOORS = [
  {
    num: 'Floor one',
    name: 'The Usher’s Corridor',
    line: 'Three bow-tied ushers. At the end of the corridor, the Geezer, who stares people mad.',
    fog: 0x10140b,
    near: 4,
    far: 30,
    bg: 0x070805,
    amb: [0x9aa474, 0.9],
    hemi: [0xb2c07a, 0x1a0c08, 0.45],
    lamp: [0xffd88a, 1.4, 14],
    raise: [[1, 1, 13, 3]],
    ramps: [
      [2, 4, 'N'],
      [6, 4, 'N'],
      [8, 4, 'N'],
      [12, 4, 'N']
    ],
    floor: 't_dark',
    walls: ['t_green', 't_red', 't_corr', 't_green', 't_dark', 't_crapwords', 't_column', 't_selling', 't_crapgrey', 't_scribble'],
    wallH: [3.2, 5.5],
    words: COL.paper,
    deco: 'corridor',
    camThruFloaters: true, // the drifting faces, glasses and boxes never push the camera in (they only fade)
    plainFloaters: true, // its floaters fade without a contour (56-see-through)
    yaw: Math.PI,
    drone: { notes: [46.25, 69.3], wave: 'sawtooth', cut: 260, lfo: 0.07, gain: 0.1 },
    firstUsher: [9, 6],
    usherSizes: [
      [7, 8, 1.28],
      [12, 2, 1.68, 11]
    ],
    dropOdds: { B: 0.18, q: 0.05 },
    hiddenHearts: 1, // hidden in quiet corners (hideHearts)
    placedHearts: 0.784,
    hiddenPiles: 2, // and piles of pebbles in the next quiet corners
    roomPile: [5, 1, 9, 2, 0.27], // the curtain room (cells x0, z0, x1, z1): a pile of pebbles there, by this chance
    roomHeart: [6, 6], // the middle room: a heart appears here the first time Red Cap is near it with 2 hearts or fewer
    map: [
      '###############',
      '#...#.o...#...#',
      '#.P.#.....#.B.#',
      '#...##.#.##...#',
      '##.#.......#.##',
      '#...o.T.T.o...#',
      '#........Bq...#',
      '#...###.###...#',
      '##o.q..B....o##',
      '#####.###.#####',
      '#.............#',
      '#..T...o...T..#',
      '#......Y......#',
      '#..o..T.T..o..#',
      '#.h.........X.#',
      '###############'
    ]
  },
  {
    num: 'Floor two',
    name: 'The Mouth',
    line: 'Flyin’ faces that spit fire. A priest who blesses with blood. Bruno, burnin’.',
    opening: 'You can talk the talk...',
    fog: 0x1e0706,
    near: 4,
    far: 30,
    bg: 0x120303,
    amb: [0xc08070, 0.75],
    hemi: [0xff9a7a, 0x200404, 0.45],
    lamp: [0xffc9a0, 1.3, 14],
    raise: [[7, 1, 13, 3]],
    ramps: [
      [7, 4, 'N'],
      [11, 4, 'N']
    ],
    spreadHearts: true,
    dropOdds: { G: 0.2 },
    hiddenHearts: 3, // hidden in quiet corners (hideHearts)
    placedHearts: 0.7,
    cages: [
      [3, 9, 'Z'],
      [4, 6, 'G'],
      [11, 6, 'G']
    ],
    floor: 't_hatch',
    walls: ['t_chaos', 't_ember', 't_hatch', 't_chaos', 't_chaos:0x5a3040', 't_ember:0x41305a', 't_hatch:0x3a2626'],
    wallH: [3.4, 6],
    words: COL.bile,
    deco: 'mouth',
    strayShots: true, // the talkers' shots hurt the small talkers they hit by accident (21-shots)
    pyramids: true, // its 'T' cells are pyramids (44-pyramids): their round body stops sight and pebbles, and they glow
    flatProps: true, // its 'o' cells hold bear traps: flat, nothing to bump into or hide behind
    embers: true, // sparks rise from the floor round Red Cap (64-loop)
    yaw: -2.85, // the start: Red Cap by the first pyramid, looking down the raised room past its two traps (the first Grin, close on
    // his left, stays out of view even on a 21:9 screen)
    pitch: 0.6,
    start: [26, 7.5],
    drone: { notes: [55, 58.27], wave: 'sawtooth', cut: 320, lfo: 0.11, gain: 0.1 },
    map: [
      '###############',
      '#..T.h#..T.G..#',
      '#.G...#.......#',
      '#...o.#.P.o...#',
      '##.####.###.###',
      '#....T.....T..#',
      '#.o....o.o....#',
      '#.##.#######..#',
      '#.#..#.....#.##',
      '#.TZ.#..X..#..#',
      '#.##.##...##..#',
      '#.....o.R.o...#',
      '###############'
    ]
  },
  {
    num: 'Floor three',
    name: 'Stop Talkin’ Sh#t',
    line: 'The Wall is shoutin’. The Head is smokin’. The Jester waits behind the gate.',
    opening: 'Can you walk the walk?..',
    fog: 0xb9b2a5,
    near: 6,
    far: 40,
    bg: 0xc9c2b4,
    amb: [0xffffff, 0.55],
    hemi: [0xffffff, 0x6d5a48, 0.3],
    lamp: [0xfff2dc, 0.55, 12],
    dropOdds: { S: 0.58 },
    hiddenPiles: 2, // piles of pebbles hidden in quiet corners (hideHearts)
    placedHearts: 0.9,
    lowHeart: [2, 2], // the Jester's chamber: a heart here too if Red Cap walks in with fewer than 3
    blockMoved: [[11, 11, 11, 12]],
    floor: 't_smudge',
    walls: ['t_blue', 't_lime', 't_orange', 't_brown', 't_coal', 't_ochre'],
    wallH: [3, 6],
    words: COL.ink,
    deco: 'blocks',
    yaw: 0,
    drone: { notes: [73.4, 110], wave: 'triangle', cut: 500, lfo: 0.05, gain: 0.12 },
    map: [
      '#####################',
      '#...................#',
      '#...o.....M.....o.h.#',
      '#.......T...T.......#',
      '#...................#',
      '#...................#',
      '#...o...T...T...o...#',
      '#...................#',
      '#ggggggggggggggggggg#',
      '#.....#...U...#...S.#',
      '#..h..#.......#.....#',
      '#.....#._.....#.....#',
      '#.W...##.o.o.##.....#',
      '#....o.._..._..o....#',
      '#...................#',
      '#.....o.o.....o.....#',
      '#...................#',
      '#..o........o....o..#',
      '#..T.............T..#',
      '#......o..P..o......#',
      '#...................#',
      '#####################'
    ]
  }
];
