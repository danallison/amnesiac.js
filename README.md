
amnesiac.js is a js library inspired by the following thought experiment:

Suppose you are a javascript developer working on a project. This project is ongoing and very complex. Unfortunately, you have amnesia. The symptoms you experience are such that every night when you go to sleep, you forget everything about the codebase you just spent all day working on. When you begin the next morning, it is as if you are seeing it for the first time, and you must relearn the entire codebase from scratch. Luckily, you are aware that this is happening, and you write your code in such a way that you are able to quickly get your bearings each morning and spend the bulk of your time making forward progress.

How are you able to do this?

The philosophy
==============
The big picture is top priority.
Explicit statespace definition is better than ad-hoc state inference.
Low-level events are translated into meaningful stories.
Dataflow is managed at a high level. Services handle the details.
Namespaces are important.

The API
=======

The global `amnesiac` object has one method:
`namespace`

```
// The name passed in can be any string of alphanumeric characters
amnesiac.namespace('am');
```

The `namespace` method returns an object with four methods:
`namespace`
`statespace`
`begin`
`end`

The `statespace` method returns an object with five methods:
`contents`
`state`
`service`
`begin`
`end`

`contents` must be called first. it expects an object with four attributes:
```
amnesiac.namespace('am').statespace('app')
  .contents({
    states: [
      // a list of state names in the breadcrumb format. example: "root > unauthenticated > loginPage".
      //
      // states names can contain variables that are indicated with square brackets. example: "root > blog > [post]".
    ],
    events: [
      // a list of event names as complete sentences that contain at least three words each. example "the user has submitted the form".
      // like state names, event names can also contain variables, using the same square bracket syntax. example: "the user has selected an [item]".
    ],
    services: [
      // a list of service names. examples: "session", "view", "model".
      // services handle the details of their respective domains and notice events.
    ],
    peers: [
      // a list of statespace names with "@" and namespace prefixes. examples: "@am.navbar", "@am.form".
      // these are the statespaces with which this one communicates.
      // all statespaces listed here must list this one as a peer in their contents object as well.
    ]
  });
```
This object serves as the table of contents for this particular statespace, giving you a place to start as you reaquaint yourself with your code.

```
amnesiac.namespace('am').statespace('app')
  .state('root > unauthenticated > loginPage').define(function (state) {

    state.when('view').notices('the user has submitted a [username] and [password]')
      .tell('session').to('authenticate({username: username, password: password})')
      .become('root > unauthenticated > loginPage > authenticating');

  });
```

```
amnesiac.namespace('am').statespace('app')
  .service('session').define(function (notice) {

    var session = {}

    session.authenticate = function (params) {
      ajax.post(url, params, function (response) {
        notice('authentication succeeded with [response]', {
          response: response
        });
      });
    };

    return session;

  });
```

