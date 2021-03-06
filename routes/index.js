exports.index = function(req, res) {
    res.render('index', {
        'title': 'Dashboard',
        'admin': req.user.admin,
        'user': req.user.id,
        'socket': { port: req.config.client.port },
        'dial': req.config.confbridge.dial,
    });
}

exports.login = function(req, res) {
    res.render('login', {
        title: 'Login'
    });
}

exports.logout = function(req, res) {
    req.logout();
    res.redirect('/login');
}

exports.events = function(req, res) {
    res.render('events', {
        title: 'Event Log',
        admin: req.user.admin,
        socket: { port: req.config.client.port }
    });
}

exports.confbridge = require('./confbridge');
