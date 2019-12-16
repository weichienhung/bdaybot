var linebot = require('linebot');
var express = require('express');

var bot = linebot({
  channelId: process.env.CHANNEL_ID,
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});

var app = express();

var linebotParser = bot.parser();

app.get('/', function(req,res){
  res.send('hello world');
});

app.post('/linewebhook', linebotParser);

bot.on('message', function (event) {
  event.reply(event.message.text).then(function (data) {
    // success
  }).catch(function (error) {
    // error
  });
});

// bot.listen('/linewebhook', 3000);
app.listen(process.env.PORT || 80, function(){
  console.log('LineBot running');
})