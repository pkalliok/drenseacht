"use strict";

var ATOM_SIZE = 80;

// pure helpers

function random_int(bound) {
  return Math.floor(Math.random()*bound);
}

function pick_random(list) {
  return list[random_int(list.length)];
}

// DOM handling

var new_elem = document.createElement.bind(document);

function game_area() {
  return document.getElementById('gamearea');
}

function create_atom_image(id) {
  var elem = new_elem('img');
  elem.id = id;
  return elem;
}

var show_atom = R.curry(function (area, atom) {
  update_atom_view(atom);
  area.appendChild(atom.element);
});

function update_atom_view(atom) {
  var e = atom.element;
  e.style.left = '' + Math.floor(atom.pos[0]) + 'px';
  e.style.top = '' + Math.floor(atom.pos[1]) + 'px';
  e.className = 'atom' + (atom.owner !== 0 ? ' pl' + atom.owner : '');
  e.src = 'img/' + atom.natoms + '-orbit.png';
}

function show_new_stage(atoms) {
  var stage = new_elem('div');
  R.forEach(show_atom(stage), atoms);
  R.forEach(R.invoker(0, 'remove'), game_area().childNodes);
  game_area().appendChild(stage);
}

// stage generation

function random_position(element) {
  var ga = game_area();
  return [random_int(ga.offsetWidth - ATOM_SIZE),
	  random_int(ga.offsetHeight - ATOM_SIZE)];
}

function new_atom(id) {
  var element = create_atom_image('atom-' + id);
  return {
    owner: 0,
    element: element,
    pos: random_position(element),
    natoms: 1 + random_int(4)
  };
}

var random_atoms = R.compose(R.map(new_atom), R.range(1));

function atom_distance(atom1, atom2) {
  return R.compose(Math.sqrt, R.sum,
      R.map(function(x) {return x*x;}))(atom_direction(atom1, atom2));
}

function atom_direction(atom1, atom2) {
  return R.apply(R.zipWith(R.subtract), R.map(R.prop('pos'), [atom1, atom2]));
}

function atom_displace(atom, pos_delta) {
  return R.evolve({'pos': R.zipWith(R.add, pos_delta)}, atom);
}

function nudge_away(atom, other_atom) {
  var dist = atom_distance(atom, other_atom);
  if (dist > ATOM_SIZE) { return atom; }
  return atom_displace(atom, R.map(R.multiply((ATOM_SIZE - dist) / dist),
      atom_direction(atom, other_atom)));
}

function fix_atoms(atoms) {
  return R.map(R.reduce(nudge_away, R.__, atoms), atoms);
}

function random_syllable() {
  return pick_random(['hai', 'kan', 'tee', 'pu', 'hil', 'vat', 'ros', 'nul',
      'li', 'ge', 'toh', 'ma', 'wuk', 'ur', 'roo', 'niu', 'koi', 'me', 'ta']);
}

function random_player(number) {
  return {
    name: R.join('', R.map(random_syllable, R.repeat({}, 5))),
    number: number
  };
}

function new_game_state(natoms) {
  return {
    atoms: fix_atoms(random_atoms(natoms)),
    players: R.map(random_player, R.range(1, 3)),
    prevstate: null
  };
}

function init_game() {
  var game = new_game_state(70);
  show_new_stage(game.atoms);
  //bind_events(game);
}

function install_onload(f) {
  var old = document.onload;
  document.onload = function () {
    f();
    old();
  };
}

install_onload(init_game);

