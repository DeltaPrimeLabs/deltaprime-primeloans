import {ethers, network, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {Contract} from "ethers";
import {
    Pool,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    VariableUtilisationRatesCalculator,
    IUniswapV2Router01,
    WrappedNativeTokenPool, SmartLoanDiamondBeacon, OwnershipFacet, DiamondCutFacet
} from "../../typechain";
import SMART_LOAN_DIAMOND_BEACON from '../../deployments/avalanche/SmartLoanDiamondBeacon.json';
import OWNERSHIP_FACET from '../../deployments/avalanche/OwnershipFacet.json';
import DIAMOND_CUT_FACET from '../../deployments/avalanche/DiamondCutFacet.json';
import SMART_LOAN_FACTORY_TUP from '../../deployments/avalanche/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '../../deployments/avalanche/SmartLoansFactory.json';
import WAVAX_POOL_TUP from '../../deployments/avalanche/WavaxPoolTUP.json';
import USDC_POOL_TUP from '../../deployments/avalanche/UsdcPoolTUP.json';
import WAVAX_POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import USDC_POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import WRAPPED_POOL from '../../artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import RATES_CALCULATOR from '../../deployments/avalanche/VariableUtilisationRatesCalculator.json';
import {
    erc20ABI,
    formatUnits,
    fromWei,
    getFixedGasSigners,
    syncTime,
    toBytes32,
    toWei,
    wavaxAbi,
    ZERO
} from "../_helpers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {JsonRpcSigner} from "@ethersproject/providers";
import VariableUtilisationRatesCalculatorArtifact
    from "../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json";
import {parseUnits} from "ethers/lib/utils";

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
const randomContractAddress = '0xF8d1b34651f2c9230beB9b83B2260529769FDeA4';
const traderJoeRouter = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

chai.use(solidity);

const {deployContract, provider} = waffle;

const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
const usdcTokenContract = new ethers.Contract(usdcTokenAddress, erc20ABI, provider.getSigner());

describe('Test deployed contracts on Avalanche', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe(`Funding a loan`, () => {
        let smartLoansFactory: SmartLoansFactory,
            smartLoansDiamondBeacon: SmartLoanDiamondBeacon & OwnershipFacet & DiamondCutFacet,
            loan1: SmartLoanGigaChadInterface,
            loan2: SmartLoanGigaChadInterface,
            wavaxPool: Pool,
            usdcPool: Pool,
            MAINNET_DEPLOYER: JsonRpcSigner,
            USER_1: SignerWithAddress,
            USER_2: SignerWithAddress,
            USER_3: SignerWithAddress;

            before("setup deployed protocol contracts", async () => {
            smartLoansDiamondBeacon = new ethers.Contract(SMART_LOAN_DIAMOND_BEACON.address, [...SMART_LOAN_DIAMOND_BEACON.abi, ...OWNERSHIP_FACET.abi, ...DIAMOND_CUT_FACET.abi], provider.getSigner()) as SmartLoanDiamondBeacon & OwnershipFacet & DiamondCutFacet;
            smartLoansFactory = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner()) as SmartLoansFactory;
            wavaxPool = new ethers.Contract(WAVAX_POOL_TUP.address, WAVAX_POOL.abi, provider.getSigner()) as Pool;
            usdcPool = new ethers.Contract(USDC_POOL_TUP.address, USDC_POOL.abi, provider.getSigner()) as Pool;
        });

        before("setup wallets", async () => {
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0xbAc44698844f13cF0AF423b19040659b688ef036"],
            });

            MAINNET_DEPLOYER = await ethers.provider.getSigner('0xbAc44698844f13cF0AF423b19040659b688ef036');

            [, USER_1, USER_2, USER_3] = await getFixedGasSigners(10000000);

            await sendWavax(10, [USER_1, USER_2, USER_3]);
            await sendUsdc(10, [ USER_1, USER_2, USER_3]);

        });
/*
        it('Pools', async () => {
            //administrative functions
            await poolAdministrativeFunctionsTests(wavaxPool, MAINNET_DEPLOYER, USER_1);
            await poolAdministrativeFunctionsTests(usdcPool, MAINNET_DEPLOYER, USER_1);

            //administrative functions
            await poolActionsTests(wavaxPool, wavaxTokenContract, USER_1, USER_2);
            await poolActionsTests(usdcPool, usdcTokenContract, USER_1, USER_2);

            //ERC20 functions
            await erc20PoolActionsTests(wavaxPool, wavaxTokenContract, USER_1, USER_2);
            await erc20PoolActionsTests(usdcPool, usdcTokenContract, USER_1, USER_2);
        });

        it('SmartLoansFactory', async () => {
            //administrative functions

            //initialize
            await expect(smartLoansFactory.connect(MAINNET_DEPLOYER).initialize(randomContractAddress)).to.be.revertedWith('Initializable: contract is already initialized')
            await expect(smartLoansFactory.connect(USER_1).initialize(randomContractAddress)).to.be.revertedWith('Initializable: contract is already initialized')

            //createLoan
            let loansBeforeCreate = await smartLoansFactory.getAllLoans();

            await smartLoansFactory.connect(USER_1).createLoan();

            let loansAfterCreate = await smartLoansFactory.getAllLoans();
            let newLoan = await smartLoansFactory.getLoanForOwner(USER_1.address);

            expect(loansAfterCreate.length).to.be.equal(loansBeforeCreate.length + 1);
            expect(newLoan).be.equal(loansAfterCreate[loansAfterCreate.length - 1]);
            expect(await smartLoansFactory.getOwnerOfLoan(newLoan)).be.equal(USER_1.address);

            await expect(smartLoansFactory.connect(USER_1).createLoan()).to.be.revertedWith('Only one loan per owner is allowed');
            await expect(smartLoansFactory.connect(USER_1).createAndFundLoan(
                toBytes32('USDC'), usdcTokenContract.address, parseUnits('1', await usdcTokenContract.decimals()))
            ).to.be.revertedWith('Only one loan per owner is allowed');

            await usdcTokenContract.connect(USER_2).approve(smartLoansFactory.address, parseUnits('1', await usdcTokenContract.decimals()));
            await wavaxTokenContract.connect(USER_2).approve(smartLoansFactory.address, parseUnits('1', await wavaxTokenContract.decimals()));
            //provided wrong token address
            await expect(smartLoansFactory.connect(USER_2).createAndFundLoan(
                toBytes32('USDC'), wavaxTokenContract.address, parseUnits('1', await usdcTokenContract.decimals()))
            ).to.be.revertedWith('reverted with an unrecognized custom error');

            loansBeforeCreate = await smartLoansFactory.getAllLoans();

            await usdcTokenContract.connect(USER_2).approve(smartLoansFactory.address, parseUnits('1', await usdcTokenContract.decimals()));

            await smartLoansFactory.connect(USER_2).createAndFundLoan(
                toBytes32('USDC'), usdcTokenContract.address, parseUnits('1', await usdcTokenContract.decimals()));

            loansAfterCreate = await smartLoansFactory.getAllLoans();
            newLoan = await smartLoansFactory.getLoanForOwner(USER_2.address);

            expect(loansAfterCreate.length).to.be.equal(loansBeforeCreate.length + 1);
            expect(newLoan).be.equal(loansAfterCreate[loansAfterCreate.length - 1]);
            expect(await smartLoansFactory.getOwnerOfLoan(newLoan)).be.equal(USER_2.address);

            await expect(smartLoansFactory.connect(USER_1).changeOwnership(randomContractAddress)).to.be.revertedWith('Only a SmartLoan can change it\'s owner');

            await expect(smartLoansFactory.connect(USER_2).changeOwnership(randomContractAddress)).to.be.revertedWith('Only a SmartLoan can change it\'s owner');
        });
*/
        it('SmartLoansDiamondBeacon', async () => {
            expect(await smartLoansDiamondBeacon.owner()).to.equal(MAINNET_DEPLOYER._address);

            //proposeBeaconOwnershipTransfer
            await expect(smartLoansDiamondBeacon.connect(USER_1).proposeBeaconOwnershipTransfer(USER_2.address)).to.be.revertedWith('\'DiamondStorageLib: Must be contract owner');

            await smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).proposeBeaconOwnershipTransfer(USER_2.address);

            //acceptBeaconOwnership
            expect(await smartLoansDiamondBeacon.owner()).to.equal(MAINNET_DEPLOYER._address);
            expect(await smartLoansDiamondBeacon.proposedOwner()).to.equal(USER_2.address);

            await expect(smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).acceptBeaconOwnership()).to.be.revertedWith('Only a proposed user can accept ownership');
            await expect(smartLoansDiamondBeacon.connect(USER_1).acceptBeaconOwnership()).to.be.revertedWith('Only a proposed user can accept ownership');

            await smartLoansDiamondBeacon.connect(USER_2).acceptBeaconOwnership();

            expect(await smartLoansDiamondBeacon.owner()).to.equal(USER_2.address);
            expect(await smartLoansDiamondBeacon.proposedOwner()).to.equal(ZERO);

            //pause
            await expect(smartLoansDiamondBeacon.connect(USER_1).pause()).to.be.revertedWith('Must be contract pauseAdmin');
            await expect(smartLoansDiamondBeacon.connect(USER_2).pause()).to.be.revertedWith('Must be contract pauseAdmin');

            await smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).pause();

            await expect(smartLoansDiamondBeacon.connect(MAINNET_DEPLOYER).pause()).to.be.revertedWith('ProtocolUpgrade: paused.');

            await expect(smartLoansDiamondBeacon.connect(USER_1).unpause()).to.be.revertedWith('Must be contract pauseAdmin');
            await expect(smartLoansDiamondBeacon.connect(USER_2).unpause()).to.be.revertedWith('Must be contract pauseAdmin');


        });
    });

    async function poolAdministrativeFunctionsTests(pool: Contract, admin: any, badActor: any) {
        //initialize
        await expect(pool.connect(admin).initialize(ZERO, ZERO, ZERO, ZERO, ZERO, ZERO, 0)).to.be.revertedWith('Initializable: contract is already initialized');
        await expect(pool.connect(badActor).initialize(ZERO, ZERO, ZERO, ZERO, ZERO, ZERO, 0)).to.be.revertedWith('Initializable: contract is already initialized');

        //setTotalSupplyCap
        await pool.connect(admin).setTotalSupplyCap(toWei("0.5"));
        expect(await pool.connect(admin).totalSupplyCap()).to.be.equal(toWei("0.5"));

        await expect(pool.connect(badActor).setTotalSupplyCap(toWei("0.4"))).to.be.revertedWith('Ownable: caller is not the owner');
        await pool.connect(admin).setTotalSupplyCap(0);

        //setPoolRewarder
        await pool.connect(admin).setPoolRewarder(randomContractAddress);
        expect(await pool.connect(admin).poolRewarder()).to.be.equal(randomContractAddress);
        await pool.connect(admin).setPoolRewarder(ZERO);

        await expect(pool.connect(badActor).setPoolRewarder(randomContractAddress)).to.be.revertedWith('Ownable: caller is not the owner');

        //setRatesCalculator
        let newCalculator = (await deployContract(admin, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;

        await pool.connect(admin).setRatesCalculator(newCalculator.address);
        expect(await pool.connect(admin).ratesCalculator()).to.be.equal(newCalculator.address);
        await expect(pool.connect(badActor).setRatesCalculator(RATES_CALCULATOR.address)).to.be.revertedWith('Ownable: caller is not the owner');
        await pool.connect(admin).setRatesCalculator(RATES_CALCULATOR.address);

        //setBorrowersRegistry
        await pool.connect(admin).setBorrowersRegistry(randomContractAddress);
        expect(await pool.connect(admin).borrowersRegistry()).to.be.equal(randomContractAddress);
        await pool.connect(admin).setBorrowersRegistry(SMART_LOAN_FACTORY_TUP.address);

        await expect(pool.connect(badActor).setBorrowersRegistry(randomContractAddress)).to.be.revertedWith('Ownable: caller is not the owner');

        //recoverSurplus
        await pool.connect(admin).recoverSurplus(0, admin._address);
        await expect(pool.connect(badActor).recoverSurplus(0, badActor.address)).to.be.revertedWith('Ownable: caller is not the owner');

        //renounceOwnership
        await pool.connect(admin).renounceOwnership();
        await pool.connect(admin).setBorrowersRegistry(SMART_LOAN_FACTORY_TUP.address); //method that requires ownership
    }

    async function poolActionsTests(pool: Contract, tokenContract: Contract, USER_1: any, USER_2: any) {
        const decimals = await tokenContract.decimals();

        //deposit
        let initialPoolBalance = formatUnits(await pool.totalSupply(), decimals);
        let initialUserBalance = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        let initialTokenBalanceOfPool = formatUnits(await tokenContract.balanceOf(pool.address), decimals);

        let depositAmount = 1;
        let amountInWei = parseUnits(depositAmount.toString(), decimals);
        await tokenContract.connect(USER_1).approve(pool.address, amountInWei);

        await pool.connect(USER_1).deposit(amountInWei);

        let balanceAfterDeposit = formatUnits(await pool.totalSupply(), decimals);
        let tokenBalanceOfPoolAfterDeposit = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
        let userBalanceAfterDeposit = formatUnits(await pool.balanceOf(USER_1.address), decimals);

        expect(balanceAfterDeposit - initialPoolBalance).to.be.closeTo(depositAmount, 0.0001);
        expect(tokenBalanceOfPoolAfterDeposit - initialTokenBalanceOfPool).to.be.closeTo(depositAmount, 0.0001);
        expect(userBalanceAfterDeposit - initialUserBalance).to.be.closeTo(depositAmount, 0.0001);

        //withdraw
        let withdrawAmount = depositAmount / 2;
        let withdrawAmountInWei = parseUnits(withdrawAmount.toString(), decimals);

        await pool.connect(USER_1).withdraw(withdrawAmountInWei);

        let balanceAfterWithdraw = formatUnits(await pool.totalSupply(), decimals);
        let tokenBalanceOfPoolAfterWithdraw = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
        let userBalanceAfterWithdraw = formatUnits(await pool.balanceOf(USER_1.address), decimals);

        expect(balanceAfterDeposit - balanceAfterWithdraw).to.be.closeTo(depositAmount - withdrawAmount, 0.0001);
        expect(tokenBalanceOfPoolAfterDeposit - tokenBalanceOfPoolAfterWithdraw).to.be.closeTo(depositAmount - withdrawAmount, 0.0001);
        expect(userBalanceAfterDeposit - userBalanceAfterWithdraw).to.be.closeTo(depositAmount - withdrawAmount, 0.0001);

        //borrow
        let borrowAmount = depositAmount / 10;
        let borrowAmountInWei = parseUnits(borrowAmount.toString(), decimals);
        await expect(pool.connect(USER_1).borrow(borrowAmountInWei)).to.be.revertedWith('NotAuthorizedToBorrow()');

        //borrow
        let repayAmount = depositAmount / 10;
        let repayAmountInWei = parseUnits(repayAmount.toString(), decimals);
        await expect(pool.connect(USER_1).repay(repayAmountInWei)).to.be.revertedWith('RepayingMoreThanWasBorrowed()');

        const isWrappedNativeToken = tokenContract.address === wavaxTokenContract.address;

        let wrappedPool = new ethers.Contract(pool.address, WRAPPED_POOL.abi, provider.getSigner()) as WrappedNativeTokenPool;

        if (isWrappedNativeToken) {
            //deposit native
            let depositAmount = 1;
            let amountInWei = parseUnits(depositAmount.toString(), decimals);

            let poolBalanceBeforeNativeDeposit = formatUnits(await pool.totalSupply(), decimals);
            let userBalanceBeforeNativeDeposit = formatUnits(await pool.balanceOf(USER_1.address), decimals);
            let tokenBalanceOfPoolBeforeNativeDeposit = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
            let nativeBalanceOfPoolBeforeNativeDeposit = formatUnits(await provider.getBalance(pool.address), decimals);

            await wrappedPool.connect(USER_1).depositNativeToken({ value: amountInWei});

            let poolBalanceAfterNativeDeposit = formatUnits(await pool.totalSupply(), decimals);
            let userBalanceAfterNativeDeposit = formatUnits(await pool.balanceOf(USER_1.address), decimals);
            let tokenBalanceOfPoolAfterNativeDeposit = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
            let nativeBalanceOfPoolAfterNativeDeposit = formatUnits(await provider.getBalance(pool.address), decimals);

            expect(poolBalanceAfterNativeDeposit - poolBalanceBeforeNativeDeposit).to.be.closeTo(depositAmount, 0.0001);
            expect(userBalanceAfterNativeDeposit - userBalanceBeforeNativeDeposit).to.be.closeTo(depositAmount, 0.0001);
            expect(tokenBalanceOfPoolAfterNativeDeposit - tokenBalanceOfPoolBeforeNativeDeposit).to.be.closeTo(depositAmount, 0.0001);
            expect(nativeBalanceOfPoolAfterNativeDeposit - nativeBalanceOfPoolBeforeNativeDeposit).to.be.closeTo(0, 0.0001);

            //withdraw native
            //deposit native
            let withdrawAmount = depositAmount / 2;
            amountInWei = parseUnits(withdrawAmount.toString(), decimals);

            let poolBalanceBeforeNativeWithdraw = formatUnits(await pool.totalSupply(), decimals);
            let userBalanceBeforeNativeWithdraw = formatUnits(await pool.balanceOf(USER_1.address), decimals);
            let tokenBalanceOfPoolBeforeNativeWithdraw = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
            let nativeBalanceOfPoolBeforeNativeWithdraw = formatUnits(await provider.getBalance(pool.address), decimals);
            let nativeBalanceOfUserBeforeNativeWithdraw = formatUnits(await provider.getBalance(USER_1.address), decimals);

            await wrappedPool.connect(USER_1).withdrawNativeToken(amountInWei);

            let poolBalanceAfterNativeWithdraw = formatUnits(await pool.totalSupply(), decimals);
            let userBalanceAfterNativeWithdraw = formatUnits(await pool.balanceOf(USER_1.address), decimals);
            let tokenBalanceOfPoolAfterNativeWithdraw = formatUnits(await tokenContract.balanceOf(pool.address), decimals);
            let nativeBalanceOfPoolAfterNativeWithdraw = formatUnits(await provider.getBalance(pool.address), decimals);
            let nativeBalanceOfUserAfterNativeWithdraw = formatUnits(await provider.getBalance(USER_1.address), decimals);

            expect(poolBalanceBeforeNativeWithdraw - poolBalanceAfterNativeWithdraw).to.be.closeTo(withdrawAmount, 0.0001);
            expect(userBalanceBeforeNativeWithdraw - userBalanceAfterNativeWithdraw).to.be.closeTo(withdrawAmount, 0.0001);
            expect(tokenBalanceOfPoolBeforeNativeWithdraw - tokenBalanceOfPoolAfterNativeWithdraw).to.be.closeTo(withdrawAmount, 0.0001);
            expect(nativeBalanceOfPoolBeforeNativeWithdraw - nativeBalanceOfPoolAfterNativeWithdraw).to.be.closeTo(0, 0.0001);
            expect(nativeBalanceOfUserAfterNativeWithdraw - nativeBalanceOfUserBeforeNativeWithdraw).to.be.closeTo(withdrawAmount, 0.001);
        } else {
            let depositAmount = 1;
            let amountInWei = parseUnits(depositAmount.toString(), decimals);

            await expect(wrappedPool.connect(USER_1).depositNativeToken({ value: amountInWei } )).to.be.revertedWith('Transaction reverted: function selector was not recognized and there\'s no fallback function');
            await expect(wrappedPool.connect(USER_1).withdrawNativeToken(amountInWei)).to.be.revertedWith('Transaction reverted: function selector was not recognized and there\'s no fallback function');

        }
    }

    async function erc20PoolActionsTests(pool: Contract, tokenContract: Contract, USER_1: any, USER_2: any) {
        const decimals = await tokenContract.decimals();

        //transfer
        let user1BalanceBeforeTransfer = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        let user2BalanceBeforeTransfer = formatUnits(await pool.balanceOf(USER_2.address), decimals);

        let transferredAmount = 0.1;
        let amountInWei = parseUnits(transferredAmount.toString(), decimals);
        await pool.connect(USER_1).transfer(USER_2.address, amountInWei);

        let user1BalanceAfterTransfer = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        let user2BalanceAfterTransfer = formatUnits(await pool.balanceOf(USER_2.address), decimals);

        expect(user1BalanceBeforeTransfer - user1BalanceAfterTransfer).to.be.closeTo(transferredAmount, 0.0001);
        expect(user2BalanceAfterTransfer - user2BalanceBeforeTransfer).to.be.closeTo(transferredAmount, 0.0001);

        //increaseAllowance
        let allowedAmount = 0.1;
        amountInWei = parseUnits(allowedAmount.toString(), decimals);

        let user2AllowanceBeforeIncrease = formatUnits(await pool.allowance(USER_1.address, USER_2.address), decimals);

        await pool.connect(USER_1).increaseAllowance(USER_2.address, amountInWei);

        let user2AllowanceAfterIncrease = formatUnits(await pool.allowance(USER_1.address, USER_2.address), decimals);

        expect(user2AllowanceAfterIncrease - user2AllowanceBeforeIncrease).to.be.closeTo(allowedAmount, 0.000001);

        //decreaseAllowance
        let decreasedAmount = 0.05;
        amountInWei = parseUnits(decreasedAmount.toString(), decimals);
        await pool.connect(USER_1).decreaseAllowance(USER_2.address, amountInWei);

        let user2AllowanceAfterDecrease = formatUnits(await pool.allowance(USER_1.address, USER_2.address), decimals);

        expect(user2AllowanceAfterIncrease - user2AllowanceAfterDecrease).to.be.closeTo(decreasedAmount, 0.000001);

        //approve
        let approveAmount = 0.037;
        let approveInWei = parseUnits(approveAmount.toString(), decimals);

        await pool.connect(USER_1).approve(USER_2.address, approveInWei);

        let user2AllowanceAfterApprove = formatUnits(await pool.allowance(USER_1.address, USER_2.address), decimals);
        expect(user2AllowanceAfterApprove).to.be.closeTo(approveAmount, 0.000001);


        //transferFrom (too high)
        let transferAmount = 0.038;
        let transferInWei = parseUnits(transferAmount.toString(), decimals);

        await expect(pool.connect(USER_2).transferFrom(USER_1.address, randomContractAddress, transferInWei))
            .to.be.revertedWith(`InsufficientAllowance(${transferInWei}, ${approveInWei})`);

        //transferFrom
        transferAmount = 0.068;
        transferInWei = parseUnits(transferAmount.toString(), decimals);

        user1BalanceBeforeTransfer = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        user2BalanceBeforeTransfer = formatUnits(await pool.balanceOf(USER_2.address), decimals);

        await pool.connect(USER_1).transfer(USER_2.address, transferInWei);

        user1BalanceAfterTransfer = formatUnits(await pool.balanceOf(USER_1.address), decimals);
        user2BalanceAfterTransfer = formatUnits(await pool.balanceOf(USER_2.address), decimals);

        expect(user1BalanceBeforeTransfer - user1BalanceAfterTransfer).to.be.closeTo(transferAmount, 0.0001);
        expect(user2BalanceAfterTransfer - user2BalanceBeforeTransfer).to.be.closeTo(transferAmount, 0.0001);
    }

    async function sendWavax(amount: Number, users: SignerWithAddress[]) {
        const decimals = await wavaxTokenContract.decimals();
        let amountInWei = parseUnits(amount.toString(), decimals);

        for (let user of users) {
            await wavaxTokenContract.connect(user).deposit({ value: amountInWei })
        }
    }

    async function sendUsdc(amountInAVAX: Number, users: SignerWithAddress[]) {
        let amountInWei = parseUnits(amountInAVAX.toString(), await wavaxTokenContract.decimals());

        let router = await ethers.getContractAt("IUniswapV2Router01", traderJoeRouter);

        for (let user of users) {
            await wavaxTokenContract.connect(user).deposit({ value: amountInWei });
            await wavaxTokenContract.connect(user).approve(router.address, amountInWei);

            await router.connect(user).swapExactTokensForTokens(amountInWei, 0, [wavaxTokenContract.address, usdcTokenContract.address], user.address, 1880333856);
        }
    }
});

