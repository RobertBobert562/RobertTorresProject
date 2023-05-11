// Add required packages
const express = require("express");
const app = express();
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');
// const multer = require("multer");
// const upload = multer();
const bodyParser = require('body-parser');

const dblib = require("./dblib.js");

dotenv.config();

// Set up EJS
app.set("view engine", "ejs");

app.use(express.static("views"));
app.use(bodyParser.urlencoded({ extended: true })); // move it here

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
      rejectUnauthorized: false
  },
  max: 2
});

app.use(bodyParser.json()); // can keep this here

// Start listener
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started (http://localhost:3000/) !");
});


// Setup routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/mgmt", async (req, res) => {
  dblib.getTotalRecords()
    .then(result => {
      res.render("mgmt", { model: result, customer: [], noRecordsFound: false, numRecordsFound: result.length });
    })
    .catch(err => {
      console.error(err.message);
      res.send("Error");
    });
});

app.post('/formPost', (req, res) => {
  const id = req.body.id || '';
  const fName = req.body.fName || '';
  const lName = req.body.lName || '';
  const state = req.body.state || '';
  const salesYtd = req.body.salesYtd || 0;
  const previousSales = req.body.previousSales || 0;

  // Prepare the SQL query based on the form inputs
  let query = 'SELECT * FROM customer WHERE 1=1';

  if (id !== '') {
    query += ` AND cusid = ${id}`;
  }
  if (fName !== '') {
    query += ` AND cusfname LIKE '${fName}%'`;
  }
  if (lName !== '') {
    query += ` AND cuslname LIKE '${lName}%'`;
  }
  if (state !== '') {
    query += ` AND state = '${state}'`;
  }
  if (salesYtd !== 0) {
    query += ` AND cussalesytd >= CAST(${salesYtd} AS MONEY)`;
  }
  if (previousSales !== 0) {
    query += ` AND cussalesprev >= CAST(${previousSales} AS MONEY)`;
  }

  // Execute the SQL query and getTotalRecords
  Promise.all([
    new Promise((resolve, reject) => {
      pool.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results.rows);
      });
    }),
    dblib.getTotalRecords()
  ])
  .then(([customer, model]) => {
    if (customer.length === 0) {
      res.render('mgmt', { customer: null, model: model, noRecordsFound: true });
    } else {
      res.render('mgmt', { customer, model: model, noRecordsFound: false, numRecordsFound: customer.length });
    }
  })
  .catch(err => {
    console.log(err);
    res.send('Error');
  });
});

app.get("/import", (req, res) => {
  dblib.getTotalRecords()
      .then(result => {
          res.render("import", { model: result.totrecords });
      })
      .catch(err => {
          console.log(err);
          res.send("Error");
      });
});

