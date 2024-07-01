import {depositTermsToSign, loanTermsToSign, signMessage} from '../utils/blockchain';

export default class TermsService {

  static CURRENT_TERMS_VERSION = 'V4'

  async checkTerms(walletAddress) {
    const rawResponse = await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/terms-version/${walletAddress}`, {
      method: 'GET',
    });
    return await rawResponse.json();
  }

  async saveSignedTerms(paAddress, walletAddress, signResult, type) {
    const requestBody = {
      paAddress: paAddress,
      walletAddress: walletAddress,
      signResult: signResult,
      termsVersion: TermsService.CURRENT_TERMS_VERSION,
      type: type
    }

    const rawResponse = await fetch('https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/terms-version/create', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    const content = await rawResponse.json();
    console.log(content);
  }

  async signTerms(walletAddress, provider, isSavings) {
    const termsToSign = isSavings ? depositTermsToSign : loanTermsToSign
    return await signMessage(provider, termsToSign, walletAddress);
  }
}
