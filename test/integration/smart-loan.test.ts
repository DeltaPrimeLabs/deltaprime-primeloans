import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import MockSmartLoanRedstoneProviderArtifact from '../../artifacts/contracts/mock/MockSmartLoanRedstoneProvider.sol/MockSmartLoanRedstoneProvider.json';
import VariableUtilisationRatesCalculatorArtifact from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import SmartLoansFactoryArtifact from '../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockSmartLoanArtifact from '../../artifacts/contracts/mock/MockSmartLoan.sol/MockSmartLoan.json';
import UpgradeableBeaconArtifact from '../../artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json';
import BorrowAccessNFTArtifact from '../../artifacts/contracts/ERC721/BorrowAccessNFT.sol/BorrowAccessNFT.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  fromWei,
  getFixedGasSigners,
  toBytes32,
  toWei,
  formatUnits,
  deployAndInitPangolinExchangeContract, Asset, getSelloutRepayAmount,
} from "../_helpers";
import { syncTime } from "../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  VariableUtilisationRatesCalculator,
  PangolinExchange,
  Pool,
  MockSmartLoan,
  MockSmartLoan__factory,
  MockSmartLoanRedstoneProvider,
  MockSmartLoanRedstoneProvider__factory,
  MockUpgradedSmartLoan__factory,
  UpgradeableBeacon,
  SmartLoansFactory,
  BorrowAccessNFT
} from "../../typechain";

import {OpenBorrowersRegistry__factory} from "../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

chai.use(solidity);

const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const linkTokenAddress = '0x5947bb275c521040051d82396192181b413227a3';
const WAVAXTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]
const MOCK_AVAX_PRICE = 100000;

describe('Smart loan',  () => {
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


  describe('A loan without debt', () => {
    let exchange: PangolinExchange,
      smartLoansFactory: SmartLoansFactory,
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
      beacon: UpgradeableBeacon;


    before("deploy factory, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
          new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
          new Asset(toBytes32('USD'), usdTokenAddress)
      ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

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

      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(pool.address, exchange.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
      const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
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
      wrappedLoan: any,
      pool: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      usdTokenContract: Contract,
      usdTokenDecimalPlaces: BigNumber,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      beacon: UpgradeableBeacon;

    before("deploy factory, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
          new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
          new Asset(toBytes32('USD'), usdTokenAddress)
      ]);

      usdTokenDecimalPlaces = await usdTokenContract.decimals();
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
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
      await smartLoansFactory.initialize(pool.address, exchange.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
      const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
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
      loan: MockSmartLoanRedstoneProvider,
      wrappedLoan: any,
      pool: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      admin: SignerWithAddress,
      usdTokenContract: Contract,
      linkTokenContract: Contract,
      usdTokenDecimalPlaces: BigNumber,
      linkTokenDecimalPlaces: BigNumber,
      beacon: UpgradeableBeacon,
      smartLoansFactory: SmartLoansFactory,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      LINK_PRICE: number,
      USD_PRICE: number;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor, admin] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
          new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
          new Asset(toBytes32('USD'), usdTokenAddress),
          new Asset(toBytes32('LINK'), linkTokenAddress)
        ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

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

      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await pool.connect(depositor).deposit({value: toWei("1000")});
    });

    it("should deploy a smart loan behind a proxy", async () => {
      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(pool.address, exchange.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
      const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      //we need to use mock smart loan in order for PriceAware to work
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);

      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
      loan = ((await new ethers.Contract(loan_proxy_address, MockSmartLoanRedstoneProviderArtifact.abi)) as MockSmartLoanRedstoneProvider).connect(owner);

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
      const slippageTolerance = 0.03;
      let investedAmount = 15000;
      let requiredAvaxAmount = USD_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;
      await wrappedLoan.invest(
        toBytes32('USD'),
        parseUnits(investedAmount.toString(), usdTokenDecimalPlaces),
        toWei(requiredAvaxAmount.toString())
      );

      investedAmount = 300;
      requiredAvaxAmount = LINK_PRICE * investedAmount * (1 + slippageTolerance) / AVAX_PRICE;
      await wrappedLoan.invest(
        toBytes32('LINK'),
        parseUnits(investedAmount.toString(), linkTokenDecimalPlaces),
        toWei(requiredAvaxAmount.toString())
      );


      let balances = await wrappedLoan.getAllAssetsBalances();

      const currentUSDTokenBalance = balances[1];
      const currentLINKTokenBalance = balances[2];

      expect(currentUSDTokenBalance).to.be.equal(toWei("15000", usdTokenDecimalPlaces));
      expect(currentLINKTokenBalance).to.be.equal(toWei("300", linkTokenDecimalPlaces));
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

      const mockSmartLoan = await (new MockUpgradedSmartLoan__factory(owner).deploy());
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);

      expect(await wrappedLoan.isSolvent()).to.be.false;

      const repayAmount = await getSelloutRepayAmount(
        await wrappedLoan.getTotalValue(),
        await wrappedLoan.getDebt(),
        await wrappedLoan.LIQUIDATION_BONUS(),
        await wrappedLoan.get_max_ltv()
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
      beacon: UpgradeableBeacon;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
[
        new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
        new Asset(toBytes32('USD'), usdTokenAddress),
        new Asset(toBytes32('LINK'), linkTokenAddress)
      ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

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

      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(pool.address, exchange.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
      const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
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

      await wrappedLoan.authorizeProvider();

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
      owner: SignerWithAddress;

    before("deploy provider, exchange and pool", async () => {
      [owner] = await getFixedGasSigners(10000000);
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
        loan: MockSmartLoanRedstoneProvider,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
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
        beacon: UpgradeableBeacon;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
          [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress),
            new Asset(toBytes32('LINK'), linkTokenAddress)
          ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

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

      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(pool.address, exchange.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
      const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
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

      await wrappedLoan.authorizeProvider();

      await wrappedLoan.fund({value: toWei("100")});
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let investedAmount = 15000;
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
      await wrappedLoanUpdated.withdraw(toWei("150"));
      expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
      expect(await wrappedLoan.isSolvent()).to.be.false;

      // Try to close the debt
      await expect(wrappedLoan.closeLoan()).to.be.revertedWith("Selling out all assets without repaying the whole debt is not allowed");

      let debt = BigNumber.from(await wrappedLoan.getDebt());
      let loanTotalValue = BigNumber.from(await wrappedLoan.getTotalValue());
      let loanAssetsValue = fromWei(loanTotalValue.sub(BigNumber.from(await provider.getBalance(wrappedLoan.address))));
      let expectedOwnerAvaxBalance = initialOwnerBalance.add(toWei("150")).sub(debt).add(loanTotalValue);

      // Try to close the debt using remaining AVAX and additional 290 AVAX
      await wrappedLoan.closeLoan({value: toWei("290")});

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
        beacon: UpgradeableBeacon;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
        [
          new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
          new Asset(toBytes32('USD'), usdTokenAddress),
          new Asset(toBytes32('LINK'), linkTokenAddress)
        ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

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

      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(pool.address, exchange.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
      const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
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

      await wrappedLoan.authorizeProvider();

      await wrappedLoan.fund({value: toWei("100")});
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let investedAmount = 15000;
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
      await wrappedLoanUpdated.withdraw(toWei("150"));
      expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
      expect(await wrappedLoan.isSolvent()).to.be.false;

      // Try to liquidate the loan
      await expect(wrappedLoan.liquidateLoan(toWei("305"))).to.be.revertedWith("This operation would not result in bringing the loan back to a solvent state");

      let debt = BigNumber.from(await wrappedLoan.getDebt());
      let liquidationBonus = BigNumber.from(toWei("300")).div(10);
      let expectedOwnerAvaxBalance = initialOwnerBalance.add(toWei("150")).sub(toWei("100")).add(liquidationBonus);

      // Try to liquidate the loan using remaining AVAX and additional 100 AVAX
      await wrappedLoan.liquidateLoan(toWei("305"), {value: toWei("100")});

      // The "normal" loan should be solvent and debt should be equal to 0
      debt = BigNumber.from(fromWei(await wrappedLoan.getDebt()));
      expect(await wrappedLoan.isSolvent()).to.be.true;
      expect(debt).to.be.equal(0);

      // Make sure that the loan returned excessive AVAX after repaying the whole debt
      expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(fromWei(expectedOwnerAvaxBalance), 1);
    });
  });

  describe('A loan with debt and withdrawAsset()', () => {
    let exchange: PangolinExchange,
        loan: MockSmartLoanRedstoneProvider,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
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
        beacon: UpgradeableBeacon;

    before("deploy provider, exchange and pool", async () => {
      [,,owner, depositor] = await getFixedGasSigners(10000000);
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      usdTokenDecimalPlaces = await usdTokenContract.decimals();

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
          [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress),
            new Asset(toBytes32('LINK'), linkTokenAddress)
          ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

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

      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(pool.address, exchange.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
      const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
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

      await wrappedLoan.authorizeProvider();

      await wrappedLoan.fund({value: toWei("100")});
      await wrappedLoan.borrow(toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let investedAmount = 15000;
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
      await expect(wrappedLoan.withdrawAsset(toBytes32("USD"), parseUnits("15000", usdTokenDecimalPlaces))).to.be.revertedWith("The action may cause an account to become insolvent");
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
            beacon: UpgradeableBeacon;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);

            const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
            linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

            exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
                [
                  new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
                  new Asset(toBytes32('USD'), usdTokenAddress),
                  new Asset(toBytes32('LINK'), linkTokenAddress)
                ]);

            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

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

            await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
            await pool.connect(depositor).deposit({value: toWei("1000")});

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(pool.address, exchange.address);

            const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
            beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
            const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
            await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
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

            await wrappedLoan.authorizeProvider();

            await wrappedLoan.fund({value: toWei("100")});
            await wrappedLoan.borrow(toWei("300"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(400);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(300);
            expect(await wrappedLoan.getLTV()).to.be.equal(3000);

            const slippageTolerance = 0.03;
            let investedAmount = 15000;
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
            await wrappedLoanUpdated.withdraw(toWei("150"));
            expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
            expect(await wrappedLoan.isSolvent()).to.be.false;
            let loanAvaxBalanceAfterWithdrawal = BigNumber.from(await provider.getBalance(loan.address));

            // Try to repay the debt (plus extra 10 AVAX) using remaining AVAX
            await expect(wrappedLoan.repay(toWei("310"))).to.be.revertedWith("There is not enough funds to repay the loan");

            // Try to repay the debt (plus extra 10 AVAX) using remaining AVAX and additional 290 AVAX
            await wrappedLoan.repay(toWei("310"), {value: toWei("290")});

            // Initial balance + 150 withdrawn - (initialDebt - loanAvaxBalance)
            let expectedOwnerAvaxBalance = initialOwnerBalance.sub(toWei("290")).add(toWei("150"));
            let expectedLoanAvaxBalance = loanAvaxBalanceAfterWithdrawal.sub(debtBeforeRepayment).add(toWei("290"));
            let debt = fromWei(await wrappedLoan.getDebt());

            // The "normal" loan should be solvent and debt should be equal to 0
            expect(await wrappedLoan.isSolvent()).to.be.true;
            expect(debt).to.be.equal(0);

            // Make sure that the loan returned all of the remaining AVAX after repaying the whole debt
            expect(fromWei(await provider.getBalance(loan.address))).to.be.closeTo(fromWei(expectedLoanAvaxBalance), 0.00001);
            expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(fromWei(expectedOwnerAvaxBalance), 1);
        });
    });

  describe('A loan with an access NFT', () => {
    let exchange: PangolinExchange,
        smartLoansFactory: SmartLoansFactory,
        nftContract: Contract,
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
        beacon: UpgradeableBeacon;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);
      nftContract = (await deployContract(owner, BorrowAccessNFTArtifact)) as BorrowAccessNFT;

      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
      linkTokenContract = new ethers.Contract(linkTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
          [
            new Asset(toBytes32('AVAX'), WAVAXTokenAddress),
            new Asset(toBytes32('USD'), usdTokenAddress)
          ]);

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

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

      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await pool.connect(depositor).deposit({value: toWei("1000")});

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(pool.address, exchange.address);

      const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
      beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
      const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
      await smartLoansFactory.connect(owner).setAccessNFT(nftContract.address);
    });

    it("should fail to create a loan withouth the access NFT", async () => {
      await expect(smartLoansFactory.connect(owner).createLoan()).to.be.revertedWith("Access NFT required");
      await expect(smartLoansFactory.connect(owner).createAndFundLoan(2137)).to.be.revertedWith("Access NFT required");
    });

    it("should mint the borrower access ERC721", async () => {
      await nftContract.connect(owner).addAvailableUri(["uri_1", "uri_2"]);
      await nftContract.connect(owner).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b");
      await nftContract.connect(depositor).safeMint("700052663748001973", "0x03eda92dd1684ecfde8c5cefceb75326aad40977430849161bee9627cafa5bb43911440abe7977f3354b25ef3a1058e1332a0b414abcaf7ef960ebab37fb6a671c");
      expect(await nftContract.balanceOf(owner.address)).to.be.equal(1);
      expect(await nftContract.balanceOf(depositor.address)).to.be.equal(1);
    });

    it("should create a loan with the access NFT", async () => {
      const wrappedSmartLoansFactory = WrapperBuilder
          .mockLite(smartLoansFactory.connect(depositor))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      await wrappedSmartLoansFactory.createAndFundLoan(toWei("2"), {value: toWei("0.400000001")});

      await wrappedSmartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address_owner = await smartLoansFactory.getLoanForOwner(owner.address);
      const loan_proxy_address_depositor = await smartLoansFactory.getLoanForOwner(depositor.address);

      expect(loan_proxy_address_owner).to.be.not.equal(ZERO);
      expect(loan_proxy_address_depositor).to.be.not.equal(ZERO);
    });
  });
});

