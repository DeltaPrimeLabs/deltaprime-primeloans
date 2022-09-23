import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployPools,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    RedstoneConfigManager__factory,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe('A loan with debt and repayment', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, wrapped native token pool and USD pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'ETH', 'MCKUSD'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'MCKUSD', airdropList: [owner, depositor]}
            ];
            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

            await deployPools(poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'MCKUSD'), getRedstonePrices, [{symbol: 'MCKUSD', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, {MCKUSD: tokenContracts.get('MCKUSD')!.address});
            addMissingTokenContracts(tokenContracts, assetsList);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress)
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })
        });


        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);

            await tokenContracts.get('MCKUSD')!.connect(owner).approve(wrappedLoan.address, toWei("1000"));
            await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("300"));

            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(300, 0.5);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);
        });

        it("should fail to borrow funds as a non-owner", async () => {
            let nonOwnerWrappedLoan = WrapperBuilder
                .mockLite(loan.connect(depositor))
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })
            await expect(nonOwnerWrappedLoan.borrow(toBytes32("MCKUSD"), toWei("300"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });


        it("should borrow funds in the same token as funded", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("300"));
            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(600);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(300 + 300, 1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300, 0.5);
            expect(await wrappedLoan.getLTV()).to.be.equal(1000);
        });

        it("should borrow funds in a different token than funded", async () => {
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(1);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(600 + tokensPrices.get('AVAX')! * 1, 1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 + tokensPrices.get('AVAX')! * 1, 1);
            expect(await wrappedLoan.getLTV()).to.be.closeTo(((300 + tokensPrices.get('AVAX')!) * 1000 / 300).toFixed(0), 1)
        });

        it("should fail to repay funds as a non-owner", async () => {
            let nonOwnerWrappedLoan = WrapperBuilder
                .mockLite(loan.connect(depositor))
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })
            await expect(nonOwnerWrappedLoan.repay(toBytes32("MCKUSD"), toWei("300"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should repay funds", async () => {
            await wrappedLoan.repay(toBytes32("MCKUSD"), toWei("100"));
            await wrappedLoan.repay(toBytes32("AVAX"), toWei("0.5"));

            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(500);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(500 + tokensPrices.get('AVAX')! * 0.5, 1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(200 + tokensPrices.get('AVAX')! * 0.5, 1);
            expect(await wrappedLoan.getLTV()).to.be.closeTo(((200 + tokensPrices.get('AVAX')! * 0.5) * 1000 / 300).toFixed(0), 1)
        });


        it("should prevent borrowing too much", async () => {
            await expect(wrappedLoan.borrow(toBytes32("AVAX"), toWei("900"))).to.be.revertedWith("The action may cause an account to become insolvent");
            expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(0.5);
        });

        it("should repay the debt when specified too much", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("0.1")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("0.1"));

            await wrappedLoan.fund(toBytes32("AVAX"), toWei("0.1"));
            await wrappedLoan.repay(toBytes32("AVAX"), toWei("0.6"));

            expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0.1, 0.000001);
        });
    });
});

