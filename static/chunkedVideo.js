/* chunkedVideo()
 *
 * Given a video element, callback function which fills a given arraybuffer,
 * and how many seconds we should buffer, this function will attach a
 * media source to the video element, fill the source buffer with data
 * by calling bufCallback until we have bufSeconds of buffer ahead of our
 * playing position.
 */

var chunkedVideo = function(videoElement, bufCallback, chunkCount, chunkBufferSize, bufMinSeconds) {
	// tempChunks contains any chunks not yet passed on to the sourceBuffer
	// As soon as a chunk is appended to the sourceBuffer, it is deleted from
	// tempChunks. Chunks are stored as key/value pairs where the key is the index
	// and value is the data.
	//
	// pendingChunk contains the indices of pending chunks as keys, and a
	// boolean 'true' as its value.
	var tempChunks = {}; var pendingChunks = {};

	// sbChunk points to the chunk that we must append to the sourceBuffer next,
	var sbChunk = 0;

	var ms = new MediaSource();
	var sb;

	var getChunkTimeout;

	videoElement.src = window.URL.createObjectURL(ms);

	// NOTE: if you get this too early then your .webm video probably does not
	// contain keyframes where chrome expects them, use this program for a fix:
	// https://github.com/acolwell/mse-tools
	ms.addEventListener('sourceclose', function(e) {
		console.log("MEDIA SOURCE CLOSED: " + e);
		clearTimeout(getChunkTimeout);
	});

	videoElement.addEventListener('seeking', function(e) {
		console.log('seek to: ' + videoElement.currentTime);
		/*
		clearTimeout(getChunkTimeout);
		//tempChunks = {}; pendingChunks = {};
		sbChunk = 0; // TODO: find the chunk closest to seeked position from webm clusters
		getNextChunk();
		*/
	});

	ms.addEventListener('sourceopen', function() {
		sb = ms.addSourceBuffer('video/webm; codecs="vorbis,vp8"');

		// get first chunks
		for(var i = 0; i < chunkBufferSize; i++)
			getNextChunk();

		// call appendChunks as soon as the sourceBuffer is ready to receive more data
		sb.addEventListener('updateend', function() {
			appendChunks();
		});
	}, false);

	var getNextChunk = function() {
		// if the chunk buffer is not full, fetch more chunks.
		if(Object.keys(pendingChunks).length < chunkBufferSize) {
			if(videoElement.buffered.length && (videoElement.currentTime + bufMinSeconds <= videoElement.buffered.end(0))) {
				// we already have up to bufMinSeconds of video ahead of the playback head,
				// wait 1000ms and try again
				clearTimeout(getChunkTimeout);
				getChunkTimeout = setTimeout(function() {
					var tempPendingCnt = Object.keys(pendingChunks).length;
					for(var i = 0; i < chunkBufferSize - tempPendingCnt; i++) {
						console.log('deferred getNextChunk()');
						getNextChunk();
					}
				}, 1000);
			} else {
				// fetch a chunk.

				// figure out which chunk id is next
				var currentChunk = sbChunk;
				while(true) {
					// already buffered the whole video?
					if(currentChunk >= chunkCount)
						return;

					if(currentChunk in pendingChunks || currentChunk in tempChunks) {
						currentChunk++;
					} else {
						pendingChunks[currentChunk] = true;
						break;
					}
				}

				bufCallback(currentChunk, storeCallback, failCallback);
			}
		} else {
			console.log("WARNING: getChunk() called even though chunkBuffer is full! (this shouldn't happen...)");
		}
	};

	setInterval(function() {
		// debug print
		if(videoElement.buffered.length)
			$("#stats").text("video played/buffered: " + Math.round(videoElement.currentTime) + 's/' + Math.round(videoElement.buffered.end(0)) + 's');
	}, 1000);

	/* Chunk handling */

	// attempt appending chunk at sbChunk
	// NOTE: this function is called when the sb event 'updateend' fires, that is,
	// when the sb has finished appending to its buffer. This means that this
	// function will 'loop' asynchronously whenever the sb is ready,
	// incrementing sbChunk each iteration, until we find the first chunk that
	// has not been fetched yet
	var appendChunks = function() {
		if(!(sbChunk in tempChunks))
			return; // we are missing a chunk and can't continue

		// if the sb is already processing buffers we don't need to do anything here;
		// appendChunks(); will be called asynchronously when the sb has finished
		if(!sb.updating) {
			sb.appendBuffer(tempChunks[sbChunk]);

			delete(tempChunks[sbChunk]);

			sbChunk++;

			if(videoElement.paused)
				videoElement.play();
		}
	};

	// called whenever a new chunk has been successfully fetched to store it
	var storeCallback = function(currentChunk, buf) {
		// store the chunk
		tempChunks[currentChunk] = buf;

		// no longer a pending chunk
		delete(pendingChunks[currentChunk]);

		// try appending fetched chunks into sb
		appendChunks();

		// start fetching another chunk
		getNextChunk();
	};

	// called whenever a chunk fetch failed
	var failCallback = function(currentChunk) {
		// no longer a pending chunk
		delete(pendingChunks[currentChunk]);

		// start fetching another chunk (possibly this failed one)
		getNextChunk();
	};
};
