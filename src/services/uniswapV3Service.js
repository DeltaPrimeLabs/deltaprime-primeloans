import {uniswapV3TickToPrice} from "../utils/calculate";

const ethers = require('ethers');
import UNI_POOL from '/artifacts/contracts/interfaces/uniswap-v3/IUniswapV3Pool.sol/IUniswapV3Pool.json'



export default class UniswapV3Service {
  async getPriceAndActiveId(uniPairAddress, provider) {
    const uniPairContract = new ethers.Contract(uniPairAddress, UNI_POOL.abi, provider);
    let res = (await uniPairContract.slot0());


    return [uniswapV3TickToPrice(res.tick), res.tick];
  }
}