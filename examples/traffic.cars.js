var cars = amnesiac.namespace('traffic').statespace('cars');

cars.contents({
  states: [
    'stopped',
    'going',
    'going > slowingDown'
  ],
  events: [
    'the light is red',
    'the light is yellow',
    'the light is green'
  ],
  services: [
    'console',
    'adverbGenerator'
  ],
  peers: [
    '@traffic.light'
  ]
});


// services
cars.service('console').define(function (notice) {

  this.log = function (message) {
    console.log(message);
  };

});

cars.service('adverbGenerator').define(function (notice) {
  var adverbs = [
    'swimmingly',
    'insatiably',
    'prosaicly',
    'unfortunately',
    'interestingly'
  ]

  var i = 0;

  this.getAdverb = function () {
    i = (i + 1) % adverbs.length;
    return adverbs[i];
  };

});


// states
cars.state('stopped').define(function (controller) {

  controller.when('@traffic.light').notices('the light is green')
    .enter('going')
    .tell('adverbGenerator').to('getAdverb() => adverb')
    .tell('console').to('log("cars are " + adverb + " going")');

});

cars.state('going').define(function (controller) {

  controller.when('@traffic.light').notices('the light is yellow')
    .tell('console').to('log("cars are slowing down")')
    .enter('going > slowingDown');

});

cars.state('going > slowingDown').define(function (controller) {

  controller.when('@traffic.light').notices('the light is red')
    .tell('console').to('log("cars have stopped")')
    .enter('stopped');

});
