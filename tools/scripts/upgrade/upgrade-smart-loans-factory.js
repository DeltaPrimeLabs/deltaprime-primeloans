const FACTORY_TUP = require("../../../build/contracts/SmartLoansFactoryTUP.json");
const {upgradeProxy} = require("./upgrade-proxy");


module.exports.upgradeSmartLoansFactory = function upgradeSmartLoansFactory(networkName, address) {
    upgradeProxy(networkName, address, FACTORY_TUP, "SmartLoansFactory").then(
        res => console.log(res),
        err => console.error(err)
    )
}

