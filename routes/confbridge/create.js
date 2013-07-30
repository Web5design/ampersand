module.exports = function(req, res) {
    res.render('confbridge/edit', {
        'title': 'Create a Conference',
        'conference': {
            'conference': req.conference,
            'announce_user_count': 1,
            'announce_only_user': 1,
            'record_conference': 1
        }
    });
}
