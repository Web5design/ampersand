exports.index = function(req, res) {
    res.render('index', {
        'title': 'Dashboard',
        'admin': req.user.admin,
        'confbridge': req.confbridgeListRooms
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

exports.confbridge = require('./confbridge');
