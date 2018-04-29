const fs = require('fs');
const path = require('path');
const util = require('util');
const spawn = require('child_process');
const readdir = require('recursive-readdir');
const xml2js = require('xml2js');
const config = require('../config/config.json');

const commskipScript = path.join(__dirname, '../scripts/doCommskip.sh');
const compressScript = path.join(__dirname, '../scripts/doCompress.sh');

// Reads the edlx xml file and retuns as an object
async function getEdlx(file) {
  const parser = new xml2js.Parser();
  const convertEdlx = util.promisify(parser.parseString)
  const edlxFile = fs.readFileSync(file + '.edlx' );
  const result = await convertEdlx(edlxFile);
  return result;
}

const BUF_SIZE = 50000;
let buffer = new Buffer(BUF_SIZE);
function copyBlock(inFile, outFile, bytes) {
  let bytesCopied = 0;
  while(bytesCopied < bytes) {
    let length = Math.min(BUF_SIZE, bytes - bytesCopied); 
    let read = fs.readSync(inFile, buffer, 0, length, null);
    if (read !== length) {
      if (read > 0) {
        length = read; 
      } else {
        break;
      }; 
    }
    if (outFile) {
      fs.writeSync(outFile, buffer, 0, length);
    }
    bytesCopied = bytesCopied + length;
  };
}

// removes commercials from the file based
// on the edlx file with the cut points for the commercials
const MIN_COMMERCIAL_LENGTH = 10000000;
async function cleanFile(baseName, originFile, targetFile) {
  // open the input and output files
  const origFileSize = fs.lstatSync(originFile).size;
  const origFile = fs.openSync(originFile, 'r');
  const cleanFile = fs.openSync(targetFile, 'w');

  // read in the file with the list of commercials
  const edlx = await getEdlx(baseName);

  // copy original file to clean file skipping commercials
  let start = 0;
  for (let k = 0; k < edlx.regionlist.region.length; k++) {
    const commercialStart = edlx.regionlist.region[k].$.start;
    const commercialEnd = edlx.regionlist.region[k].$.end;
    let skipLength = 0;
    if (commercialEnd > commercialStart) {
      skipLength = commercialEnd - commercialStart;
      if (skipLength > MIN_COMMERCIAL_LENGTH) {
        // read to the start of the current commercial
        copyBlock(origFile, cleanFile, commercialStart - start);
        copyBlock(origFile, null, skipLength);
        start = commercialEnd; 
      }
    }
  }
        
  // now copy to the end of the file
  copyBlock(origFile, cleanFile, origFileSize - start); 
  fs.closeSync(origFile);
  fs.closeSync(cleanFile);
}

// read through the directories starting at the root and find new
// files to process or old files to clean up
// we process each new file one at a time sequentially as the processing
// consumes all available resource so doing more than one file
// at a time is not useful
readdir(config.tv_root,
        config.generated_files,
        async function(err, files) {

  // configuration entry is in days, millis is 24hours * 60 mins * 60 secs * 1000
  // multiplied by config value
  const deletion_time = Date.now() - config.deletion_delay*24*60*60*1000

  for (let i = 0; i < files.length; i++) {
    if (files[i].endsWith(config.new_video_extension)) {
      // This is a new file, process it
      try {
        const baseName = files[i].substring(0,files[i].indexOf(config.new_video_extension));

        // Start by running comskip on the file to mark commercials
        const result = spawn.spawnSync(commskipScript, [files[i]]);
        if (result.status !== 0) {
          console.log('Comskip Failed for:' + files[i]);
          console.log(result.stdout.toString());
          console.log(result.stderr.toString()); 
          throw(result.error);
        }
        
        const cleanFileName = files[i] + config.clean_video_extension;
        await cleanFile(baseName, files[i], cleanFileName); 

        // Now compress the file
        const targetFile = path.join(config.tv_root_done, path.basename(baseName)) + config.target_video_extension;
        result = spawn.spawnSync(compressScript, [cleanFileName, targetFile]);
        if (result.status !== 0) {
          console.log('Compress Failed for:' + files[i]);
          console.log(result.stdout.toString());
          console.log(result.stderr.toString()); 
          throw(result.error);
        }
        fs.rename(files[i], baseName + config.processed_extension); 
        //fs.unlink(cleanFileName);
      } catch (err) {
        console.log('Failed to process:' + files[i]);
        console.log(err);
      }
    } else if (files[i].endsWith(config.processed_extension)) {
      // This is an old file, check if it is time to clean up
      const stats = fs.lstatSync(files[i]);
      if (new Date(stats.ctime).getTime() < deletion_time) {
        const baseName = files[i].substring(0,files[i].indexOf(config.processed_extension));
        console.log('Removing(' + stats.ctime + '):' + baseName);
        fs.unlink(files[i]);
        for (let j = 0; j < config.generated_files.length; j++) {
          fs.unlink(baseName + config.generated_files[j].substring(1), () => {
            // this is ok as the file may not exist
          });
        }
      }
    }
  }
});
