const fs = require('fs');
const os = require('os');
const dgram = require('dgram');

const MILLI_SECS_IN_MIN = 60 * 1000;

class  HDHomeRunRecorder {

  constructor(base, address, tuner) {
    this.base = base;
    this.tuner = tuner;
    this.inUse = false;
  }

  sendHDHomeRunCommand(command) {
    
  }

  start(channel, time, program) {
    if (this.inUse) {
      throw new Error('Already in use');
    }
    this.channel = channel;
    this.program = program;
    this.startRecording();

    // one the requested time has elapsed stop recording
    setTimeout(() => {
      this.stopRecording();
      console.log('recording stopped');
    }, time * MILLI_SECS_IN_MIN);
  };

  logAndStopRecording(logMessage) {
    // generate log

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

  startRecording() {
    this.inUse = true;
    this.input = dgram.createSocket('udp4');
    this.input.on('error', (err) => this.logAndStopRecording('udp error:' + err));

    this.output = fs.createWriteStream('filename');
    this.output.on('error', (err) => this.logAndStopRecording('fs write error:' + err));

    this.input.on('message', (data) => {
      ouput.write(this.output);
    });
    this.input.bind(() => {
      try {
        // ok tell the HDHomeRun to start streaming
        sendHDHomeRunCommand(`${this.base} set /${this.tuner}/channel auto:{this.channel}`);
        if (this.program) {
          sendHDHomeRunCOmment(`${this.base} set /${this.tuner}/program ${program}`);
        }
        sendHDHomeRunCommand(`${this.base} set /${this.tuner}/target udp://${this.address}:${port}`);
      } catch (err) {
        this.logAndStopRecording('failed to start HD streaming', err);
      }
    });
  }
}

const recorder = new HDHomeRunRecorder('test');
recorder.start(8, 1);


