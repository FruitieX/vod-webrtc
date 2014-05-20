var file;
var chunkSize = 1024 * 64;
var chunkBufferSize = 10; // how many chunks are fetched concurrently
var bufMaxSeconds = 10; // try to keep at least this many seconds buffered

var video = document.querySelector('video');

var readFile = function(currentChunk, storeCallback, failCallback) {
	var reader = new FileReader();
	reader.onload = function(e) {
		storeCallback(currentChunk, new Uint8Array(e.target.result));
		//sb.appendBuffer(new Uint8Array(e.target.result));
	};
	reader.onerror = function(e) {
		failCallback(currentChunk);
	};

	var blob = file.slice(currentChunk * chunkSize, (currentChunk + 1) * chunkSize);

	// asynchronously append to sourcebuffer
	reader.readAsArrayBuffer(blob);

	// signal caller that the entire file has been read
	if((currentChunk + 1) * chunkSize >= file.size) {
		console.log("EOF");
		return true;
	}
	return false;
}

$("#fileSelector").change(function(e) {
	file = e.target.files[0];
	var cnt = Math.ceil(file.size / chunkSize);
	chunkedVideo(video, readFile, cnt, chunkBufferSize, bufMaxSeconds);
});

