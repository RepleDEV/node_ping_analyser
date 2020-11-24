import yargs from "yargs";
import { ping } from "./modules/ping";
import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import { exec } from "child_process";
import { getCurrent } from "./modules/date";
import { OutputStream as OStream } from "./modules/outputstream";
import { convert } from "./modules/converttocsv";

const { promises: fsPromises } = fs;

const { argv } = yargs(process.argv.slice(2)).options({
    config: { type: "string" },
    C: { type: "string" },
    c: { type: "string" },
    convert: { type: "string" }
});

interface Config {
    hostname: string;
    timeout: number;
    interval?: number;
    size?: number;
    duration: {
        hour?: number;
        minute?: number;
        second?: number;
        cycles?: number;
    };
}

(async () => {
    // First, check flags

    // Flags for converting output results to CSV format
    if (argv.c) {
        await convert(argv.c).catch(err => { throw err });
        console.log("Converted!");
        return;
    } else if (argv.convert) {
        await convert(argv.convert).catch(err => { throw err });
        console.log("Converted!");
        return;
    }

    if (!argv.config || !argv.C) {
        console.log("Config file not specified! Exiting...");
        return;
    }

    console.log("Starting ping...");

    // Get config;
    const configPath = argv.config;
    const configString = await fsPromises.readFile(
        path.join(
            configPath.endsWith(".json") ? configPath : configPath + ".json"
        ),
        { encoding: "utf-8" }
    );
    const config: Config = JSON.parse(configString);

    if (!config.hostname) {
        return console.log("ERROR! Undefined hostname!");
    }

    console.log("Successfully read config file: %s", configPath);

    if (!config.interval && !config.timeout)
        throw "Unspecified interval and timeout values!";

    // Update config if it has missing values
    config.timeout = config.timeout || 5000;
    // If timeout is greater than the interval then set the timeout to the interval.
    config.timeout =
        config.interval && config.interval > config.timeout
            ? config.interval
            : config.timeout;
    // If duration is undefined set default to 1 cycle (ping ONCE)
    config.duration = config.duration || { cycles: 1 };
    config.size = config.size || 32;
    config.interval = config.interval || config.timeout;
    config.duration.cycles =
        config.duration.cycles && config.duration.cycles < 1
            ? 1
            : config.duration.cycles;

    console.log(
        `Starting with configuration:\nHostname: ${config.hostname}\nTimeout: ${config.timeout}ms.\nInterval: ${config.interval}.\n`
    );

    const currentDate = getCurrent("-");

    let finishTime: number;
    // If cycles is undefined
    if (!config.duration.cycles) {
        // Update it to current epoch time
        finishTime = Date.now();

        if (config.duration.hour) {
            // 3,600,000 times hours.
            finishTime += 3.6e6 * config.duration.hour;
        }
        if (config.duration.minute) {
            // 60,000 times minutes.
            finishTime += 6e4 * config.duration.minute;
        }
        if (config.duration.second) {
            // 1000 times seconds.
            finishTime += 1000 * config.duration.second;
        }
    }

    // Get output paths
    const outDirPath = path.resolve("out/");

    // Create the output folder if it doesn't exist
    mkdirp.sync(outDirPath);

    let outFileName = `output_${currentDate}`;

    // eslint-disable-next-line no-async-promise-executor
    const dupeNumber = await new Promise<number>(async (resolve, reject) => {
        const files = (await fsPromises.readdir(outDirPath)).filter((val) => {
            return val.startsWith(outFileName);
        });

        resolve(files.length);
    });

    if (dupeNumber > 0) outFileName += `_${dupeNumber}`;

    const outFilePath = path.join(outDirPath, outFileName + ".json");

    console.log("Output filename: %s, file path: %s", outFileName, outDirPath);

    // Create write stream
    const oStream = new OStream(config.hostname, config.timeout, config.interval, config.size, config.duration, { outputVersion: 1 })
    const wStream = fs.createWriteStream(outFilePath);

    oStream.pipe(wStream);

    let cycles = 0;

    async function end() {
        oStream.end();

        await new Promise<number>((resolve, reject) => {
            // Format the file
            exec(
                `prettier --write ${outFilePath} --tab-width 4`,
                (err, stdout, stderr) => {
                    if (err) console.log(err);
                    if (err) console.log(stderr);
                    resolve(1);
                }
            );
        });

        console.log("Ping complete!");

        process.exit();
    }

    process.on("SIGINT", async () => { await end() });

    await new Promise((resolve, reject) => {
        let loop: number;

        // eslint-disable-next-line prefer-const
        loop = setInterval(async () => {
            // Ping results
            await ping(config.hostname, {
                size: config.size,
                timeout: config.timeout,
            })
                .then((p) => {
                    console.log(`Ping! Time: ${p}ms`);

                    oStream.write(p < 0 ? config.timeout : p);
                })
                .catch((err) => {
                    console.log(
                        "Unexpected ping error! Error message: %s",
                        err.message
                    );

                    oStream.write(-1);
                });

            if (
                (config.duration.cycles &&
                    ++cycles == config.duration.cycles) ||
                Date.now() >= finishTime
            ) {
                clearInterval(loop);
                resolve(0);
            }
        }, config.interval);
    });

    await end();
})();
