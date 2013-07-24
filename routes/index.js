exports.index = function(req, res) {
    res.render('index');
}

exports.login = require('./login');
