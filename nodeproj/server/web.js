var express = require('express');
var assetManager = require('connect-assetmanager');
var assetHandler = require('connect-assetmanager-handlers');
var stylus = require('stylus');
var fs = require('fs');

var port = process.env.C9_PORT || process.env.PORT || 7272;

var app = express.createServer();
var webroot = __dirname+"/../public";

function processStylus(fileContent, path, index, isLast, callback) {
	stylus(fileContent).set('filename', path).render(function(err, result){callback(result);});
};

function storeInFile(file) {
	return function storeCachedVersion(fileContent, path, index, isLast, callback) {
		fs.writeFile(file, fileContent, function (err) {});
		callback(fileContent);
	};
};

var assetManagerGroups = {
	    'js': {
	        'route': /\/.*\.bundle\.js/,
	        'path': '../src/',
	        'dataType': 'javascript', 
	        'files': ['utils.js', '*', 'main.js'],
	        'postManipulate': {
	            '^': [
	                assetHandler.uglifyJsOptimize,
	                storeInFile('../public/code.bundle.js')
	            ]
	        }
	    },
	    'css': {
	   	 'route': /\/.*\.bundle\.css/,
	   	 'path': '../style/',
	   	 'dataType': 'css',
	   	 'files': ['*'],
	   	 'preManipulate': {
	   		 '^': [processStylus]
	   	 },
	   	 'postManipulate': {
	   		 '^': [
	   		       storeInFile('../public/style.bundle.css')
	   		 ]
	   	 }
	    }
};

app.get('*.bundle.*', assetManager(assetManagerGroups));
app.use(express["static"](webroot));

console.log("Serving "+webroot+" on port "+port);
app.listen(port);

/*
var io = require('socket.io').listen(app);
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});
 */