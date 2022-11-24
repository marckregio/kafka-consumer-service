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

// src/utils/httpRequest.js
var require_httpRequest = __commonJS({
  "src/utils/httpRequest.js"(exports, module2) {
    var axios = require("../node_modules/axios/dist/node/axios.cjs");
    var secrets2 = require("../node_modules/config-dug/build/index.js").default;
    var https = require("https");
    var logger = require_logger();
    var httpRequest = axios.create();
    httpRequest.interceptors.request.use((axiosConfigParam) => {
      const axiosConfig = axiosConfigParam;
      axiosConfig.baseURL = secrets2.CONSUMER_WEBHOOK_URL;
      axiosConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      return axiosConfig;
    });
    httpRequest.interceptors.response.use(
      (response) => response.data,
      (error) => {
        logger.error(error);
        return Promise.reject(error);
      }
    );
    module2.exports = httpRequest;
  }
});

// src/consumer.js
var require_consumer = __commonJS({
  "src/consumer.js"(exports, module2) {
    var {
      Kafka,
      CompressionCodecs,
      CompressionTypes,
      logLevel
    } = require("../node_modules/kafkajs/index.js");
    var SnappyCodec = require("../node_modules/kafkajs-snappy/src/index.js");
    var logger = require_logger();
    var _ = require("../node_modules/lodash/lodash.js");
    var { v4: uuidv4 } = require("../node_modules/uuid/dist/index.js");
    var httpRequest = require_httpRequest();
    var secrets2 = require("../node_modules/config-dug/build/index.js").default;
    CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
    var Consumer2 = class {
      constructor() {
        this.consumer = this.initConsumer();
      }
      initConsumer() {
        logger.info(
          "Initializing Consumer with clientID:" + secrets2.KAFKA_CONSUMER_CLIENT
        );
        const hasSASL = secrets2.KAFKA_SASL === "true" ? true : false;
        const config = {
          clientId: secrets2.KAFKA_CONSUMER_CLIENT,
          brokers: [secrets2.KAFKA_CONSUMER_BROKERS],
          ssl: secrets2.KAFKA_SSL,
          logLevel: logLevel.INFO
        };
        if (hasSASL) {
          config.ssl = {
            mechanism: secrets2.KAFKA_SASL_MECHANISM,
            username: secrets2.KAFKA_SASL_USERNAME,
            password: secrets2.KAFKA_SASL_PASSWORD
          };
        }
        const kafka = new Kafka(config);
        const consumer = kafka.consumer({
          groupId: secrets2.KAFKA_CONSUMER_CLIENT + "-" + uuidv4(),
          heartbeatInterval: 2e3
        });
        return consumer;
      }
      async listen() {
        const topic = secrets2.KAFKA_TOPIC_SUB;
        await this.consumer.connect();
        await this.consumer.subscribe({ topic, fromBeginning: false });
        await this.consumer.run({
          eachBatchAutoResolve: false,
          eachBatch: this.triggerWebhook
        });
      }
      async triggerWebhook({ batch, resolveOffset }) {
        _.map(batch.messages, async (message) => {
          const response = JSON.parse(message.value.toString());
          logger.info(
            `Received message with offset ${message.offset} from TM with cbi ${response.client_batch_id}`
          );
          await httpRequest.post(secrets2.CONSUMER_WEBHOOK_ENDPOINT, response);
          resolveOffset(message.offset);
        });
      }
    };
    module2.exports = Consumer2;
  }
});

// index.js
var Consumer = require_consumer();
var http = require("http");
var secrets = require("../node_modules/config-dug/build/index.js").default;
var initializeConsumer = async () => {
  const kafka = new Consumer();
  await kafka.listen();
};
var port = secrets.CONSUMER_PORT;
var server = http.createServer((req, res) => {
});
server.listen(port, () => {
  console.log(`ud-kafka-library is running at PORT:${port}`);
  initializeConsumer();
});
