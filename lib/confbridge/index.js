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

}
