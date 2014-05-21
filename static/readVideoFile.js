var byteSize = 623568;
var chunkSize = 1024 * 64;
var chunkBufferSize = 10; // how many chunks are fetched concurrently
var bufMaxSeconds = 10; // try to keep at least this many seconds buffered

var video = document.querySelector('video');

var readFile = function(currentChunk, storeCallback, failCallback) {
	var url = 'http://fruitiex.org/files/misc/output.webm';
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'arraybuffer';
	xhr.setRequestHeader('Range', 'bytes=' +
			(currentChunk * chunkSize) + '-' + ((currentChunk + 1) * chunkSize));
	xhr.send();
	console.log('xhr.send()');

	xhr.onload = function(e) {
		if (xhr.status != 200) {
			alert("Unexpected status code " + xhr.status + " for " + url);
			failCallback(currentChunk);
		} else {
			storeCallback(currentChunk, new Uint8Array(xhr.response));
		}
	};
}

$("#startButton").click(function(e) {
	var cnt = Math.ceil(byteSize / chunkSize);
	chunkedVideo(video, readFile, cnt, chunkBufferSize, bufMaxSeconds);
});

