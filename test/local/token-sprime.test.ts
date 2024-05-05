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
    let SPrimeFactory, PrimeFactory, LBRouter;
    // Wallets
    let owner, addr1, addr2;
    // Contracts
    let weth, prime, sPrime;

    beforeEach(async function () {

        SPrimeFactory = await ethers.getContractFactory("SPrime");
        [owner, addr1, addr2, ] = await ethers.getSigners();
        PrimeFactory = await ethers.getContractFactory("Prime");
        prime = await PrimeFactory.deploy(parseEther("1000000"));
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

        await LBFactory.connect(owner).createLBPair(prime.address, weth.address, 8385840, 25);

        sPrime = await SPrimeFactory.deploy(prime.address, weth.address, "PRIME-WETH", spotUniform.distributionX, spotUniform.distributionY, spotUniform.deltaIds);

    });

    describe("Deposit", function () {
        it("Should deposit correctly", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1000"), parseEther("1"));

            const userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);
        });

        it("Should deposit two times without rebalance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1000"), parseEther("1"));

            let userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1000"), parseEther("1"));

            userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);
        });

        it("Should deposit with token swap to use equal amount", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("10000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("10"));

            await sPrime.connect(addr2).deposit(8385840, 1000, parseEther("10000"), parseEther("10"));
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("100"), parseEther("0.1"));
            let userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);
            const oldShare = userShare.share;
            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1"), parseEther("0.05"));
            userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(oldShare);
        });

        it("Should fail if not enough tokens", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("100000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("100"));
            await expect(sPrime.connect(addr2).deposit(8385840, 1000, parseEther("100000"), parseEther("100"))).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("Should fail if invalid active id", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));

            await expect(sPrime.connect(addr1).deposit(83873, 1000, parseEther("1000"), parseEther("1"))).to.be.revertedWith("Slippage High");
        });
    });

    describe("Rebalance", function () {
        it("Rebalance after some token swap", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1000"), parseEther("1"));

            let userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);

            const oldCenterId = userShare.centerId;

            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, weth.address]
            }

            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            await sPrime.connect(addr1).deposit(8385840, 100, 0, 0);

            userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.centerId).to.not.equal(oldCenterId);

        });

        it("Should receive rebalanced position", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1000"), parseEther("1"));

            await prime.connect(addr2).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("1"));

            await sPrime.connect(addr2).deposit(8385840, 1000, parseEther("1000"), parseEther("1"));

            // Fetching User 1 Status
            let userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);
            const oldCenterId = userShare.centerId;

            userShare = await sPrime.userInfo(addr2.address);
            expect(userShare.share).to.gt(0);

            await prime.connect(addr2).approve(LBRouter.address, parseEther("100"));
            const path = {
                pairBinSteps: [25],
                versions: [2],
                tokenPath: [prime.address, weth.address]
            }

            await LBRouter.connect(addr2).swapExactTokensForTokens(parseEther("100"), 0, path, addr2.address, 1880333856);

            // Rebalancing User 1's position
            await sPrime.connect(addr1).deposit(8385840, 100, 0, 0);
            userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.centerId).to.not.equal(oldCenterId);
            const user1InitialShare = userShare.share;

            // Transfer share from User 2 to User 1
            const user2Balance = await sPrime.balanceOf(addr2.address);
            await sPrime.connect(addr2).transfer(addr1.address, (user2Balance / 2).toString());

            userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(user1InitialShare);
        });
    });

    describe("Withdraw", function () {
        it("Should withdraw correctly", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1000"), parseEther("1"));

            let userShare = await sPrime.userInfo(addr1.address);
            await sPrime.connect(addr1).withdraw(userShare.share);

            userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.equal(0);
        });

        it("Should receive different amount because of token swap", async function () {
            await prime.connect(addr2).approve(sPrime.address, parseEther("10000"));
            await weth.connect(addr2).approve(sPrime.address, parseEther("10"));

            await sPrime.connect(addr2).deposit(8385840, 1000, parseEther("10000"), parseEther("10"));


            await prime.connect(addr1).approve(sPrime.address, parseEther("2000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("2"));

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("100"), parseEther("0.1"));

            let userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);
            const oldShare = userShare.share;
            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1"), parseEther("0.05"));

            userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);
            const initialPrimeBalance = await prime.balanceOf(addr1.address);
            const initialWEthBalance = await weth.balanceOf(addr1.address);
            await sPrime.connect(addr1).withdraw(userShare.share);
            const afterPrimeBalance = await prime.balanceOf(addr1.address);
            const afterWEthBalance = await weth.balanceOf(addr1.address);

            console.log("Input Prime Amount: ", parseEther("1010"));
            console.log("Received Prime After Withdraw: ", afterPrimeBalance - initialPrimeBalance);
            console.log("Input WETH Amount: ", parseEther("2"));
            console.log("Received WETH After Withdraw: ", afterWEthBalance - initialWEthBalance);
        });

        it("Should fail if trys to withdraw more shares than the balance", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));

            await sPrime.connect(addr1).deposit(8385840, 1000, parseEther("1000"), parseEther("1"));

            await expect(sPrime.connect(addr1).withdraw(parseEther("1000"))).to.be.revertedWith("Insufficient Balance");
        });
    });

    describe("getJoeV2RouterAddress", function () {
        it("Should return correct address", async function () {
            const address = await sPrime.getJoeV2RouterAddress();
            expect(address).to.equal("0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30");
        });
    });
});