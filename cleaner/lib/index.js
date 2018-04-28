const fs = require('fs');
const readdir = require('recursive-readdir');
const config = require('../config/config.json');

readdir(config.tv_root,
        config.generated_files,
        function(err, files) {
  // configuration entry is in days, millis is 24hours * 60 mins * 60 secs * 1000
  // multiplied by config value
  const deletion_time = Date.now() - config.deletion_delay*24*60*60*1000

  for (let i = 0; i < files.length; i++) {
    if (files[i].endsWith(config.new_video_extension)) {
      console.log('NEW:' + files[i]);
    } else if (files[i].endsWith(config.processed_extension)) {
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
