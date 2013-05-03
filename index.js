var fs = require('fs'),
	async = require('async'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter;

function getWatchFileOptions(monitor) {
	return {
		persistent: true,
		interval: monitor.options.interval
	};
}

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
	fs.watchFile(filePath, getWatchFileOptions(monitor), function(current, prev) {
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
	fs.watchFile(filePath, getWatchFileOptions(monitor), function(current, prev) {
		var cTime = current.ctime.getTime(),
			pTime = prev.ctime.getTime();
		if (cTime > pTime) {
			//the only way to make sure the new file gets watched:
			//just watch the entire directory, but don't traverse into
			//subdirectories
			var oldFiles = Object.keys(monitor.files);
			watch(filePath, monitor, 0, 1, function(err) {
				if (err) {
					return;
				}

				//compute difference between the old watched files and the
				//newly watched files
				var newFile = Object.keys(monitor.files).filter(function(file) {
					return oldFiles.indexOf(file) === -1;
				})[0];

				//only emit the creation event if we are actually watching the
				//new file. this will make sure we don't send spurious creation
				//events for temporary backup files and the like that get deleted
				//almost immediately
				if (newFile) {
					monitor.emit('create', newFile);
				}
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
	options.interval = options.interval || 507;

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