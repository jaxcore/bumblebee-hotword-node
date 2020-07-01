const PorcupineModule = require(`./pv_porcupine`);
global.PorcupineModule = PorcupineModule;

const Porcupine = require(`./porcupine`);

const defaultHotwords = {
	bumblebee: require('./hotwords/bumblebee'),
	grasshopper: require('./hotwords/grasshopper'),
	hey_edison: require('./hotwords/hey_edison'),
	porcupine: require('./hotwords/porcupine'),
	terminator: require('./hotwords/terminator'),
	blueberry: require('./hotwords/blueberry'),
	white_smoke: require('./hotwords/white_smoke')
};

module.exports = Porcupine;
module.exports.defaultHotwords = defaultHotwords;
