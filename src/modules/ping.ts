import { exec } from "child_process";

interface PingOptions {
    timeout?: number;
    size?: number;
}

function ping(hostname: string, options?: PingOptions): Promise<number> {
    return new Promise((resolve, reject) => {
        const cmd = ["ping", "-n", "1", hostname];
        if (options) {
            const { timeout, size } = options;
            if (timeout) cmd.push("-w", timeout.toString());
            if (size) cmd.push("-l", size.toString());
        }

        exec(cmd.join(" "), (err, stdout, stderr) => {
            if (err && !stdout.includes("Request timed out")) reject(err);
            if (stderr) reject(err);

            if (stdout.includes("Request timed out")) return resolve(-1);

            let timeStr = stdout.split(" ")[11];
            timeStr = timeStr.substring(5, timeStr.length - 2);

            resolve(timeStr == "<1" ? 0 : +timeStr);
        });
    });
}

export { ping };
