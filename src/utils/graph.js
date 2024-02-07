import config from '@/config';
import ApolloClient, {gql} from 'apollo-boost';


export async function fetchLiquidatedEvents(address) {
  let query = `
    {
      liquidatedLoans(where: { smartLoan: "${address.toString()}"}, orderBy: timestamp) {
        id
        timestamp
      }
    }
   `;

  const client = new ApolloClient({
    uri: config.subgraph
  });

  return (await client.query({query: gql(query)})).data.liquidatedEvents;
}

export async function fetchGmTransactions(address) {
  const query = `
    {
      transactions(
        where: {txType_in: ["WithdrawalExecuted", "DepositExecuted"], loanId: "${address.toLowerCase()}"}
        orderBy: timestamp
        orderDirection: asc
      ) {
        id
        loanId
        timestamp
      }
    }
  `;

  const client = new ApolloClient({
    uri: config.subgraph
  });

  return (await client.query({query: gql(query)})).data.transactions;
}