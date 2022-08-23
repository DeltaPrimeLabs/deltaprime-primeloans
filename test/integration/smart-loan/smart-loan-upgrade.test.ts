import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import PoolManagerArtifact from '../../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
  Asset,
  deployAllFaucets,
  deployAndInitializeLendingPool,
  deployAndInitExchangeContract,
  fromWei,
  getFixedGasSigners,
  PoolAsset,
  recompileSmartLoanLib,
  toBytes32,
  toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
  PangolinIntermediary,
  PoolManager,
  RedstoneConfigManager__factory,
  SmartLoanGigaChadInterface,
  SmartLoansFactory
} from "../../../typechain";

chai.use(solidity);

const {deployDiamond, replaceFacet} = require('../../../tools/diamond/deploy-diamond');
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

describe('Smart loan - upgrading',  () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('Check basic logic before and after upgrade', () => {
    let exchange: PangolinIntermediary,
      loan: SmartLoanGigaChadInterface,
      wrappedLoan: any,
      smartLoansFactory: SmartLoansFactory,
      owner: SignerWithAddress,
      other: SignerWithAddress,
      oracle: SignerWithAddress,
      poolManager: any,
      borrower: SignerWithAddress,
      depositor: SignerWithAddress,
      tokenContracts: any = {},
      AVAX_PRICE: number,
      USD_PRICE: number,
      MOCK_PRICES: any,
      diamondAddress: any;

    before("should deploy provider, exchange, loansFactory and WrappedNativeTokenPool", async () => {
      [owner, oracle, depositor, borrower, other] = await getFixedGasSigners(10000000);

      let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));

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

      AVAX_PRICE = (await redstone.getPrice('AVAX', { provider: "redstone-avalanche-prod-node-3"})).value;
      USD_PRICE = (await redstone.getPrice('USDC', { provider: "redstone-avalanche-prod-node-3"})).value;

      MOCK_PRICES = [
        {
          symbol: 'USDC',
          value: USD_PRICE
        },
        {
          symbol: 'AVAX',
          value: AVAX_PRICE
        }
      ];

      let supportedAssets = [
        new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
        new Asset(toBytes32('USDC'), tokenContracts['USDC'].address)
      ]

      poolManager = await deployContract(
          owner,
          PoolManagerArtifact,
          [
            supportedAssets,
            lendingPools
          ]
      ) as PoolManager;

      diamondAddress = await deployDiamond();

      smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
      await smartLoansFactory.initialize(diamondAddress);

      await recompileSmartLoanLib(
          "SmartLoanConfigLib",
          [],
          poolManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );

      exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

      await recompileSmartLoanLib(
          "SmartLoanConfigLib",
          [
            {
              facetPath: './contracts/faucets/PangolinDEXFacet.sol',
              contractAddress: exchange.address,
            }
          ],
          poolManager.address,
          redstoneConfigManager.address,
          diamondAddress,
          smartLoansFactory.address,
          'lib'
      );
      await deployAllFaucets(diamondAddress)
    });

    it("should create a loan", async () => {
      const wrappedSmartLoansFactory = WrapperBuilder
          .mockLite(smartLoansFactory.connect(borrower))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              });

      await wrappedSmartLoansFactory.createLoan();

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);
      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);
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




    it("should check if only one loan per owner is allowed", async () => {
      await expect(smartLoansFactory.connect(borrower).createLoan()).to.be.revertedWith("Only one loan per owner is allowed");
      await expect(smartLoansFactory.connect(borrower).createAndFundLoan(toBytes32("AVAX"), TOKEN_ADDRESSES['AVAX'],0, toBytes32(""), 0)).to.be.revertedWith("Only one loan per owner is allowed");
    });

    it("should check if only one loan per owner is allowed during transferOwnership", async () => {
      await smartLoansFactory.connect(borrower).proposeOwnershipTransfer(other.address);
      let otherWrappedSmartLoansFactory = WrapperBuilder
          .mockLite(smartLoansFactory.connect(other))
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              });

      await otherWrappedSmartLoansFactory.createLoan();
      await expect(smartLoansFactory.connect(borrower).proposeOwnershipTransfer(other.address)).to.be.revertedWith("New owner already has a loan");
      await expect(wrappedLoan.connect(borrower).transferOwnership(other.address)).to.be.revertedWith("New owner already has a loan");
    });


    it("should fund a loan", async () => {
      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);

      await tokenContracts['AVAX'].connect(borrower).deposit({value: toWei("2")});
      await tokenContracts['AVAX'].connect(borrower).approve(wrappedLoan.address, toWei("2"));
      await wrappedLoan.fund(toBytes32("AVAX"), toWei("2"));

      expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(2 * AVAX_PRICE, 0.1);
      expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
      expect(await wrappedLoan.getLTV()).to.be.equal(0);
    });

    it("should not allow to re-initialize", async () => {
      await expect(wrappedLoan.initialize(owner.address)).to.be.revertedWith('DiamondInit: contract is already initialized');
    });

    it("should not allow to upgrade from non-owner", async () => {
      const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, borrower);
      await expect(diamondCut.diamondCut([], ethers.constants.AddressZero, [])).to.be.revertedWith('DiamondStorageLib: Must be contract owner');
    });


    it("should upgrade", async () => {
      await replaceFacet("MockSolvencyFacetConstantDebt", diamondAddress, ['getDebt'])

      const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);
      loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

      wrappedLoan = WrapperBuilder
          .mockLite(loan)
          .using(
              () => {
                return {
                  prices: MOCK_PRICES,
                  timestamp: Date.now()
                }
              })

      //The mock loan has a hardcoded debt of 2137
      expect(await wrappedLoan.getDebt()).to.be.equal(2137);
    });
  });
});
