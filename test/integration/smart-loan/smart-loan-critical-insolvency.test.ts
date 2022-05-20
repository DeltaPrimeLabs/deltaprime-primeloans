import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import SmartLoanArtifact from '../../../artifacts/contracts/SmartLoan.sol/SmartLoan.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset,
  deployAndInitPangolinExchangeContract,
  formatUnits,
  fromWei,
  getFixedGasSigners,
  recompileSmartLoan,
  toBytes32,
  toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
  CompoundingIndex,
  ERC20Pool,
  MockSmartLoanRedstoneProvider,
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
const usdTokenAddress = '0xc7198437980c041c805a1edcba50c1ce5db95118';
const linkTokenAddress = '0x5947bb275c521040051d82396192181b413227a3';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

const SMART_LOAN_ALWAYS_SOLVENT = "MockSmartLoanAlwaysSolvent";
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


  // describe('Repaying critically insolvent loan with additional AVAX supplied', () => {
  //   let exchange: PangolinExchange,
  //       loan: SmartLoan,
  //       smartLoansFactory: SmartLoansFactory,
  //       wrappedLoan: any,
  //       wrappedLoanUpdated: any,
  //       pool: ERC20Pool,
  //       owner: SignerWithAddress,
  //       depositor: SignerWithAddress,
  //       wavaxTokenContract: Contract,
  //       usdTokenContract: Contract,
  //       yakRouterContract: Contract,
  //       usdTokenDecimalPlaces: BigNumber,
  //       MOCK_PRICES: any,
  //       MOCK_PRICES_UPDATED: any,
  //       AVAX_PRICE: number,
  //       USD_PRICE: number,
  //       artifact: any,
  //       implementation: any;
  //
  //   before("deploy provider, exchange and pool", async () => {
  //     [owner, depositor] = await getFixedGasSigners(10000000);
  //
  //     const variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
  //     pool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
  //     wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider);
  //     usdTokenContract = new ethers.Contract(usdTokenAddress, erc20ABI, provider);
  //
  //     yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
  //
  //     exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress,
  //         [
  //           new Asset(toBytes32('AVAX'), wavaxTokenAddress),
  //           new Asset(toBytes32('USD'), usdTokenAddress)
  //         ]);
  //
  //     const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
  //     const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
  //     const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
  //
  //     usdTokenDecimalPlaces = await usdTokenContract.decimals();
  //
  //     AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
  //     USD_PRICE = (await redstone.getPrice('USDT')).value;
  //
  //     MOCK_PRICES = [
  //       {
  //         symbol: 'USD',
  //         value: USD_PRICE
  //       },
  //       {
  //         symbol: 'AVAX',
  //         value: AVAX_PRICE
  //       }
  //     ]
  //
  //     await pool.initialize(
  //         variableUtilisationRatesCalculator.address,
  //         borrowersRegistry.address,
  //         depositIndex.address,
  //         borrowingIndex.address,
  //         wavaxTokenAddress
  //     );
  //
  //     await wavaxTokenContract.connect(depositor).deposit({value: toWei("1000")});
  //     await wavaxTokenContract.connect(depositor).approve(pool.address, toWei("1000"));
  //     await pool.connect(depositor).deposit(toWei("1000"));
  //
  //     smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
  //
  //     artifact = await recompileSmartLoan(SMART_LOAN_MOCK, [0], { 'AVAX': pool.address }, exchange.address, yakRouterContract.address, 'mock');
  //     implementation = await deployContract(owner, artifact) as SmartLoan;
  //
  //     await smartLoansFactory.initialize(implementation.address);
  //   });
  //
  //   it("should deploy a smart loan, fund, borrow and swap", async () => {
  //     await smartLoansFactory.connect(owner).createLoan();
  //
  //     const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
  //     loan = ((await new ethers.Contract(loanAddress, SmartLoanArtifact.abi)) as SmartLoan).connect(owner);
  //
  //
  //     wrappedLoan = WrapperBuilder
  //         .mockLite(loan)
  //         .using(
  //             () => {
  //               return {
  //                 prices: MOCK_PRICES,
  //                 timestamp: Date.now()
  //               }
  //             })
  //
  //     await wavaxTokenContract.connect(owner).deposit({value: toWei("100")});
  //     await wavaxTokenContract.connect(owner).approve(wrappedLoan.address, toWei("100"));
  //     await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
  //
  //     await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));
  //
  //     expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * AVAX_PRICE, 0.1);
  //     expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * AVAX_PRICE, 0.1);
  //     expect(await wrappedLoan.getLTV()).to.be.equal(3000);
  //
  //     const slippageTolerance = 0.03;
  //     let usdAmount = 5000;
  //     let requiredAvaxAmount = USD_PRICE * usdAmount * (1 + slippageTolerance) / AVAX_PRICE;
  //
  //     await wrappedLoan.swap(
  //         toBytes32('AVAX'),
  //         toBytes32('USD'),
  //         toWei(requiredAvaxAmount.toString()),
  //         parseUnits(usdAmount.toString(), usdTokenDecimalPlaces)
  //     );
  //   });
  //
  //
  //   it("should withdraw collateral and part of borrowed funds, bring prices back to normal and repay with extra AVAX", async () => {
  //     // Define "updated" (USD x 1000) prices and build an updated wrapped loan
  //     AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
  //     USD_PRICE = (await redstone.getPrice('USDT')).value;
  //
  //     MOCK_PRICES_UPDATED = [
  //       {
  //         symbol: 'USD',
  //         value: USD_PRICE * 1000
  //       },
  //       {
  //         symbol: 'AVAX',
  //         value: AVAX_PRICE
  //       }
  //     ]
  //
  //     wrappedLoanUpdated = WrapperBuilder
  //         .mockLite(loan)
  //         .using(
  //             () => {
  //               return {
  //                 prices: MOCK_PRICES_UPDATED,
  //                 timestamp: Date.now()
  //               }
  //             })
  //
  //     // Withdraw funds using the updated prices and make sure the "standard" wrappedLoan is Insolvent as a consequence
  //     let debtBeforeRepayment = fromWei(await wrappedLoan.getDebt());
  //     expect(await wrappedLoan.isSolvent()).to.be.true;
  //     await wrappedLoanUpdated.withdraw(toBytes32("AVAX"), toWei("150"));
  //     expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
  //     expect(await wrappedLoan.isSolvent()).to.be.false;
  //     let loanAvaxBalanceAfterWithdrawal = fromWei(await wavaxTokenContract.balanceOf(loan.address));
  //
  //     let ownerBalanceBeforeRepay = fromWei(await provider.getBalance(owner.address));
  //
  //     // Try to repay the debt using remaining AVAX
  //     await expect(wrappedLoan.repay(toBytes32("AVAX"), await pool.getBorrowed(wrappedLoan.address))).to.be.revertedWith("There is not enough funds to repay the loan");
  //
  //     // Try to repay the debt using remaining AVAX and additional 290 AVAX
  //     await wrappedLoan.repay(toBytes32("AVAX"), await pool.getBorrowed(wrappedLoan.address), {value: toWei("290")});
  //
  //     // Initial balance - (initialDebt - loanAvaxBalance)
  //     let expectedOwnerAvaxBalance = ownerBalanceBeforeRepay - 290;
  //     let expectedLoanAvaxBalance = loanAvaxBalanceAfterWithdrawal - debtBeforeRepayment / AVAX_PRICE + 290;
  //     let debt = fromWei(await wrappedLoan.getDebt());
  //
  //     // The "normal" loan should be solvent and debt should be equal to 0
  //     expect(await wrappedLoan.isSolvent()).to.be.true;
  //     expect(debt).to.be.closeTo(0, 0.0001);
  //
  //     // Make sure that the loan returned all of the remaining AVAX after repaying the whole debt
  //     expect(fromWei(await wavaxTokenContract.balanceOf(loan.address))).to.be.closeTo(expectedLoanAvaxBalance, 0.5);
  //     expect(fromWei(await provider.getBalance(owner.address))).to.be.closeTo(expectedOwnerAvaxBalance, 0.5);
  //   });
  // });
});

