import {ethers, waffle} from 'hardhat'
import chai from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';
import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {Asset, deployAndInitPangolinExchangeContract, getFixedGasSigners, toBytes32, toWei,} from "../_helpers";
import {syncTime} from "../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  MockSmartLoanRedstoneProvider,
  SmartLoanSinglePriceAware,
  MockSmartLoanRedstoneProvider__factory,
  SmartLoanSinglePriceAware__factory,
  OpenBorrowersRegistry__factory,
  PangolinExchange,
  Pool,
  VariableUtilisationRatesCalculator
} from "../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";

const addresses = require("../../common/token_addresses.json");

chai.use(solidity);

const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]
const decimalPlaces = {
  AVAX: 18,
  ETH: 18,
  BTC: 8,
  LINK: 18,
  PNG: 18,
  XAVA: 18,
  FRAX: 18,
  USDT: 6
}


const assetsAmounts = {
  ETH: 0.01,
  BTC: 0.001,
  LINK: 10,
  PNG: 20,
  XAVA: 10,
  FRAX: 20,
  USDT: 10
}

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('A loan without debt', () => {
    let exchange: PangolinExchange,
      loan: MockSmartLoanRedstoneProvider,
      loanSinglePriceAware: SmartLoanSinglePriceAware,
      wrappedLoan: any,
      wrappedLoanSinglePriceAware: any,
      pool: Pool,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      usdTokenContract: Contract,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      BTC_PRICE: number,
      ETH_PRICE: number,
      LINK_PRICE: number,
      PNG_PRICE: number,
      XAVA_PRICE: number,
      FRAX_PRICE: number,
      USDT_PRICE: number;



    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);


      const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);

      exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
          new Asset(toBytes32('ETH'), addresses["ETH"]),
          new Asset(toBytes32('BTC'), addresses["BTC"]),
          new Asset(toBytes32('LINK'), addresses["LINK"]),
          new Asset(toBytes32('PNG'), addresses["PNG"]),
          new Asset(toBytes32('XAVA'), addresses["XAVA"]),
          new Asset(toBytes32('FRAX'), addresses["FRAX"]),
          new Asset(toBytes32('USDT'), addresses["USDT"]),
        ]
      );

      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      ETH_PRICE = (await redstone.getPrice('ETH')).value;
      BTC_PRICE = (await redstone.getPrice('BTC')).value;
      LINK_PRICE = (await redstone.getPrice('LINK')).value;
      PNG_PRICE = (await redstone.getPrice('PNG')).value;
      XAVA_PRICE = (await redstone.getPrice('XAVA')).value;
      FRAX_PRICE = (await redstone.getPrice('FRAX')).value;
      USDT_PRICE = (await redstone.getPrice('USDT')).value;

      MOCK_PRICES = [
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
        },
        {
          symbol: 'LINK',
          value: LINK_PRICE
        },
        {
          symbol: 'PNG',
          value: PNG_PRICE
        },
        {
          symbol: 'XAVA',
          value: XAVA_PRICE
        },
        {
          symbol: 'FRAX',
          value: FRAX_PRICE
        },
        {
          symbol: 'USDT',
          value: USDT_PRICE
        }
      ]

      await pool.initialize(variableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
      await pool.connect(depositor).deposit({value: toWei("1000")});
    });

    it("should deploy a smart loan", async () => {
      loanSinglePriceAware = await (new SmartLoanSinglePriceAware__factory(owner).deploy());
      loan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
      await loanSinglePriceAware.initialize(exchange.address, pool.address);
      await loan.initialize(exchange.address, pool.address, toWei("0"));

      wrappedLoanSinglePriceAware = WrapperBuilder
          .mockLite(loanSinglePriceAware)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              });

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

    it("should fund loans", async () => {
      await wrappedLoan.fund({value: toWei("20000")});
      await wrappedLoanSinglePriceAware.fund({value: toWei("20000")});
    });

    it("should buy assets", async () => {

      await Object.entries(assetsAmounts).forEach(
          async (entry) => {
            await invest(wrappedLoanSinglePriceAware, entry[0], entry[1]);
            await invest(wrappedLoan, entry[0], entry[1]);
          }
      )

      // //previous version
      // await wrappedLoanSinglePriceAware.executeGetAllAssetsPrices();
      await wrappedLoanSinglePriceAware.executeGetTotalValue();
      //
      // //current version
      // await wrappedLoan.executeGetAllAssetsPrices();
      await wrappedLoan.executeGetTotalValue();


      async function invest(loan: any, token: string, amount: number) {
        let tokenPrice = MOCK_PRICES.find((el: any) => el.symbol == token).value;
        const slippageTolerance = 0.03;

        const requiredAvaxAmount = tokenPrice * amount * (1 + slippageTolerance) / AVAX_PRICE;

        await loan.invest(
            toBytes32(token),
            parseUnits(amount.toString(), (decimalPlaces as any)[token].toString()),
            toWei(requiredAvaxAmount.toString())
        );
      }
    });
  });
});

