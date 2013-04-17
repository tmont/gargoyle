var fs = require('fs'),
	async = require('async'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter;

function getRealEvent(event, filePath, context, callback) {
	fs.exists(filePath, function(exists) {
		var eventName;
		//console.log(event + ' ' + exists + ' ' + filePath);
		//when a file is unlink()'d, watch() sends a change event
		//and two renames, so we need to make sure we aren't
		//emitting a bunch of delete events to the client
		if (!context.files[filePath]) {
			if (exists && event === 'rename') {
				eventName = 'create';
			}
		} else {
			eventName = exists
				? (event === 'rename' ? 'rename' : 'modify')
				: (event === 'change' ? 'delete' : 'rename');
			if (eventName === 'delete') {
				context.files[filePath].close();
				delete context.files[filePath];
			}
		}

		callback(eventName);
	});
}

function watch(filePath, context, callback) {
	fs.stat(filePath, function(err, stat) {
		if (err) {
			callback && callback(err);
			return;
		}

		if (context.options.exclude && context.options.exclude(filePath, stat)) {
			callback();
			return;
		}

		if (stat.isDirectory()) {
			context.files[filePath] = fs.watch(filePath, function(event, newFile) {
				newFile = path.join(filePath, newFile);
				getRealEvent(event, newFile, context, function(eventName) {
					if (eventName !== 'create') {
						return;
					}

					watch(newFile, context, function() {
						context.monitor.emit(eventName, newFile);
					});
				});
			});

			fs.readdir(filePath, function(err, files) {
				if (err) {
					callback && callback(err);
					return;
				}

				files = files.map(function(filename) {
					return path.join(filePath, filename);
				});

				async.forEachLimit(files, 30, function(filename, next) {
					watch(filename, context, next);
				}, function(err) {
					if (err) {
						callback && callback(err);
						return;
					}

					callback && callback();
				});
			});
			return;
		}

		context.files[filePath] = fs.watch(filePath, function(event) {
			getRealEvent(event, filePath, context, function(eventName) {
				context.monitor.emit(eventName, filePath);
			});
		});

		callback();
	});
}

exports.monitor = function(filename, options, callback) {
	if (typeof(options) === 'function') {
		callback = options;
		options = {};
	}

	var context = {
		options: options || {},
		monitor: new EventEmitter(),
		files: {},
		stop: function(callback) {
			exports.stop(this, callback);
		}
	};

	watch(filename, context, function(err) {
		if (err) {
			callback && callback(err);
			return;
		}

		callback && callback(null, context);
	});
};

exports.stop = function(context, callback) {
	async.forEachLimit(Object.keys(context.files), 30, function(filename, next) {
		context.files[filename].close();
		delete context.files[filename];
		process.nextTick(next);
	}, callback);
};