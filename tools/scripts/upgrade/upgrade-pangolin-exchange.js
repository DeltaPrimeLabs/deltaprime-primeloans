const {upgradeProxy} = require("./upgrade-proxy");


module.exports.upgradePangolinExchange = function upgradePangolinExchange(networkName, contractName) {
    const FACTORY_TUP = require(`../../../deployments/${networkName}/PangolinExchangeTUP.json`);

    upgradeProxy(networkName, contractName, FACTORY_TUP, "PangolinExchange").then(
        res => console.log(res),
        err => console.error(err)
    )
}

