// Module Dependencies
var express = require('express'),
    http = require('http'),
    path = require('path'),
    mysql = require('mysql'),
    socket = require('socket.io'),
    passport = require('passport');

// Configuration
var routes = require('./routes'),
    config = require('./config.json');

// Application Initializations
var app = express(),
    server = http.createServer(app),
    io = socket.listen(server, { 'log level': 2 }),
    db = mysql.createConnection(config.mysql),
    ami = new(require('asterisk-manager'))(
            config.asterisk.port,
            config.asterisk.host,
            config.asterisk.user,
            config.asterisk.password,
            true);

// Confbridge Controller
var confbridge = new (require('./lib/confbridge'))(db, ami, io, config.confbridge);

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
    app.use(express.cookieSession({secret: config.session.secret, key: config.session.key}));
    app.use(express.session({ secret: config.session.secret, key: config.session.key }));

    // Enable passport middleware
    app.use(passport.initialize());
    app.use(passport.session());

    // Add config to request object
    app.use(function(req, res, next) {
        req.config = config;
        next();
    });
});

// Routes
app.get('/', restricted, confbridge.listRooms, routes.index);

app.get('/confbridge/create', restricted, confbridge.create, routes.confbridge.create)
app.get('/confbridge/edit/:conference', restricted, confbridge.load, routes.confbridge.edit);
app.get('/confbridge/view/:conference', restricted, confbridge.load, routes.confbridge.view);
app.get('/confbridge/delete/:conference', restricted, confbridge.load, confbridge.delete);
app.get('/confbridge/recordings/:conference/:file', restricted, confbridge.load, routes.confbridge.recordings);

app.post('/confbridge/save', restricted, confbridge.save);

// Login/Logout
app.get('/logout', routes.logout);
app.get('/login', routes.login);
app.post('/login', passport.authenticate('ldap', { successRedirect: '/',
                                                   failureRedirect: '/login' }));

// Middleware function to restrict access to authenticated users.
function restricted(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// Middleware function to restrict access to admin users.
function admin(req, res, next) {
    if (req.user.admin) return next();
    res.status(403);
    res.render('403');
}

// Socket.io authorization sharing with Express.
io.configure(function () {
    io.set('authorization', function(data, accept) {
        express.cookieParser(config.session.secret)(data, {}, function(err) {
            if (err || !data.signedCookies[config.session.key].passport.user) {
                accept(null, false);
            } else {
                data.user = JSON.parse(data.signedCookies[config.session.key].passport.user);
                accept(null, true);
            }
        });
    });
});

// Start the express server.
server.listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});

// Listen for socket.io client callbacks
io.sockets.on('connection', function(socket) {
    if (socket.handshake.user.admin) {
        socket.join('admin');
    } else {
        socket.join(socket.handshake.user.id);
    }
});

