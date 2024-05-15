const { expect } = require("chai");
const { ethers } = require("hardhat");
import { formatEther, parseEther } from 'viem';
import {
    ILBFactory,
    ILBRouter, ILBToken,
} from "../../typechain";
export const erc20ABI = require('../abis/ERC20.json');

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
    let SPrimeFactory, PrimeFactory, LBRouter, PositionManagerFactory;
    // Wallets
    let owner, addr1, addr2, addr3;
    // Contracts
    let weth, prime, sPrime, positionManager;
    const initaialBin = 8385840;

    beforeEach(async function () {

        SPrimeFactory = await ethers.getContractFactory("SPrime");
        PositionManagerFactory = await ethers.getContractFactory("PositionManager");
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        PrimeFactory = await ethers.getContractFactory("Prime");
        prime = await PrimeFactory.deploy(parseEther("1000000"));
        positionManager = await PositionManagerFactory.deploy();
        weth = await ethers.getContractAt("WETH9", '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1');

        let user1 = await addr1.getAddress();
        let user2 = await addr2.getAddress();

        await prime.transfer(user1, parseEther("100000"));
        await prime.transfer(user2, parseEther("100000"));

        let LBFactory = new ethers.Contract('0x8e42f2F4101563bF679975178e880FD87d3eFd4e', LBFactoryAbi) as ILBFactory;
        LBRouter = new ethers.Contract('0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30', LBRouterAbi) as ILBRouter;
        await weth.connect(owner).deposit({value: parseEther("100")});
        await weth.transfer(user1, parseEther("10"));
        await weth.transfer(user2, parseEther("10"));
        
        await LBFactory.connect(owner).createLBPair(prime.address, weth.address, initaialBin, 25);

        sPrime = await SPrimeFactory.deploy();
        await sPrime.initialize(prime.address, weth.address, "PRIME-WETH", spotUniform.distributionX, spotUniform.distributionY, spotUniform.deltaIds, positionManager.address);

        await positionManager.addSPrime(sPrime.address);
    });

    describe("Deposit", function () {
        it("Should deposit correctly", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);

            const nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);
            const tokenId = await sPrime.userTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);
            expect(position.centerId).to.equal(initaialBin);
        });

        it("Should deposit two times without rebalance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);

            let nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);
            // Should revert as it didn't provide the active id and slippage for the rebalancing
            await expect(sPrime.connect(addr1).deposit(0, 0, parseEther("1000"), parseEther("1"), true)).to.be.reverted;
            // Provide the second position without any rebalance
            await sPrime.connect(addr1).deposit(0, 0, parseEther("1000"), parseEther("1"), false);

            nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);

            const tokenId = await sPrime.userTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);
            expect(position.centerId).to.equal(initaialBin);
        });

        it("Should deposit two times with rebalance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));

            await prime.connect(addr2).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("1"));
            await sPrime.connect(addr2).deposit(initaialBin, 1000, parseEther("1000"), parseEther("1"), false);

            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);

            let nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);
            // Should revert as it didn't provide the active id and slippage for the rebalancing
            await expect(sPrime.connect(addr1).deposit(0, 0, parseEther("1000"), parseEther("1"), true)).to.be.reverted;

            // Provide the second position with rebalance
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("100"), parseEther("0.4"), true);

            nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);

            const tokenId = await sPrime.userTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);
            expect(position.centerId).to.not.equal(initaialBin);
        });

        it("Should deposit with token swap to use equal amount", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("10000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("10"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 0, parseEther("10000"), parseEther("10"), false);


            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("100"), parseEther("0.1"), false);
            let tokenId = await sPrime.userTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);

            const oldShare = userShare.totalShare;
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("1"), parseEther("0.05"), false);
            tokenId = await sPrime.userTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.totalShare).to.gt(oldShare);
        });

        it("Should fail if not enough tokens", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("100000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("100"));
            await expect(sPrime.connect(addr2).deposit(initaialBin, 0, parseEther("100000"), parseEther("100"), false)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("Should fail if invalid active id", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await expect(sPrime.connect(addr1).deposit(83873, 0, parseEther("1000"), parseEther("1"), false)).to.be.revertedWith("Slippage High");
        });
    });

    describe("Rebalance", function () {
        it("Rebalance after some token swap without depositing new tokens", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);

            let tokenId = await sPrime.userTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);

            expect(userShare.totalShare).to.gt(0);
            
            const oldCenterId = userShare.centerId;
            
            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, weth.address]
            }
            
            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            await sPrime.connect(addr1).deposit(initaialBin, 100, 0, 0, true);
            tokenId = await sPrime.userTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.centerId).to.not.equal(oldCenterId);

        });

        it("Rebalance with depositing new tokens", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);

            let tokenId = await sPrime.userTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);

            expect(userShare.totalShare).to.gt(0);
            
            const oldCenterId = userShare.centerId;
            
            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, weth.address]
            }
            
            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            await sPrime.connect(addr1).deposit(initaialBin, 100, parseEther("100"), parseEther("0.5"), true);
            tokenId = await sPrime.userTokenId(addr1.address);
            userShare = await positionManager.positions(tokenId);

            expect(userShare.centerId).to.not.equal(oldCenterId);

        });

        it("Should receive the position using the balance - full transfer", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);

            await prime.connect(addr2).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 1000, parseEther("100"), parseEther("1"), false);

            // Fetching User 1 Status
            
            let tokenId = await sPrime.userTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);

            const oldCenterId = userShare.centerId;
            tokenId = await sPrime.userTokenId(addr2.address);

            userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);
            
            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, weth.address]
            }
            
            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            // Rebalancing User 1's position
            await sPrime.connect(addr1).deposit(initaialBin, 100, 0, 0, true);
            tokenId = await sPrime.userTokenId(addr1.address);
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
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);

            await prime.connect(addr2).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 1000, parseEther("1000"), parseEther("1"), false);

            // Fetching User 1 Status
            
            let tokenId = await sPrime.userTokenId(addr1.address);
            let userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);

            const oldCenterId = userShare.centerId;
            tokenId = await sPrime.userTokenId(addr2.address);

            userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(0);
            
            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, weth.address]
            }
            
            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            // Rebalancing User 1's position
            await sPrime.connect(addr1).deposit(initaialBin, 100, 0, 0, true);
            tokenId = await sPrime.userTokenId(addr1.address);
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
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);
            
            const tokenId = await sPrime.userTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);

            await sPrime.connect(addr1).withdraw(position.totalShare);
            const nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(0);
        });

        it("Should withdraw correctly - partial share", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("1000"), parseEther("1"), false);
            const tokenId = await sPrime.userTokenId(addr1.address);
            const position = await positionManager.positions(tokenId);
            await sPrime.connect(addr1).withdraw(parseEther((parseFloat(formatEther(position.totalShare)) / 2).toString()));
            const nftBalance = await positionManager.balanceOf(addr1.address);
            expect(nftBalance).to.equal(1);
        });

        it("Should receive different amount because of token swap for rebalance", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("10000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("10"));
            
            await sPrime.connect(addr2).deposit(initaialBin, 0, parseEther("10000"), parseEther("10"), false);


            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 0, parseEther("100"), parseEther("0.1"), false);
            let tokenId = await sPrime.userTokenId(addr1.address);

            const oldShare = await positionManager.positions(tokenId);
            expect(oldShare.totalShare).to.gt(0);

            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("1"), parseEther("0.1"), false);

            tokenId = await sPrime.userTokenId(addr1.address);
            const userShare = await positionManager.positions(tokenId);
            expect(userShare.totalShare).to.gt(oldShare.totalShare);
            const initialPrimeBalance = await prime.balanceOf(addr1.address);
            const initialWEthBalance = await weth.balanceOf(addr1.address);
            await sPrime.connect(addr1).withdraw(userShare.totalShare);
            const afterPrimeBalance = await prime.balanceOf(addr1.address);
            const afterWEthBalance = await weth.balanceOf(addr1.address);

            console.log("Input Prime Amount: ", parseEther("101"));
            console.log("Received Prime After Withdraw: ", afterPrimeBalance - initialPrimeBalance);
            console.log("Input WETH Amount: ", parseEther("0.2"));
            console.log("Received WETH After Withdraw: ", afterWEthBalance - initialWEthBalance);
        });
        
        it("Should fail if trys to withdraw more shares than the balance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(initaialBin, 1000, parseEther("1000"), parseEther("1"), false);

            await expect(sPrime.connect(addr1).withdraw(parseEther("1000"))).to.be.reverted;
        });
    });

    describe("getJoeV2RouterAddress", function () {
        it("Should return correct address", async function () {
            const address = await sPrime.getJoeV2RouterAddress();
            expect(address).to.equal("0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30");
        });
    });
});