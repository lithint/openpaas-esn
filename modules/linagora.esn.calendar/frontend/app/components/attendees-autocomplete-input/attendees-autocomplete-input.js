(function() {
  'use strict';

  angular.module('esn.calendar')
         .directive('calAttendeesAutocompleteInput', calAttendeesAutocompleteInput);

  function calAttendeesAutocompleteInput() {
    var directive = {
      restrict: 'E',
      templateUrl: '/calendar/app/components/attendees-autocomplete-input/attendees-autocomplete-input.html',
      scope: {
        originalAttendees: '=',
        mutableAttendees: '='
      },
      replace: true,
      controller: AttendeesAutocompleteInputController,
      controllerAs: 'vm',
      bindToController: true
    };

    return directive;
  }

  AttendeesAutocompleteInputController.$inject = [
    'calendarAttendeeService',
    'emailService',
    'naturalService',
    'session',
    'AUTOCOMPLETE_MAX_RESULTS'
  ];

  function AttendeesAutocompleteInputController(calendarAttendeeService, emailService, naturalService, session, AUTOCOMPLETE_MAX_RESULTS) {
    var self = this;

    self.mutableAttendees = self.mutableAttendees || [];
    self.onAddingAttendee = onAddingAttendee;
    self.getInvitableAttendees = getInvitableAttendees;

    ////////////

    function onAddingAttendee(att) {
      if (!att.id) {
        att.id = att.displayName;
        att.email = att.displayName;
      }

      return !_isDuplicateAttendee(att, _getAddedAttendeeIds()) && emailService.isValidEmail(att.email);
    }

    function getInvitableAttendees(query) {
      self.query = query;

      return calendarAttendeeService.getAttendeeCandidates(query, AUTOCOMPLETE_MAX_RESULTS * 2).then(function(attendeeCandidates) {
        attendeeCandidates = _fillNonDuplicateAttendees(attendeeCandidates);
        attendeeCandidates.sort(function(a, b) {
          return naturalService.naturalSort(a.displayName, b.displayName);
        });

        return attendeeCandidates.slice(0, AUTOCOMPLETE_MAX_RESULTS);
      });
    }

    function _fillNonDuplicateAttendees(attendees) {
      var addedAttendeeIds = _getAddedAttendeeIds();

      return attendees.filter(function(att) {
        return !_isDuplicateAttendee(att, addedAttendeeIds);
      });
    }

    function _getAddedAttendeeIds() {
      var addedAttendees = self.mutableAttendees.concat(self.originalAttendees || []);
      var addedAttendeeIds = [];

      addedAttendees.forEach(function(att) {
        addedAttendeeIds.push(att.id);
      });

      return addedAttendeeIds;
    }

    function _isDuplicateAttendee(att, addedAttendeeIds) {
      return (att.email in session.user.emailMap) || addedAttendeeIds.indexOf(att.id) > -1;
    }
  }

})();
