var express = require('express');
var line = require('@line/bot-sdk');
var dotenv = require('dotenv');
const admin = require('firebase-admin');
var moment = require('moment');


dotenv.config();
var config = {  
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
}

var client = new line.Client(config);
var app = express();
var db = null;

app.get('/', function(req,res){
  res.send('hello world');
});

app.get('/check', function(req,res){
  check_and_push();
  res.status(200).end();
}); 

app.post('/linewebhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      showError(err);
      res.status(500).end();
    });
});

var getFirebaseDB = function() {
  if (!db) {
    var keyJsonString = process.env.SERVICE_ACCOUNT_KEY_JSON || JSON.stringify(require('./serviceAccountKey.json'));
    try {
      let serviceAccount = JSON.parse(keyJsonString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });

      db = admin.firestore();
    } catch(e) {
      console.error('invalid service account key string');
      throw e;
    }
  }
  return db;
}


var showError = function(err) {
  var error = err.originalError;
  if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
  } else if (error.request) {
      console.log(error.request);
  } else {
      console.log('Error', error.message);
  }
}


function handleEvent(event) {
  console.log(event);
  switch(event.type) {
    case 'join':
      return handleJoin(event);
    case 'leave':
      return handleLeave(event);
    default:
      return do_nothing(event);
  }
}

function do_nothing(event) {
  // if (event.type !== 'message' || event.message.type !== 'text') {
  //   return Promise.resolve(null);
  // }

  // const echo = { type: 'text', text: `今天是 TEST 生日。生日快樂!\uD83C\uDF82` };
  // return client.replyMessage(event.replyToken, echo);
  return Promise.resolve(null);
}

function handleJoin(event) {
  var source = event.source;
  if (source.type !== 'group') {
    var echo = { type: 'text', text: "Only support in group chat." };
    return client.replyMessage(event.replyToken, echo);
  }

  let db = getFirebaseDB();
  var groupId = source.groupId;

  let docRef = db.collection('groups').doc(groupId);
  docRef.get()
  .then(doc => {
    if (!doc.exists) {
      let setResult = docRef.set({
        lineGroupId: groupId
      });
    } else {
      console.log('Already had doc in db');
    }
  })
  .catch(err => {
    console.log('Error getting document', err);
  });

  var msg = { type: 'text', text: "L87生日機器人啟動" };
  return client.pushMessage(groupId, msg);
}

function handleLeave(event) {
  var source = event.source;

  let db = getFirebaseDB();
  var groupId = source.groupId;

  let docRef = db.collection('groups').doc(groupId).delete();
}

function check_and_push(groupId) {
  let people = get_bday_people();
  if (!people){
    console.log('no people data. no need to check');
    return;
  }

  var utcDate = moment().utc().utcOffset('+08:00');
  console.log(utcDate);
  var mmdd = utcDate.format('MM-DD');
  if (!people[mmdd]) {
    console.log(`today is ${mmdd}. no one birthday`);
    return;
  }
  var person = people[mmdd];
  var msg = { type: 'text', text: `今天是 ${person} 生日。生日快樂!\uD83C\uDF82` };

  let db = getFirebaseDB();
  db.collection('groups').get()
  .then((snapshot) => {
    snapshot.forEach((doc) => {
      console.log(doc.id, '=>', doc.data());
      const groupId = doc.data().lineGroupId;
      client.pushMessage(groupId, msg)
      .then((result) => {
        console.log(`push message to ${groupId} success`);
      })
      .catch((err) => {
        showError(err);
      });

    });
  })
  .catch((err) => {
    showError(err);
  });
}

function get_bday_people() {
  var bday_string = process.env.BDAY_DATA || JSON.stringify(require('./bday_data.json'));
  try {
    var bday = JSON.parse(bday_string);
    return bday.people;
  } catch(e) {
    console.error('invalid json string');
  }
  return null;
}

app.listen(process.env.PORT || 80, function(){
  console.log('LineBot running');
})