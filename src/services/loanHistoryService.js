export default class LoanHistoryService {
  async getLoanHistoryData(walletAddress) {
    const startDate = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
    const endDate = new Date().getTime();

    const response = await fetch(`https://us-central1-delta-prime-db.cloudfunctions.net/loanhistory?address=${walletAddress}&from=${startDate}&to=${endDate}`);
    return response.json()
  }
};
