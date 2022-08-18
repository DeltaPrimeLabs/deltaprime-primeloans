import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
  Asset,
  deployAllFaucets,
  deployAndInitializeLendingPool,
  formatUnits,
  fromWei,
  getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  PoolManager,
  RedstoneConfigManager__factory,
  SmartLoanGigaChadInterface,
  SmartLoansFactory,
  PangolinExchange,
} from "../../../typechain";
import {BigNumber} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

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
      loan: SmartLoanGigaChadInterface,
      wrappedLoan: any,
      owner: SignerWithAddress,
      depositor: SignerWithAddress,
      tokenContracts: any = {},
      usdTokenDecimalPlaces: BigNumber,
      MOCK_PRICES: any,
      AVAX_PRICE: number,
      USD_PRICE: number,
      ETH_PRICE: number;

    before("deploy factory, exchange, WrappedNativeTokenPool and usdPool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));

      let lendingPools = [];
      for (const token of [
        {'name': 'MCKUSD', 'airdropList': [owner.address, depositor.address]},
        {'name': 'AVAX', 'airdropList': [depositor]}
      ]) {
        let {poolContract, tokenContract} = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
        await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
        await poolContract.connect(depositor).deposit(toWei("1000"));
        lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
        tokenContracts[token.name] = tokenContract;
      }
      tokenContracts['ETH'] =  new ethers.Contract(TOKEN_ADDRESSES['ETH'], wavaxAbi, provider);

      usdTokenDecimalPlaces = BigNumber.from(await tokenContracts['MCKUSD'].decimals());

      let supportedAssets = [
        new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
        new Asset(toBytes32('MCKUSD'), tokenContracts['MCKUSD'].address),
        new Asset(toBytes32('ETH'), TOKEN_ADDRESSES['ETH'])
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
          'lib'
      );

      await deployAllFaucets(diamondAddress)
    });

    it("should deploy a smart loan", async () => {
      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDC')).value;
      ETH_PRICE = (await redstone.getPrice('ETH')).value;

      MOCK_PRICES = [
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        },
        {
          symbol: 'MCKUSD',
          value: USD_PRICE
        },
        {
          symbol: 'ETH',
          value: ETH_PRICE
        }
      ];

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
    });

    it("should fund a loan", async () => {
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);

      expect(fromWei(await tokenContracts['MCKUSD'].connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.1);

      await tokenContracts['MCKUSD'].connect(owner).approve(wrappedLoan.address, parseUnits("1000", usdTokenDecimalPlaces));
      await wrappedLoan.fund(toBytes32("MCKUSD"), parseUnits("1000", usdTokenDecimalPlaces));

      expect(formatUnits(await tokenContracts['MCKUSD'].connect(owner).balanceOf(wrappedLoan.address), usdTokenDecimalPlaces)).to.be.closeTo(1000, 0.1);

      tokenContracts['AVAX'].connect(owner).deposit({value: toWei("1000")});
      await tokenContracts['AVAX'].connect(owner).approve(wrappedLoan.address, toWei("1000"));

      expect(fromWei(await tokenContracts['AVAX'].connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.1);

      await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

      expect(fromWei(await tokenContracts['AVAX'].connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100, 0.1);

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(AVAX_PRICE * 100 + 1000, 2);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should withdraw part of funds", async () => {
      expect(formatUnits(await tokenContracts['MCKUSD'].connect(owner).balanceOf(wrappedLoan.address), usdTokenDecimalPlaces)).to.be.closeTo(1000, 0.1);

      await wrappedLoan.withdraw(toBytes32("MCKUSD"), parseUnits("100", usdTokenDecimalPlaces));

      expect(formatUnits(await tokenContracts['MCKUSD'].connect(owner).balanceOf(wrappedLoan.address), usdTokenDecimalPlaces)).to.be.closeTo(900, 0.1);

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(AVAX_PRICE * 100 + 900, 2);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should buy an asset from funded", async () => {
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(AVAX_PRICE * 100 + 900, 2);
      const expectedEthAmount = 1;

      const slippageTolerance = 0.03;
      const requiredAvaxAmount = ETH_PRICE * expectedEthAmount * (1 + slippageTolerance) / AVAX_PRICE;

      expect(fromWei(await tokenContracts['AVAX'].connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100, 0.1);

      await wrappedLoan.swapPangolin(
        toBytes32('AVAX'),
        toBytes32('ETH'),
        toWei(requiredAvaxAmount.toString()),
        toWei(expectedEthAmount.toString())
      )

      expect(fromWei(await tokenContracts['AVAX'].connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(100 - requiredAvaxAmount, 0.1);
      expect(fromWei((await wrappedLoan.getAllAssetsBalances())[0])).to.be.closeTo(100 - requiredAvaxAmount, 0.05);
      expect(fromWei(await tokenContracts['ETH'].connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(1, 0.05);
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
          if (token.symbol == 'MCKUSD') {
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

      await wrappedLoan.swapPangolin(
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

