var PeerServer = require('peer').PeerServer;

var createServer = function(videoPath, svPort) {
	var server = new PeerServer({port: svPort, path: videoPath, allow_discovery: true});

	server.on('connection', function(id) {
		console.log('id ' + id + ' connected.');
	});

	server.on('disconnect', function(id) {
		console.log('id ' + id + ' disconnected.');
	});
};

// TODO: what about multiple servers serving separate paths, but on the same port?
createServer('/output', 9000);
