'use strict';

var mongoose = require('mongoose');
var Domain = mongoose.model('Domain');
var User = mongoose.model('User');
var userDomain = require('../../core/user/domain');
var userIndex = require('../../core/user/index');
var logger = require('../../core').logger;
var async = require('async');
var q = require('q');
var pubsub = require('../../core/pubsub').local;
var denormalizeUser = require('../denormalize/user').denormalize;
var _ = require('lodash');

function createDomain(req, res) {
  var data = req.body;
  var company_name = data.company_name;
  var name = data.name;

  if (!data.administrators || !data.administrators.length) {
    return res.status(400).send({ error: { status: 400, message: 'Bad Request', details: 'An administrator is required'}});
  }

  var users = data.administrators.map(function(administrator) {
    return new User(administrator);
  });

  var missEmailsField = users.some(function(user) {
    return !user.emails || user.emails.length === 0;
  });

  if (missEmailsField) {
    return res.status(400).send({ error: { status: 400, message: 'Bad Request', details: 'One of administrator does not have any email address'}});
  }

  var administrators = users.map(function(user) {
    return {
      user_id: user
    };
  });

  var domainJson = {
    name: name,
    company_name: company_name,
    administrators: administrators
  };

  var domain = new Domain(domainJson);

  domain.save(function(err, saved) {
    if (err) {
      return res.status(500).send({ error: { status: 500, message: 'Server Error', details: 'Can not create domains ' + name + '. ' + err.message}});
    }
    if (saved) {
      return res.status(201).end();
    }

    return res.status(404).end();
  });
}

module.exports.createDomain = createDomain;

/**
 * Get Members of a domain
 *
 * @param {Request} req
 * @param {Response} res
 */
function getMembers(req, res) {
  var uuid = req.params.uuid;
  if (!uuid) {
    return res.status(400).json({error: {code: 400, message: 'Bad parameters', details: 'Domain ID is missing'}});
  }

  var query = {
    limit: req.query.limit || 50,
    offset: req.query.offset || 0,
    search: req.query.search || null
  };

  Domain.loadFromID(uuid, function(err, domain) {
    if (err) {
      return res.status(500).json({ error: { status: 500, message: 'Server error', details: 'Can not load domain: ' + err.message}});
    }

    if (!domain) {
      return res.status(404).json({ error: { status: 404, message: 'Not Found', details: 'Domain ' + uuid + ' has not been found'}});
    }

    if (query.search) {
      userDomain.getUsersSearch([domain], query, function(err, result) {
        if (err) {
          return res.status(500).json({ error: { status: 500, message: 'Server error', details: 'Error while searching members: ' + err.message}});
        }

        q.all(result.list.map(function(user) {
          return denormalizeUser(user);
        })).then(function(denormalized) {
          res.header('X-ESN-Items-Count', result.total_count);
          res.status(200).json(denormalized);
        });
      });
    } else {
      userDomain.getUsersList([domain], query, function(err, result) {
        if (err) {
          return res.status(500).json({ error: { status: 500, message: 'Server error', details: 'Error while listing members: ' + err.message}});
        }

        q.all(result.list.map(function(user) {
          return denormalizeUser(user);
        })).then(function(denormalized) {
          res.header('X-ESN-Items-Count', result.total_count);
          res.status(200).json(denormalized);
        });
      });
    }
  });
}
module.exports.getMembers = getMembers;

/**
 * Send invitations to a list of emails.
 *
 * @param {Request} req - The request with user and domain as attribute. The body MUST contains an array of emails.
 * @param {Response} res
 */
function sendInvitations(req, res) {
  if (!req.body || !(req.body instanceof Array)) {
    return res.status(400).json({ error: { status: 400, message: 'Bad request', details: 'Missing input emails'}});
  }

  var emails = req.body;
  var user = req.user;
  var domain = req.domain;
  var handler = require('../../core/invitation');
  var Invitation = mongoose.model('Invitation');
  var getInvitationURL = require('./invitation').getInvitationURL;
  var sent = [];

  res.status(202).end();

  var sendInvitation = function(email, callback) {

    var payload = {
      type: 'addmember',
      data: {
        user: user,
        domain: domain,
        email: email
      }
    };

    handler.validate(payload, function(err, result) {
      if (err || !result) {
        logger.warn('Invitation data is not valid %s : %s', payload, err ? err.message : result);
        return callback();
      }

      var invitation = new Invitation(payload);
      invitation.save(function(err, saved) {
        if (err) {
          logger.error('Can not save invitation %s : %s', payload, err.message);
          return callback();
        }

        saved.data.url = getInvitationURL(req, saved);
        handler.init(saved, function(err, result) {
          if (err || !result) {
            logger.error('Invitation can not be initialized %s : %s', saved, err ? err.message : result);
          } else {
            sent.push(email);
          }
          return callback();
        });
      });
    });
  };

  async.eachLimit(emails, 10, sendInvitation, function(err) {
    if (err) {
      logger.error('Unexpected error occured : %s', err);
    }
    logger.info('Invitations have been sent to emails %s', '' + sent);
    pubsub.topic('domain:invitations:sent').publish({user: user._id, domain: domain._id, emails: sent});
  });
}
module.exports.sendInvitations = sendInvitations;

function getDomain(req, res) {
  if (req.domain) {
    return res.status(200).json(req.domain);
  }
  return res.status(404).json({error: 404, message: 'Not found', details: 'Domain not found'});
}
module.exports.getDomain = getDomain;

function createMember(req, res) {
  if (!req.body || _.isEmpty(req.body)) {
    return res.status(400).json({ error: { code: 400, message: 'Bad request', details: 'Missing input member' } });
  }

  userIndex.recordUser(req.body, function(err, user) {
    if (err) {
      return res.status(500).json({ error: { code: 500, message: 'Server Error', details: 'Can not create member. ' + err.message } });
    }

    return res.status(201).json(user);
  });
}
module.exports.createMember = createMember;

function getDomainAdministrators(req, res) {
  userDomain.getAdministrators(req.domain, function(err, administrators) {
    if (err || !administrators) {
      logger.error('Can not get domain administrators : %s', err);

      return res.status(500).json({ error: { code: 500, message: 'Server Error', details: 'Can not get domain administrators. ' + err.message } });
    }

    q.all(administrators.map(function(administrator) {
        return denormalizeUser(administrator).then(function(denormalized) {
          denormalized.role = administrator.role;
          return denormalized;
        });
      }))
      .then(function(denormalizeds) {
        res.status(200).json(denormalizeds);
      });
  });
}
module.exports.getDomainAdministrators = getDomainAdministrators;

function addDomainAdministrator(req, res) {
  var domain = req.domain;
  var userIds = req.body;

  if (!Array.isArray(userIds)) {
    return res.status(400).json({
      error: { code: 400, message: 'Bad request', details: 'body should be an array of user\'s ID'}
    });
  }

  userDomain.addDomainAdministrator(domain, userIds, function(err) {
    if (err) {
      logger.error('Error while adding domain administrators:', err);

      return res.status(500).json({
        error: { code: 500, message: 'Server Error', details: 'Error while adding domain administrators' }
      });
    }

    res.status(204).end();
  });
}
module.exports.addDomainAdministrator = addDomainAdministrator;

function removeDomainAdministrator(req, res) {
  var domain = req.domain;
  var administratorId = req.params.administratorId;

  if (req.user._id.equals(administratorId)) {
    return res.status(403).json({
      error: { code: 403, message: 'Forbidden', details: 'You cannot remove yourself' }
    });
  }

  userDomain.removeDomainAdministrator(domain, administratorId, function(err) {
    if (err) {
      logger.error('Error while removing domain administrator:', err);

      return res.status(500).json({
        error: { code: 500, message: 'Server Error', details: 'Error while removing domain administrator' }
      });
    }

    res.status(204).end();
  });
}
module.exports.removeDomainAdministrator = removeDomainAdministrator;
