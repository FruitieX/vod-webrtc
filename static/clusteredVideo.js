/* clusteredVideo()
 *
 * Given a video element, callback function which fills a given arraybuffer,
 * and how many seconds we should buffer, this function will attach a
 * media source to the video element, fill the source buffer with data
 * by calling bufCallback until we have bufSeconds of buffer ahead of our
 * playing position.
 */

var clusteredVideo = function(bufCallback, videoElement, videoMetadata, clusterConcurrency, bufMinSeconds) {
	// tempClusters contains any clusters not yet passed on to the sourceBuffer
	// As soon as a cluster is appended to the sourceBuffer, it is deleted from
	// tempClusters. Clusters are stored as key/value pairs where the key is the index
	// and value is the data.
	//
	// pendingCluster contains the indices of pending clusters as keys, and a
	// boolean 'true' as its value.
	var tempClusters = {}; var pendingClusters = {};

	// sbCluster points to the cluster that we must append to the sourceBuffer next,
	// sbCluster starts from -1 which corresponds to all data before the first cluster
	var sbCluster = -1;

	var ms = new MediaSource();
	var sb;

	var getClusterTimeout;

	videoElement.src = window.URL.createObjectURL(ms);

	// NOTE: if you get this too early then your .webm video probably does not
	// contain keyframes where chrome expects them, use this program for a fix:
	// https://github.com/acolwell/mse-tools
	ms.addEventListener('sourceclose', function(e) {
		console.log("MEDIA SOURCE CLOSED: " + e);
		clearTimeout(getClusterTimeout);
	});

	var findClusterForTime = function(timecode) {
		console.log('finding cluster for time ' + timecode);
		for (var i = videoMetadata['clusters'].length - 1; i >= 0; i--) {
			if(timecode >= videoMetadata['clusters'][i].timecode) {
				console.log('returned ' + i );
				return i;
			}
		}

		// this shouldn't happen...
		console.log('wat');
		return 0;
	};

	videoElement.addEventListener('seeking', function(e) {
		console.log('seek to: ' + videoElement.currentTime);
		clearTimeout(getClusterTimeout);

		// find the cluster closest to seeked position from webm clusters
		sbCluster = findClusterForTime(videoElement.currentTime * 1000);
		getNextCluster();
	});

	ms.addEventListener('sourceopen', function() {
		sb = ms.addSourceBuffer('video/webm; codecs="vorbis,vp8"');

		// get first clusters
		for(var i = 0; i < clusterConcurrency; i++)
			getNextCluster();

		// call appendClusters as soon as the sourceBuffer is ready to receive more data
		sb.addEventListener('updateend', function() {
			appendClusters();
		});
	}, false);

	var getNextCluster = function() {
		// if the cluster buffer is not full, fetch more clusters.
		if(Object.keys(pendingClusters).length < clusterConcurrency) {
			if(videoElement.buffered.length && (videoElement.currentTime + bufMinSeconds <= videoElement.buffered.end(0))) {
				// we already have up to bufMinSeconds of video ahead of the playback head,
				// wait 1000ms and try again
				clearTimeout(getClusterTimeout);
				getClusterTimeout = setTimeout(function() {
					var tempPendingCnt = Object.keys(pendingClusters).length;
					for(var i = 0; i < clusterConcurrency - tempPendingCnt; i++) {
						//console.log('deferred getNextCluster()');
						getNextCluster();
					}
				}, 1000);
			} else {
				// fetch a cluster.

				// figure out which cluster id is next
				var currentCluster = sbCluster;
				while(true) {
					// already buffered the whole video?
					if(currentCluster >= videoMetadata['clusters'].length)
						return;

					if(currentCluster in pendingClusters || currentCluster in tempClusters) {
						currentCluster++;
					} else {
						pendingClusters[currentCluster] = true;
						break;
					}
				}

				bufCallback(currentCluster, storeCallback, failCallback);
			}
		} else {
			console.log("WARNING: getCluster() called even though clusterBuffer is full! (this shouldn't happen...)");
		}
	};

	setInterval(function() {
		// debug print
		if(videoElement.buffered.length)
			$("#stats").text("video played/buffered: " + Math.round(videoElement.currentTime) + 's/' + Math.round(videoElement.buffered.end(0)) + 's');
	}, 1000);

	/* Cluster handling */

	// attempt appending cluster at sbCluster
	// NOTE: this function is called when the sb event 'updateend' fires, that is,
	// when the sb has finished appending to its buffer. This means that this
	// function will 'loop' asynchronously whenever the sb is ready,
	// incrementing sbCluster each iteration, until we find the first cluster that
	// has not been fetched yet
	var appendClusters = function() {
		if(!(sbCluster in tempClusters))
			return; // we are missing a cluster and can't continue

		// if the sb is already processing buffers we don't need to do anything here;
		// appendClusters(); will be called asynchronously when the sb has finished
		if(!sb.updating) {
			sb.appendBuffer(tempClusters[sbCluster]);

			delete(tempClusters[sbCluster]);

			sbCluster++;

			if(videoElement.paused)
				videoElement.play();
		}
	};

	// called whenever a new cluster has been successfully fetched to store it
	var storeCallback = function(currentCluster, buf) {
		// store the cluster
		tempClusters[currentCluster] = buf;

		// no longer a pending cluster
		delete(pendingClusters[currentCluster]);

		// try appending fetched clusters into sb
		appendClusters();

		// start fetching another cluster
		getNextCluster();
	};

	// called whenever a cluster fetch failed
	var failCallback = function(currentCluster) {
		// no longer a pending cluster
		delete(pendingClusters[currentCluster]);

		// start fetching another cluster (possibly this failed one)
		getNextCluster();
	};
};
