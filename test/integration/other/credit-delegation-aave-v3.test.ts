import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {deployAndInitializeLendingPool, getFixedGasSigners, toWei} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {Contract} from "ethers";
import TOKEN_ADDRESSES from "../../../common/token_addresses.json";

chai.use(solidity);

const AAVE_POOL_V3 = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
const sAVAX_AAVE_V3 = '0x4a1c3aD6Ed28a636ee1751C69071f6be75DEb8B8';

const aavePoolV3Abi = [
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
    'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
]

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

const sAvaxV3Abi = [
    'function approveDelegation(address delegatee, uint256 amount)',
    ...erc20ABI
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

const {provider} = waffle;


describe('Pool with funds borrowed through AAVE credit delegation',  () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe('A loan with debt and repayment', () => {
        let owner: SignerWithAddress,
            delegator: SignerWithAddress,
            testBorrower: SignerWithAddress, //remove
            aavePoolV3: Contract,
            wavaxToken: Contract,
            poolContract: Contract,
            tokenContract: Contract;

        before("deploy factory, wavaxPool and usdPool", async () => {
            [owner, delegator, testBorrower] = await getFixedGasSigners(10000000);

            ({ poolContract, tokenContract } = await deployAndInitializeLendingPool(owner, 'AVAX', [delegator]));
            // await tokenContract!.connect(delegator).approve(poolContract.address, toWei("1000"));

            wavaxToken = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
        });


        it("should deposit AVAX to AAVE and delegate", async () => {
            aavePoolV3 = await new ethers.Contract(AAVE_POOL_V3, aavePoolV3Abi);

            await wavaxToken.connect(delegator).deposit({value: toWei("1000")});
            await wavaxToken.connect(delegator).approve(aavePoolV3.address, toWei("1000"));
            await aavePoolV3.connect(delegator).supply(TOKEN_ADDRESSES['AVAX'], toWei("1000"), delegator.address, 0);

            console.log(delegator.address);

            const sAvaxV3 = await new ethers.Contract(sAVAX_AAVE_V3, sAvaxV3Abi);
            await sAvaxV3.connect(delegator).approveDelegation(poolContract.address, toWei("500"));
        });

        it("should borrow AVAX to AAVE on behalf of delegator", async () => {
            expect(await wavaxToken.connect(delegator).balanceOf(poolContract.address)).to.be.equal(toWei("0"));

            await poolContract.connect(owner).borrowFromAaveV3(toWei("500"), delegator.address);

            expect(await wavaxToken.connect(delegator).balanceOf(poolContract.address)).to.be.equal(toWei("500"));
        });

        it("should repay AVAX to AAVE", async () => {
            expect(await wavaxToken.connect(delegator).balanceOf(poolContract.address)).to.be.equal(toWei("500"));

            await poolContract.connect(owner).repayToAaveV3(toWei("500"), delegator.address);

            expect(await wavaxToken.connect(delegator).balanceOf(poolContract.address)).to.be.equal(toWei("0"));
        });
    });
});

