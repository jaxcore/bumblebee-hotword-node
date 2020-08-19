const ffmpeg = require('fluent-ffmpeg');
const Bumblebee = require('../../');
const fs = require('fs');

function processWav(file) {
	const bumblebee = new Bumblebee();
	bumblebee.addHotword('bumblebee');
	
	var inputStream = fs.createReadStream(file);
	
	const transcodedStream = new ffmpeg().input(inputStream)
	.inputOptions(['-f s16le', '-ac 2', '-ar 44100'])
	.outputOptions(['-ac 1', '-ar 16000']).format('s16le').pipe({end: false});
	
	let didDetectHotword = false;
	
	inputStream.on('end', function() {
		// the stream ends before porcupine finishes, so add a timeout
		setTimeout(function() {
			if (!didDetectHotword) {
				console.log(file,' = NO');
			}
		}, 500);
	})
	
	bumblebee.once('hotword', hotword => {
		console.log(file,' = YES');
		didDetectHotword = true;
	});
	
	bumblebee.start({stream: transcodedStream});
}

processWav('123.wav'); // should say NO
processWav('123-bumblebee.wav'); // should say YES