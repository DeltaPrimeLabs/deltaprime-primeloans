import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/token_addresses.json';
import {
  Asset,
  calculateStakingTokensAmountBasedOnAvaxValue,
  deployAllFaucets, deployAndInitializeLendingPool,
  fromWei,
  getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  RedstoneConfigManager__factory,
  MockSmartLoanLogicFacetRedstoneProvider,
  PoolManager,
  SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond, deployFacet} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;
const yakStakingTokenAddress = "0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95";

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function totalDeposits() external view returns (uint256)'
]

const wavaxAbi = [
  'function deposit() public payable',
  ...erc20ABI
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('A loan with staking operations', () => {
    let smartLoansFactory: SmartLoansFactory,
      yakStakingContract: Contract,
      loan: MockSmartLoanLogicFacetRedstoneProvider,
      wrappedLoan: any,
      tokenContracts: any = {},
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      USD_PRICE: number,
      $YYAV3SA1_PRICE: number,
      diamondAddress: any;

    before("deploy factory and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));

      let lendingPools = [];
      // TODO: Possibly further extract the body of this for loop into a separate function shared among test suits
      for (const token of [
        {'name': 'AVAX', 'airdropList': [depositor]}
      ]) {
        let {poolContract, tokenContract} = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
        await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
        await poolContract.connect(depositor).deposit(toWei("1000"));
        lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
        tokenContracts[token.name] = tokenContract;
      }

      let supportedAssets = [
        new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
        new Asset(toBytes32('USD'), TOKEN_ADDRESSES['USDC']),
        new Asset(toBytes32('$YYAV3SA1'), TOKEN_ADDRESSES['$YYAV3SA1']),
      ]

      let poolManager = await deployContract(
          owner,
          PoolManagerArtifact,
          [
            supportedAssets,
            lendingPools
          ]
      ) as PoolManager;

      yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);

      diamondAddress = await deployDiamond();
      await recompileSmartLoanLib(
          "SmartLoanLib",
          ethers.constants.AddressZero,
          poolManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          'lib'
      );

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      await deployAllFaucets(diamondAddress)

      await smartLoansFactory.initialize(diamondAddress);
    });

    it("should deploy a smart loan", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

      AVAX_PRICE = (await redstone.getPrice('AVAX', {provider: "redstone-avalanche-prod-node-3"})).value;
      USD_PRICE = (await redstone.getPrice('USDC', {provider: "redstone-avalanche-prod-node-3"})).value;
      $YYAV3SA1_PRICE = (await redstone.getPrice('$YYAV3SA1', { provider: "redstone-avalanche-prod-node-3"})).value;

      MOCK_PRICES = [
        {
          symbol: 'USD',
          value: USD_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: '$YYAV3SA1',
          value: $YYAV3SA1_PRICE
        }
      ]

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

      await tokenContracts['AVAX'].connect(owner).deposit({value: toWei("200")});
      await tokenContracts['AVAX'].connect(owner).approve(wrappedLoan.address, toWei("200"));
      await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * AVAX_PRICE, 0.0001);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should stake", async () => {
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * AVAX_PRICE, 0.0001);

      let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
      expect(initialStakedBalance).to.be.equal(0);

      await expect(wrappedLoan.stakeAVAXYak(toWei("9999"),{gasLimit: 8000000})).to.be.revertedWith("Not enough AVAX available");

      const stakedAvaxAmount = 50;

      await wrappedLoan.stakeAVAXYak(
          toWei(stakedAvaxAmount.toString())
      );

      let afterStakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
      let expectedAfterStakingStakedBalance = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, toWei(stakedAvaxAmount.toString()));

      expect(afterStakingStakedBalance).to.be.equal(expectedAfterStakingStakedBalance);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * AVAX_PRICE, 1);
    });

    it("should unstake part of staked AVAX", async() => {
      let initialTotalValue = await wrappedLoan.getTotalValue();
      let initialAvaxBalance = await tokenContracts['AVAX'].balanceOf(wrappedLoan.address);
      let amountAvaxToReceive = toWei("10");
      let initialStakedTokensBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
      let tokenAmountToUnstake = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, amountAvaxToReceive);

      let expectedAfterUnstakeTokenBalance = initialStakedTokensBalance.sub(tokenAmountToUnstake);

      await wrappedLoan.unstakeAVAXYak(tokenAmountToUnstake);

      expect(expectedAfterUnstakeTokenBalance).to.be.equal(await yakStakingContract.balanceOf(wrappedLoan.address));
      expect(fromWei(await tokenContracts['AVAX'].balanceOf(wrappedLoan.address))).to.be.closeTo(fromWei(initialAvaxBalance.add(amountAvaxToReceive)), 0.2);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);
    });

    it("should fail to unstake more than was initially staked", async() => {
      await expect(wrappedLoan.unstakeAVAXYak(toWei("999999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
    });
  });

  // describe('A loan with staking liquidation', () => {
  //   let exchange: PangolinExchange,
  //       loan: MockSmartLoanLogicFacetRedstoneProvider,
  //       smartLoansFactory: SmartLoansFactory,
  //       loanLiquidation: MockSmartLoanLiquidationFacetRedstoneProvider,
  //       wrappedLoan: any,
  //       wrappedLoanUpdated: any,
  //       yakRouterContract: Contract,
  //       pool: WavaxPool,
  //       owner: SignerWithAddress,
  //       depositor: SignerWithAddress,
  //       liquidator: SignerWithAddress,
  //       usdTokenContract: Contract,
  //       wavaxTokenContract: Contract,
  //       yakStakingContract: Contract,
  //       usdTokenDecimalPlaces: BigNumber,
  //       MOCK_PRICES: any,
  //       MOCK_PRICES_UPDATED: any,
  //       AVAX_PRICE: number,
  //       USD_PRICE: number,
  //       solvencyFacetAddress: any,
  //       diamondAddress: any;
  //
  //   before("deploy provider, exchange and pool", async () => {
  //     diamondAddress = await deployDiamond();
  //     [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
  //
  //     const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
  //     pool = (await deployContract(owner, WavaxPoolArtifact)) as WavaxPool;
  //     yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);
  //     yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
  //     usdTokenContract = new ethers.Contract(TOKEN_ADDRESSES['USDT'], erc20ABI, provider);
  //     wavaxTokenContract = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);
  //
  //     const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
  //     const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
  //     const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
  //
  //     usdTokenDecimalPlaces = await usdTokenContract.decimals();
  //
  //     AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
  //     USD_PRICE = (await redstone.getPrice('USDT')).value;
  //
  //     MOCK_PRICES = [
  //       {
  //         symbol: 'USD',
  //         value: USD_PRICE
  //       },
  //       {
  //         symbol: 'AVAX',
  //         value: AVAX_PRICE
  //       }
  //     ]
  //
  //     await pool.initialize(
  //         variableUtilisationRatesCalculator.address,
  //         borrowersRegistry.address,
  //         depositIndex.address,
  //         borrowingIndex.address,
  //         TOKEN_ADDRESSES['AVAX']
  //     );
  //
  //     await pool.connect(depositor).depositNativeToken({value: toWei("1000")});
  //
  //     let supportedAssets = [
  //       new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
  //       new Asset(toBytes32('USD'), usdTokenContract.address)
  //     ]
  //
  //     let lendingPools = [
  //       new PoolAsset(toBytes32('AVAX'), pool.address)
  //     ]
  //
  //     let poolManager = await deployContract(
  //         owner,
  //         PoolManagerArtifact,
  //         [
  //           supportedAssets,
  //           lendingPools
  //         ]
  //     ) as PoolManager;
  //
  //     smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
  //
  //     // TODO: Check if it's possibl to avoid doulbe-recompilation
  //     await recompileSmartLoanLib(
  //         "SmartLoanLib",
  //         yakRouterContract.address,
  //         ethers.constants.AddressZero,
  //         poolManager.address,
  //         ethers.constants.AddressZero,
  //         'lib'
  //     );
  //
  //     exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, supportedAssets);
  //
  //     //TODO: Refactor syntax
  //     let result = await deployDiamond();
  //     diamondAddress = result.diamondAddress;
  //     solvencyFacetAddress = result.solvencyFacetAddress;
  //
  //     smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
  //
  //     await recompileSmartLoanLib(
  //         "SmartLoanLib",
  //         yakRouterContract.address,
  //         exchange.address,
  //         poolManager.address,
  //         solvencyFacetAddress,
  //         'lib'
  //     );
  //
  //     await deployAllFaucets(diamondAddress)
  //
  //     await smartLoansFactory.initialize(diamondAddress);
  //   });
  //
  //   it("should deploy a smart loan, fund, borrow and invest", async () => {
  //     await smartLoansFactory.connect(owner).createLoan();
  //
  //     const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
  //
  //     loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);
  //
  //     wrappedLoan = WrapperBuilder
  //         .mockLite(loan)
  //         .using(
  //             () => {
  //               return {
  //                 prices: MOCK_PRICES,
  //                 timestamp: Date.now()
  //               }
  //             })
  //
  //     await wavaxTokenContract.connect(owner).deposit({value: toWei("100")});
  //     await wavaxTokenContract.connect(owner).approve(wrappedLoan.address, toWei("100"));
  //     await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
  //     await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));
  //
  //     expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * AVAX_PRICE, 0.1);
  //     expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * AVAX_PRICE, 0.1);
  //     expect(await wrappedLoan.getLTV()).to.be.equal(3000);
  //
  //     const slippageTolerance = 0.03;
  //
  //     let usdAmount = Math.floor(30 * AVAX_PRICE);
  //     let requiredAvaxAmount = USD_PRICE * usdAmount * (1 + slippageTolerance) / AVAX_PRICE;
  //
  //     await wrappedLoan.swapPangolin(
  //         toBytes32('AVAX'),
  //         toBytes32('USD'),
  //         toWei(requiredAvaxAmount.toString()),
  //         parseUnits(usdAmount.toString(), usdTokenDecimalPlaces),
  //     );
  //
  //     await wrappedLoan.stakeAVAXYak(
  //         toWei("305")
  //     );
  //   });
  //
  //   it("should withdraw collateral and part of borrowed funds, bring prices back to normal and liquidate the loan by supplying additional AVAX", async () => {
  //     // Define "updated" (USD x 1000) prices and build an updated wrapped loan
  //     AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
  //     USD_PRICE = (await redstone.getPrice('USDT')).value;
  //     MOCK_PRICES_UPDATED = [
  //       {
  //         symbol: 'USD',
  //         value: USD_PRICE * 1000
  //       },
  //       {
  //         symbol: 'AVAX',
  //         value: AVAX_PRICE
  //       }
  //     ]
  //
  //     wrappedLoanUpdated = WrapperBuilder
  //         .mockLite(loan)
  //         .using(
  //             () => {
  //               return {
  //                 prices: MOCK_PRICES_UPDATED,
  //                 timestamp: Date.now()
  //               }
  //             })
  //
  //     // Withdraw funds using the updated prices and make sure the "standard" wrappedLoan is Insolvent as a consequence
  //     expect(await wrappedLoan.isSolvent()).to.be.true;
  //     await wrappedLoanUpdated.withdraw(toBytes32("AVAX"), toWei("60"));
  //     expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
  //     expect(await wrappedLoan.isSolvent()).to.be.false;
  //
  //     const loanFactory = await ethers.getContractFactory("MockSmartLoanLiquidationFacetRedstoneProvider");
  //     const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
  //     loanLiquidation = await loanFactory.attach(loan_proxy_address).connect(owner) as MockSmartLoanLiquidationFacetRedstoneProvider;
  //
  //     let wrappedLoanLiquidator = WrapperBuilder
  //         .mockLite(loanLiquidation.connect(liquidator))
  //         .using(
  //             () => {
  //               return {
  //                 prices: MOCK_PRICES,
  //                 timestamp: Date.now()
  //               }
  //             })
  //
  //     let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
  //
  //     let allowance = toWei("150");
  //     await wavaxTokenContract.connect(liquidator).approve(wrappedLoan.address, allowance);
  //     await wavaxTokenContract.connect(liquidator).deposit({value: allowance});
  //
  //     await wrappedLoanLiquidator.liquidateLoan([toWei("150")], 50);
  //     let currentStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
  //
  //     expect(fromWei(initialStakedBalance)).to.be.greaterThan(fromWei(currentStakedBalance));
  //     expect(fromWei(currentStakedBalance)).to.be.greaterThan(0);
  //     expect(await wrappedLoan.isSolvent()).to.be.true;
  //   });
  // });
});

