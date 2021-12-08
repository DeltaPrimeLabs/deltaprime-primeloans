import {waffle} from "hardhat";
const {provider} = waffle;

//for test environments only, useful when running a forked node in local environment
export async function syncTime() {
    const now = Math.ceil(new Date().getTime() / 1000);
    try {
        await provider.send('evm_setNextBlockTimestamp', [now]);
    } catch (error) {
        await provider._hardhatNetwork.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc"
                    },
                },
            ],
        });

        await syncTime();
    }
}

export function transactionUrl(tx) {
    return 'https://explorer.avax-test.network/tx/' + tx;
}