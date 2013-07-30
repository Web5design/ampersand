module.exports = function(ami, io) {
    var self = this;

    this.ami = ami;
    this.io = io;

    // Listen for AMI Events
    this.ami.on('managerevent', function(evt) {
        self.io.sockets.in('managerevent').emit('managerevent', evt);
    });

    this.io.sockets.on('connection', function(socket) {
        socket.on('managerevent', function() {
            // Only admins can receive managerevents
            if (socket.handshake.user.admin) {
                socket.join('managerevent');
            }
        });
    });
}
