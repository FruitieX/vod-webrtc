var clusterConcurrency = 10; // how many clusters are fetched concurrently
var bufMinSeconds = 10; // try to keep at least this many seconds buffered
var url = '/output.webm';
var url_clusters = '/output.webm.json';
var videoElement = document.querySelector('video');

$.getJSON(url_clusters, function(videoMetadata) {
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

	var getClusterEnd = function(currentCluster) {
		if(currentCluster < videoMetadata['clusters'].length - 1) {
			return videoMetadata['clusters'][currentCluster + 1].offset - 1;
		} else {
			return videoMetadata['total_size'];
		}
	};

	var xhrRequest = function(currentCluster, storeCallback, failCallback) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
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
	}

	// enable the start button
	$("#startButton").removeAttr("disabled");
	$("#startButton").click(function(e) {
		clusteredVideo(xhrRequest, videoElement, videoMetadata, clusterConcurrency, bufMinSeconds);
	});
});
