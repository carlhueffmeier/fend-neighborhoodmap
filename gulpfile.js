var gulp         = require('gulp');
var rename       = require('gulp-rename');
var concat       = require('gulp-concat');
var browserify   = require('browserify');
var runSequence  = require('run-sequence');
var autoprefixer = require('gulp-autoprefixer');
var cssnano      = require('gulp-cssnano');
var uglify       = require('gulp-uglify');
var source       = require('vinyl-source-stream');
var buffer       = require('vinyl-buffer');
var browserSync  = require('browser-sync').create();
var es           = require('event-stream');
var del          = require('del');
var sourceMaps   = require('gulp-sourcemaps');
var jshint       = require('gulp-jshint'); // TODO

// .pipe(jshint())
//       .pipe(jshint.reporter('default'))

gulp.task('css', function() {
  var files = [
    './node_modules/bootstrap/dist/css/bootstrap*.min.css',
    './node_modules/javascript-autocomplete/auto-complete.css',
    './app/css/*'
  ];
  return gulp.src(files)
    .pipe(concat('styles.css'))
    .pipe(autoprefixer({ browsers: ['last 2 versions', '> 5%', 'Firefox ESR'] }))
    .pipe(gulp.dest('./dist/css'))
    .pipe(cssnano('styles.min.css'))
    .pipe(gulp.dest('./dist/css'))
    .pipe(browserSync.stream());
});

gulp.task('html', function() {
  return gulp.src('./app/*.html')
    .pipe(gulp.dest('./dist/'))
    .pipe(browserSync.stream());
});

gulp.task('javascript', function() {
  // https://fettblog.eu/gulp-browserify-multiple-bundles/
  var files = [
    './app/js/main.js'
  ];
  var tasks = files.map(function(entry) {
    var b = browserify({
      entries: [entry],
      debug: true
    })
    return b.bundle()
      .pipe(source(entry))
      .pipe(buffer())
      .pipe(sourceMaps.init({ loadMaps: true }))
        // .pipe(uglify())
        .pipe(sourceMaps.write('./maps/'))
      .pipe(rename({dirname: ''}))
      .pipe(gulp.dest('./dist/js'))
      .pipe(browserSync.stream());
  });
  return es.merge.apply(null, tasks);
});

gulp.task('fonts', function() {
  return gulp.src('./node_modules/bootstrap/dist/fonts/*')
    .pipe(gulp.dest('./dist/fonts'))
    .pipe(browserSync.stream());
});

gulp.task('assets', function() {
  return gulp.src('./app/assets/*')
    .pipe(gulp.dest('./dist/assets'))
    .pipe(browserSync.stream());
});

gulp.task('browserSync', function() {
  browserSync.init({
    server: {
      baseDir: 'dist'
    }
  })
});

gulp.task('watch', ['browserSync'], function() {
  gulp.watch('./app/css/*.css', ['css']);
  gulp.watch('./app/*.html', ['html']);
  gulp.watch('./app/assets/*', ['assets']);
  gulp.watch('./app/js/*.js', ['javascript']);
  // TODO: change to watchify
});

gulp.task('clean', del.bind(null, ['maps', 'dist']));

gulp.task('default', function(callback) {
  runSequence(['browserSync', 'css', 'html', 'javascript', 'assets', 'fonts'],
    callback
  )
});
