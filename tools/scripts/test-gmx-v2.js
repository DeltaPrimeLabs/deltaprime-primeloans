import {ethers} from "hardhat";
import TEST_GMX_V2 from "artifacts/contracts/mock/TestGmxV2.sol/TestGmxV2.json";
const fromWei = val => parseFloat(ethers.utils.formatEther(val));

const fs = require("fs");
export const toWei = ethers.utils.parseUnits;

const jsonRPC = "https://rpc.vnet.tenderly.co/devnet/arbi-mainnet/ece5d91f-fe1e-4565-8caf-aac8760f710f";
const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

async function run() {
    console.log(0)
    const weth = await ethers.getContractAt("WETH9", '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1');
    const tokenAmount = toWei('1');
    const maxFee = toWei('0.0005');
    await setBalances();
    await weth.connect(wallet).deposit({ value: tokenAmount});
    const testAddress = await deployContract("TestGmxV2");
    const test = await ethers.getContractAt('TestGmxV2', testAddress)
    await weth.connect(wallet).transfer(testAddress, tokenAmount);

    try {


        await test.depositEthUsdc(true, tokenAmount, 0, maxFee, { gasLimit: 100000000, value: maxFee });

    } catch (e) {
        console.log(e);
    }
    console.log(1);

}

async function setBalances() {
    await provider.send(
"tenderly_setBalance",
[
            [
                wallet.address
            ],
            "0x152D02C7E14AF6800000" // 100.000
        ],
    );
}

async function deployContract(contractName) {
    // We get the name of contract to deploy
    const Contract = await ethers.getContractFactory(contractName);
    const contract = await Contract.deploy();

    return contract.address;
}


run();

/*
const data = '0x7ff36ab50000000000000000000000000000000000000000000000bc18ba4144048bbab00000000000000000000000000000000000000000000000000000000000000080000000000000000000000000c0c5eb43e2df059e3be6e4fb0284c283caa5991900000000000000000000000000000000000000000000000000000000614d87a80000000000000000000000000000000000000000000000000000000000000002000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c00000000000000000000000008ba0619b1e7a582e0bce5bbe9843322c954c340';

ethers.utils.defaultAbiCoder.decode(
    ['uint256', 'address[]', 'address', 'uint256'],
    ethers.utils.hexDataSlice(data, 4)
)

const iface = new ethers.utils.Interface(['function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)'])

iface.decodeFunctionData('swapExactETHForTokens', '0x7ff36ab50000000000000000000000000000000000000000000000bc18ba4144048bbab00000000000000000000000000000000000000000000000000000000000000080000000000000000000000000c0c5eb43e2df059e3be6e4fb0284c283caa5991900000000000000000000000000000000000000000000000000000000614d87a80000000000000000000000000000000000000000000000000000000000000002000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c00000000000000000000000008ba0619b1e7a582e0bce5bbe9843322c954c340')
// gives: [e, ["0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0x08ba0619b1e7A582E0BCe5BBE9843322C954C340"], "0xC0C5eb43E2dF059e3Be6E4fb0284C283CAa59919", e] (4)
*/