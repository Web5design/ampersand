module.exports = function(req, res) {
    // Only conference owners and admins can edit a conference
    if (req.conference.admin) {
        res.render('confbridge/edit', {
            'title': 'Edit Conference',
            'admin': req.user.admin,
            'conference': req.conference
        });
    } else {
        res.status(403);
        res.render('403');
    }
}
