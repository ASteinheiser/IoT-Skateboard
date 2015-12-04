var meshblu = require('meshblu');
var meshbluJSON = require('./meshblu.json');
var five = require("johnny-five");
var _ = require('lodash');
var fs = require('fs');

var uuid    = meshbluJSON.uuid;
var token   = meshbluJSON.token;

var wstream = fs.createWriteStream('/node_app_slot/firstRun.txt');

var conn = meshblu.createConnection({
  "uuid": uuid,
  "token": token
});

var MESSAGE_SCHEMA = {
  "type": 'object',
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

conn.on('ready', function(data){
  console.log('UUID AUTHENTICATED!');
  console.log(data);

  var throttledMessage = _.throttle(function(payload){
    conn.message({
      "devices": "*",
      "payload": payload
    });
  }, 500);

  conn.update({
    "uuid": uuid,
    "messageSchema": MESSAGE_SCHEMA
  });

  var board = new five.Board({
    port: "/dev/ttyMFD1"
  });

  board.on("ready", function() {
    var imu = new five.IMU({
      controller: "MPU6050"
    });

    var hallEffect = new five.Pin(12);

    five.Pin.read(hallEffect, function(error, value) {
      //console.log(value);
    });

    var distance = 0;
    //
    // hallEffect.on("change", function() {
    //   console.log(this.value);
    //   // if (this.value == 0) {
    //   //   distance += ((70)*Math.PI)/1000;
    //   //   console.log("total distance: " + distance);
    //   //
    //   //   throttledMessage({"distance": Math.round(distance * 100) / 100});
    //   // }
    // });

    imu.on("change", function() {
      var accel = ("\"" + this.accelerometer.y + "\"");
      wstream.write(accel, function(err){
        wstream.end();
      });

      console.log(this.accelerometer.y);
      if(this.accelerometer.y > 0.4){
        throttledMessage({"accel": this.accelerometer.y});
      }
    });
  });
});
