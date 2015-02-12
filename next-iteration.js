/**
 * amnesiac.js 0.0.0
 * Copyright 2015 Dan Allison
 * Available under MIT license
 */
;(function (root) {
  // constants
  var NAMESPACE_PREFIX = '#',
      CONTROLLER_PREFIX = '^',
      SERVICE_PREFIX = '@';

  // flat collections
  var allNamespaces = {},
      allControllers = {},
      allServices = {};

  // utilities
  var noop = function () {},
      extend = function (extending, extension) {
        for (var key in extension) extending[key] = extension[key];
        return extending;
      },
      clone = function (object) { return extend({}, object); },
      evalExpression = function (string, variables) {
        return (new Function('v','with (v) return ' + string))(variables || {});
      };

  // validations
  var isAlphanumeric = function (string) { return (/^\w+$/).test(string); };

 /**
  * Classes: Namespace, Controller, Service
  *
  */

  // Namespace
  function Namespace (name) {
    this._name = name;
  }

  var NamespacePrototype = Namespace.prototype;

  NamespacePrototype.contents = function (contents) {
    this.contents = throwError;
  };

  // Controller


  // Service



  var namespace = function (namespaceName) {
    if (!isAlphanumeric(namespaceName)) throw 'namespace names can only contain alphanumeric characters';
    namespaceName = NAMESPACE_PREFIX + namespaceName;
    return allNamespaces[namespaceName] || (allNamespaces[namespaceName] = new Namespace(namespaceName));
  }

  root.amnesiac = {
    namespace: namespace
  };

})(this);
