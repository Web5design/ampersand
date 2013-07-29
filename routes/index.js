exports.index = function(req, res) {
    res.render('index', {
        title: 'Dashboard'
    });
}

exports.login = require('./login');
exports.logout = require('./logout');

exports.confbridge = {};
exports.confbridge.edit = require('./confbridge/edit');
exports.confbridge.create = require('./confbridge/edit');
