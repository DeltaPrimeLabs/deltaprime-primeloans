import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, formatUnits,
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
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0x655C406EBFa14EE2006250925e54ec43AD184f8B';

const {deployContract, provider} = waffle;
describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Uniswap V3 operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            initialTv: any,
            initialHr: any,
            assetsList: [],
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            assetsList = ['AVAX', 'USDC', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

            tokensPrices = await getTokensPricesMap(
                assetsList,
                "avalanche",
                getRedstonePrices,
                []
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList.filter(asset => !Array.from(tokenContracts.keys()).includes(asset)));

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                ethers.constants.AddressZero,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            let exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary");

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
                addressProvider.address,
                ethers.constants.AddressZero,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await deployAllFacets(diamondAddress)
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan(ethers.constants.HashZero);
            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan, get USDC and borrow", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("3")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("3"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("3"));

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("12"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("6"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("ETH"), toWei("1"), 0);


            initialHr = fromWei(await wrappedLoan.getHealthRatio());
            initialTv = fromWei(await wrappedLoan.getTotalValue());
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(15 * tokensPrices.get('AVAX')!, 3);
        });

        it("should mint AVAX/USDC UniswapV3 liquidity for a narrow range (9-11$)", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits((10).toFixed(6), BigNumber.from('6'));

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    -254350,
                    -252340,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            );

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
        });

        it("should mint AVAX/USDC UniswapV3 liquidity for a wide range (5-15$)", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    -260240,
                    -249240,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            );

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
        });

        it("should mint AVAX/USDC UniswapV3 liquidity below market price", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    -260240,
                    -257460,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            );

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
        });

        it("should mint AVAX/USDC UniswapV3 liquidity below market price (extreme)", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    -500000,
                    -490000,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            );

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
        });

        it("should mint AVAX/USDC UniswapV3 liquidity above market price", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    -252340,
                    -249240,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            );

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
        });

        it("should mint AVAX/USDC UniswapV3 liquidity above market price (extreme)", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    -110000,
                    -100000,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            );

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
        });

        it("should mint AVAX/ETH UniswapV3 liquidity", async () => {
            const addedAvax = toWei('1');
            const addedEth = toWei('0.001');

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab",
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    500,
                    -228000,
                    -222000,
                    addedEth,
                    addedAvax,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            );

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
        });



        it("should increase AVAX/USDC UniswapV3 liquidity in the first position", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];
            const addedAvax = toWei('0.5');
            const addedUSDC = parseUnits('5', BigNumber.from('6'));

            const initialTv = fromWei(await wrappedLoan.getTotalValue());
            const initialHr = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.increaseLiquidityUniswapV3(
                [
                    id,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(7);
            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
        });

        it("should decrease AVAX/USDC UniswapV3 liquidity", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];

            const manager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER_ADDRESS, owner);

            const liquidityBefore = (await manager.positions(id)).liquidity;
            const decreasedLiquidity = liquidityBefore.div(3);

            await expect(wrappedLoan.decreaseLiquidityUniswapV3(
                [
                    id,
                    decreasedLiquidity,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            const liquidityAfter = (await manager.positions(id)).liquidity;

            expect((initialTv - tvAfter) / initialTv).to.be.below(0.00001);
            expect((initialHr - hrAfter) / initialHr).to.be.below(0.00001);
            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(7);
            expect(fromWei(liquidityAfter)).to.be.closeTo(fromWei(liquidityBefore) - fromWei(decreasedLiquidity), 0.0001);
        });

        it("should withdraw rest and burn UniswapV3 token", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];

            const manager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER_ADDRESS, owner);

            const liquidity = (await manager.positions(id)).liquidity;

            const initialTv = fromWei(await wrappedLoan.getTotalValue());
            const initialHr = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.decreaseLiquidityUniswapV3(
                [
                    id,
                    liquidity,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).not.to.be.reverted;

            const newLiquidity = (await manager.positions(id)).liquidity;

            expect(initialTv).to.be.closeTo(initialTv, 0.01);
            expect(initialHr).to.be.closeTo(initialHr, 0.01);
            expect(fromWei(newLiquidity)).to.be.equal(0);

            await expect(wrappedLoan.burnLiquidityUniswapV3(id)).not.to.be.reverted;
            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(6);
        });

        it("should not perform actions if price oracle price differs from Uniswap price", async () => {
            let addedAvax = toWei('1');
            let addedUSDC = parseUnits((10).toFixed(6), BigNumber.from('6'));

            let newAvaxPrice = tokensPrices.get("AVAX")! * 1.06;

            tokensPrices = await getTokensPricesMap(
                assetsList,
                "avalanche",
                getRedstonePrices,
                [
                    {symbol: 'AVAX', value: newAvaxPrice},
                ]
            );



            const NEW_MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);

            const newPricesWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: NEW_MOCK_PRICES,
                });

            await expect(newPricesWrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    -254350,
                    -252340,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            )).to.be.reverted;

            addedAvax = toWei('0.5');
            addedUSDC = parseUnits('5', BigNumber.from('6'));

            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];

            await expect(newPricesWrappedLoan.increaseLiquidityUniswapV3(
                [
                    id,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).to.be.reverted;

            const manager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER_ADDRESS, owner);

            const liquidityBefore = (await manager.positions(id)).liquidity;
            const decreasedLiquidity = liquidityBefore.div(3);

            await expect(newPricesWrappedLoan.decreaseLiquidityUniswapV3(
                [
                    id,
                    decreasedLiquidity,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).to.be.reverted;
        });

        it("should not perform actions if non-owner", async () => {
            let addedAvax = toWei('1');
            let addedUSDC = parseUnits((10).toFixed(6), BigNumber.from('6'));


            await expect(nonOwnerWrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    -254350,
                    -252340,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            )).to.be.reverted;

            addedAvax = toWei('0.5');
            addedUSDC = parseUnits('5', BigNumber.from('6'));

            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];

            await expect(nonOwnerWrappedLoan.increaseLiquidityUniswapV3(
                [
                    id,
                    addedAvax,
                    addedUSDC,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).to.be.reverted;

            const manager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER_ADDRESS, owner);

            const liquidityBefore = (await manager.positions(id)).liquidity;
            const decreasedLiquidity = liquidityBefore.div(3);

            await expect(nonOwnerWrappedLoan.decreaseLiquidityUniswapV3(
                [
                    id,
                    decreasedLiquidity,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).to.be.reverted;
        });
    });
});
