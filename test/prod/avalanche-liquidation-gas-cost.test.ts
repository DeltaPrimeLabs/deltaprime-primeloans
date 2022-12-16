import {ethers, network, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {BigNumber, Contract} from "ethers";
import {
    AssetsOperationsFacet, AssetsOperationsMock,
    DiamondCutFacet,
    IUniswapV2Router01,
    OwnershipFacet,
    Pool,
    SmartLoanDiamondBeacon,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager
} from "../../typechain";
import SMART_LOAN_DIAMOND_BEACON from '../../deployments/avalanche/SmartLoanDiamondBeacon.json';
import OWNERSHIP_FACET from '../../deployments/avalanche/OwnershipFacet.json';
import DIAMOND_CUT_FACET from '../../deployments/avalanche/DiamondCutFacet.json';
import SMART_LOAN_FACTORY_TUP from '../../deployments/avalanche/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '../../deployments/avalanche/SmartLoansFactory.json';
import SMART_LOAN_GIGACHAD_INTERFACE
    from '../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import WAVAX_POOL_TUP from '../../deployments/avalanche/WavaxPoolTUP.json';
import USDC_POOL_TUP from '../../deployments/avalanche/UsdcPoolTUP.json';
import WAVAX_POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import USDC_POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import TOKEN_MANAGER_TUP from '../../deployments/avalanche/TokenManagerTUP.json';
import TOKEN_MANAGER from '../../deployments/avalanche/TokenManager.json';
import {
    Asset,
    erc20ABI, formatUnits,
    fromBytes32,
    fromWei,
    getFixedGasSigners, getLiquidationAmounts,
    syncTime,
    toBytes32,
    toWei,
    wavaxAbi
} from "../_helpers";
import {pangolinAssets} from "../../common/addresses/avax/pangolin_supported_assets";
import {traderJoeAssets} from "../../common/addresses/avax/traderjoe_supported_assets";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JsonRpcSigner} from "@ethersproject/providers";
import {parseUnits} from "ethers/lib/utils";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {supportedAssetsAvax} from '../../common/addresses/avax/avalanche_supported_assets';
import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';
import redstone from "redstone-api";
import {from} from "rxjs";
import {FacetCutAction} from "hardhat-deploy/dist/types";
import {liquidateLoan} from '../../tools/liquidation/liquidation-bot'
import fs from "fs";
import path from "path";

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
const traderJoeRouter = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

chai.use(solidity);

const {deployContract, provider} = waffle;

const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
const usdcTokenContract = new ethers.Contract(usdcTokenAddress, erc20ABI, provider.getSigner());

//TODO: create a report
const PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "../../tools/liquidation/.private")).toString().trim();
let liquidationWallet = (new ethers.Wallet(PRIVATE_KEY)).connect(provider);

describe('Test deployed contracts on Avalanche', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe(`Run tests`, () => {
        let smartLoansFactory: SmartLoansFactory,
            smartLoansDiamondBeacon: SmartLoanDiamondBeacon & OwnershipFacet & DiamondCutFacet,
            wavaxPool: Pool,
            usdcPool: Pool,
            tokenManager: TokenManager,
            deployer: SignerWithAddress,
            admin: SignerWithAddress,
            MAINNET_DEPLOYER: JsonRpcSigner,
            LIQUIDATOR: JsonRpcSigner,
            AVAX_PRICE: number,
            DEPOSITOR: SignerWithAddress,
            USER_1: SignerWithAddress;

        before("setup deployed protocol contracts", async () => {
            smartLoansDiamondBeacon = new ethers.Contract(SMART_LOAN_DIAMOND_BEACON.address, [...SMART_LOAN_DIAMOND_BEACON.abi, ...OWNERSHIP_FACET.abi, ...DIAMOND_CUT_FACET.abi], provider.getSigner()) as SmartLoanDiamondBeacon & OwnershipFacet & DiamondCutFacet;
            smartLoansFactory = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner()) as SmartLoansFactory;
            wavaxPool = new ethers.Contract(WAVAX_POOL_TUP.address, WAVAX_POOL.abi, provider.getSigner()) as Pool;
            usdcPool = new ethers.Contract(USDC_POOL_TUP.address, USDC_POOL.abi, provider.getSigner()) as Pool;
            tokenManager = new ethers.Contract(TOKEN_MANAGER_TUP.address, TOKEN_MANAGER.abi, provider.getSigner()) as TokenManager;

            AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
            MAINNET_DEPLOYER = await ethers.provider.getSigner('0xbAc44698844f13cF0AF423b19040659b688ef036');
            //depends on the private key provided in liquidation-bot.js directory
            LIQUIDATOR = await ethers.provider.getSigner('0xbDA5747bFD65F08deb54cb465eB87D40e51B197E');
        });

        before("setup wallets", async () => {
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0xbAc44698844f13cF0AF423b19040659b688ef036"],
            });

            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0xbDA5747bFD65F08deb54cb465eB87D40e51B197E"],
            });

            [deployer, admin, DEPOSITOR, USER_1] = await getFixedGasSigners(10000000);

            await sendWavax(100, [USER_1]);
            await sendUsdc(100, [ USER_1]);

            await sendWavax(1.1 * 10000, [DEPOSITOR]);
            await sendUsdc(1.1 * 10000, [ DEPOSITOR]);

            await sendWavax(10000, [LIQUIDATOR]);
            await sendUsdc(10000, [ LIQUIDATOR]);

        });

        it('Prepare pools', async () => {
            //ERC20 functions
            await prepareDeposit(wavaxPool, wavaxTokenContract, DEPOSITOR, 10000);

            await prepareDeposit(usdcPool, usdcTokenContract, DEPOSITOR, 10000 *  AVAX_PRICE);

            expect((await tokenManager.getAllPoolAssets()).length).to.be.equal(2);
        });


        it('SmartLoan', async () => {
            //test DEXes
            expect((await tokenManager.getAllTokenAssets()).length).to.be.equal(24);

            await smartLoansFactory.connect(USER_1).createLoan();

            let newLoan = await smartLoansFactory.getLoanForOwner(USER_1.address);
            let loan = new ethers.Contract(newLoan, SMART_LOAN_GIGACHAD_INTERFACE.abi, provider.getSigner()) as SmartLoanGigaChadInterface;
            let wrappedLoan = wrapContract(loan, USER_1);


            //Pangolin
            console.log('Pangolin')
            await createPositions(
                'swapPangolin',
                'addLiquidityPangolin',
                'removeLiquidityPangolin',
                loan,
                pangolinAssets,
                USER_1
            );
            //to make sure AVAX is in the owned assets
            await wrappedLoan.depositNativeToken({ value: toWei('10') });

            expect((await loan.getAllOwnedAssets()).length).to.be.equal(11);

            //TraderJoe
            console.log('TraderJoe')
            await createPositions(
                'swapTraderJoe',
                'addLiquidityTraderJoe',
                'removeLiquidityTraderJoe',
                loan,
                traderJoeAssets,
                USER_1
            );
            //to make sure AVAX is in the owned assets
            await wrappedLoan.depositNativeToken({ value: toWei('10') });

            expect((await loan.getAllOwnedAssets()).length).to.be.equal(17);

            console.log('Stake in Yield Yak vaults');
            await stakeYieldYak(loan, USER_1);

            console.log((await loan.getAllOwnedAssets()).map(el => fromBytes32(el)))
            expect((await loan.getAllOwnedAssets()).length).to.be.equal(24);

            console.log('Stake in Vector vaults');
            //TODO: unstake when upgraded - although they can be unstaked forcibly by a liquidator
            // await stakeVector(loan, USER_1);


            let totalValue = fromWei(await wrappedLoan.getTotalValue());
            //adjust if debtCoverages change and it does not pass
            let amountBorrowable = 3 * totalValue;

            //borrow part in AVAX
            let borrowedAvax = toWei((amountBorrowable / 2 / AVAX_PRICE * 0.98).toString());

            await wrappedLoan.borrow(toBytes32('AVAX'), borrowedAvax);

            //borrow part in USDC
            let borrowed = amountBorrowable / 2 * 0.98;
            let borrowedUSDC = parseUnits((borrowed).toFixed(6), BigNumber.from('6'));

            await wrappedLoan.borrow(toBytes32('USDC'), borrowedUSDC);

            expect((await loan.getStakedPositions()).length).to.be.equal(3);

        });

        it('Replace withdraw facet and remove funds to make loan insolvent', async () => {
            // Deploy AssetsOperationsMock
            let assetsOperationsMockFactory = await ethers.getContractFactory("AssetsOperationsMock");
            let assetsOperationsMockFacet = (await assetsOperationsMockFactory.deploy()).connect(MAINNET_DEPLOYER) as AssetsOperationsMock;

            // Prepare diamondCut and diamondLoupe
            let diamondCut = await ethers.getContractAt("IDiamondCut", SMART_LOAN_DIAMOND_BEACON.address, MAINNET_DEPLOYER);
            let diamondLoupe = await ethers.getContractAt("IDiamondLoupe", SMART_LOAN_DIAMOND_BEACON.address, MAINNET_DEPLOYER);

            // Pause
            await diamondCut.pause();
            // Prepare replace diamondCut
            let cut = [{
                facetAddress: assetsOperationsMockFacet.address,
                action: FacetCutAction.Replace,
                functionSelectors: ["0x040cf020"]  // 0x040cf020 == withdraw(bytes32 _withdrawnAsset, uint256 _amount)
            }]
            // Perform diamondCut replace
            await diamondCut.diamondCut(cut, ethers.constants.AddressZero, []);
            // Unpause
            await diamondCut.unpause();

            // Verify successful replacement of the withdraw() method
            expect(await diamondLoupe.facetAddress("0x040cf020")).to.be.equal(assetsOperationsMockFacet.address);

            let newLoan = await smartLoansFactory.getLoanForOwner(USER_1.address);
            let loan = new ethers.Contract(newLoan, SMART_LOAN_GIGACHAD_INTERFACE.abi, provider.getSigner()) as SmartLoanGigaChadInterface;
            let wrappedLoan = wrapContract(loan, USER_1);

            //adjust amount if needed
            await wrappedLoan.withdraw(toBytes32('AVAX'), (await wrappedLoan.getBalance(toBytes32('AVAX'))).div(3));

        });

        it('Liquidate account', async () => {
            let newLoan = await smartLoansFactory.getLoanForOwner(USER_1.address);

            let loan = new ethers.Contract(newLoan, SMART_LOAN_GIGACHAD_INTERFACE.abi, provider.getSigner()) as SmartLoanGigaChadInterface;

            await liquidateLoan(loan.address, tokenManager.address, smartLoansDiamondBeacon.address, MAINNET_DEPLOYER);

        });
    });


    // ================================= HELPER FUNCTIONS ===================================================

    async function prepareDeposit(pool: Contract, tokenContract: Contract, USER_1: any, amount: Number) {
        const decimals = await tokenContract.decimals();

        //deposit
        let amountInWei = parseUnits(amount.toFixed(decimals), decimals);

        await tokenContract.connect(USER_1).approve(pool.address, amountInWei);

        await pool.connect(USER_1).deposit(amountInWei);
    }


    async function sendWavax(amount: Number, users: (SignerWithAddress | JsonRpcSigner)[]) {
        const decimals = await wavaxTokenContract.decimals();
        let amountInWei = parseUnits(amount.toString(), decimals);

        for (let user of users) {
            await wavaxTokenContract.connect(user).deposit({ value: amountInWei })
        }
    }

    async function sendUsdc(amountInAVAX: Number, users: (SignerWithAddress | JsonRpcSigner)[]) {
        let amountInWei = parseUnits(amountInAVAX.toString(), await wavaxTokenContract.decimals());

        let router = await ethers.getContractAt("IUniswapV2Router01", traderJoeRouter);

        for (let user of users) {
            await wavaxTokenContract.connect(user).deposit({ value: amountInWei });
            await wavaxTokenContract.connect(user).approve(router.address, amountInWei);

            //@ts-ignore
            await router.connect(user).swapExactTokensForTokens(amountInWei, 0, [wavaxTokenContract.address, usdcTokenContract.address], user.address ? user.address : user._address, 1880333856);
        }
    }

    async function createPositions(
        swapMethod: string,
        provideLiquidityMethod: string,
        removeLiquidityMethod: string,
        loan1: SmartLoanGigaChadInterface,
        assets: Asset[],
        user: SignerWithAddress
    ) {
        await swapTokens(swapMethod, loan1, assets, user);

        await createLP(swapMethod, provideLiquidityMethod, removeLiquidityMethod, loan1, assets, user);
    }

    async function swapTokens(
        swapMethod: string,
        loan1: SmartLoanGigaChadInterface,
        assets: Asset[],
        USER_1: any
    ) {
        assets = assets.filter(a => !fromBytes32(a.asset).includes('_LP'));

        let wavaxDecimals = await wavaxTokenContract.decimals();
        //add token1 (AVAX)
        let wrappedLoan1User1 = wrapContract(loan1, USER_1);


        for (let i = 0; i < assets.length - 1; i++) {
            let depositedAmount = 20;
            let amountInWei = parseUnits(depositedAmount.toString(), wavaxDecimals);
            await wrappedLoan1User1.depositNativeToken({ value: amountInWei});

            await wrappedLoan1User1[swapMethod](
                toBytes32('AVAX'),
                assets[i+1].asset,
                amountInWei,
                1
            );
        }
    }

    async function createLP(
        swapMethod: string,
        provideLiquidityMethod: string,
        removeLiquidityMethod: string,
        loan1: SmartLoanGigaChadInterface,
        assets: Asset[],
        USER_1: any
    ) {

        let lpAssets = assets.filter(a => fromBytes32(a.asset).includes('_LP'));

        let wrappedLoan1User1 = wrapContract(loan1, USER_1);

        for (let lp of lpAssets) {
            let depositedAmount = 20;
            let amountInWei = parseUnits(depositedAmount.toString(), 18);
            await loan1.depositNativeToken({ value: amountInWei});

            let [, firstAsset, secondAsset,] = fromBytes32(lp.asset).split('_');
            //get first asset
            let avaxBalance = await loan1.getBalance(assets[0].asset);

            if (toBytes32(firstAsset) != assets[0].asset) {
                await wrappedLoan1User1[swapMethod](assets[0].asset, toBytes32(firstAsset), amountInWei.div(2).sub(1), 0);
            }

            if (toBytes32(secondAsset) != assets[0].asset) {
                await wrappedLoan1User1[swapMethod](assets[0].asset, toBytes32(secondAsset), amountInWei.div(2).sub(1), 0);
            }

            let firstBalance = await loan1.getBalance(toBytes32(firstAsset));
            let secondBalance = await loan1.getBalance(toBytes32(secondAsset));


            await wrappedLoan1User1[provideLiquidityMethod](toBytes32(firstAsset), toBytes32(secondAsset), firstBalance, secondBalance, 1, 1);
        }
    }

    async function stakeYieldYak(
        loan1: SmartLoanGigaChadInterface,
        USER_1: any
    ) {
        let wrappedLoan1User1 = wrapContract(loan1, USER_1);

        //AVAX
        let avaxAmount = 20;

        let amountInWei = parseUnits(avaxAmount.toString(), 18);

        await loan1.depositNativeToken({ value: amountInWei});

        await wrappedLoan1User1.stakeAVAXYak(amountInWei);

        //sAVAX
        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);

        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});

        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('sAVAX'), amountInWei, 0);

        await wrappedLoan1User1.stakeSAVAXYak(amountInWei);

        //YY_PNG_AVAX_USDC_LP

        await wrappedLoan1User1.stakePNGAVAXUSDCYak((await loan1.getBalance(toBytes32('PNG_AVAX_USDC_LP'))).div(2));

        //YY_PNG_AVAX_ETH_LP

        await wrappedLoan1User1.stakePNGAVAXETHYak((await loan1.getBalance(toBytes32('PNG_AVAX_ETH_LP'))).div(2));

        //YY_TJ_AVAX_USDC_LP

        await wrappedLoan1User1.stakeTJAVAXUSDCYak((await loan1.getBalance(toBytes32('TJ_AVAX_USDC_LP'))).div(2));

        //YY_TJ_AVAX_ETH_LP

        await wrappedLoan1User1.stakeTJAVAXETHYak((await loan1.getBalance(toBytes32('TJ_AVAX_ETH_LP'))).div(2));

        //YY_TJ_AVAX_sAVAX_LP

        await wrappedLoan1User1.stakeTJAVAXSAVAXYak((await loan1.getBalance(toBytes32('TJ_AVAX_sAVAX_LP'))).div(2));
    }

    async function stakeVector(
        loan1: SmartLoanGigaChadInterface,
        USER_1: any
    ) {
        let wrappedLoan1User1 = wrapContract(loan1, USER_1);

        //AVAX
        let avaxAmount = 20;
        let amountInWei = parseUnits(avaxAmount.toString(), 18);
        await loan1.depositNativeToken({ value: amountInWei});

        await wrappedLoan1User1.vectorStakeWAVAX1(amountInWei);

        //sAVAX

        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('sAVAX'), amountInWei, 0);

        await wrappedLoan1User1.vectorStakeSAVAX1(amountInWei);

        //USDC

        avaxAmount = 20;
        amountInWei = parseUnits(avaxAmount.toString(), 18);
        await wrappedLoan1User1.depositNativeToken({ value: amountInWei});
        await wrappedLoan1User1.swapTraderJoe(toBytes32('AVAX'), toBytes32('USDC'), amountInWei, 0);

        await wrappedLoan1User1.vectorStakeUSDC1(amountInWei);
    }


    function wrapContract(contract: any, performer: SignerWithAddress) {
        return WrapperBuilder.wrap(contract.connect(performer)).usingDataService(
            {
                dataServiceId: "redstone-avalanche-prod",
                uniqueSignersCount: 3,
                dataFeeds: supportedAssetsAvax.map(a => fromBytes32(a.asset)),
                // @ts-ignore
                disablePayloadsDryRun: true
            },
            CACHE_LAYER_URLS.urls
        );
    }
});

