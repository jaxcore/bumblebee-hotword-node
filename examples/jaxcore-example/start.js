const Jaxcore = require('jaxcore');
const jaxcore = new Jaxcore();

// add bumblebee-hotword-node plugin
jaxcore.addPlugin(require('../../'));

class BumbleBeeNodeConsoleAdapter extends Jaxcore.Adapter {
	constructor(store, config, theme, devices, services) {
		super(store, config, theme, devices, services);
		
		const {bumblebeeNode} = services;
		
		// bumblebeeNode.setHotword('grasshopper');
		
		this.addEvents(bumblebeeNode, {
			hotword: function(hotword) {
				console.log('\n[hotword detected:', hotword, ']');
			},
			data: function (data) {
				process.stdout.write('.');
			}
		});
		
		bumblebeeNode.start();
	}
	
	static getServicesConfig(adapterConfig) {
		console.log('getServicesConfig', adapterConfig);
		return {
			bumblebeeNode: true
		};
	}
}

jaxcore.addAdapter('bumblebee-console', BumbleBeeNodeConsoleAdapter);

jaxcore.defineAdapter('BumbleBeeNode Console', {
	adapterType: 'bumblebee-console',
	// deviceType: 'speech',
	services: {
		bumblebeeNode: true
	}
});

jaxcore.connectAdapter(null, 'BumbleBeeNode Console');
