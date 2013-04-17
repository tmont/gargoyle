var fs = require('fs'),
	async = require('async'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	watchFileOptions = {
		persistent: true,
		interval: 50
	};

function getRealEvent(event, filePath, context, callback) {
	fs.exists(filePath, function(exists) {
		var eventName;
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

function watchFile(filePath, context) {
	return fs.watch(filePath, function(event) {
		getRealEvent(event, filePath, context, function(eventName) {
			context.monitor.emit(eventName, filePath);
		});
	});
}

function watchDir(filePath, context) {
	return fs.watch(filePath, function(event, newFile) {
		newFile = path.join(filePath, newFile);
		getRealEvent(event, newFile, context, function(eventName) {
			if (eventName !== 'create') {
				return;
			}

			watch(newFile, context, 0, context.options.maxDepth, function() {
				context.monitor.emit(eventName, newFile);
			});
		});
	});
}

function watchFileFile(filePath, context) {
	fs.watchFile(filePath, watchFileOptions, function(current, prev) {
		var cTime = current.mtime.getTime(),
			pTime = prev.mtime.getTime();
		if (cTime > pTime) {
			context.monitor.emit('modify', filePath);
		} else if (current.nlink === 0) {
			delete context.files[filePath];
			fs.unwatchFile(filePath);
			context.monitor.emit('delete', filePath);
		}
		//can't support rename detection with fs.watchFile()
	});

	return true;
}

function watchFileDir(filePath, context) {
	fs.watchFile(filePath, watchFileOptions, function(current, prev) {
		var cTime = current.ctime.getTime(),
			pTime = prev.ctime.getTime();
		if (cTime > pTime) {
			//the only way to make sure the new file gets watched
			watch(filePath, context, 0,  1, function(err) {
				//ignore error, the new file just won't be watched
				context.monitor.emit('create', filePath);
			});
		}
	});

	return true;
}

function watch(filePath, context, depth, maxDepth, callback) {
	if (depth > maxDepth) {
		callback && callback();
		return;
	}

	fs.stat(filePath, function(err, stat) {
		if (err) {
			callback && callback(err);
			return;
		}

		if (context.options.exclude && context.options.exclude(filePath, stat)) {
			callback && callback();
			return;
		}

		if (stat.isDirectory()) {
			if (!context.files[filePath]) {
				context.files[filePath] = context.options.type === 'watch'
					? watchDir(filePath, context)
					: watchFileDir(filePath, context);
			}

			fs.readdir(filePath, function(err, files) {
				if (err) {
					callback && callback(err);
					return;
				}

				files = files.map(function(filename) {
					return path.join(filePath, filename);
				});

				async.forEachLimit(files, 30, function(filename, next) {
					watch(filename, context, depth + 1, maxDepth, next);
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

		if (!context.files[filePath]) {
			context.files[filePath] = context.options.type === 'watch'
				? watchFile(filePath, context)
				: watchFileFile(filePath, context);
		}

		callback && callback();
	});
}

exports.monitor = function(filename, options, callback) {
	if (typeof(options) === 'function') {
		callback = options;
		options = {};
	}

	options.type = options.type || 'watch';
	options.maxDepth = options.maxDepth || Infinity;

	var context = {
		options: options || {},
		monitor: new EventEmitter(),
		files: {},
		stop: function(callback) {
			exports.stop(this, callback);
		}
	};

	watch(filename, context, 0, options.maxDepth, function(err) {
		if (err) {
			callback && callback(err);
			return;
		}

		callback && callback(null, context);
	});
};

exports.stop = function(context, callback) {
	async.forEachLimit(Object.keys(context.files), 30, function(filename, next) {
		if (context.options.type === 'watch') {
			context.files[filename].close();
		} else {
			fs.unwatchFile(filename);
		}
		delete context.files[filename];
		process.nextTick(next);
	}, callback);
};