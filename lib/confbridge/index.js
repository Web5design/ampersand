var fs = require('fs'),
    glob = require('glob');

module.exports = function confbridge(db, ami, io) {
    var self = this;

    this.db = db;
    this.ami = ami;
    this.io = io;

    // Get the owner of a conference.
    this.owner = function(conference, callback) {
        if (typeof callback != 'function') callback = function(){};

        self.db.query('SELECT owner FROM confbridge WHERE conference=?', conference, function(err, result) {
            if (err) throw err;
            if (result.length) {
                callback(result[0].owner);
            } else {
                callback();
            }
        });
    }

    // Mute a channel
    this.mute = function(conference, channel) {
    }

    // Unmute a channel
    this.unmute = function(conference, channel) {
    }

    // Kick a channel
    this.kick = function(conference, channel) {
    }

    // List channels in a conference
    this.list = function(conference) {
    }

    // List all conferences in progress
    this.listRooms = function() {
    }

    // List recordings
    this.recordings = function(conference) {
    }

    // Start recording
    this.startRecord = function(conference) {
    }

    // Stop recording
    this.stopRecord = function(conference) {
    }

    // Fire a confbridgeEvent
    this.event = function(event) {
    }

    // Create a new random conference number and add it to the req object.
    this.random = function(length) {
        return function(req, res, next) {

            // Get a random number of the specified length.
            var conference = (Math.floor(Math.random() * (9 - 1) + 1)).toString();
            for (var i = 1; i < length; i++) {
                conference = conference + (Math.floor(Math.random() * 9)).toString();
            }

            // Prevent conference number collisions.
            var verify = function(conference) {
                self.db.query('SELECT conference FROM confbridge WHERE conference=?', conference, function(err, result) {
                    if (result.length) {
                        verify(conference + 1);
                    }
                    else {
                        req.conference = conference;
                        next();
                    }
                });
            }
            verify(conference);

        }
    }

    // Save a conference
    this.save = function(req, res) {
        if (req.body.save) {
            // Save was clicked, process the form data.
            var conference = {};
            conference.name = (req.body.name) ? req.body.name : '';
            conference.conference = (req.body.conference) ? req.body.conference : '';
            conference.music_on_hold_when_empty = (req.body.music_on_hold_when_empty) ? 1 : 0;
            conference.quiet = (req.body.quiet) ? 1 : 0;
            conference.announce_user_count = (req.body.announce_user_count) ? 1 : 0;
            conference.announce_only_user = (req.body.announce_only_user) ? 1 : 0;
            conference.announce_join_leave = (req.body.announce_join_leave) ? 1 : 0;
            conference.record_conference = (req.body.record_conference) ? 1 : 0;

            // Write to the database.
            if (req.body.id) {
                self.db.query('UPDATE confbridge SET ? WHERE id=?', [conference, req.body.id], function(err, result) {
                    if (err) throw err;
                    res.redirect('/confbridge/view/' + req.body.conference);
                });
            } else {
                self.db.query('INSERT INTO confbridge SET ?', conference, function(err, result) {
                    if (err) throw err;
                    res.redirect('/confbridge/view/' + req.body.conference);
                });
            }

        } else {
            // Cancel was clicked
            if (req.body.id) {
                res.redirect('/confbridge/view/' + req.body.confernece);
            } else {
                res.redirect('/');
            }
        }
    }

    // Load a conference into the request object.
    this.load = function(req, res, next) {
        self.db.query('SELECT * FROM confbridge WHERE conference=?', req.params.conference, function(err, result) {
            if (err) throw err;
            if (result.length) {
                req.conference = result[0];
            } else {
                res.redirect('/confbridge/create');
            }
            next();
        });
    }
}
