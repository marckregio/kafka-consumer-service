var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/utils/logger.js
var require_logger = __commonJS({
  "src/utils/logger.js"(exports, module2) {
    require("../node_modules/dotenv/lib/main.js").config();
    var winston = require("../node_modules/winston/lib/winston.js");
    var enumerateErrorFormat = winston.format((info) => {
      if (info instanceof Error) {
        Object.assign(info, { message: info.stack });
      }
      return info;
    });
    var logger = winston.createLogger({
      level: "debug",
      format: winston.format.combine(
        enumerateErrorFormat(),
        winston.format.colorize(),
        winston.format.splat(),
        winston.format.printf(({ level, message }) => `${level} : ${message}`)
      ),
      transports: [
        new winston.transports.Console({
          stderrLevels: ["error"]
        })
      ]
    });
    module2.exports = logger;
  }
});

// src/consumer.js
var require_consumer = __commonJS({
  "src/consumer.js"(exports, module2) {
    var { Kafka, CompressionCodecs, CompressionTypes, logLevel } = require("../node_modules/kafkajs/index.js");
    var SnappyCodec = require("../node_modules/kafkajs-snappy/src/index.js");
    var logger = require_logger();
    var secrets2 = require("../node_modules/config-dug/build/index.js").default;
    CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
    var Consumer2 = class {
      constructor() {
        this.consumer = this.initConsumer();
      }
      initConsumer() {
        logger.info("Initializing Consumer with clientID:" + secrets2.KAFKA_CLIENT_ID);
        const hasSSL = secrets2.KAFKA_SSL === "true" ? true : false;
        const config = {
          clientId: secrets2.KAFKA_CLIENT_ID,
          brokers: secrets2.KAFKA_BROKERS,
          ssl: secrets2.KAFKA_SSL,
          logLevel: logLevel.INFO
        };
        if (hasSSL) {
          config.ssl = {
            mechanism: secrets2.KAFKA_SASL_MECHANISM,
            username: secrets2.KAFKA_SASL_USERNAME,
            password: secrets2.KAFKA_SASL_PASSWORD
          };
        }
        return new Kafka(config);
      }
    };
    module2.exports = Consumer2;
  }
});

// index.js
var Consumer = require_consumer();
var http = require("http");
var secrets = require("../node_modules/config-dug/build/index.js").default;
var initializeConsumer = () => {
  const kafka = new Consumer();
};
var port = secrets.CONSUMER_PORT;
var server = http.createServer((req, res) => {
});
server.listen(port, () => {
  console.log(`Server running at PORT:${port}`);
  initializeConsumer();
});
