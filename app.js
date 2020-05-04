var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var db = require('./db_conn');
var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post('/api/v1/driver/register/', (req, res) => {
  var name = req.body.name;
  var email = req.body.email;
  var phone_number = req.body.phone_number;
  var license_number = req.body.license_number;
  var car_number = req.body.car_number;

  var resp = validate_existence(name, 'Name');
  if (resp !== true) {
    return res.status(400).send({
      status: 'failure',
      reason: resp
    });
  }

  resp = validate_existence(email, 'Email');
  if (resp !== true) {
    return res.status(400).send({
      status: 'failure',
      reason: resp
    });
  }

  resp = validate_length(phone_number, 7, 'Phone Number')
  if (resp !== true) {
    return res.status(400).send({
      status: 'failure',
      reason: resp
    });
  }
  
  resp = validate_existence(license_number, 'License Number');
  if (resp !== true) {
    return res.status(400).send({
      status: 'failure',
      reason: resp
    });
  }

  resp = validate_existence(car_number, 'Car Number');
  if (resp !== true) {
    return res.status(400).send({
      status: 'failure',
      reason: resp
    });
  }
  
  phone_number = phone_number.toString();

  get_driver_db_from_other_info(email, phone_number, car_number, license_number)
  .catch((err) => res.status(500).json({
    'status': 'failure',
    'reason': 'Error occurred!'
  }))
  .then((row) => {
      if (row) {
        return res.status(400).json({
          'status': 'failure',
          'reason': 'Driver with the above details already exists!'
        })
      } else {
        insert_driver(req.body)
        .catch((err) => {
          return res.status(500).json({
            'status': 'failure',
            'reason': 'Error occurred!'
          })
        })
        .then((result) => {
          get_driver_by_email(email)
          .catch((err) => {
            return res.status(500).json({
              'status': 'failure',
              'reason': 'Error occurred!'
            })
          })
          .then((result) => {
            console.log(result);
            return res.status(201).send(result);
          });
        });
      }
  });
});


app.post('/api/v1/driver/:id/sendLocation/', (req, res) => {
  var latitude = req.body.latitude;
  var longitude = req.body.longitude;
  var driver_id = req.params.id;

  var resp = validate_existence(latitude, 'Latitude');
  if (resp !== true) {
    return res.status(400).send({
      status: 'failure',
      reason: resp
    });
  }

  resp = validate_existence(longitude, 'Longitude');
  if (resp !== true) {
    return res.status(404).send({
      status: 'failure',
      reason: resp
    });
  }

  get_driver_db(driver_id)
  .catch(() => res.status(400).json({
    'status': 'failure',
    'reason': 'Driver not found!'
  }))
  .then((row) => {
    update_driver_details(latitude, longitude, driver_id)
    .catch((err) => {
      res.status(500).json({
        'status': 'failure',
        'reason': 'Error occurred!'
      })  
    })
    .then((result) => {
      return res.status(202).send(true);
    })
  });
});


app.get('/api/v1/driver/:id/', (req, res) => {
  var driver_id = req.params.id;
  get_driver_db(driver_id)
  .catch(() => res.status(400).json({
    'status': 'failure',
    'reason': 'Driver not found!'
  }))
  .then((row) => res.status(200).send(row));
});


app.post('/api/v1/passenger/available_cabs/', (req, res) => {
  var latitude = req.body.latitude;
  var longitude = req.body.longitude;

  var resp = validate_existence(latitude, 'Latitude');
  if (resp !== true) {
    return res.status(400).send({
      status: 'failure',
      reason: resp
    });
  }

  resp = validate_existence(longitude, 'Longitude');
  if (resp !== true) {
    return res.status(400).send({
      status: 'failure',
      reason: resp
    });
  }
  get_available_cabs_v2()
  .catch((err) => res.status(500).json({
    'status': 'failure',
    'reason': 'Error occurred'
  }))
  .then((rows) => {
    if (rows && rows.length > 0) {
      var results = [];
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowLatitude = row['latitude'];
        const rowLongitude = row['longitude'];
        const rowLatitudeRadian = degrees_to_radians(rowLatitude);
        const rowLongitudeRadian = degrees_to_radians(rowLongitude);
        const latitudeRadian = degrees_to_radians(latitude);
        const longitudeRadian = degrees_to_radians(longitude);

        distance = 6371 * Math.acos(
          Math.cos(latitudeRadian) * Math.cos(rowLatitudeRadian) * Math.cos(rowLongitudeRadian - longitudeRadian)
          +
          Math.sin(latitudeRadian) * Math.sin(rowLatitudeRadian)
        );
        console.log(distance);

        if (distance <= 4) {
          results.push({
            'name': row['name'],
            'car_number': row['car_number'],
            'phone_number': row['phone_number'],
            'distance': distance
          })  
        }
      }

      results = results.sort((a, b) => (a.distance < b.distance) ? 1 : ((b.distance < a.distance) ? -1 : 0)); 

      return res.status(200).send(results[0]);
    } else {
      return res.status(400).json({        
        'message': 'No cabs available!'
      })
    }
  });
});

var validate_existence = function(input, field_display_name) {  
  if (!input) {
    return field_display_name + ' is required';
  }
  return true;
};

var validate_length = function(input, len, field_display_name) {
  var resp = validate_existence(input, field_display_name);
  if (resp === true) {
    if (input.toString().length != len) {
      return field_display_name + ' must be of ' + len + ' characters!';      
    }
    return true;
  } else {
    return resp;
  }
  
};

var get_driver_db = function(driver_id) {
  const sql = "SELECT * FROM drivers WHERE id = ? LIMIT 1";
  return new Promise((resolve, reject) => {
    db.get(sql, [driver_id], (err, result) => {
      if (err) {
        console.log('Error running sql: ' + sql)
        console.log(err)
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
};

var get_driver_db_from_other_info = function(email, phone_number, license_number, car_number) {
  const sql = "SELECT * FROM drivers WHERE email = ? or phone_number = ? or license_number = ? or car_number = ? LIMIT 1";
  return new Promise((resolve, reject) => {
    db.get(sql, [email, phone_number, license_number, car_number], (err, result) => {
      if (err) {
        console.log('Error running sql: ' + sql);
        console.log(err);
        reject(err);
      } else {
        resolve(result);
      }
    })
  })
};

var insert_driver = function(driver) {
  const sql = `INSERT INTO drivers (name, email, phone_number, license_number, car_number) VALUES(?, ?, ?, ?, ?);`;
  const params = [driver.name, driver.email, driver.phone_number, driver.license_number, driver.car_number];
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err, result) => {
      if (err) {
        console.log('Error running sql: ' + sql);
        console.log(err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  })
}

var get_driver_by_email = function(email) {
  const sql = "SELECT * FROM drivers WHERE email = ? LIMIT 1";
  return new Promise((resolve, reject) => {
    db.get(sql, [email], (err, result) => {
      if (err) {
        console.log('Error running sql: ' + sql);
        console.log(err);
        reject(err);
      } else {
        resolve(result);
      }
    })
  })
}

var update_driver_details = function(latitude, longitude, driver_id) {
  const sql = `UPDATE drivers SET latitude = ?, longitude = ? where id = ?;`;
  const params = [latitude, longitude, parseInt(driver_id)];
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err, result) => {
      if (err) {
        console.log('Error running sql: ' + sql);
        console.log(err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  })
}

var get_available_cabs_v2 = function() {
  const sql = `SELECT * FROM drivers where latitude is not null and longitude is not null;`;
  return new Promise((resolve, reject) => {
    db.all(sql, undefined, (err, results) => {
      if (err) {
        console.log('Error running sql: ' + sql);
        console.log(err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  })
}

var degrees_to_radians = function(degrees){
  var pi = Math.PI;
  return degrees * (pi/180);
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
