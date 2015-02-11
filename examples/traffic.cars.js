var cars = amnesiac.namespace('traffic').controller('cars');

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
    '@console',
    '@adverbGenerator'
  ],
  peers: [
    '^traffic.light'
  ]
});


// services
cars.service('console').define(function (notice) {

  this['log [message]'] = function (message) {
    console.log(message);
  };

});

cars.service('adverbGenerator').define(function () {
    // service.notice
    var adverbs = [
      'swimmingly',
      'insatiably',
      'prosaicly',
      'unfortunately',
      'interestingly'
    ];

    this['get adverb'] = (function (i) {
      return function () {
        i = (i + 1) % adverbs.length;
        return adverbs[i];
      };
    })(0);

  });

var definition = {
  'stopped': function (controller) {

    controller.when('^traffic.light').notices('the light is green')
      .enter('going')
      .tell('@adverbGenerator').to('get adverb => adverb')
      .tell('@console').to('log [message: "cars are " + adverb + " going"]');

  },
  'going': function (controller) {

    controller.when('^traffic.light').notices('the light is yellow')
      .tell('@console').to('log [message: "cars are slowing down"]')
      .enter('going > slowingDown');

  },
  'going > slowingDown': function (controller) {

    controller.when('^traffic.light').notices('the light is red')
      .note('message: "cars have stopped"')
      .tell('@console').to('log [message]')
      .enter('stopped');

  }
};

// states
cars.state('stopped').define(definition['stopped']);

cars.state('going').define(definition['going']);

cars.state('going > slowingDown').define(definition['going > slowingDown']);
