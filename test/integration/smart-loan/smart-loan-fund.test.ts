import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenArtifact from "../../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset,
  deployAndInitPangolinExchangeContract,
  fromWei,
  getFixedGasSigners,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  CompoundingIndex,
  ERC20Pool, LTVLib,
  MockSmartLoanLogicFacetRedstoneProvider,
  MockToken,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  SmartLoansFactory,
  VariableUtilisationRatesCalculator, YieldYakRouter__factory
} from "../../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

import {deployDiamond, deployFacet} from '../../../tools/diamond/deploy-diamond';
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const ethTokenAddress = '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB';
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


  describe(`Funding a loan`, () => {
    let exchange: PangolinExchange,
        smartLoansFactory: SmartLoansFactory,
        loan: MockSmartLoanLogicFacetRedstoneProvider,
        wrappedLoan: any,
        mockUsdToken: MockToken,
        wavaxTokenContract: Contract,
        ethTokenContract: Contract,
        yakRouterContract: Contract,
        wavaxPool: ERC20Pool,
        usdPool: ERC20Pool,
        ltvlib: LTVLib,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        ETH_PRICE: number,
        diamondAddress: any;

    before("deploy factory, exchange, wavaxPool and usdPool", async () => {
      diamondAddress = await deployDiamond();
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const variableUtilisationRatesCalculatorERC20 = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
      wavaxPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

      wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);
      ethTokenContract = new ethers.Contract(ethTokenAddress, wavaxAbi, provider);
      //it's a mock implementation of USD token with 18 decimal places
      mockUsdToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, depositor.address]])) as MockToken;

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

      await mockUsdToken.connect(depositor).approve(usdPool.address, toWei("1000"));
      await usdPool.connect(depositor).deposit(toWei("1000"));

      let supportedAssetss = [
        new Asset(toBytes32('AVAX'), wavaxTokenAddress),
        new Asset(toBytes32('USD'), mockUsdToken.address),
        new Asset(toBytes32('ETH'), ethTokenAddress),
      ]
      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, supportedAssetss);

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      await recompileSmartLoanLib(
          "SmartLoanLib",
          [0, 1],
          [wavaxTokenAddress, mockUsdToken.address],
          {'AVAX': wavaxPool.address, 'USD': usdPool.address},
          exchange.address,
          yakRouterContract.address,
          'lib'
      );

      // Deploy LTVLib and later link contracts to it
      const LTVLib = await ethers.getContractFactory('LTVLib');
      ltvlib = await LTVLib.deploy() as LTVLib;

      await deployFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, [], ltvlib.address)

      await smartLoansFactory.initialize(diamondAddress);
    });


    it("should deploy a smart loan", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
      const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetRedstoneProvider", {
        libraries: {
          LTVLib: ltvlib.address
        }
      });
      loan = await loanFactory.attach(loan_proxy_address).connect(owner) as MockSmartLoanLogicFacetRedstoneProvider;

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
      await mockUsdToken.connect(owner).approve(wrappedLoan.address, toWei("1000"));
      await wrappedLoan.fund(toBytes32("USD"), toWei("300"));

      expect(fromWei(await mockUsdToken.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(300);
    });

    it("should deposit native token", async () => {
      await wrappedLoan.depositNativeToken({value: toWei("10")});

      expect(fromWei(await provider.getBalance(wrappedLoan.address))).to.be.equal(0);
      expect(fromWei(await wavaxTokenContract.balanceOf(wrappedLoan.address))).to.be.equal(10);
    });

    it("should receive native token", async () => {
      const tx = await owner.sendTransaction({
        to: wrappedLoan.address,
        value: toWei("10")
      });

      await tx.wait();

      expect(fromWei(await provider.getBalance(wrappedLoan.address))).to.be.equal(10);
      expect(fromWei(await wavaxTokenContract.balanceOf(wrappedLoan.address))).to.be.equal(10);
    });

    it("should revert withdrawing too much native token", async () => {
      await expect(wrappedLoan.unwrapAndWithdraw(toWei("30"))).to.be.revertedWith("Not enough WAVAX to unwrap and withdraw");
    });

    it("should withdraw native token", async () => {
      let providerBalance = fromWei(await provider.getBalance(owner.address));
      await wrappedLoan.unwrapAndWithdraw(toWei("5"));

      expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(providerBalance + 5, 0.001);
      //shouldn't change balance of loan
      expect(fromWei(await provider.getBalance(wrappedLoan.address))).to.be.equal(10);
      expect(fromWei(await wavaxTokenContract.balanceOf(wrappedLoan.address))).to.be.equal(5);
    });
  });
});

