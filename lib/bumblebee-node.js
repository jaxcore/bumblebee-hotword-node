const EventEmitter = require('events');
const AudioRecorder = require(`./node-audiorecorder`);
const pcmConvert = require('pcm-convert');
const Porcupine = require('./porcupine-v1.8');

class BumblebeeNode extends EventEmitter {
	constructor(options) {
		super();
		this.sensitivity = 0;
		this.hotwords = {};
		this.inputBuffer = [];
		this.options = options;
	}
	
	setHotword(hotword) {
		this.hotword = hotword;
	}
	
	addHotword(name, data, sensitivity) {
		if (!data) {
			if (name in Porcupine.defaultHotwords) {
				data = Porcupine.defaultHotwords[name];
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
			let h = this.hotwords[id];
			keywordIDs[id] = h.data;
			this.keywordIndex[sensitivities.length] = id;
			sensitivities.push(h.sensitivity);
		}
		let keywordIDArray = Object.values(keywordIDs);
		if (sensitivities.length) {
			this.porcupine = Porcupine.create(keywordIDArray, sensitivities);
		}
	}
	
	_start(options) {
		if (!options) options = {};
		if (this.recording) return;
		this.recording = true;
		
		this.initPorcupine();
		
		let stream;
		let sampleRate = 16000;
		
		if (options.stream) {
			stream = options.stream;
		}
		else {
			if (options.record || !('record' in options)) {
				let program;
				if (this.options && this.options.program) {
					program = this.options.program;
				}
				else program = (process.platform === 'darwin' || process.platform === 'linux') ? 'rec' : 'sox'
				let device;
				if (this.options && this.options.device) {
					device = this.options.device;
				}
				this.recorder = new AudioRecorder({
					device,
					program,
					silence: 0,
					paths: this.options? this.options.paths : null
				});
				this.recorder.start();
				stream = this.recorder.stream();
				
			}
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
				let hotword = this.processAudio(float32arr, sampleRate);
				
				// emit the float32arr so it does not have to be converted again elsewhere
				this.emit('data', data, sampleRate, hotword, float32arr);
			});
		}
		
		this.emit('start');
	}
	
	processAudio(inputFrame, inputSampleRate) {
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
			this.inputBuffer = this.inputBuffer.slice(inputIndex);
		}
		
		if (hotwordDetected && !this.hotword || this.hotword === hotwordDetected) {
			this.emit('hotword', hotwordDetected);
		}
		
		return hotwordDetected;
	}
	
	processPorcupine(data) {
		if (this.porcupine) {
			let id = this.porcupine.process(data);
			if (id > -1) {
				return this.keywordIndex[id];
			}
		}
	}
	
	setMuted(muted) {
		this.muted = muted;
	}
}

module.exports = BumblebeeNode;
