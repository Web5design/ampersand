/**
 * Module dependencies.
 */
var util = require('util');
var ldap = require('ldapjs');
var passport = require('passport');

/**
 * `Strategy` constructor.
 *
 * An LDAP authentication strategy authenticates requests by delegating to the
 * given ldap server using the openldap protocol.
 *
 * Applications must supply a `verify` callback which accepts a user `profile` entry
 * from the directory, and then calls the `done` callback supplying a `user`, which
 * should be set to `false` if the credentials are not valid.  If an exception occured,
 * `err` should be set.
 *
 * Options:
 *   - `server`  ldap server connection options - http://ldapjs.org/client.html#create-a-client
 *   - `base`    the base DN to search against
 *   - `search`  an object of containing search options - http://ldapjs.org/client.html#search
 *
 * Examples:
 *
 *     passport.use(new LDAPStrategy({
 *        server: {
 *          url: 'ldap://0.0.0.0:1389'
 *        },
 *        base: 'cn=users,dc=example,dc=local',
 *        search: {
 *          filter: '(&(l=Seattle)(email=*@foo.com))',
 *        }
 *      },
 *      function(profile, done) {
 *        return done(null, profile);
 *      }
 *    ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
  if (typeof options == 'function') {
    verify = options;
    options = {
      server: {
        url : ''
      },
      base: '',
      search: {
        filter: '',
        scope: 'sub'
      },
      authOnly: false,
      authMode: 1,        // 0 win, 1 Unix (linux, Solaris, ...)
      uidTag: 'uid',       // Linux OpenLDAP 'uid', Sun Solaris 'cn'
      debug: false
    };
  }
  if (!verify) throw new Error('LDAP authentication strategy requires a verify function');

  passport.Strategy.call(this);

  this.name = 'ldap';
  this.client = ldap.createClient(options.server);
  this._verify = verify;
  this._options = options;
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Strategy, passport.Strategy);

/**
 * Authenticate request by binding to LDAP server, and then searching for the user entry.
 * 
 * Command line LDAP bind and search examples:
 * - Windows with Active Directory: ldapsearch -H ldap://192.168.1.17:389 -D XXX -w YYY -b dc=example,dc=local objectclass=*
 * - Linux/Sun Solaris with OpenLDAP: ldapsearch -H ldap://192.168.1.16:389 -D cn=XXX,dc=example,dc=local -w YYY -b dc=example,dc=local objectclass=*
 *
 * @param {Object} req
 * @api protected
 */
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
                      var admin = (results[0].attributes[0].vals.indexOf(self._options.admin) >= 0);
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

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;

