const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').execFile);
const sax = require('sax');
const config = require("../config/config.json");

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
    if ((node.name === 'PROGRAMME') && (channels[node.attributes.CHANNEL])) {
      currentProgramme = node;
      return;
    }

    if ((node.name === 'TITLE') && (currentProgramme)) {
      inTitle = true;
    }

    if (node.name === 'CHANNEL') {
      currentChannelId = node.attributes.ID;
      return;
    }

    if (node.name === "DISPLAY-NAME") {
      inDisplayName = true;
      return;
    }

    if (node.name === 'SUB-TITLE') {
      inSubTitle = true;
    }

    if ((node.name === "PREVIOUSLY-SHOWN") && (node.attributes.START)) {
      previouslyShown = true;
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
    }

    if (inTitle) {
      src.shows.forEach((nextShow) => {
        if (text.includes(nextShow)) {
          title = text;
        }
      });
    }

    if (inSubTitle) {
      subTitle = text;
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
        console.log(title + '-' + subTitle);
        console.log(currentProgramme);
      }

      title = false;
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
