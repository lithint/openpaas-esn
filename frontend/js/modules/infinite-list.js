'use strict';

angular.module('esn.infinite-list', ['infinite-scroll'])

  .constant('INFINITE_LIST_EVENTS', {
    LOAD_MORE_ELEMENTS: 'infiniteList:loadMoreElements',
    REMOVE_ELEMENTS: 'infiniteList:removeElements',
    ADD_ELEMENTS: 'infiniteList:addElements'
  })

  .constant('defaultConfiguration', {
    scrollDistance: 0.5,
    scrollDisabled: false,
    scrollImmediateCheck: 'true',
    throttle: 10
  })

  .config(function($provide, defaultConfiguration) {
    $provide.value('THROTTLE_MILLISECONDS', defaultConfiguration.throttle);
  })

  .factory('infiniteListService', function($rootScope, $q, INFINITE_LIST_EVENTS) {
    function loadMoreElements() {
      $rootScope.$broadcast(INFINITE_LIST_EVENTS.LOAD_MORE_ELEMENTS);
    }

    function addElement(element) {
      addElements([element]);
    }

    function addElements(elements) {
      $rootScope.$broadcast(INFINITE_LIST_EVENTS.ADD_ELEMENTS, elements);
    }

    function removeElement(element) {
      removeElements([element]);
    }

    function removeElements(elements) {
      $rootScope.$broadcast(INFINITE_LIST_EVENTS.REMOVE_ELEMENTS, elements);
    }

    function actionRemovingElement(action, element, getRejectedElements) {
      return actionRemovingElements(action, [element], getRejectedElements);
    }

    function actionRemovingElements(action, elements, getRejectedElements) {
      removeElements(elements);

      return action().catch(function(err) {
        // This gives a chance to the caller to customize the list of rejected elements.
        // This is particularly useful for actions that may fail partially; in this case
        // you only want to add the elements that failed to the list, not the whole list of
        // elements. If no callback is given, all elements are added back to the list
        addElements(getRejectedElements ? getRejectedElements(err, elements) : elements);

        return $q.reject(err);
      });
    }

    return {
      loadMoreElements: loadMoreElements,
      addElement: addElement,
      addElements: addElements,
      removeElement: removeElement,
      removeElements: removeElements,
      actionRemovingElement: actionRemovingElement,
      actionRemovingElements: actionRemovingElements
    };
  })

  .directive('infiniteList', function(defaultConfiguration, INFINITE_LIST_EVENTS) {
    return {
      restrict: 'E',
      transclude: true,
      scope: {
        loadMoreElements: '&',
        infiniteScrollDistance: '=?',
        infiniteScrollDisabled: '=?',
        infiniteScrollImmediateCheck: '=?',
        scrollInsideContainer: '=?',
        elementSelector: '@'
      },
      controller: function($scope, $element) {
        this.getElementsCount = function() {
          if (!$scope.elementSelector) {
            return 0;
          }

          return $element.find($scope.elementSelector).length;
        };
      },
      controllerAs: 'infiniteList',
      compile: function() {
        return {
          pre: function(scope, element) {
            scope.infiniteScrollDistance = angular.isDefined(scope.infiniteScrollDistance) ? scope.infiniteScrollDistance : defaultConfiguration.scrollDistance;
            scope.infiniteScrollDisabled = angular.isDefined(scope.infiniteScrollDisabled) ? scope.infiniteScrollDisabled : defaultConfiguration.scrollDisabled;
            scope.infiniteScrollImmediateCheck = angular.isDefined(scope.infiniteScrollImmediateCheck) ? scope.infiniteScrollImmediateCheck : defaultConfiguration.scrollImmediateCheck;
            scope.infiniteScrollContainer = scope.scrollInsideContainer ? element.parent() : null;
            scope.infiniteScrollListenForEvent = INFINITE_LIST_EVENTS.LOAD_MORE_ELEMENTS;
            scope.marker = 'test';
          },
          post: angular.noop
        };
      },
      templateUrl: '/views/modules/infinite-list/infinite-list.html'
    };
  });
