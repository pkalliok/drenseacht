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

function update_atom_view(atom) {
  var e = atom.element;
  e.style.left = '' + Math.floor(atom.pos[0]) + 'px';
  e.style.top = '' + Math.floor(atom.pos[1]) + 'px';
  e.className = 'atom' + (atom.owner !== 0 ? ' pl' + atom.owner : '');
  e.src = 'img/' + atom.natoms + '-orbit.png';
}

function build_new_stage(atoms) {
  var stage = new_elem('div');
  atoms.forEach(function(atom) { stage.appendChild(atom.element); });
  R.forEach(R.invoker(0, 'remove'), game_area().childNodes);
  game_area().appendChild(stage);
}

// atom helpers

function atom_distance(atom1, atom2) {
  var diff = atom_direction(atom1, atom2);
  return Math.sqrt(R.sum(R.zipWith(R.multiply, diff, diff)));
}

function atom_direction(atom1, atom2) {
  var p1 = atom1.pos, p2 = atom2.pos;
  return R.zipWith(R.subtract, p1, p2);
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
    id: id,
    element: element,
    pos: random_position(element),
    natoms: 1 + random_int(4)
  };
}

var random_atoms = R.compose(R.map(new_atom), R.range(1));

function atom_displace(atom, pos_delta) {
  return R.evolve({'pos': R.zipWith(R.add, pos_delta)}, atom);
}

function nudge_away(atom, other_atom) {
  if (atom.id === other_atom.id) return atom;
  var dist = atom_distance(atom, other_atom);
  if (dist > ATOM_SIZE) return atom;
  if (dist < 1) return atom_displace(atom, [ATOM_SIZE, 0]);
  return atom_displace(atom,
      R.map(R.multiply((ATOM_SIZE - dist) / (dist + 1)),
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
    name: R.join('', R.map(random_syllable, R.repeat({}, 4))),
    number: number
  };
}

function new_game_state(natoms) {
  return {
    atoms: fix_atoms(fix_atoms(random_atoms(natoms))),
    players: R.map(random_player, R.range(1, 3)),
    prevstate: null
  };
}

// event handling

var rotate = R.converge(R.append, [R.head, R.tail])

function update_atom_owner(game, atom, player) {
  return R.evolve({
    atoms: R.map(R.when(R.propEq('id', atom.id),
                 R.evolve({owner: R.always(player.number)}))),
    players: rotate,
    prevstate: R.always(game)
  }, game);
}

function insert_new_proton(game, atom) {
  return R.evolve({
    atoms: R.map(R.when(R.propEq('id', atom.id), R.evolve({natoms: R.inc}))),
    players: rotate,
    prevstate: R.always(game)
  }, game);
}

function handle_atom_click(game, atom) {
  var cur_player = game.players[0];
  if (atom.owner === 0)
    return update_atom_owner(game, atom, cur_player);
  if (atom.owner === cur_player.number)
    return insert_new_proton(game, atom);
  return game;
}

function update_game(game) {
  game.atoms.forEach(function(atom) {
    update_atom_view(atom);
    atom.element.onclick = function() {
      update_game(handle_atom_click(game, atom));
    };
  });
}

// initialisation

function init_game() {
  var game = new_game_state(70);
  build_new_stage(game.atoms);
  update_game(game);
}

function install_onload(f) {
  var old = document.onload;
  document.onload = function () {
    f();
    if (old) old();
  };
}

install_onload(init_game);

