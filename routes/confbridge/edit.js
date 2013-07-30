module.exports = function(req, res) {
    res.render('confbridge/edit', {
        'title': 'Edit Conference',
        'conference': req.conference
    });
}
