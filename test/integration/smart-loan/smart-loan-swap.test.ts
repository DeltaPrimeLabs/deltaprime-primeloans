import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    extractAssetNameBalances,
    extractAssetNamePrices,
    formatUnits,
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
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan without debt', () => {
        let exchange: PangolinIntermediary,
            smartLoansFactory: SmartLoansFactory,
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

        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'ETH', 'MCKUSD', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'MCKUSD', airdropList: [owner, depositor]}
            ];

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
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

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
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
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.1);

            await tokenContracts.get('MCKUSD')!.connect(owner).approve(wrappedLoan.address, parseUnits("1000", await tokenContracts.get('MCKUSD')!.decimals()));
            await wrappedLoan.fund(toBytes32("MCKUSD"), parseUnits("1000", await tokenContracts.get('MCKUSD')!.decimals()));
            expect(formatUnits(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address), await tokenContracts.get('MCKUSD')!.decimals())).to.be.closeTo(1000, 0.1);

            tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("1000")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("1000"));

            expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.1);

            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100, 0.1);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(tokensPrices.get('AVAX')! * 100 + 1000, 2);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
        });

        it("should withdraw part of funds", async () => {
            expect(formatUnits(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address), await tokenContracts.get('MCKUSD')!.decimals())).to.be.closeTo(1000, 0.1);

            await wrappedLoan.withdraw(toBytes32("MCKUSD"), parseUnits("100", await tokenContracts.get('MCKUSD')!.decimals()));

            expect(formatUnits(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address), await tokenContracts.get('MCKUSD')!.decimals())).to.be.closeTo(900, 0.1);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(tokensPrices.get('AVAX')! * 100 + 900, 2);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
        });


        it("should fail to swap from a non-owner account", async () => {
            let nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            await expect(nonOwnerWrappedLoan.swapPangolin(
                toBytes32('AVAX'), toBytes32('ETH'), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should buy an asset from funded", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(tokensPrices.get('AVAX')! * 100 + 900, 2);
            const expectedEthAmount = 1;

            const slippageTolerance = 0.03;
            const requiredAvaxAmount = tokensPrices.get('ETH')! * expectedEthAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;

            expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100, 0.1);

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('ETH'),
                toWei(requiredAvaxAmount.toString()),
                toWei(expectedEthAmount.toString())
            )

            let assetsNameBalance: any = await extractAssetNameBalances(wrappedLoan);

            expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100 - requiredAvaxAmount, 0.1);
            expect(fromWei(assetsNameBalance["AVAX"])).to.be.closeTo(100 - requiredAvaxAmount, 0.05);

            expect(fromWei(await tokenContracts.get('ETH')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(1, 0.05);
            expect(fromWei(assetsNameBalance["ETH"])).to.be.closeTo(1, 0.05);

            // total value should stay similar to before swap
            // big delta of 80 because of slippage
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(tokensPrices.get('AVAX')! * 100 + 900, 80);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
        });

        it("should revert when Avax price returned from oracle is zero", async () => {
            let wrappedLoanWithoutPrices = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: [],
                });
            await expect(wrappedLoanWithoutPrices.getTotalValue()).to.be.revertedWith("CalldataOverOrUnderFlow()");
        });

        it("should provide assets balances and prices", async () => {
            let assetsNameBalance: any = await extractAssetNameBalances(wrappedLoan);
            let assetsNamePrices: any = await extractAssetNamePrices(wrappedLoan);

            expect(formatUnits(assetsNameBalance["MCKUSD"], await tokenContracts.get('MCKUSD')!.decimals())).to.be.equal(900);
            expect(formatUnits(assetsNamePrices["MCKUSD"], BigNumber.from(8))).to.be.closeTo(tokensPrices.get('MCKUSD')!, 0.001);
        });


        it("should update valuation after price change", async () => {
            let totalValueBeforePriceChange = fromWei(await wrappedLoan.getTotalValue());

            let UPDATED_MOCK_PRICES = MOCK_PRICES.map(
                (token: any) => {
                    if (token.dataFeedId == 'MCKUSD') {
                        token.value = 2 * tokensPrices.get('MCKUSD')!;
                    }
                    return token;
                }
            );

            let updatedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: UPDATED_MOCK_PRICES,
                });

            // 900 is the balance of USD, so the change is current_value = previous_value: (2 * 900) - (1 * 900)
            expect(fromWei(await updatedLoan.getTotalValue())).to.closeTo(totalValueBeforePriceChange + 900, 3);
            expect(fromWei(await updatedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await updatedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
        });


        it("should swap back", async () => {
            const initialEthTokenBalance = (await extractAssetNameBalances(wrappedLoan))["ETH"];

            const slippageTolerance = 0.1;

            const avaxAmount = tokensPrices.get('ETH')! * fromWei(initialEthTokenBalance) * (1 - slippageTolerance) / tokensPrices.get('AVAX')!;

            await wrappedLoan.swapPangolin(
                toBytes32('ETH'),
                toBytes32('AVAX'),
                initialEthTokenBalance,
                toWei(avaxAmount.toString())
            );

            const currentEthTokenBalance = (await extractAssetNameBalances(wrappedLoan))["ETH"];

            expect(currentEthTokenBalance).to.be.equal(0);

            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
        });
    });
});

