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
			watcher.stop(deleteFiles);
		} else {
			deleteFiles();
		}
	});

	function ensureNoEvents() {
		var events = [].slice.call(arguments),
			done = events.pop();
		events.forEach(function(event) {
			watcher.on(event, function() {
				done('"' + event + '" should not have been emitted');
			});
		});
	}

	[ 'watch', 'watchFile' ].forEach(function(type) {
		var options = { type: type };

		function doIo(thunk) {
			if (type === 'watchFile') {
				setTimeout(thunk, 1200);
			} else {
				thunk();
			}
		}

		describe('using ' + type, function() {
			describe('on a directory', function() {
				it('should detect change to file in root directory', function(done) {
					var file = path.join(root, 'foo.txt');
					fs.createFile(file, function(err) {
						should.not.exist(err);
						gargoyle.monitor(root, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;
							watcher.on('modify', function(filename) {
								filename.should.equal(file);
								done();
							});
							ensureNoEvents('create', 'delete', 'rename', done);

							doIo(function() {
								fs.appendFile(file, 'bar', function(err) {
									should.not.exist(err);
								});
							});
						});
					});
				});

				it('should detect change to file in subdirectory', function(done) {
					var file = path.join(root, 'foo/bar/baz/foo.txt');
					fs.createFile(file, function(err) {
						should.not.exist(err);
						gargoyle.monitor(root, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;
							watcher.on('modify', function(filename) {
								filename.should.equal(file);
								done();
							});
							ensureNoEvents('create', 'delete', 'rename', done);

							doIo(function() {
								fs.appendFile(file, 'bar', function(err) {
									should.not.exist(err);
								});
							});
						});
					});
				});

				it('should detect created file in root directory', function(done) {
					var file = path.join(root, 'foo.txt');
					gargoyle.monitor(root, options, function(err, monitor) {
						should.not.exist(err);
						watcher = monitor;
						watcher.on('create', function(filename) {
							if (type === 'watchFile') {
								filename.should.equal(path.dirname(file));
							} else {
								filename.should.equal(file);
							}
							done();
						});
						ensureNoEvents('modify', 'delete', 'rename', done);

						doIo(function() {
							fs.createFile(file, function(err) {
								should.not.exist(err);
							});
						});
					});
				});

				it('should detect created file in subdirectory', function(done) {
					var file = path.join(root, 'foo/bar/baz/foo.txt');
					fs.mkdirs(path.join(root, 'foo/bar/baz'), function(err) {
						should.not.exist(err);
						gargoyle.monitor(root, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;
							watcher.on('create', function(filename) {
								if (type === 'watchFile') {
									filename.should.equal(path.dirname(file));
								} else {
									filename.should.equal(file);
								}
								done();
							});
							ensureNoEvents('modify', 'delete', 'rename', done);

							doIo(function() {
								fs.createFile(file, function(err) {
									should.not.exist(err);
								});
							});
						});
					});
				});

				it('should detect modification to created file', function(done) {
					var file = path.join(root, 'foo.txt');
					gargoyle.monitor(root, options, function(err, monitor) {
						should.not.exist(err);
						watcher = monitor;
						watcher.on('create', function(filename) {
							if (type === 'watchFile') {
								filename.should.equal(path.dirname(file));
							} else {
								filename.should.equal(file);
							}
							doIo(function() {
								fs.appendFile(file, 'asdf', function(err) {
									should.not.exist(err);
								});
							});
						});
						watcher.on('modify', function(filename) {
							filename.should.equal(file);
							done();
						});

						doIo(function() {
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
						gargoyle.monitor(root, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;
							watcher.on('delete', function(filename) {
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
						gargoyle.monitor(root, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;
							watcher.on('delete', function(filename) {
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

				if (type !== 'watchFile') {
					it('should detect renamed file in root directory', function(done) {
						var file = path.join(root, 'foo.txt');
						fs.createFile(file, function(err) {
							should.not.exist(err);
							gargoyle.monitor(root, options, function(err, monitor) {
								should.not.exist(err);
								watcher = monitor;
								watcher.on('rename', function(filename) {
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
							gargoyle.monitor(root, options, function(err, monitor) {
								should.not.exist(err);
								watcher = monitor;
								watcher.on('rename', function(filename) {
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
							gargoyle.monitor(root, options, function(err, monitor) {
								should.not.exist(err);
								watcher = monitor;
								var renamed = false, created = false;
								watcher.on('rename', function(filename) {
									filename.should.equal(file);
									renamed = true;
									if (created) {
										done();
									}
								});
								watcher.on('create', function(filename) {
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
				}

				it('should stop watching', function(done) {
					var file = path.join(root, 'foo.txt');
					fs.createFile(file, function(err) {
						should.not.exist(err);
						gargoyle.monitor(root, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;

							fs.createFile(path.join(root, 'bar.txt'), function(err) {
								should.not.exist(err);
								//create will be triggered, hence its absence here
								ensureNoEvents('modify', 'delete', 'rename', done);
								watcher.stop(function() {
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
						options.exclude = function(filename, stat) {
							stat.should.be.instanceOf(fs.Stats);
							return /^b/.test(path.basename(filename));
						};
						gargoyle.monitor(root, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;
							ensureNoEvents('create', 'delete', 'rename', 'modify', done);

							doIo(function() {
								fs.appendFile(files[1], 'bar', function(err) {
									should.not.exist(err);

									//meh, this is not awesome, but whatever
									setTimeout(function() {
										done();
									}, 250);
								});
							});
						});
					});
				});
			});

			describe('on a single file', function() {
				if (type !== 'watchFile') {
					//don't support renames using fs.watchFile
					it('should detect rename', function(done) {
						var file = path.join(root, 'foo.txt');
						var newFile = path.join(path.dirname(file), 'bar.txt');
						fs.createFile(file, function(err) {
							should.not.exist(err);
							gargoyle.monitor(file, options, function(err, monitor) {
								should.not.exist(err);
								watcher = monitor;
								watcher.on('rename', function(filename) {
									filename.should.equal(file);
									done();
								});
								ensureNoEvents('create', 'delete', 'modify', done);

								doIo(function() {
									fs.rename(file, newFile, function(err) {
										should.not.exist(err);
									});
								});
							});
						});
					});
				}

				it('should detect modification', function(done) {
					var file = path.join(root, 'foo.txt');
					fs.createFile(file, function(err) {
						should.not.exist(err);
						gargoyle.monitor(file, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;
							watcher.on('modify', function(filename) {
								filename.should.equal(file);
								done();
							});
							ensureNoEvents('create', 'delete', 'rename', done);

							doIo(function() {
								fs.appendFile(file, 'bar', function(err) {
									should.not.exist(err);
								});
							});
						});
					});
				});

				it('should detect deletion', function(done) {
					var file = path.join(root, 'foo.txt');
					fs.createFile(file, function(err) {
						should.not.exist(err);
						gargoyle.monitor(file, options, function(err, monitor) {
							should.not.exist(err);
							watcher = monitor;
							watcher.on('delete', function(filename) {
								filename.should.equal(file);
								done();
							});
							ensureNoEvents('create', 'rename', 'modify', done);

							doIo(function() {
								fs.unlink(file, function(err) {
									should.not.exist(err);
								})
							});
						});
					});
				});
			});

			describe('on a symbolic link', function() {
				it('should detect modification on source if watching target', function(done) {
					var source = path.join(root, 'foo.txt'),
						target = path.join(root, 'link.txt');
					fs.createFile(source, function(err) {
						should.not.exist(err);
						fs.symlink(source, target, function(err) {
							should.not.exist(err);
							gargoyle.monitor(target, options, function(err, monitor) {
								should.not.exist(err);
								watcher = monitor;
								watcher.on('modify', function(filename) {
									filename.should.equal(target);
									done();
								});

								doIo(function() {
									fs.appendFile(source, 'foo', function(err) {
										should.not.exist(err);
									});
								});
							});
						});
					});
				});

				it('should detect modification on target if watching source', function(done) {
					var source = path.join(root, 'foo.txt'),
						target = path.join(root, 'link.txt');
					fs.createFile(source, function(err) {
						should.not.exist(err);
						fs.symlink(source, target, function(err) {
							should.not.exist(err);
							gargoyle.monitor(source, options, function(err, monitor) {
								should.not.exist(err);
								watcher = monitor;
								watcher.on('modify', function(filename) {
									filename.should.equal(source);
									done();
								});

								doIo(function() {
									fs.appendFile(target, 'foo', function(err) {
										should.not.exist(err);
									});
								});
							});
						});
					});
				});
			});
		});
	});
});