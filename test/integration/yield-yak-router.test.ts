import chai, {expect} from 'chai'
import {ethers, waffle} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {
    YieldYakRouter,
    YieldYakRouter__factory,
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {calculateStakingTokensAmountBasedOnAvaxValue, fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {BigNumber, Contract} from "ethers";
chai.use(solidity);
const {provider} = waffle;
const yakStakingTokenAddress = "0x957Ca4a4aA7CDc866cf430bb140753F04e273bC0";
const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function totalDeposits() external view returns (uint256)'
]

describe('Yield Yak test', () => {
    let yakRouterContract: YieldYakRouter,
        user: SignerWithAddress,
        yakStakingContract: Contract;

    before(async() => {
        [user] = await getFixedGasSigners(10000000);
        yakRouterContract = await (new YieldYakRouter__factory(user).deploy());
        yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);
    })

    it("should calculate total value of 0 staked tokens", async () => {
        let stakedAvaxValue = await yakRouterContract.connect(user).getTotalStakedValue();
        expect(fromWei(stakedAvaxValue)).to.be.equal(0)
    });

    it("should successfully stake AVAX with YieldYak", async () => {
        let initialAvaxBalance = BigNumber.from(await provider.getBalance(user.address));
        let initialStakedBalance = await yakStakingContract.balanceOf(user.address);
        let investedAvaxAmount = BigNumber.from(toWei("10"));

        expect(initialStakedBalance).to.be.equal(0);
        expect(fromWei(initialAvaxBalance)).to.be.greaterThan(0);

        await yakRouterContract.connect(user).stakeAVAX(investedAvaxAmount, {value: investedAvaxAmount});

        let expectedAfterStakingStakedBalance = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, investedAvaxAmount);

        let afterStakingStakedBalance = await yakStakingContract.balanceOf(user.address);
        let avaxBalanceDifference = initialAvaxBalance.sub(await provider.getBalance(user.address));

        expect(afterStakingStakedBalance).to.be.equal(expectedAfterStakingStakedBalance);
        expect(fromWei(avaxBalanceDifference)).to.be.closeTo(10, 1);
    });

    it("should calculate total value of staked tokens", async () => {
        let stakedAvaxValue = await yakRouterContract.connect(user).getTotalStakedValue();
        expect(fromWei(stakedAvaxValue)).to.be.equal(10)
    });

    it("should unstake tokens worth a specified AVAX amount", async () => {
        let initialAvaxBalance = BigNumber.from(await provider.getBalance(user.address));
        let initialStakedBalance = await yakStakingContract.balanceOf(user.address);
        let redeemedAvaxValue = BigNumber.from(toWei("5"));
        let expectedTokensToUnstakeAmount = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, redeemedAvaxValue);

        await yakStakingContract.connect(user).approve(yakRouterContract.address, initialStakedBalance)
        await yakRouterContract.connect(user).unstakeAVAXForASpecifiedAmount(redeemedAvaxValue);
        let expectedAfterUnstakingStakedBalance = initialStakedBalance.sub(expectedTokensToUnstakeAmount);

        let afterUntakingStakedBalance = await yakStakingContract.balanceOf(user.address);
        let avaxBalanceDifference = (await provider.getBalance(user.address)).sub(initialAvaxBalance);

        expect(fromWei(afterUntakingStakedBalance)).to.be.closeTo(fromWei(expectedAfterUnstakingStakedBalance), 1e-5);
        expect(fromWei(avaxBalanceDifference)).to.be.closeTo(5, 0.5);
    });

    it("should unstake remaining AVAX", async () => {
        let initialAvaxBalance = BigNumber.from(await provider.getBalance(user.address));
        let initialStakedBalance = await yakStakingContract.balanceOf(user.address);

        await yakStakingContract.connect(user).approve(yakRouterContract.address, initialStakedBalance)
        await yakRouterContract.connect(user).unstakeAVAX(initialStakedBalance);

        let afterUntakingStakedBalance = await yakStakingContract.balanceOf(user.address);
        let avaxBalanceDifference = (await provider.getBalance(user.address)).sub(initialAvaxBalance);

        expect(afterUntakingStakedBalance).to.be.equal(0);
        expect(fromWei(avaxBalanceDifference)).to.be.closeTo(5, 0.5);
    });

    it("should stake some AVAX then unstake all using unstakeAVAXForASpecifiedAmount with amount greater than stakedBalance", async () => {
        let initialAvaxBalance = BigNumber.from(await provider.getBalance(user.address));
        let investedAvaxAmount = BigNumber.from(toWei("10"));

        await yakRouterContract.connect(user).stakeAVAX(investedAvaxAmount, {value: investedAvaxAmount});
        let stakedBalance = await yakStakingContract.balanceOf(user.address);

        await yakStakingContract.connect(user).approve(yakRouterContract.address, stakedBalance)
        await yakRouterContract.connect(user).unstakeAVAXForASpecifiedAmount(toWei("99999"));

        expect(await yakStakingContract.balanceOf(user.address)).to.be.equal(0);
        // Lets see if this will cause this test to be flaky based on the state of freshly forked mainnet
        // I do have suspicions that sometimes the gas usage for stake/unstake may be visibly higher based on the execution path in YAK contract.
        expect(fromWei(initialAvaxBalance)).to.be.closeTo(fromWei(await provider.getBalance(user.address)), 0.1);
    });

});