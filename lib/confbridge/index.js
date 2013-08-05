var fs = require('fs'),
    glob = require('glob');

function formatDate(date) {
    return date.getUTCFullYear() + '-' +
        ('0' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
        ('0' + date.getUTCDate()).slice(-2);
}

/* Returns the class name of the argument or undefined if
 * it's not a valid JavaScript object.
 */
function getObjectClass(obj) {
    if (obj && obj.constructor && obj.constructor.toString) {
        var arr = obj.constructor.toString().match(
                /function\s*(\w+)/);

        if (arr && arr.length == 2) {
            return arr[1];
        }
    }

    return undefined;
}


module.exports = function confbridge(db, ami, io, config) {
    var self = this;

    this.db = db;
    this.ami = ami;
    this.io = io;
    this.config = config;

    this.confbridgeList = [];
    this.confbridgeListRooms = [];

    // Fire a confbridgeEvent
    this.event = function(evt, socket) {
        if (socket) {
            socket.emit('confbridgeEvent', evt);
        } else {
            var room = 'confbridge';
            if (evt.conference) {
                room += '/' + evt.conference;
            } 
            self.io.sockets.in(room).emit('confbridgeEvent', evt);
        }
    }

    // Listen for Confbridge AMI events
    this.ami.on('confbridgestart', function(evt) {
        self.event(evt);
        self.listRooms();
    });

    this.ami.on('confbridgeend', function(evt) {
        self.event(evt);
        self.listRooms();
    });

    this.ami.on('confbridgejoin', function(evt) {
        self.event(evt);
        self.list(evt.conference);
        self.listRooms();
    });

    this.ami.on('confbridgeleave', function(evt) {
        // Wait 1 second before firing follow-up events. Otherwise, Asterisk's
        // internal lists are not updated in time.
        setTimeout(function() {
            self.event(evt);
            self.list(evt.conference);
            self.listRooms();
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
        if (self.confbridgeListRooms[evt.actionid]) {
            self.confbridgeListRooms[evt.actionid].list[self.confbridgeListRooms[evt.actionid].list.length] = evt;
        }
    });

    this.ami.on('confbridgelistroomscomplete', function(evt) {
        if (self.confbridgeListRooms[evt.actionid]) {
            evt.list = self.confbridgeListRooms[evt.actionid].list;
            delete self.confbridgeListRooms[evt.actionid];
        }
        self.event(evt);
    });

    // Listen for socket.io callbacks from clients.
    this.io.sockets.on('connection', function(socket) {

        // Client wants to receive events for a conference.
        socket.on('confbridge', function(conference) {
            if (conference) {
                self.owner(conference, function(owner) {
                    // Only the conference owner and admins can subscribe to these events.
                    if (socket.handshake.user.admin || socket.handshake.user.id == owner) {
                        socket.conference = conference;
                        socket.join('confbridge/' + conference);
                        self.list(conference);
                        self.recordings(conference);
                    }
                });
            } else {
                socket.join('confbridge');
                self.listRooms();
                self.getPermanent(socket);
                self.getActive(socket);
                self.getExpired(socket);
            }
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

        socket.on('confbridge/deleterecording', function(file) {
            self.owner(socket.conference, function(owner) {
                // Only the conference owner and admins can delete a recording.
                if (socket.handshake.user.admin || socket.handshake.user.id == owner) {
                    var path = self.config.recordings + '/' + file;
                    fs.unlink(path, function(err) {
                        if (err) throw err;
                        self.recordings(socket.conference);
                    });
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
        self.ami.action({
            'action': 'confbridgelistrooms'
        }, function(err, res) {
            self.confbridgeListRooms[res.actionid] = {
                list: []
            };
            if (err) {
                // ConfbrigeListRoomsComplete events do not fire if there are no
                // conferences in progress, so we need to fire an empty one.
                var evt = {
                    'actionid': err.actionid,
                    'event': 'ConfbridgeListRoomsComplete',
                    'eventlist': 'Complete',
                    'listitems': 0,
                };
                self.ami.emit('confbridgelistroomscomplete', evt);
            }
        });
    }

    // List recordings
    this.recordings = function(conference, callback) {
        var path = self.config.recordings + '/';
        if (conference) path += 'confbridge-' + conference + '-';

        glob(path + '*.wav', function(err, files) {
            // Generate the recording list metadata
            var recordings = [];
            for (i = 0; i < files.length; i++) {
                recordings[recordings.length] = {
                    'file': files[i].substring(self.config.recordings.length + 1),
                    'stats': fs.statSync(files[i])
                };
            }

            if ('function' == typeof callback) {
                callback(recordings);
            } else {
                var evt = {
                    'event': 'ConfbridgeRecordings',
                    'recordings': recordings
                };
                if (conference) evt.conference = conference;

                self.event(evt);
            }
        });
    }

    // Get a list of permanent conferences
    this.getPermanent = function(callback) {
        self.db.query('SELECT * FROM confbridge where expiration IS NULL ORDER BY owner, name ASC', function(err, result) {
            if (err) throw err;

            if ('function' == typeof callback) {
                callback(result);
            } else {
                var evt = {
                    'event': 'ConfbridgeListPermanentRoomsComplete',
                    'eventlist': 'Complete',
                    'listitems': result.length,
                    'list': result 
                };
                if (getObjectClass(callback) == 'Socket') {
                    self.event(evt, callback);
                } else {
                    self.event(evt);
                }
            }
        });
    }

    // Get a list of active conferences
    this.getActive = function(callback) {
        self.db.query('SELECT * FROM confbridge WHERE expiration >= NOW()', function(err, result) {
            if (err) throw err;

            // Format the expiration date
            for (var i = 0; i < result.length; i++) {
                result[i].expiration = formatDate(result[i].expiration);
            }

            if ('function' == typeof callback) {
                callback(result);
            } else {
                var evt = {
                    'event': 'ConfbridgeListActiveRoomsComplete',
                    'eventlist': 'Complete',
                    'listitems': result.length,
                    'list': result
                };
                if (getObjectClass(callback) == 'Socket') {
                    self.event(evt, callback);
                } else {
                    self.event(evt);
                }
            }
        });
    }

    // Get a list of expired conferences
    this.getExpired = function(callback) {
        self.db.query('SELECT * FROM confbridge WHERE expiration < NOW()', function(err, result) {
            if (err) throw err;

            // Format the expiration dates
            for (var i = 0; i < result.length; i++) {
                result[i].expiration = formatDate(result[i].expiration);
            }

            if ('function' == typeof callback) {
                callback(result);
            } else {
                var evt = {
                    'event': 'ConfbridgeListExpiredRoomsComplete',
                    'eventlist': 'Complete',
                    'listitems': result.length,
                    'list': result
                };
                if (getObjectClass(callback) == 'Socket') {
                    self.event(evt, callback);
                } else {
                    self.event(evt);
                }
            }
        });
    }

    // Start recording
    this.startRecord = function(conference) {
    }

    // Stop recording
    this.stopRecord = function(conference) {
    }

    // Create a new random conference number and add it to the req object.
    this.create = function(req, res, next) {

        // Default conference expiration
        var date = new Date();
        date.setDate(date.getDate() + (req.config.confbridge.default.expiration || 14));
        var expiration = formatDate(date);

        // Populate a new conference object
        var conference = {};
        conference.owner = req.user.id;
        conference.conference = Math.floor(Math.random() * (999999 - 100000) + 100000);
        conference.expiration = expiration;
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
            conference.owner = (req.body.owner && req.user.admin) ? req.body.owner : req.user.id;
            conference.name = (req.body.name) ? req.body.name : '';
            conference.conference = (req.body.conference) ? req.body.conference : '';
            conference.expiration = (req.body.expiration) ? req.body.expiration : null;
            conference.music_on_hold_when_empty = (req.body.music_on_hold_when_empty) ? 1 : 0;
            conference.quiet = (req.body.quiet) ? 1 : 0;
            conference.announce_join_leave = (req.body.announce_join_leave) ? 1 : 0;
            conference.record_conference = (req.body.record_conference) ? 1 : 0;

            // Write to the database.
            if (req.body.id) {
                // Only the conference owner and admins can modify a conference
                self.db.query('SELECT owner FROM confbridge WHERE id=?', req.body.id, function(err, result) {

                    if (result.length) {
                        if (req.user.admin || req.user.id == result[0].owner) {
                            self.db.query('UPDATE confbridge SET ? WHERE id=?', [conference, req.body.id], function(err, result) {
                                if (err) throw err;
                                self.getPermanent();
                                self.getActive();
                                self.getExpired();
                                res.redirect('/confbridge/view/' + req.body.conference);
                            });
                        } else {
                            res.status(403);
                            res.render('403');
                        }
                    } else {
                        // The conference does not exist.
                        res.redirect('/');
                    }

                });
            } else {
                self.db.query('INSERT INTO confbridge SET ?', conference, function(err, result) {
                    if (err) throw err;
                    self.getPermanent();
                    self.getActive();
                    self.getExpired();
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

    // Delete a conference
    this.delete = function(req, res) {
        if (req.body.delete) {
            // Delete was clicked, proceed with deleting the conference.
            // Only conference owners and admins can delete a conference
            if (req.conference.admin) {
                self.db.query('DELETE FROM confbridge WHERE conference=?', req.params.conference, function(err, result) {
                    if (err) throw err;
                    // Delete the recordings from this conference
                    self.recordings(req.params.conference, function(recordings) {
                        for (var i = 0; i < recordings.length; i++) {
                            (function(i) {
                                process.nextTick(function() {
                                    var file = self.config.recordings + '/' + recordings[i].file;
                                    console.log(file);
                                    fs.unlink(file, function() {});
                                });
                            })(i);
                        }
                        self.getPermanent();
                        self.getActive();
                        self.getExpired();
                        res.redirect('/');
                    });
                });
            }
            else {
                res.status(403);
                res.render('403');
            }
        } else {
            // Cancel was clicked
            res.redirect('/confbridge/view/' + req.conference.conference);
        }
    }

    // Load a conference into the request object.
    this.load = function(req, res, next) {
        self.db.query('SELECT * FROM confbridge WHERE conference=?', req.params.conference, function(err, result) {
            if (err) throw err;
            
            if (result.length) {
                req.conference = result[0];
                req.conference.admin = (req.user.admin || result[0].owner == req.user.id);
                req.conference.recordings = self.config.recordings;

                // Format the expiration date
                var date = result[0].expiration;
                if (date) {
                    req.conference.expiration = formatDate(date);
                }
            } else {
                res.redirect('/confbridge/create');
            }
            next();
        });
    }

}
