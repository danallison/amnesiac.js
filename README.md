
amnesiac.js
===========
amnesiac.js is a js library inspired by the following thought experiment:

Suppose you are a javascript developer working on a project. This project is ongoing and very complex. Unfortunately, you have amnesia. The symptoms you experience are such that every night when you go to sleep, you forget everything about the codebase you just spent all day working on. When you begin the next morning, it is as if you are seeing it for the first time, and you must relearn the entire codebase from scratch. Luckily, you are aware that this is happening, and you write your code in such a way that you are able to quickly get your bearings each morning and spend the bulk of your time making forward progress.

How are you able to do this?

The Philosophy
--------------
__The big picture is top priority.__

When you look at an existing codebase for the first time, you need context. You need the high-level overview. You need to be able to zoom in to manage details, then zoom back out to see why those details matter. Large objects need a table of contents.

__Namespaces are important.__

Naming collisions are annoying. More annoying still are nondescript names that leave you guessing the purpose of the objects they identify. Namespaces are an easy way to indicate groupings (aka <a href="http://en.wikipedia.org/wiki/Chunking_(psychology)">chunks</a>), making it easier to see the bigger picture.

__Low-level events are translated into meaningful stories.__

`"click"`,`"success"`,`"change"`. What does it all mean? If you're going to figure out what's going on in your application every morning, you need to know why these events are important. `"click"` becomes `"the user has submitted the signup form"`. `"success"` becomes `"the project data has been loaded"`. Full sentences in natural language convey the significance and intention of the event.

__Controllers think. Services do.__

By themselves, controllers have no power. They can observe events, track state, communicate with other controllers, and decide what _should_ happen, but nothing actually _will_ happen. They live in an abstract world of awareness and logic.

Conversely, services, by themselves, may have the power to make things happen, but they don't use that power without being told first. Their rubber is on the road, but they won't start rolling until someone gives them a destination.

Without services, controllers _would_ take action, but can't. Without controllers, services _could_ take action, but won't. Only when the two work together can you build an application.

When you're trying to figure out your code each morning, you'll know where to find the ends and where to find means.

__Explicit statespace definition is better than ad-hoc state inference.__

Consider the statespace implied by the following pseudocode:

```
if a
  if b
    # state 1
  else if c
    if d
      # state 2
    else
      # state 3
  else
    # state 4
else
  # state 5
```

This statespace of length five can be expressed explicitly as an array of strings with a familiar breadcrumb syntax:

```javascript
[
  'a',        // state 4
  'a > b',    // state 1
  'a > c',    // state 3
  'a > c > d' // state 2
]             // state 5 is the default state
```

To determine what behaviors to apply in your application, you could scatter variations of the if/else block across the codebase to infer the current state of the system at the time of execution. The problem with that approach is that the statespace itself is assumed and undocumented. This may work for programmers who have more than 24 hours to build up a mental model of the application in their heads. Since you do not have this luxury, you need to get that mental model into the code itself.

Instead, you make a list of the possible states a given system in the application could be in, indicating their hierarchy with breadcrumbs. Then, you define the unique behaviors for each state in a central location, explicitly track the state of the system, and apply the correct behaviors accordingly, starting with the more specific behaviors first and falling back to general behaviors otherwise.



The API
-------

The global `amnesiac` object has one method:

* `namespace`

```javascript
amnesiac.namespace('am');
```

The `namespace` method returns an object with five methods:

* `contents`
* `namespace`
* `statespace`
* `begin`
* `end`

`contents` must be called first and passed an object with three attributes:
```javascript
amnesiac.namespace('am').contents({
  namespaces: [
  ],
  statespaces: [
  ],
  services: [
  ]
});
```

The `statespace` method returns an object with five methods:

* `contents`
* `state`
* `service`
* `begin`
* `end`

As with the namespace object, `contents` must be called first. it expects an object with four attributes:
```javascript
amnesiac.namespace('am').statespace('app')
  .contents({
    states: [
      // a list of state names in the breadcrumb format.
      // example: "root > unauthenticated > loginPage".
      // states names can contain variables that are
      // indicated with square brackets.
      // example: "root > blog > [post]".
    ],
    events: [
      // a list of event names as complete sentences
      // that contain at least three words each.
      // example: "the user has submitted the form".
      // like state names, event names can also contain
      // variables, using the same square bracket syntax.
      // example: "the user has selected an [item]".
    ],
    services: [
      // a list of service names.
      // examples: "#session", "#view", "#model".
      // services handle the details of their respective
      // domains and notice events.
    ],
    peers: [
      // a list of statespace names with "@" and namespace
      // prefixes. examples: "@am.navbar", "@am.form".
      // these are the statespaces with which this one communicates.
      // all statespaces listed here must list this one
      // as a peer in their contents object as well.
    ]
  });
```
This object serves as the table of contents for this particular statespace, giving you a place to start as you reaquaint yourself with your code.

```javascript
amnesiac.namespace('am').statespace('app')
  .state('root > unauthenticated > loginPage').define(function (controller) {

    controller.when('#am.view').notices('the user has submitted a [username] and [password]')
      .tell('#am.session').to('authenticate({username: username, password: password})')
      .tell('#am.view').to('disableSubmitButton()')
      .enter('root > unauthenticated > loginPage > authenticating');

  });
```

```javascript
amnesiac.namespace('am')
  .service('session').define(function (notice) {

    this.authenticate = function (params) {
      ajax.post(url, params, function (response) {
        notice('authentication has succeeded with [response]', {
          response: response
        });
      });
    };

  });
```

