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
var text_elem = document.createTextNode.bind(document);

function game_area() {
  return document.getElementById('gamearea');
}

function players_area() {
  return document.getElementById('players');
}

function create_atom_image(id) {
  var elem = new_elem('img');
  elem.id = id;
  elem.className = 'atom';
  return elem;
}

function create_proton_image() {
  var elem = new_elem('img');
  elem.src = 'img/proton.png';
  elem.className = 'proton';
  return elem;
}

function show_element_at(e, pos) {
  e.style.left = '' + Math.floor(pos[0]) + 'px';
  e.style.top = '' + Math.floor(pos[1]) + 'px';
}

function update_atom_view(atom) {
  var e = atom.element;
  show_element_at(e, atom.pos);
  e.className = 'atom' + (atom.owner !== 0 ? ' pl' + atom.owner : '');
  e.src = 'img/' + atom.nprotons + '-orbit.png';
}

function build_new_stage(atoms) {
  var stage = new_elem('div');
  var stage_append = stage.appendChild.bind(stage);
  R.map(R.prop('element'), atoms).forEach(stage_append);
  R.forEach(R.invoker(0, 'remove'), game_area().childNodes);
  game_area().appendChild(stage);
}

function make_playerlist(players) {
  var playerlist = new_elem('div');
  players.forEach(function (player) {
    var plelem = new_elem('p');
    plelem.className = 'playername pl' + player.number;
    plelem.appendChild(text_elem(player.name));
    playerlist.appendChild(plelem);
  });
  return playerlist;
}

function moreplayer_btn(game) {
  var moreplayers = new_elem('p');
  moreplayers.className = 'playername';
  moreplayers.appendChild(text_elem('+++'));
  moreplayers.onclick = function () { update_game(add_one_player(game)); };
  return moreplayers;
}

function render_game(game) {
  game.atoms.forEach(update_atom_view);
  var playerlist = make_playerlist(game.players);
  if (game.players.length < 5) {
    playerlist.appendChild(moreplayer_btn(game));
  }
  R.forEach(R.invoker(0, 'remove'), players_area().childNodes);
  players_area().appendChild(playerlist);
}

// atom helpers

function atom_distance(atom1, atom2) {
  return posdiff_length(atom_direction(atom1, atom2));
}

function posdiff_length(diff) {
  return Math.sqrt(R.sum(R.zipWith(R.multiply, diff, diff)));
}

function atom_direction(atom1, atom2) {
  return pos_difference(atom1.pos, atom2.pos);
}

var pos_difference = R.zipWith(R.subtract);

function atom_displace(atom, pos_delta) {
  return R.evolve({pos: pos_add(pos_delta)}, atom);
}

var pos_add = R.zipWith(R.add);

var posdiff_multiply = R.curry(function (factor, diff) {
  return R.map(R.multiply(factor), diff);
});

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
    nprotons: 1 + random_int(3)
  };
}

var random_atoms = R.compose(R.map(new_atom), R.range(1));

function nudge_away(atom, other_atom) {
  if (atom.id === other_atom.id) return atom;
  var dist = atom_distance(atom, other_atom);
  if (dist > ATOM_SIZE) return atom;
  if (dist < 1) return atom_displace(atom, [ATOM_SIZE, 0]);
  return atom_displace(atom,
      posdiff_multiply((ATOM_SIZE - dist) / (dist + 1),
        atom_direction(atom, other_atom)));
}

function fix_atoms(atoms) {
  return R.map(R.reduce(nudge_away, R.__, atoms), atoms);
}

function random_syllable() {
  return pick_random(['hai', 'kan', 'tee', 'pu', 'hil', 'vat', 'ros', 'nul', 'nas',
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
    protons: [],
    prevstate: null
  };
}

// chain reactions

function handle_fissions(game) {
  var reactible = R.filter(R.compose(R.lt(4), R.prop('nprotons')), game.atoms);
  if (R.isEmpty(reactible)) return game;
  var protons = R.chain(function(srcatom) {
    return R.compose(
            R.map(function (dstatom) {
              return { phase: 0, src: srcatom.id,
                owner: srcatom.owner, dst: dstatom.id };
            }),
            R.take(4),
            R.tail,
            R.sortBy(R.partial(atom_distance, [srcatom])))(game.atoms);
  }, reactible);
  return R.evolve({
    atoms: R.map(R.when(R.contains(R.__, reactible),
                 R.evolve({ nprotons: R.add(-4) }))),
    protons: R.concat(protons)
  }, game);
}

function merge_protons(game) {
  var dsts = R.groupBy(R.prop('dst'), game.protons);
  return R.evolve({
    atoms: R.map(function (atom) {
      var incoming = dsts[atom.id];
      if (!incoming) return atom;

      var src_ids = R.map(R.prop('src'), incoming);
      var src_pos = R.compose(
          posdiff_multiply(1 / incoming.length),
          R.reduce(pos_add, [0, 0]),
          R.map(R.prop('pos')),
          R.filter(R.compose(R.contains(R.__, src_ids),
              R.prop('id'))))(game.atoms);

      var diff = pos_difference(atom.pos, src_pos);
      var dist = posdiff_length(diff);

      return R.evolve({
        nprotons: R.add(R.length(incoming)),
        pos: pos_add(posdiff_multiply(8 / (dist + 1), diff)),
        owner: R.always(R.head(incoming).owner)
      }, atom);
    }),
    protons: R.always([])
  }, game);
}

// proton animations

var req_frame = window.requestAnimationFrame.bind(window);

function proton_animation_frame(phase, protons) {
  protons.forEach(function (proton) {
    var pos = R.zipWith(R.add,
        R.map(R.multiply(phase), proton.dst),
        R.map(R.multiply(1-phase), proton.src));
    show_element_at(proton.elem, pos);
  }); 
  if (phase < 1) {
    req_frame(function () {
      proton_animation_frame(phase + .03, protons);
    });
  } else {
    R.map(R.prop('elem'), protons).forEach(R.invoker(0, 'remove'));
  }
}

function animate_protons(protons, atoms) {
  var id_to_pos = R.prop(R.__,
      R.fromPairs(R.map(R.juxt([R.prop('id'), R.prop('pos')]), atoms)));
  var prot_pos = R.map(R.compose(R.evolve({ src: id_to_pos, dst: id_to_pos,
    elem: function (x) { return create_proton_image(); } }), R.assoc('elem', [])),
      protons);
  var to_game_area = game_area().appendChild.bind(game_area());
  R.map(R.prop('elem'), prot_pos).forEach(to_game_area);
  req_frame(function () {
    proton_animation_frame(0, prot_pos);
  });
}

// event handling

var rotate = R.converge(R.append, [R.head, R.tail])

function update_atom_owner_action(game, atom, player) {
  return R.evolve({
    atoms: R.map(R.when(R.propEq('id', atom.id),
                 R.evolve({owner: R.always(player.number)}))),
    players: rotate,
    prevstate: R.always(game)
  }, game);
}

function insert_new_proton_action(game, atom) {
  return R.evolve({
    atoms: R.map(R.when(R.propEq('id', atom.id), R.evolve({ nprotons: R.inc }))),
    players: rotate,
    prevstate: R.always(game)
  }, game);
}

function handle_atom_click(game, atom) {
  var cur_player = game.players[0];
  var new_game = R.assoc('last_player', cur_player, game);
  if (atom.owner === 0)
    return update_atom_owner_action(new_game, atom, cur_player);
  if (atom.owner === cur_player.number)
    return handle_fissions(insert_new_proton_action(new_game, atom));
  return game;
}

function add_one_player(game) {
  var next_num = R.reduce(R.max, 0, R.map(R.prop('number'), game.players)) + 1;
  return R.evolve({ players: R.append(random_player(next_num)) }, game);
}

function update_game(game) {
  render_game(game);
  if (!R.isEmpty(game.protons)) {
    animate_protons(game.protons, game.atoms);
    setTimeout(function() { update_game(handle_fissions(merge_protons(game))); },
        500);
  } else {
    game.atoms.forEach(function(atom) {
      atom.element.onclick = function() {
        update_game(handle_atom_click(game, atom));
      };
    });
  }
}

// initialisation

function init_game() {
  var game = new_game_state(70);
  build_new_stage(game.atoms);
  update_game(game);
}

function install_onload(f) {
  var old = window.onload;
  window.onload = function () {
    f();
    if (old) old();
  };
}

install_onload(init_game);

// vim:set sw=2 et:

