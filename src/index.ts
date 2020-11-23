import yargs from "yargs";
import { ping } from "./modules/ping";
import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import { Readable } from "stream";
import { exec } from "child_process";
import { resolve } from "path";

const { promises: fsPromises } = fs;

const { argv } = yargs(process.argv.slice(2)).options({
    config: { type: "string", default: "default" },
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

function getCurrentDate(split = "/"): string {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0"); // January is 0!
    const yyyy = today.getFullYear();

    return [mm, dd, yyyy].join(split);
}

(async () => {
    console.log("Starting ping...");

    // Get config;
    const configPath = path.resolve("config/");
    const configName = argv.config;
    const configString = await fsPromises.readFile(
        path.join(
            configPath,
            configName.endsWith(".json") ? configName : configName + ".json"
        ),
        { encoding: "utf-8" }
    );
    const config: Config = JSON.parse(configString);

    if (!config.hostname) {
        return console.log("ERROR! Undefined hostname!");
    }

    console.log("Read config file: %s", configName);

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
        `Starting with configuration:\nHostname: ${config.hostname}\nTimeout: ${config.timeout}.\n`
    );

    const currentDate = getCurrentDate("-");

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
    const write = new Readable({ encoding: "utf-8" });
    const stream = fs.createWriteStream(outFilePath);
    write._read = () => {}; // eslint-disable-line @typescript-eslint/no-empty-function

    write.pipe(stream);

    // Initialize file header
    write.push(
        [
            "{",
            // Additional (probably) useful information
            `"date": "${currentDate}",`,
            `"hostname": "${config.hostname}",`,
            `"timeout": ${config.timeout},`,
            `"size": ${config.size},`,
            `"duration": ${JSON.stringify(config.duration || {})},`,
            '"output": [',
        ].join(" ")
    );

    let cycles = 0;

    function writeOutput(ping: number) {
        const date = new Date();

        // Get time as format: HH:MM:SS
        const time = [
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
        ].join(":");

        write.push(
            JSON.stringify({ ping: ping < 0 ? config.timeout : ping, time: time })
        );
    }

    await new Promise((resolve, reject) => {
        let loop: number;

        // eslint-disable-next-line prefer-const
        loop = setInterval(async () => {
            // Ping results
            await ping(config.hostname, {
                size: config.size,
                timeout: config.timeout,
            }).then(p => {
                console.log(`Ping! Time: ${p}ms`);

                writeOutput(p < 0 ? config.timeout : p);
            }).catch((err) => {
                console.log("Unexpected ping error! Error message: %s", err.message)
                
                writeOutput(-1);
            });

            if (
                (config.duration.cycles &&
                    ++cycles == config.duration.cycles) ||
                Date.now() >= finishTime
            ) {
                clearInterval(loop);
                resolve();
            } else {
                write.push(",");
            }
        }, config.interval);
    });

    // Finish file footer
    write.push("] }");
    write.destroy();

    // Format the file
    exec(
        `prettier --write ${outFilePath} --tab-width 4`,
        (err, stdout, stderr) => {
            if (err) console.log(err);
            if (err) console.log(stderr);
        }
    );

    console.log("Ping complete!");
})();
