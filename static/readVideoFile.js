var rtcVideoPlayer = function(videoElement, videoPath, peerjsHost, peerjsPort) {
	$.getJSON(videoPath + '.json', function(videoMetadata) {
		// constants
		var clusterConcurrency = 3; // how many clusters are fetched concurrently
		var clusterTimeout = 10; // how many seconds it takes to time out a request
		var bufMinSeconds = 30; // try to keep at least this many seconds buffered
		var dataConnectionCnt = 10; // try to connect to this many rtc peers

		var init = function() {
			for (var i = 0; i < videoMetadata['clusters'].length; i++) {
				clusters[i] = false;
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

		// function for intercepting call to storeCallback, stores the cluster
		// in a local array where we can find it upon rtc peers requesting it
		var rtcStoreClusterCallback = function(currentCluster, data, storeCallback) {
			if(isWebRTCCapable)
				clusters[currentCluster] = data;
			storeCallback(currentCluster, data);
		};

		/* Networking */

		var fetchCluster = function(currentCluster, clusterPriority, storeCallback, failCallback) {
			//console.log('cluster ' + currentCluster + ' prio: ' + clusterPriority);
			if(clusters[currentCluster]) { // cluster already stored?
				storeCallback(currentCluster, clusters[currentCluster]);
			} else if(!isWebRTCCapable || clusterPriority <= 1) { // one cluster ahead of playback, we need it ASAP!
				xhrRequest(currentCluster, storeCallback, failCallback);
			} else { // use WebRTC datachannels
				rtcRequest(currentCluster, storeCallback, failCallback);
			}
		};

		// WebRTC
		var isWebRTCCapable = util.supports.data;
		var dataConnections = [];
		var pendingDataConnections = [];

		// connects to peers
		var rtcConnectionManager = function() {
			var peer = new Peer(undefined, {host: peerjsHost, port: peerjsPort, path: videoPath});
			peer.listAllPeers(function(peers) {
				for(var i = 0; i < peers.length && i < dataConnectionCnt; i++) {
					var dataConnection = peer.connect(peers[i]);
					// TODO: error handling
					dataConnections.push(dataConnection);
				}
			});
			peer.on('connection', function(dataConnection) {
				dataConnection.on('data', function(data) {
					if(data.method == 'getCluster') {
						dataConnection.send(clusters[data.cluster]);
					} else {
						// unknown method
						dataConnection.close();
					}
				});
			});
		};

		// make request to next peer
		var rtcRequest = function(currentCluster, storeCallback, failCallback) {
			if(!dataConnections.length && !pendingDataConnections.length) {
				xhrRequest(currentCluster, storeCallback, failCallback);
			} else if (!dataConnections.length && pendingDataConnections.length) {
				console.debug('waiting for current RTCRequest to finish');
				console.debug('pendingRtcRequests = ' + pendingDataConnections.length);
				failCallback(currentCluster);
			} else {
				console.info('using WebRTC for cluster ' + currentCluster);

				// remove this dataConnection while pending
				var dataConnection = dataConnections.shift();
				pendingDataConnections.push(dataConnection);

				dataConnection.removeAllListeners('data');
				dataConnection.removeAllListeners('close');

				var rtcRequestTimeout = setTimeout(function() {
					// slow peer, disconnect
					console.warn('peer timeout!');
					dataConnection.close();
					pendingDataConnections.splice(pendingDataConnections.indexOf(dataConnection), 1);
					failCallback(currentCluster);
				}, clusterTimeout * 1000);
				dataConnection.once('data', function(data) {
					pendingDataConnections.splice(pendingDataConnections.indexOf(dataConnection), 1);
					if(data) {
						// good peer, push it back to dataConnections array
						clearTimeout(rtcRequestTimeout);
						if(dataConnections.indexOf(dataConnection) === -1)
							dataConnections.push(dataConnection);
						rtcStoreClusterCallback(currentCluster, data, storeCallback);
					} else {
						// didn't have wanted piece, probably won't have next pieces either;
						// disconnect from peer and forget about it
						// TODO: this may be a little too harsh
						clearTimeout(rtcRequestTimeout);
						dataConnection.close();
						failCallback(currentCluster);
					}
				});

				dataConnection.once('close', function() {
					console.warn('peer closed!');
					clearTimeout(rtcRequestTimeout);
					dataConnection.close();
					pendingDataConnections.splice(pendingDataConnections.indexOf(dataConnection), 1);
					failCallback(currentCluster);
				});

				dataConnection.send({
					method: 'getCluster',
					cluster: currentCluster
				});
			}
		};

		// XHR
		var xhrRequest = function(currentCluster, storeCallback, failCallback) {
			console.info('using XHR for cluster ' + currentCluster);

			var xhr = new XMLHttpRequest();
			xhr.open('GET', videoPath + '.webm', true);
			xhr.responseType = 'arraybuffer';
			xhr.timeout = clusterTimeout * 1000;

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
						rtcStoreClusterCallback(currentCluster, new Uint8Array(xhr.response), storeCallback);
					else {
						failCallback(currentCluster);
					}
				}
			};
		};

		init();
	});
};

// video element and prefix of video (.webm) and video metadata (.webm.json)
rtcVideoPlayer(document.querySelector('video'), '/output', 'fruitiex.org', 9000);
