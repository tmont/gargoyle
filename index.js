var fs = require('fs'),
	async = require('async'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	watchFileOptions = {
		persistent: true,
		interval: 50
	};

function getRealEvent(event, filePath, monitor, callback) {
	fs.exists(filePath, function(exists) {
		var eventName;
		//when a file is unlink()'d, watch() sends a change event
		//and two renames, so we need to make sure we aren't
		//emitting a bunch of delete events to the client
		if (!monitor.files[filePath]) {
			if (exists && event === 'rename') {
				eventName = 'create';
			}
		} else {
			eventName = exists
				? (event === 'rename' ? 'rename' : 'modify')
				: (event === 'change' ? 'delete' : 'rename');
			if (eventName === 'delete') {
				monitor.files[filePath].close();
				delete monitor.files[filePath];
			}
		}

		callback(eventName);
	});
}

function watchFile(filePath, monitor) {
	return fs.watch(filePath, function(event) {
		getRealEvent(event, filePath, monitor, function(eventName) {
			monitor.emit(eventName, filePath);
		});
	});
}

function watchDir(filePath, monitor) {
	return fs.watch(filePath, function(event, newFile) {
		newFile = path.join(filePath, newFile);
		getRealEvent(event, newFile, monitor, function(eventName) {
			if (eventName !== 'create') {
				return;
			}

			watch(newFile, monitor, 0, monitor.options.maxDepth, function() {
				monitor.emit(eventName, newFile);
			});
		});
	});
}

function watchFileFile(filePath, monitor) {
	fs.watchFile(filePath, watchFileOptions, function(current, prev) {
		var cTime = current.mtime.getTime(),
			pTime = prev.mtime.getTime();
		if (cTime > pTime) {
			monitor.emit('modify', filePath);
		} else if (current.nlink === 0) {
			delete monitor.files[filePath];
			fs.unwatchFile(filePath);
			monitor.emit('delete', filePath);
		}
		//can't support rename detection with fs.watchFile()
	});

	return true;
}

function watchFileDir(filePath, monitor) {
	fs.watchFile(filePath, watchFileOptions, function(current, prev) {
		var cTime = current.ctime.getTime(),
			pTime = prev.ctime.getTime();
		if (cTime > pTime) {
			//the only way to make sure the new file gets watched
			watch(filePath, monitor, 0,  1, function(err) {
				//ignore error, the new file just won't be watched
				monitor.emit('create', filePath);
			});
		}
	});

	return true;
}

function watch(filePath, monitor, depth, maxDepth, callback) {
	if (depth > maxDepth) {
		callback && callback();
		return;
	}

	fs.stat(filePath, function(err, stat) {
		if (err) {
			callback && callback(err);
			return;
		}

		if (monitor.options.exclude && monitor.options.exclude(filePath, stat)) {
			callback && callback();
			return;
		}

		if (stat.isDirectory()) {
			if (!monitor.files[filePath]) {
				monitor.files[filePath] = monitor.options.type === 'watch'
					? watchDir(filePath, monitor)
					: watchFileDir(filePath, monitor);
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
					watch(filename, monitor, depth + 1, maxDepth, next);
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

		if (!monitor.files[filePath]) {
			monitor.files[filePath] = monitor.options.type === 'watch'
				? watchFile(filePath, monitor)
				: watchFileFile(filePath, monitor);
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

	var monitor = new EventEmitter();
	monitor.options = options;
	monitor.files = {};
	monitor.stop = function(callback) {
		async.forEachLimit(Object.keys(monitor.files), 30, function(filename, next) {
			if (monitor.options.type === 'watch') {
				monitor.files[filename].close();
			} else {
				fs.unwatchFile(filename);
			}
			delete monitor.files[filename];
			process.nextTick(next);
		}, callback);
	};

	watch(filename, monitor, 0, options.maxDepth, function(err) {
		if (err) {
			callback && callback(err);
			return;
		}

		callback && callback(null, monitor);
	});
};