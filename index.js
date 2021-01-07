const AWSXRay = require('aws-xray-sdk');
const XRayExpress = AWSXRay.express;

const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const express = require('express');

const awsRegion = process.env.DEFAULT_AWS_REGION || 'us-west-2';

// Capture all outgoing https requests
AWSXRay.captureHTTPsGlobal(require('https'));
const https = require('https');

// Capture MySQL queries
const mysql = AWSXRay.captureMySQL(require('mysql'));

const app = express();
const port = 3000;

app.use(XRayExpress.openSegment('SampleSite'));

app.get('/', (req, res) => {
  const seg = AWSXRay.getSegment();
  const sub = seg.addNewSubsegment('customSubsegment');
  setTimeout(() => {
    sub.close();
    res.sendFile(`${process.cwd()}/index.html`);
  }, 500);
});

app.get('/aws-sdk/', (req, res) => {
  // Capture DynamoDB client
  const ddb = AWSXRay.captureAWSClient(new DynamoDB({
    region: awsRegion
  }));
  const ddbPromise = ddb.listTables();

  ddbPromise.then(function(data) {
    res.send(`ListTables result:\n ${JSON.stringify(data)}`);
  }).catch(function(err) {
    res.send(`Encountered error while calling ListTables: ${err}`);
  });
});

app.get('/http-request/', (req, res) => {
  const endpoint = 'https://amazon.com/';
  https.get(endpoint, (response) => {
    response.on('data', () => {});

    response.on('error', (err) => {
      res.send(`Encountered error while making HTTPS request: ${err}`);
    });

    response.on('end', () => {
      res.send(`Successfully reached ${endpoint}.`);
    });
  });
});

app.get('/mysql/', (req, res) => {
  const mysqlConfig = require('./mysql-config.json');
  const config = mysqlConfig.config;
  const table = mysqlConfig.table;

  if (!config.user || !config.database || !config.password || !config.host || !table) {
    res.send('Please correctly populate mysql-config.json');
    return;
  }

  const connection = mysql.createConnection(config);
  connection.query(`SELECT * FROM ${table}`, (err, results, fields) => {
    if (err) {
      res.send(`Encountered error while querying ${table}: ${err}`);
      return;
    }
    res.send(`Retrieved the following results from ${table}:\n${results}`);
  });

  connection.end();
});

app.use(XRayExpress.closeSegment());

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
