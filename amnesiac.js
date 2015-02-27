;(function (root) {

  var STATE_SEPARATOR = /\s*>\s*/g,
      STATE_JOINER = ' > ',
      ACTION_VARIABLE_PATTERN = /=>\s*\w+\s*$/,
      SERVICE_KEY = '____service____',
      INITIAL_EVENT = '____init____',
      CONCLUDING_EVENT = '____conclude____',
      SPACE_NAME_PREFIX = '^',
      SERVICE_NAME_PREFIX = '@';

  var allSpaces = {};
  var allServices = {};
  var activeSpaces = {}; // TODO

  var slice = [].slice;

  var noop = function () {};

  var identity = function (value) { return value; };

  var extend = function (extending, object) {
    for (var key in object) {
      extending[key] = object[key];
    }
    return extending;
  };

  var joinNames = function () {
    return slice.call(arguments).join('.');
  };

  var throwError = function () {
    throw 'error';
  };

  var evalString = function (string, variables) {
    return (new Function('v','with (v) return ' + string))(variables);
  };

  var buildStateTree = function (stateNames) {
    return stateNames.reduce(function (tree, stateName) {
      stateName.split(STATE_SEPARATOR).reduce(function (node, stateStep) {
        node = node[stateStep] || (node[stateStep] = {});
        node._events = {};
        return node;
      }, tree);
      return tree;
    }, { _events: {} });
  };

  var buildState = function (spaceName, stateName) {
    var space = allSpaces[spaceName];
    var node = space._stateTree;
    return stateName.split(STATE_SEPARATOR).reduce(function (state, step) {
      node = node[step];
      if (!node) debugger;
      for (var eventName in node._events) {
        state[eventName] = node._events[eventName];
      }
      return state;
    }, {});
  };

  var getStateNode = function (spaceName, stateName) {
    return stateName.split(STATE_SEPARATOR).reduce(function (node, step) {
      return node[step];
    }, allSpaces[spaceName]._stateTree);
  };

  var getValueKey = function (actionName) {
    var match = actionName.match(ACTION_VARIABLE_PATTERN);
    if (match) return match[0].replace(/\W+/g, '');
  };


  var extractVariableSections = function (string) {
    if (!(/\[/).test(string)) return [];
    // TODO fix this regexp for scenario like "abc [def: [[],[]]]"
    return (string.split(/(?:^.*?\[)|(?:\][^\]]*?\[)|(?:\][^\]]*?$)/g) || []).filter(identity);
  };

  var extractVariableAssignments = function (string) {
    return extractVariableSections(string).filter(function (section) {
      return (/:/).test(section);
    });
  };

  var extractVariableNames = function (string) {
    return extractVariableSections(string).map(function (section) {
      return section.split(':')[0].trim();
    });
  };

  var extractVariables = function (string, object) {
    object || (object = {});
    return extractVariableNames(string).reduce(function (variables, key) {
      variables[key] = object[key];
      return variables;
    }, {});
  };

  var getActionString = function (actionName) {
    actionName = actionName.replace(ACTION_VARIABLE_PATTERN, '').trim();
    var sections = extractVariableSections(actionName);
    var names = extractVariableNames(actionName);
    sections.forEach(function (section, i) {
      actionName = actionName.replace(section, names[i]);
    });
    return actionName;
  };

  var registerServiceCommand = function (spaceName, stateName, noticerName, eventName, serviceName, actionName) {
    var stateNode = getStateNode(spaceName, stateName);
    var eventKey = joinNames(noticerName, eventName);
    var previousFunction = stateNode._events[eventKey] || noop;
    var valueKey = getValueKey(actionName);
    var variableAssignments = extractVariableAssignments(actionName);
    actionName = getActionString(actionName);
    var variableKeys = extractVariableNames(actionName);
    stateNode._events[eventKey] = function (variables) {
      previousFunction(variables);
      variables[SERVICE_KEY] = allSpaces[spaceName]._services[serviceName];
      if (variableAssignments.length) extend(variables, evalString('{' + variableAssignments.join(',') + '}', variables));
      var value = evalString('/* ' + serviceName + ' */' + SERVICE_KEY + '["' + actionName + '"](' + variableKeys.join(',') + ')', variables);
      if (valueKey) variables[valueKey] = value;
      return value;
    };
  };

  var registerStateChange = function (spaceName, stateName, noticerName, eventName, nextStateName, variableString) {
    variableString || (variableString = '{}');
    var stateNode = getStateNode(spaceName, stateName);
    var eventKey = joinNames(noticerName, eventName);
    var previousFunction = stateNode._events[eventKey] || noop;
    stateNode._events[eventKey] = function (variables) {
      var value = previousFunction(variables);
      var additionalVariables = evalString(variableString, variables);
      variables = extend(extend({}, variables), additionalVariables);
      allSpaces[spaceName]._changeState(nextStateName, variables);
      return value;
    };
  };

  var registerPeerNotification = function (spaceName, stateName, noticerName, eventName, peerName, differentEventName, variableString) {
    differentEventName || (differentEventName = eventName);
    variableString || (variableString = '{}');
    var stateNode = getStateNode(spaceName, stateName);
    var eventKey = joinNames(noticerName, eventName);
    var previousFunction = stateNode._events[eventKey] || noop;
    stateNode._events[eventKey] = function (variables) {
      var value = previousFunction(variables);
      var additionalVariables = evalString(variableString, variables);
      variables = extend(extend({}, variables), additionalVariables);
      allSpaces[spaceName]._notify(peerName, differentEventName, variables);
      return value;
    };
  };

  var registerNoop = function (spaceName, stateName, noticerName, eventName) {
    var stateNode = getStateNode(spaceName, stateName);
    var eventKey = joinNames(noticerName, eventName);
    stateNode._events[eventKey] = noop;
  };

  var registerNote = function (spaceName, stateName, noticerName, eventName, noteString) {
    var stateNode = getStateNode(spaceName, stateName);
    var eventKey = joinNames(noticerName, eventName);
    var previousFunction = stateNode._events[eventKey] || noop;
    stateNode._events[eventKey] = function (variables) {
      previousFunction(variables);
      var additionalVariables = evalString('{' + noteString + '}', variables);
      extend(variables, additionalVariables);
    };
  };

  function Controller(spaceName, stateName) {
    var t = this;
    t._spaceName = spaceName;
    t._stateName = stateName;
    t._commands = [];
    t._accepting = true;
  }

  var ControllerPrototype = Controller.prototype;

  ControllerPrototype.when = function(serviceOrPeerName) {
    var t = this;
    if (!t._accepting) throw '"when" cannot be called here';
    t._noticerName = serviceOrPeerName;
    t._previousMethod = 'when';
    t._accepting = false;
    return t;
  };

  ControllerPrototype.notices = function(eventName) {
    var t = this;
    if (t._previousMethod != 'when') throw '"notices" cannot be called here';
    t._eventName = eventName;
    t._previousMethod = 'notices';
    t._accepting = true;
    return t;
  };

  ControllerPrototype.begins = function() {
    var t = this;
    if (t._previousMethod != 'when') throw '"begins" cannot be called here';
    t._eventName = INITIAL_EVENT;
    t._accepting = true;
    return t;
  };

  ControllerPrototype.ends = function() {
    var t = this;
    if (t._previousMethod != 'when') throw '"ends" cannot be called here';
    t._eventName = CONCLUDING_EVENT;
    t._accepting = true;
    return t;
  };

  ControllerPrototype.tell = function(serviceOrPeerName) {
    var t = this;
    if (!t._accepting) throw '"tell" cannot be called here';
    t._serviceOrPeerName = serviceOrPeerName;
    t._previousMethod = 'tell';
    t._accepting = false;
    return t;
  };

  ControllerPrototype.enter = function(stateName, variableString) {
    var t = this;
    if (!t._accepting) throw '"enter" cannot be called here';
    t._nextStateName = stateName;
    t._variableString = variableString;
    t._registerStateChange();
    return t;
  };

  ControllerPrototype.note = function(noteString) {
    var t = this;
    if (!t._accepting) throw '"note" cannot be called here';
    t._noteString = noteString;
    t._registerNote();
    return t;
  };

  ControllerPrototype.notify = function(peerName) {
    var t = this;
    if (!t._accepting) throw '"notify" cannot be called here';
    t._serviceOrPeerName = peerName;
    t._differentEventName = t._eventName;
    t._registerPeerNotification();
    return t;
  };

  ControllerPrototype.ignore = function() {
    var t = this;
    if (!t._accepting) throw '"ignore" cannot be called here';
    t._registerNoop();
  };

  ControllerPrototype.end = function() {
    // TODO
  };

  ControllerPrototype.to = function(actionName) {
    var t = this;
    if (t._accepting) throw '"to" cannot be called here';
    t._actionName = actionName;
    t._registerServiceCommand();
    t._accepting = true;
    return t;
  };

  ControllerPrototype.that = function(eventName, variableString) {
    var t = this;
    if (t._accepting) throw '"that" cannot be called here';
    t._differentEventName = eventName;
    t._variableString = variableString;
    t._registerPeerNotification();
    t._accepting = true;
    return t;
  };

  ControllerPrototype._registerServiceCommand = function () {
    var t = this;
    registerServiceCommand(t._spaceName, t._stateName, t._noticerName, t._eventName, t._serviceOrPeerName, t._actionName);
  };

  ControllerPrototype._registerPeerNotification = function () {
    var t = this;
    registerPeerNotification(t._spaceName, t._stateName, t._noticerName, t._eventName, t._serviceOrPeerName, t._differentEventName, t._variableString);
  };

  ControllerPrototype._registerStateChange = function () {
    var t = this;
    registerStateChange(t._spaceName, t._stateName, t._noticerName, t._eventName, t._nextStateName, t._variableString);
  };

  ControllerPrototype._registerNoop = function () {
    var t = this;
    registerNoop(t._spaceName, t._stateName, t._noticerName, t._eventName);
  };

  ControllerPrototype._registerNote = function () {
    var t = this;
    registerNote(t._spaceName, t._stateName, t._noticerName, t._eventName, t._noteString);
  };

  ControllerPrototype._registerConcludingEvent = function () {
    // TODO
    // var t = this;
    // registerConcludingEvent(t._spaceName, t._stateName, t._noticerName, t._eventName);
  };

  var stateDefiner = function (spaceName, stateName) {
    return {
      define: function (definition) {
        allSpaces[spaceName]._definitions.push(function () {
          var controller = new Controller(spaceName, stateName),
              when = function (name) {
                return controller.when(name);
              };
          when.when = when;
          new definition(when);
        });
        return allSpaces[spaceName];
      }
    };
  };

  var newNoticeFunction = function (spaceName, serviceName) {
    var newNotice = function (space) {
      return function (eventName, variables) {
        if (space._ended || !space._currentState) return;
        var callback = space._currentState[joinNames(serviceName, eventName)];
        if (callback) {
          variables = extend(extend({}, space._stateVariables), extractVariables(eventName, variables));
          callback(variables || {});
        }
      };
    };
    if (spaceName) {
      var space = allSpaces[spaceName];
      var notice = newNotice(space, serviceName);
      notice.cleanup = function (callback) {
        allSpaces[spaceName]._cleanupCallbacks.push(callback);
      }
      return notice;
    } else {
      return function (eventName, variables) {
        for (var spaceName in allSpaces) {
          var space = allSpaces[spaceName];
          newNotice(space)(eventName, variables);
        }
      };
    }
  };

  var serviceDefiner = function (spaceName, serviceName) {
    serviceName = SERVICE_NAME_PREFIX + serviceName;
    return {
      define: function (definition) {
        allSpaces[spaceName]._definitions.push(function () {
          allSpaces[spaceName]._services[serviceName] = new definition(newNoticeFunction(spaceName, serviceName));
        });
        return allSpaces[spaceName];
      }
    };
  };

  var setContents = function (spaceName, contents) {
    contents = extend({}, contents);
    contents.events = contents.events.slice();
    contents.states = contents.states.slice();
    contents.services = contents.services.slice();
    contents.peers = contents.peers.slice();

    var space = allSpaces[spaceName];
    space._contents = contents;
    space._definitions = [];

    space.state = function (stateName) {
      return stateDefiner(spaceName, stateName);
    };
    space.define = function (definition) {
      if (typeof definition === 'function') {
        space._definition = new definition();
      } else {
        space._definition = extend({}, definition);
      }
      for (var stateName in space._definition) {
        space.state(stateName).define(space._definition[stateName]);
      }
      return space;
    };
    space.service = function (serviceName) {
      return serviceDefiner(spaceName, serviceName);
    };
    var begin = function () {
      space._eventNames = contents.events.slice();
      space._unusedEventNames = contents.events.slice();
      space._serviceNames = contents.services.slice();
      space._unusedServiceNames = contents.services.slice();
      space._peerNames = contents.peers.slice();
      space._unusedPeerNames = contents.peers.slice();
      space._stateNames = contents.states.slice();
      space._unusedStateNames = contents.states.slice();
      space._stateTree = buildStateTree(contents.states);
      space._services = {};
      space._currentStateName = space._stateNames[0];
      space._currentState = null;
      space._stateVariables = {};
      space._cleanupCallbacks = [];
      space._begun = true;
      space._ended = false;
      space._changeState = function (nextStateName, variables) {
        space._stateVariables = extractVariables(nextStateName, variables);
        space._currentStateName = nextStateName;
        space._currentState = buildState(spaceName, nextStateName);
      };
      space._notify = function (peerName, eventName, variables) {
        newNoticeFunction(peerName, spaceName)(eventName, variables);
      };
      space._definitions.forEach(function (definition) { definition(); });
      space._serviceNames.forEach(function (serviceName) {
        space._services[serviceName] || (space._services[serviceName] = allServices[serviceName]._api);
      });
      space._currentState = buildState(spaceName, space._currentStateName);
      space.begin = throwError;
      space.end = function () {
        newNoticeFunction(spaceName, spaceName)(CONCLUDING_EVENT);
        space._cleanupCallbacks.forEach(function (callback) { callback(); });
        activeSpaces[spaceName] = null;
        var keepers = ['_contents','_definitions'];
        for (var key in space) {
          if (keepers.indexOf(key) == -1) {
            delete space[key];
          }
        }
        space._ended = true;
        space.end = throwError;
        space.begin = begin;
      };
      setTimeout(function () {
        // TODO, replace this timeout with a better solution
        newNoticeFunction(spaceName, spaceName)(INITIAL_EVENT);
      }, 0);
      return space;
    };
    space.begin = begin;
  };

  var newSpace = function (spaceName) {
    return {
      contents: function (contents) {
        setContents(spaceName, contents);
        this.contents = throwError;
        return this;
      }
    };
  };

  var newService = function (serviceName) {
    return {
      contents: function (contents) {
        // methods and events
        this.define = function (definition) {
          this._api = new definition(newNoticeFunction(null, serviceName));
          return this;
        }
        return this;
      }
    };
  }

  var namespace = function (name) {
    return {
      namespace: function (name2) {
        return namespace(joinNames(name, name2));
      },
      controller: function (controllerName) {
        var spaceName = SPACE_NAME_PREFIX + joinNames(name, controllerName);
        return allSpaces[spaceName] || (allSpaces[spaceName] = newSpace(spaceName));
      },
      service: function (serviceName) {
        var serviceName = SERVICE_NAME_PREFIX + joinNames(name, serviceName);
        return allServices[serviceName] || (allServices[serviceName] = newService(serviceName));
      },
      begin: function () {
        var nameDot = name + '.';
        Object.keys(allSpaces).forEach(function (key) {
          if (key.indexOf(nameDot) == (0 + SPACE_NAME_PREFIX.length)) {
            allSpaces[key].begin();
          }
        });
      },
      end: function () {
        var nameDot = name + '.';
        Object.keys(allSpaces).forEach(function (key) {
          if (key.indexOf(nameDot) == (0 + SPACE_NAME_PREFIX.length)) {
            allSpaces[key].end();
          }
        });
      }
    };
  };

  root.amnesiac = {
    namespace: namespace
  };

})(this);
