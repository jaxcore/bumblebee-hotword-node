const BumbleBeeNode = require('./lib/bumblebee-node');

module.exports = BumbleBeeNode;

module.exports.services = {
	bumblebeeNode: {
		service: BumbleBeeNode,
		storeType: 'service'
	}
};
