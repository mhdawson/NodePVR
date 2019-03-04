const fs = require('fs');
const os = require('os');
const dgram = require('dgram');

const MILLI_SECS_IN_MIN = 60 * 1000;

class  HDHomeRunRecorder {

  constructor(address, tuner) {
    this.address = address;
    this.tuner = tuner;
    this.inUse = false;
  }

  sendHDHomeRunCommand(command) {
    console.log(command);
  }

  start(channel, time, filename) {
    if (this.inUse) {
      throw new Error('Already in use');
    }

    this.program = undefined; 
    const separator = channel.indexOf('.');
    if (separator >= 0) {
      this.channel = channel.substring(0,separator);
      this.program = channel.substring(separator+1);
    } else {
      this.channel = channel;
    };

    this.startRecording(filename, time);
  };

  logAndStopRecording(logMessage) {
    // generate log
    console.log(logMessage);
    this.stopRecording();
  }

  stopRecording() {
    // close the input and output and make the recorder available for
    // re-use
    this.inUse = false;
    if (this.input) {
      this.input.close((err) => {
        this.input = undefined;
        if (this.output) {
            this.output.close();
            this.output = undefined;
        };
      });
    }
  }

  startRecording(filename, time) {
    this.inUse = true;
    this.input = dgram.createSocket('udp4');
    this.input.on('error', (err) => this.logAndStopRecording('udp error:' + err));

    this.output = fs.createWriteStream(filename);
    this.output.on('error', (err) => this.logAndStopRecording('fs write error:' + err));

    this.input.on('message', (data) => {
      ouput.write(this.output);
    });
    this.input.bind(0, this.address, (err) => {
      try {
        const port = this.input.address().port;
        // ok tell the HDHomeRun to start streaming
        this.sendHDHomeRunCommand(`hdhomerun_config set /${this.tuner}/channel auto:${this.channel}`);
        if (this.program) {
          this.sendHDHomeRunCommand(`hdhomerun_config set /${this.tuner}/program ${this.program}`);
        }
        this.sendHDHomeRunCommand(`hdhomerun_config set /${this.tuner}/target udp://${this.address}:${port}`);

        // one the requested time has elapsed stop recording
        setTimeout(() => {
          this.stopRecording();
          console.log('recording stopped');
        }, time * MILLI_SECS_IN_MIN);
      } catch (err) {
        this.logAndStopRecording('failed to start HD streaming' + err);
      }
    });
  }
}

const recorder = new HDHomeRunRecorder('10.1.1.56', 'tuner1');
const recorder2 = new HDHomeRunRecorder('10.1.1.56', 'tuner1');
recorder.start('25', 1, 'temp1');
recorder2.start('14.1', 1, 'temp2');


