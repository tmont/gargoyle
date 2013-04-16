# Gargoyle

[![Build Status](https://travis-ci.org/tmont/gargoyle.png)](https://travis-ci.org/tmont/gargoyle)

Monitor a directory for changes. You can detect file changes, creations,
deletions and renames. You know it works because it actually has tests!

This uses [`fs.watch`](http://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener)
so it probably doesn't work on OS X.

## Installation
Via NPM (eventually): `npm install gargoyle`

## Usage
There is one export: `gargoyle.monitor(path, callback)`. `path` should
be a filename (file or directory). IF it's a directory, it'll be traversed
recursively.

When something changes, it'll emit one of the following events:

* `changed` - when a file is modified
* `created` - when a file is created
* `deleted` - when a file is deleted
* `renamed` - when a file is renamed

Your event listener should be a function that takes one argument: the
absolute path of the file that got modified/created/deleted/renamed.

## Example
Monitor a directory tree:

```javascript
var gargoyle = require('gargoyle');
gargoyle.monitor('/some/dir', function(err, context) {
	if (err) {
		console.error(err);
		return;
	}

	//context.files is a hash of filename -> FSWatcher
	//context.monitor is an EventEmitter

	context.monitor.on('changed', function(filename) {
		console.log(filename + ' was modified');
	});
	context.monitor.on('deleted', function(filename) {
        console.log(filename + ' was deleted');
    });
    context.monitor.on('created', function(filename) {
        console.log(filename + ' was created');
    });
    context.monitor.on('renamed', function(filename) {
        console.log(filename + ' was renamed');
    });
});
```

Stop monitoring:
```javascript
gargoyle.stop(context, function() {
	console.log('monitors stopped');
});

//or, equivalently
context.monitor.stop(function() {
	console.log('monitors stopped');
});

//context is now worthless
```


## Development
```bash
git clone git@github.com:tmont/gargoyle.git
cd gargoyle
npm install
npm test
```

