'use strict';

var express     = require('express');
var bodyParser  = require('body-parser');
var expect      = require('chai').expect;
var logger      = require('morgan');
var cors        = require('cors');
const csp       = require('helmet-csp');
const mongo     = require('mongodb').MongoClient;

// Enable .env variables to be used
require('dotenv').config();

var apiRoutes         = require('./routes/api.js');
var fccTestingRoutes  = require('./routes/fcctesting.js');
var runner            = require('./test-runner');

var app = express();

app.use('/public', express.static(process.cwd() + '/public'));

app.use(cors({origin: '*'})); //For FCC testing purposes only

app.use(
  csp({
    directives: {
      defaultSrc: ["'none'"],
      connectSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: [
        "'self'",
        'https://hyperdev.com/favicon-app.ico',
        'http://glitch.com/favicon-app.ico'
      ],
      scriptSrc: [
        "'self'",
        'https://code.jquery.com/jquery-2.2.1.min.js',
        "'unsafe-inline'"
      ]
    }
  })
);

// Logger
app.use(logger('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

//For FCC testing purposes
fccTestingRoutes(app);

mongo.connect(process.env.DB, (err, db) => {
  if (err) {
    console.log('Database error: ' + err);
  } else {
    console.log('Successful database connection');

    //Routing for API
    apiRoutes(app, db);
    
    //404 Not Found Middleware
    app.use(function(req, res, next) {
      res
        .status(404)
        .type('text')
        .send('Not Found');
    });
  }
});

//Start our server and tests!
app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port " + process.env.PORT);
  if(process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch(e) {
        var error = e;
          console.log('Tests are not valid:');
          console.log(error);
      }
    }, 3500);
  }
});

module.exports = app; //for testing
