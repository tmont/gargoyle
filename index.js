var fs = require('fs'),
	async = require('async'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter;

function watch(filePath, context, callback) {
	fs.stat(filePath, function(err, stat) {
		if (err) {
			callback && callback(err);
			return;
		}

		if (stat.isDirectory()) {
			context.files[filePath] = fs.watch(filePath, function(event, newFile) {
				newFile = path.join(filePath, newFile);
				//console.log('\n' + event + ' ' + newFile);
				fs.exists(newFile, function(exists) {
					context.monitor.emit(exists ? 'create' : 'delete', newFile);
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

					callback && callback(null, context);
				});
			});
			return;
		}

		context.files[filePath] = fs.watch(filePath, function(event) {
			//console.log('\n' + event + ' ' + filePath);
			context.monitor.emit('update', filePath);
		});
		callback();
	});
}

exports.monitor = function(dir, context, callback) {
	if (typeof(context) === 'function') {
		callback = context;
		context = {};
	}
	if (!context) {
		context = {};
	}

	if (!context.files) {
		context.files = {};
	}
	if (!context.monitor) {
		context.monitor = new EventEmitter();
	}

	watch(dir, context, callback);
};

exports.stop = function(context, callback) {
	async.forEachLimit(Object.keys(context.files), 30, function(filename, next) {
		context.files[filename].close();
		delete context.files[filename];
		process.nextTick(next);
	}, callback);
};