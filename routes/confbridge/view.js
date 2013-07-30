module.exports = function(req, res) {
    res.render('confbridge/view', {
        'title': 'View Conference',
        'admin': req.user.admin,
        'conference': req.conference,
        'dial': req.config.dial
    });
}
