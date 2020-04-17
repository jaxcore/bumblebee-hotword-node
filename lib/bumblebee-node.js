const Jaxcore = require('jaxcore');
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

const schema = {
	id: {
		type: 'string',
		defaultValue: 'speech'
	},
	connected: {
		type: 'boolean',
		defaultValue: false
	},
	hotword: {
		type: 'string',
		defaultValue: null
	},
	hotwords: {
		type: 'array'
	},
	sensitivity: {
		type: 'number',
		defaultValue: 0.5
	},
	recording: {
		type: 'boolean',
		defaultValue: false
	},
	muted: {
		type: 'boolean',
		defaultValue: false
	}
};

let bumblebeeInstance;

class BumblebeeNode extends Jaxcore.Service {
	constructor(defaults, store) {
		if (!store) store = Jaxcore.createServiceStore('bumblebeeNode');
		super(schema, store, defaults);
		
		this.hotwords = {};
		
		if (defaults && defaults.hotwords) {
			defaults.hotwords.forEach((hotword) => {
				this.addHotword(hotword);
			});
		}
		else {
			Object.keys(defaultHotwrds).forEach((hotword) => {
				this.addHotword(hotword);
			});
		}
		
		this.log = Jaxcore.createLogger('bumblebeeNode');
		this.log('create', defaults);
		
		this.serviceType = 'bumblebeeNode';
		this.inputBuffer = [];
	}
	
	setHotword(hotword) {
		this.setState({
			hotword
		});
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
				sensitivity: sensitivity || this.state.sensitivity
			};
			this.setState({
				hotwords: Object.keys(this.hotwords)
			});
		}
		else throw new Error('no hotword data');
	}
	
	setSensitivity(sensitivity) {
		this.setState({sensitivity});
		for (let name in this.hotwords) {
			this.hotwords[name].sensitivity = sensitivity;
		}
	}
	
	stop() {
		if (this.recorder) this.recorder.stop();
		this.setState({recording: false});
		this.emit('stop');
	}
	
	connect() {
		if (!this.state.connected) {
			if (Porcupine.isLoaded()) {
				this.setState({connected: true});
				this.emit('connect');
			}
			else {
				Porcupine.loader.once('ready', () => {
					this.setState({connected: true});
					this.emit('connect');
				});
			}
		}
	}
	
	disconnect() {
		this.setState({
			connected: false
		});
		this.emit('disconnect');
	}
	
	destroy() {
		this.stop();
		this.disconnect();
	}
	
	start(stream, sampleRate) {
		if (this.state.recording) {
			this.log('already started');
			return;
		}
		if (this.state.connected) {
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
		if (this.state.recording) return;
		this.setState({recording: true});
		
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
			if (this.state.muted) {
				// muted just ignores the incoming audio data but keeps the stream open
				this.emit('muted');
				return;
			}
			
			// records as int16, convert back to float for porcupine
			let float32arr = pcmConvert(data, 'int16 mono le', 'float32');
			this.processAudio(float32arr, sampleRate);
			this.emit('data', data, 16000);
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
			if (!this.state.hotword || this.state.hotword === hotword) {
				this.emit('hotword',hotword);
			}
		}
	}
	
	setMuted(muted) {
		this.setState({muted});
	}
	
	static id() {
		return 'bumblebeeNode';
	}
	
	static getOrCreateInstance(serviceStore, serviceId, serviceConfig, callback) {
		if (bumblebeeInstance) {
			callback(null, bumblebeeInstance, false);
		}
		else {
			bumblebeeInstance = new BumblebeeNode({
				id: serviceId,
				sensitivity: serviceConfig.sensitivity,
				hotword: serviceConfig.hotword,
				hotwords: serviceConfig.hotwords
			}, serviceStore);
			
			// bumblebeeInstance.connect();
			
			callback(null, bumblebeeInstance, true);
		}
	}
}

module.exports = BumblebeeNode;
