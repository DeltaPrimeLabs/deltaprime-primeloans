import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact
    from '../../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import ERC20PoolArtifact from '../../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import MockBorrowAccessNFTArtifact
    from '../../../artifacts/contracts/mock/MockBorrowAccessNFT.sol/MockBorrowAccessNFT.json';

import SmartLoansFactoryWithAccessNFTArtifact
    from '../../../artifacts/contracts/upgraded/SmartLoansFactoryWithAccessNFT.sol/SmartLoansFactoryWithAccessNFT.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/token_addresses.json';
import {
    Asset,
    deployAndInitPangolinExchangeContract,
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
    ERC20Pool,
    MockBorrowAccessNFT, MockSmartLoanLogicFacetRedstoneProvider, MockSmartLoanLogicFacetRedstoneProvider__factory,
    OpenBorrowersRegistry__factory,
    PangolinExchange,
    SmartLoansFactoryWithAccessNFT,
    VariableUtilisationRatesCalculator,
    YieldYakRouter,
    YieldYakRouter__factory
} from "../../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

import {deployDiamond, deployFacet} from '../../../tools/diamond/deploy-diamond';
const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;
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

    describe('A loan with an access NFT', () => {
        let exchange: PangolinExchange,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            loan: MockSmartLoanLogicFacetRedstoneProvider,
            wrappedLoan: any,
            usdPool: ERC20Pool,
            wavaxPool: ERC20Pool,
            wavaxTokenContract: Contract,
            nftContract: Contract,
            yakRouterContract: YieldYakRouter,
            smartLoansFactory: SmartLoansFactoryWithAccessNFT,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            diamondAddress: any;

        before("deploy provider, exchange and pool", async () => {
            diamondAddress = await deployDiamond();
            [owner, depositor] = await getFixedGasSigners(10000000);
            nftContract = (await deployContract(owner, MockBorrowAccessNFTArtifact)) as MockBorrowAccessNFT;

            yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());
            const variableUtilisationRatesCalculatorERC20 = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
            usdPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;
            wavaxPool = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

            wavaxTokenContract = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);

            yakRouterContract = await (new YieldYakRouter__factory(owner).deploy());

            const borrowersRegistryERC20 = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndexERC20 = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;
            const borrowingIndexERC20 = (await deployContract(owner, CompoundingIndexArtifact, [wavaxPool.address])) as CompoundingIndex;


            AVAX_PRICE = (await redstone.getPrice('AVAX')).value;

            MOCK_PRICES = [
                {
                    symbol: 'AVAX',
                    value: AVAX_PRICE
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

            exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [
                new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX'])
            ]);

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryWithAccessNFTArtifact) as SmartLoansFactoryWithAccessNFT;
            await recompileSmartLoanLib(
                'SmartLoanLib',
                [1],
                [TOKEN_ADDRESSES['AVAX']],
                { "AVAX": wavaxPool.address},
                exchange.address,
                yakRouterContract.address,
                'lib'
            );
            await deployFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, []);

            await smartLoansFactory.initialize(diamondAddress);

            await smartLoansFactory.connect(owner).setAccessNFT(nftContract.address);
        });

        it("should fail to create a loan without the access NFT", async () => {
            await expect(smartLoansFactory.connect(owner).createLoan()).to.be.revertedWith("Access NFT required");
            await expect(smartLoansFactory.connect(owner).createLoan()).to.be.revertedWith("Access NFT required");
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

            await wrappedSmartLoansFactory.createLoan();

            await wrappedSmartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

            const loanFactory = await ethers.getContractFactory("MockSmartLoanLogicFacetRedstoneProvider");
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

            expect(loan).to.be.not.equal(ZERO);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
        });
    });
});