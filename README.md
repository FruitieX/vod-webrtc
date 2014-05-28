vod-webrtc
==========

setup
-----
* Get nodejs dependencies: `npm update`
* Run the signaling server: `node server.js`
* Edit the last line of `static/readVideoFile.js`, replace `/output` with the
  relative path on the HTTP server to the wanted video file & metadata (without
  filename extension). Replace `localhost` and `9000` with the host/port to
  your node server.
* Example video & metadata can be downloaded from:
	* http://fruitiex.org/output.webm
	* http://fruitiex.org/output.json
* Serve the static folder on a HTTP server. Your HTTP server must support the
  HTTP Range header, this is what is used for downloading the video in chunks.

chrome-friendly webm files:
---------------------------
* `ffmpeg -i input.mp4 -vf scale=1920x1080 -threads 4 -c:v libvpx -b:v 12M -keyint_min 150 -g 150 -c:a libvorbis output.webm`

if the video still won't play in chrome, fix keyframes to start of chunks:
--------------------------------------------------------------------------
* `export GOPATH=$HOME/go`
* `cd $GOPATH`
* `go get github.com/acolwell/mse-tools/...`
* `bin/mse_webm_remuxer path/to/broken.webm path/to/fixed.webm`

generate chunk list from a webm file:
-------------------------------------
* `git clone https://github.com/jspiros/python-ebml.git`
* `PYTHONPATH=python-ebml python2 utils/webmSegment.py video.webm > video.webm.json`
