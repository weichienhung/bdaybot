var express = require('express');
var line = require('@line/bot-sdk');
var dotenv = require('dotenv');
var JSONParseError = require('@line/bot-sdk').JSONParseError
var SignatureValidationFailed = require('@line/bot-sdk').SignatureValidationFailed
var schedule = require('node-schedule');

dotenv.config();
var config = {  
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
}

var client = new line.Client(config);
var scheduler = {};
var app = express();
var people;

app.get('/', function(req,res){
  res.send('hello world');
});

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

app.post('/linewebhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      showError(err);
      res.status(500).end();
    });
});

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
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const echo = { type: 'text', text: `今天是 TEST 生日。生日快樂!\uD83C\uDF82` };
  return client.replyMessage(event.replyToken, echo);
  // return Promise.resolve(null);
}

function handleJoin(event) {
  var source = event.source;
  if (source.type !== 'group') {
    var echo = { type: 'text', text: "Only support in group chat." };
    return client.replyMessage(event.replyToken, echo);
  }

  var groupId = source.groupId;
  schedule_push(groupId);
  var msg = { type: 'text', text: "L87生日機器人啟動" };
  return client.pushMessage(groupId, msg);
}

function handleLeave(event) {
  var source = event.source;

  console.log(scheduler);
  var groupId = source.groupId;
  if (scheduler[groupId]) {
    scheduler[groupId].cancel();
  } else {
    console.log('Cannot find scheduleId by groupId:' + groupId);
  }
}


function schedule_push(groupId) {
  var schedule_job = check_and_push.bind(null, groupId);
  var scheduleId = schedule.scheduleJob('30 8 * * *', schedule_job);
  scheduler[groupId] = scheduleId;
  console.log('schedule the push.');
  return Promise.resolve(null);
}

function check_and_push(groupId) {
  if (!people){
    console.log('no people data. no need to check');
    return;
  }
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, '0');
  var mm = String(today.getMonth() + 1).padStart(2, '0');
  var mmdd = `${mm}-${dd}`

  if (!people[mmdd]) {
    console.log(`today is ${mmdd}. no one birthday`);
    return;
  }
  var person = people[mmdd];
  var msg = { type: 'text', text: `今天是 ${person} 生日。生日快樂!\uD83C\uDF82` };
  client.pushMessage(groupId, msg)
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    showError(err);
  });
}

var bday_string = process.env.BDAY_DATA || JSON.stringify(require('./bday_data.json'));
(function init_bday(bday_string) {
  try {
    var bday = JSON.parse(bday_string);
    people = bday.people;
  } catch(e) {
    console.error('invalid json string');
  }
})(bday_string);

app.listen(process.env.PORT || 80, function(){
  console.log('LineBot running');
})