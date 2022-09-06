import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset, deployAllFacets, deployAndInitializeLendingPool,
  deployAndInitExchangeContract, formatUnits,
  fromWei,
  getFixedGasSigners, PoolAsset,
  recompileConstantsFile,
  toBytes32,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  TokenManager, RedstoneConfigManager__factory, SmartLoanGigaChadInterface,
  SmartLoansFactory, PangolinIntermediary,
} from "../../../typechain";
import {BigNumber} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployDiamond} = require('../../../tools/diamond/deploy-diamond');
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const erc20ABI = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address owner, address spender) public view returns (uint256)'
]

describe('Smart loan',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('A loan with withdrawal', () => {
    let exchange: PangolinIntermediary,
        loan: SmartLoanGigaChadInterface,
        smartLoansFactory: SmartLoansFactory,
        wrappedLoan: any,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        tokenContracts: any = {},
        usdTokenDecimalPlaces: BigNumber,
        MOCK_PRICES: any,
        AVAX_PRICE: number,
        USD_PRICE: number;

    before("deploy provider, exchange and pool", async () => {
      [owner, depositor] = await getFixedGasSigners(10000000);

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

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
      tokenContracts['USDC'] = new ethers.Contract(TOKEN_ADDRESSES['USDC'], erc20ABI, provider);

      usdTokenDecimalPlaces = await tokenContracts['USDC'].decimals();


      let supportedAssets = [
        new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
        new Asset(toBytes32('USDC'), tokenContracts['USDC'].address)
      ]


      let tokenManager = await deployContract(
          owner,
          TokenManagerArtifact,
          [
            supportedAssets,
            lendingPools
          ]
      ) as TokenManager;

      let diamondAddress = await deployDiamond();

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(diamondAddress);

      await recompileConstantsFile(
          'local',
          "DeploymentConstants",
          [],
          tokenManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );

      exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets.map(asset => asset.assetAddress), "PangolinIntermediary") as PangolinIntermediary;

      await recompileConstantsFile(
          'local',
          "DeploymentConstants",
          [
            {
              facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
              contractAddress: exchange.address,
            }
          ],
          tokenManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );

      await deployAllFacets(diamondAddress)
    });

    it("should deploy a smart loan, fund, borrow and swap", async () => {
      await smartLoansFactory.connect(owner).createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);


      AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
      USD_PRICE = (await redstone.getPrice('USDC')).value;

      MOCK_PRICES = [
        {
          symbol: 'USDC',
          value: USD_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
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

      await tokenContracts['AVAX'].connect(owner).deposit({value: toWei("100")});
      await tokenContracts['AVAX'].connect(owner).approve(wrappedLoan.address, toWei("100"));
      await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

      await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * AVAX_PRICE, 0.1);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * AVAX_PRICE, 0.1);
      expect(await wrappedLoan.getLTV()).to.be.equal(3000);

      const slippageTolerance = 0.03;
      let usdAmount = 5000;
      let requiredAvaxAmount = USD_PRICE * usdAmount * (1 + slippageTolerance) / AVAX_PRICE;

      await wrappedLoan.swapPangolin(
          toBytes32('AVAX'),
          toBytes32('USDC'),
          toWei(requiredAvaxAmount.toString()),
          parseUnits(usdAmount.toString(), usdTokenDecimalPlaces)
      );
    });

    it('should not revert on 0 token withdrawal amount', async () => {
      await wrappedLoan.withdraw(toBytes32("USDC"), 0);
    });

    it('should revert on a withdrawal amount being higher than the available balance', async () => {
      await expect(wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("200001", usdTokenDecimalPlaces))).to.be.revertedWith("There is not enough funds to withdraw");
    });

    it('should revert on a withdrawal resulting in an insolvent loan', async () => {
      await expect(wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("5000", usdTokenDecimalPlaces))).to.be.revertedWith("The action may cause an account to become insolvent");
    });

    it('should withdraw', async () => {
      let previousBalance = formatUnits(await tokenContracts['USDC'].balanceOf(owner.address), usdTokenDecimalPlaces);
      await wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("1", usdTokenDecimalPlaces));
      expect(await tokenContracts['USDC'].balanceOf(owner.address)).to.be.equal(parseUnits((previousBalance + 1).toString(), usdTokenDecimalPlaces))
    });
  });

});

