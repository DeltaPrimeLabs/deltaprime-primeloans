const { request, gql } = require("graphql-request");

const ARWEAVE_GRAPHQL_API_ENDPOINT = "https://arweave.net/graphql";

const buildGraphQlQuery = (timestamp, nodeAddress, after) => {
    return gql`
query {
            transactions(
                first: 10,
                after: "WyIyMDI0LTA1LTA1VDEyOjQ3OjM5LjczNFoiLDI3MF0=",
                tags: [
                    {
                        name: "timestamp",
                        values: ["1714497350"]
                    },
                    {
                        name: "signerAddress",
                        values: ["0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747","0x2c59617248994D12816EE1Fa77CE0a64eEB456BF","0x12470f7aBA85c8b81D63137DD5925D6EE114952b"]
                    }])
            {
                edges {
                    cursor,
                    node {
                        id
                        owner {
                            address
                        }
                        data {
                            size
                            type
                        }
                        tags{
                            name
                            value
                        }
                    }
                }
            }
        }
    `;
};

async function queryArweave(timestamp, nodeAddress) {
    console.log('queryArweave')
    let after;
    let response = [];

    while (true) {
        const query = buildGraphQlQuery(timestamp, nodeAddress, after);
        const arweaveResponse = await request(ARWEAVE_GRAPHQL_API_ENDPOINT, query);

        const edges = arweaveResponse.transactions.edges;
        console.log(edges)

        if (edges.length === 0) return response;

        response.push(...edges);
        const lastEdge = edges[edges.length-1];
        after = lastEdge.cursor;
    }

    console.log(response)
    return response;
}

export const queryHistoricalFeeds = async (timestamp, nodeAddress) => {
    try {
        return await queryArweave(timestamp, nodeAddress);
    } catch (error) {
        console.log(error);
    }
};

// module.exports = {
//     queryHistoricalFeeds
// }

const n1 = '0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747';
const n2 = '0x2c59617248994D12816EE1Fa77CE0a64eEB456BF';
const n3 = '0x12470f7aBA85c8b81D63137DD5925D6EE114952b';

console.log('aw')

queryHistoricalFeeds(1714497350, [n1, n2, n3]).then()