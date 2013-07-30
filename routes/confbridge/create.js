module.exports = function(req, res) {
    res.render('confbridge/edit', {
        'title': 'Create a Conference',
        'admin': req.user.admin,
        'conference': {
            'conference': req.conference,
            'owner': req.user.id,
            'announce_user_count': 1,
            'announce_only_user': 1,
            'record_conference': 1
        }
    });
}
