#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var fs      = require('fs');
var socketio = require('socket.io');
var crypto  = require('crypto');
var http = require('http');


/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;
	var salt = "salty";
	var socketStrings = ["To have your friends join this room, have them type /join ","You have joined the room: "];
	var watchedThreads = {};
    var threadStack = [];
	var threadWatchers = [];
	var updatedThreads = [];
	var threadWatcher,updatePusher;
	
    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };


        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express();

        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
		
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.server = self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
		
		
    };
	self.startSocket = function() {
	  self.io = socketio.listen(self.server);
	  self.io.sockets.on('connection', function(socket){
	    socket.join('default');
	    socket.on('message', function(message){
		  console.log('received message:', message);
		  for(var x=0;x<socket.rooms.length;x++){
		    if(socket.rooms[x]!==socket.id)
		      self.io.to(socket.rooms[x]).emit('message',message);
		  }
	    });
		socket.on('createRoom', function(msg){
		  socket.join(msg.name,function(){
		    socket.emit('smessage',{msg:socketStrings[0]+msg.name});
			if(socket.rooms.indexOf('default')>-1)
			  socket.leave('default');
		  });
		});
		socket.on('joinRoom',function(msg){
		  socket.join(msg.name,function(){
		    socket.emit('smessage',{msg:socketStrings[1]+msg.name});
			if(socket.rooms.indexOf('default')>-1)
			  socket.leave('default');
		  });
		});
		socket.on('rooms',function(){
		  console.log(socket.rooms);
		});
		socket.on('check',function(msg){
		  self.checkThread(msg.threadId);
		});
		socket.on('addThreads',function(msg){
		  var isNew = true;
		  for(var x=0;x<threadWatchers.length;x++){
		    if(threadWatchers[x].socket==socket){
			  isNew = false;
			  for(var y=0;y<msg.threads.length;Y++){
			    if(threadWatchers[x].threads.indexOf(threads[y])==-1){
				  threadWatchers[x].threads.push(threads[y]);
				}
				if(watchedThreads.indexOf(threads[y])==-1)
				  watchedThreads.push(threads[y]);
			  }
			}
		  }
		  if(isNew){
		    threadWatchers.push({socket:socket,threads:msg.threads});
		  }
		});
	  });
	};
	self.startThread = function(){
	  threadWatcher = setInterval(self.processThreadStack,1000);
	  updatePusher = setInterval(self.pushThreadUpdates,30000);
	});
	self.stopThread = function(){
	  clearInterval(threadWatcher);
	  clearInterval(updatePuser);
	});
	self.pushThreadUpdates = function(){
	  for(var x=0;x<threadWatchers.length;x++){
	    var temp = threadWatchers[x].threads.filter(function(n) {
          return updatedThreads.indexOf(n) > -1;
        });
		threadWatchers[x].socket.emit('threadUpdates',{threads:temp});
	  }
	  updatedThreads = [];
	});
	self.processThreadStack = function(){
	  var temp = watchedThreads[0];
	  watchedThreads.push(watchedThreads.splice(0,1)[0]);
	  checkThread(temp);
	});
	self.addThread = function(threadId){
	  if(watchedThreads[threadId]===undefined){
	    var temp = {};
		temp.oldPost = 1;
		temp.newPost = 1;
		watchedThreads[threadId]=temp;
	  }
	});
	self.checkThread = function(threadId){
	  var options = {
	    hostname: 'www.crunchyroll.com',
		port: 80,
		path: '/forumtopic-'+threadId+'/?page=last',
		method: 'HEAD'
	  };
	  var req = http.request(options, function(res){
	    console.log('Status: '+res.statusCode);
		console.log('HEADERS: ' + JSON.stringify(res.headers.location));
		if(res.statusCode==302&&res.headers.location!==undefined){
		  var postId = res.headers.location.split('#')[1];
		  var thread = watchedThreads[threadId];
		  if(thread.newPost!==postId){
		    thread.oldPost = thread.newPost;
			thread.newPost = postId;
			updatedThreads.push(threadId);
		  }			
		}
	  });
	  req.end();
	};
	
	
	
	
	

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();
zapp.startSocket();

