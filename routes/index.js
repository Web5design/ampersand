exports.index = function(req, res) {
    res.render('index', {
        'title': 'Dashboard',
        'admin': req.user.admin,
        'confbridge': req.confbridgeListRooms
    });
}

exports.login = require('./login');
exports.logout = require('./logout');

exports.confbridge = {};
exports.confbridge.create = require('./confbridge/create');
exports.confbridge.view = require('./confbridge/view');
exports.confbridge.edit = require('./confbridge/edit');
