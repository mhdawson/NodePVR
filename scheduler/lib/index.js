const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').execFile);
const sax = require('sax');
const moment = require('moment-timezone');
const config = require("../config/config.json");

const extraMinutes = config.extraMinutes || 2;
const staleDays = config.staleDays || 30;


const titleReplacements =  { "'": "",
                             ",": "",
                             "\\.": "",
                             " ": "_",
                             ":": "",
                             "\\?": "",
                             "!": "",
                             "\\/": "",
                             ";": "",
                             "\\\\": ""
                           };

function sanitizeTitle(title) {
  for (replaceMe in titleReplacements) {
    title = title.replace(new RegExp(replaceMe, 'g'), titleReplacements[replaceMe]);
  }
  return title;
}

async function getProgramData(src, dataFile) {
  const days = src.days || 5;
  const {stdout, stderr} = await exec(path.join(__dirname, '../scripts/get-xmltv.sh'), [dataFile, days]);
  console.log(stdout);
  console.log(stderr);
}

async function parseProgramData(src, dataFile) {
  let currentChannelId = undefined;
  let inDisplayName = false;
  let currentProgramme = undefined;
  let inTitle = undefined;
  let title = undefined;
  let inSubTitle = false;
  let subTitle = undefined;
  let previouslyShown = false;
  const channels = new Object();
  
  const programStream = sax.createStream();
  programStream.on('opentag', (node) => {
    // for channel processing
    if (node.name === 'CHANNEL') {
      currentChannelId = node.attributes.ID;
      return;
    }

    if (node.name === "DISPLAY-NAME") {
      inDisplayName = true;
      return;
    }

    // for programme processing
    if (node.name === 'PROGRAMME') {
      currentProgramme = undefined;
      title = undefined;
      subTitle = undefined;
      previouslyShown = false;
      if (channels[node.attributes.CHANNEL]) {
        currentProgramme = node;
      }
      return;
    }

    if ((node.name === 'TITLE') && (currentProgramme)) {
      inTitle = true;
      return;
    }

    if (node.name === 'SUB-TITLE') {
      inSubTitle = true;
    }

    if ( title && (node.name === "PREVIOUSLY-SHOWN")) {
      if (node.attributes.START) {
        // its considered previously shown if the date is within staleDays days
        const now = moment(new Date());
        const start = moment(node.attributes.START, 'YYYYMMDDHHmmss');
        const gap = moment.duration(now.diff(start)).asDays();
        if (gap > staleDays) {
          previouslyShown = true;
        }
      } else {
        // no start date so assume stale
        previouslyShown = true;
      }
      return;
    }
  });

  programStream.on('text', (text) => {
    // Record the mapping from the id used in the program data
    // to the id for the channel we need to use in the recording entry
    if (inDisplayName && currentChannelId) {
      for (channel in src.channel_mapping) {
        if (text.includes(channel)) {
          channels[currentChannelId] = src.channel_mapping[channel];
        }
      }
      return;
    }

    if (inTitle) {
      src.shows.forEach((nextShow) => {
        if (text.includes(nextShow)) {
          title = sanitizeTitle(text);
        }
      });
      return;
    }

    if (inSubTitle) {
      subTitle = sanitizeTitle(text);
      return;
    }
  });

  programStream.on('closetag', (tag) => {
    if (tag === 'DISPLAY-NAME') {
      inDisplayName = false;
      return;
    }

    if (tag === 'CHANNEL') {
      currentChannelId = undefined;
      inDisplayName = false;
      return;
    }

    if (tag === 'PROGRAMME') {
      if (title && !previouslyShown) {
        const start = moment(currentProgramme.attributes.START, 'YYYYMMDDHHmmss ZZ');
        if (start.isAfter(new Date())) {
          const end = moment(currentProgramme.attributes.STOP, 'YYYYMMDDHHmmss ZZ');
          const duration = moment.duration(end.diff(start)).asMinutes() + extraMinutes;
          console.log(start.format('m') + ' ' +
                      start.format('H') + ' ' +
                      start.format('D') + ' ' +
                      start.format('M') + ' ' +
                      '*' + ' ' +
                      src.recorder + ' ' +
                      title + ' ' +
                      title + start.format('MMDDHHmm') + '-' + subTitle + ' ' +
                      channels[currentProgramme.attributes.CHANNEL] + ' ' +
                      duration);
        }
      }

      // cleanup
      title = undefined;
      subTitle = undefined;
      previouslyShown = false; 
      currentProgramme = undefined;
      return;
    }

    if (tag === 'TITLE') {
      inTitle = false;
      return;
    }

    if (tag === 'SUB-TITLE') {
      inSubTitle = false;
      return;
    }
  });

  const parsed = new Promise((resolve, reject) => {
    programStream.on('end', () => {
      resolve();
    });
    programStream.on('error', (error) => {
      reject(error);
    });
  });

  fs.createReadStream(dataFile).pipe(programStream);

  await(parsed);

  console.log(channels);
}

async function getRecordEntries(src) {
  const dataFile = path.join(__dirname, "../data", src.data_file);
//  await getProgramData(src, dataFile);
  await parseProgramData(src, dataFile);
}

for (source in config.sources) {
  console.log('Generating record entries for:' + source);
  const src = config.sources[source];

  try { 
    getRecordEntries(src).then(() => {
      console.log('Completed record entries for:' + source);
    });
  } catch (e) {
    console.log('Failed to get program data for:');
    console.log(e);
    console.log(stderr);
  }
}
