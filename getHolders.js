const fs = require('fs');
const ethers = require("ethers");
const config = require("./config/config");

// For sending a signed transaction to the network
const nodeURL = config.mainNetUrl;
const HTTPSProvider = new ethers.providers.JsonRpcProvider(nodeURL);

//Wallets with bal are appended
let WALLETS_FOUND = new Set();


//Adds new wallets with non-zero bal found between params: block1, block2
async function getWallets(block1, block2) {
    const tokenContract = new ethers.Contract(config.contractAddr, config.TokenAbi, HTTPSProvider);

    //PurchasedNode Event
    const transferFilter = tokenContract.filters.Transfer(null, null, null);
    const transferResult = await tokenContract.queryFilter(transferFilter, block1, block2);
    console.log("TRANSFER RESULT");

    await Promise.all(transferResult.map(async (result) => {
        let wallet = result.args[1];
        if (!WALLETS_FOUND.has(wallet)) {
            if (await checkBal(wallet, tokenContract)) {
                WALLETS_FOUND.add(wallet);
            }
        }
    }));
}

async function checkBal(wallet, contract) {

    let bal = await contract.balanceOf(wallet);
    bal = bal.div(DECIMALS).toNumber();

    return (bal > 0) ? true : false;
}

async function scanBlocks(firstBlock, lastBlock) {
    if (lastBlock < firstBlock) return;

    const MAX_BLOCKS = 2047;
    const range = lastBlock - firstBlock;
    const inteval = Math.floor(range / MAX_BLOCKS);
    let min = firstBlock;

    try {
        for (let i = 0; i <= inteval; i++) {
            if (min > lastBlock) {
                break;
            }
            let max = min + MAX_BLOCKS;

            if (max > lastBlock) {
                max = lastBlock;
            }
            console.log(`minimum: ${min}, Maximum: ${max}`);
            await getWallets(min, max);


            min = max + 1;
        }
        writeToCSV(WALLETS_FOUND);

    } catch (error) {
        writeToCSV(WALLETS_FOUND);


        console.log('ERROR');
        console.log(error.code);

        if (error.code == "CALL_EXCEPTION") {
            WALLETS_FOUND = new Set();
            await scanBlocks(firstBlock, lastBlock);
        }
    }
}

function writeToCSV(data) {
    let csv = "";
    for (let row of data) { csv += row + ","; csv += "\r\n"; }

    fs.appendFile('./holders.csv', csv, 'utf8', function (err) {
        if (err) {
            console.log('Some error occured - file either not saved or corrupted file saved.');
            console.log(err);
        } else {
            console.log('It\'s saved!');
        }
    });
}

//scanBlocks(startBlock, endBlock)
scanBlocks(0, 1000000);

