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
            let assetsList = ['AVAX', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

            tokensPrices = await getTokensPricesMap(
                assetsList,
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

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("5")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("5"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("5"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("2.5"), 0);

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(6 * tokensPrices.get('AVAX')!, 3);
        });
        //
        // it("should fail to add LB as a non-owner", async () => {
        //     const addedAvax = toWei('1');
        //     const addedUSDC = parseUnits('10', BigNumber.from('6'));
        //
        //     await expect(nonOwnerWrappedLoan.addLiquidityUniswapV3(
        //         [
        //             "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        //             "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
        //             3000,
        //             47640,
        //             61500,
        //             addedAvax,
        //             addedUSDC,
        //             0,
        //             0,
        //             "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
        //             Math.ceil((new Date().getTime() / 1000) + 100)
        //         ]
        //     )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        // });

        it("should fail to unstake as a non-owner", async () => {
            //TODO:
        });

        it("should mint AVAX/USDC UniswapV3 liquidity for a narrow range", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            //{"token0":"0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7","token1":"0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e","fee":"3000","recipient":"0x655c406ebfa14ee2006250925e54ec43ad184f8b","tickLower":"-257460","tickUpper":"-243600","amount0Desired":"9999926249497153","amount1Desired":"132722","amount0Min":"9914678461456890","amount1Min":"131591"})
            // =>
            // (124410619288, 9999926249497153, 132722, 0x0e663593657b064e1bae76d28625df5d0ebd4421)
            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    3000,
                    // 10000,
                    // 10100,
                    -250860,
                    -249720,
                    // -251000,
                    // -250000,
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

            expect((tvBefore - tvAfter) / tvBefore).to.be.below(0.05);
            expect((hrBefore - hrAfter) / hrBefore).to.be.below(0.05);
        });

        it("should mint AVAX/USDC UniswapV3 liquidity for a wide range", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            //{"token0":"0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7","token1":"0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e","fee":"3000","recipient":"0x655c406ebfa14ee2006250925e54ec43ad184f8b","tickLower":"-257460","tickUpper":"-243600","amount0Desired":"9999926249497153","amount1Desired":"132722","amount0Min":"9914678461456890","amount1Min":"131591"})
            // =>
            // (124410619288, 9999926249497153, 132722, 0x0e663593657b064e1bae76d28625df5d0ebd4421)
            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    3000,
                    // 10000,
                    // 10100,
                    -257460,
                    -243600,
                    // -251000,
                    // -250000,
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

            expect((tvBefore - tvAfter) / tvBefore).to.be.below(0.1);
            expect((hrBefore - hrAfter) / hrBefore).to.be.below(0.1);
        });



        it("should increase AVAX/USDC UniswapV3 liquidity", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];
            const addedAvax = toWei('0.5');
            const addedUSDC = parseUnits('5', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

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

            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(2);
            expect((tvBefore - tvAfter) / tvBefore).to.be.below(0.05);
            expect((hrBefore - hrAfter) / hrBefore).to.be.below(0.05);
        });

        it("should decrease AVAX/USDC UniswapV3 liquidity", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];

            const manager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER_ADDRESS, owner);

            const liquidityBefore = (await manager.positions(id)).liquidity;
            const decreasedLiquidity = liquidityBefore.div(3);

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

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

            expect((tvBefore - tvAfter) / tvBefore).to.be.below(0.07);
            expect((hrBefore - hrAfter) / hrBefore).to.be.below(0.07);
            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(2);
            expect(fromWei(liquidityAfter)).to.be.closeTo(fromWei(liquidityBefore) - fromWei(decreasedLiquidity), 0.0001);
        });

        it("should withdraw rest and burn UniswapV3 token", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];

            const manager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER_ADDRESS, owner);

            const liquidity = (await manager.positions(id)).liquidity;

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.decreaseLiquidityUniswapV3(
                [
                    id,
                    liquidity,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            const newLiquidity = (await manager.positions(id)).liquidity;

            expect(tvBefore).to.be.closeTo(tvAfter, 11);
            expect(hrBefore).to.be.closeTo(hrAfter, 1);
            expect(fromWei(newLiquidity)).to.be.equal(0);

            await expect(wrappedLoan.burnLiquidityUniswapV3(id)).not.to.be.reverted;
            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(1);
        });
    });
});
