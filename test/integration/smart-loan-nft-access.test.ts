import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import VariableUtilisationRatesCalculatorArtifact from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import SmartLoansFactoryWithAccessNFTArtifact from '../../artifacts/contracts/upgraded/SmartLoansFactoryWithAccessNFT.sol/SmartLoansFactoryWithAccessNFT.json';
import SmartLoanArtifact from '../../artifacts/contracts/SmartLoan.sol/SmartLoan.json';
import DepositIndexArtifact from '../../artifacts/contracts/DepositIndex.sol/DepositIndex.json';
import BorrowingIndexArtifact from '../../artifacts/contracts/BorrowingIndex.sol/BorrowingIndex.json';
import UpgradeableBeaconArtifact from '../../artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json';
import BorrowAccessNFTArtifact from '../../artifacts/contracts/ERC721/BorrowAccessNFT.sol/BorrowAccessNFT.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    getFixedGasSigners,
    toBytes32,
    toWei,
    deployAndInitPangolinExchangeContract,
    Asset
} from "../_helpers";
import { syncTime } from "../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
    VariableUtilisationRatesCalculator,
    PangolinExchange,
    Pool,
    MockSmartLoanRedstoneProvider__factory,
    UpgradeableBeacon,
    SmartLoansFactoryWithAccessNFT,
    BorrowAccessNFT,
    SmartLoan,
    DepositIndex,
    BorrowingIndex
} from "../../typechain";

import {OpenBorrowersRegistry__factory} from "../../typechain";
import {BigNumber, Contract} from "ethers";

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

describe('Smart loan',  () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with an access NFT', () => {
        let exchange: PangolinExchange,
            smartLoansFactory: SmartLoansFactoryWithAccessNFT,
            smartLoan: SmartLoan,
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
            const depositIndex = (await deployContract(owner, DepositIndexArtifact, [pool.address])) as DepositIndex;
            const borrowingIndex = (await deployContract(owner, BorrowingIndexArtifact, [pool.address])) as BorrowingIndex;
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

            await pool.initialize(
                variableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address
            );
            await pool.connect(depositor).deposit({value: toWei("1000")});

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryWithAccessNFTArtifact) as SmartLoansFactoryWithAccessNFT;
            smartLoan = await deployContract(owner, SmartLoanArtifact) as SmartLoan;
            await smartLoansFactory.initialize(smartLoan.address);

            const beaconAddress = await smartLoansFactory.upgradeableBeacon.call(0);
            beacon = (await new ethers.Contract(beaconAddress, UpgradeableBeaconArtifact.abi) as UpgradeableBeacon).connect(owner);
            const mockSmartLoan = await (new MockSmartLoanRedstoneProvider__factory(owner).deploy());
            await beacon.connect(owner).upgradeTo(mockSmartLoan.address);
            await smartLoansFactory.connect(owner).setAccessNFT(nftContract.address);
        });

        it("should fail to create a loan without the access NFT", async () => {
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