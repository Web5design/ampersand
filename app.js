// Module Dependencies
var express = require('express'),
    http = require('http'),
    path = require('path'),
    mysql = require('mysql'),
    fs = require('fs'),
    glob = require('glob'),
    socket = require('socket.io'),
    passport = require('passport');

// Local Dependencies
var routes = require('./routes'),
    config = require('./config.json');

// Application Initializations
var app = express(),
    server = http.createServer(app),
    io = socket.listen(server, { 'log level': 2 }),
    db = mysql.createConnection(config.mysql);

// Session Handlers
var cookie = express.cookieParser(config.session.secret),
    store = new express.session.MemoryStore(),
    session = express.session({ secret: config.session.secret, key: config.session.key, store: store });

// Passport Configuration
var LDAPStrategy = require('./lib/passport-ldap').Strategy
passport.use(new LDAPStrategy(config.ldap, function(profile, done) {
    return done(null, profile);
}));

passport.serializeUser(function(user, done) {
    done(null, JSON.stringify(user));
});

passport.deserializeUser(function(id, done) {
    done(null, JSON.parse(id));
});

// Application Configuration
app.configure(function() {
    app.set('port', process.env.PORT || config.server.port);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'twig');
    app.set('twig options', { strict_variables: false });

    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.cookieParser());
    app.use(express.bodyParser());

    // Enable express sessions
    app.use(cookie);
    app.use(session);

    // Enable passport middleware
    app.use(passport.initialize());
    app.use(passport.session());
});

// Routes
app.get('/', restricted, routes.index);

// Login/Logout
app.get('/login', function(req, res) {
    res.render('login');
});
app.post('/login', passport.authenticate('ldap', { successRedirect: '/',
                                                   failureRedirect: '/login' }));
app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/login');
});

// Middleware function to restrict access to authenticated users.
function restricted(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// Start the express server
server.listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
