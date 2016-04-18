/**
 * Created by trond on 16.04.2016.
 */

'use strict';

var watchify = require('watchify');
var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var assign = require('lodash.assign');
var babelify = require('babelify');
var envify = require('envify');
var uglify = require('gulp-uglify');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync').create();
var CacheBuster = require('gulp-cachebust');
var cachebust = new CacheBuster();
var del = require('del');
var rev = require('gulp-rev');
var revReplace = require('gulp-rev-replace');
var watch = require('gulp-watch');
var fs = require('fs');

// ######################################################
//          JAVASCRIPT BUILDING
// ######################################################

var supportedBrowsers = ['last 2 versions', 'IE 9'];

// add custom browserify options here
var customOpts = {
    entries: ['./src/js/main.js'],
    debug: true
};
var opts = assign({}, watchify.args, customOpts);

watchify.args.debug = true;
var b = watchify(browserify(opts), watchify.args);

// add transformations here
// i.e. b.transform(coffeeify);
b.transform(babelify);
b.transform(envify);

gulp.task('js', bundle); // so you can run `gulp js` to build the file
b.on('update', bundle); // on any dep update, runs the bundler
b.on('log', gutil.log); // output build logs to terminal

function bundle() {
    process.env.NODE_ENV = 'development';
    return b.bundle()
        // log errors if they happen
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source('bundle.js'))
        // optional, remove if you don't need to buffer file contents
        .pipe(buffer())
        // optional, remove if you dont want sourcemaps
        //.pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
        // Add transformation tasks to the pipeline here.
        .on('error', gutil.log)
        //.pipe(sourcemaps.write('./')) // writes .map file
        .pipe(gulp.dest('./tmp/js'))
        .pipe(browserSync.stream());
}



// ######################################################
//          JAVASCRIPT BUILDING ENDED
// ######################################################

// ######################################################
//          SCSS/CSS BUILDING
// ######################################################

gulp.task('sass', function() {
    return gulp.src('./src/scss/styles.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({
            outputStyle: 'compressed'
        }).on('error', sass.logError))
        .pipe(autoprefixer({
            browsers: supportedBrowsers,
            cascade: false
        }))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./tmp/css'))
        .pipe(browserSync.stream());
});

gulp.task('sass:watch', function() {
    watch('./src/scss/**/*.scss', () => {
        gulp.start('sass');
    });
});

// ######################################################
//          SCSS/CSS ENDED
// ######################################################


// ######################################################
//          BROWSERSYNC
// ######################################################

gulp.task('serve', ['sass', 'copy', 'copy:fonts'], function() {
    browserSync.init({
        open: false,
        server: {
            baseDir: 'tmp'
        }
    });
    watch('./src/scss/**/*.scss', () => {
        gulp.start('sass');
    });
    watch('./src/fonts/**/*', () => {
        gulp.start('copy:fonts');
    });
    watch('./src/html/*.html', () => {
        gulp.start('copy');
    });
});

// ######################################################
//          BROWSERSYNC END
// ######################################################

// ######################################################
//          COPY STATIC FILES
// ######################################################

gulp.task('copy:fonts', function() {
    gulp.src('./src/fonts/**/*', {base: './src'})
        .pipe(gulp.dest('tmp'))
        .pipe(browserSync.stream());
});
gulp.task('copy', function() {
    gulp.src('./src/html/*.html', {base: './src/html'})
        .pipe(gulp.dest('tmp'))
        .pipe(browserSync.stream());
});
// ######################################################
//          COPY END
// ######################################################

// cleanup
gulp.task('clean:release', function(cb) {
    return del(['dist'], cb)
});
// copy files to prepare for relase
gulp.task('copy:release', ['clean:release'], function() {
    return gulp.src('src/html/*.html', {base: './src/html', dot: true})
        .pipe(gulp.dest('dist'));
});
gulp.task('copy:fonts:release', ['clean:release'], function() {
    return gulp.src('./src/fonts/**/*', {base: './src'})
        .pipe(gulp.dest('dist'));
});
gulp.task('copy:img:release', ['clean:release'], function() {
    return gulp.src('./src/img/**/*', {base: './src'})
        .pipe(gulp.dest('dist'));
});
// build javascript
gulp.task('js:release', ['copy:release'], function() {
    // set env var NODE_ENV to trigger dead code removal and delicious perf
    process.env.NODE_ENV = 'production';
    var b = browserify({entries: ['./src/js/main.js']});
    b.transform(babelify);
    b.transform(envify);
    return b.bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source('bundle.js'))
        // optional, remove if you don't need to buffer file contents
        .pipe(buffer())
        .pipe(uglify())
        .on('error', gutil.log)
        .pipe(gulp.dest('./dist/js'));
});
// build styles
gulp.task('scss:release', ['copy:release'], function() {
    return gulp.src('./src/scss/styles.scss')
        .pipe(sass({outputStyle: 'compressed'}))
        .pipe(autoprefixer({
            browsers: supportedBrowsers,
            cascade: false
        }))
        .pipe(gulp.dest('./dist/css'));
});
// rev static files
gulp.task('revision:release', ['js:release', 'scss:release'], function() {
    var staticPath = 'dist';
    var files = [
        staticPath + 'css/*.css',
        staticPath + 'js/*.js'
    ];
    return gulp.src(files, {base: '.'})
        .pipe(rev())
        .pipe(gulp.dest('.'))
        .pipe(rev.manifest())
        .pipe(gulp.dest('.'));
});
gulp.task('clean:postbuild', ['revision:release'], function(cb) {
    var staticPath = 'dist';
    var files = [
        staticPath + 'css/styles.css',
        staticPath + 'js/bundle.js'
    ];
    return del(files, cb);
});
gulp.task('revision:refchange', ['revision:release'], function() {
    var manifest = gulp.src('./rev-manifest.json');
    var commonPath = 'dist';
    return gulp.src([commonPath + 'index.html'])
        .pipe(revReplace({
            manifest: manifest,
            replaceInExtensions: ['.html']
        }))
        .pipe(gulp.dest(commonPath));
});

gulp.task('default', ['js', 'serve']);

gulp.task('build', [
    'clean:release',
    'copy:release',
    'copy:fonts:release',
    'copy:img:release',
    'js:release',
    'scss:release',
    'revision:refchange',
    'clean:postbuild'
]);