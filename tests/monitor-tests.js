var should = require('should'),
	path = require('path'),
	root = path.join(__dirname, 'tmp'),
	gargoyle = require('../'),
	async = require('async'),
	fs = require('fs-extra');

describe('Monitoring', function() {
	var watcher;

	beforeEach(function(done) {
		watcher = null;
		fs.mkdir(root, done);
	});

	afterEach(function(done) {
		function deleteFiles(originalError) {
			fs.remove(root, function(err) {
				done(originalError || err);
			});
		}

		if (watcher) {
			gargoyle.stop(watcher, deleteFiles);
		} else {
			deleteFiles();
		}
	});

	function ensureNoEvents() {
		var events = [].slice.call(arguments),
			done = events.pop();
		events.forEach(function(event) {
			watcher.monitor.on(event, function() {
				done('"' + event + '" should not have been emitted');
			});
		});
	}

	describe('on a directory', function() {
		it('should detect change to file in root directory', function(done) {
			var file = path.join(root, 'foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('modify', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'delete', 'rename', done);

					fs.appendFile(file, 'bar', function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect change to file in subdirectory', function(done) {
			var file = path.join(root, 'foo/bar/baz/foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('modify', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'delete', 'rename', done);

					fs.appendFile(file, 'bar', function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect created file in root directory', function(done) {
			var file = path.join(root, 'foo.txt');
			gargoyle.monitor(root, function(err, context) {
				should.not.exist(err);
				watcher = context;
				watcher.monitor.on('create', function(filename) {
					filename.should.equal(file);
					done();
				});
				ensureNoEvents('modify', 'delete', 'rename', done);

				fs.createFile(file, function(err) {
					should.not.exist(err);
				});
			});
		});

		it('should detect created file in subdirectory', function(done) {
			var file = path.join(root, 'foo/bar/baz/foo.txt');
			fs.mkdirs(path.join(root, 'foo/bar/baz'), function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('create', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('modify', 'delete', 'rename', done);

					fs.createFile(file, function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect modification to created file', function(done) {
			var file = path.join(root, 'foo.txt');
			gargoyle.monitor(root, function(err, context) {
				should.not.exist(err);
				watcher = context;
				watcher.monitor.on('create', function(filename) {
					filename.should.equal(file);
					fs.appendFile(file, 'asdf', function(err) {
						should.not.exist(err);
					});
				});
				watcher.monitor.on('modify', function(filename) {
					filename.should.equal(file);
					done();
				});

				fs.createFile(file, function(err) {
					should.not.exist(err);
				});
			});
		});

		it('should detect deleted file in root directory', function(done) {
			var file = path.join(root, 'foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('delete', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'modify', 'rename', done);

					fs.unlink(file, function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect deleted file in subdirectory', function(done) {
			var file = path.join(root, 'foo/bar/baz/foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('delete', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'modify', 'rename', done);

					fs.unlink(file, function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect renamed file in root directory', function(done) {
			var file = path.join(root, 'foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('rename', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('delete', 'modify', done);

					var newFile = path.join(path.dirname(file), 'bar.txt');
					fs.rename(file, newFile, function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect renamed file in subdirectory', function(done) {
			var file = path.join(root, 'foo/bar/baz/foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('rename', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('delete', 'modify', done);

					var newFile = path.join(path.dirname(file), 'bar.txt');
					fs.rename(file, newFile, function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should emit "rename" and "create" for renamed files', function(done) {
			var file = path.join(root, 'foo/bar/baz/foo.txt');
			var newFile = path.join(path.dirname(file), 'bar.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					var renamed = false, created = false;
					watcher.monitor.on('rename', function(filename) {
						filename.should.equal(file);
						renamed = true;
						if (created) {
							done();
						}
					});
					watcher.monitor.on('create', function(filename) {
						filename.should.equal(newFile);
						created = true;
						if (renamed) {
							done();
						}
					});
					ensureNoEvents('delete', 'modify', done);

					fs.rename(file, newFile, function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should stop watching', function(done) {
			var file = path.join(root, 'foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;

					fs.createFile(path.join(root, 'bar.txt'), function(err) {
						should.not.exist(err);
						//create will be triggered, hence its absence here
						ensureNoEvents('modify', 'delete', 'rename', done);
						context.stop(function() {
							fs.appendFile(file, 'bar', function(err) {
								should.not.exist(err);
								done();
							});
						});
					});
				});
			});
		});

		it('should exclude watched files', function(done) {
			var files = [ 'foo', 'bar', 'baz' ].map(function(name) {
				return path.join(root, name);
			});

			async.forEach(files, function(filename, next) {
				fs.createFile(filename, next);
			}, function(err) {
				should.not.exist(err);
				var options = {
					exclude: function(filename, stat) {
						stat.should.be.instanceOf(fs.Stats);
						return /^b/.test(path.basename(filename));
					}
				};
				gargoyle.monitor(root, options, function(err, context) {
					should.not.exist(err);
					watcher = context;
					ensureNoEvents('create', 'delete', 'rename', 'modify', done);

					fs.appendFile(files[1], 'bar', function(err) {
						should.not.exist(err);

						//meh, this is not awesome, but whatever
						setTimeout(function() { done(); }, 250);
					});
				});
			});
		});
	});

	describe('on a single file', function() {
		it('should detect rename', function(done) {
			var file = path.join(root, 'foo.txt');
			var newFile = path.join(path.dirname(file), 'bar.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(file, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('rename', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'delete', 'modify', done);

					fs.rename(file, newFile, function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect modification', function(done) {
			var file = path.join(root, 'foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(file, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('modify', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'delete', 'rename', done);

					fs.appendFile(file, 'bar', function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect deletion', function(done) {
			var file = path.join(root, 'foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				gargoyle.monitor(file, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('delete', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'rename', 'modify', done);

					fs.unlink(file, function(err) {
						should.not.exist(err);
					});
				});
			});
		});
	});
});