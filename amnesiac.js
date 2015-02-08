;(function (root) {

  var STATE_SEPARATOR = /\s*>\s*/g,
      STATE_JOINER = ' > ',
      ACTION_SPLITTER = ' => ',
      SERVICE_KEY = '____service____',
      INITIAL_EVENT = '____init____',
      CONCLUDING_EVENT = '____conclude____',
      SPACE_NAME_PREFIX = '@';

  var allSpaces = {};
  var allServices = {};
  var activeSpaces = {}; // TODO

  var slice = [].slice;

  var noop = function () {};

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
    return actionName.split(ACTION_SPLITTER)[1];
  };

  var getActionString = function (actionName) {
    return actionName.split(ACTION_SPLITTER)[0];
  };

  var extractVariableNames = function (string) {
    return (string.match(/\[\w+\]/g) || []).map(function (key) {
      return key = key.slice(1, key.length - 1);
    });
  };

  var extractVariables = function (string, object) {
    object || (object = {});
    return extractVariableNames(string).reduce(function (variables, key) {
      variables[key] = object[key];
      return variables;
    }, {});
  };

  var registerServiceCommand = function (spaceName, stateName, noticerName, eventName, serviceName, actionName) {
    var stateNode = getStateNode(spaceName, stateName);
    var eventKey = joinNames(noticerName, eventName);
    var previousFunction = stateNode._events[eventKey] || noop;
    var valueKey = getValueKey(actionName);
    actionName = getActionString(actionName);
    stateNode._events[eventKey] = function (variables) {
      var value = previousFunction(variables);
      if (valueKey) variables[valueKey] = value;
      variables[SERVICE_KEY] = allSpaces[spaceName]._services[serviceName];
      return evalString(SERVICE_KEY + '.' + actionName, variables);
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

  var newTo = function (spaceName, stateName, noticerName, eventName, serviceName) {
    return {
      to: function (actionName) {
        registerServiceCommand(spaceName, stateName, noticerName, eventName, serviceName, actionName);
        return newTell(spaceName, stateName, noticerName, eventName);
      },
      that: function (differentEventName, variableString) {
        registerPeerNotification(spaceName, stateName, noticerName, eventName, serviceName, differentEventName, variableString);
        return newTell(spaceName, stateName, noticerName, eventName);
      }
    }
  };

  var newTell = function (spaceName, stateName, noticerName, eventName) {
    return {
      tell: function (serviceName) {
        return newTo(spaceName, stateName, noticerName, eventName, serviceName);
      },
      become: function (nextStateName, variableString) {
        registerStateChange(spaceName, stateName, noticerName, eventName, nextStateName, variableString);
        return this;
      },
      notify: function (peerName) {
        registerPeerNotification(spaceName, stateName, noticerName, eventName, peerName);
        return this;
      },
      end: function () {
        registerConcludingEvent(spaceName, stateName, noticerName, eventName);
      },
      ignore: function () {
        registerNoop(spaceName, stateName, noticerName, eventName);
      }
    }
  }

  var newNotices = function (spaceName, stateName, noticerName) {
    return {
      notices: function (eventName) {
        return newTell(spaceName, stateName, noticerName, eventName);
      },
      begins: function () {
        return newTell(spaceName, stateName, noticerName, INITIAL_EVENT);
      },
      ends: function () {
        return newTell(spaceName, stateName, noticerName, CONCLUDING_EVENT);
      }
    };
  };

  var newWhen = function (spaceName, stateName) {
    return {
      when: function (noticerName) {
        return newNotices(spaceName, stateName, noticerName);
      }
    };
  };

  var stateDefiner = function (spaceName, stateName) {
    return {
      define: function (definition) {
        allSpaces[spaceName]._definitions.push(function () {
          new definition(newWhen(spaceName, stateName));
        });
        return allSpaces[spaceName];
      }
    };
  };

  var newNoticeFunction = function (spaceName, serviceName) {
    var space = allSpaces[spaceName];
    var notice = function (eventName, variables) {
      if (space._ended) return;
      var callback = space._currentState[joinNames(serviceName, eventName)];
      if (callback) {
        variables = extend(extend({}, space._stateVariables), extractVariables(eventName, variables));
        callback(variables || {});
      }
    };
    notice.cleanup = function (callback) {
      allSpaces[spaceName]._cleanupCallbacks.push(callback);
    }
    return notice;
  };

  var serviceDefiner = function (spaceName, serviceName) {
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
      newNoticeFunction(spaceName, spaceName)(INITIAL_EVENT);
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
      define: function (definition) {

      }
    };
  }

  var namespace = function (name) {
    return {
      namespace: function (name2) {
        return namespace(joinNames(name, name2));
      },
      statespace: function (statespaceName) {
        var spaceName = SPACE_NAME_PREFIX + joinNames(name, statespaceName);
        return allSpaces[spaceName] || (allSpaces[spaceName] = newSpace(spaceName));
      },
      service: function (serviceName) {
        var serviceName = joinNames(name, serviceName);
        return allServices[serviceName] || (allServices[serviceName] = newService(serviceName));
      },
      begin: function () {
        var nameDot = name + '.';
        Object.keys(allSpaces).forEach(function (key) {
          if (key.indexOf(nameDot) == (0 + SPACE_NAME_PREFIX.length)) {
            allSpaces[key].begin();
          }
        });
      }
    };
  };

  root.amnesiac = {
    namespace: namespace
  };

})(this);
