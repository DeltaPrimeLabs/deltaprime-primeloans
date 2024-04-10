const { expect } = require("chai");
const { ethers } = require("hardhat");
import { parseEther } from 'viem';
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
    'event DepositedToBins(address indexed sender,address indexed to,uint256[] ids,bytes32[] amounts)',
];
  
const LBFactoryAbi = [
    'function createLBPair(address, address, uint24, uint16) external returns (address)',
]

describe("SPrime", function () {
    // Contract Factory
    let SPrimeFactory, PrimeFactory;
    // Wallets
    let owner, addr1, addr2;
    // Contracts
    let weth, prime, sPrime;

    let isPrimeFirst;

    beforeEach(async function () {

        SPrimeFactory = await ethers.getContractFactory("SPrime");
        [owner, addr1, addr2, ] = await ethers.getSigners();
        PrimeFactory = await ethers.getContractFactory("Prime");
        prime = await PrimeFactory.deploy(parseEther("1000000"));
        weth = await ethers.getContractAt("WETH9", '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1');

        let user1 = await addr1.getAddress();
        let user2 = await addr2.getAddress();

        if(prime.address < weth.address ) {
            isPrimeFirst = true;
        } else {
            isPrimeFirst = false;
        }

        await prime.transfer(user1, parseEther("100000"));
        await prime.transfer(user2, parseEther("100000"));

        let lpPrime = parseEther("1000");
        let lpMock = parseEther("1");

        let LBRouter = new ethers.Contract('0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30', LBRouterAbi) as ILBRouter;
        let LBFactory = new ethers.Contract('0x8e42f2F4101563bF679975178e880FD87d3eFd4e', LBFactoryAbi) as ILBFactory;

        await weth.connect(owner).deposit({value: parseEther("100")});
        await weth.transfer(user1, parseEther("10"));
        await weth.transfer(user2, parseEther("10"));
        
        await LBFactory.connect(owner).createLBPair(prime.address, weth.address, 8387380, 25);

        sPrime = await SPrimeFactory.deploy(prime.address, weth.address, "PRIME-WETH", spotUniform.distributionX, spotUniform.distributionY, spotUniform.deltaIds);

        // await weth.connect(owner).approve(LBRouter.address, lpMock);
        // await prime.connect(owner).approve(LBRouter.address, lpPrime);
        // await LBRouter.connect(owner).addLiquidity(
        //     {
        //         tokenX: prime.address,
        //         tokenY: weth.address,
        //         binStep: 25,
        //         amountX: lpPrime,
        //         amountY: lpMock,
        //         amountXMin: 0, 
        //         amountYMin: 0, 
        //         activeIdDesired: 8387380,
        //         idSlippage: 100, //max uint24 - means that we accept every distance ("slippage") from the active bin
        //         deltaIds: spotUniform.deltaIds, 
        //         distributionX: spotUniform.distributionX,
        //         distributionY: spotUniform.distributionY,
        //         to: owner.address,
        //         refundTo: owner.address,
        //         deadline: Math.ceil((new Date().getTime() / 1000) + 10000)
        //     }
        // );
    });

    describe("Deposit", function () {
        it("Should deposit correctly", async function () {
            await prime.connect(addr1).approve(sPrime.address, parseEther("1000"));
            await weth.connect(addr1).approve(sPrime.address, parseEther("1"));
            
            await sPrime.connect(addr1).deposit(8387380, 1000, isPrimeFirst ? parseEther("1000") : parseEther("1"), isPrimeFirst ? parseEther("1") : parseEther("1000"));

            const userShare = await sPrime.userInfo(addr1.address);
            expect(userShare.share).to.gt(0);
        });

        // it("Should fail if not enough tokens", async function () {
        //     await expect(sPrime.connect(addr2).deposit(1, 1, 1000, 2000)).to.be.revertedWith("Insufficient Balance");
        // });

        // it("Should fail if invalid active id", async function () {
        //     await expect(sPrime.connect(addr1).deposit(0, 1, 100, 200)).to.be.revertedWith("Invalid active id");
        // });
    });

    // describe("Withdraw", function () {
    //     it("Should withdraw correctly", async function () {
    //         await sPrime.connect(addr1).deposit(1, 1, 100, 200);
    //         await sPrime.connect(addr1).withdraw(50);
    //         const userShare = await sPrime.userShares(addr1.address);
    //         expect(userShare.share).to.equal(50);
    //     });

    //     it("Should fail if not enough shares", async function () {
    //         await sPrime.connect(addr1).deposit(1, 1, 100, 200);
    //         await expect(sPrime.connect(addr1).withdraw(200)).to.be.revertedWith("Insufficient Balance");
    //     });

    //     it("Should fail if invalid active id", async function () {
    //         await expect(sPrime.connect(addr1).withdraw(0)).to.be.revertedWith("Invalid active id");
    //     });
    // });

    // describe("_beforeTokenTransfer", function () {
    //     it("Should transfer tokens correctly", async function () {
    //         await sPrime.connect(addr1).deposit(1, 1, 100, 200);
    //         await sPrime.connect(addr1).transfer(addr2.address, 50);
    //         const userShare = await sPrime.balanceOf(addr2.address);
    //         expect(userShare).to.equal(50);
    //     });

    //     it("Should fail if not enough balance", async function () {
    //         await sPrime.connect(addr1).deposit(1, 1, 100, 200);
    //         await expect(sPrime.connect(addr1).transfer(addr2.address, 200)).to.be.revertedWith("Insufficient Balance");
    //     });
    // });

    describe("getJoeV2RouterAddress", function () {
        it("Should return correct address", async function () {
            const address = await sPrime.getJoeV2RouterAddress();
            expect(address).to.equal("0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30");
        });
    });
});