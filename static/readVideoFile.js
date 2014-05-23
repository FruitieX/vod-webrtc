var rtcVideoPlayer = function(videoElement, videoMetadataUrl) {
	$.getJSON(videoMetadataUrl, function(videoMetadata) {
		// constants
		var clusterConcurrency = 5; // how many clusters are fetched concurrently
		var bufMinSeconds = 30; // try to keep at least this many seconds buffered

		var init = function() {
			for (var i = 0; i < videoMetadata['clusters'].length; i++) {
				clusters[i] = {
					'data': false,
					'havePeers': []
				};
			}

			if (isWebRTCCapable)
				rtcConnectionManager();
		};

		/* UI */

		// DEBUG print
		setInterval(function() {
			if(!videoElement.buffered.length)
				return false;

			// find which buffer segment we are in
			var ct = videoElement.currentTime;
			for(var i = 0; i < videoElement.buffered.length; i++) {
				var start = videoElement.buffered.start(i);
				var end = videoElement.buffered.end(i);

				if(start <= ct && ct <= end) {
					$("#stats").text("video played/buffered: " + Math.round(ct) + 's/' + Math.round(end) + 's');
				}
			}
		}, 1000);

		// enable the start button
		$("#startButton").removeAttr("disabled");
		$("#startButton").click(function(e) {
			clusteredVideo(fetchCluster, videoElement, videoMetadata, clusterConcurrency, bufMinSeconds);
		});

		/* Clusters */

		var clusters = [];

		var getClusterEnd = function(currentCluster) {
			if(currentCluster < videoMetadata['clusters'].length - 1) {
				return videoMetadata['clusters'][currentCluster + 1].offset - 1;
			} else {
				return videoMetadata['total_size'];
			}
		};

		/* Networking */

		var fetchCluster = function(currentCluster, clusterPriority, storeCallback, failCallback) {
			console.log('cluster ' + currentCluster + ' prio: ' + clusterPriority);
			if(!isWebRTCCapable || clusterPriority <= 1) { // one cluster ahead of playback, we need it ASAP!
				console.log('using XHR');
				xhrRequest(currentCluster, storeCallback, failCallback);
			} else { // use WebRTC datachannels
				console.log('using WebRTC');
				rtcRequest(currentCluster, storeCallback, failCallback);
			}
		};

		// WebRTC
		var isWebRTCCapable = true;
		var rtcPeers = [];

		// connects to peers, handles chunk lists
		var rtcConnectionManager = function() {
		};

		var rtcRequest = function(currentCluster, storeCallback, failCallback) {
			failCallback(currentCluster);
		};

		// XHR
		var xhrRequest = function(currentCluster, storeCallback, failCallback) {
			var xhr = new XMLHttpRequest();
			xhr.open('GET', videoMetadata.filename, true);
			xhr.responseType = 'arraybuffer';
			xhr.timeout = 10 * 1000;

			// cluster -1 contains all data before the first webm cluster
			if(currentCluster === -1) {
				xhr.setRequestHeader('Range', 'bytes=0-' + getClusterEnd(-1));
			} else {
				xhr.setRequestHeader('Range', 'bytes=' +
						videoMetadata['clusters'][currentCluster].offset + '-' +
						getClusterEnd(currentCluster));
			}

			xhr.send();

			xhr.onreadystatechange = function() {
				if(xhr.readyState == 4) { // readyState DONE
					if (xhr.status == 206) // 206 (partial content)
						storeCallback(currentCluster, new Uint8Array(xhr.response));
					else {
						failCallback(currentCluster);
					}
				}
			};
		};

		init();
	});
};

rtcVideoPlayer(document.querySelector('video'), '/output.webm.json');
