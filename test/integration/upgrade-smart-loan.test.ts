import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import CompoundingIndexArtifact from '../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import UpgradeableBeaconArtifact
  from '../../artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json';
import SmartLoansFactoryArtifact from '../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockSmartLoanArtifact from '../../artifacts/contracts/mock/MockSmartLoan.sol/MockSmartLoan.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset,
  deployAndInitPangolinExchangeContract,
  fromWei,
  getFixedGasSigners, Integration,
  recompileSmartLoan,
  syncTime,
  toBytes32,
  toWei
} from "../_helpers";
import {
  CompoundingIndex, DPRouterV1, DPRouterV1__factory,
  MockSmartLoanRedstoneProvider,
  MockUpgradedGettersSmartLoan__factory,
  OpenBorrowersRegistry__factory,
  PangolinExchange, PangolinIntegrationV1, PangolinIntegrationV1__factory,
  Pool,
  SmartLoan,
  SmartLoansFactory,
  UpgradeableBeacon,
  VariableUtilisationRatesCalculator, YieldYakIntegration, YieldYakIntegration__factory, YieldYakRouter__factory
} from "../../typechain";
import {BigNumber, Contract} from "ethers";
import {WrapperBuilder} from "redstone-evm-connector";

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const WAVAXTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const yakStakingTokenAddress = "0x957Ca4a4aA7CDc866cf430bb140753F04e273bC0";
const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]
const MOCK_AVAX_PRICE = 100000;
const ZERO = ethers.constants.AddressZero;

describe('Smart loan - upgrading',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  function getMockPrices(usdPrice: BigNumber): Array<{symbol: string, value: number}> {
    return [
      {
        symbol: 'USD',
        value: MOCK_AVAX_PRICE * fromWei(usdPrice)
      },
      {
        symbol: 'AVAX',
        value: MOCK_AVAX_PRICE
      }
    ]
  }

  describe('Check basic logic before and after upgrade', () => {
    let pangolinIntegrationContract: PangolinIntegrationV1,
      yieldYakIntegrationContract: YieldYakIntegration,
      dpRouter: DPRouterV1,
      loan: MockSmartLoanRedstoneProvider,
      wrappedLoan: any,
      wrappedSecondLoan: any,
      mockPrices: any,
      smartLoansFactory: SmartLoansFactory,
      pool: Pool,
      newPool: Pool,
      owner: SignerWithAddress,
      oracle: SignerWithAddress,
      depositor: SignerWithAddress,
      other: SignerWithAddress,
      usdTokenContract: Contract,
      usdTokenDecimalPlaces: BigNumber,
      beacon: UpgradeableBeacon,
      estimatedAVAXPriceFor1USDToken: BigNumber;

    before("should deploy provider, exchange, loansFactory and pool", async () => {
      [owner, oracle, depositor, other] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      newPool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      pangolinIntegrationContract = await (new PangolinIntegrationV1__factory(owner).deploy());
      await pangolinIntegrationContract.initialize(
          pangolinRouterAddress,
          [new Asset(toBytes32('AVAX'), WAVAXTokenAddress), new Asset(toBytes32('USD'), usdTokenAddress)],
          [],
          []
      );

      yieldYakIntegrationContract = await (new YieldYakIntegration__factory(owner).deploy());
      await yieldYakIntegrationContract.initialize(
          [],
          // TODO: Treat it as a YRT token?
          [new Asset(toBytes32('AVAX'), yakStakingTokenAddress)],
          []
      );

      dpRouter = await (new DPRouterV1__factory(owner).deploy());
      await dpRouter.initialize([
        new Integration(await pangolinIntegrationContract.getIntegrationID(), pangolinIntegrationContract.address),
        new Integration(await yieldYakIntegrationContract.getIntegrationID(), yieldYakIntegrationContract.address)
      ]);

      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      estimatedAVAXPriceFor1USDToken = await pangolinIntegrationContract.getEstimatedAVAXForERC20Token(toWei("1", usdTokenDecimalPlaces), usdTokenAddress);

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      const artifact = await recompileSmartLoan("MockSmartLoanRedstoneProvider", pool.address, dpRouter.address,  'mock');
      let implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);

      await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});
    });

    it("should create a loan", async () => {
      mockPrices = getMockPrices(estimatedAVAXPriceFor1USDToken);

      const wrappedSmartLoansFactory = WrapperBuilder
          .mockLite(smartLoansFactory.connect(owner))
          .using(
              () => {
                return {
                  prices: mockPrices,
                  timestamp: Date.now()
                }
              })

      await wrappedSmartLoansFactory.createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = ((await new ethers.Contract(loanAddress, MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(owner);
    });


    it("should check if only one loan per owner is allowed", async () => {
      await expect(smartLoansFactory.connect(owner).createLoan()).to.be.revertedWith("Only one loan per owner is allowed");
      await expect(smartLoansFactory.connect(owner).createAndFundLoan(0)).to.be.revertedWith("Only one loan per owner is allowed");
    });


    it("should fund a loan", async () => {
      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: mockPrices,
                  timestamp: Date.now()
                }
              })

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);

      await wrappedLoan.fund({value: toWei("100")});

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(100);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });



    it("should create and fund a loan", async () => {

      const wrappedSmartLoansFactory = WrapperBuilder
        .mockLite(smartLoansFactory.connect(other))
        .using(
          () => {
          return {
            prices: mockPrices,
            timestamp: Date.now()
          }
        })

      await wrappedSmartLoansFactory.createAndFundLoan(toWei("2"), {value: toWei("10"),});

      const loanAddress = await wrappedSmartLoansFactory.getLoanForOwner(other.address);
      const secondLoan = ((await new ethers.Contract(loanAddress, MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(other);

      wrappedSecondLoan = WrapperBuilder
        .mockLite(secondLoan)
        .using(
          () => { return {
            prices: mockPrices,
            timestamp: Date.now()
          }
        });

      expect(fromWei(await wrappedSecondLoan.getTotalValue())).to.be.equal(12);
      expect(fromWei(await wrappedSecondLoan.getDebt())).to.be.equal(2);
      expect((await wrappedSecondLoan.getLTV()).toString()).to.be.equal("200");
    });


    it("should buy an asset", async () => {
      const investedAmount = 100;

      const slippageTolerance = 0.03;
      const requiredAvaxAmount = mockPrices[0].value * investedAmount * (1 + slippageTolerance) / MOCK_AVAX_PRICE;

      await wrappedLoan.invest(
        toBytes32('PANGOLINV1'),
        toBytes32('USD'),
        toWei("100", usdTokenDecimalPlaces),
        toWei(requiredAvaxAmount.toString())
      );

      //wrapping again to get a new timestamp for data
      const rewrappedLoan: any = WrapperBuilder
        .mockLite(loan)
        .using(
          () => { return {
            prices: mockPrices,
            timestamp: Date.now()
          }
        })

      expect(fromWei(await rewrappedLoan.getTotalValue())).to.be.closeTo(100, 0.0001);
      expect(fromWei(await rewrappedLoan.getDebt())).to.be.equal(0);
      expect(await rewrappedLoan.getLTV()).to.be.equal(0);
    });


    it("should not allow to upgrade from non-owner", async () => {
      await expect(beacon.connect(other).upgradeTo(other.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });


    it("should upgrade", async () => {
      const loanV2 = await (new MockUpgradedGettersSmartLoan__factory(owner).deploy());

      await beacon.connect(owner).upgradeTo(loanV2.address);

      //The mock loan has a hardcoded total value of 777
      expect(await wrappedLoan.getTotalValue()).to.be.equal(777);
      expect(await wrappedLoan.getPercentagePrecision()).to.be.equal(1001);
      expect(await wrappedLoan.getMinSelloutLtv()).to.be.equal(400);
      expect(await wrappedLoan.getMaxLtv()).to.be.equal(200);
      expect(await wrappedLoan.getPool()).to.be.equal(ZERO);
    });
  });
});
