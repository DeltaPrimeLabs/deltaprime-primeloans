import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import CompoundingIndexArtifact from '../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import SmartLoansFactoryArtifact from '../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import SmartLoanArtifact from '../../artifacts/contracts/SmartLoan.sol/SmartLoan.json';
import MockSmartLoanArtifact from '../../artifacts/contracts/mock/MockSmartLoan.sol/MockSmartLoan.json';
import UpgradeableBeaconArtifact
  from '../../artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset, calculateStakingTokensAmountBasedOnAvaxValue,
  deployAndInitPangolinExchangeContract,
  formatUnits,
  fromWei,
  getFixedGasSigners,
  getSelloutRepayAmount,
  recompileSmartLoan,
  toBytes32,
  toWei,
} from "../_helpers";
import {syncTime} from "../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  CompoundingIndex,
  MockSmartLoan,
  MockSmartLoan__factory,
  MockSmartLoanRedstoneProvider,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  Pool,
  SmartLoan,
  SmartLoansFactory,
  UpgradeableBeacon,
  VariableUtilisationRatesCalculator, YieldYakRouter__factory
} from "../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const linkTokenAddress = '0x5947bb275c521040051d82396192181b413227a3';
const WAVAXTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const yakStakingTokenAddress = "0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95";

const SMART_LOAN_MOCK = "MockSmartLoanRedstoneProvider";
const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function totalDeposits() external view returns (uint256)'
]


describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('A loan without debt', () => {
    let exchange: PangolinExchange,
      smartLoansFactory: SmartLoansFactory,
      implementation: SmartLoan,
      yakRouterContract: Contract,
      loan: MockSmartLoanRedstoneProvider,
      wrappedLoan: any,
      pool: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      usdTokenContract: Contract,
      usdTokenDecimalPlaces: BigNumber,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      USD_PRICE: number,
      artifact: any;

    before("deploy factory, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
          new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
          new Asset(toBytes32('USD'), usdTokenAddress)
      ]);

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
        borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
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

      await wrappedLoan.fund({value: toWei("200")});

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(200);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should withdraw part of funds", async () => {
      await wrappedLoan.withdraw(toWei("100"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(100);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should buy an asset", async () => {
      const investedAmount = 100;

      const slippageTolerance = 0.03;
      const requiredAvaxAmount = MOCK_PRICES[0].value * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.invest(
        toBytes32('USD'),
        parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
        toWei(requiredAvaxAmount.toString())
      );

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(100, 0.1);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });
  //
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
      await expect(wrappedLoanWithoutPrices.getTotalValue()).to.be.revertedWith("Avax price returned from oracle is zero");
    });

    it("should provide assets balances and prices", async () => {
      const usdTokenBalance = (await wrappedLoan.getAllAssetsBalances())[1];
      expect(formatUnits(usdTokenBalance, usdTokenDecimalPlaces)).to.be.equal(100);

      const usdTokenPrice = (await wrappedLoan.getAllAssetsPrices())[1];
      expect(formatUnits(usdTokenPrice, BigNumber.from(8))).to.be.closeTo(USD_PRICE, 0.001);
    });


    it("should update valuation after price change", async () => {
      let UPDATED_MOCK_PRICES = MOCK_PRICES.map(
        (token: any) => {
          if (token.symbol == 'USD') {
            token.value = 2 * USD_PRICE;
          }
          return token;
        }
      );

      const newUSDTokenAssetValueInAvax = 2 * USD_PRICE / AVAX_PRICE * (await wrappedLoan.getAllAssetsBalances())[1]
          / 10**parseInt(usdTokenDecimalPlaces.toString());

      let updatedLoan = WrapperBuilder
        .mockLite(loan)
        .using(
          () => {
            return {
              prices: UPDATED_MOCK_PRICES,
              timestamp: Date.now()
            }
          })

      const newBalance = fromWei(await provider.getBalance(updatedLoan.address));

      expect(fromWei(await updatedLoan.getTotalValue())).to.closeTo(newUSDTokenAssetValueInAvax + newBalance, 0.00001);
      expect(fromWei(await updatedLoan.getDebt())).to.be.equal(0);
      expect(await updatedLoan.getLTV()).to.be.equal(0);
    });


    it("should redeem investment", async () => {
      const initialUSDTokenBalanceInWei = (await wrappedLoan.getAllAssetsBalances())[1];
      const usdPrice = USD_PRICE;

      const avaxPrice = AVAX_PRICE;
      const slippageTolerance = 0.05;

      await wrappedLoan.redeem(
        toBytes32('USD'),
        initialUSDTokenBalanceInWei,
        toWei((formatUnits(initialUSDTokenBalanceInWei, usdTokenDecimalPlaces) * usdPrice / avaxPrice * (1 - slippageTolerance)).toString()));

      const currentUSDTokenBalance = (await wrappedLoan.getAllAssetsBalances())[1];

      expect(currentUSDTokenBalance).to.be.equal(0);

      const currentLoanTotalValue = await wrappedLoan.getTotalValue();

      // TODO: Refactor this using the .to.be.closeTo (delta 0.001) after resolving argument types issues
      const lowerExpectedBound = currentLoanTotalValue.mul(999).div(1000);
      const upperExpectedBound = currentLoanTotalValue.mul(1001).div(1000);
      expect(currentLoanTotalValue).to.be.gte(lowerExpectedBound);
      expect(currentLoanTotalValue).to.be.lte(upperExpectedBound);

      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });
  });

  describe('A loan with debt and repayment', () => {
    let exchange: PangolinExchange,
      loan: MockSmartLoanRedstoneProvider,
      smartLoansFactory: SmartLoansFactory,
      implementation: SmartLoan,
      yakRouterContract: Contract,
      wrappedLoan: any,
      pool: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      usdTokenContract: Contract,
      usdTokenDecimalPlaces: BigNumber,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      artifact: any;

    before("deploy factory, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
          new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
          new Asset(toBytes32('USD'), usdTokenAddress)
      ]);

      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      MOCK_PRICES = [
        {
          symbol: 'USD',
          value: AVAX_PRICE * fromWei(await exchange.getEstimatedAVAXForERC20Token(toWei("1", usdTokenDecimalPlaces), usdTokenAddress))
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        }
      ]

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');

      implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);
    });

    it("should deploy a smart loan", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = ((await new ethers.Contract(loan_proxy_address, MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(owner);

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

      await wrappedLoan.fund({value: toWei("100")});

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(100);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });


    it("should borrow funds", async () => {
      await wrappedLoan.borrow(toWei("200"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(300);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(200);
      expect(await wrappedLoan.getLTV()).to.be.equal(2000);
    });


    it("should repay funds", async () => {
      await wrappedLoan.repay(toWei("100"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(200);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(100, 0.1);
      expect(await wrappedLoan.getLTV()).to.be.equal(1000);
    });


    it("should prevent borrowing too much", async () => {
      await expect(wrappedLoan.borrow(toWei("500"))).to.be.revertedWith("The action may cause an account to become insolvent");
    });

  });

  describe('A loan with sellout and proxy upgradeability', () => {
    let exchange: PangolinExchange,
      loan: SmartLoan,
      wrappedLoan: any,
      pool: Pool,
      yakRouterContract: Contract,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      admin: SignerWithAddress,
      usdTokenContract: Contract,
      linkTokenContract: Contract,
      usdTokenDecimalPlaces: BigNumber,
      linkTokenDecimalPlaces: BigNumber,
      beacon: UpgradeableBeacon,
      smartLoansFactory: SmartLoansFactory,
      implementation: SmartLoan,
      artifact: any,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      LINK_PRICE: number,
      USD_PRICE: number;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor, admin] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
          new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
          new Asset(toBytes32('USD'), usdTokenAddress),
          new Asset(toBytes32('LINK'), linkTokenAddress)
        ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      linkTokenDecimalPlaces = await linkTokenContract.decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;

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
        }
      ]

      await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});
    });

    it("should deploy a smart loan behind a proxy", async () => {
      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
      implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);

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
      await wrappedLoan.fund({value: toWei("100")});
    });

    it("should borrow funds", async () => {
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);
    });

    it("should invest", async () => {
      const slippageTolerance = 0.05;
      let investedAmount = 10000;
      let requiredAvaxAmount = USD_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;
      await wrappedLoan.invest(
        toBytes32('USD'),
        parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
        toWei(requiredAvaxAmount.toString())
      );

      investedAmount = 200;
      requiredAvaxAmount = LINK_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;
      await wrappedLoan.invest(
        toBytes32('LINK'),
        parseUnits(investedAmount.toString(), linkTokenDecimalPlaces),
        toWei(requiredAvaxAmount.toString())
      );


      let balances = await wrappedLoan.getAllAssetsBalances();

      const currentUSDTokenBalance = balances[1];
      const currentLINKTokenBalance = balances[2];

      expect(currentUSDTokenBalance).to.be.equal(toWei("10000", usdTokenDecimalPlaces));
      expect(currentLINKTokenBalance).to.be.equal(toWei("200", linkTokenDecimalPlaces));
    });

    it('should return the balance of a token', async () => {
      const linkTokenBalance = await linkTokenContract.connect(owner).balanceOf(owner.address);
      const smartLoanLinkTokenBalance = await wrappedLoan.getBalance(owner.address, toBytes32('LINK'));

      expect(linkTokenBalance).to.be.equal(smartLoanLinkTokenBalance);
    })

    it("should fail a sellout attempt", async () => {
      expect(await wrappedLoan.getLTV()).to.be.lt(5000);
      expect(await wrappedLoan.isSolvent()).to.be.true;
      await expect(wrappedLoan.liquidateLoan(toWei("1", 18))).to.be.revertedWith("Cannot sellout a solvent account");
    });

    it("should sellout assets partially bringing the loan to a solvent state", async () => {
      let balances = await wrappedLoan.getAllAssetsBalances();
      const initialUSDTokenBalance = balances[1];
      const initialLINKTokenBalance = balances[2];
      const poolAvaxValue = await provider.getBalance(pool.address);

      expect(await wrappedLoan.isSolvent()).to.be.true;

      artifact = await recompileSmartLoan("MockUpgradedSolvencySmartLoan", pool.address, exchange.address, yakRouterContract.address, 'mock');
      let newImplementation = await deployContract(owner, artifact) as SmartLoan;

      await beacon.connect(owner).upgradeTo(newImplementation.address);

      expect(await wrappedLoan.isSolvent()).to.be.false;

      const repayAmount = await getSelloutRepayAmount(
        await wrappedLoan.getTotalValue(),
        await wrappedLoan.getDebt(),
        await wrappedLoan.getLiquidationBonus(),
        await wrappedLoan.getMaxLtv()
      )

      await wrappedLoan.liquidateLoan(repayAmount.toLocaleString('fullwide', {useGrouping:false}));


      expect(await wrappedLoan.isSolvent()).to.be.true;
      expect((await provider.getBalance(pool.address)).gt(poolAvaxValue)).to.be.true;

      balances = await wrappedLoan.getAllAssetsBalances();

      const currentUSDTokenBalance = balances[1];
      const currentLINKTokenBalance = balances[2];

      expect(currentUSDTokenBalance).to.be.lt(initialUSDTokenBalance);
      if (currentUSDTokenBalance == 0) {
        expect(currentLINKTokenBalance).to.be.lt(initialLINKTokenBalance);
      } else {
        expect(currentLINKTokenBalance).to.be.eq(initialLINKTokenBalance);
      }

    });
  });

  describe('A loan with owner sellout', () => {
    let exchange: PangolinExchange,
      loan: MockSmartLoanRedstoneProvider,
      smartLoansFactory: SmartLoansFactory,
      wrappedLoan: any,
      pool: Pool,
      yakRouterContract: Contract,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      usdTokenContract: Contract,
      linkTokenContract: Contract,
      usdTokenDecimalPlaces: BigNumber,
      linkTokenDecimalPlaces: BigNumber,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      LINK_PRICE: number,
      USD_PRICE: number,
      artifact: any,
      implementation: any;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
[
        new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
        new Asset(toBytes32('USD'), usdTokenAddress),
        new Asset(toBytes32('LINK'), linkTokenAddress)
      ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      linkTokenDecimalPlaces = await linkTokenContract.decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;

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
        }
      ]

      await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
      implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);
    });

    it("should deploy a smart loan, fund, borrow and invest", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = ((await new ethers.Contract(loan_proxy_address, MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(owner);

      wrappedLoan = WrapperBuilder
        .mockLite(loan)
        .using(
          () => {
            return {
              prices: MOCK_PRICES,
              timestamp: Date.now()
            }
          })

      await wrappedLoan.fund({value: toWei("100")});
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let investedAmount = 10000;
      let requiredAvaxAmount = USD_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.invest(
        toBytes32('USD'),
        parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
        toWei(requiredAvaxAmount.toString())
      );

      let balances = await wrappedLoan.getAllAssetsBalances();
      const currentUSDTokenBalance = balances[1];
      expect(currentUSDTokenBalance).to.be.equal(toWei("10000", usdTokenDecimalPlaces));
    });


    it("should fail a closeLoan attempt at the onlyOwner check", async () => {
      await expect(wrappedLoan.connect(depositor).closeLoan()).to.be.revertedWith("Ownable: caller is not the owner")
    });

    it("should perform an owner's closeLoan call", async () => {
      const ownerInitialAvaxBalance = await provider.getBalance(owner.address);
      await wrappedLoan.closeLoan();
      expect(await wrappedLoan.isSolvent()).to.be.true;
      expect(await wrappedLoan.getDebt()).to.be.equal(0);
      expect(await provider.getBalance(owner.address)).to.be.gt(ownerInitialAvaxBalance);

      let balances = await wrappedLoan.getAllAssetsBalances();
      expect(balances[1]).to.be.equal(0);
    });


  });

  describe('A loan with edge LTV cases', () => {
    let loan: MockSmartLoan,
      yakRouterContract: Contract,
      owner: SignerWithAddress;

    before("deploy provider, exchange and pool", async () => {
      [owner] = await getFixedGasSigners(10000000);
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
    });

    it("should deploy a smart loan", async () => {
      loan = await (new MockSmartLoan__factory(owner).deploy());
    });

    it("should check debt equal to 0", async () => {
      await loan.setValue(40000);
      await loan.setDebt(0);
      expect(await loan.getLTV()).to.be.equal(0);
      expect(await loan.isSolvent()).to.be.true;
    });

    it("should check debt greater than 0 and lesser than totalValue", async () => {
      await loan.setValue(50000);
      await loan.setDebt(10000);
      expect(await loan.getLTV()).to.be.equal(250);
      expect(await loan.isSolvent()).to.be.true;
    });

    it("should check debt equal to totalValue", async () => {
      await loan.setValue(40000);
      await loan.setDebt(40000);
      expect(await loan.getLTV()).to.be.equal(5000);
      expect(await loan.isSolvent()).to.be.false;
    });

    it("should check debt greater than totalValue", async () => {
      await loan.setValue(40000);
      await loan.setDebt(40001);
      expect(await loan.getLTV()).to.be.equal(5000);
      expect(await loan.isSolvent()).to.be.false;
    });

    it("should check LTV 4999", async () => {
      await loan.setValue(48001);
      await loan.setDebt(40000);
      expect(await loan.getLTV()).to.be.equal(4999);
      expect(await loan.isSolvent()).to.be.true;
    });

    it("should check LTV 5000", async () => {
      await loan.setValue(48000);
      await loan.setDebt(40000);
      expect(await loan.getLTV()).to.be.equal(5000);
      expect(await loan.isSolvent()).to.be.false;
    });

    it("should check LTV 5001", async () => {
      await loan.setValue(47998);
      await loan.setDebt(40000);
      expect(await loan.getLTV()).to.be.equal(5001);
      expect(await loan.isSolvent()).to.be.false;
    });
  });

  describe('A loan with closeLoan() and additional AVAX supplied', () => {
    let exchange: PangolinExchange,
        loan: SmartLoan,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
        yakRouterContract: Contract,
        wrappedLoanUpdated: any,
        pool: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        usdTokenContract: Contract,
        linkTokenContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        linkTokenDecimalPlaces: BigNumber,
        MOCK_PRICES: any,
        MOCK_PRICES_UPDATED: any,
        AVAX_PRICE: number,
        LINK_PRICE: number,
        USD_PRICE: number,
        artifact: any,
        implementation: any;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
          [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress),
            new Asset(toBytes32('LINK'), linkTokenAddress)
          ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      linkTokenDecimalPlaces = await linkTokenContract.decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;

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
        }
      ]

      await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
      implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);
    });

    it("should deploy a smart loan, fund, borrow and invest", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = ((await new ethers.Contract(loanAddress, SmartLoanArtifact.abi)) as SmartLoan).connect(owner);


      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      await wrappedLoan.fund({value: toWei("100")});
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let investedAmount = 5000;
      let requiredAvaxAmount = USD_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.invest(
          toBytes32('USD'),
          parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
          toWei(requiredAvaxAmount.toString())
      );
    });


    it("should withdraw collateral and part of borrowed funds, bring prices back to normal and close the loan by supplying additional AVAX", async () => {
      // Define "updated" (USD x 1000) prices and build an updated wrapped loan
      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;
      MOCK_PRICES_UPDATED = [
        {
          symbol: 'USD',
          value: USD_PRICE * 1000
        },
        {
          symbol: 'LINK',
          value: LINK_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
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

      let initialOwnerBalance = BigNumber.from(await provider.getBalance(owner.address));
      expect(await wrappedLoan.isSolvent()).to.be.true;
      await wrappedLoanUpdated.withdraw(toWei("130"));
      expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
      expect(await wrappedLoan.isSolvent()).to.be.false;

      // Try to close the debt
      await expect(wrappedLoan.closeLoan()).to.be.revertedWith("Debt not repaid fully");

      let debt = BigNumber.from(await wrappedLoan.getDebt());
      let loanTotalValue = BigNumber.from(await wrappedLoan.getTotalValue());
      let loanAssetsValue = fromWei(loanTotalValue.sub(BigNumber.from(await provider.getBalance(wrappedLoan.address))));
      let expectedOwnerAvaxBalance = initialOwnerBalance.add(toWei("130")).sub(debt).add(loanTotalValue);

      // Try to close the debt using remaining AVAX and additional 270 AVAX
      await wrappedLoan.closeLoan({value: toWei("270")});

      // The "normal" loan should be solvent and debt should be equal to 0
      debt = BigNumber.from(fromWei(await wrappedLoan.getDebt()));
      expect(await wrappedLoan.isSolvent()).to.be.true;
      expect(debt).to.be.equal(0);

      // Make sure that the loan returned all of the remaining AVAX after repaying the whole debt
      expect(await provider.getBalance(loan.address)).to.be.equal(0);
      // Accepted delta is equal to the total value of assets that were sold multiplied by the 3% slippage tolerance
      expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(fromWei(expectedOwnerAvaxBalance), loanAssetsValue * 0.03);
    });
  });

  describe('A loan with liquidateLoan() and additional AVAX supplied', () => {
    let exchange: PangolinExchange,
        loan: MockSmartLoanRedstoneProvider,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
        yakRouterContract: Contract,
        wrappedLoanUpdated: any,
        pool: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        usdTokenContract: Contract,
        linkTokenContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        linkTokenDecimalPlaces: BigNumber,
        MOCK_PRICES: any,
        MOCK_PRICES_UPDATED: any,
        AVAX_PRICE: number,
        LINK_PRICE: number,
        USD_PRICE: number,
        artifact: any,
        implementation: any;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
        [
          new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
          new Asset(toBytes32('USD'), usdTokenAddress),
          new Asset(toBytes32('LINK'), linkTokenAddress)
        ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      linkTokenDecimalPlaces = await linkTokenContract.decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;

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
        }
      ]

      await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
      implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);
    });

    it("should deploy a smart loan, fund, borrow and invest", async () => {
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

      await wrappedLoan.fund({value: toWei("100")});
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let investedAmount = 5000;
      let requiredAvaxAmount = USD_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.invest(
          toBytes32('USD'),
          parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
          toWei(requiredAvaxAmount.toString())
      );
    });


    it("should withdraw collateral and part of borrowed funds, bring prices back to normal and liquidate the loan by supplying additional AVAX", async () => {
      // Define "updated" (USD x 1000) prices and build an updated wrapped loan
      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;
      MOCK_PRICES_UPDATED = [
        {
          symbol: 'USD',
          value: USD_PRICE * 1000
        },
        {
          symbol: 'LINK',
          value: LINK_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
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
      let initialOwnerBalance = BigNumber.from(await provider.getBalance(owner.address));
      expect(await wrappedLoan.isSolvent()).to.be.true;
      await wrappedLoanUpdated.withdraw(toWei("130"));
      expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
      expect(await wrappedLoan.isSolvent()).to.be.false;

      // Try to liquidate the loan
      await expect(wrappedLoan.liquidateLoan(toWei("305"))).to.be.revertedWith("This operation would not result in bringing the loan back to a solvent state");

      let debt = BigNumber.from(await wrappedLoan.getDebt());
      let liquidationBonus = BigNumber.from(toWei("300")).div(10);
      let expectedOwnerAvaxBalance = initialOwnerBalance.add(toWei("130")).sub(toWei("70")).add(liquidationBonus);

      // Try to liquidate the loan using remaining AVAX and additional 70 AVAX
      await wrappedLoan.liquidateLoan(toWei("305"), {value: toWei("70")});
      // The "normal" loan should be solvent and debt should be equal to 0
      debt = BigNumber.from(fromWei(await wrappedLoan.getDebt()));
      expect(await wrappedLoan.isSolvent()).to.be.true;
      expect(debt).to.be.equal(0);

      // Make sure that the loan returned excessive AVAX after repaying the whole debt
      expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(fromWei(expectedOwnerAvaxBalance), 2);
    });
  });

  describe('A loan with debt and withdrawAsset()', () => {
    let exchange: PangolinExchange,
        loan: MockSmartLoanRedstoneProvider,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
        yakRouterContract: Contract,
        pool: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        usdTokenContract: Contract,
        linkTokenContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        linkTokenDecimalPlaces: BigNumber,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        LINK_PRICE: number,
        USD_PRICE: number,
        artifact: any,
        implementation: any;

    before("deploy provider, exchange and pool", async () => {
      [,,owner, depositor] = await getFixedGasSigners(10000000);
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      usdTokenDecimalPlaces = await usdTokenContract.decimals();

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
          [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress),
            new Asset(toBytes32('LINK'), linkTokenAddress)
          ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      linkTokenDecimalPlaces = await linkTokenContract.decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;

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
        }
      ]

      await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
      implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);
    });

    it("should deploy a smart loan, fund, borrow and invest", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = ((await new ethers.Contract(loan_proxy_address, MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(owner);

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      await wrappedLoan.fund({value: toWei("100")});
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let investedAmount = 5000;
      let requiredAvaxAmount = USD_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.invest(
          toBytes32('USD'),
          parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
          toWei(requiredAvaxAmount.toString())
      );
    });

    it('should not revert on 0 token withdrawal amount', async () => {
      await wrappedLoan.withdrawAsset(toBytes32("USD"), 0);
    });

    it('should revert on a withdrawal amount being higher than the available balance', async () => {
      await expect(wrappedLoan.withdrawAsset(toBytes32("USD"), parseUnits("200001", usdTokenDecimalPlaces))).to.be.revertedWith("TransferHelper::safeTransfer: transfer failed");
    });

    it('should revert on a withdrawal resulting in an insolvent loan', async () => {
      await expect(wrappedLoan.withdrawAsset(toBytes32("USD"), parseUnits("5000", usdTokenDecimalPlaces))).to.be.revertedWith("The action may cause an account to become insolvent");
    });

    it('should withdraw', async () => {
      expect(await usdTokenContract.balanceOf(owner.address)).to.be.equal(0)
      await wrappedLoan.withdrawAsset(toBytes32("USD"), parseUnits("1", usdTokenDecimalPlaces));
      expect(await usdTokenContract.balanceOf(owner.address)).to.be.equal(parseUnits("1", usdTokenDecimalPlaces))
    });
  });

  describe('A loan with extra AVAX repayment', () => {
        let exchange: PangolinExchange,
            loan: MockSmartLoanRedstoneProvider,
            smartLoansFactory: SmartLoansFactory,
            wrappedLoan: any,
            wrappedLoanUpdated: any,
            pool: Pool,
            owner: SignerWithAddress,
            yakRouterContract: Contract,
            depositor: SignerWithAddress,
            usdTokenContract: Contract,
            linkTokenContract: Contract,
            usdTokenDecimalPlaces: BigNumber,
            linkTokenDecimalPlaces: BigNumber,
            MOCK_PRICES: any,
            MOCK_PRICES_UPDATED: any,
            AVAX_PRICE: number,
            LINK_PRICE: number,
            USD_PRICE: number,
            artifact: any,
            implementation: any;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);

            const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
            usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
            linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

            exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
                [
                  new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
                  new Asset(toBytes32('USD'), usdTokenAddress),
                  new Asset(toBytes32('LINK'), linkTokenAddress)
                ]);

            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
            const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

            usdTokenDecimalPlaces = await usdTokenContract.decimals();
            linkTokenDecimalPlaces = await linkTokenContract.decimals();

            AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
            USD_PRICE = (await redstone.getPrice('USDT')).value;
            LINK_PRICE = (await redstone.getPrice('LINK')).value;

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
                }
            ]

            await pool.initialize(
              variableUtilisationRatesCalculator.address,
              borrowersRegistry.address,
              depositIndex.address,
              borrowingIndex.address
            );
            await pool.connect(depositor).deposit({value: toWei("1000")});

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
            implementation = await deployContract(owner, artifact) as SmartLoan;

            await smartLoansFactory.initialize(implementation.address);
        });

        it("should deploy a smart loan, fund, borrow and invest", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = ((await new ethers.Contract(loan_proxy_address, MockSmartLoanArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(owner);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })

            await wrappedLoan.fund({value: toWei("100")});
            await wrappedLoan.borrow(toWei("300"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
            expect(await wrappedLoan.getLTV()).to.be.equal(3000);

            const slippageTolerance = 0.03;
            let investedAmount = 5000;
            let requiredAvaxAmount = USD_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;

            await wrappedLoan.invest(
                toBytes32('USD'),
                parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
                toWei(requiredAvaxAmount.toString())
            );
        });


        it("should withdraw collateral and part of borrowed funds, bring prices back to normal and repay with extra AVAX", async () => {
            // Define "updated" (USD x 1000) prices and build an updated wrapped loan
            AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
            USD_PRICE = (await redstone.getPrice('USDT')).value;
            LINK_PRICE = (await redstone.getPrice('LINK')).value;
            MOCK_PRICES_UPDATED = [
                {
                    symbol: 'USD',
                    value: USD_PRICE * 1000
                },
                {
                    symbol: 'LINK',
                    value: LINK_PRICE
                },
                {
                    symbol: 'AVAX',
                    value: AVAX_PRICE
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
            let debtBeforeRepayment = BigNumber.from(await wrappedLoan.getDebt());
            let initialOwnerBalance = BigNumber.from(await provider.getBalance(owner.address));
            expect(await wrappedLoan.isSolvent()).to.be.true;
            await wrappedLoanUpdated.withdraw(toWei("130"));
            expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
            expect(await wrappedLoan.isSolvent()).to.be.false;
            let loanAvaxBalanceAfterWithdrawal = BigNumber.from(await provider.getBalance(loan.address));

            // Try to repay the debt (plus extra 10 AVAX) using remaining AVAX
            await expect(wrappedLoan.repay(toWei("310"))).to.be.revertedWith("Not enough funds to repay the loan");

            // Try to repay the debt (plus extra 10 AVAX) using remaining AVAX and additional 290 AVAX
            await wrappedLoan.repay(toWei("310"), {value: toWei("310")});

            // Initial balance + 150 withdrawn - (initialDebt - loanAvaxBalance)
            let expectedOwnerAvaxBalance = initialOwnerBalance.sub(toWei("310")).add(toWei("130"));
            let expectedLoanAvaxBalance = loanAvaxBalanceAfterWithdrawal.sub(debtBeforeRepayment).add(toWei("310"));
            let debt = fromWei(await wrappedLoan.getDebt());

            // The "normal" loan should be solvent and debt should be equal to 0
            expect(await wrappedLoan.isSolvent()).to.be.true;
            expect(debt).to.be.equal(0);

            // Make sure that the loan returned all of the remaining AVAX after repaying the whole debt
            expect(fromWei(await provider.getBalance(loan.address))).to.be.closeTo(fromWei(expectedLoanAvaxBalance), 0.00001);
            expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(fromWei(expectedOwnerAvaxBalance), 1);
        });
    });

  describe('A loan with staking operations', () => {
    let exchange: PangolinExchange,
        smartLoansFactory: SmartLoansFactory,
        implementation: SmartLoan,
        yakRouterContract: Contract,
        loan: MockSmartLoanRedstoneProvider,
        wrappedLoan: any,
        pool: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        usdTokenContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        yakStakingContract: Contract,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number,
        artifact: any;

    before("deploy factory, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
        new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
        new Asset(toBytes32('USD'), usdTokenAddress)
      ]);
      yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);

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
          borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
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

      await wrappedLoan.fund({value: toWei("200")});

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(200);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should stake", async () => {
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(200);

      let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
      expect(initialStakedBalance).to.be.equal(0);

      await expect(wrappedLoan.stakeAVAXYak(toWei("9999"))).to.be.revertedWith("Not enough AVAX available");

      const stakedAvaxAmount = 50;
      await wrappedLoan.stakeAVAXYak(
          toWei(stakedAvaxAmount.toString())
      );

      let afterStakingStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
      let expectedAfterStakingStakedBalance = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, toWei(stakedAvaxAmount.toString()));

      expect(afterStakingStakedBalance).to.be.equal(expectedAfterStakingStakedBalance);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(200);

    });

    it("should unstake part of staked AVAX", async() => {
      let initialTotalValue = await wrappedLoan.getTotalValue();
      let initialAvaxBalance = await provider.getBalance(wrappedLoan.address);
      let amountAvaxToReceive = toWei("10");
      let initialStakedTokensBalance = await yakStakingContract.balanceOf(wrappedLoan.address);
      let tokenAmountToUnstake = await calculateStakingTokensAmountBasedOnAvaxValue(yakStakingContract, amountAvaxToReceive);

      let expectedAfterUnstakeTokenBalance = initialStakedTokensBalance.sub(tokenAmountToUnstake);

      await wrappedLoan.unstakeAVAXYak(tokenAmountToUnstake);

      expect(expectedAfterUnstakeTokenBalance).to.be.equal(await yakStakingContract.balanceOf(wrappedLoan.address));
      expect(fromWei(await provider.getBalance(wrappedLoan.address))).to.be.closeTo(fromWei(initialAvaxBalance.add(amountAvaxToReceive)), 0.1);
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 0.00001);
    });

    it("should fail to unstake more than was initially staked", async() => {
      await expect(wrappedLoan.unstakeAVAXYak(toWei("999999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
    });
  });

  describe('A loan with staking liquidation', () => {
    let exchange: PangolinExchange,
        loan: MockSmartLoanRedstoneProvider,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
        yakRouterContract: Contract,
        wrappedLoanUpdated: any,
        pool: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        usdTokenContract: Contract,
        linkTokenContract: Contract,
        yakStakingContract: Contract,
        usdTokenDecimalPlaces: BigNumber,
        linkTokenDecimalPlaces: BigNumber,
        MOCK_PRICES: any,
        MOCK_PRICES_UPDATED: any,
        AVAX_PRICE: number,
        LINK_PRICE: number,
        USD_PRICE: number,
        artifact: any,
        implementation: any;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);
      yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
          [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress),
            new Asset(toBytes32('LINK'), linkTokenAddress)
          ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      linkTokenDecimalPlaces = await linkTokenContract.decimals();

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;

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
        }
      ]

      await pool.initialize(
          variableUtilisationRatesCalculator.address,
          borrowersRegistry.address,
          depositIndex.address,
          borrowingIndex.address
      );
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

      artifact = await recompileSmartLoan(SMART_LOAN_MOCK, pool.address, exchange.address, yakRouterContract.address,  'mock');
      implementation = await deployContract(owner, artifact) as SmartLoan;

      await smartLoansFactory.initialize(implementation.address);
    });

    it("should deploy a smart loan, fund, borrow and invest", async () => {
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

      await wrappedLoan.fund({value: toWei("100")});
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;

      let investedAmount = Math.floor(64 * AVAX_PRICE);
      let requiredAvaxAmount = USD_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.invest(
          toBytes32('USD'),
          parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
          toWei(requiredAvaxAmount.toString())
      );

      await wrappedLoan.stakeAVAXYak(
          toWei("270")
      );
    });

    it("should withdraw collateral and part of borrowed funds, bring prices back to normal and liquidate the loan by supplying additional AVAX", async () => {
      // Define "updated" (USD x 1000) prices and build an updated wrapped loan
      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDT')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;
      MOCK_PRICES_UPDATED = [
        {
          symbol: 'USD',
          value: USD_PRICE * 1000
        },
        {
          symbol: 'LINK',
          value: LINK_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
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
      await wrappedLoanUpdated.withdraw(toWei("60"));
      expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
      expect(await wrappedLoan.isSolvent()).to.be.false;


      let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

      await wrappedLoan.liquidateLoan(toWei("220"));

      let currentStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

      expect(fromWei(initialStakedBalance)).to.be.greaterThan(fromWei(currentStakedBalance));
      expect(fromWei(currentStakedBalance)).to.be.greaterThan(0);
      expect(await wrappedLoan.isSolvent()).to.be.true;
    });
  });
});

