var meshblu = require('meshblu');
var meshbluJSON = require('./meshblu.json');
var five = require("johnny-five");
var _ = require('lodash');
var Stats = require('fast-stats').Stats;

var uuid    = meshbluJSON.uuid;
var token   = meshbluJSON.token;

var board = new five.Board({
  port: "/dev/ttyMFD1"
});

var push = 0, distance = 0, wheelDiameter = 0, i = 0;
var dataSize = 5;
var s = new Stats();
var savedSessions = {};
var posPushThreshold = 0.17;
var negPushThreshold = (-0.17);

var skateData = {
  pushes: 0,
  distance: 0
};

var sendSkateData = function(skateData){
  conn.message({
    "devices": "*",
    "payload": skateData
  });
};

var resetData = function(){
  skateData = {pushes: 0, distance: 0};
  distance = 0;
  push = 0;
  i = 0;
  s.reset();
};

var conn = meshblu.createConnection({
  "uuid": uuid,
  "token": token
});

var MESSAGE_SCHEMA = {
  "type": "object",
  "properties": {
    "reset": {
      "type": "boolean",
      "default": false
    },
    "savedSessions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "session": {
            "type": "string"
          },
          "distance": {
            "type": "string"
          },
          "pushes": {
            "type": "string"
          }
        }
      }
    }
  }
};

var OPTIONS_SCHEMA = {
  "type": "object",
  "properties": {
    "wheelDiameter": {
      "type": "integer"
    }
  }
};

conn.on('notReady', function(data){
  console.log('UUID FAILED AUTHENTICATION!');
  console.log(data);
});

conn.on('config', function(device){
  wheelDiameter = device.options.wheelDiameter;
});

conn.on('ready', function(data){
  console.log('UUID AUTHENTICATED!');
  console.log(data);

  conn.whoami({}, function(device){
    wheelDiameter = device.options.wheelDiameter;
  });

  conn.update({
    "uuid": uuid,
    "messageSchema": MESSAGE_SCHEMA,
    "optionsSchema": OPTIONS_SCHEMA
  });

  board.on("ready", function() {

    var reedSwitch = new five.Sensor.Digital(12);
    var imu = new five.IMU({controller: "MPU6050"});

    conn.on('message', function(message){
      if (message.payload.reset == true) {
        resetData();
      }
      savedSessions = message.payload.savedSessions;
    });

    reedSwitch.on("change", function() {
      if (this.value == 1) {
        distance += (wheelDiameter*Math.PI)/1000;
        skateData.distance = distance;
        sendSkateData(skateData);
      }
    });

    imu.on("change", function() {
      if (i < dataSize) {
        s.push(this.accelerometer.y);
        i ++;
      } else {
        s.shift();
        s.push(this.accelerometer.y);

        var r = s.range();
        var diff = r[1] - r[0];

        if (r[1] > posPushThreshold && r[0] < negPushThreshold) {
          push ++;
          skateData.pushes = push;
          sendSkateData(skateData);
          i = 0;
          s.reset();
        }
      }
    });
  });
});
