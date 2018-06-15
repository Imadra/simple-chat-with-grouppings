var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	mongoose = require('mongoose'),
	users = {};

var gr = ['A', 'B', 'C'];

server.listen(3000);

mongoose.connect('mongodb://localhost:27017/chat', function(err) {
	if(err)
		console.log(err);
	else
		console.log('Connected to mongodb');
});

var chatSchema = mongoose.Schema({
	nick: String,
	msg: String,
	created: {type:Date, default: Date.now}
});

var Chat = mongoose.model('Message', chatSchema);

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket) {
	var query = Chat.find({});
	query.sort('-created').limit(8).exec(function(err, docs) {
		if(err)
			throw err;
		socket.emit('load old msgs', docs);
	});

	socket.on('new user', function(data, callback) {
		if(data in users) {
			callback(false);
		}
		else {
			callback(true);
			socket.nickname = data;
			users[socket.nickname] = socket;
			updateNicknames();
			socket.emit('starting message', {msg:'Hello ', nick: socket.nickname});
		}
	})

	socket.on('request grouplist', function(callback) {
		k = ['List of groups:'];
		for(var i=0;i<gr.length;i++) {
			k.push(gr[i]);
		}
		callback(null, k);
	});

	function updateNicknames() {
		io.sockets.emit('usernames', Object.keys(users));
	}

	socket.on('send message', function(data, callback) {
		var msg = data.trim();
		if(msg.substring(0, 3) === '/w ') {
			msg = msg.substr(3);
			var ind = msg.indexOf(' ');
			if(ind !== -1) {
				var name = msg.substring(0, ind);
				var msg = msg.substring(ind + 1);
				if(name in users)
				{
					users[name].emit('whisper', {msg:msg, nick: socket.nickname});
					console.log('Whisper!');
				}
				else {
					callback('Error! Enter a valid user!');
				}
			}
			else {
				callback('Error. Please enter a message for your whisper!')
			}
		}
		else {
			var newMsg = new Chat({msg: msg, nick: socket.nickname});
			newMsg.save(function(err) {
				if(err)
					throw(err);
				io.sockets.emit('new message', {msg:msg, nick: socket.nickname});
			})
		}
	});

	socket.on('disconnect', function(data) {
		if(!socket.nickname)
			return;
		delete users[socket.nickname];
		updateNicknames();
	});
});