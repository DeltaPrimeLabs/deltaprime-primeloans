// import chai, {expect} from 'chai'
// import {ethers, waffle} from 'hardhat'
// import {solidity} from "ethereum-waffle";
// import {
//     PoolManager,
//     RedstoneConfigManager__factory,
//     SmartLoanGigaChadInterface,
//     SmartLoansFactory
// } from "../../../typechain";
// import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
// import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
// import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
// import {
//     Asset,
//     calculateStakingTokensAmountBasedOnAvaxValue, deployAllFaucets,
//     fromWei,
//     getFixedGasSigners, recompileSmartLoanLib,
//     toBytes32,
//     toWei
// } from "../../_helpers";
// import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
// const {deployContract} = waffle;
// import {BigNumber, Contract} from "ethers";
// import TOKEN_ADDRESSES from "../../../common/token_addresses.json";
// import redstone from "redstone-api";
// import {WrapperBuilder} from "redstone-evm-connector";
// chai.use(solidity);
// const {provider} = waffle;
// const yakStakingTokenAddress = "0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95";
// const erc20ABI = [
//     'function decimals() public view returns (uint8)',
//     'function balanceOf(address _owner) public view returns (uint256 balance)',
//     'function approve(address _spender, uint256 _value) public returns (bool success)',
//     'function allowance(address owner, address spender) public view returns (uint256)',
//     'function totalSupply() external view returns (uint256)',
//     'function totalDeposits() external view returns (uint256)'
// ]
//
// const wavaxAbi = [
//     'function deposit() public payable',
//     ...erc20ABI
// ]
//
// describe('Yield Yak test', () => {
//     let smartLoansFactory: SmartLoansFactory,
//         loan: SmartLoanGigaChadInterface,
//         wrappedLoan: any,
//         user: SignerWithAddress,
//         owner: SignerWithAddress,
//         MOCK_PRICES: any,
//         AVAX_PRICE: number,
//         $YYAV3SA1_PRICE: number,
//         yakStakingContract: Contract,
//         avaxTokenContract: Contract;
//
//     before(async() => {
//         [user, owner] = await getFixedGasSigners(10000000);
//         yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);
//         let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));
//         let supportedAssets = [
//             new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
//             new Asset(toBytes32('$YYAV3SA1'), TOKEN_ADDRESSES['$YYAV3SA1']),
//         ]
//         let poolManager = await deployContract(
//             owner,
//             PoolManagerArtifact,
//             [
//                 supportedAssets,
//                 []
//             ]
//         ) as PoolManager;
//
//         let diamondAddress = await deployDiamond();
//
//         smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
//         await smartLoansFactory.initialize(diamondAddress);
//
//         await recompileSmartLoanLib(
//             "SmartLoanLib",
//             ethers.constants.AddressZero,
//             poolManager.address,
//             redstoneConfigManager.address,
//             diamondAddress,
//             'lib'
//         );
//         await deployAllFaucets(diamondAddress)
//
//         AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
//         $YYAV3SA1_PRICE = (await redstone.getPrice('$YYAV3SA1', { provider: "redstone-avalanche-prod-node-3"})).value;
//         console.log(`----x----> $YYAV3SA1_PRICE: ${$YYAV3SA1_PRICE}`);
//
//         MOCK_PRICES = [
//             {
//                 symbol: 'AVAX',
//                 value: AVAX_PRICE
//             },
//             {
//                 symbol: '$YYAV3SA1',
//                 value: $YYAV3SA1_PRICE
//             },
//         ];
//
//         await smartLoansFactory.connect(user).createLoan();
//
//         const loan_proxy_address = await smartLoansFactory.getLoanForOwner(user.address);
//         loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, user);
//
//         wrappedLoan = WrapperBuilder
//             .mockLite(loan)
//             .using(
//                 () => {
//                     return {
//                         prices: MOCK_PRICES,
//                         timestamp: Date.now()
//                     }
//                 })
//
//         avaxTokenContract = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
//         await avaxTokenContract.connect(user).deposit({value: toWei('1000')});
//         await avaxTokenContract.connect(user).approve(loan.address, toWei('1000'));
//         await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
//     })
//
//     it("should calculate total value of 0 staked tokens", async () => {
//         let stakedAvaxValue = await wrappedLoan.getTotalStakedValue();
//         expect(fromWei(stakedAvaxValue)).to.be.equal(0)
//     });
//
//     it("should successfully stake AVAX with YieldYak", async () => {
//         let initialAvaxBalance = BigNumber.from(await avaxTokenContract.balanceOf(wrappedLoan.address));
//         let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
//         let investedAvaxAmount = BigNumber.from(toWei("10"));
//
//         expect(initialStakedBalance).to.be.equal(0);
//         expect(fromWei(initialAvaxBalance)).to.be.greaterThan(0);
//
//         await wrappedLoan.stakeAVAXYak(investedAvaxAmount);
//
//         let expectedAfterStakingStakedBalance = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, investedAvaxAmount);
//
//         let afterStakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
//         let avaxBalanceDifference = initialAvaxBalance.sub(await avaxTokenContract.balanceOf(wrappedLoan.address));
//
//         expect(afterStakingStakedBalance).to.be.equal(expectedAfterStakingStakedBalance);
//         expect(fromWei(avaxBalanceDifference)).to.be.closeTo(10, 1);
//     });
//
//     it("should calculate total value of staked tokens", async () => {
//         let stakedAvaxValue = await wrappedLoan.getTotalStakedValue();
//         expect(fromWei(stakedAvaxValue)).to.be.equal(10 )
//     });
//
//
//     it("should unstake remaining AVAX", async () => {
//         let initialAvaxBalance = BigNumber.from(await avaxTokenContract.balanceOf(wrappedLoan.address));
//         let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
//
//         await yakStakingContract.connect(user).approve(wrappedLoan.address, initialStakedBalance)
//         await wrappedLoan.unstakeAVAXYak(initialStakedBalance);
//
//         let afterUntakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
//         let avaxBalanceDifference = (await avaxTokenContract.balanceOf(wrappedLoan.address)).sub(initialAvaxBalance);
//
//         expect(afterUntakingStakedBalance).to.be.equal(0);
//         expect(fromWei(avaxBalanceDifference)).to.be.closeTo(10, 0.5);
//     });
//
// });