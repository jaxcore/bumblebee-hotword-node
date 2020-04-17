const EventEmitter = require('events');
const AudioRecorder = require(`node-audiorecorder`);
const PorcupineModule = require(`./pv_porcupine`);
global.PorcupineModule = PorcupineModule;
const Porcupine = require(`./porcupine`);
const pcmConvert = require('pcm-convert');

const defaultHotwrds = {
	bumblebee: require('../hotwords/bumblebee'),
	grasshopper: require('../hotwords/grasshopper'),
	hey_edison: require('../hotwords/hey_edison'),
	porcupine: require('../hotwords/porcupine'),
	// terminator: require('../hotwords/terminator') // terminator doesnt seem to work, it gets triggered every 3 seconds
};

class BumblebeeNode extends EventEmitter {
	constructor() {
		super();
		
		this.sensitivity = 0.5;
		this.hotwords = {};
		this.inputBuffer = [];
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
	
	start(stream, sampleRate) {
		if (this.recording) {
			console.log('already started');
			return;
		}
		if (this.connected) {
			this._start(stream, sampleRate);
		}
		else {
			this.once('connect',() => {
				this._start(stream, sampleRate);
			});
			this.connect();
		}
	}
	
	_start(stream, sampleRate) {
		if (this.recording) return;
		this.recording = true;
		
		let keywordIDs = {};
		let sensitivities = [];
		this.keywordIndex = [];
		
		
		for (let id in this.hotwords) {
			
			let h = this.hotwords[id];
			keywordIDs[id] = h.data;
			this.keywordIndex[sensitivities.length] = id;
			sensitivities.push(h.sensitivity);
		}
		
		let keywordIDArray = Object.values(keywordIDs);
		
		this.porcupine = Porcupine.create(keywordIDArray, sensitivities);

		if (!stream) {
			this.recorder = new AudioRecorder({
				program: process.platform === 'win32' ? 'sox' : 'rec',
				silence: 0
			});
			this.recorder.start();
			stream = this.recorder.stream();
		}
		if (!sampleRate) {
			sampleRate = 16000;
		}

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
		
		this.emit('start');
	}
	
	processAudio(inputFrame, inputSampleRate) {

		for (let i = 0; i < inputFrame.length; i++) {
			this.inputBuffer.push((inputFrame[i]) * 32767);
		}
		
		const PV_SAMPLE_RATE = 16000;
		const PV_FRAME_LENGTH = 512;
		
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
			
			this.processPorcupine(outputFrame);
			this.inputBuffer = this.inputBuffer.slice(inputIndex);
		}
	}
	
	processPorcupine(data) {
		let id = this.porcupine.process(data);
		if (id > -1) {
			let hotword = this.keywordIndex[id];
			if (!this.hotword || this.hotword === hotword) {
				this.emit('hotword',hotword);
			}
		}
	}
	
	setMuted(muted) {
		this.muted = muted;
	}
	
}

module.exports = BumblebeeNode;
