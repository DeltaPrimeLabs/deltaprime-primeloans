import chai, {expect} from 'chai'
import SmartLoansFactoryArtifact from '../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import { formatEther, parseEther } from 'viem';
import {
    ILBFactory,
    ILBRouter,
    MockToken,
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {SmartLoansFactory, VPrimeMock, MockTokenManager} from "../../typechain";
import {ethers, waffle, network} from 'hardhat'
import {Contract} from "ethers";
import {solidity} from "ethereum-waffle";
import MockTokenManagerArtifact from '../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import VPrimeArtifact from '../../artifacts/contracts/token/vPrime.sol/vPrime.json';
import SPrimeArtifact from '../../artifacts/contracts/token/sPrime.sol/SPrime.json';
import VPrimeControllerArtifact from '../../artifacts/contracts/token/mock/vPrimeControllerAvalancheMock.sol/vPrimeControllerAvalancheMock.json';
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import { Asset, PoolAsset, PoolInitializationObject, convertAssetsListToSupportedAssets, convertTokenPricesMapToMockPrices, deployPools, getFixedGasSigners, getRedstonePrices, getTokensPricesMap } from '../_helpers';
import { LBPairV21ABI } from '@traderjoe-xyz/sdk-v2';
import { deployDiamond } from '../../tools/diamond/deploy-diamond';
export const erc20ABI = require('../abis/ERC20.json');

const {deployContract} = waffle;
chai.use(solidity);

const spotUniform = {
    deltaIds: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
    distributionX: [
      0, 0, 0, 0, 0, 0.090909, 0.181818, 0.181818, 0.181818, 0.181818, 0.181818
    ].map((el) => parseEther(`${el}`)),
    distributionY: [
      0.181818, 0.181818, 0.181818, 0.181818, 0.181818, 0.090909, 0, 0, 0, 0, 0
    ].map((el) => parseEther(`${el}`))
};

const LBRouterAbi = [
    'function addLiquidity((address tokenX, address tokenY, uint256 binStep, uint256 amountX, uint256 amountY, uint256 amountXMin, uint256 amountYMin, uint256 activeIdDesired, uint256 idSlippage, int256[] deltaIds, uint256[] distributionX, uint256[] distributionY, address to, address refundTo, uint256 deadline))',
    'function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin, (uint256[] pairBinSteps, uint8[] versions, address[] tokenPath), address to,uint256 deadline) external returns (uint256 amountOut)',
    'event DepositedToBins(address indexed sender,address indexed to,uint256[] ids,bytes32[] amounts)'
];
  
const LBFactoryAbi = [
    'function createLBPair(address, address, uint24, uint16) external returns (address)',
]

describe("SPrime", function () {
    // Contract Factory
    let SPrimeFactory, PrimeFactory, LBRouter, PositionManagerFactory, smartLoansFactory;
    // Contracts
    let wavax, prime, usdc, sPrime, positionManager, vPrime, vPrimeControllerContract, LBFactory;
    const initaialBin = 8388604;
    let lendingPools: Array<PoolAsset> = [],
        supportedAssets: Array<Asset>,
        owner: SignerWithAddress,
        addr1: SignerWithAddress,
        addr2: SignerWithAddress,
        addr3: SignerWithAddress,
        whale: SignerWithAddress,
        poolContracts: Map<string, Contract> = new Map(),
        tokenContracts: Map<string, Contract> = new Map();

    beforeEach(async function () {
        [owner, addr1, addr2, addr3] = await getFixedGasSigners(10000000);

        SPrimeFactory = await ethers.getContractFactory("SPrime");
        PositionManagerFactory = await ethers.getContractFactory("PositionManager");
        
        let user1 = await addr1.getAddress();
        let user2 = await addr2.getAddress();

        PrimeFactory = await ethers.getContractFactory("Prime");
        prime = await PrimeFactory.deploy(parseEther("1000000"));
        positionManager = await PositionManagerFactory.deploy();

        wavax = await ethers.getContractAt("WETH9", '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7');
        usdc = await ethers.getContractAt("MockUsd", "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e");

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xBA12222222228d8Ba445958a75a0704d566BF2C8"],
        });
        whale = await ethers.provider.getSigner("0xBA12222222228d8Ba445958a75a0704d566BF2C8");

        let assetsList = ['AVAX', 'USDC'];

        let diamondAddress = await deployDiamond();
        smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

        let tokenManager = await deployContract(
            owner,
            MockTokenManagerArtifact,
            []
        ) as MockTokenManager;
        let poolNameAirdropList: Array<PoolInitializationObject> = [
            {name: 'AVAX', airdropList: [addr2, addr1]},
            {name: 'USDC', airdropList: [addr2, addr1]}
        ];
        await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, addr1, 1000, 'AVAX', [], tokenManager.address);

        let tokensPrices = await getTokensPricesMap(
            assetsList,
            "avalanche",
            getRedstonePrices,
            []
        );

        let MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
        MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
        supportedAssets = convertAssetsListToSupportedAssets(assetsList);

        await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
        await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);
        await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

        vPrime = await deployContract(
            owner,
            VPrimeArtifact,
            []
        ) as VPrimeMock;
        await vPrime.initialize(smartLoansFactory.address);

        await prime.transfer(user1, parseEther("100000"));
        await prime.transfer(user2, parseEther("100000"));

        await usdc.connect(whale).transfer(user2, "10000000000");
        await usdc.connect(whale).transfer(user1, "10000000000");

        LBFactory = new ethers.Contract('0x8e42f2F4101563bF679975178e880FD87d3eFd4e', LBFactoryAbi) as ILBFactory;
        LBRouter = new ethers.Contract('0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30', LBRouterAbi) as ILBRouter;
        await wavax.connect(owner).deposit({value: parseEther("100")});
        await wavax.transfer(user1, parseEther("10"));
        await wavax.transfer(user2, parseEther("10"));
        
        await LBFactory.connect(owner).createLBPair(prime.address, wavax.address, initaialBin, 25);

        sPrime = await deployContract(
            owner,
            SPrimeArtifact,
            []
        ) as Contract;
        await sPrime.initialize(prime.address, wavax.address, "PRIME-AVAX", spotUniform.distributionX, spotUniform.distributionY, spotUniform.deltaIds, positionManager.address);

        sPrime = WrapperBuilder.wrap(
            sPrime.connect(owner)
        ).usingSimpleNumericMock({
            mockSignersCount: 3,
            dataPoints: MOCK_PRICES,
        });

        vPrimeControllerContract = await deployContract(
            owner,
            VPrimeControllerArtifact,
            []
        ) as Contract;

        await vPrimeControllerContract.initialize([sPrime.address], tokenManager.address, vPrime.address);
        vPrimeControllerContract = WrapperBuilder.wrap(
            vPrimeControllerContract
        ).usingSimpleNumericMock({
            mockSignersCount: 3,
            dataPoints: MOCK_PRICES,
        });

        await positionManager.setSPrime(sPrime.address);
        await tokenManager.connect(owner).setVPrimeControllerAddress(vPrimeControllerContract.address);
        await poolContracts.get('AVAX')!.setTokenManager(tokenManager.address);
        await poolContracts.get('USDC')!.setTokenManager(tokenManager.address);
        await vPrime.connect(owner).setVPrimeControllerAddress(vPrimeControllerContract.address);
        await sPrime.connect(owner).setVPrimeControllerAddress(vPrimeControllerContract.address);
        await vPrimeControllerContract.connect(owner).updateBorrowersRegistry(smartLoansFactory.address);
    });

    describe("Deposit", function () {
        it("Should deposit correctly", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);

            const nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);
            const tokenId = await sPrime.getUserTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);
            expect(position.centerId).to.equal(initaialBin);
        });

        it("Should deposit two times without rebalance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);

            let nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);
            // Should revert as it didn't provide the active id and slippage for the rebalancing
            await expect(sPrime.connect(addr1).deposit(0, 0, parseEther("1000"), parseEther("1"), true, 10)).to.be.reverted;
            // Provide the second position without any rebalance
            await sPrime.connect(addr1).deposit(0, 0, parseEther("1000"), parseEther("1"), false, 0);

            nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);

            const tokenId = await sPrime.getUserTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);
            expect(position.centerId).to.equal(initaialBin);
        });

        it("Should deposit two times with rebalance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("2"));

            await prime.connect(addr2).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("1"));
            await sPrime.connect(addr2).deposit(initaialBin, 1000, parseEther("1000"), parseEther("1"), false, 0);

            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);

            let nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);
            // Should revert as it didn't provide the active id and slippage for the rebalancing
            await expect(sPrime.connect(addr1).deposit(0, 0, parseEther("1000"), parseEther("1"), true, 10)).to.be.reverted;

            // Provide the second position with rebalance
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("100"), parseEther("0.4"), true, 10);

            nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);

            const tokenId = await sPrime.getUserTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);
            expect(position.centerId).to.not.equal(initaialBin);
        });

        it("Should deposit with token swap to use equal amount", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("10000"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("10"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 0, parseEther("10000"), parseEther("10"), false, 0);


            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("100"), parseEther("0.1"), false, 0);
            let tokenId = await sPrime.getUserTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);

            const oldShare = userShare.totalShare;
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("1"), parseEther("0.05"), false, 0);
            tokenId = await sPrime.getUserTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.totalShare).to.gt(oldShare);
        });

        it("Should fail if not enough tokens", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("100000"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("100"));
            await expect(sPrime.connect(addr2).deposit(initaialBin, 0, parseEther("100000"), parseEther("100"), false, 0)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("Should fail if invalid active id", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await expect(sPrime.connect(addr1).deposit(83873, 0, parseEther("1000"), parseEther("1"), false, 0)).to.be.revertedWith("Slippage High");
        });
    });

    describe("Rebalance", function () {
        it("Rebalance after some token swap without depositing new tokens", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);

            let tokenId = await sPrime.getUserTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);

            expect(userShare.totalShare).to.gt(0);
            
            const oldCenterId = userShare.centerId;
            
            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, wavax.address]
            }
            
            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            await sPrime.connect(addr1).deposit(initaialBin, 100, 0, 0, true, 10);
            tokenId = await sPrime.getUserTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.centerId).to.not.equal(oldCenterId);

        });

        it("Rebalance with depositing new tokens", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);

            let tokenId = await sPrime.getUserTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);

            expect(userShare.totalShare).to.gt(0);
            
            const oldCenterId = userShare.centerId;
            
            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, wavax.address]
            }
            
            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            await sPrime.connect(addr1).deposit(initaialBin, 100, parseEther("100"), parseEther("0.5"), true, 10);
            tokenId = await sPrime.getUserTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.centerId).to.not.equal(oldCenterId);

        });

        it("Should receive the position using the balance - full transfer", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);

            await prime.connect(addr2).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 1000, parseEther("100"), parseEther("1"), false, 0);

            // Fetching User 1 Status
            
            let tokenId = await sPrime.getUserTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);

            const oldCenterId = userShare.centerId;
            tokenId = await sPrime.getUserTokenId(addr2.address);

            userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);
            
            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, wavax.address]
            }
            
            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            // Rebalancing User 1's position
            await sPrime.connect(addr1).deposit(initaialBin, 100, 0, 0, true, 10);
            tokenId = await sPrime.getUserTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.centerId).to.not.equal(oldCenterId);

            // Transfer share from User 2 to User 3
            const user2Balance = await sPrime.balanceOf(addr2.address);
            await sPrime.connect(addr2).transfer(addr3.address, user2Balance);
            let nftBalance = await positionManager.balanceOf(addr2.address);
            expect(nftBalance).to.be.equal(0);

            nftBalance = await positionManager.balanceOf(addr3.address);
            expect(nftBalance).to.be.equal(1);
        });

        it("Should receive the position using the balance - partial transfer", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);

            await prime.connect(addr2).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 1000, parseEther("1000"), parseEther("1"), false, 0);

            // Fetching User 1 Status
            
            let tokenId = await sPrime.getUserTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);

            const oldCenterId = userShare.centerId;
            tokenId = await sPrime.getUserTokenId(addr2.address);

            userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);
            
            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, wavax.address]
            }
            
            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            // Rebalancing User 1's position
            await sPrime.connect(addr1).deposit(initaialBin, 100, 0, 0, true, 10);
            tokenId = await sPrime.getUserTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);
            expect(userShare.centerId).to.not.equal(oldCenterId);
            const user1InitialShare = userShare.totalShare;

            // Transfer share from User 2 to User 3
            const user2Balance = await sPrime.balanceOf(addr2.address);
            await sPrime.connect(addr2).transfer(addr3.address, parseEther((parseFloat(formatEther(user2Balance))/2).toString()));
            let nftBalance = await positionManager.balanceOf(addr2.address);
            expect(nftBalance).to.be.equal(1);

            nftBalance = await positionManager.balanceOf(addr3.address);
            expect(nftBalance).to.be.equal(1);
        });
    });

    describe("Withdraw", function () {
        it("Should withdraw correctly - full share", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);
            
            const tokenId = await sPrime.getUserTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);

            await sPrime.connect(addr1).withdraw(position.totalShare);
            const nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(0);
        });

        it("Should withdraw correctly - partial share", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false, 0);
            const tokenId = await sPrime.getUserTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);
            await sPrime.connect(addr1).withdraw(parseEther((parseFloat(formatEther(position.totalShare)) / 2).toString()));
            const nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);
        });

        it("Should receive different amount because of token swap for rebalance", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("10000"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("10"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 0, parseEther("10000"), parseEther("10"), false, 0);


            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("100"), parseEther("0.1"), false, 0);
            let tokenId = await sPrime.getUserTokenId(addr1.address);

            const oldShare = await positionManager.positions(tokenId);
            expect(oldShare.totalShare).to.gt(0);

            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("1"), parseEther("0.1"), false, 0);

            tokenId = await sPrime.getUserTokenId(addr1.address);
            const userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(oldShare.totalShare);
            const initialPrimeBalance = await prime.balanceOf(addr1.address);
            const initialWEthBalance = await wavax.balanceOf(addr1.address);
            await sPrime.connect(addr1).withdraw(userShare.totalShare);
            const afterPrimeBalance = await prime.balanceOf(addr1.address);
            const afterWEthBalance = await wavax.balanceOf(addr1.address);

            console.log("Input Prime Amount: ", parseEther("101"));
            console.log("Received Prime After Withdraw: ", afterPrimeBalance - initialPrimeBalance);
            console.log("Input WAVAX Amount: ", parseEther("0.2"));
            console.log("Received WAVAX After Withdraw: ", afterWEthBalance - initialWEthBalance);
        });
        
        it("Should fail if trys to withdraw more shares than the balance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("1000"), parseEther("1"), false, 0);

            await expect(sPrime.connect(addr1).withdraw(parseEther("1000"))).to.be.reverted;
        });
    });

    describe("Swap For Equal Values", function () {
        it("PRIME-USDC (18 - 6 Decimals)", async function () {
            await LBFactory.connect(owner).createLBPair(prime.address, usdc.address, initaialBin, 25);
            sPrime = await SPrimeFactory.deploy();
            await sPrime.initialize(prime.address, usdc.address, "PRIME-USDC", spotUniform.distributionX, spotUniform.distributionY, spotUniform.deltaIds, positionManager.address, vPrimeControllerContract.address);
            positionManager.setSPrime(sPrime.address);

            await prime.connect(addr2).approve(sPrime.address, parseEther("1000"));
            await usdc.connect(addr2).approve(sPrime.address, "10000000");
            
            await sPrime.connect(addr2).deposit(initaialBin, 0, parseEther("1"), "1000000", false, 0);
            console.log("User Balance");
            console.log(await prime.balanceOf(addr2.address));
            console.log(await usdc.balanceOf(addr2.address));
            console.log("Deposited");
            await prime.connect(addr1).approve(sPrime.address, parseEther("2001"));
            await usdc.connect(addr1).approve(sPrime.address, parseEther("2100000"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("2"), "2000000", false, 0);
            console.log("User Balance");
            console.log(await prime.balanceOf(addr1.address));
            console.log(await usdc.balanceOf(addr1.address));
            console.log("Deposited");
            let tokenId = await sPrime.getUserTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);
            
            const oldShare = userShare.totalShare;
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("0.05"), "10000", false, 5);
            tokenId = await sPrime.getUserTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.totalShare).to.gt(oldShare);
        });

        it("PRIME - AVAX (18 - 18 Decimals)", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("10000"));
            await wavax.connect(addr2).approve(sPrime.address, parseEther("10"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 0, parseEther("10"), parseEther("10"), false, 0);

            await prime.connect(addr1).approve(sPrime.address, parseEther("2"));
            await wavax.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("1"), parseEther("1"), false, 0);
            let tokenId = await sPrime.getUserTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);

            const oldShare = userShare.totalShare;
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("0.1"), parseEther("0.05"), false, 10);
            tokenId = await sPrime.getUserTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.totalShare).to.gt(oldShare);
        });
    });

    describe("getJoeV2RouterAddress", function () {
        it("Should return correct address", async function () {
            const address = await sPrime.getJoeV2RouterAddress();
            expect(address).to.equal("0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30");
        });
    });
});