#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var fs      = require('fs');
var socketio = require('socket.io');
var crypto  = require('crypto');
var http = require('http');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

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
	var activeThreads = [];
	var threadWatcher,updatePusher;
	var userConnects = [];
	var userDisconnects = [];
	var currentViewers = 0,initialViewers = 0;
	var liveSchema,LiveData;
	
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
		liveSchema = new Schema({
		  date : {type: Date, default: Date.now},
		  connects: [{username: String, time: Number}],
		  disconnects: [{username: String, time: Number}],
		  initalViewers: {type:Number, default: 0}
		});
		liveSchema.virtual('data').set(function(data){
		  this.connects = data.connects;
		  this.disconnects = data.disconnects;
		});
		liveSchema.virtual('data').get(function(){
		  return {connects:this.connects,disconnects:this.disconnects,initalViewers:this.initialViewers};
		});
		LiveData = mongoose.model('LiveData',liveSchema);
		
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
			self.zcache = { 'google9e23f6b6243a12c2.html':''};
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
		self.zcache['google9e23f6b6243a12c2.html'] = fs.readFileSync('./google9e23f6b6243a12c2.html');
		self.zcache['live.html'] = fs.readFileSync('./live.html');
		self.zcache['highcharts-custom.js'] = fs.readFileSync('./highcharts-custom.js');
		self.zcache['oldLiveData.html'] = fs.readFileSync('./oldLiveData.html');
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
		
		self.routes['/google9e23f6b6243a12c2.html'] = function(req,res){
		  res.setHeader('Content-Type', 'text/html');
		  res.send(self.cache_get('google9e23f6b6243a12c2.html'));
		};
		
		self.routes['/live'] = function(req,res){
		  res.setHeader('Content-Type', 'text/html');
		  res.send(self.cache_get('live.html'));
		};
		
		self.routes['/oldLiveData'] = function(req,res){
		  res.setHeader('Content-Type', 'text/html');
		  res.send(self.cache_get('oldLiveData.html'));
		};
		
		self.routes['/highcharts-custom.js'] = function(req,res){
		  res.send(self.cache_get('highcharts-custom.js'));
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
	
	self.initializeMongo = function(){
	  var connection_string = "";
	  if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
        connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
                            process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
                            process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
                            process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
                            process.env.OPENSHIFT_APP_NAME;
      }
	  mongoose.connect(connection_string);
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
		self.initializeMongo();
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
	  self.livesocket = self.io.of('/livestream');
	  self.livesocket.on('connection', function(socket){
	    socket.on('initViewers', function(message){
		  currentViewers = message.viewers;
		  initialViewers = message.viewers;
		});
	    socket.on('getData', function(message){
		  socket.emit('data',{data:self.getLiveData()});
		});
		socket.on('pushData', function(message){
		  self.updateLiveData(message);
		  socket.broadcast.emit('pushData',{data:message});
		});
		socket.on('clearData', function(){
		  self.clearLiveData();
		});
		socket.on('saveData', function(){
		  self.saveLiveData();
		});
		socket.on('getOldData', function(){
		  LiveData.find({ date: { $exists: true }},function(err,docs){
		    if(err) console.log(err);
			socket.emit('oldData',docs);
		  });
		});
		socket.on('deleteData', function(msg){
		  self.deleteLiveData(msg.date);
		});
		socket.on('updateData', function(msg){
		  self.updateData(msg.date,msg.info);
		});
	  });
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
		  console.log('adding threads: ',msg.threads);
		  var isNew = true;
		  for(var x=0;x<threadWatchers.length;x++){
		    if(threadWatchers[x].socket==socket){
			  isNew = false;
			  for(var y=0;y<msg.threads.length;y++){
			    if(threadWatchers[x].threads.indexOf(msg.threads[y])==-1){
				  threadWatchers[x].threads.push(msg.threads[y]);
				}
				console.log('adding thread: ',msg.threads[y]);
				self.addThread(msg.threads[y]);
			  }
			  break;
			}
		  }
		  if(isNew){
		    threadWatchers.push({socket:socket,threads:msg.threads});			
			for(var y=0;y<msg.threads.length;y++){
			  console.log('adding thread: ',msg.threads[y]);
			  self.addThread(msg.threads[y]);
			}
		  }
		});
		socket.on('removeThreads',function(msg){
		  console.log('removing threads: ',msg.threads);
		  for(var x=0;x<threadWatchers.length;x++){
		    if(threadWatchers[x].socket==socket){
			  for(var y=0;y<msg.threads.length;y++){
			    var n = threadWatchers[x].threads.indexOf(msg.threads[y]);
				if(n>-1)
			      threadWatchers[x].threads.splice(n,1);
				self.removeThread(msg.threads[y]);
			  }
			  break;
			}
		  }
		});
		socket.on('startThread',function(){
		  self.startThread();
		});
		socket.on('stopThread',function(){
		  self.stopThread();
		});
	  });
	};
	self.startThread = function(){
	  if(threadWatcher === undefined && updatePusher === undefined){
	    threadWatcher = setInterval(self.processThreadStack,1000);
	    updatePusher = setInterval(self.pushThreadUpdates,3000);
	    console.log('started thread');
	  }
	};
	self.stopThread = function(){
	  clearInterval(threadWatcher);
	  clearInterval(updatePusher);
	  threadWatcher = undefined;
	  updatePusher = undefined;
	  console.log('stopped thread?');
	};
	self.pushThreadUpdates = function(){
	  for(var x=0;x<threadWatchers.length;x++){
	    var temp = threadWatchers[x].threads.filter(function(n) {
          return updatedThreads[n]!==undefined;
        });
		if(temp.length>0){
		  var updateInfo = {};
		  for(var y=0;y<temp.length;y++){
		    updateInfo[temp[y]] = updatedThreads[temp[y]];
		  }
		  threadWatchers[x].socket.emit('threadUpdates',{threads:updateInfo});
		}
	  }
	  updatedThreads = {};
	};
	self.processThreadStack = function(){
	  if(threadStack.length > 0){
	    var temp = threadStack.splice(0,1)[0];
	    self.checkThread(temp);
		threadStack.push(temp);
	  }
	};
	self.addThread = function(threadId){
	  if(watchedThreads[threadId]===undefined){
		watchedThreads[threadId]=1;
		threadStack.push(threadId);
		activeThreads[threadId] = (activeThreads[threadId]===undefined) ? 1 : ++activeThreads[threadId];
	  }
	};
	self.removeThread = function(threadId){
	  if(activeThreads[threadId]!==undefined){
	    if(--activeThreads[threadId]<1){
		  watchedThreads[threadId]=undefined;
		  var n = threadStack.indexOf(threadId);
		  if(n>-1)
		    threadStack.splice(n,1);
		}
	  }
	};
	self.checkThread = function(threadId){
	  var url = '/forumtopic-'+threadId+'?pg=last';
	  var options = {
	    hostname: 'www.crunchyroll.com',
		port: 80,
		path: url,
		method: 'HEAD',
		agent:false
	  };
	  var req = http.request(options, function(res){
	    //console.log('Url:'+url);
	    //console.log('Status: '+res.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(res.headers.location));
		if(res.statusCode==302&&res.headers.location!==undefined){
		  var postId = res.headers.location.split('#')[1];
		  //console.log(threadId+' : '+postId);
		  var thread = watchedThreads[threadId];
		  if(thread!==postId){
			updatedThreads[threadId]=postId;
			watchedThreads[threadId]=postId;
		  }			
		}
	  });
	  req.end();
	};
	self.updateLiveData = function(data){
	  //console.log('Updating Livestream Data.');
	  for(var x=0;x<data.connects.length;x++){
	    userConnects.push(data.connects[x]);
		currentViewers++;
	  }
	  for(var x=0;x<data.disconnects.length;x++){
	    userDisconnects.push(data.disconnects[x]);
		currentViewers--;
	  }
	};
	self.getLiveData = function(){
	  console.log('Getting Livestream Data.',currentViewers);
	  return currentViewers;
	};
	self.clearLiveData = function(){
	  console.log('Clearing Livestream Data.');
	  userConnects = [];
	  userDisconnects = [];
	  currentViewers = 0;
	};
	self.saveLiveData = function(){
	  var ld = LiveData({connects : userConnects,disconnects:userDisconnects,initalViewers:initialViewers});
	  ld.save(function(err){
	    if(err) console.log(err);
	  });
	};
	self.deleteLiveData = function(d){
	  LiveData.remove().where('date').gt(d).lt(d+86400000).exec(function(err){
	    if(err)console.log(err);
	  });
	};
	self.updateData = function(d,info){
	  LiveData.update({$and:[{date:{$gt:d}},{date:{$lt:d+86400000}}]},info).exec(function(err){
	    if(err)console.log(err);
	  });
	};
	

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();
zapp.startSocket();

