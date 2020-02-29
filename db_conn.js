var path = require('path');
const sqlite3 = require("sqlite3").verbose();
var fs = require('fs');

const db_name = path.resolve(__dirname, "data", "drivers.db");
var folder_name = __dirname + "/data";
if (!fs.existsSync(folder_name)) {
  fs.mkdirSync(folder_name);
}

const db = new sqlite3.Database(db_name, err => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Successful connection to the database 'drivers.db'");
});


const sql_create = `CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone_number INT(11) NOT NULL UNIQUE,
  license_number VARCHAR(100) NOT NULL UNIQUE,
  car_number VARCHAR(15) NOT NULL UNIQUE,
  latitude DOUBLE NULL,
  longitude DOUBLE NULL  
);`;

db.run(sql_create, err => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Successful creation of the 'drivers' table");
});

module.exports = db;
