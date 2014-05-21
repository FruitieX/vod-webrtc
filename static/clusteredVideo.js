/* clusteredVideo()
 *
 * This function will attach a media source to the given video element, fill
 * the source buffer with data by calling bufCallback until we have
 * bufMinSeconds of buffer ahead of our playback position.
 *
 * Parameters:
 * - bufCallback(currentCluster, storeCallback, failCallback): called whenever
 *   we need more buffer
 * - videoElement: html5 video element we attach to
 * - videoMetadata: JSON containing information about the clusters in the video
 * - clusterConcurrency: how many cluster fetches can we perform concurrently
 * - bufMinSeconds: attempt to keep at least this many seconds of video in the
 *   buffer
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

	// sbCluster points to the first missing cluster ahead of the playback
	// position.  sbCluster starts from -1 which corresponds to all data before
	// the first WebM cluster.
	var sbCluster = -1;

	var ms = new MediaSource();
	var sb;

	var getClusterTimeout;

	videoElement.src = window.URL.createObjectURL(ms);

	// NOTE: chrome is extremely picky about the video files being in a certain
	// format, if you get this too early then your .webm video probably does not
	// contain keyframes where chrome expects them, see README for a fix

	var onsourceclose = function() {
		console.info("MEDIA SOURCE CLOSED");
		tempClusters = {};
		clearTimeout(getClusterTimeout);
		videoElement.removeEventListener('seeking', onseeking);
	};
	ms.addEventListener('sourceclose', onsourceclose);

	var findClusterForTime = function(timecode) {
		for (var i = videoMetadata['clusters'].length - 1; i >= 0; i--) {
			if(timecode >= videoMetadata['clusters'][i].timecode) {
				console.log('found cluster ' + i + ' for time ' + timecode);
				return i;
			}
		}

		console.warn('WARNING: seeked to unknown position in video');
		return 0;
	};

	var onseeking = function() {
		clearTimeout(getClusterTimeout);
		tempClusters = {};

		// find the cluster closest to seeked position from webm clusters
		sbCluster = findClusterForTime(videoElement.currentTime * 1000);
		getNextCluster();
	};
	videoElement.addEventListener('seeking', onseeking);

	var onsourceopen = function() {
		sb = ms.addSourceBuffer('video/webm; codecs="vorbis,vp8"');

		// get first clusters
		for(var i = 0; i < clusterConcurrency; i++)
			getNextCluster();

		// call appendClusters as soon as the sourceBuffer is ready to receive more data
		sb.addEventListener('updateend', function() {
			appendClusters();
		});
	};
	ms.addEventListener('sourceopen', onsourceopen);

	var haveEnoughBuffer = function() {
		// no buffer at all
		if(!videoElement.buffered.length)
			return false;

		// video element may have buffered several separate segments, find which
		// one of them the playhead is in currently
		var ct = videoElement.currentTime;
		for(var i = 0; i < videoElement.buffered.length; i++) {
			var start = videoElement.buffered.start(i);
			var end = videoElement.buffered.end(i);

			if(start <= ct && ct <= end) {
				if(ct + bufMinSeconds <= end)
					return true;
				else
					return false;
			}
		}
	};

	var getNextCluster = function() {
		// if we don't have too many concurrent requests yet, fetch more clusters
		if(Object.keys(pendingClusters).length < clusterConcurrency) {
			if(haveEnoughBuffer()) {
				// we already have up to bufMinSeconds of video ahead of the playback head,
				// wait 1000ms and try again
				clearTimeout(getClusterTimeout);
				getClusterTimeout = setTimeout(function() {
					var tempPendingCnt = Object.keys(pendingClusters).length;
					for(var i = 0; i < clusterConcurrency - tempPendingCnt; i++) {
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
			console.warn('WARNING: getNextCluster() called even though we have too many concurrent requests!');
		}
	};

	/* Cluster handling */

	// attempt appending cluster at sbCluster
	// NOTE: this function is called when the sb event 'updateend' fires, that is,
	// when the sb has finished appending to its buffer. This means that this
	// function will 'loop' asynchronously whenever the sb is ready,
	// incrementing sbCluster each iteration, until we find the first cluster that
	// has not been fetched yet (not in tempClusters)
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
