const PorcupineModule = require(`./pv_porcupine`);
global.PorcupineModule = PorcupineModule;

const Porcupine = require(`./porcupine`);

const defaultHotwords = {
	alexa: require('./hotwords/alexa'),
	computer: require('./hotwords/computer'),
	bumblebee: require('./hotwords/bumblebee'),
	grasshopper: require('./hotwords/grasshopper'),
	hey_edison: require('./hotwords/hey_edison'),
	hey_google: require('./hotwords/hey_google'),
	hey_siri: require('./hotwords/hey_siri'),
	jarvis: require('./hotwords/jarvis'),
	porcupine: require('./hotwords/porcupine'),
	terminator: require('./hotwords/terminator')
};

module.exports = Porcupine;
module.exports.defaultHotwords = defaultHotwords;
