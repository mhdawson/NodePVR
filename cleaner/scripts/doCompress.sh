#!/bin/bash
# HandBrakeCLI -i "$1" -c 1 -o "$2" -f mp4 -t 1 --loose-anamorphic --crop 0:0:0:0  -e x264 -q 24 -a 1 -E faac -6 dpl2 -R 48 -B 160 -D 0.0 -x ref=2:bframes=2:subq=6:mixed-refs=0:weightb=0:8x8dct=0:trellis=0:rc-lookahead=10:threads=6 -v 1
#HandBrakeCLI -i "$1" -c 1 -o "$2" -f mp4 -t 1 --loose-anamorphic --crop 0:0:0:0  --cfr -e x264 -q 24 -a 1 -E faac -r 29.97 -6 dpl2 -R 48 -B 160 -D 0.0 -x ref=2:bframes=2:subq=6:mixed-refs=0:weightb=0:8x8dct=0:trellis=0:rc-lookahead=0:threads=4 -v 1
HandBrakeCLI --cfr -i "$1" -o "$2" --preset "Very Fast 720p30"
