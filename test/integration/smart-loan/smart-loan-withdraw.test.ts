import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset, deployAllFaucets,
  deployAndInitPangolinExchangeContract, formatUnits,
  fromWei,
  getFixedGasSigners, PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  CompoundingIndex,
  ERC20Pool, MockSmartLoanLogicFacetRedstoneProvider, MockSmartLoanLogicFacetRedstoneProvider__factory,
  OpenBorrowersRegistry__factory,
  PangolinExchange, PoolManager, SmartLoanGigaChadInterface,
  SmartLoansFactory,
  VariableUtilisationRatesCalculator, YieldYakRouter__factory
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployDiamond, deployFacet, replaceFacet} = require('../../../tools/diamond/deploy-diamond');
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805A1EDcbA50c1Ce5db95118';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]

const wavaxAbi = [
  'function deposit() public payable',
  ...erc20ABI
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('A loan with closeLoan() and additional AVAX supplied', () => {
    let exchange: PangolinExchange,
        loan: SmartLoanGigaChadInterface,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
        pool: ERC20Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        wavaxTokenContract: Contract,
        usdTokenContract: Contract,
        yakRouterContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        solvencyFacetAddress: any,
        diamondAddress: any;

    before("deploy provider, exchange and pool", async () => {
      diamondAddress = await deployDiamond();
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      usdTokenDecimalPlaces = await usdTokenContract.decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;

      MOCK_PRICES = [
        {
          symbol: 'USD',
          value: USD_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        }
      ]

      await pool.initialize(
          variableUtilisationRatesCalculator.address,
          borrowersRegistry.address,
          depositIndex.address,
          borrowingIndex.address,
          wavaxTokenAddress
      );

      await wavaxTokenContract.connect(depositor).deposit({value: toWei("1000")});
      await wavaxTokenContract.connect(depositor).approve(pool.address, toWei("1000"));
      await pool.connect(depositor).deposit(toWei("1000"));

      let supportedAssets = [
        new Asset(toBytes32('AVAX'), wavaxTokenAddress),
        new Asset(toBytes32('USD'), usdTokenContract.address)
      ]

      let lendingPools = [
        new PoolAsset(toBytes32('AVAX'), pool.address)
      ]

      let poolManager = await deployContract(
          owner,
          PoolManagerArtifact,
          [
            supportedAssets,
            lendingPools
          ]
      ) as PoolManager;

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      // TODO: Check if it's possibl to avoid doulbe-recompilation
      await recompileSmartLoanLib(
          "SmartLoanLib",
          yakRouterContract.address,
          ethers.constants.AddressZero,
          poolManager.address,
          ethers.constants.AddressZero,
          'lib'
      );

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, supportedAssets);

      //TODO: Refactor syntax
      let result = await deployDiamond();
      diamondAddress = result.diamondAddress;
      solvencyFacetAddress = result.solvencyFacetAddress;

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      await recompileSmartLoanLib(
          "SmartLoanLib",
          yakRouterContract.address,
          exchange.address,
          poolManager.address,
          solvencyFacetAddress,
          'lib'
      );

      await deployAllFaucets(diamondAddress)

      await smartLoansFactory.initialize(diamondAddress);
    });

    it("should deploy a smart loan, fund, borrow and swap", async () => {
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

      await wavaxTokenContract.connect(owner).deposit({value: toWei("100")});
      await wavaxTokenContract.connect(owner).approve(wrappedLoan.address, toWei("100"));
      await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

      await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * AVAX_PRICE, 0.1);

      //TODO:  check why getFullLoanStatus does not work
      // console.log(fromWei(await wrappedLoan.getFullLoanStatus()))
      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * AVAX_PRICE, 0.1);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let usdAmount = 5000;
      let requiredAvaxAmount = USD_PRICE * usdAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.swapPangolin(
          toBytes32('AVAX'),
          toBytes32('USD'),
          toWei(requiredAvaxAmount.toString()),
          parseUnits(usdAmount.toString(), usdTokenDecimalPlaces)
      );
    });

    it('should not revert on 0 token withdrawal amount', async () => {
      await wrappedLoan.withdraw(toBytes32("USD"), 0);
    });

    it('should revert on a withdrawal amount being higher than the available balance', async () => {
      await expect(wrappedLoan.withdraw(toBytes32("USD"), parseUnits("200001", usdTokenDecimalPlaces))).to.be.revertedWith("There is not enough funds to withdraw");
    });

    it('should revert on a withdrawal resulting in an insolvent loan', async () => {
      await expect(wrappedLoan.withdraw(toBytes32("USD"), parseUnits("5000", usdTokenDecimalPlaces))).to.be.revertedWith("The action may cause an account to become insolvent");
    });

    it('should withdraw', async () => {
      let previousBalance = formatUnits(await usdTokenContract.balanceOf(owner.address), usdTokenDecimalPlaces);
      await wrappedLoan.withdraw(toBytes32("USD"), parseUnits("1", usdTokenDecimalPlaces));
      expect(await usdTokenContract.balanceOf(owner.address)).to.be.equal(parseUnits((previousBalance + 1).toString(), usdTokenDecimalPlaces))
    });
  });

});

