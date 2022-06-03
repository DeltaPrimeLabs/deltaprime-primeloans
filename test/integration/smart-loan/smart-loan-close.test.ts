import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset,
  deployAndInitPangolinExchangeContract,
  formatUnits,
  fromWei,
  getFixedGasSigners,
  recompileSmartLoanLib,
  toBytes32,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  CompoundingIndex,
  ERC20Pool, LTVLib, MockSmartLoanLogicFacetRedstoneProvider, MockSmartLoanLogicFacetRedstoneProvider__factory,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  SmartLoansFactory,
  VariableUtilisationRatesCalculator, YieldYakRouter__factory
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployDiamond, deployFacet} = require('./utils/deploy-diamond');
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const linkTokenAddress = '0x5947bb275c521040051d82396192181b413227a3';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdTokenAddress = '0xc7198437980c041c805A1EDcbA50c1Ce5db95118';
const ethTokenAddress = '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB';
const btcTokenAddress = '0x50b7545627a5162F82A992c33b87aDc75187B218';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function transfer(address dst, uint wad) public returns (bool)'
]

const wavaxAbi = [
  'function deposit() public payable',
  ...erc20ABI
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('A closed loan', () => {
    let exchange: PangolinExchange,
      loan: MockSmartLoanLogicFacetRedstoneProvider,
      wrappedLoan: any,
      owner: SignerWithAddress,
      borrower: SignerWithAddress,
      depositor: SignerWithAddress,
      usdPool: ERC20Pool,
      wavaxPool: ERC20Pool,
      ltvlib: LTVLib,
      ethPool: ERC20Pool,
      admin: SignerWithAddress,
      liquidator: SignerWithAddress,
      usdTokenContract: Contract,
      linkTokenContract: Contract,
      wavaxTokenContract: Contract,
      ethTokenContract: Contract,
      btcTokenContract: Contract,
      yakRouterContract: Contract,
      linkTokenDecimalPlaces: BigNumber,
      usdTokenDecimalPlaces: BigNumber,
      btcTokenDecimalPlaces: BigNumber,
      smartLoansFactory: SmartLoansFactory,
      artifact: any,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      LINK_PRICE: number,
      USD_PRICE: number,
      ETH_PRICE: number,
      BTC_PRICE: number,
      diamondAddress: any;


    before("deploy provider, exchange and pool", async () => {
      diamondAddress = await deployDiamond();
      [owner, depositor, borrower, admin, liquidator] = await getFixedGasSigners(10000000);

      usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      wavaxPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      ethPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      ethTokenContract = new ethers.Contract(ethTokenAddress, erc20ABI, provider);
      btcTokenContract = new ethers.Contract(btcTokenAddress, erc20ABI, provider);
      wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
        new Asset(toBytes32('AVAX'), wavaxTokenAddress),
        new Asset(toBytes32('USD'), usdTokenAddress),
        new Asset(toBytes32('LINK'), linkTokenAddress),
        new Asset(toBytes32('ETH'), ethTokenAddress),
        new Asset(toBytes32('BTC'), btcTokenAddress)
      ]);

      const variableUtilisationRatesCalculatorWavax = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const borrowersRegistryWavax = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndexWavax = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;
      const borrowingIndexWavax = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;

      const variableUtilisationRatesCalculatorUsd = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const borrowersRegistryUsd = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndexUsd = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;
      const borrowingIndexUsd = (await deployContract(owner, CompoundingIndexArtifact, [usdPool.address])) as CompoundingIndex;

      const variableUtilisationRatesCalculatorEth = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const borrowersRegistryEth = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndexEth = (await deployContract(owner, CompoundingIndexArtifact, [ethPool.address])) as CompoundingIndex;
      const borrowingIndexEth = (await deployContract(owner, CompoundingIndexArtifact, [ethPool.address])) as CompoundingIndex;

      linkTokenDecimalPlaces = await linkTokenContract.decimals();
      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      btcTokenDecimalPlaces = await btcTokenContract.decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;
      ETH_PRICE = (await redstone.getPrice('ETH')).value;
      BTC_PRICE = (await redstone.getPrice('BTC')).value;

      MOCK_PRICES = [
        {
          symbol: 'USD',
          value: USD_PRICE
        },
        {
          symbol: 'LINK',
          value: LINK_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'ETH',
          value: ETH_PRICE
        },
        {
          symbol: 'BTC',
          value: BTC_PRICE
        }
      ];

      await wavaxPool.initialize(
          variableUtilisationRatesCalculatorWavax.address,
          borrowersRegistryWavax.address,
          depositIndexWavax.address,
          borrowingIndexWavax.address,
          wavaxTokenContract.address
      );

      await wavaxTokenContract.connect(depositor).deposit({value: toWei("10000")});
      await wavaxTokenContract.connect(depositor).approve(wavaxPool.address, toWei("10000"));
      await wavaxPool.connect(depositor).deposit(toWei("10000"));


      await usdPool.initialize(
        variableUtilisationRatesCalculatorUsd.address,
        borrowersRegistryUsd.address,
        depositIndexUsd.address,
        borrowingIndexUsd.address,
        usdTokenAddress
      );

      await ethPool.initialize(
          variableUtilisationRatesCalculatorEth.address,
          borrowersRegistryEth.address,
          depositIndexEth.address,
          borrowingIndexEth.address,
          ethTokenAddress
      );

      // top-up borrower's wallet with tokens for further actions
      await wavaxTokenContract.connect(borrower).deposit({value: toWei("1000")});
      await swap(borrower, "USD", usdTokenContract, 1000, USD_PRICE);
      await swap(borrower, "ETH", ethTokenContract, 1, ETH_PRICE);
      await swap(borrower, "LINK", linkTokenContract, 10, LINK_PRICE);
      await swap(borrower, "BTC", btcTokenContract, 0.005, BTC_PRICE);

      //initial deposits
      //deposit AVAX

      await wavaxTokenContract.connect(depositor).deposit({value: toWei("1000")});
      await wavaxTokenContract.connect(depositor).approve(wavaxPool.address, toWei("1000"));
      await wavaxPool.connect(depositor).deposit(toWei("1000"));

      //deposit other tokens
      await depositToPool("USD", usdTokenContract, usdPool, 10000, USD_PRICE);
      await depositToPool("ETH", ethTokenContract, ethPool, 1, ETH_PRICE);

      async function depositToPool(symbol: string, tokenContract: Contract, pool: ERC20Pool, amount: number, price: number) {
        const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());

        await swap(depositor, symbol, tokenContract, amount, price);

        await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
        await pool.connect(depositor).deposit(initialTokenDepositWei);
      }

      async function swap(wallet: SignerWithAddress, symbol: string, tokenContract: Contract, amount: number, price: number) {
        const amountInWei = parseUnits(amount.toString(), await tokenContract.decimals());
        let requiredAvax = toWei((amount * price * 1.5 / AVAX_PRICE).toString());

        await wavaxTokenContract.connect(wallet).deposit({value: requiredAvax});
        await wavaxTokenContract.connect(wallet).transfer(exchange.address, requiredAvax);
        await exchange.connect(wallet).swap(toBytes32("AVAX"), toBytes32(symbol), requiredAvax, amountInWei);
      }
    });

    it("should deploy a smart loan behind a proxy", async () => {
      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      await recompileSmartLoanLib(
          'SmartLoanLib',
          [0, 1, 3],
          [wavaxTokenAddress, usdTokenAddress, ethTokenAddress],
          { 'AVAX': wavaxPool.address, 'USD': usdPool.address, 'ETH': ethPool.address,},
          exchange.address,
          yakRouterContract.address,
          'lib'
      );

      // Deploy LTVLib and later link contracts to it
      const LTVLib = await ethers.getContractFactory('LTVLib');
      ltvlib = await LTVLib.deploy() as LTVLib;


      await deployFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, [], ltvlib.address);

      await smartLoansFactory.initialize(diamondAddress);
      await smartLoansFactory.connect(borrower).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

      const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetRedstoneProvider", {
        libraries: {
          LTVLib: ltvlib.address
        }
      });
      loan = await loanFactory.attach(loan_proxy_address).connect(borrower) as MockSmartLoanLogicFacetRedstoneProvider;

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

    it("should fund and borrow", async () => {
      await wavaxTokenContract.connect(borrower).deposit({value: toWei("0.1")});
      await wavaxTokenContract.connect(borrower).approve(wrappedLoan.address, toWei("0.1"));
      await wrappedLoan.fund(toBytes32("AVAX"), toWei("0.1"));
      await usdTokenContract.connect(borrower).approve(wrappedLoan.address, toWei("400", usdTokenDecimalPlaces));
      await wrappedLoan.fund(toBytes32("USD"), toWei("400", usdTokenDecimalPlaces));
      await ethTokenContract.connect(borrower).approve(wrappedLoan.address, toWei("0.02"));
      await wrappedLoan.fund(toBytes32("ETH"), toWei("0.02"));
      await btcTokenContract.connect(borrower).approve(wrappedLoan.address, toWei("0.001", btcTokenDecimalPlaces));
      await wrappedLoan.fund(toBytes32("BTC"), toWei("0.001", btcTokenDecimalPlaces));
      await linkTokenContract.connect(borrower).approve(wrappedLoan.address, toWei("10"));
      await wrappedLoan.fund(toBytes32("LINK"), toWei("10"));

      await wrappedLoan.borrow(toBytes32("USD"), toWei("1000", usdTokenDecimalPlaces));
      await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));
      await wrappedLoan.borrow(toBytes32("ETH"), toWei("0.04"));
    });

    it("should fail a closeLoan attempt at the onlyOwner check", async () => {
      await expect(wrappedLoan.connect(depositor).closeLoan([0, 0, 0])).to.be.revertedWith("LibDiamond: Must be contract owner")
    });

    it("should perform an owner's closeLoan call", async () => {
      const previousWavaxBorrowerBalance = fromWei(await wavaxTokenContract.balanceOf(borrower.address));
      const previousUsdBorrowerBalance = formatUnits(await usdTokenContract.balanceOf(borrower.address), usdTokenDecimalPlaces);
      const previousEthBorrowerBalance = fromWei(await ethTokenContract.balanceOf(borrower.address));
      const previousBtcBorrowerBalance = formatUnits(await btcTokenContract.balanceOf(borrower.address), btcTokenDecimalPlaces);
      const previousLinkBorrowerBalance = fromWei(await linkTokenContract.balanceOf(borrower.address));

      const previousWavaxPoolBalance = fromWei(await wavaxTokenContract.balanceOf(wavaxPool.address));
      const previousUsdPoolBalance = formatUnits(await usdTokenContract.balanceOf(usdPool.address), usdTokenDecimalPlaces);
      const previousEthPoolBalance = fromWei(await ethTokenContract.balanceOf(ethPool.address));

      await wrappedLoan.closeLoan([0, 0, 0]);

      expect(await wrappedLoan.isSolvent()).to.be.true;
      expect(await wrappedLoan.getDebt()).to.be.equal(0);
      expect(await wrappedLoan.getTotalValue()).to.be.equal(0);

      let balances = await wrappedLoan.getAllAssetsBalances();
      expect(balances[0]).to.be.equal(0);
      expect(balances[1]).to.be.equal(0);
      expect(balances[2]).to.be.equal(0);
      expect(balances[3]).to.be.equal(0);
      expect(balances[4]).to.be.equal(0);

      //comparing borrower balances
      expect(fromWei(await wavaxTokenContract.balanceOf(borrower.address)) - previousWavaxBorrowerBalance).to.be.closeTo(0.1, 0.01);
      expect(formatUnits(await usdTokenContract.balanceOf(borrower.address), usdTokenDecimalPlaces) - previousUsdBorrowerBalance).to.be.closeTo(400, 0.01);
      expect(fromWei(await ethTokenContract.balanceOf(borrower.address)) - previousEthBorrowerBalance).to.be.closeTo(0.02, 0.001);
      expect(formatUnits(await btcTokenContract.balanceOf(borrower.address), btcTokenDecimalPlaces) - previousBtcBorrowerBalance).to.be.closeTo(0.001, 0.00001);
      expect(fromWei(await linkTokenContract.balanceOf(borrower.address)) - previousLinkBorrowerBalance).to.be.closeTo(10, 0.01);

      expect(fromWei(await wavaxTokenContract.balanceOf(wavaxPool.address)) - previousWavaxPoolBalance).to.be.closeTo(1, 0.01);
      expect(formatUnits(await usdTokenContract.balanceOf(usdPool.address), usdTokenDecimalPlaces) - previousUsdPoolBalance).to.be.closeTo(1000, 0.01);
      expect(fromWei(await ethTokenContract.balanceOf(ethPool.address)) - previousEthPoolBalance).to.be.closeTo(0.04, 0.01);
    });
  });
});

