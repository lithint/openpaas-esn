'use strict';

angular.module('esn.project', [
  'esn.router',
  'restangular',
  'esn.avatar',
  'esn.session',
  'esn.core',
  'esn.activitystreams-tracker',
  'esn.notification',
  'angularFileUpload',
  'mgcrea.ngStrap.tooltip',
  'mgcrea.ngStrap.helpers.dimensions',
  'mgcrea.ngStrap.helpers.dateParser',
  'mgcrea.ngStrap.datepicker',
  'op.dynamicDirective'
])
  .config(function($stateProvider, routeResolver, dynamicDirectiveServiceProvider) {

    $stateProvider.state('/project/:project_id', {
      url: '/project/:project_id',
      templateUrl: '/project/views/partials/project',
      controller: 'projectController',
      resolve: {
        project: routeResolver.api('projectAPI', 'get', 'project_id', '/project')
      }
    })
    .state('/project', {
      url: '/project',
      templateUrl: '/project/views/projects',
      controller: 'projectsController',
      resolve: {
        domain: routeResolver.session('domain'),
        user: routeResolver.session('user')
      }
    })
    .state('/collaborations/project/:project_id/members', {
      url: '/collaborations/project/:project_id/members',
      templateUrl: '/project/views/project-members',
      controller: 'projectController',
      resolve: {
        project: routeResolver.api('projectAPI', 'get', 'project_id', '/project')
      }
    });

    var project = new dynamicDirectiveServiceProvider.DynamicDirective(true, 'application-menu-project', {priority: 25});
    dynamicDirectiveServiceProvider.addInjection('esn-application-menu', project);
  })
  .run(function(projectAdapterService, objectTypeAdapter, ASTrackerSubscriptionService, projectAPI) {
    objectTypeAdapter.register('project', projectAdapterService);
    ASTrackerSubscriptionService.register('project', {get: projectAPI.get});
  });
