// server.js
// where your node app starts

// init project
const express = require('express');
const app = express();
const moment = require('moment');
const request = require('request');
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const mdbUrl = process.env.MONGODB_URI

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});
app.get("/recent", async (req, res) => {
  let queries = 5;
  if (Number(req.query.queries)){
    queries = Number(req.query.queries);
  }
  let x = await queryMongo(queries);
  res.end(JSON.stringify(x));
});
app.get("/search/:query", async (req, res) => {
  //res.sendFile(__dirname + '/views/index.html');
  let search = req.params.query;
  let page = req.query.offset;
  
  if (!page || page < 1){
    page = 1;
  }
  
  let buildQuery = "https://www.googleapis.com/customsearch/v1" + '?' 
  + "key=" + process.env.CSE_KEY 
  + "&cx=" + process.env.CSE_CX 
  + "&searchType=image"
  + "&q=" + search
  + "&start=" + page;
  
  console.log(buildQuery);
  
  //let results = await getResults(buildQuery);
  try{
    const [results, bar] = await Promise.all([getResults(buildQuery), writeToMongo(search)])
    //getResults(buildQuery).then(x=>{
    //  res.end(x);
    //})
    res.end(results);
  }catch(error){
    console.log(error); 
  }  
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

function getResults(url) {
  return new Promise((resolve,reject)=>{
    request.get(url, function (error, response, body) {
    let results = {};
      if (response.statusCode == 403){
        results = {error:"google limits..."};
        resolve(JSON.stringify(results));
      }
      if(error){
        reject(error);
      }
      if (!error && response.statusCode == 200) {
        body = JSON.parse(body);
        for (let i=0;i<body.items.length;i++){
          results[i] = {title : body.items[i].snippet,
                        url : body.items[i].link,
                        page_url : body.items[i].image.contextLink
                       }
        }
        resolve(JSON.stringify(results));
      }
    })
  })
}
function writeToMongo(query){
  MongoClient.connect(mdbUrl,(err, database) => {
      const db = database.db('shortened-urls');
      const searchCollection = db.collection('image-searches');
      if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
      } else {
        console.log('Connection established to', mdbUrl);
        const time = new moment().format('YYYY-MM-DD HH:mm:ss');
        searchCollection.insert({search_query: query, timestamp: time});
      }
  });
}
function queryMongo(number){
  return new Promise((resolve,reject)=>{
    MongoClient.connect(mdbUrl,(err, database) => {
        const db = database.db('shortened-urls');
        const searchCollection = db.collection('image-searches');
        if (err) {
          console.log('Unable to connect to the mongoDB server. Error:', err);
        } else {
          console.log('Connection established to', mdbUrl);
          console.log(searchCollection.find().limit(number).sort({ $natural: -1 }).toArray((err, result) =>{
            if (err) reject(err);
            console.log(result);
            resolve(result);
          }));
        }
    });
  });
}   