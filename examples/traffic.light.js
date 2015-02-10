var light = amnesiac.namespace('traffic').statespace('light');

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
    'timer',
    'console'
  ],
  peers: [
    '@traffic.cars'
  ]
});


// services
light.service('timer').define(function (notice) {

  this.waitSeconds = function (seconds) {
    setTimeout(function () {
      notice('the timer is complete');
    }, seconds * 1000);
  };

});

light.service('console').define(function (notice) {

  this.log = function (message) {
    console.log(message);
  };

});


// states
light.state('off').define(function (controller) {

  controller.when('@traffic.light').begins()
    .enter('on > red')
    .tell('timer').to('waitSeconds(0.5)');

});

light.state('on > green').define(function (controller) {

  controller.when('timer').notices('the timer is complete')
    .tell('console').to('log("changing from green to yellow")')
    .enter('on > yellow')
    .tell('@traffic.cars').that('the light is yellow')
    .tell('timer').to('waitSeconds(1)');

});

light.state('on > yellow').define(function (controller) {

  controller.when('timer').notices('the timer is complete')
    .tell('console').to('log("changing from yellow to red")')
    .enter('on > red')
    .tell('@traffic.cars').that('the light is red')
    .tell('timer').to('waitSeconds(2)');

});

light.state('on > red').define(function (controller) {

  controller.when('timer').notices('the timer is complete')
    .tell('console').to('log("changing from red to green")')
    .enter('on > green')
    .tell('@traffic.cars').that('the light is green')
    .tell('timer').to('waitSeconds(2)');

});
