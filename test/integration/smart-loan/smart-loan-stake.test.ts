import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
  Asset,
  calculateStakingTokensAmountBasedOnAvaxValue,
  deployAllFaucets,
  deployAndInitializeLendingPool,
  fromWei,
  getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
  MockSmartLoanLogicFacetRedstoneProvider,
  PoolManager,
  RedstoneConfigManager__factory,
  SmartLoanGigaChadInterface,
  SmartLoansFactory,
  PangolinExchange,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

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
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('A loan with staking operations', () => {
    let smartLoansFactory: SmartLoansFactory,
      yakStakingContract: Contract,
      loan: SmartLoanGigaChadInterface,
      wrappedLoan: any,
      nonOwnerWrappedLoan: any,
      tokenContracts: any = {},
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      USD_PRICE: number,
      YYAV3SA1_PRICE: number,
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
        new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
        new Asset(toBytes32('YYAV3SA1'), TOKEN_ADDRESSES['YYAV3SA1']),
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


      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(diamondAddress);

      await recompileSmartLoanLib(
          "SmartLoanLib",
          [],
          poolManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );

      await deployAllFaucets(diamondAddress)
    });

    it("should deploy a smart loan", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

      AVAX_PRICE = (await redstone.getPrice('AVAX', {provider: "redstone-avalanche-prod-1"})).value;
      USD_PRICE = (await redstone.getPrice('USDC', {provider: "redstone-avalanche-prod-1"})).value;
      YYAV3SA1_PRICE = (await redstone.getPrice('YYAV3SA1', { provider: "redstone-avalanche-prod-1"})).value;

      MOCK_PRICES = [
        {
          symbol: 'USDC',
          value: USD_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'YYAV3SA1',
          value: YYAV3SA1_PRICE
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

      nonOwnerWrappedLoan = WrapperBuilder
          .mockLite(loan.connect(depositor))
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

    it("should fail to stake AVAX as a non-owner", async () => {
      await expect(nonOwnerWrappedLoan.stakeAVAXYak(toWei("9999"))).to.be.revertedWith("LibDiamond: Must be contract owner");
    });

    it("should fail to unstake AVAX as a non-owner", async () => {
      await expect(nonOwnerWrappedLoan.unstakeAVAXYak(toWei("9999"))).to.be.revertedWith("LibDiamond: Must be contract owner");
    });

    it("should fail to stake sAVAX as a non-owner", async () => {
      await expect(nonOwnerWrappedLoan.stakeSAVAXYak(toWei("9999"))).to.be.revertedWith("LibDiamond: Must be contract owner");
    });

    it("should fail to unstake sAVAX as a non-owner", async () => {
      await expect(nonOwnerWrappedLoan.unstakeSAVAXYak(toWei("9999"))).to.be.revertedWith("LibDiamond: Must be contract owner");
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
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(150 * AVAX_PRICE + fromWei(afterStakingStakedBalance) * YYAV3SA1_PRICE, 1);
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
      expect(fromWei(await tokenContracts['AVAX'].balanceOf(wrappedLoan.address))).to.be.closeTo(fromWei(initialAvaxBalance.add(amountAvaxToReceive)), 0.3);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);
    });

    it("should fail to unstake more than was initially staked", async() => {
      await expect(wrappedLoan.unstakeAVAXYak(toWei("999999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
    });
  });

  describe('A loan with staking liquidation', () => {
    let exchange: PangolinExchange,
        loan: SmartLoanGigaChadInterface,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
        wrappedLoanUpdated: any,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        liquidator: SignerWithAddress,
        tokenContracts: any = {},
        yakStakingContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        MOCK_PRICES: any,
        MOCK_PRICES_UPDATED: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        YYAV3SA1_PRICE: number;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor, liquidator] = await getFixedGasSigners(10000000);

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));

      let lendingPools = [];
      for (const token of [
        {'name': 'AVAX', 'airdropList': [depositor]}
      ]) {
        let {poolContract, tokenContract} = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
        await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
        await poolContract.connect(depositor).deposit(toWei("1000"));
        lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
        tokenContracts[token.name] = tokenContract;
      }
      tokenContracts['USDC'] =  new ethers.Contract(TOKEN_ADDRESSES['USDC'], wavaxAbi, provider);

      let supportedAssets = [
        new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
        new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
        new Asset(toBytes32('YYAV3SA1'), TOKEN_ADDRESSES['YYAV3SA1']),
      ]

      yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);
      usdTokenDecimalPlaces = await tokenContracts['USDC'].decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX', {provider: "redstone-avalanche-prod-1"})).value;
      USD_PRICE = (await redstone.getPrice('USDC', {provider: "redstone-avalanche-prod-1"})).value;
      YYAV3SA1_PRICE = (await redstone.getPrice('YYAV3SA1', { provider: "redstone-avalanche-prod-1"})).value;

      MOCK_PRICES = [
        {
          symbol: 'USDC',
          value: USD_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'YYAV3SA1',
          value: YYAV3SA1_PRICE
        }
      ]

      let poolManager = await deployContract(
          owner,
          PoolManagerArtifact,
          [
            supportedAssets,
            lendingPools
          ]
      ) as PoolManager;

      let diamondAddress = await deployDiamond();

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(diamondAddress);

      await recompileSmartLoanLib(
          "SmartLoanLib",
          [],
          poolManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );

      let exchangeFactory = await ethers.getContractFactory("PangolinExchange");
      exchange = (await exchangeFactory.deploy()).connect(owner) as PangolinExchange;
      await exchange.initialize(pangolinRouterAddress, supportedAssets);

      await recompileSmartLoanLib(
          "SmartLoanLib",
          [
            {
              facetPath: './contracts/faucets/PangolinDEXFacet.sol',
              contractAddress: exchange.address,
            }
          ],
          poolManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );

      await deployAllFaucets(diamondAddress)
    });

    it("should deploy a smart loan, fund, borrow and invest", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      await tokenContracts['AVAX'].connect(owner).deposit({value: toWei("100")});
      await tokenContracts['AVAX'].connect(owner).approve(wrappedLoan.address, toWei("100"));
      await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
      await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * AVAX_PRICE, 0.1);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * AVAX_PRICE, 0.1);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;

      let usdAmount = Math.floor(30 * AVAX_PRICE);
      let requiredAvaxAmount = USD_PRICE * usdAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.swapPangolin(
          toBytes32('AVAX'),
          toBytes32('USDC'),
          toWei(requiredAvaxAmount.toString()),
          parseUnits(usdAmount.toString(), usdTokenDecimalPlaces),
      );

      await wrappedLoan.stakeAVAXYak(
          toWei("305")
      );
    });

    it("should withdraw collateral and part of borrowed funds, bring prices back to normal and liquidate the loan by supplying additional AVAX", async () => {
      // Define "updated" (USDC x 1000) prices and build an updated wrapped loan
      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDC')).value;
      MOCK_PRICES_UPDATED = [
        {
          symbol: 'USDC',
          value: USD_PRICE * 1000
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'YYAV3SA1',
          value: YYAV3SA1_PRICE
        }
      ]

      wrappedLoanUpdated = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES_UPDATED,
                  timestamp: Date.now()
                }
              })

      // Withdraw funds using the updated prices and make sure the "standard" wrappedLoan is Insolvent as a consequence
      expect(await wrappedLoan.isSolvent()).to.be.true;
      await wrappedLoanUpdated.withdraw(toBytes32("AVAX"), toWei("60"));
      expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
      expect(await wrappedLoan.isSolvent()).to.be.false;


      let wrappedLoanLiquidator = WrapperBuilder
          .mockLite(loan.connect(liquidator))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

      let allowance = toWei("150");
      await tokenContracts['AVAX'].connect(liquidator).approve(wrappedLoan.address, allowance);
      await tokenContracts['AVAX'].connect(liquidator).deposit({value: allowance});

      await wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("150")], 50);
      let currentStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

      expect(fromWei(initialStakedBalance)).to.be.greaterThan(fromWei(currentStakedBalance));
      expect(fromWei(currentStakedBalance)).to.be.greaterThan(0);
      expect(await wrappedLoan.isSolvent()).to.be.true;
    });
  });
});

