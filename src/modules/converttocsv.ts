import * as fs from "fs";
import stringify from "csv-stringify";

function checkIfFileExists(path: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        fs.access(path, fs.constants.F_OK, (err) => {
            if (err) return resolve(false);
            resolve(true);
        });
    });
}

function checkIfFileIsOutputFile(path: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        if (!path.endsWith(".json")) return resolve(false);
        fs.promises.readFile(path, { encoding: "utf-8" }).then((data) => {
            const parsed = JSON.parse(data);

            // Might get a more robust version in the future
            if ("outputVersion" in parsed) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

function convert(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!checkIfFileIsOutputFile(path))
            return reject("FILE IS NOT AN OUTPUT FILE");
        if (!checkIfFileExists(path)) return reject("FILE DOES NOT EXIST");
        fs.promises.readFile(path, { encoding: "utf-8" }).then((data) => {
            const parsed = JSON.parse(data);
            stringify(
                parsed.output,
                {
                    header: true,
                    columns: { ping: "Ping (Milliseconds)", time: "Time" },
                },
                async (err, data) => {
                    if (err) return reject(err);

                    await fs.promises.writeFile(
                        path.substring(0, path.length - 5) + ".csv",
                        data,
                        { encoding: "utf-8" }
                    );
                    resolve();
                }
            );
        });
    });
}

export { convert, checkIfFileExists };
