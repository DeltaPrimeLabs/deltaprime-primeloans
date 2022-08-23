import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import MockBorrowAccessNFTArtifact
    from '../../../artifacts/contracts/mock/MockBorrowAccessNFT.sol/MockBorrowAccessNFT.json';

import SmartLoansFactoryWithAccessNFTArtifact
    from '../../../artifacts/contracts/upgraded/SmartLoansFactoryWithAccessNFT.sol/SmartLoansFactoryWithAccessNFT.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
    Asset, deployAllFaucets, deployAndInitializeLendingPool,
    fromWei,
    getFixedGasSigners, PoolAsset,
    recompileSmartLoanLib,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
    CompoundingIndex,
    Pool,
    MockBorrowAccessNFT,
    OpenBorrowersRegistry__factory, TokenManager, RedstoneConfigManager__factory,
    SmartLoansFactoryWithAccessNFT,
    VariableUtilisationRatesCalculator, SmartLoanGigaChadInterface,
} from "../../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

import {deployDiamond, deployFacet} from '../../../tools/diamond/deploy-diamond';
const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;

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
        let owner: SignerWithAddress,
            depositor: SignerWithAddress,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            tokenContracts: any = {},
            nftContract: Contract,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            smartLoansFactory: SmartLoansFactoryWithAccessNFT;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"], 30));

            nftContract = (await deployContract(owner, MockBorrowAccessNFTArtifact)) as MockBorrowAccessNFT;

            let lendingPools = [];
            for (const token of [
                {'name': 'AVAX', 'airdropList': [depositor]}
            ]) {
                let {poolContract, tokenContract} = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
                await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
                await poolContract.connect(depositor).deposit(toWei("1000"));
                lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
                tokenContracts[token.name] = tokenContract;
            }

            let supportedAssets = [
                new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
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


            smartLoansFactory = await deployContract(owner, SmartLoansFactoryWithAccessNFTArtifact) as SmartLoansFactoryWithAccessNFT;
            await smartLoansFactory.initialize(diamondAddress);
            await smartLoansFactory.connect(owner).setAccessNFT(nftContract.address);

            await recompileSmartLoanLib(
                "SmartLoanConfigLib",
                [],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib',
            );

            await deployAllFaucets(diamondAddress)
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
            AVAX_PRICE = (await redstone.getPrice('AVAX')).value;

            MOCK_PRICES = [
                {
                    symbol: 'AVAX',
                    value: AVAX_PRICE
                },
            ];
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

            const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, owner);

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