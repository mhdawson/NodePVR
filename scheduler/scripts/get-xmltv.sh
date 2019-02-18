#!/bin/bash
export PERL5LIB=../xmltv-install/share/perl/5.18.2/:$PERL5LIB
../xmltv-install/bin/tv_grab_na_dd --config-file config/xmltv.config --days $2 --dropbadchar >$1
