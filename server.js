#!/usr/bin/env node

var HTTP_PORT = 8000;
var PEER_PORT = 8001;
var IO_PORT = 8002;

// signaling server
var fs = require('fs');
// static HTTP server
var static = require('node-static');
var file = new static.Server('./static');

require('http').createServer(function(req, res) {
	req.addListener('end', function () {
		file.serve(req, res);
	}).resume();
}).listen(HTTP_PORT);
