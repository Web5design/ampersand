module.exports = function(req, res) {
    res.render('confbridge/edit', {
        'title': 'Create a Conference',
        'conference': {
            'conference': req.conference,
            'announce_user_count': true,
            'announce_only_user': true,
            'record_conference': true
        }
    });
}
