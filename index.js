const Slackbot = require("slackbots");
const axios = require("axios");
const schedule = require("node-schedule");
const _ = require("lodash");
require("dotenv").config();

const bot = new Slackbot({
  token: process.env.SLACK_TOKEN_CORTEX,
  name: "Cortex Weather Bot"
});

// Start Handler
bot.on("start", () => {
  let params = {
    icon_emoji: ":robot_face:"
  };
  bot.postMessageToGroup(
    "janusz-interview-room",
    "Currently tracking weather conditions for New York City.",
    params
  );
});

// SlackBot Error Handler
bot.on("error", err => console.log(err));

// Message Handler
bot.on("message", data => {
  if (data.type !== "message") {
    return;
  }
  handleMessage(data.text, data);
});

// Declare weather objects
let weatherToday = {};
let weatherTmrw = {};

// Respond to Slack messages
const handleMessage = async message => {
  if (message && message.toLowerCase().includes("weather now")) {
    getTodayWeather(true);
  } else if (message && message.toLowerCase().includes("weather tomorrow")) {
    await getTodayWeather(false);
    await getTomorrowWeather(true);
  }
};

// EXAMPLE: https://api.darksky.net/forecast/[key]/[latitude],[longitude]

const newYorkCoords = "42.3601,-71.0589";
const losAngelesCoords = "34.0522,-118.2437";
const tokyoCoords = "35.6895,139.6917";

// Retrieve todays weather conditions and post to the channel
const getTodayWeather = async postChannelFlag => {
  const token = process.env.DARK_SKY_TOKEN;
  await axios
    .get(`https://api.darksky.net/forecast/${token}/${newYorkCoords}`)
    .then(resp => {
      weatherToday = resp.data;
      let todaySummary = weatherToday.currently.summary;
      let temp = Math.round(+weatherToday.currently.temperature);
      let windSpeed = Math.round(+weatherToday.currently.windSpeed);
      let windBearing = degToCompass(weatherToday.currently.windBearing);
      let precipitation = weatherToday.currently.precipProbability;
      let humidity = weatherToday.currently.humidity * 100;
      let params = changeEmojiOnConditions(todaySummary);

      if (postChannelFlag === true) {
        bot.postMessageToGroup(
          "janusz-interview-room",
          `It is currently ${temp}ºF. The current conditions are ${todaySummary} with ${windSpeed}mph ${windBearing} winds, a ${precipitation}% chance of rain and ${humidity}% humidity.`,
          params
        );
      }
      return todaySummary;
    })

    // Error handling for API
    .catch(err => {
      if (!_.isEmpty(err) && err.response.status !== 200) {
        this.weather = err.response;
        const message =
          "There was an issue getting weather data from Darksky. Please try again later.";
        bot.postMessageToGroup(
          "janusz-interview-room",
          `${message}`,
          {}
        );
      }
    });
};

// Get tomorrow's weather and post to the channel
const getTomorrowWeather = async postChannelFlag => {
  const token = process.env.DARK_SKY_TOKEN;
  let today = new Date();
  let tomorrow = Math.round(new Date(today.getTime() + 24 * 60 * 60 * 1000).getTime() / 1000);
  await axios
    .get(`https://api.darksky.net/forecast/${token}/${newYorkCoords},${tomorrow}`)
    .then(resp => {
      weatherTmrw = resp.data;
      let tmrwSummary = weatherTmrw.currently.summary;
      let temp = Math.round(+weatherTmrw.currently.temperature);
      let windSpeed = Math.round(+weatherTmrw.currently.windSpeed);
      let windBearing = degToCompass(weatherTmrw.currently.windBearing);
      let precipitation = weatherTmrw.currently.precipProbability;
      let humidity = weatherTmrw.currently.humidity * 100;
      let params = changeEmojiOnConditions(tmrwSummary);

      if (postChannelFlag === true) {
        bot.postMessageToGroup(
          "janusz-interview-room",
          `It will be ${temp}ºF tomorrow.  It will be ${tmrwSummary} with ${windSpeed}mph ${windBearing} winds, a ${precipitation}% chance of rain and ${humidity}% humidity.`,
          params
        );
      }

      // Check if both weather objects have been populated and if temp difference >= 10, precip probability >= 30, or a weather alert in the array
      if (
        !_.isEmpty(weatherToday) &&
        !_.isEmpty(weatherTmrw) &&
        Math.abs(temp - weatherToday.currently.temperature >= 10 ||
        Math.abs(precipitation - weatherToday.currently.precipitation >= 30) ||
        !_.isEmpty(weatherTmrw.alerts)
        ) 
      ) {
        setWeatherAlert();
      }

      return tmrwSummary;
    })

    // Error handling for API
    .catch(err => {
      console.log(err);
      if (!_.isEmpty(err) && err.response.status !== 200) {
        const message = "There was an issue getting weather data from Darksky. Please try again later.";
        bot.postMessageToGroup(
          "janusz-interview-room",
          message,
          {}
        );
      }
    });
};

// Schedule a node task to post to the channel at 6am
const setWeatherAlert = () => {
  const schedulerCallback = () => {
    bot.postMessageToGroup(
      "janusz-interview-room",
      `<!channel> The weather is expected to change today.`,
      {}
    );
    getTodayWeather(true);
  };
  bot.postMessageToGroup(
    "janusz-interview-room",
    "I can see that the conditions are expected to change significantly tomorrow. I will remind you of the weather at 6AM tomorrow."
  );
  schedule.scheduleJob({ hour: 6 }, schedulerCallback);
};

// Adjust the app icon based on the weather conditions it announces
const changeEmojiOnConditions = condition => {
  const params = {
    icon_emoji: ""
  };

  if (condition.includes("Clear") || condition === "Sunny") {
    params.icon_emoji = ":sunny:";
  } else if (condition.includes("Rain") || condition.includes("Drizzle")) {
    params.icon_emoji = ":rain_cloud:";
  } else if (condition.includes("Mostly Cloudy")) {
    params.icon_emoji = ":sun_behind_cloud:";
  } else if (condition.includes("Partly Cloudy")) {
    params.icon_emoji = ":sun_small_cloud:";
  }
  return params;
};

// Converts bearing to compass direction for windspeed
const degToCompass = num => {
  let val = Math.floor(num / 22.5 + 0.5);
  let arr = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW"
  ];
  return arr[val % 16];
};
