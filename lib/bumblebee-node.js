const EventEmitter = require('events');
const AudioRecorder = require(`node-audiorecorder`);
const PorcupineModule = require(`./pv_porcupine`);
global.PorcupineModule = PorcupineModule;
const Porcupine = require(`./porcupine`);
const pcmConvert = require('pcm-convert');
const transcoder = require('./transcoder');

const defaultHotwrds = {
	bumblebee: require('../hotwords/bumblebee'),
	grasshopper: require('../hotwords/grasshopper'),
	hey_edison: require('../hotwords/hey_edison'),
	porcupine: require('../hotwords/porcupine'),
	terminator: require('../hotwords/terminator')
};

class BumblebeeNode extends EventEmitter {
	constructor() {
		super();
		
		this.enabled = true;
		this.sensitivity = 0;
		this.hotwords = {};
		this.inputBuffer = [];
	}
	
	setEnabled(enabled) {
		this.enabled = enabled;
	}
	
	setHotword(hotword) {
		this.hotword = hotword;
	}
	
	addHotword(name, data, sensitivity) {
		if (!data) {
			if (name in defaultHotwrds) {
				data = defaultHotwrds[name];
			}
		}
		if (data) {
			this.hotwords[name] = {
				data,
				sensitivity: sensitivity || this.sensitivity
			};
		}
		else throw new Error('no hotword data');
	}
	
	setSensitivity(sensitivity) {
		this.sensitivity = sensitivity;
		for (let name in this.hotwords) {
			this.hotwords[name].sensitivity = sensitivity;
		}
	}
	
	stop() {
		if (this.recorder) this.recorder.stop();
		this.recording = false;
		this.emit('stop');
	}
	
	connect() {
		if (!this.connected) {
			if (Porcupine.isLoaded()) {
				this.connected = true;
				this.emit('connect');
			}
			else {
				Porcupine.loader.once('ready', () => {
					this.connected = true;
					this.emit('connect');
				});
			}
		}
	}
	
	disconnect() {
		this.connected = false;
		this.emit('disconnect');
	}
	
	destroy() {
		this.stop();
		this.disconnect();
	}
	
	// start(stream, sampleRate) {
	start(options) {
		if (this.recording) {
			console.log('already started');
			return;
		}
		if (this.connected) {
			this._start(options);
		}
		else {
			this.once('connect',() => {
				this._start(options);
			});
			this.connect();
		}
	}
	
	initPorcupine() {
		let keywordIDs = {};
		let sensitivities = [];
		this.keywordIndex = [];
		
		for (let id in this.hotwords) {
			// if (!this.hotword || id === this.hotword) {  // if the hotword is set, only add that data file to porcupine
				let h = this.hotwords[id];
				keywordIDs[id] = h.data;
				this.keywordIndex[sensitivities.length] = id;
				sensitivities.push(h.sensitivity);
			// }
		}
		
		let keywordIDArray = Object.values(keywordIDs);
		// console.log('initPorcupine', keywordIDArray, sensitivities)
		if (sensitivities.length) {
			this.porcupine = Porcupine.create(keywordIDArray, sensitivities);
		}
	}
	
	_start(options) {
		if (!options) options = {
			record: true
		}
		
		if (this.recording) return;
		this.recording = true;
		
		this.initPorcupine();
		
		let stream;
		let sampleRate = 16000;
		
		if (options.record) {
			this.recorder = new AudioRecorder({
				program: process.platform === 'win32' ? 'sox' : 'rec',
				silence: 0
			});
			this.recorder.start();
			stream = this.recorder.stream();
		}
		else if (options.stream) {
			stream = options.stream;
		}
		
		if (options.sampleRate) {
			sampleRate = options.sampleRate;
		}
		
		if (stream) {
			stream.on(`error`, () => {
				console.log('Recording error.');
			});
			
			stream.on('data', (data) => {
				if (this.muted) {
					// muted just ignores the incoming audio data but keeps the stream open
					this.emit('muted');
					return;
				}
				
				// records as int16, convert back to float for porcupine
				let float32arr = pcmConvert(data, 'int16 mono le', 'float32');
				this.processAudio(float32arr, sampleRate);
				this.emit('data', data, sampleRate);
			});
		}
		
		this.emit('start');
	}
	
	processAudio(inputFrame, inputSampleRate) {
		// console.log('processAudio', typeof inputFrame, inputSampleRate);
		
		for (let i = 0; i < inputFrame.length; i++) {
			this.inputBuffer.push((inputFrame[i]) * 32767);
		}
		
		const PV_SAMPLE_RATE = 16000;
		const PV_FRAME_LENGTH = 512;
		
		let hotwordDetected = null;
		
		while ((this.inputBuffer.length * PV_SAMPLE_RATE / inputSampleRate) > PV_FRAME_LENGTH) {
			let outputFrame = new Int16Array(PV_FRAME_LENGTH);
			let sum = 0;
			let num = 0;
			let outputIndex = 0;
			let inputIndex = 0;
			
			while (outputIndex < PV_FRAME_LENGTH) {
				sum = 0;
				num = 0;
				while (inputIndex < Math.min(this.inputBuffer.length, (outputIndex + 1) * inputSampleRate / PV_SAMPLE_RATE)) {
					sum += this.inputBuffer[inputIndex];
					num++;
					inputIndex++;
				}
				outputFrame[outputIndex] = sum / num;
				outputIndex++;
			}
			
			let r = this.processPorcupine(outputFrame);
			if (r) {
				hotwordDetected = r;
			}
			
			this.emit('int16le', outputFrame, PV_SAMPLE_RATE);
			
			this.inputBuffer = this.inputBuffer.slice(inputIndex);
		}
		
		return hotwordDetected;
	}
	
	/*processChunks(data) {
		let hotword;
		for (let i=0;i<data.length;i++) {
			let id = this.porcupine.process(data[i]);
			if (id > -1) {
				console.log('porcupine keyword found ', id);
				hotword = this.keywordIndex[id];
				break;
			}
		}
		return hotword;
	}*/
	
	processPorcupine(data) {
		if (this.porcupine) {
			let id = this.porcupine.process(data);
			if (id > -1) {
				let hotword = this.keywordIndex[id];
				if (!this.hotword || this.hotword === hotword) {
					this.emit('hotword', hotword);
					return hotword;
				}
			}
		}
	}
	
	setMuted(muted) {
		this.muted = muted;
	}
	
	transcode(data, sampleRate, callback) {
		// todo: move this to a worker thread
		const outputRate = 16000;
		let result = transcoder(this, data, sampleRate, outputRate, 512);
		callback(result.deepspeech, result.vad, outputRate, result.hotword);
	}
}

module.exports = BumblebeeNode;
