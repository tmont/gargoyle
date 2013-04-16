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

				fs.createFile(file, function(err) {
					should.not.exist(err);
				});
			});
		});
	});
});