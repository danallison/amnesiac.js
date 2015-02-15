
amnesiac.js
===========
amnesiac.js is an experimental application framework inspired by the following thought experiment:

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

__Explicit statespace definition is better than ad-hoc state inference.__

Consider the statespace implied by the following pseudocode:

```coffeescript
# state 0
if a
  # state 1
  if b
    # state 2
  else if c
    # state 3
    if d
      # state 4
```

This statespace of length five can be expressed explicitly as an array of strings with a familiar breadcrumb syntax:

```javascript
[             // state 0 (default state)
  'a',        // state 1
  'a > b',    // state 2
  'a > c',    // state 3
  'a > c > d' // state 4
]
```

To determine what behaviors to apply in your application, you could scatter variations of the if/else block across the codebase to infer the current state of the system at the time of execution. The problem with that approach is that the statespace itself is assumed and undocumented. This may work for programmers who have more than 24 hours to build up a mental model of the application in their heads. Since you do not have this luxury, you need to get that mental model into the code itself.

Instead, you make a list of the possible states a given system in the application could be in, indicating their hierarchy with breadcrumbs. Then, you define the unique behaviors for each state in a central location, explicitly track the state of the system, and apply the correct behaviors accordingly.

Objects
-------

There are three types of objects in `amnesiac`:
* Namespace
* Controller
* Service

Namespaces don't do much besides contain controllers and services, but they are still a very important part of writing self-explanatory code. Identifying and labeling groups of objects (and groups of groups of objects) clarifies the context and purpose of those objects, making it possible to see how things fit together at a high level.

Controllers keep track of state, respond to events, communicate with other controllers, relay data between objects, and handle application logic. That may sound like a lot of responsibilities, but actually, by themselves, controllers can't do anything that has any effect. The only way that controllers can have an effect on the actual application is through services. Controllers tell services what to do and provide whatever data the services need to do it.

Services get stuff done. They process data, build ui, make server calls, etc. They also notice events. But one thing they do not do is care about anything outside of their specialized domains of responsibility. They manage details and details alone. No big picture view. No context awareness. They may notice events, but they never react to them. That's the controllers' job.

In summary: namespaces contain, controllers think, services do.


The API
-------

The state of the api is still in flux, as this library is still very experimental. Much of what follows is likely to be outdated, unimplimented, or both.

The global `amnesiac` object has one method:

* `namespace`

```javascript
amnesiac.namespace('am');
```

The returned `namespace` object has six methods:

* `contents`
* `namespace`
* `controller`
* `service`
* `begin`
* `end`

`contents` must be called first and passed an object with three attributes:
```javascript
amnesiac.namespace('am').contents({
  namespaces: [
  ],
  controllers: [
  ],
  services: [
  ]
});
```

The `controller` method returns a controller object with two methods:

* `contents`
* `define`

As with the namespace object, `contents` must be called first. it expects an object with four attributes:
```javascript
amnesiac.namespace('am').controller('app')
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
    dependencies: [
      // a list of service names.
      // examples: "@session", "@view", "@model".
      // services handle the details of their respective
      // domains and notice events.
    ],
    peers: [
      // a list of controller names with "^" and namespace
      // prefixes. examples: "^am.navbar", "^am.form".
      // these are the controllers with which this one communicates.
      // all controllers listed here must list this one
      // as a peer in their contents object as well.
    ]
  });
```
This object serves as the table of contents for this particular controller, giving you a place to start as you reaquaint yourself with your code.
