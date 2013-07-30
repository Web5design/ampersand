module.exports = function(req, res) {
    // Only conference owners and admins can download recordings
    if (req.conference.admin) {
        res.download(req.conference.recordings + '/' + req.params.file);
    }
    else {
        res.status(403);
        res.render('403');
    }
}
