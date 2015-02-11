var light = amnesiac.namespace('traffic').controller('light');

light.contents({
  states: [
    'off',
    'on',
    'on > green',
    'on > yellow',
    'on > red'
  ],
  events: [
    'the timer is complete'
  ],
  services: [
    '@timer',
    '@console'
  ],
  peers: [
    '^traffic.cars'
  ]
});


// services
light.service('timer').define(function (notice) {

  this['wait [n] seconds'] = function (n) {
    setTimeout(function () {
      notice('the timer is complete');
    }, n * 1000);
  };

});

light.service('console').define(function (notice) {

  this['log [message]'] = function (message) {
    console.log(message);
  };

});


// states
light.state('off').define(function (controller) {

  controller.when('^traffic.light').begins()
    .enter('on > red')
    .tell('@timer').to('wait [n: 0.5] seconds');

});

light.state('on > green').define(function (controller) {

  controller.when('@timer').notices('the timer is complete')
    .tell('@console').to('log [message: "changing from green to yellow"]')
    .enter('on > yellow')
    .tell('^traffic.cars').that('the light is yellow')
    .tell('@timer').to('wait [n: 1] seconds');

});

light.state('on > yellow').define(function (controller) {

  controller.when('@timer').notices('the timer is complete')
    .note('message: "changing from yellow to red"')
    .tell('@console').to('log [message]')
    .enter('on > red')
    .tell('^traffic.cars').that('the light is red')
    .note('n: 2')
    .tell('@timer').to('wait [n] seconds');

});

light.state('on > red').define(function (controller) {

  controller.when('@timer').notices('the timer is complete')
    .tell('@console').to('log [message: "changing from red to green"]')
    .enter('on > green')
    .tell('^traffic.cars').that('the light is green')
    .tell('@timer').to('wait [n: 2] seconds');

});
