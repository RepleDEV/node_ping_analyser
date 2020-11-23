# node_ping_analyser

Just a random ping/latency analyser for troubleshooting  
ping/latency issues with your connection.

## Setup

### Install Dependencies

```bash
$ npm install
```

### Usage

Create a `JSON` formatted config file and place it in the `config` directory.

The config file must follow the following format:

```json
{
    "hostname": "HOSTNAME", // Hostname to ping
    "timeout": TIMEOUT, // Timeout of each request in MILLISECONDS
    "interval" TIMEOUT, // Interval for each request in MILLISECONDS
    "duration": {
        // USE EITHER CYCLES
        "cycles": CYCLES,
        // OR HOURS, MINUTES AND SECONDS.
        "hour": HOURS,
        "minute": MINUTES,
        "second": SECONDS
        // IF CYCLES AND TIME ARE BOTH SPECIFIED, THE FORMER (CYCLES) WILL BE USED.

    }
}
```

Example (used as default config):

```json
{
    "hostname": "google.com",
    "timeout": 5000,
    "interval": 5000,
    "duration": {
        "cycles": 10
    }
}
```

Then, Run:

```bash
$ npm start --config <your_config_name>
```

## Supported Operating Systems

-   Windows
