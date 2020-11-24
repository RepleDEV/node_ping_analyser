import { Readable } from "stream";
import * as fs from "fs";
import { getCurrent } from "./date";

const stream = new Readable({ encoding: "utf-8" });
stream._read = () => {}; // eslint-disable-line @typescript-eslint/no-empty-function

let first = true;

class OutputStream {
    constructor(
        hostname: string,
        timeout: number,
        interval: number,
        size: number,
        duration: { [key: string]: any },
        otherHeaderProperties?: { [key: string]: any }
    ) {
        // File header
        stream.push(
            [
                "{",
                // Additional (probably) useful information
                `"date": "${getCurrent()}",`,
                `"hostname": "${hostname}",`,
                `"timeout": ${timeout},`,
                `"interval": ${interval},`,
                `"size": ${size},`,
                `"duration": ${JSON.stringify(duration || {})},`,
                (() => {
                    const res: string[] = [];
                    for (const x in otherHeaderProperties) {
                        res.push(`"${x}": ${otherHeaderProperties[x]}`);
                    }
                    return res.join(",") + ",";
                })(),
                '"output": [',
            ].join(" ")
        );
    }
    pipe(wStream: fs.WriteStream): void {
        stream.pipe(wStream);
    }
    write(ping: number): void {
        const date = new Date();

        // Get time as format: HH:MM:SS
        const time = [
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
        ].join(":");
        
        if (first) {
            first = false;
        } else {
            stream.push(",");
        }

        stream.push(
            JSON.stringify({
                ping: ping,
                time: time,
            })
        );
    }
    end(): void {
        // File footer
        stream.push("] }");
        stream.destroy();
    }
}

export { OutputStream };
