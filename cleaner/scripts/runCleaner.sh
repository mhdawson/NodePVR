#!/bin/bash
export INSTALL_ROOT=$HOME
source $HOME/setup.sh
export LOG_FILE=$INSTALL_ROOT/cleaner-log.txt
touch $LOG_FILE
node $INSTALL_ROOT/NodePVR/cleaner/lib/index.js >> $LOG_FILE


