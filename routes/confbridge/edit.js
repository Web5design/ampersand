module.exports = function(req, res) {
    res.render('confbridge/edit', {
        'title': 'Edit Conference',
        'admin': req.user.admin,
        'conference': req.conference
    });
}
