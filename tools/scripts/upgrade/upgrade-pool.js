const POOL_TUP = require("../../../build/contracts/PoolTUP.json");
const {upgradeProxy} = require("./upgrade-proxy");


module.exports.upgradeSmartLoansFactory = function upgradeSmartLoansFactory(networkName, address) {
    upgradeProxy(networkName, address, POOL_TUP, "Pool").then(
        res => console.log(res),
        err => console.error(err)
    )
}

