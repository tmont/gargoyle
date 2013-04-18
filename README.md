# Gargoyle

[![Build Status](https://travis-ci.org/tmont/gargoyle.png)](https://travis-ci.org/tmont/gargoyle)
[![NPM version](https://badge.fury.io/js/gargoyle.png)](http://badge.fury.io/js/gargoyle)

Monitor a directory for changes. You can detect file changes, creations,
deletions and renames. You know it works because it actually has tests!

## Installation
Via NPM: `npm install gargoyle`

## Usage
There is one export: `gargoyle.monitor(path[, options, callback])`. `path` should
be a filename (file or directory). IF it's a directory, it'll be traversed
recursively.

When something changes, it'll emit one of the following events:

* `modify` - when a file is modified
* `create` - when a file is created
* `delete` - when a file is deleted
* `rename` - when a file is renamed (only when options.type === "watch")

Your event listener should be a function that takes one argument: the
absolute path of the file that got modified/created/deleted/renamed.

### Example
Monitor a directory tree:

```javascript
var gargoyle = require('gargoyle');
gargoyle.monitor('/some/dir', function(err, monitor) {
	if (err) {
		console.error(err);
		return;
	}

	//monitor is an EventEmitter with the following properties:
	//  files is a hash of filename -> FSWatcher

	monitor.on('modify', function(filename) {
		console.log(filename + ' was modified');
	});
	monitor.on('delete', function(filename) {
		console.log(filename + ' was deleted');
	});
	monitor.on('create', function(filename) {
		console.log(filename + ' was created');
	});

	//only when options.type === "watch"
	monitor.on('rename', function(filename) {
		console.log(filename + ' was renamed');
	});
});
```

Stop monitoring:
```javascript
monitor.stop(function() {
	console.log('watchers stopped');
});

//monitor is now worthless
```

### Options
There are a few different options you can pass as an optional
second parameter to `gargoyle.monitor`.

#### Exclude certain files
```javascript
var path = require('path');
var options = {
	exclude: function(filename, stat) {
		//note: filename is absolute
		var basename = path.basename(filename);

		//ignore dotfiles
		if (basename.charAt(0) === '.') {
			return true;
		}

		//ignore the static directory
		if (stat.isDirectory() && basename === 'static') {
			return true;
		}

		//javascript/coffeescript files are okay
		if (!/\.(js|coffee)$/.test(basename)) {
			return true;
		}

		return false;
	}
};
gargoyle.monitor('/some/dir', options, function(err, monitor) {
	//...
});
```

#### Watch type
Use [`fs.watchFile`](http://nodejs.org/api/fs.html#fs_fs_watchfile_filename_options_listener)
instead of `fs.watch`. If you're on OS X, or trying to
watch a network directory (e.g. a shared folder in a VM), you'll want
to use `fs.watchFile`. `fs.watch` is far more efficient, and much faster,
but doesn't work all the time.

```javascript
var path = require('path');
var options = {
	type: 'watchFile' //default is 'watch'
};
gargoyle.monitor('/some/dir', options, function(err, monitor) {
	//...
});
```

## Development
```bash
git clone git@github.com:tmont/gargoyle.git
cd gargoyle
npm install
npm test
```

When running the tests, you'll notice the `fs.watchFile` tests take much longer.
This is due to the fact that some file systems do not have millisecond resolution,
which means we have to wait at least one second to detect a modification.
