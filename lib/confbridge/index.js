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
    this.create = function(req, res, next) {

        var conference = {};
        conference.owner = req.user.id;
        conference.conference = Math.floor(Math.random() * (999999 - 100000) + 100000);
        conference.music_on_hold_when_empty = (req.config.conference.music_on_hold_when_empty) ? 1: 0;
        conference.quiet = (req.config.conference.quiet) ? 1 : 0;
        conference.announce_join_leave = (req.config.conference.announce_join_leave) ? 1 : 0;
        conference.record_conference = (req.config.conference.record_conference) ? 1 : 0;

        // Prevent conference number collisions.
        var verify = function(conference, callback) {
            self.db.query('SELECT conference FROM confbridge WHERE conference=?', conference, function(err, result) {
                if (result.length) {
                    verify(conference + 1, callback);
                }
                else {
                    callback(conference);
                }
            });
        }
        verify(conference.conference, function(num) {
            conference.conference = num;
            req.conference = conference;
            next();
        });
    }

    // Save a conference
    this.save = function(req, res) {
        if (req.body.save) {
            // Save was clicked, process the form data.
            var conference = {};
            conference.owner = req.user.id;
            conference.name = (req.body.name) ? req.body.name : '';
            conference.conference = (req.body.conference) ? req.body.conference : '';
            conference.music_on_hold_when_empty = (req.body.music_on_hold_when_empty) ? 1 : 0;
            conference.quiet = (req.body.quiet) ? 1 : 0;
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
                res.redirect('/confbridge/view/' + req.body.conference);
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
                req.conference.privileged = (req.user.admin || result[0].owner == req.user.id);
            } else {
                res.redirect('/confbridge/create');
            }
            next();
        });
    }

    this.listRooms = function(req, res, next) {
        self.db.query('SELECT conference, name, owner FROM confbridge ORDER BY owner ASC', function(err, result) {
            if (err) throw err;
            req.confbridgeListRooms = result;
            next();
        });
    }
}
