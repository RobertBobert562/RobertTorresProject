// Add required packages
const express = require("express");
const app = express();
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();

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

app.post("/import",  upload.single('filename'), (req, res) => {
  if(!req.file || Object.keys(req.file).length === 0) {
      message = "Error: Import file not uploaded";
      return res.send(message);
  };
  //Read file line by line, inserting records
  const buffer = req.file.buffer; 
  const lines = buffer.toString().split(/\r?\n/);

  lines.forEach(line => {
       //console.log(line);
       product = line.split(",");
       //console.log(product);
       const sql = "INSERT INTO customer (cusId, cusFname, cusLname, cusState, cusSalesYTD, cusSalesPrev) VALUES ($1, $2, $3, $4, $5, $6)";
       pool.query(sql, product, (err, result) => {
           if (err) {
               console.log(`Insert Error.  Error message: ${err.message}`);
           } else {
               console.log(`Inserted successfully`);
           }
      });
  });
  message = `Processing Complete - Processed ${lines.length} records`;
  res.send(message);
});

  //GET displays simple form
  app.get("/export", (req, res) => {
    var message = "";
    res.render("export", { message: message });
  });
  
  //POST:
  //Runs a query to get all database records
  app.post("/export", (req, res) => {
    const sql = "SELECT * FROM customer ORDER BY cusid";
    pool.query(sql, [], (err, result) => {
      //Assigns variable output an empty string
        var message = "";
      if (err) {
        message = `Error - ${err.message}`;
        res.render("export", { message: message })
      } else {
        //Appends output with each database record
        var output = "";
        //loop through records to create csv
        result.rows.forEach(customer => {
          output += `${customer.cusid},${customer.cusfname},${customer.cuslname},${customer.cusstate},${customer.cussalesytd},${customer.cussalesprev}\r\n`;
        });
        //Sets the response header type and attachment file name (hard coded to export.csv)
        res.header("Content-Type", "text/csv");
        res.attachment("export.csv");
        //Returns output (will be downloaded)
        return res.send(output);
      };
    });
  });
  

// GET /create
app.get("/create", (req, res) => {
  res.render("create", { cus: {} });
});

app.post("/create", (req, res) => {
  const sql = "INSERT INTO customer (cusId, cusFname, cusLname, cusState, cusSalesYTD, cusSalesPrev) VALUES ($1, $2, $3, $4, $5, $6)";
  const cus = [req.body.cusId, req.body.cusFname, req.body.cusLname, req.body.cusState, req.body.cusSalesYTD, req.body.cusSalesPrev];
  pool.query(sql, cus, (err, result) => {
    if (err) {
      res.render("create", {
        error: "Error creating customer.",
        cus: req.body,
      });
    } else {
      res.render("create", {
        success: "Customer created successfully.",
        cus: req.body,
      });
    }
  });
});

app.get("/edit/:cusid", (req, res) => {
  const cusId = req.params.cusId;
  const sql = "SELECT * FROM customer WHERE cusId = $1";
  pool.query(sql, [cusId], (err, result) => {
    // if (err) ...
    const customer = result.rows[0];
    dblib.findcustomers((err, customer) => {
      if (err) {
        // handle error
      }
      res.render("edit", { model: customer, customer: customer });
    });
  });
});
