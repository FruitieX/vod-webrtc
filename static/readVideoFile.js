var clusterConcurrency = 10; // how many clusters are fetched concurrently
var bufMinSeconds = 10; // try to keep at least this many seconds buffered
var url = 'http://localhost/output.webm';
var url_clusters = 'http://localhost/output.webm.json';
var videoElement = document.querySelector('video');

$.ajax(url_clusters).done(function(data) {
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

	var videoMetadata = JSON.parse(data);
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

		// cluster -1 contains all data before the first webm cluster
		if(currentCluster === -1) {
			xhr.setRequestHeader('Range', 'bytes=0-' + getClusterEnd(-1));
		} else {
			xhr.setRequestHeader('Range', 'bytes=' +
					videoMetadata['clusters'][currentCluster].offset + '-' +
					getClusterEnd(currentCluster));
		}

		/*
		console.log('getting range: ' +
			videoMetadata['clusters'][currentCluster].offset + '-' +
			getClusterEnd(currentCluster));
			*/
		xhr.send();

		xhr.onload = function(e) {
			if (xhr.status != 206 && xhr.status != 200) {
				alert("Unexpected status code " + xhr.status + " for " + url);
				failCallback(currentCluster);
			} else {
				storeCallback(currentCluster, new Uint8Array(xhr.response));
			}
		};
	}

	// enable the start button
	$("#startButton").removeAttr("disabled");
	$("#startButton").click(function(e) {
		clusteredVideo(xhrRequest, videoElement, videoMetadata, clusterConcurrency, bufMinSeconds);
	});
});

