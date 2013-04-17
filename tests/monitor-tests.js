var should = require('should'),
	path = require('path'),
	root = path.join(__dirname, 'tmp'),
	vigilia = require('../'),
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
			vigilia.stop(watcher, deleteFiles);
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
			fs.writeFile(file, 'foo', function(err) {
				should.not.exist(err);
				vigilia.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('update', function(filename) {
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
				vigilia.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('update', function(filename) {
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
			vigilia.monitor(root, function(err, context) {
				should.not.exist(err);
				watcher = context;
				watcher.monitor.on('create', function(filename) {
					filename.should.equal(file);
					done();
				});
				ensureNoEvents('update', 'delete', 'rename', done);

				fs.createFile(file, function(err) {
					should.not.exist(err);
				});
			});
		});

		it('should detect created file in subdirectory', function(done) {
			var file = path.join(root, 'foo/bar/baz/foo.txt');
			fs.mkdirs(path.join(root, 'foo/bar/baz'), function(err) {
				should.not.exist(err);
				vigilia.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('create', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('update', 'delete', 'rename', done);

					fs.createFile(file, function(err) {
						should.not.exist(err);
					});
				});
			});
		});

		it('should detect deleted file in root directory', function(done) {
			var file = path.join(root, 'foo.txt');
			fs.createFile(file, function(err) {
				should.not.exist(err);
				vigilia.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('delete', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'update', 'rename', done);

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
				vigilia.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('delete', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'update', 'rename', done);

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
				vigilia.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('rename', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('delete', 'update', done);

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
				vigilia.monitor(root, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('rename', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('delete', 'update', done);

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
				vigilia.monitor(root, function(err, context) {
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
					ensureNoEvents('delete', 'update', done);

					fs.rename(file, newFile, function(err) {
						should.not.exist(err);
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
				vigilia.monitor(file, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('rename', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'delete', 'update', done);

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
				vigilia.monitor(file, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('update', function(filename) {
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
				vigilia.monitor(file, function(err, context) {
					should.not.exist(err);
					watcher = context;
					watcher.monitor.on('delete', function(filename) {
						filename.should.equal(file);
						done();
					});
					ensureNoEvents('create', 'rename', 'update', done);

					fs.unlink(file, function(err) {
						should.not.exist(err);
					});
				});
			});
		});
	});
});