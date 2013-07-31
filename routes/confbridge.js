exports.create = function(req, res) {
    res.render('confbridge/edit', {
        'title': 'Create a Conference',
        'admin': req.user.admin,
        'conference': req.conference
    });
}

exports.view = function(req, res) {
    res.render('confbridge/view', {
        'title': 'View Conference',
        'admin': req.user.admin,
        'socket': { port: req.config.client.port },
        'conference': req.conference,
        'dial': req.config.confbridge.dial,
        'controls': req.config.confbridge.controls
    });
}

exports.edit = function(req, res) {
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

exports.recordings = function(req, res) {
    // Only conference owners and admins can download recordings
    if (req.conference.admin) {
        res.download(req.conference.recordings + '/' + req.params.file);
    }
    else {
        res.status(403);
        res.render('403');
    }
}
