// Module dependencies.
var util = require('util');
var ldap = require('ldapjs');
var passport = require('passport');

function Strategy(options, verify) {
  if (!verify) throw new Error('LDAP authentication strategy requires a verify function');

  passport.Strategy.call(this);

  this.name = 'ldap';
  this.client = ldap.createClient(options.server);
  this._verify = verify;
  this._options = options;
}

// Inherit from `passport.Strategy`.
util.inherits(Strategy, passport.Strategy);

// Authenticate to the LDAP server.
Strategy.prototype.authenticate = function(req, options) {
  var self = this;

  if (!req.body.username || !req.body.password) {
    return self.fail(401);
  }

  var username = req.body.username,
      password = req.body.password;

  // Bind to the directory.
  self.client.bind(self._options.bind.dn, self._options.bind.password, function(err) {
      if (err) {
          if (self._options.debug) console.log('(EE) [ldapjs] LDAP error:', err.stack);
          return self.fail(403);
      }

      // Search for the user entry DN.
      if (self._options.search.filter) {
          var filter = '(&(' + self._options.uidTag + '=' + username + ')' + self._options.search.filter + ')';
      } else {
          var filter = '(' + self._options.uidTag + '=' + username + ')';
      }
      var search = {
          scope: self._options.search.scope,
          filter: filter,
          attributes: ['dn', 'memberOf']
      }
      self.client.search(self._options.base, search, function(err, res) {
          if (err) {
              if (self._options.debug) console.log('(EE) [ldapjs] LDAP error:', err.stack);
              return self.fail(403);
          }

          var results = [];

          // Populate the search results array.
          res.on('searchEntry', function(entry) {
              results[results.length] = entry;
          });

          res.on('end', function(result) {
              if (results.length) {
                  // Attempt to bind with the user-supplied password
                  self.client.bind(results[0].dn, password, function(err) {
                      if (err) return self.fail(403);

                      var admin = false;
                      if (results[0].attributes[0]) {
                          admin = (results[0].attributes[0].vals.indexOf(self._options.admin) >= 0);
                      }

                      return self.success({
                          id: username,
                          admin: admin
                      });
                  });
              } else {
                  // User was not found
                  return self.fail(403);
              }
          });
      });
  });

};

// Expose `Strategy`.
module.exports = Strategy;
