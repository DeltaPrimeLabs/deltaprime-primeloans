import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    erc20ABI, formatUnits,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei, yakRouterAbi
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';

chai.use(solidity);

const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0xb18a6cf6833130c7A13076D96c7e3784b7F721D1';

const {deployContract, provider} = waffle;
const yakRouterAddress = '0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3\n';

const yakRouter = new ethers.Contract(
    yakRouterAddress,
    yakRouterAbi,
    provider
)
//TODO: put in one file
async function query(tknFrom: string, tknTo: string, amountIn: BigNumber) {
    const maxHops = 3
    const gasPrice = ethers.utils.parseUnits('225', 'gwei')
    return yakRouter.findBestPathWithGas(
        amountIn,
        tknFrom,
        tknTo,
        maxHops,
        gasPrice,
        { gasLimit: 1e9 }
    )
}
describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with SteakHut staking operations', () => {
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
            let assetsList = ['ETH', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]}
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

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
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

            await tokenContracts.get('ETH')!.connect(owner).deposit({value: toWei("1")});
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("1"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("1"));

            const amountOfEthToSell = 0.5;

            const queryRes = await query(TOKEN_ADDRESSES['ETH'], TOKEN_ADDRESSES['USDC'], toWei(amountOfEthToSell.toString()));
            const amountOutMin = queryRes.amounts[queryRes.amounts.length-1];

            await wrappedLoan.yakSwap(
                queryRes.amounts[0],
                amountOutMin.mul(98).div(100),
                queryRes.path,
                queryRes.adapters
            )

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

        it("should mint AVAX/USDC UniswapV3 liquidity", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    500,
                    // 10000,
                    // 10100,
                    -1000,
                    1000,
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

            expect(tvBefore).to.be.closeTo(tvAfter, 0.001);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.001);
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

            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(1);
            expect(tvBefore).to.be.closeTo(tvAfter, 0.001);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.001);
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

            expect(tvBefore).to.be.closeTo(tvAfter, 0.001);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.001);
            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(1);
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

            expect(tvBefore).to.be.closeTo(tvAfter, 0.001);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.001);
            expect(fromWei(newLiquidity)).to.be.equal(0);

            await expect(wrappedLoan.burnLiquidityUniswapV3(id)).not.to.be.reverted;
            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(0);
        });
    });
});
