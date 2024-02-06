import {signMessage} from "../utils/blockchain";

export default class ReferralService {

  async createReferralCode(provider, account, code) {
    const message = `
      This is the message you have to sign to create referral code.
      ...
      Wallet Address: ${account}
      Created At: ${new Date().getTime()}
      Code: ${code}
    `
    const signResult = await signMessage(provider, message, account);
    console.log(signResult);

    const requestBody = {
      chain: window.chain,
      message: message,
      signedMessage: signResult
    }
    const rawResponse = await fetch('https://cavsise1n4.execute-api.us-east-1.amazonaws.com/referral/create', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    const content = await rawResponse.json();
    console.log(content);
  }

  getReferralInfo(code) {
    (async () => {
      const rawResponse = await fetch(`https://cavsise1n4.execute-api.us-east-1.amazonaws.com/referral/${code}`, {
        method: 'GET',
      });
      const content = await rawResponse.json();

      console.log(content);
    })();
  }

}