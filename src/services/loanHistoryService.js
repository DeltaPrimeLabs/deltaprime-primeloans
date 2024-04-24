export default class LoanHistoryService {
  async getLoanHistoryData(walletAddress) {
    const weekBefore = new Date().getTime() - 7 * 25 * 60 * 60 * 1000;
    const monthBefore =  new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
    const endDate = new Date().getTime();
    const startDate = 1673352000000;

    const response = await fetch(`https://us-central1-delta-prime-db.cloudfunctions.net/loanhistory?address=${walletAddress}&from=${startDate}&to=${endDate}&network=${window.chain}`);
    const body = await response.json()

    return {
      week: body.data.filter(dataEntry => dataEntry.timestamp > weekBefore),
      month: body.data.filter(dataEntry => dataEntry.timestamp > monthBefore),
      all: body.data
    }
  }
};
