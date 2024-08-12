const {
  getMaintenanceModeStatus,
  getIsZimbabweUsersBanned,
  getMessages,
} = require("./snapshotListeners");
const axios = require("axios");
const { sendMessage } = require("./botUtilities");
const { catchError, app } = require("./errorHandler");

const etaEngineURL = process.env.ENGINE_URL;

// Array to store chat_id of user that has ongoing process
let generating = [];

const forwardToEtaEngine = async (messageData, retries = 3) => {
  const phone_id = messageData.metadata.phone_number_id;
  const chat_id = messageData.messages[0].from;

  await sendMessage(chat_id, phone_id, `⏳⏳⏳`);

  try {
    if (retries === 3 && generating.includes(chat_id)) {
      sendMessage(chat_id, phone_id, getMessages().multitasking_error.english);
      return;
    }

    if (retries === 3) generating.push(chat_id);

    const response = await axios.post(etaEngineURL, messageData);
    if (response.data && response.data.message === "Processed.") {
      console.log("Processed.");
      generating = generating.filter((item) => item !== chat_id);
      return true;
    }
    throw new Error("Failed to process");
  } catch (error) {
    catchError(error);
    if (error.code === "ECONNRESET") {
      if (retries > 0) {
        console.log("Retrying, attempts left: ", retries);
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return forwardToEtaEngine(messageData, retries - 1);
      } else {
        sendMessage(chat_id, phone_id, getMessages().processing_error.english);
        generating = generating.filter((item) => item !== chat_id);
        return false;
      }
    } else {
      console.log(error.message);
      sendMessage(chat_id, phone_id, getMessages().processing_error.english);
      generating = generating.filter((item) => item !== chat_id);
      return false;
    }
  }
};

app.listen(process.env.PORT, () => {
  console.log(`WhisperBridgeWA is listening on port ${process.env.PORT}`);
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = req.query["hub.verify_token"];

  if (mode && verifyToken) {
    if (mode === "subscribe" && verifyToken === "pizza") {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.post("/webhook", (req, res) => {
  try {
    const body = req.body;
    if (body.object === "whatsapp_business_account") {
      body.entry.forEach(async (entry) => {
        entry.changes.forEach(async (change) => {
          if (change.field === "messages") {
            const messageData = change.value;
            if (
              messageData &&
              Array.isArray(messageData.messages) &&
              messageData.messages.length > 0
            ) {
              const phone_id = messageData.metadata.phone_number_id;
              const chat_id = messageData.messages[0].from;

              const countryCallingCode = chat_id.substring(0, 3);
              const isUserBanned =
                getIsZimbabweUsersBanned() && countryCallingCode == "263";

              if (isUserBanned) return;

              if (getMaintenanceModeStatus()) {
                return sendMessage(
                  chat_id,
                  phone_id,
                  getMessages().maintenance_mode.english
                );
              }
              forwardToEtaEngine(messageData);
            }
          }
        });
      });
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    catchError(err);
    console.log(err.message);
  }
});
