
import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockUsdArtifact from "../../../artifacts/contracts/mock/MockUsd.sol/MockUsd.json";
import MockSmartLoanArtifact from '../../../artifacts/contracts/mock/MockSmartLoan.sol/MockSmartLoan.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset,
  deployAndInitPangolinExchangeContract,
  formatUnits,
  fromWei,
  getFixedGasSigners,
  recompileSmartLoan,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  CompoundingIndex,
  ERC20Pool,
  MockSmartLoanRedstoneProvider,
  MockUsd,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  SmartLoan,
  SmartLoansFactory,
  VariableUtilisationRatesCalculator, YieldYakRouter__factory
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const ethTokenAddress = '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

const SMART_LOAN_MOCK = "MockSmartLoanRedstoneProvider";
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

  describe('A loan without debt', () => {
    let exchange: PangolinExchange,
      smartLoansFactory: SmartLoansFactory,
      implementation: SmartLoan,
      loan: MockSmartLoanRedstoneProvider,
      wrappedLoan: any,
      mockUsdToken: MockUsd,
      wavaxTokenContract: Contract,
      ethTokenContract: Contract,
      yakRouterContract: Contract,
      wavaxPool: ERC20Pool,
      usdPool: ERC20Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      usdTokenDecimalPlaces: BigNumber,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      USD_PRICE: number,
      ETH_PRICE: number,
      artifact: any;

    before("deploy factory, exchange, wavaxPool and usdPool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const variableUtilisationRatesCalculatorERC20 = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      wavaxPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);
      ethTokenContract = new ethers.Contract(ethTokenAddress, wavaxAbi, provider);
      mockUsdToken = (await deployContract(owner, MockUsdArtifact, [[owner.address, depositor.address]])) as MockUsd;
      usdTokenDecimalPlaces = BigNumber.from(await mockUsdToken.decimals());

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;

      const borrowersRegistryERC20 = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndexERC20 = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;
      const borrowingIndexERC20 = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      ETH_PRICE = (await redstone.getPrice('ETH')).value;

      MOCK_PRICES = [
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'USD',
          value: USD_PRICE
        },
        {
          symbol: 'ETH',
          value: ETH_PRICE
        }
      ];

      await wavaxPool.initialize(
        variableUtilisationRatesCalculatorERC20.address,
        borrowersRegistryERC20.address,
        depositIndexERC20.address,
        borrowingIndexERC20.address,
        wavaxTokenContract.address
      );

      await wavaxTokenContract.connect(depositor).deposit({value: toWei("1000")});
      await wavaxTokenContract.connect(depositor).approve(wavaxPool.address, toWei("1000"));
      await wavaxPool.connect(depositor).deposit(toWei("1000"));

      await usdPool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address,
        mockUsdToken.address
      );

      await mockUsdToken.connect(depositor).approve(usdPool.address, parseUnits("1000", usdTokenDecimalPlaces));
      await usdPool.connect(depositor).deposit(parseUnits("1000", usdTokenDecimalPlaces));

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
        new Asset(toBytes32('AVAX'), wavaxTokenAddress),
        new Asset(toBytes32('USD'), mockUsdToken.address),
        new Asset(toBytes32('ETH'), ethTokenAddress),
      ]);

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      artifact = await recompileSmartLoan(
        SMART_LOAN_MOCK,
        [1],
        [mockUsdToken.address],
        { "USD": usdPool.address} ,
        exchange.address,
        yakRouterContract.address,
        'mock'
      );
      implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);
    });

    it("should deploy a smart loan", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = ((await new ethers.Contract(loanAddress, MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(owner);

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

      expect(fromWei(await mockUsdToken.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.1);

      await mockUsdToken.connect(owner).approve(wrappedLoan.address, parseUnits("1000", usdTokenDecimalPlaces));
      await wrappedLoan.fund(toBytes32("USD"), parseUnits("1000", usdTokenDecimalPlaces));

      expect(formatUnits(await mockUsdToken.connect(owner).balanceOf(wrappedLoan.address), usdTokenDecimalPlaces)).to.be.closeTo(1000, 0.1);

      wavaxTokenContract.connect(owner).deposit({value: toWei("1000")});
      await wavaxTokenContract.connect(owner).approve(wrappedLoan.address, toWei("1000"));

      expect(fromWei(await wavaxTokenContract.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.1);

      await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

      expect(fromWei(await wavaxTokenContract.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100, 0.1);

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(AVAX_PRICE * 100 + 1000, 2);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should withdraw part of funds", async () => {
      expect(formatUnits(await mockUsdToken.connect(owner).balanceOf(wrappedLoan.address), usdTokenDecimalPlaces)).to.be.closeTo(1000, 0.1);

      await wrappedLoan.withdraw(toBytes32("USD"), parseUnits("100", usdTokenDecimalPlaces));

      expect(formatUnits(await mockUsdToken.connect(owner).balanceOf(wrappedLoan.address), usdTokenDecimalPlaces)).to.be.closeTo(900, 0.1);

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(AVAX_PRICE * 100 + 900, 2);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should buy an asset from funded", async () => {
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(AVAX_PRICE * 100 + 900, 2);
      const expectedEthAmount = 1;

      const slippageTolerance = 0.03;
      const requiredAvaxAmount = ETH_PRICE * expectedEthAmount * (1 + slippageTolerance) / AVAX_PRICE;

      expect(fromWei(await wavaxTokenContract.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100, 0.1);

      await wrappedLoan.swap(
        toBytes32('AVAX'),
        toBytes32('ETH'),
        toWei(requiredAvaxAmount.toString()),
        toWei(expectedEthAmount.toString())
      );

      expect(fromWei(await wavaxTokenContract.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100 - requiredAvaxAmount, 0.1);
      expect(fromWei((await wrappedLoan.getAllAssetsBalances())[0])).to.be.closeTo(100 - requiredAvaxAmount, 0.05);
      expect(fromWei(await ethTokenContract.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(1, 0.05);
      expect(fromWei((await wrappedLoan.getAllAssetsBalances())[2])).to.be.closeTo(1, 0.05);

      // total value should stay similar to before swap
      // big delta of 80 because of slippage
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(AVAX_PRICE * 100 + 900, 80);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should revert with Avax price returned from oracle is zero", async () => {
      let wrappedLoanWithoutPrices = WrapperBuilder
        .mockLite(loan)
        .using(
        () => {
          return {
            prices: [],
            timestamp: Date.now()
          }
        })
      await expect(wrappedLoanWithoutPrices.getTotalValue()).to.be.revertedWith("Asset price returned from oracle is zero'");
    });

    it("should provide assets balances and prices", async () => {
      const usdTokenBalance = (await wrappedLoan.getAllAssetsBalances())[1];
      expect(formatUnits(usdTokenBalance, usdTokenDecimalPlaces)).to.be.equal(900);

      const usdTokenPrice = (await wrappedLoan.getAllAssetsPrices())[1];
      expect(formatUnits(usdTokenPrice, BigNumber.from(8))).to.be.closeTo(USD_PRICE, 0.001);
    });


    it("should update valuation after price change", async () => {
      let totalValueBeforePriceChange = fromWei(await wrappedLoan.getTotalValue());

      let UPDATED_MOCK_PRICES = MOCK_PRICES.map(
        (token: any) => {
          if (token.symbol == 'USD') {
            token.value = 2 * USD_PRICE;
          }
          return token;
        }
      );

      let updatedLoan = WrapperBuilder
        .mockLite(loan)
        .using(
          () => {
            return {
              prices: UPDATED_MOCK_PRICES,
              timestamp: Date.now()
            }
          }
        );

      // 900 is the balance of USD, so the change is current_value = previous_value: (2 * 900) - (1 * 900)
      expect(fromWei(await updatedLoan.getTotalValue())).to.closeTo(totalValueBeforePriceChange + 900, 3);
      expect(fromWei(await updatedLoan.getDebt())).to.be.equal(0);
      expect(await updatedLoan.getLTV()).to.be.equal(0);
    });


    it("should swap back", async () => {
      const initialEthTokenBalance = (await wrappedLoan.getAllAssetsBalances())[2];

      const slippageTolerance = 0.1;

      const avaxAmount = ETH_PRICE * fromWei(initialEthTokenBalance) * (1 - slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.swap(
        toBytes32('ETH'),
        toBytes32('AVAX'),
        initialEthTokenBalance,
        toWei(avaxAmount.toString())
      );

      const currentEthTokenBalance = (await wrappedLoan.getAllAssetsBalances())[2];

      expect(currentEthTokenBalance).to.be.equal(0);

      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });
  });
});

