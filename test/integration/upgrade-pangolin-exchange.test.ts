import {Asset, deployAndInitPangolinExchangeContract, syncTime, toBytes32} from "../_helpers";
import {
    MockUpgradedPangolinExchange,
    MockUpgradedPangolinExchange__factory,
    PangolinExchange, PangolinExchange__factory, TransparentUpgradeableProxy,
    TransparentUpgradeableProxy__factory,
} from "../../typechain";
import MockPangolinExchangeArtifact from '../../artifacts/contracts/mock/MockUpgradedPangolinExchange.sol/MockUpgradedPangolinExchange.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import chai, {expect} from "chai";
import {solidity} from "ethereum-waffle";
import {ethers} from "hardhat";
import {getFixedGasSigners} from "../_helpers";

chai.use(solidity);

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';

describe('Pangolin Exchange - upgrading',  () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Check basic logic before and after upgrade', () => {
        let exchange: PangolinExchange,
            owner: SignerWithAddress,
            admin: SignerWithAddress,
            supportedAssets: any,
            proxy: TransparentUpgradeableProxy;
        before("should deploy provider, exchange, loansFactory and pool", async () => {
            [owner, admin] = await getFixedGasSigners(100000000);
            exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [new Asset(toBytes32('USD'), usdTokenAddress)]);

            proxy = await (new TransparentUpgradeableProxy__factory(owner).deploy(exchange.address, admin.address, []));
            exchange = await (new PangolinExchange__factory(owner).attach(proxy.address));

            await exchange.connect(owner).initialize(pangolinRouterAddress, [new Asset(toBytes32('USD'), usdTokenAddress)]);

            supportedAssets = await exchange.getAllAssets();
        });

        it("should not allow to upgrade from non-admin", async () => {
            const exchangeV2 = await (new MockUpgradedPangolinExchange__factory(owner).deploy());

            await expect(proxy.connect(owner).upgradeTo(exchangeV2.address))
                .to.be.revertedWith("Transaction reverted: function selector was not recognized and there's no fallback function");
        });


        // it("should upgrade", async () => {
        //     const exchangeV2 = await (new MockUpgradedPangolinExchange__factory(owner).deploy());
        //
        //     await proxy.connect(admin).upgradeTo(exchangeV2.address);
        //
        //     let exchangeUpgraded = (await new ethers.Contract(exchange.address, MockPangolinExchangeArtifact.abi)) as MockUpgradedPangolinExchange;
        //
        //     // The mock exchange has a hardcoded return value of 1337
        //     expect(await exchangeUpgraded.connect(owner).newMockedFunction()).to.be.equal(1337);
        //     // The contract's supported assets should remain unchanged
        //     expect(await exchange.getAllAssets()).to.be.deep.equal(supportedAssets);
        // });
    });
});