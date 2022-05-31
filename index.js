const express = require("express");
const line = require("@line/bot-sdk");
const dotenv = require("dotenv");
const admin = require("firebase-admin");
const moment = require("moment");

dotenv.config();
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
};

const client = new line.Client(config);
const app = express();
let db = null;

app.get("/", function (req, res) {
  res.send("hello world");
});

app.get("/check", function (req, res) {
  check_and_push();
  res.status(200).end();
});

app.post("/linewebhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      showError(err);
      res.status(500).end();
    });
});

const initFirebaseDB = function () {
  if (!db) {
    const keyJsonString =
      process.env.SERVICE_ACCOUNT_KEY_JSON ||
      JSON.stringify(require("./serviceAccountKey.json"));
    try {
      let serviceAccount = JSON.parse(keyJsonString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      db = admin.firestore();
    } catch (e) {
      console.error("invalid service account key string");
      throw e;
    }
  }
  return db;
};

const showError = function (err) {
  const error = err.originalError;
  if (error.response) {
    console.log(error.response.data);
    console.log(error.response.status);
    console.log(error.response.headers);
  } else if (error.request) {
    console.log(error.request);
  } else {
    console.log("Error", error.message);
  }
};

function handleEvent(event) {
  switch (event.type) {
    case "join":
      return handleJoin(event);
    case "leave":
      return handleLeave(event);
    default:
      return do_nothing(event);
  }
}

function do_nothing() {
  return Promise.resolve(null);
}

function handleJoin(event) {
  const source = event.source;
  if (source.type !== "group") {
    const echo = { type: "text", text: "Only support in group chat." };
    return client.replyMessage(event.replyToken, echo);
  }

  initFirebaseDB();
  const groupId = source.groupId;

  let docRef = db.collection("groups").doc(groupId);
  docRef
    .get()
    .then((doc) => {
      if (!doc.exists) {
        docRef.set({
          lineGroupId: groupId,
        });
      } else {
        console.log("Already had doc in db");
      }
    })
    .catch((err) => {
      console.log("Error getting document", err);
    });

  const msg = { type: "text", text: "L87生日機器人啟動" };
  return client.pushMessage(groupId, msg);
}

function handleLeave(event) {
  const source = event.source;
  initFirebaseDB();
  const groupId = source.groupId;

  db.collection("groups").doc(groupId).delete();
}

function check_and_push() {
  initFirebaseDB();
  const utcDate = moment().utc().utcOffset("+08:00");
  const mmdd = utcDate.format("MM-DD");

  db.collection("people")
    .doc("l87")
    .get()
    .then((doc) => {
      const person = doc.data()[mmdd];

      if (!person) {
        console.log(`today is ${mmdd}. no one birthday`);
        return;
      }

      const msg = {
        type: "text",
        text: `今天是 ${person} 生日。生日快樂!\uD83C\uDF82`,
      };

      db.collection("groups")
        .get()
        .then((snapshot) => {
          snapshot.forEach((doc) => {
            const isDisable = doc.data().disable;
            const groupId = doc.data().lineGroupId;
            if (isDisable || !groupId) {
              console.log(`group ${doc.id} might be disable or missing keys`);
              return;
            }
            client.pushMessage(groupId, msg).then((_) => {
              console.log(`push message to ${groupId} success`);
            });
          });
        });
    })
    .catch((err) => {
      showError(err);
    });
}

app.listen(process.env.PORT || 80, function () {
  console.log("LineBot running");
});
