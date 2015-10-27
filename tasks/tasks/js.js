var async = require('async');
var path = require('path');
var _ = require('lodash');
var gulpIf = require('gulp-if');
var gulp = require('gulp');
var utils = require('../utils');

var fs = require('fs');

module.exports = function (config, shouldWatch, doneTask) {
	var browserify = require('browserify');
	var uglify = require('gulp-uglify');
	var source = require('vinyl-source-stream');
	//var buffer = require('vinyl-buffer');
	var babelify = require('babelify');
	//var literalify = require('literalify');
	var watchify = require('watchify');
	var colors = require('colors/safe');


/*
	var literalifyConfig = _.object(_.map(config.cdn, function (cdnVal, module) {
		return [module, cdnVal[0]]
	}));
*/

	var entryPoints = _.map(config.entryPoints, function(ep, index){
		var name = path.basename(ep);

		var deps = [];
		var warnings = [];


		var bundler = browserify({
				debug: config.DEV,
				cache: {},
				packageCache: {},
				fullPaths: true
			})
			.require(ep + '/' + name + '.jsx')
			.transform({global: true}, babelify)
			//.transform({global: true} , literalify.configure(literalifyConfig))
			.external(config.libs)

		bundler.pipeline.get('deps')
			.on('data', function (data) {
				deps.push(data);
			})
			.on('end', function () {

				var warnings = [];
				deps = _.reduce(deps, function (r, d) {
					r[d.id] = _.keys(d.deps);

					if(d.id.indexOf('node_modules') !== -1){
						warnings.push(d.id.substring(d.id.indexOf('node_modules') + 13));
					}
					return r;
				}, {});

				if(warnings.length){
					console.log(colors.red("Warning: ") + "The following node modules are in your js bundle.");
					console.log('    ' + colors.yellow(warnings.join('\n    ')));
					console.log(colors.green("Consider adding these the 'libs' field in the gulpfile\n"));
				}

				fs.writeFile(ep + '/architecture.json', JSON.stringify(deps, null, '\t'));
			})



		return {
			name : name,
			bundler : bundler,
			bundle : function(done){
				done = done || function(){};
				return this.bundler
					.bundle()
					.on('error', function(err){
						utils.handleError.call(this, config.DEV, err)
					})
					.pipe(source('bundle.js'))
					//.pipe(buffer())
					.pipe(gulpIf(!config.DEV, uglify()))
					.pipe(gulp.dest(config.buildPath + '/' + name))
					.on('finish', done);
			},
			setupWatch : function(){
				var self = this;
				this.bundler = watchify(this.bundler);
				this.bundler.on('update', function(){
					console.log("[--------] Starting '" + colors.cyan(self.name + " js") +"'...")
					console.time("[--------] Finished '" + colors.cyan(self.name + " js") +"' after");
					self.bundle(function(){
						console.timeEnd("[--------] Finished '" + colors.cyan(self.name + " js") +"' after");
					});
				});
			}
		}
	});

	return async.map(entryPoints, function(ep,doneMap){
		if(shouldWatch) ep.setupWatch();
		ep.bundle(doneMap);
	}, doneTask);
}
