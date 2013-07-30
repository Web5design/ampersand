var fs = require('fs'),
    glob = require('glob');

module.exports = function confbridge(db, ami, io) {
    var self = this;

    this.db = db;
    this.ami = ami;
    this.io = io;

    this.confbridgeList = [];
    this.confbridgeListRooms = [];

    // Fire a confbridgeEvent
    this.event = function(evt) {
        if (evt.conference) {
            self.io.sockets.in('confbridge/' + evt.conference).emit('confbridgeEvent', evt);
        } else {
            self.io.sockets.in('confbridge').emit('confbridgeEvent', evt);
        }
    }

    // Listen for Confbridge AMI events
    this.ami.on('confbridgestart', function(evt) {
        self.event(evt);
        //self.listRooms();
    });

    this.ami.on('confbridgeend', function(evt) {
        self.event(evt);
        //self.listRooms();
    });

    this.ami.on('confbridgejoin', function(evt) {
        self.event(evt);
        self.list(evt.conference);
        //self.listRooms();
    });

    this.ami.on('confbridgeleave', function(evt) {
        // Wait 1 second before firing follow-up events. Otherwise, Asterisk's
        // internal lists are not updated in time.
        setTimeout(function() {
            self.event(evt);
            self.list(evt.conference);
            //self.listRooms();
        }, 1000);
    });

    this.ami.on('confbridgetalking', self.event);
    this.ami.on('confbridgemute', self.event);
    this.ami.on('confbridgeunmute', self.event);
    this.ami.on('confbridgestartrecord', self.event);

    this.ami.on('confbridgestoprecord', function(evt) {
        self.event(evt);
        self.recordings(evt.conference);
    });

    this.ami.on('confbridgelock', self.event);
    this.ami.on('confbridgeunlock', self.event);
    this.ami.on('confbridgekick', self.event);

    this.ami.on('confbridgelist', function(evt) {
        if (self.confbridgeList[evt.actionid]) {
            self.confbridgeList[evt.actionid].list[self.confbridgeList[evt.actionid].list.length] = evt;
        }
    });

    this.ami.on('confbridgelistcomplete', function(evt) {
        if (self.confbridgeList[evt.actionid]) {
            evt.list = self.confbridgeList[evt.actionid].list;
            evt.conference = self.confbridgeList[evt.actionid].conference;
            delete self.confbridgeList[evt.actionid];
        }
        self.event(evt);
    });

    this.ami.on('confbridgelistrooms', function(evt) {
        if (self.listRooms[evt.actionid]) {
            self.listRooms[evt.actionid].list[self.listRooms[evt.actionid].list.length] = evt;
        }
    });

    this.ami.on('confbridgelistroomscomplete', function(evt) {
        if (self.listRooms[evt.actionid]) {
            evt.list = self.listRooms[evt.actionid].list;
            delete self.listRooms[evt.actionid];
        }
        self.event(evt);
    });

    // Listen for socket.io callbacks from clients.
    this.io.sockets.on('connection', function(socket) {

        // Client wants to receive events for a conference.
        socket.on('confbridge', function(conference) {
            self.owner(conference, function(owner) {
                // Only the conference owner and admins can subscribe to these events.
                if (socket.handshake.user.admin || socket.handshake.user.id == owner) {
                    socket.conference = conference;
                    socket.join('confbridge/' + conference);
                    self.list(conference);
                    //self.recordings(conference);
                }
            });
        });

        socket.on('confbridge/mute', function(channel) {
            self.owner(socket.conference, function(owner) {
                // Only the conference owner and admins can mute participants.
                if (socket.handshake.user.admin || socket.handshake.user.id == owner) {
                    self.mute(socket.conference, channel);
                }
            });
        });

        socket.on('confbridge/unmute', function(channel) {
            self.owner(socket.conference, function(owner) {
                // Only the conference owner and admins can unmute participants.
                if (socket.handshake.user.admin || socket.handshake.user.id == owner) {
                    self.unmute(socket.conference, channel);
                }
            });
        });

        socket.on('confbridge/kick', function(channel) {
            self.owner(socket.conference, function(owner) {
                // Only the conference owner and admins can kick participants.
                if (socket.handshake.user.admin || socket.handshake.user.id == owner) {
                    self.kick(socket.conference, channel);
                }
            });
        });
    });

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
        self.ami.action({
            'action': 'confbridgemute',
            'conference': conference,
            'channel': channel
        }, function(err, res) {
            if (res.response == 'Success') {
                var evt = {
                    'event': 'ConfbridgeMute',
                    'conference': conference,
                    'channel': channel
                };
                self.event(evt);
            }
        });
    }

    // Unmute a channel
    this.unmute = function(conference, channel) {
        self.ami.action({
            'action': 'confbridgeunmute',
            'conference': conference,
            'channel': channel
        }, function(err, res) {
            if (res.response == 'Success') {
                var evt = {
                    'event': 'ConfbridgeUnmute',
                    'conference': conference,
                    'channel': channel
                };
                self.event(evt);
            }
        });
    }

    // Kick a channel
    this.kick = function(conference, channel) {
        self.ami.action({
            'action': 'confbridgekick',
            'conference': conference,
            'channel': channel
        }, function(err, res) {
            if (res.response == 'Success') {
                var evt = {
                    'event': 'ConfbridgeKick',
                    'conference': conference,
                    'channel': channel
                };
                self.event(evt);
            }
        });
    }

    // List channels in a conference
    this.list = function(conference) {
        self.ami.action({
            'action': 'confbridgelist',
            'conference': conference
        }, function(err, res) {
            self.confbridgeList[res.actionid] = {
                conference: conference,
                list: []
            };
            if (err) {
                // ConfbridgeListComplete events do not fire if there are no
                // participants in a conference, so we need to fire an empty one.
                var evt = {
                    'actionid': err.actionid,
                    'event': 'ConfbridgeListComplete',
                    'eventlist': 'Complete',
                    'listitems': 0
                };
                self.ami.emit('confbridgelistcomplete', evt);
            }
        });
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

    // Create a new random conference number and add it to the req object.
    this.create = function(req, res, next) {

        var conference = {};
        conference.owner = req.user.id;
        conference.conference = Math.floor(Math.random() * (999999 - 100000) + 100000);
        conference.music_on_hold_when_empty = (req.config.confbridge.default.music_on_hold_when_empty) ? 1: 0;
        conference.quiet = (req.config.confbridge.default.quiet) ? 1 : 0;
        conference.announce_join_leave = (req.config.confbridge.default.announce_join_leave) ? 1 : 0;
        conference.record_conference = (req.config.confbridge.default.record_conference) ? 1 : 0;

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
                req.conference.admin = (req.user.admin || result[0].owner == req.user.id);
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
