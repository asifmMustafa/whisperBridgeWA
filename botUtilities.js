const axios = require("axios");
const { catchError } = require("./errorHandler");
require("dotenv").config();

const sendMessage = async (chat_id, phone_id, message) => {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v16.0/${phone_id}/messages?access_token=${process.env.TOKEN}`,
      {
        messaging_product: "whatsapp",
        to: chat_id,
        type: "text",
        text: {
          body: message,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return res.data.messages[0].id;
  } catch (err) {
    catchError(err);
    console.log(err.message);
    console.log("Error sending message");
  }
};

module.exports = {
  sendMessage,
};
