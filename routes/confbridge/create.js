module.exports = function(req, res) {
    res.render('confbridge/edit', {
        'title': 'Create a Conference',
        'admin': req.user.admin,
        'conference': req.conference
    });
}
