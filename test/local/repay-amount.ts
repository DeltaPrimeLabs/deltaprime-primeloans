import {getSelloutRepayAmount} from "../_helpers";
import {expect} from 'chai'

describe('Sellout repay amount calculator', () => {
  it("should calculate repay amount", async function () {
    let result = await getSelloutRepayAmount(60903486144255577854, 32404307256330257220, 100, 800);
    expect(result).to.be.equal(10857785556336523000);
  });
});
